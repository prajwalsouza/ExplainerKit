// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Color } from '../color/space.js';

export interface PalettePixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}
export interface PalettePolicy {
  readonly balanceTarget?: readonly [number, number, number] | null;
  readonly hueTolerance?: number;
  readonly chromaThreshold?: number;
  readonly minimumShare?: number;
}
export interface PaletteAuditOptions {
  readonly pixels: PalettePixels;
  readonly background?: Color;
  readonly groups?: Readonly<Record<string, readonly Color[]>>;
  readonly maxColors?: number;
  readonly maxSamples?: number;
  readonly policy?: PalettePolicy;
}
export interface PaletteCluster {
  readonly color: string;
  readonly oklab: readonly [number, number, number];
  readonly count: number;
  readonly coverage: number;
  readonly chroma: number;
  readonly hue: number | null;
  readonly contrast: number;
}
export interface PaletteHarmony {
  readonly class: 'achromatic' | 'monochrome' | 'analogous' | 'complementary' | 'split-complementary' | 'triadic' | 'mixed';
  readonly hues: readonly number[];
  readonly angularError: number | null;
  readonly tolerance: number;
  readonly space: 'hsl';
}
export interface PaletteGroup {
  readonly name: string;
  readonly elements: number;
  readonly clusters: readonly PaletteCluster[];
  readonly harmony: PaletteHarmony;
}
export interface PaletteAuditReport {
  readonly protocol: 'explainerkit.palette-audit/1';
  readonly background: string;
  readonly image: Readonly<{
    width: number; height: number; pixels: number; sampledPixels: number;
    sampling: 'stratified-linear'; compositing: 'encoded-srgb-straight-alpha';
  }>;
  readonly clusters: readonly PaletteCluster[];
  readonly harmony: PaletteHarmony;
  readonly balance: Readonly<{
    target: readonly [number, number, number] | null;
    shares: readonly [number, number, number];
    accentShare: number; score: number | null;
    interpretation: 'coverage-outside-two-largest-clusters';
  }>;
  readonly groups: readonly PaletteGroup[];
  readonly score: number | null;
  readonly reasons: readonly Readonly<{ rule: 'coverageBalance'; score: number | null; message: string }>[];
  readonly policy: Readonly<{
    balanceTarget: readonly [number, number, number] | null;
    hueTolerance: number; chromaThreshold: number; minimumShare: number;
    maxColors: number; maxSamples: number; iterations: 8; seedSeparation: 0.025;
  }>;
}
export interface PaletteComparison {
  readonly protocol: 'explainerkit.palette-comparison/1';
  readonly method: 'symmetric-greedy-oklab-transport';
  readonly drift: number;
  readonly threshold: number;
  readonly changed: boolean;
  readonly groups: readonly Readonly<{
    name: string; change: 'added' | 'removed' | 'changed' | 'stable'; changed: boolean;
    drift: number | null; elementsFrom: number | null; elementsTo: number | null;
  }>[];
}
export function auditPalette(spec: PaletteAuditOptions): PaletteAuditReport;
export function comparePalettes(a: PaletteAuditReport, b: PaletteAuditReport, options?: { readonly threshold?: number }): PaletteComparison;
