// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Steps without a script: every edge once, in the order a breadth-first walk from the sources meets them. */
export function defaultFlowSteps(layout: any): {
    from: any;
    to: any;
    label: any;
}[];
/**
 * @param {ReturnType<import('./flow-mermaid.js').parseMermaidFlow>} graph
 * @param {{theme: any, themeName: string, steps: {from?: string, to?: string, node?: string, label?: string}[],
 *          stepDuration: number, label: string, width?: number, height?: number}} spec
 */
export function flowScene(graph: ReturnType<typeof import("./flow-mermaid.js").parseMermaidFlow>, { theme, themeName, steps, stepDuration, label, width, height }: {
    theme: any;
    themeName: string;
    steps: {
        from?: string;
        to?: string;
        node?: string;
        label?: string;
    }[];
    stepDuration: number;
    label: string;
    width?: number;
    height?: number;
}): {
    drawing: import("../core/scene.js").Scene;
    layout: {
        direction: string;
        horizontal: boolean;
        scale: number;
        nodes: {
            rank: any;
            x: number;
            y: number;
            w: number;
            h: number;
            lines: number;
            id: string;
            label: string;
            shape: string;
            group: string | null;
        }[];
        edges: {
            back: boolean;
            points: any[][];
            from: string;
            to: string;
            label: string;
            style: string;
            arrow: boolean;
        }[];
        groups: {
            id: string;
            title: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[];
    };
    steps: {
        from?: string;
        to?: string;
        node?: string;
        label?: string;
    }[];
    width: number;
    height: number;
    stepDuration: number;
    stepAt: (time: any) => number;
    setTheme(nextTheme: any, name: any): void;
    /** Pointer in drawing units (null when it leaves), turned into layout units for the light. */
    setPointer(point: any): void;
    readonly view: {
        x: number;
        y: number;
        k: number;
    };
    /** Zoom by `factor` about a point in drawing units, within 0.5–6 times. */
    zoom(factor: any, at?: number[]): void;
    /** Move the view by a distance in drawing units. */
    pan(dx: any, dy: any): void;
    /** Frame one node, or the whole chart when `id` is null. */
    frame(id?: null): void;
    toWorld: ([x, y]: [any, any]) => number[];
    setSelection(nextHover: any, nextFocus: any): void;
    setAmbientPaused(time: any): void;
    /** The node under a point in drawing units, or null. */
    pick(px: any, py: any): string | null;
};
