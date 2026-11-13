// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Scene, Derived } from '../core/scene.js';
import type { Ambient } from '../core/ambient.js';
import type { Parameter } from '../core/data.js';
import type { BipedMotion, BipedIntent, BipedPose } from './biped-motion.js';
export interface BipedRigOptions { motion: BipedMotion; time: Ambient | Parameter | Derived; intent?: Derived; }
export interface BipedRig { actor: ReturnType<Scene['group']>; parts: Record<string, ReturnType<Scene['group']>>; pose: Derived; }
export function bipedRig(drawing: Scene, spec: BipedRigOptions): BipedRig;
