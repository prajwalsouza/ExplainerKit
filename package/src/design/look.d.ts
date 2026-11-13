// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A style by name, or a custom style object with at least `look`; missing parts come from the default. */
export function resolveStyle(style?: string): any;
/** Design the look for a structure and shot plan and measure it. */
export function planLook(run: any, { brief, shots, timing, structure, style }: {
    brief: any;
    shots: any;
    timing: any;
    structure: any;
    style?: string | undefined;
}): Promise<{
    look: any;
    measures: any;
    problems: any;
}>;
/**
 * Visual styles: the house look a film's colour script, style frames and generated images follow. The default is a
 * soft, clean, 2.5D minimalism: simple shapes with rounded edges, gentle depth from soft shadows and layered planes,
 * matte surfaces with a hint of clay without its texture, soft light and a small harmonious palette. It is chosen to be
 * beautiful and still simple enough for the library to draw with layered shapes, soft gradients, blurred shadows and a
 * little parallax. A style's `look` and `avoid` are added to every image prompt in code, so a model cannot drop them.
 */
export const VISUAL_STYLES: Readonly<{
    'soft-minimal-2.5d': Readonly<{
        name: "Soft 2.5D minimalism";
        look: "soft 2.5D minimalist motion-graphics illustration: every shape is slightly raised, like smooth matte paper or soft clay cut-outs resting just above the background, each casting a soft diffuse shadow beneath it; lines and curves become soft rounded ribbons with a gentle highlight along their top edge; simple geometric shapes with softly rounded corners; light from the top left; subtle depth between a few layered planes; smooth soft gradients; no clay texture; a small harmonious palette with one warm accent; generous negative space; calm, artistic and beautiful";
        keywords: readonly string[];
        avoid: "flat vector look, hard thin hairlines, photorealism, realistic human faces or skin, fine texture, film grain or noise, clutter, busy backgrounds, glossy plastic, hyper-detailed 3D render, lens flares, text unless it is asked for";
        useCase: "stylized-concept";
        drawable: "layered shapes with rounded corners, soft linear and radial gradients, blurred offset shadows, thick rounded strokes with a highlight stroke, a little parallax between planes and soft glows for emphasis";
    }>;
    'flat-vector': Readonly<{
        name: "Flat vector";
        look: "flat vector motion-graphics illustration, simple shapes, clean thin lines, solid fills, no shading, small palette, generous negative space";
        keywords: readonly string[];
        avoid: "photorealism, texture, gradients, shadows, 3D, clutter, text unless it is asked for";
        drawable: "solid-filled shapes and strokes";
    }>;
}>;
export const DEFAULT_STYLE: "soft-minimal-2.5d";
export const LOOK_PRINCIPLES: any;
export const PALETTE_ROLES: readonly string[];
export const designLook: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
/** Editorial thresholds for the look gate. */
export const LOOK_GATE: Readonly<{
    maxPalette: 6;
    minTextContrast: 4.5;
    peakIntensity: 0.7;
    minPeakContrast: 3;
}>;
export const lookMeasures: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
