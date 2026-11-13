import { assert, number, options, safeCopy } from '../core/validate.js';
import { pathCommands } from '../graphics/index.js';
import { cloudPoints, rgbaOf } from '../graphics/cloud.js';
import { sampleRows, stateOf } from './point-set.js';

import { shape, commandsFor } from './shapes.js';
import { billboardInstance } from './billboards.js';
import { registerInstanceProvenance } from './provenance.js';
function colorString(rgba) {
  return (
    '#' +
    rgba
      .map((v, i) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function prepare(set, factory, time, batching) {
  const rows = sampleRows(set, time),
    plan = [],
    colors = new Map();
  let commandCount = 0;
  for (const point of rows) {
    const value = shape(factory, point, time),
      { raw, type, radius, alpha, rotation } = value;
    const fill = raw.fill ?? '#ffffff';
    if (!colors.has(fill)) colors.set(fill, rgbaOf(fill));
    const base = colors.get(fill),
      rgba = [base[0], base[1], base[2], base[3] * alpha];
    const cloudKind =
      type === 'dot' ? 'circle' : type === 'glow' ? 'glow' : type === 'square' && rotation === 0 ? 'square' : null;
    const previous = plan.at(-1);
    if (cloudKind) {
      const record =
        batching && previous?.kind === 'cloud' && previous.pointShape === cloudKind
          ? previous
          : { kind: 'cloud', pointShape: cloudKind, positions: [], radii: [], colors: [], first: point.i, count: 0 };
      if (record !== previous) plan.push(record);
      record.positions.push(point.x, point.y);
      record.radii.push(radius);
      record.colors.push(...rgba);
      record.count++;
    } else {
      const local = commandsFor(value),
        c = Math.cos(rotation),
        s = Math.sin(rotation);
      const commands = local.map((command) => {
        const next = [command[0]];
        for (let i = 1; i < command.length; i += 2)
          next.push(
            number(point.x + c * command[i] - s * command[i + 1], 'instance path x'),
            number(point.y + s * command[i] + c * command[i + 1], 'instance path y'),
          );
        return next;
      });
      commandCount += commands.length;
      assert(commandCount <= 100000, 'RESOURCE_LIMIT', 'Combined procedural artwork exceeds 100000 path commands.');
      // Each built-in has winding 0 or +1 at every point; combining opaque, identically colored
      // contiguous built-ins therefore gives their exact union. Custom paths/alpha remain separate.
      const opaque = rgba[3] === 1 && type !== 'path',
        paint = colorString([rgba[0], rgba[1], rgba[2], 1]);
      const record =
        batching &&
        opaque &&
        previous?.kind === 'path' &&
        previous.opaque &&
        previous.fill === paint &&
        previous.commands.length + commands.length <= 10000
          ? previous
          : { kind: 'path', commands: [], fill: paint, opacity: rgba[3], opaque, first: point.i, count: 0 };
      if (record !== previous) plan.push(record);
      record.commands.push(...commands);
      record.count++;
    }
    assert(
      plan.length <= 9999,
      'RESOURCE_LIMIT',
      'Painter-order-preserving batching needs more than 9999 nodes; simplify shape/style runs.',
    );
  }
  return plan.map((record) =>
    record.kind === 'cloud'
      ? {
          type: 'cloud',
          props: {
            points: cloudPoints({ positions: record.positions, radii: record.radii, colors: record.colors }),
            pointShape: record.pointShape,
            fill: '#ffffff',
          },
          first: record.first,
          count: record.count,
        }
      : {
          type: 'path',
          props: {
            commands: pathCommands(record.commands),
            fill: record.fill,
            stroke: 'none',
            opacity: record.opacity,
            fillRule: 'nonzero',
          },
          first: record.first,
          count: record.count,
        },
  );
}

/** Add one component with deterministic contiguous batches. No independent clock is installed. */
export function instance(scene, set, factory, spec = {}) {
  options(spec, ['batch', 'tag', 'camera', 'maxBatches', 'time'], 'procedural instance');
  if (spec.camera !== undefined) return billboardInstance(scene, set, factory, spec.camera, spec);
  stateOf(set);
  assert(spec.maxBatches === undefined, 'PROCEDURAL_BATCH', 'maxBatches applies to spatial billboards only.');
  assert(
    spec.time === undefined || scene._ownsInput(spec.time),
    'INVALID_BINDING',
    'Instance time must be a scene-owned input.',
  );
  assert(
    scene && typeof scene.component === 'function' && typeof scene.derive === 'function',
    'PROCEDURAL_SCENE',
    'Supply an ExplainerKit scene.',
  );
  assert(
    factory && (typeof factory === 'function' || typeof factory === 'object'),
    'PROCEDURAL_SHAPE',
    'Supply a shape descriptor or pure point/time callback.',
  );
  if (typeof factory !== 'function') factory = safeCopy(factory);
  const batching = spec.batch ?? 'auto';
  assert(['auto', true, false].includes(batching), 'PROCEDURAL_BATCH', 'batch is auto, true or false.');
  const initialTime =
    spec.time === undefined
      ? 0
      : scene
          .derive([spec.time], (t) => number(t, 'instance clock', 0, 86400))
          .sample(scene._sampleContext({ time: 0 }));
  const initial = prepare(set, factory, initialTime, batching !== false);
  registerInstanceProvenance(initial, set, spec.tag);
  if (spec.tag !== undefined) {
    assert(
      typeof spec.tag === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(spec.tag),
      'INVALID_TAG',
      'Use a short procedural tag.',
    );
  }
  const signature = (plan) => plan.map((p) => `${p.type}:${p.props.pointShape ?? ''}:${p.first}:${p.count}`).join('|');
  const expected = signature(initial);
  const definition = {
    type: 'group',
    children: Object.fromEntries(initial.map((record, i) => [`batch${i}`, { type: record.type, props: record.props }])),
  };
  // component validates total hierarchy/commands, and instance validates capacity before mutation.
  const component = scene.component(definition),
    handle = scene.instance(component);
  if (spec.tag !== undefined) {
    scene.defineTag(spec.tag);
    handle.tag(spec.tag);
  }
  const sampled = scene.derive(spec.time === undefined ? [] : [spec.time], (...args) => {
    const context = args.at(-1),
      time = spec.time === undefined ? context.time : number(args[0], 'instance clock', 0, 86400);
    const plan = prepare(set, factory, time, batching !== false);
    registerInstanceProvenance(plan, set, spec.tag);
    assert(
      signature(plan) === expected,
      'PROCEDURAL_TOPOLOGY',
      'Time-varying shape/style runs changed batch topology; keep run boundaries stable or use batch:false.',
    );
    return plan;
  });
  initial.forEach((record, i) => {
    const child = handle.part(`batch${i}`),
      properties = Object.keys(record.props);
    child.bind(properties, { inputs: [sampled], map: (plan) => plan[i].props });
  });
  return Object.freeze({
    handle,
    count: set.count,
    nodeCount: initial.length + 1,
    batches: Object.freeze(initial.map((r) => Object.freeze({ type: r.type, first: r.first, count: r.count }))),
  });
}
