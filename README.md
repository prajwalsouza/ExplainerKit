# ExplainerKit

ExplainerKit is a JavaScript library for building visual explanations that people can explore in a browser. You describe shapes and the values they depend on, then use the same construction in an animation, a slider-controlled view or a scrolling story. SVG and Canvas draw ordinary 2D scenes, and an optional adapter renders solid 3D scenes with the copy of Three.js that your application supplies.

The website at https://explainerkit.github.io/ shows the library at work and carries the full documentation. This repository holds release 0.1.0-alpha.2, which is an alpha, so its APIs may still change before a stable release.

## Install it

Run `npm install explainerkit` in a project that uses a build tool such as Vite. Import `scene` from `explainerkit` and `createSVGRenderer` from `explainerkit/renderers/svg`. In a plain HTML page, the same modules are available at versioned jsDelivr URLs.

```html
<script type="module">
  import {scene} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.2/src/index.js';
  import {createSVGRenderer} from 'https://cdn.jsdelivr.net/npm/explainerkit@0.1.0-alpha.2/src/renderers/svg.js';
</script>
```

The [getting-started guide](https://explainerkit.github.io/docs/getting-started.html) uses these imports to draw a robot in mid-jump. It includes a complete HTML page and instructions for hosting the files yourself.

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
