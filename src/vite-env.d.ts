/// <reference types="vite/client" />

declare module '*.geojson' {
    const value: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: { type: string; coordinates: unknown[] };
            properties: Record<string, unknown>;
        }>;
    };
    export default value;
}
