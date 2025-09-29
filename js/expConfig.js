// Experiment configuration
const NODEGAME_CONFIG = {
    name: 'GridWorldExperiment',
    version: '1.0.0',
    treatments: ['1P1G', '1P2G', '2P2G', '2P3G'],

    // =================================================================================================
    // MODE CONFIGURATION
    // =================================================================================================
    mode: 'local',
    modes: {
        online: {
            label: 'Online (Prolific)',
            description: 'Hosted deployment for remote Prolific participants.',
            enableProlificRedirect: true,
            participantId: {
                source: 'prolificPID',
                sourceKey: 'PROLIFIC_PID',
                manualEntry: {
                    enabled: false,
                    promptTitle: null,
                    placeholder: null,
                    validationRegex: null,
                    validationHint: null
                }
            },
            dataStorage: {
                type: 'remote',
                syncStrategy: 'server',
                localFallback: false,
                fileNameTemplate: 'session_${participantId}_${timestamp}.json'
            }
        },
        local: {
            label: 'Local (Lab)',
            description: 'Runs on a local machine with manual participant management.',
            enableProlificRedirect: false,
            participantId: {
                source: 'manual',
                sourceKey: 'participantId',
                manualEntry: {
                    enabled: true,
                    promptTitle: 'Enter Participant ID',
                    placeholder: 'P001',
                    validationRegex: '^[A-Za-z0-9_-]{3,32}$',
                    validationHint: 'Use 3-32 characters: letters, numbers, underscores, or hyphens.'
                }
            },
            dataStorage: {
                type: 'local',
                baseDirectory: 'data/local_sessions',
                autoCreateDirectory: true,
                fileNameTemplate: 'session_${participantId}_${timestamp}.json',
                persistRawData: true,
                persistAggregateData: true,
                includeParticipantIdInPayload: true
            }
        }
    },
    participantIdConfig: null,
    dataStorage: null,

    // =================================================================================================
    // PLAYER CONFIGURATION
    // =================================================================================================
    playerConfig: {
        player1: {
            type: 'human',
            color: 'red',
            description: 'Human player (you)'
        },
        player2: {
            type: 'ai', // Can be 'ai' or 'human'
            color: 'orange',
            description: 'AI agent or human partner'
        }
    },

    // =================================================================================================
    // EXPERIMENT SELECTION
    // =================================================================================================

    // Current test configuration (2P3G only)
    // experimentOrder: ['2P3G'],
    // experimentOrder: ['1P2G'],           // Test 1P2G only

    // Alternative configurations (uncomment to use):
    // experimentOrder: ['1P1G'],           // Test 1P1G only
    // experimentOrder: ['2P2G'],           // Test 2P2G only
    // experimentOrder: ['1P1G', '1P2G'],   // Test 1P1G and 1P2G
    // experimentOrder: ['2P2G', '2P3G'],   // Test 2P2G and 2P3G
    experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'], // Test all experiments
    // experimentOrder: ['1P2G', '2P3G'],

    // =================================================================================================
    // TRIAL COUNTS
    // =================================================================================================
    numTrials: {
        '1P1G': 3,    // Number of 1P1G trials, formal=3
        '1P2G': 12,    // Number of 1P2G trials, formal=12
        '2P2G': 8,    // Number of 2P2G trials, formal=8
        '2P3G': 12    // Number of 2P3G trials, formal=12
    },

    // =================================================================================================
    // SUCCESS THRESHOLD CONFIGURATION - FOR COLLABORATION GAMES (2P2G, 2P3G)
    // =================================================================================================
    successThreshold: {
        enabled: false,                    // Enable success threshold for collaboration games
        consecutiveSuccessesRequired: 5,  // Number of consecutive successes required, formal=5
        minTrialsBeforeCheck: 12,         // Minimum trials before checking for success threshold
        maxTrials: 24,                    // Maximum trials regardless of success
        randomSamplingAfterTrial: 12      // After this trial, use random sampling for maps and conditions
    },

    // =================================================================================================
    // RL AGENT CONFIGURATION
    // =================================================================================================
    rlAgent: {
        type: 'joint', // Default agent type: 'individual' or 'joint'
        agentDelay: 500,
        independentAgentDelay: 300, // Slower delay for independent AI movement after human reaches goal

        // AI Movement Mode Configuration
        movementMode: {
            enabled: false, // Enable independent AI movement mode
            decisionTimeRange: {
                firstMove: {
                    min: 950, // Minimum decision time in milliseconds before the first move
                    max: 1350  // Maximum decision time in milliseconds before the first move
                },
                interMove: {
                    min: 250, // Minimum decision time in milliseconds between subsequent moves
                    max: 350  // Maximum decision time in milliseconds between subsequent moves
                }
            },
            // When enabled, AI moves independently with random intervals
            // When disabled, AI moves only when human makes a move
        }
    },

    // =================================================================================================
    // GAME SETTINGS
    // =================================================================================================
    maxGameLength: 50, // Max steps per trial
    enableProlificRedirect: true, // Set to false for testing without redirect
    prolificCompletionCode: 'CPPNJJ39', // Prolific completion code

    // Timing configurations for easy manipulation
    timing: {
        trialToFeedbackDelay: 500,    // Delay from trial completion to feedback (ms)
        feedbackDisplayDuration: 2000, // How long to show feedback (ms)
        preTrialDisplayDuration: 2000, // How long to show pre-trial map (ms)
        fixationDuration: 1000,         // Fixation cross duration (ms)
        newGoalMessageDuration: 0,    // New goal message and freeze duration (ms)
        waitingForPartnerDuration: 9000, // How long to show "waiting for partner" simulation (ms)
        movementDelay: 100             // Delay to prevent rapid successive movements (ms)
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
        CLOSER_TO_PLAYER1: 'closer_to_player1',     // New goal is closer to player1 than first goal
        FARTHER_TO_PLAYER1: 'farther_to_player1',   // New goal is farther to player1 than first goal
        EQUAL_TO_PLAYER1: 'equal_to_player1',       // New goal is equal distance to player1 as first goal
        NO_NEW_GOAL: 'no_new_goal'                  // No new goal will be generated
    },

    // Distance condition sequence will be generated dynamically based on number of trials
    distanceConditionSequence: null, // Will be set by generateRandomized1P2GDistanceSequence()

    // Positioning constraints
    distanceConstraint: {
        minDistanceDiff: 2,              // Minimum distance difference for new goal
        maxDistanceDiff: 4,              // Maximum distance difference for new goal
    },

    // Goal generation constraints
    goalConstraints: {
        minDistanceFromHuman: 2,         // Minimum distance from human player
        maxDistanceFromHuman: 15,        // Maximum distance from human player
        minDistanceBetweenGoals: 2,      // Minimum distance between first and new goals
        avoidRectangleArea: false,       // Avoid rectangular area between goals
        blockPathCheck: true            // Check if goal blocks path
    }
};

// Configuration object for easy manipulation of 2P3G timing and positioning
var TWOP3G_CONFIG = {
    // Timing options
    minStepsBeforeNewGoal: 1,           // Minimum steps before new goal can appear
    newGoalMessageDuration: 5000,       // Duration of "New goal appeared!" message (ms)

    // Distance condition types for new goal generation
    distanceConditions: {
        CLOSER_TO_PLAYER2: 'closer_to_player2',           // New goal closer to player2, equal joint distance
        CLOSER_TO_PLAYER1: 'closer_to_player1',     // New goal closer to player1, equal joint distance
        EQUAL_TO_BOTH: 'equal_to_both',         // New goal equal distance to both player1 and player2
        NO_NEW_GOAL: 'no_new_goal'              // No new goal will be generated
    },

    // Distance condition sequence will be generated dynamically based on number of trials
    distanceConditionSequence: null, // Will be set by generateRandomizedDistanceSequence()

    // Positioning constraints
    distanceConstraint: {
        minDistanceDiff: 2,              // Minimum distance difference for new goal
        maxDistanceDiff: 4,              // Maximum distance difference for new goal
    },

    // Goal generation constraints
    goalConstraints: {
        minDistanceFromHuman: 2,         // Minimum distance from human player
        maxDistanceFromHuman: 15,        // Maximum distance from human player
        avoidRectangleArea: false,       // Avoid rectangular area between AI and current goal
        maintainDistanceSum: false,      // Maintain similar total distance sum
        blockPathCheck: true            // Check if goal blocks path
    }
};

/**
 * Apply experiment mode configuration
 * @param {string} modeKey - The mode to activate ('online' | 'local')
 */
function applyModeConfiguration(modeKey) {
    var modeSettings = NODEGAME_CONFIG.modes[modeKey];

    if (!modeSettings) {
        console.error('Invalid experiment mode:', modeKey);
        return;
    }

    NODEGAME_CONFIG.mode = modeKey;
    NODEGAME_CONFIG.enableProlificRedirect = !!modeSettings.enableProlificRedirect;

    NODEGAME_CONFIG.participantIdConfig = JSON.parse(JSON.stringify(modeSettings.participantId));
    NODEGAME_CONFIG.dataStorage = JSON.parse(JSON.stringify(modeSettings.dataStorage));
}

/**
 * Switch between experiment modes.
 * @param {string} modeKey - The mode to activate ('online' | 'local')
 */
function setExperimentMode(modeKey) {
    if (!NODEGAME_CONFIG.modes[modeKey]) {
        console.error('Attempted to set unknown experiment mode:', modeKey);
        return;
    }

    applyModeConfiguration(modeKey);
    console.log('Experiment mode set to:', modeKey);
}

/**
 * Get current experiment mode key.
 * @returns {string}
 */
function getExperimentMode() {
    return NODEGAME_CONFIG.mode;
}

/**
 * Get participant ID configuration for the active mode.
 * @returns {object}
 */
function getParticipantIdConfig() {
    return NODEGAME_CONFIG.participantIdConfig;
}

/**
 * Get data storage configuration for the active mode.
 * @returns {object}
 */
function getDataStorageConfig() {
    return NODEGAME_CONFIG.dataStorage;
}

// Initialize configuration based on default mode
applyModeConfiguration(NODEGAME_CONFIG.mode);

/**
 * Set player2 type configuration
 * @param {string} type - 'ai' or 'human'
 */
function setPlayer2Type(type) {
    if (type === 'ai' || type === 'human') {
        NODEGAME_CONFIG.playerConfig.player2.type = type;
        console.log(`Player2 type set to: ${type}`);
    } else {
        console.error('Invalid player2 type. Must be "ai" or "human"');
    }
}

/**
 * Set the RL agent type
 * @param {string} agentType - 'individual' or 'joint'
 */
function setRLAgentType(agentType) {
    if (['individual', 'joint'].includes(agentType)) {
        NODEGAME_CONFIG.rlAgent.type = agentType;
        console.log(`RL Agent type set to: ${agentType}`);
    } else {
        console.error(`Invalid RL agent type: ${agentType}. Must be 'individual' or 'joint'`);
    }
}

/**
 * Get current RL agent type
 * @returns {string} Current RL agent type
 */
function getRLAgentType() {
    return NODEGAME_CONFIG.rlAgent.type;
}

/**
 * Enable independent AI movement mode
 * @param {boolean} enabled - Whether to enable independent AI movement
 * @param {object} decisionTimeRange - Optional decision time range {min, max} in milliseconds
 */
function setAIMovementMode(enabled, decisionTimeRange = null) {
    NODEGAME_CONFIG.rlAgent.movementMode.enabled = enabled;

    if (decisionTimeRange) {
        var currentRange = NODEGAME_CONFIG.rlAgent.movementMode.decisionTimeRange;

        if (decisionTimeRange.firstMove) {
            if (typeof decisionTimeRange.firstMove.min === 'number') {
                currentRange.firstMove.min = decisionTimeRange.firstMove.min;
            }
            if (typeof decisionTimeRange.firstMove.max === 'number') {
                currentRange.firstMove.max = decisionTimeRange.firstMove.max;
            }
        }

        if (decisionTimeRange.interMove) {
            if (typeof decisionTimeRange.interMove.min === 'number') {
                currentRange.interMove.min = decisionTimeRange.interMove.min;
            }
            if (typeof decisionTimeRange.interMove.max === 'number') {
                currentRange.interMove.max = decisionTimeRange.interMove.max;
            }
        }

        if (typeof decisionTimeRange.min === 'number' && typeof decisionTimeRange.max === 'number') {
            currentRange.firstMove.min = decisionTimeRange.min;
            currentRange.firstMove.max = decisionTimeRange.max;
            currentRange.interMove.min = decisionTimeRange.min;
            currentRange.interMove.max = decisionTimeRange.max;
        }
    }

    console.log(`AI Movement Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    if (enabled) {
        var range = NODEGAME_CONFIG.rlAgent.movementMode.decisionTimeRange;
        console.log(`First move decision time range: ${range.firstMove.min}-${range.firstMove.max}ms`);
        console.log(`Inter-move decision time range: ${range.interMove.min}-${range.interMove.max}ms`);
    }
}

/**
 * Get current AI movement mode configuration
 * @returns {object} Current AI movement mode configuration
 */
function getAIMovementMode() {
    return {
        enabled: NODEGAME_CONFIG.rlAgent.movementMode.enabled,
        decisionTimeRange: {
            firstMove: { ...NODEGAME_CONFIG.rlAgent.movementMode.decisionTimeRange.firstMove },
            interMove: { ...NODEGAME_CONFIG.rlAgent.movementMode.decisionTimeRange.interMove }
        }
    };
}

/**
 * Check if independent AI movement is enabled
 * @returns {boolean} True if independent AI movement is enabled
 */
function isAIMovementModeEnabled() {
    return NODEGAME_CONFIG.rlAgent.movementMode.enabled;
}

// Export configuration for module usage
window.NodeGameConfig = {
    NODEGAME_CONFIG: NODEGAME_CONFIG,
    NODEGAME_HUMAN_HUMAN_CONFIG: NODEGAME_HUMAN_HUMAN_CONFIG,
    ONEP2G_CONFIG: ONEP2G_CONFIG,
    TWOP3G_CONFIG: TWOP3G_CONFIG,
    setPlayer2Type: setPlayer2Type,
    setRLAgentType: setRLAgentType,
    getRLAgentType: getRLAgentType,
    setAIMovementMode: setAIMovementMode,
    getAIMovementMode: getAIMovementMode,
    isAIMovementModeEnabled: isAIMovementModeEnabled,
    setExperimentMode: setExperimentMode,
    getExperimentMode: getExperimentMode,
    getParticipantIdConfig: getParticipantIdConfig,
    getDataStorageConfig: getDataStorageConfig
};
