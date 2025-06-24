// gridRLAgent.js

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

class RunVI {
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

function calculateSoftmaxProbability(actionValues, beta) {
    // Compute softmax probabilities
    const exponentials = actionValues.map(val => Math.exp(Math.min(700, beta * val)));
    const sumExp = exponentials.reduce((a, b) => a + b, 0);
    return exponentials.map(val => val / sumExp);
}

function chooseSoftMaxAction(actionDict, softmaxBeta) {
    const actions = Object.keys(actionDict);
    const values = Object.values(actionDict);

    const softmaxProbs = calculateSoftmaxProbability(values, softmaxBeta);

    // Sample from softmax distribution
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < softmaxProbs.length; i++) {
        cumulative += softmaxProbs[i];
        if (rand < cumulative) {
            return actions[i];
        }
    }

    // Fallback in case of numerical instability
    return actions[actions.length - 1];
}

function getRLAction(currentPos, goalStates) {
    const gridSize = 15;
    const noise = 0.0;
    const gamma = 0.9;
    const goalReward = 30;
    const softmaxBeta = 5;

    const actionSpace = [
        [0, -1], // left
        [0, 1],  // right
        [-1, 0], // up
        [1, 0]   // down
    ];

    const noiseActionSpace = [...actionSpace];
    const obstacles = [];

    const runner = new RunVI(gridSize, actionSpace, noiseActionSpace, noise, gamma, goalReward, softmaxBeta);
    const { Q_dict, policy } = runner.call(goalStates, obstacles);

    const probs = policy.call(currentPos);
    // console.table(probs);

    const sampledAction = chooseMaxAction(probs);
    // const sampledAction = chooseSoftMaxAction(probs, softmaxBeta);
    // console.log(`Sampled action: [${sampledAction}]`);

    return sampledAction;
}


// === Test code for browser and Node.js ===

if (typeof window !== 'undefined') {
    // Browser environment
    window.onload = () => {
        const testState = [7, 0];
        const goalStates = [[7, 2], [7, 12]];
        const sampledAction = getRLAction(testState, goalStates);
        // console.log(`Sampled action: [${sampledAction}]`);
    };

} else if (typeof module !== 'undefined' && require.main === module) {
    const testState = [0, 0];
    const goalStates = [[7, 2], [7, 12]];
    const sampledAction = getRLAction(testState, goalStates);
    // console.log(`Sampled action: [${sampledAction}]`);
}


