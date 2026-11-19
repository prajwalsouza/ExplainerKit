// GLSL for the city renderer. Each block is spliced into Three's standard material, so the
// surfaces keep its lights, shadows and fog. Nothing here imports Three.

/** Declarations shared by every city material's vertex shader. */
export const VERT_HEAD = /* glsl */ `
varying vec3 vCityWorld;
varying vec3 vCityN;
uniform float uTime;
uniform vec3 uWind;
#ifdef CITY_FACADE
attribute vec4 fa; attribute vec4 fb; attribute vec4 fc;
varying vec4 vFa; varying vec4 vFb; varying vec4 vFc;
#endif
#ifdef CITY_SOLID
attribute vec4 surf;
varying vec4 vSurf;
#ifdef USE_INSTANCING
attribute float aPhase;
#endif
#endif
#ifdef CITY_ROOF
attribute vec4 roof;
varying vec4 vRoof;
#endif
`;

/** Runs after Three's color_vertex for objects: the per-object colour applies only where tint is 1. */
export const VERT_COLOR = /* glsl */ `
vColor.xyz = color.xyz;
#ifdef CITY_PEOPLE
// A walker has five colours of its own. Each vertex says which one tints it.
if (bind.z > 4.5) vColor.xyz *= cityTone(aTones.w);
else if (bind.z > 3.5) vColor.xyz *= cityTone(aTones.z);
else if (bind.z > 2.5) vColor.xyz *= cityTone(aTones.y);
else if (bind.z > 1.5) vColor.xyz *= cityTone(aTones.x);
#ifdef USE_INSTANCING_COLOR
else if (bind.z > 0.5) vColor.xyz *= instanceColor.xyz;
#endif
#else
#ifdef USE_INSTANCING_COLOR
vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, surf.w);
#endif
#endif
`;

/**
 * Declarations for walking figures, added after VERT_HEAD in the materials that draw people.
 * Each vertex names one joint and a weight. It turns about that joint by the weight times the
 * joint's angle, on top of the pose of the part above, so limbs bend as smooth tubes. The
 * same sums are written in JavaScript as personPose and posePerson in the city kit.
 */
export const VERT_PEOPLE = /* glsl */ `
#ifdef CITY_PEOPLE
attribute vec4 bind;   // joint, weight, colour slot, parameter
attribute vec4 aLook;  // point in the stride, step length, arm swing, lean
attribute vec4 aRig;   // heights of the hip, knee, shoulder and elbow
attribute vec4 aTones; // bottom, skin, hair and accent colours, each packed into one number
attribute vec4 aAct;  // packed pairs: arm weights, head angles, left arm angles, right arm angles
const float W_ANKLE = 0.085, W_STANCE = 0.56, W_REACH = 0.38, W_HEEL = 0.05, W_BALL = 0.14;
const float W_TOE_UP = 0.3, W_HEEL_UP = 1.3, W_LIFT = 0.05, W_PI = 3.14159265, W_TAU = 6.2831853;
vec3 cityTone(float v) {
  float b = floor(v / 65536.0), g = floor((v - b * 65536.0) / 256.0), r = v - b * 65536.0 - g * 256.0;
  return pow(vec3(r, g, b) / 255.0, vec3(2.2));
}
vec2 cityGesture(float packedValue) {
  float high = floor(packedValue / 4096.0);
  return (vec2(packedValue - high * 4096.0, high) - 2048.0) / 512.0;
}
void wTurn(inout vec2 p, vec2 j, float a) {
  float c = cos(a), s = sin(a);
  vec2 d = p - j;
  p = j + vec2(d.x * c - d.y * s, d.x * s + d.y * c);
}
// A planted foot: where its ankle is and how the foot pitches, as it rolls from heel to ball.
vec3 wPlanted(float s, float stp) {
  float full = min(1.0, stp / 0.25);
  float r = W_REACH * stp - 2.0 * stp * W_STANCE * s;
  if (s < 0.14) {
    float a = W_TOE_UP * full * (1.0 - s / 0.14);
    return vec3(r - W_HEEL + W_HEEL * cos(a) - W_ANKLE * sin(a), W_HEEL * sin(a) + W_ANKLE * cos(a), a);
  }
  if (s < 0.5) return vec3(r, W_ANKLE, 0.0);
  float a = -W_HEEL_UP * full * smoothstep(0.5, 1.0, s);
  return vec3(r + W_BALL - W_BALL * cos(a) - W_ANKLE * sin(a), -W_BALL * sin(a) + W_ANKLE * cos(a), a);
}
vec3 wFoot(float u, float stp) {
  u = fract(u);
  if (u < W_STANCE) return wPlanted(u / W_STANCE, stp);
  float v = (u - W_STANCE) / (1.0 - W_STANCE);
  vec3 a = wPlanted(1.0, stp), b = wPlanted(0.0, stp);
  return vec3(mix(a.x, b.x, smoothstep(0.0, 1.0, v)), mix(a.y, b.y, v) + W_LIFT * min(1.0, stp / 0.25) * sin(W_PI * v), mix(a.z, b.z, smoothstep(0.0, 0.85, v)));
}
// A leg bent to put its ankle where the foot needs it: thigh angle, knee bend, foot pitch,
// and the cosine of the leg's cycle, which the arm on that side swings against.
vec4 wLeg(float u, float stp, float hipY, float L1, float L2) {
  vec3 f = wFoot(u, stp);
  float dx = f.x, dy = hipY - f.y;
  float d = clamp(length(vec2(dx, dy)), abs(L1 - L2) + 0.01, (L1 + L2) * 0.995);
  float thigh = atan(dx, dy) + acos(clamp((L1 * L1 + d * d - L2 * L2) / (2.0 * L1 * d), -1.0, 1.0));
  float knee = W_PI - acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2.0 * L1 * L2), -1.0, 1.0));
  return vec4(thigh, knee, f.z, cos(W_TAU * u));
}
// How far forward a leg's centre line stands at a height below the hip joint.
float wLegForward(float below, vec4 leg, float L1) {
  if (below <= 0.0) return 0.0;
  float knee = L1 * cos(leg.x);
  if (below <= knee) return below * tan(leg.x);
  return L1 * sin(leg.x) + (below - knee) * tan(clamp(leg.x - leg.y, -1.2, 1.2));
}
float wSoftMax(float a, float b) {
  float h = clamp(0.5 + 0.5 * (a - b) / 0.02, 0.0, 1.0);
  return mix(b, a, h) + 0.02 * h * (1.0 - h);
}
void cityWalk(inout vec3 p, inout vec3 n) {
  float phase = aLook.x, stp = aLook.y, swing = aLook.z, lean = aLook.w;
  float hip = aRig.x, kneeY = aRig.y, shoulder = aRig.z, elbowY = aRig.w;
  float L1 = hip - kneeY, L2 = kneeY - W_ANKLE;
  float torso = (shoulder - hip) / 0.465;
  vec2 waist = vec2(0.0, hip + 0.16 * torso), neck = vec2(-0.005, hip + 0.565 * torso);
  float drop = 0.07 * stp * stp * (0.835 / (L1 + L2)) + 0.008;
  float hipY = hip - drop + min(0.032, drop - 0.008) * 0.5 * (1.0 - cos(2.0 * (phase - 0.25)));
  float joint = floor(bind.x + 0.5), w = bind.y, param = bind.w;
  float restY = p.y, chest = -lean, turned = 0.0, twist = 0.0;
  vec2 q = p.xy;
  float z = p.z;
  if (joint > 12.5) {
    // A hem hangs from the hips. Each leg pushes it out where the leg swings past it.
    float rho = max(length(vec2(q.x, z)), 1e-6);
    vec2 u = vec2(q.x, z) / rho;
    float below = hip - q.y;
    vec4 a = wLeg(phase / W_TAU, stp, hipY, L1, L2), b = wLeg(phase / W_TAU + 0.5, stp, hipY, L1, L2);
    float push = wSoftMax(0.0, wLegForward(below, a, L1) * u.x - 0.16 * max(0.0, -u.y));
    push = wSoftMax(push, wLegForward(below, b, L1) * u.x - 0.16 * max(0.0, u.y));
    push = max(0.0, push - 0.004);
    q.x += u.x * push - param * param * 0.035 * sin(2.0 * phase + 0.9);
    z += u.y * push;
    q.y += push * 0.25 * param;
  } else if (joint > 2.5) {
    bool left = mod(joint - 3.0, 2.0) < 0.5;
    vec4 leg = wLeg(phase / W_TAU + (left ? 0.0 : 0.5), stp, hipY, L1, L2);
    if (joint < 4.5) {
      turned = w * leg.x;
      wTurn(q, vec2(0.0, hip), turned);
    } else if (joint < 6.5) {
      wTurn(q, vec2(0.0, kneeY), -w * leg.y);
      wTurn(q, vec2(0.0, hip), leg.x);
      turned = leg.x - w * leg.y;
    } else if (joint < 8.5) {
      float a = w * (leg.z - leg.x + leg.y);
      wTurn(q, vec2(0.0, W_ANKLE), a);
      wTurn(q, vec2(0.0, kneeY), -leg.y);
      wTurn(q, vec2(0.0, hip), leg.x);
      turned = a + leg.x - leg.y;
    } else {
      // An arm swings against the leg on its side, or holds something up when the parameter is negative.
      // A gesture moves the arm away from its swing by the arm's weight (see personPose).
      bool hold = param < 0.0;
      vec2 weights = cityGesture(aAct.x);
      float gw = clamp(left ? weights.x : weights.y, 0.0, 1.0);
      vec2 g = cityGesture(left ? aAct.z : aAct.w);
      float swingArm = mix((-0.33 * leg.w * (stp / 0.72) + 0.05) * swing, g.x, gw);
      float swingElbow = mix(0.16 + 0.3 * (0.5 - 0.5 * leg.w) * min(1.0, swing), g.y, gw);
      float arm = hold ? 0.35 : swingArm * param;
      float elbow = hold ? 2.1 : mix(0.16, swingElbow, min(1.0, param));
      if (joint > 10.5) {
        wTurn(q, vec2(0.0, elbowY), w * elbow);
        wTurn(q, vec2(0.0, shoulder), arm);
        turned = w * elbow + arm;
      } else {
        turned = w * arm;
        wTurn(q, vec2(0.0, shoulder), turned);
      }
      wTurn(q, waist, chest);
      turned += chest;
      twist = 1.0;
    }
  } else if (joint > 1.5) {
    vec2 head = cityGesture(aAct.y);
    float nod = lean * 0.7 + head.y;
    wTurn(q, neck, w * nod);
    // The head turns about the neck's upright axis.
    float yaw = w * head.x, cy = cos(yaw), sy = sin(yaw), hx = q.x + 0.005;
    q.x = hx * cy + z * sy - 0.005;
    z = -hx * sy + z * cy;
    n.xz = vec2(n.x * cy + n.z * sy, -n.x * sy + n.z * cy);
    wTurn(q, waist, chest);
    turned = w * nod + chest;
    twist = 1.0 - 0.7 * w;
  } else if (joint > 0.5) {
    turned = w * chest;
    wTurn(q, waist, turned);
    twist = w;
  }
  q.y += hipY - hip;
  vec2 m = n.xy;
  wTurn(m, vec2(0.0), turned);
  n.xy = m;
  float lively = min(1.0, stp / 0.4);
  if (twist > 0.0) {
    // The shoulders turn against the hips as the arms swing.
    float a = -0.085 * cos(phase) * min(1.0, swing) * lively * twist, c = cos(a), s = sin(a);
    float x = q.x;
    q.x = x * c + z * s;
    z = -x * s + z * c;
    n.xz = vec2(n.x * c + n.z * s, -n.x * s + n.z * c);
  }
  z += 0.016 * sin(phase - 0.25) * lively * smoothstep(0.05, hip, restY);
  p = vec3(q, z);
}
#endif
`;

/** Runs after Three's beginnormal_vertex in the material that draws people, so lighting follows the pose. */
export const VERT_PEOPLE_NORMAL = /* glsl */ `
#ifdef CITY_PEOPLE
vec3 cityPeoplePos = position;
cityWalk(cityPeoplePos, objectNormal);
#endif
`;

/** Runs after Three's begin_vertex, where "transformed" holds the local position. */
export const VERT_BODY = /* glsl */ `
#ifdef CITY_SOLID
vSurf = surf;
#ifdef USE_INSTANCING
// Wheels turn about their axle by the angle the vehicle has rolled.
if (surf.z > 0.3 && surf.z < 0.5) {
  vec2 q = transformed.xy - surf.xy;
  float cw = cos(aPhase), sw = sin(aPhase);
  transformed.xy = surf.xy + vec2(q.x * cw + q.y * sw, -q.x * sw + q.y * cw);
}
// Leaves and thin branches sway: more with height, each tree out of step with its neighbours.
if (surf.z > 4.5 && surf.z < 5.5) {
  vec3 root = instanceMatrix[3].xyz;
  float phase = root.x * 0.37 + root.z * 0.23;
  // Tall plants sway from above head height; small ones from the ground up.
  float lift = transformed.y > 1.6 ? transformed.y - 1.5 : transformed.y * 0.35 * step(transformed.y, 1.0);
  float gust = sin(uTime * 1.3 + phase) * 0.6 + sin(uTime * 2.9 + phase * 1.7 + transformed.x * 0.8) * 0.4;
  float flutter = sin(uTime * 7.0 + transformed.x * 3.1 + transformed.z * 2.7 + phase) * 0.012;
  transformed.xz += (uWind.xz * 0.012 * gust + flutter * uWind.y) * lift;
}
#endif
#endif
#ifdef CITY_PEOPLE
// People walk: see VERT_PEOPLE. The shadow pass poses the figure here; the lit pass has
// already posed it where normals are set up.
#ifdef CITY_PEOPLE_DEPTH
vec3 cityPeopleN = normal;
cityWalk(transformed, cityPeopleN);
#else
transformed = cityPeoplePos;
vec3 cityPeopleN = objectNormal;
#endif
#endif
#ifdef CITY_FACADE
vFa = fa; vFb = fb; vFc = fc;
#endif
#ifdef CITY_ROOF
vRoof = roof;
#endif
vec4 cityWorld = vec4(transformed, 1.0);
#ifdef CITY_PEOPLE
vec3 cityN = cityPeopleN;
#else
vec3 cityN = normal;
#endif
#ifdef USE_INSTANCING
cityWorld = instanceMatrix * cityWorld;
cityN = mat3(instanceMatrix) * cityN;
#endif
cityWorld = modelMatrix * cityWorld;
vCityWorld = cityWorld.xyz;
// A zero normal would become an invalid number, which the finishing blur spreads into dark boxes.
vCityN = dot(cityN, cityN) > 1e-10 ? normalize(cityN) : vec3(0.0, 1.0, 0.0);
`;

/** Declarations and helpers shared by every city material's fragment shader. */
export const FRAG_HEAD = /* glsl */ `
varying vec3 vCityWorld;
varying vec3 vCityN;
uniform float uTime, uWet, uPuddles, uSnow, uRain, uLamps, uWindows, uSigns, uHeadlights, uCloudShadow, uPaving, uReflectOn, uWaterOn;
uniform vec3 uSunDir, uSunColor, uSkyZenith, uSkyHorizon, uFogTint, uLampColor, uWind, uMarkColor;
#ifdef CITY_AUTUMN
uniform vec3 uAutumnGrass, uLeafOchre, uLeafCopper, uLeafBrown;
#endif
uniform vec4 uFieldRect, uCloud;
uniform sampler2D uFieldA, uFieldB, uFieldC, uFieldD, uReflect, uReflectWater, uHeightMap, uLampData, uLampGrid;
uniform sampler2D uPassage;
uniform vec4 uPassageRect;
uniform float uPassageEnabled;
uniform vec4 uLampGridInfo;
uniform float uTraceSteps, uSkyRays, uSample, uFieldCell, uBeamCount;
uniform vec4 uBeamPos[16];
uniform vec4 uBeamDir[16];
uniform mat4 uReflectMatrix, uReflectWaterMatrix;
#ifdef CITY_FACADE
varying vec4 vFa; varying vec4 vFb; varying vec4 vFc;
#endif
#ifdef CITY_SOLID
varying vec4 vSurf;
#endif
#ifdef CITY_ROOF
varying vec4 vRoof;
#endif
float cHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float cFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * cNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
vec2 cityFieldUV(vec3 w) { return vec2((w.x - uFieldRect.x) / uFieldRect.z, (-w.z - uFieldRect.y) / uFieldRect.w); }
// The colour of the sky in a direction, for reflections in glass and water.
vec3 citySky(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uSkyHorizon, uSkyZenith, pow(h, 0.5));
  c += uSunColor * 0.05 * pow(max(dot(d, uSunDir), 0.0), 12.0);
  return mix(uFogTint * 0.6, c, smoothstep(-0.25, 0.05, d.y));
}
// What a street-level mirror sees: sky when it looks up, the dim far side of the street otherwise.
vec3 cityStreetSky(vec3 d, float open) {
  vec3 across = mix(uSkyHorizon, uFogTint, 0.5) * 0.16 + uSunColor * 0.012;
  return mix(across, citySky(d), smoothstep(0.12 - open * 0.3, 0.62 - open * 0.3, d.y));
}
// ---- traced light. Rays are marched through a map of roof heights: a ray is blocked where
// it passes below a roof. That one test gives lamps real shadows and tells every surface how
// much of the sky it can see.
float cityRoofAt(vec2 xz) {
  vec2 uv = vec2((xz.x - uFieldRect.x) / uFieldRect.z, (-xz.y - uFieldRect.y) / uFieldRect.w);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uHeightMap, uv).r;
}
// A different value per pixel and per sample, evenly spread (interleaved gradient noise).
float cityDither(float salt) {
  return fract(52.9829189 * fract(dot(gl_FragCoord.xy + salt * 17.13 + uSample * 5.588, vec2(0.06711056, 0.00583715))));
}
// How much of the straight path from a to b is clear of buildings: 0 blocked, 1 clear.
float cityClear(vec3 a, vec3 b, float steps, float jitter) {
  vec3 d = b - a;
  float clear = 1.0;
  for (int i = 0; i < 32; i++) {
    if (float(i) >= steps) break;
    vec3 p = a + d * ((float(i) + jitter) / steps);
    clear = min(clear, smoothstep(-0.5, 0.4, p.y - cityRoofAt(p.xz)));
    if (clear < 0.02) break;
  }
  return clear;
}
// Light arriving from the street lamps near a point, on a surface facing N. Each lamp is a real
// light: it falls off with the square of distance, lights faces turned toward it, shines mostly
// downward, and is hidden by any building between it and the point.
// Headlights of the nearest moving vehicles. Each is a spot light: a cone thrown forward and
// down from the front of the vehicle, falling off with the square of distance, so it lights the
// road in front, the back of the car ahead and any wall or person it points at.
vec3 cityBeams(vec3 w, vec3 N) {
  vec3 sum = vec3(0.0);
  if (uHeadlights < 0.01) return sum;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uBeamCount) break;
    vec3 L = uBeamPos[i].xyz - w;
    float d2 = dot(L, L);
    if (d2 > 2500.0) continue;
    float d = sqrt(d2);
    vec3 l = L / max(d, 0.001);
    float along = dot(-l, uBeamDir[i].xyz);
    if (along < 0.72) continue;
    // A dipped beam: a wide flat cone with a soft edge and a cut-off a little above the lamp.
    float cone = smoothstep(0.72, 0.96, along);
    float cut = 1.0 - smoothstep(0.25, 1.3, w.y - uBeamPos[i].y);
    // The road is lit at a grazing angle, so it needs a floor to be lit at all.
    float facing = max(dot(N, l), 0.0) * 0.85 + 0.15 * step(0.0, dot(N, l) + 0.3);
    sum += vec3(1.0, 0.95, 0.86) * uBeamPos[i].w * cone * cut * facing / (d2 * 0.045 + 1.0);
  }
  return sum * uHeadlights;
}
vec3 cityStreetLamps(vec3 w, vec3 N);
vec3 cityLampLight(vec3 w, vec3 N) { return cityStreetLamps(w, N) + cityBeams(w, N); }
vec3 cityStreetLamps(vec3 w, vec3 N) {
  if ((uLamps < 0.01 && uPassageEnabled < 0.5) || uLampGridInfo.w < 0.5) return vec3(0.0);
  vec2 g = (vec2(w.x, -w.z) - uFieldRect.xy) / uLampGridInfo.z;
  if (g.x < 0.0 || g.y < 0.0 || g.x >= uLampGridInfo.x || g.y >= uLampGridInfo.y) return vec3(0.0);
  ivec2 cell = ivec2(g);
  vec3 from = w + N * uFieldCell * 1.6 + vec3(0.0, 0.15, 0.0);
  float jitter = cityDither(3.0);
  #ifdef CITY_PASSAGE
  bool inPassage = true;
  #else
  bool inPassage = false;
  if (uPassageEnabled > 0.5) {
    vec2 uv = (w.xz - uPassageRect.xy) / uPassageRect.zw;
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      vec3 passage = texture2D(uPassage, uv).rgb;
      inPassage = passage.b > 0.5 && w.y >= passage.r - 0.18 && w.y <= passage.g + 0.1;
    }
  }
  #endif
  float sum = 0.0;
  float passageLight = 0.0;
  for (int k = 0; k < 2; k++) {
    vec4 ids = texelFetch(uLampGrid, ivec2(cell.x * 2 + k, cell.y), 0);
    for (int j = 0; j < 4; j++) {
      float id = ids[j];
      if (id < 0.0) continue;
      vec4 lamp = texelFetch(uLampData, ivec2(int(mod(id, 1024.0)), int(id / 1024.0)), 0);
      vec3 L = lamp.xyz - w;
      float d2 = dot(L, L), d = sqrt(d2);
      bool enclosed = lamp.w < 0.0;
      if (enclosed && !inPassage) continue;
      float strength = enclosed ? -lamp.w : lamp.w * uLamps;
      float reach = enclosed ? 10.0 : 24.0;
      if (d > reach) continue;
      vec3 l = L / max(d, 0.001);
      // Soft wrap so faces just past the terminator are not cut off hard.
      float facing = clamp((dot(N, l) + 0.18) / 1.18, 0.0, 1.0);
      if (facing <= 0.0) continue;
      float window = 1.0 - smoothstep(reach * 0.55, reach, d);
      // A lantern throws most of its light below its own height.
      float down = mix(0.22, 1.0, smoothstep(-0.25, 0.45, l.y));
      float light = strength * 62.0 / (d2 + 1.5) * window * facing * down;
      if (!enclosed && light > 0.004 && uTraceSteps > 0.5) light *= cityClear(from, lamp.xyz, uTraceSteps, jitter);
      if (enclosed) passageLight += light;
      else sum += light;
    }
  }
  return uLampColor * sum + vec3(1.0, 0.92, 0.80) * passageLight;
}
// The share of the sky a surface can see. Open ground sees all of it; the foot of a wall in a
// narrow street sees a strip. Sky light is scaled by this, which is what makes streets look
// enclosed and squares look open.
float citySkyShare(vec3 w, vec3 N) {
  if (uSkyRays < 0.5) return 1.0;
  vec3 from = w + N * uFieldCell * 1.6 + vec3(0.0, 0.2, 0.0);
  // Two directions across N to build rays in the half-space the surface faces.
  vec3 t = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
  vec3 bt = cross(N, t);
  float seen = 0.0, total = 0.0;
  float n1 = cityDither(1.0), n2 = cityDither(2.0);
  for (int k = 0; k < 6; k++) {
    if (float(k) >= uSkyRays) break;
    float az = (float(k) + n1) / uSkyRays * 6.2831853;
    float u = fract(n2 + float(k) * 0.618034);
    // Cosine-weighted: most rays leave near the normal, where light counts most.
    float r = sqrt(u), up = sqrt(1.0 - u);
    vec3 dir = normalize(t * cos(az) * r + bt * sin(az) * r + N * up);
    if (dir.y < 0.02) { total += 1.0; continue; }
    seen += cityClear(from, from + dir * 34.0, max(uTraceSteps, 6.0), cityDither(4.0 + float(k)));
    total += 1.0;
  }
  return seen / max(total, 1.0);
}
// Sunlight that survives the drifting cloud layer.
float cityCloudLight(vec3 w) {
  if (uCloudShadow < 0.01) return 1.0;
  float c = cFbm(w.xz * 0.0045 + uCloud.zw);
  float d = smoothstep(1.0 - uCloud.x * 1.1, 1.2 - uCloud.x * 0.7, c);
  return 1.0 - d * uCloudShadow;
}
// How much snow lies on a surface that faces "up" by this much.
float citySnow(float up, vec3 w) {
  if (uSnow < 0.01) return 0.0;
  float n = cFbm(w.xz * 0.55) * 0.6 + cNoise(w.xz * 4.7 + w.y) * 0.4;
  return smoothstep(0.0, 0.28, uSnow * 1.3 - n) * smoothstep(0.35, 0.72, up);
}
const vec3 SNOW = vec3(0.80, 0.84, 0.90);
`;

/** Scales sunlight by cloud shadow. Runs after Three has summed the direct lights. */
export const FRAG_LIGHTS = /* glsl */ `
{
  float cityShade = cityCloudLight(vCityWorld);
  reflectedLight.directDiffuse *= cityShade;
  reflectedLight.directSpecular *= cityShade;
  // Shade outdoors is lit by the whole sky and by light bounced off the ground, so a shadow
  // is dimmer and cooler than sunlit ground but never black.
  reflectedLight.indirectDiffuse *= mix(1.5, 0.8, uLamps);
  // Sky light reaches only the part of a surface that can see the sky. What it cannot see is
  // mostly other buildings, which return a little of the light they receive.
  vec3 citySafeN = dot(vCityN, vCityN) > 1e-8 ? normalize(vCityN) : vec3(0.0, 1.0, 0.0);
  float citySeen = citySkyShare(vCityWorld, citySafeN);
  // Guard against an invalid number from a degenerate triangle: treat it as open sky.
  if (!(citySeen >= 0.0 && citySeen <= 1.0)) citySeen = 1.0;
  reflectedLight.indirectDiffuse *= mix(0.22, 1.0, citySeen);
  if (!(reflectedLight.indirectDiffuse.r >= 0.0)) reflectedLight.indirectDiffuse = vec3(0.0);
  if (!(reflectedLight.directDiffuse.r >= 0.0)) reflectedLight.directDiffuse = vec3(0.0);
  if (!(reflectedLight.directSpecular.r >= 0.0)) reflectedLight.directSpecular = vec3(0.0);
  if (!(totalEmissiveRadiance.r >= 0.0)) totalEmissiveRadiance = vec3(0.0);
}
`;

/** Walls: material pattern, weathering and windows drawn from the wall's bay and floor layout. */
export const FRAG_FACADE = /* glsl */ `
{
  float u = vFa.x, v = vFa.y, L = vFa.z, H = vFa.w;
  float bayW = vFb.x, floorH = max(vFb.y, 1.0), groundH = vFb.z, margin = vFb.w;
  float mat = floor(vFc.x + 0.5), wstyle = floor(vFc.y + 0.5), gcode = floor(vFc.z + 0.5), seed = vFc.w;
  float gstyle = mod(gcode, 4.0), hasShutters = mod(floor(gcode / 4.0), 2.0), doorBay = floor(gcode / 8.0);
  float wallSeed = seed * 91.7 + floor(L * 7.3) * 0.37;
  vec3 base = diffuseColor.rgb;
  float px = max(max(fwidth(u), fwidth(v)), 0.0015);
  float rough = 0.86;
  vec3 col = base;
  vec3 cN = normalize(vCityN);
  vec3 V = normalize(cameraPosition - vCityWorld);
  float h1 = cHash(vec2(seed * 113.1, 7.7)), h2 = cHash(vec2(seed * 57.3, 21.9)), h3 = cHash(vec2(seed * 211.7, 3.1));

  // ---- wall material
  if (mat < 0.5) {
    // Plaster: soft blotches, a fine grain.
    col *= 0.9 + 0.2 * cFbm(vec2(u, v) * 0.33 + seed * 50.0);
    col *= 0.98 + 0.04 * cNoise(vec2(u, v) * 38.0);
  } else if (mat < 1.5) {
    // Brick in stretcher bond, fading to an even tone far away.
    float row = floor(v / 0.075);
    float bu = u / 0.215 + 0.5 * mod(row, 2.0);
    vec2 f = vec2(fract(bu), fract(v / 0.075));
    float d = min(min(f.x, 1.0 - f.x) * 0.215, min(f.y, 1.0 - f.y) * 0.075);
    float mortar = 1.0 - smoothstep(0.004, 0.011, d);
    float fade = smoothstep(0.02, 0.1, px);
    vec3 brick = base * (0.78 + 0.44 * cHash(vec2(floor(bu), row) + seed * 9.0));
    brick *= 0.94 + 0.12 * cNoise(vec2(u, v) * 0.6);
    vec3 joint = mix(base, vec3(0.42, 0.40, 0.36), 0.7) * 0.75;
    col = mix(mix(brick, joint, mortar), base * 0.96, fade);
    rough = 0.9;
  } else if (mat < 2.5) {
    // Concrete panels with dark joints and faint streaks.
    vec2 g = vec2(u / 3.0, v / floorH);
    vec2 f = fract(g);
    float d = min(min(f.x, 1.0 - f.x) * 3.0, min(f.y, 1.0 - f.y) * floorH);
    col *= 0.95 + 0.1 * cHash(floor(g) + seed * 5.0);
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.008, 0.025 + px, d));
    col *= 0.93 + 0.1 * cNoise(vec2(u * 2.5, v * 0.2));
  } else if (mat < 3.5) {
    // Dressed stone in staggered blocks.
    float row = floor(v / 0.31);
    float bu = u / 0.62 + 0.5 * mod(row, 2.0);
    vec2 f = vec2(fract(bu), fract(v / 0.31));
    float d = min(min(f.x, 1.0 - f.x) * 0.62, min(f.y, 1.0 - f.y) * 0.31);
    float fade = smoothstep(0.05, 0.25, px);
    vec3 block = base * (0.9 + 0.2 * cHash(vec2(floor(bu), row) + seed * 3.0));
    block *= 0.95 + 0.1 * cNoise(vec2(u, v) * 3.0);
    col = mix(block * (1.0 - 0.35 * (1.0 - smoothstep(0.004, 0.014, d))), base, fade);
  } else if (mat < 4.5) {
    // Ribbed metal cladding.
    float rib = sin(u * 25.13);
    col *= 0.93 + 0.09 * rib * (1.0 - smoothstep(0.03, 0.12, px));
    col *= 0.96 + 0.06 * cNoise(vec2(u * 0.4, v * 0.1));
    rough = 0.5;
  } else if (mat > 5.5) {
    // Timber boards, each a slightly different shade, with a shadow line under each.
    float board = floor(v / 0.16);
    float f = fract(v / 0.16);
    col *= 0.92 + 0.14 * cHash(vec2(board, seed * 31.0));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.1, f)) * (1.0 - smoothstep(0.02, 0.1, px));
    col *= 0.95 + 0.08 * cNoise(vec2(u * 0.7, v * 14.0));
    rough = 0.8;
  }
  // Weathering: splash-back at the foot, rain streaks, a paler top.
  float streak = cNoise(vec2(u * 2.6 + seed * 20.0, v * 0.12));
  col *= mix(0.72 + 0.12 * cNoise(vec2(u * 1.3, 4.0)), 1.0, smoothstep(0.0, 0.9 + 0.5 * streak, v));
  col *= 0.93 + 0.1 * streak;

  // ---- openings
  float win = 0.0, frame = 0.0, leaf = 0.0, shutter = 0.0, louvre = 0.0, surround = 0.0, sill = 0.0, sillShadow = 0.0, shop = 0.0, spandrel = 0.0;
  float yl = 0.0, y0 = 0.0, y1 = 1.0, wx = 0.0, hw = 0.5, wid = 0.0, fl = 0.0, sdw = 1.0;
  bool bays = bayW > 0.01 && v < H - 0.02;
  if (bays && mat > 4.5 && mat < 5.5) {
    // A curtain wall is glazed all over, in a grid of bays and floors.
    float su = u - margin, nb = floor(su / bayW), bx = su - nb * bayW;
    fl = v < groundH ? 0.0 : 1.0 + floor((v - groundH) / floorH);
    float fh = v < groundH ? groundH : floorH;
    yl = v < groundH ? v : v - groundH - (fl - 1.0) * floorH;
    float mull = min(min(bx, bayW - bx), min(yl, fh - yl));
    win = 1.0;
    frame = 1.0 - smoothstep(0.03, 0.03 + px, mull);
    spandrel = (1.0 - smoothstep(0.7, 0.75, yl)) * step(0.5, fl);
    wid = cHash(vec2(nb + fl * 37.0, wallSeed));
    y0 = 0.0; y1 = fh; wx = bx - bayW * 0.5; hw = bayW * 0.5; sdw = -mull;
    shop = step(fl, 0.5);
  } else if (bays) {
    float su = u - margin, nb = floor(su / bayW);
    float nBays = floor((L - 2.0 * margin) / bayW + 0.5);
    if (su > 0.0 && nb < nBays) {
      wx = su - (nb + 0.5) * bayW;
      fl = v < groundH ? 0.0 : 1.0 + floor((v - groundH) / floorH);
      float fh = v < groundH ? groundH : floorH;
      yl = v < groundH ? v : v - groundH - (fl - 1.0) * floorH;
      float style = wstyle, kind = 0.0, arch = 0.0;
      bool ok = wstyle < 4.5 || fl < 0.5;
      bool isDoorBay = abs(nb - doorBay) < 0.5;
      if (fl < 0.5) {
        if (gstyle < 0.5) { if (isDoorBay) kind = 1.0; }
        else if (gstyle < 1.5) kind = 2.0;
        else if (gstyle < 2.5) { if (isDoorBay || cHash(vec2(nb, wallSeed)) > 0.62) kind = 3.0; else style = 4.0; }
        else ok = false;
      }
      if (style > 4.5 && kind < 0.5) ok = false;
      if (style < 0.5) { hw = min(bayW * 0.5 - 0.42, 0.56 + 0.1 * h1); y0 = 0.9; y1 = min(fh - 0.42, 2.7); }
      else if (style < 1.5) { hw = min(bayW * 0.5 - 0.3, 1.3); y0 = 0.86; y1 = fh - 0.52; }
      else if (style < 2.5) { hw = min(bayW * 0.5 - 0.5, 0.72); y0 = 0.8; y1 = fh - 0.3; arch = 1.0; }
      else if (style < 3.5) { hw = bayW * 0.5 + 0.01; y0 = 0.95; y1 = fh - 0.62; }
      else { hw = min(bayW * 0.5 - 0.6, 1.5); y0 = fh * 0.5; y1 = fh * 0.84; }
      if (fl < 0.5 && kind < 0.5 && style < 3.5) y0 = max(y0, 1.0);
      if (kind > 0.5 && kind < 1.5) { hw = 0.54; y0 = 0.16; y1 = min(2.78, fh - 0.25); arch = 0.0; }
      else if (kind > 1.5 && kind < 2.5) { hw = bayW * 0.5 - 0.15; y0 = isDoorBay ? 0.05 : 0.48; y1 = fh * 0.77; arch = 0.0; }
      else if (kind > 2.5) { hw = bayW * 0.4; y0 = 0.03; y1 = min(fh * 0.84, 4.2); arch = 0.0; }
      if (hw < 0.24 || y1 - y0 < 0.4) ok = false;
      if (ok) {
        float sd;
        if (arch > 0.5) {
          float top = y1 - hw;
          sd = yl > top ? length(vec2(wx, yl - top)) - hw : max(abs(wx) - hw, y0 - yl);
        } else sd = max(abs(wx) - hw, abs(yl - (y0 + y1) * 0.5) - (y1 - y0) * 0.5);
        sdw = sd;
        win = 1.0 - smoothstep(-px, px, sd);
        float fw = kind > 2.5 ? 0.0 : kind > 1.5 ? 0.05 : 0.065;
        frame = win * smoothstep(-fw - px, -fw + px, sd);
        float bar = 0.0;
        float bw = 0.02 + px * 0.5;
        if (kind < 0.5) {
          if (style < 0.5) bar = max(1.0 - smoothstep(bw - px, bw + px, abs(wx)), 1.0 - smoothstep(bw - px, bw + px, abs(yl - mix(y0, y1, 0.56))));
          else if (style < 1.5) bar = 1.0 - smoothstep(bw - px, bw + px, abs(wx - hw * 0.34));
          else if (style < 2.5) bar = max(1.0 - smoothstep(bw - px, bw + px, abs(wx)), 1.0 - smoothstep(bw - px, bw + px, abs(yl - (y1 - hw))));
          else if (style < 3.5) bar = 1.0 - smoothstep(bw - px, bw + px, bayW * 0.5 - abs(wx));
          else bar = 1.0 - smoothstep(bw - px, bw + px, abs(fract(wx / 0.7) - 0.5) * 0.7);
        } else if (kind < 1.5) {
          // A panelled door under a fanlight.
          leaf = win * (1.0 - smoothstep(2.26 - px, 2.26 + px, yl)) * (1.0 - frame);
          bar = 1.0 - smoothstep(0.03 - px, 0.03 + px, abs(yl - 2.3));
        } else if (kind < 2.5) {
          // Shop glazing: mullions, a transom and, in the door bay, a door.
          float panes = max(1.0, floor(hw * 2.0 / 1.5 + 0.5));
          float m = abs(fract((wx + hw) / (hw * 2.0) * panes) - 0.5) * (hw * 2.0 / panes);
          bar = max(1.0 - smoothstep(bw - px, bw + px, (hw / panes) - m), 1.0 - smoothstep(bw - px, bw + px, abs(yl - (y1 - 0.55))));
          shop = 1.0;
        } else {
          shutter = win;
        }
        frame = max(frame, bar * win);
        // Stone or timber surround and a sill on older fronts.
        if (kind < 0.5 && (style < 0.5 || (style > 1.5 && style < 2.5))) {
          surround = (1.0 - win) * (1.0 - smoothstep(0.085 - px, 0.085 + px, sd)) * step(0.15, h2);
        }
        if (kind < 0.5 && style < 0.5 && hasShutters > 0.5) {
          // Louvred shutters folded back against the wall on both sides of the window.
          float lx = abs(abs(wx) - (hw + 0.07 + hw * 0.5)) - hw * 0.5;
          float inShutter = 1.0 - smoothstep(-px, px, max(lx, abs(yl - (y0 + y1) * 0.5) - (y1 - y0) * 0.5));
          louvre = inShutter * step(0.25, cHash(vec2(nb + fl * 37.0, wallSeed + 2.0)));
        }
        if (kind < 0.5 && style < 3.5) {
          float sx = abs(wx) - (hw + 0.1);
          sill = (1.0 - smoothstep(-px, px, max(sx, abs(yl - (y0 - 0.06)) - 0.05)));
          sillShadow = (1.0 - smoothstep(-px, px, sx)) * smoothstep(y0 - 0.5, y0 - 0.11, yl) * (1.0 - step(y0 - 0.11, yl));
        }
        wid = cHash(vec2(nb + fl * 37.0, wallSeed));
      }
    }
  }
  // Trim and frame colours belong to the building.
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  vec3 trimC = (lum < 0.3 || mat > 0.5 && mat < 1.5) ? vec3(0.66, 0.63, 0.56) : (h2 < 0.55 ? vec3(0.72, 0.70, 0.64) : base * 0.6);
  vec3 frameC = h3 < 0.55 ? vec3(0.74, 0.74, 0.70) : h3 < 0.8 ? vec3(0.035, 0.04, 0.045) : h3 < 0.92 ? vec3(0.13, 0.07, 0.035) : vec3(0.02, 0.07, 0.045);
  vec3 doorC = h1 < 0.22 ? vec3(0.015, 0.07, 0.04) : h1 < 0.42 ? vec3(0.22, 0.02, 0.02) : h1 < 0.6 ? vec3(0.02, 0.045, 0.14) : h1 < 0.8 ? vec3(0.012, 0.012, 0.014) : vec3(0.16, 0.085, 0.04);
  col = mix(col, trimC * (0.95 + 0.1 * streak), max(surround, sill));
  if (louvre > 0.001) {
    vec3 shutterC = h1 < 0.4 ? vec3(0.03, 0.10, 0.07) : h1 < 0.65 ? vec3(0.05, 0.09, 0.16) : h1 < 0.85 ? vec3(0.16, 0.07, 0.04) : vec3(0.35, 0.34, 0.3);
    float slat = 0.75 + 0.25 * sin(yl * 90.0) * (1.0 - smoothstep(0.01, 0.05, px));
    col = mix(col, shutterC * slat, louvre);
  }
  col *= 1.0 - 0.32 * sillShadow;

  vec3 emis = vec3(0.0);
  float glass = win * (1.0 - frame) * (1.0 - leaf) * (1.0 - shutter);
  if (win > 0.001) {
    // Each pane tilts a little, so neighbouring windows catch different parts of the sky.
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), cN));
    vec3 gN = normalize(cN + T * (wid - 0.5) * 0.07 + vec3(0.0, 1.0, 0.0) * (cHash(vec2(wid, 9.1)) - 0.5) * 0.07);
    vec3 R = reflect(-V, gN);
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(V, gN), 0.0), 5.0);
    // Higher windows see more sky; lower ones mostly see the buildings opposite.
    vec3 sky = cityStreetSky(R, clamp(v / 30.0, 0.0, 1.0));
    // What is behind the glass: a dim room, curtains or a blind.
    float c1 = cHash(vec2(wid, 3.3)), c2 = cHash(vec2(wid, 5.7));
    vec3 room = vec3(0.012, 0.013, 0.015) * (0.5 + wid);
    float curtain = step(0.45, c1) * smoothstep(hw * (0.25 + 0.5 * c2), hw * (0.4 + 0.5 * c2), abs(wx));
    float blind = step(c1, 0.18) * step(y1 - (0.25 + c2) * (y1 - y0), yl);
    vec3 fabric = mix(vec3(0.42, 0.40, 0.36), vec3(0.5, 0.44, 0.36), c2);
    room = mix(room, fabric * 0.22, max(curtain, blind) * (1.0 - shop));
    room = mix(room, vec3(0.006, 0.008, 0.012), spandrel);
    // Lit rooms after dark. Offices light whole floors, homes one room at a time.
    float office = step(2.5, wstyle) * step(wstyle, 3.5) + step(4.5, mat) * step(mat, 5.5);
    float litR = mix(cHash(vec2(wid * 7.7, wallSeed * 1.3)), cHash(vec2(fl * 3.1, wallSeed)), office * 0.75);
    float chance = shop > 0.5 ? uSigns * 0.92 : uWindows * (1.0 - spandrel);
    float lit = step(litR, chance);
    vec3 lamp = mix(vec3(1.0, 0.56, 0.24), vec3(1.0, 0.80, 0.56), c2);
    if (c1 > 0.9) lamp = vec3(0.55, 0.72, 1.0);
    if (office > 0.5) lamp = vec3(0.86, 0.93, 1.0);
    if (shop > 0.5) lamp = mix(vec3(1.0, 0.84, 0.62), vec3(0.9, 0.95, 1.0), c2);
    // The room behind the glass is traced, not painted: a ray from the eye goes through the
    // pane into a box the size of the bay and the floor, and meets a wall, the floor or the
    // ceiling. A lamp hangs in the room and lights whichever surface the ray lands on, so the
    // view into a window shifts with the angle, as a real room does.
    float fhRoom = fl < 0.5 ? groundH : floorH;
    float deep = shop > 0.5 ? 6.5 : office > 0.5 ? 7.0 : 3.4 + 1.6 * c2;
    // A home's room is one bay wide. A shop or an office floor runs on behind several bays.
    float roomW = max(bayW, 2.0 * hw + 0.3) * (shop > 0.5 ? 3.0 : office > 0.5 ? 4.0 : 1.0);
    float halfRoom = roomW * 0.5;
    float roomX = shop > 0.5 || office > 0.5 ? mod(u - margin, roomW) - halfRoom : wx;
    vec3 rd = vec3(dot(-V, T), -V.y, max(dot(V, cN), 0.02));
    vec3 ro = vec3(roomX, yl, 0.0);
    float tx = (rd.x > 0.0 ? halfRoom - ro.x : -halfRoom - ro.x) / (abs(rd.x) > 1e-4 ? rd.x : 1e-4);
    float ty = (rd.y > 0.0 ? fhRoom - ro.y : -ro.y) / (abs(rd.y) > 1e-4 ? rd.y : 1e-4);
    float tz = deep / rd.z;
    float tHit = min(tz, min(tx, ty));
    vec3 hit = ro + rd * tHit;
    vec3 rn = tHit == tz ? vec3(0.0, 0.0, -1.0) : tHit == tx ? vec3(-sign(rd.x), 0.0, 0.0) : vec3(0.0, -sign(rd.y), 0.0);
    // Surfaces of the room: painted walls, a pale ceiling, a darker floor.
    vec3 paint = c1 < 0.3 ? vec3(0.62, 0.58, 0.5) : c1 < 0.55 ? vec3(0.5, 0.56, 0.52) : c1 < 0.75 ? vec3(0.62, 0.5, 0.42) : vec3(0.48, 0.52, 0.6);
    vec3 surf = paint;
    if (rn.y < -0.5) surf = vec3(0.7, 0.69, 0.66);
    else if (rn.y > 0.5) surf = mix(vec3(0.16, 0.11, 0.07), vec3(0.2, 0.2, 0.21), step(0.5, office + shop));
    else if (rn.z < -0.5) {
      // The far wall carries what the room is for: shelves of stock, or pictures and furniture.
      if (shop > 0.5) {
        float shelf = step(0.12, fract(hit.y / 0.55));
        float item = cHash(vec2(floor(hit.x / 0.28) + wid * 31.0, floor(hit.y / 0.55)));
        vec3 stock = mix(vec3(0.5, 0.2, 0.15), vec3(0.2, 0.4, 0.55), item);
        stock = mix(stock, vec3(0.75, 0.68, 0.45), step(0.66, item));
        surf = mix(vec3(0.2, 0.17, 0.14), stock * (0.6 + 0.6 * cHash(vec2(item, 3.0))), shelf * step(hit.y, fhRoom - 0.5));
      } else {
        vec2 pic = abs(vec2(hit.x - (c2 - 0.5) * halfRoom, hit.y - fhRoom * 0.56)) - vec2(0.42 + 0.3 * c1, 0.3);
        surf = mix(surf, mix(vec3(0.2, 0.26, 0.3), vec3(0.5, 0.36, 0.2), c2), step(max(pic.x, pic.y), 0.0) * step(c1, 0.7));
        // Furniture stands against the wall as a darker mass below the picture line.
        surf = mix(surf, surf * 0.32, step(hit.y, 0.85 + 0.3 * c2) * step(abs(hit.x - (0.5 - c1) * halfRoom), 0.9));
      }
    }
    // The lamp in the room: hung from the ceiling, part-way back.
    vec3 bulb = vec3((c2 - 0.5) * halfRoom * 0.6, fhRoom - 0.35, deep * (shop > 0.5 ? 0.3 : 0.45));
    vec3 toBulb = bulb - hit;
    float bd2 = dot(toBulb, toBulb);
    float lightIn = max(dot(rn, toBulb / sqrt(bd2)), 0.0) * 2.4 / (bd2 + 0.6) + 0.07;
    // A shop is lit by a row of spots along its ceiling, so its light is more even.
    if (shop > 0.5 || office > 0.5) lightIn = mix(lightIn, 0.4 + 0.3 * step(0.5, -rn.y), 0.45);
    // Light thins toward the back of a deep room.
    lightIn *= 0.4 + 0.6 * exp(-hit.z * 0.22);
    if (shop > 0.5) {
      // A shop puts things in its window: a row of goods on stands just behind the glass,
      // which slide against the shelves at the back as the viewer moves.
      vec3 dp = ro + rd * (0.75 / rd.z);
      float slot = floor(dp.x / 0.62);
      float pick = cHash(vec2(slot + wid * 17.0, 2.0));
      float tall = 0.45 + 1.25 * cHash(vec2(slot, wid * 9.0 + 1.0));
      float item = step(0.0, dp.y) * step(dp.y, tall) * step(0.2, fract(dp.x / 0.62)) * step(pick, 0.72) * step(abs(dp.x), halfRoom);
      vec3 goodsC = mix(vec3(0.55, 0.2, 0.16), vec3(0.2, 0.36, 0.5), pick * 1.38);
      goodsC = mix(goodsC, vec3(0.8, 0.74, 0.6), step(0.5, cHash(vec2(slot, 5.0))));
      surf = mix(surf, goodsC * (0.75 + 0.25 * step(0.5, fract(dp.y / 0.3))), item);
      lightIn = mix(lightIn, 0.85, item);
    }
    float power = lit * (0.55 + 1.1 * cHash(vec2(wid, 12.9))) * (shop > 0.5 ? 1.1 : 1.0);
    // Thin curtains glow with the room's light and hide what is behind them; blinds dim it.
    float veil = max(curtain, blind) * (1.0 - shop);
    vec3 seen = mix(surf * lightIn, fabric * 0.5, veil * 0.85);
    vec3 lightOut = lamp * seen * power * 1.35;
    // By day the same room is there, lit only by what comes in through its own window.
    room = mix(room, surf * 0.035 * (0.6 + 0.4 * dot(uSkyHorizon, vec3(0.3333))), (1.0 - veil) * (1.0 - spandrel) * 0.9);
    vec3 pane = room + sky * (fres + 0.06) * 0.85;
    col = mix(col, room, glass);
    emis += glass * (sky * (fres * 0.9 + 0.1) * 0.75 + lightOut);
    rough = mix(rough, 0.07, glass);
    cN = normalize(mix(cN, gN, glass));
    // The reveal: glass sits back from the wall, so its top and one side fall in shadow.
    float reveal = (1.0 - smoothstep(0.0, 0.11, -sdw)) * glass;
    col *= 1.0 - 0.5 * reveal;
    emis *= 1.0 - 0.35 * reveal;
    // Frames, door leaves and shutters.
    vec3 fc2 = mix(frameC, vec3(0.03, 0.035, 0.04), step(4.5, mat) * step(mat, 5.5));
    col = mix(col, fc2, frame * win);
    if (leaf > 0.001) {
      float panel = smoothstep(0.02, 0.05, abs(abs(wx) - 0.24)) * smoothstep(0.02, 0.05, abs(yl - 1.15)) * smoothstep(0.02, 0.05, abs(yl - 0.4));
      col = mix(col, doorC * (0.75 + 0.25 * panel), leaf);
      rough = mix(rough, 0.4, leaf);
    }
    if (shutter > 0.001) {
      vec3 sc = mix(vec3(0.25, 0.27, 0.3), vec3(0.08, 0.16, 0.22), h1) * (0.85 + 0.15 * sin(yl * 52.0) * (1.0 - smoothstep(0.02, 0.08, px)));
      col = mix(col, sc, shutter);
      rough = mix(rough, 0.45, shutter);
    }
    // Light from a lit room spills onto its own frame and sill.
    emis += lightOut * 0.06 * (frame * win);
    pane = pane;
  }
  // Rain darkens porous walls and makes them shine a little; snow settles on sills.
  col *= mix(1.0, 0.7, uWet * (1.0 - glass) * (0.6 + 0.4 * streak));
  rough = mix(rough, rough * 0.6, uWet * (1.0 - glass));
  float sillSnow = sill * smoothstep(0.2, 0.7, uSnow);
  col = mix(col, SNOW, sillSnow);
  emis += col * cityLampLight(vCityWorld, cN) * (1.0 - glass);
  diffuseColor.rgb = col;
  roughnessFactor = rough;
  totalEmissiveRadiance += emis;
  normal = normalize(mat3(viewMatrix) * cN);
}
`;

/** Roofs: tiles, slate, gravel, membrane, standing-seam metal and planted roofs. */
export const FRAG_ROOF = /* glsl */ `
{
  float ru = vRoof.x, rv = vRoof.y, mat = floor(vRoof.z + 0.5), seed = vRoof.w;
  vec3 base = diffuseColor.rgb, col = base;
  vec3 cN = normalize(vCityN);
  if (!gl_FrontFacing) cN = -cN;
  float px = max(max(fwidth(ru), fwidth(rv)), 0.002);
  float rough = 0.85;
  if (mat < 0.5) {
    // Clay pantiles in courses, each tile its own shade, with a rolled profile.
    float row = floor(rv / 0.3);
    float tu = ru / 0.22 + 0.5 * mod(row, 2.0);
    float fade = smoothstep(0.03, 0.14, px);
    vec3 tile = base * (0.78 + 0.44 * cHash(vec2(floor(tu), row) + seed * 7.0));
    float roll = 0.5 + 0.5 * sin(fract(tu) * 6.2831);
    float lap = smoothstep(0.0, 0.25, fract(rv / 0.3));
    col = mix(tile * (0.72 + 0.28 * roll) * (0.7 + 0.3 * lap), base * 0.92, fade);
    col *= 0.9 + 0.2 * cFbm(vec2(ru, rv) * 0.25 + seed * 30.0);
  } else if (mat < 1.5) {
    // Slate: flat staggered rectangles.
    float row = floor(rv / 0.2);
    float tu = ru / 0.3 + 0.5 * mod(row, 2.0);
    vec2 f = vec2(fract(tu), fract(rv / 0.2));
    float fade = smoothstep(0.03, 0.14, px);
    float gap = 1.0 - smoothstep(0.0, 0.03, min(f.x, 1.0 - f.x) * 0.3) * smoothstep(0.0, 0.03, f.y * 0.2);
    vec3 slate = base * (0.8 + 0.4 * cHash(vec2(floor(tu), row) + seed * 5.0));
    col = mix(slate * (1.0 - 0.45 * gap), base * 0.96, fade);
    rough = 0.6;
  } else if (mat < 2.5) {
    // Gravel ballast with water stains.
    col *= 0.86 + 0.28 * cNoise(vec2(ru, rv) * 26.0) * (1.0 - smoothstep(0.02, 0.2, px));
    col *= 0.82 + 0.3 * cFbm(vec2(ru, rv) * 0.18 + seed * 11.0);
    rough = 0.95;
  } else if (mat < 3.5) {
    // Bitumen membrane laid in strips, with ponding stains.
    float seam = 1.0 - smoothstep(0.01, 0.03 + px, abs(fract(ru / 1.1) - 0.5) * 1.1);
    col *= 1.0 - 0.22 * seam;
    col *= 0.78 + 0.36 * cFbm(vec2(ru, rv) * 0.14 + seed * 3.0);
    rough = 0.8;
  } else if (mat < 4.5) {
    // Standing-seam metal.
    float seam = 1.0 - smoothstep(0.012, 0.03 + px, abs(fract(ru / 0.5) - 0.5) * 0.5);
    col *= 1.0 + 0.25 * seam;
    col *= 0.92 + 0.12 * cNoise(vec2(ru * 0.3, rv * 0.08));
    rough = 0.42;
  } else {
    // A planted roof: low sedum in greens and rusts.
    float n = cFbm(vec2(ru, rv) * 0.5 + seed * 2.0);
    col = mix(vec3(0.07, 0.11, 0.035), vec3(0.16, 0.08, 0.04), smoothstep(0.4, 0.75, n)) * (0.8 + 0.4 * cNoise(vec2(ru, rv) * 9.0));
    rough = 0.95;
  }
  // Moss and dirt gather low on the slope and in the lee of the weather.
  col *= 0.94 + 0.1 * cNoise(vec2(ru * 0.07, rv * 0.9) + seed);
  col *= mix(1.0, 0.72, uWet);
  rough = mix(rough, rough * 0.45, uWet);
  float sn = citySnow(cN.y, vCityWorld);
  col = mix(col, SNOW, sn);
  rough = mix(rough, 0.9, sn);
  diffuseColor.rgb = col;
  roughnessFactor = rough;
  totalEmissiveRadiance += col * cityLampLight(vCityWorld, cN);
  normal = normalize(mat3(viewMatrix) * cN);
}
`;

/** Trim and street objects: per-vertex roughness, switched glows, foliage, glass, snow caps. */
export const FRAG_SOLID = /* glsl */ `
{
  float rough = vSurf.x, glow = vSurf.y, kind = floor(vSurf.z + 0.5);
  // A wheel keeps its axle in the first two numbers; it is plain rubber and metal.
  if (vSurf.z > 0.3 && vSurf.z < 0.5) { rough = 0.85; glow = 0.0; }
  vec3 col = diffuseColor.rgb;
  vec3 cN = normalize(vCityN);
  if (!gl_FrontFacing) cN = -cN;
  vec3 V = normalize(cameraPosition - vCityWorld);
  vec3 emis = vec3(0.0);
  // Lamp glass: bright enough to read as the source, not so bright that the lens blooms it into a ball.
  if (kind > 0.5 && kind < 1.5) emis += col * glow * uLamps * 2.1;
  else if (kind < 2.5 && kind > 1.5) emis += mix(col, vec3(dot(col, vec3(0.3333))), 0.25) * glow * (0.03 + uSigns * 0.7);
  else if (kind > 6.5 && kind < 7.5) emis += col * glow * 1.4;
  // Head and tail lights of moving vehicles come on with the street lamps and in rain.
  // The lens itself is small and only moderately bright; the light it throws does the work.
  else if (kind > 2.5 && kind < 4.5) emis += col * glow * (kind < 3.5 ? uHeadlights * 0.95 : 0.06 + uHeadlights * 0.5);
  if (kind > 7.5) rough = clamp(rough, 0.25, 1.0);
  else if (kind > 5.5) {
    // Glass in cars and shelters reflects the sky.
    float fres = 0.05 + 0.95 * pow(1.0 - max(dot(V, cN), 0.0), 5.0);
    // Glass shows a dim interior plus the sky it reflects, more at grazing angles.
    emis += cityStreetSky(reflect(-V, cN), 0.3) * (fres * 0.75 + 0.04) * 0.55;
    col *= 0.25;
  } else if (kind > 4.5 && kind < 5.5) {
    // A crown is not a solid lump. Leaves are cut out of it: more toward its outline, where
    // the surface turns away from the eye, and in scattered gaps that show the shade inside.
    if (vCityWorld.y > 1.3) {
      float leafN = cNoise(vCityWorld.xz * 7.5 + vCityWorld.y * 4.3) * 0.6 + cNoise(vCityWorld.xy * 13.0 - vCityWorld.z * 6.1) * 0.4;
      float rim = 1.0 - abs(dot(cN, V));
      if (leafN < mix(0.2, 0.66, rim * rim)) discard;
    }
    // Clumps of leaves catch the light differently: break the smooth lump into dapples.
    float clump = cNoise(vCityWorld.xy * 3.1 + vCityWorld.z * 1.7) * cNoise(vCityWorld.zy * 3.7 - vCityWorld.x * 1.3);
    float fine = cNoise(vCityWorld.xz * 11.0 + vCityWorld.y * 8.0);
    col *= (0.5 + 1.5 * clump) * (0.8 + 0.4 * fine);
    // Leaves let some sunlight through from behind, and a crown is full of light bounced
    // between leaves, so its shaded side never goes black.
    float back = max(dot(-cN, uSunDir), 0.0);
    emis += col * uSunColor * back * 0.4 * cityCloudLight(vCityWorld);
    emis += col * mix(uSkyHorizon, uSkyZenith, 0.4) * 0.16;
  }
  if (kind < 0.5 && rough < 0.36) {
    // Paint and polished metal pick up a little sky.
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(V, cN), 0.0), 5.0);
    emis += cityStreetSky(reflect(-V, cN), 0.3) * fres * 0.5;
  }
  col *= mix(1.0, 0.74, uWet * step(0.5, rough));
  rough = mix(rough, rough * 0.55, uWet);
  float sn = citySnow(cN.y, vCityWorld) * ((kind > 0.5 && kind < 4.5) || kind > 7.5 ? 0.0 : 1.0);
  col = mix(col, SNOW, sn);
  rough = mix(rough, 0.9, sn);
  emis += col * cityLampLight(vCityWorld, cN);
  diffuseColor.rgb = col;
  roughnessFactor = clamp(rough, 0.04, 1.0);
  totalEmissiveRadiance += emis;
  normal = normalize(mat3(viewMatrix) * cN);
}
`;

/** The ground, shaded from the street field: asphalt, kerbs, paving, paths, grass, paint. */
export const FRAG_GROUND = /* glsl */ `
{
  if (uPassageEnabled > 0.5) {
    vec2 uv = (vCityWorld.xz - uPassageRect.xy) / uPassageRect.zw;
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) {
      vec4 passage = texture2D(uPassage, uv);
      #ifdef CITY_BRIDGE
      float surfaceY = inverseTransformDirection(normal, viewMatrix).y;
      if (passage.a > 0.5 && surfaceY < 0.65 && vCityWorld.y > passage.r - 0.1 && vCityWorld.y < passage.g) discard;
      #else
      if (passage.b > 0.5 && vCityWorld.y >= passage.r - 0.02) discard;
      #endif
    }
  }
  #ifdef CITY_BRIDGE
  if (inverseTransformDirection(normal, viewMatrix).y > 0.65) {
  #endif
  vec2 wp = vCityWorld.xz;
  vec2 fuv = cityFieldUV(vCityWorld);
  float inField = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
  vec4 fA = texture2D(uFieldA, fuv), fB = texture2D(uFieldB, fuv), fC = texture2D(uFieldC, fuv), fD = texture2D(uFieldD, fuv);
  float edge = mix(40.0, fA.r, inField), centre = fA.g;
  float foot = mix(40.0, fB.r, inField), water = mix(40.0, fB.g, inField), green = mix(40.0, fB.b, inField), wall = mix(40.0, fB.a, inField);
  float half_ = fC.r, lanes = fC.g, junction = mix(60.0, fC.b, inField), zebra = mix(60.0, fC.a, inField);
  float footKind = floor(fD.r + 0.5), bridge = mix(60.0, fD.g, inField), greenKind = fD.a;
  #if defined(CITY_TERRAIN) && !defined(CITY_BRIDGE)
  vec2 cells = uFieldRect.zw / uFieldCell;
  vec2 cellUV = (floor(fuv * cells) + 0.5) / cells;
  if (inField > 0.0 && texture2D(uFieldB, cellUV).g < 0.0) discard;
  #elif !defined(CITY_BRIDGE)
  if (water < 0.0 && bridge > 0.0) discard;
  #endif
  float px = max(length(fwidth(wp)), 0.002);
  vec3 V = normalize(cameraPosition - vCityWorld);
  // Road space: distance from the kerb and distance along the road, so paving follows the street.
  float sAlong = atan(fA.a, fA.b) / 6.2831853 * 9.0;
  bool nearRoad = edge < 7.5;
  vec2 rs = nearRoad ? vec2(edge, sAlong) : wp;
  float n1 = cFbm(wp * 0.31), n2 = cNoise(wp * 2.7), n3 = cNoise(wp * 19.0);
  float detail = 1.0 - smoothstep(0.02, 0.12, px);

  // ---- paving (the default surface)
  vec3 col; float rough = 0.88; float porous = 1.0; float paint = 0.0;
  if (uPaving < 0.5) {
    // Concrete flags.
    vec2 g = rs / 0.6; vec2 f = fract(g);
    float joint = 1.0 - smoothstep(0.006, 0.02 + px, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 0.6);
    col = vec3(0.30, 0.29, 0.27) * (0.9 + 0.2 * cHash(floor(g)));
    col *= 1.0 - 0.35 * joint * detail;
  } else if (uPaving < 1.5) {
    // Clay pavers laid herringbone.
    vec2 g = rs / 0.105;
    float diag = floor((g.x + g.y) * 0.5);
    bool flip = mod(diag, 2.0) < 1.0;
    vec2 q = flip ? vec2(g.x - g.y, g.x + g.y) * 0.5 : vec2(g.x + g.y, g.x - g.y) * 0.5;
    vec2 cell = floor(q * vec2(0.5, 1.0)); vec2 f = fract(q * vec2(0.5, 1.0));
    float joint = 1.0 - smoothstep(0.03, 0.09, min(min(f.x, 1.0 - f.x) * 2.0, min(f.y, 1.0 - f.y)));
    vec3 clay = mix(vec3(0.15, 0.075, 0.055), vec3(0.105, 0.066, 0.055), cHash(cell + diag));
    clay = mix(clay, vec3(0.17, 0.11, 0.075), step(0.7, cHash(cell * 2.3 + diag)) * 0.7);
    clay = mix(clay, vec3(0.11, 0.10, 0.10), step(0.86, cHash(cell * 1.7 + 3.0)));
    col = mix(clay * (1.0 - 0.4 * joint), vec3(0.125, 0.075, 0.058), 1.0 - detail);
  } else if (uPaving < 2.5) {
    // Granite setts in arcs of slightly different greys.
    vec2 g = rs / 0.14; g.x += 0.5 * mod(floor(g.y), 2.0);
    vec2 f = fract(g);
    float joint = 1.0 - smoothstep(0.03, 0.1, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    vec3 sett = vec3(0.21, 0.21, 0.215) * (0.75 + 0.5 * cHash(floor(g)));
    sett = mix(sett, vec3(0.24, 0.19, 0.17), step(0.8, cHash(floor(g) + 9.0)));
    col = mix(sett * (1.0 - 0.45 * joint), vec3(0.2, 0.2, 0.2), 1.0 - detail);
    rough = 0.8;
  } else {
    // Warm stone slabs.
    vec2 g = rs / vec2(0.45, 0.8); g.y += 0.5 * mod(floor(g.x), 2.0);
    vec2 f = fract(g);
    float joint = 1.0 - smoothstep(0.004, 0.02 + px, min(min(f.x, 1.0 - f.x) * 0.45, min(f.y, 1.0 - f.y) * 0.8));
    col = vec3(0.36, 0.31, 0.24) * (0.88 + 0.24 * cHash(floor(g)));
    col *= 1.0 - 0.3 * joint * detail;
  }
  col *= 0.86 + 0.28 * n1;
  // A worn, paler line where people walk, and grime against the walls.
  col *= 1.0 + 0.1 * smoothstep(0.5, 1.4, edge) * (1.0 - smoothstep(2.2, 3.4, edge));
  col *= mix(0.62, 1.0, smoothstep(0.0, 0.7, wall + 0.25 * n2));

  // ---- back gardens and yards: ground far from any street, split into plots
  #ifndef CITY_BRIDGE
  float yard = smoothstep(9.0, 13.0, edge) * step(0.0, green) * step(0.0, foot) * inField;
  if (yard > 0.001) {
    vec2 pg = wp / vec2(6.5, 10.5) + vec2(cNoise(wp * 0.02) * 2.0, 0.0);
    vec2 pf = fract(pg); float ph = cHash(floor(pg) + 4.0);
    float fence = 1.0 - smoothstep(0.02, 0.05, min(min(pf.x, 1.0 - pf.x) * 6.5, min(pf.y, 1.0 - pf.y) * 10.5));
    vec3 lawn = mix(vec3(0.05, 0.10, 0.025), vec3(0.11, 0.15, 0.045), cFbm(wp * 0.8 + ph * 9.0)) * (0.8 + 0.4 * n3 * detail);
    vec3 bed = mix(vec3(0.06, 0.045, 0.03), vec3(0.04, 0.08, 0.03), n2);
    vec3 plot = ph < 0.5 ? lawn : ph < 0.7 ? mix(lawn, bed, step(0.55, cNoise(wp * 0.9 + ph * 20.0))) : ph < 0.86 ? col * 0.95 : vec3(0.2, 0.18, 0.15) * (0.8 + 0.4 * n3);
    plot = mix(plot, vec3(0.05, 0.04, 0.03), fence * 0.8 * detail);
    col = mix(col, plot, yard);
    rough = mix(rough, 0.95, yard);
    porous = mix(porous, 0.5, yard);
  }
  #endif
  // ---- grass and planting
  if (green < 0.0) {
    float g1 = cFbm(wp * 0.9), g2 = cNoise(wp * 7.0);
    vec3 grass = mix(vec3(0.045, 0.095, 0.022), vec3(0.10, 0.15, 0.04), g1);
    #ifdef CITY_AUTUMN
    grass = mix(grass, uAutumnGrass * (0.6 + 0.65 * g1), 0.52);
    #endif
    grass = mix(grass, vec3(0.13, 0.12, 0.05), smoothstep(0.62, 0.9, cFbm(wp * 0.21 + 9.0)) * 0.6);
    grass *= 0.8 + 0.4 * g2 * detail + 0.2 * n3 * detail;
    if (greenKind > 2.5) grass = mix(grass, vec3(0.06, 0.05, 0.03), 0.55);
    float e = smoothstep(0.0, -0.35 - 0.3 * n2, green);
    col = mix(col, grass, e);
    rough = mix(rough, 0.97, e);
    porous = mix(porous, 0.35, e);
  }
  // ---- paths
  if (foot < 0.0 && edge > 0.0) {
    vec3 path;
    if (footKind > 1.5 && footKind < 2.5) path = vec3(0.21, 0.07, 0.055) * (0.85 + 0.3 * n3 * detail);
    else if (footKind > 2.5 && footKind < 3.5) path = col * 1.08;
    else if (footKind > 3.5 && footKind < 4.5) path = vec3(0.3, 0.29, 0.27) * (0.7 + 0.3 * step(0.5, fract(sAlong / 0.32)));
    else if (footKind > 4.5) path = vec3(0.19, 0.15, 0.10) * (0.8 + 0.4 * n2);
    else path = green < 1.0 ? vec3(0.34, 0.29, 0.21) * (0.82 + 0.36 * n3 * detail) : col * 1.05;
    float e = smoothstep(0.0, -0.18, foot);
    col = mix(col, path, e);
  }
  // ---- kerb
  float kerb = (1.0 - smoothstep(0.17, 0.2 + px, edge)) * step(0.0, edge);
  if (kerb > 0.001) {
    float joint = 1.0 - smoothstep(0.01, 0.03 + px, abs(fract(sAlong) - 0.5));
    vec3 stone = vec3(0.2, 0.195, 0.185) * (0.8 + 0.3 * cHash(vec2(floor(sAlong + 0.5), 3.0))) * (0.85 + 0.3 * n2);
    col = mix(col, stone * (1.0 - 0.3 * joint * detail), kerb);
    rough = mix(rough, 0.7, kerb);
  }
  // ---- carriageway
  float road = 1.0 - smoothstep(-px, px, edge);
  if (road > 0.001) {
    // Asphalt: fine aggregate, patches of newer and older surface, tyre-polished lanes.
    vec3 asphalt = vec3(0.055, 0.056, 0.06) * (0.8 + 0.4 * n1);
    asphalt *= 0.82 + 0.36 * n3 * detail;
    float repair = step(0.72, cNoise(floor(wp / vec2(2.6, 1.9)) * 1.37)) * step(0.5, cNoise(wp * 0.07));
    asphalt *= 1.0 - 0.22 * repair;
    float wheel = 1.0 - smoothstep(0.1, 0.35, abs(fract(centre / 1.75) - 0.5));
    asphalt *= 1.0 + 0.1 * wheel;
    // Cracks, as dark wandering lines.
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(cNoise(wp * 0.55) - 0.5)) ;
    asphalt *= 1.0 - 0.3 * crack * step(0.55, cNoise(wp * 0.13 + 5.0)) * detail;
    // Gutter: dirt and leaves collect by the kerb.
    asphalt *= mix(1.0, 0.72, smoothstep(-0.7, -0.05, edge) * (0.5 + 0.5 * n2));
    col = mix(col, asphalt, road);
    rough = mix(rough, 0.82, road);
    // ---- paint, worn by traffic
    float calm = smoothstep(half_ + 3.0, half_ + 9.0, junction);
    float wear = smoothstep(0.25, 0.6, cNoise(wp * 3.3) * 0.6 + n3 * 0.4 + 0.25);
    float marks = floor(lanes + 0.01), oneway = step(0.25, fract(lanes));
    float lw = 0.065 + px * 0.5;
    float centreMark = 0.0;
    if (marks > 1.5) {
      float dash = step(abs(sAlong), 1.5);
      // Lane lines: a centre line on two-way roads, dividers between lanes.
      float laneW = half_ * 2.0 / marks;
      float offset = mod(marks, 2.0) < 0.5 ? centre : abs(centre - laneW * 0.5);
      float nearest = abs(mod(offset + laneW * 0.5, laneW) - laneW * 0.5);
      float isCentre = step(centre, laneW * 0.4) * (1.0 - oneway);
      float line = (1.0 - smoothstep(lw - px, lw + px, nearest)) * step(centre, half_ - 1.0);
      paint = max(paint, line * mix(dash, 1.0, isCentre * step(3.5, marks)) * calm);
      centreMark = isCentre * line;
      // Edge lines on wider roads.
      paint = max(paint, (1.0 - smoothstep(lw - px, lw + px, abs(centre - (half_ - 0.3)))) * step(2.5, marks) * calm);
    }
    // Zebra stripes and the stop line before them.
    float onCross = 1.0 - smoothstep(1.6 - px, 1.6 + px, abs(zebra));
    float stripes = step(0.5, fract(centre / 1.0 + 0.25));
    paint = max(paint, onCross * stripes * step(edge, -0.25));
    float stopLine = (1.0 - smoothstep(0.12, 0.12 + px, abs(abs(zebra) - 2.7))) * step(edge, -0.2) * step(1.5, marks);
    paint = max(paint, stopLine);
    paint *= road * mix(1.0, wear, 0.75);
    col = mix(col, mix(vec3(0.62, 0.62, 0.58), uMarkColor, centreMark), paint);
    rough = mix(rough, 0.55, paint);
  }

  #ifdef CITY_AUTUMN
  // Leaves collect around trees and kerbs. Traffic keeps the centre of the road thinner.
  float leafDrifts = smoothstep(0.22, 0.82, cNoise(wp * 0.58) * 0.73 + n1 * 0.27);
  float leafKerb = 1.0 - smoothstep(0.15, 1.25, abs(edge + 0.2));
  float leafDensity = (0.15 + 0.72 * fD.b) * (0.28 + 0.72 * leafDrifts);
  leafDensity *= mix(0.24 + 0.70 * leafKerb, 1.0, 1.0 - road) * inField;
  vec2 litterGrid = wp / 0.19;
  vec2 leafCell = floor(litterGrid);
  float leafPick = cHash(leafCell + 17.4);
  float leafSpin = cHash(leafCell + 53.1) * 6.2831853;
  vec2 leafOffset = (vec2(cHash(leafCell), cHash(leafCell + 1.7)) - 0.5) * 0.44;
  vec2 leafLocal = fract(litterGrid) - 0.5 - leafOffset;
  leafLocal = mat2(cos(leafSpin), -sin(leafSpin), sin(leafSpin), cos(leafSpin)) * leafLocal;
  leafLocal /= vec2(0.33, 0.17) * mix(0.58, 1.17, cHash(leafCell + 11.6));
  float leafShape = abs(leafLocal.x) + abs(leafLocal.y) * (0.8 + 0.30 * abs(leafLocal.x));
  float leafAA = clamp(px / 0.04, 0.04, 0.64);
  float leafEdge = 1.0 - smoothstep(1.0 - leafAA, 1.0 + leafAA, leafShape);
  float nearbyLeaves = leafEdge * step(leafPick, leafDensity);
  float leafDetail = 1.0 - smoothstep(0.035, 0.17, px);
  float leaves = mix(leafDensity * (0.18 + leafDrifts * 0.26), nearbyLeaves, leafDetail);
  float leafColor = mix(cNoise(wp * 0.31), cHash(leafCell + 26.8), leafDetail);
  vec3 litter = mix(uLeafCopper, uLeafOchre, smoothstep(0.3, 0.8, leafColor));
  litter = mix(litter, uLeafBrown, 1.0 - smoothstep(0.0, 0.47, leafColor));
  col = mix(col, litter * (0.8 + 0.3 * leafDrifts), leaves);
  rough = mix(rough, 0.91, leaves);
  #endif

  // ---- snow: deep on verges and pavements, driven to slush in the wheel tracks
  float sn = citySnow(1.0, vCityWorld);
  if (sn > 0.001) {
    float track = road * (1.0 - smoothstep(0.1, 0.33, abs(fract(centre / 1.75) - 0.5)));
    float trodden = (1.0 - road) * smoothstep(0.5, 1.2, edge) * (1.0 - smoothstep(1.6, 2.6, edge)) * step(green, 0.0 + 99.0) * 0.45 * (0.5 + 0.5 * n2);
    float cover = sn * (1.0 - 0.9 * track) * (1.0 - trodden);
    float berm = smoothstep(-0.9, -0.2, edge) * (1.0 - smoothstep(0.3, 0.8, edge));
    cover = max(cover, sn * berm * 0.9);
    vec3 slush = mix(col * 0.6, vec3(0.3, 0.3, 0.31), 0.35);
    col = mix(col, slush, sn * track * 0.8);
    vec3 snowCol = SNOW * (0.9 + 0.1 * n1) * mix(1.0, 0.82, road * 0.6 + trodden);
    col = mix(col, snowCol, cover);
    rough = mix(rough, 0.92, cover);
    porous *= 1.0 - cover;
  }

  // ---- water lying on the surface
  float low = cFbm(wp * 0.12 + 3.7) * 0.65 + cNoise(wp * 0.8) * 0.35;
  float gutter = smoothstep(-1.0, -0.1, edge) * road;
  float puddle = smoothstep(1.0 - uPuddles * 0.72, 1.12 - uPuddles * 0.72, low + gutter * 0.28) * (1.0 - step(green, 0.0) * 0.8) * (1.0 - sn);
  float wet = clamp(uWet * 1.15 - (1.0 - low) * 0.15, 0.0, 1.0) * (1.0 - sn * 0.7);
  col *= mix(1.0, mix(0.5, 0.82, paint), wet * porous);
  rough = mix(rough, 0.3, wet * 0.9);
  rough = mix(rough, 0.03, puddle);
  #ifdef CITY_TERRAIN
  vec3 cN = inverseTransformDirection(normal, viewMatrix);
  #else
  vec3 cN = vec3(0.0, 1.0, 0.0);
  #endif
  if (uRain > 0.01 && px < 0.2) {
    // Rings where drops land, strongest in standing water.
    vec2 acc = vec2(0.0);
    for (int i = 0; i < 2; i++) {
      vec2 g = wp * (2.3 + float(i) * 1.7) + float(i) * 7.3;
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = cHash(id + float(i) * 3.1);
      float ph = fract(uTime * (1.1 + h * 0.7) + h * 10.0);
      vec2 d = f - (vec2(cHash(id + 1.7), cHash(id + 5.3)) - 0.5) * 0.5;
      float r = length(d);
      float ring = sin((r - ph * 0.45) * 46.0) * smoothstep(0.07, 0.0, abs(r - ph * 0.45)) * (1.0 - ph);
      acc += normalize(d + 1e-4) * ring;
    }
    cN = normalize(cN + vec3(acc.x, 0.0, acc.y) * uRain * mix(0.05, 0.3, puddle));
  }
  // Fine roughness of the wet surface breaks reflections into streaks.
  vec2 micro = (vec2(cNoise(wp * 2.1), cNoise(wp * 2.1 + 31.0)) - 0.5) * (1.0 - puddle);
  vec3 emis = col * cityLampLight(vCityWorld, cN);
  if (uReflectOn > 0.5 && wet > 0.02) {
    vec4 rc = uReflectMatrix * vec4(vCityWorld, 1.0);
    vec2 ruv = rc.xy / rc.w * 0.5 + 0.5;
    ruv += cN.xz * 0.07 + micro * 0.006 * wet;
    float F = 0.03 + 0.97 * pow(1.0 - max(dot(V, cN), 0.0), 5.0);
    float blur = mix(3.4, 0.0, puddle);
    // Several taps up and down the frame: wet asphalt stretches lights toward the viewer.
    vec3 refl = vec3(0.0);
    float spread = mix(0.03, 0.0015, puddle);
    for (int i = 0; i < 5; i++) {
      float k = (float(i) - 2.0) * 0.5;
      refl += texture2D(uReflect, ruv + vec2(micro.x * 0.004, k * spread), blur).rgb * (1.0 - abs(k) * 0.45);
    }
    refl /= 3.2;
    float strength = clamp(F * 1.5, 0.0, 1.0) * mix(wet * 0.42, 1.0, puddle) * (1.0 - sn);
    emis += refl * strength;
    col *= 1.0 - strength * 0.7;
  }
  diffuseColor.rgb = col;
  roughnessFactor = clamp(rough, 0.03, 1.0);
  totalEmissiveRadiance += emis;
  normal = normalize(mat3(viewMatrix) * cN);
  #ifdef CITY_BRIDGE
  }
  #endif
}
`;

/** Canal and lake water: dark, rippled, reflecting the quays and the sky. */
export const FRAG_WATER = /* glsl */ `
{
  vec2 wp = vCityWorld.xz;
  vec3 V = normalize(cameraPosition - vCityWorld);
  vec2 flow = uWind.xz * 0.05;
  float t = uTime;
  // Two crossing trains of small waves.
  vec2 q1 = wp * vec2(0.22, 0.34) + flow * t * 3.0, q2 = wp * vec2(0.9, 0.6) - flow.yx * t * 5.0 + 11.0;
  float e = 0.12;
  float hC = cFbm(q1) * 0.6 + cFbm(q2) * 0.4;
  float hX = cFbm(q1 + vec2(e, 0.0)) * 0.6 + cFbm(q2 + vec2(e, 0.0) * 2.5) * 0.4;
  float hZ = cFbm(q1 + vec2(0.0, e)) * 0.6 + cFbm(q2 + vec2(0.0, e) * 2.5) * 0.4;
  float chop = 0.035 + 0.012 * length(uWind.xz);
  vec3 cN = normalize(vec3(-(hX - hC) / e * chop, 1.0, -(hZ - hC) / e * chop));
  if (uRain > 0.01) {
    vec2 acc = vec2(0.0);
    for (int i = 0; i < 2; i++) {
      vec2 g = wp * (1.9 + float(i) * 1.3) + float(i) * 5.1;
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = cHash(id + float(i) * 2.3);
      float ph = fract(t * (1.0 + h * 0.6) + h * 10.0);
      vec2 d = f - (vec2(cHash(id + 1.7), cHash(id + 5.3)) - 0.5) * 0.5;
      float r = length(d);
      acc += normalize(d + 1e-4) * sin((r - ph * 0.45) * 44.0) * smoothstep(0.08, 0.0, abs(r - ph * 0.45)) * (1.0 - ph);
    }
    cN = normalize(cN + vec3(acc.x, 0.0, acc.y) * uRain * 0.35);
  }
  float F = 0.03 + 0.97 * pow(1.0 - max(dot(V, cN), 0.0), 5.0);
  vec3 deep = vec3(0.012, 0.022, 0.016);
  vec3 refl = citySky(reflect(-V, cN));
  if (uWaterOn > 0.5) {
    vec4 rc = uReflectWaterMatrix * vec4(vCityWorld, 1.0);
    vec2 ruv = rc.xy / rc.w * 0.5 + 0.5 + cN.xz * 0.22;
    refl = texture2D(uReflectWater, ruv).rgb;
  }
  float ice = smoothstep(0.75, 0.95, uSnow) * smoothstep(0.35, 0.6, cFbm(wp * 0.08 + 2.0));
  vec3 col = mix(deep, SNOW * 0.8, ice);
  diffuseColor.rgb = col * (1.0 - F * (1.0 - ice));
  roughnessFactor = mix(0.05, 0.85, ice);
  #ifdef CITY_TERRAIN
  vec3 lightPoint = vCityWorld;
  #else
  vec3 lightPoint = vec3(vCityWorld.x, 0.0, vCityWorld.z);
  #endif
  totalEmissiveRadiance += refl * F * (1.0 - ice) + col * cityLampLight(lightPoint, vec3(0.0, 1.0, 0.0)) * 0.4;
  normal = normalize(mat3(viewMatrix) * cN);
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
export const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uSkyZenith, uSkyHorizon, uSunDir, uSunColor, uFogTint;
uniform vec4 uCloud;
uniform float uGlow, uStars, uDark, uTime;
float sHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float sNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float sFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * sNoise(p); p = p * 2.02 + 13.7; a *= 0.5; } return s / 0.96875; }
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(h, 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  // Glow round the sun, tight and wide.
  col += uSunColor * uGlow * (0.035 * pow(sd, 6.0) + 0.12 * pow(sd, 48.0));
  // Stars, each a single bright cell, twinkling slightly.
  if (uStars > 0.01) {
    vec2 sp = d.xz / (abs(d.y) + 0.35) * 220.0;
    float s = step(0.9965, sHash(floor(sp))) * smoothstep(0.5, 0.1, length(fract(sp) - 0.5));
    col += vec3(0.8, 0.85, 1.0) * s * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + sHash(floor(sp)) * 40.0)) * smoothstep(0.02, 0.3, d.y);
  }
  // The sun or moon disc.
  float disc = smoothstep(0.99955, 0.9998, sd);
  vec3 body = uSunColor * disc * 6.0;
  // Clouds on a flat layer overhead, lit on the side that faces the sun.
  vec2 cuv = d.xz / (h + 0.14) * 0.55 + uCloud.zw;
  float c = sFbm(cuv);
  float c2 = sFbm(cuv * 2.7 + 5.0);
  float dens = smoothstep(1.0 - uCloud.x * 1.12, 1.25 - uCloud.x * 0.72, c * 0.8 + c2 * 0.2);
  float edgeLight = sFbm(cuv + uSunDir.xz * 0.06) - c;
  vec3 lit = uSkyHorizon * 1.12 + uSunColor * (0.07 + 0.25 * pow(sd, 4.0) * uGlow) + uSunColor * 0.25 * max(-edgeLight, 0.0);
  vec3 shade = mix(uSkyZenith, uFogTint, 0.5) * 0.55;
  vec3 cloud = mix(lit, shade, uCloud.y * (0.35 + 0.65 * smoothstep(0.35, 0.8, c)));
  float fade = smoothstep(0.0, 0.16, d.y);
  col = mix(col + body * (1.0 - dens), cloud, dens * fade);
  // The horizon melts into the haze.
  col = mix(uFogTint, col, smoothstep(-0.02, 0.1 + 0.25 * uDark, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export const HALO_VERT = /* glsl */ `
attribute float aSize;
uniform float uScale, uHaze;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  // The sprite is large enough to hold the cone of lit air that hangs below a lamp.
  gl_PointSize = min(aSize * 7.0 * uScale / dist, 420.0);
  vFade = smoothstep(0.6, 3.0, dist) * mix(1.0, 0.75, smoothstep(40.0, 300.0, dist));
}`;
export const HALO_FRAG = /* glsl */ `
uniform vec3 uLampColor; uniform float uLamps, uHaze;
varying float vFade;
void main() {
  // A street lamp does not glow like a ball. Its glass is bright, and its light falls: what can
  // be seen in the air is the cone of light below the lamp, faint on a clear night and plain
  // in mist, rain or snow, where droplets scatter it.
  vec2 p = gl_PointCoord - 0.5;
  float below = max(p.y, 0.0);
  float width = 0.012 + below * 0.62;
  float cone = exp(-(p.x * p.x) / (width * width)) * exp(-below * 5.2) * smoothstep(-0.01, 0.03, p.y);
  float r = length(p) * 2.0;
  // Mist also scatters a little light in every direction, close to the glass.
  float mist = exp(-r * 9.0) * uHaze * 0.5;
  float a = (cone * (0.03 + uHaze * 0.42) + mist) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(uLampColor * a * uLamps * vFade, 1.0);
}`;

export const RAIN_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uRain;
uniform vec3 uCenter, uFall, uBox;
varying float vAlpha;
void main() {
  // Each streak falls through a box that follows the camera and wraps round.
  vec3 p = aSeed.xyz * uBox + uFall * uTime * (0.8 + 0.4 * fract(aSeed.x * 91.7));
  p = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  p += uFall * 0.045 * aSeed.w * (0.7 + 0.6 * fract(aSeed.y * 57.3));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  vAlpha = smoothstep(0.4, 2.5, dist) * (1.0 - smoothstep(uBox.x * 0.3, uBox.x * 0.5, dist)) * step(fract(aSeed.z * 37.1), uRain) * (0.35 + 0.65 * aSeed.w);
}`;
export const RAIN_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vAlpha;
void main() { gl_FragColor = vec4(uColor * vAlpha, vAlpha * 0.5); }`;

export const SNOW_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime, uSnowfall, uScale;
uniform vec3 uCenter, uFall, uBox;
varying float vAlpha;
void main() {
  float k = fract(aSeed.x * 91.7);
  vec3 p = aSeed.xyz * uBox + uFall * uTime * (0.7 + 0.6 * k);
  // Flakes wander sideways as they fall.
  p.x += sin(uTime * (0.6 + k) + aSeed.w * 30.0) * 0.45;
  p.z += cos(uTime * (0.5 + k * 0.8) + aSeed.w * 17.0) * 0.45;
  p = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.1);
  gl_PointSize = clamp((0.035 + 0.05 * aSeed.w) * uScale / dist, 1.0, 26.0);
  vAlpha = smoothstep(0.3, 1.5, dist) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, dist)) * step(fract(aSeed.z * 37.1), uSnowfall);
}`;
export const SNOW_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

/** Shadow pass for street objects: declarations. */
export const DEPTH_HEAD = /* glsl */ `
varying vec3 vCityWorld;
varying vec4 vSurf;
uniform vec3 uSunDir;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;
/** Shadow pass for street objects: leaves let light through in patches of two sizes. */
export const DEPTH_BODY = /* glsl */ `
if (vSurf.z > 4.5 && vSurf.z < 5.5 && vCityWorld.y > 1.3) {
  // The pattern is laid across the sun's rays, so every layer of leaves along one ray agrees
  // on where the gaps are, and light that enters a gap reaches the ground.
  vec3 across = vCityWorld - uSunDir * dot(vCityWorld, uSunDir);
  float gaps = dNoise(across * 1.5) * 0.6 + dNoise(across * 4.7 + 11.0) * 0.4;
  if (gaps < 0.47) discard;
}
`;
