import { assert, number, options } from '../core/validate.js';
import { grayFrame } from './frames.js';

// Motion fields measured from footage. `measureFlow` finds how a moving texture travels across the picture:
// water, cloud, smoke, a crowd or traffic. It divides the frame into a grid of small windows. For each window and
// each pair of consecutive frames it slides the window's patch over the next frame and scores the match at every
// offset. A single pair of frames of a changing texture gives a noisy answer, so the scores for a window are
// added up over the clip before the best offset is read off. The same procedure is used on video of rivers under
// the name large-scale particle image velocimetry.

const compiled = new WeakSet();
const UNKNOWN = 0,
  STILL = 1,
  MOVING = 2;
const WORK_LIMIT = 9e10;
const WORK_TARGET = 2.5e10;
const TEXTURE = 30;
const FILLED = 0.12;

/** Read one entry of a caller's array without running an accessor. */
function entry(values, index, name) {
  if (ArrayBuffer.isView(values)) return values[index];
  const slot = Object.getOwnPropertyDescriptor(values, index);
  assert(slot && 'value' in slot, 'INVALID_DATA', `${name} must be plain data.`);
  return slot.value;
}

function whole(value, name, min, max) {
  const n = number(value, name, min, max);
  assert(Number.isInteger(n), 'INVALID_OPTIONS', `Use a whole number for ${name}.`);
  return n;
}

/** Add one frame pair's match scores to each window's plane. Windows in `b` are displaced by the camera shift. */
function accumulate(a, b, width, cells, half, reach, shiftX, shiftY, planes, used, patch) {
  const side = 2 * reach + 1,
    area = (2 * half + 1) ** 2,
    floor = area * TEXTURE;
  for (let cell = 0; cell < cells.length; cell += 2) {
    const cx = cells[cell],
      cy = cells[cell + 1];
    let sum = 0,
      n = 0;
    for (let dy = -half; dy <= half; dy++) {
      let at = (cy + dy) * width + cx - half;
      for (let dx = -half; dx <= half; dx++) {
        const value = a[at++];
        patch[n++] = value;
        sum += value;
      }
    }
    const mean = sum / area;
    let energy = 0;
    for (let q = 0; q < area; q++) {
      patch[q] -= mean;
      energy += patch[q] * patch[q];
    }
    // A patch with no texture says nothing about motion.
    if (energy < floor) continue;
    const index = cell >> 1,
      plane = index * side * side;
    used[index]++;
    for (let oy = -reach; oy <= reach; oy++) {
      for (let ox = -reach; ox <= reach; ox++) {
        let s = 0,
          ss = 0,
          cross = 0,
          q = 0;
        for (let dy = -half; dy <= half; dy++) {
          let at = (cy + shiftY + oy + dy) * width + cx + shiftX + ox - half;
          for (let dx = -half; dx <= half; dx++) {
            const value = b[at++];
            s += value;
            ss += value * value;
            cross += patch[q++] * value;
          }
        }
        const spread = ss - (s * s) / area;
        if (spread > floor) planes[plane + (oy + reach) * side + ox + reach] += cross / Math.sqrt(spread * energy);
      }
    }
  }
}

/** Read each window's summed plane: the best offset to a fraction of a pixel, and how clearly it stands out. */
function peaks(planes, used, count, reach, least) {
  const side = 2 * reach + 1;
  const u = new Float32Array(count),
    v = new Float32Array(count),
    trust = new Float32Array(count);
  let edge = 0;
  // A parabola through the peak and its two neighbours places it between whole pixels.
  const fine = (lo, mid, hi) => {
    const bend = lo - 2 * mid + hi;
    return bend < 0 ? (0.5 * (lo - hi)) / bend : 0;
  };
  for (let cell = 0; cell < count; cell++) {
    if (used[cell] < least) continue;
    const plane = planes.subarray(cell * side * side, (cell + 1) * side * side);
    let best = 0,
      total = 0;
    for (let q = 0; q < plane.length; q++) {
      total += plane[q];
      if (plane[q] > plane[best]) best = q;
    }
    const bx = best % side,
      by = Math.floor(best / side);
    const clear = Math.min(1, Math.max(0, (plane[best] - total / plane.length) / used[cell]));
    if (bx === 0 || by === 0 || bx === side - 1 || by === side - 1) {
      // A peak on the edge of the search means the motion is out of reach.
      if (clear >= FILLED) edge++;
      continue;
    }
    u[cell] = bx - reach + fine(plane[best - 1], plane[best], plane[best + 1]);
    v[cell] = by - reach + fine(plane[best - side], plane[best], plane[best + side]);
    trust[cell] = clear;
  }
  return { u, v, trust, edge };
}

function lattice(width, height, step, margin, area) {
  const left = Math.max(margin, Math.ceil(area.x)),
    top = Math.max(margin, Math.ceil(area.y));
  const right = Math.min(width - margin, Math.floor(area.x + area.width)),
    bottom = Math.min(height - margin, Math.floor(area.y + area.height));
  const cols = Math.floor((right - left) / step) + 1,
    rows = Math.floor((bottom - top) / step) + 1;
  if (!(cols >= 2 && rows >= 2)) return null;
  const x = Math.round((left + right - (cols - 1) * step) / 2),
    y = Math.round((top + bottom - (rows - 1) * step) / 2);
  const cells = new Int32Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      cells[(j * cols + i) * 2] = x + i * step;
      cells[(j * cols + i) * 2 + 1] = y + j * step;
    }
  }
  return { cols, rows, x, y, cells };
}

/** A quarter-size copy of a frame, each pixel the average of a four by four block. */
function quarter(gray, width, height) {
  const w = width >> 2,
    h = height >> 2,
    out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) sum += gray[(y * 4 + dy) * width + x * 4 + dx];
      out[y * w + x] = sum >> 4;
    }
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[sorted.length >> 1];
}

function finish(record) {
  const field = Object.freeze({
    ...record,
    grid: Object.freeze({ ...record.grid }),
    speed: Object.freeze({ ...record.speed }),
    camera: record.camera && Object.freeze({ ...record.camera }),
    /** A plain record for `JSON.stringify`, with speeds rounded to a tenth of a pixel a second. */
    toJSON() {
      const round = (list, digits) => Array.from(list, (value) => +value.toFixed(digits));
      return {
        width: record.width,
        height: record.height,
        fps: record.fps,
        pairs: record.pairs,
        reach: record.reach,
        grid: { ...record.grid },
        u: round(record.u, 1),
        v: round(record.v, 1),
        trust: round(record.trust, 3),
        state: Array.from(record.state),
        speed: { ...record.speed },
        camera: record.camera && { ...record.camera },
      };
    },
  });
  compiled.add(field);
  return field;
}

function summary(u, v, state) {
  const speeds = [];
  for (let k = 0; k < state.length; k++) if (state[k] === MOVING) speeds.push(Math.hypot(u[k], v[k]));
  speeds.sort((a, b) => a - b);
  return {
    median: speeds.length ? speeds[speeds.length >> 1] : 0,
    fast: speeds.length ? speeds[Math.min(speeds.length - 1, Math.floor(speeds.length * 0.96))] : 0,
  };
}

/**
 * Measure how a moving texture travels across footage, and which parts of the picture move at all.
 *
 * `frames` holds 2 to 600 decoded frames of one size in playback order, as gray or RGBA bytes. `fps` is their
 * rate. The result is a grid of windows with the motion at each in pixels a second (`u` to the right, `v` down),
 * a `trust` from 0 to 1 for how clearly each answer stood out, and a `state` for each window: 0 where nothing
 * could be read, 1 where the picture is still and 2 where it moves. Still windows are held at rest.
 *
 * The search distance, the number of frame pairs used and the camera check are chosen from the footage unless
 * given. A camera that shakes is corrected from the still parts of the picture. When the shake hides every
 * still part, the whole picture is used instead, as long as its motion jitters from one frame pair to the next.
 * `camera` is null when neither gives a reading. A camera that travels smears the field, which `camera.travels`
 * reports.
 */
export function measureFlow(frames, spec = {}) {
  options(spec, ['fps', 'step', 'window', 'reach', 'every', 'region', 'stillBelow'], 'flow measurement');
  assert(
    Array.isArray(frames) && frames.length >= 2 && frames.length <= 600,
    'RESOURCE_LIMIT',
    'Use 2 to 600 frames in playback order.',
  );
  const fps = number(spec.fps, 'frame rate', 1, 240);
  for (let k = 0; k < frames.length; k++) entry(frames, k, 'Flow frames');
  const first = grayFrame(frames[0]);
  const { width, height } = first;
  assert(width >= 64 && height >= 64, 'INVALID_DATA', 'Use frames at least 64 pixels wide and tall.');
  const size = whole(spec.window ?? 15, 'window size', 5, 63);
  assert(size % 2 === 1, 'INVALID_OPTIONS', 'Use an odd window size, so each window has a centre pixel.');
  const half = size >> 1;
  const step = whole(spec.step ?? Math.max(6, Math.round(Math.min(width, height) / 30)), 'grid step', 4, 256);
  const stillBelow = number(spec.stillBelow ?? 0.5, 'still speed in pixels a frame', 0.05, 8);
  const area = spec.region ?? { x: 0, y: 0, width, height };
  options(area, ['x', 'y', 'width', 'height'], 'flow region');
  for (const key of ['x', 'y', 'width', 'height']) number(area[key], `region ${key}`, 0, 4096);

  const gray = (k) => {
    const frame = k === 0 ? first : grayFrame(frames[k]);
    assert(
      frame.width === width && frame.height === height,
      'INVALID_DATA',
      'Flow frames must have the same dimensions.',
    );
    return frame.gray;
  };

  // How far does the texture travel between frames? A quick look at quarter size, over a few pairs, sets the search.
  let reach = spec.reach === undefined ? null : whole(spec.reach, 'search reach', 1, 32);
  if (reach === null) {
    const w = width >> 2,
      h = height >> 2,
      coarse = lattice(w, h, 6, 4 + 8 + 1, {
        x: area.x / 4,
        y: area.y / 4,
        width: area.width / 4,
        height: area.height / 4,
      });
    reach = 12;
    if (coarse) {
      const count = coarse.cols * coarse.rows,
        planes = new Float32Array(count * 17 * 17),
        used = new Uint16Array(count),
        patch = new Float32Array(81);
      const looks = Math.min(12, frames.length - 1);
      for (let n = 0; n < looks; n++) {
        const k = Math.floor((n * (frames.length - 2)) / Math.max(1, looks - 1));
        accumulate(
          quarter(gray(k), width, height),
          quarter(gray(k + 1), width, height),
          w,
          coarse.cells,
          4,
          8,
          0,
          0,
          planes,
          used,
          patch,
        );
      }
      const seen = peaks(planes, used, count, 8, Math.ceil(looks / 2));
      let far = 0;
      for (let k = 0; k < count; k++)
        if (seen.trust[k] >= FILLED) far = Math.max(far, Math.abs(seen.u[k]), Math.abs(seen.v[k]));
      reach = seen.edge ? 32 : Math.min(32, Math.max(4, Math.ceil(far * 4 * 1.25) + 3));
    }
  }

  const margin = half + reach + 7;
  const grid = lattice(width, height, step, margin, area);
  assert(grid, 'INVALID_OPTIONS', 'The region is too small for this window, reach and step.');
  const count = grid.cols * grid.rows,
    side = 2 * reach + 1;
  assert(count <= 16384, 'RESOURCE_LIMIT', 'Use a larger step: a flow field holds at most 16,384 windows.');
  const each = count * side * side * size * size;
  let every = spec.every === undefined ? null : whole(spec.every, 'frame pair interval', 1, 64);
  if (every === null) every = Math.max(1, Math.min(64, Math.ceil(((frames.length - 1) * each) / WORK_TARGET)));
  const pairs = Math.ceil((frames.length - 1) / every);
  assert(
    pairs * each <= WORK_LIMIT,
    'RESOURCE_LIMIT',
    'This measurement is too large. Use a larger step, a smaller reach, fewer frames or a larger pair interval.',
  );

  const patch = new Float32Array(size * size);
  function pass(shifts) {
    const planes = new Float32Array(count * side * side),
      used = new Uint16Array(count);
    for (let k = 0, n = 0; k < frames.length - 1; k += every, n++) {
      accumulate(
        gray(k),
        gray(k + 1),
        width,
        grid.cells,
        half,
        reach,
        shifts ? shifts[n * 2] : 0,
        shifts ? shifts[n * 2 + 1] : 0,
        planes,
        used,
        patch,
      );
    }
    return peaks(planes, used, count, reach, Math.ceil(pairs / 2));
  }
  function sort(found) {
    const state = new Uint8Array(count);
    for (let k = 0; k < count; k++) {
      if (found.trust[k] < FILLED) continue;
      state[k] = Math.hypot(found.u[k], found.v[k]) < stillBelow ? STILL : MOVING;
    }
    return state;
  }

  let found = pass(null),
    state = sort(found),
    camera = null;
  // The still parts of the picture say what the camera did. Up to 96 of them, spread out, are matched pair by pair.
  // A shaking camera can hide every still part, because the shake makes the ground seem to move. With too few
  // still windows, the whole picture stands in, and its motion counts as shake only if it jitters between pairs:
  // a steady motion across the whole picture is more likely the subject (a river filling the frame) than the camera.
  let anchors = [];
  for (let k = 0; k < count; k++) if (state[k] === STILL) anchors.push(k);
  const wholePicture = anchors.length < 6;
  if (wholePicture) anchors = Array.from({ length: count }, (_, k) => k);
  if (anchors.length >= 6) {
    const stride = Math.max(1, Math.floor(anchors.length / 96)),
      cells = new Int32Array(Math.ceil(anchors.length / stride) * 2);
    for (let n = 0, q = 0; n < anchors.length; n += stride, q += 2) {
      cells[q] = grid.cells[anchors[n] * 2];
      cells[q + 1] = grid.cells[anchors[n] * 2 + 1];
    }
    const near = Math.min(reach, 6),
      held = cells.length >> 1,
      shifts = new Int32Array(pairs * 2);
    let square = 0,
      sumX = 0,
      sumY = 0;
    const pairShifts = [];
    for (let k = 0, n = 0; k < frames.length - 1; k += every, n++) {
      const planes = new Float32Array(held * (2 * near + 1) ** 2),
        used = new Uint16Array(held);
      accumulate(gray(k), gray(k + 1), width, cells, half, near, 0, 0, planes, used, patch);
      const one = peaks(planes, used, held, near, 1),
        xs = [],
        ys = [];
      for (let q = 0; q < held; q++) {
        if (one.trust[q] < 0.3) continue;
        xs.push(one.u[q]);
        ys.push(one.v[q]);
      }
      const dx = median(xs),
        dy = median(ys);
      pairShifts.push(dx, dy);
      shifts[n * 2] = Math.round(dx);
      shifts[n * 2 + 1] = Math.round(dy);
      square += dx * dx + dy * dy;
      sumX += dx;
      sumY += dy;
    }
    const shake = Math.sqrt(square / pairs),
      driftX = (sumX / pairs) * fps,
      driftY = (sumY / pairs) * fps;
    // How far each pair's shift strays from the clip's mean shift, in pixels.
    let spread = 0;
    for (let n = 0; n < pairShifts.length; n += 2)
      spread += (pairShifts[n] - sumX / pairs) ** 2 + (pairShifts[n + 1] - sumY / pairs) ** 2;
    spread = Math.sqrt(spread / pairs);
    const jitters = !wholePicture || spread >= 0.5;
    const corrected = jitters && shifts.some((value) => value !== 0);
    if (corrected) {
      found = pass(shifts);
      state = sort(found);
    }
    // Over the clip, a steady drift carries the scene across the fixed windows. Past half a step the field smears.
    const travelled = (Math.hypot(driftX, driftY) / fps) * (frames.length - 1);
    if (jitters)
      camera = {
        shake: +shake.toFixed(3),
        drift: { u: +driftX.toFixed(2), v: +driftY.toFixed(2) },
        corrected,
        travels: travelled > step / 2,
      };
  }

  const u = found.u,
    v = found.v,
    trust = found.trust;
  for (let k = 0; k < count; k++) {
    if (state[k] === MOVING) {
      u[k] *= fps;
      v[k] *= fps;
    } else u[k] = v[k] = 0;
  }
  // The fastest motion blurs, and a few windows inside a moving region have no clean answer. A window with at
  // least three moving neighbours takes their average, so something carried by the flow is not stopped midway.
  for (let round = 0; round < 3; round++) {
    const fill = [];
    for (let j = 0; j < grid.rows; j++) {
      for (let i = 0; i < grid.cols; i++) {
        const cell = j * grid.cols + i;
        if (state[cell] !== UNKNOWN) continue;
        let su = 0,
          sv = 0,
          n = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const q = (j + dj) * grid.cols + i + di;
            if (
              (di || dj) &&
              i + di >= 0 &&
              i + di < grid.cols &&
              j + dj >= 0 &&
              j + dj < grid.rows &&
              state[q] === MOVING
            ) {
              su += u[q];
              sv += v[q];
              n++;
            }
          }
        }
        if (n >= 3) fill.push(cell, su / n, sv / n);
      }
    }
    for (let q = 0; q < fill.length; q += 3) {
      u[fill[q]] = fill[q + 1];
      v[fill[q]] = fill[q + 2];
      trust[fill[q]] = FILLED;
      state[fill[q]] = MOVING;
    }
  }
  return finish({
    width,
    height,
    fps,
    pairs,
    reach,
    grid: { cols: grid.cols, rows: grid.rows, step, x: grid.x, y: grid.y },
    u,
    v,
    trust,
    state,
    speed: summary(u, v, state),
    camera,
  });
}

/** Copy and validate a saved flow field, such as the parsed JSON of a measured one, before sampling it. */
export function compileFlow(input) {
  options(
    input,
    ['width', 'height', 'fps', 'pairs', 'reach', 'grid', 'u', 'v', 'trust', 'state', 'speed', 'camera'],
    'flow field',
  );
  const width = whole(input.width, 'field width', 8, 4096),
    height = whole(input.height, 'field height', 8, 4096);
  options(input.grid, ['cols', 'rows', 'step', 'x', 'y'], 'flow grid');
  const cols = whole(input.grid.cols, 'grid columns', 2, 4096),
    rows = whole(input.grid.rows, 'grid rows', 2, 4096);
  const count = cols * rows;
  assert(count <= 16384, 'RESOURCE_LIMIT', 'A flow field holds at most 16,384 windows.');
  const step = number(input.grid.step, 'grid step', 1, 4096),
    x = number(input.grid.x, 'grid x', -4096, 8192),
    y = number(input.grid.y, 'grid y', -4096, 8192);
  const list = (values, name, limit, Type) => {
    assert(
      (Array.isArray(values) || ArrayBuffer.isView(values)) && values.length === count,
      'INVALID_DATA',
      `Flow ${name} must hold one value for each window.`,
    );
    const out = new Type(count);
    for (let k = 0; k < count; k++) {
      const value = entry(values, k, `Flow ${name}`);
      assert(
        Number.isFinite(value) && Math.abs(value) <= limit,
        'INVALID_DATA',
        `Flow ${name} holds an invalid value.`,
      );
      out[k] = value;
    }
    return out;
  };
  const u = list(input.u, 'u', 1e5, Float32Array),
    v = list(input.v, 'v', 1e5, Float32Array),
    trust = list(input.trust, 'trust', 1, Float32Array),
    state = list(input.state, 'state', 2, Uint8Array);
  // Only moving windows carry motion, whatever the record says.
  for (let k = 0; k < count; k++) if (state[k] !== MOVING) u[k] = v[k] = 0;
  const camera = input.camera ?? null;
  return finish({
    width,
    height,
    fps: number(input.fps, 'frame rate', 1, 240),
    pairs: whole(input.pairs ?? 1, 'frame pairs', 1, 600),
    reach: whole(input.reach ?? 1, 'search reach', 1, 32),
    grid: { cols, rows, step, x, y },
    u,
    v,
    trust,
    state,
    speed: summary(u, v, state),
    camera: camera && {
      shake: number(camera.shake, 'camera shake', 0, 64),
      drift: {
        u: number(camera.drift?.u, 'camera drift', -1e5, 1e5),
        v: number(camera.drift?.v, 'camera drift', -1e5, 1e5),
      },
      corrected: camera.corrected === true,
      travels: camera.travels === true,
    },
  });
}

function read(field, x, y, out) {
  const { grid, u, v } = field;
  const gx = (x - grid.x) / grid.step,
    gy = (y - grid.y) / grid.step,
    i = Math.floor(gx),
    j = Math.floor(gy);
  if (!(i >= 0 && j >= 0 && i < grid.cols - 1 && j < grid.rows - 1)) {
    out.u = out.v = 0;
    return out;
  }
  const fx = gx - i,
    fy = gy - j,
    k = j * grid.cols + i;
  const w00 = (1 - fx) * (1 - fy),
    w10 = fx * (1 - fy),
    w01 = (1 - fx) * fy,
    w11 = fx * fy;
  out.u = u[k] * w00 + u[k + 1] * w10 + u[k + grid.cols] * w01 + u[k + grid.cols + 1] * w11;
  out.v = v[k] * w00 + v[k + 1] * w10 + v[k + grid.cols] * w01 + v[k + grid.cols + 1] * w11;
  return out;
}

/**
 * The motion at a point of the picture, in pixels a second, blended from the four nearest windows. Outside the
 * grid, and where the picture is still, the motion is zero. Pass `out` to reuse one object in a loop.
 */
export function sampleFlow(field, x, y, out = { u: 0, v: 0 }) {
  assert(compiled.has(field), 'INVALID_DATA', 'Use a measured or compiled flow field.');
  assert(Number.isFinite(x) && Number.isFinite(y), 'INVALID_DATA', 'Use a finite point.');
  return read(field, x, y, out);
}

/**
 * The way something set down at `start` would be carried. The path is worked out once, in steps of `step`
 * seconds for up to `duration` seconds, and stops early where the flow falls below `stopBelow` pixels a second
 * or the path leaves the picture. `at(seconds)` gives the place at any time along it.
 */
export function traceFlow(field, start, spec = {}) {
  assert(compiled.has(field), 'INVALID_DATA', 'Use a measured or compiled flow field.');
  options(start, ['x', 'y'], 'trace start');
  options(spec, ['duration', 'step', 'stopBelow'], 'flow trace');
  const duration = number(spec.duration ?? 6, 'trace duration', 0.01, 120),
    step = number(spec.step ?? 1 / 60, 'trace step', 1 / 240, 1),
    stopBelow = number(spec.stopBelow ?? 4, 'stopping speed', 0, 1e5);
  const steps = Math.ceil(duration / step);
  assert(
    steps <= 7200,
    'RESOURCE_LIMIT',
    'A flow trace holds at most 7,200 steps. Use a shorter duration or a longer step.',
  );
  let x = number(start.x, 'trace x', -8192, 8192),
    y = number(start.y, 'trace y', -8192, 8192);
  const points = new Float32Array((steps + 1) * 2),
    at = { u: 0, v: 0 };
  points[0] = x;
  points[1] = y;
  let n = 0,
    slow = 0;
  while (n < steps) {
    read(field, x, y, at);
    const speed = Math.hypot(at.u, at.v);
    slow = speed < stopBelow ? slow + step : 0;
    if (slow > 0.3) break;
    x += at.u * step;
    y += at.v * step;
    n++;
    points[n * 2] = x;
    points[n * 2 + 1] = y;
    if (x < 0 || y < 0 || x > field.width || y > field.height) break;
  }
  const path = points.subarray(0, (n + 1) * 2);
  return Object.freeze({
    points: path,
    step,
    duration: n * step,
    /** The place `seconds` along the path. `done` is true once the path has ended. */
    at(seconds) {
      const f = Math.min(n, Math.max(0, seconds / step)),
        i = Math.min(n - 1, Math.floor(f)),
        t = n ? f - i : 0;
      if (!n) return { x: path[0], y: path[1], done: true };
      return {
        x: path[i * 2] + (path[i * 2 + 2] - path[i * 2]) * t,
        y: path[i * 2 + 1] + (path[i * 2 + 3] - path[i * 2 + 1]) * t,
        done: seconds >= n * step,
      };
    },
  });
}

function hash(a, b, c) {
  let h =
    Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^
    Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Streaks that ride a flow field: specks set down on moving windows and carried along, each drawn as the line
 * through its last few places, so a streak is long where the motion is fast.
 *
 * The streaks are a function of time with no hidden state. `sample(seconds)` returns the same lines for the same
 * time, so they can be scrubbed, reversed and exported. `positions` holds `points` places for each streak, head
 * first, as x and y pairs, and `speed` holds each streak's speed at its head in pixels a second. Pass `amount`
 * from 0 to 1 to release only that share of the streaks.
 */
export function flowStreaks(field, spec = {}) {
  assert(compiled.has(field), 'INVALID_DATA', 'Use a measured or compiled flow field.');
  options(spec, ['count', 'seed', 'life', 'tail', 'points'], 'flow streaks');
  const count = whole(spec.count ?? 400, 'streak count', 1, 4000),
    seed = whole(spec.seed ?? 1, 'streak seed', 0, 2147483647),
    life = number(spec.life ?? 2.2, 'streak life', 0.2, 20),
    tail = number(spec.tail ?? 0.12, 'streak tail in seconds', 0.02, 2),
    points = whole(spec.points ?? 7, 'streak points', 2, 24);
  const moving = [];
  for (let k = 0; k < field.state.length; k++) if (field.state[k] === MOVING) moving.push(k);
  const dt = tail / (points - 1),
    positions = new Float32Array(count * points * 2),
    speed = new Float32Array(count),
    path = new Float32Array((Math.ceil((life * 1.5) / dt) + 2) * 2),
    at = { u: 0, v: 0 };
  const { grid } = field;
  return Object.freeze({
    count,
    points,
    positions,
    speed,
    /** The streaks at `seconds`. The returned arrays are reused by the next call. */
    sample(seconds, amount = 1) {
      number(seconds, 'streak time', 0, 86400);
      const shown = Math.round(count * Math.min(1, Math.max(0, amount)));
      if (!moving.length) return { positions, speed, count: 0, points };
      for (let n = 0; n < shown; n++) {
        // Each streak lives for its own span, rests for the length of its tail while that runs in, and starts again.
        const span = life * (0.5 + hash(seed, n, 1)),
          period = span + tail,
          clock = seconds + hash(seed, n, 2) * period,
          turn = Math.floor(clock / period),
          age = clock - turn * period;
        const cell = moving[Math.floor(hash(seed + turn, n, 3) * moving.length)];
        let x = grid.x + (cell % grid.cols) * grid.step + (hash(seed + turn, n, 4) - 0.5) * grid.step,
          y = grid.y + Math.floor(cell / grid.cols) * grid.step + (hash(seed + turn, n, 5) - 0.5) * grid.step;
        const steps = Math.min(Math.ceil(Math.min(age, span) / dt), path.length / 2 - 1);
        path[0] = x;
        path[1] = y;
        let reached = 0,
          last = 0;
        for (let k = 1; k <= steps; k++) {
          read(field, x, y, at);
          last = Math.hypot(at.u, at.v);
          // Where the flow gives out, the streak stops and its tail runs in.
          if (last < 2) break;
          x += at.u * dt;
          y += at.v * dt;
          path[k * 2] = x;
          path[k * 2 + 1] = y;
          reached = k;
        }
        speed[n] = last;
        // The head is where the speck is now. Each later point is where it was one tail step earlier.
        const head = Math.min(age, span) / dt,
          late = Math.max(0, age - span) / dt;
        for (let q = 0; q < points; q++) {
          const f = Math.min(reached, Math.max(0, head - Math.max(0, q - late))),
            i = Math.min(Math.max(0, reached - 1), Math.floor(f)),
            t = reached ? f - i : 0,
            o = (n * points + q) * 2;
          positions[o] = path[i * 2] + (reached ? (path[i * 2 + 2] - path[i * 2]) * t : 0);
          positions[o + 1] = path[i * 2 + 1] + (reached ? (path[i * 2 + 3] - path[i * 2 + 1]) * t : 0);
        }
      }
      return { positions, speed, count: shown, points };
    },
  });
}
