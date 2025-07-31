/**
 * Human-Human Version - Main Entry Point (Refactored)
 *
 * This file has been refactored to use modular components.
 * Game state, trial handlers, networking, and data recording have been moved to separate modules.
 *
 * Dependencies:
 * - gameState.js - Base game state and data management
 * - gameStateHumanHuman.js - Human-human specific game state extensions
 * - expTrialHumanHuman.js - Trial execution functions for human-human experiments
 * - networkingHumanHuman.js - Socket.io and multiplayer networking
 * - dataRecording.js - Data recording functions
 * - expDesign.js - Experimental design and success threshold logic
 * - gameHelpers.js - Game helper functions
 * - expTimeline.js - Timeline management functions
 * - viz.js - Visualization functions
 * - All other existing dependencies (setup, etc.)
 */

// Import nodeGame if available
if (typeof node !== 'undefined') {
    var node = node;
} else if (typeof require !== 'undefined') {
    var node = require('nodegame-client');
}

// Make imported functions globally available for non-module scripts
window.setupGridMatrixForTrial = setupGridMatrixForTrial;
window.transition = transition;
window.isValidPosition = isValidPosition;
window.isGoalReached = isGoalReached;
window.whichGoalReached = whichGoalReached;
window.detectPlayerGoal = detectPlayerGoal;
window.getMapsForExperiment = getMapsForExperiment;
window.generateRandomizedDistanceSequence = generateRandomizedDistanceSequence;
window.generateRandomized1P2GDistanceSequence = generateRandomized1P2GDistanceSequence;
window.selectRandomMaps = selectRandomMaps;
window.getRandomMapForCollaborationGame = getRandomMapForCollaborationGame;

// Make timeline-related functions globally available
window.addCollaborationExperimentStages = addCollaborationExperimentStages;
window.nextStage = nextStage;

// Note: Human-human specific functions will be made available after the modules are loaded
// These assignments will be done at the end of the file

/**
 * Initialize human-human experiments
 */
function initializeNodeGameHumanHumanFullExperiments() {
    console.log('Initializing human-human experiments...');

    // Ensure required dependencies are available
    if (typeof DIRECTIONS === 'undefined' || typeof OBJECT === 'undefined') {
        console.error('Required game dependencies not loaded');
        return false;
    }

    // Check if map data is available
    console.log('Checking map data availability...');
    var mapDataAvailable = true;
    var requiredMaps = ['MapsFor1P1G', 'MapsFor1P2G', 'MapsFor2P2G', 'MapsFor2P3G'];

    requiredMaps.forEach(function(mapName) {
        if (typeof window[mapName] === 'undefined') {
            console.error(`Map data not available: ${mapName}`);
            mapDataAvailable = false;
        } else {
            console.log(`Map data available: ${mapName} (${Object.keys(window[mapName]).length} maps)`);
        }
    });

    if (!mapDataAvailable) {
        console.error('Some map data is not available');
        return false;
    }

    // Initialize socket for multiplayer experiments
    try {
        window.NetworkingHumanHuman.initializeSocket();
        console.log('Socket.io initialized for multiplayer experiments');
    } catch (error) {
        console.warn('Could not initialize socket.io (single-player experiments will still work):', error);
    }

    console.log('Human-human experiments ready');
    return true;
}

/**
 * Start a specific human-human experiment
 */
function startNodeGameHumanHumanExperiment(experimentType) {
    console.log('Starting human-human experiment:', experimentType);

    // Check if this is a multiplayer experiment
    if (experimentType.includes('2P')) {
        console.log('Starting multiplayer experiment:', experimentType);

        // For multiplayer experiments, ensure socket is initialized and attempt connection
        if (!window.NetworkingHumanHuman.getSocket()) {
            console.log('Socket not initialized, initializing now...');
            window.NetworkingHumanHuman.initializeSocket();
        }

        // Start multiplayer experiment (it will handle connection waiting)
        startMultiplayerExperiment(experimentType);
    } else {
        // For single-player experiments, use standalone mode
        console.log('Starting single-player experiment:', experimentType);
        startStandaloneExperiment(experimentType);
    }
}

/**
 * Start experiment in standalone mode (single-player)
 */
function startStandaloneExperiment(experimentType) {
    try {
        // Clear any existing content
        document.getElementById('container').innerHTML = '';

        // Reset experiment state
        gameData.currentTrial = 0;
        gameData.allTrialsData = [];

        // Initialize success threshold tracking
        window.ExpDesign.initializeSuccessThresholdTracking();

        // Initialize timeline
        timeline.currentStage = 0;

        // Create timeline stages for the experiment
        createTimelineStagesHumanHuman(experimentType);

        // Start timeline
        runNextStage();

    } catch (error) {
        console.error('Error starting standalone experiment:', error);
    }
}

/**
 * Start experiment in multiplayer mode
 */
function startMultiplayerExperiment(experimentType) {
    try {
        // Clear any existing content
        document.getElementById('container').innerHTML = '';

        // Show connecting message
        document.getElementById('container').innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center; max-width: 600px; padding: 20px;">
                    <h2 style="color: #007bff; margin-bottom: 20px;">Connecting to Server</h2>
                    <p style="font-size: 18px; margin-bottom: 15px;">
                        Establishing connection for multiplayer experiment...
                    </p>
                    <div style="margin: 20px 0;">
                        <div style="border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                </div>
            </div>
            <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            </style>
        `;

        // Reset experiment state
        window.GameStateHumanHuman.resetExperimentData();

        // Set current experiment
        gameData.currentExperiment = experimentType;

        // Initialize success threshold tracking
        window.ExpDesign.initializeSuccessThresholdTracking();

        // Initialize timeline
        timeline.currentStage = 0;

        // Create timeline stages for multiplayer experiment
        createTimelineStagesHumanHuman(experimentType);

        // Start timeline immediately - the waiting stage will handle connection
        runNextStage();

    } catch (error) {
        console.error('Error starting multiplayer experiment:', error);
        window.NetworkingHumanHuman.showErrorMessage('Failed to start experiment: ' + error.message);
    }
}



/**
 * Create timeline stages for the experiment
 */
function createTimelineStagesHumanHuman(experimentType) {
    // Create proper timeline matching human-AI version structure
    timeline.stages = [];
    timeline.mapData = {};

    console.log('Creating timeline stages for human-human experiment:', experimentType);

    // Set up map data for the experiment (select random maps like human-AI version)
    var numTrials = NODEGAME_CONFIG.numTrials[experimentType];
    if (experimentType === '2P2G' && typeof MapsFor2P2G !== 'undefined') {
        var maps = Object.values(MapsFor2P2G);
        timeline.mapData['2P2G'] = window.selectRandomMaps ? window.selectRandomMaps(maps, numTrials) : maps.slice(0, numTrials);
    } else if (experimentType === '2P3G' && typeof MapsFor2P3G !== 'undefined') {
        var maps = Object.values(MapsFor2P3G);
        timeline.mapData['2P3G'] = window.selectRandomMaps ? window.selectRandomMaps(maps, numTrials) : maps.slice(0, numTrials);
    } else if (experimentType === '1P1G' && typeof MapsFor1P1G !== 'undefined') {
        var maps = Object.values(MapsFor1P1G);
        timeline.mapData['1P1G'] = window.selectRandomMaps ? window.selectRandomMaps(maps, numTrials) : maps.slice(0, numTrials);
    } else if (experimentType === '1P2G' && typeof MapsFor1P2G !== 'undefined') {
        var maps = Object.values(MapsFor1P2G);
        timeline.mapData['1P2G'] = window.selectRandomMaps ? window.selectRandomMaps(maps, numTrials) : maps.slice(0, numTrials);
    }

    // Add instructions stage (like human-AI version)
    timeline.stages.push({
        type: 'instructions',
        experimentType: experimentType,
        experimentIndex: 0,
        handler: showInstructionsStage
    });

    // Add waiting for partner stage for multiplayer experiments
    if (experimentType.includes('2P')) {
        timeline.stages.push({
            type: 'waiting_for_partner',
            experimentType: experimentType,
            experimentIndex: 0,
            handler: showWaitingForPartnerStage
        });

        // Add game ready stage (transition from waiting to game)
        timeline.stages.push({
            type: 'game_ready',
            experimentType: experimentType,
            experimentIndex: 0,
            handler: showGameReadyStage
        });
    }

    // For collaboration games, create stages dynamically based on success threshold
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        // Add a single trial stage that will be repeated dynamically
        addCollaborationExperimentStages(experimentType, 0, 0);
    } else {
        // Add trial stages for this experiment (fixed number)
        for (var i = 0; i < numTrials; i++) {
            addTrialStages(experimentType, 0, i);
        }
    }

    // Add completion stage
    timeline.stages.push({
        type: 'completion',
        handler: showCompletionStage
    });

    console.log('Timeline created with', timeline.stages.length, 'stages');
    console.log('Map data loaded:', Object.keys(timeline.mapData));
    console.log('Number of trials configured:', numTrials);
}

/**
 * Run the next stage in the timeline
 */
function runNextStage() {
    if (timeline.currentStage >= timeline.stages.length) {
        console.log('Timeline complete');
        return;
    }

    var stage = timeline.stages[timeline.currentStage];
    console.log('Running stage:', stage.type, 'Index:', timeline.currentStage);

    // Use the appropriate stage handler
    if (stage.handler) {
        stage.handler(stage);
    } else {
        console.error('No handler found for stage:', stage.type);
        nextStage(); // Skip to next stage
    }
}

/**
 * Advance to the next stage
 */
function nextStage() {
    timeline.currentStage++;
    runNextStage();
}

/**
 * Setup keyboard controls
 */
function setupKeyboardControls() {
    // Remove any existing listeners
    cleanupKeyboardControls();

    document.addEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = true;
    document.body.focus();
}

/**
 * Cleanup keyboard controls
 */
function cleanupKeyboardControls() {
    if (timeline.keyListenerActive) {
        document.removeEventListener('keydown', handleKeyPress);
        timeline.keyListenerActive = false;
    }
}

/**
 * Handle key press events
 */
function handleKeyPress(event) {
    if (timeline.isMoving) {
        event.preventDefault();
        return; // Prevent multiple moves
    }

    var key = event.code;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    // Check if this is a multiplayer experiment
    if (gameData.currentExperiment && gameData.currentExperiment.includes('2P')) {
        handleMultiplayerKeyPress(event);
    } else {
        handleSinglePlayerKeyPress(event);
    }
}

/**
 * Handle single-player key press
 */
function handleSinglePlayerKeyPress(event) {
    // Check if player has already reached a goal
    if (isGoalReached(gameData.player1, gameData.currentGoals)) {
        event.preventDefault();
        return;
    }

    timeline.isMoving = true;
    event.preventDefault();
    event.stopPropagation();

    var direction = event.code.toLowerCase();
    var aimAction = DIRECTIONS[direction].movement;

    // Record move
    window.GameStateHumanHuman.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

    // Execute move
    var realAction = isValidMove(gameData.gridMatrix, gameData.player1, aimAction);
    var nextState = transition(gameData.player1, realAction);

    // Update grid and player position
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.player1[0], gameData.player1[1], OBJECT.blank);
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
    gameData.player1 = nextState;

    gameData.stepCount++;
    updateGameVisualization();

    // Check win condition
    if (isGoalReached(gameData.player1, gameData.currentGoals)) {
        var finalGoal = whichGoalReached(gameData.player1, gameData.currentGoals);
        gameData.currentTrialData.player1FinalReachedGoal = finalGoal;

        cleanupKeyboardControls();
        window.GameStateHumanHuman.finalizeTrial(true);
        setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
    }

    // Reset movement flag
    setTimeout(() => {
        timeline.isMoving = false;
    }, 100);
}

/**
 * Handle multiplayer key press
 */
function handleMultiplayerKeyPress(event) {
    // Check if game is active
    if (!window.NetworkingHumanHuman.isGameActive()) {
        event.preventDefault();
        return;
    }

    // Check if my player has already reached a goal
    // In multiplayer, my player is always gameData.player1
    if (isGoalReached(gameData.player1, gameData.currentGoals)) {
        console.log('🎮 My player (RED) has reached goal, ignoring move');
        event.preventDefault();
        return;
    }

    console.log('🎮 Processing move for my player (RED) at position:', gameData.player1);

    timeline.isMoving = true;
    event.preventDefault();
    event.stopPropagation();

    var direction = event.code.toLowerCase();
    var aimAction = DIRECTIONS[direction].movement;

    // Record move locally (my player is always player1)
    window.GameStateHumanHuman.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

    // Send move to server
    window.NetworkingHumanHuman.makeMultiplayerMove(aimAction);

    // Reset movement flag
    setTimeout(() => {
        timeline.isMoving = false;
    }, 100);
}

/**
 * Update game visualization
 */
function updateGameVisualization() {
    console.log('🎨 updateGameVisualization called');
    console.log('🎨 gameData available:', typeof gameData !== 'undefined');
    console.log('🎨 gameData.gridMatrix:', gameData ? gameData.gridMatrix : 'undefined');
    console.log('🎨 gameData.currentGoals:', gameData ? gameData.currentGoals : 'undefined');

    // Use existing visualization functions
    if (typeof updateGameDisplay === 'function') {
        console.log('🎨 Using updateGameDisplay function');
        updateGameDisplay();
    } else if (typeof nodeGameUpdateGameDisplay === 'function') {
        console.log('🎨 Using nodeGameUpdateGameDisplay function');
        nodeGameUpdateGameDisplay();
    } else if (typeof drawGrid === 'function') {
        console.log('🎨 Using drawGrid function directly');
        var canvas = document.querySelector('canvas') || document.getElementById('gameCanvas');
        console.log('🎨 Canvas found for drawGrid:', canvas);
        if (canvas && gameData.currentGoals) {
            console.log('🎨 Calling drawGrid with canvas and goals');
            drawGrid(canvas, gameData.currentGoals);
        } else {
            console.error('🎨 Canvas or goals not available for drawGrid');
            console.log('🎨 Canvas:', canvas);
            console.log('🎨 gameData.currentGoals:', gameData.currentGoals);
        }
    } else {
        console.error('🎨 No visualization function available');
        console.log('🎨 Available functions:', {
            updateGameDisplay: typeof updateGameDisplay,
            nodeGameUpdateGameDisplay: typeof nodeGameUpdateGameDisplay,
            drawGrid: typeof drawGrid
        });
    }
}

/**
 * Setup trial visualization
 */
function setupTrialVisualization(experimentType) {
    console.log('🎨 setupTrialVisualization called for:', experimentType);

    // Create game canvas if it doesn't exist
    var gameCanvas = document.getElementById('gameCanvas');
    console.log('🎨 gameCanvas element found:', gameCanvas);

    if (!gameCanvas) {
        console.log('🎨 Creating new canvas...');
        console.log('🎨 createGameCanvas function available:', typeof createGameCanvas);
        var canvas = createGameCanvas();
        console.log('🎨 Canvas created:', canvas);
        console.log('🎨 Canvas ID:', canvas ? canvas.id : 'null');
        console.log('🎨 Canvas dimensions:', canvas ? canvas.width + 'x' + canvas.height : 'null');

        var container = document.getElementById('container');
        console.log('🎨 Container found:', container);
        if (container) {
            container.appendChild(canvas);
            console.log('🎨 Canvas appended to container');

            // Verify canvas is now in the DOM
            var verifyCanvas = document.getElementById('gameCanvas');
            console.log('🎨 Canvas verification after append:', verifyCanvas);
        } else {
            console.error('🎨 Container not found!');
        }
    } else {
        console.log('🎨 gameCanvas already exists');
    }

    // Update visualization
    console.log('🎨 Calling updateGameVisualization...');
    updateGameVisualization();
    console.log('🎨 updateGameVisualization completed');
}

/**
 * Check if should continue to next trial (wrapper function for compatibility)
 */
function shouldContinueToNextTrial(experimentType, trialIndex) {
    return window.ExpDesign.shouldContinueToNextTrial(experimentType, trialIndex);
}

/**
 * Download experiment data
 */
function downloadExperimentData() {
    try {
        var dataToSave = window.GameStateHumanHuman.saveExperimentData();

        // Convert to JSON string
        var dataStr = JSON.stringify(dataToSave, null, 2);

        // Create blob and download
        var dataBlob = new Blob([dataStr], {type: 'application/json'});
        var url = URL.createObjectURL(dataBlob);
        var link = document.createElement('a');
        link.href = url;
        link.download = `human-human-experiment-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        URL.revokeObjectURL(url);

        console.log('Experiment data downloaded successfully');
    } catch (error) {
        console.error('Error downloading experiment data:', error);
    }
}

/**
 * Show game ready stage (transition from waiting to game)
 */
function showGameReadyStage(stage) {
    console.log('Showing game ready stage');

    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">🎮 Game Ready!</h1>

                <div style="margin: 40px 0;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🎯</div>
                </div>

                <div style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    <p>Both players are connected and ready!</p>
                    <p>The game will start in a few seconds...</p>
                </div>

                <div id="gameReadyStatus" style="font-size: 16px; color: #28a745; margin-bottom: 30px;">
                    Preparing game board...
                </div>

                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        <strong>Instructions:</strong> Use arrow keys to move your player (red dot) to reach the same goal as your partner.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Auto-advance to trial stage after showing game ready
    setTimeout(() => {
        if (typeof nextStage === 'function') {
            console.log('Game ready stage complete, advancing to trial');
            nextStage();
        }
    }, 3000); // Show game ready for 3 seconds
}

// Global functions for easy access
window.NodeGameHumanHumanFull = {
    initialize: initializeNodeGameHumanHumanFullExperiments,
    start: startNodeGameHumanHumanExperiment,
    downloadExperimentData: downloadExperimentData,

    // Utility functions
    setupKeyboardControls: setupKeyboardControls,
    cleanupKeyboardControls: cleanupKeyboardControls,
    updateGameVisualization: updateGameVisualization,
    setupTrialVisualization: setupTrialVisualization
};

// Make human-human specific functions available after modules are loaded
// Use a timeout to ensure all scripts are loaded
setTimeout(() => {
    if (typeof window.GameStateHumanHuman !== 'undefined') {
        window.initializeTrialData = window.GameStateHumanHuman.initializeTrialData;
        window.recordPlayerMove = window.GameStateHumanHuman.recordPlayerMove;
        window.recordPartnerMove = window.GameStateHumanHuman.recordPartnerMove;
        window.finalizeTrial = window.GameStateHumanHuman.finalizeTrial;
        window.resetExperimentData = window.GameStateHumanHuman.resetExperimentData;
        window.saveExperimentData = window.GameStateHumanHuman.saveExperimentData;
        console.log('✅ GameStateHumanHuman functions assigned');
    } else {
        console.log('❌ GameStateHumanHuman not available');
    }

    if (typeof window.NetworkingHumanHuman !== 'undefined') {
        window.initializeSocket = window.NetworkingHumanHuman.initializeSocket;
        window.joinMultiplayerRoom = window.NetworkingHumanHuman.joinMultiplayerRoom;
        window.startMultiplayerTrial = window.NetworkingHumanHuman.startMultiplayerTrial;
        window.makeMultiplayerMove = window.NetworkingHumanHuman.makeMultiplayerMove;
        console.log('✅ NetworkingHumanHuman functions assigned');
    } else {
        console.log('❌ NetworkingHumanHuman not available');
    }

    if (typeof window.TrialHandlersHumanHuman !== 'undefined') {
        window.runTrialStage = window.TrialHandlersHumanHuman.runTrialStageMultiplayer;
        window.runSinglePlayerTrial = window.TrialHandlersHumanHuman.runSinglePlayerTrial;
        window.runMultiplayerTrial = window.TrialHandlersHumanHuman.runMultiplayerTrial;
        console.log('✅ TrialHandlersHumanHuman functions assigned');
    } else {
        console.log('❌ TrialHandlersHumanHuman not available');
    }

    // Debug: Check what's available
    console.log('🔍 Debug - Available objects after timeout:');
    console.log('  - GameStateHumanHuman:', typeof window.GameStateHumanHuman);
    console.log('  - NetworkingHumanHuman:', typeof window.NetworkingHumanHuman);
    console.log('  - TrialHandlersHumanHuman:', typeof window.TrialHandlersHumanHuman);
    console.log('  - NodeGameHumanHumanFull:', typeof window.NodeGameHumanHumanFull);
}, 100); // 100ms delay to ensure all scripts are loaded

// Don't auto-initialize - let the HTML file handle initialization
console.log('NodeGame Human-Human Full experiments module loaded (refactored)');
