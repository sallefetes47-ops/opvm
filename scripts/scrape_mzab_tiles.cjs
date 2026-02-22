/**
 * سكريبت المسح الشبكي الشامل لبيانات MVT العقارية لوادي ميزاب
 * يغطي النطاق الجغرافي الكامل لـ: غرداية، مليكة، بني يزقن، بونورة (والعطف)
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const { VectorTile } = require('@mapbox/vector-tile');
const PbfModule = require('pbf');
const Protobuf = PbfModule.default || PbfModule;

const TILE_Z = 14;

// 🗺️ تحديد "شبكة جغرافية" ضخمة تغطي كامل وادي ميزاب
// بدلاً من المربعات المحدودة، سنمسح نطاقاً كاملاً (Bounding Box)
const X_START = 8355; 
const X_END = 8370;   // من الغرب إلى الشرق
const Y_START = 6624; 
const Y_END = 6638;   // من الشمال إلى الجنوب

// قد تكون بعض البلديات مفصولة في طبقات أخرى في السيرفر، لذا سنبحث في الطبقة الرئيسية
const LAYER_PREFIX = 'ghardaia_ilot'; 

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
async function fetchAndDecodeTile(tileX, tileY) {
    const url = `https://fadaeldjazair.mf.gov.dz/pm/${LAYER_PREFIX}/${TILE_Z}/${tileX}/${tileY}.mvt`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://fadaeldjazair.mf.gov.dz/'
            }
        });

        // إذا كان المربع خارج النطاق العمراني أو فارغاً سيرجع 404 أو 204
        if (!response.ok) {
            return [];
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength === 0) return []; // مربع فارغ

        const vtile = new VectorTile(new Protobuf(new Uint8Array(arrayBuffer)));
        const features = [];

        for (const layerName of Object.keys(vtile.layers)) {
            const layer = vtile.layers[layerName];

            for (let i = 0; i < layer.length; i++) {
                const feature = layer.feature(i);
                const geometry = feature.loadGeometry();

                const polygonCoordinates = geometry.map(ring =>
                    ring.map(point => tileToLonLat(point.x, point.y, feature.extent, tileX, tileY))
                );

                features.push({
                    type: "Feature",
                    properties: {
                        SECTION: feature.properties.se_no || '',
                        ILOT: feature.properties.il_no || '',
                        AREA: feature.properties.shape_area || 0,
                        COMMUNE: feature.properties.co_no_nat || 'مجهول', // رقم البلدية الوطني
                        TILE: `${tileX}/${tileY}`,
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
        return []; // تخطي الأخطاء الصامتة
    }
}

async function main() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  مسح شبكي شامل (Grid Scan) لبلديات وادي ميزاب    ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    const geojson = {
        type: "FeatureCollection",
        features: []
    };

    let totalFeatures = 0;
    let tilesScanned = 0;
    let tilesFound = 0;

    // المرور على الشبكة الجغرافية بالكامل
    for (let x = X_START; x <= X_END; x++) {
        for (let y = Y_START; y <= Y_END; y++) {
            tilesScanned++;
            process.stdout.write(`\r🔍 فحص المربع [${x}/${y}]... (فُحص: ${tilesScanned})`);
            
            const features = await fetchAndDecodeTile(x, y);

            if (features.length > 0) {
                tilesFound++;
                geojson.features.push(...features);
                totalFeatures += features.length;
                console.log(`\n ✅ وُجدت بيانات! استخراج ${features.length} قطعة. (الإجمالي حتى الآن: ${totalFeatures})`);
            }

            // تأخير بسيط جداً كي لا يتم حظرنا من السيرفر
            await new Promise(r => setTimeout(r, 100)); 
        }
    }

    // حفظ الملف النهائي
    const outputPath = path.join(__dirname, '..', 'public', 'mzab_cadastre_map.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log(`║ 🎉 اكتمل المسح الشامل بنجاح!                     ║`);
    console.log(`║ 📍 تم فحص ${tilesScanned} مربع جغرافي.                     ║`);
    console.log(`║ 🎯 المربعات المليئة بالبيانات: ${tilesFound}                 ║`);
    console.log(`║ 📦 إجمالي القطع المستخرجة: ${String(totalFeatures).padEnd(22)}║`);
    console.log("╚══════════════════════════════════════════════════╝");
}

main();
