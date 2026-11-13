// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type ImagePoint = Readonly<{x: number; y: number}>;
export type ImageRect = Readonly<{x: number; y: number; width: number; height: number}>;
export type Surface = readonly [ImagePoint, ImagePoint, ImagePoint, ImagePoint];
export type Homography = readonly [number, number, number, number, number, number, number, number];
export type TrackingRegion = ImageRect | Surface;
export type VideoFramePixels = Readonly<{width: number; height: number; data: Uint8Array | Uint8ClampedArray}>;
export type MotionModel = 'translation' | 'affine' | 'perspective';
export type TrackingOptions = {
  searchRadius?: number;
  excludePrevious?: readonly ImageRect[];
  excludeNext?: readonly ImageRect[];
};
export type TrackingDiagnostics = Readonly<{
  featureCount: number;
  matchCount: number;
  inlierCount: number;
  residual: number | null;
  confidence: number;
  possibleCut: boolean;
}>;
export type TrackingFailure = Readonly<{
  value: null;
  diagnostics: TrackingDiagnostics;
  reason: 'possible-cut' | 'lost-feature' | 'weak-texture' | 'lost-plane' | 'unstable-plane';
}>;
export type TrackedPoint = Readonly<{value: ImagePoint; diagnostics: TrackingDiagnostics; reason: null}>;
export type TrackedPlane = Readonly<{value: Surface; region: Surface; diagnostics: TrackingDiagnostics; reason: null}>;
export function analyzeFrame(input: VideoFramePixels, spec?: {
  region?: TrackingRegion;
  exclude?: readonly ImageRect[];
}): Readonly<{
  brightness: number;
  contrast: number;
  darkFraction: number;
  brightFraction: number;
  features: readonly ImagePoint[];
}>;
export function trackPoint(previous: VideoFramePixels, next: VideoFramePixels,
  spec: TrackingOptions & {point: ImagePoint}): TrackedPoint | TrackingFailure;
export function trackPlane(previous: VideoFramePixels, next: VideoFramePixels,
  spec: TrackingOptions & {region: TrackingRegion; surface?: Surface; motion?: MotionModel}): TrackedPlane | TrackingFailure;
export type MatteOutline = readonly ImagePoint[];
export type TrackKind = 'point' | 'plane' | 'matte';
export type TrackValue<K extends TrackKind> = K extends 'point' ? ImagePoint : K extends 'plane' ? Surface : MatteOutline;
export type TrackSample<K extends TrackKind> = Readonly<{time: number; value: TrackValue<K> | null}>;
export type TrackSpec<K extends TrackKind = TrackKind> = K extends TrackKind
  ? Readonly<{kind: K; samples: readonly TrackSample<K>[]}>
  : never;
declare const compiledTrack: unique symbol;
export type CompiledTrack<K extends TrackKind = TrackKind> = TrackSpec<K> & {[compiledTrack]: true};
export function compileTrack<K extends TrackKind>(input: TrackSpec<K>): CompiledTrack<K>;
export function sampleTrack<K extends TrackKind>(track: CompiledTrack<K>, time: number): TrackValue<K> | null;
export function stabilizeTrack<K extends 'point' | 'plane'>(track: CompiledTrack<K>): CompiledTrack<K>;
export function surfaceTransform(surface: Surface, width?: number, height?: number): Homography;
export function projectSurface(surface: Surface, u: number, v: number): ImagePoint;
export function analyzeFootage(
  input: readonly Readonly<{time: number; frame: VideoFramePixels}>[],
  spec?: {region?: TrackingRegion; exclude?: readonly ImageRect[]},
): Readonly<{
  samples: readonly (Readonly<{time: number}> & ReturnType<typeof analyzeFrame>)[];
  possibleCuts: readonly Readonly<{from: number; to: number}>[];
  referenceTime: number | null;
}>;

export function foregroundHoldout(outline: MatteOutline, width: number, height: number): Readonly<{
  type: 'path';
  units: 'user';
  fillRule: 'evenodd';
  commands: readonly (readonly ['M' | 'L', number, number] | readonly ['Z'])[];
}>;

export type MatteBytes = Uint8Array | Uint8ClampedArray;
/** Apply a signed edge shift and feather in whole image pixels. */
export function adjustMatte(
  alpha: MatteBytes, width: number, height: number, spec?: {shift?: number; feather?: number},
): Uint8ClampedArray;
/** Return an overlay to display over the original opaque footage. */
export function compositeMatte(input: {
  width: number;
  height: number;
  footage: MatteBytes;
  insert: MatteBytes;
  foreground: MatteBytes;
  cleanPlate?: MatteBytes;
}): Uint8ClampedArray;

/** Return a straight RGBA overlay with alpha limited by registered camera-space depth. */
export function applyDepthHoldout(input: {
  width: number;
  height: number;
  insert: MatteBytes;
  insertDepth: Float32Array;
  observed: Readonly<{width: number; height: number; data: Float32Array | Uint16Array | Uint8Array; scale?: number}>;
  bias?: number;
  softness?: number;
}): Uint8ClampedArray;

export type VideoCameraPose = Readonly<{
  time?: number;
  rotation: readonly [number, number, number, number, number, number, number, number, number];
  translation: readonly [number, number, number];
}>;
/** Validate a measured camera track and repair isolated pose spikes by default. */
export function compileCameraTrack(
  input: readonly VideoCameraPose[],
  spec?: {stabilization?: 'standard' | 'strong' | 'none'},
): Readonly<{
  samples: readonly VideoCameraPose[];
  repaired: readonly number[];
}>;
/** Repair isolated out-and-back errors in a sampled world-to-camera pose track. */
export function stabilizeCameraTrack(input: readonly VideoCameraPose[]): Readonly<{
  samples: readonly VideoCameraPose[];
  repaired: readonly number[];
}>;
/** A measured motion field: a grid of windows with the picture's motion at each, in pixels a second. */
export type FlowField = Readonly<{
  width: number;
  height: number;
  fps: number;
  /** Frame pairs the measurement added up. */
  pairs: number;
  /** Search distance in pixels a frame. */
  reach: number;
  grid: Readonly<{cols: number; rows: number; step: number; x: number; y: number}>;
  u: Float32Array;
  v: Float32Array;
  /** 0 to 1 for each window: how clearly its answer stood out. */
  trust: Float32Array;
  /** 0 where nothing could be read, 1 where the picture is still, 2 where it moves. */
  state: Uint8Array;
  speed: Readonly<{median: number; fast: number}>;
  /** What the still parts of the picture say the camera did, or null when nothing is still. */
  camera: Readonly<{shake: number; drift: Readonly<{u: number; v: number}>; corrected: boolean; travels: boolean}> | null;
  toJSON(): FlowRecord;
}>;
export type FlowRecord = {
  width: number;
  height: number;
  fps: number;
  pairs?: number;
  reach?: number;
  grid: {cols: number; rows: number; step: number; x: number; y: number};
  u: ArrayLike<number>;
  v: ArrayLike<number>;
  trust: ArrayLike<number>;
  state: ArrayLike<number>;
  speed?: {median: number; fast: number};
  camera?: {shake: number; drift: {u: number; v: number}; corrected: boolean; travels: boolean} | null;
};
export type FlowOptions = {
  fps: number;
  step?: number;
  window?: number;
  reach?: number;
  every?: number;
  region?: ImageRect;
  stillBelow?: number;
};
/** Measure how a moving texture travels across footage, and which parts of the picture move at all. */
export function measureFlow(frames: readonly VideoFramePixels[], options: FlowOptions): FlowField;
/** Copy and validate a saved flow field before sampling it. */
export function compileFlow(record: FlowRecord): FlowField;
/** The motion at a point of the picture, in pixels a second. */
export function sampleFlow(field: FlowField, x: number, y: number, out?: {u: number; v: number}): {u: number; v: number};
export type FlowTrace = Readonly<{
  points: Float32Array;
  step: number;
  duration: number;
  at(seconds: number): {x: number; y: number; done: boolean};
}>;
/** The way something set down at a point would be carried by the flow. */
export function traceFlow(field: FlowField, start: ImagePoint,
  options?: {duration?: number; step?: number; stopBelow?: number}): FlowTrace;
export type FlowStreakSample = {positions: Float32Array; speed: Float32Array; count: number; points: number};
/** Streaks that ride a flow field, as a function of time with no hidden state. */
export function flowStreaks(field: FlowField,
  options?: {count?: number; seed?: number; life?: number; tail?: number; points?: number}): Readonly<{
  count: number;
  points: number;
  positions: Float32Array;
  speed: Float32Array;
  sample(seconds: number, amount?: number): FlowStreakSample;
}>;
