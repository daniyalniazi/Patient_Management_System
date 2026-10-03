/*
 * Patient Records: core.js
 * Shared state, small helpers, browser storage (IndexedDB) and password hashing.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= state ================= */
let ROOT = null;
let DATA = emptyData();
let VIEW = {name:'list', id:null, visit:null};
let MENU = null;
let MODAL_CLEANUP = null;
let viewUrls = [];
let renderToken = 0;
let backedUpDay = null;

/* ================= helpers ================= */
const $ = (s, el=document) => el.querySelector(s);
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pad(n,w=2){ return String(n).padStart(w,'0'); }
function fmtDate(d){ return pad(d.getDate())+'-'+pad(d.getMonth()+1)+'-'+d.getFullYear(); }
function fmtTime(d){ let h=d.getHours(); const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+pad(d.getMinutes())+' '+ap; }
function isoDay(d=new Date()){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function digits(s){ return String(s ?? '').replace(/\D/g,''); }
function normId(x){ x = String(x ?? '').trim(); return /^\d+$/.test(x) ? x.padStart(4,'0') : x; }
function normPhone(s){ let d = digits(s); if (d.startsWith('0092')) d = d.slice(2); if (d.startsWith('92') && d.length===12) d = '0'+d.slice(2); return d; }
function fmtCnic(s){ const d = digits(s); return d.length===13 ? d.slice(0,5)+'-'+d.slice(5,12)+'-'+d.slice(12) : String(s||'').trim(); }
function safeName(s){
  let n = String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'');
  if (n.length > 60) n = n.slice(0,60).trim();
  return n || 'Patient';
}
function isoToDmy(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso||''); }
function dmyToIso(s){ const m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(String(s||'').trim()); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : ''; }
function ageFromDob(dmy){
  const iso = dmyToIso(dmy); if (!iso) return '';
  const b = new Date(iso+'T00:00:00'), n = new Date();
  let y = n.getFullYear()-b.getFullYear(), mo = n.getMonth()-b.getMonth();
  if (n.getDate() < b.getDate()) mo--;
  if (mo < 0){ y--; mo += 12; }
  if (y < 0) return '';
  return y === 0 ? mo+' months' : String(y);
}
function splitImgs(s){ return String(s||'').split(';').map(x=>x.trim()).filter(Boolean); }
function extOf(f){
  const m = /\.([a-z0-9]{1,5})$/i.exec(f.name||'');
  if (m) return '.'+m[1].toLowerCase();
  const t = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/heic':'.heic','application/pdf':'.pdf'}[f.type];
  return t || '.jpg';
}
function isPdf(name){ return /\.pdf$/i.test(name); }
function blank(cols){ const o={}; cols.forEach(c=>o[c[0]]=''); return o; }
function emptyData(){ return {patients:[], visits:[], delPatients:[], delVisits:[]}; }
function lsGet(k){ try{ return localStorage.getItem(k)||''; }catch{ return ''; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch{} }
function folderOf(p){ return p.folder || (safeName(p.name)+'_'+p.id); }

/* ================= IndexedDB (remembers the chosen folder on this device) ================= */
function idb(){
  return new Promise((res,rej)=>{ const r = indexedDB.open('patient-records',1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function kvGet(k){ const db = await idb(); return new Promise((res,rej)=>{ const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
async function kvDel(k){ const db = await idb(); return new Promise((res,rej)=>{ const t = db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }
async function kvSet(k,v){ const db = await idb(); return new Promise((res,rej)=>{ const t = db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }

/* ================= password (saved only in this browser, as a salted hash) ================= */
function b64e(u8){ let s=''; u8.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
function b64d(s){ return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
function randB64(n=16){ return b64e(crypto.getRandomValues(new Uint8Array(n))); }
async function derive(secret, salt, iter){
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:b64d(salt), iterations:iter}, key, 256);
  return b64e(new Uint8Array(bits));
}
function makeCode(){
  const b = crypto.getRandomValues(new Uint8Array(16)); let s = '';
  b.forEach((x,i)=>{ s += CODE_CHARS[x % 32]; if (i % 4 === 3 && i < 15) s += '-'; });
  return s;
}
function normCode(s){ return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
async function getAuth(){ try{ return (await kvGet('auth')) || null; }catch{ return null; } }
async function savePassword(pw){
  const a = (await getAuth()) || {v:1};
  a.iter = PBKDF2_ITER; a.salt = randB64(); a.hash = await derive(pw, a.salt, a.iter);
  await kvSet('auth', a);
}
async function saveRecovery(code){
  const a = (await getAuth()) || {v:1};
  a.riter = PBKDF2_ITER; a.rsalt = randB64(); a.rhash = await derive(normCode(code), a.rsalt, a.riter);
  await kvSet('auth', a);
}
async function checkPassword(pw){ const a = await getAuth(); return !!(a && a.hash) && (await derive(pw, a.salt, a.iter)) === a.hash; }
async function checkRecovery(code){ const a = await getAuth(); return !!(a && a.rhash) && !!normCode(code) && (await derive(normCode(code), a.rsalt, a.riter)) === a.rhash; }
function pwProblem(p1, p2){
  if (p1.length < 4) return 'Use at least 4 characters.';
  if (p1 !== p2) return 'The two passwords are not the same.';
  return '';
}
/* Recovery code box with Copy / Save as file / "I have saved it" */
function codeView(code){
  const el = document.createElement('div');
  el.innerHTML = `<div class="codebox">${esc(code)}</div>
    <div class="row"><button type="button" class="btn" data-c="copy">Copy</button><button type="button" class="btn" data-c="save">Save as file</button></div>
    <label class="checkline"><input type="checkbox"> I have saved my recovery code</label>`;
  el.querySelector('[data-c=copy]').onclick = async () => {
    try{ await navigator.clipboard.writeText(code); toast('Code copied'); }
    catch{ const r = document.createRange(); r.selectNodeContents($('.codebox', el)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Press Ctrl+C (Cmd+C on Mac) to copy'); }
  };
  el.querySelector('[data-c=save]').onclick = () => {
    const txt = `Patient Records recovery code\r\n\r\n${code}\r\n\r\nIf you forget your password: open the app, click "Forgot password?",\r\ntype this code and click "Check code". Keep this file somewhere safe.\r\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'}));
    a.download = 'Patient Records - recovery code.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  };
  return {el, box: el.querySelector('input[type=checkbox]')};
}
