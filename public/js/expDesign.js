/**
 * Experimental Design Functions
 *
 * This file contains functions related to experimental design, goal generation,
 * and trial management that can be shared across different experiment types.
 *
 * Dependencies:
 * - experimentConfig.js (for TWOP3G_CONFIG, ONEP2G_CONFIG)
 * - utils.js (for calculatetGirdDistance)
 * - setup.js (for EXPSETTINGS, OBJECT)
 */

// =================================================================================================
// 2P3G Functions - Experimental Design Logic
// =================================================================================================

// Global variables for 2P3G goal tracking (matching original)
var humanInferredGoals = [];
var aiInferredGoals = [];
var newGoalPresented = false;
var newGoalPosition = null;
var isNewGoalCloserToAI = null;

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
        return null;
    }

    if (aiCurrentGoalIndex === null || aiCurrentGoalIndex >= oldGoals.length) {
        return null;
    }


    var aiCurrentGoal = oldGoals[aiCurrentGoalIndex];
    var oldDistanceSum = calculatetGirdDistance(aiPos, aiCurrentGoal) +
                        calculatetGirdDistance(humanPos, aiCurrentGoal);

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
        return {
            position: selectedGoalData.position,
            conditionType: selectedGoalData.conditionType,
            distanceToAI: selectedGoalData.distanceToAI,
            distanceToHuman: selectedGoalData.distanceToHuman,
            distanceSum: selectedGoalData.distanceSum
        };
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
        return {
            position: selectedRelaxedGoalData.position,
            conditionType: selectedRelaxedGoalData.conditionType,
            distanceToAI: selectedRelaxedGoalData.distanceToAI,
            distanceToHuman: selectedRelaxedGoalData.distanceToHuman,
            distanceSum: selectedRelaxedGoalData.distanceSum
        };
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
 * Check for new goal presentation - Unified version supporting both human-AI and human-human modes
 * @param {Object} [options={}] - Configuration options for different experiment versions
 * @param {Function} [options.callback] - Callback function after goal presentation
 * @param {boolean} [options.isHumanHuman] - Whether this is human-human mode (vs human-AI)
 * @param {Function} [options.serverRequestHandler] - Handler for server-side goal generation (human-human mode)
 * @param {Function} [options.displayUpdater] - Custom display update function
 */
function checkNewGoalPresentation2P3G(options) {
    // Handle both old callback-only signature and new options signature
    if (typeof options === 'function') {
        options = { callback: options };
    }
    options = options || {};

    console.log('=== UNIFIED 2P3G NEW GOAL CHECK START ===');
    console.log('Options:', options);

    // Detect version automatically if not specified
    var isHumanHuman = options.isHumanHuman;
    if (isHumanHuman === undefined) {
        // Auto-detect based on available data structures
        isHumanHuman = (typeof socket !== 'undefined' && socket &&
                       gameData.currentTrialData.player1CurrentGoal !== undefined) ||
                      (gameData.multiplayer && gameData.multiplayer.myPlayerId);
    }

    console.log('Detected mode:', isHumanHuman ? 'Human-Human' : 'Human-AI');

    // Get goal tracking arrays based on version
    var player1Goals, player2Goals, player1InferredGoals, player2InferredGoals;

    if (isHumanHuman) {
        // Human-Human version: Use player1/player2 naming
        if (!gameData.currentTrialData.player1CurrentGoal) {
            gameData.currentTrialData.player1CurrentGoal = [];
            gameData.currentTrialData.player2CurrentGoal = [];
            if (typeof window !== 'undefined') {
                window.player1InferredGoals = window.player1InferredGoals || [];
                window.player2InferredGoals = window.player2InferredGoals || [];
            }
        }
        player1Goals = gameData.currentTrialData.player1CurrentGoal;
        player2Goals = gameData.currentTrialData.player2CurrentGoal;
        player1InferredGoals = (typeof window !== 'undefined') ? window.player1InferredGoals : [];
        player2InferredGoals = (typeof window !== 'undefined') ? window.player2InferredGoals : [];
    } else {
        // Human-AI version: Use human/AI naming
        if (!gameData.currentTrialData.humanCurrentGoal) {
            gameData.currentTrialData.humanCurrentGoal = [];
            gameData.currentTrialData.aiCurrentGoal = [];
            if (typeof window !== 'undefined') {
                window.humanInferredGoals = window.humanInferredGoals || [];
                window.aiInferredGoals = window.aiInferredGoals || [];
            }
        }
        player1Goals = gameData.currentTrialData.humanCurrentGoal;
        player2Goals = gameData.currentTrialData.aiCurrentGoal;
        player1InferredGoals = (typeof window !== 'undefined') ? window.humanInferredGoals : [];
        player2InferredGoals = (typeof window !== 'undefined') ? window.aiInferredGoals : [];
    }

    // Check minimum steps requirement
    if (gameData.stepCount < TWOP3G_CONFIG.minStepsBeforeNewGoal) {
        console.log('Minimum steps not met:', gameData.stepCount, '<', TWOP3G_CONFIG.minStepsBeforeNewGoal);
        return;
    }

    // Get current goals for both players
    var player1CurrentGoal = player1Goals.length > 0 ?
        player1Goals[player1Goals.length - 1] : null;
    var player2CurrentGoal = player2Goals.length > 0 ?
        player2Goals[player2Goals.length - 1] : null;

    console.log('Current goals - Player1:', player1CurrentGoal, 'Player2:', player2CurrentGoal);
    console.log('New goal presented:', (typeof newGoalPresented !== 'undefined') ? newGoalPresented : 'undefined');

    // Check if both players are heading to the same goal and new goal hasn't been presented yet
    if (player1CurrentGoal !== null && player2CurrentGoal !== null &&
        player1CurrentGoal === player2CurrentGoal &&
        (typeof newGoalPresented === 'undefined' || !newGoalPresented)) {

        console.log('=== BOTH PLAYERS HEADING TO SAME GOAL ===');
        console.log('Shared goal index:', player1CurrentGoal);

        // Get player positions based on version
        var player1Pos, player2Pos;
        if (isHumanHuman) {
            player1Pos = gameData.currentPlayerPos;
            player2Pos = gameData.currentPartnerPos;
        } else {
            player1Pos = gameData.playerState;
            player2Pos = gameData.aiState;
        }

        console.log('Player positions - Player1:', player1Pos, 'Player2:', player2Pos);

        // Handle server-side goal generation for human-human mode
        if (isHumanHuman && options.serverRequestHandler &&
            typeof socket !== 'undefined' && socket && gameData.currentPartnerPos) {

            console.log('=== USING SERVER-SIDE GOAL GENERATION ===');

            // Get or generate distance condition
            var distanceCondition = gameData.currentTrialData.distanceCondition;
            if (!distanceCondition) {
                distanceCondition = getRandomDistanceConditionFor2P3G(gameData.currentTrial);
                gameData.currentTrialData.distanceCondition = distanceCondition;
                console.log('Generated distance condition:', distanceCondition);
            }

            // Map distance conditions to server format
            var serverDistanceCondition = mapDistanceConditionToServer(distanceCondition);
            console.log('Mapped distance condition:', distanceCondition, '->', serverDistanceCondition);

            // Call the server request handler
            options.serverRequestHandler({
                sharedGoalIndex: player1CurrentGoal,
                stepCount: gameData.stepCount,
                trialIndex: gameData.currentTrialIndex || gameData.currentTrial,
                player1Pos: player1Pos,
                player2Pos: player2Pos,
                currentGoals: gameData.currentGoals,
                distanceCondition: serverDistanceCondition
            });

            console.log('=== SERVER REQUEST SENT VIA HANDLER ===');
            return; // Server will handle the rest
        }

        // Local goal generation (human-AI mode or human-human fallback)
        console.log('=== USING LOCAL GOAL GENERATION ===');

        // Get distance condition for this trial
        var distanceCondition = gameData.currentTrialData.distanceCondition ||
                               TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;

        console.log('Using distance condition:', distanceCondition);

        // Generate new goal using current positions and distance condition
        var newGoalResult = generateNewGoal(player2Pos, player1Pos, gameData.currentGoals, player1CurrentGoal, distanceCondition);

        if (newGoalResult) {
            console.log('=== NEW GOAL GENERATED LOCALLY ===');

            // Set global variables for compatibility
            if (typeof window !== 'undefined') {
                if (isHumanHuman) {
                    window.isNewGoalCloserToPlayer2 = newGoalResult.conditionType === TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;
                    window.newGoalPosition = newGoalResult.position;
                    window.newGoalPresented = true;
                } else {
                    window.isNewGoalCloserToAI = newGoalResult.conditionType === TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;
                    window.newGoalPosition = newGoalResult.position;
                    window.newGoalPresented = true;
                }
            }

            // Add new goal to the grid and goals list
            var goalValue = (typeof OBJECT !== 'undefined') ? OBJECT.goal : 2;
            gameData.gridMatrix[newGoalResult.position[0]][newGoalResult.position[1]] = goalValue;
            gameData.currentGoals.push(newGoalResult.position);

            // Reset pre-calculation flag for AI version
            if (!isHumanHuman && window.RLAgent && window.RLAgent.resetNewGoalPreCalculationFlag) {
                window.RLAgent.resetNewGoalPreCalculationFlag();
            }

            // Record in trial data with proper naming based on version
            if (isHumanHuman) {
                gameData.currentTrialData.isNewGoalCloserToPlayer2 = newGoalResult.conditionType === TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;
                gameData.currentTrialData.newGoalDistanceToPlayer1 = newGoalResult.distanceToHuman;
                gameData.currentTrialData.newGoalDistanceToPlayer2 = newGoalResult.distanceToAI;
            } else {
                gameData.currentTrialData.isNewGoalCloserToAI = newGoalResult.conditionType === TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI;
                gameData.currentTrialData.newGoalDistanceToHuman = newGoalResult.distanceToHuman;
                gameData.currentTrialData.newGoalDistanceToAI = newGoalResult.distanceToAI;
            }

            // Common trial data
            gameData.currentTrialData.newGoalPresentedTime = gameData.stepCount;
            gameData.currentTrialData.newGoalPosition = newGoalResult.position;
            gameData.currentTrialData.newGoalConditionType = newGoalResult.conditionType;
            gameData.currentTrialData.newGoalDistanceSum = newGoalResult.distanceSum;

            // Calculate and record distances to old goal
            if (gameData.currentGoals && gameData.currentGoals[player1CurrentGoal]) {
                var oldGoal = gameData.currentGoals[player1CurrentGoal];
                var distance1ToOldGoal = calculatetGirdDistance(player1Pos, oldGoal);
                var distance2ToOldGoal = calculatetGirdDistance(player2Pos, oldGoal);

                if (isHumanHuman) {
                    gameData.currentTrialData.player1DistanceToOldGoal = distance1ToOldGoal;
                    gameData.currentTrialData.player2DistanceToOldGoal = distance2ToOldGoal;
                } else {
                    gameData.currentTrialData.humanDistanceToOldGoal = distance1ToOldGoal;
                    gameData.currentTrialData.aiDistanceToOldGoal = distance2ToOldGoal;
                }
            }

            console.log('New goal created at:', newGoalResult.position);
            console.log('Trial data updated with distances');

            // Update display
            if (options.displayUpdater) {
                options.displayUpdater();
            } else if (!isHumanHuman && typeof nodeGameUpdateGameDisplay !== 'undefined') {
                nodeGameUpdateGameDisplay();
            } else if (isHumanHuman && typeof updateGameVisualization !== 'undefined') {
                updateGameVisualization();
            }

            // Call callback
            if (options.callback) {
                options.callback();
            }

            console.log('=== NEW GOAL PRESENTATION COMPLETE ===');
        } else {
            console.error('Failed to generate new goal locally');
        }
    } else {
        console.log('=== NEW GOAL CONDITIONS NOT MET ===');
        console.log('  - Player1 goal null?', player1CurrentGoal === null);
        console.log('  - Player2 goal null?', player2CurrentGoal === null);
        console.log('  - Goals same?', player1CurrentGoal === player2CurrentGoal);
        console.log('  - Already presented?', (typeof newGoalPresented !== 'undefined') ? newGoalPresented : 'undefined');
    }
}

/**
 * Map distance conditions from human-AI format to server format
 */
function mapDistanceConditionToServer(distanceCondition) {
    switch (distanceCondition) {
        case 'closer_to_ai':
        case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI:
            return 'closer_to_player2';
        case 'closer_to_human':
        case TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN:
            return 'closer_to_player1';
        case 'equal_to_both':
        case TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH:
            return 'equal_to_both';
        case 'no_new_goal':
        case TWOP3G_CONFIG.distanceConditions.NO_NEW_GOAL:
            return 'no_new_goal';
        default:
            console.warn('Unknown distance condition, using equal_to_both as fallback:', distanceCondition);
            return 'equal_to_both';
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

        // Collaboration is successful if both players reached the same goal
        // Note: Using 0-based indexing from gameHelpers.js (goal 0, 1, 2...)
        var collaboration = (humanGoal === aiGoal && humanGoal !== null);

        console.log(`2P3G Collaboration check: Human goal=${humanGoal}, AI goal=${aiGoal}, Collaboration=${collaboration}`);

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

// =================================================================================================
// 1P2G Functions - Experimental Design Logic
// =================================================================================================

/**
 * Check for new goal presentation in 1P2G based on distance condition (supports both human-AI and human-human versions)
 * @param {Object} [options={}] - Configuration options for different experiment versions
 * @param {Array} [options.playerPosition] - Override player position (defaults to gameData.playerState or gameData.currentPlayerPos)
 * @param {Function} [options.distanceCalculator] - Custom distance calculation function
 * @param {Function} [options.displayUpdater] - Custom display update function
 * @param {Function} [options.callback] - Callback function after goal presentation
 */
function checkNewGoalPresentation1P2G(options) {
    console.log('=== 1P2G NEW GOAL CHECK START ===');

    // Handle both old callback-only signature and new options signature
    if (typeof options === 'function') {
        options = { callback: options };
    }
    options = options || {};

    console.log('1P2G: Current stepCount:', gameData.stepCount, 'Required minimum:', ONEP2G_CONFIG.minStepsBeforeNewGoal);

    // Check minimum steps requirement
    if (gameData.stepCount < ONEP2G_CONFIG.minStepsBeforeNewGoal) {
        console.log('1P2G: Minimum steps not met, returning early');
        return;
    }

    // Get current human goal
    var humanCurrentGoal = gameData.currentTrialData.humanCurrentGoal && gameData.currentTrialData.humanCurrentGoal.length > 0 ?
        gameData.currentTrialData.humanCurrentGoal[gameData.currentTrialData.humanCurrentGoal.length - 1] : null;

    console.log('1P2G: humanCurrentGoal:', humanCurrentGoal);
    console.log('1P2G: humanCurrentGoal array:', gameData.currentTrialData.humanCurrentGoal);
    console.log('1P2G: newGoalPresented:', gameData.currentTrialData.newGoalPresented);

    // Check if human goal is detected and new goal hasn't been presented yet
    if (humanCurrentGoal !== null && !gameData.currentTrialData.newGoalPresented) {
        console.log('1P2G: Conditions met for new goal presentation!');
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
            var firstGoal = gameData.currentGoals[0];

            // Generate new goal position based on distance condition
            var newGoal = generateNewGoalFor1P2G(firstGoal, distanceCondition);

            if (newGoal) {
                // Add new goal to the grid and goals list (like 2P3G)
                gameData.gridMatrix[newGoal[0]][newGoal[1]] = OBJECT.goal;
                gameData.currentGoals.push(newGoal);

                // Reset pre-calculation flag when new goal is added (human-AI specific)
                if (window.RLAgent && window.RLAgent.resetNewGoalPreCalculationFlag) {
                    window.RLAgent.resetNewGoalPreCalculationFlag();
                }

                // Mark as presented
                gameData.currentTrialData.newGoalPresented = true;

                // Record in trial data
                gameData.currentTrialData.newGoalPresentedTime = gameData.stepCount;
                gameData.currentTrialData.newGoalPosition = newGoal;
                gameData.currentTrialData.newGoalConditionType = distanceCondition;

                // Get player position (support both versions)
                var playerPosition = options.playerPosition ||
                                   gameData.playerState ||
                                   gameData.currentPlayerPos;

                if (!playerPosition) {
                    console.error('1P2G: No player position available for distance calculation');
                    if (options.callback) options.callback();
                    return;
                }

                // Calculate and record distances using appropriate function
                var distanceCalculator = options.distanceCalculator;
                if (!distanceCalculator) {
                    // Try to find appropriate distance calculator
                    if (typeof calculatetGirdDistance === 'function') {
                        distanceCalculator = calculatetGirdDistance; // Human-AI version
                    } else if (window.NodeGameHelpers && window.NodeGameHelpers.calculatetGirdDistance) {
                        distanceCalculator = window.NodeGameHelpers.calculatetGirdDistance; // Human-Human version
                    } else if (window.calculatetGirdDistance) {
                        distanceCalculator = window.calculatetGirdDistance; // Global alias
                    } else {
                        console.error('1P2G: No distance calculator available');
                        distanceCalculator = function() { return 0; }; // Fallback
                    }
                }

                var humanDistanceToFirstGoal = distanceCalculator(playerPosition, firstGoal);
                var humanDistanceToNewGoal = distanceCalculator(playerPosition, newGoal);
                gameData.currentTrialData.humanDistanceToFirstGoal = humanDistanceToFirstGoal;
                gameData.currentTrialData.humanDistanceToNewGoal = humanDistanceToNewGoal;

                console.log('1P2G: New goal presented at step', gameData.stepCount, ':', newGoal, 'Condition:', distanceCondition);
                console.log('  - Distance to FIRST goal:', humanDistanceToFirstGoal);
                console.log('  - Distance to NEW goal:', humanDistanceToNewGoal);

                // Update display using appropriate function
                var displayUpdater = options.displayUpdater;
                if (!displayUpdater) {
                    // Try to find appropriate display updater
                    if (typeof nodeGameUpdateGameDisplay === 'function') {
                        displayUpdater = nodeGameUpdateGameDisplay; // Human-AI version
                    } else if (window.nodeGameUpdateGameDisplay) {
                        displayUpdater = window.nodeGameUpdateGameDisplay; // Global alias
                    } else {
                        console.log('1P2G: No display updater available, skipping display update');
                        displayUpdater = function() {}; // Fallback
                    }
                }

                displayUpdater();

                if (options.callback) options.callback();
            } else {
                console.log('checkNewGoalPresentation1P2G: Failed to generate new goal');
            }
        } else {
            console.log('1P2G: Not presenting new goal - not enough goals:', gameData.currentGoals.length);
        }
    } else {
        console.log('1P2G: Conditions NOT met for new goal presentation:');
        console.log('  - humanCurrentGoal is null?', humanCurrentGoal === null);
        console.log('  - newGoalPresented?', gameData.currentTrialData.newGoalPresented);
    }
    console.log('=== 1P2G NEW GOAL CHECK END ===');
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

    // Get human player position (support both human-AI and human-human versions)
    var humanPos = gameData.playerState || gameData.currentPlayerPos;
    if (!humanPos || !Array.isArray(humanPos) || humanPos.length < 2) {
        console.error('Invalid human position for 1P2G goal generation');
        console.error('  - gameData.playerState:', gameData.playerState);
        console.error('  - gameData.currentPlayerPos:', gameData.currentPlayerPos);
        return null;
    }

    // Get distance calculator (support both human-AI and human-human versions)
    var distanceCalculator;
    if (typeof calculatetGirdDistance === 'function') {
        distanceCalculator = calculatetGirdDistance; // Human-AI version
    } else if (window.NodeGameHelpers && window.NodeGameHelpers.calculatetGirdDistance) {
        distanceCalculator = window.NodeGameHelpers.calculatetGirdDistance; // Human-Human version
    } else if (window.calculatetGirdDistance) {
        distanceCalculator = window.calculatetGirdDistance; // Global alias
    } else {
        console.error('1P2G: No distance calculator available in generateNewGoalFor1P2G');
        return null;
    }

    var humanDistanceToFirstGoal = distanceCalculator(humanPos, firstGoal);

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

                var humanDistanceToSecondGoal = distanceCalculator(humanPos, secondGoal);
                var distanceBetweenGoals = distanceCalculator(firstGoal, secondGoal);

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
        return selectedGoalData.position;
    }

    // Fallback: Try with relaxed constraints if no valid positions found
    console.log('generateSecondGoalFor1P2G: No valid goals found with strict constraints, trying relaxed constraints');

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

                var humanDistanceToSecondGoal = distanceCalculator(humanPos, secondGoal);
                var distanceBetweenGoals = distanceCalculator(firstGoal, secondGoal);

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
        return selectedRelaxedGoalData.position;
    }

    console.log('generateSecondGoalFor1P2G: No valid goals found even with relaxed constraints');

    return null;
}

// =================================================================================================
// SUCCESS THRESHOLD FUNCTIONS
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
 * Check if should continue to next trial for given experiment
 * @param {string} experimentType - Type of experiment
 * @param {number} trialIndex - Current trial index
 * @returns {boolean} - True if should continue
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

// =================================================================================================
// GLOBAL EXPORTS
// =================================================================================================

// Export functions globally for use in other files
window.ExpDesign = {
    // 2P3G functions
    getDistanceCondition: getDistanceCondition,
    setDistanceConditionSequence: setDistanceConditionSequence,
    generateNewGoal: generateNewGoal,
    isGoalBlockingPath: isGoalBlockingPath,
    isInRectangleBetween: isInRectangleBetween,
    checkNewGoalPresentation2P3G: checkNewGoalPresentation2P3G,
    checkTrialEnd2P3G: checkTrialEnd2P3G,

    // 1P2G functions
    checkNewGoalPresentation1P2G: checkNewGoalPresentation1P2G,
    generateNewGoalFor1P2G: generateNewGoalFor1P2G,

    // Success threshold functions
    initializeSuccessThresholdTracking: initializeSuccessThresholdTracking,
    updateSuccessThresholdTracking: updateSuccessThresholdTracking,
    shouldEndExperimentDueToSuccessThreshold: shouldEndExperimentDueToSuccessThreshold,
    shouldContinueToNextTrial: shouldContinueToNextTrial,

    // Global variables (for reset purposes)
    reset2P3GGlobals: function() {
        humanInferredGoals = [];
        aiInferredGoals = [];
        newGoalPresented = false;
        newGoalPosition = null;
        isNewGoalCloserToAI = null;
    }
};

