/**
 * NodeGame Configuration and Setup
 */

// Import nodeGame if available
if (typeof node !== 'undefined') {
    var node = node;
} else if (typeof require !== 'undefined') {
    var node = require('nodegame-client');
}


var RL_AGENT_TYPE = 'joint'; // Options: 'individual', 'joint'

// Experiment configuration
const NODEGAME_CONFIG = {
    name: 'GridWorldExperiment',
    version: '1.0.0',
    treatments: ['1P1G', '1P2G', '2P2G', '2P3G'],

    // =================================================================================================
    // EXPERIMENT SELECTION - COMMENT/UNCOMMENT TO TEST INDIVIDUAL EXPERIMENTS
    // =================================================================================================

    // Current test configuration (2P3G only)
    // experimentOrder: ['2P3G'],

    // Alternative configurations (uncomment to use):
    // experimentOrder: ['1P1G'],           // Test 1P1G only
    // experimentOrder: ['1P2G'],           // Test 1P2G only
    // experimentOrder: ['2P2G'],           // Test 2P2G only
    // experimentOrder: ['1P1G', '1P2G'],   // Test 1P1G and 1P2G
    // experimentOrder: ['2P2G', '2P3G'],   // Test 2P2G and 2P3G
    experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'], // Test all experiments

    // =================================================================================================
    // TRIAL COUNTS - ADJUST FOR TESTING
    // =================================================================================================
    numTrials: {
        '1P1G': 3,    // Number of 1P1G trials
        '1P2G': 4,    // Number of 1P2G trials, formal=12
        '2P2G': 4,    // Number of 2P2G trials, formal=12
        '2P3G': 4     // Number of 2P3G trials, formal=12
    },

    // =================================================================================================
    // SUCCESS THRESHOLD CONFIGURATION - FOR COLLABORATION GAMES (2P2G, 2P3G)
    // =================================================================================================
    successThreshold: {
        enabled: true,                    // Enable success threshold for collaboration games
        consecutiveSuccessesRequired: 4,  // Number of consecutive successes required
        minTrialsBeforeCheck: 4,         // Minimum trials before checking for success threshold
        maxTrials: 30,                    // Maximum trials regardless of success
        randomSamplingAfterTrial: 4      // After this trial, use random sampling for maps and conditions
    },

    // =================================================================================================
    // GAME SETTINGS
    // =================================================================================================
    agentDelay: 500,
    independentAgentDelay: 500, // Slower delay for independent AI movement after human reaches goal
    maxGameLength: 50, // Max steps per trial
    enableProlificRedirect: true, // Set to false for testing without redirect
    prolificCompletionCode: 'C19EH5X9', // Prolific completion code

    // Timing configurations for easy manipulation
    timing: {
        trialToFeedbackDelay: 500,    // Delay from trial completion to feedback (ms)
        feedbackDisplayDuration: 2000, // How long to show feedback (ms)
        preTrialDisplayDuration: 2000, // How long to show pre-trial map (ms)
        fixationDuration: 1000,         // Fixation cross duration (ms)
        newGoalMessageDuration: 0    // New goal message and freeze duration (ms)
    }
};

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
            setupNodeGameStages();
            setupNodeGameHandlers();
            return true;
        }
    } catch (error) {
        console.warn('NodeGame not available, falling back to standalone mode:', error);
        return false;
    }
    return false;
}

/**
 * Setup NodeGame Stages
 */
function setupNodeGameStages() {
    if (!gameClient) return;

    // Define game sequence
    var gameSequence = [
        {
            id: 'consent',
            cb: consentStage
        },
        {
            id: 'instructions',
            cb: instructionsStage
        },
        {
            id: 'experiment',
            cb: experimentStage
        },
        {
            id: 'questionnaire',
            cb: questionnaireStage
        },
        {
            id: 'endgame',
            cb: endGameStage
        }
    ];

    gameClient.setStageSequence(gameSequence);
}

/**
 * Setup NodeGame Event Handlers
 */
function setupNodeGameHandlers() {
    if (!gameClient) return;

    // Handle player actions
    gameClient.on('PLAYER_MOVE', handlePlayerMove);

    // Handle AI actions
    gameClient.on('AI_MOVE', handleAIMove);

    // Handle game state updates
    gameClient.on('GAME_STATE_UPDATE', handleGameStateUpdate);

    // Handle trial completion
    gameClient.on('TRIAL_COMPLETE', handleTrialComplete);

    // Handle experiment completion
    gameClient.on('EXPERIMENT_COMPLETE', handleExperimentComplete);
}

// =================================================================================================
// NodeGame Stage Implementations
// =================================================================================================

/**
 * Consent Stage
 */
function consentStage() {
    var consentWidget = node.widgets.append('Consent', '#container', {
        title: 'Consent Form',
        consent: 'I agree to participate in this grid-world collaboration experiment.',
        validation: 'required'
    });

    consentWidget.on('complete', function() {
        node.done();
    });
}

/**
 * Instructions Stage
 */
function instructionsStage() {
    var instructionsWidget = node.widgets.append('Instructions', '#container', {
        title: 'Experiment Instructions',
        instructions: `
            <h3>Grid World Collaboration Task</h3>
            <p>You will participate in several types of tasks:</p>
            <ul>
                <li><strong>1P1G:</strong> Reach the single goal on the grid</li>
                <li><strong>1P2G:</strong> Choose which of two goals to reach</li>
                <li><strong>2P2G:</strong> Collaborate with an AI to reach the same goal</li>
                <li><strong>2P3G:</strong> Collaborate with an AI, with goals changing during play</li>
            </ul>
            <p>Use arrow keys to move your player (red circle).</p>
            <p>Points: Same goal = 5 points, Different goals = 1 point</p>
        `,
        buttonText: 'Start Experiment'
    });

    instructionsWidget.on('complete', function() {
        node.done();
    });
}

/**
 * Main Experiment Stage
 */
function experimentStage() {
    // Get treatment assignment
    var treatment = node.game.getTreatment() || '2P2G';
    gameData.currentExperiment = treatment;

    // Initialize experiment based on treatment
    switch (treatment) {
        case '1P1G':
            initializeExperiment1P1G();
            break;
        case '1P2G':
            initializeExperiment1P2G();
            break;
        case '2P2G':
            initializeExperiment2P2G();
            break;
        case '2P3G':
            initializeExperiment2P3G();
            break;
        default:
            console.error('Unknown treatment:', treatment);
            initializeExperiment2P2G(); // Default
    }
}

/**
 * Questionnaire Stage
 */
function questionnaireStage() {
    var questionnaireWidget = node.widgets.append('Questionnaire', '#container', {
        title: 'Post-Experiment Questionnaire',
        questions: [
            {
                id: 'ai_detection',
                text: 'Do you think the other player was a person or an AI agent?',
                type: 'radio',
                options: ['Person', 'AI Agent', 'Unsure']
            },
            {
                id: 'collaboration_rating',
                text: 'How good was the collaboration? (1-7 scale)',
                type: 'scale',
                min: 1,
                max: 7
            },
            {
                id: 'strategy',
                text: 'What strategy did you use?',
                type: 'textarea'
            },
            {
                id: 'purpose',
                text: 'What do you think was the purpose of this experiment?',
                type: 'textarea'
            },
            {
                id: 'comments',
                text: 'Any additional comments?',
                type: 'textarea'
            }
        ]
    });

    questionnaireWidget.on('complete', function(responses) {
        // Store questionnaire data
        if (gameClient) {
            gameClient.set('questionnaire', responses);
        }

        node.done();
    });
}

/**
 * End Game Stage
 */
function endGameStage() {
    var endWidget = node.widgets.append('EndScreen', '#container', {
        title: 'Experiment Complete',
        message: 'Thank you for participating!',
        showStats: true,
        totalTrials: gameData.allTrialsData.length,
        successRate: calculateSuccessRate()
    });

    // Prepare final data for export
    var finalData = {
        experimentData: gameData.allTrialsData,
        questionnaire: gameClient ? gameClient.get('questionnaire') : null,
        metadata: {
            experiment: gameData.currentExperiment,
            timestamp: new Date().toISOString(),
            totalTrials: gameData.allTrialsData.length
        }
    };

    // Send data to server if connected
    if (gameClient && gameClient.isConnected()) {
        gameClient.set('finalData', finalData);
    }

    // Also export locally
    exportExperimentData(finalData);

    node.done();
}

// =================================================================================================
// Experiment Implementations
// =================================================================================================

// =================================================================================================
// Legacy experiment functions (kept for compatibility)
// =================================================================================================

// These functions are no longer used in the timeline-based implementation
// but kept for reference and potential future use

// Legacy 1P2G functions removed for cleaner code

// Legacy 2P2G functions removed for cleaner code

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

// Configuration object for easy manipulation of 1P2G timing and positioning
var ONEP2G_CONFIG = {
    // Timing options
    minStepsBeforeNewGoal: 1,            // Minimum steps before new goal can appear

    // Distance condition types for new goal generation
    distanceConditions: {
        CLOSER_TO_HUMAN: 'closer_to_human',     // New goal is closer to human than first goal
        FARTHER_TO_HUMAN: 'farther_to_human',   // New goal is farther to human than first goal
        EQUAL_TO_HUMAN: 'equal_to_human',       // New goal is equal distance to human as first goal
        NO_NEW_GOAL: 'no_new_goal'              // No new goal will be generated
    },

    // Distance condition sequence will be generated dynamically based on number of trials
    distanceConditionSequence: null, // Will be set by generateRandomized1P2GDistanceSequence()

    // Positioning constraints
    distanceConstraint: {
        closerThreshold: 2,              // How much closer new goal should be to human
        fartherThreshold: 2,             // How much farther new goal should be to human
        equalTolerance: false,               // Tolerance for equal distance (in grid units)
        allowEqualDistance: false         // Allow equal distance if closer/farther not found
    },

    // Goal generation constraints
    goalConstraints: {
        minDistanceFromHuman: 1,         // Minimum distance from human player
        maxDistanceFromHuman: 12,        // Maximum distance from human player
        minDistanceBetweenGoals: 3,      // Minimum distance between first and new goals
        avoidRectangleArea: false,       // Avoid rectangular area between goals
        blockPathCheck: false            // Check if goal blocks path
    },

    // Debug options
    debug: {
        logGoalGeneration: false,         // Log new goal generation attempts
        showGoalHistory: false           // Show goal history in console
    }
};


// Configuration object for easy manipulation of 2P3G timing and positioning
var TWOP3G_CONFIG = {
    // Timing options
    minStepsBeforeNewGoal: 1,           // Minimum steps before new goal can appear
    newGoalMessageDuration: 5000,       // Duration of "New goal appeared!" message (ms)

    // Distance condition types for new goal generation
    distanceConditions: {
        CLOSER_TO_AI: 'closer_to_ai',           // New goal closer to AI, equal joint distance
        CLOSER_TO_HUMAN: 'closer_to_human',     // New goal closer to human, equal joint distance
        EQUAL_TO_BOTH: 'equal_to_both',         // New goal equal distance to both human and AI
        NO_NEW_GOAL: 'no_new_goal'              // No new goal will be generated
    },

    // Distance condition sequence will be generated dynamically based on number of trials
    distanceConditionSequence: null, // Will be set by generateRandomizedDistanceSequence()

    // Positioning constraints
    distanceConstraint: {
        closerThreshold: 2,              // How much closer new goal should be to AI
        allowEqualDistance: false,        // Allow equal distance if closer not found
        maxDistanceIncrease: 5           // Maximum distance increase allowed
    },

    // Goal generation constraints
    goalConstraints: {
        minDistanceFromHuman: 1,         // Minimum distance from human player
        maxDistanceFromHuman: 12,        // Maximum distance from human player
        avoidRectangleArea: false,       // Avoid rectangular area between AI and current goal
        maintainDistanceSum: true,      // Maintain similar total distance sum
        blockPathCheck: false            // Check if goal blocks path
    },

    // Debug options
    debug: {
        logGoalDetection: false,         // Log goal detection decisions
        logNewGoalGeneration: true,      // Log new goal generation attempts
        showGoalHistory: false           // Show goal history in console
    }
};


// Legacy 2P3G functions removed - replaced with improved versions above

// =================================================================================================
// Utility Functions (standalone mode)
// =================================================================================================

/**
 * Show wait message during AI turns (matching jsPsych)
 */
function showWaitMessage() {
    // Remove any existing wait message
    var existingMsg = document.getElementById('waitMessageBelowGrid');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Find the game canvas
    var canvas = document.querySelector('canvas');
    if (canvas) {
        // Redraw grid as usual
        nodeGameUpdateGameDisplay();

        // Insert wait message below the grid
        var waitMsg = document.createElement('div');
        waitMsg.id = 'waitMessageBelowGrid';
        waitMsg.style.cssText = `
            margin-top: 20px;
            text-align: center;
            font-size: 20px;
            color: #333;
            background: rgba(255,255,255,0.95);
            border: 1px solid #007bff;
            border-radius: 8px;
            padding: 12px 24px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        `;
        waitMsg.textContent = 'Please wait for the other player to reach the goal';

        // Try to insert after the canvas
        if (canvas.parentNode) {
            // Insert after canvas
            if (canvas.nextSibling) {
                canvas.parentNode.insertBefore(waitMsg, canvas.nextSibling);
            } else {
                canvas.parentNode.appendChild(waitMsg);
            }
        }
    }
}


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
 * Get AI action based on simple heuristic
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

// Old generateNewGoal function removed - using enhanced version with distance conditions below

// Timeline Stage Handlers

/**
 * Show consent stage
 */
function showConsentStage(stage) {
    var container = document.getElementById('container');
    var totalTrials = Object.values(NODEGAME_CONFIG.numTrials).reduce((sum, trials) => sum + trials, 0);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 30px;">Consent Form</h2>
                <div style="text-align: left; margin-bottom: 30px; line-height: 1.6;">
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
                        <strong>Compensation:</strong> You will receive $2 for your participation in this study, and an additional $0.50 bonus if you finish the task beyond a certain threshold.
                    </p>
                    <p style="font-size: 22px; line-height: 1.6; margin-bottom: 30px;">
                        By clicking "I Agree", you indicate that you are at least 18 years old and consent to participate in the study.
                    </p>
                </div>
                <div style="text-align: center; margin-bottom: 30px;">
                    <label style="font-size: 18px; cursor: pointer;">
                        <input type="checkbox" id="consentCheckbox" style="margin-right: 10px; transform: scale(1.2);" required>
                        I Agree
                    </label>
                </div>
                <p style="text-align: center; font-size: 22px; margin-bottom: 20px;">
                    Click "Next" to begin the study.
                </p>
                <div style="text-align: center;">
                    <button id="consentButton" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        font-size: 18px;
                        border-radius: 5px;
                        cursor: pointer;
                        opacity: 0.5;
                    " disabled>Next</button>
                </div>
            </div>
        </div>
    `;

    // Handle consent checkbox
    document.getElementById('consentCheckbox').addEventListener('change', function() {
        var button = document.getElementById('consentButton');
        if (this.checked) {
            button.disabled = false;
            button.style.opacity = '1';
        } else {
            button.disabled = true;
            button.style.opacity = '0.5';
        }
    });

    // Handle continue button
    document.getElementById('consentButton').addEventListener('click', function() {
        if (document.getElementById('consentCheckbox').checked) {
            nextStage();
        }
    });
}

/**
 * Show welcome stage (matching jsPsych)
 */
function showWelcomeStage(stage) {
    var container = document.getElementById('container');
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    var welcomeMessage = getWelcomeMessage(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                ${welcomeMessage}
            </div>
        </div>
    `;

    // Handle spacebar or any key to continue
    function handleKeyPress(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleKeyPress);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();
}

/**
 * Show instructions stage
 */
function showInstructionsStage(stage) {
    var container = document.getElementById('container');
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Update current experiment state
    gameData.currentExperiment = experimentType;
    gameData.currentExperimentIndex = experimentIndex;

    var instructions = getInstructionsForExperiment(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 20px;">Experiment ${experimentIndex + 1} of ${NODEGAME_CONFIG.experimentOrder.length}</h2>
                <h3 style="color: #666; margin-bottom: 30px;">${experimentType} Instructions</h3>
                <div style="text-align: left; margin-bottom: 30px; line-height: 1.6;">
                    ${instructions}
                </div>
                <div style="margin-bottom: 30px;">
                    <p style="font-size: 18px; font-weight: bold;">Controls:</p>
                    <p>You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
                    ${experimentType.includes('2P') ? '<p><span style="display: inline-block; width: 18px; height: 18px; background-color: orange; border-radius: 50%; vertical-align: middle; margin-right: 5px;"></span> = AI Player</p>' : ''}
                    <p><span style="display: inline-block; width: 18px; height: 18px; background-color: green; vertical-align: middle; margin-right: 5px;"></span> = Goals</p>
                </div>
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">Press the <span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace;">spacebar</span> to start.</p>
            </div>
        </div>
    `;

    // Handle spacebar to continue
    function handleSpacebar(event) {
        if (event.code === 'Space') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

/**
 * Show pre-trial stage (show map without spacebar prompt)
 */
function showPreTrialStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;
    var currentDesign = timeline.mapData[experimentType][trialIndex];

    // Setup grid matrix for display
    setupGridMatrixForTrial(currentDesign, experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment ${experimentIndex + 1}: ${experimentType}</h3>
                <h4 style="margin-bottom: 20px;">Trial ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Create and draw canvas
    var canvas = nodeGameCreateGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);
    nodeGameUpdateGameDisplay();

    // Auto-advance after configurable duration
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.preTrialDisplayDuration);
}

/**
 * Show fixation stage (configurable duration)
 */
function showFixationStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;
    var currentDesign = timeline.mapData[experimentType][trialIndex];

    // Create empty grid matrix for fixation (no objects)
    gameData.gridMatrix = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0));

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment ${experimentIndex + 1}: ${experimentType}</h3>
                <h4 style="margin-bottom: 20px;">Trial ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
            </div>
        </div>
    `;

    // Create and draw canvas with fixation
    var canvas = nodeGameCreateGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);
    nodeGameDrawFixationDisplay(canvas);

    // Auto-advance after configurable duration
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.fixationDuration);
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
 * Show post-trial feedback stage
 */
function showPostTrialStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;
    var lastTrialData = gameData.allTrialsData[gameData.allTrialsData.length - 1];

    var success = lastTrialData.completed;
    var message = success ? 'Goal reached!' : 'Time up!';
    var color = success ? 'green' : 'orange';

    // For collaboration games, show dynamic trial count
    var trialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        trialCountDisplay = `Trial ${trialIndex + 1} (${gameData.successThreshold.totalTrialsCompleted} total)`;
    } else {
        trialCountDisplay = `Trial ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}`;
    }

    // Collaboration feedback for 2P2G and 2P3G experiments with visual feedback
    var collaborationFeedback = '';
    var visualFeedback = '';

    if (experimentType.includes('2P') && lastTrialData.collaborationSucceeded !== undefined) {
        if (lastTrialData.collaborationSucceeded) {
            collaborationFeedback = '<p style="font-size:32px;text-align: center; color: #28a745; font-weight: bold; margin-bottom: 20px;">Collaboration succeeded!</p>';
            visualFeedback = `
                <div style="display: flex; justify-content: center; margin: 30px 0;">
                    <div style="
                        width: 120px;
                        height: 120px;
                        background-color: #28a745;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    ">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                        </svg>
                    </div>
                </div>
            `;
        } else {
            collaborationFeedback = '<p style="font-size:32px;text-align: center; color: #dc3545; font-weight: bold; margin-bottom: 20px;">Collaboration failed!</p>';
            visualFeedback = `
                <div style="display: flex; justify-content: center; margin: 30px 0;">
                    <div style="
                        width: 120px;
                        height: 120px;
                        background-color: #dc3545;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    ">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="white"/>
                        </svg>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; width: 100%;">
                <h3 style="margin-bottom: 10px;">Experiment ${experimentIndex + 1}: ${experimentType}</h3>
                <h4 style="margin-bottom: 20px;">${trialCountDisplay} Results</h4>
                <div id="gameCanvas" style="margin: 0 auto 20px auto; position: relative; display: flex; justify-content: center;"></div>
                <h3 style="color: ${color}; margin-bottom: 20px;">${message}</h3>
            </div>
        </div>
    `;

    // Create and draw canvas with final state
    var canvas = nodeGameCreateGameCanvas();
    var canvasContainer = document.getElementById('gameCanvas');
    canvasContainer.appendChild(canvas);
    nodeGameUpdateGameDisplay();

    // Add visual feedback overlay on top of the canvas if collaboration feedback exists
    if (visualFeedback && experimentType.includes('2P') && lastTrialData.collaborationSucceeded !== undefined) {
        // Create overlay div positioned absolutely over the canvas
        var overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="
                text-align: center;
                background: rgba(255, 255, 255, 0.95);
                border: 3px solid ${lastTrialData.collaborationSucceeded ? '#28a745' : '#dc3545'};
                border-radius: 15px;
                padding: 30px 40px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(5px);
            ">
                <div style="font-size: 32px; font-weight: bold; margin-bottom: 20px; color: ${lastTrialData.collaborationSucceeded ? '#28a745' : '#dc3545'};">
                    ${lastTrialData.collaborationSucceeded ? 'Collaboration succeeded!' : 'Collaboration failed!'}
                </div>
                ${visualFeedback}
            </div>
        `;
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            pointer-events: none;
            width: auto;
            height: auto;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        canvasContainer.appendChild(overlay);
    }

    // Auto-advance after configurable duration
    setTimeout(() => {
        // Check if we should end the experiment early due to success threshold
        if (shouldEndExperimentDueToSuccessThreshold()) {
            // Skip to the end of this experiment by finding the next experiment or completion stage
            skipToNextExperimentOrCompletion();
        } else {
            // For collaboration games, check if we should continue to next trial
            if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
                if (shouldContinueToNextTrial(experimentType, trialIndex)) {
                    // Add the next trial stages dynamically
                    addNextTrialStages(experimentType, experimentIndex, trialIndex + 1);
                    nextStage();
                } else {
                    // End this experiment and move to next
                    skipToNextExperimentOrCompletion();
                }
            } else {
                nextStage();
            }
        }
    }, NODEGAME_CONFIG.timing.feedbackDisplayDuration);
}

/**
 * Show post-questionnaire stage (matching testExpWithAI.js)
 */
function showQuestionnaireStage(stage) {
    var container = document.getElementById('container');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; width: 100%;">
                <h2 style="color: #333; margin-bottom: 30px; text-align: center;">Post-Experiment Questionnaire</h2>

                <form id="questionnaireForm">
                    <div id="questionnairePage1">
                        <h3 style="color: #666; margin-bottom: 20px;">Page 1 of 2</h3>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                Do you think the other player is a person or an AI?
                            </label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="ai_detection" value="Definitely a person" required style="margin-right: 10px;">
                                    Definitely a person
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="ai_detection" value="Probably a person" required style="margin-right: 10px;">
                                    Probably a person
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="ai_detection" value="Not sure" required style="margin-right: 10px;">
                                    Not sure
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="ai_detection" value="Probably an AI" required style="margin-right: 10px;">
                                    Probably an AI
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="ai_detection" value="Definitely an AI" required style="margin-right: 10px;">
                                    Definitely an AI
                                </label>
                            </div>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                To what extent do you think the other player was a good collaborator?
                            </label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="collaboration_rating" value="Very poor collaborator" required style="margin-right: 10px;">
                                    Very poor collaborator
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="collaboration_rating" value="Poor collaborator" required style="margin-right: 10px;">
                                    Poor collaborator
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="collaboration_rating" value="Neutral" required style="margin-right: 10px;">
                                    Neutral
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="collaboration_rating" value="Good collaborator" required style="margin-right: 10px;">
                                    Good collaborator
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="collaboration_rating" value="Very good collaborator" required style="margin-right: 10px;">
                                    Very good collaborator
                                </label>
                            </div>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                Will you play with the other player again?
                            </label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="play_again" value="Definitely not play again" required style="margin-right: 10px;">
                                    Definitely not
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="play_again" value="Probably not play again" required style="margin-right: 10px;">
                                    Probably not play again
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="play_again" value="Not sure" required style="margin-right: 10px;">
                                    Not sure
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="play_again" value="Probably play again" required style="margin-right: 10px;">
                                    Probably play again
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="radio" name="play_again" value="Definitely play again" required style="margin-right: 10px;">
                                    Definitely play again
                                </label>
                            </div>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <button type="button" id="nextPageBtn" style="
                                background: #007bff;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Next Page</button>
                        </div>
                    </div>

                    <div id="questionnairePage2" style="display: none;">
                        <h3 style="color: #666; margin-bottom: 20px;">Page 2 of 2</h3>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                Did you use any strategy in the game? If yes, what was it?
                            </label>
                            <textarea name="strategy" rows="4" style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-family: inherit;
                                resize: vertical;
                            " placeholder="Please describe your strategy..."></textarea>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                What do you think the purpose of this experiment is?
                            </label>
                            <textarea name="purpose" rows="4" style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-family: inherit;
                                resize: vertical;
                            " placeholder="Please share your thoughts..."></textarea>
                        </div>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                Do you have any questions or comments?
                            </label>
                            <textarea name="comments" rows="4" style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-family: inherit;
                                resize: vertical;
                            " placeholder="Any additional feedback..."></textarea>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <button type="button" id="prevPageBtn" style="
                                background: #6c757d;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                                margin-right: 10px;
                            ">Previous Page</button>
                            <button type="submit" id="submitBtn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Submit</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Handle page navigation
    document.getElementById('nextPageBtn').addEventListener('click', function() {
        // Validate required fields on page 1
        var requiredFields = ['ai_detection', 'collaboration_rating', 'play_again'];
        var isValid = true;

        requiredFields.forEach(function(field) {
            var element = document.querySelector('input[name="' + field + '"]:checked');
            if (!element) {
                isValid = false;
                // Highlight missing field
                var fieldGroup = document.querySelector('input[name="' + field + '"]').closest('div').parentElement;
                fieldGroup.style.border = '2px solid #dc3545';
                fieldGroup.style.borderRadius = '5px';
                fieldGroup.style.padding = '10px';
            }
        });

        if (isValid) {
            document.getElementById('questionnairePage1').style.display = 'none';
            document.getElementById('questionnairePage2').style.display = 'block';
        } else {
            alert('Please answer all required questions before proceeding.');
        }
    });

    document.getElementById('prevPageBtn').addEventListener('click', function() {
        document.getElementById('questionnairePage2').style.display = 'none';
        document.getElementById('questionnairePage1').style.display = 'block';
    });

    // Handle form submission
    document.getElementById('questionnaireForm').addEventListener('submit', function(e) {
        e.preventDefault();

        var formData = new FormData(this);
        var questionnaireData = {};

        for (var [key, value] of formData.entries()) {
            questionnaireData[key] = value;
        }

        // Store questionnaire data
        gameData.questionnaireData = questionnaireData;

        // Proceed to next stage
        nextStage();
    });
}

/**
 * Show end experiment info stage (matching testExpWithAI.js)
 */
function showEndExperimentInfoStage(stage) {
    var container = document.getElementById('container');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px;">
                <p style="font-size: 30px; margin-bottom: 20px;">You have finished all the tasks!</p>
                <p style="font-size: 18px; margin-bottom: 20px;">Thank you for completing the experiment!</p>
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">Your data is being saved to our secure server.</p>
                <div style="margin: 20px 0;">
                    <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 10px; color: #666;">Saving data...</p>
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    // Save data to Google Drive (this will handle the redirect to Prolific)
    saveDataToGoogleDrive();
}

/**
 * Show Prolific redirect stage (matching jsPsych version)
 */
function showProlificRedirectStage(stage) {
    var container = document.getElementById('container');

    if (NODEGAME_CONFIG.enableProlificRedirect) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center; max-width: 600px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Redirecting to Prolific...</h2>
                    <p style="font-size: 18px; margin-bottom: 20px;">Thank you for completing the experiment!</p>
                    <p style="font-size: 16px; color: #666; margin-bottom: 30px;">You will be redirected to Prolific to complete your submission.</p>
                    <div style="margin: 20px 0;">
                        <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <p style="margin-top: 10px; color: #666;">Redirecting...</p>
                    </div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Auto-redirect to Prolific after 3 seconds
        setTimeout(() => {
            redirectToProlific();
        }, 3000);
    } else {
        // For testing, show a message and proceed
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center; max-width: 600px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Prolific Redirect (Testing Mode)</h2>
                    <p style="font-size: 18px; margin-bottom: 20px;">Thank you for completing the experiment!</p>
                    <p style="font-size: 16px; color: #666; margin-bottom: 30px;">In production, you would be redirected to Prolific.</p>
                    <p style="font-size: 16px; color: #28a745; margin-bottom: 30px;">✅ Prolific redirect is disabled for testing.</p>
                    <button id="continueBtn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Continue to Completion</button>
                </div>
            </div>
        `;

        // Handle continue button
        document.getElementById('continueBtn').addEventListener('click', function() {
            redirectToProlific();
        });
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
 * Redirect to Prolific completion page (matching jsPsych version)
 */
function redirectToProlific() {
    if (NODEGAME_CONFIG.enableProlificRedirect) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${NODEGAME_CONFIG.prolificCompletionCode}`;
    } else {
        // For testing, just proceed to completion stage
        nextStage();
    }
}

/**
 * Show completion stage
 */
function showCompletionStage(stage) {
    var container = document.getElementById('container');
    var successRate = calculateSuccessRate();

    // Calculate results by experiment type
    var resultsByExperiment = {};
    NODEGAME_CONFIG.experimentOrder.forEach(expType => {
        var expTrials = gameData.allTrialsData.filter(trial => trial.experimentType === expType);
        var expSuccessful = expTrials.filter(trial => trial.completed || trial.collaborationSucceeded).length;
        resultsByExperiment[expType] = {
            completed: expTrials.length,
            successful: expSuccessful,
            successRate: expTrials.length > 0 ? Math.round((expSuccessful / expTrials.length) * 100) : 0
        };
    });

    var experimentResultsHTML = NODEGAME_CONFIG.experimentOrder.map(expType => {
        var result = resultsByExperiment[expType];
        return `
            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff;">
                <strong>${expType}:</strong> ${result.successful}/${result.completed} trials successful (${result.successRate}%)
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 700px; text-align: center;">
                <h2 style="color: green; margin-bottom: 30px;">🎉 All Experiments Complete!</h2>
                <div style="margin-bottom: 30px;">
                    <p style="font-size: 18px; margin-bottom: 20px;"><strong>Total Trials Completed:</strong> ${gameData.allTrialsData.length}</p>
                    <p style="font-size: 18px; margin-bottom: 20px;"><strong>Overall Success Rate:</strong> ${successRate}%</p>

                    <h3 style="margin-bottom: 15px; color: #333;">Results by Experiment:</h3>
                    <div style="text-align: left;">
                        ${experimentResultsHTML}
                    </div>
                </div>
                <div>
                    <button onclick="exportExperimentData()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 10px;
                    ">📥 Download Data</button>
                    <button onclick="location.reload()" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 10px;
                    ">🔄 Run Another Session</button>
                </div>
                ${gameData.questionnaireData ? '<p style="color: #28a745; margin-top: 20px;">✅ Questionnaire data collected and included in export</p>' : ''}
            </div>
        </div>
    `;
}

// =================================================================================================
// Helper Functions
// =================================================================================================

/**
 * Get welcome message for experiment type (matching jsPsych)
 */
function getWelcomeMessage(experimentType) {
    switch(experimentType) {
        case '1P1G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-1-Goal Task. Press space bar to begin.</p>';
        case '1P2G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-2-Goals Task. Press any key to begin.</p>';
        case '2P2G':
            return '<p style="font-size:30px;">Welcome to the 2-Player-2-Goals Task. Press any key to begin.</p>';
        case '2P3G':
            return `
                <p style="font-size:24px; color: #333; margin-top: 30px;">
                    The game rules have been updated!
                </p>
                <ul style="font-size:22px; text-align:left; max-width: 700px; margin: 0 auto 20px auto;">
                    <li style="margin-bottom: 10px;">- If you and the other player both reach the same destination, you will both get <strong>5 points</strong>.</li>
                    <li style="margin-bottom: 10px;">- If you and the other player reach different destinations, you will both get <strong>1 point</strong>.</li>
                    <li style="margin-bottom: 10px;">- If you take too many steps or too much time, you get <strong>0 points</strong>!</li>
                </ul>
                <p style="font-size:22px; color: #333; margin-top: 20px;">
                    Notice: In this game, a new restaurant will open during the game. This restaurant is the same as the previous two restaurants, and you can choose any of the three!
                </p>
                <p style="font-size:24px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
            `;
        default:
            return '<p style="font-size:30px;">Welcome to the task. Press space bar to begin.</p>';
    }
}

/**
 * Get instructions for experiment type (simplified to match jsPsych)
 */
function getInstructionsForExperiment(experimentType) {
    // jsPsych version didn't have detailed instructions - just welcome screens and basic controls
    return `
        <h3>Game Instructions</h3>
        <p>Navigate the grid to reach the goal(s).</p>
        ${experimentType.includes('2P') ? '<p>You will be playing with another player.</p>' : ''}
        <p>Use the arrow keys to move your player around the grid.</p>
    `;
}

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
}

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
 */
function calculateSuccessRate() {
    if (gameData.allTrialsData.length === 0) return 0;

    var successful = gameData.allTrialsData.filter(trial =>
        trial.collaborationSucceeded === true || trial.completed === true
    ).length;

    return Math.round((successful / gameData.allTrialsData.length) * 100);
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
 * Create timeline stages for all experiments
 */
function createTimelineStages() {
    timeline.stages = [];
    timeline.mapData = {};

    // =================================================================================================
    // EXPERIMENT SETUP - LOG CURRENT CONFIGURATION
    // =================================================================================================
    console.log('=== EXPERIMENT CONFIGURATION ===');
    console.log('Experiments to run:', NODEGAME_CONFIG.experimentOrder);
    console.log('Total experiments:', NODEGAME_CONFIG.experimentOrder.length);

    var totalTrials = 0;
    NODEGAME_CONFIG.experimentOrder.forEach(expType => {
        var trials = NODEGAME_CONFIG.numTrials[expType];
        totalTrials += trials;
        console.log(`- ${expType}: ${trials} trials`);
    });
    console.log('Total trials:', totalTrials);
    console.log('================================');

    // Add consent stage (only once at the beginning)
    // timeline.stages.push({
    //     type: 'consent',
    //     handler: showConsentStage
    // });

    // Add stages for each experiment in order
    for (var expIndex = 0; expIndex < NODEGAME_CONFIG.experimentOrder.length; expIndex++) {
        var experimentType = NODEGAME_CONFIG.experimentOrder[expIndex];
        var numTrials = NODEGAME_CONFIG.numTrials[experimentType];

        console.log(`Setting up experiment ${expIndex + 1}/${NODEGAME_CONFIG.experimentOrder.length}: ${experimentType} (${numTrials} trials)`);

        // Select maps for this experiment
        var experimentMaps = getMapsForExperiment(experimentType);
        var selectedMaps = selectRandomMaps(experimentMaps, numTrials);
        timeline.mapData[experimentType] = selectedMaps;

        // Generate randomized distance condition sequence for 2P3G experiments
        if (experimentType === '2P3G') {
            TWOP3G_CONFIG.distanceConditionSequence = generateRandomizedDistanceSequence(numTrials);
        }

        // Generate randomized distance condition sequence for 1P2G experiments
        if (experimentType === '1P2G') {
            ONEP2G_CONFIG.distanceConditionSequence = generateRandomized1P2GDistanceSequence(numTrials);
        }

        // Add welcome screen for this experiment (uncomment if needed)
        timeline.stages.push({
            type: 'welcome',
            experimentType: experimentType,
            experimentIndex: expIndex,
            handler: showWelcomeStage
        });

        // Add instructions stage for this experiment (uncomment if needed)
        // timeline.stages.push({
        //     type: 'instructions',
        //     experimentType: experimentType,
        //     experimentIndex: expIndex,
        //     handler: showInstructionsStage
        // });

        // For collaboration games, we'll create stages dynamically based on success threshold
        if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
            // Add a single trial stage that will be repeated dynamically
            addCollaborationExperimentStages(experimentType, expIndex, 0);
        } else {
            // Add trial stages for this experiment (fixed number)
            for (var i = 0; i < numTrials; i++) {
                addTrialStages(experimentType, expIndex, i);
            }
        }
    }

    // Add post-questionnaire stage (only once at the end, before completion)
    timeline.stages.push({
        type: 'questionnaire',
        handler: showQuestionnaireStage
    });

    // Add end experiment info stage (matching jsPsych version)
    timeline.stages.push({
        type: 'end-info',
        handler: showEndExperimentInfoStage
    });

    // Add Prolific redirect stage (matching jsPsych version)
    timeline.stages.push({
        type: 'prolific-redirect',
        handler: showProlificRedirectStage
    });

    // Add completion stage (only once at the end)
    timeline.stages.push({
        type: 'complete',
        handler: showCompletionStage
    });

    console.log(`Timeline created with ${timeline.stages.length} total stages`);

}

/**
 * Add trial stages for a specific trial
 * @param {string} experimentType - Type of experiment
 * @param {number} experimentIndex - Index of experiment
 * @param {number} trialIndex - Index of trial
 */
function addTrialStages(experimentType, experimentIndex, trialIndex) {
    // Fixation screen (500ms, matching jsPsych) - first thing shown for each trial
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

    // Post-trial feedback
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
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
function addNextTrialStages(experimentType, experimentIndex, trialIndex) {
    // Find the current post-trial stage index
    var currentStageIndex = timeline.currentStage;

    // Insert the next trial stages after the current post-trial stage
    var stagesToInsert = [
        {
            type: 'fixation',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showFixationStage
        },
        {
            type: 'trial',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: runTrialStage
        },
        {
            type: 'post-trial',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showPostTrialStage
        }
    ];

    // Insert stages after current stage
    timeline.stages.splice(currentStageIndex + 1, 0, ...stagesToInsert);

    console.log(`Added next trial stages for ${experimentType} trial ${trialIndex + 1}`);
}

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
    if (!action || (action[0] === 0 && action[1] === 0)) {
        return null; // No movement, can't determine goal
    }

    var nextPos = transition(playerPos, action);
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

    // console.log('Map data for', experimentType, ':', mapData);
    // console.log('Map data keys:', mapData ? Object.keys(mapData) : 'undefined');

    return mapData;
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
 */
function setExperiment1P1G() {
    NODEGAME_CONFIG.experimentOrder = ['1P1G'];
    console.log('Experiment set to 1P1G only');
}

/**
 * Set experiment to 1P2G only
 */
function setExperiment1P2G() {
    NODEGAME_CONFIG.experimentOrder = ['1P2G'];
    console.log('Experiment set to 1P2G only');
}

/**
 * Set experiment to 2P2G only
 */
function setExperiment2P2G() {
    NODEGAME_CONFIG.experimentOrder = ['2P2G'];
    console.log('Experiment set to 2P2G only');
}

/**
 * Set experiment to 2P3G only
 */
function setExperiment2P3G() {
    NODEGAME_CONFIG.experimentOrder = ['2P3G'];
    console.log('Experiment set to 2P3G only');
}

/**
 * Set experiment to all experiments
 */
function setExperimentAll() {
    NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G', '2P2G', '2P3G'];
    console.log('Experiment set to all experiments');
}

/**
 * Set experiment to collaboration games only
 */
function setExperimentCollaboration() {
    NODEGAME_CONFIG.experimentOrder = ['2P2G', '2P3G'];
    console.log('Experiment set to collaboration games only');
}

/**
 * Set experiment to single player games only
 */
function setExperimentSinglePlayer() {
    NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G'];
    console.log('Experiment set to single player games only');
}

/**
 * Set custom experiment order
 * @param {Array} experimentOrder - Array of experiment types
 */
function setCustomExperimentOrder(experimentOrder) {
    NODEGAME_CONFIG.experimentOrder = experimentOrder;
    console.log('Experiment set to custom order:', experimentOrder);
}

// RL Agent convenience functions are now available through window.RLAgent

// =================================================================================================
// DATA EXPORT HELPER FUNCTIONS
// =================================================================================================

/**
 * Download Excel file
 */
function downloadExcel() {
    // Implementation for Excel download
    console.log('Excel download function called');
}

/**
 * Download CSV file
 */
function downloadCSV() {
    // Implementation for CSV download
    console.log('CSV download function called');
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

// RL Agent implementation moved to rlAgent.js
