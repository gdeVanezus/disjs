const { platform } = require('process');
const { EventEmitterExt } = require('./utils');
const { PresenceBuilder } = require('./presence');
const { WebSocket } = require('ws');
const { Logger } = require('./logger');
const { Snowflake, isSnowflake } = require('./snowflake');

const GatewayIntents = {
    GUILDS: 1 << 0,
    GUILD_MEMBERS: 1 << 1,
    GUILD_MODERATION: 1 << 2,
    GUILD_EMOJIS_AND_STICKERS: 1 << 3,
    GUILD_INTEGRATIONS: 1 << 4,
    GUILD_WEBHOOKS: 1 << 5,
    GUILD_INVITES: 1 << 6,
    GUILD_VOICE_STATES: 1 << 7,
    GUILD_PRESENCES: 1 << 8,
    GUILD_MESSAGES: 1 << 9,
    GUILD_MESSAGE_REACTIONS: 1 << 10,
    GUILD_MESSAGE_TYPING: 1 << 11,
    DIRECT_MESSAGES: 1 << 12,
    DIRECT_MESSAGE_REACTIONS: 1 << 13,
    DIRECT_MESSAGE_TYPING: 1 << 14,
    MESSAGE_CONTENT: 1 << 15,
    GUILD_SCHEDULED_EVENTS: 1 << 16,
    AUTO_MODERATION_CONFIGURATION: 1 << 20,
    AUTO_MODERATION_EXECUTION: 1 << 21,
};

const gatewayCloseCodes = {
    4000: ['Unknown error',         "We're not sure what went wrong. Try reconnecting?", true],
    4001: ['Unknown opcode',        "You sent an invalid Gateway opcode or an invalid payload for an opcode. Don't do that!", true],
    4002: ['Decode error',          "You sent an invalid payload to Discord. Don't do that!", true],
    4003: ['Not authenticated',     'You sent us a payload prior to identifying.', true],
    4004: ['Authentication failed', 'The account token sent with your identify payload is incorrect.', false],
    4005: ['Already authenticated', "You sent more than one identify payload. Don't do that!", true],
    4007: ['Invalid `seq`',         'The sequence sent when resuming the session was invalid. Reconnect and start a new session.', true],
    4008: ['Rate limited',          "Woah nelly! You're sending payloads to us too quickly. Slow it down! You will be disconnected on receiving this.", true],
    4009: ['Session timed out',     'Your session timed out. Reconnect and start a new one.', true],
    4010: ['Invalid shard',         'You sent us an invalid shard when identifying.', false],
    4011: ['Sharding required',     'The session would have handled too many guilds - you are required to shard your connection in order to connect.', false],
    4012: ['Invalid API version',   'You sent an invalid version for the gateway.', false],
    4013: ['Invalid intent(s)',     'You sent an invalid intent for a Gateway Intent. You may have incorrectly calculated the bitwise value.', false],
    4014: ['Disallowed intent(s)',  'You sent a disallowed intent for a Gateway Intent. You may have tried to specify an intent that you have not enabled or are not approved for.', false],
};

class Gateway extends EventEmitterExt {
    constructor(options) {
        if (!(options.hasOwnProperty('token') ? options.token : null))
            throw new TypeError('Token is required.');
        super();
        this.logger = options.logger instanceof Logger ? options.logger : null;
        this.token = options.token;
        const properties = options.properties ?? {};
        this.properties = {os: properties.os ?? platform, browser: properties.browser ?? 'disjs', device: properties.device ?? 'disjs'};
        this.largeThreshold = options.largeThreshold ?? null;
        this.shardId = options.hasOwnProperty('shardId') ? options.shardId : 0;
        this.shardCount = options.hasOwnProperty('shardCount') && ![null, undefined, 0].includes(options.shardCount) ? options.shardCount : 0;
        this.presence = options.presence ?? null;
        let intents = options.intents ?? 0;
        if (typeof intents === 'bigint') intents = Number(intents);
        else if (intents instanceof Array) intents = intents.reduce((x, y) => x | y, 0);
        this.intents = intents;
        this.socket = null;
        this.sequence = null;
        this.sessionId = null;
        this.heartbeatLastReq = null;
        this.heartbeatLastRes = null;
        this.interval = null;
        this.resumeGatewayUrl = null;
    }

    get latency() {
        if (this.heartbeatLastReq === null || this.heartbeatLastRes === null)
            return null;
        return this.heartbeatLastRes - this.heartbeatLastReq;
    }

    send(op, d) {
        if (this.socket === null)
            throw new TypeError('write to null socket');
        const j = JSON.stringify({op, d});
        this.logger?.trace(`sending message:\n  ${j}`);
        this.socket.send(j);
            
    }

    identify() {
        let d = {token: this.token, properties: this.properties, intents: this.intents};
        if (this.largeThreshold !== null)
            d.large_threshold = this.largeThreshold;
        if (![-1, 0].includes(this.shardCount))
            d.shard = [this.shardId, this.shardCount];
        if (this.presence !== null)
            d.presence = this.presence.build();
        this.logger?.info('sending IDENTIFY');
        this.send(2, d);
    }

    resume() {
        if (this.sessionId === null)
            throw new TypeError('resuming on unconnected gateway');
        this.logger?.info('sending RESUME');
        this.send(6, {token: this.token, session_id: this.sessionId, seq: this.sequence});
        this.logger?.info('sent RESUME');
    }

    heartbeat() {
        this.heartbeatLastReq = Date.now();
        this.logger?.trace(`sending HEARTBEAT with seq ${this.sequence}`);
        this.send(1, this.sequence);
        this.logger?.trace('sent HEARTBEAT');
    }

    requestGuildMembers(guildId, options) {
        if (!guildId)
            throw new TypeError('null guild id');
        let d = {
            guild_id: guildId.toString(),
        };
        if (typeof options.query === 'string')
            d.query = options.query.toString();
        if (options.hasOwnProperty('limit'))
            if (typeof options.limit === 'number')
                d.limit = options.limit;
            else
                throw new TypeError('mismatched number and ${typeof options.limit} types');
        if (options.hasOwnProperty('presences'))
            d.presences = !!options.presences;
        if (options.hasOwnProperty('userIds')) {
            if (isSnowflake(typeof options.userIds))
                d.user_ids = new Snowflake(options.userIds).toString();
            else if (options.userIds instanceof Array)
                d.user_ids = options.userIds.map(e => new Snowflake(e).toString());
            else
                throw TypeError('cannot have both userIds and userId');
        } else if ((options.userId ?? null) === null) {
            d.user_ids = new Snowflake(options.userId).toString();
        }
        if (options.hasOwnProperty('nonce')) {
            d.nonce = options.nonce.toString();
        }
        this.logger?.debug('sending REQUEST_GUILD_MEMBERS');
        this.send(8, d);
    }

    updateVoiceState(guildId, channelId, options = {}) {
        let d = {
            guild_id: guildId.toString(),
            channel_id: channelId === undefined || typeof channelId === 'null' ? null : channelId.toString(),
            self_mute: options.hasOwnProperty('selfMute') ? !!options.selfMute : false,
            self_deaf: options.hasOwnProperty('selfDeaf') ? !!options.selfDeaf : false,
        };
        this.logger?.debug('sending UPDATE_VOICE_STATE');
        this.send(4, d);
    }

    updatePresence(options) {
        this.logger?.debug('sending UPDATE_PRESENCE');
        this.send(3, options instanceof PresenceBuilder ? options.build() : new PresenceBuilder(options).build());
    }

    listen(event, f) {
        this.on('dispatch', (t, ...args) => {
            if (t !== event) return;
            return f(...args);
        });
    }

    async waitForDispatch(event, {timeout, check}) {
        const [, d] = await this.waitFor('dispatch', {timeout, check: async (t, ...a) => t == event && check === undefined || await check(...a)});
        return d;
    }

    _initSocket({resolve, reject}, socket) {
        socket.on('error', async (error) => await this.emit('error', error));
        socket.on('open', async () => await this.emit('open'));
        socket.on('close', async (closeCode, closeMessage) => {
            this.logger?.error(`websocket closed with ${closeCode} ${closeMessage}`);
            if (this.interval !== null)
                clearInterval(this.interval);
            if ([4007, 4009].includes(closeCode)) {
                this.resumeGatewayUrl = null;
                this.sequence = null;
                this.sessionId = null;
            }
            if (closeCode < 1000 || closeCode > 1010) {
                const error = closeCode in gatewayCloseCodes ? gatewayCloseCodes[closeCode] : [`Unknown close code`, `${closeCode} ${closeMessage}`, true];
                if (!error[2]) {
                    const o = new GatewayError(`${error[0]}: ${error[1]} (${closeMessage})`);
                    if (typeof reject === 'function')
                        reject(o);
                    else
                        throw o;
                    return;
                }
            }
            const url = (
                this.resumeGatewayUrl !== null ? this.resumeGatewayUrl : 'wss://gateway.discord.gg'
            ) + '/?v=10&encoding=json';
            this.logger?.trace(`connecting to websocket: ${url}`);
            const newSocket = new WebSocket(url);
            this._initSocket({resolve: null, reject: null}, newSocket);
            this.socket = newSocket;
        });
        socket.on('message', async (message) => {
            this.emit('message', message);
            const msg = message.toString();
            const j = JSON.parse(msg);
            if (j.hasOwnProperty('s') && typeof j.s === 'number')
                this.sequence = j.s;
            switch (j.op) {
            case 0: { // DISPATCH
                try {
                    this.logger?.trace(`dispatching ${j.t} with seq ${this.sequence}:\n  ${JSON.stringify(j.d)}`);
                } catch {}
                if (j.t === 'READY') {
                    this.resumeGatewayUrl = j.d.resume_gateway_url;
                    this.sessionId = j.d.session_id;
                    this.logger?.debug(`received READY, session ${this.sessionId}, url for resuming: ${this.resumeGatewayUrl}`);
                    if (typeof resolve === 'function') {
                        resolve(j.d);
                    }
                }
                this.emit('dispatch', j.t, j.d);
                break;
            }
            case 7: { // RECONNECT
                this.logger?.debug('Reconnecting requested; closing websocket');
                socket.close(1006);
                break;
            }
            case 9: { // INVALID_SESSION
                if (j.d) {
                    this.logger?.debug('session was invalidated; can resume session, closing websocket with 1006');
                    socket.close(1006);
                } else {
                    this.logger?.debug('session was invalidated; unable to resume session, closing websocket with 1000 and starting new one');
                    this.resumeGatewayUrl = null;
                    this.sequence = null;
                    this.sessionId = null;
                    socket.close(1000);
                }
                break;
            }
            case 10: {
                const interval = j.d.heartbeat_interval;
                this.logger?.debug(`received HELLO with interval ${interval}`);
                setTimeout(() => {
                    this.logger?.debug('starting heartbeat loop');
                    this.heartbeat();
                    this.interval = setInterval(() => {
                        if (this.heartbeatLastReq > this.heartbeatLastRes) {
                            this.logger?.info('zombied/failed connection; reconnecting');
                            clearInterval(this.interval);
                            socket.close(1000);
                            return;
                        }
                        this.heartbeat();
                    }, interval);
                }, interval * Math.random());
                if (this.sessionId !== null)
                    this.resume();
                else
                    this.identify();
                break;
            }
            case 11: {
                this.logger?.debug('received HEARTBEAT_ACK');
                this.heartbeatLastRes = Date.now();
                break;
            }
            }
        });
    }

    connect() {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
            this._initSocket({resolve, reject}, socket);
            this.socket = socket;
        });
    }
}

module.exports = {GatewayIntents, Gateway};