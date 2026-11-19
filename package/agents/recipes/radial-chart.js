// @recipe radial-chart
// @title Animate a themed radial chart
// @task Show measurements as radial spokes and trace connections between them with the Signal theme.
// @uses explainerkit/core, explainerkit/data
// @keywords chart, theme, paper, midnight, signal, radial, network, links, spokes, trace, motion
// @guide docs/modules/data-modeling.md
import {scene} from 'explainerkit/core';
import {radialChart} from 'explainerkit/data';

const drawing = scene({width: 540, height: 410, label: 'Activity at four stations and their connections'});
const stations = [
  {id: 'north', value: 42, label: 'North'},
  {id: 'east', value: 72, label: 'East', highlight: true},
  {id: 'south', value: 53, label: 'South', highlight: true},
  {id: 'west', value: 29, label: 'West'},
];
const links = [
  {from: 'north', to: 'south'},
  {from: 'east', to: 'south'},
  {from: 'west', to: 'east'},
];
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

radialChart(drawing, stations, {links, theme: 'signal', motion, cx: 270, cy: 205, radius: 160});
export const player = await drawing.mount(document.querySelector('#stage'));
if (motion) player.play();
