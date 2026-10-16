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

## Kid RL/SA Google Drive checkpoints and recovery

The public kid entry (`index.html`) uses `js/sessionSave.js` and the shared
`cake-session-upsert-v1` Apps Script protocol. After ID, DOB and condition
assignment, it creates one session file with status `in_progress`. Each finalized
trial queues a cumulative workbook update to that same file. Questionnaire
submission queues the final workbook with status `completed`. The Session sheet
contains session ID, revision, status and checkpoint reason.

The server names files `cake_kid_<participantId>_<sessionId>.xlsx` in its existing
study folder. A session ID and write token are generated once and persisted.
Only a matching server acknowledgement confirms an upload. Requests are serialized;
if several checkpoints arrive during an upload, the next request contains the
newest cumulative snapshot, including all completed rounds. Failed uploads retry
on reconnection and every 15 seconds while the page is open.

Before network requests, the app writes a browser localStorage backup containing
raw data, maps, conditions, progress, session identity and pending upload bytes.
Stage changes, recorded moves and questionnaire answers also refresh the local
backup. Reloading offers a saved-session selector and resume button. Completed
rounds remain intact; an unfinished round restarts, with its partial data retained
separately in Interrupted Trials. Partial questionnaire answers are restored.
Starting another participant retains older backups in this browser. The page
also offers Download backup and a JSON backup import control at startup.

Backups are specific to this browser/origin and may be lost if browser storage is
cleared. Storage failures are displayed, with a downloadable backup option; they
are never reported as locally saved. Use one tab per session. Importing an older
backup when Drive already has a newer revision is not acknowledged as saved.
Existing pre-checkpoint sessions cannot acquire a backup retroactively.

Validation:

- `node --test tests/google-drive-upload.test.cjs tests/session-save.test.cjs`
  checks acknowledgement errors, stable identity, serialized uploads, durable
  retry and storage-quota failure.
- `node tests/session-checkpoints.cjs` uses a real browser and mocked Drive:
  actual startup/trial/questionnaire hooks, offline buffering, reload recovery,
  mid-trial restart and final completion. Requires Playwright and Chromium;
  `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` can select existing installations.
- Add `--live` to upload synthetic TEST_ONLY checkpoints to the real service.
  Add `--deployed` to use only published source, without local routing overrides.
- `tests/verify-live-drive.cjs --live [--deployed]` retains the lower-level
  transport and completion-error/retry validation from the earlier upload fix.
