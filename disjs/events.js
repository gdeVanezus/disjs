class DisjsEvent {}

class ShardEvent extends DisjsEvent {
    constructor(client, shard) {
        super();
        this.client = client;
        this.shard = shard;
    }

    get rest() {
        return this.client.rest;
    }
}

class OpenEvent extends ShardEvent {}

class ErrorEvent extends ShardEvent {
    constructor(client, shard, error) {
        super(client, shard);
        this.error = error;
    }
}

class DispatchEvent extends ShardEvent {
    constructor(client, shard, name, data) {
        super(client, shard);
        this.name = name;
        this.data = data;
    }
}

class SocketMessageEvent extends ShardEvent {
    constructor(client, shard, message) {
        super(client, shard);
        this.message = message;
    }
}

module.exports = {DisjsEvent, ShardEvent, OpenEvent, ErrorEvent, DispatchEvent, SocketMessageEvent};