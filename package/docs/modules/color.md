# Color: procedural HSLA, explicit conversions

```js
import {hsla, adjust, mix, toHex, toRGBA, toHSLA} from 'explainerkit/color';
```

Use HSLA to create related colors by keeping a hue family while changing saturation, lightness or opacity. HSLA describes hue in degrees, saturation and lightness in percentages, and alpha as opacity. It is the preferred representation for new procedural color work in ExplainerKit. Use linear-light RGB instead when calculating lighting, combining pixels or measuring contrast.

```js
const base = hsla(170, 60, 40, 0.9);
const pale = adjust(base, {l: 80, s: 35});
const ramp = mix(base, pale, 0.5);
drawing.circle({x: 100, y: 100, r: 30, fill: base});
```

RGB-derived achromatic colors have hue zero. HSL inputs retain their declared hue
and saturation even at black/white or zero saturation, so later adjustments can
recover the intended color family.

`hsla(h,s,l,a)` returns a numeric CSS HSLA string. Hue wraps around 360 degrees, saturation and lightness use **0–100**, and alpha uses **0–1**. Validation rejects values outside those ranges, non-finite numbers and records with getters. `adjust` replaces the supplied channels without adding deltas or changing the input.

| Operation | Result |
| --- | --- |
| `toHSLA(color)` | Return a frozen `{h,s,l,a}` record that preserves declared HSL channels. |
| `toRGBA(color)` | Return a frozen `[r,g,b,a]` array with every channel in 0–1. |
| `fromRGBA(r,g,b,a)` | Convert normalized channels into a frozen HSLA record. |
| `hslaToRGBA({h,s,l,a})` | Convert to normalized RGBA without asking the browser to parse a color. |
| `toHex(color)` | Return eight-digit `#rrggbbaa`, rounded to 8 bits per channel. |
| `toCSS(color)` | Return a numeric HSLA string. |
| `mix(a,b,t,{space,hue})` | Calculate a color at progress 0–1. The default uses HSLA and the shortest hue arc. |
| `colorInterpolator(a,b,{space})` | Return a color-sampling function that defaults to premultiplied-alpha sRGB. |

The parser accepts bounded hex, the supported simple color names, HSLA records,
and numeric `hsl()`/`hsla()` strings. Comma syntax and space/slash syntax are
supported; hue may have a `deg` suffix, and alpha may be a percentage. This is an
explicit subset, not a full CSS parser. `url`, `var`, `calc`, arbitrary named colors,
relative color syntax and executable getters are not accepted.

HSLA mixing uses the shorter hue arc by default. Select `longer`, `increasing`, or
`decreasing` explicitly. When one endpoint is gray, use the other endpoint's hue
to avoid an arbitrary detour through red. Alpha interpolates independently. HSLA
mixing is artistic interpolation, not premultiplied physical compositing.

Use `colorInterpolator` or `mix(a,b,t,{space:'srgb'})` for interpolation in sRGB. Choose `linearRGB` to decode into linear-light values before interpolating premultiplied colors and encode afterward. The `explainerkit/morph` color export uses this same implementation.

Scene paint, gradients and texture colors normalize HSL to validated hex before
rendering. Thus SVG, Canvas and optional rendering adapters do not need their own
color parsers. Contrast measurements use sRGB relative luminance, not HSL lightness.
Tests cover numeric oracles, hue wrapping, alpha, conversion round trips, scene
paint integration, unsafe strings, and strict TypeScript consumers.
