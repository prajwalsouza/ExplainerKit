// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Analytic damped oscillator. Seconds and units/second; never frame-integrated. */
export function spring(spec?: {}): ((progress: any) => any) & {
    sample: (time: any) => any;
    velocity: (time: any) => any;
    state: (time: any) => Readonly<{
        value: any;
        velocity: any;
    }>;
    from: any;
    to: any;
    at: any;
    mass: any;
    stiffness: any;
    damping: any;
};
/** An explicit finite-duration easing. Normalized progress 1 lands exactly on target. */
export function springEasing(spec?: {}): (progress: any) => any;
/** Exponential drag release with optional inelastic bounds. No hidden simulation clock. */
export function inertia(spec?: {}): Readonly<{
    from: any;
    velocity0: any;
    at: any;
    friction: any;
    state: (time: any) => Readonly<{
        value: any;
        velocity: number;
        clamped: boolean;
    }>;
    sample: (time: any) => any;
    readonly target: number;
}>;
/** Fit pointer velocity over a short, bounded window for a release sampler. */
export function velocityTracker(spec?: {}): Readonly<{
    add(time: any, point: any): /*elided*/ any;
    sample(time?: any): Readonly<{
        x: any;
        y: any;
    }>;
    clear(): void;
    readonly size: number;
}>;
export { fall } from "./fall.js";
export { lag, jiggle, squashStretch } from "./secondary.js";
