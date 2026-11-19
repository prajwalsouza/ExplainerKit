import {scene} from '../../runtime/src/core/index.js';
import {matchCut} from '../../runtime/src/morph/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, WIDTH} from './design-stage.js';

const SHOT_HEIGHT = 212;
const HEIGHT = 274;
const START = 70;
const END = WIDTH - 70;
const TRIANGLE = [['M', -1, 0], ['L', 0, -1], ['L', 1, 0], ['Z']];

function shot(ctx, mountain) {
  const sceneWidth = {width: WIDTH, height: SHOT_HEIGHT};
  const drawing = scene(sceneWidth);
  drawing.rect({...sceneWidth, fill: colour(ctx, mountain ? -72 : 54, 27, 75)});
  drawing.rect({y: 178, width: WIDTH, height: 34, fill: colour(ctx, mountain ? -42 : 20, 28, 42)});
  const points = mountain ? [[155, 178, 144, 147], [357, 178, 89, 91]] : [[175, 178, 64, 117], [336, 178, 36, 64]];
  const peaks = points.map(([x, y, scaleX, scaleY], index) => drawing.path({
    x, y, scaleX, scaleY, commands: TRIANGLE, fill: colour(ctx, (mountain ? -140 : 38) + index * 112, 53, 44 + index * 11),
  }));
  for (const [x, y] of mountain ? [[72, 52], [455, 56]] : [[67, 83], [249, 54], [459, 91]]) {
    drawing.circle({x, y, r: mountain ? 14 : 6, fill: colour(ctx, 38, 61, 81)});
  }
  return {frame: drawing.sample(), peaks};
}

export default function hatMountains(stage, ctx) {
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const film = {name: 'the film tab', x: START, y: 230, minX: START, maxX: END, axis: 'x'};
  let transition;
  let lastTheme;
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [film],
    draw(g, {width, height, dark, ink}) {
      if (dark !== lastTheme) {
        lastTheme = dark;
        const from = shot(ctx, false);
        const to = shot(ctx, true);
        transition = matchCut({
          from: {frame: from.frame}, to: {frame: to.frame},
          pairs: from.peaks.map((part, index) => [part.id, to.peaks[index].id]),
          alignAt: .2, releaseAt: .8,
        });
      }
      const progress = (film.x - START) / (END - START);
      renderer.render(transition.sample(progress));
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.drawImage(renderer.element, 0, 0);
      g.fillStyle = ink;
      g.fillRect(START, film.y, END - START, 1);
      disc(g, film.x, film.y, 10, colour(ctx, 26, 60, 35));
      label(g, 'Party hats', START, 255, ink, 13);
      label(g, 'Mountains', END, 255, ink, 13);
      return `${Math.round(progress * 100)}% through the match cut. Two hats pair with two peaks.`;
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
