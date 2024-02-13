const EPOCH = 1420070400000;

class Snowflake {
    constructor(value) {
        this.value = _value(value);
    }

    static _value(v) {
        if (v instanceof Snowflake) return v.value;
        if (typeof v === 'bigint') return v;
        if (v instanceof Date) v = BigInt(value.getTime() - EPOCH) >> BigInt(22);
        if (!['bigint', 'string'].includes(typeof v)) v = v.toString();
        return BigInt(v);
    }

    get timestamp() {
        return new Date(BigInt(EPOCH) + (this.value >> BigInt(22n)));
    }

    toString() {
        return this.value.toString(10);
    }
}

function isSnowflake(v) {
    return v instanceof Date || ['bigint', 'number', 'string'].includes(typeof v);
}

module.exports = {Snowflake, isSnowflake};