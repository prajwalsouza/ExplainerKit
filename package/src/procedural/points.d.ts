// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Seeded bounded distributions. Coordinates are captured as Float32 before containment/spacing tests. */
export function points(spec?: {}): Readonly<{
    count: number;
    seed: any;
    readonly x: Float32Array<ArrayBuffer>;
    readonly y: Float32Array<ArrayBuffer>;
    diagnostics: Readonly<{}>;
    rand(index: any, channel?: number): number;
    sample(time?: number): any;
}>;
