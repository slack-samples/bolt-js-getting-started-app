const { App } = require('@slack/bolt');
const axios = require('axios');

/**
 * Slack application with Japan AI integration
 * This app forwards messages to Japan AI API and returns the response
 */

// Initialize Slack app with bot token and socket mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Store session IDs for each thread
// Key: channel_id:thread_ts, Value: { sessionId, lastActivity }
const threadSessions = new Map();

// Session cleanup interval (24 hours)
const SESSION_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_TIME = 24 * 60 * 60 * 1000; // Sessions expire after 24 hours of inactivity

// Japan AI API configuration
const JAPAN_AI_CONFIG = {
  baseURL: 'https://api.japan-ai.co.jp',
  apiKey: process.env.JAPAN_AI_API_KEY, // Add this to your environment variables
  endpoint: '/chat/v2',
  // Default parameters for API requests
  defaultParams: {
    userId: "koki.hosaka@geniee.co.jp",
    systemPrompt: "",
    artifactIds: [], // Add artifact IDs if needed
    chatContextLimit: 100,
    stream: false,
    agentName: "96d712ad-ec3d-4309-a2c6-d3040e0767a2", // Change this to your agent name
    temperature: 0.7,
    referenceType: "detail",
    topResults: 20
  }
};

/**
 * Generate a unique session ID
 * @returns {string} - A unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create session ID for a thread
 * @param {string} channelId - The channel ID
 * @param {string} threadTs - The thread timestamp (null for new conversations)
 * @returns {string|null} - The session ID or null for new conversations
 */
function getOrCreateSessionId(channelId, threadTs) {
  if (!threadTs) {
    // No thread timestamp means it's a new conversation
    return null;
  }

  const threadKey = `${channelId}:${threadTs}`;
  const existingSession = threadSessions.get(threadKey);
  
  if (existingSession) {
    // Update last activity time
    existingSession.lastActivity = Date.now();
    return existingSession.sessionId;
  }
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [threadKey, session] of threadSessions.entries()) {
    if (now - session.lastActivity > SESSION_EXPIRY_TIME) {
      threadSessions.delete(threadKey);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
  }
}

// Set up periodic cleanup of expired sessions
setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL);

/**
 * Function to call Japan AI API
 * @param {string} message - The message to send to Japan AI
 * @param {string|null} sessionId - The session ID for continuing conversations
 * @returns {Promise<{response: string, sessionId: string}>} - The response from Japan AI and session ID
 */
async function callJapanAI(message, sessionId = null) {
  try {
    const requestBody = {
      prompt: message,
      ...JAPAN_AI_CONFIG.defaultParams
    };

    // Add sessionId if it exists (for continuing conversations)
    if (sessionId) {
      requestBody.sessionId = sessionId;
      console.log(`🔄 Continuing session: ${sessionId}`);
    } else {
      console.log('🆕 Starting new conversation session');
    }

    const response = await axios.post(
      `${JAPAN_AI_CONFIG.baseURL}${JAPAN_AI_CONFIG.endpoint}`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${JAPAN_AI_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract the response text and session ID from the API response
    let responseText = '';
    let returnedSessionId = sessionId; // Keep existing session ID by default

    // Extract response text
    if (response.data && response.data.response) {
      responseText = response.data.response;
    } else if (response.data && response.data.chatMessage) {
      responseText = response.data.chatMessage;
    } else if (response.data && response.data.content) {
      responseText = response.data.content;
    } else if (typeof response.data === 'string') {
      responseText = response.data;
    } else {
      responseText = JSON.stringify(response.data);
    }

    // Extract session ID if returned by API
    if (response.data && response.data.sessionId) {
      returnedSessionId = response.data.sessionId;
      console.log(`📌 Received session ID from API: ${returnedSessionId}`);
    }

    return {
      response: responseText,
      sessionId: returnedSessionId
    };

  } catch (error) {
    console.error('Error calling Japan AI API:', error.response?.data || error.message);
    throw new Error(`Japan AI API error: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Handle app mentions (@yourbot)
 * This ensures the bot responds when directly mentioned
 */
app.event('app_mention', async ({ event, say }) => {
  try {
    // Remove the mention from the text
    const messageText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    if (!messageText) {
      await say({
        text: 'こんにちは！何かお手伝いできることはありますか？',
        thread_ts: event.thread_ts || event.ts
      });
      return;
    }

    // Determine the thread timestamp
    // If this is already in a thread, use that thread's timestamp
    // If this is a new message, it will become the thread starter
    const threadTs = event.thread_ts || event.ts;

    // Get or create session ID for this thread
    const sessionId = getOrCreateSessionId(event.channel, event.thread_ts);

    // Show thinking message
    const thinkingMessage = await say({
      text: '考え中... :thinking_face:',
      thread_ts: threadTs
    });

    // Call Japan AI API with session ID
    const aiResult = await callJapanAI(messageText, sessionId);

    // If this is the first message in a new thread, store the session ID
    if (!event.thread_ts && aiResult.sessionId) {
      const threadKey = `${event.channel}:${event.ts}`;
      threadSessions.set(threadKey, {
        sessionId: aiResult.sessionId,
        lastActivity: Date.now()
      });
      console.log(`📝 Stored session for new thread ${threadKey}: ${aiResult.sessionId}`);
    }

    // Update with response
    await app.client.chat.update({
      channel: event.channel,
      ts: thinkingMessage.ts,
      text: aiResult.response,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: aiResult.response
          }
        }
      ]
    });

    // Log session info
    console.log(`✅ Response sent. Thread: ${threadTs}, Session: ${aiResult.sessionId || 'new'}`);

  } catch (error) {
    console.error('Error handling app mention:', error);
    await say({
      text: `エラーが発生しました: ${error.message}`,
      thread_ts: event.thread_ts || event.ts
    });
  }
});

/**
 * Handle direct messages to the bot
 * This allows for DM conversations with session management
 */
app.event('message', async ({ event, say }) => {
  // Only respond to DMs (direct messages)
  if (event.channel_type !== 'im') return;
  
  // Ignore bot messages to prevent loops
  if (event.bot_id || event.subtype === 'bot_message') return;

  try {
    const messageText = event.text;
    
    // Determine the thread timestamp for DMs
    const threadTs = event.thread_ts || event.ts;
    
    // Get or create session ID for this DM thread
    const sessionId = getOrCreateSessionId(event.channel, event.thread_ts);

    // Show thinking message
    const thinkingMessage = await say({
      text: '考え中... :thinking_face:',
      thread_ts: threadTs
    });

    // Call Japan AI API with session ID
    const aiResult = await callJapanAI(messageText, sessionId);

    // If this is the first message in a new DM thread, store the session ID
    if (!event.thread_ts && aiResult.sessionId) {
      const threadKey = `${event.channel}:${event.ts}`;
      threadSessions.set(threadKey, {
        sessionId: aiResult.sessionId,
        lastActivity: Date.now()
      });
      console.log(`📝 Stored session for new DM thread ${threadKey}: ${aiResult.sessionId}`);
    }

    // Update with response
    await app.client.chat.update({
      channel: event.channel,
      ts: thinkingMessage.ts,
      text: aiResult.response,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: aiResult.response
          }
        }
      ]
    });

    console.log(`✅ DM response sent. Thread: ${threadTs}, Session: ${aiResult.sessionId || 'new'}`);

  } catch (error) {
    console.error('Error handling direct message:', error);
    await say({
      text: `エラーが発生しました: ${error.message}`,
      thread_ts: event.thread_ts || event.ts
    });
  }
});

/**
 * Health check endpoint
 */
app.message('ping', async ({ message, say }) => {
  // Only respond in DMs or when mentioned
  if (message.channel_type !== 'im') return;
  
  await say({
    text: `pong! :ping_pong: Japan AI integration is working!\n現在のアクティブセッション数: ${threadSessions.size}`,
    thread_ts: message.thread_ts || message.ts
  });
});

/**
 * Command to reset a thread's session (useful for testing or starting fresh)
 */
app.message(/^!reset session$/i, async ({ message, say }) => {
  const threadKey = `${message.channel}:${message.thread_ts || message.ts}`;
  
  if (threadSessions.has(threadKey)) {
    threadSessions.delete(threadKey);
    await say({
      text: '✅ このスレッドのセッションをリセットしました。次のメッセージから新しい会話として開始されます。',
      thread_ts: message.thread_ts || message.ts
    });
  } else {
    await say({
      text: 'ℹ️ このスレッドには既存のセッションがありません。',
      thread_ts: message.thread_ts || message.ts
    });
  }
});

/**
 * Command to show session info (for debugging)
 */
app.message(/^!session info$/i, async ({ message, say }) => {
  const threadKey = `${message.channel}:${message.thread_ts || message.ts}`;
  const session = threadSessions.get(threadKey);
  
  if (session) {
    const lastActivityDate = new Date(session.lastActivity).toLocaleString('ja-JP');
    await say({
      text: `📊 セッション情報:\n• Session ID: ${session.sessionId}\n• 最終アクティビティ: ${lastActivityDate}\n• アクティブセッション総数: ${threadSessions.size}`,
      thread_ts: message.thread_ts || message.ts
    });
  } else {
    await say({
      text: `ℹ️ このスレッドにはセッションがありません。\n• アクティブセッション総数: ${threadSessions.size}`,
      thread_ts: message.thread_ts || message.ts
    });
  }
});

/**
 * Start the app
 */
(async () => {
  // Verify required environment variables
  const requiredEnvVars = [
    'SLACK_BOT_TOKEN',
    'SLACK_APP_TOKEN',
    'JAPAN_AI_API_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables before starting the app.');
    process.exit(1);
  }

  // Start the app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app with Japan AI integration is running!');
  console.log('📡 Connected to Japan AI API at:', JAPAN_AI_CONFIG.baseURL);
  console.log('🏷️  Agent name:', JAPAN_AI_CONFIG.defaultParams.agentName);
  console.log('💬 Session management enabled for thread continuity');
  console.log('🧹 Session cleanup interval: 24 hours');
})();
