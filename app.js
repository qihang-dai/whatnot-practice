'use strict';
const D=window.DATA;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topicById=new Map(D.topics.map(t=>[t.id,t]));
let activeView='checklist';
let done={};
try{const v=JSON.parse(localStorage.getItem('whatnot-done-v1')||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))done=v}catch(e){}
const $=s=>document.querySelector(s);
const evidenceName={reported:'有关联实际面经',secondary:'仅附带往期题库',unknown:'未披露 / 不可映射'};
function evidenceMatches(t,value){return !value||value==='self-found'&&!!t.userAdded||value===t.evidence}
function sourceLinks(t){
  const actual=t.sources.map(s=>`<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.date)} · #${s.id} ↗</a>`).join('');
  const extra=t.supplementalSources.map(s=>`<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">#${s.id} · ${esc(s.section)} 题库 #${s.item} ↗</a>`).join('');
  return `<details class="source-details"><summary>证据 / 原帖 · ${t.sources.length} 篇关联报告${t.supplementalSources.length?' + 附带题库':''}</summary>${actual?`<p><b>原有实际报告索引</b><br>${actual}</p>`:''}${extra?`<p><b>二手汇总，不算本场命中</b><br>${extra}</p>`:''}<small>只有附带题库的题目，其具体面试日期、岗位和完整变体仍待确认。</small></details>`;
}
function card(t,item){
 const origin=item?`<span class="origin">${esc(item.round)} ${item.number} · ${esc(item.originLabel)}</span>`:'';
 const links=t.links.map(l=>`<a class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.title)} ↗<small>${esc(l.note)}</small></a>`).join('');
 return `<article id="${t.id}" data-topic="${t.id}" class="card ${done[t.id]?'done':''}">${origin}<div class="top"><div><span class="tag">${esc(t.round)}</span><span class="level">${esc(t.match)}</span><h2>${esc(t.title)}</h2></div><label class="check"><input type="checkbox" data-done="${t.id}" ${done[t.id]?'checked':''}> 已练习</label></div><div class="patterns">${t.patterns.map(p=>`<span>${esc(p)}</span>`).join('')}</div><p class="evidence ${t.evidence}">${esc(evidenceName[t.evidence])}${t.sources.length?` · ${t.sources.length} 篇关联报告`:''}${t.supplementalSources.length?' · 另见附带题库':''}</p><p>${esc(t.summary)}</p><div class="links">${links||'<p class="muted">无可靠同题链接：先回原帖确认题面，不能硬套 LeetCode。</p>'}</div><p><b>怎么练 / 讲解要点：</b>${esc(t.drill)}</p>${t.follow?`<p class="follow"><b>变体边界 / 追问说明：</b>${esc(t.follow)}</p>`:''}${sourceLinks(t)}</article>`;
}
function setView(v){activeView=v;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));render()}
function clearFilters(){ $('#query').value='';$('#round').value='';$('#evidence').value='';$('#only').checked=false }
function render(){
 const q=$('#query').value.trim().toLowerCase(),round=$('#round').value,ev=$('#evidence').value,only=$('#only').checked;
 if(activeView==='sources'){
  const sources=D.sources.filter(s=>!q||JSON.stringify(s).toLowerCase().includes(q));
  $('#status').textContent=`${sources.length} / ${D.sources.length} 篇原始报告`;
  $('#view-help').textContent='这里按原帖日期排序，仅搜索生效；轮次、证据与进度筛选只用于练习卡片。';
  $('#cards').innerHTML=sources.map(s=>`<article class="card"><span class="tag">${esc(s.date)}</span><h2><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">#${s.id} ↗</a></h2><p>${esc(s.track)}</p><p class="muted small">关联主题：${D.topics.filter(t=>t.sources.some(x=>x.id===s.id)).map(t=>`<a href="#${t.id}">${esc(t.title)}</a>`).join(' / ')}</p></article>`).join('');
  return;
 }
 const entries=(activeView==='checklist'||activeView==='bank')?D.checklist.filter(x=>x.view===(activeView==='bank'?'bank':'main')).map(x=>({topic:topicById.get(x.topic),item:x})):D.topics.map(t=>({topic:t,item:null}));
 const shown=entries.filter(({topic:t,item})=>(!q||JSON.stringify({t,item}).toLowerCase().includes(q))&&(!round||t.round===round)&&evidenceMatches(t,ev)&&(!only||!done[t.id]));
 const completed=entries.filter(e=>done[e.topic.id]).length;
 $('#status').textContent=`显示 ${shown.length} / ${entries.length} 项 · 本视图 ${completed} 已练习`;
 $('#view-help').textContent=activeView==='checklist'?'按一手面经篇数降序（同数按最近日期）。不含 Karat、Mobile、未披露题；附带题库见下一个标签。':activeView==='bank'?'1182119 帖子附带的往期题库原顺序；不是该作者本场题，不计入一手频次。':'含全部题目（Karat、Mobile、未披露单独标注）；每项证据独立标注。';
 $('#cards').innerHTML=shown.map(({topic,item})=>card(topic,item)).join('')||'<p class="empty">没有匹配项目，试试清除筛选。</p>';
 document.querySelectorAll('[data-done]').forEach(e=>e.onchange=()=>{done[e.dataset.done]=e.checked;try{localStorage.setItem('whatnot-done-v1',JSON.stringify(done))}catch(x){}render()});
}
function openHash(){const id=decodeURIComponent(location.hash.slice(1));if(!topicById.has(id))return;clearFilters();setView(D.checklist.some(x=>x.topic===id&&x.view==='main')?'checklist':D.checklist.some(x=>x.topic===id)?'bank':'all');document.getElementById(id)?.scrollIntoView({block:'start'})}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{clearFilters();setView(b.dataset.view)});
$('#query').oninput=render;$('#round').onchange=render;$('#evidence').onchange=render;$('#only').onchange=render;$('#clear').onclick=()=>{clearFilters();render()};
window.addEventListener('hashchange',openHash);render();openHash();
