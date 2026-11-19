// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Seeded 2D gradient noise in [-1, 1]. Zero at integer coordinates; no visible lattice. */
export function gradientNoise2(x: any, y: any, spec?: {}): number;
/** Seeded 3D gradient noise in [-1, 1]. Use z as time for a field that drifts. */
export function gradientNoise3(x: any, y: any, z: any, spec?: {}): number;
declare function sample2(x: any, y: any, seed: any): number;
declare function sample3(x: any, y: any, z: any, seed: any): number;
export { sample2 as gradientRaw2, sample3 as gradientRaw3 };
