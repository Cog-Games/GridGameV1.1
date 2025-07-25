// Experiment configuration
const NODEGAME_CONFIG = {
    name: 'GridWorldExperiment',
    version: '1.0.0',
    treatments: ['1P1G', '1P2G', '2P2G', '2P3G'],

    // =================================================================================================
    // EXPERIMENT SELECTION
    // =================================================================================================

    // Current test configuration (2P3G only)
    // experimentOrder: ['2P3G'],

    // Alternative configurations (uncomment to use):
    // experimentOrder: ['1P1G'],           // Test 1P1G only
    // experimentOrder: ['1P2G'],           // Test 1P2G only
    experimentOrder: ['2P2G'],           // Test 2P2G only
    // experimentOrder: ['1P1G', '1P2G'],   // Test 1P1G and 1P2G
    // experimentOrder: ['2P2G', '2P3G'],   // Test 2P2G and 2P3G
    // experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'], // Test all experiments
    // experimentOrder: ['1P1G', '2P3G'],

    // =================================================================================================
    // TRIAL COUNTS
    // =================================================================================================
    numTrials: {
        '1P1G': 1,    // Number of 1P1G trials
        '1P2G': 4,    // Number of 1P2G trials, formal=12
        '2P2G': 4,    // Number of 2P2G trials, formal=12
        '2P3G': 1     // Number of 2P3G trials, formal=12
    },

    // =================================================================================================
    // SUCCESS THRESHOLD CONFIGURATION - FOR COLLABORATION GAMES (2P2G, 2P3G)
    // =================================================================================================
    successThreshold: {
        enabled: true,                    // Enable success threshold for collaboration games
        consecutiveSuccessesRequired: 2,  // Number of consecutive successes required
        minTrialsBeforeCheck: 2,         // Minimum trials before checking for success threshold
        maxTrials: 30,                    // Maximum trials regardless of success
        randomSamplingAfterTrial: 2      // After this trial, use random sampling for maps and conditions
    },

    // =================================================================================================
    // GAME SETTINGS
    // =================================================================================================
    agentDelay: 500,
    independentAgentDelay: 400, // Slower delay for independent AI movement after human reaches goal
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

// Human-Human specific configuration (only unique keys)
const NODEGAME_HUMAN_HUMAN_CONFIG = {
    // Multiplayer settings (unique to human-human)
    multiplayer: {
        maxWaitTime: 60000,      // 60 seconds to wait for partner
        roomTimeout: 300000,     // 5 minutes room timeout
        reconnectAttempts: 3,
        syncInterval: 100,
        moveTimeout: 10000       // 10 seconds for move timeout
    }
};


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
    }
};

