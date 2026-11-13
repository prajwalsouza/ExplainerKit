// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** @typedef {{pan?:readonly [number,number],zoom?:number,rotation?:number}} DriftSpec */
/** @typedef {{x:number,y:number,width:number,height:number}} Region */
/** @typedef {{at:number,duration?:number,frame?:string|Region,region?:string|Region,to?:string|Region,cut?:string|Region,cutTo?:string|Region,whipPan?:string|Region,zoomThrough?:any,ease?:string|((progress:number)=>number),padding?:number,rotation?:number,start?:'center'|'top'|'bottom'|'left'|'right',drift?:DriftSpec}} CameraShot */
export function captureDrift(spec?: {}): Readonly<{
    x: any;
    y: any;
    zoom: number;
    rotation: any;
}>;
export function driftAt(time: any, shots: any, globalDrift?: Readonly<{
    x: 0;
    y: 0;
    zoom: 0;
    rotation: 0;
}>): {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
};
/** Validate the complete list before the Camera adopts any rule. */
export function captureShots(scene: any, input: any): readonly Readonly<{
    kind: string;
    target: any;
    at: any;
    duration: any;
    end: any;
    curve: any;
    start: any;
    padding: any;
    rotation: any;
    drift: Readonly<{
        x: any;
        y: any;
        zoom: number;
        rotation: any;
    }> | null;
}>[];
export function sampleChoreography(scene: any, shots: any, globalDrift: any, context: any, base: any, frame: any, overlays: any): any;
export type DriftSpec = {
    pan?: readonly [number, number];
    zoom?: number;
    rotation?: number;
};
export type Region = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type CameraShot = {
    at: number;
    duration?: number;
    frame?: string | Region;
    region?: string | Region;
    to?: string | Region;
    cut?: string | Region;
    cutTo?: string | Region;
    whipPan?: string | Region;
    zoomThrough?: any;
    ease?: string | ((progress: number) => number);
    padding?: number;
    rotation?: number;
    start?: "center" | "top" | "bottom" | "left" | "right";
    drift?: DriftSpec;
};
