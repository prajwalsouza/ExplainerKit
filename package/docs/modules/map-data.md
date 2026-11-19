# Real map data

A map that explains a real place needs real ground, real water and, for a street scene, real buildings and roads. This guide shows how to download the elevation, rivers and lakes for a region and the OpenStreetMap streets for a few city blocks, and how to turn them into values that `explainerkit/maps` and a renderer can use. It also explains which credit each source requires and how the downloads are limited.

Three modules share the work. `explainerkit/maps/fetch` downloads files only when you call it. `explainerkit/import/geotiff` reads the elevation tiles it downloads. `explainerkit/maps/osm` parses street data into buildings, roads, trees and other features. None of them draws anything, and none of them downloads anything while a scene is being sampled.

## How downloads work

Real elevation and map extracts are far too large to bundle, so the library ships none of them. A download happens only when your code calls a loader, and it goes through the `fetch` function you pass in. In a page or in Node 18 and later that is usually the platform `fetch`, but it can be any function with the same shape, such as one that reads local files or adds a header. The modules never use a global `fetch` by themselves, and every address they build starts with `https://`.

Each loader can also take a cache. A cache is any object with `async get(key)`, which resolves to the stored bytes or `null`, and `async set(key, bytes)`, which stores a `Uint8Array`. `memoryCache()` keeps files in memory for the life of the page or process, up to 512 MiB by default, and drops the oldest file when a new one would not fit. A page can keep files longer with the browser's Cache Storage, and a Node script can write them to disk.

Every download has a byte limit. When the server reports a larger size, or the streamed body grows past the limit, the download stops and the loader throws an error with the code `RESOURCE_LIMIT`. A missing file throws `FETCH_FAILED`, except for elevation tiles over open sea, which are described below.

## Download the elevation of a region

The task here is to get a heightfield for a region a few hundred kilometres across, such as the Blue Nile highlands between 9° and 14° N and 34.5° and 40° E. `loadElevation` works out which Copernicus DEM tiles cover the box, downloads only those, and resamples them onto one even grid.

```js
import {loadElevation, memoryCache} from 'explainerkit/maps/fetch';

const cache = memoryCache();
const bbox = {west: 34.5, south: 9, east: 40, north: 14};
const {field, projection, tiles, sources} = await loadElevation({bbox, fetch, cache, columns: 1024});
```

The Copernicus DEM is a model of ground and surface height published by the European Space Agency. Each tile covers one degree of latitude by one degree of longitude and is served from a public bucket on Amazon Web Services without a key. The default `resolution: 90` reads the 90 m tiles, and `resolution: 30` reads the 30 m tiles, which are about nine times larger. The data provider publishes no tile over open sea, so a tile that answers 404 is treated as sea and its samples are 0. Missing-data samples inside a tile are also set to 0.

The result is a heightfield from `explainerkit/maps` with `columns` samples across, 512 by default and at most 2048. `rows` follows from the shape of the box unless you set it. Row 0 is the north edge, and positions are metres east and north of the box's centre. `projection` converts between degrees and those metres, so `projection.project(37.3, 12)` gives the position of Lake Tana on the field. `tiles` lists each tile with its address and whether it was sea or came from the cache. `onProgress` is called once per tile with `{done, total, tile}`.

The Blue Nile box needs 30 tiles, about 130 MB in all, and `maxTiles` stops a box that needs more than 64 tiles unless you raise it, to at most 256. Each tile may be at most `maxBytes`, 64 MiB by default. Every tile that arrives is kept decoded until the grid is built, so 30 tiles at 90 m hold about 170 MB of samples at once.

The heightfield feeds every function in [relief maps](relief-maps.md). For example, `hillshade(field)` shades it and `flow(field)` finds where water runs.

## Download rivers, lakes and coastlines

Rivers traced from elevation follow the steepest path from sample to sample, which is useful for animation but does not give the mapped course or the name of a river. `loadNaturalEarth` downloads one layer of the Natural Earth 1:10 million vector data and keeps only the parts inside your box.

```js
import {loadNaturalEarth} from 'explainerkit/maps/fetch';

const {features: rivers} = await loadNaturalEarth({layer: 'rivers', bbox, fetch, cache});
const {features: lakes} = await loadNaturalEarth({layer: 'lakes', bbox, fetch, cache});
```

The layers are `rivers`, `lakes`, `coastline` and `countries`. They are read from the GeoJSON files in the `nvkelso/natural-earth-vector` repository on GitHub. Each feature has `kind`, `name`, `lines` and `rings`, and every point is `{lon, lat}` in degrees. A line keeps only its runs of points inside the box, and a ring is kept whole when any point of it lies inside. Convert the points with the `projection` from `loadElevation` to place them on the heightfield. A layer file may be at most `maxBytes`, 64 MiB by default, and a box may hold at most `maxFeatures` features, 5000 by default.

## Bake a region once

Downloading 130 MB every time a page opens would be slow and unkind to the servers. The development repository includes `scripts/maps/bake-region.mjs`, which runs the same loaders from Node, keeps every downloaded file in `.local/map-cache/` and writes the finished region to `.local/regions/<id>/`. A second run reads only the cache, so it works offline.

```bash
node scripts/maps/bake-region.mjs --id blue-nile --west 34.5 --south 9 --east 40 --north 14 --columns 1024
```

The script writes three files. `heights.f32` holds the samples as 32-bit floats, row 0 north. `water.json` holds the rivers, lakes and coastline in degrees. `region.json` records the box, the projection centre, the grid size, the tiles and the sources with their licences and attribution. Neither the cache nor the baked region is committed. The first Blue Nile bake took about five and a half minutes, and a run from the cache takes about 12 seconds.

A page loads the baked folder with `loadBakedRegion`. `base` is the folder's address and must end with `/`. The water comes back already converted to metres on the field.

```js
import {loadBakedRegion} from 'explainerkit/maps/fetch';

const region = await loadBakedRegion({base: '/regions/blue-nile/', fetch});
const {field, projection, water, sources} = region;
const tana = water.lakes.find((lake) => lake.name === 'Lake Tana');
```

Each of the three files may be at most `maxBytes`, 64 MiB by default. The Blue Nile bake has 1024 × 950 samples from 430 m to 4479 m. Its rivers are the Abay, El Bahr el Azraq, Tekeze, Setit, Awash and Omo, and its lakes are Lake Tana and the Roseires Reservoir.

## Download the streets of a few blocks

A street scene needs buildings, roads, trees and lamps for an area a few hundred metres across. OpenStreetMap holds that data, and the Overpass API answers queries for it. `overpassClient` is a polite downloader for those queries. It sends one request at a time, waits at least `minInterval` milliseconds between requests (1000 by default), and keeps each answer in your cache.

```js
import {overpassClient} from 'explainerkit/maps/fetch';

const streets = overpassClient({fetch, cache});
const block = await streets.load({south: 52.364, west: 4.8847, north: 52.3667, east: 4.8931});
// block.text is the Overpass JSON, and block.attribution is the credit to show.
```

The public Overpass servers are shared and sometimes answer 502 or 504 when they are busy. The client therefore tries the addresses in `endpoints` in order. When a server answers 429, 502, 503 or 504, or cannot be reached, the client waits and tries the next one. Any other failure, such as 400 for a query the server rejects, stops at once. When every server fails, the error lists what each one answered. The default list is in `OVERPASS_ENDPOINTS`, and you can pass one to eight `https` addresses of your own.

A query may cover at most 0.02° of latitude by 0.03° of longitude, about 2 km by 2 km in central Europe. `timeout` is the time the Overpass server may spend on the query, from 5 to 180 seconds and 25 by default. An answer may be at most `maxBytes`, 32 MiB by default. `load` resolves to `{text, endpoint, cached, sources, attribution}`, where `endpoint` is the server that answered or `null` when the answer came from the cache. `loadOverpass({bbox, fetch, cache})` does the same for a single box without keeping a client.

`overpassQuery(bbox)` returns the query text on its own, in case you want to send it with another tool. It asks for JSON with each way's geometry included, and one request covers every list that `parseOverpass` returns. Several keys, such as `shop`, `amenity`, `leisure` and `barrier`, are requested with any value, so an answer also holds tags that the parser does not read. Parking spaces (`amenity=parking_space`) are left out, because a single car park can hold hundreds of them. An answer saved with an older, shorter query still parses, and the lists it has no tags for come back empty.

## Turn OpenStreetMap data into street features

`parseOverpass` from `explainerkit/maps/osm` reads an Overpass JSON answer and returns named lists of features with coordinates in metres. You supply the text, either from a download or a saved file. `osmSummary` counts what came back so you can see what the map holds before you draw it.

```demo design-osm-map
Use the buttons to highlight a church, a bridge, or the Seine on this map of Île de la Cité, Paris. The highlighted shape comes from the parser. The tags beside it are from the original OpenStreetMap record. The church height and bridge width are inferred because the extract has no value for those measurements.
```

```demo design-tall-tale
Two buildings and one tall tale. Slide the marker to add or remove the second building’s height tag. The parser marks a missing height as inferred. The example uses a fictional extract supplied inline.
```

```js
import {osmSummary, parseOverpass} from 'explainerkit/maps/osm';

const bbox = {south: 52.364, west: 4.8847, north: 52.3667, east: 4.8931};
const city = parseOverpass(block.text, {bbox});
for (const building of city.buildings) console.log(building.kind, building.height, building.inferred);
console.log(osmSummary(city).amenities); // for example {count: 34, kinds: {bench: 7, ...}, other: 0}
```

`bbox` keeps only features that reach into the box and puts the projection centre in its middle. It may span at most 0.2° of latitude and 0.3° of longitude. `center` ({lon, lat}) sets the centre instead. Without either, the centre is the middle of every position in the answer. Positions come back as `x` metres east and `y` metres north of the centre, and `projection` converts between those metres and degrees.

`include` lists the feature groups to read and reads all of them by default. The groups are `buildings`, `roads`, `water`, `green`, `trees`, `lamps`, `crossings`, `amenities`, `places`, `barriers`, `rails`, `areas`, `entrances` and `zones`. Leaving a group out leaves its list empty. Places and entrances are linked to buildings only when `buildings` is read, because the link needs the building outlines.

The result holds one list per group, together with `projection`, `center`, `bbox` (the box in degrees with its corners `x0`, `y0`, `x1` and `y1` in metres), `attribution` and `timestamp`, the time of the OpenStreetMap data the server reported. Every feature is a frozen object with its OpenStreetMap `id`.

The same parsed features can become a 3D scene. See the [city previews](cinematic-streets.md#the-example-page) for Paris, London and New York.

### Buildings, roads, water, green areas, trees, lamps and crossings

These seven lists give the main shapes of a street scene. In the table, the fields after "and" in the buildings, roads, trees and crossings rows are optional details, described in the next table.

| Group | Each feature | Notes |
| --- | --- | --- |
| `buildings` | `ring`, `holes`, `area`, `kind`, `height`, `minHeight`, `levels`, `roofShape`, `roofHeight`, `roofLevels`, `roofDirection`, `roofAcross`, `wallColor`, `roofColor`, `material`, `roofMaterial`, `groundFloor`, `part`, `tag`, `name`, `address`, and `year`, `architecture`, `flats`, `facadeMaterial`, `use` | `height` is the top of the building, roof included, in metres above the ground. `minHeight` is where its walls start. |
| `roads` | `points`, `highway`, `foot`, `lanes`, `width`, `sidewalk`, `oneway`, `surface`, `bridge`, `tunnel`, `layer`, `name`, and `maxspeed`, `lit`, `cycleway`, `parking`, `footway`, `crossingKind`, `turnLanes`, `busLanes`, `tramTrack`, `access` | `points` is the centre line. `width` is the carriageway width in metres. |
| `water` | `ring`, `holes`, `kind`, `name` | Areas tagged as water, riverbanks, basins and reservoirs. |
| `green` | `ring`, `holes`, `kind` | `kind` is `wood`, `park` or `grass`. |
| `trees` | `x`, `y`, `height`, `crown`, `leaf`, `species`, and `genus`, `leafCycle`, `circumference`, `denotation` | A tree row becomes one tree every 7 m along the row. |
| `lamps` | `x`, `y`, `height`, `mount` | Street lamps. |
| `crossings` | `x`, `y`, `kind`, and `island`, `tactile` | `kind` is `zebra`, `signals` or `unmarked`. |

The optional details are read from the tags in the next table. Each one is `undefined` when its tag is missing or cannot be read, and none of them is ever guessed.

| Field | Read from | Value |
| --- | --- | --- |
| `year` | `start_date`, then `year_of_construction` | A year such as 1905. `1905`, `1905-06` and `~1900` give the year, and `C19` gives 1850, the middle of the 19th century. Other text gives its first four-digit year, and text without one, such as `early 20th century`, gives `undefined`. |
| `architecture`, `facadeMaterial`, `use` | `building:architecture`, `building:facade:material`, `building:use` | The tag text, up to 64 characters. |
| `flats` | `building:flats` | The number of flats. |
| `maxspeed` | `maxspeed` | The speed limit in km/h. A value in `mph` is converted, and words such as `walk` or zone codes such as `NL:urban` give `undefined`. |
| `lit` | `lit` | `true` when the road is lit, including values such as `automatic` and `24/7`, and `false` for `no` or `disused`. |
| `cycleway` | `cycleway`, `cycleway:both`, `cycleway:left`, `cycleway:right` | `{left, right}`, where each side is `lane`, `track`, `shared`, `none` or `undefined`. A side tag wins over the tags for both sides. |
| `parking` | `parking:left`, `parking:right` and `parking:both` with their `:orientation`, then the older `parking:lane:left`, `parking:lane:right` and `parking:lane:both` | `{left, right}`, where each side is `parallel`, `diagonal`, `perpendicular`, `no` or `undefined`. Parking that is tagged without an orientation gives `undefined` for that side. |
| `footway` | `footway` | The tag text, such as `sidewalk` or `crossing`. |
| `crossingKind` | `crossing:markings` or `crossing` on a way tagged `footway=crossing` | `zebra`, `signals` or `unmarked`, read as for crossing nodes. |
| `turnLanes` | `turn:lanes` | The tag text, which lists the turns allowed in each lane from left to right, up to 64 characters. |
| `busLanes` | `lanes:bus`, then `busway`, `busway:both`, `busway:left` and `busway:right` | The number of bus lanes. |
| `tramTrack` | `railway=tram` on the road itself, or `embedded_rails=tram` | `true` when tram rails run in the road. |
| `access` | `access` | The tag text, such as `private` or `destination`, up to 16 characters. |
| `genus` | `genus`, then the first word of `species` | A name such as `Tilia`, up to 32 characters. |
| `leafCycle`, `denotation` | `leaf_cycle`, `denotation` | The tag text, such as `deciduous` or `avenue`. |
| `circumference` | `circumference` | The trunk's circumference in metres. |
| `island` | `crossing:island` | `true` when the crossing has a traffic island in the middle. |
| `tactile` | `tactile_paving` | `true` when the crossing has tactile paving, and `false` for `no` or `incorrect`. |

Outer rings run counter-clockwise and holes run clockwise, with the closing point and repeated points removed, and a ring smaller than half a square metre is dropped. A building drawn as a multipolygon relation has its outer ways joined into closed rings, and each hole is attached to the outer ring that contains it. When a building is split into parts tagged `building:part`, the parts replace the outline they lie in, because the parts carry the separate heights and roofs.

### Street furniture, shops and other local detail

The other seven lists hold the smaller things that make a street look like a particular place. An element can appear in several lists. A shop drawn as a building outline is both a building and a place, and a street with tram rails is both a road and a rail line. Reading these lists never changes the seven lists above, except that land-use zones can give a better default kind to a building whose kind was guessed.

| Group | Each feature | Notes |
| --- | --- | --- |
| `amenities` | `x`, `y`, `kind`, `name`, `direction`, `capacity`, `covered` | Street furniture and other objects mapped as single nodes. `kind` is one of `amenityKinds`, such as `bench`, `bollard`, `traffic_signals` or `bus_stop`. `direction` is in degrees clockwise from north. A `bus_stop` or `tram_stop` also has `shelter` and `bench`, which are `true`, `false` or `undefined`. |
| `places` | `x`, `y`, `category`, `kind`, `name`, `cuisine`, `brand`, `outdoorSeating`, `building` | Shops, cafés, offices and other places of interest. `category` is one of `placeCategories`, and `kind` is the tag value, such as `bakery` or `cafe`. A place mapped as an area sits at the middle of its outline. |
| `barriers` | `points`, `kind`, `height`, `closed`, `material` | Lines tagged `barrier`. `kind` is `hedge`, `wall`, `fence`, `retaining_wall`, `guard_rail`, `city_wall`, `railing` or `kerb`. `height` is in metres. When `closed` is `true`, the line ends where it starts and keeps its closing point. |
| `rails` | `points`, `kind`, `bridge`, `tunnel`, `embedded`, `gauge`, `tracks` | Lines tagged `railway`. `kind` is `tram`, `rail`, `light_rail` or `narrow_gauge`. `embedded` is `true` when the rails are set into the street surface. `gauge` is the distance between the rails in metres. Sidings are kept, and yard tracks in tunnels are skipped. |
| `areas` | `ring`, `holes`, `kind`, `surface`, `sport`, `name`, `capacity` | Areas with a use of their own. `kind` is one of `areaKinds`, such as `parking`, `pitch`, `plaza` or `platform`. Underground and multi-storey car parks are left out. |
| `entrances` | `x`, `y`, `kind`, `level`, `wheelchair`, `building` | Nodes tagged `entrance` or `door`. `kind` is the value of `entrance`, such as `main`, `service`, `shop` or `staircase`, and a node tagged only with `door` has the kind `yes`. `wheelchair` is the tag text, such as `yes`, `no` or `limited`. |
| `zones` | `ring`, `holes`, `kind` | Land-use areas. `kind` is `residential`, `commercial`, `retail`, `industrial`, `education`, `religious`, `military` or `railway`. |

The kinds of amenity come from these tags. Most `amenity` values, such as `bench`, `waste_basket`, `toilets` or `charging_station`, give an amenity of the same name. Stops come from `highway=bus_stop`, `railway=tram_stop` and nodes tagged `public_transport=platform`. Traffic control comes from `highway=traffic_signals`, `highway=stop` (the kind `stop_sign`) and `highway=give_way`. Other kinds come from `barrier=bollard`, `emergency=fire_hydrant` (`hydrant`), `power=pole` or `man_made=utility_pole` (`utility_pole`), `man_made` for street cabinets, flagpoles and masts, `tourism=artwork` and `tourism=information`, `historic=memorial`, a statue tagged with `historic`, `memorial` or `artwork_type`, `advertising`, and `leisure=picnic_table`.

Each places category gathers related tags. `shop` holds every `shop` value, and `office` every `office` value. `food` holds restaurants, cafés, bars, pubs, fast food, ice cream parlours and beer gardens. `health` holds pharmacies, doctors, dentists, clinics, hospitals, vets and every `healthcare` value. `education` holds schools, kindergartens, universities, colleges and similar schools, and `culture` holds theatres, cinemas, arts centres, libraries, community centres, museums and galleries. `lodging` holds hotels, hostels, guest houses and similar tourism values. `service` holds banks, post offices, police and fire stations, town halls and other services, together with every `craft` value. `worship` holds places of worship, and `leisure` holds fitness and sports centres, saunas, dance halls, nightclubs and similar places.

A place or an entrance tells you which building it belongs to through `building`, the `id` of an entry in `buildings`. A place drawn as the building outline itself takes that outline's id. A place drawn as a node takes the building whose outline contains it, or else the nearest outline within 2 m. An entrance takes the building whose outline edge is nearest, when that edge lies within 1.5 m. A link found from positions is a guess, so it is named in `inferred`.

The `areas` list shares some areas with `green`. A garden, a flowerbed or a playground appears in both lists, because the special area carries detail such as its surface. Any other area with green tags, such as a pitch also tagged `landuse=grass`, appears only in `green`. Areas and zones mapped as ways are read only when the way is closed, so a platform drawn as a line along the track is not an area. A zone counts as reaching the box when its outline overlaps the box, even if none of its corners lies inside, so a district that surrounds the box is still returned.

### Values that were guessed

OpenStreetMap records some buildings in detail and others as a bare outline tagged `building=yes`. Where a tag is missing, the parser fills the value with a plausible guess so that a scene can still be drawn, and it names that value in the feature's `inferred` list. For example, an outline with no tags gets a kind from its size, a number of levels from its kind, a height from its levels, and a gabled, hipped or flat roof. A road without a `lanes` tag gets the usual number of lanes for its class. The guesses use the OpenStreetMap id as their only source of variation, so the same data always gives the same city. An author can show which parts of a model came from the map and which were made up by reading `inferred`.

A building whose kind is guessed and whose middle lies in a commercial or retail zone becomes `commercial`, and one in an industrial zone becomes `industrial`. In other places the guess from its size stands. Either way, `kind` stays in `inferred`. The zones are read whenever buildings are, so a building's kind does not depend on whether `zones` is in `include`.

The other lists guess only a few values. A barrier without a height gets the usual height for its kind, which is 1.2 m for a hedge, 1.6 m for a wall, 1.4 m for a fence, 1.2 m for a retaining wall, 0.8 m for a guard rail, 5 m for a city wall, 1 m for a railing and 0.15 m for a kerb. A rail line without an `embedded` tag is taken as embedded when it is a tram line and not embedded otherwise. A missing `gauge` gives standard gauge, 1.435 m, and a missing `tracks` gives one track. A platform node with neither `bus=yes` nor `tram=yes` is taken as a bus stop and marks `kind` as guessed. A place mapped as an area marks its `position`, because the middle of an outline is not always where its door is. Each of these guesses is named in the feature's `inferred` list, like the guesses for buildings.

Lengths are read with their units. `parseLength` reads `12`, `12 m`, `40 ft`, `40'` and `5'6"` as metres, and `parseCount` reads a count such as `3` or `3;4`, keeping the largest value. `parseColour` reads colour words such as `red` or `light grey` and hex codes such as `#a0522d`, and returns an HSLA string. `parseDirection` reads a direction such as `45` or a compass word from `N` to `NNW`, and returns degrees clockwise from north. `parseYear` reads a construction year in the forms described above. Any other value is ignored rather than guessed, so a misspelt tag leaves the value marked as inferred or undefined. `buildingKinds`, `roofShapes`, `roadClasses`, `amenityKinds`, `placeCategories` and `areaKinds` list the values the parser produces.

`osmSummary(city)` returns, for each list, `count`, the number of features, and `kinds`, the number of features of each kind. Buildings, water, green areas, crossings, amenities, barriers, rails, areas, entrances and zones are counted by `kind`, roads by `highway`, trees by `leaf`, lamps by `mount` and places by `category`. At most 64 kinds are named in each list, and the remaining features are counted in `other`.

### Limits

The parser bounds both the size of its input and the work it does. The limits are exported as `osmLimits`.

| Limit | Value | When it is reached |
| --- | --- | --- |
| `textLength` | 64 Mi characters | The text is refused with `INVALID_TEXT`. |
| `elements` | 400,000 | The answer is refused with `RESOURCE_LIMIT`. |
| `buildings`, `roads` | 20,000 each | Parsing stops with `RESOURCE_LIMIT`. |
| `areas` | 5,000 water areas and 5,000 green areas | Parsing stops with `RESOURCE_LIMIT`. |
| `points` | 50,000 trees, lamps or crossings in each group | Parsing stops with `RESOURCE_LIMIT`. |
| `amenities`, `entrances` | 50,000 each | Parsing stops with `RESOURCE_LIMIT`. |
| `places`, `barriers` | 20,000 each | Parsing stops with `RESOURCE_LIMIT`. |
| `areaFeatures` | 10,000 entries in the `areas` list | Parsing stops with `RESOURCE_LIMIT`. |
| `rails` | 5,000 | Parsing stops with `RESOURCE_LIMIT`. |
| `zones` | 2,000 | Parsing stops with `RESOURCE_LIMIT`. |
| `ringVertices` | 4,000 positions in one way | That way is skipped. |
| `totalVertices` | 2,000,000 positions in all | Parsing stops with `RESOURCE_LIMIT`. |
| `relationMembers` | 2,000 members in one relation | Parsing stops with `RESOURCE_LIMIT`. |
| `treesPerRow` | 2,000 trees from one tree row | The row stops at that many trees. |
| `containmentChecks` | 20,000,000 vertex visits | Matching holes, building parts, zones and the buildings of places and entrances stops with `RESOURCE_LIMIT`. |
| `summaryKinds` | 64 kinds in each list | `osmSummary` counts further kinds in `other`. |

Malformed text that is not JSON, or JSON without an `elements` list, is refused with `INVALID_OSM`. Inside a valid answer, an element with a missing id, a missing position or tags of the wrong type is skipped, and an element listed twice is read once.

## Read an elevation tile yourself

`readGeoTIFF` from `explainerkit/import/geotiff` reads an elevation tile you already have. It takes the whole file as a `Uint8Array` or `ArrayBuffer` and resolves to `{width, height, values, bounds, noData}`. `loadElevation` uses the same reader for its downloads. To inspect the northwestern pixel of your own tile, substitute its URL in the example.

```js
import {readGeoTIFF} from 'explainerkit/import/geotiff';

const response = await fetch('/data/elevation.tif');
const tile = await readGeoTIFF(await response.arrayBuffer());
const northWest = tile.values[0];
```

`values` is a `Float32Array` with row 0 at the north edge. `bounds` gives the outer pixel edges and pixel size in the file's coordinate system. For a projected tile, use that coordinate system when finding the sample for a longitude and latitude. `bounds` is `null` when the reader cannot place the pixels. `noData` is the file's marker for missing samples, or `null` if the file omits it.

The reader supports the classic TIFF format with a single band of 32-bit floating-point, 16-bit integer or 32-bit integer samples in strips or tiles. It reads uncompressed, TIFF LZW and DEFLATE blocks. For integer samples it supports horizontal differencing, and for floating-point samples it supports the floating-point predictor. A file may be at most 256 MiB, and an image may hold at most 64 Mi samples, or fewer when you pass `maxSamples`.

DEFLATE blocks are decompressed with the platform's `DecompressionStream`, which browsers and Node 18 and later provide. The reader stops each block as soon as it has the bytes that block needs, so a small block that would expand to gigabytes costs no more than a correct one. On a platform without `DecompressionStream`, pass `inflate: async (bytes, maxBytes) => decompressed`. The function receives the most bytes the block needs and should stop there, and any extra bytes it returns are ignored.

## Credit the sources

Every loader returns `sources`, a list with each source's `name`, `licence`, `licenceUrl`, `attribution`, `attributionRequired` and `attributionVerified`. Show the attribution of every source you use beside the map, or in the credits of a film. The street client and `parseOverpass` also return `attribution` directly.

OpenStreetMap data is available under the Open Database License 1.0, and its attribution guidelines require credit to OpenStreetMap. The attribution returned here is "© OpenStreetMap contributors", which the guidelines still accept. On an interactive map the credit usually sits in a corner of the map and must be easy to read, and the licence must stay reachable, for example by making the credit a link to https://www.openstreetmap.org/copyright. Printed maps, PDFs and the credits of a film or video must print that address in full. The [OpenStreetMap copyright page](https://www.openstreetmap.org/copyright) and the [attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) set out the full rules, including when small images need no credit.

Natural Earth data is in the public domain. Its [terms of use](https://www.naturalearthdata.com/about/terms-of-use/) say that crediting the authors is unnecessary and suggest the credit "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.", which is the attribution returned here.

The Copernicus DEM is free for the general public under the Copernicus DEM licence. The licence page at https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model could not be reached when this module was written, so the attribution wording it requires has not been checked against that page. For that reason the returned attribution names the product and points to the licence, and `attributionVerified` is `false`. Read the required wording on the licence page and show it with any map built from these tiles.
