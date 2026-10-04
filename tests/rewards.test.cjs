const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../walk-rewards.js');
test('test courses are hidden in production, including checkbox values; blank stays public',()=>{
  for(const value of [true,'TRUE',' true '])assert.equal(R.visibleCourse({test_mode:value},'production'),false);
  for(const value of [false,'FALSE','',undefined])assert.equal(R.visibleCourse({test_mode:value},'production'),true);
  assert.equal(R.visibleCourse({test_mode:'TRUE'},'preview'),true);
});
test('spot ID selects its own SP card without changing the description',()=>{
  const spot={spot_id:'manpukuji',spot_name:'萬福寺',description:'街の説明',card_enabled:'TRUE'};
  const card=R.cardSpec({photo_repo:'kosa-e-mon/local-walk-guide-photo'},{course_id:'walk'},spot,'sheet');
  assert.equal(card.image_url,'https://kosa-e-mon.github.io/local-walk-guide-photo/manpukuji_spcard.webp');
  assert.equal(spot.description,'街の説明');
  assert.equal(R.cardSpec({}, {course_id:'walk'}, {...spot,card_enabled:''},'sheet'),null);
  assert.equal(R.cardSpec({photo_repo:'owner/repo'}, {course_id:'walk'}, {...spot,card_enabled:'FALSE'},'sheet'),null);
  assert.equal(R.cardSpec({}, {course_id:'walk'}, {...spot,card_image_url:'javascript:alert(1)'},'sheet'),null);
});
test('explicit image overrides conventions; saved metadata separates sheets and courses',()=>{
  const config={photo_repo:'owner/repo'},spot={spot_id:'s',card_enabled:true,card_image_url:'https://example.com/custom.png'};
  const a=R.cardSpec(config,{course_id:'a'},spot,'sheet1'),b=R.cardSpec(config,{course_id:'b'},spot,'sheet1'),c=R.cardSpec(config,{course_id:'a'},spot,'sheet2');
  assert.equal(a.image_url,spot.card_image_url);assert.notEqual(a.id,b.id);assert.notEqual(a.id,c.id);
  const old={...a,acquired_at:'2026-10-01'},recent={...a,acquired_at:'2026-10-05'};
  const merged=R.mergeCards({a:old},{a:recent,b:{...b,acquired_at:'2026-10-02'}});
  assert.equal(Object.keys(merged).length,2);assert.equal(merged[a.id].acquired_at,old.acquired_at);
  assert.equal(JSON.stringify(merged).includes('data:image'),false);
});
test('all local scripts parse and release channel is explicit',()=>{
  const root=path.join(__dirname,'..');
  for(const name of ['index.html','editor.html']){
    const html=fs.readFileSync(path.join(root,name),'utf8');
    for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script[1],{filename:name});
    for(const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g))if(!m[1].startsWith('http'))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);
  }
  for(const name of ['walk-rewards.js','walk-rewards-ui.js','release-channel.js','editor-ui.js'])new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
  const channel={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'release-channel.js'),'utf8'),channel);
  assert.ok(['production','preview'].includes(channel.window.WALK_RELEASE_CHANNEL));
});
