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

	VGMPlay_js.prototype._onArchiveWorkerMessage = function (e) {
		const msg = e.data || {};
		const job = this._archiveWorkerJobs.get(msg.id);
		if (!job) return;
		if (msg.type === 'meta') {
			job.hasKss = !!msg.hasKss;
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
			job.reject(new Error(msg.message || "Archive worker error"));
			return;
		}
		if (msg.type === 'done') {
			this._archiveWorkerJobs.delete(msg.id);
			job.resolve({
				entries: job.entries || [],
				fileDataByPath: job.fileDataByPath,
				hasKss: job.hasKss
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
    }, 120000); // 2 minute timeout for download + extraction
this._backgroundExtractJobs.set(id, { resolve, reject, timeout, fileDataByPath: new Map(), entries: [], hasKss: false });
    // Send URL instead of buffer - offscreen will download directly
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

VGMPlay_js.prototype.processZipBuffer = async function (byteArray, sourceName = '') {
if (this.debugMode) console.log('[VGM-ARCHIVES] processZipBuffer called:', sourceName, 'byteArray size:', byteArray.byteLength);
const cleanName = sourceName ? sourceName.split('?')[0].split('#')[0] : 'archive.zip';
const fingerprint = cleanName + ':' + byteArray.byteLength;

if (this._isCached && this._isCached(fingerprint)) {
  if (this.debugMode) console.log(`[VGM] Archive ${cleanName} already cached, skipping extraction.`);
  return;
}

try {
  if (this.debugMode) console.log(`[VGM] Starting zip extraction with worker for ${cleanName}`);
  const workerResult = await this._extractArchiveWithWorker(byteArray, 'zip', sourceName);
  if (this.debugMode) console.log(`[VGM] Extraction done, processing ${workerResult.fileDataByPath.size} entries for ${cleanName}`);
  await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, cleanName, workerResult.hasKss);
  if (this._markCached) this._markCached(fingerprint);
  if (this._saveCache) this._saveCache();
  return;
} catch (e) {
  if (byteArray.byteLength === 0) {
    if (this.debugMode) console.error("[VGM] Zip worker failed after buffer transfer:", e);
    return;
  }
  if (this.debugMode) console.warn("[VGM] Zip worker failed, falling back to main thread:", e);
}

		const yieldEvery = 50;
		let sinceYield = 0;
		const maybeYield = async () => {
			sinceYield++;
			if (sinceYield >= yieldEvery) {
				sinceYield = 0;
				await this._yieldToUI();
			}
		};

		this.mz = new Minizip(byteArray);
		var fileList = this.mz.list();
		const entries = Array.isArray(fileList)
			? fileList
			: (fileList && (fileList.files || fileList.filelist || fileList.entries))
				? (fileList.files || fileList.filelist || fileList.entries)
				: Object.values(fileList || {});

		let hasKss = false;
		for (const entry of entries) {
			if (!entry || !entry.filepath) continue;
			const lower = entry.filepath.toLowerCase();
			if (this._isKssFile(lower)) {
				hasKss = true;
				break;
			}
			await maybeYield();
		}

		if (!hasKss) {
			var m3uFile;
			var txtFile;
			var pngFile;
			this.amountOfGamesLoaded++;
			const gamePath = "/cache/files/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);

			for (const entry of entries) {
				if (!entry || !entry.filepath) continue;
				const relPath = entry.filepath;
				const fileArray = this.mz.extract(relPath);
				const fullPath = gamePath + "/" + relPath;

				const lastSlash = fullPath.lastIndexOf('/');
				if (lastSlash > gamePath.length) {
					this._makedirs(fullPath.substring(0, lastSlash));
				}

				entry.filepath = fullPath;
				try {
					const name = fullPath.substring(fullPath.lastIndexOf('/') + 1);
					const parent = fullPath.substring(0, fullPath.lastIndexOf('/'));
					FS.createDataFile(parent, name, fileArray, true, true);
		} catch (e) {
			if (this.debugMode) console.error("Error creating file in FS:", e);
		}
		const lower = relPath.toLowerCase();
			if (lower.includes("m3u")) m3uFile = FS.readFile(fullPath, { encoding: "utf8" });
			if (lower.endsWith(".txt") || lower.endsWith(".trackinfo") || lower.includes("gameinfo")) {
				const txt = FS.readFile(fullPath, { encoding: "utf8" });
				if (lower.includes("gameinfo")) {
					this.tempGameInfo = txt;
				} else {
					txtFile = txt;
}
}
if (lower.endsWith(".png")) {
  pngFile = new Blob([FS.readFile(fullPath)], { type: "image/png" });
  if (this.debugMode) console.log('[VGM-ARCHIVES] Found PNG in archive:', relPath, 'size:', pngFile.size);
}
await maybeYield();
}

const filteredFiles = entries.filter(e => e && e.filepath);
const hasMusLmp = filteredFiles.some(f => {
const l = (f.filepath || "").toLowerCase();
return l.endsWith('.mus') || l.endsWith('.lmp');
});
if (hasMusLmp) {
filteredFiles.sort((a, b) => {
  const nameA = (a.filepath || "").split('/').pop().toLowerCase();
  const nameB = (b.filepath || "").split('/').pop().toLowerCase();
  return nameA.localeCompare(nameB);
});
}

	const derivedName = this._deriveVgmGameName(filteredFiles, cleanName || "Archive");
	var game = { files: filteredFiles, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, name: derivedName, gameinfo: this.tempGameInfo, archiveName: cleanName, _fromCache: false };
	if (this.debugMode) console.log('[VGM-ARCHIVES] Game created:', derivedName, 'hasPNG:', !!game.png, 'pngSize:', game.png ? game.png.size : 0);
	if (this._applyExternalGameImage && sourceName) {
		this._applyExternalGameImage(game, cleanName, false);
	}
	if (this.debugMode) console.log('[VGM-ARCHIVES] After external image apply:', derivedName, 'hasPNG:', !!game.png, 'pngSize:', game.png ? game.png.size : 0);
	this.tempGameInfo = null;
	// Check for duplicate by archiveName
	const archiveNameLower = (cleanName || '').toLowerCase();
	const existingGame = this.games.find(g => g && g.archiveName && g.archiveName.toLowerCase() === archiveNameLower);
	if (existingGame) {
		this._log && this._log('ARCHIVES', 'Skipping duplicate game:', cleanName, '(already loaded as:', existingGame.name + ')');
		return;
	}
	this.games.push(game);
			this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			const hasMidi = game.files.some((f) => {
				const p = (f.filepath || "").toLowerCase();
				return (this._isMidiFile && this._isMidiFile(p)) || (this._isMidiExt && this._isMidiExt(p));
			});
			if (!hasPlayable) {
				if (hasMidi) {
					this._addNoPlayableNotice(cleanName || 'Archive', { isMidiArchive: true });
				} else {
					this._addNoPlayableNotice(cleanName || 'Archive');
				}
			}
			await this.checkEverythingReady();
			this._scheduleZipRender();
			if (this._markCached) this._markCached(fingerprint);
			if (this._saveCache) this._saveCache();
			return;
		}

		const gamesInOrder = [];
		const gamesByKey = {};

		const getGameKey = (relPath) => {
			const parts = relPath.split('/');
			if (parts.length > 1) return parts[0];
			const lower = relPath.toLowerCase();
			if (this.isPlayable(lower) || lower.endsWith('.png') || lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo')) {
				const dot = relPath.lastIndexOf('.');
				return dot > 0 ? relPath.substring(0, dot) : relPath;
			}
			return 'root';
		};

		const getRelPath = (relPath, gameKey) => {
			if (relPath.startsWith(gameKey + '/') && gameKey !== 'root') return relPath.substring(gameKey.length + 1);
			return relPath;
		};

		const getGame = (gameKey) => {
			if (gamesByKey[gameKey]) return gamesByKey[gameKey];
			this.amountOfGamesLoaded++;
			const gamePath = "/cache/files/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null, _fromCache: false };
			gamesByKey[gameKey] = game;
			gamesInOrder.push(game);
			return game;
		};

		for (const entry of entries) {
			if (!entry || !entry.filepath) continue;
			const relPath = entry.filepath;
			const fileArray = this.mz.extract(relPath);
			const gameKey = getGameKey(relPath);
			const game = getGame(gameKey);
			const gameRelPath = getRelPath(relPath, gameKey);
			const fullPath = game.path + "/" + gameRelPath;

			const lastSlash = fullPath.lastIndexOf('/');
			if (lastSlash > game.path.length) {
				this._makedirs(fullPath.substring(0, lastSlash));
			}

			entry.filepath = fullPath;
			try {
				const name = fullPath.substring(fullPath.lastIndexOf('/') + 1);
				const parent = fullPath.substring(0, fullPath.lastIndexOf('/'));
				FS.createDataFile(parent, name, fileArray, true, true);
	} catch (e) {
		this._logError && this._logError('ARCHIVES', "Error creating file in FS:", e);
	}

			game.files.push({ filepath: fullPath });

			const lower = relPath.toLowerCase();
			const isInfoFile = lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo');
			if (isInfoFile) {
				const lastSlash = relPath.lastIndexOf('/');
				const lastDot = relPath.lastIndexOf('.');
				const base = relPath.substring(lastSlash + 1, lastDot > lastSlash ? lastDot : relPath.length);
				try {
					const txt = FS.readFile(fullPath, { encoding: "utf8" });
					if (lower.includes('gameinfo')) {
						game.gameinfo = txt;
					} else {
						game.kssTxtByBase[base] = txt;
						game.kssTxtOrder.push(base);
					}
			} catch (e) {
				if (this.debugMode) console.error("Failed to read info file:", fullPath, e);
			}
			}
			if (lower.endsWith('.png') && !game.png) {
				game.png = new Blob([FS.readFile(fullPath)], { type: "image/png" });
			}
			await maybeYield();
		}

		let anyPlayable = false;
		for (const game of gamesInOrder) {
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
	if (hasPlayable) {
		// Alphabetical sorting for DOOM MUS/LMP archives
		const hasMusLmp = game.files.some(f => {
			const l = (f.filepath || "").toLowerCase();
			return l.endsWith('.mus') || l.endsWith('.lmp');
		});
		if (hasMusLmp) {
			game.files.sort((a, b) => {
				const nameA = (a.filepath || "").split('/').pop().toLowerCase();
				const nameB = (b.filepath || "").split('/').pop().toLowerCase();
				return nameA.localeCompare(nameB);
			});
		}

		const name = game.name || (game.files[0] ? game.files[0].filepath.split('/').pop().split('.')[0] : "Unknown");
		game.name = name;
		// Check for duplicate by archiveName
		const archiveNameLower = (game.archiveName || '').toLowerCase();
		const existingGame = this.games.find(g => g && g.archiveName && g.archiveName.toLowerCase() === archiveNameLower);
		if (!existingGame) {
			this.games.push(game);
			anyPlayable = true;
		} else {
			this._log && this._log('ARCHIVES', 'Skipping duplicate game:', game.archiveName, '(already loaded as:', existingGame.name + ')');
		}
	} else if (game.png && game.png.size > 0) {
		// Add game even without playable files if it has a PNG cover
		const name = game.name || (game.files[0] ? game.files[0].filepath.split('/').pop().split('.')[0] : "Unknown");
		game.name = name;
		// Check for duplicate by archiveName
		const archiveNameLower = (game.archiveName || '').toLowerCase();
		const existingGame = this.games.find(g => g && g.archiveName && g.archiveName.toLowerCase() === archiveNameLower);
		if (!existingGame) {
			this.games.push(game);
		} else {
			this._log && this._log('ARCHIVES', 'Skipping duplicate game:', game.archiveName, '(already loaded as:', existingGame.name + ')');
		}
	}
			await maybeYield();
		}

		// Sort games alphabetically
		this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

		if (!anyPlayable) {
			this._addNoPlayableNotice(cleanName || 'Archive');
		}

		await this.checkEverythingReady();
		// Clear and re-render all games to maintain sort order
		this._scheduleZipRender();
		if (this._markCached) this._markCached(fingerprint);
		if (this._saveCache) this._saveCache();
	};

VGMPlay_js.prototype.process7zBuffer = async function (byteArray, sourceName = '') {
  const cleanName = sourceName ? sourceName.split('?')[0].split('#')[0] : 'archive.7z';
  const fingerprint = cleanName + ':' + byteArray.byteLength;

if (this._isCached && this._isCached(fingerprint)) {
if (this.debugMode) console.log(`[VGM] Archive ${cleanName} already cached, skipping extraction.`);
return;
}

try {
if (this.debugMode) console.log(`[VGM] Starting 7z extraction with worker for ${cleanName}`);
const workerResult = await this._extractArchiveWithWorker(byteArray, '7z', sourceName);
if (this.debugMode) console.log(`[VGM] 7z Extraction done, processing ${workerResult.fileDataByPath.size} entries for ${cleanName}`);
await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, cleanName, workerResult.hasKss);
if (this._markCached) this._markCached(fingerprint);
if (this._saveCache) this._saveCache();
return;
} catch (e) {
if (byteArray.byteLength === 0) {
  if (this.debugMode) console.error("[VGM] 7z worker failed after buffer transfer:", e);
  return;
}
if (this.debugMode) console.warn("[VGM] 7z worker failed, falling back to main thread:", e);
}

		const sz = await SevenZip({
			locateFile: (path) => this.baseURL + path,
			print: () => { },
			printErr: () => { }
		});

		// Create a temp file in 7z-wasm's MEMFS
		const archiveName = "archive.7z";
		sz.FS.writeFile(archiveName, byteArray);

		// List files (using direct FS access if possible or calling 7zz?)
		// Actually, sevenzip-wasm usually provides a way to extract.
		// Looking at use-strict/7z-wasm, we can run commands.
		sz.callMain(["x", archiveName, "-o/out"]);

		const gamesInOrder = [];
		const gamesByKey = {};
		const allEntries = [];
		let hasKss = false;

		const getGameKey = (relPath) => {
			const parts = relPath.split('/');
			if (parts.length > 1) return parts[0];
			const lower = relPath.toLowerCase();
			if (this.isPlayable(lower) || lower.endsWith('.png') || lower.endsWith('.txt') || lower.endsWith('.trackinfo')) {
				const dot = relPath.lastIndexOf('.');
				return dot > 0 ? relPath.substring(0, dot) : relPath;
			}
			return 'root';
		};

		const getRelPath = (relPath, gameKey) => {
			if (relPath.startsWith(gameKey + '/') && gameKey !== 'root') return relPath.substring(gameKey.length + 1);
			return relPath;
		};

		// Helper: parse archive filename to extract title (before first '(')
		const parseArchiveTitle = (filename) => {
			if (!filename) return "Archive";
			// Remove extension
			let name = filename;
			const dot = name.lastIndexOf('.');
			if (dot !== -1) name = name.substring(0, dot);
			// Find first '('
			const p1 = name.indexOf('(');
			if (p1 === -1) return name.trim();
			let title = name.substring(0, p1);
			// Trim whitespace
			title = title.replace(/^\s+|\s+$/g, '');
			return title || "Archive";
		};

		const getGame = (gameKey) => {
			if (gamesByKey[gameKey]) return gamesByKey[gameKey];
			this.amountOfGamesLoaded++;
			const gamePath = "/cache/files/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const parsedName = parseArchiveTitle(sourceName);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null, archiveName: sourceName, name: parsedName, _fromCache: false };
			gamesByKey[gameKey] = game;
			gamesInOrder.push(game);
			return game;
		};

		const recurseFS = (path, relativePath = "") => {
			const entries = sz.FS.readdir(path);
			for (const entry of entries) {
				if (entry === "." || entry === "..") continue;
				const fullSZPath = path + "/" + entry;
				const fullRelPath = relativePath ? relativePath + "/" + entry : entry;
				const stat = sz.FS.stat(fullSZPath);
				if (sz.FS.isDir(stat.mode)) {
					recurseFS(fullSZPath, fullRelPath);
				} else {
					allEntries.push(fullRelPath);
					if (!hasKss && this._isKssFile(fullRelPath.toLowerCase())) {
						hasKss = true;
					}
					const data = sz.FS.readFile(fullSZPath);
					const gameKey = getGameKey(fullRelPath);
					const game = getGame(gameKey);
					const gameRelPath = getRelPath(fullRelPath, gameKey);
					const fsPath = game.path + "/" + gameRelPath;
					const lastSlash = fsPath.lastIndexOf('/');
					if (lastSlash > game.path.length) {
						this._makedirs(fsPath.substring(0, lastSlash));
					}
					const name = fsPath.substring(fsPath.lastIndexOf('/') + 1);
					const parent = fsPath.substring(0, fsPath.lastIndexOf('/'));
					FS.createDataFile(parent, name, data, true, true);
					game.files.push({ filepath: fsPath });

					const lower = fullRelPath.toLowerCase();
					if (lower.endsWith('.txt') || lower.endsWith('.trackinfo')) {
						const base = fullRelPath.substring(fullRelPath.lastIndexOf('/') + 1, fullRelPath.lastIndexOf('.'));
						const txt = FS.readFile(fsPath, { encoding: "utf8" });
						game.kssTxtByBase[base] = txt;
						game.kssTxtOrder.push(base);
					}
					if (lower.endsWith('.png') && !game.png) {
						game.png = new Blob([FS.readFile(fsPath)], { type: "image/png" });
					}
				}
			}
		};

		recurseFS("/out");

		if (!hasKss) {
			const gamePath = "/cache/files/game_" + (++this.amountOfGamesLoaded);
			this._makedirs(gamePath);
			const fileList = [];
			let m3uFile;
			let txtFile;
			let pngFile;

			for (const relPath of allEntries) {
				const data = sz.FS.readFile("/out/" + relPath);
				const fsPath = gamePath + "/" + relPath;
				const lastSlash = fsPath.lastIndexOf('/');
				if (lastSlash > gamePath.length) {
					this._makedirs(fsPath.substring(0, lastSlash));
				}
				const name = fsPath.substring(fsPath.lastIndexOf('/') + 1);
				const parent = fsPath.substring(0, fsPath.lastIndexOf('/'));
				FS.createDataFile(parent, name, data, true, true);
				fileList.push({ filepath: fsPath });
				const lower = relPath.toLowerCase();
				if (lower.includes("m3u")) m3uFile = FS.readFile(fsPath, { encoding: "utf8" });
				if (lower.endsWith(".txt") || lower.endsWith(".trackinfo")) txtFile = FS.readFile(fsPath, { encoding: "utf8" });
				if (lower.endsWith(".png")) pngFile = new Blob([FS.readFile(fsPath)], { type: "image/png" });
			}

			const parsedName = parseArchiveTitle(sourceName);
			const derivedName = this._deriveVgmGameName(fileList, parsedName);
			const game = { files: fileList, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, archiveName: sourceName, name: derivedName, _fromCache: false };

			// Alphabetical sorting for DOOM MUS/LMP archives
			const hasMusLmp = fileList.some(f => {
				const l = (f.filepath || "").toLowerCase();
				return l.endsWith('.mus') || l.endsWith('.lmp');
			});
			if (hasMusLmp) {
				fileList.sort((a, b) => {
					const nameA = (a.filepath || "").split('/').pop().toLowerCase();
					const nameB = (b.filepath || "").split('/').pop().toLowerCase();
					return nameA.localeCompare(nameB);
				});
			}

			this.games.push(game);
			const hasPlayable = fileList.some((f) => this.isPlayable(f.filepath));
			if (!hasPlayable) {
				this._addNoPlayableNotice(sourceName || 'Archive');
			}
			await this.checkEverythingReady();
			this.showVGMFromZip(game);
			if (this._markCached) this._markCached(fingerprint);
			if (this._saveCache) this._saveCache();
			return;
		}

		let anyPlayable = false;
		for (const game of gamesInOrder) {
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			if (hasPlayable) {
				// Alphabetical sorting for DOOM MUS/LMP archives
				const hasMusLmp = game.files.some(f => {
					const l = (f.filepath || "").toLowerCase();
					return l.endsWith('.mus') || l.endsWith('.lmp');
				});
				if (hasMusLmp) {
					game.files.sort((a, b) => {
						const nameA = (a.filepath || "").split('/').pop().toLowerCase();
						const nameB = (b.filepath || "").split('/').pop().toLowerCase();
						return nameA.localeCompare(nameB);
					});
				}

				this.games.push(game);
				anyPlayable = true;
			}
		}
		if (!anyPlayable) {
			this._addNoPlayableNotice(sourceName || 'Archive');
		}
		await this.checkEverythingReady();
		this._scheduleZipRender();
		if (this._markCached) this._markCached(fingerprint);
		if (this._saveCache) this._saveCache();
	};

	VGMPlay_js.prototype.processRarBuffer = async function (byteArray, sourceName = '') {
		const cleanName = sourceName ? sourceName.split('?')[0].split('#')[0] : 'archive.rar';
		const fingerprint = cleanName + ':' + byteArray.byteLength;
		if (this._isCached && this._isCached(fingerprint)) {
			if (this.debugMode) console.log(`[VGM] Archive ${cleanName} already cached, skipping extraction.`);
			return;
		}

		try {
			const workerResult = await this._extractArchiveWithWorker(byteArray, 'rar');
			await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, sourceName, workerResult.hasKss);
if (this._markCached) this._markCached(fingerprint);
if (this._saveCache) this._saveCache();
return;
} catch (e) {
if (byteArray.byteLength === 0) {
  if (this.debugMode) console.error("[VGM] RAR worker failed after buffer transfer:", e);
  return;
}
if (this.debugMode) console.warn("[VGM] RAR worker failed:", e);
}

if (this.debugMode) console.error("[VGM] RAR extraction requires the archive worker.");
};
}
