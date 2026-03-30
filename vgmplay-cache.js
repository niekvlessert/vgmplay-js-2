export function installCache(VGMPlay_js) {
	VGMPlay_js.prototype._now = function () {
		if (typeof performance !== 'undefined' && performance.now) return performance.now();
		return Date.now();
	};
	VGMPlay_js.prototype._cacheBridgeAvailable = function () {
		return !!(this.sharedCache && this.isExtension && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage);
	};

	VGMPlay_js.prototype._cacheBridgeRequest = function (action, payload = {}) {
	return new Promise((resolve) => {
		if (!this._cacheBridgeAvailable()) {
			resolve({ error: 'cache bridge unavailable' });
			return;
		}
		try {
chrome.runtime.sendMessage({ type: 'vgm-cache', action, payload }, (resp) => {
  if (chrome.runtime.lastError) {
    const msg = chrome.runtime.lastError.message;
    this._logWarn && this._logWarn('CACHE', 'Cache bridge error:', action, msg);
    resolve({ error: msg });
    return;
  }
  if (resp && resp.error) {
    this._logWarn && this._logWarn('CACHE', 'Cache bridge error:', action, resp.error);
  }
  resolve(resp || {});
});
} catch (e) {
  this._logWarn && this._logWarn('CACHE', 'Cache bridge exception:', action, e);
  resolve({ error: String(e) });
}
	});
};

	VGMPlay_js.prototype._cacheBridgeMissing = async function (paths) {
		if (!paths || !paths.length) return [];
		const uniq = Array.from(new Set(paths.filter(Boolean)));
		const chunkSize = 50;
		const missing = [];
		for (let i = 0; i < uniq.length; i += chunkSize) {
			const chunk = uniq.slice(i, i + chunkSize);
			const resp = await this._cacheBridgeRequest('hasFiles', { paths: chunk });
			if (resp && resp.error) {
				return [];
			}
			if (resp && Array.isArray(resp.missing)) {
				missing.push(...resp.missing);
			}
		}
return missing;
};

VGMPlay_js.prototype._ensureFileLoaded = async function (filepath, showLoading = true) {
  if (!filepath) return false;
  try {
    if (FS.analyzePath(filepath).exists) return true;
  } catch (e) {
    return false;
  }
  
  if (!this._cacheBridgeAvailable()) return false;
  
if (showLoading) {
  this._log && this._log('CACHE', 'On-demand loading:', filepath);
  const size = this._cacheFileSizes ? this._cacheFileSizes[filepath] : null;
  const threshold = this.largeCachePrefetchBytes || (10 * 1024 * 1024);
  const msg = (size && size > threshold)
    ? 'Fetching large cached file on demand...'
    : null;
  this._setInfoLoading(true, msg);
}
  
  try {
const resp = await this._cacheBridgeRequest('getFiles', { paths: [filepath] });
  if (resp && resp.files && resp.files[0]) {
    const item = resp.files[0];
    if (item && item.path && (item.b64 || item.data)) {
      let arr = null;
      if (item.b64) {
        const binary = atob(item.b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        arr = bytes;
      } else if (item.data) {
        arr = (item.data instanceof ArrayBuffer) ? new Uint8Array(item.data) : new Uint8Array(item.data.buffer || item.data);
      }
      if (arr && arr.byteLength > 0) {
        this._ensureDirForFile(item.path);
        try { FS.writeFile(item.path, arr); } catch (e) { }
        if (showLoading) this._setInfoLoading(false);
        return true;
      }
    }
  }
} catch (e) {
  this._logError && this._logError('CACHE', 'On-demand load failed:', filepath, e);
}

  if (showLoading) this._setInfoLoading(false);
  return false;
};

VGMPlay_js.prototype._ensureCacheDirs = function () {
		if (!FS.analyzePath('/cache').exists) FS.mkdir('/cache');
		if (!FS.analyzePath('/cache/files').exists) FS.mkdir('/cache/files');
		if (!FS.analyzePath('/cache/meta').exists) FS.mkdir('/cache/meta');
	};

	VGMPlay_js.prototype._ensureDirForFile = function (path) {
		const parts = path.split('/').filter(Boolean);
		if (parts.length <= 1) return;
		let cur = '';
		for (let i = 0; i < parts.length - 1; i++) {
			cur += '/' + parts[i];
			if (!FS.analyzePath(cur).exists) {
				try { FS.mkdir(cur); } catch (e) { }
			}
		}
	};

VGMPlay_js.prototype._bridgeFetchFiles = async function (paths, opts = {}) {
if (!paths || !paths.length) return;
const uniq = Array.from(new Set(paths.filter(Boolean)));
this._log && this._log('CACHE', '_bridgeFetchFiles: Fetching', uniq.length, 'unique files');

// Use smaller chunks to avoid 64MB message limit
const chunkSize = opts.chunkSize || 10;
const chunks = [];
for (let i = 0; i < uniq.length; i += chunkSize) {
  chunks.push(uniq.slice(i, i + chunkSize));
}

let filesWritten = 0;
let errors = 0;

const processChunk = async (chunk, chunkIndex) => {
  try {
    const resp = await this._cacheBridgeRequest('getFiles', { paths: chunk });
    if (resp && resp.error) {
      // If chunk is too large, try fetching files one by one
      if (resp.error.includes('maximum allowed size') || resp.error.includes('64MiB')) {
        this._logWarn && this._logWarn('CACHE', 'Chunk', chunkIndex, 'too large, fetching individually');
        for (const path of chunk) {
          try {
            const singleResp = await this._cacheBridgeRequest('getFiles', { paths: [path] });
            if (singleResp && singleResp.files && singleResp.files[0]) {
              const item = singleResp.files[0];
              if (item && item.path && (item.b64 || item.data)) {
                let arr = null;
                if (item.b64) {
                  const binary = atob(item.b64);
                  const len = binary.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                  arr = bytes;
                } else if (item.data) {
                  arr = (item.data instanceof ArrayBuffer) ? new Uint8Array(item.data) : new Uint8Array(item.data.buffer || item.data);
                }
                if (arr && arr.byteLength > 0) {
                  this._ensureDirForFile(item.path);
                  try { FS.writeFile(item.path, arr); filesWritten++; } catch (e) { }
                }
              }
            }
          } catch (e) {
            errors++;
          }
        }
      }
      return;
    }
    if (resp && resp.files && Array.isArray(resp.files)) {
      for (const item of resp.files) {
        if (!item || !item.path) continue;
        let arr = null;
        if (item.b64) {
          const binary = atob(item.b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          arr = bytes;
        } else if (item.data) {
          arr = (item.data instanceof ArrayBuffer) ? new Uint8Array(item.data) : new Uint8Array(item.data.buffer || item.data);
        } else {
          continue;
        }
        if (arr.byteLength > 0) {
          this._ensureDirForFile(item.path);
          try { FS.writeFile(item.path, arr); filesWritten++; } catch (e) { }
        }
      }
    }
  } catch (e) {
    errors++;
  }
};

// Process chunks with limited concurrency
const maxConcurrent = opts.maxConcurrent || 3;
const yieldEveryBatches = opts.yieldEveryBatches || 0;
const yieldToUI = async () => new Promise((r) => setTimeout(r, 0));
for (let i = 0, batchIndex = 0; i < chunks.length; i += maxConcurrent, batchIndex++) {
  const batch = chunks.slice(i, i + maxConcurrent);
  await Promise.all(batch.map((chunk, idx) => processChunk(chunk, i + idx)));
  // Log progress every 5 batches
  if ((i + maxConcurrent) % 50 === 0 || i + maxConcurrent >= chunks.length) {
    this._log && this._log('CACHE', 'Progress:', Math.min(i + maxConcurrent, chunks.length), '/', chunks.length, 'chunks,', filesWritten, 'files loaded');
  }
  if (yieldEveryBatches > 0 && (batchIndex + 1) % yieldEveryBatches === 0) {
    await yieldToUI();
  }
}

this._log && this._log('CACHE', '_bridgeFetchFiles complete:', filesWritten, 'files written,', errors, 'errors');
};

	VGMPlay_js.prototype._collectCacheFilePaths = function () {
		const out = [];
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
					out.push(full);
				}
			}
		};
		walk('/cache/meta');
		walk('/cache/files');
		return out;
	};

VGMPlay_js.prototype._restoreCacheFromBridge = async function () {
	const tStart = this._now();
	this._log && this._log('CACHE', '_restoreCacheFromBridge starting');
	const resp = await this._cacheBridgeRequest('getMeta');
	const tMeta = this._now();
	if (!resp || !resp.meta) {
		this._log && this._log('CACHE', 'No shared cache metadata found');
		return;
	}
	this._log && this._log('CACHE', 'Cache metadata loaded, games:', resp.meta.games ? resp.meta.games.length : 0);
	this._log && this._log('CACHE', 'Cache meta fetch ms:', Math.round(tMeta - tStart));
const meta = resp.meta;
  const metaHost = (meta && meta.cacheHost) ? String(meta.cacheHost) : '';
  this._cacheFileSizes = meta.fileSizes || {};
if (meta.version !== 2) {
  this._logWarn && this._logWarn('CACHE', "Shared cache version mismatch, ignoring shared cache");
    this._cacheFingerprints.clear();
    this.games = [];
    this.zipURLLoaded = [];
    this.amountOfGamesLoaded = 0;
    this._cacheArchiveNames = new Set();
    this._cacheRestoredByHost = new Map();
    this.autoCacheHits = 0;
    this._cacheRestoredGameCount = 0;
    return;
  }

  // Restore ROM files FIRST before any games are loaded
  // This ensures OPL4 and Munt ROMs are available when VGM files are loaded
  if (this._restoreRomsFromCache) {
    await this._restoreRomsFromCache();
  }
	const tRoms = this._now();

  const normalizeArchiveName = (value) => {
			if (!value) return '';
			let name = String(value);
			const base = name.split('?')[0].split('#')[0];
			const last = base.split('/').pop() || base;
			try { return decodeURIComponent(last).toLowerCase(); } catch (e) { return last.toLowerCase(); }
		};

		// Restore fingerprints
		if (meta.fingerprints) {
			meta.fingerprints.forEach(f => this._cacheFingerprints.add(f));
			meta.fingerprints.forEach(f => this.zipURLLoaded.push(f));
			this._cacheRestoredFingerprints = new Set(meta.fingerprints);
			this._cacheArchiveNames = new Set();
			meta.fingerprints.forEach((f) => {
				const base = String(f).split(':')[0];
				if (base) {
					this._cacheArchiveNames.add(base.toLowerCase());
					const norm = normalizeArchiveName(base);
					if (norm) this._cacheArchiveNames.add(norm);
				}
			});
		}

		const coverPaths = [];
		if (meta.games && Array.isArray(meta.games)) {
			for (const g of meta.games) {
				if (g && g.coverPath) coverPaths.push(g.coverPath);
			}
		}
		await this._bridgeFetchFiles(coverPaths);
		const tCovers = this._now();

	// Restore games
	if (meta.games && Array.isArray(meta.games)) {
		this._log && this._log('CACHE', 'meta.games.length:', meta.games.length);
		
		// Deduplicate by sourceUrl + name (not just URL) and by archiveName + name
		const seenUrlKeys = new Set();
		const seenGameKeys = new Set();
		const dedupedGames = [];
		for (const g of meta.games) {
			// If sourceUrl exists, include name so multi-game archives aren't collapsed
			if (g.sourceUrl) {
				const urlKey = `${g.sourceUrl}::${g.name || ''}`;
				if (seenUrlKeys.has(urlKey)) {
					this._log && this._log('CACHE', 'Skipping duplicate game by URL+name:', g.sourceUrl, g.name);
					continue;
				}
				seenUrlKeys.add(urlKey);
			}
			// Also dedupe by archiveName + name combination
			const archiveName = g.archiveName ? normalizeArchiveName(g.archiveName) : '';
			const gameName = g.name || '';
			const gameKey = `${archiveName}:${gameName}`;
			if (seenGameKeys.has(gameKey)) {
				this._log && this._log('CACHE', 'Skipping duplicate game in cache:', g.archiveName, g.name);
				continue;
			}
			seenGameKeys.add(gameKey);
			dedupedGames.push(g);
		}
	this._log && this._log('CACHE', 'dedupedGames.length:', dedupedGames.length);

	// Track restored URLs - normalize to host + filename for deduplication
	this._processedURLs = this._processedURLs || new Set();
	const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : 'localhost';
	for (const g of dedupedGames) {
		const rawUrl = g.sourceUrl || g.archiveName;
		if (rawUrl) {
			let normalizedUrl;
			// Check if it's already a full URL
			if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
				try {
					const url = new URL(rawUrl);
					normalizedUrl = url.host + '/' + rawUrl.split('/').pop().split('?')[0].split('#')[0];
				} catch (e) {
					normalizedUrl = rawUrl;
				}
			} else {
				// It's just a filename - combine with current host
				normalizedUrl = currentHost + '/' + rawUrl.split('/').pop().split('?')[0].split('#')[0];
			}
			this._processedURLs.add(normalizedUrl);
			this._log && this._log('CACHE', 'Added to _processedURLs:', normalizedUrl);
		}
	}
	this._log && this._log('CACHE', '_processedURLs size after restore:', this._processedURLs.size);

		this.games = dedupedGames.map(g => {
			const rebuilt = this._rebuildGameFromMeta(g, this.debugMode);
			if (rebuilt && !rebuilt.cacheHost && metaHost) {
				rebuilt.cacheHost = metaHost;
			}
			// Apply any pending external images to restored games
			if (rebuilt && rebuilt.archiveName && this._applyExternalGameImage && this._pendingExternalGameImages) {
				this._applyExternalGameImage(rebuilt, rebuilt.archiveName, false);
			}
			return rebuilt;
		});
			if (!this._cacheArchiveNames) this._cacheArchiveNames = new Set();
			this._cacheRestoredByHost = new Map();
			this.games.forEach((g) => {
				const name = (g && g.archiveName) ? String(g.archiveName) : '';
				if (name) {
					this._cacheArchiveNames.add(name.toLowerCase());
					const norm = normalizeArchiveName(name);
					if (norm) this._cacheArchiveNames.add(norm);
				}
				const hostKey = (g && g.cacheHost) ? String(g.cacheHost) : 'unknown';
				this._cacheRestoredByHost.set(hostKey, (this._cacheRestoredByHost.get(hostKey) || 0) + 1);
			});
		}
	const tGames = this._now();

if (typeof meta.amountOfGamesLoaded !== 'undefined') {
this.amountOfGamesLoaded = meta.amountOfGamesLoaded;
}

// PROGRESSIVE LOADING: Render games immediately before fetching file content
if (this.games.length > 0) {
  this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (!this._cacheRestoreCounted) {
    this.autoCacheHits = this.games.length;
    this._cacheRestoredGameCount = this.games.length;
    this._cacheRestoreCounted = true;
  }
  // Schedule immediate render with placeholder state
  this._scheduleZipRender();
}

// Collect file paths for background loading
const filePaths = [];
const largeFilePaths = [];
const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
if (this.games && this.games.length) {
  for (const g of this.games) {
    if (!g || !g.files) continue;
    const sameHost = !g.cacheHost || !currentHost || g.cacheHost === currentHost;
    for (const f of g.files) {
      if (f && f.filepath) {
        const size = this._cacheFileSizes ? this._cacheFileSizes[f.filepath] : null;
        const threshold = this.largeCachePrefetchBytes || (10 * 1024 * 1024);
        if (!sameHost) {
          largeFilePaths.push(f.filepath);
          continue;
        }
        // For current host, prefetch unknown sizes to restore track lists quickly.
        if (size != null && size > threshold) {
          largeFilePaths.push(f.filepath);
        } else {
          filePaths.push(f.filepath);
        }
      }
    }
  }
}

this._log && this._log('CACHE', 'Starting background load of', filePaths.length, 'files');
if (largeFilePaths.length) {
  this._log && this._log('CACHE', 'Deferring large files (on-demand):', largeFilePaths.length);
}

// Load files in background - don't await, let UI render first
this._bridgeFetchFiles(filePaths, { chunkSize: 3, maxConcurrent: 1, yieldEveryBatches: 1 }).then(() => {
  this._log && this._log('CACHE', 'Background file load complete');
  // After files are loaded, re-render to update track counts
  for (const g of this.games) {
    if (g) g.uiElement = null;
  }
  if (this._scheduleZipRender) {
    this._scheduleZipRender();
  }
}).catch((e) => {
  this._logError && this._logError('CACHE', 'Background file load failed:', e);
});
this._log && this._log('CACHE', 'Restore timing ms:', {
	meta: Math.round(tMeta - tStart),
	roms: Math.round(tRoms - tMeta),
	covers: Math.round(tCovers - tRoms),
	games: Math.round(tGames - tCovers)
});

if (this._cacheArchiveNames) {
				const wasOverflow = (this.autoOverflowURLs || []).length;
				if (wasOverflow) {
					this.autoOverflowURLs = this.autoOverflowURLs.filter((u) => {
						const norm = normalizeArchiveName(u);
						return !this._cacheArchiveNames.has(norm);
					});
				}
				if (this.autoOverflowSizes && wasOverflow) {
					for (const [u] of this.autoOverflowSizes) {
						const norm = normalizeArchiveName(u);
						if (this._cacheArchiveNames.has(norm)) {
							this.autoOverflowSizes.delete(u);
						}
					}
				}
				if (Array.isArray(this.zipQueue) && this.zipQueue.length) {
					this.zipQueue = this.zipQueue.filter((job) => {
						if (!job || job.type !== 'url') return true;
						const norm = normalizeArchiveName(job.data || job.name || '');
						return !this._cacheArchiveNames.has(norm);
					});
				}
				if (Array.isArray(this.zipURLPending) && this.zipURLPending.length) {
					this.zipURLPending = this.zipURLPending.filter((u) => {
						const norm = normalizeArchiveName(u);
						return !this._cacheArchiveNames.has(norm);
					});
				}
				if ((this.autoOverflowURLs || []).length === 0 && (!this.zipQueue || this.zipQueue.length === 0) && (!this.zipURLPending || this.zipURLPending.length === 0)) {
      this.autoDownloadCount = 0;
        this.autoDownloadBytes = 0;
      }
    }
if (this._renderSkippedDownloads) {
this._renderSkippedDownloads();
}

// Remove verification that would block - files are loaded in background now
if (this.games.length > 0) {
  this._log && this._log('CACHE', `Restored ${this.games.length} games from shared cache (files loading in background)`);
}
};
	VGMPlay_js.prototype._initCache = function () {
		return new Promise((resolve) => {
			this._cacheFingerprints = new Set();
			this._cacheReady = false;

			try {
				this._ensureCacheDirs();
				if (this._cacheBridgeAvailable()) {
					this._cacheReady = true;
					this._restoreCacheFromBridge().then(() => resolve());
					return;
				}
	FS.mount(FS.filesystems.IDBFS, {}, '/cache');
	FS.syncfs(true, (err) => {
		if (err) {
			if (this.debugMode) console.error("[VGM] Failed to sync IDBFS (read):", err);
			resolve();
			return;
		}

		this._cacheReady = true;
		this._log && this._log('CACHE', 'IDBFS syncfs complete, checking for metadata...');
		const metaPath = '/cache/meta/metadata.json';
		const metaExists = FS.analyzePath(metaPath).exists;
		this._log && this._log('CACHE', 'metadata.json exists:', metaExists);
		if (metaExists) {
			try {
				const metaText = FS.readFile(metaPath, { encoding: 'utf8' });
				const meta = JSON.parse(metaText);
				this._log && this._log('CACHE', 'metadata loaded, games:', meta.games ? meta.games.length : 0, 'sourceUrls:', meta.games ? meta.games.map(g => g.sourceUrl) : []);
			} catch (e) {
				this._log && this._log('CACHE', 'Failed to read metadata:', e);
			}
		}
		this._restoreCache();
		resolve();
	});
  } catch (e) {
    if (this.debugMode) console.error("[VGM] Failed to init IDBFS:", e);
    resolve();
  }
		});
	};

	VGMPlay_js.prototype._restoreCache = function () {
		const metaPath = '/cache/meta/metadata.json';
		if (!FS.analyzePath(metaPath).exists) {
			if (this.debugMode) console.log("[VGM] No cache metadata found");
			return;
		}

		try {
			const metaText = FS.readFile(metaPath, { encoding: 'utf8' });
			const meta = JSON.parse(metaText);
			const metaHost = (meta && meta.cacheHost) ? String(meta.cacheHost) : '';

  if (meta.version !== 2) {
    if (this.debugMode) console.warn("[VGM] Cache version mismatch, clearing cache");
    this.clearCache();
    return;
  }

			const normalizeArchiveName = (value) => {
				if (!value) return '';
				let name = String(value);
				const base = name.split('?')[0].split('#')[0];
				const last = base.split('/').pop() || base;
				try { return decodeURIComponent(last).toLowerCase(); } catch (e) { return last.toLowerCase(); }
			};

			// Restore fingerprints
			if (meta.fingerprints) {
				meta.fingerprints.forEach(f => this._cacheFingerprints.add(f));
				meta.fingerprints.forEach(f => this.zipURLLoaded.push(f)); // Also add to zipURLLoaded so it's not downloaded
				this._cacheRestoredFingerprints = new Set(meta.fingerprints);
				this._cacheArchiveNames = new Set();
				meta.fingerprints.forEach((f) => {
					const base = String(f).split(':')[0];
					if (base) {
						this._cacheArchiveNames.add(base.toLowerCase());
						const norm = normalizeArchiveName(base);
						if (norm) this._cacheArchiveNames.add(norm);
					}
				});
			}

	// Restore games
	if (meta.games && Array.isArray(meta.games)) {
		this.games = meta.games.map(g => {
			const rebuilt = this._rebuildGameFromMeta(g, this.debugMode);
			if (rebuilt && !rebuilt.cacheHost && metaHost) {
				rebuilt.cacheHost = metaHost;
			}
			return rebuilt;
		});
		if (!this._cacheArchiveNames) this._cacheArchiveNames = new Set();
		this._cacheRestoredByHost = new Map();
		this.games.forEach((g) => {
			const name = (g && g.archiveName) ? String(g.archiveName) : '';
			if (name) {
				this._cacheArchiveNames.add(name.toLowerCase());
				const norm = normalizeArchiveName(name);
				if (norm) this._cacheArchiveNames.add(norm);
			}
			const hostKey = (g && g.cacheHost) ? String(g.cacheHost) : 'unknown';
			this._cacheRestoredByHost.set(hostKey, (this._cacheRestoredByHost.get(hostKey) || 0) + 1);
		});
		
		// Populate _processedURLs from restored games
		this._processedURLs = this._processedURLs || new Set();
		const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : 'localhost';
		this._log && this._log('CACHE', 'Populating _processedURLs from', this.games.length, 'restored games');
		for (const g of this.games) {
			const rawUrl = g.sourceUrl || g.archiveName;
			if (rawUrl) {
				let normalizedUrl;
				if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
					try {
						const url = new URL(rawUrl);
						normalizedUrl = url.host + '/' + rawUrl.split('/').pop().split('?')[0].split('#')[0];
					} catch (e) {
						normalizedUrl = rawUrl;
					}
				} else {
					normalizedUrl = currentHost + '/' + rawUrl.split('/').pop().split('?')[0].split('#')[0];
				}
				this._processedURLs.add(normalizedUrl);
				this._log && this._log('CACHE', 'Restored URL to _processedURLs:', normalizedUrl);
			}
		}
		this._log && this._log('CACHE', '_processedURLs size after restore:', this._processedURLs.size);
	}

			if (typeof meta.amountOfGamesLoaded !== 'undefined') {
				this.amountOfGamesLoaded = meta.amountOfGamesLoaded;
			}

			if (this.games.length > 0) {
				const missing = this.games.some((g) => {
					if (!g || !g.files || !g.files.length) return true;
					const anyExisting = g.files.some((f) => {
						if (!f || !f.filepath) return false;
						try {
							return FS.analyzePath(f.filepath).exists;
						} catch (e) {
							return false;
						}
					});
					return !anyExisting;
				});
				if (missing) {
    if (this.debugMode) console.warn("[VGM] Cached files missing, clearing cache");
    this.clearCache();
    return;
  }
				if (this.debugMode) console.log(`[VGM] Restored ${this.games.length} games from cache`);
				if (!this._cacheRestoreCounted) {
					const restoredCount = this.games.length;
					this.autoCacheHits = restoredCount;
					this._cacheRestoredGameCount = restoredCount;
					this._cacheRestoreCounted = true;
				}
				this._scheduleZipRender();
				if (this._cacheArchiveNames) {
					const wasOverflow = (this.autoOverflowURLs || []).length;
					if (wasOverflow) {
						this.autoOverflowURLs = this.autoOverflowURLs.filter((u) => {
							const norm = normalizeArchiveName(u);
							return !this._cacheArchiveNames.has(norm);
						});
					}
					if (this.autoOverflowSizes && wasOverflow) {
						for (const [u] of this.autoOverflowSizes) {
							const norm = normalizeArchiveName(u);
							if (this._cacheArchiveNames.has(norm)) {
								this.autoOverflowSizes.delete(u);
							}
						}
					}
					if (Array.isArray(this.zipQueue) && this.zipQueue.length) {
						this.zipQueue = this.zipQueue.filter((job) => {
							if (!job || job.type !== 'url') return true;
							const norm = normalizeArchiveName(job.data || job.name || '');
							return !this._cacheArchiveNames.has(norm);
						});
					}
					if (Array.isArray(this.zipURLPending) && this.zipURLPending.length) {
						this.zipURLPending = this.zipURLPending.filter((u) => {
							const norm = normalizeArchiveName(u);
							return !this._cacheArchiveNames.has(norm);
						});
					}
					if ((this.autoOverflowURLs || []).length === 0 && (!this.zipQueue || this.zipQueue.length === 0) && (!this.zipURLPending || this.zipURLPending.length === 0)) {
						this.autoDownloadCount = 0;
						this.autoDownloadBytes = 0;
					}
				}
				if (this._renderSkippedDownloads) {
					this._renderSkippedDownloads();
				}
			}

		} catch (e) {
    if (this.debugMode) console.error("[VGM] Failed to parse cache metadata:", e);
  }
	};

VGMPlay_js.prototype._saveCache = async function () {
		if (!this._cacheReady) return;
		if (this._cacheSaveInFlight) {
			this._cacheSaveQueued = true;
			return;
		}
		this._cacheSaveInFlight = true;
		this._cacheSaveQueued = false;

		try {
			if (!FS.analyzePath('/cache/meta').exists) {
				FS.mkdir('/cache/meta');
			}

			const gamesToSave = [];
			const conversionPromises = [];
			const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : '';

			this.games.forEach((g, i) => {
				const gCopy = { ...g };
				if (!gCopy.cacheHost && currentHost) {
					gCopy.cacheHost = currentHost;
				}
				
				// We can't save Blobs nicely, so extract to a file and save path
				if (g.png && g.png instanceof Blob) {
					const coverPath = `/cache/meta/cover_${i}.png`;
					
					const convertPromise = new Promise((resolve) => {
						const reader = new FileReader();
						reader.onload = () => {
							const arr = new Uint8Array(reader.result);
							try {
								FS.writeFile(coverPath, arr);
							} catch (e) {
    if (this.debugMode) console.error("[VGM] Failed to write cover file:", coverPath, e);
  }
							resolve();
						};
						reader.onerror = () => {
    if (this.debugMode) console.error("[VGM] Failed to read cover Blob:", coverPath);
    resolve();
  };
						reader.readAsArrayBuffer(g.png);
					});
					
					conversionPromises.push(convertPromise);
					gCopy.coverPath = coverPath;
				}
				
				delete gCopy.png; // Remove Blob
				delete gCopy.playableList; // Derived data
				delete gCopy.uiElement;
				delete gCopy.trackContainer;
				delete gCopy.lastRenderedCount;
				delete gCopy._overviewImageUrl;
				delete gCopy._overviewTile;
				delete gCopy._fromCache;

				gamesToSave.push(gCopy);
			});

			// Wait for all covers to be written to MEMFS
			if (conversionPromises.length > 0) {
				await Promise.all(conversionPromises);
			}

			const cacheFiles = this._collectCacheFilePaths().filter((p) => !p.endsWith('/metadata.json'));
			const fileSizes = {};
			for (const path of cacheFiles) {
				try {
					const stat = FS.stat(path);
					if (stat && typeof stat.size === 'number') fileSizes[path] = stat.size;
				} catch (e) { }
			}

			const meta = {
				version: 2,
				cacheHost: currentHost || '',
				amountOfGamesLoaded: this.amountOfGamesLoaded,
				fingerprints: Array.from(this._cacheFingerprints),
				games: gamesToSave,
				fileSizes
			};

			FS.writeFile('/cache/meta/metadata.json', JSON.stringify(meta));

			if (this._cacheBridgeAvailable()) {
				const files = cacheFiles;
				const chunk = [];
				let chunkBytes = 0;
				const maxChunkBytes = 700 * 1024;
				const flushChunk = async () => {
					if (!chunk.length) return;
	const resp = await this._cacheBridgeRequest('putFiles', { files: chunk.splice(0, chunk.length) });
	if (resp && resp.error) {
		this._logWarn && this._logWarn('CACHE', 'Cache bridge putFiles failed:', resp.error);
	}
					chunkBytes = 0;
				};
				for (const path of files) {
					let data = null;
					try {
						const arr = FS.readFile(path);
						const slice = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
						const bytes = new Uint8Array(slice);
						let binary = '';
						const chunkSize = 0x8000;
						for (let i = 0; i < bytes.length; i += chunkSize) {
							const sub = bytes.subarray(i, i + chunkSize);
							binary += String.fromCharCode.apply(null, sub);
						}
						const b64 = btoa(binary);
						data = { b64 };
					} catch (e) { continue; }
					const size = data && data.b64 ? data.b64.length : 0;
					if (chunkBytes + size > maxChunkBytes) {
						await flushChunk();
					}
					chunk.push({ path, b64: data.b64 });
					chunkBytes += size;
					if (size > maxChunkBytes) {
						await flushChunk();
					}
				}
				await flushChunk();
				await this._cacheBridgeRequest('putMeta', { meta });
				if (this._cacheBridgeMissing) {
					const missing = await this._cacheBridgeMissing(files);
					if (missing && missing.length && this.debugMode) {
						console.warn('[VGM] Shared cache verify missing after save:', missing.slice(0, 10), missing.length > 10 ? '...' : '');
					}
				}
				if (files.length) {
					const sample = files.slice(0, 5);
					const resp = await this._cacheBridgeRequest('getFiles', { paths: sample });
					if (resp && resp.files) {
						const empty = resp.files.filter((f) => !f.data || (f.data.byteLength === 0));
						if (empty.length && this.debugMode) {
							console.warn('[VGM] Shared cache verify empty after save:', empty.map((f) => f.path));
						}
					}
				}
				if (this.debugMode) console.log("[VGM] Cache saved to shared store");
				this._cacheSaveInFlight = false;
				if (this._cacheSaveQueued) {
					this._cacheSaveQueued = false;
					this._saveCache();
				}
				return;
			}

			FS.syncfs(false, (err) => {
    if (err) {
      if (this.debugMode) console.error("[VGM] Failed to sync IDBFS (write):", err);
    } else {
      if (this.debugMode) console.log("[VGM] Cache saved to IDBFS");
    }
    this._cacheSaveInFlight = false;
    if (this._cacheSaveQueued) {
      this._cacheSaveQueued = false;
      this._saveCache();
    }
  });

  } catch (e) {
    if (this.debugMode) console.error("[VGM] Failed to write cache metadata:", e);
    this._cacheSaveInFlight = false;
  }
	};

	VGMPlay_js.prototype._isCached = function (fingerprint) {
		return this._cacheFingerprints.has(fingerprint);
	};

	VGMPlay_js.prototype._markCached = function (fingerprint) {
		this._cacheFingerprints.add(fingerprint);
		this.zipURLLoaded.push(fingerprint);
	};

	VGMPlay_js.prototype._rebuildGameFromMeta = function (metaGame, debugMode) {
  const game = { ...metaGame };
  game._fromCache = true;

  // Ensure no broken UI state is loaded from old cache versions
  delete game.uiElement;
  delete game.trackContainer;
  delete game.playableList;
  delete game.lastRenderedCount;
  delete game._overviewImageUrl;
  delete game._overviewTile;
  if (!game.cacheHost && typeof window !== 'undefined' && window.location) {
    game.cacheHost = '';
  }

  if (game.coverPath) {
    try {
      if (FS.analyzePath(game.coverPath).exists) {
        const arr = FS.readFile(game.coverPath);
        if (debugMode) console.log('[VGM] Restoring cover from path:', game.coverPath, 'size:', arr.length);
	if (arr.length > 0) {
		if (arr.length >= 8 && arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47 && arr[4] === 0x0D && arr[5] === 0x0A && arr[6] === 0x1A && arr[7] === 0x0A) {
			game.png = new Blob([arr], { type: "image/png" });
		} else {
			this._logWarn && this._logWarn('CACHE', 'Cover file PNG signature mismatch:', game.coverPath, 'first bytes:', Array.from(arr.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '));
			game.png = null;
		}
	} else {
		this._logWarn && this._logWarn('CACHE', 'Cover file is empty:', game.coverPath);
		game.png = null;
	}
} else {
	this._logWarn && this._logWarn('CACHE', 'Cover path does not exist:', game.coverPath);
}
    } catch (e) {
      if (debugMode) console.error("[VGM] Failed to restore cover:", game.coverPath, e);
    }
  }

  return game;
};

	VGMPlay_js.prototype.clearCache = function () {
  if (!this._cacheReady) {
    if (this.debugMode) console.warn("[VGM] Cannot clear cache before it is initialized.");
    return;
  }

		try {
			// Helper to recursively delete an FS directory
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

			if (this.debugMode) console.log("[VGM] Clearing cache...");
			
			// Delete the meta directory to wipe metadata.json and covers
			rmDirRecursive('/cache/meta');
			// Delete the files directory to wipe extracted audio
			rmDirRecursive('/cache/files');

			// Recreate the root structures
			FS.mkdir('/cache/meta');
			FS.mkdir('/cache/files');

			// Reset memory state
			this._cacheFingerprints.clear();
			this.games = [];
			this.zipURLLoaded = [];
			this.amountOfGamesLoaded = 0;
			this.stop();
			
			// Force UI update
			this._scheduleZipRender();

			// Sync empty state to IndexedDB
			if (this._cacheBridgeAvailable()) {
	this._cacheBridgeRequest('clearAll').then(() => {
		this._log && this._log('CACHE', "Cache successfully cleared.");
					if (this._renderSkippedDownloads) this._renderSkippedDownloads();
					if (this._showSkippedWindow) this._showSkippedWindow();
					if (this.vgmplayContainer && this.vgmplayContainer.getRootNode) {
						this._scheduleZipRender();
					}
					if (typeof window !== 'undefined' && window.location) {
						setTimeout(() => window.location.reload(), 100);
					}
				});
				return;
			}

			FS.syncfs(false, (err) => {
    if (err) {
      if (this.debugMode) console.error("[VGM] Failed to sync cleared cache to IDBFS:", err);
		return;
	}
	this._log && this._log('CACHE', "Cache successfully cleared.");
    if (this._renderSkippedDownloads) this._renderSkippedDownloads();
    if (this._showSkippedWindow) this._showSkippedWindow();
    if (this.vgmplayContainer && this.vgmplayContainer.getRootNode) {
      // ensure UI reflects cleared state
      this._scheduleZipRender();
    }
    if (typeof window !== 'undefined' && window.location) {
      setTimeout(() => window.location.reload(), 100);
    }
	});

	} catch (e) {
		if (this.debugMode) console.error("[VGM] Error clearing cache:", e);
	}
};

VGMPlay_js.prototype._reconstructUrlFromArchiveName = function (archiveName) {
	if (!archiveName) return null;
	// If archiveName is already a full URL, return it
	if (archiveName.startsWith('http://') || archiveName.startsWith('https://')) {
		return archiveName;
	}
	// Try to reconstruct from autoScanDistBase
	if (this.autoScanDistBase && typeof window !== 'undefined') {
		const base = this.autoScanDistBase.startsWith('http') ? this.autoScanDistBase : window.location.origin + this.autoScanDistBase;
		return base + (base.endsWith('/') ? '' : '/') + archiveName;
	}
	return null;
};
}
