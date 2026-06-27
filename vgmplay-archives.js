export function installArchives(VGMPlay_js) {
VGMPlay_js.prototype._getArchiveWorker = function () {
if (this.archiveWorker) return this.archiveWorker;
if (typeof Worker === 'undefined') {
  return null;
}
try {
  const cacheSuffix = this._cacheBust ? ('v=' + Date.now()) : '';
  const withCache = (url) => {
    if (!cacheSuffix) return url;
    return url + (url.includes('?') ? '&' : '?') + cacheSuffix;
  };
  let workerUrl = null;
  if (this.baseURL) {
    const candidate = new URL('archive-worker.js', this.baseURL);
    workerUrl = new URL(withCache(candidate.toString()));
  }
  if (!workerUrl && typeof window !== 'undefined') {
    workerUrl = new URL(withCache(new URL('archive-worker.js', window.location.href).toString()));
  }
  const fallback = this.baseURL ? this.baseURL + 'archive-worker.js' : 'archive-worker.js';
  const finalUrl = workerUrl ? workerUrl.toString() : withCache(fallback);
  if (this.debugMode) console.log("[VGM] Creating archive worker with URL:", finalUrl);
  const worker = new Worker(finalUrl);
  worker.onmessage = (e) => this._onArchiveWorkerMessage(e);
  worker.onerror = (e) => {
    if (this.debugMode) console.error("[VGM] Archive worker error:", e);
  };
  this.archiveWorker = worker;
  if (this.debugMode) console.log("[VGM] Archive worker created successfully");
  return worker;
} catch (e) {
  if (this.debugMode) console.error("[VGM] Failed to start archive worker:", e);
  return null;
}
};

VGMPlay_js.prototype._getRarWorker = function () {
if (typeof Worker === 'undefined') {
  return null;
}
try {
  const cacheSuffix = this._cacheBust ? ('v=' + Date.now()) : '';
  const withCache = (url) => {
    if (!cacheSuffix) return url;
    return url + (url.includes('?') ? '&' : '?') + cacheSuffix;
  };
  let workerUrl = null;
  if (this.baseURL) {
    const candidate = new URL('unrar-worker.js', this.baseURL);
    workerUrl = new URL(withCache(candidate.toString()));
  }
  if (!workerUrl && typeof window !== 'undefined') {
    workerUrl = new URL(withCache(new URL('unrar-worker.js', window.location.href).toString()));
  }
  const fallback = this.baseURL ? this.baseURL + 'unrar-worker.js' : 'unrar-worker.js';
  const finalUrl = workerUrl ? workerUrl.toString() : withCache(fallback);
  if (this.debugMode) console.log("[VGM] Creating unrar worker with URL:", finalUrl);
  const worker = new Worker(finalUrl);
  worker.onmessage = (e) => this._onArchiveWorkerMessage(e);
  worker.onerror = (e) => {
    if (this.debugMode) console.error("[VGM] Unrar worker error:", e);
  };
  if (this.debugMode) console.log("[VGM] Unrar worker created successfully");
  return worker;
} catch (e) {
  if (this.debugMode) console.error("[VGM] Failed to start unrar worker:", e);
  return null;
}
};

	VGMPlay_js.prototype._onArchiveWorkerMessage = function (e) {
		const msg = e.data || {};
		const job = this._archiveWorkerJobs.get(msg.id);
		if (!job) return;
		if (msg.type === 'meta') {
			job.hasKss = !!msg.hasKss;
			job.metadataOnly = !!msg.metadataOnly;
			job.entries = (msg.entries || []).map((p) => ({ filepath: p }));
			return;
		}
		if (msg.type === 'file') {
			const buf = msg.data;
			const arr = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
			job.fileDataByPath.set(msg.path, arr);
	if (this.debugMode && job.fileDataByPath.size % 20 === 0) {
		this._log && this._log('Worker', `ArchiveJob ${msg.id}: Received ${job.fileDataByPath.size} files...`);
	}
			return;
		}
		if (msg.type === 'error') {
			this._archiveWorkerJobs.delete(msg.id);
			if (this._rarWorkersByJob && this._rarWorkersByJob.has(msg.id)) {
				const w = this._rarWorkersByJob.get(msg.id);
				this._rarWorkersByJob.delete(msg.id);
				try { w.terminate(); } catch (e) { }
			}
			job.reject(new Error(msg.message || "Archive worker error"));
			return;
		}
		if (msg.type === 'done') {
			this._archiveWorkerJobs.delete(msg.id);
			if (this._rarWorkersByJob && this._rarWorkersByJob.has(msg.id)) {
				const w = this._rarWorkersByJob.get(msg.id);
				this._rarWorkersByJob.delete(msg.id);
				try { w.terminate(); } catch (e) { }
			}
			job.resolve({
				entries: job.entries || [],
				fileDataByPath: job.fileDataByPath,
				hasKss: job.hasKss,
				metadataOnly: !!job.metadataOnly
});
}
};

VGMPlay_js.prototype._extractArchiveViaBackground = function (byteArray, kind, url) {
return new Promise((resolve, reject) => {
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
reject(new Error("Extension runtime unavailable"));
return;
}
const id = this._backgroundExtractSeq++;
	const timeout = setTimeout(() => {
		this._backgroundExtractJobs.delete(id);
		this._logWarn && this._logWarn('Background', 'Extraction timeout for', kind, '- falling back to main thread');
		reject(new Error("Background extraction timeout"));
	}, 120000);
this._backgroundExtractJobs.set(id, { resolve, reject, timeout });
chrome.runtime.sendMessage({ type: 'vgm-cache', action: 'extractArchive', kind, url, id }, (resp) => {
if (chrome.runtime.lastError) {
clearTimeout(timeout);
this._backgroundExtractJobs.delete(id);
reject(new Error(chrome.runtime.lastError.message));
return;
}
if (resp && resp.error) {
clearTimeout(timeout);
this._backgroundExtractJobs.delete(id);
reject(new Error(resp.error));
}
});
});
};

VGMPlay_js.prototype._onBackgroundExtractResult = function (msg) {
const job = this._backgroundExtractJobs.get(msg.id);
if (!job) return;
if (msg.error) {
clearTimeout(job.timeout);
this._backgroundExtractJobs.delete(msg.id);
job.reject(new Error(msg.error));
return;
}
for (const f of msg.files || []) {
if (f.b64) {
const binary = atob(f.b64);
const arr = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
job.fileDataByPath.set(f.path, arr);
}
}
if (msg.entries && msg.entries.length > 0) {
job.entries = msg.entries.map(p => ({ filepath: p }));
}
if (msg.hasKss) {
job.hasKss = msg.hasKss;
}
if (msg.done !== false) {
clearTimeout(job.timeout);
this._backgroundExtractJobs.delete(msg.id);
job.resolve({ entries: job.entries || [], fileDataByPath: job.fileDataByPath, hasKss: job.hasKss || false });
}
};

VGMPlay_js.prototype._extractArchiveWithWorker = function (byteArray, kind, url) {
  return new Promise((resolve, reject) => {
    if (this.isExtension && !this.standalone && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && url) {
      this._extractArchiveViaBackground(byteArray, kind, url).then(resolve).catch(reject);
      return;
    }
    const worker = this._getArchiveWorker();
    if (!worker) {
      reject(new Error("Archive worker unavailable"));
      return;
    }
    const id = this._archiveWorkerSeq++;
    this._archiveWorkerJobs.set(id, {
      resolve, reject,
      entries: null,
      hasKss: false,
      fileDataByPath: new Map()
    });
    try {
      worker.postMessage(
        { type: 'extract', id, kind, buffer: byteArray.buffer, baseURL: this.baseURL, debugMode: this.debugMode },
        [byteArray.buffer]
      );
    } catch (e) {
      this._archiveWorkerJobs.delete(id);
      reject(e);
    }
  });
};

VGMPlay_js.prototype._extractArchiveViaBackground = function (byteArray, kind, url) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      reject(new Error("Extension runtime unavailable"));
      return;
    }
    const id = this._backgroundExtractSeq++;
    const timeout = setTimeout(() => {
      this._backgroundExtractJobs.delete(id);
      console.log('[VGM] Background extraction timeout for', kind, '- falling back to main thread');
      reject(new Error("Background extraction timeout"));
    }, 120000);
this._backgroundExtractJobs.set(id, { resolve, reject, timeout, fileDataByPath: new Map(), entries: [], hasKss: false });
    chrome.runtime.sendMessage({ type: 'vgm-cache', action: 'extractArchive', kind, url, id }, (resp) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        this._backgroundExtractJobs.delete(id);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (resp && resp.error) {
        clearTimeout(timeout);
        this._backgroundExtractJobs.delete(id);
        reject(new Error(resp.error));
      }
    });
  });
};

VGMPlay_js.prototype._extractArchiveWithWorker = function (byteArray, kind, url, options = {}) {
return new Promise((resolve, reject) => {
if (!options.metadataOnly && this.isExtension && !this.standalone && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && url) {
this._extractArchiveViaBackground(byteArray, kind, url).then(resolve).catch(reject);
return;
}
let worker = null;
if (kind === 'rar') {
  worker = this._getRarWorker();
  if (!this._rarWorkersByJob) this._rarWorkersByJob = new Map();
} else {
  worker = this._getArchiveWorker();
}
if (!worker) {
reject(new Error("Archive worker unavailable"));
return;
}
const id = this._archiveWorkerSeq++;
this._archiveWorkerJobs.set(id, {
resolve, reject,
entries: null,
hasKss: false,
fileDataByPath: new Map()
});
    try {
      const payload = { type: 'extract', id, kind, buffer: byteArray.buffer, baseURL: this.baseURL, debugMode: this.debugMode, metadataOnly: !!options.metadataOnly };
      if (kind === 'rar') {
        payload.unrarMemoryMB = this.unrarMemoryMB || 1024;
        this._rarWorkersByJob.set(id, worker);
      }
      worker.postMessage(payload, [byteArray.buffer]);
    } catch (e) {
      this._archiveWorkerJobs.delete(id);
      reject(e);
    }
  });
};

VGMPlay_js.prototype.processZipBuffer = async function (byteArray, sourceName = '') {
	let normalizedUrl = sourceName;
	if (sourceName) {
		try {
			const url = new URL(sourceName, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
			normalizedUrl = url.host + '/' + sourceName.split('/').pop().split('?')[0].split('#')[0];
		} catch (e) {
			normalizedUrl = sourceName.split('/').pop().split('?')[0].split('#')[0];
		}
	} else {
		normalizedUrl = 'archive.zip';
	}
	
	this._processedURLs = this._processedURLs || new Set();
	const alreadyProcessed = this._processedURLs.has(normalizedUrl);
	this._log && this._log('ARCHIVES', 'processZipBuffer:', normalizedUrl, '_processedURLs size:', this._processedURLs.size, 'already processed:', alreadyProcessed, 'games.length:', this.games.length);
	if (alreadyProcessed) {
		this._log && this._log('ARCHIVES', 'SKIPPING duplicate URL:', normalizedUrl);
		return;
	}
	this._processedURLs.add(normalizedUrl);
	this._log && this._log('ARCHIVES', 'Added to _processedURLs:', normalizedUrl, 'new size:', this._processedURLs.size);
	
	this._log && this._log('ARCHIVES', 'Processing:', sourceName, 'byteArray size:', byteArray.byteLength);
	const rawName = sourceName ? sourceName.split('/').pop().split('?')[0].split('#')[0] : 'archive.zip';
	const cleanName = rawName;
	const cleanNameLower = cleanName.toLowerCase();

	const existingGames = this.games.filter(g => g && g.archiveName && g.archiveName.toLowerCase() === cleanNameLower);
	this._log && this._log('ARCHIVES', 'Existing games with same archiveName:', existingGames.length, existingGames.map(g => g.name));
	if (existingGames.length > 0) {
		this._log && this._log('ARCHIVES', 'SKIPPING duplicate archive:', cleanName);
		this._log && this._log('ARCHIVES', `Archive ${cleanName} already in games list, skipping.`);
		return;
	}

	const fingerprint = cleanName + ':' + byteArray.byteLength;

	if (this._isCached && this._isCached(fingerprint)) {
		this._log && this._log('ARCHIVES', `Archive ${cleanName} already cached (fingerprint), skipping extraction.`);
		return;
	}

	try {
		this._log && this._log('ARCHIVES', 'Worker path for:', cleanName, 'byteArray.size:', byteArray.byteLength);
		const workerResult = await this._extractArchiveWithWorker(byteArray, 'zip', sourceName);
		this._log && this._log('ARCHIVES', 'Worker result for:', cleanName, 'entries:', workerResult.entries.length, 'hasKss:', workerResult.hasKss);
		const processResult = await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, cleanName, workerResult.hasKss);
		if (processResult && processResult.anyPlayable) {
			if (this._markCached) this._markCached(fingerprint);
			if (this._saveCache) await this._saveCache();
		}
		this._log && this._log('ARCHIVES', 'Worker path COMPLETE for:', cleanName, 'games.length:', this.games.length);
		return;
	} catch (e) {
  if (byteArray.byteLength === 0) {
    if (this.debugMode) console.error("[VGM] Zip worker failed after buffer transfer:", e);
    return;
  }
  if (this.debugMode) console.warn("[VGM] Zip worker failed, falling back to main thread:", e);
}

		if (this.debugMode) console.error("[VGM] Zip extraction failed.");
	};

VGMPlay_js.prototype.process7zBuffer = async function (byteArray, sourceName = '') {
	const cleanName = sourceName ? sourceName.split('?')[0].split('#')[0] : 'archive.7z';
	const cleanNameLower = cleanName.toLowerCase();

	if (this.games.some(g => g && g.archiveName && g.archiveName.toLowerCase() === cleanNameLower)) {
		this._log && this._log('ARCHIVES', `Archive ${cleanName} already in games list, skipping.`);
		return;
	}

	const fingerprint = cleanName + ':' + byteArray.byteLength;

	if (this._isCached && this._isCached(fingerprint)) {
		this._log && this._log('ARCHIVES', `Archive ${cleanName} already cached (fingerprint), skipping extraction.`);
		return;
	}

try {
if (this.debugMode) console.log(`[VGM] Starting 7z extraction with worker for ${cleanName}`);
const workerResult = await this._extractArchiveWithWorker(byteArray, '7z', sourceName);
if (this.debugMode) console.log(`[VGM] 7z Extraction done, processing ${workerResult.fileDataByPath.size} entries for ${cleanName}`);
const processResult = await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, cleanName, workerResult.hasKss);
if (processResult && processResult.anyPlayable) {
if (this._markCached) this._markCached(fingerprint);
if (this._saveCache) await this._saveCache();
}
return;
} catch (e) {
if (byteArray.byteLength === 0) {
  if (this.debugMode) console.error("[VGM] 7z worker failed after buffer transfer:", e);
  return;
}
if (this.debugMode) console.warn("[VGM] 7z worker failed, falling back to main thread:", e);
}

		if (this.debugMode) console.error("[VGM] 7z extraction failed.");
	};

	VGMPlay_js.prototype.processRarBuffer = async function (byteArray, sourceName = '') {
		const cleanName = sourceName ? sourceName.split('?')[0].split('#')[0] : 'archive.rar';
		const fingerprint = cleanName + ':' + byteArray.byteLength;
		if (this._isCached && this._isCached(fingerprint)) {
			if (this.debugMode) console.log(`[VGM] Archive ${cleanName} already cached, skipping extraction.`);
			return;
		}

		try {
			const workerResult = await this._extractArchiveWithWorker(byteArray, 'rar', sourceName);
			const processResult = await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, cleanName, workerResult.hasKss);
			if (processResult && processResult.anyPlayable) {
				if (this._markCached) this._markCached(fingerprint);
				if (this._saveCache) await this._saveCache();
			}
			return;
		} catch (e) {
			if (byteArray.byteLength === 0) {
				if (this.debugMode) console.error("[VGM] RAR worker failed - empty buffer:", e);
			} else {
				if (this.debugMode) console.warn("[VGM] RAR worker failed:", e);
			}
		}

		if (this.debugMode) console.error("[VGM] RAR extraction failed.");
	};
}
