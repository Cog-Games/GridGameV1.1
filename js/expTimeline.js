/**
 * Create timeline stages for all experiments
 */
function createTimelineStages() {
    timeline.stages = [];
    timeline.mapData = {};

    // Add consent stage (only once at the beginning)
    // timeline.stages.push({
    //     type: 'consent',
    //     handler: showConsentStage
    // });

    // Kids-style startup: collect ID/DOB, then enter fullscreen, then Game 1 instructions.
    timeline.stages.push({
        type: 'participant_info',
        handler: showParticipantInfoStage
    });

    timeline.stages.push({
        type: 'fullscreen_prompt',
        handler: showFullscreenPromptStage
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
            ONEP2G_CONFIG.distanceConditionSequence = generateRandomizedDistanceSequence(numTrials, ONEP2G_CONFIG);
        }

        // Generate randomized distance condition sequence for 2P3G experiments
        if (experimentType === '2P3G') {
            TWOP3G_CONFIG.distanceConditionSequence = generateRandomizedDistanceSequence(numTrials, TWOP3G_CONFIG);
        }

        // Add welcome screen for this experiment (uncomment if needed)
        // timeline.stages.push({
        //     type: 'welcome',
        //     experimentType: experimentType,
        //     experimentIndex: expIndex,
        //     handler: showWelcomeStage
        // });

        // Add instructions stage for this experiment (uncomment if needed)
        timeline.stages.push({
            type: 'instructions',
            experimentType: experimentType,
            experimentIndex: expIndex,
            handler: showInstructionsStage
        });

        // Add waiting for partner stage only for 2P experiments (when starting 2P2G)
        if (experimentType.includes('2P2G')) {
            timeline.stages.push({
                type: 'waiting_for_partner',
                experimentType: experimentType,
                experimentIndex: expIndex,
                handler: showWaitingForPartnerStage
            });
        }

        // For collaboration games, create stages dynamically based on success threshold
        if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
            // Add a single trial stage that will be repeated dynamically
            addCollaborationExperimentStages(experimentType, expIndex, 0);
        } else {
            // Add trial stages for this experiment (fixed number)
            for (var i = 0; i < numTrials; i++) {
                addTrialStages(experimentType, expIndex, i);
            }
        }
    }
    // Add game feedback stage (only once at the end, before questionnaire)
    timeline.stages.push({
        type: 'game-feedback',
        handler: showGameFeedbackStage
    });

    // Add post-questionnaire stage (only once at the end, before completion)
    timeline.stages.push({
        type: 'questionnaire',
        handler: showQuestionnaireStage
    });

    // Add end experiment info stage
    timeline.stages.push({
        type: 'end-info',
        handler: showEndExperimentInfoStage
    });

    if (NODEGAME_CONFIG.enableProlificRedirect) {
        // Add Prolific redirect stage
        timeline.stages.push({
            type: 'prolific-redirect',
            handler: showProlificRedirectStage
        });
    } else {
        timeline.stages.push({
            type: 'local-complete',
            handler: showLocalCompletionStage
        });
    }

    // Add completion stage (only once at the end)
    // timeline.stages.push({
    //     type: 'complete',
    //     handler: showCompletionStage
    // });

    // console.log(`Timeline created with ${timeline.stages.length} total stages`);
    // console.log('Timeline stages:', timeline.stages.map((stage, index) => `${index}: ${stage.type}`).join(', '));

}

/**
 * Add trial stages for a specific trial
 * @param {string} experimentType - Type of experiment
 * @param {number} experimentIndex - Index of experiment
 * @param {number} trialIndex - Index of trial
 */
function addTrialStages(experimentType, experimentIndex, trialIndex) {
    // Fixation screen (500ms, matching jsPsych) - first thing shown for each trial
    timeline.stages.push({
        type: 'fixation',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showFixationStage
    });

    // Main trial
    timeline.stages.push({
        type: 'trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: runTrialStage
    });

    // Post-trial feedback
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
}

// Timeline Stage Handlers

/**
 * Show consent stage
 */
function showConsentStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 800px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px;">
                <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Informed Consent for Research Participation</h1>

                <div style="max-height: 400px; overflow-y: auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 30px; background: #fafafa;">
                    <h3>Key Information</h3>
                    <p>This consent form asks you to take part in a research study. This study is conducted by researchers at Duke University and UCLA.</p>

                    <h4>Purpose</h4>
                    <p>The purpose of this study is to investigate how people make decisions.</p>

                    <h4>What you will be asked to do</h4>
                    <p>You will be playing a series of navigation games on a 2D grid map. Afterward, you will complete some questionnaires regarding your game experience. The study will take approximately 10 minutes to complete.</p>

                    <h4>Benefits and Risks</h4>
                    <p>There are no foreseen risks or benefits for participating in this study. Should any of the content cause you distress at any point throughout the study, you may stop at any time.</p>

                    <h4>Confidentiality</h4>
                    <p>We do not ask for your name or any other information that might identify you. Although collected data may be made public or used for future research purposes, your identity will always remain confidential.</p>

                    <h4>Voluntary nature of participation</h4>
                    <p>Your participation in this research study is voluntary. You may withdraw at any time and you may choose not to answer any question, but you must proceed to the final screen of the study in order to receive your completion code, which you must submit in order to be paid.</p>

                    <h4>Compensation</h4>
                    <p>You will receive $2 for your participation in this study, and an additional bonus (up to $1) if you finish the task beyond a certain threshold.</p>

                    <h4>Contact Information</h4>
                    <p>For questions about the study or for research-related complaints, concerns or suggestions about the research, contact Dr. Tamar Kushnir at (919) 660-5640 during regular business hours. For questions about your rights as a participant contact the Duke Campus Institutional Review Board at campusirb@duke.edu. Please reference Protocol ID# 2024-0427 in your email.</p>

                    <h4>Agreement</h4>
                    <p>By clicking the button below, you acknowledge that your participation in the study is voluntary, you are 18 years of age or older, and that you are aware that you may choose to terminate your participation in the study at any time and for any reason.</p>
                </div>

                <div style="text-align: center;">
                    <label style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 16px;">
                        <input type="checkbox" id="consentCheckbox" style="margin-right: 10px; transform: scale(1.2);">
                        I have read and understood the above information, and I consent to participate in this study.
                    </label>

                    <button id="continueBtn" disabled style="background: #28a745; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 5px; cursor: not-allowed; margin-right: 10px;">
                        Continue to Experiment
                    </button>

                    <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 12px 30px; font-size: 16px; border-radius: 5px; cursor: pointer;">
                        Decline and Exit
                    </button>
                </div>
            </div>
        </div>
    `;

    // Handle consent checkbox
    const checkbox = document.getElementById('consentCheckbox');
    const continueBtn = document.getElementById('continueBtn');

    checkbox.addEventListener('change', function () {
        if (this.checked) {
            continueBtn.disabled = false;
            continueBtn.style.cursor = 'pointer';
            continueBtn.style.background = '#28a745';
        } else {
            continueBtn.disabled = true;
            continueBtn.style.cursor = 'not-allowed';
            continueBtn.style.background = '#ccc';
        }
    });

    continueBtn.addEventListener('click', function () {
        if (!this.disabled) {
            nextStage();
        }
    });
}

function getStartupUrlParamValue(keys) {
    var keyList = Array.isArray(keys) ? keys : [keys];

    function readFromParams(source) {
        try {
            var params = new URLSearchParams(source || '');
            for (var i = 0; i < keyList.length; i++) {
                var value = params.get(keyList[i]);
                if (value && String(value).trim()) {
                    return String(value).trim();
                }
            }
        } catch (e) {
            // Ignore malformed URL parameters.
        }
        return null;
    }

    var searchValue = readFromParams(window.location.search || '');
    if (searchValue) {
        return searchValue;
    }

    try {
        var hash = String(window.location.hash || '');
        var queryStart = hash.indexOf('?');
        if (queryStart >= 0) {
            return readFromParams(hash.slice(queryStart + 1));
        }
    } catch (e) {
        // Ignore malformed hash parameters.
    }

    return null;
}

function getStartupParticipantIdFromUrl() {
    return getStartupUrlParamValue(['child', 'childId', 'participantId', 'PROLIFIC_PID', 'prolific_pid']);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function parseParticipantDob(dob) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || '').trim());
    if (!match) {
        return null;
    }

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    var date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return { year: year, month: month, day: day, date: date };
}

function calculateParticipantAgeFromDob(dob, referenceDate) {
    var parsed = parseParticipantDob(dob);
    if (!parsed) {
        return null;
    }

    var refSource = referenceDate || new Date();
    var ref = new Date(refSource.getFullYear(), refSource.getMonth(), refSource.getDate());
    var birth = parsed.date;
    if (birth > ref) {
        return null;
    }

    var years = ref.getFullYear() - birth.getFullYear();
    var months = ref.getMonth() - birth.getMonth();
    var days = ref.getDate() - birth.getDate();

    if (days < 0) {
        months -= 1;
        days += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    var birthUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
    var refUtc = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());

    return {
        participantDob: String(parsed.year).padStart(4, '0') + '-' + String(parsed.month).padStart(2, '0') + '-' + String(parsed.day).padStart(2, '0'),
        participantAgeReferenceDate: ref.getFullYear() + '-' + String(ref.getMonth() + 1).padStart(2, '0') + '-' + String(ref.getDate()).padStart(2, '0'),
        participantAgeYears: years,
        participantAgeMonths: months,
        participantAgeDays: days,
        participantAgeTotalDays: Math.floor((refUtc - birthUtc) / 86400000)
    };
}

function applyStartupParticipantInfo(participantId, ageInfo) {
    if (!participantId || !ageInfo) {
        return;
    }

    gameData.participantId = participantId;
    gameData.participantDob = ageInfo.participantDob;
    gameData.participantAgeReferenceDate = ageInfo.participantAgeReferenceDate;
    gameData.participantAgeYears = ageInfo.participantAgeYears;
    gameData.participantAgeMonths = ageInfo.participantAgeMonths;
    gameData.participantAgeDays = ageInfo.participantAgeDays;
    gameData.participantAgeTotalDays = ageInfo.participantAgeTotalDays;

    if (window.DataRecording) {
        if (typeof window.DataRecording.setParticipantId === 'function') {
            window.DataRecording.setParticipantId(participantId);
        }
        if (typeof window.DataRecording.setParticipantDob === 'function') {
            window.DataRecording.setParticipantDob(ageInfo.participantDob);
        }
        if (typeof window.DataRecording.setParticipantAgeInfo === 'function') {
            window.DataRecording.setParticipantAgeInfo(ageInfo);
        }
    }
}

function getStartupAIConditionOverride() {
    var rawValue = getStartupUrlParamValue(['aiCondition', 'condition', 'ai_condition']);
    if (!rawValue || !window.NodeGameConfig || typeof window.NodeGameConfig.getAIConditionConfig !== 'function') {
        return null;
    }

    var normalized = String(rawValue).trim().toLowerCase();
    var aliases = {
        individual: 'individual-rl',
        individual_rl: 'individual-rl',
        individualrl: 'individual-rl',
        joint: 'joint-rl',
        joint_rl: 'joint-rl',
        jointrl: 'joint-rl',
        shared: 'sa-model',
        shared_agency: 'sa-model',
        sharedagency: 'sa-model',
        sa: 'sa-model',
        sa_model: 'sa-model',
        samodel: 'sa-model'
    };
    var conditionId = aliases[normalized] || normalized;
    return window.NodeGameConfig.getAIConditionConfig(conditionId) ? conditionId : null;
}

var startupAIConditionQuotaCsvCache = null;

function parseStartupCsvLine(line) {
    var cells = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < line.length; i++) {
        var char = line[i];
        var nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i += 1;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    cells.push(current);
    return cells.map(function(value) {
        return String(value || '').trim();
    });
}

function parseStartupAIConditionQuotaCsv(csvText) {
    var lines = String(csvText || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter(function(line) {
            return line.trim().length > 0;
        });

    if (lines.length < 2) {
        throw new Error('client_quota_csv_empty');
    }

    var headers = parseStartupCsvLine(lines[0]);
    var normalizedHeaders = headers.map(function(header) {
        return header.trim().toLowerCase();
    });
    var ageGroupIndex = normalizedHeaders.indexOf('agegroup');
    var conditionIndex = normalizedHeaders.indexOf('condition');
    var neededNIndex = normalizedHeaders.indexOf('neededn');

    if (ageGroupIndex < 0 || conditionIndex < 0 || neededNIndex < 0) {
        throw new Error('client_quota_csv_missing_required_columns');
    }

    return lines.slice(1).map(function(line, rowIndex) {
        var cells = parseStartupCsvLine(line);
        var rawAgeGroup = String(cells[ageGroupIndex] || '').trim();
        var condition = String(cells[conditionIndex] || '').trim();
        var rawNeededN = String(cells[neededNIndex] || '').trim();

        if (!rawAgeGroup && !condition) {
            return null;
        }

        var ageGroup = Math.floor(Number(rawAgeGroup));
        var neededN = rawNeededN === '' ? 0 : Math.floor(Number(rawNeededN));

        if (!Number.isFinite(ageGroup)) {
            throw new Error('client_quota_csv_invalid_age_group_row_' + (rowIndex + 2));
        }
        if (!window.NodeGameConfig || !window.NodeGameConfig.getAIConditionConfig(condition)) {
            throw new Error('client_quota_csv_unknown_condition_row_' + (rowIndex + 2));
        }
        if (!Number.isFinite(neededN) || neededN < 0) {
            throw new Error('client_quota_csv_invalid_needed_n_row_' + (rowIndex + 2));
        }

        return {
            ageGroup: ageGroup,
            condition: condition,
            neededN: neededN,
            availableN: neededN
        };
    }).filter(function(row) {
        return row !== null;
    });
}

async function loadStartupAIConditionQuotaRows(clientQuotaCsvConfig) {
    if (!clientQuotaCsvConfig || clientQuotaCsvConfig.enabled !== true || !clientQuotaCsvConfig.url) {
        return null;
    }

    var cacheTtlMs = Number(clientQuotaCsvConfig.cacheTtlMs);
    if (!Number.isFinite(cacheTtlMs)) {
        cacheTtlMs = 60000;
    }

    var now = Date.now();
    if (
        startupAIConditionQuotaCsvCache &&
        startupAIConditionQuotaCsvCache.url === clientQuotaCsvConfig.url &&
        startupAIConditionQuotaCsvCache.expiresAt > now
    ) {
        return startupAIConditionQuotaCsvCache.rows;
    }

    var response = await fetch(clientQuotaCsvConfig.url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('client_quota_csv_http_' + response.status);
    }

    var csvText = await response.text();
    var rows = parseStartupAIConditionQuotaCsv(csvText);
    startupAIConditionQuotaCsvCache = {
        url: clientQuotaCsvConfig.url,
        expiresAt: now + Math.max(0, cacheTtlMs),
        rows: rows
    };
    return rows;
}

function chooseStartupWeightedRow(rows) {
    if (!rows || !rows.length) {
        return null;
    }

    var total = rows.reduce(function(sum, row) {
        return sum + Math.max(0, Number(row.availableN || row.neededN || 0));
    }, 0);

    if (total <= 0) {
        return rows[Math.floor(Math.random() * rows.length)];
    }

    var draw = Math.random() * total;
    for (var i = 0; i < rows.length; i++) {
        draw -= Math.max(0, Number(rows[i].availableN || rows[i].neededN || 0));
        if (draw <= 0) {
            return rows[i];
        }
    }

    return rows[rows.length - 1];
}

function getConfiguredMissingAgeGroupCondition(assignmentConfig) {
    var conditionId = (assignmentConfig && assignmentConfig.missingAgeGroupCondition) || 'sa-model';
    if (window.NodeGameConfig && typeof window.NodeGameConfig.getAIConditionConfig === 'function') {
        return window.NodeGameConfig.getAIConditionConfig(conditionId) || window.NodeGameConfig.getAIConditionConfig('sa-model');
    }
    return null;
}

function isAgeOutsideConfiguredQuotaRows(ageInfo, quotaRows) {
    var ageGroup = Math.floor(Number(ageInfo && ageInfo.participantAgeYears));
    if (!Number.isFinite(ageGroup)) {
        return false;
    }

    if (!quotaRows || !quotaRows.length) {
        return ageGroup < 5 || ageGroup > 7;
    }

    return !quotaRows.some(function(row) {
        return Number(row.ageGroup) === Number(ageGroup);
    });
}

function buildClientQuotaAssignmentFromRows(participantId, ageInfo, quotaRows, sourceUrl, assignmentConfig) {
    var conditions = window.NodeGameConfig && typeof window.NodeGameConfig.getAllAIConditions === 'function'
        ? window.NodeGameConfig.getAllAIConditions()
        : [];
    var ageGroup = Math.floor(Number(ageInfo.participantAgeYears));
    var rowsForAge = (quotaRows || []).filter(function(row) {
        return Number(row.ageGroup) === Number(ageGroup);
    });
    var availableRows = rowsForAge.filter(function(row) {
        return Number(row.neededN) > 0;
    });
    var overflowAssignment = false;
    var overflowReason = null;
    var candidateRows = availableRows;

    if (!candidateRows.length && rowsForAge.length) {
        candidateRows = rowsForAge;
        overflowAssignment = true;
        overflowReason = 'all_needed_n_zero_for_age_group';
    }

    if (!candidateRows.length) {
        var missingAgeGroupCondition = getConfiguredMissingAgeGroupCondition(assignmentConfig);
        candidateRows = missingAgeGroupCondition ? [{
            ageGroup: ageGroup,
            condition: missingAgeGroupCondition.id,
            neededN: 0,
            availableN: 0,
            missingAgeGroup: true
        }] : conditions.map(function(condition) {
            return {
                ageGroup: ageGroup,
                condition: condition.id,
                neededN: 0,
                availableN: 0,
                missingAgeGroup: true
            };
        });
        overflowAssignment = true;
        overflowReason = 'age_group_missing_from_quota';
    }

    var selectedRow = chooseStartupWeightedRow(candidateRows);
    if (!selectedRow) {
        return null;
    }

    var selectedCondition = window.NodeGameConfig.getAIConditionConfig(selectedRow.condition);
    if (!selectedCondition) {
        return null;
    }

    return {
        assignmentId: 'client_quota_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        participantId: participantId,
        dob: ageInfo.participantDob,
        ageGroup: ageGroup,
        condition: selectedCondition.id,
        conditionLabel: selectedCondition.label,
        rlAgentType: selectedCondition.rlAgentType,
        analysisCode: selectedCondition.analysisCode,
        status: 'reserved',
        assignmentStrategy: overflowReason === 'age_group_missing_from_quota'
            ? 'client-weighted-needed+missing-age-sa-model'
            : (overflowAssignment ? 'client-weighted-needed+overflow-uniform' : 'client-weighted-needed'),
        assignmentSource: 'google-sheet-csv-client',
        quotaVersion: 'google-sheet-client',
        quotaSnapshot: rowsForAge.length ? rowsForAge : candidateRows,
        remoteQuotaCsvUrl: sourceUrl || null,
        remainingBeforeAssignment: selectedRow.neededN || 0,
        overflowAssignment: overflowAssignment,
        overflowReason: overflowReason,
        eventId: null,
        stationId: null
    };
}

async function buildClientQuotaFallbackAIConditionAssignment(participantId, ageInfo, assignmentConfig, reason) {
    try {
        var clientQuotaCsvConfig = assignmentConfig && assignmentConfig.clientQuotaCsv;
        var quotaRows = await loadStartupAIConditionQuotaRows(clientQuotaCsvConfig);
        var quotaAssignment = buildClientQuotaAssignmentFromRows(
            participantId,
            ageInfo,
            quotaRows,
            clientQuotaCsvConfig && clientQuotaCsvConfig.url,
            assignmentConfig
        );
        if (quotaAssignment) {
            quotaAssignment.fallbackReason = reason || 'assignment_api_unavailable';
            return quotaAssignment;
        }
    } catch (error) {
        console.warn('Client quota CSV fallback failed:', error);
    }

    return buildClientFallbackAIConditionAssignment(participantId, ageInfo, reason);
}

function buildClientFallbackAIConditionAssignment(participantId, ageInfo, reason) {
    var conditions = window.NodeGameConfig && typeof window.NodeGameConfig.getAllAIConditions === 'function'
        ? window.NodeGameConfig.getAllAIConditions()
        : [];
    if (!conditions.length) {
        return null;
    }

    var quotaRows = null;
    try {
        quotaRows = startupAIConditionQuotaCsvCache && startupAIConditionQuotaCsvCache.rows;
    } catch (error) {
        quotaRows = null;
    }
    var assignmentConfig = window.NodeGameConfig && typeof window.NodeGameConfig.getAIConditionAssignmentConfig === 'function'
        ? window.NodeGameConfig.getAIConditionAssignmentConfig()
        : null;
    var selectedCondition = isAgeOutsideConfiguredQuotaRows(ageInfo, quotaRows)
        ? getConfiguredMissingAgeGroupCondition(assignmentConfig)
        : null;

    if (!selectedCondition) {
        selectedCondition = conditions[Math.floor(Math.random() * conditions.length)];
    }

    var missingAgeGroupAssignment = selectedCondition && selectedCondition.id === ((assignmentConfig && assignmentConfig.missingAgeGroupCondition) || 'sa-model') && isAgeOutsideConfiguredQuotaRows(ageInfo, quotaRows);
    return {
        assignmentId: 'client_fallback_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
        participantId: participantId,
        dob: ageInfo.participantDob,
        ageGroup: ageInfo.participantAgeYears,
        condition: selectedCondition.id,
        conditionLabel: selectedCondition.label,
        rlAgentType: selectedCondition.rlAgentType,
        analysisCode: selectedCondition.analysisCode,
        status: 'reserved',
        assignmentStrategy: missingAgeGroupAssignment ? 'client-missing-age-sa-model' : 'client-uniform',
        assignmentSource: 'client-fallback',
        fallbackReason: reason || 'assignment_api_unavailable',
        quotaVersion: 'client-fallback',
        quotaSnapshot: null,
        eventId: null,
        stationId: null
    };
}

function applyAIConditionAssignment(assignment) {
    if (!assignment || !assignment.condition || !window.NodeGameConfig || typeof window.NodeGameConfig.setAssignedAICondition !== 'function') {
        return false;
    }

    return window.NodeGameConfig.setAssignedAICondition(assignment.condition, assignment);
}

function shouldUseClientQuotaAssignmentDirectly(assignmentConfig) {
    var clientQuotaCsvConfig = assignmentConfig && assignmentConfig.clientQuotaCsv;
    var hostname = window.location && window.location.hostname ? window.location.hostname : '';
    return !!(
        clientQuotaCsvConfig &&
        clientQuotaCsvConfig.enabled === true &&
        clientQuotaCsvConfig.url &&
        hostname.indexOf('github.io') >= 0
    );
}

async function assignAIConditionForParticipant(participantId, ageInfo) {
    var assignmentConfig = window.NodeGameConfig && typeof window.NodeGameConfig.getAIConditionAssignmentConfig === 'function'
        ? window.NodeGameConfig.getAIConditionAssignmentConfig()
        : null;

    var overrideCondition = getStartupAIConditionOverride();
    if (overrideCondition) {
        var condition = window.NodeGameConfig.getAIConditionConfig(overrideCondition);
        var overrideAssignment = {
            assignmentId: 'url_override_' + Date.now().toString(36),
            participantId: participantId,
            dob: ageInfo.participantDob,
            ageGroup: ageInfo.participantAgeYears,
            condition: condition.id,
            conditionLabel: condition.label,
            rlAgentType: condition.rlAgentType,
            analysisCode: condition.analysisCode,
            status: 'reserved',
            assignmentStrategy: 'url-override',
            assignmentSource: 'url-override',
            quotaVersion: 'url-override'
        };
        applyAIConditionAssignment(overrideAssignment);
        return overrideAssignment;
    }

    if (!assignmentConfig || assignmentConfig.enabled === false) {
        return null;
    }

    if (shouldUseClientQuotaAssignmentDirectly(assignmentConfig)) {
        var staticAssignment = await buildClientQuotaFallbackAIConditionAssignment(
            participantId,
            ageInfo,
            assignmentConfig,
            'static_github_pages'
        );
        if (staticAssignment && applyAIConditionAssignment(staticAssignment)) {
            return staticAssignment;
        }
        throw new Error('client_quota_assignment_failed');
    }

    try {
        var response = await fetch(assignmentConfig.assignmentEndpoint || '/api/assign-ai-condition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                participantId: participantId,
                dob: ageInfo.participantDob,
                ageYears: ageInfo.participantAgeYears,
                eventId: assignmentConfig.eventId || null,
                stationId: assignmentConfig.stationId || null
            })
        });

        var payload = null;
        var contentType = response.headers && response.headers.get ? response.headers.get('content-type') : '';
        if (contentType && contentType.indexOf('application/json') >= 0) {
            payload = await response.json();
        } else if (!response.ok) {
            var nonJsonError = new Error('assignment_api_non_json_response');
            nonJsonError.httpStatus = response.status;
            nonJsonError.serverResponse = {
                contentType: contentType || '',
                status: response.status
            };
            throw nonJsonError;
        } else {
            payload = await response.json();
        }

        if (!response.ok || !payload || payload.ok !== true || !payload.assignment) {
            var apiError = new Error(payload && payload.error ? payload.error : 'assignment_request_failed');
            apiError.httpStatus = response.status;
            apiError.serverResponse = payload;
            throw apiError;
        }

        applyAIConditionAssignment(payload.assignment);
        return payload.assignment;
    } catch (error) {
        var serverRejectedRequest = error && error.serverResponse && error.httpStatus && error.httpStatus < 500;
        if (assignmentConfig.localFallbackEnabled && !serverRejectedRequest) {
            console.warn('AI condition assignment API unavailable; using client fallback:', error);
            var fallbackAssignment = await buildClientQuotaFallbackAIConditionAssignment(participantId, ageInfo, assignmentConfig, error.message || String(error));
            if (fallbackAssignment && applyAIConditionAssignment(fallbackAssignment)) {
                return fallbackAssignment;
            }
        }

        throw error;
    }
}

function getAIConditionExportFields() {
    var assignment = null;
    if (window.NodeGameConfig && typeof window.NodeGameConfig.getAssignedAIConditionMetadata === 'function') {
        assignment = window.NodeGameConfig.getAssignedAIConditionMetadata();
    }
    assignment = assignment || gameData.aiConditionAssignment || null;

    return {
        assignedAICondition: (assignment && assignment.condition) || gameData.assignedAICondition || '',
        assignedAIConditionLabel: (assignment && assignment.conditionLabel) || gameData.assignedAIConditionLabel || '',
        assignedAIRLAgentType: (assignment && assignment.rlAgentType) || gameData.assignedAIRLAgentType || '',
        assignedAIAnalysisCode: (assignment && assignment.analysisCode) || gameData.assignedAIAnalysisCode || '',
        aiConditionAssignmentId: (assignment && assignment.assignmentId) || '',
        aiConditionAssignmentStatus: (assignment && assignment.status) || '',
        aiConditionAssignmentSource: (assignment && assignment.assignmentSource) || '',
        aiConditionAssignmentStrategy: (assignment && assignment.assignmentStrategy) || '',
        aiConditionQuotaVersion: (assignment && assignment.quotaVersion) || '',
        aiConditionAgeGroup: assignment && assignment.ageGroup != null ? assignment.ageGroup : '',
        aiConditionAssignmentJson: assignment ? JSON.stringify(assignment) : ''
    };
}

async function completeAssignedAIConditionAssignment() {
    var assignmentConfig = window.NodeGameConfig && typeof window.NodeGameConfig.getAIConditionAssignmentConfig === 'function'
        ? window.NodeGameConfig.getAIConditionAssignmentConfig()
        : null;
    var assignment = window.NodeGameConfig && typeof window.NodeGameConfig.getAssignedAIConditionMetadata === 'function'
        ? window.NodeGameConfig.getAssignedAIConditionMetadata()
        : null;

    if (!assignmentConfig || !assignmentConfig.completionEndpoint || !assignment || assignment.status === 'completed') {
        return assignment || null;
    }

    if (
        assignment.assignmentSource === 'client-fallback' ||
        assignment.assignmentSource === 'google-sheet-csv-client' ||
        assignment.assignmentSource === 'url-override'
    ) {
        var localCompleted = Object.assign({}, assignment, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        applyAIConditionAssignment(localCompleted);
        return localCompleted;
    }

    try {
        var response = await fetch(assignmentConfig.completionEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                assignmentId: assignment.assignmentId,
                participantId: assignment.participantId || gameData.participantId || ''
            })
        });
        var payload = await response.json();
        if (!response.ok || !payload || payload.ok !== true) {
            throw new Error(payload && payload.error ? payload.error : 'assignment_completion_failed');
        }

        var completedAssignment = Object.assign({}, assignment, {
            status: payload.status || 'completed',
            completedAt: new Date().toISOString()
        });
        applyAIConditionAssignment(completedAssignment);
        return completedAssignment;
    } catch (error) {
        console.warn('Unable to mark AI condition assignment completed:', error);
        return assignment;
    }
}

/**
 * Show ID and DOB entry stage.
 */
function showParticipantInfoStage(stage) {
    var container = document.getElementById('container');
    var initialParticipantId = getStartupParticipantIdFromUrl() || '';
    var escapedParticipantId = escapeHtml(initialParticipantId);

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8f9fa;padding:20px;font-family:Arial, sans-serif;">
            <div data-stage-focus="true" tabindex="-1" style="background:white;padding:36px;border-radius:10px;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:640px;width:100%;text-align:center;">
                <h2 style="color:#333;margin:0 0 12px;font-size:30px;">Before we begin</h2>
                <p style="font-size:18px;color:#333;line-height:1.5;margin:0 0 24px;">Please enter the participant ID and date of birth.</p>

                <form id="participantInfoForm" style="display:flex;flex-direction:column;gap:18px;align-items:stretch;">
                    <label style="font-weight:bold;color:#333;text-align:left;">
                        Participant ID
                        <input id="participantIdInput" required type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" placeholder="C001" value="${escapedParticipantId}" style="width:100%;box-sizing:border-box;margin-top:6px;padding:12px;border:1px solid #bbb;border-radius:6px;font-size:16px;">
                    </label>

                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;text-align:left;">
                        <label style="font-weight:bold;color:#333;">
                            Month
                            <select id="dobMonth" required style="width:100%;margin-top:6px;padding:12px;border:1px solid #bbb;border-radius:6px;font-size:16px;background:white;">
                                <option value="">Month</option>
                                ${Array.from({ length: 12 }, function(_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '</option>'; }).join('')}
                            </select>
                        </label>
                        <label style="font-weight:bold;color:#333;">
                            Day
                            <select id="dobDay" required style="width:100%;margin-top:6px;padding:12px;border:1px solid #bbb;border-radius:6px;font-size:16px;background:white;">
                                <option value="">Day</option>
                                ${Array.from({ length: 31 }, function(_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '</option>'; }).join('')}
                            </select>
                        </label>
                        <label style="font-weight:bold;color:#333;">
                            Year
                            <select id="dobYear" required style="width:100%;box-sizing:border-box;margin-top:6px;padding:12px;border:1px solid #bbb;border-radius:6px;font-size:16px;background:white;">
                                <option value="">Year</option>
                                ${Array.from({ length: 9 }, function(_, i) { var year = 2016 + i; return '<option value="' + year + '">' + year + '</option>'; }).join('')}
                            </select>
                        </label>
                    </div>

                    <div id="participantInfoError" role="alert" style="min-height:22px;color:#dc3545;font-size:15px;text-align:center;"></div>

                    <button id="participantInfoContinueBtn" type="submit" style="align-self:center;background:#007bff;color:white;border:none;padding:13px 28px;font-size:18px;border-radius:6px;cursor:pointer;">
                        Continue
                    </button>
                </form>
            </div>
        </div>
    `;

    var form = document.getElementById('participantInfoForm');
    var errorEl = document.getElementById('participantInfoError');
    var continueBtn = document.getElementById('participantInfoContinueBtn');

    function setError(message) {
        if (errorEl) {
            errorEl.textContent = message || '';
        }
    }

    function setSubmitting(isSubmitting) {
        if (!continueBtn) return;
        continueBtn.disabled = !!isSubmitting;
        continueBtn.textContent = isSubmitting ? 'Assigning...' : 'Continue';
        continueBtn.style.background = isSubmitting ? '#6c757d' : '#007bff';
        continueBtn.style.cursor = isSubmitting ? 'wait' : 'pointer';
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        var participantId = String(document.getElementById('participantIdInput').value || '').trim();
        var year = Number(document.getElementById('dobYear').value);
        var month = Number(document.getElementById('dobMonth').value);
        var day = Number(document.getElementById('dobDay').value);
        var dob = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        var ageInfo = calculateParticipantAgeFromDob(dob, new Date());

        if (!participantId) {
            setError('Please enter a participant ID.');
            return;
        }

        if (!/^[A-Za-z0-9_-]{1,32}$/.test(participantId)) {
            setError('Participant ID can use letters, numbers, hyphen, or underscore.');
            return;
        }

        if (!ageInfo) {
            setError('Please enter a real date of birth that is not in the future.');
            return;
        }

        try {
            setError('');
            setSubmitting(true);
            applyStartupParticipantInfo(participantId, ageInfo);
            await assignAIConditionForParticipant(participantId, ageInfo);
            nextStage();
        } catch (error) {
            console.error('Unable to assign AI condition:', error);
            setError('Could not assign an AI condition. Please check the server and try again.');
            setSubmitting(false);
        }
    });

    var participantIdInput = document.getElementById('participantIdInput');
    if (participantIdInput) {
        participantIdInput.focus();
    }
}


/**
 * Show fullscreen prompt stage (blank page with instruction)
 */
function showFullscreenPromptStage(stage) {
    var container = document.getElementById('container');

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f7fbff;padding:24px;font-family:Arial, sans-serif;">
            <div tabindex="-1" style="color:#243044;text-align:center;max-width:760px;width:100%;padding:34px 30px;border:3px solid #007bff;border-radius:14px;background:#fff;box-shadow:0 10px 24px rgba(0, 70, 140, 0.14);">
                <div aria-hidden="true" style="display:flex;justify-content:center;gap:10px;margin-bottom:16px;">
                    <span style="width:18px;height:18px;background:#ffcc00;border-radius:4px;transform:rotate(10deg);display:inline-block;"></span>
                    <span style="width:18px;height:18px;background:#2cc6a0;border-radius:50%;display:inline-block;"></span>
                    <span style="width:18px;height:18px;background:#7c8cff;border-radius:4px;transform:rotate(-10deg);display:inline-block;"></span>
                </div>
                <h1 style="margin:0 0 12px;font-size:46px;line-height:1.05;color:#1f2937;">Welcome to the Game!</h1>
                <p style="margin:0 0 24px;font-size:25px;line-height:1.35;color:#344054;">Get ready to play.</p>
                <div style="display:inline-flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;font-size:26px;font-weight:bold;color:#333;">
                    <span>Press</span>
                    <span style="font-family:monospace;background:#eef4ff;border:2px solid #9cc8ff;padding:8px 16px;border-radius:8px;box-shadow:0 3px 0 #b7d7ff;">Space Bar</span>
                    <span>to enter fullscreen</span>
                </div>
            </div>
        </div>
    `;

    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);
            try {
                if (window.NodeGameConfig && window.NodeGameConfig.NODEGAME_CONFIG && window.NodeGameConfig.NODEGAME_CONFIG.fullscreen && window.NodeGameConfig.NODEGAME_CONFIG.fullscreen.enabled) {
                    window.NodeGameConfig.enterFullscreen();
                }
            } catch (e) {
                console.warn('enterFullscreen failed:', e);
            }
            nextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

/**
 * Show welcome info stage
 */
function showWelcomeInfoStage(stage) {
    var container = document.getElementById('container');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 10px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 2px; font-size: 22px;">Welcome to the Game!</h2>

                <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                    <div style="text-align: center; line-height: 1.6; margin-bottom: 2px; font-size: 18px; max-width: 600px;">
                        <p style="margin-bottom: 2px;">
                            You will play a navigation game where hungry travelers need to reach restaurants as quickly as possible.
                        </p>
                        <p style="margin-bottom: 2px;">
                            <span style="color: #007bff; font-weight: bold;">
                                Your goal: Use the arrow keys to guide your traveler to a restaurant.
                            </span>
                        </p>
                    </div>
                </div>

                <!-- Example Map: 1 Player and 1 Restaurant -->
                <div style="background: #f8f9fa; border: 2px solid #007bff; border-radius: 10px; padding: 16px; margin: 5px auto 5px; max-width: 700px;">
                    <h4 style="color:rgb(14, 14, 15); margin: 0 0 12px; font-size: 14px; text-align:center;">Example Game Map and Controls</h4>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 10px;">
                        <div class="example-grid" style="display: grid; grid-template-columns: repeat(5, 32px); grid-template-rows: repeat(5, 32px); gap: 3px; border: 2px solid #333; padding: 6px; background: white; border-radius: 8px;">
                            <!-- Row 1 -->
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #007bff; border: 1px solid #ddd; border-radius: 3px;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                            <!-- Row 2 -->
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                            <!-- Row 3 -->
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: red; border: 1px solid #ddd; border-radius: 50%;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                            <!-- Row 4 -->
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                            <!-- Row 5 -->
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                            <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                        </div>
                        <!-- Legend moved to the right -->
                        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #333;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 14px; height: 14px; background: red; border-radius: 50%;"></div>
                                <span>Traveler</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 14px; height: 14px; background: #007bff; border-radius: 3px;"></div>
                                <span>Restaurant</span>
                            </div>
                        </div>
                    </div>
                    <!-- Controls inside the same figure -->
                    <div style="margin-top: 12px;"></div>
                    <div style="display:flex; justify-content:center; align-items:flex-end; gap: 24px; margin: 0 auto 4px; max-width: 640px;">
                        <!-- Space bar (left) -->
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="width:240px; height:48px; border:1px solid #bbb; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#f7f7f7; box-shadow: inset 0 1px 0 #fff; font-size: 16px; letter-spacing: 1px;">SPACE BAR</div>
                            <div style="margin-top:8px; color:#555; font-size:14px;">Press this button for starting the game</div>
                        </div>

                        <!-- Arrow keys (right) -->
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="display:grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 46px); gap: 6px;">
                                <div></div>
                                <div style="width:46px;height:46px;border:1px solid #bbb;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f7f7f7;box-shadow: inset 0 1px 0 #fff; font-size: 20px;">↑</div>
                                <div></div>
                                <div style="width:46px;height:46px;border:1px solid #bbb;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f7f7f7;box-shadow: inset 0 1px 0 #fff; font-size: 20px;">←</div>
                                <div style="width:46px;height:46px;border:1px solid #bbb;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f7f7f7;box-shadow: inset 0 1px 0 #fff; font-size: 20px;">↓</div>
                                <div style="width:46px;height:46px;border:1px solid #bbb;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f7f7f7;box-shadow: inset 0 1px 0 #fff; font-size: 20px;">→</div>
                            </div>
                            <div style="margin-top:8px; color:#555; font-size:14px;">Arrow keys for navigation</div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 5px;">
                    <p style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 5px;">
                        Next, let's see how to play the game! Press the <span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">spacebar</span> to begin!
                    </p>
                </div>
            </div>
        </div>
    `;

    // Handle spacebar to continue
    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

/**
 * Show welcome stage (matching jsPsych)
 */
function showWelcomeStage(stage) {
    var container = document.getElementById('container');
    var experimentType = stage.experimentType;

    var welcomeMessage = getWelcomeMessage(experimentType);

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                ${welcomeMessage}
            </div>
        </div>
    `;

    // Handle spacebar or any key to continue
    function handleKeyPress(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleKeyPress);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleKeyPress);
    document.body.focus();
}

/**
 * Show instructions stage
 */
function showInstructionsStage(stage) {
    var container = document.getElementById('container');
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Update current experiment state
    gameData.currentExperiment = experimentType;
    gameData.currentExperimentIndex = experimentIndex;

    // Initialize success threshold tracking for collaboration games
    if (experimentType.includes('2P')) {
        console.log(`Initializing success threshold tracking for ${experimentType}`);

        // Try to find the appropriate initialization function
        if (typeof initializeSuccessThresholdTracking === 'function') {
            initializeSuccessThresholdTracking();
        } else if (window.ExpDesign && typeof window.ExpDesign.initializeSuccessThresholdTracking === 'function') {
            window.ExpDesign.initializeSuccessThresholdTracking();
        } else {
            console.warn('initializeSuccessThresholdTracking function not available');
        }
    }

    container.innerHTML = getInstructionsForExperiment(experimentType);

    // Handle spacebar to continue
    function handleSpacebar(event) {
        if (event.code === 'Space') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);
            nextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

/**
 * Show pre-trial stage (show map without spacebar prompt)
 */
function showPreTrialStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;
    var currentDesign = timeline.mapData[experimentType][trialIndex];

    // Setup grid matrix for display
    setupGridMatrixForTrial(currentDesign, experimentType);

    // Compute how to display round count
    var preTrialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        preTrialCountDisplay = `Round ${trialIndex + 1}`;
    } else {
        preTrialCountDisplay = `Round ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}`;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 20px;">Game ${experimentIndex + 1}: ${preTrialCountDisplay}</h3>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Create and draw canvas
    var canvas = nodeGameCreateGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);
    nodeGameUpdateGameDisplay();

    // Auto-advance after configurable duration
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.preTrialDisplayDuration);
}

/**
 * Show fixation stage (configurable duration)
 */
function showFixationStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;
    var currentDesign = timeline.mapData[experimentType][trialIndex];

    // Create empty grid matrix for fixation (no objects)
    gameData.gridMatrix = Array(EXPSETTINGS.matrixsize).fill(0).map(() => Array(EXPSETTINGS.matrixsize).fill(0));

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
            </div>
        </div>
    `;

    // Create and draw canvas with fixation
    var canvas = nodeGameCreateGameCanvas();
    document.getElementById('gameCanvas').appendChild(canvas);
    nodeGameDrawFixationDisplay(canvas);

    // Pre-calculate joint-RL policy for human-AI collaboration games during fixation to eliminate initial lag
    // Note: This is only needed for human-AI experiments, not human-human experiments
    if (experimentType.includes('2P') && window.RLAgent && window.RLAgent.precalculatePolicyForGoals) {
        // Get the design for this trial to extract goals
        var design = getRandomMapForCollaborationGame(experimentType, trialIndex);
        if (design) {
            var goals = [design.target1];
            if (design.target2) {
                goals.push(design.target2);
            }

            console.log('⚡ Pre-calculating joint-RL policy during fixation for human-AI goals:', goals.map(g => `[${g}]`).join(', '));

            // Pre-calculate in background during fixation
            setTimeout(() => {
                window.RLAgent.precalculatePolicyForGoals(goals, experimentType);
            }, 100); // Small delay to ensure UI is rendered first
        }
    }

    // Auto-advance after configurable duration
    setTimeout(() => {
        nextStage();
    }, NODEGAME_CONFIG.timing.fixationDuration);
}


/**
 * Show wait message during AI turns (matching jsPsych)
 */
function showWaitMessage() {
    // Remove any existing wait message
    var existingMsg = document.getElementById('waitMessageBelowGrid');
    if (existingMsg) {
        existingMsg.remove();
    }

    // Hide the movement instructions during waiting phase
    var movementInstructions = document.querySelector('p[style*="font-size: 20px"]');
    if (movementInstructions && movementInstructions.textContent.includes('Press ↑ ↓ ← → to move')) {
        movementInstructions.style.display = 'none';
    }

    // Find the game canvas
    var canvas = document.querySelector('canvas');
    if (canvas) {
        // Redraw grid as usual
        nodeGameUpdateGameDisplay();

        // Insert wait message below the grid
        var waitMsg = document.createElement('div');
        waitMsg.id = 'waitMessageBelowGrid';
        waitMsg.style.cssText = `
            margin-top: 20px;
            text-align: center;
            font-size: 20px;
            color: #333;
            background: rgba(255,255,255,0.95);
            border: 1px solid #007bff;
            border-radius: 8px;
            padding: 12px 24px;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        `;
        waitMsg.textContent = 'Please wait for the other player to reach the goal!';

        // Try to insert after the canvas
        if (canvas.parentNode) {
            // Insert after canvas
            if (canvas.nextSibling) {
                canvas.parentNode.insertBefore(waitMsg, canvas.nextSibling);
            } else {
                canvas.parentNode.appendChild(waitMsg);
            }
        }
    }
}


/**
 * Show post-trial feedback stage
 */
function showPostTrialStage(stage) {
    var container = document.getElementById('container');
    var trialIndex = stage.trialIndex;
    var experimentType = stage.experimentType;
    var experimentIndex = stage.experimentIndex;

    // Safely get the last trial data with fallback
    var lastTrialData = null;
    if (gameData && gameData.allTrialsData && gameData.allTrialsData.length > 0) {
        lastTrialData = gameData.allTrialsData[gameData.allTrialsData.length - 1];
    }

    // Set default values if lastTrialData is not available
    var success = false;
    var message = 'Trial completed';
    var color = 'blue';

    if (lastTrialData) {
        // For 2P experiments, check collaboration success
        if (experimentType.includes('2P') && lastTrialData.collaborationSucceeded !== undefined) {
            success = lastTrialData.collaborationSucceeded;
            message = success ? 'Collaboration succeeded!' : 'Collaboration failed!';
        } else if (lastTrialData.completed !== undefined) {
            // For 1P experiments, check individual completion
            success = lastTrialData.completed;
            message = success ? 'Goal reached!' : 'Time up!';
        }
    }

    // For collaboration games, show dynamic trial count
    var trialCountDisplay = '';
    if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
        // For dynamic trials (success threshold enabled), don't show total since it can vary
        trialCountDisplay = `Round ${trialIndex + 1}`;
    } else {
        // For fixed trials, show current/total format
        trialCountDisplay = `Round ${trialIndex + 1} of ${NODEGAME_CONFIG.numTrials[experimentType]}`;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center;">
                <h3 style="margin-bottom: 20px;">Game ${experimentIndex + 1}: ${trialCountDisplay}</h3>
                <div id="gameCanvas" style="margin-bottom: 20px;"></div>
                <p style="font-size: 20px;">You are the player <span style="display: inline-block; width: 18px; height: 18px; background-color: red; border-radius: 50%; vertical-align: middle;"></span>. Press ↑ ↓ ← → to move.</p>
            </div>
        </div>
    `;

    // Create and draw canvas with final state
    var canvas;
    if (typeof nodeGameCreateGameCanvas === 'function') {
        canvas = nodeGameCreateGameCanvas();
    } else if (typeof createGameCanvas === 'function') {
        canvas = createGameCanvas();
    } else {
        console.error('No canvas creation function available');
        return;
    }
    var canvasContainer = document.getElementById('gameCanvas');
    canvasContainer.appendChild(canvas);

    // Use the appropriate rendering function based on experiment type
    if (experimentType.includes('1P') || experimentType.includes('2P')) {
        // For human-human experiments, use the fallback rendering
        if (typeof renderGameBoardFallback === 'function') {
            renderGameBoardFallback();
        } else {
            console.warn('renderGameBoardFallback not available, using nodeGameUpdateGameDisplay');
            nodeGameUpdateGameDisplay();
        }
    } else {
        // For human-AI experiments, use the original function
        nodeGameUpdateGameDisplay();
    }

    // Add visual feedback overlay on top of the canvas
    if (experimentType.includes('2P') && lastTrialData && lastTrialData.collaborationSucceeded !== undefined) {
        // For 2P experiments, use collaboration feedback overlay
        createTrialFeedbackOverlay(canvasContainer, lastTrialData.collaborationSucceeded, 'collaboration');
    } else if (experimentType.includes('1P')) {
        // For 1P experiments, use single player feedback overlay
        createTrialFeedbackOverlay(canvasContainer, success, 'single');
    }

    // Auto-advance after configurable duration
    setTimeout(() => {
        console.log(`Post-trial auto-advance: experimentType=${experimentType}, trialIndex=${trialIndex}`);

        // Check if we should end the experiment early due to success threshold
        var shouldEndDueToThreshold = false;
        if (typeof shouldEndExperimentDueToSuccessThreshold === 'function') {
            shouldEndDueToThreshold = shouldEndExperimentDueToSuccessThreshold();
        } else if (window.ExpDesign && typeof window.ExpDesign.shouldEndExperimentDueToSuccessThreshold === 'function') {
            shouldEndDueToThreshold = window.ExpDesign.shouldEndExperimentDueToSuccessThreshold();
        }

        if (shouldEndDueToThreshold) {
            console.log('Ending experiment due to success threshold - will skip to game-feedback or next experiment');
            // Skip to the end of this experiment by finding the next experiment or completion stage
            skipToNextExperimentOrCompletion();
        } else {
            // For collaboration games, check if we should continue to next trial
            if (experimentType.includes('2P') && NODEGAME_CONFIG.successThreshold.enabled) {
                var shouldContinue = true;
                if (typeof shouldContinueToNextTrial === 'function') {
                    shouldContinue = shouldContinueToNextTrial(experimentType, trialIndex);
                } else if (window.ExpDesign && typeof window.ExpDesign.shouldContinueToNextTrial === 'function') {
                    shouldContinue = window.ExpDesign.shouldContinueToNextTrial(experimentType, trialIndex);
                }

                console.log(`Should continue to next trial: ${shouldContinue}`);

                if (shouldContinue) {
                    console.log('Continuing to next trial for collaboration game');
                    // Add the next trial stages dynamically
                    addNextTrialStages(experimentType, experimentIndex, trialIndex + 1);
                    nextStage();
                } else {
                    console.log('Ending collaboration experiment - will skip to game-feedback or next experiment');
                    // End this experiment and move to next
                    skipToNextExperimentOrCompletion();
                }
            } else {
                console.log('Continuing to next stage normally');
                nextStage();
            }
        }
    }, NODEGAME_CONFIG.timing.feedbackDisplayDuration);
}



/**
 * Skip to the next experiment or completion stage
 */
function skipToNextExperimentOrCompletion() {
    var currentStage = timeline.stages[timeline.currentStage];
    var currentExperimentType = currentStage.experimentType;

    console.log(`Skipping to next experiment or completion from ${currentExperimentType}`);

    // Find the next stage that's either a different experiment, end-info, or completion
    var nextStageIndex = timeline.currentStage + 1;
    console.log(`Starting search from stage ${nextStageIndex}`);
    console.log(`Total stages in timeline: ${timeline.stages.length}`);

    while (nextStageIndex < timeline.stages.length) {
        var nextStage = timeline.stages[nextStageIndex];
        console.log(`Checking stage ${nextStageIndex}: ${nextStage.type} - ${nextStage.handler ? nextStage.handler.name : 'no handler'}`);

        // If it's a different experiment type, game-feedback stage, questionnaire stage, end-info stage, or completion stage, stop here
        if (nextStage.type === 'complete' || nextStage.type === 'end-info' || nextStage.type === 'game-feedback' || nextStage.type === 'questionnaire' ||
            (nextStage.experimentType && nextStage.experimentType !== currentExperimentType)) {
            console.log(`Found stopping point: ${nextStage.type}`);
            break;
        }
        nextStageIndex++;
    }

    // Set the current stage to the found stage
    timeline.currentStage = nextStageIndex;

    // If we found a valid next stage and it's a different experiment, reset success threshold
    if (timeline.currentStage < timeline.stages.length) {
        var nextStage = timeline.stages[timeline.currentStage];
        if (nextStage.experimentType && nextStage.experimentType !== currentExperimentType) {
            console.log(`Switching from ${currentExperimentType} to ${nextStage.experimentType} - resetting success threshold`);

            // Try to find the appropriate initialization function
            if (typeof initializeSuccessThresholdTracking === 'function') {
                initializeSuccessThresholdTracking();
            } else if (window.ExpDesign && typeof window.ExpDesign.initializeSuccessThresholdTracking === 'function') {
                window.ExpDesign.initializeSuccessThresholdTracking();
            } else {
                console.warn('initializeSuccessThresholdTracking function not available');
            }
        }
        console.log(`Skipped to stage ${timeline.currentStage}: ${nextStage.type}`);
        if (nextStage.handler) {
            nextStage.handler(nextStage);
        } else {
            console.warn(`No handler for stage: ${nextStage.type}`);
            nextStage();
        }
    } else {
        console.log('No more stages to run');
    }
}

/**
 * Add next trial stages
 */
function addNextTrialStages(experimentType, experimentIndex, trialIndex) {
    // Find the current post-trial stage index
    var currentStageIndex = timeline.currentStage;

    // Insert the next trial stages after the current post-trial stage
    var stagesToInsert = [
        {
            type: 'fixation',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showFixationStage
        },
        {
            type: 'trial',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: runTrialStage
        },
        {
            type: 'post-trial',
            experimentType: experimentType,
            experimentIndex: experimentIndex,
            trialIndex: trialIndex,
            handler: showPostTrialStage
        }
    ];

    // Insert stages after current stage
    timeline.stages.splice(currentStageIndex + 1, 0, ...stagesToInsert);

    console.log(`Added next trial stages for ${experimentType} trial ${trialIndex + 1}`);
}

function addCollaborationExperimentStages(experimentType, experimentIndex, trialIndex) {
    // Fixation screen
    timeline.stages.push({
        type: 'fixation',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showFixationStage
    });

    // Main trial
    timeline.stages.push({
        type: 'trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: runTrialStage
    });

    // Post-trial feedback with dynamic continuation
    timeline.stages.push({
        type: 'post-trial',
        experimentType: experimentType,
        experimentIndex: experimentIndex,
        trialIndex: trialIndex,
        handler: showPostTrialStage
    });
}

/**
 * Show post-questionnaire stage (matching testExpWithAI.js)
 */
function showQuestionnaireStage(stage) {
    var container = document.getElementById('container');

    // Keyboard-first, 3-page questionnaire (no mouse needed)
    try {
        var questions = [
            {
                name: 'ai_detection',
                title: 'Page 1 of 3',
                prompt: 'Do you think the other player is a person or a computer?',
                options: [
                    'Definitely a person',
                    'Probably a person',
                    'Not sure',
                    'Probably a computer',
                    'Definitely a computer'
                ]
            },
            {
                name: 'collaboration_rating',
                title: 'Page 2 of 3',
                prompt: 'How well did the other player collaborate with you?',
                options: [
                    'Very poor collaborator',
                    'Poor collaborator',
                    'Neutral',
                    'Good collaborator',
                    'Very good collaborator'
                ]
            },
            {
                name: 'play_again',
                title: 'Page 3 of 3',
                prompt: 'Would you like to play this game again in the future?',
                options: [
                    'Definitely not play again',
                    'Probably not play again',
                    'Not sure',
                    'Probably play again',
                    'Definitely play again'
                ]
            }
        ];

        var answers = {};
        var qIndex = 0;
        var selIndex = 2; // default to middle

        function renderQuestion() {
            var q = questions[qIndex];
            var optionsHtml = q.options.map(function(opt, idx) {
                var isSelected = idx === selIndex;
                return `
                    <div data-idx="${idx}" style="
                        padding: 12px 16px;
                        margin: 8px 0;
                        border-radius: 10px;
                        border: 2px solid ${isSelected ? '#4f46e5' : '#e5e7eb'};
                        background: ${isSelected ? '#eef2ff' : '#ffffff'};
                        color: #333;
                        font-size: 18px;
                        text-align: center;
                    ">${opt}</div>`;
            }).join('');

            container.innerHTML = `
                <div style=\"display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f8f9fa; padding:20px;\">\n                    <div style=\"background:white; padding:32px; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.1); width:100%; max-width:720px;\">\n                        <div style=\"text-align:center; margin-bottom:12px; color:#6b7280; font-weight:600;\">📋 Post-Game Questionnaire</div>\n                        <div style=\"text-align:center; margin-bottom:8px; color:#6b7280; font-weight:600;\">${q.title}</div>\n                        <h2 style=\"text-align:center; margin:8px 0 20px; color:#111827;\">${q.prompt}</h2>\n                        <div style=\"margin-bottom:16px; text-align:center; color:#6b7280;\">Use ↑ ↓ to choose, press Space to confirm</div>\n                        <div id=\"options\" style=\"display:flex; flex-direction:column;\">${optionsHtml}</div>\n                    </div>\n                </div>`;
        }

        function handleKeys(e) {
            if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
                e.preventDefault();
                selIndex = Math.max(0, selIndex - 1);
                renderQuestion();
            } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
                e.preventDefault();
                selIndex = Math.min(questions[qIndex].options.length - 1, selIndex + 1);
                renderQuestion();
            } else if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                answers[questions[qIndex].name] = questions[qIndex].options[selIndex];
                if (qIndex < questions.length - 1) {
                    qIndex += 1;
                    selIndex = 2;
                    renderQuestion();
                } else {
                    document.removeEventListener('keydown', handleKeys);
                    gameData.questionnaireData = answers;
                    nextStage();
                }
            }
        }

        renderQuestion();
        document.addEventListener('keydown', handleKeys);
        return; // Keep the keyboard-first version only
    } catch (e) {}

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px;">
            <div style="background: white; padding: 50px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); max-width: 900px; width: 100%; position: relative; overflow: hidden;">
                <!-- Decorative elements -->
                <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 50%; opacity: 0.1;"></div>
                <div style="position: absolute; bottom: -30px; left: -30px; width: 60px; height: 60px; background: linear-gradient(45deg, #764ba2, #667eea); border-radius: 50%; opacity: 0.1;"></div>

                <div style="text-align: center; margin-bottom: 40px;">
                    <div style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50px; margin-bottom: 20px;">
                        <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">📋 Post-Experiment Questionnaire</h2>
                    </div>
                    <p style="color: #666; font-size: 16px; margin: 0;">Please share your experience with us</p>
                </div>

                <form id="questionnaireForm">
                    <div id="questionnairePage1">
                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px 25px; border-radius: 15px; margin-bottom: 30px; text-align: center;">
                            <h3 style="margin: 0; font-size: 18px; font-weight: 500;">📄 Page 1 of 2</h3>
                        </div>

                        <div style="background: #f8f9ff; border: 2px solid #e0e7ff; border-radius: 15px; padding: 25px; margin-bottom: 30px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.1);">
                            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">1</div>
                                <label style="font-weight: 600; font-size: 18px; color: #333; margin: 0;">
                                    🤖 Do you think the other player is a person or a computer?
                                </label>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <input type="radio" name="ai_detection" value="Definitely a person" required id="ai_detection_1" style="cursor: pointer; transform: scale(1.2); accent-color: #667eea;">
                                    <input type="radio" name="ai_detection" value="Probably a person" required id="ai_detection_2" style="cursor: pointer; transform: scale(1.2); accent-color: #667eea;">
                                    <input type="radio" name="ai_detection" value="Not sure" required id="ai_detection_3" style="cursor: pointer; transform: scale(1.2); accent-color: #667eea;">
                                    <input type="radio" name="ai_detection" value="Probably a computer" required id="ai_detection_4" style="cursor: pointer; transform: scale(1.2); accent-color: #667eea;">
                                    <input type="radio" name="ai_detection" value="Definitely a computer" required id="ai_detection_5" style="cursor: pointer; transform: scale(1.2); accent-color: #667eea;">
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; text-align: center; color: #555;">
                                    <label for="ai_detection_1" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0f4ff'; this.style.color='#667eea'" onmouseout="this.style.background='transparent'; this.style.color='#555'">👤 Definitely a person</label>
                                    <label for="ai_detection_2" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0f4ff'; this.style.color='#667eea'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🤔 Probably a person</label>
                                    <label for="ai_detection_3" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0f4ff'; this.style.color='#667eea'" onmouseout="this.style.background='transparent'; this.style.color='#555'">❓ Not sure</label>
                                    <label for="ai_detection_4" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0f4ff'; this.style.color='#667eea'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🤖 Probably an AI</label>
                                    <label for="ai_detection_5" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0f4ff'; this.style.color='#667eea'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🎯 Definitely an AI</label>
                                </div>
                            </div>
                        </div>

                        <div style="background: #f0fff4; border: 2px solid #dcfce7; border-radius: 15px; padding: 25px; margin-bottom: 30px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.1);">
                            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">2</div>
                                <label style="font-weight: 600; font-size: 18px; color: #333; margin: 0;">
                                    🤝 To what extent do you think the other player was a good collaborator?
                                </label>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <input type="radio" name="collaboration_rating" value="Very poor collaborator" required id="collaboration_rating_1" style="cursor: pointer; transform: scale(1.2); accent-color: #22c55e;">
                                    <input type="radio" name="collaboration_rating" value="Poor collaborator" required id="collaboration_rating_2" style="cursor: pointer; transform: scale(1.2); accent-color: #22c55e;">
                                    <input type="radio" name="collaboration_rating" value="Neutral" required id="collaboration_rating_3" style="cursor: pointer; transform: scale(1.2); accent-color: #22c55e;">
                                    <input type="radio" name="collaboration_rating" value="Good collaborator" required id="collaboration_rating_4" style="cursor: pointer; transform: scale(1.2); accent-color: #22c55e;">
                                    <input type="radio" name="collaboration_rating" value="Very good collaborator" required id="collaboration_rating_5" style="cursor: pointer; transform: scale(1.2); accent-color: #22c55e;">
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; text-align: center; color: #555;">
                                    <label for="collaboration_rating_1" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'; this.style.color='#22c55e'" onmouseout="this.style.background='transparent'; this.style.color='#555'">😞 Very poor collaborator</label>
                                    <label for="collaboration_rating_2" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'; this.style.color='#22c55e'" onmouseout="this.style.background='transparent'; this.style.color='#555'">😐 Poor collaborator</label>
                                    <label for="collaboration_rating_3" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'; this.style.color='#22c55e'" onmouseout="this.style.background='transparent'; this.style.color='#555'">😑 Neutral</label>
                                    <label for="collaboration_rating_4" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'; this.style.color='#22c55e'" onmouseout="this.style.background='transparent'; this.style.color='#555'">😊 Good collaborator</label>
                                    <label for="collaboration_rating_5" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#f0fdf4'; this.style.color='#22c55e'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🤩 Very good collaborator</label>
                                </div>
                            </div>
                        </div>

                        <div style="background: #fff7ed; border: 2px solid #fed7aa; border-radius: 15px; padding: 25px; margin-bottom: 30px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(251, 146, 60, 0.1);">
                            <div style="display: flex; align-items: center; margin-bottom: 20px;">
                                <div style="background: linear-gradient(135deg, #fb923c 0%, #f97316 100%); color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold;">3</div>
                                <label style="font-weight: 600; font-size: 18px; color: #333; margin: 0;">
                                    🎮 Would you play with the other player again?
                                </label>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                    <input type="radio" name="play_again" value="Definitely not play again" required id="play_again_1" style="cursor: pointer; transform: scale(1.2); accent-color: #fb923c;">
                                    <input type="radio" name="play_again" value="Probably not play again" required id="play_again_2" style="cursor: pointer; transform: scale(1.2); accent-color: #fb923c;">
                                    <input type="radio" name="play_again" value="Not sure" required id="play_again_3" style="cursor: pointer; transform: scale(1.2); accent-color: #fb923c;">
                                    <input type="radio" name="play_again" value="Probably play again" required id="play_again_4" style="cursor: pointer; transform: scale(1.2); accent-color: #fb923c;">
                                    <input type="radio" name="play_again" value="Definitely play again" required id="play_again_5" style="cursor: pointer; transform: scale(1.2); accent-color: #fb923c;">
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; text-align: center; color: #555;">
                                    <label for="play_again_1" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#fff7ed'; this.style.color='#fb923c'" onmouseout="this.style.background='transparent'; this.style.color='#555'">❌ Definitely not play again</label>
                                    <label for="play_again_2" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#fff7ed'; this.style.color='#fb923c'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🤷 Probably not play again</label>
                                    <label for="play_again_3" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#fff7ed'; this.style.color='#fb923c'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🤔 Not sure</label>
                                    <label for="play_again_4" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#fff7ed'; this.style.color='#fb923c'" onmouseout="this.style.background='transparent'; this.style.color='#555'">👍 Probably play again</label>
                                    <label for="play_again_5" style="cursor: pointer; flex: 1; padding: 8px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#fff7ed'; this.style.color='#fb923c'" onmouseout="this.style.background='transparent'; this.style.color='#555'">🎉 Definitely play again</label>
                                </div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 40px;">
                            <button type="button" id="nextPageBtn" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 15px 40px;
                                font-size: 16px;
                                font-weight: 600;
                                border-radius: 50px;
                                cursor: pointer;
                                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
                                transition: all 0.3s ease;
                                transform: translateY(0);
                            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 35px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.3)'">
                                ➡️ Next Page
                            </button>
                        </div>
                    </div>

                    <div id="questionnairePage2" style="display: none;">
                        <h3 style="color: #666; margin-bottom: 20px;">Page 2 of 2</h3>

                        <div style="margin-bottom: 25px;">
                            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">
                                Do you have any questions or comments?
                            </label>
                            <textarea name="comments" rows="4" style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ddd;
                                border-radius: 5px;
                                font-family: inherit;
                                resize: vertical;
                            " placeholder="Any additional feedback..."></textarea>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <button type="button" id="prevPageBtn" style="
                                background: #6c757d;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                                margin-right: 10px;
                            ">Previous Page</button>
                            <button type="submit" id="submitBtn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                font-size: 16px;
                                border-radius: 5px;
                                cursor: pointer;
                            ">Submit</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Handle page navigation
    document.getElementById('nextPageBtn').addEventListener('click', function () {
        // Validate required fields on page 1 (only the 3 remaining questions)
        var requiredFields = ['ai_detection', 'collaboration_rating', 'play_again'];
        var isValid = true;

        requiredFields.forEach(function (field) {
            var element = document.querySelector('input[name="' + field + '"]:checked');
            if (!element) {
                isValid = false;
                // Highlight missing field - only if the field exists
                var fieldInput = document.querySelector('input[name="' + field + '"]');
                if (fieldInput) {
                    var fieldGroup = fieldInput.closest('div').parentElement;
                    fieldGroup.style.border = '2px solid #dc3545';
                    fieldGroup.style.borderRadius = '5px';
                    fieldGroup.style.padding = '10px';
                }
            }
        });

        if (isValid) {
            document.getElementById('questionnairePage1').style.display = 'none';
            document.getElementById('questionnairePage2').style.display = 'block';
        } else {
            alert('Please answer all required questions before proceeding.');
        }
    });

    document.getElementById('prevPageBtn').addEventListener('click', function () {
        document.getElementById('questionnairePage2').style.display = 'none';
        document.getElementById('questionnairePage1').style.display = 'block';
    });

    // Handle form submission
    document.getElementById('questionnaireForm').addEventListener('submit', function (e) {
        e.preventDefault();

        var formData = new FormData(this);
        var questionnaireData = {};

        for (var [key, value] of formData.entries()) {
            questionnaireData[key] = value;
        }

        // Store questionnaire data
        gameData.questionnaireData = questionnaireData;

        // Proceed to next stage
        nextStage();
    });
}

/**
 * Show end experiment info stage (matching testExpWithAI.js)
 */
function showEndExperimentInfoStage(stage) {
    var container = document.getElementById('container');

    // Exit fullscreen mode when experiment ends
    if (window.NodeGameConfig && window.NodeGameConfig.NODEGAME_CONFIG.fullscreen.enabled) {
        console.log('Exiting fullscreen mode at experiment end...');
        window.NodeGameConfig.exitFullscreen();
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px; text-align: center;">
                <h2 style="color: #333; margin-bottom: 30px;">🎉 Experiment Complete!</h2>
                <p style="font-size: 18px; color: #666; margin-bottom: 30px;">You have finished all the tasks!</p>
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">Please wait a few seconds. Your data is being saved to our secure server.</p>
                <div style="margin: 30px 0;">
                    <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 15px; color: #666; font-size: 16px;">Saving data...</p>
                </div>
                <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin-top: 20px;">
                    <p style="font-size: 14px; color: #6c757d; margin: 0;">
                        <strong>Note:</strong> Please do not close this window while data is being saved.
                    </p>
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    // Save data to Google Drive (this will handle the redirect to Prolific)
    if (window.NodeGameConfig) {
        var storageSettings = window.NodeGameConfig.getDataStorageConfig();
        if (storageSettings && storageSettings.type === 'local') {
            console.log('Local mode detected — skipping Google Drive upload.');
            completeAssignedAIConditionAssignment().finally(function() {
                nextStage();
            });
            return;
        }
    }

    completeAssignedAIConditionAssignment().finally(function() {
        saveDataToGoogleDrive();
    });
}

/**
 * Show Prolific redirect stage
 */
function showProlificRedirectStage(stage) {
    var container = document.getElementById('container');
    var completionCode = NODEGAME_CONFIG.prolificCompletionCode || 'COMPLETION_CODE';

    if (!NODEGAME_CONFIG.enableProlificRedirect) {
        showLocalCompletionStage(stage);
        return;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="text-align: center; max-width: 600px; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-bottom: 20px;">🎉 Experiment Complete!</h2>
                <p style="font-size: 18px; margin-bottom: 20px;">Thank you for completing the experiment!</p>

                <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <h3 style="color: #28a745; margin-bottom: 15px;">Your Completion Code</h3>
                    <div style="background: white; border: 2px dashed #28a745; border-radius: 5px; padding: 15px; margin: 10px 0;">
                        <p style="font-size: 24px; font-weight: bold; color: #28a745; margin: 0; font-family: monospace; letter-spacing: 2px;">
                            ${completionCode}
                        </p>
                    </div>
                    <p style="font-size: 14px; color: #666; margin: 10px 0 0 0;">
                        Please copy this code and paste it in Prolific to complete your submission.
                    </p>
                </div>

                <div style="margin: 30px 0;">
                    <p style="font-size: 16px; color: #666; margin-bottom: 20px;">
                        Click the button below to go to Prolific and submit your completion code.
                    </p>
                    <button id="prolificRedirectBtn" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                        📋 Go to Prolific
                    </button>
                </div>

                <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin-top: 20px;">
                    <p style="font-size: 14px; color: #6c757d; margin: 0;">
                        <strong>Note:</strong> Make sure to copy your completion code before clicking the button.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Handle Prolific redirect button
    document.getElementById('prolificRedirectBtn').addEventListener('click', function () {
        // Show loading state
        this.disabled = true;
        this.textContent = 'Redirecting...';
        this.style.background = '#6c757d';

        // Redirect to Prolific
        redirectToProlific();
    });
}

async function showLocalCompletionStage() {
    var container = document.getElementById('container');
    var participantId = window.DataRecording ? (window.DataRecording.getParticipantId() || 'participant') : 'participant';
    var safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
    var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    var excelFilename = `experiment_data_${safeParticipantId}_${timestamp}.xlsx`;

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                <h2 style="color: #333; margin-bottom: 20px;">🎉 Thanks for Participating!</h2>
                <p style="font-size: 18px; margin-bottom: 20px;">Your session is complete.</p>
                <p style="font-size: 16px; color: #666;" id="saveStatus">Saving your data...</p>
            </div>
        </div>
    `;

    const status = document.getElementById('saveStatus');

    function updateStatus(message, color) {
        if (status) {
            status.style.color = color || '#17a2b8';
            status.innerHTML = message;
        }
    }

    try {
        updateStatus('Preparing Excel workbook...', '#17a2b8');

        if (typeof XLSX === 'undefined') {
            throw new Error('Excel library (XLSX) is not loaded.');
        }

        updateStatus('Completing AI condition assignment...', '#17a2b8');
        await completeAssignedAIConditionAssignment();

        var questionnaireArray = convertQuestionnaireToArray(gameData.questionnaireData);

        var workbook = XLSX.utils.book_new();

        var allTrialsData = gameData.allTrialsData || [];
        if (allTrialsData.length > 0) {
            var processedData = allTrialsData.map(function(trial) {
                var copy = {};
                Object.keys(trial).forEach(function(key) {
                    var value = trial[key];
                    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                        copy[key] = JSON.stringify(value);
                    } else if (value === undefined) {
                        copy[key] = '';
                    } else {
                        copy[key] = value;
                    }
                });
                // Ensure participant metadata present on each row
                var pid = gameData.participantId || (window.DataRecording && window.DataRecording.getParticipantId && window.DataRecording.getParticipantId()) || '';
                if (!copy.participantId) copy.participantId = pid;
                var pdob = gameData.participantDob || (window.DataRecording && window.DataRecording.getParticipantDob && window.DataRecording.getParticipantDob()) || '';
                copy.participantDob = pdob;
                copy.participantAgeReferenceDate = gameData.participantAgeReferenceDate || '';
                copy.participantAgeYears = gameData.participantAgeYears == null ? '' : gameData.participantAgeYears;
                copy.participantAgeMonths = gameData.participantAgeMonths == null ? '' : gameData.participantAgeMonths;
                copy.participantAgeDays = gameData.participantAgeDays == null ? '' : gameData.participantAgeDays;
                copy.participantAgeTotalDays = gameData.participantAgeTotalDays == null ? '' : gameData.participantAgeTotalDays;
                Object.assign(copy, getAIConditionExportFields());
                return copy;
            });

            var experimentSheet = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(workbook, experimentSheet, 'Experiment Data');
        } else {
            var emptySheet = XLSX.utils.aoa_to_sheet([["No experiment data available"]]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, 'Experiment Data');
        }

        if (questionnaireArray && questionnaireArray.length > 0) {
            var questionnaireSheet = XLSX.utils.aoa_to_sheet(questionnaireArray);
            XLSX.utils.book_append_sheet(workbook, questionnaireSheet, 'Questionnaire Data');
        } else {
            var emptyQuestionnaireSheet = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
            XLSX.utils.book_append_sheet(workbook, emptyQuestionnaireSheet, 'Questionnaire Data');
        }

        // Add participant info sheet (ID and DOB)
        try {
            var pid = gameData.participantId || (window.DataRecording && window.DataRecording.getParticipantId && window.DataRecording.getParticipantId()) || '';
            var pdob = gameData.participantDob || (window.DataRecording && window.DataRecording.getParticipantDob && window.DataRecording.getParticipantDob()) || '';
            var aiConditionFields = getAIConditionExportFields();
            var participantInfo = XLSX.utils.aoa_to_sheet([
                ['participantId', 'participantDob', 'participantAgeReferenceDate', 'participantAgeYears', 'participantAgeMonths', 'participantAgeDays', 'participantAgeTotalDays', 'assignedAICondition', 'assignedAIConditionLabel', 'assignedAIRLAgentType', 'assignedAIAnalysisCode', 'aiConditionAssignmentId', 'aiConditionAssignmentStatus', 'aiConditionAssignmentSource', 'aiConditionAssignmentStrategy', 'aiConditionQuotaVersion', 'aiConditionAgeGroup', 'exportTimestamp'],
                [
                    pid,
                    pdob,
                    gameData.participantAgeReferenceDate || '',
                    gameData.participantAgeYears == null ? '' : gameData.participantAgeYears,
                    gameData.participantAgeMonths == null ? '' : gameData.participantAgeMonths,
                    gameData.participantAgeDays == null ? '' : gameData.participantAgeDays,
                    gameData.participantAgeTotalDays == null ? '' : gameData.participantAgeTotalDays,
                    aiConditionFields.assignedAICondition,
                    aiConditionFields.assignedAIConditionLabel,
                    aiConditionFields.assignedAIRLAgentType,
                    aiConditionFields.assignedAIAnalysisCode,
                    aiConditionFields.aiConditionAssignmentId,
                    aiConditionFields.aiConditionAssignmentStatus,
                    aiConditionFields.aiConditionAssignmentSource,
                    aiConditionFields.aiConditionAssignmentStrategy,
                    aiConditionFields.aiConditionQuotaVersion,
                    aiConditionFields.aiConditionAgeGroup,
                    new Date().toISOString()
                ]
            ]);
            XLSX.utils.book_append_sheet(workbook, participantInfo, 'Participant Info');
        } catch (e) {
            console.warn('Unable to append Participant Info sheet:', e);
        }

        updateStatus('Saving Excel locally...', '#17a2b8');
        downloadExcelFileLocally(workbook, excelFilename, { silent: true });

        updateStatus('Uploading Excel to Google Drive...', '#17a2b8');
        var uploadResult = await uploadWorkbookToGoogleDrive(workbook, excelFilename);
        if (!uploadResult || uploadResult.savedToDrive !== true) {
            throw (uploadResult && uploadResult.error) || new Error('google_drive_upload_failed');
        }

        updateStatus('✅ Excel saved locally.<br>✅ Excel uploaded to Google Drive.<br><strong>You may close this window.</strong>', '#28a745');
    } catch (error) {
        console.error('Failed to save session data:', error);
        updateStatus('Error saving data: ' + (error.message || error), '#dc3545');
    }
}

function appendParticipantInfoSheet(workbook) {
    try {
        var pid = gameData.participantId || (window.DataRecording && window.DataRecording.getParticipantId && window.DataRecording.getParticipantId()) || '';
        var pdob = gameData.participantDob || (window.DataRecording && window.DataRecording.getParticipantDob && window.DataRecording.getParticipantDob()) || '';
        var aiConditionFields = getAIConditionExportFields();
        var participantInfo = XLSX.utils.aoa_to_sheet([
            ['participantId', 'participantDob', 'participantAgeReferenceDate', 'participantAgeYears', 'participantAgeMonths', 'participantAgeDays', 'participantAgeTotalDays', 'assignedAICondition', 'assignedAIConditionLabel', 'assignedAIRLAgentType', 'assignedAIAnalysisCode', 'aiConditionAssignmentId', 'aiConditionAssignmentStatus', 'aiConditionAssignmentSource', 'aiConditionAssignmentStrategy', 'aiConditionQuotaVersion', 'aiConditionAgeGroup', 'exportTimestamp'],
            [
                pid,
                pdob,
                gameData.participantAgeReferenceDate || '',
                gameData.participantAgeYears == null ? '' : gameData.participantAgeYears,
                gameData.participantAgeMonths == null ? '' : gameData.participantAgeMonths,
                gameData.participantAgeDays == null ? '' : gameData.participantAgeDays,
                gameData.participantAgeTotalDays == null ? '' : gameData.participantAgeTotalDays,
                aiConditionFields.assignedAICondition,
                aiConditionFields.assignedAIConditionLabel,
                aiConditionFields.assignedAIRLAgentType,
                aiConditionFields.assignedAIAnalysisCode,
                aiConditionFields.aiConditionAssignmentId,
                aiConditionFields.aiConditionAssignmentStatus,
                aiConditionFields.aiConditionAssignmentSource,
                aiConditionFields.aiConditionAssignmentStrategy,
                aiConditionFields.aiConditionQuotaVersion,
                aiConditionFields.aiConditionAgeGroup,
                new Date().toISOString()
            ]
        ]);
        XLSX.utils.book_append_sheet(workbook, participantInfo, 'Participant Info');
    } catch (e) {
        console.warn('Unable to append Participant Info sheet:', e);
    }
}

function buildSessionWorkbook(experimentData, questionnaireData) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Excel library (XLSX) is not loaded.');
    }

    var workbook = XLSX.utils.book_new();
    var rows = Array.isArray(experimentData) ? experimentData : [];

    if (rows.length > 0) {
        var processedData = rows.map(function(trial) {
            var copy = {};
            Object.keys(trial || {}).forEach(function(key) {
                var value = trial[key];
                if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                    copy[key] = JSON.stringify(value);
                } else if (value === undefined) {
                    copy[key] = '';
                } else {
                    copy[key] = value;
                }
            });
            return copy;
        });
        var experimentSheet = XLSX.utils.json_to_sheet(processedData);
        XLSX.utils.book_append_sheet(workbook, experimentSheet, 'Experiment Data');
    } else {
        var emptySheet = XLSX.utils.aoa_to_sheet([["No experiment data available"]]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, 'Experiment Data');
    }

    var questionnaireArray = Array.isArray(questionnaireData) ? questionnaireData : convertQuestionnaireToArray(questionnaireData);
    if (questionnaireArray && questionnaireArray.length > 0) {
        var questionnaireSheet = XLSX.utils.aoa_to_sheet(questionnaireArray);
        XLSX.utils.book_append_sheet(workbook, questionnaireSheet, 'Questionnaire Data');
    } else {
        var emptyQuestionnaireSheet = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
        XLSX.utils.book_append_sheet(workbook, emptyQuestionnaireSheet, 'Questionnaire Data');
    }

    appendParticipantInfoSheet(workbook);
    return workbook;
}

/**
 * Send Excel file to Google Drive
 */
async function sendExcelToGoogleDrive(experimentData, questionnaireData, filename, options) {
    options = options || {};
    var workbook = null;

    try {
        workbook = buildSessionWorkbook(experimentData, questionnaireData);
        var uploadResult = await uploadWorkbookToGoogleDrive(workbook, filename);
        if (!uploadResult || uploadResult.savedToDrive !== true) {
            throw (uploadResult && uploadResult.error) || new Error('google_drive_upload_failed');
        }

        if (typeof options.resolve === 'function') {
            options.resolve(uploadResult);
        }

        if (!options.skipNextStage) {
            nextStage();
        }
    } catch (error) {
        console.error('Error creating or uploading Excel file for Google Drive:', error);

        try {
            var storageSettings = window.NodeGameConfig && window.NodeGameConfig.getDataStorageConfig
                ? window.NodeGameConfig.getDataStorageConfig()
                : null;
            if (workbook && storageSettings && storageSettings.localFallback !== false) {
                downloadExcelFileLocally(workbook, filename, { silent: true });
            }
        } catch (fallbackError) {
            console.error('Local fallback download failed:', fallbackError);
        }

        if (typeof options.resolve === 'function') {
            options.resolve({ savedToDrive: false, error: error });
        }

        if (!options.skipNextStage) {
            nextStage();
        }
    }
}

/**
 * Download Excel file locally as fallback when Google Drive fails
 */
function downloadExcelFileLocally(wb, filename, options) {
    options = options || {};
    var silent = options.silent === true;

    try {
        // Convert workbook to blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Excel file downloaded locally:', filename);
        if (!silent) {
            alert('Data downloaded successfully! Please save this file.');
        }
    } catch (error) {
        console.error('Error downloading Excel file locally:', error);
        if (!silent) {
            alert('Error downloading data file. Please contact the experiment administrator.');
        }
    }
}

function arrayBufferToBase64(arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var binary = '';
    var chunkSize = 0x8000;

    for (var i = 0; i < bytes.length; i += chunkSize) {
        var chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
}

/**
 * Upload an existing workbook to Google Drive (Apps Script endpoint).
 * Does not change timeline stages; resolves best-effort under no-cors.
 * @param {Object} workbook - XLSX workbook object
 * @param {string} filename - Target filename on Drive
 * @returns {Promise<{savedToDrive:boolean,error?:any}>}
 */
function uploadWorkbookToGoogleDrive(workbook, filename) {
    return new Promise(function(resolve) {
        try {
            if (typeof XLSX === 'undefined') {
                console.error('XLSX library not found.');
                resolve({ savedToDrive: false, error: new Error('XLSX not available') });
                return;
            }

            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const base64String = arrayBufferToBase64(wbout);

            const formData = new FormData();
            formData.append('filename', filename);
            formData.append('filedata', base64String);
            formData.append('filetype', 'excel');

            fetch("https://script.google.com/macros/s/AKfycbyfQ-XKsoFbmQZGM7c741rEXh2ZUpVK-uUIu9ycooXKnaxM5-hRSzIUhQ-uWZ668Qql/exec", {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            }).then(function() {
                resolve({ savedToDrive: true });
            }).catch(function(error) {
                console.error('Google Drive upload error:', error);
                resolve({ savedToDrive: false, error: error });
            });
        } catch (error) {
            console.error('Failed to upload workbook to Google Drive:', error);
            resolve({ savedToDrive: false, error: error });
        }
    });
}

/**
 * Redirect to Prolific completion page
 */
function redirectToProlific() {
    try {
        // Check if we're in a testing environment (no Prolific redirect needed)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Running locally - skipping Prolific redirect');
            // Show completion message instead
            showCompletionStage();
            return;
        }

        // Redirect to Prolific completion page
        const completionCode = NODEGAME_CONFIG.prolificCompletionCode || 'COMPLETION_CODE';
        const redirectUrl = `https://app.prolific.co/submissions/complete?cc=${completionCode}`;

        console.log('Redirecting to Prolific:', redirectUrl);
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Error redirecting to Prolific:', error);
        // Fallback: show completion message
        showCompletionStage();
    }
}

/**
 * Convert questionnaire data to array format for Excel export
 */
function convertQuestionnaireToArray(questionnaireData) {
    if (!questionnaireData) {
        return [["No questionnaire data available"]];
    }

    try {
        // If questionnaireData is already an array, return it
        if (Array.isArray(questionnaireData)) {
            return questionnaireData;
        }

        // If it's an object, convert to array format
        if (typeof questionnaireData === 'object') {
            const array = [];

            // Add header row
            const headers = Object.keys(questionnaireData);
            array.push(headers);

            // Add data row
            const values = headers.map(header => questionnaireData[header]);
            array.push(values);

            return array;
        }

        // If it's a string, try to parse as JSON
        if (typeof questionnaireData === 'string') {
            try {
                const parsed = JSON.parse(questionnaireData);
                return convertQuestionnaireToArray(parsed);
            } catch (parseError) {
                return [["Questionnaire data (string):", questionnaireData]];
            }
        }

        // Fallback
        return [["Questionnaire data:", String(questionnaireData)]];
    } catch (error) {
        console.error('Error converting questionnaire data to array:', error);
        return [["Error converting questionnaire data:", error.message]];
    }
}

/**
 * Save data to Google Drive (matching jsPsych version)
 */
function saveDataToGoogleDrive() {
    try {
        // Get experiment data
        let experimentData = gameData.allTrialsData;

        // If no experiment data, create a placeholder
        if (!experimentData || experimentData.length === 0) {
            experimentData = [{
                trialIndex: 0,
                note: 'No experimental data collected - experiment may not have been completed',
                timestamp: new Date().toISOString()
            }];
        }

        // Ensure participant metadata present on each row for remote builder
        try {
            var pid = gameData.participantId || (window.DataRecording && window.DataRecording.getParticipantId && window.DataRecording.getParticipantId()) || '';
            var pdob = gameData.participantDob || (window.DataRecording && window.DataRecording.getParticipantDob && window.DataRecording.getParticipantDob()) || '';
            experimentData = experimentData.map(function(trial) {
                var copy = Object.assign({}, trial);
                if (!copy.participantId) copy.participantId = pid;
                copy.participantDob = pdob;
                copy.participantAgeReferenceDate = gameData.participantAgeReferenceDate || '';
                copy.participantAgeYears = gameData.participantAgeYears == null ? '' : gameData.participantAgeYears;
                copy.participantAgeMonths = gameData.participantAgeMonths == null ? '' : gameData.participantAgeMonths;
                copy.participantAgeDays = gameData.participantAgeDays == null ? '' : gameData.participantAgeDays;
                copy.participantAgeTotalDays = gameData.participantAgeTotalDays == null ? '' : gameData.participantAgeTotalDays;
                Object.assign(copy, getAIConditionExportFields());
                return copy;
            });
        } catch (e) {
            console.warn('Could not annotate experiment data with participant metadata:', e);
        }

        // Convert questionnaire data to array format
        const questionnaireArray = convertQuestionnaireToArray(gameData.questionnaireData);

        // Create Excel file to send to Google Drive
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const participantId = gameData.participantId || 'unknown_participant';
        const safeParticipantId = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const excelFilename = `experiment_data_${safeParticipantId}_${timestamp}.xlsx`;

        sendExcelToGoogleDrive(experimentData, questionnaireArray, excelFilename);

    } catch (error) {
        console.error('Error in saveDataToGoogleDrive:', error);
        alert('Error saving data to Google Drive. Please try again.');
    }
}

/**
 * Show completion stage
 */
function showCompletionStage(stage) {
    var container = document.getElementById('container');
    var successRate = calculateSuccessRate();

    // Calculate results by experiment type
    var resultsByExperiment = {};
    NODEGAME_CONFIG.experimentOrder.forEach(expType => {
        var expTrials = gameData.allTrialsData.filter(trial => trial.experimentType === expType);
        var expSuccessful = expTrials.filter(trial => trial.completed || trial.collaborationSucceeded).length;
        resultsByExperiment[expType] = {
            completed: expTrials.length,
            successful: expSuccessful,
            successRate: expTrials.length > 0 ? Math.round((expSuccessful / expTrials.length) * 100) : 0
        };
    });

    var experimentResultsHTML = NODEGAME_CONFIG.experimentOrder.map(expType => {
        var result = resultsByExperiment[expType];
        return `
            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #007bff;">
                <strong>${expType}:</strong> ${result.successful}/${result.completed} trials successful (${result.successRate}%)
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 700px; text-align: center;">
                <h2 style="color: green; margin-bottom: 30px;">🎉 All Experiments Complete!</h2>
                <div style="margin-bottom: 30px;">
                    <p style="font-size: 18px; margin-bottom: 20px;"><strong>Total Trials Completed:</strong> ${gameData.allTrialsData.length}</p>
                    <p style="font-size: 18px; margin-bottom: 20px;"><strong>Overall Success Rate:</strong> ${successRate}%</p>

                    <h3 style="margin-bottom: 15px; color: #333;">Results by Experiment:</h3>
                    <div style="text-align: left;">
                        ${experimentResultsHTML}
                    </div>
                </div>
                <div>
                    <button onclick="exportExperimentData()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 10px;
                    ">📥 Download Data</button>
                    <button onclick="location.reload()" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin: 10px;
                    ">🔄 Run Another Session</button>
                </div>
                ${gameData.questionnaireData ? '<p style="color: #28a745; margin-top: 20px;">✅ Questionnaire data collected and included in export</p>' : ''}
            </div>
        </div>
    `;
}

/**
 * Get welcome message for experiment type
 */
function getInstructionsForExperiment(experimentType) {
    switch (experimentType) {
        case '1P1G':
            return `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                    <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                        <h2 style="color: #333; margin-bottom: 30px; font-size: 36px;">Game 1</h2>
                        <h3 style="color: #000; margin-bottom: 20px; font-size: 24px;">Before we begin, let's practice a few rounds!</h3>
                        <div style="background: #e8f5e8; border: 1px solid #c3e6cb; border-radius: 8px; padding: 28px; margin-bottom: 30px;">
                            <ul style="font-size: 22px; color: #155724; margin-bottom: 15px; line-height: 1.6; text-align: left; padding-left: 20px;">
                                <li>You are the traveler <span style="display: inline-block; width: 20px; height: 20px; background-color: red; border-radius: 50%; vertical-align: middle; margin: 0 4px;"></span>.</li>
                                <li>There is one restaurant <span style="display: inline-block; width: 20px; height: 20px; background-color: #007bff; border-radius: 3px; vertical-align: middle; margin: 0 4px;"></span> on the map.</li>
                                <li>Use the arrow keys (↑↓←→) to reach a restaurant.</li>
                            </ul>
                        </div>
                        <p style="font-size: 22px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
                    </div>
                </div>
            `;
        case '1P2G':
            return `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                    <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                        <h2 style="color: #333; margin-bottom: 30px; font-size: 36px;">Game 2</h2>
                        <h3 style="color: #000; margin-bottom: 20px; font-size: 24px;">Great job!</h3>
                        <div style="background: #e8f5e8; border: 1px solid #c3e6cb; border-radius: 8px; padding: 28px; margin-bottom: 30px;">
                            <p style="font-size: 22px; color: #155724; margin-bottom: 15px; line-height: 1.6; text-align: left;">
                                Now there will be several identical restaurants on the map.
                            </p>
                            <ul style="font-size: 22px; color: #155724; margin-bottom: 15px; line-height: 1.6; text-align: left; padding-left: 20px;">
                                <li>Each round, you can <strong>win</strong> by getting to one of the restaurants.</li>
                                <li>Note that some restaurants are already open when the round starts. Others may appear later.</li>
                                <li>For each round that you win, you earn an additional 10 points.</li>
                            </ul>
                        </div>
                        <p style="font-size: 22px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
                    </div>
                </div>
            `;
        case '2P2G':
            return `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8f9fa; overflow: hidden;">
                    <div style="background: white; padding: 24px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 900px; text-align: center; width: 92%; max-height: 92vh;">
                        <h2 style="color: #333; margin-bottom: 16px; font-size: 32px;">Game 3</h2>
                        <h3 style="color: #000; margin-bottom: 12px; font-size: 20px;">Well done!</h3>
                        <div style="background: #e8f5e8; border: 1px solid #c3e6cb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                            <p style="font-size: 18px; color: #155724; margin-bottom: 12px; line-height: 1.5; text-align: left;">
                                Let's continue. In this new game, you will collaborate with another player.
                            </p>

                            <!-- Demo Map Figure (moved directly after intro sentence) -->
                            <div style="background: #f8f9fa; border: 2px solid #007bff; border-radius: 10px; padding: 16px; margin: 12px 0 16px 0;">
                                <h4 style="color: #007bff; margin-bottom: 12px; font-size: 18px;">Example Map:</h4>

                                <!-- Grid Demo -->
                                <div style="display: flex; justify-content: center; margin-bottom: 12px;">
                                    <div class="example-grid" style="display: grid; grid-template-columns: repeat(5, 30px); grid-template-rows: repeat(5, 30px); gap: 2px; border: 2px solid #333; padding: 6px; background: white; border-radius: 8px;">
                                        <!-- Row 1 -->
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #007bff; border: 1px solid #ddd; border-radius: 3px; position: relative;">
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #007bff; border-radius: 3px;"></div>
                                        </div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                                        <!-- Row 2 -->
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                                        <!-- Row 3 -->
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: red; border: 1px solid #ddd; border-radius: 50%; position: relative;">
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: red; border-radius: 50%;"></div>
                                        </div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: orange; border: 1px solid #ddd; border-radius: 50%; position: relative;">
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: orange; border-radius: 50%;"></div>
                                        </div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                                        <!-- Row 4 -->
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>

                                        <!-- Row 5 -->
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #007bff; border: 1px solid #ddd; border-radius: 3px; position: relative;">
                                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 14px; height: 14px; background: #007bff; border-radius: 3px;"></div>
                                        </div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                        <div style="background: #f8f9fa; border: 1px solid #ddd;"></div>
                                    </div>
                                </div>

                                <!-- Legend -->
                                <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; font-size: 14px; color: #333;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 14px; height: 14px; background: red; border-radius: 50%;"></div>
                                        <span>You (Player 1)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 14px; height: 14px; background: orange; border-radius: 50%;"></div>
                                        <span>Other Player (Player 2)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 14px; height: 14px; background: #007bff; border-radius: 3px;"></div>
                                        <span>Restaurant</span>
                                    </div>
                                </div>
                            </div>

                            <ul style="font-size: 18px; color: #155724; margin-bottom: 8px; line-height: 1.5; text-align: left; padding-left: 20px;">
                                <li>Each round, you can <strong>win</strong> if both of you go to the <strong>same</strong> restaurant.</li>
                                <li>You lose the round if you end up at different restaurants.</li>
                                <li>For each round that you win, you earn an additional 10 points.</li>
                            </ul>
                        </div>

                        <p style="font-size: 18px; margin-top: 8px;">Press <strong>space bar</strong> to begin.</p>

                        <style>
                            /* Shrink content on short viewports to avoid scroll */
                            @media (max-height: 820px) {
                                #container h2 { font-size: 28px !important; margin-bottom: 12px !important; }
                                #container h3 { font-size: 18px !important; margin-bottom: 10px !important; }
                                #container p, #container li { font-size: 16px !important; }
                            }
                            @media (max-height: 720px) {
                                #container h2 { font-size: 26px !important; }
                                #container h3 { font-size: 16px !important; }
                                #container p, #container li { font-size: 15px !important; }
                                #container .example-grid { transform: scale(0.9); transform-origin: center top; }
                            }
                            @media (max-height: 650px) {
                                #container .example-grid { transform: scale(0.8); }
                            }
                        </style>
                    </div>
                </div>
            `;
        case '2P3G':
            return `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                    <div style="background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 800px; text-align: center;">
                        <h2 style="color: #333; margin-bottom: 30px; font-size: 36px;">Game 4</h2>
                        <h3 style="color: #000; margin-bottom: 20px; font-size: 24px;">Good job!</h3>
                        <div style="background: #e8f5e8; border: 1px solid #c3e6cb; border-radius: 8px; padding: 28px; margin-bottom: 30px;">
                            <p style="font-size: 22px; color: #155724; margin-bottom: 15px; line-height: 1.6; text-align: left;">
                                Now, let's start the final game! You will collaborate with the same player as before.
                            </p>
                            <ul style="font-size: 22px; color: #155724; margin-bottom: 15px; line-height: 1.6; text-align: left; padding-left: 20px;">
                                <li>Each round, you can <strong> win </strong> if both of you go to the <strong> same </strong> restaurant.</li>
                                <li>You lose the round if you end up at different restaurants.</li>
                                <li> <strong> Note that some restaurants are already open when the round starts. Others may appear later.</strong></li>
                                <li>For each round that you win, you earn an additional 10 points.</li>
                            </ul>
                        </div>
                        <p style="font-size: 22px; margin-top: 30px;">Press <strong>space bar</strong> to begin.</p>
                    </div>
                </div>
            `;
        default:
            return '<p style="font-size: 36px; line-height: 1.4;">Welcome to the task. Press space bar to begin.</p>';
    }
}


/**
 * Show waiting for partner stage (unified for both human-AI and human-human versions)
 * This shows a waiting screen and either:
 * - For human-human: Actually connects to find a real partner
 * - For human-AI: Simulates waiting and then prompts for space bar to start
 */
function showWaitingForPartnerStage(stage) {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #333; margin-bottom: 30px;">Finding another player ...</h1>

                <div style="margin: 40px 0;">
                    <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                </div>

                <div style="font-size: 18px; color: #666; margin-bottom: 20px;">
                    <p>Please wait while we match you with another player.</p>
                    <p>This usually takes just a few moments...</p>
                </div>

                <div id="waitingStatus" style="font-size: 16px; color: #007bff; margin-bottom: 30px;">
                    Connecting to matching service...
                </div>

                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                        <strong>Tip:</strong> Keep this window open and active. You'll automatically proceed once a partner is found.
                    </p>
                </div>

                <div id="cancelButtonContainer" style="display: none;">
                    <button onclick="handleWaitingCancel()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; font-size: 14px; border-radius: 5px; cursor: pointer;">
                        Cancel and Exit
                    </button>
                </div>
            </div>
        </div>

        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    // Check if this is human-human mode (socket.io available) or human-AI mode (simulated)
    const isHumanHumanMode = typeof io !== 'undefined';

    if (isHumanHumanMode) {
        // Human-human mode: Actually try to connect to multiplayer
        console.log('Human-human mode detected: Attempting real multiplayer connection');

        // Show cancel button for human-human mode
        const cancelButtonContainer = document.getElementById('cancelButtonContainer');
        if (cancelButtonContainer) {
            cancelButtonContainer.style.display = 'block';
        }

        // Make cancel function globally available
        window.handleWaitingCancel = function () {
            if (window.socket) {
                window.socket.disconnect();
            }
            window.close();
        };

        // Try to join multiplayer room
        setTimeout(() => {
            // Set the experiment type from the stage before joining
            if (stage && stage.experimentType) {
                console.log('🎮 Setting experiment type from stage:', stage.experimentType);
                if (typeof gameData !== 'undefined') {
                    gameData.currentExperiment = stage.experimentType;
                    gameData.currentExperimentIndex = stage.experimentIndex;
                }
                if (typeof window.gameData !== 'undefined') {
                    window.gameData.currentExperiment = stage.experimentType;
                    window.gameData.currentExperimentIndex = stage.experimentIndex;
                }
            }

            // Initialize socket if not already done
            if (typeof window.NetworkingHumanHuman !== 'undefined' && window.NetworkingHumanHuman.initializeSocket) {
                window.NetworkingHumanHuman.initializeSocket();
            }

            // Access the global joinMultiplayerRoom function if available
            if (typeof window.NetworkingHumanHuman !== 'undefined' && window.NetworkingHumanHuman.joinMultiplayerRoom) {
                updateWaitingStatus('Looking for another player...');
                window.NetworkingHumanHuman.joinMultiplayerRoom();
            } else if (typeof joinMultiplayerRoom === 'function') {
                updateWaitingStatus('Looking for another player...');
                joinMultiplayerRoom();
            } else {
                console.warn('joinMultiplayerRoom function not available');
                updateWaitingStatus('Connection failed. Please refresh the page.');
            }
        }, 1000); // Wait a moment for socket to be ready

        // Note: For human-human mode, the advancement to next stage is handled by
        // socket events (game_started, room_full, etc.) rather than a timer

    } else {
        // Human-AI mode: Simulate waiting process
        console.log('Human-AI mode detected: Simulating partner matching');

        // Simulate waiting process with status updates
        const statusMessages = [
            'Connecting to matching service...',
            'Looking for another participant...',
            'Found a participant!',
            'Establishing connection...',
            'Connection established!'
        ];

        let messageIndex = 0;
        const statusElement = document.getElementById('waitingStatus');

        const updateStatus = () => {
            if (statusElement && messageIndex < statusMessages.length) {
                statusElement.textContent = statusMessages[messageIndex];
                messageIndex++;
            }
        };

        // Update status every 2 seconds
        const statusInterval = setInterval(updateStatus, 2000);

        // After configured duration, show "Game is ready" message and wait for space bar
        setTimeout(() => {
            clearInterval(statusInterval);

            // Update the display to show "Game is ready" message
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
                    <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                        <h1 style="color: #28a745; margin-bottom: 30px;">✅ Game is Ready!</h1>

                        <div style="margin: 40px 0;">
                            <div style="width: 80px; height: 80px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                                </svg>
                            </div>
                        </div>

                        <div style="font-size: 20px; color: #333; margin-bottom: 20px;">
                            <p><strong>Another player found and connection established!</strong></p>
                            <p>The game is ready to begin.</p>
                        </div>

                        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                            <p style="margin: 0; font-size: 16px; color: #155724;">
                                <strong>Press the space bar to start the game.</strong>
                            </p>
                        </div>

                        <div style="margin-top: 20px; font-size: 18px; color: #333;">
                            <div style="display: flex; justify-content: center; gap: 32px; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span>You are player</span>
                                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block; vertical-align: middle;">
                                        <circle cx="12" cy="12" r="10" fill="red" stroke="red" stroke-width="2"></circle>
                                    </svg>
                                </div>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span>The other player</span>
                                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block; vertical-align: middle;">
                                        <circle cx="12" cy="12" r="10" fill="orange" stroke="orange" stroke-width="2"></circle>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add event listener for space bar to continue
            function handleSpacebar(event) {
                if (event.code === 'Space' || event.key === ' ') {
                    event.preventDefault();
                    document.removeEventListener('keydown', handleSpacebar);
                    nextStage();
                }
            }

            document.addEventListener('keydown', handleSpacebar);
            document.body.focus();

        }, NODEGAME_CONFIG.timing.waitingForPartnerDuration);
    }
}

/**
 * Update waiting status message
 */
function updateWaitingStatus(message) {
    const statusElement = document.getElementById('waitingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Show connection lost message and provide reconnection option
 */
function showConnectionLostMessage() {
    const messagesEl = document.getElementById('trialMessages');
    if (messagesEl) {
        messagesEl.innerHTML = `
            <div style="color: #dc3545; padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                <strong>Connection Lost</strong><br>
                Your connection to the server has been lost.
                <div style="margin-top: 10px;">
                    <button onclick="attemptReconnection()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                        Reconnect
                    </button>
                    <button onclick="location.reload()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    } else {
        // Fallback if trialMessages element doesn't exist
        console.warn('Connection lost but no trialMessages element found');
        if (confirm('Connection lost. Would you like to reconnect?')) {
            attemptReconnection();
        }
    }
}
/**
 * Show "Game is ready" message and wait for space bar to start
 */
function showGameReadyMessage() {
    const container = document.getElementById('container');
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="max-width: 600px; margin: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; text-align: center;">
                <h1 style="color: #28a745; margin-bottom: 30px;">✅ Game is Ready!</h1>

                <div style="margin: 40px 0;">
                    <div style="width: 80px; height: 80px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="white"/>
                        </svg>
                    </div>
                </div>

                <div style="font-size: 20px; color: #333; margin-bottom: 20px;">
                    <p><strong>Partner found and connection established!</strong></p>
                    <p>The game is ready to begin.</p>
                </div>

                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 16px; color: #155724;">
                        <strong>Press the space bar to start the game.</strong>
                    </p>
                </div>

                <div style="margin-top: 20px; font-size: 18px; color: #333;">
                    <div style="display: flex; justify-content: center; gap: 32px; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span>You are player</span>
                            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block; vertical-align: middle;">
                                <circle cx="12" cy="12" r="10" fill="red" stroke="red" stroke-width="2"></circle>
                            </svg>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span>The other player</span>
                            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block; vertical-align: middle;">
                                <circle cx="12" cy="12" r="10" fill="orange" stroke="orange" stroke-width="2"></circle>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listener for space bar to continue
    function handleSpacebar(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            document.removeEventListener('keydown', handleSpacebar);

            // Send player_ready event to server
            if (socket) {
                console.log('Sending player_ready event from showGameReadyMessage');
                socket.emit('player_ready', {});
            }

            nextStage();
        }
    }

    document.addEventListener('keydown', handleSpacebar);
    document.body.focus();
}

// =================================================================================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE FOR NON-MODULE SCRIPTS
// =================================================================================================

// Make createTimelineStages available globally
window.createTimelineStages = createTimelineStages;

// Make other important functions available globally
window.showCompletionStage = showCompletionStage;
window.showQuestionnaireStage = showQuestionnaireStage;
window.showGameFeedbackStage = showGameFeedbackStage;
window.showEndExperimentInfoStage = showEndExperimentInfoStage;
window.showProlificRedirectStage = showProlificRedirectStage;
window.showWaitingForPartnerStage = showWaitingForPartnerStage;
window.updateWaitingStatus = updateWaitingStatus;
window.showGameReadyMessage = showGameReadyMessage;
window.showConnectionLostMessage = showConnectionLostMessage;
window.exportExperimentData = exportExperimentData;
window.assignAIConditionForParticipant = assignAIConditionForParticipant;
window.completeAssignedAIConditionAssignment = completeAssignedAIConditionAssignment;
window.getAIConditionExportFields = getAIConditionExportFields;

// Make timeline navigation functions available globally
window.nextStage = function() {
    timeline.currentStage++;
    if (timeline.currentStage < timeline.stages.length) {
        var stage = timeline.stages[timeline.currentStage];
        console.log(`Moving to stage ${timeline.currentStage}: ${stage.type}`);
        stage.handler(stage);
    } else {
        console.log('Timeline complete');
    }
};

/**
 * Export experiment data as JSON file
 */
function exportExperimentData() {
    try {
        var aiConditionFields = getAIConditionExportFields();

        // Prepare experiment data
        const experimentData = {
            participantId: gameData.participantId || `participant_${Date.now()}`,
            participantDob: gameData.participantDob || '',
            participantAgeReferenceDate: gameData.participantAgeReferenceDate || '',
            participantAgeYears: gameData.participantAgeYears == null ? '' : gameData.participantAgeYears,
            participantAgeMonths: gameData.participantAgeMonths == null ? '' : gameData.participantAgeMonths,
            participantAgeDays: gameData.participantAgeDays == null ? '' : gameData.participantAgeDays,
            participantAgeTotalDays: gameData.participantAgeTotalDays == null ? '' : gameData.participantAgeTotalDays,
            assignedAICondition: aiConditionFields.assignedAICondition,
            assignedAIConditionLabel: aiConditionFields.assignedAIConditionLabel,
            assignedAIRLAgentType: aiConditionFields.assignedAIRLAgentType,
            assignedAIAnalysisCode: aiConditionFields.assignedAIAnalysisCode,
            aiConditionAssignmentId: aiConditionFields.aiConditionAssignmentId,
            aiConditionAssignmentStatus: aiConditionFields.aiConditionAssignmentStatus,
            aiConditionAssignmentSource: aiConditionFields.aiConditionAssignmentSource,
            aiConditionAssignmentStrategy: aiConditionFields.aiConditionAssignmentStrategy,
            aiConditionQuotaVersion: aiConditionFields.aiConditionQuotaVersion,
            aiConditionAgeGroup: aiConditionFields.aiConditionAgeGroup,
            aiConditionAssignment: window.NodeGameConfig && window.NodeGameConfig.getAssignedAIConditionMetadata
                ? window.NodeGameConfig.getAssignedAIConditionMetadata()
                : null,
            timestamp: new Date().toISOString(),
            experimentOrder: NODEGAME_CONFIG.experimentOrder,
            allTrialsData: gameData.allTrialsData || [],
            questionnaireData: gameData.questionnaireData || null,
            successThreshold: gameData.successThreshold || {},
            completionCode: NODEGAME_CONFIG.prolificCompletionCode,
            version: NODEGAME_CONFIG.version,
            experimentType: 'human-AI'
        };

        // Create and download JSON file
        const blob = new Blob([JSON.stringify(experimentData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Generate safe filename
        const participantId = experimentData.participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `experiment_data_${participantId}_${new Date().toISOString().slice(0, 10)}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Experiment data exported successfully:', filename);
        alert('Data exported successfully!');
    } catch (error) {
        console.error('Error exporting experiment data:', error);
        alert('Error exporting data: ' + error.message);
    }
}

/**
 * Show game feedback stage
 */
function showGameFeedbackStage(stage) {
    console.log('🎮 Game Feedback Stage: Starting...');
    var container = document.getElementById('container');

    // Calculate metrics
    var totalTrials = gameData.allTrialsData.length;
    var successRate = calculateSuccessRate();

    // Calculate total time in minutes
    var totalTimeMinutes = 0;
    if (gameData.allTrialsData.length > 0) {
        var firstTrialStart = gameData.allTrialsData[0].trialStartTime;
        var lastTrialEnd = gameData.allTrialsData[gameData.allTrialsData.length - 1].trialEndTime;
        var totalTimeMs = lastTrialEnd - firstTrialStart;
        totalTimeMinutes = Math.round(totalTimeMs / (1000 * 60));
    }

    // Calculate different success rates and counts (always render 4 metrics)
    var singlePlayerTrials = gameData.allTrialsData.filter(trial =>
        trial.experimentType && trial.experimentType.includes('1P')
    );
    var collaborationTrials = gameData.allTrialsData.filter(trial =>
        trial.experimentType && trial.experimentType.includes('2P')
    );
    var singleCount = singlePlayerTrials.length;
    var collabCount = collaborationTrials.length;
    var successfulSinglePlayer = singlePlayerTrials.filter(trial => trial.completed === true).length;
    var successfulCollaborations = collaborationTrials.filter(trial => trial.collaborationSucceeded === true).length;
    var singlePlayerSuccessRate = singleCount ? Math.round((successfulSinglePlayer / singleCount) * 100) : null;
    var collaborationSuccessRate = collabCount ? Math.round((successfulCollaborations / collabCount) * 100) : null;
    var singleRateDisplay = singlePlayerSuccessRate === null ? '—' : singlePlayerSuccessRate + '%';
    var collabRateDisplay = collaborationSuccessRate === null ? '—' : collaborationSuccessRate + '%';

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f9fa;">
            <div style="background: white; padding: 10px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 1100px; width: 100%; text-align: center;">
                <h2 style="color: #333; margin-bottom: 5px;">🎮 Game Performance Summary</h2>

                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                    <h3 style="color: #666; margin-bottom: 10px; font-size: 16px;">Your Results</h3>

                    <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; align-items: stretch;">
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                            <h4 style="color: #007bff; margin-bottom: 5px; font-size: 14px;">📊 Total Trials</h4>
                            <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0;">${totalTrials}</p>
                        </div>

                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #28a745;">
                            <h4 style="color: #28a745; margin-bottom: 5px; font-size: 14px;">⏱️ Total Time</h4>
                            <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0;">${totalTimeMinutes} min</p>
                        </div>

                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <h4 style="color: #ffc107; margin-bottom: 5px; font-size: 14px;">🎯 Single Player Success</h4>
                            <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0;">${singleRateDisplay}</p>
                            <p style="font-size: 12px; color: #666; margin: 2px 0 0 0;">(${singleCount} single player trials)</p>
                        </div>

                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #dc3545;">
                            <h4 style="color: #dc3545; margin-bottom: 5px; font-size: 14px;">🤝 Collaboration Success</h4>
                            <p style="font-size: 20px; font-weight: bold; color: #333; margin: 0;">${collabRateDisplay}</p>
                            <p style="font-size: 12px; color: #666; margin: 2px 0 0 0;">(${collabCount} collaboration trials)</p>
                        </div>
                    </div>
                </div>

                <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 8px; padding: 15px; margin-bottom: 5px;">
                    <h3 style="color: #28a745; margin-bottom: 8px; font-size: 16px;">📝 Almost Done!</h3>
                    <p style="font-size: 16px; color: #333; margin-bottom: 8px;">
                        Thank you for completing the game! We just have few more questions for you to answer!
                    </p>
                </div>

                <div style="text-align: center;">
                    <button id="continueToQuestionnaireBtn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 12px 25px;
                        font-size: 16px;
                        border-radius: 8px;
                        cursor: pointer;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                        Press the space bar to continue!
                    </button>
                </div>
            </div>
        </div>
    `;

        // Handle button click to continue to questionnaire
    document.getElementById('continueToQuestionnaireBtn').addEventListener('click', function() {
        console.log('🎮 Game Feedback Stage: Continue button clicked');
        // Ensure any lingering key handlers from this stage are removed
        try {
            document.removeEventListener('keydown', handleFeedbackSpace);
        } catch (e) {
            // no-op
        }
        // Add questionnaire stage to timeline if it doesn't exist
        var hasQuestionnaireStage = timeline.stages.some(stage => stage.type === 'questionnaire');
        if (!hasQuestionnaireStage) {
            console.log('🎮 Game Feedback Stage: Adding questionnaire stage to timeline');
            timeline.stages.push({
                type: 'questionnaire',
                handler: showQuestionnaireStage
            });
        }

        // Proceed to next stage (which should be the questionnaire)
        console.log('🎮 Game Feedback Stage: Proceeding to next stage');
        nextStage();
    });

    // Allow pressing Space to continue
    function handleFeedbackSpace(e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            document.removeEventListener('keydown', handleFeedbackSpace);
            // Add questionnaire stage if missing
            var hasQuestionnaireStage = timeline.stages.some(stage => stage.type === 'questionnaire');
            if (!hasQuestionnaireStage) {
                timeline.stages.push({ type: 'questionnaire', handler: showQuestionnaireStage });
            }
            nextStage();
        }
    }
    document.addEventListener('keydown', handleFeedbackSpace);

    console.log('🎮 Game Feedback Stage: Setup complete');
}

/**
 * Create unified trial feedback overlay
 * @param {HTMLElement} canvasContainer - Container to append overlay to
 * @param {boolean} success - Whether the trial was successful
 * @param {string} messageType - Type of feedback: 'single' or 'collaboration'
 * @param {number} duration - How long to show overlay (optional, defaults to not auto-remove)
 * @returns {HTMLElement} - The created overlay element
 */
function createTrialFeedbackOverlay(canvasContainer, success, messageType, duration = null) {
    if (!canvasContainer) {
        console.warn('No canvas container provided for trial feedback overlay');
        return null;
    }

    // Validate messageType
    if (messageType !== 'single' && messageType !== 'collaboration') {
        console.warn('Invalid messageType. Must be "single" or "collaboration"');
        return null;
    }

    // Create visual feedback based on success
    let visualFeedback;
    if (success) {
        // Smile face for success
        visualFeedback = `
            <div style="display: flex; justify-content: center; margin: 30px 0;">
                <div style="
                    width: 120px;
                    height: 120px;
                    background-color: #28a745;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                ">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12,1A11,11,0,1,0,23,12,11.013,11.013,0,0,0,12,1Zm0,20a9,9,0,1,1,9-9A9.011,9.011,0,0,1,12,21Zm6-8A6,6,0,0,1,6,13a1,1,0,0,1,2,0,4,4,0,0,0,8,0,1,1,0,0,1,2,0ZM8,10V9a1,1,0,0,1,2,0v1a1,1,0,0,1-2,0Zm6,0V9a1,1,0,0,1,2,0v1a1,1,0,0,1-2,0Z" fill="white"/>
                    </svg>
                </div>
            </div>
        `;
    } else {
        // Sad face for failure
        visualFeedback = `
            <div style="display: flex; justify-content: center; margin: 30px 0;">
                <div style="
                    width: 120px;
                    height: 120px;
                    background-color: #dc3545;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                ">
                    <svg width="80" height="80" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.5 10c.277 0 .5.223.5.5v3c0 .277-.223.5-.5.5s-.5-.223-.5-.5v-3c0-.277.223-.5.5-.5zm-9 0c.277 0 .5.223.5.5v3c0 .277-.223.5-.5.5s-.5-.223-.5-.5v-3c0-.277.223-.5.5-.5zM15 20c-2.104 0-4.186.756-5.798 2.104-.542.4.148 1.223.638.76C11.268 21.67 13.137 21 15 21s3.732.67 5.16 1.864c.478.45 1.176-.364.638-.76C19.186 20.756 17.104 20 15 20zm0-20C6.722 0 0 6.722 0 15c0 8.278 6.722 15 15 15 8.278 0 15-6.722 15-15 0-8.278-6.722-15-15-15zm0 1c7.738 0 14 6.262 14 14s-6.262 14-14 14S1 22.738 1 15 7.262 1 15 1z" fill="white"/>
                    </svg>
                </div>
            </div>
        `;
    }

    // Determine message based on messageType
    let message;
    if (messageType === 'single') {
        message = success ? 'Goal reached!' : 'Time up!';
    } else if (messageType === 'collaboration') {
        message = success ? 'Collaboration succeeded!' : 'Collaboration failed!';
    }

    // Create overlay div positioned absolutely over the canvas
    const overlay = document.createElement('div');
    overlay.innerHTML = `
        <div style="
            text-align: center;
            background: rgba(255, 255, 255, 0.95);
            border: 3px solid ${success ? '#28a745' : '#dc3545'};
            border-radius: 15px;
            padding: 30px 40px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(5px);
        ">
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 20px; color: ${success ? '#28a745' : '#dc3545'};">
                ${message}
            </div>
            ${visualFeedback}
        </div>
    `;
    overlay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1000;
        pointer-events: none;
        width: auto;
        height: auto;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Add overlay to canvas container
    canvasContainer.appendChild(overlay);

    // Auto-remove after duration if specified
    if (duration && duration > 0) {
        setTimeout(() => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, duration);
    }

    return overlay;
}

/**
 * Show movement instructions (restore them after waiting phase)
 */
function showMovementInstructions() {
    var movementInstructions = document.querySelector('p[style*="font-size: 20px"]');
    if (movementInstructions && movementInstructions.textContent.includes('Press ↑ ↓ ← → to move')) {
        movementInstructions.style.display = 'block';
    }
}
