import {detailLevels, frameView, referenceFrame, zoomTransition} from '../../runtime/src/zoom/index.js';
import {colour, ground} from './_kit.js';
import {disc, dragStudy, label, polygon, WIDTH} from './design-stage.js';

const HEIGHT = 290;
const START = 62;
const END = WIDTH - 62;
const CRUMB_RADIUS = 68;
const CHIPS = [[-38, -15, 7], [13, -32, 7], [48, -2, 6], [-15, 29, 7], [-49, 30, 4], [33, 36, 5]];

function paintCookie(g, view, table, ctx) {
  const center = view.project({x: 152, y: 120}, table);
  disc(g, center.x, center.y, view.screenSize(81, table), colour(ctx, 28 - ctx.hue, 59, 54));
  disc(g, center.x, center.y, view.screenSize(75, table), colour(ctx, 36 - ctx.hue, 67, 66));
  for (const [dx, dy, radius] of CHIPS) {
    const chip = view.project({x: 152 + dx, y: 120 + dy}, table);
    disc(g, chip.x, chip.y, view.screenSize(radius, table), colour(ctx, 23 - ctx.hue, 36, 33));
  }
}

function paintCrumb(g, view, crumb, ctx) {
  const center = view.project({x: 0, y: 0}, crumb);
  disc(g, center.x, center.y, view.screenSize(CRUMB_RADIUS, crumb), colour(ctx, 28 - ctx.hue, 49, 46));
}

function paintMarket(g, view, crumb, ctx) {
  const {x, y} = view.project({x: 0, y: 0}, crumb);
  g.save();
  g.translate(x, y);
  const scale = view.screenSize(1, crumb);
  g.scale(scale, scale);
  disc(g, 0, 0, CRUMB_RADIUS, colour(ctx, 37, 48, 61));
  disc(g, 0, 0, 53, colour(ctx, 61, 29, 68));
  for (const [left, top, hue] of [[-46, -28, 145], [11, -28, -102], [-18, 16, 12]]) {
    g.fillStyle = colour(ctx, hue, 36, 67);
    g.fillRect(left, top, 35, 22);
    g.fillStyle = colour(ctx, hue, 62, 33);
    g.fillRect(left + 3, top + 13, 29, 6);
    polygon(g, [
      {x: left - 3, y: top + 3}, {x: left + 4, y: top - 7},
      {x: left + 31, y: top - 7}, {x: left + 38, y: top + 3},
    ], colour(ctx, hue, 61, 46));
    for (let index = 0; index < 4; index++) {
      g.fillStyle = colour(ctx, hue, 54, 82);
      g.fillRect(left + 3 + index * 8, top + 2, 3.5, 5);
    }
  }
  label(g, 'FLEA MARKET', 0, -46, colour(ctx, 90, 35, 13), 10);
  g.restore();
}

export default function fleaMarketZoom(stage, ctx) {
  const table = referenceFrame({id: 'cafe-table'});
  const crumb = table.frame({id: 'crumb', x: 305, y: 111, unit: .035});
  const shot = zoomTransition(
    {frame: table, x: 255, y: 127, zoom: 1, anchorY: .42},
    {frame: crumb, x: 0, y: 0, zoom: 1.75, anchorY: .42},
  );
  const selector = detailLevels([
    {below: 100, draw: paintCrumb},
    {draw: paintMarket},
  ], {fade: 32});
  const magnifier = {name: 'the magnifier', x: START, y: 256, minX: START, maxX: END, axis: 'x'};

  return dragStudy(stage, ctx, {
    height: HEIGHT,
    handles: [magnifier],
    draw(g, {width, height, ink}) {
      const view = frameView(shot.sample((magnifier.x - START) / (END - START)), {width, height});
      const extent = view.screenSize(CRUMB_RADIUS * 2, crumb) * g.canvas.clientWidth / width;
      const {weights} = selector.sample(extent);
      g.fillStyle = ground(ctx);
      g.fillRect(0, 0, width, height);
      g.save();
      g.beginPath();
      g.rect(0, 0, width, 234);
      g.clip();
      paintCookie(g, view, table, ctx);
      selector.levels.forEach((level, index) => {
        if (weights[index] === 0) return;
        g.globalAlpha = weights[index];
        level.draw(g, view, crumb, ctx);
      });
      const crumbOnScreen = view.project({x: 0, y: 0}, crumb);
      if (extent < 25) {
        g.globalAlpha = 1;
        g.strokeStyle = ink;
        g.lineWidth = 1;
        g.setLineDash([2, 3]);
        g.beginPath();
        g.arc(crumbOnScreen.x, crumbOnScreen.y, 14, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      g.restore();

      g.strokeStyle = ink;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(START, magnifier.y);
      g.lineTo(END, magnifier.y);
      g.stroke();
      disc(g, magnifier.x, magnifier.y, 14, ground(ctx));
      disc(g, magnifier.x, magnifier.y, 8, colour(ctx, 150, 44, 54));
      g.beginPath();
      g.moveTo(magnifier.x + 6, magnifier.y + 6);
      g.lineTo(magnifier.x + 12, magnifier.y + 12);
      g.stroke();
      label(g, 'Table view', START, 279, ink, 13);
      label(g, 'Crumb view', END, 279, ink, 13);

      const widthText = `Crumb width ${extent < 10 ? extent.toFixed(1) : Math.round(extent)} px.`;
      if (weights[1] === 1) return `${widthText} The flea market is open for small business.`;
      if (weights[1] > 0) return `${widthText} The stalls are coming into view.`;
      return `${widthText} The crumb appears as one mark at this scale.`;
    },
  });
}
