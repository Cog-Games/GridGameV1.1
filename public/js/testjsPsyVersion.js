// =================================================================================================
// Human vs individual RL agent
// 10 trials for each condition (invidiual, dual, dual_commit)
// =================================================================================================


//3,10,10,10
var nTrialsFor1P1G = 2;
var nTrialsFor1P2G = 2;
var nTrialsFor2P2G = 2;
var nTrialsFor2P3G = 2;

var mapData2P2G = MapsFor2P2G;
var mapData1P1G = MapsFor1P1G;
var mapData1P2G = MapsFor1P2G;
var mapData2P3G = MapsFor2P3G;

function selectRandomMaps(mapData, nTrials) {
    var shuffledIndex = shuffle(Object.keys(mapData));
    var selectedMaps = {};
    for (var i = 0; i < nTrials; i++) {
        selectedMaps[i] = mapData[shuffledIndex[i]];
    }
    return selectedMaps;
}

// Random choice n maps for each condition
mapData1P1G = selectRandomMaps(MapsFor1P1G, nTrialsFor1P1G);
mapData1P2G = selectRandomMaps(MapsFor1P2G, nTrialsFor1P2G);
mapData2P2G = selectRandomMaps(MapsFor2P2G, nTrialsFor2P2G);
mapData2P3G = selectRandomMaps(MapsFor2P3G, nTrialsFor2P3G);


var gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0))

var jsPsych = initJsPsych()
var timeline = [];
var allTrialsData = new Array();

// =================================================================================================
// Common functions for all experiments
// =================================================================================================

var fixationWithTime = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: fixation,
    choices: "NO_KEYS",
    trial_duration: 500,
    data: { type: 'fixation' }
};

// Global variable to track current goals
var currentGoals = null;

// Wrapper function to draw grid with current goals
function drawGridWithGoals(c) {
    drawGrid(c, currentGoals);
}

var fixationWithKeyPress = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: " ",
    prompt: `
        <p style="font-size:20px;text-align: center;">Press the <strong>spacebar</strong> to start.</p>
        <p style="font-size:20px;text-align: center;">Press ↑ ↓ ← → to control your player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>.</p>
        `,
    data: { type: 'fixation' }
};

var eachStep = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"],
    prompt: '<p style="font-size:20px;text-align: center;">Press ↑ ↓ ← → to control your player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span> </p>',
    data: { type: 'eachStep' },
    on_load: function () {
        // Pre-compute AI action asynchronously during human decision time
        if (RL_AGENT_TYPE === 'joint' && typeof aiState !== 'undefined' && typeof playerState !== 'undefined' && typeof currentGoals !== 'undefined') {
            console.log(`Pre-computing AI action - AI: [${aiState}], Human: [${playerState}], Goals:`, currentGoals);
            getAIAction(gridMatrixList, aiState, currentGoals, playerState).then(action => {
                window.pendingAIAction = action;
                console.log('✓ Pre-computed AI action successfully:', action);
            }).catch(error => {
                console.error('✗ Error pre-computing AI action:', error);
                window.pendingAIAction = getIndividualRLAction(aiState, currentGoals);
                console.log('✓ Fallback to individual RL action:', window.pendingAIAction);
            });
        } else {
            console.log('Pre-computation skipped:', {
                agentType: RL_AGENT_TYPE,
                aiState: typeof aiState !== 'undefined' ? aiState : 'undefined',
                playerState: typeof playerState !== 'undefined' ? playerState : 'undefined',
                currentGoals: typeof currentGoals !== 'undefined' ? currentGoals : 'undefined'
            });
        }
    }
};

var pauseTrial = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: '<p style="font-size:20px;text-align: center;">Great job!</p>',
    trial_duration: 500,
    data: { type: 'maintaskHumanAI' }
};

var collaborationFeedback = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: function () {
        // Get the last trial data to check collaboration result
        let lastTrialData = allTrialsData[allTrialsData.length - 1];
        if (lastTrialData && lastTrialData.collaborationSucceeded) {
            return '<p style="font-size:32px;text-align: center; color: red; font-weight: bold;">Collaboration succeeded!</p>';
            // return '<p style="font-size:32px;text-align: center; color: red; font-weight: bold;">You get 5 points! Collaboration succeeded!</p>';

        } else {
            return '<p style="font-size:32px;text-align: center; color: red; font-weight: bold;">Collaboration failed!</p>';
            // return '<p style="font-size:32px;text-align: center; color: red; font-weight: bold;">You get 1 point! </p>';

        }
    },
    trial_duration: 1500,
    data: { type: 'collaborationFeedback' }
};

// =================================================================================================
// 1-PLAYER 1-GOAL (1P1G) EXPERIMENT
// =================================================================================================
var singleTrialData_1P1G = {};

var curTrial_1P1G = 0;

var initialMap_1P1G = {
    type: jsPsychCallFunction,
    func: function () {
        console.log("curTrial_1P1G:", curTrial_1P1G);

        stepCount = 0;
        let currentDesign = mapData1P1G[curTrial_1P1G][0];

        gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0));
        gridMatrixList[currentDesign.initPlayerGrid[0]][currentDesign.initPlayerGrid[1]] = OBJECT.player;
        gridMatrixList[currentDesign.target1[0]][currentDesign.target1[1]] = OBJECT.goal;

        currentGoals = [currentDesign.target1];

        singleTrialDataToRecord = {
            trialIndex: curTrial_1P1G,
            trajectory: [],
            aimAction: [],
            RT: [],
        };
        singleTrialData_1P1G = Object.assign({}, currentDesign, singleTrialDataToRecord);
        playerState = currentDesign.initPlayerGrid;
    },
    data: { type: 'initialMap_1P1G' }
};

var mainTask_1P1G = {
    timeline: [eachStep],
    loop_function: function () {
        let goals = currentGoals;
        let responseKey = jsPsych.data.getLastTrialData().filter({ type: 'eachStep' }).trials[0].response;
        let aimAction = DIRECTIONS[responseKey.toLowerCase()].movement;
        singleTrialData_1P1G.RT.push(jsPsych.data.getLastTrialData().select('rt').values[0]);

        let realAction = isValidMove(gridMatrixList, playerState, aimAction);
        let nextState = transition(playerState, realAction);
        gridMatrixList = updateMatrix(gridMatrixList, playerState[0], playerState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, nextState[0], nextState[1], OBJECT.player);

        singleTrialData_1P1G.aimAction.push(aimAction);
        singleTrialData_1P1G.trajectory.push(nextState);

        playerState = nextState;
        if (isGoalReached(playerState, goals)) {
            allTrialsData.push(singleTrialData_1P1G);
            return false; // End trial
        }

        stepCount++;
        return true; // Continue trial
    },
    data: { type: 'mainLoop_1P1G' }
};

var updateTrial_1P1G = {
    type: jsPsychCallFunction,
    func: function () {
        curTrial_1P1G++;
    },
    data: { type: 'updateTrial_1P1G' }
}

var experiment_1P1G = {
    timeline: [initialMap_1P1G, fixationWithTime, mainTask_1P1G, pauseTrial, updateTrial_1P1G],
    repetitions: nTrialsFor1P1G
};

// =================================================================================================
// 1-PLAYER 2-GOALS (1P2G) EXPERIMENT
// =================================================================================================

var curTrial_1P2G = 0;

var initialMap_1P2G = {
    type: jsPsychCallFunction,
    func: function () {
        console.log("curTrial_1P2G:", curTrial_1P2G);
        stepCount = 0;
        let currentDesign = mapData1P2G[curTrial_1P2G][0];

        gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0));
        gridMatrixList[currentDesign.initPlayerGrid[0]][currentDesign.initPlayerGrid[1]] = OBJECT.player;
        gridMatrixList[currentDesign.target1[0]][currentDesign.target1[1]] = OBJECT.goal;
        gridMatrixList[currentDesign.target2[0]][currentDesign.target2[1]] = OBJECT.goal;

        currentGoals = [currentDesign.target1, currentDesign.target2];

        singleTrialDataToRecord = {
            trialIndex: curTrial_1P2G,
            trajectory: [],
            aimAction: [],
            RT: [],
        };
        singleTrialData = Object.assign({}, currentDesign, singleTrialDataToRecord);
        playerState = currentDesign.initPlayerGrid;
    },
    data: { type: 'initialMap_1P2G' }
};

var mainTask_1P2G = {
    timeline: [eachStep],
    loop_function: function () {
        let goals = currentGoals;
        let responseKey = jsPsych.data.getLastTrialData().filter({ type: 'eachStep' }).trials[0].response;
        let aimAction = DIRECTIONS[responseKey.toLowerCase()].movement;
        singleTrialData.RT.push(jsPsych.data.getLastTrialData().select('rt').values[0]);

        let realAction = isValidMove(gridMatrixList, playerState, aimAction);
        let nextState = transition(playerState, realAction);
        gridMatrixList = updateMatrix(gridMatrixList, playerState[0], playerState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, nextState[0], nextState[1], OBJECT.player);

        singleTrialData.trajectory.push(nextState);
        singleTrialData.aimAction.push(aimAction);

        playerState = nextState;
        if (isGoalReached(playerState, goals)) {
            allTrialsData.push(singleTrialData);
            return false; // End trial
        }
        stepCount++;
        return true; // Continue trial
    },
    data: { type: 'mainLoop_1P2G' }
};

var updateTrial_1P2G = {
    type: jsPsychCallFunction,
    func: function () {
        curTrial_1P2G++;
    },
    data: { type: 'updateTrial_1P2G' }
}

var experiment_1P2G = {
    timeline: [initialMap_1P2G, fixationWithTime, mainTask_1P2G, pauseTrial, updateTrial_1P2G],
    repetitions: nTrialsFor1P2G
};


// =================================================================================================
// 2-PLAYER 2-GOALS (2P2G) EXPERIMENT
// =================================================================================================

AGENT_TIME_DELAY = 200
var P1AtGoal = 0
var humanReachedGoal = 0

// =================================================================================================
// RL AGENT CONFIGURATION
// =================================================================================================
// Choose agent type: 'individual' or 'joint'
//
// 'individual': AI only considers its own position and goals (original behavior)
//               - Optimizes only for reaching any goal individually
//               - Does not consider human player's position in decision making
//
// 'joint':      AI considers both its own and human player's positions (cooperative behavior)
//               - Optimizes for joint reward maximization
//               - Prefers reaching the same goal as human player (higher reward)
//               - Models cooperative behavior in 2P2G and 2P3G experiments
//
var RL_AGENT_TYPE = 'joint'; // Change this to 'individual' for non-cooperative agent

var curTrial_2P2G = 0;

var initialMap_2P2G = {
    type: jsPsychCallFunction,
    func: function () {
        stepCount = 0;
        P1AtGoal = false;
        let currentDesign = mapData2P2G[curTrial_2P2G][0]

        gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0))

        // Add human player at specified position
        gridMatrixList[currentDesign.initPlayerGrid[0]][currentDesign.initPlayerGrid[1]] = OBJECT.player;

        // Add AI player at specified position
        gridMatrixList[currentDesign.initAIGrid[0]][currentDesign.initAIGrid[1]] = OBJECT.ai_player;

        // Add goals
        gridMatrixList[currentDesign.target1[0]][currentDesign.target1[1]] = OBJECT.goal;
        gridMatrixList[currentDesign.target2[0]][currentDesign.target2[1]] = OBJECT.goal;

        goalList = [currentDesign.target1, currentDesign.target2];
        currentGoals = goalList; // Update global goals for visualization

        singleTrialDataToRecord = {
            trialIndex: curTrial_2P2G,
            trajectory: [],
            aiTrajectory: [],
            aimAction: [],
            aiAction: [],
            RT: [],
        };
        singleTrialData = Object.assign({}, currentDesign, singleTrialDataToRecord);
        playerState = currentDesign.initPlayerGrid;
        aiState = currentDesign.initAIGrid;
    },
    data: { type: 'initial' }
}


var eachStepPhase = {
    timeline: [eachStep],
    conditional_function: function () {
        return !P1AtGoal;
    }
};


async function getAIAction(gridMatrix, currentPos, goals, humanPos = null) {
    // goals should already be in the correct format [[x1, y1], [x2, y2]]
    let goalStates = goals;
    let action;

    try {
        if (RL_AGENT_TYPE === 'joint' && humanPos !== null) {
            // Use joint RL agent that considers both players' positions for cooperation
            console.log(`Attempting Joint RL Agent - AI: [${currentPos}], Human: [${humanPos}]`);
            // action = await getJointRLAction(currentPos, humanPos, goalStates);
            action = getSoftmaxOptimalJointRLAction(currentPos, humanPos, goalStates, { temperature: 0.1 });
            console.log(`Joint RL Action: [${action}]`);
        } else {
            // Use individual RL agent that only considers own position
            console.log(`Using Individual RL Agent - AI: [${currentPos}]`);
            action = getIndividualRLAction(currentPos, goalStates);
            console.log(`Individual RL Action: [${action}]`);
        }
    } catch (error) {
        console.error('Error in RL agent:', error);
        console.log('Falling back to individual RL agent');
        action = getIndividualRLAction(currentPos, goalStates);
    }

    // Convert string action to array format
    if (typeof action === 'string') {
        action = action.split(',').map(Number);
    }

    return action;
}

// =================================================================================================
// Helper functions for 2P3G experiment
// =================================================================================================

// Global variables to store inferred goals over time
var humanInferredGoals = [];
var aiInferredGoals = [];

// Function to detect which goal a player is heading towards based on their action
function detectPlayerGoal(playerPos, action, goals, goalHistory) {
    if (!action || action[0] === 0 && action[1] === 0) {
        return null; // No movement, can't determine goal
    }

    let nextPos = transition(playerPos, action);
    let minDistance = Infinity;
    let closestGoal = null;
    let equidistantGoals = [];

    for (let i = 0; i < goals.length; i++) {
        let distance = calculatetGirdDistance(nextPos, goals[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closestGoal = i;
            equidistantGoals = [i]; // Reset equidistant goals
        } else if (distance === minDistance) {
            equidistantGoals.push(i); // Add to equidistant goals
        }
    }

    // If there are multiple equidistant goals, return last step's inferred goal
    if (equidistantGoals.length > 1) {
        if (goalHistory && goalHistory.length > 0) {
            return goalHistory[goalHistory.length - 1]; // Return last step's inferred goal
        } else {
            return null; // No prior goal history
        }
    }

    return closestGoal;
}

// Function to generate a new goal that satisfies the constraints
function generateNewGoal(aiPos, humanPos, oldGoals, aiCurrentGoalIndex) {
    if (aiCurrentGoalIndex === null || aiCurrentGoalIndex >= oldGoals.length) {
        return null;
    }

    let aiCurrentGoal = oldGoals[aiCurrentGoalIndex];
    let oldDistanceSum = calculatetGirdDistance(aiPos, aiCurrentGoal) +
        calculatetGirdDistance(humanPos, aiCurrentGoal);

    // Find all valid positions for the new goal
    let validPositions = [];
    for (let row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (let col = 0; col < EXPSETTINGS.matrixsize; col++) {
            let newGoal = [row, col];

            // Check if position is not occupied by players or obstacles
            if (gridMatrixList[row][col] === OBJECT.blank || gridMatrixList[row][col] === OBJECT.goal) {
                let newGoalDistanceToAI = calculatetGirdDistance(aiPos, newGoal);
                let newGoalDistanceToHuman = calculatetGirdDistance(humanPos, newGoal);
                let newDistanceSum = newGoalDistanceToAI + newGoalDistanceToHuman;

                let aiDistanceToOldGoal = calculatetGirdDistance(aiPos, aiCurrentGoal);

                // Check constraints:
                // a) Distance sum should be equal to the old goal and two players (joint distance constraint)
                // b) New goal should not block the path from human to the new goal
                // c) New goal should not be in the rectangular area between AI and its prior goal
                // d) NEW: Allow new goal to be closer to human while maintaining joint distance

                let sumConstraint = Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                let blockingConstraint = !isGoalBlockingPath(humanPos, newGoal, oldGoals);
                let rectangleConstraint = !isInRectangleBetween(newGoal, aiPos, aiCurrentGoal);

                // NEW: Check if new goal is closer to human (this is what we want to test)
                let humanDistanceToOldGoal = calculatetGirdDistance(humanPos, aiCurrentGoal);
                let newGoalCloserToHuman = newGoalDistanceToHuman < humanDistanceToOldGoal;

                // Priority 1: Maintain joint distance constraint (required)
                // Priority 2: Prefer goals closer to human (for testing cooperation)
                if (sumConstraint && blockingConstraint && rectangleConstraint) {
                    validPositions.push({
                        position: newGoal,
                        closerToHuman: newGoalCloserToHuman,
                        humanDistance: newGoalDistanceToHuman,
                        aiDistance: newGoalDistanceToAI,
                        jointDistance: newDistanceSum
                    });
                }
            }
        }
    }

    // Return a valid position, prioritizing goals closer to human
    if (validPositions.length > 0) {
        // Sort by priority: closer to human first, then by human distance
        validPositions.sort((a, b) => {
            if (a.closerToHuman && !b.closerToHuman) return -1;
            if (!a.closerToHuman && b.closerToHuman) return 1;
            return a.humanDistance - b.humanDistance;
        });

        const selectedGoal = validPositions[0];
        console.log(`New goal generated: [${selectedGoal.position}] - Closer to human: ${selectedGoal.closerToHuman}, Human distance: ${selectedGoal.humanDistance}, AI distance: ${selectedGoal.aiDistance}, Joint distance: ${selectedGoal.jointDistance}`);

        return {
            isCloser: selectedGoal.closerToHuman,
            position: selectedGoal.position,
            closerToHuman: selectedGoal.closerToHuman,
            humanDistance: selectedGoal.humanDistance,
            aiDistance: selectedGoal.aiDistance
        };
    }
    else {
        console.log('no closer new goal found, trying to find a new goal');
        // Relax distance constraint - allow equal distance to AI's prior goal
        for (let row = 0; row < EXPSETTINGS.matrixsize; row++) {
            for (let col = 0; col < EXPSETTINGS.matrixsize; col++) {
                let newGoal = [row, col];

                // Check if position is not occupied by players or obstacles
                if (gridMatrixList[row][col] === OBJECT.blank || gridMatrixList[row][col] === OBJECT.goal) {
                    let newGoalDistanceToAI = calculatetGirdDistance(aiPos, newGoal);
                    let newGoalDistanceToHuman = calculatetGirdDistance(humanPos, newGoal);
                    let newDistanceSum = newGoalDistanceToAI + newGoalDistanceToHuman;

                    let aiDistanceToOldGoal = calculatetGirdDistance(aiPos, aiCurrentGoal);

                    // Relaxed constraints - allow equal distance
                    let sumConstraint = Math.abs(newDistanceSum - oldDistanceSum) < 0.1;
                    let blockingConstraint = !isGoalBlockingPath(humanPos, newGoal, oldGoals);
                    let rectangleConstraint = !isInRectangleBetween(newGoal, aiPos, aiCurrentGoal);

                    // Check if new goal is closer to human
                    let humanDistanceToOldGoal = calculatetGirdDistance(humanPos, aiCurrentGoal);
                    let newGoalCloserToHuman = newGoalDistanceToHuman < humanDistanceToOldGoal;

                    if (sumConstraint && blockingConstraint && rectangleConstraint) {
                        validPositions.push({
                            position: newGoal,
                            closerToHuman: newGoalCloserToHuman,
                            humanDistance: newGoalDistanceToHuman,
                            aiDistance: newGoalDistanceToAI,
                            jointDistance: newDistanceSum
                        });
                    }
                }
            }
        }

        if (validPositions.length > 0) {
            // Sort by human distance for fallback positions too
            validPositions.sort((a, b) => a.humanDistance - b.humanDistance);
            const selectedGoal = validPositions[0];
            console.log(`Fallback goal generated: [${selectedGoal.position}] - Human distance: ${selectedGoal.humanDistance}, AI distance: ${selectedGoal.aiDistance}, Joint distance: ${selectedGoal.jointDistance}`);

            return {
                isCloser: false,
                position: selectedGoal.position,
                closerToHuman: selectedGoal.closerToHuman,
                humanDistance: selectedGoal.humanDistance,
                aiDistance: selectedGoal.aiDistance
            };
        }
        return null;
    }
}

// Helper function to check if a new goal would block the path from human to the goal
function isGoalBlockingPath(humanPos, newGoal, existingGoals) {
    // Check if the new goal is directly adjacent to the human player
    // If so, it might block movement (though goals are passable, this could cause issues)
    let distanceToHuman = calculatetGirdDistance(humanPos, newGoal);
    if (distanceToHuman <= 1) {
        return true; // Too close, might cause blocking issues
    }

    // Check if the new goal is in a position that would make it impossible to reach
    // by creating a "dead end" situation
    let hasValidPath = false;

    // Check if there's at least one valid path to the goal (not blocked by other goals)
    for (let row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (let col = 0; col < EXPSETTINGS.matrixsize; col++) {
            let testPos = [row, col];
            if (gridMatrixList[row][col] === OBJECT.blank) {
                let pathToGoal = calculatetGirdDistance(testPos, newGoal);
                let pathFromHuman = calculatetGirdDistance(humanPos, testPos);
                let totalPath = pathFromHuman + pathToGoal;

                // If this path is reasonable and doesn't go through other goals
                if (totalPath <= distanceToHuman + 2) { // Allow some flexibility
                    let pathBlocked = false;
                    for (let goal of existingGoals) {
                        if (calculatetGirdDistance(testPos, goal) <= 1) {
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

// Helper function to check if a position is in the rectangular area between two points
function isInRectangleBetween(position, point1, point2) {
    let [posRow, posCol] = position;
    let [p1Row, p1Col] = point1;
    let [p2Row, p2Col] = point2;

    // Define the rectangular area boundaries
    let minRow = Math.min(p1Row, p2Row);
    let maxRow = Math.max(p1Row, p2Row);
    let minCol = Math.min(p1Col, p2Col);
    let maxCol = Math.max(p1Col, p2Col);

    // Check if the position is within the rectangular area (inclusive of boundaries)
    return (posRow >= minRow && posRow <= maxRow && posCol >= minCol && posCol <= maxCol);
}

var waitStep = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: '<p style="font-size:20px;text-align: center;">Please wait for the other player to reach the goal</p>',
    trial_duration: AGENT_TIME_DELAY,
    data: { type: 'aiOnlyStep' }
};

var waitPlayer2Phase = {
    timeline: [waitStep],
    conditional_function: function () {
        return P1AtGoal;
    },
};

var mainTaskHumanAI = {
    timeline: [eachStepPhase, waitPlayer2Phase],
    loop_function: function () {
        let currentDesign = mapData2P2G[curTrial_2P2G][0];
        let goals = [currentDesign.target1, currentDesign.target2];
        currentGoals = goals;

        let aimAction, realAction, aiAction, aiRealAction;

        // Decide player and AI actions based on whose turn it is
        if (!P1AtGoal) {
            // Human's turn: Get human action from keyboard, get corresponding AI action
            let responseKey = jsPsych.data.getLastTrialData().filter({ type: 'eachStep' }).trials[0].response;
            aimAction = DIRECTIONS[responseKey.toLowerCase()].movement;
            singleTrialData.RT.push(jsPsych.data.getLastTrialData().select('rt').values[0]);
            realAction = isValidMove(gridMatrixList, playerState, aimAction);

            // Get AI's corresponding action for simultaneous move
            if (RL_AGENT_TYPE === 'joint') {
                try {
                    // aiAction = getEfficientJointRLAction(aiState, playerState, goals);
                    aiAction = getSoftmaxOptimalJointRLAction(aiState, playerState, goals, { temperature: 0.1 });
                } catch (error) {
                    aiAction = getIndividualRLAction(aiState, goals);
                }
            } else {
                aiAction = getIndividualRLAction(aiState, goals);
            }
            aiRealAction = isGoalReached(aiState, goals) ? [0, 0] : isValidMove(gridMatrixList, aiState, aiAction);
        } else {
            // AI's turn: Human waits, AI moves towards human's goal
            aimAction = [0, 0];
            realAction = [0, 0];

            let humanGoalIndex = whichGoalReached(playerState, goals);
            if (humanGoalIndex !== 0 && !isGoalReached(aiState, goals)) {
                let humanGoal = goals[humanGoalIndex - 1];
                // Use joint RL action instead of individual RL for better cooperation
                aiAction = getSoftmaxOptimalJointRLAction(aiState, playerState, goals, { temperature: 0.1 });
                console.log(`🕐 Wait phase (2P2G): AI targeting human's goal at [${humanGoal}] with joint RL`);
            } else {
                aiAction = [0, 0]; // No action if AI is already at a goal or human's goal is not found
            }
            aiRealAction = isGoalReached(aiState, goals) ? [0, 0] : isValidMove(gridMatrixList, aiState, aiAction);
        }

        // --- Update grid and states based on actions ---

        // Erase old positions
        gridMatrixList = updateMatrix(gridMatrixList, playerState[0], playerState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, aiState[0], aiState[1], OBJECT.blank);

        // Get next states
        let aimNextState = transition(playerState, realAction);
        let aiNextState = transition(aiState, aiRealAction);

        // Update grid with new positions, handling collisions
        if (aimNextState[0] === aiNextState[0] && aimNextState[1] === aiNextState[1]) {
            gridMatrixList = updateMatrix(gridMatrixList, aimNextState[0], aimNextState[1], OBJECT.player);
        } else {
            gridMatrixList = updateMatrix(gridMatrixList, aimNextState[0], aimNextState[1], OBJECT.player);
            gridMatrixList = updateMatrix(gridMatrixList, aiNextState[0], aiNextState[1], OBJECT.ai_player);
        }

        // Record data for this step
        singleTrialData.aimAction.push(aimAction);
        singleTrialData.aiAction.push(aiAction);
        singleTrialData.trajectory.push(aimNextState);
        singleTrialData.aiTrajectory.push(aiNextState);

        // Update player states
        playerState = aimNextState;
        aiState = aiNextState;

        // Update whether the human is at a goal for the next iteration
        P1AtGoal = isGoalReached(playerState, goals);

        // Check for trial end condition
        let trialOver = isGoalReached(playerState, goals) && isGoalReached(aiState, goals);
        if (trialOver) {
            let humanGoal = whichGoalReached(playerState, goals);
            let aiGoal = whichGoalReached(aiState, goals);
            singleTrialData.collaborationSucceeded = (humanGoal === aiGoal && humanGoal !== 0);
            allTrialsData.push(singleTrialData);
            P1AtGoal = false;
            return false; // End trial loop
        } else {
            stepCount++;
            return true; // Continue trial loop
        }
    },
    data: { type: 'mainloop' }
}

var updateTrial = {
    type: jsPsychCallFunction,
    func: function () {
        drawGridWithGoals;
        curTrial_2P2G++;
    },
    data: { type: 'updateTrial' }
}



var experiment_2P2G = {
    timeline: [initialMap_2P2G, fixationWithTime, mainTaskHumanAI, collaborationFeedback, updateTrial],
    repetitions: nTrialsFor2P2G
}

// =================================================================================================
// 2-PLAYER 3-GOALS (2P3G) EXPERIMENT
// =================================================================================================

var curTrial_2P3G = 0;
var P1AtGoal_2P3G = false;
var newGoalPresented = false;
var newGoalPosition = null;
var humanCurrentGoal = null;
var aiCurrentGoal = null;

var initialMap_2P3G = {
    type: jsPsychCallFunction,
    func: function () {
        stepCount = 0;
        P1AtGoal_2P3G = false;
        isNewGoalCloserToAI = null;
        newGoalPresented = false;
        newGoalPosition = null;
        humanCurrentGoal = null;
        aiCurrentGoal = null;

        // Reset goal history for new trial
        humanInferredGoals = [];
        aiInferredGoals = [];

        let currentDesign = mapData2P3G[curTrial_2P3G][0]

        gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0))

        // Add human player at specified position
        gridMatrixList[currentDesign.initPlayerGrid[0]][currentDesign.initPlayerGrid[1]] = OBJECT.player;

        // Add AI player at specified position
        gridMatrixList[currentDesign.initAIGrid[0]][currentDesign.initAIGrid[1]] = OBJECT.ai_player;

        // Add goals
        gridMatrixList[currentDesign.target1[0]][currentDesign.target1[1]] = OBJECT.goal;
        gridMatrixList[currentDesign.target2[0]][currentDesign.target2[1]] = OBJECT.goal;

        goalList = [currentDesign.target1, currentDesign.target2];
        currentGoals = goalList; // Update global goals for visualization

        singleTrialDataToRecord = {
            trialIndex: curTrial_2P3G,
            trajectory: [],
            aiTrajectory: [],
            aimAction: [],
            aiAction: [],
            RT: [],
            isNewGoalCloserToAI: null,
            newGoalPresentedTime: null,
            newGoalPosition: null,
            humanCurrentGoal: [],
            aiCurrentGoal: []
        };
        singleTrialData = Object.assign({}, currentDesign, singleTrialDataToRecord);
        playerState = currentDesign.initPlayerGrid;
        aiState = currentDesign.initAIGrid;
    },
    data: { type: 'initial_2P3G' }
}



var eachStepPhase_2P3G = {
    timeline: [eachStep],
    conditional_function: function () {
        return !P1AtGoal_2P3G;
    }
};

var waitStep_2P3G = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: '<p style="font-size:20px;text-align: center;">Please wait for the other player to reach the goal</p>',
    trial_duration: AGENT_TIME_DELAY,
    data: { type: 'aiOnlyStep_2P3G' }
};

var waitPlayer2Phase_2P3G = {
    timeline: [waitStep_2P3G],
    conditional_function: function () {
        return P1AtGoal_2P3G;
    },
};

var newGoalPresentation = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: '<p style="font-size:20px;text-align: center;">New goal appeared!</p>',
    trial_duration: 1000, // 1 second presentation
    data: { type: 'newGoalPresentation' }
};

var mainTaskHumanAI_2P3G = {
    timeline: [eachStepPhase_2P3G, waitPlayer2Phase_2P3G],
    loop_function: function () {
        let currentDesign = mapData2P3G[curTrial_2P3G][0];
        let goals = [currentDesign.target1, currentDesign.target2];
        if (newGoalPresented && newGoalPosition) {
            goals.push(newGoalPosition);
        }
        currentGoals = goals;

        let aimAction, realAction, aiAction, aiRealAction;

        // Decide player and AI actions based on whose turn it is
        if (!P1AtGoal_2P3G) {
            // Human's turn
            let responseKey = jsPsych.data.getLastTrialData().filter({ type: 'eachStep' }).trials[0].response;
            aimAction = DIRECTIONS[responseKey.toLowerCase()].movement;
            singleTrialData.RT.push(jsPsych.data.getLastTrialData().select('rt').values[0]);
            realAction = isValidMove(gridMatrixList, playerState, aimAction);

            // Get AI's corresponding action
            if (RL_AGENT_TYPE === 'joint') {
                try {
                    // aiAction = getEfficientJointRLAction(aiState, playerState, goals);
                    aiAction = getSoftmaxOptimalJointRLAction(aiState, playerState, goals, { temperature: 0.1 });

                } catch (error) {
                    aiAction = getIndividualRLAction(aiState, goals);
                }
            } else {
                aiAction = getIndividualRLAction(aiState, goals);
            }
            aiRealAction = isGoalReached(aiState, goals) ? [0, 0] : isValidMove(gridMatrixList, aiState, aiAction);
        } else {
            // AI's turn (human is waiting)
            aimAction = [0, 0];
            realAction = [0, 0];

            let humanGoalIndex = whichGoalReached(playerState, goals);
            if (humanGoalIndex !== 0 && !isGoalReached(aiState, goals)) {
                let humanGoal = goals[humanGoalIndex - 1];
                // Use joint RL action instead of individual RL for better cooperation
                aiAction = getSoftmaxOptimalJointRLAction(aiState, playerState, goals, { temperature: 0.1 });
                console.log(`🕐 Wait phase (2P3G): AI targeting human's goal at [${humanGoal}] with joint RL`);
            } else {
                aiAction = [0, 0];
            }
            aiRealAction = isGoalReached(aiState, goals) ? [0, 0] : isValidMove(gridMatrixList, aiState, aiAction);
        }

        // --- New goal generation logic (only runs when human is active) ---
        if (!P1AtGoal_2P3G) {
            let humanNextPos = transition(playerState, realAction);
            let aiNextPosOnHumanTurn = transition(aiState, aiRealAction);
            let humanGoalGuess = detectPlayerGoal(playerState, realAction, goals, humanInferredGoals);
            let aiGoalGuess = detectPlayerGoal(aiState, aiRealAction, goals, aiInferredGoals);

            if (humanGoalGuess !== null && aiGoalGuess === humanGoalGuess && !newGoalPresented) {
                let newGoalResult = generateNewGoal(aiState, playerState, goals, aiGoalGuess);
                if (newGoalResult) {
                    newGoalPosition = newGoalResult.position;
                    gridMatrixList[newGoalPosition[0]][newGoalPosition[1]] = OBJECT.goal;
                    goals.push(newGoalPosition);
                    currentGoals = goals; // Update global goals for visualization
                    newGoalPresented = true;

                    // Record new goal data
                    singleTrialData.isNewGoalCloserToAI = newGoalResult.isCloser;
                    singleTrialData.newGoalPresentedTime = stepCount;
                    singleTrialData.newGoalPosition = newGoalPosition;
                }
            }
        }

        // --- Update grid and states ---
        gridMatrixList = updateMatrix(gridMatrixList, playerState[0], playerState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, aiState[0], aiState[1], OBJECT.blank);

        let aimNextState = transition(playerState, realAction);
        let aiNextState = transition(aiState, aiRealAction);

        if (aimNextState[0] === aiNextState[0] && aimNextState[1] === aiNextState[1]) {
            gridMatrixList = updateMatrix(gridMatrixList, aimNextState[0], aimNextState[1], OBJECT.player);
        } else {
            gridMatrixList = updateMatrix(gridMatrixList, aimNextState[0], aimNextState[1], OBJECT.player);
            gridMatrixList = updateMatrix(gridMatrixList, aiNextState[0], aiNextState[1], OBJECT.ai_player);
        }

        // --- Record data and update states ---
        singleTrialData.aimAction.push(aimAction);
        singleTrialData.aiAction.push(aiAction);
        singleTrialData.trajectory.push(aimNextState);
        singleTrialData.aiTrajectory.push(aiNextState);

        // Update goal inference history
        humanCurrentGoal = detectPlayerGoal(playerState, realAction, goals, humanInferredGoals);
        aiCurrentGoal = detectPlayerGoal(aiState, aiRealAction, goals, aiInferredGoals);
        if (humanCurrentGoal !== null) humanInferredGoals.push(humanCurrentGoal);
        if (aiCurrentGoal !== null) aiInferredGoals.push(aiCurrentGoal);
        singleTrialData.humanCurrentGoal.push(humanCurrentGoal);
        singleTrialData.aiCurrentGoal.push(aiCurrentGoal);

        playerState = aimNextState;
        aiState = aiNextState;

        P1AtGoal_2P3G = isGoalReached(playerState, goals);

        // Check for trial end
        let trialOver = isGoalReached(playerState, goals) && isGoalReached(aiState, goals);
        if (trialOver) {
            let humanGoal = whichGoalReached(playerState, goals);
            let aiGoal = whichGoalReached(aiState, goals);
            singleTrialData.collaborationSucceeded = (humanGoal === aiGoal && humanGoal !== 0);
            allTrialsData.push(singleTrialData);
            P1AtGoal_2P3G = false;
            return false; // End loop
        } else {
            stepCount++;
            return true; // Continue loop
        }
    },
    data: { type: 'mainloop_2P3G' }
}

var updateTrial_2P3G = {
    type: jsPsychCallFunction,
    func: function () {
        curTrial_2P3G++;
    },
    data: { type: 'updateTrial_2P3G' }
}

var experiment_2P3G = {
    timeline: [initialMap_2P3G, fixationWithTime, mainTaskHumanAI_2P3G, collaborationFeedback, updateTrial_2P3G],
    repetitions: nTrialsFor2P3G
}


// =================================================================================================
// END EXPERIMENT
// =================================================================================================

// Function to convert allTrialsData to CSV format
function convertToCSV(allTrialsData) {
    if (!allTrialsData || allTrialsData.length === 0) {
        return "trialIndex,message\n0,No experimental data available";
    }

    // Get all unique keys from all trials
    const allKeys = new Set();
    allTrialsData.forEach(trial => {
        if (trial && typeof trial === 'object') {
            Object.keys(trial).forEach(key => allKeys.add(key));
        }
    });

    // Convert Set to Array and sort for consistent order
    const headers = Array.from(allKeys).sort();

    // Create CSV header
    let csv = headers.join(',') + '\n';

    // Add data rows
    allTrialsData.forEach(trial => {
        if (trial && typeof trial === 'object') {
            const row = headers.map(header => {
                let value = trial[header];

                // Handle arrays and objects
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                } else if (value === null || value === undefined) {
                    value = '';
                } else {
                    value = String(value);
                }

                // Escape commas and quotes
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }

                return value;
            });
            csv += row.join(',') + '\n';
        }
    });

    return csv;
}

// Function to convert questionnaire data to array format for Excel
function convertQuestionnaireToArray(questionnaireData) {
    if (!questionnaireData) {
        return [
            ['Question', 'Response'],
            ['No questionnaire data available', '']
        ];
    }

    // Define question mappings with multiple possible key formats
    const questionMappings = [
        {
            keys: ['Q0', 'q0', 'P0_Q0', 'p0_q0', '0'],
            question: 'Do you think the other player is a person or an AI agent?'
        },
        {
            keys: ['Q1', 'q1', 'P0_Q1', 'p0_q1', '1'],
            question: 'To what extent do you think the other player was a good collaborator?'
        },
        {
            keys: ['Q2', 'q2', 'P0_Q2', 'p0_q2', '2'],
            question: 'Will you play with them again?'
        },
        {
            keys: ['Q3', 'q3', 'P1_Q0', 'p1_q0', '3'],
            question: 'Did you use any strategy in the game? If yes, what was it?'
        },
        {
            keys: ['Q4', 'q4', 'P1_Q1', 'p1_q1', '4'],
            question: 'What do you think the purpose of this experiment is?'
        },
        {
            keys: ['Q5', 'q5', 'P1_Q2', 'p1_q2', '5'],
            question: 'Do you have any questions or comments?'
        }
    ];

    const questionnaireArray = [['Question', 'Response']];

    // Add each question-response pair
    questionMappings.forEach((mapping, index) => {
        let response = '';

        // Try to find the response using different possible keys
        for (let key of mapping.keys) {
            if (questionnaireData[key] !== undefined && questionnaireData[key] !== null) {
                response = questionnaireData[key];
                break;
            }
        }

        // If still not found, try to find by index in an array-like structure
        if (response === '' && Array.isArray(questionnaireData)) {
            response = questionnaireData[index] || '';
        }

        // If still not found, check if questionnaireData has a response array
        if (response === '' && questionnaireData.response && Array.isArray(questionnaireData.response)) {
            response = questionnaireData.response[index] || '';
        }

        questionnaireArray.push([mapping.question, String(response)]);
    });

    return questionnaireArray;
}



// Function to download Excel file with multiple sheets
function downloadExcel(experimentData, questionnaireData, filename) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found. Please include the SheetJS library.');
            alert('Excel export requires the SheetJS library. The file will be downloaded as CSV instead.');

            // Fallback to CSV
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            if (experimentData && experimentData.length > 0) {
                const experimentCSV = convertToCSV(experimentData);
                downloadCSV(experimentCSV, `experiment_data_${timestamp}.csv`);
            }
            if (questionnaireData && questionnaireData.length > 1) {
                const questionnaireCSV = questionnaireData.map(row => row.join(',')).join('\n');
                downloadCSV(questionnaireCSV, `questionnaire_data_${timestamp}.csv`);
            }
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Add experiment data sheet
        if (experimentData && experimentData.length > 0) {
            // Pre-process the data to handle complex objects and arrays
            const processedData = experimentData.map(trial => {
                const processedTrial = {};
                for (const key in trial) {
                    if (trial.hasOwnProperty(key)) {
                        let value = trial[key];
                        // Convert arrays and objects to JSON strings for Excel compatibility
                        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                            processedTrial[key] = JSON.stringify(value);
                        } else if (value === null || value === undefined) {
                            processedTrial[key] = ''; // Keep empty for null/undefined
                        } else {
                            processedTrial[key] = value;
                        }
                    }
                }
                return processedTrial;
            });

            const experimentWS = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(wb, experimentWS, "Experiment Data");
        } else {
            // Create empty sheet with message
            const emptyWS = XLSX.utils.aoa_to_sheet([["No experiment data available - only questionnaire was run"]]);
            XLSX.utils.book_append_sheet(wb, emptyWS, "Experiment Data");
        }

        // Add questionnaire data sheet
        if (questionnaireData && questionnaireData.length > 1) {
            const questionnaireWS = XLSX.utils.aoa_to_sheet(questionnaireData);
            XLSX.utils.book_append_sheet(wb, questionnaireWS, "Questionnaire Data");
        } else {
            // Create empty questionnaire sheet
            const emptyQuestionnaireWS = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
            XLSX.utils.book_append_sheet(wb, emptyQuestionnaireWS, "Questionnaire Data");
        }

        // Write the file
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error('Error creating Excel file:', error);
        alert('Error creating Excel file. Please try again.');
    }
}

// Function to download CSV file (fallback)
function downloadCSV(csvContent, filename) {
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            console.error('Download not supported in this browser');
        }
    } catch (error) {
        console.error('Error downloading CSV:', error);
    }
}

var saveDataToExcel = {
    type: jsPsychCallFunction,
    func: function () {
        try {
            // Get all jsPsych data
            const allJsPsychData = jsPsych.data.get().values();

            // If allTrialsData is empty, try to extract trial data from jsPsych data
            let experimentData = allTrialsData;
            if (!allTrialsData || allTrialsData.length === 0) {
                // Extract step-by-step data from jsPsych
                const stepTrials = allJsPsychData.filter(trial => trial.type === 'eachStep');

                // If we have step data, create a summary trial
                if (stepTrials.length > 0) {
                    const summaryTrial = {
                        trialIndex: 0,
                        totalSteps: stepTrials.length,
                        trialType: '2P3G_partial',
                        startTime: stepTrials[0].time_elapsed,
                        endTime: stepTrials[stepTrials.length - 1].time_elapsed,
                        duration: stepTrials[stepTrials.length - 1].time_elapsed - stepTrials[0].time_elapsed,
                        responses: stepTrials.map(trial => trial.response),
                        reactionTimes: stepTrials.map(trial => trial.rt),
                        note: 'Trial not completed - partial data only'
                    };
                    experimentData = [summaryTrial];
                }

                // If still no data, create a placeholder
                if (experimentData.length === 0) {
                    experimentData = [{
                        trialIndex: 0,
                        note: 'No experimental data collected - experiment may not have been completed',
                        totalJsPsychTrials: allJsPsychData.length,
                        timestamp: new Date().toISOString()
                    }];
                }
            }

            // Get questionnaire data from jsPsych
            let questionnaireResponse = null;
            const questionnaireTrials = jsPsych.data.get().filter({ type: 'postQuestionnaire' }).values();

            if (questionnaireTrials.length > 0) {
                const questionnaireData = questionnaireTrials[0];
                questionnaireResponse = questionnaireData.response || questionnaireData;
            }

            // Convert questionnaire data to array format
            const questionnaireArray = convertQuestionnaireToArray(questionnaireResponse);

            // Create Excel file with both datasets
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const excelFilename = `experiment_data_${timestamp}.xlsx`;

            downloadExcel(experimentData, questionnaireArray, excelFilename);

        } catch (error) {
            console.error('Error in saveDataToExcel:', error);
            alert('Error saving data. Please try again.');
        }
    }
}

// Function to create Excel file and send to Google Drive
function sendExcelToGoogleDrive(experimentData, questionnaireData, filename) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found. Please include the SheetJS library.');
            alert('Excel export requires the SheetJS library. Please refresh the page and try again.');
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Add experiment data sheet
        if (experimentData && experimentData.length > 0) {
            // Pre-process the data to handle complex objects and arrays
            const processedData = experimentData.map(trial => {
                const processedTrial = {};
                for (const key in trial) {
                    if (trial.hasOwnProperty(key)) {
                        let value = trial[key];
                        // Convert arrays and objects to JSON strings for Excel compatibility
                        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                            processedTrial[key] = JSON.stringify(value);
                        } else if (value === null || value === undefined) {
                            processedTrial[key] = ''; // Keep empty for null/undefined
                        } else {
                            processedTrial[key] = value;
                        }
                    }
                }
                return processedTrial;
            });

            const experimentWS = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(wb, experimentWS, "Experiment Data");
        } else {
            // Create empty sheet with message
            const emptyWS = XLSX.utils.aoa_to_sheet([["No experiment data available - only questionnaire was run"]]);
            XLSX.utils.book_append_sheet(wb, emptyWS, "Experiment Data");
        }

        // Add questionnaire data sheet
        if (questionnaireData && questionnaireData.length > 1) {
            const questionnaireWS = XLSX.utils.aoa_to_sheet(questionnaireData);
            XLSX.utils.book_append_sheet(wb, questionnaireWS, "Questionnaire Data");
        } else {
            // Create empty questionnaire sheet
            const emptyQuestionnaireWS = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
            XLSX.utils.book_append_sheet(wb, emptyQuestionnaireWS, "Questionnaire Data");
        }

        // Convert workbook to binary array for sending to Google Drive
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // Convert to base64 string for transmission
        const base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(wbout)));

        // Create FormData to send file
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('filedata', base64String);
        formData.append('filetype', 'excel');

        // Send to Google Drive via Apps Script
        fetch("https://script.google.com/macros/s/AKfycbyfQ-XKsoFbmQZGM7c741rEXh2ZUpVK-uUIu9ycooXKnaxM5-hRSzIUhQ-uWZ668Qql/exec", {
            method: "POST",
            mode: "no-cors",  // Required for Google Apps Script from local files
            body: formData
        }).then(response => {
            alert('Data saved successfully!');

            // Redirect to Prolific completion page
            redirectToProlific();

        }).catch(error => {
            console.error('Error saving to Google Drive:', error);
            alert('Error saving to Google Drive. Please try again.');
        });

    } catch (error) {
        console.error('Error creating Excel file for Google Drive:', error);
        alert('Error creating Excel file. Please try again.');
    }
}

redirectToProlific = function () {
    window.location.href = "https://app.prolific.com/submissions/complete?cc=C19EH5X9";
}

var saveCSVToGoogleDrive = {
    type: jsPsychCallFunction,
    func: function () {
        try {
            // Get all jsPsych data
            const allJsPsychData = jsPsych.data.get().values();

            // If allTrialsData is empty, try to extract trial data from jsPsych data
            let experimentData = allTrialsData;
            if (!allTrialsData || allTrialsData.length === 0) {
                // Extract step-by-step data from jsPsych
                const stepTrials = allJsPsychData.filter(trial => trial.type === 'eachStep');

                // If we have step data, create a summary trial
                if (stepTrials.length > 0) {
                    const summaryTrial = {
                        trialIndex: 0,
                        totalSteps: stepTrials.length,
                        trialType: '2P3G_partial',
                        startTime: stepTrials[0].time_elapsed,
                        endTime: stepTrials[stepTrials.length - 1].time_elapsed,
                        duration: stepTrials[stepTrials.length - 1].time_elapsed - stepTrials[0].time_elapsed,
                        responses: stepTrials.map(trial => trial.response),
                        reactionTimes: stepTrials.map(trial => trial.rt),
                        note: 'Trial not completed - partial data only'
                    };
                    experimentData = [summaryTrial];
                }

                // If still no data, create a placeholder
                if (experimentData.length === 0) {
                    experimentData = [{
                        trialIndex: 0,
                        note: 'No experimental data collected - experiment may not have been completed',
                        totalJsPsychTrials: allJsPsychData.length,
                        timestamp: new Date().toISOString()
                    }];
                }
            }

            // Get questionnaire data from jsPsych
            let questionnaireResponse = null;
            const questionnaireTrials = jsPsych.data.get().filter({ type: 'postQuestionnaire' }).values();

            if (questionnaireTrials.length > 0) {
                const questionnaireData = questionnaireTrials[0];
                questionnaireResponse = questionnaireData.response || questionnaireData;
            }

            // Convert questionnaire data to array format
            const questionnaireArray = convertQuestionnaireToArray(questionnaireResponse);

            // Create Excel file to send to Google Drive
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const excelFilename = `experiment_data_${timestamp}.xlsx`;

            sendExcelToGoogleDrive(experimentData, questionnaireArray, excelFilename);

        } catch (error) {
            console.error('Error in saveCSVToGoogleDrive:', error);
            alert('Error saving data to Google Drive. Please try again.');
        }
    }
};

// =================================================================================================
// CONSENT FORM SECTION
// =================================================================================================

var consentForm = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div style="max-width: 800px; margin: 0 auto; padding: 20px; text-align: left; font-family: Arial, sans-serif;">
            <h2 style="text-align: center; color: #333; margin-bottom: 30px;">Consent Form</h2>

            <p style="font-size: 22px; line-height: 1.6; margin-bottom: 20px;">
                You are invited to participate in a research study about decision-making. This study is conducted by researchers at Duke University and UCLA. Participation is voluntary.
            </p>

                        <ul style="font-size: 22px; line-height: 1.6; margin-bottom: 20px;">
                <li>The study will take approximately 10 minutes.</li>
                <li>Your responses are anonymous and confidential.</li>
                <li>You may withdraw at any time.</li>
                <li>No personally identifiable information will be collected.</li>
            </ul>

            <p style="font-size: 22px; line-height: 1.6; margin-bottom: 20px;">
                <strong>Compensation:</strong> You will receive $2 for your participation in this study, and a potential additional $0.50 bonus if you finish the task well enough.
            </p>

            <p style="font-size: 22px; line-height: 1.6; margin-bottom: 30px;">
                By clicking "I Agree", you indicate that you are at least 18 years old and consent to participate in the study.
            </p>

            <div style="text-align: center; margin-bottom: 30px;">
                <label style="font-size: 18px; cursor: pointer;">
                    <input type="checkbox" id="consentCheckbox" style="margin-right: 10px; transform: scale(1.2);" required>
                    I Agree
                </label>
            </div>

            <p style="text-align: center; font-size: 22px; margin-bottom: 20px;">
                Click "Next" to begin the study.
            </p>
        </div>
    `,
    choices: ['Next'],
    button_html: '<button class="jspsych-btn" style="font-size: 18px; padding: 10px 20px;" %choice%>%choice%</button>',
    on_load: function () {
        // Variable to track consent state
        let consentGiven = false;

        // Disable the Next button initially
        const nextButton = document.querySelector('.jspsych-btn');
        nextButton.disabled = true;
        nextButton.style.opacity = '0.5';

        // Enable the Next button when checkbox is checked
        document.getElementById('consentCheckbox').addEventListener('change', function () {
            consentGiven = this.checked;
            if (consentGiven) {
                nextButton.disabled = false;
                nextButton.style.opacity = '1';
            } else {
                nextButton.disabled = true;
                nextButton.style.opacity = '0.5';
            }
        });

        // Store consent state in a way that can be accessed later
        window.consentGiven = consentGiven;

        // Update consent state when button is clicked
        nextButton.addEventListener('click', function () {
            window.consentGiven = document.getElementById('consentCheckbox') ? document.getElementById('consentCheckbox').checked : false;
        });
    },
    on_finish: function (data) {
        // Use the stored consent state
        const consentGiven = window.consentGiven || false;
        data.consent_given = consentGiven;

        if (!consentGiven) {
            // If no consent, end the experiment
            jsPsych.endExperiment('Thank you for your time. The study has been ended as consent was not provided.');
        }
    },
    data: { type: 'consent' }
};

// =================================================================================================
// POST-QUESTIONNAIRE SECTION
// =================================================================================================

var postQuestionnaire = {
    type: jsPsychSurvey,
    pages: [
        [
            {
                type: 'multi-choice',
                prompt: 'Do you think the other player is a person or an AI agent?',
                options: ['Definitely a person', 'Probably a person', 'Not sure', 'Probably an AI', 'Definitely an AI'],
                required: true
            },
            {
                type: 'multi-choice',
                prompt: 'To what extent do you think the other player was a good collaborator?',
                options: ['Very poor', 'Poor', 'Neutral', 'Good', 'Very good'],
                required: true
            },
            {
                type: 'multi-choice',
                prompt: 'Will you play with them again?',
                options: ['Definitely not', 'Probably not', 'Not sure', 'Probably yes', 'Definitely yes'],
                required: true
            }
        ],
        [
            {
                type: 'text',
                prompt: 'Did you use any strategy in the game? If yes, what was it?',
                placeholder: 'Please describe your strategy...',
                required: false
            },
            {
                type: 'text',
                prompt: 'What do you think the purpose of this experiment is?',
                placeholder: 'Please share your thoughts...',
                required: false
            },
            {
                type: 'text',
                prompt: 'Do you have any questions or comments?',
                placeholder: 'Any additional feedback...',
                required: false
            }
        ]
    ],
    title: 'Post-Experiment Questionnaire',
    button_label_finish: 'Submit',
    data: { type: 'postQuestionnaire' }
};

var endExpInfo = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        return `
            <p style="font-size:30px;">You have finished all the tasks!</p>
            <p style="font-size:30px;">Wait for a few seconds and the data will be saved!</p>
            <p style="font-size:30px;">Please do not close the browser.</p>
        `;
    },
    choices: ['OK!'],
};

// =================================================================================================
// MAIN EXPERIMENT FLOW
// =================================================================================================

// Welcome screen for the 1P1G task
var welcome_1P1G = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p style="font-size:30px;">Welcome to the 1-Player-1-Goal Task. Press space bar to begin.</p>',
    choices: [' ']
};

// Welcome screen for the 1P2G task
var welcome_1P2G = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p style="font-size:30px;">Welcome to the 1-Player-2-Goals Task. Press any key to begin.</p>'
};

// Welcome screen for the 2P2G task
var welcome_2P2G = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p style="font-size:30px;">Welcome to the 2-Player-2-Goals Task. Press any key to begin.</p>'
};

// Welcome screen for the 2P3G task
var welcome_2P3G = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `

        <p style="font-size:22px; color: #333; margin-top: 20px;">In this game, a <strong>new</strong> restaurant will open during the game.</p>
        <p style="font-size:22px; color: #333; margin-top: 10px;">This restaurant is the same as the previous two restaurants, and you can choose any of the three!</p>
        <ul style="font-size:22px; text-align:left; max-width: 700px; margin: 0 auto 20px auto; ">
            <li style="margin-bottom: 10px;">If you reach a destination, you can get <strong>1 point</strong>!</li>
            <li style="margin-bottom: 10px; background-color: #ffff99;">If you and the other player reach the <strong>same</strong> destination, you can get an additional <strong>4 points</strong>!</li>
            <li style="margin-bottom: 10px;">If you take too many steps or too much time, you get <strong>0 points</strong>!</li>
        </ul>

        <p style="font-size:24px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
    `,
    choices: [' ']
};

// Initialize precomputed policy loader
var initializePolicies = {
    type: jsPsychCallFunction,
    func: function () {
        console.log('🔧 Initializing experiment and policy loader...');
        console.log(`🎯 Agent type is: ${RL_AGENT_TYPE}`);
        console.log(`🔧 Function available: ${typeof initializePolicyLoader === 'function'}`);

        // For now, we'll do the initialization synchronously
        // and let the first AI action call trigger the async loading
        if (RL_AGENT_TYPE === 'joint') {
            console.log('✅ Policy loader setup complete - will initialize on first use');
        } else {
            console.log(`ℹ️ Skipping policy initialization - using ${RL_AGENT_TYPE} agent`);
        }
    },
    data: { type: 'policyInit' }
};

// Add the tasks to the main timeline
// timeline.push(consentForm);
// timeline.push(initializePolicies);
// timeline.push(welcome_1P1G);
// timeline.push(experiment_1P1G);
// timeline.push(welcome_1P2G);
// timeline.push(experiment_1P2G);
// timeline.push(welcome_2P2G);
// timeline.push(experiment_2P2G);
// timeline.push(welcome_2P3G);
timeline.push(experiment_2P3G);
timeline.push(postQuestionnaire);
timeline.push(saveCSVToGoogleDrive);
timeline.push(endExpInfo);

// Run the entire experiment
jsPsych.run(timeline);

