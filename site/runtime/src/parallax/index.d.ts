// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Parallax for scroll stories: depth layers driven by story time, perspective helpers, coverage and heuristics. */
import type {Scene} from '../core/scene.js';
export interface Bounds {x: number; y: number; width: number; height: number;}
/** Depth-1 pan extremes in px (`x`, `y`), the frame size and the zoom range a layer must cover. */
export interface ParallaxRange {width: number; height: number; x?: readonly [number, number]; y?: readonly [number, number]; zoom?: readonly [number, number];}
export interface Coverage {readonly required: Readonly<Bounds>; readonly covered: boolean; readonly missing: Readonly<{left: number; right: number; top: number; bottom: number}>;}
export interface ParallaxLayerSpec {name: string; depth?: number; distance?: number; bounds?: Bounds;}
export interface ParallaxPin {at: number; until?: number; layers?: string[];}
export interface ParallaxRigOptions {
  layers: ParallaxLayerSpec[];
  axis?: 'x' | 'y' | 'both';
  /** px the depth-1 plane pans over [from, to]; {x, y} with axis 'both'. Default: half the frame. */
  travel?: number | {x?: number; y?: number};
  from?: number; to?: number;
  pins?: ParallaxPin[];
  /** Seconds over which speed eases into and out of each pin. Default 0.6. */
  ease?: number;
  /** Pointer amplitude in px at depth 1. Default 0 (off). */
  pointer?: number;
  drive?: 'layers' | 'camera' | 'none';
  reducedMotion?: boolean;
  /** Motion scale while reduced motion is on: 0 (still, default) to 1. */
  reduced?: number;
  /** Progress (0–1) the composition rests at when motion is scaled down. Default 0. */
  rest?: number;
  /** Distance of the depth-1 plane, for layers given by `distance`. Default 1. */
  subject?: number;
  bleed?: number;
  zoom?: readonly [number, number];
}
export interface ParallaxLayer {readonly name: string; readonly depth: number; readonly speed: number; readonly bounds: Readonly<Bounds>; readonly handle: any; readonly id: string;}
export interface ParallaxRig {
  readonly scene: Scene; readonly drive: 'layers' | 'camera' | 'none'; readonly axis: 'x' | 'y' | 'both';
  readonly travel: Readonly<{x: number; y: number}>; readonly range: Readonly<ParallaxRange>; readonly pointer: number;
  readonly layers: readonly ParallaxLayer[];
  layer(name: string): any;
  bounds(name: string): Readonly<Bounds>;
  coverage(name: string): Coverage;
  pan(time: number, name?: string | null, options?: {pointer?: boolean}): Readonly<{x: number; y: number}>;
  progress(time: number, name?: string | null): number;
  offset(name: string, time: number): Readonly<{x: number; y: number}>;
  setPointer(x: number, y?: number): ParallaxRig;
  setReducedMotion(on: boolean): ParallaxRig;
  readonly reducedMotion: boolean;
  check(options?: Omit<AuditParallaxOptions, 'rig'>): ParallaxAudit;
}
export interface ParallaxFinding {
  rule: 'edgeReveal' | 'depthOrder' | 'differentialMotion' | 'movingText' | 'depthSeparation' | 'continuity';
  kind?: string; severity: 'warning' | 'error'; ids: string[]; message: string; fix: string; value: number;
  start: number; end: number; at: number; frames: number;
}
export interface ParallaxAudit {spans: ParallaxFinding[]; summary: {from: number; to: number; fps: number; frames: number; errors: number; warnings: number; byRule: Record<string, {error: number; warning: number}>};}
export interface AuditParallaxOptions {
  rig?: ParallaxRig; from?: number; to?: number; fps?: number;
  /** Story seconds per real second, or a function of time (see storyRate). Default 1. */
  rate?: number | ((time: number) => number);
  rules?: Partial<typeof PARALLAX_RULES>; displayWidth?: number; reducedMotion?: boolean;
}
export function depthFor(distance: number, options?: {subject?: number; far?: number}): number;
export function speedFor(depth: number): number;
export function coverage(bounds: Bounds, depth: number, range: ParallaxRange): Coverage;
export function fitBackdrop(depth: number, range: ParallaxRange, options?: {bleed?: number}): Readonly<Bounds>;
export function storyPins(acts: readonly {from?: number; holds?: readonly {at: number}[]}[]): readonly Readonly<{at: number}>[];
export function storyRate(timeline: {spans: readonly any[]}, options?: {viewportsPerSecond?: number; viewportHeight?: number}): (time: number) => number;
export function parallaxRig(scene: Scene, options: ParallaxRigOptions): ParallaxRig;
export function connectParallax(rig: ParallaxRig, options?: {element?: Element; window?: Window; pointer?: boolean; smoothing?: number}): () => void;
export function auditParallax(scene: Scene, options?: AuditParallaxOptions): ParallaxAudit;
export function formatParallax(result: ParallaxAudit): string;
export const PARALLAX_RULES: Readonly<{
  edge: Readonly<{tolerance: number; errorShare: number}>;
  order: Readonly<{overlap: number}>;
  differential: Readonly<{cap: number; field: number; reduced: number}>;
  text: Readonly<{cap: number; settled: number}>;
  separation: Readonly<{minRatio: number; maxLayers: number}>;
  continuity: Readonly<{seam: number; lurch: number}>;
}>;
