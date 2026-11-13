import { assert, number, options, safeCopy } from '../core/validate.js';
import { Derived } from '../core/scene.js';
import { DataSource } from '../core/data.js';
import { wireframe, boxLines, sphereLines, projectSegments, backfaceMode } from './project-lines.js';
import { cloudPoints, rgbaOf } from '../graphics/cloud.js';
import { perspectiveCamera, requireCamera } from './camera.js';
import { compose3D, transform3D } from './matrix.js';
import { billboardInstance } from '../procedural/billboards.js';

const channels = Object.freeze({
  x: [-1e7, 1e7, 0],
  y: [-1e7, 1e7, 0],
  z: [-1e7, 1e7, 0],
  rotationX: [-1e7, 1e7, 0],
  rotationY: [-1e7, 1e7, 0],
  rotation: [-1e7, 1e7, 0],
  scaleX: [-1e4, 1e4, 1],
  scaleY: [-1e4, 1e4, 1],
  scaleZ: [-1e4, 1e4, 1],
  wrap: [0, 1, 0],
});
const read = (input, c) =>
  input instanceof Derived ? input.sample(c) : input instanceof DataSource ? input.rows : input.sample(c.time);

/**
 * Longitude/latitude (radians) on a sheet that curls into a sphere. At wrap 0 the sheet is the flat
 * equirectangular plane z=radius; at wrap 1 it is the sphere. In between it lies on a sphere of radius
 * radius/wrap that touches the plane at (0,0), so distances along the equator and meridian are kept and
 * the map rolls up instead of shrinking through the globe. bend:'linear' keeps the straight blend.
 */
export function wrapPoint(lon, lat, radius, wrap, bend = 'curl') {
  if (bend === 'linear') {
    const c = Math.cos(lat);
    return {
      point: {
        x: radius * (lon * (1 - wrap) + c * Math.sin(lon) * wrap),
        y: radius * (lat * (1 - wrap) + Math.sin(lat) * wrap),
        z: radius * (1 - wrap + c * Math.cos(lon) * wrap),
      },
      normal: { x: c * Math.sin(lon) * wrap, y: Math.sin(lat) * wrap, z: 1 - wrap + c * Math.cos(lon) * wrap },
    };
  }
  if (wrap <= 1e-9) return { point: { x: radius * lon, y: radius * lat, z: radius }, normal: { x: 0, y: 0, z: 1 } };
  const rho = radius / wrap,
    l = lon * wrap,
    f = lat * wrap,
    cf = Math.cos(f),
    half = (x) => 2 * Math.sin(x / 2) ** 2;
  return {
    point: { x: rho * cf * Math.sin(l), y: rho * Math.sin(f), z: radius - rho * (half(f) + cf * half(l)) },
    normal: { x: cf * Math.sin(l), y: Math.sin(f), z: cf * Math.cos(l) },
  };
}
function bendMode(value = 'curl') {
  assert(value === 'curl' || value === 'linear', 'INVALID_SURFACE', 'bend must be curl or linear.');
  return value;
}

/** A line-art spatial construction sharing the parent scene's inputs and timeline. */
export function createSpace(scene, spec = {}) {
  options(spec, ['camera', 'stroke', 'strokeWidth', 'maxObjects', 'order', 'backfaces', 'backOpacity'], 'space');
  let camera = spec.camera ?? perspectiveCamera({ z: 600 }, { width: scene.width, height: scene.height });
  requireCamera(camera);
  assert(
    camera.viewport.width === scene.width && camera.viewport.height === scene.height,
    'INVALID_CAMERA',
    'A space camera viewport must match the authored scene dimensions.',
  );
  const order = spec.order ?? 'authored';
  assert(order === 'authored' || order === 'depth', 'INVALID_SPACE', 'order must be authored or depth.');
  const defaults = {
    backfaces: backfaceMode(spec.backfaces),
    backOpacity: number(spec.backOpacity ?? 0.2, 'back opacity', 0, 1),
  };
  const max = number(spec.maxObjects ?? 128, 'space objects', 1, 128);
  assert(Number.isInteger(max), 'RESOURCE_LIMIT', 'Object cap must be an integer.');
  const objects = [];
  const context = (time) => ({ time, width: scene.width, height: scene.height });
  const pathStyle = (style) => ({
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeLinecap: style.strokeLinecap,
  });
  // In depth order every slot shows whichever layer sits at its rank this frame, farthest first.
  const slots = [];
  let ordered = null;
  function reserveSlots(count) {
    if (!ordered)
      ordered = scene.derive([], (c) => objects.flatMap((o) => o.layers(c.time)).sort((a, b) => b.depth - a.depth));
    const empty = { commands: Object.freeze([]), stroke: 'none', strokeWidth: 0, strokeLinecap: 'butt', opacity: 0 };
    const added = Array.from({ length: count }, () => {
      const index = slots.length,
        slot = scene.path({ fill: 'none' });
      slots.push(slot);
      slot.bind(['commands', 'stroke', 'strokeWidth', 'strokeLinecap', 'opacity'], {
        inputs: [ordered],
        map: (list) => {
          const l = list[index] ?? empty;
          return {
            commands: l.commands,
            stroke: l.stroke,
            strokeWidth: l.strokeWidth,
            strokeLinecap: l.strokeLinecap,
            opacity: l.opacity,
          };
        },
      });
      return slot;
    });
    return added;
  }
  function add(geometry, input = {}, sampleGeometry = null) {
    options(
      input,
      [...Object.keys(channels), 'stroke', 'strokeWidth', 'backfaces', 'backOpacity', 'linecap'],
      'spatial object',
    );
    assert(objects.length < max, 'RESOURCE_LIMIT', 'Space object budget exceeded.');
    const captured = wireframe(geometry),
      parameters = Object.create(null),
      bindings = new Map();
    assert(
      captured.edges.length <= 5000,
      'RESOURCE_LIMIT',
      'A scene space object supports at most 5000 line edges. Use the explicit GPU buffer renderer for denser data.',
    );
    const values = Object.fromEntries(
      Object.entries(channels).map(([key, [min, localMax1, fallback]]) => [
        key,
        number(input[key] ?? fallback, key, min, localMax1),
      ]),
    );
    const style = {
      stroke: input.stroke ?? spec.stroke ?? '#1b343c',
      strokeWidth: input.strokeWidth ?? spec.strokeWidth ?? 1.5,
      strokeLinecap: input.linecap ?? 'butt',
      backfaces: backfaceMode(input.backfaces ?? defaults.backfaces),
      backOpacity: number(input.backOpacity ?? defaults.backOpacity, 'back opacity', 0, 1),
    };
    const split = style.backfaces === 'fade' && !!captured.normals;
    // Depth order shares slots across objects; authored order gives each object its own paths.
    const nodes =
      order === 'depth'
        ? reserveSlots(split ? 2 : 1)
        : [
            ...(split ? [scene.path({ fill: 'none', ...pathStyle(style), opacity: style.backOpacity })] : []),
            scene.path({ fill: 'none', ...pathStyle(style) }),
          ];
    const node = nodes.at(-1);
    for (const [key, [min, localMax2]] of Object.entries(channels))
      parameters[key] = scene.parameter(values[key], { min, max: localMax2 });
    let evaluating = false;
    function sample(time = 0) {
      assert(!evaluating, 'SPATIAL_CYCLE', 'Spatial bindings cannot recursively sample their own object.');
      evaluating = true;
      try {
        const c = context(number(time, 'space time', 0, 86400)),
          pose = {};
        for (const [key, [min, localMax3]] of Object.entries(channels)) {
          const binding = bindings.get(key);
          pose[key] = number(
            binding ? binding.map(...binding.inputs.map((v) => read(v, c)), c) : parameters[key].sample(time),
            key,
            min,
            localMax3,
          );
        }
        const { wrap, ...transform } = pose,
          g = sampleGeometry ? wireframe(sampleGeometry(wrap)) : captured;
        return { geometry: g, transform, matrix: compose3D(transform) };
      } finally {
        evaluating = false;
      }
    }
    // Back and front layers of this object at one time, each one path with its mean view depth.
    function layers(time) {
      const sampled = sample(time),
        segments = projectSegments(sampled.geometry, camera, { matrix: sampled.matrix });
      const pick = (back) =>
        segments
          .filter((s) => style.backfaces === 'show' || s.back === back)
          .sort((a, b) => b.depth - a.depth || a.index - b.index);
      const layer = (list, back) => ({
        back,
        depth: list.length ? list.reduce((n, s) => n + s.depth, 0) / list.length : Infinity,
        commands: Object.freeze(
          list.flatMap((s) => [
            Object.freeze(['M', s.screen[0].x, s.screen[0].y]),
            Object.freeze(['L', s.screen[1].x, s.screen[1].y]),
          ]),
        ),
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeLinecap: style.strokeLinecap,
        opacity: back ? style.backOpacity : 1,
      });
      if (style.backfaces === 'show') return [layer(pick(false), false)];
      return split ? [layer(pick(true), true), layer(pick(false), false)] : [layer(pick(false), false)];
    }
    // An empty offscreen object remains a valid path rather than inventing a point at infinity.
    if (order === 'authored') {
      const projected = scene.derive([], (c) => layers(c.time));
      nodes.forEach((n, i) => n.bind('commands', { inputs: [projected], map: (list) => list[i].commands }));
    }
    const handle = {
      id: node.id,
      node: order === 'depth' ? null : node,
      parameters: Object.freeze(parameters),
      sample,
      layers,
      set(patch) {
        options(patch, Object.keys(channels), 'spatial patch');
        for (const [k, v] of Object.entries(patch)) {
          assert(
            !bindings.has(k) && !parameters[k]._hasAnimation(),
            'CHANNEL_OWNED',
            'Unbind or clear a spatial driver before setting it.',
          );
          number(v, k, ...channels[k].slice(0, 2));
        }
        scene._batch(() => {
          for (const [k, v] of Object.entries(patch)) parameters[k]._setAuthored(v);
        });
        return handle;
      },
      to(at, patch, localSpec4 = {}) {
        options(patch, Object.keys(channels), 'spatial animation');
        const prepared = Object.entries(patch).map(([k, v]) => {
          assert(!bindings.has(k), 'CHANNEL_OWNED', 'Unbind a spatial driver before animating it.');
          return [parameters[k], parameters[k]._prepareTo(at, v, localSpec4)];
        });
        scene._batch(() => prepared.forEach(([p, t]) => p._commitPrepared(t)));
        return handle;
      },
      bind(key, binding) {
        assert(Object.hasOwn(channels, key), 'UNKNOWN_PROPERTY', 'Use a spatial transform channel.');
        assert(
          !bindings.has(key) && !parameters[key]._hasAnimation(),
          'CHANNEL_OWNED',
          'Release an existing driver before binding the spatial channel.',
        );
        options(binding, ['inputs', 'map'], 'spatial binding');
        const inputs = binding.inputs ?? [];
        assert(
          Array.isArray(inputs) && inputs.length <= 64 && typeof binding.map === 'function',
          'INVALID_BINDING',
          'Use bounded scene inputs and a trusted map.',
        );
        const localCaptured5 = Array.from({ length: inputs.length }, (_, i) => {
          const d = Object.getOwnPropertyDescriptor(inputs, i);
          assert(d && 'value' in d && scene._ownsInput(d.value), 'INVALID_BINDING', 'Use dense scene-owned inputs.');
          return d.value;
        });
        const candidate = { inputs: Object.freeze(localCaptured5), map: binding.map };
        number(
          candidate.map(...localCaptured5.map((v) => read(v, context(0))), context(0)),
          key,
          ...channels[key].slice(0, 2),
        );
        bindings.set(key, candidate);
        scene._changed();
        return handle;
      },
      unbind(key) {
        bindings.delete(key);
        scene._changed();
        return handle;
      },
      clearAnimation(key) {
        assert(Object.hasOwn(channels, key), 'UNKNOWN_PROPERTY', 'Use a spatial transform channel.');
        parameters[key]._clearAnimation();
        return handle;
      },
    };
    objects.push(handle);
    return Object.freeze(handle);
  }
  function mesh(geometry, localSpec6 = {}) {
    options(geometry, ['vertices', 'faces'], 'mesh');
    const vertices = safeCopy(geometry.vertices),
      faces = safeCopy(geometry.faces),
      edgeSet = new Set(),
      edges = [];
    assert(Array.isArray(faces) && faces.length <= 10000, 'RESOURCE_LIMIT', 'Use bounded polygon faces.');
    for (const face of faces) {
      assert(
        Array.isArray(face) && face.length >= 3 && face.length <= 64,
        'INVALID_WIREFRAME',
        'Faces need 3–64 vertex indices.',
      );
      for (let i = 0; i < face.length; i++) {
        const a = face[i],
          b = face[(i + 1) % face.length],
          key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([a, b]);
        }
      }
    }
    return add({ vertices, edges }, localSpec6);
  }
  const objectInput = (localSpec7) =>
    Object.fromEntries(
      Object.keys(channels)
        .concat(['stroke', 'strokeWidth', 'backfaces', 'backOpacity'])
        .filter((k) => localSpec7[k] !== undefined)
        .map((k) => [k, localSpec7[k]]),
    );
  function surface(localSpec8 = {}) {
    options(
      localSpec8,
      [
        'mapping',
        'radius',
        'columns',
        'rows',
        'bend',
        'x',
        'y',
        'z',
        'rotationX',
        'rotationY',
        'rotation',
        'wrap',
        'stroke',
        'strokeWidth',
        'backfaces',
        'backOpacity',
      ],
      'surface',
    );
    assert(
      (localSpec8.mapping ?? 'equirectangular') === 'equirectangular',
      'UNSUPPORTED_SURFACE',
      'Use equirectangular mapping.',
    );
    const radius = number(localSpec8.radius ?? 100, 'surface radius', 1e-6, 1e5),
      columns = number(localSpec8.columns ?? 24, 'surface columns', 2, 64),
      rows = number(localSpec8.rows ?? 12, 'surface rows', 2, 32),
      bend = bendMode(localSpec8.bend);
    assert(Number.isInteger(columns) && Number.isInteger(rows), 'INVALID_SURFACE', 'Grid counts must be integers.');
    const edges = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= columns; i++) {
        const n = j * (columns + 1) + i;
        if (i < columns) edges.push([n, n + 1]);
        if (j < rows) edges.push([n, n + columns + 1]);
      }
    const sample = (wrap) => {
      const mapped = Array.from({ length: (rows + 1) * (columns + 1) }, (_, n) =>
        wrapPoint(
          ((n % (columns + 1)) / columns - 0.5) * Math.PI * 2,
          (0.5 - Math.floor(n / (columns + 1)) / rows) * Math.PI,
          radius,
          wrap,
          bend,
        ),
      );
      return { vertices: mapped.map((m) => m.point), edges, normals: mapped.map((m) => m.normal) };
    };
    return add(sample(0), objectInput(localSpec8), sample);
  }
  /**
   * Map polylines given in degrees ({lon,lat} points, e.g. coastlines) onto the same flat-to-globe sheet as
   * surface(). Use the same radius and bind both wrap channels to one input so the lines stay on the grid.
   */
  function mapLines(lines, localSpec9 = {}) {
    options(
      localSpec9,
      [
        'radius',
        'bend',
        'step',
        'x',
        'y',
        'z',
        'rotationX',
        'rotationY',
        'rotation',
        'wrap',
        'stroke',
        'strokeWidth',
        'backfaces',
        'backOpacity',
      ],
      'map lines',
    );
    // step (degrees) splits long segments so lines follow the curved surface instead of cutting through it.
    const radius = number(localSpec9.radius ?? 100, 'map radius', 1e-6, 1e5),
      bend = bendMode(localSpec9.bend),
      step = number(localSpec9.step ?? 2, 'map step', 0.05, 180),
      input = safeCopy(lines);
    assert(
      Array.isArray(input) && input.length > 0,
      'INVALID_MAP_LINES',
      'Give one or more polylines of {lon,lat} points.',
    );
    const coordinates = [],
      edges = [];
    for (const line of input) {
      assert(Array.isArray(line) && line.length >= 2, 'INVALID_MAP_LINES', 'Each polyline needs at least two points.');
      line.forEach((p, i) => {
        options(p, ['lon', 'lat'], 'map point');
        const lon = number(p.lon, 'longitude', -180, 180),
          lat = number(p.lat, 'latitude', -90, 90);
        if (i) {
          const [lon0, lat0] = coordinates.at(-1).map((v) => (v * 180) / Math.PI),
            parts = Math.max(1, Math.ceil(Math.hypot(lon - lon0, lat - lat0) / step));
          for (let k = 1; k <= parts; k++) {
            coordinates.push([
              ((lon0 + ((lon - lon0) * k) / parts) * Math.PI) / 180,
              ((lat0 + ((lat - lat0) * k) / parts) * Math.PI) / 180,
            ]);
            edges.push([coordinates.length - 2, coordinates.length - 1]);
            assert(
              coordinates.length <= 8192,
              'RESOURCE_LIMIT',
              'Map lines support at most 8192 points per object; raise step or split them.',
            );
          }
        } else coordinates.push([(lon * Math.PI) / 180, (lat * Math.PI) / 180]);
      });
    }
    assert(
      coordinates.length <= 8192,
      'RESOURCE_LIMIT',
      'Map lines support at most 8192 points per object; split them into several objects.',
    );
    const sample = (wrap) => {
      const mapped = coordinates.map(([lon, lat]) => wrapPoint(lon, lat, radius, wrap, bend));
      return { vertices: mapped.map((m) => m.point), edges, normals: mapped.map((m) => m.normal) };
    };
    return add(sample(0), objectInput(localSpec9), sample);
  }
  /**
   * Project 3D points into one scene cloud node (radius shrinks with distance in perspective).
   * points is a derived input or a function of time returning [{x,y,z,radius?,color?}] or a Float32Array of xyz.
   */
  function cloud(points, localSpec10 = {}) {
    options(
      localSpec10,
      ['radius', 'color', 'backfaces', 'center', 'pointShape', 'pointBlend', 'fill', 'attenuate'],
      'space cloud',
    );
    const radius = number(localSpec10.radius ?? 2, 'cloud radius', 0, 1e4),
      backfaces = backfaceMode(localSpec10.backfaces),
      attenuate = localSpec10.attenuate ?? true;
    assert(typeof attenuate === 'boolean', 'INVALID_CLOUD', 'attenuate must be boolean.');
    let center = null;
    if (localSpec10.center !== undefined) {
      options(localSpec10.center, ['x', 'y', 'z'], 'cloud center');
      center = {
        x: number(localSpec10.center.x ?? 0, 'center x'),
        y: number(localSpec10.center.y ?? 0, 'center y'),
        z: number(localSpec10.center.z ?? 0, 'center z'),
      };
    }
    assert(
      typeof points === 'function' || scene._ownsInput(points),
      'INVALID_CLOUD',
      'Give a function of time or a derived input from this scene.',
    );
    const node = scene.cloud({
      fill: localSpec10.fill ?? '#ffffff',
      pointShape: localSpec10.pointShape ?? 'circle',
      pointBlend: localSpec10.pointBlend ?? 'normal',
      pointSize: radius,
    });
    const source = typeof points === 'function' ? scene.derive([], (c) => points(c.time)) : points;
    const projected = scene.derive([source], (rows) => {
      const view = camera.viewMatrix,
        proj = camera.viewProjectionMatrix,
        w = camera.viewport.width,
        h = camera.viewport.height,
        eye = { x: camera.matrixWorld[12], y: camera.matrixWorld[13], z: camera.matrixWorld[14] };
      const typed = rows instanceof Float32Array,
        count = typed ? rows.length / 3 : rows.length,
        focal = (camera.projectionMatrix[5] * h) / 2;
      const positions = [],
        radii = [],
        colors = [];
      let anyColor = false;
      const fill = rgbaOf(localSpec10.fill ?? '#ffffff');
      for (let i = 0; i < count; i++) {
        const p = typed ? { x: rows[i * 3], y: rows[i * 3 + 1], z: rows[i * 3 + 2] } : rows[i];
        let back = false;
        if (center && backfaces !== 'show') {
          const n = { x: p.x - center.x, y: p.y - center.y, z: p.z - center.z },
            v =
              camera.type === 'perspective'
                ? { x: eye.x - p.x, y: eye.y - p.y, z: eye.z - p.z }
                : { x: camera.matrixWorld[8], y: camera.matrixWorld[9], z: camera.matrixWorld[10] };
          back = n.x * v.x + n.y * v.y + n.z * v.z < 0;
        }
        if (back && backfaces === 'hide') continue;
        const cw = proj[3] * p.x + proj[7] * p.y + proj[11] * p.z + proj[15];
        if (cw <= 0) continue;
        const x = (((proj[0] * p.x + proj[4] * p.y + proj[8] * p.z + proj[12]) / cw + 1) * w) / 2,
          y = ((1 - (proj[1] * p.x + proj[5] * p.y + proj[9] * p.z + proj[13]) / cw) * h) / 2;
        const depth = -(view[2] * p.x + view[6] * p.y + view[10] * p.z + view[14]),
          base = typed ? radius : (p.radius ?? radius);
        const r =
          camera.type === 'perspective' ? (attenuate ? (base * focal) / Math.max(depth, 1e-6) : base) : base * focal;
        if (Math.abs(x) > 1e7 || Math.abs(y) > 1e7 || r > 1e4) continue;
        positions.push(x, y);
        radii.push(r);
        const c = [...((typed ? null : p.color) ?? fill)];
        if (!typed && p.color) anyColor = true;
        if (back) {
          c[3] *= 0.2;
          anyColor = true;
        }
        colors.push(...c);
      }
      return cloudPoints({ positions, radii, colors: anyColor ? colors : null });
    });
    node.bind('points', { inputs: [projected], map: (v) => v });
    return Object.freeze({ id: node.id, node });
  }
  return Object.freeze({
    get camera() {
      return camera;
    },
    setCamera(next) {
      requireCamera(next);
      assert(
        next.viewport.width === scene.width && next.viewport.height === scene.height,
        'INVALID_CAMERA',
        'Match the authored viewport.',
      );
      camera = next;
      scene._changed();
    },
    points(vertices, localSpec11 = {}) {
      const input = safeCopy(vertices);
      assert(Array.isArray(input), 'INVALID_WIREFRAME', 'Use a vertex array.');
      const edges = input.map((_, i) => [i, i]);
      return add({ vertices: input, edges }, { linecap: 'round', ...localSpec11 });
    },
    polyline(vertices, localSpec12 = {}) {
      const input = safeCopy(vertices);
      return add({ vertices: input, edges: input.slice(1).map((_, i) => [i, i + 1]) }, localSpec12);
    },
    instance(field, shape, instanceSpec = {}) {
      return billboardInstance(scene, field, shape, () => camera, instanceSpec);
    },
    mesh,
    sphereLines(shape = {}, localSpec13 = {}) {
      return add(sphereLines(shape), localSpec13);
    },
    box(shape = {}, localSpec14 = {}) {
      return add(boxLines(shape), localSpec14);
    },
    surface,
    mapLines,
    cloud,
    extrude(points, depth, localSpec15 = {}) {
      const input = safeCopy(points);
      assert(
        Array.isArray(input) && input.length >= 3 && input.length <= 4096,
        'RESOURCE_LIMIT',
        'Use 3–4096 extruded contour points.',
      );
      number(depth, 'extrusion depth', 1e-6, 1e5);
      input.forEach((p) => {
        options(p, ['x', 'y'], 'extrusion point');
        number(p.x, 'point x');
        number(p.y, 'point y');
      });
      const n = input.length,
        vertices = [...input.map((p) => ({ ...p, z: 0 })), ...input.map((p) => ({ ...p, z: depth }))],
        edges = [];
      for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n], [n + i, n + ((i + 1) % n)], [i, n + i]);
      return add({ vertices, edges }, localSpec15);
    },
    geometry(time = 0) {
      const vertices = [],
        edges = [];
      for (const object of objects) {
        const sampled = object.sample(time),
          offset = vertices.length;
        vertices.push(...sampled.geometry.vertices.map((p) => transform3D(sampled.matrix, p)));
        edges.push(...sampled.geometry.edges.map((e) => e.map((i) => i + offset)));
      }
      return wireframe({ vertices, edges });
    },
    get objects() {
      return Object.freeze([...objects]);
    },
  });
}
