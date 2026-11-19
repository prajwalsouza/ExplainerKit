import {scene} from '../../runtime/src/core/index.js';
import {roundedRectPath} from '../../runtime/src/geometry/index.js';
import {matchCut} from '../../runtime/src/morph/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {ground} from './_kit.js';
import {disc, dragStudy, label, paintColor, WIDTH} from './design-stage.js';

const SHOT_HEIGHT = 214;
const HEIGHT = 278;
const START = 56;
const END = WIDTH - START;
const ALIGN_AT = .24;
const RELEASE_AT = .76;
const ANCHOR = {x: 260, y: 107};

function kitchen(dark) {
  const drawing = scene({width: WIDTH, height: SHOT_HEIGHT});
  drawing.rect({width: WIDTH, height: SHOT_HEIGHT, fill: paintColor(35, 42, dark ? 22 : 84)});
  for (let y = 22; y < SHOT_HEIGHT; y += 29) {
    drawing.line({x1: 0, y1: y, x2: WIDTH, y2: y, stroke: paintColor(30, 29, dark ? 32 : 72)});
  }
  drawing.rect({x: 375, y: 102, width: 102, height: 77, rx: 6, rotation: -.13,
    fill: paintColor(1, 39, dark ? 37 : 66)});
  for (const x of [394, 418, 442]) {
    drawing.line({x1: x, y1: 105, x2: x + 10, y2: 172, stroke: paintColor(28, 53, dark ? 54 : 81), strokeWidth: 3});
  }
  const shape = drawing.path({
    x: 207, y: 107, commands: roundedRectPath({x: -66, y: -59, width: 132, height: 118, radius: 18}),
    fill: paintColor(42, 89, dark ? 48 : 69, .28),
    stroke: paintColor(26, 64, dark ? 64 : 41), strokeWidth: 9,
  });
  for (const [x, y] of [[181, 82], [209, 97], [224, 72], [185, 127], [226, 127], [205, 144]]) {
    drawing.circle({x, y, r: 7, fill: paintColor(7, 70, dark ? 52 : 38)});
    drawing.circle({x: x - 2, y: y - 2, r: 2, fill: paintColor(17, 79, dark ? 76 : 63)});
  }
  for (const [x, y, turn] of [[194, 77, -.55], [218, 112, .8], [197, 118, -.4], [231, 147, .35]]) {
    drawing.ellipse({x, y, rx: 6, ry: 3, rotation: turn, fill: paintColor(114, 41, dark ? 58 : 29)});
  }
  return {frame: drawing.sample(), shape: shape.id};
}

function clockWall(dark) {
  const drawing = scene({width: WIDTH, height: SHOT_HEIGHT});
  drawing.rect({width: WIDTH, height: SHOT_HEIGHT, fill: paintColor(192, 31, dark ? 20 : 81)});
  for (let x = 21; x < WIDTH; x += 52) {
    drawing.rect({x, width: 20, height: SHOT_HEIGHT, fill: paintColor(192, 35, dark ? 25 : 76)});
  }
  drawing.rect({x: 54, y: 42, width: 110, height: 130, rx: 4, fill: paintColor(193, 31, dark ? 31 : 70)});
  drawing.rect({x: 66, y: 52, width: 86, height: 110, rx: 3, fill: paintColor(192, 29, dark ? 15 : 89)});
  drawing.circle({x: 119, y: 81, r: 12, fill: paintColor(40, 70, dark ? 69 : 61)});
  drawing.path({commands: [['M', 72, 143], ['L', 97, 97], ['L', 121, 127], ['L', 140, 107], ['L', 147, 143], ['Z']],
    fill: paintColor(193, 26, dark ? 52 : 53)});

  const center = {x: 310, y: 107};
  const shape = drawing.circle({
    ...center, r: 73, fill: paintColor(195, 59, dark ? 48 : 93, .3),
    stroke: paintColor(200, 46, dark ? 68 : 34), strokeWidth: 8,
  });
  const ink = paintColor(219, 42, dark ? 86 : 24);
  for (let quarter = 0; quarter < 12; quarter++) {
    const angle = quarter * Math.PI / 6;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const inner = quarter % 3 === 0 ? 32 : 36;
    drawing.line({x1: center.x + inner * x, y1: center.y + inner * y,
      x2: center.x + 42 * x, y2: center.y + 42 * y, stroke: ink, strokeWidth: 2});
  }
  drawing.line({x1: center.x, y1: center.y, x2: 295, y2: 89, stroke: ink, strokeWidth: 4, strokeLinecap: 'round'});
  drawing.line({x1: center.x, y1: center.y, x2: 336, y2: 92, stroke: ink, strokeWidth: 3, strokeLinecap: 'round'});
  drawing.circle({...center, r: 4, fill: ink});
  return {frame: drawing.sample(), shape: shape.id};
}

function describe(progress) {
  if (progress === 0) return 'Kitchen shot. The pizza starts at its position in the captured frame.';
  if (progress === 1) return 'Clock shot. The clock reaches its position in the captured frame.';
  if (progress < ALIGN_AT) return 'Align. The pizza outline moves toward the shared anchor.';
  if (progress <= RELEASE_AT) return 'Morph. The outline changes at the anchor as the backgrounds crossfade.';
  return 'Release. The clock outline moves to its position in the next shot.';
}

export default function pizzaTimeCut(stage, ctx) {
  const film = {name: 'the match-cut film tab', x: START, y: 241, minX: START, maxX: END, axis: 'x'};
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  let cut;
  let previousTheme;
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [film],
    draw(g, {width, height, dark, ink}) {
      if (dark !== previousTheme) {
        cut = matchCut({
          from: kitchen(dark), to: clockWall(dark),
          anchor: ANCHOR, scale: 1.22, alignAt: ALIGN_AT, releaseAt: RELEASE_AT,
        });
        previousTheme = dark;
      }
      const progress = (film.x - START) / (END - START);
      renderer.render(cut.sample(progress));
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.element, 0, 0);
      g.fillStyle = ink;
      g.fillRect(START, film.y, END - START, 1);
      const ranges = [[0, ALIGN_AT, 'Align'], [ALIGN_AT, RELEASE_AT, 'Morph'], [RELEASE_AT, 1, 'Release']];
      for (const [start, end, name] of ranges) {
        const pixel = START + (END - START) * start;
        g.fillRect(pixel, film.y - 4, 1, 8);
        label(g, name, START + (END - START) * (start + end) / 2, 264, ink, 13);
      }
      g.fillRect(END, film.y - 4, 1, 8);
      disc(g, film.x, film.y, 12, ink);
      disc(g, film.x, film.y, 7, paintColor(38, 65, dark ? 69 : 49));
      return describe(progress);
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
