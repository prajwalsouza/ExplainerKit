// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export declare const CONTINUITY: Readonly<{ position: number; size: number; angle: number; color: number }>;
/** One named feature of a representation, in screen pixels. */
export interface ContinuityAnchor {
  id: string; x: number; y: number;
  /** Apparent size in pixels (a radius or a length). */
  size?: number;
  /** Apparent direction in radians. */
  angle?: number;
  /** A solid colour: hex, supported name, hsl()/hsla() or an HSLA record. */
  color?: string | Readonly<{ h: number; s: number; l: number; a?: number }>;
  visible?: boolean;
}
export interface ContinuityTolerance { position?: number; size?: number; angle?: number; color?: number }
export interface ContinuityMeasure { readonly value: number | null; readonly tolerance: number; readonly unit: string; readonly status: 'pass' | 'fail' | 'unknown' }
export interface Similarity { readonly scale: number; readonly rotation: number; readonly x: number; readonly y: number; readonly residual: number }
export interface HandoverReport {
  readonly protocol: 'explainerkit.continuity-audit/1';
  readonly at: number | null;
  readonly status: 'pass' | 'fail' | 'unknown';
  readonly checks: readonly Readonly<{ id: string; status: 'pass' | 'fail'; shift: Readonly<{ x: number; y: number }>; position: ContinuityMeasure; size: ContinuityMeasure; angle: ContinuityMeasure; color: ContinuityMeasure }>[];
  readonly missing: readonly string[];
  readonly correction: Similarity | null;
  readonly worst: number;
  readonly message: string;
}
/** Perceptual colour distance in OKLab between two solid colours. */
export function colorDistance(a: ContinuityAnchor['color'], b: ContinuityAnchor['color']): number;
/** Least-squares similarity (uniform scale, rotation, translation) carrying `to` points onto `from`. */
export function fitSimilarity(from: readonly Pick<ContinuityAnchor, 'x' | 'y' | 'size'>[], to: readonly Pick<ContinuityAnchor, 'x' | 'y' | 'size'>[]): Similarity;
/** Measure one handover between two representations' anchors. */
export function auditHandover(spec: { from: readonly ContinuityAnchor[]; to: readonly ContinuityAnchor[]; viewport: { width: number; height: number }; tolerance?: ContinuityTolerance; at?: number }): HandoverReport;
/** Audit a handover over its overlap window with trusted, pure samplers. */
export function auditHandoverWindow(spec: { from: (t: number) => readonly ContinuityAnchor[]; to: (t: number) => readonly ContinuityAnchor[]; start: number; end: number; samples?: number; viewport: { width: number; height: number }; tolerance?: ContinuityTolerance }): Readonly<{ protocol: 'explainerkit.continuity-window/1'; status: 'pass' | 'fail' | 'unknown'; start: number; end: number; samples: readonly HandoverReport[]; worst: HandoverReport }>;
