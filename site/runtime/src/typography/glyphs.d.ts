// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene,Derived} from '../core/scene.js';
import type {Parameter,DataSource} from '../core/data.js';
import type {Ambient} from '../core/ambient.js';
import type {parseFont} from '../import/font.js';
import type {lattice} from '../geometry/deform.js';
type Handle = ReturnType<Scene['shape']>;
export interface GlyphEdit {at?:number;duration?:number;ease?:keyof typeof import('../core/timing.js').easings|((progress:number)=>number);}
export type GlyphSymbol='='|'+'|'−'|'×';
export type GlyphRemoval=GlyphEdit&({style?:'shrink';fade?:never;close?:never}|{style:'fadeThenClose';fade?:number;close?:number});
export type GlyphGap=number|Parameter|Derived|Ambient|{inputs?:readonly (Parameter|Derived|Ambient|DataSource)[];map:(...values:any[])=>number};
export interface GlyphOptions {font:ReturnType<typeof parseFont>;size?:number;x?:number;y?:number;fill?:unknown;letterSpacing?:number;missing?:'error'|'notdef';}
export interface GlyphState {readonly id:number;readonly handle:Handle;readonly character:string;readonly x:number;readonly opacity:number;readonly scaleX:number;readonly advance:number;}
export interface GlyphSample {readonly time:number;readonly text:string;readonly width:number;readonly glyphs:readonly GlyphState[];readonly revision:number;}
export interface GlyphLatticeOptions {columns?:number;rows?:number;bounds?:{x:number;y:number;width:number;height:number};subdivisions?:number;maxPoints?:number;}
export interface GlyphLine {
 readonly group:Handle;
 readonly handles:readonly Handle[];
 readonly characters:readonly string[];
 sample(time?:number):GlyphSample;
 insert(index:number,text:string,options?:GlyphEdit):GlyphLine;
 remove(index:number,options?:GlyphRemoval):GlyphLine;
 morph(index:number,symbol:GlyphSymbol,options?:GlyphEdit):GlyphLine;
 clone(index:number,options?:{at?:number}):Handle;
 detach(index:number|Handle,options?:GlyphEdit):Handle;
 attach(handle:Handle,index:number,options?:GlyphEdit):GlyphLine;
 gap(index:number,width:GlyphGap):GlyphLine;
 to(text:string,options?:GlyphEdit&{swap?:'instant'|'grow';pivots?:readonly string[]}):GlyphLine;
 parts(index:number):readonly Handle[];
 deform(index:number,options?:GlyphLatticeOptions):ReturnType<typeof lattice>;
}
export function glyphs(scene:Scene,text:string,options:GlyphOptions):GlyphLine;
