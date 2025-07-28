/**
 * NodeGame Configuration and Setup for Human-Human Experiments
 */

// Import nodeGame if available
if (typeof node !== 'undefined') {
    var node = node;
} else if (typeof require !== 'undefined') {
    var node = require('nodegame-client');
}

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

// Make playerOrder globally accessible for vizWithAI.js
window.playerOrder = playerOrder;

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

// Make gameData globally accessible for nodeGameHelpers.js functions
window.gameData = gameData;

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

        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
            if (!isConnected) {
                console.warn('Socket connection timeout - continuing with fallback ID');
                // Ensure we have a fallback ID
                if (!myPlayerId) {
                    myPlayerId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    gameData.multiplayer.myPlayerId = myPlayerId;
                }
            }
        }, 5000); // 5 second timeout

        socket.on('connect', () => {
            console.log('Connected to server');
            clearTimeout(connectionTimeout);
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
            // Both players are now connected, show "Game is ready" message
            showGameReadyMessage();
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
                        gameData.currentPlayerPos = [...playerStates[myPlayerId].position];
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

            // Always update visualization after game data is received
            console.log('Game data received from server, updating visualization...');
            // console.log('Current goals:', gameData.currentGoals);
            // console.log('Current player pos:', gameData.currentPlayerPos);
            updateGameVisualization();
        });

        socket.on('partner_left', (data) => {
            console.log('Partner left');
            handlePartnerLeft(data);
        });

        socket.on('move_rejected', (data) => {
            console.error('Move rejected by server:', data.message);
            // Reset movement flag to allow retry
            timeline.isMoving = false;
            // Show error message to user
            alert('Move rejected: ' + data.message);
        });

        socket.on('game_state_update', (data) => {
            // console.log('=== GAME STATE UPDATE RECEIVED ===');
            // console.log('Server data:', data);
            // console.log('My player ID:', myPlayerId);

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
                    // console.log('Player states from server:', playerStates);

                    if (playerStates[myPlayerId]) {
                        gameData.playerStartPos = playerStates[myPlayerId].position;
                        gameData.currentPlayerPos = [...playerStates[myPlayerId].position];
                        // console.log('Updated my position to:', gameData.currentPlayerPos);
                    } else {
                        console.warn('No position found for my player ID:', myPlayerId);
                    }

                    // Find partner position
                    for (const [playerId, playerState] of Object.entries(playerStates)) {
                        if (playerId !== myPlayerId) {
                            gameData.partnerStartPos = playerState.position;
                            gameData.partnerPlayerId = playerId; // Store in gameData for new goal logic
                            // console.log('Updated partner position to:', gameData.partnerStartPos);
                            break;
                        }
                    }
                }

            //     console.log('Updated game data:');
            //     console.log('  - currentPlayerPos:', gameData.currentPlayerPos);
            //     console.log('  - currentGoals:', gameData.currentGoals);
            //     console.log('  - gridMatrix:', gameData.gridMatrix ? 'exists' : 'null');
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
                            gameData.currentPlayerPos = [...playerState.position];
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
    // Both players are now connected, show "Game is ready" message
    showGameReadyMessage();
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

    console.log('=== SENDING MAP DESIGN TO SERVER ===');
    console.log('Trial index:', trialIndex);
    console.log('Experiment type:', gameData.currentExperiment);
    console.log('Map design:', design);
    console.log('Player ID:', myPlayerId);

    socket.emit('start_trial', {
        trialIndex: trialIndex,
        experimentType: gameData.currentExperiment,
        design: design,
        playerId: myPlayerId
    });

    console.log('=== MAP DESIGN SENT TO SERVER ===');
    return true;
}

/**
 * Make single-player move (1P1G, 1P2G)
 */
function makeSinglePlayerMove(action) {
    if (!isGameActive || timeline.isMoving) {
        console.log('Move blocked - game not active or already moving');
        return;
    }

    timeline.isMoving = true;

    // Record move with timestamp
    const reactionTime = Date.now() - gameData.gameStartTime;
    recordPlayerMove(action, reactionTime);

    // Convert string action to array format
    let actionArray;
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
            console.log('Unknown action:', action);
            timeline.isMoving = false;
            return;
    }

    // Calculate new position
    console.log('Current position:', gameData.currentPlayerPos, 'Action array:', actionArray);
    const newPosition = transition(gameData.currentPlayerPos, actionArray);
    console.log('New position:', newPosition);

    // Check if move is valid
    if (newPosition && isValidPosition(newPosition)) {
        gameData.currentPlayerPos = newPosition;
        gameData.stepCount++;

        // Check if goal is reached
        const goalReached = isGoalReached(gameData.currentPlayerPos, gameData.currentGoals);

        // ADD THIS: Detect and record first goal
        const player1CurrentGoal = detectPlayerGoal(gameData.currentPlayerPos, actionArray, gameData.currentGoals, []);
        if (player1CurrentGoal !== null && gameData.currentTrialData.player1FirstDetectedGoal === null) {
            gameData.currentTrialData.player1FirstDetectedGoal = player1CurrentGoal;
            console.log(`Player1 first detected goal: ${player1CurrentGoal}`);
        }

        // Debug logging
        console.log('Player position:', gameData.currentPlayerPos);
        console.log('Current goals:', gameData.currentGoals);
        console.log('Goal reached:', goalReached);

        if (goalReached) {
            console.log('Goal reached in single-player mode!');

            // ADD THIS: Record final reached goal
            var finalGoal = whichGoalReached(gameData.currentPlayerPos, gameData.currentGoals);
            gameData.currentTrialData.player1FinalReachedGoal = finalGoal;
            console.log(`Player1 final reached goal: ${finalGoal}`);

            // Update visualization immediately to show final position
            updateGameVisualization();
            // End trial after a short delay
            setTimeout(() => {
                finalizeTrial(true);
                timeline.isMoving = false;
            }, 500);
        } else {
            // Update visualization
            updateGameVisualization();
            timeline.isMoving = false;
        }
    } else {
        console.log('Invalid move, position unchanged');
        timeline.isMoving = false;
    }
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

    // Don't record the move here - wait for server confirmation
    // The move will be recorded in the 'move_made' event when the server confirms it
    const reactionTime = gameData.gameStartTime > 0 ? Date.now() - gameData.gameStartTime : 0;

    // Send move to server
    socket.emit('make_move', {
        action: action,
        reactionTime: reactionTime,
        timestamp: Date.now()
    });

    console.log('Move sent to server:', action);

    // Reset movement flag after a short delay to prevent rapid successive moves
    setTimeout(() => {
        timeline.isMoving = false;
    }, 100);
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
        var reactionTime = data.reactionTime || 0;
        recordPlayerMove(currentPlayerAction, reactionTime);
    }

    // Record partner move if partner made a move
    if (partnerAction) {
        var reactionTime = data.reactionTime || 0;
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

            // ADD THIS: Record first detected goal
            if (firstPlayerGoal !== null && gameData.currentTrialData.player1FirstDetectedGoal === null) {
                gameData.currentTrialData.player1FirstDetectedGoal = firstPlayerGoal;
                console.log(`Player1 first detected goal: ${firstPlayerGoal}`);
            }

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

            // ADD THIS: Record first detected goal
            if (secondPlayerGoal !== null && gameData.currentTrialData.player2FirstDetectedGoal === null) {
                gameData.currentTrialData.player2FirstDetectedGoal = secondPlayerGoal;
                console.log(`Player2 first detected goal: ${secondPlayerGoal}`);
            }

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

        // ADD THIS: Record first detected shared goal (2P3G only)
        const currentFirstPlayerGoal = gameData.currentTrialData.player1CurrentGoal[gameData.currentTrialData.player1CurrentGoal.length - 1];
        const currentSecondPlayerGoal = gameData.currentTrialData.player2CurrentGoal[gameData.currentTrialData.player2CurrentGoal.length - 1];
        if (currentFirstPlayerGoal !== null && currentSecondPlayerGoal !== null &&
            currentFirstPlayerGoal === currentSecondPlayerGoal &&
            gameData.currentTrialData.firstDetectedSharedGoal === null) {
            gameData.currentTrialData.firstDetectedSharedGoal = currentFirstPlayerGoal;
            console.log(`First detected shared goal: ${currentFirstPlayerGoal}`);
        }

        // Check for new goal presentation
        checkNewGoalPresentation2P3G();

        // Check trial end for 2P3G
        checkTrialEnd2P3G();
    } else if (gameData.currentExperiment === '2P2G') {
        // Check trial end for 2P2G
        checkTrialEnd2P2G();
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

    // Use the same logic as post-trial stage for transitioning
    setTimeout(() => {
        const currentTrial = gameData.currentTrial;

        // Check if we should end the experiment early due to success threshold
        if (shouldEndExperimentDueToSuccessThreshold()) {
            // Skip to the end of this experiment by finding the next experiment or completion stage
            skipToNextExperimentOrCompletion();
        } else {
            // For collaboration games, check if we should continue to next trial
            if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
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
    }, NODEGAME_CONFIG.timing.feedbackDisplayDuration);
}

function shouldContinueToNextTrial(experimentType, trialIndex) {
    // Only apply to collaboration games
    if (!experimentType.includes('2P')) {
        return true; // Always continue for non-collaboration games
    }

    // Check if experiment should end due to success threshold
    if (shouldEndExperimentDueToSuccessThreshold()) {
        console.log(`Ending ${experimentType} experiment due to success threshold`);
        return false;
    }

    // Check if we've reached the configured number of trials
    var configuredTrials = NODEGAME_CONFIG.numTrials[experimentType];  // Fixed: Use correct config
    if (trialIndex >= configuredTrials - 1) {
        console.log(`Ending ${experimentType} experiment: Completed ${configuredTrials} trials`);
        return false;
    }

    return true;
}

// =================================================================================================
// EXPERIMENT FLOW AND STAGES (matching human-AI version)
// =================================================================================================

/**
 * Initialize NodeGame Human-Human Full Experiments
 */
function initializeNodeGameHumanHumanFullExperiments() {
    console.log('Initializing NodeGame Human-Human Full Experiments');

    // Set a fallback participant ID in case socket connection fails
    if (!myPlayerId) {
        myPlayerId = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        gameData.multiplayer.myPlayerId = myPlayerId;
        console.log('Set fallback participant ID:', myPlayerId);
    }

    // Initialize socket connection
    const socketInitialized = initializeSocket();
    if (!socketInitialized) {
        console.error('Failed to initialize socket connection');
        // Don't return false - continue with fallback ID
        console.log('Continuing with fallback participant ID');
    }

    // Initialize success threshold tracking
    initializeSuccessThresholdTracking();

    // Create timeline stages
    createTimelineStagesForHumanHuman();

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
    gameData.currentExperiment = NODEGAME_CONFIG.experimentOrder[0];
    gameData.currentExperimentIndex = 0;
    gameData.currentTrial = 0;

    // Start timeline
    timeline.currentStage = 0;
    runNextStage();

    return true;
}

/**
 * Create timeline stages (using timeline.js functions)
 */
function createTimelineStagesForHumanHuman() {
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

    // Add welcome screen for first experiment
    timeline.stages.push({
        type: 'welcome',
        experimentType: NODEGAME_CONFIG.experimentOrder[0],
        experimentIndex: 0,
        handler: showWelcomeStage
    });

    // Separate single-player and multiplayer experiments
    var singlePlayerExperiments = [];
    var multiplayerExperiments = [];

    NODEGAME_CONFIG.experimentOrder.forEach((expType, expIndex) => {
        if (expType.includes('1P')) {
            singlePlayerExperiments.push({ type: expType, index: expIndex });
        } else if (expType.includes('2P')) {
            multiplayerExperiments.push({ type: expType, index: expIndex });
        }
    });

    // Add single-player experiments first (1P1G, 1P2G)
    singlePlayerExperiments.forEach(({ type: experimentType, index: expIndex }) => {
        var numTrials = NODEGAME_CONFIG.numTrials[experimentType];

        console.log(`Setting up single-player experiment ${expIndex + 1}: ${experimentType} (${numTrials} trials)`);

        // Select maps for this experiment
        var experimentMaps = getMapsForExperiment(experimentType);
        console.log(`Single-player experiment maps for ${experimentType}:`, experimentMaps);
        var selectedMaps = selectRandomMaps(experimentMaps, numTrials);
        console.log(`Selected single-player maps for ${experimentType}:`, selectedMaps);
        timeline.mapData[experimentType] = selectedMaps;

        // Generate randomized distance condition sequence for 1P2G experiments
        if (experimentType === '1P2G') {
            ONEP2G_CONFIG.distanceConditionSequence = generateRandomized1P2GDistanceSequence(numTrials);
        }

        // Add trial stages for single-player experiments (fixed number)
        for (var i = 0; i < numTrials; i++) {
            addTrialStages(experimentType, expIndex, i);
        }
    });

    // Add instruction stage before multiplayer experiments
    if (multiplayerExperiments.length > 0) {
        timeline.stages.push({
            type: 'multiplayer_instructions',
            handler: showMultiplayerInstructionsStage
        });
    }

    // Add waiting for partner stage before multiplayer experiments
    if (multiplayerExperiments.length > 0) {
        timeline.stages.push({
            type: 'waiting_for_partner',
            handler: showWaitingForPartnerStage
        });
    }

    // Add multiplayer experiments (2P2G, 2P3G)
    multiplayerExperiments.forEach(({ type: experimentType, index: expIndex }) => {
        var numTrials = NODEGAME_CONFIG.numTrials[experimentType];

        console.log(`Setting up multiplayer experiment ${expIndex + 1}: ${experimentType} (${numTrials} trials)`);

        // Select maps for this experiment
        var experimentMaps = getMapsForExperiment(experimentType);
        console.log(`Multiplayer experiment maps for ${experimentType}:`, experimentMaps);
        var selectedMaps = selectRandomMaps(experimentMaps, numTrials);
        console.log(`Selected multiplayer maps for ${experimentType}:`, selectedMaps);
        timeline.mapData[experimentType] = selectedMaps;

        // Generate randomized distance condition sequence for 2P3G experiments
        if (experimentType === '2P3G') {
            TWOP3G_CONFIG.distanceConditionSequence = generateRandomizedDistanceSequence(numTrials);
        }

        // For collaboration games, we'll create stages dynamically based on success threshold
        if (NODEGAME_CONFIG.successThreshold.enabled) {
            // Add a single trial stage that will be repeated dynamically
            addCollaborationExperimentStages(experimentType, expIndex, 0);
        } else {
            // Add trial stages for this experiment (fixed number)
            for (var i = 0; i < numTrials; i++) {
                addTrialStages(experimentType, expIndex, i);
            }
        }
    });

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

    // Add completion stage (only once at the end)
    timeline.stages.push({
        type: 'completion',
        handler: showCompletionStage
    });

    console.log('Timeline stages created:', timeline.stages.length, 'stages');
    console.log('Single-player experiments:', singlePlayerExperiments.map(e => e.type));
    console.log('Multiplayer experiments:', multiplayerExperiments.map(e => e.type));
}

/**
 * Show multiplayer instructions stage
 */
function showMultiplayerInstructionsStage(stage) {
    const container = document.getElementById('container');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 800px; text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #007bff; margin-bottom: 30px;">Multiplayer Collaboration Instructions</h2>

                <div style="text-align: left; margin-bottom: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">🎮 How to Play:</h3>
                    <ul style="line-height: 1.6; color: #666;">
                        <li><strong>You will be paired with another player</strong> - wait for them to join</li>
                        <li><strong>Use arrow keys (↑ ↓ ← →)</strong> to move your character</li>
                        <li><strong>Coordinate with your partner</strong> to reach the goals together</li>
                        <li><strong>Communication is key!</strong> Work together to succeed</li>
                    </ul>
                </div>

                <div style="text-align: left; margin-bottom: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">🎯 Game Types:</h3>
                    <ul style="line-height: 1.6; color: #666;">
                        <li><strong>2P2G:</strong> Two players, two goals - coordinate to reach goals</li>
                        <li><strong>2P3G:</strong> Two players, three goals - a third goal appears during play</li>
                    </ul>
                </div>

                <div style="text-align: left; margin-bottom: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">⚠️ Important Notes:</h3>
                    <ul style="line-height: 1.6; color: #666;">
                        <li>Both players must reach the <strong>same goal</strong> to succeed</li>
                        <li>If you disconnect, you can reconnect and continue</li>
                        <li>Take your time to plan your moves with your partner</li>
                    </ul>
                </div>

                <div style="margin-top: 40px;">
                    <button class="btn" onclick="nextStage()" style="background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 5px; cursor: pointer; font-size: 16px;">
                        Continue to Multiplayer Games
                    </button>
                </div>
            </div>
        </div>
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
    window.handleWaitingCancel = function () {
        if (socket) {
            socket.disconnect();
        }
        window.close();
    };
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

/**
 * Add collaboration experiment stages (for 2P games with success threshold)
 */
function addCollaborationExperimentStages(experimentType, experimentIndex, trialIndex) {
    // Fixation screen
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

    // Post-trial feedback with dynamic continuation
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
}

/**
 * Add next trial stages dynamically for collaboration games
 * @param {string} experimentType - Type of experiment
 * @param {number} experimentIndex - Index of experiment
 * @param {number} trialIndex - Index of trial
 */
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
            if (gameData && gameData.gridMatrix && gameData.gridMatrix[row] && gameData.gridMatrix[row][col] !== undefined) {
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

    // Second pass: draw players
    if (gameData && gameData.currentExperiment && gameData.currentExperiment.includes('1P')) {
        // Single-player experiments (1P1G, 1P2G)
        if (gameData.currentPlayerPos && gameData.currentPlayerPos.length >= 2) {
            // Draw single player in red at current position
            drawCircleHumanHuman(ctx, COLORPOOL.player, 1 / 3 * EXPSETTINGS.padding,
                gameData.currentPlayerPos[1], gameData.currentPlayerPos[0], 0, 2 * Math.PI);
        }
    } else {
        // Multiplayer experiments (2P2G, 2P3G)
        if (gameData && gameData.playerStartPos && gameData.partnerStartPos &&
            gameData.playerStartPos.length >= 2 && gameData.partnerStartPos.length >= 2) {

            // Check if players are in the same position
            if (gameData.playerStartPos[0] === gameData.partnerStartPos[0] &&
                gameData.playerStartPos[1] === gameData.partnerStartPos[1]) {
                // Draw overlapping circles
                drawOverlappingCirclesHumanHuman(ctx, gameData.playerStartPos[1], gameData.playerStartPos[0]);
            } else {
                // Determine colors based on player order (with fallback)
                let myColor, partnerColor;
                const playerOrder = window.playerOrder || { isFirstPlayer: true }; // Fallback to first player

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
                drawCircleHumanHuman(ctx, myColor, 1 / 3 * EXPSETTINGS.padding,
                    gameData.playerStartPos[1], gameData.playerStartPos[0], 0, 2 * Math.PI);

                // Draw partner
                drawCircleHumanHuman(ctx, partnerColor, 1 / 3 * EXPSETTINGS.padding,
                    gameData.partnerStartPos[1], gameData.partnerStartPos[0], 0, 2 * Math.PI);
            }
        } else if (gameData && gameData.playerStartPos && gameData.playerStartPos.length >= 2) {
            // Only draw player
            const playerOrder = window.playerOrder || { isFirstPlayer: true }; // Fallback to first player
            let myColor = playerOrder.isFirstPlayer ? COLORPOOL.player : "orange";
            drawCircleHumanHuman(ctx, myColor, 1 / 3 * EXPSETTINGS.padding,
                gameData.playerStartPos[1], gameData.playerStartPos[0], 0, 2 * Math.PI);
        } else if (gameData && gameData.partnerStartPos && gameData.partnerStartPos.length >= 2) {
            // Only draw partner
            const playerOrder = window.playerOrder || { isFirstPlayer: true }; // Fallback to first player
            let partnerColor = playerOrder.isFirstPlayer ? "orange" : COLORPOOL.player;
            drawCircleHumanHuman(ctx, partnerColor, 1 / 3 * EXPSETTINGS.padding,
                gameData.partnerStartPos[1], gameData.partnerStartPos[0], 0, 2 * Math.PI);
        }
    }

    // Third pass: ALWAYS draw goals at their intended positions (matching human-AI version)
    // This ensures goals are always shown even if they were overwritten in the matrix
    if (gameData && gameData.currentGoals && Array.isArray(gameData.currentGoals) && gameData.currentGoals.length > 0) {
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
        console.log('gameData exists:', !!gameData);
        console.log('gameData.currentGoals:', gameData ? gameData.currentGoals : 'gameData is null');
        console.log('Goals array is invalid or empty');
    }
}

/**
 * Generate randomized distance condition sequence for 2P3G trials
 * Uses helper function from nodeGameHelpers.js
 * @param {number} numTrials - Number of 2P3G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomizedDistanceSequence(numTrials) {
    return window.NodeGameHelpers.generateRandomizedDistanceSequence(numTrials);
}

/**
 * Generate randomized distance condition sequence for 1P2G trials
 * Uses helper function from nodeGameHelpers.js
 * @param {number} numTrials - Number of 1P2G trials
 * @returns {Array} - Randomized array of distance conditions
 */
function generateRandomized1P2GDistanceSequence(numTrials) {
    return window.NodeGameHelpers.generateRandomized1P2GDistanceSequence(numTrials);
}

/**
 * Get maps for a specific experiment type
 * Uses helper function from nodeGameHelpers.js
 * @param {string} experimentType - Type of experiment
 * @returns {Array} - Array of maps for the experiment
 */
function getMapsForExperiment(experimentType) {
    const maps = window.NodeGameHelpers.getMapsForExperiment(experimentType);
    console.log(`Loading maps for ${experimentType}:`, maps);

    // Check if maps are properly loaded
    if (!maps || Object.keys(maps).length === 0) {
        console.error(`No maps found for experiment type: ${experimentType}`);
        console.log('Available map globals:', {
            MapsFor1P1G: typeof window.MapsFor1P1G,
            MapsFor1P2G: typeof window.MapsFor1P2G,
            MapsFor2P2G: typeof window.MapsFor2P2G,
            MapsFor2P3G: typeof window.MapsFor2P3G
        });
    }

    return maps;
}

/**
 * Select random maps for trials
 * Uses helper function from nodeGameHelpers.js
 * @param {Object} mapData - Object containing available maps
 * @param {number} nTrials - Number of trials
 * @returns {Array} - Array of selected maps
 */
function selectRandomMaps(mapData, nTrials) {
    return window.NodeGameHelpers.selectRandomMaps(mapData, nTrials);
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
 * Run trial stage
 */
function runTrialStage(stage) {
    const experimentType = stage.experimentType;
    const trialIndex = stage.trialIndex;
    const experimentIndex = stage.experimentIndex;

    console.log(`Running trial ${trialIndex} for experiment ${experimentType}`);

    // Set current experiment type
    gameData.currentExperiment = experimentType;

    // Setup the HTML container (matching human-AI version)
    const container = document.getElementById('container');

    // Determine player color for multiplayer games
    let playerColor = 'red';
    if (experimentType.includes('2P') && playerOrder && playerOrder.isFirstPlayer !== undefined) {
        playerColor = playerOrder.isFirstPlayer ? 'red' : 'orange';
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 10px;">Experiment: ${getExperimentDisplayName(experimentType)}</h3>
                <h4 style="margin-bottom: 20px;">Trial ${trialIndex + 1}</h4>
                <div id="gameCanvas" style="margin-bottom: 20px; position: relative;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: ${playerColor}; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Create canvas for game visualization
    const canvas = createGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);

    // Initialize client-side trial data tracking
    initializeTrialData(trialIndex, experimentType);

    // Set game start time
    gameData.gameStartTime = Date.now();

    if (experimentType.includes('1P')) {
        // Single-player experiments (1P1G, 1P2G) - run locally
        console.log('Running single-player experiment locally');
        runSinglePlayerTrial(experimentType, trialIndex);

        // Show the full game board after trial setup is complete for single-player
        // This ensures the game board is shown after fixation ends
        updateGameVisualization();
    } else if (experimentType.includes('2P')) {
        // Multiplayer experiments (2P2G, 2P3G) - use server
        console.log('Running multiplayer experiment with server');

        // Get the map design for this trial
        const mapDesign = timeline.mapData[experimentType][trialIndex];
        console.log(`Multiplayer map design for trial ${trialIndex}:`, mapDesign);

        if (!mapDesign) {
            console.error('No map design found for multiplayer trial', trialIndex, 'in experiment', experimentType);
            console.error('Available map data:', timeline.mapData);
            return;
        }

        runMultiplayerTrial(experimentType, trialIndex, mapDesign);

        // Show the full game board immediately for multiplayer games
        // The visualization will be updated again when the server sends the game state
        updateGameVisualization();
    } else {
        console.error('Unknown experiment type:', experimentType);
    }
}

/**
 * Run single-player trial (1P1G, 1P2G)
 */
function runSinglePlayerTrial(experimentType, trialIndex) {
    console.log(`Running single-player trial: ${experimentType}, trial ${trialIndex}`);
    console.log('Timeline map data:', timeline.mapData);
    console.log(`Map data for ${experimentType}:`, timeline.mapData[experimentType]);

    // Get the map design for this trial
    const mapDesign = timeline.mapData[experimentType][trialIndex];
    console.log(`Map design for trial ${trialIndex}:`, mapDesign);

    if (!mapDesign) {
        console.error('No map design found for trial', trialIndex, 'in experiment', experimentType);
        console.error('Available map data:', timeline.mapData);
        return;
    }

    // Setup the game state for single-player
    gameData.gridMatrix = Array(15).fill(0).map(() => Array(15).fill(0));
    gameData.currentGoals = [];

    // Setup goals based on experiment type
    if (mapDesign.target1) {
        gameData.currentGoals.push(mapDesign.target1);
    }
    if (mapDesign.target2) {
        gameData.currentGoals.push(mapDesign.target2);
    }
    if (mapDesign.target3) {
        gameData.currentGoals.push(mapDesign.target3);
    }

    // Set player position
    gameData.playerStartPos = mapDesign.initPlayerGrid;
    gameData.currentPlayerPos = [...mapDesign.initPlayerGrid];
    gameData.currentExperiment = experimentType;

    // Don't show game board immediately - wait for fixation to end
    // The game board will be shown when the trial actually starts

    // Enable keyboard controls for single-player
    isGameActive = true;
    setupKeyboardControls();
    console.log('Single-player trial running, keyboard controls enabled.');
    console.log('Game data:', {
        currentExperiment: gameData.currentExperiment,
        currentPlayerPos: gameData.currentPlayerPos,
        currentGoals: gameData.currentGoals,
        gridMatrix: gameData.gridMatrix
    });
}

/**
 * Run multiplayer trial (2P2G, 2P3G)
 */
function runMultiplayerTrial(experimentType, trialIndex, mapDesign) {
    console.log(`Running multiplayer trial: ${experimentType}, trial ${trialIndex}`);
    console.log('Timeline map data:', timeline.mapData);
    console.log(`Map data for ${experimentType}:`, timeline.mapData[experimentType]);
    console.log(`Map design for trial ${trialIndex}:`, mapDesign);

    // Send the map design to the server to start the trial
    if (mapDesign) {
        console.log('Sending map design to server for multiplayer trial');
        startMultiplayerTrial(trialIndex, mapDesign);
    } else {
        console.error('No map design provided for multiplayer trial');
        return;
    }

    // The game design and state are determined by the server and have already been
    // populated in the `game_started` event handler.
    // We just need to render it and enable controls.
    updateGameVisualization();

    // Don't show game board immediately - wait for fixation to end
    // The game board will be shown when the trial actually starts

    // Game started - controls are already shown below the canvas
    // The game is already active from the `game_started` event.
    // We just need to enable keyboard controls for this client.
    isGameActive = true;
    setupKeyboardControls();
    console.log('Multiplayer trial running, keyboard controls enabled.');

    // Initialize default values for multiplayer games to prevent undefined errors
    if (experimentType && experimentType.includes('2P')) {
        // Set default values that will be overridden by server data
        // gameData.currentPlayerPos = [0, 0]; // Will be updated by server
        // gameData.currentGoals = []; // Will be updated by server
        // gameData.gridMatrix = Array(15).fill(0).map(() => Array(15).fill(0)); // Will be updated by server
        console.log('Initialized default values for multiplayer trial');
    }

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
}

/**
 * Setup trial visualization
 */
function setupTrialVisualization(experimentType) {
    const container = document.getElementById('container');

    if (experimentType.includes('1P')) {
        // Single-player experiments (1P1G, 1P2G)
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                <div style="text-align: center;">
                    <h3 style="margin-bottom: 10px;">Experiment: ${getExperimentDisplayName(experimentType)}</h3>
                    <h4 style="margin-bottom: 20px;">Trial ${gameData.currentTrial + 1}</h4>
                    <div id="gameCanvas" style="margin-bottom: 20px; position: relative;"></div>
                    <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
                </div>
            </div>
        `;
    } else if (experimentType.includes('2P')) {
        // Multiplayer experiments (2P2G, 2P3G)
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
    }

    // Setup canvas and game visualization
    console.log('Setting up trial visualization for', experimentType);
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

    // Handle different experiment types
    if (gameData.currentExperiment && gameData.currentExperiment.includes('1P')) {
        // Single-player experiments (1P1G, 1P2G)
        console.log('Processing single-player key press:', key, 'Action:', action);
        makeSinglePlayerMove(action);
        } else if (gameData.currentExperiment && gameData.currentExperiment.includes('2P')) {
        // Multiplayer experiments (2P2G, 2P3G)
        // Check if player has already reached a goal
        if (isGoalReached(gameData.currentPlayerPos, gameData.currentGoals)) {
            console.log('Player already reached goal, movement blocked');
            return;
        }
        console.log('Processing multiplayer key press:', key, 'Action:', action);
        makeMultiplayerMove(action);
    } else {
        console.log('Processing key press:', key, 'Action:', action);
        makeMultiplayerMove(action); // Default fallback
    }
}

/**
 * Check if a position is valid (within grid bounds)
 */
function isValidPosition(position) {
    return window.NodeGameHelpers.isValidPosition(position);
}

/**
 * Check if a player has reached any goal
 * Uses helper function from nodeGameHelpers.js
 */
function isGoalReached(playerPos, goals) {
    return window.NodeGameHelpers.isGoalReached(playerPos, goals);
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
    renderGameBoardFallback(); // see vizWithAI.js

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
    const totalExperiments = NODEGAME_CONFIG.experimentOrder.length;

    if (currentExpIndex + 1 < totalExperiments) {
        // Move to next experiment
        gameData.currentExperimentIndex++;
        gameData.currentExperiment = NODEGAME_CONFIG.experimentOrder[gameData.currentExperimentIndex];
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



/**
 * Initialize trial data
 */
function initializeTrialData(trialIndex, experimentType) {
    gameData.currentTrial = trialIndex;
    gameData.stepCount = 0;

    // Ensure current experiment is set
    if (experimentType) {
        gameData.currentExperiment = experimentType;
    }

    gameData.currentTrialData = {
        trialIndex: trialIndex,
        experimentType: experimentType,
        trajectory: [],
        partnerTrajectory: [],
        aimAction: [],
        partnerAction: [],
        RT: [],
        trialStartTime: Date.now(),
        completed: false,
        stepCount: 0,
        gridMatrix: null,
        goals: null,
        playerStartPos: null,
        partnerStartPos: null,
        movementMode: movementMode,

        // NEW VARIABLES TO ADD:
        player1FirstDetectedGoal: null,  // First goal detected for player1
        player2FirstDetectedGoal: null,  // First goal detected for player2
        player1FinalReachedGoal: null,   // Final goal reached by player1
        player2FinalReachedGoal: null,   // Final goal reached by player2
        firstDetectedSharedGoal: null,   // First detected shared goal (2P3G only)

        // Goal tracking variables for 2P experiments
        player1CurrentGoal: [],
        player2CurrentGoal: [],
        newGoalPresentedTime: null,
        newGoalPosition: null,
        newGoalConditionType: null,
        newGoalPresented: false,
        isNewGoalCloserToPlayer2: null,
        collaborationSucceeded: undefined
    };

    // Initialize default values for multiplayer games to prevent undefined errors
    if (experimentType && experimentType.includes('2P')) {
        // Set default values that will be overridden by server data
        // gameData.currentPlayerPos = [0, 0]; // Will be updated by server
        // gameData.currentGoals = []; // Will be updated by server
        // gameData.gridMatrix = Array(15).fill(0).map(() => Array(15).fill(0)); // Will be updated by server
        console.log('Initialized default values for multiplayer trial');
    }

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
    // Safety check: ensure currentTrialData exists and has required arrays
    if (!gameData.currentTrialData) {
        console.error('currentTrialData is not initialized - cannot record player move');
        return;
    }

    // Ensure required arrays exist
    if (!gameData.currentTrialData.aimAction) {
        console.warn('aimAction array not initialized, creating it');
        gameData.currentTrialData.aimAction = [];
    }
    if (!gameData.currentTrialData.RT) {
        console.warn('RT array not initialized, creating it');
        gameData.currentTrialData.RT = [];
    }
    if (!gameData.currentTrialData.trajectory) {
        console.warn('trajectory array not initialized, creating it');
        gameData.currentTrialData.trajectory = [];
    }

    // Record the move
    gameData.currentTrialData.aimAction.push(action);
    gameData.currentTrialData.RT.push(reactionTime);

    // Safety check: ensure currentPlayerPos is defined and is an array
    if (gameData.currentPlayerPos && Array.isArray(gameData.currentPlayerPos)) {
        gameData.currentTrialData.trajectory.push([...gameData.currentPlayerPos]);
    } else {
        console.warn('currentPlayerPos is not properly initialized:', gameData.currentPlayerPos);
        console.log('Available fallbacks:');
        console.log('  - playerStartPos:', gameData.playerStartPos);
        console.log('  - gameData.currentPlayerPos:', gameData.currentPlayerPos);
        console.log('  - gameData:', gameData);

        // Use playerStartPos as fallback if available
        if (gameData.playerStartPos && Array.isArray(gameData.playerStartPos)) {
            gameData.currentTrialData.trajectory.push([...gameData.playerStartPos]);
        } else {
            gameData.currentTrialData.trajectory.push([0, 0]); // Default fallback
        }
    }
}

/**
 * Record partner move
 */
function recordPartnerMove(action, reactionTime) {
    // Safety check: ensure currentTrialData exists and has required arrays
    if (!gameData.currentTrialData) {
        console.error('currentTrialData is not initialized - cannot record partner move');
        return;
    }

    // Ensure required arrays exist
    if (!gameData.currentTrialData.partnerAction) {
        console.warn('partnerAction array not initialized, creating it');
        gameData.currentTrialData.partnerAction = [];
    }
    if (!gameData.currentTrialData.partnerTrajectory) {
        console.warn('partnerTrajectory array not initialized, creating it');
        gameData.currentTrialData.partnerTrajectory = [];
    }

    // Record the move
    gameData.currentTrialData.partnerAction.push(action);

    // Safety check: ensure partnerStartPos is defined and is an array
    if (gameData.partnerStartPos && Array.isArray(gameData.partnerStartPos)) {
        gameData.currentTrialData.partnerTrajectory.push([...gameData.partnerStartPos]);
    } else {
        console.warn('partnerStartPos is not properly initialized:', gameData.partnerStartPos);
        gameData.currentTrialData.partnerTrajectory.push([0, 0]); // Default fallback
    }
}

/**
 * Finalize trial
 */
function finalizeTrial(success) {
    if (gameData.currentTrialData) {
        gameData.currentTrialData.trialEndTime = Date.now();
        gameData.currentTrialData.trialDuration = gameData.currentTrialData.trialEndTime - gameData.currentTrialData.trialStartTime;
        gameData.currentTrialData.completed = success;
        gameData.currentTrialData.stepCount = gameData.stepCount;

        // Determine if trial was successful for collaboration games
        var trialSuccess = false;
        if (gameData.currentExperiment && gameData.currentExperiment.includes('2P')) {
            // For collaboration games, success is based on collaboration
            trialSuccess = gameData.currentTrialData.collaborationSucceeded === true;
        } else {
            // For single player games, success is based on completion
            trialSuccess = success;
        }

        // Update success threshold tracking for collaboration games
        updateSuccessThresholdTracking(trialSuccess, gameData.currentTrial);

        gameData.allTrialsData.push({...gameData.currentTrialData});

        // Reset movement flags to prevent issues in next trial
        timeline.isMoving = false;
        timeline.keyListenerActive = false;

        console.log('Trial finalized:', gameData.currentTrialData);
        console.log(`Trial success: ${trialSuccess} (${gameData.currentExperiment})`);
    }

    // For single-player games, advance to next stage after a short delay
    if (gameData.currentExperiment && gameData.currentExperiment.includes('1P')) {
        setTimeout(() => {
            // Check if showPostTrialStage is available, otherwise just advance
            if (typeof showPostTrialStage === 'function') {
                nextStage();
            } else {
                console.log('showPostTrialStage not available, advancing directly');
                nextStage();
            }
        }, 1000); // 1 second delay before advancing
    }
}

/**
 * Get random distance condition for 2P3G after trial 12
 * @param {number} trialIndex - Current trial index
 * @returns {string} - Distance condition
 */
function getRandomDistanceConditionFor2P3G(trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var allConditions = [
                    TWOP3G_CONFIG.distanceConditions.CLOSER_TO_PLAYER2,
        TWOP3G_CONFIG.distanceConditions.CLOSER_TO_PLAYER1,
            TWOP3G_CONFIG.distanceConditions.EQUAL_TO_BOTH,
            TWOP3G_CONFIG.distanceConditions.NO_NEW_GOAL
        ];
        var randomCondition = allConditions[Math.floor(Math.random() * allConditions.length)];
        console.log(`Using random distance condition for 2P3G trial ${trialIndex + 1}: ${randomCondition}`);
        return randomCondition;
    } else {
        // Use the pre-selected condition from sequence
        return TWOP3G_CONFIG.distanceConditionSequence[trialIndex];
    }
}

/**
 * Get random distance condition for 1P2G after trial 12
 * @param {number} trialIndex - Current trial index
 * @returns {string} - Distance condition
 */
function getRandomDistanceConditionFor1P2G(trialIndex) {
    // If we're past the random sampling threshold, use random sampling
    if (trialIndex >= NODEGAME_CONFIG.successThreshold.randomSamplingAfterTrial) {
        var allConditions = [
                    ONEP2G_CONFIG.distanceConditions.CLOSER_TO_PLAYER1,
        ONEP2G_CONFIG.distanceConditions.FARTHER_TO_PLAYER1,
        ONEP2G_CONFIG.distanceConditions.EQUAL_TO_PLAYER1,
            ONEP2G_CONFIG.distanceConditions.NO_NEW_GOAL
        ];
        var randomCondition = allConditions[Math.floor(Math.random() * allConditions.length)];
        console.log(`Using random distance condition for 1P2G trial ${trialIndex + 1}: ${randomCondition}`);
        return randomCondition;
    } else {
        // Use the pre-selected condition from sequence
        return ONEP2G_CONFIG.distanceConditionSequence[trialIndex];
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


// =================================================================================================
// SUCCESS THRESHOLD HELPER FUNCTIONS - FOR COLLABORATION GAMES
// =================================================================================================

/**
 * Initialize success threshold tracking for a new experiment
 */
function initializeSuccessThresholdTracking() {
    gameData.successThreshold.consecutiveSuccesses = 0;
    gameData.successThreshold.totalTrialsCompleted = 0;
    gameData.successThreshold.experimentEndedEarly = false;
    gameData.successThreshold.lastSuccessTrial = -1;
    gameData.successThreshold.successHistory = [];

    console.log('Success threshold tracking initialized');
}

/**
 * Update success threshold tracking after a trial
 * @param {boolean} success - Whether the trial was successful
 * @param {number} trialIndex - Current trial index
 */
function updateSuccessThresholdTracking(success, trialIndex) {
    // Only track for collaboration games
    if (!gameData.currentExperiment || !gameData.currentExperiment.includes('2P')) {
        return;
    }

    gameData.successThreshold.totalTrialsCompleted++;
    gameData.successThreshold.successHistory.push(success);

    if (success) {
        gameData.successThreshold.consecutiveSuccesses++;
        gameData.successThreshold.lastSuccessTrial = trialIndex;
    } else {
        gameData.successThreshold.consecutiveSuccesses = 0;
    }

    console.log(`Success threshold update - Trial ${trialIndex + 1}: ${success ? 'SUCCESS' : 'FAILURE'}`);
    console.log(`  Consecutive successes: ${gameData.successThreshold.consecutiveSuccesses}/${NODEGAME_CONFIG.successThreshold.consecutiveSuccessesRequired}`);
    console.log(`  Total trials: ${gameData.successThreshold.totalTrialsCompleted}/${NODEGAME_CONFIG.successThreshold.maxTrials}`);
}

/**
 * Check if experiment should end due to success threshold
 * @returns {boolean} - True if experiment should end
 */

function shouldEndExperimentDueToSuccessThreshold() {
    // Only apply to collaboration games
    if (!gameData.currentExperiment || !gameData.currentExperiment.includes('2P')) {
        return false;
    }

    // Check if success threshold is enabled
    if (!NODEGAME_CONFIG.successThreshold.enabled) {
        return false;
    }

    var config = NODEGAME_CONFIG.successThreshold;  // Fixed: Use correct config
    var tracking = gameData.successThreshold;

    // Check if we've reached the maximum trials
    if (tracking.totalTrialsCompleted >= config.maxTrials) {
        console.log(`Experiment ending: Reached maximum trials (${config.maxTrials})`);
        return true;
    }

    // Check if we have enough trials and consecutive successes
    if (tracking.totalTrialsCompleted >= config.minTrialsBeforeCheck &&
        tracking.consecutiveSuccesses >= config.consecutiveSuccessesRequired) {
        console.log(`Experiment ending: Success threshold met (${tracking.consecutiveSuccesses} consecutive successes after ${tracking.totalTrialsCompleted} trials)`);
        gameData.successThreshold.experimentEndedEarly = true;
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
    try {
        // Generate a fallback participant ID if myPlayerId is null
        const participantId = myPlayerId || `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const experimentData = {
            participantId: participantId,
            partnerId: partnerPlayerId || 'unknown',
            roomId: roomId || 'unknown',
            experimentOrder: NODEGAME_CONFIG.experimentOrder,
            allTrialsData: gameData.allTrialsData || [],
            questionnaireData: gameData.questionnaireData || null,
            successThreshold: gameData.successThreshold || {},
            timestamp: Date.now(),
            completionCode: NODEGAME_CONFIG.prolificCompletionCode,
            version: NODEGAME_CONFIG.version,
            experimentType: 'human-human',
            multiplayer: {
                movementMode: movementMode || 'simultaneous',
                totalPlayers: 2
            }
        };

        // Save to localStorage with error handling
        try {
            const dataKey = `human_human_experiment_${participantId}_${Date.now()}`;
            const jsonData = JSON.stringify(experimentData);

            // Check if data is too large for localStorage (usually 5-10MB limit)
            if (jsonData.length > 5000000) { // 5MB limit
                console.warn('Data too large for localStorage, truncating...');
                // Create a simplified version for localStorage
                const simplifiedData = {
                    participantId: experimentData.participantId,
                    timestamp: experimentData.timestamp,
                    completionCode: experimentData.completionCode,
                    version: experimentData.version,
                    experimentType: experimentData.experimentType,
                    totalTrials: experimentData.allTrialsData.length,
                    note: 'Full data available in download'
                };
                localStorage.setItem(dataKey, JSON.stringify(simplifiedData));
            } else {
                localStorage.setItem(dataKey, jsonData);
            }

            console.log('Experiment data saved successfully:', experimentData);
        } catch (localStorageError) {
            console.error('Error saving to localStorage:', localStorageError);
            // Continue without localStorage - data will still be returned for download
        }

        return experimentData;
    } catch (error) {
        console.error('Error in saveExperimentData:', error);

        // Return a minimal data structure even if there's an error
        return {
            participantId: myPlayerId || 'unknown',
            timestamp: Date.now(),
            error: error.message,
            note: 'Data saving failed, but experiment may have completed successfully'
        };
    }
}

/**
 * Download experiment data
 */
function downloadExperimentData() {
    try {
        const data = saveExperimentData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Generate a safe filename
        const participantId = myPlayerId || `participant_${Date.now()}`;
        const safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `human_human_experiment_data_${safeParticipantId}_${new Date().toISOString().slice(0, 10)}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Experiment data downloaded successfully:', filename);
    } catch (error) {
        console.error('Error downloading experiment data:', error);
        alert('Error downloading data: ' + error.message);
    }
}

// Note: redirectToProlific() is already defined in nodeGameHelpers.js

/**
 * Test data saving functionality
 */
function testDataSaving() {
    console.log('Testing data saving functionality...');

    // Test with null myPlayerId
    const originalPlayerId = myPlayerId;
    myPlayerId = null;

    try {
        const testData = saveExperimentData();
        console.log('Test data saving successful:', testData);

        // Test download
        downloadExperimentData();
        console.log('Test download successful');

        return true;
    } catch (error) {
        console.error('Test data saving failed:', error);
        return false;
    } finally {
        // Restore original player ID
        myPlayerId = originalPlayerId;
    }
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

// Note: getMapsForExperiment() is already defined in nodeGameHelpers.js

// Note: selectRandomMaps() is already defined in nodeGameHelpers.js

// Note: createEmptyGridMatrix() is already defined in nodeGameHelpers.js

// =================================================================================================
// CONFIGURATION HELPERS
// =================================================================================================

// Note: The following experiment configuration functions are already defined in nodeGameHelpers.js:
// - setExperiment2P2G()
// - setExperiment2P3G()
// - setExperimentCollaboration()
// - setCustomExperimentOrder()

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
    return window.NodeGameHelpers.transition(state, action);
}

/**
 * Detect which goal a player is heading towards (matching human-AI version exactly)
 */
function detectPlayerGoal(playerPos, action, goals, goalHistory) {
    console.log('=== DETECT PLAYER GOAL DEBUG ===');
    console.log('playerPos:', playerPos, 'action:', action, 'goals:', goals, 'goalHistory:', goalHistory);

    const result = window.NodeGameHelpers.detectPlayerGoal(playerPos, action, goals, goalHistory);
    console.log('Returning closest goal:', result);
    return result;
}

/**
 * Calculate grid distance between two positions
 * Uses helper function from nodeGameHelpers.js
 */
function calculatetGirdDistance(pos1, pos2) {
    return window.NodeGameHelpers.calculatetGirdDistance(pos1, pos2);
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
 * Check trial end for 2P2G (matching human-AI version)
 */
function checkTrialEnd2P2G() {
    var player1AtGoal = isGoalReached(gameData.playerStartPos, gameData.currentGoals);
    var player2AtGoal = isGoalReached(gameData.partnerStartPos, gameData.currentGoals);

    if (player1AtGoal && player2AtGoal) {
        var player1Goal = whichGoalReached(gameData.playerStartPos, gameData.currentGoals);
        var player2Goal = whichGoalReached(gameData.partnerStartPos, gameData.currentGoals);
        var collaboration = (player1Goal === player2Goal && player1Goal !== 0);

        // ADD THIS: Record final reached goals
        gameData.currentTrialData.player1FinalReachedGoal = player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = player2Goal;
        console.log(`Final goals - Player1: ${player1Goal}, Player2: ${player2Goal}`);

        gameData.currentTrialData.collaborationSucceeded = collaboration;
        finalizeTrial(true);
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

        // ADD THIS: Record final reached goals
        gameData.currentTrialData.player1FinalReachedGoal = player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = player2Goal;
        console.log(`Final goals - Player1: ${player1Goal}, Player2: ${player2Goal}`);

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
 * Uses helper function from nodeGameHelpers.js
 */
function whichGoalReached(playerPos, goals) {
    return window.NodeGameHelpers.whichGoalReached(playerPos, goals);
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


/**
 * Show server not running message
 */
function showServerNotRunningMessage() {
    const container = document.getElementById('container');
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">⚠️ Server Not Running</h1>
                <p style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    The experiment server is not currently running. Please ensure the server is started before continuing.
                </p>
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #721c24;">
                        <strong>To start the server:</strong><br>
                        1. Open a terminal in the project directory<br>
                        2. Run: <code>node server.js</code><br>
                        3. Refresh this page
                    </p>
                </div>
                <button class="btn" onclick="location.reload()">Try Again</button>
                <button class="btn secondary" onclick="window.location.href='index.html'">Back to Main</button>
            </div>
        </div>
    `;
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    const container = document.getElementById('container');
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">❌ Error</h1>
                <p style="font-size: 18px; color: #666; margin-bottom: 30px;">
                    ${message}
                </p>
                <button class="btn" onclick="location.reload()">Try Again</button>
                <button class="btn secondary" onclick="window.location.href='index.html'">Back to Main</button>
            </div>
        </div>
    `;
}

/**
 * Show partner disconnected message
 */
function showPartnerDisconnectedMessage() {
    const container = document.getElementById('container');
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #ffc107; margin-bottom: 30px;">⚠️ Partner Disconnected</h1>
                <p style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    Your partner has disconnected from the experiment. Please wait while we attempt to reconnect or find a new partner.
                </p>
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #856404;">
                        <strong>Attempting to reconnect...</strong><br>
                        If reconnection fails, you will be matched with a new partner.
                    </p>
                </div>
                <button class="btn" onclick="attemptReconnection()">Try Reconnect</button>
                <button class="btn secondary" onclick="window.location.href='index.html'">Back to Main</button>
            </div>
        </div>
    `;
}

/**
 * Show disconnection message
 */
function showDisconnectionMessage() {
    const container = document.getElementById('container');
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #dc3545; margin-bottom: 30px;">❌ Connection Lost</h1>
                <p style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    Your connection to the server has been lost. Please check your internet connection and try again.
                </p>
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #721c24;">
                        <strong>Possible causes:</strong><br>
                        • Internet connection issues<br>
                        • Server is down<br>
                        • Browser compatibility issues
                    </p>
                </div>
                <button class="btn" onclick="attemptReconnection()">Try Reconnect</button>
                <button class="btn secondary" onclick="window.location.href='index.html'">Back to Main</button>
            </div>
        </div>
    `;
}

// =================================================================================================
// GLOBAL EXPORTS
// =================================================================================================

// Expose functions globally for the HTML page
window.NodeGameHumanHumanFull = {
    initialize: initializeNodeGameHumanHumanFullExperiments,
    start: startNodeGameHumanHumanExperiment,
    // Note: Experiment configuration functions are available from nodeGameHelpers.js
    downloadExperimentData: downloadExperimentData,
    testDataSaving: testDataSaving
};

// Don't auto-initialize - let the HTML file handle initialization
console.log('NodeGame Human-Human Full experiments module loaded');

/**
 * Disable success threshold for testing (run all trials)
 */
function disableSuccessThreshold() {
    NODEGAME_CONFIG.successThreshold.enabled = false;
    console.log('Success threshold disabled - will run all trials');
}

/**
 * Enable success threshold with custom settings
 */
function enableSuccessThreshold(consecutiveSuccesses = 4, minTrials = 4) {
    NODEGAME_CONFIG.successThreshold.enabled = true;
    NODEGAME_CONFIG.successThreshold.consecutiveSuccessesRequired = consecutiveSuccesses;
    NODEGAME_CONFIG.successThreshold.minTrialsBeforeCheck = minTrials;
    console.log(`Success threshold enabled: ${consecutiveSuccesses} consecutive successes after ${minTrials} trials`);
}