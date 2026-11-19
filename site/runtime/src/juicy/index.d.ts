// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A Verlet rope or rod: a stem, a stalk, a cable, a tail. `points` is its rest shape. Pinned
 * points never move unless you move them with pin(). `stiffness` is the spring pulling every point
 * toward its rest shape, in acceleration per unit of offset (0 is a loose rope), `bend` resists folding, `drag` couples it to the wind.
 */
export function softChain(spec?: {}): {
    readonly count: any;
    /** Point i as {x, y}. */
    point(i: any): {
        x: number;
        y: number;
    };
    points(): {
        x: number;
        y: number;
    }[];
    /** Velocity of point i in units per second, from the last step of length dt. */
    velocity(i: any, dt: any): {
        x: number;
        y: number;
    };
    /** How stretched the chain is, as the largest relative link error after the last step. */
    readonly tension: number;
    /** Move a pinned point (for example the base of a stem in a moving scene). */
    pin(i: any, p: any): void;
    /**
     * Advance by dt seconds. `wind(x, y)` returns air velocity; drag pulls each point's velocity
     * toward it. `force` is an extra constant acceleration.
     */
    step(dt: any, s?: {}): /*elided*/ any;
    snapshot(): Readonly<{
        x: Float64Array<ArrayBuffer>;
        y: Float64Array<ArrayBuffer>;
        ox: Float64Array<ArrayBuffer>;
        oy: Float64Array<ArrayBuffer>;
        tension: number;
    }>;
    restore(s: any): /*elided*/ any;
};
/**
 * A small stable-fluids air field (after Jos Stam, 1999) over a width x height stage. splat()
 * pushes air, step() advects and projects it so a sweep rolls into eddies, and velocity()
 * reads it. `breeze` adds a steady drift plus coherent noise. Work per step is fixed by the grid.
 */
export function windField(spec?: {}): {
    readonly columns: number;
    readonly rows: number;
    /** Push air: a soft blob of velocity (units per second) applied on the next step. */
    splat(px: any, py: any, vx: any, vy: any, radius?: number): void;
    /** Air velocity at a point at time t (time only moves the breeze). */
    velocity(px: any, py: any, t?: number): {
        x: number;
        y: number;
    };
    /** How fast the air spins at a point, per second (positive is clockwise on a y-down stage). */
    curl(px: any, py: any): number;
    /** Total kinetic energy of the solved air, for tests and for fading effects out. */
    energy(): number;
    step(dt: any): /*elided*/ any;
    /** Mean divergence magnitude: near zero after a step means the air swirls instead of piling up. */
    divergence(): number;
    snapshot(): Readonly<{
        u: Float64Array<ArrayBuffer>;
        v: Float64Array<ArrayBuffer>;
        splats: any[];
    }>;
    restore(s: any): /*elided*/ any;
};
/**
 * A live spring follower: set target, call step(dt), read value. It overshoots and settles,
 * which makes hover, gaze and UI motion feel physical. Works on a number or a list of numbers.
 */
export function chaser(spec?: {}): {
    readonly value: any;
    readonly velocity: any;
    target: any;
    /** Jump to a value with no motion, for example after a cut. */
    snap(v: any): /*elided*/ any;
    /** Push it, as if struck. */
    kick(v: any): /*elided*/ any;
    readonly settled: any;
    step(dt: any): /*elided*/ any;
    snapshot: () => Readonly<{
        value: any;
        velocity: any[];
        target: any;
    }>;
    restore(s: any): /*elided*/ any;
};
/**
 * Volume-preserving squash and stretch from velocity. Returns the stretch along the motion,
 * the squash across it (their product is 1, so area is kept) and the motion angle in radians.
 */
export function squash(vx: any, vy: any, spec?: {}): Readonly<{
    along: number;
    across: number;
    angle: number;
}>;
/**
 * Overshoot-and-settle for arrivals and taps: 0 before age 0, then a value that springs past 1
 * and settles on it. Multiply a scale by it, or use 1 + (pop - 1) * k for a gentler pop.
 */
export function pop(age: any, spec?: {}): number;
/**
 * Idle sway in radians or units: a slow coherent wander, different for every index, so grass,
 * flowers and hanging things never move in step. Pure function of time.
 */
export function sway(t: any, spec?: {}): number;
/**
 * Accumulated-strain release: a thing lets go only after a visible pull. step(dt, pull) returns
 * true on the step it releases. `threshold` is the pull that builds strain and `hold` is how long,
 * in seconds, the pull must last.
 */
export function tug(spec?: {}): {
    readonly strain: number;
    readonly released: boolean;
    step(dt: any, pull: any): boolean;
    reset(): /*elided*/ any;
    snapshot: () => Readonly<{
        strain: number;
        released: boolean;
    }>;
    restore(s: any): /*elided*/ any;
};
/**
 * Screen shake driven by trauma: kick() adds trauma, it decays each step, and the offset scales
 * with trauma squared so small hits stay subtle. Smooth noise makes it rattle rather than jitter.
 */
export function trauma(spec?: {}): {
    readonly level: number;
    kick(amount: any): /*elided*/ any;
    step(dt: any): /*elided*/ any;
    /** The current offset: {x, y} in the distance's units and rotation in radians. */
    offset(): Readonly<{
        x: number;
        y: number;
        rotation: number;
    }>;
    snapshot: () => Readonly<{
        level: number;
        time: number;
    }>;
    restore(q: any): /*elided*/ any;
};
/**
 * Hit-stop: map real time to action time so the action freezes briefly at each impact. `hits`
 * is a list of {at, hold} in action time. Pure, so it works with seeking and export.
 */
export function hitstop(realTime: any, hits?: any[]): any;
