/* Presentation layer for the existing editor. All edits use its data and save pipeline. */
const workspace = {ready:false, home:true, demo:false, connected:null, recordTab:{spots:'基本情報',facilities:'基本情報'}, search:{spots:'',facilities:''}, configSection:'', configSearch:''};
const UI_SHEETS=['config','courses','course_spots','spots','facilities'];
const uiEl=id=>document.getElementById(id);
function uiNode(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function uiButton(text,action,help,cls='btn btn-o'){const b=uiNode('button',cls,text);b.type='button';b.onclick=action;if(help)b.dataset.help=help;return b;}
function uiRead(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function uiStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('このブラウザーでは接続情報を記憶できません',true);}}
function uiToken(sid){try{return localStorage.getItem('lwg_editor_gas_token__'+sid)||'';}catch{return '';}}

function initEditorWorkspace(){
  const header=document.querySelector('.hdr');
  const sheet=uiEl('sheet-url'),gas=uiEl('gas-url'),token=uiEl('gas-token');
  gas.oninput=null;token.oninput=null;token.type='password';token.autocomplete='off';
  const status=uiEl('gas-status-lbl');
  const qr=document.querySelector('.hdr-qr'),sizes=document.querySelector('.hdr-size');
  const logo=uiNode('div','logo','🗺 まちあるきエディター');
  header.replaceChildren(logo,uiNode('span','workspace-region','未接続'),uiNode('div','spacer'));
  header.append(uiButton('⚙ 接続設定',openConnection,'編集する地域や接続情報を変更します'));
  const nav=uiNode('nav','workspace-tabs');nav.setAttribute('aria-label','編集するデータ');
  nav.append(uiButton('⌂ ホーム',showWorkspaceHome,'編集する内容を選びます','workspace-tab active'));
  for(const [key,label] of [['spots','📍 スポット'],['courses','🗺 コース'],['facilities','🏛 施設'],['config','⚙ アプリ設定']]){
    const b=uiButton(label,()=>showTab(key),label+'を編集します','workspace-tab');
    b.dataset.sheet=key;
    const old=uiEl('nav-'+key);old.removeAttribute('id');b.id='nav-'+key;
    b.append(uiEl('badge-'+key),uiEl('dot-'+key));nav.append(b);
  }
  const ribbons=uiNode('div','ribbon-tabs');ribbons.setAttribute('aria-label','操作の分類');
  const panels={};
  for(const [key,label] of [['edit','編集'],['view','表示'],['data','データ・メディア'],['help','ヘルプ']]){
    const b=uiButton(label,()=>selectRibbon(key),null,'ribbon-tab');b.dataset.ribbon=key;ribbons.append(b);
    const panel=uiNode('div','ribbon-tools');panel.id='ribbon-'+key;panel.hidden=key!=='edit';panels[key]=panel;
  }
  const command=(text,fn,help,cls)=>{const b=uiButton(text,fn,help,cls);b.dataset.requiresData='true';return b;};
  const save=command('💾 保存',()=>saveCurrentSheet(),'表示中のシートの変更内容を確認して保存します','btn primary');save.id='workspace-save';
  panels.edit.append(save,command('＋ 新規追加',()=>{if(currentTab==='courses')addCourse();else if(SCHEMAS[currentTab]){workspace.search[currentTab]='';addRow(currentTab);enhanceEditor();}else notify('スポット・コース・施設で追加できます');},'現在の一覧に新しい項目を追加します'),command('↶ 変更を戻す',()=>resetChanges(),'表示中のシートを読み込み時の状態へ戻します'));
  panels.view.append(uiButton('▤ 地図・プレビュー',()=>{document.body.classList.toggle('panel-hidden');setTimeout(()=>leafletMap?.invalidateSize(),0);},'右側の地図・プレビューを表示／非表示にします'),uiButton('ⓘ 項目の説明',()=>document.body.classList.toggle('show-help'),'説明文と項目キーの常時表示を切り替えます'),sizes);
  const oldBar=document.querySelector('.ed-bar');
  [...oldBar.querySelectorAll(':scope > button')].forEach(b=>{
    if(b.id==='save-btn'){b.hidden=true;return;}
    b.dataset.requiresData='true';b.dataset.help=b.textContent.trim();panels.data.append(b);
  });
  panels.data.append(command('⬇ 全CSV保存',exportAll,'すべてのシートをCSVファイルとして保存します'),qr,uiButton('▦ QR表示',showQrModal,'アプリを開くQRコードを表示します'));
  panels.help.append(uiButton('？ 使い方',showWorkspaceHelp,'接続から保存までの手順を確認します'),uiButton('⚙ GAS設定方法',()=>{openConnection();showGasModal();},'接続先のGAS設定手順を確認します'));
  header.after(nav,ribbons,...Object.values(panels));
  uiEl('save-btn').hidden=true;
  const dialog=uiNode('dialog','connection-dialog');dialog.id='connection-dialog';
  dialog.innerHTML='<div class="home-eyebrow">MACHI ARUKI GUIDE</div><h1>編集する地域に接続</h1><p>接続情報はここでまとめて設定します。GASとキーは直接保存する場合に入力してください。</p><label for="connection-recent">保存済みの接続先</label><select id="connection-recent" class="workspace-input"><option value="">新しい接続先</option></select><label for="connection-name">接続名・地域名</label><input id="connection-name" class="workspace-input" placeholder="例：増田まちあるき"><div id="connection-fields"></div><div class="connection-status" id="connection-status" role="status"></div><details><summary>接続の準備・トークンについて</summary><p>スプレッドシートの読み取り設定と、書き込み用GASのデプロイが必要です。キーは地域ごとに管理されます。接続テストではURLの応答を確認し、キーの有効性は実際の保存時に確認します。</p><div id="connection-setup"></div></details><div class="connection-actions" id="connection-actions"></div>';
  document.body.append(dialog);
  dialog.append(uiEl('gas-modal'));
  for(const [input,label] of [[sheet,'スプレッドシートのURL または ID'],[gas,'GASのURL（直接保存する場合）'],[token,'書き込みトークンキー']]){
    const l=uiNode('label','',label);l.htmlFor=input.id;uiEl('connection-fields').append(l,input);
  }
  uiEl('connection-fields').append(status);
  uiEl('connection-setup').append(uiButton('GAS設定方法',showGasModal,'このシートのGAS設定コードを表示します'),uiButton('接続テスト',testDraftConnection,'GASのURLが応答するか確認します'));
  uiEl('connection-actions').append(uiButton('サンプルで試す',openWorkspaceDemo,'架空のデータで操作を確認します。実際のシートへは保存しません'),uiButton('キャンセル',closeConnection),uiButton('接続して開く',connectWorkspace,null,'btn btn-p'));
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeConnection();});
  uiEl('connection-recent').onchange=e=>{
    const profile=uiRead('lwg_editor_connections',[]).find(p=>p.sid===e.target.value);
    uiEl('connection-name').value=profile?.name||'';
    sheet.value=profile?.sid||'';gas.value=profile?.gas||'';token.value=profile?uiToken(profile.sid):'';
    workspace.draftSid=profile?.sid||null;
    uiEl('connection-status').textContent='';
  };
  sheet.addEventListener('change',()=>{
    const sid=parseSheetId(sheet.value);
    if(sid!==workspace.draftSid){gas.value='';token.value=sid?uiToken(sid):'';workspace.draftSid=sid;}
  });
  document.body.classList.add('workspace-ready');
  workspace.ready=true;
  installWorkspaceHelp();
  selectRibbon('edit');showWorkspaceHome();openConnection();
}

function selectRibbon(key){
  document.querySelectorAll('.ribbon-tab').forEach(b=>{const active=b.dataset.ribbon===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('.ribbon-tools').forEach(p=>p.hidden=p.id!=='ribbon-'+key);
}
function setWorkspaceCommands(){
  document.querySelectorAll('[data-requires-data]').forEach(b=>b.disabled=!state.loaded||workspace.home);
  if(uiEl('workspace-save'))uiEl('workspace-save').disabled=!state.loaded||workspace.home||workspace.demo;
}
function showWorkspaceHome(){
  workspace.home=true;document.body.classList.add('home-view');
  document.querySelectorAll('.workspace-tab').forEach(b=>{b.classList.toggle('active',!b.dataset.sheet);b.setAttribute('aria-current',!b.dataset.sheet?'page':'false');});
  const home=uiNode('section','workspace-home');
  home.append(uiNode('div','home-eyebrow',workspace.demo?'SAMPLE WORKSPACE':'YOUR WORKSPACE'),uiNode('h1','',state.loaded?(getCfg('app_title')||'まちあるきガイド'):'まちの魅力を、ひとつずつ。'),uiNode('p','',state.loaded?'編集したい内容を選んでください。変更内容を確認してから、シートごとに保存できます。':'接続先を設定すると、スポットやコースを編集できます。'));
  const grid=uiNode('div','home-grid');
  for(const [key,icon,label,desc] of [['spots','📍','スポット','場所・説明・写真・音声を編集'],['courses','🗺','コース','巡回するスポットと順番を編集'],['facilities','🏛','施設','案内所や休憩場所などを編集'],['config','⚙','アプリ設定','名称・デザイン・修了証を設定']]){
    const b=uiButton('',()=>state.loaded?showTab(key):openConnection(),null,'home-card');
    b.append(uiNode('div','home-icon',icon),uiNode('strong','',label),uiNode('span','',desc+(state.loaded?' · '+state[key].length+'件':'')));grid.append(b);
  }
  home.append(grid);
  const pending=UI_SHEETS.filter(s=>state.loaded&&JSON.stringify(state[s])!==JSON.stringify(state.originals[s]));
  home.append(uiNode('div','home-note'+(pending.length?' changed':''),workspace.demo?'サンプルモード：この画面の操作は実際のスプレッドシートには反映されません。':pending.length?'未保存の変更：'+pending.map(s=>TAB_LABELS[s]||'コース構成').join('、'):'スイッチや入力欄の変更は、保存するまでスプレッドシートに反映されません。'));
  uiEl('ed-body').replaceChildren(home);setWorkspaceCommands();
}

function openConnection(){
  const d=uiEl('connection-dialog');if(d.open)return;
  const profiles=uiRead('lwg_editor_connections',[]);
  const recent=uiEl('connection-recent');recent.replaceChildren(new Option('新しい接続先',''));
  profiles.forEach(p=>recent.add(new Option(p.name||p.sid,p.sid)));
  const p=workspace.connected||profiles.find(x=>x.sid===uiRead('lwg_editor_last_connection',''))||null;
  uiEl('connection-name').value=p?.name||'';
  if(p){uiEl('sheet-url').value=p.sid;uiEl('gas-url').value=p.gas;uiEl('gas-token').value=workspace.connected?state.gasToken||'':uiToken(p.sid);recent.value=p.sid;}
  else if(parseSheetId(uiEl('sheet-url').value)){uiEl('gas-token').value=localStorage.getItem(gasTokenStorageKey())||'';}
  workspace.draftSid=parseSheetId(uiEl('sheet-url').value);
  uiEl('connection-status').textContent='';
  d.showModal();
}
function closeConnection(){
  if(workspace.connecting)return;
  if(workspace.connected){
    uiEl('sheet-url').value=workspace.connected.sid;uiEl('gas-url').value=workspace.connected.gas;uiEl('gas-token').value=state.gasToken||'';
  }
  uiEl('connection-dialog').close();
  closeGasModal();
}
function validGasUrl(url){if(!url)return true;try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
async function testDraftConnection(){
  const url=uiEl('gas-url').value.trim();
  if(!url||!validGasUrl(url)){uiEl('connection-status').textContent='GASのウェブアプリURL（https://script.google.com/macros/s/…/exec）を確認してください。';return;}
  uiEl('connection-status').textContent='接続を確認しています…';
  uiEl('connection-status').textContent=await gasPing(url)?'GASの応答を確認しました。キーの有効性は保存時に確認します。':'GASに接続できませんでした。URLと公開設定を確認してください。';
}
async function connectWorkspace(){
  const sid=parseSheetId(uiEl('sheet-url').value.trim()),gas=uiEl('gas-url').value.trim(),token=uiEl('gas-token').value.trim();
  if(!sid||!validGasUrl(gas)){uiEl('connection-status').textContent='スプレッドシートのURL／IDとGASのURLを確認してください。';return;}
  if(hasUnsavedChanges()&&!confirm('未保存の変更を破棄して接続先を読み込みますか？'))return;
  workspace.connecting=true;
  const buttons=[...uiEl('connection-dialog').querySelectorAll('button,input,select')];buttons.forEach(b=>b.disabled=true);
  uiEl('connection-status').textContent='データを読み込んでいます…';
  try{
    const ok=await loadData();
    if(!ok){uiEl('connection-status').textContent='読み込めませんでした。URLとシートの公開設定を確認してください。';return;}
    workspace.demo=false;state.gasUrl=gas||null;state.gasToken=token||null;state.gasConnected=false;
    if(gas){uiEl('connection-status').textContent='GASの応答を確認しています…';state.gasConnected=await gasPing(gas);}
    const name=uiEl('connection-name').value.trim()||getCfg('app_title')||sid;
    workspace.connected={sid,gas,name};workspace.search={spots:'',facilities:''};selectedRow={courses:null,spots:null,facilities:null};mapEditContext=null;
    const profiles=uiRead('lwg_editor_connections',[]).filter(p=>p.sid!==sid);
    uiStore('lwg_editor_connections',[workspace.connected,...profiles].slice(0,20));uiStore('lwg_editor_last_connection',sid);
    try{if(token)localStorage.setItem('lwg_editor_gas_token__'+sid,token);else localStorage.removeItem('lwg_editor_gas_token__'+sid);}catch{notify('キーをこのブラウザーに記憶できません',true);}
    document.querySelector('.workspace-region').textContent=name;
    updateGasUI();uiEl('connection-dialog').close();showWorkspaceHome();
  }finally{workspace.connecting=false;buttons.forEach(b=>b.disabled=false);}
}

// Convert boolean selects without changing blank/default values until explicitly edited.
function enhanceSwitches(root){
  root.querySelectorAll('select').forEach(select=>{
    const values=[...select.options].map(o=>o.value);
    if(values.length!==3||!values.includes('TRUE')||!values.includes('FALSE')||select.dataset.switchReady)return;
    select.dataset.switchReady='true';select.hidden=true;
    const wrap=uiNode('span','switch-control');
    const caption=select.closest('.cfg-row,.cc-field,.record-field')?.querySelector('.cfg-kl,.cc-field-lbl,.record-field-label')?.childNodes[0]?.textContent?.trim()||select.getAttribute('aria-label')||'有効／無効';
    const button=uiButton('',()=>{select.value=select.value==='TRUE'?'FALSE':'TRUE';select.dispatchEvent(new Event('change',{bubbles:true}));refresh();},null,'switch-button');
    button.setAttribute('role','switch');button.setAttribute('aria-label',caption);
    button.append(uiNode('span','switch-track'),uiNode('span','switch-text'));
    const reset=uiButton('既定に戻す',()=>{select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));refresh();},'空欄に戻してアプリの既定値を使います','switch-reset');
    function refresh(){button.setAttribute('aria-checked',String(select.value==='TRUE'));button.classList.toggle('unset',select.value==='');button.querySelector('.switch-text').textContent=select.value===''?'未設定（既定値）':select.value==='TRUE'?'ON':'OFF';reset.hidden=select.value==='';wrap.classList.toggle('changed',select.value!==select.dataset.orig);}
    select.after(wrap);wrap.append(button,reset);select.addEventListener('change',refresh);refresh();
  });
}
function helpButton(label,description){const b=uiButton('?',()=>{},description,'field-help');b.setAttribute('aria-label',label+'の説明');return b;}
function installWorkspaceHelp(){
  const pop=uiNode('div','help-popover');pop.id='workspace-tooltip';pop.setAttribute('role','tooltip');pop.hidden=true;document.body.append(pop);
  let source=null;
  function hide(){pop.hidden=true;source?.removeAttribute('aria-describedby');source=null;}
  function show(e){const target=e.target.closest('[data-help]');if(!target||target.disabled)return;source=target;pop.textContent=target.dataset.help;pop.hidden=false;target.setAttribute('aria-describedby',pop.id);const r=target.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(r.left,innerWidth-pop.offsetWidth-8))+'px';pop.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-pop.offsetHeight-8))+'px';}
  document.addEventListener('mouseover',show);document.addEventListener('focusin',show);document.addEventListener('click',show);
  document.addEventListener('mouseout',hide);document.addEventListener('focusout',hide);document.addEventListener('scroll',hide,true);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
}
function showWorkspaceHelp(){
  let dialog=uiEl('workspace-help');
  if(!dialog){dialog=uiNode('dialog','connection-dialog');dialog.id='workspace-help';dialog.innerHTML='<h1>編集の進め方</h1><p>① 接続設定でシート・GAS・キーを入力します。<br>② 上のタブかホームから編集内容を選びます。<br>③ スポットと施設はフォーム／表を切り替えられます。<br>④ 変更したら「保存」で差分を確認します。</p><p>アイコンにマウスを置く、キーボードで選ぶ、または「？」を押すと説明が出ます。「表示」タブでは地図や説明文の表示を切り替えられます。</p><p>ON／OFFスイッチも保存するまでは編集中です。「未設定（既定値）」は、アプリ側の初期設定を使う状態です。</p>';dialog.append(uiButton('閉じる',()=>dialog.close()));document.body.append(dialog);}dialog.showModal();
}

function recordGroup(key){
  if(key.startsWith('card_'))return '記念カード';
  if(['lat','lng','approach_dist','arrive_dist','trigger_dist'].includes(key))return '場所・距離';
  if(key.includes('audio'))return '音声';
  if(key==='photo_url')return '写真';
  if(key.endsWith('_date'))return '公開期間';
  return '基本情報';
}
function enhanceRecordForm(){
  const form=document.querySelector('.record-form'),list=document.querySelector('.record-list');if(!form||!list)return;
  if(form.dataset.enhanced)return;form.dataset.enhanced='true';
  const sn=currentTab;
  const search=uiNode('input','record-search');search.type='search';search.placeholder='名称・IDで検索';search.setAttribute('aria-label','名称・IDで検索');search.value=workspace.search[sn]||'';
  const filter=()=>{workspace.search[sn]=search.value;const q=search.value.trim().toLowerCase();list.querySelectorAll('.record-list-item').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(q));};
  search.oninput=filter;list.querySelector('.record-list-head').after(search);filter();
  const fields=[...form.querySelectorAll('.record-field')];if(!fields.length)return;
  const groups=[...new Set(fields.map(f=>recordGroup(f.querySelector('[data-key]')?.dataset.key||'')))];
  if(!groups.includes(workspace.recordTab[sn]))workspace.recordTab[sn]=groups[0];
  const tabs=uiNode('div','field-tabs');tabs.setAttribute('aria-label','入力項目の分類');
  function select(group){workspace.recordTab[sn]=group;tabs.querySelectorAll('button').forEach(b=>{const active=b.textContent===group;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});fields.forEach(f=>f.hidden=recordGroup(f.querySelector('[data-key]')?.dataset.key||'')!==group);if(group==='場所・距離'){document.body.classList.remove('panel-hidden');setTimeout(()=>leafletMap?.invalidateSize(),0);}}
  groups.forEach(group=>tabs.append(uiButton(group,()=>select(group))));
  form.querySelector('.record-form-head').after(tabs);
  fields.forEach(f=>{
    const label=f.querySelector('.record-field-label'),desc=f.querySelector('.record-field-desc'),input=f.querySelector('.record-field-input');
    input?.setAttribute('aria-label',label.childNodes[0].textContent.trim());
    if(desc){const b=helpButton(label.childNodes[0].textContent,desc.textContent);b.onclick=e=>e.preventDefault();label.append(b);}
  });
  select(workspace.recordTab[sn]);
}
function enhanceConfig(){
  const grid=document.querySelector('.cfg-split');if(!grid||grid.dataset.enhanced)return;grid.dataset.enhanced='true';
  const defs=getConfigDisplayDefs();const sections=[];const rows=[];let section='';
  const edits=[...grid.querySelectorAll('.edit-col')];let idx=0;
  defs.forEach(def=>{
    if(def.sec){section=def.sec;sections.push(section);return;}
    const row=edits[idx++];if(!row)return;
    row.dataset.section=section;row.dataset.configKey=def.key;row.dataset.search=[def.lbl,def.key,def.desc].join(' ').toLowerCase();
    const title=row.querySelector('.cfg-kl');title.append(helpButton(def.lbl,(def.desc||'')+'（'+def.key+'）'));
    const input=row.querySelector('input,select,textarea');input?.setAttribute('aria-label',def.lbl);
    rows.push(row);
  });
  grid.replaceChildren(...rows);
  const banner=uiEl('ed-body').querySelector('.banner');banner?.parentElement.remove();
  const filters=uiNode('div','config-filter');const select=uiNode('select','workspace-input');select.setAttribute('aria-label','設定のカテゴリ');
  sections.forEach(s=>select.add(new Option(s,s)));select.add(new Option('すべての設定','all'));
  if(!sections.includes(workspace.configSection)&&workspace.configSection!=='all')workspace.configSection=sections[0];
  select.value=workspace.configSection;
  const search=uiNode('input','workspace-input');search.type='search';search.placeholder='設定名・キーワードで検索';search.setAttribute('aria-label',search.placeholder);search.value=workspace.configSearch;
  function filter(){workspace.configSection=select.value;workspace.configSearch=search.value;const q=search.value.trim().toLowerCase();rows.forEach(r=>r.hidden=q?!r.dataset.search.includes(q):select.value!=='all'&&r.dataset.section!==select.value);}
  select.onchange=()=>{search.value='';filter();};search.oninput=filter;filters.append(select,search);grid.before(filters);filter();
}
function enhanceCourses(){
  document.querySelectorAll('.cc-body').forEach(body=>{
    if(body.dataset.enhanced)return;body.dataset.enhanced='true';
    const fields=[...body.querySelectorAll('.cc-field')],grid=body.querySelector('.cc-fields'),route=body.querySelector('.cc-spots-area');
    const tabs=uiNode('div','field-tabs');tabs.setAttribute('aria-label','コースの編集項目');
    const group=key=>key.endsWith('_date')?'公開期間':key.includes('audio')||key.includes('thumbnail')||['theme_text','finish_text'].includes(key)?'写真・音声':'基本情報';
    fields.forEach((field,i)=>{const def=COURSE_FIELDS[i];field.dataset.group=group(def.key);field.querySelector('.cc-field-lbl').append(helpButton(def.lbl,def.desc));field.querySelector('input,select')?.setAttribute('aria-label',def.lbl);});
    const choose=name=>{tabs.querySelectorAll('button').forEach(b=>{const active=b.textContent===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});grid.hidden=name==='巡回順';route.hidden=name!=='巡回順';fields.forEach(f=>f.hidden=f.dataset.group!==name);};
    ['基本情報','巡回順','写真・音声','公開期間'].forEach(name=>tabs.append(uiButton(name,()=>choose(name))));
    body.prepend(tabs);choose('基本情報');
  });
}
function enhanceEditor(){
  if(!workspace.ready||workspace.home)return;
  if(currentTab==='config')enhanceConfig();
  if(currentTab==='spots'||currentTab==='facilities')enhanceRecordForm();
  if(currentTab==='courses')enhanceCourses();
  enhanceSwitches(uiEl('ed-body'));
  uiEl('ed-body').querySelectorAll('.chg-panel').forEach(panel=>{
    if(panel.parentElement.tagName==='DETAILS')return;
    const details=uiNode('details','workspace-summary');details.append(uiNode('summary','','変更内容を確認'));panel.before(details);details.append(panel);
  });
  uiEl('ed-body').querySelectorAll('table.dt th').forEach(th=>{const desc=th.querySelector('.thd');if(desc)th.title=desc.textContent;});
  syncWorkspaceChanges();setWorkspaceCommands();
  const add=document.querySelector('#ribbon-edit button:nth-child(2)');if(add)add.disabled=!['spots','facilities','courses'].includes(currentTab);
}

const workspaceShowTab=showTab;
showTab=function(key){
  if(workspace.ready&&!state.loaded){openConnection();return;}
  workspace.home=false;document.body.classList.remove('home-view');
  workspaceShowTab(key);
  document.querySelectorAll('.workspace-tab').forEach(b=>{b.classList.toggle('active',b.dataset.sheet===key);b.setAttribute('aria-current',b.dataset.sheet===key?'page':'false');});
  enhanceEditor();setTimeout(()=>leafletMap?.invalidateSize(),0);
};
const workspaceRenderTable=renderTable;
renderTable=function(sn){workspaceRenderTable(sn);if(workspace.ready){enhanceEditor();}};
const workspaceAddRow=addRow;
addRow=function(sn){workspace.recordTab[sn]='基本情報';workspace.search[sn]='';workspaceAddRow(sn);if(workspace.ready){enhanceSwitches(uiEl('ed-body'));syncWorkspaceChanges();}};
const workspaceRenderCourses=renderCourses;
renderCourses=function(){workspaceRenderCourses();if(workspace.ready)enhanceEditor();};
const workspaceRenderConfig=renderConfig;
renderConfig=function(){workspaceRenderConfig();if(workspace.ready)enhanceEditor();};
const workspaceFocusConfig=focusConfigKey;
focusConfigKey=function(key){
  if(workspace.ready){workspace.configSection='all';workspace.configSearch='';showTab('config');const row=[...document.querySelectorAll('[data-config-key]')].find(r=>r.dataset.configKey===key);if(row){row.scrollIntoView({block:'center'});row.querySelector('input,select,button')?.focus();return;}}
  workspaceFocusConfig(key);
};
function syncWorkspaceChanges(){
  if(!state.loaded)return;
  for(const s of UI_SHEETS){const dirty=JSON.stringify(state[s])!==JSON.stringify(state.originals[s]);uiEl('dot-'+s)?.classList.toggle('show',dirty);}
  const keys=currentTab==='courses'?['courses','course_spots']:[currentTab];
  const dirty=keys.some(s=>JSON.stringify(state[s])!==JSON.stringify(state.originals[s]));
  const badge=uiEl('chg-badge');badge.classList.toggle('show',dirty);badge.textContent=dirty?'未保存の変更あり':'';
  updateBadges();
}
const workspaceRecChg=recChg;
recChg=function(...args){workspaceRecChg(...args);if(workspace.ready)syncWorkspaceChanges();};
onGasTokenChange=function(){if(!uiEl('connection-dialog')?.open)state.gasToken=uiEl('gas-token').value.trim()||null;};
// Include added/deleted rows in the confirmation, even when no individual cell was edited.
saveCurrentSheet=async function(){
  if(workspace.demo){notify('サンプルモードでは実際のシートに保存しません');return;}
  if(!state.loaded||workspace.home)return;
  const keys=currentTab==='courses'?['courses','course_spots']:[currentTab],diff={};
  keys.forEach(s=>{
    if(JSON.stringify(state[s])===JSON.stringify(state.originals[s]))return;
    const old=state.originals[s]||[],now=state[s]||[];
    for(let i=0;i<Math.max(old.length,now.length);i++){
      if(!old[i]||!now[i])diff[s+' '+(i+1)+'行目']={old:old[i]?JSON.stringify(old[i]):'',new:now[i]?JSON.stringify(now[i]):''};
      else for(const k of new Set([...Object.keys(old[i]),...Object.keys(now[i])]))if(String(old[i][k]??'')!==String(now[i][k]??''))diff[s+' '+(i+1)+'行目 '+k]={old:old[i][k]??'',new:now[i][k]??''};
    }
  });
  if(!Object.keys(diff).length){notify('変更がありません');return;}
  showDiffModal(diff,()=>_origSaveCurrentSheet());
};
// The diff contains user-authored text: render it as text, never markup.
showDiffModal=function(diff,onConfirm){
  const body=uiEl('diff-tbody');body.replaceChildren();
  Object.entries(diff).forEach(([key,value])=>{const tr=uiNode('tr');tr.append(uiNode('td','diff-key',key),uiNode('td','diff-old',String(value.old||'（空）')),uiNode('td','diff-new',String(value.new||'（空）')));body.append(tr);});
  uiEl('diff-confirm-btn').textContent=state.gasConnected?'💾 この内容で保存する':'⬇ CSVをダウンロード';
  uiEl('diff-confirm-btn').onclick=()=>{closeDiffModal();onConfirm();};uiEl('diff-modal').classList.add('show');
};

function openWorkspaceDemo(){
  if(hasUnsavedChanges()&&!confirm('未保存の変更を破棄してサンプルを開きますか？'))return;
  state.config=[{key:'app_title',value:'まちあるきサンプル'},{key:'area_name',value:'サンプルのまち'},{key:'wbgt_enabled',value:'TRUE'},{key:'special_enabled',value:'FALSE'}];
  state.spots=[{spot_id:'sample_square',spot_name:'まちの広場',lat:'39.3198',lng:'140.5239',description:'ここからまちあるきを始めましょう。',approach_dist:'80',arrive_dist:'25'},{spot_id:'sample_museum',spot_name:'郷土資料館',lat:'39.321',lng:'140.525',description:'まちの歴史を紹介する資料館です。',approach_dist:'80',arrive_dist:'25'}];
  state.courses=[{course_id:'sample_walk',course_name:'はじめてのまちあるき',course_type:'市街地',recommended:'TRUE',duration_min:'30',distance_m:'800',course_description:'まちの広場から資料館へ。'}];
  state.course_spots=[{course_id:'sample_walk',spot_id:'sample_square',order:'1'},{course_id:'sample_walk',spot_id:'sample_museum',order:'2'}];
  state.facilities=[{facility_id:'sample_info',facility_name:'観光案内所',lat:'39.32',lng:'140.524',trigger_dist:'50',announce_text:'観光案内所があります。'}];
  UI_SHEETS.forEach(s=>{state.originals[s]=dc(state[s]);changes[s]={};});state.loaded=true;state.sheetId=null;state.gasUrl=null;state.gasToken=null;state.gasConnected=false;
  workspace.demo=true;workspace.connected=null;selectedRow={courses:null,spots:null,facilities:null};mapEditContext=null;
  uiEl('gas-url').value='';uiEl('gas-token').value='';uiEl('connection-dialog').close();document.querySelector('.workspace-region').textContent='サンプル · 本番には保存されません';updateBadges();updateGasUI();showWorkspaceHome();setStat('ok','サンプルモード — 実際のスプレッドシートへの保存は無効です');
}
