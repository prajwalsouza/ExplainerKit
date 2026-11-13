// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene,Derived} from '../core/scene.js';
import type {Parameter} from '../core/data.js';
import type {SkeletonSpec,SkeletonModel,SkeletonGoal,SkeletonGoalsOptions,SkeletonSolveOptions} from './skeleton.js';
type Handle=ReturnType<Scene['shape']>;
type Value=number|Parameter;
export type SceneGoal=Omit<SkeletonGoal,'target'|'pole'|'rotation'|'stretch'|'compress'|'softness'>&{target?:{x:Value;y:Value};pole?:{x:Value;y:Value};rotation?:Value;stretch?:Value;compress?:Value;softness?:Value};
export type SceneGoalController=Omit<SceneGoal,'id'|'target'|'pole'|'rotation'|'stretch'|'compress'|'softness'>&{readonly id:string;readonly target?:Readonly<{x:Parameter;y:Parameter}>;readonly pole?:Readonly<{x:Parameter;y:Parameter}>;readonly rotation?:Parameter;readonly stretch?:Parameter;readonly compress?:Parameter;readonly softness?:Parameter};
export interface SkeletonRigSpec extends SkeletonSpec {stroke?:unknown;strokeWidth?:number;ik?:(Omit<SkeletonSolveOptions,'from'|'target'|'unreachable'>&{target:{x:Value;y:Value}});goals?:readonly SceneGoal[];solver?:Omit<SkeletonGoalsOptions,'goals'|'from'>;}
export interface SkeletonRig {readonly model:SkeletonModel;readonly group:Handle;readonly tag:string;readonly angles:Readonly<Record<string,Parameter>>;readonly root:Readonly<{x:Parameter;y:Parameter;rotation:Parameter}>;readonly fk:Derived;readonly pose:Derived;readonly target:Readonly<{x:Parameter;y:Parameter}>|null;readonly mix:Parameter|null;readonly solution:Derived|null;readonly goals:readonly SceneGoalController[]|null;socket(bone:string,options?:{along?:number;offset?:number;rotation?:number}):Derived;attach(handle:Handle,bone:string,options?:{along?:number;offset?:number;rotation?:number}):Handle;}
export function skeletonRig(scene:Scene,options:SkeletonRigSpec):Readonly<SkeletonRig>;
