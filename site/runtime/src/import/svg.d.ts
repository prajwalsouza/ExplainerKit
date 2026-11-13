// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** SVG transform-list semantics: matrices compose left to right, rightmost acts first. */
export function parseSVGTransform(source?: string): readonly number[];
/** Normalize SVG M/L/H/V/C/S/Q/T/A/Z (relative or absolute) into core M/L/C/Q/Z. */
export function parseSVGPath(source: any, spec?: {}): any;
/** Parse into inert data only. Never adopts source nodes, fetches assets or injects markup. */
export function importSVG(source: any, spec?: {}): Readonly<{
    blueprint: Readonly<{
        type: any;
        props: Readonly<{
            [k: string]: any;
        }>;
        children: any;
    }>;
    width: any;
    height: any;
    viewBox: readonly any[] | null;
    parts: any;
    diagnostics: Readonly<{
        sourceNodes: number;
        componentNodes: number;
        commands: number;
        arcPaths: number;
        arcApproximation: "cubic segments of at most 90 degrees";
        externalResources: false;
        resourceReferences: number;
        naming: "id, data-name, decoded Illustrator escapes";
        unsupported: "reject before returning a blueprint";
    }>;
}>;
/** Explicit local-file read. No automatic fetch, URL resolution, recording or persistence. */
export function importSVGFile(file: any, spec?: {}): Promise<Readonly<{
    blueprint: Readonly<{
        type: any;
        props: Readonly<{
            [k: string]: any;
        }>;
        children: any;
    }>;
    width: any;
    height: any;
    viewBox: readonly any[] | null;
    parts: any;
    diagnostics: Readonly<{
        sourceNodes: number;
        componentNodes: number;
        commands: number;
        arcPaths: number;
        arcApproximation: "cubic segments of at most 90 degrees";
        externalResources: false;
        resourceReferences: number;
        naming: "id, data-name, decoded Illustrator escapes";
        unsupported: "reject before returning a blueprint";
    }>;
}>>;
