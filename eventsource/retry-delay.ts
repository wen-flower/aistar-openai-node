// Encapsulation of configurable backoff/jitter behavior.
//
// - The system can either be in a "good" state or a "bad" state. The initial state is "bad"; the
// caller is responsible for indicating when it transitions to "good". When we ask for a new retry
// delay, that implies the state is now transitioning to "bad".
//
// - There is a configurable base delay, which can be changed at any time (if the SSE server sends
// us a "retry:" directive).
//
// - There are optional strategies for applying backoff and jitter to the delay.

type TBackOff = (currentBaseDelay: number, retryCount: number) => number
type TJitter = (delay: number) => number
export type TRetryDelayStrategy = {
    nextRetryDelay: (currentTimeMillis: number) => number
    setGoodSince: (goodSinceTimeMillis: number) => void
    setBaseDelay: (baseDelay: number) => void
}

function RetryDelayStrategy(baseDelayMillis: number, resetIntervalMillis?: number, backoff?: TBackOff, jitter?: TJitter): TRetryDelayStrategy {
    let currentBaseDelay = baseDelayMillis
    let retryCount = 0
    let goodSince: number | null
    return {
        nextRetryDelay: function (currentTimeMillis: number) {
            if (goodSince && resetIntervalMillis && (currentTimeMillis - goodSince >= resetIntervalMillis)) {
                retryCount = 0
            }
            goodSince = null
            const delay = backoff ? backoff(currentBaseDelay, retryCount) : currentBaseDelay
            retryCount++
            return jitter ? jitter(delay) : delay
        },
        setGoodSince: function (goodSinceTimeMillis: number) {
            goodSince = goodSinceTimeMillis
        },
        setBaseDelay: function (baseDelay: number) {
            currentBaseDelay = baseDelay
            retryCount = 0
        }
    }
}

function defaultBackoff(maxDelayMillis: number): TBackOff {
    return function (baseDelayMillis, retryCount) {
        var d = baseDelayMillis * Math.pow(2, retryCount)
        return d > maxDelayMillis ? maxDelayMillis : d
    }
}

function defaultJitter(ratio: number): TJitter {
    return function (computedDelayMillis) {
        return computedDelayMillis - Math.trunc(Math.random() * ratio * computedDelayMillis)
    }
}

export {
    RetryDelayStrategy,
    defaultBackoff,
    defaultJitter
}
