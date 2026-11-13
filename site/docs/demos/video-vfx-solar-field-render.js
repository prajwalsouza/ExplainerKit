import { hsla, toRGBA } from '../../runtime/src/color/index.js';
import { projectPoints } from '../../runtime/src/spatial/index.js';

const light = [0.57, 0.7, 0.43];
const shadowInk = toRGBA(hsla(125, 23, 6)).slice(0, 3);
const sunlight = toRGBA(hsla(44, 100, 84)).slice(0, 3);
const { hypot, min, max } = Math;
const vertex = `#version 300 es
uniform vec4 bounds;
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  gl_Position = vec4(mix(bounds.xy, bounds.zw, corner), 0., 1.);
}`;
const fragment = `#version 300 es
precision highp float;
out vec4 color;
uniform vec2 viewport;
uniform float focal;
uniform vec2 projectedCenter;
uniform float projectedDiameter;
uniform vec3 eyeToCenter;
uniform float receiverBelow;
uniform bool groundPass;
uniform float groundOpacity;
uniform float groundUnit;
uniform bool solarPass;
uniform vec3 eyeToSun;
uniform vec3 sunlight;
uniform mat3 cameraBasis;
uniform mat3 planetBasis;
uniform float radius;
uniform float polar;
uniform float fade;
uniform int planet;
uniform bool shadow;
uniform vec3 light;
uniform vec3 shadowInk;
uniform sampler2D maps;
const float PI = 3.141592653589793;
const vec3 ringRadii = vec3(74658., 91975., 117507.) / 60268.;
const vec2 ringA = vec2(122340., 136780.) / 60268.;

float ringBand(float r) {
  if (planet == 5) {
    float km = r * 71492.;
    if (km >= 123000. && km <= 128940.) return 0.000005;
    if (km >= 128940. && km <= 280000.) return 0.0000001;
    return 0.;
  }
  if (planet == 7) {
    float km = r * 25559.;
    if (abs(km - 51149.) < 25.) return .36;
    return 0.;
  }
  if (planet == 8) {
    float km = r * 24764.;
    if (abs(km - 41900.) < 1000.) return .0001;
    if (abs(km - 53200.) < 50.) return .01;
    if (abs(km - 62933.) < 7.5) return .018;
    return 0.;
  }
  if (planet != 6) return 0.;
  if (r >= ringRadii.x && r < ringRadii.y) return .31;
  if (r >= ringRadii.y && r < ringRadii.z) return .93;
  if (r >= ringA.x && r <= ringA.y) return .77;
  return 0.;
}
float ringOpacity(float r) {
  return ringBand(r) * (.93 + .04 * sin(r * 386.) + .03 * sin(r * 829.));
}
float bodyHit(vec3 p, vec3 ray) {
  // The sphere equation is evaluated after undoing the polar flattening.
  p.y /= polar;
  ray.y /= polar;
  float aa = dot(ray, ray);
  float k = -dot(p, ray) / aa;
  vec3 close = p + ray * k;
  float offset = 1. - dot(close, close);
  return offset < 0. ? -1. : k - sqrt(offset / aa);
}
vec3 planetColor(vec3 unit) {
  float u = fract(.5 - atan(unit.z, unit.x) / (2. * PI));
  float v = .5 - asin(clamp(unit.y, -1., 1.)) / PI;
  vec2 tile = vec2(float(planet % 3), float(planet / 3));
  vec2 uv = (tile + mix(vec2(.5 / 512., .5 / 256.), vec2(1. - .5 / 512., 1. - .5 / 256.), vec2(u,v))) / 3.;
  return texture(maps, uv).rgb;
}
vec4 solarLight(vec3 ray) {
  float groundGlow = 0.;
  if (ray.y < -.0001 && receiverBelow > 0.) {
    vec3 groundToSun = eyeToSun + ray * (receiverBelow / ray.y);
    float distanceSquared = max(.04, dot(groundToSun, groundToSun));
    // Cosine incidence and inverse-square falloff, with authored exposure for the footage.
    float exposure = 5000. * max(groundToSun.y, 0.) / (distanceSquared * sqrt(distanceSquared));
    groundGlow = .62 * exposure / (1. + exposure);
  }
  float halo = 0.;
  if (projectedDiameter > 0.) {
    float haloRadius = clamp(projectedDiameter * 2.8, 2., viewport.y * .14);
    float r = length(gl_FragCoord.xy - projectedCenter) / haloRadius;
    halo = .56 * smoothstep(.05, 3., projectedDiameter) * exp(-2.8 * r * r) * (1. - smoothstep(.8, 1.6, r));
  }
  return vec4(sunlight, 1. - (1. - groundGlow) * (1. - halo));
}
void main() {
  vec2 xy = (gl_FragCoord.xy - viewport * .5) / focal;
  vec3 ray = normalize(cameraBasis * vec3(xy, -1.));
  if (solarPass) {
    color = solarLight(ray);
    return;
  }
  if (groundPass) {
    vec3 ground = ray * (-receiverBelow / min(-.035, ray.y));
    vec2 p = ground.xz / groundUnit;
    float fine = sin(p.x * 73. + sin(p.y * 33.)) * sin(p.y * 89.);
    float broad = sin(p.x * 8. + sin(p.y * 11.)) * sin(p.y * 14.);
    vec3 field = mix(vec3(.141,.180,.110), vec3(.30,.36,.22), .47 + broad*.20 + fine*.03);
    field = mix(field, vec3(.20,.25,.16), smoothstep(-.21,-.04,ray.y));
    float vignette = 1. - smoothstep(0., 1.1, length(xy) * .85);
    color = vec4(field * (.83 + .17 * vignette), groundOpacity);
    return;
  }
  vec3 toLight = transpose(planetBasis) * light;
  if (shadow) {
    if (ray.y >= -.0001) discard;
    vec3 ground = ray * (-receiverBelow / ray.y);
    vec3 p = transpose(planetBasis) * ((eyeToCenter + ground) / radius);
    vec3 q = vec3(p.x, p.y / polar, p.z);
    vec3 l = normalize(vec3(toLight.x, toLight.y / polar, toLight.z));
    float t = -dot(q,l);
    float a = t > 0. ? 1. - smoothstep(.85, 1.17, length(q + t*l)) : 0.;
    if (planet >= 5 && abs(toLight.y) > .0001) {
      float d = -p.y / toLight.y;
      if (d > 0.) a = max(a, .50 * ringOpacity(length((p + d * toLight).xz)));
    }
    if (a <= .001) discard;
    color = vec4(shadowInk, a * fade * .53);
    return;
  }
  float sprite = 1. - smoothstep(1.1, 2.5, projectedDiameter);
  if (sprite > 0.) {
    // Spread subpixel energy across adjacent samples while preserving the disk area.
    // This avoids a full-opacity pixel blinking on and off as its center crosses the grid.
    vec2 offset = gl_FragCoord.xy - projectedCenter;
    float variance = .18 + projectedDiameter * projectedDiameter / 16.;
    float area = PI * projectedDiameter * projectedDiameter / 4.;
    float coverage = area / (2. * PI * variance) * exp(-dot(offset, offset) / (2. * variance));
    vec3 meanColor = planetColor(vec3(1.,0.,0.)) * .84;
    if (planet == 0) meanColor = min(vec3(1.), meanColor * 1.17 + vec3(.13,.05,.012));
    color = vec4(meanColor, min(1., coverage) * fade);
    if (sprite >= .999) return;
  }
  vec4 smallDisk = sprite > 0. ? color : vec4(0.);
  color = vec4(0.);
  vec3 p = transpose(planetBasis) * (eyeToCenter / radius);
  vec3 d = transpose(planetBasis) * ray;
  float ball = bodyHit(p, d);
  float ring = planet >= 5 && abs(d.y) > .0001 ? -p.y / d.y : -1.;
  float ringR = ring > 0. ? length((p + ring*d).xz) : 0.;
  float a = ring > 0. ? ringOpacity(ringR) : 0.;
  if (ball > 0. && (a <= 0. || ball < ring)) {
    vec3 q = p + ball*d;
    vec3 unit = normalize(vec3(q.x, q.y / polar, q.z));
    vec3 normal = normalize(vec3(unit.x, unit.y / polar, unit.z));
    float diffuse = max(0., dot(normal,toLight));
    if (planet >= 5 && abs(toLight.y) > .0001) {
      float path = -q.y / toLight.y;
      if (path > .001) diffuse *= 1. - .67 * ringOpacity(length((q + path*toLight).xz));
    }
    vec3 tex = planetColor(unit);
    vec3 lit = tex * (.43 + .63 * diffuse) + vec3(.022, .035, .042) * (1. - diffuse);
    if (planet == 0) lit = min(vec3(1.), tex * 1.17 + vec3(.13, .05, .012)) * (.83 + .19 * diffuse);
    color = vec4(lit, fade);
  } else if (a > 0.) {
    vec3 q = p + ring*d;
    float inShade = bodyHit(q, toLight);
    vec3 tint = mix(vec3(.51, .44, .35), vec3(.88, .81, .65), a);
    vec3 lit = tint * (inShade > 0. ? .41 : .88);
    if (ball > 0.) {
      vec3 behind = p + ball*d;
      vec3 unit = normalize(vec3(behind.x, behind.y / polar, behind.z));
      color = vec4(mix(planetColor(unit) * (.43 + .63 * max(0., dot(unit,toLight))), lit, a), fade);
    } else color = vec4(lit, a * fade);
  }
  if (sprite > 0.) {
    vec4 blended = mix(vec4(color.rgb * color.a, color.a), vec4(smallDisk.rgb * smallDisk.a, smallDisk.a), sprite);
    color = vec4(blended.rgb / max(1e-6, blended.a), blended.a);
  }
  if (color.a <= 0.) discard;
}`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  return program;
}

export function pointsOnField(camera, coordinates) {
  const { positions, cameraDepths } = projectPoints(camera, new Float64Array(coordinates.flat()));
  return coordinates.map((_, i) => ({ x: positions[i * 2], y: positions[i * 2 + 1], depth: cameraDepths[i] }));
}

function cube([x, y, z], r) {
  return [-r, r].flatMap((dx) => [-r, r].flatMap((dy) => [-r, r].map((dz) => [x + dx, y + dy, z + dz])));
}

function receiver([x, y, z], radius, groundY) {
  return cube([x, y, z], radius).map(([a, b, c]) => [
    a - ((b - groundY) * light[0]) / light[1],
    groundY,
    c - ((b - groundY) * light[2]) / light[1],
  ]);
}

export function makePlanetLayer(canvas, atlas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!gl) return null;
  const program = programFor(gl);
  gl.useProgram(program);
  const uniform = Object.fromEntries(
    'bounds viewport focal projectedCenter projectedDiameter eyeToCenter receiverBelow groundPass groundOpacity groundUnit solarPass eyeToSun sunlight cameraBasis planetBasis radius polar fade planet shadow light shadowInk maps'
      .split(' ')
      .map((key) => [key, gl.getUniformLocation(program, key)]),
  );
  const image = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.uniform1i(uniform.maps, 0);
  gl.enable(gl.BLEND);
  // The canvas stores premultiplied RGB; alpha needs its own source factor.
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform3fv(uniform.shadowInk, shadowInk);
  gl.uniform3fv(uniform.sunlight, sunlight);
  const n = hypot(...light);
  gl.uniform3fv(
    uniform.light,
    light.map((v) => v / n),
  );

  function draw(
    camera,
    objects,
    shadows,
    { groundY = 0, groundOpacity = 0, groundUnit = 1, sunLighting = false } = {},
  ) {
    const { width, height } = camera.viewport;
    const pixelRatio = canvas.height / height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniform.viewport, canvas.width, canvas.height);
    gl.uniform1f(uniform.focal, (canvas.height / 2) * camera.projectionMatrix[5]);
    const m = camera.matrixWorld;
    gl.uniform1f(uniform.receiverBelow, m[13] - groundY);
    gl.uniformMatrix3fv(uniform.cameraBasis, false, [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
    if (groundOpacity > 0.001) {
      gl.uniform1i(uniform.groundPass, 1);
      gl.uniform1f(uniform.groundOpacity, groundOpacity);
      gl.uniform1f(uniform.groundUnit, groundUnit);
      gl.uniform4f(uniform.bounds, -1, -1, 1, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.uniform1i(uniform.groundPass, 0);
    const centers = pointsOnField(
      camera,
      objects.map(({ center }) => center),
    );
    if (sunLighting) {
      const sun = objects[0];
      const { x, y, depth } = centers[0];
      gl.uniform1i(uniform.solarPass, 1);
      gl.uniform3f(uniform.eyeToSun, sun.center[0] - m[12], sun.center[1] - m[13], sun.center[2] - m[14]);
      gl.uniform2f(uniform.projectedCenter, (x * canvas.width) / width, (1 - y / height) * canvas.height);
      gl.uniform1f(
        uniform.projectedDiameter,
        depth > camera.near ? (sun.radius * camera.projectionMatrix[5] * canvas.height) / depth : 0,
      );
      gl.uniform4f(uniform.bounds, -1, -1, 1, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.uniform1i(uniform.solarPass, 0);
    }
    const active = objects
      .map((object, i) => {
        const point = centers[i];
        return { ...object, point, diameter: (object.radius * camera.projectionMatrix[5] * height) / point.depth };
      })
      .filter(
        ({ point, radius, alpha, diameter }) =>
          alpha > 0.001 && point.depth > Math.max(camera.near, radius * 1.15) && diameter > 0.035,
      )
      .sort((a, b) => b.point.depth - a.point.depth);
    for (const cast of shadows ? [true, false] : [false]) {
      gl.uniform1i(uniform.shadow, Number(cast));
      for (const { center, radius, alpha, index, flattening, orientation, point, diameter } of active) {
        if (cast && center[1] <= groundY) continue;
        gl.uniform2f(uniform.projectedCenter, (point.x * canvas.width) / width, (1 - point.y / height) * canvas.height);
        gl.uniform1f(uniform.projectedDiameter, diameter * pixelRatio);
        const bound = radius * [1.15, 1.15, 1.15, 1.15, 1.15, 3.95, 2.4, 2.03, 2.56][index];
        const corners = pointsOnField(camera, cast ? receiver(center, bound, groundY) : cube(center, bound));
        const x0 = corners.some((p) => p.depth < camera.near) ? 0 : max(0, min(...corners.map((p) => p.x)) - 2);
        const x1 = corners.some((p) => p.depth < camera.near) ? width : min(width, max(...corners.map((p) => p.x)) + 2);
        const y0 = corners.some((p) => p.depth < camera.near) ? 0 : max(0, min(...corners.map((p) => p.y)) - 2);
        const y1 = corners.some((p) => p.depth < camera.near)
          ? height
          : min(height, max(...corners.map((p) => p.y)) + 2);
        if (x0 >= x1 || y0 >= y1) continue;
        gl.uniform4f(
          uniform.bounds,
          (2 * x0) / width - 1,
          1 - (2 * y1) / height,
          (2 * x1) / width - 1,
          1 - (2 * y0) / height,
        );
        gl.uniform3f(uniform.eyeToCenter, m[12] - center[0], m[13] - center[1], m[14] - center[2]);
        gl.uniformMatrix3fv(uniform.planetBasis, false, orientation);
        gl.uniform1f(uniform.radius, radius);
        gl.uniform1f(uniform.fade, cast ? alpha * Math.min(1, diameter * diameter) : alpha);
        gl.uniform1f(uniform.polar, 1 - flattening);
        gl.uniform1i(uniform.planet, index);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
  }

  return {
    draw,
    dispose() {
      gl.deleteTexture(image);
      gl.deleteProgram(program);
    },
  };
}
