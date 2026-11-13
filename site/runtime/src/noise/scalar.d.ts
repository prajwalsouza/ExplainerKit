// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Scalar coherent noise in [-1,1]; scale is spatial frequency in inverse scene units. */
export function noiseField(spec?: {}): (x: any, y: any, time?: number) => any;
/** Row-major scalar grid; validation precedes the coherent-noise hot loop.
 * @param {{columns:number,rows:number,x?:number,y?:number,stepX?:number,stepY?:number,scale?:number,time?:number,seed?:number}} spec
 */
export function noiseGrid(spec: {
    columns: number;
    rows: number;
    x?: number;
    y?: number;
    stepX?: number;
    stepY?: number;
    scale?: number;
    time?: number;
    seed?: number;
}): Float64Array<ArrayBuffer>;
