// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Canvas projection of the same frame. Opacity applies after compositing. */
export function createCanvasRenderer(container: any, { label, pixelRatio, points, gpuThreshold }?: {
    label?: string | undefined;
    pixelRatio?: number | undefined;
    points?: string | undefined;
    gpuThreshold?: number | undefined;
}): {
    element: any;
    stats: {
        layerRenders: number;
        cacheHits: number;
        isolatedLayers: number;
        clampedFilters: number;
    };
    render(frame: any): void;
    dispose(): void;
};
