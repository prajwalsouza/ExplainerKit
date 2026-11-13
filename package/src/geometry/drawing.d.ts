// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type DrawingCommand = readonly [string,...number[]];
export type DrawingPath = ReadonlyArray<DrawingCommand>;
export interface DrawingPoint {readonly x:number;readonly y:number;readonly z?:number;}
export interface DrawingOptions {tolerance?:number;maxPoints?:number;}
export interface MeasuredContour {readonly length:number;readonly closed:boolean;readonly points:ReadonlyArray<Readonly<{x:number;y:number}>>;at(fraction:number):Readonly<{x:number;y:number;rotation:number}>;trim(start?:number,end?:number):DrawingPath;}
export class Line {
 constructor(commands:DrawingPath,spec?:DrawingOptions);
 readonly contours:ReadonlyArray<MeasuredContour>;
 readonly length:number;
 readonly closed:boolean;
 at(fraction:number):Readonly<{x:number;y:number;rotation:number;contour:number}>;
 trim(start?:number,end?:number):DrawingPath;
}
export function outlineDraw(commands:DrawingPath,spec?:DrawingOptions&{progress?:number;mode?:'length'|'each'}):DrawingPath;
export function samplePath(commands:DrawingPath,count:number,spec?:DrawingOptions):ReadonlyArray<Readonly<{x:number;y:number}>>;
export function pairPoints(from:ReadonlyArray<DrawingPoint>,to:ReadonlyArray<DrawingPoint>,spec?:{by?:'x'|'nearest'|'arc'}):ReadonlyArray<Readonly<{from:DrawingPoint;to:DrawingPoint;fromIndex:number;toIndex:number}>>;
export function inkStroke(commands:DrawingPath,spec?:{width?:number|((fraction:number)=>number);taper?:number;tremor?:number;seed?:number;samples?:number;tolerance?:number}):DrawingPath;
