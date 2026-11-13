// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene,Derived} from '../core/scene.js';
import type {PointSet,Shape,Commands,Point,Scalar} from './index.js';
import type {perspectiveCamera,orthographicCamera} from '../spatial/camera.js';
export type SpatialCamera = ReturnType<typeof perspectiveCamera>|ReturnType<typeof orthographicCamera>;
export interface SpatialPoint {readonly x:number;readonly y:number;readonly z:number;readonly size?:number;readonly alpha?:number;readonly rotation?:number;}
export type SpatialField = ReadonlyArray<SpatialPoint>|PointSet<Record<string,Scalar>&{z:number}>|((time:number)=>ReadonlyArray<SpatialPoint>)|Derived;
export type BillboardFactory = Shape|Commands|((point:SpatialPoint&Partial<Point>&{i:number},time:number)=>Shape|Commands);
export interface BillboardOptions {batch?:'auto'|boolean;tag?:string;camera?:SpatialCamera|Derived|(()=>SpatialCamera);maxBatches?:number;}
export interface BillboardResult {readonly handle:ReturnType<Scene['instance']>;readonly count:number;readonly nodeCount:number;sample(time?:number):ReadonlyArray<Readonly<{indices:ReadonlyArray<number>;depths:ReadonlyArray<number>}>>;}
export function billboardInstance(scene:Scene,field:SpatialField,factory:BillboardFactory,camera:SpatialCamera|Derived|(()=>SpatialCamera),spec?:BillboardOptions):BillboardResult;
