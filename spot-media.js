/* Shared by the app, Editor and Survey. IDs are case-sensitive, never normalized. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.SpotMedia=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const shared=new Set(['photo_url','audio_arrive_url','audio_explain_url']);
  const roles=['start','approach','arrive','explain','next','goal'];
  const validId=id=>/^[A-Za-z][A-Za-z0-9_-]*$/.test(id);
  const str=v=>String(v||'').trim();
  function reference(spot,spots){
    let id=str(spot.shared_media_id),last=null;const seen=new Set([spot.spot_id]);
    while(id){
      if(!validId(id)||seen.has(id))return {id:null,error:'cycle-or-invalid'};
      seen.add(id);last=id;
      const record=spots.find(s=>s.spot_id===id);
      if(!record)return {id,record:null,error:'missing-record'};
      if(!str(record.shared_media_id))return {id,record,error:null};
      id=str(record.shared_media_id);
    }
    return {id:last,record:null,error:null};
  }
  function derived(id,key,cfg){
    if(!validId(id))return null;
    const photo=key==='photo_url',role=key.match(/^audio_(start|approach|arrive|explain|next|goal)_url$/)?.[1];
    if(!photo&&!role)return null;
    // explain has historically been explicit-URL-only.
    if(role==='explain')return null;
    const repo=str(cfg[photo?'photo_repo':'audio_repo']);
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))return null;
    const [owner,name]=repo.split('/');
    return `https://${owner}.github.io/${name}/${id}${photo?'.webp':'_'+role+'.mp3'}`;
  }
  function candidates(spot,key,spots,cfg){
    const urls=[],add=u=>{u=str(u);if(u&&!urls.includes(u))urls.push(u);};
    add(spot[key]);add(derived(spot.spot_id,key,cfg));
    if(shared.has(key)){
      const ref=reference(spot,spots);
      if(ref.id){add(ref.record?.[key]);add(derived(ref.id,key,cfg));}
    }
    return urls;
  }
  function duplicate(source,spots,newId){
    if(!validId(newId)||spots.some(s=>s.spot_id===newId))throw Error('IDが不正または重複しています');
    const copy=JSON.parse(JSON.stringify(source)),ref=reference(source,spots);
    if(source.shared_media_id&&!ref.id)throw Error('共通素材参照が循環または不正です。先に修正してください');
    copy.spot_id=newId;copy.shared_media_id=ref.id||source.spot_id;
    for(const key of Object.keys(copy))if(/_url$/.test(key))copy[key]='';
    return copy;
  }
  function suggest(source,spots){let n=1,id;do{id=source.spot_id+'_copy'+n++;}while(spots.some(s=>s.spot_id===id));return id;}
  function text(spot,role,fallback){return str(spot['audio_'+role+'_txt'])||fallback||'';}
  function mergeSurvey(original,edited){return {...original,...edited};}
  async function probe(url,fetcher=fetch){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{const r=await fetcher(url,{method:'HEAD',signal:controller.signal});return r.ok?'ok':r.status===404||r.status===410?'missing':'http';}
    catch{return 'network';}finally{clearTimeout(timer);}
  }
  function bindImage(img,urls,{convert=u=>u,onEmpty=()=>{}}={}){
    let index=0,stopped=false;const next=()=>{if(stopped)return;if(index>=urls.length){img.hidden=true;onEmpty();return;}img.hidden=false;img.src=convert(urls[index++]);};
    img.onerror=next;next();return ()=>{stopped=true;img.onerror=null;};
  }
  // A single cancellable operation owns Audio, TTS and all callbacks.
  function createPlayer(env){
    let generation=0,cleanup=()=>{};
    function stop(){generation++;cleanup();cleanup=()=>{};try{env.speech?.cancel();}catch{}env.state?.(false);}
    function play(urls,fallback,onEnd=()=>{}){
      stop();const token=generation;let finished=false,usedAudio=false;
      const live=()=>token===generation&&!finished;
      const done=()=>{if(!live())return;finished=true;cleanup();cleanup=()=>{};env.state?.(false);if(typeof onEnd==='function')onEnd({audio:usedAudio});};
      const tts=()=>{
        if(!live())return;
        if(!fallback){done();return;}
        if(!env.speech||!env.Utterance){env.issue?.('tts-unsupported');done();return;}
        let u,timer;let settled=false;
        const finish=()=>{if(settled||!live())return;settled=true;done();};
        try{
          u=new env.Utterance(fallback);u.lang='ja-JP';u.rate=0.88;
          const voice=env.speech.getVoices().find(v=>v.lang.startsWith('ja'));if(voice)u.voice=voice;
          u.onend=finish;u.onerror=()=>{if(!live()||settled)return;env.issue?.('tts');finish();};
          timer=setTimeout(()=>{if(!live()||settled)return;env.issue?.('tts-timeout');u.onend=u.onerror=null;try{env.speech.cancel();}catch{}finish();},Math.min(120000,10000+fallback.length*400));
          cleanup=()=>{clearTimeout(timer);u.onend=u.onerror=null;};
          env.state?.(true);env.log?.(fallback,null);env.speech.speak(u);
        }catch{if(live()&&!settled){env.issue?.('tts');finish();}}
      };
      let index=0;
      const attempt=()=>{
        if(!live())return;
        if(index>=urls.length){tts();return;}
        const url=urls[index++];let audio,timer,settled=false;
        const dispose=()=>{clearTimeout(timer);if(audio){audio.onended=audio.onerror=audio.onplaying=audio.onwaiting=audio.onstalled=null;try{audio.pause();}catch{}}};
        const failed=reason=>{
          if(settled||!live())return;settled=true;dispose();env.issue?.(reason,url);
          if(reason==='unavailable'&&env.probe){
            Promise.resolve(env.probe(url)).then(status=>{if(live()){env.issue?.(status,url);attempt();}},()=>{if(live())attempt();});
          }else if(reason==='blocked')tts();else attempt();
        };
        try{
          audio=new env.Audio(env.convert?env.convert(url):url);cleanup=dispose;
          audio.onended=()=>{if(settled||!live())return;settled=true;usedAudio=true;done();};
          audio.onerror=()=>failed(audio.error?.code===2?'network':'unavailable');
          const watchdog=()=>{clearTimeout(timer);timer=setTimeout(()=>failed('network-timeout'),15000);};
          audio.onplaying=()=>{clearTimeout(timer);if(live()){env.log?.(fallback,url);}};
          audio.onwaiting=audio.onstalled=watchdog;watchdog();env.state?.(true);
          Promise.resolve(audio.play()).catch(e=>failed(e?.name==='NotAllowedError'?'blocked':e?.name==='AbortError'?'aborted':'unavailable'));
        }catch{failed('unavailable');}
      };
      attempt();return token;
    }
    return {play,stop,get generation(){return generation;}};
  }
  return {roles,shared,validId,reference,derived,candidates,duplicate,suggest,text,mergeSurvey,probe,bindImage,createPlayer};
});
