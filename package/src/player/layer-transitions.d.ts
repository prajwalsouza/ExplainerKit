// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Captures options, not a live handle's sampled geometry. */
export function captureLayerTransition(spec: any, span: any): Readonly<{
    kind: any;
    duration: any;
    direction: any;
    shape: {
        commands: any;
        handle?: undefined;
        scene?: undefined;
        id?: undefined;
    } | {
        handle: any;
        scene: any;
        id: any;
        commands?: undefined;
    } | null;
}> | null;
/** Pure transition sample. CSS percentages make the sampled mask independent of backing-store DPR. */
export function layerTransitionAt(transition: any, progress: any, context: any, resolveTime: any): {
    opacity: number;
    clip: string;
};
