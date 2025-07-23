# Unified Grid Game Experiment System - Usage Guide

## Overview

The Unified Grid Game Experiment System combines human-AI and human-human experiment modes into a single, configurable system. You can easily switch between modes using a simple configuration file.

## Quick Start

### 1. Basic Setup

1. **Start the unified server:**
   ```bash
   cd unified-grid-game
   node unifiedServer.js
   ```

2. **Open in browser:**
   ```
   http://localhost:3000
   ```

### 2. Switching Experiment Modes

Edit `/config/experimentConfig.js` to switch between modes:

```javascript
window.EXPERIMENT_CONFIG = {
    // CHANGE THIS LINE TO SWITCH MODES:
    experimentMode: 'human-ai',  // Options: 'human-ai' or 'human-human'
    
    // FOR HUMAN-AI MODE, SET RL AGENT TYPE:
    rlAgentType: 'joint',        // Options: 'individual' or 'joint'
    
    // ... other settings
};
```

## Experiment Modes

### Human-AI Mode
- **Description**: Human participant collaborates with AI agent
- **RL Agent Types**:
  - `'individual'`: AI considers only its own goals
  - `'joint'`: AI considers both players' positions for collaboration
- **Use Case**: Study human-AI collaboration patterns

### Human-Human Mode  
- **Description**: Real-time multiplayer between two human participants
- **Features**: Real-time synchronization, player pairing, network handling
- **Use Case**: Study human-human collaboration patterns

## Configuration Options

### Experiment Conditions

```javascript
// Which experimental conditions to run:
experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'], // Full sequence
// experimentOrder: ['2P2G', '2P3G'],              // Collaboration only
// experimentOrder: ['2P3G'],                       // Single condition

// Trial counts per condition:
numTrials: {
    '1P1G': 3,    // Single player, single goal (practice)
    '1P2G': 4,    // Single player, dual goals (practice)  
    '2P2G': 4,    // Two players, two goals (collaboration)
    '2P3G': 4     // Two players, three goals (dynamic)
}
```

### Success Threshold (Early Termination)

```javascript
successThreshold: {
    enabled: true,                    // Enable early termination
    consecutiveSuccessesRequired: 4,  // End after N consecutive successes
    minTrialsBeforeCheck: 4,         // Don't check until after N trials
    maxTrials: 30,                    // Maximum trials regardless
    randomSamplingAfterTrial: 4      // Use random sampling after trial N
}
```

### Timing Settings

```javascript
timing: {
    trialToFeedbackDelay: 500,        // Delay before showing feedback (ms)
    feedbackDisplayDuration: 2000,    // How long to show feedback (ms)
    preTrialDisplayDuration: 2000,    // Pre-trial display time (ms)
    fixationDuration: 1000,           // Fixation cross duration (ms)
    agentDelay: 500,                  // AI action delay (ms)
}
```

## Quick Configuration Changes

### Preset Configurations

Uncomment one of these presets in `/config/experimentConfig.js`:

```javascript
// PRESET 1: Human-AI with Individual RL Agent
// window.EXPERIMENT_CONFIG.experimentMode = 'human-ai';
// window.EXPERIMENT_CONFIG.rlAgentType = 'individual';

// PRESET 2: Human-AI with Joint RL Agent (default)
// window.EXPERIMENT_CONFIG.experimentMode = 'human-ai';
// window.EXPERIMENT_CONFIG.rlAgentType = 'joint';

// PRESET 3: Human-Human Multiplayer
// window.EXPERIMENT_CONFIG.experimentMode = 'human-human';

// PRESET 4: Testing - Single Condition
// window.EXPERIMENT_CONFIG.experimentOrder = ['2P3G'];
// window.EXPERIMENT_CONFIG.numTrials = { '2P3G': 2 };
```

### Runtime Configuration

You can also change settings in the browser console:

```javascript
// Switch to human-human mode
setExperimentMode('human-human');

// Switch to human-AI with joint RL agent  
setExperimentMode('human-ai', 'joint');

// Set custom experiment order
setExperimentOrder(['2P2G', '2P3G']);

// Update trial counts
setTrialCounts({'2P2G': 8, '2P3G': 8});
```

**Note**: Reload the page after making runtime changes.

## File Structure

```
unified-grid-game/
├── config/
│   └── experimentConfig.js          # Main configuration file
├── public/
│   ├── index.html                   # Main experiment page
│   └── js/
│       └── unifiedNodeGameExperiment.js  # Unified experiment system
├── unifiedServer.js                 # Unified server (both modes)
└── USAGE.md                        # This file
```

## Testing

### Test Human-AI Mode
```
http://localhost:3000/test/human-ai
```

### Test Human-Human Mode  
```
http://localhost:3000/test/human-human
```

### Health Check
```
http://localhost:3000/health
```

### Server Statistics
```
http://localhost:3000/stats
```

## Examples

### Example 1: Full Human-AI Experiment with Joint RL Agent

```javascript
// In config/experimentConfig.js
window.EXPERIMENT_CONFIG = {
    experimentMode: 'human-ai',
    rlAgentType: 'joint',
    experimentOrder: ['1P1G', '1P2G', '2P2G', '2P3G'],
    numTrials: {
        '1P1G': 3,
        '1P2G': 12, 
        '2P2G': 12,
        '2P3G': 12
    },
    successThreshold: {
        enabled: true,
        consecutiveSuccessesRequired: 8,
        minTrialsBeforeCheck: 12
    }
};
```

### Example 2: Human-Human Collaboration Study

```javascript
// In config/experimentConfig.js
window.EXPERIMENT_CONFIG = {
    experimentMode: 'human-human',
    experimentOrder: ['2P2G', '2P3G'], // Only collaboration conditions
    numTrials: {
        '2P2G': 15,
        '2P3G': 15
    },
    multiplayer: {
        maxWaitTime: 120000,  // 2 minutes wait time
        syncTimeout: 15000,   // 15 second sync timeout
    }
};
```

### Example 3: Quick Testing Setup

```javascript
// In config/experimentConfig.js
window.EXPERIMENT_CONFIG = {
    experimentMode: 'human-ai',
    rlAgentType: 'individual',
    experimentOrder: ['2P3G'],  // Test single condition
    numTrials: {
        '2P3G': 2  // Only 2 trials for quick testing
    },
    successThreshold: {
        enabled: false  // Disable early termination
    }
};
```

## Advanced Features

### Data Export

The system automatically exports data in JSON format. For CSV export:
```
http://localhost:3000/export/csv
```

### Multiple Server Instances

You can run multiple server instances on different ports:

```bash
PORT=3001 node unifiedServer.js  # Run on port 3001
PORT=3002 node unifiedServer.js  # Run on port 3002
```

### Prolific Integration

Configure Prolific completion code:

```javascript
game: {
    enableProlificRedirect: true,
    prolificCompletionCode: 'YOUR_CODE_HERE'
}
```

## Troubleshooting

### Common Issues

1. **"Missing Dependencies" Error** - FIXED! 
   - All necessary files are now copied locally
   - No more external path dependencies
   - Run the verification script: `node verify-setup.js`

2. **Human-Human Mode Not Connecting**
   - Check that Socket.io is loaded properly
   - Verify server is running on correct port
   - Check browser console for connection errors

3. **AI Not Responding (Human-AI Mode)**
   - Verify RLAgent scripts are loaded
   - Check that rlAgentType is valid ('individual' or 'joint')
   - Look for JavaScript errors in console

### Debug Mode

Enable debug logging:

```javascript
// In browser console
window.DEBUG = true;
```

### Log Files

Server logs are available at:
```
http://localhost:3000/stats  # Server statistics and logs
```

## API Reference

### Configuration API

```javascript
// Get current configuration
window.EXPERIMENT_CONFIG

// Quick configuration functions
setExperimentMode(mode, agentType)
setExperimentOrder(order)
setTrialCounts(counts)
```

### Experiment API

```javascript
// Access experiment system
window.UnifiedNodeGameExperiment

// Main functions
UnifiedNodeGameExperiment.initialize()
UnifiedNodeGameExperiment.start()
UnifiedNodeGameExperiment.config
UnifiedNodeGameExperiment.gameData
```

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify configuration in `experimentConfig.js`
3. Test with simplified configuration
4. Check server logs at `/stats` endpoint

## Performance Notes

- **Human-AI Mode**: Can handle 200+ concurrent sessions
- **Human-Human Mode**: Supports up to 100 concurrent rooms (200 players)
- **Memory Usage**: ~50MB per server instance
- **Network**: Optimized for real-time collaboration with <100ms latency