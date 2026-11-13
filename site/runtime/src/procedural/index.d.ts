// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene} from '../core/scene.js';

export type Scalar = number | string | boolean | null;
export type Commands = readonly (readonly (number | string)[])[];
export interface Point {readonly i:number; readonly x:number; readonly y:number; readonly rand:number; readonly rand2:number; readonly rand3:number; readonly rand4:number;}
export interface PointSet<T extends Record<string,Scalar> = {}> {
  readonly count:number; readonly seed:number; readonly x:Float32Array; readonly y:Float32Array;
  readonly diagnostics:Readonly<Record<string,unknown>>;
  rand(index:number,channel?:number):number;
  sample(time?:number):readonly Readonly<Point & T>[];
}
export type Region = {rect:readonly [number,number,number,number]} | {circle:readonly [number,number,number]} | {polygon:Commands} | ReturnType<Scene['circle']>;
export interface PointNetwork {
  nodes: readonly (readonly [number,number] | Readonly<{x:number;y:number}>)[];
  edges: readonly (readonly [number,number])[];
}
export interface PointOptions {seed?:number; count?:number; density?:number; in?:Region; method?:'random'|'poisson'|'grid'|'hex'; minDistance?:number; along?:Commands; spacing?:number; jitter?:number; tolerance?:number; maxDistance?:never; junctions?:never; offset?:never; alternate?:never;}
export interface DensityPointOptions extends Omit<PointOptions,'density'|'method'|'along'|'spacing'|'jitter'|'tolerance'|'maxDistance'> {
  in:Region; density:(x:number,y:number)=>number;method:'poisson';minDistance:number;maxDistance?:number;
  along?:never;spacing?:never;jitter?:never;tolerance?:never;
}
interface NetworkPointBase extends Pick<PointOptions,'seed'|'count'|'jitter'|'tolerance'> {
  spacing:number;junctions?:boolean;offset?:number;alternate?:boolean;
  in?:never;density?:never;method?:never;minDistance?:never;maxDistance?:never;
}
export interface NetworkPointOptions extends NetworkPointBase {along:readonly Commands[]|PointNetwork;}
export type NetworkPathPointOptions = NetworkPointBase & {along:Commands} & ({junctions:boolean}|{offset:number}|{alternate:boolean});
export function points(options:DensityPointOptions):PointSet<{spacing:number}>;
export function points(options:NetworkPointOptions):PointSet<{rotation:number;edge:number;junction:boolean}>;
export function points(options:NetworkPathPointOptions):PointSet<{rotation:number;edge:number;junction:boolean}>;
export function points(options:PointOptions):PointSet;
type Column<T extends Record<string,Scalar>> = Scalar | readonly Scalar[] | ((point:Readonly<Point & T>,time:number)=>Scalar);
type Value<C> = C extends (...args:any[])=>infer R ? R : C extends readonly (infer R)[] ? R : C;
type Results<C> = {[K in keyof C]:Value<C[K]>};
export function attribute<T extends Record<string,Scalar>, C extends Record<string,Column<T>>>(field:PointSet<T>,columns:C):PointSet<Omit<T,keyof C> & Results<C>>;
export function attribute<T extends Record<string,Scalar>, K extends string, C extends Column<T>>(field:PointSet<T>,name:K,column:C):PointSet<Omit<T,K> & {[P in K]:Value<C>}>;
export interface Shape {type?:'dot'|'square'|'glow'|'sparkle'|'ring'|'tongue'|'blade'|'path'; r?:number; size?:number; width?:number; height?:number; wobble?:number; fill?:string; alpha?:number; rotation?:number; thickness?:number; commands?:Commands;}
export function instance<T extends Record<string,Scalar>>(scene:Scene,field:PointSet<T>,shape:Shape|((point:Readonly<Point & T>,time:number)=>Shape|Commands),options?:{batch?:'auto'|boolean;tag?:string;time?:import('../core/ambient.js').Ambient|import('../core/scene.js').Derived}):Readonly<{handle:ReturnType<Scene['instance']>;count:number;nodeCount:number;batches:readonly Readonly<{type:string;first:number;count:number}>[]}>;
export const distribution:Readonly<{
  fromSamples(values:readonly number[]|Float32Array|Float64Array):Readonly<{kind:'empirical';count:number;sample(u:number):number}>;
  fromHistogram(edges:readonly number[]|Float32Array|Float64Array,counts:readonly number[]|Float32Array|Float64Array):Readonly<{kind:'histogram';count:number;sample(u:number):number}>;
  pick<T extends string>(weights:Record<T,number>,u:number):T;
}>;
export function noiseField(options?:{seed?:number;scale?:number;speed?:number}):(x:number,y:number,time?:number)=>number;
export {noiseGrid} from '../noise/scalar.js';

export {grassMass,foliageCluster,glowLight} from './masses.js';
export type {SpatialField,SpatialPoint,SpatialCamera,BillboardResult} from './billboards.js';
export function instance(scene:Scene,field:import('./billboards.js').SpatialField,shape:import('./billboards.js').BillboardFactory,options:import('./billboards.js').BillboardOptions&{camera:import('./billboards.js').SpatialCamera|import('../core/scene.js').Derived|(()=>import('./billboards.js').SpatialCamera)}):import('./billboards.js').BillboardResult;
