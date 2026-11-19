// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Choose interactive quality from frame times, as the quality pack describes: drop one setting
 * when the 75th-percentile frame time stays above 1.15 x budget for 30 frames, raise one back
 * when it stays below 0.7 x budget for 120 frames. Pure: give it frame times, read settings.
 */
export function qualityGovernor(quality: any, spec?: {}): {
    readonly tier: any;
    readonly settings: any;
    readonly level: number;
    /** Record one frame time in milliseconds. Returns 'drop', 'raise' or null when settings change. */
    record(ms: any): "drop" | "raise" | null;
};
/**
 * Camera poses from a list of shots: [{at, position:[x,y,z], target:[x,y,z], fov}]. Between
 * shots the camera eases. With reducedMotion the camera never flies: it holds each shot and
 * cuts at the midpoint of the move, as the quality pack asks.
 */
export function cameraShots(shots: any, spec?: {}): Readonly<{
    reducedMotion: boolean;
    pose(time: any): Readonly<{
        position: any;
        target: any;
        fov: any;
        moving: false;
    }> | Readonly<{
        position: any;
        target: any;
        fov: any;
        moving: true;
    }>;
}>;
/**
 * Build a cinematic relief map from a heightfield and a map style. Returns a Three group to add
 * to your scene, plus helpers to place things on the map and to animate it with setTime().
 *
 * Region coordinates are metres east (x) and north (y). The scene uses x east, y up and z south,
 * and `width` scene units span the region from west to east.
 */
export function reliefMap(T: any, spec?: {}): {
    group: any;
    sun: any;
    /** The terrain mesh geometry, read-only, for overlays such as mapHighlights(). */
    terrain: any;
    width: any;
    depth: number;
    /** Scene position of a region point; elevation defaults to the ground. */
    toScene: (x: any, y: any, elevation: any) => Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
    heightAt: (x: any, y: any) => number;
    /** Haze settings for scene.fog, from the rig's atmosphere. */
    fog(far: any): any;
    /**
     * The water surface along a river in scene units, with the drawn width at each point. Use it
     * to place things on the river or to highlight it with mapHighlights().
     */
    riverPath(id: any): any;
    /** Ground height in scene units at a scene position, including carved valleys and basins. */
    groundAt: (sx: any, sz: any) => number;
    /** Pose the map at `time`. Clouds drift; everything else is fixed. Pure in time. */
    setTime(time: any): void;
    dispose(): void;
};
/**
 * The finishing chain for cinematic shots: lens blur (tilt-shift band), selective bloom, ACES
 * tone mapping, split-tone grade, vignette, sharp-only colour fringing and grain, in that order.
 *
 * `mode: 'film'` (default) averages `samples` jittered renders per frame for clean edges and soft
 * shadows, and suits frame-by-frame export. `mode: 'interactive'` renders once per frame and,
 * when the caller reports the view is still, refines over up to 16 frames.
 */
export function cinematicPost(T: any, renderer: any, spec?: {}): {
    mode: any;
    readonly size: {
        width: any;
        height: any;
    };
    /** Samples accumulated so far for the current still view (interactive mode). */
    readonly stillSamples: number;
    /**
     * Render and finish one frame to the screen. In interactive mode pass `still: true` while
     * the camera and story clock are stopped; any frame with `still: false` resets refinement.
     * `onSample(index, count)` runs before each averaged render, so a scene can jitter its
     * light, lens or clock per sample.
     */
    render(scene: any, cam: any, s?: {}): any;
    setSize(w: any, h: any): void;
    /** Lens taps for the interactive tier (the quality governor's dofTaps). */
    setTaps(n: any): void;
    dispose(): void;
};
/**
 * Paint a laid-out document page into a 2D canvas context you own, using font outlines so the
 * page looks the same on every machine. `layout` is from layoutDocument(); `pxPerMm` sets the
 * texture resolution. Highlights are [{rects, drawn, color}] from highlightSchedule().
 */
export function paintDocument(ctx: any, layout: any, spec?: {}): void;
/**
 * The torn paper chip that carries a lifted phrase (the motion pack's `chip` mode). `rect` is
 * the phrase rectangle in millimetres; `texture` is an optional caller-made texture of the phrase.
 * Use applyLift() each frame to place it from a liftSchedule pose.
 */
export function liftChip(T: any, spec?: {}): {
    object: any;
    /** Place the chip from a liftSchedule pose, turning it toward `camera` by pose.faceCamera. */
    apply(pose: any, camera: any): void;
    dispose(): void;
};
/**
 * Highlights for a reliefMap: glowing or inked paths, regions that wash, dim the rest, hatch,
 * show contours, grow walls or lift out of the map, and places marked with rings, pins or
 * beacons. Add one with path(), area() or place(), pose them all with setTime(time).
 */
export function mapHighlights(T: any, map: any, spec?: {}): {
    group: any;
    kinds: Readonly<{
        path: readonly string[];
        area: readonly string[];
        place: readonly string[];
    }>;
    /**
     * Highlight a path: a river id or region points. Kinds: glow, trace, dash, pulse, ribbon.
     * Options: at, duration, out, outDuration, ease, color, width, height (ribbon), intensity.
     */
    path(name: any, points: any, s?: {}): /*elided*/ any;
    /**
     * Highlight an area given by a region outline. Kinds: outline, wash, spotlight, hatch,
     * contours, wall, raise. `raise` lifts the land inside the area up out of the map.
     */
    area(name: any, outline: any, s?: {}): /*elided*/ any;
    /** Mark a place: ring (ripples), pin (drops and bounces) or beacon (a beam of light). */
    place(name: any, at: any, s?: {}): /*elided*/ any;
    /** Pose every highlight at `time`. Pure in time, so seeking gives the same frame. */
    setTime(time: any): void;
    remove(name: any): void;
    dispose(): void;
};
export const HIGHLIGHT_KINDS: Readonly<{
    path: readonly string[];
    area: readonly string[];
    place: readonly string[];
}>;
