'use strict';

const _defaultBaseURL = (typeof location !== 'undefined' && location.href)
  ? location.href.substring(0, location.href.lastIndexOf('/') + 1)
  : '';

let _loadedLibarchive = false;
let _baseURL = '';
let LibArchiveModule = null;
let _debugMode = false;

function _ensureLoaded(baseURL) {
  _baseURL = baseURL || _baseURL || _defaultBaseURL;
}

async function _ensureLibArchiveLoaded() {
  if (_loadedLibarchive && LibArchiveModule) return;
  _baseURL = _baseURL || _defaultBaseURL;
  
  if (typeof importScripts !== 'undefined') {
    if (_debugMode) console.log('[Worker] Loading libarchive...');
    importScripts(_baseURL + 'libarchive.js');
  }
  
  LibArchiveModule = await libarchive({
    locateFile: (path) => _baseURL + path
  });
  
  _loadedLibarchive = true;
  if (_debugMode) console.log('[Worker] libarchive ready');
}

function _isKssFile(path) {
  const p = String(path).toLowerCase().split('|track=')[0];
  return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
    p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
    p.endsWith('.mpk') || p.endsWith('.mbm');
}

function _isKssMultiTrackFile(path) {
  const p = String(path).toLowerCase().split('|track=')[0];
  return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
    p.endsWith('.bgm') || p.endsWith('.opx') ||
    p.endsWith('.mpk');
}

const AE_OK = 0;
const AE_EOF = 1;

async function _handleArchive(id, buffer, debugMode, metadataOnly) {
  await _ensureLibArchiveLoaded();
  
  const uint8Buffer = new Uint8Array(buffer);
  const entries = [];
  const fileDataMap = new Map();
  let hasKss = false;
  
  const Module = LibArchiveModule;
  const cwrap = Module.cwrap;
  
  const archiveReadNew = cwrap('archive_read_new', 'number', []);
  const archiveReadSupportFilterAll = cwrap('archive_read_support_filter_all', 'number', ['number']);
  const archiveReadSupportFormatAll = cwrap('archive_read_support_format_all', 'number', ['number']);
  const hasRarSupportFn = typeof Module._archive_read_support_format_rar === 'function';
  const hasRar5SupportFn = typeof Module._archive_read_support_format_rar5 === 'function';
  const archiveReadSupportFormatRar = hasRarSupportFn
    ? cwrap('archive_read_support_format_rar', 'number', ['number'])
    : null;
  const archiveReadSupportFormatRar5 = hasRar5SupportFn
    ? cwrap('archive_read_support_format_rar5', 'number', ['number'])
    : null;
  const archiveReadOpenMemory = cwrap('archive_read_open_memory', 'number', ['number', 'number', 'number']);
  const archiveReadNextEntry = cwrap('archive_read_next_entry', 'number', ['number']);
  const archiveReadData = cwrap('archive_read_data', 'number', ['number', 'number', 'number']);
  const archiveReadFree = cwrap('archive_read_free', 'number', ['number']);
  const archiveErrorString = cwrap('archive_error_string', 'string', ['number']);
  const archiveVersionString = cwrap('archive_version_string', 'string', []);
  const archiveEntryPathnameUtf8 = cwrap('archive_entry_pathname_utf8', 'string', ['number']);
  const archiveEntryFiletype = cwrap('archive_entry_filetype', 'number', ['number']);
  const archiveEntrySize = cwrap('archive_entry_size', 'number', ['number']);
  const malloc = cwrap('malloc', 'number', ['number']);
  const free = cwrap('free', null, ['number']);

  if (debugMode) console.log(`[Worker] Libarchive extraction starting for job ${id} (libarchive ${archiveVersionString()})`);
  
  const archive = archiveReadNew();
  if (!archive) {
    throw new Error('Failed to create archive reader');
  }
  
  try {
    const filterRes = archiveReadSupportFilterAll(archive);
    const formatRes = archiveReadSupportFormatAll(archive);
    if (debugMode) {
      console.log('[Worker] archive_read_support_filter_all:', filterRes);
      console.log('[Worker] archive_read_support_format_all:', formatRes);
    }
    if (archiveReadSupportFormatRar) {
      const rarRes = archiveReadSupportFormatRar(archive);
      if (debugMode) console.log('[Worker] archive_read_support_format_rar:', rarRes);
    } else if (debugMode) {
      console.warn('[Worker] archive_read_support_format_rar not available in this build');
    }
    if (archiveReadSupportFormatRar5) {
      const rar5Res = archiveReadSupportFormatRar5(archive);
      if (debugMode) console.log('[Worker] archive_read_support_format_rar5:', rar5Res);
    } else if (debugMode) {
      console.warn('[Worker] archive_read_support_format_rar5 not available in this build');
    }
    
    const bufferPtr = malloc(uint8Buffer.length);
    Module.HEAPU8.set(uint8Buffer, bufferPtr);
    
    const openResult = archiveReadOpenMemory(archive, bufferPtr, uint8Buffer.length);
    if (openResult !== AE_OK) {
      if (debugMode) {
        const errStr = archiveErrorString(archive);
        console.error('[Worker] archive_read_open_memory failed:', openResult, errStr || '');
      }
      free(bufferPtr);
      throw new Error('Failed to open archive in memory');
    }
    
    try {
      while (true) {
        const entry = archiveReadNextEntry(archive);
        if (!entry || entry === AE_EOF) {
          break;
        }
        // Some builds return status codes; treat negative/low values as errors.
        if (entry <= 1 && entry >= -30) {
          if (entry !== AE_OK) {
            if (debugMode) {
              const errStr = archiveErrorString(archive);
              console.error('[Worker] Error reading archive entry:', entry, errStr || '');
            }
          }
          if (entry === AE_EOF) break;
          continue;
        }
        
        const filetype = archiveEntryFiletype(entry);
        if (filetype !== 32768) {
          continue;
        }
        
        const pathname = archiveEntryPathnameUtf8(entry);
        if (!pathname) {
          continue;
        }
        
        entries.push(pathname);
        
        if (!hasKss && _isKssMultiTrackFile(pathname.toLowerCase())) {
          hasKss = true;
        }
        
        if (!metadataOnly) {
          const size = archiveEntrySize(entry);
          const data = new Uint8Array(size);
          const dataPtr = malloc(size);
          
          try {
            const readResult = archiveReadData(archive, dataPtr, size);
            if (readResult > 0) {
              data.set(Module.HEAPU8.subarray(dataPtr, dataPtr + readResult));
            }
            fileDataMap.set(pathname, data);
          } finally {
            free(dataPtr);
          }
        }
        
        if (debugMode && entries.length % 50 === 0) {
          console.log(`[Worker] Job ${id}: extracted ${entries.length} files...`);
        }
      }
    } finally {
      free(bufferPtr);
    }
  } catch (err) {
    if (debugMode) console.error('[Worker] Libarchive extraction error:', err);
    throw err;
  } finally {
    archiveReadFree(archive);
  }
  
  if (debugMode) {
    console.log(`[Worker] Libarchive extracted ${entries.length} entries for job ${id}`);
    if (entries.length === 0) {
      const errStr = archiveErrorString(archive);
      console.warn('[Worker] Libarchive returned zero entries', errStr || '');
    }
  }
  self.postMessage({ type: 'meta', id, entries, hasKss, metadataOnly: !!metadataOnly });
  
  if (!metadataOnly) {
    for (let i = 0; i < entries.length; i++) {
      const path = entries[i];
      const data = fileDataMap.get(path);
      self.postMessage({ type: 'file', id, path, data }, [data.buffer]);
    }
  }
  
  if (debugMode) console.log(`[Worker] Job ${id}: Libarchive extraction complete`);
  self.postMessage({ type: 'done', id });
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  const debugMode = msg.debugMode;
  _debugMode = !!debugMode;
  if (debugMode) console.log('[Worker] Received message:', msg.type, 'kind:', msg.kind, 'id:', msg.id);
  if (msg.type !== 'extract') return;
  try {
    _ensureLoaded(msg.baseURL || '');
    if (debugMode) console.log('[Worker] Handling', msg.kind, 'archive with libarchive');
    await _handleArchive(msg.id, msg.buffer, debugMode, !!msg.metadataOnly);
  } catch (err) {
    if (debugMode) console.error('[Worker] Error:', err);
    self.postMessage({ type: 'error', id: msg.id, message: err && err.message ? err.message : String(err) });
  }
};
