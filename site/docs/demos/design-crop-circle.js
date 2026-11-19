import {scene} from '../../runtime/src/core/index.js';
import {clipCircle, clipRect} from '../../runtime/src/graphics/index.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {ground} from './_kit.js';
import {disc, dragStudy, paintColor, WIDTH} from './design-stage.js';

const HEIGHT = 255;
const FRAME = {x: 103, y: 53, width: 314, height: 149};
const RADIUS = 69;
const CARROT = [['M', -11, 0], ['Q', -10, -8, 0, -8], ['Q', 10, -8, 11, 0], ['Q', 6, 12, 0, 23], ['Q', -6, 11, -11, 0], ['Z']];

function addField(drawing) {
  const frame = drawing.group({clip: clipRect(FRAME)});
  const field = frame.group();
  field.rect({width: WIDTH, height: HEIGHT, fill: paintColor(33, 34, 31)});
  for (let x = 120; x <= 410; x += 49) {
    field.rect({x: x - 16, y: 35, width: 31, height: 187, fill: paintColor(30, 42, 24)});
    for (const y of [78, 125, 174]) {
      if (x % 2 === 0) {
        field.path({x, y, commands: CARROT, fill: paintColor(27, 87, 57)});
      } else {
        field.ellipse({x, y: y + 5, rx: 11, ry: 13, fill: paintColor(351, 63, 53)});
      }
      field.ellipse({x: x - 3, y: y - 7, rx: 3.4, ry: 7, rotation: -.6, fill: paintColor(101, 45, 52)});
      field.ellipse({x: x + 3, y: y - 7, rx: 3.4, ry: 7, rotation: .6, fill: paintColor(101, 45, 52)});
    }
  }
  return field;
}

export default function cropCircle(stage, ctx) {
  const drawing = scene({width: WIDTH, height: HEIGHT});
  const field = addField(drawing);
  const renderer = createCanvasRenderer(document.createElement('div'), {pixelRatio: 1});
  const window = {name: 'the round crop window', x: 260, y: 127, minX: 34, maxX: 486, minY: 30, maxY: 225};
  const stop = dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [window],
    draw(g, {width, height, dark, ink}) {
      const {x, y} = window;
      field.set({clip: clipCircle({x, y, r: RADIUS})});
      renderer.render(drawing.sample());
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.fillStyle = paintColor(93, 13, dark ? 22 : 86);
      g.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
      g.drawImage(renderer.element, 0, 0);
      g.strokeStyle = ink;
      g.lineWidth = 1.5;
      g.strokeRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
      g.strokeStyle = paintColor(156, 50, dark ? 71 : 30);
      g.lineWidth = 2.5;
      g.beginPath();
      g.setLineDash([4, 4]);
      g.arc(x, y, RADIUS, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      disc(g, x, y, 12, ground(ctx));
      disc(g, x, y, 6, paintColor(156, 50, dark ? 71 : 30));

      const dx = Math.max(FRAME.x - x, x - FRAME.x - FRAME.width, 0);
      const dy = Math.max(FRAME.y - y, y - FRAME.y - FRAME.height, 0);
      if (Math.hypot(dx, dy) >= RADIUS) return 'The clips have no overlap. The field is hidden.';
      if (x - RADIUS < FRAME.x || x + RADIUS > FRAME.x + FRAME.width ||
          y - RADIUS < FRAME.y || y + RADIUS > FRAME.y + FRAME.height) {
        return 'The rectangular frame keeps just the overlapping part of the round crop.';
      }
      return 'The round window fits inside the frame. Move it across a frame edge to cut the view.';
    },
  });
  return () => {
    stop();
    renderer.dispose();
  };
}
