export function installStorage(VGMPlay_js) {
window.installStorage = installStorage;

const STORAGE_VERSION = 3;

class VGMStorageBackend {
    async init() {
        throw new Error('Not implemented');
    }
    async isAvailable() {
        throw new Error('Not implemented');
    }
    async getMeta() {
        throw new Error('Not implemented');
    }
    async putMeta(meta) {
        throw new Error('Not implemented');
    }
    async getFiles(paths) {
        throw new Error('Not implemented');
    }
    async putFiles(files) {
        throw new Error('Not implemented');
    }
    async deleteFiles(paths) {
        throw new Error('Not implemented');
    }
    async listFiles(prefix) {
        throw new Error('Not implemented');
    }
    async clearAll() {
        throw new Error('Not implemented');
    }
    getBackendName() {
        throw new Error('Not implemented');
    }
}

class FileSystemStorage extends VGMStorageBackend {
    constructor(vgmInstance) {
        super();
        this.vgm = vgmInstance;
        this.directoryHandle = null;
        this.coversDirHandle = null;
        this.filesDirHandle = null;
        this.romsDirHandle = null;
        this._initialized = false;
        this._handleKey = 'vgmplay-cache-directory-handle';
    }

    getBackendName() {
        return 'FileSystem';
    }

    async init() {
        if (!('showDirectoryPicker' in window)) {
            if (this.vgm.debugMode) console.log('[VGM Storage] File System Access API not available');
            return false;
        }

        try {
            let handle = await this._loadDirectoryHandle();
            if (!handle) {
                if (this.vgm.debugMode) console.log('[VGM Storage] No saved directory handle, user needs to select directory');
                return false;
            }

            const permission = await handle.requestPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                if (this.vgm.debugMode) console.log('[VGM Storage] Directory permission not granted');
                return false;
            }

            this.directoryHandle = handle;
            await this._ensureDirectories();
            this._initialized = true;
            if (this.vgm.debugMode) console.log('[VGM Storage] FileSystemStorage initialized with directory:', handle.name);
            return true;
        } catch (e) {
            if (this.vgm.debugMode) console.error('[VGM Storage] FileSystemStorage init failed:', e);
            return false;
        }
    }

async requestDirectory() {
    console.log('[VGM Storage] requestDirectory called');
    if (!('showDirectoryPicker' in window)) {
        console.log('[VGM Storage] showDirectoryPicker not in window');
        throw new Error('File System Access API not supported');
    }

    console.log('[VGM Storage] Calling showDirectoryPicker...');
    try {
        const handle = await window.showDirectoryPicker({
            id: 'vgmplay-cache',
            mode: 'readwrite',
            startIn: 'music'
        });
        console.log('[VGM Storage] showDirectoryPicker returned:', handle?.name);

        console.log('[VGM Storage] Requesting permission...');
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        console.log('[VGM Storage] Permission result:', permission);
        
        if (permission !== 'granted') {
            throw new Error('Permission denied');
        }

        this.directoryHandle = handle;
        await this._ensureDirectories();
        await this._saveDirectoryHandle(handle);
        this._initialized = true;
        if (this.vgm.debugMode) console.log('[VGM Storage] Directory selected and initialized:', handle.name);
        return handle;
    } catch (e) {
        console.error('[VGM Storage] Failed to request directory:', e);
        throw e;
    }
}

    async _saveDirectoryHandle(handle) {
        try {
            const root = await navigator.storage.getDirectory();
            const pipe = await root.getFileHandle('vgmplay-handle-pipe', { create: true });
            const writable = await pipe.createWritable();
            await writable.write(handle);
            await writable.close();
        } catch (e) {
            if (this.vgm.debugMode) console.warn('[VGM Storage] Could not save directory handle to OPFS:', e);
        }

        try {
            const indexedDB = window.indexedDB;
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('vgmplay-handles', 1);
                req.onupgradeneeded = () => {
                    req.result.createObjectStore('handles');
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            await new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, this._handleKey);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (e) {
            if (this.vgm.debugMode) console.warn('[VGM Storage] Could not save directory handle to IndexedDB:', e);
        }
    }

    async _loadDirectoryHandle() {
        try {
            const indexedDB = window.indexedDB;
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open('vgmplay-handles', 1);
                req.onupgradeneeded = () => {
                    req.result.createObjectStore('handles');
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            
            const handle = await new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readonly');
                const req = tx.objectStore('handles').get(this._handleKey);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.close();
            return handle || null;
        } catch (e) {
            if (this.vgm.debugMode) console.warn('[VGM Storage] Could not load directory handle:', e);
            return null;
        }
    }

    async _ensureDirectories() {
        if (!this.directoryHandle) return;
        
        this.coversDirHandle = await this.directoryHandle.getDirectoryHandle('covers', { create: true });
        this.filesDirHandle = await this.directoryHandle.getDirectoryHandle('files', { create: true });
        this.romsDirHandle = await this.directoryHandle.getDirectoryHandle('roms', { create: true });
    }

    async isAvailable() {
        return this._initialized && this.directoryHandle !== null;
    }

    async getMeta() {
        if (!this.directoryHandle) return null;
        try {
            const handle = await this.directoryHandle.getFileHandle('metadata.json');
            const file = await handle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (e) {
            if (this.vgm.debugMode) console.log('[VGM Storage] No metadata found:', e.message);
            return null;
        }
    }

    async putMeta(meta) {
        if (!this.directoryHandle) throw new Error('No directory handle');
        
        const metaWithVersion = { ...meta, version: STORAGE_VERSION };
        const handle = await this.directoryHandle.getFileHandle('metadata.json', { create: true });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(metaWithVersion, null, 2));
        await writable.close();
    }

    async getFiles(paths) {
        const files = [];
        const missing = [];

        for (const path of paths) {
            try {
                const handle = await this._resolvePath(path);
                const file = await handle.getFile();
                const buffer = await file.arrayBuffer();
                files.push({
                    path,
                    b64: this._arrayBufferToBase64(buffer)
                });
            } catch (e) {
                missing.push(path);
            }
        }

        return { files, missing };
    }

async putFiles(files) {
    console.log('[VGM Storage] putFiles called with', files.length, 'files, backend:', this.getBackendName?.());
    for (const item of files) {
      if (!item || !item.path) continue;

      try {
        const handle = await this._resolvePath(item.path, { create: true });
        const writable = await handle.createWritable();

        if (item.b64) {
          await writable.write(this._base64ToArrayBuffer(item.b64));
        } else if (item.data) {
          await writable.write(item.data);
        }
        await writable.close();
      } catch (e) {
        if (this.vgm.debugMode) console.warn('[VGM Storage] Failed to write file:', item.path, e);
      }
    }
  }

    async deleteFiles(paths) {
        for (const path of paths) {
            try {
                const parts = path.split('/').filter(Boolean);
                const fileName = parts.pop();
                let dir = this.directoryHandle;
                
                for (const part of parts) {
                    dir = await dir.getDirectoryHandle(part);
                }
                
                await dir.removeEntry(fileName);
            } catch (e) {
                if (this.vgm.debugMode) console.warn('[VGM Storage] Failed to delete:', path, e);
            }
        }
    }

    async listFiles(prefix) {
        const files = [];
        const prefixNorm = prefix.startsWith('/') ? prefix : '/' + prefix;
        
        const walk = async (dir, basePath) => {
            for await (const entry of dir.values()) {
                const fullPath = basePath + '/' + entry.name;
                if (entry.kind === 'directory') {
                    await walk(entry, fullPath);
                } else {
                    if (!prefix || fullPath.startsWith(prefixNorm)) {
                        files.push(fullPath);
                    }
                }
            }
        };

        if (this.directoryHandle) {
            await walk(this.directoryHandle, '');
        }

        return files;
    }

async clearAll() {
    if (!this.directoryHandle) return;

    const rmDirRecursive = async (dir) => {
      for await (const entry of dir.values()) {
        if (entry.kind === 'directory') {
          await rmDirRecursive(entry);
          await dir.removeEntry(entry.name);
        } else {
          await dir.removeEntry(entry.name);
        }
      }
    };

    try {
      console.log('[VGM Storage] Clearing cache...');
      
      if (this.coversDirHandle) await rmDirRecursive(this.coversDirHandle);
      if (this.filesDirHandle) await rmDirRecursive(this.filesDirHandle);
      if (this.romsDirHandle) await rmDirRecursive(this.romsDirHandle);

      try {
        await this.directoryHandle.removeEntry('metadata.json');
      } catch (e) { }

      await this._ensureDirectories();

      console.log('[VGM Storage] Cache cleared successfully');
    } catch (e) {
      console.error('[VGM Storage] Failed to clear cache:', e);
    }
  }

    async _resolvePath(path, { create = false } = {}) {
        if (!this.directoryHandle) throw new Error('No directory handle');

        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0) throw new Error('Empty path');

        let current = this.directoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
            current = await current.getDirectoryHandle(parts[i], { create });
        }

        return current.getFileHandle(parts[parts.length - 1], { create });
    }

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }

    _base64ToArrayBuffer(b64) {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

class IndexedDBStorage extends VGMStorageBackend {
    constructor(vgmInstance) {
        super();
        this.vgm = vgmInstance;
        this.db = null;
        this.dbName = 'vgmplay-cache-v1';
        this.dbVersion = 1;
        this.metaStore = 'meta';
        this.filesStore = 'files';
        this._initialized = false;
    }

    getBackendName() {
        return 'IndexedDB';
    }

    async init() {
        try {
            this.db = await new Promise((resolve, reject) => {
                const req = indexedDB.open(this.dbName, this.dbVersion);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(this.metaStore)) {
                        db.createObjectStore(this.metaStore);
                    }
                    if (!db.objectStoreNames.contains(this.filesStore)) {
                        db.createObjectStore(this.filesStore);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            this._initialized = true;
            if (this.vgm.debugMode) console.log('[VGM Storage] IndexedDBStorage initialized');
            return true;
        } catch (e) {
            if (this.vgm.debugMode) console.error('[VGM Storage] IndexedDBStorage init failed:', e);
            return false;
        }
    }

    async isAvailable() {
        return this._initialized && this.db !== null;
    }

    async getMeta() {
        if (!this.db) return null;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.metaStore, 'readonly');
            const store = tx.objectStore(this.metaStore);
            const req = store.get('metadata');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async putMeta(meta) {
        if (!this.db) throw new Error('Database not initialized');
        
        const metaWithVersion = { ...meta, version: STORAGE_VERSION };
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.metaStore, 'readwrite');
            const store = tx.objectStore(this.metaStore);
            store.put(metaWithVersion, 'metadata');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getFiles(paths) {
        if (!this.db) return { files: [], missing: paths };

        const files = [];
        const missing = [];

        const results = await Promise.all(paths.map(path => {
            return new Promise((resolve) => {
                const tx = this.db.transaction(this.filesStore, 'readonly');
                const store = tx.objectStore(this.filesStore);
                const req = store.get(path);
                req.onsuccess = () => resolve({ path, val: req.result });
                req.onerror = () => resolve({ path, val: null });
            });
        }));

        for (const { path, val } of results) {
            if (val) {
                let b64 = null;
                if (val.b64) {
                    b64 = val.b64;
                } else if (val instanceof ArrayBuffer) {
                    b64 = this._arrayBufferToBase64(val);
                } else if (val.data instanceof ArrayBuffer) {
                    b64 = this._arrayBufferToBase64(val.data);
                } else if (val.data && val.len) {
                    const bytes = new Uint8Array(val.len);
                    for (let i = 0; i < val.len; i++) {
                        bytes[i] = val.data[i] || 0;
                    }
                    b64 = this._arrayBufferToBase64(bytes.buffer);
                }
                if (b64) {
                    files.push({ path, b64 });
                } else {
                    missing.push(path);
                }
            } else {
                missing.push(path);
            }
        }

        return { files, missing };
    }

    async putFiles(files) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.filesStore, 'readwrite');
            const store = tx.objectStore(this.filesStore);

            for (const item of files) {
                if (!item || !item.path) continue;
                if (item.b64) {
                    store.put({ b64: item.b64, len: item.b64.length }, item.path);
                } else if (item.data) {
                    const data = item.data instanceof ArrayBuffer ? item.data : (item.data.buffer || item.data);
                    const len = data ? data.byteLength : 0;
                    store.put({ data, len }, item.path);
                }
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async deleteFiles(paths) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.filesStore, 'readwrite');
            const store = tx.objectStore(this.filesStore);
            for (const path of paths) {
                store.delete(path);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async listFiles(prefix) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.filesStore, 'readonly');
            const store = tx.objectStore(this.filesStore);
            const req = store.getAllKeys();
            req.onsuccess = () => {
                const keys = req.result;
                if (prefix) {
                    const prefixNorm = prefix.startsWith('/') ? prefix : '/' + prefix;
                    resolve(keys.filter(k => k.startsWith(prefixNorm) || k.startsWith(prefix)));
                } else {
                    resolve(keys);
                }
            };
            req.onerror = () => reject(req.error);
        });
    }

    async clearAll() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.metaStore, this.filesStore], 'readwrite');
            tx.objectStore(this.metaStore).clear();
            tx.objectStore(this.filesStore).clear();
            tx.oncomplete = () => {
                if (this.vgm.debugMode) console.log('[VGM Storage] IndexedDB cache cleared');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }
}

class NodeStorage extends VGMStorageBackend {
    constructor(vgmInstance) {
        super();
        this.vgm = vgmInstance;
        this._callbacks = new Map();
        this._callbackId = 0;
        this._initialized = false;
        this._cacheDir = null;

        if (typeof window !== 'undefined') {
            window._vgmStorageCallback = (id, result, error) => {
                const handler = this._callbacks.get(id);
                this._callbacks.delete(id);
                if (handler) {
                    if (error) {
                        handler.reject(new Error(error));
                    } else {
                        handler.resolve(result);
                    }
                }
            };
        }
    }

    getBackendName() {
        return 'Node';
    }

    async init() {
        if (typeof window === 'undefined' || !window.webkit?.messageHandlers?.vgmStorage) {
            if (this.vgm.debugMode) console.log('[VGM Storage] NodeStorage not available (not in Mac app)');
            return false;
        }

        try {
            const cacheDir = await this._send('getCacheDir');
            this._cacheDir = cacheDir;
            this._initialized = true;
            if (this.vgm.debugMode) console.log('[VGM Storage] NodeStorage initialized, cache dir:', cacheDir);
            return true;
        } catch (e) {
            if (this.vgm.debugMode) console.error('[VGM Storage] NodeStorage init failed:', e);
            return false;
        }
    }

    async isAvailable() {
        return this._initialized;
    }

    async getMeta() {
        const json = await this._send('readFile', { path: 'metadata.json' });
        if (!json) return null;
        try {
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    async putMeta(meta) {
        const metaWithVersion = { ...meta, version: STORAGE_VERSION };
        await this._send('writeFile', { 
            path: 'metadata.json', 
            content: JSON.stringify(metaWithVersion, null, 2)
        });
    }

    async getFiles(paths) {
        const files = [];
        const missing = [];

        for (const path of paths) {
            try {
                const b64 = await this._send('readFile', { path, encoding: 'base64' });
                if (b64) {
                    files.push({ path, b64 });
                } else {
                    missing.push(path);
                }
            } catch (e) {
                missing.push(path);
            }
        }

        return { files, missing };
    }

    async putFiles(files) {
        for (const item of files) {
            if (!item || !item.path) continue;
            if (item.b64) {
                await this._send('writeFile', { 
                    path: item.path, 
                    content: item.b64,
                    encoding: 'base64'
                });
            }
        }
    }

    async deleteFiles(paths) {
        for (const path of paths) {
            try {
                await this._send('deleteFile', { path });
            } catch (e) {
                if (this.vgm.debugMode) console.warn('[VGM Storage] Failed to delete:', path, e);
            }
        }
    }

    async listFiles(prefix) {
        return await this._send('listFiles', { prefix: prefix || '' }) || [];
    }

    async clearAll() {
        await this._send('clearAll');
        if (this.vgm.debugMode) console.log('[VGM Storage] NodeStorage cache cleared');
    }

    async _send(action, payload = {}) {
        return new Promise((resolve, reject) => {
            const id = String(this._callbackId++);
            this._callbacks.set(id, { resolve, reject });

            const timeout = setTimeout(() => {
                this._callbacks.delete(id);
                reject(new Error('Timeout'));
            }, 30000);

            this._callbacks.set(id, { 
                resolve: (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            try {
                window.webkit.messageHandlers.vgmStorage.postMessage({
                    action,
                    callbackId: id,
                    ...payload
                });
            } catch (e) {
                clearTimeout(timeout);
                this._callbacks.delete(id);
                reject(e);
            }
        });
    }
}

class IDBFSStorage extends VGMStorageBackend {
    constructor(vgmInstance) {
        super();
        this.vgm = vgmInstance;
        this._initialized = false;
    }

    getBackendName() {
        return 'IDBFS';
    }

    async init() {
        if (typeof FS === 'undefined' || !FS.filesystems?.IDBFS) {
            if (this.vgm.debugMode) console.log('[VGM Storage] IDBFS not available');
            return false;
        }

        try {
            if (!FS.analyzePath('/cache').exists) {
                FS.mkdir('/cache');
            }
            FS.mount(FS.filesystems.IDBFS, {}, '/cache');
            
            await new Promise((resolve, reject) => {
                FS.syncfs(true, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            this._initialized = true;
            if (this.vgm.debugMode) console.log('[VGM Storage] IDBFSStorage initialized');
            return true;
        } catch (e) {
            if (this.vgm.debugMode) console.error('[VGM Storage] IDBFSStorage init failed:', e);
            return false;
        }
    }

    async isAvailable() {
        return this._initialized;
    }

    async getMeta() {
        const metaPath = '/cache/meta/metadata.json';
        if (!FS.analyzePath(metaPath).exists) return null;

        try {
            const text = FS.readFile(metaPath, { encoding: 'utf8' });
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    async putMeta(meta) {
        if (!FS.analyzePath('/cache/meta').exists) {
            FS.mkdir('/cache/meta');
        }

        const metaWithVersion = { ...meta, version: STORAGE_VERSION };
        FS.writeFile('/cache/meta/metadata.json', JSON.stringify(metaWithVersion));

        await this._sync();
    }

async getFiles(paths) {
    const files = [];
    const missing = [];

    for (const path of paths) {
        // Ensure path starts with /cache/ for IDBFS
        let fsPath = path;
        if (!fsPath.startsWith('/')) {
            fsPath = '/' + fsPath;
        }
        if (!fsPath.startsWith('/cache/')) {
            fsPath = '/cache/' + fsPath;
        }

        try {
            if (FS.analyzePath(fsPath).exists) {
                const data = FS.readFile(fsPath);
                files.push({
                    path,
                    b64: this._arrayBufferToBase64(data.buffer)
                });
            } else {
                missing.push(path);
            }
        } catch (e) {
            missing.push(path);
        }
    }

    return { files, missing };
}

async putFiles(files) {
    console.log('[VGM Storage IDBFS] putFiles called with', files.length, 'files');
    for (const item of files) {
      if (!item || !item.path) continue;

      // Ensure path starts with /cache/ for IDBFS sync
      let fsPath = item.path;
      if (!fsPath.startsWith('/')) {
        fsPath = '/' + fsPath;
      }
      if (!fsPath.startsWith('/cache/')) {
        fsPath = '/cache/' + fsPath;
      }

      this._ensureDirForFile(fsPath);

      if (item.b64) {
        const bytes = this._base64ToUint8Array(item.b64);
        FS.writeFile(fsPath, bytes);
      } else if (item.data) {
        FS.writeFile(fsPath, item.data);
      }
    }

await this._sync();
  }

  async deleteFiles(paths) {
        for (const path of paths) {
            try {
                FS.unlink(path);
            } catch (e) {
                if (this.vgm.debugMode) console.warn('[VGM Storage] Failed to delete:', path, e);
            }
        }
    }

    async listFiles(prefix) {
        const files = [];
        const prefixNorm = prefix.startsWith('/') ? prefix : '/' + prefix;

        const walk = (dir) => {
            if (!FS.analyzePath(dir).exists) return;
            const entries = FS.readdir(dir);
            for (const entry of entries) {
                if (entry === '.' || entry === '..') continue;
                const full = dir + '/' + entry;
                const stat = FS.stat(full);
                if (FS.isDir(stat.mode)) {
                    walk(full);
                } else {
                    if (!prefix || full.startsWith(prefixNorm)) {
                        files.push(full);
                    }
                }
            }
        };

        walk('/cache');
        return files;
    }

async clearAll() {
    const rmDirRecursive = (path) => {
      if (!FS.analyzePath(path).exists) return;
      const stat = FS.stat(path);
      if (FS.isDir(stat.mode)) {
        const entries = FS.readdir(path);
        for (const entry of entries) {
          if (entry === '.' || entry === '..') continue;
          rmDirRecursive(path + '/' + entry);
        }
        FS.rmdir(path);
      } else {
        FS.unlink(path);
      }
    };

    // Clear all cache directories
    rmDirRecursive('/cache/meta');
    rmDirRecursive('/cache/files');
    rmDirRecursive('/cache/covers');
    rmDirRecursive('/cache/roms');

    // Recreate structure
    FS.mkdir('/cache/meta');
    FS.mkdir('/cache/files');
    FS.mkdir('/cache/covers');
    FS.mkdir('/cache/roms');

    await this._sync();

    console.log('[VGM Storage] IDBFS cache cleared');
  }

    async _sync() {
        return new Promise((resolve, reject) => {
            FS.syncfs(false, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    _ensureDirForFile(path) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length <= 1) return;
        let cur = '';
        for (let i = 0; i < parts.length - 1; i++) {
            cur += '/' + parts[i];
            if (!FS.analyzePath(cur).exists) {
                try { FS.mkdir(cur); } catch (e) { }
            }
        }
    }

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }

    _base64ToUint8Array(b64) {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
}

VGMPlay_js.prototype._selectStorageBackend = async function() {
    const mode = this.preferredCacheMode || 'auto';
    if (this.debugMode) console.log('[VGM Storage] _selectStorageBackend called, mode:', mode);

    // If "Files" or "Database" is explicitly selected, try that first
    if (mode === 'database') {
        const idb = new IndexedDBStorage(this);
        if (await idb.init()) {
            if (this.debugMode) console.log('[VGM Storage] Using preferred: IndexedDBStorage');
            return idb;
        }
    } else if (mode === 'files') {
        const idbfs = new IDBFSStorage(this);
        if (await idbfs.init()) {
            if (this.debugMode) console.log('[VGM Storage] Using preferred: IDBFSStorage');
            return idbfs;
        }
    }

    // Default "Auto" logic (or fallback if preferred fails)
    // Mac desktop app - use NodeStorage
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.vgmStorage) {
        const storage = new NodeStorage(this);
        if (await storage.init()) {
            if (this.debugMode) console.log('[VGM Storage] Using NodeStorage (Mac app)');
            return storage;
        }
    }

    // Extension logic - always use bridge to background script
    if (this.isExtension && !this.standalone) {
        if (this.debugMode) console.log('[VGM Storage] Extension mode: using background bridge');
        const storage = new IndexedDBStorage(this);
        if (await storage.init()) {
            return storage;
        }
    }

    // Standalone mode - use IDBFS (Emscripten's IndexedDB filesystem)
    const storage = new IDBFSStorage(this);
    if (await storage.init()) {
        if (this.debugMode) console.log('[VGM Storage] Using IDBFSStorage (standalone)');
        return storage;
    }

    if (this.debugMode) console.error('[VGM Storage] No storage backend available');
    return null;
};

VGMPlay_js.prototype._requestStorageDirectory = async function() {
    console.log('[VGM Storage] _requestStorageDirectory called');
    console.log('[VGM Storage] this._storage:', this._storage?.getBackendName?.());
    console.log('[VGM Storage] showDirectoryPicker available:', 'showDirectoryPicker' in window);

    if (!this._storage) {
        console.log('[VGM Storage] No storage backend, returning null');
        return null;
    }

    if (!(this._storage instanceof FileSystemStorage)) {
        console.log('[VGM Storage] Current storage is not FileSystemStorage');
        if ('showDirectoryPicker' in window) {
            console.log('[VGM Storage] Creating new FileSystemStorage');
            
            // Clear old IndexedDB cache when switching to filesystem
            if (this._cacheBridgeAvailable && this._cacheBridgeAvailable()) {
                console.log('[VGM Storage] Clearing old IndexedDB cache...');
                await this._cacheBridgeRequest('clearAll');
            }
            
            this._storage = new FileSystemStorage(this);
        } else {
            console.log('[VGM Storage] showDirectoryPicker not available');
            return null;
        }
    }

    console.log('[VGM Storage] Calling requestDirectory...');
    try {
        const handle = await this._storage.requestDirectory();
        console.log('[VGM Storage] Got handle:', handle?.name);
        return handle.name;
    } catch (e) {
        console.error('[VGM Storage] Failed to request directory:', e);
        return null;
    }
};

VGMPlay_js.prototype.getStorageInfo = function() {
    if (!this._storage) {
        return { backend: 'none', available: false };
    }
    return {
        backend: this._storage.getBackendName(),
        available: this._storage._initialized,
        canRequestDirectory: this._storage instanceof FileSystemStorage
    };
};

window.VGMStorageBackend = VGMStorageBackend;
window.FileSystemStorage = FileSystemStorage;
window.IndexedDBStorage = IndexedDBStorage;
window.NodeStorage = NodeStorage;
window.IDBFSStorage = IDBFSStorage;

}
