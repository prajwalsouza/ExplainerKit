// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * @typedef {Object} SpringTimingOptions
 * @property {number} [mass]
 * @property {number} [stiffness]
 * @property {number} [damping]
 * @property {number} [velocity]
 * @property {number} [epsilon]
 * @property {number} [rest]
 * @property {number} [maxDuration]
 */
/**
 * Derive finite native track timing from a normalized analytic spring.
 * Seconds throughout. Authoring performs at most 3001 analytic samples, at
 * 20 ms intervals; playback performs one analytic evaluation per easing call.
 * This is sampled settling, not a guarantee about every intervening instant.
 *
 * @param {SpringTimingOptions} [spec]
 * @returns {Readonly<{duration:number,ease:(progress:number)=>number}>}
 */
export function springTiming(spec?: SpringTimingOptions): Readonly<{
    duration: number;
    ease: (progress: number) => number;
}>;
export type SpringTimingOptions = {
    mass?: number | undefined;
    stiffness?: number | undefined;
    damping?: number | undefined;
    velocity?: number | undefined;
    epsilon?: number | undefined;
    rest?: number | undefined;
    maxDuration?: number | undefined;
};
