const LoggerLevel = {
    DISABLED: 0,
    FATAL: 10,
    ERROR: 20,
    WARN: 30,
    INFO: 40,
    DEBUG: 50,
    TRACE: 60,
};

class LoggerFilter {
    filter(msg) {
        return msg;
    }
}

class Logger {
    constructor(name, options) {
        this.name = name;
        this.level = options.level ?? LoggerLevel.INFO;
        this.filter = typeof options.filter === 'function' || options.filter instanceof LoggerFilter ? options.filter : null;
    }
    
    log(level, message) {
        if (typeof level === 'string') {
            level = LoggerLevel[level.toUpperCase()];
        }
        if (level > this.level || this.level === LoggerLevel.DISABLED) {
            return;
        }
        const now = new Date();
        let m = message;
        if (this.filter !== null) {
            m = this.filter instanceof LoggerFilter ? this.filter.filter(message) : this.filter(message);
            if ([null, undefined].includes(m)) return;
            m = m.toString();
        }
        let r = ({
            [LoggerLevel.FATAL]: 'F',
            [LoggerLevel.ERROR]: 'E',
            [LoggerLevel.WARN]:  'W',
            [LoggerLevel.INFO]:  'I',
            [LoggerLevel.DEBUG]: 'D',
            [LoggerLevel.TRACE]: 'T',
        })[level] + ` ${now.getUTCFullYear()}-${now.getUTCMonth().toString().padStart(2, '0')}-${now.getUTCDate().toString().padStart(2, '0')} ` + (
            `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')},${now.getUTCMilliseconds().toString().padStart(3, '0')}`
        ) + ` ${this.name}: ${m}`;
        console.log(r);
    }

    fatal(message) {
        return this.log(LoggerLevel.FATAL, message);
    }

    error(message) {
        return this.log(LoggerLevel.ERROR, message);
    }

    warn(message) {
        return this.log(LoggerLevel.WARN, message);
    }

    info(message) {
        return this.log(LoggerLevel.INFO, message);
    }

    debug(message) {
        return this.log(LoggerLevel.DEBUG, message);
    }

    trace(message) {
        return this.log(LoggerLevel.TRACE, message);
    }
}

const TOKEN_REGEX = /([A-Za-z0-9_-]{23,28})\.([A-Za-z0-9_-]{6,7})\.([A-Za-z0-9_-]{27,})/g;

class DiscordTokenCensor extends LoggerFilter {
    filter(message) {
        return message.replaceAll(TOKEN_REGEX, '<CENSORED>');
    }
}

class LoggerFactory {
    constructor(options = {}) {
        this.loggers = new Map();
        this.level = options.level ?? LoggerLevel.INFO;
        this.filter = options.hasOwnProperty('filter')
            ? typeof options.filter === 'function' || options.filter instanceof LoggerFilter
                ? options.filter
                : null
            : new DiscordTokenCensor();
    }
    get(name, level = null) {
        if (level === null) {
            level = this.level;
        }
        if (this.loggers.has(name)) {
            return this.loggers.get(name);
        }
        if (typeof level === 'function') {
            const level2 = level(name);
            level = typeof level2 === 'number' ? level2 : LoggerLevel.INFO;
        }
        const logger = new Logger(name, {level, filter: this.filter});
        this.loggers.set(name, logger);
        return logger;
    }
}

module.exports = {Logger, LoggerLevel, LoggerFilter, TOKEN_REGEX, DiscordTokenCensor, LoggerFactory};