# Give data a visual meaning

Use `explainerkit/data` to turn measurements and categories into positions, sizes and chart shapes. The functions work in JavaScript without a browser, network access, device permissions or third-party packages. They can also feed a scene’s data sources, parameters, derived values and bindings. Use `explainerkit/geometry` when the task is constructing a shape or arranging objects spatially rather than interpreting a measurement.

A scale converts an input value from a domain into an output value in a range. In the example, measured speeds from 0–30 map to horizontal positions from 0–240. A band scale allocates equal-width positions to categories, while `summarize` calculates values for groups of rows.

```js
import {scale, bandScale, summarize, units, convert} from 'explainerkit/data';

const speed = scale({domain: [0, 30], range: [0, 240], clamp: true});
const lanes = bandScale({domain: ['walk', 'cycle', 'drive'], range: [0, 300], paddingInner: .2});
const metresPerSecond = convert(36, units.kmph, units.mps); // 10
const summaries = summarize(observations, {
  groupBy: ['mode'],
  measures: {average: {op: 'mean', field: 'speed'}, count: {op: 'count'}},
});
```

## Boundary and ownership

| Concern | Implementation | What it prepares |
| --- | --- | --- |
| Map numbers or categories. | `src/data/scales.js` | Return functions with fixed input domains and a chosen fallback for unknown values. |
| Transform tables. | `src/data/transforms.js` | Copy rows and calculate summaries, histogram bins or stacked intervals without changing the original table. |
| Convert physical units. | `src/data/units.js` | Check that dimensions match before converting values or combining unit definitions. |
| Draw chart geometry. | `src/data/plot.js` | Create path commands or a reusable axis definition that ordinary scene methods can draw and edit. |
| Update data-backed objects. | Scene `DataSource` and repeated collections. | Validate replacements before changing the source while keeping objects with surviving keys. |
| Sample and render the result. | Scene parameters, derived values, player and renderers. | Evaluate the same scene without adding another clock. |

A scale’s domain stays fixed when an unknown category appears, so data replacement cannot silently change the meaning of existing positions or colors. Table transforms also leave the caller’s rows and their order unchanged unless you explicitly request a new transformed result. Chart helpers prepare geometry without taking over its source data, story time or renderer. Your application decides when to replace data and how to display the result.

These functions use the visualization terms explained in the sections below. Official [D3 scale documentation](https://d3js.org/d3-scale/linear), [band documentation](https://d3js.org/d3-scale/band), [bin documentation](https://d3js.org/d3-array/bin) and [stack documentation](https://d3js.org/d3-shape/stack) provide references for what the operations mean. This is an independent implementation and uses no D3 code or package.

## Map a number

```js
const x = scale({domain: [0, 100], range: [30, 730]});
x(25);              // 205
x.invert(205);      // 25
x.ticks(5);         // decimal 1/2/5-step suggestions

const radius = scale({type: 'sqrt', domain: [0, 100], range: [0, 10]});
radius(25);         // 5: area, rather than radius, is proportional to value
const signed = scale({type: 'diverging', domain: [-10, 0, 100], range: [0, .5, 1]});
```

`scale({type='linear',domain=[0,1],range=[0,1],clamp=false,unknown=null,exponent,constant})` returns a function you call with an input number. Its `.map` property names that same function, while `.invert(value)` converts an output position back into an input value when the mapping can be reversed. The function and its `.domain`, `.range`, `.type`, `.clamp` and `.unknown` settings cannot be changed after creation.

Supply matching domain and range arrays with 2–64 numeric stops. Each domain stop describes an input and the corresponding range stop describes its output. Unless the two endpoints form a constant domain, the domain must increase throughout or decrease throughout. Between stops, the scale transforms the input according to its type and interpolates within that range segment. Values outside the endpoints are extrapolated unless clamping is enabled.

Choose the type according to the relationship you want to show. A linear scale gives equal distances to equal differences, while a logarithmic scale gives equal distances to equal multiplicative changes. The other types provide the specific transformations listed below.

| Type | Meaning and controls |
| --- | --- |
| `linear` | Interpolate linearly between each neighboring pair of domain and range stops. |
| `log` | Map multiplicative changes to equal distances using `sign(domain[0]) * log(abs(value))`. The whole domain must have one sign and cannot include zero. Another log base would produce the same normalized mapping with two stops. |
| `pow` | Apply the signed power `sign(x) * abs(x)^exponent` so negative inputs keep their sign. The positive `exponent` defaults to 1. |
| `sqrt` | Apply the same signed-power calculation with exponent .5. This type does not accept an `exponent` override. |
| `symlog` | Apply `sign(x) * log1p(abs(x)/constant)` so a logarithm-like mapping can include zero and both signs. The positive `constant` controls its transition around zero and defaults to 1. |
| `diverging` | Interpolate linearly through exactly three domain and range stops. The middle stop gives a meaningful center such as zero difference between negative and positive values. |

Clamping keeps both mapped values and inverse results within their endpoint ranges. Without it, the scale deliberately extrapolates beyond the supplied endpoints. To calculate an inverse, the numeric range must move consistently upward or downward. Otherwise `.invert` throws `SCALE_NOT_INVERTIBLE` because one output could correspond to several inputs.

A two-value domain whose endpoints are equal is a special case. Every finite input maps to the range midpoint, the inverse returns the constant domain value, and ticks contain that single value. A range that rises and then falls can still be used for forward mapping, but its ambiguous inverse is rejected.

Missing values, null, strings, booleans, non-finite numbers and log inputs with the wrong sign return the configured `unknown` value without numeric conversion. Its default is null, so a binding that requires a coordinate must choose a numeric fallback or reject the result. Invalid scale settings and overflowing outputs throw instead of becoming unknown or infinite geometry. Inputs and outputs are limited to ±1e100, with tighter core limits still applying to rendered coordinates.

Use `.ticks(count=6)` to suggest labeled values along an axis. Ordinary scales use inclusive ordered steps based on 1, 2 and 5, while log scales use powers of ten inside the domain. Counts accept integers from 1 to 1000, but the returned number of ticks may differ from the request. A narrow log interval may contain no power of ten, in which case supply explicit axis values.

The standalone `ticks([start,end],count)` follows the same decimal-step rule and reverses with the domain. It rejects unsupported precision rather than producing enormous or duplicate arrays. It does not format dates or times for a locale.

## Map categories and bands

```js
const color = ordinalScale({
  domain: ['observed', 'estimated'], range: ['#278b88', '#db6845'], unknown: '#9ba89f',
});
const bands = bandScale({
  domain: ['north', 'south', 'west'], range: [0, 300],
  paddingInner: .2, paddingOuter: .1,
});
bands('north');       // 10: lower coordinate of its band
bands.bandwidth;      // 80
bands.center('south');// 150
bands.invert(95);     // null: this point is in the gap
```

`ordinalScale({domain=[],range=[],unknown=null})` maps each declared category to exactly one supplied value. Categories may be strings, finite numbers or booleans, and their types remain distinct. Domain entries must be unique and the copied range must have one JSON-like value for every category. Colors are not reused when the list runs out. An unknown category returns the chosen fallback.

`bandScale({domain=[],range=[0,1],paddingInner=0,paddingOuter=0,align=.5,unknown=null})` gives each category an equal-width interval. Inner padding accepts 0–1 of a step, outer padding accepts 0–10 steps on either side, and alignment accepts 0–1. Read `.bandwidth`, `.step` and `.center(value)` to place marks inside those intervals.

A reversed range reverses category order, but each returned coordinate is still that band’s lower bound. `.invert(position)` finds a category only from its included left edge up to its excluded right edge and returns no category in gaps. Empty domains and zero-width bands cannot be picked. There may be at most 10,000 categories.

## Transform a table

Pass each table transform an array of at most 10,000 plain records without empty slots. The function inspects and copies the records using the same JSON-like data rules as the scene. Getters, functions, other executable values, reserved fields, excessive nesting and excessive total values are rejected. A missing field is not silently converted to zero, so choose a missing-data policy before calculating a chart.

### Map, filter and replace

`mapRows(rows,fn)` calls `fn(frozenRow,index)` for each row and copies the record it returns into the new table. Use `filterRows(rows,predicate)` to keep rows for which the callback returns true. Its result must be boolean rather than merely truthy. Both callbacks are application code you supply and trust. They are not parsed from expression strings or run in a sandbox. A callback exception reports `MAPPING_FAILED` with the original error in `cause`.

```js
const source = drawing.data([{id: 'a', distance: 10}], {key: 'id'});
replaceMapped(source, incomingRows, row => ({
  id: row.id,
  distance: convert(row.centimetres, units.cm, units.m),
}));
```

Use `replaceMapped(target,rows,fn)` when incoming rows must be transformed before replacing an existing scene data source. It prepares and validates the whole table, then calls `target.replace` once. The data source checks every dependent collection before the replacement becomes visible.

If a callback fails or a mapped value would produce invalid geometry, the old rows and displayed frame remain intact. Objects whose keys survive keep their identity and local overrides. The function performs one replacement without subscribing to another source, creating a clock or deciding who owns an external data feed.

### Summarize

`summarize(rows,{groupBy=[],measures={count:{op:'count'}},missing='error'})` groups rows and returns immutable records containing the requested measures. Groups appear in the order their keys first occur. Group fields must be present and contain strings, finite numbers, booleans or null. Their types stay distinct, so numeric `1` and string `'1'` do not form the same group.

Choose up to 16 distinct grouping fields and 64 named measures. A measure name cannot replace a grouping field in the output. With no `groupBy` fields, all rows form one summary, which is useful for a total or overall mean.

Define each summary measure with `{op,field}`. Use `count` to count rows without a field, or `valid` to count present numeric values in a field. `sum`, `mean`, `min`, `max` and `median` calculate the corresponding statistic for one numeric field. Numeric strings are invalid.

By default, null or missing numeric values are rejected. `missing:'skip'` excludes them, although a present value of another invalid type is still rejected. With no valid observations, sum and valid count are zero while mean, minimum, maximum and median are null. Empty ungrouped input returns one aggregate record, whereas empty grouped input returns no groups.

The sum uses a compensation term to reduce errors when floating-point additions cancel. Means divide values before adding them to avoid an overflowing total when the final average would fit. These calculations still use floating-point arithmetic rather than arbitrary precision. A mean is neither a weighted estimate nor evidence of causation. The module does not perform weighted inference, propagate uncertainty or fill in missing observations.

### Bin

Use `bin(rows,{field,domain:[min,max],thresholds=10,missing='error'})` to group a numeric field into histogram intervals. The result includes `bins`, `missingCount` and `outsideCount`. Each bin records `{x0,x1,count,rows}` and includes copied source records, so you can inspect which observations contributed to it.

The increasing domain includes both endpoints. An observation exactly on an interior boundary goes into the bin to its right. Other upper edges are excluded, except the final upper edge, which is included. This follows the [documented histogram interval convention](https://d3js.org/d3-array/bin) and prevents one observation from being counted twice.

Set `thresholds` to an integer from 1 to 1000 to request that exact number of equal-width bins, or supply up to 999 strictly increasing interior boundaries. Empty bins remain in the output so separate charts can keep the same intervals. Observations outside the domain are counted separately, and `missing:'skip'` also counts null or missing observations separately.

The function does not guess boundaries or round domain endpoints to convenient values. Keep explicit edges unchanged when comparing histograms from different datasets or revisions so each bar continues to describe the same interval.

### Stack

`stack(rows,{key,fields,offset='zero',missing='error'})` prepares one series for each field, returning `{field,values:[{key,value,y0,y1,row}]}`. Keys must be unique nonempty strings or finite numbers, and both row and field order are preserved. A zero-offset stack accumulates positive and negative values separately, with `y1-y0` equal to the signed original value.

Use `offset:'expand'` to normalize each nonnegative row to one. Zero rows remain zero. With `missing:'skip'`, null or missing cells contribute zero. The raw `value` remains beside the normalized limits so it can still be inspected or labeled.

A stack accepts at most 64 distinct fields and produces no more than 100,000 output cells. It does not choose series order, calculate a wiggle or streamgraph offset, or infer statistical normalization. A diverging stack accumulates positive and negative values separately, so do not label their totals as one ordinary cumulative sum.

## Use mappings in a scene

```js
const data = drawing.data([{id: 'a', value: 1}, {id: 'b', value: 10}], {key: 'id'});
const marks = drawing.repeat(drawing.component({type: 'circle', props: {r: 5}}), {data});
marks.bind('x', {field: 'value', scale: scale({type: 'log', domain: [1, 100], range: [30, 730]})});
```

A collection binding can use a trusted scale function or a linear-scale options object. Before replacing rows, the collection checks every mapped property against the complete new dataset. A missing numeric result from a logarithmic scale cannot silently become a coordinate. Errors for missing row fields remain separate from errors for unknown scale inputs.

Use a derived input when a plotted path should update with scene data or a parameter. The example recalculates a line when either its rows or gain changes.

```js
const curve = drawing.derive([data, gain], (rows, g) =>
  linePath(rows, {x: 'time', y: 'value', xScale, yScale: v => yScale(v * g)}));
path.bind('commands', {inputs: [curve], map: commands => commands});
```

Combine these transforms inside a derived computation. They recompute their output when called rather than maintaining a database or tracking changes between calls. Retain source IDs and explicit units when defining derived scientific quantities.

## Plot ordinary geometry

`linePath(rows,{x='x',y='y',xScale,yScale,missing='gap'})` creates a path in the supplied row order. Null or missing observations and null or undefined scale results split it into separate move/line sections. Choose `missing:'error'` to reject those gaps instead. Invalid numeric types, non-finite data and coordinates beyond renderer limits are always rejected. Sort rows yourself when needed because the helper preserves trajectory order.

`areaPath(rows,{x='x',y0='y0',y1='y1',xScale,yScale,missing='gap'})` creates a filled region by following its upper edge forward and its baseline backward, then closing each valid segment. This can draw stacked intervals prepared by `stack`. It leaves gaps rather than interpolating across missing observations and does not guarantee that an outline cannot cross itself.

Both line and area helpers accept trusted scale functions. Their output must fit the core’s 10,000-command path limit. An area’s upper and lower edges share that one limit rather than receiving separate command allowances.

```js
const xAxis = drawing.instance(drawing.component(axisBlueprint(xScale, {
  orientation: 'bottom', x: 0, y: 300, count: 5,
  format: value => `${value} s`,
})));
xAxis.part('label1').set({fill: '#db6845'});
```

`axisBlueprint(mapping,{orientation='bottom',x=0,y=0,count=6,values,format,tickSize=6,padding=4,fontSize=12,stroke,fill})` returns an immutable component definition for an axis without creating scene nodes. Choose `bottom`, `top`, `left` or `right` orientation. Numeric scales suggest ticks and band scales use category centers, while explicit `values` overrides those choices.

The `format(value,index)` callback must return text. Parts named `domain`, `tick0`, `label0` and so on remain editable scene geometry, with at most 512 ticks. The axis does not measure text, solve overlapping labels or update itself after replacing a scale. Rebuild or edit the affected parts and plan responsive chart layout separately.

## Keep dimensions honest

```js
const acceleration = divideUnits(units.mps, units.s);
const area = powerUnit(units.cm, 2);
convert(10000, area, powerUnit(units.m, 2)); // 1
convert(1, units.m, units.s);               // throws UNIT_MISMATCH
```

`defineUnit({symbol,dimensions={},scale=1,offset=0})` describes conversion to a base unit as `baseValue = value * scale + offset`. Its seven SI dimensions are length, mass, time, current, temperature, amount and luminousIntensity, following the [BIPM SI reference](https://www.bipm.org/en/measurement-units). Dimension exponents are integers from −16 to 16, with a positive finite scale and a finite bounded offset.

`convert(value,from,to)` requires identical dimension exponents. Converting a unit to itself preserves tiny values, and other conversions use a scale ratio to avoid an unnecessary intermediate underflow. If a zero-offset result would become too small to represent, it throws `NUMERIC_UNDERFLOW` rather than reporting a measured zero. `multiplyUnits`, `divideUnits` and `powerUnit(unit,integer)` combine zero-offset units. Convert Celsius or another unit with an offset to a zero-offset representation before multiplication or exponentiation.

Available units are `one`, `m`, `cm`, `mm`, `km`, `s`, `ms`, `min`, `h`, `kg`, `g`, `A`, `K`, `degC`, `mol`, `cd`, `rad`, `deg`, `mps` and `kmph`. Angles count as dimensionless, so conversion between radians and degrees works without making angle distinct from every other dimensionless quantity. Pixels and scene units are not assumed to be metres. There is no unit-string parser, uncertainty calculus, automatic prefix selection, currency conversion or check of physical plausibility.

## Verification and limits

Native tests compare scale positions and inverse results against independent calculations. They cover negative log domains, signed powers, constant and empty domains, picking within band gaps, sums affected by cancellation, exact bin boundaries, signed and normalized stacks, unit conversions, missing plot segments and editable axes. Replacement tests also check that a failed mapping leaves the previous rows and geometry intact. Input inspection rejects getters without calling them.

These tools map and transform supplied data within declared limits. They do not provide general statistical inference, symbolic equation solving, a persistent database, a scientific simulation or a live sensor connection. Preparing valid chart geometry also does not prove that its visual encoding is accurate to human perception, accessible or readable at every screen size. Check those presentation decisions separately and observe the selected renderer’s resource limits.