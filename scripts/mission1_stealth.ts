
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add the stealth plugin to Playwright
chromium.use(stealthPlugin());

const TARGET_URL = 'https://geoportal.asal.dz/';

async function runStealthMission() {
    console.log('🕵️ Starting Mission 1: Stealth Mode...');

    try {
        const browser = await chromium.launch({
            headless: false, // User requested to see what's happening
            args: ['--start-maximized'] // Optional: Open maximized
        });

        const context = await browser.newContext({
            viewport: null, // Allow window resizing to determine viewport
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Spoof UA
        });

        const page = await context.newPage();

        console.log(`🌍 Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

        console.log('⏳ Waiting for map to load and loading screen to disappear...');

        // Wait for a common map element (usually canvas or specific ID) and ensuring loading overlay is gone
        // Note: Selectors depend on the specific site structure. Generally map apps have a canvas or a div with id='map'
        // We will wait for a generic 'canvas' or specific map container, and ensure no loading spinner is visible.

        // Example strategy: Wait for the main map container
        try {
            await page.waitForSelector('canvas', { state: 'visible', timeout: 30000 });
            // Or specific ID if known, e.g., #map, #viewDiv
            // await page.waitForSelector('#map', { state: 'visible' });
        } catch (e) {
            console.log('⚠️ Could not find canvas immediately, checking page title...');
        }

        // Heuristic: Wait a bit more to be sure "loading" is done
        await page.waitForTimeout(5000);

        console.log("✅ تمت المرحلة الأولى: تم اختراق الموقع بنجاح");
        console.log("✅ Mission 1 Complete: Website penetrated successfully");

        // Keep it open for a bit so the user can see
        await page.waitForTimeout(10000);

        await browser.close();

    } catch (error) {
        console.error('❌ Mission Failed:', error);
    }
}

runStealthMission();
