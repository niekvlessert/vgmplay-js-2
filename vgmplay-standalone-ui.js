export function installStandaloneUi(VGMPlay_js) {
    VGMPlay_js.prototype._initStandaloneUI = function (options) {
        if (this.standalone && !this.isLibrary) {
            document.documentElement.style.height = '100%';
            document.body.style.height = '100%';
            document.body.style.margin = '0';
            document.body.style.background = '#2a2a2a';
            document.body.style.overflow = 'hidden';
            this.vgmplayContainer.style.position = 'fixed';
            this.vgmplayContainer.style.top = '0';
            this.vgmplayContainer.style.left = '0';
            this.vgmplayContainer.style.width = '100vw';
            this.vgmplayContainer.style.height = '100vh';

            this.standaloneLeft = document.createElement('div');
            this.standaloneLeft.className = 'vgmplayStandaloneLeft';
            this.vgmplayContainer.appendChild(this.standaloneLeft);

            this.standaloneGroup = document.createElement('div');
            this.standaloneGroup.className = 'vgmplayStandaloneGroup';
            this.standaloneLeft.appendChild(this.standaloneGroup);

            this.standaloneRight = document.createElement('div');
            this.standaloneRight.className = 'vgmplayStandaloneRight';
            this.vgmplayContainer.appendChild(this.standaloneRight);

            this.standaloneAnalyzerEl = document.createElement('div');
            this.standaloneAnalyzerEl.className = 'vgmplayStandaloneAnalyzer';
            this.standaloneRight.appendChild(this.standaloneAnalyzerEl);

            this.standaloneGameGrid = document.createElement('div');
            this.standaloneGameGrid.className = 'vgmplayStandaloneGameGrid';
            this.standaloneRight.appendChild(this.standaloneGameGrid);

            const menuEl = document.getElementById('vgmplayMenu');
            if (menuEl) {
                menuEl.style.display = 'none';
            }

            this.standaloneOverlay = document.createElement('div');
            this.standaloneOverlay.className = 'vgmplayStandaloneOverlay';
            this.standaloneOverlay.innerHTML = `
<div class="vgmplayMemoryDisplay"></div>
<br>
<label class="vgmplayStandaloneLabel">Spectrum</label>
<select class="vgmplayStandaloneSelect">
<option value="off">Off</option>
<option value="bars">Big Bars</option>
<option value="lines">Lines</option>
<option value="dual">Dual</option>
<option value="oct6">1/6 Octave</option>
<option value="radialApple">Radial (Apple ][)</option>
<option value="linePrism">Line Prism (Dual Vertical)</option>
</select>
`;
            this.standaloneRight.appendChild(this.standaloneOverlay);
            this.standaloneSelect = this.standaloneOverlay.querySelector('.vgmplayStandaloneSelect');
            this.standaloneSelect.value = this.rightPanelMode;
            this.standaloneSelect.addEventListener('change', () => {
                this.rightPanelMode = this.standaloneSelect.value;
                this._updateStandaloneRightPanel();
            });
            this._updateStandaloneSelectOptions();

            // Memory display
            this.memoryDisplay = this.standaloneOverlay.querySelector('.vgmplayMemoryDisplay');
            if (this.memoryDisplay) this.memoryDisplay.style.display = 'none';
            this._updateMemoryDisplay();
        }

        if (this.standalone) {
            const children = Array.from(document.body.children);
            const hiddenWrapper = document.createElement('div');
            hiddenWrapper.id = 'vgmplayHiddenContent';
            hiddenWrapper.style.display = 'none';
            for (const child of children) {
                if (child !== this.vgmplayContainer) {
                    hiddenWrapper.appendChild(child);
                }
            }
            if (hiddenWrapper.childNodes.length) {
                document.body.appendChild(hiddenWrapper);
            }
        }
    };

    VGMPlay_js.prototype._updateMemoryDisplay = function () {
        if (!Module._GetFreeMemory || !Module._GetTotalMemory || !Module._GetUsedMemory || !Module._GetHeapTopUsedMemory) return;

        const usedMem = Module._GetUsedMemory();
        const freeMem = Module._GetFreeMemory();
        const totalMem = Module._GetTotalMemory();
        const heapTopUsed = Module._GetHeapTopUsedMemory();
        const heapTopFree = totalMem - heapTopUsed;

        if (this._memoryBaselineUsed === null) {
            this._memoryBaselineUsed = usedMem;
        }

        const freeMB = (freeMem / (1024 * 1024)).toFixed(2);
        const totalMB = (totalMem / (1024 * 1024)).toFixed(2);
        const usedMB = (usedMem / (1024 * 1024)).toFixed(2);
        const heapTopFreeMB = (heapTopFree / (1024 * 1024)).toFixed(2);
        const deltaMB = ((usedMem - this._memoryBaselineUsed) / (1024 * 1024)).toFixed(2);

        if (this.showMemoryStats && this.memoryOverlay) {
            this.memoryOverlay.innerHTML = `
				<div>Memory</div>
				<div>Alloc In-Use: ${usedMB} MB</div>
				<div>Alloc Free: ${freeMB} MB</div>
				<div>Heap Size: ${totalMB} MB</div>
				<div>Heap Top Free: ${heapTopFreeMB} MB</div>
				<div>Delta: ${deltaMB} MB</div>
			`;
            this.memoryOverlay.style.display = 'block';
        } else if (this.memoryOverlay) {
            this.memoryOverlay.style.display = 'none';
        }

        if (this.memoryDisplay) {
            this.memoryDisplay.textContent = `Memory: ${usedMB} MB / ${totalMB} MB (Delta: ${deltaMB} MB)`;
        }
    };

    VGMPlay_js.prototype._updateStandaloneRightPanel = function () {
        if (!this.standalone || !this.standaloneAnalyzerEl) return;
        if (this.overviewMode) {
            this.standaloneAnalyzerEl.style.display = 'none';
            if (this.standaloneOverlay) this.standaloneOverlay.style.display = 'none';
            if (this.standaloneGameGrid) this.standaloneGameGrid.style.display = 'grid';
            this._renderOverviewGrid();
            return;
        }
        if (this.standaloneGameGrid) this.standaloneGameGrid.style.display = 'none';
        if (this.standaloneOverlay) this.standaloneOverlay.style.display = '';
        const mode = this.rightPanelMode || 'bars';
        const isSpectrum = mode === 'bars' || mode === 'lines' || mode === 'dual' ||
            mode === 'oct6' || mode === 'radialApple' || mode === 'linePrism' || mode === 'prismPerChannel';

        this.standaloneAnalyzerEl.style.display = isSpectrum ? 'block' : 'none';

        if (isSpectrum) {
            if (this.isKSSActive && mode === 'prismPerChannel') {
                this.standaloneAnalyzerEl.style.display = 'flex';
                this._initKssChannelAnalyzer();
                if (this._audiomotion && typeof this._audiomotion.destroy === 'function') {
                    try { this._audiomotion.destroy(); } catch (e) { }
                    this._audiomotion = null;
                }
            } else {
                this.standaloneAnalyzerEl.style.display = 'block';
                if (this.kssAnalyzerEl) {
                    this.kssAnalyzerEl.remove();
                    this.kssAnalyzerEl = null;
                }
                this.kssAnalyzerActive = false;
                this.standaloneAnalyzerEl.classList.remove('kssActive');
                this.analyzerPreset = mode;
                this._ensureAudioMotion().then(() => {
                    this._initStandaloneAnalyzer(true);
                });
            }
            const showOverlay = this.isKSSActive && mode !== 'prismPerChannel';
            if (showOverlay) {
                this._initKssOverlay();
            } else if (this.kssOverlayEl) {
                this.kssOverlayEl.style.display = 'none';
            }
        } else if (this._audiomotion && typeof this._audiomotion.destroy === 'function') {
            try { this._audiomotion.destroy(); } catch (e) { }
            this._audiomotion = null;
            if (this.kssAnalyzerEl) this.kssAnalyzerEl.style.display = 'none';
            this.kssAnalyzerActive = false;
            this.standaloneAnalyzerEl.classList.remove('kssActive');
            if (this.kssOverlayEl) this.kssOverlayEl.style.display = 'none';
        }
    };

    VGMPlay_js.prototype._updateStandaloneSelectOptions = function () {
        if (!this.standaloneSelect) return;
        const current = this.standaloneSelect.value;
        let html = `
<option value="off">Off</option>
<option value="bars">Big Bars</option>
<option value="lines">Lines</option>
<option value="dual">Dual</option>
<option value="oct6">1/6 Octave</option>
<option value="radialApple">Radial (Apple ][)</option>
<option value="linePrism">Line Prism (Dual Vertical)</option>
`;
        if (this.isKSSActive) {
            html += `<option value="prismPerChannel">Prism per channel</option>`;
        }
        this.standaloneSelect.innerHTML = html;

        const options = Array.from(this.standaloneSelect.options).map(o => o.value);
        if (options.includes(current)) {
            this.standaloneSelect.value = current;
        } else {
            this.standaloneSelect.value = 'linePrism';
            this.rightPanelMode = 'linePrism';
        }
    };

    VGMPlay_js.prototype._initStandaloneAnalyzer = function (forceRecreate = false) {
        if (!this.standalone || !this.standaloneAnalyzerEl) return;
        if (typeof window === 'undefined' || !window.AudioMotionAnalyzer) return;
        this.standaloneAnalyzerEl.style.background = '#000';
        if (this._audiomotion && forceRecreate) {
            try {
                if (typeof this._audiomotion.destroy === 'function') {
                    this._audiomotion.destroy();
                }
            } catch (e) { }
            this._audiomotion = null;
        }
        if (this._audiomotion) return;
        const preset = this.analyzerPreset || 'dual';
        const presetOptions = {
            bars: { mode: 6, gradient: 'prism' },
            lines: { mode: 0, gradient: 'classic' },
            dual: { mode: 2, gradient: 'rainbow' },
            oct6: { mode: 4, gradient: 'classic', showScaleX: true, frequencyScale: 'log' },
            radialApple: { mode: 0, gradient: 'classic', radial: true, showScaleX: true },
            linePrism: { mode: 10, gradient: 'prism', channelLayout: 'dual-vertical', showScaleX: true, showScaleY: true }
        };
        const chosen = presetOptions[preset] || presetOptions.bars;
        try {
            this._audiomotion = new window.AudioMotionAnalyzer(this.standaloneAnalyzerEl, {
                audioCtx: this.context,
                source: this.masterGain,
                connectSpeakers: false,
                gradient: chosen.gradient,
                mode: chosen.mode,
                channelLayout: chosen.channelLayout,
                radial: !!chosen.radial,
                frequencyScale: chosen.frequencyScale,
                lineWidth: chosen.mode === 10 ? 2 : undefined,
                fillAlpha: chosen.mode === 10 ? 0 : undefined,
                barSpace: 0.2,
                showScaleX: chosen.showScaleX ?? false,
                showScaleY: chosen.showScaleY ?? false,
                bgAlpha: 1,
                overlay: false,
                showBgColor: false
            });
            if (preset === 'radialApple' && this._audiomotion.registerGradient) {
                try {
                    this._audiomotion.registerGradient('apple2', {
                        bgColor: '#000000',
                        colorStops: [
                            { color: '#00ff66' },
                            { color: '#7cff5a' },
                            { color: '#f7e45b' },
                            { color: '#ff8a5b' },
                            { color: '#5bd6ff' },
                            { color: '#00ff66' }
                        ]
                    });
                    this._audiomotion.setOptions({ gradient: 'apple2', radial: true });
                } catch (e) { }
            }
        } catch (e) {
            if (this.debugMode) console.error('[AudioMotion] init failed', e);
        }
    };

    VGMPlay_js.prototype._ensureAudioMotion = async function () {
        if (!this.standalone) return;
        if (typeof window === 'undefined') return;
        if (window.AudioMotionAnalyzer) return;
        if (!this._audioMotionLoading) {
            this._audioMotionLoading = import(this.baseURL + 'audiomotion-analyzer.js')
                .then((mod) => {
                    window.AudioMotionAnalyzer = mod.default || mod;
                })
                .catch((e) => {
                    if (this.debugMode) console.warn('[AudioMotion] failed to load', e);
                });
        }
        await this._audioMotionLoading;
    };

    VGMPlay_js.prototype._renderOverviewGrid = function () {
        if (!this.standaloneGameGrid || !this.games) return;
        this.standaloneGameGrid.innerHTML = '';
        const normalizeTitle = (value) => {
            if (!value) return value;
            if (this._normalizeGameTitle) {
                const normalized = this._normalizeGameTitle(value);
                return normalized || value;
            }
            return value;
        };

        const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
        const currentScan = this._currentScanNames || new Set();
        const normalizeArchiveName = (value) => {
            if (!value) return '';
            const base = String(value).split('?')[0].split('#')[0];
            const last = base.split('/').pop() || base;
            try { return decodeURIComponent(last).toLowerCase(); } catch (e) { return last.toLowerCase(); }
        };

        const currentSiteGames = [];
        const gamesByHost = new Map();

        for (const game of this.games) {
            if (!game || !game.files || !game.files.some((f) => f && f.filepath && this.isPlayable(String(f.filepath).toLowerCase()))) {
                continue;
            }
            const key = normalizeArchiveName(game && (game.archiveName || game.name));
            const isFromCurrentScan = key && currentScan.has(key);
            const isFromCurrentHostCache = game._fromCache && (game.cacheHost === currentHost || !game.cacheHost);

            if (isFromCurrentScan || isFromCurrentHostCache) {
                currentSiteGames.push(game);
            } else {
                const host = game.cacheHost || 'Other';
                if (!gamesByHost.has(host)) gamesByHost.set(host, []);
                gamesByHost.get(host).push(game);
            }
        }

        const createTile = (game) => {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'vgmplayOverviewTile';
            const name = normalizeTitle(game.name || game.archiveName || 'Unknown Game');

            if (game.png) {
                if (!game._overviewImageUrl) {
                    game._overviewImageUrl = URL.createObjectURL(game.png);
                }
                const img = document.createElement('img');
                img.src = game._overviewImageUrl;
                img.alt = name;
                tile.appendChild(img);
            } else {
                const text = document.createElement('div');
                text.className = 'vgmplayOverviewTileText';
                text.textContent = name;
                tile.appendChild(text);
            }

            tile.title = name;
            tile.addEventListener('click', () => {
                this.activeGame = game;
                this._applyOverviewTrackFilter();
                this._updateOverviewGridSelection();
                if (game.uiElement) {
                    game.uiElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            game._overviewTile = tile;
            return tile;
        };

        for (const game of currentSiteGames) {
            const tile = createTile(game);
            this.standaloneGameGrid.appendChild(tile);
        }

        const otherHosts = Array.from(gamesByHost.keys()).sort();
        for (const host of otherHosts) {
            const games = gamesByHost.get(host);
            if (!games.length) continue;

            if (currentSiteGames.length > 0 || otherHosts.indexOf(host) > 0) {
                const label = document.createElement('div');
                label.className = 'vgmplayGridSeparatorLabel';
                label.textContent = `Cached from: ${host} `;
                this.standaloneGameGrid.appendChild(label);
                const separator = document.createElement('div');
                separator.className = 'vgmplayGridSeparator';
                this.standaloneGameGrid.appendChild(separator);
            }

            for (const game of games) {
                const tile = createTile(game);
                this.standaloneGameGrid.appendChild(tile);
            }
        }

        this._updateOverviewGridSelection();
        if (this.overviewMode) {
            this._applyOverviewTrackFilter();
        }
    };
}
