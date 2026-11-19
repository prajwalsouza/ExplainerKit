// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Validate an image and return it. Accepts {width, height, data} with RGBA floats. */
export function image(width: any, height: any, data: any): {
    width: any;
    height: any;
    data: any;
};
/** Convert 8-bit RGBA (for example canvas ImageData) to a float image. */
export function fromRGBA8(width: any, height: any, bytes: any): {
    width: any;
    height: any;
    data: any;
};
/** Convert a float image back to 8-bit RGBA, clamping to [0, 1]. */
export function toRGBA8(img: any): Uint8ClampedArray<any>;
/** A Gaussian-like blur of `radius` pixels (three box passes). */
export function blur(img: any, radius: any): {
    width: any;
    height: any;
    data: any;
};
/**
 * The tilt-shift miniature lens: one sharp band, blur growing above and below. `center`,
 * `halfWidth`, `falloff` and `maxBlur` are fractions of the frame height, as in the lens pack;
 * `angleDeg` tilts the band. Returns the image and the per-pixel blur (for sharp-only effects).
 */
export function tiltShift(img: any, spec?: {}): {
    image: {
        width: any;
        height: any;
        data: any;
    };
    blur: Float32Array<ArrayBuffer>;
};
/**
 * Depth of field from a depth buffer (one value per pixel, any unit). Pixels at `focus` stay
 * sharp; blur grows to `maxBlur` (fraction of frame height) at `range` units away.
 */
export function depthOfField(img: any, depth: any, spec?: {}): {
    image: {
        width: any;
        height: any;
        data: any;
    };
    blur: Float32Array<ArrayBuffer>;
};
/**
 * Bloom: light from bright areas spreads into its surroundings. Pixels brighter than `threshold`
 * (or the pixels a `mask` marks, for selective bloom of rivers and screens) are blurred at
 * several sizes and added back with `strength`. `radius` is a fraction of the frame height.
 */
export function bloom(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/** Halation: a warm glow that film emulsion throws around bright highlights. */
export function halation(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * Light rays (god rays): bright pixels smeared toward a light at `origin` (in pixels), each
 * sample weaker than the last. A radial blur after GPU Gems 3, chapter 13.
 */
export function lightRays(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * Motion blur from a velocity buffer: two values per pixel, the screen motion in pixels during
 * the shutter. Each pixel averages `samples` taps along its own motion.
 */
export function motionBlur(img: any, velocity: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/** Barrel (positive k1) or pincushion (negative k1) lens distortion around the frame centre. */
export function lensDistortion(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * Chromatic aberration: red and blue pulled apart toward the frame edge by `amount` (a fraction
 * of the frame diagonal). Give `blur` (per-pixel 0..1, as returned by tiltShift) to apply it only
 * where the image is sharp, so blurred areas do not turn green.
 */
export function chromaticAberration(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/** Darken toward the corners. `roundness` 1 is a circle, lower follows the frame's shape. */
export function vignette(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * The colour grade from a cinematic-look pack: split tone (a colour mixed into shadows and another
 * into highlights), saturation and contrast. Vignette, grain and aberration have their own steps.
 */
export function grade(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * Film grain: seeded per-pixel noise, strongest in the midtones. Change `frame` every frame so
 * the grain moves; the same seed and frame always give the same grain.
 */
export function grain(img: any, spec?: {}): {
    width: any;
    height: any;
    data: any;
};
/**
 * The finishing chain from the look pack, in its intended order: lens blur, bloom, grade,
 * vignette, sharp-only aberration, then grain. `lens` and `look` take the pack JSON objects.
 */
export function finishFrame(img: any, spec?: {}): any;
export const MAX_PIXELS: number;
