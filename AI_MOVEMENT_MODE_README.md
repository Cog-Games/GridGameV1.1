# AI Movement Mode Feature

## Overview

The AI Movement Mode feature allows AI agents to move freely without depending on human actions. This creates a more dynamic and realistic interaction where the AI can make decisions independently with configurable timing intervals.

## Features

### Two Movement Modes

1. **Synchronized Mode (Default)**: AI moves only when the human player makes a move
2. **Independent Mode**: AI moves freely with random decision intervals

### Configurable Timing

- **Decision Time Range**: Configurable minimum and maximum intervals for AI decisions
- **Default Range**: 300-600 milliseconds
- **Customizable**: Can be set to any range between 100ms and 3000ms

## Configuration

### Basic Configuration

The feature is configured in `js/expConfig.js`:

```javascript
rlAgent: {
    // ... existing config ...

    // AI Movement Mode Configuration
    movementMode: {
        enabled: false, // Enable independent AI movement mode
        decisionTimeRange: {
            min: 300, // Minimum decision time in milliseconds
            max: 600  // Maximum decision time in milliseconds
        }
    }
}
```

### JavaScript API

#### Enable/Disable Independent AI Movement

```javascript
// Enable with default timing (300-600ms)
NodeGameConfig.setAIMovementMode(true);

// Enable with custom timing
NodeGameConfig.setAIMovementMode(true, {min: 200, max: 800});

// Disable independent AI movement
NodeGameConfig.setAIMovementMode(false);
```

#### Check Configuration

```javascript
// Get current configuration
const config = NodeGameConfig.getAIMovementMode();
console.log(config.enabled); // true/false
console.log(config.decisionTimeRange); // {min: 300, max: 600}

// Check if enabled
if (NodeGameConfig.isAIMovementModeEnabled()) {
    console.log('AI moves independently');
} else {
    console.log('AI moves only when human moves');
}
```

## Supported Experiment Types

This feature works with the following experiment types:

- **2P2G**: Two players, two goals (collaboration game)
- **2P3G**: Two players, three goals (collaboration game with dynamic goals)

## Behavior Comparison

| Mode | AI Movement | Timing | Use Case |
|------|-------------|--------|----------|
| **Disabled (Default)** | AI moves only when human makes a move | Synchronized with human actions | Controlled, predictable interaction |
| **Enabled** | AI moves independently with random intervals | Random intervals (configurable range) | Dynamic, realistic interaction |

## Implementation Details

### Key Changes

1. **Configuration System**: Added `movementMode` configuration to `rlAgent` settings
2. **Trial Functions**: Modified `runTrial2P2G()` and `runTrial2P3G()` to support independent AI movement
3. **Timing System**: Implemented random interval scheduling for AI decisions
4. **Goal Detection**: Maintained all existing goal detection and tracking functionality

### Core Functions

#### `startIndependentAIMovement()`

- Schedules AI moves with random intervals
- Respects goal completion and freeze conditions
- Maintains proper game state updates
- Handles win condition checks

#### `scheduleNextAIMove()`

- Generates random delays within configured range
- Executes AI moves asynchronously
- Recursively schedules next move
- Handles game termination conditions

### Integration Points

- **Goal Detection**: AI moves respect goal completion states
- **Freeze Conditions**: In 2P3G, AI respects freeze periods during new goal presentation
- **Win Conditions**: Proper win condition checking after each AI move
- **Data Recording**: All AI moves are properly recorded for analysis

## Usage Examples

### Basic Usage

```javascript
// Enable independent AI movement
NodeGameConfig.setAIMovementMode(true);

// Start a 2P2G game - AI will move independently
// The game will use the default timing (300-600ms)
```

### Custom Timing

```javascript
// Enable with faster AI decisions (200-400ms)
NodeGameConfig.setAIMovementMode(true, {min: 200, max: 400});

// Enable with slower AI decisions (500-1000ms)
NodeGameConfig.setAIMovementMode(true, {min: 500, max: 1000});
```

### Conditional Usage

```javascript
// Enable only for specific experiment types
if (experimentType === '2P2G' || experimentType === '2P3G') {
    NodeGameConfig.setAIMovementMode(true);
} else {
    NodeGameConfig.setAIMovementMode(false);
}
```

## Testing

### Test File

Use `test_ai_movement_mode.html` to:

1. Enable/disable the feature
2. Configure timing ranges
3. Test with different experiment types
4. View current configuration status

### Manual Testing

1. Open `test_ai_movement_mode.html` in a browser
2. Enable independent AI movement
3. Configure desired timing range
4. Start a test game (2P2G or 2P3G)
5. Observe AI movement behavior

## Technical Notes

### Performance Considerations

- **Random Intervals**: Uses `Math.random()` for timing variation
- **Memory Management**: Proper cleanup of intervals and timeouts
- **State Consistency**: Maintains game state integrity during independent moves

### Error Handling

- **Invalid Ranges**: Validates min/max timing values
- **Game State**: Checks for valid game data before moves
- **Goal States**: Respects goal completion to prevent unnecessary moves

### Compatibility

- **Backward Compatible**: Default behavior unchanged when disabled
- **Existing Features**: All existing functionality preserved
- **Configuration**: Integrates with existing config system

## Future Enhancements

### Potential Improvements

1. **Adaptive Timing**: AI timing based on game state or difficulty
2. **Personality Modes**: Different AI movement patterns
3. **Learning Behavior**: AI timing that adapts to human behavior
4. **Visual Indicators**: Show when AI is "thinking" or about to move

### Configuration Extensions

```javascript
// Potential future configuration
movementMode: {
    enabled: false,
    decisionTimeRange: {min: 300, max: 600},
    adaptiveTiming: false, // Future: adaptive timing based on game state
    personality: 'normal', // Future: different AI personalities
    visualFeedback: true   // Future: show AI thinking indicators
}
```

## Troubleshooting

### Common Issues

1. **AI Not Moving**: Check if feature is enabled and timing range is valid
2. **Too Fast/Slow**: Adjust the decision time range
3. **Game Freezes**: Ensure proper cleanup of intervals and timeouts
4. **Goal Detection Issues**: Verify goal detection logic is working correctly

### Debug Information

Enable console logging to see:
- AI movement scheduling
- Decision timing
- Goal detection
- Win condition checks

```javascript
// Enable debug logging
console.log('AI Movement Mode:', NodeGameConfig.getAIMovementMode());
console.log('Current game state:', gameData);
```

## Files Modified

- `js/expConfig.js`: Added configuration and API functions
- `js/expTrialHumanAI.js`: Modified trial functions for independent AI movement
- `test_ai_movement_mode.html`: Test interface for the feature
- `AI_MOVEMENT_MODE_README.md`: This documentation file