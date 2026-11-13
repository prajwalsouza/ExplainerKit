// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface RigPoint3D { x: number; y: number; z?: number; }
export interface RigPosition3D { x: number; y: number; z: number; }
export interface TwoBone3DOptions { root: RigPoint3D; target: RigPoint3D; lengths: [number, number]; pole?: RigPoint3D; reachMargin?: number; }
export interface TwoBone3DResult { root: RigPosition3D; joint: RigPosition3D; tip: RigPosition3D; target: RigPosition3D; reachable: boolean; error: number; poleDegenerate: boolean; }
export function rigPoint3D(value: RigPoint3D, label?: string): RigPosition3D;
export function solveTwoBone3D(spec: TwoBone3DOptions): TwoBone3DResult;
