type TBackOff = (currentBaseDelay: number, retryCount: number) => number;
type TJitter = (delay: number) => number;
export type TRetryDelayStrategy = {
    nextRetryDelay: (currentTimeMillis: number) => number;
    setGoodSince: (goodSinceTimeMillis: number) => void;
    setBaseDelay: (baseDelay: number) => void;
};
declare function RetryDelayStrategy(baseDelayMillis: number, resetIntervalMillis?: number, backoff?: TBackOff, jitter?: TJitter): TRetryDelayStrategy;
declare function defaultBackoff(maxDelayMillis: number): TBackOff;
declare function defaultJitter(ratio: number): TJitter;
export { RetryDelayStrategy, defaultBackoff, defaultJitter };
