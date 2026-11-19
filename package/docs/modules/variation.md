# Organic variation

Repeated things look machine-made when every copy is identical, and they look chaotic when each copy is drawn from a wide uniform range. Real seeds, leaves and stones sit between those failures. Most copies are close to typical, a few differ more, related traits move together, and the occasional one is missing or out of line. `explainerkit/variation` gives each copy that kind of difference from a seed and its index, so the result is the same every time a frame is drawn.

```demo design-peas-in-a-pod
Start with seven peas in a pod and a case of mistaken identity. Slide the seed marker to vary their sizes and tints. Return to an earlier setting to get the same peas back.
```

## Give a row of seeds natural lengths and colours

Start with a source and ask it for each item's attributes. The example assumes a scene called `drawing` already exists.

```js
import {variation} from 'explainerkit/variation';
import {hsla} from 'explainerkit/color';

const v = variation({seed: 23, preset: 'botanical'});
for (let i = 0; i < 40; i++) {
  if (v.dropout(i)) continue;                          // a few seeds are missing
  const length = v.size(i, 60, {spread: 0.2});        // most near 60, a few longer
  const lean = v.angle(i, -Math.PI / 2, {spread: 0.1});
  const fill = v.tint(i, hsla(42, 30, 70), {h: 4, l: 6});
  drawing.line({x1: 20 + i * 14, y1: 300, x2: 20 + i * 14 + Math.cos(lean) * length, y2: 300 + Math.sin(lean) * length, stroke: fill});
}
```

Each call is a pure function of the seed, the index and the attribute. Asking for item 7's length twice gives the same number, and changing item 7 never changes item 8. Two attributes of one item are independent unless you correlate them, because each method uses its own key. Pass `key` to any method to draw another independent value of the same kind, such as `{key: 'stalk'}` and `{key: 'petal'}`.

## Choose the shape of each difference

The methods differ in the distribution they draw from. A distribution describes how often each value appears, so choosing one decides whether extremes are common or rare.

| Method | Result |
| --- | --- |
| `around(i, center, {spread})` | A normal distribution around `center`, with `spread` as its standard deviation in the value's own units. Values are clipped at three standard deviations, so nothing is absurd. |
| `size(i, typical, {spread})` | A log-normal size. The median is `typical`, the value is always positive, and a few items are noticeably larger than the rest, as with real leaves or pebbles. |
| `angle(i, base, {spread})` | A direction in radians near `base`, wrapped to the range from −π to π. |
| `between(i, low, high, {shape})` | A value in the range. The default `bell` shape favours the middle, and `uniform` does not. |
| `pick(i, {ivory: 6, sage: 3, charcoal: 1})` | One key, chosen in proportion to its weight. |
| `chance(i, p)` and `dropout(i, rate)` | `true` for about `p` of the items. `dropout` uses the preset's rate when you leave it out. |
| `misalign(i, base, {usual, rare, rate})` | Mostly a small offset, and for about `rate` of the items a larger one, like a stone set slightly out of line. |
| `tint(i, color, {h, s, l})` | A colour that differs from `color` by at most `h` degrees of hue and `s` and `l` percent. |
| `tintAt({x, y}, color, {h, s, l, scale})` | A tint that changes smoothly across space, so neighbours within about `scale` units look alike. |
| `flutter(i, time, {rate, amount})` | A drift over time between −amount and amount that wanders smoothly instead of jumping each frame. |
| `humanize(i, time, {ms})` | A start time moved by at most `ms` milliseconds, so a sequence feels played rather than quantised. |

## Make related traits agree

In nature, traits come together. Longer seed stalks tend to be darker, and a bigger leaf is usually a deeper green. `traits` draws several attributes from one hidden character, so they agree as often as you ask.

```js
const look = v.traits(i, {length: [0.75, 1.1], stiffness: [0.05, 0.2], darkness: [0, 1]},
                      {correlate: [['length', 'darkness', 0.6]]});
```

Each trait spreads evenly over its range. The correlation is a rank correlation, so `0.6` means that ordering the items by length and by darkness gives orderings that agree to that degree. Uncorrelated traits stay independent. A set of correlations that cannot hold together, such as three traits that each strongly oppose the others, is rejected with `INVALID_CORRELATION`.

## Place things in clusters

`cluster` places points around a few centres instead of on a grid or uniformly at random. The `minDistance` option keeps them from overlapping.

```js
const {points, crowded} = v.cluster({count: 120, region: {x: 0, y: 0, width: 1000, height: 600}, clusters: 4, spread: 60, minDistance: 12});
```

The work is bounded. Each point gets at most `attempts` tries (24 by default), and a point that does not fit is counted in `crowded` instead of looping forever. A large `crowded` value tells you the region is too small for the spacing you asked for.

## Presets and the amount dial

A preset names a style of variation. `natural` is the default. `botanical` varies a little more, `handmade` a little less, `architectural` keeps tight tolerances with rare deviations, and `weathered` varies most and drops more items. The `amount` option multiplies every default spread, so `amount: 0` gives identical copies and `amount: 2` doubles the variation. Spreads that you pass explicitly are used as given.

## Catch robotic uniformity

`auditVariation` reports repeated things that look generated. Give it the sizes, positions or colours you are about to draw.

```js
import {auditVariation} from 'explainerkit/variation';
const report = auditVariation({numbers: lengths, points: positions, colors: fills, name: 'seed lengths'});
for (const finding of report.findings) console.warn(finding.code, finding.message);
```

The audit names five problems. `UNIFORM_VALUES` means the values are nearly identical, and `EVEN_SPACING` means they are spaced at equal steps. `GRID_LIKE` means points sit at nearly equal distances from their neighbours, and `ALIGNED_ROWS` means they share exact rows and columns. `IDENTICAL_COLORS` means every colour is the same, and `OUTLIERS` counts values far from the rest. The audit only reads its input, and an empty `findings` list sets `ok` to `true`.

## Limits

Indexes are whole numbers from 0 to 2,147,483,647. A `traits` call accepts up to 16 traits, `pick` up to 1,000 choices and `cluster` up to 20,000 points. The audit compares every pair of points, so it accepts at most 5,000 points at once. Invalid numbers, unknown options and unknown presets are rejected by name rather than replaced with defaults.
