/*
 * Patient Records: records.js
 * Patients and visits: add, edit, delete, search, and the list, patient and visit screens.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= patient: add / edit / delete ================= */
function showPatientForm(existing){
  const isEdit = !!existing;
  const form = document.createElement('form'); form.onsubmit = e => e.preventDefault();
  let html = `<h3 class="sec">Patient details</h3><div class="grid">${PATIENT_FIELDS.map(f=>fieldHtml(f, existing ? existing[f.key] : '')).join('')}</div>`;
  if (!isEdit){
    html += `<h3 class="sec">First visit <span class="muted">(date and time are added automatically)</span></h3>
      <div class="grid">${VISIT_FIELDS.map(f=>fieldHtml(f, f.key==='enteredBy' ? lsGet('enteredBy') : '')).join('')}</div>
      <h3 class="sec">Prescription and other images</h3>`;
  }
  form.innerHTML = html;
  let picker = null;
  if (!isEdit){ picker = imagePicker(); form.appendChild(picker.el); hookAgeFromDob(form); }
  const cnic = form.querySelector('[name=cnic]'); cnic.addEventListener('blur', ()=> cnic.value = fmtCnic(cnic.value));

  openModal({
    title: isEdit ? `Edit patient ${existing.id}` : 'Add patient', body: form, wide: true,
    cleanup: () => picker && picker.cleanup(),
    actions: [
      {label:'Cancel', onClick: closeModal},
      {label: isEdit ? 'Save changes' : 'Save patient', cls:'primary', onClick: async () => {
        const pv = readForm(form, PATIENT_FIELDS);
        const nameField = form.querySelector('[name=name]').closest('.field');
        if (!pv.name){ nameField.classList.add('bad'); form.querySelector('[name=name]').focus(); toast('Full name is required.', true); return; }
        nameField.classList.remove('bad');
        const dup = duplicateOf(pv, existing && existing.id);
        if (dup && !(await confirmBox('Same CNIC found', `Patient ${dup.id} (${dup.name}) already has this CNIC. Save anyway?`, 'Save anyway'))) return;
        try{
          if (isEdit){ await doEditPatient(existing.id, pv); toast('Changes saved'); }
          else {
            const vv = readForm(form, VISIT_FIELDS);
            if (vv.enteredBy) lsSet('enteredBy', vv.enteredBy);
            const id = await doAddPatient(pv, vv, picker.files.slice());
            toast(`Patient ${id} saved`);
          }
          closeModal();
        }catch{}
      }}
    ]
  });
  form.querySelector('[name=name]').focus();
}
async function doAddPatient(pv, vv, files){
  let newId;
  await mutate(async d => {
    const now = new Date();
    const id = nextId(d); newId = id;
    const p = {...blank(PATIENT_COLS), ...pv, id, regDate: fmtDate(now), regTime: fmtTime(now)};
    p.folder = safeName(p.name) + '_' + id;
    const dir = await ROOT.getDirectoryHandle(p.folder, {create:true});
    const v = {...blank(VISIT_COLS), ...vv, id, name: p.name, visit: '1', date: fmtDate(now), time: fmtTime(now)};
    v.images = (await saveFiles(dir, p, v, files, 0)).join('; ');
    d.patients.push(p); d.visits.push(v);
  });
  return newId;
}
async function doEditPatient(id, pv){
  await mutate(async d => {
    const p = d.patients.find(x=>x.id===id);
    if (!p) throw new Error('This patient was not found. It may have been deleted.');
    const oldName = p.name, oldFolder = folderOf(p);
    Object.assign(p, pv);
    if (safeName(oldName) !== safeName(p.name)){
      const oldPre = `${id}_${safeName(oldName)}_`, newPre = `${id}_${safeName(p.name)}_`;
      const ren = n => n.startsWith(oldPre) ? newPre + n.slice(oldPre.length) : n;
      const newFolder = safeName(p.name) + '_' + id;
      if (await tryDir(ROOT, oldFolder)) await moveDir(ROOT, oldFolder, ROOT, newFolder, ren);
      else await ROOT.getDirectoryHandle(newFolder, {create:true});
      p.folder = newFolder;
      d.visits.forEach(v => { if (v.id===id) v.images = splitImgs(v.images).map(ren).join('; '); });
    }
    d.visits.forEach(v => { if (v.id===id) v.name = p.name; });
  });
}
async function askDeletePatient(p){
  const ok = await confirmBox('Delete patient?', `${p.name} (${p.id}) will be removed from the list. Their folder and images will be moved to the “${DELETED_DIR}” folder, and their rows kept in the “Deleted” sheets of the Excel file.`, 'Delete', true);
  if (!ok) return;
  try{ await doDeletePatient(p.id); toast('Patient deleted'); go('list'); }catch{}
}
async function doDeletePatient(id){
  await mutate(async d => {
    const i = d.patients.findIndex(x=>x.id===id);
    if (i < 0) throw new Error('This patient was not found. It may already be deleted.');
    const p = d.patients[i], now = new Date(), stamp = fmtDate(now)+' '+fmtTime(now);
    const folder = folderOf(p);
    if (await tryDir(ROOT, folder)){
      const del = await ROOT.getDirectoryHandle(DELETED_DIR, {create:true});
      await moveDir(ROOT, folder, del, folder);
      p.folder = DELETED_DIR + '/' + folder;
    }
    d.patients.splice(i,1);
    d.delPatients.push({...p, deletedOn: stamp});
    d.visits = d.visits.filter(v => { if (v.id===id){ d.delVisits.push({...v, deletedOn: stamp}); return false; } return true; });
  });
}
function nextId(d){
  let m = 0;
  [...d.patients, ...d.delPatients].forEach(p => { const n = parseInt(p.id,10); if (!isNaN(n) && n > m) m = n; });
  return String(m+1).padStart(4,'0');
}
function nextVisitNo(d, id){
  let m = 0;
  [...d.visits, ...d.delVisits].forEach(v => { if (v.id===id){ const n = parseInt(v.visit,10); if (n > m) m = n; } });
  return m + 1;
}

/* ================= visit: add / edit / delete / images ================= */
function showVisitForm(p, existing){
  const isEdit = !!existing;
  const form = document.createElement('form'); form.onsubmit = e => e.preventDefault();
  form.innerHTML = `<div class="grid">${VISIT_FIELDS.map(f=>fieldHtml(f, existing ? existing[f.key] : (f.key==='enteredBy' ? lsGet('enteredBy') : ''))).join('')}</div>`
    + (isEdit ? '' : '<h3 class="sec">Prescription and other images</h3>');
  let picker = null;
  if (!isEdit){ picker = imagePicker(); form.appendChild(picker.el); hookAgeFromDob(form, p.dob); }
  openModal({
    title: isEdit ? `Edit visit ${existing.visit} of ${p.name}` : `New visit for ${p.name}`,
    body: form, wide: true, cleanup: () => picker && picker.cleanup(),
    actions: [
      {label:'Cancel', onClick: closeModal},
      {label: isEdit ? 'Save changes' : 'Save visit', cls:'primary', onClick: async () => {
        const vv = readForm(form, VISIT_FIELDS);
        if (vv.enteredBy) lsSet('enteredBy', vv.enteredBy);
        try{
          if (isEdit){ await doEditVisit(p.id, existing.visit, vv); toast('Changes saved'); }
          else { const no = await doAddVisit(p.id, vv, picker.files.slice()); toast(`Visit ${no} saved`); }
          closeModal();
        }catch{}
      }}
    ]
  });
  { const el = form.querySelector('[name=age]'); el && el.focus(); }
}
async function doAddVisit(id, vv, files){
  let no;
  await mutate(async d => {
    const p = d.patients.find(x=>x.id===id);
    if (!p) throw new Error('This patient was not found. It may have been deleted.');
    const now = new Date(); no = nextVisitNo(d, id);
    const v = {...blank(VISIT_COLS), ...vv, id, name: p.name, visit: String(no), date: fmtDate(now), time: fmtTime(now)};
    const dir = await patientDir(p, true);
    v.images = (await saveFiles(dir, p, v, files, 0)).join('; ');
    d.visits.push(v);
  });
  return no;
}
async function doEditVisit(id, visitNo, vv){
  await mutate(async d => {
    const v = d.visits.find(x=>x.id===id && x.visit===visitNo);
    if (!v) throw new Error('This visit was not found.');
    Object.assign(v, vv);
  });
}
function showAddImages(p, v){
  const picker = imagePicker();
  openModal({
    title: `Add images to visit ${v.visit}`, body: picker.el, cleanup: () => picker.cleanup(),
    actions: [
      {label:'Cancel', onClick: closeModal},
      {label:'Add images', cls:'primary', onClick: async () => {
        if (!picker.files.length){ toast('Choose at least one image.', true); return; }
        try{
          await mutate(async d => {
            const pp = d.patients.find(x=>x.id===p.id), vv = d.visits.find(x=>x.id===v.id && x.visit===v.visit);
            if (!pp || !vv) throw new Error('This visit was not found.');
            const have = splitImgs(vv.images);
            const names = await saveFiles(await patientDir(pp, true), pp, vv, picker.files.slice(), have.length);
            vv.images = [...have, ...names].join('; ');
          });
          toast('Images added'); closeModal();
        }catch{}
      }}
    ]
  });
}
async function askDeleteVisit(p, v){
  const ok = await confirmBox('Delete visit?', `Visit ${v.visit} (${v.date}) will be removed. Its images will be moved to the “${DELETED_DIR}” folder.`, 'Delete', true);
  if (!ok) return;
  try{
    await mutate(async d => {
      const i = d.visits.findIndex(x=>x.id===v.id && x.visit===v.visit);
      if (i < 0) throw new Error('This visit was not found.');
      const vv = d.visits[i], pp = d.patients.find(x=>x.id===v.id);
      const imgs = splitImgs(vv.images);
      if (imgs.length && pp){
        const dir = await patientDir(pp, false);
        if (dir){
          const del = await (await ROOT.getDirectoryHandle(DELETED_DIR,{create:true})).getDirectoryHandle(folderOf(pp),{create:true});
          for (const n of imgs){
            const fh = await tryFile(dir, n);
            if (fh){ await writeFile(del, n, await fh.getFile()); await dir.removeEntry(n); }
          }
        }
      }
      const now = new Date();
      d.visits.splice(i,1);
      d.delVisits.push({...vv, deletedOn: fmtDate(now)+' '+fmtTime(now)});
    });
    toast('Visit deleted'); go('patient', p.id);
  }catch{}
}

/* ================= search ================= */
function matches(p, q){
  q = q.trim(); if (!q) return true;
  const compact = q.replace(/[\s\-+()]/g,'');
  if (/^\d+$/.test(compact)){
    if (compact.length <= 5) return p.id === normId(compact);          // Unique ID
    if (digits(p.cnic).includes(compact)) return true;                 // CNIC
    return normPhone(p.phone).includes(normPhone(compact));            // Phone
  }
  const name = String(p.name||'').toLowerCase().replace(/\s+/g,' ').trim();
  const ql = q.toLowerCase().replace(/\s+/g,' ');
  if (ql.includes(' ')) return name.startsWith(ql);                   // typed more than one word
  return (name.split(' ')[0]||'').startsWith(ql);                     // first name only
}

/* ================= rendering ================= */
function go(name, id=null, visit=null){ VIEW = {name, id, visit}; render(); scrollTo(0,0); }
function render(){
  closeMenu();
  $('#listView').classList.toggle('hidden', VIEW.name !== 'list');
  $('#patientView').classList.toggle('hidden', VIEW.name !== 'patient');
  $('#visitView').classList.toggle('hidden', VIEW.name !== 'visit');
  if (VIEW.name !== 'visit') releaseViewUrls();
  $('#folderLabel').textContent = ROOT ? '📁 ' + ROOT.name : '';
  if (VIEW.name === 'list') renderList();
  else if (VIEW.name === 'patient') renderPatient();
  else renderVisit();
}
function visitsById(){
  const m = new Map();
  DATA.visits.forEach(v => { if (!m.has(v.id)) m.set(v.id, []); m.get(v.id).push(v); });
  m.forEach(a => a.sort((x,y)=> (parseInt(y.visit,10)||0)-(parseInt(x.visit,10)||0)));
  return m;
}
function renderList(){
  const q = $('#q').value;
  const vm = visitsById();
  const list = DATA.patients.filter(p=>matches(p,q)).sort((a,b)=>(parseInt(b.id,10)||0)-(parseInt(a.id,10)||0));
  const total = DATA.patients.length;
  $('#count').textContent = q.trim() ? `${list.length} of ${total} patients match` : `${total} patient${total===1?'':'s'}`;
  $('#rows').innerHTML = list.map(p=>{
    const vs = vm.get(p.id) || [];
    return `<tr data-id="${esc(p.id)}" tabindex="0">
      <td><span class="pid">${esc(p.id)}</span></td><td><b>${esc(p.name)}</b></td><td>${esc(p.father)}</td>
      <td>${esc(p.phone)}</td><td>${esc(p.cnic)}</td><td>${vs.length}</td><td>${vs[0] ? esc(vs[0].date) : ''}</td>
      <td class="menu-cell"><button class="dots" data-menu="${esc(p.id)}" aria-label="More options for ${esc(p.name)}">⋮</button></td></tr>`;
  }).join('');
  const empty = $('#listEmpty');
  if (!list.length){
    empty.innerHTML = total
      ? `<b>No patient matches “${esc(q.trim())}”</b>Check the spelling, or search by Unique ID, CNIC or phone.`
      : `<b>No patients yet</b>Click “+ Add patient” to add the first one.`;
    empty.classList.remove('hidden');
  } else empty.classList.add('hidden');
}
function patientMenu(btn, p){
  openMenu(btn, [
    {label:'Edit', onClick: ()=> showPatientForm(p)},
    {label:'Delete', danger:true, onClick: ()=> askDeletePatient(p)}
  ]);
}
function renderPatient(){
  const p = DATA.patients.find(x=>x.id===VIEW.id);
  if (!p){ VIEW = {name:'list'}; return render(); }
  const vs = visitsById().get(p.id) || [];
  const info = PATIENT_FIELDS.filter(f=>f.key!=='name').map(f=>
    `<div class="${f.wide?'wide':''}"><dt>${esc(f.label)}</dt><dd>${esc(p[f.key]) || '<span class="muted">—</span>'}</dd></div>`).join('')
    + `<div><dt>Registered</dt><dd>${esc(p.regDate)} ${esc(p.regTime)}</dd></div><div><dt>Folder</dt><dd>${esc(folderOf(p))}</dd></div>`;
  $('#patientView').innerHTML = `
    <div class="crumbs"><button class="link" data-act="toList">← All patients</button></div>
    <div class="card">
      <div class="card-head">
        <div class="grow"><span class="pid">${esc(p.id)}</span><h2>${esc(p.name)}</h2></div>
        <div class="acts"><button class="btn primary" data-act="addVisit">+ Add visit</button><button class="dots" data-act="pmenu" aria-label="More options">⋮</button></div>
      </div>
      <dl class="info">${info}</dl>
    </div>
    <h3 class="sub">Visits (${vs.length})</h3>
    <div class="tablewrap">
      <table><thead><tr><th>Visit #</th><th>Date</th><th>Time</th><th>Symptoms</th><th>Treatment</th><th>Images</th></tr></thead>
      <tbody>${vs.map(v=>`<tr data-visit="${esc(v.visit)}" tabindex="0"><td><b>${esc(v.visit)}</b></td><td>${esc(v.date)}</td><td>${esc(v.time)}</td>
        <td><div class="clip">${esc(v.symptoms)}</div></td><td><div class="clip">${esc(v.treatment)}</div></td><td>${splitImgs(v.images).length}</td></tr>`).join('')}</tbody></table>
      ${vs.length ? '' : '<div class="empty"><b>No visits yet</b>Click “+ Add visit” to record one.</div>'}
    </div>`;
}
function releaseViewUrls(){ viewUrls.splice(0).forEach(u=>URL.revokeObjectURL(u)); }
async function renderVisit(){
  const p = DATA.patients.find(x=>x.id===VIEW.id);
  const v = DATA.visits.find(x=>x.id===VIEW.id && x.visit===VIEW.visit);
  if (!p){ VIEW = {name:'list'}; return render(); }
  if (!v){ VIEW = {name:'patient', id:p.id}; return render(); }
  const token = ++renderToken;
  releaseViewUrls();
  const imgs = splitImgs(v.images);
  const info = VISIT_FIELDS.map(f=>`<div class="${f.wide?'wide':''}"><dt>${esc(f.label)}</dt><dd>${esc(v[f.key]) || '<span class="muted">—</span>'}</dd></div>`).join('');
  $('#visitView').innerHTML = `
    <div class="crumbs"><button class="link" data-act="toList">← All patients</button><button class="link" data-act="toPatient">← ${esc(p.name)}</button></div>
    <div class="card">
      <div class="card-head">
        <div class="grow"><span class="pid">${esc(p.id)}</span><h2>${esc(p.name)}: visit ${esc(v.visit)}</h2><div class="muted">${esc(v.date)}, ${esc(v.time)}</div></div>
        <div class="acts"><button class="btn primary" data-act="addImages">+ Add images</button><button class="dots" data-act="vmenu" aria-label="More options">⋮</button></div>
      </div>
    </div>
    <h3 class="sub">Images (${imgs.length})</h3>
    <div class="gallery" id="gallery" style="margin-bottom:22px">${imgs.length ? '' : '<div class="muted">No images for this visit.</div>'}</div>
    <div class="card"><h3 class="sub">Visit details</h3><dl class="info">${info}</dl></div>`;
  if (!imgs.length) return;
  const dir = await patientDir(p, false);
  if (token !== renderToken) return;
  const items = [];
  const gal = $('#gallery');
  for (const name of imgs){
    const tile = document.createElement('div'); tile.className = 'tile';
    let file = null;
    try{ const fh = dir && await tryFile(dir, name); if (fh) file = await fh.getFile(); }catch{}
    if (token !== renderToken) return;
    if (!file){
      tile.classList.add('missing');
      tile.innerHTML = `<div class="img muted">File not found</div><div class="cap">${esc(name)}</div>`;
    } else {
      const url = URL.createObjectURL(file); viewUrls.push(url);
      const idx = items.length; items.push({name, url});
      tile.innerHTML = `<div class="img">${isPdf(name) ? '<span class="pdf">PDF</span>' : `<img src="${url}" alt="${esc(name)}" loading="lazy">`}</div><div class="cap">${esc(name)}</div>`;
      tile.tabIndex = 0;
      tile.onclick = () => isPdf(name) ? window.open(url, '_blank') : openLightbox(items.filter(x=>!isPdf(x.name)), items.filter(x=>!isPdf(x.name)).findIndex(x=>x.url===url));
      tile.onkeydown = e => { if (e.key==='Enter') tile.click(); };
    }
    gal.appendChild(tile);
  }
}

/* ================= lightbox ================= */
let LB = {items:[], i:0};
function openLightbox(items, i){ LB = {items, i}; showLb(); $('#lightbox').classList.remove('hidden'); }
function showLb(){
  const it = LB.items[LB.i]; if (!it) return;
  $('#lbImg').src = it.url; $('#lbName').textContent = `${it.name}  (${LB.i+1} of ${LB.items.length})`;
  $('#lbPrev').style.visibility = LB.items.length > 1 ? 'visible' : 'hidden';
  $('#lbNext').style.visibility = LB.items.length > 1 ? 'visible' : 'hidden';
}
function closeLightbox(){ $('#lightbox').classList.add('hidden'); $('#lbImg').removeAttribute('src'); }
$('#lbClose').onclick = closeLightbox;
$('#lbOpen').onclick = () => { const it = LB.items[LB.i]; if (it) window.open(it.url, '_blank'); };
$('#lbPrev').onclick = () => { LB.i = (LB.i - 1 + LB.items.length) % LB.items.length; showLb(); };
$('#lbNext').onclick = () => { LB.i = (LB.i + 1) % LB.items.length; showLb(); };
document.addEventListener('keydown', e => {
  if ($('#lightbox').classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft') $('#lbPrev').click();
  if (e.key === 'ArrowRight') $('#lbNext').click();
});
