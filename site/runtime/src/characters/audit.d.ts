// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Rig audit: play every action of a character and measure whether the rig holds together. Heuristics, each
 * with a tolerance relative to the character's height:
 *
 *  connected   every visible, non-detachable part touches the rest of the body (one connected piece)
 *  joints      declared joints (a limb's start or end) sit inside or on their target parts
 *  limbs       drawn limb length stays within a stretch range of its declared length
 *  ground      grounded characters never sink below the ground and keep a contact on it when not airborne
 *  sliding     a contact part resting on the ground does not slide
 *  pops        no part jumps further in one frame than a fast natural motion would
 *  flips       a bent joint does not suddenly reverse its bend direction
 *  depth       declared attachments sink into their parent by a margin, so seams hide (not merely touch)
 *  slivers     filled outlines have no needle-sharp spikes (parts may declare sharp: true)
 *  folds       filled outlines never cross themselves (a smoothing curve that overshot)
 *  rewind      sampling backward gives exactly the same frames as forward
 *
 * Definitions opt in with metadata: joints, contacts, detachable parts, limb lengths. See
 * docs/modules/character-construction.md.
 */
/** @param {any} definition @param {{actions?:string[],fps?:number,tolerance?:number,duration?:number,background?:string}} [spec] */
export function auditCharacter(definition: any, spec?: {
    actions?: string[];
    fps?: number;
    tolerance?: number;
    duration?: number;
    background?: string;
}): Readonly<{
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
}>;
/** A readable table of an audit, one line per check. */
export function formatAudit(report: any): string;
