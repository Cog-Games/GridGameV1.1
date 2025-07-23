# RL Agent Implementation for NodeGame

This document describes the implementation of different Reinforcement Learning (RL) agent types in the NodeGame experiment framework.

## Overview

The NodeGame framework now supports two different types of RL agents. All RL agent functionality has been moved to a dedicated `rlAgent.js` file for better organization and modularity.

### File Structure
- `public/js/rlAgent.js` - Contains all RL agent implementations
- `public/js/nodeGameHumanAIVersion.js` - Main experiment file (imports RL functions)
- `public/test_rl_agents.html` - Test interface for RL agents

The NodeGame framework now supports two different types of RL agents:

1. **Individual RL Agent** - Reinforcement Learning agent that considers only its own position and goals
2. **Joint RL Agent** - Cooperative RL agent that considers both AI and human positions for optimal joint behavior

## Agent Types

### 1. Individual RL Agent (`individual`)
- **Behavior**: Uses Value Iteration to compute optimal policy considering only AI's own position and goals
- **Complexity**: Medium - implements full RL algorithm
- **Features**:
  - Value Iteration with configurable parameters
  - Softmax policy for action selection
  - Considers step costs and goal rewards
- **Use Case**: Standard RL agent behavior, individual optimization

### 2. Joint RL Agent (`joint`)
- **Behavior**: Cooperative agent that optimizes for joint success considering both players
- **Complexity**: High - implements cooperative optimization
- **Features**:
  - Softmax optimal joint policy
  - Minimizes combined distance to goals
  - Temperature-controlled exploration
  - Special handling for goal-sharing scenarios
- **Use Case**: Cooperative games, human-AI collaboration studies

## Configuration

### Agent Type Selection
```javascript
// Set agent type
NodeGameExperiments.setRLAgentType('joint');  // 'individual' or 'joint'

// Convenience functions
NodeGameExperiments.setRLAgentIndividual();
NodeGameExperiments.setRLAgentJoint();
```

### RL Agent Configuration
```javascript
// Update configuration
NodeGameExperiments.updateRLAgentConfig({
    gridSize: 15,           // Grid dimensions
    noise: 0.0,            // Transition noise (0 = deterministic)
    gamma: 0.9,            // Discount factor
    goalReward: 30,        // Reward for reaching goal
    softmaxBeta: 5,        // Temperature for individual RL
    jointTemperature: 0.1  // Temperature for joint RL
});

// Get current configuration
const config = NodeGameExperiments.getRLAgentConfig();
```

## Usage Examples

### Basic Usage
```javascript
// Initialize with individual RL agent
NodeGameExperiments.setRLAgentIndividual();

// Start experiment
NodeGameExperiments.start('2P2G');
```

### Advanced Configuration
```javascript
// Set up cooperative agent with custom parameters
NodeGameExperiments.setRLAgentJoint();
NodeGameExperiments.updateRLAgentConfig({
    gamma: 0.95,
    goalReward: 50,
    jointTemperature: 0.05  // More deterministic behavior
});
```

### Runtime Agent Switching
```javascript
// Switch agent type during experiment (if needed)
NodeGameExperiments.setRLAgentType('individual');
```

## Technical Implementation

### Core Functions

#### `getAIAction(gridMatrix, currentPos, goals, playerPos = null)`
Main function that determines AI action based on current agent type.

**Parameters:**
- `gridMatrix`: Game grid (not used by RL agents)
- `currentPos`: AI's current position `[row, col]`
- `goals`: Array of goal positions `[[row1, col1], [row2, col2], ...]`
- `playerPos`: Human player position `[row, col]` (required for joint RL)

**Returns:** Action vector `[deltaRow, deltaCol]`

### RL Agent Classes

#### `GridWorld`
Environment representation for RL agents.

#### `ValueIteration`
Implements value iteration algorithm for computing optimal value function.

#### `RunIndividualVI`
Runs value iteration for individual RL agent.

#### `SoftmaxRLPolicy`
Implements softmax policy for action selection.

### Joint RL Implementation

The joint RL agent uses a softmax optimal joint policy that:

1. **Computes joint costs** for each possible action
2. **Minimizes combined distance** to goals
3. **Handles special cases**:
   - When AI is at goal but human isn't
   - When both players are at same goal
4. **Uses temperature-controlled exploration** for stochastic behavior

## Testing

A test interface is available at `public/test_rl_agents.html` that allows you to:

- Switch between agent types
- Configure RL parameters
- Test agents on sample scenarios
- Compare behavior across different agent types

### Running Tests
1. Open `public/test_rl_agents.html` in a web browser
2. Select agent type and configure parameters
3. Click "Test Current Agent" or "Test All Agents"
4. Observe the output showing actions and resulting positions

## Performance Considerations

### Computational Complexity
- **Individual RL**: O(S²A) where S = states, A = actions
- **Joint RL**: O(A) per action selection

### Memory Usage
- **Individual RL**: Stores Q-values for all state-action pairs
- **Joint RL**: Minimal (computes on-demand)

### Recommendations
- Use **Individual RL** for standard RL experiments
- Use **Joint RL** for cooperative game studies
- Consider grid size impact on Individual RL performance

## Integration with Experiments

The RL agents are automatically integrated into all experiment types:

- **1P1G**: Uses AI agent (if configured)
- **1P2G**: Uses AI agent for goal selection
- **2P2G**: Uses AI agent for cooperative play
- **2P3G**: Uses AI agent with goal inference

### Experiment-Specific Behavior

#### 2P2G and 2P3G Experiments
- AI moves simultaneously with human
- Joint RL considers human position for cooperative behavior
- Independent AI movement when human reaches goal

#### Goal Generation
- Joint RL influences goal placement for optimal cooperation
- Distance conditions affect goal generation strategy

## Troubleshooting

### Common Issues

1. **Agent not moving**: Check if agent type is set correctly
2. **Unexpected behavior**: Verify configuration parameters
3. **Performance issues**: Consider grid size impact on Individual RL
4. **Joint RL errors**: Ensure playerPos is provided

### Debug Information
```javascript
// Check current agent type
console.log(NodeGameExperiments.getRLAgentType());

// Check configuration
console.log(NodeGameExperiments.getRLAgentConfig());

// Enable debug logging in getAIAction function
```

## Future Enhancements

Potential improvements for future versions:

1. **Multi-agent RL**: Support for multiple AI agents
2. **Adaptive policies**: Learning from human behavior
3. **Hierarchical RL**: Multi-level decision making
4. **Deep RL**: Neural network-based policies
5. **Inverse RL**: Learning human preferences

## References

- Value Iteration: Sutton & Barto (2018) "Reinforcement Learning: An Introduction"
- Joint Optimization: Cooperative game theory and multi-agent systems
- Softmax Policy: Exploration vs exploitation in RL

## Support

For questions or issues with the RL agent implementation:

1. Check the test interface for basic functionality
2. Review console logs for error messages
3. Verify configuration parameters
4. Test with Individual RL first to isolate issues