// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Rows remain in supplied order. Null/missing observations break, rather than bridge, a line. */
export function linePath(input: any, spec?: {}): any;
/** Closed baseline areas; each missing observation ends the current independent segment. */
export function areaPath(input: any, spec?: {}): any;
/** A plain component blueprint: no renderer, node or scene mutation during preparation. */
export function axisBlueprint(mapping: any, spec?: {}): Readonly<{
    type: "group";
    props: Readonly<{
        x: any;
        y: any;
    }>;
    children: Readonly<{
        [k: string]: any;
    }>;
}>;
