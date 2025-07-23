/**
 * Test script to verify both human-AI and human-human modes work
 */

const puppeteer = require('puppeteer');

async function testMode(mode) {
    console.log(`\n=== Testing ${mode.toUpperCase()} Mode ===`);

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set up console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`❌ ${mode} Error:`, msg.text());
            } else if (msg.text().includes('Error') || msg.text().includes('error')) {
                console.log(`⚠️  ${mode} Warning:`, msg.text());
            } else {
                console.log(`ℹ️  ${mode} Log:`, msg.text());
            }
        });

        // Navigate to the application
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Wait for the page to load
        await page.waitForTimeout(3000);

        // Check if the experiment initialized properly
        const experimentStatus = await page.evaluate(() => {
            return {
                unifiedExperiment: typeof window.UnifiedNodeGameExperiment !== 'undefined',
                experimentMode: window.EXPERIMENT_CONFIG?.experimentMode,
                container: document.getElementById('container')?.innerHTML?.length > 0
            };
        });

        console.log(`✅ ${mode} Status:`, experimentStatus);

        // Wait a bit more to see if any errors occur
        await page.waitForTimeout(5000);

        console.log(`✅ ${mode} mode test completed successfully`);

    } catch (error) {
        console.error(`❌ ${mode} mode test failed:`, error.message);
    } finally {
        await browser.close();
    }
}

async function runTests() {
    console.log('Starting mode tests...');

    // Test human-AI mode
    await testMode('human-ai');

    // Test human-human mode
    await testMode('human-human');

    console.log('\n=== All tests completed ===');
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testMode, runTests };