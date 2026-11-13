# Using TypeScript

ExplainerKit runs as JavaScript, but it also ships `.d.ts` declaration files so TypeScript and your editor can describe the functions available at each public import. A declaration tells the editor which options and results to expect without replacing the JavaScript that will run in the browser. You can use the package without TypeScript, and the runtime still checks the inputs it receives.

## What the declarations check

The declarations have different levels of precision. Some have been reviewed with examples that should compile and examples that should fail, while others are generated from JavaScript and still contain `any`. Because `any` allows values to pass without type checking, an option appearing in autocomplete does not mean TypeScript will reject every invalid value before execution.

For drawing and appearance, reviewed declarations describe the shared color tools, procedural geometry, letter shapes and drawing batches. They also cover convex polyhedra and splits, procedural materials and groups of generated shapes or foliage. Camera-facing flat shapes, often called billboards, have declarations for their supported projection options rather than being treated as arbitrary 3D meshes.

For movement, reviewed interfaces include two-link rigs, rig families and keyed character poses. Character-root following describes movement of the character's overall reference point, while staging options account for the camera when positioning content. The browser animation adapter and character lighting/proportion controls also have reviewed interfaces, with the specialist guides supplying their exact options.

Sound declarations cover mixing, instruments, sample banks, analysis and playback. Music declarations cover song analysis results, beat grids, adaptive scores and retargeting, with a strict consumer in `tests/types/music.ts`. Review of other scene and shape options remains work, so use the relevant guide and strict consumer examples to determine which part of an interface has been checked rather than assuming the whole package has equal type precision.

The strict consumers in `tests/types/part4-waapi.ts`, `tests/types/drawing-batches.ts` and `tests/types/film-craft.ts` demonstrate some of these reviewed APIs. The test suite also resolves every documented import and exported name, which catches missing declarations without proving that every declaration precisely describes every runtime option. Read a passing import check as evidence that the entry exists, then use the focused consumer examples to assess the options they actually exercise.

## Regenerate and check declarations

When a JavaScript API changes, its declarations need to describe the same interface. Run the following commands to regenerate them, check that the generated files match the source and compile the consumer examples with strict TypeScript settings.

```sh
npm run types:build
node scripts/build-types.mjs --check
npm run test:types
```

Generation uses TypeScript 6.0.3 with `noCheck`, which reads JavaScript without first proving that the implementation satisfies every declared type. Internal imports resolve to `.js` source files so an outdated adjacent declaration cannot influence the next generation. A regression test deliberately changes such a declaration and generates again to check that separation.

Reviewed declarations supplement generation where callers need a more precise interface. For example, the player types accept the same optional seek settings as the runtime, and sound types describe browser controls that callers can update. This work improves those interfaces without establishing complete checking for every callback, result, option or unit across the package.

Generated declarations are checked separately from JavaScript formatting and are not hand-formatted. `format:check` checks runtime JavaScript, while the declaration-generation check and strict consumers check the type files. TypeScript, Playwright, accessibility tools and formatters remain development dependencies and are excluded from the published runtime package.
