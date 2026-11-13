import { assert, number, text, options } from '../core/validate.js';
import { validateProperty, properties } from '../core/geometry.js';
import { rows, fieldName } from './transforms.js';

function mapper(value, label) {
  if (value === undefined) return (v) => v;
  assert(typeof value === 'function', 'INVALID_MAPPING', `${label} must be a trusted mapping function.`);
  return value;
}
function missingPolicy(value) {
  const p = value ?? 'gap';
  assert(['gap', 'error'].includes(p), 'INVALID_MAPPING', 'Missing plot points must gap or error.');
  return p;
}
function coordinate(row, field, map, missing) {
  const raw = row[field];
  if (raw === null || raw === undefined) {
    assert(missing === 'gap', 'MISSING_VALUE', `Plot field ${field} is missing.`);
    return null;
  }
  number(raw, `plot ${field}`, -1e100, 1e100);
  const result = map(raw);
  if (result === null || result === undefined) {
    assert(missing === 'gap', 'MISSING_VALUE', `Plot mapping for ${field} is unknown.`);
    return null;
  }
  return number(result, 'plot coordinate');
}
/** Rows remain in supplied order. Null/missing observations break, rather than bridge, a line. */
export function linePath(input, spec = {}) {
  options(spec, ['x', 'y', 'xScale', 'yScale', 'missing'], 'line path');
  const data = rows(input),
    x = fieldName(spec.x ?? 'x'),
    y = fieldName(spec.y ?? 'y'),
    mx = mapper(spec.xScale, 'xScale'),
    my = mapper(spec.yScale, 'yScale'),
    missing = missingPolicy(spec.missing),
    commands = [];
  let open = false;
  for (const row of data) {
    const a = coordinate(row, x, mx, missing),
      b = coordinate(row, y, my, missing);
    if (a === null || b === null) {
      open = false;
      continue;
    }
    commands.push([open ? 'L' : 'M', a, b]);
    open = true;
  }
  return validateProperty('path', 'commands', commands);
}
/** Closed baseline areas; each missing observation ends the current independent segment. */
export function areaPath(input, spec = {}) {
  options(spec, ['x', 'y0', 'y1', 'xScale', 'yScale', 'missing'], 'area path');
  const data = rows(input),
    x = fieldName(spec.x ?? 'x'),
    y0 = fieldName(spec.y0 ?? 'y0'),
    y1 = fieldName(spec.y1 ?? 'y1'),
    mx = mapper(spec.xScale, 'xScale'),
    my = mapper(spec.yScale, 'yScale'),
    missing = missingPolicy(spec.missing),
    commands = [];
  let segment = [];
  function flush() {
    if (!segment.length) return;
    assert(commands.length + 2 * segment.length + 1 <= 10000, 'RESOURCE_LIMIT', 'Area path exceeds 10000 commands.');
    commands.push(
      ...segment.map((p, i) => [i ? 'L' : 'M', p.x, p.y1]),
      ...segment.toReversed().map((p) => ['L', p.x, p.y0]),
      ['Z'],
    );
    segment = [];
  }
  for (const row of data) {
    const a = coordinate(row, x, mx, missing),
      b = coordinate(row, y0, my, missing),
      c = coordinate(row, y1, my, missing);
    if (a === null || b === null || c === null) {
      flush();
      continue;
    }
    segment.push({ x: a, y0: b, y1: c });
  }
  flush();
  return validateProperty('path', 'commands', commands);
}
function defaultFormat(value) {
  return typeof value === 'number' ? Number(value.toPrecision(6)).toString() : String(value);
}
/** A plain component blueprint: no renderer, node or scene mutation during preparation. */
export function axisBlueprint(mapping, spec = {}) {
  options(
    spec,
    ['orientation', 'x', 'y', 'count', 'values', 'format', 'tickSize', 'padding', 'fontSize', 'stroke', 'fill'],
    'axis',
  );
  assert(
    typeof mapping === 'function' && Array.isArray(mapping.range) && mapping.range.length >= 2,
    'INVALID_MAPPING',
    'An axis needs a numeric or band mapping.',
  );
  const orientation = spec.orientation ?? 'bottom';
  assert(
    ['bottom', 'top', 'left', 'right'].includes(orientation),
    'INVALID_MAPPING',
    'Axis orientation must be bottom, top, left or right.',
  );
  const horizontal = ['bottom', 'top'].includes(orientation),
    sign = ['top', 'left'].includes(orientation) ? -1 : 1,
    tickSize = number(spec.tickSize ?? 6, 'tick size', 0, 1000),
    padding = number(spec.padding ?? 4, 'tick padding', 0, 1000),
    fontSize = number(spec.fontSize ?? 12, 'axis font size', 1, 1000),
    format = spec.format ?? defaultFormat;
  assert(typeof format === 'function', 'INVALID_MAPPING', 'Axis format must be a trusted callback.');
  let values = spec.values;
  if (values === undefined) values = mapping.type === 'band' ? mapping.domain : mapping.ticks?.(spec.count ?? 6);
  assert(Array.isArray(values) && values.length <= 512, 'RESOURCE_LIMIT', 'Use at most 512 tick values.');
  // Capture tick values, rejecting getters before author formatting can inspect data.
  const captured = Object.freeze(
    Array.from({ length: values.length }, (_, i) => {
      const descriptor = Object.getOwnPropertyDescriptor(values, i);
      assert(descriptor && 'value' in descriptor, 'INVALID_DATA', 'Tick values must be dense values, not accessors.');
      const v = descriptor.value;
      assert(
        typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)),
        'INVALID_MAPPING',
        'Ticks must be finite scalar values.',
      );
      return v;
    }),
  );
  const lineStyle = properties('line', { stroke: spec.stroke ?? '#637a75' }),
    labelStyle = properties('text', { fontSize, fill: spec.fill ?? '#637a75' }),
    children = Object.create(null),
    start = number(mapping.range[0], 'axis start'),
    end = number(mapping.range.at(-1), 'axis end');
  children.domain = {
    type: 'line',
    props: {
      x1: horizontal ? start : 0,
      y1: horizontal ? 0 : start,
      x2: horizontal ? end : 0,
      y2: horizontal ? 0 : end,
      stroke: lineStyle.stroke,
    },
  };
  captured.forEach((value, i) => {
    const position = number(mapping.type === 'band' ? mapping.center(value) : mapping(value), 'tick position'),
      label = format(value, i);
    text(label, 'tick label', 1000);
    children[`tick${i}`] = {
      type: 'line',
      props: {
        x1: horizontal ? position : 0,
        y1: horizontal ? 0 : position,
        x2: horizontal ? position : sign * tickSize,
        y2: horizontal ? sign * tickSize : position,
        stroke: lineStyle.stroke,
      },
    };
    children[`label${i}`] = {
      type: 'text',
      props: {
        x: horizontal ? position : sign * (tickSize + padding),
        y: horizontal ? sign * (tickSize + padding) : position,
        text: label,
        fontSize,
        fill: labelStyle.fill,
        align: horizontal ? 'middle' : sign < 0 ? 'end' : 'start',
        baseline: horizontal ? (sign > 0 ? 'hanging' : 'alphabetic') : 'middle',
      },
    };
  });
  return Object.freeze({
    type: 'group',
    props: Object.freeze({ x: number(spec.x ?? 0, 'axis x'), y: number(spec.y ?? 0, 'axis y') }),
    children: Object.freeze(
      Object.fromEntries(
        Object.entries(children).map(([key, node]) => [
          key,
          Object.freeze({ ...node, props: Object.freeze(node.props) }),
        ]),
      ),
    ),
  });
}
