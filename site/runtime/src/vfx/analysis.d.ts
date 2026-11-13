// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Inspect a decoded frame or region for candidate tracking features. */
export function analyzeFrame(input: any, spec?: {}): Readonly<{
    features: readonly Readonly<{
        x: any;
        y: any;
    }>[];
    brightness: number;
    contrast: number;
    darkFraction: number;
    brightFraction: number;
}>;
/** Compare up to 16 sampled frames and suggest a textured place to begin tracking. */
export function analyzeFootage(input: any, spec?: {}): Readonly<{
    samples: readonly Readonly<{
        features: readonly Readonly<{
            x: any;
            y: any;
        }>[];
        brightness: number;
        contrast: number;
        darkFraction: number;
        brightFraction: number;
        time: any;
    }>[];
    possibleCuts: readonly Readonly<{
        from: number;
        to: any;
    }>[];
    referenceTime: any;
}>;
