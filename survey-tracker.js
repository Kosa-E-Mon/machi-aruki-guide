(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SurveyTracking=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const distance=(a,b)=>{const r=Math.PI/180,x=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));};
  class Tracker{
    constructor(now=()=>performance.now()){this.now=now;this.reset();}
    reset(){this.state='idle';this.meters=0;this.activeMs=0;this.started=null;this.ended=null;this.anchor=null;this.last=null;this.interruptions=0;this.rejected=0;this.message='未開始';}
    start(){if(this.state!=='idle')return false;this.started=this.runAt=this.now();this.state='running';this.message='GPS待ち';return true;}
    pause(message='一時停止'){if(this.state!=='running')return false;this.activeMs+=Math.max(0,this.now()-this.runAt);this.state='paused';this.break(message);return true;}
    resume(){if(this.state!=='paused')return false;this.state='running';this.runAt=this.now();this.anchor=this.last=null;this.message='再開：新しいGPS待ち';return true;}
    finish(){if(!['running','paused'].includes(this.state))return false;if(this.state==='running')this.activeMs+=Math.max(0,this.now()-this.runAt);this.ended=this.now();this.state='finished';this.anchor=this.last=null;this.message='計測終了';return true;}
    break(message){this.anchor=this.last=null;this.message=message;if(this.state==='running'||this.state==='paused')this.interruptions++;}
    sample(pos,wallNow=Date.now()){
      if(this.state!=='running')return false;
      const c=pos.coords||{},p={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,t:pos.timestamp};
      if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180||!Number.isFinite(p.accuracy)||p.accuracy<0||p.accuracy>30||!Number.isFinite(p.t)||wallNow-p.t>10000||p.t>wallNow+1000){this.rejected++;this.break('精度不良・古い位置を除外：距離に欠落あり');return false;}
      if(this.last&&p.t<=this.last.t)return false;
      if(this.last&&p.t-this.last.t>15000){this.break('GPS取得途切れ：距離に欠落あり');}
      if(this.last){const dt=(p.t-this.last.t)/1000,d=distance(this.last,p);if(d>60||d/dt>3){this.rejected++;this.break('位置飛び・速すぎる移動を除外：距離に欠落あり');return false;}}
      this.last=p;
      if(Number.isFinite(c.speed)&&c.speed>=0&&c.speed<0.35){this.anchor=p;this.message='停止中のゆらぎを除外';return false;}
      if(!this.anchor){this.anchor=p;this.message='GPS基準位置を取得';return false;}
      const d=distance(this.anchor,p),min=Math.max(3,Math.max(this.anchor.accuracy,p.accuracy)*0.6);
      if(d<min){this.message='小さい位置ゆらぎを除外';return false;}
      if(d>60){this.anchor=p;this.rejected++;this.message='長い区間を除外：距離に欠落あり';this.interruptions++;return false;}
      this.meters+=d;this.anchor=p;this.message='計測中';return true;
    }
    snapshot(){const n=this.now();return {state:this.state,meters:this.meters,activeMs:this.activeMs+(this.state==='running'?Math.max(0,n-this.runAt):0),totalMs:this.started===null?0:Math.max(0,(this.ended??n)-this.started),interruptions:this.interruptions,rejected:this.rejected,message:this.message};}
  }
  const duration=ms=>{const s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(x=>String(x).padStart(2,'0')).join(':');};
  function mergeCourse(rows,draft,baseline){const i=rows.findIndex(r=>r.course_id===draft.course_id);if(baseline){if(i<0)throw Error('対象コースがなくなっています。再読込してください');for(const k of ['distance_m','duration_min'])if(String(rows[i][k]||'')!==String(baseline[k]||''))throw Error('距離・時間が他で変更されています。再読込して確認してください');}else if(i>=0)throw Error('同じIDが既に存在します');const out=rows.map(r=>({...r}));if(i>=0)out[i]={...out[i],distance_m:draft.distance_m,duration_min:draft.duration_min};else out.push({...draft,is_published:'FALSE'});return out;}
  function roundUp(value,step){if(!Number.isFinite(value)||value<0||!Number.isFinite(step)||step<=0)throw Error('数値と丸め幅を確認してください');return Math.max(0,Math.ceil((value-Number.EPSILON*Math.max(1,value)*4)/step)*step);}
  function parseCourseCsv(text){const lines=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){row.push(cell);lines.push(row);row=[];cell='';if(ch==='\r'&&text[i+1]==='\n')i++;}else cell+=ch;}if(quoted)throw Error('CSVの引用符が閉じていません');if(cell||row.length){row.push(cell);lines.push(row);}const headers=(lines.shift()||[]).map(x=>x.trim());if(!headers.includes('course_id'))throw Error('コースCSVの見出しを確認してください');return lines.filter(r=>r.some(x=>x!=='')).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));}
  return {Tracker,distance,duration,mergeCourse,roundUp,parseCourseCsv};
});
