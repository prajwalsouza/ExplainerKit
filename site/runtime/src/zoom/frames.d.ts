// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function frameRecord(value: any): any;
/** Convert without materializing either frame's absolute root/world origin. */
export function convertFramePoint(value: any, from: any, to: any): Readonly<{
    x: any;
    y: any;
}>;
export function relativeUnits(from: any, to: any): number;
export function relativeRotation(from: any, to: any): any;
export function convertFrameVector(value: any, from: any, to: any): Readonly<{
    x: any;
    y: any;
}>;
/** A bounded tree of 2D similarity frames; units are relative to the parent. */
export function referenceFrame(spec?: {}): Readonly<{
    id: any;
    unit: any;
    x: any;
    y: any;
    rotation: any;
    parent: null;
    frame(child: any): Readonly</*elided*/ any>;
    pointTo(localValue1: any, target: any): Readonly<{
        x: any;
        y: any;
    }>;
    vectorTo(localValue2: any, target: any): Readonly<{
        x: any;
        y: any;
    }>;
    scaleTo(target: any): number;
    rotationTo(target: any): any;
    find(localId3: any): any;
}>;
export function frameCandidates(from: any, to: any): any[];
