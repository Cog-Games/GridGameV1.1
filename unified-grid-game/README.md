# Unified Grid Game - Cognitive Science Experiment Platform

A comprehensive, unified platform for conducting grid-based navigation experiments with support for both Human-AI and Human-Human gameplay modes. This system implements a mixed experimental design for cognitive science research.

## 🧠 Experimental Design

### Within-Subject Conditions (Sequential)
All participants experience these conditions in order:
1. **1P1G** - Single player, single goal (practice)
2. **1P2G** - Single player, dual goals (practice)
3. **2P2G** - Two players, two goals (collaboration)
4. **2P3G** - Two players, three goals (dynamic collaboration)

### Between-Subject Factor
Participants are randomly assigned to one of three agent types:
- **Individual-RL** - Partner with non-cooperative AI
- **Joint-RL** - Partner with cooperative AI  
- **Human** - Partner with another human participant

## 🏗️ Architecture Overview

```
unified-grid-game/
├── server/                 # Server-side code
│   └── index.js           # Main Express + Socket.io server
├── shared/                # Code shared between server and client
│   ├── core/              # Game engine and mechanics
│   ├── players/           # Player abstractions (Human, AI)
│   ├── experiments/       # Experiment management
│   ├── config/            # Configuration and settings
│   └── utils/             # Utility functions
├── public/                # Client-side assets
│   ├── index.html         # Main experiment interface
│   ├── css/               # Stylesheets
│   └── js/                # Client-side JavaScript
└── tests/                 # Test files
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm or yarn

### Installation

1. **Navigate to the unified game directory:**
   ```bash
   cd unified-grid-game
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the experiment:**
   Open your browser to `http://localhost:3000`

### Development Mode
```bash
npm run dev  # Starts with nodemon for auto-restart
```

## 🎮 How to Use

### For Participants

1. **Open the experiment URL** in your browser
2. **Select partner type** from the three options:
   - Individual AI (non-cooperative)
   - Cooperative AI (joint decision-making)
   - Human Partner (real-time multiplayer)
3. **Click "Start Experiment"**
4. **Follow on-screen instructions** for each condition

### For Researchers

#### Running Human-AI Experiments
- Participants can start immediately
- AI partner is automatically created
- No waiting or coordination required

#### Running Human-Human Experiments  
- Two participants must join simultaneously
- System automatically pairs waiting participants
- Both participants experience synchronized gameplay

#### Monitoring Experiments
- Visit `http://localhost:3000/health` for server status
- Visit `http://localhost:3000/stats` for detailed statistics
- Visit `http://localhost:3000/experiments` for active experiments

## 🔧 Configuration

### Game Settings
Edit `shared/config/gameConfig.js`:

```javascript
EXPERIMENT: {
  CONDITIONS: ['1P1G', '1P2G', '2P2G', '2P3G'],
  TRIALS_PER_CONDITION: {
    '1P1G': 3,
    '1P2G': 3, 
    '2P2G': 12,
    '2P3G': 12
  }
},

AI: {
  REACTION_TIME: { MIN: 200, MAX: 800 },
  INDIVIDUAL_RL: { TEMPERATURE: 0.1 },
  JOINT_RL: { TEMPERATURE: 0.1, COOPERATION_WEIGHT: 0.8 }
}
```

### Network Settings
```javascript
NETWORK: {
  PORT: 3000,
  MAX_PLAYERS_PER_ROOM: 2,
  ROOM_TIMEOUT: 300000,
  SYNC_INTERVAL: 100
}
```

## 📊 Data Collection

### Automatic Data Recording
The system automatically collects:
- **Trial-level data**: Moves, timing, outcomes, collaboration success
- **Player-level data**: Reaction times, movement patterns, scores
- **Session-level data**: Condition progression, total performance

### Data Structure
```javascript
{
  experimentId: "exp_1234567890_abc123",
  participantId: "participant_1234567890", 
  agentType: "joint-rl",
  conditions: [
    {
      condition: "2P2G",
      trials: [
        {
          trialIndex: 0,
          startTime: 1234567890123,
          duration: 15430,
          success: true,
          collaborationSuccess: true,
          gameData: { /* detailed game state */ },
          playerData: { /* player-specific data */ }
        }
      ]
    }
  ]
}
```

### Export Options
- Real-time data streaming via WebSockets
- JSON export for analysis
- CSV export for statistical software
- Excel export with multiple sheets

## 🤖 AI Agent Details

### Individual-RL Agent
- **Behavior**: Only considers own position and goals
- **Strategy**: Greedy path-finding to nearest goal
- **Cooperation**: None - purely selfish optimization
- **Use Case**: Control condition for non-cooperative behavior

### Joint-RL Agent  
- **Behavior**: Considers both players' positions
- **Strategy**: Optimizes for joint reward and collaboration
- **Cooperation**: Active coordination toward shared goals
- **Use Case**: Test condition for cooperative AI behavior

### Implementation
Both agents use reinforcement learning with:
- Softmax action selection
- Temperature-based exploration
- Q-value estimation for state-action pairs
- Adaptive parameters based on performance

## 🌐 Network Communication

### Socket.io Events

#### Client → Server
```javascript
'join_experiment' - Join with agent type
'player_action' - Send movement action  
'player_ready' - Signal readiness for next phase
```

#### Server → Client  
```javascript
'experiment_joined' - Confirmed experiment entry
'condition_started' - New condition beginning
'trial_started' - Trial initiation
'game_step' - Real-time game state update
'trial_completed' - Trial results and feedback
```

### Real-time Synchronization
- Game state synchronized every 100ms
- Move validation and collision detection on server
- Client-side prediction with server reconciliation

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
1. **Single Player Test**: `http://localhost:3000/test?agent=individual-rl`
2. **Multiplayer Test**: Open multiple browser windows
3. **Load Test**: Use provided load testing scripts

## 📈 Performance Monitoring

### Server Metrics
- Active connections and experiments
- Memory usage and CPU utilization  
- Network latency and throughput
- Error rates and response times

### Game Metrics
- Trial completion rates
- Average reaction times
- Collaboration success rates
- Player dropout statistics

## 🔍 Debugging

### Logging Levels
```javascript
// In gameConfig.js
DEBUG: {
  VERBOSE_LOGGING: true,
  LOG_PLAYER_ACTIONS: true,
  LOG_GAME_STATES: true,
  LOG_AI_DECISIONS: true
}
```

### Common Issues
1. **Port already in use**: Change `PORT` in config or kill existing process
2. **WebSocket connection failed**: Check firewall and proxy settings
3. **AI agent not responding**: Verify RL model loading and computation
4. **Player synchronization issues**: Check network latency and timeout settings

## 🚀 Deployment

### Production Setup
1. **Environment Variables**:
   ```bash
   NODE_ENV=production
   PORT=3000
   ```

2. **Process Management**:
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name "unified-grid-game"
   ```

3. **Reverse Proxy** (nginx):
   ```nginx
   location / {
     proxy_pass http://localhost:3000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection 'upgrade';
   }
   ```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📚 API Reference

### REST Endpoints
- `GET /` - Main experiment interface
- `GET /health` - Server health and statistics
- `GET /config` - Current configuration
- `GET /experiments` - Active experiments (admin)

### WebSocket API
Comprehensive real-time API for game state management, player actions, and experiment coordination.

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Create Pull Request

### Code Style
- Use ESLint configuration provided
- Follow existing naming conventions
- Add JSDoc comments for functions
- Write tests for new features

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For technical support or research collaboration:
- Create an issue on GitHub
- Contact the Duke ECC Lab
- Email: [your-email@duke.edu]

## 🔄 Version History

- **v1.0.0** - Initial unified implementation
  - Combined Human-AI and Human-Human gameplay
  - Full experimental design implementation
  - Real-time multiplayer support
  - Comprehensive data collection

---

**Built for cognitive science research at Duke University ECC Lab**