/**
 * Unified NodeGame Experiment System
 *
 * Combines human-AI and human-human experiment logic with config-based mode switching
 * Based on nodeGameHumanAIVersion.js with integrated multiplayer support
 */

// =================================================================================================
// CONFIGURATION - CHANGE HERE TO SWITCH BETWEEN HUMAN-AI AND HUMAN-HUMAN MODES
// =================================================================================================

// Use configuration from experimentConfig.js if available, otherwise use defaults
const UNIFIED_EXPERIMENT_CONFIG = window.EXPERIMENT_CONFIG || {
    // Default configuration if config file not loaded
    experimentMode: 'human-ai',
    rlAgentType: 'joint',
    experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'],
    numTrials: { '1P1G': 3, '1P2G': 4, '2P2G': 4, '2P3G': 4 },
    successThreshold: {
        enabled: true,
        consecutiveSuccessesRequired: 4,
        minTrialsBeforeCheck: 4,
        maxTrials: 30,
        randomSamplingAfterTrial: 4
    },
    timing: {
        trialToFeedbackDelay: 500,
        feedbackDisplayDuration: 2000,
        preTrialDisplayDuration: 2000,
        fixationDuration: 1000,
        newGoalMessageDuration: 0,
        agentDelay: 500,
        independentAgentDelay: 500
    },
    game: {
        maxGameLength: 50,
        gridSize: 15,
        enableProlificRedirect: true,
        prolificCompletionCode: 'C19EH5X9'
    },
    multiplayer: {
        maxWaitTime: 60000,
        syncTimeout: 10000,
        reconnectAttempts: 3,
        movementMode: 'simultaneous',
        enableSinglePlayerTesting: false
    }
};

// Extract values for backward compatibility
const {
    experimentMode,
    rlAgentType,
    experimentOrder,
    numTrials,
    successThreshold,
    timing,
    game,
    multiplayer
} = UNIFIED_EXPERIMENT_CONFIG;

// Create unifiedConfig for backward compatibility
const unifiedConfig = UNIFIED_EXPERIMENT_CONFIG;

// =================================================================================================
// GLOBAL STATE MANAGEMENT
// =================================================================================================

// Unified game data structure
var unifiedGameData = {
    // Experiment state
    currentExperiment: null,
    currentExperimentIndex: 0,
    currentTrial: 0,
    allTrialsData: [],
    currentTrialData: {},

    // Game state
    gridMatrix: null,
    playerState: null,
    partnerState: null,  // AI state in human-AI mode, partner state in human-human mode
    currentGoals: null,
    stepCount: 0,
    gameStartTime: 0,

    // Success threshold tracking
    successThreshold: {
        consecutiveSuccesses: 0,
        totalTrialsCompleted: 0,
        experimentEndedEarly: false,
        lastSuccessTrial: -1,
        successHistory: []
    },

    // Multiplayer state (for human-human mode)
    multiplayer: {
        isConnected: false,
        socket: null,
        roomId: null,
        playerId: null,
        partnerId: null,
        isHost: false,
        waitingForPartner: false,
        partnerReady: false,
        movementMode: 'simultaneous', // 'simultaneous' or 'turn-based'
        currentPlayer: null,
        gameSync: {
            lastSyncTime: 0,
            pendingActions: [],
            waitingForSync: false
        },
        goalGeneration: {
            newGoalPresented: false,
            distanceCondition: null,
            inProgress: false
        }
    },

    // Mode-specific data
    mode: experimentMode,
    rlAgentType: rlAgentType
};

// Make gameData globally accessible for compatibility
window.gameData = unifiedGameData;

// =================================================================================================
// CORE EXPERIMENT INITIALIZATION
// =================================================================================================

/**
 * Initialize the unified experiment system
 */
function initializeUnifiedExperiments() {
    console.log(`Initializing Unified Experiment System in ${experimentMode} mode`);

    // Check dependencies
    if (!checkDependencies()) {
        console.error('Missing required dependencies');
        return false;
    }

    // Initialize based on mode and experiment type
    // For 1P experiments, both modes behave identically
    // For 2P experiments, use mode-specific initialization
    if (experimentMode === 'human-human') {
        return initializeHumanHumanMode();
    } else {
        return initializeHumanAIMode();
    }
}

/**
 * Check for required dependencies
 */
function checkDependencies() {
    const required = ['DIRECTIONS', 'OBJECT', 'MapsFor1P1G', 'MapsFor1P2G', 'MapsFor2P2G', 'MapsFor2P3G'];

    for (const dep of required) {
        if (typeof window[dep] === 'undefined') {
            console.error(`Missing dependency: ${dep}`);
            return false;
        }
    }

    // Create standardized DIRECTIONS if needed
    if (typeof window.DIRECTIONS !== 'undefined' && !window.DIRECTIONS.UP) {
        window.STANDARD_DIRECTIONS = {
            'UP': window.DIRECTIONS.arrowup?.movement || [-1, 0],
            'DOWN': window.DIRECTIONS.arrowdown?.movement || [1, 0],
            'LEFT': window.DIRECTIONS.arrowleft?.movement || [0, -1],
            'RIGHT': window.DIRECTIONS.arrowright?.movement || [0, 1],
            'STAY': [0, 0]
        };
    } else {
        window.STANDARD_DIRECTIONS = window.DIRECTIONS;
    }

    // Check for Socket.io in human-human mode
    if (experimentMode === 'human-human' && typeof io === 'undefined') {
        console.error('Socket.io required for human-human mode');
        return false;
    }

    // Check for RL Agent in human-AI mode
    if (experimentMode === 'human-ai' && typeof window.RLAgent === 'undefined') {
        console.error('RLAgent required for human-AI mode');
        return false;
    }

    return true;
}

/**
 * Initialize human-AI mode
 */
function initializeHumanAIMode() {
    console.log('Initializing Human-AI Mode');

    // Set RL agent type
    if (window.RLAgent && window.RLAgent.setRLAgentType) {
        window.RLAgent.setRLAgentType(rlAgentType);
        console.log(`RL Agent set to: ${rlAgentType}`);
    }

    // Initialize success threshold tracking
    initializeSuccessThresholdTracking();

    // Initialize UI for human-AI mode
    initializeHumanAIInterface();

    return true;
}

/**
 * Initialize human-human mode
 */
function initializeHumanHumanMode() {
    console.log('Initializing Human-Human Mode');

    // Initialize success threshold tracking
    initializeSuccessThresholdTracking();

    // Initialize UI for human-human mode
    initializeHumanHumanInterface();

    // Note: Multiplayer connection will be initialized when needed for 2P experiments
    // For 1P experiments, no multiplayer connection is needed

    return true;
}

/**
 * Show multiplayer UI for 2P experiments
 */
function showMultiplayerUI() {
    const statusDiv = document.getElementById('multiplayer-status');
    const partnerDiv = document.getElementById('partner-status');

    if (statusDiv) statusDiv.style.display = 'block';
    if (partnerDiv) partnerDiv.style.display = 'block';
}

/**
 * Hide multiplayer UI for 1P experiments
 */
function hideMultiplayerUI() {
    const statusDiv = document.getElementById('multiplayer-status');
    const partnerDiv = document.getElementById('partner-status');

    if (statusDiv) statusDiv.style.display = 'none';
    if (partnerDiv) partnerDiv.style.display = 'none';
}

// =================================================================================================
// HUMAN-AI MODE IMPLEMENTATION
// =================================================================================================

/**
 * Initialize Human-AI interface
 */
function initializeHumanAIInterface() {
    // Use existing human-AI interface logic
    console.log('Setting up Human-AI interface...');

    // Initialize game canvas and UI elements
    initializeGameInterface();

    // Keyboard controls will be set up per-trial (like nodeGameHumanAIVersion.js)

    console.log('Human-AI interface initialized');
}

/**
 * Get AI action (human-AI mode)
 */
function getAIAction(gridMatrix, currentPos, goals, playerPos) {
    if (window.RLAgent && window.RLAgent.getAIAction) {
        return window.RLAgent.getAIAction(gridMatrix, currentPos, goals, playerPos);
    }

    console.warn('RL Agent not available, returning random action');
    return getRandomAction(gridMatrix, currentPos);
}

/**
 * Get random action (fallback)
 */
function getRandomAction(gridMatrix, currentPos) {
    const validActions = [];
    const [currentRow, currentCol] = currentPos;

    // Check all directions
    for (const [actionName, [dRow, dCol]] of Object.entries(window.DIRECTIONS || {})) {
        const newRow = currentRow + dRow;
        const newCol = currentCol + dCol;

        if (newRow >= 0 && newRow < gridMatrix.length &&
            newCol >= 0 && newCol < gridMatrix[0].length &&
            gridMatrix[newRow][newCol] !== window.OBJECT?.obstacle) {
            validActions.push(actionName);
        }
    }

    return validActions.length > 0 ? validActions[Math.floor(Math.random() * validActions.length)] : 'STAY';
}

// =================================================================================================
// HUMAN-HUMAN MODE IMPLEMENTATION
// =================================================================================================

/**
 * Initialize multiplayer connection for human-human mode
 */
function initializeMultiplayerConnection() {
    try {
        console.log('Connecting to multiplayer server...');

        // Initialize socket connection
        unifiedGameData.multiplayer.socket = io();
        const socket = unifiedGameData.multiplayer.socket;

        // Set up connection event handlers
        socket.on('connect', onMultiplayerConnect);
        socket.on('disconnect', onMultiplayerDisconnect);
        socket.on('room_joined', onRoomJoined);
        socket.on('partner_joined', onPartnerJoined);
        socket.on('partner_disconnected', onPartnerDisconnected);
        socket.on('game_sync', onGameSync);
        socket.on('partner_action', onPartnerAction);
        socket.on('trial_start_sync', onTrialStartSync);
        socket.on('trial_complete_sync', onTrialCompleteSync);
        socket.on('waiting_for_partner', onWaitingForPartner);
        socket.on('connection_error', onConnectionError);
        socket.on('movement_mode_updated', onMovementModeUpdated);
        socket.on('new_goal_presented', onNewGoalPresented);
        socket.on('server_new_goal', onServerNewGoal);
        socket.on('move_made', onMoveMade);
        socket.on('game_started', onGameStarted);
        socket.on('joined_room', onJoinedRoom);
        socket.on('player_joined', onPlayerJoined);
        socket.on('player_left', onPlayerLeft);
        socket.on('game_state_update', onGameStateUpdate);
        socket.on('move_rejected', onMoveRejected);
        socket.on('trial_started', onTrialStarted);
        socket.on('condition_started', onConditionStarted);
        socket.on('condition_completed', onConditionCompleted);
        socket.on('experiment_completed', onExperimentCompleted);
        socket.on('game_ended', onGameEnded);
        socket.on('trial_completed', onTrialCompleted);

        return true;
    } catch (error) {
        console.error('Failed to initialize multiplayer connection:', error);
        return false;
    }
}

/**
 * Initialize Human-Human interface
 */
function initializeHumanHumanInterface() {
    console.log('Setting up Human-Human interface...');

    // Initialize game canvas and UI elements
    initializeGameInterface();

    // Add multiplayer-specific UI elements
    addMultiplayerUI();

    console.log('Human-Human interface initialized');
}

/**
 * Add multiplayer-specific UI elements
 */
function addMultiplayerUI() {
    const container = document.getElementById('container') || document.body;

    // Add connection status indicator (only for 2P experiments)
    const statusDiv = document.createElement('div');
    statusDiv.id = 'multiplayer-status';
    statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #ddd;
        font-size: 14px;
        z-index: 1000;
        display: none;
    `;
    statusDiv.innerHTML = '<div id="connection-status">Connecting...</div>';

    container.appendChild(statusDiv);

    // Add partner readiness indicator (only for 2P experiments)
    const partnerDiv = document.createElement('div');
    partnerDiv.id = 'partner-status';
    partnerDiv.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        background: #f8f9fa;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #ddd;
        font-size: 14px;
        z-index: 1000;
        display: none;
    `;
    partnerDiv.innerHTML = '<div id="partner-readiness">Partner: Not Ready</div>';

    container.appendChild(partnerDiv);
}

// =================================================================================================
// MULTIPLAYER EVENT HANDLERS
// =================================================================================================

function onMultiplayerConnect() {
    console.log('Connected to multiplayer server');
    unifiedGameData.multiplayer.isConnected = true;
    updateConnectionStatus('Connected', 'success');

    // Join a game room (compatible with server.js)
    unifiedGameData.multiplayer.socket.emit('join_game', {
        gameType: unifiedGameData.currentExperiment || '2P2G' // Default to 2P2G if not set
    });
}

function onMultiplayerDisconnect() {
    console.log('Disconnected from multiplayer server');
    unifiedGameData.multiplayer.isConnected = false;
    updateConnectionStatus('Disconnected', 'error');
}

function onRoomJoined(data) {
    console.log('Joined room:', data);
    unifiedGameData.multiplayer.roomId = data.roomId;
    unifiedGameData.multiplayer.playerId = data.playerId;
    unifiedGameData.multiplayer.isHost = data.isHost;

    updateConnectionStatus(`Room: ${data.roomId}`, 'info');

    if (data.waitingForPartner) {
        showWaitingForPartnerMessage();
    }
}

function onPartnerJoined(data) {
    console.log('Partner joined:', data);
    unifiedGameData.multiplayer.partnerId = data.partnerId;
    unifiedGameData.multiplayer.waitingForPartner = false;

    hideWaitingForPartnerMessage();
    updatePartnerStatus('Connected', 'success');

    // In human-human mode, the server handles experiment progression
    // We just wait for the server to start sending us experiment conditions
    if (unifiedGameData.multiplayer.isHost) {
        // Send ready signal to server to start experiments
        unifiedGameData.multiplayer.socket.emit('ready_to_start', {
            roomId: unifiedGameData.multiplayer.roomId,
            playerId: unifiedGameData.multiplayer.playerId
        });
    }
}

function onPartnerDisconnected(data) {
    console.log('Partner disconnected:', data);
    unifiedGameData.multiplayer.partnerId = null;
    unifiedGameData.multiplayer.partnerReady = false;

    updatePartnerStatus('Disconnected', 'error');
    showPartnerDisconnectedMessage();
}

function onGameSync(data) {
    console.log('Game sync received:', data);

    // Update game state from partner
    if (data.gameState) {
        synchronizeGameState(data.gameState);
    }
}

function onPartnerAction(data) {
    console.log('Partner action received:', data);

    // Update partner position
    if (data.action && data.newPosition) {
        unifiedGameData.partnerState = data.newPosition;
        renderGameState();
    }
}

function onTrialStartSync(data) {
    console.log('Trial start sync:', data);

    // Synchronize trial start with partner
    if (data.trialData) {
        synchronizeTrialStart(data.trialData);
    }
}

function onTrialCompleteSync(data) {
    console.log('Trial complete sync:', data);

    // Synchronize trial completion with partner
    if (data.results) {
        synchronizeTrialComplete(data.results);
    }
}

function onTrialCompleted(data) {
    console.log('Trial completed (from server):', data);

    // Remove keyboard controls
    removeTrialKeyboardControls();

    // Process results
    const results = {
        success: data.success || false,
        playerReachedGoal: data.results ? data.results.playerReachedGoal : false,
        partnerReachedGoal: data.results ? data.results.partnerReachedGoal : false,
        sameGoal: data.results ? data.results.sameGoal : false,
        stepCount: data.results ? data.results.stepCount : unifiedGameData.stepCount,
        completionTime: data.results ? data.results.completionTime : Date.now() - unifiedGameData.gameStartTime
    };

    // Update trial data if it exists
    if (unifiedGameData.currentTrialData) {
        unifiedGameData.currentTrialData.endTime = Date.now();
        unifiedGameData.currentTrialData.success = results.success;
        unifiedGameData.currentTrialData.stepCount = results.stepCount;
        unifiedGameData.currentTrialData.completionTime = results.completionTime;

        // Store trial data
        unifiedGameData.allTrialsData.push(unifiedGameData.currentTrialData);
    } else {
        // Create trial data from server data if not available locally
        const trialData = {
            experimentType: unifiedGameData.currentExperiment,
            trialIndex: unifiedGameData.currentTrial,
            startTime: unifiedGameData.gameStartTime || Date.now(),
            endTime: Date.now(),
            success: results.success,
            stepCount: results.stepCount,
            completionTime: results.completionTime,
            playerActions: [],
            partnerActions: []
        };
        unifiedGameData.allTrialsData.push(trialData);
    }

    // Update success tracking
    updateSuccessTracking(results.success);

    // Show feedback
    showTrialFeedback(results);

    // The server will automatically start the next trial or complete the experiment
    // We don't need to manually progress here
}

function onWaitingForPartner(data) {
    console.log('Waiting for partner:', data);

    // Check if single player testing is enabled
    if (multiplayer.enableSinglePlayerTesting) {
        console.log('Single player testing enabled - starting experiment without partner');
        hideWaitingForPartnerMessage();

        // Start the experiment immediately for single player testing
        setTimeout(() => {
            startUnifiedExperiment();
        }, 2000); // Small delay to show the waiting message briefly
    } else {
        showWaitingForPartnerMessage();
    }
}

function onConnectionError(data) {
    console.error('Connection error:', data);
    updateConnectionStatus(`Error: ${data.message}`, 'error');
}

function onMovementModeUpdated(data) {
    console.log('Movement mode updated:', data);
    unifiedGameData.multiplayer.movementMode = data.movementMode;
    updateMovementModeDisplay(data.movementMode);
}

function onNewGoalPresented(data) {
    console.log('New goal presented:', data);
    if (data.newGoal) {
        // Add new goal to current goals
        unifiedGameData.currentGoals.push(data.newGoal);
        unifiedGameData.multiplayer.goalGeneration.newGoalPresented = true;



        // Update game state to show new goal
        renderGameState();

        // Show notification
        showNewGoalNotification();
    }
}

function onServerNewGoal(data) {
    console.log('Server new goal:', data);
    if (data.newGoalPosition) {
        // Add server-generated goal
        unifiedGameData.currentGoals.push(data.newGoalPosition);
        unifiedGameData.multiplayer.goalGeneration.newGoalPresented = true;
        unifiedGameData.multiplayer.goalGeneration.distanceCondition = data.distanceCondition;



        // Update game state
        renderGameState();

        // Show notification
        showNewGoalNotification('A new goal has appeared!');
    }
}

function onMoveMade(data) {
    console.log('Move made by partner:', data);

    // Update partner position
    if (data.playerId !== unifiedGameData.multiplayer.playerId && data.newPosition) {
        unifiedGameData.partnerState = data.newPosition;

        // Update grid matrix
        if (unifiedGameData.gridMatrix && unifiedGameData.partnerState) {
                        // Clear old partner position
            for (let row = 0; row < unifiedGameData.gridMatrix.length; row++) {
                for (let col = 0; col < unifiedGameData.gridMatrix[row].length; col++) {
                    if (unifiedGameData.gridMatrix[row][col] === window.OBJECT?.ai_player) {
                        unifiedGameData.gridMatrix[row][col] = window.OBJECT?.blank;
                    }
                }
            }

            // Set new partner position
            const [newRow, newCol] = unifiedGameData.partnerState;
            if (newRow >= 0 && newRow < 15 && newCol >= 0 && newCol < 15) {
                unifiedGameData.gridMatrix[newRow][newCol] = window.OBJECT?.ai_player;
            }
        }

        // Update step count and current player
        if (data.gameState) {
            unifiedGameData.stepCount = data.gameState.stepCount;
            unifiedGameData.multiplayer.currentPlayer = data.currentPlayer;
        }

        // Re-render
        renderGameState();

        // Check for new goal presentation in 2P3G
        if (unifiedGameData.currentExperiment === '2P3G' && !unifiedGameData.multiplayer.goalGeneration.newGoalPresented) {
            checkAndRequestNewGoal();
        }
    }
}

function onGameStarted(data) {
    console.log('Game started:', data);

    if (data.gameState) {
        // Update game state from server
        unifiedGameData.gridMatrix = data.gameState.gridMatrix;
        unifiedGameData.currentGoals = data.gameState.goals;
        unifiedGameData.stepCount = data.gameState.stepCount;

        // Set player positions
        Object.keys(data.gameState.playerStates).forEach((playerId, index) => {
            if (playerId === unifiedGameData.multiplayer.playerId) {
                unifiedGameData.playerState = data.gameState.playerStates[playerId].position;
            } else {
                unifiedGameData.partnerState = data.gameState.playerStates[playerId].position;
            }
        });

        // Update movement mode
        unifiedGameData.multiplayer.movementMode = data.movementMode || 'simultaneous';
        unifiedGameData.multiplayer.currentPlayer = data.currentPlayer;

        // Set up trial display
        setupTrialDisplay();

        // Enable controls
        setupTrialKeyboardControls();

        // Render initial state
        renderGameState();
    }
}

function onJoinedRoom(data) {
    console.log('Joined room:', data);
    unifiedGameData.multiplayer.roomId = data.roomId;
    unifiedGameData.multiplayer.playerId = data.playerId;

    updateConnectionStatus(`Room: ${data.roomId}`, 'success');

    // Send ready signal
    unifiedGameData.multiplayer.socket.emit('player_ready', {
        playerId: data.playerId,
        roomId: data.roomId
    });
}

function onPlayerJoined(data) {
    console.log('Player joined:', data);
    updateConnectionStatus(`Players: ${data.playerCount}`, 'info');
}

function onPlayerLeft(data) {
    console.log('Player left:', data);
    updateConnectionStatus(`Player left (${data.playerCount} remaining)`, 'warning');
}

function onGameStateUpdate(data) {
    // Periodic game state updates
    if (data.gameState) {
        synchronizeGameState(data.gameState);
    }
}

function onMoveRejected(data) {
    console.log('Move rejected:', data.message);
    // Could show user feedback here
}

function onTrialStarted(data) {
    console.log('Trial started:', data);

    if (data.gameState) {
        // Update local state with server state
        unifiedGameData.gridMatrix = data.gameState.gridMatrix;
        unifiedGameData.currentGoals = data.gameState.goals;
        unifiedGameData.stepCount = data.gameState.stepCount;
        unifiedGameData.currentTrial = data.currentTrial;

        // Update player positions
        Object.keys(data.gameState.playerStates).forEach((playerId) => {
            if (playerId === unifiedGameData.multiplayer.playerId) {
                unifiedGameData.playerState = data.gameState.playerStates[playerId].position;
            } else {
                unifiedGameData.partnerState = data.gameState.playerStates[playerId].position;
            }
        });

        // Setup trial
        setupTrialDisplay();
        setupTrialKeyboardControls();
        renderGameState();
    }
}

function onConditionStarted(data) {
    console.log('Condition started:', data);
    unifiedGameData.currentExperiment = data.condition;
    unifiedGameData.currentExperimentIndex = data.conditionIndex;

    // Show condition instructions
    showInstructionsForCurrentExperiment();
}

function onConditionCompleted(data) {
    console.log('Condition completed:', data);

    // Store trial data
    if (data.trialData) {
        unifiedGameData.allTrialsData = unifiedGameData.allTrialsData.concat(data.trialData);
    }

    // Show completion message and wait for next condition
    showConditionCompletedMessage();
}

function onExperimentCompleted(data) {
    console.log('Experiment completed:', data);

    // Store all data
    if (data.allData) {
        unifiedGameData.allTrialsData = data.allData;
    }

    // Show completion
    completeAllExperiments();
}

function onGameEnded(data) {
    console.log('Game ended:', data);

    // Clean up
    removeTrialKeyboardControls();

    // Show message
    showGameEndedMessage();
}

// =================================================================================================
// MULTIPLAYER SYNCHRONIZATION
// =================================================================================================

/**
 * Send move to server (updated for server.js compatibility)
 */
function sendMoveToServer(action, newPosition) {
    if (unifiedGameData.multiplayer.socket && unifiedGameData.multiplayer.isConnected) {
        unifiedGameData.multiplayer.socket.emit('make_move', {
            action: action,
            newPosition: newPosition,
            reactionTime: Date.now() - unifiedGameData.gameStartTime,
            timestamp: Date.now()
        });
    }
}

/**
 * Set movement mode
 */
function setMovementMode(mode) {
    if (experimentMode === 'human-human' &&
        unifiedGameData.multiplayer.socket &&
        unifiedGameData.multiplayer.isConnected) {
        unifiedGameData.multiplayer.socket.emit('set_movement_mode', {
            movementMode: mode
        });
    }
}

/**
 * Synchronize game state with partner
 */
function synchronizeGameState(partnerGameState) {
    // Update partner's position
    if (partnerGameState.partnerState) {
        unifiedGameData.partnerState = partnerGameState.partnerState;
    }

    // Update shared game elements (goals, step count, etc.)
    if (partnerGameState.currentGoals) {
        unifiedGameData.currentGoals = partnerGameState.currentGoals;
    }

    if (partnerGameState.stepCount !== undefined) {
        unifiedGameData.stepCount = Math.max(unifiedGameData.stepCount, partnerGameState.stepCount);
    }

    // Re-render the game
    renderGameState();
}

/**
 * Synchronize trial start (matching nodeGameHumanAIVersion.js layout)
 */
function synchronizeTrialStart(trialData) {
    // Check if trialData is valid
    if (!trialData) {
        console.error('synchronizeTrialStart called with null trialData');
        return;
    }

    // Ensure both players start with the same trial data
    unifiedGameData.currentTrialData = trialData;
    unifiedGameData.gridMatrix = trialData.gridMatrix;
    unifiedGameData.currentGoals = trialData.goals;
    unifiedGameData.playerState = trialData.playerStart;
    unifiedGameData.partnerState = trialData.partnerStart; // null for 1P experiments
    unifiedGameData.stepCount = 0;
    unifiedGameData.gameStartTime = Date.now();

    // Reset goal generation state for new trial
    unifiedGameData.multiplayer.goalGeneration.newGoalPresented = false;
    unifiedGameData.multiplayer.goalGeneration.inProgress = false;

    // Validate that we have the required data
    if (!unifiedGameData.gridMatrix || !unifiedGameData.playerState) {
        console.error('Missing required trial data: gridMatrix or playerState');
        return;
    }

    // Place players on grid matrix (like nodeGameHumanAIVersion.js)
    const [playerRow, playerCol] = unifiedGameData.playerState;

    // Clear any existing player positions
    if (window.OBJECT) {
        for (let row = 0; row < unifiedGameData.gridMatrix.length; row++) {
            for (let col = 0; col < unifiedGameData.gridMatrix[row].length; col++) {
                if (unifiedGameData.gridMatrix[row][col] === window.OBJECT.player ||
                    unifiedGameData.gridMatrix[row][col] === window.OBJECT.ai_player) {
                    unifiedGameData.gridMatrix[row][col] = window.OBJECT.blank;
                }
            }
        }

        // Place human player
        unifiedGameData.gridMatrix[playerRow][playerCol] = window.OBJECT.player;

        // Place AI/partner player if in 2P mode and partner exists
        if (unifiedGameData.currentExperiment.includes('2P') && unifiedGameData.partnerState) {
            const [partnerRow, partnerCol] = unifiedGameData.partnerState;
            unifiedGameData.gridMatrix[partnerRow][partnerCol] = window.OBJECT.ai_player;
        }
    } else {
        console.error('OBJECT constants not available');
    }

    // Setup trial display
    setupTrialDisplay();

    // Set up keyboard controls for this trial (like nodeGameHumanAIVersion.js)
    setupTrialKeyboardControls();

    // Start the trial rendering
    renderGameState();
}

/**
 * Synchronize trial completion
 */
function synchronizeTrialComplete(results) {
    // Process trial results from both players
    const combinedResults = {
        success: results.success,
        playerReachedGoal: results.playerReachedGoal,
        partnerReachedGoal: results.partnerReachedGoal,
        sameGoal: results.sameGoal,
        stepCount: unifiedGameData.stepCount,
        completionTime: Date.now() - unifiedGameData.gameStartTime
    };

    // Update trial data and proceed to next trial
    completeCurrentTrial(combinedResults);
}

// =================================================================================================
// UNIFIED GAME LOGIC
// =================================================================================================

/**
 * Start the unified experiment
 */
function startUnifiedExperiment() {
    console.log(`Starting unified experiment in ${experimentMode} mode`);

    // Initialize experiment data
    unifiedGameData.currentExperimentIndex = 0;
    unifiedGameData.currentTrial = 0;
    unifiedGameData.allTrialsData = [];

    if (experimentMode === 'human-human') {
        // For human-human mode, check if we need multiplayer
        const firstExperiment = unifiedConfig.experimentOrder[0];
        if (firstExperiment.includes('2P')) {
            // For 2P experiments, initialize multiplayer and wait for server
            console.log('Initializing multiplayer for 2P experiments...');
            if (!initializeMultiplayerConnection()) {
                console.error('Failed to initialize multiplayer connection');
                return;
            }
            console.log('Waiting for server to start experiments...');
            // Don't start experiments locally - wait for server
            return;
        } else {
            // For 1P experiments, start locally (same as human-AI mode)
            console.log('Starting 1P experiments locally in human-human mode...');
            startNextExperiment();
        }
    } else {
        // Start first experiment in human-AI mode
        startNextExperiment();
    }
}

/**
 * Start next experiment condition
 */
function startNextExperiment() {
    if (unifiedGameData.currentExperimentIndex >= experimentOrder.length) {
        // All experiments completed
        completeAllExperiments();
        return;
    }

    const experimentType = experimentOrder[unifiedGameData.currentExperimentIndex];
    unifiedGameData.currentExperiment = experimentType;
    unifiedGameData.currentTrial = 0;

    console.log(`Starting experiment: ${experimentType}`);

    // Show/hide multiplayer UI based on experiment type
    if (experimentType.includes('2P')) {
        showMultiplayerUI();
    } else {
        hideMultiplayerUI();
    }

    // Reset success threshold tracking for this experiment
    initializeSuccessThresholdTracking();
}

/**
 * Start next trial
 */
function startNextTrial() {
    const experimentType = unifiedGameData.currentExperiment;
    const trialIndex = unifiedGameData.currentTrial;

    console.log(`Starting trial ${trialIndex + 1} of ${experimentType}`);

    // If experiment type is not set, use the first experiment from config
    if (!experimentType) {
        console.log('No experiment type set, using first experiment from config');
        unifiedGameData.currentExperiment = unifiedConfig.experimentOrder[0];
        unifiedGameData.currentExperimentIndex = 0;
    }

    // Get the updated experiment type
    const currentExperimentType = unifiedGameData.currentExperiment;

    // Check if we've completed enough trials or hit success threshold
    if (shouldEndExperiment(currentExperimentType, trialIndex)) {
        completeCurrentExperiment();
        return;
    }

    // For 1P experiments (1P1G, 1P2G), both modes behave identically - single player
    if (currentExperimentType.includes('1P')) {
        const trialData = initializeTrialData(trialIndex, currentExperimentType);
        if (trialData) {
            synchronizeTrialStart(trialData);
        } else {
            console.error('Failed to initialize trial data for single player experiment');
        }
    } else if (UNIFIED_EXPERIMENT_CONFIG.experimentMode === 'human-human') {
        // For 2P experiments in human-human mode, use multiplayer
        if (multiplayer.enableSinglePlayerTesting) {
            // Single player testing - initialize trial data locally
            const trialData = initializeTrialData(trialIndex, currentExperimentType);
            if (trialData) {
                synchronizeTrialStart(trialData);
            } else {
                console.error('Failed to initialize trial data for single player testing');
            }
        } else {
            // Normal multiplayer - host tells server to start trial
            if (unifiedGameData.multiplayer.isHost) {
                unifiedGameData.multiplayer.socket.emit('start_trial', {
                    roomId: unifiedGameData.multiplayer.roomId,
                    trialIndex: trialIndex,
                    experimentType: currentExperimentType
                });
            }
            // Non-host players wait for server to send trial data
        }
    } else {
        // For 2P experiments in human-AI mode, use AI partner
        const trialData = initializeTrialData(trialIndex, currentExperimentType);
        if (trialData) {
            synchronizeTrialStart(trialData);
        } else {
            console.error('Failed to initialize trial data for human-AI mode');
        }
    }
}

/**
 * Process player action
 */
function processPlayerAction(action) {
    if (!isValidAction(action)) {
        return;
    }

    // Safety check: ensure experiment is initialized
    if (!unifiedGameData.currentExperiment) {
        console.warn('processPlayerAction called before experiment initialization');
        return;
    }

    // In turn-based mode for 2P experiments, check if it's the player's turn
    if (unifiedGameData.currentExperiment && unifiedGameData.currentExperiment.includes('2P') &&
        experimentMode === 'human-human' &&
        unifiedGameData.multiplayer.movementMode === 'turn-based' &&
        unifiedGameData.multiplayer.currentPlayer !== unifiedGameData.multiplayer.playerId) {
        console.log('Not your turn in turn-based mode');
        return;
    }

    // Calculate new position
    const currentPos = unifiedGameData.playerState;
    const newPos = calculateNewPosition(currentPos, action);

    // Check if move is valid
    if (!isValidMove(newPos)) {
        return;
    }

    // Update grid matrix (like nodeGameHumanAIVersion.js)
    const [oldRow, oldCol] = currentPos;
    const [newRow, newCol] = newPos;

    // Clear old position
    unifiedGameData.gridMatrix[oldRow][oldCol] = window.OBJECT?.blank;
    // Set new position
    unifiedGameData.gridMatrix[newRow][newCol] = window.OBJECT?.player;

    // Update player position
    unifiedGameData.playerState = newPos;
    unifiedGameData.stepCount++;

    // For 2P experiments in human-human mode, send action to server
    if (unifiedGameData.currentExperiment && unifiedGameData.currentExperiment.includes('2P') && experimentMode === 'human-human') {
        sendMoveToServer(action, newPos);
    }

    // Process AI action in human-AI mode for 2P experiments
    if (unifiedGameData.currentExperiment && unifiedGameData.currentExperiment.includes('2P') && experimentMode === 'human-ai') {
        processAITurn();
    }

    // Check for new goal generation in 2P3G experiments (only in human-human mode)
    if (unifiedGameData.currentExperiment && unifiedGameData.currentExperiment === '2P3G' &&
        experimentMode === 'human-human' &&
        !unifiedGameData.multiplayer.goalGeneration.newGoalPresented) {
        checkAndRequestNewGoal();
    }

    // Check for trial completion
    checkTrialCompletion();

    // Re-render game state
    renderGameState();
}

/**
 * Process AI turn (human-AI mode only)
 */
function processAITurn() {
    if (experimentMode !== 'human-ai') {
        return;
    }

    // Only process AI turns for 2P experiments
    if (!unifiedGameData.currentExperiment || !unifiedGameData.currentExperiment.includes('2P')) {
        return;
    }

    // Only process AI turns if partner exists
    if (!unifiedGameData.partnerState) {
        return;
    }

    const aiAction = getAIAction(
        unifiedGameData.gridMatrix,
        unifiedGameData.partnerState,
        unifiedGameData.currentGoals,
        unifiedGameData.playerState
    );

    if (aiAction && aiAction !== 'STAY') {
        let newAIPos;

        // Handle array actions from RL Agent
        if (Array.isArray(aiAction)) {
            const [currentRow, currentCol] = unifiedGameData.partnerState;
            const [deltaRow, deltaCol] = aiAction;
            newAIPos = [currentRow + deltaRow, currentCol + deltaCol];
        } else {
            // Handle string actions
            newAIPos = calculateNewPosition(unifiedGameData.partnerState, aiAction);
        }

        if (isValidMove(newAIPos)) {
            // Update grid matrix (like nodeGameHumanAIVersion.js)
            const [oldRow, oldCol] = unifiedGameData.partnerState;
            const [newRow, newCol] = newAIPos;

            // Clear old position
            unifiedGameData.gridMatrix[oldRow][oldCol] = window.OBJECT?.blank;
            // Set new position
            unifiedGameData.gridMatrix[newRow][newCol] = window.OBJECT?.ai_player;

            // Update AI position
            unifiedGameData.partnerState = newAIPos;
        }
    }
}

/**
 * Check if trial should be completed
 */
function checkTrialCompletion() {
    const playerAtGoal = isPlayerAtGoal(unifiedGameData.playerState);
    const partnerAtGoal = unifiedGameData.partnerState ? isPlayerAtGoal(unifiedGameData.partnerState) : false;

    let trialComplete = false;
    let success = false;
    let sameGoal = false;

    // Check completion conditions based on experiment type
    switch (unifiedGameData.currentExperiment) {
        case '1P1G':
        case '1P2G':
            // Single player experiments - only human player matters
            trialComplete = playerAtGoal;
            success = playerAtGoal;
            break;

        case '2P2G':
        case '2P3G':
            // Collaboration experiments - both players matter
            trialComplete = playerAtGoal || partnerAtGoal;
            if (playerAtGoal && partnerAtGoal) {
                sameGoal = isAtSameGoal(unifiedGameData.playerState, unifiedGameData.partnerState);
                success = sameGoal;
            } else {
                success = false;
            }
            break;
    }

    // Check for maximum steps
    if (unifiedGameData.stepCount >= game.maxGameLength) {
        trialComplete = true;
        success = false;
    }

    if (trialComplete) {
        const results = {
            success: success,
            playerReachedGoal: playerAtGoal,
            partnerReachedGoal: partnerAtGoal,
            sameGoal: sameGoal,
            stepCount: unifiedGameData.stepCount,
            completionTime: Date.now() - unifiedGameData.gameStartTime
        };

        if (unifiedGameData.currentExperiment && unifiedGameData.currentExperiment.includes('2P') && experimentMode === 'human-human') {
            // In multiplayer mode for 2P experiments, the server handles trial completion automatically
            // We don't need to manually trigger completion - the server will send trial_complete event
            console.log('Trial completion detected, waiting for server confirmation');
        } else {
            // Complete immediately for 1P experiments or human-AI mode
            completeCurrentTrial(results);
        }
    }
}

// =================================================================================================
// 2P3G NEW GOAL GENERATION
// =================================================================================================

/**
 * Check and request new goal generation for 2P3G experiments
 */
function checkAndRequestNewGoal() {
    if (!unifiedGameData.currentExperiment || unifiedGameData.currentExperiment !== '2P3G' ||
        unifiedGameData.multiplayer.goalGeneration.newGoalPresented ||
        unifiedGameData.multiplayer.goalGeneration.inProgress) {
        return;
    }

    // Check minimum steps requirement
    if (unifiedGameData.stepCount < 1) {
        return;
    }

    if (!unifiedGameData.playerState || !unifiedGameData.partnerState) {
        return;
    }

    // Detect which goal each player is heading towards
    const playerGoal = detectPlayerGoal(unifiedGameData.playerState, unifiedGameData.currentGoals);
    const partnerGoal = detectPlayerGoal(unifiedGameData.partnerState, unifiedGameData.currentGoals);

    console.log(`Goal detection - Player: ${playerGoal}, Partner: ${partnerGoal}, Step: ${unifiedGameData.stepCount}`);

    // Check if both players are heading to the same goal
    if (playerGoal !== null && playerGoal === partnerGoal) {
        console.log('Both players heading to same goal, requesting new goal generation');
        requestNewGoalFromServer(playerGoal);
    }
}

/**
 * Detect which goal a player is heading towards
 */
function detectPlayerGoal(playerPos, goals) {
    if (!goals || goals.length === 0) {
        return null;
    }

    // Find the closest goal
    let closestGoalIndex = -1;
    let minDistance = Infinity;

    for (let i = 0; i < goals.length; i++) {
        const distance = calculateGridDistance(playerPos, goals[i]);
        if (distance < minDistance) {
            minDistance = distance;
            closestGoalIndex = i;
        }
    }

    return closestGoalIndex;
}

/**
 * Calculate grid distance (Manhattan distance)
 */
function calculateGridDistance(pos1, pos2) {
    return Math.abs(pos1[0] - pos2[0]) + Math.abs(pos1[1] - pos2[1]);
}

/**
 * Request new goal from server
 */
function requestNewGoalFromServer(sharedGoalIndex) {
    if (!unifiedGameData.multiplayer.socket ||
        unifiedGameData.multiplayer.goalGeneration.inProgress) {
        return;
    }

    unifiedGameData.multiplayer.goalGeneration.inProgress = true;

    // Generate distance condition (or use server-side generation)
    const distanceCondition = generateDistanceCondition();

    unifiedGameData.multiplayer.socket.emit('request_new_goal', {
        player2Pos: unifiedGameData.partnerState,
        player1Pos: unifiedGameData.playerState,
        currentGoals: unifiedGameData.currentGoals,
        sharedGoalIndex: sharedGoalIndex,
        distanceCondition: distanceCondition,
        stepCount: unifiedGameData.stepCount,
        trialIndex: unifiedGameData.currentTrial
    });

    console.log('Requested new goal from server with distance condition:', distanceCondition);
}

/**
 * Generate distance condition for new goal
 */
function generateDistanceCondition() {
    const conditions = [
        'closer_to_player2',
        'closer_to_player1',
        'equal_to_both',
        'no_new_goal'
    ];

    // Generate deterministic condition based on room ID and trial
    const seed = `${unifiedGameData.multiplayer.roomId}_${unifiedGameData.currentTrial}`;
    const hash = simpleHash(seed);

    return conditions[hash % conditions.length];
}

/**
 * Simple hash function
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// =================================================================================================
// UI AND RENDERING
// =================================================================================================

/**
 * Initialize game interface
 */
function initializeGameInterface() {
    const container = document.getElementById('container');
    if (!container) {
        console.error('Container element not found');
        return;
    }

    // Initialize with empty container - content will be added by individual screens
    container.innerHTML = '';

    // Start with consent form (matching nodeGameHumanAIVersion.js flow)
    showConsentForm();
}

/**
 * Setup trial display (matching server.js expectations)
 */
function setupTrialDisplay() {
    const container = document.getElementById('container');
    const experimentType = unifiedGameData.currentExperiment;
    const experimentIndex = unifiedGameData.currentExperimentIndex;
    const trialIndex = unifiedGameData.currentTrial;
    const numTrials = unifiedConfig.numTrials[experimentType];

    let trialCountDisplay = `Trial ${trialIndex + 1} of ${numTrials}`;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment ${experimentIndex + 1}: ${experimentType}</h3>
                <h4 style="margin-bottom: 20px;">${trialCountDisplay}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
                <div id="movement-mode-display" style="margin-top: 10px; font-size: 14px; color: #666;"></div>
            </div>
        </div>
    `;

    // Create and initialize canvas
    const canvasContainer = document.getElementById('gameCanvas');
    if (canvasContainer && typeof nodeGameCreateGameCanvas === 'function') {
        const canvas = nodeGameCreateGameCanvas();
        canvasContainer.appendChild(canvas);
    }

    // Update movement mode display
    updateMovementModeDisplay(unifiedGameData.multiplayer.movementMode);
}

/**
 * Add game-specific CSS styles
 */
function addGameStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .experiment-container {
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            font-family: 'Segoe UI', Arial, sans-serif;
        }

        .experiment-header {
            text-align: center;
            margin-bottom: 30px;
        }

        #experiment-info {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            font-weight: bold;
        }

        #mode-indicator {
            background: #007bff;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
        }

        .game-area {
            position: relative;
            display: flex;
            justify-content: center;
            margin: 30px 0;
        }

        #game-canvas {
            border: 2px solid #333;
            border-radius: 8px;
            background: white;
        }

        #game-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
        }

        .game-controls {
            text-align: center;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }

        .controls-info p {
            margin: 5px 0;
            font-size: 14px;
        }

        #feedback-area {
            margin: 20px 0;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .success-feedback {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }

        .failure-feedback {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }

        .overlay-message {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }

        .overlay-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }

        .overlay-button:hover {
            background: #0056b3;
        }

        .waiting-message {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
        }

        .error-message {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Initialize game canvas
 */
function initializeCanvas() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Game canvas not found');
        return;
    }

    window.gameCanvas = canvas;
    window.gameContext = canvas.getContext('2d');

    // Clear canvas
    clearCanvas();
}

/**
 * Clear the game canvas
 */
function clearCanvas() {
    if (!window.gameContext) return;

    window.gameContext.fillStyle = '#ffffff';
    window.gameContext.fillRect(0, 0, 480, 480);
}

/**
 * Render current game state (using vizWithAI.js exactly like nodeGameHumanAIVersion.js)
 */
function renderGameState() {
    if (!unifiedGameData.gridMatrix) {
        console.warn('Cannot render game state: gridMatrix is null');
        return;
    }

    // Set global gameData that nodeGameUpdateGameDisplay expects
    window.gameData = {
        gridMatrix: unifiedGameData.gridMatrix,
        playerState: unifiedGameData.playerState,
        aiState: unifiedGameData.partnerState, // null for 1P experiments
        currentGoals: unifiedGameData.currentGoals
    };

    // Use the exact same function as nodeGameHumanAIVersion.js
    if (typeof nodeGameUpdateGameDisplay === 'function') {
        nodeGameUpdateGameDisplay();
    } else {
        console.warn('nodeGameUpdateGameDisplay function not available');
    }

    // Pre-calculate RL policy only when a new goal is first displayed (after rendering)
    if (window.RLAgent && window.RLAgent.precalculatePolicyForGoals && unifiedGameData.currentGoals && unifiedGameData.currentGoals.length > 0) {
        // Check if this is a new goal presentation (3 goals instead of 2) and hasn't been pre-calculated yet
        if (unifiedGameData.currentGoals.length === 3 && !window.newGoalPreCalculated) {
            console.log('⚡ New goal rendered on map, pre-calculating 16-action policy (unified):', unifiedGameData.currentGoals);
            window.RLAgent.precalculatePolicyForGoals(unifiedGameData.currentGoals, unifiedGameData.currentExperiment);
            window.newGoalPreCalculated = true; // Mark as pre-calculated
        }
    }
}

// Custom drawing functions removed - now using vizWithAI.js functions directly

// =================================================================================================
// KEYBOARD CONTROLS
// =================================================================================================

/**
 * Set up keyboard controls for trial (matching nodeGameHumanAIVersion.js pattern)
 */
function setupTrialKeyboardControls() {
    // Store reference to handler so we can remove it later
    window.currentTrialKeyHandler = function(event) {
        const actionMap = {
            'ArrowUp': 'UP',
            'ArrowDown': 'DOWN',
            'ArrowLeft': 'LEFT',
            'ArrowRight': 'RIGHT'
        };

        if (actionMap[event.key]) {
            event.preventDefault();
            processPlayerAction(actionMap[event.key]);
        }
    };

    document.addEventListener('keydown', window.currentTrialKeyHandler);
    document.body.focus();
}

/**
 * Remove trial keyboard controls
 */
function removeTrialKeyboardControls() {
    if (window.currentTrialKeyHandler) {
        document.removeEventListener('keydown', window.currentTrialKeyHandler);
        window.currentTrialKeyHandler = null;
    }
}

// Keyboard controls are now handled per-trial like nodeGameHumanAIVersion.js

// =================================================================================================
// UTILITY FUNCTIONS
// =================================================================================================

/**
 * Initialize trial data
 */
function initializeTrialData(trialIndex, experimentType) {
    console.log(`Initializing trial data for ${experimentType}, trial ${trialIndex}`);

    // Get map data for this experiment type
    const mapData = getMapData(experimentType);
    console.log(`Map data for ${experimentType}:`, mapData);

    if (!mapData || Object.keys(mapData).length === 0) {
        console.error(`No map data available for experiment type: ${experimentType}`);
        return null;
    }

    // Select a map for this trial
    const mapKeys = Object.keys(mapData);
    const selectedMapKey = mapKeys[trialIndex % mapKeys.length];
    const selectedMap = mapData[selectedMapKey];

    if (!selectedMap || !selectedMap[0]) {
        return null;
    }

    const design = selectedMap[0]; // The map data is in an array format

    // Create empty grid matrix
    const matrixSize = window.EXPSETTINGS?.matrixsize || 15; // Default to 15 if not available
    const gridMatrix = Array(matrixSize).fill(0).map(() => Array(matrixSize).fill(0));

    // Setup goals based on experiment type
    const goals = [];
    if (design.target1) {
        goals.push(design.target1);
    }
    if (design.target2) {
        goals.push(design.target2);
    }
    if (design.target3) {
        goals.push(design.target3);
    }

    // Validate design has required properties
    if (!design.initPlayerGrid || !Array.isArray(design.initPlayerGrid) || design.initPlayerGrid.length < 2) {
        return null;
    }

    if (experimentType.includes('2P') && (!design.initAIGrid || !Array.isArray(design.initAIGrid) || design.initAIGrid.length < 2)) {
        return null;
    }

    // Setup player start positions
    const playerStart = [...design.initPlayerGrid];

    // For 1P experiments, there should be no AI partner
    // For 2P experiments, use the AI grid position
    let partnerStart = null;
    if (experimentType.includes('2P')) {
        if (!design.initAIGrid) {
            return null;
        }
        partnerStart = [...design.initAIGrid];
    }

    // Initialize trial data structure
    const trialData = {
        experimentType: experimentType,
        trialIndex: trialIndex,
        mapKey: selectedMapKey,
        gridMatrix: gridMatrix,
        goals: goals,
        playerStart: playerStart,
        partnerStart: partnerStart,
        startTime: Date.now(),
        endTime: null,
        playerActions: [],
        partnerActions: [],
        success: false,
        stepCount: 0
    };

    return trialData;
}

/**
 * Get map data for experiment type
 */
function getMapData(experimentType) {
    console.log(`Getting map data for ${experimentType}`);
    console.log('Available map data:', {
        '1P1G': window.MapsFor1P1G,
        '1P2G': window.MapsFor1P2G,
        '2P2G': window.MapsFor2P2G,
        '2P3G': window.MapsFor2P3G
    });

    switch (experimentType) {
        case '1P1G': return window.MapsFor1P1G || {};
        case '1P2G': return window.MapsFor1P2G || {};
        case '2P2G': return window.MapsFor2P2G || {};
        case '2P3G': return window.MapsFor2P3G || {};
        default:
            console.error(`Unknown experiment type: ${experimentType}`);
            return {};
    }
}

/**
 * Initialize success threshold tracking
 */
function initializeSuccessThresholdTracking() {
    unifiedGameData.successThreshold = {
        consecutiveSuccesses: 0,
        totalTrialsCompleted: 0,
        experimentEndedEarly: false,
        lastSuccessTrial: -1,
        successHistory: []
    };
}

/**
 * Check if experiment should end
 */
function shouldEndExperiment(experimentType, trialIndex) {
    const maxTrials = numTrials[experimentType] || 12;

    // Check trial limit
    if (trialIndex >= maxTrials) {
        return true;
    }

    // Check success threshold for collaboration experiments
    if ((experimentType === '2P2G' || experimentType === '2P3G') &&
        successThreshold.enabled) {

        const threshold = successThreshold;
        const tracking = unifiedGameData.successThreshold;

        if (tracking.totalTrialsCompleted >= threshold.minTrialsBeforeCheck &&
            tracking.consecutiveSuccesses >= threshold.consecutiveSuccessesRequired) {
            console.log(`Ending experiment ${experimentType} early due to success threshold`);
            tracking.experimentEndedEarly = true;
            return true;
        }
    }

    return false;
}

/**
 * Calculate new position based on action
 */
function calculateNewPosition(currentPos, action) {
    const [currentRow, currentCol] = currentPos;

    // Map action to direction
    let direction = null;
    switch(action) {
        case 'UP':
            direction = [-1, 0]; // Move up (decrease row)
            break;
        case 'DOWN':
            direction = [1, 0];  // Move down (increase row)
            break;
        case 'LEFT':
            direction = [0, -1]; // Move left (decrease column)
            break;
        case 'RIGHT':
            direction = [0, 1];  // Move right (increase column)
            break;
        default:
            return currentPos;
    }

    const [deltaRow, deltaCol] = direction;
    const newPos = [currentRow + deltaRow, currentCol + deltaCol];

    return newPos;
}

/**
 * Check if a move to the given position is valid
 */
function isValidMove(position) {
    const [row, col] = position;
    const gridSize = unifiedGameData.gridMatrix.length;

    // Check bounds
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
        return false;
    }

    // Check for obstacles
    if (window.OBJECT && unifiedGameData.gridMatrix[row][col] === window.OBJECT.obstacle) {
        return false;
    }

    return true;
}

/**
 * Check if action is valid
 */
function isValidAction(action) {
    return ['UP', 'DOWN', 'LEFT', 'RIGHT', 'STAY'].includes(action);
}

/**
 * Check if player is at a goal
 */
function isPlayerAtGoal(playerPos) {
    if (!playerPos || !unifiedGameData.currentGoals) return false;

    return unifiedGameData.currentGoals.some(goal =>
        goal[0] === playerPos[0] && goal[1] === playerPos[1]
    );
}

/**
 * Check if both players are at the same goal
 */
function isAtSameGoal(playerPos, partnerPos) {
    if (!playerPos || !partnerPos || !unifiedGameData.currentGoals) return false;

    // Check if both players are at any of the same goals
    for (const goal of unifiedGameData.currentGoals) {
        const playerAtGoal = goal[0] === playerPos[0] && goal[1] === playerPos[1];
        const partnerAtGoal = goal[0] === partnerPos[0] && goal[1] === partnerPos[1];

        if (playerAtGoal && partnerAtGoal) {
            return true;
        }
    }

    return false;
}

/**
 * Generate unique player ID
 */
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Complete current trial
 */
function completeCurrentTrial(results) {
    console.log('Completing trial with results:', results);

    // Remove keyboard controls for this trial
    removeTrialKeyboardControls();

    // Update trial data
    unifiedGameData.currentTrialData.endTime = Date.now();
    unifiedGameData.currentTrialData.success = results.success;
    unifiedGameData.currentTrialData.stepCount = results.stepCount;
    unifiedGameData.currentTrialData.completionTime = results.completionTime;

    // Store trial data
    unifiedGameData.allTrialsData.push(unifiedGameData.currentTrialData);

    // Update success tracking
    updateSuccessTracking(results.success);

    // Show feedback
    showTrialFeedback(results);

    // Move to next trial
    setTimeout(() => {
        unifiedGameData.currentTrial++;
        startNextTrial();
    }, timing.feedbackDisplayDuration);
}

/**
 * Complete current experiment
 */
function completeCurrentExperiment() {
    console.log(`Completed experiment: ${unifiedGameData.currentExperiment}`);

    // Move to next experiment
    unifiedGameData.currentExperimentIndex++;

    setTimeout(() => {
        startNextExperiment();
    }, 2000);
}

/**
 * Complete all experiments
 */
function completeAllExperiments() {
    console.log('All experiments completed!');

    // Show completion message
    showCompletionMessage();

    // Export data
    if (game.enableProlificRedirect) {
        setTimeout(() => {
            window.location.href = `https://app.prolific.com/submissions/complete?cc=${game.prolificCompletionCode}`;
        }, 3000);
    }
}

/**
 * Update success tracking
 */
function updateSuccessTracking(success) {
    const tracking = unifiedGameData.successThreshold;

    tracking.totalTrialsCompleted++;
    tracking.successHistory.push(success);

    if (success) {
        tracking.consecutiveSuccesses++;
        tracking.lastSuccessTrial = tracking.totalTrialsCompleted - 1;
    } else {
        tracking.consecutiveSuccesses = 0;
    }
}

// =================================================================================================
// UI HELPER FUNCTIONS
// =================================================================================================

/**
 * Show consent form (matching nodeGameHumanAIVersion.js)
 */
function showConsentForm() {
    const container = document.getElementById('container');
    const totalTrials = Object.values(unifiedConfig.numTrials).reduce((sum, trials) => sum + trials, 0);

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
                        <li>You will complete approximately ${totalTrials} trials.</li>
                        <li>You may withdraw at any time without penalty.</li>
                        <li>There are no known risks or direct benefits.</li>
                        <li>Data will be used for research purposes only.</li>
                    </ul>
                    <p style="font-size: 18px; margin-bottom: 20px;">
                        <strong>By clicking "I Consent", you agree to participate in this study.</strong>
                    </p>
                </div>
                <div style="text-align: center;">
                    <button id="consentBtn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 18px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 15px;
                    ">I Consent</button>
                    <button id="declineBtn" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 18px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">I Do Not Consent</button>
                </div>
            </div>
        </div>
    `;

    // Handle consent
    document.getElementById('consentBtn').addEventListener('click', () => {
        showWelcomeMessage();
    });

    document.getElementById('declineBtn').addEventListener('click', () => {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center;">
                    <h3>Thank you for your time.</h3>
                    <p>You may now close this window.</p>
                </div>
            </div>
        `;
    });
}

/**
 * Show welcome message (matching nodeGameHumanAIVersion.js)
 */
function showWelcomeMessage() {
    const container = document.getElementById('container');
    const experimentType = unifiedConfig.experimentOrder[0];

    let welcomeMessage;
    if (experimentType === '1P1G' || experimentType === '1P2G') {
        welcomeMessage = `
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
                <h2 style="color: #333; margin-bottom: 30px;">Welcome!</h2>
                <p style="font-size: 20px; line-height: 1.6; margin-bottom: 30px;">
                    You will be playing a simple grid-based game where you navigate to goals using arrow keys.
                </p>
                <p style="font-size: 18px; margin-bottom: 30px;">
                    <strong>Press SPACEBAR when you're ready to begin.</strong>
                </p>
            </div>
        `;
    } else {
        welcomeMessage = `
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
                <h2 style="color: #333; margin-bottom: 30px;">Welcome!</h2>
                <p style="font-size: 20px; line-height: 1.6; margin-bottom: 30px;">
                    You will be playing a collaborative grid-based game where you coordinate with ${unifiedConfig.experimentMode === 'human-ai' ? 'an AI partner' : 'another participant'} to reach the same goals.
                </p>
                <p style="font-size: 18px; margin-bottom: 30px;">
                    <strong>Press SPACEBAR when you're ready to begin.</strong>
                </p>
            </div>
        `;
    }

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
            showInstructionsForCurrentExperiment();
        }
    }

    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();
}

/**
 * Show experiment instructions (matching nodeGameHumanAIVersion.js)
 */
function showInstructionsForCurrentExperiment() {
    const container = document.getElementById('container');
    const experimentType = unifiedConfig.experimentOrder[unifiedGameData.currentExperimentIndex];
    const experimentIndex = unifiedGameData.currentExperimentIndex;

    const instructions = getInstructionsForExperiment(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 80vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 20px;">Experiment ${experimentIndex + 1} of ${unifiedConfig.experimentOrder.length}</h2>
                <h3 style="color: #666; margin-bottom: 30px;">${experimentType} Instructions</h3>
                <div style="text-align: left; margin-bottom: 30px; line-height: 1.6;">
                    ${instructions}
                </div>
                <div style="margin-bottom: 30px;">
                    <p style="font-size: 18px; font-weight: bold;">Controls:</p>
                    <p>You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
                </div>
                <button id="startBtn" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    font-size: 18px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Start Experiment</button>
            </div>
        </div>
    `;

    document.getElementById('startBtn').addEventListener('click', () => {
        actuallyStartCurrentExperiment();
    });
}

/**
 * Actually start the current experiment (after instructions)
 */
function actuallyStartCurrentExperiment() {
    // Reset success threshold tracking for this experiment
    initializeSuccessThresholdTracking();

    // Start the first trial
    startNextTrial();
}

/**
 * Get instructions for experiment type
 */
function getInstructionsForExperiment(experimentType) {
    switch (experimentType) {
        case '1P1G':
            return `
                <p style="font-size: 18px; margin-bottom: 15px;">
                    <strong>Single Player, Single Goal (1P1G)</strong>
                </p>
                <p style="font-size: 16px; margin-bottom: 15px;">
                    In this experiment, you will navigate to a single blue goal on the grid.
                    This is a practice round to get familiar with the controls.
                </p>
                <ul style="font-size: 16px; margin-bottom: 15px;">
                    <li>Use arrow keys to move around the grid</li>
                    <li>Navigate to the blue goal to complete each trial</li>
                    <li>Try to reach the goal as quickly as possible</li>
                </ul>
            `;
        case '1P2G':
            return `
                <p style="font-size: 18px; margin-bottom: 15px;">
                    <strong>Single Player, Two Goals (1P2G)</strong>
                </p>
                <p style="font-size: 16px; margin-bottom: 15px;">
                    In this experiment, you will see two blue goals on the grid.
                    You can choose to navigate to either goal to complete the trial.
                </p>
                <ul style="font-size: 16px; margin-bottom: 15px;">
                    <li>Use arrow keys to move around the grid</li>
                    <li>Navigate to either of the two blue goals</li>
                    <li>Choose the goal that seems easiest or most strategic to reach</li>
                </ul>
            `;
        case '2P2G':
            return `
                <p style="font-size: 18px; margin-bottom: 15px;">
                    <strong>Two Players, Two Goals (2P2G)</strong>
                </p>
                <p style="font-size: 16px; margin-bottom: 15px;">
                    In this experiment, you and ${unifiedConfig.experimentMode === 'human-ai' ? 'an AI partner' : 'another participant'} will see two blue goals.
                    <strong>You both get bonus points if you reach the SAME goal!</strong>
                </p>
                <ul style="font-size: 16px; margin-bottom: 15px;">
                    <li>Use arrow keys to move around the grid</li>
                    <li>Try to coordinate to reach the same goal as your partner</li>
                    <li>Both players get bonus points for coordination</li>
                    <li>You are red, your partner is ${unifiedConfig.experimentMode === 'human-ai' ? 'green' : 'green'}</li>
                </ul>
            `;
        case '2P3G':
            return `
                <p style="font-size: 18px; margin-bottom: 15px;">
                    <strong>Two Players, Three Goals (2P3G)</strong>
                </p>
                <p style="font-size: 16px; margin-bottom: 15px;">
                    In this experiment, you and ${unifiedConfig.experimentMode === 'human-ai' ? 'an AI partner' : 'another participant'} will see two goals initially.
                    <strong>A third goal may appear during the trial!</strong>
                </p>
                <ul style="font-size: 16px; margin-bottom: 15px;">
                    <li>Use arrow keys to move around the grid</li>
                    <li>Try to coordinate to reach the same goal as your partner</li>
                    <li>Watch for new goals that may appear during the trial</li>
                    <li>Both players get bonus points for coordination</li>
                    <li>You are red, your partner is ${unifiedConfig.experimentMode === 'human-ai' ? 'green' : 'green'}</li>
                </ul>
            `;
        default:
            return '<p>Follow the on-screen instructions.</p>';
    }
}

/**
 * Show trial feedback (matching nodeGameHumanAIVersion.js)
 */
function showTrialFeedback(results) {
    const container = document.getElementById('container');
    const experimentType = unifiedGameData.currentExperiment;
    const experimentIndex = unifiedGameData.currentExperimentIndex;
    const trialIndex = unifiedGameData.currentTrial;
    const numTrials = unifiedConfig.numTrials[experimentType];

    let trialCountDisplay = `Trial ${trialIndex + 1} of ${numTrials}`;

    let message, color;
    if (results.success) {
        if (experimentType === '1P1G' || experimentType === '1P2G') {
            message = 'Great! You reached the goal!';
            color = '#28a745';
        } else {
            // 2P2G or 2P3G
            if (results.sameGoal) {
                message = 'Excellent! You and your partner reached the same goal! +Bonus Points';
                color = '#28a745';
            } else {
                message = 'You reached a goal, but your partner reached a different goal.';
                color = '#ffc107';
            }
        }
    } else {
        message = 'Trial completed. Keep trying!';
        color = '#6c757d';
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

    // Recreate canvas with final game state (exactly like nodeGameHumanAIVersion.js)
    const canvasContainer = document.getElementById('gameCanvas');
    const canvas = nodeGameCreateGameCanvas();
    canvasContainer.appendChild(canvas);

    // Render final state
    renderGameState();
}

/**
 * Show overlay message
 */
function showOverlay(title, message, callback) {
    const overlay = document.getElementById('game-overlay');
    const content = document.getElementById('overlay-content');

    if (!overlay || !content) return;

    content.innerHTML = `
        <div class="overlay-message">
            <h3>${title}</h3>
            <p>${message}</p>
            <button class="overlay-button" onclick="(${callback.toString()})()">Continue</button>
        </div>
    `;

    overlay.style.display = 'flex';
}

/**
 * Hide overlay
 */
function hideOverlay() {
    const overlay = document.getElementById('game-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Show completion message
 */
function showCompletionMessage() {
    showOverlay(
        'Experiment Complete!',
        'Thank you for participating in this cognitive science experiment. Your data has been recorded.',
        () => console.log('Experiment completed')
    );
}

/**
 * Update connection status (for human-human mode)
 */
function updateConnectionStatus(message, type) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-${type}`;
    }
}

/**
 * Update partner status (for human-human mode)
 */
function updatePartnerStatus(message, type) {
    const partnerElement = document.getElementById('partner-readiness');
    const partnerDiv = document.getElementById('partner-status');

    if (partnerElement) {
        partnerElement.textContent = `Partner: ${message}`;
        partnerElement.className = `partner-${type}`;
    }

    if (partnerDiv) {
        // Only show partner status for 2P experiments in human-human mode
        const shouldShow = unifiedGameData.currentExperiment &&
                          unifiedGameData.currentExperiment.includes('2P') &&
                          experimentMode === 'human-human';
        partnerDiv.style.display = shouldShow ? 'block' : 'none';
    }
}

/**
 * Show waiting for partner message
 */
function showWaitingForPartnerMessage() {
    showOverlay(
        'Waiting for Partner',
        'Please wait while we connect you with another participant...',
        () => console.log('Still waiting for partner')
    );
}

/**
 * Hide waiting for partner message
 */
function hideWaitingForPartnerMessage() {
    hideOverlay();
}

/**
 * Show partner disconnected message
 */
function showPartnerDisconnectedMessage() {
    showOverlay(
        'Partner Disconnected',
        'Your partner has disconnected. Please refresh the page to try again.',
        () => window.location.reload()
    );
}

/**
 * Update movement mode display
 */
function updateMovementModeDisplay(mode) {
    const displayElement = document.getElementById('movement-mode-display');
    if (displayElement) {
        const modeText = mode === 'turn-based' ? 'Turn-based Movement' : 'Simultaneous Movement';
        const turnInfo = mode === 'turn-based' && unifiedGameData.multiplayer.currentPlayer ?
            ` (${unifiedGameData.multiplayer.currentPlayer === unifiedGameData.multiplayer.playerId ? 'Your turn' : 'Partner\'s turn'})` : '';
        displayElement.textContent = modeText + turnInfo;
    }
}

/**
 * Show new goal notification
 */
function showNewGoalNotification(message = 'A new goal has appeared!') {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #007bff;
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
        z-index: 2000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 2 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 2000);
}

/**
 * Show condition completed message
 */
function showConditionCompletedMessage() {
    const container = document.getElementById('container');
    const experimentType = unifiedGameData.currentExperiment;
    const experimentIndex = unifiedGameData.currentExperimentIndex;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #28a745; margin-bottom: 30px;">Condition ${experimentIndex + 1} Complete!</h2>
                <p style="font-size: 18px; margin-bottom: 30px;">
                    You have completed the ${experimentType} condition.
                </p>
                <p style="font-size: 16px; color: #666;">
                    Preparing next condition...
                </p>
            </div>
        </div>
    `;
}

/**
 * Show game ended message
 */
function showGameEndedMessage() {
    const container = document.getElementById('container');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #dc3545; margin-bottom: 30px;">Game Ended</h2>
                <p style="font-size: 18px; margin-bottom: 30px;">
                    The game has ended. Thank you for participating!
                </p>
                <button onclick="window.location.reload()" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    font-size: 16px;
                    border-radius: 5px;
                    cursor: pointer;
                ">Start New Session</button>
            </div>
        </div>
    `;
}

// =================================================================================================
// PUBLIC API
// =================================================================================================

// Export the unified experiment system
window.UnifiedNodeGameExperiment = {
    initialize: initializeUnifiedExperiments,
    start: startUnifiedExperiment,
    config: UNIFIED_EXPERIMENT_CONFIG,
    gameData: unifiedGameData,

    // Configuration helpers
    setMode: function(mode) {
        if (['human-ai', 'human-human'].includes(mode)) {
            UNIFIED_EXPERIMENT_CONFIG.experimentMode = mode;
            unifiedGameData.mode = mode;
            console.log(`Experiment mode set to: ${mode}`);
        }
    },

    setRLAgentType: function(type) {
        if (['individual', 'joint'].includes(type)) {
            UNIFIED_EXPERIMENT_CONFIG.rlAgentType = type;
            unifiedGameData.rlAgentType = type;
            console.log(`RL Agent type set to: ${type}`);
        }
    },

    setExperimentOrder: function(order) {
        UNIFIED_EXPERIMENT_CONFIG.experimentOrder = order;
        console.log('Experiment order set to:', order);
    }
};

console.log('Unified NodeGame Experiment System loaded');
console.log(`Mode: ${UNIFIED_EXPERIMENT_CONFIG.experimentMode}`);
console.log(`RL Agent: ${UNIFIED_EXPERIMENT_CONFIG.rlAgentType}`);