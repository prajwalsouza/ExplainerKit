// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A pure value computed once per sample and shared by every binding that reads it. */
export class Derived {
    constructor(inputs: any, map: any);
    sample(context: any): any;
    #private;
}
export class Scene {
    /** @param {{width?:number,height?:number,renderer?:'svg'|'canvas',label?:string,description?:string,maxNodes?:number,duration?:number}} spec */
    constructor(spec?: {
        width?: number;
        height?: number;
        renderer?: "svg" | "canvas";
        label?: string;
        description?: string;
        maxNodes?: number;
        duration?: number;
    });
    width: any;
    height: any;
    renderer: "svg" | "canvas";
    label: any;
    description: any;
    maxNodes: any;
    /** @param {string} name @param {ReturnType<typeof import('../import/font.js').parseFont>} face */
    registerFont(name: string, face: ReturnType<typeof import("../import/font.js").parseFont>): this;
    get duration(): number;
    get nodeCount(): number;
    get controls(): any[];
    get activeCamera(): null;
    get hasAmbient(): boolean;
    /** @param {{rate?:number,offset?:number}} [spec] */
    ambient(spec?: {
        rate?: number;
        offset?: number;
    }): Ambient;
    space(spec?: {}): Readonly<{
        readonly camera: any;
        setCamera(next: any): void;
        points(vertices: any, localSpec11?: {}): Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        polyline(vertices: any, localSpec12?: {}): Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        instance(field: any, shape: any, instanceSpec?: {}): Readonly<{
            handle: any;
            count: any;
            nodeCount: any;
            sample(time?: number): readonly Readonly<{
                indices: any;
                depths: any;
            }>[];
        }>;
        mesh: (geometry: any, localSpec6?: {}) => Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        sphereLines(shape?: {}, localSpec13?: {}): Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        box(shape?: {}, localSpec14?: {}): Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        surface: (localSpec8?: {}) => Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        mapLines: (lines: any, localSpec9?: {}) => Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        cloud: (points: any, localSpec10?: {}) => Readonly<{
            id: any;
            node: any;
        }>;
        extrude(points: any, depth: any, localSpec15?: {}): Readonly<{
            id: any;
            node: any;
            parameters: any;
            sample: (time?: number) => {
                geometry: Readonly<{
                    vertices: any;
                    edges: any;
                }>;
                transform: {};
                matrix: any;
            };
            layers: (time: any) => {
                back: any;
                depth: number;
                commands: any;
                stroke: any;
                strokeWidth: any;
                strokeLinecap: any;
                opacity: any;
            }[];
            set(patch: any): /*elided*/ any;
            to(at: any, patch: any, localSpec4?: {}): /*elided*/ any;
            bind(key: any, binding: any): /*elided*/ any;
            unbind(key: any): /*elided*/ any;
            clearAnimation(key: any): /*elided*/ any;
        }>;
        geometry(time?: number): Readonly<{
            vertices: any;
            edges: any;
        }>;
        readonly objects: readonly any[];
    }>;
    light(spec?: {}): this;
    focus(spec?: {}): this;
    /** @param {{samples?:number,shutter?:number|Parameter|Derived,fps?:number,auto?:boolean|{threshold?:number},threshold?:number}} [spec] */
    motionBlur(spec?: {
        samples?: number;
        shutter?: number | Parameter | Derived;
        fps?: number;
        auto?: boolean | {
            threshold?: number;
        };
        threshold?: number;
    }): this;
    layer(spec?: {}): any;
    /** Scene-wide color grade. Numeric controls take numbers or this scene's inputs; tint/shadows/highlights are colors. */
    grade(spec?: {}): this;
    _resolveGrade(controls: any, context: any): {
        [k: string]: any;
    };
    /** @param {string} name @param {{x:number,y:number,width:number,height:number}} spec @param {{content?:NodeHandle,visible?:'inside'|'approach'}} [scope] */
    region(name: string, spec: {
        x: number;
        y: number;
        width: number;
        height: number;
    }, scope?: {
        content?: NodeHandle;
        visible?: "inside" | "approach";
    }): this;
    _scopeRegionContent(frame: any, matrix: number[] | undefined, screenRoots: any): any;
    _region(name: any): any;
    /** One camera per scene. Its pose uses the same binding/track contracts as artwork. */
    camera(spec?: {}): null;
    _isRootHandle(handle: any): boolean;
    _assertLiftRoot(handle: any): any;
    _liftRoot(handle: any): any;
    _child(parent: any, type: any, props?: {}): NodeHandle;
    _recordDepth(record: any): number;
    _childDefinition(parent: any, definition: any): NodeHandle;
    _adopt(parent: any, handle: any): void;
    _interaction(id: any): any;
    /** Interaction records for a node ID: {explain, tap, drag}. Players use this for picking. */
    interaction(id: any): any;
    /** Define a tag, optionally under a parent tag. The tree is acyclic; defining an existing tag again must agree. */
    defineTag(name: any, { parent }?: {
        parent?: null | undefined;
    }): this;
    _tagNode(id: any, name: any): void;
    /** A tag and its ancestors, nearest first. */
    tagPath(name: any): any[];
    /** Every tag a node carries, including ancestors of its tags. */
    tagsOf(id: any): any[];
    /** IDs of nodes carrying a tag or any tag beneath it. */
    tagged(name: any): any[];
    /**
     * How this scene may adapt to other screens. `together` lists tags whose members must stay one block,
     * never split or wrapped. Readability is in CSS pixels. Read by players through `adaptivePolicy`.
     */
    adaptive(spec: any): this;
    get adaptivePolicy(): Readonly<{
        together: readonly never[];
        minText: 12;
        targetText: 16;
    }>;
    /** Run after reset(), to return scene-owned data to its authored state. */
    onReset(fn: any): this;
    _ownsParameter(p: any): boolean;
    _ownsInput(p: any): boolean;
    _extend(end: any): void;
    _changed(): void;
    _batch(callback: any): any;
    onChange(fn: any): () => boolean;
    _context(): Readonly<{
        time: 0;
        width: any;
        height: any;
    }>;
    _capacity(extra: any): void;
    _instantiate(b: any): {
        id: string;
        type: any;
        props: any;
        sourceProps: any;
        children: Map<any, any>;
        bindings: Map<any, any>;
        tracks: Map<any, any>;
        overrides: Set<any>;
        collectionOwned: Set<any>;
    };
    _remove(r: any): void;
    shape(type: any, props?: {}): NodeHandle;
    _isAdoptableRoot(handle: any): boolean;
    _containsRecord(record: any): boolean;
    /** @param {Record<string,any>} props @param {any[]} children */
    group(props?: Record<string, any>, children?: any[]): any;
    /** Internal composition transaction: group contiguous roots without changing paint order. */
    _groupContiguous(children: any, props?: {}): any;
    /** @param {{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean,[key:string]:any}} p */
    /** @param {Record<string,any>&{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean}} [p] */
    ellipse(p?: Record<string, any> & {
        rx?: number;
        ry?: number;
        startAngle?: number;
        endAngle?: number;
        closed?: boolean;
    }): NodeHandle;
    circle(p?: {}): NodeHandle;
    rect(p?: {}): NodeHandle;
    line(p?: {}): NodeHandle;
    path(p?: {}): NodeHandle;
    text(p?: {}): NodeHandle;
    cloud(p?: {}): NodeHandle;
    component(definition: any): Component;
    instance(component: any): NodeHandle;
    data(rows: any, spec: any): DataSource;
    repeat(component: any, { data }: {
        data: any;
    }): Collection;
    parameter(value: any, spec?: {}): Parameter;
    derive(inputs: any, map: any): Derived;
    control(parameter: any, spec: any): this;
    _checkpoint(): any[];
    _restore(states: any): void;
    reset(): this;
    _sampleContext({ time, width, height, effects, ambient, displayWidth, }?: {
        time?: number | undefined;
        width?: any;
        height?: any;
        effects?: boolean | undefined;
        ambient?: number | undefined;
        displayWidth?: any;
    }): Readonly<{
        effects?: false | undefined;
        ambient?: number | undefined;
        displayWidth?: any;
        time: any;
        width: any;
        height: any;
    }>;
    profile(spec?: {}): Readonly<{
        frame: any;
        totalMS: number;
        nodes: readonly Readonly<unknown>[];
    }>;
    _sampleWorld(context: any, effects?: boolean): any;
    sampleWorld(spec?: {}): any;
    sampleView(spec?: {}): {
        frame: any;
        view: any;
    };
    _sampleViewAt(context: any): {
        frame: any;
        view: any;
    };
    sample(spec?: {}): any;
    _evaluateOwn(record: any, context: any): {
        children: any[];
        clipTarget?: any;
        id: any;
        type: any;
        props: any;
    };
    _pathTo(record: any): any;
    /**
     * Where a node is at a time, in scene (world) space before the camera: its origin, the frame-space box of
     * it and its descendants, its transform and its effective opacity. Safe inside another node's binding,
     * as long as the located node does not itself depend on that binding.
     */
    locate(handle: any, spec?: {}): any;
    mount(container: any, localOptions1?: {}): Promise<{
        readonly time: number;
        readonly duration: any;
        readonly disposed: boolean;
        readonly reducedMotion: any;
        speed: number;
        readonly ambientTime: number;
        readonly ambientPaused: boolean;
        setAmbientPaused(paused: boolean): /*elided*/ any;
        readonly cost: any;
        seekAmbient(seconds: any): /*elided*/ any;
        profile(): any;
        _acquireAmbient(): () => void;
        layer(child: import("./scene.js").Scene, layerOptions: Parameters<typeof import("../player/layers.js").attachSceneLayer>[2]): Readonly<{
            readonly disposed: boolean;
            refresh: () => void;
            dispose: () => void;
        }>;
        nativeLayer(handle: any, keyframes: any, nativeOptions?: {}): Readonly<{
            effect: Readonly<{
                play(): /*elided*/ any;
                pause(): /*elided*/ any;
                seek(next: any): /*elided*/ any;
                finish(): /*elided*/ any;
                dispose: () => void;
                readonly disposed: boolean;
                readonly time: any;
                readonly duration: any;
                readonly end: any;
                readonly reducedMotion: any;
                readonly error: any;
                readonly playState: any;
            }>;
            readonly disposed: boolean;
            dispose: () => void;
        }>;
        syncTime(time: any, syncOptions: any): /*elided*/ any;
        readonly playing: boolean;
        readonly driver: any;
        readonly frame: any;
        readonly view: any;
        element: any;
        on: (name: any, fn: any) => () => any;
        setDriver(next: any): /*elided*/ any;
        seek(seconds: any, seekOptions?: {}): /*elided*/ any;
        play(): /*elided*/ any;
        pause(): /*elided*/ any;
        refresh(): any;
        reportError: (error: any) => void;
        dispose: () => void;
    }>;
    #private;
}
import { Ambient } from './ambient.js';
import { Parameter } from './data.js';
declare class NodeHandle {
    constructor(scene: any, record: any);
    _scene: any;
    _record: any;
    get id(): any;
    _live(): void;
    part(name: any): NodeHandle;
    add(handle: any): this;
    group(p?: {}): any;
    /** @param {{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean,[key:string]:any}} p */
    /** @param {Record<string,any>&{rx?:number,ry?:number,startAngle?:number,endAngle?:number,closed?:boolean}} [p] */
    ellipse(p?: Record<string, any> & {
        rx?: number;
        ry?: number;
        startAngle?: number;
        endAngle?: number;
        closed?: boolean;
    }): any;
    circle(p?: {}): any;
    rect(p?: {}): any;
    path(p?: {}): any;
    line(p?: {}): any;
    text(p?: {}): any;
    cloud(p?: {}): any;
    instance(component: any): any;
    set(input: any): this;
    reset(property: any): this;
    /** @param {string|string[]} property @param {{inputs?: any[], map: (...values: any[]) => any,active?:[number,number],lazy?:boolean}} binding */
    bind(property: string | string[], { inputs, map, active, lazy }?: {
        inputs?: any[];
        map: (...values: any[]) => any;
        active?: [number, number];
        lazy?: boolean;
    }): this;
    unbind(property: any): this;
    animate(property: any, spec: any): this;
    keys(property: any, keys: any): this;
    replaceKeys(property: any, keys: any): this;
    _keys(property: any, keys: any, replace: any): this;
    clearAnimation(property: any): this;
    /** Move to new values at a time, starting from wherever the previous move left off. */
    to(at: any, patch: any, spec?: {}): this;
    /** Fade in (and by default lift into place) at a time. Composes with any driver of opacity or position. */
    enter(at: any, spec: any): this;
    /** Leave the stage at a time. */
    exit(at: any, spec: any): this;
    /** Step back from focus: [[time, level], ...] with level 1 fully present and 0 gone. */
    dim(keys: any): this;
    _presence(): any;
    /** Tag this node. Tags organize and select (a tag tree, as in Rhypple); they never change how a node behaves. */
    tag(...names: any[]): this;
    /** A hover tip and a pinned explanation, read by players. Clicking it pauses playback. */
    explain(title: any, body?: string): this;
    /** Called with stage coordinates when this node (or a part of it) is tapped. Trusted author code. */
    onTap(fn: any): this;
    /** Called with stage coordinates while this node is dragged, then once with null on release. */
    onDrag(fn: any): this;
}
declare class Component {
    constructor(scene: any, definition: any);
    scene: any;
    definition: any;
    instances: Set<any>;
    set(part: any, patch: any): this;
}
import { DataSource } from './data.js';
declare class Collection {
    constructor(scene: any, component: any, data: any);
    scene: any;
    component: any;
    data: any;
    records: Map<any, any>;
    bindings: any[];
    layoutSpec: Readonly<{
        type: any;
        columns: any;
        gap: any;
        cellWidth: any;
        cellHeight: any;
        x: any;
        y: any;
        padding: any;
        responsive: any;
    }> | null;
    unsubscribe: any;
    prepare(rows: any): {
        (): void;
        scene: any;
        delta: number;
    };
    boundValue(b: any, row: any): any;
    bind(path: any, spec: any): this;
    unbind(path: any): this;
    instance(key: any): NodeHandle;
    layout(spec: any): this;
    sample(context: any, sampleInfo?: null): any[];
}
export {};
