// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MusicPCMInput} from './input.js';
import type {ChordQuality} from './harmony.js';
export declare const MUSIC_ANALYSIS_VERSION: 1;
export type ExternalBeat = number | {time: number; position?: number};
export interface MusicAnalysisOptions {tempoRange?: readonly [number, number]; tempoHint?: number; beatsPerBar?: 'auto' | 2 | 3 | 4 | 6; chords?: 'triads' | 'sevenths' | false; onsetThreshold?: number; beats?: readonly ExternalBeat[];}
export interface MusicBeat {readonly time: number; readonly index: number; readonly bar: number; readonly position: number; readonly strength: number;}
export interface MusicChord {readonly start: number; readonly end: number; readonly name: string; readonly root: number; readonly quality: ChordQuality | null; readonly beat: number; readonly beats: number; readonly numeral: string | null; readonly confidence: number;}
export interface MusicKey {readonly tonic: string; readonly tonicIndex: number; readonly mode: 'major' | 'minor'; readonly name: string; readonly correlation: number; readonly confidence: number;}
export type MusicSectionRole = 'intro' | 'outro' | 'breakdown' | 'peak' | 'steady';
export interface MusicSection {readonly start: number; readonly end: number; readonly label: string; readonly startBeat: number; readonly endBeat: number; readonly startBar: number; readonly bars: number; readonly energy: number; readonly role: MusicSectionRole; readonly repeats: number; readonly progression: {readonly chords: readonly string[] | null; readonly bars: number | null; readonly repeat: number} | null; readonly key: {readonly name: string; readonly confidence: number} | null;}
export type MusicEventType = 'start' | 'end' | 'fade-in' | 'fade-out' | 'section' | 'progression-change' | 'key-change' | 'drop' | 'build' | 'breakdown' | 'climax' | 'pause' | 'hit' | 'tempo-change';
export interface MusicEvent {readonly type: MusicEventType; readonly time: number; readonly end?: number; readonly strength: number; readonly bar: number | null; readonly beat: number | null; readonly label?: string; readonly role?: MusicSectionRole; readonly measure?: string; readonly bars?: number; readonly bpm?: number; readonly from?: string | readonly string[]; readonly to?: string | readonly string[];}
export interface MusicCurves {readonly step: number; readonly loudness: readonly number[]; readonly shortTermLoudness: readonly number[]; readonly intensity: readonly number[]; readonly brightness: readonly number[]; readonly bass: readonly number[]; readonly onsetDensity: readonly number[];}
export interface MusicAnalysis {
  readonly version: 1; readonly duration: number; readonly sampleRate: number; readonly start: number; readonly end: number;
  readonly loudness: {readonly integrated: number; readonly peak: number}; readonly tuning: number;
  readonly tempo: {readonly bpm: number; readonly confidence: number; readonly candidates: readonly {readonly bpm: number; readonly score: number}[]; readonly local: readonly {readonly time: number; readonly bpm: number}[]; readonly source: 'estimated' | 'external'};
  readonly meter: {readonly beatsPerBar: number; readonly confidence: number | null; readonly source: 'estimated' | 'external'}; readonly key: MusicKey | null;
  readonly beats: readonly MusicBeat[]; readonly downbeats: readonly number[]; readonly onsets: readonly {readonly time: number; readonly strength: number}[];
  readonly chords: readonly MusicChord[]; readonly sections: readonly MusicSection[]; readonly events: readonly MusicEvent[]; readonly curves: MusicCurves;
}
export declare function beatsFromText(text: string): ExternalBeat[];
export declare function analyzeMusic(input: MusicPCMInput, options?: MusicAnalysisOptions): MusicAnalysis;
