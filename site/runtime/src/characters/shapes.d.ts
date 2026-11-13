// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function ellipse(cx: any, cy: any, rx: any, ry?: any): any;
/** An egg: different radii above and below the widest line, the usual body of a cute character. */
export function egg(cx: any, cy: any, rx: any, top: any, bottom: any): any;
/** A closed polygon whose corners are rounded with quadratic curves; radius is clamped per corner. */
export function rounded(points: any, radius: any): any;
/** A smooth closed curve through points (Catmull-Rom converted to cubic Béziers). */
export function smoothClosed(points: any, tension?: number): any;
/** A smooth open curve through points, for strokes such as limbs, tails and flagella. */
export function smoothOpen(points: any, tension?: number): any;
export function mapCommands(commands: any, map: any): any;
/** Bounds of every coordinate, including control points; enough to place shading. */
export function bounds(commands: any): {
    x: number;
    y: number;
    width: number;
    height: number;
    cx: number;
    cy: number;
};
export function translate(commands: any, dx: any, dy: any): any;
export function scaleAbout(commands: any, cx: any, cy: any, sx: any, sy?: any): any;
