import {scene} from '../../runtime/src/core/index.js';
import {parseFont} from '../../runtime/src/import/font.js';
import {glyphs} from '../../runtime/src/typography/index.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {css} from './_kit.js';
import {counterFontBytes} from './design-counter-font.js';
import {disc, dragStudy, label, paintColor} from './design-stage.js';

const CSS = `
.ek-glyph-opportunity { position: absolute; inset: 0; pointer-events: none; }
.ek-glyph-opportunity svg { display: block; width: 100%; height: auto; }
`;

export default function glyphOpportunity(stage, ctx) {
  css('design-glyph-opportunity', CSS);
  const host = document.createElement('div');
  host.className = 'ek-glyph-opportunity';
  const renderer = createSVGRenderer(host, {label: 'A measured row of letters opening a place for O'});
  const drawing = scene({width: 520, height: 245, duration: 1.4});
  const line = glyphs(drawing, 'AA', {font: parseFont(counterFontBytes()), size: 147, x: 99, y: 160, fill: paintColor(180, 54, 41)});
  line.insert(1, 'O', {at: .27, duration: .9});
  const ticket = {name: 'O admission ticket', x: ctx.still ? 445 : 125, y: 207, axis: 'x', minX: 75, maxX: 445};
  const disposeStudy = dragStudy(stage, ctx, {height: 245, handles: [ticket], draw(g, {dark, ink}) {
    const guide = paintColor(180, 24, dark ? 69 : 46, .58);
    g.strokeStyle = guide;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(70, 160);
    g.lineTo(450, 160);
    g.moveTo(ticket.minX, ticket.y);
    g.lineTo(ticket.maxX, ticket.y);
    g.stroke();
    const time = 1.4 * (ticket.x - ticket.minX) / (ticket.maxX - ticket.minX);
    const sampled = line.sample(time);
    const inserted = sampled.glyphs.find(glyph => glyph.character === 'O');
    disc(g, ticket.x, ticket.y, 15, paintColor(44, 57, dark ? 68 : 78));
    label(g, 'O', ticket.x, ticket.y, paintColor(42, 38, 20), 15);
    label(g, 'Before edit', 84, 229, ink, 15);
    label(g, 'After edit', 436, 229, ink, 15);
    renderer.render(drawing.sample({time}));
    return `The O occupies ${Math.round(inserted.advance)} scene units. The right-hand A moves as that advance grows.`;
  }});
  stage.querySelector('.ek-study-picture').append(host);
  return () => { disposeStudy(); renderer.dispose(); };
}
