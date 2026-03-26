chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'ISOLATED',
        func: togglePlayer,
        args: [chrome.runtime.getURL('')]
    }).then((results) => {
        const injected = results && results[0] && results[0].result && results[0].result.injected;
        if (!injected) {
            // ensure debug bridge exists even when toggling
            return chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: installDebugBridge
            });
        }
        return chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            files: [
                'vgmplay-js.js',
                'minizip-asm.min.js',
                '7zz.umd.js',
                'vgmplay-js-glue.js'
            ]
        }).then(() => {
            return chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: installDebugBridge
            });
        });
    }).catch(() => { });
});

const CACHE_DB_NAME = 'vgmplay-cache-v1';
const CACHE_DB_VERSION = 1;
const CACHE_META_STORE = 'meta';
const CACHE_FILES_STORE = 'files';
let cacheDbPromise = null;

function openCacheDb() {
    if (cacheDbPromise) return cacheDbPromise;
    cacheDbPromise = new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(CACHE_META_STORE)) {
                    db.createObjectStore(CACHE_META_STORE);
                }
                if (!db.objectStoreNames.contains(CACHE_FILES_STORE)) {
                    db.createObjectStore(CACHE_FILES_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
    return cacheDbPromise;
}

function txComplete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function cacheGetMeta() {
    const db = await openCacheDb();
    const tx = db.transaction(CACHE_META_STORE, 'readonly');
    const store = tx.objectStore(CACHE_META_STORE);
    const meta = await reqToPromise(store.get('metadata'));
    await txComplete(tx);
    return meta || null;
}

async function cachePutMeta(meta) {
    const db = await openCacheDb();
    const tx = db.transaction(CACHE_META_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_META_STORE);
    store.put(meta, 'metadata');
    await txComplete(tx);
}

async function cacheGetFiles(paths) {
	const db = await openCacheDb();
	const tx = db.transaction(CACHE_FILES_STORE, 'readonly');
	const store = tx.objectStore(CACHE_FILES_STORE);
	const files = [];
	const missing = [];
	const reqs = paths.map((path) => {
		const req = store.get(path);
		return reqToPromise(req).then((val) => ({ path, val }));
	});
	const results = await Promise.all(reqs);
	await txComplete(tx);
	const isDebug = (typeof window !== 'undefined' && window.__VGM_DEBUG__) || (typeof self !== 'undefined' && self.__VGM_DEBUG__);
	for (const { path, val } of results) {
		if (val) {
			if (isDebug) {
				console.log('[VGM Cache] getFiles path:', path, 'val type:', typeof val, 'isBlob:', val instanceof Blob, 'isArrayBuffer:', val instanceof ArrayBuffer, 'val.b64:', !!val?.b64, 'val.data:', !!val?.data, 'val.data type:', typeof val?.data, 'val.data instanceof ArrayBuffer:', val?.data instanceof ArrayBuffer, 'val.len:', val?.len);
			}
    if (val && val.b64) {
    files.push({ path, b64: val.b64 });
            } else if (val instanceof Blob) {
                const buf = await val.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let binary = '';
                const chunkSize = 0x8000;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const sub = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, sub);
                }
                files.push({ path, b64: btoa(binary) });
            } else if (val instanceof ArrayBuffer) {
                const bytes = new Uint8Array(val);
                let binary = '';
                const chunkSize = 0x8000;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const sub = bytes.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, sub);
                }
                files.push({ path, b64: btoa(binary) });
            } else if (val && val.data instanceof ArrayBuffer) {
            const bytes = new Uint8Array(val.data);
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
            }
            files.push({ path, b64: btoa(binary) });
            } else if (val && val.data && val.len) {
            // Handle case where val.data is a plain object (IndexedDB structured clone issue)
            // Reconstruct the ArrayBuffer from the stored length
            const data = val.data;
            let bytes = null;
            if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
            } else if (data && typeof data === 'object') {
            // data might be a plain object with indexed properties (from structured clone)
            const len = val.len;
            bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
            bytes[i] = data[i] || 0;
            }
            }
            if (bytes) {
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
            }
            files.push({ path, b64: btoa(binary) });
            } else {
            files.push({ path, data: val });
            }
            } else {
            files.push({ path, data: val.buffer ? val.buffer : val });
            }
        } else {
            missing.push(path);
        }
    }
    return { files, missing };
}

async function cachePutFiles(files) {
	const db = await openCacheDb();
	const tx = db.transaction(CACHE_FILES_STORE, 'readwrite');
	const store = tx.objectStore(CACHE_FILES_STORE);
	const isDebug = (typeof window !== 'undefined' && window.__VGM_DEBUG__) || (typeof self !== 'undefined' && self.__VGM_DEBUG__);
	for (const item of files) {
		if (!item || !item.path) continue;
		if (item.b64) {
			const len = item.b64.length;
			if (isDebug) console.log('[VGM Cache] putFiles b64 path:', item.path, 'len:', len);
			store.put({ b64: item.b64, len }, item.path);
			continue;
		}
		if (!item.data) continue;
		const data = item.data instanceof ArrayBuffer ? item.data : (item.data.buffer || item.data);
		const len = data ? data.byteLength : 0;
		if (isDebug) console.log('[VGM Cache] putFiles data path:', item.path, 'len:', len, 'data type:', typeof data, 'isArrayBuffer:', data instanceof ArrayBuffer);
		store.put({ data, len }, item.path);
	}
	await txComplete(tx);
}

async function cacheClearAll() {
    const db = await openCacheDb();
    const tx = db.transaction([CACHE_META_STORE, CACHE_FILES_STORE], 'readwrite');
    tx.objectStore(CACHE_META_STORE).clear();
    tx.objectStore(CACHE_FILES_STORE).clear();
    await txComplete(tx);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'vgm-cache') return;
    (async () => {
        try {
            if (message.action === 'getMeta') {
                const meta = await cacheGetMeta();
                sendResponse({ meta });
                return;
            }
            if (message.action === 'putMeta') {
                await cachePutMeta(message.payload ? message.payload.meta : null);
                sendResponse({ ok: true });
                return;
            }
            if (message.action === 'getFiles') {
                const paths = (message.payload && message.payload.paths) ? message.payload.paths : [];
                const res = await cacheGetFiles(paths);
                sendResponse(res);
                return;
            }
            if (message.action === 'hasFiles') {
                const paths = (message.payload && message.payload.paths) ? message.payload.paths : [];
                const res = await cacheGetFiles(paths);
                sendResponse({ missing: res.missing || [] });
                return;
            }
            if (message.action === 'putFiles') {
                const files = (message.payload && message.payload.files) ? message.payload.files : [];
                await cachePutFiles(files);
                sendResponse({ ok: true });
                return;
            }
            if (message.action === 'clearAll') {
                await cacheClearAll();
                sendResponse({ ok: true });
                return;
            }
            sendResponse({ error: 'unknown action' });
        } catch (e) {
            sendResponse({ error: String(e) });
        }
    })();
    return true;
});

function installDebugBridge() {
  // Guard for service worker context where window doesn't exist
  if (typeof window === 'undefined') return;
  if (window.__VGM_DEBUG_SNAPSHOT__) return;
  window.__VGM_DEBUG_SNAPSHOT__ = () => new Promise((resolve) => {
        const id = Date.now() + Math.random();
        const handler = (e) => {
            if (e.source !== window) return;
            const data = e.data || {};
            if (data.type !== 'VGM_DEBUG_SNAPSHOT_RESPONSE' || data.id !== id) return;
            window.removeEventListener('message', handler);
            resolve(data.payload);
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'VGM_DEBUG_SNAPSHOT_REQUEST', id }, '*');
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ error: 'timeout' });
        }, 2000);
    });
    window.__VGM_CACHE_BRIDGE__ = (action, payload) => new Promise((resolve) => {
        const id = Date.now() + Math.random();
        const handler = (e) => {
            if (e.source !== window) return;
            const data = e.data || {};
            if (data.type !== 'VGM_CACHE_BRIDGE_RESPONSE' || data.id !== id) return;
            window.removeEventListener('message', handler);
            resolve(data.payload);
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'VGM_CACHE_BRIDGE_REQUEST', id, action, payload }, '*');
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ error: 'timeout' });
        }, 3000);
    });
}

function togglePlayer(extensionUrl) {
	// Guard for service worker context where window doesn't exist
	if (typeof window === 'undefined') return { injected: false };
	// Auto-enable debug mode
	window.__VGM_DEBUG__ = true;
	if (window.__VGM_DEBUG__) {
		console.log('[VGM Extension] togglePlayer called, extensionUrl:', extensionUrl);
	}
    if (window.vgmPlayerInjected) {
        const container = document.getElementById('vgmplay-extension-root');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
        return { injected: false };
    }

    window.vgmPlayerInjected = true;

    // Create a root element for our Shadow DOM
    const root = document.createElement('div');
    root.id = 'vgmplay-extension-root';
    // Use all:initial and minimal footprint to avoid shifting page layout
    root.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 10px !important;
        left: 10px !important;
        z-index: 2147483647 !important;
        width: 350px !important;
        height: calc(100vh - 20px) !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: visible !important;
        display: block !important;
        pointer-events: auto !important;
    `;
    document.documentElement.appendChild(root);

    const shadow = root.attachShadow({ mode: 'open' });

	// Initialize Module in the isolated world before loading core scripts
	window.__VGM_RUNTIME_READY__ = false;
	window.Module = window.Module || {};
	if (typeof window.__VGM_DEBUG__ === 'undefined') {
		window.__VGM_DEBUG__ = true;
	}
    if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
    if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
    const base = extensionUrl;
    window.Module.print = (text) => { console.log(text); };
    window.Module.printErr = (text) => {
        const msg = String(text || '');
        if (!window.__VGM_DEBUG__ && (msg.includes('Failed to find two consecutive MPEG audio frames') || msg.includes('[mp3 @'))) {
            return;
        }
        console.error(msg);
    };
    window.Module.locateFile = function (path, prefix) {
        if (path.endsWith(".data") || path.endsWith(".wasm")) return base + path;
        return prefix + path;
    };
    window.Module.onRuntimeInitialized = function () {
        window.__VGM_RUNTIME_READY__ = true;
        if (window.vgmplay_js && window.vgmplay_js.loadWhenReady) {
            window.vgmplay_js.loadWhenReady();
        }
    };

    // Add styles - load CSS content and inject directly for better Shadow DOM compatibility
    const style = document.createElement('style');
    shadow.appendChild(style);
    
    // Fetch and inject CSS
    fetch(extensionUrl + 'css/style.css')
      .then(response => response.text())
      .then(css => {
    style.textContent = css;
    if (window.__VGM_DEBUG__) console.log('[VGM] CSS loaded and injected, length:', css.length);
  })
  .catch(err => {
    if (window.__VGM_DEBUG__) console.error('[VGM] Failed to load CSS:', err);
  });

    // Container for the player
    const container = document.createElement('div');
    container.id = 'vgmplay-container';
    // Set container styles to ensure visibility and interactivity
    container.style.cssText = `
        all: initial !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        min-height: 200px !important;
        pointer-events: auto !important;
        overflow: visible !important;
        z-index: 1 !important;
    `;
    shadow.appendChild(container);

    // Set options for the auto-init BEFORE loading the glue script
    window.VGMPLAY_EXTENSION_OPTIONS = {
        container: container,
        shadowRoot: shadow,
        baseURL: extensionUrl,
        extensionContentScript: true,
        sharedCache: true
    };
    if (window.__VGM_DEBUG__) {
        console.log('[VGM] VGMPLAY_EXTENSION_OPTIONS set for content script mode');
    }
    return { injected: true };
}
