import { analyzeFrame, compileTrack, stabilizeTrack, trackPlane } from '../../runtime/src/vfx/index.js';

const scanWidth = 160;
const scanHeight = 90;
const trackWidth = 320;
const trackHeight = 180;
const corners = ({ x, y, width, height }) => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

function components(pixels, threshold) {
  const size = scanWidth * scanHeight;
  const seen = new Uint8Array(size);
  const queue = new Uint16Array(size);
  const boxes = [];
  for (let start = 0; start < size; start++) {
    if (seen[start] || pixels[start] < threshold) continue;
    queue[0] = start;
    seen[start] = 1;
    let tail = 1,
      left = scanWidth,
      top = scanHeight,
      right = 0,
      bottom = 0;
    for (let head = 0; head < tail; head++) {
      const at = queue[head];
      const x = at % scanWidth,
        y = Math.floor(at / scanWidth);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      const add = (next) => {
        if (seen[next] || pixels[next] < threshold) return;
        seen[next] = 1;
        queue[tail++] = next;
      };
      if (x > 0) add(at - 1);
      if (x + 1 < scanWidth) add(at + 1);
      if (y > 0) add(at - scanWidth);
      if (y + 1 < scanHeight) add(at + scanWidth);
    }
    const width = right - left + 1,
      height = bottom - top + 1;
    const fraction = tail / (width * height);
    if (tail >= size * 0.035 && tail <= size * 0.55 && fraction >= 0.70 && width >= scanWidth * 0.20 && height >= 12 && width >= height * 0.75)
      boxes.push({ x: left, y: top, width, height, fraction });
  }
  return boxes;
}

function edgeSupport(pixels, box, axis, far) {
  const vertical = axis === 'x';
  const origin = vertical ? box.x : box.y;
  const size = vertical ? box.width : box.height;
  const bound = vertical ? scanWidth : scanHeight;
  const at = far ? origin + size - 1 : origin;
  const direction = far ? 1 : -1;
  if (at < 3 || at + 3 >= bound) return 0;
  let strong = 0;
  for (let i = 1; i <= 10; i++) {
    const along = vertical
      ? box.y + Math.round((i * box.height) / 11)
      : box.x + Math.round((i * box.width) / 11);
    const read = (cross) => pixels[vertical ? along * scanWidth + cross : cross * scanWidth + along];
    if (read(at - 2 * direction) - read(at + 3 * direction) >= 15) strong++;
  }
  return strong / 10;
}

export function proposeScreens(pixels, previous = null) {
  const candidates = [];
  for (const threshold of [115, 140, 155, 170, 185, 205]) {
    for (const box of components(pixels, threshold)) {
      const x = Math.max(edgeSupport(pixels, box, 'x', false), edgeSupport(pixels, box, 'x', true));
      const y = Math.max(edgeSupport(pixels, box, 'y', false), edgeSupport(pixels, box, 'y', true));
      if (Math.min(x, y) < 0.5) continue;
      const distance = previous ? Math.max(
        Math.abs(box.x - previous.x),
        Math.abs(box.y - previous.y),
        Math.abs(box.width - previous.width),
        Math.abs(box.height - previous.height),
      ) : 0;
      if (distance > 11) continue;
      const score = (x + y) * box.fraction + Math.min(0.12, (box.width * box.height) / pixels.length) - distance * 0.035;
      candidates.push({ box, score });
    }
  }
  const unique = [];
  for (const { box } of candidates.sort((a, b) => b.score - a.score)) {
    if (unique.some((prior) => Math.max(
      Math.abs(box.x - prior.x), Math.abs(box.y - prior.y),
      Math.abs(box.width - prior.width), Math.abs(box.height - prior.height),
    ) <= 5)) continue;
    unique.push(box);
    if (unique.length === 4) break;
  }
  return unique;
}

export function proposeScreen(pixels, previous = null) {
  return proposeScreens(pixels, previous)[0] ?? null;
}

function readFrame(video, context, width, height) {
  context.drawImage(video, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4)
    data[i] = (54 * rgba[j] + 183 * rgba[j + 1] + 19 * rgba[j + 2]) >> 8;
  return { width, height, data };
}

function decoderReady(video, event, signal, action) {
  return new Promise((resolve, reject) => {
    const listeners = new AbortController();
    const timeout = setTimeout(() => settle(new Error('The footage took too long to decode.')), 3500);
    function settle(error) {
      clearTimeout(timeout);
      listeners.abort();
      if (error) reject(error);
      else resolve();
    }
    const options = { signal: listeners.signal, once: true };
    video.addEventListener(event, () => settle(), options);
    video.addEventListener('error', () => settle(new Error('The footage could not be decoded.')), options);
    signal.addEventListener('abort', () => settle(signal.reason), options);
    if (signal.aborted) settle(signal.reason);
    else action();
  });
}

export async function autoTrackScreen(url, signal, progress = () => {}) {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  const buffer = document.createElement('canvas');
  buffer.width = trackWidth;
  buffer.height = trackHeight;
  const context = buffer.getContext('2d', { willReadFrequently: true });
  const toFull = (quad, visible) => quad.map(({ x, y }, i) => ({
    x: visible.x === 0 && (i === 0 || i === 3) ? 0 : x * 2,
    y: visible.y === 0 && i < 2 ? 0 : y * 2,
  }));
  try {
    await decoderReady(video, 'loadeddata', signal, () => (video.src = url));
    const setBox = ({ x, y, width, height }) => ({
      x: x * 2, y: y * 2, width: width * 2 - 2, height: height * 2 - 2,
    });
    const inset = ({ x, y, width, height }) => ({
      x: x + 4, y: y + 4, width: x <= 2 ? width * 0.56 - 4 : width - 8, height: height - 8,
    });
    let proposal = proposeScreen(readFrame(video, context, scanWidth, scanHeight).data);
    if (!proposal) return { track: null, message: 'No wide rectangular surface had enough visible edge support.' };
    let box = setBox(proposal);
    let region = inset(box);
    let surface = corners(box);
    let previous = readFrame(video, context, trackWidth, trackHeight);
    let referenceFeatures = analyzeFrame(previous, { region }).features.length;

    const samples = [{ time: 0, value: toFull(surface, proposal) }];
    let residual = 0,
      featureSteps = 0,
      edgeSteps = 0;
    const lastTime = Math.min(4.96, video.duration - 0.04);
    if (!Number.isFinite(lastTime) || lastTime < 0.2) return { track: null, message: 'The clip is too short to validate the screen.' };
    const count = Math.ceil(lastTime / 0.2) + 1;
    for (let i = 1; i < count; i++) {
      const time = lastTime * i / (count - 1);
      await decoderReady(video, 'seeked', signal, () => (video.currentTime = time));
      const frame = readFrame(video, context, trackWidth, trackHeight);
      const detected = proposeScreen(readFrame(video, context, scanWidth, scanHeight).data, proposal);
      const result = referenceFeatures >= 4
        ? trackPlane(previous, frame, { region, surface, motion: 'translation', searchRadius: 12 })
        : null;
      if (result?.value && result.diagnostics.inlierCount >= 4 && !result.diagnostics.possibleCut) {
        residual += result.diagnostics.residual;
        featureSteps++;
        region = result.region;
        surface = result.value;
        if (detected) proposal = detected;
      } else if (detected && !result?.diagnostics.possibleCut) {
        proposal = detected;
        box = setBox(proposal);
        region = inset(box);
        surface = corners(box);
        edgeSteps++;
      } else {
        return { track: null, message: 'The rectangular region lost support at ' + time.toFixed(2) + ' s.' };
      }
      referenceFeatures = analyzeFrame(frame, { region }).features.length;
      previous = frame;
      samples.push({ time, value: toFull(surface, proposal) });
      progress(i + 1, count);
    }
    const fit = featureSteps ? ' · ' + (residual * 2 / featureSteps).toFixed(2) + ' px mean feature fit residual' : '';
    return {
      track: stabilizeTrack(compileTrack({ kind: 'plane', samples })),
      message: 'Tracked ' + samples.length + ' samples · ' + featureSteps + ' feature fits · ' + edgeSteps + ' edge fits' + fit,
    };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

export async function trackSurface(url, { surface, region = surface }, signal, progress) {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  const buffer = document.createElement('canvas');
  buffer.width = 640;
  buffer.height = 360;
  const context = buffer.getContext('2d', { willReadFrequently: true });
  const frame = () => readFrame(video, context, buffer.width, buffer.height);
  try {
    await decoderReady(video, 'loadeddata', signal, () => (video.src = url));
    const lastTime = Math.min(4.96, video.duration - .04);
    if (!Number.isFinite(lastTime) || lastTime < .04) return { track: null, message: 'The clip is too short to track.' };
    const steps = Math.round(lastTime * 25);
    const samples = [{ time: 0, value: surface }];
    let previous = frame();
    for (let i = 1; i <= steps; i++) {
      const time = i / 25;
      // Seek into the frame interval so floating-point rounding cannot select the previous frame.
      await decoderReady(video, 'seeked', signal, () => (video.currentTime = time + .005));
      const next = frame();
      const result = trackPlane(previous, next, { region, surface, motion: 'affine', searchRadius: 8 });
      if (!result.value || result.diagnostics.possibleCut) {
        samples.push({ time, value: null });
        break;
      }
      samples.push({ time, value: result.value });
      previous = next;
      region = result.region;
      surface = result.value;
      progress(i + 1, steps + 1);
    }
    const lost = samples.at(-1).value === null;
    const track = stabilizeTrack(compileTrack({ kind: 'plane', samples }));
    return {
      track,
      message: lost ? 'The surface lost support at ' + samples.at(-1).time.toFixed(2) + ' s.' : 'Tracked and stabilized ' + samples.length + ' surface samples.',
    };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
