// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A ground to stand on: `{y}` is a flat floor, `{points: [[x, y], …]}` a polyline (slopes, hills, steps with
 * short risers) with strictly increasing x. Beyond the ends the first and last heights continue flat.
 */
export function surface(spec: any): any;
/**
 * Drawn bounds of a character in its rest pose, in character units (y-down, ground at 0): {x0, y0, x1, y1,
 * width, height, head}. The ground shadow and invisible parts are left out; strokes count their half width.
 * `head` is the box of the parts on the head bone (the top 40% of the body when a rig has none).
 */
export function restBounds(definition: any): any;
/**
 * A height in scene units: a number is already in scene units; a string such as '1.7m', '170cm' or '1700mm'
 * is converted with `unit` scene units per metre.
 */
export function sceneLength(value: any, unit: any, label?: string): any;
/** Put an existing character on a surface: same as actor.standOn(surface). */
export function standOn(actor: any, where: any): any;
export function isSurface(value: any): boolean;
export function restHeight(definition: any): any;
