// ICR2 Modern web/mobile boot loader (Phase 8.5).
//
// The published site holds only the game code. The converted ICR2 data (tracks,
// cars, liveries, cockpit art) never goes online: the player loads their own
// data pack (icr2_data_pack.zip, made by tools/build_data_pack.py from their
// desktop build) once; it is kept in this browser's IndexedDB on the device.
// On every start this script reads the files the chosen circuit needs from the
// stored pack, runs them in the order index.html would, then the engine.
//
// 8.5.1: a site built with --locked-pack also carries the pack encrypted
// (window.ICR2_LOCKED_PACK, data.icr2). Then the first screen asks for the
// passphrase, downloads the file, unlocks it with WebCrypto and stores the result
// as if it had been loaded from a file. A link ending in #key=<passphrase> does
// that without typing; the key is removed from the address straight away.
//
// 8.5.5: updates. build_site.py stamps the site's build id into index.html
// (window.ICR2_SITE) and version.json. The game's scripts are loaded as
// app3d.js?v=<build>, so a new index.html can never run old cached code, and
// whenever the game comes back to the screen (and every 10 minutes) it asks
// version.json, past every cache, whether a newer build is online; if so a
// button offers it ("New version … tap to update"). An installed app on
// Android is often only brought back from memory, never reloaded, so without
// this a player could keep an old build for days.
(function () {
  'use strict';
  const DB = 'icr2-modern', STORE = 'files', KEY = 'datapack', FORMAT = 1;
  const LOCKED = window.ICR2_LOCKED_PACK || null;
  const SITE = (window.ICR2_SITE && window.ICR2_SITE.build) || '', V = SITE ? '?v=' + SITE : '';
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
    await runScript('perf_trims.js' + V);
    await runScript('app3d.js' + V);
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
    const info = await checkPack(file);
    await store(file.slice(0, file.size, 'application/zip'), file.name, info, null);
  }
  async function checkPack(blob) {
    const zip = await openZip(blob);
    if (!zip.has('icr2pack.json')) throw new Error('this is not an ICR2 Modern data pack (no icr2pack.json inside)');
    const info = JSON.parse(await zip.text('icr2pack.json'));
    if (info.format !== FORMAT) throw new Error('data pack format ' + info.format + ' (this site reads ' + FORMAT + ')');
    for (const f of ['tracks/stock_setups.js', 'car_data.js', 'field_data.js']) if (!zip.has(f)) throw new Error('the data pack is incomplete: ' + f);
    return info;
  }
  async function store(blob, name, info, hostedId) {
    status('Storing on this device…');
    const rec = { blob, name, date: Date.now(), info, hostedId };
    try { await dbPut(KEY, rec); }
    catch (_) { rec.blob = new Blob([await blob.arrayBuffer()], { type: 'application/zip' }); await dbPut(KEY, rec); }
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
    status('Done. Starting…'); location.reload();
  }

  // -- the locked pack on the site (8.5.1) -------------------------------------------------------
  let lockedBytes = null;   // kept after one download, so a mistyped passphrase does not download again
  async function download() {
    if (lockedBytes) return lockedBytes;
    const res = await fetch(LOCKED.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error('could not download the game data (' + res.status + ')');
    const total = LOCKED.bytes || +res.headers.get('content-length') || 0, parts = []; let got = 0;
    const mb = n => (n / 1048576).toFixed(1);
    if (res.body && res.body.getReader) {
      const rd = res.body.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; status('Downloading the game data… ' + mb(got) + (total ? ' / ' + mb(total) : '') + ' MB'); }
    } else parts.push(new Uint8Array(await res.arrayBuffer()));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return (lockedBytes = out);
  }
  async function unlockHosted(pass) {
    if (!(window.crypto && crypto.subtle)) throw new Error('this page must be opened over https:// to unlock the game data');
    const buf = await download(), dec = new TextDecoder();
    if (dec.decode(buf.subarray(0, 8)) !== 'ICR2LOCK' || buf[8] !== 1) throw new Error('the game data file on this site is damaged or from another version');
    const dv = new DataView(buf.buffer, buf.byteOffset), iterations = dv.getUint32(9), salt = buf.slice(13, 29), iv = buf.slice(29, 41), header = buf.slice(0, 41);
    status('Unlocking…');
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, key, buf.subarray(41)); }
    catch (_) { const e = new Error('That passphrase did not work. Check it and try again.'); e.wrongPass = true; throw e; }
    const blob = new Blob([plain], { type: 'application/zip' }), info = await checkPack(blob);
    await store(blob, 'data.icr2', info, LOCKED.id);
  }
  function showLocked(on) {
    const l = $('packLocked'), f = $('packFileBody'); if (!l || !f) return;
    l.style.display = on ? 'block' : 'none'; f.style.display = on ? 'none' : 'block';
    if (on) setTimeout(() => { try { $('packPass').focus(); } catch (_) {} }, 50);
  }
  async function tryUnlock(pass) {
    const go = $('packGo'); if (go) go.disabled = true;
    try { await unlockHosted(pass); }
    catch (e) { status(e.message || String(e), true); if (go) go.disabled = false; if (e.wrongPass) { const p = $('packPass'); if (p) { p.value = ''; p.focus(); } } }
  }
  function showPackScreen(msg) {
    $('packScreen').style.display = 'flex'; $('packScreen').classList.remove('loading');
    status(msg || '', !!msg); showLocked(!!LOCKED);
  }

  // -- updates (8.5.5) ----------------------------------------------------------------------------
  let updateShown = false, lastCheck = 0;
  async function checkUpdate() {
    if (!SITE || updateShown || document.visibilityState === 'hidden') return;
    const now = Date.now(); if (now - lastCheck < 15000) return; lastCheck = now;
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) reg.update().catch(() => {}); } catch (_) {}
    try {
      const res = await fetch('version.json?t=' + now, { cache: 'no-store' }); if (!res.ok) return;
      const v = await res.json(); if (v && v.build && v.build !== SITE) showUpdate(v.label);
    } catch (_) { /* offline: nothing to do */ }
  }
  function showUpdate(label) {
    if (updateShown) return; updateShown = true;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'siteUpdate';
    b.textContent = 'New version' + (label ? ' ' + label : '') + ' is ready · tap to update';
    b.style.cssText = 'position:fixed;left:50%;top:calc(max(8px,env(safe-area-inset-top)) + 50px);transform:translateX(-50%);z-index:200;max-width:calc(100vw - 24px);'
      + 'padding:11px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.45);background:#1f7a43;color:#fff;font:800 14px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.55)';
    b.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation(); b.textContent = 'Updating…'; b.disabled = true;
      try { await fetch('./', { cache: 'reload' }); await fetch('index.html', { cache: 'reload' }); } catch (_) {}
      location.reload();
    });
    document.body.appendChild(b);
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && secure) { try { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); } catch (_) {} }
    if (SITE) {
      setTimeout(checkUpdate, 2500);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
      window.addEventListener('pageshow', e => { if (e.persisted) checkUpdate(); });
      window.addEventListener('focus', checkUpdate);
      setInterval(checkUpdate, 600000);
    }
    // a passphrase in the link (#key=...) is taken out of the address at once
    let linkKey = null;
    const m = /(?:^#|&)key=([^&]*)/.exec(location.hash || '');
    if (m) { try { linkKey = decodeURIComponent(m[1]); } catch (_) { linkKey = m[1]; } try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} }
    const input = $('packFile');
    input.addEventListener('change', async () => { const f = input.files && input.files[0]; if (!f) return; try { await importFile(f); } catch (e) { status(e.message || String(e), true); } });
    $('packCancel').onclick = () => { $('packScreen').style.display = 'none'; };
    if ($('packUnlock')) $('packUnlock').addEventListener('submit', e => { e.preventDefault(); const v = $('packPass').value; if (v) tryUnlock(v); });
    if ($('packShowFile')) $('packShowFile').onclick = e => { e.preventDefault(); showLocked(false); };
    let rec = null;
    try { rec = await dbGet(KEY); } catch (e) { showPackScreen('This browser cannot store the game data (' + (e.message || e) + '). In iOS Safari, private browsing blocks it.'); return; }
    const updated = LOCKED && rec && rec.blob && rec.hostedId && rec.hostedId !== LOCKED.id;
    if (!rec || !rec.blob || updated) {
      showPackScreen(updated ? 'The game data has been updated. Enter the passphrase to download the new version.' : '');
      if (updated) { const c = $('packCancel'); c.textContent = 'Play with the old data'; c.style.display = 'inline-block'; c.onclick = async () => { $('packScreen').classList.add('loading'); await start(rec); }; }
      if (LOCKED && linkKey) tryUnlock(linkKey);
      return;
    }
    try { await start(rec); }
    catch (e) { console.error(e); showPackScreen('Could not start from the stored game data: ' + (e.message || e) + '. Load the data pack again.'); }
  });
})();
