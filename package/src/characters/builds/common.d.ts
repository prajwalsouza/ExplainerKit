// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Three tones per slot: base, shade (away from the light) and light (toward it). */
export function tone(base: any, shade: any, light: any): any;
/**
 * A rubber-hose limb from a to b with total length L: a single smooth curve that bends like two equal
 * segments solved by IK (the knee or elbow sits where two L/2 segments meet), on the side given by bend (±1).
 */
export function hose(a: any, b: any, L: any, bend: any, controls?: {}): any;
export function hoseFromSolution(a: any, solved: any): any;
/** Face parts on a head bone. eyes: [[x,y],...] in character space at rest; all in head-local after compile. */
export function faceParts({ bone, origin, eyes, eyeRx, eyeRy, pupil, brows, browY, browLength, browThickness, mouth, mouthSize, cheeks, turn, z, lidSlot, }: {
    bone: any;
    origin: any;
    eyes: any;
    eyeRx: any;
    eyeRy: any;
    pupil: any;
    brows?: boolean | undefined;
    browY: any;
    browLength?: number | undefined;
    browThickness?: number | undefined;
    mouth: any;
    mouthSize: any;
    cheeks?: null | undefined;
    turn?: number | undefined;
    z?: number | undefined;
    lidSlot?: string | undefined;
}): ({
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
})[];
/** Idle life shared by every rig: blinks, small eye darts, slow breathing. Additive, so actions sit on top. */
export function idleFace(pose: any, t: any, seed: any): void;
export function breathe(pose: any, t: any, seed: any, bone?: string, amount?: number, period?: number): void;
export const faceRest: any;
export { boneToRoot };
import { boneToRoot } from '../runtime.js';
