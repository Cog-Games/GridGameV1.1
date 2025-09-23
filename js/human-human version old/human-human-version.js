/**
 * Human-Human Version - Main Entry Point (Refactored to match human-AI version)
 *
 * This file has been refactored to match the human-AI version's structure and flow exactly,
 * while implementing server-side features for multiplayer experiments.
 *
 * Key differences from human-AI version:
 * 1. Server-side map generation: Instead of generating maps client-side, the server generates
 *    and sends maps to both players to ensure synchronization
 * 2. Server-side new goal generation for 2P3G: The logic for when and where new goals appear should
 *    be handled server-side
 * 3. Real-time communication: The trial handlers need to properly use socket.io for real-time player
 *    coordination
 *
 * Dependencies:
 * - gameState.js - Base game state and data management (shared with human-AI)
 * - gameStateHumanHuman.js - Human-human specific game state extensions
 * - expTrialHumanHuman.js - Trial execution functions for human-human experiments
 * - networkingHumanHuman.js - Socket.io and multiplayer networking
 * - dataRecording.js - Data recording functions (shared with human-AI)
 * - expDesign.js - Experimental design and success threshold logic (shared with human-AI)
 * - gameHelpers.js - Game helper functions (shared with human-AI)
 * - expTimeline.js - Timeline management functions (shared with human-AI)
 * - viz.js - Visualization functions (shared with human-AI)
 * - All other existing dependencies (setup, etc.)
 */

// Make imported functions globally available for non-module scripts (same as human-AI version)
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

// Make timeline-related functions globally available (same as human-AI version)
window.addCollaborationExperimentStages = addCollaborationExperimentStages;
window.addTrialStages = addTrialStages;
// Use the shared nextStage from expTimeline.js instead of local one
window.nextStage = window.nextStage || nextStage;

/**
 * Initialize experiments (following human-AI pattern)
 */
function initializeNodeGameHumanHumanExperiments() {
    console.log('Initializing human-human experiments...');

    // Ensure required dependencies are available (same as human-AI)
    if (typeof DIRECTIONS === 'undefined' || typeof OBJECT === 'undefined') {
        console.error('Required game dependencies not loaded');
        return false;
    }

    // Check if map data is available (same as human-AI)
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

    // Initialize socket for multiplayer experiments (human-human specific)
    try {
        if (window.NetworkingHumanHuman && window.NetworkingHumanHuman.initializeSocket) {
            window.NetworkingHumanHuman.initializeSocket();
            console.log('Socket.io initialized for multiplayer experiments');
        } else {
            console.warn('NetworkingHumanHuman not available - single-player experiments will still work');
        }
    } catch (error) {
        console.warn('Could not initialize socket.io (single-player experiments will still work):', error);
    }

    console.log('Human-human experiments ready');
    return true;
}

/**
 * Start a specific experiment (following human-AI pattern)
 */
function startNodeGameHumanHumanExperiment(experimentType) {
    console.log('Starting experiment in human-human mode:', experimentType);
    startStandaloneExperiment();
}

/**
 * Start experiment in standalone mode (following human-AI pattern)
 */
function startStandaloneExperiment() {
    try {
        // Clear any existing content
        document.getElementById('container').innerHTML = '';

        // Reset experiment state for continuous experiments (same as human-AI)
        gameData.currentTrial = 0;
        gameData.allTrialsData = [];

        // Initialize success threshold tracking (same as human-AI)
        window.ExpDesign.initializeSuccessThresholdTracking();

        // Initialize timeline (same as human-AI)
        timeline.currentStage = 0;

        // Ensure trial handler is set up before creating timeline
        setupTrialHandlerIntegration();

        // Create timeline stages for human-human experiments (use dedicated function)
        createTimelineStagesHumanHuman();

        // Start timeline (same as human-AI)
        runNextStage();

    } catch (error) {
        console.error('Error starting experiment:', error);
    }
}

/**
 * Setup trial handler integration (called immediately, not in timeout)
 */
function setupTrialHandlerIntegration() {
    console.log('Setting up trial handler integration...');

    // Set the human-human trial handler for multiplayer detection
    window.runTrialStage = function(stage) {
        console.log('runTrialStage called with stage:', stage);

        // Ensure currentTrialData is initialized
        if (!gameData.currentTrialData) {
            console.warn('currentTrialData not initialized, creating empty object');
            gameData.currentTrialData = {};
        }

        // For multiplayer experiments (2P2G, 2P3G), use human-human handler
        if (stage.experimentType && stage.experimentType.includes('2P')) {
            // Check if human-human trial handler is available
            if (typeof window.TrialHandlersHumanHuman !== 'undefined' && window.TrialHandlersHumanHuman.runTrialStageHumanHuman) {
                return window.TrialHandlersHumanHuman.runTrialStageHumanHuman(stage);
            } else {
                console.warn('TrialHandlersHumanHuman not available, falling back to human-AI handler');
                if (window.TrialHandlers && window.TrialHandlers.runTrialStage) {
                    return window.TrialHandlers.runTrialStage(stage);
                }
            }
        } else {
            // For single-player experiments, use shared handler from expTrialHumanAI.js
            if (window.TrialHandlers && window.TrialHandlers.runTrialStage) {
                return window.TrialHandlers.runTrialStage(stage);
            }
        }

        console.error('No trial handler available for stage:', stage);
    };

    console.log('✅ Human-human trial handler integrated with shared timeline');
}

/**
 * Run the next stage in the timeline (same as human-AI)
 */
function runNextStage() {
    if (timeline.currentStage >= timeline.stages.length) {
        console.log('Timeline complete');
        return;
    }

    var stage = timeline.stages[timeline.currentStage];
    console.log('Running stage:', stage.type, 'Index:', timeline.currentStage);

    stage.handler(stage);
}

/**
 * Advance to the next stage (same as human-AI)
 */
function nextStage() {
    timeline.currentStage++;
    runNextStage();
}

/**
 * Check if should continue to next trial (wrapper function for compatibility)
 */
function shouldContinueToNextTrial(experimentType, trialIndex) {
    return window.ExpDesign.shouldContinueToNextTrial(experimentType, trialIndex);
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
        setTimeout(() => window.nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
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
    if (!window.NetworkingHumanHuman || !window.NetworkingHumanHuman.isGameActive()) {
        event.preventDefault();
        return;
    }

    // Check if my player has already reached a goal
    // My player position depends on whether I'm first or second player
    var myPlayerPosition;
    var myPlayerColor;
    if (window.playerOrder && window.playerOrder.isFirstPlayer) {
        myPlayerPosition = gameData.player1;
        myPlayerColor = 'RED';
    } else {
        myPlayerPosition = gameData.player2;
        myPlayerColor = 'ORANGE';
    }

    if (isGoalReached(myPlayerPosition, gameData.currentGoals)) {
        console.log(`🎮 My player (${myPlayerColor}) has reached goal, ignoring move`);
        event.preventDefault();
        return;
    }

    console.log(`🎮 Processing move for my player (${myPlayerColor}) at position:`, myPlayerPosition);

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
    console.log('🎨 gameData.gridMatrix:', gameData ? (gameData.gridMatrix ? `${gameData.gridMatrix.length}x${gameData.gridMatrix[0]?.length}` : 'null') : 'undefined');
    console.log('🎨 gameData.currentGoals:', gameData ? gameData.currentGoals : 'undefined');
    console.log('🎨 gameData.player1 position (should be red in viz):', gameData ? gameData.player1 : 'undefined');
    console.log('🎨 gameData.player2 position (should be orange in viz):', gameData ? gameData.player2 : 'undefined');
    console.log('🎨 playerOrder.isFirstPlayer:', window.playerOrder ? window.playerOrder.isFirstPlayer : 'undefined');

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

    // Look for the gameCanvas div element (created by runTrialStageMultiplayer)
    var gameCanvasDiv = document.getElementById('gameCanvas');
    console.log('🎨 gameCanvas div element found:', gameCanvasDiv);

    if (gameCanvasDiv) {
        // Check if there's already a canvas inside the div
        var existingCanvas = gameCanvasDiv.querySelector('canvas');
        console.log('🎨 Existing canvas found:', existingCanvas);

        if (!existingCanvas) {
            console.log('🎨 Creating new canvas...');
            console.log('🎨 createGameCanvas function available:', typeof createGameCanvas);
            var canvas = createGameCanvas();
            console.log('🎨 Canvas created:', canvas);
            console.log('🎨 Canvas ID:', canvas ? canvas.id : 'null');
            console.log('🎨 Canvas dimensions:', canvas ? canvas.width + 'x' + canvas.height : 'null');

            if (canvas) {
                // Clear the gameCanvas div and append the new canvas
                gameCanvasDiv.innerHTML = '';
                gameCanvasDiv.appendChild(canvas);
                console.log('🎨 Canvas appended to gameCanvas div');

                // Verify canvas is now in the DOM
                var verifyCanvas = gameCanvasDiv.querySelector('canvas');
                console.log('🎨 Canvas verification after append:', verifyCanvas);
            } else {
                console.error('🎨 Failed to create canvas!');
            }
        } else {
            console.log('🎨 Canvas already exists in gameCanvas div');
        }
    } else {
        console.error('🎨 gameCanvas div not found! Cannot setup visualization.');
        return;
    }

    // Update visualization
    console.log('🎨 Calling updateGameVisualization...');
    updateGameVisualization();
    console.log('🎨 updateGameVisualization completed');
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
 * Human-human specific stage functions
 * (most stages are handled by expTimeline.js)
 */

/**
 * Show game ready stage (transition from waiting to game) - human-human specific
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
        if (typeof window.nextStage === 'function') {
            console.log('Game ready stage complete, advancing to trial');
            window.nextStage();
        }
    }, 3000); // Show game ready for 3 seconds
}

// Global functions for easy access (following human-AI pattern)
window.NodeGameHumanHuman = {
    initialize: initializeNodeGameHumanHumanExperiments,
    start: startNodeGameHumanHumanExperiment,
    nextStage: nextStage,
};

// Use the shared showPostTrialStage from expTimeline.js instead of overriding it
// The shared implementation includes proper feedback overlays and timeline management
console.log('Using shared showPostTrialStage from expTimeline.js for consistent feedback');

// Make human-human specific stage functions available globally (no timeout needed for this)
window.showGameReadyStage = showGameReadyStage;  // This is unique to human-human

console.log('NodeGame Human-Human experiments integration complete');

// Don't auto-initialize - let the HTML file handle initialization
console.log('NodeGame Human-Human Full experiments module loaded (refactored)');
