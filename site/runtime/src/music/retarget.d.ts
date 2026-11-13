// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MusicAnalysis} from './analysis.js';
import type {MusicPCMInput} from './input.js';
export interface MusicEdit {readonly at: number; readonly from: number; readonly to: number;}
export interface RetargetPlan {readonly duration: number; readonly target: number; readonly residual: number; readonly fadeOutAt: number | null; readonly jumps: readonly {readonly fromBar: number; readonly toBar: number; readonly at: number; readonly to: number; readonly similarity: number}[]; readonly edits: readonly MusicEdit[];}
export declare function retargetMusic(analysis: MusicAnalysis, options: {duration: number; maxJumps?: number; minSimilarity?: number}): RetargetPlan;
export declare function renderMusicEdits(input: MusicPCMInput, plan: {readonly edits: readonly MusicEdit[]}, options?: {crossfade?: number; fadeOutAt?: number | null; fadeOut?: number; duration?: number}): {readonly channels: readonly Float32Array[]; readonly sampleRate: number; readonly duration: number};
