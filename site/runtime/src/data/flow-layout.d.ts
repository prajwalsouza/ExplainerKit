// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * @param {{direction: string, nodes: {id: string, label: string, shape: string, group: string|null}[],
 *   edges: {from: string, to: string, label: string, style: string, arrow: boolean}[],
 *   groups: {id: string, title: string, members: string[]}[]}} graph
 * @param {number} width
 * @param {number} height
 */
export function flowLayout(graph: {
    direction: string;
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
        style: string;
        arrow: boolean;
    }[];
    groups: {
        id: string;
        title: string;
        members: string[];
    }[];
}, width: number, height: number): {
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
