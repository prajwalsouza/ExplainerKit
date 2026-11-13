// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture an absolute scene-x track, holding its ends. Functions are trusted pure curves of seconds. */
export function captureRootTrack(scene: any, track: any, read: any): any;
export function followOptions(spec?: {}): Readonly<{
    feet: any;
    threshold: any;
    duration: any;
    lift: any;
    lead: any;
    maxLead: any;
    weight: any;
    lean: any;
}>;
/** Fixed-rate plan with at most one swinging foot. Planted x is an anchor, never an interpolated local offset. */
export function planRootFollow({ sample, sampleY, end, layout, rest, sizeAt, facingAt, config }: {
    sample: any;
    sampleY: any;
    end: any;
    layout: any;
    rest: any;
    sizeAt: any;
    facingAt: any;
    config: any;
}): Readonly<{
    duration: any;
    rate: number;
    samples: number;
    steps: readonly never[];
    sample: (t: any) => {
        velocity: number;
        velocityY: number;
        x: any;
        y: any;
    };
}> | Readonly<{
    duration: any;
    rate: number;
    samples: number;
    steps: readonly Readonly<{
        from: any;
        to: Readonly<{
            x: any;
            y: any;
        }>;
        side?: string | undefined;
        at?: number | undefined;
        end?: number | undefined;
        lift?: number | undefined;
    }>[];
    sample: (time: any) => {
        velocity: number;
        velocityY: number;
        F: any;
        B: any;
        x: any;
        y: any;
    };
}> | Readonly<{
    sample: (time: any) => {
        x: number;
        velocity: number;
    };
    steps: readonly never[];
    rate: number;
    samples: number;
    duration: any;
}> | Readonly<{
    sample: (time: any) => {
        x: number;
        velocity: number;
        F: {
            x: any;
            y: number;
            down: boolean;
        };
        B: {
            x: any;
            y: number;
            down: boolean;
        };
    };
    steps: readonly Readonly<{
        side?: string | undefined;
        at?: number | undefined;
        end?: number | undefined;
        from?: any;
        to?: number | undefined;
        lift?: number | undefined;
    }>[];
    rate: 120;
    samples: number;
    duration: any;
}>;
