// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Compile a bounded, declarative project recipe. Never evaluates code or fetches assets. */
export function buildProject(input: any): Readonly<{
    document: any;
    scene: Scene;
    parameters: Map<any, any>;
    data: Map<any, any>;
    components: Map<any, any>;
    nodes: Map<any, any>;
    characters: Map<any, any>;
    assets: Map<any, any>;
}>;
export function parseProject(json: any): any;
export function serializeProject(document: any): string;
/** Transactional recipe history. Runtime resources are rebuilt explicitly, outside history. */
export function createProject(input: any, spec?: {}): Readonly<{
    readonly snapshot: any;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    edit(mutator: any): any;
    undo(): boolean;
    redo(): boolean;
    build(): Readonly<{
        document: any;
        scene: Scene;
        parameters: Map<any, any>;
        data: Map<any, any>;
        components: Map<any, any>;
        nodes: Map<any, any>;
        characters: Map<any, any>;
        assets: Map<any, any>;
    }>;
    serialize(): string;
}>;
import { Scene } from '../core/scene.js';
