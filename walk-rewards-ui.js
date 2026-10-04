'use strict';
(function(){
  const R=WalkRewards,channel=window.WALK_RELEASE_CHANNEL||'production',storageKey='lwg_cards_v1';
  const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
  function cards(){return R.mergeCards(lsGet(storageKey,{}),{});}
  function remember(spec){
    const saved=cards(),previous=saved[spec.id];
    saved[spec.id]={...spec,acquired_at:previous?.acquired_at||new Date().toISOString()};
    try{localStorage.setItem(storageKey,JSON.stringify(saved));return {saved:true,fresh:!previous};}catch{return {saved:false,fresh:false};}
  }
  async function saveImage(url,name,status){
    try{
      const response=await fetch(url);if(!response.ok)throw Error('image');
      const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('image');
      const objectUrl=URL.createObjectURL(blob),link=element('a');link.href=objectUrl;
      const ext=blob.type.includes('png')?'png':blob.type.includes('jpeg')?'jpg':blob.type.includes('svg')?'svg':blob.type.includes('gif')?'gif':blob.type.includes('avif')?'avif':'webp';
      link.download=(String(name||'card').replace(/[^a-zA-Z0-9_-]/g,'_')||'card')+'.'+ext;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);
      status.textContent='保存操作を開始しました。保存できたことを確認してから次へ進んでください。';return true;
    }catch{status.textContent='自動保存できませんでした。「画像を開く」から長押しなどで保存してください。';return false;}
  }
  function imagePanel(spec,onLoad){
    const panel=element('section',null,'reward-panel');
    panel.append(element('h3',spec.title));
    const status=element('p','画像を読み込んでいます…');status.setAttribute('role','status');panel.append(status);
    const image=element('img');image.alt=spec.title;image.loading=onLoad?'eager':'lazy';
    image.onload=()=>{status.textContent=spec.message||'';if(onLoad)onLoad(status);};
    image.onerror=()=>{status.textContent='画像を読み込めません。通信と画像URLを確認して再試行してください。';};
    const actions=element('div',null,'reward-actions');
    const retry=element('button','再読み込み');retry.type='button';retry.onclick=()=>{status.textContent='画像を読み込んでいます…';image.src=spec.image_url;};
    const download=element('button','画像を保存');download.type='button';download.onclick=()=>saveImage(spec.image_url,spec.spot_id||spec.course_id,status);
    const open=element('a','画像を開く');open.href=spec.image_url;open.target='_blank';open.rel='noopener noreferrer';
    actions.append(download,open,retry);panel.append(image,actions);image.src=spec.image_url;
    return panel;
  }
  let collection=null;
  window.openRewardCollection=function(){
    if(!collection){
      collection=element('section',null,'reward-collection');collection.setAttribute('role','dialog');collection.setAttribute('aria-modal','true');collection.setAttribute('aria-label','獲得カード');
      collection.onkeydown=e=>{if(e.key==='Escape')closeCollection();};document.body.append(collection);
    }
    collection.hidden=false;collection.replaceChildren();
    const body=element('div',null,'reward-collection-content'),close=element('button','閉じる','reward-open');close.onclick=closeCollection;
    body.append(close,element('h2','獲得カード'),element('p','この端末に保存されています。ブラウザーのデータを消すと失われます。御朱印帳の「データを保存」でバックアップできます。','reward-note'));
    const saved=Object.values(cards()).filter(c=>c.sheet_id===currentSheetId&&(channel==='preview'||!R.isTrue(c.test_mode)));
    saved.sort((a,b)=>String(b.acquired_at).localeCompare(String(a.acquired_at)));
    if(!saved.length)body.append(element('p','まだ獲得したカードはありません。'));
    saved.forEach(c=>{const panel=imagePanel({...c,message:c.area_name+' ／ '+c.course_name+'\n獲得日：'+new Date(c.acquired_at).toLocaleDateString()},null);body.append(panel);});
    collection.append(body);close.focus();
  };
  function closeCollection(){if(collection)collection.hidden=true;document.querySelector('.reward-open')?.focus();}
  const originalExplain=showExplain;
  showExplain=function(spot){
    originalExplain(spot);
    document.getElementById('spot-reward')?.remove();
    const spec=R.cardSpec(cfg,currentCourse,spot,currentSheetId);if(!spec)return;
    const panel=imagePanel(spec,status=>{
      const result=remember(spec);
      status.textContent=result.saved?(result.fresh?spec.message:spec.label+'は獲得済みです。'):'画像は表示できましたが、端末に保存できません。「画像を保存」を利用してください。';
    });
    const initialActions=panel.querySelector('.reward-actions');initialActions.querySelector('button').remove();initialActions.querySelector('a').remove();
    panel.append(element('p','説明・音声のあと「カードを保存して次へ」から保存できます。','reward-note'));
    panel.id='spot-reward';document.getElementById('explain-text').after(panel);
    document.getElementById('btn-next').textContent='🎁 カードを保存して次へ';
  };
  const downloadedThisWalk=new Set();let downloadDialog=null;
  const originalSelect=selectCourse;selectCourse=function(course){downloadedThisWalk.clear();return originalSelect(course);};
  const originalNext=nextSpot;
  nextSpot=function(){
    const spec=R.cardSpec(cfg,currentCourse,courseSpots[currentIdx],currentSheetId);
    if(!spec||downloadedThisWalk.has(spec.id))return originalNext();
    if(downloadDialog)return;
    const course=currentCourse,index=currentIdx;
    downloadDialog=element('section',null,'reward-collection');downloadDialog.setAttribute('role','dialog');downloadDialog.setAttribute('aria-modal','true');downloadDialog.setAttribute('aria-label','カードを保存して次へ');
    const body=element('div',null,'reward-collection-content');body.append(element('h2',spec.label+'を保存'));
    body.append(element('p','画像を保存したあと、保存できたことを確認して次へ進んでください。','reward-note'));
    const panel=imagePanel(spec,null),status=panel.querySelector('[role="status"]'),actions=panel.querySelector('.reward-actions');
    const save=actions.querySelector('button'),open=actions.querySelector('a');
    const confirm=element('button','画像を保存しました');confirm.disabled=true;
    save.onclick=async()=>{save.disabled=true;const ok=await saveImage(spec.image_url,spec.spot_id,status);save.disabled=false;if(ok)confirm.disabled=false;};
    open.onclick=()=>{confirm.disabled=false;};
    confirm.onclick=()=>{downloadedThisWalk.add(spec.id);downloadDialog.remove();downloadDialog=null;if(currentCourse===course&&currentIdx===index)originalNext();};
    const back=element('button','説明に戻る');back.onclick=()=>{downloadDialog.remove();downloadDialog=null;document.getElementById('btn-next').focus();};
    const skip=element('button','今回は保存せずに進む');skip.onclick=()=>{downloadedThisWalk.add(spec.id);downloadDialog.remove();downloadDialog=null;if(currentCourse===course&&currentIdx===index)originalNext();};
    actions.append(confirm,back,skip);body.append(panel);downloadDialog.append(body);document.body.append(downloadDialog);save.focus();
  };
  const originalGoal=showGoal;
  showGoal=function(){
    originalGoal();document.getElementById('goal-reward')?.remove();
    const image=R.safeImage(currentCourse?.cert_image_url||cfg.cert_image_url||R.derivedCardImage(cfg,cfg.cert_image_id));if(!image)return;
    const panel=imagePanel({title:'完歩記念画像',image_url:image,course_id:currentCourse.course_id,message:'完歩おめでとうございます。記念に保存できます。'},null);
    panel.id='goal-reward';document.querySelector('.cert-sho-buttons').before(panel);
  };
  const originalHome=renderHome;
  renderHome=function(){
    originalHome();
    const body=document.getElementById('home-body')||document.querySelector('#screen-home');
    if(channel==='preview')body.prepend(element('div','先行・テスト版：テスト設定のコースも表示します','reward-channel'));
    const button=element('button','🎁 獲得カードを見る','reward-open');button.onclick=openRewardCollection;body.append(button);
  };
  const originalBackup=createBackupPayload;createBackupPayload=function(){return {...originalBackup(),lwg_cards:cards()};};
  const originalNormalize=normalizeBackupPayload;normalizeBackupPayload=function(data){return {...originalNormalize(data),lwg_cards:R.mergeCards(data?.lwg_cards,{})};};
  const originalMerge=mergeBackup;mergeBackup=function(a,b){return {...originalMerge(a,b),lwg_cards:R.mergeCards(a?.lwg_cards,b?.lwg_cards)};};
  const originalApply=applyBackupData;applyBackupData=function(data){lsSet(storageKey,R.mergeCards(data?.lwg_cards,cards()));originalApply(data);};
})();
