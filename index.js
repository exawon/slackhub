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

var hubMap = {};
for (var i in config.hubs) {
    var hub = config.hubs[i];
    hub.bots = [];
    hubMap[hub.id] = hub;
}
for (var i in config.bots) {
    var bot = config.bots[i];
    var hub = hubMap[bot.hub_id];
    startHubBot(hub, bot.token);
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
            case 'channel_created':
            case 'channel_unarchive':
            case 'group_joined':
            case 'group_open':
            case 'group_unarchive':
                var teamNames = makeHubTeamNames(bot, channel);
                var be = (teamNames.indexOf(',') > 0) ? ' are ' : ' is ';
                botMessage(bot, channel, teamNames + be + 'in #' + channel.name);
                hubBotMessage(bot, channel, 'Team ' + bot.team.name + ' is joined #' + channel.name);
                break;

            case 'channel_left':
            case 'channel_deleted':
            case 'channel_archive':
            case 'group_left':
            case 'group_close':
            case 'group_archive':
                hubBotMessage(bot, channel, 'Team ' + bot.team.name + 'is left #' + channel.name);
                break;

            case 'channel_rename':
            case 'group_rename':
                // not implemented yet
                break;

            case 'user_typing':
                hubBotTyping(bot, channel);
                break;

            case 'message':
                if (!isBotInChannel(bot, channel) || isUserABot(user, bot)) {
                    break;
                }

                switch (data.subtype) {
                    case 'bot_message':
                    case 'pinned_item':
                    case 'unpinned_item':
                        // ignore
                        break;

                    case 'me_message':
                        hubUserMessage(bot, channel, user, italicText(data.text));
                        break;

                    case 'file_share':
                        hubUserMessage(bot, channel, user, data.file.permalink_public);
                        break;

                    case 'file_mention':
                        // not implemented
                        break;

                    case 'file_comment':
                        //hubBotMessage(bot, channel, data.text);
                        //hubUserMessage(bot, channel, user, data.text);
                        break;

                    case 'message_chaned':
                    case 'message_deleted':
                        botMessage(bot, channel, 'The message is still remained in the other teams.');
                        break;

                    default:
                        if (data.subtype) {
                            if (data.text) {
                                hubBotMessage(bot, channel, data.text);
                            }
                        }
                        else {
                            var botLink = '<@' + bot.self.id + '>';
                            if (botLink == data.text.substr(0, botLink.length)) {
                                botCommand(bot, channel, data.text);
                            }
                            else {
                                hubUserMessage(bot, channel, user, data.text);
                            }
                            break;
                        }
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
            botMessage(bot, channel, teamNames + be + ' in the channel');
            break;

        case 'users':
            var userNames = '';
            var delim = '';
            var hubBots = bot.hub.bots;
            for (var i in hubBots) {
                var hubChannel = hubBots[i].channelNameMap[channel.name];
                if (hubBots[i] != bot && isBotInChannel(hubBots[i], hubChannel)) {
                    userNames += delim + 'Team ' + hubBots[i].team.name + ': ';
                    userNames += makeUserNamesInChannel(hubBots[i], hubChannel);
                    delim = '\n';
                }
            }
            botMessage(bot, channel, userNames);
            break;

        default:
            var help = package.name + ' ' + package.version + ' Commands: `teams`, `users`';
            botMessage(bot, channel, help);
            break;
    }
}

function makeHubTeamNames(bot, channel) {
    var teamNames = '';
    var hubBots = bot.hub.bots;
    var delim = '';
    for (var i in hubBots) {
        if (hubBots[i] != bot && isBotInChannel(hubBots[i], channel)) {
            teamNames += delim + hubBots[i].team.name;
            delim = ', ';
        }
    }

    if (teamNames == '') {
        return 'No team';
    }
    else {
        return teamNames;
    }
}

function makeUserNamesInChannel(bot, channel) {
    var userNames = '';
    var delim = '';
    var users = channel.members;
    for (var i in users) {
        var user = bot.userIdMap[users[i]];
        if (!user.deleted) {
            var active = (bot.activeUsers.indexOf(user.id) > -1) ? '*' : '';
            userNames += delim + active + (user.real_name || user.name) + active;
            delim = ', ';
        }
    }

    if (userNames == '') {
        return 'No user';
    }
    else {
        return userNames;
    }
}

function isBotInChannel(bot, channel) {
    if (channel && channel.members) {
        if (channel.members.indexOf(bot.self.id) > -1) {
            return true;
        }
    }
    return false;
}

function isUserABot(user, bot) {
    return (user && user.id == bot.self.id);
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

function hubBotTyping(inBot, inChannel) {
    foreachHubBots(inBot, inChannel, function(outBot, outChannel) {
        outBot.send('typing', {
            channel: outChannel.id,
        })
    });

}

function fromTeamText(bot) {
    return ' (from ' + bot.team.name + ')';
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
                transited += '*' + (user.real_name || user.name) + fromTeamText(bot) + '*';
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

function hubBotMessage(inBot, inChannel, text) {
    text = transitLink(inBot, text);

    foreachHubBots(inBot, inChannel, function(outBot, outChannel) {
        outBot.send('message', {
            channel: outChannel.id,
            text: italicText(text)
        });
    });
}

function hubUserMessage(inBot, inChannel, user, text) {
    text = transitLink(inBot, text);

    foreachHubBots(inBot, inChannel, function(outBot, outChannel) {
        outBot.api('chat.postMessage', {
            channel: outChannel.id,
            text: text,
            username: (user.real_name || user.name) + fromTeamText(inBot),
            as_user: false,
            link_names: 1,
            unfurl_links: true,
            unfurl_media: true,
            icon_url: user.profile.image_48
        });
    });
}

function foreachHubBots(inBot, inChannel, func) {
    for (var i in inBot.hub.bots) {
        var outBot = inBot.hub.bots[i];
        if (!outBot.ws || outBot == inBot) {
            continue;
        }

        var outChannel = outBot.channelNameMap[inChannel.name];
        if (!isBotInChannel(outBot, outChannel)) {
            continue;
        }

        func(outBot, outChannel);
    }
}
