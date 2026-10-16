const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const {webcrypto}=require('node:crypto');
function harness(){
 const storage=new Map(),calls=[];let resolve;let failStorage=false;
 const node=()=>({style:{},setAttribute(){},appendChild(){},append(){},textContent:''});
 const c={console,crypto:webcrypto,Uint8Array,Date,JSON,Promise,Math,Object,Array,Number,Error,URL,Blob,setTimeout,window:{addEventListener(){}},setInterval(){},
  document:{getElementById:()=>node(),createElement:()=>node(),body:node()},
  localStorage:{setItem(k,v){if(failStorage)throw Error('quota');storage.set(k,v)},getItem:k=>storage.get(k)},
  gameData:{participantId:'TEST',allTrialsData:[],currentTrialData:{}},timeline:{currentStage:0,stages:[{type:'participant_info',handler:function participant(){}}],mapData:{}},ONEP2G_CONFIG:{},TWOP3G_CONFIG:{},
  buildSessionWorkbook:()=>({}),XLSX:{utils:{book_append_sheet(){},aoa_to_sheet:r=>r},write:()=>JSON.stringify(c.gameData)},
  uploadWorkbookToGoogleDrive:async(w,f,o)=>{calls.push(JSON.parse(JSON.stringify(o)));return new Promise(r=>{resolve=r})}
 };vm.createContext(c);vm.runInContext(fs.readFileSync('js/sessionSave.js','utf8'),c);
 return {c,api:c.window.KidSessionSave,storage,calls,reply:async ok=>{resolve({savedToDrive:ok,fileId:'file'});await new Promise(r=>setImmediate(r));},failStorage:()=>failStorage=true};
}
test('persists before upload, serializes requests, and never acknowledges a newer unsent revision',async()=>{
 const h=harness();const first=h.api.begin();assert.equal(h.calls.length,1);assert.ok(h.storage.size);
 h.c.gameData.allTrialsData.push({trialIndex:0});h.api.checkpoint('trial_complete');
 h.c.gameData.questionnaireData={answer:1};h.api.checkpoint('questionnaire_complete');
 assert.equal(h.calls.length,1);assert.equal(h.api.getRecord().revision,3);
 await h.reply(true);assert.equal(h.calls.length,2);assert.equal(h.calls[1].revision,3);assert.equal(h.calls[1].sessionStatus,'completed');
 assert.equal(h.api.getRecord().ackRevision,1);
 await h.reply(true);await first;assert.equal(h.api.getRecord().ackRevision,3);assert.equal(h.api.getRecord().snapshot.gameData.allTrialsData.length,1);
});
test('failed save stays durable and retries the identical revision and bytes',async()=>{
 const h=harness();let p=h.api.begin();await h.reply(false);await p;
 const before=h.calls[0];assert.equal(h.api.getRecord().ackRevision,0);
 p=h.api.flush();assert.deepEqual(h.calls[1],before);await h.reply(true);await p;assert.equal(h.api.getRecord().ackRevision,1);
});
test('storage quota failure is visible and is never reported as a local backup',async()=>{
 const h=harness();h.failStorage();let p=h.api.begin();assert.equal(h.api.locallySaved(),false);await h.reply(true);await p;assert.equal(h.api.locallySaved(),false);
});
