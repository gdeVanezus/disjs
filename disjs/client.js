const { Endpoints } = require("./endpoints");
const { OpenEvent, ErrorEvent, DispatchEvent, SocketMessageEvent } = require("./events");
const { Gateway } = require("./gateway");
const { LoggerFactory } = require("./logger");
const { REST } = require("./rest");
const { Snowflake } = require("./snowflake");
const { EventEmitterExt } = require("./utils");

class Client extends EventEmitterExt {
    constructor(options) {
        if (typeof options === 'string') {
            options = {token: options};
        }
        super();
        this.ignoreSessionsLimit = !!(options.ignoreSessionsLimit ?? false);
        this.loggerFactory = options.loggerFactory instanceof LoggerFactory ? options.loggerFactory : null;
        this.logger = this.loggerFactory?.get('disjs.client');
        this.token = options.token;
        this.intents = options.intents ?? 0;
        const rest = new REST({
            token: options.token,
            logger: this.loggerFactory?.get('disjs.rest'),
            ...(options.rest ?? {})
        });
        this.rest = rest;
        let shardIds = options.shards ?? [];
        let shardCount = options.shardCount ?? options.shards ? options.shards.length : 0;
        if (options.shard !== undefined) {
            if (options.shard && !options.hasOwnProperty('shards') && !options.hasOwnProperty('shardCount')) {
                [shardIds, shardCount] = [[], -1];
            } else {
                [shardIds, shardCount] = [[], 0];
            }
        }
        if ([null, undefined].includes(options.shards)) {
            for (let i = 0; i < options.shardCount; ++i)
                shardIds.push(i);
        }
        this.presence = options.presence ?? null;

        this.shards = [];
        this.shardIds = shardIds;
        this.shardCount = shardCount;
    }

    listen(event, f) {
        this.on('dispatch', (received) => {
            if (received.name !== event) return;
            return f(received);
        });
    }

    async run(options = {}) {
        const gatewayInformation = await this.rest.request(Endpoints.GET_GATEWAY_BOT()).then((response) => response.json());
        const now = Date.now();
        let shardIds = [];
        let shardCount = this.shardCount;
        switch (this.shardCount) {
        case -1: { // autoshard
            for (let i = 0; i < gatewayInformation.shards; ++i)
                shardIds.push(i);
            shardCount = gatewayInformation.shards;
            break;
        }
        case 0: { // disabled
            shardIds = [0];
            break;
        }
        default: { // manual sharding
            shardIds = this.shardIds;
        }
        }
        const {total, max_concurrency: maxConcurrency, reset_after: resetAfter} = gatewayInformation.session_start_limit;
        if (shardIds.length > total) {
            if (!this.ignoreSessionsLimit) {
                this.logger?.fatal(
                    `Cannot run bot; not enough sessions: ${shardIds.length}, but have ${total} available. Limit resets on: ${new Date(now + resetAfter)}.\n` +
                    "If you still want run bot, set 'ignoreSessionsLimit' to true in options."
                );
                return;
            } else {
                this.logger?.warn(
                    `Not enough sessions: wanted ${shardIds.length}, but have ${total} available. Limit resets on: ${new Date(now + resetAfter)}.\n` +
                    "You may encounter WebSocket errors."
                );
            }
        }
        const shards = [];
        for (const shardId of shardIds) {
            const gateway = new Gateway({
                token: this.token,
                intents: this.intents,
                presence: this.presence,
                shardId,
                shardCount,
                logger: this.loggerFactory?.get(`disjs.gateway[${shardId}]`),
            });
            gateway.on('open', () => this.emit('open', new OpenEvent(this, gateway)));
            gateway.on('error', (error) => this.emit('error', new ErrorEvent(this, gateway, error)));
            gateway.on('dispatch', (t, d) => this.emit('dispatch', new DispatchEvent(this, gateway, t, d)));
            gateway.on('message', (message) => this.emit('socketMessage', new SocketMessageEvent(this, gateway, message)));
            if (typeof options.prepare === 'function') await options.prepare(gateway);
            shards.push(gateway);
        }
        this.shards = shards;
        if (typeof options.prepareAllShards === 'function') {
            await options.prepareAllShards(shards);
        }
        this.logger?.info(`starting ${this.shards.length} shards... (${total} sessions remaining) (${maxConcurrency} shards/s)`);
        for (let i = 0; i < this.shards.length; i += maxConcurrency) {
            if (i !== 0) await new Promise((resolve) => setTimeout(() => resolve(), 5000));
            const group = this.shards.slice(i, i+maxConcurrency);
            this.logger?.info(`connecting ${group.length} shards (group #${i})`);
            await Promise.all(group.map(async (shard) => {
                this.logger?.info(`connecting shard ${shard.shardId} (group #${i})`);
                await shard.connect();
            }));
        }
    }

    get latency() {
        if (this.shards.length === 0)
            return null;
        const latencies = this.shards.map(shard => shard.latency);
        return latencies.reduce((x, y) => x + y, 0.0) / latencies.length;
    }

    forEachShard(f) {
        const result = [];
        for (const shard of this.shards) {
            result.push(f(shard));
        }
        return result;
    }

    asyncForEachShard(f) {
        return Promise.all(this.forEachShard(f));
    }
    
    _shardFor(guildId) {
        return (guildId.value >> 22n) % this.shards.length;
    }
    
    updateVoiceState(guildId, channelId, options = {}) {
        const gid = new Snowflake(guildId);
        return this.shards[this._shardFor(gid)].updateVoiceState(gid.toString(), new Snowflake(channelId).toString(), options);
    }

    updatePresence(options) {
        return this.asyncForEachShard(gateway => gateway.updatePresence(options));
    }
}

module.exports = {Client};
