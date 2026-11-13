// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Existing follow planner extended to authored root levels; a down foot is a fixed world point. */
export function planRootFollow2D({ sample, sampleY, end, layout, rest, sizeAt, facingAt, config }: {
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
}>;
