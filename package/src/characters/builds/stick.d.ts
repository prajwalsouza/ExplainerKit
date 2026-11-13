// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A stick person on a real two-bone IK rig: elbows bend back, knees bend forward, hands and feet are
 * targets. Shares the biped action library with the bean person, so every walk and pose works.
 * options: style ('classic' | 'xkcd' | 'bold' | 'pill' | 'heavy'), build ('standard' | 'chunky' | numbers), line,
 * ink, paper, skin, shirt, pants, face override.
 */
export function stick(spec?: {}): {
    name: any;
    rig: string;
    height: number;
    palette: {
        ink: any;
        paper: any;
        shirt: any;
        pants: any;
        headFill: any;
        skin: any;
        hair: any;
        shadow: any;
        eye: any;
        pupil: any;
        mouth: any;
        cheek: any;
        lid: any;
    };
    poseLayout: {
        limbs: {
            [k: string]: {
                effector: string;
                lengths: any[];
                origin: any;
                bend: number;
            };
        };
        HIP: any[];
        SHOULDER: {
            F: any[];
            B: any[];
        };
        FOOT_REST: {
            F: any[];
            B: number[];
        };
        handDrop: number;
        leg: any;
        ankle: number;
        minimumHipHeight: any;
        arm: number;
        stride: number;
        runStride: number;
        lift: number;
        runLift: number;
        bob: number;
        runBob: number;
        chin: number[];
    };
    bones: {
        body: {
            parent: null;
            at: any[];
        };
        head: {
            parent: string;
            at: any[];
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
        encloses?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        stroke: any;
        length: any;
        stretch: number;
        draw: (pose: any, world: any) => any;
        shade?: undefined;
        opacity?: undefined;
        commands?: undefined;
        encloses?: undefined;
    } | {
        id: string;
        bone: null;
        z: number;
        slot: string;
        shade: boolean;
        draw: (pose: any) => any;
        opacity?: undefined;
        stroke?: undefined;
        length?: undefined;
        stretch?: undefined;
        commands?: undefined;
        encloses?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        stroke: any;
        commands: any[][];
        shade?: undefined;
        opacity?: undefined;
        draw?: undefined;
        length?: undefined;
        stretch?: undefined;
        encloses?: undefined;
    } | {
        id: string;
        bone: string;
        z: number;
        slot: string;
        shade: boolean;
        commands: any;
        opacity?: undefined;
        draw?: undefined;
        stroke?: undefined;
        length?: undefined;
        stretch?: undefined;
        encloses?: undefined;
    } | {
        id: string;
        encloses: boolean;
        bone: string;
        z: number;
        slot: string;
        stroke: any;
        commands: any;
        shade?: undefined;
        opacity?: undefined;
        draw?: undefined;
        length?: undefined;
        stretch?: undefined;
    })[];
    rest: any;
    contacts: string[];
    joints: {
        part: string;
        end: string;
        to: string[];
    }[];
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
    reach: (pose: any) => void;
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
/**
 * Stick-figure styles. Proportions follow common stick-figure drawing guides, at the readable end:
 * about 5 heads tall, arms reaching mid-thigh, legs about half the height, joints at the halfway points.
 */
export const STICK_STYLES: any;
/**
 * Stick-figure proportions, on a figure 174 units tall. `standard` is about 5 heads tall with the hip just above
 * half height; `chunky` is the big-headed build of hand-animated stick fights, measured from reference frames:
 * about 3.2 heads tall (head radius 0.13 of the height at the stroke centre, stroke 0.05), hip at 40 % from the
 * ground, almost no neck and arms hanging to the hip. (Reference stances are wider still, about 0.3 of the height;
 * the shared run cycle sinks a foot that wide, so the build keeps 0.18.)
 * Pass `build: {...}` to override any number: headR, head (centre y), neck, shoulder, hip, upper, fore, thigh, shin.
 */
export const STICK_BUILDS: any;
