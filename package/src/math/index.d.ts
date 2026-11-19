// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Scene } from '../core/scene.js';
import type { ObjectMorph, ObjectMorphEndpoint, ObjectMorphOptions } from '../morph/object.js';

type Handle = ReturnType<Scene['instance']>;
type Command = readonly [string, ...number[]];
type Role = 'mi' | 'mn' | 'mo' | 'mtext';

interface Glyph {
  readonly id: string;
  readonly glyph: string | null;
  readonly term: number | null;
  readonly role: Role | null;
  readonly placement: string;
}

export interface EquationAsset {
  readonly width: number;
  readonly height: number;
  readonly parts: readonly (Glyph & { readonly commands: readonly Command[] })[];
}

type Convert<T> = (source: string, options: { display: boolean }) => T | Promise<T>;

export interface TypesetEquationOptions<T = unknown> {
  mathjax: {
    tex2svg?: Convert<T>;
    tex2svgPromise?: Convert<T>;
    mathml2svg?: Convert<T>;
    mathml2svgPromise?: Convert<T>;
  };
  serializeSVG?: (result: T) => string | Promise<string>;
  format?: 'latex' | 'mathml';
  height?: number;
  display?: boolean;
}

export interface EquationInstance {
  readonly handle: Handle;
  readonly parts: readonly (Glyph & { readonly handle: Handle })[];
  readonly keys: Readonly<Record<string, string>>;
  readonly width: number;
  readonly height: number;
}

export function equationFromSVG(source: string, options?: { height?: number }): EquationAsset;
export function typesetEquation<T>(source: string, options: TypesetEquationOptions<T>): Promise<EquationAsset>;
export function addEquation(scene: Scene, asset: EquationAsset, options?: {
  x?: number;
  y?: number;
  scale?: number;
  fill?: string | ReturnType<typeof import('../color/index.js').hsla>;
}): EquationInstance;

export interface EquationMorphEndpoint {
  frame: ObjectMorphEndpoint['frame'];
  equation: EquationInstance;
}

export interface EquationMorph {
  sample: ObjectMorph['sample'];
  readonly diagnostics: Readonly<Omit<ObjectMorph['diagnostics'], 'strategy'> & {
    strategy: 'semantic';
    reshaped: number;
    entering: number;
    leaving: number;
  }>;
}

export function createEquationMorph(from: EquationMorphEndpoint, to: EquationMorphEndpoint, options?: Omit<ObjectMorphOptions, 'match'>): EquationMorph;
