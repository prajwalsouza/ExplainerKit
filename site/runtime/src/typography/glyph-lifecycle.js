import { assert, number } from '../core/validate.js';
import { localMatrix, multiplyAffine } from '../core/transform.js';
import { invertMatrix } from '../camera/math.js';
const handles = new WeakMap(),
  IDENTITY = [1, 0, 0, 1, 0, 0];
export const registerGlyph = (handle, record) => handles.set(handle._record, record);
export const glyphRecord = (handle) => handle && handles.get(handle._record);
export function snapshotOwn(handle) {
  const r = handle._record;
  return {
    ...r,
    props: { ...r.props },
    bindings: new Map(r.bindings),
    tracks: new Map([...r.tracks].map(([k, v]) => [k, [...v]])),
    effects: undefined,
    children: new Map(),
  };
}
export function ownMatrix(scene, snapshot, context) {
  const node = scene._evaluateOwn(snapshot, context);
  return localMatrix(node.props, node);
}
export function lineWorld(scene, group, context) {
  const path = scene._pathTo(group._record);
  assert(
    !path?.some((record) => scene.activeCamera?._isScreenRoot(record.id)),
    'GLYPH_LIFECYCLE_UNSUPPORTED',
    'Free glyphs require world-space lines, not screen overlays or underlays.',
  );
  assert(path, 'DETACHED_HANDLE', 'The glyph line is no longer attached.');
  let matrix = IDENTITY,
    opacity = 1;
  for (const record of path) {
    const node = scene._evaluateOwn(record, context),
      p = node.props;
    assert(
      (typeof p.pivot !== 'string' || p.pivot === 'origin') &&
        !p.clip &&
        !p.mask &&
        !p.glow &&
        !p.blur &&
        !p.shade &&
        !p.texture &&
        (p.blend ?? 'normal') === 'normal' &&
        (p.z ?? 0) === 0 &&
        (p.rotationX ?? 0) === 0 &&
        (p.rotationY ?? 0) === 0 &&
        (p.depth ?? 0) === 0,
      'GLYPH_LIFECYCLE_UNSUPPORTED',
      'Free glyph lines need plain world-space ancestors with origin/numeric pivots and no clip, filters or 3D channels.',
    );
    assert(
      !record.collectionOwned?.size,
      'GLYPH_LIFECYCLE_UNSUPPORTED',
      'Free glyph lines cannot inherit collection-owned placement.',
    );
    matrix = multiplyAffine(matrix, localMatrix(p, node));
    opacity *= p.opacity ?? 1;
  }
  return { matrix, opacity };
}
export function affineProps(m, opacity = 1) {
  const sx = Math.hypot(m[0], m[1]);
  let rotation,
    sy,
    skewX = 0;
  if (sx > 1e-12) {
    rotation = Math.atan2(m[1], m[0]);
    sy = (m[0] * m[3] - m[1] * m[2]) / sx;
    if (Math.abs(sy) > 1e-12) skewX = Math.atan((m[0] * m[2] + m[1] * m[3]) / (sx * sy));
    else
      assert(
        Math.hypot(m[2], m[3]) < 1e-10,
        'GLYPH_LIFECYCLE_TRANSFORM',
        'A collapsed skew basis cannot be represented.',
      );
  } else {
    rotation = Math.atan2(-m[2], m[3]);
    sy = Math.hypot(m[2], m[3]);
  }
  return {
    x: number(m[4], 'glyph world x'),
    y: number(m[5], 'glyph world y'),
    rotation,
    scaleX: sx,
    scaleY: sy,
    skewX,
    opacity: number(opacity, 'glyph world opacity', 0, 1),
  };
}
function blendMatrix(from, to, k) {
  if (k === 0) return from;
  if (k === 1) return to;
  const a = affineProps(from),
    b = affineProps(to),
    p = {};
  for (const key of ['x', 'y', 'scaleX', 'scaleY', 'skewX']) p[key] = a[key] + (b[key] - a[key]) * k;
  p.rotation = a.rotation + Math.atan2(Math.sin(b.rotation - a.rotation), Math.cos(b.rotation - a.rotation)) * k;
  return localMatrix(p);
}
export function lifecycleAt(record, context) {
  let event = null;
  for (const entry of record.life) {
    if (context.time < entry.at) break;
    event = entry;
  }
  if (!event) return record.normalPlacement(context);
  if (event.kind === 'free') return { matrix: event.matrix, opacity: event.opacity, free: true };
  const destination = event.target(context),
    k =
      context.time >= event.end
        ? 1
        : Math.max(0, Math.min(1, event.ease(event.duration ? (context.time - event.at) / event.duration : 1))),
    matrix = blendMatrix(event.from, destination.matrix, k),
    cancel = ownMatrix(record.scene, event.own, context);
  return {
    matrix: multiplyAffine(matrix, invertMatrix(cancel)),
    opacity: event.opacity + (destination.opacity - event.opacity) * k,
    free: false,
  };
}
export function liftGlyph(record) {
  if (record.lifted) return;
  const { scene, layout } = record;
  scene._liftRoot(layout);
  for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'opacity'])
    if (layout._record.bindings.has(key)) layout.unbind(key);
  layout.bind(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'opacity'], {
    map: (context) => {
      const p = lifecycleAt(record, context);
      return affineProps(p.matrix, p.opacity);
    },
  });
  record.lifted = true;
}
export function isFreeAt(record, time) {
  let selected = null;
  for (const event of record.life) {
    if (time < event.at) break;
    selected = event;
  }
  return selected?.kind === 'free' || (selected?.kind === 'attach' && time < selected.end);
}
export function freeCarrier(record, context) {
  const located = record.scene.locate(record.handle, { time: context }),
    own = snapshotOwn(record.handle),
    matrix = ownMatrix(record.scene, own, context),
    alpha = record.scene._evaluateOwn(own, context).props.opacity ?? 1;
  assert(
    (located.visible || record.parts?.some((part) => !isFreeAt(part, context.time))) &&
      located.opacity > 0 &&
      alpha > 0,
    'GLYPH_NOT_VISIBLE',
    'Clone/detach a visible glyph at its authored time.',
  );
  return {
    matrix: multiplyAffine(located.matrix, invertMatrix(matrix)),
    opacity: Math.min(1, located.opacity / alpha),
    full: located.matrix,
  };
}
