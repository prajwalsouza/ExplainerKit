// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Variable-radius Poisson proposals; count is a ceiling, not a saturation promise. */
export function densityPoints(spec: any, seed: any, domain: any, budget: any, count: any): Readonly<{
    count: number;
    seed: any;
    readonly x: Float32Array<ArrayBuffer>;
    readonly y: Float32Array<ArrayBuffer>;
    diagnostics: Readonly<{}>;
    rand(index: any, channel?: number): number;
    sample(time?: number): any;
}>;
