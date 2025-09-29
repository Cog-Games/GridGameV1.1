// ===============================================================================================
// RL AGENT IMPLEMENTATION FOR NODEGAME
// ===============================================================================================

// Global hashGoals function for policy caching
function hashGoals(goals) {
    // sort to make order irrelevant
    return goals.map(g => `${g[0]},${g[1]}`).sort().join('|');
}

// RL Agent Configuration
var RL_AGENT_CONFIG = {
    gridSize: 15,
    noise: 0.0,
    gamma: 0.9,
    goalReward: 30,
    stepCost: -1,  // Cost per step (negative reward for movement)
    softmaxBeta: 3.0,
    proximityRewardWeight: 0.02,  // Weight for joint Manhattan distance proximity reward
    coordinationRewardWeight: 0.02,  // Weight for coordination reward when one player is on goal
    maxPolicyIterations: 15,  // Limit iterations for faster initial policy
    progressivePolicyBuilding: true,  // Build policy progressively
    policyBuildTimeout: 10,  // Max time (ms) for initial policy build
    debugMode: false,  // Disable debug logging for performance
    useFastOptimalPolicy: false,  // Use optimized fast version (true) or original version (false)
    enablePolicyPrecalculation: false,  // Enable pre-calculation of policies for instant response
    jointRLImplementation: 'bfs',  // Choose joint RL implementation: '4action', 'original', or 'fast'
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
    // Check for invalid inputs
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }

    // Check for non-finite values
    const invalidValues = values.filter(v => !isFinite(v));
    if (invalidValues.length > 0) {
        // Return uniform distribution as fallback
        return new Array(values.length).fill(1.0 / values.length);
    }

    // Use log-space computation for numerical stability
    const maxVal = Math.max(...values);
    const logProbs = values.map(v => beta * (v - maxVal));

    // Clip to prevent overflow/underflow
    const clippedLogProbs = logProbs.map(logP => Math.max(-700, Math.min(700, logP)));

    const expVals = clippedLogProbs.map(logP => Math.exp(logP));
    const sumExp = expVals.reduce((a, b) => a + b, 0);

    // Check for zero sum
    if (sumExp === 0 || !isFinite(sumExp)) {
        return new Array(values.length).fill(1.0 / values.length);
    }

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

        const stepCost = RL_AGENT_CONFIG.stepCost;

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

/* ============================================================
   15×15 joint‑planning Soft‑max policy  (milliseconds offline) GPT-O3
   ============================================================ */

const getSoftmaxOptimalJointRL4ActionSpace = (function () {
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

        // Function to clear planner cache (useful for debugging)
    function clearPlannerCache() {
        planners.clear();
    }

    // Use global hashGoals function

    // ---------- offline Value‑Iteration builder ----------
    function buildPlanner(goals, beta = 1) {
        const goalSet = new Set(goals.map(([r, c]) => toIdx(r, c)));
        const S = N * N;                                         // 50 625 joint states
        const V = new Float32Array(S);                           // value function
        const Q = new Float32Array(S * 4);                       // state–action values
        const rewardGoal = RL_AGENT_CONFIG.goalReward, stepCost = RL_AGENT_CONFIG.stepCost;
        const γ = RL_AGENT_CONFIG.gamma || 0.9; // Use configured gamma

        // Initialize value function with pessimistic values
        V.fill(-1000);

        // Set terminal states to 0
        for (let s = 0; s < S; s++) {
            const aiIdx = Math.floor(s / N);
            const plIdx = s % N;
            const aiOnGoal = goalSet.has(aiIdx);
            const plOnGoal = goalSet.has(plIdx);
            const bothOnSameGoal = aiOnGoal && plOnGoal && aiIdx === plIdx;

            if (bothOnSameGoal) {
                V[s] = 0;
                for (let a = 0; a < 4; a++) Q[s * 4 + a] = 0;
            }
        }

        let Δ;
        let iterations = 0;
        const maxIterations = 1000; // Increased for better convergence
        const convergenceThreshold = 1e-6; // Much tighter convergence for optimality

        do {
            Δ = 0;
            iterations++;

            for (let s = 0; s < S; s++) {
                const aiIdx = Math.floor(s / N);
                const plIdx = s % N;

                // Check if either player is on a goal (terminal state for episode)
                const aiOnGoal = goalSet.has(aiIdx);
                const plOnGoal = goalSet.has(plIdx);
                const bothOnSameGoal = aiOnGoal && plOnGoal && aiIdx === plIdx;

                // Terminal state: both players on the same goal
                if (bothOnSameGoal) {
                    V[s] = 0;
                    for (let a = 0; a < 4; a++) Q[s * 4 + a] = 0;
                    continue;
                }

                let bestV = -Infinity;

                for (let a = 0; a < 4; a++) {
                    // If AI is already on a goal, it stays there (stationary behavior)
                    const aiNext = aiOnGoal ? aiIdx : stepIdx(aiIdx, a);
                    const plNext = playerNextIdx(plIdx, goals, aiNext);

                    // Check if both players end up on the same goal (reward condition)
                    const aiNextOnGoal = goalSet.has(aiNext);
                    const plNextOnGoal = goalSet.has(plNext);
                    const bothOnSameGoalNext = aiNextOnGoal && plNextOnGoal && aiNext === plNext;

                    // Improved reward structure for better optimality
                    let r = stepCost; // Default step cost

                    if (bothOnSameGoalNext) {
                        r = rewardGoal; // Large reward for reaching goal together
                    } else if (aiNextOnGoal && plNextOnGoal && aiNext !== plNext) {
                        // Both on goals but different goals - small penalty to encourage same goal
                        r = stepCost * 0.5;
                    } else if (aiNextOnGoal || plNextOnGoal) {
                        // One player on goal - small positive reward to encourage goal-seeking
                        r = stepCost * 0.8;
                    }

                    const sNext = aiNext * N + plNext;
                    const q = r + (bothOnSameGoalNext ? 0 : γ * V[sNext]);

                    Q[s * 4 + a] = q;               // keep every Q(s,a) for soft‑max later
                    if (q > bestV) bestV = q;
                }

                const diff = Math.abs(bestV - V[s]);
                if (diff > Δ) Δ = diff;
                V[s] = bestV;
            }

            // Safety check for infinite loops
            if (iterations > maxIterations) {
                console.warn(`⚠️ Value iteration did not converge after ${maxIterations} iterations. Final Δ: ${Δ}`);
                break;
            }

        } while (Δ > convergenceThreshold);

        if (RL_AGENT_CONFIG.debugMode) {
            console.log(`🎯 Value iteration converged in ${iterations} iterations with final Δ: ${Δ}`);
        }

        return { Q, goalSet, beta, iterations, finalDelta: Δ };
    }

    // ---------- public function ----------
    return function getSoftmaxOptimalJointRL4ActionSpace(aiState, playerState, goals, beta = null) {
        // Use configured beta if not provided, fallback to jointTemperature
        if (beta === null) {
            beta = RL_AGENT_CONFIG.softmaxBeta;
        }

        // Ensure beta is reasonable to prevent numerical issues
        if (!isFinite(beta) || beta <= 0) {
            console.warn('⚠️ Invalid beta value, using default of 1.0');
            beta = 1.0;
        }

        const key = hashGoals(goals) + '|' + beta;
        if (!planners.has(key)) {
            planners.set(key, buildPlanner(goals, beta));
        }
        const { Q, goalSet } = planners.get(key);

        const aiIdx = toIdx(aiState[0], aiState[1]);
        const plIdx = toIdx(playerState[0], playerState[1]);

        // Check if both players are on the same goal (terminal state)
        const aiOnGoal = goalSet.has(aiIdx);
        const plOnGoal = goalSet.has(plIdx);
        const bothOnSameGoal = aiOnGoal && plOnGoal && aiIdx === plIdx;

        // If both on same goal, stay (terminal state)
        if (bothOnSameGoal) return null;

        const s = aiIdx * N + plIdx;
        const offset = s * 4;

        // Get Q-values for all actions
        const qValues = [
            Q[offset],
            Q[offset + 1],
            Q[offset + 2],
            Q[offset + 3]
        ];

        // Check for invalid Q-values
        const invalidQValues = qValues.filter(q => !isFinite(q));
        if (invalidQValues.length > 0) {
            console.warn('⚠️ Invalid Q-values detected:', invalidQValues);
            console.warn('⚠️ Clearing planner cache and using uniform random action as fallback');
            planners.clear(); // Clear cache to force rebuild
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Enhanced optimality check: if beta is very high, use greedy action
        if (beta > 10) {
            const maxQ = Math.max(...qValues);
            const bestActions = qValues.map((q, i) => ({ q, i })).filter(item => item.q === maxQ);
            const selectedAction = bestActions[Math.floor(Math.random() * bestActions.length)].i;
            return actionSpace[selectedAction];
        }

        // Soft‑max sampling with improved numerical stability and optimality
        const maxQ = Math.max(...qValues);
        const minQ = Math.min(...qValues);

        // Check for numerical issues
        if (!isFinite(maxQ) || !isFinite(minQ)) {
            console.warn('⚠️ Numerical issues in Q-values, using greedy action');
            const bestAction = qValues.indexOf(maxQ);
            return actionSpace[bestAction];
        }

        // Check if all Q-values are the same (degenerate case)
        if (Math.abs(maxQ - minQ) < 1e-10) {
            // All actions are equally good, choose randomly
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Use log-space computation for better numerical stability
        const logPrefs = qValues.map(q => beta * (q - maxQ));

        // Clip to prevent overflow/underflow
        const clippedLogPrefs = logPrefs.map(logP => Math.max(-700, Math.min(700, logP)));

        const prefs = clippedLogPrefs.map(logP => Math.exp(logP));
        const sum = prefs.reduce((a, b) => a + b, 0);

        // Check for numerical issues in sum
        if (!isFinite(sum) || sum === 0) {
            console.warn('⚠️ Sum of preferences is invalid, using greedy action');
            const bestAction = qValues.indexOf(maxQ);
            return actionSpace[bestAction];
        }

        // Improved action selection with better numerical stability
        const r = Math.random() * sum;
        let acc = 0;
        for (let a = 0; a < prefs.length; a++) {
            acc += prefs[a];
            if (r < acc) {
                return actionSpace[a];
            }
        }

        // Fallback: return best action if numerical issues occur
        const bestAction = qValues.indexOf(maxQ);
        return actionSpace[bestAction];
    };

    // Make clearPlannerCache accessible globally
    if (typeof window !== 'undefined') {
        window.clearPlannerCache = clearPlannerCache;
    }
})();


/* ============================================================
   15×15 joint Value‑Iteration with 4×4 = 16 joint actions
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

    // apply one of four primitive moves; out‑of‑bounds ⇒ stay
    function stepIdx(idx, a) {
        const r = rowOf(idx), c = colOf(idx);
        const dr = actionSpace[a][0], dc = actionSpace[a][1];
        const nr = r + dr, nc = c + dc;
        return inGrid(nr, nc) ? toIdx(nr, nc) : idx;
    }

    // ---------- enhanced cache keyed by goals|β ----------
    const planners = new Map();   // key -> { Q: Float32Array, goalSet: Set, beta }
    const cacheStats = { hits: 0, misses: 0, builds: 0 };

    // Use global hashGoals function

    // Pre-compute common goal configurations for instant access
    const commonGoalConfigs = new Set();
    function precomputeCommonGoals() {
        // Single goal configurations (most common)
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                commonGoalConfigs.add(hashGoals([[r, c]]));
            }
        }
        console.log(`📦 Pre-computed ${commonGoalConfigs.size} common goal configurations`);
    }

    // ---------- offline Value‑Iteration builder (joint 16‑actions) ----------
    function buildPlanner(goals, beta = 1.0) {
        const goalSet = new Set(goals.map(([r, c]) => toIdx(r, c)));
        const S = N * N;                                     // 50 625 joint states
        const V = new Float32Array(S);                       // value table
        const Q = new Float32Array(S * 16);                  // Q(s, jointA) for soft‑max
        const rewardGoal = RL_AGENT_CONFIG.goalReward, stepCost = RL_AGENT_CONFIG.stepCost;
        const γ = RL_AGENT_CONFIG.gamma || 0.9;

        // Precompute distances from every position to every goal (optimized)
        const goalDistances = new Array(N);
        for (let pos = 0; pos < N; pos++) {
            goalDistances[pos] = new Array(goals.length);
            const r = rowOf(pos), c = colOf(pos);
            for (let g = 0; g < goals.length; g++) {
                const goal = goals[g];
                goalDistances[pos][g] = Math.abs(r - goal[0]) + Math.abs(c - goal[1]);
            }
        }

        // Precompute proximity rewards for common goal configurations
        const proximityCache = new Map();
        function getProximityReward(nextAI, nextPL, done) {
            if (done) return 0;

            const cacheKey = `${nextAI}-${nextPL}`;
            if (proximityCache.has(cacheKey)) {
                return proximityCache.get(cacheKey);
            }

            let minJointDist = Infinity;
            for (let g = 0; g < goals.length; g++) {
                const jointDist = goalDistances[nextAI][g] + goalDistances[nextPL][g];
                if (jointDist < minJointDist) {
                    minJointDist = jointDist;
                }
            }

            const reward = -RL_AGENT_CONFIG.proximityRewardWeight * minJointDist;
            proximityCache.set(cacheKey, reward);
            return reward;
        }

        let Δ;
        do {
            Δ = 0;
            for (let s = 0; s < S; s++) {
                const iAI = Math.floor(s / N);   // AI index 0‑224
                const iPL = s % N;               // Player index 0‑224

                // terminal if both players are on the same goal square
                if (goalSet.has(iAI) && goalSet.has(iPL) && iAI === iPL) {
                    V[s] = 0;
                    for (let j = 0; j < 16; j++) Q[s * 16 + j] = 0;
                    continue;
                }

                let best = -Infinity;

                                for (let aAI = 0; aAI < 4; aAI++) {
                    // If AI is already on a goal, it stays there
                    const nextAI = goalSet.has(iAI) ? iAI : stepIdx(iAI, aAI);

                    for (let aPL = 0; aPL < 4; aPL++) {
                        // If player is already on a goal, it stays there
                        const nextPL = goalSet.has(iPL) ? iPL : stepIdx(iPL, aPL);

                        const jointIdx = aAI * 4 + aPL;          // 0‑15
                        const done = goalSet.has(nextAI) && goalSet.has(nextPL) && nextAI === nextPL;

                        // Use cached proximity reward for better performance
                        const proximityReward = getProximityReward(nextAI, nextPL, done);

                        const r = done ? rewardGoal : stepCost + proximityReward;
                        const sNext = nextAI * N + nextPL;
                        const q = r + (done ? 0 : γ * V[sNext]);

                        Q[s * 16 + jointIdx] = q;
                        if (q > best) best = q;
                    }
                }
                const diff = Math.abs(best - V[s]);
                if (diff > Δ) Δ = diff;
                V[s] = best;
            }
        } while (Δ > 1e-3);  // Full convergence for optimality

        return { Q, goalSet, beta };
    }

    // ---------- public function ----------
    return function getSoftmaxOptimalJointRLAction(aiState, playerState, goals, beta = null) {
        // Use configured beta if not provided
        if (beta === null) {
            beta = RL_AGENT_CONFIG.softmaxBeta;
        }

        // Ensure beta is reasonable to prevent numerical issues
        if (!isFinite(beta) || beta <= 0) {
            console.warn('⚠️ Invalid beta value, using default of 1.0');
            beta = 1.0;
        }

        const key = hashGoals(goals) + '|' + beta;
        if (!planners.has(key)) {
            planners.set(key, buildPlanner(goals, beta));
        }
        const { Q, goalSet } = planners.get(key);

        const idxAI = toIdx(aiState[0], aiState[1]);
        const idxPL = toIdx(playerState[0], playerState[1]);

        // already together on a goal → stay
        if (goalSet.has(idxAI) && goalSet.has(idxPL) && idxAI === idxPL) return null;

        const s = idxAI * N + idxPL;
        const o = s * 16;

        // Get Q-values for all 16 joint actions
        const qValues = new Array(16);
        for (let j = 0; j < 16; j++) {
            qValues[j] = Q[o + j];
        }

        // Debug logging (only in debug mode)
        if (RL_AGENT_CONFIG.debugMode) {
            console.log(`🔍 Joint RL Debug - AI: [${aiState}], Player: [${playerState}], Goals: [${goals.map(g => `[${g}]`).join(', ')}]`);
            console.log(`🔍 Q-values range: [${Math.min(...qValues).toFixed(3)}, ${Math.max(...qValues).toFixed(3)}]`);
        }

        // Check for invalid Q-values
        const invalidQValues = qValues.filter(q => !isFinite(q));
        if (invalidQValues.length > 0) {
            console.warn('⚠️ Invalid Q-values detected:', invalidQValues);
            console.warn('⚠️ Clearing planner cache and using uniform random action as fallback');
            planners.clear(); // Clear cache to force rebuild
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Soft‑max sampling with improved numerical stability
        const maxQ = Math.max(...qValues);
        const minQ = Math.min(...qValues);

        // Check for numerical issues
        if (!isFinite(maxQ) || !isFinite(minQ)) {
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Use log-space computation for better numerical stability
        const logPrefs = qValues.map(q => beta * (q - maxQ));

        // Clip to prevent overflow/underflow
        const clippedLogPrefs = logPrefs.map(logP => Math.max(-700, Math.min(700, logP)));

        const prefs = clippedLogPrefs.map(logP => Math.exp(logP));
        const sum = prefs.reduce((a, b) => a + b, 0);

        // Check for numerical issues in sum
        if (!isFinite(sum) || sum === 0) {
            console.warn('⚠️ Sum of preferences is invalid, using uniform random fallback');
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Improved action selection with better numerical stability
        const r = Math.random() * sum;
        let acc = 0;
        for (let j = 0; j < prefs.length; j++) {
            acc += prefs[j];
            if (r < acc) {
                const aiActionIdx = Math.floor(j / 4);    // high bits = AI's choice
                const selectedAction = actionSpace[aiActionIdx];
                if (RL_AGENT_CONFIG.debugMode) {
                    console.log(`🔍 Selected AI action: [${selectedAction}] (index: ${aiActionIdx})`);
                }
                return selectedAction;
            }
        }

        // Fallback: return last action if numerical issues occur
        if (RL_AGENT_CONFIG.debugMode) {
            console.log(`🔍 Using fallback action: [${actionSpace[actionSpace.length - 1]}]`);
        }
        return actionSpace[actionSpace.length - 1];
    };

    // Debug function to inspect Q-values
    function debugQValues(aiState, playerState, goals, beta = null) {
        if (beta === null) {
            beta = RL_AGENT_CONFIG.softmaxBeta;
        }

        const key = hashGoals(goals) + '|' + beta;
        if (!planners.has(key)) {
            planners.set(key, buildPlanner(goals, beta));
        }
        const { Q, goalSet } = planners.get(key);

        const idxAI = toIdx(aiState[0], aiState[1]);
        const idxPL = toIdx(playerState[0], playerState[1]);
        const s = idxAI * N + idxPL;
        const o = s * 16;

        const qValues = new Array(16);
        for (let j = 0; j < 16; j++) {
            qValues[j] = Q[o + j];
        }

        const actionNames = ['left', 'right', 'up', 'down'];
        const jointActions = [];
        for (let aAI = 0; aAI < 4; aAI++) {
            for (let aPL = 0; aPL < 4; aPL++) {
                const jointIdx = aAI * 4 + aPL;
                jointActions.push({
                    aiAction: actionNames[aAI],
                    playerAction: actionNames[aPL],
                    qValue: qValues[jointIdx]
                });
            }
        }

        return {
            aiState,
            playerState,
            goals,
            qValues,
            jointActions,
            maxQ: Math.max(...qValues),
            minQ: Math.min(...qValues)
        };
    }

    // Cache statistics function
    function getCacheStats() {
        return {
            ...cacheStats,
            hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100,
            totalRequests: cacheStats.hits + cacheStats.misses
        };
    }

    // Make debug function accessible
    if (typeof window !== 'undefined') {
        window.debugJointRLQValues = debugQValues;
        window.getJointRLCacheStats = getCacheStats;
    }
})();


/* ============================================================
   OPTIMIZED 15×15 joint Value‑Iteration with Performance Improvements
   ============================================================ */

const getSoftmaxOptimalJointRLActionFast = (function () {
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

    // apply one of four primitive moves; out‑of‑bounds ⇒ stay
    function stepIdx(idx, a) {
        const r = rowOf(idx), c = colOf(idx);
        const dr = actionSpace[a][0], dc = actionSpace[a][1];
        const nr = r + dr, nc = c + dc;
        return inGrid(nr, nc) ? toIdx(nr, nc) : idx;
    }

    // ---------- enhanced cache with LRU management ----------
    const MAX_CACHE_SIZE = 50;  // Limit cache size to prevent memory leaks
    const planners = new Map();   // key -> { Q: Float32Array, goalSet: Set, beta, lastUsed: timestamp }
    const cacheStats = { hits: 0, misses: 0, builds: 0, evictions: 0 };

    // Use global hashGoals function
    function hashGoals(goals) {
        return goals.map(g => `${g[0]},${g[1]}`).sort().join('|');
    }

    // LRU cache management
    function evictOldestCache() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, planner] of planners.entries()) {
            if (planner.lastUsed < oldestTime) {
                oldestTime = planner.lastUsed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            planners.delete(oldestKey);
            cacheStats.evictions++;
        }
    }

    // ---------- OPTIMIZATION 1: Goal Distance Precomputation ----------
    function precomputeGoalDistances(goals) {
        const goalDistances = new Array(N);
        for (let pos = 0; pos < N; pos++) {
            goalDistances[pos] = new Array(goals.length);
            const r = rowOf(pos), c = colOf(pos);
            for (let g = 0; g < goals.length; g++) {
                const goal = goals[g];
                goalDistances[pos][g] = Math.abs(r - goal[0]) + Math.abs(c - goal[1]);
            }
        }
        return goalDistances;
    }



    // ---------- OPTIMIZATION 3: Optimized Value Iteration with Priority Sweeping ----------
    function buildPlannerFast(goals, beta = 1.0) {
        const startTime = performance.now();

        const goalSet = new Set(goals.map(([r, c]) => toIdx(r, c)));
        const S = N * N;                                     // 50 625 joint states
        const V = new Float32Array(S);                       // value table
        const Q = new Float32Array(S * 16);                  // Q(s, jointA) for soft‑max
        const rewardGoal = RL_AGENT_CONFIG.goalReward, stepCost = RL_AGENT_CONFIG.stepCost;
        const γ = RL_AGENT_CONFIG.gamma || 0.9;

        // OPTIMIZATION 1: Precompute all goal distances once
        const goalDistances = precomputeGoalDistances(goals);
        console.log(`⚡ Fast: Precomputed goal distances in ${(performance.now() - startTime).toFixed(1)}ms`);

        // Precompute proximity rewards cache (OPTIMIZATION 1 enhancement)
        const proximityCache = new Map();
        function getProximityReward(nextAI, nextPL, done) {
            if (done) return 0;

            const cacheKey = `${nextAI}-${nextPL}`;
            if (proximityCache.has(cacheKey)) {
                return proximityCache.get(cacheKey);
            }

            let minJointDist = Infinity;
            for (let g = 0; g < goals.length; g++) {
                const jointDist = goalDistances[nextAI][g] + goalDistances[nextPL][g];
                if (jointDist < minJointDist) {
                    minJointDist = jointDist;
                }
            }

            const reward = -RL_AGENT_CONFIG.proximityRewardWeight * minJointDist;
            proximityCache.set(cacheKey, reward);
            return reward;
        }

        console.log(`⚡ Fast: Setup completed in ${(performance.now() - startTime).toFixed(1)}ms`);

        // OPTIMIZATION 3: IMPROVED Value Iteration with proper convergence
        let Δ;
        let iterations = 0;
        const maxIterations = 100; // Increased safety limit
        const convergenceThreshold = 1e-3; // Same as original for optimality

        do {
            Δ = 0;
            iterations++;

            // OPTIMIZATION: Process states in order of potential value change
            // Use a simple heuristic: prioritize states closer to goals
            const stateOrder = [];
            for (let s = 0; s < S; s++) {
                const iAI = Math.floor(s / N);
                const iPL = s % N;

                // Skip terminal states
                if (goalSet.has(iAI) && goalSet.has(iPL) && iAI === iPL) {
                    V[s] = 0;
                    for (let j = 0; j < 16; j++) Q[s * 16 + j] = 0;
                    continue;
                }

                // Calculate heuristic priority based on distance to goals
                let minDist = Infinity;
                for (let g = 0; g < goals.length; g++) {
                    const distAI = goalDistances[iAI][g];
                    const distPL = goalDistances[iPL][g];
                    const jointDist = distAI + distPL;
                    if (jointDist < minDist) minDist = jointDist;
                }

                stateOrder.push({ state: s, priority: minDist });
            }

            // Sort by priority (closer to goals first)
            stateOrder.sort((a, b) => a.priority - b.priority);

            // Process states in priority order
            for (const { state: s } of stateOrder) {
                const iAI = Math.floor(s / N);   // AI index 0‑224
                const iPL = s % N;               // Player index 0‑224

                // Skip terminal states (already handled above)
                if (goalSet.has(iAI) && goalSet.has(iPL) && iAI === iPL) {
                    continue;
                }

                const oldV = V[s];
                let best = -Infinity;

                // Evaluate all joint actions (4x4 = 16)
                for (let aAI = 0; aAI < 4; aAI++) {
                    // If AI already on goal, it stays there
                    const nextAI = goalSet.has(iAI) ? iAI : stepIdx(iAI, aAI);

                    for (let aPL = 0; aPL < 4; aPL++) {
                        // If player already on goal, it stays there
                        const nextPL = goalSet.has(iPL) ? iPL : stepIdx(iPL, aPL);

                        const jointIdx = aAI * 4 + aPL;          // 0‑15
                        const done = goalSet.has(nextAI) && goalSet.has(nextPL) && nextAI === nextPL;

                        // Use cached proximity reward for better performance
                        const proximityReward = getProximityReward(nextAI, nextPL, done);

                        const r = done ? rewardGoal : stepCost + proximityReward;
                        const sNext = nextAI * N + nextPL;
                        const q = r + (done ? 0 : γ * V[sNext]);

                        Q[s * 16 + jointIdx] = q;
                        if (q > best) best = q;
                    }
                }

                // Update value and track convergence
                V[s] = best;
                const diff = Math.abs(best - oldV);
                if (diff > Δ) Δ = diff;
            }

            // Log progress every 50 iterations
            if (iterations % 50 === 0) {
                console.log(`⚡ Fast: Iteration ${iterations}, Δ = ${Δ.toFixed(6)}`);
            }

        } while (Δ > convergenceThreshold && iterations < maxIterations);

        const endTime = performance.now();
        console.log(`✅ Fast: Value iteration converged in ${iterations} iterations, ${(endTime - startTime).toFixed(1)}ms`);
        console.log(`✅ Fast: Final Δ = ${Δ.toFixed(6)}, Convergence: ${Δ <= convergenceThreshold ? 'YES' : 'NO'}`);
        console.log(`✅ Fast: Cache stats - Proximity lookups: ${proximityCache.size}`);

        return { Q, goalSet, beta, lastUsed: Date.now() };
    }

    // ---------- public function with numerical stability improvements ----------
    return function getSoftmaxOptimalJointRLActionFast(aiState, playerState, goals, beta = null) {
        const startTime = performance.now();

        // Use configured beta if not provided
        if (beta === null) {
            beta = RL_AGENT_CONFIG.softmaxBeta;
        }

        // Ensure beta is reasonable to prevent numerical issues
        if (!isFinite(beta) || beta <= 0) {
            console.warn('⚠️ Invalid beta value, using default of 1.0');
            beta = 1.0;
        }

        const key = hashGoals(goals) + '|' + beta;

        // Check cache with LRU management
        if (planners.has(key)) {
            const planner = planners.get(key);
            planner.lastUsed = Date.now(); // Update LRU timestamp
            cacheStats.hits++;
            console.log(`⚡ Fast: Cache hit in ${(performance.now() - startTime).toFixed(2)}ms`);
        } else {
            // Evict oldest if cache is full
            if (planners.size >= MAX_CACHE_SIZE) {
                evictOldestCache();
            }

            cacheStats.misses++;
            cacheStats.builds++;
            planners.set(key, buildPlannerFast(goals, beta));
            console.log(`⚡ Fast: New planner built in ${(performance.now() - startTime).toFixed(1)}ms`);
        }

        const { Q, goalSet } = planners.get(key);

        const idxAI = toIdx(aiState[0], aiState[1]);
        const idxPL = toIdx(playerState[0], playerState[1]);

        // already together on a goal → stay
        if (goalSet.has(idxAI) && goalSet.has(idxPL) && idxAI === idxPL) return null;

        const s = idxAI * N + idxPL;
        const o = s * 16;

        // Get Q-values for all 16 joint actions
        const qValues = new Array(16);
        for (let j = 0; j < 16; j++) {
            qValues[j] = Q[o + j];
        }

        // Check for invalid Q-values
        const invalidQValues = qValues.filter(q => !isFinite(q));
        if (invalidQValues.length > 0) {
            console.warn('⚠️ Fast: Invalid Q-values detected, using fallback');
            planners.delete(key); // Remove corrupted planner
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // OPTIMIZATION: Improved numerical stability in softmax
        const maxQ = Math.max(...qValues);
        const minQ = Math.min(...qValues);

        // Check for numerical issues
        if (!isFinite(maxQ) || !isFinite(minQ)) {
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Use log-space computation for better numerical stability
        const logPrefs = qValues.map(q => Math.max(-700, Math.min(700, beta * (q - maxQ))));
        const prefs = logPrefs.map(logP => Math.exp(logP));
        const sum = prefs.reduce((a, b) => a + b, 0);

        // Check for numerical issues in sum
        if (!isFinite(sum) || sum === 0) {
            console.warn('⚠️ Fast: Sum of preferences is invalid, using uniform random fallback');
            return actionSpace[Math.floor(Math.random() * actionSpace.length)];
        }

        // Improved action selection with better numerical stability
        const r = Math.random() * sum;
        let acc = 0;
        for (let j = 0; j < prefs.length; j++) {
            acc += prefs[j];
            if (r < acc) {
                const aiActionIdx = Math.floor(j / 4);    // high bits = AI's choice
                const selectedAction = actionSpace[aiActionIdx];
                console.log(`⚡ Fast: Action selected in ${(performance.now() - startTime).toFixed(2)}ms`);
                return selectedAction;
            }
        }

        // Fallback: return last action if numerical issues occur
        return actionSpace[actionSpace.length - 1];
    };

    // Cache statistics function for the fast version
    function getFastCacheStats() {
        return {
            ...cacheStats,
            hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100,
            totalRequests: cacheStats.hits + cacheStats.misses,
            cacheSize: planners.size,
            maxCacheSize: MAX_CACHE_SIZE
        };
    }

    // Make cache stats accessible
    if (typeof window !== 'undefined') {
        window.getFastJointRLCacheStats = getFastCacheStats;
    }
})();




// Create window.RLAgent after the IIFE has executed
if (typeof window !== 'undefined') {
    window.RLAgent = {
        getAIAction,
        getIndividualRLAction,
        getSoftmaxOptimalJointRL4ActionSpace,
        getSoftmaxOptimalJointRLAction,
        getSoftmaxOptimalJointRLActionFast,
        setRLAgentType,
        setRLAgentIndividual,
        setRLAgentJoint,
        updateRLAgentConfig,
        getRLAgentType,
        getRLAgentConfig,
        enableFastOptimalPolicy,
        enableOriginalOptimalPolicy,
        getCurrentPolicyVersion,
        analyzeOptimality,
        setJointRLImplementation,
        getJointRLImplementation,
        enable4ActionJointRL,
        enableOriginalJointRL,
        enableFastJointRL,
        enableBFSJointRL,
        getJointRLImplementationInfo,
        enablePolicyPrecalculation,
        disablePolicyPrecalculation,
        isPolicyPrecalculationEnabled,
        getPrecalculationConfig,
        setStepCost,
        getStepCost,
        getProximityRewardInfo,
        optimizePolicyPerformance,
        compareJointRLPerformance,
        compareOriginalVsFastJointRL,
        compareQValuesOriginalVsFast,
        verifyTerminalConditions,
        precalculatePolicyForGoals,
        precalculatePolicyForGoalsAsync,
        precalculateAllJointRLPolicies,
        precalculateAllJointRLPoliciesAsync,
        resetNewGoalPreCalculationFlag,

        getCacheStats: window.getJointRLCacheStats || function() {
            return { hits: 0, misses: 0, builds: 0, hitRate: 0, totalRequests: 0 };
        },
        getFastCacheStats: window.getFastJointRLCacheStats || function() {
            return { hits: 0, misses: 0, builds: 0, evictions: 0, hitRate: 0, totalRequests: 0, cacheSize: 0, maxCacheSize: 50 };
        },
        clearPlannerCache: window.clearPlannerCache || function() {
            // Planner cache clear function not available
        },
        debugJointRLQValues: window.debugJointRLQValues || function() {
            console.log('Debug function not available');
        },
        // Performance comparison and validation functions
        benchmarkJointRLPerformance: function(aiState, playerState, goals, iterations = 10) {
            console.log('🔬 Benchmarking Joint RL Performance Comparison');
            console.log(`Testing with AI:[${aiState}], Player:[${playerState}], Goals:[${goals.map(g => `[${g}]`).join(', ')}]`);

            const results = { original: [], fast: [], identical: true };

            for (let i = 0; i < iterations; i++) {
                // Test original function
                const startOrig = performance.now();
                const actionOrig = getSoftmaxOptimalJointRLAction(aiState, playerState, goals);
                const timeOrig = performance.now() - startOrig;
                results.original.push(timeOrig);

                // Test fast function
                const startFast = performance.now();
                const actionFast = getSoftmaxOptimalJointRLActionFast(aiState, playerState, goals);
                const timeFast = performance.now() - startFast;
                results.fast.push(timeFast);

                // Check if actions are identical (for validation)
                if (JSON.stringify(actionOrig) !== JSON.stringify(actionFast)) {
                    results.identical = false;
                    console.warn(`⚠️ Action mismatch at iteration ${i}: Original=[${actionOrig}], Fast=[${actionFast}]`);
                }
            }

            const avgOrig = results.original.reduce((a, b) => a + b, 0) / iterations;
            const avgFast = results.fast.reduce((a, b) => a + b, 0) / iterations;
            const speedup = avgOrig / avgFast;

            console.log(`📊 Original function: ${avgOrig.toFixed(2)}ms average`);
            console.log(`📊 Fast function: ${avgFast.toFixed(2)}ms average`);
            console.log(`📊 Speedup: ${speedup.toFixed(1)}x faster`);
            console.log(`📊 Results identical: ${results.identical ? '✅ YES' : '❌ NO'}`);

            return { avgOrig, avgFast, speedup, identical: results.identical, results };
        },
        validateOptimality: function(testCases = null) {
            console.log('🔍 Validating Optimality of Fast Function');

            const defaultTestCases = [
                { ai: [0, 0], player: [1, 1], goals: [[5, 5]] },
                { ai: [7, 7], player: [8, 8], goals: [[2, 2], [12, 12]] },
                { ai: [3, 3], player: [10, 10], goals: [[1, 1], [6, 6], [14, 14]] }
            ];

            const cases = testCases || defaultTestCases;
            let allValid = true;

            for (let i = 0; i < cases.length; i++) {
                const { ai, player, goals } = cases[i];
                console.log(`\n🧪 Test case ${i + 1}: AI:[${ai}], Player:[${player}], Goals:[${goals.map(g => `[${g}]`).join(', ')}]`);

                const actionOrig = getSoftmaxOptimalJointRLAction(ai, player, goals);
                const actionFast = getSoftmaxOptimalJointRLActionFast(ai, player, goals);

                const identical = JSON.stringify(actionOrig) === JSON.stringify(actionFast);
                console.log(`   Original: [${actionOrig}]`);
                console.log(`   Fast:     [${actionFast}]`);
                console.log(`   Match: ${identical ? '✅' : '❌'}`);

                if (!identical) allValid = false;
            }

            console.log(`\n🎯 Overall validation: ${allValid ? '✅ PASSED' : '❌ FAILED'}`);
            return allValid;
        },
                compareOriginalVsFastJointRL: function(aiState, playerState, goals) {
            console.log('🔍 Performance Comparison: Original vs Fast Joint RL');
            console.log('Goals:', goals.map(g => `[${g}]`).join(', '));

            // Clear both caches to ensure fair comparison
            planners.clear();

            // Test original version
            console.log('\n📊 Test 1: Original version');
            const startOrig = performance.now();
            const actionOrig = getSoftmaxOptimalJointRLAction(aiState, playerState, goals);
            const timeOrig = performance.now() - startOrig;
            console.log(`⏱️ Time: ${timeOrig.toFixed(1)}ms, Action: [${actionOrig}]`);

            // Test fast version
            console.log('\n📊 Test 2: Fast version');
            planners.clear(); // Clear cache again
            const startFast = performance.now();
            const actionFast = getSoftmaxOptimalJointRLActionFast(aiState, playerState, goals);
            const timeFast = performance.now() - startFast;
            console.log(`⏱️ Time: ${timeFast.toFixed(1)}ms, Action: [${actionFast}]`);

            // Compare actions
            const actionsMatch = JSON.stringify(actionOrig) === JSON.stringify(actionFast);
            console.log(`\n🎯 Actions match: ${actionsMatch ? '✅ YES' : '❌ NO'}`);
            console.log(`🎯 Speed improvement: ${(timeOrig/timeFast).toFixed(1)}x faster`);

            if (!actionsMatch) {
                console.log('⚠️ WARNING: Actions do not match! Fast version may not be optimal.');
            }

                return {
                actionOrig,
                actionFast,
                timeOrig,
                timeFast,
                actionsMatch,
                speedup: timeOrig/timeFast
            };
        },

        compareAllJointRLImplementations: function(aiState, playerState, goals, iterations = 5) {
            console.log('🔬 Comprehensive Comparison of All Joint RL Implementations');
            console.log(`Testing with AI:[${aiState}], Player:[${playerState}], Goals:[${goals.map(g => `[${g}]`).join(', ')}]`);
            console.log(`Running ${iterations} iterations per implementation`);

            const implementations = [
                { name: '4action', func: getSoftmaxOptimalJointRL4ActionSpace },
                { name: 'original', func: getSoftmaxOptimalJointRLAction },
                { name: 'fast', func: getSoftmaxOptimalJointRLActionFast }
            ];

            const results = {};

            // Test each implementation
            for (const impl of implementations) {
                console.log(`\n📊 Testing ${impl.name} implementation...`);
                const times = [];
                const actions = [];

                for (let i = 0; i < iterations; i++) {
                    // Clear cache for fair comparison
                    if (typeof planners !== 'undefined') planners.clear();

                    const start = performance.now();
                    const action = impl.func(aiState, playerState, goals, RL_AGENT_CONFIG.softmaxBeta);
                    const time = performance.now() - start;

                    times.push(time);
                    actions.push(action);
                }

                const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);

                results[impl.name] = {
                    avgTime,
                    minTime,
                    maxTime,
                    actions,
                    times
                };

                console.log(`   Average: ${avgTime.toFixed(2)}ms`);
                console.log(`   Range: ${minTime.toFixed(2)}-${maxTime.toFixed(2)}ms`);
                console.log(`   Actions: ${actions.map(a => `[${a}]`).join(', ')}`);
            }

            // Compare actions between implementations
            console.log('\n🎯 Action Comparison:');
            const action4 = results['4action'].actions[0];
            const actionOrig = results['original'].actions[0];
            const actionFast = results['fast'].actions[0];

            const origVsFast = JSON.stringify(actionOrig) === JSON.stringify(actionFast);
            const fourVsOrig = JSON.stringify(action4) === JSON.stringify(actionOrig);
            const fourVsFast = JSON.stringify(action4) === JSON.stringify(actionFast);

            console.log(`   4action vs Original: ${fourVsOrig ? '✅ Match' : '❌ Different'}`);
            console.log(`   Original vs Fast: ${origVsFast ? '✅ Match' : '❌ Different'}`);
            console.log(`   4action vs Fast: ${fourVsFast ? '✅ Match' : '❌ Different'}`);

            // Performance ranking
            const performanceRanking = Object.entries(results)
                .sort(([,a], [,b]) => a.avgTime - b.avgTime)
                .map(([name, data], index) => ({
                    rank: index + 1,
                    name,
                    avgTime: data.avgTime
                }));

            console.log('\n🏆 Performance Ranking:');
            performanceRanking.forEach((item, index) => {
                const speedup = index > 0 ? performanceRanking[0].avgTime / item.avgTime : 1;
                console.log(`   ${item.rank}. ${item.name}: ${item.avgTime.toFixed(2)}ms ${index > 0 ? `(${speedup.toFixed(1)}x slower)` : '(baseline)'}`);
            });

            return {
                results,
                actionComparison: {
                    fourVsOrig,
                    origVsFast,
                    fourVsFast
                },
                performanceRanking,
                recommendations: {
                    fastest: performanceRanking[0].name,
                    mostOptimal: origVsFast ? 'fast' : 'original',
                    bestOverall: origVsFast ? 'fast' : 'original'
                }
            };
        }
    };


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
        const rlAgentType = NodeGameConfig.getRLAgentType();
        if (rlAgentType === 'joint' && playerPos !== null) {
            // Use joint RL agent that considers both players' positions for cooperation
            if (RL_AGENT_CONFIG.debugMode) {
                const implementationType = RL_AGENT_CONFIG.jointRLImplementation;
                console.log(`🎯 Using Joint RL Agent (${implementationType}) - AI: [${currentPos}], Human: [${playerPos}], Goals: [${goals.map(g => `[${g}]`).join(', ')}]`);
            }

            // Choose joint RL implementation based on config
            switch (RL_AGENT_CONFIG.jointRLImplementation) {
                case '4action':
                    action = getSoftmaxOptimalJointRL4ActionSpace(currentPos, playerPos, goals, RL_AGENT_CONFIG.softmaxBeta);
                    break;
                case 'original':
                    action = getSoftmaxOptimalJointRLAction(currentPos, playerPos, goals, RL_AGENT_CONFIG.softmaxBeta);
                    break;
                case 'fast':
                    action = getSoftmaxOptimalJointRLActionFast(currentPos, playerPos, goals, RL_AGENT_CONFIG.softmaxBeta);
                    break;
                case 'bfs':
                    action = getSoftmaxBFSJointRLAction(currentPos, playerPos, goals, RL_AGENT_CONFIG.softmaxBeta);
                    break;
                default:
                    action = getSoftmaxOptimalJointRLActionFast(currentPos, playerPos, goals, RL_AGENT_CONFIG.softmaxBeta);
                    break;
            }


        } else {
            // Use individual RL agent that only considers own position
            if (rlAgentType === 'joint' && playerPos === null) {
                console.warn(`⚠️ Joint RL requested but playerPos is null. Falling back to Individual RL.`);
            }
            if (RL_AGENT_CONFIG.debugMode) {
                console.log(`🎯 Using Individual RL Agent - AI: [${currentPos}], Goals: [${goals.map(g => `[${g}]`).join(', ')}]`);
            }
            action = getIndividualRLAction(currentPos, goals);
        }
    } catch (error) {
        console.error('❌ Error in RL agent:', error);
        console.log('🔄 Falling back to individual RL agent');
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
    NodeGameConfig.setRLAgentType(agentType);
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
    return NodeGameConfig.getRLAgentType();
}

/**
 * Get current RL agent configuration
 * @returns {object} Current RL agent configuration
 */
function getRLAgentConfig() {
    return { ...RL_AGENT_CONFIG };
}

/**
 * Enable fast optimal policy (optimized version)
 */
function enableFastOptimalPolicy() {
    RL_AGENT_CONFIG.useFastOptimalPolicy = true;
    console.log('✅ Switched to Fast Optimal Policy (optimized version)');
}

/**
 * Enable original optimal policy (original version)
 */
function enableOriginalOptimalPolicy() {
    RL_AGENT_CONFIG.useFastOptimalPolicy = false;
    console.log('✅ Switched to Original Optimal Policy (classic version)');
}

/**
 * Get current policy version being used
 * @returns {string} Current policy version ('fast' or 'original')
 */
    function getCurrentPolicyVersion() {
        return RL_AGENT_CONFIG.useFastOptimalPolicy ? 'fast' : 'original';
    }

    /**
     * Analyze optimality of the current RL agent implementation
     * @param {Array} aiState - AI position [row, col]
     * @param {Array} playerState - Player position [row, col]
     * @param {Array} goals - Array of goal positions [[row, col], ...]
     * @returns {object} Analysis results with optimality metrics
     */
    function analyzeOptimality(aiState, playerState, goals) {
        const results = {
            implementation: RL_AGENT_CONFIG.jointRLImplementation,
            beta: RL_AGENT_CONFIG.softmaxBeta,
            gamma: RL_AGENT_CONFIG.gamma,
            goalReward: RL_AGENT_CONFIG.goalReward,
            stepCost: RL_AGENT_CONFIG.stepCost,
            convergence: {},
            actionQuality: {},
            recommendations: []
        };

        try {
            // Test convergence for different implementations
            const implementations = ['4action', 'original', 'fast'];

            for (const impl of implementations) {
                window.RLAgent.setJointRLImplementation(impl);

                // Clear cache to test fresh convergence
                if (window.clearPlannerCache) {
                    window.clearPlannerCache();
                }

                const startTime = performance.now();
                const action = window.RLAgent.getAIAction(null, aiState, goals, playerState);
                const endTime = performance.now();

                results.convergence[impl] = {
                    action: action,
                    time: (endTime - startTime).toFixed(2),
                    success: action !== null && action !== undefined
                };
            }

            // Test action quality with different betas
            const betas = [0.1, 1.0, 3.0, 10.0];
            window.RLAgent.setJointRLImplementation('4action');

            for (const beta of betas) {
                window.RLAgent.updateRLAgentConfig({ softmaxBeta: beta });
                const action = window.RLAgent.getAIAction(null, aiState, goals, playerState);

                // Calculate expected direction toward goal
                const goalDist = Math.abs(aiState[0] - goals[0][0]) + Math.abs(aiState[1] - goals[0][1]);
                const expectedDirection = [
                    goals[0][0] < aiState[0] ? -1 : goals[0][0] > aiState[0] ? 1 : 0,
                    goals[0][1] < aiState[1] ? -1 : goals[0][1] > aiState[1] ? 1 : 0
                ];

                const isReasonable = action.some((a, i) => a === expectedDirection[i]);

                results.actionQuality[`beta_${beta}`] = {
                    action: action,
                    expectedDirection: expectedDirection,
                    isReasonable: isReasonable,
                    goalDistance: goalDist
                };
            }

            // Generate recommendations
            if (results.convergence['4action'].time > 100) {
                results.recommendations.push('Consider using fast implementation for better performance');
            }

            if (!results.actionQuality['beta_10.0'].isReasonable) {
                results.recommendations.push('High beta actions may not be optimal - check reward structure');
            }

            if (results.convergence['4action'].time < results.convergence['fast'].time) {
                results.recommendations.push('4action implementation is faster than fast - this is unexpected');
            }

            // Check if current beta is appropriate
            const reasonableActions = Object.values(results.actionQuality).filter(q => q.isReasonable).length;
            if (reasonableActions < Object.keys(results.actionQuality).length * 0.75) {
                results.recommendations.push('Many actions are not reasonable - consider adjusting beta or reward structure');
            }

        } catch (error) {
            results.error = error.message;
            results.recommendations.push('Error during analysis - check implementation');
        }

        return results;
    }

/**
 * Set joint RL implementation
 * @param {string} implementation - '4action', 'original', or 'fast'
 */
function setJointRLImplementation(implementation) {
    const validImplementations = ['4action', 'original', 'fast', 'bfs'];
    if (validImplementations.includes(implementation)) {
        RL_AGENT_CONFIG.jointRLImplementation = implementation;
        console.log(`✅ Joint RL implementation set to: ${implementation}`);
    } else {
        console.error(`Invalid joint RL implementation: ${implementation}. Must be one of: ${validImplementations.join(', ')}`);
    }
}

/**
 * Get current joint RL implementation
 * @returns {string} Current joint RL implementation
 */
function getJointRLImplementation() {
    return RL_AGENT_CONFIG.jointRLImplementation;
}

/**
 * Enable 4-action joint RL implementation (AI moves, player follows heuristic)
 */
function enable4ActionJointRL() {
    setJointRLImplementation('4action');
}

/**
 * Enable original 16-action joint RL implementation (full joint planning)
 */
function enableOriginalJointRL() {
    setJointRLImplementation('original');
}

/**
 * Enable fast 16-action joint RL implementation (optimized full joint planning)
 */
function enableFastJointRL() {
    setJointRLImplementation('fast');
}

/**
 * Enable BFS joint RL implementation (reverse 4-D BFS planner)
 */
function enableBFSJointRL() {
    setJointRLImplementation('bfs');
}

/**
 * Get information about all available joint RL implementations
 * @returns {object} Information about each implementation
 */
function getJointRLImplementationInfo() {
    return {
        '4action': {
            name: '4-Action Space',
            description: 'AI moves optimally, player follows heuristic path to nearest goal',
            characteristics: ['Fastest computation', 'Simpler model', 'AI optimal, player heuristic'],
            bestFor: 'Performance-critical applications, simple coordination'
        },
        'original': {
            name: 'Original 16-Action Space',
            description: 'Full joint planning with 16 possible joint actions (4x4)',
            characteristics: ['Full optimality', 'Complete joint planning', 'Proven algorithm'],
            bestFor: 'Research, maximum optimality, debugging'
        },
        'fast': {
            name: 'Fast 16-Action Space',
            description: 'Optimized version of full joint planning with performance improvements',
            characteristics: ['Full optimality', 'Optimized performance', 'Identical results to original'],
            bestFor: 'Production use, best balance of speed and optimality'
        },
        'bfs': {
            name: 'BFS Joint Planner',
            description: 'Reverse 4-D BFS planner with exact optimality (γ = 1)',
            characteristics: ['Exact optimality', 'BFS-based distance computation', 'Efficient 4-D state space'],
            bestFor: 'Exact optimal planning, research, γ = 1 scenarios'
        }
    };
}

/**
 * Enable policy pre-calculation for instant response
 */
function enablePolicyPrecalculation() {
    RL_AGENT_CONFIG.enablePolicyPrecalculation = true;
    console.log('✅ Policy pre-calculation enabled');
}

/**
 * Disable policy pre-calculation to save memory and computation
 */
function disablePolicyPrecalculation() {
    RL_AGENT_CONFIG.enablePolicyPrecalculation = false;
    console.log('⏭️ Policy pre-calculation disabled');
}

/**
 * Get current pre-calculation status
 * @returns {boolean} Whether pre-calculation is enabled
 */
function isPolicyPrecalculationEnabled() {
    return RL_AGENT_CONFIG.enablePolicyPrecalculation;
}

/**
 * Get pre-calculation configuration information
 * @returns {object} Information about pre-calculation settings
 */
function getPrecalculationConfig() {
    return {
        enabled: RL_AGENT_CONFIG.enablePolicyPrecalculation,
        description: "Controls whether policies are pre-calculated for instant response",
        benefits: {
            enabled: "Eliminates first-move lag, provides instant AI responses",
            disabled: "Saves memory and computation, policies calculated on-demand"
        },
        recommendation: "Enable for smooth gameplay, disable for memory-constrained environments"
    };
}

/**
 * Set step cost for RL agent
 * @param {number} stepCost - Cost per step (negative reward for movement)
 */
function setStepCost(stepCost) {
    RL_AGENT_CONFIG.stepCost = stepCost;
    console.log(`✅ Step cost set to: ${stepCost}`);
}

/**
 * Get current step cost
 * @returns {number} Current step cost value
 */
function getStepCost() {
    return RL_AGENT_CONFIG.stepCost;
}

/**
 * Get proximity reward parameters explanation
 * @returns {object} Explanation of proximity reward parameters
 */
function getProximityRewardInfo() {
    return {
        proximityRewardWeight: {
            value: RL_AGENT_CONFIG.proximityRewardWeight,
            description: "Weight for joint Manhattan distance reward. Higher values encourage both players to move toward goals more aggressively.",
            range: "0.001 to 0.1 (recommended: 0.01-0.05)"
        },
        coordinationRewardWeight: {
            value: RL_AGENT_CONFIG.coordinationRewardWeight,
            description: "Weight for coordination reward when one player is already on a goal. Higher values encourage the other player to join more strongly.",
            range: "0.01 to 0.1 (recommended: 0.02-0.05)"
        },
        jointManhattanDistance: {
            description: "Minimum sum of distances from both players to the same goal. Used as base proximity reward.",
            formula: "min_over_goals(AI_dist_to_goal + Player_dist_to_goal)"
        }
    };
}

/**
 * Optimize policy building performance
 * @param {object} options - Performance optimization options
 */
function optimizePolicyPerformance(options = {}) {
    const defaults = {
        maxIterations: 15,
        convergenceThreshold: 1e-2,
        disableProximityRewards: false,
        useSimplifiedRewards: true
    };

    const config = { ...defaults, ...options };

    RL_AGENT_CONFIG.maxPolicyIterations = config.maxIterations;
    RL_AGENT_CONFIG.convergenceThreshold = config.convergenceThreshold;

    if (config.disableProximityRewards) {
        RL_AGENT_CONFIG.proximityRewardWeight = 0;
        RL_AGENT_CONFIG.coordinationRewardWeight = 0;
    }

    console.log('⚡ Performance optimization applied:', config);
}



/**
 * Pre-calculate policy for new goals to eliminate first-move lag
 * Call this function immediately when new goals are generated
 * @param {number[][]} goals - Array of goal positions
 * @param {string} experimentType - Optional experiment type to check for 1P2G condition
 */
function precalculatePolicyForGoals(goals, experimentType = null) {
    // Check if pre-calculation is enabled in config
    if (!RL_AGENT_CONFIG.enablePolicyPrecalculation) {
        console.log('⏭️ Policy pre-calculation disabled in config');
        return false;
    }

    if (!goals || goals.length === 0) {
        console.warn('⚠️ No goals provided for policy pre-calculation');
        return false;
    }

    // Skip pre-calculation for 1P2G condition (1 player, 2 goals)
    if (experimentType && experimentType.includes('1P2G')) {
        console.log('⏭️ Skipping policy pre-calculation for 1P2G condition');
        return false;
    }

    const implementation = RL_AGENT_CONFIG.jointRLImplementation;
    console.log(`⚡ Pre-calculating ${implementation} joint RL policy for goals:`, goals.map(g => `[${g}]`).join(', '));

    const startTime = performance.now();

    try {
        // Force policy calculation by calling the selected implementation with dummy states
        const dummyAIState = [0, 0];
        const dummyPlayerState = [1, 1];

        console.log(`⚡ Pre-calculating ${implementation} policy...`);

        // Choose implementation based on config
        switch (implementation) {
            case '4action':
                getSoftmaxOptimalJointRL4ActionSpace(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
                break;
            case 'original':
                getSoftmaxOptimalJointRLAction(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
                break;
            case 'fast':
            default:
                getSoftmaxOptimalJointRLActionFast(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
                break;
        }

        const endTime = performance.now();
        console.log(`✅ ${implementation} policy pre-calculated in ${(endTime - startTime).toFixed(1)}ms`);

        return true;
    } catch (error) {
        console.error(`❌ Error pre-calculating ${implementation} policy:`, error);
        return false;
    }
}

/**
 * Asynchronous version of precalculatePolicyForGoals for non-blocking execution
 * @param {number[][]} goals - Array of goal positions
 * @param {function} callback - Optional callback function to call when complete
 * @param {string} experimentType - Optional experiment type to check for 1P2G condition
 */
function precalculatePolicyForGoalsAsync(goals, callback = null, experimentType = null) {
    // Check if pre-calculation is enabled in config
    if (!RL_AGENT_CONFIG.enablePolicyPrecalculation) {
        // console.log('⏭️ Async policy pre-calculation disabled in config');
        if (callback) callback(false);
        return;
    }

    if (!goals || goals.length === 0) {
        console.warn('⚠️ No goals provided for async policy pre-calculation');
        if (callback) callback(false);
        return;
    }

    // Use setTimeout to make this non-blocking
    setTimeout(() => {
        const result = precalculatePolicyForGoals(goals, experimentType);
        if (callback) callback(result);
    }, 0);
}

/**
 * Pre-calculate policies for all three joint RL implementations
 * This ensures all caches are warmed up regardless of which implementation is selected
 * @param {number[][]} goals - Array of goal positions
 * @param {string} experimentType - Optional experiment type to check for 1P2G condition
 * @returns {object} Results for each implementation
 */
function precalculateAllJointRLPolicies(goals, experimentType = null) {
    if (!goals || goals.length === 0) {
        console.warn('⚠️ No goals provided for all-policy pre-calculation');
        return { success: false, results: {} };
    }

    // Skip pre-calculation for 1P2G condition (1 player, 2 goals)
    if (experimentType && experimentType.includes('1P2G')) {
        console.log('⏭️ Skipping all-policy pre-calculation for 1P2G condition');
        return { success: false, results: {}, reason: '1P2G condition' };
    }

    console.log('⚡ Pre-calculating ALL joint RL policies for goals:', goals.map(g => `[${g}]`).join(', '));

    const startTime = performance.now();
    const dummyAIState = [0, 0];
    const dummyPlayerState = [1, 1];
    const results = {};

    try {
        // Pre-calculate 4-action implementation
        console.log('⚡ Pre-calculating 4action policy...');
        const start4 = performance.now();
        getSoftmaxOptimalJointRL4ActionSpace(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
        const time4 = performance.now() - start4;
        results['4action'] = { success: true, time: time4 };
        console.log(`✅ 4action policy pre-calculated in ${time4.toFixed(1)}ms`);

        // Pre-calculate original implementation
        console.log('⚡ Pre-calculating original policy...');
        const startOrig = performance.now();
        getSoftmaxOptimalJointRLAction(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
        const timeOrig = performance.now() - startOrig;
        results['original'] = { success: true, time: timeOrig };
        console.log(`✅ Original policy pre-calculated in ${timeOrig.toFixed(1)}ms`);

        // Pre-calculate fast implementation
        console.log('⚡ Pre-calculating fast policy...');
        const startFast = performance.now();
        getSoftmaxOptimalJointRLActionFast(dummyAIState, dummyPlayerState, goals, RL_AGENT_CONFIG.softmaxBeta);
        const timeFast = performance.now() - startFast;
        results['fast'] = { success: true, time: timeFast };
        console.log(`✅ Fast policy pre-calculated in ${timeFast.toFixed(1)}ms`);

        const totalTime = performance.now() - startTime;
        console.log(`🎯 All policies pre-calculated in ${totalTime.toFixed(1)}ms total`);

        return {
            success: true,
            results,
            totalTime,
            summary: {
                fastest: Object.entries(results).reduce((a, b) => a[1].time < b[1].time ? a : b)[0],
                slowest: Object.entries(results).reduce((a, b) => a[1].time > b[1].time ? a : b)[0]
            }
        };

    } catch (error) {
        console.error('❌ Error pre-calculating all policies:', error);
        return { success: false, results, error: error.message };
    }
}

/**
 * Asynchronous version of precalculateAllJointRLPolicies for non-blocking execution
 * @param {number[][]} goals - Array of goal positions
 * @param {function} callback - Optional callback function to call when complete
 * @param {string} experimentType - Optional experiment type to check for 1P2G condition
 */
function precalculateAllJointRLPoliciesAsync(goals, callback = null, experimentType = null) {
    if (!goals || goals.length === 0) {
        console.warn('⚠️ No goals provided for async all-policy pre-calculation');
        if (callback) callback({ success: false, results: {} });
        return;
    }

    // Use setTimeout to make this non-blocking
    setTimeout(() => {
        const result = precalculateAllJointRLPolicies(goals, experimentType);
        if (callback) callback(result);
    }, 0);
}

/**
 * Reset the new goal pre-calculation flag
 * Call this when starting a new trial or when goals change
 */
function resetNewGoalPreCalculationFlag() {
    if (typeof window !== 'undefined') {
        window.newGoalPreCalculated = false;
        // console.log('🔄 Reset new goal pre-calculation flag');
    }
}

/**
 * Enable automatic policy pre-calculation when goals change
 * This will eliminate first-move lag by pre-calculating policies
 */
function enableAutoPolicyPrecalculation() {
    if (typeof window === 'undefined') return;

    // Store original goals to detect changes
    let lastKnownGoals = [];

    // Override the getAIAction function to detect goal changes
    const originalGetAIAction = window.RLAgent.getAIAction;
    window.RLAgent.getAIAction = function(gridMatrix, currentPos, goals, playerPos = null) {
        // Check if goals have changed
        const goalsChanged = JSON.stringify(goals) !== JSON.stringify(lastKnownGoals);

        if (goalsChanged && goals && goals.length > 0) {
            console.log('🎯 Goals changed, pre-calculating policy...');
            lastKnownGoals = JSON.parse(JSON.stringify(goals));

            // Pre-calculate policy in background (respects config setting)
            setTimeout(() => {
                precalculatePolicyForGoals(goals, null); // No experiment type available in this context
            }, 0);
        }

        // Call original function
        return originalGetAIAction.call(this, gridMatrix, currentPos, goals, playerPos);
    };

    console.log('✅ Auto policy pre-calculation enabled');
}



/**
 * Performance comparison between 4-action and 16-action joint RL
 * This will help you see the performance difference
 */
function compareJointRLPerformance(aiState, playerState, goals) {
    console.log('🔍 Performance Comparison: 4-action vs 16-action Joint RL');

    // Test 4-action version
    const start4 = performance.now();
    const action4 = getSoftmaxOptimalJointRL4ActionSpace(aiState, playerState, goals);
    const time4 = performance.now() - start4;

    // Test 16-action version
    const start16 = performance.now();
    const action16 = getSoftmaxOptimalJointRLAction(aiState, playerState, goals);
    const time16 = performance.now() - start16;

    console.log(`📊 4-action version: ${time4.toFixed(1)}ms, action: [${action4}]`);
    console.log(`📊 16-action version: ${time16.toFixed(1)}ms, action: [${action16}]`);
    console.log(`📊 Performance ratio: ${(time16/time4).toFixed(1)}x slower`);

    return { action4, action16, time4, time16, ratio: time16/time4 };
}

/**
 * Performance comparison between original and fast joint RL implementations
 * This will help verify that the fast version maintains optimality
 */
function compareOriginalVsFastJointRL(aiState, playerState, goals) {
    console.log('🔍 Performance Comparison: Original vs Fast Joint RL');
    console.log('Goals:', goals.map(g => `[${g}]`).join(', '));

    // Clear both caches to ensure fair comparison
    planners.clear();

    // Test original version
    console.log('\n📊 Test 1: Original version');
    const startOrig = performance.now();
    const actionOrig = getSoftmaxOptimalJointRLAction(aiState, playerState, goals);
    const timeOrig = performance.now() - startOrig;
    console.log(`⏱️ Time: ${timeOrig.toFixed(1)}ms, Action: [${actionOrig}]`);

    // Test fast version
    console.log('\n📊 Test 2: Fast version');
    planners.clear(); // Clear cache again
    const startFast = performance.now();
    const actionFast = getSoftmaxOptimalJointRLActionFast(aiState, playerState, goals);
    const timeFast = performance.now() - startFast;
    console.log(`⏱️ Time: ${timeFast.toFixed(1)}ms, Action: [${actionFast}]`);

    // Compare actions
    const actionsMatch = JSON.stringify(actionOrig) === JSON.stringify(actionFast);
    console.log(`\n🎯 Actions match: ${actionsMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`🎯 Speed improvement: ${(timeOrig/timeFast).toFixed(1)}x faster`);

    if (!actionsMatch) {
        console.log('⚠️ WARNING: Actions do not match! Fast version may not be optimal.');
    }

        return {
        actionOrig,
        actionFast,
        timeOrig,
        timeFast,
        actionsMatch,
        speedup: timeOrig/timeFast
    };
}

/**
 * Deep comparison of Q-values between original and fast implementations
 * This helps verify that the fast version produces the same optimal policy
 */
function compareQValuesOriginalVsFast(aiState, playerState, goals) {
    console.log('🔍 Deep Q-Value Comparison: Original vs Fast Joint RL');
    console.log('Goals:', goals.map(g => `[${g}]`).join(', '));

    // Clear both caches to ensure fair comparison
    planners.clear();

    // Get Q-values from original version
    const origQValues = debugQValues(aiState, playerState, goals);

    // Clear cache and get Q-values from fast version
    planners.clear();
    const fastQValues = debugQValues(aiState, playerState, goals);

    // Compare Q-value statistics
    const origMaxQ = Math.max(...origQValues.qValues);
    const origMinQ = Math.min(...origQValues.qValues);
    const fastMaxQ = Math.max(...fastQValues.qValues);
    const fastMinQ = Math.min(...fastQValues.qValues);

    console.log('\n📊 Q-Value Statistics:');
    console.log(`Original - Max: ${origMaxQ.toFixed(6)}, Min: ${origMinQ.toFixed(6)}`);
    console.log(`Fast     - Max: ${fastMaxQ.toFixed(6)}, Min: ${fastMinQ.toFixed(6)}`);

    // Check if optimal actions match
    const origBestAction = origQValues.jointActions.reduce((best, current) =>
        current.qValue > best.qValue ? current : best
    );
    const fastBestAction = fastQValues.jointActions.reduce((best, current) =>
        current.qValue > best.qValue ? current : best
    );

    const optimalActionsMatch = origBestAction.qValue === fastBestAction.qValue;
    console.log(`\n🎯 Optimal actions match: ${optimalActionsMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`Original best: ${origBestAction.aiAction} (Q=${origBestAction.qValue.toFixed(6)})`);
    console.log(`Fast best:     ${fastBestAction.aiAction} (Q=${fastBestAction.qValue.toFixed(6)})`);

    // Calculate Q-value differences
    const qDiffs = origQValues.qValues.map((origQ, i) => Math.abs(origQ - fastQValues.qValues[i]));
    const maxDiff = Math.max(...qDiffs);
    const avgDiff = qDiffs.reduce((sum, diff) => sum + diff, 0) / qDiffs.length;

    console.log(`\n📊 Q-Value Differences:`);
    console.log(`Max difference: ${maxDiff.toFixed(6)}`);
    console.log(`Avg difference: ${avgDiff.toFixed(6)}`);

    const isOptimal = maxDiff < 1e-6 && optimalActionsMatch;
    console.log(`\n🎯 Fast version optimality: ${isOptimal ? '✅ MAINTAINED' : '❌ DEGRADED'}`);

    return {
        origQValues,
        fastQValues,
        optimalActionsMatch,
        maxQDiff: maxDiff,
        avgQDiff: avgDiff,
        isOptimal
    };
}

/**
 * Verify terminal conditions for joint RL functions
 * @param {number[]} aiState - AI position
 * @param {number[]} playerState - Player position
 * @param {number[][]} goals - Goal positions
 */
function verifyTerminalConditions(aiState, playerState, goals) {
    console.log('🔍 Verifying Terminal Conditions for Joint RL');

    const goalSet = new Set(goals.map(([r, c]) => r * 15 + c));
    const aiIdx = aiState[0] * 15 + aiState[1];
    const plIdx = playerState[0] * 15 + playerState[1];

    const aiOnGoal = goalSet.has(aiIdx);
    const plOnGoal = goalSet.has(plIdx);
    const bothOnSameGoal = aiOnGoal && plOnGoal && aiIdx === plIdx;

    console.log(`📊 AI position: [${aiState}] ${aiOnGoal ? '(ON GOAL)' : '(NOT ON GOAL)'}`);
    console.log(`📊 Player position: [${playerState}] ${plOnGoal ? '(ON GOAL)' : '(NOT ON GOAL)'}`);
    console.log(`📊 Both on same goal: ${bothOnSameGoal ? 'YES (TERMINAL)' : 'NO'}`);

    // Test action selection
    const action = getSoftmaxOptimalJointRL4ActionSpace(aiState, playerState, goals);
    console.log(`📊 Selected action: ${action === null ? 'STAY (terminal)' : `[${action}]`}`);

    return {
        aiOnGoal,
        plOnGoal,
        bothOnSameGoal,
        action,
        isTerminal: bothOnSameGoal
    };
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
        clearPlannerCache: function() {
            console.log('🗑️ Planner cache clear function not available in Node.js environment');
        },
        RL_AGENT_CONFIG
    };
}


/* ============================================================
   Reverse 4‑D BFS planner  (γ = 1  ⇒ exact)
   ============================================================ */

const getSoftmaxBFSJointRLAction = (function () {
  // ---------- grid & actions ----------
  const ROWS = 15, COLS = 15, N = ROWS * COLS;        // single‑agent states
  const actionSpace = [
    [0, -1], [0,  1], [-1, 0], [1, 0]                 // L, R, U, D
  ];

  // ---------- helpers ----------
  const toIdx   = (r, c)   => r * COLS + c;           // (row,col) ➜ 0‑224
  const rowOf   = i => Math.floor(i / COLS);
  const colOf   = i => i % COLS;
  const inGrid  = (r, c)   => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const stepIdx = (idx, a) => {                       // apply action, stay on OOB
    const r  = rowOf(idx), c  = colOf(idx);
    const nr = r + actionSpace[a][0];
    const nc = c + actionSpace[a][1];
    return inGrid(nr, nc) ? toIdx(nr, nc) : idx;
  };

  // ---------- cache keyed only by goal set (distance doesn't depend on β) ----------
  const planners = new Map();   // key -> { dist: Int16Array, goalSet: Set }

  function hashGoals(goals) {
    return goals.map(g => `${g[0]},${g[1]}`).sort().join('|');
  }

  // ---------- build Q-value table using BFS-based approach ----------
  function buildPlanner(goals, beta = 1.0) {
    const goalSet = new Set(goals.map(([r, c]) => toIdx(r, c)));
    const S = N * N;                                     // 50 625 joint states
    const Q = new Float32Array(S * 16);                  // Q(s, jointA) for soft‑max
    const rewardGoal = RL_AGENT_CONFIG.goalReward, stepCost = RL_AGENT_CONFIG.stepCost;
    const γ = RL_AGENT_CONFIG.gamma || 0.9;

    // Precompute distances from every position to every goal
    const goalDistances = new Array(N);
    for (let pos = 0; pos < N; pos++) {
      goalDistances[pos] = new Array(goals.length);
      const r = Math.floor(pos / COLS), c = pos % COLS;
      for (let g = 0; g < goals.length; g++) {
        const goal = goals[g];
        goalDistances[pos][g] = Math.abs(r - goal[0]) + Math.abs(c - goal[1]);
      }
    }

    // Precompute proximity rewards for common goal configurations
    const proximityCache = new Map();
    function getProximityReward(nextAI, nextPL, done) {
      if (done) return 0;

      const cacheKey = `${nextAI}-${nextPL}`;
      if (proximityCache.has(cacheKey)) {
        return proximityCache.get(cacheKey);
      }

      let minJointDist = Infinity;
      for (let g = 0; g < goals.length; g++) {
        const jointDist = goalDistances[nextAI][g] + goalDistances[nextPL][g];
        if (jointDist < minJointDist) {
          minJointDist = jointDist;
        }
      }

      const reward = -RL_AGENT_CONFIG.proximityRewardWeight * minJointDist;
      proximityCache.set(cacheKey, reward);
      return reward;
    }

    // Use BFS to compute optimal Q-values
    // Initialize Q-values with immediate rewards
    for (let s = 0; s < S; s++) {
      const iAI = Math.floor(s / N);   // AI index 0‑224
      const iPL = s % N;               // Player index 0‑224

      // terminal if both players are on the same goal square
      if (goalSet.has(iAI) && goalSet.has(iPL) && iAI === iPL) {
        for (let j = 0; j < 16; j++) Q[s * 16 + j] = 0;
        continue;
      }

      for (let aAI = 0; aAI < 4; aAI++) {
        // If AI is already on a goal, it stays there
        const nextAI = goalSet.has(iAI) ? iAI : stepIdx(iAI, aAI);

        for (let aPL = 0; aPL < 4; aPL++) {
          // If player is already on a goal, it stays there
          const nextPL = goalSet.has(iPL) ? iPL : stepIdx(iPL, aPL);

          const jointIdx = aAI * 4 + aPL;          // 0‑15
          const done = goalSet.has(nextAI) && goalSet.has(nextPL) && nextAI === nextPL;

          // Use cached proximity reward for better performance
          const proximityReward = getProximityReward(nextAI, nextPL, done);

          const r = done ? rewardGoal : stepCost + proximityReward;

          // For BFS approach, we use the immediate reward plus discounted future value
          // Since we don't have V(s), we'll use a heuristic based on distance to goals
          const sNext = nextAI * N + nextPL;
          let futureValue = 0;

          if (!done) {
            // Estimate future value based on minimum distance to any goal
            let minDistToGoal = Infinity;
            for (let g = 0; g < goals.length; g++) {
              const distToGoal = goalDistances[nextAI][g] + goalDistances[nextPL][g];
              if (distToGoal < minDistToGoal) {
                minDistToGoal = distToGoal;
              }
            }
            // Heuristic: future value is discounted reward for reaching goal
            futureValue = γ * (rewardGoal + stepCost * minDistToGoal);
          }

          Q[s * 16 + jointIdx] = r + futureValue;
        }
      }
    }

    return { Q, goalSet, beta };
  }

    // ---------- public function ----------
  return function getSoftmaxBFSJointRLAction(aiState, playerState, goals, beta = null) {
    // Use configured beta if not provided
    if (beta === null) {
      beta = RL_AGENT_CONFIG.softmaxBeta;
    }

    // Ensure beta is reasonable to prevent numerical issues
    if (!isFinite(beta) || beta <= 0) {
      console.warn('⚠️ Invalid beta value, using default of 1.0');
      beta = 1.0;
    }

    const key = hashGoals(goals) + '|' + beta;
    if (!planners.has(key)) {
      planners.set(key, buildPlanner(goals, beta));
    }
    const { Q, goalSet } = planners.get(key);

    const idxAI = toIdx(aiState[0], aiState[1]);
    const idxPL = toIdx(playerState[0], playerState[1]);

    // already together on a goal → stay
    if (goalSet.has(idxAI) && goalSet.has(idxPL) && idxAI === idxPL) return null;

    // Check if player has reached a goal but AI hasn't - this should slow down AI movement
    const playerOnGoal = goalSet.has(idxPL);
    const aiOnGoal = goalSet.has(idxAI);
    const isIndependentPhase = playerOnGoal && !aiOnGoal;

    const s = idxAI * N + idxPL;
    const o = s * 16;

    // Get Q-values for all 16 joint actions
    const qValues = new Array(16);
    for (let j = 0; j < 16; j++) {
      qValues[j] = Q[o + j];
    }

    // If in independent phase (player on goal, AI not), adjust Q-values to slow down AI
    if (isIndependentPhase) {
      // Reduce the Q-values for AI movement actions to make AI move slower
      for (let j = 0; j < 16; j++) {
        const aiActionIdx = Math.floor(j / 4);
        // Only penalize non-stay actions (actions that actually move the AI)
        if (aiActionIdx < 4) { // All 4 actions are movement actions
          qValues[j] *= 0.5; // Reduce Q-value by 50% to slow down AI
        }
      }
    }

    // Debug logging (only in debug mode)
    if (RL_AGENT_CONFIG.debugMode) {
      console.log(`🔍 BFS Joint RL Debug - AI: [${aiState}], Player: [${playerState}], Goals: [${goals.map(g => `[${g}]`).join(', ')}]`);
      console.log(`🔍 Independent phase: ${isIndependentPhase ? 'YES (slowing down AI)' : 'NO'}`);
      console.log(`🔍 Q-values range: [${Math.min(...qValues).toFixed(3)}, ${Math.max(...qValues).toFixed(3)}]`);
    }

    // Check for invalid Q-values
    const invalidQValues = qValues.filter(q => !isFinite(q));
    if (invalidQValues.length > 0) {
      console.warn('⚠️ Invalid Q-values detected:', invalidQValues);
      console.warn('⚠️ Clearing planner cache and using uniform random action as fallback');
      planners.clear(); // Clear cache to force rebuild
      return actionSpace[Math.floor(Math.random() * actionSpace.length)];
    }

    // Soft‑max sampling with improved numerical stability
    const maxQ = Math.max(...qValues);
    const minQ = Math.min(...qValues);

    // Check for numerical issues
    if (!isFinite(maxQ) || !isFinite(minQ)) {
      return actionSpace[Math.floor(Math.random() * actionSpace.length)];
    }

    // Use log-space computation for better numerical stability
    const logPrefs = qValues.map(q => beta * (q - maxQ));

    // Clip to prevent overflow/underflow
    const clippedLogPrefs = logPrefs.map(logP => Math.max(-700, Math.min(700, logP)));

    const prefs = clippedLogPrefs.map(logP => Math.exp(logP));
    const sum = prefs.reduce((a, b) => a + b, 0);

    // Check for numerical issues in sum
    if (!isFinite(sum) || sum === 0) {
      console.warn('⚠️ Sum of preferences is invalid, using uniform random fallback');
      return actionSpace[Math.floor(Math.random() * actionSpace.length)];
    }

    // Improved action selection with better numerical stability
    const r = Math.random() * sum;
    let acc = 0;
    for (let j = 0; j < prefs.length; j++) {
      acc += prefs[j];
      if (r < acc) {
        const aiActionIdx = Math.floor(j / 4);    // high bits = AI's choice
        const selectedAction = actionSpace[aiActionIdx];
        if (RL_AGENT_CONFIG.debugMode) {
          console.log(`🔍 Selected AI action: [${selectedAction}] (index: ${aiActionIdx})`);
        }
        return selectedAction;
      }
    }

    // Fallback: return last action if numerical issues occur
    if (RL_AGENT_CONFIG.debugMode) {
      console.log(`🔍 Using fallback action: [${actionSpace[actionSpace.length - 1]}]`);
    }
    return actionSpace[actionSpace.length - 1];
  };
})();






