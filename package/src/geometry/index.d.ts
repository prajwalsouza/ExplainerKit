// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function polygonPath(input: any, spec?: {}): any;
export function regularPolygon(spec?: {}): any;
export function starPath(spec?: {}): any;
/** Four cubic arcs; a bounded approximation to an ellipse, with stable topology. */
export function ellipsePath(spec?: {}): any;
export function roundedRectPath(spec?: {}): any;
export function transformPath(input: any, spec?: {}): any;
/** Placement data can feed keyed repeat bindings, or ordinary instance.set calls. */
export function gridPlacements(spec?: {}): readonly Readonly<{
    index: number;
    x: any;
    y: any;
    rotation: 0;
}>[];
export function radialPlacements(spec?: {}): readonly Readonly<{
    index: number;
    x: any;
    y: any;
    rotation: any;
}>[];
export { lattice } from "./deform.js";
export { measurePath, pathPlacements } from "./path.js";
export { motionPath, bindMotionPath } from "./motion-path.js";
export { polyhedron, split } from "./polyhedra.js";
export { Line, outlineDraw, samplePath, pairPoints, inkStroke } from "./drawing.js";
