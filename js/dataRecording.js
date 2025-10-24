/**
 * Data Recording Module
 *
 * Handles all data recording and trial finalization logic.
 * Extracted from human-AI-version.js for better organization.
 */

// Participant ID and DOB storage
var participantId = null;
var participantDob = null; // 'YYYY-MM-DD'

var participantIdSource = null;
var pendingParticipantIdResolver = null;

/**
 * Initialize participant ID flow based on experiment mode configuration
 * @returns {Promise<string|null>} Resolves with participant ID or null if cancelled/invalid
 */
function initializeParticipantIdFlow() {
    const config = window.NodeGameConfig ? window.NodeGameConfig.getParticipantIdConfig() : null;
    participantIdSource = config ? config.source : 'prolificPID';

    if (participantIdSource === 'manual') {
        return promptForParticipantId(config && config.manualEntry)
            .then(function(id) {
                if (!id) return null;
                // Prompt for DOB after participant ID is entered
                return promptForDob(config && config.dobEntry).then(function(dob) {
                    // Store DOB even if null to avoid reprompting later
                    setParticipantDob(dob);
                    return id;
                });
            });
    }

    // Prolific or other auto sources: still prompt for DOB
    const id = extractProlificId();
    if (!id) return Promise.resolve(null);
    return promptForDob(config && config.dobEntry).then(function(dob) {
        setParticipantDob(dob);
        return id;
    });
}

function promptForParticipantId(manualConfig) {
    return new Promise(function(resolve) {
        pendingParticipantIdResolver = resolve;
        var promptTitle = manualConfig && manualConfig.promptTitle ? manualConfig.promptTitle : 'Enter Participant ID';
        var placeholder = manualConfig && manualConfig.placeholder ? manualConfig.placeholder : '';
        var validationRegex = manualConfig && manualConfig.validationRegex ? new RegExp(manualConfig.validationRegex) : null;
        var validationHint = manualConfig && manualConfig.validationHint ? manualConfig.validationHint : 'Please enter a valid participant ID.';

        var idFromLocalStorage = window.localStorage ? window.localStorage.getItem('nodegame_manual_participant_id') : null;
        var defaultValue = idFromLocalStorage || '';

        var userInput = window.prompt(promptTitle + (placeholder ? ` (e.g., ${placeholder})` : ''), defaultValue);

        if (userInput === null) {
            console.warn('Participant ID entry cancelled by user');
            participantId = null;
            resolve(null);
            return;
        }

        userInput = userInput.trim();

        if (!userInput) {
            alert('Participant ID cannot be empty. ' + validationHint);
            participantId = null;
            resolve(null);
            return;
        }

        if (validationRegex && !validationRegex.test(userInput)) {
            alert('Invalid participant ID format. ' + validationHint);
            participantId = null;
            resolve(null);
            return;
        }

        participantId = userInput;
        if (window.localStorage) {
            window.localStorage.setItem('nodegame_manual_participant_id', participantId);
        }
        console.log('Manual participant ID set:', participantId);
        resolve(participantId);
    });
}

/**
 * Set participant ID directly (used for manual entry UIs)
 * @param {string} id - Participant identifier
 */
function setParticipantId(id) {
    participantId = id;
    if (pendingParticipantIdResolver) {
        pendingParticipantIdResolver(participantId);
        pendingParticipantIdResolver = null;
    }
}

/**
 * Prompt for Date of Birth (DOB) after participant ID
 * Accepts format YYYY-MM-DD and stores in localStorage
 * @param {Object} dobConfig - Optional config { promptTitle, placeholder, required }
 * @returns {Promise<string|null>} Resolves with DOB string or null
 */
function promptForDob(dobConfig) {
    return new Promise(function(resolve) {
        try {
            const title = (dobConfig && dobConfig.promptTitle) || 'Enter Date of Birth (YYYY-MM-DD)';
            const placeholder = (dobConfig && dobConfig.placeholder) || 'YYYY-MM-DD';
            const required = dobConfig && dobConfig.required === true;

            // Use stored value if present
            var saved = window.localStorage ? window.localStorage.getItem('nodegame_participant_dob') : null;
            var defaultValue = saved || '';

            // Helper to validate DOB
            function isValidDob(s) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
                const parts = s.split('-');
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                const d = parseInt(parts[2], 10);
                if (y < 1900 || y > new Date().getFullYear()) return false;
                if (m < 1 || m > 12) return false;
                if (d < 1 || d > 31) return false;
                const dt = new Date(s);
                return !isNaN(dt.getTime());
            }

            // Prompt loop (max 3 attempts if required)
            let attempts = 0;
            function ask() {
                attempts += 1;
                var input = window.prompt(title + (placeholder ? ` (e.g., ${placeholder})` : ''), defaultValue);
                if (input === null) {
                    if (required) {
                        if (attempts < 3) {
                            alert('Date of birth is required to continue.');
                            ask();
                            return;
                        }
                        console.warn('DOB entry cancelled after multiple attempts');
                        resolve(null);
                        return;
                    }
                    console.warn('DOB entry cancelled by user');
                    resolve(null);
                    return;
                }
                input = input.trim();
                if (!input) {
                    if (required) {
                        alert('Date of birth cannot be empty. Please enter in YYYY-MM-DD format.');
                        ask();
                        return;
                    }
                    resolve(null);
                    return;
                }
                if (!isValidDob(input)) {
                    alert('Invalid date format. Please enter in YYYY-MM-DD format.');
                    ask();
                    return;
                }
                // Save and resolve; a fullscreen prompt stage will appear before welcome
                participantDob = input;
                if (window.localStorage) {
                    window.localStorage.setItem('nodegame_participant_dob', participantDob);
                }
                console.log('Participant DOB set:', participantDob);
                resolve(participantDob);
            }
            ask();
        } catch (e) {
            console.warn('DOB prompt failed:', e);
            resolve(null);
        }
    });
}

function setParticipantDob(dob) {
    participantDob = dob || null;
    if (dob && window.localStorage) {
        window.localStorage.setItem('nodegame_participant_dob', participantDob);
    }
    if (window.gameData) {
        window.gameData.participantDob = participantDob;
    }
}

/**
 * Extract Prolific participant ID from URL parameters
 */
function extractProlificId() {
    const config = window.NodeGameConfig ? window.NodeGameConfig.getParticipantIdConfig() : null;
    const urlParams = new URLSearchParams(window.location.search);
    const prolificKey = config && config.sourceKey ? config.sourceKey : 'PROLIFIC_PID';
    const prolificPid = urlParams.get(prolificKey) || urlParams.get(prolificKey.toLowerCase());

    if (prolificPid) {
        participantId = prolificPid;
        console.log('Prolific participant ID extracted:', participantId);
        return participantId;
    } else {
        console.warn('No PROLIFIC_PID found in URL parameters');
        // For testing/development, generate a test ID
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            participantId = 'TEST_' + Math.random().toString(36).substr(2, 9);
            console.log('Generated test participant ID:', participantId);
            return participantId;
        }
        return null;
    }
}

/**
 * Get current participant ID
 */
function getParticipantId() {
    if (!participantId) {
        extractProlificId();
    }
    return participantId;
}

function getParticipantDob() {
    if (!participantDob && window.localStorage) {
        participantDob = window.localStorage.getItem('nodegame_participant_dob');
    }
    return participantDob;
}

function getParticipantIdAsync() {
    if (participantId) {
        return Promise.resolve(participantId);
    }
    return initializeParticipantIdFlow();
}

/**
 * Validate that participant ID exists
 */
function validateParticipantId() {
    const config = window.NodeGameConfig ? window.NodeGameConfig.getParticipantIdConfig() : null;
    if (config && config.manualEntry && config.manualEntry.enabled && !participantId) {
        console.warn('Manual participant ID missing; prompting user.');
        return initializeParticipantIdFlow().then(function(id) {
            if (!id) {
                console.error('No participant ID available - experiment cannot proceed');
                return false;
            }
            return true;
        });
    }

    const id = getParticipantId();
    if (!id) {
        console.error('No participant ID available - experiment cannot proceed');
        return false;
    }
    return true;
}

function getDataStorageSettings() {
    if (!window.NodeGameConfig) {
        return null;
    }
    return window.NodeGameConfig.getDataStorageConfig();
}

function saveDataLocally(data, options) {
    var storageConfig = getDataStorageSettings();
    if (!storageConfig || storageConfig.type !== 'local') {
        console.warn('Local data storage is not enabled for current mode.');
        return;
    }

    options = options || {};

    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var participant = options.participantId || getParticipantId() || 'unknown';
    var fileNameTemplate = storageConfig.fileNameTemplate || 'session_${participantId}_${timestamp}.json';
    var fileNameBase = options.fileName || fileNameTemplate;

    var fileName = fileNameBase
        .replace('${participantId}', participant)
        .replace('${timestamp}', timestamp);

    var serialized = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    var blob = new Blob([serialized], { type: 'application/json' });

    if (storageConfig.baseDirectory) {
        console.log('Local storage base directory (informational):', storageConfig.baseDirectory);
    }

    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log('Saved data locally as', fileName);
}

/**
 * Record player1 move
 */
function recordPlayer1Move(action, reactionTime) {
    gameData.currentTrialData.player1Actions.push(action);
    gameData.currentTrialData.player1RT.push(reactionTime);
    gameData.currentTrialData.player1Trajectory.push([...gameData.player1]);
}

/**
 * Record player2 move (AI or human)
 */
function recordPlayer2Move(action, reactionTime = null) {
    gameData.currentTrialData.player2Actions.push(action);
    if (reactionTime !== null) {
        gameData.currentTrialData.player2RT = gameData.currentTrialData.player2RT || [];
        gameData.currentTrialData.player2RT.push(reactionTime);
    }
    // Record the trajectory after the move (new position)
    // This will be called after the player2 position is updated
    gameData.currentTrialData.player2Trajectory.push([...gameData.player2]);
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

    if (window.NodeGameConfig && window.NodeGameConfig.getDataStorageConfig) {
        var storageConfig = window.NodeGameConfig.getDataStorageConfig();
        if (storageConfig && storageConfig.includeParticipantIdInPayload) {
            gameData.currentTrialData.participantId = getParticipantId();
        }
    }

    gameData.allTrialsData.push({...gameData.currentTrialData});

    // Reset movement flags to prevent issues in next trial
    timeline.isMoving = false;
    timeline.keyListenerActive = false;

    console.log('Trial finalized:', gameData.currentTrialData);
    console.log(`Trial success: ${trialSuccess} (${gameData.currentExperiment})`);
}

// Export functions for module usage
window.DataRecording = {
    recordPlayer1Move: recordPlayer1Move,
    recordPlayer2Move: recordPlayer2Move,
    finalizeTrial: finalizeTrial,
    extractProlificId: extractProlificId,
    getParticipantId: getParticipantId,
    getParticipantIdAsync: getParticipantIdAsync,
    validateParticipantId: validateParticipantId,
    setParticipantId: setParticipantId,
    getParticipantDob: getParticipantDob,
    setParticipantDob: setParticipantDob,
    initializeParticipantIdFlow: initializeParticipantIdFlow,
    saveDataLocally: saveDataLocally
};
