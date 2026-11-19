// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { createCanvasRenderer } from './canvas.js';

type CanvasSource = Pick<ReturnType<typeof createCanvasRenderer>, 'element' | 'render'>;

export interface ThreeFramePlane {
  readonly object: any;
  render(frame: Parameters<CanvasSource['render']>[0]): void;
  dispose(): void;
}

export function createThreeFramePlane(options: {
  THREE: object;
  source: CanvasSource;
  width?: number;
}): ThreeFramePlane;
