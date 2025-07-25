/**
 * Trial Handlers Module
 *
 * Contains all trial execution functions for different experiment types.
 * Extracted from human-AI-version.js for better organization.
 */

/**
 * Get AI action
 */
function getAIAction(gridMatrix, currentPos, goals, playerPos = null) {
    if (!goals || goals.length === 0) return [0, 0];

    // Use the RL agent from rlAgent.js
    if (window.RLAgent && window.RLAgent.getAIAction) {
        return window.RLAgent.getAIAction(gridMatrix, currentPos, goals, playerPos);
    } else {
        console.error('RL Agent not loaded. Please ensure rlAgent.js is included before human-AI-version.js');
        return [0, 0];
    }
}

/**
 * Run trial stage (main game)
 */
function runTrialStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Set current experiment type
    gameData.currentExperiment = experimentType;

    // For collaboration games, show dynamic trial count
    var trialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        trialCountDisplay = `Trial ${trialIndex + 1} (${gameData.successThreshold.totalTrialsCompleted + 1} total)`;
    } else {
        trialCountDisplay = `Trial ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}`;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment ${experimentIndex + 1}: ${experimentType}</h3>
                <h4 style="margin-bottom: 20px;">${trialCountDisplay}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Create and draw canvas
    var canvas = nodeGameCreateGameCanvas();
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
    window.GameState.initializeTrialData(trialIndex, experimentType, design);

    // Run the appropriate experiment
    runExperimentTrial(experimentType, trialIndex, design);
}

/**
 * Run experiment trial based on type
 */
function runExperimentTrial(experimentType, trialIndex, design) {
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
    // Setup grid matrix
    setupGridMatrixForTrial(trialDesign, experimentType);
    nodeGameUpdateGameDisplay();

    // Start appropriate experiment
    switch(experimentType) {
        case '1P1G':
            runTrial1P1G();
            break;
        case '1P2G':
            runTrial1P2G();
            break;
        case '2P2G':
            runTrial2P2G();
            break;
        case '2P3G':
            runTrial2P3G();
            break;
    }
}

/**
 * Run 1P1G trial
 */
function runTrial1P1G() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if human has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
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
        window.DataRecording.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.playerState, aimAction);
        var nextState = transition(gameData.playerState, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.playerState[0], gameData.playerState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.playerState = nextState;

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check win condition
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, 100); // 100ms delay to prevent rapid successive movements
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
 * Run 1P2G trial
 */
function runTrial1P2G() {
    var gameLoopInterval = null;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if human has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
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
        window.DataRecording.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

        // Execute move
        var realAction = isValidMove(gameData.gridMatrix, gameData.playerState, aimAction);
        var nextState = transition(gameData.playerState, realAction);

        // Update grid using proper matrix update
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.playerState[0], gameData.playerState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, nextState[0], nextState[1], OBJECT.player);
        gameData.playerState = nextState;

        // Detect player goal with history tracking (similar to 2P3G)
        var humanCurrentGoal = detectPlayerGoal(gameData.playerState, aimAction, gameData.currentGoals, gameData.currentTrialData.humanCurrentGoal);
        gameData.currentTrialData.humanCurrentGoal.push(humanCurrentGoal);

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check for new goal presentation based on distance condition (similar to 2P3G logic)
        window.ExpDesign.checkNewGoalPresentation1P2G();

        // Check win condition
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            window.DataRecording.finalizeTrial(true);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, 100); // 100ms delay to prevent rapid successive movements
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
 * Check trial end condition for 2P2G
 */
function checkTrialEnd2P2G(callback) {
    var humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);
    var aiAtGoal = isGoalReached(gameData.aiState, gameData.currentGoals);

    if (humanAtGoal && aiAtGoal) {
        var humanGoal = whichGoalReached(gameData.playerState, gameData.currentGoals);
        var aiGoal = whichGoalReached(gameData.aiState, gameData.currentGoals);

        // Collaboration is successful if both players reached the same goal
        // Note: Using 0-based indexing from gameHelpers.js (goal 0, 1, 2...)
        var collaboration = (humanGoal === aiGoal && humanGoal !== null);

        console.log(`2P2G Collaboration check: Human goal=${humanGoal}, AI goal=${aiGoal}, Collaboration=${collaboration}`);

        gameData.currentTrialData.collaborationSucceeded = collaboration;
        window.DataRecording.finalizeTrial(true);
        callback();
    } else if (humanAtGoal && !aiAtGoal) {
        // Show wait message when human reached goal but AI hasn't
        showWaitMessage();
    }
}

/**
 * Run 2P2G trial (AI moves simultaneously with human, but independently if human reaches goal)
 */
function runTrial2P2G() {
    var gameLoopInterval = null;
    var aiMoveInterval = null;
    var humanAtGoal = false;

    function handleKeyPress(event) {
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if human has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
            return;
        }

        timeline.isMoving = true;

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move
        window.DataRecording.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

        // Calculate human move
        var realAction = isValidMove(gameData.gridMatrix, gameData.playerState, aimAction);
        var humanNextState = transition(gameData.playerState, realAction);

        // Calculate AI move simultaneously (before updating the grid)
        var aiAction = null;
        var aiNextState = null;
        if (!isGoalReached(gameData.aiState, gameData.currentGoals)) {
            aiAction = getAIAction(gameData.gridMatrix, gameData.aiState, gameData.currentGoals, gameData.playerState);
            var aiRealAction = isValidMove(gameData.gridMatrix, gameData.aiState, aiAction);
            aiNextState = transition(gameData.aiState, aiRealAction);
        }

        // Execute both moves simultaneously
        // Update human position
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.playerState[0], gameData.playerState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, humanNextState[0], humanNextState[1], OBJECT.player);
        gameData.playerState = humanNextState;

        // Update AI position if AI moved
        if (aiNextState) {
            gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.aiState[0], gameData.aiState[1], OBJECT.blank);
            gameData.gridMatrix = updateMatrix(gameData.gridMatrix, aiNextState[0], aiNextState[1], OBJECT.ai_player);
            gameData.aiState = aiNextState;
            window.DataRecording.recordAIMove(aiAction); // Record AI move after position is updated

            // Check if AI reached goal and track when
            var aiAtGoal = isGoalReached(gameData.aiState, gameData.currentGoals);
            if (aiAtGoal && gameData.currentTrialData.aiGoalReachedStep === -1) {
                // AI just reached goal - record the step
                gameData.currentTrialData.aiGoalReachedStep = gameData.stepCount;
                console.log(`AI reached goal at step ${gameData.stepCount}`);
            }
        }

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check if human reached goal and track when
        var wasHumanAtGoal = humanAtGoal;
        humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);
        if (!wasHumanAtGoal && humanAtGoal) {
            // Human just reached goal - record the step
            gameData.currentTrialData.humanGoalReachedStep = gameData.stepCount;
            console.log(`Human reached goal at step ${gameData.stepCount}`);
        }

        // Check win condition
        checkTrialEnd2P2G(() => {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        });

        timeline.isMoving = false;
    }

    // Independent AI movement when human has reached goal
    function makeIndependentAIMove() {
        // Check if game data is valid
        if (!gameData || !gameData.aiState || !gameData.currentGoals || !gameData.gridMatrix) {
            return;
        }

        // Don't move if AI has already reached a goal
        if (isGoalReached(gameData.aiState, gameData.currentGoals)) {
            return;
        }

        var aiAction = getAIAction(gameData.gridMatrix, gameData.aiState, gameData.currentGoals, gameData.playerState);
        var aiRealAction = isValidMove(gameData.gridMatrix, gameData.aiState, aiAction);
        var aiNextState = transition(gameData.aiState, aiRealAction);

        window.DataRecording.recordAIMove(aiAction);

        // Update AI position
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.aiState[0], gameData.aiState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, aiNextState[0], aiNextState[1], OBJECT.ai_player);
        gameData.aiState = aiNextState;

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check if AI reached goal and track when
        var aiAtGoal = isGoalReached(gameData.aiState, gameData.currentGoals);
        if (aiAtGoal && gameData.currentTrialData.aiGoalReachedStep === -1) {
            // AI just reached goal - record the step
            gameData.currentTrialData.aiGoalReachedStep = gameData.stepCount;
            console.log(`AI reached goal at step ${gameData.stepCount}`);
        }

        // Check win condition after AI move
        checkTrialEnd2P2G(() => {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        });
    }

    // Start independent AI movement when human reaches goal
    function startIndependentAIMovement() {
        // Clear any existing interval
        if (aiMoveInterval) {
            clearInterval(aiMoveInterval);
            aiMoveInterval = null;
        }

        aiMoveInterval = setInterval(() => {
            // Check if game data is still valid
            if (!gameData || !gameData.aiState || !gameData.currentGoals) {
                console.log('Game data not available, clearing AI movement interval');
                if (aiMoveInterval) {
                    clearInterval(aiMoveInterval);
                    aiMoveInterval = null;
                }
                return;
            }

            // Only move if AI hasn't reached goal and human has reached goal
            if (!isGoalReached(gameData.aiState, gameData.currentGoals) && humanAtGoal) {
                makeIndependentAIMove();
            } else if (isGoalReached(gameData.aiState, gameData.currentGoals)) {
                // AI reached goal, stop independent movement
                if (aiMoveInterval) {
                    clearInterval(aiMoveInterval);
                    aiMoveInterval = null;
                }
            }
        }, NODEGAME_CONFIG.independentAgentDelay);
    }

    // Set up controls
    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);

    // Monitor for when human reaches goal to start independent AI movement
    var goalCheckInterval = setInterval(() => {
        // Check if game data is valid
        if (!gameData || !gameData.playerState || !gameData.aiState || !gameData.currentGoals) {
            return;
        }

        // Only start independent AI movement if:
        // 1. Human has actually reached a goal (check current state, not just the flag)
        // 2. AI hasn't reached a goal yet
        // 3. Independent AI movement isn't already running
        // 4. Human has made at least one move (stepCount > 0)
        if (gameData.stepCount > 0 &&
            isGoalReached(gameData.playerState, gameData.currentGoals) &&
            !isGoalReached(gameData.aiState, gameData.currentGoals) &&
            !aiMoveInterval) {
            startIndependentAIMovement();
        }
    }, 100);
}

/**
 * Run 2P3G trial
 */
function runTrial2P3G() {
    var gameLoopInterval = null;
    var aiMoveInterval = null;
    var humanAtGoal = false;
    var isFrozen = false; // Track if movement is frozen due to new goal
    var freezeTimeout = null; // Track freeze timeout

    // Reset 2P3G specific variables for new trial
    // Use global variables from expDesign.js
    newGoalPresented = false;
    newGoalPosition = null;
    isNewGoalCloserToAI = null;
    humanInferredGoals = [];
    aiInferredGoals = [];

    function handleKeyPress(event) {
        // Prevent multiple moves with more robust checking
        if (timeline.isMoving) {
            event.preventDefault();
            return; // Prevent multiple moves
        }

        var key = event.code;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

        // Check if movement is frozen due to new goal presentation
        if (isFrozen) {
            event.preventDefault();
            return;
        }

        // Check if human has already reached a goal - if so, don't allow further movement
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
            event.preventDefault();
            return;
        }

        // Set moving flag immediately to prevent race conditions
        timeline.isMoving = true;

        // Prevent default browser behavior for arrow keys and prevent key repeat
        event.preventDefault();
        event.stopPropagation();

        var direction = key.toLowerCase();
        var aimAction = DIRECTIONS[direction].movement;

        // Record move
        window.DataRecording.recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

        // Calculate human move
        var realAction = isValidMove(gameData.gridMatrix, gameData.playerState, aimAction);
        var humanNextState = transition(gameData.playerState, realAction);

        // Calculate AI move simultaneously (before updating the grid)
        var aiAction = null;
        var aiNextState = null;
        if (!isGoalReached(gameData.aiState, gameData.currentGoals) && !isFrozen) {
            aiAction = getAIAction(gameData.gridMatrix, gameData.aiState, gameData.currentGoals, gameData.playerState);
            var aiRealAction = isValidMove(gameData.gridMatrix, gameData.aiState, aiAction);
            aiNextState = transition(gameData.aiState, aiRealAction);
            window.DataRecording.recordAIMove(aiAction);
        }

        // Execute both moves simultaneously
        // Update human position
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.playerState[0], gameData.playerState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, humanNextState[0], humanNextState[1], OBJECT.player);
        gameData.playerState = humanNextState;

        // Update AI position if AI moved
        if (aiNextState) {
            gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.aiState[0], gameData.aiState[1], OBJECT.blank);
            gameData.gridMatrix = updateMatrix(gameData.gridMatrix, aiNextState[0], aiNextState[1], OBJECT.ai_player);
            gameData.aiState = aiNextState;
            window.DataRecording.recordAIMove(aiAction); // Record AI move after position is updated
        }

        // Detect player goals with history tracking (matching original)
        var humanCurrentGoal = detectPlayerGoal(gameData.playerState, aimAction, gameData.currentGoals, humanInferredGoals);
        gameData.currentTrialData.humanCurrentGoal.push(humanCurrentGoal);

        // Update goal history
        if (humanCurrentGoal !== null) {
            humanInferredGoals.push(humanCurrentGoal);
        }

        // Detect AI goals with history tracking (matching original)
        if (aiAction) {
            var aiCurrentGoal = detectPlayerGoal(gameData.aiState, aiAction, gameData.currentGoals, aiInferredGoals);
            gameData.currentTrialData.aiCurrentGoal.push(aiCurrentGoal);

            // Update goal history
            if (aiCurrentGoal !== null) {
                aiInferredGoals.push(aiCurrentGoal);
            }
        }

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check for new goal presentation (matching original logic)
        window.ExpDesign.checkNewGoalPresentation2P3G();

        // Check if human reached goal
        humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);

        // Check win condition
        window.ExpDesign.checkTrialEnd2P3G(() => {
            document.removeEventListener('keydown', handleKeyPress);
            timeline.keyListenerActive = false;
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);
            if (freezeTimeout) clearTimeout(freezeTimeout);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        });

        // Reset movement flag with a small delay to prevent rapid successive key presses
        setTimeout(() => {
            timeline.isMoving = false;
        }, 100); // 100ms delay to prevent rapid successive movements
    }

    // Function to start freeze period when new goal appears
    function startFreezePeriod() {
        isFrozen = true;

        // Clear any existing freeze timeout
        if (freezeTimeout) {
            clearTimeout(freezeTimeout);
        }

        // Set timeout to end freeze period - coordinate with message display duration
        freezeTimeout = setTimeout(() => {
            isFrozen = false;
        }, NODEGAME_CONFIG.timing.newGoalMessageDuration); // Use message duration instead of separate freeze duration
    }

    // Independent AI movement when human has reached goal
    function makeIndependentAIMove() {
        // Check if game data is valid
        if (!gameData || !gameData.aiState || !gameData.currentGoals || !gameData.gridMatrix) {
            return;
        }

        // Don't move if AI has already reached a goal or if movement is frozen
        if (isGoalReached(gameData.aiState, gameData.currentGoals) || isFrozen) {
            return;
        }

        var aiAction = getAIAction(gameData.gridMatrix, gameData.aiState, gameData.currentGoals, gameData.playerState);
        var aiRealAction = isValidMove(gameData.gridMatrix, gameData.aiState, aiAction);
        var aiNextState = transition(gameData.aiState, aiRealAction);

        window.DataRecording.recordAIMove(aiAction);

        // Update AI position
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.aiState[0], gameData.aiState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, aiNextState[0], aiNextState[1], OBJECT.ai_player);
        gameData.aiState = aiNextState;

        // Detect AI goals with history tracking (matching original)
        var aiCurrentGoal = detectPlayerGoal(gameData.aiState, aiAction, gameData.currentGoals, aiInferredGoals);
        gameData.currentTrialData.aiCurrentGoal.push(aiCurrentGoal);

        // Update goal history
        if (aiCurrentGoal !== null) {
            aiInferredGoals.push(aiCurrentGoal);
        }

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check for new goal presentation (matching original logic)
        window.ExpDesign.checkNewGoalPresentation2P3G();

        // Check win condition after AI move
        window.ExpDesign.checkTrialEnd2P3G(() => {
            document.removeEventListener('keydown', handleKeyPress);
            timeline.keyListenerActive = false;
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);
            if (freezeTimeout) clearTimeout(freezeTimeout);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        });
    }

    // Start independent AI movement when human reaches goal
    function startIndependentAIMovement() {
        // Clear any existing interval
        if (aiMoveInterval) {
            clearInterval(aiMoveInterval);
            aiMoveInterval = null;
        }

        aiMoveInterval = setInterval(() => {
            // Check if game data is still valid
            if (!gameData || !gameData.aiState || !gameData.currentGoals) {
                console.log('Game data not available, clearing AI movement interval');
                if (aiMoveInterval) {
                    clearInterval(aiMoveInterval);
                    aiMoveInterval = null;
                }
                return;
            }

            // Only move if AI hasn't reached goal, human has reached goal, and not frozen
            if (!isGoalReached(gameData.aiState, gameData.currentGoals) && humanAtGoal && !isFrozen) {
                makeIndependentAIMove();
            } else if (isGoalReached(gameData.aiState, gameData.currentGoals)) {
                // AI reached goal, stop independent movement
                if (aiMoveInterval) {
                    clearInterval(aiMoveInterval);
                    aiMoveInterval = null;
                }
            }
        }, NODEGAME_CONFIG.independentAgentDelay);
    }

    // Set up controls - prevent multiple listeners
    if (timeline.keyListenerActive) {
        console.log('Removing existing key listener before adding new one');
        document.removeEventListener('keydown', handleKeyPress);
    }
    document.addEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = true;
    document.body.focus();

    // Game timeout
    gameLoopInterval = setInterval(() => {
        if (gameData.stepCount >= NODEGAME_CONFIG.maxGameLength) {
            document.removeEventListener('keydown', handleKeyPress);
            timeline.keyListenerActive = false;
            if (gameLoopInterval) clearInterval(gameLoopInterval);
            if (aiMoveInterval) clearInterval(aiMoveInterval);
            if (freezeTimeout) clearTimeout(freezeTimeout);

            window.DataRecording.finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);

    // Monitor for when human reaches goal to start independent AI movement
    var goalCheckInterval = setInterval(() => {
        // Check if game data is valid
        if (!gameData || !gameData.playerState || !gameData.aiState || !gameData.currentGoals) {
            return;
        }
        // Only start independent AI movement if:
        // 1. Human has actually reached a goal (check current state, not just the flag)
        // 2. AI hasn't reached a goal yet
        // 3. Independent AI movement isn't already running
        // 4. Human has made at least one move (stepCount > 0)
        // 5. Movement is not frozen
        if (gameData.stepCount > 0 &&
            isGoalReached(gameData.playerState, gameData.currentGoals) &&
            !isGoalReached(gameData.aiState, gameData.currentGoals) &&
            !aiMoveInterval &&
            !isFrozen) {
            console.log('2P3G: Starting independent AI movement - human reached goal, AI has not (slower pace: ' + NODEGAME_CONFIG.independentAgentDelay + 'ms)');
            startIndependentAIMovement();
        }
    }, 100);

    // Override the checkNewGoalPresentation2P3G function to trigger freeze
    var originalCheckNewGoal = checkNewGoalPresentation2P3G;
    checkNewGoalPresentation2P3G = function(callback) {
        var wasNewGoalPresented = newGoalPresented;

        // Call the original function
        originalCheckNewGoal(callback);

        // If a new goal was just presented, start the freeze period
        if (!wasNewGoalPresented && newGoalPresented) {
            startFreezePeriod();
        }
    };
}

// Export functions for module usage
window.TrialHandlers = {
    getAIAction: getAIAction,
    runTrialStage: runTrialStage,
    runExperimentTrial: runExperimentTrial,
    runTrial1P1G: runTrial1P1G,
    runTrial1P2G: runTrial1P2G,
    runTrial2P2G: runTrial2P2G,
    runTrial2P3G: runTrial2P3G,
    checkTrialEnd2P2G: checkTrialEnd2P2G
};