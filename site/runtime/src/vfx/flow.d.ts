// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Measure how a moving texture travels across footage, and which parts of the picture move at all.
 *
 * `frames` holds 2 to 600 decoded frames of one size in playback order, as gray or RGBA bytes. `fps` is their
 * rate. The result is a grid of windows with the motion at each in pixels a second (`u` to the right, `v` down),
 * a `trust` from 0 to 1 for how clearly each answer stood out, and a `state` for each window: 0 where nothing
 * could be read, 1 where the picture is still and 2 where it moves. Still windows are held at rest.
 *
 * The search distance, the number of frame pairs used and the camera check are chosen from the footage unless
 * given. A camera that shakes is corrected from the still parts of the picture. When the shake hides every
 * still part, the whole picture is used instead, as long as its motion jitters from one frame pair to the next.
 * `camera` is null when neither gives a reading. A camera that travels smears the field, which `camera.travels`
 * reports.
 */
export function measureFlow(frames: any, spec?: {}): any;
/** Copy and validate a saved flow field, such as the parsed JSON of a measured one, before sampling it. */
export function compileFlow(input: any): any;
/**
 * The motion at a point of the picture, in pixels a second, blended from the four nearest windows. Outside the
 * grid, and where the picture is still, the motion is zero. Pass `out` to reuse one object in a loop.
 */
export function sampleFlow(field: any, x: any, y: any, out?: {
    u: number;
    v: number;
}): any;
/**
 * The way something set down at `start` would be carried. The path is worked out once, in steps of `step`
 * seconds for up to `duration` seconds, and stops early where the flow falls below `stopBelow` pixels a second
 * or the path leaves the picture. `at(seconds)` gives the place at any time along it.
 */
export function traceFlow(field: any, start: any, spec?: {}): Readonly<{
    points: Float32Array<ArrayBuffer>;
    step: any;
    duration: number;
    /** The place `seconds` along the path. `done` is true once the path has ended. */
    at(seconds: any): {
        x: number;
        y: number;
        done: boolean;
    };
}>;
/**
 * Streaks that ride a flow field: specks set down on moving windows and carried along, each drawn as the line
 * through its last few places, so a streak is long where the motion is fast.
 *
 * The streaks are a function of time with no hidden state. `sample(seconds)` returns the same lines for the same
 * time, so they can be scrubbed, reversed and exported. `positions` holds `points` places for each streak, head
 * first, as x and y pairs, and `speed` holds each streak's speed at its head in pixels a second. Pass `amount`
 * from 0 to 1 to release only that share of the streaks.
 */
export function flowStreaks(field: any, spec?: {}): Readonly<{
    count: any;
    points: any;
    positions: Float32Array<ArrayBuffer>;
    speed: Float32Array<any>;
    /** The streaks at `seconds`. The returned arrays are reused by the next call. */
    sample(seconds: any, amount?: number): {
        positions: Float32Array<ArrayBuffer>;
        speed: Float32Array<any>;
        count: number;
        points: any;
    };
}>;
