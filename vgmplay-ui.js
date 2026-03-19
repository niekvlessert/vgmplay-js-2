export function installUi(VGMPlay_js) {
	VGMPlay_js.prototype._initMobileUI = function () {
		if (!this.standalone || !this.vgmplayContainer || this._mobileInited) return;
		this._mobileInited = true;
		this.mobileToggleBtn = document.createElement('button');
		this.mobileToggleBtn.className = 'vgmplayMobileToggle';
		this.mobileToggleBtn.textContent = 'P';
		this.mobileToggleBtn.title = 'Show Player';
		this.mobileToggleBtn.addEventListener('click', () => {
			this._setMobileView('ui');
		});
		this.vgmplayContainer.appendChild(this.mobileToggleBtn);

		const reset = () => this._resetMobileIdleTimer();
		['touchstart', 'mousedown', 'keydown'].forEach((evt) => {
			window.addEventListener(evt, reset, { passive: true });
		});
	};

	VGMPlay_js.prototype._setMobileView = function (mode) {
		if (!this.isMobile || !this.vgmplayContainer) return;
		const analyzerOnly = mode === 'analyzer';
		this.vgmplayContainer.classList.toggle('vgmplayMobileAnalyzerOnly', analyzerOnly);
		if (this.mobileToggleBtn) {
			this.mobileToggleBtn.style.display = analyzerOnly ? 'block' : 'none';
		}
	};

	VGMPlay_js.prototype._resetWindowPositions = function () {
		if (!this.standalone) return;
		this.standaloneGroupTransformX = 0;
		this.standaloneGroupTransformY = 0;
		this.trackListTransformX = 0;
		this.trackListTransformY = 0;
		if (this.standaloneGroup) {
			this.standaloneGroup.style.transform = 'none';
			this.standaloneGroup.style.width = '';
		}
		if (this.tracksContainer) {
			this.tracksContainer.style.transform = 'none';
		}
		if (this.vgmplayContainer) {
			this.vgmplayContainer.style.top = '';
			this.vgmplayContainer.style.left = '';
		}
		if (this.zipFileListWindow) {
			this.zipFileListWindow.scrollTop = 0;
		}
	};

	VGMPlay_js.prototype.showPlayer = function () {
		this.playerWindow.className = "vgmplayPlayerWindow";
		this.playerWindow.innerHTML = `
			<div class="vgmplayControls">
				<button id="btnPrev" onclick="vgmplay_js.changeTrack('previous')">|&lt;</button>
				<button id="buttonTogglePlayback" onclick="vgmplay_js.togglePlayback()">&#9654;</button>
				<button id="btnNext" onclick="vgmplay_js.changeTrack('next')">&gt;|</button>
				<button id="btnStop" onclick="vgmplay_js.stop()">&#9632;</button>
				<button id="btnBass" onclick="vgmplay_js.toggleBassBoost()">B</button>
				<button id="btnReverb" onclick="vgmplay_js.toggleReverb()">V</button>
				<button id="btnRandom" onclick="vgmplay_js.toggleRandomScope()">R</button>
				<button id="btnLoop" onclick="vgmplay_js.toggleLoopMode()">L</button>
				<button id="btnLibrary" onclick="vgmplay_js.toggleDisplayZipFileListWindow()">F</button>
				<button id="btnSearch" onclick="vgmplay_js.toggleSearchBar()">&#128269;</button>
				<button id="btnSettings">&#9881;</button>
				<span id="vgmplayTime" class="vgmplayTime">0:00/0:00</span>
			</div>
		`;
		const uiRoot = (this.vgmplayContainer && this.vgmplayContainer.getRootNode) ? this.vgmplayContainer.getRootNode() : document;
		const byId = (id) => {
			if (uiRoot && uiRoot.querySelector) {
				const el = uiRoot.querySelector(`#${id}`);
				if (el) return el;
			}
			return document.getElementById(id);
		};
		this.buttonTogglePlayback = byId('buttonTogglePlayback');
		this.vgmplayTime = byId('vgmplayTime');
		this.btnBass = byId('btnBass');
		this.btnReverb = byId('btnReverb');
		this.btnRandom = byId('btnRandom');
		this.btnLoop = byId('btnLoop');
		this.btnLibrary = byId('btnLibrary');
		this.btnSearch = byId('btnSearch');
		this.btnSettings = byId('btnSettings');
		if (this.btnSettings) {
			this.btnSettings.addEventListener('click', () => this.toggleSettingsMenu());
		}

		// Disable and hide library toggle on mobile
		if (typeof window !== 'undefined' && window.innerWidth <= 600) {
			if (this.btnLibrary) this.btnLibrary.style.display = 'none';
		}

		this.searchBar = document.createElement('div');
		this.searchBar.className = 'vgmplaySearchBar';
		this.searchBar.style.display = 'none';
		this.searchBar.innerHTML = `<input id="vgmplaySearchInput" type="text" placeholder="Search games...">`;
		this.playerWindow.appendChild(this.searchBar);
		this.searchInput = this.searchBar.querySelector("#vgmplaySearchInput");
		this.searchInput.addEventListener('input', () => {
			this.searchQuery = (this.searchInput.value || '').toLowerCase();
			this._applyGameSearchFilter();
		});
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.toggleSearchBar();
				this._expandFirstSearchResult();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this.searchQuery = "";
				if (this.searchInput) this.searchInput.value = "";
				this._applyGameSearchFilter();
			}
		});
		if (!this._searchGlobalKeyHandler) {
			this._searchGlobalKeyHandler = (e) => {
				if (e.key !== 'Escape') return;
				e.preventDefault();
				this.searchQuery = "";
				if (this.searchInput) this.searchInput.value = "";
				this._applyGameSearchFilter();
				this._collapseAllGames();
				if (this.zipFileListWindow) this.zipFileListWindow.scrollTop = 0;
				if (this.standalone) this._resetWindowPositions();
				if (this.searchBarVisible) {
					this.searchBarVisible = false;
					if (this.searchBar) this.searchBar.style.display = 'none';
				}
			};
			document.addEventListener('keydown', this._searchGlobalKeyHandler);
		}

		// Create progress bar
		this.progressContainer = document.createElement('div');
		this.progressContainer.className = 'vgmplayProgressBar';
		this.progressContainer.addEventListener('click', (e) => this._onProgressClick(e));
		this.progressFill = document.createElement('div');
		this.progressFill.className = 'vgmplayProgressFill';
		this.progressContainer.appendChild(this.progressFill);
		this.playerWindow.appendChild(this.progressContainer);

		// Create tooltip element
		this.tooltip = document.createElement('div');
		this.tooltip.className = 'vgmplayTooltip';
		this.tooltip.style.display = 'none';
		this.vgmplayContainer.appendChild(this.tooltip);

		this._setupTooltips();

		// Create spectrum analyser canvas
		this.spectrumCanvas = document.createElement('canvas');
		this.spectrumCanvas.id = 'vgmplaySpectrum';
		this.spectrumCanvas.className = 'vgmplaySpectrum';
		this.spectrumCanvas.width = 256;
		this.spectrumCanvas.height = 64;
		this.playerWindow.appendChild(this.spectrumCanvas);
		this.spectrumCtx = this.spectrumCanvas.getContext('2d');
		if (this.isKSSActive && this._initKssMiniOverlay) {
			this._initKssMiniOverlay(true);
		}

		this.samplesGenerated = 0;
	};

	VGMPlay_js.prototype.setupDropZone = function () {
		this.uploader = document.createElement('div');
		this.uploader.id = "vgmplayUploader";
		this.uploader.className = "vgmplayUploader";
		this.uploader.innerHTML = "Insert music files/archives!";
		if (this.tracksContainer) {
			this.tracksContainer.appendChild(this.uploader);
		} else {
			this.vgmplayContainer.appendChild(this.uploader);
		}

		['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
			this.uploader.addEventListener(eventName, (e) => {
				e.preventDefault();
				e.stopPropagation();
			}, false);
		});

		['dragenter', 'dragover'].forEach(eventName => {
			this.uploader.addEventListener(eventName, () => {
				this.uploader.classList.add('highlight');
			}, false);
		});

		['dragleave', 'drop'].forEach(eventName => {
			this.uploader.addEventListener(eventName, () => {
				this.uploader.classList.remove('highlight');
			}, false);
		});

		this.uploader.addEventListener('drop', (e) => {
			const dt = e.dataTransfer;
			const files = dt.files;
			this.handleFiles(files);
		}, false);
	};

	VGMPlay_js.prototype._createSkippedWindow = function () {
		if (!this.vgmplayContainer) return;
		this.skippedWindow = document.createElement('div');
		this.skippedWindow.id = "vgmplaySkippedWindow";
		this.skippedWindow.className = "vgmplaySkippedWindow";
		this.skippedWindow.style.display = 'none';
		this.skippedWindow.style.top = '20px';
		this.skippedWindow.style.left = '300px';
		if (this.isExtension && !this.standalone) {
			this.skippedWindow.style.position = 'absolute';
			this.skippedWindow.style.left = '0px';
			this.skippedWindow.style.right = 'auto';
		}

		this.skippedHeader = document.createElement('div');
		this.skippedHeader.className = 'vgmplaySkippedHeader';
		this.skippedHeader.innerHTML = `
			<span class="vgmplaySkippedTitle">ADDITIONAL INFORMATION</span>
			<span class="vgmplaySkippedCountdown" style="display:none;">
				<span class="vgmplaySkippedSpinner"></span>
				<span class="vgmplaySkippedCountdownNum">10</span>
			</span>
			<button class="vgmplaySkippedClose" title="Close">×</button>
		`;
		this.skippedWindow.appendChild(this.skippedHeader);
		this.skippedTitleEl = this.skippedHeader.querySelector('.vgmplaySkippedTitle');
		this.skippedCountdownEl = this.skippedHeader.querySelector('.vgmplaySkippedCountdown');
		this.skippedCountdownNumEl = this.skippedHeader.querySelector('.vgmplaySkippedCountdownNum');

		this.skippedNotice = document.createElement('div');
		this.skippedNotice.className = 'vgmplaySkippedNotice';
		this.skippedNotice.textContent = 'Big files detected; those files eat bandwidth and the memory on your device. Select files you want to load anyway.';
		this.skippedWindow.appendChild(this.skippedNotice);

		this.skippedAutoLimit = document.createElement('div');
		this.skippedAutoLimit.className = 'vgmplaySkippedAutoLimit';
		this.skippedWindow.appendChild(this.skippedAutoLimit);

		this.skippedCacheClear = document.createElement('div');
		this.skippedCacheClear.className = 'vgmplaySkippedCacheClear';
		this.skippedWindow.appendChild(this.skippedCacheClear);

		this.skippedList = document.createElement('div');
		this.skippedList.className = 'vgmplaySkippedList';
		this.skippedWindow.appendChild(this.skippedList);

		this.vgmplayContainer.appendChild(this.skippedWindow);

		this._elementDragWindow = this._elementDragWindow.bind(this);
		this._stopDragWindow = this._stopDragWindow.bind(this);
		this._dragStartWindow = this._dragStartWindow.bind(this);

		this.skippedHeader.addEventListener('mousedown', this._dragStartWindow);
		this.skippedHeader.querySelector('.vgmplaySkippedClose').addEventListener('click', () => {
			this._hideSkippedWindow(false);
		});

		this._renderSkippedDownloads();
		this._positionSkippedWindow();
		window.addEventListener('resize', () => this._positionSkippedWindow());
	};

	VGMPlay_js.prototype._setupTooltips = function () {
		const buttons = this.playerWindow.querySelectorAll('button');
		const tracks = this.vgmplayContainer.querySelectorAll('.vgmplayTrack');
		const targets = [...buttons, ...tracks];
		const idDescriptions = {
			'buttonTogglePlayback': (this.isExtension ? 'Play/Pause (P)' : 'Play/Pause (Space)'),
			'btnPrev': 'Previous Track (P)',
			'btnNext': 'Next Track (N)',
			'btnStop': 'Stop',
			'btnBass': 'Bass Boost (B)',
			'btnReverb': 'Reverb (V)',
			'btnRandom': 'Shuffle game/all (R)',
			'btnLoop': 'Loop track/game (L)',
			'btnLibrary': 'Toggle Float/Library (F)',
			'btnSearch': 'Search (S)',
			'btnSettings': 'Settings'
		};

		let tooltipTimeout;

		targets.forEach(target => {
			const desc = idDescriptions[target.id] || target.title || (target.classList.contains('vgmplayTrack') ? target.innerText : null);
			if (!desc) return;

			const hideTooltip = () => {
				clearTimeout(tooltipTimeout);
				this.tooltip.style.display = 'none';
			};

			const startTimer = () => {
				clearTimeout(tooltipTimeout);
				this.tooltip.style.display = 'none';

				tooltipTimeout = setTimeout(() => {
					this.tooltip.innerHTML = desc;
					this.tooltip.style.display = 'block';
					// Position above target
					const rect = target.getBoundingClientRect();
					const containerRect = this.vgmplayContainer.getBoundingClientRect();
					this.tooltip.style.left = (rect.left - containerRect.left + rect.width / 2) + 'px';
					this.tooltip.style.top = (rect.top - containerRect.top - 30) + 'px';
				}, 2000);
			};

			target.addEventListener('mouseenter', startTimer);
			target.addEventListener('mousemove', startTimer); // Reset timer if moving
			target.addEventListener('mouseleave', hideTooltip);
			target.addEventListener('click', hideTooltip);
		});
	};

	VGMPlay_js.prototype.toggleSearchBar = function () {
		this.searchBarVisible = !this.searchBarVisible;
		if (this.searchBar) {
			this.searchBar.style.display = this.searchBarVisible ? 'block' : 'none';
		}
		if (this.searchBarVisible && this.searchInput) {
			this.searchInput.focus();
			this.searchInput.select();
		}
	};

	VGMPlay_js.prototype.toggleSettingsMenu = function () {
		this._settingsMenuVisible = !this._settingsMenuVisible;
		if (this._settingsMenuVisible) {
			this._settingsStatusText = '';
			this._showSkippedWindow();
		}
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._dumpDebugSnapshot = function () {
		let snapshot = null;
		if (typeof window !== 'undefined' && window.__VGM_DEBUG_SNAPSHOT__) {
			try {
				snapshot = window.__VGM_DEBUG_SNAPSHOT__();
			} catch (e) {
				snapshot = { error: String(e) };
			}
		} else {
			snapshot = {
				error: 'debug snapshot unavailable',
				cacheReady: this._cacheReady,
				gamesLoaded: this.games ? this.games.length : 0
			};
		}
		console.log('[VGM] Debug snapshot:', snapshot);
		this._settingsStatusText = 'Debug snapshot dumped to console.';
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._applyGameSearchFilter = function () {
		const query = (this.searchQuery || '').toLowerCase();
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			const name = (game.searchName || game.name || '').toLowerCase();
			const match = !query || name.includes(query);
			game.uiElement.style.display = match ? '' : 'none';
		}
	};

	VGMPlay_js.prototype._expandFirstSearchResult = function () {
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			if (game.uiElement.style.display === 'none') continue;
			game.uiElement.dataset.expanded = 'true';
			game.uiElement.classList.add('vgmplayGameExpanded');
			game.uiElement.classList.remove('vgmplayGameCollapsed');
			return;
		}
	};

	VGMPlay_js.prototype._renderSkippedDownloads = function () {
		if (!this.skippedList) return;
		this.skippedList.innerHTML = '';
		this._updateSkippedTitle();
		this._updateSkippedNotice();
		if (this.skippedAutoLimit) {
			this._renderAutoLimitNotice();
		}
		if (this.skippedCacheClear) {
			this._renderCacheClearPrompt();
		}

		const contentBlocks = [];
		if (this._settingsMenuVisible) {
			const statusLine = this._settingsStatusText ? `<div class="vgmplaySettingsStatus">${this._settingsStatusText}</div>` : '';
			contentBlocks.push(`
				<div class="vgmplaySettingsMenu">
					<div class="vgmplaySkippedAutoText">Settings</div>
					<div class="vgmplaySkippedAutoActions">
						<button class="vgmplaySettingsClearCache">Clear cache</button>
						<button class="vgmplaySettingsDumpDebug">Dump debug snapshot</button>
					</div>
					${statusLine}
				</div>
			`);
		}
		if (!this._settingsMenuVisible && this.debugModeHasBeenToggled) {
			contentBlocks.push(`
				<div style="margin-bottom: 8px;"><b>Debug Mode:</b> <span>${this.debugMode ? 'ON' : 'OFF'}</span></div>
			`);
		}
		if (contentBlocks.length) {
			if (!this.skippedContentEl) {
				this.skippedContentEl = document.createElement('div');
				this.skippedContentEl.className = 'vgmplaySkippedContent';
				this.skippedWindow.insertBefore(this.skippedContentEl, this.skippedList);
			}
			this.skippedContentEl.innerHTML = contentBlocks.join('');
			const clearBtn = this.skippedContentEl.querySelector('.vgmplaySettingsClearCache');
			const dumpBtn = this.skippedContentEl.querySelector('.vgmplaySettingsDumpDebug');
			if (clearBtn) {
				clearBtn.addEventListener('click', () => {
					this._cacheClearPromptVisible = true;
					this._renderSkippedDownloads();
				});
			}
			if (dumpBtn) {
				dumpBtn.addEventListener('click', () => {
					this._dumpDebugSnapshot();
				});
			}
		} else if (this.skippedContentEl) {
			this.skippedContentEl.innerHTML = '';
		}

		if (this._settingsMenuVisible) {
			if (this.skippedNotice) this.skippedNotice.style.display = 'none';
			if (this.skippedAutoLimit) this.skippedAutoLimit.innerHTML = '';
			if (this.skippedCacheClear) this.skippedCacheClear.innerHTML = '';
			if (this.skippedList) this.skippedList.innerHTML = '';
			this._positionSkippedWindow();
			this._updateSkippedAutoHide();
			return;
		}

		if (this.skippedDownloads.length === 0 && this.noPlayableNotices.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'vgmplaySkippedEmpty';
			empty.textContent = 'No skipped downloads.';
			this.skippedList.appendChild(empty);
			return;
		}

		for (const item of this.skippedDownloads) {
			const row = document.createElement('div');
			row.className = 'vgmplaySkippedRow';

			const name = document.createElement('div');
			name.className = 'vgmplaySkippedName';
			name.textContent = item.name;

			const size = document.createElement('div');
			size.className = 'vgmplaySkippedSize';
			size.textContent = item.sizeMB + ' MB';

			const loadBtn = document.createElement('button');
			loadBtn.className = 'vgmplaySkippedLoad';
			loadBtn.textContent = 'Load';
			loadBtn.addEventListener('click', () => {
				this._loadSkippedDownload(item.url);
				this.skippedDownloads = this.skippedDownloads.filter((x) => x.url !== item.url);
				this._renderSkippedDownloads();
			});

			row.appendChild(name);
			row.appendChild(size);
			row.appendChild(loadBtn);
			this.skippedList.appendChild(row);
		}

		for (const notice of this.noPlayableNotices) {
			const row = document.createElement('div');
			row.className = 'vgmplaySkippedNoticeRow';
			row.textContent = notice;
			this.skippedList.appendChild(row);
		}

		this._positionSkippedWindow();
		this._updateSkippedAutoHide();
	};

	VGMPlay_js.prototype._updateSkippedTitle = function () {
		if (!this.skippedTitleEl) return;
		this.skippedTitleEl.textContent = 'ADDITIONAL INFORMATION';
	};

	VGMPlay_js.prototype._clearSkippedAutoHide = function () {
		if (this._skippedAutoHideTimer) {
			clearTimeout(this._skippedAutoHideTimer);
			this._skippedAutoHideTimer = null;
		}
		if (this._skippedCountdownTimer) {
			clearInterval(this._skippedCountdownTimer);
			this._skippedCountdownTimer = null;
		}
	};

	VGMPlay_js.prototype._hideSkippedWindow = function (fade = true) {
		this._clearSkippedAutoHide();
		if (!this.skippedWindow) return;
		if (this._settingsMenuVisible) {
			this._settingsMenuVisible = false;
			this._settingsStatusText = '';
		}
		if (fade) {
			this.skippedWindow.classList.add('vgmplaySkippedFading');
			setTimeout(() => {
				if (!this.skippedWindow) return;
				this.skippedWindow.style.display = 'none';
				this.skippedWindowVisible = false;
				this.skippedWindow.classList.remove('vgmplaySkippedFading');
				if (this.skippedCountdownEl) this.skippedCountdownEl.style.display = 'none';
				this.noPlayableNotices = [];
			}, 600);
		} else {
			this.skippedWindow.style.display = 'none';
			this.skippedWindowVisible = false;
			this.skippedWindow.classList.remove('vgmplaySkippedFading');
			if (this.skippedCountdownEl) this.skippedCountdownEl.style.display = 'none';
			this.noPlayableNotices = [];
		}
	};

	VGMPlay_js.prototype._updateSkippedAutoHide = function () {
		if (!this.skippedWindowVisible) return;
		const needsAction = this.skippedDownloads.length > 0 || this.autoOverflowURLs.length > 0 || this._cacheClearPromptVisible || this._settingsMenuVisible;
		const hasNotices = this.noPlayableNotices.length > 0 || this.debugModeHasBeenToggled || this._settingsMenuVisible;

		if (needsAction || !hasNotices) {
			this._clearSkippedAutoHide();
			if (this.skippedCountdownEl) this.skippedCountdownEl.style.display = 'none';
			return;
		}

		if (this._skippedCountdownTimer || this._skippedAutoHideTimer) return;
		if (this.skippedCountdownEl) this.skippedCountdownEl.style.display = 'inline-flex';

		let remaining = 10;
		if (this.skippedCountdownNumEl) this.skippedCountdownNumEl.textContent = String(remaining);
		this._skippedCountdownTimer = setInterval(() => {
			remaining -= 1;
			if (this.skippedCountdownNumEl) this.skippedCountdownNumEl.textContent = String(Math.max(0, remaining));
			if (remaining <= 0) {
				this._hideSkippedWindow(true);
			}
		}, 1000);

		this._skippedAutoHideTimer = setTimeout(() => {
			this._hideSkippedWindow(true);
		}, 10000);
	};

	VGMPlay_js.prototype._updateSkippedNotice = function () {
		if (!this.skippedNotice) return;
		this.skippedNotice.style.display = (this.skippedDownloads.length > 0) ? 'block' : 'none';
	};

	VGMPlay_js.prototype._renderAutoLimitNotice = function () {
		const count = this.autoOverflowURLs.length;
		let cacheCount = this.autoCacheHits || 0;
		if (cacheCount === 0 && this._cacheRestoredGameCount) {
			cacheCount = this._cacheRestoredGameCount;
		}
		const hostKey = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
		if (this._cacheRestoredByHost && this._cacheRestoredByHost.has(hostKey)) {
			cacheCount = this._cacheRestoredByHost.get(hostKey);
		}
		if (count === 0) {
			if (cacheCount > 0 && (this.autoDownloadCount || 0) === 0) {
				this.skippedAutoLimit.innerHTML = `
					<div class="vgmplaySkippedAutoText">All games (${cacheCount}) on this site loaded from cache.</div>
				`;
			} else {
				this.skippedAutoLimit.innerHTML = '';
			}
			return;
		}
		const downloadedCount = this.autoDownloadCount || 0;
		this.skippedAutoLimit.innerHTML = `
			<div class="vgmplaySkippedAutoText">Auto-download limit hit. ${cacheCount} file${cacheCount === 1 ? '' : 's'} read from cache, downloaded ${downloadedCount} extra, ${count} left.</div>
			<div class="vgmplaySkippedAutoActions">
				<button class="vgmplaySkippedLoadMore">Load 10 more or &lt; 5MB</button>
				<button class="vgmplaySkippedLoadAll">Load all</button>
			</div>
		`;
		const moreBtn = this.skippedAutoLimit.querySelector('.vgmplaySkippedLoadMore');
		const allBtn = this.skippedAutoLimit.querySelector('.vgmplaySkippedLoadAll');
		moreBtn.addEventListener('click', () => {
			this._loadMoreAuto(10);
		});
		allBtn.addEventListener('click', () => {
			this._loadMoreAuto(Infinity);
		});
	};

	VGMPlay_js.prototype._showSkippedWindow = function () {
		if (!this.skippedWindow) return;
		if (!this.skippedWindowVisible) {
			this.skippedWindow.classList.remove('vgmplaySkippedFading');
			this.skippedWindow.style.display = 'block';
			this.skippedWindowVisible = true;
			this._positionSkippedWindow();
		}
		this._updateSkippedAutoHide();
	};

	VGMPlay_js.prototype._addSkippedDownload = function (url, size) {
		const existing = this.skippedDownloads.find((x) => x.url === url);
		if (existing) return;
		const name = this._getFileNameFromUrl(url);
		const sizeMB = this._formatMB(size);
		this.skippedDownloads.push({ url, name, sizeMB });
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._addNoPlayableNotice = function (name, opts = null) {
		const safeName = name || 'File';
		let msg = `${safeName} did not contain playable music for VGMPlay!`;
		if (opts && opts.isMuntRom) {
			msg = `Munt ROM file ${safeName} uploaded and saved to root.`;
		} else if (opts && opts.isRom) {
			const lower = String(safeName).toLowerCase();
			if (lower === 'yrw801.rom') {
				msg = `yrw801.rom loaded, playback of VGM files using YMF278B will work now.`;
			}
		} else if (opts && opts.isMidiArchive) {
			msg = `${safeName} contains MIDI only. Playback not supported yet.`;
		} else if ((opts && opts.isMidi) || (this._isMidiFile && this._isMidiFile(safeName))) {
			const typeLabel = (opts && opts.typeLabel) ? opts.typeLabel : 'MIDI';
			msg = `${safeName} is ${typeLabel}. Playback not supported yet.`;
		}
		if (this.noPlayableNotices.includes(msg)) return;
		this.noPlayableNotices.push(msg);
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._renderCacheClearPrompt = function () {
		if (!this.skippedCacheClear) return;
		if (!this._cacheClearPromptVisible) {
			this.skippedCacheClear.innerHTML = '';
			return;
		}
		this.skippedCacheClear.innerHTML = `
			<div class="vgmplaySkippedAutoText">Delete all cache?</div>
			<div class="vgmplaySkippedAutoActions">
				<button class="vgmplayCacheClearYes">Yes</button>
				<button class="vgmplayCacheClearNo">No</button>
			</div>
		`;
		const yesBtn = this.skippedCacheClear.querySelector('.vgmplayCacheClearYes');
		const noBtn = this.skippedCacheClear.querySelector('.vgmplayCacheClearNo');
		yesBtn.addEventListener('click', () => {
			if (this.clearCache) this.clearCache();
			this._cacheClearPromptVisible = false;
			this._renderSkippedDownloads();
		});
		noBtn.addEventListener('click', () => {
			this._cacheClearPromptVisible = false;
			this._renderSkippedDownloads();
		});
	};

	VGMPlay_js.prototype._toggleCacheClearPrompt = function () {
		this._cacheClearPromptVisible = !this._cacheClearPromptVisible;
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._addDuplicateNotice = function (name) {
		const safeName = name || 'File';
		const msg = `${safeName} already exists and was skipped.`;
		if (this.noPlayableNotices.includes(msg)) return;
		this.noPlayableNotices.push(msg);
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._showMuntRomError = function () {
		const msg = `Munt MT-32 emulation requires 2 ROM files: <b>MT32_CONTROL.ROM</b> and <b>MT32_PCM.ROM</b>.<br/><br/>
		Please upload these files by dragging them onto the 'Insert music files/archives here!' field.`;
		if (!this.noPlayableNotices.includes(msg)) {
			this.noPlayableNotices.push(msg);
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._showOpl4RomError = function () {
		const msg = "YMF278B (OPL4) playback requires the ROM file yrw801.rom.\n\nPlease upload it by dragging the file onto the 'Insert music files/archives here!' field.";
		if (!this.noPlayableNotices.includes(msg)) {
			this.noPlayableNotices.push(msg);
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._loadSkippedDownload = function (url) {
		const lower = url.toLowerCase();
		if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
			this.loadZIPWithVGMFromURL(url, true);
		} else if (this.isPlayable(lower) || (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower)) {
			this._queueURL(url, true);
		}
	};

	VGMPlay_js.prototype._loadMoreAuto = async function (count) {
		const targetBytes = this.autoDownloadBytesLimit || (5 * 1024 * 1024);
		let loadedBytes = 0;
		let loadedCount = 0;
		while (this.autoOverflowURLs.length > 0) {
			if (count !== Infinity) {
				if (loadedCount >= count && loadedBytes >= targetBytes) break;
			}
			const url = this.autoOverflowURLs.shift();
			const knownSize = this.autoOverflowSizes ? this.autoOverflowSizes.get(url) : null;
			if (this.autoOverflowSizes) this.autoOverflowSizes.delete(url);
			const sizeBytes = (knownSize == null && this._getRemoteFileSize) ? await this._getRemoteFileSize(url) : knownSize;
			const queued = this._queueAutoURL
				? await this._queueAutoURL(url, false, { ignoreLimit: true, sizeBytes })
				: (this._queueURL(url, false, false), true);
			if (queued) {
				loadedCount += 1;
				if (sizeBytes != null) loadedBytes += sizeBytes;
			}
			if (count === Infinity) {
				continue;
			}
			if (loadedBytes >= targetBytes && loadedCount >= count) {
				break;
			}
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._getFileNameFromUrl = function (url) {
		try {
			const u = new URL(url);
			const p = u.pathname;
			const last = p.substring(p.lastIndexOf('/') + 1);
			return decodeURIComponent(last || url.split('/').pop().split('?')[0].split('#')[0]);
		} catch (e) {
			const idx = url.lastIndexOf('/');
			const chunk = idx >= 0 ? url.substring(idx + 1) : url;
			return decodeURIComponent(chunk.split('?')[0].split('#')[0]);
		}
	};

	VGMPlay_js.prototype._positionSkippedWindow = function () {
		if (!this.skippedWindow || !this.playerWindow || !this.vgmplayContainer) return;
		if (this.skippedWindowVisible === false) return;
		requestAnimationFrame(() => {
			const isMobile = window.innerWidth <= 600;
			const containerRect = this.vgmplayContainer.getBoundingClientRect();
			const getOffsetFromContainer = (el) => {
				let x = 0;
				let y = 0;
				let node = el;
				while (node && node !== this.vgmplayContainer) {
					x += node.offsetLeft;
					y += node.offsetTop;
					node = node.offsetParent;
				}
				if (node === this.vgmplayContainer) {
					return { x, y };
				}
				const rect = el.getBoundingClientRect();
				return {
					x: rect.left - containerRect.left,
					y: rect.top - containerRect.top
				};
			};
			const playerOffset = getOffsetFromContainer(this.playerWindow);
			const playerLeft = playerOffset.x;
			const playerTop = playerOffset.y;
			const playerWidth = this.playerWindow.offsetWidth;
			let gap = 8;
			if (this.titleWindow) {
				const titleOffset = getOffsetFromContainer(this.titleWindow);
				const titleHeight = this.titleWindow.offsetHeight;
				const titleTop = titleOffset.y;
				const inferred = playerTop - (titleTop + titleHeight);
				if (Number.isFinite(inferred) && inferred >= 0) {
					gap = inferred;
				}
			}

			if (this.isExtension && !this.standalone) {
				const playerRect = this.playerWindow.getBoundingClientRect();
				const skippedWidth = this.skippedWindow.offsetWidth;
				const desiredLeft = playerRect.right + gap;
				const maxLeft = Math.max(0, window.innerWidth - skippedWidth - 8);
				this.skippedWindow.style.position = 'fixed';
				this.skippedWindow.style.right = 'auto';
				this.skippedWindow.style.left = Math.min(desiredLeft, maxLeft) + "px";
				this.skippedWindow.style.top = playerRect.top + "px";
				return;
			}

			if (isMobile) {
				this.skippedWindow.style.left = playerLeft + "px";
				const desiredTop = playerTop - this.skippedWindow.offsetHeight - gap;
				this.skippedWindow.style.top = Math.max(0, desiredTop) + "px";
			} else {
				const desiredLeft = playerLeft + playerWidth + gap;
				this.skippedWindow.style.right = "auto";
				this.skippedWindow.style.left = desiredLeft + "px";
				this.skippedWindow.style.top = playerTop + "px";
			}
		});
	};
}
