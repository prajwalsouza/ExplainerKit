// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Check a city model built by buildCity, with `walkerPose` from the same module. `times` are the moments at which moving things are
 * sampled, in seconds (at most 64). Returns {ok, issues, checked}: each issue has a `kind`, a
 * `count`, a plain `message` and up to twelve example places as {x, z} in model metres.
 */
export function auditCityModel(city: any, spec?: {}, walkerPose?: null): Readonly<{
    ok: boolean;
    issues: readonly any[];
    checked: Readonly<{
        meshes: number;
        objects: number;
        walkerSamples: number;
        vehicleSamples: number;
    }>;
}>;
