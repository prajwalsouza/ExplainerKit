import { adjustMatte, compositeMatte, surfaceTransform } from '../../runtime/src/vfx/index.js';

const frameWidth = 640;
const frameHeight = 360;
const insertWidth = 272;
const insertHeight = 200;
const crop = { x: 80, y: 20, width: 200, height: 185 };
const columns = 10;
const plateWidth = 288;
const plateHeight = 224;

export async function loadMatteImage(name) {
  const image = new Image();
  image.src = new URL(name, import.meta.url).href;
  await image.decode();
  return image;
}

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element.getContext('2d', { willReadFrequently: true });
}

function inverseSurface(surface) {
  const [a, b, c, d, e, f, g, h] = surfaceTransform(surface);
  const a0 = e - f * h,
    b0 = c * h - b,
    c0 = b * f - c * e;
  const d0 = f * g - d,
    e0 = a - c * g,
    f0 = c * d - a * f;
  const g0 = d * h - e * g,
    h0 = b * g - a * h,
    i0 = a * e - b * d;
  return (x, y) => {
    const w = g0 * x + h0 * y + i0;
    return [(a0 * x + b0 * y + c0) / w, (d0 * x + e0 * y + f0) / w];
  };
}

export function createShotComposite(output, atlas, screen) {
  if (
    atlas.naturalWidth !== columns * crop.width ||
    atlas.naturalHeight !== 13 * crop.height ||
    screen.naturalWidth !== plateWidth ||
    screen.naturalHeight !== plateHeight
  ) {
    throw Error('The presentation matte assets have unexpected dimensions.');
  }
  const context = output.getContext('2d');
  const mask = canvas(frameWidth, frameHeight);
  const footage = canvas(insertWidth, insertHeight);
  const clean = canvas(plateWidth, plateHeight);
  clean.drawImage(screen, 0, 0);
  const reference = clean.getImageData(0, 0, plateWidth, plateHeight).data;
  const composite = context.createImageData(insertWidth, insertHeight);
  const mattePreview = context.createImageData(frameWidth, frameHeight);
  const platePixels = new Uint8ClampedArray(insertWidth * insertHeight * 4);

  function readAlpha(foreground, time, width, height, { source, feather, shift }) {
    mask.clearRect(0, 0, frameWidth, frameHeight);
    mask.beginPath();
    for (const [index, { x, y }] of foreground.entries()) {
      if (index === 0) mask.moveTo(x, y);
      else mask.lineTo(x, y);
    }
    mask.closePath();
    mask.fill();
    if (source === 'refined') {
      const i = Math.min(124, Math.floor(time * 25 + 1e-6));
      mask.clearRect(crop.x, crop.y, crop.width, crop.height);
      mask.drawImage(
        atlas,
        (i % columns) * crop.width,
        Math.floor(i / columns) * crop.height,
        crop.width,
        crop.height,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
      );
    }
    const rgba = mask.getImageData(0, 0, width, height).data;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return adjustMatte(alpha, width, height, { feather, shift });
  }

  function projectPlate(surface, alpha, graphic) {
    const fromFrame = inverseSurface(surface);
    platePixels.fill(0);
    for (let i = 0; i < alpha.length; i++) {
      const offset = i * 4;
      if (!graphic[offset + 3] || !alpha[i] || alpha[i] === 255) continue;
      const [u, v] = fromFrame((i % insertWidth) + 0.5, Math.floor(i / insertWidth) + 0.5);
      if (u < 0 || u > 1 || v < 0 || v > 1 || !Number.isFinite(u + v)) continue;
      const index = 4 * (Math.round(v * (plateHeight - 1)) * plateWidth + Math.round(u * (plateWidth - 1)));
      if (!reference[index + 3]) continue;
      for (let channel = 0; channel < 4; channel++) platePixels[offset + channel] = reference[index + channel];
    }
    return platePixels;
  }

  function render({ video, graphic, foreground, surface, time, view, settings }) {
    context.clearRect(0, 0, frameWidth, frameHeight);
    if (view === 'original') return null;
    if (view === 'matte') {
      const alpha = readAlpha(foreground, time, frameWidth, frameHeight, settings);
      const pixels = mattePreview.data;
      for (let i = 0; i < alpha.length; i++) {
        const j = i * 4;
        pixels[j] = pixels[j + 1] = pixels[j + 2] = alpha[i];
        pixels[j + 3] = 255;
      }
      context.putImageData(mattePreview, 0, 0);
      return null;
    }
    const alpha = readAlpha(foreground, time, insertWidth, insertHeight, settings);
    footage.drawImage(video, 0, 0, frameWidth, frameHeight);
    const source = footage.getImageData(0, 0, insertWidth, insertHeight).data;
    const insert = graphic.getImageData(0, 0, insertWidth, insertHeight).data;
    composite.data.set(
      compositeMatte({
        width: insertWidth,
        height: insertHeight,
        footage: source,
        insert,
        foreground: alpha,
        cleanPlate: settings.source === 'refined' ? projectPlate(surface, alpha, insert) : undefined,
      }),
    );
    context.putImageData(composite, 0, 0);
    return {
      width: insertWidth,
      height: insertHeight,
      alpha,
    };
  }
  return { render };
}
