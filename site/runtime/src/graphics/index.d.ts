// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function strokeDasharray(value: any): any;
export function fillRule(value: any): any;
export function pathCommands(value: any): any;
/** All resource coordinates are in the owning node's local coordinate system. */
export function clipRect(spec?: {}): any;
export function clipCircle(spec?: {}): any;
/** @param {{commands:Array<Array<string|number>>,fillRule?:'nonzero'|'evenodd',units?:'user'|'bounds'}} spec */
export function clipPath(spec?: {
    commands: Array<Array<string | number>>;
    fillRule?: "nonzero" | "evenodd";
    units?: "user" | "bounds";
}): any;
export function validateClip(value: any): any;
/** @param {{x1?:number,y1?:number,x2:number,y2?:number,stops:{offset:number,color:string}[],units?:'user'|'bounds'}} spec */
export function linearGradient(spec?: {
    x1?: number;
    y1?: number;
    x2: number;
    y2?: number;
    stops: {
        offset: number;
        color: string;
    }[];
    units?: "user" | "bounds";
}): Readonly<{
    units?: "bounds" | undefined;
    type: "linear";
    x1: any;
    y1: any;
    x2: any;
    y2: any;
    stops: any;
}>;
export function radialGradient(spec?: {}): Readonly<{
    type: "radial";
    x: any;
    y: any;
    r: any;
    stops: any;
}>;
export function validatePaint(value: any): any;
export { solidColor as color } from "../color/space.js";
export { texture, textureTile, paint } from "./texture.js";
