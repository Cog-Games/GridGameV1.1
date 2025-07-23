// ===============================================================================================
// RL AGENT IMPLEMENTATION FOR NODEGAME
// ===============================================================================================

// RL Agent Configuration
var RL_AGENT_TYPE = 'joint'; // Default agent type
var RL_AGENT_CONFIG = {
    gridSize: 15,
    noise: 0.0,
    gamma: 0.9,
    goalReward: 30,
    softmaxBeta: 5,
    jointTemperature: 0.1
};

// ===============================================================================================
// CORE RL CLASSES AND FUNCTIONS
// ===============================================================================================

class GridWorld {
    constructor(name = '', nx = 0, ny = 0) {
        this.name = name;
        this.nx = nx;
        this.ny = ny;
        this.coordinates = [];
        for (let x = 0; x < nx; x++) {
            for (let y = 0; y < ny; y++) {
                this.coordinates.push([x, y]);
            }
        }
        this.terminals = [];
        this.obstacles = [];
        this.features = {};
    }

    addTerminals(terminals) {
        this.terminals.push(...terminals);
    }

    addObstacles(obstacles) {
        this.obstacles.push(...obstacles);
    }

    addFeatureMap(name, stateValues, defaultValue = 0) {
        this.features[name] = {};
        for (const coord of this.coordinates) {
            this.features[name][coord.toString()] = defaultValue;
        }
        for (const key in stateValues) {
            this.features[name][key.toString()] = stateValues[key];
        }
    }

    isStateValid(state) {
        const [x, y] = state;
        if (x < 0 || x >= this.nx || y < 0 || y >= this.ny) return false;
        return !this.obstacles.some(obs => obs[0] === x && obs[1] === y);
    }

    reward(s, a, s_n, W = null) {
        if (!W) {
            return Object.keys(this.features).reduce((sum, f) => sum + this.features[f][s_n.toString()], 0);
        }
        return Object.keys(W).reduce((sum, f) => sum + this.features[f][s_n.toString()] * W[f], 0);
    }
}

function transition(state, action) {
    return [state[0] + action[0], state[1] + action[1]];
}

class StochasticTransition {
    constructor(noise, noiseActionSpace, terminals, isStateValid) {
        this.noise = noise;
        this.noiseActionSpace = noiseActionSpace;
        this.terminals = terminals;
        this.isStateValid = isStateValid;
    }

    call(state, action) {
        if (this.terminals.some(t => t[0] === state[0] && t[1] === state[1])) {
            return { [state.toString()]: 1 };
        }

        const nextState = transition(state, action);
        if (!this.isStateValid(nextState)) {
            return { [state.toString()]: 1 };
        }

        const possibleNextStates = this.noiseActionSpace
            .map(noiseAction => transition(state, noiseAction))
            .filter(this.isStateValid);

        const noiseProb = this.noise / (possibleNextStates.length - 1 || 1);
        const result = {};
        for (const s of possibleNextStates) {
            result[s.toString()] = noiseProb;
        }
        result[nextState.toString()] = 1.0 - this.noise;

        return result;
    }
}

function softmax(values, beta) {
    const expVals = values.map(v => Math.exp(Math.min(700, v * beta)));
    const sumExp = expVals.reduce((a, b) => a + b, 0);
    return expVals.map(v => v / sumExp);
}

class SoftmaxRLPolicy {
    constructor(Q_dict, beta) {
        this.Q_dict = Q_dict;
        this.beta = beta;
    }

    call(state) {
        const actionDict = this.Q_dict[state.toString()];
        const actions = Object.keys(actionDict);
        const values = actions.map(a => actionDict[a]);
        const probs = softmax(values, this.beta);
        return Object.fromEntries(actions.map((a, i) => [a, probs[i]]));
    }
}

class ValueIteration {
    constructor(gamma, epsilon = 0.001, maxIter = 100, terminals = []) {
        this.gamma = gamma;
        this.epsilon = epsilon;
        this.maxIter = maxIter;
        this.terminals = terminals.map(s => s.toString());
    }

    run(S, A, T, R) {
        const V = {};
        for (const s of S) {
            V[s] = this.terminals.includes(s) ? 0 : 0.1;
        }

        for (let i = 0; i < this.maxIter; i++) {
            const V_copy = { ...V };
            for (const s of S) {
                if (this.terminals.includes(s)) continue;
                V[s] = Math.max(...A.map(a => {
                    return Object.entries(T[s][a]).reduce((sum, [s_n, p]) => {
                        return sum + p * (R[s][a][s_n] + this.gamma * V_copy[s_n]);
                    }, 0);
                }));
            }
            const deltas = S.filter(s => !this.terminals.includes(s)).map(s => Math.abs(V[s] - V_copy[s]));
            if (deltas.every(d => d < this.epsilon)) break;
        }

        return V;
    }
}

class RunIndividualVI {
    constructor(gridSize, actionSpace, noiseSpace, noise, gamma, goalReward, softmaxBeta) {
        this.gridSize = gridSize;
        this.actionSpace = actionSpace;
        this.noiseSpace = noiseSpace;
        this.noise = noise;
        this.gamma = gamma;
        this.goalReward = goalReward;
        this.softmaxBeta = softmaxBeta;
    }

    call(goalStates, obstacles) {
        const env = new GridWorld("test", this.gridSize, this.gridSize);

        if (!Array.isArray(goalStates[0])) goalStates = [goalStates];

        const terminalValue = {};
        for (const s of goalStates) terminalValue[s.toString()] = this.goalReward;

        env.addFeatureMap("goal", terminalValue, 0);
        env.addTerminals(goalStates);
        env.addObstacles(obstacles);

        let S = [];
        for (let x = 0; x < env.nx; x++) {
            for (let y = 0; y < env.ny; y++) {
                const state = [x, y];
                if (env.isStateValid(state)) S.push(state.toString());
            }
        }

        const transitionFunction = new StochasticTransition(
            this.noise,
            this.noiseSpace,
            goalStates,
            env.isStateValid.bind(env)
        );

        const T = {};
        for (const s of S) {
            T[s] = {};
            for (const a of this.actionSpace) {
                T[s][a.toString()] = transitionFunction.call(s.split(',').map(Number), a);
            }
        }

        const stepCost = -1 / (this.gridSize * 2);

        const R = {};
        for (const s of S) {
            R[s] = {};
            for (const a of this.actionSpace) {
                R[s][a.toString()] = {};
                const stateVec = s.split(',').map(Number);
                for (const s_n of S) {
                    const s_nVec = s_n.split(',').map(Number);
                    const reward = goalStates.some(gs => gs.toString() === s_n) ?
                        stepCost + env.reward(s_nVec, a, s_nVec) :
                        stepCost + env.reward(stateVec, a, stateVec);
                    R[s][a.toString()][s_n] = reward;
                }
            }
        }

        const vi = new ValueIteration(this.gamma, 0.001, 100, goalStates);
        const V = vi.run(S, this.actionSpace.map(a => a.toString()), T, R);
        for (const s of goalStates) V[s.toString()] = this.goalReward;

        const Q_dict = {};
        for (const s of S) {
            Q_dict[s] = {};
            for (const a of this.actionSpace.map(a => a.toString())) {
                Q_dict[s][a] = Object.entries(T[s][a]).reduce((sum, [s_n, p]) => {
                    return sum + p * (R[s][a][s_n] + this.gamma * V[s_n]);
                }, 0);
            }
        }

        const policy = new SoftmaxRLPolicy(Q_dict, this.softmaxBeta);

        return { Q_dict, policy };
    }
}

function chooseMaxAction(actionDict) {
    const actions = Object.keys(actionDict);
    const values = Object.values(actionDict);
    const maxValue = Math.max(...values);

    // Filter actions that have the max value
    const actionMaxList = actions.filter(action => actionDict[action] === maxValue);

    // Randomly choose one of the max-valued actions
    const randomIndex = Math.floor(Math.random() * actionMaxList.length);
    return actionMaxList[randomIndex];
}

// ===============================================================================================
// INDIVIDUAL RL AGENT
// ===============================================================================================

/**
 * Individual RL Action - only considers own position and goals
 * @param {number[]} currentPos - AI's current position [row, col]
 * @param {number[][]} goalStates - Array of goal positions [[row1, col1], [row2, col2], ...]
 * @returns {number[]} Action vector [deltaRow, deltaCol]
 */
function getIndividualRLAction(currentPos, goalStates) {
    const actionSpace = [
        [0, -1], // left
        [0, 1],  // right
        [-1, 0], // up
        [1, 0]   // down
    ];

    const noiseActionSpace = [...actionSpace];
    const obstacles = [];

    const runner = new RunIndividualVI(
        RL_AGENT_CONFIG.gridSize,
        actionSpace,
        noiseActionSpace,
        RL_AGENT_CONFIG.noise,
        RL_AGENT_CONFIG.gamma,
        RL_AGENT_CONFIG.goalReward,
        RL_AGENT_CONFIG.softmaxBeta
    );
    const { Q_dict, policy } = runner.call(goalStates, obstacles);

    const probs = policy.call(currentPos);
    const sampledAction = chooseMaxAction(probs);

    return sampledAction;
}

// ===============================================================================================
// JOINT RL AGENT
// ===============================================================================================

// Helper functions for joint RL
function manhattan([r1, c1], [r2, c2]) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function inBounds(row, col) {
    return row >= 0 && row < RL_AGENT_CONFIG.gridSize && col >= 0 && col < RL_AGENT_CONFIG.gridSize;
}

// Apply an action; if it would leave the grid, stay in place.
function applyAction([r, c], [dr, dc]) {
    const nr = r + dr;
    const nc = c + dc;
    return inBounds(nr, nc) ? [nr, nc] : [r, c];
}

// Soft‑max sampling: smaller costs → larger preferences.
function softmaxSample(costs, temperature = 1.0) {
    const prefs = costs.map(c => Math.exp(-c / temperature));
    const sum = prefs.reduce((a, b) => a + b, 0);
    const r = Math.random() * sum;
    let acc = 0;
    for (let i = 0; i < prefs.length; i++) {
        acc += prefs[i];
        if (r < acc) return i;
    }
    return prefs.length - 1; // Fallback (should not be reached)
}

/**
 * Joint RL Action - considers both players for cooperative behavior
 * @param {number[]} aiState - AI's current position [row, col]
 * @param {number[]} playerState - Human player's position [row, col]
 * @param {number[][]} goals - Array of goal positions [[row1, col1], [row2, col2], ...]
 * @param {object} opts - Options object with temperature parameter
 * @returns {number[]|null} Action vector [deltaRow, deltaCol] or null to stay
 */
function getSoftmaxOptimalJointRLActionUseHeuristic(aiState, playerState, goals, opts = {}) {
    const τ = opts.temperature ?? RL_AGENT_CONFIG.jointTemperature;
    const [aiR, aiC] = aiState;

    const actionSpace = [
        [0, -1], // left   (col‑1)
        [0, 1],  // right  (col+1)
        [-1, 0], // up     (row‑1)
        [1, 0]   // down   (row+1)
    ];

    // Check if AI is at a goal
    const aiAtGoal = goals.some(([gR, gC]) => gR === aiR && gC === aiC);

    // Check if human is at a goal
    const [playerR, playerC] = playerState;
    const humanAtGoal = goals.some(([gR, gC]) => gR === playerR && gC === playerC);

    // If both AI and human are at the same goal, don't move (terminal state)
    if (aiAtGoal && humanAtGoal) {
        const sameGoal = goals.find(([gR, gC]) => gR === aiR && gC === aiC && gR === playerR && gC === playerC);
        if (sameGoal) return null;
    }

    // For each possible action, compute the minimum total cost after taking it
    const costs = actionSpace.map(action => {
        const nextPos = applyAction(aiState, action);
        let best = Infinity;

        // If AI is at a goal and human is not, prioritize moving toward human's goal
        if (aiAtGoal && !humanAtGoal) {
            // Find which goal the human is closest to
            let humanClosestGoal = null;
            let humanMinDist = Infinity;
            for (const g of goals) {
                const dist = manhattan(playerState, g);
                if (dist < humanMinDist) {
                    humanMinDist = dist;
                    humanClosestGoal = g;
                }
            }

            // Calculate cost based on moving toward human's goal
            if (humanClosestGoal) {
                const aiDistToHumanGoal = manhattan(nextPos, humanClosestGoal);
                const humanDistToHumanGoal = manhattan(playerState, humanClosestGoal);

                // Encourage AI to move toward human's goal
                const cost = aiDistToHumanGoal + humanDistToHumanGoal;
                best = Math.min(best, cost);
            }
        } else {
            // Normal case: find best joint goal
            for (const g of goals) {
                const cost =
                    manhattan(nextPos, g) +       // AI distance after the move
                    manhattan(playerState, g);    // player's current distance
                if (cost < best) best = cost;
            }
        }

        return best;  // lower cost ⇒ more desirable
    });

    // Sample an action index according to the soft‑max distribution.
    const idx = softmaxSample(costs, τ);
    return actionSpace[idx];
}

// ===============================================================================================
// MAIN AI ACTION FUNCTION
// ===============================================================================================

/**
 * Main function to get AI action based on current agent type
 * @param {Array} gridMatrix - Game grid (not used by RL agents)
 * @param {number[]} currentPos - AI's current position [row, col]
 * @param {number[][]} goals - Array of goal positions [[row1, col1], [row2, col2], ...]
 * @param {number[]} playerPos - Human player position [row, col] (required for joint RL)
 * @returns {number[]} Action vector [deltaRow, deltaCol]
 */
function getAIAction(gridMatrix, currentPos, goals, playerPos = null) {
    if (!goals || goals.length === 0) return [0, 0];

    let action;

    try {
        if (RL_AGENT_TYPE === 'joint' && playerPos !== null) {
            // Use joint RL agent that considers both players' positions for cooperation
            action = getSoftmaxOptimalJointRLAction(currentPos, playerPos, goals, { temperature: RL_AGENT_CONFIG.jointTemperature });
        } else {
            // Use individual RL agent that only considers own position
            if (RL_AGENT_TYPE === 'joint' && playerPos === null) {
                console.warn(`⚠️ Joint RL requested but playerPos is null. Falling back to Individual RL.`);
            }
            action = getIndividualRLAction(currentPos, goals);
        }
    } catch (error) {
        console.error('❌ Error in RL agent:', error);
        action = getIndividualRLAction(currentPos, goals);
    }

    // Convert string action to array format if needed
    if (typeof action === 'string') {
        action = action.split(',').map(Number);
    }

    return action;
}

// ===============================================================================================
// CONFIGURATION FUNCTIONS
// ===============================================================================================

/**
 * Set the RL agent type
 * @param {string} agentType - 'individual' or 'joint'
 */
function setRLAgentType(agentType) {
    if (['individual', 'joint'].includes(agentType)) {
        RL_AGENT_TYPE = agentType;
    } else {
        console.error(`Invalid RL agent type: ${agentType}. Must be 'individual' or 'joint'`);
    }
}

/**
 * Update RL agent configuration
 * @param {object} config - Configuration object with any of the RL_AGENT_CONFIG properties
 */
function updateRLAgentConfig(config) {
    Object.assign(RL_AGENT_CONFIG, config);
}

/**
 * Get current RL agent type
 * @returns {string} Current RL agent type
 */
function getRLAgentType() {
    return RL_AGENT_TYPE;
}

/**
 * Get current RL agent configuration
 * @returns {object} Current RL agent configuration
 */
function getRLAgentConfig() {
    return { ...RL_AGENT_CONFIG };
}

// ===============================================================================================
// CONVENIENCE FUNCTIONS
// ===============================================================================================

function setRLAgentIndividual() {
    setRLAgentType('individual');
}

function setRLAgentJoint() {
    setRLAgentType('joint');
}

// ===============================================================================================
// EXPORTS
// ===============================================================================================

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getAIAction,
        getIndividualRLAction,
        getSoftmaxOptimalJointRLAction,
        setRLAgentType,
        setRLAgentIndividual,
        setRLAgentJoint,
        updateRLAgentConfig,
        getRLAgentType,
        getRLAgentConfig,
        RL_AGENT_TYPE,
        RL_AGENT_CONFIG
    };
}

// Make functions available globally in browser environment
if (typeof window !== 'undefined') {
    window.RLAgent = {
        getAIAction,
        getIndividualRLAction,
        getSoftmaxOptimalJointRLAction,
        setRLAgentType,
        setRLAgentIndividual,
        setRLAgentJoint,
        updateRLAgentConfig,
        getRLAgentType,
        getRLAgentConfig
    };

    // Log initial configuration
    console.log('🤖 RL Agent loaded with configuration:', {
        type: RL_AGENT_TYPE,
        config: RL_AGENT_CONFIG
    });
}


/* ============================================================
   15×15 joint‑planning Soft‑max policy  (milliseconds offline) GPT-O3
   ============================================================ */

const getSoftmaxOptimalJointRLAction = (function () {
    // ---------- grid & actions ----------
    const ROWS = 15, COLS = 15, N = ROWS * COLS;          // N = 225
    const actionSpace = [
        [0, -1], // 0: left
        [0, 1], // 1: right
        [-1, 0], // 2: up
        [1, 0]  // 3: down
    ];

    // ---------- helpers ----------
    const toIdx = (r, c) => r * COLS + c;                         // (row,col) → 0‑224
    const rowOf = idx => Math.floor(idx / COLS);
    const colOf = idx => idx % COLS;
    const inGrid = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

    function stepIdx(idx, action) {
        const r = rowOf(idx), c = colOf(idx);
        const dr = actionSpace[action][0], dc = actionSpace[action][1];
        const nr = r + dr, nc = c + dc;
        return inGrid(nr, nc) ? toIdx(nr, nc) : idx;                 // out‑of‑bounds ⇒ stay
    }

    // greedy player: one step toward nearest joint goal (based on two players joint distances)
    function playerNextIdx(idx, goals, aiIdx = null) {
        const r = rowOf(idx), c = colOf(idx);

        // find closest joint goal (minimizing sum of both players' distances)
        let best = goals[0];
        let bestJointD = Infinity;

        for (let i = 0; i < goals.length; i++) {
            const g = goals[i];
            const playerDist = Math.abs(r - g[0]) + Math.abs(c - g[1]);

            let jointDist;
            if (aiIdx !== null) {
                // Calculate joint distance: player distance + AI distance to this goal
                const aiR = rowOf(aiIdx), aiC = colOf(aiIdx);
                const aiDist = Math.abs(aiR - g[0]) + Math.abs(aiC - g[1]);
                jointDist = playerDist + aiDist;
            } else {
                // Fallback to individual distance if AI position not provided
                jointDist = playerDist;
            }

            if (jointDist < bestJointD) {
                best = g;
                bestJointD = jointDist;
            }
        }

        // move vertically first, then horizontally (deterministic tie‑break)
        let nr = r, nc = c;
        if (r !== best[0]) nr += (best[0] < r ? -1 : 1);
        else if (c !== best[1]) nc += (best[1] < c ? -1 : 1);

        return toIdx(nr, nc);
    }

    // ---------- cache keyed by goals|β ----------
    const planners = new Map();   // key -> { Q: Float32Array, goalSet: Set, beta }

    function hashGoals(goals) {
        // sort to make order irrelevant
        return goals.map(g => `${g[0]},${g[1]}`).sort().join('|');
    }

    // ---------- offline Value‑Iteration builder ----------
    function buildPlanner(goals, beta = 1.0) {
        const goalSet = new Set(goals.map(([r, c]) => toIdx(r, c)));
        const S = N * N;                                         // 50 625 joint states
        const V = new Float32Array(S);                           // value function
        const Q = new Float32Array(S * 4);                       // state–action values
        const rewardGoal = 50, stepCost = -0.1;
        const γ = 1.0;

        let Δ;
        do {
            Δ = 0;
            for (let s = 0; s < S; s++) {
                const aiIdx = Math.floor(s / N);
                const plIdx = s % N;

                // terminal: both on the same goal square
                if (goalSet.has(aiIdx) && aiIdx === plIdx) {
                    V[s] = 0;
                    for (let a = 0; a < 4; a++) Q[s * 4 + a] = 0;
                    continue;
                }

                let bestV = -Infinity;

                for (let a = 0; a < 4; a++) {
                    const aiNext = stepIdx(aiIdx, a);
                    const plNext = playerNextIdx(plIdx, goals, aiNext);
                    const done = goalSet.has(aiNext) && aiNext === plNext;
                    const r = done ? rewardGoal : stepCost;
                    const sNext = aiNext * N + plNext;
                    const q = r + (done ? 0 : γ * V[sNext]);

                    Q[s * 4 + a] = q;               // keep every Q(s,a) for soft‑max later
                    if (q > bestV) bestV = q;
                }

                const diff = Math.abs(bestV - V[s]);
                if (diff > Δ) Δ = diff;
                V[s] = bestV;
            }
        } while (Δ > 1e-4);                   // ~30–40 sweeps, < 10 ms total


        return { Q, goalSet, beta };
    }

    // ---------- public function ----------
    return function getSoftmaxOptimalJointRLAction(aiState, playerState, goals, beta = 1.0) {
        const key = hashGoals(goals) + '|' + beta;
        if (!planners.has(key)) {
            planners.set(key, buildPlanner(goals, beta));
        }
        const { Q, goalSet } = planners.get(key);

        const aiIdx = toIdx(aiState[0], aiState[1]);
        const plIdx = toIdx(playerState[0], playerState[1]);

        // already jointly on a goal → stay
        if (goalSet.has(aiIdx) && aiIdx === plIdx) return null;

        const s = aiIdx * N + plIdx;
        const offset = s * 4;

        // Soft‑max sampling  P(a) ∝ exp(β · Q)
        const prefs = [
            Math.exp(beta * Q[offset]),
            Math.exp(beta * Q[offset + 1]),
            Math.exp(beta * Q[offset + 2]),
            Math.exp(beta * Q[offset + 3])
        ];
        const sum = prefs[0] + prefs[1] + prefs[2] + prefs[3];
        let r = Math.random() * sum;
        let a = 0;
        while (r >= prefs[a]) { r -= prefs[a]; a++; }            // draw action index 0‑3

        return actionSpace[a];
    };
})();
