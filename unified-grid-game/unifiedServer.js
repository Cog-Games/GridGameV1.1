/**
 * Unified Grid Game Server
 *
 * Supports both Human-AI and Human-Human experiment modes
 * Handles real-time multiplayer coordination and experiment management
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// =================================================================================================
// SERVER CONFIGURATION
// =================================================================================================

const SERVER_CONFIG = {
    port: process.env.PORT || 3000,

    // Experiment mode - this can be overridden by client requests
    defaultExperimentMode: 'human-ai', // 'human-ai' or 'human-human'

    // Human-Human multiplayer settings
    multiplayer: {
        maxPlayersPerRoom: 2,
        roomTimeout: 120000,        // 2 minutes room timeout
        playerTimeout: 60000,       // 1 minute player timeout
        syncTimeout: 10000,         // 10 seconds sync timeout
        maxRooms: 100,              // Maximum concurrent rooms
        cleanupInterval: 300000,    // 5 minutes cleanup interval
        enableSinglePlayerTesting: false
    },

    // Human-AI settings
    humanAI: {
        enableStandalone: true,     // Allow standalone human-AI games
        aiResponseDelay: 300,       // AI action delay (ms)
        maxConcurrentSessions: 200  // Maximum concurrent human-AI sessions
    },

    // Data collection settings
    dataCollection: {
        enableLogging: true,
        logDirectory: './logs',
        exportFormats: ['json', 'csv'],
        autoBackup: true,
        backupInterval: 3600000     // 1 hour
    }
};

// =================================================================================================
// SERVER SETUP
// =================================================================================================

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================================================
// DATA STRUCTURES
// =================================================================================================

// Game rooms for human-human mode
const gameRooms = new Map();
const waitingPlayers = new Map();

// Human-AI sessions
const humanAISessions = new Map();

// Connection tracking
const connectionLog = [];
const activeConnections = new Map();

// Map data cache
let mapData = {
    '1P1G': {},
    '1P2G': {},
    '2P2G': {},
    '2P3G': {}
};

// =================================================================================================
// MAP DATA LOADING
// =================================================================================================

/**
 * Load map data from files
 */
function loadMapData() {
    console.log('Loading map data...');

    const mapFiles = [
        { key: '1P1G', file: 'MapsFor1P1G.js' },
        { key: '1P2G', file: 'MapsFor1P2G.js' },
        { key: '2P2G', file: 'MapsFor2P2G.js' },
        { key: '2P3G', file: 'MapsFor2P3G.js' }
    ];

    mapFiles.forEach(({ key, file }) => {
        try {
            const filePath = path.join(__dirname, '../public/config', file);

            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const match = content.match(new RegExp(`var MapsFor${key} = ({[\\s\\S]*});`));

                if (match) {
                    mapData[key] = eval('(' + match[1] + ')');
                    console.log(`Loaded ${key} maps: ${Object.keys(mapData[key]).length} maps`);
                } else {
                    console.warn(`Could not parse ${file}`);
                }
            } else {
                console.warn(`Map file not found: ${file}`);
            }
        } catch (error) {
            console.error(`Error loading ${file}:`, error);
        }
    });
}

// Load maps on startup
loadMapData();

// =================================================================================================
// GAME ROOM CLASS (for Human-Human mode)
// =================================================================================================

class GameRoom {
    constructor(roomId, experimentMode = 'human-human') {
        this.roomId = roomId;
        this.experimentMode = experimentMode;
        this.players = new Map();
        this.readyPlayers = new Set();
        this.gameState = null;
        this.currentExperiment = null;
        this.currentTrial = 0;
        this.maxTrials = 12;
        this.trialData = [];
        this.gameActive = false;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();

        // Experiment tracking
        this.experimentOrder = ['1P1G', '1P2G', '2P2G', '2P3G'];
        this.currentExperimentIndex = 0;
        this.allExperimentData = [];

        console.log(`Created game room ${roomId} for ${experimentMode} mode`);
    }

    /**
     * Add player to room
     */
    addPlayer(playerId, socket, playerData = {}) {
        if (this.players.size >= SERVER_CONFIG.multiplayer.maxPlayersPerRoom) {
            return false;
        }

        this.players.set(playerId, {
            id: playerId,
            socket: socket,
            joinTime: Date.now(),
            ready: false,
            position: null,
            actions: [],
            isHost: this.players.size === 0, // First player is host
            ...playerData
        });

        this.lastActivity = Date.now();

        console.log(`Player ${playerId} joined room ${this.roomId} (${this.players.size}/${SERVER_CONFIG.multiplayer.maxPlayersPerRoom})`);

        return true;
    }

    /**
     * Remove player from room
     */
    removePlayer(playerId) {
        if (this.players.has(playerId)) {
            this.players.delete(playerId);
            this.readyPlayers.delete(playerId);
            this.lastActivity = Date.now();

            console.log(`Player ${playerId} left room ${this.roomId}`);

            // Notify remaining players
            this.broadcast('partner_disconnected', {
                playerId: playerId,
                message: 'Your partner has disconnected'
            }, playerId);

            return true;
        }
        return false;
    }

    /**
     * Set player ready status
     */
    setPlayerReady(playerId, ready = true) {
        if (this.players.has(playerId)) {
            this.players.get(playerId).ready = ready;

            if (ready) {
                this.readyPlayers.add(playerId);
            } else {
                this.readyPlayers.delete(playerId);
            }

            this.lastActivity = Date.now();

            // Check if all players are ready
            if (this.readyPlayers.size === this.players.size && this.players.size >= 2) {
                this.startExperiment();
            }
        }
    }

    /**
     * Start experiment
     */
    startExperiment() {
        if (this.gameActive) return;

        console.log(`Starting experiment in room ${this.roomId}`);

        this.gameActive = true;
        this.currentExperimentIndex = 0;
        this.currentTrial = 0;

        this.broadcast('experiment_started', {
            roomId: this.roomId,
            experimentOrder: this.experimentOrder,
            players: Array.from(this.players.keys())
        });

        this.startNextExperiment();
    }

    /**
     * Start next experiment condition
     */
    startNextExperiment() {
        if (this.currentExperimentIndex >= this.experimentOrder.length) {
            this.completeAllExperiments();
            return;
        }

        this.currentExperiment = this.experimentOrder[this.currentExperimentIndex];
        this.currentTrial = 0;

        console.log(`Room ${this.roomId}: Starting experiment ${this.currentExperiment}`);

        this.broadcast('condition_started', {
            condition: this.currentExperiment,
            conditionIndex: this.currentExperimentIndex,
            totalConditions: this.experimentOrder.length
        });

        // Start first trial after a brief delay
        setTimeout(() => this.startNextTrial(), 2000);
    }

    /**
     * Start next trial
     */
    startNextTrial() {
        const maxTrials = this.getMaxTrialsForExperiment(this.currentExperiment);

        if (this.currentTrial >= maxTrials) {
            this.completeCurrentExperiment();
            return;
        }

        console.log(`Room ${this.roomId}: Starting trial ${this.currentTrial + 1} of ${this.currentExperiment}`);

        // Initialize trial data
        const trialData = this.initializeTrialData();

        this.broadcast('trial_started', {
            trialIndex: this.currentTrial,
            trialData: trialData,
            experimentType: this.currentExperiment
        });

        this.gameState = {
            trial: this.currentTrial,
            experiment: this.currentExperiment,
            gridMatrix: trialData.gridMatrix,
            goals: trialData.goals,
            players: {},
            stepCount: 0,
            startTime: Date.now(),
            maxSteps: 50
        };

        // Set initial player positions
        let playerIndex = 0;
        for (const [playerId, player] of this.players) {
            const startPos = playerIndex === 0 ? trialData.playerStart : trialData.partnerStart;
            this.gameState.players[playerId] = startPos;
            player.position = startPos;
            playerIndex++;
        }

        // Send initial game state
        this.broadcast('game_step', {
            gameState: this.gameState,
            trialIndex: this.currentTrial
        });
    }

    /**
     * Initialize trial data
     */
    initializeTrialData() {
        const experimentMaps = mapData[this.currentExperiment] || {};
        const mapKeys = Object.keys(experimentMaps);

        if (mapKeys.length === 0) {
            console.error(`No maps available for ${this.currentExperiment}`);
            return null;
        }

        // Select map for this trial
        const selectedMapKey = mapKeys[this.currentTrial % mapKeys.length];
        const selectedMap = experimentMaps[selectedMapKey];

        if (!selectedMap || !selectedMap[0]) {
            console.error(`Invalid map data for ${this.currentExperiment} trial ${this.currentTrial}`);
            return null;
        }

        const design = selectedMap[0]; // The map data is in an array format

        // Create empty grid matrix
        const gridMatrix = Array(15).fill(0).map(() => Array(15).fill(0));

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

        // Setup player start positions
        const playerStart = design.initPlayerGrid || [0, 0];
        const partnerStart = design.initAIGrid || design.initPlayerGrid || [0, 0];

        return {
            experimentType: this.currentExperiment,
            trialIndex: this.currentTrial,
            mapKey: selectedMapKey,
            gridMatrix: gridMatrix,
            goals: goals,
            playerStart: playerStart,
            partnerStart: partnerStart,
            startTime: Date.now()
        };
    }

    /**
     * Process player action
     */
    processPlayerAction(playerId, action) {
        if (!this.gameActive || !this.gameState) return;

        const player = this.players.get(playerId);
        if (!player) return;

        // Calculate new position
        const currentPos = player.position;
        const newPos = this.calculateNewPosition(currentPos, action);

        // Validate move
        if (!this.isValidMove(newPos)) {
            console.log(`Invalid move for player ${playerId}: ${action}`);
            return;
        }

        // Update player position
        player.position = newPos;
        this.gameState.players[playerId] = newPos;
        this.gameState.stepCount++;

        // Record action
        player.actions.push({
            action: action,
            position: newPos,
            timestamp: Date.now(),
            stepCount: this.gameState.stepCount
        });

        // Broadcast updated game state
        this.broadcast('game_step', {
            gameState: this.gameState,
            trialIndex: this.currentTrial,
            lastAction: {
                playerId: playerId,
                action: action,
                position: newPos
            }
        });

        // Check for trial completion
        this.checkTrialCompletion();
    }

    /**
     * Calculate new position based on action
     */
    calculateNewPosition(currentPos, action) {
        const directions = {
            'UP': [-1, 0],
            'DOWN': [1, 0],
            'LEFT': [0, -1],
            'RIGHT': [0, 1],
            'STAY': [0, 0]
        };

        const direction = directions[action];
        if (!direction) return currentPos;

        const [currentRow, currentCol] = currentPos;
        const [deltaRow, deltaCol] = direction;

        return [currentRow + deltaRow, currentCol + deltaCol];
    }

    /**
     * Check if move is valid
     */
    isValidMove(position) {
        const [row, col] = position;
        const gridSize = this.gameState.gridMatrix.length;

        // Check bounds
        if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
            return false;
        }

        // Check for obstacles (assuming 1 represents obstacles)
        if (this.gameState.gridMatrix[row][col] === 1) {
            return false;
        }

        return true;
    }

    /**
     * Check if trial should be completed
     */
    checkTrialCompletion() {
        const players = Array.from(this.players.values());
        const goals = this.gameState.goals;

        let trialComplete = false;
        let success = false;
        let results = {};

        // Check goal conditions based on experiment type
        switch (this.currentExperiment) {
            case '1P1G':
            case '1P2G':
                // Single player experiments - check if any player reached a goal
                trialComplete = players.some(player => this.isAtGoal(player.position));
                success = trialComplete;
                break;

            case '2P2G':
            case '2P3G':
                // Collaboration experiments - check if both players are at same goal
                const playersAtGoals = players.map(player => ({
                    player: player,
                    atGoal: this.isAtGoal(player.position),
                    goalIndex: this.getGoalIndex(player.position)
                }));

                const playersAtSameGoal = playersAtGoals.every(p => p.atGoal && p.goalIndex !== -1) &&
                    new Set(playersAtGoals.map(p => p.goalIndex)).size === 1;

                trialComplete = playersAtGoals.some(p => p.atGoal);
                success = playersAtSameGoal;
                break;
        }

        // Check for maximum steps
        if (this.gameState.stepCount >= this.gameState.maxSteps) {
            trialComplete = true;
            success = false;
        }

        if (trialComplete) {
            results = {
                success: success,
                stepCount: this.gameState.stepCount,
                completionTime: Date.now() - this.gameState.startTime,
                playerPositions: { ...this.gameState.players },
                goalReached: players.map(p => ({ id: p.id, atGoal: this.isAtGoal(p.position) }))
            };

            this.completeTrial(results);
        }
    }

    /**
     * Check if position is at a goal
     */
    isAtGoal(position) {
        return this.gameState.goals.some(goal =>
            goal[0] === position[0] && goal[1] === position[1]
        );
    }

    /**
     * Get goal index for position
     */
    getGoalIndex(position) {
        return this.gameState.goals.findIndex(goal =>
            goal[0] === position[0] && goal[1] === position[1]
        );
    }

    /**
     * Complete current trial
     */
    completeTrial(results) {
        console.log(`Room ${this.roomId}: Trial ${this.currentTrial + 1} completed`, results);

        // Store trial data
        this.trialData.push({
            trial: this.currentTrial,
            experiment: this.currentExperiment,
            ...results,
            playerActions: {}
        });

        // Copy player actions
        for (const [playerId, player] of this.players) {
            this.trialData[this.trialData.length - 1].playerActions[playerId] = [...player.actions];
            player.actions = []; // Reset for next trial
        }

        // Broadcast trial completion
        this.broadcast('trial_completed', {
            trialIndex: this.currentTrial,
            results: results,
            success: results.success
        });

        // Move to next trial
        this.currentTrial++;
        setTimeout(() => this.startNextTrial(), 2000);
    }

    /**
     * Complete current experiment
     */
    completeCurrentExperiment() {
        console.log(`Room ${this.roomId}: Completed experiment ${this.currentExperiment}`);

        // Store experiment data
        this.allExperimentData.push({
            experiment: this.currentExperiment,
            trials: [...this.trialData],
            completedAt: Date.now()
        });

        this.broadcast('condition_completed', {
            condition: this.currentExperiment,
            trialData: this.trialData
        });

        // Reset for next experiment
        this.trialData = [];
        this.currentExperimentIndex++;

        // Start next experiment after delay
        setTimeout(() => this.startNextExperiment(), 3000);
    }

    /**
     * Complete all experiments
     */
    completeAllExperiments() {
        console.log(`Room ${this.roomId}: All experiments completed`);

        this.gameActive = false;

        this.broadcast('experiment_completed', {
            allData: this.allExperimentData,
            completedAt: Date.now()
        });

        // Schedule room cleanup
        setTimeout(() => {
            gameRooms.delete(this.roomId);
            console.log(`Room ${this.roomId} cleaned up`);
        }, 30000);
    }

    /**
     * Get maximum trials for experiment
     */
    getMaxTrialsForExperiment(experimentType) {
        const defaultTrials = {
            '1P1G': 3,
            '1P2G': 4,
            '2P2G': 4,
            '2P3G': 4
        };

        return defaultTrials[experimentType] || 12;
    }

    /**
     * Broadcast message to all players in room
     */
    broadcast(event, data, excludePlayerId = null) {
        for (const [playerId, player] of this.players) {
            if (excludePlayerId && playerId === excludePlayerId) continue;

            if (player.socket && player.socket.connected) {
                player.socket.emit(event, data);
            }
        }
    }

    /**
     * Check if room is expired
     */
    isExpired() {
        const now = Date.now();
        return (now - this.lastActivity) > SERVER_CONFIG.multiplayer.roomTimeout;
    }
}

// =================================================================================================
// HUMAN-AI SESSION CLASS
// =================================================================================================

class HumanAISession {
    constructor(sessionId, socket) {
        this.sessionId = sessionId;
        this.socket = socket;
        this.playerId = socket.id;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.experimentData = [];
        this.active = false;

        console.log(`Created Human-AI session ${sessionId} for player ${this.playerId}`);
    }

    /**
     * Start Human-AI experiment
     */
    start(experimentConfig) {
        this.active = true;
        this.lastActivity = Date.now();

        console.log(`Starting Human-AI session ${this.sessionId}`);

        this.socket.emit('experiment_started', {
            sessionId: this.sessionId,
            mode: 'human-ai',
            config: experimentConfig
        });
    }

    /**
     * Process experiment event
     */
    processEvent(eventType, data) {
        this.lastActivity = Date.now();

        switch (eventType) {
            case 'trial_data':
                this.experimentData.push(data);
                break;

            case 'experiment_complete':
                this.complete(data);
                break;

            default:
                console.log(`Human-AI session ${this.sessionId}: ${eventType}`, data);
        }
    }

    /**
     * Complete session
     */
    complete(data) {
        console.log(`Human-AI session ${this.sessionId} completed`);

        this.active = false;

        this.socket.emit('experiment_completed', {
            sessionId: this.sessionId,
            data: data
        });

        // Schedule cleanup
        setTimeout(() => {
            humanAISessions.delete(this.sessionId);
        }, 30000);
    }

    /**
     * Check if session is expired
     */
    isExpired() {
        const now = Date.now();
        return (now - this.lastActivity) > SERVER_CONFIG.humanAI.sessionTimeout || 300000; // 5 minutes default
    }
}

// =================================================================================================
// SOCKET.IO CONNECTION HANDLING
// =================================================================================================

io.on('connection', (socket) => {
    const clientId = socket.id;
    const connectionTime = Date.now();

    console.log(`Client connected: ${clientId}`);

    // Store connection info
    connectionLog.push({ clientId, connectionTime, type: 'connect' });
    activeConnections.set(clientId, { socket, connectionTime, lastActivity: connectionTime });

    // Send welcome message
    socket.emit('connected', {
        clientId: clientId,
        serverTime: Date.now(),
        supportedModes: ['human-ai', 'human-human'],
        serverConfig: {
            maxPlayersPerRoom: SERVER_CONFIG.multiplayer.maxPlayersPerRoom,
            roomTimeout: SERVER_CONFIG.multiplayer.roomTimeout
        }
    });

    // =================================================================================================
    // HUMAN-HUMAN MODE HANDLERS
    // =================================================================================================

    /**
     * Join room for human-human mode
     */
    socket.on('join_room', (data) => {
        console.log(`Client ${clientId} requesting to join room:`, data);

        const { experimentType = 'human-human', playerData = {} } = data;

        if (experimentType === 'human-human') {
            handleHumanHumanJoin(socket, playerData);
        } else {
            socket.emit('join_error', {
                message: 'Invalid experiment type for room join'
            });
        }
    });

    /**
     * Player ready signal
     */
    socket.on('player_ready', (data) => {
        const room = findRoomByPlayer(clientId);
        if (room) {
            room.setPlayerReady(clientId, true);
            console.log(`Player ${clientId} is ready in room ${room.roomId}`);
        }
    });

    /**
     * Player action in multiplayer game
     */
    socket.on('player_action', (data) => {
        const { action, timestamp } = data;
        const room = findRoomByPlayer(clientId);

        if (room && room.gameActive) {
            room.processPlayerAction(clientId, action);
        }
    });

    // =================================================================================================
    // HUMAN-AI MODE HANDLERS
    // =================================================================================================

    /**
     * Start Human-AI session
     */
    socket.on('start_human_ai', (data) => {
        console.log(`Client ${clientId} starting Human-AI session:`, data);

        const sessionId = `hai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = new HumanAISession(sessionId, socket);

        humanAISessions.set(sessionId, session);
        session.start(data.config || {});
    });

    /**
     * Human-AI experiment event
     */
    socket.on('human_ai_event', (data) => {
        const { sessionId, eventType, eventData } = data;
        const session = humanAISessions.get(sessionId);

        if (session) {
            session.processEvent(eventType, eventData);
        }
    });

    // =================================================================================================
    // GENERAL HANDLERS
    // =================================================================================================

    /**
     * Ping for connection testing
     */
    socket.on('ping', (timestamp) => {
        socket.emit('pong', { timestamp, serverTime: Date.now() });
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${clientId}`);

        connectionLog.push({ clientId, connectionTime: Date.now(), type: 'disconnect' });
        activeConnections.delete(clientId);

        // Remove from waiting list
        waitingPlayers.delete(clientId);

        // Remove from any game room
        const room = findRoomByPlayer(clientId);
        if (room) {
            room.removePlayer(clientId);
        }

        // Clean up Human-AI session
        for (const [sessionId, session] of humanAISessions) {
            if (session.playerId === clientId) {
                humanAISessions.delete(sessionId);
                break;
            }
        }
    });
});

// =================================================================================================
// MULTIPLAYER HELPER FUNCTIONS
// =================================================================================================

/**
 * Handle human-human room joining
 */
function handleHumanHumanJoin(socket, playerData) {
    const playerId = socket.id;

    // Check if player is already in a room
    if (findRoomByPlayer(playerId)) {
        socket.emit('join_error', { message: 'Already in a room' });
        return;
    }

    // Look for available room or create new one
    let availableRoom = null;

    for (const room of gameRooms.values()) {
        if (room.experimentMode === 'human-human' &&
            room.players.size < SERVER_CONFIG.multiplayer.maxPlayersPerRoom &&
            !room.gameActive) {
            availableRoom = room;
            break;
        }
    }

    // Create new room if none available
    if (!availableRoom) {
        const roomId = generateRoomId();
        availableRoom = new GameRoom(roomId, 'human-human');
        gameRooms.set(roomId, availableRoom);
    }

    // Add player to room
    if (availableRoom.addPlayer(playerId, socket, playerData)) {
        socket.emit('room_joined', {
            roomId: availableRoom.roomId,
            playerId: playerId,
            isHost: availableRoom.players.get(playerId).isHost,
            playerCount: availableRoom.players.size,
            maxPlayers: SERVER_CONFIG.multiplayer.maxPlayersPerRoom,
            waitingForPartner: availableRoom.players.size < 2
        });

        // Notify other players in room
        availableRoom.broadcast('partner_joined', {
            partnerId: playerId,
            playerCount: availableRoom.players.size
        }, playerId);

        // If room is full, start the experiment
        if (availableRoom.players.size >= 2) {
            setTimeout(() => {
                if (!availableRoom.gameActive) {
                    availableRoom.startExperiment();
                }
            }, 2000);
        } else {
            socket.emit('waiting_for_partner', {
                message: 'Waiting for another player to join...',
                playersWaiting: availableRoom.players.size
            });
        }
    } else {
        socket.emit('join_error', { message: 'Could not join room' });
    }
}

/**
 * Find room by player ID
 */
function findRoomByPlayer(playerId) {
    for (const room of gameRooms.values()) {
        if (room.players.has(playerId)) {
            return room;
        }
    }
    return null;
}

/**
 * Generate unique room ID
 */
function generateRoomId() {
    return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// =================================================================================================
// CLEANUP AND MAINTENANCE
// =================================================================================================

/**
 * Periodic cleanup of expired rooms and sessions
 */
function performCleanup() {
    console.log('Performing periodic cleanup...');

    // Clean up expired game rooms
    const expiredRooms = [];
    for (const [roomId, room] of gameRooms) {
        if (room.isExpired() || room.players.size === 0) {
            expiredRooms.push(roomId);
        }
    }

    expiredRooms.forEach(roomId => {
        console.log(`Cleaning up expired room: ${roomId}`);
        gameRooms.delete(roomId);
    });

    // Clean up expired Human-AI sessions
    const expiredSessions = [];
    for (const [sessionId, session] of humanAISessions) {
        if (session.isExpired()) {
            expiredSessions.push(sessionId);
        }
    }

    expiredSessions.forEach(sessionId => {
        console.log(`Cleaning up expired session: ${sessionId}`);
        humanAISessions.delete(sessionId);
    });

    // Clean up old connection logs (keep last 1000)
    if (connectionLog.length > 1000) {
        connectionLog.splice(0, connectionLog.length - 1000);
    }

    console.log(`Cleanup complete. Active rooms: ${gameRooms.size}, Active sessions: ${humanAISessions.size}`);
}

// Run cleanup every 5 minutes
setInterval(performCleanup, SERVER_CONFIG.multiplayer.cleanupInterval);

// =================================================================================================
// HTTP ROUTES
// =================================================================================================

/**
 * Main experiment page
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        stats: {
            activeRooms: gameRooms.size,
            activeConnections: activeConnections.size,
            humanAISessions: humanAISessions.size,
            totalConnections: connectionLog.length
        },
        config: {
            defaultMode: SERVER_CONFIG.defaultExperimentMode,
            maxRooms: SERVER_CONFIG.multiplayer.maxRooms,
            maxPlayersPerRoom: SERVER_CONFIG.multiplayer.maxPlayersPerRoom
        }
    });
});

/**
 * Server statistics
 */
app.get('/stats', (req, res) => {
    const roomStats = Array.from(gameRooms.values()).map(room => ({
        id: room.roomId,
        players: room.players.size,
        active: room.gameActive,
        experiment: room.currentExperiment,
        trial: room.currentTrial,
        age: Date.now() - room.createdAt
    }));

    res.json({
        server: {
            uptime: process.uptime(),
            activeRooms: gameRooms.size,
            activeConnections: activeConnections.size,
            humanAISessions: humanAISessions.size,
            totalConnections: connectionLog.length
        },
        rooms: roomStats,
        connections: connectionLog.slice(-50), // Last 50 connections
        memoryUsage: process.memoryUsage()
    });
});

/**
 * Configuration endpoint
 */
app.get('/config', (req, res) => {
    res.json(SERVER_CONFIG);
});

/**
 * Export data endpoint (default)
 */
app.get('/export', (req, res) => {
    const format = 'json';

    const exportData = {
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            stats: {
                activeRooms: gameRooms.size,
                totalConnections: connectionLog.length
            }
        },
        rooms: Array.from(gameRooms.values()).map(room => ({
            id: room.roomId,
            experimentData: room.allExperimentData,
            createdAt: room.createdAt
        })),
        connections: connectionLog
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="experiment_data.json"');
    res.json(exportData);
});

/**
 * Export data endpoint with format
 */
app.get('/export/:format', (req, res) => {
    const format = req.params.format;

    const exportData = {
        timestamp: new Date().toISOString(),
        server: {
            uptime: process.uptime(),
            stats: {
                activeRooms: gameRooms.size,
                totalConnections: connectionLog.length
            }
        },
        rooms: Array.from(gameRooms.values()).map(room => ({
            id: room.roomId,
            experimentData: room.allExperimentData,
            createdAt: room.createdAt
        })),
        connections: connectionLog
    };

    if (format === 'csv') {
        // Convert to CSV format (simplified)
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="experiment_data.csv"');
        res.send(convertToCSV(exportData));
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="experiment_data.json"');
        res.json(exportData);
    }
});

/**
 * Debug endpoint for file paths
 */
app.get('/debug', (req, res) => {
    const fs = require('fs');

    const checkFile = (filePath, description) => {
        try {
            const fullPath = path.join(__dirname, filePath);
            const exists = fs.existsSync(fullPath);
            const stats = exists ? fs.statSync(fullPath) : null;
            return {
                description,
                path: filePath,
                fullPath,
                exists,
                size: stats ? stats.size : 0,
                modified: stats ? stats.mtime : null
            };
        } catch (error) {
            return {
                description,
                path: filePath,
                exists: false,
                error: error.message
            };
        }
    };

    const fileChecks = [
        checkFile('../public/js/setup.js', 'Setup Script'),
        checkFile('../public/js/rlAgent.js', 'RL Agent Script'),
        checkFile('../public/config/MapsFor1P1G.js', '1P1G Maps'),
        checkFile('../public/config/MapsFor2P2G.js', '2P2G Maps'),
        checkFile('../public/config/MapsFor2P3G.js', '2P3G Maps'),
        checkFile('config/experimentConfig.js', 'Experiment Config'),
        checkFile('public/index.html', 'Main HTML'),
        checkFile('public/js/unifiedNodeGameExperiment.js', 'Unified Experiment')
    ];

    res.json({
        timestamp: new Date().toISOString(),
        serverDirectory: __dirname,
        fileChecks: fileChecks,
        nodeVersion: process.version,
        platform: process.platform
    });
});

/**
 * Test dependencies endpoint
 */
app.get('/test-deps', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/test-dependencies.html'));
});

/**
 * Test endpoint (default)
 */
app.get('/test', (req, res) => {
    const mode = 'human-ai';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test - Human-AI Mode</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link rel="stylesheet" href="/css/bootstrap.min.css">
            <link rel="stylesheet" href="/css/style.css">
        </head>
        <body>
            <div class="container mt-4">
                <h1>Test Mode: Human-AI</h1>
                <p>Testing the unified experiment system in Human-AI mode.</p>
                <div id="experiment-container"></div>
            </div>
            <script src="/socket.io/socket.io.js"></script>
            <script src="/js/setup.js"></script>
            <script src="/js/rlAgent.js"></script>
            <script src="/js/utils.js"></script>
            <script src="/js/mdp.js"></script>
            <script src="/js/nodeGameHelpers.js"></script>
            <script src="/js/unifiedNodeGameExperiment.js"></script>
            <script>
                // Initialize and start the experiment
                if (typeof UnifiedNodeGameExperiment !== 'undefined') {
                    UnifiedNodeGameExperiment.initialize();
                    UnifiedNodeGameExperiment.start('human-ai');
                } else {
                    console.error('UnifiedNodeGameExperiment not found');
                }
            </script>
        </body>
        </html>
    `);
});

/**
 * Test endpoint with mode
 */
app.get('/test/:mode', (req, res) => {
    const mode = req.params.mode;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Unified Grid Game - Test ${mode.toUpperCase()}</title>
        </head>
        <body>
            <h1>Unified Grid Game Test - ${mode.toUpperCase()} Mode</h1>
            <p>Mode: <strong>${mode}</strong></p>

            <div id="status"></div>
            <div id="controls">
                <button onclick="startTest('${mode}')">Start ${mode.toUpperCase()} Test</button>
            </div>

            <div id="game-area" style="margin-top: 20px;"></div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                function startTest(mode) {
                    if (mode === 'human-human') {
                        socket.emit('join_room', {
                            experimentType: 'human-human',
                            playerData: { testMode: true }
                        });
                    } else {
                        socket.emit('start_human_ai', {
                            config: { testMode: true }
                        });
                    }
                }

                socket.on('connected', (data) => {
                    document.getElementById('status').innerHTML =
                        '<p style="color: green;">Connected as ' + data.clientId + '</p>';
                });

                socket.on('room_joined', (data) => {
                    document.getElementById('status').innerHTML +=
                        '<p>Joined room: ' + data.roomId + ' (Players: ' + data.playerCount + '/' + data.maxPlayers + ')</p>';
                });

                socket.on('waiting_for_partner', (data) => {
                    document.getElementById('status').innerHTML +=
                        '<p style="color: orange;">' + data.message + '</p>';
                });

                socket.on('experiment_started', (data) => {
                    document.getElementById('status').innerHTML +=
                        '<p style="color: blue;">Experiment started!</p>';
                });

                // Add more event handlers as needed
            </script>
        </body>
        </html>
    `);
});

// =================================================================================================
// UTILITY FUNCTIONS
// =================================================================================================

/**
 * Convert data to CSV format (simplified)
 */
function convertToCSV(data) {
    // This is a simplified CSV conversion
    // In a production system, you'd want a more robust CSV library
    let csv = 'Timestamp,Event,Data\n';

    data.connections.forEach(conn => {
        csv += `${new Date(conn.connectionTime).toISOString()},${conn.type},${conn.clientId}\n`;
    });

    return csv;
}

// =================================================================================================
// ERROR HANDLING
// =================================================================================================

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// =================================================================================================
// SERVER STARTUP
// =================================================================================================

const PORT = SERVER_CONFIG.port;

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    UNIFIED GRID GAME SERVER                     ║
╠══════════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT.toString().padEnd(42)} ║
║  Access URL: http://localhost:${PORT.toString().padEnd(37)} ║
║  Health check: http://localhost:${PORT}/health${' '.repeat(25)} ║
║  Debug info: http://localhost:${PORT}/debug${' '.repeat(27)} ║
║  Test deps: http://localhost:${PORT}/test-deps${' '.repeat(25)} ║
║  Test Human-AI: http://localhost:${PORT}/test/human-ai${' '.repeat(18)} ║
║  Test Human-Human: http://localhost:${PORT}/test/human-human${' '.repeat(14)} ║
╠══════════════════════════════════════════════════════════════════╣
║  Supported Modes:                                                ║
║  • Human-AI (Individual RL, Joint RL)                           ║
║  • Human-Human (Real-time multiplayer)                          ║
║  • Unified experiment management                                 ║
║  • Real-time data collection                                     ║
║  • Cross-platform compatibility                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Configuration:                                                  ║
║  • Default mode: ${SERVER_CONFIG.defaultExperimentMode.padEnd(44)} ║
║  • Max rooms: ${SERVER_CONFIG.multiplayer.maxRooms.toString().padEnd(48)} ║
║  • Players per room: ${SERVER_CONFIG.multiplayer.maxPlayersPerRoom.toString().padEnd(37)} ║
╚══════════════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    console.log('Received shutdown signal, shutting down gracefully...');

    // Notify all connected clients
    for (const [clientId, connection] of activeConnections) {
        if (connection.socket.connected) {
            connection.socket.emit('server_shutdown', {
                message: 'Server is shutting down for maintenance'
            });
        }
    }

    // Close server
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
}

module.exports = { server, app, io };