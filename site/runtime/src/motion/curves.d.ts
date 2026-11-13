// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Compile a standard motion curve. Progress is normalized; overshoot is retained.
 * @param {{family?:'power'|'sine'|'expo'|'circ'|'back'|'elastic'|'bounce',mode?:'in'|'out'|'inOut'|'outIn',power?:number}} [spec]
 * @returns {(progress:number)=>number}
 */
export function easingCurve(spec?: {
    family?: "power" | "sine" | "expo" | "circ" | "back" | "elastic" | "bounce";
    mode?: "in" | "out" | "inOut" | "outIn";
    power?: number;
}): (progress: number) => number;
/** Compile index-based spacing or delays, independent of DOM targets or clocks.
 * A scalar is a step; a two-number range spans the normalized distance.
 * @param {number|readonly [number,number]} value
 * @param {{from?:number|'first'|'center'|'last',grid?:readonly [number,number],axis?:'x'|'y',reverse?:boolean,ease?:(progress:number)=>number,start?:number,modifier?:(value:number)=>number}} [spec]
 * @returns {(index:number,count:number)=>number}
 */
export function stagger(value: number | readonly [number, number], spec?: {
    from?: number | "first" | "center" | "last";
    grid?: readonly [number, number];
    axis?: "x" | "y";
    reverse?: boolean;
    ease?: (progress: number) => number;
    start?: number;
    modifier?: (value: number) => number;
}): (index: number, count: number) => number;
export function isLibraryCurve(curve: any): boolean;
export function libraryCurveIdentity(curve: any): any;
