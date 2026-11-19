# Your first ExplainerKit scene

Can a tiny robot clear the gap? Play the jump, then drag the time slider back to 1.50 seconds to catch it in the air. The scene stores the robot and its motion. Sampling the scene gives you its pose at the time you choose, and the SVG renderer draws that pose.

```demo first-scene
The position beside the jump comes from the same frame the renderer draws.
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

Draw the robot as a group so its body and eyes travel together. The platform rectangles belong to the scene directly, so they stay in place. The robot starts at x = 126 and travels to x = 354. A second track raises it and lowers it during that trip. At 1.50 seconds the robot is over the middle of the gap, at x = 240 and y = 75.

```js
import {scene} from 'explainerkit';

const drawing = scene({width: 480, height: 228, label: 'A robot jumps across a gap'});
drawing.rect({x: 0, y: 172, width: 184, height: 56, fill: '#39796e'});
drawing.rect({x: 296, y: 172, width: 184, height: 56, fill: '#39796e'});

const robot = drawing.group({x: 126, y: 141});
robot.rect({x: -24, y: -20, width: 48, height: 49, rx: 11, fill: '#f9b348'});
robot.rect({x: -17, y: -13, width: 34, height: 23, rx: 8, fill: '#193b37'});
robot.circle({x: -6, y: -2, r: 3, fill: '#f4fba3'});
robot.circle({x: 7, y: -2, r: 3, fill: '#f4fba3'});

robot.to(0.65, {x: 354}, {duration: 1.7, ease: 'linear'});
robot.to(0.65, {y: 75}, {duration: 0.85, ease: 'easeOut'});
robot.to(1.5, {y: 141}, {duration: 0.85, ease: 'smooth'});

const frame = drawing.sample({time: 1.5});
const {x, y} = frame.children.find(child => child.id === robot.id).props;
console.log(x, y); // 240, 75
```

## Render a frame

The sample above contains the robot’s pose as data. Add `<div id="stage"></div>` to your HTML, then put the following code after the scene example in the same JavaScript module. The SVG renderer draws the sampled frame inside that element.

```js
import {createSVGRenderer} from 'explainerkit/renderers/svg';

const mount = document.querySelector('#stage');
const renderer = createSVGRenderer(mount, {label: drawing.label});
renderer.render(frame);
// Call renderer.dispose() when you remove this example from the page.
```

An import such as `explainerkit` names a package, so a build tool is needed to find the corresponding file in an npm project. A browser loading plain HTML does not perform that package lookup automatically. Use the complete file URLs in the next section when the page has no build tool.

## Use plain HTML without npm

The browser can load ExplainerKit from jsDelivr, which serves files from the npm package. Both imports below pin version `0.1.0-alpha.1`, so they keep loading the same release as new versions come out. Save the document as `first-scene.html` and run `python3 -m http.server 8080` in its folder. Open `http://localhost:8080/first-scene.html`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My first ExplainerKit scene</title>
  </head>
  <body>
    <div id="stage"></div>
    <script type="module">
      import {scene} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/index.js';
      import {createSVGRenderer} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.1/src/renderers/svg.js';

      const drawing = scene({width: 480, height: 228, label: 'A robot jumps across a gap'});
      drawing.rect({x: 0, y: 172, width: 184, height: 56, fill: '#39796e'});
      drawing.rect({x: 296, y: 172, width: 184, height: 56, fill: '#39796e'});

      const robot = drawing.group({x: 126, y: 141});
      robot.rect({x: -24, y: -20, width: 48, height: 49, rx: 11, fill: '#f9b348'});
      robot.rect({x: -17, y: -13, width: 34, height: 23, rx: 8, fill: '#193b37'});
      robot.circle({x: -6, y: -2, r: 3, fill: '#f4fba3'});
      robot.circle({x: 7, y: -2, r: 3, fill: '#f4fba3'});

      robot.to(0.65, {x: 354}, {duration: 1.7, ease: 'linear'});
      robot.to(0.65, {y: 75}, {duration: 0.85, ease: 'easeOut'});
      robot.to(1.5, {y: 141}, {duration: 0.85, ease: 'smooth'});

      const renderer = createSVGRenderer(document.querySelector('#stage'));
      renderer.render(drawing.sample({time: 1.5}));
      // Call renderer.dispose() when this view is removed.
    </script>
  </body>
</html>
```

The robot should appear in midair between the platforms. Change `time` to `0` to see it on the left platform, or to `2.35` to see it on the right. Reload the page after each edit. If nothing appears, open the browser console to see which import or call failed.

The `type="module"` attribute lets the script use JavaScript's `import` syntax. The imported names are available inside the script, and the browser loads the files they depend on from the same version on the CDN.

Every module the package exports is a file under `src/` at the same version. Most package names follow the folder layout, so `explainerkit/renderers/canvas` is `src/renderers/canvas.js` and `explainerkit/motion` is `src/motion/index.js`, but a few do not. The `exports` field of the package's `package.json` lists the file behind every name. An import map can let the page write the shorter package names instead, as long as it maps each name to its complete URL.

### Load one file instead of many

Importing from `src/` makes the browser fetch each module file separately. A page can instead load one of two prebuilt bundles, which put many modules into a single minified file. Each bundle exports the same names as the modules it contains, so the robot page above works with one import line in place of the two.

```js
import {scene, createSVGRenderer} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.2/dist/explainerkit-lite.js';
```

The lite bundle is about 250 KB after compression. It holds the scene, the SVG and Canvas renderers, data and charts, geometry, color, typography, equations, motion and its effects, live inputs, layout and labels, the camera, deep zoom, parallax, emphasis, scrolling stories, media sync and the film player, together with the smaller motion helpers for morphing, physics, juicy feel, noise and variation. It leaves out the larger modules for characters, rigs, mechanisms, particles, procedural generation, maps and cities, the Three.js and WebGL renderers, 3D and elevation importers, video effects, sound and music, the timeline editor and the design pipeline.

The full bundle holds every public module and is about 760 KB after compression. Three names are defined differently by two modules, so the full bundle keeps one version of each. `units` is the unit registry from `explainerkit/data`, `createTimeline` comes from `explainerkit/motion`, and `noiseField` is left out because `explainerkit/noise` exports both versions as `noiseScalarField` and `noiseVectorField`. Neither bundle includes Three.js, so load it separately as the section on 3D below shows, and link `src/film/film.css` yourself when a page uses the film player's interface.

The bundles are part of the package from version `0.1.0-alpha.2` onward, in its `dist/` folder. The ExplainerKit website also serves the current release at `https://explainerkit.github.io/explainerkit-lite.js` and `https://explainerkit.github.io/explainerkit-full.js`. The files at those addresses are replaced with each new release, so a page that must keep working unchanged should import a pinned version from the CDN instead.

### Host the files yourself

A page can also load ExplainerKit from its own server. Copy the `src/` folder of a release into your site. The `package/src/` folder of the [ExplainerKit repository](https://github.com/prajwalsouza/ExplainerKit) holds it, and so does `node_modules/explainerkit/src/` after an npm install. Then change the imports to point at your copy, for example `./explainerkit/src/index.js`. Keep the whole folder together, because each module imports others from beside it. The server must send JavaScript files with a JavaScript content type, which ordinary static servers do.

### Add Three.js for 3D

The 3D renderer needs a compatible Three.js ES module. Load it and pass its module namespace as `THREE` when you create the renderer. This example loads pinned versions of both libraries from jsDelivr.

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
