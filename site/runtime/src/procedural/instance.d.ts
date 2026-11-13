// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Add one component with deterministic contiguous batches. No independent clock is installed. */
export function instance(scene: any, set: any, factory: any, spec?: {}): Readonly<{
    handle: any;
    count: any;
    nodeCount: any;
    sample(time?: number): readonly Readonly<{
        indices: any;
        depths: any;
    }>[];
}> | Readonly<{
    handle: any;
    count: any;
    nodeCount: number;
    batches: readonly Readonly<{
        type: string;
        first: any;
        count: any;
    }>[];
}>;
