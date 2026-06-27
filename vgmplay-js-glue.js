'use strict';

class VGMPlay_js {

	constructor(options = {}) {
		window.vgmplay_js = this; // Ensure global access for UI handlers
		window.vgmPlayInstance = this;
		// Load debug mode from localStorage first, before any other code runs
		if (typeof window !== 'undefined') {
			try {
				const savedDebug = localStorage.getItem('vgm_debug_mode');
				window.__VGM_DEBUG__ = savedDebug === 'true';
			} catch (e) {
				window.__VGM_DEBUG__ = false;
			}
		}

		// --- Android Auto Integration Bridge ---
		window.vgmPlayerInterface = {
			nextTrack: () => this.changeTrack('next'),
			prevTrack: () => this.changeTrack('prev'), // Falls back to prev or next
			play: () => this.play(),
			pause: () => this.pause()
		};

		this.isPlaybackPaused = true;
		this.isWebAudioInitialized = false;
		this.functionsWrapped = false;
		this.isVGMLoaded = false;
		this.generatingAudio = false;
		this.isVGMPlaying = false;
		this.zipURLLoaded = [];
		this.useAsLibrary = options.useAsLibrary || false;
		this.displayTitleWindow = true;
		this.displayPlayer = true;
		this.displayZipFileList = true;
		this.showZipFileListWindow = true;
		this.bassBoostEnabled = false;
		this.reverbEnabled = false;
		this.isRandomEnabled = false;
		this.randomMode = 0; // 0=off,1=game,2=all
		this.loopMode = 0; // 0=off,1=track,2=game
		this.currentTrackSupportsLoop = false;
		this.games = [];
		this.activeGame = "";
		this.amountOfGamesLoaded = 0;
		this.zipQueue = [];
		this.isProcessingQueue = false;
		this.sampleRate = "";
		this.trackLengthHumanReadeable = false;
		this.largeDownloadLimitBytes = 7.5 * 1024 * 1024;
		this.standalone = this._normalizeBool(options.standalone);
		this.isLibrary = this._normalizeBool(options.library);
		this.analyzerPreset = 'linePrism';
		this.rightPanelMode = 'linePrism';
		this.isMobile = this._isMobileDevice();
		this._mobileIdleTimer = null;
		this.skippedDownloads = [];
		this.skippedWindowVisible = false;
		this.windowDragTarget = null;
		this.windowPos1 = 0;
		this.windowPos2 = 0;
		this.windowPos3 = 0;
		this.windowPos4 = 0;
		this.zipURLPending = [];
		this._isLoadingFile = false;
		this._loadLock = Promise.resolve();
		this.archiveWorker = null;
		this._archiveWorkerJobs = new Map();
		this._archiveWorkerSeq = 1;
		this._backgroundExtractJobs = new Map();
		this._backgroundExtractSeq = 1;
		this.pendingZipRender = false;
		this._lastSeekAt = 0;
		this._lastSeekWasMUS = false;
		this._lastLoopToggleAt = 0;
		this._loopBaseSamplesByTrack = new Map();
		this.showMemoryStats = false;
		this._memoryBaselineUsed = null;
		this.searchQuery = "";
		this.searchBarVisible = false;
		this._searchGlobalKeyHandler = null;
		this.isKSSActive = false;
		this.kssAnalyzerActive = false;
		this.kssOverlayEl = null;
		this.kssOverlayRows = [];
		this.kssMiniOverlayEl = null;
		this.kssMiniOverlayRows = [];
		this._kssMiniOverlayResizeBound = false;
		this.kssOverlayDefs = [];
		this.kssChannelDefs = [];
		this.kssChannelStates = [];
		this.kssChannelRows = [];
		this.kssPerChPtr = 0;
		this._kssPerChStride = 0;
		this._kssPerChSamples = 0;
		this._kssPerChLatest = null;
		this._kssFft = null;
		this.kssDeviceActivity = {};
		this.kssDeviceActiveMask = 0;
		this.kssDeviceBaseMask = 0;
		this.kssDeviceDetectedMask = 0;
		this._kssDeviceScanDefs = null;
		this._kssDeviceScanPeaks = null;
		this._kssDeviceScanFrames = 0;
		this._kssDeviceScanDone = false;
		this._failedImageProbeCount = 0;
		this._suppressImageGuesses = false;
		this._imageProbePromise = Promise.resolve();
		this._mousetrapStopCallbackPatched = false;
		// No auto-download cap in full standalone mode (desktop or mobile)
		this.autoDownloadLimit = this.standalone ? Number.POSITIVE_INFINITY : 10;
		this.autoDownloadBytesLimit = this.standalone ? Number.POSITIVE_INFINITY : (5 * 1024 * 1024);
		this.autoDownloadCount = 0;
		this.autoDownloadBytes = 0;
		this.autoCacheHits = 0;
		this.autoOverflowURLs = [];
		this.autoOverflowSizes = new Map();
		this.noPlayableNotices = [];
		this.autoScanDist = (typeof options.autoScanDist === 'undefined') ? this.standalone : !!options.autoScanDist;
		this.autoScanDistBase = options.autoScanDistBase || 'dist/';
		this._autoScanDistDone = false;
		this._pendingRomLoads = [];
		this._pendingRomRetryScheduled = false;
		this._pendingExternalGameImages = {};
		this.debugMode = this._loadDebugModeSetting();
		this.debugModeHasBeenToggled = false;
		this._debugSettingsWindowVisible = false;
		this._debugPrefixes = {};
		this._loadDebugPrefixSettings();
		if (this.debugMode && typeof window !== 'undefined') {
			window.__VGM_DEBUG__ = true;
		}
		this.sharedCache = this._normalizeBool(options.sharedCache);
		this._settingsMenuVisible = false;
		this._settingsStatusText = '';

		this.pos1 = 0;
		this.pos2 = 0;
		this.pos3 = 0;
		this.pos4 = 0;
		this.trackListTransformX = 0;
		this.trackListTransformY = 0;
		this.standaloneGroupTransformX = 0;
		this.standaloneGroupTransformY = 0;
		this.libraryState = 0; // 0: Attached, 1: Floating, 2: Hidden, 3: Overview

		// Playback tracking
		this.playbackStartTime = 0;
		this.startSample = 0;
		this.visualSamplePosition = 0;
		this.emulatorFinished = false;

		// Bind dragging methods (check if they exist first, as they may be added by modules)
		if (this.elementDrag) this.elementDrag = this.elementDrag.bind(this);
		if (this.stopDrag) this.stopDrag = this.stopDrag.bind(this);
		if (this.dragStart) this.dragStart = this.dragStart.bind(this);

		// Determine base URL
		this.baseURL = options.baseURL || '';
		const resolveBaseFromScript = () => {
			try {
				const currentScript = document.currentScript;
				if (currentScript && currentScript.src) {
					this.baseURL = currentScript.src.substring(0, currentScript.src.lastIndexOf('/') + 1);
				}
			} catch (e) { }
		};
		if (!this.baseURL) {
			resolveBaseFromScript();
		}
		if (!this.baseURL && typeof window !== 'undefined' && window.location) {
			try {
				const url = new URL('.', window.location.href);
				this.baseURL = url.toString();
			} catch (e) { }
		}
		if ((!this.baseURL || (!this.baseURL.startsWith('chrome-extension://') && !this.baseURL.startsWith('moz-extension://'))) && this.isExtension && window.__VGM_DEBUG__) {
			console.error('[VGM] Failed to determine correct baseURL for extension. BaseURL:', this.baseURL);
		}
		this.isExtension = !!(options && options.shadowRoot && options.container);
		if (!this.isExtension && this.baseURL) {
			this.isExtension = this.baseURL.startsWith('chrome-extension://') || this.baseURL.startsWith('moz-extension://');
		}
		let cacheBust = false;
		try {
			if (typeof options.cacheBust !== 'undefined') {
				cacheBust = !!options.cacheBust;
			} else if (typeof window !== 'undefined' && window.location) {
				const host = window.location.hostname || '';
				cacheBust = host === 'localhost' || host === '127.0.0.1';
			}
		} catch (e) { }
		this._cacheBust = cacheBust;
		const cacheSuffix = this._cacheBust ? ('?v=' + Date.now()) : '';

		// Define Emscripten Module object before loading vgmplay-js.js
		if (typeof window !== 'undefined') {
			window.Module = window.Module || {};
			if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
			if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
			const base = this.baseURL;
			window.Module.print = (text) => { console.log(text); };
			window.Module.printErr = (text) => { console.error(text); };
			window.Module.locateFile = function (path, prefix) {
				if (path.endsWith(".data") || path.endsWith(".wasm")) return base + path + cacheSuffix;
				return prefix + path + cacheSuffix;
			};
			const prevInit = window.Module.onRuntimeInitialized;
			window.Module.onRuntimeInitialized = function () {
				window.__VGM_RUNTIME_READY__ = true;
				if (typeof prevInit === 'function') {
					try { prevInit(); } catch (e) { }
				}
				if (window.vgmplay_js && window.vgmplay_js.loadWhenReady) {
					window.vgmplay_js.loadWhenReady();
				}
			};
		}

		// Load core scripts unless already preloaded in extension content script mode
		const skipCoreScripts = options && options.extensionContentScript;
		if (!skipCoreScripts) {
			// Ensure baseURL is correct before loading
			if (!this.baseURL) {
				resolveBaseFromScript();
			}
			var script = document.createElement("script");
			script.src = this.baseURL + "vgmplay-js.js" + cacheSuffix;

			document.head.appendChild(script);
		}

		// Handle UI initialization
		if (!this.useAsLibrary) {
			// Load Mousetrap only if not in extension context (extensions can't load external scripts)
			const isExtension = this.baseURL && (this.baseURL.startsWith('chrome-extension://') || this.baseURL.startsWith('moz-extension://'));
			if (!isExtension) {
				var script2 = document.createElement("script");
				script2.src = "https://cdnjs.cloudflare.com/ajax/libs/mousetrap/1.4.6/mousetrap.min.js";
				document.head.appendChild(script2);
			}

			// Skip creating link element for extension - CSS is loaded via fetch in background.js
			// This prevents double-loading of CSS which causes specificity issues
			if (!options.shadowRoot) {
				var link = document.createElement('link');
				link.rel = 'stylesheet';
				link.type = 'text/css';
				link.href = this.baseURL + 'css/style.css' + cacheSuffix;
				document.head.appendChild(link);
			}

			// Container logic
			if (options.container) {
				this.vgmplayContainer = options.container;
			} else {
				this.vgmplayContainer = document.createElement('div');
				this.vgmplayContainer.id = "vgmplayContainer";
				document.body.insertBefore(this.vgmplayContainer, document.body.firstChild);
			}
			if (this.isLibrary) {
				this.vgmplayContainer.style.display = 'none';
			}
			this.vgmplayContainer.className = this.standalone ? "vgmplayContainer vgmplayStandalone" : "vgmplayContainer";
			if (this.standalone && this.isMobile) {
				this.vgmplayContainer.classList.add('vgmplayMobile');
			}

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

			// Extension case: create the panel structure (but elements will be in container directly for non-grid mode)
			if (!this.standalone) {
				this.standaloneLeft = document.createElement('div');
				this.standaloneLeft.className = 'vgmplayStandaloneLeft';
				this.vgmplayContainer.appendChild(this.standaloneLeft);

				this.standaloneGroup = document.createElement('div');
				this.standaloneGroup.className = 'vgmplayStandaloneGroup';
				this.standaloneLeft.appendChild(this.standaloneGroup);

				this.standaloneRight = document.createElement('div');
				this.standaloneRight.className = 'vgmplayStandaloneRight';
				this.vgmplayContainer.appendChild(this.standaloneRight);

				this.standaloneGameGrid = document.createElement('div');
				this.standaloneGameGrid.className = 'vgmplayStandaloneGameGrid';
				this.standaloneGameGrid.style.display = 'none';
				this.standaloneRight.appendChild(this.standaloneGameGrid);

				// Note: tracksContainer, titleWindow, and playerWindow will be created in the container directly
				// and moved to the panel structure when entering grid mode
			}

			// Extension case: ensure container has proper dimensions and interactivity
			if (options.container && options.shadowRoot && !this.standalone) {
				if (window.__VGM_DEBUG__) {
					console.log('[VGM] Extension case detected, applying container styles');
				}
				// Default width for normal mode, will be overridden by grid mode CSS
				this.vgmplayContainer.style.cssText = 'position: fixed !important; top: 10px !important; left: 10px !important; bottom: 10px !important; width: 350px !important; height: auto !important; max-height: none !important; display: flex !important; flex-direction: column !important; overflow: visible !important; pointer-events: auto !important; z-index: 2147483647 !important;';
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

			// For standalone, use standaloneGroup as uiParent
			// For extension, use vgmplayContainer directly (elements will be moved to panel structure when entering grid mode)
			const uiParent = this.standalone ? this.standaloneGroup : this.vgmplayContainer;

			if (typeof vgmplaySettings !== 'undefined') {
				if (typeof vgmplaySettings.displayZipFileList !== 'undefined') {
					if (!vgmplaySettings.displayZipFileList) {
						this.displayZipFileList = false;
					}
				}
				if (typeof vgmplaySettings.displayPlayer !== 'undefined') {
					if (!vgmplaySettings.displayPlayer) {
						this.displayPlayer = false;
					}
				}
				if (typeof vgmplaySettings.displayTitleWindow !== 'undefined') {
					if (!vgmplaySettings.displayTitleWindow) {
						this.displayTitleWindow = false;
					}
				}
			}
			if (this.displayTitleWindow) {
				this.titleWindow = document.createElement('div');
				this.titleWindow.id = "vgmplayTitleWindow";
				uiParent.appendChild(this.titleWindow);
				this.titleWindow.className = "vgmplayTitleWindow";
				this.titleWindow.addEventListener("mousedown", this.dragStart);
				this._bindScrollProxy(this.titleWindow);

				this.titleContent = document.createElement('div');
				this.titleContent.className = 'vgmplayTitleContent';
				this.titleWindow.appendChild(this.titleContent);

				this.memoryOverlay = document.createElement('div');
				this.memoryOverlay.className = 'vgmplayMemoryOverlay';
				this.titleWindow.appendChild(this.memoryOverlay);

				this.infoOverlay = document.createElement('div');
				this.infoOverlay.className = 'vgmplayInfoOverlay';
				this.infoSpinner = document.createElement('div');
				this.infoSpinner.className = 'vgmplayInfoSpinner';
				this.infoOverlay.appendChild(this.infoSpinner);
				this.titleWindow.appendChild(this.infoOverlay);
			}
			if (this.displayPlayer) {
				this.playerWindow = document.createElement('div');
				this.playerWindow.id = "vgmplayPlayer";
				this.playerWindow.addEventListener("mousedown", this.dragStart);
				uiParent.appendChild(this.playerWindow);
				this.showPlayer();
				this._bindScrollProxy(this.playerWindow);
			}
			if (this.displayZipFileList) {
				// For extension, tracksContainer is created in the container directly (not in panel structure)
				// It will be moved to the panel structure when entering grid mode
				if (!this.tracksContainer) {
					this.tracksContainer = document.createElement('div');
					this.tracksContainer.id = "vgmplayTracksContainer";
					if (this.standalone) {
						this.standaloneLeft.appendChild(this.tracksContainer);
					} else {
						// For extension, add to container directly
						this.vgmplayContainer.appendChild(this.tracksContainer);
					}
				}

				this.zipFileListWindow = document.createElement('div');
				this.zipFileListWindow.id = "vgmplayZipFileList";
				this.tracksContainer.appendChild(this.zipFileListWindow);
				this.showZipFileListWindow = true;
				this.zipFileListWindow.className = "vgmplayZipFileListWindow";
				// Bind scroll proxy to prevent site background scrolling
				if (this._bindScrollProxy) {
					this._bindScrollProxy(this.zipFileListWindow);
				}

				this.loader = document.createElement('div');
				this.loader.className = 'vgmplayLoader';
				this.loader.innerHTML = 'Loading track data';
				this.zipFileListWindow.appendChild(this.loader);
			}
			this.setupDropZone();
			this._createSkippedWindow();
			if (this.standalone) {
				this._updateStandaloneRightPanel();
				if (this.isMobile) {
					this._initMobileUI();
				}
			}
		}

		this.currentFileKey = "";


	}

	_isMobileDevice() {
		if (typeof window === 'undefined') return false;
		const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
		const small = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
		return coarse || small;
	}

	_updateMemoryDisplay() {
		if (!Module._GetFreeMemory || !Module._GetTotalMemory || !Module._GetUsedMemory || !Module._GetHeapTopUsedMemory) return;

		const usedMem = Module._GetUsedMemory(); // allocator in-use
		const freeMem = Module._GetFreeMemory(); // allocator free blocks
		const totalMem = Module._GetTotalMemory(); // wasm heap size
		const heapTopUsed = Module._GetHeapTopUsedMemory(); // sbrk pointer
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
		}
	}

	_resetMobileIdleTimer() {
		if (!this.isMobile) return;
		if (this._mobileIdleTimer) clearTimeout(this._mobileIdleTimer);
		if (this.isPlaybackPaused) return;
		this._mobileIdleTimer = setTimeout(() => {
			this._setMobileView('analyzer');
		}, 5000);
	}

	_normalizeBool(value) {
		if (value === true) return true;
		if (value === false) return false;
		if (value === undefined || value === null) return false;
		if (typeof value === 'string') {
			const v = value.trim().toLowerCase();
			return v === 'true' || v === '1' || v === 'yes' || v === '';
		}
		return !!value;
	}

	_isTypingTarget() {
		const isTextEl = (el) => {
			if (!el) return false;
			const tag = el.tagName ? el.tagName.toLowerCase() : '';
			return tag === 'input' || tag === 'textarea' || el.isContentEditable;
		};
		if (isTextEl(document.activeElement)) return true;
		try {
			if (this.isExtension && this.shadowRoot && isTextEl(this.shadowRoot.activeElement)) return true;
		} catch (e) { }
		return false;
	}

	_eventIsTyping(e) {
		const isTextEl = (el) => {
			if (!el) return false;
			const tag = el.tagName ? el.tagName.toLowerCase() : '';
			return tag === 'input' || tag === 'textarea' || el.isContentEditable;
		};
		try {
			if (e && typeof e.composedPath === 'function') {
				const path = e.composedPath();
				for (const el of path) {
					if (isTextEl(el)) return true;
				}
			}
		} catch (err) { }
		return this._isTypingTarget();
	}

	setKeyBindings() {
		if (typeof Mousetrap === 'undefined') {
			if (this.isExtension && !this._extensionKeyFallback) {
				this._extensionKeyFallback = true;
				window.addEventListener('keydown', (e) => {
					const tgt = e.target;
					const tag = tgt && tgt.tagName ? tgt.tagName.toLowerCase() : '';
					const isTyping = this._eventIsTyping && this._eventIsTyping(e);
					if (tag === 'input' || tag === 'textarea' || (tgt && tgt.isContentEditable) || isTyping) {
						e.__vgmplayHandled = true;
						e.stopPropagation();
						return;
					}
					if (e.key === 'Escape') {
						if (this._handleEscapeKey && this._handleEscapeKey()) {
							e.preventDefault();
							return;
						}
					}
					if (e.key === 'd' || e.key === 'D') {
						if (this._debugSettingsWindowVisible) {
							this._hideDebugSettingsWindow();
						} else {
							this.toggleDebugMode();
						}
					}
					if (e.key === 'w' || e.key === 'W') {
						if (this._toggleCacheClearPrompt) this._toggleCacheClearPrompt();
					}
					if (e.key === 'c' || e.key === 'C') {
						this.togglePlayback();
					}
					if (e.key === 'n' || e.key === 'N') {
						this.changeTrack('next');
					}
					if (e.key === 'p' || e.key === 'P') {
						this.changeTrack('previous');
					}
					if (e.key === 'f' || e.key === 'F') {
						this.toggleDisplayZipFileListWindow();
					}
					if (e.key === 's' || e.key === 'S') {
						this.toggleSearchBar();
					}
					if (e.key === 'r' || e.key === 'R') {
						this.toggleRandomScope();
					}
					if (e.key === 'a' || e.key === 'A') {
						this.toggleSkippedWindow();
					}
					if (e.key === 'l' || e.key === 'L') {
						this.toggleLoopMode();
					}
					if (e.key === 'b' || e.key === 'B') {
						this.toggleBassBoost();
					}
					if (e.key === 'v' || e.key === 'V') {
						this.toggleReverb();
					}
				});
			}
			return;
		}
		if (this.isExtension && !this._typingGuardInstalled) {
			this._typingGuardInstalled = true;
			document.addEventListener('keydown', (e) => {
				if (this._eventIsTyping && this._eventIsTyping(e)) {
					e.__vgmplayHandled = true;
					e.stopImmediatePropagation();
				}
			}, true);
		}
		if (!this._mousetrapStopCallbackPatched && typeof Mousetrap !== 'undefined') {
			const prevStop = Mousetrap.stopCallback;
			Mousetrap.stopCallback = (e, element, combo) => {
				if (combo === 'space' && element && element.classList && element.classList.contains('vgmplayStandaloneSelect')) {
					return false;
				}
				if (e && e.__vgmplayHandled) return true;
				if (this.isExtension && element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)) {
					return true;
				}
				return prevStop ? prevStop(e, element, combo) : false;
			};
			this._mousetrapStopCallbackPatched = true;
		}
		if (!this.isLibrary) {
			window.addEventListener('keydown', function (e) {
				if (e.keyCode == 32) e.preventDefault();
			});

			if (!this.isExtension && !this.nativeMode) {
				Mousetrap.bind('space', (e) => {
					this.togglePlayback();
					return false;
				}, 'keydown');
			}
		}
		if (this.isExtension) {
			Mousetrap.bind('c', (e) => {
				if (this._eventIsTyping && this._eventIsTyping(e)) return;
				this.togglePlayback();
				return false;
			}, 'keydown');
		}
		Mousetrap.bind('n', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			if (this.libraryState === 1) return;
			if (this.nativeMode) {
				if (this._nativeLibraryApp) this._nativeLibraryApp.nextTrack();
				return false;
			}
			this.changeTrack('next');
		});
		Mousetrap.bind('p', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			if (this.libraryState === 1) return;
			if (this.nativeMode) {
				if (this._nativeLibraryApp) this._nativeLibraryApp.prevTrack();
				return false;
			}
			this.changeTrack('previous');
		});
		Mousetrap.bind('f', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleDisplayZipFileListWindow();
		});
		Mousetrap.bind('s', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleSearchBar();
		});
		Mousetrap.bind('r', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleRandomScope();
		});
		Mousetrap.bind('v', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleReverb();
		});
		Mousetrap.bind('b', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleBassBoost();
		});
		Mousetrap.bind('l', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleLoopMode();
		});
		Mousetrap.bind('m', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this._setMemoryStatsVisible(!this.showMemoryStats);
		});
		Mousetrap.bind('d', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			if (this._debugSettingsWindowVisible) {
				this._hideDebugSettingsWindow();
			} else {
				this.toggleDebugMode();
			}
		});
		Mousetrap.bind('a', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			this.toggleSkippedWindow();
		});
		Mousetrap.bind('w', (e) => {
			if (this._eventIsTyping && this._eventIsTyping(e)) return;
			if (this._toggleCacheClearPrompt) this._toggleCacheClearPrompt();
		});
	}

	loadWhenReady() {
		// This will be overridden by the harvester module if loaded.
		// If not overridden yet, we log and do nothing here; the async module loader
		// will call the updated version once all modules are ready.
		if (window.__VGM_DEBUG__) console.log('[VGM] loadWhenReady placeholder called (waiting for modules)');
	}

	_queueURL(url, forceLarge = false) {
		// Placeholder - will be replaced by vgmplay-queue.js
		console.warn('[VGM] _queueURL called before queue module loaded, queuing for later');
		if (!this._pendingQueueURLs) this._pendingQueueURLs = [];
		this._pendingQueueURLs.push({ url, forceLarge });
	}

	_processQueue() {
		// Placeholder - will be replaced by vgmplay-queue.js
		this._processQueuePending = true;
	}

	_defaultLoadWhenReady() {
		const scanNames = new Set();
		this.elms = document.getElementsByTagName("a");
		this.len = this.elms.length;
		for (var ii = 0; ii < this.len; ii++) {
			const lower = this.elms[ii].href.toLowerCase();
			try {
				const rawName = this.elms[ii].href.split('/').pop().split('?')[0].split('#')[0];
				const decoded = decodeURIComponent(rawName);
				if (decoded) scanNames.add(decoded.toLowerCase());
			} catch (e) { }
			const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
			let rawName = '';
			try { rawName = this.elms[ii].href.split('/').pop().split('?')[0].split('#')[0]; } catch (e) { }
			let decodedName = rawName;
			try { decodedName = decodeURIComponent(rawName); } catch (e) { }
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
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.ssf') || lower.endsWith('.minissf') || lower.endsWith('.ssflib') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.usflib') || lower.endsWith('.mus') || lower.endsWith('.lmp') || isMidi) {
				const url = this.elms[ii].href;
				this._queueURL(url, false, true);
				// Try to fetch matching image for archives
				if (this._isArchiveUrl(lower)) {
					this._log && this._log('ARCHIVES', 'Calling _tryFetchMatchingImageForArchive for:', url);
					this._tryFetchMatchingImageForArchive(url);
				}
			}
		}
		this._currentScanNames = scanNames;
		if (this._renderZipGamesNow && this.games && this.games.length) {
			this._renderZipGamesNow();
		}
		this.setKeyBindings();

		// Show debug notice in the additional information window
		if (this.debugMode && this._addInfoNotice) {
			setTimeout(() => {
				this._addInfoNotice("Debug is enabled, press D to toggle");
			}, 1000);
		}
	}

	_yieldToUI() {
		return new Promise((resolve) => {
			if (typeof requestAnimationFrame === 'function') {
				requestAnimationFrame(() => resolve());
			} else {
				setTimeout(resolve, 0);
			}
		});
	}

	async _readFileAsUint8(file) {
		if (file && typeof file.stream === 'function' && typeof file.size === 'number') {
			const reader = file.stream().getReader();
			const buffer = new Uint8Array(file.size);
			let offset = 0;
			let nextYieldAt = 8 * 1024 * 1024;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer.set(value, offset);
				offset += value.length;
				if (offset >= nextYieldAt) {
					nextYieldAt = offset + (8 * 1024 * 1024);
					await this._yieldToUI();
				}
			}
			return buffer;
		}

		const arrayBuffer = await file.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	}

	async handleFiles(files) {
		this._setInfoLoading(true);
		let queued = 0;
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const lower = file.name.toLowerCase();
			const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
			const romType = this._getRomType ? this._getRomType(file.name) : null;
			const isExtImage = this._isExternalGameImage ? this._isExternalGameImage(file.name) : false;
			if (this._isArchiveUrl(lower) || this.isPlayable(lower) || isMidi || romType || isExtImage || lower.endsWith('.mwk')) {
				const byteArray = await this._readFileAsUint8(file);
				if (romType) {
					this.saveRomFile(byteArray, file.name, romType);
					queued++;
				} else if (isExtImage) {
					this._registerExternalGameImage(file.name, byteArray);
					this._applyExternalGameImageToExistingGames(file.name);
					queued++;
				} else {
					this.zipQueue.push({ type: 'file', data: byteArray, name: file.name, isManualUpload: true });
					queued++;
				}
				await this._yieldToUI();
			}
		}
		// Wait for _processQueue to be available if it's not yet
		if (typeof this._processQueue !== 'function') {
			console.warn('[VGM] _processQueue not available yet, waiting for queue module...');
			let retries = 0;
			while (typeof this._processQueue !== 'function' && retries < 50) {
				await new Promise(resolve => setTimeout(resolve, 100));
				retries++;
			}
			if (typeof this._processQueue !== 'function') {
				console.error('[VGM] _processQueue still not available after waiting. Queue module may not be loaded.');
				this._setInfoLoading(false);
				return;
			}
		}
		this._processQueue();
		if (queued === 0 && !this.isProcessingQueue && this.zipQueue.length === 0) {
			this._setInfoLoading(false);
		}
	}

	async _processArchiveEntries(entries, fileDataByPath, sourceName = '', hasKss = false) {
		this._log && this._log('ARCHIVES', '_processArchiveEntries called:', sourceName, 'entries:', entries.length, 'hasKss:', hasKss, 'fileDataByPath size:', fileDataByPath.size);
		const yieldEvery = 50;
		let sinceYield = 0;
		const maybeYield = async () => {
			sinceYield++;
			if (sinceYield >= yieldEvery) {
				sinceYield = 0;
				await this._yieldToUI();
			}
		};

		if (!hasKss) {
			var m3uFile;
			var txtFile;
			var pngFile;
			this.amountOfGamesLoaded++;
			const gamePath = this._getGamePath(this.amountOfGamesLoaded);
			this._makedirs(gamePath);

			for (const entry of entries) {
				if (!entry || !entry.filepath) continue;
				const relPath = entry.filepath;
				const fileArray = fileDataByPath.get(relPath);
				if (!fileArray) {
					if (this.debugMode) console.log("[VGM] No fileArray for:", relPath);
					continue;
				}
				const lowerRel = relPath.toLowerCase();
				if (lowerRel.endsWith('.png') || lowerRel.endsWith('.jpg') || lowerRel.endsWith('.jpeg')) {
					if (this.debugMode) console.log("[VGM] Image file found in archive entries:", relPath, "size:", fileArray.length);
				}
				const isImage = lowerRel.endsWith('.png') || lowerRel.endsWith('.jpg') || lowerRel.endsWith('.jpeg') || lowerRel.endsWith('.gif') || lowerRel.endsWith('.bmp') || lowerRel.endsWith('.webp');
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
					if (this._markCacheFileDirty && fullPath.startsWith('/cache/')) this._markCacheFileDirty(fullPath);
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
				if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
					const mime = lower.endsWith(".png") ? "image/png" : "image/jpeg";
					pngFile = new Blob([FS.readFile(fullPath)], { type: mime });
					if (this.debugMode) console.log("[VGM] Found image in archive:", relPath);
				} else if (isImage) {
					if (this.debugMode) console.warn("[VGM] Image found but not used (unsupported type):", relPath);
				}
				await maybeYield();
			}

			const filteredFiles = entries.filter(e => e && e.filepath);
			const hasMbmOrMgs = filteredFiles.some(f => {
				const l = (f.filepath || "").toLowerCase();
				return l.endsWith('.mbm') || l.endsWith('.mgs');
			});
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

			const fallbackName = sourceName || "Archive";
			let derivedName = fallbackName;
			if (hasMbmOrMgs) {
				if (this._normalizeGameTitle) {
					derivedName = this._normalizeGameTitle(fallbackName) || fallbackName;
				} else {
					derivedName = fallbackName;
				}
			} else {
				derivedName = this._deriveVgmGameName(filteredFiles, fallbackName);
			}
			var game = { files: filteredFiles, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, name: derivedName, gameinfo: this.tempGameInfo, archiveName: sourceName, sourceUrl: sourceName };
			const key = this._baseNameNoExt(sourceName).toLowerCase();
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			const hasMidi = game.files.some((f) => {
				const p = (f.filepath || "").toLowerCase();
				return (this._isMidiFile && this._isMidiFile(p)) || this._isMidiExt(p);
			});
			if (!hasPlayable) {
				if (hasMidi) {
					this._addNoPlayableNotice(sourceName || 'Archive', { isMidiArchive: true });
				} else {
					this._addNoPlayableNotice(sourceName || 'Archive');
				}
				if (this._rmRecursive) {
					try { this._rmRecursive(gamePath); } catch (e) { }
				}
			}
			if (!hasPlayable) {
				await this.checkEverythingReady();
				this._scheduleZipRender();
				return { anyPlayable: false, hasMidi };
			}
			this._log && this._log('ARCHIVES', 'PUSHING game:', derivedName, 'archiveName:', sourceName, 'key:', key, 'games.length:', this.games.length);
			if (this._applyExternalGameImage && sourceName) {
				this._applyExternalGameImage(game, sourceName, false);
				this._log && this._log('ARCHIVES', 'After _applyExternalGameImage for', derivedName, ': game.png:', !!game.png);
			}
			this.tempGameInfo = null;
			this.games.push(game);
			this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
			await this.checkEverythingReady();
			this._scheduleZipRender();
			return { anyPlayable: true, hasMidi };
		}

		const gamesInOrder = [];
		const gamesByKey = {};

		const getGameKey = (relPath) => {
			const parts = relPath.split('/');
			if (parts.length > 1) return parts[0];
			const lower = relPath.toLowerCase();
			if (this.isPlayable(lower) || lower.endsWith('.png') || lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo') || lower.endsWith('.mwk')) {
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
			const gamePath = this._getGamePath(this.amountOfGamesLoaded);
			this._makedirs(gamePath);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null, archiveName: sourceName, sourceUrl: sourceName };
			gamesByKey[gameKey] = game;
			gamesInOrder.push(game);
			return game;
		};

		for (const entry of entries) {
			if (!entry || !entry.filepath) continue;
			const relPath = entry.filepath;
			const fileArray = fileDataByPath.get(relPath);
			if (!fileArray) continue;
			const lowerRel = relPath.toLowerCase();
			const isImage = lowerRel.endsWith('.png') || lowerRel.endsWith('.jpg') || lowerRel.endsWith('.jpeg') || lowerRel.endsWith('.gif') || lowerRel.endsWith('.bmp') || lowerRel.endsWith('.webp');
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
				if (this._markCacheFileDirty && fullPath.startsWith('/cache/')) this._markCacheFileDirty(fullPath);
				if (this._getRomType) {
					const romType = this._getRomType(name);
					if (romType) {
						this.saveRomFile(fileArray, name, romType);
					}
				}
			} catch (e) {
				if (this.debugMode) console.error("Error creating file in FS:", e);
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
			if ((lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) && !game.png) {
				const mime = lower.endsWith('.png') ? "image/png" : "image/jpeg";
				game.png = new Blob([FS.readFile(fullPath)], { type: mime });
			} else if (isImage && !(lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
				if (this.debugMode) console.warn("[VGM] Image found but not used (unsupported type):", relPath);
			}
			await maybeYield();
		}

		let anyPlayable = false;
		let anyMidi = false;
		for (const game of gamesInOrder) {
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			game._hasPlayable = hasPlayable;
			if (hasPlayable) {
				anyPlayable = true;
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
			}
			if (!anyMidi) {
				anyMidi = game.files.some((f) => {
					const p = (f.filepath || "").toLowerCase();
					return (this._isMidiFile && this._isMidiFile(p)) || this._isMidiExt(p);
				});
			}
			await maybeYield();
		}

		if (anyPlayable) {
			for (const game of gamesInOrder) {
				if (game._hasPlayable || (game.png && game.png.size > 0)) {
					const name = game.name || (game.files[0] ? game.files[0].filepath.split('/').pop().split('.')[0] : "Unknown");
					game.name = name;
					if (this._applyExternalGameImage) {
						this._applyExternalGameImage(game, name, true);
					}
					this._log && this._log('ARCHIVES', game._hasPlayable ? 'MULTI-GAME PUSH:' : 'MULTI-GAME PNG-ONLY PUSH:', name, 'archiveName:', game.archiveName, 'games.length:', this.games.length);
					this.games.push(game);
				}
				await maybeYield();
			}
		}

		this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

		if (!anyPlayable) {
			if (anyMidi) {
				this._addNoPlayableNotice(sourceName || 'Archive', { isMidiArchive: true });
			} else {
				this._addNoPlayableNotice(sourceName || 'Archive');
			}
			if (this._rmRecursive) {
				for (const game of gamesInOrder) {
					try { this._rmRecursive(game.path); } catch (e) { }
				}
			}
		}

		await this.checkEverythingReady();
		if (this.zipFileListWindow) this.zipFileListWindow.innerHTML = "";
		this._log && this._log('ARCHIVES', '_processArchiveEntries COMPLETE: games.length:', this.games.length, 'archiveName:', sourceName);
		for (const game of this.games) {
			game.uiElement = null;
			this.showVGMFromZip(game);
			await maybeYield();
		}
		return { anyPlayable, hasMidi: anyMidi };
	}

	_makedirs(path) {
		const parts = path.split('/');
		let current = "";
		for (const p of parts) {
			if (!p) continue;
			current += "/" + p;
			try {
				if (!FS.analyzePath(current).exists) {
					FS.mkdir(current);
				}
			} catch (e) {
				// Fallback if analyzePath fails or mkdir refuses
			}
		}
	}

	_getGameRoot() {
		return (this._cacheReady || this._initCache) ? "/cache/files" : "";
	}

	_getGamePath(index) {
		const root = this._getGameRoot();
		return root ? `${root}/game_${index}` : `/game_${index}`;
	}

	_collapseAllGames() {
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			game.uiElement.dataset.expanded = 'false';
			game.uiElement.classList.remove('vgmplayGameExpanded');
			game.uiElement.classList.add('vgmplayGameCollapsed');
		}
	}

	/**
	 * Purges all extracted game files from MEMFS to reclaim memory.
	 */
	purgeGamesFS() {
		try {
			const rootEntries = FS.readdir('/');
			for (const entry of rootEntries) {
				if (entry.startsWith('game_')) {
					this._rmRecursive('/' + entry);
				}
			}
			this.amountOfGamesLoaded = 0;
		} catch (e) {
			if (this.debugMode) console.error("[VGM] purgeGamesFS failed:", e);
		}
	}

	_rmRecursive(path) {
		try {
			const stats = FS.stat(path);
			if (FS.isDir(stats.mode)) {
				const entries = FS.readdir(path);
				for (const entry of entries) {
					if (entry === '.' || entry === '..') continue;
					this._rmRecursive(path + '/' + entry);
				}
				FS.rmdir(path);
			} else {
				FS.unlink(path);
			}
		} catch (e) {
			if (this.debugMode) console.error("[VGM] Failed to remove:", path, e);
		}
	}

	_getSingleFileFingerprint(fileName, byteArray) {
		const bytes = byteArray instanceof Uint8Array ? byteArray : new Uint8Array(byteArray);
		let hash = 0x811c9dc5;
		for (let i = 0; i < bytes.length; i++) {
			hash ^= bytes[i];
			hash = Math.imul(hash, 0x01000193);
		}
		return `${fileName}:${bytes.byteLength}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
	}

	async processSingleBuffer(byteArray, sourceName = '') {
		const fileName = sourceName || "track_" + Date.now();
		const fingerprint = this._getSingleFileFingerprint(fileName, byteArray);
		const existingTrack = this.games.some(game => (game.files || []).some((track) => {
			const path = track && track.filepath ? String(track.filepath) : '';
			return path.substring(path.lastIndexOf('/') + 1) === fileName;
		}));
		const alreadyCached = this._isCached && this._isCached(fingerprint);
		if (existingTrack || alreadyCached) {
			const overwrite = this._confirmSingleFileOverwrite
				? await this._confirmSingleFileOverwrite(fileName)
				: (typeof window !== 'undefined' && window.confirm ? window.confirm(`${fileName} already exists. Overwrite it?`) : false);
			if (!overwrite) {
				if (this.debugMode) console.log(`[VGM] File ${fileName} already exists, skipping processing.`);
				if (this._addDuplicateNotice) this._addDuplicateNotice(fileName);
				return;
			}
			if (alreadyCached && this._cacheFingerprints) {
				this._cacheFingerprints.delete(fingerprint);
				this.zipURLLoaded = this.zipURLLoaded.filter(value => value !== fingerprint);
			}
		}

		return new Promise((resolve) => {
			let game;
			const miscGameName = "Misc";
			const lowerName = fileName.toLowerCase();
			const isNsf = lowerName.endsWith('.nsf') || lowerName.endsWith('.nsfe');

			if (isNsf) {
				game = this.games.find(existingGame => (existingGame.files || []).some((track) => {
					const path = track && track.filepath ? String(track.filepath) : '';
					return path.substring(path.lastIndexOf('/') + 1) === fileName;
				}));
				if (!game) {
					this.amountOfGamesLoaded++;
					const gamePath = this._getGamePath(this.amountOfGamesLoaded);
					this._makedirs(gamePath);
					const displayName = this._normalizeGameTitle ? (this._normalizeGameTitle(fileName) || fileName) : fileName;
					game = { files: [], path: gamePath, name: displayName };
					if (this._applyExternalGameImage) {
						this._applyExternalGameImage(game, fileName, false);
					}
					this.games.push(game);
				}
			} else {
				// Find existing "Misc" game or create new one
				game = this.games.find(g => g.name === miscGameName);

				if (!game) {
					this.amountOfGamesLoaded++;
					const gamePath = this._getGamePath(this.amountOfGamesLoaded);
					this._makedirs(gamePath);
					game = { files: [], path: gamePath, name: miscGameName };
					this.games.push(game);
				}
				if (this._applyExternalGameImage) {
					this._applyExternalGameImage(game, miscGameName, false);
				}
			}

			const fsPath = game.path + "/" + fileName;

			// A changed upload with the same filename replaces the previous track.
			const replacedTracks = game.files.filter(f => f && f.filepath === fsPath);
			const replacedFingerprints = new Set();
			if (replacedTracks.length && this._cacheFingerprints) {
				for (const cachedFingerprint of this._cacheFingerprints) {
					if (String(cachedFingerprint).startsWith(`${fileName}:`)) {
						replacedFingerprints.add(cachedFingerprint);
						this._cacheFingerprints.delete(cachedFingerprint);
					}
				}
			}
			if (replacedTracks.length) {
				this.zipURLLoaded = this.zipURLLoaded.filter(value => !replacedFingerprints.has(value));
				game.files = game.files.filter(f => !f || f.filepath !== fsPath);
			}

			try {
				FS.createDataFile(game.path, fileName, byteArray, true, true);
				if (this._markCacheFileDirty && fsPath.startsWith('/cache/')) this._markCacheFileDirty(fsPath);
			} catch (e) {
				// If it already exists, overwrite
				if (e.name === 'ErrnoError' && e.errno === 20) {
					FS.unlink(fsPath);
					FS.createDataFile(game.path, fileName, byteArray, true, true);
					if (this._markCacheFileDirty && fsPath.startsWith('/cache/')) this._markCacheFileDirty(fsPath);
				}
			}

			const track = { filepath: fsPath, cacheFingerprint: fingerprint };
			game.files.push(track);

			const isPlayable = this.isPlayable(fsPath);
			if (!isPlayable) {
				const lower = fsPath.toLowerCase();
				const isMwk = lower.endsWith('.mwk');
				const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
				if (isMwk) {
					this._addNoPlayableNotice(sourceName || 'MWK', { isMoonsoundSample: true });
				} else if (isMidi) {
					const typeLabel = this._getMidiTypeLabel ? this._getMidiTypeLabel(fsPath) : 'MIDI';
					this._addNoPlayableNotice(sourceName || 'File', { isMidi: true, typeLabel });
				} else {
					this._addNoPlayableNotice(sourceName || 'File');
				}
			}

			this.checkEverythingReady().then(async () => {
				this.showVGMFromZip(game);
				if (isNsf) {
					this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
				}
				this._renderZipGamesNow();
				if (this._markCached) this._markCached(fingerprint);
				if (this._saveCache) await this._saveCache();
				resolve();
			});
		});
	}

	async processPSFBuffer(byteArray, fileName) {
		const fingerprint = fileName + ':' + byteArray.byteLength;
		if (this._isCached && this._isCached(fingerprint)) {
			if (this.debugMode) console.log(`[VGM] PSF File ${fileName} already cached, skipping processing.`);
			if (this._addDuplicateNotice) this._addDuplicateNotice(fileName);
			return;
		}

		this.amountOfGamesLoaded++;
		const gamePath = this._getGamePath(this.amountOfGamesLoaded);
		this._makedirs(gamePath);

		const fsPath = gamePath + "/" + fileName;
		FS.createDataFile(gamePath, fileName, byteArray, true, true);
		if (this._markCacheFileDirty && fsPath.startsWith('/cache/')) this._markCacheFileDirty(fsPath);

		const fileList = [{ filepath: fsPath }];
		var game = { files: fileList, path: gamePath, name: this._normalizeGameTitle ? (this._normalizeGameTitle(fileName) || fileName) : fileName };
		if (this._applyExternalGameImage) {
			this._applyExternalGameImage(game, fileName, false);
		}
		this.games.push(game);
		await this.checkEverythingReady();
		this.showVGMFromZip(game);

		if (this._markCached) this._markCached(fingerprint);
		if (this._saveCache) await this._saveCache();
	}

	addHarvestedTracks(urls) {
		urls.forEach(url => {
			const lower = url.toLowerCase();
			const isMidi = (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower);
			if (this._isArchiveUrl(lower) || this.isPlayable(lower) || isMidi) {
				this._queueURL(url, false);
				// Try to fetch matching image for archives
				if (this._isArchiveUrl(lower)) {
					this._tryFetchMatchingImageForArchive(url);
				}
			} else if (this.isPlayable(lower)) {
				// Handle direct links as single files
				this._queueURL(url, false);
			}
		});
	}

	_updateHighlight() {
		if (!this.vgmplayContainer || !this.vgmplayContainer.querySelectorAll) return;
		// Remove highlight from all elements
		const tracks = this.vgmplayContainer.querySelectorAll('.vgmplayTrack');
		tracks.forEach(track => {
			track.classList.remove('activeTrack');
		});

		// Apply highlight to the active one
		if (this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
			const activeLink = this.activeGame.playableList[this.currentFileKey].linkElement;
			if (activeLink) {
				activeLink.classList.add('activeTrack');
			}
			this._applyGameSearchFilter();
		}
		if (this.overviewMode) {
			this._applyOverviewTrackFilter();
			this._updateOverviewGridSelection();
		}
	}

	async playFileFromFS(href_object, file, game, key) {
		return this._withLoadLock(async () => {
			if (game) {
				const oldActiveGame = this.activeGame;
				this.activeGame = this.games[game - 1];
				// Auto-expand active game
				if (this.activeGame && this.activeGame.uiElement && this.activeGame.uiElement.dataset.expanded === 'false') {
					const toggle = this.activeGame.uiElement.querySelector('.vgmplayGameToggle');
					if (toggle) toggle.click();
				}
				// If game changed, scroll it into view
				if (this.activeGame && this.activeGame !== oldActiveGame && this.activeGame.uiElement) {
					this.activeGame.uiElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}
			if (!this.isPlaybackPaused || this.isVGMPlaying) this.stop();
			// Reset KSS channel mute/solo states when switching tracks
			if (this._resetKssChannelStates) {
				this._resetKssChannelStates();
			}
			await this.checkEverythingReady();

			// On-demand file loading for progressive cache restore
			// Check if file exists first, then load on-demand if needed
			const lowerFile = file.toLowerCase().split('|track=')[0];
			const isLargeFile = lowerFile.endsWith('.at9') || lowerFile.endsWith('.at3') ||
				lowerFile.endsWith('.atrac') || lowerFile.endsWith('.aa3') ||
				lowerFile.endsWith('.brstm') || lowerFile.endsWith('.bfstm') ||
				lowerFile.endsWith('.bcstm') || lowerFile.endsWith('.dsp') ||
				lowerFile.endsWith('.idsp') || lowerFile.endsWith('.hca') ||
				lowerFile.endsWith('.adx') || lowerFile.endsWith('.vag') ||
				lowerFile.endsWith('.fsb');

			if (this._ensureFileLoaded) {
				let fileExists = false;
				try {
					fileExists = FS.analyzePath(file).exists;
				} catch (e) { }

				if (!fileExists) {
					// Only show loading spinner for large files
					const loaded = await this._ensureFileLoaded(file, isLargeFile);
					if (!loaded && this.debugMode) {
						console.warn('[VGM] File not available:', file);
					}
				}
			}

			if (game && this._ensureGameFilesLoaded) {
				const activeGame = this.games[game - 1];
				if (activeGame && activeGame._needsOnDemandFiles && !activeGame._deferTracksByHost) {
					await this._ensureGameFilesLoaded(activeGame);
				}
			}

			// Ensure PSF/USF library files are present (cache-restore may defer them).
			const lowerBase = lowerFile.split('|track=')[0];
			const isPsfFamily = lowerBase.endsWith('.psf') || lowerBase.endsWith('.minipsf') || lowerBase.endsWith('.psflib') ||
				lowerBase.endsWith('.ssf') || lowerBase.endsWith('.minissf') || lowerBase.endsWith('.ssflib') ||
				lowerBase.endsWith('.usf') || lowerBase.endsWith('.miniusf') || lowerBase.endsWith('.usflib');
			if (isPsfFamily && this._ensureFileLoaded && game) {
				const activeGame = this.games[game - 1];
				if (activeGame && activeGame.files) {
					const libs = activeGame.files.filter(f => f && f.filepath && (f.filepath.toLowerCase().endsWith('.psflib') || f.filepath.toLowerCase().endsWith('.ssflib') || f.filepath.toLowerCase().endsWith('.usflib')));
					if (libs.length) {
						if (this._setInfoLoading) this._setInfoLoading(true, 'Fetching PSF libraries...');
						for (const lib of libs) {
							try {
								if (!FS.analyzePath(lib.filepath).exists) {
									await this._ensureFileLoaded(lib.filepath, false);
								}
							} catch (e) { }
						}
						if (this._setInfoLoading) this._setInfoLoading(false);
					}
				}
			}

			if (!this.isPlayable(file)) {
				return;
			}

			// On-demand GENMIDI loading for DOOM MUS files
			const isMusFile = lowerFile.endsWith('.mus') || lowerFile.endsWith('.lmp');
			const isMidiPath = (this._isMidiFile && this._isMidiFile(lowerFile)) || (this._isMidiExt && this._isMidiExt(lowerFile));
			if (isMusFile) {
				if (game) {
					const activeGame = this.games[game - 1];
					if (activeGame && activeGame.files) {
						const genmidi = activeGame.files.find(f => f.filepath.toLowerCase().endsWith('genmidi.lmp'));
						if (genmidi) {
							try {
								const data = FS.readFile(genmidi.filepath);
								const ptr = Module._malloc(data.length);
								Module.HEAPU8.set(data, ptr);
								this.LoadGENMIDI(ptr, data.length);
								Module._free(ptr);
							} catch (e) {
								if (this.debugMode) console.error("Error loading GENMIDI.lmp from FS:", e);
							}
						}
					}
				}
			}
			if (isMidiPath && this.SetMidiEngine && this.midiEngineChoice) {
				try { this.SetMidiEngine(this.midiEngineChoice); } catch (e) { }
			}

			const isMwmFile = lowerFile.endsWith('.mwm');
			if (isMwmFile) {
				if (this.SetMoonsoundMwkPath) {
					const mwkPath = this._findMwkForMwm(file, game);
					try { this.SetMoonsoundMwkPath(mwkPath || ''); } catch (e) { }
				}
				if (this._hasOpl4RomLoaded && !this._hasOpl4RomLoaded()) {
					if (this._showOpl4RomError) {
						this._showOpl4RomError();
					} else {
						this._addNoPlayableNotice('yrw801.rom missing');
					}
					return;
				}
				if (this._hasWavesDatLoaded && !this._hasWavesDatLoaded()) {
					if (this._showWavesDatError) {
						this._showWavesDatError();
					} else {
						this._addNoPlayableNotice('waves.dat missing');
					}
					return;
				}
			}

			this._isLoadingFile = true;
			try {
				const ok = this.load(file);
				if (!ok) {
					let handled = false;
					if (this.GetLastLoadErrorCode) {
						try {
							const code = this.GetLastLoadErrorCode();
							if (code === 1 && this._showOpl4RomError) {
								this._showOpl4RomError();
								handled = true;
							} else if (code === 3 && this._showMoonsoundSampleError) {
								this._showMoonsoundSampleError();
								handled = true;
							} else if (code === 2) {
								if (this._showWavesDatError) {
									this._showWavesDatError();
								} else {
									this._addNoPlayableNotice('waves.dat missing');
								}
								handled = true;
							}
						} catch (e) { }
					}
					if (!handled) {
						this._addNoPlayableNotice(file);
					}
					return;
				}
				if (href_object && href_object.dataset && href_object.dataset.playableIndex) {
					const idx = parseInt(href_object.dataset.playableIndex, 10);
					this.currentFileKey = isNaN(idx) ? key : idx;
				} else {
					this.currentFileKey = key;
				}
				this.play();
				const baseSampleCount = this.GetTrackLength() * this.sampleRate / 44100;
				this.totalSampleCount = baseSampleCount;
				this.trackLengthSeconds = Math.round(this.totalSampleCount / this.sampleRate);
				if (isMusFile && this.currentFileKey && this._loopBaseSamplesByTrack) {
					this._loopBaseSamplesByTrack.set(this.currentFileKey, baseSampleCount);
				}
				let overrideLen = 0;
				if (href_object && href_object.dataset && href_object.dataset.trackLengthSec) {
					const len = parseInt(href_object.dataset.trackLengthSec, 10);
					if (len > 0) overrideLen = len;
				} else if (this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
					const pl = this.activeGame.playableList[this.currentFileKey];
					if (pl && pl.lengthSec) overrideLen = pl.lengthSec;
				}
				if (overrideLen > 0) {
					this.trackLengthSeconds = overrideLen;
					this.totalSampleCount = this.trackLengthSeconds * this.sampleRate;
				}
				this.trackLengthHumanReadeable = new Date((this.trackLengthSeconds) * 1000).toISOString().substr(14, 5);
				let trackName = file.substring(file.lastIndexOf('/') + 1);
				if (href_object && href_object.dataset && href_object.dataset.trackTitle) {
					trackName = href_object.dataset.trackTitle;
				} else if (this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
					const pl = this.activeGame.playableList[this.currentFileKey];
					if (pl && pl.title) trackName = pl.title;
				}
				const isMidiFile = (this._isMidiFile && this._isMidiFile(file)) || (this._isMidiExt && this._isMidiExt(file));
				if (this.showMemoryStats) {
					this._memoryBaselineUsed = null;
					this._setMemoryStatsVisible(true);
				} else if (isMidiFile && this._showMidiInfo) {
					this._showMidiInfo(file, trackName);
				} else {
					this.getVGMTag();
				}

				let gameName = (this.VGMTag && this.VGMTag.length >= 8) ? (this.VGMTag[5] || this.VGMTag[7] || "Unknown Game") : "Unknown Game";
				if (window.Android) window.Android.updateMetadata(gameName + " - " + unescape(trackName), this.trackLengthSeconds * 1000);

				//console.log("ChipInfoString: " + this.GetChipInfoString());
				this.currentTrackSupportsLoop = this._trackSupportsLoop();
				this._applyLoopMode();
				this._updateHighlight();
				this._updateMemoryDisplay();
			} finally {
				this._isLoadingFile = false;
			}
		});
	}

	_isUsfFile(p) {
		p = String(p || "").toLowerCase();
		return p.endsWith('.usf') || p.endsWith('.miniusf') || p.endsWith('.usflib');
	}

	_findMwkForMwm(mwmPath, gameIndex) {
		const clean = String(mwmPath || "").split('|track=')[0];
		const lower = clean.toLowerCase();
		if (!lower.endsWith('.mwm')) return '';
		const baseName = clean.split('/').pop() || clean;
		const baseStem = baseName.replace(/\.[^.]+$/, '').toLowerCase();
		const dir = clean.includes('/') ? clean.substring(0, clean.lastIndexOf('/')) : '';

		const matchInFiles = (files, requireSameDir) => {
			if (!files || !files.length) return '';
			for (const f of files) {
				const p = String(f && f.filepath ? f.filepath : '');
				if (!p) continue;
				const pl = p.toLowerCase();
				if (!pl.endsWith('.mwk')) continue;
				const pDir = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : '';
				const pBase = p.split('/').pop() || p;
				const pStem = pBase.replace(/\.[^.]+$/, '').toLowerCase();
				if (requireSameDir) {
					if (pDir === dir && pStem === baseStem) return p;
				} else {
					if (pStem === baseStem) return p;
				}
			}
			return '';
		};

		if (Number.isFinite(gameIndex) && this.games && this.games[gameIndex - 1]) {
			const inGame = matchInFiles(this.games[gameIndex - 1].files, true);
			if (inGame) return inGame;
		}

		for (const g of (this.games || [])) {
			const candidate = matchInFiles(g && g.files, false);
			if (candidate) return candidate;
		}

		// Fallback: Check root of virtual filesystem
		if (typeof FS !== 'undefined') {
			try {
				const files = FS.readdir('/');
				for (const f of files) {
					if (!f.toLowerCase().endsWith('.mwk')) continue;
					const fStem = f.replace(/\.[^.]+$/, '').toLowerCase();
					if (fStem === baseStem) {
						const found = '/' + f;
						this._log && this._log('MOONSOUND', 'Found MWK in root FS fallback:', found);
						return found;
					}
				}
			} catch (e) { }
		}

		return '';
	}

	isPlayable(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.vgm') || p.endsWith('.vgz') ||
			p.endsWith('.psf') || p.endsWith('.minipsf') ||
			p.endsWith('.ssf') || p.endsWith('.minissf') ||
			p.endsWith('.usf') || p.endsWith('.miniusf') ||
			p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
			p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
			p.endsWith('.mpk') || p.endsWith('.mbm') ||
			p.endsWith('.sap') || p.endsWith('.ay') ||
			p.endsWith('.mod') || p.endsWith('.s3m') || p.endsWith('.xm') ||
			p.endsWith('.it') || p.endsWith('.itp') || p.endsWith('.mptm') ||
			p.endsWith('.stm') || p.endsWith('.mtm') || p.endsWith('.669') ||
			p.endsWith('.amf') || p.endsWith('.dmf') || p.endsWith('.far') ||
			p.endsWith('.imf') || p.endsWith('.med') || p.endsWith('.okt') ||
			p.endsWith('.ptm') || p.endsWith('.ult') || p.endsWith('.umx') ||
			p.endsWith('.mp3') || p.endsWith('.flac') || p.endsWith('.ogg') || p.endsWith('.wav') || p.endsWith('.ape') ||
			p.endsWith('.mwm') ||
			p.endsWith('.mus') || (p.endsWith('.lmp') && !p.endsWith('genmidi.lmp')) ||
			p.endsWith('.mid') || p.endsWith('.midi') || p.endsWith('.rmi') ||
			p.endsWith('.bfstm') || p.endsWith('.bcstm') || p.endsWith('.brstm') ||
			p.endsWith('.adx') || p.endsWith('.hca') || p.endsWith('.dsp') || p.endsWith('.idsp') ||
			p.endsWith('.vag') || p.endsWith('.vgs') || p.endsWith('.lopus') ||
			p.endsWith('.2dx') || p.endsWith('.9ti') || p.endsWith('.aa3') || p.endsWith('.aac') ||
			p.endsWith('.ac3') || p.endsWith('.acm') || p.endsWith('.adm') || p.endsWith('.adp') ||
			p.endsWith('.ads') || p.endsWith('.adv') || p.endsWith('.afc') || p.endsWith('.agp') ||
			p.endsWith('.ahx') || p.endsWith('.aif') || p.endsWith('.aifc') || p.endsWith('.aiff') ||
			p.endsWith('.aix') || p.endsWith('.aka') || p.endsWith('.akp') || p.endsWith('.al') ||
			p.endsWith('.al2') || p.endsWith('.amts') || p.endsWith('.as4') || p.endsWith('.asd') ||
			p.endsWith('.asf') || p.endsWith('.asr') || p.endsWith('.ass') || p.endsWith('.ast') ||
			p.endsWith('.at3') || p.endsWith('.at9') || p.endsWith('.atrac') || p.endsWith('.aud') ||
			p.endsWith('.aus') || p.endsWith('.awc') || p.endsWith('.baf') || p.endsWith('.bam') ||
			p.endsWith('.bar') || p.endsWith('.bcwav') || p.endsWith('.bd') || p.endsWith('.bdt') ||
			p.endsWith('.bg00') || p.endsWith('.bgm') || p.endsWith('.bgw') || p.endsWith('.bh2k') ||
			p.endsWith('.bik') || p.endsWith('.bka') || p.endsWith('.blk') || p.endsWith('.bmdx') ||
			p.endsWith('.bms') || p.endsWith('.bnk') || p.endsWith('.bns') || p.endsWith('.bnsf') ||
			p.endsWith('.bo2') || p.endsWith('.brwav') || p.endsWith('.bsf') || p.endsWith('.bsvp') ||
			p.endsWith('.btc') || p.endsWith('.bvb') || p.endsWith('.bwv') || p.endsWith('.c9') ||
			p.endsWith('.caf') || p.endsWith('.caplsp') || p.endsWith('.cbd2') || p.endsWith('.ccc') ||
			p.endsWith('.cfn') || p.endsWith('.ckd') || p.endsWith('.cms') || p.endsWith('.cna') ||
			p.endsWith('.cnt') || p.endsWith('.cpk') || p.endsWith('.cps') || p.endsWith('.ctp') ||
			p.endsWith('.cxn') || p.endsWith('.da') || p.endsWith('.dat') || p.endsWith('.dbm') ||
			p.endsWith('.dcswav') || p.endsWith('.ddsp') || p.endsWith('.de2') || p.endsWith('.destination') ||
			p.endsWith('.dgv') || p.endsWith('.dms') || p.endsWith('.dns') || p.endsWith('.dpa') ||
			p.endsWith('.dsb') || p.endsWith('.dsf') || p.endsWith('.dsi') || p.endsWith('.dsm') ||
			p.endsWith('.dsp') || p.endsWith('.dss') || p.endsWith('.dtk') || p.endsWith('.dts') ||
			p.endsWith('.dtw') || p.endsWith('.duart') || p.endsWith('.dvw') || p.endsWith('.dxh') ||
			p.endsWith('.eam') || p.endsWith('.eat') || p.endsWith('.ebd') || p.endsWith('.ecf') ||
			p.endsWith('.edp') || p.endsWith('.efs') || p.endsWith('.ei') || p.endsWith('.emff') ||
			p.endsWith('.ent') || p.endsWith('.epp') || p.endsWith('.evb') || p.endsWith('.fag') ||
			p.endsWith('.ffw') || p.endsWith('.fka') || p.endsWith('.fmf') || p.endsWith('.fsb') ||
			p.endsWith('.fwav') || p.endsWith('.g2sc') || p.endsWith('.g719') || p.endsWith('.g721') ||
			p.endsWith('.g722') || p.endsWith('.gbts') || p.endsWith('.gca') || p.endsWith('.gcm') ||
			p.endsWith('.gcw') || p.endsWith('.genh') || p.endsWith('.gin') || p.endsWith('.gms') ||
			p.endsWith('.gsb') || p.endsWith('.hca') || p.endsWith('.hgc') || p.endsWith('.hps') ||
			p.endsWith('.hsf') || p.endsWith('.hwas') || p.endsWith('.iab') || p.endsWith('.iac') ||
			p.endsWith('.idsp') || p.endsWith('.idwav') || p.endsWith('.idx') || p.endsWith('.ifs') ||
			p.endsWith('.ikm') || p.endsWith('.ild') || p.endsWith('.int') || p.endsWith('.is14') ||
			p.endsWith('.is22') || p.endsWith('.isb') || p.endsWith('.isd') || p.endsWith('.isws') ||
			p.endsWith('.itl') || p.endsWith('.its') || p.endsWith('.ivaud') || p.endsWith('.ivb') ||
			p.endsWith('.joe') || p.endsWith('.kcl') || p.endsWith('.kns') || p.endsWith('.koVS') ||
			p.endsWith('.kraw') || p.endsWith('.kt2') || p.endsWith('.ktss') || p.endsWith('.l') ||
			p.endsWith('.laac') || p.endsWith('.lads') || p.endsWith('.latp') || p.endsWith('.lbin') ||
			p.endsWith('.lcaac') || p.endsWith('.lcb') || p.endsWith('.lcm') || p.endsWith('.ldsp') ||
			p.endsWith('.leg') || p.endsWith('.lep') || p.endsWith('.lin') || p.endsWith('.lm8') ||
			p.endsWith('.lms') || p.endsWith('.lopu') || p.endsWith('.lopus') || p.endsWith('.lp') ||
			p.endsWith('.lpcm') || p.endsWith('.lpdsp') || p.endsWith('.lsf') || p.endsWith('.lwav') ||
			p.endsWith('.m4a') || p.endsWith('.m4p') || p.endsWith('.m4v') || p.endsWith('.mab') ||
			p.endsWith('.mad') || p.endsWith('.mag') || p.endsWith('.mca') || p.endsWith('.mc3') ||
			p.endsWith('.mca') || p.endsWith('.mcg') || p.endsWith('.mdf') || p.endsWith('.metadata') ||
			p.endsWith('.mic') || p.endsWith('.mih') || p.endsWith('.miig') || p.endsWith('.miniusf') ||
			p.endsWith('.minivgm') || p.endsWith('.mip') || p.endsWith('.mjb') || p.endsWith('.mka') ||
			p.endsWith('.mkv') || p.endsWith('.mlp') || p.endsWith('.mma') || p.endsWith('.mms') ||
			p.endsWith('.moflex') || p.endsWith('.mov') || p.endsWith('.mp2') || p.endsWith('.mp4') ||
			p.endsWith('.mpa') || p.endsWith('.mpd') || p.endsWith('.mpeg') || p.endsWith('.mpg') ||
			p.endsWith('.ms') || p.endsWith('.msa') || p.endsWith('.msb') || p.endsWith('.msf') ||
			p.endsWith('.mss') || p.endsWith('.msv') || p.endsWith('.msvp') || p.endsWith('.mtaf') ||
			p.endsWith('.mtls') || p.endsWith('.mva') || p.endsWith('.mvi') || p.endsWith('.mxc') ||
			p.endsWith('.my') || p.endsWith('.mys') || p.endsWith('.nca') || p.endsWith('.ndp') ||
			p.endsWith('.ngc') || p.endsWith('.nls') || p.endsWith('.nma') || p.endsWith('.nmu') ||
			p.endsWith('.npk') || p.endsWith('.nps') || p.endsWith('.npsf') || p.endsWith('.nus3bank') ||
			p.endsWith('.nvg') || p.endsWith('.nwa') || p.endsWith('.nwav') || p.endsWith('.nwcd') ||
			p.endsWith('.nws') || p.endsWith('.nwv') || p.endsWith('.nxap') || p.endsWith('.oar') ||
			p.endsWith('.obj') || p.endsWith('.oma') || p.endsWith('.oms') || p.endsWith('.opa') ||
			p.endsWith('.opus') || p.endsWith('.otm') || p.endsWith('.ovm') || p.endsWith('.p12') ||
			p.endsWith('.p1d') || p.endsWith('.p2bt') || p.endsWith('.p3d') || p.endsWith('.pag') ||
			p.endsWith('.pak') || p.endsWith('.pam') || p.endsWith('.past') || p.endsWith('.pbad') ||
			p.endsWith('.pbg') || p.endsWith('.pcm') || p.endsWith('.pcma') || p.endsWith('.pdt') ||
			p.endsWith('.pdx') || p.endsWith('.pk') || p.endsWith('.plp') || p.endsWith('.pna') ||
			p.endsWith('.pnb') || p.endsWith('.pnt') || p.endsWith('.pos') || p.endsWith('.ppc') ||
			p.endsWith('.prc') || p.endsWith('.ps2') || p.endsWith('.ps3') || p.endsWith('.ps4') ||
			p.endsWith('.psa') || p.endsWith('.psb') || p.endsWith('.psc') || p.endsWith('.psh') ||
			p.endsWith('.pss') || p.endsWith('.pst') || p.endsWith('.pva') || p.endsWith('.pvc') ||
			p.endsWith('.pvh') || p.endsWith('.pwa') || p.endsWith('.pwav') || p.endsWith('.qcp') ||
			p.endsWith('.r64') || p.endsWith('.raac') || p.endsWith('.rad') || p.endsWith('.rax') ||
			p.endsWith('.rbs') || p.endsWith('.rdm') || p.endsWith('.rdp') || p.endsWith('.re2') ||
			p.endsWith('.red') || p.endsWith('.res') || p.endsWith('.rfr') || p.endsWith('.rfx') ||
			p.endsWith('.rka') || p.endsWith('.rmm') || p.endsWith('.rmn') || p.endsWith('.rmp') ||
			p.endsWith('.rms') || p.endsWith('.rnc') || p.endsWith('.rnd') || p.endsWith('.rny') ||
			p.endsWith('.rob') || p.endsWith('.rsd') || p.endsWith('.rsf') || p.endsWith('.rsh') ||
			p.endsWith('.rso') || p.endsWith('.rsp') || p.endsWith('.rstm') || p.endsWith('.rwar') ||
			p.endsWith('.rwav') || p.endsWith('.rws') || p.endsWith('.rwsd') || p.endsWith('.rwx') ||
			p.endsWith('.s14') || p.endsWith('.s3v') || p.endsWith('.sab') || p.endsWith('.sad') ||
			p.endsWith('.saf') || p.endsWith('.sb0') || p.endsWith('.sb1') || p.endsWith('.sb2') ||
			p.endsWith('.sb3') || p.endsWith('.sb4') || p.endsWith('.sb5') || p.endsWith('.sb6') ||
			p.endsWith('.sb7') || p.endsWith('.sbao') || p.endsWith('.sbin') || p.endsWith('.sbk') ||
			p.endsWith('.sbr') || p.endsWith('.sbv') || p.endsWith('.scd') || p.endsWith('.sch') ||
			p.endsWith('.sd9') || p.endsWith('.sdd') || p.endsWith('.sdf') || p.endsWith('.sdl') ||
			p.endsWith('.sdt') || p.endsWith('.se') || p.endsWith('.seb') || p.endsWith('.sed') ||
			p.endsWith('.seg') || p.endsWith('.sf0') || p.endsWith('.sfa') || p.endsWith('.sfl') ||
			p.endsWith('.sfs') || p.endsWith('.sfx') || p.endsWith('.sgb') || p.endsWith('.sgd') ||
			p.endsWith('.sgt') || p.endsWith('.shaa') || p.endsWith('.shsa') || p.endsWith('.skx') ||
			p.endsWith('.sli') || p.endsWith('.sm0') || p.endsWith('.sm1') || p.endsWith('.sm2') ||
			p.endsWith('.sm3') || p.endsWith('.sm4') || p.endsWith('.sm5') || p.endsWith('.sm6') ||
			p.endsWith('.sm7') || p.endsWith('.smh') || p.endsWith('.smk') || p.endsWith('.smp') ||
			p.endsWith('.smv') || p.endsWith('.sn0') || p.endsWith('.snb') || p.endsWith('.snd') ||
			p.endsWith('.sng') || p.endsWith('.sngw') || p.endsWith('.snr') || p.endsWith('.sns') ||
			p.endsWith('.snu') || p.endsWith('.sod') || p.endsWith('.son') || p.endsWith('.sounds') ||
			p.endsWith('.sph') || p.endsWith('.spk') || p.endsWith('.spm') || p.endsWith('.sps') ||
			p.endsWith('.spsd') || p.endsWith('.spt') || p.endsWith('.spw') || p.endsWith('.srcd') ||
			p.endsWith('.sre') || p.endsWith('.srsa') || p.endsWith('.ss2') || p.endsWith('.ssm') ||
			p.endsWith('.ssp') || p.endsWith('.sspr') || p.endsWith('.sss') || p.endsWith('.ste') ||
			p.endsWith('.ster') || p.endsWith('.str') || p.endsWith('.stream') || p.endsWith('.strm') ||
			p.endsWith('.sts') || p.endsWith('.stx') || p.endsWith('.svag') || p.endsWith('.svg') ||
			p.endsWith('.svs') || p.endsWith('.swag') || p.endsWith('.swar') || p.endsWith('.swav') ||
			p.endsWith('.swd') || p.endsWith('.sx') || p.endsWith('.sxd') || p.endsWith('.sxd2') ||
			p.endsWith('.sxd3') || p.endsWith('.szd') || p.endsWith('.szd1') || p.endsWith('.szd3') ||
			p.endsWith('.tad') || p.endsWith('.tgq') || p.endsWith('.tgv') || p.endsWith('.thp') ||
			p.endsWith('.tmx') || p.endsWith('.trk') || p.endsWith('.tun') || p.endsWith('.txth') ||
			p.endsWith('.txtp') || p.endsWith('.u0') || p.endsWith('.ue4opus') || p.endsWith('.ueba') ||
			p.endsWith('.ueopus') || p.endsWith('.um3') || p.endsWith('.utk') || p.endsWith('.uv') ||
			p.endsWith('.v') || p.endsWith('.v0') || p.endsWith('.v1') || p.endsWith('.va3') ||
			p.endsWith('.vab') || p.endsWith('.vai') || p.endsWith('.vas') || p.endsWith('.vbk') ||
			p.endsWith('.vdm') || p.endsWith('.vds') || p.endsWith('.vgv') || p.endsWith('.vh') ||
			p.endsWith('.vid') || p.endsWith('.vig') || p.endsWith('.vis') || p.endsWith('.vms') ||
			p.endsWith('.voi') || p.endsWith('.vp6') || p.endsWith('.vpk') || p.endsWith('.vsf') ||
			p.endsWith('.vsv') || p.endsWith('.vxn') || p.endsWith('.w') || p.endsWith('.waa') ||
			p.endsWith('.wac') || p.endsWith('.wad') || p.endsWith('.waf') || p.endsWith('.wam') ||
			p.endsWith('.was') || p.endsWith('.wavc') || p.endsWith('.wave') || p.endsWith('.wavebatch') ||
			p.endsWith('.wavm') || p.endsWith('.wax') || p.endsWith('.way') || p.endsWith('.wb') ||
			p.endsWith('.wb2') || p.endsWith('.wbd') || p.endsWith('.wbk') || p.endsWith('.wd') ||
			p.endsWith('.wem') || p.endsWith('.wma') || p.endsWith('.wp2') || p.endsWith('.wpd') ||
			p.endsWith('.wsd') || p.endsWith('.wsi') || p.endsWith('.wua') || p.endsWith('.wv2') ||
			p.endsWith('.wv6') || p.endsWith('.wve') || p.endsWith('.wvs') || p.endsWith('.wvx') ||
			p.endsWith('.wxh') || p.endsWith('.wxv') || p.endsWith('.x360audio') || p.endsWith('.xa') ||
			p.endsWith('.xa2') || p.endsWith('.xa30') || p.endsWith('.xai') || p.endsWith('.xau') ||
			p.endsWith('.xav') || p.endsWith('.xbw') || p.endsWith('.xen') || p.endsWith('.xhd') ||
			p.endsWith('.xma') || p.endsWith('.xma2') || p.endsWith('.xmd') || p.endsWith('.xms') ||
			p.endsWith('.xmu') || p.endsWith('.xmv') || p.endsWith('.xna') || p.endsWith('.xnb') ||
			p.endsWith('.xopus') || p.endsWith('.xps') || p.endsWith('.xse') || p.endsWith('.xsew') ||
			p.endsWith('.xsf') || p.endsWith('.xsh') || p.endsWith('.xss') || p.endsWith('.xst') ||
			p.endsWith('.xvag') || p.endsWith('.xwav') || p.endsWith('.xwb') || p.endsWith('.xwc') ||
			p.endsWith('.xwm') || p.endsWith('.xwma') || p.endsWith('.xws') || p.endsWith('.xwv') ||
			p.endsWith('.ydsp') || p.endsWith('.ymf') || p.endsWith('.zic') || p.endsWith('.zsd') ||
			p.endsWith('.zsm') || p.endsWith('.zss') || p.endsWith('.zwv') ||
			p.endsWith('.vigamup');
	}

	_isGmeFile(path) {
		const p = String(path || "").toLowerCase().split('|track=')[0];
		return p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.sap') || p.endsWith('.ay');
	}

	_isKssFile(path) {
		const p = String(path || "").toLowerCase().split('|track=')[0];
		return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
			p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
			p.endsWith('.mpk') || p.endsWith('.mbm');
	}

	_isKssMultiTrackFile(path) {
		const p = String(path || "").toLowerCase().split('|track=')[0];
		return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
			p.endsWith('.bgm') || p.endsWith('.opx') ||
			p.endsWith('.mpk');
	}

	_isArchiveUrl(lower) {
		return lower.endsWith('.zip') || lower.endsWith('.7z') || lower.endsWith('.rar') || lower.endsWith('.rsn') || lower.endsWith('.cbr') || lower.endsWith('.vigamup');
	}

	_isMidiExt(lower) {
		return lower.endsWith('.mid') || lower.endsWith('.midi') || lower.endsWith('.rmi');
	}

	_parseKssTxt(text) {
		if (!text) return null;
		const lines = text.split(/\r?\n/);
		const raw = [];
		for (let line of lines) {
			let l = line.trim();
			if (!l) continue;
			if (l.startsWith('#') || l.startsWith(';') || l.startsWith('//')) continue;

			let num = null;
			let title = "";
			let lengthSec = 0;

			if (l.includes(',')) {
				const parts = l.split(',');
				if (parts.length >= 2 && /^\d+$/.test(parts[0].trim())) {
					num = parseInt(parts[0].trim(), 10);
					title = (parts[1] || "").trim();
					const lenStr = (parts[2] || "").trim();
					if (lenStr) {
						const maybe = parseInt(lenStr, 10);
						if (!isNaN(maybe)) lengthSec = maybe;
					}
					raw.push({ num, title: title || "Track", lengthSec });
					continue;
				}
			}

			let timeMatch = l.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?!.*\d)/);
			if (timeMatch) {
				const h = timeMatch[3] ? parseInt(timeMatch[1], 10) : 0;
				const m = timeMatch[3] ? parseInt(timeMatch[2], 10) : parseInt(timeMatch[1], 10);
				const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : parseInt(timeMatch[2], 10);
				lengthSec = h * 3600 + m * 60 + s;
				l = l.replace(timeMatch[0], '').trim();
				l = l.replace(/[\s\-–—:]+$/, '').trim();
			}

			let m = l.match(/^(?:track\s*)?(\d{1,3})\s*[\.\-:)]*\s*/i);
			if (m) {
				num = parseInt(m[1], 10);
				l = l.slice(m[0].length).trim();
			}
			title = l || "Track";
			raw.push({ num, title, lengthSec });
		}

		if (raw.length === 0) return null;
		const hasNums = raw.some(e => e.num !== null && !isNaN(e.num));
		const hasZero = raw.some(e => e.num === 0);
		const oneBased = hasNums && !hasZero;

		const entries = [];
		for (let i = 0; i < raw.length; i++) {
			const r = raw[i];
			let index = null;
			if (r.num === null || isNaN(r.num)) {
				index = i;
			}
			entries.push({ index, num: r.num, title: r.title, lengthSec: r.lengthSec });
		}
		return { entries, oneBased };
	}

	_extractLinksFromHtml(html) {
		const links = [];
		const re = /href=["']([^"']+)["']/gi;
		let match;
		while ((match = re.exec(html))) {
			links.push(match[1]);
		}
		return links;
	}

	_baseNameNoExt(p) {
		const file = String(p || '').split('/').pop();
		const dot = file.lastIndexOf('.');
		const base = dot > 0 ? file.substring(0, dot) : file;
		// Decode URL encoding to handle filenames like "Antarctic%20Adventure.zip"
		try {
			return decodeURIComponent(base);
		} catch (e) {
			return base;
		}
	}

	_isExternalGameImage(p) {
		const lower = String(p || '').toLowerCase();
		return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
	}

	_tryFetchMatchingImageForArchive(archiveUrl) {
		if (!archiveUrl) {
			if (window.__VGM_DEBUG__ || this.debugMode) console.log('[VGM] _tryFetchMatchingImageForArchive: no archiveUrl');
			return;
		}
		if (this._externalImageFetchAttempts?.has(archiveUrl)) {
			if (window.__VGM_DEBUG__ || this.debugMode) console.log('[VGM] _tryFetchMatchingImageForArchive: already attempted', archiveUrl);
			return;
		}
		if (!this._externalImageFetchAttempts) this._externalImageFetchAttempts = new Set();
		this._externalImageFetchAttempts.add(archiveUrl);

		// Extract directory and base name from archive URL
		const lastSlash = archiveUrl.lastIndexOf('/');
		const directory = archiveUrl.substring(0, lastSlash + 1);
		const fileName = archiveUrl.substring(lastSlash + 1);
		const dotIdx = fileName.lastIndexOf('.');
		const baseName = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;

		if (!baseName) return;

		// Skip numbered archives (01, 02, etc.) as they're unlikely to have matching images
		if (/^\d+$/.test(baseName)) return;

		// Use window.__VGM_DEBUG__ for immediate logging (before debugMode is set)
		if (window.__VGM_DEBUG__ || this.debugMode) console.log('[VGM] Trying to find matching image for archive:', baseName, 'url:', archiveUrl);

		// Check if a matching image is listed on the page (in _currentScanNames)
		const scanNames = this._currentScanNames;
		const imageExts = ['.png', '.jpg', '.jpeg', '.webp'];
		let foundImageExt = null;
		for (const ext of imageExts) {
			const imageName = (baseName + ext).toLowerCase();
			if (scanNames && scanNames.has(imageName)) {
				foundImageExt = ext;
				break;
			}
		}

		this._log && this._log('ARCHIVES', '_tryFetchMatchingImageForArchive:', 'baseName:', baseName, 'scanNames size:', scanNames ? scanNames.size : 0, 'foundImageExt:', foundImageExt);

		// If a matching image is listed on the page, fetch it directly
		if (foundImageExt) {
			const imageUrl = directory + baseName + foundImageExt;
			this._log && this._log('ARCHIVES', 'Image found in scan names, fetching:', imageUrl);
			this._fetchUrlAsUint8(imageUrl).then(bytes => {
				this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 callback for', imageUrl, 'bytes:', bytes ? bytes.length : 'null');
				if (bytes && bytes.length > 0) {
					this._log && this._log('ARCHIVES', 'Found matching image for archive:', imageUrl, 'size:', bytes.length);
					this._registerExternalGameImage(baseName + foundImageExt, bytes);
					this._applyExternalGameImageToExistingGames(baseName + foundImageExt);
				}
			}).catch((err) => {
				this._log && this._log('ARCHIVES', 'Image fetch failed:', imageUrl, err);
			});
			return;
		}

		// If no matching image is listed on the page, try all image extensions as fallback
		// This handles cases where the image exists on the server but isn't linked on the page
		if (this._suppressImageGuesses) return;

		if (!this._imageProbePromise) this._imageProbePromise = Promise.resolve();
		this._imageProbePromise = this._imageProbePromise.then(() => {
			if (this._suppressImageGuesses) return;
			this._log && this._log('ARCHIVES', 'Trying to find image for archive:', baseName, 'in directory:', directory);
			return this._tryFetchImageWithFallbacks(directory, baseName, imageExts, 0);
		});
	}

	async _tryFetchImageWithFallbacks(directory, baseName, extensions, startIndex) {
		if (startIndex >= extensions.length) {
			// All extensions tried, no image found
			this._log && this._log('ARCHIVES', 'No image found for archive:', baseName, 'tried extensions:', extensions.join(', '));
			return;
		}
		const ext = extensions[startIndex];
		const imageUrl = directory + baseName + ext;
		this._log && this._log('ARCHIVES', 'Trying image URL:', imageUrl);
		try {
			const bytes = await this._fetchUrlAsUint8(imageUrl);
			this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 result for', imageUrl, ':', bytes ? bytes.length : 'null');
			if (bytes && bytes.length > 0) {
				this._log && this._log('ARCHIVES', 'Found matching image for archive:', imageUrl, 'size:', bytes.length);
				this._registerExternalGameImage(baseName + ext, bytes);
				this._applyExternalGameImageToExistingGames(baseName + ext);
			} else {
				// Try next extension
				this._failedImageProbeCount++;
				if (this._failedImageProbeCount > 3) {
					this._suppressImageGuesses = true;
					this._log && this._log('ARCHIVES', 'Image guessing suppressed for session.');
				} else {
					this._tryFetchImageWithFallbacks(directory, baseName, extensions, startIndex + 1);
				}
			}
		} catch (e) {
			this._log && this._log('ARCHIVES', '_tryFetchImageWithFallbacks error:', imageUrl, e);
			// Image not found with this extension, try next
			this._failedImageProbeCount++;
			if (this._failedImageProbeCount > 3) {
				this._suppressImageGuesses = true;
				this._log && this._log('ARCHIVES', 'Image guessing suppressed for session.');
			} else {
				this._tryFetchImageWithFallbacks(directory, baseName, extensions, startIndex + 1);
			}
		}
	}

	_registerExternalGameImage(name, byteArray) {
		if (!name || !byteArray) {
			this._log && this._log('ARCHIVES', '_registerExternalGameImage: invalid params', 'name:', name, 'byteArray:', byteArray ? byteArray.length : 'null');
			return;
		}

		this._log && this._log('ARCHIVES', '_registerExternalGameImage:', name, 'size:', byteArray.length);

		const key = this._baseNameNoExt(name).toLowerCase();
		if (!key) {
			this._log && this._log('ARCHIVES', '_registerExternalGameImage: no key for', name);
			return;
		}
		if (!this._pendingExternalGameImages) this._pendingExternalGameImages = {};
		try {
			const lower = name.toLowerCase();
			let mime = 'image/jpeg';
			if (lower.endsWith('.png')) mime = 'image/png';
			else if (lower.endsWith('.webp')) mime = 'image/webp';
			else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
			this._pendingExternalGameImages[key] = new Blob([byteArray], { type: mime });
			this._log && this._log('ARCHIVES', 'Registered external game image:', key, 'mime:', mime, 'blob size:', this._pendingExternalGameImages[key].size);
		} catch (e) {
			if (this.debugMode) console.error('[VGM] Failed to cache external game image', name, e);
		}
	}

	_applyExternalGameImage(game, archiveName, overrideOnly) {
		if (!game || !archiveName || !this._pendingExternalGameImages) return;
		const key = this._baseNameNoExt(archiveName).toLowerCase();
		const blob = this._pendingExternalGameImages[key];
		if (!blob) return;
		if (!game.png) {
			game.png = blob;
		}
	}

	_applyExternalGameImageToExistingGames(imageName) {
		const key = this._baseNameNoExt(imageName).toLowerCase();
		if (!this.games || !this.games.length) {
			return;
		}
		if (!key) return;
		let anyUpdated = false;
		for (const game of this.games) {
			if (!game) continue;
			const archiveName = game.archiveName || game.name || '';
			const base = this._baseNameNoExt(archiveName).toLowerCase();
			if (base === key) {
				this._applyExternalGameImage(game, archiveName, false);
				anyUpdated = true;
				if (game.uiElement) {
					const img = game.uiElement.querySelector('img.vgmplayGameToggle');
					if (img && game.png) {
						try {
							img.src = URL.createObjectURL(game.png);
						} catch (e) { }
						continue;
					}
					if (game.uiElement.parentNode) {
						game.uiElement.parentNode.removeChild(game.uiElement);
					}
					game.uiElement = null;
				}
				if (this.showVGMFromZip) {
					this.showVGMFromZip(game);
				}
			}
		}
		if (anyUpdated && this._renderZipGamesNow) {
			this._renderZipGamesNow();
		}
		if (anyUpdated && this._saveCache) {
			this._saveCache();
		}
	}

	_tryLoadMiscImageFromFS() {
		if (typeof FS === 'undefined' || !FS.analyzePath || !FS.readFile) return;
		const candidates = ['misc.png', 'misc.jpg', 'misc.jpeg', 'misc.webp'];
		for (const name of candidates) {
			try {
				if (FS.analyzePath('/' + name).exists) {
					const bytes = FS.readFile('/' + name);
					this._registerExternalGameImage(name, bytes);
					this._applyExternalGameImageToExistingGames(name);
					return;
				}
			} catch (e) { }
		}
	}

	async _getDistFilesFromManifest(distBase) {
		try {
			const distPath = new URL('.', distBase).pathname;
			const url = new URL('manifest.json', distBase);
			const resp = await fetch(url.toString(), { cache: 'no-store' });
			if (!resp.ok) {
				return [];
			}
			const data = await resp.json();
			if (!Array.isArray(data)) return [];
			return data
				.map((p) => new URL(p, distBase).toString())
				.filter((u) => {
					try { return new URL(u).pathname.startsWith(distPath); } catch (e) { return false; }
				});
		} catch (e) {
			return [];
		}
	}

	async _getDistFilesFromListing(distBase) {
		try {
			const distPath = new URL('.', distBase).pathname;
			const resp = await fetch(distBase, { cache: 'no-store' });
			if (!resp.ok) return [];
			const html = await resp.text();
			const links = this._extractLinksFromHtml(html);
			const out = [];
			for (const href of links) {
				if (!href || href === '../') continue;
				const url = new URL(href, distBase);
				if (!url.pathname.startsWith(distPath)) continue;
				if (url.pathname.endsWith('/')) continue;
				out.push(url.toString());
			}
			return out;
		} catch (e) {
			return [];
		}
	}

	async _fetchUrlAsUint8(url) {
		this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 called for:', url);
		try {
			const resp = await fetch(url, { cache: 'no-store' });
			this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 response:', url, 'status:', resp.status, 'ok:', resp.ok);
			if (!resp.ok) return null;
			const buf = await resp.arrayBuffer();
			this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 buffer size:', url, buf.byteLength);
			return new Uint8Array(buf);
		} catch (e) {
			this._log && this._log('ARCHIVES', '_fetchUrlAsUint8 error:', url, e);
			return null;
		}
	}

	async _autoScanDist() {
		if (!this.autoScanDist || this._autoScanDistDone) return;
		this._autoScanDistDone = true;
		if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
		// Ensure cache metadata is restored before scanning to avoid duplicate downloads.
		if (this._cacheInitPromise) {
			try {
				this._log && this._log('ARCHIVES', 'Auto-scan waiting for cache init');
				await this._cacheInitPromise;
			} catch (e) { }
		} else if (this._initCache && !this._cacheReady) {
			try {
				this._log && this._log('ARCHIVES', 'Auto-scan initializing cache');
				await this._initCache();
			} catch (e) { }
		}
		let distBase = this.autoScanDistBase || 'dist/';
		try {
			distBase = new URL(distBase, window.location.href).toString();
		} catch (e) { }

		// auto-scan /dist
		let files = await this._getDistFilesFromListing(distBase);
		if (!files.length) {
			files = await this._getDistFilesFromManifest(distBase);
		}
		// discovered files
		if (!files.length) return;

		const seen = new Set();
		const scanNames = new Set();
		for (const url of files) {
			const lower = url.toLowerCase().split('?')[0].split('#')[0];
			const rawName = url.split('/').pop().split('?')[0].split('#')[0];

			let decodedName = rawName;
			try { decodedName = decodeURIComponent(rawName); } catch (e) { }
			const decodedKey = decodedName.toLowerCase();
			if (decodedKey) scanNames.add(decodedKey);

			// Check if this URL was already processed (from cache or previous run)
			let normalizedUrl;
			try {
				const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
				normalizedUrl = urlObj.host + '/' + rawName;
			} catch (e) {
				normalizedUrl = (typeof window !== 'undefined' ? window.location.host : 'localhost') + '/' + rawName;
			}
			if (this._processedURLs && this._processedURLs.has(normalizedUrl)) {
				this._log && this._log('ARCHIVES', 'Auto-scan skipping already processed URL:', normalizedUrl);
				continue;
			}

			if (this._cacheArchiveNames && this._cacheArchiveNames.has(decodedKey)) {
				continue;
			}

			if (this.zipURLLoaded && this.zipURLLoaded.includes(url)) continue;
			if (this._cacheFingerprints && Array.from(this._cacheFingerprints).some(fp => fp.startsWith(decodedName + ':'))) continue;

			// Skip if the harvester has already claimed this URL (it manages via the prompt)
			if (this.lastHarvestedCandidates && this.lastHarvestedCandidates.some(c => c.url === url)) continue;

			if (this._isArchiveUrl(lower)) {
				if (typeof this._queueURL === 'function') {
					this._queueURL(url, false);
				} else {
					console.warn('[VGM] _queueURL not available yet, skipping:', url);
				}
			} else {
				const rawName = url.split('/').pop().split('?')[0].split('#')[0];
				let name = rawName;
				try {
					name = decodeURIComponent(rawName);
				} catch (e) { }
				const romType = this._getRomType ? this._getRomType(name) : null;
				const isExtImage = this._isExternalGameImage ? this._isExternalGameImage(name) : false;
				if (romType) {
					const bytes = await this._fetchUrlAsUint8(url);
					if (bytes) {
						this.saveRomFile(bytes, name, romType);
					} else {
						if (this.debugMode) console.warn('ROM fetch failed', url);
					}
				} else if (isExtImage) {
					const bytes = await this._fetchUrlAsUint8(url);
					if (bytes) {
						this._registerExternalGameImage(name, bytes);
						this._applyExternalGameImageToExistingGames(name);
					}
				} else if (this.isPlayable(lower) || (this._isMidiFile && this._isMidiFile(lower)) || this._isMidiExt(lower)) {
					this._queueURL(url, false);
				} else {
					// skip non-archive
				}
			}
		}
		this._currentScanNames = scanNames;
		if (this._renderZipGamesNow && this.games && this.games.length) {
			this._renderZipGamesNow();
		}
		if (this._renderSkippedDownloads) {
			this._renderSkippedDownloads();
		}
	}

	_getKssMetaForFile(game, fileName) {
		if (!game || !game.kssTxtByBase) return null;
		const dot = fileName.lastIndexOf('.');
		const base = dot > 0 ? fileName.substring(0, dot) : fileName;
		let txt = game.kssTxtByBase[base];
		if (!txt) {
			const keys = Object.keys(game.kssTxtByBase);
			if (keys.length === 1) txt = game.kssTxtByBase[keys[0]];
			if (!txt) {
				const match = keys.find(k => k.toLowerCase().includes('track info'));
				if (match) txt = game.kssTxtByBase[match];
			}
		}
		if (!txt) {
			const keys = Object.keys(game.kssTxtByBase);
			for (const k of keys) {
				const candidate = this._parseKssTxt(game.kssTxtByBase[k]);
				if (candidate && candidate.entries && candidate.entries.some(e => e.num != null)) {
					txt = game.kssTxtByBase[k];
					break;
				}
			}
		}
		if (!txt) return null;
		if (!game._kssMetaCache) game._kssMetaCache = {};
		const cacheKey = base || 'default';
		if (game._kssMetaCache[cacheKey]) return game._kssMetaCache[cacheKey];
		const meta = this._parseKssTxt(txt);
		game._kssMetaCache[cacheKey] = meta;
		return meta;
	}

	async changeTrack(action) {
		if (this.nativeMode && this._nativeLibraryApp && !this._nativeChangeDelegating) {
			this._nativeChangeDelegating = true;
			try {
				if (action === "previous") this._nativeLibraryApp.prevTrack();
				else this._nativeLibraryApp.nextTrack();
			} finally {
				this._nativeChangeDelegating = false;
			}
			return;
		}
		if (this.games.length === 0) return;

		if (this.isRandomEnabled && action === "next") {
			this.playRandom();
			return;
		}

		const getPlayableList = (g) => {
			if (!g) return [];
			if (g.playableList && g.playableList.length) return g.playableList;
			if (!g.files) return [];
			return g.files
				.filter(f => f && f.filepath && this.isPlayable(f.filepath))
				.map(f => ({ filepath: f.filepath, linkElement: f.linkElement }));
		};

		let gameIndex = this.activeGame ? this.games.indexOf(this.activeGame) : -1;

		if (gameIndex === -1) {
			gameIndex = 0;
			this.activeGame = this.games[gameIndex];
			const list = getPlayableList(this.activeGame);
			this.currentFileKey = (action === "next") ? 0 : Math.max(0, list.length - 1);
		} else {
			if (action === "next") {
				const list = getPlayableList(this.activeGame);
				if (this.currentFileKey + 1 >= list.length) {
					// Move to first track of next game
					gameIndex = (gameIndex + 1) % this.games.length;
					this.activeGame = this.games[gameIndex];
					const nextList = getPlayableList(this.activeGame);
					this.currentFileKey = 0;
					if (nextList.length === 0) return;
				} else {
					this.currentFileKey++;
				}
			} else { // previous
				if (this.currentFileKey <= 0) {
					// Move to last track of previous game
					gameIndex = (gameIndex - 1 + this.games.length) % this.games.length;
					this.activeGame = this.games[gameIndex];
					const prevList = getPlayableList(this.activeGame);
					this.currentFileKey = Math.max(0, prevList.length - 1);
					if (prevList.length === 0) return;
				} else {
					this.currentFileKey--;
				}
			}
		}

		const playableList = getPlayableList(this.activeGame);
		if (!playableList.length) return;
		if (this.currentFileKey < 0 || this.currentFileKey >= playableList.length) {
			this.currentFileKey = 0;
		}
		await this.playFileFromFS(false, playableList[this.currentFileKey].filepath, gameIndex + 1, this.currentFileKey);
	}

	async togglePlayback() {
		if (await this.checkEverythingReady()) {
			if (!this.isVGMLoaded) {
				if (this.activeGame && this.currentFileKey != null && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
					const gameIndex = this.games.indexOf(this.activeGame);
					await this.playFileFromFS(false, this.activeGame.playableList[this.currentFileKey].filepath, gameIndex + 1, this.currentFileKey);
				} else {
					await this.changeTrack('next');
				}
			} else {
				if (this.isPlaybackPaused) {
					this.play();
					this.getVGMTag();
				}
				else this.pause();
			}
		}
	}

	async checkEverythingReady() {
		// Use a promise lock to prevent concurrent initialization
		if (!this._initPromise) {
			this._initPromise = this._doInit();
		}
		return this._initPromise;
	}

	_initStandaloneAnalyzer(forceRecreate = false) {
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
	}

	async _ensureAudioMotion() {
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
	}

	_updateStandaloneRightPanel() {
		if (!this.standalone || !this.standaloneAnalyzerEl) return;
		if (this.overviewMode) {
			this.standaloneAnalyzerEl.style.display = 'none';
			if (this.standaloneOverlay) this.standaloneOverlay.style.display = 'none';
			if (this.standaloneGameGrid) this.standaloneGameGrid.style.display = 'grid';
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
	}
	_updateStandaloneSelectOptions() {
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

		// Restore selection if possible
		const options = Array.from(this.standaloneSelect.options).map(o => o.value);
		if (options.includes(current)) {
			this.standaloneSelect.value = current;
		} else {
			this.standaloneSelect.value = 'linePrism';
			this.rightPanelMode = 'linePrism';
		}
	}

	_setOverviewMode(enabled) {
		this.overviewMode = !!enabled;
		if (this.overviewMode && (!this.activeGame || (this.games && !this.games.includes(this.activeGame)))) {
			if (this.games && this.games.length) {
				// Try to find a game from the current site first
				const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
				const currentScan = this._currentScanNames || new Set();
				const normalizeArchiveName = (value) => {
					if (!value) return '';
					const base = String(value).split('?')[0].split('#')[0];
					const last = base.split('/').pop() || base;
					try { return decodeURIComponent(last).toLowerCase(); } catch (e) { return last.toLowerCase(); }
				};
				let foundSiteGame = null;
				for (const game of this.games) {
					const key = normalizeArchiveName(game && (game.archiveName || game.name));
					const isFromCurrentScan = key && currentScan.has(key);
					const isFromCurrentHostCache = game._fromCache && (game.cacheHost === currentHost || !game.cacheHost);
					const isNewlyDownloaded = !game._fromCache;
					if (isFromCurrentScan || isFromCurrentHostCache || isNewlyDownloaded) {
						foundSiteGame = game;
						break;
					}
				}
				this.activeGame = foundSiteGame || this.games[0];
			}
		}
		if (this.overviewMode && this.activeGame) {
			if (!this.activeGame.uiElement && this.showVGMFromZip) {
				try { this.showVGMFromZip(this.activeGame); } catch (e) { }
			}
			if (this.activeGame.uiElement) {
				this.activeGame.uiElement.dataset.expanded = 'true';
				this.activeGame.uiElement.classList.add('vgmplayGameExpanded');
				this.activeGame.uiElement.classList.remove('vgmplayGameCollapsed');
			}
		}
		if (this.overviewMode && this.overviewOverlay && !this.standalone && this._positionOverviewOverlay) {
			this._positionOverviewOverlay();
		}
		if (this.vgmplayContainer) {
			this.vgmplayContainer.classList.toggle('vgmplayOverviewMode', this.overviewMode);
		}
		if (this.standalone) {
			this._updateStandaloneRightPanel();
		} else if (this.standaloneGameGrid) {
			// Extension: show game grid in right panel when in overview mode
			this.standaloneGameGrid.style.display = this.overviewMode ? 'grid' : 'none';
			// Hide the analyzer overlay in grid mode
			if (this.standaloneOverlay) {
				this.standaloneOverlay.style.display = this.overviewMode ? 'none' : '';
			}
		}
		this._applyOverviewTrackFilter();
		this._updateOverviewGridSelection();
	}

	_applyOverviewTrackFilter() {
		if (!this.overviewMode || !this.games) {
			for (const game of this.games || []) {
				if (!game || !game.uiElement) continue;
				game.uiElement.style.display = '';
			}
			return;
		}
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			const isActive = this.activeGame && game === this.activeGame;
			game.uiElement.style.display = isActive ? '' : 'none';
			if (isActive) {
				game.uiElement.dataset.expanded = 'true';
				game.uiElement.classList.add('vgmplayGameExpanded');
				game.uiElement.classList.remove('vgmplayGameCollapsed');
			}
		}
	}

	_updateOverviewGridSelection() {
		if (!this.overviewMode || !this.games) return;
		for (const game of this.games) {
			if (!game || !game._overviewTile) continue;
			game._overviewTile.classList.toggle('active', this.activeGame && game === this.activeGame);
		}
	}

	_positionOverviewOverlay() {
		if (!this.overviewOverlay || !this.vgmplayContainer) return;
		const rect = this.vgmplayContainer.getBoundingClientRect();
		const gap = 12;
		const top = Math.max(10, rect.top);
		const left = Math.max(10, rect.right + gap);
		const right = 10;
		const bottom = 10;
		const maxLeft = window.innerWidth - 220;
		const safeLeft = Math.min(left, maxLeft);
		this.overviewOverlay.style.top = `${top}px`;
		this.overviewOverlay.style.left = `${safeLeft}px`;
		this.overviewOverlay.style.right = `${right}px`;
		this.overviewOverlay.style.bottom = `${bottom}px`;
	}

	_renderOverviewGrid() {
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

		// Group games by site
		const currentHost = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
		const currentScan = this._currentScanNames || new Set();
		const normalizeArchiveName = (value) => {
			if (!value) return '';
			const base = String(value).split('?')[0].split('#')[0];
			const last = base.split('/').pop() || base;
			try { return decodeURIComponent(last).toLowerCase(); } catch (e) { return last.toLowerCase(); }
		};

		// Group games: current site first, then other sites
		const currentSiteGames = [];
		const gamesByHost = new Map(); // host -> games

		for (const game of this.games) {
			if (!game || !game.files || !game.files.some((f) => f && f.filepath && this.isPlayable(String(f.filepath).toLowerCase()))) {
				continue;
			}
			const key = normalizeArchiveName(game && (game.archiveName || game.name));
			const isFromCurrentScan = key && currentScan.has(key);
			const isFromCurrentHostCache = game._fromCache && (game.cacheHost === currentHost || !game.cacheHost);
			// Freshly downloaded games (not from cache) always belong to the current session/site
			const isNewlyDownloaded = !game._fromCache;

			if (isFromCurrentScan || isFromCurrentHostCache || isNewlyDownloaded) {
				currentSiteGames.push(game);
			} else {
				const host = game.cacheHost || 'Other';
				if (!gamesByHost.has(host)) gamesByHost.set(host, []);
				gamesByHost.get(host).push(game);
			}
		}

		// Helper function to create a tile
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

		// Render current site games first
		for (const game of currentSiteGames) {
			const tile = createTile(game);
			this.standaloneGameGrid.appendChild(tile);
		}

		// Render other sites with separators
		const otherHosts = Array.from(gamesByHost.keys()).sort();
		for (const host of otherHosts) {
			const games = gamesByHost.get(host);
			if (!games.length) continue;

			// Add separator with label for this site
			const label = document.createElement('div');
			label.className = 'vgmplayGridSeparatorLabel';
			label.textContent = `Cached from: ${host}`;
			this.standaloneGameGrid.appendChild(label);
			const separator = document.createElement('div');
			separator.className = 'vgmplayGridSeparator';
			this.standaloneGameGrid.appendChild(separator);

			// Render games for this site
			for (const game of games) {
				const tile = createTile(game);
				this.standaloneGameGrid.appendChild(tile);
			}
		}

		this._updateOverviewGridSelection();
		if (this.overviewMode) {
			this._applyOverviewTrackFilter();
		}
	}


	load(fileName) {
		// Determine archive name if this file belongs to a game from an archive
		let archiveName = '';
		for (const game of this.games) {
			if (fileName.startsWith(game.path + '/')) {
				archiveName = game.archiveName || '';
				break;
			}
		}
		if (this.isVGMLoaded && this.StopVGM) {
			this.StopVGM();
		}
		if (this.CloseVGMFile) {
			this.CloseVGMFile();
		}
		const res = this.OpenVGMFile(fileName);
		const ok = !!res;
		if (ok && Module && Module.SetCurrentArchiveName) {
			// Set archive name AFTER OpenVGMFile (which calls cleanup) so it persists for ShowTitle
			Module.SetCurrentArchiveName(archiveName);
		}
		if (!ok) {
			if (this.debugMode) console.error("[VGM] Failed to open file:", fileName);
		}
		this.isVGMLoaded = ok;
		this.isKSSActive = ok && this._isKssFile(fileName);
		if (this.isKSSActive && this._ensureKssBindings) {
			this._ensureKssBindings();
		}
		if (this.isKSSActive) {
			this._resetKssDeviceScan();
		} else {
			this.kssDeviceBaseMask = 0;
			this.kssDeviceDetectedMask = 0;
			this._kssDeviceScanDefs = null;
			this._kssDeviceScanPeaks = null;
			this._kssDeviceScanFrames = 0;
			this._kssDeviceScanDone = false;
		}
		this._updateStandaloneSelectOptions();
		if (ok) this._updateStandaloneRightPanel();
		if (this._initKssMiniOverlay) {
			if (this.isKSSActive) this._initKssMiniOverlay(true);
			else if (this.kssMiniOverlayEl) this.kssMiniOverlayEl.style.display = 'none';
		}
		this._updateMemoryDisplay();
		return ok;
	}

	_getRomType(name) {
		const n = String(name || '').toUpperCase();
		if (n === 'MT32_CONTROL.ROM' || n === 'MT32_PCM.ROM') return 'munt';
		if (n === 'YRW801.ROM') return 'opl4';
		if (n === 'WAVES.DAT') return 'waves';
		if (n.endsWith('.MWK')) return 'moonsound_sample';
		return null;
	}

	_hasOpl4RomLoaded() {
		if (typeof FS === 'undefined') return false;
		try {
			return !!FS.analyzePath('/yrw801.rom').exists;
		} catch (e) {
			return false;
		}
	}

	_hasWavesDatLoaded() {
		if (typeof FS === 'undefined') return false;
		try {
			return !!FS.analyzePath('/waves.dat').exists;
		} catch (e) {
			return false;
		}
	}

	_trackUsesOpl4() {
		if (!this.GetChipInfoString) return false;
		try {
			const info = this.GetChipInfoString();
			return !!(info && /YMF278B/i.test(info));
		} catch (e) {
			return false;
		}
	}

	saveRomFile(byteArray, name, romType) {
		const type = romType || this._getRomType(name);
		if (!type) return;
		this._romLoaded = this._romLoaded || {};

		let bytes = byteArray;
		if (bytes instanceof ArrayBuffer) {
			bytes = new Uint8Array(bytes);
		} else if (Array.isArray(bytes)) {
			bytes = Uint8Array.from(bytes);
		}
		if (bytes && !(bytes instanceof Uint8Array)) {
			try {
				if (Number.isFinite(bytes.length)) {
					bytes = Uint8Array.from(bytes);
				}
			} catch (e) { }
		}
		if (!bytes || !bytes.buffer) {
			if (this.debugMode) console.error('Error saving ROM file: invalid data for', name);
			return;
		}

		if (typeof FS === 'undefined' || !FS.createDataFile) {
			this._queueRomRetry(bytes, name, type);
			return;
		}

		let targetName = '';
		let label = '';
		let key = '';
		if (type === 'munt') {
			targetName = String(name || '').toUpperCase();
			label = 'Munt ROM';
			key = 'munt:' + targetName;
			this._romLoaded = this._romLoaded || {};
		} else if (type === 'opl4') {
			targetName = 'yrw801.rom';
			label = 'OPL4 ROM (YRW801)';
			key = 'opl4:yrw801.rom';
		} else if (type === 'waves') {
			targetName = 'waves.dat';
			label = 'Moonsound Waves';
			key = 'waves:waves.dat';
		} else if (type === 'moonsound_sample') {
			targetName = String(name || '').split('/').pop() || 'samples.mwk';
			label = 'Moonsound Sample Library';
			key = 'moonsound_sample:' + targetName.toLowerCase();
		} else {
			return;
		}

		try {
			const path = '/' + targetName;
			if (FS.analyzePath(path).exists) {
				FS.unlink(path);
			}
			FS.createDataFile('/', targetName, bytes, true, true);
			if (!this._romLoaded[key]) {
				const opts = { typeLabel: label, isRom: true };
				if (type === 'munt') opts.isMuntRom = true;
				if (type === 'moonsound_sample') opts.isMoonsoundSample = true;
				this._addNoPlayableNotice(name || targetName, opts);
				this._romLoaded[key] = true;
			}
			// Also cache the ROM file for persistence across sessions
			this._cacheRomFile(bytes, targetName, type);
		} catch (e) {
			if (this.debugMode) console.error("Error saving ROM file:", e);
			this._queueRomRetry(bytes, name, type);
		}
	}

	_queueRomRetry(bytes, name, romType) {
		if (!bytes || !bytes.buffer) return;
		if (!this._pendingRomLoads) this._pendingRomLoads = [];
		this._pendingRomLoads.push({ bytes, name, romType, attempts: 1 });
		this._schedulePendingRomRetry();
	}

	_schedulePendingRomRetry() {
		if (this._pendingRomRetryScheduled) return;
		this._pendingRomRetryScheduled = true;
		this.checkEverythingReady().then(() => {
			this._pendingRomRetryScheduled = false;
			const pending = this._pendingRomLoads || [];
			this._pendingRomLoads = [];
			for (const item of pending) {
				if (!item || !item.bytes || item.attempts > 2) continue;
				const nextAttempts = (item.attempts || 1) + 1;
				try {
					this.saveRomFile(item.bytes, item.name, item.romType);
				} catch (e) {
					if (nextAttempts <= 2) {
						item.attempts = nextAttempts;
						this._pendingRomLoads.push(item);
					}
				}
			}
			if (this._pendingRomLoads.length) {
				this._schedulePendingRomRetry();
			}
		});
	}

// Cache ROM file to IndexedDB for persistence across sessions
  async _cacheRomFile(bytes, name, type) {
    if (!this._cacheBridgeAvailable()) {
      await this._initStorageIfNeeded();
    }
    if (!this._cacheBridgeAvailable()) return;
    const path = '/' + name;
    // Convert to base64 to avoid ArrayBuffer serialization issues with IndexedDB
    let b64 = null;
    if (bytes instanceof Uint8Array) {
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, sub);
      }
      b64 = btoa(binary);
    } else if (bytes instanceof ArrayBuffer) {
      const arr = new Uint8Array(bytes);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < arr.length; i += chunkSize) {
        const sub = arr.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, sub);
      }
      b64 = btoa(binary);
    } else if (typeof bytes === 'string') {
      b64 = bytes; // already base64
    }
    if (b64) {
      const resp = await this._cacheBridgeRequestAsync('putFiles', { files: [{ path, b64 }] });
      if (resp && resp.error) {
        this._logWarn && this._logWarn('CACHE', 'Failed to cache ROM file:', name, resp.error);
      } else {
        this._log && this._log('CACHE', 'ROM file cached:', name, 'size:', bytes.length || bytes.byteLength);
      }
    } else {
      this._logWarn && this._logWarn('CACHE', 'Could not convert ROM to base64 for caching:', name);
    }
  }

  // Restore ROM files from cache on startup
  async _restoreRomsFromCache() {
    if (!this._cacheBridgeAvailable()) {
      await this._initStorageIfNeeded();
    }
    if (!this._cacheBridgeAvailable()) return;
    const romPaths = ['/yrw801.rom', '/MT32_CONTROL.ROM', '/MT32_PCM.ROM', '/waves.dat'];
    this._log && this._log('CACHE', 'Requesting ROM files from cache:', romPaths);
    const resp = await this._cacheBridgeRequestAsync('getFiles', { paths: romPaths });
    this._log && this._log('CACHE', 'ROM cache response:', resp ? 'got response' : 'no response', resp?.files?.length || 0, 'files');
    if (resp && resp.files && resp.files.length) {
			for (const item of resp.files) {
				if (!item || !item.path) continue;
				const name = item.path.split('/').pop();
				const romType = this._getRomType(name);
				if (romType) {
					// Handle both base64 and binary data formats (same as _bridgeFetchFiles)
					let bytes = null;
					if (item.b64) {
						const binary = atob(item.b64);
						const len = binary.length;
						bytes = new Uint8Array(len);
						for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
						this._log && this._log('CACHE', 'Decoded b64, size:', bytes.byteLength);
					} else if (item.data) {
						bytes = (item.data instanceof ArrayBuffer) ? new Uint8Array(item.data) : new Uint8Array(item.data.buffer || item.data);
						this._log && this._log('CACHE', 'Using data, size:', bytes.byteLength);
					} else {
						this._log && this._log('CACHE', 'ROM item has no data:', name);
						continue;
					}
					this._log && this._log('CACHE', 'Restoring ROM:', name, 'type:', romType, 'size:', bytes.byteLength);
					// Write directly to FS - we're called after FS is ready in _doInit
					if (typeof FS !== 'undefined' && FS.writeFile) {
						const path = '/' + name;
						try {
							if (FS.analyzePath(path).exists) {
								FS.unlink(path);
							}
							FS.writeFile(path, bytes);
							this._romLoaded = this._romLoaded || {};
							let key = romType === 'munt' ? ('munt:' + name.toUpperCase()) : (romType === 'waves' ? 'waves:waves.dat' : 'opl4:yrw801.rom');
							// Show notice that ROM was loaded from cache
							if (!this._romLoaded[key]) {
								const label = romType === 'munt' ? 'Munt ROM' : (romType === 'waves' ? 'Moonsound Waves' : 'OPL4 ROM (YRW801)');
								const opts = { typeLabel: label, isRom: true, fromCache: true };
								if (romType === 'munt') opts.isMuntRom = true;
								this._addNoPlayableNotice(name, opts);
							}
							this._romLoaded[key] = true;
							this._log && this._log('CACHE', 'ROM restored successfully:', path, 'key:', key);
							// Verify the file was written
							const stat = FS.stat(path);
							if (this.debugMode) console.log('[VGM] ROM file size in FS:', stat.size);
						} catch (e) {
							if (this.debugMode) console.error('[VGM] Failed to restore ROM from cache:', name, e);
						}
					} else {
						if (this.debugMode) console.warn('[VGM] FS not available for ROM restoration');
					}
				}
			}
		} else {
			if (this.debugMode) console.log('[VGM] No ROM files found in cache');
		}
	}

}
// ---- Progress bar & seek ----
VGMPlay_js.prototype._updateProgressBar = function () {
	if (!this.progressFill || !this.totalSampleCount) return;

	this._checkTrackEnd();

	const entry = this.activeGame && this.activeGame.playableList ? this.activeGame.playableList[this.currentFileKey] : null;
	const path = String(entry && entry.filepath ? entry.filepath : (this.currentFileKey || "")).toLowerCase();
	const isUsf = this._isUsfFile(path);

	if (this.progressContainer) {
		this.progressContainer.classList.toggle('seeking-disabled', isUsf);
	}

	const isLooping = this.loopMode === 1 && this.currentTrackSupportsLoop;

	if (this.vgmplayTime) {
		if (isLooping) {
			// Elapsed: use AudioContext time directly so it counts past track end
			let elapsedSec = 0;
			if (this.isPlaybackPaused) {
				elapsedSec = Math.floor(this.visualSamplePosition / this.sampleRate);
			} else if (this.context) {
				const elapsed = this.context.currentTime - this.playbackStartTime;
				elapsedSec = Math.floor((this.startSample + elapsed * this.sampleRate) / this.sampleRate);
			}
			this.vgmplayTime.innerText = this._formatTime(Math.max(0, elapsedSec)) + '/-:--';
		} else {
			const currentSample = this.visualSamplePosition;
			const elapsedSec = Math.floor(currentSample / this.sampleRate);
			const totalSec = Math.floor(this.totalSampleCount / this.sampleRate);
			this.vgmplayTime.innerText = this._formatTime(elapsedSec) + '/' + this._formatTime(totalSec);
		}
	}

	if (!isLooping) {
		const currentSample = this.visualSamplePosition;
		const progress = Math.min(currentSample / this.totalSampleCount, 1);
		this.progressFill.style.width = (progress * 100) + '%';
	} else {
		// Hide fill bar while looping (progress bar container is already hidden,
		// but reset fill so it starts clean when loop is disabled)
		this.progressFill.style.width = '0%';
	}
};

VGMPlay_js.prototype._formatTime = function (seconds) {
	if (isNaN(seconds) || seconds < 0) return "0:00";
	var m = Math.floor(seconds / 60);
	var s = Math.floor(seconds % 60);
	return m + ":" + (s < 10 ? "0" : "") + s;
};

VGMPlay_js.prototype._resetProgressBar = function () {
	if (this.progressFill) this.progressFill.style.width = '0%';
	if (this.vgmplayTime) this.vgmplayTime.innerText = '0:00/0:00';
};

VGMPlay_js.prototype._onProgressClick = function (e) {
	if (!this.isVGMPlaying || !this.totalSampleCount) return;

	const entry = this.activeGame && this.activeGame.playableList ? this.activeGame.playableList[this.currentFileKey] : null;
	const path = String(entry && entry.filepath ? entry.filepath : (this.currentFileKey || "")).toLowerCase();

	if (this._isUsfFile(path)) {
		if (this.debugMode) console.warn("[VGM] Seeking not supported for USF files.");
		return;
	}

	var rect = this.progressContainer.getBoundingClientRect();
	var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
	var targetSample = Math.floor(ratio * this.totalSampleCount);

	const isMus = path.endsWith('.mus') || (path.endsWith('.lmp') && !path.endsWith('genmidi.lmp'));
	if (isMus && this.loopMode === 1 && this.currentTrackSupportsLoop && this._loopBaseSamplesByTrack) {
		const baseLen = this._loopBaseSamplesByTrack.get(this.currentFileKey);
		if (baseLen && baseLen > 0) {
			targetSample = targetSample % baseLen;
		}
	}
	this._lastSeekAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
	this._lastSeekWasMUS = isMus;
	this._setInfoLoading(true);

	setTimeout(() => {
		// Seek in the VGM engine
		var seekSecond = Math.floor(targetSample / this.sampleRate);
		var seekMS = Math.round((targetSample / this.sampleRate - seekSecond) * 1000);
		this.SeekVGM(seekSecond, seekMS);

		// Update trackers
		this.samplesGenerated = targetSample; // Keep generation somewhat in sync (optional but good practice)
		this.visualSamplePosition = targetSample;
		this.startSample = targetSample;
		this.emulatorFinished = false; // Reset finished flag on seek

		// Reset fade on seek
		this.isFadingOut = false;
		if (this.masterGain && this.context) {
			const now = this.context.currentTime;
			this.masterGain.gain.cancelScheduledValues(now);
			this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
			this.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.02);
		}

		if (this.context && !this.isPlaybackPaused) {
			this.playbackStartTime = this.context.currentTime;
		}

		// Clear worklet buffer and re-pump
		if (this.workletNode) {
			this.workletNode.port.postMessage({ type: 'stop' });
			this.workletNode.port.postMessage({ type: 'start' });
			this._pumpBuffers();
		}

		this._setInfoLoading(false);
	}, 0);
};


VGMPlay_js.prototype.toggleBassBoost = function () {
	this.bassBoostEnabled = !this.bassBoostEnabled;
	if (this.bassBoost) {
		this.bassBoost.gain.setTargetAtTime(this.bassBoostEnabled ? 12 : 0, this.context.currentTime, 0.05);
	}
	if (this.btnBass) {
		this.btnBass.classList.toggle('active', this.bassBoostEnabled);
	}
};

VGMPlay_js.prototype.toggleReverb = function () {
	this.reverbEnabled = !this.reverbEnabled;
	if (this.reverbGain) {
		this.reverbGain.gain.setTargetAtTime(this.reverbEnabled ? 0.35 : 0, this.context.currentTime, 0.05);
	}
	if (this.btnReverb) {
		this.btnReverb.classList.toggle('active', this.reverbEnabled);
	}
};

VGMPlay_js.prototype.toggleRandomScope = function () {
	this.randomMode = (this.randomMode + 1) % 3;
	this.isRandomEnabled = this.randomMode > 0;
	if (this.btnRandom) {
		this.btnRandom.classList.toggle('active', this.randomMode === 1);
		this.btnRandom.classList.toggle('blue-active', this.randomMode === 2);
	}
};

VGMPlay_js.prototype._setLoopButtonState = function () {
	if (!this.btnLoop) return;
	this.btnLoop.classList.toggle('active', this.loopMode === 1);
	this.btnLoop.classList.toggle('blue-active', this.loopMode === 2);
};

VGMPlay_js.prototype.toggleLoopMode = function () {
	const wasLooping = this.loopMode === 1;
	const now = Date.now();
	if (this.loopMode === 1) {
		// If user taps again quickly, promote to "game" loop (blue).
		// Otherwise, treat it as a disable (off).
		const withinQuickToggle = (now - (this._lastLoopToggleAt || 0)) <= 2000;
		this.loopMode = withinQuickToggle ? 2 : 0;
	} else if (this.loopMode === 2) {
		this.loopMode = 0;
	} else {
		this.loopMode = 1;
	}
	this._lastLoopToggleAt = now;
	this._applyLoopMode();

	if (this.loopMode === 1) {
		this.currentTrackSupportsLoop = this._trackSupportsLoop();
	}

	// When disabling loop on a vgmstream track: the C side plays forever so
	// visualSamplePosition (derived from AudioContext time) may already be past
	// totalSampleCount if the track has looped. In that case the JS fade would
	// fire instantly. Instead, anchor a fresh 2-second fade from current position.
	// Also apply similar logic for KSS files which can loop indefinitely.
	if (wasLooping && this.loopMode !== 1 && this.isVGMPlaying && this.context) {
		const isVgmStream = this.IsVGMStream && this.IsVGMStream();
		const isKss = this.isKSSActive;
		if (isVgmStream || isKss) {
			const elapsed = this.context.currentTime - this.playbackStartTime;
			const currentSample = Math.max(0, this.startSample + (elapsed * this.sampleRate));
			const FADE_SECS = 2.0;
			const FADE_SAMPLES = FADE_SECS * this.sampleRate;
			if (currentSample + FADE_SAMPLES > this.totalSampleCount) {
				// Anchor progress tracking to current position
				this.startSample = currentSample;
				this.playbackStartTime = this.context.currentTime;
				this.visualSamplePosition = currentSample;
				this.totalSampleCount = currentSample + FADE_SAMPLES;
				// Explicitly schedule the gain fade — don't rely on _checkTrackEnd's
				// next tick which may see inconsistent state at this boundary.
				this.isFadingOut = true;
				try {
					const now = this.context.currentTime;
					this.masterGain.gain.cancelScheduledValues(now);
					this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
					this.masterGain.gain.linearRampToValueAtTime(0, now + FADE_SECS);
				} catch (e) { }
			}
		}
	}
};

VGMPlay_js.prototype._changeTrackInGame = async function (action) {
	if (this.nativeMode && this._nativeLibraryApp && !this._nativeChangeDelegating) {
		this._nativeChangeDelegating = true;
		try {
			if (action === "previous") this._nativeLibraryApp.prevTrack();
			else this._nativeLibraryApp.nextTrack();
		} finally {
			this._nativeChangeDelegating = false;
		}
		return;
	}
	if (!this.activeGame) return;
	const list = (this.activeGame.playableList && this.activeGame.playableList.length)
		? this.activeGame.playableList
		: (this.activeGame.files || []).filter(f => f && f.filepath && this.isPlayable(f.filepath))
			.map(f => ({ filepath: f.filepath, linkElement: f.linkElement }));
	if (!list.length) return;

	if (action === 'next') {
		this.currentFileKey = (this.currentFileKey + 1) % list.length;
	} else {
		this.currentFileKey = (this.currentFileKey - 1 + list.length) % list.length;
	}
	await this.playFileFromFS(false, list[this.currentFileKey].filepath, this.games.indexOf(this.activeGame) + 1, this.currentFileKey);
};

VGMPlay_js.prototype.toggleDebugMode = function () {
	this.debugMode = !this.debugMode;
	this.debugModeHasBeenToggled = true;
	this._saveDebugModeSetting();
	if (typeof window !== 'undefined') {
		window.__VGM_DEBUG__ = this.debugMode;
	}
	this._log && this._log('UI', "Debug Mode:", this.debugMode ? "ON" : "OFF");
	if (this._showNotification && this._startCountdown) {
		this._showNotification("Debug Mode: " + (this.debugMode ? "ON" : "OFF"), 10000);
	}
	if (Module._SetDebugMode) {
		Module._SetDebugMode(this.debugMode ? 1 : 0);
	}
	// Show debug settings window when turning debug ON
	if (this.debugMode && this._showDebugSettingsWindow) {
		setTimeout(() => this._showDebugSettingsWindow(), 100);
	}
};

VGMPlay_js.prototype._loadDebugPrefixSettings = function () {
	try {
		const saved = localStorage.getItem('vgm_debug_prefixes');
		if (saved) {
			this._debugPrefixes = JSON.parse(saved);
		}
	} catch (e) { }
};

VGMPlay_js.prototype._loadDebugModeSetting = function () {
	try {
		const saved = localStorage.getItem('vgm_debug_mode');
		return saved === 'true';
	} catch (e) {
		return false;
	}
};

VGMPlay_js.prototype._saveDebugModeSetting = function () {
	try {
		localStorage.setItem('vgm_debug_mode', String(this.debugMode));
	} catch (e) { }
};

VGMPlay_js.prototype._saveDebugPrefixSettings = function () {
	try {
		localStorage.setItem('vgm_debug_prefixes', JSON.stringify(this._debugPrefixes));
	} catch (e) { }
};

VGMPlay_js.prototype._log = function (prefix, ...args) {
	if (!this.debugMode) return;
	const prefixEnabled = this._debugPrefixes[prefix] !== false;
	if (!prefixEnabled) return;
	console.log(`[VGM ${prefix}]`, ...args);
};

VGMPlay_js.prototype._logWarn = function (prefix, ...args) {
	if (!this.debugMode) return;
	const prefixEnabled = this._debugPrefixes[prefix] !== false;
	if (!prefixEnabled) return;
	console.warn(`[VGM ${prefix}]`, ...args);
};

VGMPlay_js.prototype._logError = function (prefix, ...args) {
	if (!this.debugMode) return;
	const prefixEnabled = this._debugPrefixes[prefix] !== false;
	if (!prefixEnabled) return;
	console.error(`[VGM ${prefix}]`, ...args);
};

VGMPlay_js.prototype._getKnownDebugPrefixes = function () {
	return [
		'ARCHIVES',
		'CACHE',
		'QUEUE',
		'AUDIO',
		'KSS',
		'UI',
		'MIDI',
		'METADATA',
		'SPECTRUM',
		'LIBRARY',
		'Background',
		'Offscreen',
		'Worker'
	];
};

VGMPlay_js.prototype._showDebugSettingsWindow = function () {
	if (this._debugSettingsWindowVisible) return;
	this._debugSettingsWindowVisible = true;
	const root = this.vgmplayContainer || document.body;
	const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
	let win = uiRoot.getElementById('vgmplay-debug-settings-window');
	if (!win) {
		win = document.createElement('div');
		win.id = 'vgmplay-debug-settings-window';
		win.style.cssText = `
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
background: #1a1a2e;
border: 2px solid #4a4a6a;
border-radius: 8px;
padding: 16px;
z-index: 2147483647;
min-width: 300px;
max-width: 400px;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
color: #e0e0e0;
box-shadow: 0 4px 20px rgba(0,0,0,0.5);
`;
		const title = document.createElement('div');
		title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #fff;';
		title.textContent = 'Debug Settings (press D to close)';
		win.appendChild(title);

		const knownPrefixes = this._getKnownDebugPrefixes();
		const container = document.createElement('div');
		container.style.cssText = 'max-height: 300px; overflow-y: auto;';
		knownPrefixes.forEach(prefix => {
			const label = document.createElement('label');
			label.style.cssText = 'display: flex; align-items: center; margin: 6px 0; cursor: pointer;';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = this._debugPrefixes[prefix] !== false;
			checkbox.style.cssText = 'margin-right: 8px; width: 16px; height: 16px;';
			checkbox.addEventListener('change', () => {
				this._debugPrefixes[prefix] = checkbox.checked;
				this._saveDebugPrefixSettings();
			});
			const text = document.createElement('span');
			text.textContent = prefix;
			text.style.cssText = 'font-size: 13px;';
			label.appendChild(checkbox);
			label.appendChild(text);
			container.appendChild(label);
		});
		win.appendChild(container);

		const closeBtn = document.createElement('button');
		closeBtn.textContent = 'Close';
		closeBtn.style.cssText = `
margin-top: 12px;
padding: 6px 16px;
background: #4a4a6a;
border: none;
border-radius: 4px;
color: #fff;
cursor: pointer;
font-size: 13px;
margin-right: 8px;
`;
		closeBtn.addEventListener('click', () => this._hideDebugSettingsWindow());
		win.appendChild(closeBtn);

		const turnOffBtn = document.createElement('button');
		turnOffBtn.textContent = 'Turn Debug OFF';
		turnOffBtn.style.cssText = `
margin-top: 12px;
padding: 6px 16px;
background: #6a4a4a;
border: none;
border-radius: 4px;
color: #fff;
cursor: pointer;
font-size: 13px;
`;
		turnOffBtn.addEventListener('click', () => {
			this._hideDebugSettingsWindow();
			this.debugMode = false;
			this.debugModeHasBeenToggled = true;
			this._saveDebugModeSetting();
			if (typeof window !== 'undefined') {
				window.__VGM_DEBUG__ = false;
			}
			console.log("[VGM] Debug Mode: OFF");
			if (this._showNotification && this._startCountdown) {
				this._showNotification("Debug Mode: OFF", 3000);
			}
			if (Module._SetDebugMode) {
				Module._SetDebugMode(0);
			}
		});
		win.appendChild(turnOffBtn);

		root.appendChild(win);
	}
	win.style.display = 'block';
};

VGMPlay_js.prototype._hideDebugSettingsWindow = function () {
	this._debugSettingsWindowVisible = false;
	const root = this.vgmplayContainer || document.body;
	const uiRoot = (root && root.getRootNode) ? root.getRootNode() : document;
	const win = uiRoot.getElementById('vgmplay-debug-settings-window');
	if (win) win.style.display = 'none';
};

VGMPlay_js.prototype._handleEscapeKey = function () {
	if (this._exportModalVisible) {
		this._hideExportModal();
		return true;
	}
	if (this.settingsWindow && this.settingsWindow.style.display !== 'none') {
		this._hideSettingsWindow();
		return true;
	}
	if (this.skippedWindowVisible && this.skippedWindow && this.skippedWindow.style.display !== 'none') {
		this._hideSkippedWindow();
		return true;
	}
	if (this._debugSettingsWindowVisible) {
		this._hideDebugSettingsWindow();
		return true;
	}
	return false;
};

VGMPlay_js.prototype._shouldLogPrefix = function (prefix) {
	if (!this.debugMode) return false;
	if (!prefix) return true;
	return this._debugPrefixes[prefix] !== false;
};

VGMPlay_js.prototype._debugLog = function (prefix, ...args) {
	if (!this._shouldLogPrefix(prefix)) return;
	console.log(prefix, ...args);
};

VGMPlay_js.prototype.playRandom = function () {
	if (this.games.length === 0) return;
	let gameIndex = 0;
	let game = null;
	if (this.randomMode === 1 && this.activeGame) {
		gameIndex = this.games.indexOf(this.activeGame);
		game = this.activeGame;
	} else {
		gameIndex = Math.floor(Math.random() * this.games.length);
		game = this.games[gameIndex];
	}
	if (!game) return;
	const playableList = (game.playableList && game.playableList.length)
		? game.playableList
		: (game.files || []).filter(f => f && f.filepath && this.isPlayable(f.filepath))
			.map(f => ({ filepath: f.filepath, linkElement: f.linkElement }));
	if (!playableList.length) return;
	const fileIndex = Math.floor(Math.random() * playableList.length);
	this.playFileFromFS(false, playableList[fileIndex].filepath, gameIndex + 1, fileIndex);
};

if (typeof window !== 'undefined' && !window.vgmPlayInstance && (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) || window.VGMPLAY_EXTENSION_OPTIONS) {
	if (window.__VGM_DEBUG__) {
		console.log('[VGM] Auto-init condition met, VGMPLAY_EXTENSION_OPTIONS:', window.VGMPLAY_EXTENSION_OPTIONS);
	}
	const scriptEl = document.currentScript;
	const data = scriptEl ? scriptEl.dataset : {};
	// Use extension options if available, otherwise build from data attributes
	const options = window.VGMPLAY_EXTENSION_OPTIONS || {};
	if (window.VGMPLAY_NATIVE_PLAYER) {
		options.useAsLibrary = true;
		options.autoScanDist = false;
	}
	if (!window.VGMPLAY_EXTENSION_OPTIONS) {
		// Only add standalone from data if not using extension options
		if (data && typeof data.standalone !== 'undefined') {
			options.standalone = data.standalone;
		}
	}
	if (window.__VGM_DEBUG__) {
		console.log('[VGM] Starting async initialization with options:', options);
	}
	(async () => {
		let cacheSuffix = '';
		try {
			const force = typeof window !== 'undefined' && window.VGMPLAY_CACHE_BUST;
			const host = (window.location && window.location.hostname) ? window.location.hostname : '';
			const cacheBust = !!force || host === 'localhost' || host === '127.0.0.1';
			if (cacheBust) {
				cacheSuffix = '?v=' + Date.now();
			}
		} catch (e) { }
		const installers = [];
		const loadModule = async (path, fnName, label) => {
			try {
				const tryImport = async (p) => {
					return await import(p + cacheSuffix);
				};
				let mod = null;
				try {
					mod = await tryImport(path);
				} catch (e1) {
					// Fallback: use baseURL if relative import fails (e.g. GitHub Pages).
					if (typeof window !== 'undefined' && window.vgmPlayInstance && window.vgmPlayInstance.baseURL && path.startsWith('./')) {
						const alt = window.vgmPlayInstance.baseURL + path.substring(2);
						mod = await tryImport(alt);
					} else {
						throw e1;
					}
				}
				const fn = mod && mod[fnName];
				if (typeof fn === 'function') {
					installers.push(fn);
				} else {
					if (this.debugMode) console.warn(`[VGMPlay] ${label} module missing installer`);
				}
			} catch (e) {
				if (this.debugMode) console.error(`[VGMPlay] ${label} module failed to load`, e);
				if (label === 'spectrum') {
					VGMPlay_js.prototype._startSpectrumAnimation = function () { };
					VGMPlay_js.prototype._stopSpectrumAnimation = function () { };
					VGMPlay_js.prototype._clearSpectrum = function () { };
					VGMPlay_js.prototype._drawSpectrum = function () { };
				}
			}
		};

		await loadModule('./vgmplay-spectrum.js', 'installSpectrum', 'spectrum');
		await loadModule('./vgmplay-ui.js', 'installUi', 'ui');
		await loadModule('./vgmplay-metadata.js', 'installMetadata', 'metadata');
		await loadModule('./vgmplay-midi.js', 'installMidi', 'midi');
		await loadModule('./vgmplay-layout.js', 'installLayout', 'layout');
		await loadModule('./vgmplay-library.js', 'installLibrary', 'library');
		await loadModule('./vgmplay-kss.js', 'installKss', 'kss');
		await loadModule('./vgmplay-archives.js', 'installArchives', 'archives');
		await loadModule('./vgmplay-audio.js', 'installAudio', 'audio');
		await loadModule('./vgmplay-queue.js', 'installQueue', 'queue');
		await loadModule('./vgmplay-harvester.js', 'installHarvester', 'harvester');
		await loadModule('./vgmplay-cache.js', 'installCache', 'cache');

		installers.forEach((fn) => fn(VGMPlay_js));
		console.log('[VGM] All modules loaded, creating VGMPlay instance, installers count:', installers.length);
		var vgmplay_js = new VGMPlay_js(options);
		window.vgmPlayInstance = vgmplay_js;

		// Process any URLs that were queued before the queue module was loaded
		if (vgmplay_js._pendingQueueURLs && vgmplay_js._pendingQueueURLs.length > 0) {
			console.log('[VGM] Processing', vgmplay_js._pendingQueueURLs.length, 'pending URLs queued before module load');
			for (const pending of vgmplay_js._pendingQueueURLs) {
				vgmplay_js._queueURL(pending.url, pending.forceLarge);
			}
			vgmplay_js._pendingQueueURLs = [];
		}
		if (vgmplay_js._processQueuePending) {
			console.log('[VGM] Processing pending queue from manual upload');
			vgmplay_js._processQueuePending = false;
			setTimeout(() => vgmplay_js._processQueue(), 0);
		}
		if (typeof window !== 'undefined') {
			if (window.Module && !window.Module.__vgmplayPrintErrWrapped) {
				const original = window.Module.printErr ? window.Module.printErr.bind(window.Module) : console.error.bind(console);
				window.Module.printErr = (text) => {
					const msg = String(text || '');
					if (!window.__VGM_DEBUG__ && (msg.includes('Failed to find two consecutive MPEG audio frames') || msg.includes('[mp3 @'))) {
						return;
					}
					original(msg);
				};
				window.Module.__vgmplayPrintErrWrapped = true;
			}
			window.__VGM_DEBUG_SNAPSHOT__ = () => {
				try {
					const vgm = window.vgmplay_js || window.vgmPlayInstance;
					if (!vgm) return { error: 'vgmplay_js not found' };
					const host = (window.location && window.location.host) ? window.location.host : '';
					const overflowCount = vgm.autoOverflowURLs ? vgm.autoOverflowURLs.length : 0;
					const overflowSizeCount = vgm.autoOverflowSizes ? vgm.autoOverflowSizes.size : 0;
					let overflowBytes = 0;
					if (vgm.autoOverflowSizes) {
						for (const [, size] of vgm.autoOverflowSizes.entries()) {
							if (typeof size === 'number' && !Number.isNaN(size)) overflowBytes += size;
						}
					}
					return {
						origin: (window.location && window.location.origin) ? window.location.origin : '',
						host,
						cacheReady: vgm._cacheReady,
						gamesLoaded: vgm.games ? vgm.games.length : 0,
						cacheFingerprints: vgm._cacheFingerprints ? vgm._cacheFingerprints.size : 0,
						cacheArchiveNames: vgm._cacheArchiveNames ? vgm._cacheArchiveNames.size : 0,
						cacheHostMeta: vgm._cacheRestoredByHost ? Array.from(vgm._cacheRestoredByHost.entries()) : null,
						cacheRestoredGameCount: vgm._cacheRestoredGameCount || 0,
						autoCacheHits: vgm.autoCacheHits || 0,
						autoDownloadCount: vgm.autoDownloadCount || 0,
						autoDownloadBytes: vgm.autoDownloadBytes || 0,
						autoDownloadLimit: vgm.autoDownloadLimit,
						autoDownloadBytesLimit: vgm.autoDownloadBytesLimit,
						autoOverflowCount: overflowCount,
						autoOverflowSizesCount: overflowSizeCount,
						autoOverflowBytes: overflowBytes,
						zipQueueLength: vgm.zipQueue ? vgm.zipQueue.length : 0,
						zipURLPending: vgm.zipURLPending ? vgm.zipURLPending.length : 0,
						zipURLLoaded: vgm.zipURLLoaded ? vgm.zipURLLoaded.length : 0,
						autoScanDist: !!vgm.autoScanDist,
						standalone: !!vgm.standalone,
						isExtension: !!vgm.isExtension,
						sharedCache: !!vgm.sharedCache
					};
				} catch (e) {
					return { error: String(e) };
				}
			};
			if (!window.__VGM_DEBUG_LISTENER__) {
				window.__VGM_DEBUG_LISTENER__ = true;
				window.addEventListener('message', (e) => {
					if (e.source !== window) return;
					const data = e.data || {};
					if (data.type !== 'VGM_DEBUG_SNAPSHOT_REQUEST') return;
					const payload = (window.__VGM_DEBUG_SNAPSHOT__) ? window.__VGM_DEBUG_SNAPSHOT__() : { error: 'debug snapshot unavailable' };
					window.postMessage({ type: 'VGM_DEBUG_SNAPSHOT_RESPONSE', id: data.id, payload }, '*');
				});
			}
			if (!window.__VGM_CACHE_BRIDGE_LISTENER__) {
				window.__VGM_CACHE_BRIDGE_LISTENER__ = true;
				window.addEventListener('message', async (e) => {
					if (e.source !== window) return;
					const data = e.data || {};
					if (data.type !== 'VGM_CACHE_BRIDGE_REQUEST') return;
					const vgm = window.vgmplay_js || window.vgmPlayInstance;
					let payload = { error: 'vgmplay_js not found' };
					try {
						if (vgm && vgm._cacheBridgeRequest) {
							payload = await vgm._cacheBridgeRequest(data.action, data.payload || {});
						}
					} catch (err) {
						payload = { error: String(err) };
					}
					window.postMessage({ type: 'VGM_CACHE_BRIDGE_RESPONSE', id: data.id, payload }, '*');
				});
			}
			if (!window.__VGM_ARCHIVE_EXTRACT_LISTENER__ && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
				window.__VGM_ARCHIVE_EXTRACT_LISTENER__ = true;
				chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
					if (!message || message.type !== 'vgm-archive-extract-result') return false;
					const vgm = window.vgmplay_js || window.vgmPlayInstance;
					if (vgm && vgm._onBackgroundExtractResult) {
						vgm._onBackgroundExtractResult(message);
					}
					return false;
				});
			}
		}
		if (window.__VGM_DEBUG__) {
			console.log('[VGM] VGMPlay instance created and assigned to window.vgmPlayInstance');
		}
		if (typeof window !== 'undefined' && window.__VGM_RUNTIME_READY__ && vgmplay_js && vgmplay_js.loadWhenReady) {
			try { vgmplay_js.loadWhenReady(); } catch (e) { }
		}
		if (vgmplay_js && vgmplay_js._autoScanDist) {
			setTimeout(() => {
				vgmplay_js.checkEverythingReady().then(() => {
					vgmplay_js._autoScanDist();
					if (vgmplay_js._tryLoadMiscImageFromFS) {
						vgmplay_js._tryLoadMiscImageFromFS();
					}
				});
			}, 0);
		}
	})();
}
