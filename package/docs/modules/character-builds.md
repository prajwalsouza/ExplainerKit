# Biped proportions, motion and outlined heads

`stick({style:'heavy'})` creates a character with a 52-unit resting stance, about 0.3 of its 174-unit height. To change the feet without replacing the other proportions, supply `build:{foot:26}`. The override is applied to that style’s own build.

Walk/run plans account for the resting stance and available leg reach, including
horizontal extrema during each smooth foot swing. Wider stances receive more,
shorter steps when needed to keep knees above the floor. Lift and bob scale with
leg length. Feet remain planted in world coordinates during support; zero speed
is finite. Plans refuse more than 10,000 steps with `RESOURCE_LIMIT`.

The shared shoulder calculation and exposed `poseLayout` metadata support keyed
hand targets and root-follow IK. A rig's explicit reach constraint can lower its
hip when a posed foot needs more vertical reach.

Classic, xkcd and heavy outlined heads have transparent interiors by default. Set `paper` explicitly when a painted face disc is intended. Solid and skin styles retain their paint, and small eye and lid details keep their light-stage treatment. Recorded character-build measurements compare SVG and Canvas output, including edge differences, without claiming pixel-identical results for every background.

`auditCharacter(definition,{background:'#000000'})` reports `contrast` and a
`warnings` array. An opaque contrasting head disc produces
`HEAD_FILL_CONTRAST` when its luminance contrast ratio is at least 3 against both
ink and background. This artistic diagnostic is separate from geometric pass/fail
and does not certify text accessibility. Missing/translucent background is
`unverified`; unsupported solid colors are rejected by the paint validator.
Transparent parts cannot connect otherwise detached artwork in the audit.
Explicit `encloses:true` outlines can connect same-bone details contained inside
them, so face details remain connected without an invisible painted connector.

The native character suite audits every starter across every action and includes focused checks for wide stances, zero speed and head construction. Run `node benchmarks/character-builds.mjs` to compare original synthetic SVG and Canvas pixels. The report at `benchmarks/results/character-builds.json` records a fingerprint of the source used.