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
		// For standalone: reset transforms and positions
		if (this.standalone) {
			this.standaloneGroupTransformX = 0;
			this.standaloneGroupTransformY = 0;
			if (this.standaloneGroup) {
				this.standaloneGroup.style.transform = 'none';
				this.standaloneGroup.style.width = '';
			}
			if (this.vgmplayContainer) {
				this.vgmplayContainer.style.top = '';
				this.vgmplayContainer.style.left = '';
			}
		}
		// For extension: reset position based on current mode
		if (!this.standalone) {
			// Reset root element position based on current mode
			const root = document.getElementById('vgmplay-extension-root');
			if (this.libraryState === 2) {
				// Grid mode: reset to full screen position
				if (root) {
					root.style.setProperty('top', '0', 'important');
					root.style.setProperty('left', '0', 'important');
				}
				// Also reset vgmplayContainer position (which is set during drag)
				if (this.vgmplayContainer) {
					this.vgmplayContainer.style.setProperty('top', '0', 'important');
					this.vgmplayContainer.style.setProperty('left', '0', 'important');
				}
			} else {
				// Attached or floating mode: reset to default position
				if (root) {
					root.style.setProperty('top', '10px', 'important');
					root.style.setProperty('left', '10px', 'important');
				}
				// Also reset vgmplayContainer position (which is set during drag)
				if (this.vgmplayContainer) {
					this.vgmplayContainer.style.setProperty('top', '10px', 'important');
					this.vgmplayContainer.style.setProperty('left', '10px', 'important');
				}
			}
		}
		// Common reset for both standalone and extension
		this.trackListTransformX = 0;
		this.trackListTransformY = 0;
		if (this.tracksContainer) {
			this.tracksContainer.style.transform = 'none';
		}
		if (this.zipFileListWindow) {
			this.zipFileListWindow.scrollTop = 0;
		}
	};

	VGMPlay_js.prototype.showPlayer = function () {
		this.playerWindow.className = "vgmplayPlayerWindow";
		this.playerWindow.innerHTML = `
			<div class="vgmplayControls">
				<button id="btnPrev">|&lt;</button>
				<button id="buttonTogglePlayback">&#9654;</button>
				<button id="btnNext">&gt;|</button>
				<button id="btnStop">&#9632;</button>
				<button id="btnBass">B</button>
				<button id="btnReverb">V</button>
				<button id="btnRandom">R</button>
				<button id="btnLoop">L</button>
				<button id="btnAdditional">A</button>
				<button id="btnLibrary">F</button>
				<button id="btnSearch">&#128269;</button>
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
		this.btnPrev = byId('btnPrev');
		this.btnNext = byId('btnNext');
		this.btnStop = byId('btnStop');
		this.vgmplayTime = byId('vgmplayTime');
		this.btnBass = byId('btnBass');
		this.btnReverb = byId('btnReverb');
		this.btnRandom = byId('btnRandom');
		this.btnLoop = byId('btnLoop');
		this.btnAdditional = byId('btnAdditional');
		this.btnLibrary = byId('btnLibrary');
		this.btnSearch = byId('btnSearch');
		this.btnSettings = byId('btnSettings');
		if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.changeTrack('previous'));
		if (this.buttonTogglePlayback) this.buttonTogglePlayback.addEventListener('click', () => this.togglePlayback());
		if (this.btnNext) this.btnNext.addEventListener('click', () => this.changeTrack('next'));
		if (this.btnStop) this.btnStop.addEventListener('click', () => this.stop());
		if (this.btnBass) this.btnBass.addEventListener('click', () => this.toggleBassBoost());
		if (this.btnReverb) this.btnReverb.addEventListener('click', () => this.toggleReverb());
		if (this.btnRandom) this.btnRandom.addEventListener('click', () => this.toggleRandomScope());
		if (this.btnLoop) this.btnLoop.addEventListener('click', () => this.toggleLoopMode());
		if (this.btnAdditional) this.btnAdditional.addEventListener('click', () => this.toggleSkippedWindow());
		if (this.btnLibrary) this.btnLibrary.addEventListener('click', () => this.toggleDisplayZipFileListWindow());
		if (this.btnSearch) this.btnSearch.addEventListener('click', () => this.toggleSearchBar());
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
				// Reset window positions for both standalone and extension
				this._resetWindowPositions();
				// In grid mode, filter to show only the active game
				if (this.libraryState === 2 && this._applyOverviewTrackFilter) {
					this._applyOverviewTrackFilter();
				}
				if (this.searchBarVisible) {
					this.searchBarVisible = false;
					if (this.searchBar) this.searchBar.style.display = 'none';
				}
				if (this._hideSkippedWindow) {
					this._hideSkippedWindow(false);
				}
				if (this._hideSettingsWindow) {
					this._hideSettingsWindow();
				}
				if (this._hideExportModal) {
					this._hideExportModal();
				}
				if (this._hideBulkLoadPrompt) {
					this._hideBulkLoadPrompt();
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
			this.skippedWindow.style.position = 'fixed';
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

		this.skippedHarvestMore = document.createElement('div');
		this.skippedHarvestMore.className = 'vgmplaySkippedHarvestMore';
		this.skippedWindow.appendChild(this.skippedHarvestMore);

		this.skippedCacheClear = document.createElement('div');
		this.skippedCacheClear.className = 'vgmplaySkippedCacheClear';
		this.skippedWindow.appendChild(this.skippedCacheClear);

		this.skippedCacheSize = document.createElement('div');
		this.skippedCacheSize.className = 'vgmplaySkippedCacheSize';
		this.skippedWindow.appendChild(this.skippedCacheSize);

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

	VGMPlay_js.prototype._createSettingsWindow = function () {
		if (this.settingsWindow) return;

		this.settingsWindow = document.createElement('div');
		this.settingsWindow.id = "vgmplaySettingsWindow";
		this.settingsWindow.className = "vgmplaySettingsWindow";
		this.settingsWindow.style.display = 'none';

		this.settingsHeader = document.createElement('div');
		this.settingsHeader.className = 'vgmplaySettingsHeader';
		this.settingsHeader.innerHTML = `
<span class="vgmplaySettingsTitle">SETTINGS</span>
<button class="vgmplaySettingsClose" title="Close">×</button>
`;
		this.settingsWindow.appendChild(this.settingsHeader);

		this.settingsContent = document.createElement('div');
		this.settingsContent.className = 'vgmplaySettingsContent';
		this.settingsWindow.appendChild(this.settingsContent);

		if (this.vgmplayContainer) {
			this.vgmplayContainer.appendChild(this.settingsWindow);
		} else if (this.shadowRoot) {
			this.shadowRoot.appendChild(this.settingsWindow);
		} else if (typeof document !== 'undefined') {
			document.body.appendChild(this.settingsWindow);
		}

		this.settingsHeader.addEventListener('mousedown', (e) => this._dragStartWindow(e, this.settingsWindow));
		this.settingsHeader.querySelector('.vgmplaySettingsClose').addEventListener('click', () => {
			this._hideSettingsWindow();
		});
	};

	VGMPlay_js.prototype._showNotification = function (message, duration = 10000) {
		if (!this.skippedWindow) return;

		this.skippedTitleEl.textContent = 'NOTIFICATION';
		this.skippedNotice.textContent = message;
		this.skippedNotice.style.display = 'block';
		this.skippedAutoLimit.innerHTML = '';
		this.skippedCacheClear.innerHTML = '';
		this.skippedList.innerHTML = '';
		if (this.skippedContentEl) this.skippedContentEl.innerHTML = '';

		this.skippedWindow.style.display = 'block';
		this.skippedWindowVisible = true;
		this.skippedWindow.classList.remove('vgmplaySkippedFading');

		if (duration > 0) {
			this._startCountdown(duration / 1000);
		}

		this._positionSkippedWindow();
		this._positionSettingsWindow();
	};

	VGMPlay_js.prototype._showSettingsWindow = function () {
		this._createSettingsWindow();
		if (!this.settingsWindow) return;

		const gamesLoaded = this.games ? this.games.length : 0;
		const cacheCount = Math.max(0, Math.min(this.autoCacheHits || 0, gamesLoaded));
		const newCount = Math.max(0, gamesLoaded - cacheCount);

		this.settingsContent.innerHTML = `
<div class="vgmplaySettingsMenu">
<div class="vgmplaySkippedAutoText">Cache: ${cacheCount} from cache, ${newCount} new.</div>
<div class="vgmplaySkippedAutoActions">
<button class="vgmplaySettingsClearCache">Clear cache</button>
<button class="vgmplaySettingsManageCache">Manage cache</button>
<button class="vgmplaySettingsExportMusic">Export music</button>
</div>
<div class="vgmplaySettingsStatus">${this._settingsStatusText || ''}</div>
</div>
`;

		const clearBtn = this.settingsContent.querySelector('.vgmplaySettingsClearCache');
		const manageBtn = this.settingsContent.querySelector('.vgmplaySettingsManageCache');
		const exportBtn = this.settingsContent.querySelector('.vgmplaySettingsExportMusic');

		if (clearBtn) {
			clearBtn.addEventListener('click', () => {
				this._showCacheClearPrompt();
			});
		}
		if (manageBtn) {
			manageBtn.addEventListener('click', () => {
				this._hideSettingsWindow();
				if (this._showSelectiveCacheClearPrompt) this._showSelectiveCacheClearPrompt();
			});
		}
		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				this._showExportModal();
			});
		}

		this.settingsWindow.style.display = 'block';
		this._positionSettingsWindow();
	};

	VGMPlay_js.prototype._hideSettingsWindow = function () {
		if (this.settingsWindow) {
			this.settingsWindow.style.display = 'none';
		}
	};

	VGMPlay_js.prototype._hideSelectiveCacheClearPrompt = function () {
		const root = this.vgmplayContainer || document.body;
		const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
		const win = uiRoot.getElementById('vgmplay-selective-cache-prompt');
		if (win) {
			win.style.display = 'none';
		}
	};

	VGMPlay_js.prototype._showSelectiveCacheClearPrompt = function () {
		if (!this.games || !this.games.length) return;

		const root = this.vgmplayContainer || document.body;
		const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;

		let win = uiRoot.getElementById('vgmplay-selective-cache-prompt');
		if (!win) {
			win = document.createElement('div');
			win.id = 'vgmplay-selective-cache-prompt';
			win.className = 'vgmplaySkippedWindow';
			win.style.cssText = `
				position: fixed !important;
				top: 50% !important;
				left: 50% !important;
				transform: translate(-50%, -50%) !important;
				display: none;
				z-index: 100000;
				background: #222;
				color: white;
				border: 1px solid #444;
				padding: 15px;
				border-radius: 4px;
				width: 500px;
				max-width: 90vw;
				max-height: 80vh;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				box-shadow: 0 4px 12px rgba(0,0,0,0.5);
			`;
			if (this.vgmplayContainer && this.vgmplayContainer.appendChild) {
				this.vgmplayContainer.appendChild(win);
			} else {
				document.body.appendChild(win);
			}

			// Add escape listener
			const escapeListener = (e) => {
				if (e.key === 'Escape' && win.style.display !== 'none') {
					this._hideSelectiveCacheClearPrompt();
				}
			};
			if (typeof window !== 'undefined') {
				window.addEventListener('keydown', escapeListener);
			}
		}

		// Clear and rebuild
		win.innerHTML = '';
		win.style.display = 'flex';

		const header = document.createElement('div');
		header.className = 'vgmplaySkippedTitle';
		header.innerHTML = `<span>Manage Cached Games</span><span class="vgmplaySkippedClose" style="cursor:pointer;">&times;</span>`;
		win.appendChild(header);

		header.querySelector('.vgmplaySkippedClose').onclick = () => {
			this._hideSelectiveCacheClearPrompt();
		};

		const listContainer = document.createElement('div');
		listContainer.className = 'vgmplaySkippedList';
		listContainer.style.display = 'block';
		listContainer.style.flex = '1';
		listContainer.style.overflowY = 'auto';
		listContainer.style.marginTop = '10px';
		listContainer.style.marginBottom = '10px';
		listContainer.style.border = '1px solid #333';
		listContainer.style.padding = '5px';

		// Group games by cacheHost
		const groups = new Map();
		for (const game of this.games) {
			if (!game._fromCache) continue;
			const host = game.cacheHost || 'Other';
			if (!groups.has(host)) groups.set(host, []);
			groups.get(host).push(game);
		}

		const hosts = Array.from(groups.keys()).sort();
		for (const host of hosts) {
			const games = groups.get(host);
			if (!games.length) continue;

			// Group Header
			const hostHeader = document.createElement('div');
			hostHeader.style.cssText = 'padding: 5px; background: #333; font-weight: bold; font-size: 13px; margin: 5px 0; color: #ccc; border-radius: 2px; display: flex; align-items: center; justify-content: space-between;';

			const titleSpan = document.createElement('span');
			titleSpan.textContent = `Cached from: ${host} (${games.length} games)`;
			hostHeader.appendChild(titleSpan);

			const selectAllBtn = document.createElement('button');
			selectAllBtn.textContent = 'Select All';
			selectAllBtn.style.cssText = 'background: #555; border: none; color: white; border-radius: 2px; padding: 2px 6px; cursor: pointer; font-size: 11px;';
			hostHeader.appendChild(selectAllBtn);

			listContainer.appendChild(hostHeader);

			// Render games
			const hostCheckboxes = [];
			for (const game of games) {
				const item = document.createElement('div');
				item.className = 'vgmplaySkippedRow';
				item.style.cursor = 'pointer';
				item.style.padding = '4px';

				const firstCol = document.createElement('div');
				firstCol.style.display = 'flex';
				firstCol.style.alignItems = 'center';
				firstCol.style.overflow = 'hidden';

				const cb = document.createElement('input');
				cb.type = 'checkbox';
				cb.className = 'vgmplay-cache-cb';
				cb.dataset.fingerprint = game.archiveName || game.name;
				cb.style.marginRight = '8px';
				cb.style.flexShrink = '0';
				hostCheckboxes.push(cb);
				firstCol.appendChild(cb);

				const text = document.createElement('div');
				text.className = 'vgmplaySkippedName';
				text.textContent = game.name || game.archiveName || 'Unknown Game';
				text.onclick = (e) => { e.preventDefault(); cb.checked = !cb.checked; };
				firstCol.appendChild(text);

				item.appendChild(firstCol);
				listContainer.appendChild(item);
			}

			selectAllBtn.onclick = () => {
				const allChecked = hostCheckboxes.every(cb => cb.checked);
				hostCheckboxes.forEach(cb => cb.checked = !allChecked);
				selectAllBtn.textContent = !allChecked ? 'Deselect All' : 'Select All';
			};
		}

		win.appendChild(listContainer);

		const footer = document.createElement('div');
		footer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 10px; gap: 10px;';

		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'vgmplaySettingsCheckCache';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.onclick = () => this._hideSelectiveCacheClearPrompt();
		footer.appendChild(cancelBtn);

		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'vgmplaySettingsClearCache';
		deleteBtn.textContent = 'Delete Selected';
		deleteBtn.style.background = '#aa3333';
		deleteBtn.onclick = async () => {
			const cbs = win.querySelectorAll('.vgmplay-cache-cb:checked');
			const fingerprints = Array.from(cbs).map(cb => cb.dataset.fingerprint);
			if (!fingerprints.length) return;

			deleteBtn.textContent = 'Deleting...';
			deleteBtn.disabled = true;

			if (this._deleteGamesFromCache) {
				await this._deleteGamesFromCache(fingerprints);
			}

			this._hideSelectiveCacheClearPrompt();
			// Re-open if there are still games left, else keep closed
			if (this.games && this.games.length && this.games.some(g => g._fromCache)) {
				this._showSelectiveCacheClearPrompt();
			} else {
				// if cache is now empty, just refresh the skipped downloads area
				if (this._renderSkippedDownloads) this._renderSkippedDownloads();
			}
		};
		footer.appendChild(deleteBtn);

		win.appendChild(footer);
	};

	VGMPlay_js.prototype._showCacheClearPrompt = function () {
		if (!this.settingsWindow || !this.settingsContent) return;

		this.settingsContent.innerHTML = `
<div class="vgmplaySettingsMenu">
<div class="vgmplaySkippedAutoText">Delete all cache?</div>
<div class="vgmplaySkippedAutoActions">
<button class="vgmplayCacheClearYes">Yes</button>
<button class="vgmplayCacheClearNo">No</button>
</div>
</div>
`;

		const yesBtn = this.settingsContent.querySelector('.vgmplayCacheClearYes');
		const noBtn = this.settingsContent.querySelector('.vgmplayCacheClearNo');

		if (yesBtn) {
			yesBtn.addEventListener('click', () => {
				if (this.clearCache) this.clearCache();
				this._hideSettingsWindow();
			});
		}
		if (noBtn) {
			noBtn.addEventListener('click', () => {
				this._hideSettingsWindow();
			});
		}

		this.settingsWindow.style.display = 'block';
		this._positionSettingsWindow();
	};

VGMPlay_js.prototype._positionSettingsWindow = function () {
	if (!this.settingsWindow || !this.playerWindow) return;
	if (this.settingsWindow.style.display === 'none') return;

	const playerRect = this.playerWindow.getBoundingClientRect();
	const skippedVisible = this.skippedWindowVisible && this.skippedWindow && this.skippedWindow.style.display !== 'none';
	const isMobile = window.innerWidth <= 600;
	const settingsWidth = this.settingsWindow.offsetWidth || 360;
	const settingsHeight = this.settingsWindow.offsetHeight || 400;

	if (isMobile) {
		this.settingsWindow.style.position = 'fixed';
		this.settingsWindow.style.left = '10px';
		const desiredTop = playerRect.bottom + 10;
		const maxTop = Math.max(10, window.innerHeight - settingsHeight - 20);
		this.settingsWindow.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + 'px';
	} else if (skippedVisible) {
		const skippedRect = this.skippedWindow.getBoundingClientRect();
		this.settingsWindow.style.position = 'fixed';
		const desiredLeft = skippedRect.left;
		const maxLeft = Math.max(0, window.innerWidth - settingsWidth - 10);
		this.settingsWindow.style.left = Math.min(desiredLeft, maxLeft) + 'px';
		const desiredTop = skippedRect.bottom + 10;
		const maxTop = Math.max(10, window.innerHeight - settingsHeight - 20);
		this.settingsWindow.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + 'px';
	} else {
		this.settingsWindow.style.position = 'fixed';
		const desiredLeft = playerRect.right + 10;
		const maxLeft = Math.max(0, window.innerWidth - settingsWidth - 10);
		this.settingsWindow.style.left = Math.min(desiredLeft, maxLeft) + 'px';
		const desiredTop = playerRect.top;
		const maxTop = Math.max(10, window.innerHeight - settingsHeight - 20);
		this.settingsWindow.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + 'px';
	}
};

	VGMPlay_js.prototype._setupTooltips = function () {
		const buttons = this.playerWindow.querySelectorAll('button');
		const tracks = this.vgmplayContainer.querySelectorAll('.vgmplayTrack');
		const targets = [...buttons, ...tracks];
		const idDescriptions = {
			'buttonTogglePlayback': (this.isExtension ? 'Play/Pause (C)' : 'Play/Pause (Space)'),
			'btnPrev': 'Previous Track (P)',
			'btnNext': 'Next Track (N)',
			'btnStop': 'Stop',
			'btnBass': 'Bass Boost (B)',
			'btnReverb': 'Reverb (V)',
			'btnRandom': 'Shuffle game/all (R)',
			'btnLoop': 'Loop track/game (L)',
			'btnAdditional': 'Additional Information (A)',
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
		if (this.settingsWindow && this.settingsWindow.style.display !== 'none') {
			this._hideSettingsWindow();
		} else {
			this._showSettingsWindow();
		}
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
		this._log && this._log('UI', 'Debug snapshot:', snapshot);
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
		this._updateSkippedCacheSize();
		if (this.skippedHarvestMore) {
			this._renderHarvestMorePrompt();
		}
		if (this.skippedCacheClear) {
			this._renderCacheClearPrompt();
		}

		if (this.skippedContentEl) {
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

	VGMPlay_js.prototype.toggleSkippedWindow = function () {
		if (this.skippedWindowVisible) {
			this._hideSkippedWindow(true);
		} else {
			if (!this.skippedWindow) return;
			// Ensure it has something to show
			this._renderSkippedDownloads();
			this.skippedWindow.style.display = 'block';
			this.skippedWindowVisible = true;
			this._positionSkippedWindow();
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

	VGMPlay_js.prototype._updateSkippedCacheSize = function () {
		if (!this.skippedCacheSize || !this._getTotalCacheSize) return;
		const totalBytes = this._getTotalCacheSize();
		this.skippedCacheSize.innerHTML = `<div class="vgmplaySkippedCacheSizeText">Total Cache Size: ${this._formatBytes(totalBytes)}</div>`;
	};

	VGMPlay_js.prototype._formatBytes = function (bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	VGMPlay_js.prototype._renderHarvestMorePrompt = function () {
		if (!this.skippedHarvestMore) return;
		// Don't show the button while the bulk-load prompt is already open
		if (this._bulkLoadPromptVisible) {
			this.skippedHarvestMore.innerHTML = '';
			return;
		}

		let validCandidates = [];
		if (this.lastHarvestedCandidates && this.lastHarvestedCandidates.length > 0) {
			validCandidates = this.lastHarvestedCandidates.filter(c => {
				const filename = this._getFileNameFromUrl(c.url);
				const alreadyLoaded = this.zipURLLoaded && this.zipURLLoaded.some(u => u === c.url || u.startsWith(filename + ':'));
				const alreadyPending = this.zipURLPending && this.zipURLPending.includes(c.url);
				const alreadyCounted = this.autoOverflowURLs && this.autoOverflowURLs.includes(c.url);
				const inCache = this._isUrlInCache && this._isUrlInCache(c.url);
				return !alreadyLoaded && !alreadyPending && !alreadyCounted && !inCache;
			});
		}

		if (validCandidates.length > 0) {
			this.skippedHarvestMore.innerHTML = `
				<div class="vgmplaySkippedAutoLimit">
					<div class="vgmplaySkippedAutoText" style="margin-top:8px;">${validCandidates.length} more files available on this page.</div>
					<div class="vgmplaySkippedAutoActions" style="margin-bottom:8px;">
						<button class="vgmplayHarvestMoreBtn" style="background:#2a2a4a;border-color:#4a4a6a;">Download more music from this site</button>
					</div>
				</div>
			`;
			const btn = this.skippedHarvestMore.querySelector('.vgmplayHarvestMoreBtn');
			if (btn) {
				btn.addEventListener('click', () => {
					if (this._showBulkLoadPrompt) {
						this._showBulkLoadPrompt(validCandidates);
						this._hideSkippedWindow(true);
					}
				});
			}
		} else {
			this.skippedHarvestMore.innerHTML = '';
		}
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

	VGMPlay_js.prototype._addInfoNotice = function (msg) {
		if (!msg) return;
		if (this.noPlayableNotices.includes(msg)) return;
		this.noPlayableNotices.push(msg);
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._removeInfoNotice = function (msg) {
		if (!msg) return;
		const idx = this.noPlayableNotices.indexOf(msg);
		if (idx === -1) return;
		this.noPlayableNotices.splice(idx, 1);
		this._renderSkippedDownloads();
		if (this.noPlayableNotices.length === 0 && this.games.length === 0) {
			this._hideSkippedWindow && this._hideSkippedWindow();
		}
	};

	VGMPlay_js.prototype._addNoPlayableNotice = function (name, opts = null) {
		const safeName = name || 'File';
		let msg = `${safeName} did not contain playable music for VGMPlay!`;
		if (opts && opts.isMuntRom) {
			msg = opts.fromCache
				? `Munt ROM file ${safeName} loaded from cache.`
				: `Munt ROM file ${safeName} uploaded and saved to root.`;
		} else if (opts && opts.isMoonsoundSample) {
			msg = `MWK sample library ${safeName} loaded for MWM playback.`;
		} else if (opts && opts.isRom) {
			const lower = String(safeName).toLowerCase();
			if (lower === 'yrw801.rom') {
				msg = opts.fromCache
					? `yrw801.rom loaded from cache, playback of VGM files using YMF278B will work now.`
					: `yrw801.rom loaded, playback of VGM files using YMF278B will work now.`;
			} else if (lower === 'waves.dat') {
				msg = opts.fromCache
					? `waves.dat loaded from cache, playback of MWM files using MoonSound will work now.`
					: `waves.dat loaded, playback of MWM files using MoonSound will work now.`;
			}
		} else if (opts && opts.isMidiArchive) {
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

	VGMPlay_js.prototype._confirmSingleFileOverwrite = function (name) {
		return new Promise((resolve) => {
			const root = this.vgmplayContainer || document.body;
			const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
			const previous = uiRoot.getElementById('vgmplay-overwrite-prompt');
			if (previous) previous.remove();

			const prompt = document.createElement('div');
			prompt.id = 'vgmplay-overwrite-prompt';
			prompt.className = 'vgmplaySettingsWindow';
			prompt.style.cssText = 'display:block;position:fixed;z-index:100001;top:50%;left:50%;transform:translate(-50%,-50%);';

			const text = document.createElement('div');
			text.className = 'vgmplaySettingsContent';
			text.textContent = `${name || 'File'} already exists. Overwrite it?`;
			prompt.appendChild(text);

			const actions = document.createElement('div');
			actions.className = 'vgmplaySkippedAutoActions';
			const yesBtn = document.createElement('button');
			yesBtn.className = 'vgmplaySettingsClearCache';
			yesBtn.textContent = 'Yes';
			const noBtn = document.createElement('button');
			noBtn.className = 'vgmplaySettingsCheckCache';
			noBtn.textContent = 'No';
			actions.appendChild(yesBtn);
			actions.appendChild(noBtn);
			text.appendChild(actions);

			const finish = (overwrite) => {
				if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeyDown);
				prompt.remove();
				resolve(overwrite);
			};
			const onKeyDown = (event) => {
				if (event.key === 'Escape') finish(false);
			};
			yesBtn.onclick = () => finish(true);
			noBtn.onclick = () => finish(false);
			if (typeof window !== 'undefined') window.addEventListener('keydown', onKeyDown);

			if (this.vgmplayContainer && this.vgmplayContainer.appendChild) {
				this.vgmplayContainer.appendChild(prompt);
			} else {
				document.body.appendChild(prompt);
			}
			noBtn.focus();
		});
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

	VGMPlay_js.prototype._showWavesDatError = function () {
		const msg = "MoonSound playback requires the file waves.dat.\n\nPlease upload it by dragging the file onto the 'Insert music files/archives here!' field.";
		if (!this.noPlayableNotices.includes(msg)) {
			this.noPlayableNotices.push(msg);
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	};

	VGMPlay_js.prototype._showMoonsoundSampleError = function () {
		const msg = "This MWM track requires a MWK sample library that is not loaded.\n\nPlease upload the matching .mwk file by dragging it onto the 'Insert music files/archives here!' field.";
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
			const maxTop = Math.max(10, window.innerHeight - this.skippedWindow.offsetHeight - 20);
			this.skippedWindow.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + "px";
		} else {
				const desiredLeft = playerLeft + playerWidth + gap;
				this.skippedWindow.style.right = "auto";
				this.skippedWindow.style.left = desiredLeft + "px";
				this.skippedWindow.style.top = playerTop + "px";
			}
		});

		VGMPlay_js.prototype._showExportModal = function () {
			if (this._exportModalVisible) return;
			this._exportModalVisible = true;
			this._exportSelectedGames = new Set();
			this._renderExportModal();
		};

		VGMPlay_js.prototype._hideExportModal = function () {
			this._exportModalVisible = false;
			if (this._exportModalEl) {
				this._exportModalEl.remove();
				this._exportModalEl = null;
			}
			this._exportSelectedGames = null;
		};

		VGMPlay_js.prototype._renderExportModal = function () {
			if (!this._exportModalVisible) return;

			let modal = this._exportModalEl;
			if (!modal) {
				modal = document.createElement('div');
				modal.className = 'vgmplayExportModal';
				this._exportModalEl = modal;
				if (this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(modal);
				} else if (this.shadowRoot) {
					this.shadowRoot.appendChild(modal);
				} else {
					document.body.appendChild(modal);
				}
			}

			const games = Array.isArray(this.games) ? this.games : [];
			const unexportedGames = games.filter(g => g && !g._exported);
			const allSelected = this._exportSelectedGames ? this._exportSelectedGames.size === games.length : false;

			let listHtml = '';
			for (const game of games) {
				if (!game) continue;
				const name = game.name || game.archiveName || 'Unknown';
				const selected = this._exportSelectedGames && this._exportSelectedGames.has(game);
				const exported = game._exported;
				listHtml += `
      <div class="vgmplayExportGameRow" data-game-id="${game._id || games.indexOf(game)}">
        <input type="checkbox" class="vgmplayExportGameCheckbox" ${selected ? 'checked' : ''} ${exported ? 'data-exported="true"' : ''}>
        <span class="vgmplayExportGameName">${this._escapeHtml(name)}</span>
        ${exported ? '<span class="vgmplayExportGameBadge">Exported</span>' : ''}
      </div>
    `;
			}

			modal.innerHTML = `
    <div class="vgmplayExportModalContent">
      <div class="vgmplayExportModalHeader">
        <h3>Export Music</h3>
        <button class="vgmplayExportModalClose">&times;</button>
      </div>
      <div class="vgmplayExportModalBody">
        <div class="vgmplayExportActions">
          <button class="vgmplayExportSelectAll">Select all (${games.length})</button>
          <button class="vgmplayExportSelectNew">Select new (${unexportedGames.length})</button>
          <button class="vgmplayExportDeselectAll">Deselect all</button>
        </div>
        <div class="vgmplayExportGameList">${listHtml}</div>
        <div class="vgmplayExportStatus">${this._exportStatusText || ''}</div>
      </div>
      <div class="vgmplayExportModalFooter">
        <button class="vgmplayExportCancel">Cancel</button>
        <button class="vgmplayExportNow ${this._exportSelectedGames && this._exportSelectedGames.size > 0 ? '' : 'disabled'}">Export Now</button>
      </div>
    </div>
  `;

			this._bindExportModalEvents();
		};

		VGMPlay_js.prototype._bindExportModalEvents = function () {
			const modal = this._exportModalEl;
			if (!modal) return;

			const closeBtn = modal.querySelector('.vgmplayExportModalClose');
			const cancelBtn = modal.querySelector('.vgmplayExportCancel');
			const exportNowBtn = modal.querySelector('.vgmplayExportNow');
			const selectAllBtn = modal.querySelector('.vgmplayExportSelectAll');
			const selectNewBtn = modal.querySelector('.vgmplayExportSelectNew');
			const deselectAllBtn = modal.querySelector('.vgmplayExportDeselectAll');
			const gameCheckboxes = modal.querySelectorAll('.vgmplayExportGameCheckbox');

			if (closeBtn) closeBtn.addEventListener('click', () => this._hideExportModal());
			if (cancelBtn) cancelBtn.addEventListener('click', () => this._hideExportModal());

			if (selectAllBtn) {
				selectAllBtn.addEventListener('click', () => {
					const games = Array.isArray(this.games) ? this.games : [];
					this._exportSelectedGames = new Set(games.filter(g => g));
					this._renderExportModal();
				});
			}

			if (selectNewBtn) {
				selectNewBtn.addEventListener('click', () => {
					const games = Array.isArray(this.games) ? this.games : [];
					this._exportSelectedGames = new Set(games.filter(g => g && !g._exported));
					this._renderExportModal();
				});
			}

			if (deselectAllBtn) {
				deselectAllBtn.addEventListener('click', () => {
					this._exportSelectedGames = new Set();
					this._renderExportModal();
				});
			}

			gameCheckboxes.forEach((cb, idx) => {
				cb.addEventListener('change', (e) => {
					const games = Array.isArray(this.games) ? this.games : [];
					const game = games[idx];
					if (!game) return;
					if (e.target.checked) {
						this._exportSelectedGames.add(game);
					} else {
						this._exportSelectedGames.delete(game);
					}
					const listEl = modal.querySelector('.vgmplayExportGameList');
					const scrollTop = listEl ? listEl.scrollTop : 0;
					this._renderExportModal();
					const newListEl = this._exportModalEl ? this._exportModalEl.querySelector('.vgmplayExportGameList') : null;
					if (newListEl) newListEl.scrollTop = scrollTop;
				});
			});

			if (exportNowBtn && !exportNowBtn.classList.contains('disabled')) {
				exportNowBtn.addEventListener('click', () => this._performExport());
			}
		};

		VGMPlay_js.prototype._escapeHtml = function (text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		};

		VGMPlay_js.prototype._performExport = async function () {
			const selectedGames = Array.from(this._exportSelectedGames || []);
			if (selectedGames.length === 0) {
				this._exportStatusText = 'No games selected';
				this._renderExportModal();
				return;
			}

			this._exportStatusText = 'Preparing export...';
			this._renderExportModal();

			try {
				const zip = await this._createExportZip(selectedGames);
				const blob = new Blob([zip], { type: 'application/zip' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = 'vgmplay-export-' + new Date().toISOString().slice(0, 10) + '.zip';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				for (const game of selectedGames) {
					if (game) game._exported = true;
				}

				this._exportStatusText = `Exported ${selectedGames.length} game(s)`;
				this._renderExportModal();
			} catch (err) {
				this._logError && this._logError('UI', 'Export failed:', err);
				this._exportStatusText = 'Export failed: ' + err.message;
				this._renderExportModal();
			}
		};

		VGMPlay_js.prototype._createExportZip = async function (games) {
			const addedPaths = new Set();
			const files = [];

			for (const game of games) {
				if (!game) continue;
				const gameName = game.name || game.archiveName || 'Unknown';
				const safeName = gameName.replace(/[<>:"/\\|?*]/g, '_');
				const gamePath = safeName;

				const coverPath = game.coverPath || game.png;
				if (coverPath) {
					try {
						const data = FS.readFile(coverPath);
						const ext = coverPath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
						const coverFile = gamePath + '/cover.' + ext;
						if (!addedPaths.has(coverFile)) {
							files.push({ path: coverFile, data: new Uint8Array(data) });
							addedPaths.add(coverFile);
						}
					} catch (e) { }
				}

				const gameFiles = Array.isArray(game.files) ? game.files : [];
				for (const file of gameFiles) {
					if (!file || !file.filepath) continue;
					try {
						const data = FS.readFile(file.filepath);
						const fileName = file.filepath.split('/').pop();
						const filePath = gamePath + '/' + fileName;
						if (!addedPaths.has(filePath)) {
							files.push({ path: filePath, data: new Uint8Array(data) });
							addedPaths.add(filePath);
						}
					} catch (e) { }
				}

				const meta = {
					name: game.name,
					archiveName: game.archiveName,
					exportedAt: new Date().toISOString()
				};
				const metaJson = JSON.stringify(meta, null, 2);
				const metaFile = gamePath + '/game.json';
				if (!addedPaths.has(metaFile)) {
					files.push({ path: metaFile, data: new TextEncoder().encode(metaJson) });
					addedPaths.add(metaFile);
				}
			}

			const zipBlob = this._createZipBlob(files);
			return zipBlob;
		};

		VGMPlay_js.prototype._createZipBlob = function (files) {
			const encoder = new TextEncoder();
			const localFileHeaders = [];
			const centralDirectory = [];
			let offset = 0;

			const crcTable = new Uint32Array(256);
			for (let i = 0; i < 256; i++) {
				let c = i;
				for (let j = 0; j < 8; j++) {
					c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
				}
				crcTable[i] = c;
			}

			function crc32(data) {
				let crc = 0xFFFFFFFF;
				for (let i = 0; i < data.length; i++) {
					crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
				}
				return (crc ^ 0xFFFFFFFF) >>> 0;
			}

			function writeUint32LE(arr, pos, val) {
				arr[pos] = val & 0xFF;
				arr[pos + 1] = (val >>> 8) & 0xFF;
				arr[pos + 2] = (val >>> 16) & 0xFF;
				arr[pos + 3] = (val >>> 24) & 0xFF;
			}

			function writeUint16LE(arr, pos, val) {
				arr[pos] = val & 0xFF;
				arr[pos + 1] = (val >>> 8) & 0xFF;
			}

			for (const file of files) {
				const pathBytes = encoder.encode(file.path);
				const crc = crc32(file.data);
				const compressed = file.data;

				const localHeader = new Uint8Array(30 + pathBytes.length);
				writeUint32LE(localHeader, 0, 0x04034B50);
				writeUint16LE(localHeader, 4, 20);
				writeUint16LE(localHeader, 6, 0);
				writeUint16LE(localHeader, 8, 0);
				writeUint16LE(localHeader, 10, 0);
				writeUint32LE(localHeader, 12, crc);
				writeUint32LE(localHeader, 16, compressed.length);
				writeUint32LE(localHeader, 20, file.data.length);
				writeUint16LE(localHeader, 24, pathBytes.length);
				writeUint16LE(localHeader, 26, 0);
				localHeader.set(pathBytes, 30);

				localFileHeaders.push({
					header: localHeader,
					path: pathBytes,
					data: compressed,
					crc: crc,
					offset: offset,
					pathStr: file.path
				});

				offset += 30 + pathBytes.length + compressed.length;
			}

			const centralDirStart = offset;
			for (const f of localFileHeaders) {
				const centralHeader = new Uint8Array(46 + f.path.length);
				writeUint32LE(centralHeader, 0, 0x02014B50);
				writeUint16LE(centralHeader, 4, 20);
				writeUint16LE(centralHeader, 6, 20);
				writeUint16LE(centralHeader, 8, 0);
				writeUint16LE(centralHeader, 10, 0);
				writeUint16LE(centralHeader, 12, 0);
				writeUint32LE(centralHeader, 14, f.crc);
				writeUint32LE(centralHeader, 18, f.data.length);
				writeUint32LE(centralHeader, 22, f.data.length);
				writeUint16LE(centralHeader, 26, f.path.length);
				writeUint16LE(centralHeader, 28, 0);
				writeUint16LE(centralHeader, 30, 0);
				writeUint16LE(centralHeader, 32, 0);
				writeUint16LE(centralHeader, 34, 0);
				writeUint32LE(centralHeader, 36, 0);
				writeUint32LE(centralHeader, 40, f.offset);
				centralHeader.set(f.path, 46);

				centralDirectory.push({
					header: centralHeader,
					path: f.path
				});
				offset += 46 + f.path.length;
			}

			const centralDirEnd = offset;
			const endRecord = new Uint8Array(22);
			writeUint32LE(endRecord, 0, 0x06054B50);
			writeUint16LE(endRecord, 4, 0);
			writeUint16LE(endRecord, 6, 0);
			writeUint16LE(endRecord, 8, localFileHeaders.length);
			writeUint16LE(endRecord, 10, localFileHeaders.length);
			writeUint32LE(endRecord, 12, centralDirEnd - centralDirStart);
			writeUint32LE(endRecord, 16, centralDirStart);
			writeUint16LE(endRecord, 20, 0);

			const totalLength = localFileHeaders.reduce((sum, f) => sum + f.header.length + f.path.length + f.data.length, 0) +
				centralDirectory.reduce((sum, c) => sum + c.header.length, 0) + 22;
			const result = new Uint8Array(totalLength);
			let pos = 0;

			for (const f of localFileHeaders) {
				result.set(f.header, pos); pos += f.header.length;
				result.set(f.path, pos); pos += f.path.length;
				result.set(f.data, pos); pos += f.data.length;
			}

			for (const c of centralDirectory) {
				result.set(c.header, pos); pos += c.header.length;
			}

			result.set(endRecord, pos);

			return new Blob([result], { type: 'application/zip' });
		};
	};
}
