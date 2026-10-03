/*
 * Patient Records: main.js
 * Lock screen (create, unlock, recover password), app-wide events, and start-up. Loads last.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= lock screen ================= */
const supported = 'showDirectoryPicker' in window && !!(window.crypto && crypto.subtle);
let createMode = 'first';   // 'first' | 'reset'
let pendingRoot = null;     // folder checked during a "data folder" reset
let fails = 0;

function showAuth(panel){
  ['aCreate','aEnter','aRecover','aCode'].forEach(id => $('#'+id).classList.toggle('hidden', id !== panel));
  showScreen('lock');
  const first = $('#'+panel+' input'); if (first) first.focus();
}
function showCreate(mode, note){
  createMode = mode;
  $('#aCreateTitle').textContent = mode === 'first' ? 'Create your password' : 'Set a new password';
  $('#aCreateText').textContent = note || (mode === 'first'
    ? 'This password unlocks the app on this computer. Each computer has its own password. Use at least 4 characters.'
    : 'Choose a new password for this computer. Use at least 4 characters.');
  $('#createBtn').textContent = mode === 'first' ? 'Create password' : 'Save password';
  $('#newPw1').value = $('#newPw2').value = ''; $('#createErr').textContent = '';
  showAuth('aCreate');
}
async function boot(){
  if (!supported){ $('#browserWarn').classList.remove('hidden'); ['aCreate','aEnter','aRecover','aCode'].forEach(id=>$('#'+id).classList.add('hidden')); return; }
  const a = await getAuth();
  if (a && a.hash) showAuth('aEnter'); else showCreate('first');
}
async function doCreate(){
  const p1 = $('#newPw1').value, p2 = $('#newPw2').value;
  const prob = pwProblem(p1, p2); if (prob){ $('#createErr').textContent = prob; return; }
  const btn = $('#createBtn'); btn.disabled = true;
  try{
    await savePassword(p1);
    $('#newPw1').value = $('#newPw2').value = '';
    try{ localStorage.removeItem('waitUntil'); }catch{}
    if (createMode === 'first'){
      const code = makeCode(); await saveRecovery(code);
      const cv = codeView(code);
      $('#codeSlot').innerHTML = ''; $('#codeSlot').appendChild(cv.el);
      $('#codeContinue').disabled = true;
      cv.box.onchange = () => $('#codeContinue').disabled = !cv.box.checked;
      showAuth('aCode');
    } else {
      await finishLogin();
    }
  }catch(e){ console.error(e); $('#createErr').textContent = 'The password could not be saved in this browser.'; }
  finally{ btn.disabled = false; }
}
async function finishLogin(){
  if (pendingRoot){ const r = pendingRoot; pendingRoot = null; await connect(r); }
  else await afterUnlock();
}
async function tryUnlock(){
  if (!supported) return;
  const wait = parseInt(lsGet('waitUntil'),10) || 0;
  if (Date.now() < wait){ $('#pwErr').textContent = `Too many wrong tries. Wait ${Math.ceil((wait-Date.now())/1000)} seconds.`; return; }
  const v = $('#pw').value; if (!v) return;
  const btn = $('#unlockBtn'); btn.disabled = true;
  let ok = false;
  try{ ok = await checkPassword(v); }catch(e){ console.error(e); }
  btn.disabled = false;
  if (!ok){
    fails++;
    if (fails >= 5){ fails = 0; lsSet('waitUntil', String(Date.now()+30000)); $('#pwErr').textContent = 'Too many wrong tries. Wait 30 seconds.'; }
    else $('#pwErr').textContent = 'Wrong password. Try again.';
    $('#pw').select(); return;
  }
  fails = 0; $('#pwErr').textContent = ''; $('#pw').value = '';
  await afterUnlock();
}
async function tryRecoveryCode(){
  $('#recErr').textContent = '';
  if (!normCode($('#recCode').value)){ $('#recErr').textContent = 'Type your recovery code first.'; return; }
  if (await checkRecovery($('#recCode').value)){ $('#recCode').value = ''; pendingRoot = null; showCreate('reset'); }
  else $('#recErr').textContent = 'That code is not right. Check it and try again.';
}
async function tryFileReset(){
  $('#recErr').textContent = '';
  let h = null; try{ h = await kvGet('root'); }catch{}
  if (!h){ pendingRoot = null; showCreate('reset', 'No data folder is linked on this computer yet, so you can set a new password. Use at least 4 characters.'); return; }
  try{
    let perm = await h.queryPermission({mode:'readwrite'});
    if (perm !== 'granted') perm = await h.requestPermission({mode:'readwrite'});
    if (perm !== 'granted'){ $('#recErr').textContent = 'Folder access was not allowed. Click the button again and choose Allow.'; return; }
    if (!(await dirAlive(h))){ pendingRoot = null; showCreate('reset', 'The data folder used before was not found, so you can set a new password. Use at least 4 characters.'); return; }
    if (await tryFile(h, RESET_FILE)){ $('#recErr').textContent = `The file “${RESET_FILE}” is still in the “${h.name}” folder. Delete it, then click the button again.`; return; }
    pendingRoot = h; showCreate('reset');
  }catch(e){ console.error(e); $('#recErr').textContent = friendly(e); }
}

$('#createBtn').onclick = doCreate;
$('#newPw2').addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });
$('#newPw1').addEventListener('keydown', e => { if (e.key === 'Enter') $('#newPw2').focus(); });
$('#showNew').onchange = () => { const t = $('#showNew').checked ? 'text' : 'password'; $('#newPw1').type = t; $('#newPw2').type = t; };
$('#codeContinue').onclick = () => finishLogin();
$('#unlockBtn').onclick = tryUnlock;
$('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
$('#forgotBtn').onclick = () => { $('#recErr').textContent = ''; showAuth('aRecover'); };
$('#recBack').onclick = () => showAuth('aEnter');
$('#recBtn').onclick = tryRecoveryCode;
$('#recCode').addEventListener('keydown', e => { if (e.key === 'Enter') tryRecoveryCode(); });
$('#fileResetBtn').onclick = tryFileReset;
document.addEventListener('click', e => { if (e.target.closest('[data-help]')){ e.preventDefault(); showHelp(); } });
boot();

/* ================= app events ================= */
$('#setupScreen').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'pick') pickFolder();
  if (a.dataset.act === 'reconnect') reconnect();
});

$('#q').addEventListener('input', () => renderList());
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') renderList(); });

$('#app').addEventListener('click', e => {
  const menuBtn = e.target.closest('[data-menu]');
  if (menuBtn){ e.stopPropagation(); const p = DATA.patients.find(x=>x.id===menuBtn.dataset.menu); if (p) patientMenu(menuBtn, p); return; }
  const act = e.target.closest('[data-act]');
  if (act){
    const a = act.dataset.act;
    const p = DATA.patients.find(x=>x.id===VIEW.id);
    const v = p && DATA.visits.find(x=>x.id===p.id && x.visit===VIEW.visit);
    if (a === 'settings') return showSettings();
    if (a === 'lock') return lock();
    if (a === 'search') return renderList();
    if (a === 'addPatient') return showPatientForm(null);
    if (a === 'toList') return go('list');
    if (a === 'toPatient' && p) return go('patient', p.id);
    if (a === 'addVisit' && p) return showVisitForm(p, null);
    if (a === 'pmenu' && p){ e.stopPropagation(); return patientMenu(act, p); }
    if (a === 'addImages' && p && v) return showAddImages(p, v);
    if (a === 'vmenu' && p && v){ e.stopPropagation(); return openMenu(act, [
      {label:'Edit visit', onClick: ()=> showVisitForm(p, v)},
      {label:'Delete visit', danger:true, onClick: ()=> askDeleteVisit(p, v)}
    ]); }
    return;
  }
  const row = e.target.closest('tr[data-id]');
  if (row) return go('patient', row.dataset.id);
  const vrow = e.target.closest('tr[data-visit]');
  if (vrow) return go('visit', VIEW.id, vrow.dataset.visit);
});
$('#app').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const tr = e.target.closest && e.target.closest('tr[data-id], tr[data-visit]');
  if (tr && e.target === tr) tr.click();
});
