# Lift text from a page

Explainers often quote a source: a newspaper headline, a line from a book or a letter. A strong way to show it is to mark the phrase on the page and lift it off, so the words become the next part of the story. `explainerkit/typography/source` provides the calculations for that move. It lays text into a document template, finds the phrase, maps its position onto the curved 3D page and schedules the highlight and the lift. Each schedule is a pure function of time, so a film frame and a scrubbed preview always agree.

The source-document asset pack in `assets/source-documents/` supplies the pieces these functions read. Each document folder holds a `document.json` with the page layout and surface grid, the shared `motion.json` holds the highlight and lift timings, and the bundled Instrument Serif font provides the letter widths.

```demo design-grain-robbery
The Daily Crumb suspects a cereal offender. Hover over either underlined phrase to peel it off the paper and pin it as evidence. Tab to a phrase or tap it to make the same lift.
```

The demo measures the phrase, locates it on a gently curved page, and samples the highlight and lift with one clock. The chip's changing tilt and shadow show the moment it separates from the paper. The status beneath the scene follows the lift stages.

## Lay out a front page and find a headline phrase

Text is measured from font outlines rather than the fonts installed on the machine, so a film frame does not change between computers. Load the font with `explainerkit/import/font` first.

```js
import {parseFont} from 'explainerkit/import/font';
import {layoutDocument, findPhrase} from 'explainerkit/typography/source';

const font = parseFont(fontBytes); // InstrumentSerif-Regular.ttf
const layout = layoutDocument(newspaper.layout, {headline: 'Where the Blue Nile begins', body: articleText}, {font});
const rects = findPhrase(layout, 'Blue Nile', {slot: 'headline'});
```

`layoutDocument` flows each slot's text into its rectangle or columns, using the slot's type size, leading, tracking, alignment and line limit. All positions are in millimetres from the page's top-left corner. The result lists each line with its words and their widths, plus `overflow`, the text that did not fit in each slot. A word wider than its column stays on its own line rather than being split.

`findPhrase` matches whole words, ignoring case and punctuation. It returns one rectangle per line the phrase covers, so a phrase split across a line break gives two rectangles. Pass `occurrence` to pick a later match and `padding` to grow the rectangles.

## Put the phrase on the curved page

The document models are not flat. A book's pages curve into the gutter, and a letter has a lifted corner. `surfaceMapper` turns a page position in millimetres into a 3D point and normal on that surface. Its inputs come from the model's printable mesh, which is a regular grid of vertices with vertex `(i, j)` at index `j * (cols + 1) + i`.

```js
import {surfaceMapper} from 'explainerkit/typography/source';
const page = surfaceMapper({size: [381, 289], grid: [120, 92], positions});
const centre = rects[0];
const start = page.at(centre.x + centre.width / 2, centre.y + centre.height / 2);
```

The mapper blends the four vertices around the position. When the model gives no normals, it computes them from the grid. A normal is the direction perpendicular to the surface, which tells a renderer which way the chip faces before it turns toward the camera.

## Mark the phrase, then lift it

`highlightSchedule` draws a marker stroke, underline, circle or glow over the rectangles, taking its colour, duration and easing from `motion.json`. Longer lines take proportionally longer, so the stroke moves at one speed across a line break.

```js
import {highlightSchedule, liftSchedule} from 'explainerkit/typography/source';

const mark = highlightSchedule(rects, motion.highlight.marker, {at: 1});
const lift = liftSchedule(motion.lift, {at: mark.end + 0.2, from: start, to: mapPin});

const strokes = mark.at(time); // each rectangle with its drawn fraction
const pose = lift.pose(time);
```

The lift runs through four phases from the motion pack. During `unstick` the phrase rises 1.5 mm, its shadow appears, and the words left on the page fade to a 25 % imprint. During `rise` it climbs 3 cm, turns most of the way toward the camera, grows to 1.6 times its size and curls slightly. During `travel` it follows an arc to `to`, which is when a renderer should apply motion blur. During `settle` a damped spring brings the scale and the turn to rest. The spring is solved analytically, so any time gives its pose without stepping through earlier frames.

`pose(time)` returns the phase name, the 3D position, the rise, scale, turn toward the camera, curl, shadow and imprint strengths, a small flutter angle, and how much to dim and desaturate the page behind. `lift.phases` gives the start time of each phase. Several phrases lifting together take an `index`, and each starts 0.12 s after the previous one.

## Limits

These functions compute layout and motion only. Drawing the page texture, the paper chip, the shadow and the motion blur belongs to the renderer you choose. Layout handles up to 20,000 words per document and one typeface style, because only Instrument Serif Regular is bundled. Line breaking is greedy and does not hyphenate. Coordinates use metres with +y up for 3D positions and millimetres from the top-left corner on the page.
