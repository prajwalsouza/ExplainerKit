import { assert, number, options, safeCopy } from '../core/validate.js';
import { easings } from '../core/timing.js';
import { fitRegion, invertMatrix, transformPoint, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM } from './math.js';

/** @typedef {{pan?:readonly [number,number],zoom?:number,rotation?:number}} DriftSpec */
/** @typedef {{x:number,y:number,width:number,height:number}} Region */
/** @typedef {{at:number,duration?:number,frame?:string|Region,region?:string|Region,to?:string|Region,cut?:string|Region,cutTo?:string|Region,whipPan?:string|Region,zoomThrough?:any,ease?:string|((progress:number)=>number),padding?:number,rotation?:number,start?:'center'|'top'|'bottom'|'left'|'right',drift?:DriftSpec}} CameraShot */

export function captureDrift(spec = {}) {
  options(spec, ['pan', 'zoom', 'rotation'], 'camera drift');
  const pan = safeCopy(spec.pan ?? [0, 0]);
  assert(Array.isArray(pan) && pan.length === 2, 'CAMERA_DRIFT', 'Camera pan drift needs [x,y] in world units/second.');
  return Object.freeze({
    x: number(pan[0], 'camera drift x'),
    y: number(pan[1], 'camera drift y'),
    zoom: Math.log1p(number(spec.zoom ?? 0, 'camera fractional zoom rate', -0.999999, 100)),
    rotation: number(spec.rotation ?? 0, 'camera rotation drift', -1e4, 1e4),
  });
}
const ZERO_DRIFT = Object.freeze({ x: 0, y: 0, zoom: 0, rotation: 0 });
const axes = ['x', 'y', 'zoom', 'rotation'];
export function driftAt(time, shots, globalDrift = ZERO_DRIFT) {
  let cursor = 0,
    velocity = globalDrift;
  const offset = { x: 0, y: 0, zoom: 0, rotation: 0 };
  for (const shot of shots) {
    const gap = Math.max(0, Math.min(time, shot.at) - cursor);
    for (const axis of axes) offset[axis] += velocity[axis] * gap;
    if (time < shot.at) return offset;
    const next = shot.drift ?? globalDrift,
      age = Math.min(time - shot.at, shot.duration);
    const u = shot.duration ? age / shot.duration : 1,
      integral = shot.duration * (u ** 3 - u ** 4 / 2);
    for (const axis of axes) offset[axis] += velocity[axis] * age + (next[axis] - velocity[axis]) * integral;
    if (time < shot.end) return offset;
    velocity = next;
    cursor = shot.end;
  }
  for (const axis of axes) offset[axis] += velocity[axis] * Math.max(0, time - cursor);
  return offset;
}
function addDrift(pose, offset) {
  return {
    ...pose,
    x: number(pose.x + offset.x, 'camera drifted x'),
    y: number(pose.y + offset.y, 'camera drifted y'),
    zoom: number(pose.zoom * Math.exp(offset.zoom), 'camera drifted zoom', MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
    rotation: number(pose.rotation + offset.rotation, 'camera drifted rotation'),
  };
}
function removeDrift(pose, offset) {
  return {
    ...pose,
    x: pose.x - offset.x,
    y: pose.y - offset.y,
    zoom: pose.zoom * Math.exp(-offset.zoom),
    rotation: pose.rotation - offset.rotation,
  };
}
function resolveRegion(scene, input) {
  if (typeof input === 'string') return scene._region(input);
  options(input, ['x', 'y', 'width', 'height'], 'shot region');
  return Object.freeze({
    x: number(input.x, 'shot region x'),
    y: number(input.y, 'shot region y'),
    width: number(input.width, 'shot region width', Number.MIN_VALUE),
    height: number(input.height, 'shot region height', Number.MIN_VALUE),
  });
}
/** Validate the complete list before the Camera adopts any rule. */
export function captureShots(scene, input) {
  assert(Array.isArray(input) && input.length <= 64, 'RESOURCE_LIMIT', 'Use at most 64 chronological camera shots.');
  const result = [];
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, i);
    assert(
      descriptor && 'value' in descriptor,
      'CAMERA_SHOTS',
      'Camera shots must be dense data records without accessors.',
    );
    const shot = descriptor.value;
    options(
      shot,
      [
        'at',
        'duration',
        'frame',
        'region',
        'to',
        'cut',
        'cutTo',
        'whipPan',
        'zoomThrough',
        'ease',
        'padding',
        'rotation',
        'start',
        'drift',
      ],
      'camera shot',
    );
    const directives = ['frame', 'region', 'to', 'cut', 'cutTo', 'whipPan', 'zoomThrough'].filter(
      (key) => shot[key] !== undefined,
    );
    assert(
      directives.length === 1,
      'CAMERA_SHOTS',
      'Each camera shot needs exactly one frame, cut, whipPan or zoomThrough directive.',
    );
    const directive = directives[0],
      kind = ['frame', 'region', 'to'].includes(directive)
        ? 'frame'
        : ['cut', 'cutTo'].includes(directive)
          ? 'cut'
          : directive;
    const at = number(shot.at ?? 0, 'camera shot start', 0, 86400);
    const duration = number(
      shot.duration ??
        (kind === 'cut' || (i === 0 && at === 0 && kind === 'frame') ? 0 : kind === 'whipPan' ? 0.9 : 1.1),
      'camera shot duration',
      0,
      86400,
    );
    assert(
      kind === 'cut' ? duration === 0 : duration > 0 || (i === 0 && at === 0),
      'CAMERA_SHOTS',
      'Only cuts and the initial frame may have zero duration.',
    );
    const end = number(at + duration, 'camera shot end', 0, 86400);
    assert(
      !result.length || at >= result.at(-1).end,
      'AMBIGUOUS_CONTINUATION',
      'Camera shots must be chronological and nonoverlapping.',
    );
    const ease = shot.ease ?? (kind === 'whipPan' ? 'launch' : 'smooth');
    assert(
      typeof ease === 'function' || (typeof ease === 'string' && Object.hasOwn(easings, ease)),
      'INVALID_EASING',
      'Use a registered camera easing or a pure easing function.',
    );
    const curve = typeof ease === 'function' ? ease : easings[ease];
    assert(
      Math.abs(number(curve(0), 'shot ease start')) <= 1e-12 &&
        Math.abs(number(curve(1), 'shot ease end') - 1) <= 1e-12,
      'INVALID_EASING',
      'A shot easing must start at0 and end at1.',
    );
    const start = shot.start ?? 'center';
    assert(
      ['center', 'top', 'bottom', 'left', 'right'].includes(start),
      'CAMERA_SHOTS',
      'Use a center or edge start position.',
    );
    const target = shot[directive];
    if (kind === 'zoomThrough')
      assert(
        target?._scene === scene && !target._record?.detached && ['circle', 'rect'].includes(target._record.type),
        'CAMERA_ZOOM_TARGET',
        'Zoom through a live circle or plain rectangle from this scene.',
      );
    else resolveRegion(scene, target);
    result.push(
      Object.freeze({
        kind,
        target,
        at,
        duration,
        end,
        curve,
        start,
        padding: number(shot.padding ?? 0, 'shot padding', 0, 8192),
        rotation: shot.rotation === undefined ? null : number(shot.rotation, 'shot rotation'),
        drift: shot.drift === undefined ? null : captureDrift(shot.drift),
      }),
    );
  }
  return Object.freeze(result);
}
function targetNode(frame, id) {
  let found = null;
  const visit = (node, root) => {
    if (node.id === id) found = { node, root };
    for (const child of node.children ?? []) visit(child, root);
  };
  for (const node of frame.children) visit(node, node.id);
  assert(found, 'CAMERA_TARGET_MISSING', 'The zoom-through target is missing at this sample.');
  return found;
}
function zoomTarget(scene, shot, context, pose, frame, overlays) {
  const target = targetNode(frame, shot.target.id);
  assert(
    !overlays.has(target.root),
    'CAMERA_ZOOM_TARGET',
    'A screen-space overlay cannot cover the viewport through camera zoom.',
  );
  const located = scene.locate(shot.target, { time: context }),
    inverse = invertMatrix(located.matrix),
    p = target.node.props;
  const circle = target.node.type === 'circle';
  assert(
    circle || (target.node.type === 'rect' && !p.rx),
    'CAMERA_ZOOM_TARGET',
    'Zoom-through coverage supports circles and unrounded rectangles.',
  );
  assert(
    circle ? p.r > 0 : p.width > 0 && p.height > 0,
    'CAMERA_ZOOM_TARGET',
    'A collapsed target cannot cover the viewport.',
  );
  const center = circle ? { x: 0, y: 0 } : { x: p.width / 2, y: p.height / 2 },
    world = transformPoint(located.matrix, center);
  const rotation = shot.rotation ?? pose.rotation,
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  let zoom = 0;
  for (const x of [-shot.padding, context.width + shot.padding])
    for (const y of [-shot.padding, context.height + shot.padding]) {
      const sx = x - pose.anchorX * context.width,
        sy = y - pose.anchorY * context.height,
        wx = c * sx - s * sy,
        wy = s * sx + c * sy;
      const lx = inverse[0] * wx + inverse[2] * wy,
        ly = inverse[1] * wx + inverse[3] * wy;
      zoom = Math.max(
        zoom,
        circle ? Math.hypot(lx, ly) / p.r : Math.max((Math.abs(lx) * 2) / p.width, (Math.abs(ly) * 2) / p.height),
      );
    }
  return {
    ...pose,
    x: world.x,
    y: world.y,
    rotation,
    zoom: number(zoom, 'covering camera zoom', MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
  };
}
export function sampleChoreography(scene, shots, globalDrift, context, base, frame, overlays) {
  const contexts = new Map([[context.time, context]]),
    frames = new Map([[context.time, frame]]);
  const at = (time) => {
    if (!contexts.has(time)) contexts.set(time, Object.freeze({ ...context, time }));
    return contexts.get(time);
  };
  const worldAt = (time) => {
    if (!frames.has(time)) frames.set(time, scene._sampleWorld(at(time)));
    return frames.get(time);
  };
  let pose = base(context),
    previous = null;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    if (context.time < shot.at) break;
    const from = previous ?? base(at(shot.at)),
      fromOffset = driftAt(shot.at, shots, globalDrift),
      endOffset = driftAt(shot.end, shots, globalDrift);
    let target;
    if (shot.kind === 'zoomThrough') {
      const time = Math.min(context.time, shots[i + 1]?.at ?? context.time);
      const orientation = addDrift(from, fromOffset);
      orientation.rotation += endOffset.rotation - fromOffset.rotation;
      target = zoomTarget(scene, shot, at(time), orientation, worldAt(time), overlays);
    } else {
      const region = resolveRegion(scene, shot.target);
      target = fitRegion(
        region,
        { width: context.width, height: context.height },
        { padding: shot.padding, rotation: shot.rotation ?? 0, anchorX: pose.anchorX, anchorY: pose.anchorY },
      );
      target = { ...target };
      if (shot.start === 'top') target.y = region.y;
      else if (shot.start === 'bottom') target.y = region.y + region.height;
      else if (shot.start === 'left') target.x = region.x;
      else if (shot.start === 'right') target.x = region.x + region.width;
    }
    const endpoint = removeDrift(target, endOffset),
      u = shot.duration ? Math.min(1, (context.time - shot.at) / shot.duration) : 1;
    const progress = number(shot.curve(u * u * (3 - 2 * u)), 'camera shot progress');
    // Log zoom interpolation stays positive even when an artistic easing overshoots.
    pose = {
      ...endpoint,
      x: from.x + (endpoint.x - from.x) * progress,
      y: from.y + (endpoint.y - from.y) * progress,
      zoom: Math.exp(Math.log(from.zoom) + (Math.log(endpoint.zoom) - Math.log(from.zoom)) * progress),
      rotation: from.rotation + (endpoint.rotation - from.rotation) * progress,
    };
    previous = endpoint;
  }
  return addDrift(pose, driftAt(context.time, shots, globalDrift));
}
