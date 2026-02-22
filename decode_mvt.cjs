// تجاوز حظر شهادات الأمان (SSL) بنجاح
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { VectorTile } = require('@mapbox/vector-tile');
const PbfModule = require('pbf');
// هذا هو السطر السحري الذي يحل مشكلة الـ Constructor
const Protobuf = PbfModule.default || PbfModule;

const mvtUrl = 'https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/14/8362/6628.mvt';

async function decodeMzabData() {
    console.log("🚀 جاري سحب الكتلة الجغرافية لوادي ميزاب متخفياً...");

    try {
        const response = await fetch(mvtUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html',
                'Accept': '*/*'
            }
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();

        // فك التشفير باستخدام النسخة المصححة من Protobuf
        const tile = new VectorTile(new Protobuf(new Uint8Array(arrayBuffer)));

        console.log("✅ تم الاختراق وفك التشفير بنجاح!\n");

        for (const layerName in tile.layers) {
            const layer = tile.layers[layerName];
            console.log(`🗺️ اسم الطبقة المستخرجة: [${layerName}]`);
            console.log(`📦 عدد القطع (Ilots) داخل هذا المربع: ${layer.length}`);

            // طباعة بيانات أول قطعتين كمثال
            const maxItems = Math.min(2, layer.length);
            for (let i = 0; i < maxItems; i++) {
                const feature = layer.feature(i);
                console.log(`\n💎 --- القطعة رقم ${i + 1} ---`);
                console.log("📋 المعلومات (القسم والمجموعة):", feature.properties);

                const geometry = feature.loadGeometry();
                console.log("📐 عدد نقاط الحدود:", geometry[0] ? geometry[0].length : 0, "نقاط");
            }
        }

        console.log("\n🔥 المهمة تمت! نحن نرى ما لا يراه المتصفح العادي.");

    } catch (error) {
        console.error("❌ فشل:", error.message);
    }
}

decodeMzabData();