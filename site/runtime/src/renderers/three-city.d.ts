// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Build the Three.js objects for a city model.
 *
 * Options: `weather` (a condition or a name from `weatherNames`), `paving` (one of
 * `pavingStyles`; by default it follows the model's palette), `shadowMapSize` (512 to 8192),
 * `shadowRange` (half-width in metres of the area that receives sun shadows), `reflections`
 * (false turns off the mirrored renders that wet roads and water use), `rainCount` and
 * `snowCount` (how many streaks and flakes exist), and `apron` (metres of plain ground drawn
 * beyond the model).
 *
 * Add `object` to your scene, call `update({time, camera})` once per frame before rendering,
 * and `setWeather(condition)` whenever the weather changes.
 */
export function cityScene(T: any, city: any, spec?: {}): {
    object: any;
    /** The fog for your scene: assign it to `scene.fog`. Its colour and density follow the weather. */
    fog: any;
    sun: any;
    ambient: any;
    readonly weather: any;
    stats: Readonly<{
        triangles: any;
        instances: number;
        lamps: any;
        plants: any;
        people: any;
    }>;
    quality: any;
    /** Apply a condition from explainerkit/procedural/city: a name, a condition or a blend. */
    setWeather(condition: any): /*elided*/ any;
    cloudSpeed: number;
    /**
     * Advance the scene to a time in seconds and follow a camera: the sky, the sun's shadow
     * area, the rain and the snow all stay centred on what the camera sees.
     */
    update(s?: {}): /*elided*/ any;
    /**
     * For frames averaged from many renders: call this from the post chain's `onSample` with
     * the sample index and count. Each sample then sees the sun from a slightly different point
     * on its disc and the scene at a slightly different moment, and the average has soft-edged
     * shadows and motion blur. `sunSize` is the angular radius of the light in degrees and
     * `shutter` the exposure time in seconds; pass 0 to leave either out.
     */
    filmSample(index: any, count: any, s?: {}): /*elided*/ any;
    dispose(): void;
};
/**
 * A lens for the miniature look: one sharp band across the frame, with the picture blurring
 * above and below it, as a tilt-shift lens renders a real street to look like a model. Pass
 * the result as `lens` to `cinematicPost`.
 *
 * `amount` runs from 0 (no blur) to 1 (strong); `center` is where the sharp band sits, from 0
 * at the top of the frame to 1 at the bottom; `width` is the height of the sharp band as a
 * share of the frame; `angle` tilts the band in degrees; `bloom` is the glow round bright
 * things, from 0 to 1.
 */
export function dioramaLens(spec?: {}): {
    interactive: {
        kind: string;
        center: any;
        halfWidth: number;
        falloff: number;
        maxBlur: number;
        angleDeg: any;
    };
    bloom: {
        threshold: number;
        strength: any;
    };
};
/**
 * Aim a camera for one sample of a thin lens. The camera moves to a point on a disc of radius
 * `aperture` metres round `position` and turns so that the point `focus` metres along the view
 * stays where it was. Averaged over many samples, things at the focus distance stay sharp and
 * everything nearer or farther blurs, as through a real lens. Call it from the post chain's
 * `onSample`; pass index -1 to put the camera back.
 */
export function thinLens(camera: any, view: any, index: any, count: any): any;
export const pavingStyles: readonly string[];
/**
 * The quality ladder. Each step says how much is drawn and how far away detail survives.
 * Distances are metres from the camera: within `near` trees use their full model, `small` and
 * `medium` are where small and medium street objects stop being drawn, `fine` is how far
 * railings and other small building parts reach, `cover` how far grass and flowers reach and
 * `people` how far walkers are shown and `peopleNear` how far they keep their full figure. `reflection` scales the mirrored renders. 'draft' and
 * 'live' are meant for interactive pages, 'high' for strong machines and stills, and 'film' for
 * frames rendered one at a time, where speed does not matter.
 */
export const CITY_QUALITY: Readonly<{
    draft: Readonly<{
        skyRays: 0;
        traceSteps: 0;
        shadowMapSize: 1024;
        reflection: 0.35;
        near: 40;
        small: 60;
        medium: 140;
        fine: 80;
        cover: 0;
        people: 70;
        peopleNear: 14;
        rain: 5000;
        snow: 4000;
    }>;
    live: Readonly<{
        skyRays: 2;
        traceSteps: 8;
        shadowMapSize: 2048;
        reflection: 0.5;
        near: 75;
        small: 110;
        medium: 260;
        fine: 170;
        cover: 60;
        people: 140;
        peopleNear: 32;
        rain: 12000;
        snow: 8000;
    }>;
    high: Readonly<{
        skyRays: 4;
        traceSteps: 14;
        shadowMapSize: 4096;
        reflection: 0.75;
        near: 130;
        small: 220;
        medium: 520;
        fine: 340;
        cover: 120;
        people: 240;
        peopleNear: 70;
        rain: 20000;
        snow: 12000;
    }>;
    film: Readonly<{
        skyRays: 1;
        traceSteps: 24;
        shadowMapSize: 8192;
        reflection: 1;
        near: 320;
        small: 600;
        medium: 3000;
        fine: 1200;
        cover: 260;
        people: 800;
        peopleNear: 260;
        rain: 30000;
        snow: 18000;
    }>;
}>;
export const cityQualities: readonly string[];
