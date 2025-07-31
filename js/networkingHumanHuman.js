/**
 * Networking Module for Human-Human Experiments
 *
 * Contains all networking and socket.io functions for multiplayer experiments.
 * Extracted from human-human-version.js for better organization.
 */

// Global networking state variables
let socket = null;
let gameState = null;
let myPlayerId = null;
let partnerPlayerId = null;
let roomId = null;
let isConnected = false;
let isGameActive = false;
let movementMode = 'simultaneous';

// Track all players in the room
let roomPlayers = [];

// Player order tracking for consistent colors
var playerOrder = {
    firstPlayerId: null,  // First player to join (should be red)
    secondPlayerId: null, // Second player to join (should be orange)
    isFirstPlayer: false  // Whether current player is the first player
};

// Make playerOrder globally accessible for viz.js
window.playerOrder = playerOrder;

/**
 * Initialize Socket.IO connection
 */
function initializeSocket() {
    if (socket && socket.connected) {
        console.log('Socket already connected');
        return;
    }

    console.log('Initializing socket connection...');
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        isConnected = true;
        myPlayerId = socket.id;

        // Make myPlayerId globally accessible
        window.myPlayerId = myPlayerId;
        console.log('🎮 Set myPlayerId to:', myPlayerId);

        // Ensure gameData.multiplayer exists before setting properties
        if (typeof gameData !== 'undefined' && gameData.multiplayer) {
            gameData.multiplayer.myPlayerId = myPlayerId;
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        handleDisconnection();
    });

    socket.on('joined_room', handleRoomJoined);
    socket.on('player_joined', handlePartnerJoined);
    socket.on('player_left', handlePartnerLeft);
    socket.on('room_full', handleRoomFull);
    socket.on('game_started', (data) => {
        console.log('🎮 RECEIVED game_started event:', data);
        handleGameStarted(data);
    });
    socket.on('move_made', recordMoveMultiPlayer);
    socket.on('trial_complete', handleTrialComplete);
    socket.on('collaboration_feedback', showCollaborationFeedback);
    socket.on('trial_started', handleTrialStarted);
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        showErrorMessage('Connection error: ' + error);
    });

    // Reconnection handling
    socket.on('reconnect', () => {
        console.log('Reconnected to server');
        isConnected = true;
        // Attempt to rejoin room if we were in one
        if (roomId) {
            joinMultiplayerRoom();
        }
    });

    socket.on('reconnect_error', (error) => {
        console.error('Reconnection failed:', error);
        // Show reconnection message
        showReconnectionMessage();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection failed:', error);
        isConnected = false;
    });
}

/**
 * Handle room joined event
 */
function handleRoomJoined(data) {
    console.log('Joined room:', data);
    roomId = data.roomId;
    myPlayerId = data.playerId;

    // Update global myPlayerId
    window.myPlayerId = myPlayerId;
    console.log('🎮 Updated myPlayerId to:', myPlayerId);

    // Add ourselves to the room players list
    if (!roomPlayers.includes(myPlayerId)) {
        roomPlayers.push(myPlayerId);
        console.log('🎮 Added myself to room players:', roomPlayers);
    }

    // Store in gameData
    if (typeof gameData !== 'undefined' && gameData.multiplayer) {
        gameData.multiplayer.roomId = roomId;
        gameData.multiplayer.myPlayerId = myPlayerId;
    }

    // Update status
    updateConnectionStatus(`Joined room ${roomId}. Waiting for partner...`);

    // Don't auto-advance here - wait for room_full event
    console.log('Room joined successfully, waiting for partner to join...');
}

/**
 * Handle room full event (both players joined)
 */
function handleRoomFull(data) {
    console.log('Room is now full - both players joined:', data);
    console.log('🎮 Room players tracked:', roomPlayers);
    console.log('🎮 My player ID:', myPlayerId);

    // Prevent multiple calls
    if (window.roomFullHandled) {
        console.log('Room full already handled, ignoring duplicate call');
        return;
    }
    window.roomFullHandled = true;

    // Set partner ID based on tracked players
    if (roomPlayers.length === 2) {
        // Find the other player (our partner)
        const otherPlayer = roomPlayers.find(playerId => playerId !== myPlayerId);
        if (otherPlayer) {
            partnerPlayerId = otherPlayer;
            if (typeof gameData !== 'undefined' && gameData.multiplayer) {
                gameData.multiplayer.partnerPlayerId = partnerPlayerId;
            }
            console.log('✅ Partner ID set from room players:', partnerPlayerId);
        } else {
            console.error('❌ Could not identify partner from room players');
        }
    } else {
        console.error('❌ Expected 2 players in room, but found:', roomPlayers.length);
    }

    // Update status
    updateConnectionStatus('Partner found! Starting game...');

    // Set a timeout to prevent infinite waiting
    window.gameStartTimeout = setTimeout(() => {
        console.log('⏰ Game start timeout reached');
        updateConnectionStatus('Partner not responding. Please refresh the page.');
        window.roomFullHandled = false; // Reset for retry
    }, 15000); // 15 second timeout

    // Send map design first, then player ready signal
    setTimeout(() => {
        // Send map design for the first trial
        if (typeof startMultiplayerTrial === 'function') {
            console.log('🎮 Sending map design for trial 0 before game start');
            const currentMapDesign = timeline.mapData && timeline.mapData[gameData.currentExperiment] ?
                timeline.mapData[gameData.currentExperiment][0] : null;

            if (currentMapDesign) {
                startMultiplayerTrial(0, currentMapDesign);
                console.log('✅ Map design sent for trial 0');
            } else {
                console.warn('⚠️ No map design available for trial 0');
            }
        } else {
            console.error('❌ startMultiplayerTrial function not available');
        }

        // Wait a bit for map design to be processed, then send player ready
        setTimeout(() => {
            // Send player ready signal to server
            if (socket && socket.connected) {
                console.log('🎮 Sending player_ready signal to server');
                socket.emit('player_ready', {
                    roomId: roomId,
                    playerId: myPlayerId
                });
            } else {
                console.error('❌ Socket not connected, cannot send player_ready signal');
                updateConnectionStatus('Connection error. Please refresh the page.');
                if (window.gameStartTimeout) {
                    clearTimeout(window.gameStartTimeout);
                    window.gameStartTimeout = null;
                }
                window.roomFullHandled = false; // Reset for retry
                return;
            }

            // Wait a bit more before advancing to game stage
            setTimeout(() => {
                if (window.gameStartTimeout) {
                    clearTimeout(window.gameStartTimeout); // Clear timeout since we're proceeding
                    window.gameStartTimeout = null;
                }
                if (typeof nextStage === 'function') {
                    console.log('Room full, advancing to game ready stage');
                    nextStage();
                }
            }, 2000); // Additional delay to ensure synchronization
        }, 1000); // Wait for map design to be processed
    }, 1000); // Initial delay to ensure both players are ready
}

/**
 * Handle partner joined event
 */
function handlePartnerJoined(data) {
    console.log('🎮 Partner joined event received:', data);
    console.log('🎮 My player ID:', myPlayerId);
    console.log('🎮 Joining player ID:', data.playerId);
    console.log('🎮 Are they the same?', data.playerId === myPlayerId);

    // Add the joining player to our room players list
    if (!roomPlayers.includes(data.playerId)) {
        roomPlayers.push(data.playerId);
        console.log('🎮 Added joining player to room players:', roomPlayers);
    }

    // The player_joined event sends the joining player's ID
    // We need to set this as our partner's ID (since we're already in the room)
    // But only if it's not our own ID
    if (data.playerId !== myPlayerId) {
        partnerPlayerId = data.playerId;
        if (typeof gameData !== 'undefined' && gameData.multiplayer) {
            gameData.multiplayer.partnerPlayerId = partnerPlayerId;
        }

        console.log('✅ Partner ID set to:', partnerPlayerId);
        updateConnectionStatus('Partner found! Starting game...');
    } else {
        console.log('ℹ️ Received own player_joined event, ignoring');
    }
}

/**
 * Handle partner left event
 */
function handlePartnerLeft(data) {
    console.log('Partner left:', data);

    // Remove the leaving player from our room players list
    const playerIndex = roomPlayers.indexOf(data.playerId);
    if (playerIndex !== -1) {
        roomPlayers.splice(playerIndex, 1);
        console.log('🎮 Removed leaving player from room players:', roomPlayers);
    }

    // The player_left event sends the leaving player's ID
    // If this is our partner, clear the partner ID
    if (data.playerId === partnerPlayerId) {
        partnerPlayerId = null;
        if (typeof gameData !== 'undefined' && gameData.multiplayer) {
            gameData.multiplayer.partnerPlayerId = null;
        }
        showPartnerDisconnectedMessage();
    }
}

/**
 * Handle disconnection
 */
function handleDisconnection() {
    isConnected = false;
    isGameActive = false;

    // Clean up game state
    if (gameState) {
        gameState = null;
    }

    // Reset room players tracking
    roomPlayers = [];
    console.log('🎮 Reset room players tracking on disconnection');

    // Show disconnection message
    showDisconnectionMessage();

    // Attempt reconnection
    setTimeout(attemptReconnection, 2000);
}

/**
 * Join multiplayer room
 */
function joinMultiplayerRoom() {
    if (!socket || !socket.connected) {
        console.error('Socket not connected. Cannot join room.');
        showErrorMessage('Not connected to server. Please refresh the page.');
        return;
    }

    // Reset room players tracking for new room
    roomPlayers = [];
    console.log('🎮 Reset room players tracking for new room');

    console.log('Requesting to join multiplayer room...');
    socket.emit('join_game', {
        gameType: gameData.currentExperiment,
        playerId: myPlayerId
    });
}

/**
 * Start multiplayer trial
 */
function startMultiplayerTrial(trialIndex, design) {
    if (!socket || !socket.connected) {
        console.error('Socket not connected. Cannot start trial.');
        showErrorMessage('Not connected to server. Please refresh the page.');
        return;
    }

    console.log('Starting multiplayer trial:', trialIndex, design);

    socket.emit('start_trial', {
        trialIndex: trialIndex,
        experimentType: gameData.currentExperiment,
        design: design,
        roomId: roomId
    });
}

/**
 * Convert array movement to string direction
 */
function convertMovementToDirection(movement) {
    if (Array.isArray(movement)) {
        if (movement[0] === -1 && movement[1] === 0) return 'up';
        if (movement[0] === 1 && movement[1] === 0) return 'down';
        if (movement[0] === 0 && movement[1] === -1) return 'left';
        if (movement[0] === 0 && movement[1] === 1) return 'right';
    }
    return movement; // Return as-is if not an array
}

/**
 * Make a move in multiplayer game
 */
function makeMultiplayerMove(action) {
    console.log('🎮 makeMultiplayerMove called with action:', action);
    console.log('🎮 Socket connected:', socket && socket.connected);
    console.log('🎮 Game active:', isGameActive);

    if (!socket || !socket.connected) {
        console.error('Socket not connected. Cannot make move.');
        return;
    }

    if (!isGameActive) {
        console.log('Game not active. Ignoring move.');
        return;
    }

    // Convert array movement to string direction
    const direction = convertMovementToDirection(action);
    console.log('Making multiplayer move:', action, '->', direction);

    socket.emit('make_move', {
        action: direction,
        playerId: myPlayerId,
        roomId: roomId,
        timestamp: Date.now()
    });
}

/**
 * Record move from multiplayer partner
 */
function recordMoveMultiPlayer(data) {
    console.log('🎮 Received move from server:', data);
    console.log('🎮 My player ID:', myPlayerId);
    console.log('🎮 Partner player ID:', partnerPlayerId);
    console.log('🎮 Room players tracked:', roomPlayers);

    if (!data.gameState) {
        console.error('No game state received from server');
        return;
    }

    // Update local game state
    gameState = data.gameState;

    // Update player positions
    if (data.gameState.players && data.gameState.players[myPlayerId]) {
        gameData.player1 = data.gameState.players[myPlayerId].position;
        console.log('✅ Updated player1 position to:', gameData.player1);
    }

    if (data.gameState.players && data.gameState.players[partnerPlayerId]) {
        gameData.player2 = data.gameState.players[partnerPlayerId].position;
        console.log('✅ Updated player2 position to:', gameData.player2);
    } else {
        console.log('ℹ️ No partner position update - partnerPlayerId:', partnerPlayerId);
        console.log('Available players:', Object.keys(data.gameState.players || {}));
        console.log('Game state players:', data.gameState.players);

        // Try to find partner by checking all players in game state
        const availablePlayers = Object.keys(data.gameState.players || {});
        const otherPlayer = availablePlayers.find(playerId => playerId !== myPlayerId);
        if (otherPlayer) {
            console.log('🎮 Found other player in game state:', otherPlayer);
            gameData.player2 = data.gameState.players[otherPlayer].position;
            console.log('✅ Updated player2 position using fallback method:', gameData.player2);
        } else {
            console.error('❌ No other player found in game state');
        }
    }

    // Update step count
    if (data.gameState.stepCount !== undefined) {
        gameData.stepCount = data.gameState.stepCount;
    }

    // Update visualization
    if (typeof updateGameVisualization === 'function') {
        updateGameVisualization();
        console.log('✅ Game visualization updated');
    } else {
        console.error('❌ updateGameVisualization function not available');
    }

    // Record move data for later analysis
    if (data.move && data.move.playerId === partnerPlayerId) {
        recordPartnerMove(data.move.action, data.move.reactionTime);
    }
}

/**
 * Handle game started event
 */
function handleGameStarted(data) {
    console.log('🎮 Game started event received:', data);
    console.log('🎮 My player ID:', myPlayerId);
    console.log('🎮 Game state:', data.gameState);

    // Clear any game start timeout since the game is actually starting
    if (window.gameStartTimeout) {
        clearTimeout(window.gameStartTimeout);
        window.gameStartTimeout = null;
    }

    // Reset room full handled flag for next trial
    window.roomFullHandled = false;

    isGameActive = true;
    gameState = data.gameState;

    // Set player order based on server assignment
    if (data.playerOrder) {
        playerOrder.firstPlayerId = data.playerOrder.firstPlayerId;
        playerOrder.secondPlayerId = data.playerOrder.secondPlayerId;
        playerOrder.isFirstPlayer = (myPlayerId === data.playerOrder.firstPlayerId);

        console.log('🎮 Player order assignment:');
        console.log('  - First player (red):', data.playerOrder.firstPlayerId);
        console.log('  - Second player (orange):', data.playerOrder.secondPlayerId);
        console.log('  - My player ID:', myPlayerId);
        console.log('  - I am first player:', playerOrder.isFirstPlayer);
        console.log('  - My color should be:', playerOrder.isFirstPlayer ? 'RED' : 'ORANGE');
        console.log('  - playerOrder object after assignment:', playerOrder);
    }

    // Update game data
    if (data.gameState) {
        gameData.player1 = data.gameState.players[myPlayerId]?.position || [0, 0];
        gameData.player2 = data.gameState.players[partnerPlayerId]?.position || [0, 0];
        gameData.currentGoals = data.gameState.goals || [];
        gameData.gridMatrix = data.gameState.gridMatrix || [];
        gameData.currentPlayer = data.currentPlayer;
        gameData.stepCount = data.gameState.stepCount || 0;
    }

    // Update display with current game state
    if (typeof updateGameVisualization === 'function') {
        updateGameVisualization();
        console.log('✅ Game visualization updated');
    } else {
        console.error('❌ updateGameVisualization function not available');
    }

    // Update player color indicator
    if (typeof updatePlayerColorIndicator === 'function') {
        updatePlayerColorIndicator();
        console.log('✅ Player color indicator updated');
    } else {
        console.log('ℹ️ updatePlayerColorIndicator function not available, trying fallback');
        // Fallback: directly update the color indicator
        const colorIndicator = document.getElementById('playerColorIndicator');
        if (colorIndicator && playerOrder && playerOrder.isFirstPlayer !== undefined) {
            const playerColor = playerOrder.isFirstPlayer ? 'red' : 'orange';
            colorIndicator.style.backgroundColor = playerColor;
            console.log('🎨 Fallback: Updated player color indicator to:', playerColor);
        }
    }

    console.log('Multiplayer game started successfully');
    console.log('Game state:', {
        player1: gameData.player1,
        player2: gameData.player2,
        goals: gameData.currentGoals,
        gridMatrix: gameData.gridMatrix ? 'Grid matrix loaded' : 'No grid matrix',
        currentPlayer: gameData.currentPlayer,
        stepCount: gameData.stepCount
    });
}

/**
 * Handle trial started event
 */
function handleTrialStarted(data) {
    console.log('Trial started by server:', data);

    // Update trial index and game state
    gameData.currentTrial = data.trialIndex;

    if (data.gameState) {
        gameState = data.gameState;

        // Update local game data
        if (gameState.players && gameState.players[myPlayerId]) {
            gameData.player1 = gameState.players[myPlayerId].position;
        }

        if (gameState.players && gameState.players[partnerPlayerId]) {
            gameData.player2 = gameState.players[partnerPlayerId].position;
        } else if (partnerPlayerId) {
            console.log('ℹ️ Partner not yet available in trial state');
        }

        if (gameState.goals) {
            gameData.currentGoals = gameState.goals;
        }

        if (gameState.gridMatrix) {
            gameData.gridMatrix = gameState.gridMatrix;
        }
    }

    // Initialize trial data
    initializeTrialData(data.trialIndex, gameData.currentExperiment);

    // Update visualization
    updateGameVisualization();

    isGameActive = true;
}

/**
 * Handle trial complete event
 */
function handleTrialComplete(data) {
    console.log('Trial completed:', data);

    isGameActive = false;

    // Update final game state
    if (data.gameState) {
        gameState = data.gameState;
    }

    // Record collaboration result
    if (data.collaborationSucceeded !== undefined) {
        gameData.currentTrialData.collaborationSucceeded = data.collaborationSucceeded;
    }

    // Record final positions and goals
    if (data.finalGoals) {
        gameData.currentTrialData.player1FinalReachedGoal = data.finalGoals.player1Goal;
        gameData.currentTrialData.player2FinalReachedGoal = data.finalGoals.player2Goal;
    }

    // Finalize trial
    finalizeTrial(data.completed || false);

    // Proceed to next stage after delay (use the same delay as post-trial stage)
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.feedbackDisplayDuration);
}

/**
 * Show collaboration feedback
 */
function showCollaborationFeedback(data) {
    console.log('Showing collaboration feedback:', data);

    var container = document.getElementById('container');
    var feedbackMessage = '';

    if (data.collaborationSucceeded) {
        feedbackMessage = `
            <div style="text-align: center; color: green; font-size: 24px; margin: 20px;">
                <h2>🎉 Success!</h2>
                <p>You and your partner reached the same goal!</p>
            </div>
        `;
    } else {
        feedbackMessage = `
            <div style="text-align: center; color: #ff6b6b; font-size: 24px; margin: 20px;">
                <h2>No collaboration</h2>
                <p>You and your partner reached different goals.</p>
            </div>
        `;
    }

    container.innerHTML = feedbackMessage;

    // Auto-advance after showing feedback
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.feedbackDisplayDuration);
}

/**
 * Update connection status display
 */
function updateConnectionStatus(message) {
    var statusElement = document.getElementById('statusMessage');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('Status:', message);
}

/**
 * Attempt reconnection
 */
function attemptReconnection() {
    if (socket && !socket.connected) {
        console.log('Attempting to reconnect...');
        updateConnectionStatus('Attempting to reconnect...');
        socket.connect();
    }
}

/**
 * Show server not running message
 */
function showServerNotRunningMessage() {
    var container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; padding: 20px;">
                <h2 style="color: #dc3545; margin-bottom: 20px;">Server Not Available</h2>
                <p style="font-size: 18px; margin-bottom: 15px;">
                    The multiplayer server is not currently running. This is required for human-human experiments.
                </p>
                <p style="font-size: 16px; color: #6c757d; margin-bottom: 20px;">
                    Please contact the experiment administrator or try again later.
                </p>
                <button onclick="location.reload()"
                        style="background: #007bff; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Retry Connection
                </button>
            </div>
        </div>
    `;
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    var container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; padding: 20px;">
                <h2 style="color: #dc3545; margin-bottom: 20px;">Connection Error</h2>
                <p style="font-size: 18px; margin-bottom: 15px;">${message}</p>
                <button onclick="location.reload()"
                        style="background: #007bff; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Reload Page
                </button>
            </div>
        </div>
    `;
}

/**
 * Show partner disconnected message
 */
function showPartnerDisconnectedMessage() {
    var container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; padding: 20px;">
                <h2 style="color: #ffc107; margin-bottom: 20px;">Partner Disconnected</h2>
                <p style="font-size: 18px; margin-bottom: 15px;">
                    Your partner has left the game. Waiting for a new partner...
                </p>
                <div style="margin: 20px 0;">
                    <div style="border: 3px solid #f3f3f3; border-top: 3px solid #ffc107; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <button onclick="location.reload()"
                        style="background: #6c757d; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Start Over
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
    var container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; padding: 20px;">
                <h2 style="color: #dc3545; margin-bottom: 20px;">Connection Lost</h2>
                <p style="font-size: 18px; margin-bottom: 15px;">
                    Lost connection to the server. Attempting to reconnect...
                </p>
                <div style="margin: 20px 0;">
                    <div style="border: 3px solid #f3f3f3; border-top: 3px solid #dc3545; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>
                <button onclick="location.reload()"
                        style="background: #007bff; color: white; border: none; padding: 10px 20px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                    Reload Page
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
 * Show reconnection message
 */
function showReconnectionMessage() {
    updateConnectionStatus('Reconnection failed. Please reload the page.');
}

// Export functions for module usage
window.NetworkingHumanHuman = {
    // Connection management
    initializeSocket: initializeSocket,
    joinMultiplayerRoom: joinMultiplayerRoom,
    attemptReconnection: attemptReconnection,

    // Game actions
    startMultiplayerTrial: startMultiplayerTrial,
    makeMultiplayerMove: makeMultiplayerMove,

    // Event handlers
    handleRoomJoined: handleRoomJoined,
    handlePartnerJoined: handlePartnerJoined,
    handlePartnerLeft: handlePartnerLeft,
    handleGameStarted: handleGameStarted,
    handleTrialStarted: handleTrialStarted,
    handleTrialComplete: handleTrialComplete,
    recordMoveMultiPlayer: recordMoveMultiPlayer,
    showCollaborationFeedback: showCollaborationFeedback,

    // Status and messaging
    updateConnectionStatus: updateConnectionStatus,
    showServerNotRunningMessage: showServerNotRunningMessage,
    showErrorMessage: showErrorMessage,
    showPartnerDisconnectedMessage: showPartnerDisconnectedMessage,
    showDisconnectionMessage: showDisconnectionMessage,

    // State getters
    getSocket: () => socket,
    getGameState: () => gameState,
    getMyPlayerId: () => myPlayerId,
    getPartnerPlayerId: () => partnerPlayerId,
    getRoomId: () => roomId,
    isConnected: () => isConnected,
    isGameActive: () => isGameActive,
    getPlayerOrder: () => playerOrder
};