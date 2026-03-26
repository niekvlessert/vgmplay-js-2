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

	VGMPlay_js.prototype._shouldDownload = async function (url, forceLarge) {
		if (forceLarge) return true;
		if (this.standalone) return true;
		const size = await this._getRemoteFileSize(url);
		if (!size || size <= this.largeDownloadLimitBytes) return true;
		this._addSkippedDownload(url, size);
		return false;
	};

	VGMPlay_js.prototype._queueURL = function (url, forceLarge = false, isAuto = false) {
		const filename = this._getFileNameFromUrl(url);
		if (this.zipURLLoaded.some(u => u === url || u.startsWith(filename + ':'))) return;
		if (this.zipURLPending.includes(url)) return;
		if (isAuto && this.autoDownloadCount >= this.autoDownloadLimit) {
			this._queueAutoOverflow(url, null);
			return;
		}
		this.zipURLPending.push(url);
		this.zipQueue.push({ type: 'url', data: url, forceLarge, name: this._getFileNameFromUrl(url) });
		if (isAuto) this.autoDownloadCount++;
		this._processQueue();
	};

	VGMPlay_js.prototype._queueAutoOverflow = function (url, sizeBytes = null) {
		if (!this.autoOverflowURLs.includes(url)) {
			this.autoOverflowURLs.push(url);
			if (this.autoOverflowSizes) {
				this.autoOverflowSizes.set(url, sizeBytes);
			}
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
		this._checkLargeOverflow(url);
	};

	VGMPlay_js.prototype._queueAutoURL = async function (url, forceLarge = false, opts = {}) {
		const filename = this._getFileNameFromUrl(url);
		if (this.zipURLLoaded.some(u => u === url || u.startsWith(filename + ':'))) return false;
		if (this.zipURLPending.includes(url)) return false;

		let sizeBytes = (typeof opts.sizeBytes === 'number') ? opts.sizeBytes : null;
		if (sizeBytes == null && !this.standalone) {
			sizeBytes = await this._getRemoteFileSize(url);
		}

		if (!this.standalone && sizeBytes != null && this._isCached) {
			const fingerprint = filename + ':' + sizeBytes;
			if (this._isCached(fingerprint)) {
				if (!this._cacheRestoredFingerprints || !this._cacheRestoredFingerprints.has(fingerprint)) {
					this.autoCacheHits = (this.autoCacheHits || 0) + 1;
				}
				return false;
			}
		}

		const ignoreLimit = !!opts.ignoreLimit;
		const canDownload = ignoreLimit || this.standalone || (this.autoDownloadCount < this.autoDownloadLimit || this.autoDownloadBytes < this.autoDownloadBytesLimit);
		if (!canDownload) {
			this._queueAutoOverflow(url, sizeBytes);
			return false;
		}

		this.zipURLPending.push(url);
		this.zipQueue.push({ type: 'url', data: url, forceLarge, name: filename });
		this.autoDownloadCount = (this.autoDownloadCount || 0) + 1;
		if (sizeBytes != null) {
			this.autoDownloadBytes = (this.autoDownloadBytes || 0) + sizeBytes;
		}
		this._processQueue();
		return true;
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

		const next = () => {
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
									classContext.process7zBuffer(byteArray, job.name).then(next);
								} else if (lower.endsWith('.rar')) {
									classContext.processRarBuffer(byteArray, job.name).then(next);
								} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
									classContext.processPSFBuffer(byteArray, job.data).then(next);
								} else if (lower.endsWith('.zip')) {
									classContext.processZipBuffer(byteArray, job.name).then(next);
								} else {
									classContext.processSingleBuffer(byteArray, job.name).then(next);
								}
								classContext.zipURLLoaded.push(job.data);
							} else {
    if (this.debugMode) console.error("Failed to load archive from URL:", job.data);
    next();
  }
							classContext.zipURLPending = classContext.zipURLPending.filter((u) => u !== job.data);
						}
					}
					xhr.open('GET', job.data, true);
					xhr.send(null);
				});
			} else if (job.type === 'file') {
				const lower = (job.name || '').toLowerCase();
				if (lower.endsWith('.7z')) {
					classContext.process7zBuffer(job.data, job.name).then(next);
				} else if (lower.endsWith('.rar')) {
					classContext.processRarBuffer(job.data, job.name).then(next);
				} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
					classContext.processPSFBuffer(job.data, job.name).then(next);
				} else if (lower.endsWith('.zip')) {
					classContext.processZipBuffer(job.data, job.name).then(next);
				} else {
					classContext.processSingleBuffer(job.data, job.name).then(next);
				}
			}
		});
	};
}
