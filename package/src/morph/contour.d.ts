// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Flatten one M/L/Q/C/Z contour; the chord error is explicitly bounded. */
export function flattenPath(commands: any, spec?: {}): Readonly<{
    points: readonly any[];
    cumulative: readonly number[];
    length: number | undefined;
    closed: any;
    area: number;
}>;
/** Arc-length correspondence for one contour. Pure samples preserve exact endpoints. */
export function createMorph(from: any, to: any, spec?: {}): Readonly<{
    diagnostics: Readonly<{
        closed: any;
        samples: any;
        offset: any;
        reversed: any;
        landmarks: any;
        approximationBound: Readonly<{
            from: any;
            to: any;
        }>;
        topologyGuaranteed: false;
    }>;
    sample(t: any): any;
    inspect(t: any): Readonly<{
        closed: any;
        samples: any;
        offset: any;
        reversed: any;
        landmarks: any;
        approximationBound: Readonly<{
            from: any;
            to: any;
        }>;
        topologyGuaranteed: false;
        properCrossings: number;
        sampledArea: number | null;
    }>;
}>;
