// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface SkeletonPoint {readonly x:number;readonly y:number;}
export interface SkeletonRoot extends SkeletonPoint {readonly rotation:number;}
export interface SkeletonBone {id:string;parent?:string|null;length:number;angle?:number;limits?:readonly [number,number];}
export interface CompiledSkeletonBone {readonly id:string;readonly parent:string|null;readonly length:number;readonly angle:number;readonly limits:readonly [number,number];}
export interface SkeletonSpec {bones:readonly SkeletonBone[];root?:Partial<SkeletonRoot>;}
export interface SkeletonBonePose {readonly id:string;readonly parent:string|null;readonly start:SkeletonPoint;readonly end:SkeletonPoint;readonly rotation:number;readonly angle:number;readonly length:number;readonly scale:number;}
export interface SkeletonPose {readonly root:SkeletonRoot;readonly angles:Readonly<Record<string,number>>;readonly scale:Readonly<Record<string,number>>;readonly bones:readonly SkeletonBonePose[];}
export interface SkeletonPoseOptions {angles?:Readonly<Record<string,number>>;root?:Partial<SkeletonRoot>;scale?:Readonly<Record<string,number>>;}
export interface SkeletonSolveOptions {end:string;target:SkeletonPoint;from?:SkeletonPose;chainRoot?:string;iterations?:number;tolerance?:number;restarts?:number;unreachable?:'report'|'error';}
export type SkeletonSolveStatus='converged'|'unreachable'|'stalled'|'iterationLimit';
export interface SkeletonSolution {readonly pose:SkeletonPose;readonly target:SkeletonPoint;readonly error:number;readonly converged:boolean;readonly withinReach:boolean;readonly status:SkeletonSolveStatus;readonly iterations:number;}
export interface SkeletonGoal {id?:string;end:string;target?:SkeletonPoint;rotation?:number;weight?:number;rotationWeight?:number;priority?:number;chainRoot?:string;pole?:SkeletonPoint;poleWeight?:number;stretch?:number;compress?:number;softness?:number;}
export interface SkeletonGoalsOptions {goals:readonly SkeletonGoal[];from?:SkeletonPose;iterations?:number;restarts?:number;tolerance?:number;angleTolerance?:number;priorityTolerance?:number;unreachable?:'report'|'error';}
export interface SkeletonGoalError {readonly id:string;readonly end:string;readonly priority:number;readonly weight:number;readonly error:number|null;readonly effectiveError:number|null;readonly target:SkeletonPoint|null;readonly effectiveTarget:SkeletonPoint|null;readonly scale:number;readonly softness:number;readonly rotationError:number|null;readonly poleError:number|null;readonly converged:boolean;readonly withinReach:boolean|null;}
export interface SkeletonGoalsSolution {readonly pose:SkeletonPose;readonly converged:boolean;readonly status:SkeletonSolveStatus;readonly iterations:number;readonly goals:readonly SkeletonGoalError[];readonly priorityCosts:readonly Readonly<{priority:number;cost:number}>[];readonly diagnostics:Readonly<Record<string,unknown>>;}
export interface SkeletonModel {
 readonly bones:readonly CompiledSkeletonBone[];
 pose(options?:SkeletonPoseOptions):SkeletonPose;
 solve(options:SkeletonSolveOptions):SkeletonSolution;
 blend(a:SkeletonPose,b:SkeletonPose,mix:number):SkeletonPose;
 socket(pose:SkeletonPose,bone:string,options?:{along?:number;offset?:number;rotation?:number}):Readonly<SkeletonRoot>;
 solveGoals(options:SkeletonGoalsOptions):SkeletonGoalsSolution;
}
export function skeleton(options:SkeletonSpec):Readonly<SkeletonModel>;
