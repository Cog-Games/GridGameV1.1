// =================================================================================================
// Human-Human Real-time Multiplayer Server
// Handles WebSocket connections and game state management
// =================================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static('public'));
app.use(express.static(__dirname)); // Serve files from root directory

// Game rooms management
const gameRooms = new Map();
const playerSessions = new Map();

// Game configuration
const GAME_CONFIG = {
    maxPlayersPerRoom: 2,
    roomTimeout: 60000, // 60 seconds
    moveTimeout: 5000,  // 5 seconds
    maxGameLength: 50,
    syncInterval: 100,   // 100ms
    gridSize: 15,        // Updated to match map configurations
    enableSinglePlayerTesting: true,  // Allow single player testing
    debugMode: true      // Enable debug logging to troubleshoot new goal generation
};

// Load map data
let MapsFor2P2G = {};
let MapsFor2P3G = {};

// Load map configurations
function loadMapData() {
    try {
        // Load 2P2G maps
        const maps2P2GPath = path.join(__dirname, 'config', 'MapsFor2P2G.js');
        if (fs.existsSync(maps2P2GPath)) {
            const maps2P2GContent = fs.readFileSync(maps2P2GPath, 'utf8');
            // Extract the MapsFor2P2G object from the file
            const maps2P2GMatch = maps2P2GContent.match(/var MapsFor2P2G = ({[\s\S]*});/);
            if (maps2P2GMatch) {
                MapsFor2P2G = eval('(' + maps2P2GMatch[1] + ')');
                console.log('Loaded 2P2G maps:', Object.keys(MapsFor2P2G).length, 'maps');
            }
        }

        // Load 2P3G maps
        const maps2P3GPath = path.join(__dirname, 'config', 'MapsFor2P3G.js');
        if (fs.existsSync(maps2P3GPath)) {
            const maps2P3GContent = fs.readFileSync(maps2P3GPath, 'utf8');
            // Extract the MapsFor2P3G object from the file
            const maps2P3GMatch = maps2P3GContent.match(/var MapsFor2P3G = ({[\s\S]*});/);
            if (maps2P3GMatch) {
                MapsFor2P3G = eval('(' + maps2P3GMatch[1] + ')');
                console.log('Loaded 2P3G maps:', Object.keys(MapsFor2P3G).length, 'maps');
            }
        }
    } catch (error) {
        console.error('Error loading map data:', error);
    }
}

// Load maps on startup
loadMapData();

/**
 * Game Room Class
 */
class GameRoom {
    constructor(roomId, gameType) {
        this.roomId = roomId;
        this.gameType = gameType;
        this.players = new Map();
        this.readyPlayers = new Set();
        this.gameState = null;
        this.currentPlayer = null;
        this.gameActive = false;
        this.trialData = null;
        this.syncInterval = null;
        this.movementMode = 'simultaneous'; // Default to simultaneous movement
        this.currentTrial = 0;
        this.maxTrials = 12; // Default trial count
        this.newGoalPresented = false; // For 2P3G experiments
        this.goalGenerationInProgress = null;

        console.log(`Created game room ${roomId} for ${gameType}`);
    }

    addPlayer(playerId, socket) {
        if (this.players.size >= GAME_CONFIG.maxPlayersPerRoom) {
            return false;
        }

        this.players.set(playerId, {
            id: playerId,
            socket: socket,
            ready: false,
            position: null
        });

        console.log(`Player ${playerId} joined room ${this.roomId}`);

        // Notify all players in room
        this.broadcastToRoom('player_joined', {
            playerId: playerId,
            roomId: this.roomId,
            playerCount: this.players.size
        });

        return true;
    }

    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            this.players.delete(playerId);
            this.readyPlayers.delete(playerId);

            console.log(`Player ${playerId} left room ${this.roomId}`);

            // Notify remaining players
            this.broadcastToRoom('player_left', {
                playerId: playerId,
                roomId: this.roomId,
                playerCount: this.players.size
            });

            // If game was active, end it
            if (this.gameActive) {
                this.endGame();
            }
        }
    }

    setPlayerReady(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.ready = true;
            this.readyPlayers.add(playerId);

            console.log(`Player ${playerId} is ready in room ${this.roomId}`);

            // Check if all players are ready
            // Allow single player testing if enabled
            const shouldStartGame = GAME_CONFIG.enableSinglePlayerTesting ?
                (this.readyPlayers.size === this.players.size && this.players.size >= 1) :
                (this.readyPlayers.size === this.players.size && this.players.size >= 2);

            if (shouldStartGame) {
                this.startGame();
            }
        }
    }

    setMovementMode(mode) {
        this.movementMode = mode;
        console.log(`Movement mode set to ${mode} in room ${this.roomId}`);

        // Broadcast movement mode update
        this.broadcastToRoom('movement_mode_updated', {
            movementMode: mode
        });
    }

    startGame() {
        console.log(`Starting game in room ${this.roomId}`);

        this.gameActive = true;
        this.currentPlayer = Array.from(this.players.keys())[0]; // Start with first player

        // Initialize game state
        this.initializeGameState();

        // Notify all players that game is starting
        this.broadcastToRoom('game_started', {
            roomId: this.roomId,
            gameType: this.gameType,
            gameState: this.gameState,
            currentPlayer: this.currentPlayer,
            movementMode: this.movementMode
        });

        // Start state synchronization
        this.startStateSync();
    }

    initializeGameState() {
        // Use stored map design if available, otherwise use random selection
        let selectedMap;
        if (this.currentTrialDesign) {
            console.log('=== USING CLIENT-PROVIDED MAP DESIGN ===');
            console.log('Client trial design:', this.currentTrialDesign);
            selectedMap = this.convertClientDesignToServerMap(this.currentTrialDesign);
            console.log('Converted to server map:', selectedMap);
            this.currentTrialDesign = null; // Clear after use
        } else {
            console.log('=== USING RANDOM MAP SELECTION ===');
            console.log('No client design available, falling back to random selection');
            const mapData = this.loadMapData();
            console.log('Available map data:', mapData ? `${mapData.length} maps` : 'null');
            selectedMap = this.selectRandomMap(mapData);
            console.log('Selected random map:', selectedMap);
        }

        // Create grid matrix from map data
        const gridMatrix = this.createGridMatrix(selectedMap);

        // Generate distance condition for 2P3G experiments
        let distanceCondition = null;
        if (this.gameType === '2P3G') {
            distanceCondition = this.generateDistanceCondition();
        }

        this.gameState = {
            gridMatrix: gridMatrix,
            goals: selectedMap.goals,
            playerStates: {},
            currentPlayer: this.currentPlayer,
            stepCount: 0,
            trialStartTime: Date.now(),
            newGoalPresented: false,
            newGoalPosition: null,
            distanceCondition: distanceCondition // Add distance condition to game state
        };

        // Set initial player positions
        let playerIndex = 0;
        for (const [playerId, player] of this.players) {
            this.gameState.playerStates[playerId] = {
                position: playerIndex === 0 ? selectedMap.player1Pos : selectedMap.player2Pos,
                goalHistory: []
            };
            playerIndex++;
        }

        // Initialize trial data
        this.trialData = {
            trialIndex: this.currentTrial,
            experimentType: this.gameType,
            startTime: Date.now(),
            moves: [],
            playerMoves: {},
            goals: selectedMap.goals,
            success: false,
            completionTime: null,
            stepCount: 0,
            newGoalPresented: false,
            newGoalPosition: null
        };

        // Initialize player moves tracking
        for (const playerId of this.players.keys()) {
            this.trialData.playerMoves[playerId] = [];
        }

        console.log(`Initialized game state for trial ${this.currentTrial + 1}`);
        console.log('Player positions:', this.gameState.playerStates);
        console.log('Goals:', this.gameState.goals);
    }

    createGridMatrix(mapData) {
        // Create a 15x15 grid matrix
        const gridMatrix = Array(GAME_CONFIG.gridSize).fill(0).map(() => Array(GAME_CONFIG.gridSize).fill(0));

        // Add walls if specified in map data
        if (mapData.walls) {
            mapData.walls.forEach(wall => {
                gridMatrix[wall[0]][wall[1]] = 1; // 1 represents wall
            });
        }

        return gridMatrix;
    }

    loadMapData() {
        switch (this.gameType) {
            case '2P2G':
                return this.get2P2GMaps();
            case '2P3G':
                return this.get2P3GMaps();
            default:
                return this.getDefaultMapData();
        }
    }

    get2P2GMaps() {
        const maps = [];
        for (const mapId in MapsFor2P2G) {
            const mapData = MapsFor2P2G[mapId][0];
            const goals = [];

            // Add all available goals
            if (mapData.target1) {
                goals.push(mapData.target1);
            }
            if (mapData.target2) {
                goals.push(mapData.target2);
            }
            if (mapData.target3) {
                goals.push(mapData.target3);
            }

            maps.push({
                gridMatrix: null, // Will be created dynamically
                player1Pos: mapData.initPlayerGrid,
                player2Pos: mapData.initAIGrid,
                goals: goals,
                mapId: mapId
            });
        }
        return maps;
    }

    get2P3GMaps() {
        const maps = [];
        for (const mapId in MapsFor2P3G) {
            const mapData = MapsFor2P3G[mapId][0];
            const goals = [];

            // Add all available goals
            if (mapData.target1) {
                goals.push(mapData.target1);
            }
            if (mapData.target2) {
                goals.push(mapData.target2);
            }
            if (mapData.target3) {
                goals.push(mapData.target3);
            }

            maps.push({
                gridMatrix: null, // Will be created dynamically
                player1Pos: mapData.initPlayerGrid,
                player2Pos: mapData.initAIGrid,
                goals: goals,
                mapId: mapId
            });
        }
        return maps;
    }

    getDefaultMapData() {
        const defaultMap = {
            gridMatrix: null,
            player1Pos: [1, 1],
            player2Pos: [6, 6],
            goals: [[0, 0], [7, 7]]
        };

        return [defaultMap];
    }

    selectRandomMap(mapData) {
        const randomIndex = Math.floor(Math.random() * mapData.length);
        return mapData[randomIndex];
    }

    convertClientDesignToServerMap(clientDesign) {
        console.log('=== CONVERTING CLIENT DESIGN TO SERVER MAP ===');
        console.log('Client design:', clientDesign);

        // Convert client-side map design to server-side format
        const serverMap = {
            gridMatrix: null, // Will be created dynamically
            player1Pos: clientDesign.initPlayerGrid,
            player2Pos: clientDesign.initAIGrid,
            goals: []
        };

        // Add goals based on what's available in the client design
        if (clientDesign.target1) {
            serverMap.goals.push(clientDesign.target1);
            console.log('Added target1:', clientDesign.target1);
        }
        if (clientDesign.target2) {
            serverMap.goals.push(clientDesign.target2);
            console.log('Added target2:', clientDesign.target2);
        }
        if (clientDesign.target3) {
            serverMap.goals.push(clientDesign.target3);
            console.log('Added target3:', clientDesign.target3);
        }

        console.log('Converted client design to server map:', serverMap);
        console.log('=== END CONVERSION ===');
        return serverMap;
    }

    handleMove(playerId, moveData) {
        if (!this.gameActive) {
            return false;
        }

        // Check if it's the player's turn (for turn-based mode)
        if (this.movementMode === 'turn-based' && this.currentPlayer !== playerId) {
            return false;
        }

        const { action } = moveData;
        const playerState = this.gameState.playerStates[playerId];

        // Calculate new position from action
        const currentPosition = playerState.position;
        let newPosition = [...currentPosition];

        switch (action) {
            case 'up':
                newPosition[0] = Math.max(0, currentPosition[0] - 1);
                break;
            case 'down':
                newPosition[0] = Math.min(14, currentPosition[0] + 1);
                break;
            case 'left':
                newPosition[1] = Math.max(0, currentPosition[1] - 1);
                break;
            case 'right':
                newPosition[1] = Math.min(14, currentPosition[1] + 1);
                break;
            default:
                console.warn('Invalid action:', action);
                return false;
        }

        // Validate move
        if (this.isValidMove(newPosition)) {
            // Update player position
            const oldPosition = playerState.position;
            playerState.position = newPosition;

            // Record move
            this.recordMove(playerId, action, moveData.reactionTime);

            // Check for goal completion
            const goalReached = this.checkGoalCompletion(playerId, newPosition);

            // Check for new goal presentation in 2P3G (DISABLED - using client-side generation with synchronization)
            // if (this.gameType === '2P3G' && !this.gameState.newGoalPresented) {
            //     this.checkNewGoalPresentation();
            // }

            // Update game state
            this.gameState.stepCount++;

            // Switch turns only in turn-based mode
            if (this.movementMode === 'turn-based') {
                this.switchTurns();
            }

            // Broadcast move to all players
            this.broadcastToRoom('move_made', {
                playerId: playerId,
                action: action,
                reactionTime: moveData.reactionTime || 0,
                oldPosition: oldPosition,
                newPosition: newPosition,
                goalReached: goalReached,
                gameState: this.gameState,
                currentPlayer: this.currentPlayer,
                movementMode: this.movementMode
            });

            // Check if trial is complete
            if (this.checkTrialComplete()) {
                this.completeTrial();
            }

            return true;
        }

        return false;
    }

    checkNewGoalPresentation() {
        // Only check for 2P3G games
        if (this.gameType !== '2P3G') return;

        // Check minimum steps requirement
        if (this.gameState.stepCount < 1) return;

        const playerStates = Object.values(this.gameState.playerStates);
        if (playerStates.length < 2) return;

        // Get player IDs from the players map
        const playerIds = Array.from(this.players.keys());
        const player1Id = playerIds[0];
        const player2Id = playerIds[1];

        const player1 = this.gameState.playerStates[player1Id];
        const player2 = this.gameState.playerStates[player2Id];

        // Get the most recent moves to detect goals
        const player1Moves = this.trialData.playerMoves[player1Id] || [];
        const player2Moves = this.trialData.playerMoves[player2Id] || [];

        if (player1Moves.length === 0 || player2Moves.length === 0) return;

        // Get the most recent move for each player
        const player1LastMove = player1Moves[player1Moves.length - 1];
        const player2LastMove = player2Moves[player2Moves.length - 1];

        // Detect which goal each player is heading towards
        const player1Goal = this.detectPlayerGoal(player1.position, player1LastMove.action, this.gameState.goals);
        const player2Goal = this.detectPlayerGoal(player2.position, player2LastMove.action, this.gameState.goals);

        console.log(`Goal detection - Player1: ${player1Goal}, Player2: ${player2Goal}, Step: ${this.gameState.stepCount}`);

        // Check if both players are heading to the same goal and new goal hasn't been presented yet
        // ENABLED: Server-side new goal generation using client requests
        if (player1Goal !== null && player1Goal === player2Goal && !this.gameState.newGoalPresented) {
            console.log('Both players heading to same goal, server will handle goal generation via client requests');
            // The actual goal generation will be triggered by client requests
            // This method now just logs the detection for debugging
        }
    }

    detectPlayerGoal(playerPos, action, goals) {
        if (!action || !goals || goals.length === 0) {
            return null;
        }

        // Convert action to movement vector
        let movement = [0, 0];
        switch (action) {
            case 'up':
                movement = [-1, 0];
                break;
            case 'down':
                movement = [1, 0];
                break;
            case 'left':
                movement = [0, -1];
                break;
            case 'right':
                movement = [0, 1];
                break;
            default:
                return null;
        }

        // Calculate the intended next position based on action
        const intendedNextPos = [playerPos[0] + movement[0], playerPos[1] + movement[1]];

        // Find the goal that the player is moving towards
        let closestGoalIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < goals.length; i++) {
            const goal = goals[i];
            const distance = this.calculateGridDistance(intendedNextPos, goal);

            if (distance < minDistance) {
                minDistance = distance;
                closestGoalIndex = i;
            }
        }

        // Check if the player is actually moving towards a goal (not away from it)
        const currentDistanceToClosestGoal = this.calculateGridDistance(playerPos, goals[closestGoalIndex]);
        const nextDistanceToClosestGoal = this.calculateGridDistance(intendedNextPos, goals[closestGoalIndex]);

        // Player is heading towards the goal if the distance decreases
        if (nextDistanceToClosestGoal < currentDistanceToClosestGoal) {
            return closestGoalIndex;
        }

        return null;
    }

    calculateGridDistance(pos1, pos2) {
        return Math.abs(pos1[0] - pos2[0]) + Math.abs(pos1[1] - pos2[1]);
    }

    presentNewGoal(sharedGoalIndex) {
        if (this.gameState.newGoalPresented) return;

        const playerStates = Object.values(this.gameState.playerStates);
        const player1 = playerStates[0];
        const player2 = playerStates[1];
        const sharedGoal = this.gameState.goals[sharedGoalIndex];

        if (GAME_CONFIG.debugMode) {
            console.log(`=== SERVER NEW GOAL PRESENTATION ===`);
            console.log(`Room: ${this.roomId}, Trial: ${this.currentTrial + 1}`);
            console.log(`Player1 pos: ${player1.position}, Player2 pos: ${player2.position}`);
            console.log(`Shared goal: ${sharedGoal} (index: ${sharedGoalIndex})`);
            console.log(`Distance condition: ${this.gameState.distanceCondition}`);
        }

        // Generate new goal using the same logic as client but with server's distance condition
        const newGoal = this.generateNewGoalWithServerLogic(player1.position, player2.position, sharedGoal, sharedGoalIndex);

        if (newGoal) {
            this.gameState.goals.push(newGoal);
            this.gameState.newGoalPresented = true;
            this.gameState.newGoalPosition = newGoal;

            this.trialData.newGoalPresented = true;
            this.trialData.newGoalPosition = newGoal;

            console.log(`✅ Server generated new goal at position ${newGoal} in room ${this.roomId}`);

            // Broadcast new goal to all players
            this.broadcastToRoom('new_goal_presented', {
                newGoal: newGoal,
                gameState: this.gameState,
                distanceCondition: this.gameState.distanceCondition
            });
        } else {
            console.log(`❌ Server failed to generate new goal in room ${this.roomId}`);
        }
    }

    generateNewGoalWithServerLogic(player1Pos, player2Pos, sharedGoal, sharedGoalIndex, distanceCondition) {
        // Only log in debug mode
        if (GAME_CONFIG.debugMode) {
            console.log('=== SERVER GENERATE NEW GOAL DEBUG ===');
            console.log('player1Pos:', player1Pos, 'player2Pos:', player2Pos);
            console.log('sharedGoal:', sharedGoal, 'sharedGoalIndex:', sharedGoalIndex);
            console.log('distanceCondition:', distanceCondition);
        }

        // Check if no new goal should be generated
        if (distanceCondition === 'no_new_goal') {
            if (GAME_CONFIG.debugMode) {
                console.log('NO_NEW_GOAL condition - returning null');
            }
            return null;
        }

        if (sharedGoalIndex === null || sharedGoalIndex >= this.gameState.goals.length) {
            if (GAME_CONFIG.debugMode) {
                console.log('Invalid sharedGoalIndex - returning null');
            }
            return null;
        }

        const oldDistanceSum = this.calculateGridDistance(player2Pos, sharedGoal) +
                              this.calculateGridDistance(player1Pos, sharedGoal);

        if (GAME_CONFIG.debugMode) {
            console.log('sharedGoal:', sharedGoal, 'oldDistanceSum:', oldDistanceSum);
        }

        // Find all valid positions for the new goal based on distance condition
        const validPositions = [];
        let useRelaxedConstraints = false;

        // Pre-calculate distances to old goal for efficiency
        const player2DistanceToOldGoal = this.calculateGridDistance(player2Pos, sharedGoal);
        const player1DistanceToOldGoal = this.calculateGridDistance(player1Pos, sharedGoal);

        // First pass: try with strict constraints
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const newGoal = [row, col];

                // Check if position is not occupied by players or obstacles
                if (this.gameState.gridMatrix[row][col] === 0 || this.gameState.gridMatrix[row][col] === 2) {
                    const newGoalDistanceToPlayer2 = this.calculateGridDistance(player2Pos, newGoal);
                    const newGoalDistanceToPlayer1 = this.calculateGridDistance(player1Pos, newGoal);
                    const newDistanceSum = newGoalDistanceToPlayer2 + newGoalDistanceToPlayer1;

                    // Basic constraints that apply to all conditions
                    const player1DistanceConstraint = newGoalDistanceToPlayer1 >= 1 && newGoalDistanceToPlayer1 <= 10;

                    // Distance condition-specific constraints
                    let distanceConditionMet = false;
                    let conditionType = '';

                    switch (distanceCondition) {
                                            case 'closer_to_player2':
                        // New goal closer to player2
                        distanceConditionMet = newGoalDistanceToPlayer2 < player2DistanceToOldGoal - 1;
                        conditionType = 'closer_to_player2';
                        break;

                    case 'closer_to_player1':
                        // New goal closer to player1
                        distanceConditionMet = newGoalDistanceToPlayer1 < player1DistanceToOldGoal - 1;
                        conditionType = 'closer_to_player1';
                        break;

                                            case 'equal_to_both':
                        // New goal equal distance to both player1 and player2, equal joint distance
                        const distanceDifference = Math.abs(newGoalDistanceToPlayer2 - newGoalDistanceToPlayer1);
                        distanceConditionMet = distanceDifference <= 1; // More reasonable tolerance
                        conditionType = 'equal_to_both';
                        break;

                        default:
                            if (GAME_CONFIG.debugMode) {
                                console.log('Unknown distance condition:', distanceCondition);
                            }
                            return null;
                    }

                    if (distanceConditionMet && player1DistanceConstraint) {
                        validPositions.push({
                            position: newGoal,
                            conditionType: conditionType,
                            distanceToPlayer2: newGoalDistanceToPlayer2,
                            distanceToPlayer1: newGoalDistanceToPlayer1,
                            distanceSum: newDistanceSum
                        });
                    }
                }
            }
        }

        // If no valid positions found with strict constraints, try with relaxed constraints for EQUAL_TO_BOTH
        if (validPositions.length === 0 && distanceCondition === 'equal_to_both') {
            if (GAME_CONFIG.debugMode) {
                console.log('No valid positions found with strict constraints, trying with relaxed constraints...');
            }
            useRelaxedConstraints = true;

            for (let row = 0; row < 15; row++) {
                for (let col = 0; col < 15; col++) {
                    const newGoal = [row, col];

                    // Check if position is not occupied by players or obstacles
                    if (this.gameState.gridMatrix[row][col] === 0 || this.gameState.gridMatrix[row][col] === 2) {
                        const newGoalDistanceToPlayer2 = this.calculateGridDistance(player2Pos, newGoal);
                        const newGoalDistanceToPlayer1 = this.calculateGridDistance(player1Pos, newGoal);
                        const newDistanceSum = newGoalDistanceToPlayer2 + newGoalDistanceToPlayer1;

                        // Basic constraints that apply to all conditions
                        const player1DistanceConstraint = newGoalDistanceToPlayer1 >= 1 && newGoalDistanceToPlayer1 <= 10;

                        // Relaxed distance condition constraint for EQUAL_TO_BOTH
                        const distanceDifference = Math.abs(newGoalDistanceToPlayer2 - newGoalDistanceToPlayer1);
                        const distanceConditionMet = distanceDifference <= 2; // Remove sum constraint

                        if (distanceConditionMet && player1DistanceConstraint) {
                            validPositions.push({
                                position: newGoal,
                                conditionType: 'equal_to_both_relaxed',
                                distanceToPlayer2: newGoalDistanceToPlayer2,
                                distanceToPlayer1: newGoalDistanceToPlayer1,
                                distanceSum: newDistanceSum
                            });
                        }
                    }
                }
            }
        }

        if (GAME_CONFIG.debugMode) {
            console.log(`Found ${validPositions.length} valid positions for distance condition: ${distanceCondition}`);
        }

        if (validPositions.length > 0) {
            // Select a random valid position
            const randomIndex = Math.floor(Math.random() * validPositions.length);
            const selectedPosition = validPositions[randomIndex];

            if (GAME_CONFIG.debugMode) {
                console.log(`Selected position: ${selectedPosition.position}`);
                console.log(`Condition type: ${selectedPosition.conditionType}`);
                console.log(`Distances - Player2: ${selectedPosition.distanceToPlayer2}, Player1: ${selectedPosition.distanceToPlayer1}`);
            }

            return selectedPosition.position;
        } else {
            if (GAME_CONFIG.debugMode) {
                console.log('No valid positions found for new goal generation');
            }
            return null;
        }
    }

    isValidMove(newPosition) {
        if (!newPosition || !Array.isArray(newPosition) || newPosition.length !== 2) {
            return false;
        }

        const [row, col] = newPosition;
        const gridMatrix = this.gameState.gridMatrix;

        // Check bounds
        if (row < 0 || row >= gridMatrix.length ||
            col < 0 || col >= gridMatrix[0].length) {
            return false;
        }

        // Check if cell is walkable
        return gridMatrix[row][col] !== 1; // 1 represents wall
    }

    checkGoalCompletion(playerId, position) {
        const goals = this.gameState.goals;
        const playerState = this.gameState.playerStates[playerId];

        for (let i = 0; i < goals.length; i++) {
            if (position[0] === goals[i][0] && position[1] === goals[i][1]) {
                if (!playerState.goalHistory.includes(i)) {
                    playerState.goalHistory.push(i);
                    return true;
                }
            }
        }

        return false;
    }

    checkTrialComplete() {
        // Check if both players have reached goals
        let allPlayersReachedGoals = true;

        for (const [playerId, playerState] of Object.entries(this.gameState.playerStates)) {
            if (playerState.goalHistory.length === 0) {
                allPlayersReachedGoals = false;
                break;
            }
        }

        return allPlayersReachedGoals;
    }

    recordMove(playerId, action, reactionTime) {
        if (this.trialData && this.trialData.playerMoves[playerId]) {
            this.trialData.playerMoves[playerId].push({
                action: action,
                reactionTime: reactionTime,
                timestamp: Date.now(),
                stepCount: this.gameState.stepCount
            });
        }
    }

    switchTurns() {
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentPlayer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        this.currentPlayer = playerIds[nextIndex];
        this.gameState.currentPlayer = this.currentPlayer;
    }

    completeTrial() {
        console.log(`Completing trial ${this.currentTrial + 1} in room ${this.roomId}`);

        // Calculate success
        const success = this.calculateSuccess();
        this.trialData.success = success;
        this.trialData.completionTime = Date.now();
        this.trialData.stepCount = this.gameState.stepCount;

        // Broadcast trial completion
        this.broadcastToRoom('trial_complete', {
            roomId: this.roomId,
            trialData: this.trialData,
            success: success,
            currentTrial: this.currentTrial + 1,
            maxTrials: this.maxTrials
        });

        // Increment trial counter
        this.currentTrial++;

        // Check if we should continue to next trial
        if (this.currentTrial < this.maxTrials) {
            // Start next trial after a delay
            setTimeout(() => {
                this.startNextTrial();
            }, 2000);
        } else {
            // Experiment complete
            this.endGame();
        }
    }

    startNextTrial() {
        console.log(`Starting trial ${this.currentTrial + 1} in room ${this.roomId}`);

        // Reset game state for new trial
        this.gameState = null;
        this.gameActive = false;
        this.newGoalPresented = false;

        // Initialize new game state
        this.initializeGameState();

        // Start the game again
        this.gameActive = true;
        this.currentPlayer = Array.from(this.players.keys())[0];

        // Notify players of new trial
        this.broadcastToRoom('trial_started', {
            roomId: this.roomId,
            gameState: this.gameState,
            currentPlayer: this.currentPlayer,
            currentTrial: this.currentTrial + 1,
            maxTrials: this.maxTrials
        });
    }

    calculateSuccess() {
        // Simple success calculation: both players reached the same goal
        const playerStates = Object.values(this.gameState.playerStates);
        if (playerStates.length < 2) return false;

        const player1 = playerStates[0];
        const player2 = playerStates[1];

        // Check if both players reached the same goal
        for (let i = 0; i < this.gameState.goals.length; i++) {
            if (player1.goalHistory.includes(i) && player2.goalHistory.includes(i)) {
                return true;
            }
        }

        return false;
    }

    endGame() {
        console.log(`Ending game in room ${this.roomId}`);

        this.gameActive = false;
        this.stopStateSync();

        // Broadcast game end
        this.broadcastToRoom('game_ended', {
            roomId: this.roomId,
            finalTrialData: this.trialData
        });

        // Clean up room after a delay
        setTimeout(() => {
            gameRooms.delete(this.roomId);
            console.log(`Cleaned up room ${this.roomId}`);
        }, 5000);
    }

    startStateSync() {
        this.syncInterval = setInterval(() => {
            if (this.gameActive && this.gameState) {
                this.broadcastToRoom('game_state_update', {
                    gameState: this.gameState,
                    currentPlayer: this.currentPlayer
                });
            }
        }, GAME_CONFIG.syncInterval);
    }

    stopStateSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    broadcastToRoom(event, data) {
        // Only log broadcasts in debug mode or for important events
        if (GAME_CONFIG.debugMode || event !== 'game_state_update') {
            console.log(`🔍 Broadcasting ${event} to ${this.players.size} players in room ${this.roomId}`);
        }

        for (const [playerId, player] of this.players) {
            if (GAME_CONFIG.debugMode || event !== 'game_state_update') {
                console.log(`🔍 Sending ${event} to player ${playerId}`);
            }
            player.socket.emit(event, data);
        }

        if (GAME_CONFIG.debugMode || event !== 'game_state_update') {
            console.log(`🔍 Broadcast complete for ${event}`);
        }
    }

    getRoomInfo() {
        return {
            roomId: this.roomId,
            gameType: this.gameType,
            playerCount: this.players.size,
            readyCount: this.readyPlayers.size,
            gameActive: this.gameActive,
            currentTrial: this.currentTrial + 1,
            maxTrials: this.maxTrials
        };
    }

    isPositionOccupied(position) {
        // Check if position is occupied by players
        for (const playerState of Object.values(this.gameState.playerStates)) {
            if (playerState.position[0] === position[0] && playerState.position[1] === position[1]) {
                return true;
            }
        }

        // Check if position is occupied by goals
        for (const goal of this.gameState.goals) {
            if (goal[0] === position[0] && goal[1] === position[1]) {
                return true;
            }
        }

        return false;
    }

    generateNewGoalPosition() {
        // Simple random goal generation
        const gridSize = GAME_CONFIG.gridSize;
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const row = Math.floor(Math.random() * gridSize);
            const col = Math.floor(Math.random() * gridSize);

            // Check if position is not occupied by players or existing goals
            const isOccupied = this.isPositionOccupied([row, col]);
            if (!isOccupied) {
                return [row, col];
            }
            attempts++;
        }

        // Fallback to a safe position
        return [gridSize - 1, gridSize - 1];
    }

    generateDistanceCondition() {
        // Distance conditions for 2P3G experiments
        const distanceConditions = {
            CLOSER_TO_PLAYER2: 'closer_to_player2',
            CLOSER_TO_PLAYER1: 'closer_to_player1',
            EQUAL_TO_BOTH: 'equal_to_both',
            NO_NEW_GOAL: 'no_new_goal'
        };

        // Generate deterministic distance condition based on room ID and trial index
        const seed = this.roomId + '_' + this.currentTrial;
        const hash = this.simpleHash(seed);

        // Define all possible conditions
        const allConditions = [
            distanceConditions.CLOSER_TO_PLAYER2,
            distanceConditions.CLOSER_TO_PLAYER1,
            distanceConditions.EQUAL_TO_BOTH,
            distanceConditions.NO_NEW_GOAL
        ];

        // Select condition based on hash
        const selectedCondition = allConditions[hash % allConditions.length];

        console.log(`Generated distance condition for room ${this.roomId}, trial ${this.currentTrial + 1}: ${selectedCondition}`);

        return selectedCondition;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}

/**
 * Socket.IO Connection Handler
 */
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    let currentRoom = null;
    let currentGameType = null;

    // Handle player joining a game
    socket.on('join_game', (data) => {
        const { gameType } = data;
        currentGameType = gameType;

        console.log(`Player ${socket.id} wants to join ${gameType} game`);

        // Find or create a room
        let room = findAvailableRoom(gameType);
        if (!room) {
            const roomId = generateRoomId();
            room = new GameRoom(roomId, gameType);
            gameRooms.set(roomId, room);
        }

        // Add player to room
        if (room.addPlayer(socket.id, socket)) {
            currentRoom = room;
            playerSessions.set(socket.id, { roomId: room.roomId, gameType: gameType });

            // Notify player they joined
            socket.emit('joined_room', {
                roomId: room.roomId,
                playerId: socket.id,
                gameType: gameType,
                playerCount: room.players.size
            });

            // If room is full, notify all players
            if (room.players.size >= GAME_CONFIG.maxPlayersPerRoom) {
                room.broadcastToRoom('room_full', {
                    roomId: room.roomId,
                    playerCount: room.players.size
                });
            }
        } else {
            socket.emit('room_full', { message: 'Room is full' });
        }
    });

    // Handle player ready
    socket.on('player_ready', (data) => {
        if (currentRoom) {
            currentRoom.setPlayerReady(socket.id);
        }
    });

    // Handle player move
    socket.on('make_move', (data) => {
        if (currentRoom) {
            const success = currentRoom.handleMove(socket.id, data);
            if (!success) {
                const message = currentRoom.movementMode === 'turn-based' ?
                    'Invalid move or not your turn' : 'Invalid move';
                socket.emit('move_rejected', { message: message });
            }
        }
    });

    // Handle movement mode setting
    socket.on('set_movement_mode', (data) => {
        if (currentRoom && !currentRoom.gameActive) {
            currentRoom.setMovementMode(data.movementMode || 'simultaneous');
        }
    });

    // Handle new goal request (new server-side logic for 2P3G)
    socket.on('request_new_goal', (data) => {
        console.log(`📨 REQUEST_NEW_GOAL received from ${socket.id}`);
        console.log(`📨 Current room:`, currentRoom ? currentRoom.roomId : 'null');
        console.log(`📨 Game type:`, currentRoom ? currentRoom.gameType : 'null');
        console.log(`📨 Request data:`, data);



        if (currentRoom && (currentRoom.gameType === '2P3G' || currentRoom.gameType === '2P2G')) {


            // Check if another player is already requesting a goal
            if (currentRoom.goalGenerationInProgress) {
                return;
            }

            // Set the lock to prevent other players from requesting
            currentRoom.goalGenerationInProgress = socket.id;



            // Generate new goal using server-side logic
            let newGoal = null;
            try {
                newGoal = currentRoom.generateNewGoalWithServerLogic(
                    data.player2Pos,
                    data.player1Pos,
                    data.currentGoals[data.sharedGoalIndex],
                    data.sharedGoalIndex,
                    data.distanceCondition
                );


            } catch (error) {
                console.error(`❌ Error in generateNewGoalWithServerLogic:`, error);
                newGoal = null;
            }

            if (newGoal) {
                // Broadcast new goal to ALL players in the room

                const goalData = {
                    newGoalPosition: newGoal,
                    distanceCondition: data.distanceCondition,
                    stepCount: data.stepCount,
                    trialIndex: data.trialIndex,
                    generatedBy: 'server'
                };
                currentRoom.broadcastToRoom('server_new_goal', goalData);

                // Update server's game state
                if (currentRoom.gameState) {
                    currentRoom.gameState.goals.push(newGoal);
                    currentRoom.gameState.newGoalPresented = true;
                    currentRoom.gameState.newGoalPosition = newGoal;
                }
            } else {

                // Send failure response to client so it doesn't timeout
                socket.emit('server_new_goal_failed', {
                    reason: 'No valid goal position found',
                    distanceCondition: data.distanceCondition
                });
            }

            // Clear the lock after processing
            setTimeout(() => {
                if (currentRoom && currentRoom.goalGenerationInProgress === socket.id) {
                    currentRoom.goalGenerationInProgress = null;
                }
            }, 1000);
        }
    });

        // Handle fallback goal sharing between players
    socket.on('share_fallback_goal', (data) => {
        if (currentRoom) {
            // Broadcast to all other players in the room
            for (const [playerId, player] of currentRoom.players) {
                if (playerId !== socket.id) {
                    player.socket.emit('share_fallback_goal', data);
                }
            }
        }
    });

        // Handle start trial with map design
    socket.on('start_trial', (data) => {
        console.log(`=== SERVER RECEIVED START_TRIAL ===`);
        console.log(`Player ${socket.id} starting trial with design:`, data);
        console.log(`Trial index: ${data.trialIndex}`);
        console.log(`Experiment type: ${data.experimentType}`);
        console.log(`Map design:`, data.design);

        if (currentRoom) {
            // Store the map design for this trial
            currentRoom.currentTrialDesign = data.design;
            console.log(`Stored map design for trial ${data.trialIndex} in room ${currentRoom.roomId}`);
        } else {
            console.log(`No current room found for player ${socket.id}`);
        }
        console.log(`=== END START_TRIAL HANDLER ===`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        if (currentRoom) {
            currentRoom.removePlayer(socket.id);

            // Clean up empty rooms
            if (currentRoom.players.size === 0) {
                gameRooms.delete(currentRoom.roomId);
                console.log(`Removed empty room ${currentRoom.roomId}`);
            }
        }

        playerSessions.delete(socket.id);
    });
});

/**
 * Find Available Room
 */
function findAvailableRoom(gameType) {
    for (const [roomId, room] of gameRooms) {
        if (room.gameType === gameType &&
            room.players.size < GAME_CONFIG.maxPlayersPerRoom &&
            !room.gameActive) {
            return room;
        }
    }
    return null;
}

/**
 * Generate Room ID
 */
function generateRoomId() {
    return 'room_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Clean up inactive rooms
 */
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of gameRooms) {
        if (room.players.size === 0) {
            gameRooms.delete(roomId);
            console.log(`Cleaned up empty room ${roomId}`);
        }
    }
}, 30000); // Clean up every 30 seconds

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/test', (req, res) => {
    res.json({
        status: 'Server is running',
        timestamp: new Date().toISOString(),
        socketio: 'Available'
    });
});

app.get('/test-human-human', (req, res) => {
    res.sendFile(path.join(__dirname, 'test_human_human.html'));
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: gameRooms.size,
        players: playerSessions.size,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 4000;

// Check for debug mode flag
if (process.argv.includes('--debug')) {
    GAME_CONFIG.debugMode = true;
    console.log('🔍 Debug mode enabled - verbose logging active');
}

server.listen(PORT, () => {
    console.log(`Human-Human Multiplayer Server running on port ${PORT}`);
    console.log(`Access the experiment at: http://localhost:${PORT}`);
    console.log(`Test interface at: http://localhost:${PORT}/test`);
    console.log(`Debug mode: ${GAME_CONFIG.debugMode ? 'ON' : 'OFF'}`);
});