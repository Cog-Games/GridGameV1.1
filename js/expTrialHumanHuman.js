/**
 * Trial Handlers Module for Human-Human Experiments
 *
 * Contains all trial execution functions for different human-human experiment types.
 * Extracted from human-human-version.js for better organization.
 */

// Global interval tracking to prevent multiplayer timeout issues
let gameIntervals = {
    gameLoopInterval: null,
    aiMoveInterval: null,
    trialTimeoutId: null
};

/**
 * Clear all game intervals to prevent interference between trials
 * This fixes the "time up before players can move" issue
 */
function clearAllGameIntervals() {
    console.log('🧹 Clearing all game intervals to prevent conflicts');

    // Clear any gameLoopInterval (from single-player trials)
    if (window.gameLoopInterval) {
        clearInterval(window.gameLoopInterval);
        window.gameLoopInterval = null;
        console.log('  ✅ Cleared global gameLoopInterval');
    }

    // Clear tracked intervals
    Object.keys(gameIntervals).forEach(key => {
        if (gameIntervals[key]) {
            if (key.includes('Interval')) {
                clearInterval(gameIntervals[key]);
            } else if (key.includes('Timeout')) {
                clearTimeout(gameIntervals[key]);
            }
            gameIntervals[key] = null;
            console.log(`  ✅ Cleared ${key}`);
        }
    });

    // Clear any trial timeout
    if (gameData.trialTimeoutId) {
        clearTimeout(gameData.trialTimeoutId);
        gameData.trialTimeoutId = null;
        console.log('  ✅ Cleared gameData.trialTimeoutId');
    }

    console.log('🎮 All game intervals cleared - ready for clean multiplayer start');
}

// Make function globally available
window.clearAllGameIntervals = clearAllGameIntervals;

/**
 * Update player color indicator based on player order
 */
function updatePlayerColorIndicator() {
    const colorIndicator = document.getElementById('playerColorIndicator');
    if (colorIndicator && window.playerOrder && window.playerOrder.isFirstPlayer !== undefined) {
        const playerColor = window.playerOrder.isFirstPlayer ? 'red' : 'orange';
        colorIndicator.style.backgroundColor = playerColor;
        console.log('🎨 Updated player color indicator to:', playerColor);
        console.log('  - playerOrder.isFirstPlayer:', window.playerOrder.isFirstPlayer);
    } else {
        console.log('🎨 Could not update player color indicator:', {
            colorIndicator: !!colorIndicator,
            playerOrder: !!window.playerOrder,
            isFirstPlayer: window.playerOrder ? window.playerOrder.isFirstPlayer : 'undefined'
        });
    }
}

// Make function globally accessible
window.updatePlayerColorIndicator = updatePlayerColorIndicator;

/**
 * Run trial stage (main game for human-human, with multiplayer detection)
 */
function runTrialStageHumanHuman(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Set current experiment type
    gameData.currentExperiment = experimentType;

    console.log('🎮 runTrialStageHumanHuman called with:', {
        trialIndex: trialIndex,
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        stage: stage
    });

    // For collaboration games, show dynamic trial count
    var trialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        trialCountDisplay = `Round ${trialIndex + 1}`;
    } else {
        trialCountDisplay = `Round ${trialIndex + 1}`;
    }

    // Determine player color for display - must match actual game state
    let playerColor = 'red'; // Default to red

    // For multiplayer games, check playerOrder to show correct color
    if (experimentType.includes('2P') && window.playerOrder && typeof window.playerOrder.isFirstPlayer !== 'undefined') {
        // IMPORTANT: The color shown to user should match the VISUAL player they control
        // In the visualization, red player is always rendered first, orange second
        // But the user might be controlling either the red or orange player visually

        // The correct approach: Show the color of the player the user actually controls
        playerColor = window.playerOrder.isFirstPlayer ? 'red' : 'orange';

        console.log('🎨 PLAYER COLOR ASSIGNMENT DEBUG:');
        console.log('  - My player ID:', typeof window.myPlayerId !== 'undefined' ? window.myPlayerId : 'undefined');
        console.log('  - playerOrder.firstPlayerId:', window.playerOrder.firstPlayerId);
        console.log('  - playerOrder.secondPlayerId:', window.playerOrder.secondPlayerId);
        console.log('  - playerOrder.isFirstPlayer:', window.playerOrder.isFirstPlayer);
        console.log('  - Assigned display color:', playerColor);
        console.log('  - gameData.player1 (red in viz):', typeof gameData !== 'undefined' ? gameData.player1 : 'undefined');
        console.log('  - gameData.player2 (orange in viz):', typeof gameData !== 'undefined' ? gameData.player2 : 'undefined');
    } else {
        // For single-player or when playerOrder not available, always use red
        console.log('🎨 Using default red color (single-player or playerOrder not available)');
        console.log('  - playerOrder available:', !!window.playerOrder);
        console.log('  - isFirstPlayer defined:', window.playerOrder ? typeof window.playerOrder.isFirstPlayer : 'N/A');
    }

    console.log('🎨 Player color assignment for display:');
    console.log('  - playerOrder object:', window.playerOrder);
    console.log('  - playerOrder.isFirstPlayer:', window.playerOrder ? window.playerOrder.isFirstPlayer : 'undefined');
    console.log('  - playerOrder.firstPlayerId:', window.playerOrder ? window.playerOrder.firstPlayerId : 'undefined');
    console.log('  - playerOrder.secondPlayerId:', window.playerOrder ? window.playerOrder.secondPlayerId : 'undefined');
    console.log('  - Display color:', playerColor);
    console.log('  - window.myPlayerId (if exists):', typeof window.myPlayerId !== 'undefined' ? window.myPlayerId : 'undefined');

    // Additional debugging for player order
    if (window.playerOrder && window.myPlayerId) {
        console.log('  - My player ID matches firstPlayerId:', window.myPlayerId === window.playerOrder.firstPlayerId);
        console.log('  - My player ID matches secondPlayerId:', window.myPlayerId === window.playerOrder.secondPlayerId);
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Game ${experimentIndex + 1}</h3>
                <h4 style="margin-bottom: 20px;">${trialCountDisplay}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span id="playerColorIndicator" style="display: inline-block; width: 18px; height: 18px; background-color: ${playerColor}; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
                <div id="statusMessage" style="margin-top: 20px; font-size: 18px; min-height: 30px;"></div>
            </div>
        </div>
    `;

    // Create and draw canvas
    var canvas = createGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);

    // Get the appropriate design for this trial
    var design = getRandomMapForCollaborationGame(experimentType, trialIndex);

    // Check if design is valid
    if (!design) {
        console.error('Failed to get valid design for trial:', trialIndex, 'experiment:', experimentType);

        // Create a fallback design
        console.log('Creating fallback design for', experimentType);
        var fallbackDesign = window.GameState.createFallbackDesign(experimentType);

        if (fallbackDesign) {
            console.log('Using fallback design:', fallbackDesign);
            design = fallbackDesign;
        } else {
            // Skip this trial and move to next stage
            console.error('No fallback design available, skipping trial');
            setTimeout(() => nextStage(), 1000);
            return;
        }
    }

    // Initialize trial data using shared function
    window.GameState.initializeTrialData(trialIndex, experimentType);

    // Ensure trial data is properly initialized for human-human experiments
    if (!gameData.currentTrialData) {
        console.log('🔄 Creating trial data for human-human experiment');
        gameData.currentTrialData = {
            trialStartTime: Date.now(),
            player1Actions: [],
            player1RT: [],
            player1Trajectory: [],
            player1FinalReachedGoal: null,
            stepCount: 0,
            completed: false
        };
    }

    // Run the appropriate experiment
    runExperimentTrialHumanHuman(experimentType, trialIndex, design);
}

/**
 * Run experiment trial based on type (following human-AI pattern)
 */
function runExperimentTrialHumanHuman(experimentType, trialIndex, design) {
    gameData.stepCount = 0;
    gameData.gameStartTime = Date.now();
    timeline.isMoving = false;

    // For collaboration games, use random maps after trial x, but only if available
    var trialDesign = design;
    if (experimentType.includes('2P')) {
        var randomDesign = getRandomMapForCollaborationGame(experimentType, trialIndex);
        if (randomDesign) {
            trialDesign = randomDesign;
        }
    }

    // For multiplayer experiments, don't setup grid matrix locally - wait for server
    if (experimentType.includes('2P')) {
        console.log('🎮 Multiplayer experiment - waiting for server to provide synchronized game state');
        // Don't call setupGridMatrixForTrial here - server will provide the state
        // Don't call updateGameVisualization here - wait for server game state
    } else {
        // For single-player experiments, setup grid matrix locally
        setupGridMatrixForTrial(trialDesign, experimentType);
        updateGameVisualization();
    }

    // Start appropriate experiment
    switch(experimentType) {
        case '1P1G':
            runTrial1P1GHumanHuman();
            break;
        case '1P2G':
            runTrial1P2GHumanHuman();
            break;
        case '2P2G':
            runTrial2P2GHumanHuman(trialIndex, trialDesign);
            break;
        case '2P3G':
            runTrial2P3GHumanHuman(trialIndex, trialDesign);
            break;
    }
}

/**
 * Run 1P1G trial (same as human-AI version)
 */
function runTrial1P1GHumanHuman() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if player1 has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;

        // Prevent default browser behavior for arrow keys and prevent key repeat
        event.preventDefault();
        event.stopPropagation();

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move using shared function
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.player1, aimAction);
        var nextState = transition(gameData.player1, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.player1[0], gameData.player1[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.player1 = nextState;

        gameData.stepCount++;
        updateGameVisualization();

        // Check win condition
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            var finalGoal = whichGoalReached(gameData.player1, gameData.currentGoals);
            gameData.currentTrialData.player1FinalReachedGoal = finalGoal;
            console.log(`Player1 final reached goal: ${finalGoal}`);

            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay);
    }

    // Set up controls
    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

/**
 * Run 1P2G trial (same as human-AI version)
 */
function runTrial1P2GHumanHuman() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if player1 has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;

        // Prevent default browser behavior for arrow keys and prevent key repeat
        event.preventDefault();
        event.stopPropagation();

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move using shared function
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.player1, aimAction);
        var nextState = transition(gameData.player1, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.player1[0], gameData.player1[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.player1 = nextState;

        // Detect player goal with history tracking (similar to 2P3G)
        var player1CurrentGoal = detectPlayerGoal(gameData.player1, aimAction, gameData.currentGoals, gameData.currentTrialData.player1CurrentGoal);
        gameData.currentTrialData.player1CurrentGoal.push(player1CurrentGoal);

        // Record first detected goal
        if (player1CurrentGoal !== null && gameData.currentTrialData.player1FirstDetectedGoal === null) {
            gameData.currentTrialData.player1FirstDetectedGoal = player1CurrentGoal;
            console.log(`Player1 first detected goal: ${player1CurrentGoal}`);
        }

        gameData.stepCount++;
        updateGameVisualization();

        // Check for new goal presentation based on distance condition (similar to 2P3G logic)
        window.ExpDesign.checkNewGoalPresentation1P2G();

        // Check win condition
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            var finalGoal = whichGoalReached(gameData.player1, gameData.currentGoals);
            gameData.currentTrialData.player1FinalReachedGoal = finalGoal;
            console.log(`Player1 final reached goal: ${finalGoal}`);

            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay);
    }

    // Set up controls
    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

/**
 * Run 2P2G trial (human-human multiplayer with socket.io and server-side map generation)
 */
function runTrial2P2GHumanHuman(trialIndex, trialDesign) {
    console.log('Starting 2P2G human-human multiplayer trial:', {trialIndex, trialDesign});

    // Check if socket.io is available
    if (typeof io === 'undefined' || !window.NetworkingHumanHuman) {
        console.log('Socket.io not available - falling back to human-AI version');
        if (window.TrialHandlers && window.TrialHandlers.runTrial2P2G) {
            return window.TrialHandlers.runTrial2P2G();
        } else {
            console.error('No fallback trial handler available');
            return;
        }
    }

    // Get socket connection
    const socket = window.NetworkingHumanHuman.getSocket();
    if (!socket || !socket.connected) {
        console.error('Socket not connected for 2P2G trial');
        return;
    }

    // Clear any existing callbacks to prevent conflicts
    window.NetworkingHumanHuman.clearAllCallbacks();

    // Set up socket event handlers for 2P2G game
    setupSocketHandlers2P2G();

    // Initialize trial data (basic structure - server will provide game state)
    gameData.stepCount = 0;
    gameData.gameStartTime = Date.now();
    timeline.isMoving = false;

    // Ensure currentTrialData is initialized before starting multiplayer
    if (!gameData.currentTrialData) {
        console.log('Initializing trial data for 2P2G multiplayer');
        window.GameState.initializeTrialData(trialIndex || gameData.currentTrial || 0, '2P2G');
    }

    // CRITICAL: Store trial design for server-side map generation
    console.log('🗺️ Setting trial design for server-side map generation:', trialDesign);
    gameData.pendingTrialDesign = trialDesign;
    gameData.pendingTrialIndex = trialIndex;

    // Small delay to ensure design is set before room operations
    setTimeout(() => {
        // Join multiplayer room - server will handle map generation and synchronization
        window.NetworkingHumanHuman.joinMultiplayerRoom();
        console.log('2P2G trial setup complete, waiting for server to start game...');
    }, 100);
}

/**
 * Setup socket event handlers for 2P2G game
 * REMOVED: Duplicate socket handlers to prevent race conditions
 * Now using centralized handlers from networkingHumanHuman.js
 */
function setupSocketHandlers2P2G() {
    console.log('🔧 Setting up 2P2G-specific callbacks (using centralized socket handlers)');

    // Register 2P2G-specific callbacks with the networking module
    // This prevents duplicate event handlers and race conditions
    window.NetworkingHumanHuman.registerGameStartedCallback(handleServerGameStart2P2G);
    window.NetworkingHumanHuman.registerMoveCallback(handleServerMoveUpdate2P2G);
    window.NetworkingHumanHuman.registerTrialCompleteCallback(handleServerTrialComplete2P2G);

    console.log('✅ 2P2G callbacks registered with centralized networking module');
}

/**
 * Handle game start from server for 2P2G
 */
function handleServerGameStart2P2G(serverData) {
    console.log('🎮 Handling 2P2G game start from server:', serverData);

    // CRITICAL: Validate server data before using it
    if (!serverData) {
        console.error('❌ No server data received for game start');
        return;
    }

    if (!serverData.gameState) {
        console.error('❌ No game state in server data');
        return;
    }

    const gameState = serverData.gameState;

    // Validate essential game state components
    if (!gameState.gridMatrix || !Array.isArray(gameState.gridMatrix)) {
        console.error('❌ Invalid or missing grid matrix in server game state');
        return;
    }

    if (!gameState.goals || !Array.isArray(gameState.goals) || gameState.goals.length === 0) {
        console.error('❌ Invalid or missing goals in server game state');
        return;
    }

    if (!gameState.players || Object.keys(gameState.players).length < 2) {
        console.error('❌ Invalid or insufficient players in server game state');
        return;
    }

    // Server provides the complete game state including map
    gameData.gridMatrix = gameState.gridMatrix;
    gameData.currentGoals = gameState.goals;

    // CRITICAL: Proper player position mapping based on player order
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length >= 2) {
        const myPlayerId = window.NetworkingHumanHuman.getMyPlayerId();
        const partnerPlayerId = window.NetworkingHumanHuman.getPartnerPlayerId();

        console.log('🔄 PLAYER MAPPING DEBUG:');
        console.log('  - My player ID:', myPlayerId);
        console.log('  - Partner player ID:', partnerPlayerId);
        console.log('  - Server players:', playerIds);
        console.log('  - Player order (if available):', serverData.playerOrder);

        // Use player order to determine visual mapping (who is red vs orange)
        if (serverData.playerOrder) {
            // Server provides explicit player order - use it
            const firstPlayerId = serverData.playerOrder.firstPlayerId;
            const secondPlayerId = serverData.playerOrder.secondPlayerId;

            gameData.player1 = gameState.players[firstPlayerId]?.position || [0, 0];
            gameData.player2 = gameState.players[secondPlayerId]?.position || [0, 0];

            console.log('✅ Using server player order mapping:');
            console.log('  - player1 (red):', firstPlayerId, 'at', gameData.player1);
            console.log('  - player2 (orange):', secondPlayerId, 'at', gameData.player2);
        } else {
            // Fallback: use consistent ordering based on socket IDs
            // This ensures both clients have the same visual representation
            const sortedPlayerIds = playerIds.sort();
            gameData.player1 = gameState.players[sortedPlayerIds[0]]?.position || [0, 0];
            gameData.player2 = gameState.players[sortedPlayerIds[1]]?.position || [0, 0];

            console.log('⚠️ Using fallback alphabetical order mapping:');
            console.log('  - player1 (red):', sortedPlayerIds[0], 'at', gameData.player1);
            console.log('  - player2 (orange):', sortedPlayerIds[1], 'at', gameData.player2);
        }
    } else {
        console.error('❌ Not enough players in game state');
        return;
    }

        // CRITICAL: Don't use server stepCount for client timing - keep our reset value
    console.log('🔄 Server provided stepCount:', gameState.stepCount, '- keeping client stepCount at:', gameData.stepCount);
    // gameData.stepCount = gameState.stepCount || 0;  // Commented out to prevent immediate timeout

    console.log('✅ 2P2G game state synchronized with server');
    console.log('Grid matrix size:', gameData.gridMatrix?.length + 'x' + gameData.gridMatrix?.[0]?.length);
    console.log('Goals:', gameData.currentGoals);
    console.log('Player positions:', {player1: gameData.player1, player2: gameData.player2});

    // Update player order from server
    if (serverData.playerOrder) {
        window.playerOrder = {
            firstPlayerId: serverData.playerOrder.firstPlayerId,
            secondPlayerId: serverData.playerOrder.secondPlayerId,
            isFirstPlayer: window.myPlayerId === serverData.playerOrder.firstPlayerId
        };
        console.log('✅ Player order set:', window.playerOrder);
    }

    // Update visualization with server-provided state
    updateGameVisualization();

    // Ensure player color indicator is updated to match the synchronized game state
    updatePlayerColorIndicator();

    // DEBUGGING: Log game state to ensure it's properly initialized
    console.log('🎮 2P2G game state after server initialization:');
    console.log('  - Grid matrix size:', gameData.gridMatrix?.length + 'x' + gameData.gridMatrix?.[0]?.length);
    console.log('  - Goals:', gameData.currentGoals);
    console.log('  - Player1 position:', gameData.player1);
    console.log('  - Player2 position:', gameData.player2);
    console.log('  - Step count:', gameData.stepCount);
    console.log('  - Current experiment:', gameData.currentExperiment);

    // Verify that both players are in different positions (not [0,0])
    if (gameData.player1 && gameData.player2 &&
        (gameData.player1[0] === 0 && gameData.player1[1] === 0 &&
         gameData.player2[0] === 0 && gameData.player2[1] === 0)) {
        console.warn('⚠️ Both players at [0,0] - possible game state initialization issue');
    }

    // CRITICAL: Clear any existing intervals from previous trials to prevent premature timeouts
    window.clearAllGameIntervals();

        // CRITICAL: Reset stepCount to 0 and ensure proper trial data initialization
    console.log('🔄 Resetting stepCount from', gameData.stepCount, 'to 0 for multiplayer trial');
    gameData.stepCount = 0;

    // Ensure trial data is properly initialized
    if (!gameData.currentTrialData) {
        console.log('🔄 Initializing trial data for 2P2G multiplayer');
        gameData.currentTrialData = {
            trialStartTime: gameData.gameStartTime || Date.now(),
            player1Actions: [],
            player1RT: [],
            player1Trajectory: [],
            player1FinalReachedGoal: null,
            stepCount: 0,
            completed: false
        };
    }

    // CRITICAL: Don't start any client-side timeouts for multiplayer - server handles timing
    console.log('🎮 Multiplayer trial - server handles timing, no client-side timeouts');

        // Setup keyboard controls for real-time movement
    setupKeyboardControlsForMultiplayer2P2G();

    // REMOVED: Client-side timeout - server handles all timing for multiplayer games
    // This prevents premature "time up" messages when no one is moving

    console.log('🎮 2P2G game ready for player input');
}

/**
 * Handle move updates from server for 2P2G
 */
function handleServerMoveUpdate2P2G(serverData) {
    if (serverData.gameState) {
        // Update positions from server
        const players = Object.keys(serverData.gameState.players);
        if (players.length >= 2) {
            gameData.player1 = serverData.gameState.players[players[0]].position;
            gameData.player2 = serverData.gameState.players[players[1]].position;
        }

        // Update grid matrix but NOT step count (to prevent timeout conflicts)
        gameData.gridMatrix = serverData.gameState.gridMatrix;
        // CRITICAL: Don't sync stepCount from server to prevent timing conflicts
        // gameData.stepCount = serverData.gameState.stepCount;

        // Update visualization
        updateGameVisualization();

        console.log('✅ 2P2G positions updated from server:', {
            player1: gameData.player1,
            player2: gameData.player2,
            stepCount: gameData.stepCount
        });
    }
}

/**
 * Handle trial completion from server for 2P2G
 */
function handleServerTrialComplete2P2G(serverData) {
    console.log('🎮 2P2G trial completed by server:', serverData);

    // Clean up keyboard controls
    cleanupKeyboardControls();

    // Ensure trial data exists before finalizing
    if (!gameData.currentTrialData) {
        console.warn('No currentTrialData, creating minimal structure');
        gameData.currentTrialData = {
            trialStartTime: gameData.gameStartTime || Date.now(),
            player1Actions: [],
            player1RT: [],
            player1Trajectory: []
        };
    }

    // Update final trial data with server results
    if (serverData.collaborationSucceeded !== undefined) {
        gameData.currentTrialData.collaborationSucceeded = serverData.collaborationSucceeded;
    }
    if (serverData.finalGoals) {
        gameData.currentTrialData.player1FinalReachedGoal = serverData.finalGoals.player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = serverData.finalGoals.player2Goal;
    }

    // Set completed status based on server data
    const completed = serverData.completed || false;
    console.log('Finalizing 2P2G trial with completed =', completed);

    // Finalize trial with server-determined success
    window.DataRecording.finalizeTrial(completed);

    // Verify trial was added to allTrialsData
    console.log('Trial finalized. allTrialsData length:', gameData.allTrialsData?.length);
    console.log('Last trial data:', gameData.allTrialsData?.[gameData.allTrialsData.length - 1]);

    // Advance to next stage
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.trialToFeedbackDelay);
}

/**
 * Handle periodic state updates from server for 2P2G
 */
function handleServerStateUpdate2P2G(serverData) {
    // Lightweight state sync (every 100ms from server)
    if (serverData && serverData.players) {
        const players = Object.keys(serverData.players);
        if (players.length >= 2) {
            gameData.player1 = serverData.players[players[0]].position;
            gameData.player2 = serverData.players[players[1]].position;
            updateGameVisualization();
        }
    }
}

/**
 * Handle collaboration feedback for 2P2G
 */
function handleCollaborationFeedback2P2G(data) {
    console.log('🎮 2P2G collaboration feedback received:', data);
    // Could display interim feedback if needed
}

/**
 * Setup keyboard controls for multiplayer 2P2G (sends moves to server)
 */
function setupKeyboardControlsForMultiplayer2P2G() {
    cleanupKeyboardControls(); // Remove any existing listeners

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return;
        }

        const key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if my player has reached a goal
        const myPlayerPosition = window.playerOrder?.isFirstPlayer ? gameData.player1 : gameData.player2;
        if (isGoalReached(myPlayerPosition, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;
        event.preventDefault();
        event.stopPropagation();

        const direction = key.toLowerCase();
        const aimAction = DIRECTIONS[direction].movement;

        // Record move locally
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Send move to server for processing and synchronization
        window.NetworkingHumanHuman.makeMultiplayerMove(aimAction);

        // Reset movement flag
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay);
    }

    document.addEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = true;
    document.body.focus();

    console.log('✅ 2P2G multiplayer keyboard controls set up');
}

/**
 * Run 2P3G trial (human-human multiplayer with socket.io and server-side goal management)
 */
function runTrial2P3GHumanHuman(trialIndex, trialDesign) {
    console.log('Starting 2P3G human-human multiplayer trial:', {trialIndex, trialDesign});

    // Check if socket.io is available
    if (typeof io === 'undefined' || !window.NetworkingHumanHuman) {
        console.log('Socket.io not available - falling back to human-AI version');
        if (window.TrialHandlers && window.TrialHandlers.runTrial2P3G) {
            return window.TrialHandlers.runTrial2P3G();
        } else {
            console.error('No fallback trial handler available');
            return;
        }
    }

    // Get socket connection
    const socket = window.NetworkingHumanHuman.getSocket();
    if (!socket || !socket.connected) {
        console.error('Socket not connected for 2P3G trial');
        return;
    }

    // Initialize 2P3G specific variables
    gameData.newGoalPresented = false;
    gameData.player1InferredGoals = [];
    gameData.player2InferredGoals = [];
    gameData.conflictDetected = false;
    gameData.lastConflictDetection = 0;

    // Clear any existing callbacks to prevent conflicts
    window.NetworkingHumanHuman.clearAllCallbacks();

    // Set up socket event handlers for 2P3G game
    setupSocketHandlers2P3G();

    // Initialize trial data (basic structure - server will provide game state)
    gameData.stepCount = 0;
    gameData.gameStartTime = Date.now();
    timeline.isMoving = false;

    // Ensure currentTrialData is initialized before starting multiplayer
    if (!gameData.currentTrialData) {
        console.log('Initializing trial data for 2P3G multiplayer');
        window.GameState.initializeTrialData(trialIndex || gameData.currentTrial || 0, '2P3G');
    }

    // CRITICAL: Store trial design for server-side map generation and goal management
    console.log('🗺️ Setting trial design for server-side map generation and goal management:', trialDesign);
    gameData.pendingTrialDesign = trialDesign;
    gameData.pendingTrialIndex = trialIndex;

    // Small delay to ensure design is set before room operations
    setTimeout(() => {
        // Join multiplayer room - server will handle map generation, goal management, and synchronization
        window.NetworkingHumanHuman.joinMultiplayerRoom();
        console.log('2P3G trial setup complete, waiting for server to start game...');
    }, 100);
}

/**
 * Setup socket event handlers for 2P3G game
 * REMOVED: Duplicate socket handlers to prevent race conditions
 * Now using centralized handlers from networkingHumanHuman.js
 */
function setupSocketHandlers2P3G() {
    console.log('🔧 Setting up 2P3G-specific callbacks (using centralized socket handlers)');

    // Register 2P3G-specific callbacks with the networking module
    // This prevents duplicate event handlers and race conditions
    window.NetworkingHumanHuman.registerGameStartedCallback(handleServerGameStart2P3G);
    window.NetworkingHumanHuman.registerMoveCallback(handleServerMoveUpdate2P3G);
    window.NetworkingHumanHuman.registerTrialCompleteCallback(handleServerTrialComplete2P3G);

    // Register 2P3G-specific events that don't conflict with general networking
    window.NetworkingHumanHuman.registerNewGoalCallback(handleServerNewGoal2P3G);
    window.NetworkingHumanHuman.registerNewGoalFailedCallback(handleServerNewGoalFailed2P3G);

    console.log('✅ 2P3G callbacks registered with centralized networking module');
}

/**
 * Handle game start from server for 2P3G
 */
function handleServerGameStart2P3G(serverData) {
    console.log('🎮 Handling 2P3G game start from server');

    // Server provides the complete game state including map
    if (serverData.gameState) {
        // Use server-generated grid matrix and goals (initially 2 goals, third comes dynamically)
        gameData.gridMatrix = serverData.gameState.gridMatrix;
        gameData.currentGoals = serverData.gameState.goals;

        // CRITICAL: Proper player position mapping based on player order (same as 2P2G)
        const playerIds = Object.keys(serverData.gameState.players);
        if (playerIds.length >= 2) {
            const myPlayerId = window.NetworkingHumanHuman.getMyPlayerId();
            const partnerPlayerId = window.NetworkingHumanHuman.getPartnerPlayerId();

            console.log('🔄 2P3G PLAYER MAPPING DEBUG:');
            console.log('  - My player ID:', myPlayerId);
            console.log('  - Partner player ID:', partnerPlayerId);
            console.log('  - Server players:', playerIds);
            console.log('  - Player order (if available):', serverData.playerOrder);

            // Use player order to determine visual mapping (who is red vs orange)
            if (serverData.playerOrder) {
                // Server provides explicit player order - use it
                const firstPlayerId = serverData.playerOrder.firstPlayerId;
                const secondPlayerId = serverData.playerOrder.secondPlayerId;

                gameData.player1 = serverData.gameState.players[firstPlayerId]?.position || [0, 0];
                gameData.player2 = serverData.gameState.players[secondPlayerId]?.position || [0, 0];

                console.log('✅ Using server player order mapping:');
                console.log('  - player1 (red):', firstPlayerId, 'at', gameData.player1);
                console.log('  - player2 (orange):', secondPlayerId, 'at', gameData.player2);
            } else {
                // Fallback: use consistent ordering based on socket IDs
                const sortedPlayerIds = playerIds.sort();
                gameData.player1 = serverData.gameState.players[sortedPlayerIds[0]]?.position || [0, 0];
                gameData.player2 = serverData.gameState.players[sortedPlayerIds[1]]?.position || [0, 0];

                console.log('⚠️ Using fallback alphabetical order mapping:');
                console.log('  - player1 (red):', sortedPlayerIds[0], 'at', gameData.player1);
                console.log('  - player2 (orange):', sortedPlayerIds[1], 'at', gameData.player2);
            }
        }

            // CRITICAL: Don't use server stepCount for client timing - keep our reset value
    console.log('🔄 Server provided stepCount:', serverData.gameState.stepCount, '- keeping client stepCount at:', gameData.stepCount);
    // gameData.stepCount = serverData.gameState.stepCount || 0;  // Commented out to prevent immediate timeout

    console.log('✅ 2P3G game state synchronized with server');
    console.log('Grid matrix size:', gameData.gridMatrix?.length + 'x' + gameData.gridMatrix?.[0]?.length);
    console.log('Initial goals:', gameData.currentGoals);
    console.log('Player positions:', {player1: gameData.player1, player2: gameData.player2});
}

// Update player order from server
if (serverData.playerOrder) {
    window.playerOrder = {
        firstPlayerId: serverData.playerOrder.firstPlayerId,
        secondPlayerId: serverData.playerOrder.secondPlayerId,
        isFirstPlayer: window.myPlayerId === serverData.playerOrder.firstPlayerId
    };
    console.log('✅ Player order set:', window.playerOrder);
}

// Initialize 2P3G specific trial data
if (gameData.currentTrialData) {
    gameData.currentTrialData.player1CurrentGoal = [];
    gameData.currentTrialData.player2CurrentGoal = [];
    gameData.currentTrialData.player1FirstDetectedGoal = null;
    gameData.currentTrialData.player2FirstDetectedGoal = null;
    gameData.currentTrialData.firstDetectedSharedGoal = null;
    gameData.currentTrialData.newGoalEvents = [];
} else {
    // Ensure trial data is properly initialized
    console.log('🔄 Initializing trial data for 2P3G multiplayer');
    gameData.currentTrialData = {
        trialStartTime: gameData.gameStartTime || Date.now(),
        player1Actions: [],
        player1RT: [],
        player1Trajectory: [],
        player1FinalReachedGoal: null,
        stepCount: 0,
        completed: false,
        player1CurrentGoal: [],
        player2CurrentGoal: [],
        player1FirstDetectedGoal: null,
        player2FirstDetectedGoal: null,
        firstDetectedSharedGoal: null,
        newGoalEvents: []
    };
}

// Update visualization with server-provided state
updateGameVisualization();

// Ensure player color indicator is updated to match the synchronized game state
updatePlayerColorIndicator();

// CRITICAL: Clear any existing intervals from previous trials to prevent premature timeouts
window.clearAllGameIntervals();

    // CRITICAL: Reset stepCount to 0 for multiplayer trial
    console.log('🔄 Resetting stepCount from', gameData.stepCount, 'to 0 for multiplayer trial');
    gameData.stepCount = 0;

    // CRITICAL: Don't start any client-side timeouts for multiplayer - server handles timing
    console.log('🎮 Multiplayer trial - server handles timing, no client-side timeouts');

    // Setup keyboard controls for real-time movement with conflict detection
    setupKeyboardControlsForMultiplayer2P3G();

    // REMOVED: Client-side timeout - server handles all timing for multiplayer games
    // This prevents premature "time up" messages when no one is moving

    console.log('🎮 2P3G game ready for player input');
}

/**
 * Handle move updates from server for 2P3G
 */
function handleServerMoveUpdate2P3G(serverData) {
    if (serverData.gameState) {
        // Update positions from server
        const players = Object.keys(serverData.gameState.players);
        if (players.length >= 2) {
            gameData.player1 = serverData.gameState.players[players[0]].position;
            gameData.player2 = serverData.gameState.players[players[1]].position;
        }

        // Update grid matrix but NOT step count (to prevent timeout conflicts)
        gameData.gridMatrix = serverData.gameState.gridMatrix;
        // CRITICAL: Don't sync stepCount from server to prevent timing conflicts
        // gameData.stepCount = serverData.gameState.stepCount;

        // Update goals (may have changed due to server-side goal generation)
        if (serverData.gameState.goals) {
            gameData.currentGoals = serverData.gameState.goals;
        }

        // Perform conflict detection after each move (client-side detection for server-side goal generation)
        detectAndHandleConflict2P3G();

        // Update visualization
        updateGameVisualization();

        console.log('✅ 2P3G positions updated from server with server-side goal generation:', {
            player1: gameData.player1,
            player2: gameData.player2,
            stepCount: gameData.stepCount,
            goals: gameData.currentGoals.length
        });
    }
}

/**
 * Handle new goal generated by server for 2P3G
 */
function handleServerNewGoal2P3G(data) {
    console.log('🎮 Server-side new goal generation for 2P3G:', data);

    // Clear the request flag since server responded
    window.goalRequestInProgress = false;

    // Handle both newGoal and newGoalPosition for compatibility
    const newGoalPosition = data.newGoal || data.newGoalPosition;

    if (newGoalPosition && newGoalPosition.length === 2) {
        // CRITICAL: Prevent duplicate goal addition
        if (gameData.newGoalPresented) {
            console.log('⚠️ Goal already presented, ignoring duplicate server response');
            return;
        }

        // Add the new goal to current goals
        gameData.currentGoals.push(newGoalPosition);
        gameData.newGoalPresented = true;

        // Update grid matrix to show the new goal
        if (gameData.gridMatrix && typeof OBJECT !== 'undefined' && OBJECT.goal) {
            gameData.gridMatrix[newGoalPosition[0]][newGoalPosition[1]] = OBJECT.goal;
        }

        // Record new goal event in trial data
        if (gameData.currentTrialData) {
            gameData.currentTrialData.newGoalEvents = gameData.currentTrialData.newGoalEvents || [];
            gameData.currentTrialData.newGoalEvents.push({
                timestamp: Date.now() - gameData.gameStartTime,
                position: newGoalPosition,
                stepCount: gameData.stepCount,
                distanceCondition: data.distanceCondition || 'unknown',
                generatedBy: data.generatedBy || 'server',
                requestedBy: data.requestedBy || 'unknown'
            });

            // Mark that new goal was presented
            gameData.currentTrialData.newGoalPresented = true;
            gameData.currentTrialData.newGoalPosition = newGoalPosition;
        }

        // Update visualization to show new goal
        if (typeof updateGameVisualization === 'function') {
            updateGameVisualization();
        }

        // Show brief message about new goal
        showNewGoalMessage2P3G(newGoalPosition);

        console.log('✅ Server-side new goal added to 2P3G game:', newGoalPosition);
        console.log('Total goals now:', gameData.currentGoals.length);
        console.log('Updated game grid matrix with new goal');
    } else {
        console.error('❌ Invalid new goal data from server:', data);
    }
}

/**
 * Handle new goal generation failure from server
 */
function handleServerNewGoalFailed2P3G(data) {
    console.log('🎮 Server failed to generate new goal for 2P3G:', data);
    // Could show a message or handle gracefully
}

/**
 * Handle trial completion from server for 2P3G
 */
function handleServerTrialComplete2P3G(serverData) {
    console.log('🎮 2P3G trial completed by server:', serverData);

    // Clean up keyboard controls
    cleanupKeyboardControls();

    // Ensure trial data exists before finalizing
    if (!gameData.currentTrialData) {
        console.warn('No currentTrialData, creating minimal structure');
        gameData.currentTrialData = {
            trialStartTime: gameData.gameStartTime || Date.now(),
            player1Actions: [],
            player1RT: [],
            player1Trajectory: [],
            player1CurrentGoal: [],
            player2CurrentGoal: [],
            newGoalEvents: []
        };
    }

    // Update final trial data with server results
    if (serverData.collaborationSucceeded !== undefined) {
        gameData.currentTrialData.collaborationSucceeded = serverData.collaborationSucceeded;
    }
    if (serverData.finalGoals) {
        gameData.currentTrialData.player1FinalReachedGoal = serverData.finalGoals.player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = serverData.finalGoals.player2Goal;
    }

    // Set completed status based on server data
    const completed = serverData.completed || false;
    console.log('Finalizing 2P3G trial with completed =', completed);

    // Finalize trial with server-determined success
    window.DataRecording.finalizeTrial(completed);

    // Verify trial was added to allTrialsData
    console.log('Trial finalized. allTrialsData length:', gameData.allTrialsData?.length);
    console.log('Last trial data:', gameData.allTrialsData?.[gameData.allTrialsData.length - 1]);

    // Advance to next stage
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.trialToFeedbackDelay);
}

/**
 * Handle periodic state updates from server for 2P3G
 */
function handleServerStateUpdate2P3G(serverData) {
    // Lightweight state sync (every 100ms from server)
    if (serverData && serverData.players) {
        const players = Object.keys(serverData.players);
        if (players.length >= 2) {
            gameData.player1 = serverData.players[players[0]].position;
            gameData.player2 = serverData.players[players[1]].position;

            // Perform conflict detection on state updates too
            detectAndHandleConflict2P3G();

            updateGameVisualization();
        }
    }
}

/**
 * Handle collaboration feedback for 2P3G
 */
function handleCollaborationFeedback2P3G(data) {
    console.log('🎮 2P3G collaboration feedback received:', data);
    // Could display interim feedback if needed
}

/**
 * Detect conflict and request new goal from server (2P3G specific)
 */
function detectAndHandleConflict2P3G() {
    // Avoid too frequent conflict detection
    const now = Date.now();
    if (now - gameData.lastConflictDetection < 500) return; // Throttle to every 500ms
    gameData.lastConflictDetection = now;

    // Only proceed if we have at least 2 goals and haven't already generated a new goal
    if (!gameData.currentGoals || gameData.currentGoals.length < 2 || gameData.newGoalPresented) {
        return;
    }

    // Detect current goals for both players using their positions and movement patterns
    const player1Goal = detectPlayerGoal(gameData.player1, [0, 0], gameData.currentGoals, gameData.player1InferredGoals);
    const player2Goal = detectPlayerGoal(gameData.player2, [0, 0], gameData.currentGoals, gameData.player2InferredGoals);

    // Update goal history
    if (player1Goal !== null && !gameData.player1InferredGoals.includes(player1Goal)) {
        gameData.player1InferredGoals.push(player1Goal);
    }
    if (player2Goal !== null && !gameData.player2InferredGoals.includes(player2Goal)) {
        gameData.player2InferredGoals.push(player2Goal);
    }

    // Record first detected goals
    if (gameData.currentTrialData) {
        if (player1Goal !== null && gameData.currentTrialData.player1FirstDetectedGoal === null) {
            gameData.currentTrialData.player1FirstDetectedGoal = player1Goal;
        }
        if (player2Goal !== null && gameData.currentTrialData.player2FirstDetectedGoal === null) {
            gameData.currentTrialData.player2FirstDetectedGoal = player2Goal;
        }
    }

    // Check for conflict (both players heading to same goal)
    if (player1Goal !== null && player2Goal !== null && player1Goal === player2Goal && !gameData.conflictDetected) {
        console.log('🔥 2P3G conflict detected! Both players heading to goal:', player1Goal);
        gameData.conflictDetected = true;

        // Record first detected shared goal
        if (gameData.currentTrialData && gameData.currentTrialData.firstDetectedSharedGoal === null) {
            gameData.currentTrialData.firstDetectedSharedGoal = player1Goal;
        }

        // Request new goal from server for server-side goal generation
        requestNewGoalFromServer2P3G(player1Goal);
    }
}

/**
 * Request new goal generation from server
 */
function requestNewGoalFromServer2P3G(sharedGoalIndex) {
    const socket = window.NetworkingHumanHuman.getSocket();
    if (!socket || !socket.connected) {
        console.error('Cannot request new goal - socket not connected');
        return;
    }

    // CRITICAL: Prevent duplicate goal generation requests
    if (gameData.newGoalPresented || window.goalRequestInProgress) {
        console.log('⚠️ Goal already presented or request in progress, skipping duplicate request');
        return;
    }

    // Set flag to prevent duplicate requests
    window.goalRequestInProgress = true;

    // Get distance condition from multiple sources
    const distanceCondition = gameData.currentTrialData?.distanceCondition ||
                            timeline.distanceCondition ||
                            'closer_to_player2'; // Default fallback

    // VALIDATE data before sending
    if (!gameData.player1 || !gameData.player2 || !gameData.currentGoals ||
        sharedGoalIndex === undefined || sharedGoalIndex >= gameData.currentGoals.length) {
        console.error('❌ Invalid data for goal request:', {
            player1: gameData.player1,
            player2: gameData.player2,
            currentGoals: gameData.currentGoals,
            sharedGoalIndex: sharedGoalIndex
        });
        window.goalRequestInProgress = false;
        return;
    }

    const requestData = {
        player1Pos: gameData.player1,
        player2Pos: gameData.player2,
        currentGoals: gameData.currentGoals,  // Send all goals for validation
        sharedGoalIndex: sharedGoalIndex,
        distanceCondition: distanceCondition,
        stepCount: gameData.stepCount,
        trialIndex: gameData.currentTrial || 0,
        roomId: window.NetworkingHumanHuman.getRoomId()
    };

    console.log('🎮 Requesting server-side new goal generation with data:', requestData);
    socket.emit('request_new_goal', requestData);

    // Clear the request flag after a timeout
    setTimeout(() => {
        window.goalRequestInProgress = false;
    }, 3000);
}

/**
 * Show new goal message briefly
 */
function showNewGoalMessage2P3G(newGoalPosition) {
    // Could show a brief overlay message about the new goal
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.innerHTML = `<span style="color: #28a745; font-weight: bold;">New goal appeared at [${newGoalPosition[0]}, ${newGoalPosition[1]}]!</span>`;
        setTimeout(() => {
            statusDiv.innerHTML = '';
        }, 2000);
    }
}

/**
 * Setup keyboard controls for multiplayer 2P3G (sends moves to server with conflict detection)
 */
function setupKeyboardControlsForMultiplayer2P3G() {
    cleanupKeyboardControls(); // Remove any existing listeners

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return;
        }

        const key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if my player has reached a goal
        const myPlayerPosition = window.playerOrder?.isFirstPlayer ? gameData.player1 : gameData.player2;
        if (isGoalReached(myPlayerPosition, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;
        event.preventDefault();
        event.stopPropagation();

        const direction = key.toLowerCase();
        const aimAction = DIRECTIONS[direction].movement;

        // Record move locally
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Send move to server for processing and synchronization
        window.NetworkingHumanHuman.makeMultiplayerMove(aimAction);

        // Reset movement flag
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay);
    }

    document.addEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = true;
    document.body.focus();

    console.log('✅ 2P3G multiplayer keyboard controls set up with conflict detection');
}

/**
 * Run single-player trial (1P1G, 1P2G)
 */
function runSinglePlayerTrial(experimentType, trialIndex) {
    console.log(`Starting single-player trial: ${experimentType}, trial ${trialIndex}`);

    // Create and draw canvas
    var canvas = createGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);

    // Get the appropriate design for this trial
    var design = getRandomMapForCollaborationGame(experimentType, trialIndex);

    // Check if design is valid
    if (!design) {
        console.error('Failed to get valid design for trial:', trialIndex, 'experiment:', experimentType);

        // Create a fallback design
        console.log('Creating fallback design for', experimentType);
        var fallbackDesign = window.GameState.createFallbackDesign(experimentType);

        if (fallbackDesign) {
            console.log('Using fallback design:', fallbackDesign);
            design = fallbackDesign;
        } else {
            // Skip this trial and move to next stage
            console.error('No fallback design available, skipping trial');
            setTimeout(() => nextStage(), 1000);
            return;
        }
    }

    // Initialize trial data using shared function
    window.GameState.initializeTrialData(trialIndex, experimentType);

    // Set up the grid matrix for this trial
    setupGridMatrixForTrial(design, experimentType);

    // Update visualization
    updateGameVisualization();

    // Setup keyboard controls
    setupKeyboardControls();

    // Start the trial game loop based on experiment type
    switch(experimentType) {
        case '1P1G':
            startSinglePlayerGame1P1G();
            break;
        case '1P2G':
            startSinglePlayerGame1P2G();
            break;
        default:
            console.error('Unknown single-player experiment type:', experimentType);
    }
}

/**
 * Run multiplayer trial
 */
function runMultiplayerTrial(experimentType, trialIndex, mapDesign) {
    console.log('🎮 Starting multiplayer trial:', experimentType, trialIndex);
    console.log('🎮 Map design:', mapDesign);

    // Set up trial data
    initializeTrialData(trialIndex, experimentType);

    // For multiplayer trials, DON'T set up the grid matrix locally
    // Wait for the server to provide the synchronized game state
    console.log('🎮 Multiplayer trial - waiting for server to provide synchronized game state');
    console.log('🎮 Map design will be handled by server:', mapDesign ? 'provided' : 'not provided');

    // Create canvas but DON'T render game state yet
    console.log('🎮 Setting up trial visualization canvas (without rendering game state)...');

    // Look for the gameCanvas div element
    var gameCanvasDiv = document.getElementById('gameCanvas');
    if (gameCanvasDiv) {
        // Check if there's already a canvas inside the div
        var existingCanvas = gameCanvasDiv.querySelector('canvas');
        if (!existingCanvas) {
            console.log('🎮 Creating canvas for multiplayer trial');
            if (typeof createGameCanvas === 'function') {
                var canvas = createGameCanvas();
                if (canvas) {
                    gameCanvasDiv.innerHTML = '';
                    gameCanvasDiv.appendChild(canvas);
                    console.log('🎮 Canvas created and added to DOM');
                    console.log('🎮 Canvas dimensions:', canvas.width, 'x', canvas.height);
                } else {
                    console.error('❌ Failed to create canvas!');
                }
            } else {
                console.error('❌ createGameCanvas function not available');
            }
        } else {
            console.log('🎮 Canvas already exists');
        }
    } else {
        console.error('❌ gameCanvas div not found!');
    }

    // Don't call updateGameVisualization here - wait for server game state

    // Setup keyboard controls for multiplayer
    if (typeof setupKeyboardControls === 'function') {
        setupKeyboardControls();
        console.log('✅ Keyboard controls set up successfully');
    } else {
        console.error('❌ setupKeyboardControls function not available');
    }

    // Map design is now sent earlier in the process (in handleRoomFull)
    // No need to send it again here

    // Send player ready event immediately to trigger game start
    console.log('🎮 Sending player_ready event immediately after start_trial');
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('player_ready', { roomId: roomId });
        console.log('✅ Immediate player_ready event sent');
    } else {
        console.error('❌ Socket not available for immediate player_ready');
    }

    // Also try the delayed approach as backup
    setTimeout(() => {
        console.log('🎮 Attempting to send player_ready event...');
        console.log('NetworkingHumanHuman available:', typeof window.NetworkingHumanHuman !== 'undefined');
        console.log('getSocket available:', typeof window.NetworkingHumanHuman !== 'undefined' && window.NetworkingHumanHuman.getSocket);

        if (typeof window.NetworkingHumanHuman !== 'undefined' &&
            window.NetworkingHumanHuman.getSocket &&
            window.NetworkingHumanHuman.getSocket().connected) {
            console.log('🎮 Sending player_ready event to server');
            console.log('Room ID:', window.NetworkingHumanHuman.getRoomId());
            window.NetworkingHumanHuman.getSocket().emit('player_ready', {
                roomId: window.NetworkingHumanHuman.getRoomId()
            });
            console.log('✅ player_ready event sent successfully');
        } else {
            console.error('❌ Cannot send player_ready event - socket not available or not connected');
            console.log('Socket connected:', window.NetworkingHumanHuman?.getSocket?.()?.connected);

            // FALLBACK: Try to send player_ready directly through the socket
            if (typeof socket !== 'undefined' && socket && socket.connected) {
                console.log('🎮 Trying fallback: sending player_ready through global socket');
                socket.emit('player_ready', { roomId: roomId });
                console.log('✅ Fallback player_ready event sent');
            } else {
                console.error('❌ No socket available for fallback');
            }
        }
    }, 1000); // Small delay to ensure trial is started first
}

/**
 * Start single player game for 1P1G
 */
function startSinglePlayerGame1P1G() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if player has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;

        // Prevent default browser behavior for arrow keys and prevent key repeat
        event.preventDefault();
        event.stopPropagation();

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move using shared function
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.player1, aimAction);
        var nextState = transition(gameData.player1, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.player1[0], gameData.player1[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.player1 = nextState;

        gameData.stepCount++;
        updateGameVisualization();

        // Check win condition
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            var finalGoal = whichGoalReached(gameData.player1, gameData.currentGoals);
            gameData.currentTrialData.player1FinalReachedGoal = finalGoal;
            console.log(`Player1 final reached goal: ${finalGoal}`);

            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay); // Configurable delay to prevent rapid successive movements
    }

    // Set up controls
    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

/**
 * Start single player game for 1P2G
 */
function startSinglePlayerGame1P2G() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if player has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        timeline.isMoving = true;

        // Prevent default browser behavior for arrow keys and prevent key repeat
        event.preventDefault();
        event.stopPropagation();

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move using shared function
        window.DataRecording.recordPlayer1Move(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.player1, aimAction);
        var nextState = transition(gameData.player1, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.player1[0], gameData.player1[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.player1 = nextState;

        // Detect player goal with history tracking
        var player1CurrentGoal = detectPlayerGoal(gameData.player1, aimAction, gameData.currentGoals, gameData.currentTrialData.player1CurrentGoal);
        gameData.currentTrialData.player1CurrentGoal.push(player1CurrentGoal);

        // Record first detected goal
        if (player1CurrentGoal !== null && gameData.currentTrialData.player1FirstDetectedGoal === null) {
            gameData.currentTrialData.player1FirstDetectedGoal = player1CurrentGoal;
            console.log(`Player1 first detected goal: ${player1CurrentGoal}`);
        }

        gameData.stepCount++;
        updateGameVisualization();

        // Check for new goal presentation based on distance condition
        window.ExpDesign.checkNewGoalPresentation1P2G();

        // Check win condition
        if (isGoalReached(gameData.player1, gameData.currentGoals)) {
            var finalGoal = whichGoalReached(gameData.player1, gameData.currentGoals);
            gameData.currentTrialData.player1FinalReachedGoal = finalGoal;
            console.log(`Player1 final reached goal: ${finalGoal}`);

            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, NODEGAME_CONFIG.timing.movementDelay); // Configurable delay to prevent rapid successive movements
    }

    // Set up controls
    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

// Export functions for module usage
window.TrialHandlersHumanHuman = {
    runTrialStageHumanHuman: runTrialStageHumanHuman,
    runExperimentTrialHumanHuman: runExperimentTrialHumanHuman,
    runTrial1P1GHumanHuman: runTrial1P1GHumanHuman,
    runTrial1P2GHumanHuman: runTrial1P2GHumanHuman,
    runTrial2P2GHumanHuman: runTrial2P2GHumanHuman,
    runTrial2P3GHumanHuman: runTrial2P3GHumanHuman,
    runSinglePlayerTrial: runSinglePlayerTrial,
    runMultiplayerTrial: runMultiplayerTrial,
    startSinglePlayerGame1P1G: startSinglePlayerGame1P1G,
    startSinglePlayerGame1P2G: startSinglePlayerGame1P2G
};