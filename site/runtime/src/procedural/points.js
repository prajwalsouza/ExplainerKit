import { assert, number, options, safeCopy } from '../core/validate.js';
import { seedValue, randomAt } from '../noise/vector.js';
import { flattenPath } from '../morph/contour.js';
import { measurePath } from '../geometry/path.js';
import { Scene } from '../core/scene.js';
import { localMatrix, multiplyAffine } from '../core/transform.js';
import { pointSet } from './point-set.js';
import { densityPoints } from './density-points.js';
import { networkPoints } from './network-points.js';

const MAX_POINTS = 100000,
  MAX_WORK = 20000000;
function workBudget() {
  let work = 0;
  return {
    tick(count = 1) {
      work += count;
      assert(work <= MAX_WORK, 'RESOURCE_LIMIT', 'Procedural generation exceeded its bounded candidate/geometry work.');
    },
    get used() {
      return work;
    },
  };
}
function vector(input, length, label) {
  const value = safeCopy(input);
  assert(
    Array.isArray(value) && value.length === length,
    'PROCEDURAL_REGION',
    `${label} needs ${length} numeric entries.`,
  );
  return value.map((v) => number(v, label));
}
function region(input, budget) {
  const record = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, '_record')?.value : null;
  const owner = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, '_scene')?.value : null;
  if (record && owner instanceof Scene) {
    owner._recordDepth(record);
    let found = null;
    const visit = (node, parent) => {
      const matrix = multiplyAffine(parent, localMatrix(node.props, node));
      if (node.id === record.id) found = { node, matrix };
      for (const child of node.children ?? []) visit(child, matrix);
    };
    for (const node of owner.sampleWorld({ time: 0 }).children) visit(node, [1, 0, 0, 1, 0, 0]);
    assert(
      found && ['circle', 'rect', 'path'].includes(found.node.type),
      'PROCEDURAL_REGION',
      'Handle regions support a captured circle, rectangle or single-contour path at time zero.',
    );
    const { node, matrix } = found,
      p = node.props;
    let commands;
    if (node.type === 'path') commands = p.commands;
    else if (node.type === 'rect') {
      assert(!p.rx, 'PROCEDURAL_REGION', 'Use explicit path commands for a rounded rectangle region.');
      commands = [['M', 0, 0], ['L', p.width, 0], ['L', p.width, p.height], ['L', 0, p.height], ['Z']];
    } else
      commands = [
        ...Array.from({ length: 128 }, (_, i) => {
          const a = (i * Math.PI * 2) / 128;
          return [i ? 'L' : 'M', Math.cos(a) * p.r, Math.sin(a) * p.r];
        }),
        ['Z'],
      ];
    return region(
      {
        polygon: commands.map((command) => {
          const result = [command[0]];
          for (let i = 1; i < command.length; i += 2)
            result.push(
              matrix[0] * command[i] + matrix[2] * command[i + 1] + matrix[4],
              matrix[1] * command[i] + matrix[3] * command[i + 1] + matrix[5],
            );
          return result;
        }),
      },
      budget,
    );
  }
  options(input, ['rect', 'circle', 'polygon'], 'point region');
  assert(Object.keys(input).length === 1, 'PROCEDURAL_REGION', 'Choose exactly one rectangle, circle or polygon.');
  if (input.rect) {
    const [x, y, width, height] = vector(input.rect, 4, 'point rectangle');
    assert(width > 0 && height > 0, 'PROCEDURAL_REGION', 'Point rectangles need positive dimensions.');
    number(x + width, 'rectangle right');
    number(y + height, 'rectangle bottom');
    return {
      x,
      y,
      width,
      height,
      area: width * height,
      kind: 'rect',
      contains(px, py) {
        budget.tick();
        return px >= x && px <= x + width && py >= y && py <= y + height;
      },
      random(u, v) {
        return [x + u * width, y + v * height];
      },
    };
  }
  if (input.circle) {
    const [x, y, radius] = vector(input.circle, 3, 'point circle');
    assert(radius > 0, 'PROCEDURAL_REGION', 'Point circles need a positive radius.');
    for (const edge of [x - radius, x + radius, y - radius, y + radius]) number(edge, 'circle edge');
    return {
      x: x - radius,
      y: y - radius,
      width: 2 * radius,
      height: 2 * radius,
      area: Math.PI * radius * radius,
      contains(px, py) {
        budget.tick();
        return Math.hypot(px - x, py - y) <= radius;
      },
      random(u, v) {
        const r = Math.sqrt(u) * radius,
          angle = v * Math.PI * 2;
        return [x + r * Math.cos(angle), y + r * Math.sin(angle)];
      },
    };
  }
  assert(input.polygon, 'PROCEDURAL_REGION', 'Supply polygon commands.');
  const outline = flattenPath(input.polygon, { tolerance: 0.1, maxPoints: 1024 });
  assert(
    outline.closed && outline.points.length >= 4,
    'PROCEDURAL_REGION',
    'Point polygons need one closed positive-area contour.',
  );
  const vertices = outline.points.slice(0, -1),
    xs = vertices.map((p) => p.x),
    ys = vertices.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    width = Math.max(...xs) - x,
    height = Math.max(...ys) - y;
  const area =
    Math.abs(
      vertices.reduce((sum, p, i) => {
        const q = vertices[(i + 1) % vertices.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0),
    ) / 2;
  assert(area > 0 && width > 0 && height > 0, 'PROCEDURAL_REGION', 'Point polygon area must be positive.');
  return {
    x,
    y,
    width,
    height,
    area,
    contains(px, py) {
      budget.tick(vertices.length);
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const a = vertices[i],
          b = vertices[j];
        if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
      }
      return inside;
    },
    random(u, v) {
      return [x + u * width, y + v * height];
    },
  };
}
function integerCount(value) {
  number(value, 'point count', 0, 1e100);
  assert(Number.isInteger(value), 'PROCEDURAL_COUNT', 'Point count must be a whole number.');
  assert(value <= MAX_POINTS, 'RESOURCE_LIMIT', `A point set accepts at most ${MAX_POINTS} points.`);
  return value;
}

function along(spec, seed) {
  assert(
    spec.in === undefined && spec.density === undefined && spec.method === undefined && spec.minDistance === undefined,
    'PROCEDURAL_REGION',
    'Along-path sampling has its own count/spacing contract.',
  );
  assert(
    !(spec.count !== undefined && spec.spacing !== undefined),
    'PROCEDURAL_COUNT',
    'Choose count or spacing along a path.',
  );
  const path = measurePath(spec.along, {
    tolerance: number(spec.tolerance ?? 0.1, 'path tolerance', 1e-5, 1000),
    maxPoints: 8192,
  });
  const spacing = spec.spacing === undefined ? null : number(spec.spacing, 'path spacing', 1e-6, 1e7);
  const count = integerCount(
    spec.count ??
      (spacing ? (path.closed ? Math.ceil(path.length / spacing) : Math.floor(path.length / spacing) + 1) : 100),
  );
  const jitter = number(spec.jitter ?? 0, 'path normal jitter', 0, 1e5),
    x = new Float32Array(count),
    y = new Float32Array(count),
    rotations = [];
  for (let i = 0; i < count; i++) {
    const fraction = spacing
      ? Math.min(1, (i * spacing) / path.length)
      : count <= 1
        ? 0
        : i / (path.closed ? count : count - 1);
    const p = path.at(fraction),
      offset = (randomAt(seed, i, 8) * 2 - 1) * jitter;
    x[i] = number(p.x - Math.sin(p.rotation) * offset, 'path point x');
    y[i] = number(p.y + Math.cos(p.rotation) * offset, 'path point y');
    rotations.push(p.rotation);
  }
  return pointSet(seed, x, y, [Object.freeze([Object.freeze(['rotation', Object.freeze(rotations)])])], {
    method: 'along',
    requested: count,
    pathLength: path.length,
    spacing,
    tolerance: spec.tolerance ?? 0.1,
  });
}

/** Seeded bounded distributions. Coordinates are captured as Float32 before containment/spacing tests. */
export function points(spec = {}) {
  options(
    spec,
    [
      'seed',
      'count',
      'density',
      'in',
      'method',
      'minDistance',
      'maxDistance',
      'along',
      'spacing',
      'jitter',
      'tolerance',
      'junctions',
      'offset',
      'alternate',
    ],
    'procedural points',
  );
  const seed = seedValue(spec.seed);
  if (spec.along !== undefined) {
    const descriptor =
      typeof spec.along === 'object' && spec.along !== null ? Object.getOwnPropertyDescriptor(spec.along, '0') : null;
    const first = descriptor && 'value' in descriptor ? descriptor.value : null;
    const multiPath = Array.isArray(first) && Array.isArray(Object.getOwnPropertyDescriptor(first, '0')?.value);
    if (
      !Array.isArray(spec.along) ||
      multiPath ||
      spec.junctions !== undefined ||
      spec.offset !== undefined ||
      spec.alternate !== undefined
    )
      return networkPoints(spec, seed, workBudget());
    assert(spec.maxDistance === undefined, 'PROCEDURAL_REGION', 'maxDistance requires a density callback.');
    return along(spec, seed);
  }
  assert(spec.in !== undefined, 'PROCEDURAL_REGION', 'Supply an explicit point region.');
  assert(
    !(spec.count !== undefined && spec.density !== undefined && typeof spec.density !== 'function'),
    'PROCEDURAL_COUNT',
    'Choose count or density, not both.',
  );
  const budget = workBudget(),
    domain = region(spec.in, budget);
  if (typeof spec.density === 'function')
    return densityPoints(spec, seed, domain, budget, integerCount(spec.count ?? 100));
  assert(
    spec.maxDistance === undefined &&
      spec.junctions === undefined &&
      spec.offset === undefined &&
      spec.alternate === undefined,
    'PROCEDURAL_REGION',
    'maxDistance requires a density field; junctions, offset and alternate require along.',
  );
  const count = integerCount(
    spec.count ??
      (spec.density === undefined ? 100 : Math.floor(number(spec.density, 'point density', 0, 1e7) * domain.area)),
  );
  const method = spec.method ?? 'random',
    jitter = number(spec.jitter ?? 0, 'grid jitter fraction', 0, 0.49);
  assert(
    ['random', 'poisson', 'grid', 'hex'].includes(method),
    'PROCEDURAL_METHOD',
    'Use random, poisson, grid or hex.',
  );
  assert(spec.tolerance === undefined, 'PROCEDURAL_REGION', 'Tolerance is an along-path option.');
  const x = [],
    y = [];
  let sequence = 0;
  const random = (channel) => randomAt(seed, sequence++, channel);
  const add = (px, py) => {
    x.push(px);
    y.push(py);
  };
  const candidate = () => domain.random(random(11), random(12)).map(Math.fround);
  if (method === 'random') {
    assert(
      spec.spacing === undefined && spec.minDistance === undefined && jitter === 0,
      'PROCEDURAL_METHOD',
      'Random points do not use spacing, minDistance or grid jitter.',
    );
    while (x.length < count) {
      budget.tick();
      const [px, py] = candidate();
      if (domain.contains(px, py)) add(px, py);
    }
  } else if (method === 'poisson') {
    assert(
      spec.spacing === undefined && jitter === 0,
      'PROCEDURAL_METHOD',
      'Poisson points use minDistance, without grid jitter.',
    );
    const radius = number(spec.minDistance, 'minimum point distance', 1e-6, 1e7),
      cell = radius / Math.SQRT2,
      grid = new Map(),
      active = [];
    const key = (gx, gy) => `${gx}:${gy}`;
    const put = (px, py) => {
      const index = x.length;
      add(px, py);
      grid.set(key(Math.floor((px - domain.x) / cell), Math.floor((py - domain.y) / cell)), index);
      active.push(index);
    };
    if (count) {
      let first;
      do {
        budget.tick();
        first = candidate();
      } while (!domain.contains(...first));
      put(...first);
    }
    // Global proposals avoid returning an early active-list cluster in one corner when the requested
    // count is far below saturation. The local Bridson expansion remains a bounded dense fallback.
    for (let attempt = 0; attempt < count * 12 && x.length < count; attempt++) {
      budget.tick();
      const [px, py] = candidate();
      if (!domain.contains(px, py)) continue;
      const gx = Math.floor((px - domain.x) / cell),
        gy = Math.floor((py - domain.y) / cell);
      let clear = true;
      for (let dx = -2; dx <= 2 && clear; dx++)
        for (let dy = -2; dy <= 2; dy++) {
          budget.tick();
          const other = grid.get(key(gx + dx, gy + dy));
          if (other !== undefined && Math.hypot(px - x[other], py - y[other]) < radius) {
            clear = false;
            break;
          }
        }
      if (clear) put(px, py);
    }
    while (active.length && x.length < count) {
      const chosen = Math.floor(random(13) * active.length),
        index = active[chosen];
      let accepted = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        budget.tick();
        const angle = random(14) * Math.PI * 2,
          r = radius * Math.sqrt(1 + 3 * random(15));
        const px = Math.fround(x[index] + r * Math.cos(angle)),
          py = Math.fround(y[index] + r * Math.sin(angle));
        if (!domain.contains(px, py)) continue;
        const gx = Math.floor((px - domain.x) / cell),
          gy = Math.floor((py - domain.y) / cell);
        let clear = true;
        for (let dx = -2; dx <= 2 && clear; dx++)
          for (let dy = -2; dy <= 2; dy++) {
            budget.tick();
            const other = grid.get(key(gx + dx, gy + dy));
            if (other !== undefined && Math.hypot(px - x[other], py - y[other]) < radius) {
              clear = false;
              break;
            }
          }
        if (clear) {
          put(px, py);
          accepted = true;
          break;
        }
      }
      if (!accepted) {
        active[chosen] = active.at(-1);
        active.pop();
      }
    }
    assert(
      x.length === count,
      'PROCEDURAL_SATURATED',
      `Generated ${x.length}/${count} spaced points; lower count or minDistance.`,
    );
  } else {
    assert(
      spec.minDistance === undefined,
      'PROCEDURAL_METHOD',
      'Grid and hex use spacing; minDistance belongs to poisson.',
    );
    const explicit = spec.spacing === undefined ? null : number(spec.spacing, 'grid spacing', 1e-6, 1e7);
    if (!explicit && domain.kind === 'rect' && method === 'grid' && count) {
      const columns = Math.max(1, Math.ceil(Math.sqrt((count * domain.width) / domain.height))),
        rows = Math.ceil(count / columns);
      for (let i = 0; i < count; i++) {
        budget.tick();
        add(
          Math.fround(domain.x + (((i % columns) + 0.5 + (random(16) * 2 - 1) * jitter) * domain.width) / columns),
          Math.fround(
            domain.y + ((Math.floor(i / columns) + 0.5 + (random(17) * 2 - 1) * jitter) * domain.height) / rows,
          ),
        );
      }
      return pointSet(seed, x, y, [], {
        method,
        requested: count,
        area: domain.area,
        density: count / domain.area,
        work: budget.used,
        bounds: Object.freeze({ x: domain.x, y: domain.y, width: domain.width, height: domain.height }),
      });
    }
    let step = explicit ?? Math.sqrt(domain.area / Math.max(1, count)) * (method === 'hex' ? 0.95 : 0.9);
    for (let pass = 0; pass < 12 && x.length < count; pass++) {
      x.length = 0;
      y.length = 0;
      const rowStep = step * (method === 'hex' ? Math.sqrt(3) / 2 : 1);
      const rows = Math.ceil(domain.height / rowStep),
        columns = Math.ceil(domain.width / step);
      assert(
        Number.isFinite(rows * columns) && rows * columns <= MAX_WORK,
        'RESOURCE_LIMIT',
        'Grid spacing creates too many candidate cells.',
      );
      for (let row = 0; row < rows && x.length < count; row++)
        for (let col = 0; col < columns && x.length < count; col++) {
          budget.tick();
          const shift = method === 'hex' && row % 2 ? 0.5 : 0;
          const px = Math.fround(domain.x + (col + 0.5 + shift + (random(16) * 2 - 1) * jitter) * step);
          const py = Math.fround(domain.y + (row + 0.5 + (random(17) * 2 - 1) * jitter) * rowStep);
          if (domain.contains(px, py)) add(px, py);
        }
      if (explicit) break;
      step *= 0.85;
    }
    assert(
      x.length === count,
      'PROCEDURAL_SATURATED',
      `The supported grid produced ${x.length}/${count} points; lower count or spacing.`,
    );
  }
  return pointSet(seed, x, y, [], {
    method,
    requested: count,
    area: domain.area,
    density: count / domain.area,
    work: budget.used,
    bounds: Object.freeze({ x: domain.x, y: domain.y, width: domain.width, height: domain.height }),
  });
}
