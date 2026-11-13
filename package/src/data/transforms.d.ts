// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function fieldName(localValue2: any): any;
export function rows(input: any): any;
export function mapRows(input: any, map: any): any;
export function filterRows(input: any, predicate: any): any;
/** Stable first-seen group order; an ungrouped empty summary retains one count/sum row. */
export function summarize(input: any, spec?: {}): readonly any[];
/** Exact declared bin boundaries. Interior thresholds go to the bin on their right. */
export function bin(input: any, spec?: {}): Readonly<{
    bins: readonly Readonly<{
        rows: readonly never[];
        x0: any;
        x1: any;
        count: number;
    }>[];
    missingCount: number;
    outsideCount: number;
}>;
/** Independent positive and negative stacks, retaining source row and field identities. */
export function stack(input: any, spec?: {}): any;
/** Map a complete candidate table, validate the target, then replace exactly once. */
export function replaceMapped(target: any, input: any, map: any): any;
