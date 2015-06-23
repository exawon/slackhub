var util = require('util');
var EventEmitter = require('events').EventEmitter;

var request = require('request');
var vow = require('vow');
var ws = require('ws');
var querystring = require('querystring');

function SlackBot(token) {
    this.token = token;
}

util.inherits(SlackBot, EventEmitter);

SlackBot.prototype.rtmStart = function() {
    this.api('rtm.start', {}).then(function(data) {
        this.url = data.url;
        this.self = data.self;
        this.team = data.team;
        this.activeUsers = [];
        this.userIdMap = {};
        this.userNameMap = {};
        this.channelIdMap = {};
        this.channelNameMap = {};

        arrayToMap(data.users, this.userIdMap, 'id');
        arrayToMap(data.users, this.userNameMap, 'name');
        arrayToMap(data.bots, this.userIdMap, 'id');
        arrayToMap(data.bots, this.userNameMap, 'name');
        arrayToMap(data.channels, this.channelIdMap, 'id');
        arrayToMap(data.channels, this.channelNameMap, 'name');
        arrayToMap(data.groups, this.channelIdMap, 'id');
        arrayToMap(data.groups, this.channelNameMap, 'name');

        try {
            this.emit('start');
            this.connect();
        }
        catch (e) {
            console.log(e);
        }
    }.bind(this));
};

SlackBot.prototype.connect = function() {
    this.ws = new ws(this.url);

    this.ws.on('message', function(data) {
        try {
            data = JSON.parse(data);
            console.log('<<<', 'event.' + data.type, data);
            this.updateData(data);
            this.emit('event', data);
        } catch (e) {
            console.log('!!!', e);
        }
    }.bind(this));
};

SlackBot.prototype.updateData = function(data) {
    var channel = this.getChannel(data);

    switch (data.type) {
        case 'channel_left':
            channel.is_member = false;
            break;

        case 'group_left':
            this.channelIdMap[channel.id] = null;
            this.channelNameMap[channel.name] = null;
            break;

        case 'channel_rename':
        case 'group_rename':
            this.channelNameMap[channel.name] = null;
            this.channelNameMap[data.channel.name] = channel;
            break;

        case 'channel_archived':
        case 'group_archived':
            this.channel.is_archived = true;
            break;

        case 'channel_unarchived':
        case 'group_unarchived':
            this.channel.is_archived = false;
            break;

        case 'channel_deleted':
        case 'group_close':
            this.channelIdMap[channel.id] = null;
            this.channelNameMap[channel.name] = null;
            break;

        case 'channel_left':
        case 'group_left':
            if (channel.is_channel) {
                channel.is_member = false;
            }
            var i = channel.members.indexOf(bot.self.id);
            if (i > -1) {
                channel.members.slice(i, 1);
            }
            break;

        case 'presence_change':
            var i = this.activeUsers.indexOf(data.user);
            if (data.presence == 'active') {
                if (i == -1) {
                    this.activeUsers.push(data.user);
                }
            }
            else {
                if (i > -1) {
                    this.activeUsers.slice(i, 1);
                }
            }
            break;
    }

    if (typeof data.user == 'object') {
        mapToMap(data.user, this.userIdMap[data.user.id]);
    }
    if (typeof data.bot == 'object') {
        mapToMap(data.bot, this.userIdMap[data.bot.id]);
    }
    if (typeof data.channel == 'object') {
        mapToMap(data.channel, this.channelIdMap[data.channel.id]);
    }
}

SlackBot.prototype.getChannel = function(data) {
    if (typeof data.channel == 'object') {
        return this.channelIdMap[data.channel.id];
    }
    else if (typeof data.channel != 'undefined') {
        return this.channelIdMap[data.channel];
    }
}

SlackBot.prototype.getUser = function(data) {
    if (typeof data.user == 'object') {
        return this.userIdMap[data.user.id];
    }
    else if (typeof data.channel != 'undefined') {
        return this.userIdMap[data.user];
    }
}

SlackBot.prototype.send = function(type, payload) {
    payload.id = new Date().getTime();
    payload.type = type;
    console.log('>>>', type, payload);
    this.ws.send(JSON.stringify(payload));
}

SlackBot.prototype.api = function(methodName, payload) {
    console.log('>>>', methodName, payload);

    payload.token = this.token;

    return new vow.Promise(function(resolve, reject) {
        var url = 'https://slack.com/api/' + methodName + '?' + querystring.stringify(payload);
        request.get(url, function(err, request, body) {
            if (err) {
                reject(err);
                return;
            }

            body = JSON.parse(body);
            //console.log('<<<', methodName, body);

            if (body.ok) {
                resolve(body);
            }
            else {
                reject(body);
                console.log(body);
            }
        });
    });
};

function find(array, params) {
    for (var i in array) {
        var item = array[i];
        if (Object.keys(params).every(function(key) { return item[key] === params[key];})) {
            return item;
        }
    }
}

function arrayToMap(array, map, keyname) {
    for (var i in array) {
        var item = array[i];
        map[item[keyname]] = item;
    }
}

function mapToMap(source, target) {
    for (var key in source) {
        target[key] = source[key];
    }
}

module.exports = SlackBot;
