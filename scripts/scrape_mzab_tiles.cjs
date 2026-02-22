/**
 * سكريبت مسح شامل لبيانات MVT العقارية لوادي ميزاب
 * يغطي: غرداية، مليكة، بني يزقن، بونورة
 * يحفظ الناتج في: public/mzab_cadastre_map.geojson
 * 
 * التشغيل: node scripts/scrape_mzab_tiles.cjs
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { VectorTile } = require('@mapbox/vector-tile');
const PbfModule = require('pbf');
const Protobuf = PbfModule.default || PbfModule;

// ==========================================
// 🗺️ خريطة المربعات (Tiles) لكل مدينة في وادي ميزاب
// تم استخراجها من بوابة fadaeldjazair.mf.gov.dz
// المستوى: Zoom 14 (تفصيل عالٍ)
// ==========================================
const TILE_Z = 14;

const CITIES = [
    {
        name: 'غرداية (Ghardaïa)',
        layerPrefix: 'ghardaia_ilot',
        tiles: [
            { x: 8362, y: 6628 },
            { x: 8362, y: 6629 },
            { x: 8363, y: 6628 },
            { x: 8363, y: 6629 },
        ]
    },
    {
        name: 'مليكة (Melika)',
        layerPrefix: 'ghardaia_ilot',
        tiles: [
            { x: 8363, y: 6629 },
            { x: 8363, y: 6630 },
        ]
    },
    {
        name: 'بني يزقن (Beni Isguen)',
        layerPrefix: 'ghardaia_ilot',
        tiles: [
            { x: 8363, y: 6630 },
            { x: 8364, y: 6630 },
            { x: 8364, y: 6631 },
        ]
    },
    {
        name: 'بونورة (Bounoura)',
        layerPrefix: 'ghardaia_ilot',
        tiles: [
            { x: 8362, y: 6630 },
            { x: 8363, y: 6630 },
        ]
    },
];

// 🧮 تحويل إحداثيات المربع إلى GPS (خط طول / عرض)
function tileToLonLat(px, py, extent, tileX, tileY) {
    const xCoord = tileX + (px / extent);
    const yCoord = tileY + (py / extent);
    const n = Math.pow(2, TILE_Z);
    const lon = (xCoord / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * yCoord / n)));
    const lat = latRad * (180 / Math.PI);
    return [lon, lat];
}

// تحميل وفك تشفير مربع MVT واحد
async function fetchAndDecodeTile(city, tile) {
    const url = `https://fadaeldjazair.mf.gov.dz/pm/${city.layerPrefix}/${TILE_Z}/${tile.x}/${tile.y}.mvt`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html',
                'Accept': '*/*'
            }
        });

        if (!response.ok) {
            console.warn(`   ⚠️ المربع ${tile.x}/${tile.y} أرجع ${response.status} — يُتخطى`);
            return [];
        }

        const arrayBuffer = await response.arrayBuffer();
        const vtile = new VectorTile(new Protobuf(new Uint8Array(arrayBuffer)));
        const features = [];

        // المرور على كل الطبقات في المربع
        for (const layerName of Object.keys(vtile.layers)) {
            const layer = vtile.layers[layerName];

            for (let i = 0; i < layer.length; i++) {
                const feature = layer.feature(i);
                const geometry = feature.loadGeometry();

                const polygonCoordinates = geometry.map(ring =>
                    ring.map(point => tileToLonLat(point.x, point.y, feature.extent, tile.x, tile.y))
                );

                features.push({
                    type: "Feature",
                    properties: {
                        SECTION: feature.properties.se_no || '',
                        ILOT: feature.properties.il_no || '',
                        AREA: feature.properties.shape_area || 0,
                        CODE_WILAYA: feature.properties.wi_no || '',
                        FULL_ID: feature.properties.il_no_nat || '',
                        CITY: city.name,
                        LAYER: layerName,
                        TILE: `${tile.x}/${tile.y}`,
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: polygonCoordinates
                    }
                });
            }
        }

        return features;
    } catch (err) {
        console.warn(`   ❌ خطأ في المربع ${tile.x}/${tile.y}:`, err.message);
        return [];
    }
}

// 🚀 التشغيل الرئيسي
async function main() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  مسح شامل لبيانات MVT العقارية — وادي ميزاب     ║");
    console.log("║  ديوان حماية وادي ميزاب — المرسوم 15-19          ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const geojson = {
        type: "FeatureCollection",
        features: []
    };

    // إزالة التكرارات باستخدام Set
    const processedTiles = new Set();
    let totalFeatures = 0;

    for (const city of CITIES) {
        console.log(`\n🏙️ جاري مسح: ${city.name}`);

        for (const tile of city.tiles) {
            const tileKey = `${tile.x}-${tile.y}`;

            // تجنب إعادة تحميل مربع تم معالجته لمدينة أخرى
            if (processedTiles.has(tileKey)) {
                console.log(`   ⏩ المربع ${tile.x}/${tile.y} تم مسحه سابقاً — يُتخطى`);
                continue;
            }
            processedTiles.add(tileKey);

            console.log(`   📡 جاري تحميل المربع ${tile.x}/${tile.y}...`);
            const features = await fetchAndDecodeTile(city, tile);

            if (features.length > 0) {
                geojson.features.push(...features);
                totalFeatures += features.length;
                console.log(`   ✅ تم استخراج ${features.length} قطعة (المجموع: ${totalFeatures})`);
            }

            // تأخير بين الطلبات لتجنب الحظر
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // حفظ الملف في مجلد public
    const outputPath = path.join(__dirname, '..', 'public', 'mzab_cadastre_map.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log(`║  🎉 اكتملت المهمة بنجاح!                         ║`);
    console.log(`║  📦 إجمالي القطع: ${String(totalFeatures).padEnd(30)}║`);
    console.log(`║  💾 الملف: public/mzab_cadastre_map.geojson       ║`);
    console.log("╚══════════════════════════════════════════════════╝");
}

main();
