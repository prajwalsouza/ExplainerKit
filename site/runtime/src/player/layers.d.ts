// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** One parent clock owns an explicitly supplied child renderer and its time window.
 * @param {any} player
 * @param {import('../core/scene.js').Scene} scene
 * @param {{renderer:{element:any,render:(frame:any)=>unknown,dispose:()=>unknown},from?:number,until?:number,offset?:number,fade?:number,ownRenderer?:boolean,z?:number,enter?:{kind?:'fade'|'opening'|'wipe'|'flyThrough',duration?:number,direction?:'left'|'right'|'up'|'down',shape?:any,through?:any},exit?:{kind?:'fade'|'opening'|'wipe'|'flyThrough',duration?:number,direction?:'left'|'right'|'up'|'down',shape?:any,through?:any}}} spec
 */
export function attachSceneLayer(player: any, scene: import("../core/scene.js").Scene, spec?: {
    renderer: {
        element: any;
        render: (frame: any) => unknown;
        dispose: () => unknown;
    };
    from?: number;
    until?: number;
    offset?: number;
    fade?: number;
    ownRenderer?: boolean;
    z?: number;
    enter?: {
        kind?: "fade" | "opening" | "wipe" | "flyThrough";
        duration?: number;
        direction?: "left" | "right" | "up" | "down";
        shape?: any;
        through?: any;
    };
    exit?: {
        kind?: "fade" | "opening" | "wipe" | "flyThrough";
        duration?: number;
        direction?: "left" | "right" | "up" | "down";
        shape?: any;
        through?: any;
    };
}): Readonly<{
    readonly disposed: boolean;
    refresh: () => void;
    dispose: () => void;
}>;
