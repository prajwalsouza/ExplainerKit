// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Deterministic inverse-CDF samplers. Supply a point's seeded random channel as u. */
export const distribution: Readonly<{
    fromSamples: typeof fromSamples;
    fromHistogram: typeof fromHistogram;
    pick: typeof pick;
}>;
declare function fromSamples(input: any): Readonly<{
    kind: string;
    count: any;
    sample(u: any): any;
}>;
declare function fromHistogram(inputBins: any, inputCounts: any): Readonly<{
    kind: "histogram";
    count: number;
    sample(u: any): any;
}>;
declare function pick(weights: any, u: any): string | number;
export {};
