// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** One or several explicit contour correspondences, sharing the established three phases.
 * @param {{from:{frame:any,shape?:string|{id:string},matrix?:number[]},to:{frame:any,shape?:string|{id:string},matrix?:number[]},pairs?:Array<[string,string]>,anchor?:{x:number,y:number},scale?:number,samples?:number,tolerance?:number,align?:'auto'|'none',reverse?:boolean|'auto',fill?:string,background?:'crossfade'|'hide',alignAt?:number,releaseAt?:number}} [spec]
 */
export function matchCut(spec?: {
    from: {
        frame: any;
        shape?: string | {
            id: string;
        };
        matrix?: number[];
    };
    to: {
        frame: any;
        shape?: string | {
            id: string;
        };
        matrix?: number[];
    };
    pairs?: Array<[string, string]>;
    anchor?: {
        x: number;
        y: number;
    };
    scale?: number;
    samples?: number;
    tolerance?: number;
    align?: "auto" | "none";
    reverse?: boolean | "auto";
    fill?: string;
    background?: "crossfade" | "hide";
    alignAt?: number;
    releaseAt?: number;
}): Readonly<{
    diagnostics: Readonly<{
        method: "screenContourMatch";
        anchor: any;
        scale: any;
        normalization: "controlBoundsCenter";
        alignAt: any;
        releaseAt: any;
        exactSceneEndpoints: true;
    }>;
    sample(progress: any): Readonly<{
        motionBlur?: Readonly<{
            frames: any;
            weights: any;
        }> | undefined;
        light?: Readonly<{
            angle: any;
            color: any;
            ambient: any;
        }> | undefined;
        width: any;
        height: any;
        children: any;
    }> | Readonly<{
        children: readonly (Readonly<{
            id: "match:background-from";
            type: "group";
            props: Readonly<{
                opacity: number;
            }>;
            children: any;
        }> | Readonly<{
            id: "match:background-to";
            type: "group";
            props: Readonly<{
                opacity: number;
            }>;
            children: any;
        }> | Readonly<{
            id: "match:contour";
            type: "path";
            props: Readonly<{
                commands: any;
                fill: any;
                fillRule: any;
                stroke: any;
                strokeWidth: number;
                strokeLinecap: any;
                strokeLinejoin: any;
                strokeMiterlimit: any;
                fillOpacity: any;
                strokeOpacity: any;
                opacity: any;
            }>;
            children: readonly never[];
        }>)[];
        light?: any;
        width: any;
        height: any;
    }>;
}> | Readonly<{
    diagnostics: Readonly<{
        method: "multiScreenContourMatch";
        pairs: any;
        alignAt: any;
        releaseAt: any;
        exactSceneEndpoints: true;
    }>;
    sample: (progress: any) => Readonly<{
        motionBlur?: Readonly<{
            frames: any;
            weights: any;
        }> | undefined;
        light?: Readonly<{
            angle: any;
            color: any;
            ambient: any;
        }> | undefined;
        width: any;
        height: any;
        children: any;
    }> | Readonly<{
        children: readonly Readonly<{
            id: `match:multi:background:${number}`;
            type: "group";
            props: Readonly<{
                opacity: number;
            }>;
            children: any;
        }>[];
        light?: any;
        width: any;
        height: any;
    }>;
}>;
