import { assert, number, options } from '../core/validate.js';
import { easings } from '../core/timing.js';
import { projectLayer } from './depth.js';
import {
  cameraMatrix,
  invertMatrix,
  transformPoint,
  fitRegion,
  worldPose,
  MIN_CAMERA_ZOOM,
  MAX_CAMERA_ZOOM,
} from './math.js';
import { captureDrift, captureShots, sampleChoreography } from './shots.js';
import { captureKeeping, fitKeeping } from './keeping.js';

const CHANNELS = Object.freeze({ x: 'x', y: 'y', zoom: 'scaleX', rotation: 'rotation' });
function value(key, input) {
  return key === 'zoom' ? number(input, key, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM) : number(input, key);
}
function patch(input) {
  options(input, Object.keys(CHANNELS), 'camera properties');
  return Object.fromEntries(Object.entries(input).map(([key, v]) => [CHANNELS[key], value(key, v)]));
}
export function cameraDefaults(scene, spec) {
  options(spec, ['x', 'y', 'zoom', 'rotation', 'anchorX', 'anchorY'], 'camera');
  const result = {
    x: value('x', spec.x ?? scene.width / 2),
    y: value('y', spec.y ?? scene.height / 2),
    zoom: value('zoom', spec.zoom ?? 1),
    rotation: value('rotation', spec.rotation ?? 0),
    anchorX: number(spec.anchorX ?? 0.5, 'anchorX', 0, 1),
    anchorY: number(spec.anchorY ?? 0.5, 'anchorY', 0, 1),
  };
  return Object.freeze(result);
}
function regionCopy(region) {
  options(region, ['x', 'y', 'width', 'height'], 'camera region');
  return Object.freeze({
    x: number(region.x, 'region x'),
    y: number(region.y, 'region y'),
    width: number(region.width, 'region width', Number.MIN_VALUE),
    height: number(region.height, 'region height', Number.MIN_VALUE),
  });
}
const overlap = (a, b, c, d) => a < d && c < b;

/** A view over a scene. Camera motion never writes the scene's model positions. */
export class Camera {
  #scene;
  #handle;
  #samplePose;
  #defaults;
  #autoX;
  #autoY;
  #follow = null;
  #shots = [];
  #overlays = new Set();
  #responsiveStarts = new Map();
  #sequence = null;
  #drift = null;
  #keeping = null;
  #underlays = new Set();
  #screenRoots() {
    return new Set([...this.#overlays, ...this.#underlays]);
  }
  _isScreenRoot(id) {
    return this.#overlays.has(id) || this.#underlays.has(id);
  }
  constructor(scene, handle, samplePose, defaults, spec) {
    this.#scene = scene;
    this.#handle = handle;
    this.#samplePose = samplePose;
    this.#defaults = defaults;
    this.#autoX = spec.x === undefined;
    this.#autoY = spec.y === undefined;
  }
  #writable(keys, at = 0, end = 86400) {
    assert(!this.#keeping, 'CHANNEL_OWNED', 'Clear camera keeping before changing pose channels.');
    assert(!this.#sequence, 'CHANNEL_OWNED', 'Clear camera shots before changing their pose channels.');
    assert(this.#shots.length === 0, 'CHANNEL_OWNED', 'Clear camera framing before changing its pose channels.');
    const f = this.#follow;
    if (f && overlap(at, end, f.at, f.until))
      for (const key of keys)
        assert(
          !(['x', 'y'].includes(key) || (key === 'rotation' && f.rotation)),
          'CHANNEL_OWNED',
          'Following owns camera position and its selected rotation.',
        );
  }
  #explicit(keys) {
    if (keys.includes('x')) this.#autoX = false;
    if (keys.includes('y')) this.#autoY = false;
  }
  set(input) {
    const p = patch(input),
      keys = Object.keys(input);
    this.#writable(keys);
    this.#scene._batch(() => {
      this.#handle.set(p);
      for (const key of keys) this.#responsiveStarts.delete(key);
      this.#explicit(keys);
    });
    return this;
  }
  to(at, input, spec = {}) {
    options(spec, ['duration', 'ease'], 'camera timing');
    const p = patch(input),
      keys = Object.keys(input);
    this.#writable(keys, at, at + (spec.duration ?? 1.1));
    const responsive = keys.filter(
      (key) =>
        (key === 'x' ? this.#autoX : key === 'y' ? this.#autoY : false) &&
        !this.#handle._record.tracks.get(CHANNELS[key])?.length,
    );
    this.#scene._batch(() => {
      this.#handle.to(at, p, spec);
      for (const key of responsive) this.#responsiveStarts.set(key, this.#handle._record.tracks.get(key)[0]);
      this.#explicit(keys);
    });
    return this;
  }
  bind(property, spec) {
    options(spec, ['inputs', 'map'], 'camera binding');
    const keys = Array.isArray(property) ? [...property] : [property];
    for (const key of keys) assert(Object.hasOwn(CHANNELS, key), 'UNKNOWN_PROPERTY', `Unknown camera property ${key}.`);
    assert(typeof spec.map === 'function', 'INVALID_BINDING', 'Camera binding needs a map function.');
    this.#writable(keys);
    const several = Array.isArray(property),
      map = spec.map;
    const wrapped = (...args) => {
      const out = map(...args);
      if (!several) return value(keys[0], out);
      assert(out && typeof out === 'object', 'INVALID_BINDING', 'Multi-property camera binding must return a record.');
      return Object.fromEntries(keys.map((key) => [CHANNELS[key], value(key, out[key])]));
    };
    this.#scene._batch(() => {
      this.#handle.bind(several ? keys.map((key) => CHANNELS[key]) : CHANNELS[keys[0]], {
        inputs: spec.inputs ?? [],
        map: wrapped,
      });
      for (const key of keys) this.#responsiveStarts.delete(key);
      this.#explicit(keys);
    });
    return this;
  }
  unbind(property) {
    assert(Object.hasOwn(CHANNELS, property), 'UNKNOWN_PROPERTY', 'Unknown camera property.');
    this.#handle.unbind(CHANNELS[property]);
    return this;
  }
  clearAnimation(property) {
    assert(Object.hasOwn(CHANNELS, property), 'UNKNOWN_PROPERTY', 'Unknown camera property.');
    this.#scene._batch(() => {
      this.#handle.clearAnimation(CHANNELS[property]);
      if (this.#responsiveStarts.delete(property)) {
        if (property === 'x') this.#autoX = true;
        if (property === 'y') this.#autoY = true;
      }
    });
    return this;
  }
  /** Follow a live node origin; rotation optionally aligns the view with its local +x axis. */
  follow(target, spec = {}) {
    assert(!this.#keeping, 'CHANNEL_OWNED', 'Clear camera keeping before following.');
    assert(!this.#sequence, 'CHANNEL_OWNED', 'Clear camera shots before following a target.');
    options(spec, ['rotation', 'offsetX', 'offsetY', 'rotationOffset', 'at', 'until'], 'camera follow');
    assert(
      target?._scene === this.#scene && !target._record?.detached,
      'INVALID_CAMERA_TARGET',
      'Follow a live node handle from this scene.',
    );
    assert(target.id !== this.#handle.id, 'INVALID_CAMERA_TARGET', 'A camera cannot follow itself.');
    const f = Object.freeze({
      id: target.id,
      rotation: spec.rotation ?? false,
      offsetX: number(spec.offsetX ?? 0, 'offsetX'),
      offsetY: number(spec.offsetY ?? 0, 'offsetY'),
      rotationOffset: number(spec.rotationOffset ?? 0, 'rotationOffset'),
      at: number(spec.at ?? 0, 'follow at', 0, 86400),
      until: number(spec.until ?? 86400, 'follow until', 0, 86400),
    });
    assert(
      typeof f.rotation === 'boolean' && f.until > f.at,
      'INVALID_CAMERA_FOLLOW',
      'Follow needs a positive interval and boolean rotation.',
    );
    const record = this.#handle._record;
    for (const key of ['x', 'y', ...(f.rotation ? ['rotation'] : [])]) {
      assert(!record.bindings.has(key), 'CHANNEL_OWNED', 'Release camera position/rotation bindings before following.');
      assert(
        !(record.tracks.get(key) ?? []).some((t) => overlap(t.at, t.end, f.at, f.until)),
        'CHANNEL_OWNED',
        'Following overlaps a camera track.',
      );
    }
    assert(
      !this.#shots.some((s) => overlap(s.at, s.end, f.at, f.until)),
      'CHANNEL_OWNED',
      'Following overlaps a framing transition.',
    );
    this.#follow = f;
    if (spec.until !== undefined) this.#scene._extend(f.until);
    this.#scene._changed();
    return this;
  }
  _stagingState() {
    return {
      keepingTargets: [...(this.#keeping?.ids ?? [])],
      targets: [
        ...(this.#keeping?.ids ?? []),
        ...(this.#follow ? [this.#follow.id] : []),
        ...(this.#sequence ?? []).filter((shot) => shot.kind === 'zoomThrough').map((shot) => shot.target.id),
      ],
      bindings: this.#handle._record.bindings.size > 0,
    };
  }
  unfollow() {
    this.#follow = null;
    this.#scene._changed();
    return this;
  }
  /** Fit a fixed world rectangle immediately. Padding is in screen pixels. */
  frame(region, spec = {}) {
    options(spec, ['padding', 'rotation'], 'camera frame');
    return this.#addShot(region, { ...spec, at: 0, duration: 0 }, true);
  }
  /** An authored zoom/pan to a rectangle, recomputed for the actual viewport on every sample. */
  zoomTo(region, spec = {}) {
    return this.#addShot(region, spec, false);
  }
  #addShot(region, spec, replace) {
    assert(!this.#keeping, 'CHANNEL_OWNED', 'Clear camera keeping before framing.');
    assert(!this.#sequence, 'CHANNEL_OWNED', 'Clear camera shots before using legacy framing.');
    options(spec, ['at', 'duration', 'padding', 'rotation', 'ease'], 'camera frame');
    const shot = Object.freeze({
      region: regionCopy(region),
      at: number(spec.at ?? 0, 'frame at', 0, 86400),
      duration: number(spec.duration ?? 1.1, 'frame duration', 0, 86400),
      padding: number(spec.padding ?? 24, 'frame padding', 0, 8192),
      rotation: value('rotation', spec.rotation ?? 0),
      ease: spec.ease ?? 'smooth',
      end: (spec.at ?? 0) + (spec.duration ?? 1.1),
    });
    number(shot.end, 'frame end', 0, 86400);
    assert(Object.hasOwn(easings, shot.ease), 'INVALID_EASING', 'Use a registered easing.');
    assert(replace || this.#shots.length < 64, 'RESOURCE_LIMIT', 'A camera accepts at most 64 framing shots.');
    assert(
      replace || !this.#shots.length || shot.at >= this.#shots.at(-1).end,
      'AMBIGUOUS_CONTINUATION',
      'Schedule camera framing in chronological order.',
    );
    const f = this.#follow;
    assert(
      !f || !overlap(shot.at, replace ? 86400 : shot.end, f.at, f.until),
      'CHANNEL_OWNED',
      'Release following before framing during that interval.',
    );
    for (const key of Object.values(CHANNELS)) {
      assert(!this.#handle._record.bindings.has(key), 'CHANNEL_OWNED', 'Release camera bindings before framing.');
      assert(
        !(this.#handle._record.tracks.get(key) ?? []).some((t) => t.end > shot.at),
        'CHANNEL_OWNED',
        'Framing overlaps a camera track.',
      );
    }
    // Ensure the authored viewport is feasible before installing the rule. Other sizes validate at sample time.
    fitRegion(
      shot.region,
      { width: this.#scene.width, height: this.#scene.height },
      {
        padding: shot.padding,
        rotation: shot.rotation,
        anchorX: this.#defaults.anchorX,
        anchorY: this.#defaults.anchorY,
      },
    );
    this.#shots = replace ? [shot] : [...this.#shots, shot];
    this.#scene._extend(shot.end);
    this.#scene._changed();
    return this;
  }
  clearFraming() {
    this.#shots = [];
    this.#scene._changed();
    return this;
  }
  /** Additive ambient velocity; fractional zoom rate is integrated with log1p.
   * @param {import('./shots.js').DriftSpec} [spec]
   */
  drift(spec = {}) {
    assert(!this.#keeping, 'CHANNEL_OWNED', 'Clear camera keeping before installing drift.');
    const next = captureDrift(spec),
      context = this.#scene._sampleContext({ time: this.#scene.duration });
    sampleChoreography(
      this.#scene,
      this.#sequence ?? [],
      next,
      context,
      (c) => this.#base(c),
      this.#scene._sampleWorld(context),
      this.#screenRoots(),
    );
    this.#drift = next;
    this.#scene._changed();
    return this;
  }
  clearDrift() {
    this.#drift = null;
    this.#scene._changed();
    return this;
  }
  /** Install one pure chronological choreography. Regions must already be registered.
   * @param {import('./shots.js').CameraShot[]} input
   */
  shots(input) {
    const next = captureShots(this.#scene, input);
    if (!next.length) return this.clearShots();
    assert(
      !this.#shots.length && !this.#follow && !this.#keeping,
      'CHANNEL_OWNED',
      'Release legacy framing/follow before authoring camera shots.',
    );
    const record = this.#handle._record;
    assert(
      !record.bindings.size && ![...record.tracks.values()].some((tracks) => tracks.length),
      'CHANNEL_OWNED',
      'Release camera pose bindings/tracks before authoring shots.',
    );
    for (const time of new Set([0, ...next.map((shot) => shot.end)])) {
      const context = this.#scene._sampleContext({ time });
      sampleChoreography(
        this.#scene,
        next,
        this.#drift ?? undefined,
        context,
        (c) => this.#base(c),
        this.#scene._sampleWorld(context),
        this.#screenRoots(),
      );
    }
    this.#sequence = next;
    this.#scene._extend(next.at(-1).end);
    this.#scene._changed();
    return this;
  }
  clearShots() {
    this.#sequence = null;
    this.#scene._changed();
    return this;
  }
  /** Live geometric fitting from the already-sampled world frame.
   * @param {any|any[]} handles
   * @param {{padding?:number,ground?:'bottom'|'center',at?:number,until?:number}} [spec]
   */
  keep(handles, spec = {}) {
    const next = captureKeeping(this.#scene, handles, spec),
      record = this.#handle._record;
    assert(
      !this.#follow && !this.#shots.length && !this.#sequence && !this.#drift,
      'CHANNEL_OWNED',
      'Release camera follow, framing, shots and drift before keeping.',
    );
    assert(
      !record.bindings.size && ![...record.tracks.values()].some((tracks) => tracks.length),
      'CHANNEL_OWNED',
      'Release camera pose bindings and tracks before keeping.',
    );
    const context = this.#scene._sampleContext({ time: next.at }),
      frame = this.#scene._sampleWorld(context);
    fitKeeping(next, frame, this.#base(context), this.#screenRoots());
    this.#keeping = next;
    if (spec.until !== undefined) this.#scene._extend(next.until);
    this.#scene._changed();
    return this;
  }
  clearKeeping() {
    this.#keeping = null;
    this.#scene._changed();
    return this;
  }

  /** Finite sampled speed diagnostics for stationary world points at the initial viewport corners.
   * @param {{width?:number,height?:number,samples?:number,fps?:number}} [spec]
   */
  shotReport(spec = {}) {
    options(spec, ['width', 'height', 'samples', 'fps'], 'camera shot report');
    const width = number(spec.width ?? this.#scene.width, 'report width', 1, 8192),
      height = number(spec.height ?? this.#scene.height, 'report height', 1, 8192),
      samples = number(spec.samples ?? 33, 'report samples', 3, 129),
      fps = number(spec.fps ?? 30, 'report fps', 1, 240);
    assert(Number.isInteger(samples), 'CAMERA_SHOTS', 'Report sample count must be a whole number.');
    assert(
      (this.#sequence?.length ?? 0) * samples * Math.max(1, this.#scene.nodeCount) <= 10000000,
      'RESOURCE_LIMIT',
      'Camera speed report exceeds its scene/sample work budget.',
    );
    return Object.freeze(
      (this.#sequence ?? []).map((shot) => {
        if (!shot.duration)
          return Object.freeze({
            kind: shot.kind,
            at: shot.at,
            end: shot.end,
            sampledPeakPxPerSecond: null,
            sampledPeakPxPerFrame: null,
            samples: 0,
          });
        const initial = this.view({ time: shot.at, width, height }),
          points = [
            [0, 0],
            [width, 0],
            [0, height],
            [width, height],
          ].map(([x, y]) => transformPoint(initial.inverse, { x, y }));
        let previous = points.map((p) => transformPoint(initial.matrix, p)),
          peak = 0;
        const step = shot.duration / (samples - 1);
        for (let i = 1; i < samples; i++) {
          const view = this.view({ time: shot.at + step * i, width, height }),
            current = points.map((p) => transformPoint(view.matrix, p));
          for (let j = 0; j < points.length; j++)
            peak = Math.max(peak, Math.hypot(current[j].x - previous[j].x, current[j].y - previous[j].y) / step);
          previous = current;
        }
        return Object.freeze({
          kind: shot.kind,
          at: shot.at,
          end: shot.end,
          sampledPeakPxPerSecond: peak,
          sampledPeakPxPerFrame: peak / fps,
          samples,
        });
      }),
    );
  }
  /** Keep a top-level drawable in screen space. Native HTML controls are already outside the camera. */
  overlay(handle) {
    assert(
      handle?._scene === this.#scene && this.#scene._isRootHandle(handle) && !handle._record.detached,
      'INVALID_CAMERA_OVERLAY',
      'An overlay must be a live top-level node from this scene.',
    );
    assert(
      !this.#underlays.has(handle.id),
      'CAMERA_LAYER_OWNED',
      'Remove the screen underlay assignment before making it an overlay.',
    );
    this.#overlays.add(handle.id);
    this.#scene._changed();
    return this;
  }
  removeOverlay(handle) {
    this.#overlays.delete(handle.id);
    this.#scene._changed();
    return this;
  }
  /** Keep a live root backdrop in screen space, below the projected world. */
  underlay(handle) {
    assert(
      handle?._scene === this.#scene && this.#scene._isRootHandle(handle) && !handle._record.detached,
      'INVALID_CAMERA_UNDERLAY',
      'An underlay must be a live top-level node from this scene.',
    );
    assert(
      !this.#overlays.has(handle.id),
      'CAMERA_LAYER_OWNED',
      'Remove the screen overlay assignment before making it an underlay.',
    );
    this.#underlays.add(handle.id);
    this.#scene._changed();
    return this;
  }
  removeUnderlay(handle) {
    this.#underlays.delete(handle.id);
    this.#scene._changed();
    return this;
  }
  #base(context) {
    const p = this.#samplePose(context);
    const pose = {
      x: this.#autoX ? context.width / 2 : p.x,
      y: this.#autoY ? context.height / 2 : p.y,
      zoom: value('zoom', p.scaleX),
      rotation: p.rotation,
      anchorX: this.#defaults.anchorX,
      anchorY: this.#defaults.anchorY,
    };
    for (const [key, track] of this.#responsiveStarts) {
      if (context.time >= track.end) continue;
      const from = (key === 'x' ? context.width : context.height) / 2;
      const k =
        context.time < track.at
          ? 0
          : (typeof track.ease === 'function' ? track.ease : easings[track.ease])(
              (context.time - track.at) / track.duration,
            );
      pose[key] = from + (track.to - from) * k;
    }
    return pose;
  }
  project(frame, context) {
    const size = { width: frame.width, height: frame.height };
    let pose = this.#base(context),
      previous = null;
    for (const shot of this.#shots) {
      if (context.time < shot.at) break;
      const from = previous ?? this.#base(Object.freeze({ ...context, time: shot.at }));
      const target = fitRegion(shot.region, size, {
        padding: shot.padding,
        rotation: shot.rotation,
        anchorX: pose.anchorX,
        anchorY: pose.anchorY,
      });
      const k = shot.duration ? easings[shot.ease](Math.min(1, (context.time - shot.at) / shot.duration)) : 1;
      pose = {
        ...target,
        ...Object.fromEntries(
          ['x', 'y', 'zoom', 'rotation'].map((key) => [key, from[key] + (target[key] - from[key]) * k]),
        ),
      };
      previous = target;
    }
    const f = this.#follow;
    if (f && context.time >= f.at && context.time < f.until) {
      const contains = (node) => node.id === f.id || (node.children ?? []).some(contains);
      assert(
        !frame.children.some((node) => (this.#overlays.has(node.id) || this.#underlays.has(node.id)) && contains(node)),
        'INVALID_CAMERA_TARGET',
        'A camera cannot follow a screen-space overlay/underlay or its descendants.',
      );
      const target = worldPose(frame, f.id);
      const layer = frame.children.find((node) => node.layerCache && contains(node)),
        depth = layer?.layerCache.depth ?? 1;
      pose = {
        ...pose,
        x: frame.width / 2 + depth * (target.x + f.offsetX - frame.width / 2),
        y: frame.height / 2 + depth * (target.y + f.offsetY - frame.height / 2),
        rotation: f.rotation ? target.rotation + f.rotationOffset : pose.rotation,
      };
    }
    if (this.#keeping && context.time >= this.#keeping.at && context.time < this.#keeping.until)
      pose = fitKeeping(this.#keeping, frame, pose, this.#screenRoots());
    if (this.#sequence)
      pose = sampleChoreography(
        this.#scene,
        this.#sequence,
        this.#drift ?? undefined,
        context,
        (c) => this.#base(c),
        frame,
        this.#screenRoots(),
      );
    else if (this.#drift)
      pose = sampleChoreography(this.#scene, [], this.#drift, context, () => pose, frame, this.#screenRoots());
    const matrix = cameraMatrix(pose, size);
    number(matrix[4], 'camera screen translation x');
    number(matrix[5], 'camera screen translation y');
    frame = this.#scene._scopeRegionContent(frame, matrix, this.#screenRoots());
    const children = frame.children
      .filter((node) => !this.#overlays.has(node.id) && !this.#underlays.has(node.id))
      .map((node) => projectLayer(node, pose, size));
    const overlays = frame.children.filter((node) => this.#overlays.has(node.id));
    const underlays = frame.children.filter((node) => this.#underlays.has(node.id));
    return {
      frame: {
        ...frame,
        ...(frame.light ? { light: { ...frame.light, angle: frame.light.angle - pose.rotation } } : {}),
        children: [
          ...underlays,
          {
            id: this.#handle.id,
            type: 'group',
            props: {
              x: matrix[4],
              y: matrix[5],
              rotation: -pose.rotation,
              scaleX: pose.zoom,
              scaleY: pose.zoom,
              opacity: 1,
            },
            children,
          },
          ...overlays,
        ],
      },
      pose: Object.freeze(pose),
      matrix,
      inverse: invertMatrix(matrix),
      overlayRoots: Object.freeze(overlays.map((node) => node.id)),
      ...(underlays.length
        ? {
            underlayRoots: Object.freeze(underlays.map((node) => node.id)),
            screenRoots: Object.freeze([...underlays, ...overlays].map((node) => node.id)),
          }
        : {}),
    };
  }
  view(spec = {}) {
    const context = this.#scene._sampleContext(spec);
    const { frame: _frame, ...view } = this.project(this.#scene._sampleWorld(context), context);
    return Object.freeze(view);
  }
  worldToScreen(point, spec = {}) {
    return transformPoint(this.view(spec).matrix, point);
  }
  screenToWorld(point, spec = {}) {
    return transformPoint(this.view(spec).inverse, point);
  }
}

export {
  MIN_CAMERA_ZOOM,
  MAX_CAMERA_ZOOM,
  cameraMatrix,
  invertMatrix,
  multiplyMatrices,
  transformPoint,
  fitRegion,
  worldPose,
} from './math.js';
export { layerPose, focusBlur, projectLayer, shutterTimes } from './depth.js';
