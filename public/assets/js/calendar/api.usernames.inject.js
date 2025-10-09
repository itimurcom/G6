/* Username Auto-Injector
 * Fills every <span class="user--name"> with "name ( логін ) : user_id".
 * Works with or without data-user-id. Click -> /cabinet?user_id=ID
 */
(function(){"use strict";
const API_TRIES=[id=>`/api/users/get?id=${id}`,id=>`/api/users/name?id=${id}`];
const ME_TRIES=[()=>`/api/users/me`];

function pick(o,k){const r={};k.forEach(x=>r[x]=o&&o[x]!=null?o[x]:null);return r}
function fmt(u){
  const name=(u&&typeof u.name==='string'&&u.name.trim())?u.name.trim():(u&&u.login?String(u.login):'');
  const login=(u&&u.login)?String(u.login):'';
  const id=(u&&typeof u.id!=='undefined')?u.id:'';
  return `${name} (${login}) : ${id}`;
}
async function j(url){
  const r=await fetch(url,{credentials:'same-origin'});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function byId(id){
  for(const f of API_TRIES){
    try{
      const jn=await j(f(id));
      if(jn && jn.ok && jn.user) return pick(jn.user,['id','name','login','email','role']);
      if(jn && (jn.id!=null || jn.name!=null || jn.login!=null)) return pick(jn,['id','name','login','email','role']);
    }catch(e){/* try next */}
  }
  throw new Error('id endpoints failed');
}
async function me(){
  for(const f of ME_TRIES){
    try{
      const jn=await j(f());
      if(jn && jn.ok && jn.user) return pick(jn.user,['id','name','login','email','role']);
    }catch(e){/* try next */}
  }
  throw new Error('me endpoint failed');
}
function extractId(el){
  const keys=['data-user-id','user_id','user-id','userid','data-id','data-user'];
  for(const k of keys){
    if(el.hasAttribute(k)){
      const v=String(el.getAttribute(k)||'');
      const m=(v.match(/(\d{1,10})/)||[])[1];
      if(m) return parseInt(m,10);
    }
  }
  const t=String(el.getAttribute('title')||'');
  const mt=(t.match(/(\d{1,10})/)||[])[1];
  if(mt) return parseInt(mt,10);
  const sp=new URLSearchParams(location.search);
  const qp=parseInt(sp.get('user_id')||sp.get('id')||sp.get('uid')||'0',10);
  return (qp>0?qp:0);
}
async function fill(el){
  if(!(el instanceof HTMLElement) || !el.classList.contains('user--name')) return;
  el.setAttribute('aria-busy','true');
  try{
    const id=extractId(el);
    const u = id>0 ? await byId(id) : await me();
    if(!u || !u.id) throw new Error('no user');
    el.setAttribute('data-user-id', String(u.id));
    el.setAttribute('title', `ID користувача: ${u.id}`);
    el.textContent = fmt(u);
    el.style.cursor='pointer';
    el.setAttribute('tabindex','0');
    const go=()=>{ try{ window.location.href=`/cabinet?user_id=${u.id}`; }catch(_){} };
    el.addEventListener('click', go);
    el.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); go(); } });
  }catch(e){
    el.setAttribute('data-user-inject-error', (e && e.message) ? e.message : String(e));
  }finally{
    el.removeAttribute('aria-busy');
  }
}
function scan(root){ (root||document).querySelectorAll('span.user--name').forEach(fill); }
document.addEventListener('DOMContentLoaded', ()=>scan(document));
const mo=new MutationObserver(muts=>{ for(const m of muts){ m.addedNodes && m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); }); } });
try{ mo.observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}
})();