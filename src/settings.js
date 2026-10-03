/*
 * Patient Records: settings.js
 * Settings dialog, choosing the data folder, and the built-in help page.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= settings ================= */
function showSettings(){
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="setrow"><b>Password</b><p>The password is saved in this browser only. Each computer has its own.</p>
      <div class="row"><button class="btn" data-s="pw">Change password</button><button class="btn" data-s="code">Make a new recovery code</button></div></div>
    <div class="setrow"><b>Data folder</b><p>Now using “${esc(ROOT ? ROOT.name : '')}”. Patient folders, ${esc(FILE_NAME)}, daily backups (“${BACKUP_DIR}”) and deleted records (“${DELETED_DIR}”) are all kept here.</p>
      <button class="btn" data-s="pick">Choose a different folder</button></div>
    <div class="setrow"><b>Reload data</b><p>Use this if ${esc(FILE_NAME)} was changed outside the app.</p>
      <button class="btn" data-s="reload">Reload from Excel</button></div>
    <div class="setrow"><b>Lock the app</b><p>Hides everything until the password is entered again.</p>
      <button class="btn" data-s="lock">Lock now</button></div>
    <div class="setrow dangerzone"><b>Start over</b><p>Makes this browser forget the password, recovery code and folder, so the app opens like the first time.</p>
      <button class="btn" data-s="reset">Start over</button></div>`;
  body.onclick = async e => {
    const a = e.target.closest('[data-s]'); if (!a) return;
    const k = a.dataset.s;
    if (k === 'pw') showChangePassword();
    if (k === 'code') showNewCode();
    if (k === 'pick'){ closeModal(); await pickFolder(); }
    if (k === 'reload'){ closeModal(); await reloadData(); }
    if (k === 'lock') lock();
    if (k === 'reset') showStartOver();
  };
  openModal({title:'Settings', body, actions:[{label:'Close', onClick: closeModal}]});
}
function pwFields(withCurrent){
  const f = document.createElement('div'); f.className = 'stack';
  f.innerHTML = (withCurrent ? '<label class="field"><span>Current password</span><input type="password" data-k="cur" autocomplete="current-password"></label>' : '')
    + '<label class="field"><span>New password</span><input type="password" data-k="p1" autocomplete="new-password"></label>'
    + '<label class="field"><span>Type it again</span><input type="password" data-k="p2" autocomplete="new-password"></label>'
    + '<label class="checkline"><input type="checkbox" data-k="show"> Show passwords</label><div class="err" data-k="err"></div>';
  const q = k => f.querySelector(`[data-k=${k}]`);
  q('show').onchange = () => f.querySelectorAll('input[type=password],input[data-pw]').forEach(i => { i.dataset.pw = 1; i.type = q('show').checked ? 'text' : 'password'; });
  return {el:f, q};
}
function showChangePassword(){
  const {el, q} = pwFields(true);
  openModal({title:'Change password', body: el, actions:[
    {label:'Cancel', onClick: closeModal},
    {label:'Save password', cls:'primary', onClick: async () => {
      q('err').textContent = '';
      if (!(await checkPassword(q('cur').value))){ q('err').textContent = 'The current password is not right.'; return; }
      const prob = pwProblem(q('p1').value, q('p2').value); if (prob){ q('err').textContent = prob; return; }
      try{ await savePassword(q('p1').value); closeModal(); toast('Password changed'); }
      catch(e){ console.error(e); q('err').textContent = 'The password could not be saved in this browser.'; }
    }}
  ]});
  q('cur').focus();
}
function showNewCode(){
  const f = document.createElement('div');
  f.innerHTML = '<p class="muted" style="margin-top:0">Your old recovery code will stop working. Enter your password to continue.</p><label class="field"><span>Current password</span><input type="password" data-k="cur" autocomplete="current-password"></label><div class="err" data-k="err"></div>';
  const cur = f.querySelector('[data-k=cur]'), err = f.querySelector('[data-k=err]');
  openModal({title:'Make a new recovery code', body: f, actions:[
    {label:'Cancel', onClick: closeModal},
    {label:'Make new code', cls:'primary', onClick: async () => {
      if (!(await checkPassword(cur.value))){ err.textContent = 'The password is not right.'; return; }
      const code = makeCode();
      try{ await saveRecovery(code); }catch(e){ console.error(e); err.textContent = 'The code could not be saved in this browser.'; return; }
      const cv = codeView(code);
      const wrap = document.createElement('div');
      wrap.innerHTML = '<p class="muted" style="margin-top:0">This is your new recovery code. It is shown only once.</p>';
      wrap.appendChild(cv.el);
      openModal({title:'Your new recovery code', body: wrap, actions:[{label:'Done', cls:'primary', onClick: () => {
        if (!cv.box.checked){ toast('Tick “I have saved my recovery code” first.', true); return; }
        closeModal();
      }}]});
    }}
  ]});
  cur.focus();
}
function showStartOver(){
  const f = document.createElement('div');
  f.innerHTML = `<p style="margin-top:0">This browser will forget the password, recovery code and data folder. Your patient data stays in the folder unless you tick the box below.</p>
    <label class="checkline"><input type="checkbox" data-k="wipe"> Delete everything in the Patients data folder (all patients, images and backups)</label>
    <label class="field hidden" data-k="confirmWrap"><span>Type DELETE to confirm. This cannot be undone.</span><input type="text" data-k="confirm" autocomplete="off"></label>
    <div class="err" data-k="err"></div>`;
  const q = k => f.querySelector(`[data-k=${k}]`);
  q('wipe').onchange = () => q('confirmWrap').classList.toggle('hidden', !q('wipe').checked);
  openModal({title:'Start over', body: f, actions:[
    {label:'Cancel', onClick: closeModal},
    {label:'Start over', cls:'danger', onClick: async () => {
      const wipe = q('wipe').checked;
      if (wipe && q('confirm').value.trim() !== 'DELETE'){ q('err').textContent = 'Type DELETE in the box to delete all data.'; return; }
      busy(true, wipe ? 'Deleting…' : 'Resetting…');
      try{
        if (wipe && ROOT){
          const names = []; for await (const k of ROOT.keys()) names.push(k);
          for (const n of names) await ROOT.removeEntry(n, {recursive:true});
        }
        await kvDel('auth'); await kvDel('root');
        try{ localStorage.removeItem('enteredBy'); localStorage.removeItem('waitUntil'); }catch{}
        location.reload();
      }catch(e){
        console.error(e); busy(false);
        q('err').textContent = wipe ? `Some files could not be deleted. Close ${FILE_NAME} and any open images, then try again.` : 'Could not reset this browser.';
      }
    }}
  ]});
}
async function reloadData(){
  busy(true,'Loading…');
  try{ DATA = await loadData(); render(); toast('Data reloaded'); }
  catch(e){ console.error(e); toast(friendly(e), true); }
  finally{ busy(false); }
}
function lock(){ location.reload(); }

/* ================= folder setup ================= */
function showScreen(which){
  $('#lockScreen').classList.toggle('hidden', which !== 'lock');
  $('#setupScreen').classList.toggle('hidden', which !== 'setup');
  $('#app').classList.toggle('hidden', which !== 'app');
}
function showSetup(mode, name){
  $('#setupErr').textContent = '';
  $('#setupNew').classList.toggle('hidden', mode !== 'new');
  $('#setupReconnect').classList.toggle('hidden', mode !== 'reconnect');
  if (name) $('#reName').textContent = name;
  showScreen('setup');
}
async function pickFolder(){
  let picked;
  try{ picked = await window.showDirectoryPicker({id:'patient-records', mode:'readwrite'}); }
  catch(e){ if (e.name !== 'AbortError'){ console.error(e); $('#setupErr').textContent = friendly(e); toast(friendly(e), true); } return; }
  try{
    const root = picked.name.toLowerCase() === ROOT_NAME.toLowerCase() ? picked : await picked.getDirectoryHandle(ROOT_NAME, {create:true});
    try{ await kvSet('root', root); }catch(e){ console.warn('Could not remember folder', e); }
    await connect(root);
  }catch(e){ console.error(e); $('#setupErr').textContent = friendly(e); toast(friendly(e), true); }
}
async function reconnect(){
  try{
    const h = await kvGet('root');
    if (!h) return showSetup('new');
    const perm = await h.requestPermission({mode:'readwrite'});
    if (perm === 'granted') await connect(h);
    else $('#setupErr').textContent = 'Access was not allowed. Click “Allow access” and choose Allow.';
  }catch(e){ console.error(e); $('#setupErr').textContent = friendly(e); }
}
async function connect(root){
  if (!(await dirAlive(root))){
    showSetup('new');
    $('#setupErr').textContent = `The folder “${root.name}” used before was not found. Choose a folder.`;
    return;
  }
  ROOT = root;
  busy(true,'Loading…');
  try{
    if (!(await tryFile(ROOT, FILE_NAME))) await saveData(emptyData());
    await ensureResetFile();

    DATA = await loadData();
    backedUpDay = null;
    showScreen('app'); VIEW = {name:'list'}; render();
    setTimeout(()=> $('#q').focus(), 50);
  }finally{ busy(false); }
}
async function afterUnlock(){
  let h = null;
  try{ h = await kvGet('root'); }catch(e){ console.warn('No saved folder', e); }
  if (!h) return showSetup('new');
  try{
    let perm = await h.queryPermission({mode:'readwrite'});
    if (perm !== 'granted'){ try{ perm = await h.requestPermission({mode:'readwrite'}); }catch{} }
    if (perm === 'granted'){ await connect(h); return; }
  }catch(e){ console.warn(e); }
  showSetup('reconnect', h.name);
}

/* ================= help ================= */
const HELP_HTML = `
<h3>What this app does</h3>
<p>Patient Records keeps clinic patient records on your own computer. It needs no internet or account. It works in Google Chrome or Microsoft Edge on Windows and Mac.</p>

<h3>First time</h3>
<ol>
<li>Create a password of at least 4 characters.</li>
<li>Write down the recovery code or click <b>Save as file</b>. It is shown only once.</li>
<li>Click <b>Choose folder</b> and pick a folder, for example “Clinic” in Documents. The app makes a <b>Patients data</b> folder inside it.</li>
<li>If the browser asks to let the page edit files, click <b>Allow</b>.</li>
</ol>

<h3>Add a patient</h3>
<ol>
<li>Click <b>+ Add patient</b>. Only the full name is required.</li>
<li>Fill in any details and the first visit. Date and time are added automatically.</li>
<li>Click <b>Choose images</b> to add prescriptions or reports (several at once, PDFs too).</li>
<li>Click <b>Save patient</b>. The patient gets a Unique ID such as 0001 and their own folder.</li>
</ol>

<h3>Find a patient</h3>
<table>
<tr><th>What you type</th><th>What it finds</th></tr>
<tr><td>A name, like Ali</td><td>Patients whose first name starts with it</td></tr>
<tr><td>Two or more words, like Ali Khan</td><td>Patients whose full name starts with them</td></tr>
<tr><td>1 to 5 digits, like 12</td><td>The patient with that Unique ID</td></tr>
<tr><td>6 or more digits</td><td>Patients whose CNIC or phone contains them</td></tr>
</table>

<h3>Visits and images</h3>
<ul>
<li>Click a patient to see their details and visits. Click <b>+ Add visit</b> for a new visit.</li>
<li>Click a visit to see its images. Click an image to view it full size.</li>
<li>To add images later, open the visit and click <b>+ Add images</b>.</li>
<li>Images are copied and renamed, for example <i>0001_Ali Khan_V2_29-09-2026.jpg</i>. The originals stay where they were.</li>
</ul>

<h3>Edit or delete</h3>
<p>Click <b>⋮</b> next to a patient or a visit, then Edit or Delete. Deleted folders and images move to the <b>Deleted</b> folder, and their rows move to the Deleted sheets of the Excel file. Nothing is erased.</p>

<h3>Where your data is kept</h3>
<pre>Patients data
├── PatientData.xlsx
├── Ali Khan_0001  (images for that patient)
├── Backups        (one Excel copy per day)
├── Deleted
└── Delete this file to reset password.txt</pre>
<p>You can open PatientData.xlsx in Excel, but close it before saving in the app. If you edit it by hand, keep the column names and then click <b>Settings → Reload from Excel</b>.</p>

<h3>Password</h3>
<ul>
<li>Each computer has its own password, saved in that browser.</li>
<li>Change it, or make a new recovery code, in <b>Settings</b>.</li>
<li>Forgot it? Click <b>Forgot password?</b> on the lock screen. Then type your recovery code, or delete the file “Delete this file to reset password.txt” in your Patients data folder and click <b>I deleted the file</b>.</li>
<li>After 5 wrong tries, the app makes you wait 30 seconds.</li>
</ul>

<h3>Another computer</h3>
<p>Copy this file and the Patients data folder (or use a USB drive or synced folder). Open the app, create a password for that computer, and choose the folder. Use the same folder on only one computer at a time.</p>

<h3>Start over</h3>
<p><b>Settings → Start over</b> makes this browser forget the password and folder. Patient data is kept unless you tick the delete box and type DELETE.</p>

<h3>Privacy and safety</h3>
<ul>
<li>The app sends nothing over the internet.</li>
<li>The password only locks the app screen. Anyone who can open the Patients data folder can read the Excel file and images.</li>
<li>Protect the computer with its own password and disk encryption (BitLocker or Device Encryption on Windows, FileVault on Mac).</li>
<li>Copy the Patients data folder to a USB drive or another safe place at least once a week.</li>
</ul>

<h3>License</h3>
<p>Patient Records is free for everyone, including private clinics. Nobody may sell it, charge for it, or include it in anything they sell. If someone charged you for this app, they broke its license.</p>

<h3>Common problems</h3>
<table>
<tr><th>Problem</th><th>What to do</th></tr>
<tr><td>Saving fails and mentions the Excel file</td><td>Close PatientData.xlsx in Excel and save again.</td></tr>
<tr><td>The browser asks for folder access</td><td>Click Allow. It asks again after the browser restarts.</td></tr>
<tr><td>The browser won’t let you pick a folder</td><td>Pick an ordinary folder, such as Clinic in Documents.</td></tr>
<tr><td>An image shows “File not found”</td><td>It was moved or renamed outside the app. Put it back with the same name.</td></tr>
</table>`;
function showHelp(){
  const d = document.createElement('div'); d.className = 'help'; d.innerHTML = HELP_HTML;
  openModal({title:'How to use Patient Records', body: d, wide: true, actions:[{label:'Close', cls:'primary', onClick: closeModal}]});
}
