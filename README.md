# Getting Started ⚡️ Bolt for JavaScript

> Slack app example from 📚 [Getting started with Bolt for JavaScript tutorial][1]

## Overview

This is a Slack app built with the [Bolt for JavaScript framework][2] that showcases
responding to events and interactive buttons.

## Claude Code, Codex, Cursor, and Other Coding Agents

Install the [Slack MCP and Skills Plugin](https://docs.slack.dev/ai/slack-skills-plugin/) so your coding agent can create, run, and deploy Slack apps, look up Web API methods and scopes, and build Block Kit without guessing.

### Claude Code

Run this in a Claude Code session:

```
/plugin install slack@claude-plugins-official
```

### Codex

Run this in your terminal:

```sh
codex plugin marketplace add slackapi/slack-skills-plugin
codex plugin add slack@slack
```

### Cursor

Run this in a Cursor Agent chat:

```
/add-plugin slack
```

### Other agents

Install the skills with `npx skills`, using your [agent's identifier](https://github.com/vercel-labs/skills#supported-agents):

```sh
npx skills add slackapi/slack-skills-plugin -y -a <agent>

# For example, OpenCode
npx skills add slackapi/slack-skills-plugin -y -a opencode
```

## Running locally

### 0. Create a new Slack App

- Go to https://api.slack.com/apps
- Click **Create App**
- Choose a workspace
- Enter App Manifest using contents of `manifest.json`
- Click **Create**

Once the app is created click **Install to Workspace**
Then scroll down in Basic Info and click **Generate Token and Scopes** with both scopes

### 1. Setup environment variables

```zsh
# Replace with your bot and app token
export SLACK_BOT_TOKEN=<your-bot-token> # from the OAuth section
export SLACK_APP_TOKEN=<your-app-level-token> # from the Basic Info App Token Section
```

### 2. Setup your local project

```zsh
# Clone this project onto your machine
git clone https://github.com/slack-samples/bolt-js-getting-started-app.git

# Change into the project
cd bolt-js-getting-started-app/

# Install the dependencies
npm install
```

### 3. Start servers

```zsh
npm run start
```

### 4. Test

Go to the installed workspace and type "hello" in a DM to your new bot. You can also type "hello" in a channel where the bot is present.

## Contributing

### Issues and questions

Found a bug or have a question about this project? We'd love to hear from you!

1. Browse to [slackapi/bolt-js/issues][4]
1. Create a new issue
1. Select the `[x] examples` category

See you there and thanks for helping to improve Bolt for everyone!

[1]: https://tools.slack.dev/bolt-js/getting-started
[2]: https://tools.slack.dev/bolt-js/
[3]: https://tools.slack.dev/bolt-js/getting-started/#setting-up-events
[4]: https://github.com/slackapi/bolt-js/issues/new/choose
