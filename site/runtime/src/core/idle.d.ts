// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MotionStylePreset,MotionStyleOptions,MotionStyle} from './motion-style.js';
/**
 * Pure additive/multiplicative secondary motion layered on authored transforms.
 * @param {ReturnType<import('./scene.js').Scene['shape']>} handle
 * @param {{sway?:number|{amplitude?:number,period?:number,phase?:number},turn?:number|{amplitude?:number,period?:number,phase?:number},breathe?:number|{amplitude?:number,period?:number,phase?:number},weight?:number|import('./data.js').Parameter|Derived|Ambient,clock?:Ambient}} [spec]
 */
export function idle(handle: ReturnType<import("./scene.js").Scene["shape"]>, spec?: {
    sway?: number | {
        amplitude?: number;
        period?: number;
        phase?: number;
    };
    turn?: number | {
        amplitude?: number;
        period?: number;
        phase?: number;
    };
    breathe?: number | {
        amplitude?: number;
        period?: number;
        phase?: number;
    };
    weight?: number | import("./data.js").Parameter | Derived | Ambient;
    clock?: Ambient;
    motionStyle?:MotionStylePreset|MotionStyleOptions|MotionStyle;
    holds?:readonly (readonly [number,number])[];
}): Readonly<{
    /** @param {{at?:number,duration?:number,from?:number,to?:number|string,until?:number,end?:number,fade?:number,weight?:number,zoomThrough?:any,frame?:any}|[number,number]|Array<{at?:number,duration?:number,from?:number,to?:number|string,fade?:number,weight?:number,zoomThrough?:any,frame?:any}>} shotOrTimes */
    during(shotOrTimes: {
        at?: number;
        duration?: number;
        from?: number;
        to?: number | string;
        until?: number;
        end?: number;
        fade?: number;
        weight?: number;
        zoomThrough?: any;
        frame?: any;
    } | [number, number] | Array<{
        at?: number;
        duration?: number;
        from?: number;
        to?: number | string;
        fade?: number;
        weight?: number;
        zoomThrough?: any;
        frame?: any;
    }>): /*elided*/ any;
    dispose(): void;
}>;
import { Derived } from './scene.js';
import { Ambient } from './ambient.js';
