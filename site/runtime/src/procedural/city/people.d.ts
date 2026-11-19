// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A complete description of one figure from a partial one. Everything left out takes the
 * plain default: an adult in a sweater and trousers with short hair. `colors` may fix any of
 * `top`, `bottom`, `skin`, `hair` and `accent` as library colours; a colour left out is chosen
 * per walker.
 */
export function personLook(spec?: {}): Readonly<{
    age: any;
    height: any;
    build: any;
    shoulders: any;
    hips: any;
    legs: any;
    head: any;
    top: any;
    sleeves: any;
    tucked: boolean;
    collar: boolean;
    bottom: any;
    length: any;
    shoes: any;
    hair: any;
    hat: any;
    scarf: boolean;
    hood: any;
    umbrella: boolean;
    bag: any;
    gloves: boolean;
    colors: Readonly<{}>;
}>;
/**
 * Where a figure's joints are, in model metres, from its body numbers. `height` is how tall
 * the model stands, which a renderer divides a walker's height by to get its scale.
 */
export function personRig(look: any): Readonly<{
    ankle: 0.085;
    knee: number;
    hip: number;
    waist: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    neck: number;
    neckTop: number;
    height: number;
    torso: number;
    legOffset: number;
}>;
/**
 * The pose of a figure at `phase` radians of its stride, one step per pi. `gait` holds
 * `step` (the length of a step in model metres), `swing` (how far the arms swing, 0 to 1.5)
 * and `lean` (how far the trunk leans forward, radians). Angles turn counter-clockwise seen
 * from the figure's left, so a positive thigh angle swings the leg forward.
 *
 * `act`, which may be the result of walkerPose, adds what a person does besides walking:
 * `arms` is [leftArm, leftElbow, leftWeight, rightArm, rightElbow, rightWeight], where each
 * weight from 0 to 1 says how far that arm leaves its swing for the given angles, and `head` is
 * [yaw, nod] in radians, a positive yaw turning the head to the figure's left.
 * @param {{arms?: readonly number[], head?: readonly number[]} | null} [act]
 */
export function personPose(phase: any, gait?: {}, rig?: Readonly<{
    ankle: 0.085;
    knee: number;
    hip: number;
    waist: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    neck: number;
    neckTop: number;
    height: number;
    torso: number;
    legOffset: number;
}>, act?: {
    arms?: readonly number[];
    head?: readonly number[];
} | null): {
    lift: number;
    chest: number;
    head: number;
    yaw: number;
    twist: number;
    sway: number;
    left: {
        thigh: number;
        knee: number;
        foot: any;
        arm: any;
        elbow: any;
    };
    right: {
        thigh: number;
        knee: number;
        foot: any;
        arm: any;
        elbow: any;
    };
    phase: any;
    step: any;
};
/**
 * The positions of a figure's vertices in a pose, as the renderer's vertex shader places
 * them. This is the reference for that shader and lets a figure be checked without drawing it.
 */
export function posePerson(mesh: any, pose: any, rig: any): Float32Array<any>;
/**
 * A figure from a look. Returns the full `mesh`, a simpler `far` mesh, the `rig` that says
 * where its joints are, and the completed `look`. Called with a number, as older code does,
 * it returns the plain default figure.
 */
export function personAsset(look?: {}, seed?: number): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    far: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    rig: Readonly<{
        ankle: 0.085;
        knee: number;
        hip: number;
        waist: number;
        shoulder: number;
        elbow: number;
        wrist: number;
        neck: number;
        neckTop: number;
        height: number;
        torso: number;
        legOffset: number;
    }>;
    look: Readonly<{
        age: any;
        height: any;
        build: any;
        shoulders: any;
        hips: any;
        legs: any;
        head: any;
        top: any;
        sleeves: any;
        tucked: boolean;
        collar: boolean;
        bottom: any;
        length: any;
        shoes: any;
        hair: any;
        hat: any;
        scarf: boolean;
        hood: any;
        umbrella: boolean;
        bag: any;
        gloves: boolean;
        colors: Readonly<{}>;
    }>;
};
/**
 * The five colours of one walker for a look: `top`, `bottom`, `skin`, `hair` and `accent`
 * (hat, scarf, bag and umbrella), each as sRGB red, green and blue from 0 to 1. Colours the
 * look fixes are kept; the rest are drawn from `PERSON_PAINT` by `seed` and `index`.
 */
export function personColors(look: any, seed?: number, index?: number): {};
/**
 * What the weather asks of clothes, from 0 to 1: `cold`, `rain` and `snow`. `weather` is a
 * name from `WEATHER`, a condition, or nothing; `season` is one of the city's seasons and
 * `style` a regional style or its name.
 */
export function personClimate({ weather, season, style }?: {
    weather?: null | undefined;
    season?: string | undefined;
    style?: null | undefined;
}): {
    cold: number;
    rain: number;
    snow: number;
};
/**
 * Choose a look for the situation: coats, hats and scarves when it is cold or snowing,
 * raincoats and umbrellas in rain, light clothes in summer. `variety` from 0 to 1 sets how
 * far a choice may stray from the likeliest one, and how much bodies differ. `wear` fixes any
 * field of the look. The same `seed` and `index` always give the same look.
 */
export function personWardrobe(spec?: {}): Readonly<{
    age: any;
    height: any;
    build: any;
    shoulders: any;
    hips: any;
    legs: any;
    head: any;
    top: any;
    sleeves: any;
    tucked: boolean;
    collar: boolean;
    bottom: any;
    length: any;
    shoes: any;
    hair: any;
    hat: any;
    scarf: boolean;
    hood: any;
    umbrella: boolean;
    bag: any;
    gloves: boolean;
    colors: Readonly<{}>;
}>;
/**
 * The numbers that make one walker move like no other, from a look and a seed. `noise` from
 * 0 to 1 scales every variation. `speed` is metres a second; `step` is the length of a step
 * in model metres at that speed; `swing` and `lean` are the arm swing and the forward lean;
 * `drift` is how far the speed wanders, with `driftRate` and `driftPhase`; `pause`, `rest`
 * and `pauseAt` are how often the walker stops, for how long, and when; `wander`,
 * `wanderRate` and `wanderPhase` move the walker from side to side on the pavement.
 */
export function personMotion(look: any, { seed, index, noise, pauses, gait, weather }?: {
    seed?: number | undefined;
    index?: number | undefined;
    noise?: number | undefined;
    pauses?: number | undefined;
    gait?: string | undefined;
    weather?: null | undefined;
}): {
    speed: number;
    step: number;
    swing: number;
    lean: number;
    gait: any;
    drift: number;
    driftRate: number;
    driftPhase: number;
    pause: number;
    rest: number;
    pauseAt: number;
    wander: number;
    wanderRate: number;
    wanderPhase: number;
    scale: number;
};
/**
 * The way one walker walks. `gait` is 'auto', a name from `PERSON_GAITS`, or an object that
 * names a `style` and overrides any of its numbers. With 'auto' the choice follows the look and
 * the weather: older people stroll or shuffle, children are jaunty, and rain or snow hurries
 * everyone. Returns {name, pace, step, swing, lean, pauses}.
 */
export function personGaitStyle(look: any, gait?: string, { seed, index, weather }?: {
    seed?: number | undefined;
    index?: number | undefined;
    weather?: null | undefined;
}): any;
/** The joints a vertex can turn about. Hems hang from the hips and are pushed out by the legs. */
export const personJoints: Readonly<{
    hips: 0;
    chest: 1;
    head: 2;
    thighLeft: 3;
    thighRight: 4;
    shinLeft: 5;
    shinRight: 6;
    footLeft: 7;
    footRight: 8;
    armLeft: 9;
    armRight: 10;
    forearmLeft: 11;
    forearmRight: 12;
    hem: 13;
}>;
export const personTops: readonly string[];
export const personBottoms: readonly string[];
export const personHair: readonly string[];
export const personHats: readonly string[];
export const personHoods: readonly string[];
export const personBags: readonly string[];
export const personShoes: readonly string[];
export const personAges: readonly string[];
/** The most triangles one figure may hold, near the camera and far from it. */
export const personBudget: Readonly<{
    near: 3000;
    far: 1200;
}>;
/** Ranges of the body numbers. Height is metres; the others are factors round 1. */
export const personRanges: Readonly<{
    height: number[];
    build: number[];
    shoulders: number[];
    hips: number[];
    legs: number[];
    head: number[];
    sleeves: number[];
    length: number[];
}>;
export const personGait: Readonly<{
    stance: 0.56;
    reach: 0.38;
    heel: 0.05;
    ball: 0.14;
    toeUp: 0.3;
    heelUp: 1.3;
    lift: 0.05;
    holdArm: 0.35;
    holdElbow: 2.1;
}>;
/** Coat and jacket colours: mostly dark and muted, with the odd bright one. Hue, saturation, lightness, weight. */
export const COAT_PAINT: readonly number[][];
/** The colours walkers are dressed from, by what the colour is for. */
export const PERSON_PAINT: Readonly<{
    coat: readonly number[][];
    knit: number[][];
    light: number[][];
    rain: number[][];
    legs: number[][];
    skirt: number[][];
    hair: number[][];
    grey: number[][];
    skin: number[][];
    accent: number[][];
    umbrella: number[][];
}>;
/**
 * Ways of walking. Each is a set of factors on a walker's own pace, step length and arm
 * swing, an added forward lean in radians, and how often it stops. A walker's habits (see
 * personMotion) still vary round the style, so two strollers never move alike.
 */
export const PERSON_GAITS: Readonly<{
    stroll: Readonly<{
        pace: 0.8;
        step: 0.9;
        swing: 0.7;
        lean: -0.01;
        pauses: 1.6;
    }>;
    ordinary: Readonly<{
        pace: 1;
        step: 1;
        swing: 1;
        lean: 0;
        pauses: 1;
    }>;
    brisk: Readonly<{
        pace: 1.2;
        step: 1.08;
        swing: 1.25;
        lean: 0.04;
        pauses: 0.4;
    }>;
    purposeful: Readonly<{
        pace: 1.1;
        step: 1.05;
        swing: 0.8;
        lean: 0.07;
        pauses: 0.3;
    }>;
    tired: Readonly<{
        pace: 0.75;
        step: 0.86;
        swing: 0.5;
        lean: 0.1;
        pauses: 1.3;
    }>;
    shuffle: Readonly<{
        pace: 0.6;
        step: 0.62;
        swing: 0.32;
        lean: 0.14;
        pauses: 1.8;
    }>;
    jaunty: Readonly<{
        pace: 1.05;
        step: 1.02;
        swing: 1.45;
        lean: -0.03;
        pauses: 0.8;
    }>;
}>;
export const personGaits: readonly string[];
