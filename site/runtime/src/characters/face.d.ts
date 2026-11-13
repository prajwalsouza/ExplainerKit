// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Speech timeline for text at a rate in characters per second; returns shape weights at time t. */
export function speech(text: any, { at, rate }?: {
    at?: number | undefined;
    rate?: number | undefined;
}): any;
/**
 * Closed mouth outline. smile in [-1, 1] lifts or drops the corners; open/width/round as in MOUTH_SHAPES.
 * size is the neutral mouth width in character units.
 */
export function mouthPath(cx: any, cy: any, size: any, { open, width, round, smile }?: {
    open?: number | undefined;
    width?: number | undefined;
    round?: number | undefined;
    smile?: number | undefined;
}): any;
export function eyePath(cx: any, cy: any, rx: any, ry: any): any;
/** Pupil centred where the eye looks; look x/y in [-1, 1] of the available travel. */
export function pupilPath(cx: any, cy: any, rx: any, ry: any, r: any, look?: number[]): any;
/**
 * Upper lid covering the eye from the top down to closure c in [0, 1], with a slightly curved edge.
 * lower in [0, 1] raises a lower lid for squints and smiles. Clip to the eye outline.
 */
export function lidPath(cx: any, cy: any, rx: any, ry: any, closure?: number, lower?: number): any;
/**
 * A brow as a short rounded bar. raise moves it up (in thicknesses); tilt > 0 lifts the inner end (worry),
 * tilt < 0 drops it (anger). side is where the inner end sits: -1 left, 1 right.
 */
export function browPath(cx: any, cy: any, length: any, thickness: any, { raise, tilt, side }?: {
    raise?: number | undefined;
    tilt?: number | undefined;
    side?: number | undefined;
}): any;
/**
 * Mouth shapes after the Rhubarb Lip Sync / Preston Blair set (descriptions only; see
 * docs/research/character-animation.md). open: jaw opening, width: corner spread, round: pucker, teeth: upper teeth visible.
 */
export const MOUTH_SHAPES: any;
/** Expression presets: the face channels each mood sets. Bodies add their own pose on top. */
export const MOODS: any;
