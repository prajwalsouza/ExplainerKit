// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * The bean person: a cute 2.5-head biped with rubber-hose limbs, the explainer's everyman.
 * options: skin, palette (shirt/pants/shoe set), hair (color), hairStyle ('short' | 'bun' | 'curly' | 'none'),
 * accessory ('none' | 'glasses' | 'hardhat'), name.
 */
export function bean(spec?: {}): {
    reach: (pose: any) => void;
    poseLayout: {
        limbs: {
            [k: string]: {
                effector: string;
                lengths: number[];
                origin: any;
                bend: number;
            };
        };
        HIP: number[];
        SHOULDER: {
            F: number[];
            B: number[];
        };
        FOOT_REST: {
            F: number[];
            B: number[];
        };
        arm: number;
        stride: number;
        runStride: number;
        chin: number[];
        leg: number;
        ankle: number;
        hipX: {
            F: number;
            B: number;
        };
    };
    name: any;
    rig: string;
    height: number;
    palette: any;
    bones: {
        body: {
            parent: null;
            at: number[];
        };
        head: {
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
        stroke?: undefined;
        length?: undefined;
        stretch?: undefined;
        commands?: undefined;
        secondary?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        stroke: number;
        length: number;
        stretch: number;
        draw: (pose: any, world: any) => any;
        shade?: undefined;
        opacity?: undefined;
        commands?: undefined;
        secondary?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        draw: (pose: any) => any;
        shade?: undefined;
        opacity?: undefined;
        stroke?: undefined;
        length?: undefined;
        stretch?: undefined;
        commands?: undefined;
        secondary?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        commands: any;
        shade?: undefined;
        opacity?: undefined;
        draw?: undefined;
        stroke?: undefined;
        length?: undefined;
        stretch?: undefined;
        secondary?: undefined;
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
        stretch?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        stroke: number;
        draw: {};
        shade?: undefined;
        opacity?: undefined;
        length?: undefined;
        stretch?: undefined;
        commands?: undefined;
        secondary?: undefined;
    })[];
    rest: any;
    contacts: string[];
    joints: ({
        part: string;
        end: string;
        to: string[];
    } | {
        part: string;
        to: string[];
    })[];
    idle(pose: any, t: any, ctx: any): void;
    actions: {
        walk: (pose: any, u: any, params: any, c: any, w: any) => void;
        run(pose: any, u: any, params: any, c: any, w: any): void;
        hop(pose: any, u: any, params: any, c: any, w: any): void;
        wave(pose: any, u: any, params: any, c: any, w: any): void;
        point(pose: any, u: any, params: any, c: any, w: any): void;
        think(pose: any, u: any, params: any, c: any, w: any): void;
        cheer(pose: any, u: any, params: any, c: any, w: any): void;
        shrug(pose: any, u: any, params: any, c: any, w: any): void;
        present(pose: any, u: any, params: any, c: any, w: any): void;
        hold(pose: any, u: any, params: any, c: any, w: any): void;
        nod(pose: any, u: any, params: any, c: any, w: any): void;
        shake(pose: any, u: any, params: any, c: any, w: any): void;
    };
    actionDefaults: {
        walk: {
            speed: number;
        };
        run: {
            speed: number;
        };
        hop: {
            duration: number;
            height: number;
        };
        wave: {
            duration: number;
            hand: string;
        };
        point: {
            duration: number;
            x: number;
            y: number;
        };
        think: {
            duration: number;
        };
        cheer: {
            duration: number;
        };
        shrug: {
            duration: number;
        };
        present: {
            duration: number;
            side: string;
        };
        hold: {
            duration: number;
            twoHands: boolean;
        };
        nod: {
            duration: number;
        };
        shake: {
            duration: number;
        };
    };
    sockets: {
        handF: {
            channel: string;
            direction: {
                part: string;
            };
        };
        handB: {
            channel: string;
            direction: {
                part: string;
            };
        };
        footF: {
            channel: string;
        };
        footB: {
            channel: string;
        };
        hat: {
            part: string;
            at: number[];
        };
    };
    meta: any;
};
export const BEAN_PALETTES: any;
export const SKIN: any;
export const HAIR: any;
import { smoothClosed } from '../shapes.js';
import { lerp } from '../timing.js';
export { smoothClosed, lerp };
