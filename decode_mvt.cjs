const { VectorTile } = require('@mapbox/vector-tile');
const Protobuf = require('pbf');

// هذا أحد الروابط الذهبية التي التقطناها لوادي ميزاب من جهازك
const mvtUrl = 'https://fadaeldjazair.mf.gov.dz/pm/ghardaia_ilot/14/8362/6628.mvt';

async function decodeMzabData() {
    console.log("🚀 جاري سحب الكتلة الجغرافية المشفرة لوادي ميزاب...");
    
    try {
        // 1. جلب الملف المشفر من الخادم الحكومي
        const response = await fetch(mvtUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        
        // 2. فك التشفير باستخدام مكتبات الخرائط
        const tile = new VectorTile(new Protobuf(new Uint8Array(buffer)));
        
        console.log("✅ تم الاختراق وفك التشفير بنجاح!\n");
        
        // 3. استخراج البيانات والحدود
        for (const layerName in tile.layers) {
            const layer = tile.layers[layerName];
            console.log(`🗺️ اسم الطبقة المستخرجة: [${layerName}]`);
            console.log(`📦 عدد القطع (Ilots) داخل هذا المربع: ${layer.length}`);
            
            // سنقوم بطباعة بيانات أول قطعتين كمثال لتتأكد بنفسك
            const maxItems = Math.min(2, layer.length);
            for (let i = 0; i < maxItems; i++) {
                const feature = layer.feature(i);
                console.log(`\n💎 --- القطعة رقم ${i + 1} ---`);
                console.log("📋 المعلومات (القسم ومجموعة الملكية):", feature.properties);
                
                // استخراج الحدود الهندسية الخام
                const geometry = feature.loadGeometry();
                console.log("📐 عدد نقاط الحدود (المضلع):", geometry[0].length, "نقاط");
            }
        }
        
        console.log("\n🔥 المهمة تمت! البيانات جاهزة للتحويل إلى منصة عقود التعمير.");
        
    } catch (error) {
        console.error("❌ فشل في سحب أو فك التشفير:", error.message);
    }
}

decodeMzabData();