import { scene } from '../../runtime/src/core/index.js';
import { hsla, toHex } from '../../runtime/src/color/index.js';
import { createSVGRenderer } from '../../runtime/src/renderers/svg.js';
import { css } from './_kit.js';

const palette = {
  field: toHex(hsla(222, 26, 16)),
  wall: toHex(hsla(216, 22, 26)),
  silhouette: toHex(hsla(221, 18, 39)),
  ink: toHex(hsla(43, 36, 94)),
  light: toHex(hsla(45, 72, 75)),
  soft: toHex(hsla(217, 13, 52)),
};

function frame(host, caption) {
  const model = scene({ width: 240, height: 126, label: caption });
  model.rect({ x: 0, y: 0, width: 240, height: 126, fill: palette.field });
  const renderer = createSVGRenderer(host);
  return { model, renderer };
}

const studies = [
  [
    'Leave room for a message',
    (model) => {
      model.ellipse({ x: 61, y: 44, rx: 17, ry: 24, fill: palette.silhouette });
      model.ellipse({ x: 52, y: 126, rx: 48, ry: 62, fill: palette.silhouette });
      model.rect({ x: 83, y: 78, width: 13, height: 23, rx: 3, rotation: -0.22, fill: palette.soft });
      model.text({ x: 118, y: 54, text: 'MESSAGE RECEIVED', fontSize: 8, fontWeight: 700, fill: palette.light });
      model.text({ x: 118, y: 75, text: 'Use the east door.', fontSize: 13, fill: palette.ink });
    },
  ],
  [
    'Follow a piece of evidence',
    (model) => {
      model.path({
        commands: [['M', 0, 76], ['L', 240, 63], ['L', 240, 126], ['L', 0, 126], ['Z']],
        fill: palette.wall,
      });
      model.rect({ x: 51, y: 74, width: 42, height: 24, rx: 6, rotation: -0.13, fill: palette.silhouette });
      model.circle({ x: 85, y: 82, r: 4, fill: palette.light });
      model.path({
        commands: [
          ['M', 85, 82],
          ['L', 113, 59],
          ['L', 172, 59],
        ],
        stroke: palette.light,
        fill: 'none',
      });
      model.text({ x: 118, y: 49, text: 'Fresh scratch', fontSize: 13, fill: palette.ink });
    },
  ],
  [
    'Place type on a surface',
    (model) => {
      model.path({
        commands: [['M', 18, 14], ['L', 211, 34], ['L', 211, 110], ['L', 18, 120], ['Z']],
        fill: palette.wall,
      });
      for (const [a, b] of [
        [36, 52],
        [58, 70],
        [80, 87],
        [102, 103],
      ]) {
        model.line({ x1: 18, y1: a, x2: 211, y2: b, stroke: palette.silhouette, strokeWidth: 0.8 });
      }
      model.text({
        x: 44,
        y: 72,
        text: 'STUDIO B',
        fontSize: 24,
        fontWeight: 750,
        rotation: 0.07,
        fill: palette.light,
      });
      model.ellipse({ x: 182, y: 84, rx: 20, ry: 27, fill: palette.field });
      model.ellipse({ x: 188, y: 131, rx: 43, ry: 39, fill: palette.field });
    },
  ],
];

export default function storyboard(stage) {
  css(
    'vfx-board',
    `
    figure[data-demo="video-vfx-storyboard"] .stage { min-height:0; }
    .vfx-board { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .vfx-board section { min-width:0; }
    .vfx-board section div { overflow:hidden; border-radius:10px; }
    .vfx-board p { margin:7px 0 0; color:var(--ink); font:600 13px/1.4 var(--sans); }
    @media(max-width:580px) { .vfx-board { grid-template-columns:1fr; } }
  `,
  );
  const grid = document.createElement('div');
  grid.className = 'vfx-board';
  stage.append(grid);
  const renderers = studies.map(([label, draw]) => {
    const item = document.createElement('section');
    const screen = document.createElement('div');
    const caption = document.createElement('p');
    caption.textContent = label;
    item.append(screen, caption);
    grid.append(item);
    const { model, renderer } = frame(screen, label);
    draw(model);
    renderer.render(model.sample({ time: 0 }));
    return renderer;
  });
  return () => renderers.forEach((renderer) => renderer.dispose());
}
