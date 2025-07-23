# Configuration Guide for Unified Grid Game

## Quick Start - Setting Agent Type

To configure which agent participants will play with, edit `shared/config/gameConfig.js`:

### 1. Individual-RL Agent (Non-cooperative)
```javascript
// RESEARCHER CONFIGURATION: Set the agent type here
FIXED_AGENT_TYPE: 'individual-rl',  // <-- Change this line

// Set to true to use the fixed agent type above
USE_FIXED_AGENT: true,
```

### 2. Joint-RL Agent (Cooperative) 
```javascript
// RESEARCHER CONFIGURATION: Set the agent type here
FIXED_AGENT_TYPE: 'joint-rl',  // <-- Change this line

// Set to true to use the fixed agent type above
USE_FIXED_AGENT: true,
```

### 3. Human Partner (Human-Human)
```javascript
// RESEARCHER CONFIGURATION: Set the agent type here
FIXED_AGENT_TYPE: 'human',  // <-- Change this line

// Set to true to use the fixed agent type above
USE_FIXED_AGENT: true,
```

### 4. Allow Participant Choice
```javascript
// Set to false to allow participants to choose
USE_FIXED_AGENT: false,
```

## Starting the Experiment

1. **Set your desired agent type** in the config file (see above)
2. **Start the server**: `npm start`
3. **Open browser** to `http://localhost:3000`
4. **The game will automatically start** with the 4 conditions in sequence:
   - 1P1G (practice)
   - 1P2G (practice) 
   - 2P2G (main experiment)
   - 2P3G (main experiment)

## Agent Behavior Differences

### Individual-RL Agent
- **Behavior**: Only considers its own position and goals
- **Strategy**: Shortest path to nearest goal, ignores partner
- **Use Case**: Control condition for non-cooperative behavior

### Joint-RL Agent  
- **Behavior**: Considers both players' positions for coordination
- **Strategy**: Optimizes for joint success and collaboration
- **Use Case**: Test condition for cooperative AI behavior

### Human Partner
- **Behavior**: Real human participant
- **Strategy**: Depends on the human player
- **Use Case**: Human-human collaboration condition
- **Note**: Requires 2 participants to be online simultaneously

## Additional Configuration Options

### Trial Counts
```javascript
TRIALS_PER_CONDITION: {
  '1P1G': 3,  // Practice trials
  '1P2G': 3,  // Practice trials  
  '2P2G': 12, // Main experiment
  '2P3G': 12  // Main experiment
},
```

### AI Parameters
```javascript
AI: {
  REACTION_TIME: { MIN: 200, MAX: 800 },
  INDIVIDUAL_RL: { TEMPERATURE: 0.1, EXPLORATION_RATE: 0.05 },
  JOINT_RL: { TEMPERATURE: 0.1, EXPLORATION_RATE: 0.05, COOPERATION_WEIGHT: 0.8 }
}
```

### Game Settings
```javascript
GAME: {
  GRID_SIZE: 15,
  MAX_STEPS: 50,
  STEP_TIMEOUT: 10000, // 10 seconds per move
}
```

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 3000 is already in use
   - Run `npm install` to ensure dependencies are installed

2. **Agent not behaving as expected**
   - Verify the `FIXED_AGENT_TYPE` setting in config
   - Check server console for RL computation errors

3. **Human-Human condition not working**
   - Need 2 browsers/participants online simultaneously
   - Check waiting room messages

4. **Maps not loading properly**
   - Verify map data files exist in `shared/data/`
   - Check server console for map loading errors

### Development Mode
```bash
npm run dev  # Starts with nodemon for auto-restart on file changes
```

### Debugging
Enable verbose logging in `gameConfig.js`:
```javascript
DEBUG: {
  VERBOSE_LOGGING: true,
  LOG_PLAYER_ACTIONS: true,
  LOG_GAME_STATES: true,
  LOG_AI_DECISIONS: true
}
```

## Data Collection

All experiment data is automatically collected and includes:
- Trial-by-trial performance
- Move-by-move player actions  
- Reaction times
- Collaboration success rates
- Complete game state history

Data is available in real-time via WebSocket events and can be exported in multiple formats (JSON, CSV, Excel).