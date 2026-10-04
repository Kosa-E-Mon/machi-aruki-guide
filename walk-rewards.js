'use strict';
(function(root){
  const isTrue=value=>value===true||String(value||'').trim().toUpperCase()==='TRUE';
  function visibleCourse(course,channel){return channel==='preview'||!isTrue(course.test_mode);}
  function safeImage(value){
    try{const u=new URL(String(value||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}
  }
  function cardSpec(config,course,spot,sheetId){
    if(!isTrue(spot.card_enabled))return null;
    const image=safeImage(spot.card_image_url||config.card_image_url||derivedCardImage(config,spot.spot_id));
    if(!image)return null;
    return {id:JSON.stringify([sheetId,course.course_id,spot.spot_id]),sheet_id:sheetId,
      course_id:course.course_id,spot_id:spot.spot_id,test_mode:isTrue(course.test_mode),
      label:String(config.card_label||'記念カード'),title:String(spot.card_title||spot.spot_name||'記念カード'),
      message:String(config.card_message||((config.card_label||'記念カード')+'をゲットしました！')),
      image_url:image,course_name:course.course_name||'',area_name:config.area_name||config.app_title||''};
  }
  function derivedCardImage(config,id){
    const repo=String(config.photo_repo||'').trim();
    if(!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/.test(repo)||!id)return '';
    const [owner,name]=repo.split('/');
    return `https://${owner}.github.io/${name}/${encodeURIComponent(String(id).trim())}_spcard.webp`;
  }
  function mergeCards(a,b){
    const out={};
    for(const source of [a,b])for(const card of Object.values(source||{})){
      if(!card||typeof card!=='object'||typeof card.sheet_id!=='string'||typeof card.course_id!=='string'||typeof card.spot_id!=='string'||!safeImage(card.image_url)||!card.acquired_at)continue;
      const id=JSON.stringify([card.sheet_id,card.course_id,card.spot_id]);
      if(!out[id]||String(card.acquired_at)<String(out[id].acquired_at))out[id]={...card,id,image_url:safeImage(card.image_url)};
    }
    return out;
  }
  const api={isTrue,visibleCourse,safeImage,cardSpec,mergeCards,derivedCardImage};
  root.WalkRewards=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
