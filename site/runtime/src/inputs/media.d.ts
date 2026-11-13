// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture camera metadata after explicit start; the caller supplies the visible preview element. */
export function cameraInput(video: any, spec?: {}): Readonly<{
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
/**
 * Microphone level windows: RMS, peak and clipping; with `bands`, also a coarse spectrum. No speech
 * recognition, recording or audio feedback path.
 */
export function microphoneInput(spec?: {}): Readonly<{
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
