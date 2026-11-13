// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface FamilyBody {width?:number;length?:number;height?:number;color?:string;pattern?:'plain'|'spots'|'stripe';}
export interface QuadrupedOptions {name?:string;body?:FamilyBody;neck?:{length?:number;rise?:number;width?:number};legs?:{length?:number;joints?:2|3;width?:number};tail?:{length?:number;width?:number};head?:{width?:number;height?:number};ears?:{length?:number;width?:number};}
export interface WingedOptions {name?:string;body?:FamilyBody;wings?:{pairs?:1|2;shape?:'ellipse'|'leaf'|'feather';frequency?:number;span?:number;chord?:number};legs?:0|2|4|6|{count?:0|2|4|6;length?:number;width?:number};}
export interface JumperOptions {name?:string;body?:FamilyBody;legs?:{hind?:number;fore?:number;width?:number};}
/** Shares the existing raw character definition, action, keyed-pose and audit contract. */
export interface FamilyDefinition {name:string;rig:string;height:number;palette:Record<string,unknown>;bones:Record<string,unknown>;parts:any[];rest:Record<string,number>;actions:Record<string,Function>;actionDefaults:Record<string,Record<string,number>>;contacts:string[];joints:any[];sockets:Record<string,unknown>;meta:Readonly<{author:string;license:string;family:string;parameters:unknown}>;light:number[];}
export function quadruped(options?:QuadrupedOptions):FamilyDefinition;
export function winged(options?:WingedOptions):FamilyDefinition;
export function jumper(options?:JumperOptions):FamilyDefinition;
export function cow(options?:QuadrupedOptions):FamilyDefinition;
export function mouse(options?:QuadrupedOptions):FamilyDefinition;
export function dragonfly(options?:WingedOptions):FamilyDefinition;
export function frog(options?:JumperOptions):FamilyDefinition;
export const FAMILY_PRESETS:Readonly<Record<'cow'|'mouse'|'dragonfly'|'frog',Readonly<{family:'quadruped'|'winged'|'jumper';options:Readonly<Record<string,unknown>>}>>>;
