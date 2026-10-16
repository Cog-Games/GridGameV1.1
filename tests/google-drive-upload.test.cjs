const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('js/expTimeline.js', 'utf8');
const transport = source.slice(source.indexOf('var googleDriveUploadSession = null;'), source.indexOf('// Keep failures visible'));
function harness(change = x => x) {
  const posts = [];
  const context = { crypto: webcrypto, Uint8Array, URLSearchParams, AbortController, setTimeout, clearTimeout,
    console: { error() {} }, gameData: { participantId: 'TEST_ONLY' },
    XLSX: { write: wb => wb.bytes }, fetch: async (url, options) => {
      if (options.method === 'GET') return { ok: true, json: async () => ({ protocol: 'cake-session-upsert-v1' }) };
      const p = Object.fromEntries(options.body); posts.push(p);
      return { ok: true, json: async () => change({ status: 'success', protocol: p.protocol,
        sessionId: p.sessionId, revision: Number(p.revision), storedRevision: Number(p.revision),
        fileName: p.filename, fileId: 'test-drive-file' }) };
    } };
  vm.createContext(context); vm.runInContext(transport, context);
  return { context, posts, upload: wb => context.uploadWorkbookToGoogleDrive(wb, 'test.xlsx') };
}
test('new protocol, stable identity, exact retry and changed revision', async () => {
  const h = harness();
  for (const bytes of ['first', 'first', 'changed']) assert.equal((await h.upload({ bytes })).savedToDrive, true);
  assert.deepEqual(h.posts.map(p => p.revision), ['1', '1', '2']);
  assert.equal(new Set(h.posts.map(p => p.sessionId)).size, 1);
  assert.equal(new Set(h.posts.map(p => p.writeToken)).size, 1);
  assert.match(h.posts[0].sessionId, /^[a-f0-9]{32}$/);
  assert.match(h.posts[0].writeToken, /^[a-f0-9]{32}$/);
  assert.equal(h.posts[0].sessionStatus, 'completed');
});
for (const [name, change] of Object.entries({
  'server error': a => ({ status: 'error', message: 'Invalid session upload' }),
  'wrong session': a => ({ ...a, sessionId: 'wrong' }),
  'wrong revision': a => ({ ...a, revision: 8 }),
  'stale stored revision': a => ({ ...a, storedRevision: 0 }),
  'missing file ID': a => ({ ...a, fileId: '' }),
  'wrong filename': a => ({ ...a, fileName: 'wrong.xlsx' }),
  'wrong protocol': a => ({ ...a, protocol: 'old' }),
  'empty acknowledgement': () => null
})) test('rejects ' + name, async () => assert.equal((await harness(change).upload({ bytes: 'data' })).savedToDrive, false));
test('rejects HTTP failure, opaque/CORS failure, invalid JSON and timeout', async () => {
  for (const fetchImpl of [
    async () => ({ ok: false, status: 500 }),
    async () => { throw new TypeError('Failed to fetch'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } }),
    async () => { throw new DOMException('aborted', 'AbortError'); }
  ]) {
    const h = harness(); h.context.fetch = fetchImpl;
    assert.equal((await h.upload({ bytes: 'data' })).savedToDrive, false);
  }
});
