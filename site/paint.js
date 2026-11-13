// Projects the flight onto two canvases (behind and in front of the character) through one
// perspective camera; the page draws the backdrop. Faces are lit per fold and depth-sorted; shadows fall on the backdrop along
// the light and soften with distance; trails are dashed and fade with age.
import { hsla } from 'explainerkit/color';
import { perspectiveCamera, projectPoints } from 'explainerkit/spatial';
import { DART, FOLD_TIME, placeDart } from './flight.js';

/**
 * The stage and its camera for a window shape: a wide room for landscape screens, and a taller,
 * closer framing of the same room for portrait ones. All placement follows from this camera.
 */
export function stageFor(width, height) {
  const tall = height > width * 1.05;
  const W = tall ? 900 : 1600, H = tall ? 1500 : 900;
  const eye = tall ? { x: 1, y: 1.6, z: 12.5 } : { x: .3, y: 1.3, z: 11 };
  const camera = perspectiveCamera({ ...eye, target: tall ? { x: 1, y: 2.6, z: 0 } : { x: .7, y: 1.8, z: 0 }, fov: tall ? .74 : .52, near: .1, far: 60 }, { width: W, height: H });
  return { W, H, eye, camera, tall, fit: tall ? [820, 1400] : [1450, 800] };
}
const LIGHT = norm([-.35, .85, .5]); // toward the key light, upper left and in front
const RAY = norm([-.1, -.24, -1]); // shadow rays travel away from the light
const WALL = -2.9, NP = DART.points.length;
const FOLD = { inner: 0, outer: 2, keel: -9 };

export function createPainter(back, front, stage) {
  const { W, H, camera, eye: EYE } = stage;
  const b = back.getContext('2d'), f = front.getContext('2d');
  const shade = document.createElement('canvas'), s = shade.getContext('2d');
  let ratio = 1, scale = 1, dx = 0, dy = 0, region = { x: 0, y: 0, w: W, h: H }, dark = false;
  /**
   * Papers for a dark page: light sheets become graphite and deep sage, a dark sheet becomes pale ash, and strong
   * colours (the predator) keep theirs. Contrast between papers is kept; only the ground they sit on changed.
   */
  const paperOf = ([h, sat, l]) => (dark && sat > 50 ? [214, 78, 55] : !dark || sat > 50 ? [h, sat, l] : h > 60 && h < 160 ? [28, 34, 36] : l > 60 ? [h, sat * .55, 20 + (l - 60) * .25] : [h, sat * .6, Math.min(70, 100 - l * 1.2)]);
  // (On the dark page the predator is blue and the sage sheets turn copper-amber: blue's complement, not green.)

  /**
   * Size the canvases. With `view` ({x, y, width, height}: the stage's top-left in the viewport and
   * the viewport's size, CSS px) they cover the whole viewport, so nothing is cut at the stage edge.
   */
  function resize(stageScale, view = null) {
    scale = stageScale;ratio = Math.min(devicePixelRatio || 1, 2);
    const width = view ? view.width : W * scale, height = view ? view.height : H * scale;
    dx = view ? view.x * ratio : 0;dy = view ? view.y * ratio : 0;
    region = view ? { x: -view.x / scale, y: -view.y / scale, w: view.width / scale, h: view.height / scale } : { x: 0, y: 0, w: W, h: H };
    for (const c of [back, front]) { c.width = Math.round(width * ratio);c.height = Math.round(height * ratio); }
    shade.width = Math.round(region.w / 4);shade.height = Math.round(region.h / 4);
  }

  /** Draw the flock at its current state. `depth` splits the planes behind and in front of the character. */
  /**
   * Draw the flock at its current state. `split` divides planes behind and in front of the figure.
   * Optional per-plane `fold`, `fade` and `shadow` arrays override folding, opacity and shadow strength (transitions);
   * `trails` scales the trails' opacity.
   */
  function paint(flight, { split, ripples, time, ground, fold = null, fade = null, shadow = fade, trails: trailAlpha = 1 }) {
    const n = flight.count, T = flight.TRAIL, world = new Float64Array((n * NP * 2 + n * T) * 3);
    for (let i = 0; i < n; i++) {
      // A new sheet folds into a plane: creases close over FOLD_TIME, easing out.
      const age = Math.min(1, Math.max(0, (time - flight.born[i]) / FOLD_TIME));
      placeDart(flight, i, world, i * NP * 3, Math.min(1 - (1 - age) ** 3, fold ? fold[i] : 1));
      // Each vertex's shadow: follow the light ray to the backdrop wall, or the floor if it is nearer.
      for (let j = 0; j < NP; j++) {
        const o = (i * NP + j) * 3, x = world[o], y = world[o + 1], z = world[o + 2];
        const t = Math.min((WALL - z) / RAY[2], -y / RAY[1]), so = (n * NP + i * NP + j) * 3;
        world[so] = x + RAY[0] * t;world[so + 1] = y + RAY[1] * t;world[so + 2] = z + RAY[2] * t;
      }
    }
    world.set(flight.trail.subarray(0, n * T * 3), n * NP * 2 * 3);
    const { positions: xy, cameraDepths: cd } = projectPoints(camera, world);

    const k = scale * ratio;
    for (const c of [b, f]) { c.setTransform(1, 0, 0, 1, 0, 0);c.clearRect(0, 0, back.width, back.height); }
    shadows(flight, xy, world, shadow);
    // The figure's contact shadow: a soft pool under its feet.
    s.setTransform(.25, 0, 0, .25, -region.x * .25, -region.y * .25);s.globalAlpha = (dark ? .55 : .3) * (ground.alpha ?? 1);s.fillStyle = dark ? hsla(0, 0, 0) : hsla(30, 22, 34);s.beginPath();s.ellipse(ground.x, ground.y, ground.w, ground.w * .16, 0, 0, 6.283);s.fill();s.globalAlpha = 1;
    b.setTransform(k, 0, 0, k, dx, dy);b.filter = 'blur(5px)';b.globalAlpha = 1;b.drawImage(shade, region.x, region.y, region.w, region.h);b.filter = 'none';
    if (trailAlpha > 0) trails(b, flight, xy, k, trailAlpha, fade);

    // Every face of every plane, far to near.
    const faces = [];
    for (let i = 0; i < n; i++) {
      for (const [p, q, r, fold] of DART.faces) {
        const a = (i * NP + p) * 3, c = (i * NP + q) * 3, d = (i * NP + r) * 3;
        faces.push({ i, p: i * NP + p, q: i * NP + q, r: i * NP + r, fold, depth: (cd[i * NP + p] + cd[i * NP + q] + cd[i * NP + r]) / 3, normal: faceNormal(world, a, c, d) });
      }
    }
    faces.sort((u, v) => v.depth - u.depth);
    for (const face of faces) {
      const ctx = face.depth > split ? b : f, [h, sat, l] = paperOf(flight.paper[face.i]), alpha = fade ? fade[face.i] : 1;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      // Shade the side the camera sees: lit by the key light, with a little light through thin paper.
      const cx = world[face.p * 3], cy = world[face.p * 3 + 1], cz = world[face.p * 3 + 2];
      let [nx, ny, nz] = face.normal;
      if (nx * (EYE.x - cx) + ny * (EYE.y - cy) + nz * (EYE.z - cz) < 0) { nx = -nx;ny = -ny;nz = -nz; }
      const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], light = lit > 0 ? lit : -lit * .28;
      const tone = Math.max(8, Math.min(97, l * (.8 + .22 * light) + FOLD[face.fold]));
      ctx.setTransform(k, 0, 0, k, dx, dy);ctx.beginPath();
      ctx.moveTo(xy[face.p * 2], xy[face.p * 2 + 1]);ctx.lineTo(xy[face.q * 2], xy[face.q * 2 + 1]);ctx.lineTo(xy[face.r * 2], xy[face.r * 2 + 1]);ctx.closePath();
      ctx.fillStyle = hsla(h, sat, tone);ctx.fill();
      ctx.lineWidth = .7;ctx.lineJoin = 'round';ctx.strokeStyle = dark ? hsla(h, sat, Math.min(92, tone + 26), .4) : hsla(h, sat, Math.max(4, tone - 30), .45);ctx.stroke(); // on dark, folds catch the lightctx.globalAlpha = 1;
    }
    for (const r of ripples) ripple(f, r, time, k);
  }

  function shadows(flight, xy, world, fade) {
    s.setTransform(1, 0, 0, 1, 0, 0);s.clearRect(0, 0, shade.width, shade.height);s.setTransform(.25, 0, 0, .25, -region.x * .25, -region.y * .25);
    const n = flight.count;
    for (let i = 0; i < n; i++) {
      // Shadows of nearer planes are fainter: they fall further from the plane, through more light.
      const fall = Math.hypot(world[(n * NP + i * NP) * 3] - world[i * NP * 3], world[(n * NP + i * NP) * 3 + 1] - world[i * NP * 3 + 1], world[(n * NP + i * NP) * 3 + 2] - world[i * NP * 3 + 2]);
      s.globalAlpha = Math.max(.04, .2 - fall * .022) * (dark ? 1.8 : 1) * (fade ? fade[i] : 1);s.fillStyle = dark ? hsla(0, 0, 0) : hsla(30, 22, 34);
      for (const [p, q, r] of DART.faces) {
        const a = n * NP + i * NP;
        s.beginPath();s.moveTo(xy[(a + p) * 2], xy[(a + p) * 2 + 1]);s.lineTo(xy[(a + q) * 2], xy[(a + q) * 2 + 1]);s.lineTo(xy[(a + r) * 2], xy[(a + r) * 2 + 1]);s.fill();
      }
    }
    s.globalAlpha = 1;
  }

  function trails(ctx, flight, xy, k, alpha, fade) {
    const n = flight.count, T = flight.TRAIL, base = n * NP * 2;
    ctx.setTransform(k, 0, 0, k, dx, dy);ctx.setLineDash([5, 7]);ctx.lineWidth = 1.15;ctx.lineCap = 'round';
    for (let i = 0; i < n; i += 1) {
      if (i % 3 === 2) continue; // not every plane leaves a trail; the picture stays quiet
      const [h, sat] = i === 0 ? flight.paper[0] : [30, 8];
      // Three pieces, older ones fainter.
      for (let piece = 0; piece < 3; piece++) {
        ctx.beginPath();
        for (let m = piece * 15; m <= Math.min(T - 1, piece * 15 + 15); m++) {
          const at = base + i * T + (flight.head + 1 + m) % T;
          if (m === piece * 15) ctx.moveTo(xy[at * 2], xy[at * 2 + 1]); else ctx.lineTo(xy[at * 2], xy[at * 2 + 1]);
        }
        ctx.strokeStyle = hsla(h, sat, i === 0 ? 55 : dark ? 62 : 40, [.08, .2, .38][piece] * alpha * (fade ? fade[i] : 1));ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  function ripple(ctx, r, time, k) {
    const age = time - r.at;
    if (age < 0 || age > 1.4) return;
    ctx.setTransform(k, 0, 0, k, dx, dy);
    for (let ring = 0; ring < 3; ring++) {
      const a = Math.max(0, age - ring * .12), e = 1 - Math.pow(1 - Math.min(a / 1.1, 1), 3);
      ctx.beginPath();ctx.arc(r.x, r.y, 8 + e * (30 + ring * 16), 0, 6.283);
      ctx.lineWidth = 1.4;ctx.strokeStyle = (dark ? hsla(214, 78, 56, .55 * (1 - e)) : hsla(10, 78, 56, .55 * (1 - e)));ctx.stroke();
    }
  }

  return {
    paint, resize,
    /** Dark papers and deeper shadows, for a dark page (see paperOf). */
    setDark(on) { dark = !!on; },
  };
}

function norm(v) { const l = Math.hypot(...v);return v.map((x) => x / l); }
function faceNormal(w, a, b, c) {
  const ux = w[b] - w[a], uy = w[b + 1] - w[a + 1], uz = w[b + 2] - w[a + 2], vx = w[c] - w[a], vy = w[c + 1] - w[a + 1], vz = w[c + 2] - w[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
