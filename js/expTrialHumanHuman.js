/**
 * Trial Handlers Module for Human-Human Experiments
 *
 * Contains all trial execution functions for different human-human experiment types.
 * Extracted from human-human-version.js for better organization.
 */

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
 * Run trial stage (main game for multiplayer)
 */
function runTrialStageMultiplayer(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Set current experiment type
    gameData.currentExperiment = experimentType;

    console.log('🎮 runTrialStageMultiplayer called with:', {
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

    // Determine player color for display - but don't set it yet if playerOrder is not available
    let playerColor = 'orange'; // Default fallback
    if (window.playerOrder && window.playerOrder.isFirstPlayer !== undefined) {
        playerColor = window.playerOrder.isFirstPlayer ? 'red' : 'orange';
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

    // Single-player experiments (1P1G, 1P2G) - run locally
    if (experimentType.includes('1P')) {
        console.log('Running single-player experiment locally');
        runSinglePlayerTrial(experimentType, trialIndex);

        // Show the full game board after trial setup is complete for single-player
        updateGameVisualization();
    } else if (experimentType.includes('2P')) {
        // Multiplayer experiments (2P2G, 2P3G) - use server
        console.log('Running multiplayer experiment with server');

        // Get the map design for this trial
        const mapDesign = timeline.mapData[experimentType][trialIndex];
        console.log(`=== MULTIPLAYER TRIAL MAP DESIGN ===`);
        console.log(`Experiment type: ${experimentType}`);
        console.log(`Trial index: ${trialIndex}`);
        console.log(`Map design for trial ${trialIndex}:`, mapDesign);
        console.log(`Timeline map data for ${experimentType}:`, timeline.mapData[experimentType]);

        if (!mapDesign) {
            console.error('No map design found for multiplayer trial', trialIndex, 'in experiment', experimentType);
            console.error('Available map data:', timeline.mapData);
            console.error('Available experiment types:', Object.keys(timeline.mapData));
            return;
        }
        console.log(`=== END MAP DESIGN CHECK ===`);

        runMultiplayerTrial(experimentType, trialIndex, mapDesign);

        // For multiplayer, don't call updateGameVisualization here
        // The visualization will be updated when the server sends the game state
    } else {
        console.error('Unknown experiment type:', experimentType);
    }
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

    // Initialize trial data
    initializeTrialData(trialIndex, experimentType);

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

    // Set up the grid matrix for this trial with the map design
    if (mapDesign) {
        console.log('🎮 Setting up grid matrix with map design:', mapDesign);
        setupGridMatrixForTrial(mapDesign, experimentType);

        // Debug: Check if grid matrix was set up correctly
        console.log('🎮 Grid matrix after setup:', gameData.gridMatrix);
        console.log('🎮 Player1 position after setup:', gameData.player1);
        console.log('🎮 Player2 position after setup:', gameData.player2);
        console.log('🎮 Current goals after setup:', gameData.currentGoals);
    } else {
        console.error('❌ No map design provided for multiplayer trial');
        // Create a fallback design
        var fallbackDesign = window.GameState.createFallbackDesign(experimentType);
        if (fallbackDesign) {
            console.log('🎮 Using fallback design:', fallbackDesign);
            setupGridMatrixForTrial(fallbackDesign, experimentType);
        } else {
            console.error('❌ No fallback design available');
            return;
        }
    }

    // Create canvas and setup visualization
    console.log('🎮 Setting up trial visualization...');
    setupTrialVisualization(experimentType);

    // Debug: Check if canvas was created
    var canvas = document.querySelector('canvas');
    console.log('🎮 Canvas found after setup:', canvas);
    if (canvas) {
        console.log('🎮 Canvas dimensions:', canvas.width, 'x', canvas.height);
    }

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

        // Record move
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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

            finalizeTrial(true);
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

            finalizeTrial(false);
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

        // Record move
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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

            finalizeTrial(true);
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

            finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

// Export functions for module usage
window.TrialHandlersHumanHuman = {
    runTrialStageMultiplayer: runTrialStageMultiplayer,
    runSinglePlayerTrial: runSinglePlayerTrial,
    runMultiplayerTrial: runMultiplayerTrial,
    startSinglePlayerGame1P1G: startSinglePlayerGame1P1G,
    startSinglePlayerGame1P2G: startSinglePlayerGame1P2G
};