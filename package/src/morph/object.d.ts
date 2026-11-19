// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { captureState } from '../core/transition.js';

type Frame = ReturnType<typeof captureState> & { readonly description?: string };

export interface ObjectMorphEndpoint {
  frame: Frame;
  object: string | { readonly id: string };
  keys?: Readonly<Record<string, string>>;
}

export interface ObjectMorphOptions {
  match?: 'auto' | 'keys' | 'geometry';
  pairs?: readonly (readonly [sourceId: string, targetId: string])[];
  samples?: number;
}

export interface ObjectMorph {
  sample(progress: number): Frame;
  readonly diagnostics: {
    readonly matched: readonly { readonly from: string; readonly to: string }[];
    readonly fadedOut: number;
    readonly fadedIn: number;
    readonly strategy: 'keys' | 'geometry';
  };
}

export function createObjectMorph(from: ObjectMorphEndpoint, to: ObjectMorphEndpoint, options?: ObjectMorphOptions): ObjectMorph;
