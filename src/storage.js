/*
 * Patient Records: storage.js
 * Reading and writing the data folder: files, folders, images and the Excel file.
 *
 * Copyright (C) 2026 Daniyal
 * SPDX-License-Identifier: LicenseRef-Patient-Records-Free-Use-1.0
 *
 * Free to use, copy and change. Selling it or charging for it is not allowed.
 * Changed versions must stay free and include their source code.
 * Provided without warranty. Full terms: see the LICENSE file.
 */
'use strict';

/* ================= file system helpers ================= */
async function dirAlive(h){ try{ for await (const k of h.keys()) break; return true; }catch{ return false; } }
async function ensureResetFile(){
  try{
    if (await tryFile(ROOT, RESET_FILE)) return;
    const txt = ['Patient Records: password reset file','',
      'This file lets you reset the app password if you forget it.','',
      'How to reset:','1. Delete this file.','2. In the app, click "Forgot password?", then "I deleted the file".','3. Set a new password.','',
      'The app makes this file again after you set a new password.','Deleting it does not delete any patient data.',''].join('\r\n');
    await writeFile(ROOT, RESET_FILE, new Blob([txt], {type:'text/plain'}));
  }catch(e){ console.warn('Reset file not written', e); }
}

async function tryFile(dir, name){ try{ return await dir.getFileHandle(name); }catch(e){ if (e.name==='NotFoundError' || e.name==='TypeMismatchError') return null; throw e; } }
async function tryDir(dir, name){ try{ return await dir.getDirectoryHandle(name); }catch(e){ if (e.name==='NotFoundError' || e.name==='TypeMismatchError') return null; throw e; } }
async function writeFile(dir, name, data){
  const fh = await dir.getFileHandle(name, {create:true});
  const w = await fh.createWritable();
  try{ await w.write(data); await w.close(); }
  catch(e){ try{ await w.abort(); }catch{} throw e; }
}
async function copyInto(src, dst, ren){
  for await (const [name, h] of src.entries()){
    if (h.kind === 'file') await writeFile(dst, ren(name), await h.getFile());
    else await copyInto(h, await dst.getDirectoryHandle(name,{create:true}), n=>n);
  }
}
/* Browsers can't rename folders, so we copy then remove the old one. */
async function moveDir(srcParent, srcName, dstParent, dstName, ren = n=>n){
  if (srcName.toLowerCase() === dstName.toLowerCase() && await srcParent.isSameEntry(dstParent)){
    const tmp = '_moving_' + Date.now();
    await moveDir(srcParent, srcName, dstParent, tmp, ren);
    await moveDir(dstParent, tmp, dstParent, dstName);
    return;
  }
  const src = await srcParent.getDirectoryHandle(srcName);
  const dst = await dstParent.getDirectoryHandle(dstName, {create:true});
  await copyInto(src, dst, ren);
  await srcParent.removeEntry(srcName, {recursive:true});
}
async function patientDir(p, create=false){
  const d = await tryDir(ROOT, folderOf(p));
  if (d) return d;
  const alt = await tryDir(ROOT, safeName(p.name)+'_'+p.id);
  if (alt){ p.folder = alt.name; return alt; }
  if (create){ p.folder = safeName(p.name)+'_'+p.id; return ROOT.getDirectoryHandle(p.folder,{create:true}); }
  return null;
}
/* Copies chosen files into the patient's folder with names like 0001_Ali Khan_V2_29-09-2026.jpg */
async function saveFiles(dir, p, v, files, alreadyHas){
  if (!files.length) return [];
  const taken = new Set();
  for await (const k of dir.keys()) taken.add(k.toLowerCase());
  const base = `${p.id}_${safeName(p.name)}_V${v.visit}_${v.date}`;
  const out = [];
  let k = alreadyHas > 0 ? alreadyHas + 1 : 1;
  for (const f of files){
    const ext = extOf(f);
    let name;
    if (files.length === 1 && alreadyHas === 0 && !taken.has((base+ext).toLowerCase())) name = base + ext;
    else { while (taken.has(`${base}_${k}${ext}`.toLowerCase())) k++; name = `${base}_${k}${ext}`; k++; }
    taken.add(name.toLowerCase());
    await writeFile(dir, name, f);
    out.push(name);
  }
  return out;
}

/* ================= Excel ================= */
function readSheet(wb, name, cols){
  const ws = wb.Sheets[name]; if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});
  return rows.map(r=>{
    const o = {};
    cols.forEach(([k,label])=>{ o[k] = r[label]==null ? '' : String(r[label]).trim(); });
    o.id = normId(o.id);
    if ('visit' in o) o.visit = String(parseInt(o.visit,10) || o.visit);
    return o;
  }).filter(o=>o.id);
}
async function loadData(){
  const fh = await tryFile(ROOT, FILE_NAME);
  if (!fh) return emptyData();
  const buf = await (await fh.getFile()).arrayBuffer();
  if (!buf.byteLength) return emptyData();
  const wb = XLSX.read(buf, {type:'array'});
  return {
    patients: readSheet(wb,'Patients',PATIENT_COLS),
    visits: readSheet(wb,'Visits',VISIT_COLS),
    delPatients: readSheet(wb,'Deleted Patients',[...PATIENT_COLS,DELETED_COL]),
    delVisits: readSheet(wb,'Deleted Visits',[...VISIT_COLS,DELETED_COL])
  };
}
function addSheet(wb, name, cols, rows){
  const aoa = [cols.map(c=>c[1])].concat(rows.map(r=>cols.map(c=>r[c[0]] ?? '')));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map(c=>({wch:c[2]}));
  ws['!autofilter'] = {ref: XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:Math.max(rows.length,1), c:cols.length-1}})};
  XLSX.utils.book_append_sheet(wb, ws, name);
}
async function backupOnce(){
  const day = isoDay(); if (backedUpDay === day) return;
  try{
    const fh = await tryFile(ROOT, FILE_NAME);
    if (fh){
      const bdir = await ROOT.getDirectoryHandle(BACKUP_DIR,{create:true});
      const name = `PatientData_${day}.xlsx`;
      if (!(await tryFile(bdir, name))) await writeFile(bdir, name, await fh.getFile());
    }
    backedUpDay = day;
  }catch(e){ console.warn('Backup skipped', e); }
}
async function saveData(d){
  const byId = (a,b)=> (parseInt(a.id,10)||0)-(parseInt(b.id,10)||0) || (parseInt(a.visit,10)||0)-(parseInt(b.visit,10)||0);
  const wb = XLSX.utils.book_new();
  addSheet(wb,'Patients',PATIENT_COLS,[...d.patients].sort(byId));
  addSheet(wb,'Visits',VISIT_COLS,[...d.visits].sort(byId));
  addSheet(wb,'Deleted Patients',[...PATIENT_COLS,DELETED_COL],d.delPatients);
  addSheet(wb,'Deleted Visits',[...VISIT_COLS,DELETED_COL],d.delVisits);
  const out = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  await backupOnce();
  try{ await writeFile(ROOT, FILE_NAME, new Blob([out])); }
  catch(e){
    const err = new Error(`Couldn't save ${FILE_NAME}. If it is open in Excel, close it and try again.`);
    err.cause = e; throw err;
  }
}
/* Every change: re-read the Excel file, apply the change, write it back. */
async function mutate(fn){
  busy(true);
  try{
    const d = await loadData();
    await fn(d);
    await saveData(d);
    DATA = d;
    render();
  }catch(e){
    console.error(e);
    toast(friendly(e), true);
    throw e;
  }finally{ busy(false); }
}
function friendly(e){
  if (e && e.name === 'NotAllowedError') return 'The browser blocked folder access. Open Settings and choose the folder again.';
  if (e && e.name === 'NotFoundError') return 'A file or folder was not found. It may have been moved outside the app.';
  return (e && e.message) || 'Something went wrong.';
}
