const _defaultBaseURL = (typeof location !== 'undefined' && location.href)
  ? location.href.substring(0, location.href.lastIndexOf('/') + 1)
  : '';

let _modulePromise = null;
let _baseURL = '';
let _debugMode = false;
let _metadataOnly = false;

function _ensureLoaded(baseURL) {
  _baseURL = baseURL || _baseURL || _defaultBaseURL;
}

function _isKssMultiTrackFile(path) {
  const p = String(path).toLowerCase().split('|track=')[0];
  return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
    p.endsWith('.bgm') || p.endsWith('.opx') ||
    p.endsWith('.mpk');
}

function _ensureUnrarLoaded() {
  if (_modulePromise) return _modulePromise;
  _baseURL = _baseURL || _defaultBaseURL;
  if (_debugMode) console.log('[UnrarWorker] Loading unrar.js (WASM)...');
  importScripts(_baseURL + 'unrar.js');
  const factory = self.createUnrarModule || self.Module;
  if (typeof factory !== 'function') {
    throw new Error('Unrar module factory not found');
  }
  _modulePromise = factory({
    locateFile: (path) => _baseURL + path,
    print: _debugMode ? console.log.bind(console) : () => {},
    printErr: _debugMode ? console.warn.bind(console) : () => {}
  });
  return _modulePromise;
}

async function _handleRar(id, buffer) {
  if (_debugMode) console.log('[UnrarWorker] RAR size:', buffer ? buffer.byteLength : 0);
  const Module = await _ensureUnrarLoaded();
  if (!Module || !Module.FS || !Module.ccall) {
    throw new Error('Unrar WASM module not available');
  }

  const workDir = `/work_${id}`;
  const outDir = `${workDir}/out`;
  const archivePath = `${workDir}/archive.rar`;
  const listPath = `${workDir}/list.txt`;

  try { Module.FS.mkdir(workDir); } catch (e) {}
  try { Module.FS.mkdir(outDir); } catch (e) {}
  Module.FS.writeFile(archivePath, new Uint8Array(buffer));

  const listRes = Module.ccall('rar_list', 'number', ['string', 'string'], [archivePath, listPath]);
  if (listRes < 0) {
    throw new Error('rar_list failed: ' + listRes);
  }

  const listBytes = Module.FS.readFile(listPath);
  const listText = new TextDecoder('utf-8').decode(listBytes);
  const paths = listText.split('\n').map(s => s.trim()).filter(Boolean);
  let hasKss = false;
  for (const p of paths) {
    if (!hasKss && _isKssMultiTrackFile(p.toLowerCase())) hasKss = true;
  }

  if (_debugMode) console.log(`[UnrarWorker] Found ${paths.length} entries for job ${id}`);
  self.postMessage({ type: 'meta', id, entries: paths, hasKss, metadataOnly: !!_metadataOnly });

  if (_metadataOnly) {
    try { Module.FS.unlink(listPath); } catch (e) {}
    try { Module.FS.unlink(archivePath); } catch (e) {}
    self.postMessage({ type: 'done', id });
    return;
  }

  const extractRes = Module.ccall('rar_extract_all', 'number', ['string', 'string'], [archivePath, outDir]);
  if (extractRes < 0) {
    throw new Error('rar_extract_all failed: ' + extractRes);
  }

  if (_debugMode) console.log(`[UnrarWorker] RAR extraction starting for job ${id}: ${paths.length} entries`);
  for (let i = 0; i < paths.length; i++) {
    if (_debugMode && i % 50 === 0) console.log(`[UnrarWorker] Job ${id}: extracted ${i}/${paths.length} files...`);
    const relPath = paths[i];
    const data = Module.FS.readFile(`${outDir}/${relPath}`);
    self.postMessage({ type: 'file', id, path: relPath, data }, [data.buffer]);
    try { Module.FS.unlink(`${outDir}/${relPath}`); } catch (e) {}
  }
  try { Module.FS.unlink(listPath); } catch (e) {}
  try { Module.FS.unlink(archivePath); } catch (e) {}
  if (_debugMode) console.log(`[UnrarWorker] Job ${id}: RAR extraction complete`);
  self.postMessage({ type: 'done', id });
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  const debugMode = msg.debugMode;
  _debugMode = !!debugMode;
  _metadataOnly = !!msg.metadataOnly;
  if (_debugMode) console.log('[UnrarWorker] Received message:', msg.type, 'kind:', msg.kind, 'id:', msg.id);
  if (msg.type !== 'extract') return;
  try {
    _ensureLoaded(msg.baseURL || '');
    await _handleRar(msg.id, msg.buffer);
  } catch (err) {
    if (_debugMode) console.error('[UnrarWorker] Error:', err);
    self.postMessage({ type: 'error', id: msg.id, message: err && err.message ? err.message : String(err) });
  }
};
