/**
 * Human-AI Version - Main Entry Point (Refactored)
 *
 * This file has been refactored to use modular components.
 * Game state, trial handlers, and data recording have been moved to separate modules.
 *
 * Dependencies:
 * - gameState.js - Game state and data management
 * - trialHandlers.js - Trial execution functions
 * - dataRecording.js - Data recording functions
 * - expDesign.js - Experimental design and success threshold logic
 * - gameHelpers.js - Game helper functions
 * - expTimeline.js - Timeline management functions
 * - All other existing dependencies (setup, viz, etc.)
 */

// Make imported functions globally available for non-module scripts
window.setupGridMatrixForTrial = setupGridMatrixForTrial;
window.transition = transition;
window.isValidPosition = isValidPosition;
window.isGoalReached = isGoalReached;
window.whichGoalReached = whichGoalReached;
window.detectPlayerGoal = detectPlayerGoal;
window.getMapsForExperiment = getMapsForExperiment;
window.generateRandomizedDistanceSequence = generateRandomizedDistanceSequence;
window.selectRandomMaps = selectRandomMaps;
window.getRandomMapForCollaborationGame = getRandomMapForCollaborationGame;

// Make timeline-related functions globally available
window.addCollaborationExperimentStages = addCollaborationExperimentStages;
window.nextStage = nextStage;

/**
 * Initialize experiments
 */
function initializeNodeGameExperiments() {
    console.log('Initializing experiments...');

    if (window.DataRecording && window.DataRecording.initializeParticipantIdFlow) {
        window.DataRecording.initializeParticipantIdFlow().then(function(participantId) {
            if (participantId) {
                gameData.participantId = participantId;
                console.log('Participant ID initialized:', participantId);
                // Also capture DOB if available
                try {
                    var dob = window.DataRecording.getParticipantDob && window.DataRecording.getParticipantDob();
                    if (dob) {
                        gameData.participantDob = dob;
                        console.log('Participant DOB initialized:', dob);
                    }
                } catch (e) {}
            } else {
                console.warn('Participant ID not available. Some features may be disabled.');
            }
        });
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

    console.log('Experiments ready');
    return true;
}

/**
 * Start a specific experiment
 */
function startNodeGameExperiment(experimentType) {
    // Always run in standalone mode
    console.log('Starting experiment in standalone mode:', experimentType);
    startStandaloneExperiment(experimentType);
}

/**
 * Start experiment in standalone mode
 */
function startStandaloneExperiment(experimentType) {
    try {
        // Ensure participant ID is ready for local mode if required
        if (window.DataRecording && window.NodeGameConfig) {
            var participantConfig = window.NodeGameConfig.getParticipantIdConfig();
            if (participantConfig && participantConfig.source === 'manual') {
                var pendingId = window.DataRecording.getParticipantId();
                if (!pendingId) {
                    console.log('Waiting for manual participant ID before starting experiment...');
                    window.DataRecording.initializeParticipantIdFlow().then(function(id) {
                        if (!id) {
                            alert('A participant ID is required to run the experiment. Please restart when ready.');
                            return;
                        }
                        console.log('Participant ID obtained:', id);
                        gameData.participantId = id;
                        startStandaloneExperiment(experimentType);
                    });
                    return;
                }
            }
        }

        // Clear any existing content
        document.getElementById('container').innerHTML = '';

        // Reset experiment state for continuous experiments
        gameData.currentTrial = 0;
        gameData.allTrialsData = [];

        // Initialize success threshold tracking
        window.ExpDesign.initializeSuccessThresholdTracking();

        // Enable automatic pre-calculation for joint-RL to eliminate lags
        if (window.RLAgent && window.RLAgent.enableAutoPolicyPrecalculation) {
            console.log('✅ Enabling automatic joint-RL policy pre-calculation');
            window.RLAgent.enableAutoPolicyPrecalculation();
        }

        // Randomize RL agent type once per participant if configured
        try {
            var cfg = window.NodeGameConfig && window.NodeGameConfig.NODEGAME_CONFIG;
            if (cfg && cfg.rlAgent && cfg.rlAgent.randomizeOnStart) {
                var pid = (window.gameData && window.gameData.participantId) || null;
                var storageKey = pid ? ('nodegame_rl_agent_type_' + String(pid)) : 'nodegame_rl_agent_type_default';
                var existing = null;
                try { existing = window.localStorage && window.localStorage.getItem(storageKey); } catch(e) {}
                var assigned = existing;
                if (assigned !== 'individual' && assigned !== 'joint') {
                    assigned = Math.random() < 0.5 ? 'individual' : 'joint';
                    try { if (window.localStorage) window.localStorage.setItem(storageKey, assigned); } catch(e) {}
                }
                if (assigned && typeof window.NodeGameConfig.setRLAgentType === 'function') {
                    window.NodeGameConfig.setRLAgentType(assigned);
                    console.log('RL Agent randomized/loaded for participant:', pid, '=>', assigned);
                }
                // Also keep in gameData for export/meta
                if (window.gameData) {
                    window.gameData.assignedRlAgentType = assigned;
                }
            }
        } catch (e) {
            console.warn('RL agent randomization skipped:', e);
        }

        // Initialize timeline
        timeline.currentStage = 0;

        // Create timeline stages for all experiments
        createTimelineStages();

        // Start timeline
        // console.log('Running continuous experiments');
        runNextStage();

    } catch (error) {
        console.error('Error starting experiment:', error);
    }
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

/**
 * Check if should continue to next trial (wrapper function for compatibility)
 */
function shouldContinueToNextTrial(experimentType, trialIndex) {
    return window.ExpDesign.shouldContinueToNextTrial(experimentType, trialIndex);
}

// Global functions for easy access
window.NodeGameExperiments = {
    initialize: initializeNodeGameExperiments,
    start: startNodeGameExperiment,
};
