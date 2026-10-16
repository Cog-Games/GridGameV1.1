// Deploy as a web app executing as the existing study owner.
// Enable the Advanced Drive service v3. Keep the existing folder private.
const STUDY_FOLDER_ID = '1N2Ko4FmapcRfLxP2OFVOF03M2K06AO_Z';
const KID_FOLDER_ID = '1ZfsdDJgtBYv6iZz7o4tDPVK0drrORYS8';
const WORKBOOK_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse_({ status: 'ready', protocol: 'cake-session-upsert-v1', kidFolderId: KID_FOLDER_ID });
}

function digest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const p = event.parameter || {};
    const sessionId = p.sessionId;
    const revision = Number(p.revision);
    if (p.protocol !== 'cake-session-upsert-v1' || !/^[a-f0-9]{32}$/.test(sessionId || '') ||
        !/^[a-f0-9]{32}$/.test(p.writeToken || '') || !Number.isSafeInteger(revision) || revision < 1 ||
        !['in_progress', 'completed'].includes(p.sessionStatus) || p.filetype !== 'excel') {
      throw new Error('Invalid session upload');
    }
    if (!p.filedata || p.filedata.length > 20000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(p.filedata)) throw new Error('Invalid workbook');
    const bytes = Utilities.base64Decode(p.filedata);
    if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error('Expected XLSX workbook');
    const filenameLabel = String(p.filenameLabel || '').trim().replace(/[^A-Za-z0-9@._+-]/g, '_').slice(0, 254);
    const isKid = p.studyId === 'kid-rl-sa' || filenameLabel.startsWith('kid_');
    const folderId = isKid ? KID_FOLDER_ID : STUDY_FOLDER_ID;
    const parentQuery = isKid ? `('${KID_FOLDER_ID}' in parents or '${STUDY_FOLDER_ID}' in parents)` : `'${STUDY_FOLDER_ID}' in parents`;
    const fileName = `cake_${filenameLabel ? filenameLabel + '_' : ''}${sessionId}.xlsx`;
    const tokenHash = digest_(p.writeToken);
    const contentHash = digest_(p.filedata);
    lock.waitLock(25000);
    // Metadata and bytes are written in the same Drive request. Retrying after a
    // lost response finds the existing file rather than creating another copy.
    const result = Drive.Files.list({
      q: `${parentQuery} and trashed = false and appProperties has { key='cakeSessionId' and value='${sessionId}' }`,
      fields: 'files(id,name,appProperties,parents),nextPageToken', pageSize: 2
    });
    if ((result.files || []).length > 1 || result.nextPageToken) throw new Error('Duplicate session files require review');
    let file = (result.files || [])[0];
    let storedRevision = revision;
    let disposition = 'created';
    if (file) {
      const previous = file.appProperties;
      if (previous.writeTokenHash !== tokenHash) throw new Error('Session write token mismatch');
      storedRevision = Number(previous.revision);
      if (!Number.isSafeInteger(storedRevision)) throw new Error('Invalid stored revision');
      if (revision === storedRevision && previous.contentHash !== contentHash) throw new Error('Revision content conflict');
      if (previous.sessionStatus === 'completed' && p.sessionStatus !== 'completed' && revision > storedRevision) throw new Error('Completed session cannot be reopened');
      disposition = revision < storedRevision ? 'superseded' : 'unchanged';
      if (isKid && !(file.parents || []).includes(KID_FOLDER_ID)) {
        if (!file.name.startsWith('cake_kid_')) throw new Error('Session study mismatch');
        file = Drive.Files.update({}, file.id, null, {
          addParents: KID_FOLDER_ID, removeParents: STUDY_FOLDER_ID, fields: 'id,name,appProperties,parents'
        });
      }
    }
    if (!file || revision > storedRevision) {
      const metadata = { name: fileName, mimeType: WORKBOOK_MIME, appProperties: {
        cakeSessionId: sessionId, revision: String(revision), writeTokenHash: tokenHash,
        contentHash, sessionStatus: p.sessionStatus
      } };
      const blob = Utilities.newBlob(bytes, WORKBOOK_MIME, fileName);
      if (file) {
        file = Drive.Files.update(metadata, file.id, blob, { fields: 'id,name,appProperties' });
        disposition = 'updated';
      } else {
        metadata.parents = [folderId];
        file = Drive.Files.create(metadata, blob, { fields: 'id,name,appProperties' });
      }
      storedRevision = revision;
    }
    return jsonResponse_({ status: 'success', protocol: 'cake-session-upsert-v1', sessionId,
      revision, storedRevision, disposition, fileId: file.id, fileName: file.name, folderId,
      savedAt: new Date().toISOString() });
  } catch (error) {
    return jsonResponse_({ status: 'error', message: String(error.message || error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// Manual, idempotent migration of kid workbooks only. Other studies are untouched.
function migrateKidWorkbooks() {
  var result = Drive.Files.list({q: "'" + STUDY_FOLDER_ID + "' in parents and trashed = false and name contains 'cake_kid_'", fields:"files(id,name,parents),nextPageToken",pageSize:1000});
  if (result.nextPageToken) throw new Error("Review additional pages before migration");
  var moved=0;
  (result.files || []).forEach(function(file) {
    if (!file.name.startsWith("cake_kid_") || !file.name.endsWith(".xlsx")) return;
    Drive.Files.update({},file.id,null,{addParents:KID_FOLDER_ID,removeParents:STUDY_FOLDER_ID,fields:"id,parents"});
    moved++;
  });
  console.log("Kid workbooks moved: " + moved);
}
