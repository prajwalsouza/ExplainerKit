// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene,Derived} from '../core/scene.js';
import type {Parameter} from '../core/data.js';
type Handle=ReturnType<Scene['shape']>;
type Input=number|Parameter|Derived;
export interface Face {readonly id:string;readonly piece:number|null;readonly interior:boolean;readonly visible:boolean;readonly normal:readonly number[];readonly depth:number;readonly points:readonly(readonly number[])[];readonly fill:string;}
export interface PolyhedronOptions {kind?:'cube'|'icosahedron';width?:Input;yaw?:Input;pitch?:Input;roll?:Input;light?:number[];ramp?:string[];}
export interface Polyhedron {readonly handle:Handle;readonly inputs:Readonly<{width:Parameter|Derived;yaw:Parameter|Derived;pitch:Parameter|Derived;roll:Parameter|Derived}>;readonly faceCount:number;facesAt(sample?:{time?:number;width?:number;height?:number}):readonly Face[];}
export interface SplitPiece {readonly side:'positive'|'negative';readonly offset:Parameter;facesAt(sample?:{time?:number;width?:number;height?:number}):readonly Face[];}
export interface SplitPolyhedron extends Polyhedron {readonly pieces:readonly SplitPiece[];}
export interface MutablePolyhedron extends Omit<Polyhedron,'inputs'> {readonly inputs:Readonly<{width:Parameter;yaw:Parameter;pitch:Parameter;roll:Parameter}>;}
export type MutablePolyhedronOptions=Omit<PolyhedronOptions,'width'|'yaw'|'pitch'|'roll'>&{width?:number|Parameter;yaw?:number|Parameter;pitch?:number|Parameter;roll?:number|Parameter};
export function polyhedron(scene:Scene,options?:MutablePolyhedronOptions):MutablePolyhedron;
export function polyhedron(scene:Scene,options:PolyhedronOptions):Polyhedron;
export function split<T extends Polyhedron>(source:T,options?:{plane?:{normal?:number[];offset?:number};interior?:string}):T&SplitPolyhedron;
