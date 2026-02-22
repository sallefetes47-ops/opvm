// تجاوز حظر شهادات الأمان (SSL)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const { VectorTile } = require('@mapbox/vector-tile');
const PbfModule = require('pbf');
const Protobuf = PbfModule.default || PbfModule;

// معلومات المربع الجغرافي لوادي ميزاب الذي اصطدناه
const mvtUrl = 'https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/14/8362/6628.mvt';
const TILE_Z = 14;
const TILE_X = 8362;
const TILE_Y = 6628;

// 🧮 الدالة الرياضية السحرية: تحويل بكسل المربع إلى خطوط طول وعرض (GPS)
function tileToLonLat(px, py, extent) {
    const xCoord = TILE_X + (px / extent);
    const yCoord = TILE_Y + (py / extent);
    const n = Math.pow(2, TILE_Z);
    const lon = (xCoord / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * yCoord / n)));
    const lat = latRad * (180 / Math.PI);
    return [lon, lat]; // إرجاع [خط الطول, خط العرض]
}

async function exportMzabGeoJSON() {
    console.log("🚀 جاري سحب البيانات وتحويلها إلى خريطة GeoJSON...");

    try {
        const response = await fetch(mvtUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html',
                'Accept': '*/*'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const tile = new VectorTile(new Protobuf(new Uint8Array(arrayBuffer)));
        const layer = tile.layers['ghardaia_ilot']; // استهداف طبقة مجموعات الملكية

        // 🗺️ هيكل ملف الخريطة القياسي GeoJSON
        const geojson = {
            type: "FeatureCollection",
            features: []
        };

        console.log(`📦 جاري معالجة إحداثيات ${layer.length} قطعة أرضية...`);

        // المرور على كل القطع وتحويل إحداثياتها
        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            const geometry = feature.loadGeometry();

            // تحويل كل نقطة في حدود القطعة إلى GPS
            const polygonCoordinates = geometry.map(ring =>
                ring.map(point => tileToLonLat(point.x, point.y, feature.extent))
            );

            // إنشاء القطعة وإضافتها للخريطة
            geojson.features.push({
                type: "Feature",
                properties: {
                    SECTION: feature.properties.se_no,         // القسم
                    ILOT: feature.properties.il_no,            // مجموعة الملكية
                    AREA: feature.properties.shape_area,       // المساحة
                    CODE_WILAYA: feature.properties.wi_no,     // الولاية
                    FULL_ID: feature.properties.il_no_nat      // المعرف الكامل
                },
                geometry: {
                    type: "Polygon", // شكل هندسي مضلع
                    coordinates: polygonCoordinates
                }
            });
        }

        // 💾 حفظ الخريطة في ملف
        const fileName = 'mzab_cadastre_map.geojson';
        fs.writeFileSync(fileName, JSON.stringify(geojson, null, 2));

        console.log(`\n🎉 اكتملت المهمة بنجاح يا قبطان!`);
        console.log(`💾 تم حفظ الخريطة الجغرافية بالكامل في ملف: [${fileName}]`);
        console.log(`✅ الملف الآن جاهز للدمج مباشرة في منصة عقود التعمير!`);

    } catch (error) {
        console.error("❌ فشل:", error.message);
    }
}

exportMzabGeoJSON();