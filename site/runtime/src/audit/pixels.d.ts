// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface PixelImage { width: number; height: number; data: ArrayLike<number> }
export interface PixelTextBox { id: string; x: number; y: number; width: number; height: number; color: string | Readonly<{ h: number; s: number; l: number; a?: number }>; fontSize: number; bold?: boolean }
/** WCAG text contrast against the worst part of rendered backdrop pixels behind each box. */
export function auditTextOverPixels(spec: { image: PixelImage; texts: readonly PixelTextBox[]; percentile?: number }): Readonly<{
  protocol: 'explainerkit.text-over-pixels/1';
  status: 'pass' | 'fail' | 'unknown';
  percentile: number;
  checks: readonly Readonly<{ id: string; status: 'pass' | 'fail' | 'unknown'; contrast: number | null; required: number; large: boolean; backdrop: string | null; samples?: number }>[];
}>;
