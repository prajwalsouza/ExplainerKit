// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Check and freeze one reference: module, kind, evidence, creator, title, an https url and the move it teaches. */
export function defineReference(entry: any): any;
/** Check and freeze one principle: an id, the rule, its source and how strong the evidence is. */
export function definePrinciple(entry: any): any;
/** The references owned by `module`, optionally of one `kind`. */
export function referencesFor(module: any, kind?: null): readonly any[];
/** The design modules that own references and principles. */
export const REFERENCE_MODULES: readonly string[];
export const REFERENCE_KINDS: readonly string[];
export const EVIDENCE: readonly string[];
export function principles(list: any): any;
export function principleRules(list: any): any;
/** Every reference, checked and frozen. */
export const REFERENCES: readonly any[];
export function referenceExamples(list: any): any;
