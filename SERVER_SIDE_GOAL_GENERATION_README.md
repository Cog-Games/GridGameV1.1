# Server-Side Goal Generation for 2P3G Experiments

## Overview

This document describes the implementation of server-side goal generation for 2P3G (Two Players, Three Goals) experiments in the human-human multiplayer game. The goal generation logic has been moved from client-side to server-side to ensure synchronized goal presentation for both players.

## Changes Made

### 1. Client-Side Changes (`public/js/nodeGameHumanHumanFull.js`)

#### Modified `checkNewGoalPresentation2P3G()` function
- **Before**: Complex client-side goal generation with race condition prevention
- **After**: Simple server request for goal generation
- **Key changes**:
  - Removed client-side goal generation logic
  - Removed race condition prevention mechanisms (`waitingForPartnerGoal` flag)
  - Added server request via `socket.emit('request_new_goal', data)`
  - Simplified condition checking

#### Added new socket event handler
- **New handler**: `socket.on('server_new_goal', data)`
- **Purpose**: Receives server-generated goals and updates local state
- **Features**:
  - Updates local goal state
  - Adds new goal to grid matrix
  - Records trial data
  - Shows new goal message
  - Updates visualization

#### Removed unused code
- **Removed**: `generateNewGoal()` function (client-side goal generation)
- **Removed**: `waitingForPartnerGoal` flag initialization
- **Kept**: Legacy `partner_new_goal` handler for compatibility

### 2. Server-Side Changes (`server.js`)

#### Added new socket event handler
- **New handler**: `socket.on('request_new_goal', data)`
- **Purpose**: Handles client requests for new goal generation
- **Features**:
  - Prevents concurrent goal generation requests
  - Uses existing `generateNewGoalWithServerLogic()` method
  - Broadcasts new goal to all players in room
  - Updates server game state

#### Updated `checkNewGoalPresentation()` method
- **Before**: Disabled server-side goal generation
- **After**: Enabled for debugging and logging
- **Purpose**: Now logs goal detection for debugging purposes

#### Enhanced goal generation logic
- **Method**: `generateNewGoalWithServerLogic()`
- **Features**:
  - Supports all distance conditions (`closer_to_player2`, `closer_to_player1`, `equal_to_both`, `no_new_goal`)
  - Implements strict and relaxed constraints
  - Handles grid matrix validation
  - Returns valid goal positions

## How It Works

### 1. Goal Detection
1. Both players move towards the same goal
2. Client-side `checkNewGoalPresentation2P3G()` detects shared goal
3. Client sends `request_new_goal` event to server

### 2. Server Processing
1. Server receives goal generation request
2. Validates request and prevents concurrent processing
3. Generates new goal using server-side logic
4. Broadcasts `server_new_goal` event to all players

### 3. Client Synchronization
1. All clients receive `server_new_goal` event
2. Clients update local state simultaneously
3. New goal appears for both players at the same time

## Benefits

### 1. Synchronization
- **Before**: Race conditions between clients
- **After**: Server ensures simultaneous goal presentation
- **Result**: Both players see new goal at exactly the same time

### 2. Reliability
- **Before**: Complex client-side synchronization logic
- **After**: Simple request-response pattern
- **Result**: More reliable goal generation

### 3. Consistency
- **Before**: Different clients might generate different goals
- **After**: Server generates single goal for all clients
- **Result**: Guaranteed consistency across all players

### 4. Maintainability
- **Before**: Goal generation logic duplicated across clients
- **After**: Single source of truth on server
- **Result**: Easier to maintain and update

## Testing

### Test Page
- **URL**: `http://localhost:3000/test-server-goal-generation`
- **Purpose**: Test server-side goal generation functionality
- **Features**:
  - Connection status monitoring
  - Goal generation request simulation
  - Real-time log output

### Test Scenarios
1. **Basic Goal Generation**: Test with simple distance conditions
2. **Concurrent Requests**: Test race condition prevention
3. **Invalid Requests**: Test error handling
4. **Multiple Players**: Test broadcasting to all players

## Configuration

### Distance Conditions
The server supports the following distance conditions:
- `closer_to_player2`: New goal closer to player 2
- `closer_to_player1`: New goal closer to player 1
- `equal_to_both`: New goal equal distance to both players
- `no_new_goal`: No new goal generated

### Constraints
- **Grid Size**: 15x15 matrix
- **Minimum Steps**: Configurable minimum steps before new goal
- **Distance Thresholds**: Configurable distance constraints
- **Relaxed Constraints**: Fallback for difficult scenarios

## Migration Notes

### Backward Compatibility
- Legacy `partner_new_goal` handler maintained
- Existing client-side code continues to work
- Gradual migration possible

### Performance Impact
- **Network**: Additional server round-trip for goal generation
- **Latency**: Minimal impact (goal generation is infrequent)
- **Server Load**: Increased server processing for goal generation

## Future Enhancements

### Potential Improvements
1. **Caching**: Cache generated goals for similar scenarios
2. **Optimization**: Optimize goal generation algorithms
3. **Analytics**: Track goal generation patterns
4. **Customization**: Allow experiment-specific goal generation rules

### Monitoring
1. **Logging**: Enhanced logging for debugging
2. **Metrics**: Track goal generation success rates
3. **Alerts**: Notify on goal generation failures

## Troubleshooting

### Common Issues
1. **Goal Not Generated**: Check distance conditions and constraints
2. **Desync**: Verify server-client communication
3. **Performance**: Monitor server load during goal generation

### Debug Tools
1. **Server Logs**: Check server console for goal generation logs
2. **Client Logs**: Check browser console for client-side logs
3. **Test Page**: Use test page for isolated testing

## Conclusion

The server-side goal generation implementation provides a robust, synchronized solution for 2P3G experiments. It eliminates race conditions, ensures consistency, and improves maintainability while maintaining backward compatibility with existing systems.