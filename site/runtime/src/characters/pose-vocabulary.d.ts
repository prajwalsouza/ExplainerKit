// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type BipedPoseName='stand'|'reach'|'brace'|'hands-on-hips'|'think'|'step-back'|'arms-up'|'hands-on-head';
export type BipedLimb='armF'|'armB'|'legF'|'legB';
export interface PoseDials {crouch?:number;armHeight?:number;lean?:number;}
export type VocabularyPose=Readonly<{joints:Readonly<Record<BipedLimb,readonly [number,number]>>;lean:number;hip:readonly [number,number]}>;
export const BIPED_POSES:Readonly<Record<BipedPoseName,Readonly<Record<BipedLimb,readonly [number,number]>>>>;
export function poseVocabulary(definition:unknown,name:BipedPoseName,dials?:PoseDials):VocabularyPose;
