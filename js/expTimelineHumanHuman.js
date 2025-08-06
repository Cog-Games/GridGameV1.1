/**
 * Human-Human Specific Timeline Management
 * 
 * This file creates a timeline specifically for human-human experiments that includes
 * proper synchronization stages while maintaining UI and flow compatibility with the human-AI version.
 */

/**
 * Create timeline stages for human-human experiments with proper synchronization
 */
function createTimelineStagesHumanHuman() {
    timeline.stages = [];
    timeline.mapData = {};

    // Add welcome info stage (same as human-AI)
    timeline.stages.push({
        type: 'welcome_info',
        handler: showWelcomeInfoStage
    });

    // Add stages for each experiment in order
    for (var expIndex = 0; expIndex < NODEGAME_CONFIG.experimentOrder.length; expIndex++) {
        var experimentType = NODEGAME_CONFIG.experimentOrder[expIndex];
        var numTrials = NODEGAME_CONFIG.numTrials[experimentType];

        // Select maps for this experiment
        var experimentMaps = getMapsForExperiment(experimentType);
        var selectedMaps = selectRandomMaps(experimentMaps, numTrials);
        timeline.mapData[experimentType] = selectedMaps;

        // Generate randomized distance condition sequence for 1P2G experiments
        if (experimentType === '1P2G') {
            ONEP2G_CONFIG.distanceConditionSequence = generateRandomized1P2GDistanceSequence(numTrials);
        }

        // Generate randomized distance condition sequence for 2P3G experiments
        if (experimentType === '2P3G') {
            TWOP3G_CONFIG.distanceConditionSequence = generateRandomizedDistanceSequence(numTrials);
        }

        // 1. Both players read instructions
        timeline.stages.push({
            type: 'instructions',
            experimentType: experimentType,
            experimentIndex: expIndex,
            handler: showInstructionsStageHumanHuman
        });

        // 2. For multiplayer experiments, add synchronization stages
        if (experimentType.includes('2P')) {
            // 2a. Match players stage - both players confirm they're ready
            timeline.stages.push({
                type: 'player_matching',
                experimentType: experimentType,
                experimentIndex: expIndex,
                handler: showPlayerMatchingStage
            });

            // 2b. Game ready stage - both players press spacebar to start
            timeline.stages.push({
                type: 'game_ready',
                experimentType: experimentType,
                experimentIndex: expIndex,
                handler: showGameReadyStageHumanHuman
            });
        }

        // For collaboration games, create stages dynamically based on success threshold
        if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
            // Add a single trial stage that will be repeated dynamically
            addCollaborationExperimentStages(experimentType, expIndex, 0);
        } else {
            // Add trial stages for this experiment (fixed number)
            for (var i = 0; i < numTrials; i++) {
                addTrialStagesHumanHuman(experimentType, expIndex, i);
            }
        }
    }

    // Add game feedback stage (same as human-AI)
    timeline.stages.push({
        type: 'game-feedback',
        handler: showGameFeedbackStage
    });

    // Add post-questionnaire stage (same as human-AI)
    timeline.stages.push({
        type: 'questionnaire',
        handler: showQuestionnaireStage
    });

    // Add end experiment info stage (same as human-AI)
    timeline.stages.push({
        type: 'end-info',
        handler: showEndExperimentInfoStage
    });

    // Add Prolific redirect stage (same as human-AI)
    timeline.stages.push({
        type: 'prolific-redirect',
        handler: showProlificRedirectStage
    });

    console.log(`Human-Human Timeline created with ${timeline.stages.length} total stages`);
    console.log('Human-Human Timeline stages:', timeline.stages.map((stage, index) => `${index}: ${stage.type}`).join(', '));
}

/**
 * Add trial stages for a specific trial (human-human version)
 */
function addTrialStagesHumanHuman(experimentType, experimentIndex, trialIndex) {
    // Fixation screen (same as human-AI)
    timeline.stages.push({
        type: 'fixation',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showFixationStage
    });

    // Main trial (uses human-human specific handler)
    timeline.stages.push({
        type: 'trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: function(stage) {
            // Ensure we use the human-human trial handler
            if (window.TrialHandlersHumanHuman && window.TrialHandlersHumanHuman.runTrialStageHumanHuman) {
                return window.TrialHandlersHumanHuman.runTrialStageHumanHuman(stage);
            } else {
                console.error('TrialHandlersHumanHuman not available');
                return runTrialStage(stage); // Fallback to original handler
            }
        }
    });

    // Post-trial feedback (same as human-AI)
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
}

// ============================================================================
// Human-Human Specific Stage Handlers
// ============================================================================

/**
 * Show instructions stage with synchronization awareness
 */
function showInstructionsStageHumanHuman(stage) {
    console.log('Showing instructions stage for human-human experiment:', stage.experimentType);
    
    // Use the same UI as human-AI version but add synchronization
    showInstructionsStage(stage);
    
    // For multiplayer experiments, notify server that instructions are being shown
    if (stage.experimentType.includes('2P') && window.NetworkingHumanHuman) {
        const socket = window.NetworkingHumanHuman.getSocket();
        if (socket && socket.connected) {
            socket.emit('instructions_started', {
                experimentType: stage.experimentType,
                experimentIndex: stage.experimentIndex,
                playerId: window.NetworkingHumanHuman.getMyPlayerId()
            });
        }
    }
}


/**
 * Show player matching stage - both players confirm they're ready
 */
function showPlayerMatchingStage(stage) {
    console.log('Showing player matching stage for:', stage.experimentType);
    
    // Ensure gameData.currentExperiment is set for networking
    if (typeof gameData !== 'undefined') {
        gameData.currentExperiment = stage.experimentType;
        console.log('🎮 Set current experiment type:', gameData.currentExperiment);
    } else {
        console.warn('⚠️ gameData not available, cannot set currentExperiment');
    }
    
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">🤝 Player Matching</h1>

                <div style="margin: 40px 0;">
                    <div style="width: 80px; height: 80px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <span style="font-size: 36px; color: white;">👥</span>
                    </div>
                </div>

                <div style="font-size: 18px; color: #333; margin-bottom: 20px;">
                    <p><strong>Ready to be matched with your partner?</strong></p>
                    <p style="font-size: 16px; color: #666;">Both players must confirm they're ready to start the game.</p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #155724;">
                        <strong>Press SPACE BAR when you're ready to find a partner</strong>
                    </p>
                </div>

                <div id="matchingStatus" style="font-size: 16px; color: #6c757d; margin-top: 20px;">
                    Waiting for your confirmation...
                </div>
            </div>
        </div>
    `;

    // Add spacebar event listener
    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);

            // Update UI to show waiting
            document.getElementById('matchingStatus').innerHTML = 'Looking for a partner... <div style="display: inline-block; margin-left: 10px;"><div style="width: 20px; height: 20px; border: 2px solid #f3f4f6; border-top: 2px solid #007bff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div></div>';

            // Initialize networking and join room
            console.log('🎮 Player ready to find partner, initializing networking...');
            console.log('🎮 NetworkingHumanHuman available:', !!window.NetworkingHumanHuman);
            
            if (window.NetworkingHumanHuman) {
                console.log('🎮 Initializing socket...');
                
                // Check if socket.io is available
                if (typeof io === 'undefined') {
                    console.error('❌ Socket.io not available');
                    document.getElementById('matchingStatus').innerHTML = 'Socket.io not loaded. Please refresh the page.';
                    return;
                }
                
                window.NetworkingHumanHuman.initializeSocket();
                
                // Wait a bit longer for socket to connect
                setTimeout(() => {
                    console.log('🎮 Attempting to join multiplayer room...');
                    console.log('🎮 Socket connected:', window.NetworkingHumanHuman.getSocket()?.connected);
                    
                    try {
                        const result = window.NetworkingHumanHuman.joinMultiplayerRoom();
                        console.log('🎮 Join room result:', result);
                    } catch (error) {
                        console.error('❌ Error joining room:', error);
                        document.getElementById('matchingStatus').innerHTML = 'Error connecting to server. Please refresh the page.';
                    }
                }, 2000); // Increased delay to 2 seconds
                
                // Add timeout for matching
                setTimeout(() => {
                    console.log('⏰ Matching timeout reached');
                    if (document.getElementById('matchingStatus') && 
                        document.getElementById('matchingStatus').textContent.includes('Looking for a partner')) {
                        console.log('🎮 Still looking for partner, might be connection issue');
                        document.getElementById('matchingStatus').innerHTML = 'Unable to find partner. Please refresh the page and try again.';
                    }
                }, 15000); // 15 second timeout
                
            } else {
                console.error('❌ NetworkingHumanHuman not available');
                document.getElementById('matchingStatus').innerHTML = 'Networking module not available. Please refresh the page.';
            }

            // The networking module will handle advancing to the next stage
            // when both players are matched (room_full event)
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

/**
 * Show game ready stage - both players press spacebar to enter trial
 */
function showGameReadyStageHumanHuman(stage) {
    console.log('Showing game ready stage for human-human experiment:', stage.experimentType);
    
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">🎮 Game Ready!</h1>

                <div style="margin: 40px 0;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🎯</div>
                </div>

                <div style="font-size: 18px; color: #333; margin-bottom: 20px;">
                    <p><strong>Both players are connected and ready!</strong></p>
                    <p>The ${stage.experimentType} game is about to begin.</p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #155724;">
                        <strong>Both players must press SPACE BAR to start the game</strong>
                    </p>
                </div>

                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        <strong>Reminder:</strong> Use arrow keys to move. Work together to reach the same goal!
                    </p>
                </div>

                <div id="gameReadyStatus" style="font-size: 16px; color: #6c757d; margin-top: 20px;">
                    Waiting for both players to confirm...
                </div>
            </div>
        </div>
    `;

    // Track if this player is ready
    let thisPlayerReady = false;
    
    // Add spacebar event listener
    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            
            if (!thisPlayerReady) {
                thisPlayerReady = true;
                document.getElementById('gameReadyStatus').textContent = 'You are ready! Waiting for your partner...';
                
                // Notify server that this player is ready to start
                const socket = window.NetworkingHumanHuman.getSocket();
                if (socket && socket.connected) {
                    console.log('🎮 Sending player_game_ready event to server');
                    console.log('🎮 Room ID:', window.NetworkingHumanHuman.getRoomId());
                    console.log('🎮 Player ID:', window.NetworkingHumanHuman.getMyPlayerId());
                    
                    socket.emit('player_game_ready', {
                        roomId: window.NetworkingHumanHuman.getRoomId(),
                        playerId: window.NetworkingHumanHuman.getMyPlayerId()
                    });
                } else {
                    console.error('❌ Socket not connected when trying to send player_game_ready');
                }
            }
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();

    // Listen for when both players are ready to start the game
    const socket = window.NetworkingHumanHuman.getSocket();
    if (socket) {
        console.log('🎮 Setting up both_players_game_ready listener');
        
        socket.on('both_players_game_ready', (data) => {
            console.log('✅ Received both_players_game_ready event:', data);
            document.getElementById('gameReadyStatus').textContent = 'Both players ready! Starting game...';
            
            // Clean up event listeners
            document.removeEventListener('keydown', handleSpacebar);
            socket.off('both_players_game_ready');
            
            // Auto-advance to trial stage
            setTimeout(() => {
                console.log('🎮 Advancing to next stage (trial)');
                console.log('🎮 Current timeline stage:', timeline.currentStage);
                console.log('🎮 Total stages:', timeline.stages.length);
                
                // Use the global nextStage function
                if (typeof window.nextStage === 'function') {
                    console.log('🎮 Using window.nextStage');
                    window.nextStage();
                } else if (typeof nextStage === 'function') {
                    console.log('🎮 Using local nextStage');
                    nextStage();
                } else {
                    console.error('❌ No nextStage function available');
                    // Manual stage progression as fallback
                    if (typeof timeline !== 'undefined' && timeline.stages) {
                        timeline.currentStage++;
                        if (timeline.currentStage < timeline.stages.length) {
                            const stage = timeline.stages[timeline.currentStage];
                            console.log('🎮 Manually advancing to stage:', stage.type);
                            stage.handler(stage);
                        }
                    }
                }
            }, 1000);
        });
        
        console.log('✅ both_players_game_ready listener set up');
        
        // Add a timeout as backup in case server doesn't respond
        setTimeout(() => {
            console.log('⏰ Timeout reached, checking if still at game ready stage');
            if (document.getElementById('gameReadyStatus') && 
                document.getElementById('gameReadyStatus').textContent.includes('Waiting for your partner')) {
                console.log('🎮 Still waiting, advancing to trial anyway');
                document.removeEventListener('keydown', handleSpacebar);
                socket.off('both_players_game_ready');
                
                // Manual stage progression
                setTimeout(() => {
                    console.log('🎮 Timeout fallback: Advancing to next stage');
                    if (typeof window.nextStage === 'function') {
                        window.nextStage();
                    } else if (typeof timeline !== 'undefined' && timeline.stages) {
                        timeline.currentStage++;
                        if (timeline.currentStage < timeline.stages.length) {
                            const stage = timeline.stages[timeline.currentStage];
                            console.log('🎮 Timeout fallback: Manually advancing to stage:', stage.type);
                            stage.handler(stage);
                        }
                    }
                }, 500);
            }
        }, 10000); // 10 second timeout
        
    } else {
        console.error('❌ No socket available for both_players_game_ready listener');
        
        // If no socket, advance anyway after a delay
        setTimeout(() => {
            console.log('🎮 No socket available, advancing to trial stage anyway');
            if (typeof window.nextStage === 'function') {
                window.nextStage();
            } else if (typeof timeline !== 'undefined' && timeline.stages) {
                timeline.currentStage++;
                if (timeline.currentStage < timeline.stages.length) {
                    const stage = timeline.stages[timeline.currentStage];
                    console.log('🎮 No socket fallback: Manually advancing to stage:', stage.type);
                    stage.handler(stage);
                }
            }
        }, 3000);
    }
}

// Make functions globally available
window.createTimelineStagesHumanHuman = createTimelineStagesHumanHuman;
window.addTrialStagesHumanHuman = addTrialStagesHumanHuman;
window.showInstructionsStageHumanHuman = showInstructionsStageHumanHuman;
window.showPlayerMatchingStage = showPlayerMatchingStage;
window.showGameReadyStageHumanHuman = showGameReadyStageHumanHuman;

console.log('Human-Human Timeline module loaded');