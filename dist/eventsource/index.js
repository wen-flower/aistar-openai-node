"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const retry_delay_1 = require("./retry-delay");
const capacity_1 = __importDefault(require("./capacity"));
const url_1 = require("url");
const events_1 = __importDefault(require("events"));
const events_2 = __importDefault(require("events"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const util_1 = __importDefault(require("util"));
const httpsOptions = [
    'pfx', 'key', 'passphrase', 'cert', 'ca', 'ciphers',
    'rejectUnauthorized', 'secureProtocol', 'servername', 'checkServerIdentity'
];
const bom = [239, 187, 191];
const colon = 58;
const space = 32;
const lineFeed = 10;
const carriageReturn = 13;
const MAX_OVER_ALLOCATION = 1024 * 1024; // 1 MiB
const HEADER_LAST_EVENT_ID = 'Last-Event-ID';
function hasBom(buf) {
    return bom.every(function (charCode, index) {
        return buf[index] === charCode;
    });
}
var StateEnum;
(function (StateEnum) {
    StateEnum[StateEnum["CONNECTING"] = 0] = "CONNECTING";
    StateEnum[StateEnum["OPEN"] = 1] = "OPEN";
    StateEnum[StateEnum["CLOSED"] = 2] = "CLOSED";
})(StateEnum || (StateEnum = {}));
class EventSource extends events_2.default {
    constructor(url, eventSourceInitDict) {
        super();
        this.reconnectInterval = 1000;
        this.lastEventId = "";
        this.discardTrailingNewline = false;
        this.readyState = StateEnum.CONNECTING;
        const config = eventSourceInitDict || {};
        this.config = config;
        this.url = url;
        if (this.config.headers && this.config.headers[HEADER_LAST_EVENT_ID]) {
            this.lastEventId = String(this.config.headers[HEADER_LAST_EVENT_ID]);
        }
        this.retryDelayStrategy = (0, retry_delay_1.RetryDelayStrategy)(config.initialRetryDelayMillis != undefined ? config.initialRetryDelayMillis : 1000, config.retryResetIntervalMillis, config.maxBackoffMillis ? (0, retry_delay_1.defaultBackoff)(config.maxBackoffMillis) : null, config.jitterRatio ? (0, retry_delay_1.defaultJitter)(config.jitterRatio) : null);
        this.streamOriginUrl = new url_1.URL(url).origin;
        this.connect();
    }
    // 返回 { url, options }; 如果 URL 属性在选项中，则 url 为 null/未定义
    makeRequestUrlAndOptions() {
        let actualUrl = this.url;
        const options = {};
        options.headers = {};
        if (!this.config.skipDefaultHeaders) {
            options.headers['Cache-Control'] = 'no-cache';
            options.headers['Accept'] = 'text/event-stream';
        }
        if (this.lastEventId)
            options.headers[HEADER_LAST_EVENT_ID] = this.lastEventId;
        if (this.config.headers) {
            for (let key in this.config.headers) {
                if (this.config.headers.hasOwnProperty(key)) {
                    options.headers[key] = this.config.headers[key];
                }
            }
        }
        // Legacy: this should be specified as `eventSourceInitDict.https.rejectUnauthorized`,
        // but for now exists as a backwards-compatibility layer
        options.rejectUnauthorized = !!this.config.rejectUnauthorized;
        // If specify http proxy, make the request to sent to the proxy server,
        // and include the original url in path and Host headers
        if (this.config.proxy) {
            actualUrl = null;
            const parsedUrl = (0, url_1.parse)(this.url);
            const proxy = (0, url_1.parse)(this.config.proxy);
            options.protocol = proxy.protocol == 'https:' ? 'https:' : 'http:';
            options.path = this.url;
            options.headers.Host = parsedUrl.host;
            options.hostname = proxy.hostname;
            options.host = proxy.host;
            options.port = proxy.port;
            // @ts-ignore
            if (proxy.username) {
                // @ts-ignore
                options.auth = proxy.username + ':' + proxy.password;
            }
        }
        // When running in Node, proxies can also be specified as an agent
        if (this.config.agent) {
            options.agent = this.config.agent;
        }
        // If https options are specified, merge them into the request options
        if (this.config.https) {
            for (let optName in this.config.https) {
                if (httpsOptions.indexOf(optName) == -1) {
                    continue;
                }
                const option = this.config.https[optName];
                if (option != undefined) {
                    options[optName] = option;
                }
            }
        }
        // Pass this on to the XHR
        if (this.config.withCredentials !== undefined) {
            options.withCredentials = this.config.withCredentials;
        }
        if (this.config.method) {
            options.method = this.config.method;
        }
        return { url: actualUrl, options: options };
    }
    defaultErrorFilter(error) {
        if (error.status) {
            const s = error.status;
            return s === 500 || s === 502 || s === 503 || s === 504;
        }
        return false;
        // TODO: return true // always return I/O errors
    }
    failed(error) {
        if (this.readyState === StateEnum.CLOSED) {
            return;
        }
        const errorEvent = error ? new Event('error', error) : new Event('end');
        const shouldRetry = (this.config.errorFilter || this.defaultErrorFilter)(errorEvent);
        if (shouldRetry) {
            this.readyState = StateEnum.CONNECTING;
            this._emit(errorEvent);
            this.scheduleReconnect();
        }
        else {
            this._emit(errorEvent);
            this.readyState = StateEnum.CLOSED;
            this._emit(new Event('closed'));
        }
    }
    scheduleReconnect() {
        if (this.readyState !== StateEnum.CONNECTING)
            return;
        const delay = this.retryDelayStrategy.nextRetryDelay(new Date().getTime());
        // The url may have been changed by a temporary redirect. If that's the case, revert it now.
        if (this.reconnectUrl) {
            this.url = this.reconnectUrl;
            this.reconnectUrl = null;
        }
        const event = new Event('retrying');
        event.delayMillis = delay;
        this._emit(event);
        setTimeout(() => {
            if (this.readyState != StateEnum.CONNECTING)
                return;
            this.connect();
        }, delay);
    }
    // connect
    // private isFirst = true
    // private buf
    // private startingPos = 0
    // private startingFieldLength = -1
    connect() {
        const urlAndOptions = this.makeRequestUrlAndOptions();
        const isSecure = urlAndOptions.options.protocol === 'https:' ||
            (urlAndOptions.url && urlAndOptions.url.startsWith('https:'));
        const callback = (res) => {
            // Handle HTTP redirects
            if (res.statusCode == 301 || res.statusCode == 307) {
                if (!res.headers.location) {
                    // Server sent redirect response without Location header.
                    this.failed({ status: res.statusCode, message: res.statusMessage });
                    return;
                }
                if (res.statusCode === 307)
                    this.reconnectUrl = this.url;
                this.url = res.headers.location;
                process.nextTick(this.connect); // don't go through the scheduleReconnect logic since this isn't an error
                return;
            }
            // Handle HTTP errors
            if (res.statusCode != 200) {
                this.failed({ status: res.statusCode, message: res.statusMessage });
                return;
            }
            this.data = '';
            this.eventName = '';
            this.eventId = undefined;
            this.readyState = StateEnum.OPEN;
            res.on('close', () => {
                res.removeAllListeners('close');
                res.removeAllListeners('end');
                this.failed();
            });
            res.on('end', () => {
                res.removeAllListeners('close');
                res.removeAllListeners('end');
                this.failed();
            });
            this._emit(new Event('open'));
            // text/event-stream parser adapted from webkit's
            // Source/WebCore/page/EventSource.cpp
            let isFirst = true;
            let buf;
            let startingPos = 0;
            let startingFieldLength = -1;
            let sizeUsed = 0;
            res.on('data', (chunk) => {
                if (!buf) {
                    buf = chunk;
                    if (isFirst && hasBom(buf)) {
                        // TODO: 原 buf = buf.slice(bom.length)
                        buf = buf.slice(bom.length);
                        sizeUsed -= bom.length;
                    }
                }
                else {
                    // allocate new buffer
                    const [resize, newCapacity] = (0, capacity_1.default)(buf.length, chunk.length + sizeUsed, MAX_OVER_ALLOCATION);
                    if (resize) {
                        let newBuffer = Buffer.alloc(newCapacity);
                        buf.copy(newBuffer, 0, 0, sizeUsed);
                        buf = newBuffer;
                    }
                    chunk.copy(buf, sizeUsed);
                }
                sizeUsed += chunk.length;
                isFirst = false;
                let pos = 0;
                const length = sizeUsed;
                while (pos < length) {
                    if (this.discardTrailingNewline) {
                        if (buf[pos] === lineFeed) {
                            ++pos;
                        }
                        this.discardTrailingNewline = false;
                    }
                    let lineLength = -1;
                    let fieldLength = startingFieldLength;
                    let c;
                    for (let i = startingPos; lineLength < 0 && i < length; ++i) {
                        c = buf[i];
                        if (c == colon) {
                            if (fieldLength < 0) {
                                fieldLength = i - pos;
                            }
                        }
                        else if (c == carriageReturn) {
                            this.discardTrailingNewline = true;
                            lineLength = i - pos;
                        }
                        else if (c == lineFeed) {
                            lineLength = i - pos;
                        }
                    }
                    if (lineLength < 0) {
                        startingPos = length - pos;
                        startingFieldLength = fieldLength;
                        break;
                    }
                    else {
                        startingPos = 0;
                        startingFieldLength = -1;
                    }
                    this.parseEventStreamLine(buf, pos, fieldLength, lineLength);
                    pos += lineLength + 1;
                }
                if (pos === length) {
                    buf = void 0;
                    sizeUsed = 0;
                }
                else if (pos > 0) {
                    // TODO: 原 buf = buf.slice(pos)
                    buf = buf.subarray(pos);
                    sizeUsed = buf.length;
                }
            });
        };
        let api = isSecure ? https_1.default : http_1.default;
        this.req = urlAndOptions.url
            ? api.request(urlAndOptions.url, urlAndOptions.options, callback)
            : api.request(urlAndOptions.options, callback);
        if (this.config.readTimeoutMillis) {
            this.req.setTimeout(this.config.readTimeoutMillis);
        }
        if (this.config.body) {
            this.req.write(this.config.body);
        }
        this.req.on('error', (err) => {
            this.failed({ message: err.message });
        });
        this.req.on('timeout', () => {
            this.failed({
                message: 'Read timeout, received no data in ' + this.config.readTimeoutMillis +
                    'ms, assuming connection is dead'
            });
        });
        if (this.req.setNoDelay)
            this.req.setNoDelay(true);
        this.req.end();
    }
    _emit(event) {
        if (event) {
            // @ts-ignore
            this.emit(event.type, event);
        }
    }
    _close() {
        if (this.readyState === StateEnum.CLOSED)
            return;
        this.readyState = StateEnum.CLOSED;
        if (this.req.abort)
            this.req.abort();
        // @ts-ignore
        if (this.req.xhr && this.req.xhr.abort)
            this.req.xhr.abort();
        this._emit(new Event('closed'));
    }
    receivedEvent(event) {
        this.retryDelayStrategy.setGoodSince(new Date().getTime());
        this._emit(event);
    }
    parseEventStreamLine(buf, pos, fieldLength, lineLength) {
        if (lineLength == 0) {
            if (this.data.length > 0) {
                const type = this.eventName || 'message';
                if (this.eventId !== undefined) {
                    this.lastEventId = this.eventId;
                }
                const event = new MessageEvent(type, {
                    data: this.data.slice(0, -1),
                    lastEventId: this.lastEventId,
                    origin: this.streamOriginUrl
                });
                this.data = '';
                this.eventId = undefined;
                this.receivedEvent(event);
            }
            this.eventName = undefined;
        }
        else {
            let noValue = fieldLength < 0;
            let step = 0;
            // TODO: 原 let field = buf.slice(pos, pos + (noValue ? lineLength : fieldLength)).toString()
            let field = buf.subarray(pos, pos + (noValue ? lineLength : fieldLength)).toString();
            if (noValue) {
                step = lineLength;
            }
            else if (buf[pos + fieldLength + 1] !== space) {
                step = fieldLength + 1;
            }
            else {
                step = fieldLength + 2;
            }
            pos += step;
            let valueLength = lineLength - step;
            // TODO: 原 var value = buf.slice(pos, pos + valueLength).toString()
            let value = buf.subarray(pos, pos + valueLength).toString();
            if (field == 'data') {
                this.data += value + '\n';
            }
            else if (field === 'event') {
                this.eventName = value;
            }
            else if (field === 'id') {
                if (!value.includes('\u0000')) {
                    this.eventId = value;
                }
            }
            else if (field === 'retry') {
                let retry = parseInt(value, 10);
                if (!Number.isNaN(retry)) {
                    this.reconnectInterval = retry;
                    this.retryDelayStrategy.setBaseDelay(retry);
                }
            }
        }
    }
    close() {
        this._close();
    }
}
exports.default = EventSource;
util_1.default.inherits(EventSource, events_1.default.EventEmitter);
/**
 * W3C Event
 *
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 * @api private
 */
// @ts-ignore
class Event {
    constructor(type, optionalProperties) {
        this.type = type;
        if (optionalProperties) {
            for (let f in optionalProperties) {
                if (optionalProperties.hasOwnProperty(f)) {
                    Object.defineProperty(this, f, { writable: false, value: optionalProperties[f], enumerable: true });
                }
            }
        }
    }
}
/**
 * W3C MessageEvent
 *
 * @see http://www.w3.org/TR/webmessaging/#event-definitions
 * @api private
 */
class MessageEvent {
    constructor(type, eventInitDict) {
        this.type = type;
        this.data = eventInitDict.data;
        this.lastEventId = eventInitDict.lastEventId;
        this.origin = eventInitDict.origin;
    }
}
