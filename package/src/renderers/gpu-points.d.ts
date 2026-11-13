// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function createPointRasterizer(doc: any): {
    /** True when the context exists (or can be created) and every point fits the platform's point-size limit. */
    accepts(cloud: any, radius: any, scale: any): boolean;
    /** Rasterize at the context's device size and composite once with the context's current clip. */
    draw(ctx: any, cloud: any, { radius, shape, color, blend }: {
        radius: any;
        shape: any;
        color: any;
        blend: any;
    }): void;
    dispose(): void;
};
