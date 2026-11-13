// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {SoundPCM} from './pcm.js';
export type SoundEffectKind = 'whoosh' | 'swipe' | 'impact' | 'tick' | 'click' | 'pop' | 'reveal' | 'riser' | 'reverse' | 'stinger' | 'shimmer';
export interface SoundEffectOptions {duration?:number;sampleRate?:number;seed?:string|number;intensity?:number;brightness?:number;weight?:number;pan?:number;reverb?:number;pitch?:number;}
export declare const SOUND_EFFECT_KINDS: readonly SoundEffectKind[];
export declare function soundEffect(kind: SoundEffectKind, options?: SoundEffectOptions): SoundPCM;
