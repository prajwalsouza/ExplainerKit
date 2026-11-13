// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {PoseKey,FollowOptions} from './runtime.js';
export interface MeasuredPoseTrack {protocol:'explainerkit.pose/2';samples:readonly {t:number;confidence?:number;facing?:1|-1;pose:Record<string,any>|null}[];summary?:unknown;runs?:unknown;}
export type PoseCamera=readonly number[]|readonly (readonly number[])[]|((seconds:number)=>unknown)|{view:(context:{time:number})=>unknown}|{sample:(seconds:number)=>unknown}|{matrix:readonly number[]}|{samples:readonly Record<string,unknown>[]} ;
export interface PoseTrackOptions {rig:any;size?:number;ground?:number|((seconds:number,x:number)=>number)|{yAt:(x:number)=>number}|readonly (readonly [number,number])[];camera?:PoseCamera;confidence?:number;facing?:1|-1;labels?:Partial<Record<'handF'|'handB'|'footF'|'footB',string>>;}
export interface ConvertedPoseTrack {readonly keys:readonly PoseKey[];readonly rootTrack:readonly (readonly [number,number,number])[];readonly followOptions:Readonly<FollowOptions>;readonly diagnostics:Readonly<{accepted:number;partial:number;skipped:readonly Readonly<{time:number;reason:string}>[];rootConvention:string;size:number}>;}
export function keysFromPoseTrack(track:MeasuredPoseTrack,options:PoseTrackOptions):ConvertedPoseTrack;
