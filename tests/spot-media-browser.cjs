/* Entirely synthetic data, all non-local requests intercepted; no live Sheet writes. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const evidence=path.resolve(process.env.TEST_ARTIFACT_DIR||path.join(root,'..','spot-media-evidence'));fs.mkdirSync(evidence,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});res.end(e?'missing':data);});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME_PATH});
 const checks=[],errors=[],posts=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(10000);
  const csv={config:'key,value\napp_title,素材検証\nphoto_repo,owner/photos\naudio_repo,owner/audio',courses:'course_id,course_name,is_published\nc,検証,TRUE',
   spots:'spot_id,spot_name,lat,lng,description,shared_media_id,audio_arrive_url,photo_url,audio_arrive_txt,audio_explain_txt,audio_next_txt\nKaneboshi,共通元,39,140,元説明,,https://custom.test/shared.mp3,https://custom.test/photo.webp,元到着,元解説,元の方向\nKaneboshi_01,コピー,39,140,コピー説明,Kaneboshi,,,編集した到着,編集した解説,編集した誘導\nyotsuya_t-junction_01,次,39,140,次説明,,,,次到着,次解説,次誘導',
   course_spots:'course_id,spot_id,order\nc,Kaneboshi_01,1\nc,yotsuya_t-junction_01,2',facilities:'facility_id,facility_name,lat,lng'};
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(req.method()==='POST'){posts.push(req.url());return route.abort();}
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.pathname.includes('leaflet')&&url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:"const chain=new Proxy({}, {get:(o,k)=>k==='getLatLng'?()=>({lat:39,lng:140}):()=>chain});window.L=new Proxy({}, {get:(o,k)=>k==='DomEvent'?chain:()=>chain});"});
   if(url.pathname.endsWith('/gviz/tq'))return route.fulfill({contentType:'text/csv',body:csv[url.searchParams.get('sheet')]||''});
   if(url.hostname==='api.github.com')return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.includes('/git/trees/')?{tree:[],sha:'fixture'}:{default_branch:'main'})});
   if(url.hostname==='custom.test'&&url.pathname.endsWith('photo.webp'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#aaddcc"/></svg>'});
   if(url.hostname==='custom.test'&&url.pathname==='/native.wav'){
     const bytes=Buffer.alloc(44+1600);bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(1600,40);
     return route.fulfill({contentType:'audio/wav',body:bytes});
   }
   if(url.hostname==='custom.test')return route.fulfill({status:200,body:''});
   return route.fulfill({status:404,body:''});
  });
  await context.addInitScript(()=>{
   window.NativeFixtureAudio=window.Audio;window.fixtureAudio=[];window.fixtureTTS=[];window.fixtureUtterances=[];window.fixtureMode='shared';
   window.Audio=class{
    constructor(url){this.url=url;fixtureAudio.push(this);}
    addEventListener(type,fn){this['on'+type]=fn;}pause(){this.paused=true;}
    play(){return new Promise((resolve,reject)=>{this.reject=reject;setTimeout(()=>{
      if(fixtureMode==='hold')return;
      if(fixtureMode==='reject'){reject(Object.assign(Error(),{name:'NotAllowedError'}));return;}
      const okay=fixtureMode==='dedicated'||fixtureMode==='shared'&&this.url.includes('custom.test');
      if(okay){this.onplaying?.();resolve();setTimeout(()=>this.onended?.(),5);}else{this.error={code:fixtureMode==='network'?2:4};this.onerror?.();reject(Error('missing'));}
    },0);});}
   };
   window.SpeechSynthesisUtterance=new URL(location.href).searchParams.has('tts-unsupported')?undefined:class{constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices:()=>[],speak(u){fixtureTTS.push(u.text);fixtureUtterances.push(u);if(fixtureMode==='tts-hold')return;setTimeout(()=>{if(fixtureMode==='tts-fail')u.onerror?.();else u.onend?.();},0);}}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push('app: '+e.message));
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base+'/index.html');await page.waitForFunction(()=>typeof allSpots!=='undefined'&&allSpots.length===3);
  const run=async(mode)=>{await page.evaluate(mode=>{fixtureMode=mode;fixtureAudio=[];fixtureTTS=[];window.complete=0;playArriveSequence(allSpots[1],()=>complete++);},mode);await page.waitForFunction(()=>complete===1);return page.evaluate(()=>({urls:fixtureAudio.map(a=>a.url),texts:fixtureTTS,complete,playing:voicePlaying}));};
  let r=await run('dedicated');assert.equal(r.urls.length,1);assert.deepEqual(r.texts,[]);checks.push('専用音声優先・到着音声成功時の解説TTS抑制');
  r=await run('shared');assert.equal(r.urls[1],'https://custom.test/shared.mp3');assert.deepEqual(r.texts,[]);checks.push('専用404→任意URL共通音声');
  for(const mode of ['missing','network','reject','tts-fail']){r=await run(mode);assert.deepEqual(r.texts,['編集した到着','編集した解説']);assert.equal(r.playing,false);checks.push(mode+'でも原稿・操作を維持');}
  assert.equal(await page.locator('#voice-notice').isVisible(),true);assert.match(await page.locator('#voice-notice').textContent(),/読み上げできませんでした/);assert.equal(await page.locator('#voice-notice').evaluate(n=>getComputedStyle(n).pointerEvents),'none');checks.push('TTS onerrorの非阻害通知');
  await page.evaluate(()=>startArriveWithLock(allSpots[1]));await page.waitForFunction(()=>!nextButtonLocked&&!voicePlaying);assert.equal(await page.locator('#btn-next').isEnabled(),true);checks.push('TTS onerrorでも次へロック解除');
  await page.evaluate(()=>{currentCourse=allCourses[0];courseSpots=buildCourseSpots(currentCourse);currentIdx=0;showExplain(courseSpots[0]);});
  await page.waitForFunction(()=>document.querySelector('#photo-area img')?.src==='https://custom.test/photo.webp'&&document.querySelector('#photo-area img')?.complete);checks.push('専用写真404→共通写真');
  await page.waitForTimeout(1000);await page.screenshot({path:path.join(evidence,'spot-media-app.png')});
  await page.evaluate(()=>{fixtureMode='hold';window.staleComplete=0;playArriveSequence(allSpots[1],()=>staleComplete++);window.oldEnd=fixtureAudio.at(-1).onended;nextSpot();oldEnd();});
  await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>staleComplete),0);checks.push('次スポット移動後の旧イベント無視');await page.evaluate(()=>stopVoice());
  await page.evaluate(()=>{const button=document.createElement('button');button.id='native-fixture';button.textContent='native fixture';button.onclick=()=>{window.nativeDone=null;window.nativePlayer=SpotMedia.createPlayer({Audio:NativeFixtureAudio,probe:SpotMedia.probe});nativePlayer.play(['https://owner.github.io/audio/not-found.mp3','https://custom.test/native.wav'],'',r=>nativeDone=r);};document.body.append(button);});
  await page.locator('#native-fixture').click();await page.waitForFunction(()=>nativeDone!==null);assert.equal(await page.evaluate(()=>nativeDone.audio),true);checks.push('実Chrome Audioの404→有効WAVデコード・ended完了');
  await page.evaluate(()=>{fixtureMode='missing';fixtureTTS=[];fixtureAudio=[];currentIdx=0;courseSpots[0].audio_start_txt='編集出発';courseSpots[0].audio_approach_txt='編集接近';startGPS=()=>{};refreshWeather=()=>{};startWalk(true);});
  await page.waitForFunction(()=>fixtureTTS.includes('編集出発')&&!gpsLocked);checks.push('本体出発経路で編集したstart原稿');
  await page.evaluate(()=>{approachNotified=false;arrivedDetected=false;courseSpots[0].approach_dist=100;courseSpots[0].arrive_dist=5;onGPSUpdate({timestamp:Date.now(),coords:{latitude:39.0003,longitude:140,accuracy:3}});});
  await page.waitForFunction(()=>fixtureTTS.includes('編集接近')&&!voicePlaying);checks.push('本体GPS接近経路で編集したapproach原稿');
  await page.evaluate(()=>{courseSpots.push({...courseSpots[1],spot_id:'last',order:3});courseSpots[1].audio_next_txt='編集次へ';nextSpot();});
  await page.waitForFunction(()=>fixtureTTS.includes('編集次へ')&&!gpsLocked);checks.push('本体次へ経路で編集したnext原稿');
  await page.evaluate(()=>{courseSpots[2].audio_goal_txt='編集ゴール';nextSpot();});
  await page.waitForFunction(()=>fixtureTTS.includes('編集ゴール')&&!gpsLocked);checks.push('本体ゴール誘導経路で編集したgoal原稿');
  await page.evaluate(()=>{fixtureMode='tts-hold';playVoice([],'取消対象',null,true);window.canceledError=fixtureUtterances.at(-1).onerror;stopVoice();canceledError();});
  assert.equal(await page.locator('#voice-notice').isVisible(),false);checks.push('cancel後の旧TTS onerrorは通知しない');
  await page.evaluate(()=>{currentIdx=0;courseSpots=buildCourseSpots(currentCourse);playVoice([],'旧スポット',null,true);window.oldSpotError=fixtureUtterances.at(-1).onerror;nextSpot();oldSpotError();});
  await page.waitForTimeout(550);assert.equal(await page.locator('#voice-notice').isVisible(),false);checks.push('次スポット移動後の旧TTS onerrorは通知しない');await page.evaluate(()=>stopVoice());
  const unsupported=await context.newPage();unsupported.on('pageerror',e=>errors.push('unsupported: '+e.message));await unsupported.goto(base+'/index.html?tts-unsupported');await unsupported.waitForFunction(()=>allSpots.length===3);
  await unsupported.evaluate(()=>{fixtureMode='missing';currentCourse=allCourses[0];courseSpots=buildCourseSpots(currentCourse);currentIdx=0;showExplain(courseSpots[0]);startArriveWithLock(courseSpots[0]);});
  await unsupported.waitForFunction(()=>!nextButtonLocked&&!voicePlaying);assert.equal(await unsupported.locator('#btn-next').isEnabled(),true);assert.match(await unsupported.locator('#voice-notice').textContent(),/この端末では読み上げを利用できません/);assert.equal(await unsupported.locator('#voice-notice').isVisible(),true);checks.push('TTS未対応でも非阻害通知・次へ解除');
  const editor=await context.newPage();editor.on('pageerror',e=>errors.push('editor: '+e.message));await editor.goto(base+'/editor.html');
  await editor.evaluate(()=>{state.loaded=true;state.config=[{key:'photo_repo',value:'owner/photos'},{key:'audio_repo',value:'owner/audio'}];state.spots=[{spot_id:'Kaneboshi',spot_name:'複製元',description:'元の説明',audio_arrive_txt:'元到着',audio_next_txt:'方向要確認',lat:'39',lng:'140',arrive_dist:'15',photo_url:'https://custom.test/photo.webp',audio_arrive_url:'https://custom.test/shared.mp3'}];state.originals.spots=dc(state.spots);state.courses=[];state.course_spots=[];selectedRow.spots=0;tableViewMode.spots='form';showTab('spots');});
  await editor.evaluate(()=>document.getElementById('connection-dialog')?.close());
  editor.on('dialog',d=>d.type()==='prompt'?d.accept(d.defaultValue()):d.accept());
  await editor.getByRole('button',{name:'別方向用に複製',exact:true}).click();
  const copied=await editor.evaluate(()=>({row:state.spots[1],links:state.course_spots.length}));
  assert.equal(copied.row.spot_id,'Kaneboshi_copy1');assert.equal(copied.row.shared_media_id,'Kaneboshi');assert.equal(copied.row.audio_arrive_txt,'元到着');assert.equal(copied.row.photo_url,'');assert.equal(copied.links,0);checks.push('Editor実ボタン複製・原稿保持・URL空・コース未追加');
  await editor.evaluate(()=>{selectedRow.spots=1;duplicateSpot(1);});assert.equal(await editor.evaluate(()=>state.spots[2].shared_media_id),'Kaneboshi');checks.push('再コピーの参照平坦化');
  await editor.screenshot({path:path.join(evidence,'spot-media-editor.png')});
  const matrix=await editor.evaluate(async()=>{const result=await checkMatrixCandidates(editorSpotCandidates(state.spots[1].spot_id,'photo_url',state.spots[1].photo_url));return {kind:result.ok?'ok':'empty',url:result.url};});assert.equal(matrix.kind,'ok');assert.equal(matrix.url,'https://custom.test/photo.webp');checks.push('Editor素材確認も共通任意URL解決');
  await editor.evaluate(()=>{state.courses=[{course_id:'north',course_name:'北からのコース'},{course_id:'east',course_name:'東からのコース'}];state.course_spots=[{course_id:'north',spot_id:'Kaneboshi',order:'1'},{course_id:'east',spot_id:'Kaneboshi',order:'1'}];window.originalLinks=JSON.stringify(state.course_spots);showTab('courses');});
  const openRoute=async()=>{await editor.evaluate(()=>showTab('courses'));await editor.locator('.cc-head').first().click();await editor.getByRole('button',{name:'巡回順',exact:true}).first().click();};
  await openRoute();await editor.getByRole('button',{name:'音声を編集',exact:true}).first().click();
  assert.equal(await editor.evaluate(()=>currentTab),'spots');assert.equal(await editor.evaluate(()=>state.spots[selectedRow.spots].spot_id),'Kaneboshi');
  assert.equal(await editor.locator('[data-key="audio_approach_txt"]').isVisible(),true);assert.equal(await editor.locator('[data-key="audio_arrive_url"]').isVisible(),true);
  assert.match(await editor.locator('#notif').textContent(),/複数コースで共用中/);checks.push('コース巡回順から実スポット音声フォームへ移動・複数コース共用警告');
  await openRoute();editor.removeAllListeners('dialog');editor.on('dialog',d=>d.dismiss());
  const countBefore=await editor.evaluate(()=>state.spots.length);await editor.getByRole('button',{name:'別方向用に複製',exact:true}).first().click();
  assert.equal(await editor.evaluate(()=>state.spots.length),countBefore);assert.equal(await editor.evaluate(()=>JSON.stringify(state.course_spots)===originalLinks),true);checks.push('コースから別方向複製を取消してもスポットと巡回順は不変');
  editor.removeAllListeners('dialog');editor.on('dialog',d=>d.type()==='prompt'?d.accept('Kaneboshi_north'):d.accept());
  await editor.getByRole('button',{name:'別方向用に複製',exact:true}).first().click();
  assert.equal(await editor.evaluate(()=>state.spots[selectedRow.spots].spot_id),'Kaneboshi_north');assert.equal(await editor.evaluate(()=>JSON.stringify(state.course_spots)===originalLinks),true);
  assert.equal(await editor.locator('[data-key="audio_approach_txt"]').isVisible(),true);checks.push('コースから別方向複製成功・音声フォーム表示・元の巡回順を保持');
  for(const width of [1280,390]){
    await editor.setViewportSize({width,height:900});
    assert.equal(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'audio form overflow at '+width);
    await editor.screenshot({path:path.join(evidence,'direction-audio-'+width+'.png'),fullPage:true});
    await openRoute();
    assert.equal(await editor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'course route overflow at '+width);
    for(const name of ['音声を編集','別方向用に複製']){const box=await editor.getByRole('button',{name,exact:true}).first().boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1,'route action clipped at '+width+': '+name);}
    await editor.screenshot({path:path.join(evidence,'direction-course-'+width+'.png'),fullPage:true});
    await editor.getByRole('button',{name:'音声を編集',exact:true}).first().click();
  }checks.push('デスクトップ1280px・モバイル390pxの音声フォームとコース巡回順にページ横溢れなし');
  await editor.setViewportSize({width:1280,height:900});
  await editor.evaluate(()=>{state.courses=[{course_id:'c',course_name:'プレビュー検証',is_published:'TRUE'}];state.course_spots=[{course_id:'c',spot_id:state.spots[1].spot_id,order:'1'}];appPreview.screen='spot';appPreview.courseId='c';appPreview.spotId=state.spots[1].spot_id;showTab('config');});
  await editor.waitForFunction(()=>appPreview.ready);
  const frame=editor.frameLocator('.app-preview-frame');await frame.locator('#photo-area img').waitFor();
  await frame.locator('#photo-area img').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.src==='https://custom.test/photo.webp')resolve();else{const timer=setTimeout(()=>reject(Error('preview photo unresolved')),5000);const observe=new MutationObserver(()=>{if(img.src==='https://custom.test/photo.webp'){clearTimeout(timer);observe.disconnect();resolve();}});observe.observe(img,{attributes:true});}}));checks.push('Editor隔離外観プレビューの共通写真');
  await editor.evaluate(()=>{state.config=[{key:'audio_repo',value:'invalid repo'}];state.spots=[{spot_id:'source',spot_name:'共通のみ',audio_explain_url:'https://custom.test/explain.mp3'},{spot_id:'copy',spot_name:'コピーのみ',shared_media_id:'source'}];state.courses=[];state.facilities=[];window.auditFixtureChecks=[];const check=checkUrlExists;checkUrlExists=url=>{auditFixtureChecks.push(url);return check(url);};const host=document.createElement('section');host.id='candidate-fixture';document.body.append(host);renderCourseMatrix(host,null,true);});
  const sharedExplainButton=editor.locator('#candidate-fixture tbody tr').nth(1).locator('td').nth(4).getByRole('button');assert.equal(await sharedExplainButton.count(),1);await sharedExplainButton.click();await editor.waitForFunction(()=>fixtureAudio.some(a=>a.url==='https://custom.test/explain.mp3'));checks.push('不正audio_repoでも共通任意URLの一覧再生ボタン');
  await editor.evaluate(()=>runMediaAudit());assert.equal(await editor.evaluate(()=>auditFixtureChecks.filter(u=>u==='https://custom.test/explain.mp3').length),2);checks.push('不正audio_repoでも共通解説URLを一括確認');
  await editor.evaluate(async()=>{state.config=[{key:'photo_repo',value:'owner/photos'}];state.spots=[{spot_id:'cardspot',spot_name:'カード確認'}];auditFixtureChecks=[];await runMediaAudit();});
  assert.equal(await editor.evaluate(()=>auditFixtureChecks.includes('https://owner.github.io/photos/cardspot_spcard.webp')),true);
  await editor.evaluate(async()=>{state.config.push({key:'card_image_url',value:'https://custom.test/global-card.webp'});auditFixtureChecks=[];await runMediaAudit();});
  assert.equal(await editor.evaluate(()=>auditFixtureChecks.includes('https://custom.test/global-card.webp')),true);checks.push('一括チェックは記念カードの規約ファイルと全体設定URLも維持');
  const survey=await context.newPage();survey.on('pageerror',e=>errors.push('survey: '+e.message));await survey.goto(base+'/survey.html');
  const kept=await survey.evaluate(async()=>{S.gasUrl='';S.spots=[{spot_id:'yotsuya_t-junction_01',spot_name:'既存',lat:'39',lng:'140',shared_media_id:'Kaneboshi',audio_arrive_txt:'保持原稿',audio_arrive_url:'https://custom.test/shared.mp3',custom_column:'保持'}];S.edit={type:'spot',id:S.spots[0].spot_id};document.getElementById('s-id').value=S.spots[0].spot_id;document.getElementById('s-name').value='更新';MK.s={getLatLng:()=>({lat:40,lng:141})};await submitSpot();return S.spots[0];});
  assert.equal(kept.spot_name,'更新');assert.equal(kept.shared_media_id,'Kaneboshi');assert.equal(kept.audio_arrive_txt,'保持原稿');assert.equal(kept.custom_column,'保持');checks.push('Survey実submit上書き経路で既存記号IDと共通素材・原稿保持');
  assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(evidence,'spot-media-browser-result.json'),JSON.stringify({checks,pageErrors:errors,externalPosts:posts,realSheetsWritten:false},null,2));console.log(JSON.stringify({passed:checks.length,checks,pageErrors:errors,externalPosts:posts},null,2));
 }finally{console.log(JSON.stringify({checks,errors,posts}));await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
