// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Build a city model from the result of `parseOverpass`.
 *
 * Options: `seed` (whole number), `palette` (one of `cityPalettes`), `detail` ('full' or
 * 'massing', which leaves out trim and street objects), `season` (one of `seasons`),
 * `cell` (street field cell in metres), `margin` (metres of ground kept round the features)
 * and `infer`, which switches the made-up street objects: {lamps, trees, cars, bikes,
 * furniture, boats, plants}, each true or false. Objects read from the map are always placed.
 * `interpretation` ('raw', 'basic' or 'high') sets all of those at once: 'raw' draws only what
 * the map states, 'basic' (the default) adds simple guesses, and 'high' adds more plants and people.
 */
export function buildCity(osm: any, spec?: {}): Readonly<{
    meshes: Readonly<{
        underpasses?: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        } | undefined;
        bridges?: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        } | undefined;
        waterBank?: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        } | undefined;
        water?: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        } | undefined;
        walls: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        };
        roofs: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        };
        trim: {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        };
    }>;
    field: Readonly<{
        width: number;
        height: number;
        cell: any;
        x0: any;
        y0: any;
        edge: Float32Array<ArrayBuffer>;
        centre: Float32Array<ArrayBuffer>;
        along: Float32Array<ArrayBuffer>;
        half: Float32Array<ArrayBuffer>;
        lanes: Float32Array<ArrayBuffer>;
        junction: Float32Array<ArrayBuffer>;
        zebra: Float32Array<ArrayBuffer>;
        foot: Float32Array<ArrayBuffer>;
        footKind: Float32Array<ArrayBuffer>;
        water: Float32Array<ArrayBuffer>;
        green: Float32Array<ArrayBuffer>;
        greenKind: Float32Array<ArrayBuffer>;
        wall: Float32Array<ArrayBuffer>;
        bridge: Float32Array<ArrayBuffer>;
        lamp: Float32Array<ArrayBuffer>;
        roof: Float32Array<ArrayBuffer>;
    }>;
    props: readonly Readonly<{
        name: any;
        mesh: any;
        far: any;
        range: any;
        count: number;
        transforms: Float32Array<any>;
    }>[];
    fine: readonly Readonly<{
        x: number;
        z: number;
        radius: number;
        mesh: any;
    }>[];
    cover: readonly Readonly<{
        name: any;
        x: number;
        z: number;
        radius: number;
        count: number;
        transforms: Float32Array<any>;
    }>[];
    coverMeshes: any;
    traffic: Readonly<{
        plan: Readonly<{
            edges: readonly any[];
            nodes: readonly any[];
            vehicles: readonly any[];
            units: readonly any[];
            headway: any;
            cycle: any;
            seed: any;
            stats: Readonly<{
                lanes: number;
                tracks: number;
                cyclePaths: number;
                bikes: number;
                cars: number;
                buses: number;
                trams: number;
                signals: number;
            }>;
        }>;
        meshes: Readonly<{}>;
        wheels: Readonly<{}>;
        count: number;
    }> | null;
    people: Readonly<{
        variants: readonly {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        }[];
        far: readonly {
            positions: Float32Array<ArrayBuffer>;
            normals: Float32Array<ArrayBuffer>;
            colors: Float32Array<ArrayBuffer>;
            extra: Float32Array<ArrayBuffer>;
            extraStride: number;
            indices: Uint32Array<ArrayBuffer>;
            vertexCount: number;
            triangleCount: number;
        }[];
        rigs: readonly Readonly<{
            ankle: 0.085;
            knee: number;
            hip: number;
            waist: number;
            shoulder: number;
            elbow: number;
            wrist: number;
            neck: number;
            neckTop: number;
            height: number;
            torso: number;
            legOffset: number;
        }>[];
        looks: readonly Readonly<{
            age: any;
            height: any;
            build: any;
            shoulders: any;
            hips: any;
            legs: any;
            head: any;
            top: any;
            sleeves: any;
            tucked: boolean;
            collar: boolean;
            bottom: any;
            length: any;
            shoes: any;
            hair: any;
            hat: any;
            scarf: boolean;
            hood: any;
            umbrella: boolean;
            bag: any;
            gloves: boolean;
            colors: Readonly<{}>;
        }>[];
        routes: readonly any[];
        walkers: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        motion: Float32Array<ArrayBuffer>;
        activity: Float32Array<ArrayBuffer>;
        groups: number;
        clothing: string;
        count: number;
    }>;
    style: any;
    lights: readonly Readonly<{
        x: any;
        y: number;
        z: number;
        kind: string;
        mapped: boolean;
    }>[];
    trees: readonly Readonly<{
        x: any;
        y: any;
        height: any;
    }>[];
    styles: readonly (Readonly<{
        id: any;
        kind: "shelter";
        recent: false;
        inferred: readonly never[];
    }> | Readonly<{
        id: any;
        kind: any;
        recent: boolean;
        material: string;
        window: string;
        ground: string;
        wall: string;
        roof: string;
        roofMaterial: string;
        inferred: readonly any[];
    }>)[];
    junctions: readonly {
        x: any;
        y: any;
        arms: any;
        width: any;
    }[];
    bounds: Readonly<{
        x0: number;
        z0: number;
        x1: any;
        z1: number;
        top: any;
    }>;
    waterLevel: -1.3;
    palette: any;
    season: any;
    seed: number;
    interpretation: any;
    stats: Readonly<{
        buildings: any;
        triangles: number;
        props: number;
        lamps: number;
        plants: number;
        people: number;
        inferred: Readonly<{}>;
    }>;
    attribution: any;
    underpass?: {
        profiles: {
            roadId: any;
            explicit: boolean;
            quad: any[];
            clearance: any;
        }[];
        mask: {
            x0: number;
            z0: number;
            cell: number;
            width: number;
            height: number;
            values: Float32Array<ArrayBuffer>;
        };
    } | undefined;
    bridgeField?: {
        width: number;
        height: number;
        cell: any;
        x0: any;
        y0: any;
        edge: Float32Array<ArrayBuffer>;
        centre: Float32Array<ArrayBuffer>;
        along: Float32Array<ArrayBuffer>;
        half: Float32Array<ArrayBuffer>;
        lanes: Float32Array<ArrayBuffer>;
        junction: Float32Array<ArrayBuffer>;
        zebra: Float32Array<ArrayBuffer>;
        foot: Float32Array<ArrayBuffer>;
        footKind: Float32Array<ArrayBuffer>;
        water: Float32Array<ArrayBuffer>;
        green: Float32Array<ArrayBuffer>;
        greenKind: Float32Array<ArrayBuffer>;
        wall: Float32Array<ArrayBuffer>;
        bridge: Float32Array<ArrayBuffer>;
        lamp: Float32Array<ArrayBuffer>;
        roof: Float32Array<ArrayBuffer>;
    } | undefined;
    bridgeProfiles?: import("./water-bridges.js").WaterBridgeProfile[] | undefined;
    terrain?: Readonly<{
        source?: Readonly<{
            name: any;
            url: any;
            attribution: any;
        }> | undefined;
        columns: any;
        rows: any;
        bounds: Readonly<{
            x0: any;
            y0: any;
            x1: any;
            y1: any;
        }>;
        values: Float32Array<ArrayBuffer>;
        min: number;
        max: number;
    }> | undefined;
}>;
/**
 * Where walker `index` of a city model stands at `time` seconds: {x, y, z, turn, phase, step,
 * speed}, with `turn` the heading in radians, `phase` the point in the stride, `step` the
 * length of a step in the figure's own metres and `speed` the pace in metres a second. Walkers go to the end of
 * their route, turn round and come back, so the answer is a pure function of time and a shot
 * can be scrubbed or re-rendered frame by frame.
 */
export function walkerPose(city: any, index: any, time: any): {
    x: any;
    y: any;
    z: number;
    turn: any;
    phase: any;
    step: number;
    speed: number;
    activity: string;
    arms: number[];
    head: number[];
} | {
    x: number;
    y: any;
    z: number;
    turn: number;
    phase: any;
    step: number;
    speed: number;
    activity: string;
    arms: readonly number[];
    head: number[];
};
/**
 * Where drawable unit `index` of a city's traffic is at `time` seconds: {x, y, z, turn,
 * travelled, speed, visible}. A car or a bus is one unit and a tram is three, one per section.
 * `travelled` is the distance driven so far, for turning wheels, and `visible` is false while
 * the vehicle is outside the model. The answer is a pure function of time.
 */
export function vehiclePose(city: any, index: any, time: any): {
    x: number;
    y: any;
    z: number;
    turn: number;
    travelled: number;
    speed: number;
    visible: boolean;
};
/**
 * Look for broken things in a city model: geometry that is not a number, objects inside
 * buildings, in the water or in the carriageway, walkers in walls or in the road, vehicles off
 * the road or inside one another, anything beyond the edge of the model. Moving things are
 * sampled at `times` (seconds). Returns {ok, issues, checked}; see auditCityModel in audit.js.
 */
export function auditCity(city: any, spec?: {}): Readonly<{
    ok: boolean;
    issues: readonly any[];
    checked: Readonly<{
        meshes: number;
        objects: number;
        walkerSamples: number;
        vehicleSamples: number;
    }>;
}>;
/** How walkers may be dressed without describing them: the plain default figure, or clothes chosen for the situation. */
export const peopleClothing: readonly string[];
export { planFlyby } from "./flyby.js";
/** How much `buildCity` may add beyond what the map states. */
export const interpretationLevels: readonly string[];
export const cityLimits: Readonly<{
    side: 3000;
    buildings: 20000;
    props: 60000;
    cover: 400000;
    people: 2000;
    cell: number[];
}>;
export function propRange(name: any): any;
export const WATER_LEVEL: -1.3;
import { buildingStyle } from './buildings.js';
import { bayLayout } from './buildings.js';
import { cityPalettes } from './buildings.js';
import { wallMaterials } from './buildings.js';
import { windowStyles } from './buildings.js';
import { groundStyles } from './buildings.js';
import { roofMaterials } from './buildings.js';
import { lampAsset } from './assets.js';
import { lampStyles } from './assets.js';
import { treeAsset } from './assets.js';
import { treeForms } from './assets.js';
import { seasons } from './assets.js';
import { carAsset } from './assets.js';
import { carBodies } from './assets.js';
import { bikeAsset } from './assets.js';
import { boatAsset } from './assets.js';
import { furnitureAsset } from './assets.js';
import { furnitureKinds } from './assets.js';
import { shrubAsset } from './assets.js';
import { surfaceKinds } from './assets.js';
import { footKinds } from './streets.js';
import { greenKinds } from './streets.js';
import { CITY_STYLES } from './styles.js';
import { cityStyles } from './styles.js';
import { regionStyle } from './styles.js';
import { coverAsset } from './assets.js';
import { coverKinds } from './assets.js';
import { personAsset } from './assets.js';
import { personLook } from './people.js';
import { personWardrobe } from './people.js';
import { personColors } from './people.js';
import { personMotion } from './people.js';
import { personClimate } from './people.js';
import { personRig } from './people.js';
import { personPose } from './people.js';
import { posePerson } from './people.js';
import { personJoints } from './people.js';
import { personTops } from './people.js';
import { personBottoms } from './people.js';
import { personHair } from './people.js';
import { personHats } from './people.js';
import { personHoods } from './people.js';
import { personBags } from './people.js';
import { personShoes } from './people.js';
import { personAges } from './people.js';
import { personBudget } from './people.js';
import { personRanges } from './people.js';
import { personGait } from './people.js';
import { PERSON_PAINT } from './people.js';
import { planTraffic } from './traffic.js';
import { trafficState } from './traffic.js';
import { parkingPlan } from './traffic.js';
import { trafficLimits } from './traffic.js';
import { DEFAULT_SPEEDS } from './traffic.js';
import { CAR_PAINT } from './assets.js';
export { buildingStyle, bayLayout, cityPalettes, wallMaterials, windowStyles, groundStyles, roofMaterials, lampAsset, lampStyles, treeAsset, treeForms, seasons, carAsset, carBodies, bikeAsset, boatAsset, furnitureAsset, furnitureKinds, shrubAsset, surfaceKinds, footKinds, greenKinds, CITY_STYLES, cityStyles, regionStyle, coverAsset, coverKinds, personAsset, personLook, personWardrobe, personColors, personMotion, personClimate, personRig, personPose, posePerson, personJoints, personTops, personBottoms, personHair, personHats, personHoods, personBags, personShoes, personAges, personBudget, personRanges, personGait, PERSON_PAINT, planTraffic, trafficState, parkingPlan, trafficLimits, DEFAULT_SPEEDS, CAR_PAINT };
export { PERSON_GAITS, personGaits, personGaitStyle } from "./people.js";
export { PERSON_ACTIVITIES, personActivities, standingGesture } from "./activities.js";
export { vehicleAsset, vehicleKinds, VEHICLE_SHAPES, vehicleShape, vehicleFamilies, vehicleEras, vehicleLook, VEHICLE_VARIANTS } from "./vehicles.js";
export { WEATHER, weatherNames, resolveWeather, mixWeather, weatherSchedule } from "./weather.js";
