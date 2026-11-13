// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function snapshotOwn(handle: any): any;
export function ownMatrix(scene: any, snapshot: any, context: any): number[];
export function lineWorld(scene: any, group: any, context: any): {
    matrix: number[];
    opacity: number;
};
export function affineProps(m: any, opacity?: number): {
    x: any;
    y: any;
    rotation: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    opacity: any;
};
export function lifecycleAt(record: any, context: any): any;
export function liftGlyph(record: any): void;
export function isFreeAt(record: any, time: any): boolean;
export function freeCarrier(record: any, context: any): {
    matrix: any[];
    opacity: number;
    full: any;
};
export function registerGlyph(handle: any, record: any): WeakMap<WeakKey, any>;
export function glyphRecord(handle: any): any;
