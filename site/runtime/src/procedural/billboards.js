import { assert, number, options, safeCopy, KitError } from '../core/validate.js';
import { pathCommands } from '../graphics/index.js';
import { rgbaOf } from '../graphics/cloud.js';
import { shape, commandsFor } from './shapes.js';
import { DataSource } from '../core/data.js';
import { stateOf, sampleRows } from './point-set.js';
import { requireCamera, projectPoints } from '../spatial/camera.js';
const capturedPaths = new WeakMap();
function localShape(factory, point, time) {
  const s = shape(factory, point, time),
    key = s.raw.commands,
    cacheable = Array.isArray(key) && Object.isFrozen(key) && key.every(Object.isFrozen);
  let commands = cacheable && capturedPaths.get(key);
  if (!commands) {
    commands = commandsFor(s);
    if (cacheable) capturedPaths.set(key, commands);
  }
  return { ...s, commands };
}
function capturedRows(field, time, scene, context) {
  let rows;
  if (typeof field === 'function') {
    try {
      rows = field(time);
    } catch (cause) {
      const error = new KitError('PROCEDURAL_CALLBACK', 'Spatial field callback failed.');
      error.cause = cause;
      throw error;
    }
  } else if (scene._ownsInput(field)) rows = field instanceof DataSource ? field.rows : field.sample(context);
  else {
    stateOf(field);
    return sampleRows(field, time);
  }
  const input = safeCopy(rows);
  assert(
    Array.isArray(input) && input.length <= 4096,
    'RESOURCE_LIMIT',
    'Spatial instances accept at most 4096 point records.',
  );
  return input;
}
/** Fixed painter-rank slots, one camera dependency; arbitrary local filled shapes. */
export function billboardInstance(scene, field, factory, cameraInput, spec = {}) {
  if (typeof factory !== 'function') factory = safeCopy(factory);
  if (Array.isArray(field)) {
    const captured = safeCopy(field);
    field = () => captured;
  }
  options(spec, ['batch', 'tag', 'camera', 'maxBatches', 'time'], 'spatial instance');
  assert(
    spec.time === undefined,
    'INVALID_BINDING',
    'Spatial instance fields use scene time; put ambient inputs in a derived field.',
  );
  const cameraOwned = scene._ownsInput(cameraInput),
    cameraProvider = typeof cameraInput === 'function' ? cameraInput : null;
  if (!cameraOwned && !cameraProvider) requireCamera(cameraInput);
  if (spec.tag !== undefined)
    assert(
      typeof spec.tag === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(spec.tag),
      'INVALID_TAG',
      'Use a short procedural tag.',
    );
  assert(['auto', true, false].includes(spec.batch ?? 'auto'), 'PROCEDURAL_BATCH', 'batch is auto, true or false.');
  const staticFactory = typeof factory !== 'function',
    staticShape = staticFactory ? localShape(factory, { i: 0, x: 0, y: 0 }, 0) : null;
  const singlePaint =
      staticShape &&
      staticShape.raw.alpha === 1 &&
      staticShape.type !== 'path' &&
      staticShape.type !== 'glow' &&
      rgbaOf(staticShape.raw.fill ?? '#ffffff')[3] === 1,
    batching = spec.batch !== false;
  const startContext = scene._sampleContext({ time: 0 }),
    initialRows = capturedRows(field, 0, scene, startContext),
    count = initialRows.length;
  assert(count <= 4096, 'RESOURCE_LIMIT', 'Spatial instances accept at most 4096 points.');
  const capacity =
    spec.maxBatches ?? (batching && singlePaint ? Math.ceil((count * staticShape.commands.length) / 10000) : count);
  number(capacity, 'billboard batch capacity', count ? 1 : 0, 4096);
  assert(Number.isInteger(capacity), 'RESOURCE_LIMIT', 'Billboard batch capacity must be an integer.');
  function prepare(rows, camera, time) {
    let work = 0;
    requireCamera(camera);
    assert(
      camera.viewport.width === scene.width && camera.viewport.height === scene.height,
      'INVALID_CAMERA',
      'Match the authored viewport for spatial instances.',
    );
    assert(rows.length === count, 'PROCEDURAL_TOPOLOGY', 'Keep spatial field cardinality stable.');
    const xyz = new Float64Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = rows[i];
      assert(p && typeof p === 'object', 'PROCEDURAL_ATTRIBUTE', 'Use spatial point records.');
      xyz[i * 3] = number(p.x, 'billboard x');
      xyz[i * 3 + 1] = number(p.y, 'billboard y');
      xyz[i * 3 + 2] = number(p.z, 'billboard z');
    }
    // Cull depth before projection so a point on the camera plane never divides by zero.
    const view = camera.viewMatrix,
      indices = [];
    for (let i = 0; i < count; i++) {
      const d = -(view[2] * xyz[i * 3] + view[6] * xyz[i * 3 + 1] + view[10] * xyz[i * 3 + 2] + view[14]);
      if (d >= camera.near && d <= camera.far && d > 0) indices.push({ i, depth: d });
    }
    indices.sort((a, b) => b.depth - a.depth || a.i - b.i);
    const packed = new Float64Array(indices.length * 3);
    indices.forEach(({ i }, j) => packed.set(xyz.subarray(i * 3, i * 3 + 3), j * 3));
    const projected = projectPoints(camera, packed),
      focal = (camera.projectionMatrix[5] * camera.viewport.height) / 2,
      plan = [];
    for (let j = 0; j < indices.length; j++) {
      const { i, depth } = indices[j],
        point = rows[i],
        value = localShape(factory, { ...point, i }, time),
        scale = camera.type === 'perspective' ? focal / depth : focal,
        x = projected.positions[j * 2],
        y = projected.positions[j * 2 + 1],
        c = Math.cos(value.rotation),
        s = Math.sin(value.rotation),
        rgba = rgbaOf(value.raw.fill ?? '#ffffff'),
        alpha = rgba[3] * value.alpha;
      // Bounds use all command/control coordinates; conservative culling retains partly visible marks.
      assert(
        value.type !== 'glow',
        'PROCEDURAL_SHAPE',
        'Spatial filled billboards do not approximate glow falloff; use a soft-light layer.',
      );
      work += value.commands.length;
      assert(work <= 100000, 'RESOURCE_LIMIT', 'Spatial instances exceed 100000 sampled path commands.');
      const commands = value.commands.map((command) => {
        const next = [command[0]];
        for (let k = 1; k < command.length; k += 2)
          next.push(
            number(x + scale * (c * command[k] - s * command[k + 1]), 'billboard path x'),
            number(y + scale * (s * command[k] + c * command[k + 1]), 'billboard path y'),
          );
        return next;
      });
      let xmin = Infinity,
        ymin = Infinity,
        xmax = -Infinity,
        ymax = -Infinity;
      for (const command of commands)
        for (let k = 1; k < command.length; k += 2) {
          xmin = Math.min(xmin, command[k]);
          xmax = Math.max(xmax, command[k]);
          ymin = Math.min(ymin, command[k + 1]);
          ymax = Math.max(ymax, command[k + 1]);
        }
      if (xmax < 0 || xmin > scene.width || ymax < 0 || ymin > scene.height || alpha === 0) continue;
      const fill =
          '#' +
          rgba
            .slice(0, 3)
            .map((v) =>
              Math.round(v * 255)
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
        opaque = alpha === 1 && value.type !== 'path' && value.type !== 'glow',
        last = plan.at(-1),
        merge =
          batching && opaque && last?.opaque && last.fill === fill && last.commands.length + commands.length <= 10000;
      const record = merge ? last : { commands: [], fill, opacity: alpha, opaque, indices: [], depths: [] };
      if (!merge) plan.push(record);
      record.commands.push(...commands);
      record.indices.push(i);
      record.depths.push(depth);
    }
    assert(
      plan.length <= capacity,
      'PROCEDURAL_TOPOLOGY',
      'Spatial painter order exceeded reserved maxBatches; reserve more slots or use a uniform opaque built-in shape.',
    );
    return plan.map((p) => ({ ...p, commands: pathCommands(p.commands) }));
  }
  const getCamera = (c) => (cameraProvider ? cameraProvider() : cameraOwned ? cameraInput.sample(c) : cameraInput);
  const initial = prepare(initialRows, getCamera(startContext), 0),
    empty = { commands: pathCommands([]), fill: 'none', opacity: 0 },
    component = scene.component({
      type: 'group',
      children: Object.fromEntries(
        Array.from({ length: capacity }, (_, i) => [`rank${i}`, { type: 'path', props: initial[i] ?? empty }]).map(
          ([k, v]) => [
            k,
            {
              ...v,
              props: { commands: v.props.commands, fill: v.props.fill, opacity: v.props.opacity, stroke: 'none' },
            },
          ],
        ),
      ),
    }),
    handle = scene.instance(component);
  if (spec.tag !== undefined) {
    scene.defineTag(spec.tag);
    handle.tag(spec.tag);
  }
  const inputs = cameraOwned ? [cameraInput] : [],
    sampled = scene.derive(inputs, (...args) => {
      const c = args.at(-1);
      return prepare(capturedRows(field, c.time, scene, c), getCamera(c), c.time);
    });
  for (let i = 0; i < capacity; i++)
    handle.part(`rank${i}`).bind(['commands', 'fill', 'opacity'], {
      inputs: [sampled],
      map: (plan) => {
        const p = plan[i] ?? empty;
        return { commands: p.commands, fill: p.fill, opacity: p.opacity };
      },
    });
  return Object.freeze({
    handle,
    count,
    nodeCount: capacity + 1,
    sample(time = 0) {
      const c = scene._sampleContext({ time });
      return Object.freeze(
        prepare(capturedRows(field, time, scene, c), getCamera(c), time).map((p) =>
          Object.freeze({ indices: Object.freeze(p.indices), depths: Object.freeze(p.depths) }),
        ),
      );
    },
  });
}
