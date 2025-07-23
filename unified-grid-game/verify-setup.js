/**
 * Verification script for Unified Grid Game setup
 * Run this to verify all files are in place
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Unified Grid Game Setup...\n');

const requiredFiles = [
    // Core HTML
    'public/index.html',
    
    // Configuration
    'config/experimentConfig.js',
    
    // Core JavaScript files
    'public/js/setup.js',
    'public/js/utils.js',
    'public/js/mdp.js',
    'public/js/vizWithAI.js',
    'public/js/rlAgent.js',
    'public/js/unifiedNodeGameExperiment.js',
    
    // NodeGame files (for reference)
    'public/js/nodeGameHumanAIVersion.js',
    'public/js/nodeGameHumanHumanVersion.js',
    'public/js/nodeGameHelpers.js',
    
    // Map data files
    'public/config/MapsFor1P1G.js',
    'public/config/MapsFor1P2G.js',
    'public/config/MapsFor2P2G.js',
    'public/config/MapsFor2P3G.js',
    
    // Server files
    'unifiedServer.js',
    'package.json'
];

let allGood = true;
let missingFiles = [];

console.log('📁 Checking required files...');
requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
        const stats = fs.statSync(fullPath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`   ✅ ${file} (${sizeKB}KB)`);
    } else {
        console.log(`   ❌ ${file} - MISSING!`);
        missingFiles.push(file);
        allGood = false;
    }
});

console.log('\n📋 Checking file contents...');

// Check if key variables are defined in setup.js
try {
    const setupContent = fs.readFileSync(path.join(__dirname, 'public/js/setup.js'), 'utf8');
    const hasDirections = setupContent.includes('const DIRECTIONS');
    const hasObject = setupContent.includes('const OBJECT');
    
    console.log(`   ${hasDirections ? '✅' : '❌'} DIRECTIONS defined in setup.js`);
    console.log(`   ${hasObject ? '✅' : '❌'} OBJECT defined in setup.js`);
    
    if (!hasDirections || !hasObject) allGood = false;
} catch (error) {
    console.log('   ❌ Could not read setup.js');
    allGood = false;
}

// Check if RLAgent is defined
try {
    const rlAgentContent = fs.readFileSync(path.join(__dirname, 'public/js/rlAgent.js'), 'utf8');
    const hasRLAgent = rlAgentContent.includes('window.RLAgent');
    
    console.log(`   ${hasRLAgent ? '✅' : '❌'} RLAgent defined in rlAgent.js`);
    
    if (!hasRLAgent) allGood = false;
} catch (error) {
    console.log('   ❌ Could not read rlAgent.js');
    allGood = false;
}

// Check map data files
const mapFiles = ['MapsFor1P1G', 'MapsFor1P2G', 'MapsFor2P2G', 'MapsFor2P3G'];
mapFiles.forEach(mapFile => {
    try {
        const mapContent = fs.readFileSync(path.join(__dirname, `public/config/${mapFile}.js`), 'utf8');
        const hasMapData = mapContent.includes(`var ${mapFile}`);
        
        console.log(`   ${hasMapData ? '✅' : '❌'} ${mapFile} data found`);
        
        if (!hasMapData) allGood = false;
    } catch (error) {
        console.log(`   ❌ Could not read ${mapFile}.js`);
        allGood = false;
    }
});

// Check configuration
try {
    const configContent = fs.readFileSync(path.join(__dirname, 'config/experimentConfig.js'), 'utf8');
    const hasConfig = configContent.includes('window.EXPERIMENT_CONFIG');
    
    console.log(`   ${hasConfig ? '✅' : '❌'} EXPERIMENT_CONFIG defined`);
    
    if (!hasConfig) allGood = false;
} catch (error) {
    console.log('   ❌ Could not read experimentConfig.js');
    allGood = false;
}

console.log('\n🎯 Summary:');
if (allGood) {
    console.log('   ✅ All files are present and properly configured!');
    console.log('\n🚀 Ready to start:');
    console.log('   1. Run: node unifiedServer.js');
    console.log('   2. Open: http://localhost:3000');
    console.log('   3. Test: http://localhost:3000/test-deps');
} else {
    console.log('   ❌ Setup is incomplete!');
    
    if (missingFiles.length > 0) {
        console.log('\n📋 Missing files:');
        missingFiles.forEach(file => {
            console.log(`   - ${file}`);
        });
    }
    
    console.log('\n🔧 To fix:');
    console.log('   1. Make sure you copied all files correctly');
    console.log('   2. Check the file paths and permissions');
    console.log('   3. Re-run this verification script');
}

console.log('\n📊 File count summary:');
console.log(`   Total required: ${requiredFiles.length}`);
console.log(`   Found: ${requiredFiles.length - missingFiles.length}`);
console.log(`   Missing: ${missingFiles.length}`);

process.exit(allGood ? 0 : 1);