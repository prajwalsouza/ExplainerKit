// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A round songbird in the explainer style: big eye, small beak, hops rather than walks. */
export function bird(spec?: {}): {
    name: any;
    rig: string;
    height: number;
    palette: any;
    contacts: string[];
    joints: ({
        part: string;
        end: string;
        to: string[];
    } | {
        part: string;
        to: string[];
        end?: undefined;
    })[];
    bones: {
        body: {
            parent: null;
            at: number[];
        };
        head: {
            parent: string;
            at: number[];
        };
        wingF: {
            parent: string;
            at: number[];
        };
        wingB: {
            parent: string;
            at: number[];
        };
        tail: {
            parent: string;
            at: number[];
        };
    };
    parts: ({
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        sharp: boolean;
        draw: (pose: any) => any;
        clip?: undefined;
        alpha?: undefined;
    } | {
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        draw: {};
        clip: (pose: any) => any;
        alpha: {};
        sharp?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        shade: boolean;
        opacity: number;
        draw: (pose: any) => any;
        commands?: undefined;
        secondary?: undefined;
        stroke?: undefined;
        length?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        opacity: number;
        commands: any;
        shade?: undefined;
        draw?: undefined;
        secondary?: undefined;
        stroke?: undefined;
        length?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        secondary: {
            driver: string;
        };
        commands: any;
        shade?: undefined;
        opacity?: undefined;
        draw?: undefined;
        stroke?: undefined;
        length?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        stroke: number;
        draw: (pose: any, world: any) => any;
        length: number;
        shade?: undefined;
        opacity?: undefined;
        commands?: undefined;
        secondary?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        stroke: number;
        draw: (pose: any) => any;
        shade?: undefined;
        opacity?: undefined;
        commands?: undefined;
        secondary?: undefined;
        length?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        commands: any;
        shade?: undefined;
        opacity?: undefined;
        draw?: undefined;
        secondary?: undefined;
        stroke?: undefined;
        length?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        draw: (pose: any) => any;
        shade?: undefined;
        opacity?: undefined;
        commands?: undefined;
        secondary?: undefined;
        stroke?: undefined;
        length?: undefined;
    })[];
    rest: any;
    post(pose: any, _time: any, context: any): void;
    idle(pose: any, t: any, ctx: any): void;
    actions: {
        walk(pose: any, u: any, params: any, c: any, w: any): void;
        hop(pose: any, u: any, params: any, c: any, w: any): void;
        flap(pose: any, u: any, params: any, c: any, w: any): void;
        fly(pose: any, u: any, params: any, c: any, w: any): void;
        peck(pose: any, u: any, params: any, c: any, w: any): void;
        sing(pose: any, u: any, params: any, c: any, w: any): void;
    };
    travelWarp: {
        walk: (d: any, p: any) => number;
    };
    actionDefaults: {
        walk: {
            speed: number;
            hopLength: number;
            height: number;
        };
        hop: {
            duration: number;
            height: number;
        };
        flap: {
            duration: number;
            rate: number;
            amount: number;
            lift: number;
        };
        fly: {
            duration: number;
            height: number;
            rate: number;
        };
        peck: {
            duration: number;
        };
        sing: {
            duration: number;
        };
    };
    sockets: {
        head: {
            part: string;
            at: number[];
        };
    };
    meta: any;
};
/**
 * A fish on a spine rig: a travelling wave whose amplitude grows toward the tail (carangiform swimming)
 * shapes the whole body each frame. The root sits at the body's centre, not on the ground.
 */
export function fish(spec?: {}): {
    name: any;
    rig: string;
    height: number;
    palette: any;
    bones: {
        head: {
            parent: null;
            at: number[];
        };
    };
    parts: ({
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        sharp: boolean;
        draw: (pose: any) => any;
        clip?: undefined;
        alpha?: undefined;
    } | {
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        draw: {};
        clip: (pose: any) => any;
        alpha: {};
        sharp?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        opacity: number;
        draw: (pose: any) => any;
        shade?: undefined;
        clip?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        draw: (pose: any) => any;
        opacity?: undefined;
        shade?: undefined;
        clip?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        shade: boolean;
        opacity: number;
        draw: (pose: any) => any;
        clip: (pose: any) => any;
    })[];
    rest: any;
    joints: {
        part: string;
        to: string[];
        depth: number;
    }[];
    post(pose: any): void;
    idle(pose: any, t: any, ctx: any): void;
    actions: {
        swim(pose: any, u: any, params: any, c: any, w: any): void;
        dart(pose: any, u: any, params: any, c: any, w: any): void;
        gulp(pose: any, u: any, params: any, c: any, w: any): void;
    };
    actionDefaults: {
        swim: {
            speed: number;
            waveLength: number;
            amplitude: number;
        };
        dart: {
            duration: number;
        };
        gulp: {
            duration: number;
        };
    };
    sockets: {};
    meta: any;
};
/** A friendly microbe: wobbling membrane, cilia, a flagellum that beats faster when it swims. */
export function microbe(spec?: {}): {
    name: any;
    rig: string;
    height: number;
    palette: any;
    bones: {
        face: {
            parent: null;
            at: number[];
        };
    };
    parts: ({
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        sharp: boolean;
        draw: (pose: any) => any;
        clip?: undefined;
        alpha?: undefined;
    } | {
        id: string;
        bone: any;
        z: number;
        slot: string;
        shade: boolean;
        draw: {};
        clip: (pose: any) => any;
        alpha: {};
        sharp?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        stroke: number;
        draw: (pose: any) => any;
        shade?: undefined;
        opacity?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        draw: (pose: any) => any;
        stroke?: undefined;
        shade?: undefined;
        opacity?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        shade: boolean;
        opacity: number;
        draw: (pose: any) => any;
        stroke?: undefined;
    })[];
    rest: any;
    idle(pose: any, t: any, ctx: any): void;
    actions: {
        swim(pose: any, u: any, params: any, c: any, w: any): void;
        pulse(pose: any, u: any, params: any, c: any, w: any): void;
        squish(pose: any, u: any, params: any, c: any, w: any): void;
    };
    actionDefaults: {
        swim: {
            speed: number;
        };
        pulse: {
            duration: number;
        };
        squish: {
            duration: number;
        };
    };
    sockets: {};
    meta: any;
};
export const BIRD_PALETTES: any;
export const FISH_PALETTES: any;
export const MICROBE_PALETTES: any;
