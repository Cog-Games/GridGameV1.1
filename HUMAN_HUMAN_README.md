# Human-Human Real-time Multiplayer Experiments

This is a real-time human-human version of the navigation game experiments where two human players collaborate online to reach goals using the nodeGame framework.

## Features

- **Real-time multiplayer**: Two human players can play together in real-time
- **2P2G Experiment**: Two players, two goals - players must coordinate to reach goals
- **2P3G Experiment**: Two players, three goals (third goal appears during game)
- **WASD + Arrow Key Controls**: Support for both control schemes
- **Collaboration Scoring**: Success when both players reach the same goal
- **WebSocket Communication**: Real-time state synchronization
- **nodeGame Integration**: Uses nodeGame framework for experiment management

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
# or
node server.js
```

The server will start on `http://localhost:3000`.

### 3. Test the Human-Human Experiments

- **Test Interface**: Open `http://localhost:3000/test-human-human` in two browser windows
- **Main Experiment**: Open `http://localhost:3000` for the full experiment

## How to Test

### Testing with Two Players

1. **Open Two Browser Windows**: Open `http://localhost:3000/test-human-human` in two different browser windows or tabs
2. **Select Game Type**: Both players should select the same game type (2P2G or 2P3G)
3. **Join Game**: Click "Join Game" on both windows
4. **Wait for Connection**: Wait for both players to connect to the same room
5. **Set Ready**: Click "Ready" on both windows to start the game
6. **Play**: Use arrow keys or WASD to move your player
7. **Collaborate**: Work together to reach goals!

### Game Controls

- **Arrow Keys**: ↑↓←→ for movement
- **WASD**: W (up), S (down), A (left), D (right) for movement

### Game Rules

- **2P2G**: Two goals are available throughout the game
- **2P3G**: Two initial goals, third goal appears when players head to same goal
- **Success**: Both players reach the same goal (collaboration success)
- **Failure**: Players reach different goals (collaboration failure)

## File Structure

```
├── server.js                           # Main server file with Socket.IO
├── package.json                        # Dependencies
├── public/
│   ├── js/
│   │   ├── nodeGameHumanHuman.js       # Human-human experiments using nodeGame
│   │   ├── nodeGameExperiments.js      # Original AI-human experiments
│   │   └── ...                         # Other game files
│   ├── test_human_human.html           # Test interface for human-human
│   └── config/
│       ├── MapsFor2P2G.js              # 2P2G maps
│       └── MapsFor2P3G.js              # 2P3G maps
```

## Technical Architecture

### Server (server.js)

- **Express.js**: Web server for serving static files
- **Socket.IO**: Real-time WebSocket communication
- **Game Rooms**: Automatic player matching into rooms
- **State Synchronization**: Server maintains authoritative game state
- **Turn-based Movement**: Players take turns making moves

### Client (nodeGameHumanHuman.js)

- **nodeGame Framework**: Experiment management and timeline
- **Real-time Communication**: WebSocket client for multiplayer
- **Game Logic**: Handles player moves, goal detection, trial completion
- **Data Collection**: Records player moves, reaction times, success rates

### Key Components

1. **GameRoom Class**: Manages individual game sessions
2. **Player Matching**: Automatic room assignment and player pairing
3. **State Management**: Synchronized game state across all players
4. **Move Validation**: Server-side validation of player moves
5. **Goal Detection**: Automatic detection of goal completion
6. **Trial Management**: Handles trial completion and success calculation

## Experiment Configuration

### Modifying Experiments

Edit the configuration in `public/js/nodeGameHumanHuman.js`:

```javascript
// Test specific experiments
NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P2G'];           // Test 2P2G only
NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P3G'];           // Test 2P3G only
NODEGAME_HUMAN_HUMAN_CONFIG.experimentOrder = ['2P2G', '2P3G'];   // Test both

// Modify trial counts
NODEGAME_HUMAN_HUMAN_CONFIG.numTrials = {
    '2P2G': 12,    // Number of 2P2G trials
    '2P3G': 12     // Number of 2P3G trials
};
```

### Using Browser Console

Open browser console (F12) and use these commands:

```javascript
// Set experiment type
NodeGameHumanHuman.setExperiment2P2G();     // Test 2P2G only
NodeGameHumanHuman.setExperiment2P3G();     // Test 2P3G only
NodeGameHumanHuman.setExperimentCollaboration(); // Test both

// Custom experiment order
NodeGameHumanHuman.setCustomExperimentOrder(['2P2G', '2P3G']);
```

## Data Collection

The system automatically collects:

- **Player Moves**: Action, reaction time, timestamp, step count
- **Goal Completion**: Which goals each player reached
- **Trial Data**: Success/failure, completion time, total steps
- **Collaboration Metrics**: Whether players reached same or different goals

Data is saved to localStorage and can be downloaded as JSON.

## Troubleshooting

### Common Issues

1. **Players can't connect**:
   - Check that server is running (`node server.js`)
   - Verify port 3000 is available
   - Check browser console for errors

2. **Game state not syncing**:
   - Ensure both players are in the same room
   - Check WebSocket connection status
   - Refresh both browser windows

3. **Controls not working**:
   - Make sure the page has focus
   - Check if it's your turn (highlighted player)
   - Verify game is active

4. **Connection timeouts**:
   - Check network connectivity
   - Restart server if needed
   - Clear browser cache

### Debug Mode

- Open browser developer tools (F12)
- Check console for error messages
- Monitor WebSocket events in Network tab
- Use the test interface for debugging

## Differences from AI-Human Version

### Key Changes

1. **Real-time Multiplayer**: Uses Socket.IO instead of AI simulation
2. **Turn-based Movement**: Players take turns instead of simultaneous movement
3. **Server Authority**: Server validates moves and maintains game state
4. **Player Matching**: Automatic room assignment and player pairing
5. **Collaboration Focus**: Emphasizes human-human collaboration over AI interaction

### Experimental Logic

- **Same Game Mechanics**: Grid navigation, goal reaching, collaboration scoring
- **Same Success Criteria**: Both players must reach the same goal
- **Same Data Collection**: Move tracking, reaction times, success rates
- **Enhanced Real-time Features**: Live state updates, player status, room management

## Deployment

### Local Development

```bash
npm install
npm start
```

### Production Deployment

1. Push code to GitHub repository
2. Deploy to platform (Render, Heroku, etc.)
3. Set environment variables if needed
4. Ensure WebSocket support is enabled

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## License

This project is for research purposes. Please ensure proper attribution if used in academic work.