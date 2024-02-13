const { EventEmitter } = require('events');
const { TimeoutError } = require('./errors');

class EventEmitterExt extends EventEmitter {
    constructor(options) {
        super(options);
        this.subscriptions = new Map();
        this.id = 0;
    }

    _generateId() {
        return this.id++;
    }
    
    waitFor(event, {timeout, check}) {
        const id = this._generateId();
        return new Promise((resolve, reject) => {
            if (!this.subscriptions.has(event)) this.promises.set(event, new Map());
            if (timeout) setTimeout(() => {
                const subscriptions = this.subscriptions.get(event);
                if (subscriptions.delete(id)) {
                    reject(new TimeoutError());
                }
            }, timeout);
            this.subscriptions.get(event).set(id, {check, resolve});
        });
    }

    async emit(event, ...args) {
        if (!this.subscriptions.has(event)) this.subscriptions.set(event, new Map());
        const subscriptions = this.subscriptions.get(event);
        for (const [id, subscription] of subscriptions) {
            if (subscription.check === undefined || await subscription.check(...args)) {
                subscription.resolve([...args]);
                subscriptions.delete(id);
                return;
            }
        }
        super.emit(event, ...args);
    }
}

module.exports = {EventEmitterExt};