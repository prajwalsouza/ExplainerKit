# Track graphics on recorded video

Use `explainerkit/vfx` to track a feature or flat surface in recorded footage and composite graphics with foreground mattes or registered depth. For tracked annotations, analyze decoded frames and save positions indexed by clip time. During playback, sample those positions to move an ExplainerKit handle or another graphic.

When placing 3D objects in a moving shot, prepare the fitted camera poses with `compileCameraTrack` before rendering. It automatically repairs isolated pose spikes unless you choose raw playback. Sample the resulting poses at the time of the displayed video frame.

## Frame the text around the action

In BBC's *Sherlock*, a message can arrive while the audience is still watching the recipient react. The press conference in *A Study in Pink* uses that timing to let one message interrupt an entire room. In the crime scene later in the episode, words help show the deductions forming around a physical clue. Director Paul McGuigan also describes leaving room beside a performer so words can sit in the composition. These are three decisions you can make before tracking a shot. [BBC shooting script](https://downloads.bbc.co.uk/writersroom/scripts/Sherlock-A-Study-in-Pink-final-shooting-script.pdf) and [interview with Paul McGuigan](https://www.denofgeek.com/tv/sherlock-visual-language-director-paul-mcguigan/).

```demo video-vfx-storyboard
Original frame studies show where a message, a moving clue and surface lettering can sit in a shot.
```

## Compare text anchors

Play **Wall lettering** to see the words follow the brick. Features on the masonry determine the lettering's perspective for each video frame. The passing shadow darkens the letters along with the wall. **Object clue** follows a point on the microphone and keeps the words upright.

In **Message cues**, choose **Incoming** or **Reply** to see text beside the phone’s upper right corner. The message sits just beyond the glass in the phone’s plane, so the letters follow its tilt and perspective. Turn on **Show screen track** to compare the angle of the letters with the outlined edge of the glass.

A separate card sits on the glass itself. Turn off **Thumb matte** to see the card cover the hand where they overlap.

```demo video-vfx-anchors
ExplainerKit renders the lettering, leader and messages over licensed footage. Each view includes its source credit. [Pexels license](https://www.pexels.com/license/).
```

## Replace a screen behind a speaker

Play the presentation excerpt to see a waveform curl into a flower on the screen as the speaker passes in front of it. Click **Trace** on the screen to pause and read what the waveform represents. Turn on **Microphone label** to see a separate track follow the microphone over the footage.

Pause near 2.4 seconds and choose **Matte**. White pixels keep the original footage, black pixels let the new slide through, and gray pixels represent partial coverage. Switch **Matte source** between **Outline** and **Shot refined** to compare the hairline. Increase **Feather** to widen the transition, or use **Shift edge** to move it inward or outward. Return to **Composite** to see how the edge looks against the artwork.

**Auto-track screen** analyzes sampled frames and outlines the screen it finds. Compare the outline with the artwork, which follows the prepared track. **Analyze frame** shows candidate features in the region used by that track.

```demo video-vfx
An ExplainerKit scene animates the illustrated waveform on the tracked screen. The foreground matte keeps the speaker in front. Silent footage excerpt from [A Woman Talking while Holding a Microphone by Pavel Danilyuk](https://www.pexels.com/video/a-woman-talking-while-holding-a-microphone-8716580/) under the [Pexels license](https://www.pexels.com/license/).
```

The screen track uses classical feature matching and a check against the visible bezel. The authoring process aligns screen pixels from across the shot and collects parts of the original slide that become visible as the speaker and camera move. This estimate of the background is called a clean plate. Around the hand drawn outline, differences from the clean plate help estimate how much of each pixel belongs to the speaker. Nearby frames help steady the edge when their motion agrees. The refinement covers the area where the speaker crosses the screen. Some areas of the screen stay hidden throughout the shot, so the composite relies more on the outline there.

## Track screens and surfaces

The demo automatically looks for a screen in **Presentation screen** and **Laptop outdoors**. The blue outline appears when the detector finishes. Play or scrub to watch it follow the screen. **Find and track screen** runs the detector again or tries it on another clip. It looks for a wide, bright region and can use the bezel when the display itself is blank.

Choose **Phone at an angle** or **Brick and moving shadow**, then click **Track surface** to follow a marked patch on the glass or brick. To choose another patch, click **Mark surface** and mark four corners on the first frame in order, starting at the top left and going clockwise. Use the arrow keys and Enter to mark corners with a keyboard. Click **Track surface** and play or scrub to inspect the blue outline. The demo stabilizes the measured corners before playback.

Use **Show motion regions** to see the scan’s separate motion proposals in amber. In the wall clip, a passing shadow can register as a motion region even though it moves across the brick.

```demo video-vfx-auto-study
Find a screen or track a marked surface in five footage clips. Each selection links to its source.
```

The motion regions in this demo come from a scan of each clip made ahead of time. The scan script that produced them is part of ExplainerKit's development repository rather than the package, so the guide shows its results but cannot yet offer it for your own footage.

## Place an object in a moving shot

Play the room shot and watch the partition reveal the trash can. The camera moves sideways, so nearby objects shift faster in the image than distant ones. This difference is called parallax. Turn **Foreground occlusion** off and on to compare the image with the partition drawn in front of the can. Turn on **Show fitted planes** to see horizontal surfaces in green and vertical surfaces in amber.

```demo video-vfx-rgbd
Place a trash can in recorded room footage with synchronized depth and a camera path estimated from the footage.
```

Pause on an open patch of floor, click **Place on floor**, then click the patch or use the arrow keys and Enter. The demo projects the selected pixel onto the fitted floor and checks it against recorded depth. It stores one 3D position and uses the estimated camera pose to project that position as the camera moves. At each pixel, a closer depth measurement can hide the virtual object. Where depth is missing, the footage supplies no occlusion decision.

The sidewalk shot uses a camera fit from image features on the brick and the pavement. Turn on **Show ground plane** to see the fitted patch and the direction the can stands in. The camera mostly pans, so this example demonstrates contact with the pavement. Its composite has no measured depth layer.

```demo video-vfx-world
A solid trash can rests on the estimated pavement while the camera pans.
```

The room camera solve follows features at different distances through the RGB frames and steadies the resulting camera poses before playback. Synchronized depth sets the metric scale, supplies points for fitting floors and walls, and determines which real pixels sit in front of the insert. The sidewalk and room examples use prepared shot data. Use the spatial guide to project world coordinates with a camera. [Camera, projection and rays](spatial-three.md#camera-projection-and-rays).

## Composite behind moving people

Play the aisle shot to see a virtual cone stay on the floor as a person crosses in front of it. Use **Jump to crossing** to pause on the overlap, then switch **Foreground occlusion** off and on. The comparison shows which parts of the cone the person hides.

```demo video-vfx-crossing
An orange cone stands on a fitted floor while a person walks past.
```

In the desk shot, **Place on tabletop** sets the display on a higher plane. Pause and choose an exposed spot on the desk, or use the arrow keys and Enter. Turn on **Show tabletop plane** to see the fitted outline follow the desk as the camera moves. The depth comparison lets a person pass in front of the outline and display.

```demo video-vfx-tabletop
A small virtual display sits on a fitted tabletop and is briefly hidden by a person.
```

Both excerpts start with motion-capture camera poses. The aisle preparation repairs an isolated camera spike and then refines the track using features around the placement area. The desk shot refines its poses using features on and around the desk. Nearby color frames supply local motion to align the recorded depth to the displayed video in both shots. Fast motion and missing depth can still leave an edge around a moving person.

## Match the light and shadow

The can casts a shadow on the fitted ground and has a smaller contact shadow where its base meets the floor. The sidewalk example takes the horizontal light direction from a visible pavement shadow and uses an authored elevation to set the shadow's length. Turn **Match shadow direction** off to compare it with an authored direction.

In the room example, turn **Match scene color** off to compare the ungraded can. The room's gray floor serves as a reference for the blue cast and brightness. The grade is held steady through the shot. It describes how that surface appears in the recording, which depends on both its material and the light. The room shadow uses an authored light direction.

Play **The Solar System in a Field**. The blue marker beside the leaves shows Earth’s position on the first frame. As the drone rises, look for the planets farther out across the fields. The two strokes around each projected center mark its position. The gap leaves room for the body itself, which is often smaller than a pixel in the footage.

The model uses 500 m for 30 astronomical units throughout the shot. Earth is about 1.42 mm across, Saturn’s globe is 1.34 cm across, and the Sun is 15.5 cm across. The opening holds the planets at their positions on 12 November 2022 while the drone rises. From **The wide shot**, two years of orbits and axial rotation play through 12 November 2024. As a planet moves farther from the camera, it appears smaller. **The outer planets** compares the gaps between Saturn’s, Uranus’s and Neptune’s distances from the Sun.

Turn **Sun lighting** off to compare the original field exposure with the shader’s added light. The shader projects warm illumination onto the fitted ground plane. It uses the Sun’s position to determine where the light falls and an authored exposure to make it visible in daylight. A soft halo surrounds the Sun’s disk.

Pause on a date and select a body to inspect it with a close camera. Choose **+6 h** to advance its orbit and spin, or **Field view** to return to the footage. Toggle **Cast shadows** in a close view to see the planet and its rings darken the virtual ground. Open **Compare diameters** to see the Sun and the planets side by side at one magnification.

```demo video-vfx-solar-field
The demo projects the model through a smoothed camera track fitted to the silent drone footage. The scale and placement in the field are authored estimates. Surface maps were resized and assembled into an atlas. [Pexels field footage](https://www.pexels.com/download/video/7715483/), [Pexels license](https://www.pexels.com/license/), [Solar System Scope](https://play.solarsystemscope.com/textures/), and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
```

The dates use the time scale of the [JPL DE440 ephemeris](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440_and_de441.pdf). The demo interpolates geometric positions and velocities relative to the Sun, using [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) center positions for the four giant planets. The thin curves show representative three-dimensional orbits. The spin and pole directions come from [NAIF planetary constants](https://naif.jpl.nasa.gov/pipermail/spice_announce/2022-December/000153.html). Surface maps illustrate the planets’ appearance; they do not show clouds or weather on the selected date.

The ring models lie in their planets’ equatorial planes. Saturn’s main rings are visible up close. Jupiter’s dust rings are much fainter, and the demo does not increase their opacity to make them easier to see. The Uranus and Neptune models include selected rings. Ring radii come from NASA’s fact sheets for [Jupiter](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupringfact.html), [Saturn](https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html) and [Neptune](https://nssdc.gsfc.nasa.gov/planetary/factsheet/nepringfact.html), and a [NASA ring data compilation](https://ntrs.nasa.gov/api/citations/20190001175/downloads/20190001175.pdf) for Uranus. Diameters use the [planetary fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) and [Sun fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html).

## Animate a character in recorded footage

Play the sidewalk shot and pause at 2.64 seconds to see the robot's foot meet the can. The joint rig moves the robot through the same world coordinates as the can. One foot stays planted during the kick, and the can begins an authored slide after contact. Watch the eyes change as the robot recovers.

```demo video-vfx-character
A rigged robot walks up to the can and kicks it. The performance and the can's response are authored.
```

## Bring a woodland into a living room

Play **Woodland** and watch the fox emerge beside the coffee table. Scrub back to 0.32 seconds and turn **Coffee table occlusion** off to reveal the fox's paws. The fox's leg rig keeps the paws planted during the stance phase of each step, even as it turns. The butterflies flap around their own wing hinges.

Switch to **Folding rover** and start the clip from the beginning. The solar panels open before the rover drives across the tabletop. Watch the wheels turn and the contact shadow move with the rover.

Pause and click the rover or use **Open panels** to change its pose. Choose **Place rover**, then click the tabletop or move the rover with the arrow keys and press Enter. The rover stays at the chosen world position as you scrub. **Reset rover** restores the preset animation.

```demo video-vfx-forest
Two animated 3D scenes share a camera track recovered from the living-room footage.
```

The camera solve uses features across the room to recover the changing viewpoint. It balances alignment with the observed features against sudden changes in camera velocity. A floor plane and a box fitted to the coffee table establish where the models sit. Each frame projects the box into a depth map, so the tabletop and its sides can hide parts of the woodland. The box approximates the shape of the table.

Both effects use authored lighting and soft contact shadows where the models meet the floor or tabletop. The rover also casts a shadow onto the table that changes shape as its panels open.

## Place clues in moving footage

Play **Reading room** and compare the clue at the far end with **Shelf 17** as it appears on the left. They occupy different planes in the reconstructed room, so they move differently as the camera passes. Click either clue to pause and read its detail.

Switch to **Stone alley** to see lettering follow the perspective of the right wall. The wall track combines features spread across the stonework and smooths the resulting motion over neighboring frames. The reading room uses a camera solve across the scene. Both play prepared tracks, and the clue text is fictional.

```demo video-vfx-scene-text
Select and open a clue directly in either shot.
```

## Guide a flock through a recorded room

Choose a shot under **Footage**, then play and move your pointer or tap inside the video to steer a flock of folded paper airplanes. Move the pointer across the frame to see the planes bank, spread out, and regroup. With the shot focused, use the arrow keys to move the target and Escape to clear it.

Pause the video and steer again. The planes keep moving while the camera, person and room stay on that frame. Resume playback to continue from the flock's new position.

Choose **Play from crossing** to meet the person in each shot. In **Living room**, she enters as the camera moves. In **Sunlit house**, she walks toward the camera past a sofa. In **Sitting room** and **Long hallway**, she walks away and the flock can pass at different depths.

Watch the folds catch light as the planes turn. Each shot has its own range of blue and purple paper. In **Sunlit house**, steer the flock across the bright strip from the glass door. In **Long hallway**, watch the planes pass under the ceiling lights. Toggle **Cast shadows** to see where the planes darken the floor or a fitted wall.

Turn on **Show collision volumes** to see what the flock steers around. Green outlines mark furniture and walls, and amber outlines follow the person. The default **Mesh** mode uses shaped faces for furniture and body regions. Switch **Geometry** to **Boxes** to compare the simpler volumes. Changing geometry resets the flock's route. Toggle **Person occlusion** to compare how her silhouette hides planes at greater depth. The planes continue steering around her in both views.

```demo video-vfx-boids
Guide a live flock through four recorded interiors. Scrub back to replay your route or choose **Reset flock** to clear it.
```

Each shot uses prepared camera geometry, approximate obstacle volumes, and an offline person matte. Light positions and directions are estimated from the visible windows, fixtures and shadows. The pointer is projected into the room so the target and airplanes occupy the same 3D space as the collision volumes.

## Composite with recorded depth

When a shot supplies registered depth, use `applyDepthHoldout` to produce an RGBA overlay for the original footage. Give it the insert's pixels, the insert's camera-space depth per pixel, and the observed scene depth. Both maps must cover the same image area and measure distance along the camera's forward axis in the same units. Lower-resolution observed depth is sampled at the nearest pixel. To decode integer depth, pass the scale per stored unit.

```js
import {applyDepthHoldout} from 'explainerkit/vfx';

const overlay = applyDepthHoldout({
  width, height,
  insert: insertRGBA,
  insertDepth: insertMeters,
  observed: {width: depthWidth, height: depthHeight, data: sensorDepth, scale: 0.001},
  bias: 0.065,
  softness: 0.04,
});
```

Each depth image accepts integer dimensions of 1–4096 pixels per side and at most 2,097,152 pixels. The insert depth uses a `Float32Array`. Observed depth accepts a `Float32Array`, `Uint16Array` or `Uint8Array`. Zero and other nonpositive or nonfinite samples leave that insert pixel as it was. The function returns a new buffer and keeps the input colors.

The `bias` lets a virtual sample stay visible when a real sample is slightly closer. Use it to keep a shadow near the surface that receives it despite sensor noise. The `softness` is the depth interval over which alpha rises from zero to its original value. Both are in the same units as insert depth, accept values from 0 to 1,000,000, and default to zero. For a clean silhouette, inspect the depth at the occluder's edge. A depth tolerance alone cannot fill a hole left by the sensor.

## Choose a region

Supply a plain record with the decoded frame's `width`, `height` and `data`. The pixel buffer can be grayscale or RGBA bytes. Each side can be 8–4096 pixels, with up to 2,097,152 pixels total. For example, a browser authoring tool can draw a video frame to a canvas, then pass the dimensions and `getImageData(...).data` explicitly. Use the same analysis dimensions throughout a track.

`analyzeFrame(frame, {region, exclude})` returns candidate feature positions, brightness, contrast and the fractions of dark and bright pixels. The region can be a rectangle or a convex quadrilateral. With no region, analysis uses the whole frame. Positions are in analysis pixels, with the origin at the top left. The eight optional exclusion rectangles remove overlapping feature patches from consideration. Brightness and contrast describe the selected image area.

To inspect a clip before tracking, call `analyzeFootage([{time, frame}, ...], {region, exclude})` with up to 16 increasing timestamps and at most 8,388,608 pixels in total. Each frame uses the same analysis dimensions. It returns per-frame observations, intervals where the picture changed enough to suggest a cut, and a suggested reference time if it found a textured frame. The scan compares sampled images and can miss cuts or flag large lighting changes. Review the suggested frame and choose which features belong to the surface.

A tracking feature needs detail that changes in two directions, such as a corner or printed marking. If there are few candidates, enlarge the region within the same surface, choose a more textured area or place keyframes manually. A strong feature can still come from a reflection or an independently moving object. Exclude it if it moves differently from the plane you want to track.

## Track a point or plane

Call `trackPoint(previous, next, {point})` for a label that follows a single feature. Use adjacent or closely spaced frames and update the starting point from the previous result.

For a graphic that follows the perspective of a surface, call `trackPlane` with the region to analyze. Supply `surface` to place the insert independently on the same plane. Both use the previous frame's image coordinates. Keep the four corners in a consistent order, such as top left, top right, bottom right and bottom left.

```js
import {trackPlane} from 'explainerkit/vfx';

// previous and next are decoded frames with matching dimensions.
const result = trackPlane(previous, next, {
  region: {x: 142, y: 100, width: 332, height: 151},
  surface: [{x: 286, y: 173}, {x: 437, y: 173}, {x: 437, y: 207}, {x: 286, y: 207}],
  motion: 'affine',
});
```

A successful plane result gives you the next `region` and the new insert corners in `value`. Feed those into the next step. A failed match returns `value: null` with a reason. Stop there or ask the author to correct the track. The diagnostics include the number of candidates, matches and features that agree, plus the plane's root mean square residual in analysis pixels. Confidence is a score based on match quality and support. A possible cut is a cue to inspect a change in the whole frame.

The default motion model is `perspective`. Choose `translation` for a region that just shifts or `affine` to allow rotation, scale and skew. Restricting the model helps when fewer distinct features are available. Search extends 2–20 analysis pixels from each feature, with a default radius of 10. Increase it within that range for faster movement or sample frames closer together. `excludePrevious` and `excludeNext` each accept up to eight rectangles. An exclusion affects tracking. A separate foreground mask would be needed to hide part of an insert.

## Play and correct the track

Save a `{kind, samples}` record, where the kind is `'point'`, `'plane'` or `'matte'` and each sample is `{time, value}`. Times are clip seconds from 0 to 86,400 and must strictly increase. A record accepts 1–4096 samples. Use a null value at a lost sample or a boundary that should interrupt an insert. To correct the track, replace or add an authored sample and compile the edited record again.

```js
import {compileTrack, projectSurface, sampleTrack} from 'explainerkit/vfx';

// savedTrack is the parsed track record. video is an existing HTMLVideoElement.
const track = compileTrack(savedTrack);
const surface = sampleTrack(track, video.currentTime);
const center = track.kind === 'plane' && surface ? projectSurface(surface, 0.5, 0.5) : null;
```

Sampling interpolates positions between adjacent valid samples. It returns null outside the track, next to a missing sample or if an interpolated surface becomes invalid. A forward or backward seek to the same time returns the same geometry. Map the returned coordinates to the video's displayed content area, accounting for any letterboxing or crop. For a projective insert, `surfaceTransform(surface, width, height)` maps an insert rectangle into the four image corners. Its eight coefficients are `[a,b,c,d,e,f,g,h]`, where the projected coordinates are `[(a*x+b*y+c)/(g*x+h*y+1), (d*x+e*y+f)/(g*x+h*y+1)]`.

For a measured point or plane track, pass the compiled track to `stabilizeTrack` before playback. It returns a new compiled track with short changes averaged using nearby samples on both sides of each time. It preserves constant motion, the endpoints of each run and gaps. Keep a missing sample at a lost track or cut so the smoothing stops there.

For a recorded 3D camera path, pass the calibrated poses for one shot to `compileCameraTrack`. Give it 3–300 poses with row-major world-to-camera rotations and translations in meters. Include increasing `time` values in seconds for unevenly spaced poses. Omit all timestamps for evenly spaced poses.

```js
import {compileCameraTrack} from 'explainerkit/vfx';

// recordedPoses contains calibrated world-to-camera poses for one shot.
const {samples, repaired} = compileCameraTrack(recordedPoses);
```

The default `standard` level replaces isolated out-and-back pose errors with an interpolation between neighboring poses. Use `{stabilization: 'strong'}` to catch smaller spikes. It can also remove small, real out-and-back camera moves. Use `{stabilization: 'none'}` to validate the track and preserve its measured poses for comparison. The `repaired` array lists the zero-based indices that changed.

Use the returned samples when projecting the scene. Camera repair operates on poses you already fitted to the footage. If an insert drifts from the footage over several frames, refine that fit against visible features. For a changing lens or a digital crop, carry the matching camera intrinsics or crop into projection. The lower-level `stabilizeCameraTrack` function applies the same standard repair when called directly.

## Keep a foreground subject in front

For a foreground matte, save an outline of 3–96 vertices at each authored time. Keep vertices in the same order when you want interpolation between outlines of the same size. When vertex counts differ, the earlier outline holds until the next sample. The same null samples used for lost tracks can mark missing matte data.

To put a replacement behind the subject, apply `foregroundHoldout(outline, width, height)` as the `clip` on the ExplainerKit group containing the replacement. The matte vertices use the same pixel coordinates as the scene and must lie within its frame. The clip keeps the part of the group outside the foreground outline. The original video underneath shows through the hole, including the moving subject. Other graphics can remain above the subject in a separate group.

```js
import {foregroundHoldout, sampleTrack} from 'explainerkit/vfx';

// matte is a compiled matte track and insert is an existing ExplainerKit group.
const foreground = sampleTrack(matte, clipTime);
insert.set(foreground
  ? {opacity: 1, clip: foregroundHoldout(foreground, 640, 360)}
  : {opacity: 0});
```

## Feather and composite a matte

Use `adjustMatte(alpha, width, height, {feather, shift})` when you have a raster matte with one coverage byte per pixel. Zero means uncovered and 255 means fully covered. Positive shift expands the foreground coverage and negative shift contracts it. Feathering softens the shifted edge. Both settings use whole image pixels and default to zero. The feather range is 0–24 and the shift range is −24 to 24. The operation returns a new buffer, so you can compare settings against the same original matte.

Use `compositeMatte` when a replacement should appear behind a partially covered foreground pixel. Give it matching dimensions and the opaque footage, replacement graphic and foreground coverage. The two color buffers use straight sRGB RGBA bytes. The result is a new RGBA overlay. Place it over the original footage. Pixels outside the insert or behind fully covered foreground stay transparent in the overlay. Changed pixels contain the composited color.

If you have a registered clean plate, pass it as `cleanPlate` with RGB colors for the old background and confidence in the alpha channel. At a partially covered edge, the compositor uses that estimate to remove some of the old background color before adding the replacement in linear light. The subtraction is bounded by the observed pixel so an overly bright plate cannot create a black fringe. A zero-confidence pixel falls back to ordinary coverage blending. Feathering changes the transition across a matte you already have. Estimating hair, transparency and motion from the footage is a separate authoring step.

```js
import {adjustMatte, compositeMatte} from 'explainerkit/vfx';

// coverage is one byte per pixel. The other buffers are straight RGBA.
const foreground = adjustMatte(coverage, width, height, {feather: 1, shift: 0});
const overlay = compositeMatte({width, height, footage, insert, foreground, cleanPlate});
```

These raster functions accept integer dimensions from 1 to 4096 with at most 2,097,152 pixels. Match the dimensions of each buffer to the requested output. You can crop all inputs to the same region when the insert only covers part of the video.

Use the [media clock](media-clock.md) to synchronize a scene player to the video when its timeline also drives motion or narration. The VFX functions work on caller supplied frames and track data. Frame decoding, video controls, hit testing and the visual treatment of the insert belong to the host. Tracks describe image positions, planar motion and authored outlines.
