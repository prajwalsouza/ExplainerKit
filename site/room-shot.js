// The Room chapter: the live chart turns out to hang on the wall of a real room.
//
// The footage is a recorded camera move through a dining room, played backwards so the camera pulls away from
// the wall. scripts/landing/solve-room.py recovered the camera for every frame with COLMAP, and scripts/landing/fit-room.py set the
// room in metres: the table top 0.75 m above the floor, the wall found from a tracked socket and the baseboard.
// The page reads that track, builds an ExplainerKit camera for the frame on screen, and places three things with it:
// the chart on the wall (a perspective transform of the chart's own canvas), clay and paper objects on the table
// (Three.js, lit like the room and shadowed on the tabletop), and whatever the reader sets down with a tap.
//
// The pull-back is two moves at once. The footage's own camera backs away from the wall, and the page widens its
// crop of the picture on a log scale, so the chart that filled the screen settles into a picture on the wall.
import * as T from 'three';
import { hsla, toRGBA } from 'explainerkit/color';
import { randomAt } from 'explainerkit/noise';
import { fall } from 'explainerkit/physics';
import { perspectiveCamera, projectPoint, screenRay, rayPlane } from 'explainerkit/spatial';
import { surfaceTransform } from 'explainerkit/vfx';
import { logZoom } from 'explainerkit/zoom';
import { createGarden } from './room-garden.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const v = clamp((x - a) / (b - a));return v * v * (3 - 2 * v); };
const mix = (a, b, t) => a + (b - a) * t;
const asset = (extension) => new URL(`./media/room.${extension}`, import.meta.url);
// Safari, Chrome and Edge play H.264 everywhere, and many iPhones cannot play VP9, so the MP4 is used wherever H.264
// plays. A browser without H.264, such as some Firefox builds, gets the WebM.
const FOOTAGE = document.createElement('video').canPlayType('video/mp4; codecs="avc1.640029"') ? 'mp4' : 'webm';
const POSTER = 1024;
// The chart's place on the wall, in metres: centre and half size. The wall is the plane z = wall.point[2].
const CHART = { x: .92, y: 1.3, half: .68 };
// Objects on the table are modelled at desk-toy size and shown this much larger, so they read across the room.
const SIZE = 1.75;
// Where the picture's own pillar sits in the last frame, the edge the next chapter wipes from.
const PILLAR = { x: 1610, y: 540, width: 600 };

function tint(h, s, l) {
  const [r, g, b] = toRGBA(hsla(h, s, l));
  return new T.Color().setRGB(r, g, b, T.SRGBColorSpace);
}
const cssMatrix = ([a, b, c, d, e, f, g, h]) => `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(',')})`;

/** The footage's camera for one frame, as an ExplainerKit spatial camera: position, aim and lens from the solve. */
function cameraFor({ rotation, translation }, track) {
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = rotation, [tx, ty, tz] = translation, { width, height, intrinsics } = track;
  const x = -(xx * tx + yx * ty + zx * tz), y = -(xy * tx + yy * ty + zy * tz), z = -(xz * tx + yz * ty + zz * tz);
  return perspectiveCamera({ x, y, z, target: { x: x + zx, y: y + zy, z: z + zz }, up: { x: -yx, y: -yy, z: -yz }, fov: 2 * Math.atan(height / (2 * intrinsics.fy)), aspect: width / height, near: .02, far: 30 }, { width, height });
}

// ---- Things on the table ------------------------------------------------------------------------------------
/** A folded paper boat: a hull of two sloped sides and two ends, and the peak folded up from it. */
function boatGeometry() {
  const L = .11, B = .045, h = .045, top = .016, peak = .085;
  const v = [
    [-L, h, -B], [L, h, -B], [L * .62, 0, -B * .55], [-L * .62, 0, -B * .55],
    [-L, h, B], [L, h, B], [L * .62, 0, B * .55], [-L * .62, 0, B * .55],
    [-L * .5, h, 0], [L * .5, h, 0], [0, h + peak, 0],
  ];
  const faces = [[0, 1, 2], [0, 2, 3], [5, 4, 7], [5, 7, 6], [3, 2, 6], [3, 6, 7], [1, 5, 6], [1, 6, 2], [4, 0, 3], [4, 3, 7], [8, 9, 10], [9, 8, 10]];
  const positions = [];
  for (const f of faces) for (const k of f) positions.push(...v[k]);
  // the sail stands up across the hull's middle: tilt one face to each side
  const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  const p = g.getAttribute('position');
  for (let i = 30; i < 33; i++) if (p.getY(i) < h + .001) p.setZ(i, -top);
  for (let i = 33; i < 36; i++) if (p.getY(i) < h + .001) p.setZ(i, top);
  g.computeVertexNormals();
  return g;
}
/** A paper dart: two wings either side of a keel, nose forward along +x. */
function planeGeometry() {
  const n = [.15, .012, 0], tail = -.13, span = .085, keel = -.026;
  const positions = [
    ...n, tail, .014, -span, tail, .012, 0,
    ...n, tail, .012, 0, tail, .014, span,
    ...n, tail, .012, 0, tail, keel, 0,
  ];
  const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));g.computeVertexNormals();
  return g;
}
function globe(material) {
  const group = new T.Group();
  const sphere = new T.IcosahedronGeometry(.075, 3), colours = [], p = sphere.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), land = randomAt('room-globe', Math.round(x * 40), Math.round(y * 40) * 97 + Math.round(z * 40)) > .58;
    const c = land ? tint(104 + 18 * randomAt('room-land', i, 1), 32, 46) : tint(203, 52, 50);colours.push(c.r, c.g, c.b);
  }
  sphere.setAttribute('color', new T.Float32BufferAttribute(colours, 3));
  const earth = new T.Mesh(sphere, new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }));
  earth.position.y = .118;earth.rotation.z = .41;earth.castShadow = true;
  const stand = new T.Mesh(new T.CylinderGeometry(.02, .045, .03, 18), material(28, 34, 34));stand.position.y = .015;stand.castShadow = stand.receiveShadow = true;
  const neck = new T.Mesh(new T.CylinderGeometry(.006, .006, .05, 8), material(36, 30, 52));neck.position.y = .05;neck.castShadow = true;
  const ring = new T.Mesh(new T.TorusGeometry(.098, .0035, 6, 48), material(40, 52, 58));ring.position.y = .118;ring.rotation.set(1.2, 0, .41);ring.castShadow = true;
  group.add(stand, neck, earth, ring);
  group.userData.spin = earth;
  return group;
}
function houses(material) {
  const group = new T.Group();
  [[0, 0, .05, .055, .06, 18], [.075, -.035, .042, .05, .085, 12], [-.06, -.05, .04, .045, .045, 33]].forEach(([x, z, w, d, h, hue], i) => {
    const body = new T.Mesh(new T.BoxGeometry(w, h, d), material(hue, 38, 72 - i * 5));body.position.set(x, h / 2, z);
    // a gable roof: a triangle across the house's width, drawn out along its depth
    const gable = new T.Shape([new T.Vector2(-w * .58, 0), new T.Vector2(w * .58, 0), new T.Vector2(0, w * .45)]);
    const roof = new T.Mesh(new T.ExtrudeGeometry(gable, { depth: d * 1.08, bevelEnabled: false }), material(10 + i * 4, 52, 46));
    roof.position.set(x, h, z - d * .54);
    for (const m of [body, roof]) { m.castShadow = true;m.receiveShadow = true;group.add(m); }
  });
  return group;
}

// ---- How things land --------------------------------------------------------------------------------------
const REST = Object.freeze({ y: 0, dx: 0, dz: 0, rx: 0, ry: 0, rz: 0, squash: 1 });
const DROP = .62, G = 9.81;
const paperFall = fall({ from: DROP, to: 0, terminal: 1.05, ramp: .1 });
// Each thing's body on the table, at its shown size: how far it reaches from its centre, how tall it stands and
// how heavy it is. Paper is light and gets pushed about; clay pushes.
const BODY = {
  boat: { r: .17, top: .22, mass: .3, e: .2 },
  plane: { r: .14, top: .05, mass: .2, e: .1 },
  globe: { r: .15, top: .34, mass: 1, e: .3 },
  houses: { r: .2, top: .17, mass: 1.4, e: .2 },
};
/** Where a thing is `age` seconds after it was let go: height, drift, tilt and squash. Paper and clay differ. */
function landing(kind, age, seed) {
  if (age < 0) return { ...REST, y: DROP };
  const phase = randomAt('room-drop', seed, 1) * 6.28, side = randomAt('room-drop', seed, 2) - .5;
  if (kind === 'boat' || kind === 'plane') {
    // Paper: near its terminal speed almost at once, swinging side to side as it falls, then rocking to rest.
    const air = paperFall.state(Math.min(age, paperFall.duration)), down = paperFall.duration, left = Math.max(0, 1 - age / down);
    const swing = Math.sin(age * 7.5 + phase) * left;
    if (age < down) return { y: air.value, dx: .05 * swing + side * .04 * left, dz: .03 * Math.cos(age * 6 + phase) * left, rx: .32 * swing, ry: .4 * side * left, rz: .22 * Math.cos(age * 7.5 + phase) * left, squash: 1 };
    const t = age - down, rock = Math.exp(-5.5 * t) * Math.cos(16 * t);
    return { ...REST, rx: .1 * rock * Math.sign(side || 1), rz: .06 * rock };
  }
  // Clay: free fall, then bounces that lose most of their speed each time, with a brief squash at each landing.
  const e = .3, first = Math.sqrt(2 * DROP / G);
  if (age < first) return { ...REST, y: DROP - .5 * G * age * age };
  let t = age - first, v = G * first * e, impact = t;
  while (v > .05) { const flight = 2 * v / G;if (t < flight) return { ...REST, y: v * t - .5 * G * t * t, squash: 1 - .1 * Math.exp(-impact * 40) }; t -= flight;impact = t;v *= e; }
  return { ...REST, squash: 1 - .1 * Math.exp(-t * 40) * (t < .2 ? 1 : 0) };
}

/**
 * `host` is a fixed layer over the stage. `grab(ctx, size)` draws the live chart, as it is on screen now, into a
 * square of `size` pixels: the poster that hangs on the wall. Returns the chapter's controller.
 */
export function createRoomShot(host, credit, { grab }) {
  const frame = document.createElement('div');frame.className = 'room-frame';
  // The video is never shown itself. Each decoded frame is drawn onto the plate in the same callback that moves the
  // chart and renders the 3D, so the picture and everything placed in it change together and the last good frame
  // stays up while the next one is decoded.
  // It stays rendered, tiny and nearly transparent, because iOS Safari may not decode frames for a video that is not.
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', className: 'footage-source' });
  const plate = Object.assign(document.createElement('canvas'), { className: 'room-plate' });
  const poster = Object.assign(document.createElement('canvas'), { width: POSTER, height: POSTER, className: 'room-poster' });
  const gl = Object.assign(document.createElement('canvas'), { className: 'room-gl' });
  const shade = document.createElement('div');shade.className = 'footage-shade';
  frame.append(plate, poster, gl);host.append(frame, shade);
  // The host is hidden until the chapter is ready, so the video lives on the page body, where it stays rendered.
  document.body.append(video);
  const pen = poster.getContext('2d'), board = plate.getContext('2d', { alpha: false });
  const controls = document.createElement('div');
  controls.className = 'footage-controls';controls.hidden = true;controls.setAttribute('role', 'group');controls.setAttribute('aria-label', 'Room footage');
  controls.innerHTML = '<button class="footage-play" type="button" aria-label="Play footage" title="Play footage"></button><input type="range" min="0" step="1" value="0" aria-label="Footage position">';
  document.body.append(controls);
  const button = controls.querySelector('button'), scrubber = controls.querySelector('input');

  let garden = null, pointerRay = null, contact = null, track = null, failed = false, renderer = null, scene = null, camera3 = null, things = [], table = null, light = null;
  // `manual` holds the frame the reader chose with the controls, until the reader scrolls again.
  let primed = false, lastU = -1, manual = null, posterPainted = false, requested = 0, shown = -1, progress = -1, active = false, dirty = true, lastPaint = -1, clock = 0, lastTime = null, view = null;
  const placed = [];
  let placedCount = 0;

  fetch(asset('json')).then((r) => (r.ok ? r.json() : Promise.reject(Error('no track')))).then((json) => {
    track = json;
    frame.style.width = `${track.width}px`;frame.style.height = `${track.height}px`;
    plate.width = track.width;plate.height = track.height;scrubber.max = track.frames.length - 1;
    build();video.src = asset(FOOTAGE).href;
  }).catch(() => { failed = true; });
  /** A new frame is on the video: draw it, and move everything placed in it to the same frame. */
  function present(mediaTime) {
    if (!track || video.readyState < 2) return;
    const f = clamp(Math.round(mediaTime * track.fps), 0, track.frames.length - 1);
    board.drawImage(video, 0, 0, track.width, track.height);
    shown = f;render(f, progress);lastPaint = f;
    scrubber.value = f;scrubber.style.setProperty('--played', `${100 * f / (track.frames.length - 1)}%`);
  }
  if ('requestVideoFrameCallback' in video) {
    const next = (now, meta) => { present(meta.mediaTime);video.requestVideoFrameCallback(next); };
    video.requestVideoFrameCallback(next);
  } else {
    video.addEventListener('seeked', () => present(video.currentTime));
    video.addEventListener('timeupdate', () => { if (!video.paused) present(video.currentTime); });
  }
  // Safari may not report a frame callback for a paused seek, so a finished seek also draws its frame.
  video.addEventListener('seeked', () => { present(video.currentTime);seek(); });
  video.addEventListener('loadeddata', () => { present(video.currentTime);seek(); });
  video.addEventListener('error', () => { failed = true; });
  const sync = () => { const label = video.paused ? 'Play footage' : 'Pause footage';button.setAttribute('aria-label', label);button.title = label;button.toggleAttribute('data-playing', !video.paused); };
  for (const event of ['play', 'pause', 'ended']) video.addEventListener(event, sync);
  button.addEventListener('click', () => {
    if (!video.paused) { video.pause();return; }
    manual = { u: progress };
    if (shown >= track.frames.length - 1) video.currentTime = 0;
    void video.play().catch(sync);
  });
  scrubber.addEventListener('input', () => { video.pause();manual = { u: progress, frame: scrubber.valueAsNumber };seek(); });

  function build() {
    renderer = new T.WebGLRenderer({ canvas: gl, alpha: true, antialias: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));renderer.setSize(track.width, track.height, false);
    renderer.outputColorSpace = T.SRGBColorSpace;renderer.shadowMap.enabled = true;renderer.shadowMap.type = T.VSMShadowMap;
    renderer.setClearColor(0, 0);
    scene = new T.Scene();
    camera3 = new T.PerspectiveCamera(50, track.width / track.height, .02, 30);camera3.matrixAutoUpdate = false;
    // The room's light, read from the footage: daylight diffused by tall curtains behind the table and to its
    // right, high and soft, so the bowl on the real table has a short, blurred shadow falling a little toward the
    // camera and its near side is in shade. A cool sky from the glass, a warm bounce from the wooden floor and
    // table, and one soft key from up behind the curtains.
    scene.add(new T.HemisphereLight(tint(205, 25, 86), tint(26, 40, 34), .95));
    const bounce = new T.DirectionalLight(tint(28, 50, 62), .35);bounce.position.set(-1, -.4, 3);scene.add(bounce);
    light = new T.DirectionalLight(tint(40, 30, 95), 1.9);light.position.set(3.2, 5.2, -3.4);light.target.position.set(1.5, 0, 0);
    light.castShadow = true;light.shadow.mapSize.set(1024, 1024);light.shadow.radius = 14;light.shadow.blurSamples = 24;light.shadow.bias = -.0006;
    Object.assign(light.shadow.camera, { left: -2.2, right: 2.2, top: 1.8, bottom: -1.8, near: 1, far: 12 });
    scene.add(light, light.target);
    // Daylight also grazes the long wall from the window at its right, which is what lets the garden cast shadows
    // onto the wall and the floor.
    const graze = new T.DirectionalLight(tint(42, 36, 94), .7);graze.position.set(4.6, 3.1, .6);graze.target.position.set(-.3, .6, track.wall.point[2]);
    graze.castShadow = true;graze.shadow.mapSize.set(1024, 1024);graze.shadow.radius = 10;graze.shadow.blurSamples = 20;graze.shadow.bias = -.0008;
    Object.assign(graze.shadow.camera, { left: -2.6, right: 2.6, top: 2.2, bottom: -2.2, near: .5, far: 12 });
    scene.add(graze, graze.target);
    const wallZ = track.wall.point[2], floorY = track.floor;
    const wall = new T.Mesh(new T.PlaneGeometry(3.2, 3.4), new T.ShadowMaterial({ opacity: .28, color: tint(24, 30, 14) }));
    wall.position.set(.45, floorY + 1.7, wallZ + .004);wall.receiveShadow = true;scene.add(wall);
    const floor = new T.Mesh(new T.PlaneGeometry(1.6, 1.2).rotateX(-Math.PI / 2), new T.ShadowMaterial({ opacity: .32, color: tint(24, 30, 14) }));
    floor.position.set(-.55, floorY + .002, wallZ + .6);floor.receiveShadow = true;scene.add(floor);
    // The real table hides what is behind or under it: an invisible slab in its place writes depth only.
    const slab = new T.Shape(), sr = .52, sa = .35, sb = 2.6;
    slab.absarc(sb, 0, sr, -Math.PI / 2, Math.PI / 2, false);slab.absarc(sa, 0, sr, Math.PI / 2, Math.PI * 1.5, false);
    const occluder = new T.Mesh(new T.ExtrudeGeometry(slab, { depth: .045, bevelEnabled: false }), new T.MeshBasicMaterial({ colorWrite: false }));
    occluder.rotation.x = Math.PI / 2;occluder.position.set(0, -.001, .22);occluder.renderOrder = -1;scene.add(occluder);
    garden = createGarden(T, scene, { wallZ, floorY, tint });
    // The tabletop takes the shadows and nothing else. Its outline is a stadium round the table's long axis.
    const shape = new T.Shape(), r = .52, a = .35, b = 2.6;
    shape.absarc(b, 0, r, -Math.PI / 2, Math.PI / 2, false);shape.absarc(a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    table = new T.Mesh(new T.ShapeGeometry(shape, 24), new T.ShadowMaterial({ opacity: .5, color: tint(18, 45, 10) }));
    table.rotation.x = Math.PI / 2;table.position.set(0, .001, .22);table.receiveShadow = true;scene.add(table);
    const material = (h, s, l) => new T.MeshStandardMaterial({ color: tint(h, s, l), roughness: .82, flatShading: true });
    // Where each thing touches the table, a soft dark patch: the light the table cannot get there.
    const soft = document.createElement('canvas');soft.width = soft.height = 64;
    const g = soft.getContext('2d'), ramp = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    ramp.addColorStop(0, 'rgba(0,0,0,1)');ramp.addColorStop(.45, 'rgba(0,0,0,.55)');ramp.addColorStop(1, 'rgba(0,0,0,0)');g.fillStyle = ramp;g.fillRect(0, 0, 64, 64);
    const patch = new T.CanvasTexture(soft), flat = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    contact = (x, z, foot) => { const blob = new T.Mesh(flat, new T.MeshBasicMaterial({ map: patch, transparent: true, depthWrite: false, color: tint(20, 40, 8), opacity: 0 }));blob.position.set(x, .002, z);blob.userData.foot = foot;blob.renderOrder = 1;scene.add(blob);return blob; };
    // Paper lets some of the window through, so its shaded side is never as dark as clay's.
    const paper = new T.MeshStandardMaterial({ color: tint(44, 40, 95), roughness: .9, flatShading: true, side: T.DoubleSide, emissive: tint(40, 40, 70), emissiveIntensity: .18 });
    const add = (object, x, z, turn, at, kind, foot = .1) => { object.position.set(x, 0, z);object.rotation.y = turn;object.traverse((m) => { if (m.isMesh) { m.castShadow = true;m.receiveShadow = true; } });object.visible = false;scene.add(object);things.push({ object, at, kind, x, z, x0: x, z0: z, turn, blob: contact(x, z, foot), born: null, seed: things.length }); };
    const boat = new T.Mesh(boatGeometry(), paper);add(boat, .6, -.1, .5, .3, 'boat', .2);
    const dart = new T.Mesh(planeGeometry(), new T.MeshStandardMaterial({ color: tint(214, 74, 56), roughness: .8, flatShading: true, side: T.DoubleSide }));
    dart.userData.lean = .12;add(dart, 1.12, -.3, -.7, .34, 'plane', .16);
    add(globe(material), 1.98, -.12, .3, .38, 'globe', .13);
    add(houses(material), 2.5, -.2, -.4, .42, 'houses', .26);
    const second = new T.Mesh(boatGeometry(), new T.MeshStandardMaterial({ color: tint(8, 70, 56), roughness: .85, flatShading: true, side: T.DoubleSide }));
    add(second, 1.0, .1, 2.3, .46, 'boat', .2);
  }

  function seek() {
    if (!track || video.readyState < 1 || video.seeking || !active || !video.paused) return;
    const want = manual?.frame ?? (manual ? shown : requested);
    if (want === shown || want < 0) return;
    video.currentTime = (want + .5) / track.fps;
  }

  /** Screen placement of the frame: a zoom about a point of the picture, which lands on a point of the screen. */
  function placement(u, chart) {
    const vw = innerWidth, vh = innerHeight, cover = Math.max(vw / track.width, vh / track.height);
    const quad = view?.quad;
    const qx = quad ? (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4 : 500, qy = quad ? (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4 : 300;
    const qs = quad ? (Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y) + Math.hypot(quad[3].y - quad[0].y, quad[3].x - quad[0].x)) / 2 : 300;
    // the start: the wall's chart exactly where the page's chart was, and just as large
    const start = { zoom: (2 * chart.r) / (qs * .86), fx: qx, fy: qy, sx: chart.x, sy: chart.y };
    // the room: cover the screen. A tall crop cannot hold the wall and the table at once, so it pans from the
    // chart to the things on the table as they arrive.
    const table = view?.table?.x ?? 1100, focus = { x: vw / vh < 1 ? mix(Math.min(qx, 800), table, smooth(.42, .7, u)) : track.width / 2, y: track.height / 2 };
    const fit = { zoom: cover, fx: focus.x, fy: focus.y, sx: vw / 2, sy: vh / 2 };
    // the exit: into the pillar that slides across the end of the shot, until it fills the screen
    const out = { zoom: Math.max(vw / (PILLAR.width * .78), vh / (track.height * .7)), fx: PILLAR.x, fy: PILLAR.y, sx: vw / 2, sy: vh / 2 };
    const e = smooth(.03, .62, u), x = smooth(.88, 1, u);
    let zoom = logZoom(start.zoom, fit.zoom, e), fx = mix(start.fx, fit.fx, e), fy = mix(start.fy, fit.fy, e), sx = mix(start.sx, fit.sx, e), sy = mix(start.sy, fit.sy, e);
    if (x > 0) { zoom = logZoom(zoom, out.zoom, x);fx = mix(fx, out.fx, x);fy = mix(fy, out.fy, x);sx = mix(sx, out.sx, x);sy = mix(sy, out.sy, x); }
    // never show past the picture's edges
    zoom = Math.max(zoom, cover);
    const tx = clamp(sx - fx * zoom, vw - track.width * zoom, 0), ty = clamp(sy - fy * zoom, vh - track.height * zoom, 0);
    return { zoom, tx, ty };
  }

  function paintPoster() {
    pen.setTransform(1, 0, 0, 1, 0, 0);pen.clearRect(0, 0, POSTER, POSTER);
    grab(pen, POSTER);
  }

  function render(f, u) {
    const sample = track.frames[clamp(f, 0, track.frames.length - 1)], cam = cameraFor(sample, track);
    const wz = track.wall.point[2], { x, y, half } = CHART;
    const quad = [[x - half, y + half], [x + half, y + half], [x + half, y - half], [x - half, y - half]].map(([qx, qy]) => projectPoint(cam, { x: qx, y: qy, z: wz }));
    view = { cam, quad, table: projectPoint(cam, { x: 1.62, y: 0, z: -.1 }) };
    // The chart: its canvas mapped onto the wall's quad in the picture.
    poster.style.transform = cssMatrix(surfaceTransform(quad.map((p) => ({ x: p.x, y: p.y })), POSTER, POSTER));
    // The 3D: the same camera, given to Three.js as a world matrix and a projection.
    const { rotation: Rm, translation: t } = sample, { fx, fy, cx, cy } = track.intrinsics, W = track.width, H = track.height, near = .02, far = 30;
    const inv = new T.Matrix4().set(Rm[0], Rm[1], Rm[2], t[0], Rm[3], Rm[4], Rm[5], t[1], Rm[6], Rm[7], Rm[8], t[2], 0, 0, 0, 1);
    // COLMAP's camera looks down +z with y down; Three's looks down -z with y up.
    const flip = new T.Matrix4().makeScale(1, -1, -1);
    camera3.matrixWorld.copy(inv.clone().premultiply(flip).invert());camera3.matrixWorldInverse.copy(camera3.matrixWorld).invert();
    camera3.projectionMatrix.set(2 * fx / W, 0, 1 - 2 * cx / W, 0, 0, 2 * fy / H, 2 * cy / H - 1, 0, 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near), 0, 0, -1, 0);
    camera3.projectionMatrixInverse.copy(camera3.projectionMatrix).invert();
    // Each thing is let go above the table when the story reaches it, and falls in real time. Clay falls under
    // gravity and bounces a little; paper is slowed by the air, rocks as it comes down and settles flat. Scrolling
    // back above a thing's moment lifts it away, ready to fall again.
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const thing of things.concat(placed)) {
      if (thing.at !== undefined) {
        if (u >= thing.at && thing.born === null) thing.born = clock;
        if (u < thing.at - .01 && thing.born !== null) Object.assign(thing, { born: null, x: thing.x0, z: thing.z0, vx: 0, vz: 0, knock: null });
      }
      const age = thing.born === null ? -1 : clock - thing.born, pose = still ? REST : landing(thing.kind, age, thing.seed);
      const o = thing.object;o.visible = age >= 0;o.scale.set(SIZE, SIZE * pose.squash, SIZE);
      o.position.set(thing.x + pose.dx, pose.y, thing.z + pose.dz);thing.y = pose.y;
      // a knock tips a thing away from what hit it, and it rocks back onto its base
      const k = thing.knock ? thing.knock.size * Math.exp(-6 * (clock - thing.knock.at)) * Math.cos(13 * (clock - thing.knock.at)) : 0;
      o.rotation.set(pose.rx + k * (thing.knock?.z ?? 0), thing.turn + pose.ry, (o.userData.lean ?? 0) + pose.rz - k * (thing.knock?.x ?? 0), 'YXZ');
      if (o.userData.spin) o.userData.spin.rotation.y = clock * .4 + thing.turn;
      if (thing.blob) { const near = 1 - clamp(pose.y / .25);thing.blob.material.opacity = age >= 0 ? .82 * near * near : 0;thing.blob.scale.setScalar(thing.blob.userData.foot * SIZE * (1.5 - .55 * near));thing.blob.position.set(thing.x + pose.dx, .002, thing.z + pose.dz); }
    }
    renderer.render(scene, camera3);
  }

  /**
   * Contact on the tabletop. Things that overlap, at heights that overlap, push apart: each takes an impulse along
   * the line between their centres, shared by mass, and any overlap left is moved out at once. A thing falling
   * onto another glances off it and knocks it aside. On the table, friction brings sliding things to rest. The
   * real bowl is a fixed obstacle, and the table's edge stops what reaches it.
   */
  function settle(dt) {
    const bodies = things.concat(placed).filter((t) => t.born !== null && clock >= t.born);
    if (!bodies.length || dt <= 0) return;
    const bowl = { x: track.table.bowl[0], z: track.table.bowl[2], r: .17, top: .12, mass: Infinity, y: 0, fixed: true };
    const steps = 4, h = dt / steps;
    for (const b of bodies) { const body = BODY[b.kind];Object.assign(b, { r: body.r, top: body.top, mass: body.mass, e: body.e });b.vx ??= 0;b.vz ??= 0;b.y ??= DROP; }
    for (let step = 0; step < steps; step++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j <= bodies.length; j++) {
          const a = bodies[i], b = j === bodies.length ? bowl : bodies[j];
          if (a.y > b.y + b.top || b.y > a.y + a.top) continue;
          let nx = b.x - a.x, nz = b.z - a.z, d = Math.hypot(nx, nz);
          const reach = a.r + b.r;if (d >= reach) continue;
          if (d < 1e-4) { nx = Math.cos(a.seed);nz = Math.sin(a.seed);d = 1e-4; } else { nx /= d;nz /= d; }
          const wa = 1 / a.mass, wb = b.fixed ? 0 : 1 / b.mass, overlap = reach - d;
          a.x -= nx * overlap * wa / (wa + wb);a.z -= nz * overlap * wa / (wa + wb);
          if (!b.fixed) { b.x += nx * overlap * wb / (wa + wb);b.z += nz * overlap * wb / (wa + wb); }
          // something coming down onto another lands with the speed of its fall, and part of that goes sideways
          const falling = Math.max(0, Math.abs(a.y - b.y) > .02 ? 1.2 : 0), closing = (a.vx - (b.vx ?? 0)) * nx + (a.vz - (b.vz ?? 0)) * nz + falling;
          if (closing <= 0) continue;
          const impulse = (1 + Math.min(a.e, b.fixed ? .3 : b.e)) * closing / (wa + wb);
          a.vx -= impulse * wa * nx;a.vz -= impulse * wa * nz;
          if (!b.fixed) { b.vx += impulse * wb * nx;b.vz += impulse * wb * nz; }
          const tip = Math.min(.35, impulse * .25);
          if (tip > .02) {
            a.knock = { size: Math.min(.35, tip * wa / (wa + wb) * 2), x: -nx, z: -nz, at: clock };
            if (!b.fixed) b.knock = { size: Math.min(.35, tip * wb / (wa + wb) * 2), x: nx, z: nz, at: clock };
          }
        }
      }
      for (const b of bodies) {
        if (b.y < .015) {
          // sliding friction on the wooden top: about a third of gravity, against the motion
          const speed = Math.hypot(b.vx, b.vz), slow = Math.min(speed, .35 * G * h);
          if (speed > 0) { b.vx -= b.vx / speed * slow;b.vz -= b.vz / speed * slow; }
        }
        b.x += b.vx * h;b.z += b.vz * h;
        if (b.x < .35 || b.x > 2.8) { b.x = clamp(b.x, .35, 2.8);b.vx *= -.3; }
        if (b.z < -.45 || b.z > .15) { b.z = clamp(b.z, -.45, .15);b.vz *= -.3; }
      }
    }
  }

  function tapTable(clientX, clientY) {
    if (!view || !track || !active || progress < .35 || progress > .88) return false;
    const box = frame.getBoundingClientRect(), z = box.width / track.width;
    const p = { x: (clientX - box.left) / z, y: (clientY - box.top) / z };
    const hit = rayPlane(screenRay(view.cam, p), { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } });
    if (!hit) return false;
    // The near chairs' backs stand in front of the table's near half, so things are set on the open far half.
    const { x, z: hz } = hit.point, along = clamp(x, .4, 2.75), off = hz - .22;
    if (x < -.1 || x > 3.05 || Math.abs(off) > .55) return false;
    const wz = clamp(hz, -.42, .1);
    // Dropped exactly where the reader tapped: onto something already there, it glances off and knocks it aside.
    const spot = along;
    const n = placedCount++, kind = n % 3;
    const material = new T.MeshStandardMaterial({ color: tint([44, 8, 214][kind], [40, 70, 74][kind], [95, 56, 56][kind]), roughness: .85, flatShading: true, side: T.DoubleSide });
    const object = new T.Mesh(kind === 2 ? planeGeometry() : boatGeometry(), material);
    object.castShadow = object.receiveShadow = true;scene.add(object);
    placed.push({ object, born: clock, turn: randomAt('room-tap', n, 1) * 6.28, x: spot, z: wz, kind: kind === 2 ? 'plane' : 'boat', seed: 40 + n, blob: contact(spot, wz, kind === 2 ? .16 : .2) });
    if (placed.length > 6) { const old = placed.shift();scene.remove(old.object, old.blob); }
    dirty = true;return true;
  }
  host.addEventListener('pointerdown', (event) => { if (tapTable(event.clientX, event.clientY)) event.preventDefault(); });
  /** The pointer as a ray into the room, from the camera of the frame on screen. */
  host.addEventListener('pointermove', (event) => {
    if (!view || !track) return;
    const box = frame.getBoundingClientRect(), k = box.width / track.width;
    pointerRay = screenRay(view.cam, { x: (event.clientX - box.left) / k, y: (event.clientY - box.top) / k });
  });
  host.addEventListener('pointerleave', () => { pointerRay = null; });

  return {
    // Ready once a frame has been drawn. The video's own ready state dips during every seek, and the plate keeps
    // the last frame through those dips, so it must not hide the shot.
    get ready() { return !!track && shown >= 0; },
    get failed() { return failed; },
    /** The footage is on its way but has no frame yet: iOS in Low Power Mode waits for a tap before loading it. */
    get waiting() { return !!track && !failed && !!video.src && video.readyState < 2; },
    /** Start loading from a tap. iOS lets a tap start a video even when it blocks playback without one. */
    unlock() {
      if (failed || !video.src || video.readyState >= 2) return;
      const started = video.play();
      started?.then(() => { if (!manual) { video.pause();seek(); } }).catch(() => {});
    },
    get video() { return { src: video.currentSrc.split('/').pop(), readyState: video.readyState, networkState: video.networkState, error: video.error?.code ?? null, paused: video.paused, primed, failed, track: !!track }; },
    /** For checks: the frame on screen, the quad the chart fills, and what stands on the table. */
    get status() { return { ready: this.ready, shown, requested, quad: view?.quad, bodies: things.concat(placed).filter((t) => t.born !== null).map((t) => ({ kind: t.kind, x: +t.x.toFixed(3), z: +t.z.toFixed(3), y: +(t.y ?? 0).toFixed(3) })) }; },
    /** For checks: where a point on the table is on screen now, in CSS pixels. */
    screenOf(x, z) { if (!view) return null;const p = projectPoint(view.cam, { x, y: 0, z }), box = frame.getBoundingClientRect(), k = box.width / track.width;return { x: box.left + p.x * k, y: box.top + p.y * k }; },
    /** The pillar that ends the shot, top to bottom, as measured from the last frame: the next chapter wipes from it. */
    pillar: ['hsl(190 36% 40%)', 'hsl(192 40% 33%)', 'hsl(195 46% 27%)'],
    /**
     * `u` runs from 0 to 1 through the chapter. `chart` is the live chart on screen when the chapter starts:
     * its centre and radius in CSS pixels. Returns how much of the screen the footage covers, from 0 to 1.
     */
    project(u, time, chart) {
      active = u > 0 && u < 1 && !failed;
      // iOS may not fetch a video until it has played, and this one is otherwise only ever seeked. A muted play,
      // paused at once, starts the download the first time the chapter opens.
      if (active && !primed && video.src && video.paused) {
        primed = true;
        video.play().then(() => { if (!manual) { video.pause();seek(); } }).catch(() => {});
      }
      const dt = lastTime === null ? 0 : Math.min(.1, Math.max(0, time - lastTime));lastTime = time;clock += dt;
      if (track && active) {
        settle(dt);
        if (garden) { garden.point(pointerRay, dt);garden.update(clock, dt, { tree: smooth(.28, .6, u), vine: smooth(.32, .66, u) }); }
      }
      if (!active || !this.ready) {
        host.hidden = true;credit.hidden = true;controls.hidden = true;host.style.pointerEvents = 'none';progress = u;
        if (!video.paused) video.pause();manual = null;return 0;
      }
      host.hidden = false;credit.hidden = !(u > .2 && u < .9);
      // Scrolling sets the frame, unless the reader is playing or scrubbing; scrolling on hands it back.
      if (manual && Math.abs(u - manual.u) > .012) { manual = null;video.pause(); }
      requested = Math.round((track.frames.length - 1) * clamp((u - .02) / .9));seek();
      progress = u;
      if (shown >= 0 && (u !== lastU || dirty || placed.length || !video.paused || u > .3)) { render(shown, u);lastU = u; }
      dirty = false;
      controls.hidden = !(u > .4 && u < .86);
      if (!controls.hidden) {
        const width = Math.min(innerWidth - 36, 300), chip = document.querySelector('.chip')?.getBoundingClientRect(), small = innerWidth < 700;
        const left = small ? 18 : innerWidth - 64 - width, clash = chip && chip.width && chip.right > left - 8, top = (clash ? chip.top : innerHeight - 30) - 58;
        controls.style.cssText = `left:${left}px;top:${Math.round(top)}px;width:${width}px`;
      }
      if (u < .25 || !posterPainted) { paintPoster();posterPainted = true; }
      const { zoom, tx, ty } = placement(u, chart);
      frame.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
      // The print is as soft as the footage on screen: about half a screen pixel, whatever the zoom.
      const q = view?.quad, across = q ? Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) / POSTER : .3;
      poster.style.filter = `blur(${(.55 / Math.max(1e-3, zoom * across)).toFixed(2)}px) saturate(.88)`;
      // The wall begins as the page: graded up to the paper's light (or down to the night page's), then let go.
      const grade = mix(document.documentElement.classList.contains('night') ? .2 : 1.92, 1, smooth(.02, .3, u));
      plate.style.filter = grade === 1 ? '' : `brightness(${grade.toFixed(3)}) sepia(${((grade - 1) * .12).toFixed(3)})`;
      // The room opens out of the chart: a circle that starts at the chart's rim and grows past the corners.
      const open = smooth(0, .12, u), reach = Math.hypot(Math.max(chart.x, innerWidth - chart.x), Math.max(chart.y, innerHeight - chart.y));
      const r = mix(chart.r * 1.02, reach * 1.05, open * open);
      host.style.clipPath = open >= 1 ? '' : `circle(${r.toFixed(1)}px at ${chart.x.toFixed(1)}px ${chart.y.toFixed(1)}px)`;
      shade.style.opacity = String(smooth(.3, .45, u) * (1 - smooth(.86, .92, u)));
      host.style.pointerEvents = u > .35 && u < .88 ? 'auto' : 'none';
      return open;
    },
  };
}
