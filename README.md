# Multiplayer Navigation Game Experiment

This is a real-time multiplayer version of the navigation game experiment where two human players collaborate online to reach goals.

## Features

- **Real-time multiplayer**: Two players can play together in real-time
- **2P2G Experiment**: Two players, two goals - players must coordinate to reach goals
- **2P3G Experiment**: Two players, three goals (third goal appears during game)
- **WASD + Arrow Key Controls**: Support for both control schemes
- **Collaboration Scoring**: 5 points for same goal, 1 point for different goals
- **WebSocket Communication**: Real-time state synchronization

## Setup Instructions

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

The server will start on `http://localhost:3000` (or the port specified in the `PORT` environment variable).

### 3. Access the Experiment

- **Main Experiment**: Open `http://localhost:3000` in your browser
- **Test Interface**: Open `http://localhost:3000/test_multiplayer.html` for testing

## How to Play

### Controls
- **Player 1**: Arrow keys (↑↓←→) or WASD
- **Player 2**: Arrow keys (↑↓←→) or WASD

### Game Flow
1. Two players connect to the server
2. Players are matched into a game room
3. Both players click "Ready" to start
4. Game begins with both players and goals on the grid
5. Players move simultaneously in real-time
6. **2P2G**: Two goals available throughout the game
7. **2P3G**: Two initial goals, third goal appears when players head to same goal
8. Game ends when both players reach any goal
9. Scoring: Same goal = 5 points each, Different goals = 1 point each

### Scoring System
- **Collaboration Success**: Both players reach the same goal (5 points each)
- **Collaboration Failure**: Players reach different goals (1 point each)

## Technical Details

### Server Architecture
- **Express.js**: Web server for serving static files
- **Socket.io**: Real-time WebSocket communication
- **Game Rooms**: Automatic player matching into rooms
- **State Synchronization**: Server maintains authoritative game state

### Client Architecture
- **jsPsych**: Experiment framework
- **Multiplayer Client**: WebSocket communication layer
- **Real-time Rendering**: Canvas-based game visualization
- **Input Handling**: Support for both arrow keys and WASD

### Files Structure
```
├── server.js                 # Main server file
├── package.json             # Dependencies
├── public/
│   ├── index.html           # Main experiment page
│   ├── test_multiplayer.html # Test interface
│   ├── js/
│   │   ├── multiplayerClient.js    # WebSocket client
│   │   ├── multiplayerExperiment.js # Multiplayer experiments
│   │   ├── testExpWithAI.js        # Main experiment file
│   │   ├── setup.js                # Game configuration
│   │   ├── utils.js                # Utility functions
│   │   ├── mdp.js                  # Game mechanics
│   │   └── vizWithAI.js            # Visualization
│   └── config/
│       ├── MapsFor2P2G.js          # 2P2G maps
│       └── MapsFor2P3G.js          # 2P3G maps
```

## Testing

### Local Testing
1. Start the server: `node server.js`
2. Open two browser windows/tabs
3. Navigate to `http://localhost:3000/test_multiplayer.html` in both
4. Connect both players and test the game

### Deployment Testing
The system is designed to work on platforms like Render.com with minimal configuration.

## Deployment on Render.com

1. Push your code to a GitHub repository
2. Connect the repository to Render.com
3. Set the build command: `npm install`
4. Set the start command: `node server.js`
5. The app will be available at your Render URL

## Troubleshooting

### Common Issues

1. **Players can't connect**: Check that the server is running and accessible
2. **Game state not syncing**: Ensure both players are in the same room
3. **Controls not working**: Make sure the page has focus and keys are being detected
4. **Connection timeouts**: Check network connectivity and server status

### Debug Mode
- Open browser developer tools (F12)
- Check console for error messages
- Use the test interface for debugging multiplayer functionality

## Experiment Configuration

### Modifying Trials
Edit the trial counts in `public/js/multiplayerExperiment.js`:
```javascript
var nTrialsFor2P2G = 2;  // Number of 2P2G trials
var nTrialsFor2P3G = 2;  // Number of 2P3G trials
```

### Modifying Maps
- Edit `public/config/MapsFor2P2G.js` and `public/config/MapsFor2P3G.js`
- Maps define initial player positions and goal locations

### Modifying Game Rules
- Edit the scoring system in `server.js` (GameRoom class)
- Modify goal generation logic for 2P3G in `generateNewGoalFor2P3G()`

## License

This project is for research purposes. Please ensure proper attribution if used in academic work.