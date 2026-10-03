/*
 * Patient Records: ui.js
 * Reusable interface pieces: toasts, menus, dialogs, form fields and the image picker.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= UI bits ================= */
let toastTimer;
function toast(msg, bad=false){
  const t = $('#toast'); t.textContent = msg; t.className = bad ? 'bad' : '';
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.className='hidden', bad ? 6500 : 2800);
}
function busy(on, label='Saving…'){ const b=$('#busy'); b.textContent=label; b.classList.toggle('hidden', !on); }

function openMenu(btn, items){
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role','menu');
  items.forEach(it=>{
    const b = document.createElement('button'); b.textContent = it.label; b.setAttribute('role','menuitem');
    if (it.danger) b.className = 'danger';
    b.onclick = e => { e.stopPropagation(); closeMenu(); it.onClick(); };
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  let left = r.right + scrollX - m.offsetWidth; if (left < 8) left = 8;
  let top = r.bottom + scrollY + 4;
  if (r.bottom + m.offsetHeight + 8 > innerHeight) top = r.top + scrollY - m.offsetHeight - 4;
  m.style.left = left+'px'; m.style.top = top+'px';
  MENU = m; m.querySelector('button').focus();
}
function closeMenu(){ if (MENU){ MENU.remove(); MENU = null; } }
document.addEventListener('click', e => { if (MENU && !MENU.contains(e.target)) closeMenu(); });

function openModal({title, body, actions, wide=false, cleanup=null}){
  closeModal();
  $('#modalTitle').textContent = title;
  const b = $('#modalBody'); b.innerHTML = ''; b.scrollTop = 0;
  if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
  const a = $('#modalActions'); a.innerHTML = '';
  (actions||[]).forEach(act=>{
    const btn = document.createElement('button'); btn.className = 'btn ' + (act.cls||''); btn.textContent = act.label;
    btn.onclick = act.onClick; a.appendChild(btn);
  });
  $('#modalBox').classList.toggle('wide', wide);
  MODAL_CLEANUP = cleanup;
  $('#modal').classList.remove('hidden');
}
function closeModal(){
  $('#modal').classList.add('hidden');
  if (MODAL_CLEANUP){ try{ MODAL_CLEANUP(); }catch{} MODAL_CLEANUP = null; }
}
function confirmBox(title, msg, okLabel='OK', danger=false){
  return new Promise(res=>{
    $('#cfTitle').textContent = title; $('#cfBody').textContent = msg;
    const yes = $('#cfYes'), no = $('#cfNo');
    yes.textContent = okLabel; yes.className = 'btn ' + (danger ? 'danger' : 'primary');
    const done = v => { $('#confirm').classList.add('hidden'); yes.onclick = no.onclick = null; res(v); };
    yes.onclick = () => done(true); no.onclick = () => done(false);
    $('#confirm').classList.remove('hidden'); no.focus();
  });
}
document.addEventListener('keydown', e=>{
  if (e.key !== 'Escape') return;
  if (!$('#lightbox').classList.contains('hidden')) return closeLightbox();
  if (!$('#confirm').classList.contains('hidden')) return $('#cfNo').click();
  if (MENU) return closeMenu();
  if (!$('#modal').classList.contains('hidden')) return closeModal();
});

/* ================= forms ================= */
function fieldHtml(f, val){
  const id = 'f_' + f.key; val = val ?? '';
  const req = f.required ? ' <span class="req">*</span>' : '';
  let input;
  if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.key}" rows="3">${esc(val)}</textarea>`;
  else if (f.type === 'select'){
    const opts = [...f.options]; if (val && !opts.includes(val)) opts.push(val);
    input = `<select id="${id}" name="${f.key}">${opts.map(o=>`<option value="${esc(o)}"${o===val?' selected':''}>${o?esc(o):'—'}</option>`).join('')}</select>`;
  }
  else if (f.type === 'date') input = `<input type="date" id="${id}" name="${f.key}" value="${esc(dmyToIso(val))}" max="${isoDay()}">`;
  else input = `<input type="text" id="${id}" name="${f.key}" value="${esc(val)}" placeholder="${esc(f.placeholder||'')}"${f.list?` list="${f.list}"`:''} autocomplete="off">`;
  return `<label class="field${f.wide?' wide':''}" for="${id}"><span>${esc(f.label)}${req}</span>${input}</label>`;
}
function readForm(root, fields){
  const o = {};
  fields.forEach(f=>{
    const el = root.querySelector(`[name="${f.key}"]`); let v = (el ? el.value : '').trim();
    if (f.type === 'date') v = isoToDmy(v);
    o[f.key] = v;
  });
  if ('cnic' in o) o.cnic = fmtCnic(o.cnic);
  return o;
}
function imagePicker(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="picker-head"><button type="button" class="btn">Choose images</button><span class="muted">No images chosen</span></div>
    <input type="file" accept="image/*,application/pdf" multiple hidden><div class="thumbs"></div>`;
  const files = [], urls = [];
  const input = $('input', wrap), info = $('.muted', wrap), thumbs = $('.thumbs', wrap);
  $('button', wrap).onclick = () => input.click();
  input.onchange = () => { for (const f of input.files) files.push(f); input.value = ''; draw(); };
  function draw(){
    urls.splice(0).forEach(u=>URL.revokeObjectURL(u));
    info.textContent = files.length ? `${files.length} file${files.length>1?'s':''} chosen. They will be copied into the patient's folder.` : 'No images chosen';
    thumbs.innerHTML = '';
    files.forEach((f,i)=>{
      const t = document.createElement('div'); t.className = 'thumb';
      let inner = '<div class="pdf">PDF</div>';
      if (f.type.startsWith('image/')){ const u = URL.createObjectURL(f); urls.push(u); inner = `<img src="${u}" alt="">`; }
      t.innerHTML = `<div class="box">${inner}</div><div class="nm">${esc(f.name)}</div><button type="button" class="x" title="Remove" aria-label="Remove">×</button>`;
      $('.x', t).onclick = () => { files.splice(i,1); draw(); };
      thumbs.appendChild(t);
    });
  }
  return {el:wrap, files, cleanup(){ urls.forEach(u=>URL.revokeObjectURL(u)); }};
}
function hookAgeFromDob(form, dobValue){
  const age = form.querySelector('[name=age]'); if (!age) return;
  let auto = true;
  age.addEventListener('input', ()=> auto = false);
  const fill = dmy => { if (auto || !age.value){ age.value = ageFromDob(dmy); auto = true; } };
  const dob = form.querySelector('[name=dob]');
  if (dob) dob.addEventListener('change', ()=> fill(isoToDmy(dob.value)));
  else if (dobValue && !age.value) age.value = ageFromDob(dobValue);
}
function duplicateOf(pv, exceptId){
  const c = digits(pv.cnic);
  if (c.length < 13) return null;
  return DATA.patients.find(p => p.id !== exceptId && digits(p.cnic) === c) || null;
}
