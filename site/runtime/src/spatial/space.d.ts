// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Longitude/latitude (radians) on a sheet that curls into a sphere. At wrap 0 the sheet is the flat
 * equirectangular plane z=radius; at wrap 1 it is the sphere. In between it lies on a sphere of radius
 * radius/wrap that touches the plane at (0,0), so distances along the equator and meridian are kept and
 * the map rolls up instead of shrinking through the globe. bend:'linear' keeps the straight blend.
 */
export function wrapPoint(lon: any, lat: any, radius: any, wrap: any, bend?: string): {
    point: {
        x: number;
        y: number;
        z: any;
    };
    normal: {
        x: number;
        y: number;
        z: number;
    };
};
/** A line-art spatial construction sharing the parent scene's inputs and timeline. */
export function createSpace(scene: any, spec?: {}): Readonly<{
    readonly camera: any;
    setCamera(next: any): void;
    points(vertices: any, localSpec11?: {}): Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    polyline(vertices: any, localSpec12?: {}): Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    instance(field: any, shape: any, instanceSpec?: {}): Readonly<{
        handle: any;
        count: any;
        nodeCount: any;
        sample(time?: number): readonly Readonly<{
            indices: any;
            depths: any;
        }>[];
    }>;
    mesh: (geometry: any, localSpec6?: {}) => Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    sphereLines(shape?: {}, localSpec13?: {}): Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    box(shape?: {}, localSpec14?: {}): Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    surface: (localSpec8?: {}) => Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    mapLines: (lines: any, localSpec9?: {}) => Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    cloud: (points: any, localSpec10?: {}) => Readonly<{
        id: any;
        node: any;
    }>;
    extrude(points: any, depth: any, localSpec15?: {}): Readonly<{
        id: any;
        node: any;
        parameters: any;
        sample: (time?: number) => {
            geometry: Readonly<{
                vertices: any;
                edges: any;
            }>;
            transform: {};
            matrix: any;
        };
        layers: (time: any) => {
            back: any;
            depth: number;
            commands: any;
            stroke: any;
            strokeWidth: any;
            strokeLinecap: any;
            opacity: any;
        }[];
        set(patch: any): /*elided*/ any;
        to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
        bind(key: any, binding: any): /*elided*/ any;
        unbind(key: any): /*elided*/ any;
        clearAnimation(key: any): /*elided*/ any;
    }>;
    geometry(time?: number): Readonly<{
        vertices: any;
        edges: any;
    }>;
    readonly objects: readonly any[];
}>;
