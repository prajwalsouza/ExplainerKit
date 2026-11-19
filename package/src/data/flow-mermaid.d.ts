// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Read a Mermaid flowchart into nodes, edges and groups.
 * @param {string} source
 * @returns {{direction: 'TB'|'BT'|'LR'|'RL', nodes: {id: string, label: string, shape: string, group: string|null}[],
 *   edges: {from: string, to: string, label: string, style: 'solid'|'dotted'|'thick', arrow: boolean}[],
 *   groups: {id: string, title: string, members: string[]}[]}}
 */
export function parseMermaidFlow(source: string): {
    direction: "TB" | "BT" | "LR" | "RL";
    nodes: {
        id: string;
        label: string;
        shape: string;
        group: string | null;
    }[];
    edges: {
        from: string;
        to: string;
        label: string;
        style: "solid" | "dotted" | "thick";
        arrow: boolean;
    }[];
    groups: {
        id: string;
        title: string;
        members: string[];
    }[];
};
export const MAX_FLOW_SOURCE: 65536;
export const MAX_FLOW_NODES: 200;
export const MAX_FLOW_EDGES: 400;
