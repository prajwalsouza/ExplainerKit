// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function stateOf(set: any): any;
export function sampleRows(set: any, time?: number): any;
export function pointSet(seed: any, x: any, y: any, operations?: any[], diagnostics?: {}): Readonly<{
    count: number;
    seed: any;
    readonly x: Float32Array<ArrayBuffer>;
    readonly y: Float32Array<ArrayBuffer>;
    diagnostics: Readonly<{}>;
    rand(index: any, channel?: number): number;
    sample(time?: number): any;
}>;
/** Return another captured point set; evaluate function columns independently at each sample time. */
export function attribute(set: any, input: any, callback: any): Readonly<{
    count: number;
    seed: any;
    readonly x: Float32Array<ArrayBuffer>;
    readonly y: Float32Array<ArrayBuffer>;
    diagnostics: Readonly<{}>;
    rand(index: any, channel?: number): number;
    sample(time?: number): any;
}>;
