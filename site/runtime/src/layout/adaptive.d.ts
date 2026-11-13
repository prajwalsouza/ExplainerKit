// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Frame-space bounds of a node and its descendants, whether any of it is visible, and the text sizes it shows. */
export function measureNode(node: any, measure?: (text: any, fontSize: any, fontWeight?: number) => number, parent?: number[], alpha?: number): any;
/**
 * Study a scene over time. For each root node: the union of its visible bounds across the samples (common
 * fate), its last bounds, the text sizes it shows, and its tags. `exclude` skips nodes such as title cards.
 */
export function analyse(frames: any, { measure, exclude, tagsOf }?: {
    measure?: ((text: any, fontSize: any, fontWeight?: number) => number) | undefined;
    exclude?: Set<any> | undefined;
    tagsOf?: (() => never[]) | undefined;
}): any[];
/** Common region: items that share a `together` tag become one unit. Everything else is its own unit. */
export function units(items: any, together?: any[]): ({
    items: never[];
    box: any;
    tags: Set<any>;
    together: any;
} | {
    items: any[];
    box: any;
    tags: Set<any>;
})[];
/**
 * Proximity: horizontal bands of related content. Overlapping units share a band; then, as in Gestalt
 * proximity, distance is judged relatively: a gap much smaller than the scene's largest gap (a label under
 * its drawing) joins its neighbours, while the large gaps separate ideas.
 */
export function bandsOf(unitList: any, { tolerance, near, relative, far }?: {
    tolerance?: number | undefined;
    near?: number | undefined;
    relative?: number | undefined;
    far?: number | undefined;
}): {
    units: any[];
    box: any;
}[];
/**
 * Plan how an authored composition is shown in a container.
 * - `items`: from `analyse(frames, { tagsOf })`
 * - `authored`, `container`: { width, height }; the container in CSS pixels
 * - `policy`: a scene's `adaptivePolicy`: { together: [tags], minText, targetText }
 * Returns placements per root node ID, the fallback fit, and a report of every candidate considered.
 */
export function planLayout({ items, authored, container, policy, gap, pad, cap, ratio }: {
    items: any;
    authored: any;
    container: any;
    policy?: {} | undefined;
    gap?: number | undefined;
    pad?: number | undefined;
    cap?: number | undefined;
    ratio?: number | undefined;
}): Readonly<{
    mode: any;
    container: any;
    authored: any;
    fit: {
        source: {
            x0: number;
            y0: number;
            x1: any;
            y1: any;
        };
        scale: number;
        x: number;
        y: number;
        ids: never[];
    };
    placements: any;
    assignment: Map<any, any>;
    readable: {
        together: any;
        minText: any;
        targetText: any;
    };
    report: Readonly<{
        chosen: any;
        reason: "the authored composition is readable" | "the most readable candidate that fits" | "no candidate reaches the readable minimum; text is lifted to it";
        blocks: number;
        candidates: {
            mode: any;
            minText: number;
            coverage: number;
            inside: any;
            readable: any;
        }[];
    }>;
}>;
/**
 * Re-compose one sampled frame with a plan. Each root node is wrapped in a placement group, so draw order and
 * node IDs are kept; text is lifted to the readable minimum. The result has the container's size.
 */
export function applyLayout(frame: any, plan: any): {
    width: any;
    height: any;
    children: any;
};
/** Map a container point back to authored coordinates, through whichever placement it falls in. */
export function toAuthored(plan: any, point: any): {
    x: any;
    y: any;
};
export function estimateText(text: any, fontSize: any, fontWeight?: number): number;
