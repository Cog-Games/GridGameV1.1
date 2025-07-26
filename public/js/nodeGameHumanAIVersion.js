
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

// Make imported functions globally available for non-module scripts
window.setupGridMatrixForTrial = setupGridMatrixForTrial;
window.transition = transition;
window.calculatetGirdDistance = calculatetGirdDistance;
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
window.runTrialStage = runTrialStage;
window.addCollaborationExperimentStages = addCollaborationExperimentStages;
window.nextStage = nextStage;

// Timeline state
var timeline = {
    currentStage: 0,
    stages: [],
    experimentType: null,
    mapData: null,
    isMoving: false, // Prevent multiple moves per keypress
    keyListenerActive: false // Track if key listener is already active
};

// Make timeline globally available for expTimeline.js
window.timeline = timeline;

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
        window.ExpDesign.checkNewGoalPresentation1P2G();

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
        // Note: Using 0-based indexing from gameHelpers.js (goal 0, 1, 2...)
        var collaboration = (humanGoal === aiGoal && humanGoal !== null);

        console.log(`2P2G Collaboration check: Human goal=${humanGoal}, AI goal=${aiGoal}, Collaboration=${collaboration}`);

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
 * Get random distance condition for 2P3G after trial 12
 * @param {number} trialIndex - Current trial index
 * @returns {string} - Distance condition
 */
function getRandomDistanceConditionFor2P3G(trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var allConditions = [
                    TWOP3G_CONFIG.distanceConditions.CLOSER_TO_PLAYER2,
        TWOP3G_CONFIG.distanceConditions.CLOSER_TO_PLAYER1,
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
                    ONEP2G_CONFIG.distanceConditions.CLOSER_TO_PLAYER1,
        ONEP2G_CONFIG.distanceConditions.FARTHER_TO_PLAYER1,
        ONEP2G_CONFIG.distanceConditions.EQUAL_TO_PLAYER1,
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

        // Enable automatic pre-calculation for joint-RL
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
// 2P3G Functions - Moved to expDesign.js
// =================================================================================================

// Global variables for 2P3G goal tracking (matching original)
var humanInferredGoals = [];
var aiInferredGoals = [];
var newGoalPresented = false;
var newGoalPosition = null;
var isNewGoalCloserToAI = null;

// detectPlayerGoal, generateRandomizedDistanceSequence, and generateRandomized1P2GDistanceSequence functions are imported from nodeGameHelpers.js

// Note: Experimental design functions have been moved to expDesign.js
// The following functions are now available through window.ExpDesign:
// - getDistanceCondition
// - setDistanceConditionSequence
// - generateNewGoal
// - isGoalBlockingPath
// - isInRectangleBetween
// - checkNewGoalPresentation2P3G
// - checkTrialEnd2P3G
// - checkNewGoalPresentation1P2G
// - generateNewGoalFor1P2G

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

// getMapsForExperiment function is imported from nodeGameHelpers.js

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




