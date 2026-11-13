# Public API inventory

Use this inventory when you know an import path and need to check which names it exports. For a task explanation and examples, begin with the [module map](modules/index.md) or [runtime API](runtime-api.md), then return here to look up the exact exported name.

The JavaScript exports are **experimental** while the package version begins with `0.`, so their availability is not a promise of 1.0 stability or complete behavioral coverage. Import a module through the package path shown in its heading rather than assuming that every internal source-file path is public. CSS entries load styles instead of JavaScript functions.

## Naming and units

Public time values use seconds, and geometry angles use radians. A field named `at` specifies the starting time, while `duration` specifies how long an interval lasts. File-size limits use bytes and renderer-output limits use pixels, so those limits should not be interpreted as scene coordinates or time values.

Drawing coordinates use the units authored in the scene, which are usually pixels before the chosen view transforms them. Character speeds and dimensions use character units that are scaled by the instance. Spatial coordinates and quantitative data keep the units chosen by the application rather than implicitly becoming metres. Document that choice when a drawing represents a physical quantity.

HSLA color values use degrees for hue, percentages for saturation and lightness, and alpha from 0–1 for opacity. These are color-authoring units rather than measurements of perceived brightness, so use the [color guide](modules/color.md) when conversion or contrast matters.

Joint and skeleton calculations are available from `explainerkit/rigs`. Forward kinematics (FK) calculates positions from joint angles, while inverse kinematics (IK) solves angles for a requested target. Other rig tools connect artwork to bones or curves, with the [library layers guide](modules/library-layers.md) explaining how those calculations use the same scene. Subject modules such as `mechanisms` or `characters` are loaded separately when their constructions are needed.

Shape operations have different representations and limits. The convex-polygon operations exposed through `explainerkit/geometry/shapes` combine their supported polygons, while `booleanPath` operates on path outlines after approximating curves with line segments. Appearance helpers belong to `explainerkit/look`, and the implementation-source link under an entry identifies where its code lives without creating another public import path.

## `explainerkit`

The implementation is in [./src/index.js](../src/index.js).

| Export | Status |
| --- | --- |
| `KitError` | experimental |
| `MOTION_STYLES` | experimental |
| `Scene` | experimental |
| `analyse` | experimental |
| `applyLayout` | experimental |
| `attachScroll` | experimental |
| `beats` | experimental |
| `cameraMatrix` | experimental |
| `captureState` | experimental |
| `clamp` | experimental |
| `createTransition` | experimental |
| `cubicBezier` | experimental |
| `ease` | experimental |
| `estimateText` | experimental |
| `fitRegion` | experimental |
| `fkTwoBone` | experimental |
| `idle` | experimental |
| `interpolateStates` | experimental |
| `invertMatrix` | experimental |
| `lerp` | experimental |
| `linearScale` | experimental |
| `measureNode` | experimental |
| `motionStyle` | experimental |
| `multiplyMatrices` | experimental |
| `planLayout` | experimental |
| `readingPace` | experimental |
| `scene` | experimental |
| `scrollProgress` | experimental |
| `scrollTime` | experimental |
| `seeded` | experimental |
| `solveTwoBone` | experimental |
| `toAuthored` | experimental |
| `transformPoint` | experimental |
| `twoBoneRig` | experimental |
| `worldPose` | experimental |

## `explainerkit/rig`

The implementation is in [./src/rig.js](../src/rig.js).

| Export | Status |
| --- | --- |
| `fkTwoBone` | experimental |
| `solveTwoBone` | experimental |

## `explainerkit/core`

The implementation is in [./src/core/index.js](../src/core/index.js).

| Export | Status |
| --- | --- |
| `KitError` | experimental |
| `MOTION_STYLES` | experimental |
| `Scene` | experimental |
| `beats` | experimental |
| `clamp` | experimental |
| `cubicBezier` | experimental |
| `ease` | experimental |
| `idle` | experimental |
| `lerp` | experimental |
| `linearScale` | experimental |
| `motionStyle` | experimental |
| `readingPace` | experimental |
| `scene` | experimental |
| `seeded` | experimental |

## `explainerkit/scroll`

The implementation is in [./src/scroll.js](../src/scroll.js).

| Export | Status |
| --- | --- |
| `ARRIVALS` | experimental |
| `DEFAULT_PACE_BOUNDS` | experimental |
| `SCROLL_PACES` | experimental |
| `arrivalPlan` | experimental |
| `arrivalTime` | experimental |
| `attachScroll` | experimental |
| `scrollPace` | experimental |
| `scrollProgress` | experimental |
| `scrollTime` | experimental |

## `explainerkit/rigging`

The implementation is in [./src/rigging.js](../src/rigging.js).

| Export | Status |
| --- | --- |
| `twoBoneRig` | experimental |

## `explainerkit/transitions`

The implementation is in [./src/core/transition.js](../src/core/transition.js).

| Export | Status |
| --- | --- |
| `captureState` | experimental |
| `createTransition` | experimental |
| `interpolateStates` | experimental |

## `explainerkit/renderers/svg`

The implementation is in [./src/renderers/svg.js](../src/renderers/svg.js).

| Export | Status |
| --- | --- |
| `MAX_SVG_POINTS` | experimental |
| `createSVGRenderer` | experimental |

## `explainerkit/renderers/canvas`

The implementation is in [./src/renderers/canvas.js](../src/renderers/canvas.js).

| Export | Status |
| --- | --- |
| `createCanvasRenderer` | experimental |

## `explainerkit/film`

The implementation is in [./src/film/index.js](../src/film/index.js).

| Export | Status |
| --- | --- |
| `film` | experimental |
| `palette` | experimental |

## `explainerkit/film.css`

The implementation is in [./src/film/film.css](../src/film/film.css).

This **experimental stylesheet** changes film-control styles when imported. It supplies presentation rather than a JavaScript function.

## `explainerkit/adaptive`

The implementation is in [./src/layout/adaptive.js](../src/layout/adaptive.js).

| Export | Status |
| --- | --- |
| `analyse` | experimental |
| `applyLayout` | experimental |
| `bandsOf` | experimental |
| `estimateText` | experimental |
| `measureNode` | experimental |
| `planLayout` | experimental |
| `toAuthored` | experimental |
| `units` | experimental |

## `explainerkit/camera`

The implementation is in [./src/camera/index.js](../src/camera/index.js).

| Export | Status |
| --- | --- |
| `Camera` | experimental |
| `MAX_CAMERA_ZOOM` | experimental |
| `MIN_CAMERA_ZOOM` | experimental |
| `cameraDefaults` | experimental |
| `cameraMatrix` | experimental |
| `fitRegion` | experimental |
| `focusBlur` | experimental |
| `invertMatrix` | experimental |
| `layerPose` | experimental |
| `multiplyMatrices` | experimental |
| `projectLayer` | experimental |
| `shutterTimes` | experimental |
| `transformPoint` | experimental |
| `worldPose` | experimental |

## `explainerkit/rigs`

The implementation is in [./src/rigs/index.js](../src/rigs/index.js).

| Export | Status |
| --- | --- |
| `bindSkin` | experimental |
| `fkTwoBone` | experimental |
| `skeleton` | experimental |
| `skeletonRig` | experimental |
| `solveRigGoals` | experimental |
| `solveTwoBone` | experimental |
| `solveTwoBone3D` | experimental |
| `splineRig` | experimental |
| `twoBoneRig` | experimental |

## `explainerkit/morph`

The implementation is in [./src/morph/index.js](../src/morph/index.js).

| Export | Status |
| --- | --- |
| `colorInterpolator` | experimental |
| `createCompoundMorph` | experimental |
| `createMergeMorph` | experimental |
| `createMorph` | experimental |
| `createSafeMorph` | experimental |
| `createSceneTransition` | experimental |
| `createShapeKeys` | experimental |
| `createSplitMorph` | experimental |
| `flattenPath` | experimental |
| `matchCut` | experimental |

## `explainerkit/audit`

The implementation is in [./src/audit/index.js](../src/audit/index.js).

| Export | Status |
| --- | --- |
| `CONTINUITY` | experimental |
| `RENDER_3D` | experimental |
| `RULES` | experimental |
| `auditFrame` | experimental |
| `auditHandover` | experimental |
| `auditHandoverWindow` | experimental |
| `auditMotion` | experimental |
| `auditPalette` | experimental |
| `auditRender3D` | experimental |
| `auditRendererStats` | experimental |
| `auditScene` | experimental |
| `auditStripes` | experimental |
| `auditTextOverPixels` | experimental |
| `colorDistance` | experimental |
| `comparePalettes` | experimental |
| `contrastRatio` | experimental |
| `describeThreeScene` | experimental |
| `fitSimilarity` | experimental |
| `frameMarks` | experimental |
| `parseColor` | experimental |
| `relativeLuminance` | experimental |

## `explainerkit/design`

The implementation is in [./src/design/index.js](../src/design/index.js).

| Export | Status |
| --- | --- |
| `ABSTRACTIONS` | experimental |
| `ALLEGORIES` | experimental |
| `ANIMATION_PRINCIPLES` | experimental |
| `ATTENTION_GATE` | experimental |
| `ATTENTION_LEDGER` | experimental |
| `ATTENTION_PART_WORDS` | experimental |
| `AUDIENCE_LEVELS` | experimental |
| `CAMERA_MOVES` | experimental |
| `CAVEAT_RULES` | experimental |
| `CINEMATOGRAPHY_PRINCIPLES` | experimental |
| `DEFAULT_AUDIENCE` | experimental |
| `DEFAULT_STYLE` | experimental |
| `DEPICTIONS` | experimental |
| `DEPTHS` | experimental |
| `EARN_KINDS` | experimental |
| `EFFORTS` | experimental |
| `ELEMENT_ROLES` | experimental |
| `EMOTION_GATE` | experimental |
| `EMOTION_PRINCIPLES` | experimental |
| `EVIDENCE` | experimental |
| `EXPLAINER_STAGES` | experimental |
| `EXPLORER` | experimental |
| `FABLE_STAGES` | experimental |
| `FAR_FIELDS` | experimental |
| `FEELING_LEVELS` | experimental |
| `FRAMINGS` | experimental |
| `HEDGES` | experimental |
| `HOOK_FLAVOURS` | experimental |
| `HOOK_PATTERNS` | experimental |
| `HOOK_REFERENCES` | experimental |
| `IMAGE_USE_CASES` | experimental |
| `INSIGHT_GATE` | experimental |
| `INSTRUCTIONS` | experimental |
| `INVITATIONS` | experimental |
| `LENSES` | experimental |
| `LENS_FAMILIES` | experimental |
| `LOOK_GATE` | experimental |
| `LOOK_PRINCIPLES` | experimental |
| `MEDIA` | experimental |
| `METAPHOR_TYPES` | experimental |
| `MOTION_GATE` | experimental |
| `MOTION_PRINCIPLES` | experimental |
| `MOTION_VERBS` | experimental |
| `MULTIMEDIA_GATE` | experimental |
| `MULTIMEDIA_PRINCIPLES` | experimental |
| `OPERATIONS` | experimental |
| `OPERATION_KINDS` | experimental |
| `PALETTE_ROLES` | experimental |
| `PATCHABLE` | experimental |
| `PHILOSOPHY_JARGON` | experimental |
| `PLAIN_RULES` | experimental |
| `PRODUCTION_EXAMPLES` | experimental |
| `PRODUCTION_PRINCIPLES` | experimental |
| `PRODUCTION_RULES` | experimental |
| `PROVOCATIONS` | experimental |
| `REFERENCES` | experimental |
| `REFERENCE_KINDS` | experimental |
| `REFERENCE_MODULES` | experimental |
| `REGISTERS` | experimental |
| `SERIES_STAGES` | experimental |
| `SHAPES` | experimental |
| `SHOT_GATE` | experimental |
| `SHOT_PRINCIPLES` | experimental |
| `SOUND_PRINCIPLES` | experimental |
| `SPEND_KINDS` | experimental |
| `STIMULI` | experimental |
| `STOCK_PHRASES` | experimental |
| `STRUCTURE_GATE` | experimental |
| `TERMS_GATE` | experimental |
| `TRANSITIONS` | experimental |
| `VISUAL_COMPONENTS` | experimental |
| `VISUAL_STAGES` | experimental |
| `VISUAL_STYLES` | experimental |
| `VISUAL_VOCABULARY` | experimental |
| `VOICE_EXAMPLES` | experimental |
| `VOICE_GATE` | experimental |
| `VOICE_RULES` | experimental |
| `allegoryCoverage` | experimental |
| `applyEdits` | experimental |
| `applyShotPatches` | experimental |
| `assessCohesion` | experimental |
| `attentionMeasures` | experimental |
| `attentionProblems` | experimental |
| `audienceInsight` | experimental |
| `audienceProblems` | experimental |
| `auditAttention` | experimental |
| `auditAttentionPart` | experimental |
| `auditForAudience` | experimental |
| `auditInsight` | experimental |
| `auditMultimedia` | experimental |
| `auditScriptAttention` | experimental |
| `auditScriptInsight` | experimental |
| `boolean` | experimental |
| `bridgeChapters` | experimental |
| `buildAudience` | experimental |
| `checkAllegories` | experimental |
| `checkCascade` | experimental |
| `checkCuts` | experimental |
| `checkMultimedia` | experimental |
| `checkPhilosophy` | experimental |
| `checkStitch` | experimental |
| `checkTelling` | experimental |
| `checkTellings` | experimental |
| `checkTerms` | experimental |
| `chooseAllegory` | experimental |
| `chooseDepth` | experimental |
| `chooseSeed` | experimental |
| `chooseTelling` | experimental |
| `cohesionMap` | experimental |
| `connectDistant` | experimental |
| `consultPhilosophy` | experimental |
| `coverObjectives` | experimental |
| `createDesignRun` | experimental |
| `createFrames` | experimental |
| `cutNames` | experimental |
| `decodePatches` | experimental |
| `deepenFrame` | experimental |
| `defineOperation` | experimental |
| `definePrinciple` | experimental |
| `defineReference` | experimental |
| `depictIdeas` | experimental |
| `designEmotion` | experimental |
| `designExplainer` | experimental |
| `designFable` | experimental |
| `designLook` | experimental |
| `designMotion` | experimental |
| `designSeries` | experimental |
| `designSound` | experimental |
| `designStructure` | experimental |
| `designVisuals` | experimental |
| `developTelling` | experimental |
| `discoverExplainer` | experimental |
| `draftScript` | experimental |
| `emotionMeasures` | experimental |
| `engineerCascade` | experimental |
| `engineerHooks` | experimental |
| `engineerInsight` | experimental |
| `eurekaGraph` | experimental |
| `expectShape` | experimental |
| `exploreEveryday` | experimental |
| `exploreStories` | experimental |
| `exploreSurprises` | experimental |
| `exploreUnusualSources` | experimental |
| `exploreWide` | experimental |
| `fableMeasures` | experimental |
| `findImage` | experimental |
| `findMeaning` | experimental |
| `findParallels` | experimental |
| `findPeople` | experimental |
| `findTerms` | experimental |
| `flowStats` | experimental |
| `freshFrames` | experimental |
| `generateImages` | experimental |
| `imagePromptSpec` | experimental |
| `insightMeasures` | experimental |
| `insightProblems` | experimental |
| `investigate` | experimental |
| `keepAttention` | experimental |
| `keepRatio` | experimental |
| `keepWanderings` | experimental |
| `lateralPass` | experimental |
| `list` | experimental |
| `locateQuote` | experimental |
| `lookMeasures` | experimental |
| `mapAllegory` | experimental |
| `mapDebates` | experimental |
| `motionMeasures` | experimental |
| `multimediaMeasures` | experimental |
| `nameIt` | experimental |
| `narrationEditShape` | experimental |
| `number` | experimental |
| `oneOf` | experimental |
| `outlineExplainer` | experimental |
| `outlineFable` | experimental |
| `outlineSeries` | experimental |
| `patchShape` | experimental |
| `persona` | experimental |
| `philosophyJargon` | experimental |
| `pickLenses` | experimental |
| `pickStimuli` | experimental |
| `planAttention` | experimental |
| `planEmotion` | experimental |
| `planLook` | experimental |
| `planMotion` | experimental |
| `planShots` | experimental |
| `planSound` | experimental |
| `planStructure` | experimental |
| `planSubtopics` | experimental |
| `plotFable` | experimental |
| `polishVoice` | experimental |
| `principleRules` | experimental |
| `principles` | experimental |
| `proposeSeeds` | experimental |
| `proposeTruths` | experimental |
| `provoke` | experimental |
| `randomEntry` | experimental |
| `rankSeeds` | experimental |
| `readAround` | experimental |
| `record` | experimental |
| `referenceExamples` | experimental |
| `referencesFor` | experimental |
| `reframe` | experimental |
| `reframeLoop` | experimental |
| `renderOutline` | experimental |
| `renderPrompt` | experimental |
| `replanShots` | experimental |
| `researchHooks` | experimental |
| `researchVisuals` | experimental |
| `resolveMedium` | experimental |
| `resolveStyle` | experimental |
| `reviewAllegory` | experimental |
| `reviewFable` | experimental |
| `reviewLearning` | experimental |
| `reviewScience` | experimental |
| `reviewStory` | experimental |
| `revise` | experimental |
| `reviseFable` | experimental |
| `reviseForAttention` | experimental |
| `reviseForInsight` | experimental |
| `rewritePlain` | experimental |
| `scriptMeasures` | experimental |
| `scriptStats` | experimental |
| `shapeErrors` | experimental |
| `shortRuns` | experimental |
| `shotDigest` | experimental |
| `shotShape` | experimental |
| `shotSpans` | experimental |
| `soundMeasures` | experimental |
| `stitch` | experimental |
| `string` | experimental |
| `structureMeasures` | experimental |
| `summariseDiscovery` | experimental |
| `surpriseMoments` | experimental |
| `targetPersona` | experimental |
| `termHits` | experimental |
| `termMeasures` | experimental |
| `timeShots` | experimental |
| `timeShotsMeasure` | experimental |
| `voiceProblems` | experimental |
| `wander` | experimental |
| `weighLeap` | experimental |
| `withStyle` | experimental |
| `workBackward` | experimental |
| `writeChapters` | experimental |
| `writeExplainer` | experimental |
| `writeFable` | experimental |
| `writeImagePrompts` | experimental |

## `explainerkit/compose`

The implementation is in [./src/compose/index.js](../src/compose/index.js).

| Export | Status |
| --- | --- |
| `attach` | experimental |
| `bubble` | experimental |
| `callout` | experimental |
| `effectBatch` | experimental |
| `inkFor` | experimental |
| `panel` | experimental |
| `paragraph` | experimental |
| `pathPoint` | experimental |
| `place` | experimental |
| `stage` | experimental |
| `wrapText` | experimental |

## `explainerkit/parallax`

The implementation is in [./src/parallax/index.js](../src/parallax/index.js).

| Export | Status |
| --- | --- |
| `PARALLAX_RULES` | experimental |
| `auditParallax` | experimental |
| `connectParallax` | experimental |
| `coverage` | experimental |
| `depthFor` | experimental |
| `fitBackdrop` | experimental |
| `formatParallax` | experimental |
| `parallaxRig` | experimental |
| `speedFor` | experimental |
| `storyPins` | experimental |
| `storyRate` | experimental |

## `explainerkit/perception`

The implementation is in [./src/perception/index.js](../src/perception/index.js).

| Export | Status |
| --- | --- |
| `groupStagger` | experimental |
| `perceptualGroups` | experimental |

## `explainerkit/modeling`

The implementation is in [./src/modeling/index.js](../src/modeling/index.js).

| Export | Status |
| --- | --- |
| `Line` | experimental |
| `bindMotionPath` | experimental |
| `ellipsePath` | experimental |
| `gridPlacements` | experimental |
| `inkStroke` | experimental |
| `lattice` | experimental |
| `measurePath` | experimental |
| `motionPath` | experimental |
| `outlineDraw` | experimental |
| `pairPoints` | experimental |
| `pathPlacements` | experimental |
| `polygonPath` | experimental |
| `polyhedron` | experimental |
| `radialPlacements` | experimental |
| `regularPolygon` | experimental |
| `roundedRectPath` | experimental |
| `samplePath` | experimental |
| `split` | experimental |
| `starPath` | experimental |
| `transformPath` | experimental |

## `explainerkit/model`

The implementation is in [./src/model/index.js](../src/model/index.js).

| Export | Status |
| --- | --- |
| `areaPath` | experimental |
| `axisBlueprint` | experimental |
| `bandScale` | experimental |
| `bin` | experimental |
| `convert` | experimental |
| `defineUnit` | experimental |
| `divideUnits` | experimental |
| `filterRows` | experimental |
| `linePath` | experimental |
| `mapRows` | experimental |
| `multiplyUnits` | experimental |
| `ordinalScale` | experimental |
| `powerUnit` | experimental |
| `replaceMapped` | experimental |
| `scale` | experimental |
| `stack` | experimental |
| `summarize` | experimental |
| `ticks` | experimental |
| `units` | experimental |

## `explainerkit/graphics`

The implementation is in [./src/graphics/index.js](../src/graphics/index.js).

| Export | Status |
| --- | --- |
| `clipCircle` | experimental |
| `clipPath` | experimental |
| `clipRect` | experimental |
| `color` | experimental |
| `fillRule` | experimental |
| `linearGradient` | experimental |
| `paint` | experimental |
| `pathCommands` | experimental |
| `radialGradient` | experimental |
| `strokeDasharray` | experimental |
| `texture` | experimental |
| `textureTile` | experimental |
| `validateClip` | experimental |
| `validatePaint` | experimental |

## `explainerkit/physics`

The implementation is in [./src/physics/index.js](../src/physics/index.js).

| Export | Status |
| --- | --- |
| `fall` | experimental |
| `inertia` | experimental |
| `jiggle` | experimental |
| `lag` | experimental |
| `spring` | experimental |
| `springEasing` | experimental |
| `squashStretch` | experimental |
| `velocityTracker` | experimental |

## `explainerkit/dom`

The implementation is in [./src/adapters/dom.js](../src/adapters/dom.js).

| Export | Status |
| --- | --- |
| `bindDOM` | experimental |

## `explainerkit/typography`

The implementation is in [./src/typography/index.js](../src/typography/index.js).

| Export | Status |
| --- | --- |
| `glyphs` | experimental |
| `kineticText` | experimental |
| `segmentText` | experimental |
| `textStagger` | experimental |

## `explainerkit/spatial`

The implementation is in [./src/spatial/index.js](../src/spatial/index.js).

| Export | Status |
| --- | --- |
| `boxLines` | experimental |
| `compose3D` | experimental |
| `direction3D` | experimental |
| `dollyCamera` | experimental |
| `identity3D` | experimental |
| `inverse3D` | experimental |
| `lookAt3D` | experimental |
| `multiply3D` | experimental |
| `multiplyQuaternion` | experimental |
| `orbitCamera` | experimental |
| `orthographicCamera` | experimental |
| `perspectiveCamera` | experimental |
| `pickBounds` | experimental |
| `projectLines` | experimental |
| `projectPoint` | experimental |
| `projectPoints` | experimental |
| `quaternion` | experimental |
| `quaternionFromAxisAngle` | experimental |
| `quaternionFromEuler` | experimental |
| `quaternionMatrix` | experimental |
| `rayBox` | experimental |
| `rayPlane` | experimental |
| `raySphere` | experimental |
| `rotateVector3D` | experimental |
| `screenRay` | experimental |
| `slerpQuaternion` | experimental |
| `sphereLines` | experimental |
| `transform3D` | experimental |
| `unprojectPoint` | experimental |
| `wireframe` | experimental |
| `worldMatrix3D` | experimental |
| `zoomCamera` | experimental |

## `explainerkit/renderers/three`

The implementation is in [./src/renderers/three.js](../src/renderers/three.js).

| Export | Status |
| --- | --- |
| `createThreeAdapter` | experimental |
| `createThreeRenderer` | experimental |
| `darkClay` | experimental |

## `explainerkit/renderers/webgl`

The implementation is in [./src/renderers/webgl.js](../src/renderers/webgl.js).

| Export | Status |
| --- | --- |
| `capturePointFrame` | experimental |
| `createWebGLRenderer` | experimental |
| `projectGPUPoint` | experimental |
| `screenProjection` | experimental |

## `explainerkit/import/svg`

The implementation is in [./src/import/svg.js](../src/import/svg.js).

| Export | Status |
| --- | --- |
| `importSVG` | experimental |
| `importSVGFile` | experimental |
| `parseSVGPath` | experimental |
| `parseSVGTransform` | experimental |

## `explainerkit/import/font`

The implementation is in [./src/import/font.js](../src/import/font.js).

| Export | Status |
| --- | --- |
| `loadFont` | experimental |
| `parseFont` | experimental |
| `textOutline` | experimental |

## `explainerkit/zoom`

The implementation is in [./src/zoom/index.js](../src/zoom/index.js).

| Export | Status |
| --- | --- |
| `bindFrame` | experimental |
| `convertFramePoint` | experimental |
| `convertFrameVector` | experimental |
| `detail` | experimental |
| `detailLevels` | experimental |
| `frameView` | experimental |
| `logZoom` | experimental |
| `rebaseCamera` | experimental |
| `referenceFrame` | experimental |
| `relativeRotation` | experimental |
| `relativeUnits` | experimental |
| `zoomTransition` | experimental |

## `explainerkit/particles`

The implementation is in [./src/particles/index.js](../src/particles/index.js).

| Export | Status |
| --- | --- |
| `emitter` | experimental |
| `noise2` | experimental |
| `noise3` | experimental |
| `noiseField` | experimental |

## `explainerkit/mechanisms`

The implementation is in [./src/mechanisms/index.js](../src/mechanisms/index.js).

| Export | Status |
| --- | --- |
| `beltGeometry` | experimental |
| `gearPath` | experimental |
| `mechanism` | experimental |
| `meshPhase` | experimental |
| `sliderCrank` | experimental |

## `explainerkit/import/gltf`

The implementation is in [./src/import/gltf.js](../src/import/gltf.js).

| Export | Status |
| --- | --- |
| `importGLTF` | experimental |

## `explainerkit/shapes`

The implementation is in [./src/shapes/index.js](../src/shapes/index.js).

| Export | Status |
| --- | --- |
| `asShape` | experimental |
| `booleanPath` | experimental |
| `centroid` | experimental |
| `fracture` | experimental |
| `intersect` | experimental |
| `intersectPaths` | experimental |
| `pathLoops` | experimental |
| `polygon` | experimental |
| `polygonArea` | experimental |
| `subtract` | experimental |
| `subtractPaths` | experimental |
| `union` | experimental |
| `unionPaths` | experimental |

## `explainerkit/story`

The implementation is in [./src/story/index.js](../src/story/index.js).

| Export | Status |
| --- | --- |
| `ARRIVALS` | experimental |
| `DEFAULT_PACE_BOUNDS` | experimental |
| `SCROLL_PACES` | experimental |
| `arrivalPlan` | experimental |
| `arrivalTime` | experimental |
| `attachStory` | experimental |
| `holdControls` | experimental |
| `scrollPace` | experimental |
| `storyTimeline` | experimental |

## `explainerkit/assets/preload`

The implementation is in [./src/assets/preload.js](../src/assets/preload.js).

| Export | Status |
| --- | --- |
| `preload` | experimental |

## `explainerkit/look`

The implementation is in [./src/look/index.js](../src/look/index.js).

| Export | Status |
| --- | --- |
| `alphaMask` | experimental |
| `filmGrain` | experimental |
| `glow` | experimental |
| `gradeFrame` | experimental |
| `shadowOnPlane` | experimental |
| `shadowOnWall` | experimental |

## `explainerkit/characters`

The implementation is in [./src/characters/index.js](../src/characters/index.js).

| Export | Status |
| --- | --- |
| `BEAN_PALETTES` | experimental |
| `BIPED_POSES` | experimental |
| `BIRD_PALETTES` | experimental |
| `BUILDERS` | experimental |
| `FAMILY_PRESETS` | experimental |
| `FISH_PALETTES` | experimental |
| `HAIR` | experimental |
| `MICROBE_PALETTES` | experimental |
| `MOODS` | experimental |
| `MOTION_STYLES` | experimental |
| `MOUTH_SHAPES` | experimental |
| `SKIN` | experimental |
| `STARTERS` | experimental |
| `STICK_BUILDS` | experimental |
| `STICK_STYLES` | experimental |
| `add` | experimental |
| `appendage` | experimental |
| `appendageShapes` | experimental |
| `auditCharacter` | experimental |
| `bean` | experimental |
| `bipedActions` | experimental |
| `bipedDefaults` | experimental |
| `bipedMotion` | experimental |
| `bipedRig` | experimental |
| `bird` | experimental |
| `blend` | experimental |
| `blinkAt` | experimental |
| `browPath` | experimental |
| `character` | experimental |
| `characterFromSVG` | experimental |
| `characterPoseFromSkeleton` | experimental |
| `compileCharacter` | experimental |
| `contactSheet` | experimental |
| `contactTiming` | experimental |
| `cow` | experimental |
| `crowd` | experimental |
| `dampedStep` | experimental |
| `dragonfly` | experimental |
| `egg` | experimental |
| `ellipse` | experimental |
| `exportCharacterSVG` | experimental |
| `eyePath` | experimental |
| `faceParts` | experimental |
| `fish` | experimental |
| `formatAudit` | experimental |
| `frameAlong` | experimental |
| `frog` | experimental |
| `holdAtContact` | experimental |
| `hose` | experimental |
| `jumper` | experimental |
| `keysFromPoseTrack` | experimental |
| `lidPath` | experimental |
| `loadCharacterPack` | experimental |
| `manifestFor` | experimental |
| `microbe` | experimental |
| `motionStyle` | experimental |
| `mouse` | experimental |
| `mouthPath` | experimental |
| `poseVocabulary` | experimental |
| `profile` | experimental |
| `profileReaction` | experimental |
| `pupilPath` | experimental |
| `quadruped` | experimental |
| `restBounds` | experimental |
| `restHeight` | experimental |
| `restyle` | experimental |
| `rounded` | experimental |
| `saccade` | experimental |
| `sceneLength` | experimental |
| `skeletonFromPoseTrack` | experimental |
| `smoothClosed` | experimental |
| `smoothOpen` | experimental |
| `solveBones` | experimental |
| `speech` | experimental |
| `speechFromRhubarb` | experimental |
| `standOn` | experimental |
| `starter` | experimental |
| `stick` | experimental |
| `surface` | experimental |
| `surfaceFrame` | experimental |
| `taper` | experimental |
| `tone` | experimental |
| `tube` | experimental |
| `winged` | experimental |

## `explainerkit/composition`

The implementation is in [./src/composition/layers.js](../src/composition/layers.js).

| Export | Status |
| --- | --- |
| `focusBlur` | experimental |
| `layerPose` | experimental |
| `projectLayer` | experimental |
| `shutterTimes` | experimental |

## `explainerkit/player`

The implementation is in [./src/player/index.js](../src/player/index.js).

| Export | Status |
| --- | --- |
| `attachSceneLayer` | experimental |
| `createProjectionPlayer` | experimental |
| `createTimelinePlayer` | experimental |
| `mount` | experimental |

## `explainerkit/media`

The implementation is in [./src/media/index.js](../src/media/index.js).

| Export | Status |
| --- | --- |
| `attachMedia` | experimental |

## `explainerkit/timeline`

The implementation is in [./src/timeline/index.js](../src/timeline/index.js).

| Export | Status |
| --- | --- |
| `createTimeline` | experimental |
| `prepareTimelineKeys` | experimental |

## `explainerkit/project`

The implementation is in [./src/project/index.js](../src/project/index.js).

| Export | Status |
| --- | --- |
| `buildProject` | experimental |
| `createProject` | experimental |
| `parseProject` | experimental |
| `serializeProject` | experimental |

## `explainerkit/layout/labels`

The implementation is in [./src/layout/labels.js](../src/layout/labels.js).

| Export | Status |
| --- | --- |
| `canvasTextMeasurer` | experimental |
| `placeLabels` | experimental |

## `explainerkit/layout/annotations`

The implementation is in [./src/layout/annotations.js](../src/layout/annotations.js).

| Export | Status |
| --- | --- |
| `planAnnotations` | experimental |

## `explainerkit/sound`

The implementation is in [./src/sound/index.js](../src/sound/index.js).

| Export | Status |
| --- | --- |
| `INSTRUMENT_KINDS` | experimental |
| `SOUND_EFFECT_KINDS` | experimental |
| `analyzeSound` | experimental |
| `attachSoundtrack` | experimental |
| `chord` | experimental |
| `createSoundtrack` | experimental |
| `cueForMotion` | experimental |
| `musicPhrase` | experimental |
| `note` | experimental |
| `pianoNote` | experimental |
| `processSound` | experimental |
| `sampleInstrument` | experimental |
| `soundEffect` | experimental |

## `explainerkit/media/audio`

The implementation is in [./src/media/audio.js](../src/media/audio.js).

| Export | Status |
| --- | --- |
| `createAudioMix` | experimental |
| `encodeWav` | experimental |

## `explainerkit/procedural`

The implementation is in [./src/procedural/index.js](../src/procedural/index.js).

| Export | Status |
| --- | --- |
| `attribute` | experimental |
| `distribution` | experimental |
| `foliageCluster` | experimental |
| `glowLight` | experimental |
| `grassMass` | experimental |
| `instance` | experimental |
| `noiseField` | experimental |
| `noiseGrid` | experimental |
| `points` | experimental |

## `explainerkit/waapi`

The implementation is in [./src/adapters/waapi.js](../src/adapters/waapi.js).

| Export | Status |
| --- | --- |
| `animateWAAPI` | experimental |
| `waapi` | experimental |

## `explainerkit/data`

The implementation is in [./src/data/index.js](../src/data/index.js).

| Export | Status |
| --- | --- |
| `areaPath` | experimental |
| `axisBlueprint` | experimental |
| `bandScale` | experimental |
| `bin` | experimental |
| `convert` | experimental |
| `defineUnit` | experimental |
| `divideUnits` | experimental |
| `filterRows` | experimental |
| `linePath` | experimental |
| `mapRows` | experimental |
| `multiplyUnits` | experimental |
| `ordinalScale` | experimental |
| `powerUnit` | experimental |
| `replaceMapped` | experimental |
| `scale` | experimental |
| `stack` | experimental |
| `summarize` | experimental |
| `ticks` | experimental |
| `units` | experimental |

## `explainerkit/geometry`

The implementation is in [./src/geometry/index.js](../src/geometry/index.js).

| Export | Status |
| --- | --- |
| `Line` | experimental |
| `bindMotionPath` | experimental |
| `ellipsePath` | experimental |
| `gridPlacements` | experimental |
| `inkStroke` | experimental |
| `lattice` | experimental |
| `measurePath` | experimental |
| `motionPath` | experimental |
| `outlineDraw` | experimental |
| `pairPoints` | experimental |
| `pathPlacements` | experimental |
| `polygonPath` | experimental |
| `polyhedron` | experimental |
| `radialPlacements` | experimental |
| `regularPolygon` | experimental |
| `roundedRectPath` | experimental |
| `samplePath` | experimental |
| `split` | experimental |
| `starPath` | experimental |
| `transformPath` | experimental |

## `explainerkit/geometry/shapes`

The implementation is in [./src/geometry/shapes/index.js](../src/geometry/shapes/index.js).

| Export | Status |
| --- | --- |
| `asShape` | experimental |
| `booleanPath` | experimental |
| `centroid` | experimental |
| `fracture` | experimental |
| `intersect` | experimental |
| `intersectPaths` | experimental |
| `pathLoops` | experimental |
| `polygon` | experimental |
| `polygonArea` | experimental |
| `subtract` | experimental |
| `subtractPaths` | experimental |
| `union` | experimental |
| `unionPaths` | experimental |

## `explainerkit/layout`

The implementation is in [./src/layout/index.js](../src/layout/index.js).

| Export | Status |
| --- | --- |
| `analyse` | experimental |
| `applyLayout` | experimental |
| `attach` | experimental |
| `bubble` | experimental |
| `callout` | experimental |
| `canvasTextMeasurer` | experimental |
| `effectBatch` | experimental |
| `estimateText` | experimental |
| `inkFor` | experimental |
| `measureNode` | experimental |
| `panel` | experimental |
| `paragraph` | experimental |
| `pathPoint` | experimental |
| `place` | experimental |
| `placeLabels` | experimental |
| `planAnnotations` | experimental |
| `planLayout` | experimental |
| `stage` | experimental |
| `toAuthored` | experimental |
| `wrapText` | experimental |

## `explainerkit/color`

The implementation is in [./src/color/index.js](../src/color/index.js).

| Export | Status |
| --- | --- |
| `adjust` | experimental |
| `colorInterpolator` | experimental |
| `fromRGBA` | experimental |
| `hsla` | experimental |
| `hslaToRGBA` | experimental |
| `mix` | experimental |
| `toCSS` | experimental |
| `toHSLA` | experimental |
| `toHex` | experimental |
| `toRGBA` | experimental |

## `explainerkit/motion`

The implementation is in [./src/motion/index.js](../src/motion/index.js).

| Export | Status |
| --- | --- |
| `MOTION_STYLES` | experimental |
| `Timeline` | experimental |
| `beats` | experimental |
| `bindCommonEffect` | experimental |
| `bindMotionPath` | experimental |
| `commonEffect` | experimental |
| `createTimeline` | experimental |
| `cubicBezier` | experimental |
| `ease` | experimental |
| `easingCurve` | experimental |
| `idle` | experimental |
| `inertia` | experimental |
| `jiggle` | experimental |
| `lag` | experimental |
| `motionPath` | experimental |
| `motionStyle` | experimental |
| `readingPace` | experimental |
| `spring` | experimental |
| `springEasing` | experimental |
| `springTiming` | experimental |
| `squashStretch` | experimental |
| `stagger` | experimental |

## `explainerkit/motion/effects`

The implementation is in [./src/motion/common-effects.js](../src/motion/common-effects.js).

| Export | Status |
| --- | --- |
| `bindCommonEffect` | experimental |
| `commonEffect` | experimental |

## `explainerkit/noise`

The implementation is in [./src/noise/index.js](../src/noise/index.js).

| Export | Status |
| --- | --- |
| `fbm` | experimental |
| `noise2` | experimental |
| `noise3` | experimental |
| `noiseGrid` | experimental |
| `noiseScalarField` | experimental |
| `noiseVectorField` | experimental |
| `randomAt` | experimental |
| `ridged` | experimental |
| `warp` | experimental |

## `explainerkit/editor/timeline`

The implementation is in [./src/editor/timeline/index.js](../src/editor/timeline/index.js).

| Export | Status |
| --- | --- |
| `createTimeline` | experimental |
| `prepareTimelineKeys` | experimental |

## `explainerkit/adapters/dom`

The implementation is in [./src/adapters/dom.js](../src/adapters/dom.js).

| Export | Status |
| --- | --- |
| `bindDOM` | experimental |

## `explainerkit/adapters/waapi`

The implementation is in [./src/adapters/waapi.js](../src/adapters/waapi.js).

| Export | Status |
| --- | --- |
| `animateWAAPI` | experimental |
| `waapi` | experimental |

## `explainerkit/inputs`

The implementation is in [./src/inputs/index.js](../src/inputs/index.js).

| Export | Status |
| --- | --- |
| `bindData` | experimental |
| `bindInputs` | experimental |
| `cameraInput` | experimental |
| `deriveInput` | experimental |
| `deviceMotionInput` | experimental |
| `deviceOrientationInput` | experimental |
| `dragInput` | experimental |
| `fileInput` | experimental |
| `hoverIntent` | experimental |
| `inputSource` | experimental |
| `mapInput` | experimental |
| `microphoneInput` | experimental |
| `pointerInput` | experimental |
| `readInputFile` | experimental |
| `resizeInput` | experimental |
| `smoothInput` | experimental |
| `thresholdInput` | experimental |

## `explainerkit/sound/mix`

The implementation is in [./src/sound/mix.js](../src/sound/mix.js).

| Export | Status |
| --- | --- |
| `createAudioMix` | experimental |
| `encodeWav` | experimental |

## `explainerkit/sound/studio`

The implementation is in [./src/sound/studio/index.js](../src/sound/studio/index.js).

| Export | Status |
| --- | --- |
| `EFFECT_TYPES` | experimental |
| `FILTER_TYPES` | experimental |
| `METER_BANDS` | experimental |
| `MODAL_PRESETS` | experimental |
| `PERCUSSION_KIT` | experimental |
| `PERCUSSION_SOUNDS` | experimental |
| `PLUCKED_PRESETS` | experimental |
| `REVERB_PRESETS` | experimental |
| `SATURATION_CURVES` | experimental |
| `STUDIO_LIMITS` | experimental |
| `SYNTH_PATCHES` | experimental |
| `biquadCoefficients` | experimental |
| `dbToGain` | experimental |
| `effectTail` | experimental |
| `filterResponse` | experimental |
| `gainToDb` | experimental |
| `layerInstruments` | experimental |
| `measureAudio` | experimental |
| `modalInstrument` | experimental |
| `noteSeconds` | experimental |
| `percussionInstrument` | experimental |
| `playInstrument` | experimental |
| `pluckedInstrument` | experimental |
| `processAudio` | experimental |
| `sampledInstrument` | experimental |
| `synthInstrument` | experimental |

## `explainerkit/music`

The implementation is in [./src/music/index.js](../src/music/index.js).

| Export | Status |
| --- | --- |
| `CHORD_QUALITIES` | experimental |
| `CHORD_SHAPES` | experimental |
| `CHORD_VOCABULARIES` | experimental |
| `GRID_UNITS` | experimental |
| `MAX_MUSIC_SECONDS` | experimental |
| `MUSIC_ANALYSIS_VERSION` | experimental |
| `PITCH_NAMES` | experimental |
| `PRODUCTION_LIMITS` | experimental |
| `SCORE_INSTRUMENTS` | experimental |
| `SCORE_LIMITS` | experimental |
| `analyzeMusic` | experimental |
| `arpeggiate` | experimental |
| `arrangeMusic` | experimental |
| `beatsFromText` | experimental |
| `chordPitches` | experimental |
| `createAdaptiveScore` | experimental |
| `createMusicScore` | experimental |
| `editMusicNotes` | experimental |
| `musicGrid` | experimental |
| `musicScoreTime` | experimental |
| `produceMusic` | experimental |
| `readMidi` | experimental |
| `renderMusicEdits` | experimental |
| `renderMusicScore` | experimental |
| `repeatMusicPhrase` | experimental |
| `retargetMusic` | experimental |
| `voiceLead` | experimental |
| `writeMidi` | experimental |

## `explainerkit/vfx`

The implementation is in [./src/vfx/index.js](../src/vfx/index.js).

| Export | Status |
| --- | --- |
| `adjustMatte` | experimental |
| `analyzeFootage` | experimental |
| `analyzeFrame` | experimental |
| `applyDepthHoldout` | experimental |
| `compileCameraTrack` | experimental |
| `compileFlow` | experimental |
| `compileTrack` | experimental |
| `compositeMatte` | experimental |
| `flowStreaks` | experimental |
| `foregroundHoldout` | experimental |
| `measureFlow` | experimental |
| `projectSurface` | experimental |
| `sampleFlow` | experimental |
| `sampleTrack` | experimental |
| `stabilizeCameraTrack` | experimental |
| `stabilizeTrack` | experimental |
| `surfaceTransform` | experimental |
| `traceFlow` | experimental |
| `trackPlane` | experimental |
| `trackPoint` | experimental |

