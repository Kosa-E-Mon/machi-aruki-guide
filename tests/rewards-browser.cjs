// Browser regression test with synthetic course data; never writes to Google Sheets.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const root=path.join(__dirname,'..');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
 const target=path.resolve(root,name);if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(target,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});res.end(err?'missing':data);});
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROME_PATH});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#f4efe4"/><text x="25" y="130" font-size="30">SP CARD</text></svg>';
 const csv={
 config:'key,value\napp_title,検証用のまち\nphoto_repo,owner/photos\ncard_label,クラカード\nnext_lock_sec,1\ncert_image_id,completion',
 courses:'course_id,course_name,test_mode,recommended\nnormal,通常コース,FALSE,TRUE\ntesting,試験コース,TRUE,TRUE',
 spots:'spot_id,spot_name,lat,lng,description,card_title\ns1,一番目,39,140,街の説明を残す,一番目のカード\ns2,二番目,39.001,140.001,次の説明,',
 course_spots:'course_id,spot_id,order,card_enabled\nnormal,s1,1,TRUE\nnormal,s2,2,\ntesting,s1,1,TRUE',
 facilities:'facility_id,facility_name,lat,lng'
 };
 await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.pathname.includes('leaflet')&&url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:"const chain=new Proxy({}, {get:(o,k)=>()=>chain});window.L=new Proxy({}, {get:(o,k)=>k==='DomEvent'?chain:()=>chain});"});
   if(url.pathname.endsWith('/gviz/tq'))return route.fulfill({contentType:'text/csv',body:csv[url.searchParams.get('sheet')]||''});
   if(url.pathname.endsWith('.webp'))return route.fulfill({contentType:'image/svg+xml',body:svg});
   return route.fulfill({status:404,body:''});
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const address='http://127.0.0.1:'+server.address().port;
 await page.goto(address+'/index.html');await page.waitForSelector('#screen-home.active');
 const channel=await page.evaluate(()=>window.WALK_RELEASE_CHANNEL);
 assert.equal(await page.evaluate(()=>allCourses.some(c=>c.course_id==='testing')),channel==='preview');
 // Exercise both recommendations and GPS lists even if an unfiltered caller supplies test data.
 await page.evaluate(()=>{
   allCourses.push({course_id:'hidden-test',course_name:'非公開テスト',test_mode:'TRUE',recommended:true,display_order:1});
   renderHome();
 });
 assert.equal((await page.locator('#home-body').textContent()).includes('非公開テスト'),channel==='preview');
 await page.evaluate(()=>renderNearbySection(document.getElementById('nearby-section'),allCourses,{}, {lat:39,lng:140}));
 assert.equal((await page.locator('#nearby-section').textContent()).includes('試験コース'),channel==='preview');
 await page.evaluate(()=>{
   window.savedTestCourses=allCourses;
   allCourses=[{course_id:'testing',course_name:'試験コース',test_mode:'TRUE',recommended:true}];
   renderHome();
 });
 assert.equal(await page.locator('#home-body .courses-empty').count(),channel==='production'?1:0);
 assert.equal(await page.locator('#home-body .course-card').count(),channel==='production'?0:2);
 assert.equal(await page.locator('#home-body .btn-all-courses').count(),channel==='production'?0:1);
 await page.evaluate(()=>renderNearbySection(document.getElementById('nearby-section'),allCourses,{}, {lat:39,lng:140}));
 assert.equal(await page.locator('#nearby-section .courses-empty').count(),channel==='production'?1:0);
 if(channel==='production')assert.equal(await page.locator('.courses-empty').textContent(),'コースはまだ設定されていません。');
 await page.evaluate(()=>{allCourses=[];renderHome();});
 assert.equal(await page.locator('.courses-empty').count(),1);
 await page.evaluate(()=>{allCourses=window.savedTestCourses.filter(c=>c.course_id!=='hidden-test');renderHome();});
 await page.evaluate(()=>{currentCourse=allCourses.find(c=>c.course_id==='normal');courseSpots=buildCourseSpots(currentCourse);currentIdx=0;showExplain(courseSpots[0]);});
 await page.waitForFunction(()=>document.getElementById('spot-reward')?.textContent.includes('ゲット'));
 assert.equal(await page.locator('#explain-text').textContent(),'街の説明を残す');
 assert.ok((await page.evaluate(()=>createBackupPayload())).lwg_cards);
 await page.locator('#btn-next').click();
 const dialog=page.getByRole('dialog',{name:'カードを保存して次へ'});
 assert.equal(await dialog.isVisible(),true);assert.equal(await page.evaluate(()=>currentIdx),0);
 assert.equal(await dialog.getByRole('button',{name:'画像を保存しました',exact:true}).isEnabled(),false);
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'画像を保存',exact:true}).click();
 assert.ok((await download).suggestedFilename().startsWith('s1.'));
 await dialog.getByRole('button',{name:'画像を保存しました',exact:true}).click();
 assert.equal(await page.evaluate(()=>currentIdx),1);
 await page.evaluate(()=>showExplain(courseSpots[1]));assert.equal(await page.locator('#spot-reward').count(),0);
 await page.evaluate(()=>showGoal());await page.waitForSelector('#goal-reward img');
 assert.ok((await page.locator('#goal-reward img').getAttribute('src')).endsWith('completion_spcard.webp'));
 await page.evaluate(()=>{goHome();openRewardCollection();});
 assert.ok((await page.getByRole('dialog',{name:'獲得カード'}).textContent()).includes('一番目のカード'));
 await page.getByRole('dialog',{name:'獲得カード'}).getByRole('button',{name:'閉じる'}).click();
 await page.goto(address+'/editor.html');
 await page.getByRole('button',{name:'サンプルで試す',exact:true}).click();
 await page.evaluate(()=>showTab('courses'));
 assert.ok((await page.locator('body').textContent()).includes('テスト用コース'));
 await page.evaluate(()=>{state.course_spots[0].card_enabled='TRUE';exportSheet('course_spots');});
 const restored=await page.evaluate(()=>state.course_spots[0].card_enabled);assert.equal(restored,'TRUE');
 assert.deepEqual(errors,[]);
 console.log(channel+': filtering, descriptions, card save-before-next, completion image, collection, editor OK');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
