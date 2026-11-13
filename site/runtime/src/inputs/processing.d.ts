// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Latest-with-freshness join. Starts its subscriptions, never its upstream devices. */
export function deriveInput(sources: any, map: any, spec?: {}): Readonly<{
    sourceId: any;
    kind: any;
    unit: any;
    space: any;
    maxAge: any;
    start: () => any;
    stop: () => void;
    dispose: () => void;
    push: (value: any, metadata?: {}) => Readonly<{
        source: any;
        epoch: number;
        sequence: number;
        time: any;
        receivedAt: any;
        value: any;
        unit: any;
        space: any;
        quality: Readonly<{
            valid: any;
            confidence: any;
        }>;
    }>;
    snapshot: () => Readonly<{
        sourceId: any;
        kind: any;
        status: string;
        epoch: number;
        sequence: number;
        latest: any;
        age: number | null;
        maxAge: any;
        stale: boolean;
        error: any;
        dropped: number;
        retained: number;
        retainedBytes: number;
    }>;
    samples: () => readonly any[];
    subscribe: (listener: any) => () => boolean;
}>;
/** Map one source value; the immutable observation is supplied as the second argument. */
export function mapInput(source: any, map: any, spec?: {}): Readonly<{
    sourceId: any;
    kind: any;
    unit: any;
    space: any;
    maxAge: any;
    start: () => any;
    stop: () => void;
    dispose: () => void;
    push: (value: any, metadata?: {}) => Readonly<{
        source: any;
        epoch: number;
        sequence: number;
        time: any;
        receivedAt: any;
        value: any;
        unit: any;
        space: any;
        quality: Readonly<{
            valid: any;
            confidence: any;
        }>;
    }>;
    snapshot: () => Readonly<{
        sourceId: any;
        kind: any;
        status: string;
        epoch: number;
        sequence: number;
        latest: any;
        age: number | null;
        maxAge: any;
        stale: boolean;
        error: any;
        dropped: number;
        retained: number;
        retainedBytes: number;
    }>;
    samples: () => readonly any[];
    subscribe: (listener: any) => () => boolean;
}>;
/** Time-based scalar low-pass filter. Each explicit start resets filter state. */
export function smoothInput(source: any, spec?: {}): Readonly<{
    sourceId: any;
    kind: any;
    unit: any;
    space: any;
    maxAge: any;
    start: () => any;
    stop: () => void;
    dispose: () => void;
    push: (value: any, metadata?: {}) => Readonly<{
        source: any;
        epoch: number;
        sequence: number;
        time: any;
        receivedAt: any;
        value: any;
        unit: any;
        space: any;
        quality: Readonly<{
            valid: any;
            confidence: any;
        }>;
    }>;
    snapshot: () => Readonly<{
        sourceId: any;
        kind: any;
        status: string;
        epoch: number;
        sequence: number;
        latest: any;
        age: number | null;
        maxAge: any;
        stale: boolean;
        error: any;
        dropped: number;
        retained: number;
        retainedBytes: number;
    }>;
    samples: () => readonly any[];
    subscribe: (listener: any) => () => boolean;
}>;
/** Scalar hysteresis. A boolean state, not an inferred semantic event. */
export function thresholdInput(source: any, spec?: {}): Readonly<{
    sourceId: any;
    kind: any;
    unit: any;
    space: any;
    maxAge: any;
    start: () => any;
    stop: () => void;
    dispose: () => void;
    push: (value: any, metadata?: {}) => Readonly<{
        source: any;
        epoch: number;
        sequence: number;
        time: any;
        receivedAt: any;
        value: any;
        unit: any;
        space: any;
        quality: Readonly<{
            valid: any;
            confidence: any;
        }>;
    }>;
    snapshot: () => Readonly<{
        sourceId: any;
        kind: any;
        status: string;
        epoch: number;
        sequence: number;
        latest: any;
        age: number | null;
        maxAge: any;
        stale: boolean;
        error: any;
        dropped: number;
        retained: number;
        retainedBytes: number;
    }>;
    samples: () => readonly any[];
    subscribe: (listener: any) => () => boolean;
}>;
