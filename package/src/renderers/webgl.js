import { assert, number, options, text, safeCopy } from '../core/validate.js';

const MAX_POINTS = 100000,
  MAX_LINES = 200000,
  MAX_PIXELS = 8000000;
const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function buffer(value, Type, label, maxLength) {
  assert(
    value instanceof Type && Object.getPrototypeOf(value) === Type.prototype && !Object.hasOwn(value, 'length'),
    'INVALID_GPU_FRAME',
    `${label} must be a native ${Type.name}.`,
  );
  assert(value.length <= maxLength, 'RESOURCE_LIMIT', `${label} exceeds its buffer budget.`);
  let copy;
  try {
    copy = new Type(value);
  } catch {
    assert(false, 'INVALID_GPU_FRAME', `${label} buffer is detached or unavailable.`);
  }
  return copy;
}
function matrix(value) {
  const m = value === undefined ? identity() : buffer(value, Float32Array, 'matrix', 16);
  assert(m.length === 16, 'INVALID_GPU_FRAME', 'matrix needs 16 column-major values.');
  for (const v of m) number(v, 'matrix value');
  return m;
}
function rgba(value, label) {
  const copy = safeCopy(value);
  assert(Array.isArray(copy) && copy.length === 4, 'INVALID_GPU_FRAME', `${label} needs [r,g,b,a].`);
  copy.forEach((v) => number(v, label, 0, 1));
  return copy;
}

/** Capture independent typed arrays. This is a point/line GPU contract, not a scene tree. */
export function capturePointFrame(frame, spec = {}) {
  options(spec, ['maxPoints', 'maxLines'], 'GPU limits');
  options(
    frame,
    [
      'width',
      'height',
      'positions',
      'colors',
      'color',
      'indices',
      'matrix',
      'pointSize',
      'pointShape',
      'blend',
      'drawPoints',
      'clearColor',
    ],
    'point frame',
  );
  const maxPoints = number(spec.maxPoints ?? MAX_POINTS, 'point budget', 1, MAX_POINTS),
    maxLines = number(spec.maxLines ?? MAX_LINES, 'line budget', 0, MAX_LINES);
  assert(
    Number.isInteger(maxPoints) && Number.isInteger(maxLines),
    'INVALID_GPU_FRAME',
    'GPU limits must be integers.',
  );
  const positions = buffer(frame.positions, Float32Array, 'positions', maxPoints * 3);
  assert(
    positions.length % 3 === 0 && positions.length / 3 <= maxPoints,
    'RESOURCE_LIMIT',
    'Point positions need xyz triplets within the point budget.',
  );
  const count = positions.length / 3;
  for (const v of positions) number(v, 'point coordinate');
  let colors = null;
  if (frame.colors !== undefined && frame.colors !== null) {
    colors = buffer(frame.colors, Float32Array, 'colors', count * 4);
    assert(colors.length === count * 4, 'INVALID_GPU_FRAME', 'Each point needs four color components.');
    for (const v of colors) number(v, 'point color', 0, 1);
  }
  let indices = null;
  if (frame.indices !== undefined && frame.indices !== null) {
    assert(
      frame.indices instanceof Uint16Array || frame.indices instanceof Uint32Array,
      'INVALID_GPU_FRAME',
      'Line indices must be Uint16Array or Uint32Array.',
    );
    indices = buffer(
      frame.indices,
      frame.indices instanceof Uint32Array ? Uint32Array : Uint16Array,
      'indices',
      maxLines * 2,
    );
    assert(
      indices.length % 2 === 0 && indices.length / 2 <= maxLines,
      'RESOURCE_LIMIT',
      'Line indices need endpoint pairs within the line budget.',
    );
    for (const index of indices)
      assert(index < count, 'INVALID_GPU_FRAME', 'Every line endpoint must index an existing point.');
  }
  const blend = frame.blend ?? 'alpha',
    pointShape = frame.pointShape ?? 'circle',
    drawPoints = frame.drawPoints ?? true;
  assert(['alpha', 'additive'].includes(blend), 'INVALID_GPU_FRAME', 'Use alpha or additive blending.');
  assert(
    ['circle', 'square', 'glow'].includes(pointShape),
    'INVALID_GPU_FRAME',
    'Point shape must be circle, square or glow.',
  );
  assert(typeof drawPoints === 'boolean', 'INVALID_GPU_FRAME', 'drawPoints must be boolean.');
  return Object.freeze({
    width: number(frame.width, 'GPU width', 1, 8192),
    height: number(frame.height, 'GPU height', 1, 8192),
    positions,
    colors,
    indices,
    matrix: matrix(frame.matrix),
    color: rgba(frame.color ?? [1, 1, 1, 1], 'point color'),
    clearColor: rgba(frame.clearColor ?? [0, 0, 0, 0], 'clear color'),
    pointSize: number(frame.pointSize ?? 4, 'point size', 1, 2048),
    pointShape,
    blend,
    drawPoints,
  });
}

/** Convert an authored y-down affine drawing into WebGL clip space. */
export function screenProjection(width, height, spec = {}) {
  options(spec, ['transform'], 'screen projection');
  number(width, 'projection width', 1, 8192);
  number(height, 'projection height', 1, 8192);
  const t = spec.transform ?? [1, 0, 0, 1, 0, 0];
  assert(Array.isArray(t) && t.length === 6, 'INVALID_GPU_FRAME', 'Use a six-number affine transform.');
  const c = safeCopy(t);
  c.forEach((v) => number(v, 'projection transform'));
  const [a, b, d, e, x, y] = c;
  return new Float32Array([
    (2 * a) / width,
    (-2 * b) / height,
    0,
    0,
    (2 * d) / width,
    (-2 * e) / height,
    0,
    0,
    0,
    0,
    1,
    0,
    (2 * x) / width - 1,
    1 - (2 * y) / height,
    0,
    1,
  ]);
}
/** Analytic projection using the same column-major world-to-clip matrix as the shader. */
export function projectGPUPoint(point, m, spec = {}) {
  options(point, ['x', 'y', 'z'], 'GPU point');
  options(spec, ['width', 'height'], 'projection viewport');
  const p = [number(point.x, 'point x'), number(point.y, 'point y'), number(point.z ?? 0, 'point z'), 1],
    a = matrix(m),
    clip = [];
  for (let row = 0; row < 4; row++) clip.push(a[row] * p[0] + a[row + 4] * p[1] + a[row + 8] * p[2] + a[row + 12]);
  const width = number(spec.width, 'projection width', 1, 8192),
    height = number(spec.height, 'projection height', 1, 8192),
    w = clip[3];
  if (w === 0) return Object.freeze({ x: null, y: null, depth: null, visible: false, w });
  return Object.freeze({
    x: ((clip[0] / w + 1) * width) / 2,
    y: ((1 - clip[1] / w) * height) / 2,
    depth: clip[2] / w,
    visible: w > 0 && clip.slice(0, 3).every((v) => Math.abs(v) <= w),
    w,
  });
}

const vertex = `#version 300 es
precision highp float;
in vec3 a_position;
in vec4 a_color;
uniform mat4 u_matrix;
uniform float u_pointSize;
out vec4 v_color;
void main(){gl_Position=u_matrix*vec4(a_position,1.0);gl_PointSize=u_pointSize;v_color=a_color;}`;
const fragment = `#version 300 es
precision highp float;
in vec4 v_color;
uniform int u_shape;
out vec4 outColor;
void main(){float a=v_color.a;if(u_shape>0){vec2 p=gl_PointCoord*2.0-1.0;float r2=dot(p,p);if(r2>1.0)discard;if(u_shape==2)a*=pow(1.0-r2,2.0);}outColor=vec4(v_color.rgb*a,a);}`;
function error(code, message, cause) {
  return Object.assign(new Error(message), { code, ...(cause === undefined ? {} : { cause }) });
}

/** Owned WebGL2 point/line renderer with offscreen preparation and explicit context lifecycle. */
export function createWebGLRenderer(container, spec = {}) {
  options(spec, ['label', 'pixelRatio', 'maxPoints', 'maxLines'], 'WebGL renderer');
  assert(
    container?.ownerDocument && typeof container.appendChild === 'function',
    'INVALID_CONTAINER',
    'Mount WebGL into a DOM container.',
  );
  const ratio = number(spec.pixelRatio ?? 1, 'pixelRatio', 0.25, 4),
    limits = {
      maxPoints: number(spec.maxPoints ?? MAX_POINTS, 'point limit', 1, MAX_POINTS),
      maxLines: number(spec.maxLines ?? MAX_LINES, 'line limit', 0, MAX_LINES),
    };
  assert(
    Number.isInteger(limits.maxPoints) && Number.isInteger(limits.maxLines),
    'INVALID_GPU_FRAME',
    'GPU limits must be integers.',
  );
  text(spec.label ?? 'ExplainerKit points and lines', 'WebGL label', 1000);
  const canvas = container.ownerDocument.createElement('canvas'),
    gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
  if (!gl) throw error('RENDER_UNSUPPORTED', 'WebGL2 is unavailable; this optional renderer has no silent fallback.');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', spec.label ?? 'ExplainerKit points and lines');
  Object.assign(canvas.style, { width: '100%', height: 'auto', display: 'block' });
  let disposed = false,
    lost = false,
    program = null,
    locations = null,
    current = null,
    frame = null,
    caps = null,
    lastError = null;
  const listeners = new Map();
  function emit(name, value) {
    for (const fn of [...(listeners.get(name) ?? [])])
      try {
        fn(value);
      } catch {}
  }
  function checkGL(label) {
    if (gl.isContextLost()) {
      lost = true;
      throw error('WEBGL_CONTEXT_LOST', 'WebGL context was lost.');
    }
    const code = gl.getError();
    if (code !== gl.NO_ERROR) throw error('WEBGL_ERROR', `${label} failed with WebGL error ${code}.`);
  }
  function shader(type, source) {
    const s = gl.createShader(type);
    if (!s) throw error('WEBGL_ALLOCATION', 'Cannot allocate a shader.');
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw error('WEBGL_SHADER', `Shader compilation failed: ${message}`);
    }
    return s;
  }
  function setup() {
    let vs = null,
      fs = null,
      p = null;
    try {
      vs = shader(gl.VERTEX_SHADER, vertex);
      fs = shader(gl.FRAGMENT_SHADER, fragment);
      p = gl.createProgram();
      if (!p) throw error('WEBGL_ALLOCATION', 'Cannot allocate WebGL program.');
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw error('WEBGL_SHADER', `Program link failed: ${gl.getProgramInfoLog(p)}`);
      program = p;
      locations = {
        position: gl.getAttribLocation(p, 'a_position'),
        color: gl.getAttribLocation(p, 'a_color'),
        matrix: gl.getUniformLocation(p, 'u_matrix'),
        size: gl.getUniformLocation(p, 'u_pointSize'),
        shape: gl.getUniformLocation(p, 'u_shape'),
      };
      caps = Object.freeze({
        version: 'webgl2',
        ...limits,
        pixelRatio: ratio,
        pointSizeRange: Object.freeze(Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE))),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      });
      checkGL('Shader setup');
    } catch (e) {
      if (p) gl.deleteProgram(p);
      program = null;
      throw e;
    } finally {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    }
  }
  function release(bundle) {
    if (!bundle) return;
    if (bundle.vao) gl.deleteVertexArray(bundle.vao);
    for (const b of [bundle.positions, bundle.colors, bundle.indices]) if (b) gl.deleteBuffer(b);
    if (bundle.texture) gl.deleteTexture(bundle.texture);
    if (bundle.framebuffer) gl.deleteFramebuffer(bundle.framebuffer);
  }
  function makeBuffer(target, data) {
    const b = gl.createBuffer();
    if (!b) throw error('WEBGL_ALLOCATION', 'Cannot allocate a GPU buffer.');
    try {
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.DYNAMIC_DRAW);
      return b;
    } catch (e) {
      gl.deleteBuffer(b);
      throw e;
    }
  }
  function preflight(input) {
    const next = capturePointFrame(input, limits),
      width = Math.ceil(next.width * ratio),
      height = Math.ceil(next.height * ratio);
    assert(
      width <= caps.maxTextureSize && height <= caps.maxTextureSize && width * height <= MAX_PIXELS,
      'RESOURCE_LIMIT',
      'WebGL drawing buffer exceeds its texture/pixel budget.',
    );
    assert(
      !next.drawPoints ||
        next.positions.length === 0 ||
        (next.pointSize * ratio >= caps.pointSizeRange[0] && next.pointSize * ratio <= caps.pointSizeRange[1]),
      'RENDER_UNSUPPORTED',
      'Requested point size exceeds this GPU capability.',
    );
    return { next, width, height };
  }
  function prepare(next, width, height) {
    const bundle = { width, height };
    try {
      bundle.vao = gl.createVertexArray();
      if (!bundle.vao) throw error('WEBGL_ALLOCATION', 'Cannot allocate point/line vertex state.');
      gl.bindVertexArray(bundle.vao);
      bundle.positions = makeBuffer(gl.ARRAY_BUFFER, next.positions);
      if (next.colors) bundle.colors = makeBuffer(gl.ARRAY_BUFFER, next.colors);
      if (next.indices?.length) bundle.indices = makeBuffer(gl.ELEMENT_ARRAY_BUFFER, next.indices);
      bundle.texture = gl.createTexture();
      bundle.framebuffer = gl.createFramebuffer();
      if (!bundle.texture || !bundle.framebuffer)
        throw error('WEBGL_ALLOCATION', 'Cannot allocate a candidate drawing buffer.');
      gl.bindTexture(gl.TEXTURE_2D, bundle.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bundle.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bundle.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw error('WEBGL_ALLOCATION', 'Candidate framebuffer is incomplete.');
      checkGL('GPU preparation');
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.DITHER);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, next.blend === 'additive' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      const [r, g, b, a] = next.clearColor;
      gl.clearColor(r * a, g * a, b * a, a);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, bundle.positions);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 3, gl.FLOAT, false, 0, 0);
      if (bundle.colors) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bundle.colors);
        gl.enableVertexAttribArray(locations.color);
        gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(locations.color);
        gl.vertexAttrib4fv(locations.color, next.color);
      }
      gl.uniformMatrix4fv(locations.matrix, false, next.matrix);
      gl.uniform1f(locations.size, next.pointSize * ratio);
      if (bundle.indices) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bundle.indices);
        gl.uniform1i(locations.shape, 0);
        gl.lineWidth(1);
        gl.drawElements(
          gl.LINES,
          next.indices.length,
          next.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
          0,
        );
      }
      if (next.drawPoints && next.positions.length) {
        gl.uniform1i(locations.shape, next.pointShape === 'square' ? 0 : next.pointShape === 'glow' ? 2 : 1);
        gl.drawArrays(gl.POINTS, 0, next.positions.length / 3);
      }
      checkGL('Point/line drawing');
      return bundle;
    } catch (e) {
      release(bundle);
      throw e;
    }
  }
  function present(bundle) {
    if (canvas.width !== bundle.width) canvas.width = bundle.width;
    if (canvas.height !== bundle.height) canvas.height = bundle.height;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, bundle.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.blitFramebuffer(
      0,
      0,
      bundle.width,
      bundle.height,
      0,
      0,
      bundle.width,
      bundle.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    checkGL('Frame presentation');
  }
  function draw(input) {
    assert(!disposed, 'DISPOSED', 'This WebGL renderer has been disposed.');
    assert(!lost && !gl.isContextLost(), 'WEBGL_CONTEXT_LOST', 'Wait for context restoration before rendering.');
    assert(program, 'WEBGL_NOT_READY', 'The WebGL program is unavailable after a setup failure.');
    const { next, width, height } = preflight(input),
      candidate = prepare(next, width, height);
    try {
      present(candidate);
    } catch (e) {
      release(candidate);
      if (current && !gl.isContextLost())
        try {
          present(current);
        } catch {}
      throw e;
    }
    const old = current;
    current = candidate;
    frame = next;
    release(old);
    lastError = null;
    return metadata();
  }
  function metadata() {
    return frame
      ? Object.freeze({
          width: frame.width,
          height: frame.height,
          points: frame.positions.length / 3,
          lines: (frame.indices?.length ?? 0) / 2,
          blend: frame.blend,
          pointSize: frame.pointSize,
          pointShape: frame.pointShape,
        })
      : null;
  }
  function contextLost(event) {
    event.preventDefault();
    if (disposed) return;
    lost = true;
    current = null;
    program = null;
    locations = null;
    emit('contextlost', metadata());
  }
  function contextRestored() {
    if (disposed) return;
    lost = false;
    try {
      setup();
      if (frame) draw(frame);
      emit('contextrestored', metadata());
    } catch (e) {
      lastError = e;
      emit('error', e);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('webglcontextrestored', contextRestored);
    if (!gl.isContextLost()) {
      release(current);
      if (program) gl.deleteProgram(program);
    }
    current = null;
    program = null;
    locations = null;
    frame = null;
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    emit('dispose');
    listeners.clear();
  }
  try {
    setup();
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    container.appendChild(canvas);
  } catch (e) {
    dispose();
    throw e;
  }
  return Object.freeze({
    element: canvas,
    render: draw,
    dispose,
    snapshot() {
      assert(!disposed, 'DISPOSED', 'This WebGL renderer has been disposed.');
      return frame ? capturePointFrame(frame, limits) : null;
    },
    on(name, fn) {
      assert(!disposed, 'DISPOSED', 'This WebGL renderer has been disposed.');
      assert(
        ['contextlost', 'contextrestored', 'error', 'dispose'].includes(name) && typeof fn === 'function',
        'INVALID_LISTENER',
        'Use a supported WebGL event and callback.',
      );
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    get frame() {
      return metadata();
    },
    get capabilities() {
      return caps;
    },
    get lost() {
      return lost;
    },
    get disposed() {
      return disposed;
    },
    get error() {
      return lastError;
    },
  });
}
