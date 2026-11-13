// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function pointerInput(element: any, spec?: {}): Readonly<{
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
export function resizeInput(element: any, spec?: {}): Readonly<{
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
 * A drag over an element before anything is dropped: whether something hovers, where, how many items
 * and whether they are files. Reading a dropped file is `fileInput`'s job; this source observes the
 * hover, so a scene can react while a file is still in the air. It prevents the default of
 * dragenter/dragover (which lets a drop land on the element) and never reads file contents; drop
 * handling and its default stay with `fileInput` or the application.
 */
export function dragInput(element: any, spec?: {}): Readonly<{
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
export function readInputFile(file: any, spec?: {}): Promise<Readonly<{
    name: any;
    format: any;
    rows: any;
}>>;
export function fileInput(element: any, spec?: {}): Readonly<{
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
export function deviceMotionInput(spec?: {}): Readonly<{
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
export function deviceOrientationInput(spec?: {}): Readonly<{
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
