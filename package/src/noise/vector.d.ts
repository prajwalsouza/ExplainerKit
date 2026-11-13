// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function seedValue(value?: number): number;
/** Integer-coordinate hash, implemented directly; no shared random state. */
export function randomAt(seed: any, index: any, channel?: number): number;
export function noise2(x: any, y: any, spec?: {}): any;
export function noise3(x: any, y: any, z: any, spec?: {}): any;
/** A bounded coherent vector field, addressed directly by coordinates and time. */
export function noiseField(spec?: {}): Readonly<{
    seed: number;
    frequency: any;
    amplitude: any;
    octaves: any;
    sample(point: any, time?: number): Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
}>;
/** Unchecked noise for hot loops whose inputs are already validated; seed must come from seedValue. */
export function noiseRaw(x: any, y: any, z: any, seed: any): any;
