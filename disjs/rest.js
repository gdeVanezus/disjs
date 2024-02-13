const { versions } = require('process');
const { Logger } = require('./logger');

function _flattenErrorDict(d, k2 = '') {
    const items = [];
    console.log(d);
    for (const [k1, v] of Object.entries(d)) {
        const newKey = k2.length === 0 ? k1 : `${k2}.${k1}`;
        if (v instanceof Object) {
            const errors = v._errors;
            if (errors instanceof Object) {
                items.push([newKey, errors.map(x => typeof x.message === 'string' ? x.message : '').join(' ')]);
            } else {
                items.concat(...Object.entries(_flattenErrorDict(v, newKey)));
            }
        } else {
            items.push([newKey, v]);
        }
    }
    return Object.fromEntries(items);
}

class RESTError extends Error {
    constructor(response, j) {
        const status = response.status;
        console.log(JSON.stringify(j));
        let code = 0;
        let text = '';
        if (j instanceof Object) {
            code = typeof j.code === 'number' ? j.code : 0;
            const base = typeof j.message === 'string' ? j.message : '';
            let errors = j.errors;
            if (typeof errors === 'object') {
                errors = _flattenErrorDict(errors);
                const helpful = Object.entries(errors).map(p => `In ${p[0]}: ${p[1]}`).join('\n');
                text = base + '\n' + helpful;
            } else {
                text = base;
            }
        } else {
            text = typeof j === 'string' ? j : '';
        }
        let fmt = `${status} ${response.statusText} (error code: ${code})`;
        if (text !== '') {
            fmt += `: ${text}`;
        }
        super(fmt);
        this.response = response;
        this.status = response.status;
        this.code = code;
        this.text = text;
    }
}
class Unauthorized extends RESTError {}
class Forbidden extends RESTError {}
class NotFound extends RESTError {}
class Ratelimited extends RESTError {
    constructor(response, j) {
        super(response, j);
        this.retryAfter = j instanceof Object ? j.retry_after : NaN;
    }
}
class DiscordError extends RESTError {}
class InternalServerError extends DiscordError {}
class BadGateway extends DiscordError {}

function trimStart(s, c) {
    const k = Array.from(c).map(d => d[0]);
    while (k.some(c => s.startsWith(c))) {
        s = s.slice(1);
    }
    return s;
}

class REST {
    constructor(options = {}) {
        if (typeof options === 'string') {
            options = {token: options}
        }
        this.token = options.token;
        this.logger = options.logger instanceof Logger ? options.logger : null;
    }

    async request(endpoint, options = {}) {
        let version = [`node/${versions.node}`];
        if (versions.hasOwnProperty('uv')) {
            version.push(`uv/${versions.uv}`);
        }
        if (versions.hasOwnProperty('v8')) {
            version.push(`v8/${versions.v8}`);
        }
        let headers = {'User-Agent': `DiscordBot (https://github.com/DarpHome/disjs, 1.0.0) ${version.join(' ')}`};
        if (this.token !== null && (options.authenticate ?? true))
            headers['Authorization'] = this.token;
        let body = undefined;
        if (options.hasOwnProperty('body') && options.hasOwnProperty('json')) {
            throw new TypeError('cannot have both body and json');
        } else if (options.hasOwnProperty('body')) {
            body = options.body;
        } else if (options.hasOwnProperty('json')) {
            body = JSON.stringify(options.json);
            headers['Content-Type'] = 'application/json';
        }
        headers = {...headers, ...options.headers ?? {}};
        const url = 'https://discord.com/api/v10/' + trimStart(endpoint.path, '/') + (options.hasOwnProperty('queryParameters') ? ((params) => {
            if (!(params instanceof URLSearchParams)) {
                params = new URLSearchParams(params);
            }
            const r = params.toString();
            if (r.length === 0)
                return '';
            return '?' + r;
        })(options.queryParameters ?? {}) : '');
        if (this.logger != null) {
            const index = url.indexOf('?');
            let t = index === -1
                ? `sending request to ${endpoint.method} ${url}; without query params`
                : `sending request to ${endpoint.method} ${url.slice(0, index)}; with query params: ${url.slice(index)}`;
            this.logger.trace(`${t}\n - Headers:\n${
                Object.entries(headers)
                .filter(([k, _]) => k.toLowerCase() !== 'authorization')
                .map(([k, v]) => ` -- ${k}: ${v}`)
                .join('\n')
            }`);
        }
        const response = await fetch(url, {
            method: endpoint.method,
            headers,
            ...(body !== undefined ? {body} : {})
        });
        this.logger?.trace(`received response with status ${response.status}`);
        if (response.status >= 500) {
            switch (response.status) {
            case 500:
                throw new InternalServerError(response, await response.json());
            case 502:
                throw new BadGateway(response, await response.json());
            default:
                throw new DiscordError(response, await response.json());
            }
        }
        if (response.status >= 400) {
            switch (response.status) {
            case 401:
                throw new Unauthorized(response, await response.json());
            case 403:
                throw new Forbidden(response, await response.json());
            case 404:
                throw new NotFound(response, await response.json());
            case 429:
                throw new Ratelimited(response, await response.json());
            default:
                throw new RESTError(response, await response.json());
            }
        }
        return response;
    }
}

module.exports = {RESTError, Unauthorized, Forbidden, NotFound, Ratelimited, DiscordError, InternalServerError, BadGateway, REST};