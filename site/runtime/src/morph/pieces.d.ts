// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Partition a convex source into real cells, then morph each cell toward one target. */
export function createSplitMorph(source: any, targets: any, spec?: {}): Readonly<{
    diagnostics: Readonly<{
        kind: any;
        pieces: any;
        assignment: any;
        assign: any;
        stagger: any;
        partitionedEndpoints: true;
        semanticIdentityMerge: false;
    }>;
    sample: (progress: any) => any;
    frame(progress: any, frameSpec?: {}): Readonly<{
        width: any;
        height: any;
        children: any;
    }>;
}>;
/** Bring separate real pieces into a partition of a target shape. */
export function createMergeMorph(sources: any, target: any, spec?: {}): Readonly<{
    diagnostics: Readonly<{
        kind: any;
        pieces: any;
        assignment: any;
        assign: any;
        stagger: any;
        partitionedEndpoints: true;
        semanticIdentityMerge: false;
    }>;
    sample: (progress: any) => any;
    frame(progress: any, frameSpec?: {}): Readonly<{
        width: any;
        height: any;
        children: any;
    }>;
}>;
