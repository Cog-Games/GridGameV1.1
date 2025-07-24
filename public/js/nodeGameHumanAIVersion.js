/**
 * NodeGame Configuration and Setup
 */

// Import nodeGame if available
if (typeof node !== 'undefined') {
    var node = node;
} else if (typeof require !== 'undefined') {
    var node = require('nodegame-client');
}

// Game states and data storage
var gameData = {
    currentExperiment: null,
    currentExperimentIndex: 0, // Track which experiment we're on
    currentTrial: 0,
    allTrialsData: [],
    currentTrialData: {},
    questionnaireData: null, // Store questionnaire responses
    gridMatrix: null,
    playerState: null,
    aiState: null,
    currentGoals: null,
    stepCount: 0,
    gameStartTime: 0,

    // =================================================================================================
    // SUCCESS THRESHOLD TRACKING - FOR COLLABORATION GAMES
    // =================================================================================================
    successThreshold: {
        consecutiveSuccesses: 0,      // Current consecutive successes
        totalTrialsCompleted: 0,      // Total trials completed for current experiment
        experimentEndedEarly: false,  // Whether experiment ended due to success threshold
        lastSuccessTrial: -1,         // Index of last successful trial (-1 if none)
        successHistory: []            // Array of success/failure for each trial
    }
};

// Expose gameData globally for drawing functions
window.gameData = gameData;

// Timeline state
var timeline = {
    currentStage: 0,
    stages: [],
    experimentType: null,
    mapData: null,
    isMoving: false, // Prevent multiple moves per keypress
    keyListenerActive: false // Track if key listener is already active
};

// NodeGame client setup
var gameClient = null;
var isStandaloneMode = false;

/**
 * Initialize NodeGame Client
 */
function initializeNodeGameClient() {
    try {
        // Basic nodeGame setup
        gameClient = node.createClient({
            name: NODEGAME_CONFIG.name,
            version: NODEGAME_CONFIG.version,
            treatments: NODEGAME_CONFIG.treatments
        });

        if (gameClient) {
            return true;
        }
    } catch (error) {
        console.warn('NodeGame not available, falling back to standalone mode:', error);
        return false;
    }
    return false;
}


/**
 * Get AI action
 */
function getAIAction(gridMatrix, currentPos, goals, playerPos = null) {
    if (!goals || goals.length === 0) return [0, 0];

    // Use the RL agent from rlAgent.js
    if (window.RLAgent && window.RLAgent.getAIAction) {
        return window.RLAgent.getAIAction(gridMatrix, currentPos, goals, playerPos);
    } else {
        console.error('RL Agent not loaded. Please ensure rlAgent.js is included before nodeGameHumanAIVersion.js');
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
        var fallbackDesign = createFallbackDesign(experimentType);

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
    initializeTrialData(trialIndex, experimentType, design);

    // Run the appropriate experiment
    runExperimentTrial(experimentType, trialIndex, design);
}

// =================================================================================================
// Helper Functions
// =================================================================================================




// =================================================================================================
// Experiment Implementations
// =================================================================================================


/**
 * Run experiment trial based on type
 */
function runExperimentTrial(experimentType, trialIndex, design) {
    gameData.stepCount = 0;
    gameData.gameStartTime = Date.now();
    timeline.isMoving = false;

    // For collaboration games, use random maps after trial 2, but only if available
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
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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

            finalizeTrial(true);
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

            finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}

/**
 * Run 1P2G trial
 */
function runTrial1P2G() {
    var gameLoopInterval = null;

    // Initialize goal detection tracking for 1P2G
    gameData.currentTrialData.humanCurrentGoal = [];
    gameData.currentTrialData.newGoalPresentedTime = null;
    gameData.currentTrialData.newGoalPosition = null;
    gameData.currentTrialData.newGoalConditionType = null;
    gameData.currentTrialData.newGoalPresented = false; // Initialize flag

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
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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
        checkNewGoalPresentation1P2G();

        // Check win condition
        if (isGoalReached(gameData.playerState, gameData.currentGoals)) {
            document.removeEventListener('keydown', handleKeyPress);
            if (gameLoopInterval) clearInterval(gameLoopInterval);

            finalizeTrial(true);
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

            finalizeTrial(false);
            setTimeout(() => nextStage(), NODEGAME_CONFIG.timing.trialToFeedbackDelay);
        }
    }, 100);
}


function checkTrialEnd2P2G(callback) {
    var humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);
    var aiAtGoal = isGoalReached(gameData.aiState, gameData.currentGoals);

    if (humanAtGoal && aiAtGoal) {
        var humanGoal = whichGoalReached(gameData.playerState, gameData.currentGoals);
        var aiGoal = whichGoalReached(gameData.aiState, gameData.currentGoals);
        var collaboration = (humanGoal === aiGoal && humanGoal !== 0);

        gameData.currentTrialData.collaborationSucceeded = collaboration;
        finalizeTrial(true);
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
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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
            recordAIMove(aiAction); // Record AI move after position is updated
        }

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

        // Check if human reached goal
        humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);

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

        recordAIMove(aiAction);

        // Update AI position
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, gameData.aiState[0], gameData.aiState[1], OBJECT.blank);
        gameData.gridMatrix = updateMatrix(gameData.gridMatrix, aiNextState[0], aiNextState[1], OBJECT.ai_player);
        gameData.aiState = aiNextState;

        gameData.stepCount++;
        nodeGameUpdateGameDisplay();

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

            finalizeTrial(false);
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
 * Run 2P3G trial (matching original testExpWithAI.js logic + AI moves simultaneously with human, but independently if human reaches goal)
 */
function runTrial2P3G() {
    var gameLoopInterval = null;
    var aiMoveInterval = null;
    var humanAtGoal = false;
    var isFrozen = false; // Track if movement is frozen due to new goal
    var freezeTimeout = null; // Track freeze timeout

    // Reset 2P3G specific variables for new trial
    newGoalPresented = false;
    newGoalPosition = null;
    isNewGoalCloserToAI = null;
    humanInferredGoals = [];
    aiInferredGoals = [];

    // Initialize goal inference tracking
    gameData.currentTrialData.humanCurrentGoal = [];
    gameData.currentTrialData.aiCurrentGoal = [];
    gameData.currentTrialData.newGoalPresentedTime = null;
    gameData.currentTrialData.newGoalPosition = null;
    gameData.currentTrialData.isNewGoalCloserToAI = null;

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
        recordPlayerMove(aimAction, Date.now() - gameData.gameStartTime);

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
            recordAIMove(aiAction);
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
            recordAIMove(aiAction); // Record AI move after position is updated
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
        checkNewGoalPresentation2P3G();

        // Check if human reached goal
        humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);

        // Check win condition
        checkTrialEnd2P3G(() => {
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

        recordAIMove(aiAction);

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
        checkNewGoalPresentation2P3G();

        // Check win condition after AI move
        checkTrialEnd2P3G(() => {
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

            finalizeTrial(false);
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

/**
 * Export experiment data with questionnaire (matching jsPsych version)
 */
function exportExperimentData() {
    var finalData = {
        experimentData: gameData.allTrialsData,
        questionnaireData: gameData.questionnaireData,
        metadata: {
            experiment: gameData.currentExperiment,
            timestamp: new Date().toISOString(),
            totalTrials: gameData.allTrialsData.length,
            successRate: calculateSuccessRate()
        }
    };

    try {
        // Export experiment data
        var csvContent = convertToCSV(finalData.experimentData);
        downloadCSV(csvContent, `nodegame_experiment_${gameData.currentExperiment}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);

        // Export questionnaire data if available
        if (gameData.questionnaireData) {
            var questionnaireArray = convertQuestionnaireToArray(gameData.questionnaireData);
            var questionnaireCSV = questionnaireArray.map(row => row.join(',')).join('\n');
            downloadCSV(questionnaireCSV, `questionnaire_data_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);
        }

        console.log('Experiment and questionnaire data exported successfully');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data: ' + error.message);
    }
}

/**
 * Initialize trial data structure
 */
function initializeTrialData(trialIndex, experimentType, design) {
    gameData.currentTrial = trialIndex;
    gameData.stepCount = 0;

    // Reset new goal pre-calculation flag for new trial
    if (window.RLAgent && window.RLAgent.resetNewGoalPreCalculationFlag) {
        window.RLAgent.resetNewGoalPreCalculationFlag();
    }

    // Ensure current experiment is set
    if (experimentType) {
        gameData.currentExperiment = experimentType;
    }

    gameData.currentTrialData = {
        trialIndex: trialIndex,
        experimentType: experimentType,
        trajectory: [],
        aiTrajectory: [],
        aimAction: [],
        aiAction: [],
        RT: [],
        trialStartTime: Date.now(),
        ...design
    };

    // Add distance condition for 2P3G trials
    if (experimentType === '2P3G') {
        // Use random sampling after trial 12, otherwise use pre-selected sequence
        var distanceCondition = getRandomDistanceConditionFor2P3G(trialIndex);
        gameData.currentTrialData.distanceCondition = distanceCondition;

        console.log(`=== 2P3G Trial ${trialIndex + 1} Setup ===`);
        console.log(`Distance condition: ${distanceCondition} (trial ${trialIndex + 1})`);
        console.log(`========================================`);
    }

    // Add distance condition for 1P2G trials
    if (experimentType === '1P2G') {
        // Use random sampling after trial 12, otherwise use pre-selected sequence
        var distanceCondition = getRandomDistanceConditionFor1P2G(trialIndex);
        gameData.currentTrialData.distanceCondition = distanceCondition;

        console.log(`=== 1P2G Trial ${trialIndex + 1} Setup ===`);
        console.log(`Distance condition: ${distanceCondition} (trial ${trialIndex + 1})`);
        console.log(`========================================`);
    }
}

/**
 * Record player move
 */
function recordPlayerMove(action, reactionTime) {
    gameData.currentTrialData.aimAction.push(action);
    gameData.currentTrialData.RT.push(reactionTime);
    gameData.currentTrialData.trajectory.push([...gameData.playerState]);
}

/**
 * Record AI move
 */
function recordAIMove(action) {
    gameData.currentTrialData.aiAction.push(action);
    // Record the trajectory after the move (new position)
    // This will be called after the AI position is updated
    gameData.currentTrialData.aiTrajectory.push([...gameData.aiState]);
}

/**
 * Finalize trial data
 */
function finalizeTrial(completed) {
    gameData.currentTrialData.trialEndTime = Date.now();
    gameData.currentTrialData.trialDuration = gameData.currentTrialData.trialEndTime - gameData.currentTrialData.trialStartTime;
    gameData.currentTrialData.completed = completed;
    gameData.currentTrialData.stepCount = gameData.stepCount;

    // Determine if trial was successful for collaboration games
    var trialSuccess = false;
    if (gameData.currentExperiment && gameData.currentExperiment.includes('2P')) {
        // For collaboration games, success is based on collaboration
        trialSuccess = gameData.currentTrialData.collaborationSucceeded === true;
    } else {
        // For single player games, success is based on completion
        trialSuccess = completed;
    }

    // Update success threshold tracking for collaboration games
    updateSuccessThresholdTracking(trialSuccess, gameData.currentTrial);

    gameData.allTrialsData.push({...gameData.currentTrialData});

    // Reset movement flags to prevent issues in next trial
    timeline.isMoving = false;
    timeline.keyListenerActive = false;

    console.log('Trial finalized:', gameData.currentTrialData);
    console.log(`Trial success: ${trialSuccess} (${gameData.currentExperiment})`);
}

/**
 * Update player position on grid
 */
function updatePlayerPosition(oldPos, newPos) {
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, oldPos[0], oldPos[1], OBJECT.blank);
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, newPos[0], newPos[1], OBJECT.player);
}

/**
 * Update AI position on grid
 */
function updateAIPosition(oldPos, newPos) {
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, oldPos[0], oldPos[1], OBJECT.blank);
    gameData.gridMatrix = updateMatrix(gameData.gridMatrix, newPos[0], newPos[1], OBJECT.ai_player);
}

/**
 * Calculate success rate for stats
 * Uses helper function from nodeGameHelpers.js
 */
function calculateSuccessRate() {
    return window.NodeGameHelpers.calculateSuccessRate();
}


// =================================================================================================
// SUCCESS THRESHOLD HELPER FUNCTIONS - FOR COLLABORATION GAMES
// =================================================================================================

/**
 * Initialize success threshold tracking for a new experiment
 */
function initializeSuccessThresholdTracking() {
    gameData.successThreshold.consecutiveSuccesses = 0;
    gameData.successThreshold.totalTrialsCompleted = 0;
    gameData.successThreshold.experimentEndedEarly = false;
    gameData.successThreshold.lastSuccessTrial = -1;
    gameData.successThreshold.successHistory = [];

    console.log('Success threshold tracking initialized');
}

/**
 * Update success threshold tracking after a trial
 * @param {boolean} success - Whether the trial was successful
 * @param {number} trialIndex - Current trial index
 */
function updateSuccessThresholdTracking(success, trialIndex) {
    // Only track for collaboration games
    if (!gameData.currentExperiment || !gameData.currentExperiment.includes('2P')) {
        return;
    }

    gameData.successThreshold.totalTrialsCompleted++;
    gameData.successThreshold.successHistory.push(success);

    if (success) {
        gameData.successThreshold.consecutiveSuccesses++;
        gameData.successThreshold.lastSuccessTrial = trialIndex;
    } else {
        gameData.successThreshold.consecutiveSuccesses = 0;
    }

    console.log(`Success threshold update - Trial ${trialIndex + 1}: ${success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`  Consecutive successes: ${gameData.successThreshold.consecutiveSuccesses}/${NODEGAME_CONFIG.successThreshold.consecutiveSuccessesRequired}`);
    console.log(`  Total trials: ${gameData.successThreshold.totalTrialsCompleted}/${NODEGAME_CONFIG.successThreshold.maxTrials}`);
}

/**
 * Check if experiment should end due to success threshold
 * @returns {boolean} - True if experiment should end
 */
function shouldEndExperimentDueToSuccessThreshold() {
    // Only apply to collaboration games
    if (!gameData.currentExperiment || !gameData.currentExperiment.includes('2P')) {
        return false;
    }

    // Check if success threshold is enabled
    if (!NODEGAME_CONFIG.successThreshold.enabled) {
        return false;
    }

    var config = NODEGAME_CONFIG.successThreshold;
    var tracking = gameData.successThreshold;

    // Check if we've reached the maximum trials
    if (tracking.totalTrialsCompleted >= config.maxTrials) {
        console.log(`Experiment ending: Reached maximum trials (${config.maxTrials})`);
        return true;
    }

    // Check if we have enough trials and consecutive successes
    if (tracking.totalTrialsCompleted >= config.minTrialsBeforeCheck &&
        tracking.consecutiveSuccesses >= config.consecutiveSuccessesRequired) {
        console.log(`Experiment ending: Success threshold met (${tracking.consecutiveSuccesses} consecutive successes after ${tracking.totalTrialsCompleted} trials)`);
        gameData.successThreshold.experimentEndedEarly = true;
        return true;
    }

    return false;
}
/**
 * Get random distance condition for 2P3G after trial 12
 * @param {number} trialIndex - Current trial index
 * @returns {string} - Distance condition
 */
function getRandomDistanceConditionFor2P3G(trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var allConditions = [
            TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI,
            TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN,
            TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH,
            TWOP3G_CONFIG.distanceConditions.NO_NEW_GOAL
        ];
        var randomCondition = allConditions[Math.floor(Math.random() * allConditions.length)];
        console.log(`Using random distance condition for 2P3G trial ${trialIndex + 1}: ${randomCondition}`);
        return randomCondition;
    } else {
        // Use the pre-selected condition from sequence
        return TWOP3G_CONFIG.distanceConditionSequence[trialIndex];
    }
}

/**
 * Get random distance condition for 1P2G after trial 12
 * @param {number} trialIndex - Current trial index
 * @returns {string} - Distance condition
 */
function getRandomDistanceConditionFor1P2G(trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var allConditions = [
            ONEP2G_CONFIG.distanceConditions.CLOSER_TO_HUMAN,
            ONEP2G_CONFIG.distanceConditions.FARTHER_TO_HUMAN,
            ONEP2G_CONFIG.distanceConditions.EQUAL_TO_HUMAN,
            ONEP2G_CONFIG.distanceConditions.NO_NEW_GOAL
        ];
        var randomCondition = allConditions[Math.floor(Math.random() * allConditions.length)];
        console.log(`Using random distance condition for 1P2G trial ${trialIndex + 1}: ${randomCondition}`);
        return randomCondition;
    } else {
        // Use the pre-selected condition from sequence
        return ONEP2G_CONFIG.distanceConditionSequence[trialIndex];
    }
}

/**
 * Check if we should continue to the next trial or end the experiment
 * @param {string} experimentType - Type of experiment
 * @param {number} trialIndex - Current trial index
 * @returns {boolean} - True if should continue to next trial
 */
function shouldContinueToNextTrial(experimentType, trialIndex) {
    // Only apply to collaboration games
    if (!experimentType.includes('2P')) {
        return true; // Always continue for non-collaboration games
    }

    // Check if experiment should end due to success threshold
    if (shouldEndExperimentDueToSuccessThreshold()) {
        console.log(`Ending ${experimentType} experiment due to success threshold`);
        return false;
    }

    // Check if we've reached the configured number of trials
    var configuredTrials = NODEGAME_CONFIG.numTrials[experimentType];
    if (trialIndex >= configuredTrials - 1) {
        console.log(`Ending ${experimentType} experiment: Completed ${configuredTrials} trials`);
        return false;
    }

    return true;
}

/**
 * Skip to the next experiment or completion stage
 */
function skipToNextExperimentOrCompletion() {
    var currentStage = timeline.stages[timeline.currentStage];
    var currentExperimentType = currentStage.experimentType;

    console.log(`Skipping to next experiment or completion from ${currentExperimentType}`);

    // Find the next stage that's either a different experiment, end-info, or completion
    var nextStageIndex = timeline.currentStage + 1;
    console.log(`Starting search from stage ${nextStageIndex}`);
    while (nextStageIndex < timeline.stages.length) {
        var nextStage = timeline.stages[nextStageIndex];
        console.log(`Checking stage ${nextStageIndex}: ${nextStage.type} - ${nextStage.handler.name}`);

        // If it's a different experiment type, end-info stage, or completion stage, stop here
        if (nextStage.type === 'complete' || nextStage.type === 'end-info' ||
            (nextStage.experimentType && nextStage.experimentType !== currentExperimentType)) {
            console.log(`Found stopping point: ${nextStage.type}`);
            break;
        }
        nextStageIndex++;
    }

    // Set the current stage to the found stage
    timeline.currentStage = nextStageIndex;

    // If we found a valid next stage and it's a different experiment, reset success threshold
    if (timeline.currentStage < timeline.stages.length) {
        var nextStage = timeline.stages[timeline.currentStage];
        if (nextStage.experimentType && nextStage.experimentType !== currentExperimentType) {
            console.log(`Switching from ${currentExperimentType} to ${nextStage.experimentType} - resetting success threshold`);
            initializeSuccessThresholdTracking();
        }
        console.log(`Skipped to stage ${timeline.currentStage}: ${nextStage.type}`);
        runNextStage();
    } else {
        console.log('No more stages to run');
    }
}


/**
 * Add collaboration experiment stages (for dynamic trial generation)
 * @param {string} experimentType - Type of experiment
 * @param {number} experimentIndex - Index of experiment
 * @param {number} trialIndex - Index of trial
 */
function addCollaborationExperimentStages(experimentType, experimentIndex, trialIndex) {
    // Fixation screen
    timeline.stages.push({
        type: 'fixation',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showFixationStage
    });

    // Main trial
    timeline.stages.push({
        type: 'trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: runTrialStage
    });

    // Post-trial feedback with dynamic continuation
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
}

/**
 * Add next trial stages dynamically for collaboration games
 * @param {string} experimentType - Type of experiment
 * @param {number} experimentIndex - Index of experiment
 * @param {number} trialIndex - Index of trial
 */

// =================================================================================================
// NodeGame Event Handlers
// =================================================================================================

function handlePlayerMove(data) {
    console.log('Player move received:', data);
    // Handle multiplayer moves if needed
}

function handleAIMove(data) {
    console.log('AI move received:', data);
    // Handle AI moves from server if needed
}

function handleGameStateUpdate(data) {
    console.log('Game state update:', data);
    // Sync game state if needed
}

function handleTrialComplete(data) {
    console.log('Trial complete:', data);
    // Handle trial completion sync
}

function handleExperimentComplete(data) {
    console.log('Experiment complete:', data);
    // Handle experiment completion
}

// =================================================================================================
// HELPER FUNCTIONS
// =================================================================================================
//
// Helper functions are now in nodeGameHelpers.js
// This keeps the main file focused on experimental logic only.
//

// =================================================================================================
// Initialization and Export
// =================================================================================================

/**
 * Initialize NodeGame experiments
 */
function initializeNodeGameExperiments() {
    console.log('Initializing NodeGame experiments...');

    // Try to initialize nodeGame client
    var nodeGameAvailable = initializeNodeGameClient();

    if (!nodeGameAvailable) {
        console.log('NodeGame not available, using standalone mode');
        isStandaloneMode = true;
    }

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

    console.log('NodeGame experiments ready');
    return true;
}

/**
 * Start a specific experiment
 */
function startNodeGameExperiment(experimentType) {
    if (isStandaloneMode) {
        // Run in standalone mode without nodeGame client
        console.log('Starting experiment in standalone mode:', experimentType);
        startStandaloneExperiment(experimentType);
        return;
    }

    if (!gameClient) {
        console.error('NodeGame client not initialized');
        return;
    }

    // Enable automatic pre-calculation for joint-RL to eliminate lags
    if (window.RLAgent && window.RLAgent.enableAutoPolicyPrecalculation) {
        console.log('✅ Enabling automatic joint-RL policy pre-calculation');
        window.RLAgent.enableAutoPolicyPrecalculation();
    }

    // Set treatment and start
    node.game.setTreatment(experimentType);
    node.start();
}

/**
 * Start experiment in standalone mode (without nodeGame client)
 */
function startStandaloneExperiment(experimentType) {
    try {
        // Clear any existing content
        document.getElementById('container').innerHTML = '';

        // Reset experiment state for continuous experiments
        gameData.currentExperimentIndex = 0;
        gameData.currentTrial = 0;
        gameData.allTrialsData = [];

        // Initialize success threshold tracking
        initializeSuccessThresholdTracking();

        // Enable automatic pre-calculation for joint-RL to eliminate lags
        if (window.RLAgent && window.RLAgent.enableAutoPolicyPrecalculation) {
            console.log('✅ Enabling automatic joint-RL policy pre-calculation');
            window.RLAgent.enableAutoPolicyPrecalculation();
        }

        // Initialize timeline
        timeline.currentStage = 0;

        // Create timeline stages for all experiments
        createTimelineStages();

        // Start timeline
        console.log('Running continuous experiments');
        runNextStage();

    } catch (error) {
        console.error('Error starting standalone experiment:', error);
        showStandaloneError('Error starting experiment: ' + error.message);
    }
}

/**
 * Show error message in standalone mode
 */
function showStandaloneError(message) {
    var container = document.getElementById('container');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h3 style="color: red;">⚠️ Error</h3>
            <p>${message}</p>
            <p style="color: #666; margin-top: 20px;">
                Please make sure all required dependencies are loaded.
            </p>
        </div>
    `;
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
    // console.log('Running stage:', stage.type, 'Index:', timeline.currentStage, 'Handler:', stage.handler.name);

    stage.handler(stage);
}

/**
 * Advance to the next stage
 */
function nextStage() {
    timeline.currentStage++;
    runNextStage();
}


// =================================================================================================
// 2P3G Functions - Rewritten to match original testExpWithAI.js logic
// =================================================================================================

// Global variables for 2P3G goal tracking (matching original)
var humanInferredGoals = [];
var aiInferredGoals = [];
var newGoalPresented = false;
var newGoalPosition = null;
var isNewGoalCloserToAI = null;

/**
 * Detect which goal a player is heading towards based on their action (matching original)
 */
function detectPlayerGoal(playerPos, action, goals, goalHistory) {
    return window.NodeGameHelpers.detectPlayerGoal(playerPos, action, goals, goalHistory);
}

/**
 * Generate randomized distance condition sequence for 2P3G trials
 * Uses helper function from nodeGameHelpers.js
 * @param {number} numTrials - Number of 2P3G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomizedDistanceSequence(numTrials) {
    return window.NodeGameHelpers.generateRandomizedDistanceSequence(numTrials);
}

/**
 * Generate randomized distance condition sequence for 1P2G trials
 * Uses helper function from nodeGameHelpers.js
 * @param {number} numTrials - Number of 1P2G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomized1P2GDistanceSequence(numTrials) {
    return window.NodeGameHelpers.generateRandomized1P2GDistanceSequence(numTrials);
}

/**
 * Get distance condition for a specific trial (helper function)
 * @param {number} trialIndex - Trial index (0-based)
 * @returns {string|null} - Distance condition for the trial, or null if not available
 */
function getDistanceCondition(trialIndex) {
    if (!TWOP3G_CONFIG.distanceConditionSequence || trialIndex >= TWOP3G_CONFIG.distanceConditionSequence.length) {
        return null;
    }
    return TWOP3G_CONFIG.distanceConditionSequence[trialIndex];
}

/**
 * Set a custom distance condition sequence (for testing or manual control)
 * @param {Array} newSequence - Array of distance conditions
 */
function setDistanceConditionSequence(newSequence) {
    TWOP3G_CONFIG.distanceConditionSequence = newSequence;
    console.log('Distance condition sequence manually set to:', newSequence);
}

/**
 * Generate new goal with sophisticated constraints based on distance condition
 * @param {Array} aiPos - AI player position [row, col]
 * @param {Array} humanPos - Human player position [row, col]
 * @param {Array} oldGoals - Array of existing goal positions
 * @param {number} aiCurrentGoalIndex - Index of AI's current goal in oldGoals array
 * @param {string} distanceCondition - Distance condition type ('closer_to_ai', 'closer_to_human', 'equal_to_both', 'no_new_goal')
 * @returns {Object|null} - Object with position and metadata, or null if no goal generated
 */
function generateNewGoal(aiPos, humanPos, oldGoals, aiCurrentGoalIndex, distanceCondition) {
    // Check if no new goal should be generated
    if (distanceCondition === TWOP3G_CONFIG.distanceConditions.NO_NEW_GOAL) {
        if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
            console.log('generateNewGoal: No new goal condition specified');
        }
        return null;
    }

    if (aiCurrentGoalIndex === null || aiCurrentGoalIndex >= oldGoals.length) {
        if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
            console.log('generateNewGoal: Invalid aiCurrentGoalIndex:', aiCurrentGoalIndex);
        }
        return null;
    }

    // Run diagnostic if goal generation logging is enabled
    if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
        debugNewGoalGeneration(aiPos, humanPos, oldGoals, aiCurrentGoalIndex, distanceCondition);
    }

    var aiCurrentGoal = oldGoals[aiCurrentGoalIndex];
    var oldDistanceSum = calculatetGirdDistance(aiPos, aiCurrentGoal) +
                        calculatetGirdDistance(humanPos, aiCurrentGoal);

    if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
        console.log('generateNewGoal: AI at', aiPos, 'Human at', humanPos, 'AI goal:', aiCurrentGoal, 'Condition:', distanceCondition);
    }

    // Find all valid positions for the new goal based on distance condition
    var validPositions = [];
    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            var newGoal = [row, col];

            // Check if position is not occupied by players or obstacles
            if (gameData.gridMatrix[row][col] === OBJECT.blank || gameData.gridMatrix[row][col] === OBJECT.goal) {
                var newGoalDistanceToAI = calculatetGirdDistance(aiPos, newGoal);
                var newGoalDistanceToHuman = calculatetGirdDistance(humanPos, newGoal);
                var newDistanceSum = newGoalDistanceToAI + newGoalDistanceToHuman;

                var aiDistanceToOldGoal = calculatetGirdDistance(aiPos, aiCurrentGoal);
                var humanDistanceToOldGoal = calculatetGirdDistance(humanPos, aiCurrentGoal);

                // Basic constraints that apply to all conditions
                var sumConstraint = TWOP3G_CONFIG.goalConstraints.maintainDistanceSum ?
                    Math.abs(newDistanceSum - oldDistanceSum) < 0.1 : true;
                var blockingConstraint = TWOP3G_CONFIG.goalConstraints.blockPathCheck ?
                    !isGoalBlockingPath(humanPos, newGoal, oldGoals) : true;
                var rectangleConstraint = TWOP3G_CONFIG.goalConstraints.avoidRectangleArea ?
                    !isInRectangleBetween(newGoal, aiPos, aiCurrentGoal) : true;
                var humanDistanceConstraint = newGoalDistanceToHuman >= TWOP3G_CONFIG.goalConstraints.minDistanceFromHuman &&
                                            newGoalDistanceToHuman <= TWOP3G_CONFIG.goalConstraints.maxDistanceFromHuman;

                // Distance condition-specific constraints
                var distanceConditionMet = false;
                var conditionType = '';

                switch (distanceCondition) {
                    case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI:
                        // New goal closer to AI, equal joint distance
                        distanceConditionMet = newGoalDistanceToAI < aiDistanceToOldGoal - TWOP3G_CONFIG.distanceConstraint.closerThreshold &&
                                             Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                        conditionType = 'closer_to_ai';
                        break;

                    case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
                        // New goal closer to human, equal joint distance
                        distanceConditionMet = newGoalDistanceToHuman < humanDistanceToOldGoal - TWOP3G_CONFIG.distanceConstraint.closerThreshold &&
                                             Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                        conditionType = 'closer_to_human';
                        break;

                    case TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH:
                        // New goal equal distance to both human and AI, equal joint distance
                        var distanceDifference = Math.abs(newGoalDistanceToAI - newGoalDistanceToHuman);
                        distanceConditionMet = distanceDifference < 0.1 && // Equal distance to both players
                                             Math.abs(newDistanceSum - oldDistanceSum) < 0.1; // Equal sum distance
                        conditionType = 'equal_to_both';
                        break;

                    default:
                        if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
                            console.log('generateNewGoal: Unknown distance condition:', distanceCondition);
                        }
                        return null;
                }

                if (distanceConditionMet && sumConstraint && blockingConstraint && rectangleConstraint && humanDistanceConstraint) {
                    validPositions.push({
                        position: newGoal,
                        conditionType: conditionType,
                        distanceToAI: newGoalDistanceToAI,
                        distanceToHuman: newGoalDistanceToHuman,
                        distanceSum: newDistanceSum
                    });
                }
            }
        }
    }

    // Return a random valid position, or null if none found
    if (validPositions.length > 0) {
        var selectedGoalData = validPositions[Math.floor(Math.random() * validPositions.length)];
        if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
            console.log('generateNewGoal: Found', validPositions.length, 'valid goals for condition', distanceCondition, 'selected:', selectedGoalData);
            console.log('Sum distance verification - Old sum:', oldDistanceSum, 'New sum:', selectedGoalData.distanceSum, 'Difference:', Math.abs(selectedGoalData.distanceSum - oldDistanceSum));
        }
        return {
            position: selectedGoalData.position,
            conditionType: selectedGoalData.conditionType,
            distanceToAI: selectedGoalData.distanceToAI,
            distanceToHuman: selectedGoalData.distanceToHuman,
            distanceSum: selectedGoalData.distanceSum
        };
    }

    // Fallback: Try with relaxed constraints if no valid positions found
    if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
        console.log('generateNewGoal: No valid goals found with strict constraints, trying relaxed constraints');
    }

    var relaxedValidPositions = [];
    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            var newGoal = [row, col];

            // Only check basic constraints: not occupied and reasonable distance from human
            if (gameData.gridMatrix[row][col] === OBJECT.blank || gameData.gridMatrix[row][col] === OBJECT.goal) {
                var newGoalDistanceToAI = calculatetGirdDistance(aiPos, newGoal);
                var newGoalDistanceToHuman = calculatetGirdDistance(humanPos, newGoal);
                var newDistanceSum = newGoalDistanceToAI + newGoalDistanceToHuman;

                // Relaxed constraints: maintain equal sum but with larger tolerance
                var humanDistanceOk = newGoalDistanceToHuman >= 1; // Minimum 1 distance from human
                var relaxedSumConstraint = Math.abs(newDistanceSum - oldDistanceSum) <= 1; // More relaxed tolerance for sum
                var distanceConditionMet = false;

                switch (distanceCondition) {
                    case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI:
                        // Require new goal to be closer to AI AND maintain approximately equal sum
                        distanceConditionMet = newGoalDistanceToAI < calculatetGirdDistance(aiPos, aiCurrentGoal) && relaxedSumConstraint;
                        break;

                    case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
                        // Require new goal to be closer to human AND maintain approximately equal sum
                        distanceConditionMet = newGoalDistanceToHuman < calculatetGirdDistance(humanPos, aiCurrentGoal) && relaxedSumConstraint;
                        break;

                    case TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH:
                        // Allow larger tolerance for equal distance but still maintain equal sum
                        var distanceDifference = Math.abs(newGoalDistanceToAI - newGoalDistanceToHuman);
                        distanceConditionMet = distanceDifference <= 2 && relaxedSumConstraint; // More relaxed tolerance
                        break;

                    default:
                        distanceConditionMet = relaxedSumConstraint; // At minimum, maintain approximately equal sum
                        break;
                }

                if (humanDistanceOk && distanceConditionMet) {
                    relaxedValidPositions.push({
                        position: newGoal,
                        conditionType: distanceCondition,
                        distanceToAI: newGoalDistanceToAI,
                        distanceToHuman: newGoalDistanceToHuman,
                        distanceSum: newDistanceSum
                    });
                }
            }
        }
    }

    if (relaxedValidPositions.length > 0) {
        var selectedRelaxedGoalData = relaxedValidPositions[Math.floor(Math.random() * relaxedValidPositions.length)];
        if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
            console.log('generateNewGoal: Found', relaxedValidPositions.length, 'valid goals with relaxed constraints, selected:', selectedRelaxedGoalData);
            console.log('Sum distance verification (relaxed) - Old sum:', oldDistanceSum, 'New sum:', selectedRelaxedGoalData.distanceSum, 'Difference:', Math.abs(selectedRelaxedGoalData.distanceSum - oldDistanceSum));
        }
        return {
            position: selectedRelaxedGoalData.position,
            conditionType: selectedRelaxedGoalData.conditionType,
            distanceToAI: selectedRelaxedGoalData.distanceToAI,
            distanceToHuman: selectedRelaxedGoalData.distanceToHuman,
            distanceSum: selectedRelaxedGoalData.distanceSum
        };
    }

    if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
        console.log('generateNewGoal: No valid goals found even with relaxed constraints');
    }
    return null;
}

/**
 * Check if a new goal would block the path from human to the goal (matching original)
 */
function isGoalBlockingPath(humanPos, newGoal, existingGoals) {
    // Check if the new goal is directly adjacent to the human player
    // If so, it might block movement (though goals are passable, this could cause issues)
    var distanceToHuman = calculatetGirdDistance(humanPos, newGoal);
    if (distanceToHuman <= 1) {
        return true; // Too close, might cause blocking issues
    }

    // Check if the new goal is in a position that would make it impossible to reach
    // by creating a "dead end" situation
    var hasValidPath = false;

    // Check if there's at least one valid path to the goal (not blocked by other goals)
    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            var testPos = [row, col];
            if (gameData.gridMatrix[row][col] === OBJECT.blank) {
                var pathToGoal = calculatetGirdDistance(testPos, newGoal);
                var pathFromHuman = calculatetGirdDistance(humanPos, testPos);
                var totalPath = pathFromHuman + pathToGoal;

                // If this path is reasonable and doesn't go through other goals
                if (totalPath <= distanceToHuman + 2) { // Allow some flexibility
                    var pathBlocked = false;
                    for (var i = 0; i < existingGoals.length; i++) {
                        if (calculatetGirdDistance(testPos, existingGoals[i]) <= 1) {
                            pathBlocked = true;
                            break;
                        }
                    }
                    if (!pathBlocked) {
                        hasValidPath = true;
                        break;
                    }
                }
            }
        }
        if (hasValidPath) break;
    }

    return !hasValidPath; // Return true if no valid path exists
}

/**
 * Check if a position is in the rectangular area between two points (matching original)
 */
function isInRectangleBetween(position, point1, point2) {
    var posRow = position[0];
    var posCol = position[1];
    var p1Row = point1[0];
    var p1Col = point1[1];
    var p2Row = point2[0];
    var p2Col = point2[1];

    // Define the rectangular area boundaries
    var minRow = Math.min(p1Row, p2Row);
    var maxRow = Math.max(p1Row, p2Row);
    var minCol = Math.min(p1Col, p2Col);
    var maxCol = Math.max(p1Col, p2Col);

    // Check if the position is within the rectangular area (inclusive of boundaries)
    return (posRow >= minRow && posRow <= maxRow && posCol >= minCol && posCol <= maxCol);
}

/**
 * Check for new goal presentation (matching original logic + configurable)
 */
function checkNewGoalPresentation2P3G(callback) {
    // Reset goal history for new trial if needed
    if (!gameData.currentTrialData.humanCurrentGoal) {
        gameData.currentTrialData.humanCurrentGoal = [];
        gameData.currentTrialData.aiCurrentGoal = [];
        humanInferredGoals = [];
        aiInferredGoals = [];
    }

    // Check minimum steps requirement
    if (gameData.stepCount < TWOP3G_CONFIG.minStepsBeforeNewGoal) {
        return;
    }

    // Get current goals for both players
    var humanCurrentGoal = gameData.currentTrialData.humanCurrentGoal.length > 0 ?
        gameData.currentTrialData.humanCurrentGoal[gameData.currentTrialData.humanCurrentGoal.length - 1] : null;
    var aiCurrentGoal = gameData.currentTrialData.aiCurrentGoal.length > 0 ?
        gameData.currentTrialData.aiCurrentGoal[gameData.currentTrialData.aiCurrentGoal.length - 1] : null;

    if (TWOP3G_CONFIG.debug.logGoalDetection) {
        console.log('checkNewGoalPresentation2P3G: Step', gameData.stepCount, 'Human goal:', humanCurrentGoal, 'AI goal:', aiCurrentGoal);
    }

    // Check if both players are heading to the same goal and new goal hasn't been presented yet
    if (humanCurrentGoal !== null && !newGoalPresented) {
        // Check if both players are heading to the same goal
        if (aiCurrentGoal === humanCurrentGoal) {
            if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
                console.log('checkNewGoalPresentation2P3G: Both players heading to same goal, generating new goal');
            }

            // Get distance condition for this trial
            var distanceCondition = gameData.currentTrialData.distanceCondition || TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;

            // Generate new goal using current positions and distance condition
            var newGoalResult = generateNewGoal(gameData.aiState, gameData.playerState, gameData.currentGoals, aiCurrentGoal, distanceCondition);

            if (newGoalResult) {
                isNewGoalCloserToAI = newGoalResult.conditionType === TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;
                newGoalPosition = newGoalResult.position;



                // Add new goal to the grid and goals list
                gameData.gridMatrix[newGoalPosition[0]][newGoalPosition[1]] = OBJECT.goal;
                gameData.currentGoals.push(newGoalPosition);
                newGoalPresented = true;

                // Reset pre-calculation flag when new goal is added
                if (window.RLAgent && window.RLAgent.resetNewGoalPreCalculationFlag) {
                    window.RLAgent.resetNewGoalPreCalculationFlag();
                }

                // Note: Pre-calculation moved to after visual presentation to avoid lag
                // See vizWithAI.js nodeGameUpdateGameDisplay() for the optimized pre-calculation timing

                // Record in trial data
                gameData.currentTrialData.isNewGoalCloserToAI = isNewGoalCloserToAI;
                gameData.currentTrialData.newGoalPresentedTime = gameData.stepCount;
                gameData.currentTrialData.newGoalPosition = newGoalPosition;
                gameData.currentTrialData.newGoalConditionType = newGoalResult.conditionType;
                gameData.currentTrialData.newGoalDistanceToAI = newGoalResult.distanceToAI;
                gameData.currentTrialData.newGoalDistanceToHuman = newGoalResult.distanceToHuman;
                gameData.currentTrialData.newGoalDistanceSum = newGoalResult.distanceSum;

                // Calculate and record distances to old goal
                var oldGoal = gameData.currentGoals[aiCurrentGoal];
                var aiDistanceToOldGoal = calculatetGirdDistance(gameData.aiState, oldGoal);
                var humanDistanceToOldGoal = calculatetGirdDistance(gameData.playerState, oldGoal);
                gameData.currentTrialData.aiDistanceToOldGoal = aiDistanceToOldGoal;
                gameData.currentTrialData.humanDistanceToOldGoal = humanDistanceToOldGoal;

                                console.log('New goal presented at step', gameData.stepCount, ':', newGoalPosition, 'Condition:', newGoalResult.conditionType);
                console.log('  - Distance to NEW goal - AI:', newGoalResult.distanceToAI, 'Human:', newGoalResult.distanceToHuman);
                console.log('  - Distance to OLD goal - AI:', aiDistanceToOldGoal, 'Human:', humanDistanceToOldGoal);
                nodeGameUpdateGameDisplay();

                if (callback) callback();
            } else {
                if (TWOP3G_CONFIG.debug.logNewGoalGeneration) {
                    console.log('checkNewGoalPresentation2P3G: Failed to generate new goal');
                }
            }
        }
    }
}

/**
 * Check for new goal presentation in 1P2G based on distance condition (similar to 2P3G)
 */
function checkNewGoalPresentation1P2G(callback) {
    // Check minimum steps requirement
    if (gameData.stepCount < ONEP2G_CONFIG.minStepsBeforeNewGoal) {
        return;
    }

    // Get current human goal
    var humanCurrentGoal = gameData.currentTrialData.humanCurrentGoal.length > 0 ?
        gameData.currentTrialData.humanCurrentGoal[gameData.currentTrialData.humanCurrentGoal.length - 1] : null;

    if (ONEP2G_CONFIG.debug.logGoalGeneration) {
        console.log('checkNewGoalPresentation1P2G: Step', gameData.stepCount, 'Human goal:', humanCurrentGoal);
        if (humanCurrentGoal === null) {
            console.log('  - No goal detected yet');
        }
    }

    // Check if human goal is detected and new goal hasn't been presented yet
    console.log('1P2G Goal Check - Step:', gameData.stepCount, 'Human goal:', humanCurrentGoal, 'Presented:', gameData.currentTrialData.newGoalPresented, 'Goals count:', gameData.currentGoals.length);
    if (humanCurrentGoal !== null && !gameData.currentTrialData.newGoalPresented) {
        if (ONEP2G_CONFIG.debug.logGoalGeneration) {
            console.log('checkNewGoalPresentation1P2G: Human goal detected, presenting new goal');
            console.log('  - Human goal index:', humanCurrentGoal);
            console.log('  - Current goals:', gameData.currentGoals);
        }

        // Get distance condition for this trial
        var distanceCondition = gameData.currentTrialData.distanceCondition || ONEP2G_CONFIG.distanceConditions.CLOSER_TO_HUMAN;

        // Check if no new goal condition
        if (distanceCondition === ONEP2G_CONFIG.distanceConditions.NO_NEW_GOAL) {
            console.log('1P2G: No new goal condition - no new goal will be presented');
            gameData.currentTrialData.newGoalPresented = true; // Mark as handled
            return;
        }

        // Present new goal when human goal is detected (similar to 2P3G logic)
        if (gameData.currentGoals.length >= 2) {
            // console.log('1P2G: Presenting third goal - human goal detected');
            var firstGoal = gameData.currentGoals[0];

            // Generate new goal position based on distance condition
            var newGoal = generateNewGoalFor1P2G(firstGoal, distanceCondition);

            if (newGoal) {


                // Add new goal to the grid and goals list (like 2P3G)
                gameData.gridMatrix[newGoal[0]][newGoal[1]] = OBJECT.goal;
                gameData.currentGoals.push(newGoal);

                // Reset pre-calculation flag when new goal is added
                if (window.RLAgent && window.RLAgent.resetNewGoalPreCalculationFlag) {
                    window.RLAgent.resetNewGoalPreCalculationFlag();
                }

                // Mark as presented
                gameData.currentTrialData.newGoalPresented = true;

                // Record in trial data
                gameData.currentTrialData.newGoalPresentedTime = gameData.stepCount;
                gameData.currentTrialData.newGoalPosition = newGoal;
                gameData.currentTrialData.newGoalConditionType = distanceCondition;

                // Calculate and record distances
                var humanDistanceToFirstGoal = calculatetGirdDistance(gameData.playerState, firstGoal);
                var humanDistanceToNewGoal = calculatetGirdDistance(gameData.playerState, newGoal);
                gameData.currentTrialData.humanDistanceToFirstGoal = humanDistanceToFirstGoal;
                gameData.currentTrialData.humanDistanceToNewGoal = humanDistanceToNewGoal;

                                console.log('New goal presented at step', gameData.stepCount, ':', newGoal, 'Condition:', distanceCondition);
                console.log('  - Distance to FIRST goal:', humanDistanceToFirstGoal);
                console.log('  - Distance to NEW goal:', humanDistanceToNewGoal);
                nodeGameUpdateGameDisplay();

                if (callback) callback();
            } else {
                if (ONEP2G_CONFIG.debug.logGoalGeneration) {
                    console.log('checkNewGoalPresentation1P2G: Failed to generate new goal');
                }
            }
        } else {
            console.log('1P2G: Not presenting new goal - not enough goals:', gameData.currentGoals.length);
        }
    }
}

/**
 * Check trial end for 2P3G (matching original)
 */
function checkTrialEnd2P3G(callback) {
    var humanAtGoal = isGoalReached(gameData.playerState, gameData.currentGoals);
    var aiAtGoal = isGoalReached(gameData.aiState, gameData.currentGoals);

    if (humanAtGoal && aiAtGoal) {
        var humanGoal = whichGoalReached(gameData.playerState, gameData.currentGoals);
        var aiGoal = whichGoalReached(gameData.aiState, gameData.currentGoals);
        var collaboration = (humanGoal === aiGoal && humanGoal !== 0);

        gameData.currentTrialData.collaborationSucceeded = collaboration;
        finalizeTrial(true);

        // Reset 2P3G specific variables for next trial
        newGoalPresented = false;
        newGoalPosition = null;
        isNewGoalCloserToAI = null;
        humanInferredGoals = [];
        aiInferredGoals = [];

        if (callback) callback();
    } else if (humanAtGoal && !aiAtGoal) {
        // Show wait message when human reached goal but AI hasn't
        showWaitMessage();
    }
}

/**
 * Generate new goal for 1P2G based on distance condition (similar to 2P3G)
 * @param {Array} firstGoal - Position of the first goal [row, col]
 * @param {string} distanceCondition - Distance condition type
 * @returns {Array|null} - Position of the new goal or null if not found
 */
function generateNewGoalFor1P2G(firstGoal, distanceCondition) {
    if (!firstGoal || !Array.isArray(firstGoal) || firstGoal.length < 2) {
        console.error('Invalid first goal provided to generateNewGoalFor1P2G:', firstGoal);
        return null;
    }

    // if (ONEP2G_CONFIG.debug.logGoalGeneration) {
    //     console.log('generateSecondGoalFor1P2G: First goal:', firstGoal, 'Condition:', distanceCondition);
    // }

    // Get human player position
    var humanPos = gameData.playerState;
    if (!humanPos || !Array.isArray(humanPos) || humanPos.length < 2) {
        console.error('Invalid human position for 1P2G goal generation');
        return null;
    }

    var humanDistanceToFirstGoal = calculatetGirdDistance(humanPos, firstGoal);

    if (ONEP2G_CONFIG.debug.logGoalGeneration) {
        console.log('generateSecondGoalFor1P2G: Human at', humanPos, 'Distance to first goal:', humanDistanceToFirstGoal);
    }

    // Find all valid positions for the second goal based on distance condition
    var validPositions = [];
    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            var secondGoal = [row, col];

            // Check if position is not occupied by players, obstacles, or existing goals
            if (gameData.gridMatrix[row][col] === OBJECT.blank) {
                // Skip if this position is already occupied by any existing goal
                var isOccupiedByGoal = false;
                for (var i = 0; i < gameData.currentGoals.length; i++) {
                    if (row === gameData.currentGoals[i][0] && col === gameData.currentGoals[i][1]) {
                        isOccupiedByGoal = true;
                        break;
                    }
                }
                if (isOccupiedByGoal) {
                    continue;
                }

                var humanDistanceToSecondGoal = calculatetGirdDistance(humanPos, secondGoal);
                var distanceBetweenGoals = calculatetGirdDistance(firstGoal, secondGoal);

                // Basic constraints that apply to all conditions
                var humanDistanceConstraint = humanDistanceToSecondGoal >= ONEP2G_CONFIG.goalConstraints.minDistanceFromHuman &&
                                            humanDistanceToSecondGoal <= ONEP2G_CONFIG.goalConstraints.maxDistanceFromHuman;
                var goalDistanceConstraint = distanceBetweenGoals >= ONEP2G_CONFIG.goalConstraints.minDistanceBetweenGoals;

                // Distance condition-specific constraints
                var distanceConditionMet = false;
                var conditionType = '';

                switch (distanceCondition) {
                    case ONEP2G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
                        // Second goal closer to human than first goal
                        distanceConditionMet = humanDistanceToSecondGoal < humanDistanceToFirstGoal - ONEP2G_CONFIG.distanceConstraint.closerThreshold;
                        conditionType = 'closer_to_human';
                        break;

                    case ONEP2G_CONFIG.distanceConditions.FARTHER_TO_HUMAN:
                        // Second goal farther to human than first goal
                        distanceConditionMet = humanDistanceToSecondGoal > humanDistanceToFirstGoal + ONEP2G_CONFIG.distanceConstraint.fartherThreshold;
                        conditionType = 'farther_to_human';
                        break;

                    case ONEP2G_CONFIG.distanceConditions.EQUAL_TO_HUMAN:
                        // Second goal equal distance to human as first goal
                        var distanceDifference = Math.abs(humanDistanceToSecondGoal - humanDistanceToFirstGoal);
                        distanceConditionMet = distanceDifference <= ONEP2G_CONFIG.distanceConstraint.equalTolerance;
                        conditionType = 'equal_to_human';
                        break;

                    default:
                        if (ONEP2G_CONFIG.debug.logGoalGeneration) {
                            console.log('generateSecondGoalFor1P2G: Unknown distance condition:', distanceCondition);
                        }
                        return null;
                }

                if (distanceConditionMet && humanDistanceConstraint && goalDistanceConstraint) {
                    validPositions.push({
                        position: secondGoal,
                        conditionType: conditionType,
                        distanceToHuman: humanDistanceToSecondGoal,
                        distanceToFirstGoal: humanDistanceToFirstGoal,
                        distanceBetweenGoals: distanceBetweenGoals
                    });
                }
            }
        }
    }

    // Return a random valid position, or null if none found
    if (validPositions.length > 0) {
        var selectedGoalData = validPositions[Math.floor(Math.random() * validPositions.length)];
        if (ONEP2G_CONFIG.debug.logGoalGeneration) {
            console.log('generateSecondGoalFor1P2G: Found', validPositions.length, 'valid goals for condition', distanceCondition, 'selected:', selectedGoalData);
        }
        return selectedGoalData.position;
    }

    // Fallback: Try with relaxed constraints if no valid positions found
    if (ONEP2G_CONFIG.debug.logGoalGeneration) {
        console.log('generateSecondGoalFor1P2G: No valid goals found with strict constraints, trying relaxed constraints');
    }

    var relaxedValidPositions = [];
    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            var secondGoal = [row, col];

            // Only check basic constraints: not occupied and reasonable distance from human
            if (gameData.gridMatrix[row][col] === OBJECT.blank) {
                // Skip if this position is already occupied by any existing goal
                var isOccupiedByGoal = false;
                for (var i = 0; i < gameData.currentGoals.length; i++) {
                    if (row === gameData.currentGoals[i][0] && col === gameData.currentGoals[i][1]) {
                        isOccupiedByGoal = true;
                        break;
                    }
                }
                if (isOccupiedByGoal) {
                    continue;
                }

                var humanDistanceToSecondGoal = calculatetGirdDistance(humanPos, secondGoal);
                var distanceBetweenGoals = calculatetGirdDistance(firstGoal, secondGoal);

                // Relaxed constraints
                var humanDistanceOk = humanDistanceToSecondGoal >= 1; // Minimum 1 distance from human
                var goalDistanceOk = distanceBetweenGoals >= 2; // Minimum 2 distance between goals
                var distanceConditionMet = false;

                switch (distanceCondition) {
                    case ONEP2G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
                        // Require new goal to be closer to human (with more relaxed threshold)
                        distanceConditionMet = humanDistanceToSecondGoal < humanDistanceToFirstGoal;
                        break;

                    case ONEP2G_CONFIG.distanceConditions.FARTHER_TO_HUMAN:
                        // Require new goal to be farther to human (with more relaxed threshold)
                        distanceConditionMet = humanDistanceToSecondGoal > humanDistanceToFirstGoal;
                        break;

                    case ONEP2G_CONFIG.distanceConditions.EQUAL_TO_HUMAN:
                        // Allow larger tolerance for equal distance
                        var distanceDifference = Math.abs(humanDistanceToSecondGoal - humanDistanceToFirstGoal);
                        distanceConditionMet = distanceDifference <= 3; // More relaxed tolerance
                        break;

                    default:
                        distanceConditionMet = true; // Accept any position
                        break;
                }

                if (humanDistanceOk && goalDistanceOk && distanceConditionMet) {
                    relaxedValidPositions.push({
                        position: secondGoal,
                        conditionType: distanceCondition,
                        distanceToHuman: humanDistanceToSecondGoal,
                        distanceToFirstGoal: humanDistanceToFirstGoal,
                        distanceBetweenGoals: distanceBetweenGoals
                    });
                }
            }
        }
    }

    if (relaxedValidPositions.length > 0) {
        var selectedRelaxedGoalData = relaxedValidPositions[Math.floor(Math.random() * relaxedValidPositions.length)];
        if (ONEP2G_CONFIG.debug.logGoalGeneration) {
            console.log('generateSecondGoalFor1P2G: Found', relaxedValidPositions.length, 'valid goals with relaxed constraints, selected:', selectedRelaxedGoalData);
        }
        return selectedRelaxedGoalData.position;
    }

    if (ONEP2G_CONFIG.debug.logGoalGeneration) {
        console.log('generateSecondGoalFor1P2G: No valid goals found even with relaxed constraints');
    }
    return null;
}

/**
 * Create a fallback design when map data is not available
 * @param {string} experimentType - Type of experiment
 * @returns {Object|null} - Fallback design or null if not supported
 */
function createFallbackDesign(experimentType) {
    console.log('Creating fallback design for:', experimentType);

    // Basic 15x15 grid design
    var matrixSize = EXPSETTINGS.matrixsize || 15;

    switch (experimentType) {
        case '1P1G':
            return {
                initPlayerGrid: [7, 2],
                target1: [7, 12],
                mapType: '1P1G'
            };

        case '1P2G':
            return {
                initPlayerGrid: [7, 7],
                target1: [2, 7],
                target2: [12, 7],
                mapType: '1P2G'
            };

        case '2P2G':
            return {
                initPlayerGrid: [7, 2],
                initAIGrid: [7, 12],
                target1: [2, 7],
                target2: [12, 7],
                mapType: '2P2G'
            };

        case '2P3G':
            return {
                initPlayerGrid: [7, 2],
                initAIGrid: [7, 12],
                target1: [2, 7],
                target2: [12, 7],
                mapType: '2P3G'
            };

        default:
            console.error('No fallback design for experiment type:', experimentType);
            return null;
    }
}

/**
 * Get maps for experiment type
 */
function getMapsForExperiment(experimentType) {
    return window.NodeGameHelpers.getMapsForExperiment(experimentType);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeNodeGameExperiments,
        startNodeGameExperiment,
        gameData,
        NODEGAME_CONFIG,
        TWOP3G_CONFIG,
        ONEP2G_CONFIG
    };
}

// Global functions for easy access
window.NodeGameExperiments = {
    initialize: initializeNodeGameExperiments,
    start: startNodeGameExperiment,
    data: gameData,
    config: NODEGAME_CONFIG,
    twop3gConfig: TWOP3G_CONFIG,
    onep2gConfig: ONEP2G_CONFIG,

    // Experiment selection helpers
    setExperiment1P1G: setExperiment1P1G,
    setExperiment1P2G: setExperiment1P2G,
    setExperiment2P2G: setExperiment2P2G,
    setExperiment2P3G: setExperiment2P3G,
    setExperimentAll: setExperimentAll,
    setExperimentCollaboration: setExperimentCollaboration,
    setExperimentSinglePlayer: setExperimentSinglePlayer,
    setCustomExperimentOrder: setCustomExperimentOrder,

    // RL Agent functions (from rlAgent.js)
    setRLAgentSimple: function() {
        if (window.RLAgent) window.RLAgent.setRLAgentType('individual');
    },
    setRLAgentIndividual: function() {
        if (window.RLAgent) window.RLAgent.setRLAgentIndividual();
    },
    setRLAgentJoint: function() {
        if (window.RLAgent) window.RLAgent.setRLAgentJoint();
    },
    setRLAgentType: function(type) {
        if (window.RLAgent) window.RLAgent.setRLAgentType(type);
    },
    updateRLAgentConfig: function(config) {
        if (window.RLAgent) window.RLAgent.updateRLAgentConfig(config);
    },
    getRLAgentType: function() {
        return window.RLAgent ? window.RLAgent.getRLAgentType() : 'individual';
    },
    getRLAgentConfig: function() {
        return window.RLAgent ? window.RLAgent.getRLAgentConfig() : {};
    },

    // Data saving functions
    saveDataToGoogleDrive: saveDataToGoogleDrive,
    exportExperimentData: exportExperimentData,
    downloadExcel: downloadExcel,
    downloadCSV: downloadCSV,

    // Helper functions for distance conditions
    getDistanceCondition: function(trialIndex) {
        var distanceConditionIndex = trialIndex % TWOP3G_CONFIG.distanceConditionSequence.length;
        return TWOP3G_CONFIG.distanceConditionSequence[distanceConditionIndex];
    },

    setDistanceConditionSequence: function(newSequence) {
        TWOP3G_CONFIG.distanceConditionSequence = newSequence;
        console.log('Distance condition sequence updated:', newSequence);
    },

    // Helper functions for 1P2G distance conditions
    get1P2GDistanceCondition: function(trialIndex) {
        var distanceConditionIndex = trialIndex % ONEP2G_CONFIG.distanceConditionSequence.length;
        return ONEP2G_CONFIG.distanceConditionSequence[distanceConditionIndex];
    },

    set1P2GDistanceConditionSequence: function(newSequence) {
        ONEP2G_CONFIG.distanceConditionSequence = newSequence;
        console.log('1P2G distance condition sequence updated:', newSequence);
    },

    // Success threshold functions
    initializeSuccessThreshold: initializeSuccessThresholdTracking,
    updateSuccessThreshold: updateSuccessThresholdTracking,
    shouldEndExperiment: shouldEndExperimentDueToSuccessThreshold,
    getSuccessThresholdStatus: function() {
        return {
            consecutiveSuccesses: gameData.successThreshold.consecutiveSuccesses,
            totalTrialsCompleted: gameData.successThreshold.totalTrialsCompleted,
            experimentEndedEarly: gameData.successThreshold.experimentEndedEarly,
            successHistory: gameData.successThreshold.successHistory
        };
    },

    // Configuration helpers
    setSuccessThresholdConfig: function(config) {
        Object.assign(NODEGAME_CONFIG.successThreshold, config);
        console.log('Success threshold configuration updated:', NODEGAME_CONFIG.successThreshold);
    },

    // Debug helpers
    createFallbackDesign: createFallbackDesign,
    getMapsForExperiment: getMapsForExperiment,
    selectRandomMaps: selectRandomMaps
};

// Auto-initialize if nodeGame is available
if (typeof node !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeNodeGameExperiments);
}


/**
 * Diagnostic function to help debug new goal generation failures
 * Tests each constraint individually and reports which ones are failing
 */
function debugNewGoalGeneration(aiPos, humanPos, oldGoals, aiCurrentGoalIndex, distanceCondition) {
    if (aiCurrentGoalIndex === null || aiCurrentGoalIndex >= oldGoals.length) {
        console.log('DEBUG: Invalid aiCurrentGoalIndex:', aiCurrentGoalIndex);
        return;
    }

    var aiCurrentGoal = oldGoals[aiCurrentGoalIndex];
    var oldDistanceSum = calculatetGirdDistance(aiPos, aiCurrentGoal) +
                        calculatetGirdDistance(humanPos, aiCurrentGoal);
    var aiDistanceToOldGoal = calculatetGirdDistance(aiPos, aiCurrentGoal);
    var humanDistanceToOldGoal = calculatetGirdDistance(humanPos, aiCurrentGoal);

    console.log('DEBUG: Setup - AI:', aiPos, 'Human:', humanPos, 'AI Current Goal:', aiCurrentGoal);
    console.log('DEBUG: Old distance sum:', oldDistanceSum, 'AI to old goal:', aiDistanceToOldGoal, 'Human to old goal:', humanDistanceToOldGoal);
    console.log('DEBUG: Distance condition:', distanceCondition);
    console.log('DEBUG: Matrix size:', EXPSETTINGS.matrixsize);

    var totalPositions = 0;
    var validPositions = 0;
    var constraintFailures = {
        occupied: 0,
        sumConstraint: 0,
        blockingConstraint: 0,
        rectangleConstraint: 0,
        humanDistanceConstraint: 0,
        distanceConditionMet: 0
    };

    for (var row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (var col = 0; col < EXPSETTINGS.matrixsize; col++) {
            totalPositions++;
            var newGoal = [row, col];

            // Check if position is not occupied by players or obstacles
            if (!(gameData.gridMatrix[row][col] === OBJECT.blank || gameData.gridMatrix[row][col] === OBJECT.goal)) {
                constraintFailures.occupied++;
                continue;
            }

            var newGoalDistanceToAI = calculatetGirdDistance(aiPos, newGoal);
            var newGoalDistanceToHuman = calculatetGirdDistance(humanPos, newGoal);
            var newDistanceSum = newGoalDistanceToAI + newGoalDistanceToHuman;

            // Basic constraints that apply to all conditions
            var sumConstraint = TWOP3G_CONFIG.goalConstraints.maintainDistanceSum ?
                Math.abs(newDistanceSum - oldDistanceSum) < 0.1 : true;
            var blockingConstraint = TWOP3G_CONFIG.goalConstraints.blockPathCheck ?
                !isGoalBlockingPath(humanPos, newGoal, oldGoals) : true;
            var rectangleConstraint = TWOP3G_CONFIG.goalConstraints.avoidRectangleArea ?
                !isInRectangleBetween(newGoal, aiPos, aiCurrentGoal) : true;
            var humanDistanceConstraint = newGoalDistanceToHuman >= TWOP3G_CONFIG.goalConstraints.minDistanceFromHuman &&
                                        newGoalDistanceToHuman <= TWOP3G_CONFIG.goalConstraints.maxDistanceFromHuman;

            // Count constraint failures
            if (!sumConstraint) constraintFailures.sumConstraint++;
            if (!blockingConstraint) constraintFailures.blockingConstraint++;
            if (!rectangleConstraint) constraintFailures.rectangleConstraint++;
            if (!humanDistanceConstraint) constraintFailures.humanDistanceConstraint++;

            // Distance condition-specific constraints
            var distanceConditionMet = false;

            switch (distanceCondition) {
                case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI:
                    distanceConditionMet = newGoalDistanceToAI < aiDistanceToOldGoal - TWOP3G_CONFIG.distanceConstraint.closerThreshold &&
                                         Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                    break;

                case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
                    distanceConditionMet = newGoalDistanceToHuman < humanDistanceToOldGoal - TWOP3G_CONFIG.distanceConstraint.closerThreshold &&
                                         Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                    break;

                case TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH:
                    var distanceDifference = Math.abs(newGoalDistanceToAI - newGoalDistanceToHuman);
                    distanceConditionMet = distanceDifference < 0.1 && // Equal distance to both players
                                         Math.abs(newDistanceSum - oldDistanceSum) < 0.1; // Equal sum distance
                    break;

                default:
                    console.log('DEBUG: Unknown distance condition:', distanceCondition);
                    return;
            }

            if (!distanceConditionMet) constraintFailures.distanceConditionMet++;

            if (distanceConditionMet && sumConstraint && blockingConstraint && rectangleConstraint && humanDistanceConstraint) {
                validPositions++;
            }
        }
    }

    console.log('DEBUG: Total positions checked:', totalPositions);
    console.log('DEBUG: Valid positions found:', validPositions);
    console.log('DEBUG: Constraint failures:');
    console.log('  - Occupied positions:', constraintFailures.occupied);
    console.log('  - Sum constraint failures:', constraintFailures.sumConstraint);
    console.log('  - Blocking constraint failures:', constraintFailures.blockingConstraint);
    console.log('  - Rectangle constraint failures:', constraintFailures.rectangleConstraint);
    console.log('  - Human distance constraint failures:', constraintFailures.humanDistanceConstraint);
    console.log('  - Distance condition failures:', constraintFailures.distanceConditionMet);

    // Show constraint values
    console.log('DEBUG: Constraint settings:');
    console.log('  - closerThreshold:', TWOP3G_CONFIG.distanceConstraint.closerThreshold);
    console.log('  - minDistanceFromHuman:', TWOP3G_CONFIG.goalConstraints.minDistanceFromHuman);
    console.log('  - maxDistanceFromHuman:', TWOP3G_CONFIG.goalConstraints.maxDistanceFromHuman);
    console.log('  - maintainDistanceSum:', TWOP3G_CONFIG.goalConstraints.maintainDistanceSum);
    console.log('  - avoidRectangleArea:', TWOP3G_CONFIG.goalConstraints.avoidRectangleArea);
    console.log('  - blockPathCheck:', TWOP3G_CONFIG.goalConstraints.blockPathCheck);
}

// =================================================================================================
// EXPERIMENT SELECTION HELPER FUNCTIONS
// =================================================================================================

/**
 * Set experiment to 1P1G only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperiment1P1G() {
    return window.NodeGameHelpers.setExperiment1P1G();
}

/**
 * Set experiment to 1P2G only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperiment1P2G() {
    return window.NodeGameHelpers.setExperiment1P2G();
}

/**
 * Set experiment to 2P2G only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperiment2P2G() {
    return window.NodeGameHelpers.setExperiment2P2G();
}

/**
 * Set experiment to 2P3G only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperiment2P3G() {
    return window.NodeGameHelpers.setExperiment2P3G();
}

/**
 * Set experiment to all experiments
 * Uses helper function from nodeGameHelpers.js
 */
function setExperimentAll() {
    return window.NodeGameHelpers.setExperimentAll();
}

/**
 * Set experiment to collaboration games only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperimentCollaboration() {
    return window.NodeGameHelpers.setExperimentCollaboration();
}

/**
 * Set experiment to single player games only
 * Uses helper function from nodeGameHelpers.js
 */
function setExperimentSinglePlayer() {
    return window.NodeGameHelpers.setExperimentSinglePlayer();
}

/**
 * Set custom experiment order
 * Uses helper function from nodeGameHelpers.js
 * @param {Array} experimentOrder - Array of experiment types
 */
function setCustomExperimentOrder(experimentOrder) {
    return window.NodeGameHelpers.setCustomExperimentOrder(experimentOrder);
}


// RL Agent functions are now imported from rlAgent.js
// The following functions are available through window.RLAgent:
// - getAIAction
// - setRLAgentType
// - setRLAgentIndividual
// - setRLAgentJoint
// - updateRLAgentConfig
// - getRLAgentType
// - getRLAgentConfig

