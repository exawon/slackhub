var fs = require('fs');
var express = require('express');
var SlackBot = require('./slackbot');

var package = readJsonFile('./package.json');
var config = readJsonFile('./config.json');

function readJsonFile(fileName) {
    try {
        var fileContents = fs.readFileSync(fileName, 'utf8');
        return JSON.parse(fileContents);
    }
    catch (e) {
        console.log('!!!', e);
    }
}

var app = express();
app.set('port', (process.env.PORT || 8989));
app.all('/', function (req, res) {
    res.send(package.name + ' ' + package.version);
});

app.listen(app.get('port'), function() {
  console.log(package.name + ' ' + package.version + ' is running on port', app.get('port'));
});

for (var i in config.hubs) {
    var hub = config.hubs[i];
    hub.bots = [];

    for (var j in hub.tokens) {
        startHubBot(hub, hub.tokens[j]);
    }
}

function startHubBot(hub, token) {
    var bot = new SlackBot(token);
    bot.hub = hub;
    hub.bots.push(bot);

    bot.on('event', function(data) {
        var channel = bot.getChannel(data);
        var user = bot.getUser(data);

        switch (data.type) {
            case 'channel_joined':
            case 'channel_unarchive':
            case 'group_joined':
            case 'group_unarchive':
                botCommand(bot, channel, '@ teams');
                hubJoinedMessage(bot, channel.name);
                break;

            case 'channel_left':
            case 'channel_archive':
            case 'channel_deleted':
            case 'group_left':
            case 'group_archive':
            case 'group_close':
                hubLeftMessage(bot, channel.name);
                break;

            case 'user_typing':
                hubBotTyping(bot, channel.name);
                break;

            case 'message':
                if (!bot.isMemberOf(channel) || bot.isUser(user)) {
                    break;
                }

                if (!data.subtype) {
                    var botLink = '<@' + bot.self.id + '>';
                    if (botLink == data.text.substr(0, botLink.length)) {
                        botCommand(bot, channel, data.text);
                    }
                    else {
                        hubUserMessage(bot, channel.name, user, data.text);
                    }
                    break;
                }

                switch (data.subtype) {
                    case 'me_message':
                        hubUserMessage(bot, channel.name, user, italicText(data.text));
                        break;

                    case 'file_share':
                        hubUserMessage(bot, channel.name, user, data.file.permalink_public);
                        break;

                    case 'file_mention':
                        // not implemented
                        break;

                    case 'file_comment':
                        // not implemented
                        break;

                    case 'message_chaned':
                    case 'message_deleted':
                        botMessage(bot, channel, 'The message is still remained in the other teams.');
                        break;

                    case 'channel_join':
                    case 'channel_leave':
                    case 'group_join':
                    case 'group_leave':
                        if (data.text) {
                            hubBotMessage(bot, channel.name, data.text);
                        }
                        break;

                    case 'channel_name':
                    case 'group_name':
                        botCommand(bot, channel, '@ teams');
                        hubLeftMessage(bot, data.old_name);
                        hubJoinedMessage(bot, data.name);
                        break;
                }
                break;
        }
    });

    bot.rtmStart();
}

function botCommand(bot, channel, text) {
    var commands = text.split(' ');
    switch (commands[1])
    {
        case 'teams':
            var teamNames = makeHubTeamNames(bot, channel);
            var be = (teamNames.indexOf(',') > 0) ? ' are' : ' is';
            botMessage(bot, channel, 'Team ' + teamNames + be + ' in #' + channel.name);
            break;

        case 'members':
            var userNames = makeHubUserNames(bot, channel);
            var be = (userNames.indexOf(',') > 0) ? ' are' : ' is';
            botMessage(bot, channel, userNames + be + ' in #' + channel.name);
            break;

        default:
            var help = package.name + ' ' + package.version + ' Commands: `teams`, `members`';
            botMessage(bot, channel, help);
            break;
    }
}

function makeHubTeamNames(bot, channel) {
    var teamNames = '';
    var delim = '';
    foreachHubBots(bot, channel.name, function (hubBot, hubChannel) {
        teamNames += delim + hubBot.team.name;
        delim = ', ';
    });

    if (teamNames == '') {
        return 'No team';
    }

    return teamNames;
}

function makeHubUserNames(bot, channel) {
    var userNames = '';
    var delim = '';
    foreachHubBots(bot, channel.name, function (hubBot, hubChannel) {
        var members = hubChannel.members;
        for (var i in members) {
            var user = hubBot.userIdMap[members[i]];
            if (!user.deleted) {
                userNames += delim + hubUserName(hubBot, user);
                delim = ', ';
            }
        }
    });

    if (userNames == '') {
        return 'No member from other team';
    }

    return userNames;
}

function italicText(text) {
    var lines = text.split('\n');
    text = '';
    for (var i in lines) {
        text += '_ ' + lines[i] + ' _\n';
    }
    return text;
}

function botMessage(bot, channel, text) {
    bot.send('message', {
        channel: channel.id,
        text: italicText(text)
    });
}

function hubBotTyping(bot, channelName) {
    foreachHubBots(bot, channelName, function(hubBot, outChannel) {
        hubBot.send('typing', {
            channel: outChannel.id,
        })
    });

}

function hubUserName(bot, user) {
    return (user.real_name || user.name) + ' (from ' + bot.team.name + ')';
}

function transitLink(bot, text) {
    var transited = '';
    while (true) {
        var left = text.indexOf('<');
        if (left < 0) {
            break;
        }

        var right = text.indexOf('>', left);
        if (right < 0) {
            break;
        }

        transited += text.substr(0, left);
        var link = text.substring(left + 1, right);
        var delim = link.indexOf('|');
        text = text.substr(right + 1);

        var linkText;
        if (delim > 0) {
            linkText = link.substr(delim + 1);
            link = link.substr(0, delim);
        }

        switch (link[0]) {
            case '!':
                transited += '@everyone';
                break;

            case '@':
                var user = bot.userIdMap[link.substr(1)];
                transited += '*' + hubUserName(bot, user) + '*';
                break;

            case '#':
                var channel = bot.channelIdMap[link.substr(1)];
                transited += '#' + channel.name;
                break;

            default:
                if (linkText) {
                    transited += '*' + linkText + '* ' + link;
                }
                else {
                    transited += link;
                }
                break;
        }
    }
    return transited + text;
}

function hubJoinedMessage(bot, channelName) {
    hubBotMessage(bot, channelName, 'Team ' + bot.team.name + ' is joined #' + channelName);
}

function hubLeftMessage(bot, channelName) {
    hubBotMessage(bot, channelName, 'Team ' + bot.team.name + ' is left #' + channelName);
}

function hubBotMessage(bot, channelName, text) {
    text = transitLink(bot, text);

    foreachHubBots(bot, channelName, function(hubBot, outChannel) {
        hubBot.send('message', {
            channel: outChannel.id,
            text: italicText(text)
        });
    });
}

function hubUserMessage(bot, channelName, user, text) {
    var userName = hubUserName(bot, user);
    text = transitLink(bot, text);

    foreachHubBots(bot, channelName, function(hubBot, outChannel) {
        hubBot.api('chat.postMessage', {
            channel: outChannel.id,
            text: text,
            username: userName,
            as_user: false,
            link_names: 1,
            unfurl_links: true,
            unfurl_media: true,
            icon_url: user.profile.image_48
        });
    });
}

function foreachHubBots(bot, channelName, func) {
    for (var i in bot.hub.bots) {
        var hubBot = bot.hub.bots[i];
        if (!hubBot.ws || hubBot == bot) {
            continue;
        }

        var outChannel = hubBot.channelNameMap[channelName];
        if (!hubBot.isMemberOf(outChannel)) {
            continue;
        }

        func(hubBot, outChannel);
    }
}
