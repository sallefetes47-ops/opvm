const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log("📡 الرادار يعمل الآن... بانتظار أي إشارة من الموقع...");

  page.on('response', async (response) => {
    const url = response.url();
    
    // سنطبع أي رابط يحتوي على كلمة MapServer لمعرفة الرابط الحقيقي
    if (url.includes('MapServer')) {
       console.log("🔗 وجدنا رابط خادم الخرائط:", url);
       try {
         const text = await response.text();
         if (text.includes('SECTION') || text.includes('attributes')) {
            console.log("🎯 هدف مؤكد! هذه هي بيانات القطع:");
            console.log(text.substring(0, 500)); // سنطبع أول 500 حرف للتأكد
         }
       } catch (e) {}
    }
  });

  await page.goto('https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html');
})();