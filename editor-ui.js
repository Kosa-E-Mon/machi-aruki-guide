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
  const logo=uiNode('div','logo','🗺 エディター');logo.title='まちあるきエディター';logo.setAttribute('aria-label','まちあるきエディター');
  header.replaceChildren(logo,uiNode('span','workspace-region','未接続'),uiNode('div','spacer'));
  const utilities=uiNode('div','workspace-utilities');
  const connection=uiButton('⚙ 接続',openConnection,'編集する地域や接続情報を変更します');connection.setAttribute('aria-label','接続設定');utilities.append(connection);
  const nav=uiNode('nav','workspace-tabs');nav.setAttribute('aria-label','編集するデータ');
  nav.append(uiButton('⌂ ホーム',showWorkspaceHome,'編集する内容を選びます','workspace-tab active'));
  for(const [key,label] of [['spots','📍 スポット'],['courses','🗺 コース'],['facilities','🏛 施設'],['config','⚙ アプリ設定']]){
    const b=uiButton(label,()=>showTab(key),label+'を編集します','workspace-tab');
    b.dataset.sheet=key;
    const old=uiEl('nav-'+key);old.removeAttribute('id');b.id='nav-'+key;
    b.append(uiEl('badge-'+key),uiEl('dot-'+key));nav.append(b);
  }
  const panels={};
  for(const key of ['edit','view','data','help']){
    const panel=uiNode('div',key==='edit'?'workspace-inline-actions':'workspace-menu-panel');panel.id='ribbon-'+key;panels[key]=panel;
  }
  const command=(text,fn,help,cls)=>{const b=uiButton(text,fn,help,cls);b.dataset.requiresData='true';return b;};
  const save=command('💾 保存',()=>saveCurrentSheet(),'表示中のシートの変更内容を確認して保存します','btn primary');save.id='workspace-save';
  const add=command('＋ 追加',()=>{if(currentTab==='courses')addCourse();else if(SCHEMAS[currentTab]){workspace.search[currentTab]='';addRow(currentTab);enhanceEditor();}else notify('スポット・コース・施設で追加できます');},'現在の一覧に新しい項目を追加します');add.id='workspace-add';
  const reset=command('↶ 戻す',()=>resetChanges(),'表示中のシートを読み込み時の状態へ戻します');reset.id='workspace-reset';panels.edit.append(save,add,reset);
  panels.view.append(uiButton('▤ 地図',()=>{document.body.classList.toggle('panel-hidden');setTimeout(()=>leafletMap?.invalidateSize(),0);},'地図を表示／非表示にします。設定の外観プレビューは、その見出しから開閉します'),uiButton('ⓘ 項目の説明',()=>document.body.classList.toggle('show-help'),'説明文と項目キーの常時表示を切り替えます'),sizes);
  panels.view.firstChild.id='workspace-map-toggle';
  panels.view.append(uiEl('view-mode-label'),uiEl('view-mode-controls'));
  const oldBar=document.querySelector('.ed-bar');
  [...oldBar.querySelectorAll(':scope > button')].forEach(b=>{
    if(b.id==='save-btn'){b.hidden=true;return;}
    b.dataset.requiresData='true';b.dataset.help=b.textContent.trim();panels.data.append(b);
  });
  panels.data.append(command('⬇ 全CSV保存',exportAll,'すべてのシートをCSVファイルとして保存します'),qr,uiButton('▦ QR表示',showQrModal,'アプリを開くQRコードを表示します'));
  panels.help.append(uiButton('？ 使い方',showWorkspaceHelp,'接続から保存までの手順を確認します'),uiButton('⚙ GAS設定方法',()=>{openConnection();showGasModal();},'接続先のGAS設定手順を確認します'));
  const toolbar=uiNode('div','workspace-toolbar');toolbar.setAttribute('aria-label','編集操作');
  const menus=uiNode('div','workspace-toolbar-menus');
  menus.append(workspaceMenu('表示',panels.view,'view'),workspaceMenu('データ',panels.data,'data','データ・メディア'));
  utilities.append(workspaceMenu('？',panels.help,'help','ヘルプ'));
  const statusText=uiNode('span','workspace-save-status');statusText.id='workspace-save-status';statusText.setAttribute('role','status');statusText.setAttribute('aria-live','polite');
  const context=uiNode('div','workspace-toolbar-context');context.append(uiEl('ed-title'),statusText,uiEl('chg-badge'));
  toolbar.append(panels.edit,menus,context);header.querySelector('.spacer').remove();header.append(nav,utilities);header.after(toolbar);
  document.addEventListener('click',e=>document.querySelectorAll('.workspace-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;}));
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const menu=[...document.querySelectorAll('.workspace-menu[open]')].find(m=>m.contains(document.activeElement));closeWorkspaceMenus();if(menu){menu.querySelector('summary').focus();e.preventDefault();}});
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
  closeWorkspaceMenus();const menu=uiEl('workspace-menu-'+key);if(menu)menu.open=true;
}
function closeWorkspaceMenus(){document.querySelectorAll('.workspace-menu[open]').forEach(menu=>menu.open=false);}
function workspaceMenu(label,panel,key,accessibleLabel){
  const menu=uiNode('details','workspace-menu');menu.id='workspace-menu-'+key;
  const summary=uiNode('summary','',label);if(accessibleLabel)summary.setAttribute('aria-label',accessibleLabel);menu.append(summary,panel);
  menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.workspace-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});});
  panel.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('.hdr-size')){menu.open=false;summary.focus();}});
  return menu;
}
function setWorkspaceCommands(){
  document.querySelectorAll('[data-requires-data]').forEach(b=>b.disabled=!state.loaded||workspace.home);
  if(uiEl('workspace-save'))uiEl('workspace-save').disabled=!state.loaded||workspace.home||workspace.demo;
  const add=uiEl('workspace-add'),reset=uiEl('workspace-reset');
  if(add){add.hidden=workspace.home||!['spots','facilities','courses'].includes(currentTab)||!!workspace.inventoryMode?.[currentTab];add.disabled=!state.loaded;}
  if(reset)reset.hidden=workspace.home;
  if(uiEl('workspace-map-toggle'))uiEl('workspace-map-toggle').disabled=workspace.home||currentTab==='config'||!state.loaded;
  if(uiEl('ed-title'))uiEl('ed-title').hidden=workspace.home;
  updateWorkspaceSaveStatus();
  updateInventoryCommands();
}
function updateWorkspaceSaveStatus(){
  const status=uiEl('workspace-save-status');if(!status)return;
  const keys=workspace.home?UI_SHEETS:currentTab==='courses'?['courses','course_spots']:[currentTab];
  const dirty=state.loaded&&keys.some(s=>JSON.stringify(state[s])!==JSON.stringify(state.originals[s]));
  status.textContent=!state.loaded?'未接続':dirty?'● 未保存の変更あり':workspace.demo?'サンプル・保存しません':'変更なし';
  status.classList.toggle('dirty',!!dirty);
  const save=uiEl('workspace-save');if(save){save.classList.toggle('has-unsaved',!!dirty);save.title=status.textContent;save.setAttribute?.('aria-label','保存：'+status.textContent);}
}
function showWorkspaceHome(){
  closeWorkspaceMenus();
  workspace.home=true;document.body.classList.add('home-view');
  document.querySelectorAll('.workspace-tab').forEach(b=>{b.classList.toggle('active',!b.dataset.sheet);b.setAttribute('aria-current',!b.dataset.sheet?'page':'false');});
  const home=uiNode('section','workspace-home');
  home.append(uiNode('h1','',state.loaded?(getCfg('app_title')||'まちあるきガイド'):'まちの魅力を、ひとつずつ。'),uiNode('p','',state.loaded?'編集する内容を選んでください。変更はシートごとに保存できます。':'接続先を設定すると、スポットやコースを編集できます。'));
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
  select.onchange=()=>{search.value='';filter();};search.oninput=filter;filters.append(select,search);grid.before(filters);filter();installAppPreview();
}
function enhanceCourses(){
  document.querySelectorAll('.cc-body').forEach((body,ci)=>{
    if(body.dataset.enhanced)return;body.dataset.enhanced='true';
    const fields=[...body.querySelectorAll('.cc-field')],grid=body.querySelector('.cc-fields'),route=body.querySelector('.cc-spots-area');
    const tabs=uiNode('div','field-tabs');tabs.setAttribute('aria-label','コースの編集項目');
    const group=key=>key.endsWith('_date')?'公開期間':key.includes('audio')||key.includes('thumbnail')||['theme_text','finish_text'].includes(key)?'写真・音声':'基本情報';
    fields.forEach((field,i)=>{const def=COURSE_FIELDS[i];field.dataset.group=group(def.key);field.querySelector('.cc-field-lbl').append(helpButton(def.lbl,def.desc));field.querySelector('input,select')?.setAttribute('aria-label',def.lbl);});
    const matrix=uiNode('section','course-matrix');body.append(matrix);
    const choose=name=>{tabs.querySelectorAll('button').forEach(b=>{const active=b.textContent===name;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});grid.hidden=['巡回順','内容一覧'].includes(name);route.hidden=name!=='巡回順';matrix.hidden=name!=='内容一覧';if(name==='内容一覧')renderCourseMatrix(matrix,state.courses[ci]);fields.forEach(f=>f.hidden=f.dataset.group!==name);};
    ['基本情報','巡回順','内容一覧','写真・音声','公開期間'].forEach(name=>tabs.append(uiButton(name,()=>choose(name))));
    body.prepend(tabs);choose('基本情報');
  });
}

// Read-only projection of the current editor data, including unsaved route edits.
function courseMatrixRows(course){
  const route=state.course_spots.filter(r=>r.course_id===course.course_id).slice().sort((a,b)=>(parseInt(a.order)||0)-(parseInt(b.order)||0));
  return route.map((link,index)=>({link,index,count:route.length,spot:state.spots.find(s=>s.spot_id===link.spot_id)||null}));
}
function matrixAudio(sn,row,role,applicable=true){
  if(!applicable)return {kind:'na',label:'— 対象外',detail:'この巡回位置では使用しません'};
  const key='audio_'+role+'_url',id=row[sn==='courses'?'course_id':'spot_id'];
  const explicit=String(row[key]||'').trim(),url=mediaPlaybackUrl(sn,key,id,explicit);
  const tts=role==='explain'?!!String(row.description||'').trim():role==='theme'?!!String(row.theme_text||'').trim():true;
  const fallback=tts?'TTS代替あり':'TTS原稿なし';
  return {kind:url?'pending':'empty',label:explicit?'URL登録・未確認':url?'自動候補・未確認':'音声未登録',url,detail:(url||'音声ファイルの指定なし')+' / '+fallback,tts};
}
function renderCourseMatrix(host,course,allSpots=false){
  host.replaceChildren();if(!course&&!allSpots)return;
  host.append(uiNode('h3','',allSpots?'全スポットの内容一覧':'コースの内容一覧'),uiNode('p','matrix-note','現在の編集内容（未保存を含む）を表示。音声は任意です。URL登録や自動候補だけではファイルの存在を保証しません。TTSはブラウザーの音声合成による代替で、解説は到着音声の再生結果によって省略される場合があります。'));
  const controls=uiNode('div','matrix-controls');
  controls.append(uiButton('写真・音声ファイルを確認',check,null),uiButton('↗ メディアアップローダー',()=>window.open('media-uploader.html','_blank','noopener')));host.append(controls);
  const cells=[];
  function audioCell(sn,row,role,applicable){
    const info=matrixAudio(sn,row,role,applicable),td=uiNode('td');
    const status=uiNode('span','matrix-status '+info.kind,info.label);status.title=info.detail;td.append(status);
    if(info.kind!=='na'){td.append(uiNode('small','',info.tts?'TTS代替あり':'TTS原稿なし'));if(info.url)td.append(mkPlayBtn(()=>info.url,role));}
    if(info.url)cells.push({info,status});return td;
  }
  async function check(){
    const button=controls.firstChild;button.disabled=true;button.textContent='確認中…';
    // Bound concurrent requests and do not mutate editor data or the save snapshot.
    let cursor=0;await Promise.all(Array.from({length:Math.min(4,cells.length)},async()=>{
      while(cursor<cells.length){const {info,status}=cells[cursor++];const ok=await checkUrlExists(info.url);if(!host.contains(status))continue;
        status.className='matrix-status '+(ok===true?'ok':ok===false?'warn':'pending');
        status.textContent=ok===true?'✓ ファイルあり':ok===false?'応答エラー':'? 確認できず';
        status.title=info.detail+(ok===false?' / HTTP応答エラー。権限・URL・未アップロード等を確認してください':'');
      }
    }));button.disabled=false;button.textContent='写真・音声ファイルを確認';
  }
  host.append(uiNode('p','matrix-note','表が画面に収まらない場合は、横へスクロールして出発・ゴール音声まで確認できます。'));
  const scroll=uiNode('div','matrix-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','スポットの説明と音声一覧（横スクロール）');
  const table=uiNode('table','matrix-table'),head=uiNode('thead'),tr=uiNode('tr');
  ['順番・スポット','説明文','写真','接近 approach','到着 arrive','解説 explain（任意）','次へ next','出発 start','ゴール goal'].forEach(label=>{const th=uiNode('th','',label);th.scope='col';tr.append(th);});head.append(tr);table.append(head);
  const tbody=uiNode('tbody'),rows=allSpots?state.spots.map((spot,index)=>({link:{spot_id:spot.spot_id},index,count:state.spots.length,spot})):courseMatrixRows(course);
  rows.forEach(({link,index,count,spot})=>{
    const tr=uiNode('tr'),name=uiNode('th','',`${link.order||index+1}. ${spot?.spot_name||link.spot_id||'IDなし'}`);name.scope='row';tr.append(name);
    if(!spot){const td=uiNode('td','matrix-missing','参照先スポットなし：スポットIDを確認してください');td.colSpan=8;tr.append(td);}
    else{const description=String(spot.description||'').trim(),td=uiNode('td');td.append(uiNode('span','matrix-status '+(description?'ok':'empty'),description?'✓ 登録あり':'未登録'));td.title=description||'説明文が空欄です';tr.append(td);
      const photo=uiNode('td'),explicit=String(spot.photo_url||'').trim(),url=mediaPlaybackUrl('spots','photo_url',spot.spot_id,explicit),status=uiNode('span','matrix-status '+(url?'pending':'empty'),explicit?'URL登録・未確認':url?'自動候補・未確認':'写真未登録');photo.append(status);status.title=url||'写真の指定なし';if(url)cells.push({info:{url,detail:url},status});tr.append(photo);
      for(const role of ['approach','arrive','explain','next','start','goal'])tr.append(audioCell('spots',spot,role,allSpots|| (role==='start'?index===0:role==='next'?index>0&&index<count-1:role==='goal'?index===count-1&&index>0:true)));
    }tbody.append(tr);
  });table.append(tbody);scroll.append(table);host.append(scroll);
  if(!rows.length)host.append(uiNode('p','matrix-note',allSpots?'スポットが登録されていません。編集画面で追加できます。':'このコースにはスポットが登録されていません。巡回順タブから追加できます。'));
  if(allSpots){host.append(uiNode('p','matrix-note','start・next・goal はコース内の位置で使い分けます。全スポット一覧では登録状況のみを示し、必須とは扱いません。'));return;}
  host.append(uiNode('h4','','コースの音声（任意）'));
  const courseTable=uiNode('table','matrix-table'),ct=uiNode('tr');
  for(const [role,label] of [['theme','テーマ theme'],['finish','完走 finish']]){ct.append(uiNode('th','',label),audioCell('courses',course,role,true));}courseTable.append(ct);host.append(courseTable);
}
function enhanceEditor(){
  if(!workspace.ready||workspace.home)return;
  if(currentTab==='config')enhanceConfig();
  if(currentTab==='spots'||currentTab==='facilities')enhanceRecordForm();
  if(currentTab==='courses')enhanceCourses();
  if(['courses','spots'].includes(currentTab)&&workspace.inventoryMode?.[currentTab])renderInventory();
  enhanceSwitches(uiEl('ed-body'));
  uiEl('ed-body').querySelectorAll('.chg-panel').forEach(panel=>{
    if(panel.parentElement.tagName==='DETAILS')return;
    const details=uiNode('details','workspace-summary');details.append(uiNode('summary','','変更内容を確認'));panel.before(details);details.append(panel);
  });
  uiEl('ed-body').querySelectorAll('table.dt th').forEach(th=>{const desc=th.querySelector('.thd');if(desc)th.title=desc.textContent;});
  syncWorkspaceChanges();setWorkspaceCommands();
  const add=uiEl('workspace-add');if(add)add.disabled=!state.loaded||!['spots','facilities','courses'].includes(currentTab);
}

const workspaceShowTab=showTab;
showTab=function(key){
  closeWorkspaceMenus();
  if(workspace.ready&&!state.loaded){openConnection();return;}
  workspace.home=false;document.body.classList.remove('home-view');
  document.body.classList.toggle('config-preview-active',key==='config');
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
  updateWorkspaceSaveStatus();
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

function updateInventoryCommands(){
  if(!workspace.ready)return;
  let button=uiEl('workspace-inventory');
  if(!button){button=uiButton('▦ 内容一覧',()=>{workspace.inventoryMode??={};workspace.inventoryMode[currentTab]=!workspace.inventoryMode[currentTab];showTab(currentTab);});button.id='workspace-inventory';uiEl('ribbon-edit').insertBefore(button,uiEl('workspace-add'));}
  button.hidden=workspace.home||!['courses','spots'].includes(currentTab);button.disabled=!state.loaded;
  button.textContent=workspace.inventoryMode?.[currentTab]?'✎ 編集へ':'▦ 内容一覧';
  button.setAttribute('aria-pressed',String(!!workspace.inventoryMode?.[currentTab]));
}
function renderInventory(){
  const host=uiNode('section','inventory-view'),matrix=uiNode('section','course-matrix');
  if(currentTab==='courses'){
    const label=uiNode('label','','コースを選ぶ '),select=uiNode('select','workspace-input');select.setAttribute('aria-label','内容一覧のコース');
    state.courses.forEach(c=>select.add(new Option(c.course_name||c.course_id,c.course_id)));
    if(state.courses.some(c=>c.course_id===workspace.inventoryCourse))select.value=workspace.inventoryCourse;
    select.onchange=()=>{workspace.inventoryCourse=select.value;renderCourseMatrix(matrix,state.courses.find(c=>c.course_id===select.value));};
    label.append(select);host.append(label);select.onchange();
    if(!state.courses.length)matrix.append(uiNode('p','','コースがありません。編集画面で追加できます。'));
  }else renderCourseMatrix(matrix,null,true);
  host.append(matrix);uiEl('ed-body').replaceChildren(host);
}

const appPreview={screen:'home',theme:'dark',courseId:'',spotId:'',html:null,frame:null,ready:false};
function installAppPreview(){
  if(uiEl('app-preview'))return;
  const section=uiNode('details','config-app-preview');section.id='app-preview';section.open=true;
  section.append(uiNode('summary','','📱 本体の外観プレビュー（保存前の設定）'));
  const controls=uiNode('div','app-preview-controls');
  for(const [key,label,options] of [['screen','プレビュー画面',[['home','ホーム'],['intro','コース紹介'],['spot','スポット説明'],['certificate','修了証']]],['theme','プレビューの配色',[['dark','ダーク'],['light','ライト']]]]){
    const select=uiNode('select','workspace-input');select.setAttribute('aria-label',label);options.forEach(([value,text])=>select.add(new Option(text,value)));select.value=appPreview[key];select.onchange=()=>{appPreview[key]=select.value;updateAppPreview();};controls.append(select);
  }
  for(const [key,label,rows,id,name] of [['courseId','プレビューのコース',state.courses,'course_id','course_name'],['spotId','プレビューのスポット',state.spots,'spot_id','spot_name']]){
    const select=uiNode('select','workspace-input');select.setAttribute('aria-label',label);rows.forEach(r=>select.add(new Option(r[name]||r[id],r[id])));if(rows.some(r=>r[id]===appPreview[key]))select.value=appPreview[key];else appPreview[key]=select.value;select.onchange=()=>{appPreview[key]=select.value;updateAppPreview();};controls.append(select);
  }
  section.append(controls,uiNode('p','matrix-note','この版の本体に、未保存の設定を反映します。表示専用です。'));
  const limits=uiNode('details','app-preview-limits');limits.append(uiNode('summary','','プレビューの範囲'),uiNode('p','matrix-note','GPS・音声再生・ログイン・進捗保存・同期は停止。修了証の日付と距離は見本です。選択コース内のスポットを表示します。写真・フォントは外部配信のため通信状況で変わります。動作に関する設定は外観には反映されません。'));section.append(limits);
  const status=uiNode('p','matrix-note','本体を読み込み中…');status.id='app-preview-status';status.setAttribute('role','status');section.append(status);
  const frame=uiNode('iframe','app-preview-frame');frame.title='保存前の設定を反映した本体の外観';frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');section.append(frame);uiEl('ed-body').prepend(section);
  appPreview.frame=frame;appPreview.ready=false;
  loadAppPreview(frame).catch(error=>{if(appPreview.frame===frame)status.textContent='本体プレビューを読み込めません：'+error.message;});
}
async function loadAppPreview(frame){
  const url=new URL('index.html',location.href);
  if(!appPreview.html){const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);appPreview.html=await response.text();}
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  if(appPreview.frame===frame)frame.srcdoc=appPreviewDocument(appPreview.html,url,nonce);
}
function appPreviewDocument(source,url,nonce){
  let html=source;
  const boot=/initGoogleAuth\(\);\s*(?:armBackNavigationGuard\(\);\s*)?initApp\(\);/;
  if(!boot.test(html))throw Error('本体の起動方法を確認できません。通常起動は行いません。');
  html=html.replace(boot,'initEditorAppPreview();');
  html=html.replace(/<script\b[^>]*src=["'][^"']*(?:googletagmanager|accounts\.google\.com)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,'');
  html=html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi,(block,code)=>/window\.dataLayer/.test(code)?'':block);
  html=html.replace(/<script\b/g,'<script nonce="'+nonce+'"');
  const isolation=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${url.origin} https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src https: data: ${url.origin}; font-src https://fonts.gstatic.com; connect-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'"><base href="${url.href}"><script nonce="${nonce}">(()=>{const memory=()=>{const data=new Map();return{getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]||null,get length(){return data.size}}};for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:memory()});window.fetch=()=>Promise.reject(Error('プレビューでは通信処理を停止しています'));XMLHttpRequest.prototype.send=function(){throw Error('プレビューでは通信処理を停止しています')};navigator.sendBeacon=()=>false;window.open=()=>null;window.gtag=()=>{};})();<\/script>`;
  html=html.replace(/<head[^>]*>/i,match=>match+isolation).replace('</body>',`<script nonce="${nonce}" src="editor-preview-runtime.js"><\/script></body>`);
  return html;
}
function appPreviewData(){
  // Send presentation data only; never send GAS/OAuth/token/connection information.
  const config=state.config.filter(r=>/^(app_|area_|home_|prefecture$|city$|color_|font_|header_|cert_|lang$)/.test(r.key)).map(r=>({key:r.key,value:r.value}));
  const courses=dc(state.courses).map(c=>({...c,course_thumbnail_url:mediaPlaybackUrl('courses','course_thumbnail_url',c.course_id,c.course_thumbnail_url)||''}));
  const spots=dc(state.spots).map(s=>({...s,photo_url:mediaPlaybackUrl('spots','photo_url',s.spot_id,s.photo_url)||''}));
  return {config,courses,spots,course_spots:dc(state.course_spots),facilities:[],screen:appPreview.screen,theme:appPreview.theme,courseId:appPreview.courseId,spotId:appPreview.spotId};
}
function updateAppPreview(){
  if(currentTab!=='config'||!appPreview.ready||!appPreview.frame?.isConnected)return;
  uiEl('app-preview-status').textContent='保存前の設定を反映中…';appPreview.frame.contentWindow.postMessage({type:'walk-editor-preview-data',data:appPreviewData()},'*');
}
window.addEventListener('message',event=>{
  if(!appPreview.frame?.isConnected||event.source!==appPreview.frame.contentWindow)return;
  if(event.data?.type==='walk-editor-preview-ready'){appPreview.ready=true;updateAppPreview();}
  if(event.data?.type==='walk-editor-preview-rendered')uiEl('app-preview-status').textContent='保存前の設定を反映しました（外観のみ）'+(event.data.note?' '+event.data.note:'');
  if(event.data?.type==='walk-editor-preview-error')uiEl('app-preview-status').textContent='この画面を表示できません：'+event.data.message;
});
showRpConfig=function(){document.body.classList.add('config-preview-active');};
updateConfigPreview=function(){updateAppPreview();};
