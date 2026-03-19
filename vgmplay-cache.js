export function installCache(VGMPlay_js) {
	VGMPlay_js.prototype._initCache = function () {
		return new Promise((resolve) => {
			this._cacheFingerprints = new Set();
			this._cacheReady = false;

			try {
				if (!FS.analyzePath('/cache').exists) {
					FS.mkdir('/cache');
				}
				if (!FS.analyzePath('/cache/files').exists) {
					FS.mkdir('/cache/files');
				}
				if (!FS.analyzePath('/cache/meta').exists) {
					FS.mkdir('/cache/meta');
				}
				FS.mount(FS.filesystems.IDBFS, {}, '/cache');
				
				FS.syncfs(true, (err) => {
					if (err) {
						console.error("[VGM] Failed to sync IDBFS (read):", err);
						resolve();
						return;
					}

					this._cacheReady = true;
					this._restoreCache();
					resolve();
				});
			} catch (e) {
				console.error("[VGM] Failed to init IDBFS:", e);
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
				console.warn("[VGM] Cache version mismatch, clearing cache");
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
					const rebuilt = this._rebuildGameFromMeta(g);
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
					console.warn("[VGM] Cached files missing, clearing cache");
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
			console.error("[VGM] Failed to parse cache metadata:", e);
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
								console.error("[VGM] Failed to write cover file:", coverPath, e);
							}
							resolve();
						};
						reader.onerror = () => {
							console.error("[VGM] Failed to read cover Blob:", coverPath);
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

				gamesToSave.push(gCopy);
			});

			// Wait for all covers to be written to MEMFS
			if (conversionPromises.length > 0) {
				await Promise.all(conversionPromises);
			}

			const meta = {
				version: 2,
				cacheHost: currentHost || '',
				amountOfGamesLoaded: this.amountOfGamesLoaded,
				fingerprints: Array.from(this._cacheFingerprints),
				games: gamesToSave
			};

			FS.writeFile('/cache/meta/metadata.json', JSON.stringify(meta));

			FS.syncfs(false, (err) => {
				if (err) {
					console.error("[VGM] Failed to sync IDBFS (write):", err);
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
			console.error("[VGM] Failed to write cache metadata:", e);
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

	VGMPlay_js.prototype._rebuildGameFromMeta = function (metaGame) {
		const game = { ...metaGame };

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
					game.png = new Blob([arr], { type: "image/png" });
				}
			} catch (e) {
				console.error("[VGM] Failed to restore cover:", game.coverPath, e);
			}
		}

		return game;
	};

	VGMPlay_js.prototype.clearCache = function () {
		if (!this._cacheReady) {
			console.warn("[VGM] Cannot clear cache before it is initialized.");
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

			if (this.debugMode) console.log("[VGM] Clearing IDBFS cache...");
			
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
			FS.syncfs(false, (err) => {
				if (err) {
					console.error("[VGM] Failed to sync cleared cache to IDBFS:", err);
					return;
				}
				console.log("[VGM] Cache successfully cleared.");
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
			console.error("[VGM] Error clearing cache:", e);
		}
	};
}
