const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  console.log("🚀 تشغيل الرادار الشامل... سيتم تسجيل كل حركة الآن");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 1. مراقبة كل طلبات الشبكة بدون استثناء
  page.on('request', request => {
    const url = request.url();
    // تصفية الروابط لاستبعاد الصور والخطوط المزعجة
    if (!url.match(/\.(png|jpg|jpeg|gif|css|woff|js)/)) {
        console.log("🌐 طلب خارجي:", url.substring(0, 100));
    }
  });

  // 2. مراقبة كل الاستجابات التي تحتوي على JSON (بيانات)
  page.on('response', async (response) => {
    try {
      const contentType = response.headers()['content-type'];
      if (contentType && contentType.includes('json')) {
        const data = await response.json();
        console.log("💎 اصطدنا بيانات JSON من الرابط:", response.url().substring(0, 50));
        console.log(JSON.stringify(data).substring(0, 300)); 
      }
    } catch (e) {
      // تجاهل الأخطاء إذا لم تكن الاستجابة JSON
    }
  });

  await page.goto('https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html', { waitUntil: 'networkidle' });
  
  console.log("✅ الموقع جاهز. تحرك في الخريطة واضغط على قطعة أرض.");
})();