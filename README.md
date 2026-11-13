# ExplainerKit

ExplainerKit is a JavaScript library for building visual explanations that people can explore in a browser. You describe shapes and the values they depend on, then use the same construction in an animation, a slider-controlled view or a scrolling story. SVG and Canvas draw ordinary 2D scenes, and an optional adapter renders solid 3D scenes with the copy of Three.js that your application supplies.

The website at https://explainerkit.github.io/ shows the library at work and carries the full documentation. This repository holds release 0.1.0-alpha.1, which is an alpha, so its APIs may still change before a stable release.

## Install it

The package is not on npm yet. Until it is, a plain HTML page can load every module from the website, as the next example shows. Once it is published, a project that uses npm and a build tool such as Vite can install it with `npm install explainerkit` and import the same modules by package name.

```js
import {scene} from 'https://explainerkit.github.io/runtime/src/index.js';
import {createSVGRenderer} from 'https://explainerkit.github.io/runtime/src/renderers/svg.js';

const drawing = scene({width: 320, height: 180, label: 'A moving circle'});
const circle = drawing.circle({x: 40, y: 90, r: 16, fill: '#34766b'});
circle.to(1, {x: 200}, {duration: 1, ease: 'linear'});

// Draw the moment at 1.5 seconds into <div id="stage"></div>.
const renderer = createSVGRenderer(document.querySelector('#stage'), {label: drawing.label});
renderer.render(drawing.sample({time: 1.5}));
```

The circle starts moving at one second and reaches x = 200 at two seconds, so the frame drawn at 1.5 seconds shows it halfway, at x = 120.

Run this code in a `<script type="module">` on a page served over HTTP. The [getting-started guide](package/docs/getting-started.md) shows the complete page, the npm route and how to host the files yourself.

## Find your way around

The [module map](package/docs/modules/index.md) connects what you want to build to the module and guide that cover it. The [runtime API](package/docs/runtime-api.md) explains how to build, play and seek a scene. AI agents can read `llms.txt` from the installed package, or run the `explainerkit-mcp` command it installs as an MCP server, as described in the [agents guide](package/docs/agents.md).

## What this repository contains

The repository publishes built files, so each folder matches something you can use directly.

| Folder | Contents |
| --- | --- |
| `package/` | The npm package exactly as published, including the runtime modules in `package/src/`, their type declarations and the guides |
| `site/` | The website, with the home page at the root, the documentation in `site/docs/` and the browser runtime in `site/runtime/` |

`release.json` records the version and the checksum of the published npm archive, so you can confirm that `package/` matches what npm serves. The GitHub Pages workflow in `.github/workflows/` publishes `site/` whenever the main branch changes.

## Building from source

The library's source repository is not public yet. When it opens, its build instructions will appear in this section, and these folders will be produced by that build.

## License

The code is released under the [MIT license](LICENSE). The package's piano calibration data is derived from recordings licensed under CC BY 3.0, and [NOTICE.md](NOTICE.md) gives that attribution. The website's footage, data and recorded instruments come from other authors under their own terms, which the [credits page](https://explainerkit.github.io/docs/credits.html) and `site/media/CREDITS.md` list.
