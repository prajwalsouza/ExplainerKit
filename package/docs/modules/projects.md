# Versioned project recipes and history

Use `explainerkit/project` to save a supported scene recipe as JSON and rebuild it later. Import `createProject`, `buildProject`, `parseProject` and `serializeProject`. A recipe describes values and operations that the format understands rather than capturing an arbitrary running JavaScript application.

```demo design-project-potato
Go incognitater. Pick a nose for the potato in witness protection. Undo and redo the disguise, then file it to rebuild the portrait from its saved JSON.
```

Each choice edits the nose in the current recipe. The two portraits can differ because the filed portrait keeps its own copy of the recipe until you file another one.

```js
const project = createProject({
  format: 'explainerkit-project', version: 1,
  scene: {width: 400, height: 240},
  parameters: [{id: 'progress', value: 0, min: 0, max: 1}],
  nodes: [{id: 'ball', type: 'circle', props: {x: 20, y: 80, r: 12}}],
  bindings: [{node: 'ball', property: 'x', parameter: 'progress', scale: 200, offset: 20}],
  tracks: [{target: 'parameter:progress', keys: [{at: 0, value: 0}, {at: 2, value: 1}]}],
});
project.edit(draft => {draft.nodes[0].props.r = 24;});
project.undo(); project.redo();
const savedJSON = project.serialize();
const loaded = buildProject(parseProject(savedJSON));
const frame = loaded.scene.sample({time: 1});
```

The format supports scene options, numeric parameters, keyed row sources, component blueprints and primitive or component nodes whose parents have no cycles. Bindings map parameters to properties using scale and offset. Tracks describe numeric node or parameter keyframes. Starter character options, named action clips and text speech are also supported.

Asset references record `id`, `uri` and optional `mime` or `integrity`, but the project functions do not fetch, verify or decode them. Integrity is metadata rather than proof that bytes were checked. Unsupported future format versions are rejected. Your application still needs to load referenced assets before presenting them.

`buildProject` returns a scene and maps indexed by the recipe's parameter, data, component, node, character and asset IDs. Those authored IDs survive saving and loading. Runtime handle IDs and JavaScript identities belong to the newly built scene, so mount it explicitly rather than expecting the saved recipe to retain browser resources. Data rows are restored, but the format does not describe general repeats, plots or rigs. Pass a recipe rather than a live `Scene` to these functions.

`createProject(document,{historyLimit:100})` captures a validated recipe that cannot be changed directly. Its `edit` method gives a mutable JSON draft to a trusted synchronous callback, then builds and samples the candidate at time zero before adopting it. A failed edit preserves both document and history. Undo and redo store 1–1000 snapshots, and a new edit clears redo. Asynchronous or nested edits are rejected. Calling `build()` creates a fresh runtime without making history responsible for mounted resources or file writes.

A recipe may contain at most 8 MB of JSON and 1000 records in each schema list, subject to shared nesting, value and scene limits. Validation at time zero does not prove that every later frame is valid. The format does not save callback bindings, external functions, arbitrary rigs, binary assets, complete film chapters or media mixes, session branches, or the state of running scenes during replacement. Your application owns filesystem or IndexedDB storage.
