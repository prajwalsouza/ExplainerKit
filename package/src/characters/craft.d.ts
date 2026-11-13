// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Clone a raw definition with costume edits; compile transactionally before returning.
 * @param {any} definition
 * @param {{name?:string,palette?:Record<string,string|{base:string,shade:string,light:string}>,add?:any[],remove?:string[]}} [spec]
 */
export function restyle(definition: any, spec?: {
    name?: string;
    palette?: Record<string, string | {
        base: string;
        shade: string;
        light: string;
    }>;
    add?: any[];
    remove?: string[];
}): any;
/** Original scene per character/action for renderers or contact-sheet tooling; no DOM ownership.
 * @param {any[]} definitions
 * @param {{actions?:string[],at?:number,width?:number,height?:number,audit?:boolean,fps?:number}} [spec]
 */
export function contactSheet(definitions: any[], spec?: {
    actions?: string[];
    at?: number;
    width?: number;
    height?: number;
    audit?: boolean;
    fps?: number;
}): Readonly<{
    width: any;
    height: any;
    cells: readonly Readonly<{
        name: any;
        action: string;
        scene: Scene;
        actor: any;
        time: any;
        frame: any;
        badge: Readonly<{
            name: any;
            ok: boolean;
            height: any;
            tolerance: number;
            checks: {
                [k: string]: {
                    status: string;
                    worst: number;
                    unit: string;
                    examples: never[];
                };
            };
            contrast: Readonly<{
                status: "notApplicable";
            }> | Readonly<{
                status: "unverified";
                reason: "Supply an opaque solid background to assess head-fill contrast.";
            }> | Readonly<{
                status: "unverified";
                reason: "Background is translucent.";
            }> | Readonly<{
                status: "verified";
                inkRatio: number;
                backgroundRatio: number;
            }>;
            warnings: readonly any[] | readonly Readonly<{
                code: "HEAD_FILL_CONTRAST";
                message: "Outlined head fill forms a contrasting disc against both ink and background.";
                inkRatio: number;
                backgroundRatio: number;
            }>[];
        }> | null;
    }>[];
}>;
import { Scene } from '../core/scene.js';
