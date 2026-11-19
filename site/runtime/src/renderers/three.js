import { blurRadius } from '../graphics/look.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { captureState } from '../core/transition.js';
import { isSampled } from '../core/sampled.js';
import { validateFrame } from './shared.js';
import { flattenPath } from '../morph/index.js';
import { compose3D, inverse3D } from '../spatial/matrix.js';
import { orthographicCamera, requireCamera } from '../spatial/camera.js';
import { materialColour } from './material-palette.js';
export { darkClay } from './material-palette.js';

/** @typedef {(colour: string, context: Readonly<{id: string, role: 'fill'|'stroke', hasMap: false}>) => (string|{h: number, s: number, l: number, a?: number})} MaterialPalette */

const REQUIRED = [
  'Scene',
  'Group',
  'Camera',
  'PerspectiveCamera',
  'OrthographicCamera',
  'Matrix4',
  'Vector3',
  'Box3',
  'Shape',
  'ShapeGeometry',
  'ExtrudeGeometry',
  'BoxGeometry',
  'PlaneGeometry',
  'CircleGeometry',
  'CylinderGeometry',
  'BufferGeometry',
  'Mesh',
  'Line',
  'MeshBasicMaterial',
  'MeshStandardMaterial',
  'AmbientLight',
  'DirectionalLight',
  'LineBasicMaterial',
  'Color',
];
function unsupported(feature, message) {
  const e = new Error(message);
  e.code = 'THREE_UNSUPPORTED';
  e.capability = feature;
  throw e;
}
function checkThree(THREE) {
  assert(
    THREE && REQUIRED.every((name) => typeof THREE[name] === 'function'),
    'THREE_REQUIRED',
    'Pass a caller-imported Three.js namespace; the core never imports it automatically.',
  );
}
function captureAssets(value = []) {
  assert(
    Array.isArray(value) && value.length <= 1000,
    'RESOURCE_LIMIT',
    'Use at most 1000 externally owned Three assets.',
  );
  const result = new Map();
  let total = 0;
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, i);
    assert(d && 'value' in d, 'INVALID_ASSET', 'Asset lists must be dense values.');
    const asset = d.value;
    options(asset, ['id', 'object'], 'Three asset');
    assert(
      typeof asset.id === 'string' && asset.id && !result.has(asset.id),
      'INVALID_ASSET',
      'Assets need distinct nonempty target IDs.',
    );
    assert(
      asset.object?.isObject3D && typeof asset.object.clone === 'function',
      'INVALID_ASSET',
      'An asset must be a caller-owned Three Object3D.',
    );
    const seen = new Set();
    function visit(node, depth) {
      assert(
        depth <= 64 && ++total <= 10000 && !seen.has(node),
        'RESOURCE_LIMIT',
        'Three assets exceed their combined hierarchy/node budget or contain a cycle.',
      );
      seen.add(node);
      for (const child of node.children) visit(child, depth + 1);
    }
    visit(asset.object, 0);
    result.set(asset.id, asset.object);
  }
  return result;
}
function paint(value) {
  if (typeof value !== 'string')
    unsupported('paint.gradient', 'The optional Three adapter currently supports solid paints only.');
  if (value === 'none' || value === 'transparent') return { color: '#000000', alpha: 0 };
  if (/^#[\da-f]{4}$/i.test(value))
    return {
      color: `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`,
      alpha: parseInt(value[4] + value[4], 16) / 255,
    };
  if (/^#[\da-f]{8}$/i.test(value)) return { color: value.slice(0, 7), alpha: parseInt(value.slice(7), 16) / 255 };
  return { color: value, alpha: 1 };
}
function intersects(a, b, c, d) {
  const cross = (localA1, localB2, localC3) =>
      (localB2.x - localA1.x) * (localC3.y - localA1.y) - (localB2.y - localA1.y) * (localC3.x - localA1.x),
    between = (localA4, localB5, p) =>
      p.x >= Math.min(localA4.x, localB5.x) &&
      p.x <= Math.max(localA4.x, localB5.x) &&
      p.y >= Math.min(localA4.y, localB5.y) &&
      p.y <= Math.max(localA4.y, localB5.y);
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return (
    (abC === 0 && between(a, b, c)) ||
    (abD === 0 && between(a, b, d)) ||
    (cdA === 0 && between(c, d, a)) ||
    (cdB === 0 && between(c, d, b))
  );
}
function simpleContour(points) {
  const p =
    points.length > 1 && points[0].x === points.at(-1).x && points[0].y === points.at(-1).y
      ? points.slice(0, -1)
      : points;
  assert(p.length >= 3, 'THREE_GEOMETRY', 'A filled path needs at least three distinct outline points.');
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
        unsupported(
          'path.selfIntersection',
          'Self-intersecting/touching path contours require an explicit supported mesh, not implicit Three triangulation.',
        );
    }
  return p;
}
// Sampled path commands are frozen and shared between frames, so their flattening (and its simple-contour
// check) is cached by identity: a static outline is prepared once, not every frame.
const contourCache = new WeakMap();
let outlineIds = 0;
const outlineId = new WeakMap();
function pathContours(commands, tolerance) {
  const frozen = Object.isFrozen(commands) && commands.every(Object.isFrozen),
    hit = frozen ? contourCache.get(commands) : null;
  if (hit && hit.tolerance === tolerance) return hit.contours;
  const contours = flattenContours(commands, tolerance);
  if (frozen) {
    contourCache.set(commands, { tolerance, contours });
    outlineId.set(contours, ++outlineIds);
  }
  return contours;
}
function flattenContours(commands, tolerance) {
  const lists = [];
  let current = [];
  for (const c of commands) {
    if (c[0] === 'M' && current.length) {
      lists.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length) lists.push(current);
  return lists.filter((list) => list.length > 1).map((list) => flattenPath(list, { tolerance, maxPoints: 2048 }));
}
// Classify contour boundaries by winding/containment before Three triangulates them.
const topologyCache = new WeakMap();
function pathTopology(contours, rule, work) {
  const hit = topologyCache.get(contours);
  if (hit?.rule === rule) return hit.shapes;
  const rings = contours.map((c) => {
    work.count += c.points.length ** 2;
    assert(work.count <= 4000000, 'RESOURCE_LIMIT', 'Path topology exceeds its intersection budget.');
    const points = simpleContour(c.points);
    const area =
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p.x * q.y - q.x * p.y;
      }, 0) / 2;
    assert(Math.abs(area) > 1e-12, 'THREE_GEOMETRY', 'A filled contour needs nonzero area.');
    return { points, area, parent: null, winding: 0, shape: null };
  });
  const contains = (ring, p) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i],
        b = ring[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  for (let i = 0; i < rings.length; i++)
    for (let j = i + 1; j < rings.length; j++) {
      const a = rings[i].points,
        b = rings[j].points;
      work.count += a.length * b.length;
      assert(work.count <= 4000000, 'RESOURCE_LIMIT', 'Path topology exceeds its intersection budget.');
      for (let x = 0; x < a.length; x++)
        for (let y = 0; y < b.length; y++)
          if (intersects(a[x], a[(x + 1) % a.length], b[y], b[(y + 1) % b.length]))
            unsupported('path.intersection', 'Compound contours must not cross or touch.');
    }
  for (const ring of rings) {
    const parents = rings.filter(
      (r) => r !== ring && Math.abs(r.area) > Math.abs(ring.area) && contains(r.points, ring.points[0]),
    );
    ring.parent = parents.sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0] ?? null;
  }
  const shapes = [];
  for (const ring of [...rings].sort((a, b) => Math.abs(b.area) - Math.abs(a.area))) {
    const outside = ring.parent?.winding ?? 0;
    ring.winding = outside + (rule === 'evenodd' ? 1 : Math.sign(ring.area));
    const filled = (v) => (rule === 'evenodd' ? Math.abs(v) % 2 === 1 : v !== 0);
    if (!filled(outside) && filled(ring.winding)) {
      ring.shape = { outer: ring.points, holes: [] };
      shapes.push(ring.shape);
    } else if (filled(outside) && !filled(ring.winding)) {
      let parent = ring.parent;
      while (parent && !parent.shape) parent = parent.parent;
      assert(parent, 'THREE_GEOMETRY', 'Hole requires an enclosing filled contour.');
      parent.shape.holes.push(ring.points);
    }
  }
  if (outlineId.has(contours)) topologyCache.set(contours, { rule, shapes });
  return shapes;
}
function shapePoints(type, p, contours, segments) {
  if (type === 'circle')
    return Array.from({ length: segments }, (_, i) => ({
      x: Math.cos((i / segments) * Math.PI * 2) * p.r,
      y: Math.sin((i / segments) * Math.PI * 2) * p.r,
    }));
  if (type === 'rect') {
    const w = p.width,
      h = p.height,
      r = Math.min(p.rx ?? 0, w / 2, h / 2);
    if (r === 0)
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    const corners = [
        [w - r, r, -Math.PI / 2],
        [w - r, h - r, 0],
        [r, h - r, Math.PI / 2],
        [r, r, Math.PI],
      ],
      result = [];
    for (const [x, y, from] of corners)
      for (let i = 0; i <= 8; i++) {
        const a = from + ((i / 8) * Math.PI) / 2;
        result.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
      }
    return result;
  }
  return contours[0]?.points ?? [];
}
function flattenFrame(frame, tolerance, maxVertices, groupOpacity, segments) {
  // A scene's own frame is already complete and validated: inspect it instead of deep-copying it.
  const captured = isSampled(frame) ? (validateFrame(frame), frame) : captureState(frame),
    plans = new Map();
  if (captured.light)
    unsupported(
      'sceneLight',
      'Flat-art directional shading is supported by SVG/Canvas; configure solid renderer lighting explicitly.',
    );
  if (captured.motionBlur) unsupported('motionBlur', 'Temporal exposure averaging is supported by Canvas/export only.');
  let vertices = 0;
  const work = { count: 0 };
  function visit(node) {
    const p = node.props;
    if (
      p.pivot !== undefined &&
      p.pivot !== null &&
      p.pivot !== 'origin' &&
      !(Array.isArray(p.pivot) && p.pivot.length === 2 && p.pivot.every((v) => v === 0))
    )
      unsupported(
        'transform.pivot',
        'The optional Three adapter does not implement geometry-relative pivots; use origin transforms or a native 2D backend.',
      );
    if ((p.skewX ?? 0) !== 0 || (p.skewY ?? 0) !== 0)
      unsupported('transform.skew', 'The optional Three adapter does not implement 2D skew; use a native 2D backend.');
    if (p.strokeDasharray?.some((v) => v > 0))
      unsupported('stroke.dashes', 'The optional Three adapter does not translate authored dash patterns.');
    if (node.type === 'cloud')
      unsupported(
        'cloud',
        'Draw point clouds with the Canvas renderer (GPU points) or SVG; the Three adapter draws solid geometry.',
      );
    if (node.type === 'text')
      unsupported('text', 'Three text requires an explicit text/texture strategy; use SVG/Canvas for this frame.');
    if (p.clip !== null && p.clip !== undefined)
      unsupported('clip', 'The Three adapter does not translate SVG/Canvas clipping paths.');
    if (blurRadius(p.blur) > 0 || p.glow || p.mask || p.shade || p.texture || (p.blend ?? 'normal') !== 'normal')
      unsupported(
        'look',
        'Native 2D blur/glow/masks/blends are not translated by this solid renderer. Choose a native backend or author a supported Three material explicitly.',
      );
    if (groupOpacity !== 'multiply' && node.type === 'group' && p.opacity > 0 && p.opacity < 1)
      unsupported(
        'group.opacity',
        'Three object alpha is not post-composite group opacity. Use opaque/hidden groups or a supported 2D renderer.',
      );
    if (node.type === 'group' && (p.depth ?? 0) !== 0)
      unsupported('group.depth', 'Extrusion depth belongs to drawable geometry, not a group.');
    if (node.type === 'path' && ((p.trimStart ?? 0) !== 0 || (p.trimEnd ?? 1) !== 1))
      unsupported('path.trim', 'Resolve a trimmed path explicitly before sending it to the Three adapter.');
    const fill = paint(p.fill),
      stroke = paint(p.stroke),
      drawFill = node.type !== 'group' && node.type !== 'line' && fill.alpha > 0,
      drawStroke = node.type !== 'group' && stroke.alpha > 0 && p.strokeWidth > 0;
    if (
      drawStroke &&
      (p.strokeWidth !== 1 ||
        (p.strokeLinecap ?? 'butt') !== 'butt' ||
        (p.strokeLinejoin ?? 'miter') !== 'miter' ||
        (p.strokeMiterlimit ?? 4) !== 4)
    )
      unsupported(
        'stroke.style',
        'Three native lines support only the adapter’s one-pixel basic stroke; wider/custom-cap/custom-join strokes need a mesh stroke implementation.',
      );
    if (node.type === 'line' && (p.depth ?? 0) !== 0)
      unsupported('line.depth', 'Extrusion of an open line is not supported by this adapter.');
    if (drawFill && drawStroke && p.opacity < 1)
      unsupported(
        'shape.opacity',
        'Fractional opacity on combined fill/stroke needs post-composite isolation, which this Three adapter does not provide.',
      );
    let contours = node.type === 'path' ? pathContours(p.commands, tolerance) : [];
    const shapes = drawFill && node.type === 'path' ? pathTopology(contours, p.fillRule ?? 'nonzero', work) : null;
    const points =
      node.type === 'path' || node.type === 'circle' || node.type === 'rect'
        ? shapePoints(node.type, p, contours, segments)
        : [];
    if (node.type === 'circle' || node.type === 'rect') contours = [{ points, closed: true }];
    // Conservative preparation envelope before allocating actual GPU geometries.
    vertices +=
      (drawFill
        ? Math.max(
            36,
            (node.type === 'path' ? contours.reduce((n, c) => n + c.points.length, 0) : points.length) *
              ((p.depth ?? 0) > 0 ? 18 : 3),
          )
        : 0) +
      (drawStroke
        ? Math.max(
            2,
            contours.reduce((n, c) => n + c.points.length + 1, 0),
          )
        : 0);
    assert(vertices <= maxVertices, 'RESOURCE_LIMIT', 'Three geometry preparation exceeds the vertex budget.');
    plans.set(node.id, { node, fill, stroke, drawFill, drawStroke, points, contours, shapes });
    for (const child of node.children) visit(child);
  }
  captured.children.forEach(visit);
  return { frame: captured, plans };
}

const HEX = /^#[\da-f]{6}$/i;
/** Ambient fill, directional key and optional hemisphere sky/ground illumination. */
function lightRig(value = {}) {
  options(
    value,
    [
      'ambient',
      'key',
      'direction',
      'ambientColor',
      'keyColor',
      'hemisphere',
      'sky',
      'ground',
      'shadowRadius',
      'shadowMapSize',
      'shadowBias',
      'shadowNormalBias',
    ],
    'Three light',
  );
  const direction = value.direction ?? [400, 800, 1000];
  assert(
    Array.isArray(direction) &&
      direction.length === 3 &&
      direction.every((v) => Number.isFinite(v)) &&
      direction.some((v) => v !== 0),
    'INVALID_OPTIONS',
    'Light direction must be three finite numbers, not all zero.',
  );
  const ambientColor = value.ambientColor ?? '#ffffff',
    keyColor = value.keyColor ?? '#ffffff',
    sky = value.sky ?? '#ffffff',
    ground = value.ground ?? '#444444';
  assert(
    [ambientColor, keyColor, sky, ground].every((v) => HEX.test(v)),
    'INVALID_OPTIONS',
    'Light colours must be #rrggbb.',
  );
  return Object.freeze({
    ambient: number(value.ambient ?? 0.8, 'ambient light', 0, 20),
    key: number(value.key ?? 2.5, 'key light', 0, 20),
    direction: Object.freeze([...direction]),
    ambientColor,
    keyColor,
    sky,
    ground,
    hemisphere: number(value.hemisphere ?? 0, 'hemisphere light', 0, 20),
    shadowRadius: number(value.shadowRadius ?? 1, 'shadow blur radius', 0, 16),
    shadowMapSize: number(value.shadowMapSize ?? 1024, 'shadow map size', 256, 8192),
    shadowBias: number(value.shadowBias ?? 0, 'shadow depth bias', -0.01, 0.01),
    // World units along the surface normal; 0 keeps three.js's default.
    shadowNormalBias: number(value.shadowNormalBias ?? 0, 'shadow normal bias', 0, 1000),
  });
}

/**
 * Point a directional key light's shadow at a sphere (centre and radius in world units): its camera frames the
 * sphere, and its map size and biases come from the rig. A smaller sphere gives sharper shadows over less of the
 * scene; sharper shadows also show self-shadowing stripes more readily, so raise the biases with them.
 */
function fitShadow(THREE, light, rig, center, radius) {
  light.target.position.copy(center);
  light.position.copy(center).add(new THREE.Vector3(...rig.direction).normalize().multiplyScalar(radius * 3));
  const shadowCamera = light.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -radius * 1.2;
  shadowCamera.right = shadowCamera.top = radius * 1.2;
  shadowCamera.near = Math.max(0.01, radius / 1000);
  shadowCamera.far = radius * 6;
  shadowCamera.updateProjectionMatrix();
  if (light.shadow.mapSize.x !== rig.shadowMapSize) {
    light.shadow.mapSize.set(rig.shadowMapSize, rig.shadowMapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }
  light.shadow.bias = rig.shadowBias;
  light.shadow.normalBias = rig.shadowNormalBias;
}
/** Caller supplies Three.js explicitly. No import, renderer creation or RAF occurs. */
export function createThreeAdapter(spec = {}) {
  options(
    spec,
    [
      'THREE',
      'renderer',
      'camera',
      'coordinateSystem',
      'curveTolerance',
      'maxVertices',
      'material',
      'lighting',
      'light',
      'assets',
      'shadows',
      'groupOpacity',
      'circleSegments',
      'materials',
    ],
    'Three adapter',
  );
  const { THREE } = spec;
  checkThree(THREE);
  const renderer = spec.renderer ?? null;
  if (renderer)
    assert(typeof renderer.render === 'function', 'INVALID_RENDERER', 'A Three renderer needs render(scene,camera).');
  const coordinateSystem = spec.coordinateSystem ?? 'canvas';
  assert(['canvas', 'world'].includes(coordinateSystem), 'INVALID_TRANSFORM', 'Use canvas or world coordinates.');
  const tolerance = number(spec.curveTolerance ?? 0.25, 'Three curve tolerance', 1e-5, 1e4),
    maxVertices = number(spec.maxVertices ?? 250000, 'Three vertex budget', 100, 1000000);
  assert(Number.isInteger(maxVertices), 'RESOURCE_LIMIT', 'The vertex budget must be an integer.');
  const materialType = spec.material ?? 'standard';
  assert(['basic', 'standard'].includes(materialType), 'INVALID_OPTIONS', 'Three material must be basic or standard.');
  const lighting = spec.lighting ?? true,
    shadows = spec.shadows ?? false;
  assert(
    typeof lighting === 'boolean' && typeof shadows === 'boolean',
    'INVALID_OPTIONS',
    'lighting and shadows must be booleans.',
  );
  let rig = lightRig(spec.light);
  let shadowFocus = null;
  const hasHemisphere = rig.hemisphere > 0; // fixed at creation; setLight may dim it to 0 and back
  if (hasHemisphere)
    assert(
      typeof THREE.HemisphereLight === 'function',
      'THREE_REQUIRED',
      'Hemisphere lighting requires THREE.HemisphereLight.',
    );
  const groupOpacity = spec.groupOpacity ?? 'reject';
  assert(['reject', 'multiply'].includes(groupOpacity), 'INVALID_OPTIONS', 'groupOpacity must be reject or multiply.');
  const segments = number(spec.circleSegments ?? 64, 'circle segments', 3, 256);
  assert(Number.isInteger(segments), 'INVALID_OPTIONS', 'circleSegments must be an integer.');
  const materialSpecs = safeCopy(spec.materials ?? []);
  assert(
    Array.isArray(materialSpecs) && materialSpecs.length <= 10000,
    'RESOURCE_LIMIT',
    'Use at most10000 material overrides.',
  );
  const materialOverrides = new Map();
  for (const value of materialSpecs) {
    options(value, ['id', 'unlit', 'emissive', 'emissiveIntensity'], 'Three material');
    assert(
      typeof value.id === 'string' && value.id && !materialOverrides.has(value.id),
      'INVALID_OPTIONS',
      'Material overrides need distinct node IDs.',
    );
    assert(value.unlit === undefined || typeof value.unlit === 'boolean', 'INVALID_OPTIONS', 'unlit must be boolean.');
    assert(value.emissive === undefined || HEX.test(value.emissive), 'INVALID_OPTIONS', 'emissive must be #rrggbb.');
    number(value.emissiveIntensity ?? 1, 'emissive intensity', 0, 20);
    materialOverrides.set(value.id, value);
  }

  let assets = captureAssets(spec.assets);
  const cameraValue = (value) => (value instanceof THREE.Camera ? value : requireCamera(value));
  let configuredCamera = spec.camera ?? null;
  if (configuredCamera) cameraValue(configuredCamera);
  let scene = null,
    camera = null,
    frame = null,
    objects = new Map(),
    resources = new Map(),
    lights = [],
    disposed = false;
  const spareGroups = new Map();
  let paletteMap = null,
    mapping = false,
    committing = false,
    rendering = false,
    releasing = false,
    disposeRequested = false;
  function mutable() {
    assert(!disposed, 'DISPOSED', 'The Three adapter has been disposed.');
    assert(
      !mapping && !committing && !rendering && !releasing,
      'REENTRANT_SAMPLE',
      'A material palette or resource callback cannot mutate its adapter.',
    );
  }
  function release(values) {
    let failure,
      failed = false;
    releasing = true;
    try {
      for (const value of values) {
        try {
          value.dispose?.();
        } catch (error) {
          if (!failed) {
            failure = error;
            failed = true;
          }
        }
      }
    } finally {
      releasing = false;
    }
    if (disposeRequested && !committing && !rendering) {
      disposeRequested = false;
      try {
        dispose();
      } catch (error) {
        if (!failed) {
          failure = error;
          failed = true;
        }
      }
    }
    if (failed) throw failure;
  }
  function makeCamera(prepared) {
    if (prepared instanceof THREE.Camera) return prepared;
    const result = prepared.type === 'perspective' ? new THREE.PerspectiveCamera() : new THREE.OrthographicCamera();
    result.matrixAutoUpdate = false;
    result.matrix.fromArray(prepared.matrixWorld);
    result.matrixWorld.fromArray(prepared.matrixWorld);
    result.matrixWorldInverse.fromArray(prepared.viewMatrix);
    result.projectionMatrix.fromArray(prepared.projectionMatrix);
    result.projectionMatrixInverse.fromArray(inverse3D(prepared.projectionMatrix));
    // Three reads near and far directly (logarithmic depth, shadows, culling), not only the matrix.
    if (Number.isFinite(prepared.near) && Number.isFinite(prepared.far)) {
      result.near = prepared.near;
      result.far = prepared.far;
    }
    result.userData.explainerkitProjection = prepared;
    return result;
  }
  function defaultCamera(width, height) {
    return orthographicCamera(coordinateSystem === 'canvas' ? { x: width / 2, y: -height / 2, z: 1000 } : {}, {
      width,
      height,
    });
  }
  function prepare(input, settings = {}, palette = paletteMap) {
    mutable();
    options(settings, ['camera'], 'Three frame');
    const snapshot = flattenFrame(input, tolerance, maxVertices, groupOpacity, segments),
      prepared = settings.camera ?? configuredCamera ?? defaultCamera(snapshot.frame.width, snapshot.frame.height);
    cameraValue(prepared);
    captureAssets([...assets].map(([id, object]) => ({ id, object })));
    const candidate = new THREE.Scene(),
      root = new THREE.Group(),
      nodes = new Map(),
      used = new Map(),
      allocated = [],
      ownedLights = [];
    candidate.add(root);
    if (coordinateSystem === 'canvas') root.scale.y = -1;
    let keyLight = null;
    if (lighting) {
      const ambient = new THREE.AmbientLight(new THREE.Color(rig.ambientColor), rig.ambient);
      ownedLights.push(ambient);
      candidate.add(ambient);
      keyLight = new THREE.DirectionalLight(new THREE.Color(rig.keyColor), rig.key);
      ownedLights.push(keyLight);
      keyLight.position.set(...rig.direction);
      keyLight.castShadow = shadows;
      keyLight.shadow.radius = rig.shadowRadius;
      candidate.add(keyLight);
    }
    if (lighting && hasHemisphere) {
      const hemisphere = new THREE.HemisphereLight(rig.sky, rig.ground, rig.hemisphere);
      hemisphere.position.set(...rig.direction);
      ownedLights.push(hemisphere);
      candidate.add(hemisphere);
    }
    const resource = (key, localBuild6) => {
      if (used.has(key)) return used.get(key);
      const value = resources.has(key) ? resources.get(key) : localBuild6();
      if (!resources.has(key)) allocated.push(value);
      used.set(key, value);
      return value;
    };
    const mappedPaints = new Map();
    function mappedColour(colour, id, line) {
      if (!palette) return colour;
      const key = JSON.stringify([colour, id, line]);
      if (mappedPaints.has(key)) return mappedPaints.get(key);
      assert(
        mappedPaints.size < 20000,
        'RESOURCE_LIMIT',
        'A Three palette may map at most 20000 distinct node paints per frame.',
      );
      let result;
      mapping = true;
      try {
        result = materialColour(
          palette(materialColour(colour), Object.freeze({ id, role: line ? 'stroke' : 'fill', hasMap: false })),
        );
      } finally {
        mapping = false;
      }
      mappedPaints.set(key, result);
      return result;
    }
    function material(localPaint7, opacity, line, id) {
      const override = materialOverrides.get(id) ?? {},
        kind = override.unlit ? 'basic' : materialType;
      const colour = mappedColour(localPaint7.color, id, line),
        alpha = localPaint7.alpha * opacity,
        key = JSON.stringify(['material', colour, alpha, line, kind, override.emissive, override.emissiveIntensity]);
      return resource(
        key,
        () =>
          new (line
            ? THREE.LineBasicMaterial
            : kind === 'standard'
              ? THREE.MeshStandardMaterial
              : THREE.MeshBasicMaterial)({
            color: new THREE.Color(colour),
            opacity: alpha,
            transparent: alpha < 1,
            depthWrite: alpha === 1,
            ...(line
              ? { linewidth: 1 }
              : {
                  side: THREE.DoubleSide,
                  ...(kind === 'standard'
                    ? {
                        roughness: 0.65,
                        metalness: 0,
                        emissive: new THREE.Color(override.emissive ?? '#000000'),
                        emissiveIntensity: override.emissiveIntensity ?? 1,
                      }
                    : {}),
                }),
            toneMapped: false,
          }),
      );
    }
    function fillGeometry(plan) {
      const p = plan.node.props,
        type = plan.node.type,
        depth = p.depth ?? 0,
        key = JSON.stringify([
          'fill',
          type,
          p.r,
          p.width,
          p.height,
          p.rx,
          depth,
          segments,
          p.fillRule,
          type === 'path' ? (outlineId.get(plan.contours) ?? plan.contours.map((c) => c.points)) : null,
        ]);
      return resource(key, () => {
        if (type === 'circle') {
          if (depth === 0) return new THREE.CircleGeometry(p.r, segments);
          const g = new THREE.CylinderGeometry(p.r, p.r, depth, segments, 1, false);
          g.rotateX(Math.PI / 2);
          g.translate(0, 0, depth / 2);
          return g;
        }
        if (type === 'rect' && (p.rx ?? 0) === 0) {
          const g =
            depth === 0 ? new THREE.PlaneGeometry(p.width, p.height) : new THREE.BoxGeometry(p.width, p.height, depth);
          g.translate(p.width / 2, p.height / 2, depth / 2);
          return g;
        }
        const descriptions = plan.shapes ?? [{ outer: plan.points, holes: [] }];
        const shapes = descriptions.map((description) => {
          const shape = new THREE.Shape(),
            draw = (path, points) => {
              assert(points.length >= 3, 'THREE_GEOMETRY', 'Filled geometry needs a non-degenerate contour.');
              path.moveTo(points[0].x, points[0].y);
              for (const q of points.slice(1)) path.lineTo(q.x, q.y);
              path.closePath();
            };
          draw(shape, description.outer);
          for (const hole of description.holes) {
            assert(typeof THREE.Path === 'function', 'THREE_REQUIRED', 'Compound holes require THREE.Path.');
            const path = new THREE.Path();
            draw(path, hole);
            shape.holes.push(path);
          }
          return shape;
        });
        return depth === 0
          ? new THREE.ShapeGeometry(shapes)
          : new THREE.ExtrudeGeometry(shapes, { depth, steps: 1, bevelEnabled: false, curveSegments: 1 });
      });
    }
    function build(node, parentAlpha = 1) {
      const plan = snapshot.plans.get(node.id),
        p = node.props,
        alpha = parentAlpha * (p.opacity ?? 1),
        group = spareGroups.get(node.id) ?? new THREE.Group();
      group.clear();
      group.name = node.id;
      group.userData.explainerkitId = node.id;
      group.matrixAutoUpdate = false;
      group.matrix.fromArray(
        compose3D(
          Object.fromEntries(
            ['x', 'y', 'z', 'rotationX', 'rotationY', 'rotation', 'scaleX', 'scaleY', 'scaleZ'].map((k) => [
              k,
              p[k] ?? (k.startsWith('scale') ? 1 : 0),
            ]),
          ),
        ),
      );
      group.visible = p.opacity !== 0;
      nodes.set(node.id, group);
      if (
        plan.drawFill &&
        plan.points.length >= 3 &&
        (node.type !== 'circle' || p.r > 0) &&
        (node.type !== 'rect' || (p.width > 0 && p.height > 0))
      ) {
        const mesh = new THREE.Mesh(
          fillGeometry(plan),
          material(plan.fill, alpha * (p.fillOpacity ?? 1), false, node.id),
        );
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        group.add(mesh);
      }
      if (plan.drawStroke) {
        const lines =
          node.type === 'line'
            ? [
                {
                  points: [
                    { x: p.x1, y: p.y1 },
                    { x: p.x2, y: p.y2 },
                  ],
                  closed: false,
                },
              ]
            : plan.contours;
        for (const contour of lines) {
          if (contour.points.length < 2) continue;
          const points = contour.points.map((q) => new THREE.Vector3(q.x, q.y, 0));
          if (contour.closed && (points[0].x !== points.at(-1).x || points[0].y !== points.at(-1).y))
            points.push(points[0].clone());
          const key = JSON.stringify(['stroke', points.map((localP8) => [localP8.x, localP8.y, localP8.z])]),
            geometry = resource(key, () => new THREE.BufferGeometry().setFromPoints(points));
          group.add(new THREE.Line(geometry, material(plan.stroke, alpha * (p.strokeOpacity ?? 1), true, node.id)));
        }
      }
      if (assets.has(node.id)) {
        if (groupOpacity === 'multiply' && alpha !== 1)
          unsupported('asset.opacity', 'Alpha multiplication of external materials is not owned by this adapter.');
        group.add(assets.get(node.id).clone(true));
      }
      for (const child of node.children) group.add(build(child, groupOpacity === 'multiply' ? alpha : 1));
      return group;
    }
    try {
      for (const id of assets.keys()) {
        assert(snapshot.plans.has(id), 'ASSET_TARGET_MISSING', `The asset target ${id} is absent from this frame.`);
        assert(
          snapshot.plans.get(id).node.type === 'group',
          'INVALID_ASSET',
          'Attach external assets to an explicit group node.',
        );
      }
      for (const node of snapshot.frame.children) root.add(build(node));
      let actual = 0;
      candidate.traverse((object) => {
        if (object.geometry) actual += object.geometry.getAttribute('position')?.count ?? 0;
      });
      assert(actual <= maxVertices, 'RESOURCE_LIMIT', 'Actual Three geometry exceeds the vertex budget.');
      candidate.updateMatrixWorld(true);
      if (shadows && keyLight) {
        const bounds = new THREE.Box3().setFromObject(root),
          center = shadowFocus
            ? new THREE.Vector3(shadowFocus.x, shadowFocus.y, shadowFocus.z)
            : bounds.isEmpty()
              ? new THREE.Vector3()
              : bounds.getCenter(new THREE.Vector3()),
          radius = shadowFocus
            ? shadowFocus.radius
            : bounds.isEmpty()
              ? 100
              : Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
        candidate.add(keyLight.target);
        fitShadow(THREE, keyLight, rig, center, radius);
        candidate.updateMatrixWorld(true);
      }
      return {
        scene: candidate,
        camera: makeCamera(prepared),
        frame: snapshot.frame,
        nodes,
        used,
        allocated,
        lights: ownedLights,
      };
    } catch (error) {
      try {
        release([...ownedLights, ...allocated]);
      } catch {
        /* Keep the preparation error. */
      }
      throw error;
    }
  }
  function commitProjection(next, publish) {
    // Only reconcile after preparation and any renderer call succeeded. Spare groups
    // are detached candidate shells, never objects in the last committed scene.
    const retained = new Map(),
      spares = new Map(),
      childPlans = new Map();
    function retain(candidate) {
      const id = candidate.userData.explainerkitId,
        old = objects.get(id);
      const children = [...candidate.children].map((child) =>
        next.nodes.get(child.userData.explainerkitId) === child ? retain(child) : child,
      );
      if (!old) {
        retained.set(id, candidate);
        childPlans.set(candidate, children);
        return candidate;
      }
      const oldDrawables = old.children.filter((child) => objects.get(child.userData.explainerkitId) !== child);
      let index = 0;
      const nextChildren = children.map((child) => {
        if (retained.get(child.userData.explainerkitId) === child) return child;
        const previous = oldDrawables[index++];
        if (previous && previous.type === child.type && child.geometry && previous.geometry) {
          previous.geometry = child.geometry;
          previous.material = child.material;
          previous.castShadow = child.castShadow;
          previous.receiveShadow = child.receiveShadow;
          return previous;
        }
        return child;
      });
      old.matrix.copy(candidate.matrix);
      old.visible = candidate.visible;
      old.name = candidate.name;
      childPlans.set(old, nextChildren);
      childPlans.set(candidate, []);
      spares.set(id, candidate);
      retained.set(id, old);
      return old;
    }
    const root = next.scene.children[0],
      children = [...root.children].map(retain);
    childPlans.set(root, children);
    if (scene) childPlans.set(scene.children[0], []);
    const notifications = [];
    // Apply links coherently before invoking Three observers. clear()/add() would
    // notify halfway through and a throwing observer could strand an empty group.
    for (const [parent] of childPlans) {
      for (const child of parent.children) {
        child.parent = null;
        notifications.push([child, { type: 'removed' }], [parent, { type: 'childremoved', child }]);
      }
      parent.children.length = 0;
    }
    for (const [parent, list] of childPlans) {
      for (const child of list) {
        child.parent = parent;
        parent.children.push(child);
        notifications.push([child, { type: 'added' }], [parent, { type: 'childadded', child }]);
      }
    }
    next.scene.updateMatrixWorld(true);
    const retired = [...lights, ...[...resources].filter(([key]) => !next.used.has(key)).map(([, value]) => value)];
    spareGroups.clear();
    for (const [id, group] of spares) spareGroups.set(id, group);
    scene = next.scene;
    camera = next.camera;
    frame = next.frame;
    objects = retained;
    resources = next.used;
    lights = next.lights;
    publish();
    // Publish before notifying resource observers. A deferred dispose then clears the
    // new projection too, and an observer exception cannot leave a stale mapping.
    let failure,
      failed = false;
    for (const [object, event] of notifications) {
      try {
        object.dispatchEvent(event);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    try {
      release(retired);
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
    if (failed) throw failure;
    return scene;
  }
  function commit(next, publish = () => {}) {
    mutable();
    committing = true;
    let published = false,
      result,
      failed = false,
      failure;
    try {
      result = commitProjection(next, () => {
        published = true;
        publish();
      });
    } catch (error) {
      if (!published) {
        try {
          release([...next.lights, ...next.allocated]);
        } catch {
          /* Preserve the original projection error. */
        }
      }
      failed = true;
      failure = error;
    } finally {
      committing = false;
      if (disposeRequested) {
        disposeRequested = false;
        try {
          dispose();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
    }
    if (failed) throw failure;
    return disposed ? null : result;
  }
  /**
   * Change the light rig in place (a theme, a time of day): colours, intensities and direction apply to the lights
   * of the committed scene at once and to every later rebuild. Whether a hemisphere light exists is fixed at
   * creation; set its intensity to 0 to switch it off.
   */
  /**
   * Keep the key light's shadow on the part of the scene that matters: a world-space centre {x, y, z} and a radius.
   * Shadows outside the sphere are not drawn; inside it they get the full map resolution. Pass null to frame the
   * whole scene again from its next update.
   */
  function setShadowFocus(center, radius) {
    mutable();
    assert(shadows, 'INVALID_OPTIONS', 'setShadowFocus needs an adapter created with shadows: true.');
    if (center === null) {
      shadowFocus = null;
      return;
    }
    assert(
      center && [center.x, center.y, center.z].every(Number.isFinite),
      'INVALID_OPTIONS',
      'The shadow focus needs a finite centre {x, y, z}.',
    );
    shadowFocus = { x: center.x, y: center.y, z: center.z, radius: number(radius, 'shadow focus radius', 0.01, 1e7) };
    for (const light of lights)
      if (light.isDirectionalLight && light.castShadow)
        fitShadow(
          THREE,
          light,
          rig,
          new THREE.Vector3(shadowFocus.x, shadowFocus.y, shadowFocus.z),
          shadowFocus.radius,
        );
  }

  function setLight(partial = {}) {
    mutable();
    assert(lighting, 'INVALID_OPTIONS', 'setLight needs an adapter created with lighting: true.');
    const next = lightRig({ ...rig, ...partial });
    assert(
      hasHemisphere || next.hemisphere === 0,
      'INVALID_OPTIONS',
      'A hemisphere light can only be lit when the adapter is created with one.',
    );
    rig = next;
    for (const light of lights) {
      if (light.isHemisphereLight) {
        light.color.set(rig.sky);
        light.groundColor.set(rig.ground);
        light.intensity = rig.hemisphere;
      } else if (light.isDirectionalLight) {
        light.color.set(rig.keyColor);
        light.intensity = rig.key;
        light.shadow.radius = rig.shadowRadius;
        light.shadow.bias = rig.shadowBias;
        const target = light.target?.position ?? new THREE.Vector3(),
          reach = light.position.distanceTo(target) || 1;
        light.position.copy(target).add(new THREE.Vector3(...rig.direction).normalize().multiplyScalar(reach));
      } else if (light.isAmbientLight) {
        light.color.set(rig.ambientColor);
        light.intensity = rig.ambient;
      }
    }
    return rig;
  }
  /**
   * Reproject owned albedos from authored colours, atomically. No drawing or clock is installed.
   * @param {MaterialPalette|null} map
   */
  function setPalette(map) {
    mutable();
    assert(
      map === null || typeof map === 'function',
      'INVALID_OPTIONS',
      'Pass a material colour mapping function, or null to restore authored colours.',
    );
    if (frame)
      commit(prepare(frame, { camera }, map), () => {
        paletteMap = map;
      });
    else paletteMap = map;
  }
  function dispose() {
    assert(!mapping, 'REENTRANT_SAMPLE', 'A material palette callback cannot dispose its adapter.');
    if (disposed) return;
    if (committing || rendering || releasing) {
      disposeRequested = true;
      return;
    }
    disposed = true;
    const retired = [...lights, ...resources.values()];
    lights = [];
    resources.clear();
    objects.clear();
    spareGroups.clear();
    scene = null;
    camera = null;
    frame = null;
    paletteMap = null;
    release(retired);
  }
  return Object.freeze({
    get scene() {
      return scene;
    },
    get camera() {
      return camera;
    },
    get frame() {
      return frame;
    },
    /** The current light rig (frozen). */
    get light() {
      return rig;
    },
    setLight,
    setShadowFocus,
    setPalette,
    get disposed() {
      return disposed;
    },
    get capabilities() {
      return Object.freeze({
        coordinateSystem,
        solidPaint: true,
        extrusion: true,
        standardMaterial: true,
        externalAssets: true,
        shadows,
        text: false,
        clip: false,
        gradients: false,
        groupAlpha: groupOpacity === 'multiply',
        groupOpacity,
        compoundPaths: true,
        circleSegments: segments,
        nativeStrokePixels: 1,
      });
    },
    object(id) {
      return objects.get(id) ?? null;
    },
    update(input, settings) {
      return commit(prepare(input, settings));
    },
    render(input, settings) {
      assert(
        renderer,
        'INVALID_RENDERER',
        'Pass a Three renderer, or use update() and render the returned scene yourself.',
      );
      const next = prepare(input, settings);
      let failure,
        failed = false;
      rendering = true;
      try {
        renderer.render(next.scene, next.camera);
      } catch (error) {
        failed = true;
        failure = error;
      } finally {
        rendering = false;
      }
      if (failed || disposeRequested) {
        const terminal = disposeRequested;
        disposeRequested = false;
        try {
          release([...next.lights, ...next.allocated]);
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
        if (terminal) {
          try {
            dispose();
          } catch (error) {
            if (!failed) {
              failed = true;
              failure = error;
            }
          }
        }
        if (failed) throw failure;
        return null;
      }
      return commit(next);
    },
    setCamera(next) {
      mutable();
      if (next !== null) cameraValue(next);
      configuredCamera = next;
    },
    setAssets(next) {
      mutable();
      assets = captureAssets(next);
    },
    dispose,
  });
}

/** Optional renderer convenience; the caller still imports and supplies Three.js. */
export function createThreeRenderer(container, spec = {}) {
  options(
    spec,
    [
      'THREE',
      'camera',
      'coordinateSystem',
      'curveTolerance',
      'maxVertices',
      'pixelRatio',
      'antialias',
      'label',
      'material',
      'lighting',
      'light',
      'assets',
      'shadows',
      'groupOpacity',
      'circleSegments',
      'materials',
    ],
    'Three renderer',
  );
  assert(
    container?.ownerDocument && typeof container.appendChild === 'function',
    'INVALID_CONTAINER',
    'Mount the optional Three renderer into a DOM element.',
  );
  checkThree(spec.THREE);
  assert(
    typeof spec.THREE.WebGLRenderer === 'function',
    'THREE_REQUIRED',
    'The supplied Three namespace must include WebGLRenderer.',
  );
  const ratio = number(spec.pixelRatio ?? 1, 'Three pixel ratio', 0.25, 4),
    antialias = spec.antialias ?? true;
  assert(typeof antialias === 'boolean', 'INVALID_OPTIONS', 'antialias must be boolean.');
  let renderer;
  const proxy = {
      render(scene, camera) {
        renderer.setSize(nextSize.width, nextSize.height, false);
        renderer.render(scene, camera);
      },
    },
    adapter = createThreeAdapter({
      ...Object.fromEntries(
        [
          'THREE',
          'camera',
          'coordinateSystem',
          'curveTolerance',
          'maxVertices',
          'material',
          'lighting',
          'light',
          'assets',
          'shadows',
          'groupOpacity',
          'circleSegments',
          'materials',
        ]
          .filter((k) => spec[k] !== undefined)
          .map((k) => [k, spec[k]]),
      ),
      renderer: proxy,
    });
  const canvas = container.ownerDocument.createElement('canvas');
  let nextSize = null;
  try {
    renderer = new spec.THREE.WebGLRenderer({ canvas, alpha: true, antialias, preserveDrawingBuffer: true });
  } catch (cause) {
    adapter.dispose();
    const error = new Error('WebGL 2 is unavailable. Choose SVG/Canvas or use a browser/device with WebGL 2.');
    error.code = 'THREE_WEBGL_UNAVAILABLE';
    error.cause = cause;
    throw error;
  }
  const element = renderer.domElement;
  Object.assign(element.style, { display: 'block', width: '100%', height: 'auto' });
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', spec.label ?? 'ExplainerKit spatial scene');
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = spec.shadows ?? false;
  container.appendChild(element);
  let disposed = false,
    disposing = false,
    operating = false,
    disposeRequested = false;
  function dispose() {
    if (disposed || disposing) return;
    disposing = true;
    let failure,
      failed = false;
    try {
      try {
        adapter.dispose();
      } catch (error) {
        // Refusal from a palette callback leaves both adapter and wrapper usable.
        if (!adapter.disposed) throw error;
        failed = true;
        failure = error;
      }
      if (operating || !adapter.disposed) {
        // The adapter defers disposal while it draws or publishes. Never tear
        // down its GPU context or DOM element from inside that operation.
        disposeRequested = true;
        if (failed) throw failure;
        return;
      }
      disposed = true;
      disposeRequested = false;
      for (const release of [() => renderer.dispose(), () => renderer.forceContextLoss?.(), () => element.remove()]) {
        try {
          release();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
      if (failed) throw failure;
    } finally {
      disposing = false;
    }
  }
  /** @template T @param {() => T} operation @returns {T} */
  function operate(operation) {
    assert(!disposed, 'DISPOSED', 'The Three renderer has been disposed.');
    assert(
      !operating && !disposing,
      'REENTRANT_SAMPLE',
      'A Three renderer operation cannot recursively mutate its wrapper.',
    );
    operating = true;
    let result,
      failure,
      failed = false;
    try {
      result = operation();
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      operating = false;
      if (disposeRequested || adapter.disposed) {
        try {
          dispose();
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
    }
    if (failed) throw failure;
    return result;
  }
  return Object.freeze({
    element,
    get scene() {
      return adapter.scene;
    },
    get camera() {
      return adapter.camera;
    },
    get frame() {
      return adapter.frame;
    },
    get capabilities() {
      return adapter.capabilities;
    },
    render(frame, settings) {
      return operate(() => {
        const w = Object.getOwnPropertyDescriptor(frame, 'width'),
          h = Object.getOwnPropertyDescriptor(frame, 'height');
        assert(w && h && 'value' in w && 'value' in h, 'INVALID_FRAME', 'Frame dimensions must be declarative values.');
        const logicalWidth = number(w.value, 'Three frame width', 1, 8192),
          logicalHeight = number(h.value, 'Three frame height', 1, 8192),
          width = Math.ceil(logicalWidth * ratio),
          height = Math.ceil(logicalHeight * ratio);
        assert(
          width <= 8192 && height <= 8192 && width * height <= 8000000,
          'RESOURCE_LIMIT',
          'Three viewport exceeds the raster budget.',
        );
        nextSize = { width: logicalWidth, height: logicalHeight };
        adapter.render(frame, settings);
      });
    },
    setCamera: (next) => adapter.setCamera(next),
    setAssets: (next) => adapter.setAssets(next),
    setLight: (partial) => adapter.setLight(partial),
    /** @param {MaterialPalette|null} map */
    setPalette(map) {
      return operate(() => adapter.setPalette(map));
    },
    dispose,
  });
}

export { createThreeFramePlane } from './three-frame-plane.js';
