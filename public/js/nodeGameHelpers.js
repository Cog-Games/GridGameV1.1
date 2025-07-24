// =================================================================================================
// NodeGame Experiments Helper Functions
// =================================================================================================
//
// This file contains utility functions and helpers for the NodeGame experiments.
// These functions are separated from the main experimental logic for better organization.
//
// =================================================================================================

// =================================================================================================
// EXPERIMENT SELECTION HELPER FUNCTIONS
// =================================================================================================

/**
 * Quick experiment selection functions - use these to easily switch between experiments
 * Call these functions before starting the experiment to change which experiments run
 */

/**
 * Set experiment to run only 1P1G
 */
function setExperiment1P1G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G'];
        console.log('Experiment set to 1P1G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 1P2G
 */
function setExperiment1P2G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P2G'];
        console.log('Experiment set to 1P2G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 2P2G
 */
function setExperiment2P2G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P2G'];
        console.log('Experiment set to 2P2G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 2P3G
 */
function setExperiment2P3G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P3G'];
        console.log('Experiment set to 2P3G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run all experiments in sequence
 */
function setExperimentAll() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G', '2P2G', '2P3G'];
        console.log('Experiment set to run all experiments');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run collaboration experiments only (2P2G and 2P3G)
 */
function setExperimentCollaboration() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P2G', '2P3G'];
        console.log('Experiment set to collaboration experiments only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run single player experiments only (1P1G and 1P2G)
 */
function setExperimentSinglePlayer() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G'];
        console.log('Experiment set to single player experiments only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set custom experiment order
 * @param {Array} experimentOrder - Array of experiment types to run
 */
function setCustomExperimentOrder(experimentOrder) {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = experimentOrder;
        console.log('Experiment set to custom order:', experimentOrder);
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

// =================================================================================================
// GAME LOGIC HELPER FUNCTIONS
// =================================================================================================

/**
 * Setup grid matrix for a trial
 */
function setupGridMatrixForTrial(design, experimentType) {

    // Check if design is valid
    if (!design) {
        console.error('Invalid design provided to setupGridMatrixForTrial:', design);
        alert('Error: No map data available. Please refresh the page and try again.');
        return;
    }

    // Validate design properties
    if (!design.initPlayerGrid || !Array.isArray(design.initPlayerGrid) || design.initPlayerGrid.length < 2) {
        console.error('Invalid initPlayerGrid in design:', design);
        alert('Error: Invalid map data. Please refresh the page and try again.');
        return;
    }

    if (experimentType.includes('2P') && (!design.initAIGrid || !Array.isArray(design.initAIGrid) || design.initAIGrid.length < 2)) {
        console.error('Invalid initAIGrid in design for 2P experiment:', design);
        alert('Error: Invalid map data for 2P experiment. Please refresh the page and try again.');
        return;
    }

    if (!design.target1 || !Array.isArray(design.target1) || design.target1.length < 2) {
        console.error('Invalid target1 in design:', design);
        alert('Error: Invalid map data. Please refresh the page and try again.');
        return;
    }

    gameData.gridMatrix = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0));

    // Add player
    gameData.gridMatrix[design.initPlayerGrid[0]][design.initPlayerGrid[1]] = OBJECT.player;
    gameData.playerState = [...design.initPlayerGrid];

    // Add AI player if needed
    if (experimentType.includes('2P')) {
        gameData.gridMatrix[design.initAIGrid[0]][design.initAIGrid[1]] = OBJECT.ai_player;
        gameData.aiState = [...design.initAIGrid];
    }

    // Add goals
    gameData.gridMatrix[design.target1[0]][design.target1[1]] = OBJECT.goal;
    gameData.currentGoals = [design.target1];

    // Add second goal if available
    if (design.target2) {
        gameData.gridMatrix[design.target2[0]][design.target2[1]] = OBJECT.goal;
        gameData.currentGoals.push(design.target2);
    }

    // Pre-calculate joint-RL policy for human-AI initial goals to eliminate first-move lag
    // Note: This is only needed for human-AI experiments, not human-human experiments
    if (experimentType.includes('2P') && window.RLAgent && window.RLAgent.precalculatePolicyForGoals) {
        console.log('⚡ Pre-calculating joint-RL policy for human-AI initial goals:', gameData.currentGoals.map(g => `[${g}]`).join(', '));

        // Pre-calculate in background immediately after grid setup
        setTimeout(() => {
            window.RLAgent.precalculatePolicyForGoals(gameData.currentGoals, experimentType);
        }, 0);
    }
}

/**
 * State transition function for grid movement
 * @param {Array} state - Current position [row, col]
 * @param {Array} action - Action to take [deltaRow, deltaCol]
 * @returns {Array} - New position [row, col]
 */
function transition(state, action) {
    let [x, y] = state;
    let nextState = [x+action[0],y+action[1]]
    return nextState
}

/**
 * Calculate grid distance between two positions (Manhattan distance)
 * @param {Array} pos1 - First position [row, col]
 * @param {Array} pos2 - Second position [row, col]
 * @returns {number} - Manhattan distance between positions
 */
function calculatetGirdDistance(pos1, pos2) {
    if (!pos1 || !pos2 || !Array.isArray(pos1) || !Array.isArray(pos2) ||
        pos1.length < 2 || pos2.length < 2) {
        return Infinity; // Return large distance for invalid positions
    }
    return Math.abs(pos1[0] - pos2[0]) + Math.abs(pos1[1] - pos2[1]);
}

/**
 * Check if a position is valid within the grid bounds
 * @param {Array} position - Position to check [row, col]
 * @returns {boolean} - True if position is valid
 */
function isValidPosition(position) {
    if (!position || !Array.isArray(position) || position.length < 2) {
        return false;
    }
    const [row, col] = position;
    return row >= 0 && row < EXPSETTINGS.matrixsize && col >= 0 && col < EXPSETTINGS.matrixsize;
}

/**
 * Check if a player has reached any goal
 * @param {Array} playerPos - Player position [row, col]
 * @param {Array} goals - Array of goal positions [[row, col], ...]
 * @returns {boolean} - True if player is at any goal
 */
function isGoalReached(playerPos, goals) {
    if (!playerPos || !goals || !Array.isArray(goals)) {
        return false;
    }

    for (let i = 0; i < goals.length; i++) {
        if (playerPos[0] === goals[i][0] && playerPos[1] === goals[i][1]) {
            return true;
        }
    }
    return false;
}

/**
 * Check which goal a player has reached
 * @param {Array} playerPos - Player position [row, col]
 * @param {Array} goals - Array of goal positions [[row, col], ...]
 * @returns {number|null} - Index of reached goal, or null if none reached
 */
function whichGoalReached(playerPos, goals) {
    for (var i = 0; i < goals.length; i++) {
        if (isGoalReached(playerPos, [goals[i]])) {
            return i;
        }
    }
    return null;
}

/**
 * Detect which goal a player is heading towards
 * @param {Array} playerPos - Current player position [row, col]
 * @param {Array|string} action - Action being taken (array or string)
 * @param {Array} goals - Array of goal positions [[row, col], ...]
 * @param {Array} goalHistory - History of previously inferred goals
 * @returns {number|null} - Index of goal being approached, or null if unclear
 */
function detectPlayerGoal(playerPos, action, goals, goalHistory) {
    if (!action) {
        return null;
    }

    // Convert string action to array format
    let actionArray;
    if (typeof action === 'string') {
        switch (action) {
            case 'up':
                actionArray = [-1, 0];
                break;
            case 'down':
                actionArray = [1, 0];
                break;
            case 'left':
                actionArray = [0, -1];
                break;
            case 'right':
                actionArray = [0, 1];
                break;
            default:
                return null;
        }
    } else if (Array.isArray(action)) {
        actionArray = action;
    } else {
        return null;
    }

    if (actionArray[0] === 0 && actionArray[1] === 0) {
        return null; // No movement, can't determine goal
    }

    var nextPos = transition(playerPos, actionArray);
    var minDistance = Infinity;
    var closestGoal = null;
    var equidistantGoals = [];

    for (var i = 0; i < goals.length; i++) {
        var distance = calculatetGirdDistance(nextPos, goals[i]);
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

// =================================================================================================
// MAP AND DISTANCE CONDITION HELPER FUNCTIONS
// =================================================================================================

/**
 * Get maps for a specific experiment type
 * @param {string} experimentType - Type of experiment
 * @returns {Object} - Map data for the experiment
 */
function getMapsForExperiment(experimentType) {
    var mapData;
    switch (experimentType) {
        case '1P1G':
            mapData = window.MapsFor1P1G || MapsFor1P1G;
            break;
        case '1P2G':
            mapData = window.MapsFor1P2G || MapsFor1P2G;
            break;
        case '2P2G':
            mapData = window.MapsFor2P2G || MapsFor2P2G;
            break;
        case '2P3G':
            mapData = window.MapsFor2P3G || MapsFor2P3G;
            break;
        default:
            mapData = window.MapsFor1P1G || MapsFor1P1G;
            break;
    }

    return mapData;
}

/**
 * Generate randomized distance condition sequence for 2P3G trials
 * Ensures equal representation of each condition in random order
 * @param {number} numTrials - Number of 2P3G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomizedDistanceSequence(numTrials) {
    var allConditions = [
        TWOP3G_CONFIG.distanceConditions.CLOSER_TO_AI,
        TWOP3G_CONFIG.distanceConditions.CLOSER_TO_HUMAN,
        TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH,
        TWOP3G_CONFIG.distanceConditions.NO_NEW_GOAL
    ];

    var numConditions = allConditions.length;
    var trialsPerCondition = Math.floor(numTrials / numConditions);
    var remainingTrials = numTrials % numConditions;

    // Create array with equal representation of each condition
    var sequence = [];
    for (var i = 0; i < numConditions; i++) {
        for (var j = 0; j < trialsPerCondition; j++) {
            sequence.push(allConditions[i]);
        }
    }

    // Add remaining trials (if any) by cycling through conditions
    for (var k = 0; k < remainingTrials; k++) {
        sequence.push(allConditions[k]);
    }

    // Shuffle the sequence using Fisher-Yates algorithm
    for (var m = sequence.length - 1; m > 0; m--) {
        var randomIndex = Math.floor(Math.random() * (m + 1));
        var temp = sequence[m];
        sequence[m] = sequence[randomIndex];
        sequence[randomIndex] = temp;
    }

    console.log('Generated randomized distance condition sequence for', numTrials, 'trials:');
    console.log('Trials per condition:', trialsPerCondition, 'Remaining trials:', remainingTrials);
    console.log('Sequence:', sequence);

    return sequence;
}

/**
 * Generate randomized distance condition sequence for 1P2G trials
 * Ensures equal representation of each condition in random order
 * @param {number} numTrials - Number of 1P2G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomized1P2GDistanceSequence(numTrials) {
    var allConditions = [
        ONEP2G_CONFIG.distanceConditions.CLOSER_TO_HUMAN,
        ONEP2G_CONFIG.distanceConditions.FARTHER_TO_HUMAN,
        ONEP2G_CONFIG.distanceConditions.EQUAL_TO_HUMAN,
        ONEP2G_CONFIG.distanceConditions.NO_NEW_GOAL
    ];

    var numConditions = allConditions.length;
    var trialsPerCondition = Math.floor(numTrials / numConditions);
    var remainingTrials = numTrials % numConditions;

    // Create array with equal representation of each condition
    var sequence = [];
    for (var i = 0; i < numConditions; i++) {
        for (var j = 0; j < trialsPerCondition; j++) {
            sequence.push(allConditions[i]);
        }
    }

    // Add remaining trials (if any) by cycling through conditions
    for (var k = 0; k < remainingTrials; k++) {
        sequence.push(allConditions[k]);
    }

    // Shuffle the sequence using Fisher-Yates algorithm
    for (var m = sequence.length - 1; m > 0; m--) {
        var randomIndex = Math.floor(Math.random() * (m + 1));
        var temp = sequence[m];
        sequence[m] = sequence[randomIndex];
        sequence[randomIndex] = temp;
    }
    return sequence;
}

// =================================================================================================
// DATA EXPORT AND UTILITY FUNCTIONS
// =================================================================================================
/**
 * Select random maps from map data
 */
function selectRandomMaps(mapData, nTrials) {
    if (!mapData || typeof mapData !== 'object') {
        console.error('Invalid map data provided:', mapData);
        return [];
    }

    var keys = Object.keys(mapData);

    if (keys.length === 0) {
        console.error('No keys found in map data');
        return [];
    }

    var selectedMaps = [];

    for (var i = 0; i < nTrials; i++) {
        var randomKey = keys[Math.floor(Math.random() * keys.length)];

        // Map data structure is: { "key": [{ designObject }] }
        // We need to get the first element of the array
        var mapArray = mapData[randomKey];

        if (Array.isArray(mapArray) && mapArray.length > 0) {
            var design = mapArray[0];
            selectedMaps.push(design); // Get the actual design object
        } else {
            console.error('Invalid map structure for key:', randomKey, mapArray);
        }
    }

    return selectedMaps;
}

/**
 * Convert experiment data to CSV format (matching jsPsych version)
 */
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

/**
 * Convert questionnaire data to array format (matching jsPsych version)
 */
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
            keys: ['ai_detection', 'Q0', 'q0', 'P0_Q0', 'p0_q0', '0'],
            question: 'Do you think the other player is a person or an AI agent?'
        },
        {
            keys: ['collaboration_rating', 'Q1', 'q1', 'P0_Q1', 'p0_q1', '1'],
            question: 'To what extent do you think the other player was a good collaborator?'
        },
        {
            keys: ['play_again', 'Q2', 'q2', 'P0_Q2', 'p0_q2', '2'],
            question: 'Will you play with them again?'
        },
        {
            keys: ['strategy', 'Q3', 'q3', 'P1_Q0', 'p1_q0', '3'],
            question: 'Did you use any strategy in the game? If yes, what was it?'
        },
        {
            keys: ['purpose', 'Q4', 'q4', 'P1_Q1', 'p1_q1', '4'],
            question: 'What do you think the purpose of this experiment is?'
        },
        {
            keys: ['comments', 'Q5', 'q5', 'P1_Q2', 'p1_q2', '5'],
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

/**
 * Function to download Excel file with multiple sheets (matching jsPsych version)
 */
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

/**
 * Download CSV file (fallback)
 */
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
        } else {
            // Fallback for older browsers
            window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
        }
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error downloading CSV file. Please try again.');
    }
}

/**
 * Send Excel file to Google Drive (matching jsPsych version)
 */
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

/**
 * Save data to Google Drive (matching jsPsych version)
 */
function saveDataToGoogleDrive() {
    try {
        // Get experiment data
        let experimentData = gameData.allTrialsData;

        // If no experiment data, create a placeholder
        if (!experimentData || experimentData.length === 0) {
            experimentData = [{
                trialIndex: 0,
                note: 'No experimental data collected - experiment may not have been completed',
                timestamp: new Date().toISOString()
            }];
        }

        // Convert questionnaire data to array format
        const questionnaireArray = convertQuestionnaireToArray(gameData.questionnaireData);

        // Create Excel file to send to Google Drive
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const excelFilename = `experiment_data_${timestamp}.xlsx`;

        sendExcelToGoogleDrive(experimentData, questionnaireArray, excelFilename);

    } catch (error) {
        console.error('Error in saveDataToGoogleDrive:', error);
        alert('Error saving data to Google Drive. Please try again.');
    }
}

/**
 * Export experiment data with questionnaire (matching jsPsych version)
 */
function exportExperimentData() {
    if (!window.gameData) {
        console.error('Game data not available');
        return;
    }

    var finalData = {
        experimentData: window.gameData.allTrialsData,
        questionnaireData: window.gameData.questionnaireData,
        metadata: {
            experiment: window.gameData.currentExperiment,
            timestamp: new Date().toISOString(),
            totalTrials: window.gameData.allTrialsData.length,
            successRate: calculateSuccessRate()
        }
    };

    try {
        // Export experiment data
        var csvContent = convertToCSV(finalData.experimentData);
        downloadCSV(csvContent, `nodegame_experiment_${window.gameData.currentExperiment}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);

        // Export questionnaire data if available
        if (window.gameData.questionnaireData) {
            var questionnaireArray = convertQuestionnaireToArray(window.gameData.questionnaireData);
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
 * Calculate success rate for stats
 */
function calculateSuccessRate() {
    if (!window.gameData || !window.gameData.allTrialsData || window.gameData.allTrialsData.length === 0) return 0;

    var successful = window.gameData.allTrialsData.filter(trial =>
        trial.collaborationSucceeded === true || trial.completed === true
    ).length;

    return Math.round((successful / window.gameData.allTrialsData.length) * 100);
}

/**
 * Redirect to Prolific completion page (matching jsPsych version)
 */
function redirectToProlific() {
    if (typeof NODEGAME_CONFIG !== 'undefined' && NODEGAME_CONFIG.enableProlificRedirect) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${NODEGAME_CONFIG.prolificCompletionCode}`;
    } else {
        console.log('Prolific redirect disabled for testing');
        // For testing, just proceed to completion stage
        if (typeof nextStage === 'function') {
            nextStage();
        }
    }
}

/**
 * Get random map for collaboration games after trial 12
 * @param {string} experimentType - Type of experiment (2P2G or 2P3G)
 * @param {number} trialIndex - Current trial index
 * @returns {Object} - Random map design
 */
function getRandomMapForCollaborationGame(experimentType, trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var mapData = getMapsForExperiment(experimentType);
        console.log(`Getting random map for ${experimentType} trial ${trialIndex + 1}, mapData:`, mapData);

        if (!mapData || Object.keys(mapData).length === 0) {
            console.error(`No map data available for ${experimentType}`);
            // Fallback to timeline map data if available
            if (timeline.mapData[experimentType] && timeline.mapData[experimentType].length > 0) {
                console.log(`Falling back to timeline map data for ${experimentType}`);
                return timeline.mapData[experimentType][0];
            }
            // If no fallback available, return null
            return null;
        }

        var randomMaps = selectRandomMaps(mapData, 1);
        console.log(`Selected random maps:`, randomMaps);

        if (!randomMaps || randomMaps.length === 0) {
            console.error(`No random maps selected for ${experimentType}`);
            return null;
        }

        console.log(`Using random map for ${experimentType} trial ${trialIndex + 1} (after trial ${NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial})`);
        console.log('Selected random map structure:', randomMaps[0]);
        return randomMaps[0];
    } else {
        // Use the pre-selected map from timeline
        if (!timeline.mapData[experimentType] || !timeline.mapData[experimentType][trialIndex]) {
            console.error(`No timeline map data available for ${experimentType} trial ${trialIndex}`);
            return null;
        }
        return timeline.mapData[experimentType][trialIndex];
    }
}




// =================================================================================================
// GLOBAL EXPORTS
// =================================================================================================

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Experiment selection helpers
        setExperiment1P1G,
        setExperiment1P2G,
        setExperiment2P2G,
        setExperiment2P3G,
        setExperimentAll,
        setExperimentCollaboration,
        setExperimentSinglePlayer,
        setCustomExperimentOrder,

        // Game logic helpers
        setupGridMatrixForTrial,
        transition,
        calculatetGirdDistance,
        isValidPosition,
        isGoalReached,
        whichGoalReached,
        detectPlayerGoal,

        // Map and distance condition helpers
        getMapsForExperiment,
        generateRandomizedDistanceSequence,
        generateRandomized1P2GDistanceSequence,
        selectRandomMaps,

        // Data export functions
        saveDataToGoogleDrive,
        exportExperimentData,
        sendExcelToGoogleDrive,
        downloadExcel,
        downloadCSV,
        convertToCSV,
        convertQuestionnaireToArray,
        calculateSuccessRate,
        redirectToProlific
    };
}

// Global functions for easy access
window.NodeGameHelpers = {
    // Experiment selection helpers
    setExperiment1P1G,
    setExperiment1P2G,
    setExperiment2P2G,
    setExperiment2P3G,
    setExperimentAll,
    setExperimentCollaboration,
    setExperimentSinglePlayer,
    setCustomExperimentOrder,

    // Game logic helpers
    setupGridMatrixForTrial,
    transition,
    calculatetGirdDistance,
    isValidPosition,
    isGoalReached,
    whichGoalReached,
    detectPlayerGoal,

    // Map and distance condition helpers
    getMapsForExperiment,
    generateRandomizedDistanceSequence,
    generateRandomized1P2GDistanceSequence,
    selectRandomMaps,

    // Data saving functions
    saveDataToGoogleDrive,
    exportExperimentData,
    sendExcelToGoogleDrive,
    downloadExcel,
    downloadCSV,
    convertToCSV,
    convertQuestionnaireToArray,
    calculateSuccessRate,
    redirectToProlific
};