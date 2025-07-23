
/**
 * NodeGame Configuration and Setup for Human-Human Experiments
 */

// Import nodeGame if available
if (typeof node !== 'undefined') {
    var node = node;
} else if (typeof require !== 'undefined') {
    var node = require('nodegame-client');
}

// Experiment configuration
const NODEGAME_HUMAN_HUMAN_CONFIG = {
    name: 'GridWorldHumanHumanExperiment',
    version: '1.0.0',

    // EXPERIMENT SELECTION (modify this to test different combinations)
    // Default: Test collaboration experiments (2P2G and 2P3G)
    // experimentOrder: ['2P2G'],           // Test 2P2G only
    experimentOrder: ['2P3G'],           // Test 2P3G only
    // experimentOrder: ['2P2G', '2P3G'],      // Test collaboration experiments

    // Trial counts
    numTrials: {
        '2P2G': 12,
        '2P3G': 12
    },

    // Success threshold configuration
    // Set enabled: false to disable early termination and run all trials
    successThreshold: {
        enabled: true,                   // Disabled to ensure all 12 trials are run
        consecutiveSuccessesRequired: 8,  // Increased to require 8 consecutive successes
        minTrialsBeforeCheck: 12,         // Don't check until after 12 trials
        maxTrials: 30,
        randomSamplingAfterTrial: 2
    },

    // Game settings
    maxGameLength: 50,
    enableProlificRedirect: true,
    prolificCompletionCode: 'C19EH5X9',

    // Timing configurations (same as human-AI version)
    timing: {
        feedbackDisplayDuration: 2000,
        preTrialDisplayDuration: 2000,
        fixationDuration: 2000,
        newGoalMessageDuration: 0
    },

    // Multiplayer settings
    multiplayer: {
        maxWaitTime: 60000,      // 60 seconds to wait for partner
        roomTimeout: 300000,     // 5 minutes room timeout
        reconnectAttempts: 3,
        syncInterval: 100,
        moveTimeout: 10000       // 10 seconds for move timeout
    }
};

// Global game state variables
let socket = null;
let gameState = null;
let myPlayerId = null;
let partnerPlayerId = null;
let roomId = null;
let isConnected = false;
let isGameActive = false;
let movementMode = 'simultaneous';

// Global variables for 2P3G experiment (matching human-AI version)
var newGoalPresented = false;
var newGoalPosition = null;
var isNewGoalCloserToPlayer2 = null;
var player1InferredGoals = [];
var player2InferredGoals = [];
var isFrozen = false;
var freezeTimeout = null;

// Player order tracking for consistent colors
var playerOrder = {
    firstPlayerId: null,  // First player to join (should be red)
    secondPlayerId: null, // Second player to join (should be orange)
    isFirstPlayer: false  // Whether current player is the first player
};

// Game data storage (matching human-AI version structure)
let gameData = {
    currentExperiment: null,
    currentExperimentIndex: 0,
    currentTrial: 0,
    allTrialsData: [],
    currentTrialData: {},
    questionnaireData: null,
    gridMatrix: null,
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

    // Multiplayer specific data
    multiplayer: {
        myPlayerId: null,
        partnerPlayerId: null,
        roomId: null,
        playerStates: {},
        isMyTurn: false,
        movementMode: 'simultaneous'
    }
};

// Timeline state (matching human-AI version)
let timeline = {
    currentStage: 0,
    stages: [],
    experimentType: null,
    mapData: null,
    isMoving: false,
    keyListenerActive: false,
    inTrialStage: false
};

// 2P3G Configuration (matching human-AI version)
const TWOP3G_CONFIG = {
    // Timing options
    minStepsBeforeNewGoal: 1,           // Minimum steps before new goal can appear
    newGoalMessageDuration: 5000,       // Duration of "New goal appeared!" message (ms)

    // Distance condition types for new goal generation
    distanceConditions: {
        CLOSER_TO_PLAYER2: 'closer_to_player2',           // New goal closer to player2, equal joint distance
        CLOSER_TO_PLAYER1: 'closer_to_player1',     // New goal closer to player1, equal joint distance
        EQUAL_TO_BOTH: 'equal_to_both',         // New goal equal distance to both player1 and player2, equal joint distance
        NO_NEW_GOAL: 'no_new_goal'              // No new goal will be generated
    },

    // Distance condition sequence will be generated dynamically based on number of trials
    distanceConditionSequence: null, // Will be set by generateRandomizedDistanceSequence()

    // Positioning constraints
    distanceConstraint: {
        closerThreshold: 2,              // How much closer new goal should be to player2
        allowEqualDistance: false,        // Allow equal distance if closer not found
        maxDistanceIncrease: 5           // Maximum distance increase allowed
    },

    // Goal generation constraints
    goalConstraints: {
        minDistanceFromPlayer1: 1,         // Minimum distance from player1
        maxDistanceFromPlayer1: 12,        // Maximum distance from player1
        avoidRectangleArea: false,       // Avoid rectangular area between player2 and current goal
        maintainDistanceSum: false,      // Maintain similar total distance sum
        blockPathCheck: false            // Check if goal blocks path
    },

    // Debug options
    debug: {
        logGoalDetection: false,         // Log goal detection decisions
        logNewGoalGeneration: true,      // Log new goal generation attempts
        showGoalHistory: false           // Show goal history in console
    }
};

// =================================================================================================
// SOCKET.IO CONNECTION AND EVENT HANDLING
// =================================================================================================

/**
 * Initialize socket connection
 */
function initializeSocket() {
    // Check if Socket.io is available
    if (typeof io === 'undefined') {
        console.error('Socket.io is not available. The server is not running.');
        showServerNotRunningMessage();
        return false;
    }

    if (socket) {
        socket.disconnect();
    }

    try {
        socket = io();

        socket.on('connect', () => {
            console.log('Connected to server');
            isConnected = true;
            myPlayerId = socket.id;
            gameData.multiplayer.myPlayerId = myPlayerId;
            updateWaitingStatus('Connected! Looking for another participant...');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            isConnected = false;
            handleDisconnection();
        });

        socket.on('joined_room', (data) => {
            console.log('Joined room:', data.roomId);
            roomId = data.roomId;
            gameData.multiplayer.roomId = roomId;
            handleRoomJoined(data);
        });

        socket.on('player_joined', (data) => {
            console.log('Another player joined:', data.playerId);

            // Track player order for consistent colors
            if (!playerOrder.firstPlayerId) {
                // This is the first player to join (after me)
                playerOrder.firstPlayerId = myPlayerId;
                playerOrder.secondPlayerId = data.playerId;
                playerOrder.isFirstPlayer = true;
                console.log('I am the first player (red)');
            } else {
                // This is the second player to join
                playerOrder.firstPlayerId = data.playerId;
                playerOrder.secondPlayerId = myPlayerId;
                playerOrder.isFirstPlayer = false;
                console.log('I am the second player (orange)');
            }

            updateWaitingStatus('Both players connected! Preparing to start...');
        });

        socket.on('room_full', (data) => {
            console.log('Room is full:', data);
            updateWaitingStatus('Both players connected! Preparing to start...');
            // Auto-ready the player since we're in an experiment context
            if (socket) {
                console.log('Sending player_ready event');
                socket.emit('player_ready', {});
            }
        });

        socket.on('player_left', (data) => {
            console.log('Player left:', data.playerId);
            updateWaitingStatus('Partner disconnected. Waiting for reconnection...');
        });

        socket.on('player_ready', (data) => {
            console.log('Player ready event:', data);
            updateWaitingStatus('Both players ready! Starting game...');
        });

        socket.on('game_started', (data) => {
            console.log('Game started event received:', data);
            isGameActive = true;

            if (data.gameState) {
                console.log('Full game state from server:', data.gameState);

                // Store the full game state including distance condition
                gameData.gameState = data.gameState;

                gameData.gridMatrix = data.gameState.gridMatrix;

                // Preserve locally added new goal if it exists
                if (newGoalPresented && newGoalPosition && gameData.currentGoals && gameData.currentGoals.length >= 3) {
                    // Keep the locally modified goals array with the new goal
                } else {
                    gameData.currentGoals = data.gameState.goals;
                }

                if (data.gameState.playerStates) {
                    const playerStates = data.gameState.playerStates;
                    console.log('Server player states:', playerStates);
                    console.log('My player ID:', myPlayerId);

                    if (playerStates[myPlayerId]) {
                        gameData.playerStartPos = playerStates[myPlayerId].position;
                        console.log('Updated my position to:', gameData.playerStartPos);
                    } else {
                        console.warn('No position found for my player ID:', myPlayerId);
                    }

                    // Find partner position
                    for (const [playerId, playerState] of Object.entries(playerStates)) {
                        if (playerId !== myPlayerId) {
                            gameData.partnerStartPos = playerState.position;
                            gameData.partnerPlayerId = playerId; // Store in gameData for new goal logic
                            break;
                        }
                    }
                } else {
                    console.warn('No playerStates in game state');
                }

                // Log distance condition if present
                if (data.gameState.distanceCondition) {
                    console.log('Server provided distance condition:', data.gameState.distanceCondition);
                }
            } else {
                console.warn('No gameState in server data');
            }

            // The UI is probably at the 'waiting_for_partner' stage.
            // We need to advance to the first trial stage to set up the game UI.
            const currentStage = timeline.stages[timeline.currentStage];
            if (currentStage && currentStage.type === 'waiting_for_partner') {
                console.log('Game started, advancing from waiting stage to first trial.');
                proceedToNextStage(); // This will trigger pre_trial -> fixation -> trial
            }
            else {
                // This case might be for re-joining an ongoing game or when we're already in a trial stage.
                // Check if we're currently showing fixation display and need to transition to full game board
                if (timeline.inTrialStage) {
                    console.log('Game started event received during trial stage. Transitioning from fixation to full game board.');
                    // Now show the complete game board and enable controls
                    const currentStage = timeline.stages[timeline.currentStage];
                    if (currentStage && currentStage.type === 'trial') {
                        setupTrialVisualization(currentStage.experimentType);
                        setupKeyboardControls();
                    } else {
                        setupTrialVisualization(gameData.currentExperiment);
                        setupKeyboardControls();
                    }
                } else {
                    console.log('Game started event received, but not in trial stage. Updating existing view.');
                    updateGameVisualization();
                    setupKeyboardControls();
                }
            }
        });

        socket.on('partner_left', (data) => {
            console.log('Partner left');
            handlePartnerLeft(data);
        });

        socket.on('game_state_update', (data) => {
            gameState = data.gameState;
            gameData.multiplayer.playerStates = data.gameState.playerStates;
            gameData.multiplayer.isMyTurn = data.currentPlayer === myPlayerId || movementMode === 'simultaneous';

            // Update game data with server state
            if (data.gameState) {
                // Store the full game state including distance condition
                gameData.gameState = data.gameState;

                gameData.gridMatrix = data.gameState.gridMatrix;

                // Preserve locally added new goal if it exists
                if (newGoalPresented && newGoalPosition && gameData.currentGoals && gameData.currentGoals.length >= 3) {
                    // Keep the locally modified goals array with the new goal
                } else {
                    gameData.currentGoals = data.gameState.goals;
                }

                // Update player positions from server state
                if (data.gameState.playerStates) {
                    const playerStates = data.gameState.playerStates;
                    if (playerStates[myPlayerId]) {
                        gameData.playerStartPos = playerStates[myPlayerId].position;
                    }
                    // Find partner position
                    for (const [playerId, playerState] of Object.entries(playerStates)) {
                        if (playerId !== myPlayerId) {
                            gameData.partnerStartPos = playerState.position;
                            gameData.partnerPlayerId = playerId; // Store in gameData for new goal logic
                            break;
                        }
                    }
                }
            }

            updateGameVisualization();
        });

        socket.on('move_made', (data) => {
            console.log('Move made event received:', data);

            // Update game state with the move
            if (data.gameState) {
                gameState = data.gameState;

                // Store the full game state including distance condition
                gameData.gameState = data.gameState;

                // Update player positions from game state
                if (data.gameState.playerStates) {
                    for (const [playerId, playerState] of Object.entries(data.gameState.playerStates)) {
                        if (playerId === myPlayerId) {
                            gameData.playerStartPos = playerState.position;
                        } else {
                            gameData.partnerStartPos = playerState.position;
                        }
                    }
                }

                // Update goals if they changed, but preserve locally added new goal
                if (data.gameState.goals) {
                    if (newGoalPresented && newGoalPosition && gameData.currentGoals && gameData.currentGoals.length >= 3) {
                        // Keep the locally modified goals array with the new goal
                    } else {
                        gameData.currentGoals = data.gameState.goals;
                    }
                }

                // Update grid matrix if provided
                if (data.gameState.gridMatrix) {
                    gameData.gridMatrix = data.gameState.gridMatrix;
                }
            }

            // Record the move with goal detection logic
            const moveData = {
                action: data.action,
                reactionTime: data.reactionTime || 0,
                playerId: data.playerId,
                stepCount: data.gameState ? data.gameState.stepCount : gameData.stepCount
            };

            // If this is a partner move, also track it for goal detection
            if (data.playerId !== myPlayerId && data.action) {
                moveData.partnerAction = data.action;
            }

            recordMove(moveData);

            // Update visualization
            updateGameVisualization();

            // Check for trial completion
            if (data.goalReached) {
                console.log('Goal reached by player:', data.playerId);
            }
        });

        socket.on('trial_complete', (data) => {
            console.log(`Trial completed! Success: ${data.success}`);
            handleTrialComplete(data);
        });

        socket.on('new_goal_presented', (data) => {
            console.log('=== SERVER NEW GOAL PRESENTED ===');
            console.log('Server new goal data:', data);
            console.log('Local newGoalPresented:', newGoalPresented);
            console.log('Local newGoalPosition:', newGoalPosition);

            // Always process server new goal since client-side generation is disabled
            if (data.newGoal) {
                console.log('Processing server new goal...');

                // Store the full game state including distance condition
                if (data.gameState) {
                    gameData.gameState = data.gameState;
                    gameState = data.gameState;

                    // Update goals array
                    if (data.gameState.goals) {
                        gameData.currentGoals = data.gameState.goals;
                    }

                    // Update grid matrix
                    if (data.gameState.gridMatrix) {
                        gameData.gridMatrix = data.gameState.gridMatrix;
                    }
                }

                // Update local 2P3G variables
                newGoalPresented = true;
                newGoalPosition = data.newGoal;

                // Record in trial data
                if (gameData.currentTrialData) {
                    gameData.currentTrialData.newGoalPresented = true;
                    gameData.currentTrialData.newGoalPosition = data.newGoal;
                    gameData.currentTrialData.newGoalPresentedTime = gameData.stepCount;

                    // Record distance condition from server
                    if (data.distanceCondition) {
                        gameData.currentTrialData.distanceCondition = data.distanceCondition;
                    }
                }

                console.log('✅ Server new goal processed successfully');
                console.log('Updated goals array:', gameData.currentGoals);
                console.log('Distance condition used:', data.distanceCondition);

                // Show new goal message
                // showNewGoalMessage();

                // Update visualization
                updateGameVisualization();
            } else {
                console.log('❌ Server new goal data missing newGoal position');
            }
        });

        socket.on('move_rejected', (data) => {
            console.log('Move rejected:', data.message);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
            isConnected = false;
            isGameActive = false;
            showErrorMessage(error.message || 'A connection error occurred');
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            isConnected = false;
            isGameActive = false;
        });



        // Handle new goal generated by partner (legacy - kept for compatibility)
        socket.on('partner_new_goal', (data) => {
            console.log('=== PARTNER NEW GOAL RECEIVED (LEGACY) ===');
            console.log('Partner generated new goal:', data);
            console.log('Local newGoalPresented:', newGoalPresented);
            console.log('Local newGoalPosition:', newGoalPosition);
            console.log('My player ID:', myPlayerId);
            console.log('Generated by player:', data.generatedBy);

            // Only process if we haven't already generated a new goal locally
            if (!newGoalPresented) {
                console.log('=== PROCESSING PARTNER GOAL ===');

                // Update local state with partner's goal
                newGoalPosition = data.newGoalPosition;
                newGoalPresented = true;

                // Add new goal to the grid and goals list
                gameData.gridMatrix[newGoalPosition[0]][newGoalPosition[1]] = 2; // OBJECT.goal
                gameData.currentGoals.push(newGoalPosition);

                // Note: Pre-calculation moved to after visual presentation to avoid lag
                // See updateGameVisualization() for the optimized pre-calculation timing

                // Record in trial data
                gameData.currentTrialData.isNewGoalCloserToPlayer2 = data.distanceCondition === 'closer_to_player2';
                gameData.currentTrialData.newGoalPresentedTime = data.stepCount;
                gameData.currentTrialData.newGoalPosition = newGoalPosition;
                gameData.currentTrialData.newGoalConditionType = data.distanceCondition;

                console.log('=== PARTNER GOAL PROCESSED ===');
                console.log('New goal position:', newGoalPosition);
                console.log('New goal presented:', newGoalPresented);
                console.log('Goals list updated:', gameData.currentGoals);

                // Show new goal message
                // showNewGoalMessage();

                // Update visualization
                updateGameVisualization();
            } else {
                console.log('=== IGNORING PARTNER GOAL ===');
                console.log('Already have a new goal locally:', newGoalPosition);
            }
        });

        // Handle server-generated new goal (new server-side logic)
        socket.on('server_new_goal', (data) => {
            console.log('=== SERVER NEW GOAL RECEIVED ===');
            console.log('Server generated new goal:', data);
            console.log('Local newGoalPresented:', newGoalPresented);
            console.log('My player ID:', myPlayerId);

            // Only process if we haven't already presented a new goal
            if (!newGoalPresented) {
                console.log('=== PROCESSING SERVER GOAL ===');

                // Update local state with server's goal
                newGoalPosition = data.newGoalPosition;
                newGoalPresented = true;

                // Add new goal to the grid and goals list
                gameData.gridMatrix[newGoalPosition[0]][newGoalPosition[1]] = 2; // OBJECT.goal
                gameData.currentGoals.push(newGoalPosition);

                // Note: Pre-calculation moved to after visual presentation to avoid lag
                // See updateGameVisualization() for the optimized pre-calculation timing

                // Record in trial data
                gameData.currentTrialData.isNewGoalCloserToPlayer2 = data.distanceCondition === 'closer_to_player2';
                gameData.currentTrialData.newGoalPresentedTime = data.stepCount;
                gameData.currentTrialData.newGoalPosition = newGoalPosition;
                gameData.currentTrialData.newGoalConditionType = data.distanceCondition;

                console.log('=== SERVER GOAL PROCESSED ===');
                console.log('New goal position:', newGoalPosition);
                console.log('New goal presented:', newGoalPresented);
                console.log('Goals list updated:', gameData.currentGoals);

                // Show new goal message
                // showNewGoalMessage();

                // Update visualization
                updateGameVisualization();
            } else {
                console.log('=== IGNORING SERVER GOAL ===');
                console.log('Already have a new goal locally:', newGoalPosition);
            }
        });

        // Add debugging for socket connection
        socket.on('connect', () => {
            console.log('🔍 Socket connected with ID:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('🔍 Socket disconnected');
        });

        socket.on('error', (error) => {
            console.log('🔍 Socket error:', error);
        });

        return true;
    } catch (error) {
        console.error('Failed to initialize socket:', error);
        showServerNotRunningMessage();
        return false;
    }
}

/**
 * Handle room joined
 */
function handleRoomJoined(data) {
    console.log('Room joined data:', data);
    // Check if we need to wait for more players
    if (data.playerCount < 2) {
        updateWaitingStatus('Waiting for another player to join...');
    } else {
        updateWaitingStatus('Both players connected! Preparing to start...');
        // Auto-ready the player since we're in an experiment context
        if (socket) {
            console.log('Sending player_ready event from handleRoomJoined');
            socket.emit('player_ready', {});
        }
    }
}

/**
 * Handle partner joined
 */
function handlePartnerJoined(data) {
    // Both players are now connected, proceed with experiment
    proceedToNextStage();
}

/**
 * Handle partner left
 */
function handlePartnerLeft(data) {
    if (isGameActive) {
        // Show disconnection message and wait for reconnection or new partner
        showPartnerDisconnectedMessage();
    }
}

/**
 * Handle disconnection
 */
function handleDisconnection() {
    isGameActive = false;
    showDisconnectionMessage();
}

/**
 * Join multiplayer room for experiment
 */
function joinMultiplayerRoom() {
    if (!socket || !isConnected) {
        console.error('Not connected to server');
        return false;
    }

    const experimentType = gameData.currentExperiment;
    socket.emit('join_game', {
        gameType: experimentType,
        playerId: myPlayerId
    });

    return true;
}

/**
 * Start multiplayer trial
 */
function startMultiplayerTrial(trialIndex, design) {
    if (!socket || !isConnected) {
        console.error('Cannot start trial: not connected');
        return false;
    }

    socket.emit('start_trial', {
        trialIndex: trialIndex,
        experimentType: gameData.currentExperiment,
        design: design,
        playerId: myPlayerId
    });

    return true;
}

/**
 * Make a move in the multiplayer game
 */
function makeMultiplayerMove(action) {
    if (!isGameActive || !socket || timeline.isMoving || isFrozen) {
        console.log('Move blocked - game not active, no socket, already moving, or frozen');
        return;
    }

    timeline.isMoving = true;

    // Record the move with reaction time
    const reactionTime = Date.now() - gameData.gameStartTime;
    recordPlayerMove(action, reactionTime);

    // Send move to server
    socket.emit('make_move', {
        action: action,
        reactionTime: reactionTime,
        timestamp: Date.now()
    });

    console.log('Move sent to server:', action);
    timeline.isMoving = false;
}

/**
 * Record a move and update game state
 */
function recordMove(data) {
    if (!gameData.currentTrialData) {
        console.warn('No current trial data available');
        return;
    }

    console.log('=== RECORD MOVE DEBUG ===');
    console.log('Move data:', data);
    console.log('myPlayerId:', myPlayerId);
    console.log('data.playerId:', data.playerId);

    // Determine which action belongs to the current player vs partner
    let currentPlayerAction = null;
    let partnerAction = null;

    if (data.playerId === myPlayerId) {
        // This move was made by the current player
        currentPlayerAction = data.action;
        partnerAction = null; // No partner action in this move
        console.log('Move was made by current player');
    } else {
        // This move was made by the partner
        currentPlayerAction = null; // Current player didn't move
        partnerAction = data.action;
        console.log('Move was made by partner');
    }

    console.log('currentPlayerAction:', currentPlayerAction);
    console.log('partnerAction:', partnerAction);

    // Record player move if current player made a move
    if (currentPlayerAction) {
        var reactionTime = Date.now() - gameData.currentTrialData.startTime;
        recordPlayerMove(currentPlayerAction, reactionTime);
    }

    // Record partner move if partner made a move
    if (partnerAction) {
        var reactionTime = Date.now() - gameData.currentTrialData.startTime;
        recordPartnerMove(partnerAction, reactionTime);
    }

    // Update step count
    gameData.stepCount++;

    // Handle 2P3G specific logic
    if (gameData.currentExperiment === '2P3G') {
        // Initialize goal tracking arrays if not already done
        if (!gameData.currentTrialData.player1CurrentGoal) {
            gameData.currentTrialData.player1CurrentGoal = [];
            gameData.currentTrialData.player2CurrentGoal = [];
        }

        // Determine which player is which based on player order
        const isFirstPlayer = playerOrder.isFirstPlayer;
        const firstPlayerPos = isFirstPlayer ? gameData.playerStartPos : gameData.partnerStartPos;
        const secondPlayerPos = isFirstPlayer ? gameData.partnerStartPos : gameData.playerStartPos;
        const firstPlayerAction = isFirstPlayer ? currentPlayerAction : partnerAction;
        const secondPlayerAction = isFirstPlayer ? partnerAction : currentPlayerAction;
        const firstPlayerGoalHistory = isFirstPlayer ? player1InferredGoals : player2InferredGoals;
        const secondPlayerGoalHistory = isFirstPlayer ? player2InferredGoals : player1InferredGoals;

        // Detect first player's goal (always red player)
        if (firstPlayerAction) {
            const firstPlayerGoal = detectPlayerGoal(firstPlayerPos, firstPlayerAction, gameData.currentGoals, firstPlayerGoalHistory);
            gameData.currentTrialData.player1CurrentGoal.push(firstPlayerGoal);
            console.log('First player (red) moved, detected goal:', firstPlayerGoal);

            // Update goal history
            if (firstPlayerGoal !== null) {
                firstPlayerGoalHistory.push(firstPlayerGoal);
            }
        } else {
            // First player didn't move, maintain previous goal detection
            const previousFirstPlayerGoal = gameData.currentTrialData.player1CurrentGoal.length > 0 ?
                gameData.currentTrialData.player1CurrentGoal[gameData.currentTrialData.player1CurrentGoal.length - 1] : null;
            gameData.currentTrialData.player1CurrentGoal.push(previousFirstPlayerGoal);
            console.log('First player (red) didn\'t move, maintaining previous goal:', previousFirstPlayerGoal);
        }

        // Detect second player's goal (always orange player)
        if (secondPlayerAction && secondPlayerPos) {
            const secondPlayerGoal = detectPlayerGoal(secondPlayerPos, secondPlayerAction, gameData.currentGoals, secondPlayerGoalHistory);
            gameData.currentTrialData.player2CurrentGoal.push(secondPlayerGoal);
            console.log('Second player (orange) moved, detected goal:', secondPlayerGoal);

            // Update goal history
            if (secondPlayerGoal !== null) {
                secondPlayerGoalHistory.push(secondPlayerGoal);
            }
        } else {
            // Second player didn't move, maintain previous goal detection
            const previousSecondPlayerGoal = gameData.currentTrialData.player2CurrentGoal.length > 0 ?
                gameData.currentTrialData.player2CurrentGoal[gameData.currentTrialData.player2CurrentGoal.length - 1] : null;
            gameData.currentTrialData.player2CurrentGoal.push(previousSecondPlayerGoal);
            console.log('Second player (orange) didn\'t move, maintaining previous goal:', previousSecondPlayerGoal);
        }

        // Check for new goal presentation
        checkNewGoalPresentation2P3G();

        // Check trial end for 2P3G
        checkTrialEnd2P3G();
    }
}

/**
 * Handle trial complete
 */
function handleTrialComplete(data) {
    isGameActive = false;
    finalizeTrial(data.success);

    // Show collaboration feedback directly on the game board for 2P experiments
    const experimentType = gameData.currentExperiment;
    if (experimentType.includes('2P') && data.success !== undefined) {
        showCollaborationFeedbackOnGameBoard(data.success);
    }

    // Use the same logic as post-trial stage for transitioning
    setTimeout(() => {
        const currentTrial = gameData.currentTrial;

        // Check if we should end the experiment early due to success threshold
        if (shouldEndExperimentDueToSuccessThreshold()) {
            // Skip to the end of this experiment by finding the next experiment or completion stage
            skipToNextExperimentOrCompletion();
        } else {
            // For collaboration games, check if we should continue to next trial
            if (experimentType.includes('2P') && NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.enabled) {
                if (shouldContinueToNextTrial(experimentType, currentTrial)) {
                    // Skip post-trial stage and go directly to next fixation stage
                    skipToNextFixationStage();
                } else {
                    // End this experiment and move to next
                    skipToNextExperimentOrCompletion();
                }
            } else {
                nextStage();
            }
        }
    }, NODEGAME_HUMAN_HUMAN_CONFIG.timing.feedbackDisplayDuration);
}

// =================================================================================================
// EXPERIMENT FLOW AND STAGES (matching human-AI version)
// =================================================================================================

/**
 * Initialize NodeGame Human-Human Full Experiments
 */
function initializeNodeGameHumanHumanFullExperiments() {
    console.log('Initializing NodeGame Human-Human Full Experiments');

    // Initialize socket connection
    const socketInitialized = initializeSocket();
    if (!socketInitialized) {
        console.error('Failed to initialize socket connection');
        return false;
    }

    // Initialize success threshold tracking
    initializeSuccessThresholdTracking();

    // Create timeline stages
    createTimelineStages();

    console.log('Human-Human experiments initialized successfully');
    return true;
}

/**
 * Start NodeGame Human-Human experiment
 */
function startNodeGameHumanHumanExperiment(experimentType) {
    console.log('Starting Human-Human experiment with type:', experimentType);

    // Reset all data
    resetExperimentData();

    // Set current experiment
    gameData.currentExperiment = NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder[0];
    gameData.currentExperimentIndex = 0;
    gameData.currentTrial = 0;

    // Start timeline
    timeline.currentStage = 0;
    runNextStage();

    return true;
}

/**
 * Create timeline stages (based on human-AI version)
 */
function createTimelineStages() {
    timeline.stages = [
        // {
        //     type: 'consent',
        //     name: 'consent',
        //     handler: showConsentStage
        // },
        {
            type: 'welcome',
            name: 'welcome',
            experimentType: NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder[0], // Use first experiment type for welcome
            handler: showWelcomeStage
        },
        // {
        //     type: 'instructions',
        //     name: 'instructions',
        //     experimentType: NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder[0], // Use first experiment type for instructions
        //     handler: showInstructionsStage
        // },
        {
            type: 'waiting_for_partner',
            name: 'waiting_for_partner',
            handler: showWaitingForPartnerStage
        }
    ];

    // Add experiment stages for each experiment type
    NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder.forEach((experimentType, experimentIndex) => {
        addExperimentStages(experimentType, experimentIndex);
    });

    // Add final stages
    timeline.stages.push(
        {
            type: 'questionnaire',
            name: 'questionnaire',
            handler: showQuestionnaireStage
        },
        {
            type: 'completion',
            name: 'completion',
            handler: showCompletionStage
        }
    );

    console.log(`Created timeline with ${timeline.stages.length} stages`);
}

/**
 * Add experiment stages for a specific experiment type
 */
function addExperimentStages(experimentType, experimentIndex) {
    const maxTrials = NODEGAME_HUMAN_HUMAN_CONFIG.numTrials[experimentType];

    for (let trialIndex = 0; trialIndex < maxTrials; trialIndex++) {
        // Pre-trial stage
        // timeline.stages.push({
        //     type: 'pre_trial',
        //     name: `pre_trial_${experimentType}_${trialIndex}`,
        //     experimentType: experimentType,
        //     experimentIndex: experimentIndex,
        //     trialIndex: trialIndex,
        //     handler: showPreTrialStage
        // });

        // Fixation stage
        timeline.stages.push({
            type: 'fixation',
            name: `fixation_${experimentType}_${trialIndex}`,
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showFixationStage
        });

        // Trial stage
        timeline.stages.push({
            type: 'trial',
            name: `trial_${experimentType}_${trialIndex}`,
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: runTrialStage
        });

        // Post-trial stage
        timeline.stages.push({
            type: 'post_trial',
            name: `post_trial_${experimentType}_${trialIndex}`,
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showPostTrialStage
        });
    }
}

/**
 * Run next stage in timeline
 */
function runNextStage() {
    if (timeline.currentStage >= timeline.stages.length) {
        console.log('All stages completed');
        return;
    }

    const stage = timeline.stages[timeline.currentStage];
    console.log(`Running stage ${timeline.currentStage}: ${stage.name} (${stage.type})`);

    // Update current experiment data if stage has experiment info
    if (stage.experimentType) {
        gameData.currentExperiment = stage.experimentType;
        gameData.currentExperimentIndex = stage.experimentIndex;
        gameData.currentTrial = stage.trialIndex;
    }

    // Run stage handler
    if (stage.handler) {
        stage.handler(stage);
    } else {
        console.warn(`No handler for stage: ${stage.name}`);
        nextStage();
    }
}

/**
 * Proceed to next stage
 */
function nextStage() {
    // Reset trial stage flag when moving to next stage
    timeline.inTrialStage = false;
    timeline.currentStage++;
    runNextStage();
}

/**
 * Proceed to next stage (alias for compatibility)
 */
function proceedToNextStage() {
    nextStage();
}

// =================================================================================================
// STAGE HANDLERS (based on human-AI version)
// =================================================================================================

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

    checkbox.addEventListener('change', function() {
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

    continueBtn.addEventListener('click', function() {
        if (!this.disabled) {
            nextStage();
        }
    });
}

/**
 * Show welcome stage
 */
function showWelcomeStage(stage) {
    const container = document.getElementById('container');
    const experimentType = stage.experimentType;
    const welcomeMessage = getWelcomeMessage(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 700px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                ${welcomeMessage}
            </div>
        </div>
    `;

    // Set up spacebar handler (matching human-AI version)
    function handleKeyPress(event) {
        if (event.code === 'Space') {
            event.preventDefault();
            document.removeEventListener('keydown', handleKeyPress);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();
}

/**
 * Get welcome message for experiment type (matching human-AI version exactly)
 */
function getWelcomeMessage(experimentType) {
    switch(experimentType) {
        case '1P1G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-1-Goal Task. Press space bar to begin.</p>';
        case '1P2G':
            return '<p style="font-size:30px;">Welcome to the 1-Player-2-Goals Task. Press any key to begin.</p>';
        case '2P2G':
            return '<p style="font-size:30px;">Welcome to the 2-Player-2-Goals Task. Press any key to begin.</p>';
        case '2P3G':
            return `
                <p style="font-size:24px; color: #333; margin-top: 30px;">
                    The game rules have been updated!
                </p>
                <p style="font-size:22px; color: #333; margin-top: 20px;">
                    In this game, a new restaurant will open during the game. This restaurant is the same as the previous two restaurants, and you can choose any of the three!
                </p>
                <p style="font-size:24px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
            `;
        default:
            return '<p style="font-size:30px;">Welcome to the task. Press space bar to begin.</p>';
    }
}

/**
 * Show instructions stage
 */
function showInstructionsStage(stage) {
    const container = document.getElementById('container');
    const experimentType = stage.experimentType;
    const instructions = getInstructionsForExperiment(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 700px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                ${instructions}
            </div>
        </div>
    `;

    // Set up spacebar handler (matching human-AI version)
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
 * Get instructions for experiment type (matching human-AI version exactly)
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
 * Show waiting for partner stage
 */
function showWaitingForPartnerStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 30px;">Finding Your Partner...</h1>

                <div style="margin: 40px 0;">
                    <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>

                <div style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    <p>Please wait while we match you with another participant.</p>
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

                <button onclick="handleWaitingCancel()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 5px; cursor: pointer;">
                    Cancel and Exit
                </button>
            </div>
        </div>

        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    // Try to join multiplayer room
    setTimeout(() => {
        if (joinMultiplayerRoom()) {
            updateWaitingStatus('Looking for another participant...');
        } else {
            updateWaitingStatus('Connection failed. Please refresh the page.');
        }
    }, 1000); // Wait a moment for socket to be ready

    // Make function globally available
    window.handleWaitingCancel = function() {
        if (socket) {
            socket.disconnect();
        }
        window.close();
    };
}

/**
 * Update waiting status
 */
function updateWaitingStatus(message) {
    const statusElement = document.getElementById('waitingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Show partner disconnected message
 */
function showPartnerDisconnectedMessage() {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">Partner Disconnected</h1>

                <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    <p>Your partner has left the experiment.</p>
                    <p>We're looking for a new partner for you...</p>
                </div>

                <div style="margin: 40px 0;">
                    <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>

                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                    Reconnect
                </button>

                <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Exit Experiment
                </button>
            </div>
        </div>

        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
}

/**
 * Show disconnection message
 */
function showDisconnectionMessage() {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">Connection Lost</h1>

                <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    <p>The connection to the server has been lost.</p>
                    <p>Please check your internet connection and try again.</p>
                </div>

                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                    Reconnect
                </button>

                <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Exit Experiment
                </button>
            </div>
        </div>
    `;
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">Error</h1>

                <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    <p>${message}</p>
                </div>

                <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                    Retry
                </button>

                <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Exit
                </button>
            </div>
        </div>
    `;
}

/**
 * Show server not running message
 */
function showServerNotRunningMessage() {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 700px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px;">
                <h1 style="color: #dc3545; text-align: center; margin-bottom: 30px;">🔌 Server Not Running</h1>

                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin-bottom: 30px;">
                    <h3 style="color: #721c24; margin-top: 0;">The Human-Human Experiment Server is Not Started</h3>
                    <p style="color: #721c24; margin-bottom: 0;">
                        The human-human version requires a Socket.io server for real-time multiplayer functionality.
                    </p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 20px; margin-bottom: 30px;">
                    <h3 style="color: #155724; margin-top: 0;">How to Start the Server:</h3>
                    <ol style="color: #155724; margin-bottom: 10px;">
                        <li>Open a terminal/command prompt</li>
                        <li>Navigate to the project directory</li>
                        <li>Run: <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">npm start</code></li>
                        <li>Wait for "Server running on port 3000" message</li>
                        <li>Refresh this page</li>
                    </ol>
                    <p style="color: #155724; margin-bottom: 0; font-size: 14px;">
                        <strong>Note:</strong> You'll need two browser windows/tabs to test the multiplayer functionality.
                    </p>
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-bottom: 30px;">
                    <h4 style="color: #856404; margin-top: 0;">Alternative: Try the Human-AI Version</h4>
                    <p style="color: #856404; margin-bottom: 10px;">
                        If you want to test the experiment without setting up multiplayer, you can use the human-AI version instead.
                    </p>
                    <button onclick="window.location.href='test_human-AI version.html'" style="background: #ffc107; color: #212529; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        Go to Human-AI Version
                    </button>
                </div>

                <div style="text-align: center;">
                    <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer; margin-right: 10px;">
                        Try Again
                    </button>

                    <button onclick="window.location.href='index.html'" style="background: #6c757d; color: white; border: none; padding: 12px 24px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                        Back to Main Page
                    </button>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #6c757d;">
                    <h4>Technical Details:</h4>
                    <ul>
                        <li>Server file: <code>server.js</code></li>
                        <li>Default port: <code>3000</code></li>
                        <li>Required dependencies: <code>express</code>, <code>socket.io</code></li>
                        <li>Install command: <code>npm install</code></li>
                        <li>Start command: <code>npm start</code> or <code>node server.js</code></li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// =================================================================================================
// TRIAL STAGES (continuing in next part due to length...)
// =================================================================================================

/**
 * Show pre-trial stage
 */
function showPreTrialStage(stage) {
    const experimentType = stage.experimentType;
    const trialIndex = stage.trialIndex;
    const maxTrials = NODEGAME_HUMAN_HUMAN_CONFIG.numTrials[experimentType];

    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 700px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 20px;">Trial ${trialIndex + 1} of ${maxTrials}</h1>
                <h2 style="color: #007bff; margin-bottom: 30px;">${getExperimentDisplayName(experimentType)}</h2>

                <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    <p>Get ready to work with your partner!</p>
                    <p>Remember: ${getExperimentInstructions(experimentType)}</p>
                </div>

                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 30px;">
                    <p style="margin: 0; font-size: 16px; color: #495057;">
                        Both players need to be ready. You'll automatically proceed when both are prepared.
                    </p>
                </div>

                <div id="readyStatus" style="font-size: 16px; color: #007bff; margin-bottom: 20px;">
                    Waiting for both players to be ready...
                </div>
            </div>
        </div>
    `;

    // Auto-proceed after a short delay
    setTimeout(() => {
        nextStage();
    }, NODEGAME_HUMAN_HUMAN_CONFIG.timing.preTrialDisplayDuration);
}

/**
 * Show fixation stage
 */
function showFixationStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
            </div>
        </div>
    `;

    // Create and draw canvas with fixation display matching human-AI version
    const canvas = createGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);
    drawFixationDisplayHumanHuman(canvas);

    setTimeout(() => {
        nextStage();
    }, NODEGAME_HUMAN_HUMAN_CONFIG.timing.fixationDuration);
}

/**
 * Run trial stage
 */
function runTrialStage(stage) {
    const experimentType = stage.experimentType;
    const trialIndex = stage.trialIndex;

    console.log(`Running trial ${trialIndex} for experiment ${experimentType}`);

    // Initialize client-side trial data tracking
    initializeTrialData(trialIndex, experimentType);

    // The game design and state are determined by the server and have already been
    // populated in the `game_started` event handler.
    // We just need to render it and enable controls.

    // Setup trial visualization using the data from the server
    setupTrialVisualization(experimentType);

    // Game started - controls are already shown below the canvas
    // The game is already active from the `game_started` event.
    // We just need to enable keyboard controls for this client.
    isGameActive = true;
    setupKeyboardControls();
    console.log('Trial running, keyboard controls enabled.');
}

/**
 * Setup trial visualization
 */
function setupTrialVisualization(experimentType) {
    const container = document.getElementById('container');

    // Match the exact human-AI version layout
    const playerColor = playerOrder.isFirstPlayer ? 'red' : 'orange';
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment: ${getExperimentDisplayName(experimentType)}</h3>
                <h4 style="margin-bottom: 20px;">Trial ${gameData.currentTrial + 1}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px; position: relative;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: ${playerColor}; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Setup canvas and game visualization
    console.log('Setting up trial visualization...');
    const canvasContainer = document.getElementById('gameCanvas');
    console.log('Canvas container found in setup:', !!canvasContainer);

    if (canvasContainer) {
        // Create canvas for game visualization
        const canvas = createGameCanvas();
        canvasContainer.appendChild(canvas);

        console.log('Canvas created and added to container');

        // Initial render
        updateGameVisualization();
    } else {
        console.error('gameCanvasContainer not found!');
    }
}

/**
 * Setup keyboard controls
 */
function setupKeyboardControls() {
    // Remove existing listeners to prevent duplicates
    cleanupKeyboardControls();

    // Add new listener
    document.addEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = true;

    console.log('Keyboard controls enabled');
}

/**
 * Cleanup keyboard controls
 */
function cleanupKeyboardControls() {
    document.removeEventListener('keydown', handleKeyPress);
    timeline.keyListenerActive = false;
    console.log('Keyboard controls disabled');
}

/**
 * Handle key press
 */
function handleKeyPress(event) {
    if (!isGameActive || timeline.isMoving || isFrozen) {
        if (isFrozen) {
            console.log('Movement blocked - freeze period active');
        }
        return;
    }

    const key = event.code;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        return;
    }

    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();

    // Convert key to action (server expects string format)
    let action;
    switch (key) {
        case 'ArrowUp':
            action = 'up';
            break;
        case 'ArrowDown':
            action = 'down';
            break;
        case 'ArrowLeft':
            action = 'left';
            break;
        case 'ArrowRight':
            action = 'right';
            break;
        default:
            return;
    }

    // Check if player has already reached a goal (for 2P2G and 2P3G)
    if (gameData.currentExperiment && (gameData.currentExperiment === '2P2G' || gameData.currentExperiment === '2P3G')) {
        if (isGoalReached(gameData.playerStartPos, gameData.currentGoals)) {
            console.log('Player already reached goal, movement blocked');
            return;
        }
    }

    console.log('Processing key press:', key, 'Action:', action);
    makeMultiplayerMove(action);
}

/**
 * Check if a player has reached any goal (matching human-AI version)
 */
function isGoalReached(playerPos, goals) {
    if (!playerPos || !goals || !Array.isArray(goals)) {
        return false;
    }

    for (let i = 0; i < goals.length; i++) {
        if (playerPos[0] === goals[i][0] && playerPos[1] === goals[i][1]) {
            return true;
        }
    }
    return false;
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
 * Attempt to reconnect to the server
 */
function attemptReconnection() {
    console.log('Attempting to reconnect...');

    if (socket) {
        socket.disconnect();
    }

    // Reinitialize socket connection
    const socketInitialized = initializeSocket();
    if (socketInitialized) {
        // Try to rejoin the game
        setTimeout(() => {
            if (gameData.currentExperiment) {
                joinMultiplayerRoom();
            }
        }, 1000);
    }
}

// Make functions globally available
window.attemptReconnection = attemptReconnection;

/**
 * Remove game board canvas (cleanup function)
 */
function removeGameBoard() {
    const canvas = document.querySelector('#gameCanvas');
    if (canvas) {
        canvas.remove();
    }
}

/**
 * Update game visualization
 */
function updateGameVisualization() {
    // For human-human multiplayer, always use our custom fallback rendering
    // The vizWithAI.js functions don't work properly for real-time multiplayer
    renderGameBoardFallback();

    // Pre-calculate RL policy only when a new goal is first displayed (after rendering)
    if (window.RLAgent && window.RLAgent.precalculatePolicyForGoals && gameData.currentGoals && gameData.currentGoals.length > 0) {
        // Check if this is a new goal presentation (3 goals instead of 2) and hasn't been pre-calculated yet
        if (gameData.currentGoals.length === 3 && !window.newGoalPreCalculated) {
            console.log('⚡ New goal rendered on map, pre-calculating 16-action policy (human-human):', gameData.currentGoals);
            window.RLAgent.precalculatePolicyForGoals(gameData.currentGoals);
            window.newGoalPreCalculated = true; // Mark as pre-calculated
        }
    }
}

/**
 * Create game canvas
 */
function createGameCanvas() {
    // Use the exact same parameters as the human-AI version
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';

    // Use WINSETTING dimensions like human-AI version
    canvas.width = WINSETTING.w;
    canvas.height = WINSETTING.h;

    canvas.style.border = '2px solid #333';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.marginLeft = 0;
    canvas.style.marginTop = 0;

    console.log('Created canvas with ID:', canvas.id, 'Size:', canvas.width, 'x', canvas.height);
    return canvas;
}

/**
 * Fallback rendering function using exact human-AI version parameters
 */
function renderGameBoardFallback() {
    // First try to find the canvas by ID
    let canvas = document.getElementById('gameCanvas');

    // If not found by ID, try to find canvas inside the gameCanvas container
    if (!canvas || canvas.tagName !== 'CANVAS') {
        const canvasContainer = document.getElementById('gameCanvas');
        if (canvasContainer) {
            canvas = canvasContainer.querySelector('canvas');
        }
    }

    // If still not found, try to find any canvas
    if (!canvas || canvas.tagName !== 'CANVAS') {
        canvas = document.querySelector('canvas');
    }

    if (!canvas || canvas.tagName !== 'CANVAS') {
        // If still no canvas, create one in the game container
        const canvasContainer = document.getElementById('gameCanvas');

        if (canvasContainer) {
            canvas = createGameCanvas();
            canvasContainer.appendChild(canvas);
        } else {
            console.error('No canvas container found for rendering');
            return;
        }
    }

    // Ensure we have a valid canvas element
    if (!canvas || typeof canvas.getContext !== 'function') {
        console.error('Invalid canvas element');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Use exact same parameters as human-AI version
    canvas.width = WINSETTING.w;
    canvas.height = WINSETTING.h;
    canvas.style.marginLeft = 0;
    canvas.style.marginTop = 0;

    // Draw background using COLORPOOL.line like human-AI version
    ctx.fillStyle = COLORPOOL.line;
    ctx.fillRect(0 - EXPSETTINGS.padding,
        0 - EXPSETTINGS.padding,
        WINSETTING.w + EXPSETTINGS.padding,
        WINSETTING.h + EXPSETTINGS.padding);

    // Draw grid background using exact human-AI parameters (first pass: everything except goals and players)
    const gridSize = EXPSETTINGS.matrixsize;
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const x = col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding;
            const y = row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding;

            // Check if this cell is an obstacle
            let cellValue = 0; // Default to empty
            if (gameData.gridMatrix && gameData.gridMatrix[row] && gameData.gridMatrix[row][col] !== undefined) {
                cellValue = gameData.gridMatrix[row][col];
            }

            // Use COLORPOOL colors like human-AI version
            if (cellValue === 1) { // OBJECT.obstacle
                ctx.fillStyle = COLORPOOL.obstacle; // black
            } else {
                ctx.fillStyle = COLORPOOL.map; // white
            }

            ctx.fillRect(x, y, EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
        }
    }

    // Second pass: draw players with overlap detection (like human-AI version)
    if (gameData.playerStartPos && gameData.partnerStartPos &&
        gameData.playerStartPos.length >= 2 && gameData.partnerStartPos.length >= 2) {

        // Check if players are in the same position
        if (gameData.playerStartPos[0] === gameData.partnerStartPos[0] &&
            gameData.playerStartPos[1] === gameData.partnerStartPos[1]) {
            // Draw overlapping circles
            drawOverlappingCirclesHumanHuman(ctx, gameData.playerStartPos[1], gameData.playerStartPos[0]);
        } else {
                        // Determine colors based on player order
            let myColor, partnerColor;
            if (playerOrder.isFirstPlayer) {
                // I am the first player (red), partner is second (orange)
                myColor = COLORPOOL.player; // red
                partnerColor = "orange";
            } else {
                // I am the second player (orange), partner is first (red)
                myColor = "orange";
                partnerColor = COLORPOOL.player; // red
            }

            // Draw my player
            drawCircleHumanHuman(ctx, myColor, 1/3 * EXPSETTINGS.padding,
                gameData.playerStartPos[1], gameData.playerStartPos[0], 0, 2 * Math.PI);

            // Draw partner
            drawCircleHumanHuman(ctx, partnerColor, 1/3 * EXPSETTINGS.padding,
                gameData.partnerStartPos[1], gameData.partnerStartPos[0], 0, 2 * Math.PI);
        }
    } else if (gameData.playerStartPos && gameData.playerStartPos.length >= 2) {
        // Only draw player
        let myColor = playerOrder.isFirstPlayer ? COLORPOOL.player : "orange";
        drawCircleHumanHuman(ctx, myColor, 1/3 * EXPSETTINGS.padding,
            gameData.playerStartPos[1], gameData.playerStartPos[0], 0, 2 * Math.PI);
    } else if (gameData.partnerStartPos && gameData.partnerStartPos.length >= 2) {
        // Only draw partner
        let partnerColor = playerOrder.isFirstPlayer ? "orange" : COLORPOOL.player;
        drawCircleHumanHuman(ctx, partnerColor, 1/3 * EXPSETTINGS.padding,
            gameData.partnerStartPos[1], gameData.partnerStartPos[0], 0, 2 * Math.PI);
    }

    // Third pass: ALWAYS draw goals at their intended positions (matching human-AI version)
    // This ensures goals are always shown even if they were overwritten in the matrix
    if (gameData.currentGoals && Array.isArray(gameData.currentGoals)) {
        ctx.fillStyle = COLORPOOL.goal;
        ctx.globalAlpha = 0.5; // Make it more transparent for overlay (matching human-AI)

        // Draw all goals (supports 2 or 3 goals)
        gameData.currentGoals.forEach((goal, index) => {
            if (goal && goal.length >= 2) {
                const x = goal[1] * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding;
                const y = goal[0] * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding;

                ctx.fillRect(x, y, EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
            }
        });

        ctx.globalAlpha = 1.0; // Reset transparency
    } else {
        console.log('=== NO GOALS TO DRAW ===');
        console.log('Goals array is invalid:', gameData.currentGoals);
    }
}

/**
 * Draw fixation display matching exact human-AI version parameters
 */
function drawFixationDisplayHumanHuman(canvas) {
    const context = canvas.getContext("2d");
    canvas.width = WINSETTING.w;
    canvas.height = WINSETTING.h;

    canvas.style.marginLeft = 0;
    canvas.style.marginTop = 0;

    // Draw background using COLORPOOL.line like human-AI version
    context.fillStyle = COLORPOOL.line;
    context.fillRect(0 - EXPSETTINGS.padding,
        0 - EXPSETTINGS.padding,
        WINSETTING.w + EXPSETTINGS.padding,
        WINSETTING.h + EXPSETTINGS.padding);

    // Draw empty grid (all cells as map color) like human-AI version
    for (let row = 0; row < EXPSETTINGS.matrixsize; row++) {
        for (let col = 0; col < EXPSETTINGS.matrixsize; col++) {
            context.fillStyle = COLORPOOL.map;
            context.fillRect(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
                EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);
        }
    }

    // Draw fixation cross in center like human-AI version
    drawFixationCrossHumanHuman(context, [Math.floor(EXPSETTINGS.matrixsize/2), Math.floor(EXPSETTINGS.matrixsize/2)], 1/5, 2 * EXPSETTINGS.padding);
}

/**
 * Draw fixation cross matching exact human-AI version parameters
 */
function drawFixationCrossHumanHuman(context, fixationPos, posScale, lineWidth) {
    let col = fixationPos[1];
    let row = fixationPos[0];
    context.lineWidth = lineWidth;
    context.strokeStyle = COLORPOOL.fixation;

    context.beginPath();
    // Horizontal line
    context.moveTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + posScale * EXPSETTINGS.cellSize,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + 1/2 * EXPSETTINGS.cellSize);
    context.lineTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + (1-posScale) * EXPSETTINGS.cellSize,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + 1/2 * EXPSETTINGS.cellSize);

    // Vertical line
    context.moveTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + 1/2 * EXPSETTINGS.cellSize + EXPSETTINGS.padding,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + posScale * EXPSETTINGS.cellSize + EXPSETTINGS.padding);
    context.lineTo(col * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + 1/2 * EXPSETTINGS.cellSize + EXPSETTINGS.padding,
        row * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + (1-posScale) * EXPSETTINGS.cellSize + EXPSETTINGS.padding);
    context.stroke();
}

/**
 * Draw circle function matching exact human-AI version parameters
 */
function drawCircleHumanHuman(context, color, lineWidth, colPos, rowPos, startAngle, tmpAngle) {
    // First draw white background (like human-AI version)
    context.fillStyle = COLORPOOL.map;
    context.fillRect(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);

    // Use exact same circle radius as human-AI version
    const circleRadius = EXPSETTINGS.cellSize * 0.4;

    // Then draw circle with exact human-AI parameters
    context.beginPath();
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.arc(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2,
        circleRadius,
        startAngle, tmpAngle);
    context.fill();
    context.stroke();
}



/**
 * Show new goal message (matching human-AI version)
 */
function showNewGoalMessage() {
    // Find the game canvas container
    var gameCanvas = document.querySelector('#gameCanvas');

    if (!gameCanvas) {
        console.warn('Game canvas container not found for new goal message');
        // Try alternative selectors
        var alternativeCanvas = document.querySelector('.game-container') || document.querySelector('.trial-container');
        if (alternativeCanvas) {
            gameCanvas = alternativeCanvas;
        } else {
            return;
        }
    }

    // Create message element
    var messageElement = document.createElement('div');
    messageElement.id = 'newGoalMessage';
    messageElement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.95);
        border: 4px solid #000000;
        border-radius: 15px;
        padding: 20px 30px;
        font-size: 32px;
        font-weight: bold;
        color: #ffffff;
        text-align: center;
        box-shadow: 0 8px 16px rgba(0,0,0,0.5);
        z-index: 9999;
        animation: fadeInOut 3s ease-in-out;
    `;
    messageElement.textContent = '🎯 NEW GOAL APPEARED! 🎯';

    // Add CSS animation for fade in/out effect
    var style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            10% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `;
    document.head.appendChild(style);

    // Add message to the body instead of canvas container for better visibility
    document.body.appendChild(messageElement);

    // Remove message after duration
    setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
        // Remove the style element as well
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, TWOP3G_CONFIG.newGoalMessageDuration);
}

/**
 * Show collaboration feedback directly on the game board
 */
function showCollaborationFeedbackOnGameBoard(success) {
    const canvasContainer = document.getElementById('gameCanvas');
    if (!canvasContainer) {
        console.error('Game canvas container not found for collaboration feedback');
        return;
    }

    // Determine collaboration success
    const collaborationSucceeded = success;

    // Create overlay div positioned absolutely over the canvas
    const overlay = document.createElement('div');
    overlay.innerHTML = `
        <div style="
            text-align: center;
            background: rgba(255, 255, 255, 0.95);
            border: 3px solid ${collaborationSucceeded ? '#28a745' : '#dc3545'};
            border-radius: 15px;
            padding: 30px 40px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(5px);
        ">
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 20px; color: ${collaborationSucceeded ? '#28a745' : '#dc3545'};">
                ${collaborationSucceeded ? 'Collaboration succeeded!' : 'Collaboration failed!'}
            </div>
            <div style="display: flex; justify-content: center; margin: 30px 0;">
                <div style="
                    width: 120px;
                    height: 120px;
                    background-color: ${collaborationSucceeded ? '#28a745' : '#dc3545'};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                ">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        ${collaborationSucceeded ?
                            '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>' :
                            '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="white"/>'
                        }
                    </svg>
                </div>
            </div>
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

    // Add overlay to the canvas container
    canvasContainer.appendChild(overlay);

    console.log(`Collaboration feedback shown on game board: ${collaborationSucceeded ? 'success' : 'failure'}`);
}

/**
 * Show post-trial stage
 */
function showPostTrialStage(stage) {
    const trialData = gameData.currentTrialData;
    const success = trialData ? trialData.success : false;
    const experimentType = stage.experimentType;
    const trialIndex = stage.trialIndex;
    const experimentIndex = stage.experimentIndex;

    // For collaboration games, show dynamic trial count
    let trialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.enabled) {
        trialCountDisplay = `Trial ${trialIndex + 1} (${gameData.successThreshold.totalTrialsCompleted + 1} total)`;
    } else {
        trialCountDisplay = `Trial ${trialIndex + 1} of ${NODEGAME_HUMAN_HUMAN_CONFIG.numTrials[experimentType]}`;
    }

    const message = success ? 'Goal reached!' : 'Time up!';
    const color = success ? 'green' : 'orange';

    // Match exact human-AI version layout
    const container = document.getElementById('container');
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

    // Create and draw canvas with final state (matching human-AI version)
    const canvas = createGameCanvas();
    const canvasContainer = document.getElementById('gameCanvas');
    canvasContainer.appendChild(canvas);

    // Ensure the canvas shows the final game state
    // Use a small delay to ensure the canvas is properly created
    setTimeout(() => {
        // Render the final game state
        updateGameVisualization();
    }, 200); // Increased delay to ensure canvas is fully rendered

    // Auto-advance after configurable duration (matching human-AI version exactly)
    setTimeout(() => {
        // Check if we should end the experiment early due to success threshold
        if (shouldEndExperimentDueToSuccessThreshold()) {
            // Skip to the end of this experiment by finding the next experiment or completion stage
            skipToNextExperimentOrCompletion();
        } else {
            // For collaboration games, check if we should continue to next trial
            if (experimentType.includes('2P') && NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.enabled) {
                if (shouldContinueToNextTrial(experimentType, trialIndex)) {
                    // Continue to next trial
                    nextStage();
                } else {
                    // End this experiment and move to next
                    skipToNextExperimentOrCompletion();
                }
            } else {
                nextStage();
            }
        }
    }, NODEGAME_HUMAN_HUMAN_CONFIG.timing.feedbackDisplayDuration);
}



/**
 * Skip to next fixation stage (skip post-trial stage)
 */
function skipToNextFixationStage() {
    const currentExpIndex = gameData.currentExperimentIndex;
    const currentTrial = gameData.currentTrial;
    const currentExperimentType = gameData.currentExperiment;

    // Find the next fixation stage
    for (let i = timeline.currentStage; i < timeline.stages.length; i++) {
        const stage = timeline.stages[i];
        if (stage.type === 'fixation' &&
            stage.experimentType === currentExperimentType &&
            stage.experimentIndex === currentExpIndex &&
            stage.trialIndex === currentTrial + 1) {
            timeline.currentStage = i;
            runNextStage();
            return;
        }
    }

    // If next fixation stage not found, try to find next experiment
    console.log('Next fixation stage not found, trying next experiment');
    skipToNextExperimentOrCompletion();
}

/**
 * Skip to next experiment or completion
 */
function skipToNextExperimentOrCompletion() {
    const currentExpIndex = gameData.currentExperimentIndex;
    const totalExperiments = NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder.length;

    if (currentExpIndex + 1 < totalExperiments) {
        // Move to next experiment
        gameData.currentExperimentIndex++;
        gameData.currentExperiment = NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder[gameData.currentExperimentIndex];
        gameData.currentTrial = 0;

        // Skip to next experiment stages in timeline
        skipToNextExperiment();
    } else {
        // All experiments complete, go to questionnaire
        skipToQuestionnaire();
    }
}

/**
 * Skip to next experiment in timeline
 */
function skipToNextExperiment() {
    // Find the first stage of the next experiment
    const nextExperimentType = gameData.currentExperiment;
    const nextExperimentIndex = gameData.currentExperimentIndex;

    for (let i = timeline.currentStage; i < timeline.stages.length; i++) {
        const stage = timeline.stages[i];
        if (stage.experimentType === nextExperimentType &&
            stage.experimentIndex === nextExperimentIndex &&
            stage.trialIndex === 0) {
            timeline.currentStage = i;
            runNextStage();
            return;
        }
    }

    // If not found, go to questionnaire
    skipToQuestionnaire();
}

/**
 * Skip to questionnaire
 */
function skipToQuestionnaire() {
    // Find questionnaire stage
    for (let i = timeline.currentStage; i < timeline.stages.length; i++) {
        const stage = timeline.stages[i];
        if (stage.type === 'questionnaire') {
            timeline.currentStage = i;
            runNextStage();
            return;
        }
    }

    // If not found, go to completion
    skipToCompletion();
}

/**
 * Skip to completion
 */
function skipToCompletion() {
    // Find completion stage
    for (let i = timeline.currentStage; i < timeline.stages.length; i++) {
        const stage = timeline.stages[i];
        if (stage.type === 'completion') {
            timeline.currentStage = i;
            runNextStage();
            return;
        }
    }
}

// =================================================================================================
// QUESTIONNAIRE AND COMPLETION STAGES
// =================================================================================================

/**
 * Show questionnaire stage
 */
function showQuestionnaireStage(stage) {
    const container = document.getElementById('container');

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
    document.getElementById('nextPageBtn').addEventListener('click', function() {
        // Validate required fields on page 1
        var requiredFields = ['ai_detection', 'collaboration_rating', 'play_again'];
        var isValid = true;

        requiredFields.forEach(function(field) {
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

    document.getElementById('prevPageBtn').addEventListener('click', function() {
        document.getElementById('questionnairePage2').style.display = 'none';
        document.getElementById('questionnairePage1').style.display = 'block';
    });

    // Handle form submission
    document.getElementById('questionnaireForm').addEventListener('submit', function(e) {
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
 * Show completion stage
 */
function showCompletionStage(stage) {
    // Save all data before showing completion
    saveExperimentData();

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

// =================================================================================================
// DATA MANAGEMENT AND UTILITIES
// =================================================================================================

/**
 * Initialize trial data
 */
function initializeTrialData(trialIndex, experimentType) {
    gameData.currentTrialData = {
        trialIndex: trialIndex,
        experimentType: experimentType,
        startTime: Date.now(),
        playerMoves: [],
        partnerMoves: [],
        success: false,
        completionTime: null,
        stepCount: 0,
        gridMatrix: null,
        goals: null,
        playerStartPos: null,
        partnerStartPos: null,
        movementMode: movementMode
    };

    // Ensure arrays are properly initialized
    gameData.currentTrialData.playerMoves = [];
    gameData.currentTrialData.partnerMoves = [];

    // Generate distance condition sequence for 2P3G experiments (matching human-AI version)
    if (experimentType === '2P3G') {
        // Distance condition is now provided by the server
        console.log(`=== 2P3G Trial ${trialIndex + 1} Setup ===`);
        console.log(`Experiment type: ${experimentType}`);
        console.log(`Trial index: ${trialIndex}`);
        console.log(`Distance condition: Will be provided by server`);
        console.log(`========================================`);

        // Reset 2P3G specific variables for new trial (matching human-AI version)
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

        // Initialize goal tracking arrays
        gameData.currentTrialData.player1CurrentGoal = [];
        gameData.currentTrialData.player2CurrentGoal = [];
        gameData.currentTrialData.newGoalPresentedTime = null;
        gameData.currentTrialData.newGoalPosition = null;
        gameData.currentTrialData.isNewGoalCloserToPlayer2 = null;
        gameData.currentTrialData.newGoalConditionType = null;
        gameData.currentTrialData.newGoalDistanceToPlayer2 = null;
        gameData.currentTrialData.newGoalDistanceToPlayer1 = null;
        gameData.currentTrialData.newGoalDistanceSum = null;
        gameData.currentTrialData.player2DistanceToOldGoal = null;
        gameData.currentTrialData.player1DistanceToOldGoal = null;
    }

    console.log('Trial data initialized for trial', trialIndex);
}

/**
 * Record player move
 */
function recordPlayerMove(action, reactionTime) {
    if (gameData.currentTrialData) {
        // Initialize playerMoves array if it doesn't exist
        if (!gameData.currentTrialData.playerMoves) {
            gameData.currentTrialData.playerMoves = [];
        }

        gameData.currentTrialData.playerMoves.push({
            action: action,
            reactionTime: reactionTime,
            timestamp: Date.now(),
            stepCount: gameData.stepCount
        });
    }
}

/**
 * Record partner move
 */
function recordPartnerMove(action, reactionTime) {
    if (gameData.currentTrialData) {
        // Initialize partnerMoves array if it doesn't exist
        if (!gameData.currentTrialData.partnerMoves) {
            gameData.currentTrialData.partnerMoves = [];
        }

        gameData.currentTrialData.partnerMoves.push({
            action: action,
            reactionTime: reactionTime,
            timestamp: Date.now(),
            stepCount: gameData.stepCount
        });
    }
}

/**
 * Finalize trial
 */
function finalizeTrial(success) {
    if (gameData.currentTrialData) {
        gameData.currentTrialData.success = success;
        gameData.currentTrialData.completionTime = Date.now();
        gameData.currentTrialData.stepCount = gameData.stepCount;
        gameData.currentTrialData.gridMatrix = gameData.gridMatrix;
        gameData.currentTrialData.goals = gameData.currentGoals;

        // Add to all trials data
        gameData.allTrialsData.push({...gameData.currentTrialData});

        // Update success threshold tracking
        updateSuccessThresholdTracking(success, gameData.currentTrial);

        console.log(`Trial ${gameData.currentTrial} finalized. Success: ${success}`);
    }
}

/**
 * Initialize success threshold tracking
 */
function initializeSuccessThresholdTracking() {
    gameData.successThreshold = {
        consecutiveSuccesses: 0,
        totalTrialsCompleted: 0,
        experimentEndedEarly: false,
        lastSuccessTrial: -1,
        successHistory: []
    };
}

/**
 * Update success threshold tracking
 */
function updateSuccessThresholdTracking(success, trialIndex) {
    const threshold = gameData.successThreshold;

    if (success) {
        threshold.consecutiveSuccesses++;
        threshold.lastSuccessTrial = trialIndex;
    } else {
        threshold.consecutiveSuccesses = 0;
    }

    threshold.totalTrialsCompleted++;
    threshold.successHistory.push(success);

    console.log(`Success threshold: consecutive=${threshold.consecutiveSuccesses}, total=${threshold.totalTrialsCompleted}`);
}

/**
 * Check if should continue to next trial
 */
function shouldContinueToNextTrial(experimentType, trialIndex) {
    const config = NODEGAME_HUMAN_HUMAN_CONFIG;
    const maxTrials = config.numTrials[experimentType];

    console.log(`shouldContinueToNextTrial: experimentType=${experimentType}, trialIndex=${trialIndex}, maxTrials=${maxTrials}`);

    // Check if we've reached max trials
    if (trialIndex >= maxTrials - 1) {
        console.log(`Reached max trials: ${trialIndex} >= ${maxTrials - 1}`);
        return false;
    }

    // Check success threshold if enabled
    if (config.successThreshold.enabled &&
        trialIndex >= config.successThreshold.minTrialsBeforeCheck) {
        const shouldEnd = shouldEndExperimentDueToSuccessThreshold();
        console.log(`Success threshold check: trialIndex=${trialIndex}, minTrialsBeforeCheck=${config.successThreshold.minTrialsBeforeCheck}, shouldEnd=${shouldEnd}`);
        return !shouldEnd;
    }

    console.log(`Continuing to next trial: trialIndex=${trialIndex}, minTrialsBeforeCheck=${config.successThreshold.minTrialsBeforeCheck}`);
    return true;
}

/**
 * Check if experiment should end due to success threshold
 */
function shouldEndExperimentDueToSuccessThreshold() {
    const config = NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold;
    const threshold = gameData.successThreshold;

    if (threshold.consecutiveSuccesses >= config.consecutiveSuccessesRequired) {
        console.log('Experiment ending due to success threshold');
        threshold.experimentEndedEarly = true;
        return true;
    }

    return false;
}

/**
 * Reset experiment data
 */
function resetExperimentData() {
    gameData.currentExperiment = null;
    gameData.currentExperimentIndex = 0;
    gameData.currentTrial = 0;
    gameData.allTrialsData = [];
    gameData.currentTrialData = {};
    gameData.questionnaireData = null;
    gameData.stepCount = 0;
    gameData.gameStartTime = 0;

    initializeSuccessThresholdTracking();
}

/**
 * Save experiment data
 */
function saveExperimentData() {
    const experimentData = {
        participantId: myPlayerId,
        partnerId: partnerPlayerId,
        roomId: roomId,
        experimentOrder: NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder,
        allTrialsData: gameData.allTrialsData,
        questionnaireData: gameData.questionnaireData,
        successThreshold: gameData.successThreshold,
        timestamp: Date.now(),
        completionCode: NODEGAME_HUMAN_HUMAN_CONFIG.prolificCompletionCode,
        version: NODEGAME_HUMAN_HUMAN_CONFIG.version,
        experimentType: 'human-human',
        multiplayer: {
            movementMode: movementMode,
            totalPlayers: 2
        }
    };

    // Save to localStorage
    const dataKey = `human_human_experiment_${myPlayerId}_${Date.now()}`;
    localStorage.setItem(dataKey, JSON.stringify(experimentData));

    console.log('Experiment data saved:', experimentData);
    return experimentData;
}

/**
 * Download experiment data
 */
function downloadExperimentData() {
    const data = saveExperimentData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `human_human_experiment_data_${myPlayerId}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Redirect to Prolific
 */
function redirectToProlific() {
    const completionCode = NODEGAME_HUMAN_HUMAN_CONFIG.prolificCompletionCode;
    const prolificUrl = `https://app.prolific.co/submissions/complete?cc=${completionCode}`;
    window.location.href = prolificUrl;
}

// =================================================================================================
// UTILITY FUNCTIONS
// =================================================================================================

/**
 * Get experiment display name (matching human-AI version exactly)
 */
function getExperimentDisplayName(experimentType) {
    switch (experimentType) {
        case '1P1G': return '1-Player-1-Goal Task';
        case '1P2G': return '1-Player-2-Goals Task';
        case '2P2G': return '2-Player-2-Goals Task';
        case '2P3G': return '2-Player-3-Goals Task';
        default: return experimentType;
    }
}

/**
 * Get experiment instructions (matching human-AI version exactly)
 */
function getExperimentInstructions(experimentType) {
    switch (experimentType) {
        case '1P1G': return 'Navigate to reach the goal';
        case '1P2G': return 'Navigate to reach both goals';
        case '2P2G': return 'Work together to reach both goals';
        case '2P3G': return 'Work together to reach all three goals';
        default: return 'Navigate to reach the goal(s)';
    }
}

/**
 * Get maps for experiment
 */
function getMapsForExperiment(experimentType) {
    let mapData = null;

    switch (experimentType) {
        case '2P2G':
            mapData = window.MapsFor2P2G;
            break;
        case '2P3G':
            mapData = window.MapsFor2P3G;
            break;
        default:
            console.warn('Unknown experiment type:', experimentType);
            return [];
    }

    if (!mapData) {
        console.warn(`No map data available for ${experimentType}`);
        return [];
    }

    // Convert object to array of map entries
    const mapEntries = Object.entries(mapData).map(([mapId, mapArray]) => ({
        mapId: mapId,
        ...mapArray[0] // Extract the first (and only) map from the array
    }));

    console.log(`Loaded ${mapEntries.length} maps for ${experimentType}`);
    return mapEntries;
}

/**
 * Select random maps from map data
 */
function selectRandomMaps(mapData, nTrials) {
    if (!mapData || !Array.isArray(mapData) || mapData.length === 0) {
        console.warn('No map data available or invalid format');
        return [];
    }

    const shuffled = [...mapData].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, nTrials);
}

/**
 * Create empty grid matrix
 */
function createEmptyGridMatrix() {
    // Create grid using EXPSETTINGS.matrixsize (matching human-AI version)
    const gridSize = EXPSETTINGS.matrixsize;
    const gridMatrix = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    return gridMatrix;
}

// =================================================================================================
// CONFIGURATION HELPERS
// =================================================================================================

/**
 * Set experiment to 2P2G only
 */
function setExperiment2P2G() {
    NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P2G'];
    console.log('Experiment set to 2P2G only');
}

/**
 * Set experiment to 2P3G only
 */
function setExperiment2P3G() {
    NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P3G'];
    console.log('Experiment set to 2P3G only');
}

/**
 * Set experiment to collaboration games
 */
function setExperimentCollaboration() {
    NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P2G', '2P3G'];
    console.log('Experiment set to collaboration games (2P2G + 2P3G)');
}

/**
 * Set custom experiment order
 */
function setCustomExperimentOrder(experimentOrder) {
    NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = experimentOrder;
    console.log('Custom experiment order set:', experimentOrder);
}

/**
 * Draw overlapping circles function matching exact human-AI version parameters
 */
function drawOverlappingCirclesHumanHuman(context, colPos, rowPos) {
    // First draw white background
    context.fillStyle = COLORPOOL.map;
    context.fillRect(colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding,
        EXPSETTINGS.cellSize, EXPSETTINGS.cellSize);

    const circleRadius = EXPSETTINGS.cellSize * 0.35; // Slightly smaller for overlap
    const centerX = colPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2;
    const centerY = rowPos * (EXPSETTINGS.cellSize + EXPSETTINGS.padding) + EXPSETTINGS.padding + EXPSETTINGS.cellSize/2;
    const offset = EXPSETTINGS.cellSize * 0.15; // Offset for overlap

    // Draw human player circle (red) on the left
    context.beginPath();
    context.lineWidth = 1/3 * EXPSETTINGS.padding;
    context.strokeStyle = COLORPOOL.player;
    context.fillStyle = COLORPOOL.player;
    context.arc(centerX - offset, centerY, circleRadius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();

    // Draw partner player circle (orange) on the right
    context.beginPath();
    context.strokeStyle = "orange";
    context.fillStyle = "orange";
    context.arc(centerX + offset, centerY, circleRadius, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
}

// =================================================================================================
// GOAL DETECTION AND NEW GOAL PRESENTATION (matching human-AI version)
// =================================================================================================

/**
 * Transition function (matching human-AI version)
 */
function transition(state, action) {
    let [x, y] = state;
    let nextState = [x+action[0],y+action[1]]
    return nextState
}

/**
 * Detect which goal a player is heading towards (matching human-AI version exactly)
 */
function detectPlayerGoal(playerPos, action, goals, goalHistory) {
    console.log('=== DETECT PLAYER GOAL DEBUG ===');
    console.log('playerPos:', playerPos, 'action:', action, 'goals:', goals, 'goalHistory:', goalHistory);

    if (!action) {
        console.log('No action - returning null');
        return null;
    }

    // Convert string action to array format (matching human-AI version)
    let actionArray;
    if (typeof action === 'string') {
        switch (action) {
            case 'up':
                actionArray = [-1, 0];
                break;
            case 'down':
                actionArray = [1, 0];
                break;
            case 'left':
                actionArray = [0, -1];
                break;
            case 'right':
                actionArray = [0, 1];
                break;
            default:
                console.log('Unknown action:', action, '- returning null');
                return null;
        }
    } else if (Array.isArray(action)) {
        actionArray = action;
    } else {
        console.log('Invalid action format:', action, '- returning null');
        return null;
    }

    if (actionArray[0] === 0 && actionArray[1] === 0) {
        console.log('No movement - returning null');
        return null; // No movement, can't determine goal
    }

    var nextPos = transition(playerPos, actionArray);
    console.log('nextPos:', nextPos);

    var minDistance = Infinity;
    var closestGoal = null;
    var equidistantGoals = [];

    for (var i = 0; i < goals.length; i++) {
        var distance = calculatetGirdDistance(nextPos, goals[i]);
        console.log(`Goal ${i}:`, goals[i], 'distance:', distance);

        if (distance < minDistance) {
            minDistance = distance;
            closestGoal = i;
            equidistantGoals = [i]; // Reset equidistant goals
        } else if (distance === minDistance) {
            equidistantGoals.push(i); // Add to equidistant goals
        }
    }

    console.log('closestGoal:', closestGoal, 'equidistantGoals:', equidistantGoals);

    // If there are multiple equidistant goals, return last step's inferred goal
    if (equidistantGoals.length > 1) {
        if (goalHistory && goalHistory.length > 0) {
            console.log('Multiple equidistant goals, using history:', goalHistory[goalHistory.length - 1]);
            return goalHistory[goalHistory.length - 1]; // Return last step's inferred goal
        } else {
            console.log('Multiple equidistant goals, no history - returning null');
            return null; // No prior goal history
        }
    }

    console.log('Returning closest goal:', closestGoal);
    return closestGoal;
}

/**
 * Calculate grid distance between two positions (matching human-AI version)
 */
function calculatetGirdDistance(pos1, pos2) {
    if (!pos1 || !pos2 || !Array.isArray(pos1) || !Array.isArray(pos2) ||
        pos1.length < 2 || pos2.length < 2) {
        return Infinity; // Return large distance for invalid positions
    }
    return Math.abs(pos1[0] - pos2[0]) + Math.abs(pos1[1] - pos2[1]);
}

/**
 * Check for new goal presentation in 2P3G (using server-side logic)
 */
function checkNewGoalPresentation2P3G() {
    // Reset goal history for new trial if needed
    if (!gameData.currentTrialData.player1CurrentGoal) {
        gameData.currentTrialData.player1CurrentGoal = [];
        gameData.currentTrialData.player2CurrentGoal = [];
        player1InferredGoals = [];
        player2InferredGoals = [];
    }

    // Check minimum steps requirement
    if (gameData.stepCount < TWOP3G_CONFIG.minStepsBeforeNewGoal) {
        console.log('=== MIN STEPS NOT MET ===');
        console.log('Current step:', gameData.stepCount, 'Required:', TWOP3G_CONFIG.minStepsBeforeNewGoal);
        return;
    }

    // Get current goals for both players
    var player1CurrentGoal = gameData.currentTrialData.player1CurrentGoal.length > 0 ?
        gameData.currentTrialData.player1CurrentGoal[gameData.currentTrialData.player1CurrentGoal.length - 1] : null;
    var player2CurrentGoal = gameData.currentTrialData.player2CurrentGoal.length > 0 ?
        gameData.currentTrialData.player2CurrentGoal[gameData.currentTrialData.player2CurrentGoal.length - 1] : null;

    console.log('=== GOAL DETECTION DEBUG ===');
    console.log('Step:', gameData.stepCount);
    console.log('First player (red) goal:', player1CurrentGoal, 'Second player (orange) goal:', player2CurrentGoal);
    console.log('newGoalPresented:', newGoalPresented);
    console.log('Distance condition:', gameData.gameState?.distanceCondition);
    console.log('First player goal history:', player1InferredGoals);
    console.log('Second player goal history:', player2InferredGoals);

    // Check if both players have detected goals AND they are the same AND new goal hasn't been presented yet
    if (player1CurrentGoal !== null && player2CurrentGoal !== null &&
        player1CurrentGoal === player2CurrentGoal && !newGoalPresented) {

        console.log('=== BOTH PLAYERS HEADING TO SAME GOAL ===');
        console.log('Requesting server to generate new goal...');
        console.log('My player ID:', myPlayerId);

        // Send request to server to generate new goal
        socket.emit('request_new_goal', {
            sharedGoalIndex: player2CurrentGoal,
            stepCount: gameData.stepCount,
            trialIndex: gameData.currentTrialIndex,
            player1Pos: gameData.playerStartPos,
            player2Pos: gameData.partnerStartPos,
            currentGoals: gameData.currentGoals,
            distanceCondition: gameData.gameState?.distanceCondition
        });

        console.log('=== SERVER REQUEST SENT ===');
        console.log('Shared goal index:', player2CurrentGoal);
        console.log('Step count:', gameData.stepCount);
        console.log('Distance condition:', gameData.gameState?.distanceCondition);
    } else {
        console.log('=== NEW GOAL CONDITIONS NOT MET ===');
        console.log('  - Player1 goal null?', player1CurrentGoal === null);
        console.log('  - Player2 goal null?', player2CurrentGoal === null);
        console.log('  - Goals same?', player1CurrentGoal === player2CurrentGoal);
        console.log('  - Already presented?', newGoalPresented);
    }
}



/**
 * Check trial end for 2P3G (matching human-AI version)
 */
function checkTrialEnd2P3G() {
    var player1AtGoal = isGoalReached(gameData.playerStartPos, gameData.currentGoals);
    var player2AtGoal = isGoalReached(gameData.partnerStartPos, gameData.currentGoals);

    if (player1AtGoal && player2AtGoal) {
        var player1Goal = whichGoalReached(gameData.playerStartPos, gameData.currentGoals);
        var player2Goal = whichGoalReached(gameData.partnerStartPos, gameData.currentGoals);
        var collaboration = (player1Goal === player2Goal && player1Goal !== 0);

        gameData.currentTrialData.collaborationSucceeded = collaboration;
        finalizeTrial(true);

        // Reset 2P3G specific variables for next trial
        newGoalPresented = false;
        newGoalPosition = null;
        isNewGoalCloserToPlayer2 = null;
        player1InferredGoals = [];
        player2InferredGoals = [];
    }
}

/**
 * Check which goal a player has reached
 */
function whichGoalReached(playerPos, goals) {
    for (var i = 0; i < goals.length; i++) {
        if (isGoalReached(playerPos, [goals[i]])) {
            return i;
        }
    }
    return null;
}

/**
 * Start freeze period when new goal appears (matching human-AI version)
 */
function startFreezePeriod() {
    isFrozen = true;

    // Clear any existing freeze timeout
    if (freezeTimeout) {
        clearTimeout(freezeTimeout);
    }

    // End freeze period after message duration
    freezeTimeout = setTimeout(() => {
        isFrozen = false;
    }, TWOP3G_CONFIG.newGoalMessageDuration);
}

// =================================================================================================
// GLOBAL EXPORTS
// =================================================================================================

// Expose functions globally for the HTML page
window.NodeGameHumanHumanFull = {
    initialize: initializeNodeGameHumanHumanFullExperiments,
    start: startNodeGameHumanHumanExperiment,
    setExperiment2P2G: setExperiment2P2G,
    setExperiment2P3G: setExperiment2P3G,
    setExperimentCollaboration: setExperimentCollaboration,
    setCustomExperimentOrder: setCustomExperimentOrder,
    downloadExperimentData: downloadExperimentData
};

// Don't auto-initialize - let the HTML file handle initialization
console.log('NodeGame Human-Human Full experiments module loaded');

/**
 * Disable success threshold for testing (run all trials)
 */
function disableSuccessThreshold() {
    NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.enabled = false;
    console.log('Success threshold disabled - will run all trials');
}

/**
 * Enable success threshold with custom settings
 */
function enableSuccessThreshold(consecutiveSuccesses = 4, minTrials = 4) {
    NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.enabled = true;
    NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.consecutiveSuccessesRequired = consecutiveSuccesses;
    NODEGAME_HUMAN_HUMAN_CONFIG.successThreshold.minTrialsBeforeCheck = minTrials;
    console.log(`Success threshold enabled: ${consecutiveSuccesses} consecutive successes after ${minTrials} trials`);
}