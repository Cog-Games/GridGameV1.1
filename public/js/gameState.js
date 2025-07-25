/**
 * Game State Management Module
 *
 * Centralized management of game state, data structures, and state initialization.
 * Extracted from human-AI-version.js for better organization.
 */

// Game states and data storage
var gameData = {
    currentExperiment: null,
    currentTrial: 0,
    allTrialsData: [],
    currentTrialData: {},
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

// Timeline state
var timeline = {
    currentStage: 0,
    stages: [],
    experimentType: null,
    mapData: null,
    isMoving: false, // Prevent multiple moves per keypress
    keyListenerActive: false // Track if key listener is already active
};

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
        humanGoalReachedStep: -1,  // Track when human reaches goal (-1 means not reached yet)
        aiGoalReachedStep: -1,     // Track when AI reaches goal (-1 means not reached yet)
        // Initialize goal tracking variables for 2P experiments
        humanCurrentGoal: [],
        aiCurrentGoal: [],
        newGoalPresentedTime: null,
        newGoalPosition: null,
        newGoalConditionType: null,
        newGoalPresented: false,
        isNewGoalCloserToAI: null,
        collaborationSucceeded: undefined, // Will be set during trial
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
 * Create a fallback design when map data is not available
 * @param {string} experimentType - Type of experiment
 * @returns {Object|null} - Fallback design or null if not supported
 */
function createFallbackDesign(experimentType) {
    console.log('Creating fallback design for:', experimentType);

    // Basic 15x15 grid design
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

// Expose gameData and timeline globally for compatibility
window.gameData = gameData;
window.timeline = timeline;

// Export functions for module usage
window.GameState = {
    gameData: gameData,
    timeline: timeline,
    initializeTrialData: initializeTrialData,
    getRandomDistanceConditionFor2P3G: getRandomDistanceConditionFor2P3G,
    getRandomDistanceConditionFor1P2G: getRandomDistanceConditionFor1P2G,
    createFallbackDesign: createFallbackDesign
};