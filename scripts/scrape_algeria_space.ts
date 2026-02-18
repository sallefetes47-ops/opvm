import { chromium } from 'playwright';
import { db } from './firebase_config';
import { collection, addDoc } from 'firebase/firestore';

// Configuration
const TARGET_URL = 'https://geoportal.asal.dz/'; // Best guess URL
const COLLECTION_NAME = 'algeria_space_data';
const HEADLESS_MODE = false; // Set to true for production/background
const REQUEST_DELAY_MS = 2000; // Delay between actions to be gentle

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrape() {
    console.log('Starting scraper...');

    // Launch browser
    const browser = await chromium.launch({
        headless: HEADLESS_MODE,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Setup Network Sniffing
    page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Filter for JSON/GeoJSON and specific map service patterns
        if (
            (contentType.includes('json') || url.includes('MapServer') || url.includes('wfs')) &&
            !url.includes('google') // Exclude generic assets
        ) {
            try {
                const data = await response.json();

                // Basic validation - check if it looks like map data
                if (data && (data.features || data.results || data.attributes)) {
                    console.log(`[captured] Data from: ${url}`);

                    // Upload to Firebase
                    await addDoc(collection(db, COLLECTION_NAME), {
                        url: url,
                        timestamp: new Date(),
                        data: data,
                        metadata: {
                            scraped_by: 'algeria_space_scraper_v1'
                        }
                    });
                    console.log('  -> Saved to Firebase');
                }
            } catch (e) {
                // Ignore JSON parse errors for non-JSON responses
            }
        }
    });

    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        console.log('Page loaded.');

        // Wait for manual login or initial load if needed
        await delay(5000);

        // Interaction Loop (Pan & Zoom)
        // Perform a few random movements to trigger data loading
        for (let i = 0; i < 10; i++) {
            console.log(`Action ${i + 1}/10: Moving map...`);

            // Simulate mouse drag (Pan)
            const viewportSize = page.viewportSize();
            if (viewportSize) {
                const startX = viewportSize.width / 2;
                const startY = viewportSize.height / 2;

                await page.mouse.move(startX, startY);
                await page.mouse.down();
                await page.mouse.move(startX + (Math.random() * 200 - 100), startY + (Math.random() * 200 - 100));
                await page.mouse.up();
            }

            // Wait to be gentle on the server
            await delay(REQUEST_DELAY_MS);

            // Occasionally click (if needed to select parcels)
            if (i % 3 === 0) {
                const viewportSize = page.viewportSize();
                if (viewportSize) {
                    const clickX = viewportSize.width / 2 + (Math.random() * 100 - 50);
                    const clickY = viewportSize.height / 2 + (Math.random() * 100 - 50);
                    console.log('  -> Simulating click...');
                    await page.mouse.click(clickX, clickY);
                }
                await delay(REQUEST_DELAY_MS);
            }
        }

        console.log('Scraping session finished.');

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        // Keep browser open briefly to see results if headed
        await delay(5000);
        await browser.close();
    }
}

scrape();
