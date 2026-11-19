import {hsla, toRGBA} from '../../runtime/src/color/index.js';
import {heightfield, hillshade, flow, rivers} from '../../runtime/src/maps/index.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const COLS = 98;
const ROWS = 70;
const MAP = {x: 17, y: 20, w: 357, h: 240};
const COMPASS = {x: 445, y: 134, r: 41};
const TAU = 2 * Math.PI;

function mountain() {
  const values = new Float32Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    const y = row / (ROWS - 1);
    for (let column = 0; column < COLS; column++) {
      const x = column / (COLS - 1);
      const valley = .49 + .13 * Math.sin(y * TAU * .7);
      const shore = x - valley;
      const west = Math.exp(-(((x - .23) / .19) ** 2 + ((y - .35) / .26) ** 2));
      const east = Math.exp(-(((x - .79) / .18) ** 2 + ((y - .46) / .29) ** 2));
      values[row * COLS + column] = 90 + 460 * (1 - y) + 430 * Math.abs(shore) + 950 * west + 1200 * east;
    }
  }
  return heightfield({columns: COLS, rows: ROWS, values, bounds: {x0: 0, y0: 0, x1: 3300, y1: 2300}});
}

function rgbPalette(dark) {
  return Array.from({length: 64}, (_, index) => {
    const lit = index / 63;
    return toRGBA(hsla(174 - 118 * lit, 31 + 26 * lit, (dark ? 15 : 21) + 60 * lit))
      .slice(0, 3).map(value => Math.round(255 * value));
  });
}

export default function mountainShade(stage, ctx) {
  const land = mountain();
  const waterways = rivers(land, flow(land), {threshold: 90, maxRivers: 10, smooth: 3});
  const palettes = {light: rgbPalette(false), dark: rgbPalette(true)};
  const raster = document.createElement('canvas');
  raster.width = COLS;
  raster.height = ROWS;
  const pixels = raster.getContext('2d');
  const image = pixels.createImageData(COLS, ROWS);
  const sun = {name: 'sun around the compass', x: COMPASS.x - 29, y: COMPASS.y - 29, minX: 396, maxX: 494, minY: 80, maxY: 188};
  let lastBearing = 315;
  let lastPalette = null;

  return dragStudy(stage, ctx, {height: 280, handles: [sun], draw(g, {dark, ink}) {
    const dx = sun.x - COMPASS.x;
    const dy = sun.y - COMPASS.y;
    const bearing = dx || dy ? Math.round((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) % 360 : lastBearing;
    const heading = bearing * Math.PI / 180;
    sun.x = COMPASS.x + COMPASS.r * Math.sin(heading);
    sun.y = COMPASS.y - COMPASS.r * Math.cos(heading);
    const palette = dark ? palettes.dark : palettes.light;
    if (lastPalette !== palette || lastBearing !== bearing) {
      const light = hillshade(land, {azimuth: bearing, altitude: 36, exaggeration: 1.55});
      for (let index = 0; index < light.length; index++) {
        const [r, green, b] = palette[Math.round(63 * light[index])];
        image.data[4 * index] = r;
        image.data[4 * index + 1] = green;
        image.data[4 * index + 2] = b;
        image.data[4 * index + 3] = 255;
      }
      pixels.putImageData(image, 0, 0);
      lastBearing = bearing;
      lastPalette = palette;
    }
    g.drawImage(raster, MAP.x, MAP.y, MAP.w, MAP.h);
    g.strokeStyle = paintColor(190, 79, dark ? 72 : 75, dark ? .86 : .92);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [index, {points}] of waterways.entries()) {
      g.lineWidth = index === 0 ? 2.6 : 1.35;
      g.beginPath();
      for (const {x, y} of points) g.lineTo(MAP.x + x * MAP.w / 3300, MAP.y + MAP.h * (1 - y / 2300));
      g.stroke();
    }

    g.strokeStyle = paintColor(41, 21, dark ? 64 : 44, .60);
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(COMPASS.x, COMPASS.y, COMPASS.r, 0, TAU);
    g.stroke();
    label(g, 'N', COMPASS.x, COMPASS.y - 60, ink, 15);
    label(g, 'E', COMPASS.x + 59, COMPASS.y, ink, 15);
    label(g, 'S', COMPASS.x, COMPASS.y + 60, ink, 15);
    label(g, 'W', COMPASS.x - 59, COMPASS.y, ink, 15);
    disc(g, sun.x, sun.y, 15, paintColor(36, 74, 68, .25));
    disc(g, sun.x, sun.y, 9, paintColor(41, 91, dark ? 76 : 55));
    label(g, `${bearing}°`, COMPASS.x, COMPASS.y, ink, 20);
    return `Sun bearing ${bearing}° clockwise from north. The mountain throws shade. Its rivers stay put.`;
  }});
}
