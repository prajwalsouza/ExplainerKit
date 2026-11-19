// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Plan a flight. `route` is an optional list of {x, z} places to pass in scene coordinates;
 * without one the planner tours the junctions of the model. `height` is the cruising height in
 * metres, `clearance` the distance kept from walls and trees, `speed` in metres a second.
 * Returns {duration, length, minClearance, climbs, pose(time)}; a pose is {position, target,
 * roll, fov, speed} with roll in radians, positive banking to the right.
 */
export function planFlyby(city: any, spec?: {}): Readonly<{
    duration: any;
    length: number | undefined;
    minClearance: number;
    climbs: number;
    /** The planned path as scene points, for drawing or checking. */
    points: readonly Readonly<{
        x: any;
        y: any;
        z: number;
    }>[];
    pose(time: any): Readonly<{
        position: readonly any[];
        target: readonly any[];
        roll: number;
        fov: any;
        speed: number;
    }>;
}>;
