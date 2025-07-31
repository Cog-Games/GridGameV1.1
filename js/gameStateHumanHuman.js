/**
 * Game State Management Module for Human-Human Experiments
 *
 * Extends the base game state with multiplayer-specific functionality.
 * Extracted from human-human-version.js for better organization.
 */

// Global variables for 2P3G experiment (matching human-AI version)
var newGoalPresented = false;
var newGoalPosition = null;
var isNewGoalCloserToPlayer2 = null;
var player1InferredGoals = [];
var player2InferredGoals = [];
var isFrozen = false;
var freezeTimeout = null;

// Make these globally available for compatibility
window.newGoalPresented = newGoalPresented;
window.newGoalPosition = newGoalPosition;
window.isNewGoalCloserToPlayer2 = isNewGoalCloserToPlayer2;
window.player1InferredGoals = player1InferredGoals;
window.player2InferredGoals = player2InferredGoals;
window.isFrozen = isFrozen;
window.freezeTimeout = freezeTimeout;

// Extend base game data with multiplayer-specific fields
// Ensure gameData has the multiplayer structure
if (typeof window.gameData !== 'undefined') {
    if (!window.gameData.multiplayer) {
        window.gameData.multiplayer = {
            myPlayerId: null,
            partnerPlayerId: null,
            roomId: null,
            playerStates: {},
            isMyTurn: false,
            movementMode: 'simultaneous'
        };
    }
}

let gameDataHumanHuman = window.gameData;

/**
 * Initialize trial data for human-human experiments
 */
function initializeTrialDataHumanHuman(trialIndex, experimentType, design) {
    // Use base initialization first
    window.GameState.initializeTrialData(trialIndex, experimentType, design);

    // Add human-human specific fields
    gameData.currentTrialData = {
        ...gameData.currentTrialData,

        // Multiplayer specific fields (with safe fallbacks)
        myPlayerId: gameDataHumanHuman?.multiplayer?.myPlayerId || null,
        partnerPlayerId: gameDataHumanHuman?.multiplayer?.partnerPlayerId || null,
        roomId: gameDataHumanHuman?.multiplayer?.roomId || null,

        // Partner trajectory and actions
        partnerTrajectory: [],
        partnerActions: [],
        partnerRT: [],

        // Collaborative goal tracking
        collaborationStartTime: null,
        collaborationEndTime: null,

        // Communication data (if implemented)
        chatMessages: [],
        gesturesSent: [],
        gesturesReceived: []
    };

    console.log('Human-human trial data initialized for trial', trialIndex);
}

/**
 * Record player move (local player)
 */
function recordPlayerMove(action, reactionTime) {
    gameData.currentTrialData.player1Actions.push(action);
    gameData.currentTrialData.player1RT.push(reactionTime);
    gameData.currentTrialData.player1Trajectory.push([...gameData.player1]);

    console.log('Recorded player move:', action, 'RT:', reactionTime);
}

/**
 * Record partner move (remote player)
 */
function recordPartnerMove(action, reactionTime) {
    if (!gameData.currentTrialData.partnerActions) {
        gameData.currentTrialData.partnerActions = [];
    }
    if (!gameData.currentTrialData.partnerRT) {
        gameData.currentTrialData.partnerRT = [];
    }
    if (!gameData.currentTrialData.partnerTrajectory) {
        gameData.currentTrialData.partnerTrajectory = [];
    }

    gameData.currentTrialData.partnerActions.push(action);
    if (reactionTime !== null && reactionTime !== undefined) {
        gameData.currentTrialData.partnerRT.push(reactionTime);
    }
    // Record the trajectory after the move (new position)
    if (gameData.player2) {
        gameData.currentTrialData.partnerTrajectory.push([...gameData.player2]);
    }

    console.log('Recorded partner move:', action, 'RT:', reactionTime);
}

/**
 * Finalize trial for human-human experiments
 */
function finalizeTrial(completed) {
    // Use base finalization
    window.DataRecording.finalizeTrial(completed);

    // Add human-human specific finalization
    gameData.currentTrialData.trialEndTime = Date.now();
    gameData.currentTrialData.trialDuration =
        gameData.currentTrialData.trialEndTime - gameData.currentTrialData.trialStartTime;

    // Calculate collaboration metrics
    if (gameData.currentExperiment && gameData.currentExperiment.includes('2P')) {
        calculateCollaborationMetrics();
    }

    console.log('Human-human trial finalized:', gameData.currentTrialData);
}

/**
 * Calculate collaboration metrics
 */
function calculateCollaborationMetrics() {
    var trialData = gameData.currentTrialData;

    // Calculate if goals were reached simultaneously
    var player1ReachedGoal = trialData.player1FinalReachedGoal !== null;
    var partnerReachedGoal = trialData.player2FinalReachedGoal !== null;

    if (player1ReachedGoal && partnerReachedGoal) {
        // Check if same goal was reached
        var sameGoal = trialData.player1FinalReachedGoal === trialData.player2FinalReachedGoal;
        trialData.collaborationSucceeded = sameGoal;

        // Calculate time difference in reaching goals
        if (trialData.player1GoalReachedStep !== undefined && trialData.player2GoalReachedStep !== undefined) {
            trialData.goalReachTimeDifference = Math.abs(
                trialData.player1GoalReachedStep - trialData.player2GoalReachedStep
            );
        }
    } else {
        trialData.collaborationSucceeded = false;
    }

    // Calculate coordination metrics
    calculateCoordinationMetrics();
}

/**
 * Calculate coordination metrics between players
 */
function calculateCoordinationMetrics() {
    var trialData = gameData.currentTrialData;

    // Calculate movement synchrony
    if (trialData.player1Actions && trialData.partnerActions) {
        var minLength = Math.min(trialData.player1Actions.length, trialData.partnerActions.length);
        var synchronousMovements = 0;

        for (var i = 0; i < minLength; i++) {
            // Check if players moved in coordinated directions
            var player1Action = trialData.player1Actions[i];
            var partnerAction = trialData.partnerActions[i];

            // Consider movements synchronous if they're in same or complementary directions
            if (areMovementsSynchronous(player1Action, partnerAction)) {
                synchronousMovements++;
            }
        }

        trialData.movementSynchrony = minLength > 0 ? synchronousMovements / minLength : 0;
    }

    // Calculate spatial proximity over time
    if (trialData.player1Trajectory && trialData.partnerTrajectory) {
        calculateSpatialProximityMetrics();
    }
}

/**
 * Check if two movements are synchronous
 */
function areMovementsSynchronous(action1, action2) {
    // Same direction
    if (action1[0] === action2[0] && action1[1] === action2[1]) {
        return true;
    }

    // Complementary directions (moving toward each other)
    if (action1[0] === -action2[0] && action1[1] === -action2[1]) {
        return true;
    }

    return false;
}

/**
 * Calculate spatial proximity metrics
 */
function calculateSpatialProximityMetrics() {
    var trialData = gameData.currentTrialData;
    var player1Traj = trialData.player1Trajectory;
    var partnerTraj = trialData.partnerTrajectory;

    if (!player1Traj || !partnerTraj) return;

    var distances = [];
    var minLength = Math.min(player1Traj.length, partnerTraj.length);

    for (var i = 0; i < minLength; i++) {
        var pos1 = player1Traj[i];
        var pos2 = partnerTraj[i];
        var distance = Math.sqrt(
            Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2)
        );
        distances.push(distance);
    }

    if (distances.length > 0) {
        trialData.averageDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        trialData.minDistance = Math.min(...distances);
        trialData.maxDistance = Math.max(...distances);
    }
}

/**
 * Reset experiment data for human-human experiments
 */
function resetExperimentDataHumanHuman() {
    // Reset base data
    gameData.currentTrial = 0;
    gameData.allTrialsData = [];
    gameData.currentTrialData = {};
    gameData.successThreshold = {
        consecutiveSuccesses: 0,
        totalTrialsCompleted: 0,
        experimentEndedEarly: false,
        lastSuccessTrial: -1,
        successHistory: []
    };

    // Reset multiplayer specific data
    gameDataHumanHuman.multiplayer = {
        myPlayerId: null,
        partnerPlayerId: null,
        roomId: null,
        playerStates: {},
        isMyTurn: false,
        movementMode: 'simultaneous'
    };

    // Reset 2P3G specific variables
    newGoalPresented = false;
    newGoalPosition = null;
    isNewGoalCloserToPlayer2 = null;
    player1InferredGoals = [];
    player2InferredGoals = [];
    isFrozen = false;
    if (freezeTimeout) {
        clearTimeout(freezeTimeout);
        freezeTimeout = null;
    }

    console.log('Human-human experiment data reset');
}

/**
 * Save experiment data for human-human experiments
 */
function saveExperimentDataHumanHuman() {
    // Add human-human specific metadata
    var dataToSave = {
        ...gameData,
        experimentType: 'human-human',
        multiplayer: gameDataHumanHuman.multiplayer,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    };

    // Calculate overall collaboration statistics
    var totalTrials = dataToSave.allTrialsData.length;
    var successfulTrials = dataToSave.allTrialsData.filter(
        trial => trial.collaborationSucceeded === true
    ).length;

    dataToSave.overallStats = {
        totalTrials: totalTrials,
        successfulTrials: successfulTrials,
        collaborationRate: totalTrials > 0 ? successfulTrials / totalTrials : 0
    };

    return dataToSave;
}

/**
 * Check for new goal presentation (2P3G specific)
 */
function checkNewGoalPresentation2P3GLocal() {
    // This function will be called to check local conditions for new goal presentation
    // The actual logic is in expDesign.js, but we need this wrapper for human-human version
    if (window.ExpDesign && window.ExpDesign.checkNewGoalPresentation2P3G) {
        return window.ExpDesign.checkNewGoalPresentation2P3G();
    }
    return false;
}

/**
 * Check trial end condition for 2P2G
 */
function checkTrialEnd2P2G() {
    var player1AtGoal = isGoalReached(gameData.player1, gameData.currentGoals);
    var player2AtGoal = isGoalReached(gameData.player2, gameData.currentGoals);

    if (player1AtGoal && player2AtGoal) {
        var player1Goal = whichGoalReached(gameData.player1, gameData.currentGoals);
        var player2Goal = whichGoalReached(gameData.player2, gameData.currentGoals);

        // Record final reached goals
        gameData.currentTrialData.player1FinalReachedGoal = player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = player2Goal;

        // Collaboration is successful if both players reached the same goal
        var collaboration = (player1Goal === player2Goal && player1Goal !== null);
        gameData.currentTrialData.collaborationSucceeded = collaboration;

        console.log(`2P2G Collaboration check: Player1 goal=${player1Goal}, Player2 goal=${player2Goal}, Collaboration=${collaboration}`);

        return true; // Trial ended
    }

    return false; // Trial continues
}

/**
 * Check trial end condition for 2P3G
 */
function checkTrialEnd2P3G() {
    // Use the same logic as 2P2G for now
    // Can be extended with 2P3G specific logic if needed
    return checkTrialEnd2P2G();
}

// Export functions for module usage
window.GameStateHumanHuman = {
    // Data management
    gameData: gameDataHumanHuman,
    initializeTrialData: initializeTrialDataHumanHuman,
    resetExperimentData: resetExperimentDataHumanHuman,
    saveExperimentData: saveExperimentDataHumanHuman,

    // Move recording
    recordPlayerMove: recordPlayerMove,
    recordPartnerMove: recordPartnerMove,
    finalizeTrial: finalizeTrial,

    // Collaboration metrics
    calculateCollaborationMetrics: calculateCollaborationMetrics,
    calculateCoordinationMetrics: calculateCoordinationMetrics,

    // Trial end conditions
    checkTrialEnd2P2G: checkTrialEnd2P2G,
    checkTrialEnd2P3G: checkTrialEnd2P3G,
    checkNewGoalPresentation2P3GLocal: checkNewGoalPresentation2P3GLocal,

    // State variables
    getNewGoalPresented: () => newGoalPresented,
    setNewGoalPresented: (value) => { newGoalPresented = value; window.newGoalPresented = value; },
    getNewGoalPosition: () => newGoalPosition,
    setNewGoalPosition: (value) => { newGoalPosition = value; window.newGoalPosition = value; },
    getIsNewGoalCloserToPlayer2: () => isNewGoalCloserToPlayer2,
    setIsNewGoalCloserToPlayer2: (value) => { isNewGoalCloserToPlayer2 = value; window.isNewGoalCloserToPlayer2 = value; },
    getPlayer1InferredGoals: () => player1InferredGoals,
    getPlayer2InferredGoals: () => player2InferredGoals,
    getIsFrozen: () => isFrozen,
    setIsFrozen: (value) => { isFrozen = value; window.isFrozen = value; },
    getFreezeTimeout: () => freezeTimeout,
    setFreezeTimeout: (value) => { freezeTimeout = value; window.freezeTimeout = value; }
};