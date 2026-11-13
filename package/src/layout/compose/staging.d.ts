// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Scene} from '../../core/scene.js';
type Handle=ReturnType<Scene['shape']>;
export interface StageMove {at?:number;duration?:number;direction?:'up'|'down'|'left'|'right'|readonly[number,number];margin?:number;ease?:string;returnAt?:number;}
export interface StageController {
 isolate(keep:Handle|readonly Handle[],options:StageMove&{drop:readonly Handle[]}):StageController;
 explode(parts:readonly Handle[],options?:Omit<StageMove,'direction'>&{direction?:StageMove['direction']|'radial'}):StageController;
 restore(parts:Handle|readonly Handle[],options?:Pick<StageMove,'at'|'duration'|'ease'>):StageController;
 dispose():void;readonly disposed:boolean;
}
export function stage(scene:Scene):StageController;
