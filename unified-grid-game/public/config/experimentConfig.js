/**
 * Unified Experiment Configuration
 *
 * CHANGE THE SETTINGS BELOW TO SWITCH BETWEEN EXPERIMENT MODES
 */

// =================================================================================================
// MAIN CONFIGURATION - EDIT HERE TO CHANGE EXPERIMENT MODE
// =================================================================================================

window.EXPERIMENT_CONFIG = {

    // =================================================================================================
    // EXPERIMENT MODE SELECTION
    // =================================================================================================

    // CHANGE THIS TO SWITCH BETWEEN MODES:
    // - 'human-ai' for Human-AI experiments (with RL agents)
    // - 'human-human' for Human-Human multiplayer experiments
    experimentMode: 'human-human',  // <-- CHANGE THIS LINE

    // RL AGENT TYPE (only used in 'human-ai' mode):
    // - 'individual' for Individual RL Agent
    // - 'joint' for Joint RL Agent (considers both players)
    rlAgentType: 'joint',  // <-- CHANGE THIS LINE

    // =================================================================================================
    // EXPERIMENT ORDER AND TRIALS
    // =================================================================================================

    // Which experimental conditions to run (in order):
    // experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'], // Full experiment sequence
    // experimentOrder: ['2P2G', '2P3G'], // Only collaboration conditions
    experimentOrder: ['2P3G'], // Single condition for testing

    // Number of trials per condition:
    numTrials: {
        '1P1G': 3,    // Single player, single goal (practice)
        '1P2G': 4,    // Single player, dual goals (practice)
        '2P2G': 4,    // Two players, two goals (collaboration) - formal: 12
        '2P3G': 4     // Two players, three goals (dynamic) - formal: 12
    },

    // =================================================================================================
    // SUCCESS THRESHOLD SETTINGS
    // =================================================================================================

    // Early termination based on consecutive successes (for 2P2G and 2P3G):
    successThreshold: {
        enabled: true,                    // Enable early termination
        consecutiveSuccessesRequired: 4,  // End after N consecutive successes
        minTrialsBeforeCheck: 4,         // Don't check until after N trials
        maxTrials: 30,                    // Maximum trials regardless
        randomSamplingAfterTrial: 4      // Use random sampling after trial N
    },

    // =================================================================================================
    // TIMING SETTINGS
    // =================================================================================================

    timing: {
        trialToFeedbackDelay: 500,        // Delay before showing feedback (ms)
        feedbackDisplayDuration: 2000,    // How long to show feedback (ms)
        preTrialDisplayDuration: 2000,    // Pre-trial display time (ms)
        fixationDuration: 1000,           // Fixation cross duration (ms)
        newGoalMessageDuration: 0,        // New goal message duration (ms)
        agentDelay: 500,                  // AI action delay (ms)
        independentAgentDelay: 500        // Independent AI delay (ms)
    },

    // =================================================================================================
    // GAME SETTINGS
    // =================================================================================================

    game: {
        maxGameLength: 50,                // Maximum steps per trial
        gridSize: 15,                     // Grid dimensions
        enableProlificRedirect: true,     // Redirect to Prolific on completion
        prolificCompletionCode: 'C19EH5X9' // Prolific completion code
    },

    // =================================================================================================
    // MULTIPLAYER SETTINGS (for human-human mode)
    // =================================================================================================

    multiplayer: {
        maxWaitTime: 60000,               // Max wait time for partner (ms)
        syncTimeout: 10000,               // Sync timeout (ms)
        reconnectAttempts: 3,             // Number of reconnect attempts
        movementMode: 'simultaneous',     // 'simultaneous' or 'turn-based'
        enableSinglePlayerTesting: true   // Allow testing without partner
    }
};

// =================================================================================================
// PRESET CONFIGURATIONS
// =================================================================================================

// Quick configuration presets - uncomment one to use:

// PRESET 1: Human-AI with Individual RL Agent
// window.EXPERIMENT_CONFIG.experimentMode = 'human-ai';
// window.EXPERIMENT_CONFIG.rlAgentType = 'individual';

// PRESET 2: Human-AI with Joint RL Agent (default)
// window.EXPERIMENT_CONFIG.experimentMode = 'human-ai';
// window.EXPERIMENT_CONFIG.rlAgentType = 'joint';

// PRESET 3: Human-Human Multiplayer
// window.EXPERIMENT_CONFIG.experimentMode = 'human-human';

// PRESET 4: Testing - Single Condition
// window.EXPERIMENT_CONFIG.experimentOrder = ['2P3G'];
// window.EXPERIMENT_CONFIG.numTrials = { '2P3G': 2 };

// PRESET 5: Practice Only
// window.EXPERIMENT_CONFIG.experimentOrder = ['1P1G', '1P2G'];
// window.EXPERIMENT_CONFIG.numTrials = { '1P1G': 2, '1P2G': 2 };

// =================================================================================================
// VALIDATION AND LOGGING
// =================================================================================================

// Validate configuration on load
(function validateConfig() {
    const config = window.EXPERIMENT_CONFIG;

    console.log('=================================================================================================');
    console.log('UNIFIED EXPERIMENT CONFIGURATION LOADED');
    console.log('=================================================================================================');
    console.log(`Experiment Mode: ${config.experimentMode.toUpperCase()}`);

    if (config.experimentMode === 'human-ai') {
        console.log(`RL Agent Type: ${config.rlAgentType.toUpperCase()}`);
    }

    console.log(`Experiment Order: ${config.experimentOrder.join(' → ')}`);
    console.log(`Trial Counts:`, config.numTrials);
    console.log(`Success Threshold: ${config.successThreshold.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('=================================================================================================');

    // Validation
    const validModes = ['human-ai', 'human-human'];
    if (!validModes.includes(config.experimentMode)) {
        console.error(`Invalid experiment mode: ${config.experimentMode}. Must be one of: ${validModes.join(', ')}`);
    }

    const validAgentTypes = ['individual', 'joint'];
    if (config.experimentMode === 'human-ai' && !validAgentTypes.includes(config.rlAgentType)) {
        console.error(`Invalid RL agent type: ${config.rlAgentType}. Must be one of: ${validAgentTypes.join(', ')}`);
    }

    const validExperiments = ['1P1G', '1P2G', '2P2G', '2P3G'];
    for (const exp of config.experimentOrder) {
        if (!validExperiments.includes(exp)) {
            console.error(`Invalid experiment type: ${exp}. Must be one of: ${validExperiments.join(', ')}`);
        }
    }

    console.log('Configuration validation complete.');
})();

// =================================================================================================
// HELPER FUNCTIONS
// =================================================================================================

/**
 * Quick configuration change functions
 */
window.setExperimentMode = function(mode, agentType = 'joint') {
    if (['human-ai', 'human-human'].includes(mode)) {
        window.EXPERIMENT_CONFIG.experimentMode = mode;
        if (mode === 'human-ai' && ['individual', 'joint'].includes(agentType)) {
            window.EXPERIMENT_CONFIG.rlAgentType = agentType;
        }
        console.log(`Experiment mode set to: ${mode}${mode === 'human-ai' ? ` (${agentType})` : ''}`);
        console.log('Reload the page to apply changes.');
    } else {
        console.error('Invalid mode. Use: "human-ai" or "human-human"');
    }
};

window.setExperimentOrder = function(order) {
    const validExperiments = ['1P1G', '1P2G', '2P2G', '2P3G'];
    const isValid = order.every(exp => validExperiments.includes(exp));

    if (isValid) {
        window.EXPERIMENT_CONFIG.experimentOrder = order;
        console.log(`Experiment order set to: ${order.join(' → ')}`);
        console.log('Reload the page to apply changes.');
    } else {
        console.error(`Invalid experiment order. Valid experiments: ${validExperiments.join(', ')}`);
    }
};

window.setTrialCounts = function(counts) {
    window.EXPERIMENT_CONFIG.numTrials = { ...window.EXPERIMENT_CONFIG.numTrials, ...counts };
    console.log('Trial counts updated:', window.EXPERIMENT_CONFIG.numTrials);
    console.log('Reload the page to apply changes.');
};

// =================================================================================================
// CONSOLE HELP
// =================================================================================================

console.log(`
Available configuration functions:
- setExperimentMode('human-ai', 'joint') or setExperimentMode('human-human')
- setExperimentOrder(['1P1G', '1P2G', '2P2G', '2P3G'])
- setTrialCounts({'2P2G': 8, '2P3G': 8})

Current configuration available at: window.EXPERIMENT_CONFIG
`);

// Export for use by the experiment system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.EXPERIMENT_CONFIG;
}