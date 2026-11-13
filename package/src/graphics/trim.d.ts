// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Shared authored-distance trim plan; leaves fills untouched. One contour: a dash pattern. Several contours
 * (letters, outlines with holes): renderers restart dashes on every subpath, so the visible stretch is cut as
 * geometry instead (`commands`), measured along the contours in order, so a drawing draws contour after contour.
 */
export function strokeTrim(commands: any, start?: number, end?: number, offset?: number): Readonly<{
    empty: boolean;
    length: any;
    visible: number;
    offset: number;
}> | null;
