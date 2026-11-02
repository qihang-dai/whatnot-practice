'use strict';
// Cross-device progress sync through a private GitHub Gist.
// Each item stores {v: checked, t: lastChangeMs}; merge keeps the newer change per item,
// so checking AND unchecking both propagate. Without a token, everything stays local.
(function(){
  const K_TOKEN='whatnot-gh-token', K_GIST='whatnot-gist-id', K_META='whatnot-done-meta-v1', K_DONE='whatnot-done-v1';
  const FILE='whatnot-progress.json', DESC='whatnot-practice progress (auto-synced)';
  const API='https://api.github.com';
  const get=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
  const set=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};

  let meta={};
  try{const m=JSON.parse(get(K_META)||'{}');if(m&&typeof m==='object')meta=m}catch(e){}
  try{const d=JSON.parse(get(K_DONE)||'{}');for(const id in d)if(!meta[id])meta[id]={v:!!d[id],t:0}}catch(e){}

  let pushTimer=null, busy=false, again=false;
  const ui=()=>document.getElementById('sync-status');
  function status(text,kind){const el=ui();if(el){el.textContent=text;el.dataset.kind=kind||''}}

  function saveLocal(){
    set(K_META,JSON.stringify(meta));
    const done={};for(const id in meta)if(meta[id].v)done[id]=true;
    set(K_DONE,JSON.stringify(done));
    if(window.WN_setDone)window.WN_setDone(done);
  }
  function merge(remote){
    let changed=false, localNewer=false;
    for(const id in remote||{}){
      const r=remote[id], l=meta[id];
      if(!r||typeof r.t!=='number')continue;
      if(!l||r.t>l.t){meta[id]={v:!!r.v,t:r.t};changed=true}
    }
    for(const id in meta){const r=(remote||{})[id];if(!r||meta[id].t>r.t)localNewer=true}
    return {changed,localNewer};
  }
  async function gh(path,opts={}){
    const res=await fetch(API+path,{...opts,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+get(K_TOKEN),...(opts.body?{'Content-Type':'application/json'}:{})}});
    if(res.status===401||res.status===403)throw new Error('auth');
    if(!res.ok)throw new Error('http '+res.status);
    return res.status===204?null:res.json();
  }
  async function findGist(){
    let id=get(K_GIST);
    if(id)return id;
    for(let page=1;page<=5;page++){
      const list=await gh(`/gists?per_page=100&page=${page}`);
      const hit=list.find(g=>g.files&&g.files[FILE]);
      if(hit){set(K_GIST,hit.id);return hit.id}
      if(list.length<100)break;
    }
    return null;
  }
  async function readRemote(id){
    const g=await gh('/gists/'+id);
    const f=g.files&&g.files[FILE];
    if(!f)return {};
    let text=f.content;
    if(f.truncated&&f.raw_url)text=await (await fetch(f.raw_url)).text();
    try{const j=JSON.parse(text||'{}');return j.items||{}}catch(e){return {}}
  }
  function body(){return JSON.stringify({files:{[FILE]:{content:JSON.stringify({version:1,updated:new Date().toISOString(),items:meta},null,1)}}})}

  async function sync(){
    if(!get(K_TOKEN)){status('仅本机保存 · 未连接同步','off');return}
    if(busy){again=true;return}
    busy=true;status('同步中…','busy');
    try{
      let id=await findGist();
      if(!id){
        const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:DESC,public:false,...JSON.parse(body())})});
        set(K_GIST,g.id);
      }else{
        let remote;
        try{remote=await readRemote(id)}catch(e){if(String(e.message).includes('404')){set(K_GIST,null);busy=false;return sync()}throw e}
        const {changed,localNewer}=merge(remote);
        if(changed)saveLocal();
        if(localNewer)await gh('/gists/'+id,{method:'PATCH',body:body()});
      }
      status('已同步 '+new Date().toLocaleTimeString(),'ok');
    }catch(e){
      status(e.message==='auth'?'token 无效或缺少 Gists 权限，点“同步设置”重新连接':'同步失败（离线？）稍后重试','err');
    }finally{
      busy=false;
      if(again){again=false;sync()}
    }
  }

  window.WN_mark=function(id,checked){
    meta[id]={v:!!checked,t:Date.now()};
    saveLocal();
    if(get(K_TOKEN)){status('待同步…','busy');clearTimeout(pushTimer);pushTimer=setTimeout(sync,1000)}
  };
  // Inline setup panel (no prompt(): Chrome auto-dismisses dialogs when you switch tabs).
  window.WN_syncSetup=function(){
    let p=document.getElementById('sync-panel');
    if(p){p.remove();return}
    const cur=get(K_TOKEN);
    p=document.createElement('div');
    p.id='sync-panel';
    p.innerHTML=
      '<p><b>跨设备同步</b>（Mac / Windows 各设置一次）</p>'+
      '<ol><li><a href="https://github.com/settings/tokens/new?scopes=gist&description=whatnot-practice-sync" target="_blank" rel="noopener">打开 GitHub 生成 token ↗</a>：gist 权限已勾好，选有效期，点 <b>Generate token</b>，复制 <code>ghp_</code> 开头的字符串。</li>'+
      '<li>回到这里粘贴并保存：</li></ol>'+
      '<div class="row"><input id="sync-token" type="password" autocomplete="off" spellcheck="false" placeholder="'+(cur?'已连接；粘贴新 token 可替换':'ghp_…')+'">'+
      '<button type="button" id="sync-save">保存并同步</button>'+
      (cur?'<button type="button" id="sync-off">断开同步</button>':'')+
      '<button type="button" id="sync-close">关闭</button></div>'+
      '<p class="small muted">token 只保存在本浏览器的 localStorage，只用于读写你自己的私有 gist。</p>';
    const bar=document.querySelector('.toolbar');
    bar.parentNode.insertBefore(p,bar.nextSibling);
    const inp=p.querySelector('#sync-token');inp.focus();
    const save=()=>{const v=inp.value.trim();if(!v){inp.focus();return}set(K_TOKEN,v);set(K_GIST,null);p.remove();sync()};
    p.querySelector('#sync-save').onclick=save;
    inp.onkeydown=e=>{if(e.key==='Enter')save()};
    p.querySelector('#sync-close').onclick=()=>p.remove();
    const off=p.querySelector('#sync-off');
    if(off)off.onclick=()=>{set(K_TOKEN,null);set(K_GIST,null);p.remove();status('仅本机保存 · 未连接同步','off')};
  };
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
  window.addEventListener('focus',()=>sync());
  saveLocal();sync();
})();
