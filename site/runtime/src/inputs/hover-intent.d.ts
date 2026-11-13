// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Settle a pointer hit ID using explicit dwell/leave times. Starts only its own
 * subscription/timer, never the caller's pointer source. Speed uses source units/s.
 */
export function hoverIntent(pointer: any, spec?: {}): Readonly<{
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
