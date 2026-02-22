const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
    const browser = await chromium.launch({ headless: false }); // سيفتح متصفحاً تراه بعينك
    const page = await browser.newPage();

    // هذا هو "الرادار" الذي يصطاد البيانات
    page.on('response', async (response) => {
        const url = response.url();
        // إذا وجدنا رابطاً يحتوي على كلمة query أو identify (وهي روابط البيانات)
        if (url.includes('query') || url.includes('identify')) {
            try {
                const json = await response.json();
                console.log("🎯 اصطدنا بيانات القطعة:");
                console.log(JSON.stringify(json, null, 2)); // سيطبع لك القسم ومجموعة الملكية هنا
            } catch (e) { }
        }
    });

    await page.goto('https://fadaeldjazair.mf.gov.dz/mission-documentaire/index_public_47.html');
    console.log("🌐 الموقع فتح الآن.. اذهب للخريطة واضغط على أي قطعة أرض في وادي ميزاب");
})();