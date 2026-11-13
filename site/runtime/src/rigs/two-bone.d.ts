// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** First-party planar two-link kinematics. Distances use caller-chosen common units; angles are radians. */
export interface Point2 {x: number; y: number;}
export interface TwoBonePose {root: Point2; elbow: Point2; tip: Point2; angles: [number, number];}
export interface ForwardOptions {root?: Point2; lengths: [number, number]; angles: [number, number];}
export interface SolveOptions {root?: Point2; target: Point2; lengths: [number, number]; bend?: 1 | -1; pole?:Point2;stretch?:number;compress?:number;softness?:number;unreachable?: 'clamp' | 'error';}
export interface TwoBoneSolution extends TwoBonePose {reachable: boolean; target: Point2; error: number;bend:1|-1;stretch:number;scale:number;effectiveTarget:Point2;softness:number;}
export function fkTwoBone(options: ForwardOptions): TwoBonePose;
export function solveTwoBone(options: SolveOptions): TwoBoneSolution;
