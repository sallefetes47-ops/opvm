const axios = require('axios');
const Protobuf = require('pbf');
const { VectorTile } = require('@mapbox/vector-tile');

// Disable TLS verification to avoid issues with target government domain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const mvtUrl = "https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/14/8362/6628.mvt";

// Target Tile params (extracted from the URL)
const Z = 14;
const X = 8362;
const Y = 6628;

// Math Helper to project MVT inner tile x/y coordinates to true standard Lat/Lon (EPSG:4326)
function projectToLonLat(px, py, extent = 4096) {
    const x0 = X + px / extent;
    const y0 = Y + py / extent;

    const lon = (x0 / Math.pow(2, Z)) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y0) / Math.pow(2, Z);
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    // Standard GeoJSON is [longitude, latitude]
    return [
        Math.round(lon * 1e6) / 1e6,
        Math.round(lat * 1e6) / 1e6
    ];
}

async function decodeTargetMVT() {
    try {
        console.log(`Downloading MVT from: ${mvtUrl} ...`);

        // Use axios to fetch the Mapbox Vector Tile (.mvt) as an arraybuffer
        const response = await axios.get(mvtUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // Decode the Protobuf buffer into a Mapbox Vector Tile object
        const tile = new VectorTile(new Protobuf(buffer));

        console.log(`Layers inside Tile: ${Object.keys(tile.layers).join(', ')}`);

        // Iterate over layers (Usually 'Ilot' or 'ilots' depending on the data)
        for (const [layerName, layer] of Object.entries(tile.layers)) {
            console.log(`\n===========================================`);
            console.log(`Layer: "${layerName}" - ${layer.length} total features `);
            console.log(`===========================================`);

            // For console simplicity, we log only the first 2 features to avoid terminal spam
            const maxFeatures = Math.min(layer.length, 2);
            for (let i = 0; i < maxFeatures; i++) {
                const feature = layer.feature(i);

                // MVT geometries are returned in Tile Extent Coordinates (usually 0 to 4096)
                const rawGeometry = feature.loadGeometry();

                // Convert Native MVT Tile coordinates to standard real-world Lat/Lon (GeoJSON coords)
                const geoJsonCoords = rawGeometry.map(ring =>
                    ring.map(point => projectToLonLat(point.x, point.y, layer.extent))
                );

                // Determine precise Geometry type
                const types = ['Unknown', 'Point', 'LineString', 'Polygon'];
                const geomType = types[feature.type] || 'Unknown';

                // Format coordinates shape to comply completely with the GeoJSON standard according to the geometry Type
                let finalCoords;
                if (feature.type === 1) finalCoords = geoJsonCoords[0][0]; // Point: [lon, lat]
                else if (feature.type === 2) finalCoords = geoJsonCoords[0]; // LineString: [[lon,lat]...]
                else finalCoords = geoJsonCoords; // Polygon: [[[lon,lat]...]]

                // The standard GeoJSON feature representation
                const geoJsonFeature = {
                    type: "Feature",
                    properties: feature.properties,
                    geometry: {
                        type: geomType,
                        coordinates: finalCoords
                    }
                };

                console.log(`\nFeature Index #${i}:`);
                console.dir(geoJsonFeature, { depth: null, colors: true });
            }

            if (layer.length > maxFeatures) {
                console.log(`\n... and ${layer.length - maxFeatures} more features exist in this layer.`);
            }
        }

    } catch (err) {
        console.error("Failed to fetch or decode MVT tile:", err.message);
    }
}

decodeTargetMVT();