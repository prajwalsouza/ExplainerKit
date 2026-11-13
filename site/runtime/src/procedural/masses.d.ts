// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene,Derived} from '../core/scene.js';
import type {Ambient} from '../core/ambient.js';
export interface MassBounds {x?:number;y?:number;width:number;height:number;}
export interface WindOptions {amplitude?:number;period?:number;ambient?:Ambient|Derived;}
export interface MassResult {readonly handle:ReturnType<Scene['instance']>;readonly count:number;readonly nodeCount:number;readonly ambient:Ambient|Derived;readonly bounds:Readonly<Required<MassBounds>>;readonly period:number;}
export function grassMass(scene:Scene,bounds:MassBounds,spec?:{density?:number;colors?:ReadonlyArray<string>;wind?:WindOptions;seed?:number;tag?:string}):MassResult;
export function foliageCluster(scene:Scene,bounds:MassBounds,spec?:{leaves?:number;colors?:ReadonlyArray<string>;depth?:number;wind?:WindOptions;seed?:number;tag?:string}):MassResult;
export function glowLight(scene:Scene,bounds:MassBounds,spec?:{color?:string;opacity?:number;tag?:string}):ReturnType<Scene['circle']>;
