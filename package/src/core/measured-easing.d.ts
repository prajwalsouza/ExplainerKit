// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Shape-preserving piecewise cubic Hermite interpolation (PCHIP).
 * Local extrema get zero slope; monotone spans never invent an extra overshoot.
 * Reference: Fritsch & Butland, SIAM J Sci Stat Comput 5(2), 1984, 300–304.
 * @param {number[]|{times:number[],values:number[]}} times
 * @param {number[]} [values]
 * @returns {(progress:number)=>number}
 */
export function sampledEasing(times: number[] | {
    times: number[];
    values: number[];
}, values?: number[]): (progress: number) => number;
/** Adapter for local track.py JSON. Reference sample data remains outside the repository. */
export function easingFromTrack(input: any): (progress: number) => number;
