const ActivityType = {
    GAME: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    CUSTOM: 4,
    COMPETING: 5,
};

class ActivityBuilder {
    constructor(options) {
        this.name = (options.name ?? '').toString();
        if (!options.hasOwnProperty('type'))
            throw new TypeError('no type option');
        this.type = options.type;
        this.url = options.hasOwnProperty('url') ? options.url?.toString() : undefined;
        this.state = options.hasOwnProperty('state') ? options.state?.toString() : undefined;
    }

    build() {
        let j = {name: this.name, type: this.type};
        if (this.url !== undefined)
            j.url = this.url?.toString();
        if (this.state !== undefined)
            j.state = this.state?.toString();
        return j;    
    }
}

const Status = {
    ONLINE: 'online',
    DND: 'dnd',
    DO_NOT_DISTURB: 'dnd',
    IDLE: 'idle',
    INVISIBLE: 'invisible',
    OFFLINE: 'offline',
};

class PresenceBuilder {
    constructor(options) {
        this.since = options.hasOwnProperty('since') ? options.since : null;
        this.activities = options.activities ?? [];
        this.status = options.status ?? Status.ONLINE;
        this.afk = options.afk ?? false;
    }

    build() {
        return {
            since: typeof this.since === 'number' ? this.since : null,
            activites: this.activities.map((a) => a.hasOwnProperty('build') && typeof a === 'function' ? a.build() : new ActivityBuilder(a).build()),
            status: this.status,
            afk: this.afk,
        }
    }
}

module.exports = {ActivityType, ActivityBuilder, Status, PresenceBuilder};