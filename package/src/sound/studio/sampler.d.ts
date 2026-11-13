// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Instrument made from recordings. Each zone is one recorded note with the
 * pitch and velocity range it covers. The instrument can loop sustained notes,
 * layer several detuned players from neighbouring recordings, add vibrato and
 * darken quiet notes the way an acoustic instrument does.
 */
export function sampledInstrument(zoneInput: any, settings?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
