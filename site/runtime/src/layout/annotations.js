import { assert, number, options, safeCopy, text } from '../core/validate.js';

const overlap = (a, b, gap = 0) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const contains = (a, b) =>
  b.x >= a.x && b.y >= a.y && b.x + b.width <= a.x + a.width && b.y + b.height <= a.y + a.height;
const pointDistance = (point, rectangle) =>
  Math.hypot(
    Math.max(rectangle.x - point.x, 0, point.x - rectangle.x - rectangle.width),
    Math.max(rectangle.y - point.y, 0, point.y - rectangle.y - rectangle.height),
  );
function box(input, label) {
  options(input, ['x', 'y', 'width', 'height'], label);
  return {
    x: number(input.x ?? 0, `${label} x`),
    y: number(input.y ?? 0, `${label} y`),
    width: number(input.width, `${label} width`, 0, 8192),
    height: number(input.height, `${label} height`, 0, 8192),
  };
}
function luminance(color) {
  if (typeof color !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) return null;
  const hex = color.length === 4 ? [...color.slice(1)].map((c) => c + c).join('') : color.slice(1);
  const values = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function contrast(foreground, backgrounds) {
  const light = luminance(foreground),
    lights = backgrounds.map(luminance);
  if (light === null || !lights.length || lights.some((v) => v === null)) return null;
  return Math.min(...lights.map((v) => (Math.max(v, light) + 0.05) / (Math.min(v, light) + 0.05)));
}
function candidates(anchor, width, height, gap, distanceLimit) {
  const result = [];
  for (const [ring, distance] of [gap, gap + 8, gap + 16, gap + 32, gap + 64].entries()) {
    if (distance > distanceLimit) continue;
    const locations = [
      [anchor.x + distance, anchor.y - height / 2],
      [anchor.x - width - distance, anchor.y - height / 2],
      [anchor.x - width / 2, anchor.y - height - distance],
      [anchor.x - width / 2, anchor.y + distance],
      [anchor.x + distance, anchor.y - height - distance],
      [anchor.x - width - distance, anchor.y - height - distance],
      [anchor.x + distance, anchor.y + distance],
      [anchor.x - width - distance, anchor.y + distance],
    ];
    locations.forEach(([x, y], side) => result.push({ x, y, width, height, placement: `${side}:${ring}` }));
  }
  return result;
}

/** Attention policy over measured CSS-pixel boxes. It never changes marks or authored time. */
export function planAnnotations(input, spec) {
  options(
    spec,
    [
      'bounds',
      'measure',
      'obstacles',
      'background',
      'backdrops',
      'phase',
      'inspectionAge',
      'inspectionDuration',
      'minDwell',
      'settleDelay',
      'minFontSize',
      'minContrast',
      'maxVisible',
      'gap',
      'maxDistance',
      'previous',
      'subjects',
      'associationMargin',
    ],
    'annotation policy',
  );
  const labels = safeCopy(input),
    bounds = box(spec.bounds, 'annotation bounds');
  assert(Array.isArray(labels) && labels.length <= 256, 'RESOURCE_LIMIT', 'Plan at most 256 annotations.');
  assert(
    typeof spec.measure === 'function',
    'INVALID_LABEL_MEASURE',
    'Supply a synchronous font-ready ink-box measurer.',
  );
  const phase = spec.phase ?? 'inspect';
  assert(['inspect', 'motion'].includes(phase), 'ANNOTATION_PHASE', 'Use motion or inspect.');
  const inspectionAge = number(spec.inspectionAge ?? 1, 'inspection age', 0, 86400),
    delay = number(spec.settleDelay ?? 0.15, 'annotation settle delay', 0, 60);
  const inspectionDuration =
    spec.inspectionDuration === undefined ? null : number(spec.inspectionDuration, 'inspection duration', 0, 86400);
  const minimumDwell = number(spec.minDwell ?? 1, 'minimum annotation dwell', 0, 60);
  const minimumSize = number(spec.minFontSize ?? 14, 'minimum annotation size', 1, 200),
    minimumContrast = number(spec.minContrast ?? 4.5, 'minimum contrast', 1, 21);
  const maximum = number(spec.maxVisible ?? 6, 'visible annotation budget', 0, 256);
  assert(Number.isInteger(maximum), 'ANNOTATION_BUDGET', 'Visible annotation budget must be whole.');
  const gap = number(spec.gap ?? 4, 'annotation gap', 0, 1000),
    maximumDistance = number(spec.maxDistance ?? 80, 'annotation distance', 0, 2000);
  const associationMargin = number(spec.associationMargin ?? 2, 'association margin', 0, 100);
  const rawSubjects = spec.subjects === undefined ? null : safeCopy(spec.subjects);
  assert(
    rawSubjects === null || (Array.isArray(rawSubjects) && rawSubjects.length <= 512),
    'RESOURCE_LIMIT',
    'Supply at most 512 semantic subject anchors.',
  );
  const subjects = new Map();
  for (const subject of rawSubjects ?? []) {
    options(subject, ['id', 'x', 'y'], 'annotation subject');
    text(subject.id, 'subject ID', 200);
    assert(subject.id && !subjects.has(subject.id), 'DUPLICATE_ID', 'Subject anchors need unique stable IDs.');
    subjects.set(subject.id, Object.freeze({ x: number(subject.x, 'subject x'), y: number(subject.y, 'subject y') }));
  }
  const rawObstacles = safeCopy(spec.obstacles ?? []),
    rawBackdrops = safeCopy(spec.backdrops ?? []),
    rawPrevious = safeCopy(spec.previous ?? []);
  assert(
    Array.isArray(rawObstacles) &&
      rawObstacles.length <= 512 &&
      Array.isArray(rawBackdrops) &&
      rawBackdrops.length <= 64 &&
      Array.isArray(rawPrevious) &&
      rawPrevious.length <= 256,
    'RESOURCE_LIMIT',
    'Annotation obstacles/backgrounds/history exceed their budgets.',
  );
  const obstacles = rawObstacles.map((value) => box(value, 'annotation obstacle'));
  const backdrops = rawBackdrops.map((value) => {
    options(value, ['bounds', 'color'], 'annotation backdrop');
    return { bounds: box(value.bounds, 'backdrop bounds'), color: value.color };
  });
  const previous = new Map(
    rawPrevious.map((value) => {
      options(value, ['id', 'placement'], 'previous annotation');
      text(value.id, 'previous ID', 200);
      text(value.placement, 'previous placement', 50);
      return [value.id, value.placement];
    }),
  );
  const ids = new Set();
  const prepared = labels
    .map((label) => {
      options(
        label,
        ['id', 'text', 'anchor', 'fontSize', 'essential', 'priority', 'when', 'color', 'contrastColors', 'association'],
        'annotation',
      );
      text(label.id, 'annotation ID', 200);
      text(label.text, 'annotation text');
      assert(label.id && !ids.has(label.id), 'DUPLICATE_ID', 'Annotations need stable unique nonempty IDs.');
      ids.add(label.id);
      options(label.anchor, ['x', 'y'], 'annotation anchor');
      const anchor = { x: number(label.anchor.x, 'anchor x'), y: number(label.anchor.y, 'anchor y') };
      const association = label.association ?? 'nearest';
      assert(
        ['nearest', 'highlighted'].includes(association),
        'ANNOTATION_SUBJECT',
        'Use nearest association or declare an actually highlighted subject.',
      );
      if (rawSubjects !== null)
        assert(
          subjects.has(label.id) &&
            Math.hypot(subjects.get(label.id).x - anchor.x, subjects.get(label.id).y - anchor.y) < 1e-6,
          'ANNOTATION_SUBJECT',
          'Annotation and declared subject IDs/anchors must agree.',
        );
      const essential = label.essential ?? false;
      assert(typeof essential === 'boolean', 'ANNOTATION_REQUIRED', 'essential must be boolean.');
      const when = label.when ?? 'auto';
      assert(
        ['auto', 'always', 'inspect'].includes(when),
        'ANNOTATION_PHASE',
        'Use auto, always or inspect for annotation timing.',
      );
      const color = label.color ?? '#293b35',
        colors = label.contrastColors ?? [];
      text(color, 'annotation color', 100);
      assert(
        Array.isArray(colors) && colors.length <= 8,
        'RESOURCE_LIMIT',
        'Supply at most eight approved contrast colors.',
      );
      colors.forEach((c) => text(c, 'contrast color', 100));
      return {
        ...label,
        anchor,
        essential,
        when,
        color,
        colors,
        association,
        fontSize: Math.max(minimumSize, number(label.fontSize ?? minimumSize, 'annotation font size', 1, 200)),
        priority: number(label.priority ?? 0, 'annotation priority', -1e6, 1e6),
      };
    })
    .sort(
      (a, b) =>
        Number(b.essential) - Number(a.essential) ||
        b.priority - a.priority ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const visible = [],
    deferred = [],
    diagnostics = [];
  const defer = (label, reason) => {
    deferred.push(Object.freeze({ id: label.id, essential: label.essential, reason }));
    if (label.essential)
      diagnostics.push(
        Object.freeze({
          id: label.id,
          code: reason,
          repair:
            reason === 'space' || reason === 'budget'
              ? 'Provide more space or author an inspection phase; do not silently drop required content.'
              : 'Supply a verified readable style/background or revise the active cue.',
        }),
      );
  };
  for (const label of prepared) {
    if (
      phase === 'inspect' &&
      label.when !== 'always' &&
      inspectionDuration !== null &&
      inspectionDuration - delay < minimumDwell
    ) {
      defer(label, 'shortInspection');
      continue;
    }
    if (
      label.when !== 'always' &&
      (!label.essential || label.when === 'inspect') &&
      (phase === 'motion' || inspectionAge < delay)
    ) {
      defer(label, phase === 'motion' ? 'motion' : 'settling');
      continue;
    }
    if (visible.length >= maximum) {
      defer(label, 'budget');
      continue;
    }
    const measured = spec.measure(label.text, { fontSize: label.fontSize });
    options(measured, ['width', 'height', 'offsetX', 'baseline'], 'annotation measurement');
    const width = number(measured.width, 'annotation ink width', Number.MIN_VALUE, 8192),
      height = number(measured.height, 'annotation ink height', Number.MIN_VALUE, 8192);
    const offsetX = number(measured.offsetX ?? 0, 'annotation origin x', -8192, 8192),
      baseline = number(measured.baseline ?? height * 0.8, 'annotation baseline', 0, 8192);
    const choices = candidates(label.anchor, width, height, gap, maximumDistance);
    const preferred = previous.get(label.id);
    choices.sort((a, b) => Number(b.placement === preferred) - Number(a.placement === preferred));
    let chosen = null,
      reason = 'space';
    for (const candidate of choices) {
      if (!contains(bounds, candidate) || [...obstacles, ...visible].some((other) => overlap(candidate, other, gap)))
        continue;
      if (
        rawSubjects !== null &&
        label.association === 'nearest' &&
        [...subjects].some(
          ([id, subject]) =>
            id !== label.id &&
            pointDistance(subject, candidate) < pointDistance(label.anchor, candidate) + associationMargin,
        )
      ) {
        reason = 'association';
        continue;
      }
      const intersecting = backdrops.filter((region) => overlap(candidate, region.bounds));
      const covering = intersecting.findLast((region) => contains(region.bounds, candidate));
      const backgrounds = covering
        ? intersecting.slice(intersecting.indexOf(covering)).map((region) => region.color)
        : [spec.background ?? null, ...intersecting.map((region) => region.color)];
      let readable = null;
      for (const color of [label.color, ...label.colors]) {
        const ratio = contrast(color, backgrounds);
        if (ratio !== null && ratio >= minimumContrast) {
          readable = { color, contrast: ratio };
          break;
        }
      }
      if (!readable) {
        reason = backgrounds.some((color) => luminance(color) === null) ? 'contrastUnknown' : 'contrast';
        continue;
      }
      chosen = Object.freeze({
        ...candidate,
        id: label.id,
        text: label.text,
        fontSize: label.fontSize,
        essential: label.essential,
        textX: candidate.x + offsetX,
        textY: candidate.y + baseline,
        associationEvidence:
          rawSubjects === null
            ? 'unverified'
            : label.association === 'nearest'
              ? 'nearestVerified'
              : 'declaredHighlight',
        ...readable,
      });
      break;
    }
    if (chosen) visible.push(chosen);
    else defer(label, reason);
  }
  const required = prepared.filter((label) => label.essential).length,
    optional = prepared.length - required;
  const placedRequired = visible.filter((label) => label.essential).length,
    placedOptional = visible.length - placedRequired;
  const slots = new Map([...previous].filter(([id]) => ids.has(id)));
  visible.forEach((label) => slots.set(label.id, label.placement));
  return Object.freeze({
    status: diagnostics.length ? 'needsAttention' : 'ready',
    visible: Object.freeze(visible),
    deferred: Object.freeze(deferred),
    diagnostics: Object.freeze(diagnostics),
    metrics: Object.freeze({
      required,
      placedRequired,
      essentialCoverage: required ? placedRequired / required : 1,
      optional,
      placedOptional,
      deferredOptional: optional - placedOptional,
      total: prepared.length,
      dwellWindowVerified: phase === 'inspect' && inspectionDuration !== null,
      unverifiedAssociations: visible.filter((label) => label.associationEvidence === 'unverified').length,
    }),
    next: Object.freeze([...slots].map(([id, placement]) => Object.freeze({ id, placement }))),
  });
}
