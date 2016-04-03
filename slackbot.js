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

SlackBot.prototype.tag = function () {
    var teamName = (this.team ? this.team.name : undefined);
    var selfName = (this.self ? this.self.name : undefined);
    return '\n' + teamName + '/' + selfName;
}

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

        buildMapFromArray(this.userIdMap, 'id', data.users);
        buildMapFromArray(this.userNameMap, 'name', data.users);
        buildMapFromArray(this.userIdMap, 'id', data.bots);
        buildMapFromArray(this.userNameMap, 'name', data.bots);
        buildMapFromArray(this.channelIdMap, 'id', data.channels);
        buildMapFromArray(this.channelNameMap, 'name', data.channels);
        buildMapFromArray(this.channelIdMap, 'id', data.groups);
        buildMapFromArray(this.channelNameMap, 'name', data.groups);

        try {
            this.emit('start');
            this.connect();
        }
        catch (e) {
            console.log(this.tag(), '!!!', e);
        }
    }.bind(this));
};

SlackBot.prototype.connect = function() {
    this.ws = new ws(this.url);

    this.ws.on('message', function(data) {
        try {
            data = JSON.parse(data);
            this.updateData(data);
            if (data.reply_to) {
                console.log(this.tag(), '<<<', 'reply', data);
                this.emit('reply', data);
            }
            else {
                console.log(this.tag(), '<<<', data.type, data);
                this.emit('event', data);
            }
        } catch (e) {
            console.log(this.tag(), '!!!', e);
        }
    }.bind(this));
};

SlackBot.prototype.updateData = function(data) {
    var channel = this.getChannel(data);
    switch (data.type) {
        case 'team_rename':
            this.team.name = data.name;
            break;

        case 'team_domain_change':
            this.team.domain = data.domain;
            break;

        case 'email_domain_change':
            this.team.email_domain = data.email_domain;
            break;

        case 'team_pref_change':
            this.team.pref[data.name] = data.value;
            break;

        case 'team_plan_change':
            this.team.plan = data.plan;
            break;

        case 'channel_left':
            var channel = this.channelIdMap[data.channel];
            channel.is_member = false;
            var i = channel.members.indexOf(this.self.id);
            channel.members.slice(i, 1);
            break;

        case 'group_left':
            var channel = this.channelIdMap[data.channel];
            this.channelIdMap[channel.id] = null;
            this.channelNameMap[channel.name] = null;
            break;

        case 'channel_rename':
        case 'group_rename':
            var channel = this.channelIdMap[data.channel.id];
            this.channelNameMap[channel.name] = null;
            this.channelNameMap[data.channel.name] = channel;
            break;

        case 'channel_archived':
        case 'group_archived':
            var channel = this.channelIdMap[data.channel];
            this.channel.is_archived = true;
            break;

        case 'channel_unarchived':
        case 'group_unarchived':
            var channel = this.channelIdMap[data.channel];
            this.channel.is_archived = false;
            break;

        case 'channel_deleted':
        case 'group_close':
            var channel = this.channelIdMap[data.channel];
            this.channelIdMap[channel.id] = null;
            this.channelNameMap[channel.name] = null;
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

        case 'message':
            switch (data.subtype) {
                case 'channel_join':
                case 'group_join':
                    var channel = this.channelIdMap[data.channel];
                    channel.members.push(data.user);
                    break;

                case 'channel_leave':
                case 'group_leave':
                    var channel = this.channelIdMap[data.channel];
                    var i = channel.members.indexOf(data.user);
                    channel.members.slice(i, 1);
                    break;
            }
    }

    if (typeof data.user == 'object') {
        if (!updateMapFromData(this.userIdMap, 'id', data.user)) {
            this.userIdMap[data.user.id] = data.user;
            this.userNameMap[data.user.name] = data.user;
        }
    }
    if (typeof data.bot == 'object') {
        if (!updateMapFromData(this.userIdMap, 'id', data.bot)) {
            this.userIdMap[data.bot.id] = data.bot;
            this.userNameMap[data.bot.name] = data.bot;
        }
    }
    if (typeof data.channel == 'object') {
        if (!updateMapFromData(this.channelIdMap, 'id', data.channel)) {
            this.channelIdMap[data.channel.id] = data.channel;
            this.channelNameMap[data.channel.name] = data.channel;
        }
    }
    if (typeof data.group == 'object') {
        if (!updateMapFromData(this.channelIdMap, 'id', data.channel)) {
            this.channelIdMap[data.group.id] = data.group;
            this.channelNameMap[data.group.name] = data.group;
        }
    }
}

SlackBot.prototype.getChannel = function(data) {
    if (typeof data.channel == 'object') {
        return this.channelIdMap[data.channel.id];
    }
    else if (data.channel) {
        return this.channelIdMap[data.channel];
    }
    else if (typeof data.group == 'object') {
        return this.channelIdMap[data.group.id];
    }
    else if (data.group) {
        return this.channelIdMap[data.group];
    }
}

SlackBot.prototype.getUser = function(data) {
    if (typeof data.user == 'object') {
        return this.userIdMap[data.user.id];
    }
    else if (data.user) {
        return this.userIdMap[data.user];
    }
    else if (typeof data.bot == 'object') {
        return this.userIdMap[data.bot.id];
    }
    else if (data.bot) {
        return this.userIdMap[data.bot];
    }
}

SlackBot.prototype.isMemberOf = function(channel) {
    if (channel) {
        if (channel.members.indexOf(this.self.id) > -1) {
            return true;
        }
    }
    return false;
}

SlackBot.prototype.isUser = function(user) {
    return (user && user.id == this.self.id);
}

SlackBot.prototype.send = function(type, payload) {
    payload.id = new Date().getTime();
    payload.type = type;
    console.log(this.tag(), '>>>', type, payload);
    this.ws.send(JSON.stringify(payload));
}

SlackBot.prototype.api = function(method, payload) {
    console.log(this.tag(), '>>>', method, payload);

    payload.token = this.token;

    return new vow.Promise(function(resolve, reject) {
        var url = 'https://slack.com/api/' + method + '?' + querystring.stringify(payload);
        request.get(url, function(err, request, body) {
            if (err) {
                reject(err);
                return;
            }

            var data = JSON.parse(body);
            console.log(this.tag(), '<<<', method, data);

            if (data.ok) {
                this.updateData(data);
                resolve(data);
            }
            else {
                reject(data);
            }
        }.bind(this));
    }.bind(this));
};

function find(array, params) {
    for (var i in array) {
        var item = array[i];
        if (Object.keys(params).every(function(key) { return item[key] === params[key];})) {
            return item;
        }
    }
}

function buildMapFromArray(map, keyname, array) {
    for (var i in array) {
        var item = array[i];
        map[item[keyname]] = item;
    }
}

function updateMapFromData(map, keyname, data) {
    var mapData = map[data[keyname]];
    return mergeData(mapData, data);
}

function mergeData(to, from) {
    if (!to || !from) {
        return false;
    }

    for (var i in from) {
        to[i] = from[i];
    }
    return true;
}

module.exports = SlackBot;
