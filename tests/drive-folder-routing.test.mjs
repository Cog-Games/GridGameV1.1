import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const files = new Map();
let writes = 0, locked = false, failWrite = false;
const copy = value => JSON.parse(JSON.stringify(value));
const context = {
  ContentService: { MimeType: { JSON:'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  LockService: { getScriptLock: () => ({ waitLock() { assert(!locked); locked=true; }, hasLock: () => locked, releaseLock() { locked=false; } }) },
  Utilities: {
    DigestAlgorithm: { SHA_256:'sha256' }, Charset: { UTF_8:'utf8' },
    computeDigest: (algorithm,value) => [...crypto.createHash(algorithm).update(value).digest()],
    base64Decode: value => [...Buffer.from(value,'base64')],
    newBlob: (bytes,mime,name) => ({ bytes,mime,name })
  },
  Drive: { Files: {
    list(options) {
      assert(locked);
      const session = options.q.match(/value='([a-f0-9]+)'/)[1];
      return { files:[...files.values()].filter(f=>f.appProperties.cakeSessionId===session && f.parents.some(parent=>options.q.includes("'"+parent+"' in parents"))).map(copy) };
    },
    create(meta,blob) {
      if(failWrite) throw new Error('Disk unavailable');
      const file={...copy(meta),id:`file-${files.size+1}`,blob}; files.set(file.id,file); writes++; return copy(file);
    },
    update(meta,id,blob,options={}) {
      if(failWrite) throw new Error('Disk unavailable');
      const file={...files.get(id),...copy(meta),id,blob:blob || files.get(id).blob};
      if(options.addParents) file.parents=[...new Set([...file.parents,options.addParents])].filter(p=>p!==options.removeParents);
      files.set(id,file);writes++;return copy(file);
    }
  } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('server/google-apps-script/Code.gs','utf8'),context);
const base={protocol:'cake-session-upsert-v1',filetype:'excel',sessionId:'a'.repeat(32),writeToken:'b'.repeat(32),sessionStatus:'in_progress',revision:'1',filedata:Buffer.from('PK workbook first').toString('base64')};
const post=changes=>JSON.parse(context.doPost({parameter:{...base,...changes}}).text);
assert.equal(JSON.parse(context.doGet().text).protocol,base.protocol);
const first=post({});assert.equal(first.status,'success');assert.equal(files.size,1);
assert.equal(post({}).fileId,first.fileId);assert.equal(writes,1,'lost response retry must not write a second file');
assert.equal(post({filedata:Buffer.from('PK conflict').toString('base64')}).status,'error');
assert.equal(post({writeToken:'c'.repeat(32),revision:'2'}).status,'error');
const finalBytes=Buffer.from('PK workbook complete 21 trials and questionnaire').toString('base64');
const final=post({revision:'2',sessionStatus:'completed',filedata:finalBytes});
assert.equal(final.fileId,first.fileId);assert.equal(final.storedRevision,2);assert.equal(files.size,1);assert.equal(writes,2);
assert.equal(post({}).disposition,'superseded');assert.equal(writes,2);
assert.equal(post({revision:'3'}).status,'error','old in-progress requests cannot reopen a completed session');
assert.equal(post({revision:'2',sessionStatus:'completed',filedata:finalBytes}).disposition,'unchanged');
failWrite=true;
assert.equal(post({revision:'3',sessionStatus:'completed',filedata:finalBytes}).status,'error');
assert.equal(files.get(first.fileId).appProperties.revision,'2');assert.equal(locked,false);
failWrite=false;
assert.equal(post({revision:'3',sessionStatus:'completed',filedata:finalBytes}).status,'success');
assert.equal(files.size,1);assert.equal(files.get(first.fileId).appProperties.sessionStatus,'completed');
assert.equal(post({sessionId:'d'.repeat(32)}).status,'success');assert.equal(files.size,2);
console.log('PASS: one file per session, stable ID, retry idempotency, ordered revisions, write-token protection, completion protection and failed-write recovery.');
const museum=post({sessionId:'e'.repeat(32)});
const named=post({sessionId:'e'.repeat(32),revision:'2',filenameLabel:'M001'});
assert.equal(named.fileId,museum.fileId);
assert.equal(named.fileName,`cake_M001_${'e'.repeat(32)}.xlsx`);
assert.equal(post({sessionId:'e'.repeat(32)}).fileName,named.fileName,'stale unnamed upload must not rename the file');
assert.equal(post({sessionId:'e'.repeat(32),revision:'2',filenameLabel:'M001'}).disposition,'unchanged');
const email=post({sessionId:'f'.repeat(32),filenameLabel:'parent+study@example.com'});
assert.equal(email.fileName,`cake_parent+study@example.com_${'f'.repeat(32)}.xlsx`);
console.log('PASS: participant-labelled filenames, same-ID rename after intake, stale request protection and email labels.');

const oldFolder='1N2Ko4FmapcRfLxP2OFVOF03M2K06AO_Z', kidFolder='1ZfsdDJgtBYv6iZz7o4tDPVK0drrORYS8';
const kid=post({sessionId:'1'.repeat(32),filenameLabel:'kid_TEST',studyId:'kid-rl-sa'});
assert.equal(kid.folderId,kidFolder);assert.deepEqual(files.get(kid.fileId).parents,[kidFolder]);
assert.equal(files.get(museum.fileId).parents[0],oldFolder);
const legacy=files.get(kid.fileId);legacy.parents=[oldFolder];
const moved=post({sessionId:'1'.repeat(32),filenameLabel:'kid_TEST',revision:'2'});
assert.equal(moved.fileId,kid.fileId);assert.deepEqual(files.get(kid.fileId).parents,[kidFolder]);
assert.equal(post({sessionId:'1'.repeat(32),filenameLabel:'kid_TEST',revision:'2'}).disposition,'unchanged');
assert.equal(post({sessionId:'e'.repeat(32),filenameLabel:'kid_wrong',studyId:'kid-rl-sa',revision:'3'}).status,'error');
assert.equal(files.get(museum.fileId).parents[0],oldFolder);
console.log('PASS: kid routing, other studies unchanged, legacy kid migration keeps file ID, retry stays in kid folder.');
