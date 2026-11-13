// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene} from '../core/scene.js';
import type {Parameter,DataSource} from '../core/data.js';
export type InputState='idle'|'requesting'|'running'|'interrupted'|'stopped'|'denied'|'unsupported'|'error'|'disposed';
export interface InputOptions {id?:string;kind?:'state'|'event';unit?:string;space?:string;maxSamples?:number;maxBytes?:number;maxAge?:number;clock?:()=>number;}
export interface InputQuality {readonly valid:boolean;readonly confidence:number|null;}
export interface InputObservation<T=unknown> {readonly source:string;readonly epoch:number;readonly sequence:number;readonly time:number;readonly receivedAt:number;readonly value:T;readonly unit:string;readonly space:string;readonly quality:InputQuality;}
export interface InputSnapshot<T=unknown> {readonly sourceId:string;readonly kind:'state'|'event';readonly status:InputState;readonly epoch:number;readonly sequence:number;readonly latest:InputObservation<T>|null;readonly age:number|null;readonly maxAge:number;readonly stale:boolean;readonly error:Readonly<{code:string;message:string}>|null;readonly dropped:number;readonly retained:number;readonly retainedBytes:number;}
export interface InputSource<T=unknown> {
 readonly sourceId:string;readonly kind:'state'|'event';readonly unit:string;readonly space:string;readonly maxAge:number;start():Promise<boolean>;stop():void;dispose():void;
 push(value:T,metadata?:{time?:number;valid?:boolean;confidence?:number|null}):InputObservation<T>;
 snapshot():InputSnapshot<T>;samples():readonly InputObservation<T>[];
 subscribe(listener:(snapshot:InputSnapshot<T>)=>void):()=>void;
}
export function inputSource<T=unknown>(options?:InputOptions):InputSource<T>;
export function mapInput<T,R>(source:InputSource<T>,map:(value:T,sample:InputObservation<T>)=>R,options?:InputOptions):InputSource<R>;
export function deriveInput<R>(sources:readonly InputSource<any>[],map:(samples:readonly InputObservation<any>[])=>R,options?:InputOptions):InputSource<R>;
export function smoothInput(source:InputSource<number>,options?:InputOptions&{halfLife?:number}):InputSource<number>;
export function thresholdInput(source:InputSource<number>,options:InputOptions&{above:number;below?:number;initial?:boolean}):InputSource<boolean>;
export interface InputBindingOptions {stale?:'release'|'hold';maxAge?:number;onError?:(error:unknown)=>void;player?:{readonly disposed:boolean;on(name:string,listener:()=>void):()=>void};}
export interface InputBinding {flush():boolean;dispose():void;snapshot():Readonly<{disposed:boolean;queued:boolean;error:Readonly<{code:string;message:string}>|null;commits:number;releases?:number;stale?:'release'|'hold'}>;}
export function bindInputs(scene:Scene,sources:readonly InputSource<any>[],mappings:readonly {parameter:Parameter;map:(samples:readonly InputObservation<any>[])=>number}[],options?:InputBindingOptions):InputBinding;
export function bindData(data:DataSource,source:InputSource<any>,options?:{map?:(sample:InputObservation<any>)=>readonly unknown[];onError?:(error:unknown)=>void;player?:InputBindingOptions['player']}):InputBinding;
export interface BrowserInputOptions extends Omit<InputOptions,'maxBytes'> {environment?:object;}
export interface PointerObservation {readonly x:number;readonly y:number;readonly nx:number;readonly ny:number;readonly buttons:number;readonly pressure:number;readonly pointerType:string;readonly active:boolean;}
export function pointerInput(element:Element,options?:BrowserInputOptions):InputSource<PointerObservation>;
export type HoverId=string|number;
export interface HoverTimerEnvironment<Handle=number> {setTimeout(callback:()=>void,milliseconds:number):Handle;clearTimeout(handle:Handle):void;}
export type HoverPointerObservation=Pick<PointerObservation,'x'|'y'|'active'|'pointerType'>&Partial<Pick<PointerObservation,'buttons'>>;
export interface HoverIntentOptions<Handle=number> extends Omit<InputOptions,'kind'|'unit'|'space'> {
 hit:(x:number,y:number)=>HoverId|null;
 /** Seconds. Defaults to .05; fastDwell defaults to .32; leave defaults to .14. */
 dwell?:number;fastDwell?:number;leave?:number;
 /** Upstream coordinate units per second. Default 1000. */
 speedThreshold?:number;
 environment?:HoverTimerEnvironment<Handle>;
}
export function hoverIntent<Handle=number>(pointer:InputSource<HoverPointerObservation>,options:HoverIntentOptions<Handle>):InputSource<HoverId|null>;
export function resizeInput(element:Element,options?:BrowserInputOptions):InputSource<Readonly<{width:number;height:number}>>;
export interface MotionVector {readonly x:number|null;readonly y:number|null;readonly z:number|null;}
export interface DeviceMotionObservation {readonly acceleration:MotionVector;readonly accelerationIncludingGravity:MotionVector;readonly rotationRate:Readonly<{alpha:number|null;beta:number|null;gamma:number|null}>;readonly interval:number|null;}
export interface DeviceOrientationObservation {readonly alpha:number|null;readonly beta:number|null;readonly gamma:number|null;readonly absolute:boolean|null;}
export function deviceMotionInput(options?:BrowserInputOptions):InputSource<DeviceMotionObservation>;
export function deviceOrientationInput(options?:BrowserInputOptions):InputSource<DeviceOrientationObservation>;
export interface InputFileOptions {format?:'auto'|'json'|'csv';maxBytes?:number;maxRows?:number;maxColumns?:number;delimiter?:string;}
export interface InputFileData {readonly name:string;readonly format:'json'|'csv';readonly rows:readonly Readonly<Record<string,unknown>|readonly unknown[]>[];}
export interface InputFileError {readonly name:string;readonly format:null;readonly rows:null;readonly error:Readonly<{code:string;message:string}>;}
export function readInputFile(file:Blob&{readonly name?:string},options?:InputFileOptions):Promise<InputFileData>;
export function fileInput(element:Element,options?:BrowserInputOptions&InputFileOptions):InputSource<InputFileData|InputFileError>;
/** A drag hovering over an element: position, item count and whether it carries files. Never reads contents. */
export interface DragObservation {readonly active:boolean;readonly x:number;readonly y:number;readonly nx:number;readonly ny:number;readonly items:number;readonly files:boolean;readonly dropped:boolean;}
export function dragInput(element:Element,options?:BrowserInputOptions):InputSource<DragObservation>;
export interface MediaInputOptions extends Omit<InputOptions,'kind'> {environment?:object;constraints?:boolean|Readonly<Record<string,unknown>>;fps?:number;}
export interface CameraObservation {readonly width:number;readonly height:number;readonly mediaTime:number;readonly frames:number;}
export interface MicrophoneObservation {readonly rms:number;readonly peak:number;readonly clippedSamples:number;readonly clippedShare:number;readonly sampleRate:number;readonly windowSamples:number;readonly bands?:readonly number[];readonly waveform?:readonly number[];}
export function cameraInput(video:HTMLVideoElement,options?:MediaInputOptions):InputSource<CameraObservation>;
export function microphoneInput(options?:MediaInputOptions&{fftSize?:number;clippingThreshold?:number;bands?:number;bandRange?:[number,number];waveform?:number}):InputSource<MicrophoneObservation>;
