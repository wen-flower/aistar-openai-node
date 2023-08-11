/// <reference types="node" />
/// <reference types="node" />
import { RequestOptions } from "https";
import { ClientRequest, IncomingMessage } from "http";
export type EventSourceInitDict = {
    headers?: RequestOptions['headers'];
    initialRetryDelayMillis?: number;
    retryResetIntervalMillis?: number;
    maxBackoffMillis?: number;
    jitterRatio?: number;
    skipDefaultHeaders?: boolean;
    rejectUnauthorized?: boolean;
    proxy?: string;
    agent?: RequestOptions['agent'];
    https?: Record<string, string | boolean | number>;
    withCredentials?: boolean;
    method?: "POST" | "GET";
    readTimeoutMillis?: number;
    errorFilter?: (error: EventInit) => boolean;
    body?: any;
};
export type EventSourceOptions = {
    protocol?: "https:" | "http:" | "sse:";
    path?: string;
    hostname?: string;
    host?: string;
    port?: string;
    auth?: string;
} & EventSourceInitDict & Record<string, string | number | boolean> & RequestOptions;
export interface EventSourceRequest extends ClientRequest {
}
export type EventSourceResponse = {} & IncomingMessage;
export type EventSourceError = {
    status?: number;
    message?: string;
} & EventInit;
export type EventSourceEventType = "close" | "end" | "data";
export type EventSourceEvent = {
    delayMillis?: number;
} & Event;
