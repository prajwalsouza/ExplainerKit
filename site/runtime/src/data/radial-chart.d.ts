// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Draw values as radial spokes and optional relationships as curved links.
 * @param {import('../core/scene.js').Scene} drawing
 * @param {ReadonlyArray<{id: string, value: number, label?: string, highlight?: boolean}>} rows
 * @param {{links?: ReadonlyArray<{from: string, to: string}>, theme?: Parameters<typeof chartTheme>[0], cx?: number,
 *          cy?: number, radius?: number, at?: number, motion?: boolean}} [spec]
 * @returns {ReturnType<import('../core/scene.js').Scene['group']>}
 */
export function radialChart(drawing: import("../core/scene.js").Scene, rows: ReadonlyArray<{
    id: string;
    value: number;
    label?: string;
    highlight?: boolean;
}>, spec?: {
    links?: ReadonlyArray<{
        from: string;
        to: string;
    }>;
    theme?: Parameters<typeof chartTheme>[0];
    cx?: number;
    cy?: number;
    radius?: number;
    at?: number;
    motion?: boolean;
}): ReturnType<import("../core/scene.js").Scene["group"]>;
import { chartTheme } from './chart-themes.js';
