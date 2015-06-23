# SlackHub

SlackHub is a [bot user](https://api.slack.com/bot-users) for [Slack](http://slack.com) using [RTM API](https://api.slack.com/rtm).  
Make your team possible to communicate with other teams.  

- Share public channels  
- Share private groups  
- Share uploaded files  

You don't need to configure webhooks for every channel and every changing.  
Add a bot once, that's all.  
It's simple and elegant!  

## Requirements

Node.js

## Configuration

1. Visit the bot integration page of each team.  
  https://**YOURTEAMS**.slack.com/services/new/bot
1. Make a file named config.json. *(e.g. config_example.json)*
1. Add a new bot for each team to share channels.
1. Add every token to config.json.
1. Run index.js.

## Usage

- It will be shared among **same name** channels which the bot is staying.
- Just invite the bot to a public channel or private group when you want to share.
- Just kick the bot when you want to stop sharing.
- Renaming channel can cause breaking sharing or unexpected shareing.
- Mention the bot for the hints of commands.  

## Unability

- To apply deleted or edited messages to other teams.
- To forward messages from other integrations.
- To open direct message to a member of other team.

## Disclaimer

I didn't consider about performace, stability and security.  
Please use SlackHub at your own risk.

## References

- slack-bot-api: https://github.com/mishk0/slack-bot-api
- slackbotapi: https://github.com/xBytez/slackbotapi
- node-slackbot: https://github.com/rmcdaniel/node-slackbot
- slackline: https://github.com/ernesto-jimenez/slackline
- slacktogo: https://github.com/oderwat/slacktogo

## Contact

exawon@gmail.com
