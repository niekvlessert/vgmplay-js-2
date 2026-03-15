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

			if (meta.version !== 1) {
				console.warn("[VGM] Cache version mismatch, ignoring cache");
				return;
			}

			// Restore fingerprints
			if (meta.fingerprints) {
				meta.fingerprints.forEach(f => this._cacheFingerprints.add(f));
				meta.fingerprints.forEach(f => this.zipURLLoaded.push(f)); // Also add to zipURLLoaded so it's not downloaded
			}

			// Restore games
			if (meta.games && Array.isArray(meta.games)) {
				this.games = meta.games.map(g => this._rebuildGameFromMeta(g));
			}

			if (typeof meta.amountOfGamesLoaded !== 'undefined') {
				this.amountOfGamesLoaded = meta.amountOfGamesLoaded;
			}

			if (this.games.length > 0) {
				if (this.debugMode) console.log(`[VGM] Restored ${this.games.length} games from cache`);
				this._scheduleZipRender();
			}

		} catch (e) {
			console.error("[VGM] Failed to parse cache metadata:", e);
		}
	};

	VGMPlay_js.prototype._saveCache = async function () {
		if (!this._cacheReady) return;

		try {
			if (!FS.analyzePath('/cache/meta').exists) {
				FS.mkdir('/cache/meta');
			}

			const gamesToSave = [];
			const conversionPromises = [];

			this.games.forEach((g, i) => {
				const gCopy = { ...g };
				
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
				version: 1,
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
			});

		} catch (e) {
			console.error("[VGM] Failed to write cache metadata:", e);
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
				} else {
					console.log("[VGM] Cache successfully cleared.");
				}
			});

		} catch (e) {
			console.error("[VGM] Error clearing cache:", e);
		}
	};
}
