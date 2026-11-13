// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { RigPoint3D, RigPosition3D, TwoBone3DResult } from '../rigs/two-bone-3d.js';
export interface BipedPathSample { x: number; z?: number; heading: number; }
export interface BipedMotionOptions { path(time: number): BipedPathSample; stride?: number; stance?: number; legLength?: number; armLength?: number; hipWidth?: number; hipHeight?: number; stepHeight?: number; footHeight?: number; spineLength?: number; shoulderWidth?: number; sway?: number; armSwing?: number; }
export interface BipedIntent { weightShift?: number; reach?: { side: 'left' | 'right'; target: RigPoint3D; weight?: number; }; posture?: {lean?: number; twist?: number}; lookAt?: RigPoint3D; lift?: number; crouch?: number; }
export interface BipedDimensions { readonly legLength: number; readonly armLength: number; readonly hipWidth: number; readonly spineLength: number; readonly shoulderWidth: number; readonly footHeight: number; }
export interface BipedPose { time: number; heading: number; pelvisHeading: number; pelvisRoll: number; chestHeading: number; headYaw: number; headPitch: number; lean: number; pelvis: RigPosition3D; chest: RigPosition3D; head: RigPosition3D; feet: Array<{point: RigPosition3D; planted: boolean; phase: number; heading: number; moving: number}>; legs: TwoBone3DResult[]; arms: TwoBone3DResult[]; support: number; dimensions: BipedDimensions; diagnostics: {reachable: boolean; legError: number; armError: number; pathTooFast: boolean}; }
export interface BipedMotion { sample(time: number, intent?: BipedIntent): BipedPose; readonly dimensions: BipedDimensions; readonly stride: number; readonly stance: number; }
export function bipedMotion(spec: BipedMotionOptions): BipedMotion;
