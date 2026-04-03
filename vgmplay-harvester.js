export function installHarvester(VGMPlay_js) {
    console.log('[VGM Harvester] Installing harvester module...');
    VGMPlay_js.prototype.loadWhenReady = async function () {
        if (this.debugMode) console.log('[VGM Harvester] loadWhenReady called');

        // Wait for cache restoration before filtering.
        // If _cacheInitPromise doesn't exist yet (audio init hasn't run), start it ourselves.
        if (this._initCache && !this._cacheInitPromise) {
            if (this.debugMode) console.log('[VGM Debug] loadWhenReady: _cacheInitPromise not set yet, starting _initCache now');
            this._cacheInitPromise = this._initCache().catch(e => {
                if (this.debugMode) console.warn('[VGM Debug] _initCache error in harvester:', e);
            });
        }
        if (this._cacheInitPromise) {
            if (this.debugMode) console.log('[VGM Debug] loadWhenReady: awaiting _cacheInitPromise...');
            try { await this._cacheInitPromise; } catch (e) { }
            if (this.debugMode) console.log('[VGM Debug] loadWhenReady: cache init done, _processedURLs size:', this._processedURLs ? this._processedURLs.size : 'N/A');
        } else {
            if (this.debugMode) console.log('[VGM Debug] loadWhenReady: no _cacheInitPromise available, skipping cache wait');
        }

        const scanNames = new Set();
        const candidates = [];
        this.elms = document.getElementsByTagName("a");
        this.len = this.elms.length;
        for (var ii = 0; ii < this.len; ii++) {
            const lower = this.elms[ii].href.toLowerCase();
            let rawName = '';
            try { rawName = this.elms[ii].href.split('/').pop().split('?')[0].split('#')[0]; } catch (e) { }
            let decodedName = rawName;
            try { decodedName = decodeURIComponent(rawName); } catch (e) { }
            if (decodedName) scanNames.add(decodedName.toLowerCase());

            const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
            const isPlayable = this.isPlayable ? this.isPlayable(lower) : false;
            const isExtImage = this._isExternalGameImage ? this._isExternalGameImage(decodedName || rawName) : false;
            if (isExtImage) {
                const url = this.elms[ii].href;
                if (this._fetchUrlAsUint8) {
                    this._fetchUrlAsUint8(url).then((bytes) => {
                        if (!bytes) return;
                        this._registerExternalGameImage(decodedName || rawName || url, bytes);
                        this._applyExternalGameImageToExistingGames(decodedName || rawName || url);
                    });
                }
                continue;
            }

            if (this._isArchiveUrl(lower) || isPlayable || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.usflib') || lower.endsWith('.mus') || lower.endsWith('.lmp') || isMidi) {
                const url = this.elms[ii].href;
                candidates.push({ url, name: decodedName || rawName || url });
            }
        }

        this._currentScanNames = scanNames;
        this.lastHarvestedCandidates = candidates;

        // Filter to only new candidates not already loaded, pending, or in cache
        if (this.debugMode) console.log('[VGM Debug] loadWhenReady: total candidates found:', candidates.length, '_processedURLs size:', this._processedURLs ? this._processedURLs.size : 'N/A', 'zipURLLoaded:', this.zipURLLoaded.length);
        const newCandidates = candidates.filter(c => {
            const filename = this._getFileNameFromUrl(c.url);
            const alreadyLoaded = this.zipURLLoaded.some(u => u === c.url || u.startsWith(filename + ':'));
            const alreadyPending = this.zipURLPending.includes(c.url);
            const inCache = this._isUrlInCache && this._isUrlInCache(c.url);
            if (this.debugMode) console.log('[VGM Debug] candidate filter:', c.url, '-> alreadyLoaded:', alreadyLoaded, 'alreadyPending:', alreadyPending, 'inCache:', inCache);
            return !alreadyLoaded && !alreadyPending && !inCache;
        });
        if (this.debugMode) console.log('[VGM Debug] loadWhenReady: newCandidates after filter:', newCandidates.length);

        if (candidates.length === 0) {
            // No music links found on this page at all
            if (this._addInfoNotice) this._addInfoNotice('No music found on this page.');
        } else {
            // Clear any previous "no music" notice (games exist or candidates remain)
            if (this._removeInfoNotice) this._removeInfoNotice('No music found on this page.');
        }

        if (newCandidates.length > 0) {
            const limit = this.largeDownloadLimitBytes || (7.5 * 1024 * 1024);
            Promise.all(newCandidates.map(c => this._fetchUrlSize(c.url).then(size => { c.sizeBytes = size; return c; }))).then(sizedCandidates => {
                if (sizedCandidates.length > 10) {
                    if (this.debugMode) console.log('[VGM Debug] _showBulkLoadPrompt triggered from: too-many path, count:', sizedCandidates.length, sizedCandidates.map(c => c.url));
                    this._showBulkLoadPrompt(sizedCandidates);
                    if (this._renderZipGamesNow) this._renderZipGamesNow();
                    return;
                }
                const autoLoad = [];
                const tooBig = [];
                sizedCandidates.forEach(c => {
                    if (c.sizeBytes == null || c.sizeBytes <= limit) {
                        autoLoad.push(c);
                    } else {
                        tooBig.push(c);
                    }
                });

                autoLoad.forEach(c => {
                    this._queueURL(c.url, false);
                    if (this._isArchiveUrl(c.url.toLowerCase())) this._tryFetchMatchingImageForArchive(c.url);
                });

                if (tooBig.length > 0) {
                    if (this.debugMode) console.log('[VGM Debug] _showBulkLoadPrompt triggered from: tooBig path, count:', tooBig.length, tooBig.map(c => c.url));
                    this._showBulkLoadPrompt(tooBig);
                }

                if (this._renderZipGamesNow) this._renderZipGamesNow();
            });
        } else {
            if (this._renderZipGamesNow) this._renderZipGamesNow();
        }
        if (this.setKeyBindings) {
            this.setKeyBindings();
        }

        // Show debug notice in the additional information window
        if (this.debugMode && this._addInfoNotice) {
            setTimeout(() => {
                this._addInfoNotice("Debug is enabled, press D to toggle");
            }, 1000);
        }
    };




    VGMPlay_js.prototype.addHarvestedTracks = function (urls) {
        const candidates = [];
        urls.forEach(url => {
            candidates.push({ url, name: this._getFileNameFromUrl(url) });
            const lower = url.toLowerCase();
            const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
            if (this._isArchiveUrl(lower) || this.isPlayable(lower) || isMidi) {
                this._queueURL(url, false, true);
                // Try to fetch matching image for archives
                if (this._isArchiveUrl(lower)) {
                    this._tryFetchMatchingImageForArchive(url);
                }
            } else if (this.isPlayable(lower)) {
                // Handle direct links as single files
                this._queueURL(url, false, true);
            }
        });
        this.lastHarvestedCandidates = candidates;
    };

    VGMPlay_js.prototype._fetchUrlSize = function (url) {
        return new Promise((resolve) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                resolve(null);
                return;
            }
            chrome.runtime.sendMessage({ type: 'vgm-fetch', action: 'getSize', payload: { url } }, (resp) => {
                if (chrome.runtime.lastError || !resp || typeof resp.size !== 'number') {
                    resolve(null);
                } else {
                    resolve(resp.size);
                }
            });
        });
    };

    VGMPlay_js.prototype._formatSize = function (bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `(${bytes} B)`;
        if (bytes < 1024 * 1024) return `(${(bytes / 1024).toFixed(1)} KB)`;
        return `(${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
    };

    VGMPlay_js.prototype._showBulkLoadPrompt = function (candidates) {
        if (this.debugMode) console.log('[VGM Harvester] _showBulkLoadPrompt called with', candidates.length, 'candidates');
        if (this._bulkLoadPromptVisible) return;
        this._bulkLoadPromptVisible = true;
        const root = this.vgmplayContainer || document.body;
        const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
        let win = uiRoot.getElementById('vgmplay-bulk-load-prompt');

        // Remove existing window to ensure fresh state each time
        if (win) {
            win.remove();
        }

        win = document.createElement('div');
        win.id = 'vgmplay-bulk-load-prompt';
        win.className = 'vgmplaySkippedWindow';
        win.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
            `;

        const header = document.createElement('div');
        header.className = 'vgmplaySkippedHeader';
        header.innerHTML = `
                <span class="vgmplaySkippedTitle">MORE/BIGGER GAMES DETECTED</span>
                <button class="vgmplaySkippedClose" title="Close">×</button>
            `;
        const closeBtn = header.querySelector('.vgmplaySkippedClose');
        closeBtn.onclick = () => {
            // Need to remove candidates from lastHarvestedCandidates so they populate in Additional Info
            this._hideBulkLoadPrompt();
        };
        win.appendChild(header);

        const btnContainer = document.createElement('div');
        btnContainer.className = 'vgmplaySkippedAutoActions';
        btnContainer.style.marginBottom = '16px';
        btnContainer.style.flexWrap = 'wrap';
        btnContainer.style.display = 'grid';
        btnContainer.style.gridTemplateColumns = '1fr 1fr';
        btnContainer.style.gap = '8px';

        const loadAllBtn = document.createElement('button');
        loadAllBtn.className = 'vgmplaySkippedLoadAll';
        loadAllBtn.textContent = 'Download All';
        loadAllBtn.onclick = () => {
            candidates.forEach(c => {
                this._queueURL(c.url, true);
                if (this._isArchiveUrl(c.url.toLowerCase())) this._tryFetchMatchingImageForArchive(c.url);
            });
            this._hideBulkLoadPrompt();
        };
        btnContainer.appendChild(loadAllBtn);

        const filterBtnWrapper = document.createElement('div');
        filterBtnWrapper.style.display = 'flex';
        filterBtnWrapper.style.gap = '4px';

        const filterBtn = document.createElement('button');
        filterBtn.className = 'vgmplaySkippedLoadMore';
        filterBtn.textContent = 'Download < ';
        filterBtn.style.flex = '1';

        const filterSelect = document.createElement('select');
        filterSelect.style.background = '#444';
        filterSelect.style.color = 'white';
        filterSelect.style.border = '1px solid #666';
        filterSelect.style.borderRadius = '3px';
        [1, 2, 5, 10, 25, 50, 100, 500].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = `${val} MB`;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = '1';

        filterBtn.onclick = () => {
            const thresholdBytes = parseInt(filterSelect.value, 10) * 1024 * 1024;
            const toDownload = candidates.filter(c => c.sizeBytes != null && c.sizeBytes < thresholdBytes);
            toDownload.forEach(c => {
                this._queueURL(c.url, true);
                if (this._isArchiveUrl(c.url.toLowerCase())) this._tryFetchMatchingImageForArchive(c.url);
            });
            this._hideBulkLoadPrompt();
        };

        filterBtnWrapper.appendChild(filterBtn);
        filterBtnWrapper.appendChild(filterSelect);
        btnContainer.appendChild(filterBtnWrapper);

        const randomBtn = document.createElement('button');
        randomBtn.className = 'vgmplaySkippedLoadMore';
        randomBtn.textContent = 'Download 10 Random';
        randomBtn.onclick = () => {
            const shuffled = [...candidates].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 10);
            selected.forEach(c => {
                this._queueURL(c.url, true);
                if (this._isArchiveUrl(c.url.toLowerCase())) this._tryFetchMatchingImageForArchive(c.url);
            });
            this._hideBulkLoadPrompt();
        };
        btnContainer.appendChild(randomBtn);

        win.appendChild(btnContainer);

        const listContainer = document.createElement('div');
        listContainer.id = 'vgmplay-bulk-list-container';
        listContainer.className = 'vgmplaySkippedList';
        listContainer.style.display = 'block';
        listContainer.style.maxHeight = '300px';

        const listHeader = document.createElement('div');
        listHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 5px; color: #fff;';

        const selectAllLabel = document.createElement('label');
        selectAllLabel.style.cssText = 'display: flex; align-items: center; cursor: pointer; font-size: 12px; color: #aaa;';
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.style.marginRight = '6px';
        selectAllCheckbox.onchange = () => {
            const cbs = listContainer.querySelectorAll('.vgmplay-bulk-cb');
            cbs.forEach(cb => cb.checked = selectAllCheckbox.checked);
        };
        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode('Select All'));
        listHeader.appendChild(selectAllLabel);
        listContainer.appendChild(listHeader);

        candidates.forEach((c, idx) => {
            const item = document.createElement('div');
            item.className = 'vgmplaySkippedRow';
            item.style.cursor = 'pointer';

            const firstCol = document.createElement('div');
            firstCol.style.display = 'flex';
            firstCol.style.alignItems = 'center';
            firstCol.style.overflow = 'hidden';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'vgmplay-bulk-cb';
            cb.dataset.url = c.url;
            cb.style.marginRight = '8px';
            cb.style.flexShrink = '0';
            firstCol.appendChild(cb);

            const text = document.createElement('div');
            text.className = 'vgmplaySkippedName';
            text.textContent = c.name;
            text.onclick = (e) => { e.preventDefault(); cb.checked = !cb.checked; };
            firstCol.appendChild(text);

            item.appendChild(firstCol);

            const sizeSpan = document.createElement('div');
            sizeSpan.id = `vgmplay-bulk-size-${idx}`;
            sizeSpan.className = 'vgmplaySkippedSize';
            sizeSpan.style.textAlign = 'right';
            sizeSpan.style.minWidth = '60px';

            if (c.sizeBytes !== undefined) {
                sizeSpan.textContent = c.sizeBytes != null ? this._formatSize(c.sizeBytes) : '(unknown size)';
            } else {
                sizeSpan.textContent = '...';
                this._fetchUrlSize(c.url).then(size => {
                    c.sizeBytes = size;
                    const s = uiRoot.getElementById(`vgmplay-bulk-size-${idx}`);
                    if (s) s.textContent = size ? this._formatSize(size) : '(unknown size)';
                });
            }

            item.appendChild(sizeSpan);
            listContainer.appendChild(item);
        });

        win.appendChild(listContainer);

        const downloadSelectedContainer = document.createElement('div');
        downloadSelectedContainer.className = 'vgmplaySkippedAutoActions';
        downloadSelectedContainer.style.marginTop = '16px';
        downloadSelectedContainer.style.display = 'flex';

        const downloadSelectedBtn = document.createElement('button');
        downloadSelectedBtn.id = 'vgmplay-bulk-download-selected';
        // Mimic green active button look for download selected
        downloadSelectedBtn.style.cssText = 'flex: 1; padding: 8px; background: #00ff66; color: #000; font-weight: bold; border: 1px solid #00ff66; border-radius: 4px; cursor: pointer;';
        downloadSelectedBtn.textContent = 'Download Selected';
        downloadSelectedBtn.onclick = () => {
            const cbs = listContainer.querySelectorAll('.vgmplay-bulk-cb:checked');
            cbs.forEach(cb => {
                const url = cb.dataset.url;
                this._queueURL(url, true);
                if (this._isArchiveUrl(url.toLowerCase())) this._tryFetchMatchingImageForArchive(url);
            });
            this._hideBulkLoadPrompt();
        };
        downloadSelectedContainer.appendChild(downloadSelectedBtn);
        win.appendChild(downloadSelectedContainer);

        root.appendChild(win);

        win.style.display = 'flex';
    };

    VGMPlay_js.prototype._hideBulkLoadPrompt = function () {
        this._bulkLoadPromptVisible = false;
        const root = this.vgmplayContainer || document.body;
        const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
        const win = uiRoot.getElementById('vgmplay-bulk-load-prompt');
        if (win) win.style.display = 'none';
        // Re-render Additional Information so the "Download more" button now appears
        if (this._renderSkippedDownloads) this._renderSkippedDownloads();
    };
}
