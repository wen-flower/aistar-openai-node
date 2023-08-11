/// <reference types="node" />
import EventEmitter from "events";
import { EventSourceInitDict } from "./types";
declare enum StateEnum {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2
}
declare class EventSource extends EventEmitter {
    readyState: StateEnum;
    url: string;
    private streamOriginUrl;
    private config;
    private reconnectInterval;
    private req;
    private lastEventId;
    private retryDelayStrategy;
    private reconnectUrl?;
    private discardTrailingNewline;
    private data?;
    private eventName?;
    private eventId?;
    constructor(url: string, eventSourceInitDict?: EventSourceInitDict);
    private makeRequestUrlAndOptions;
    private defaultErrorFilter;
    private failed;
    private scheduleReconnect;
    connect(): void;
    private _emit;
    private _close;
    private receivedEvent;
    private parseEventStreamLine;
    close(): void;
}
export default EventSource;
