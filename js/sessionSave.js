/* Durable kid-session checkpoints. No participant data or write tokens are logged. */
(function () {
    'use strict';
    var PREFIX = 'kid-session-v1:';
    var ACTIVE = 'kid-session-v1-active';
    var record = null, sending = null, storageError = null;
    function clone(value) { return JSON.parse(JSON.stringify(value)); }
    function token() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join(''); }
    function persist() {
        try {
            localStorage.setItem(PREFIX + record.sessionId, JSON.stringify(record));
            localStorage.setItem(ACTIVE, record.sessionId);
            storageError = null;
            return true;
        } catch (e) { storageError = e; return false; }
    }
    function status() {
        if (!record) return;
        var node = document.getElementById('sessionSaveStatus');
        if (!node) {
            node = document.createElement('div'); node.id = 'sessionSaveStatus';
            node.style.cssText = 'position:fixed;bottom:0;left:0;background:white;padding:6px 12px;font:13px sans-serif;z-index:10000';
            node.setAttribute('role', 'status'); document.body.appendChild(node);
        }
        node.textContent = storageError ? 'Local backup unavailable. Keep this page open and download a backup. ' :
            record.ackRevision >= record.revision ? 'Saved on this device and Google Drive. ' :
            'Saved on this device. Google Drive update pending; reconnect to sync. ';
        var button = document.createElement('button'); button.textContent = 'Download backup';
        button.onclick = downloadBackup; node.appendChild(button);
    }
    function snapshot() {
        return {
            gameData: clone(gameData), stage: timeline.currentStage,
            stages: timeline.stages.map(s => Object.assign({}, s, { handler: s.handler.name })),
            mapData: clone(timeline.mapData),
            one: clone(ONEP2G_CONFIG), two: clone(TWOP3G_CONFIG)
        };
    }
    function backup(stageOverride) {
        if (!record) return;
        record.snapshot = snapshot();
        if (stageOverride != null) record.snapshot.stage = stageOverride;
        var current = timeline.stages[timeline.currentStage];
        var last = gameData.allTrialsData[gameData.allTrialsData.length - 1];
        if (current && current.type === 'trial' && last && last.trialEndTime &&
            last.trialEndTime === gameData.currentTrialData.trialEndTime) record.snapshot.stage = timeline.currentStage + 1;
        persist(); status();
    }
    function begin() {
        if (record) return checkpoint('session_started');
        record = { schema: 1, sessionId: token(), writeToken: token(), revision: 0, ackRevision: 0,
            sessionStatus: 'in_progress', filenameLabel: ('kid_' + gameData.participantId).replace(/[^A-Za-z0-9@._+-]/g, '_').slice(0,254),
            interruptedTrials: [], createdAt: new Date().toISOString() };
        return checkpoint('session_started', timeline.currentStage + 1);
    }
    function checkpoint(reason, stageOverride) {
        if (!record) return Promise.resolve({ savedToDrive: false });
        record.revision++;
        if (reason === 'questionnaire_complete') record.sessionStatus = 'completed';
        record.reason = reason;
        record.updatedAt = new Date().toISOString();
        // Save raw data before workbook generation or any network request.
        record.pending = null;
        backup(stageOverride);
        try {
            var workbook = buildSessionWorkbook(gameData.allTrialsData, gameData.questionnaireData);
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
                ['sessionId','revision','status','checkpoint'],
                [record.sessionId,record.revision,record.sessionStatus,reason]
            ]), 'Session');
            if (record.interruptedTrials.length) XLSX.utils.book_append_sheet(workbook,
                XLSX.utils.aoa_to_sheet([['interruptedTrialJson'], ...record.interruptedTrials.map(t => [JSON.stringify(t)])]), 'Interrupted Trials');
            record.pending = { revision: record.revision, sessionStatus: record.sessionStatus,
                filedata: XLSX.write(workbook, {bookType:'xlsx',type:'base64',compression:true}) };
            persist(); status();
        } catch (e) { status(); return Promise.resolve({savedToDrive:false,error:e}); }
        return flush();
    }
    function flush() {
        if (sending) return sending;
        if (record && !record.pending) return checkpoint(record.reason || 'recovered', record.snapshot.stage);
        if (!record || !record.pending || record.ackRevision >= record.revision) return Promise.resolve({savedToDrive:!!record && record.ackRevision >= record.revision});
        sending = (async function () {
            var result;
            while (record.pending && record.ackRevision < record.revision) {
                var pending = clone(record.pending);
                result = await uploadWorkbookToGoogleDrive(null, null, {
                    session: record, revision: pending.revision, sessionStatus: pending.sessionStatus, filedata: pending.filedata
                });
                if (!result.savedToDrive) break;
                record.ackRevision = Math.max(record.ackRevision, pending.revision);
                record.fileId = result.fileId;
                persist(); status();
            }
            return result || {savedToDrive:false};
        })().finally(function () { sending = null; status(); });
        return sending;
    }
    function downloadBackup() {
        if (!record) return;
        var url = URL.createObjectURL(new Blob([JSON.stringify(record)], {type:'application/json'}));
        var a = document.createElement('a'); a.href = url; a.download = 'kid-backup-' + record.sessionId + '.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
    }
    function restore(saved) {
        if (!saved || saved.schema !== 1 || !/^[a-f0-9]{32}$/.test(saved.sessionId) || !/^[a-f0-9]{32}$/.test(saved.writeToken) || !saved.snapshot) throw new Error('Invalid backup');
        var handlers = Object.fromEntries(timeline.stages.map(s => [s.handler.name, s.handler]));
        var stages = saved.snapshot.stages.map(s => {
            if (!handlers[s.handler]) throw new Error('This backup requires a different game version.');
            return Object.assign({},s,{handler:handlers[s.handler]});
        });
        record = saved;
        Object.assign(gameData, clone(saved.snapshot.gameData));
        window.NodeGameConfig.setAssignedAICondition(gameData.assignedAICondition, gameData.aiConditionAssignment);
        window.DataRecording.setParticipantId(gameData.participantId);
        window.DataRecording.setParticipantDob(gameData.participantDob);
        Object.assign(ONEP2G_CONFIG,saved.snapshot.one); Object.assign(TWOP3G_CONFIG,saved.snapshot.two);
        timeline.stages = stages; timeline.mapData = saved.snapshot.mapData; timeline.currentStage = saved.snapshot.stage;
        var stage = stages[timeline.currentStage];
        if (stage && stage.type === 'trial') {
            record.interruptedTrials.push(clone(gameData.currentTrialData));
            // Restart this unfinished trial from fixation, preserving completed trials.
            timeline.currentStage = Math.max(0,timeline.currentStage - 1);
        }
        persist(); status();
        if (!record.pending) checkpoint(record.reason || 'recovered'); else flush();
        runNextStage();
    }
    function offerRecovery() {
        var saved, candidates = [];
        try {
            var id = localStorage.getItem(ACTIVE);
            saved = id && JSON.parse(localStorage.getItem(PREFIX + id));
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key.indexOf(PREFIX) !== 0) continue;
                try {
                    var candidate = JSON.parse(localStorage.getItem(key));
                    if (candidate && candidate.snapshot && (candidate.sessionStatus !== 'completed' || candidate.ackRevision < candidate.revision)) candidates.push(candidate);
                } catch (e) { /* Leave unreadable backups untouched. */ }
            }
            if (!saved || (saved.sessionStatus === 'completed' && saved.ackRevision >= saved.revision)) saved = candidates[0];
        } catch (e) { storageError = e; }
        if (!saved || (saved.sessionStatus === 'completed' && saved.ackRevision >= saved.revision)) return false;
        var container = document.getElementById('container'); container.innerHTML = '';
        var message = document.createElement('p');
        message.textContent = 'Saved session for ' + saved.snapshot.gameData.participantId + '. Resume to keep your completed rounds and sync pending data.';
        var resume = document.createElement('button'); resume.textContent = 'Resume saved session';
        resume.onclick = () => { try { restore(saved); } catch(e) { message.textContent = e.message; } };
        var fresh = document.createElement('button'); fresh.textContent = 'Start a new participant';
        fresh.onclick = () => { record=null; localStorage.removeItem(ACTIVE); runNextStage(); };
        var select = document.createElement('select'); select.setAttribute('aria-label','Saved sessions');
        candidates.forEach(candidate => {
            var option = document.createElement('option'); option.value = candidate.sessionId;
            option.textContent = candidate.snapshot.gameData.participantId + ' — ' + candidate.updatedAt;
            select.appendChild(option);
        });
        select.value = saved.sessionId;
        select.onchange = () => { saved = candidates.find(c => c.sessionId === select.value); message.textContent = 'Resume saved session for ' + saved.snapshot.gameData.participantId; };
        container.append(message,select,resume,fresh); attachImport(); return true;
    }
    function attachImport() {
        if (document.getElementById('sessionBackupImport')) return;
        var label = document.createElement('label'); label.textContent = 'Restore a downloaded session backup: ';
        var input = document.createElement('input'); input.type = 'file'; input.accept = '.json'; input.id = 'sessionBackupImport';
        input.onchange = () => { if (input.files[0]) importBackup(input.files[0]).catch(e => { label.append(document.createTextNode(' ' + e.message)); }); };
        label.appendChild(input); document.getElementById('container').appendChild(label);
    }
    function importBackup(file) {
        return file.text().then(text => restore(JSON.parse(text)));
    }
    window.KidSessionSave = { begin, checkpoint, backup, flush, offerRecovery, importBackup, downloadBackup,
        attachImport, locallySaved: () => !storageError, getRecord: () => record && clone(record) };
    window.addEventListener('online',flush);
    window.addEventListener('pagehide',() => backup());
    setInterval(() => { if (record && record.pending && record.ackRevision < record.revision) flush(); },15000);
})();
