// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type CommonEffectName = 'typewriter' | 'wipe' | 'flyIn' | 'pulse' | 'teeter' | 'colorFlash';
export type EffectDirection = 'left' | 'right' | 'up' | 'down';
export type CommonEffectOptions = {
  typewriter: {text:string; locale?:string};
  wipe: {width:number; height:number; x?:number; y?:number; direction?:EffectDirection};
  flyIn: {x?:number; y?:number; opacity?:number; direction?:EffectDirection; distance?:number};
  pulse: {scaleX?:number; scaleY?:number; amount?:number};
  teeter: {rotation?:number; angle?:number};
  colorFlash: {fill:string; flash:string};
};
export type CommonEffectValues = {
  typewriter: {readonly text:string};
  wipe: {readonly clip:Readonly<{type:'rect';x:number;y:number;width:number;height:number;rx:number}>};
  flyIn: {readonly x:number;readonly y:number;readonly opacity:number};
  pulse: {readonly scaleX:number;readonly scaleY:number};
  teeter: {readonly rotation:number};
  colorFlash: {readonly fill:string};
};
export interface CommonEffect<N extends CommonEffectName = CommonEffectName> {
  readonly name: N;
  readonly at:number;
  readonly end:number;
  readonly channels:readonly string[];
  sample(time:number, reducedMotion?:boolean): Readonly<CommonEffectValues[N]>;
}
export function commonEffect<N extends CommonEffectName>(name:N, options:CommonEffectOptions[N] & {at?:number; duration?:number}): CommonEffect<N>;
export function bindCommonEffect<H extends {bind(property:string[], binding:{map:(context:{time:number})=>any}):unknown}>(handle:H, effect:CommonEffect, options?:{reducedMotion?:boolean}):H;
