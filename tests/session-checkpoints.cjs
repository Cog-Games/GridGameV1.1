// --live writes synthetic TEST_ONLY data; --deployed uses only public code.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'), assert=require('assert/strict');
const live=process.argv.includes('--live'), deployed=process.argv.includes('--deployed');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});
 try {
  const page=await browser.newPage();
  const acknowledgements=[], requests=[];
  if(!deployed) await page.route('https://cog-games.github.io/GridGameV1.1/**',async route=>{
   const path=new URL(route.request().url()).pathname.replace('/GridGameV1.1/','') || 'index.html';
   if(['index.html','js/sessionSave.js','js/expTimeline.js','js/dataRecording.js','js/human-AI-version.js'].includes(path))
    await route.fulfill({path,contentType:path.endsWith('.html')?'text/html':'application/javascript'});
   else await route.continue();
  });
  let offline=false, saved=null;
  await page.route('https://script.google.com/**',async route=>{
   if(offline) return route.abort();
   if(live) return route.continue();
   if(route.request().method()==='GET') return route.fulfill({json:{protocol:'cake-session-upsert-v1'}});
   const p=Object.fromEntries(new URLSearchParams(route.request().postData())); requests.push(p);
   if(saved) assert.equal(p.sessionId,saved.sessionId);
   saved=p;
   const ack={status:'success',protocol:p.protocol,sessionId:p.sessionId,revision:+p.revision,storedRevision:+p.revision,fileId:'mock-file',fileName:`cake_${p.filenameLabel}_${p.sessionId}.xlsx`};
   acknowledgements.push(ack); await route.fulfill({json:ack});
  });
  if(live) page.on('response',async response=>{
   if(response.url().includes('script.googleusercontent.com')) try {const a=await response.json();if(a.status==='success') acknowledgements.push(a);}catch{}
  });
  await page.goto('https://cog-games.github.io/GridGameV1.1/?aiCondition=sa-model',{waitUntil:'networkidle'});
  await page.locator('#participantIdInput').fill('TEST_ONLY_CHECKPOINTS');
  await page.locator('#dobYear').selectOption('2018'); await page.locator('#dobMonth').selectOption('1'); await page.locator('#dobDay').selectOption('1');
  await page.locator('#participantInfoContinueBtn').click();
  await page.waitForFunction(()=>window.KidSessionSave?.getRecord()?.revision===1);
  let r=await page.evaluate(async()=>{await KidSessionSave.flush();return KidSessionSave.getRecord()});
  assert.equal(r.ackRevision,1);assert.equal(r.sessionStatus,'in_progress');const id=r.sessionId,fileId=r.fileId;
  console.log('start',JSON.stringify({sessionId:id,fileId}));
  async function round(n){return page.evaluate(async n=>{
   timeline.currentStage=timeline.stages.findIndex(s=>s.type==='trial'&&s.experimentType==='1P1G');
   gameData.currentExperiment='1P1G';gameData.currentTrial=n;
   gameData.currentTrialData={trialIndex:n,experimentType:'1P1G',trialStartTime:Date.now()-1000,validationOnly:true,player1Trajectory:[[1,1],[1,2]],player2Trajectory:[],player1Actions:['right'],player1RT:[100]};
   DataRecording.finalizeTrial(true);await KidSessionSave.flush();return KidSessionSave.getRecord();
  },n)}
  r=await round(0);assert.equal(r.ackRevision,2);assert.equal(r.fileId,fileId);
  r=await round(1);assert.equal(r.ackRevision,3);assert.equal(r.snapshot.gameData.allTrialsData.length,2);
  offline=true;r=await round(2);assert.equal(r.revision,4);assert.equal(r.ackRevision,3);
  await page.evaluate(()=>{timeline.currentStage=timeline.stages.findIndex(s=>s.type==='questionnaire');gameData.questionnaireDraft={ai_detection:'Probably a computer'};KidSessionSave.backup();});
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Resume saved session'}).click();
  r=await page.evaluate(()=>KidSessionSave.getRecord());assert.equal(r.sessionId,id);assert.equal(r.revision,4);assert.equal(r.snapshot.gameData.allTrialsData.length,3);
  assert.equal(await page.locator('#container').innerText().then(t=>t.includes('collaborate')),true);
  offline=false;
  r=await page.evaluate(async()=>{window.dispatchEvent(new Event('online'));await KidSessionSave.flush();return KidSessionSave.getRecord();});
  assert.equal(r.ackRevision,4);assert.equal(r.fileId,fileId);assert.equal(r.sessionStatus,'in_progress');
  // Complete the remaining questionnaire pages through their real key handlers.
  await page.keyboard.press('Space');await page.keyboard.press('Space');
  await page.waitForFunction(()=>KidSessionSave.getRecord().sessionStatus==='completed');
  r=await page.evaluate(async()=>{await KidSessionSave.flush();return KidSessionSave.getRecord();});
  assert.equal(r.ackRevision,5);assert.equal(r.fileId,fileId);assert.equal(r.snapshot.gameData.allTrialsData.length,3);
  assert.equal(Object.keys(r.snapshot.gameData.questionnaireData).length,3);
  await page.waitForFunction(()=>document.querySelector('#container').textContent.includes('You may close this window'));
  if(!live) {
   assert.deepEqual(requests.map(p=>p.sessionStatus),['in_progress','in_progress','in_progress','in_progress','completed']);
   assert.deepEqual(requests.map(p=>+p.revision),[1,2,3,4,5]);
  }
  console.log(JSON.stringify({fileId,sessionId:id,revision:r.revision,status:r.sessionStatus,trials:r.snapshot.gameData.allTrialsData.length,acknowledgements}));
  console.log('PASS: real startup and per-trial hooks; offline durable backup; reload recovery; same-file catch-up; questionnaire completion.');
  if(!live) {
   offline=true; saved=null;
   await page.evaluate(()=>localStorage.clear());
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#participantIdInput').fill('TEST_INTERRUPTED');
   await page.locator('#dobYear').selectOption('2018');await page.locator('#dobMonth').selectOption('1');await page.locator('#dobDay').selectOption('1');
   await page.locator('#participantInfoContinueBtn').click();
   await page.waitForFunction(()=>!!KidSessionSave.getRecord());
   const interruptedId=await page.evaluate(()=>{
    timeline.currentStage=timeline.stages.findIndex(s=>s.type==='trial' && s.experimentType==='1P1G');
    runNextStage();gameData.currentTrialData.player1Actions.push('test-interrupted-action');KidSessionSave.backup();
    return KidSessionSave.getRecord().sessionId;
   });
   await page.reload({waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Resume saved session'}).click();
   const recovered=await page.evaluate(()=>KidSessionSave.getRecord());
   assert.equal(recovered.sessionId,interruptedId);assert.equal(recovered.snapshot.gameData.allTrialsData.length,0);
   assert.ok(recovered.interruptedTrials[0].player1Actions.includes('test-interrupted-action'));
   await page.waitForFunction(()=>timeline.stages[timeline.currentStage].type==='trial');
   assert.equal(await page.evaluate(()=>gameData.currentTrialData.player1Actions.length),0);
   console.log('PASS: interrupted trial retained separately and restarted without duplicating completed trials.');
  }

 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
