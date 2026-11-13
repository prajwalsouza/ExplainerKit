// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export class DataSource {
    constructor(rows: any, { key, maxRows }: {
        key: any;
        maxRows?: number | undefined;
    }, notify?: () => void);
    get rows(): any;
    get key(): any;
    replace(rows: any): this;
    subscribe(prepare: any): () => boolean;
    #private;
}
export class Parameter {
    constructor(value: any, { min, max }?: {
        min?: number | undefined;
        max?: number | undefined;
    }, notify?: () => void, extend?: () => void);
    get value(): any;
    get min(): number;
    get max(): number;
    /** True while a reader override is layered over the keys and any set() value. */
    get overridden(): boolean;
    checkpoint(): Readonly<{
        value: any;
        overridden: boolean;
        override: null;
    }>;
    restore(state: any): void;
    sample(time: any): any;
    set(value: any): this;
    /** Restores authored keys and value. A reader override survives; only release() removes it. */
    reset(): this;
    /** Layer a reader value over the keys at every time until release(); set() and keys are kept underneath. */
    override(value: any): this;
    release(): this;
    /** Move to a value at a time, starting from wherever the previous move left off. */
    to(at: any, value: any, spec?: {}): this;
    _prepareTo(at: any, value: any, spec?: {}): Readonly<{
        property: any;
        from: any;
        to: any;
        at: any;
        duration: any;
        end: any;
        ease: any;
    }>;
    _commitPrepared(track: any): this;
    _hasAnimation(): boolean;
    _setAuthored(value: any): this;
    _clearAnimation(): this;
    keys(keys: any): this;
    replaceKeys(keys: any): this;
    _keys(keys: any, replace: any): this;
    animate(spec: any): this;
    #private;
}
