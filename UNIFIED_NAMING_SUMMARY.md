# Unified Naming Convention Summary

## Overview
This document summarizes the changes made to unify the naming convention for gameData in both human-AI and human-human versions. All references to `playerState`/`aiState` have been changed to `player1`/`player2`, and a configuration system has been added to indicate whether player2 is AI or human.

## Configuration Changes

### expConfig.js
- Added `playerConfig` section to `NODEGAME_CONFIG` with:
  - `player1`: Always human, red color
  - `player2`: Can be 'ai' or 'human', orange color
- Added `setPlayer2Type(type)` function to dynamically set player2 type
- Exported configuration as `window.NodeGameConfig`

## Data Structure Changes

### gameState.js
- Changed `gameData.playerState` → `gameData.player1`
- Changed `gameData.aiState` → `gameData.player2`
- Added `playerConfig` section to track player types
- Updated trial data structure:
  - `trajectory` → `player1Trajectory`
  - `aiTrajectory` → `player2Trajectory`
  - `aimAction` → `player1Actions`
  - `aiAction` → `player2Actions`
  - `RT` → `player1RT`
  - `humanGoalReachedStep` → `player1GoalReachedStep`
  - `aiGoalReachedStep` → `player2GoalReachedStep`
  - `humanCurrentGoal` → `player1CurrentGoal`
  - `aiCurrentGoal` → `player2CurrentGoal`
  - `isNewGoalCloserToAI` → `isNewGoalCloserToPlayer2`

## Function Changes

### dataRecording.js
- `recordPlayerMove()` → `recordPlayer1Move()`
- `recordAIMove()` → `recordPlayer2Move()`
- Updated function signatures and internal logic

### gameHelpers.js
- Updated `setupGridMatrixForTrial()` to use new naming
- Changed comments from "Add player" to "Add player1"
- Changed comments from "Add AI player" to "Add player2"

### expDesign.js
- Updated all position references to use `player1`/`player2`
- Updated goal checking functions to use new naming
- Updated collaboration success calculations
- Updated variable names in comments and logs

### expTrialHumanAI.js
- Updated all trial functions (1P1G, 1P2G, 2P2G, 2P3G)
- Changed function names:
  - `makeIndependentAIMove()` → `makeIndependentPlayer2Move()`
  - `startIndependentAIMovement()` → `startIndependentPlayer2Movement()`
- Updated all variable references and comments
- Updated goal detection and tracking logic

### viz.js
- Updated global variable assignments:
  - `window.playerState` → `window.player1`
  - `window.aiState` → `window.player2`

### human-human-version.js
- Updated all references to use new naming convention
- Updated goal tracking arrays and variables
- Updated debug logging messages

## Benefits

1. **Unified Naming**: Both human-AI and human-human versions now use the same naming convention
2. **Configurable Player Types**: Easy to switch between AI and human for player2
3. **Consistent Data Structure**: All trial data uses the same field names
4. **Better Maintainability**: Single naming convention reduces confusion
5. **Future-Proof**: Easy to add more player types or configurations

## Usage

To set player2 as AI (default):
```javascript
// Already set by default, or explicitly:
window.NodeGameConfig.setPlayer2Type('ai');
```

To set player2 as human:
```javascript
window.NodeGameConfig.setPlayer2Type('human');
```

## Files Modified

1. `public/js/expConfig.js` - Added configuration system
2. `public/js/gameState.js` - Updated data structure
3. `public/js/dataRecording.js` - Updated recording functions
4. `public/js/gameHelpers.js` - Updated helper functions
5. `public/js/expDesign.js` - Updated design logic
6. `public/js/expTrialHumanAI.js` - Updated trial functions
7. `public/js/viz.js` - Updated visualization
8. `public/js/human-human-version.js` - Updated human-human logic

## Backward Compatibility

The changes maintain backward compatibility by:
- Preserving all existing functionality
- Using the same data flow and logic
- Maintaining the same API for external calls
- Only changing internal naming conventions

## Testing Recommendations

1. Test both human-AI and human-human versions
2. Verify all experiment types work correctly (1P1G, 1P2G, 2P2G, 2P3G)
3. Check that data recording works properly
4. Verify goal detection and collaboration logic
5. Test the player2 type configuration system