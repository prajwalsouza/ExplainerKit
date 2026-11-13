// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Coordinates already expressed in the declared space and units. Null means unavailable. */
export type MotionPoint = readonly [number, number] | readonly [number, number, number];
/** Trusted pure synchronous sampler; must not mutate its source and must do bounded work. */
export type MotionSampler = (seconds: number) => MotionPoint | null;
export interface MotionHold { id?: string; from: number; to: number; tolerance: number; }
export interface MotionContact extends MotionHold { target: MotionPoint | MotionSampler; }
export interface MotionArrival { id?: string; at: number; target: MotionPoint | MotionSampler; tolerance: number; }
export interface MotionAuditOptions {
  from?: number; to: number; fps?: number; space: 'world' | 'screen' | 'local';
  unit?: string; dimensions?: 2 | 3; maxSamples?: number; includeSamples?: boolean;
  holds?: readonly MotionHold[]; contacts?: readonly MotionContact[]; arrivals?: readonly MotionArrival[];
  maxSpeed?: number; maxAcceleration?: number;
}
export interface MotionCoverage { readonly available: number; readonly expected: number; }
export interface MotionMaximum {
  readonly value: number | null; readonly at: number | null; readonly from: number | null; readonly to: number | null;
  readonly unit: string; readonly observations: number; readonly roundoffAllowance: number;
  readonly lowerBound: number | null; readonly lowerBoundAt: number | null;
}
export type MotionCheckStatus = 'pass' | 'fail' | 'unknown';
export interface MotionAuditReport {
  readonly protocol: 'explainerkit.motion-audit/1';
  readonly status: MotionCheckStatus | 'measured';
  readonly space: 'world' | 'screen' | 'local'; readonly dimensions: 2 | 3; readonly unit: string;
  readonly from: number; readonly to: number; readonly fps: number; readonly coverage: MotionCoverage;
  readonly metrics: Readonly<{ observedPathLength: number; pathUnit: string; speed: MotionMaximum; acceleration: MotionMaximum }>;
  readonly checks: readonly Readonly<{ id: string; kind: 'hold' | 'contact' | 'arrival'; from: number; to: number; tolerance: number; status: MotionCheckStatus; error: MotionMaximum; coverage: MotionCoverage }>[];
  readonly limits: readonly Readonly<{ metric: 'speed' | 'acceleration'; tolerance: number; status: MotionCheckStatus; coverage: MotionCoverage }>[];
  readonly samples?: readonly Readonly<{ at: number; point: MotionPoint | null }>[];
}
/** Sample authored point motion without changing the scene. Results are sampled measurements, not continuous-time guarantees. */
export function auditMotion(sample: MotionSampler, spec: MotionAuditOptions): MotionAuditReport;
