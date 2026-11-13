// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Counter-addressed particles: time and seed completely determine the sample. */
export function emitter(spec?: {}): Readonly<{
    seed: number;
    rate: any;
    life: any;
    start: any;
    end: any;
    maxParticles: any;
    particle: (id: any, time: any) => Readonly<{
        id: any;
        birth: any;
        age: number;
        progress: number;
        life: any;
        position: Readonly<{}>;
        initialVelocity: Readonly<{
            [k: string]: any;
        }>;
    }> | null;
    sample: (time: any) => readonly Readonly<{
        id: any;
        birth: any;
        age: number;
        progress: number;
        life: any;
        position: Readonly<{}>;
        initialVelocity: Readonly<{
            [k: string]: any;
        }>;
    }>[];
    /**
     * Positions (x,y) plus optional radius/color, ready for scene.cloud({points}). Writes straight into typed
     * arrays with the same arithmetic as particle(), so 100k particles sample in a few milliseconds. The
     * object passed to radius/color functions is a light, unfrozen view: {id, age, progress, life, x, y}.
     */
    cloud(time: any, localSpec1?: {}): any;
    buffers(time: any): Readonly<{
        positions: Float32Array<ArrayBuffer>;
        ids: Uint32Array<ArrayBuffer>;
        count: number;
    }>;
}>;
export { noise2, noise3, noiseField } from "../noise/vector.js";
