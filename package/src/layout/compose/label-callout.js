import { assert, number, options, text } from '../../core/validate.js';
import { textOutline } from '../../import/font.js';
import { clipRect, validatePaint, pathCommands } from '../../graphics/index.js';
import { localBounds } from '../../core/transform.js';
import { applyPresence, presenceSpec } from '../../core/motion.js';
import { easings } from '../../core/timing.js';
const point = (v, name) => {
  assert(Array.isArray(v) && v.length === 2, 'INVALID_CALLOUT', `${name} needs[x,y].`);
  return [0, 1].map((i) => number(Object.getOwnPropertyDescriptor(v, i)?.value, name));
};
const clamp = (v) => Math.max(0, Math.min(1, v));
/** Label callouts use parsed glyph outlines and a stationary local clip above their underline. */
export function labelCallout(scene, spec) {
  options(
    spec,
    ['target', 'anchor', 'ring', 'label', 'route', 'at', 'style', 'timing', 'stroke', 'strokeWidth'],
    'label callout',
  );
  const target = spec.target;
  assert(
    target?._scene === scene && scene._containsRecord(target._record),
    'INVALID_CALLOUT',
    'Use a live target of this scene.',
  );
  const anchor = point(spec.anchor ?? [0, 0], 'anchor'),
    label = spec.label;
  options(label, ['text', 'font', 'size', 'at', 'offset', 'fill', 'gap'], 'callout label');
  text(label.text, 'label text', 4096);
  assert(label.text.length > 0, 'INVALID_CALLOUT', 'Label text must not be empty.');
  assert(label.at === undefined || label.offset === undefined, 'INVALID_CALLOUT', 'Choose label at or offset.');
  assert(
    spec.route === undefined || spec.route === 'shoulder',
    'INVALID_CALLOUT',
    'Label callouts use the shoulder route.',
  );
  const size = number(label.size ?? 24, 'label size', 1, 1000),
    radius = number(spec.ring ?? 16, 'ring radius', 0.01, 8192),
    strokeWidth = number(spec.strokeWidth ?? 2, 'label stroke width', 0, 100),
    stroke = validatePaint(spec.stroke ?? '#ffffff'),
    fill = validatePaint(label.fill ?? spec.stroke ?? '#ffffff'),
    at = number(spec.at ?? 0, 'label start', 0, 86400),
    gap = Math.max(strokeWidth / 2, number(label.gap ?? size * 0.12, 'label gap', 0, 10000)),
    outline = textOutline(label.font, label.text, { size }),
    box = localBounds({ type: 'path', props: { commands: outline.commands } });
  assert(box.width > 0 && box.height > 0, 'INVALID_CALLOUT', 'A label needs visible glyph outlines.');
  const width = Math.max(outline.advance, box.width),
    pad = Math.max(1, strokeWidth),
    clip = clipRect({
      x: -pad,
      y: -box.height - gap - pad,
      width: width + 2 * pad,
      height: box.height + gap + pad - strokeWidth / 2,
    });
  const timing = spec.timing ?? {};
  options(timing, ['ring', 'line', 'word'], 'label timing');
  const ringDuration = number(timing.ring ?? 0.2, 'ring duration', 0, 60),
    lineDuration = number(timing.line ?? 0.45, 'line duration', 0, 60),
    wordDuration = number(timing.word ?? 0.3, 'word duration', 0, 60),
    lineStart = at + ringDuration,
    wordStart = lineStart + lineDuration,
    end = wordStart + wordDuration;
  number(end, 'label reveal end', 0, 86400);
  scene.component({
    type: 'text',
    props: { text: label.text, fontSize: size, textOutline: outline.commands, textAdvance: outline.advance, fill },
  });
  scene.component({ type: 'circle', props: { r: radius, fill: 'none', stroke, strokeWidth } });
  scene._capacity(4);
  const initial = scene.locate(target, { time: at }),
    m = initial.matrix,
    origin = [m[0] * anchor[0] + m[2] * anchor[1] + m[4], m[1] * anchor[0] + m[3] * anchor[1] + m[5]],
    offset =
      label.at !== undefined
        ? point(label.at, 'label at').map((v, i) => v - origin[i])
        : point(label.offset ?? [80, -100], 'label offset'),
    ringPresence = {
      enter: presenceSpec('enter', at, { style: ringDuration ? 'pop' : 'cut', duration: ringDuration || undefined }),
      exit: null,
      dim: null,
    };
  const geometry = (context) => {
    const p = scene.locate(target, { time: context }).matrix,
      x = p[0] * anchor[0] + p[2] * anchor[1] + p[4],
      y = p[1] * anchor[0] + p[3] * anchor[1] + p[5],
      lx = x + offset[0],
      ly = y + offset[1],
      left = [lx, ly],
      right = [lx + width, ly],
      near = Math.hypot(x - left[0], y - left[1]) <= Math.hypot(x - right[0], y - right[1]) ? left : right,
      far = near === left ? right : left,
      dx = near[0] - x,
      dy = near[1] - y,
      d = Math.hypot(dx, dy),
      rp = { scaleX: 1, scaleY: 1 };
    applyPresence(ringPresence, rp, context.time);
    const r = radius * rp.scaleX;
    assert(d > r, 'INVALID_CALLOUT', 'Underline endpoint intersects the ring.');
    for (const value of [x, y, lx, ly]) number(value, 'label world coordinate');
    const k = wordDuration
        ? easings.easeOut(clamp((context.time - wordStart) / wordDuration))
        : context.time >= wordStart
          ? 1
          : 0,
      hidden = -box.y + pad,
      shown = -(box.y + box.height) - gap;
    return {
      x,
      y,
      lx,
      ly,
      commands: pathCommands([
        ['M', x + (dx / d) * r, y + (dy / d) * r],
        ['L', near[0], near[1]],
        ['L', far[0], far[1]],
      ]),
      baseline: hidden + (shown - hidden) * k,
      opacity: context.time > wordStart || (wordDuration === 0 && context.time >= wordStart) ? 1 : 0,
    };
  };
  geometry(scene._context());
  const state = scene.derive([], geometry);
  return scene._batch(() => {
    const ring = scene.circle({ r: radius, fill: 'none', stroke, strokeWidth }),
      line = scene.path({ fill: 'none', stroke, strokeWidth }),
      labelHandle = scene.group({ clip }),
      word = labelHandle.text({
        text: label.text,
        fontSize: size,
        x: -box.x,
        textOutline: outline.commands,
        textAdvance: outline.advance,
        fill,
      });
    ring.bind(['x', 'y'], { inputs: [state], map: (v) => ({ x: v.x, y: v.y }) });
    line.bind('commands', { inputs: [state], map: (v) => v.commands });
    labelHandle.bind(['x', 'y', 'opacity'], {
      inputs: [state],
      map: (v) => ({ x: v.lx, y: v.ly, opacity: v.opacity }),
    });
    word.bind('y', { inputs: [state], map: (v) => v.baseline });
    ring.enter(at, { style: ringDuration ? 'pop' : 'cut', duration: ringDuration || undefined });
    line.enter(lineStart, { style: 'cut' });
    if (lineDuration)
      line.animate('trimEnd', { from: 0, to: 1, at: lineStart, duration: lineDuration, ease: 'linear' });
    scene._extend(end);
    scene._changed();
    return Object.freeze({ ring, line, label: labelHandle, word });
  });
}
