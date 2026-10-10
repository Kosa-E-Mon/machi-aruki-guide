const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function editor(){
  const nodes=new Map(),storage=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},textContent:''});return nodes.get(id);};
  const ctx={console,URL,Event,crypto:require('node:crypto').webcrypto,confirm:()=>true,
    setTimeout:fn=>{fn();return 1;},clearTimeout(){},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    document:{getElementById:node,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null},
    location:{href:'http://localhost/editor.html'},history:{},navigator:{},addEventListener(){}};
  ctx.window=ctx;vm.createContext(ctx);
  const html=fs.readFileSync(path.join(__dirname,'../editor.html'),'utf8');
  for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../editor-ui.js'),'utf8'),ctx);
  return {ctx,run:code=>vm.runInContext(code,ctx),nodes,storage};
}
test('CSV preserves quoted multiline descriptions, commas and quotes',()=>{
  const {run,ctx}=editor();
  ctx.example=[{spot_id:'sample',description:'一行目,「説明」\n二行目 "写真"'}];
  assert.equal(run("parseCSV(buildCSV(['spot_id','description'],example))[0].description"),ctx.example[0].description);
});
test('adding, deleting and restoring records correctly changes unsaved state',()=>{
  const {run}=editor();
  run("state.loaded=true;UI_SHEETS.forEach(s=>{state[s]=[];state.originals[s]=[];});");
  assert.equal(run('hasUnsavedChanges()'),false);
  run("state.spots.push({spot_id:'one'});");assert.equal(run('hasUnsavedChanges()'),true);
  run('state.originals.spots=dc(state.spots);state.spots=[];');assert.equal(run('hasUnsavedChanges()'),true);
  run('state.spots=dc(state.originals.spots);');assert.equal(run('hasUnsavedChanges()'),false);
});
test('connection accepts only the expected GAS deployment URL',()=>{
  const {ctx}=editor();
  assert.equal(ctx.validGasUrl(''),true);
  assert.equal(ctx.validGasUrl('https://script.google.com/macros/s/example/exec'),true);
  for(const url of ['javascript:alert(1)','https://example.com/macros/s/a/exec','https://script.google.com.evil.example/macros/s/a/exec','http://script.google.com/macros/s/a/exec'])assert.equal(ctx.validGasUrl(url),false);
});
test('restored tokens belong to their sheet and never leak to another profile',()=>{
  const {ctx,storage}=editor();storage.set('lwg_editor_gas_token__sheetA','test-A');
  assert.equal(ctx.uiToken('sheetA'),'test-A');assert.equal(ctx.uiToken('sheetB'),'');
});
test('legacy token is migrated to only one sheet',()=>{
  const {run,storage}=editor();storage.set('lwg_editor_gas_token','legacy-test');
  run("document.getElementById('sheet-url').value='sheet_A_123456789012345';gasTokenStorageKey();");
  assert.equal(storage.get('lwg_editor_gas_token__sheet_A_123456789012345'),'legacy-test');
  run("document.getElementById('sheet-url').value='sheet_B_123456789012345';gasTokenStorageKey();");
  assert.equal(storage.has('lwg_editor_gas_token__sheet_B_123456789012345'),false);
});
test('manually entered token is used safely in generated GAS code',()=>{
  const {run,ctx}=editor();ctx.manual="test'key";
  run("document.getElementById('sheet-url').value='sheet_A_123456789012345';document.getElementById('gas-token').value=manual;");
  const code=run('buildGasCode()');new vm.Script(code);
  assert.ok(code.includes(JSON.stringify(ctx.manual)));
});
test('row addition and deletion appear in save confirmation before any write',async()=>{
  const {run,ctx}=editor();
  run("workspace.home=false;state.loaded=true;currentTab='spots';state.originals.spots=[{spot_id:'old'}];state.spots=[];showDiffModal=(diff)=>{window.capturedDiff=diff};");
  await run('saveCurrentSheet()');assert.equal(Object.keys(ctx.capturedDiff).length,1);
  assert.ok(Object.values(ctx.capturedDiff)[0].old.includes('old'));assert.equal(Object.values(ctx.capturedDiff)[0].new,'');
});
test('save verification failure keeps the user edits and original snapshot',async()=>{
  const {run}=editor();
  run("state.loaded=true;state.sheetId='test';state.gasUrl='https://script.google.com/macros/s/test/exec';state.gasToken='test-only';state.gasConnected=true;currentTab='spots';state.originals.spots=[{spot_id:'one',spot_name:'before'}];state.spots=[{spot_id:'one',spot_name:'after'}];gasWrite=async()=>{};fetchGviz=async()=> 'spot_id,spot_name\\none,before';showLd=()=>{};hideLd=()=>{};setStat=()=>{};notify=()=>{};console={error(){}};");
  await run('_origSaveCurrentSheet()');
  assert.equal(run('state.spots[0].spot_name'),'after');assert.equal(run('state.originals.spots[0].spot_name'),'before');assert.equal(run('hasUnsavedChanges()'),true);
});
test('verified save updates the original snapshot and clears unsaved state',async()=>{
  const {run}=editor();
  run("state.loaded=true;UI_SHEETS.forEach(s=>{state[s]=[];state.originals[s]=[];});state.sheetId='test';state.gasUrl='test';state.gasToken='test-only';state.gasConnected=true;currentTab='spots';state.originals.spots=[{spot_id:'one',spot_name:'before'}];state.spots=[{spot_id:'one',spot_name:'after'}];gasWrite=async()=>{};fetchGviz=async()=> 'spot_id,spot_name\\none,after';showLd=()=>{};hideLd=()=>{};setStat=()=>{};notify=()=>{};showTab=()=>{};");
  await run('_origSaveCurrentSheet()');
  assert.equal(run('state.originals.spots[0].spot_name'),'after');assert.equal(run('hasUnsavedChanges()'),false);
});
test('failed loading leaves the previous sheet and edits intact',async()=>{
  const {run,nodes}=editor();
  run("state.loaded=true;state.sheetId='previous';state.spots=[{spot_name:'unsaved'}];fetchGviz=async()=>{throw Error('offline')};showLd=()=>{};hideLd=()=>{};setStat=()=>{};notify=()=>{};console={error(){}};");
  run("document.getElementById('sheet-url').value='new_sheet_id_123456789012345';");
  assert.equal(await run('loadData()'),false);assert.equal(run('state.sheetId'),'previous');assert.equal(run('state.spots[0].spot_name'),'unsaved');
});
test('release confirmation can cancel without writing',async()=>{
  const {run,ctx}=editor();
  run("state.loaded=true;state.gasConnected=true;state.gasToken='test-only';currentTab='courses';state.courses=[{course_id:'one',course_name:'公開候補',is_published:'TRUE'}];state.originals.courses=[{course_id:'one',is_published:'FALSE'}];state.course_spots=[];state.originals.course_spots=[];window.writes=0;gasWrite=async()=>{window.writes++};confirm=msg=>{window.releasePrompt=msg;return false};");
  await run('_origSaveCurrentSheet()');
  assert.equal(ctx.writes,0);assert.ok(ctx.releasePrompt.includes('正式公開（リリース）'));
});
test('release success is announced only after the sheet matches',async()=>{
  for(const matches of [true,false]){
    const {run,ctx}=editor();ctx.matches=matches;
    run("state.loaded=true;state.gasConnected=true;state.gasToken='test-only';currentTab='courses';state.courses=[{course_id:'one',is_published:'TRUE'}];state.originals.courses=[{course_id:'one',is_published:'FALSE'}];state.course_spots=[];state.originals.course_spots=[];gasWrite=async()=>{};fetchGviz=async(sid,s)=>s==='courses'?'course_id,is_published\\none,'+(matches?'TRUE':'FALSE'):'course_id,spot_id,order';showLd=()=>{};hideLd=()=>{};setStat=()=>{};showTab=()=>{};notify=msg=>{window.resultMessage=msg};console={error(){}};");
    await run('_origSaveCurrentSheet()');
    assert.equal(ctx.resultMessage.startsWith('正式公開しました！'),matches);
    assert.equal(run('state.originals.courses[0].is_published'),matches?'TRUE':'FALSE');
  }
});
test('audio playback derives the automatic filename when the URL cell is blank',()=>{
  const {run}=editor();
  run("state.config=[{key:'audio_repo',value:'kosa-e-mon/machi-aruki-audio'}];");
  assert.equal(run("mediaPlaybackUrl('spots','audio_approach_url','spot-01','')"),'https://kosa-e-mon.github.io/machi-aruki-audio/spot-01_approach.mp3');
  assert.equal(run("mediaPlaybackUrl('spots','audio_approach_url','spot-01','https://example.com/custom.mp3')"),'https://example.com/custom.mp3');
});
test('matrix uses current route order, preserves missing references and does not mutate data',()=>{
  const {run}=editor();
  run("state.courses=[{course_id:'c'}];state.spots=[{spot_id:'a',description:'未保存説明'}];state.course_spots=[{course_id:'c',spot_id:'missing',order:'2'},{course_id:'other',spot_id:'a',order:'0'},{course_id:'c',spot_id:'a',order:'1'}];window.before=JSON.stringify(state);");
  assert.equal(run("courseMatrixRows(state.courses[0])[0].spot.description"),'未保存説明');
  assert.equal(run("courseMatrixRows(state.courses[0])[1].spot"),null);
  assert.equal(run('JSON.stringify(state)===before'),true);
});
test('matrix distinguishes explicit URL, automatic candidate, optional explain and TTS',()=>{
  const {run}=editor();
  run("state.config=[{key:'audio_repo',value:'owner/audio'}];");
  assert.equal(run("matrixAudio('spots',{spot_id:'s'},'arrive').label"),'自動候補・未確認');
  assert.equal(run("matrixAudio('spots',{spot_id:'s',audio_arrive_url:'https://example.com/a.mp3'},'arrive').url"),'https://example.com/a.mp3');
  assert.equal(run("matrixAudio('spots',{spot_id:'s'},'explain').url"),null);
  assert.equal(run("matrixAudio('spots',{spot_id:'s',description:'解説'},'explain').tts"),true);
  assert.equal(run("matrixAudio('spots',{spot_id:'s'},'start',false).kind"),'na');
  assert.equal(run("matrixAudio('courses',{course_id:'c'},'theme').url"),'https://owner.github.io/audio/c_start.mp3');
  assert.equal(run("matrixAudio('courses',{course_id:'c'},'finish').tts"),true);
  run('state.config=[];');
  assert.equal(run("matrixAudio('spots',{spot_id:'s'},'arrive').label"),'音声未登録');
  assert.equal(run("matrixAudio('spots',{spot_id:'s'},'arrive').tts"),true);
});
test('persistent toolbar reports unsaved state for the current sheet and across the home view',()=>{
  const {run,nodes}=editor();
  run("state.loaded=true;workspace.demo=false;workspace.home=false;currentTab='courses';UI_SHEETS.forEach(s=>{state[s]=[];state.originals[s]=[]});state.course_spots=[{course_id:'c',spot_id:'s',order:'1'}];updateWorkspaceSaveStatus();");
  assert.equal(nodes.get('workspace-save-status').textContent,'● 未保存の変更あり');
  run("currentTab='spots';updateWorkspaceSaveStatus();");
  assert.equal(nodes.get('workspace-save-status').textContent,'変更なし');
  run('workspace.home=true;updateWorkspaceSaveStatus();');
  assert.equal(nodes.get('workspace-save-status').textContent,'● 未保存の変更あり');
  run('state.originals.course_spots=dc(state.course_spots);updateWorkspaceSaveStatus();');
  assert.equal(nodes.get('workspace-save-status').textContent,'変更なし');
  run('workspace.demo=true;updateWorkspaceSaveStatus();');
  assert.equal(nodes.get('workspace-save-status').textContent,'サンプル・保存しません');
});
