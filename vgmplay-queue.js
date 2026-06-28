export function installQueue(VGMPlay_js) {
	VGMPlay_js.prototype._getRemoteFileSize = async function (url) {
		try {
			const res = await fetch(url, { method: 'HEAD' });
			if (!res.ok) return null;
			const len = res.headers.get('content-length');
			if (!len) return null;
			const size = parseInt(len, 10);
			if (!Number.isFinite(size)) return null;
			return size;
		} catch (e) {
			return null;
		}
	};

	VGMPlay_js.prototype._formatMB = function (bytes) {
		const mb = bytes / (1024 * 1024);
		const rounded = Math.round(mb * 10) / 10;
		return (rounded % 1 === 0) ? String(rounded.toFixed(0)) : String(rounded);
	};

	// Mark queue module as ready on prototype so instance can process pending URLs
	VGMPlay_js.prototype._queueModuleReady = true;

	VGMPlay_js.prototype._shouldDownload = async function (url, forceLarge) {
		if (forceLarge) return true;
		if (this.standalone) return true;
		const size = await this._getRemoteFileSize(url);
		// Silently skip large files — the harvester prompt handles them
		if (!size || size <= this.largeDownloadLimitBytes) return true;
		return false;
	};

	VGMPlay_js.prototype._queueURL = function (url, forceLarge = false) {
		const filename = this._getFileNameFromUrl(url);
		if (this.zipURLLoaded.some(u => u === url || u.startsWith(filename + ':'))) return;
		if (this.zipURLPending.includes(url)) return;
		this.zipURLPending.push(url);
		this.zipQueue.push({ type: 'url', data: url, forceLarge, name: filename });
		this._processQueue();
	};

	VGMPlay_js.prototype._checkLargeOverflow = async function (url) {
		if (this.standalone) return;
		const size = await this._getRemoteFileSize(url);
		if (!size || size <= this.largeDownloadLimitBytes) return;
		this._addSkippedDownload(url, size);
	};

	VGMPlay_js.prototype.loadVGMFromURL = function (url) {
		return new Promise((resolve, reject) => {
			const parts = url.split('/');
			const originalFilename = parts[parts.length - 1].split('?')[0].split('#')[0];
			const destPath = "/" + (originalFilename || "remote_file.vgm");

			try {
				FS.unlink(destPath);
			} catch (err) { }

			var xhr = new XMLHttpRequest();
			xhr.responseType = "arraybuffer";

			const classContext = this;
			classContext._shouldDownload(url, false).then((ok) => {
				if (!ok) {
					resolve(null);
					return;
				}
				xhr.onreadystatechange = function () {
					if (xhr.readyState == XMLHttpRequest.DONE) {
						if (xhr.status === 200) {
							var arrayBuffer = xhr.response;
							var byteArray = new Uint8Array(arrayBuffer);
							try {
								FS.createDataFile("/", originalFilename || "remote_file.vgm", byteArray, true, true);
								resolve(destPath);
							} catch (e) {
								if (this.debugMode) console.error("FS Error loading direct file:", e);
								resolve(null);
							}
						} else {
							resolve(null);
						}
					}
				}
				xhr.open('GET', url, true);
				xhr.send(null);
			});
		});
	};

	VGMPlay_js.prototype.loadZIPWithVGMFromURL = function (url, forceLarge = false) {
		this._queueURL(url, forceLarge);
	};

	VGMPlay_js.prototype._processQueue = function () {
		if (this.isProcessingQueue || this.zipQueue.length === 0) {
			if (this.loader && this.zipQueue.length === 0) this.loader.style.display = 'none';
			if (this.zipQueue.length === 0) this._setInfoLoading(false);
			return;
		}

		if (this.loader) this.loader.style.display = 'block';
		this._setInfoLoading(true);

		this.isProcessingQueue = true;
		const job = this.zipQueue.shift();
		this._manualUploadMode = !!job.isManualUpload;

		const next = () => {
			this._manualUploadMode = false;
			this.isProcessingQueue = false;
			if (this.zipQueue.length === 0) this._setInfoLoading(false);
			if (this.zipQueue.length === 0 && this.pendingZipRender) {
				this.pendingZipRender = false;
				this._renderZipGamesNow();
			}
			// Yield to UI before next job
			setTimeout(() => this._processQueue(), 100);
		};

		const classContext = this;
		const finishJobPromise = (promise, label) => {
			Promise.resolve(promise).then(next).catch((err) => {
				console.error('[VGM] Archive queue job failed:', label || job.name || job.data, err);
				next();
			});
		};
		this.checkEverythingReady().then(() => {
			if (job.type === 'url') {
				classContext._shouldDownload(job.data, job.forceLarge).then((ok) => {
					if (!ok) {
						classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
						next();
						return;
					}
					var xhr = new XMLHttpRequest();
					xhr.responseType = "arraybuffer";
					xhr.onreadystatechange = function () {
						if (xhr.readyState == XMLHttpRequest.DONE) {
							if (xhr.status === 200) {
								var arrayBuffer = xhr.response;
								var byteArray = new Uint8Array(arrayBuffer);
								const lower = job.data.toLowerCase();
								if (lower.endsWith('.7z')) {
									finishJobPromise(classContext.process7zBuffer(byteArray, job.data), job.data);
								} else if (lower.endsWith('.rar') || lower.endsWith('.rsn') || lower.endsWith('.cbr')) {
									if (typeof classContext.processRarBuffer === 'function') {
										finishJobPromise(classContext.processRarBuffer(byteArray, job.data), job.data);
									} else {
										console.error('[VGM] processRarBuffer is not available. Archive modules may not be loaded yet.');
										next();
									}
								} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.ssf') || lower.endsWith('.minissf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
									finishJobPromise(classContext.processPSFBuffer(byteArray, job.data), job.data);
								} else if (lower.endsWith('.zip')) {
									finishJobPromise(classContext.processZipBuffer(byteArray, job.data), job.data);
								} else {
									finishJobPromise(classContext.processSingleBuffer(byteArray, job.name || job.data), job.name || job.data);
								}
								classContext.zipURLLoaded.push(job.data);
							} else {
								if (this.debugMode) console.error("Failed to load archive from URL:", job.data);
								next();
							}
							classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
						}
					}
					xhr.onerror = function () {
						console.error('[VGM] Network error loading archive:', job.data);
						classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
						next();
					};
					xhr.ontimeout = function () {
						console.error('[VGM] Timeout loading archive:', job.data);
						classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
						next();
					};
					xhr.open('GET', job.data, true);
					xhr.send(null);
				}).catch((err) => {
					console.error('[VGM] Download check failed:', job.data, err);
					classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
					next();
				});
			} else if (job.type === 'file') {
				const lower = (job.name || '').toLowerCase();
				if (lower.endsWith('.7z')) {
					finishJobPromise(classContext.process7zBuffer(job.data, job.name), job.name);
				} else if (lower.endsWith('.rar') || lower.endsWith('.rsn') || lower.endsWith('.cbr')) {
					if (typeof classContext.processRarBuffer === 'function') {
						finishJobPromise(classContext.processRarBuffer(job.data, job.name), job.name);
					} else {
						console.error('[VGM] processRarBuffer is not available. Archive modules may not be loaded yet.');
						next();
					}
				} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.ssf') || lower.endsWith('.minissf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
					finishJobPromise(classContext.processPSFBuffer(job.data, job.name), job.name);
				} else if (lower.endsWith('.zip')) {
					finishJobPromise(classContext.processZipBuffer(job.data, job.name), job.name);
				} else {
					finishJobPromise(classContext.processSingleBuffer(job.data, job.name), job.name);
				}
			}
		}).catch((err) => {
			console.error('[VGM] Queue initialization failed:', err);
			classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
			next();
		});
	};
}
