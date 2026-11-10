const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function editor(){
  const nodes=new Map(),storage=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},textContent:''});return nodes.get(id);};
  const ctx={SpotMedia:require('../spot-media.js'),Audio:function(){},console,URL,Event,crypto:require('node:crypto').webcrypto,confirm:()=>true,
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

test('shared media preflight blocks missing headers and preserves drafts',()=>{
 const {run,ctx}=editor();ctx.rows=[{spot_id:'copy',shared_media_id:'root',audio_arrive_txt:'east'}];ctx.csv='spot_id,spot_name\nroot,Original';ctx.original=[{spot_id:'root',spot_name:'Original'}];
 assert.throws(()=>run('assertSpotMediaSaveReady(rows,csv,original)'),/shared_media_id/);assert.equal(ctx.rows[0].audio_arrive_txt,'east');
});
test('shared media preflight permits added empty columns but detects live content changes',()=>{
 const {run,ctx}=editor();ctx.rows=[{spot_id:'root',spot_name:'Original',shared_media_id:''},{spot_id:'copy',spot_name:'East',shared_media_id:'root'}];ctx.csv='spot_id,spot_name,shared_media_id\nroot,Original,';ctx.original=[{spot_id:'root',spot_name:'Original'}];
 assert.equal(run('assertSpotMediaSaveReady(rows,csv,original)'),true);ctx.csv='spot_id,spot_name,shared_media_id\nroot,Updated,';assert.throws(()=>run('assertSpotMediaSaveReady(rows,csv,original)'),/更新/);
});
test('shared media preflight rejects missing explain column without dropping unknown fields',()=>{
 const {run,ctx}=editor();ctx.rows=[{spot_id:'root',shared_media_id:'source',audio_explain_url:'https://media.test/a.mp3',unknown:'keep',udio_explain_url:'legacy'}];ctx.csv='spot_id,shared_media_id\nroot,source';ctx.original=[{spot_id:'root',shared_media_id:'source'}];assert.throws(()=>run('assertSpotMediaSaveReady(rows,csv,original)'),/audio_explain_url/);assert.equal(ctx.rows[0].unknown,'keep');assert.equal(ctx.rows[0].udio_explain_url,'legacy');
});
