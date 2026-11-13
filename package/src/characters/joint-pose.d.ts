// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {JointCharacterPose,CharacterLimb} from './runtime.js';
export function characterPoseFromSkeleton(pose:unknown,options:{limbs:Readonly<Partial<Record<CharacterLimb,readonly [string,string]>>>;bodyRotation?:number}):Readonly<JointCharacterPose>;
