// ICR2 Modern web/mobile boot loader (Phase 8.5).
//
// The published site holds only the game code. The converted ICR2 data (tracks,
// cars, liveries, cockpit art) never goes online: the player loads their own
// data pack (icr2_data_pack.zip, made by tools/build_data_pack.py from their
// desktop build) once; it is kept in this browser's IndexedDB on the device.
// On every start this script reads the files the chosen circuit needs from the
// stored pack, runs them in the order index.html would, then the engine.
(function () {
  'use strict';
  const DB = 'icr2-modern', STORE = 'files', KEY = 'datapack', FORMAT = 1;
  const $ = id => document.getElementById(id);
  const status = (msg, err) => { const s = $('packStatus'); if (s) { s.textContent = msg; s.className = err ? 'err' : ''; } };

  // -- IndexedDB -----------------------------------------------------------------------
  function idb() {
    return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }
  async function dbGet(key) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(STORE, 'readonly').objectStore(STORE).get(key); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
  async function dbPut(key, val) { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }
  async function dbDel(key) { const d = await idb(); return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

  // -- ZIP reader (central directory; stored or deflated entries) -----------------------------
  async function bytes(blob, a, b) { return new Uint8Array(await blob.slice(a, b).arrayBuffer()); }
  async function openZip(blob) {
    const tailLen = Math.min(blob.size, 65557), tail = await bytes(blob, blob.size - tailLen, blob.size), dv = new DataView(tail.buffer);
    let eocd = -1; for (let i = tail.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a ZIP file');
    const count = dv.getUint16(eocd + 10, true), cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
    const cd = await bytes(blob, cdOff, cdOff + cdSize), cv = new DataView(cd.buffer), dec = new TextDecoder(), entries = new Map();
    for (let p = 0, k = 0; k < count; k++) {
      if (cv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged ZIP directory');
      const method = cv.getUint16(p + 10, true), csize = cv.getUint32(p + 20, true), usize = cv.getUint32(p + 24, true);
      const nlen = cv.getUint16(p + 28, true), xlen = cv.getUint16(p + 30, true), clen = cv.getUint16(p + 32, true), off = cv.getUint32(p + 42, true);
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nlen)).replace(/^\.?\//, '');
      entries.set(name, { method, csize, usize, off }); p += 46 + nlen + xlen + clen;
    }
    async function read(name) {
      const e = entries.get(name); if (!e) throw new Error('missing in data pack: ' + name);
      const h = await bytes(blob, e.off, e.off + 30), hv = new DataView(h.buffer);
      const start = e.off + 30 + hv.getUint16(26, true) + hv.getUint16(28, true), raw = await bytes(blob, start, start + e.csize);
      if (e.method === 0) return raw;
      if (e.method !== 8) throw new Error('unsupported compression in ' + name);
      if (typeof DecompressionStream === 'function') {
        try { const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); } catch (_) { /* fall back */ }
      }
      return window.fflate.inflateSync(raw, { out: new Uint8Array(e.usize) });
    }
    return { has: n => entries.has(n), read, text: async n => new TextDecoder().decode(await read(n)), names: () => [...entries.keys()] };
  }

  // -- running the game ------------------------------------------------------------------------
  function runScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not run ' + src)); document.body.appendChild(s); }); }
  async function runText(zip, name) { const url = URL.createObjectURL(new Blob([await zip.text(name)], { type: 'text/javascript' })); try { await runScript(url); } finally { URL.revokeObjectURL(url); } }
  async function image(zip, name, mime) { return zip.has(name) ? URL.createObjectURL(new Blob([await zip.read(name)], { type: mime || 'image/png' })) : ''; }

  async function start(rec) {
    const zip = await openZip(rec.blob), info = JSON.parse(await zip.text('icr2pack.json'));
    if (info.format !== FORMAT) throw new Error('this data pack is format ' + info.format + '; this site reads format ' + FORMAT + '. Rebuild it with tools/build_data_pack.py.');
    const ids = window.ICR2_TRACK_MANIFEST.map(t => t.id).filter(id => info.tracks.includes(id));
    if (!ids.length) throw new Error('the data pack contains no circuits');
    const q = new URLSearchParams(location.search), id = ids.includes(q.get('track')) ? q.get('track') : (ids.includes('detroit') ? 'detroit' : ids[0]);
    window.ICR2_SELECTED_TRACK = id;
    status('Loading ' + (window.ICR2_TRACK_MANIFEST.find(t => t.id === id) || { name: id }).name + '…');
    for (const f of ['track_data.js', 'environment_data.js', 'phase3_data.js', 'race_lines.js', 'terrain_data.js', 'culling_data.js'])
      if (zip.has('tracks/' + id + '/' + f)) await runText(zip, 'tracks/' + id + '/' + f);
    for (const f of ['tracks/stock_setups.js', 'car_data.js', 'field_data.js']) await runText(zip, f);
    window.ICR2_ASSET_URLS = {};
    for (const [sel, f] of [['#cockpitUpper', 'cockpit_upper.png'], ['#cockpitRim', 'cockpit_rim.png'], ['.introHero img', 'intro_car.png'], [null, 'car_atlas.png']]) {
      const u = await image(zip, f); if (!u) continue; window.ICR2_ASSET_URLS[f] = u;
      const el = sel && document.querySelector(sel); if (el) el.src = u;
    }
    // Circuits missing from the pack are taken out of the track menus.
    for (const sel of ['introTrack', 'setTrack']) { const s = $(sel); if (s) for (const o of [...s.options]) if (!ids.includes(o.value)) o.remove(); }
    await runScript('perf_trims.js');
    await runScript('app3d.js');
    $('packScreen').style.display = 'none';
    packInfo(rec, info);
  }

  // -- the "load your game data" screen ------------------------------------------------------------
  function packInfo(rec, info) {
    const box = document.createElement('div'); box.className = 'packInfo';
    const mb = (rec.blob.size / 1048576).toFixed(1), when = new Date(rec.date || Date.now()).toLocaleDateString();
    box.innerHTML = 'Game data: ' + info.tracks.length + ' circuits · ' + mb + ' MB · stored ' + when + ' · <button type="button" id="packReplace">Replace</button> <button type="button" id="packRemove">Remove</button>';
    const opts = $('introOptions'); if (opts) opts.appendChild(box);
    $('packReplace').onclick = () => { showPackScreen(); status(''); $('packCancel').style.display = 'inline-block'; };
    $('packRemove').onclick = async () => { if (confirm('Remove the game data from this device?')) { await dbDel(KEY); location.reload(); } };
  }
  async function importFile(file) {
    status('Checking ' + file.name + '…');
    const zip = await openZip(file);
    if (!zip.has('icr2pack.json')) throw new Error('this is not an ICR2 Modern data pack (no icr2pack.json inside)');
    const info = JSON.parse(await zip.text('icr2pack.json'));
    if (info.format !== FORMAT) throw new Error('data pack format ' + info.format + ' (this site reads ' + FORMAT + ')');
    for (const f of ['tracks/stock_setups.js', 'car_data.js', 'field_data.js']) if (!zip.has(f)) throw new Error('the data pack is incomplete: ' + f);
    status('Storing on this device…');
    const blob = file.slice(0, file.size, 'application/zip');
    try { await dbPut(KEY, { blob, name: file.name, date: Date.now(), info }); }
    catch (_) { await dbPut(KEY, { blob: new Blob([await file.arrayBuffer()], { type: 'application/zip' }), name: file.name, date: Date.now(), info }); }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
    status('Done. Starting…'); location.reload();
  }
  function showPackScreen(msg) {
    $('packScreen').style.display = 'flex'; $('packScreen').classList.remove('loading');
    status(msg || '', !!msg);
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (_) {} }
    const input = $('packFile');
    input.addEventListener('change', async () => { const f = input.files && input.files[0]; if (!f) return; try { await importFile(f); } catch (e) { status(e.message || String(e), true); } });
    $('packCancel').onclick = () => { $('packScreen').style.display = 'none'; };
    let rec = null;
    try { rec = await dbGet(KEY); } catch (e) { showPackScreen('This browser cannot store the game data (' + (e.message || e) + '). In iOS Safari, private browsing blocks it.'); return; }
    if (!rec || !rec.blob) { showPackScreen(); return; }
    try { await start(rec); }
    catch (e) { console.error(e); showPackScreen('Could not start from the stored game data: ' + (e.message || e) + '. Load the data pack again.'); }
  });
})();
