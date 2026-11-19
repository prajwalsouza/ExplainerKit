// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * How a carriageway is shared out: which sides have room for a row of parked cars once the
 * moving lanes are kept clear. Returns {left, right} as 0 or 1, seen along the road's own
 * direction. The same answer places parked cars and positions the moving lanes, so the two
 * never overlap.
 */
export function parkingPlan(road: any, half: any, drive?: string): {
    left: number;
    right: number;
};
/**
 * Plan the traffic of a place: the lanes, the tracks, the stops, the signals and the vehicles.
 * `context` gives {bounds, seed, style, cars} from the city build, where `cars` lists each
 * drivable road with its half-width. Options: `cars`, `buses` and `trams` scale how many run
 * (0 to 4, 1 is typical, 0 none), `speed` scales every speed, `headway` is the time gap kept
 * to the vehicle ahead in seconds, and `signalCycle` is the length of a signal cycle in seconds.
 */
export function planTraffic(osm: any, context: any, spec?: {}): Readonly<{
    edges: readonly any[];
    nodes: readonly any[];
    vehicles: readonly any[];
    units: readonly any[];
    headway: any;
    cycle: any;
    seed: any;
    stats: Readonly<{
        lanes: number;
        tracks: number;
        cyclePaths: number;
        bikes: number;
        cars: number;
        buses: number;
        trams: number;
        signals: number;
    }>;
}>;
/**
 * Where every drawable unit of a traffic plan is at `time` seconds. Returns arrays with one
 * entry per unit of `plan.units`: `x` and `y` in map metres, `turn` as a heading in radians,
 * `travelled` in metres (for turning wheels), `speed` in metres per second and `visible`
 * (0 while a vehicle is outside the model). The same time always gives the same answer.
 */
export function trafficState(plan: any, time: any): {
    x: Float32Array<any>;
    y: Float32Array<any>;
    turn: Float32Array<any>;
    travelled: Float32Array<any>;
    speed: Float32Array<any>;
    visible: Uint8Array<any>;
    edge: Uint32Array<any>;
};
/**
 * The simulation's own record of each vehicle at `time`: which lane piece it is on (`edge`),
 * how far along it (`s`), its speed, how long it has stood waiting and whether it is in the
 * model. One entry per vehicle of `plan.vehicles`. Meant for checks and for flow displays.
 */
export function trafficVehicles(plan: any, time: any): any;
export const trafficLimits: Readonly<{
    vehicles: 600;
    edges: 20000;
    time: number;
}>;
/** Speed in km/h on a road whose limit the map does not give. */
export const DEFAULT_SPEEDS: Readonly<{
    motorway: 80;
    trunk: 60;
    primary: 50;
    secondary: 50;
    tertiary: 40;
    unclassified: 40;
    residential: 30;
    living_street: 12;
    busway: 40;
}>;
