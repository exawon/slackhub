# SlackHub

SlackHub is a [bot user](https://api.slack.com/bot-users) for [Slack](http://slack.com) using [RTM API](https://api.slack.com/rtm).  
Make your team possible to communicate with other teams.  

You don't need to configure webhooks for every channel and every changing.  
Add a bot once, that's all.  
It's simple and elegant!  

## Requirements

Node.js

## Configuration

1. Copy config_example.json to **config.json**.
1. Visit the bot integration page of each team.  
  https://**YOURTEAMS**.slack.com/services/new/bot
1. Add a new bot for each team to share channels.
1. Add every token to config.json.
1. Run index.js.

## Usage

- It will be shared **among same name channels** while the bot is staying.
- Just invite the bot to a public channel or private group when you want to share.
- Just kick the bot when you want to stop sharing.
- Mention the bot for the hints of commands.  

## Unability

- To apply deleted or edited messages to other teams.
- To forward messages from other integrations.
- To open direct message to a member of other team.

## Disclaimer

I didn't consider about performace, stability and security.  
Please use SlackHub at your own risk.

## References

- slackline: https://github.com/ernesto-jimenez/slackline
- slacktogo: https://github.com/oderwat/slacktogo
- slack-bot-api: https://github.com/mishk0/slack-bot-api
- slackbotapi: https://github.com/xBytez/slackbotapi
- node-slackbot: https://github.com/rmcdaniel/node-slackbot

## Contact

exawon@gmail.com
