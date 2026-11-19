import {scene} from '../../runtime/src/core/index.js';
import {createTransition} from '../../runtime/src/core/transition.js';
import {createCanvasRenderer} from '../../runtime/src/renderers/canvas.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

export default function pancakePassage(stage, ctx) {
  const dial = {name: 'the pancake transition clock', x: 77, y: 240, axis: 'x', minX: 77, maxX: 443};
  const drawing = scene({width: 520, height: 215});
  const stack = drawing.group({x: 148, y: 117});
  stack.rect({x: -48, y: -15, width: 96, height: 21, rx: 10, fill: paintColor(31, 63, 58)});
  stack.rect({x: -50, y: -33, width: 100, height: 21, rx: 10, fill: paintColor(37, 72, 67)});
  stack.rect({x: -13, y: -39, width: 26, height: 14, rx: 4, fill: paintColor(51, 87, 81)});
  const order = stack.text({x: 0, y: 42, text: 'Kitchen', align: 'middle', fontSize: 19, fill: paintColor(17, 56, 36)});
  const from = drawing.sample();
  stack.set({x: 371});
  order.set({text: 'Table'});
  const transfer = createTransition(from, drawing.sample(), {discrete: 'end'});
  const renderer = createCanvasRenderer(document.createElement('div'), {points: 'cpu'});
  const stop = dragStudy(stage, ctx, {height: 266, handles: [dial], draw(g, {dark, ink}) {
    const p = (dial.x - dial.minX) / (dial.maxX - dial.minX);
    g.fillStyle = paintColor(26, 56, dark ? 78 : 94);
    g.beginPath(); g.roundRect(55, 45, 410, 149, 17); g.fill();
    renderer.render(transfer.sample(p));
    g.drawImage(renderer.element, 0, 0, 520, 215);
    g.fillStyle = paintColor(32, 33, dark ? 71 : 42, .42);
    g.fillRect(dial.minX, dial.y - 2, dial.maxX - dial.minX, 4);
    disc(g, dial.x, dial.y, 11, ink);
    label(g, `${p === 1 ? 100 : Math.floor(p * 100)}%`, dial.x, dial.y - 22, ink, 15);
    return p === 1 ? 'The pancake arrived. Its label switched to Table.' : 'The stack is in transit. Its label still reads Kitchen.';
  }});
  return () => { stop(); renderer.dispose(); };
}
