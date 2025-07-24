
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

        // Add waiting for partner stage only for 2P experiments (2P2G and 2P3G)
        if (experimentType.includes('2P2G')) {
            timeline.stages.push({
                type: 'waiting_for_partner',
                handler: showWaitingForPartnerStage
            });
        }

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

// Timeline Stage Handlers

/**
 * Show consent stage
 */
function showConsentStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 800px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px;">
                <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Informed Consent for Research Participation</h1>

                <div style="max-height: 400px; overflow-y: auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 30px; background: #fafafa;">
                    <h3>Study Title: Human-Human Collaboration in Grid World Environments</h3>

                    <h4>Purpose of the Study</h4>
                    <p>You are being invited to participate in a research study examining how two people collaborate to solve spatial navigation tasks. This study will help us understand coordination and communication in collaborative problem-solving.</p>

                    <h4>What You Will Do</h4>
                    <p>You will be paired with another participant to play collaboration games on a grid. Your goal is to work together to reach target locations. The session will take approximately 30-45 minutes and consists of:</p>
                    <ul>
                        <li>Reading instructions about the collaboration tasks</li>
                        <li>Waiting to be matched with another participant</li>
                        <li>Playing collaboration games together in real-time</li>
                        <li>Completing a brief questionnaire about your experience</li>
                    </ul>

                    <h4>Risks and Benefits</h4>
                    <p>There are no known risks beyond those encountered in routine daily activities. This research may contribute to our understanding of human collaboration and coordination.</p>

                    <h4>Confidentiality</h4>
                    <p>Your responses will be kept confidential. Data will be stored securely and only accessible to the research team. No personally identifying information will be collected.</p>

                    <h4>Voluntary Participation</h4>
                    <p>Your participation is completely voluntary. You may withdraw at any time without penalty. You may skip any questions you prefer not to answer.</p>

                    <h4>Contact Information</h4>
                    <p>If you have questions about this study, please contact the research team. If you have questions about your rights as a research participant, please contact your institution's IRB.</p>
                </div>

                <div style="text-align: center;">
                    <label style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 16px;">
                        <input type="checkbox" id="consentCheckbox" style="margin-right: 10px; transform: scale(1.2);">
                        I have read and understood the above information, and I consent to participate in this study.
                    </label>

                    <button id="continueBtn" disabled style="background: #28a745; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 5px; cursor: not-allowed; margin-right: 10px;">
                        Continue to Experiment
                    </button>

                    <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                        Decline and Exit
                    </button>
                </div>
            </div>
        </div>
    `;

    // Handle consent checkbox
    const checkbox = document.getElementById('consentCheckbox');
    const continueBtn = document.getElementById('continueBtn');

    checkbox.addEventListener('change', function () {
        if (this.checked) {
            continueBtn.disabled = false;
            continueBtn.style.cursor = 'pointer';
            continueBtn.style.background = '#28a745';
        } else {
            continueBtn.disabled = true;
            continueBtn.style.cursor = 'not-allowed';
            continueBtn.style.background = '#ccc';
        }
    });

    continueBtn.addEventListener('click', function () {
        if (!this.disabled) {
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

    // Pre-calculate joint-RL policy for human-AI collaboration games during fixation to eliminate initial lag
    // Note: This is only needed for human-AI experiments, not human-human experiments
    if (experimentType.includes('2P') && window.RLAgent && window.RLAgent.precalculatePolicyForGoals) {
        // Get the design for this trial to extract goals
        var design = getRandomMapForCollaborationGame(experimentType, trialIndex);
        if (design) {
            var goals = [design.target1];
            if (design.target2) {
                goals.push(design.target2);
            }

            console.log('⚡ Pre-calculating joint-RL policy during fixation for human-AI goals:', goals.map(g => `[${g}]`).join(', '));

            // Pre-calculate in background during fixation
            setTimeout(() => {
                window.RLAgent.precalculatePolicyForGoals(goals, experimentType);
            }, 100); // Small delay to ensure UI is rendered first
        }
    }

    // Auto-advance after configurable duration
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.fixationDuration);
}


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
    var color = success ? 'blue' : 'orange';

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
            // Original checkmark symbol (commented out)
            // visualFeedback = `
            //     <div style="display: flex; justify-content: center; margin: 30px 0;">
            //         <div style="
            //             width: 120px;
            //             height: 120px;
            //             background-color: #28a745;
            //             border-radius: 50%;
            //             display: flex;
            //             align-items: center;
            //             justify-content: center;
            //             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            //         ">
            //             <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            //                 <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
            //             </svg>
            //         </div>
            //     </div>
            // `;

            // New smile face symbol
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
                            <path d="M12,1A11,11,0,1,0,23,12,11.013,11.013,0,0,0,12,1Zm0,20a9,9,0,1,1,9-9A9.011,9.011,0,0,1,12,21Zm6-8A6,6,0,0,1,6,13a1,1,0,0,1,2,0,4,4,0,0,0,8,0,1,1,0,0,1,2,0ZM8,10V9a1,1,0,0,1,2,0v1a1,1,0,0,1-2,0Zm6,0V9a1,1,0,0,1,2,0v1a1,1,0,0,1-2,0Z" fill="white"/>
                        </svg>
                    </div>
                </div>
            `;
        } else {
            collaborationFeedback = '<p style="font-size:32px;text-align: center; color: #dc3545; font-weight: bold; margin-bottom: 20px;">Collaboration failed!</p>';
            // Original X symbol (commented out)
            // visualFeedback = `
            //     <div style="display: flex; justify-content: center; margin: 30px 0;">
            //         <div style="
            //             width: 120px;
            //             height: 120px;
            //             background-color: #dc3545;
            //             border-radius: 50%;
            //             display: flex;
            //             align-items: center;
            //             justify-content: center;
            //             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            //         ">
            //             <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            //             <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="white"/>
            //             </svg>
            //         </div>
            //     </div>
            // `;

            // New sad face symbol
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
                        <svg width="80" height="80" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.5 10c.277 0 .5.223.5.5v3c0 .277-.223.5-.5.5s-.5-.223-.5-.5v-3c0-.277.223-.5.5-.5zm-9 0c.277 0 .5.223.5.5v3c0 .277-.223.5-.5.5s-.5-.223-.5-.5v-3c0-.277.223-.5.5-.5zM15 20c-2.104 0-4.186.756-5.798 2.104-.542.4.148 1.223.638.76C11.268 21.67 13.137 21 15 21s3.732.67 5.16 1.864c.478.45 1.176-.364.638-.76C19.186 20.756 17.104 20 15 20zm0-20C6.722 0 0 6.722 0 15c0 8.278 6.722 15 15 15 8.278 0 15-6.722 15-15 0-8.278-6.722-15-15-15zm0 1c7.738 0 14 6.262 14 14s-6.262 14-14 14S1 22.738 1 15 7.262 1 15 1z" fill="white"/>
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
    document.getElementById('nextPageBtn').addEventListener('click', function () {
        // Validate required fields on page 1
        var requiredFields = ['ai_detection', 'collaboration_rating', 'play_again'];
        var isValid = true;

        requiredFields.forEach(function (field) {
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

    document.getElementById('prevPageBtn').addEventListener('click', function () {
        document.getElementById('questionnairePage2').style.display = 'none';
        document.getElementById('questionnairePage1').style.display = 'block';
    });

    // Handle form submission
    document.getElementById('questionnaireForm').addEventListener('submit', function (e) {
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
        document.getElementById('continueBtn').addEventListener('click', function () {
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

/**
 * Get welcome message for experiment type
 */
function getWelcomeMessage(experimentType) {
    switch (experimentType) {
        case '1P1G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-1-Goal Task. Press space bar to begin.</p>';
        case '1P2G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-2-Goals Task. Press space bar to begin.</p>';
        case '2P2G':
            return '<p style="font-size:30px;">Welcome to the 2-Player-2-Goals Task. Press space bar to begin.</p>';
        case '2P3G':
            return `
                <p style="font-size:24px; color: #333; margin-top: 30px;">
                    The game rules have been updated!
                </p>
                <p style="font-size:22px; color: #333; margin-top: 20px;">In this game, a third restaurant may open during the game.</p>
                <p style="font-size:22px; color: #333; margin-top: 10px;">This restaurant is the same as the previous two restaurants, and you can choose any of the three restaurants!</p>
                <p style="font-size:20px; color: #d9534f; margin-top: 20px;">
                    Make sure you get to one restaurant as soon as possible using the least steps!
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
 * Show waiting for partner stage (simulated for human-AI version)
 * This shows a waiting screen and then prompts for space bar to start
 */
function showWaitingForPartnerStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 30px;">Finding another player ...</h1>

                <div style="margin: 40px 0;">
                    <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>

                <div style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    <p>Please wait while we match you with another player.</p>
                    <p>This usually takes just a few moments...</p>
                </div>

                <div id="waitingStatus" style="font-size: 16px; color: #007bff; margin-bottom: 30px;">
                    Connecting to matching service...
                </div>

                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        <strong>Tip:</strong> Keep this window open and active. You'll automatically proceed once a partner is found.
                    </p>
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

    // Simulate waiting process with status updates
    const statusMessages = [
        'Connecting to matching service...',
        'Looking for another participant...',
        'Found a participant!',
        'Establishing connection...',
        'Connection established!'
    ];

    let messageIndex = 0;
    const statusElement = document.getElementById('waitingStatus');

    const updateStatus = () => {
        if (statusElement && messageIndex < statusMessages.length) {
            statusElement.textContent = statusMessages[messageIndex];
            messageIndex++;
        }
    };

    // Update status every 2 seconds
    const statusInterval = setInterval(updateStatus, 2000);

    // After 5 seconds or when partner is found, show "Game is ready" message and wait for space bar
    setTimeout(() => {
        clearInterval(statusInterval);

        // Update the display to show "Game is ready" message
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                    <h1 style="color: #28a745; margin-bottom: 30px;">✅ Game is Ready!</h1>

                    <div style="margin: 40px 0;">
                        <div style="width: 80px; height: 80px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                            </svg>
                        </div>
                    </div>

                    <div style="font-size: 20px; color: #333; margin-bottom: 20px;">
                        <p><strong>Partner found and connection established!</strong></p>
                        <p>The game is ready to begin.</p>
                    </div>

                    <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 16px; color: #155724;">
                            <strong>Press the space bar to start the game.</strong>
                        </p>
                    </div>
                </div>
            </div>
        `;

        // Add event listener for space bar to continue
        function handleSpacebar(event) {
            if (event.code === 'Space' || event.key === ' ') {
                event.preventDefault();
                document.removeEventListener('keydown', handleSpacebar);
                nextStage();
            }
        }

        document.addEventListener('keydown', handleSpacebar);
        document.body.focus();

    }, 5000);
}
/**
 * Show completion stage
 */
function showCompletionStage(stage) {
    // Save all data before showing completion
    saveExperimentData();

    // Save data to Google Drive (matching other versions)
    try {
        saveDataToGoogleDrive();
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        // Continue with completion even if Google Drive save fails
    }

    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 700px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">🎉 Experiment Complete!</h1>

                <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    <p>Thank you for participating in our human-human collaboration study!</p>
                    <p>Your data has been saved and will contribute to important research on human coordination and teamwork.</p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin-bottom: 30px;">
                    <h3 style="color: #155724; margin-top: 0;">Completion Code</h3>
                    <p style="color: #155724; font-size: 24px; font-weight: bold; margin: 10px 0;">
                        ${NODEGAME_HUMAN_HUMAN_CONFIG.prolificCompletionCode}
                    </p>
                    <p style="color: #155724; margin-bottom: 0; font-size: 14px;">
                        Please copy this code and paste it in the Prolific completion page.
                    </p>
                </div>

                <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
                    <h3 style="margin-top: 0; color: #333;">Experiment Summary</h3>
                    <p><strong>Experiments completed:</strong> ${NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder.join(', ')}</p>
                    <p><strong>Total trials:</strong> ${gameData.allTrialsData.length}</p>
                    <p><strong>Successful trials:</strong> ${gameData.allTrialsData.filter(t => t.success).length}</p>
                    <p><strong>Success rate:</strong> ${gameData.allTrialsData.length > 0 ? Math.round((gameData.allTrialsData.filter(t => t.success).length / gameData.allTrialsData.length) * 100) : 0}%</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <button onclick="downloadExperimentData()" style="background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        Download Your Data
                    </button>

                    ${NODEGAME_HUMAN_HUMAN_CONFIG.enableProlificRedirect ? `
                        <button onclick="redirectToProlific()" style="background: #28a745; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                            Return to Prolific
                        </button>
                    ` : ''}
                </div>

                <div style="color: #6c757d; font-size: 14px;">
                    <p>You may now close this window.</p>
                    <p>If you have any questions about this research, please contact the research team.</p>
                </div>
            </div>
        </div>
    `;

    // Make functions globally available
    window.downloadExperimentData = downloadExperimentData;
    window.redirectToProlific = redirectToProlific;
}



/**
 * Show connection lost message and provide reconnection option
 */
function showConnectionLostMessage() {
    const messagesEl = document.getElementById('trialMessages');
    if (messagesEl) {
        messagesEl.innerHTML = `
            <div style="color: #dc3545; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <strong>Connection Lost</strong><br>
                Your connection to the server has been lost.
                <div style="margin-top: 10px;">
                    <button onclick="attemptReconnection()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Reconnect
                    </button>
                    <button onclick="location.reload()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    } else {
        // Fallback if trialMessages element doesn't exist
        console.warn('Connection lost but no trialMessages element found');
        if (confirm('Connection lost. Would you like to reconnect?')) {
            attemptReconnection();
        }
    }
}
/**
 * Show "Game is ready" message and wait for space bar to start
 */
function showGameReadyMessage() {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">✅ Game is Ready!</h1>

                <div style="margin: 40px 0;">
                    <div style="width: 80px; height: 80px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                        </svg>
                    </div>
                </div>

                <div style="font-size: 20px; color: #333; margin-bottom: 20px;">
                    <p><strong>Partner found and connection established!</strong></p>
                    <p>The game is ready to begin.</p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #155724;">
                        <strong>Press the space bar to start the game.</strong>
                    </p>
                </div>
            </div>
        </div>
    `;

    // Add event listener for space bar to continue
    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);

            // Send player_ready event to server
            if (socket) {
                console.log('Sending player_ready event from showGameReadyMessage');
                socket.emit('player_ready', {});
            }

            proceedToNextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}
