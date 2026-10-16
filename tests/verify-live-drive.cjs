// Run from repository root. Explicit opt-in: writes synthetic TEST_ONLY data to Drive.
if (!process.argv.includes('--live')) throw new Error('Pass --live to upload synthetic test data.');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const assert = require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});
 try {
  const page=await browser.newPage();
  await page.goto('https://cog-games.github.io/GridGameV1.1/',{waitUntil:'networkidle'});
  if (!process.argv.includes('--deployed')) {
   await page.addScriptTag({content:fs.readFileSync('js/expTimeline.js','utf8')});
  } else {
   assert.equal(await page.evaluate(()=>typeof googleDriveUploadSession), 'object', 'Published upload fix is not loaded');
  }
  const result=await page.evaluate(async()=>{
   gameData.participantId='TEST_ONLY_KID_UPLOAD';
   window.NodeGameConfig.setAssignedAICondition('sa-model', {assignmentSource:'url-override'});
   gameData.allTrialsData=[{participantId:gameData.participantId,trialIndex:0,experimentType:'2P3G',validationOnly:true,note:'Synthetic upload validation; no participant data',trajectory:[[1,1],[1,2]]}];
   gameData.questionnaireData={validationOnly:true};
   const workbook=buildSessionWorkbook([{participantId:gameData.participantId,trialIndex:0,experimentType:'2P3G',validationOnly:true,note:'Synthetic upload validation; no participant data',trajectory:JSON.stringify([[1,1],[1,2]])}],[['validationOnly','answer'],[true,'TEST']]);
   const first=await uploadWorkbookToGoogleDrive(workbook,'TEST_ONLY.xlsx');
   const retry=await uploadWorkbookToGoogleDrive(workbook,'TEST_ONLY.xlsx');
   return {first:{...first,error:first.error?.message},retry:{...retry,error:retry.error?.message},sheets:workbook.SheetNames};
  });
  assert.equal(result.first.savedToDrive,true,JSON.stringify(result));
  assert.equal(result.retry.savedToDrive,true);
  assert.equal(result.first.fileId,result.retry.fileId);
  assert.equal(result.first.revision,result.retry.revision);
  console.log(JSON.stringify(result));
  // Exercise failure and retry in the actual local-completion UI.
  await page.route('https://script.google.com/**',route=>route.abort());
  await page.evaluate(()=>showLocalCompletionStage());
  assert.match(await page.locator('#container').innerText(),/NOT been confirmed/);
  assert.equal(await page.getByRole('button',{name:'Retry Google Drive upload'}).count(),1);
  await page.unroute('https://script.google.com/**');
  await page.getByRole('button',{name:'Retry Google Drive upload'}).click();
  await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent.includes('Excel uploaded to Google Drive'),{},{timeout:65000});
  console.log('PASS: browser CORS, idempotent retry, visible failure, UI retry and confirmed success.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
