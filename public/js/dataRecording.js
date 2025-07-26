/**
 * Data Recording Module
 * 
 * Handles all data recording and trial finalization logic.
 * Extracted from human-AI-version.js for better organization.
 */

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
    window.ExpDesign.updateSuccessThresholdTracking(trialSuccess, gameData.currentTrial);

    gameData.allTrialsData.push({...gameData.currentTrialData});

    // Reset movement flags to prevent issues in next trial
    timeline.isMoving = false;
    timeline.keyListenerActive = false;

    console.log('Trial finalized:', gameData.currentTrialData);
    console.log(`Trial success: ${trialSuccess} (${gameData.currentExperiment})`);
}

// Export functions for module usage
window.DataRecording = {
    recordPlayerMove: recordPlayerMove,
    recordAIMove: recordAIMove,
    finalizeTrial: finalizeTrial
};