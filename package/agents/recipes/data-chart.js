// @recipe data-chart
// @title Draw a bar chart from data with scales
// @task Map numbers and categories to positions with linear and band scales and draw labelled bars with ticks.
// @uses explainerkit/core, explainerkit/data
// @keywords chart, bar chart, scale, band scale, axis, ticks, data, plot, visualisation
// @guide docs/modules/data-modeling.md
import {scene} from 'explainerkit/core';
import {scale, bandScale} from 'explainerkit/data';

const rows = [{mode: 'walk', speed: 5}, {mode: 'cycle', speed: 18}, {mode: 'bus', speed: 22}, {mode: 'car', speed: 31}];
const drawing = scene({width: 640, height: 360, label: 'Average speed by way of travel'});
const y = scale({domain: [0, 35], range: [300, 40]});
const x = bandScale({domain: rows.map((r) => r.mode), range: [80, 600], paddingInner: 0.25});

for (const tick of y.ticks(5)) {
  drawing.line({x1: 70, y1: y(tick), x2: 600, y2: y(tick), stroke: '#e3e0d6'});
  drawing.text({x: 60, y: y(tick) + 5, text: String(tick), fontSize: 13, align: 'end', fill: '#58635d'});
}
rows.forEach((row, i) => {
  const bar = drawing.rect({x: x(row.mode), y: 300, width: x.bandwidth, height: 0, fill: '#34766b'});
  bar.to(0.2 * i, {y: y(row.speed), height: 300 - y(row.speed)}, {duration: 0.8, ease: 'easeOut'});
  drawing.text({x: x(row.mode) + x.bandwidth / 2, y: 325, text: row.mode, fontSize: 15, align: 'middle', fill: '#262d2b'});
});

export const player = await drawing.mount(document.querySelector('#stage'));
player.play();
