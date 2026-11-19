// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Create a silk brush for one theme. Light themes (Pearl, Paper) lay the fibres down as ink; dark themes add light.
 * @param {{theme?: Parameters<typeof chartTheme>[0], budget?: number}} [spec]
 */
export function silkBrush(spec?: {
    theme?: Parameters<typeof chartTheme>[0];
    budget?: number;
}): {
    readonly theme: Readonly<{
        background: string;
        text: string;
        grid: string;
        mark: string;
        accent: string;
        motion: "silk";
    }> | Readonly<{
        background: string;
        text: string;
        grid: string;
        mark: string;
        accent: string;
        motion: "silk";
    }> | Readonly<{
        background: string;
        text: string;
        grid: string;
        mark: string;
        accent: string;
        motion: "grow";
    }> | Readonly<{
        background: string;
        text: string;
        grid: string;
        mark: string;
        accent: string;
        motion: "grow";
    }> | Readonly<{
        background: string;
        text: string;
        grid: string;
        mark: string;
        accent: string;
        motion: "trace";
    }>;
    /** True when the theme adds light on a dark ground; false when it lays ink on a light one. */
    readonly additive: boolean;
    /** Change the theme between frames. */
    setTheme(name: any): void;
    /**
     * Start a frame. `light` is a point in the same user space as the marks, or null for a slow orbiting light
     * about `centre`. `size` is the drawing's rough extent in user units, used for the light's reach. `scale` is how
     * many device-independent pixels one user unit covers (1 by default), so a zoomed view is sampled finely enough.
     * @param {{time?: number, light?: [number, number] | null, centre?: [number, number], size?: number,
     *          scale?: number}} frame
     */
    begin(frame?: {
        time?: number;
        light?: [number, number] | null;
        centre?: [number, number];
        size?: number;
        scale?: number;
    }): /*elided*/ any;
    /**
     * Radial hairs filling the polar band between angles a0..a1 and radii r0..r1 about (cx, cy). Hair lengths
     * vary by `ragged` (0–1) and sway slowly; `heat` (0–1) warms them; `alpha` scales their light.
     */
    hairs(m: any): /*elided*/ any;
    /**
     * A bundle of strands along the cubic from `from` through `c1`, `c2` to `to`. All `count` strands (1–48) meet at
     * the two end points and fan out by `spread` user units in the middle. To attach a ribbon along a rim, give
     * `fromArc` and `toArc` as {cx, cy, r, a0, a1}: strand ends are then spaced along those arcs, exactly on the rim.
     * `trim` (0–1) ends the strands part of the way along; `trimStart` (0–1) starts them part of the way along, so
     * a short window can travel the curve like a comet. With `taper`, light fades toward the start of the window.
     */
    strands(m: any): /*elided*/ any;
    /** A soft glowing dot. */
    glow(m: any): /*elided*/ any;
    /** Sample the frame's marks into point clouds: `{fibres, glow}`, each `{positions, colors}`. */
    sample(): {
        fibres: {
            positions: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
        };
        glow: {
            positions: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
        };
    };
    /**
     * Sample the frame and composite it onto a 2D context in its current transform. Returns false, drawing
     * nothing, when the platform has no WebGL2 point rasterizer, so the caller can paint its own fallback.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx: CanvasRenderingContext2D): boolean;
    /** True when this context can take GPU points. */
    ready(ctx: any): any;
    /** Release the GPU context. */
    dispose(): void;
};
import { chartTheme } from './chart-themes.js';
