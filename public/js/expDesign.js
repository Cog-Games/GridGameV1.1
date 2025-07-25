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


    // Check if both players are heading to the same goal and new goal hasn't been presented yet
    if (humanCurrentGoal !== null && !newGoalPresented) {
        // Check if both players are heading to the same goal
        if (aiCurrentGoal === humanCurrentGoal) {
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

                nodeGameUpdateGameDisplay();

                if (callback) callback();
            }
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

    // Check if human goal is detected and new goal hasn't been presented yet
    if (humanCurrentGoal !== null && !gameData.currentTrialData.newGoalPresented) {
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
                    console.log('checkNewGoalPresentation1P2G: Failed to generate new goal');
            }
        } else {
            console.log('1P2G: Not presenting new goal - not enough goals:', gameData.currentGoals.length);
        }
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

    // Get human player position
    var humanPos = gameData.playerState;
    if (!humanPos || !Array.isArray(humanPos) || humanPos.length < 2) {
        console.error('Invalid human position for 1P2G goal generation');
        return null;
    }

    var humanDistanceToFirstGoal = calculatetGirdDistance(humanPos, firstGoal);

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
        return selectedRelaxedGoalData.position;
    }

    console.log('generateSecondGoalFor1P2G: No valid goals found even with relaxed constraints');

    return null;
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

    // Global variables (for reset purposes)
    reset2P3GGlobals: function() {
        humanInferredGoals = [];
        aiInferredGoals = [];
        newGoalPresented = false;
        newGoalPosition = null;
        isNewGoalCloserToAI = null;
    }
};

