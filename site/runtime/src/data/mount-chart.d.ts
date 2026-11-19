// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Mount a light-strand chart with chart-type, theme, focus, motion and (optionally) frame controls.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{id: string, value: number, label?: string, highlight?: boolean, group?: string, heat?: number}>} rows
 * @param {{links?: ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>,
 *          theme?: Parameters<typeof chartTheme>[0], type?: 'radial'|'chord'|'sunburst'|'arc'|'bar', motion?: boolean,
 *          label?: string, valueLabel?: string, linkLabel?: string,
 *          frames?: ReadonlyArray<{label?: string, rows?: ReadonlyArray<{id: string, value: number, heat?: number}>,
 *                                  links?: ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>}>,
 *          frame?: number, frameDuration?: number, frameLabel?: string}} [spec]
 */
export function mountDataChart(container: HTMLElement, rows: ReadonlyArray<{
    id: string;
    value: number;
    label?: string;
    highlight?: boolean;
    group?: string;
    heat?: number;
}>, spec?: {
    links?: ReadonlyArray<{
        from: string;
        to: string;
        value?: number;
        heat?: number;
    }>;
    theme?: Parameters<typeof chartTheme>[0];
    type?: "radial" | "chord" | "sunburst" | "arc" | "bar";
    motion?: boolean;
    label?: string;
    valueLabel?: string;
    linkLabel?: string;
    frames?: ReadonlyArray<{
        label?: string;
        rows?: ReadonlyArray<{
            id: string;
            value: number;
            heat?: number;
        }>;
        links?: ReadonlyArray<{
            from: string;
            to: string;
            value?: number;
            heat?: number;
        }>;
    }>;
    frame?: number;
    frameDuration?: number;
    frameLabel?: string;
}): Promise<Readonly<{
    readonly type: "radial" | "arc" | "chord" | "bar" | "sunburst";
    readonly theme: "paper" | "silk" | "pearl" | "midnight" | "signal";
    readonly focus: string | null;
    readonly frame: number;
    player: any;
    /** @param {'radial' | 'chord' | 'sunburst' | 'arc' | 'bar'} next */
    setType(next: "radial" | "chord" | "sunburst" | "arc" | "bar"): void;
    /** @param {'silk' | 'pearl' | 'signal' | 'paper' | 'midnight'} next */
    setTheme(next: "silk" | "pearl" | "signal" | "paper" | "midnight"): void;
    /** @param {string | null} id */
    setFocus(id: string | null): void;
    /** Show one frame; values morph and rising values flare. @param {number} index */
    setFrame(index: number): void;
    play(): void;
    pause(): void;
    /**
     * Replace the values. Rows and links are matched by ID and endpoint pair, so marks move rather than restart.
     * @param {ReadonlyArray<{id: string, value: number, heat?: number}>} nextRows
     * @param {ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>} [nextLinks]
     */
    update(nextRows: ReadonlyArray<{
        id: string;
        value: number;
        heat?: number;
    }>, nextLinks?: ReadonlyArray<{
        from: string;
        to: string;
        value?: number;
        heat?: number;
    }>): void;
    dispose(): void;
}>>;
import { chartTheme } from './chart-themes.js';
