// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Resolve a condition into numbers a renderer can use directly: colours as linear RGB triples
 * and the sun as a unit direction toward the light (x east, y up, z south).
 */
export function resolveWeather(input: any): any;
/**
 * Blend two conditions. `t` runs from 0 (all `a`) to 1 (all `b`). The sun turns the short way
 * round, and surfaces dry or freeze at their own pace: `t` is used as given, so ease it first
 * if the change should start gently.
 */
export function mixWeather(a: any, b: any, t: any): {
    resolved: boolean;
    sun: {
        azimuth: any;
        elevation: any;
        direction: number[];
        color: any[];
        intensity: any;
    };
    sky: {
        zenith: any[];
        horizon: any[];
        glow: any;
    };
    ambient: {
        sky: any[];
        ground: any[];
        intensity: any;
    };
    fog: {
        color: any[];
        density: any;
    };
    clouds: {
        cover: any;
        dark: any;
        speed: any;
    };
};
/**
 * A schedule of conditions over time: [{at, weather, ease?}], sorted by `at` in seconds. Returns
 * `at(time)`, the blended condition, a pure function of time so a shot can be scrubbed. Each
 * change takes `change` seconds (default 4) ending at its `at`.
 */
export function weatherSchedule(steps: any, spec?: {}): Readonly<{
    duration: any;
    at(time: any): any;
}>;
/**
 * The named conditions. Light levels are scene-referred and relative: 1 is a bright overcast
 * surface, and a clear noon sun is about 3. Angles are degrees: azimuth clockwise from north,
 * elevation above the horizon. Fog density is the optical depth at 100 metres under a
 * squared-exponential falloff: light kept at distance d is exp(-density * (d / 100)^2).
 */
export const WEATHER: any;
export const weatherNames: readonly string[];
