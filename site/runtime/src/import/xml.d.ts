// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Inert XML subset for SVG import: no DOM, execution, resource loading or DTD. */
export function parseInertSVG(source: any): {
    documentElement: {
        nodeType: number;
        localName: any;
        namespaceURI: any;
        attributes: {
            localName: any;
            namespaceURI: any;
            name: any;
            value: any;
        }[];
        childNodes: never[];
    } | null;
    querySelector(): null;
};
