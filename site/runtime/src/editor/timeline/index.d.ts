// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture the bounded editable representation; tuples remain serializable cubic controls. */
export function prepareTimelineKeys(keys: any): readonly Readonly<{
    at: any;
    value: any;
    ease: any;
}>[];
/** A bounded native-control authoring panel sharing an existing player's clock. No animation is installed on mount. */
export function createTimeline(player: any, container: any, spec?: {}): Readonly<{
    element: any;
    select: (track: any, key: any) => Readonly</*elided*/ any>;
    update: (track: any, key: any, patch: any) => Readonly</*elided*/ any>;
    dispose: () => void;
    readonly disposed: boolean;
    readonly selection: Readonly<{
        track: number;
        key: number;
    }> | null;
    readonly tracks: readonly Readonly<{
        label: any;
        handle: any;
        property: any;
        keys: any;
    }>[];
}>;
