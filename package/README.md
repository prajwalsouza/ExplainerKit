# ExplainerKit

ExplainerKit helps you build visual explanations that people can explore in a browser. You describe shapes and the values they depend on, then use the same construction in an animation, a slider-controlled view or a scrolling story. SVG and Canvas draw ordinary 2D scenes, while an optional adapter can use the Three.js copy supplied by your application for solid 3D rendering.

Start with [Getting started](https://explainerkit.github.io/docs/getting-started.html) to display a scene in an npm project or a plain HTML page. If you already know what you want to construct, the [module map](https://explainerkit.github.io/docs/modules/index.html) connects that task to the relevant guide. Most guides include live demonstrations that run the library in the page, so you can try a tool before reading its options. The package is an alpha release, so its APIs may change before a stable release.

## Build with an AI agent

AI agents use ExplainerKit by writing code that imports it, and a model is unlikely to know a library this new. The package includes `llms.txt`, which indexes every import, recipe and accepted option value, and an MCP server that lets an agent search the library, check its code and see screenshots of what it built. Point your agent at `node_modules/explainerkit/llms.txt` after installing, or register the `explainerkit-mcp` command that the package installs as an MCP server.

## Choose imports for your construction

Use `explainerkit/core` to create the scene and its shapes, then add modules for the calculations your explanation needs. For example, `explainerkit/data` maps values to drawing properties, `explainerkit/geometry` constructs paths, and `explainerkit/layout` places objects within the available space. `explainerkit/motion` helps schedule changes over time, while `explainerkit/rigs` works with connected joints and bones. The [library layers guide](https://explainerkit.github.io/docs/modules/library-layers.html) explains how those calculations connect to the same scene rather than creating separate animation systems.

Subject modules are optional, so import `explainerkit/mechanisms` when connected gears or linkages are part of the explanation, or `explainerkit/characters` when a character needs to move or speak. The [module map](https://explainerkit.github.io/docs/modules/index.html) lists the public path for each tool and the guide that explains its use.

For generated palettes, `explainerkit/color` provides hue, saturation, lightness and alpha (HSLA) values together with adjustment and mixing tools. Use it to author the color relationship, then convert to RGB or hexadecimal when a renderer needs that format. The [color guide](https://explainerkit.github.io/docs/modules/color.html) explains the units and why HSL lightness alone does not measure readable contrast.

## Use it without a build tool

A plain HTML page can load the same modules without a bundler, from the ExplainerKit website, from a CDN that mirrors npm or from a copy on your own server. The [getting-started guide](https://explainerkit.github.io/docs/getting-started.html#use-plain-html-without-npm) shows a complete page and explains how its imports are resolved. It also describes two single-file bundles: `explainerkit-lite.js` holds the core 2D modules without characters, 3D, maps or audio, and `explainerkit-full.js` holds every module.

The code uses the [MIT license](https://github.com/prajwalsouza/ExplainerKit/blob/main/package/LICENSE). Starter character artwork is licensed separately under CC0, and each character folder includes its license file. The character pack is distributed separately from the npm code package, so keep the relevant artwork license with a copied pack.

## Read further and check the remaining work

The [runtime API](https://explainerkit.github.io/docs/runtime-api.html) explains how to build and play a scene, while [current status](https://explainerkit.github.io/docs/foundation-status.html) describes the implemented features and their limits. The [architecture guide](https://explainerkit.github.io/docs/architecture.html) explains which part stores the model and which part owns browser playback. Read [security boundaries](https://explainerkit.github.io/docs/security.html) when accepting files, executing callbacks or preparing public hosting.

[Live input sources](https://explainerkit.github.io/docs/modules/live-inputs.html) bring pointer, file, sensor, camera or microphone observations into a scene after an explicit start. [Project recipes](https://explainerkit.github.io/docs/modules/projects.html) support their documented save/rebuild and undo/redo subset, and [offline audio mixing](https://explainerkit.github.io/docs/modules/audio-mixing.html) processes supported PCM data. Live AR tracking, persistent relationship graphs, general footage editing, richer text shaping and broad device/accessibility verification remain work. The [live-input guide](https://explainerkit.github.io/docs/modules/live-inputs.html) explains the acquisition and binding tools that are available.

For film authoring, the [film kit](https://explainerkit.github.io/docs/modules/film-kit.html), [media clock](https://explainerkit.github.io/docs/modules/media-clock.html) and [video export guide](https://explainerkit.github.io/docs/modules/export-film.html) connect the tools to their use in a complete explanation. Read them alongside the relevant renderer limits when choosing how the finished explanation will be displayed or exported.
