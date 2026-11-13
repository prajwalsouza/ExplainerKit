// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function record(value: any, keys: any, label: any): any;
export function pigment(value: any, fallback: any): any;
export function bodySpec(value: any, defaults: any): any;
export function basicPalette(color: any): {
    body: any;
    ink: any;
    mark: any;
    eye: any;
};
export function bodyParts(body: any, center: any, { round }?: {
    round?: boolean | undefined;
}): {
    id: string;
    bone: string;
    slot: string;
    commands: any;
    shade: boolean;
    encloses: boolean;
    z: number;
}[];
export function eyes(headX: any, headY: any, radius: any, bone?: string): {
    id: string;
    bone: string;
    slot: string;
    commands: any;
    shade: boolean;
    z: number;
}[];
/** Shared owned skeleton poses preserve historical two/three-link family seeds. */
export function sampleLegChain(a: any, b: any, length: any, joints: any, bend?: number, controls?: {}): Readonly<{
    commands: readonly any[];
    pose: any;
    diagnostics: any;
}>;
/** Compatibility geometry helper, now backed by the shared skeleton. */
export function legChain(a: any, b: any, length: any, joints: any, bend?: number, controls?: {}): readonly any[];
/** Resolve once before all family part drawing, keeping foot artwork on the solved endpoint. */
export function resolveFamilyLeg(pose: any, id: any, a: any, b: any, length: any, joints: any, bend: any, controls: any): Readonly<{
    commands: readonly any[];
    pose: any;
    diagnostics: any;
}>;
export function familyLegCommands(pose: any, id: any): any;
/** Quantised normalized phase avoids different floating-point reductions at t and t+n/f. */
export function cycle(time: any, frequency: any): number;
export function gaitFoot(distance: any, total: any, length: any, phase: any, lift: any): {
    x: number;
    y: number;
};
export function frozen(value: any): any;
export function unit(value: any): number;
export function ease(value: any): number;
