# Data Recording Fixes for Human-Human Games

## Issues Identified and Fixed

### 1. aimAction and partnerAction should be arrays

**Problem**: The arrays were being initialized correctly but there were potential issues with array population and safety checks.

**Fixes Applied**:
- Added safety checks in `recordPlayerMove()` and `recordPartnerMove()` functions to ensure arrays exist before pushing data
- Added array initialization checks in `finalizeTrial()` function
- Added debugging logs to track array population

**Files Modified**:
- `public/js/nodeGameHumanHumanVersion.js`: Lines 2214-2292, 2293-2372

### 2. RT for 2 players game were all 0

**Problem**: The server was not including `reactionTime` in the `move_made` event broadcast, causing the client to receive `undefined` and default to 0.

**Fixes Applied**:
- **Server fix**: Modified `server.js` to include `reactionTime` in the `move_made` event broadcast
- **Client fix**: Added `partnerRT` array to track partner reaction times separately
- Updated `recordPartnerMove()` function to record partner reaction times
- Added `partnerRT` array initialization in `initializeTrialData()`

**Files Modified**:
- `server.js`: Line 425-435 (added reactionTime to move_made broadcast)
- `public/js/nodeGameHumanHumanVersion.js`: Lines 2137-2171, 2261-2292

### 3. goals, playerStartPos, partnerStartPos not being saved

**Problem**: These values were being set in `gameData` but not being copied to `currentTrialData` in the `finalizeTrial` function.

**Fixes Applied**:
- Modified `finalizeTrial()` function to copy important game state data to trial data
- Added deep copying using `JSON.parse(JSON.stringify())` to prevent reference issues
- Added safety checks to ensure data exists before copying

**Files Modified**:
- `public/js/nodeGameHumanHumanVersion.js`: Lines 2293-2372

## Additional Improvements

### 4. Partner Position Tracking

**Problem**: The code was using `partnerStartPos` for trajectory recording, which would always record the starting position instead of the current position.

**Fixes Applied**:
- Added `currentPartnerPos` variable to track partner's current position
- Updated position tracking logic throughout the codebase
- Modified `recordPartnerMove()` to use `currentPartnerPos` for trajectory recording
- Updated goal detection logic to use current positions

**Files Modified**:
- `public/js/nodeGameHumanHumanVersion.js`: Lines 75-95, 216, 320, 354, 785-900

### 5. Enhanced Debugging

**Fixes Applied**:
- Added comprehensive debug logging in `finalizeTrial()` function
- Added move recording logs in `recordPlayerMove()` and `recordPartnerMove()`
- Created test file `test_data_recording_fix.html` to verify fixes

## Summary of Changes

### Server Changes (`server.js`)
```javascript
// Added reactionTime to move_made event broadcast
this.broadcastToRoom('move_made', {
    playerId: playerId,
    action: action,
    reactionTime: moveData.reactionTime || 0,  // ← NEW
    oldPosition: oldPosition,
    newPosition: newPosition,
    goalReached: goalReached,
    gameState: this.gameState,
    currentPlayer: this.currentPlayer,
    movementMode: this.movementMode
});
```

### Client Changes (`public/js/nodeGameHumanHumanVersion.js`)

1. **Added partnerRT array**:
```javascript
gameData.currentTrialData = {
    // ... existing fields ...
    RT: [],
    partnerRT: [],  // ← NEW
    // ... rest of fields ...
};
```

2. **Updated recordPartnerMove function**:
```javascript
function recordPartnerMove(action, reactionTime) {
    // ... safety checks ...

    // Record the move and reaction time
    gameData.currentTrialData.partnerAction.push(action);
    gameData.currentTrialData.partnerRT.push(reactionTime);  // ← NEW

    // ... trajectory recording ...
}
```

3. **Enhanced finalizeTrial function**:
```javascript
function finalizeTrial(success) {
    // ... existing code ...

    // Copy important game state data to trial data
    if (gameData.currentGoals) {
        gameData.currentTrialData.goals = JSON.parse(JSON.stringify(gameData.currentGoals));
    }
    if (gameData.playerStartPos) {
        gameData.currentTrialData.playerStartPos = JSON.parse(JSON.stringify(gameData.playerStartPos));
    }
    if (gameData.partnerStartPos) {
        gameData.currentTrialData.partnerStartPos = JSON.parse(JSON.stringify(gameData.partnerStartPos));
    }
    if (gameData.gridMatrix) {
        gameData.currentTrialData.gridMatrix = JSON.parse(JSON.stringify(gameData.gridMatrix));
    }

    // ... rest of function ...
}
```

## Testing

A comprehensive test file `test_data_recording_fix.html` has been created to verify that all fixes are working correctly. The test covers:

1. **Array Initialization**: Verifies that all required arrays are properly initialized
2. **Move Recording**: Tests that moves and reaction times are recorded correctly
3. **Trial Finalization**: Ensures that game state data is properly saved
4. **Complete Trial Simulation**: Simulates a full trial to check all data recording

## Expected Results

After these fixes, the Excel data should show:

1. ✅ **aimAction and partnerAction as arrays** with proper move data
2. ✅ **Non-zero RT values** for both player and partner moves
3. ✅ **goals, playerStartPos, partnerStartPos** properly saved in trial data
4. ✅ **Accurate trajectory tracking** using current positions
5. ✅ **Separate partnerRT array** for partner reaction times

## Files Modified

1. `server.js` - Added reactionTime to move_made event
2. `public/js/nodeGameHumanHumanVersion.js` - Multiple fixes for data recording
3. `test_data_recording_fix.html` - Test file to verify fixes (new file)
4. `DATA_RECORDING_FIXES.md` - This documentation (new file)

## Next Steps

1. Test the fixes using the provided test file
2. Run actual human-human experiments to verify data recording
3. Check the Excel output to confirm all issues are resolved
4. Monitor console logs for any remaining issues