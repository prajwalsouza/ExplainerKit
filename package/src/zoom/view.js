import { assert, number, options } from '../core/validate.js';
import { captureState } from '../core/transition.js';
import { frameRecord, convertFramePoint, relativeUnits, relativeRotation, frameCandidates } from './frames.js';

const checked = (v, label) => number(v, label, -1e150, 1e150);
function pose(spec) {
  options(spec, ['frame', 'x', 'y', 'zoom', 'rotation', 'anchorX', 'anchorY'], 'frame camera');
  frameRecord(spec.frame);
  return Object.freeze({
    frame: spec.frame,
    x: checked(spec.x ?? 0, 'camera local x'),
    y: checked(spec.y ?? 0, 'camera local y'),
    zoom: number(spec.zoom ?? 1, 'camera local zoom', 1e-150, 1e150),
    rotation: checked(spec.rotation ?? 0, 'camera rotation'),
    anchorX: number(spec.anchorX ?? 0.5, 'camera anchor x', 0, 1),
    anchorY: number(spec.anchorY ?? 0.5, 'camera anchor y', 0, 1),
  });
}
export function rebaseCamera(spec, target) {
  const p = pose(spec);
  frameRecord(target);
  const center = convertFramePoint({ x: p.x, y: p.y }, p.frame, target);
  return pose({
    ...p,
    frame: target,
    x: center.x,
    y: center.y,
    zoom: p.zoom * relativeUnits(target, p.frame),
    rotation: p.rotation + relativeRotation(p.frame, target),
  });
}
export function logZoom(from, to, progress) {
  number(from, 'start zoom', 1e-150, 1e150);
  number(to, 'end zoom', 1e-150, 1e150);
  number(progress, 'zoom progress', 0, 1);
  if (progress === 0) return from;
  if (progress === 1) return to;
  return number(
    Math.exp(Math.log(from) * (1 - progress) + Math.log(to) * progress),
    'interpolated zoom',
    1e-150,
    1e150,
  );
}

/** Project relative to the camera's current frame, with no global-coordinate bake. */
export function frameView(spec, size = { width: 960, height: 540 }) {
  const p = pose(spec);
  options(size, ['width', 'height'], 'frame view size');
  const width = number(size.width, 'width', 1, 8192),
    height = number(size.height, 'height', 1, 8192),
    c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  function project(value, source = p.frame) {
    const q = convertFramePoint(value, source, p.frame),
      x = q.x - p.x,
      y = q.y - p.y;
    return Object.freeze({
      x: checked(width * p.anchorX + p.zoom * (c * x + s * y), 'projected x'),
      y: checked(height * p.anchorY + p.zoom * (-s * x + c * y), 'projected y'),
    });
  }
  function unproject(value, target = p.frame) {
    options(value, ['x', 'y'], 'screen point');
    const x = (checked(value.x, 'screen x') - width * p.anchorX) / p.zoom,
      y = (checked(value.y, 'screen y') - height * p.anchorY) / p.zoom;
    return convertFramePoint(
      { x: checked(p.x + c * x - s * y, 'unprojected x'), y: checked(p.y + s * x + c * y, 'unprojected y') },
      p.frame,
      target,
    );
  }
  function transform(source) {
    const scale = number(relativeUnits(source, p.frame) * p.zoom, 'display scale', 1e-150, 1e150),
      rotation = relativeRotation(source, p.frame) - p.rotation,
      origin = project({ x: 0, y: 0 }, source);
    return Object.freeze({ x: origin.x, y: origin.y, rotation, scaleX: scale, scaleY: scale });
  }
  return Object.freeze({
    pose: p,
    width,
    height,
    project,
    unproject,
    transform,
    screenSize(length, source = p.frame) {
      number(length, 'authored size', 0, 1e150);
      return number(length * relativeUnits(source, p.frame) * p.zoom, 'screen size', 0, 1e150);
    },
    projectFrame(frame, source = p.frame, localSpec1 = {}) {
      options(localSpec1, ['id'], 'projected frame');
      const drawing = captureState(frame),
        t = transform(source);
      assert(
        Math.abs(t.x) <= 1e7 && Math.abs(t.y) <= 1e7 && Math.abs(t.scaleX) <= 1e7,
        'ZOOM_DISPLAY_LIMIT',
        'The display wrapper exceeds renderer limits; render nearer/local detail or cull distant artwork.',
      );
      const id = localSpec1.id ?? `zoom:${source.id}`;
      assert(
        typeof id === 'string' && id.length > 0 && id.length <= 300,
        'INVALID_ID',
        'Use a nonempty projected wrapper ID.',
      );
      function absent(node) {
        assert(node.id !== id, 'DUPLICATE_ID', 'The projection wrapper ID conflicts with artwork.');
        for (const child of node.children) absent(child);
      }
      drawing.children.forEach(absent);
      assert(countNodes(drawing.children) < 10000, 'RESOURCE_LIMIT', 'The view wrapper needs one free node.');
      return Object.freeze({
        width,
        height,
        children: Object.freeze([
          { id, type: 'group', props: Object.freeze({ ...t, opacity: 1 }), children: drawing.children },
        ]),
      });
    },
  });
}

/** Bind a top-level construction to an already derived frameView input. */
export function bindFrame(handle, spec = {}) {
  options(spec, ['frame', 'view'], 'frame binding');
  frameRecord(spec.frame);
  assert(
    handle?._scene && handle._scene._isRootHandle(handle),
    'INVALID_BINDING',
    'Bind a top-level drawable in its scene.',
  );
  assert(handle._scene._ownsInput(spec.view), 'INVALID_BINDING', 'Use a view input owned by this scene.');
  const source = spec.frame;
  handle.bind(['x', 'y', 'rotation', 'scaleX', 'scaleY'], {
    inputs: [spec.view],
    map: (view) => {
      assert(
        view && typeof view.transform === 'function',
        'INVALID_BINDING',
        'The view input must produce frameView values.',
      );
      return view.transform(source);
    },
  });
  return handle;
}
function countNodes(nodes) {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}

/** A pure shot between local frames; rebase representation while preserving the view. */
export function zoomTransition(from, to, spec = {}) {
  options(spec, ['zoom', 'rebase'], 'zoom transition');
  const a = pose(from),
    b = pose(to),
    zoomMode = spec.zoom ?? 'log',
    rebase = spec.rebase ?? true;
  assert(['log', 'linear'].includes(zoomMode), 'INVALID_ZOOM', 'Use log or linear zoom.');
  assert(typeof rebase === 'boolean', 'INVALID_ZOOM', 'rebase must be boolean.');
  const ratio = relativeUnits(b.frame, a.frame),
    endZoom = number(b.zoom / ratio, 'target zoom in source units', 1e-150, 1e150),
    endRotation = b.rotation + relativeRotation(b.frame, a.frame),
    candidates = frameCandidates(a.frame, b.frame);
  return Object.freeze({
    sample(progress) {
      number(progress, 'shot progress', 0, 1);
      if (progress === 0) return a;
      if (progress === 1) return b;
      const zoom =
        zoomMode === 'log' ? logZoom(a.zoom, endZoom, progress) : a.zoom * (1 - progress) + endZoom * progress;
      let frame = a.frame;
      if (rebase) {
        let best = Infinity;
        for (const candidate of candidates) {
          let scale;
          try {
            scale = relativeUnits(candidate, a.frame);
          } catch (error) {
            if (error.code === 'ZOOM_PRECISION_LIMIT') continue;
            throw error;
          }
          const candidateZoom = zoom * scale;
          if (!Number.isFinite(candidateZoom) || candidateZoom < 1e-150 || candidateZoom > 1e150) continue;
          const distance = Math.abs(Math.log(candidateZoom));
          if (distance < best) {
            frame = candidate;
            best = distance;
          }
        }
      }
      const start = convertFramePoint({ x: a.x, y: a.y }, a.frame, frame),
        end = convertFramePoint({ x: b.x, y: b.y }, b.frame, frame);
      return pose({
        frame,
        x: start.x * (1 - progress) + end.x * progress,
        y: start.y * (1 - progress) + end.y * progress,
        zoom: zoom * relativeUnits(frame, a.frame),
        rotation: a.rotation + (endRotation - a.rotation) * progress + relativeRotation(a.frame, frame),
        anchorX: a.anchorX * (1 - progress) + b.anchorX * progress,
        anchorY: a.anchorY * (1 - progress) + b.anchorY * progress,
      });
    },
  });
}
