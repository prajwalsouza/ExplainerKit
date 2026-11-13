// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Retained SVG projection. A stable frame ID retains its DOM element. */
export function createSVGRenderer(container: any, { label }?: {
    label?: string | undefined;
}): {
    element: any;
    stats: {
        clampedFilters: number;
    };
    nativeLayer(id: any): Readonly<{
        element: any;
        dispose(): void;
    }>;
    render(frame: any): void;
    dispose(): void;
};
/** SVG draws one element per point, so it accepts smaller clouds than the Canvas GPU path. */
export const MAX_SVG_POINTS: 5000;
