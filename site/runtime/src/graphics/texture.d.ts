// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type TextureKind='grain'|'paper'|'halftone'|'hatch'|'paint'|'brush';
export interface TextureOptions {type?:'texture';kind?:TextureKind;scale?:number;amount?:number;seed?:number;color?:string;space?:'shape'|'screen';colors?:ReadonlyArray<string>;direction?:number;frequency?:number;}
export interface TextureDescriptor {readonly type:'texture';readonly kind:TextureKind;readonly scale:number;readonly amount:number;readonly seed:number;readonly color:string;readonly space:'shape'|'screen';readonly colors?:ReadonlyArray<string>;readonly direction?:number;readonly frequency?:number;}
export function texture(spec?:TextureOptions):TextureDescriptor;
export function validateTexture(value:TextureOptions|null):TextureDescriptor|null;
export function textureTile(value:TextureOptions):Readonly<{size:number;cells:ReadonlyArray<Readonly<{x:number;y:number;alpha:number;color?:string}>>}>;
export function paint(spec?:{kind?:'noise'|'brush';colors?:ReadonlyArray<string>;direction?:number;frequency?:number;scale?:number;amount?:number;seed?:number;space?:'shape'|'screen'}):TextureDescriptor;
