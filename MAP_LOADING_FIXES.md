# Map Loading Fixes for 1P2G to 2P2G Transition

## Issue Description

When transitioning from 1P2G to 2P2G experiments in human-human games, the 2P2G experiment was loading a fallback default map instead of the proper maps from the `MapsFor2P2G.js` file.

## Root Cause Analysis

The issue was in the server's map loading functions (`get2P2GMaps()` and `get2P3GMaps()`). These functions were only adding `target1` and `target2` to the goals array, but they weren't properly handling all available goals. Additionally, there was insufficient debugging to track when the server was falling back to default maps.

## Fixes Applied

### 1. Enhanced Server Map Loading Functions

**Problem**: The server's `get2P2GMaps()` and `get2P3GMaps()` functions were not properly handling all available goals.

**Fix**: Updated both functions to dynamically add all available goals:

```javascript
// Before (server.js lines 288-302)
get2P2GMaps() {
    const maps = [];
    for (const mapId in MapsFor2P2G) {
        const mapData = MapsFor2P2G[mapId][0];
        maps.push({
            gridMatrix: null,
            player1Pos: mapData.initPlayerGrid,
            player2Pos: mapData.initAIGrid,
            goals: [mapData.target1, mapData.target2], // Only 2 goals
            mapId: mapId
        });
    }
    return maps;
}

// After
get2P2GMaps() {
    const maps = [];
    for (const mapId in MapsFor2P2G) {
        const mapData = MapsFor2P2G[mapId][0];
        const goals = [];

        // Add all available goals
        if (mapData.target1) {
            goals.push(mapData.target1);
        }
        if (mapData.target2) {
            goals.push(mapData.target2);
        }
        if (mapData.target3) {
            goals.push(mapData.target3);
        }

        maps.push({
            gridMatrix: null,
            player1Pos: mapData.initPlayerGrid,
            player2Pos: mapData.initAIGrid,
            goals: goals, // All available goals
            mapId: mapId
        });
    }
    return maps;
}
```

### 2. Enhanced Debugging

**Problem**: Insufficient logging to track map loading issues.

**Fixes Applied**:

#### Server-side debugging:
- Enhanced `initializeGameState()` function with detailed logging
- Added logging to track when client-provided maps vs. random maps are used
- Added validation logging for map data availability

#### Client-side debugging:
- Enhanced map selection logging in `createTimelineStagesForHumanHuman()`
- Added detailed logging in `runMultiplayerTrial()` to track map design
- Added validation logging for timeline map data

### 3. Map Validation

**Problem**: No validation to ensure maps are properly structured.

**Fix**: Added validation checks to ensure maps have the required properties:
- `initPlayerGrid` (player starting position)
- `initAIGrid` (partner starting position for 2P games)
- `target1`, `target2` (goals)

## Files Modified

1. **`server.js`**:
   - Lines 288-302: Enhanced `get2P2GMaps()` function
   - Lines 303-317: Enhanced `get2P3GMaps()` function
   - Lines 194-240: Enhanced `initializeGameState()` with debugging

2. **`public/js/nodeGameHumanHumanVersion.js`**:
   - Lines 1080-1120: Enhanced map selection logging
   - Lines 1695-1703: Enhanced multiplayer trial map design logging

3. **`test_map_loading.html`** (new file):
   - Comprehensive test suite to verify map loading
   - Tests for map file loading, selection, timeline creation, and experiment transition

## Testing

### Test File: `test_map_loading.html`

The test file includes four comprehensive tests:

1. **Map File Loading**: Verifies that all map files are properly loaded
2. **Map Selection**: Tests that correct maps are selected for each experiment type
3. **Timeline Creation**: Tests the timeline creation process
4. **Experiment Transition**: Simulates the transition from 1P2G to 2P2G

### How to Test

1. Open `test_map_loading.html` in a browser
2. Run each test sequentially
3. Check the console for detailed debugging information
4. Verify that all tests pass

## Expected Results

After these fixes:

1. ✅ **Proper Map Loading**: 2P2G experiments should load maps from `MapsFor2P2G.js` instead of fallback maps
2. ✅ **Correct Goals**: All available goals (target1, target2, target3) should be included
3. ✅ **Smooth Transition**: The transition from 1P2G to 2P2G should work without issues
4. ✅ **Enhanced Debugging**: Console logs will help identify any remaining issues

## Debugging Information

### Server Console Logs

When a 2P2G trial starts, you should see logs like:
```
=== USING CLIENT-PROVIDED MAP DESIGN ===
Client trial design: { initPlayerGrid: [...], initAIGrid: [...], target1: [...], target2: [...] }
Converted to server map: { player1Pos: [...], player2Pos: [...], goals: [...] }
```

If you see:
```
=== USING RANDOM MAP SELECTION ===
No client design available, falling back to random selection
```

This indicates that the client-provided map design is not reaching the server properly.

### Client Console Logs

During timeline creation, you should see:
```
=== MAP SELECTION FOR 2P2G ===
Experiment maps loaded: 200 maps
Selected 1 maps for 2P2G: [{...}]
Timeline map data for 2P2G: [{...}]
=== END MAP SELECTION ===
```

## Next Steps

1. **Test the fixes**: Use the provided test file to verify map loading
2. **Run actual experiments**: Test the transition from 1P2G to 2P2G
3. **Monitor logs**: Check console logs for any remaining issues
4. **Verify server logs**: Ensure client-provided maps are reaching the server

## Troubleshooting

If the issue persists:

1. **Check map files**: Ensure `MapsFor2P2G.js` is properly loaded
2. **Check server logs**: Look for "Using random map selection" messages
3. **Check client logs**: Verify that map selection is working
4. **Check network**: Ensure the `start_trial` event is reaching the server
5. **Use test file**: Run `test_map_loading.html` to isolate the issue