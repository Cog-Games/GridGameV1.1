# Debug Instructions for Unified Grid Game

## Quick Fix for Dependencies Error

If you're getting the error "The following required components could not be loaded", follow these steps:

### 1. Start the Server
```bash
cd unified-grid-game
node unifiedServer.js
```

### 2. Test Dependencies
Visit: `http://localhost:3000/test-deps`

This will show you exactly which dependencies are missing.

### 3. Debug File Paths
Visit: `http://localhost:3000/debug`

This will show you which files exist and their paths.

### 4. Common Issues and Solutions

#### Issue: "Missing Dependencies" Error
**Solution**: Check that all script files are loading correctly:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Look for any red/failed requests
5. Check the paths are correct

#### Issue: Maps Not Loading
**Solution**: Verify map files exist and server routes work:

1. Check: `http://localhost:3000/config/MapsFor1P1G.js`
2. Check: `http://localhost:3000/config/MapsFor2P2G.js` 
3. Should see JavaScript files, not 404 errors

#### Issue: RL Agent Not Loading  
**Solution**: Verify RL Agent script loads:

1. Check: `http://localhost:3000/shared-js/rlAgent.js`
2. Should see the RL Agent JavaScript code

#### Issue: Socket.io Not Loading
**Solution**: Verify Socket.io is accessible:

1. Check: `http://localhost:3000/socket.io/socket.io.js`
2. Should see Socket.io client library

### 5. Configuration Check

Verify your configuration in `config/experimentConfig.js`:

```javascript
window.EXPERIMENT_CONFIG = {
    experimentMode: 'human-ai',  // Make sure this is set correctly
    rlAgentType: 'joint',        // For human-ai mode
    // ... other settings
};
```

### 6. Server Routes Test

The server should respond to these routes:
- `/` - Main experiment page
- `/shared-js/setup.js` - Core setup script
- `/shared-js/rlAgent.js` - RL Agent script  
- `/config/MapsFor1P1G.js` - Map data
- `/socket.io/socket.io.js` - Socket.io library

### 7. Browser Console Debug

Open browser console and run:

```javascript
// Check if dependencies loaded
console.log('DIRECTIONS:', typeof DIRECTIONS);
console.log('OBJECT:', typeof OBJECT);
console.log('MapsFor1P1G:', typeof MapsFor1P1G);
console.log('RLAgent:', typeof window.RLAgent);
console.log('Config:', window.EXPERIMENT_CONFIG);

// Force dependency check
if (window.UnifiedNodeGameExperiment) {
    window.UnifiedNodeGameExperiment.initialize();
}
```

### 8. Quick Test Commands

In the unified-grid-game directory:

```bash
# Test if server starts
node unifiedServer.js

# Check if files exist
ls ../public/js/rlAgent.js
ls ../public/config/MapsFor1P1G.js
ls config/experimentConfig.js

# Test file serving (in another terminal)
curl http://localhost:3000/shared-js/rlAgent.js
curl http://localhost:3000/config/MapsFor1P1G.js
```

### 9. Emergency Reset

If nothing works, try this reset:

1. Stop the server (Ctrl+C)
2. Delete `node_modules` if it exists: `rm -rf node_modules`
3. Reinstall dependencies: `npm install`  
4. Restart server: `node unifiedServer.js`
5. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
6. Test dependencies: `http://localhost:3000/test-deps`

### 10. Contact Info

If you're still having issues:

1. Check the browser console for specific error messages
2. Check the server console for any startup errors
3. Verify all files exist in the correct locations
4. Test with the debug endpoints above

The most common issue is file path problems - make sure the server is serving files from the correct directories.