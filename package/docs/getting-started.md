# Your first ExplainerKit scene

A scene stores the shapes and values in your explanation together with the changes you want to happen over time. Sampling the scene calculates one moment as data, and a renderer turns that data into a picture on the page. Try the interactive example to see that relationship, then use either the npm or plain HTML instructions to build the same kind of view in your project.

```demo first-scene
One scene, any moment. Play the animation or seek backwards to see how the scene becomes a frame.
```

## Choose how to use ExplainerKit

Choose the route that matches the project you already have. An npm project uses a build tool such as Vite to find package imports, while a plain HTML page imports JavaScript files directly through a `<script type="module">` tag. Both routes use the same scene and renderer APIs, so the scene you build below works in either one.

ExplainerKit is an alpha release, so its APIs may still change before a stable version. Use the table to check which requirements apply to your setup. The core, SVG and Canvas modules require no third-party runtime packages.

| What you are doing | What you need |
| --- | --- |
| Install the npm package | Node.js 22 or later and npm, with a build tool that resolves package imports |
| Load the modules from plain HTML | A page served over HTTP or HTTPS, opened in a browser that supports JavaScript ES modules |
| Use the optional Three.js renderer | A Three.js ES module in the range `^0.186.1`, passed to the renderer. See [Add Three.js for 3D](#add-threejs-for-3d). |
| Decode recorded instruments or play a cue | Decoded PCM for analysis or sampled instruments. The [music guide](modules/music.md) explains the browser APIs and recording assets involved. |

## Install in an npm project

Run the following command in your application project. It adds ExplainerKit to the project's dependencies, and your build tool can then resolve imports such as `explainerkit` and `explainerkit/renderers/svg`.

```sh
npm install explainerkit
```

The package installs as ES modules with TypeScript declarations, so editors can check calls before the code runs. It has no required runtime dependencies. Three.js is an optional peer dependency that you install only when you use the 3D renderer.

## Create a scene

In the application module, create a 320 × 180 scene and add a circle with an initial x position of 40. The call to `to()` schedules its move to x = 200 at time 1, with a duration of one second, so the circle waits for a second before beginning to move. Sampling at time 1.5 therefore returns x = 120 without playing the earlier frames.

```js
import {scene} from 'explainerkit';

const drawing = scene({width: 320, height: 180, label: 'A moving circle'});
const circle = drawing.circle({x: 40, y: 90, r: 16, fill: '#34766b'});
circle.to(1, {x: 200}, {duration: 1, ease: 'linear'});

// Calculate this exact moment, without playing the earlier frames.
const halfway = drawing.sample({time: 1.5});
console.log(halfway.children[0].props.x); // 120
```

## Render a frame

The sample above calculates the circle position but does not draw anything by itself. Add `<div id="stage"></div>` to your HTML, then place the following code after the scene example in the same JavaScript module. The SVG renderer uses that element as its container and draws the frame calculated for time 1.5, matching the value inspected above.

```js
import {createSVGRenderer} from 'explainerkit/renderers/svg';

const mount = document.querySelector('#stage');
const renderer = createSVGRenderer(mount, {label: drawing.label});
renderer.render(drawing.sample({time: 1.5}));
// Call renderer.dispose() when you remove this example from the page.
```

An import such as `explainerkit` names a package, so a build tool is needed to find the corresponding file in an npm project. A browser loading plain HTML does not perform that package lookup automatically. Use the complete file URLs in the next section when the page has no build tool.

## Use plain HTML without npm

A plain HTML page can import ExplainerKit straight from a CDN that serves npm packages, such as jsDelivr. Each import names a complete URL, and the version in that URL pins the page to one release so that a later release cannot change it unexpectedly. Save the following document as `first-scene.html` and serve its folder over HTTP, for example with `python3 -m http.server 8080`. Then open the page through that server at `http://localhost:8080/first-scene.html`.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My first ExplainerKit scene</title>
<div id="stage"></div>
<script type="module">
  import {scene} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/index.js';
  import {createSVGRenderer} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/renderers/svg.js';

  const drawing = scene({width: 320, height: 180});
  drawing.circle({x: 120, y: 90, r: 16, fill: '#34766b'});
  const renderer = createSVGRenderer(document.querySelector('#stage'));
  renderer.render(drawing.sample({time: 0}));
  // Call renderer.dispose() when this view is removed.
</script>
</html>
```

A green circle should appear on the page. The example draws it immediately, without motion, so a visible circle confirms that the modules loaded and the renderer ran. If nothing appears, the browser's developer console names the import or call that failed.

The `type="module"` attribute matters because the library is a set of ES modules that import one another, not a single classic-script bundle. Loading it through `<script src="…"></script>` does not work, and no global `ExplainerKit` variable is created. Opening the file directly from disk does not work either, because browsers refuse module imports from `file://` pages.

Every module the package exports is a file under `src/` at the same version. Most package names follow the folder layout, so `explainerkit/renderers/canvas` is `src/renderers/canvas.js` and `explainerkit/motion` is `src/motion/index.js`, but a few do not. The `exports` field of the package's `package.json` lists the file behind every name. An import map can let the page write the shorter package names instead, as long as it maps each name to its complete URL.

### Host the files yourself

A page can also load ExplainerKit from its own server instead of a CDN. After `npm install explainerkit`, copy the folder `node_modules/explainerkit/src/` into your site and change the imports to point at that copy, for example `./explainerkit/src/index.js`. Keep the whole folder together, because each module imports others from beside it. The server must send JavaScript files with a JavaScript content type, which ordinary static servers do.

### Add Three.js for 3D

The 3D renderer needs a compatible Three.js ES module, while SVG and Canvas remain independent of it. Load Three.js yourself and pass its module namespace as `THREE`, so ExplainerKit uses the copy your page selected rather than downloading another one. The example loads both libraries from the CDN at pinned versions.

```html
<div id="three-stage"></div>
<script type="module">
  import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
  import {scene} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/index.js';
  import {createThreeRenderer} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/renderers/three.js';

  const drawing = scene({width: 300, height: 200});
  drawing.rect({x: 100, y: 50, width: 100, height: 100, depth: 30, fill: '#34766b'});
  const renderer = createThreeRenderer(document.querySelector('#three-stage'), {THREE});
  renderer.render(drawing.sample({time: 0}));
  // Call renderer.dispose() when this view is removed.
</script>
```

The page should show a green square, which is the front face of a box 30 units deep seen straight on. In an npm project, run `npm install three` and import it as `three` instead. The package declares the supported Three.js versions as `^0.186.1`, and a version outside that range may change behavior the renderer depends on.

## Continue building

Once a frame appears on the page, use the [runtime guide](runtime-api.md) to connect values and interactions to the same scene. The [module map](modules/index.md) helps choose a tool for a specific construction, and [TypeScript support](types.md) explains what the editor can check before execution. If a call fails, look up its [error code](error-codes.md) to understand the input or capability that needs attention.
