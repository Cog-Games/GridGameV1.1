//5,8,8,
var nTrialsFor1P1G = 2;
var nTrialsFor1P2G = 2;
var nTrialsFor2P2G = 2;

var mapData2P2G = MapsFor2P2G;
var mapData1P1G = MapsFor1P1G;
var mapData1P2G = MapsFor1P2G;

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


var gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(()=>Array(EXPSETTINGS.matrixsize).fill(0))

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
    data: { type: 'eachStep' }
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

var curTrial_2P2G = 0;

var initialMap_2P2G = {
    type: jsPsychCallFunction,
    func: function(){
        stepCount = 0;
        P1AtGoal = false;
        let currentDesign = mapData2P2G[curTrial_2P2G][0]

        gridMatrixList = Array(EXPSETTINGS.matrixsize).fill(0).map(()=>Array(EXPSETTINGS.matrixsize).fill(0))

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
    data:{type: 'initial'}
}


var eachStepPhase = {
    timeline: [eachStep],
    conditional_function: function () {
        return !P1AtGoal;
    }
};


function getAIAction(gridMatrix, currentPos, goals) {
    // goals should already be in the correct format [[x1, y1], [x2, y2]]
    let goalStates = goals;
    let action = getRLAction(currentPos, goalStates);

    // Convert string action to array format
    if (typeof action === 'string') {
        action = action.split(',').map(Number);
    }

    return action;
}

var waitStep = {
    type: jsPsychCanvasKeyboardResponse,
    canvas_size: [WINSETTING.w, WINSETTING.h],
    stimulus: drawGridWithGoals,
    choices: "NO_KEYS",
    prompt: '<p style="font-size:20px;text-align: center;">Please wait for the other player to reach the goal</p>',
    trial_duration: AGENT_TIME_DELAY,
    // on_finish: function(data){
    //     data.type = 'keypress';
    // }
};

var waitPlayer2Phase = {
    timeline: [waitStep],
    conditional_function: function () {
        return P1AtGoal;
    },
};

var mainTaskHumanAI = {
    timeline: [eachStepPhase, waitPlayer2Phase],
    loop_function: function() {
        let currentDesign = mapData2P2G[curTrial_2P2G][0];
        let goals = [currentDesign.target1, currentDesign.target2];

        // Update global goals for visualization
        currentGoals = goals;

        // Human player movement
        let aimAction;
        if (!P1AtGoal) {
            let responseKey = jsPsych.data.getLastTrialData().filter({ type:'eachStep'}).trials[0].response;
            aimAction = DIRECTIONS[responseKey.toLowerCase()].movement;
            singleTrialData.RT.push(jsPsych.data.getLastTrialData().select('rt').values[0]);
            realAction = isValidMove(gridMatrixList, playerState, aimAction);
        } else {
            realAction = [0, 0]; // No action if goal is reached
        }

        // AI player movement
        let aiAction = getAIAction(gridMatrixList, aiState, goals);

        // Check if the AI has reached the goal
        if (isGoalReached(aiState, goals)) {
            aiRealAction = [0, 0];
        } else {
            aiRealAction = isValidMove(gridMatrixList, aiState, aiAction);
        }

        // Update the grid matrix for the human player
        let aimNextState = transition(playerState, realAction);
        gridMatrixList = updateMatrix(gridMatrixList, playerState[0], playerState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, aimNextState[0], aimNextState[1], OBJECT.player);

        // Update the grid matrix for the AI player
        let aiNextState = transition(aiState, aiRealAction);
        gridMatrixList = updateMatrix(gridMatrixList, aiState[0], aiState[1], OBJECT.blank);
        gridMatrixList = updateMatrix(gridMatrixList, aiNextState[0], aiNextState[1], OBJECT.ai_player);


        singleTrialData.aimAction.push(aimAction);
        singleTrialData.aiAction.push(aiAction);
        singleTrialData.trajectory.push(aimNextState);
        singleTrialData.aiTrajectory.push(aiNextState);

        playerState = aimNextState;
        aiState = aiNextState;

        P1AtGoal = isGoalReached(playerState, goals);

        // Check if both players have reached their goals
        let trialOver = isGoalReached(playerState, goals) && isGoalReached(aiState, goals);

        if (trialOver) {
            allTrialsData.push(singleTrialData);
            P1AtGoal = false;
            return false;
        } else {
            stepCount++;
            return true; // Continue the trial
        }
    },
    data: { type: 'mainloop' }
}

var updateTrial = {
    type: jsPsychCallFunction,
    func: function(){
        drawGridWithGoals;
        curTrial_2P2G++;
    },
    data: {type: 'updateTrial'}
}



var experiment_2P2G = {
    timeline: [initialMap_2P2G, fixationWithTime, mainTaskHumanAI, pauseTrial, updateTrial],
    repetitions: nTrialsFor2P2G
}


// =================================================================================================
// END EXPERIMENT
// =================================================================================================

// Function to convert allTrialsData to CSV format
function convertToCSV(allTrialsData) {
    if (allTrialsData.length === 0) {
        return "No data available";
    }

    // Get all unique keys from all trials
    const allKeys = new Set();
    allTrialsData.forEach(trial => {
        Object.keys(trial).forEach(key => allKeys.add(key));
    });

    // Convert Set to Array and sort for consistent order
    const headers = Array.from(allKeys).sort();

    // Create CSV header
    let csv = headers.join(',') + '\n';

    // Add data rows
    allTrialsData.forEach(trial => {
        const row = headers.map(header => {
            let value = trial[header];

            // Handle arrays and objects
            if (Array.isArray(value)) {
                value = JSON.stringify(value);
            } else if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value);
            } else if (value === null || value === undefined) {
                value = '';
            }

            // Escape commas and quotes
            if (typeof value === 'string') {
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
            }

            return value;
        });
        csv += row.join(',') + '\n';
    });

    return csv;
}

// Function to download CSV file
function downloadCSV(csvContent, filename) {
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
    }
}

var saveCSVDataLocal = {
    type: jsPsychCallFunction,
    func: function () {
        const csvContent = convertToCSV(allTrialsData);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `experiment_data_${timestamp}.csv`;
        downloadCSV(csvContent, filename);
    }
}

var saveCSVToGoogleDrive = {
    type: jsPsychCallFunction,
    func: function () {
        const csvContent = convertToCSV(allTrialsData);
        fetch("https://script.google.com/macros/s/AKfycbwl6zfffuaFVivO0lSk97gJKhzbsFo_IQ9QtXkDlVhXTo6j46M1vfX51pvEbD92v29A/exec", {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain"
            },
            body: csvContent
        });
    }
};

var endExpInfo = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
        return `
            <p style="font-size:30px;">You have finished all the tasks!</p>
            <p style="font-size:30px;">Please press the button to save the data.</p>
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


// Add the tasks to the main timeline
timeline.push(welcome_1P1G);
timeline.push(experiment_1P1G);
timeline.push(welcome_1P2G);
timeline.push(experiment_1P2G);
timeline.push(welcome_2P2G);
timeline.push(experiment_2P2G);
timeline.push(saveCSVToGoogleDrive);
timeline.push(endExpInfo);

// Run the entire experiment
jsPsych.run(timeline);

