// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Internal adapter lifecycle. All resource acquisition is deferred until explicit start(). */
export function managedSource(spec?: {}, activate?: () => void): Readonly<{
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
/** Caller-fed observations, including an explicitly supplied phone/transport bridge. */
export function inputSource(spec?: {}): Readonly<{
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
export function isInputSource(value: any): boolean;
/** Capture reference arrays without executing indexed accessors or copying owned objects. */
export function captureReferences(input: any, maximum: any, label: any): readonly any[];
