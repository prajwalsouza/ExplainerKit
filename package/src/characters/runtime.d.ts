// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MotionStylePreset,MotionStyleOptions,MotionStyle} from '../core/motion-style.js';
import type {Scene,Derived} from '../core/scene.js';
import type {Parameter} from '../core/data.js';
type Handle = ReturnType<Scene['shape']>;
export type CharacterLimb='armF'|'armB'|'legF'|'legB';
export type CharacterEffector='handF'|'handB'|'footF'|'footB';
export interface EffectorPose {target?:readonly [number,number];mix?:number;pole?:readonly [number,number];stretch?:number;compress?:number;softness?:number;}
export interface JointCharacterPose {joints?:Readonly<Partial<Record<CharacterLimb,readonly [number,number]>>>;effectors?:Readonly<Partial<Record<CharacterEffector,EffectorPose>>>;lean?:number;head?:number;hip?:readonly [number,number];'body.r'?:number;'body.x'?:number;'body.y'?:number;'body.sx'?:number;'body.sy'?:number;'head.r'?:number;}
export type FriendlyPose=Readonly<Record<string,number|readonly number[]>>|JointCharacterPose;
export interface SampledPoseEasing {type:'samples';times:readonly number[];values:readonly number[];}
export interface PoseKey {at:number;pose?:FriendlyPose|string;facing?:1|-1;ease?:string|SampledPoseEasing;hold?:number;duration?:number;turn?:{duration?:number;style?:'edge'};space?:'joints'|'targets';arc?:number;}
export interface PoseLayerOptions {weight?:number;fadeIn?:number;fadeOut?:number;until?:number;channels?:readonly string[];}
export type RootCoordinate={x:number;y:number};
export type RootAxisTrack=number|readonly (readonly [number,number])[]|((seconds:number)=>number)|{sample:(seconds:number)=>number}|Parameter|Derived;
export type RootTrack=RootAxisTrack|readonly (readonly [number,number,number])[]|((seconds:number)=>RootCoordinate)|{sample:(seconds:number)=>RootCoordinate}|{x:RootAxisTrack;y?:RootAxisTrack};
export interface FollowOptions {feet?:'auto'|'none';step?:{threshold?:number;duration?:number;lift?:number;lead?:number;maxLead?:number};lean?:number|((velocity:number)=>number);weight?:number;}
export interface CharacterOptions {x?:number;y?:number;size?:number;height?:number|string;unit?:number;standOn?:unknown;facing?:1|-1;seed?:number;palette?:Record<string,unknown>;idle?:boolean;shade?:unknown;secondaryMotion?:boolean;motionStyle?:MotionStylePreset|MotionStyleOptions|MotionStyle;}
export interface FollowStep {readonly side:'F'|'B';readonly at:number;readonly end:number;readonly from:number|Readonly<RootCoordinate>;readonly to:number|Readonly<RootCoordinate>;readonly lift:number;}
export interface CharacterHandle {
 readonly id:string;readonly handle:Handle;readonly definition:any;
 pose(name:'stand'|'reach'|'brace'|'hands-on-hips'|'think'|'step-back'|'arms-up'|'hands-on-head',dials?:{crouch?:number;armHeight?:number;lean?:number}):JointCharacterPose;
 keys(keys:readonly PoseKey[],options?:PoseLayerOptions):CharacterHandle;
 follow(track:RootTrack,options?:FollowOptions):CharacterHandle;
 followPlan():Readonly<{rate:number;samples:number;duration:number;steps:readonly FollowStep[]}>|null;
 light(options?:{ambient?:number|Parameter|Derived;rim?:string;amount?:number|Parameter|Derived;direction?:readonly [number,number]}):CharacterHandle;
 proportions(options?:{headScale?:number|Parameter|Derived;limbWidth?:number|Parameter|Derived}):CharacterHandle;
 socket(name:string,time?:number):Readonly<{x:number;y:number;rotation:number}>;
 hold(handle:Handle,options?:{hand?:'F'|'B';from?:number;to?:number;offset?:readonly [number,number];anchor?:readonly [number,number];align?:'hand'|'upright';blend?:number;release?:'freeze'|'authored'}):Readonly<{handle:Handle;from:number;to:number;dispose():void}>;
 inspect(time?:number):any;
 act(name:string,options?:Record<string,unknown>):CharacterHandle;
 move(name:string,options?:Record<string,unknown>):CharacterHandle;
 [otherMethod:string]:any;
}
export function character(scene:Scene,definition:any,options?:CharacterOptions):CharacterHandle;
export function compileCharacter(definition:any):any;
export function solveBones(definition:any,pose:any):any;
export function boneToRoot(world:any,bone:any,x:number,y:number):number[];
export function blend(pose:any,key:string,value:number,weight:number):void;
export function add(pose:any,key:string,value:number,weight?:number):void;
