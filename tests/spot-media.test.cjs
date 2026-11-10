const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../spot-media.js');
const cfg={photo_repo:'owner/photos',audio_repo:'owner/audio'};
const source={spot_id:'Kaneboshi',spot_name:'金星',photo_url:'https://custom/photo',audio_arrive_url:'https://custom/arrival',audio_next_url:'https://direction/next',description:'説明',audio_arrive_txt:'到着原稿',audio_next_txt:'東へ',lat:'39',lng:'140',arrive_dist:'15'};
test('copy flattens common reference, copies text independently, clears dedicated URLs',()=>{
 const a=M.duplicate(source,[source],'Kaneboshi_01'),b=M.duplicate(a,[source,a],'Kaneboshi_02');
 assert.equal(a.shared_media_id,'Kaneboshi');assert.equal(b.shared_media_id,'Kaneboshi');
 for(const key of ['description','audio_arrive_txt','audio_next_txt','lat','lng','arrive_dist'])assert.equal(a[key],source[key]);
 assert.equal(a.photo_url,'');assert.equal(a.audio_arrive_url,'');assert.equal(a.audio_next_url,'');
 a.description='別説明';assert.equal(source.description,'説明');assert.equal(M.suggest(source,[source,{spot_id:'Kaneboshi_copy1'}]),'Kaneboshi_copy2');
 assert.throws(()=>M.duplicate(source,[source],'Kaneboshi'));assert.throws(()=>M.duplicate(source,[source],'../bad'));
});
test('each role resolves dedicated URL and file before common record URL and file',()=>{
 const copy=M.duplicate(source,[source],'copy');copy.photo_url='https://own/photo';
 assert.deepEqual(M.candidates(copy,'photo_url',[source,copy],cfg),['https://own/photo','https://owner.github.io/photos/copy.webp','https://custom/photo','https://owner.github.io/photos/Kaneboshi.webp']);
 assert.deepEqual(M.candidates(copy,'audio_arrive_url',[source],cfg),['https://owner.github.io/audio/copy_arrive.mp3','https://custom/arrival','https://owner.github.io/audio/Kaneboshi_arrive.mp3']);
 assert.deepEqual(M.candidates(copy,'audio_next_url',[source],cfg),['https://owner.github.io/audio/copy_next.mp3']);
 assert.equal(M.text(copy,'next','定型文'),'東へ');assert.equal(M.text(copy,'goal','定型文'),'定型文');
});
test('missing source can resolve its named file; cycles cannot leak shared assets',()=>{
 const a={spot_id:'a',shared_media_id:'b'},b={spot_id:'b',shared_media_id:'a',photo_url:'https://bad'};
 assert.deepEqual(M.candidates(a,'photo_url',[a,b],cfg),['https://owner.github.io/photos/a.webp']);
 assert.throws(()=>M.duplicate(a,[a,b],'new'));
 assert.deepEqual(M.candidates(a,'photo_url',[a],cfg),['https://owner.github.io/photos/a.webp','https://owner.github.io/photos/b.webp']);
 assert.equal(M.reference({...a,shared_media_id:'../bad'},[a]).id,null);
});
test('existing mixed-case, hyphen and unsuffixed IDs are unchanged and never inferred',()=>{
 for(const id of ['kuranoeki_komegura','yotsuya_t-junction_01','Kaneboshi']){
  assert.ok(M.validId(id));assert.equal(M.candidates({spot_id:id},'photo_url',[],cfg)[0],`https://owner.github.io/photos/${id}.webp`);
  assert.equal(M.candidates({spot_id:id},'photo_url',[],cfg).length,1);
 }
});
test('Survey partial updates preserve common ID, all scripts, URLs and unknown columns',()=>{
 const row={...source,shared_media_id:'root',custom_column:'keep'};
 const result=M.mergeSurvey(row,{spot_name:'新名',lat:'40'});
 assert.equal(result.shared_media_id,'root');assert.equal(result.audio_next_txt,'東へ');assert.equal(result.custom_column,'keep');assert.equal(result.lat,'40');
});
const tick=()=>new Promise(r=>setImmediate(r));
function player(){
 const audios=[],utterances=[],issues=[],logs=[];let states=[];
 class Audio{constructor(url){this.url=url;audios.push(this);}play(){return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}pause(){this.paused=true;}}
 class Utterance{constructor(text){this.text=text;utterances.push(this);}}
 const speech={cancel(){},getVoices:()=>[],speak(){}};
 const p=M.createPlayer({Audio,Utterance,speech,state:v=>states.push(v),issue:(...a)=>issues.push(a),log:(...a)=>logs.push(a)});
 return {p,audios,utterances,issues,logs,states,speech};
}
test('missing dedicated audio uses shared audio once despite error and promise rejection',async()=>{
 const {p,audios,utterances}=player();let done=0,result;
 p.play(['dedicated','common'],'原稿',r=>{done++;result=r;});
 const first=audios[0],error=first.onerror;error();first.reject(Error('unsupported'));await tick();
 assert.equal(audios.length,2);assert.equal(utterances.length,0);
 audios[1].onended();assert.equal(done,1);assert.equal(result.audio,true);p.stop();
});
test('no audio and network failure fall back to copied text; TTS errors complete once',async()=>{
 const {p,audios,utterances,issues}=player();let done=0;
 p.play(['one','two'],'コピー先原稿',()=>done++);
 audios[0].error={code:2};audios[0].onerror();audios[1].onerror();
 assert.equal(utterances[0].text,'コピー先原稿');const end=utterances[0].onend;
 utterances[0].onerror();end();assert.equal(done,1);assert.equal(issues[0][0],'network');p.stop();
});
test('browser rejection goes directly to TTS without retrying shared files',async()=>{
 const {p,audios,utterances,issues}=player();p.play(['own','common'],'原稿');
 audios[0].reject(Object.assign(Error(),{name:'NotAllowedError'}));await tick();
 assert.equal(audios.length,1);assert.equal(utterances.length,1);assert.equal(issues[0][0],'blocked');p.stop();
});
test('stop and rapid replay cancel stale Audio/TTS callbacks and sequences',async()=>{
 const {p,audios,utterances}=player();let old=0,next=0;
 p.play(['old'],'古い原稿',()=>old++);const stale=audios[0].onended;
 p.play([],'新原稿',()=>next++);stale();audios[0].reject(Error());await tick();
 assert.equal(old,0);assert.equal(audios.length,1);assert.equal(utterances.length,1);
 const staleTTS=utterances[0].onend;p.stop();staleTTS();assert.equal(next,0);
});
test('TTS unavailable or throwing releases controls and callbacks',()=>{
 let done=0;const issues=[];const p=M.createPlayer({Audio:function(){},state(){},issue:reason=>issues.push(reason)});p.play([],'原稿',()=>done++);assert.equal(done,1);assert.deepEqual(issues,['tts-unsupported']);
 const q=M.createPlayer({Audio:function(){},Utterance:function(){throw Error();},speech:{cancel(){},getVoices(){return[];}}});q.play([],'原稿',()=>done++);assert.equal(done,2);q.stop();
});
test('TTS errors notify only once; canceled and replaced utterances cannot notify',()=>{
 const {p,utterances,issues}=player();let done=0;
 p.play([],'最初',()=>done++);const oldError=utterances[0].onerror;p.stop();oldError();assert.deepEqual(issues,[]);assert.equal(done,0);
 p.play([],'次',()=>done++);const nextError=utterances[1].onerror;
 p.play([],'新しいスポット',()=>done++);nextError();assert.deepEqual(issues,[]);
 const error=utterances[2].onerror;error();error();assert.equal(done,1);assert.deepEqual(issues,[['tts']]);p.stop();
});
test('null callbacks and empty media are safe',()=>{const {p}=player();p.play([],'',null);p.stop();});
test('image 404 exhausts finite candidates and hides safely',()=>{
 const img={},urls=['own','shared'];let empty=0;
 M.bindImage(img,urls,{onEmpty:()=>empty++});assert.equal(img.src,'own');img.onerror();assert.equal(img.src,'shared');img.onerror();assert.equal(img.hidden,true);assert.equal(empty,1);
});
test('HEAD distinguishes absent, HTTP failures, and network failures',async()=>{
 assert.equal(await M.probe('x',async()=>({ok:false,status:404})),'missing');
 assert.equal(await M.probe('x',async()=>({ok:false,status:503})),'http');
 assert.equal(await M.probe('x',async()=>{throw Error();}),'network');
});
