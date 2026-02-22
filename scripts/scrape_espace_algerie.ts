/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  سكريبت Playwright لكشط بيانات وادي ميزاب العقارية          ║
 * ║  المصدر: فضاء الجزائر (fadaeldjazair.mf.gov.dz)             ║
 * ║  الهدف: استخراج بيانات الـ Ilots لبلديات غرداية الأربع       ║
 * ║  المرسوم 15-19 — ديوان حماية وادي ميزاب                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * الاستراتيجية:
 * بدلاً من النقر على كل مضلع، نستخدم اعتراض الشبكة (Network Interception)
 * لالتقاط ملفات MVT التي يحملها المتصفح تلقائياً عند التنقل في الخريطة.
 * ثم نفك تشفيرها ونحولها إلى GeoJSON موحد.
 * 
 * التشغيل:
 *   npx tsx scripts/scrape_espace_algerie.ts
 */

import { chromium, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ===== المكتبات اللازمة لفك تشفير MVT =====
// @ts-ignore - CommonJS modules
const PbfModule = require('pbf');
const { VectorTile } = require('@mapbox/vector-tile');
const Protobuf = PbfModule.default || PbfModule;

// ==========================================
// ⚙️ إعدادات التشغيل
// ==========================================
const TARGET_URL = 'https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html';
const OUTPUT_FILE = path.resolve(__dirname, '..', 'public', 'mzab_cadastre_map.geojson');
const HEADLESS = false;    // true = بدون نافذة | false = مع نافذة للمراقبة
const SLOW_MO = 300;       // تأخير بين الإجراءات (ملي ثانية) لمنع الحظر
const TILE_Z = 14;          // مستوى التقريب المستهدف

// ==========================================
// 🏙️ إحداثيات مراكز البلديات الأربع للتنقل إليها
// ==========================================
const COMMUNES = [
    { name: 'غرداية', lat: 32.4909, lng: 3.6738, zoom: 15 },
    { name: 'مليكة', lat: 32.4833, lng: 3.6780, zoom: 16 },
    { name: 'بني يزقن', lat: 32.4727, lng: 3.6852, zoom: 16 },
    { name: 'بونورة', lat: 32.4800, lng: 3.6800, zoom: 16 },
];

// ==========================================
// 🧮 تحويل إحداثيات Tile إلى GPS
// ==========================================
function tileToLonLat(px: number, py: number, extent: number, tileX: number, tileY: number): [number, number] {
    const xCoord = tileX + (px / extent);
    const yCoord = tileY + (py / extent);
    const n = Math.pow(2, TILE_Z);
    const lon = (xCoord / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * yCoord / n)));
    const lat = latRad * (180 / Math.PI);
    return [lon, lat];
}

// استخراج Z/X/Y من رابط MVT
function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
    const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.mvt/);
    if (match) {
        return { z: parseInt(match[1]), x: parseInt(match[2]), y: parseInt(match[3]) };
    }
    return null;
}

// فك تشفير بيانات MVT وتحويلها إلى Features
function decodeMvtBuffer(buffer: Buffer, tileX: number, tileY: number): any[] {
    const vtile = new VectorTile(new Protobuf(new Uint8Array(buffer)));
    const features: any[] = [];

    for (const layerName of Object.keys(vtile.layers)) {
        const layer = vtile.layers[layerName];

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            const geometry = feature.loadGeometry();

            const polygonCoordinates = geometry.map((ring: any[]) =>
                ring.map((point: { x: number; y: number }) =>
                    tileToLonLat(point.x, point.y, feature.extent, tileX, tileY)
                )
            );

            features.push({
                type: "Feature",
                properties: {
                    SECTION: feature.properties.se_no || '',
                    ILOT: feature.properties.il_no || '',
                    AREA: feature.properties.shape_area || 0,
                    CODE_WILAYA: feature.properties.wi_no || '',
                    FULL_ID: feature.properties.il_no_nat || '',
                    LAYER: layerName,
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
}

// تأخير ذكي
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// 🚀 السكريبت الرئيسي
// ==========================================
async function main() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  🕵️ سكريبت كشط فضاء الجزائر — وادي ميزاب       ║");
    console.log("║  ديوان حماية وادي ميزاب — المرسوم 15-19          ║");
    console.log("╚══════════════════════════════════════════════════╝\n");

    // تجميع كل البيانات هنا
    const allFeatures: any[] = [];
    const processedTiles = new Set<string>();

    // ===== تشغيل المتصفح =====
    const browser = await chromium.launch({
        headless: HEADLESS,
        slowMo: SLOW_MO,
    });

    const context = await browser.newContext({
        ignoreHTTPSErrors: true, // تجاوز أخطاء SSL
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // ===== 🎯 اعتراض طلبات MVT من الشبكة =====
    page.on('response', async (response) => {
        const url = response.url();

        // التقاط فقط ملفات .mvt التي تخص ghardaia_ilot
        if (url.includes('.mvt') && url.includes('ghardaia_ilot')) {
            const tileInfo = parseTileUrl(url);
            if (!tileInfo) return;

            const tileKey = `${tileInfo.x}-${tileInfo.y}`;
            if (processedTiles.has(tileKey)) return; // تجنب التكرار
            processedTiles.add(tileKey);

            try {
                const body = await response.body();
                const features = decodeMvtBuffer(Buffer.from(body), tileInfo.x, tileInfo.y);

                if (features.length > 0) {
                    allFeatures.push(...features);
                    console.log(`   ✅ المربع ${tileInfo.x}/${tileInfo.y}: ${features.length} قطعة (المجموع: ${allFeatures.length})`);
                }
            } catch (e: any) {
                console.warn(`   ⚠️ فشل فك المربع ${tileInfo.x}/${tileInfo.y}: ${e.message}`);
            }
        }
    });

    try {
        // ===== 1. الولوج إلى الموقع =====
        console.log(`\n📡 جاري فتح فضاء الجزائر...`);
        await page.goto(TARGET_URL, {
            waitUntil: 'networkidle',
            timeout: 60000, // دقيقة كاملة للتحميل
        });
        console.log('✅ تم تحميل الصفحة الرئيسية');

        // انتظار تحميل الخريطة التفاعلية
        await delay(5000);

        // ===== 2. التنقل بين البلديات الأربع =====
        for (const commune of COMMUNES) {
            console.log(`\n🏙️ ═══ جاري مسح: ${commune.name} ═══`);

            // التنقل إلى مركز البلدية عبر تنفيذ JavaScript في الصفحة
            // (الخريطة تستخدم OpenLayers أو Leaflet داخلياً)
            await page.evaluate(({ lat, lng, zoom }) => {
                // محاولة مع OpenLayers (الأكثر شيوعاً في المواقع الحكومية)
                const maps = (window as any).map || (window as any).olMap;
                if (maps && maps.getView) {
                    const view = maps.getView();
                    // تحويل إحداثيات GPS إلى EPSG:3857 (Web Mercator)
                    const x = lng * 20037508.34 / 180;
                    const y_rad = lat * Math.PI / 180;
                    const y = Math.log(Math.tan(y_rad / 2 + Math.PI / 4)) * 20037508.34 / Math.PI;
                    view.setCenter([x, y]);
                    view.setZoom(zoom);
                }

                // محاولة مع Leaflet
                const leafletMap = (window as any).L_map || (window as any)._map;
                if (leafletMap && leafletMap.setView) {
                    leafletMap.setView([lat, lng], zoom);
                }
            }, commune);

            // ⏳ انتظار ذكي لتحميل المربعات
            console.log(`   ⏳ انتظار تحميل بيانات ${commune.name}...`);
            await delay(8000);

            // تحريك الخريطة بشكل طفيف لتحميل مربعات إضافية
            const viewport = page.viewportSize();
            if (viewport) {
                const cx = viewport.width / 2;
                const cy = viewport.height / 2;

                // سحب الخريطة في 4 اتجاهات لتحميل المربعات المحيطة
                const directions = [
                    { dx: 300, dy: 0, label: '→' },
                    { dx: -600, dy: 0, label: '←' },
                    { dx: 300, dy: 300, label: '↓' },
                    { dx: 0, dy: -600, label: '↑' },
                ];

                for (const dir of directions) {
                    console.log(`   ${dir.label} سحب الخريطة...`);
                    await page.mouse.move(cx, cy);
                    await page.mouse.down();
                    await page.mouse.move(cx + dir.dx, cy + dir.dy, { steps: 10 });
                    await page.mouse.up();
                    await delay(4000); // انتظار تحميل المربعات الجديدة
                }
            }

            console.log(`   📊 المجموع بعد ${commune.name}: ${allFeatures.length} قطعة`);
        }

        // ===== 3. إزالة التكرارات =====
        console.log(`\n🔄 إزالة التكرارات...`);
        const uniqueFeatures = new Map<string, any>();
        for (const feature of allFeatures) {
            // استخدام المعرف الوطني كمفتاح فريد
            const key = feature.properties.FULL_ID ||
                `${feature.properties.SECTION}-${feature.properties.ILOT}-${feature.properties.TILE}`;
            if (!uniqueFeatures.has(key)) {
                uniqueFeatures.set(key, feature);
            }
        }

        // ===== 4. دمج مع البيانات الموجودة (قصر العطف) =====
        let existingFeatures: any[] = [];
        if (fs.existsSync(OUTPUT_FILE)) {
            try {
                const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
                existingFeatures = existing.features || [];
                console.log(`   📂 بيانات موجودة مسبقاً: ${existingFeatures.length} قطعة`);

                // إضافة البيانات الموجودة التي ليست مكررة
                for (const feat of existingFeatures) {
                    const key = feat.properties.FULL_ID ||
                        `${feat.properties.SECTION}-${feat.properties.ILOT}-${feat.properties.TILE}`;
                    if (!uniqueFeatures.has(key)) {
                        uniqueFeatures.set(key, feat);
                    }
                }
            } catch {
                console.warn('   ⚠️ ملف GeoJSON الموجود تالف — سيتم استبداله');
            }
        }

        // ===== 5. حفظ الملف النهائي =====
        const geojson = {
            type: "FeatureCollection" as const,
            features: Array.from(uniqueFeatures.values()),
        };

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2));

        console.log("\n╔══════════════════════════════════════════════════╗");
        console.log(`║  🎉 اكتملت عملية المسح!                          ║`);
        console.log(`║  📦 القطع الجديدة: ${String(uniqueFeatures.size).padEnd(31)}║`);
        console.log(`║  📦 قبل الدمج: ${String(existingFeatures.length).padEnd(35)}║`);
        console.log(`║  💾 المسار: public/mzab_cadastre_map.geojson      ║`);
        console.log("╚══════════════════════════════════════════════════╝");

    } catch (error: any) {
        console.error(`\n❌ خطأ أثناء المسح: ${error.message}`);
    } finally {
        // إبقاء النافذة مفتوحة 5 ثوانٍ للمراقبة
        await delay(5000);
        await browser.close();
    }
}

main();
