
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add the stealth plugin to Playwright to bypass detection
chromium.use(stealthPlugin());

const TARGET_URL = 'https://geoportal.asal.dz/';

async function runStealthMission() {
    console.log('🚀 Mission 1 Initialization: Starting Stealth Browser...');

    try {
        // 2. Browser Config: Non-headless
        const browser = await chromium.launch({
            headless: false,
            args: ['--start-maximized']
        });

        const context = await browser.newContext({
            viewport: null, // Allow window resizing
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();

        console.log(`🌍 Navigating to ${TARGET_URL}...`);
        // 3. Navigation
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }); // domcontentloaded is faster than networkidle for initial load

        console.log('⏳ Waiting for map container and layers to initialize...');

        // 4. Wait Logic: Smart wait for map elements
        // We wait for a generic indicator of a map library (Leaflet, OpenLayers, ESRI JS API, etc.)
        // Common classes: .ol-viewport, .leaflet-container, .esri-view, or just a canvas
        try {
            await Promise.race([
                page.waitForSelector('canvas', { state: 'visible', timeout: 60000 }), // WebGL maps
                page.waitForSelector('.ol-viewport', { state: 'visible', timeout: 60000 }), // OpenLayers
                page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 60000 }), // Leaflet
                page.waitForSelector('#map', { state: 'visible', timeout: 60000 }), // Generic ID
                page.waitForSelector('#viewDiv', { state: 'visible', timeout: 60000 }) // ArcGIS
            ]);
        } catch (e) {
            console.warn('⚠️ Specific map selector not found within timeout. Checking for general activity...');
        }

        // Additional Wait: Ensure network activity settles down (tiles loaded)
        try {
            await page.waitForLoadState('networkidle', { timeout: 15000 });
        } catch (e) {
            // Ignore timeout on networkidle, map might be streaming tiles constantly
        }

        // 5. Verification Log
        console.log('✅ Mission 1: Portal accessed and map is ready.');

        // Keep browser open for user validation
        console.log('👀 Keeping browser open for monitoring...');
        await page.waitForTimeout(60000); // Keep open for 1 minute or until closed manually

        await browser.close();

    } catch (error) {
        console.error('❌ Mission Failed:', error);
        // Suggest installing dependencies if they are missing
        if (error instanceof Error && error.message.includes('Cannot find module')) {
            console.log('\n💡 DATA: It seems some dependencies are missing. Please run:');
            console.log('npm install playwright playwright-extra puppeteer-extra-plugin-stealth');
        }
    }
}

runStealthMission();
