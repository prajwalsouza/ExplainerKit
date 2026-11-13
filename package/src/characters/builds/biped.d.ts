// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * The shared biped action library: walk and run (Williams's contact, down, passing, up with planted feet),
 * hop with anticipation and squash, and common poses. Any rig with channels handF/handB/footF/footB
 * (character space), body.x/y/r/sx/sy, head.r/turn and the face channels can use it.
 * L: {HIP, SHOULDER: {F, B}, FOOT_REST: {F, B}, arm (arm length / 54), stride, runStride, chin: [x, y]}.
 */
export function bipedActions(L: any): {
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
/**
 * Compass-gait pelvis drop: lower the hips just enough that every foot is within leg reach, so legs never
 * over-stretch and planted feet never float (L.leg is hip-to-ankle length, L.ankle the ankle height). Rigs
 * also expose it as `reach`, which the runtime calls after placing the feet on an uneven surface.
 */
export function bipedReach(L: any): (pose: any) => void;
export function bipedDefaults({ speed, runSpeed, hop }?: {
    speed?: number | undefined;
    runSpeed?: number | undefined;
    hop?: number | undefined;
}): {
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
