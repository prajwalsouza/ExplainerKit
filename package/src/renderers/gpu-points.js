/** Draws large point clouds into a 2D context through one lazily created WebGL2 canvas. */
const vertex = `#version 300 es
precision highp float;
in vec2 a_position;
in vec4 a_color;
in float a_radius;
uniform mat3 u_matrix;
uniform float u_scale;
out vec4 v_color;
out float v_pixels;
void main(){
  vec3 p=u_matrix*vec3(a_position,1.0);
  gl_Position=vec4(p.xy,0.0,1.0);
  v_pixels=max(a_radius*u_scale,0.5);
  gl_PointSize=2.0*v_pixels+1.0;
  v_color=a_color;
}`;
const fragment = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_pixels;
uniform int u_shape;
out vec4 outColor;
void main(){
  vec2 p=(gl_PointCoord*2.0-1.0)*(v_pixels+0.5);
  float a=v_color.a;
  if(u_shape==0)a*=clamp(v_pixels-length(p)+0.5,0.0,1.0);
  else if(u_shape==1)a*=clamp(v_pixels-max(abs(p.x),abs(p.y))+0.5,0.0,1.0);
  else{float r=clamp(length(p)/v_pixels,0.0,1.0);a*=(1.0-r*r)*(1.0-r*r);}
  if(a<=0.0)discard;
  outColor=vec4(v_color.rgb*a,a);
}`;
const SHAPES = { circle: 0, square: 1, glow: 2 };

export function createPointRasterizer(doc) {
  let canvas = null,
    gl = null,
    program = null,
    locations = null,
    buffers = null,
    maxPointSize = 0,
    failed = false;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed.');
    return shader;
  }
  function init() {
    if (gl || failed) return !!gl;
    try {
      canvas = doc.createElement('canvas');
      gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) throw new Error('WebGL2 unavailable.');
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed.');
      locations = {
        position: gl.getAttribLocation(program, 'a_position'),
        color: gl.getAttribLocation(program, 'a_color'),
        radius: gl.getAttribLocation(program, 'a_radius'),
        matrix: gl.getUniformLocation(program, 'u_matrix'),
        scale: gl.getUniformLocation(program, 'u_scale'),
        shape: gl.getUniformLocation(program, 'u_shape'),
      };
      buffers = { position: gl.createBuffer(), color: gl.createBuffer(), radius: gl.createBuffer() };
      maxPointSize = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        gl = null;
        failed = true;
      });
      return true;
    } catch {
      gl = null;
      failed = true;
      return false;
    }
  }
  return {
    /** True when the context exists (or can be created) and every point fits the platform's point-size limit. */
    accepts(cloud, radius, scale) {
      if (!init()) return false;
      let largest = radius;
      if (cloud.radii) for (let i = 0; i < cloud.count; i++) if (cloud.radii[i] > largest) largest = cloud.radii[i];
      return 2 * largest * scale + 1 <= maxPointSize && !gl.isContextLost();
    },
    /** Rasterize at the context's device size and composite once with the context's current clip. */
    draw(ctx, cloud, { radius, shape, color, blend }) {
      const width = ctx.canvas.width,
        height = ctx.canvas.height,
        m = ctx.getTransform(),
        scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      if (blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      // Column-major device-pixel affine composed with pixels-to-clip-space.
      gl.uniformMatrix3fv(
        locations.matrix,
        false,
        new Float32Array([
          (2 * m.a) / width,
          (-2 * m.b) / height,
          0,
          (2 * m.c) / width,
          (-2 * m.d) / height,
          0,
          (2 * m.e) / width - 1,
          1 - (2 * m.f) / height,
          1,
        ]),
      );
      gl.uniform1f(locations.scale, scale);
      gl.uniform1i(locations.shape, SHAPES[shape]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(locations.position);
      gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
      if (cloud.colors) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, cloud.colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locations.color);
        gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(locations.color);
        gl.vertexAttrib4f(locations.color, ...color);
      }
      if (cloud.radii) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.radius);
        gl.bufferData(gl.ARRAY_BUFFER, cloud.radii, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locations.radius);
        gl.vertexAttribPointer(locations.radius, 1, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(locations.radius);
        gl.vertexAttrib1f(locations.radius, radius);
      }
      gl.drawArrays(gl.POINTS, 0, cloud.count);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (blend === 'add') ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
    },
    dispose() {
      if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvas = null;
      gl = null;
      failed = true;
    },
  };
}
