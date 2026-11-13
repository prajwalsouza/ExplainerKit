// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Parameter} from '../core/data.js';
import type {ArrivalOptions,ArrivalState,ScrollPaceSample,ScrollPaceName} from '../player/pace.js';
export {scrollPace,arrivalPlan,arrivalTime,SCROLL_PACES,DEFAULT_PACE_BOUNDS,ARRIVALS} from '../player/pace.js';
export interface StoryControl {parameter:Parameter;min?:number;max?:number;step?:number;label:string;format?:(value:number)=>unknown;}
export interface PreparedStoryControl {readonly parameter:Parameter;readonly min:number;readonly max:number;readonly step:number;readonly label:string;readonly format:((value:number)=>unknown)|null;}
export interface StoryAct {id?:string;from?:number;to?:number;length?:number|`${number}px`|`${number}vh`;holds?:readonly {at:number;length?:number|`${number}px`|`${number}vh`;controls?:readonly StoryControl[]}[];}
export interface StorySample {readonly position:number;readonly time:number;readonly act:string;readonly index:number;readonly holding:boolean;readonly hold:number|null;readonly progress:number;}
export interface StoryTimeline {
 readonly duration:number;readonly length:number;
 readonly acts:readonly {readonly id:string;readonly index:number;readonly from:number;readonly to:number;readonly start:number;readonly end:number;readonly length:number;readonly holds:readonly {readonly at:number;readonly start:number;readonly end:number}[]}[];
 readonly spans:readonly {readonly start:number;readonly end:number;readonly from:number;readonly to:number;readonly index:number;readonly holding:boolean;readonly hold:number|null}[];
 readonly holds:readonly number[];
 sample(position:number):StorySample;positionAt(time:number,options?:{hold?:'start'|'center'|'end'}):number;
}
export type StoryCuePolicy='scrub'|'keep'|'undo'|'replay';
export interface StoryCueContext {
 readonly id:string;readonly at:number;readonly position:number;readonly time:number;readonly progress:number;readonly act:string;
 readonly direction:-1|0|1;readonly pace:ScrollPaceName;readonly velocity:number;readonly speed:number;
 readonly rushing:boolean;readonly phase:'enter'|'leave'|'scrub';readonly signal:AbortSignal;
}
export interface StoryCue {id?:string;at:string|number|Readonly<{time:number}>|Readonly<{position:number}>;enter:(context:StoryCueContext)=>void;leave?:(context:StoryCueContext)=>void;reverse?:StoryCuePolicy;}
export interface StoryHoldState {readonly act:string;readonly index:number;readonly hold:number;readonly at:number;readonly controls:readonly PreparedStoryControl[];}
export interface StoryOptions extends ArrivalOptions {
 acts:readonly StoryAct[];element?:HTMLElement;container?:Window|HTMLElement;sticky?:HTMLElement|false;
 smoothing?:number;snap?:false|'holds';snapDelay?:number;snapDistance?:number;
 onError?:(error:unknown)=>void;onAct?:(act:string,index:number)=>void;onProgress?:(act:string,progress:number,index:number)=>void;
 onHold?:(hold:StoryHoldState|null)=>void;reset?:boolean;reducedMotion?:'continuous'|'stills';steps?:string|ArrayLike<HTMLElement>;
 narrow?:number;holdControls?:boolean;cues?:readonly StoryCue[];
}
export interface Story {
 readonly timeline:StoryTimeline;readonly act:string|null;readonly hold:StoryHoldState|null;readonly disposed:boolean;
 readonly pace:ScrollPaceSample;readonly arrival:ArrivalState|null;
 refresh():Story|undefined;update(options?:{acts?:readonly StoryAct[]}):Story;dispose():void;seekTime(time:number,options?:{hold?:'start'|'center'|'end'}):Story;
}
/** The existing player protocol; callbacks remain owned by the caller's player. */
export interface StoryPlayer {
 readonly duration:number;readonly disposed:boolean;readonly driver:string|null;readonly element?:Element;
 seek(time:number,options?:{reset?:boolean;source?:string}):unknown;pause():unknown;setDriver(driver:string|null):unknown;
 on(name:string,listener:(...args:unknown[])=>void):()=>void;reportError(error:unknown):unknown;
}
export function storyTimeline(acts:readonly StoryAct[],options:{duration:number;viewportHeight?:number}):StoryTimeline;
export function attachStory(player:StoryPlayer,options:StoryOptions):Story;
export function holdControls(document:Document,controls:readonly PreparedStoryControl[],options?:{time?:number;onError?:(error:unknown)=>void}):Readonly<{element:HTMLDivElement;dispose():void}>;
