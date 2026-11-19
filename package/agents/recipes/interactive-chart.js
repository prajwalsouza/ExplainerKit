// @recipe interactive-chart
// @title Mount an interactive chart that morphs between five views
// @task Give readers radial, chord, sunburst, arc and bar views of the same data, with hover, focus and a pointer light.
// @uses explainerkit/data
// @keywords chart, interactive, hover, focus, click, type, theme, bar, radial, chord, sunburst, arc, silk, morph, frames, heat
// @guide docs/modules/data-modeling.md
import {mountDataChart} from 'explainerkit/data';

const chart = await mountDataChart(document.querySelector('#stage'), [
  {id: 'north', value: 42, label: 'North', group: 'Coast'},
  {id: 'east', value: 72, label: 'East', highlight: true, group: 'Coast'},
  {id: 'south', value: 53, label: 'South', group: 'Inland'},
], {
  links: [{from: 'north', to: 'east', value: 12}, {from: 'east', to: 'south', value: 8}],
  theme: 'silk',
});
chart.setType('sunburst');
export const player = chart.player;
