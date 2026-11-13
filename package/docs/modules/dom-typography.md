# Animate the page you already have

Use `explainerkit/dom` to apply scene values to existing HTML/CSS elements. Use `explainerkit/typography` to animate text that you can seek forward or backward on the same timeline. They use no third-party libraries, Web Animations timeline or independent animation-frame loop. SVG/Canvas remain the scene renderers; this is an additional browser adapter for ordinary page content.

Keep the existing element. Let the same parameter move the diagram and its heading.

## Bind an existing element

```js
import {bindDOM} from 'explainerkit/dom';

const lift = drawing.parameter(0, {min: 0, max: 100});
lift.to(0, 100, {duration: 2});
const adapter = bindDOM(drawing, [{
  element: document.querySelector('.callout'),
  inputs: [lift],
  map: (value, context) => ({
    y: context.reducedMotion ? 0 : -value,
    opacity: 1,
  }),
}], {player});

adapter.dispose(); // Restore the exact original inline style attribute.
```

`bindDOM(scene, bindings, {player,onError,reducedMotion='respect'})` returns `{update,dispose,time,disposed,reducedMotion,error}`. Each binding has `{element,inputs=[],map}`. Elements stay in their original DOM positions; neither their children, text, classes nor non-style attributes are edited. Inputs must be this scene's parameters, derived values or data sources. Callbacks receive the sampled values followed by `{time,width,height,reducedMotion}`. Width/height use the player's successfully displayed frame when available, otherwise the scene's authored dimensions.

Return numeric transform and opacity values as `{x=0,y=0,rotation=0,scaleX=1,scaleY=1,opacity=1}`. Translation uses CSS pixels and rotation uses radians. The adapter builds `translate(x,y) rotate(rotation) scale(scaleX,scaleY)` while leaving CSS `transform-origin` behavior unchanged. This order follows the [CSS Transforms specification](https://www.w3.org/TR/css-transforms-1/). Convert scene coordinates to screen coordinates explicitly when an HTML label needs to follow a scene object.

Only transform and opacity styles are written. There are no arbitrary CSS strings, selectors, URLs, style expressions, markup insertion or dynamic code evaluation. Opacity is bounded [0,1], scales ±10,000, translation/rotation follow the existing finite-number bounds. The adapter overwrites those inline transform/opacity declarations while attached; it does not parse or compose a preexisting CSS transform. Normal CSS cascade rules still apply. Set a separate wrapper or map the complete desired transform when preserving another transform is necessary.

### One clock, explicit failure

When supplied with a player, the adapter follows its frame events and is disposed with it. Those events already follow scene-input changes, so the adapter does not add a second subscription that could render an old time during a seek or reset. Without a player it responds to scene changes at its last sampled time. Call `adapter.update(seconds)` to connect an external clock explicitly. The module creates no animation-frame or polling loop.

Every binding is evaluated and validated before any style mutation. A bad output preserves all elements' previous valid styles. Commit exceptions attempt to restore every element's previous style, reporting `DOM_COMMIT_FAILED` with the cause and `rollbackErrors`; an external DOM implementation that also refuses restoration cannot be promised transactional recovery. A guarded frame/input failure records `adapter.error`, pauses the supplied player, invokes `onError(error)` if provided and reports through the player error channel. It does **not** rewind a player timestamp that already committed before emitting its frame event, or roll back the scientific parameter that supplied the bad value. Explicit `update` throws its diagnostic to the caller.

Only one active adapter can control an element. Duplicate elements or a second owner report `DOM_OWNED`. Construction validates the whole set before attaching, and a failed start restores original styles and releases ownership. One document can contain 1–2048 bound elements, with at most 64 inputs per binding and 16,384 input references total. Input arrays are copied and must have no empty slots. Foreign-scene inputs and getter-valued options are rejected.

`dispose()` is terminal and idempotent. It unsubscribes frame/scene/dispose/media listeners, restores the **exact original style attribute text and presence**, and releases its records/inputs/callback references. An absent original style attribute is removed rather than replaced by `style=""`. Restoration owns that original attribute snapshot; unrelated style edits made by the application while attached are not merged. Dispose before handing the element to another styling owner.

### Reduced motion

`reducedMotion:'respect'` exposes the current `prefers-reduced-motion` value in mapping context and refreshes on live preference changes. `allow` disables this adapter preference signal. A generic mapping may represent layout or a measurement, so the adapter does not invent a static replacement pose. The author chooses it using `context.reducedMotion`; a supplied player separately applies its existing reduced-motion playback policy. This differs from kinetic entrances, where revealing the full phrase is an intentional default.

## Split a phrase without losing its meaning

```js
import {kineticText} from 'explainerkit/typography';

const title = kineticText(document.querySelector('h1'), {split: 'words'});
const entrance = title.bind(drawing, {
  player,
  at: 1,
  duration: .6,
  stagger: .05,
  from: {y: 20, opacity: 0},
});
// Each word uses the same scene/player time; backward seek is exact.
title.dispose(); // Original text and child-node identities return.
```

`kineticText(element,{split='words',locale,fallback='auto'})` returns `{text,method,tokens,sample,bind,dispose,disposed}`. It supports ordinary HTML text containers such as headings, paragraphs, spans, divs, captions, labels, buttons and links. Children may contain text or simple noninteractive phrasing elements (span/strong/em/b/i/u/small/sub/sup/mark/s/code/br). Interactive descendants, editors, identified descendants, focusable nodes, media and form controls reject before mutation. A root link/button remains the existing interactive element; nested links/buttons are not fragmented.

The visual presentation is plain text with inherited styling, not a rich-text style-preserving clone. A `<br>` becomes a visual newline. Original phrasing nodes are kept, never serialized or recreated. While attached, a visually hidden semantic span contains the original nodes and full readable content; a separate visual span contains tokens and is marked `aria-hidden="true"`. This avoids exposing a heading as dozens of duplicated character labels. The original host's role, aria-label and other attributes remain unchanged. [WAI-ARIA aria-hidden guidance](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).

Whitespace is preserved as text nodes in a `white-space:pre-wrap` visual wrapper. Non-whitespace segments become inline-block token spans. Punctuation segments can therefore be separate tokens under locale-aware word segmentation. The original whitespace/content and each child-node identity return on `title.dispose()`, including listeners on original phrasing nodes. The split copy is not editable; dispose before changing the source text or handing children to another owner. Document selection/copy may include both DOM copies depending on browser behavior; this module does not claim a complete rich-text editor or clipboard solution.

### Words and graphemes

`segmentText(text,{split='words',locale,fallback='auto'})` is separately exported and pure. It returns `{text,split,method,segments:[{text,start,end,whitespace}]}` with UTF-16 offsets. The concatenated segment text exactly matches the input. A grapheme is a character as a reader perceives it, which may use several Unicode code points. `Intl.Segmenter` supplies locale-aware word and grapheme boundaries when available. [Intl.Segmenter documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter).

Use `fallback:'error'` to require `Intl.Segmenter`, `simple` to select the fallback directly, or `auto` to use it only when Intl is unavailable. The fallback keeps combining marks, variation selectors, tested emoji modifier and ZWJ sequences, regional-indicator pairs and CRLF together. Its word mode splits runs of whitespace and non-whitespace.

The fallback is **not a complete Unicode grapheme-break implementation**. Complex Indic and Hangul segmentation and full locale word rules require Intl. Inspect `method:'fallback'` to detect the reduced behavior. Limits are 20,000 UTF-16 code units, 4096 segments and 2048 animated non-whitespace tokens. Invalid modes, locales and excessive text are rejected.

### Entrance controls

`title.sample(time,{at=0,duration=.6,stagger=.04,order='forward',from,reducedMotion='respect'})` manually samples an entrance without a clock. `from` accepts numeric `{x=0,y=18,rotation=0,scale=1,opacity=0}`. Each token approaches its identity transform and opacity 1 through an ease-out cubic. The return value contains `{time,progress,end}`. It is a pure time-to-pose calculation with explicit DOM application; reverse samples do not accumulate transforms.

Choose `order` as `forward`, `reverse` or `center`, with center-first ties resolved consistently. A token starts at `at + rank*stagger` and the last one finishes at `at + (count-1)*stagger + duration`. Duration accepts .001–3600 seconds, stagger accepts 0–3600 seconds, and the total end cannot exceed 86400.

With reduced motion, all tokens are visible at their final positions even before the authored start. This keeps essential words available in paused or reduced-motion stories. Manual sampling reads the preference each time it is called.

`title.bind(scene,{player,onError,...entranceControls})` connects the entrance to the DOM adapter and existing scene/player clock. It returns `end`, `update(time)`, `dispose()` and `disposed`. Set enough scene duration to include `end` because the reported value does not extend the scene or narration. Only one binding can control the text at a time, and manual sampling is rejected until that binding is detached.

Disposing the binding restores token styles and stops animation while leaving the split text available. Disposing the text object restores the original children. Disposing the supplied player disposes both objects. Empty phrases follow the same cleanup rules without scheduling work.

The typography layer does not claim font shaping, arbitrary line breaking, glyph outlines, variable-font interpolation, production text-layout solving or full bidi/editor behavior. These native DOM tokens use the browser's font/layout engine; a grapheme is not necessarily one glyph. For a precise comparison or accessible interactive heading, author testing remains necessary.

## Verification

Native tests check existing-element identity, parameter/derived projection, exact original inline styles, missing style-attribute restoration, input ownership, output preflight, simulated mid-commit rollback, listener disposal, reduced-motion signaling, combining/emoji/flag segmentation, whitespace and stagger boundaries. Browser fixtures check computed CSS matrices/opacity, forward/reverse player seeks, direct input changes, restored original phrasing-node identity/attributes, full semantic text with hidden visual tokens, reduced-motion changes and rejected interactive descendants. No external DOM emulation package is used.

Browser evidence is local headless Chrome. Screen-reader behavior, real-device text selection, complex bidi shaping, every locale and cross-browser font layout still require direct testing. These checks validate implemented contracts without treating missing accessibility evidence as a pass.
