import { assert, number, options, safeCopy } from '../core/validate.js';
import { measurePath } from '../geometry/path.js';

const TAU = 2 * Math.PI,
  freeze = (p) => Object.freeze(p),
  distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function tangentProfile(path) {
  const directions = [],
    distances = [0],
    points = path.points;
  let total = 0,
    angle = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      direction = Math.atan2(b.y - a.y, b.x - a.x);
    if (i === 1) angle = direction;
    else angle += turn(directions.at(-1).direction, direction);
    directions.push({ direction, angle });
    total += distance(a, b);
    distances.push(total);
  }
  const initial = directions[0].angle,
    totalTurn = path.closed
      ? directions.at(-1).angle - initial + turn(directions.at(-1).direction, directions[0].direction)
      : 0;
  return freeze({
    totalTurn,
    at(fraction) {
      const target = fraction * path.length;
      let i = 0;
      while (i < directions.length - 1 && distances[i + 1] < target) i++;
      return directions[i].angle - initial;
    },
  });
}
function point(input = {}, label = 'point') {
  options(input, ['x', 'y'], label);
  return freeze({ x: number(input.x ?? 0, `${label} x`), y: number(input.y ?? 0, `${label} y`) });
}
function branch(value = 1) {
  assert(value === 1 || value === -1, 'INVALID_MECHANISM', 'A geometric branch must be +1 or -1.');
  return value;
}
function radius(value, label = 'radius') {
  return number(value, label, 1e-6, 1e5);
}

/**
 * Closed involute gear outline, one tooth centred on +x before rotation. Pitch radius is teeth×module/2,
 * addendum one module, dedendum 1.25 modules. Teeth below 17 are drawn without undercut correction.
 */
export function gearPath(spec = {}) {
  options(spec, ['teeth', 'module', 'pressureAngle', 'x', 'y', 'rotation', 'samples', 'bore'], 'gear path');
  const n = number(spec.teeth ?? 20, 'gear teeth', 6, 400);
  assert(Number.isInteger(n), 'INVALID_MECHANISM', 'Teeth must be an integer.');
  const m = number(spec.module ?? 2, 'gear module', 1e-6, 1e4),
    alpha = number(spec.pressureAngle ?? Math.PI / 9, 'pressure angle', Math.PI / 36, Math.PI / 4),
    cx = number(spec.x ?? 0, 'gear x'),
    cy = number(spec.y ?? 0, 'gear y'),
    localTurn1 = number(spec.rotation ?? 0, 'gear rotation');
  const samples = number(spec.samples ?? 6, 'flank samples', 2, 32);
  assert(Number.isInteger(samples), 'INVALID_MECHANISM', 'Flank samples must be an integer.');
  const r = (n * m) / 2,
    base = r * Math.cos(alpha),
    tip = r + m,
    root = Math.max(r - 1.25 * m, m * 0.25),
    inv = (a) => Math.tan(a) - a;
  // Angle from the tooth centre line to its flank at radius rho.
  const flank = (rho) => Math.PI / (2 * n) + inv(alpha) - (rho > base ? inv(Math.acos(base / rho)) : 0);
  const halfTip = Math.max(0, flank(tip)),
    pitch = (2 * Math.PI) / n,
    points = [];
  const at = (rho, angle) => {
    const x = cx + rho * Math.cos(angle + localTurn1),
      y = cy + rho * Math.sin(angle + localTurn1),
      last = points.at(-1);
    if (!last || Math.hypot(x - last[0], y - last[1]) > 1e-9 * rho) points.push([x, y]);
  };
  const radii = [
    ...(root < base ? [root] : []),
    ...Array.from(
      { length: samples + 1 },
      (_, i) => Math.max(root, base) + ((tip - Math.max(root, base)) * i) / samples,
    ),
  ];
  for (let k = 0; k < n; k++) {
    const c = k * pitch;
    for (const rho of radii) at(rho, c - Math.min(flank(rho), pitch / 2));
    at(tip, c - halfTip);
    at(tip, c);
    at(tip, c + halfTip);
    for (const rho of radii.toReversed()) at(rho, c + Math.min(flank(rho), pitch / 2));
    const from = c + Math.min(flank(root), pitch / 2),
      to = c + pitch - Math.min(flank(root), pitch / 2);
    for (let i = 1; i < 4; i++) at(root, from + ((to - from) * i) / 4);
  }
  const commands = points.map(([x, y], i) => [i ? 'L' : 'M', x, y]);
  commands.push(['Z']);
  if (spec.bore !== undefined) {
    const b = number(spec.bore, 'bore radius', 0, root * 0.95);
    if (b > 0) {
      for (let i = 0; i <= 32; i++) {
        const a = (-i / 32) * Math.PI * 2;
        commands.push([i ? 'L' : 'M', cx + b * Math.cos(a), cy + b * Math.sin(a)]);
      }
      commands.push(['Z']);
    }
  }
  return Object.freeze(commands.map((c) => Object.freeze(c)));
}

/** Phase for meshWith so a driven gear's gap faces the driver's tooth along the line between centres. */
export function meshPhase(driver, driven) {
  for (const [g, label] of [
    [driver, 'driver'],
    [driven, 'driven'],
  ]) {
    options(g, ['id', 'x', 'y', 'teeth', 'module', 'radius', 'phase', 'ratio'], `${label} gear`);
    number(g.x ?? 0, `${label} x`);
    number(g.y ?? 0, `${label} y`);
    number(g.teeth, `${label} teeth`, 3, 10000);
  }
  const theta = Math.atan2((driven.y ?? 0) - (driver.y ?? 0), (driven.x ?? 0) - (driver.x ?? 0));
  return theta + Math.PI + Math.PI / driven.teeth + (driver.teeth / driven.teeth) * theta;
}

/** Slider point constrained to a line, at exact rod distance from the crank tip. */
export function sliderCrank(spec = {}) {
  options(spec, ['center', 'radius', 'angle', 'rod', 'slider', 'branch'], 'slider crank');
  const center = point(spec.center),
    r = radius(spec.radius),
    angle = number(spec.angle ?? 0, 'crank angle'),
    rod = radius(spec.rod, 'connecting rod'),
    slider = spec.slider ?? {};
  options(slider, ['x', 'y', 'angle'], 'slider line');
  const origin = point({ x: slider.x ?? center.x, y: slider.y ?? center.y }),
    axis = number(slider.angle ?? 0, 'slider angle'),
    sign = branch(spec.branch),
    u = { x: Math.cos(axis), y: Math.sin(axis) },
    tip = freeze({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) }),
    dx = tip.x - origin.x,
    dy = tip.y - origin.y,
    along = dx * u.x + dy * u.y,
    normal = dx * -u.y + dy * u.x;
  const remaining = (rod - Math.abs(normal)) * (rod + Math.abs(normal));
  assert(remaining >= -1e-10 * rod * rod, 'MECHANISM_UNREACHABLE', 'The connecting rod cannot reach the slider line.');
  const position = along + sign * Math.sqrt(Math.max(0, remaining)),
    end = freeze({ x: origin.x + position * u.x, y: origin.y + position * u.y });
  return freeze({
    type: 'sliderCrank',
    center,
    radius: r,
    angle,
    tip,
    slider: end,
    rod,
    position,
    rotation: Math.atan2(end.y - tip.y, end.x - tip.x),
    residual: Math.abs(distance(tip, end) - rod),
  });
}

/** Exact external/internal common tangents of two pulley pitch circles. */
export function beltGeometry(spec = {}) {
  options(spec, ['a', 'b', 'crossed'], 'belt');
  const a = spec.a,
    b = spec.b;
  for (const [name, v] of [
    ['a', a],
    ['b', b],
  ]) {
    options(v, ['x', 'y', 'radius'], `pulley ${name}`);
    number(v.x, `${name} x`);
    number(v.y, `${name} y`);
    radius(v.radius, `${name} radius`);
  }
  const crossed = spec.crossed ?? false;
  assert(typeof crossed === 'boolean', 'INVALID_MECHANISM', 'crossed must be boolean.');
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy),
    difference = crossed ? a.radius + b.radius : a.radius - b.radius;
  assert(d > Math.abs(difference), 'MECHANISM_UNREACHABLE', 'Pulley geometry has no nondegenerate common tangents.');
  // Real separate pulleys cannot overlap, even if algebraic outer tangents exist.
  assert(d >= a.radius + b.radius, 'MECHANISM_OVERLAP', 'Separate belt pulleys cannot overlap their pitch circles.');
  const heading = Math.atan2(dy, dx),
    phi = Math.acos(difference / d),
    sign = crossed ? -1 : 1;
  const segments = [heading + phi, heading - phi].map((angle) => {
    const n = { x: Math.cos(angle), y: Math.sin(angle) };
    return freeze({
      a: freeze({ x: a.x + a.radius * n.x, y: a.y + a.radius * n.y }),
      b: freeze({ x: b.x + sign * b.radius * n.x, y: b.y + sign * b.radius * n.y }),
    });
  });
  const straight = Math.sqrt((d - Math.abs(difference)) * (d + Math.abs(difference))),
    wrapA = TAU - 2 * phi,
    wrapB = crossed ? wrapA : 2 * phi,
    length = number(2 * straight + a.radius * wrapA + b.radius * wrapB, 'belt length', 0, 1e7);
  return freeze({
    segments: freeze(segments),
    length,
    straight,
    wrapA,
    wrapB,
    crossed,
    ratio: ((crossed ? -1 : 1) * a.radius) / b.radius,
  });
}

/** A bounded DAG of solved 2D relations, driven by one scalar input. */
export function mechanism(spec = {}) {
  options(spec, ['maxNodes'], 'mechanism');
  const max = number(spec.maxNodes ?? 128, 'mechanism node cap', 1, 256);
  assert(Number.isInteger(max), 'INVALID_MECHANISM', 'Node cap must be an integer.');
  const nodes = new Map(),
    handles = new WeakMap();
  let sequence = 0;
  const checkedId = (value) => {
    const id = value ?? `part${++sequence}`;
    assert(
      typeof id === 'string' &&
        /^[A-Za-z][\w-]{0,63}$/.test(id) &&
        !['constructor', 'prototype', '__proto__'].includes(id),
      'INVALID_MECHANISM',
      'Use a short nonreserved part ID.',
    );
    assert(!nodes.has(id), 'DUPLICATE_ID', `Duplicate mechanism ID ${id}.`);
    return id;
  };
  function existing(handle) {
    const node = handles.get(handle);
    assert(node, 'FOREIGN_MECHANISM', 'Use a part from this mechanism.');
    return node;
  }
  function acyclic(node, parent) {
    for (let current = parent; current; current = current.driver?.parent) {
      assert(current !== node, 'MECHANISM_CYCLE', 'Mechanism relations must remain acyclic.');
    }
  }
  function sample(input = 0) {
    number(input, 'mechanism input');
    const result = Object.create(null),
      visiting = new Set();
    function evaluate(node) {
      if (result[node.id]) return result[node.id];
      assert(!visiting.has(node.id), 'MECHANISM_CYCLE', 'Mechanism relations contain a cycle.');
      visiting.add(node.id);
      let out;
      const angle = () =>
        node.driver
          ? node.driver.phase + node.driver.ratio * evaluate(node.driver.parent).rotation
          : node.phase + node.ratio * input;
      if (node.type === 'wheel' || node.type === 'gear') {
        if (node.roll) {
          const signedDistance = node.roll.offset + node.roll.ratio * input,
            fraction = signedDistance / node.roll.path.length;
          assert(
            node.roll.outside !== 'error' || (fraction >= 0 && fraction <= 1),
            'MECHANISM_OUTSIDE_PATH',
            'The rolling contact left its declared path.',
          );
          const f = node.roll.outside === 'wrap' ? ((fraction % 1) + 1) % 1 : Math.max(0, Math.min(1, fraction)),
            contact = node.roll.path.at(f),
            actualDistance = node.roll.outside === 'clamp' ? f * node.roll.path.length : signedDistance;
          const cycles = node.roll.outside === 'wrap' ? Math.floor(signedDistance / node.roll.path.length) : 0;
          const rotation =
            node.phase +
            cycles * node.roll.profile.totalTurn +
            node.roll.profile.at(f) -
            (node.roll.side * actualDistance) / node.radius;
          out = {
            id: node.id,
            type: node.type,
            x: contact.x - node.roll.side * node.radius * Math.sin(contact.rotation),
            y: contact.y + node.roll.side * node.radius * Math.cos(contact.rotation),
            radius: node.radius,
            rotation,
            contact,
            distance: actualDistance,
          };
        } else
          out = {
            id: node.id,
            type: node.type,
            x: node.center.x,
            y: node.center.y,
            radius: node.radius,
            rotation: angle(),
            teeth: node.teeth ?? null,
          };
      } else if (node.type === 'crank') {
        const rotation = angle();
        out = {
          id: node.id,
          type: 'crank',
          x: node.center.x,
          y: node.center.y,
          radius: node.radius,
          rotation,
          tip: freeze({
            x: node.center.x + node.radius * Math.cos(rotation),
            y: node.center.y + node.radius * Math.sin(rotation),
          }),
        };
      } else if (node.type === 'linkage') {
        const driver = evaluate(node.parent),
          geometry = sliderCrank({
            center: { x: driver.x, y: driver.y },
            radius: driver.radius,
            angle: driver.rotation,
            rod: node.length,
            slider: node.slider,
            branch: node.branch,
          });
        out = { ...geometry, id: node.id, type: 'linkage', start: geometry.tip, end: geometry.slider };
      } else {
        const a = evaluate(node.a),
          b = evaluate(node.b);
        out = { ...node.geometry, id: node.id, type: 'belt', rotationA: a.rotation, rotationB: b.rotation };
      }
      for (const key of ['x', 'y', 'rotation', 'angle', 'distance', 'position', 'rotationA', 'rotationB'])
        if (out[key] !== undefined) number(out[key], `mechanism ${key}`);
      visiting.delete(node.id);
      return (result[node.id] = freeze(out));
    }
    for (const node of nodes.values()) evaluate(node);
    return freeze(result);
  }
  function add(type, localSpec2) {
    options(localSpec2, ['id', 'x', 'y', 'radius', 'teeth', 'module', 'phase', 'ratio'], type);
    assert(nodes.size < max, 'RESOURCE_LIMIT', 'Mechanism exceeds its node cap.');
    const id = checkedId(localSpec2.id),
      center = point({ x: localSpec2.x ?? 0, y: localSpec2.y ?? 0 }),
      phase = number(localSpec2.phase ?? 0, 'phase'),
      ratio = number(localSpec2.ratio ?? 1, 'input ratio');
    let teeth = null,
      r;
    if (type === 'gear') {
      teeth = number(localSpec2.teeth ?? 20, 'gear teeth', 3, 10000);
      assert(Number.isInteger(teeth), 'INVALID_MECHANISM', 'Teeth must be an integer.');
      const module = number(localSpec2.module ?? 2, 'gear module', 1e-6, 1e4);
      r = localSpec2.radius === undefined ? (teeth * module) / 2 : radius(localSpec2.radius);
      assert(
        Math.abs((2 * r) / teeth - module) <= 1e-10 * Math.max(1, module),
        'GEAR_MODULE_MISMATCH',
        'Gear radius must agree with teeth and module.',
      );
    } else {
      assert(
        localSpec2.teeth === undefined && localSpec2.module === undefined,
        'INVALID_MECHANISM',
        'Teeth/module belong to gears.',
      );
      r = radius(localSpec2.radius ?? 50);
    }
    r = radius(r);
    const node = { id, type, center, radius: r, teeth, phase, ratio, driver: null, roll: null, fixedCenter: false };
    const handle = {
      id,
      sample: (input) => sample(input)[id],
      roll(settings = {}) {
        assert(type === 'wheel', 'INVALID_MECHANISM', 'Only wheels can roll on a path.');
        options(settings, ['on', 'offset', 'ratio', 'side', 'outside', 'tolerance'], 'rolling wheel');
        assert(
          !node.driver && !node.roll && !node.fixedCenter,
          'MECHANISM_OWNED',
          'A wheel can have one motion relation and cannot roll after joining a fixed-center belt.',
        );
        const path = measurePath(settings.on, { tolerance: settings.tolerance ?? 0.25 }),
          outside = settings.outside ?? (path.closed ? 'wrap' : 'error');
        assert(
          ['wrap', 'clamp', 'error'].includes(outside),
          'INVALID_MECHANISM',
          'Use wrap, clamp or error outside a path.',
        );
        assert(outside !== 'wrap' || path.closed, 'INVALID_MECHANISM', 'Only a closed path can wrap.');
        node.roll = freeze({
          path,
          profile: tangentProfile(path),
          outside,
          offset: number(settings.offset ?? 0, 'initial arc distance'),
          ratio: number(settings.ratio ?? 1, 'distance/input ratio'),
          side: branch(settings.side),
        });
        return handle;
      },
      meshWith(other, settings = {}) {
        assert(type === 'gear', 'INVALID_MECHANISM', 'Only a gear can mesh with another gear.');
        options(settings, ['internal', 'phase', 'tolerance'], 'gear mesh');
        const parent = existing(other);
        assert(parent.type === 'gear', 'INVALID_MECHANISM', 'Mesh with another gear.');
        assert(!node.driver && !node.roll, 'MECHANISM_OWNED', 'A gear can have only one driver.');
        acyclic(node, parent);
        const internal = settings.internal ?? false;
        assert(typeof internal === 'boolean', 'INVALID_MECHANISM', 'internal must be boolean.');
        assert(
          !internal || parent.radius !== node.radius,
          'MECHANISM_UNREACHABLE',
          'Equal internal gears do not define a mesh.',
        );
        const pitchA = (2 * node.radius) / node.teeth,
          pitchB = (2 * parent.radius) / parent.teeth,
          tolerance = number(settings.tolerance ?? 1e-6, 'mesh tolerance', 0, 1e3),
          expected = internal ? Math.abs(parent.radius - node.radius) : parent.radius + node.radius;
        assert(
          Math.abs(pitchA - pitchB) <= tolerance,
          'GEAR_MODULE_MISMATCH',
          'Meshing gears must have the same module.',
        );
        assert(
          Math.abs(distance(node.center, parent.center) - expected) <= tolerance,
          'GEAR_CENTER_MISMATCH',
          'Gear centers must match the pitch-circle mesh distance.',
        );
        // 'interlock' faces this gear's gap toward the driver's tooth along the line between centres.
        const interlock = settings.phase === 'interlock';
        assert(!interlock || !internal, 'INVALID_MECHANISM', 'interlock phase is defined for external gears.');
        node.driver = freeze({
          parent,
          phase: interlock
            ? meshPhase(
                { x: parent.center.x, y: parent.center.y, teeth: parent.teeth },
                { x: node.center.x, y: node.center.y, teeth: node.teeth },
              )
            : number(settings.phase ?? node.phase, 'mesh phase'),
          ratio: ((internal ? 1 : -1) * parent.teeth) / node.teeth,
        });
        return handle;
      },
    };
    if (type !== 'wheel') delete handle.roll;
    if (type !== 'gear') delete handle.meshWith;
    nodes.set(id, node);
    handles.set(handle, node);
    return freeze(handle);
  }
  return freeze({
    wheel: (localSpec3) => add('wheel', localSpec3 ?? {}),
    gear: (localSpec4) => add('gear', localSpec4 ?? {}),
    crank: (localSpec5) => add('crank', localSpec5 ?? {}),
    sample,
    linkage(localSpec6 = {}) {
      options(localSpec6, ['id', 'crank', 'length', 'slider', 'branch'], 'linkage');
      assert(nodes.size < max, 'RESOURCE_LIMIT', 'Mechanism exceeds its node cap.');
      const parent = existing(localSpec6.crank);
      assert(parent.type === 'crank', 'INVALID_MECHANISM', 'A slider linkage needs a crank.');
      const id = checkedId(localSpec6.id),
        length = radius(localSpec6.length, 'rod length'),
        slider = safeCopy(localSpec6.slider ?? { x: parent.center.x, y: parent.center.y, angle: 0 }),
        sign = branch(localSpec6.branch);
      options(slider, ['x', 'y', 'angle'], 'slider');
      for (const [k, v] of Object.entries(slider)) number(v, `slider ${k}`);
      const node = { id, type: 'linkage', parent, length, slider, branch: sign };
      sliderCrank({
        center: parent.center,
        radius: parent.radius,
        angle: parent.phase,
        rod: length,
        slider,
        branch: sign,
      });
      const handle = freeze({ id, sample: (input) => sample(input)[id] });
      nodes.set(id, node);
      handles.set(handle, node);
      return handle;
    },
    belt(localSpec7 = {}) {
      options(localSpec7, ['id', 'a', 'b', 'crossed', 'phase'], 'belt relation');
      assert(nodes.size < max, 'RESOURCE_LIMIT', 'Mechanism exceeds its node cap.');
      const a = existing(localSpec7.a),
        b = existing(localSpec7.b);
      assert(
        ['wheel', 'gear'].includes(a.type) && ['wheel', 'gear'].includes(b.type),
        'INVALID_MECHANISM',
        'A belt needs two wheels or gears as pitch pulleys.',
      );
      assert(
        !a.roll && !b.roll && !b.driver,
        'MECHANISM_OWNED',
        'Belt pulleys must be fixed-center, and the driven pulley must be unowned.',
      );
      acyclic(b, a);
      const geometry = beltGeometry({
          a: { ...a.center, radius: a.radius },
          b: { ...b.center, radius: b.radius },
          crossed: localSpec7.crossed ?? false,
        }),
        phase = number(localSpec7.phase ?? b.phase, 'belt phase'),
        id = checkedId(localSpec7.id);
      a.fixedCenter = true;
      b.fixedCenter = true;
      b.driver = freeze({ parent: a, ratio: geometry.ratio, phase });
      const node = { id, type: 'belt', a, b, geometry };
      const handle = freeze({ id, sample: (input) => sample(input)[id] });
      nodes.set(id, node);
      handles.set(handle, node);
      return handle;
    },
    derive(scene, input) {
      return scene.derive([input], (value) => sample(value));
    },
    get size() {
      return nodes.size;
    },
  });
}
