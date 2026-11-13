// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Color} from './space.js';
export function colorInterpolator(from:string,to:string,spec?:{space?:'srgb'|'linearRGB'}):(t:number)=>string;
export function mix(from:Color,to:Color,t:number,spec?:{space?:'hsla'|'srgb'|'linearRGB';hue?:'shorter'|'longer'|'increasing'|'decreasing'}):string;
