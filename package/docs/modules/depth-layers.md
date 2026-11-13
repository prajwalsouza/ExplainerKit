# Add depth and focus with layers

`drawing.layer({depth=1,bounds})` creates a root group with convenience `circle`, `rect`, `line`, `path`, `text`, `instance(component)` and `add(rootHandle)` methods. Children retain their ordinary identity, inputs and animation tracks. A depth can be a positive number or an input owned by this scene. Up to 32 layers are supported, with depth [.05,1000]. Nested depth layers refuse; ordinary groups inside them work.

```js
const far = drawing.layer({depth:6});
far.circle({x:200,y:150,r:70,fill:'#278b88'});
const middle = drawing.layer({depth:2});
middle.add(existingRoot);
drawing.camera().to(0,{x:600,zoom:1.1},{duration:8});
drawing.focus({depth:2,aperture:.2});
```

Depth creates a 2.5D effect by moving flat layers at different rates rather than measuring metres or simulating a lens. If `C` is camera center, `O` is viewport center, `Z` is zoom and `d` is layer depth, the layer uses center `O+(C-O)/d` and zoom `Z**(1/d)`. All layers share view rotation. Depth 1 gives the ordinary camera, and zoom stays positive and preserves a value of 1. Local transform and zoom bindings can still move a layer group before this camera relationship is applied.

Focus adds `blur = 12 * aperture * abs(1/d - 1/focalDepth)` to the layer’s authored blur. The multiplier of 12 is an artistic choice in scene pixels rather than a measured depth-of-field model. Aperture accepts [0,8], and combined blur must stay within the 64-unit property limit and renderer work and memory budgets. Focus depth and aperture may come from scene inputs and reproduce the same values during backward seeks.

`bounds` defaults to the authored scene rectangle. It declares the layer's finite, clipped content window and raster extent. Its clip channel is reserved; choose larger explicit bounds for artwork revealed by camera motion. This gives SVG and cached Canvas the same visible boundary. Bounds width/height are positive and at most 8192. A layer cannot contain itself or adopt its ancestor.

Canvas caches a layer's local content, appearance, blur and lighting. A camera pan that changes only placement reuses the raster. Geometry, focus, lighting, relevant transforms and screen-anchored textures invalidate it. `renderer.stats.layerRenders` and `.cacheHits` expose cumulative instrumentation. A least-recently-used (LRU) policy limits the pixels retained in the cache; disposal clears them. This is a renderer optimization, not state that affects the sampled frame. It does not promise cache reuse for arbitrary changing artwork.

The inverse-depth convention is motivated by perspective's size/distance relation ([CSS Transforms perspective](https://www.w3.org/TR/css-transforms-2/#perspective-property)); this module deliberately uses a bounded 2D authoring rule instead of projecting a physical camera. The focus multiplier and default depths are design controls, not empirical claims.
