class TimeoutError extends Error {
    constructor(message) {
        super(message);
    }
}

class GatewayError extends Error {
    constructor(message) {
        super(message);
    }
}

module.exports = {TimeoutError, GatewayError};