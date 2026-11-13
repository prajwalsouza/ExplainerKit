// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MusicAnalysis} from './analysis.js';
export type GridUnit = 'bar' | 'beat' | 'half' | 'third' | 'quarter' | 'onset' | 'section';
export declare const GRID_UNITS: readonly GridUnit[];
export interface GridPosition {readonly bar: number; readonly beat: number; readonly beatIndex: number; readonly phase: number; readonly barPhase: number; readonly bpm: number;}
export type PinTarget = number | {bar?: number; beat?: number; fraction?: number} | {event: string; index?: number; edge?: 'start' | 'end'} | {section: number | string; edge?: 'start' | 'end'};
export interface PinAction {id?: string; at: PinTarget; snap?: GridUnit; direction?: 'nearest' | 'next' | 'previous'; beats?: number; offset?: number; data?: unknown;}
export type PinnedAction = {readonly id: string; readonly time: number; readonly bar: number; readonly beat: number; readonly missing: false; readonly data: unknown} | {readonly id: string; readonly time: null; readonly missing: true; readonly data: unknown};
export interface MusicGrid {
  readonly beatsPerBar: number; readonly duration: number; readonly beats: readonly number[]; readonly bars: readonly number[];
  position(time: number): GridPosition;
  snap(time: number, unit?: GridUnit, direction?: 'nearest' | 'next' | 'previous'): number | null;
  next(time: number, unit?: GridUnit): number | null;
  previous(time: number, unit?: GridUnit): number | null;
  timeOf(position: {bar?: number; beat?: number; fraction?: number}): number;
  times(unit?: GridUnit, range?: {from?: number; to?: number}): readonly number[];
  pulse(time: number, options?: {unit?: GridUnit; decay?: number}): number;
  pin(actions: readonly PinAction[]): readonly PinnedAction[];
  event(type: string, index?: number): MusicAnalysis['events'][number] | null;
}
export declare function musicGrid(source: Pick<MusicAnalysis, 'beats' | 'duration'> & Partial<Pick<MusicAnalysis, 'meter' | 'onsets' | 'sections' | 'events'>> | {tempo: number; beatsPerBar?: number; start?: number; duration: number}): MusicGrid;
