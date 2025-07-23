# Success Threshold Feature for Collaboration Games

## Overview

The success threshold feature has been implemented for collaboration games (2P2G and 2P3G) to automatically end experiments when participants achieve consistent success. This feature helps reduce experiment duration while ensuring participants have demonstrated sufficient skill.

## How It Works

### Success Threshold Rules

1. **Minimum Trials**: Experiments must run at least 12 trials before checking for success threshold
2. **Consecutive Successes**: After 12+ trials, if participants achieve 5 consecutive successful collaborations, the experiment ends
3. **Maximum Trials**: Experiments automatically end after 30 trials regardless of success
4. **Random Sampling**: After trial 12, maps and distance conditions are randomly sampled instead of using pre-selected sequences

### Success Definition

- **2P2G & 2P3G**: Success is defined as both players (human + AI) reaching the same goal
- **Single Player Games**: Success is defined as reaching any goal (not affected by this feature)

## Configuration

### Default Settings

```javascript
successThreshold: {
    enabled: true,                    // Enable success threshold for collaboration games
    consecutiveSuccessesRequired: 5,  // Number of consecutive successes required
    minTrialsBeforeCheck: 12,         // Minimum trials before checking for success threshold
    maxTrials: 30,                    // Maximum trials regardless of success
    randomSamplingAfterTrial: 12      // After this trial, use random sampling for maps and conditions
}
```

### Customization

You can modify these settings programmatically:

```javascript
// Set custom success threshold
NodeGameExperiments.setSuccessThresholdConfig({
    consecutiveSuccessesRequired: 3,  // Easier: 3 consecutive successes
    minTrialsBeforeCheck: 8,          // Check earlier: after 8 trials
    maxTrials: 20,                    // Shorter: max 20 trials
    randomSamplingAfterTrial: 8       // Random sampling after trial 8
});

// Quick presets
NodeGameExperiments.setSuccessThresholdConfig({
    consecutiveSuccessesRequired: 7,  // Harder: 7 consecutive successes
    minTrialsBeforeCheck: 15,         // Check later: after 15 trials
    maxTrials: 40,                    // Longer: max 40 trials
    randomSamplingAfterTrial: 15
});
```

## Implementation Details

### Key Functions

1. **`initializeSuccessThresholdTracking()`**: Resets tracking variables for new experiments
2. **`updateSuccessThresholdTracking(success, trialIndex)`**: Updates success history and consecutive counts
3. **`shouldEndExperimentDueToSuccessThreshold()`**: Checks if experiment should end
4. **`getRandomMapForCollaborationGame()`**: Returns random maps after trial 12
5. **`getRandomDistanceConditionFor2P3G()`**: Returns random distance conditions after trial 12

### Timeline Management

- **Dynamic Trial Generation**: For collaboration games, trials are added dynamically based on success threshold
- **Early Termination**: Experiments can end early when success threshold is met
- **Seamless Transition**: Automatic progression to next experiment or completion stage

### Data Tracking

The system tracks:
- Consecutive successful collaborations
- Total trials completed
- Success/failure history for each trial
- Whether experiment ended early due to success threshold

## Usage Examples

### Basic Usage

```javascript
// Initialize experiments
NodeGameExperiments.initialize();

// Start with default success threshold settings
NodeGameExperiments.start();
```

### Testing Different Configurations

```javascript
// Test with easier settings
NodeGameExperiments.setSuccessThresholdConfig({
    consecutiveSuccessesRequired: 3,
    minTrialsBeforeCheck: 8,
    maxTrials: 15
});

// Test with harder settings
NodeGameExperiments.setSuccessThresholdConfig({
    consecutiveSuccessesRequired: 7,
    minTrialsBeforeCheck: 15,
    maxTrials: 40
});
```

### Monitoring Progress

```javascript
// Get current status
const status = NodeGameExperiments.getSuccessThresholdStatus();
console.log('Consecutive successes:', status.consecutiveSuccesses);
console.log('Total trials:', status.totalTrialsCompleted);
console.log('Ended early:', status.experimentEndedEarly);
console.log('Success history:', status.successHistory);
```

## Testing

### Test File

Use `public/test_success_threshold.html` to test the feature:

1. Open the test file in a browser
2. Select experiment type (2P2G, 2P3G, or both)
3. Configure success threshold parameters
4. Start the experiment
5. Monitor progress in real-time

### Console Monitoring

The system provides detailed console logging:

```
Success threshold update - Trial 1: SUCCESS
  Consecutive successes: 1/5
  Total trials: 1/30

Success threshold update - Trial 2: SUCCESS
  Consecutive successes: 2/5
  Total trials: 2/30

...

Experiment ending: Success threshold met (5 consecutive successes after 15 trials)
```

## Experimental Design Considerations

### Advantages

1. **Reduced Duration**: Experiments end when participants demonstrate consistent skill
2. **Adaptive Difficulty**: Random sampling after trial 12 prevents memorization
3. **Flexible Configuration**: Easy to adjust parameters for different research needs
4. **Data Quality**: Ensures participants have sufficient practice before ending

### Considerations

1. **Learning Effects**: Participants may improve over trials, affecting success rates
2. **Individual Differences**: Some participants may need more trials to achieve success
3. **Statistical Power**: Variable trial counts may affect statistical analysis
4. **Participant Experience**: Early termination may feel abrupt to some participants

## Troubleshooting

### Common Issues

1. **Experiments not ending**: Check if success threshold is enabled and parameters are appropriate
2. **Random sampling not working**: Verify that trial index is >= randomSamplingAfterTrial
3. **Status not updating**: Ensure `updateSuccessThresholdTracking()` is called after each trial

### Debug Information

Enable debug logging to see detailed information:

```javascript
// Check current configuration
console.log('Success threshold config:', NodeGameExperiments.config.successThreshold);

// Check current status
console.log('Current status:', NodeGameExperiments.getSuccessThresholdStatus());

// Check if experiment should end
console.log('Should end:', NodeGameExperiments.shouldEndExperiment());
```

## Integration with Existing Code

The success threshold feature is designed to work seamlessly with existing experiment code:

- **Backward Compatible**: Single player games are unaffected
- **Optional**: Can be disabled by setting `enabled: false`
- **Configurable**: All parameters can be adjusted without code changes
- **Data Preserved**: All existing data collection and export functionality remains intact

## Future Enhancements

Potential improvements for future versions:

1. **Adaptive Thresholds**: Adjust difficulty based on participant performance
2. **Multiple Success Criteria**: Different success definitions for different experiment phases
3. **Participant Feedback**: Notify participants when they're close to completing the experiment
4. **Statistical Analysis**: Built-in analysis of success patterns and learning curves