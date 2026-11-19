# Relief maps

A relief map explains a place through its shape: where the high ground is, which way the water runs, and where the river cuts through. `explainerkit/maps` holds the geography for such a map. It projects longitude and latitude, samples and shades a heightfield, finds where water flows, traces rivers and contours, lays lines on the ground, colours by elevation and schedules a river being drawn on. Everything is a pure calculation. The module downloads nothing and draws nothing, so the application supplies elevation data and chooses a renderer.

## Turn a heightfield into shading and rivers

A heightfield is a grid of elevations in metres. Row 0 is the north edge, and `bounds` gives the region the grid covers in metres east and north. The example assumes `values` holds `columns × rows` elevations from a data source you have prepared.

```js
import {heightfield, hillshade, flow, rivers} from 'explainerkit/maps';

const land = heightfield({columns: 512, rows: 512, values, bounds: {x0: -250000, y0: -250000, x1: 250000, y1: 250000}});
const light = hillshade(land, {azimuth: 300, altitude: 32, exaggeration: 3});
const water = flow(land);
const main = rivers(land, water, {threshold: 400})[0];
```

`hillshade` returns one brightness per sample from 0 to 1. A sample is brightest where its slope faces a sun at `azimuth` degrees clockwise from north and `altitude` degrees above the horizon. `exaggeration` multiplies heights before the slopes are measured, which is how a tabletop miniature makes gentle highlands read clearly.

```demo design-mountain-shade
This mountain throws shade. Drag the sun around the compass, or focus it and use the arrow keys. The light moves to the opposite slope while the rivers stay put. The terrain is a fictional heightfield.
```

`flow` works out where rain would run. It first fills closed hollows up to the level where they would spill, using the priority-flood method of Barnes, Lehman and Mulla (2014), so every land sample drains to the edge or the sea. It then follows each sample to its lowest neighbour and counts how many samples drain through each one. `rivers` traces lines downstream from every sample whose drainage reaches `threshold` samples. Each tributary ends where it joins a river already traced, and the result is sorted from the largest drainage down. Water traced from sample to sample runs in 45-degree steps, so each line is rounded by averaging every point with its neighbours, eight passes by default. The ends stay where they were, so a tributary still meets its river. Set `smooth` from 0 to 64 passes. More passes give gentler curves, and 0 keeps the raw sample path. Each river also has `drainageAlong`, the number of samples draining through each of its points, which grows downstream and sets how wide the river is drawn.

## Project a region and lay a line on it

`localProjection` converts degrees to metres east and north of a centre. It scales longitude by the cosine of the central latitude, which keeps distances accurate across a region a few hundred kilometres wide. Use a dedicated projection library for continents or polar regions.

```js
import {localProjection, drape, riverReveal} from 'explainerkit/maps';

const project = localProjection({center: {lon: 37.25, lat: 11.5}});
const lakeTana = project.project(37.3, 12.0);
const path = drape(main.points, land, {step: 500, exaggeration: 3, lift: 20});
const reveal = riverReveal(path, {at: 2, duration: 2.4});
const {fraction, tip} = reveal.reveal(time);
```

`drape` resamples a line every `step` metres and gives each point the ground height times `exaggeration`, plus a small `lift` so the line sits just above the surface. `riverReveal` turns the line into a draw-on schedule. At any time it returns the drawn fraction, which you can use to trim the line, and the tip position for a brighter head. The reveal is a pure function of time, so a scrubbed film shows the same frame.

## Colour, contours and clouds

`elevationRamp(stops)` returns a function from metres to colour. Each stop is `{metres, color}`, and the stops must increase. The relief-miniature style in `assets/cinematic-maps/styles/relief-miniature.json` lists the ramp that runs from salt flats through desert, scrub and highland green to bare rock, and you can pass its `terrain.ramp.stops` directly.

`contours(land, level)` traces lines of equal height by marching squares. It returns polylines in region metres, and a closed ring repeats its first point at the end.

`placeClouds(land, {seed, count, avoid, exaggeration})` places clouds over high ground. Higher samples are more likely to hold a cloud, clouds keep `spacing` apart, and any `avoid` circle stays clear so a cloud never hides the subject of the current shot. Clouds float at 1.2 times the highest exaggerated peak by default. The same seed always gives the same clouds.

## Use a real region

The examples above assume you already have elevation values. To build them from real data, `explainerkit/maps/fetch` downloads the Copernicus DEM tiles that cover a region and returns a heightfield, and it can also download the region's rivers, lakes and coastline from Natural Earth. Nothing is bundled, and nothing is downloaded until you call a loader. [Real map data](map-data.md) explains the loaders, the cache, baking a region once in Node and the credit each source requires.

## Limits

A heightfield holds at most 2048 × 2048 samples, every sample must be a finite elevation between −12,000 and 12,000 metres, and missing samples are rejected rather than guessed. Contours stop at 500,000 segments by default, and draped lines at 200,000 points. The pure functions here do not download or render anything. Downloading is done by `explainerkit/maps/fetch` only when you call it, and rendering by `explainerkit/renderers/three/cinematic`.
