// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** H is degrees, S/L are percentages, A is unit alpha. */
export interface HSLA {readonly h:number; readonly s:number; readonly l:number; readonly a?:number;}
export type Color = string | HSLA;
export type RGBA = readonly [number,number,number,number];
export function hsla(h:number,s:number,l:number,a?:number):string;
export function fromRGBA(r:number,g:number,b:number,a?:number):Required<HSLA>;
export function hslaToRGBA(value:HSLA):RGBA;
export function toRGBA(value:Color):RGBA;
export function toHSLA(value:Color):Required<HSLA>;
export function toHex(value:Color):string;
export function toCSS(value:Color):string;
/** Replaces supplied channels; does not add offsets. */
export function adjust(value:Color,changes?:Partial<HSLA>):string;
export function solidColor(value:Color,options?:{stop?:boolean}):string;
export const namedColors:Readonly<Record<string,string>>;
