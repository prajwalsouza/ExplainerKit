// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type MotionStylePreset='legacy'|'snappy-stick'|'classic';
export interface MotionPhysicsDefaults {lagHalfLife:number;jiggleFrequency:number;jiggleDamping:number;squashAmount:number;springMass:number;springStiffness:number;springDamping:number;}
export interface MotionStyleOptions {preset?:MotionStylePreset;beat?:number;hold?:{duration?:number;probability?:number};holdStill?:boolean;anticipation?:{probability?:number;amount?:number};overshoot?:{probability?:number;amount?:number};arcs?:number;interpolation?:'joints'|'targets';overlap?:number;idle?:number;stepping?:{duration?:number;threshold?:number;lift?:number};physics?:Partial<MotionPhysicsDefaults>;}
export interface MotionStyle {readonly name:MotionStylePreset;readonly beat:number;readonly hold:Readonly<{duration:number;probability:number}>;readonly holdStill:boolean;readonly anticipation:Readonly<{probability:number;amount:number}>;readonly overshoot:Readonly<{probability:number;amount:number}>;readonly arcs:number;readonly interpolation:'joints'|'targets';readonly overlap:number;readonly idle:number;readonly stepping:Readonly<{duration:number;threshold:number;lift:number}>;readonly physics:Readonly<MotionPhysicsDefaults>;}
export function resolveMotionStyle(input?:MotionStylePreset|MotionStyleOptions|MotionStyle):MotionStyle;
export const motionStyle:typeof resolveMotionStyle;
export const MOTION_STYLES:Readonly<Record<MotionStylePreset,Omit<MotionStyle,'name'>>>;
export function motionTransition(style?:MotionStylePreset|MotionStyleOptions|MotionStyle,seed?:number,index?:number):Readonly<{duration:number;hold:number;anticipation:number;overshoot:number;arc:number;overlap:number;interpolation:'joints'|'targets';ease:(progress:number)=>number}>;
export function motionHolds(input?:readonly (readonly [number,number])[]):readonly (readonly [number,number])[];
