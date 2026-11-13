# Letters as geometry

`explainerkit/import/font` reads font bytes and turns letter outlines into ordinary ExplainerKit paths. It does not use a font-parser library, browser font-outline service or three.js.

```js
import {loadFont, textOutline} from 'explainerkit/import/font';
const font = await loadFont(fileInput.files[0]);
const letters = textOutline(font, 'Aleph', {size: 72, x: 20, y: 100});
const title = drawing.path({commands: letters.commands, fillRule: 'nonzero'});
```

Use `parseFont(bytes)` when bytes are already available and synchronous parsing is needed. `loadFont(bytesOrFileOrBlob)` also reads supplied input asynchronously and decodes WOFF 1.0. Neither function fetches a URL or searches installed fonts. Source data is copied and limited to 16 MB.

Supported outlines use the TrueType `glyf` table inside an SFNT font or WOFF 1.0 container. WOFF2, CFF/OTF outlines and font collections are unsupported. A filename ending in `.otf` does not prove which outline format it contains. Color and bitmap rendering are not supported, although unknown color tables may be ignored when monochrome `glyf` outlines are available. Depending on the container and required tables, invalid input reports `FONT_FORMAT_UNSUPPORTED` or `FONT_INVALID`.

Kerning table construction and each `textOutline` query have separate four
million-operation budgets. Shared coverage/class tables and repeated lookup
offsets are cached or deduplicated. WOFF1 validates aggregate declared table
size and caps sequential inflation; a small compressed input does not authorize
an unbounded expanded font. These limits fail with coded errors and do not
establish support for arbitrary malformed fonts or complex text shaping.

## Load a font from a page

The example uses package imports through a bundler or an import map and assumes
`<div id="stage"></div>` exists. In a plain page served from this repository's
root, replace the three import paths with `./src/index.js`,
`./src/import/font.js` and `./src/typography/index.js` respectively.

Host your chosen TrueType-outline font at a URL served with the page, then fetch
and parse the bytes explicitly. The example URL is an application asset you
supply; the parser does not choose or download a font on its own.

```js
import {scene} from 'explainerkit';
import {parseFont} from 'explainerkit/import/font';
import {glyphs} from 'explainerkit/typography';

const response = await fetch('/assets/fonts/MyFont.ttf');
if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
const font = parseFont(bytes);

const drawing = scene({width:960, height:540});
drawing.registerFont('Display', font);
drawing.text({text:'A measured heading', fontFamily:'Display',
  fontSize:48, x:60, y:90});
const equation = glyphs(drawing, '1=1', {font, size:120, x:100, y:260});
const player = await drawing.mount(document.querySelector('#stage'));
```

Registering the parsed face makes semantic `scene.text` draw self-contained
outlines. `glyphs` receives that same parsed object directly. Neither requires
CSS `@font-face` or `document.fonts.ready`. If you instead want native browser
text without registered outlines, load its CSS face separately and await
`document.fonts.ready` before browser-dependent measurements. See
[glyph objects](glyph-objects.md) for individual-letter editing.

Serve font files with their usual types, `.ttf` as `font/ttf`, `.otf` as
`font/otf` and `.woff` as `font/woff`. The file's HTTP MIME type does not expand
parser capabilities. In particular, `parseFont` reads SFNT bytes; use
`await loadFont(bytes)` for WOFF 1 decoding. WOFF2 is neither a supported parser
format nor a currently served font suffix. A failed fetch or unsupported font
should be shown by the page's error handler (or a `mount` scene-builder error
overlay), rather than silently falling back to another face.

## What is parsed

The parser reads and bounds-checks the directory, `head`, `maxp`, `hhea`, `hmtx`, `loca`, Unicode `cmap` formats 4 and 12 and `glyf` tables. Simple contours retain quadratic controls and implied on-curve points. Composite glyphs recurse through supported translation/scale/2×2 transforms with cycle/depth limits. Point-matched composite components reject explicitly. TrueType hint instructions are skipped as bounded bytes and never executed.

The immutable font exposes `unitsPerEm`, `glyphCount`, `axes`, `format` and `glyph(index)`. Glyphs contain their index, advance and captured outline commands in y-up font units. The glyph cache is bounded; caller changes to source bytes cannot alter the parsed font.

`textOutline(font,text,{size=72,x=0,y=0,letterSpacing=0,axes={},missing='error'})` returns frozen `{commands,advance,glyphs,diagnostics}`. Its baseline is in the scene's y-down coordinate system. Each Unicode code point maps through the font's cmap; glyph advance and explicit letter spacing position the next glyph. Empty outlines such as spaces still advance. Missing glyphs reject unless `missing:'notdef'` explicitly requests glyph 0.

This is basic Unicode-to-outline layout, **not a shaping engine**. It applies pair kerning (GPOS PairPos or the legacy `kern` table; `kerning:false` turns it off) but does not implement GSUB substitutions, mark positioning, bidirectional layout, script-specific substitutions, mark attachment, hinting or text layout across lines. For accessible flowing text, use ordinary HTML/kinetic typography; outlines are for geometric artwork, with an accessible text equivalent supplied by the author.

## Variable-font axes are an explicit boundary

`fvar` axis metadata is read when present. Nondefault axes—for example `{axes:{wght:700}}`—instantiate the outline through `avar` and `gvar` deltas with IUP inference, composite offsets and phantom-point advances, matching fontTools on the tested system fonts. A font with axes but no `gvar` rejects nondefault values with `FONT_VARIATION_UNSUPPORTED`. See the [film kit](film-kit.md#type-woff-kerning-and-variable-axes).

Text is capped at 2048 glyphs and 10000 commands. Glyph components are depth-limited and all reads stay inside their tables. Checksums, full OpenType validation and arbitrary hostile-font assurance are not certified by these structural tests.

## Verification

First-party generated SFNT fixtures independently specify cmap mappings, triangular contours, blank spaces, metrics and transformed composite glyphs. Tests check exact coordinates, baseline flip, advance, ownership, malformed offsets and unsupported formats. Browser checks load a local File and draw its outlines on SVG/Canvas. A local system TrueType file was also parsed for a mixed Latin/accented phrase; those font bytes are not included in the repository or required by the test suite.
