'use strict';

class VGMPlay_js {

	constructor(options = {}) {
		window.vgmplay_js = this; // Ensure global access for UI handlers
		window.vgmPlayInstance = this;

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
		this.pendingZipRender = false;
		this._lastSeekAt = 0;
		this._lastSeekWasMUS = false;
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
		this._mousetrapStopCallbackPatched = false;
		// No auto-download cap in full standalone mode (desktop or mobile)
		this.autoDownloadLimit = this.standalone ? Number.POSITIVE_INFINITY : 10;
		this.autoDownloadCount = 0;
		this.autoOverflowURLs = [];
		this.noPlayableNotices = [];

		this.pos1 = 0;
		this.pos2 = 0;
		this.pos3 = 0;
		this.pos4 = 0;
		this.trackListTransformX = 0;
		this.trackListTransformY = 0;
		this.standaloneGroupTransformX = 0;
		this.standaloneGroupTransformY = 0;
		this.libraryState = 0; // 0: Attached, 1: Floating, 2: Hidden

		// Playback tracking
		this.playbackStartTime = 0;
		this.startSample = 0;
		this.visualSamplePosition = 0;
		this.emulatorFinished = false;

		// Bind dragging methods
		this.elementDrag = this.elementDrag.bind(this);
		this.stopDrag = this.stopDrag.bind(this);
		this.dragStart = this.dragStart.bind(this);

		// Determine base URL
		this.baseURL = options.baseURL || '';
		if (!this.baseURL) {
			try {
				const currentScript = document.currentScript;
				if (currentScript && currentScript.src) {
					this.baseURL = currentScript.src.substring(0, currentScript.src.lastIndexOf('/') + 1);
				}
			} catch (e) { }
			if (!this.baseURL) {
				this.baseURL = 'https://niekvlessert.github.io/vgmplay-js-2/';
			}
		}

		// Define Emscripten Module object before loading vgmplay-js.js
		if (typeof window !== 'undefined') {
			window.Module = window.Module || {};
			if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
			if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
			const base = this.baseURL;
			window.Module.print = (text) => { console.log(text); };
			window.Module.printErr = (text) => { console.error(text); };
			window.Module.locateFile = function (path, prefix) {
				if (path.endsWith(".data")) return base + path;
				return prefix + path;
			};
			window.Module.onRuntimeInitialized = function () {
				if (window.vgmplay_js && window.vgmplay_js.loadWhenReady) {
					window.vgmplay_js.loadWhenReady();
				}
			};
		}

		// Load core scripts
		var script = document.createElement("script");
		script.src = this.baseURL + "vgmplay-js.js";
		var script3 = document.createElement("script");
		script3.src = this.baseURL + "minizip-asm.min.js";
		var script4 = document.createElement("script");
		script4.src = this.baseURL + "7zz.umd.js";

		document.head.appendChild(script);
		document.head.appendChild(script3);
		document.head.appendChild(script4);

		// Handle UI initialization
		if (!this.useAsLibrary) {
			var script2 = document.createElement("script");
			script2.src = "https://cdnjs.cloudflare.com/ajax/libs/mousetrap/1.4.6/mousetrap.min.js";
			document.head.appendChild(script2);

			var link = document.createElement('link');
			link.rel = 'stylesheet';
			link.type = 'text/css';
			link.href = this.baseURL + 'css/style.css';

			// Inject styles into Head or Shadow Root
			if (options.shadowRoot) {
				options.shadowRoot.appendChild(link);
			} else {
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
				this.tracksContainer = document.createElement('div');
				this.tracksContainer.id = "vgmplayTracksContainer";
				if (this.standalone) {
					this.standaloneLeft.appendChild(this.tracksContainer);
				} else {
					uiParent.appendChild(this.tracksContainer);
				}

				this.zipFileListWindow = document.createElement('div');
				this.zipFileListWindow.id = "vgmplayZipFileList";
				this.tracksContainer.appendChild(this.zipFileListWindow);
				this.showZipFileListWindow = true;
				this.zipFileListWindow.className = "vgmplayZipFileListWindow";

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

	_initMobileUI() {
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
	}

	_setMobileView(mode) {
		if (!this.isMobile || !this.vgmplayContainer) return;
		const analyzerOnly = mode === 'analyzer';
		this.vgmplayContainer.classList.toggle('vgmplayMobileAnalyzerOnly', analyzerOnly);
		if (this.mobileToggleBtn) {
			this.mobileToggleBtn.style.display = analyzerOnly ? 'block' : 'none';
		}
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

	_resetWindowPositions() {
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

	setKeyBindings() {
		if (!this._mousetrapStopCallbackPatched && typeof Mousetrap !== 'undefined') {
			const prevStop = Mousetrap.stopCallback;
			Mousetrap.stopCallback = (e, element, combo) => {
				if (combo === 'space' && element && element.classList && element.classList.contains('vgmplayStandaloneSelect')) {
					return false;
				}
				return prevStop ? prevStop(e, element, combo) : false;
			};
			this._mousetrapStopCallbackPatched = true;
		}
		if (!this.isLibrary) {
			window.addEventListener('keydown', function (e) {
				if (e.keyCode == 32) e.preventDefault();
			});

			Mousetrap.bind('space', (e) => {
				this.togglePlayback();
				return false;
			}, 'keydown');
		}
		Mousetrap.bind('n', (e) => {
			if (this.libraryState === 1) return;
			this.changeTrack('next');
		});
		Mousetrap.bind('p', (e) => {
			if (this.libraryState === 1) return;
			this.changeTrack('previous');
		});
		Mousetrap.bind('f', (e) => {
			this.toggleDisplayZipFileListWindow();
		});
		Mousetrap.bind('s', (e) => {
			this.toggleSearchBar();
		});
		Mousetrap.bind('r', (e) => {
			this.toggleRandomScope();
		});
		Mousetrap.bind('v', (e) => {
			this.toggleReverb();
		});
		Mousetrap.bind('b', (e) => {
			this.toggleBassBoost();
		});
		Mousetrap.bind('l', (e) => {
			this.toggleLoopMode();
		});
		Mousetrap.bind('m', (e) => {
			this._setMemoryStatsVisible(!this.showMemoryStats);
		});
	}

	_bindScrollProxy(el) {
		if (!el) return;
		el.addEventListener('wheel', (e) => {
			if (!this.tracksContainer || !this.zipFileListWindow) return;
			if (!this.standalone || this.libraryState !== 1) return;
			const list = this.zipFileListWindow;
			if (list.scrollHeight <= list.clientHeight) return;
			list.scrollTop += e.deltaY;
			e.preventDefault();
		}, { passive: false });
	}

	loadWhenReady() {
		this.elms = document.getElementsByTagName("a");
		this.len = this.elms.length;
		for (var ii = 0; ii < this.len; ii++) {
			const lower = this.elms[ii].href.toLowerCase();
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.usflib') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
				this._queueURL(this.elms[ii].href, false, true);
			}
		}
		this.setKeyBindings();
	}

	dragStart(e) {
		// Don't drag if clicking interactive elements
		if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A' || e.target.classList.contains('vgmplayProgressBar') || e.target.classList.contains('vgmplayProgressFill') || e.target.classList.contains('vgmplayChipVolume')) {
			return;
		}
		e.preventDefault();
		this.pos3 = e.clientX;
		this.pos4 = e.clientY;
		if (this.standalone && this.libraryState === 1) {
			this.dragTargetWindow = this.standaloneGroup || null;
			if (this.dragTargetWindow) {
				this.dragTargetWindow.style.width = '266px';
			}
		}
		window.addEventListener('mousemove', this.elementDrag);
		window.addEventListener('mouseup', this.stopDrag);
	}

	elementDrag(e) {
		e.preventDefault();
		this.pos1 = this.pos3 - e.clientX;
		this.pos2 = this.pos4 - e.clientY;
		this.pos3 = e.clientX;
		this.pos4 = e.clientY;
		if (this.standalone && this.libraryState === 1 && this.dragTargetWindow) {
			this.standaloneGroupTransformX -= this.pos1;
			this.standaloneGroupTransformY -= this.pos2;
			this.dragTargetWindow.style.transform = `translate(${this.standaloneGroupTransformX}px, ${this.standaloneGroupTransformY}px)`;
		} else {
			this.vgmplayContainer.style.top = (this.vgmplayContainer.offsetTop - this.pos2) + "px";
			this.vgmplayContainer.style.left = (this.vgmplayContainer.offsetLeft - this.pos1) + "px";
		}

		if (this.libraryState === 1 && !this.standalone) {
			this.trackListTransformX += this.pos1;
			this.trackListTransformY += this.pos2;
			if (this.tracksContainer) this.tracksContainer.style.transform = `translate(${this.trackListTransformX}px, ${this.trackListTransformY}px)`;
		}
	}

	stopDrag() {
		window.removeEventListener('mousemove', this.elementDrag);
		window.removeEventListener('mouseup', this.stopDrag);
		this.dragTargetWindow = null;
	}

	_dragStartWindow(e) {
		if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A') {
			return;
		}
		e.preventDefault();
		this.windowDragTarget = e.currentTarget;
		this.windowPos3 = e.clientX;
		this.windowPos4 = e.clientY;
		window.addEventListener('mousemove', this._elementDragWindow);
		window.addEventListener('mouseup', this._stopDragWindow);
	}

	_elementDragWindow(e) {
		if (!this.windowDragTarget) return;
		e.preventDefault();
		this.windowPos1 = this.windowPos3 - e.clientX;
		this.windowPos2 = this.windowPos4 - e.clientY;
		this.windowPos3 = e.clientX;
		this.windowPos4 = e.clientY;
		const target = this.windowDragTarget;
		target.style.top = (target.offsetTop - this.windowPos2) + "px";
		target.style.left = (target.offsetLeft - this.windowPos1) + "px";
	}

	_stopDragWindow() {
		window.removeEventListener('mousemove', this._elementDragWindow);
		window.removeEventListener('mouseup', this._stopDragWindow);
		this.windowDragTarget = null;
	}

	showPlayer() {
		this.playerWindow.className = "vgmplayPlayerWindow";
		this.playerWindow.innerHTML = `
			<div class="vgmplayControls">
				<button onclick="vgmplay_js.changeTrack('previous')">|&lt;</button>
				<button id="buttonTogglePlayback" onclick="vgmplay_js.togglePlayback()">&#9654;</button>
				<button onclick="vgmplay_js.changeTrack('next')">&gt;|</button>
				<button onclick="vgmplay_js.stop()">&#9632;</button>
				<button id="btnBass" onclick="vgmplay_js.toggleBassBoost()">B</button>
				<button id="btnReverb" onclick="vgmplay_js.toggleReverb()">V</button>
				<button id="btnRandom" onclick="vgmplay_js.toggleRandomScope()">R</button>
				<button id="btnLoop" onclick="vgmplay_js.toggleLoopMode()">L</button>
				<button id="btnLibrary" onclick="vgmplay_js.toggleDisplayZipFileListWindow()">F</button>
				<button id="btnSearch" onclick="vgmplay_js.toggleSearchBar()">&#128269;</button>
				<span id="vgmplayTime" class="vgmplayTime">0:00/0:00</span>
			</div>
		`;
		this.buttonTogglePlayback = document.getElementById('buttonTogglePlayback');
		this.vgmplayTime = document.getElementById('vgmplayTime');
		this.btnBass = document.getElementById('btnBass');
		this.btnReverb = document.getElementById('btnReverb');
		this.btnRandom = document.getElementById('btnRandom');
		this.btnLoop = document.getElementById('btnLoop');
		this.btnLibrary = document.getElementById('btnLibrary');
		this.btnSearch = document.getElementById('btnSearch');

		this.searchBar = document.createElement('div');
		this.searchBar.className = 'vgmplaySearchBar';
		this.searchBar.style.display = 'none';
		this.searchBar.innerHTML = `<input id="vgmplaySearchInput" type="text" placeholder="Search games...">`;
		this.playerWindow.appendChild(this.searchBar);
		this.searchInput = document.getElementById('vgmplaySearchInput');
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

		this.samplesGenerated = 0;
	}

	setupDropZone() {
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
			if (this._isArchiveUrl(lower) || this.isPlayable(lower)) {
				const byteArray = await this._readFileAsUint8(file);
				this.zipQueue.push({ type: 'file', data: byteArray, name: file.name });
				queued++;
				await this._yieldToUI();
			}
		}
		this._processQueue();
		if (queued === 0 && !this.isProcessingQueue && this.zipQueue.length === 0) {
			this._setInfoLoading(false);
		}
	}

	_renderZipGamesNow() {
		if (!this.zipFileListWindow) return;
		this.zipFileListWindow.innerHTML = "";
		for (const game of this.games) {
			game.uiElement = null;
			this.showVGMFromZip(game);
		}
	}

	_scheduleZipRender() {
		this.pendingZipRender = true;
		if (!this.isProcessingQueue) {
			this.pendingZipRender = false;
			this._renderZipGamesNow();
		}
	}

	_setInfoLoading(isLoading) {
		if (!this.titleWindow) return;
		if (isLoading) {
			this.titleWindow.classList.add('vgmplayInfoLoading');
		} else {
			this.titleWindow.classList.remove('vgmplayInfoLoading');
		}
	}

	_setMemoryStatsVisible(isVisible) {
		this.showMemoryStats = !!isVisible;
		if (!this.titleWindow) return;
		if (this.showMemoryStats) {
			this.titleWindow.classList.add('vgmplayMemoryVisible');
			if (this.titleContent) this.titleContent.innerHTML = "";
			this._memoryBaselineUsed = null;
			this._updateMemoryDisplay();
		} else {
			this.titleWindow.classList.remove('vgmplayMemoryVisible');
			this.getVGMTag();
		}
	}

	_getArchiveWorker() {
		if (this.archiveWorker) return this.archiveWorker;
		if (typeof Worker === 'undefined') return null;
		try {
			const url = this.baseURL + 'archive-worker.js';
			const worker = new Worker(url);
			worker.onmessage = (e) => this._onArchiveWorkerMessage(e);
			worker.onerror = (e) => {
				console.error("[VGM] Archive worker error:", e);
			};
			this.archiveWorker = worker;
			return worker;
		} catch (e) {
			console.error("[VGM] Failed to start archive worker:", e);
			return null;
		}
	}

	_onArchiveWorkerMessage(e) {
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
	}

	_extractArchiveWithWorker(byteArray, kind) {
		return new Promise((resolve, reject) => {
			const worker = this._getArchiveWorker();
			if (!worker) {
				reject(new Error("Archive worker unavailable"));
				return;
			}
			const id = this._archiveWorkerSeq++;
			this._archiveWorkerJobs.set(id, {
				resolve,
				reject,
				entries: null,
				hasKss: false,
				fileDataByPath: new Map()
			});
			try {
				worker.postMessage(
					{ type: 'extract', id, kind, buffer: byteArray.buffer, baseURL: this.baseURL },
					[byteArray.buffer]
				);
			} catch (e) {
				this._archiveWorkerJobs.delete(id);
				reject(e);
			}
		});
	}

	async _processArchiveEntries(entries, fileDataByPath, sourceName = '', hasKss = false) {
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
			const gamePath = "/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);

			for (const entry of entries) {
				if (!entry || !entry.filepath) continue;
				const relPath = entry.filepath;
				const fileArray = fileDataByPath.get(relPath);
				if (!fileArray) continue;
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
					console.error("Error creating file in FS:", e);
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
				if (lower.endsWith(".png")) pngFile = new Blob([FS.readFile(fullPath)], { type: "image/png" });
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

			const derivedName = this._deriveVgmGameName(filteredFiles, sourceName || "Archive");
			var game = { files: filteredFiles, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, name: derivedName, gameinfo: this.tempGameInfo, archiveName: sourceName };
			this.tempGameInfo = null;
			this.games.push(game);
			this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			if (!hasPlayable) {
				this._addNoPlayableNotice(sourceName || 'Archive');
			}
			await this.checkEverythingReady();
			this._scheduleZipRender();
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
			const gamePath = "/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null };
			gamesByKey[gameKey] = game;
			gamesInOrder.push(game);
			return game;
		};

		for (const entry of entries) {
			if (!entry || !entry.filepath) continue;
			const relPath = entry.filepath;
			const fileArray = fileDataByPath.get(relPath);
			if (!fileArray) continue;
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
				console.error("Error creating file in FS:", e);
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
					console.error("Failed to read info file:", fullPath, e);
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
				this.games.push(game);
				anyPlayable = true;
			}
			await maybeYield();
		}

		this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

		if (!anyPlayable) {
			this._addNoPlayableNotice(sourceName || 'Archive');
		}

		await this.checkEverythingReady();
		if (this.zipFileListWindow) this.zipFileListWindow.innerHTML = "";
		for (const game of this.games) {
			game.uiElement = null;
			this.showVGMFromZip(game);
			await maybeYield();
		}
	}

	toggleDisplayZipFileListWindow() {
		this.libraryState = (this.libraryState + 1) % 3;

		if (this.libraryState === 0) {
			// Attached
			if (this.tracksContainer) this.tracksContainer.style.display = 'block';
			this.showZipFileListWindow = true;
			this.trackListTransformX = 0;
			this.trackListTransformY = 0;
			if (this.tracksContainer) this.tracksContainer.style.transform = `translate(0px, 0px)`;
			this._resetWindowPositions();
			if (this.btnLibrary) {
				this.btnLibrary.classList.remove('active');
				this.btnLibrary.classList.remove('blue-active');
			}
		} else if (this.libraryState === 1) {
			// Floating
			if (this.tracksContainer) this.tracksContainer.style.display = 'block';
			this.showZipFileListWindow = true;
			if (this.standalone && this.tracksContainer) {
				this.trackListTransformX = 0;
				this.trackListTransformY = 0;
				this.tracksContainer.style.transform = 'none';
			}
			// Keep current transform

			if (this.btnLibrary) {
				this.btnLibrary.classList.add('active');
				this.btnLibrary.classList.remove('blue-active');
			}
		} else if (this.libraryState === 2) {
			// Hidden
			if (this.tracksContainer) this.tracksContainer.style.display = 'none';
			this.showZipFileListWindow = false;

			if (this.btnLibrary) {
				this.btnLibrary.classList.remove('active');
				this.btnLibrary.classList.add('blue-active');
			}
		}
	}

	getVGMTag() {
		if (this.showMemoryStats) {
			if (this.titleContent) this.titleContent.innerHTML = "";
			this._updateMemoryDisplay();
			return;
		}
		if (this.titleWindow) {
			const titleStr = this.ShowTitle();
			if (!titleStr) return;
			this.VGMTag = titleStr.split("|||");
			this.tagType = 0;
			const titleTarget = this.titleContent || this.titleWindow;
			titleTarget.innerHTML = "";

			// KSS gameinfo support (moved to top for visibility)
			if (this.activeGame && this.activeGame.gameinfo) {
				const info = this.activeGame.gameinfo;
				const fields = {};
				info.split('\n').forEach(line => {
					const colon = line.indexOf(':');
					if (colon > 0) {
						const key = line.substring(0, colon).trim().toLowerCase();
						const val = line.substring(colon + 1).trim();
						fields[key] = val;
					}
				});

				let infoHtml = "<br/><b>Game Info:</b><br/>";
				let hasFields = false;
				if (fields.full_title || fields.title) {
					infoHtml += "Full Title: " + (fields.full_title || fields.title) + "<br/>";
					hasFields = true;
				}
				if (fields.year) {
					infoHtml += "Release Year: " + fields.year + "<br/>";
					hasFields = true;
				}
				if (fields.vendor) {
					infoHtml += "Publisher: " + fields.vendor + "<br/>";
					hasFields = true;
				}

				if (hasFields) {
					titleTarget.innerHTML += infoHtml;
				} else if (info.trim()) {
					titleTarget.innerHTML += "<br/><b>Game Info:</b><br/>" + info.replace(/\n/g, '<br/>') + "<br/>";
				}
			}

			let systemShown = false;
			for (this.i = 0; this.i < this.VGMTag.length; this.i++) {
				switch (this.i) {
					case 1:
						if (this.VGMTag[1] || this.VGMTag[3]) titleTarget.innerHTML += "Title: ";
						if (this.VGMTag[1]) titleTarget.innerHTML += this.VGMTag[1];
						//if (this.VGMTag[1] && this.VGMTag[3]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[3]) titleTarget.innerHTML += " (" + this.VGMTag[3] + ")";
						if (this.VGMTag[1] || this.VGMTag[3]) titleTarget.innerHTML += "<br/>";
						//this.titleWindow.innerHTML += "Length: " + this.trackLengthHumanReadeable + "<br/>";
						break;
					case 5:
						if (this.VGMTag[5] || this.VGMTag[7]) titleTarget.innerHTML += "Game: ";
						if (this.VGMTag[5]) titleTarget.innerHTML += this.VGMTag[5];
						//if (this.VGMTag[5] && this.VGMTag[7]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[7]) titleTarget.innerHTML += " (" + this.VGMTag[7] + ")";
						if (this.VGMTag[17]) titleTarget.innerHTML += ", " + this.VGMTag[17];
						if (this.VGMTag[5] || this.VGMTag[7]) titleTarget.innerHTML += "<br/>";
						break;
					case 8:
						if (this.VGMTag[9] && this.VGMTag[9].trim()) {
							titleTarget.innerHTML += "System: " + this.VGMTag[9] + "<br/>";
							systemShown = true;
						}
						break;
					case 13:
						if (this.VGMTag[13] || this.VGMTag[15]) titleTarget.innerHTML += "Author: ";
						if (this.VGMTag[13]) titleTarget.innerHTML += this.VGMTag[13];
						//if (this.VGMTag[13] && this.VGMTag[15]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[15]) titleTarget.innerHTML += " (" + this.VGMTag[15] + ")";
						if (this.VGMTag[13] || this.VGMTag[13]) titleTarget.innerHTML += "<br/>";
						break;
					case 19:
						if (this.VGMTag[19]) {
							titleTarget.innerHTML += "VGM Creator: ";
							titleTarget.innerHTML += this.VGMTag[19];
							titleTarget.innerHTML += "<br/>";
						}
						break;
					case 20:
						if (this.VGMTag[21] && this.VGMTag[21].length > 1) {
							titleTarget.innerHTML += "Comments: ";
							titleTarget.innerHTML += this.VGMTag[21];
							titleTarget.innerHTML += "<br/>";
						}
						break;
				}

			}

			// For PSF files, add System fallback if not yet shown
			if (!systemShown && this.currentFileKey !== "" && this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
				const path = this.activeGame.playableList[this.currentFileKey].filepath || "";
				const lower = path.toLowerCase();
				if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
					titleTarget.innerHTML += "System: Playstation<br/>";
				}
				if (lower.endsWith('.usf') || lower.endsWith('.miniusf')) {
					titleTarget.innerHTML += "System: Nintendo 64<br/>";
				}
			}

			// Show file format as last info line
			if (this.currentFileKey !== "" && this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
				const path = this.activeGame.playableList[this.currentFileKey].filepath || "";
				const clean = path.split('|track=')[0];
				const dot = clean.lastIndexOf('.');
				if (dot >= 0) {
					const ext = clean.substring(dot + 1).toUpperCase();
					if (ext) {
						titleTarget.innerHTML += "Format: " + ext + "<br/>";
					}
				}
			}
		}


		if (this.titleWindow) {
			const titleTarget = this.titleContent || this.titleWindow;
			// Display chips with volume sliders as the last entry of the top frame
			const chipCount = this.GetDeviceCount ? this.GetDeviceCount() : 0;
			if (chipCount > 0) {
				const chipStrip = document.createElement('div');
				chipStrip.className = "vgmplayChipStrip";
				for (let i = 0; i < chipCount; i++) {
					const name = this.GetDeviceName(i);
					const vol = this.GetDeviceVolume(i);

					const chipControl = document.createElement('div');
					chipControl.className = "vgmplayChipControl";
					chipControl.title = name;
					chipControl.innerHTML = `
							<div class="vgmplayChipName">${name}</div>
							<input type="range" min="0" max="512" value="${vol}" 
								class="vgmplayChipVolume" 
								oninput="vgmPlayInstance._setChipVolume(${i}, this.value)"
								onmousedown="event.stopPropagation()"
								onclick="event.stopPropagation()">
						`;
					chipStrip.appendChild(chipControl);
				}
				titleTarget.appendChild(chipStrip);
			}
		}
	}

	_setChipVolume(id, vol) {
		if (this.SetDeviceVolume) {
			this.SetDeviceVolume(id, parseInt(vol));
		}
	}

	_createSkippedWindow() {
		if (!this.vgmplayContainer) return;
		this.skippedWindow = document.createElement('div');
		this.skippedWindow.id = "vgmplaySkippedWindow";
		this.skippedWindow.className = "vgmplaySkippedWindow";
		this.skippedWindow.style.display = 'none';
		this.skippedWindow.style.top = '20px';
		this.skippedWindow.style.left = '300px';

		this.skippedHeader = document.createElement('div');
		this.skippedHeader.className = 'vgmplaySkippedHeader';
		this.skippedHeader.innerHTML = `
			<span class="vgmplaySkippedTitle">Skipped Downloads</span>
			<button class="vgmplaySkippedClose" title="Close">×</button>
		`;
		this.skippedWindow.appendChild(this.skippedHeader);
		this.skippedTitleEl = this.skippedHeader.querySelector('.vgmplaySkippedTitle');

		this.skippedNotice = document.createElement('div');
		this.skippedNotice.className = 'vgmplaySkippedNotice';
		this.skippedNotice.textContent = 'Big files detected; those files eat bandwidth and the memory on your device. Select files you want to load anyway.';
		this.skippedWindow.appendChild(this.skippedNotice);

		this.skippedAutoLimit = document.createElement('div');
		this.skippedAutoLimit.className = 'vgmplaySkippedAutoLimit';
		this.skippedWindow.appendChild(this.skippedAutoLimit);

		this.skippedList = document.createElement('div');
		this.skippedList.className = 'vgmplaySkippedList';
		this.skippedWindow.appendChild(this.skippedList);

		this.vgmplayContainer.appendChild(this.skippedWindow);

		this._elementDragWindow = this._elementDragWindow.bind(this);
		this._stopDragWindow = this._stopDragWindow.bind(this);
		this._dragStartWindow = this._dragStartWindow.bind(this);

		this.skippedHeader.addEventListener('mousedown', this._dragStartWindow);
		this.skippedHeader.querySelector('.vgmplaySkippedClose').addEventListener('click', () => {
			this.skippedWindow.style.display = 'none';
			this.skippedWindowVisible = false;
		});

		this._renderSkippedDownloads();
		this._positionSkippedWindow();
		window.addEventListener('resize', () => this._positionSkippedWindow());
	}

	_renderSkippedDownloads() {
		if (!this.skippedList) return;
		this.skippedList.innerHTML = '';
		this._updateSkippedTitle();
		this._updateSkippedNotice();
		if (this.skippedAutoLimit) {
			this._renderAutoLimitNotice();
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
	}

	_updateSkippedTitle() {
		if (!this.skippedTitleEl) return;
		const hasBig = this.skippedDownloads.length > 0;
		const hasLots = this.autoOverflowURLs.length > 0;
		let title = 'Skipped Downloads';
		if (hasLots && !hasBig) {
			title = 'Lots of files';
		} else if (hasLots && hasBig) {
			title = 'Skipped Downloads & Lots of Files';
		}
		this.skippedTitleEl.textContent = title;
	}

	_updateSkippedNotice() {
		if (!this.skippedNotice) return;
		this.skippedNotice.style.display = (this.skippedDownloads.length > 0) ? 'block' : 'none';
	}

	_renderAutoLimitNotice() {
		const count = this.autoOverflowURLs.length;
		if (count === 0) {
			this.skippedAutoLimit.innerHTML = '';
			return;
		}
		this.skippedAutoLimit.innerHTML = `
			<div class="vgmplaySkippedAutoText">Auto-download limit hit. ${count} file${count === 1 ? '' : 's'} waiting.</div>
			<div class="vgmplaySkippedAutoActions">
				<button class="vgmplaySkippedLoadMore">Load 10 more</button>
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
	}

	_showSkippedWindow() {
		if (!this.skippedWindow) return;
		if (!this.skippedWindowVisible) {
			this.skippedWindow.style.display = 'block';
			this.skippedWindowVisible = true;
			this._positionSkippedWindow();
		}
	}

	_addSkippedDownload(url, size) {
		const existing = this.skippedDownloads.find((x) => x.url === url);
		if (existing) return;
		const name = this._getFileNameFromUrl(url);
		const sizeMB = this._formatMB(size);
		this.skippedDownloads.push({ url, name, sizeMB });
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	}

	_addNoPlayableNotice(name) {
		const safeName = name || 'File';
		const msg = `${safeName} did not contain playable music for VGMPlay!`;
		if (this.noPlayableNotices.includes(msg)) return;
		this.noPlayableNotices.push(msg);
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	}

	_loadSkippedDownload(url) {
		const lower = url.toLowerCase();
		if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
			this.loadZIPWithVGMFromURL(url, true);
		} else if (this.isPlayable(lower)) {
			this._queueURL(url, true);
		}
	}

	_loadMoreAuto(count) {
		let remaining = count;
		while (this.autoOverflowURLs.length > 0 && remaining > 0) {
			const url = this.autoOverflowURLs.shift();
			this._queueURL(url, false, false);
			remaining--;
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
	}

	_getFileNameFromUrl(url) {
		try {
			const u = new URL(url);
			const p = u.pathname;
			const last = p.substring(p.lastIndexOf('/') + 1);
			return decodeURIComponent(last || url);
		} catch (e) {
			const idx = url.lastIndexOf('/');
			return decodeURIComponent(idx >= 0 ? url.substring(idx + 1) : url);
		}
	}

	_positionSkippedWindow() {
		if (!this.skippedWindow || !this.playerWindow) return;
		if (this.skippedWindowVisible === false) return;
		requestAnimationFrame(() => {
			const isMobile = window.innerWidth <= 600;
			const playerLeft = this.playerWindow.offsetLeft;
			const playerTop = this.playerWindow.offsetTop;
			const playerWidth = this.playerWindow.offsetWidth;
			let gap = 8;
			if (this.titleWindow) {
				const titleTop = this.titleWindow.offsetTop;
				const titleHeight = this.titleWindow.offsetHeight;
				const inferred = playerTop - (titleTop + titleHeight);
				if (Number.isFinite(inferred) && inferred >= 0) {
					gap = inferred;
				}
			}

			if (isMobile) {
				this.skippedWindow.style.left = playerLeft + "px";
				const desiredTop = playerTop - this.skippedWindow.offsetHeight - gap;
				this.skippedWindow.style.top = Math.max(0, desiredTop) + "px";
			} else {
				const desiredLeft = playerLeft + playerWidth + gap;
				this.skippedWindow.style.left = desiredLeft + "px";
				this.skippedWindow.style.top = playerTop + "px";
			}
		});
	}

	async _getRemoteFileSize(url) {
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
	}

	_formatMB(bytes) {
		const mb = bytes / (1024 * 1024);
		const rounded = Math.round(mb * 10) / 10;
		return (rounded % 1 === 0) ? String(rounded.toFixed(0)) : String(rounded);
	}

	async _shouldDownload(url, forceLarge) {
		if (forceLarge) return true;
		if (this.standalone) return true;
		const size = await this._getRemoteFileSize(url);
		if (!size || size <= this.largeDownloadLimitBytes) return true;
		this._addSkippedDownload(url, size);
		return false;
	}

	_queueURL(url, forceLarge = false, isAuto = false) {
		if (this.zipURLLoaded.includes(url)) return;
		if (this.zipURLPending.includes(url)) return;
		if (isAuto && this.autoDownloadCount >= this.autoDownloadLimit) {
			this._queueAutoOverflow(url);
			return;
		}
		this.zipURLPending.push(url);
		this.zipQueue.push({ type: 'url', data: url, forceLarge, name: this._getFileNameFromUrl(url) });
		if (isAuto) this.autoDownloadCount++;
		this._processQueue();
	}

	_queueAutoOverflow(url) {
		if (!this.autoOverflowURLs.includes(url)) {
			this.autoOverflowURLs.push(url);
		}
		this._showSkippedWindow();
		this._renderSkippedDownloads();
		this._checkLargeOverflow(url);
	}

	async _checkLargeOverflow(url) {
		if (this.standalone) return;
		const size = await this._getRemoteFileSize(url);
		if (!size || size <= this.largeDownloadLimitBytes) return;
		this._addSkippedDownload(url, size);
	}

	loadVGMFromURL(url) {
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
								console.error("FS Error loading direct file:", e);
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
	}

	loadZIPWithVGMFromURL(url, forceLarge = false) {
		this._queueURL(url, forceLarge);
	}

	_processQueue() {
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
								} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
									classContext.processPSFBuffer(byteArray, job.data).then(next);
								} else if (lower.endsWith('.zip')) {
									classContext.processZipBuffer(byteArray, job.name).then(next);
								} else {
									classContext.processSingleBuffer(byteArray, job.name).then(next);
								}
								classContext.zipURLLoaded.push(job.data);
							} else {
								console.error("Failed to load archive from URL:", job.data);
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
				} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
					classContext.processPSFBuffer(job.data, job.name).then(next);
				} else if (lower.endsWith('.zip')) {
					classContext.processZipBuffer(job.data, job.name).then(next);
				} else {
					classContext.processSingleBuffer(job.data, job.name).then(next);
				}
			}
		});
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

	GetVGMTagDirect(path, tagIndex) {
		if (this.functionsWrapped && this._GetVGMTagDirectNative) {
			return this._GetVGMTagDirectNative(path, tagIndex) || "";
		}
		return "";
	}

	toggleSearchBar() {
		this.searchBarVisible = !this.searchBarVisible;
		if (this.searchBar) {
			this.searchBar.style.display = this.searchBarVisible ? 'block' : 'none';
		}
		if (this.searchBarVisible && this.searchInput) {
			this.searchInput.focus();
			this.searchInput.select();
		}
	}

	_applyGameSearchFilter() {
		const query = (this.searchQuery || '').toLowerCase();
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			const name = (game.searchName || game.name || '').toLowerCase();
			const match = !query || name.includes(query);
			game.uiElement.style.display = match ? '' : 'none';
		}
	}

	_expandFirstSearchResult() {
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			if (game.uiElement.style.display === 'none') continue;
			game.uiElement.dataset.expanded = 'true';
			game.uiElement.classList.add('vgmplayGameExpanded');
			game.uiElement.classList.remove('vgmplayGameCollapsed');
			return;
		}
	}

	_collapseAllGames() {
		for (const game of this.games) {
			if (!game || !game.uiElement) continue;
			game.uiElement.dataset.expanded = 'false';
			game.uiElement.classList.remove('vgmplayGameExpanded');
			game.uiElement.classList.add('vgmplayGameCollapsed');
		}
	}

	_deriveVgmGameName(files, fallbackName) {
		let name = fallbackName || "Archive";
		if (!files || !this.GetVGMTagDirect) return name;
		for (const f of files) {
			if (!f || !f.filepath) continue;
			const lower = f.filepath.toLowerCase();
			if (!this.isPlayable(lower)) continue;
			if (!lower.endsWith('.vgm') && !lower.endsWith('.vgz')) continue;
			const tag = this.GetVGMTagDirect(f.filepath, 2);
			if (tag && tag.trim()) {
				name = tag.trim();
				break;
			}
		}
		return name;
	}

	async processZipBuffer(byteArray, sourceName = '') {
		try {
			const workerResult = await this._extractArchiveWithWorker(byteArray, 'zip');
			await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, sourceName, workerResult.hasKss);
			return;
		} catch (e) {
			if (byteArray.byteLength === 0) {
				console.error("[VGM] Zip worker failed after buffer transfer:", e);
				return;
			}
			console.warn("[VGM] Zip worker failed, falling back to main thread:", e);
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
			const gamePath = "/game_" + this.amountOfGamesLoaded;
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
					console.error("Error creating file in FS:", e);
				}
				const lower = relPath.toLowerCase();
				if (lower.includes("m3u")) m3uFile = FS.readFile(fullPath, { encoding: "utf8" });
				if (lower.endsWith(".txt") || lower.endsWith(".trackinfo") || lower.includes("gameinfo")) {
					const txt = FS.readFile(fullPath, { encoding: "utf8" });
					if (lower.includes("gameinfo")) {
						// Store it in a variable since 'game' object isn't created yet
						this.tempGameInfo = txt;
					} else {
						txtFile = txt;
					}
				}
				if (lower.endsWith(".png")) pngFile = new Blob([FS.readFile(fullPath)], { type: "image/png" });
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

			const derivedName = this._deriveVgmGameName(filteredFiles, sourceName || "Archive");
			var game = { files: filteredFiles, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, name: derivedName, gameinfo: this.tempGameInfo, archiveName: sourceName };
			this.tempGameInfo = null;
			this.games.push(game);
			this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
			const hasPlayable = game.files.some((f) => this.isPlayable(f.filepath));
			if (!hasPlayable) {
				this._addNoPlayableNotice(sourceName || 'Archive');
			}
			await this.checkEverythingReady();
			this._scheduleZipRender();
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
			const gamePath = "/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null };
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
				console.error("Error creating file in FS:", e);
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
					console.error("Failed to read info file:", fullPath, e);
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
				this.games.push(game);
				anyPlayable = true;
			}
			await maybeYield();
		}

		// Sort games alphabetically
		this.games.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

		if (!anyPlayable) {
			this._addNoPlayableNotice(sourceName || 'Archive');
		}

		await this.checkEverythingReady();
		// Clear and re-render all games to maintain sort order
		this._scheduleZipRender();
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
			console.error("[VGM] purgeGamesFS failed:", e);
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
			console.error("[VGM] Failed to remove:", path, e);
		}
	}

	processSingleBuffer(byteArray, sourceName = '') {
		return new Promise((resolve) => {
			let game;
			const miscGameName = "Misc";

			// Find existing "Misc" game or create new one
			game = this.games.find(g => g.name === miscGameName);

			if (!game) {
				this.amountOfGamesLoaded++;
				const gamePath = "/game_" + this.amountOfGamesLoaded;
				this._makedirs(gamePath);
				game = { files: [], path: gamePath, name: miscGameName };
				this.games.push(game);
			}

			const fileName = sourceName || "track_" + Date.now();
			const fsPath = game.path + "/" + fileName;

			// Overwrite if exists, but we use timestamps/unique names mostly
			try {
				FS.createDataFile(game.path, fileName, byteArray, true, true);
			} catch (e) {
				// If it already exists, overwrite
				if (e.name === 'ErrnoError' && e.errno === 20) {
					FS.unlink(fsPath);
					FS.createDataFile(game.path, fileName, byteArray, true, true);
				}
			}

			const track = { filepath: fsPath };
			game.files.push(track);

			const isPlayable = this.isPlayable(fsPath);
			if (!isPlayable) {
				this._addNoPlayableNotice(sourceName || 'File');
			}

			this.checkEverythingReady().then(() => {
				this.showVGMFromZip(game);
				resolve();
			});
		});
	}

	async process7zBuffer(byteArray, sourceName = '') {
		try {
			const workerResult = await this._extractArchiveWithWorker(byteArray, '7z');
			await this._processArchiveEntries(workerResult.entries, workerResult.fileDataByPath, sourceName, workerResult.hasKss);
			return;
		} catch (e) {
			if (byteArray.byteLength === 0) {
				console.error("[VGM] 7z worker failed after buffer transfer:", e);
				return;
			}
			console.warn("[VGM] 7z worker failed, falling back to main thread:", e);
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
			const gamePath = "/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const parsedName = parseArchiveTitle(sourceName);
			const game = { files: [], path: gamePath, kssTxtByBase: {}, kssTxtOrder: [], png: null, archiveName: sourceName, name: parsedName };
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
			const gamePath = "/game_" + (++this.amountOfGamesLoaded);
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
			const game = { files: fileList, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath, archiveName: sourceName, name: derivedName };

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
	}

	async processPSFBuffer(byteArray, fileName) {
		this.amountOfGamesLoaded++;
		const gamePath = "/game_" + this.amountOfGamesLoaded;
		this._makedirs(gamePath);

		const fsPath = gamePath + "/" + fileName;
		FS.createDataFile(gamePath, fileName, byteArray, true, true);

		const fileList = [{ filepath: fsPath }];
		var game = { files: fileList, path: gamePath };
		this.games.push(game);
		await this.checkEverythingReady();
		this.showVGMFromZip(game);
	}

	addHarvestedTracks(urls) {
		urls.forEach(url => {
			const lower = url.toLowerCase();
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') || lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.usflib') || lower.endsWith('.mp3') || lower.endsWith('.flac') || lower.endsWith('.ogg') || lower.endsWith('.wav') || lower.endsWith('.mus') || lower.endsWith('.lmp')) {
				this._queueURL(url, false, true);
			} else if (this.isPlayable(lower)) {
				// Handle direct links as single files
				this._queueURL(url, false, true);
			}
		});
	}

	showVGMFromZip(game) {
		// Ensure game name is set from archive name if available
		if (!game.name && game.archiveName) {
			game.name = game.archiveName;
		}
		const files = game.files;
		const gameIndex = this.games.indexOf(game) + 1;
		let gameDisplayName = game.name || "";
		let tagGameName = "";

		if (this.zipFileListWindow) {
			let gameWrap = game.uiElement;
			let trackContainer;
			let playableList = game.playableList;

			if (!gameWrap) {
				playableList = [];
				game.playableList = playableList;
				game.lastRenderedCount = 0;

				gameWrap = document.createElement('div');
				gameWrap.className = 'vgmplayGame';
				gameWrap.dataset.expanded = 'false';
				gameWrap.classList.add('vgmplayGameCollapsed');
				game.uiElement = gameWrap;

				for (const f of files) {
					const l = f.filepath.toLowerCase();
					if (this.isPlayable(l)) {
						tagGameName = this.GetVGMTagDirect(f.filepath, 2); // Game tag
						if (tagGameName) break;
					}
				}

				if (game.png) {
					const url = URL.createObjectURL(game.png);
					const img = new Image();
					img.src = url;
					img.style.width = '256px';
					img.style.height = 'auto';
					img.style.objectFit = 'contain';
					img.style.background = '#000';
					img.style.maxHeight = '212px';
					img.style.display = 'block';
					img.className = 'vgmplayGameToggle';
					gameWrap.appendChild(img);
					gameWrap.appendChild(document.createElement("br"));
				} else {
					// No logo, add spacer and game name placeholder
					// No spacer; keep spacing minimal for text-only entries

					const placeholder = document.createElement("div");
					placeholder.className = "game-name-placeholder";

					// Try to get game name from first track if possible
					let psfGame = tagGameName || "";
					if (psfGame && (psfGame.toLowerCase().endsWith('.usf') || psfGame.toLowerCase().endsWith('.miniusf'))) {
						psfGame = ""; // Filter out bad data if it's just the filename
					}
					gameDisplayName = game.name || psfGame || "Game " + gameIndex;
					placeholder.textContent = gameDisplayName;
					placeholder.classList.add('vgmplayGameToggle');
					gameWrap.appendChild(placeholder);
				}

				if (!gameDisplayName) {
					gameDisplayName = game.name || tagGameName || "Game " + gameIndex;
				} else if (tagGameName && !gameDisplayName) {
					gameDisplayName = tagGameName;
				}
				if (tagGameName && (!game.name || gameDisplayName === game.name)) {
					gameDisplayName = tagGameName;
				}
				if (!gameDisplayName) {
					gameDisplayName = game.name || "Game " + gameIndex;
				}
				game.searchName = gameDisplayName;
				gameWrap.dataset.searchName = gameDisplayName.toLowerCase();

				trackContainer = document.createElement('div');
				trackContainer.className = 'vgmplayGameTracks';
				game.trackContainer = trackContainer;
				gameWrap.appendChild(trackContainer);

				gameWrap.addEventListener('click', (e) => {
					const tgt = e.target;
					if (!(tgt && tgt.classList && tgt.classList.contains('vgmplayGameToggle'))) return;
					const expanded = gameWrap.dataset.expanded === 'true';
					gameWrap.dataset.expanded = expanded ? 'false' : 'true';
					gameWrap.classList.toggle('vgmplayGameExpanded', !expanded);
					gameWrap.classList.toggle('vgmplayGameCollapsed', expanded);
				});

				this.zipFileListWindow.appendChild(gameWrap);
			} else {
				trackContainer = game.trackContainer;
				if (!gameDisplayName) {
					gameDisplayName = game.name || "Game " + gameIndex;
				}
				game.searchName = gameDisplayName;
				gameWrap.dataset.searchName = gameDisplayName.toLowerCase();
			}

			const startIndex = game.lastRenderedCount || 0;
			for (let key = startIndex; key < files.length; key++) {
				const fullPath = files[key].filepath;
				const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1);
				const lower = fileName.toLowerCase();
				if (this.isPlayable(lower)) {
					try {
						const currentSampleRate = this.sampleRate || 44100;
						if (this._isGmeFile(lower) && this.GetGMETrackCountDirect) {
							const count = this.GetGMETrackCountDirect(fullPath);
							if (count > 1) {
								for (let t = 0; t < count; t++) {
									const trackPath = `${fullPath}|track=${t}`;
									const trackLength = this.GetTrackLengthDirect(trackPath);
									const totalSampleCount = trackLength * currentSampleRate / 44100;
									const trackLengthSeconds = totalSampleCount > 0 ? Math.round(totalSampleCount / currentSampleRate) : 0;
									const trackLengthHumanReadeable = trackLengthSeconds > 0 ? new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5) : "";

									const a = document.createElement("a");
									a.className = "vgmplayTrack";
									const playableIndex = playableList.length;
									a.dataset.playableIndex = playableIndex;
									a.onclick = () => this.playFileFromFS(a, trackPath, gameIndex, playableIndex);

									const nameSpan = document.createElement("span");
									nameSpan.className = "track-name";
									const tName = this.GetGMETrackNameDirect ? this.GetGMETrackNameDirect(fullPath, t) : "";
									nameSpan.textContent = tName || `${fileName} - Track ${t + 1}`;
									a.appendChild(nameSpan);

									const lengthSpan = document.createElement("span");
									lengthSpan.className = "track-length";
									lengthSpan.textContent = trackLengthHumanReadeable;
									a.appendChild(lengthSpan);

									trackContainer.appendChild(a);
									playableList.push({ filepath: trackPath, linkElement: a, lengthSec: trackLengthSeconds, title: nameSpan.textContent });
								}
								continue;
							}
						}
						if (this._isKssFile(lower) && this.GetKSSTrackCountDirect) {
							const kssMeta = this._getKssMetaForFile(game, fileName);
							if (kssMeta && kssMeta.entries && kssMeta.entries.length > 0) {
								const trkMin = this.GetKSSTrackMinDirect ? this.GetKSSTrackMinDirect(fullPath) : 0;
								const count = this.GetKSSTrackCountDirect ? this.GetKSSTrackCountDirect(fullPath) : 0;
								const trkMax = (count > 0) ? (trkMin + count - 1) : (this.GetKSSTrackMaxDirect ? this.GetKSSTrackMaxDirect(fullPath) : trkMin);
								for (const entry of kssMeta.entries) {
									let trackIndex = entry.index;
									if (trackIndex == null) {
										if (entry.num == null || isNaN(entry.num)) continue;
										const actualNum = entry.num;
										if (actualNum < trkMin || actualNum > trkMax) continue;
										trackIndex = actualNum - trkMin;
									}
									if (trackIndex == null || trackIndex < 0) continue;
									if (count && trackIndex >= count) continue;
									const trackPath = `${fullPath}|track=${trackIndex}`;
									let trackLengthSeconds = entry.lengthSec || 0;
									if (!trackLengthSeconds) {
										const trackLength = this.GetTrackLengthDirect(trackPath);
										const totalSampleCount = trackLength * currentSampleRate / 44100;
										trackLengthSeconds = totalSampleCount > 0 ? Math.round(totalSampleCount / currentSampleRate) : 0;
									}
									const trackLengthHumanReadeable = trackLengthSeconds > 0 ? new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5) : "";

									const a = document.createElement("a");
									a.className = "vgmplayTrack";
									const playableIndex = playableList.length;
									a.dataset.playableIndex = playableIndex;
									a.onclick = () => this.playFileFromFS(a, trackPath, gameIndex, playableIndex);
									if (entry.title) a.dataset.trackTitle = entry.title;
									if (trackLengthSeconds) a.dataset.trackLengthSec = trackLengthSeconds;

									const nameSpan = document.createElement("span");
									nameSpan.className = "track-name";
									nameSpan.textContent = entry.title || `${fileName} - Track ${trackIndex + 1}`;
									a.appendChild(nameSpan);

									const lengthSpan = document.createElement("span");
									lengthSpan.className = "track-length";
									lengthSpan.textContent = trackLengthHumanReadeable;
									a.appendChild(lengthSpan);

									trackContainer.appendChild(a);
									playableList.push({ filepath: trackPath, linkElement: a, lengthSec: trackLengthSeconds, title: nameSpan.textContent });
								}
								continue;
							} else {
								const count = this.GetKSSTrackCountDirect(fullPath);
								if (count > 1) {
									for (let t = 0; t < count; t++) {
										const trackPath = `${fullPath}|track=${t}`;
										const trackLength = this.GetTrackLengthDirect(trackPath);
										const totalSampleCount = trackLength * currentSampleRate / 44100;
										const trackLengthSeconds = totalSampleCount > 0 ? Math.round(totalSampleCount / currentSampleRate) : 0;
										const trackLengthHumanReadeable = trackLengthSeconds > 0 ? new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5) : "";

										const a = document.createElement("a");
										a.className = "vgmplayTrack";
										const playableIndex = playableList.length;
										a.dataset.playableIndex = playableIndex;
										a.onclick = () => this.playFileFromFS(a, trackPath, gameIndex, playableIndex);

										const nameSpan = document.createElement("span");
										nameSpan.className = "track-name";
										const kssName = this.GetKSSTrackNameDirect ? this.GetKSSTrackNameDirect(fullPath, t) : "";
										nameSpan.textContent = kssName || `${fileName} - Track ${t + 1}`;
										a.appendChild(nameSpan);

										const lengthSpan = document.createElement("span");
										lengthSpan.className = "track-length";
										lengthSpan.textContent = trackLengthHumanReadeable;
										a.appendChild(lengthSpan);

										trackContainer.appendChild(a);
										playableList.push({ filepath: trackPath, linkElement: a, lengthSec: trackLengthSeconds, title: nameSpan.textContent });
									}
									continue;
								}
							}
						}

						const trackLength = this.GetTrackLengthDirect(fullPath);
						const totalSampleCount = trackLength * currentSampleRate / 44100;
						const trackLengthSeconds = totalSampleCount > 0 ? Math.round(totalSampleCount / currentSampleRate) : 0;
						const trackLengthHumanReadeable = trackLengthSeconds > 0 ? new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5) : "";

						const a = document.createElement("a");
						a.className = "vgmplayTrack";
						const playableIndex = playableList.length;
						a.dataset.playableIndex = playableIndex;
						a.onclick = () => this.playFileFromFS(a, fullPath, gameIndex, playableIndex);
						files[key].linkElement = a; // legacy reference

						const nameSpan = document.createElement("span");
						nameSpan.className = "track-name";
						nameSpan.textContent = fileName;
						a.appendChild(nameSpan);

						const lengthSpan = document.createElement("span");
						lengthSpan.className = "track-length";
						lengthSpan.textContent = trackLengthHumanReadeable;
						a.appendChild(lengthSpan);

						trackContainer.appendChild(a);
						playableList.push({ filepath: fullPath, linkElement: a, lengthSec: trackLengthSeconds, title: nameSpan.textContent });
					} catch (e) {
						console.error("[UI] Error getting track length for:", fullPath, e);
					}
				}
			}
			game.lastRenderedCount = files.length;
		}
	}

	_updateHighlight() {
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
			await this.checkEverythingReady();

			if (!this.isPlayable(file)) {
				return;
			}

			// On-demand GENMIDI loading for DOOM MUS files
			const lowerFile = file.toLowerCase().split('|track=')[0];
			const isMusFile = lowerFile.endsWith('.mus') || lowerFile.endsWith('.lmp');
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
								console.error("Error loading GENMIDI.lmp from FS:", e);
							}
						}
					}
				}
			}

			this._isLoadingFile = true;
			try {
				const ok = this.load(file);
				if (!ok) {
					this._addNoPlayableNotice(file);
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
				if (this.showMemoryStats) {
					this._memoryBaselineUsed = null;
					this._setMemoryStatsVisible(true);
				} else {
					this.getVGMTag();
				}

				let gameName = (this.VGMTag && this.VGMTag.length >= 8) ? (this.VGMTag[5] || this.VGMTag[7] || "Unknown Game") : "Unknown Game";
				let trackName = file.substring(file.lastIndexOf('/') + 1);
				if (href_object && href_object.dataset && href_object.dataset.trackTitle) {
					trackName = href_object.dataset.trackTitle;
				} else if (this.activeGame && this.activeGame.playableList && this.activeGame.playableList[this.currentFileKey]) {
					const pl = this.activeGame.playableList[this.currentFileKey];
					if (pl && pl.title) trackName = pl.title;
				}
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

	isPlayable(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.vgm') || p.endsWith('.vgz') ||
			p.endsWith('.psf') || p.endsWith('.minipsf') ||
			p.endsWith('.usf') || p.endsWith('.miniusf') ||
			p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
			p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
			p.endsWith('.mpk') || p.endsWith('.mbm') ||
			p.endsWith('.sap') || p.endsWith('.ay') ||
			p.endsWith('.mp3') || p.endsWith('.flac') || p.endsWith('.ogg') || p.endsWith('.wav') ||
			p.endsWith('.mus') || (p.endsWith('.lmp') && !p.endsWith('genmidi.lmp')) ||
			p.endsWith('.vigamup');
	}

	_isGmeFile(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.sap') || p.endsWith('.ay');
	}

	_isKssFile(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
			p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
			p.endsWith('.mpk') || p.endsWith('.mbm');
	}

	_isArchiveUrl(lower) {
		return lower.endsWith('.zip') || lower.endsWith('.7z') || lower.endsWith('.vigamup');
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

	async _doInit() {
		// Wait for Emscripten to be fully loaded and FS to be ready
		await new Promise(resolve => {
			const check = () => {
				if (typeof Module !== 'undefined' && Module.calledRun && typeof FS !== 'undefined') {
					resolve();
				} else {
					setTimeout(check, 100);
				}
			};
			check();
		});

		if (!this.isWebAudioInitialized) {
			window.AudioContext = window.AudioContext || window.webkitAudioContext;
			this.context = new AudioContext();
			this.destination = this.destination || this.context.destination;
			this.sampleRate = this.context.sampleRate;

			// Set up AnalyserNodes for dual channel spectrum display
			this.analyserLeft = this.context.createAnalyser();
			this.analyserLeft.fftSize = 256;
			this.analyserLeft.smoothingTimeConstant = 0.7;
			this.analyserDataLeft = new Uint8Array(this.analyserLeft.frequencyBinCount);

			this.analyserRight = this.context.createAnalyser();
			this.analyserRight.fftSize = 256;
			this.analyserRight.smoothingTimeConstant = 0.7;
			this.analyserDataRight = new Uint8Array(this.analyserRight.frequencyBinCount);

			this.splitter = this.context.createChannelSplitter(2);

			// Create Master Gain for fade out
			this.masterGain = this.context.createGain();
			this.masterGain.connect(this.destination);

			// Load AudioWorklet processor
			try {
				await this.context.audioWorklet.addModule(this.baseURL + 'vgmplay-audio-processor.js?v=' + Date.now());
				this.workletNode = new AudioWorkletNode(this.context, 'vgmplay-processor', {
					outputChannelCount: [2]
				});

				// Route: worklet -> masterGain -> destination
				// Route: masterGain -> splitter -> analysers (so visualizer fades too)
				// Create audio enhancement nodes
				this.bassBoost = this.context.createBiquadFilter();
				this.bassBoost.type = "lowshelf";
				this.bassBoost.frequency.value = 200;
				this.bassBoost.gain.value = this.bassBoostEnabled ? 12 : 0;

				this.compressor = this.context.createDynamicsCompressor();
				this.compressor.threshold.setValueAtTime(-24, this.context.currentTime);
				this.compressor.knee.setValueAtTime(30, this.context.currentTime);
				this.compressor.ratio.setValueAtTime(12, this.context.currentTime);
				this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
				this.compressor.release.setValueAtTime(0.25, this.context.currentTime);

				this.reverb = this.context.createConvolver();
				this._generateReverbImpulse();
				this.reverbGain = this.context.createGain();
				this.reverbGain.gain.value = this.reverbEnabled ? 0.35 : 0;

				// Route: worklet -> bassBoost -> compressor -> masterGain -> destination
				this.workletNode.connect(this.bassBoost);
				this.bassBoost.connect(this.compressor);
				this.compressor.connect(this.masterGain);

				// Route: worklet -> reverb -> reverbGain -> masterGain
				this.workletNode.connect(this.reverb);
				this.reverb.connect(this.reverbGain);
				this.reverbGain.connect(this.masterGain);

				this.masterGain.connect(this.splitter);
				this.splitter.connect(this.analyserLeft, 0);
				this.splitter.connect(this.analyserRight, 1);

				// Handle data requests from the worklet
				this.workletNode.port.onmessage = (e) => {
					if (e.data.type === 'need-data') {
						this._pumpBuffers();
					}
				};
			} catch (err) {
				console.error('AudioWorklet failed to load:', err);
				return false;
			}

			this.isWebAudioInitialized = true;
			await this._ensureAudioMotion();
			this._updateStandaloneRightPanel();
		}
		if (!this.functionsWrapped) {
			this.FillBuffer = Module.cwrap('FillBuffer2', 'void', ['number', 'number', 'number']);
			this.OpenVGMFile = Module.cwrap('OpenVGMFile', 'number', ['string']);
			this.LoadGENMIDI = Module.cwrap('LoadGENMIDI', 'void', ['number', 'number']);
			this.MUSPlaying = Module.cwrap('MUSPlaying', 'number');
			this.CloseVGMFile = Module.cwrap('CloseVGMFile');
			this.PlayVGM = Module.cwrap('PlayVGM');
			this.StopVGM = Module.cwrap('StopVGM');
			this.VGMEnded = Module.cwrap('VGMEnded');
			this.GetTrackLength = Module.cwrap('GetTrackLength');
			this.GetTrackLengthDirect = Module.cwrap('GetTrackLengthDirect', 'number', ['string']);
			this.GetGMETrackCountDirect = Module.cwrap('GetGMETrackCountDirect', 'number', ['string']);
			this.GetKSSTrackCountDirect = Module.cwrap('GetKSSTrackCountDirect', 'number', ['string']);
			this.GetKSSTrackMinDirect = Module.cwrap('GetKSSTrackMinDirect', 'number', ['string']);
			this.GetKSSTrackMaxDirect = Module.cwrap('GetKSSTrackMaxDirect', 'number', ['string']);
			this.GetGMETrackNameDirect = Module.cwrap('GetGMETrackNameDirect', 'string', ['string', 'number']);
			this.GetKSSTrackNameDirect = Module.cwrap('GetKSSTrackNameDirect', 'string', ['string', 'number']);
			this.GetVGMTagDirect = Module.cwrap('GetVGMTagDirect', 'string', ['string', 'number']);
			this.GetLoopPoint = Module.cwrap('GetLoopPoint');
			this.SeekVGM = Module.cwrap('Seek', 'number', ['number', 'number']);
			this.SetSampleRate = Module.cwrap('SetSampleRate', 'number', ['number']);
			this.SetLoopCount = Module.cwrap('SetLoopCount', 'number', ['number']);
			this.SamplePlayback2VGM = Module.cwrap('SamplePlayback2VGM', 'number', ['number']);
			this.ShowTitle = Module.cwrap('ShowTitle', 'string');
			this.GetChipInfoString = Module.cwrap('GetChipInfoString', 'string');
			this.GetDeviceCount = Module.cwrap('GetDeviceCount', 'number');
			this.GetDeviceName = Module.cwrap('GetDeviceName', 'string', ['number']);
			this.GetDeviceVolume = Module.cwrap('GetDeviceVolume', 'number', ['number']);
			this.SetDeviceVolume = Module.cwrap('SetDeviceVolume', 'void', ['number', 'number']);
			this.PrefillPSF = Module.cwrap('PrefillPSF', 'void', ['number', 'number']);
			this.FillBufferKSSPerCh = Module.cwrap('FillBufferKSSPerCh', 'void', ['number', 'number', 'number', 'number']);
			this.GetKSSPerChSize = Module.cwrap('GetKSSPerChSize', 'number');
			this.GetKSSDeviceMask = Module.cwrap('GetKSSDeviceMask', 'number');
			this.SetKSSChannelMask = Module.cwrap('SetKSSChannelMask', 'void', ['number', 'number']);

			this.dataPtrs = [];
			this.dataPtrs[0] = Module._malloc(16384 * 2);
			this.dataPtrs[1] = Module._malloc(16384 * 2);

			this.results = [];

			this.SetSampleRate(this.sampleRate);

			this.functionsWrapped = true;
		}


		return true;
	}

	_startPsfPrefill() {
		if (this._psfPrefillTimer) return;
		this._psfPrefillTimer = setInterval(() => {
			if (!this.isVGMPlaying || this.isPlaybackPaused) return;
			if (this.PrefillPSF) {
				this.PrefillPSF(16384, 4);
			}
		}, 15);
	}

	_stopPsfPrefill() {
		if (this._psfPrefillTimer) {
			clearInterval(this._psfPrefillTimer);
			this._psfPrefillTimer = null;
		}
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
			console.error('[AudioMotion] init failed', e);
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
					console.warn('[AudioMotion] failed to load', e);
				});
		}
		await this._audioMotionLoading;
	}

	_updateStandaloneRightPanel() {
		if (!this.standalone || !this.standaloneAnalyzerEl) return;
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


	_buildKssChannelDefs(mask) {
		const defs = [];
		const OFF_PSG = 0;
		const OFF_SCC = 3;
		const OFF_OPLL = 8;
		const OFF_OPL = 23;

		if (mask & 1) {
			for (let i = 0; i < 3; i++) {
				defs.push({ label: `PSG #${i + 1}`, offset: OFF_PSG + i, device: 0, maskBit: i, chip: 'psg' });
			}
		}
		if (mask & 2) {
			for (let i = 0; i < 5; i++) {
				defs.push({ label: `SCC #${i + 1}`, offset: OFF_SCC + i, device: 1, maskBit: i, chip: 'scc' });
			}
		}
		if (mask & 4) {
			for (let i = 0; i < 9; i++) {
				defs.push({ label: `OPLL #${i + 1}`, offset: OFF_OPLL + i, device: 2, maskBit: i, chip: 'opll' });
			}
			defs.push({ label: 'OPLL BD', offset: OFF_OPLL + 9, device: 2, maskBit: 13, chip: 'opll' });
			defs.push({ label: 'OPLL HH', offset: OFF_OPLL + 10, device: 2, maskBit: 9, chip: 'opll' });
			defs.push({ label: 'OPLL SD', offset: OFF_OPLL + 11, device: 2, maskBit: 12, chip: 'opll' });
			defs.push({ label: 'OPLL TOM', offset: OFF_OPLL + 12, device: 2, maskBit: 11, chip: 'opll' });
			defs.push({ label: 'OPLL CYM', offset: OFF_OPLL + 13, device: 2, maskBit: 10, chip: 'opll' });
		}
		if (mask & 8) {
			for (let i = 0; i < 9; i++) {
				defs.push({ label: `OPL #${i + 1}`, offset: OFF_OPL + i, device: 3, maskBit: i, chip: 'opl' });
			}
			defs.push({ label: 'OPL BD', offset: OFF_OPL + 9, device: 3, maskBit: 13, chip: 'opl' });
			defs.push({ label: 'OPL HH', offset: OFF_OPL + 10, device: 3, maskBit: 9, chip: 'opl' });
			defs.push({ label: 'OPL SD', offset: OFF_OPL + 11, device: 3, maskBit: 12, chip: 'opl' });
			defs.push({ label: 'OPL TOM', offset: OFF_OPL + 12, device: 3, maskBit: 11, chip: 'opl' });
			defs.push({ label: 'OPL CYM', offset: OFF_OPL + 13, device: 3, maskBit: 10, chip: 'opl' });
			defs.push({ label: 'OPL ADPCM', offset: OFF_OPL + 14, device: 3, maskBit: 14, chip: 'opl' });
		}
		if (mask & 16) {
			defs.push({ label: 'SNG #1', offset: 38, device: 0, maskBit: 0, chip: 'sng' });
			defs.push({ label: 'SNG #2', offset: 39, device: 0, maskBit: 1, chip: 'sng' });
			defs.push({ label: 'SNG #3', offset: 40, device: 0, maskBit: 2, chip: 'sng' });
			defs.push({ label: 'SNG Noise', offset: 41, device: 0, maskBit: 3, chip: 'sng' });
		}
		return defs;
	}

	_resetKssDeviceScan() {
		this.kssDeviceBaseMask = this.GetKSSDeviceMask ? this.GetKSSDeviceMask() : 0;
		this.kssDeviceDetectedMask = 0;
		this._kssDeviceScanFrames = 0;
		this._kssDeviceScanDone = false;
		this._kssDeviceScanDefs = this._buildKssChannelDefs(this.kssDeviceBaseMask);
		this._kssDeviceScanPeaks = {
			psg: 0,
			scc: 0,
			opll: 0,
			opl: 0,
			sng: 0,
			dac: 0
		};
	}

	_scanKssDevicesIfNeeded(perCh, stride, sampleCount) {
		if (this._kssDeviceScanDone || !perCh || !this._kssDeviceScanDefs) return;
		const defs = this._kssDeviceScanDefs;
		const peaks = this._kssDeviceScanPeaks;
		const step = 4;
		const start = Math.max(0, sampleCount - 512);

		defs.forEach((def) => {
			let peak = 0;
			for (let n = start; n < sampleCount; n += step) {
				const v = Math.abs(perCh[n * stride + def.offset] || 0);
				if (v > peak) peak = v;
			}
			const chip = def.chip || 'psg';
			if (peak > peaks[chip]) peaks[chip] = peak;
		});

		this._kssDeviceScanFrames += 1;
		if (this._kssDeviceScanFrames < 6) return;

		const chipBits = { psg: 1, scc: 2, opll: 4, opl: 8, sng: 16, dac: 32 };
		let mask = 0;
		const threshold = 250;
		Object.keys(chipBits).forEach((chip) => {
			if (peaks[chip] > threshold) mask |= chipBits[chip];
		});
		if (!mask) mask = this.kssDeviceBaseMask || 0;
		this.kssDeviceDetectedMask = mask;
		this.kssDeviceActiveMask = mask;
		this._kssDeviceScanDone = true;
		this._initKssChannelAnalyzer(true);
		this._initKssOverlay(true);
	}

	_initKssChannelAnalyzer(forceRebuild = false) {
		if (this.rightPanelMode !== 'prismPerChannel') return;
		if (!this.standaloneAnalyzerEl || !this.GetKSSDeviceMask) return;
		const baseMask = this.kssDeviceBaseMask || (this.GetKSSDeviceMask ? this.GetKSSDeviceMask() : 0);
		const mask = this.kssDeviceDetectedMask ? this.kssDeviceDetectedMask : baseMask;
		const defs = this._buildKssChannelDefs(mask);
		const needsRebuild = forceRebuild || !this.kssAnalyzerEl || this.kssChannelDefs.length !== defs.length || this.kssDeviceActiveMask !== mask;

		if (needsRebuild) {
			this.kssAnalyzerEl = document.createElement('div');
			this.kssAnalyzerEl.className = 'vgmplayKssAnalyzer';
			this.kssAnalyzerEl.innerHTML = '';
			this.kssChannelDefs = defs;
			this.kssDeviceActiveMask = mask;
			this.kssChannelStates = defs.map(() => ({ mute: false, solo: false }));
			this.kssChannelRows = [];
			this.standaloneAnalyzerEl.innerHTML = '';
			this.standaloneAnalyzerEl.appendChild(this.kssAnalyzerEl);
			this.kssDeviceActivity = {};

			const chipGroups = {};
			const chipOrder = [];
			const addGroup = (key, title, cols) => {
				if (chipGroups[key]) return;
				const group = document.createElement('div');
				group.className = 'vgmplayKssChipGroup';
				group.dataset.cols = String(cols);
				const header = document.createElement('div');
				header.className = 'vgmplayKssChipHeader';
				header.textContent = title;
				const grid = document.createElement('div');
				grid.className = 'vgmplayKssChipGrid';
				group.appendChild(header);
				group.appendChild(grid);
				chipGroups[key] = { group, grid, cols };
				chipOrder.push(group);
			};

			// Create chip groups based on detected devices
			if (mask & 1) addGroup('psg', 'PSG', 3);
			if (mask & 2) addGroup('scc', 'SCC', 5);
			if (mask & 4) addGroup('opll', 'OPLL', 5);
			if (mask & 8) addGroup('opl', 'OPL', 5);
			if (mask & 16) addGroup('sng', 'SNG', 4);
			if (mask & 32) addGroup('dac', 'DAC', 2);

			chipOrder.forEach((group) => this.kssAnalyzerEl.appendChild(group));

			defs.forEach((def, idx) => {
				const tile = document.createElement('div');
				tile.className = 'vgmplayKssChannelTile';

				const canvas = document.createElement('canvas');
				canvas.className = 'vgmplayKssChannelCanvas';
				canvas.width = 240;
				canvas.height = 40;

				const label = document.createElement('div');
				label.className = 'vgmplayKssChannelLabel';
				const name = document.createElement('span');
				name.className = 'vgmplayKssChannelName';
				name.textContent = def.label;

				const muteBtn = document.createElement('button');
				muteBtn.className = 'vgmplayKssChannelBtn';
				muteBtn.textContent = 'M';
				muteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this._toggleKssChannelMute(idx);
				});

				const soloBtn = document.createElement('button');
				soloBtn.className = 'vgmplayKssChannelBtn';
				soloBtn.textContent = 'S';
				soloBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this._toggleKssChannelSolo(idx);
				});

				label.appendChild(name);
				label.appendChild(muteBtn);
				label.appendChild(soloBtn);

				tile.appendChild(canvas);
				tile.appendChild(label);

				const groupKey = def.chip || null;

				if (groupKey && chipGroups[groupKey]) {
					chipGroups[groupKey].grid.appendChild(tile);
				} else {
					this.kssAnalyzerEl.appendChild(tile);
				}

				this.kssChannelRows.push({
					tile,
					canvas,
					ctx: canvas.getContext('2d'),
					muteBtn,
					soloBtn,
					spectrum: new Float32Array(64),
					timeDomain: new Float32Array(256)
				});
			});
		}

		this.kssAnalyzerEl.style.display = 'flex';
		this.kssAnalyzerActive = true;
		this.standaloneAnalyzerEl.classList.add('kssActive');
		this._applyKssChannelMasks();
		this._updateKssChannelButtons();
	}

	_initKssOverlay(forceRebuild = false) {
		if (!this.standalone || !this.standaloneAnalyzerEl) return;
		if (!this.isKSSActive || !this.GetKSSDeviceMask) {
			if (this.kssOverlayEl) this.kssOverlayEl.style.display = 'none';
			return;
		}

		const baseMask = this.kssDeviceBaseMask || (this.GetKSSDeviceMask ? this.GetKSSDeviceMask() : 0);
		const mask = this.kssDeviceDetectedMask ? this.kssDeviceDetectedMask : baseMask;
		const defs = this._buildKssChannelDefs(mask);
		const needsRebuild = forceRebuild ||
			!this.kssOverlayEl ||
			!this.kssOverlayEl.isConnected ||
			this.kssOverlayDefs.length !== defs.length ||
			this.kssDeviceActiveMask !== mask;

		if (needsRebuild) {
			const prevStates = new Map();
			this.kssChannelDefs.forEach((def, idx) => {
				prevStates.set(`${def.device}:${def.offset}`, this.kssChannelStates[idx]);
			});

			this.kssOverlayDefs = defs;
			this.kssChannelDefs = defs;
			this.kssDeviceActiveMask = mask;
			this.kssChannelStates = defs.map((def) => {
				const key = `${def.device}:${def.offset}`;
				const prev = prevStates.get(key);
				return prev ? { mute: !!prev.mute, solo: !!prev.solo } : { mute: false, solo: false };
			});

			if (!this.kssOverlayEl) {
				this.kssOverlayEl = document.createElement('div');
				this.kssOverlayEl.className = 'vgmplayKssOverlay';
				this.kssOverlayEl.style.position = 'absolute';
				this.kssOverlayEl.style.top = '8px';
				this.kssOverlayEl.style.left = '40px';
				this.kssOverlayEl.style.zIndex = '6';
				this.kssOverlayEl.style.pointerEvents = 'auto';
			}
			if (!this.kssOverlayEl.isConnected) {
				this.standaloneAnalyzerEl.style.position = 'relative';
				this.standaloneAnalyzerEl.appendChild(this.kssOverlayEl);
			}

			this.kssOverlayEl.innerHTML = '';
			this.kssOverlayRows = [];

			defs.forEach((def, idx) => {
				const row = document.createElement('div');
				row.className = 'vgmplayKssOverlayRow';

				const label = document.createElement('span');
				label.className = 'vgmplayKssOverlayLabel';
				label.textContent = def.label;

				const muteBtn = document.createElement('button');
				muteBtn.className = 'vgmplayKssChannelBtn';
				muteBtn.textContent = 'M';
				muteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this._toggleKssChannelMute(idx);
				});

				const soloBtn = document.createElement('button');
				soloBtn.className = 'vgmplayKssChannelBtn';
				soloBtn.textContent = 'S';
				soloBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this._toggleKssChannelSolo(idx);
				});

				row.appendChild(label);
				row.appendChild(muteBtn);
				row.appendChild(soloBtn);

				this.kssOverlayEl.appendChild(row);
				this.kssOverlayRows.push({ muteBtn, soloBtn });
			});
		}

		this.kssOverlayEl.style.display = 'block';
		this._updateKssChannelButtons();
	}

	_toggleKssChannelMute(idx) {
		const state = this.kssChannelStates[idx];
		if (!state) return;
		state.mute = !state.mute;
		if (state.mute) state.solo = false;
		this._applyKssChannelMasks();
		this._updateKssChannelButtons();
	}

	_toggleKssChannelSolo(idx) {
		const state = this.kssChannelStates[idx];
		if (!state) return;
		state.solo = !state.solo;
		if (state.solo) state.mute = false;
		this._applyKssChannelMasks();
		this._updateKssChannelButtons();
	}

	_updateKssChannelButtons() {
		const updateRows = (rows) => {
			rows.forEach((row, idx) => {
				const state = this.kssChannelStates[idx];
				if (!state) return;
				row.muteBtn.classList.toggle('active', !!state.mute);
				row.soloBtn.classList.toggle('active', !!state.solo);
			});
		};
		updateRows(this.kssChannelRows);
		updateRows(this.kssOverlayRows);
	}

	_applyKssChannelMasks() {
		if (!this.isKSSActive || !this.SetKSSChannelMask) return;
		const soloActive = this.kssChannelStates.some((s) => s.solo);
		const deviceMasks = { 0: 0, 1: 0, 2: 0, 3: 0 };

		this.kssChannelDefs.forEach((def, idx) => {
			const state = this.kssChannelStates[idx];
			const shouldMute = state.mute || (soloActive && !state.solo);
			if (shouldMute && def.maskBit != null) {
				deviceMasks[def.device] |= (1 << def.maskBit);
			}
		});

		this.SetKSSChannelMask(0, deviceMasks[0]);
		this.SetKSSChannelMask(1, deviceMasks[1]);
		this.SetKSSChannelMask(2, deviceMasks[2]);
		this.SetKSSChannelMask(3, deviceMasks[3]);
	}

	_ensureKssFftTables(size, bins) {
		if (this._kssFft && this._kssFft.size === size && this._kssFft.bins === bins) return;
		const cos = [];
		const sin = [];
		const window = new Float32Array(size);
		for (let n = 0; n < size; n++) {
			window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1));
		}
		for (let k = 0; k < bins; k++) {
			const cosRow = new Float32Array(size);
			const sinRow = new Float32Array(size);
			for (let n = 0; n < size; n++) {
				const angle = (2 * Math.PI * k * n) / size;
				cosRow[n] = Math.cos(angle);
				sinRow[n] = Math.sin(angle);
			}
			cos.push(cosRow);
			sin.push(sinRow);
		}
		this._kssFft = { size, bins, cos, sin, window };
	}

	_drawKssAnalyzer() {
		if (!this.kssAnalyzerActive || !this._kssPerChLatest || !this.kssChannelRows.length) return;
		const fftSize = 256;
		const bins = 64;
		this._ensureKssFftTables(fftSize, bins);
		const { cos, sin, window } = this._kssFft;
		const perCh = this._kssPerChLatest;
		const stride = this._kssPerChStride;
		const sampleCount = this._kssPerChSamples;
		const start = Math.max(0, sampleCount - fftSize);

		const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
		this.kssChannelRows.forEach((row, idx) => {
			const def = this.kssChannelDefs[idx];
			const ctx = row.ctx;
			const canvas = row.canvas;
			const width = Math.floor(canvas.clientWidth || canvas.width);
			const height = Math.floor(canvas.clientHeight || canvas.height);
			if (canvas.width !== width) canvas.width = width;
			if (canvas.height !== height) canvas.height = height;

			let peak = 0;
			for (let n = 0; n < fftSize; n++) {
				const sampleIdx = (start + n) * stride + def.offset;
				const v = (perCh[sampleIdx] || 0) / 32768.0;
				row.timeDomain[n] = v;
				const av = Math.abs(v);
				if (av > peak) peak = av;
			}

			for (let k = 0; k < bins; k++) {
				let re = 0;
				let im = 0;
				const cosRow = cos[k];
				const sinRow = sin[k];
				for (let n = 0; n < fftSize; n++) {
					const v = row.timeDomain[n] * window[n];
					re += v * cosRow[n];
					im -= v * sinRow[n];
				}
				const mag = Math.sqrt(re * re + im * im) / fftSize;
				const val = Math.min(1, mag * 12);
				// Exponential smoothing to reduce "jumping"
				row.spectrum[k] = (row.spectrum[k] * 0.4) + (val * 0.6);
			}

			ctx.fillStyle = '#000000';
			ctx.fillRect(0, 0, width, height);

			const gradient = ctx.createLinearGradient(0, height, 0, 0);
			gradient.addColorStop(0, '#0b1b2a');
			gradient.addColorStop(0.2, '#0bc');
			gradient.addColorStop(0.4, '#2cb');
			gradient.addColorStop(0.6, '#9d5');
			gradient.addColorStop(0.8, '#ed0');
			gradient.addColorStop(1, '#e94');
			ctx.strokeStyle = gradient;
			ctx.lineWidth = 1.5;

			const binCount = bins;
			const mid = width / 2;
			ctx.beginPath();
			// Draw right expansion
			for (let k = 0; k < binCount; k++) {
				const x = mid + (k / (binCount - 1)) * mid;
				const v = Math.min(row.spectrum[k] * 2.8, 1);
				const y = height - v * height;
				if (k === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			// Draw left expansion (mirrored)
			for (let k = 0; k < binCount; k++) {
				const x = mid - (k / (binCount - 1)) * mid;
				const v = Math.min(row.spectrum[k] * 2.8, 1);
				const y = height - v * height;
				ctx.lineTo(x, y);
			}
			ctx.stroke();
		});
	}

	generateBuffer() {
		const N = 2048; // Even smaller batch size to reduce main-thread blocking
		if (this.PrefillPSF) {
			this.PrefillPSF(4096, 1);
		}
		// Always create fresh views from Module.HEAPU8.buffer in case it was reallocated (detached)
		if (this.isKSSActive && this.FillBufferKSSPerCh && this.GetKSSPerChSize) {
			const perChSize = this.GetKSSPerChSize();
			const stride = Math.floor(perChSize / 2);
			if (!this.kssPerChPtr || this._kssPerChSamples !== N || this._kssPerChStride !== stride) {
				if (this.kssPerChPtr) Module._free(this.kssPerChPtr);
				this.kssPerChPtr = Module._malloc(N * perChSize);
				this._kssPerChSamples = N;
				this._kssPerChStride = stride;
			}
			this.FillBufferKSSPerCh(this.dataPtrs[0], this.dataPtrs[1], this.kssPerChPtr, N);
			const perChHeap = new Int16Array(Module.HEAPU8.buffer, this.kssPerChPtr, N * this._kssPerChStride);
			this._kssPerChLatest = new Int16Array(perChHeap);
			this._scanKssDevicesIfNeeded(this._kssPerChLatest, this._kssPerChStride, N);
		} else {
			this.FillBuffer(this.dataPtrs[0], this.dataPtrs[1], N);
			this._kssPerChLatest = null;
		}

		const leftHeap = new Float32Array(Module.HEAPU8.buffer, this.dataPtrs[0], N);
		const rightHeap = new Float32Array(Module.HEAPU8.buffer, this.dataPtrs[1], N);

		// Clone the data to buffers that can be transferred to the worklet
		const left = new Float32Array(leftHeap);
		const right = new Float32Array(rightHeap);

		this.samplesGenerated += N;
		return { left, right };
	}

	_pumpBuffers() {
		if (this._isLoadingFile || !this.isVGMPlaying || this.isPlaybackPaused) return;

		// Check for end of track (crucial for background advancement)
		this._checkTrackEnd();

		// Check if VGM ended (for formats without length info)
		if (this.VGMEnded()) {
			if (!this.emulatorFinished) {
				this.emulatorFinished = true;
				const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
				if (this._lastSeekWasMUS && (nowMs - this._lastSeekAt) < 2000) {
					this.stop();
					return;
				}
				if (this.loopMode === 1 && this.currentTrackSupportsLoop) {
					const list = this.activeGame && this.activeGame.playableList ? this.activeGame.playableList : null;
					const entry = list && list[this.currentFileKey];
					if (this.currentFileKey && this._loopBaseSamplesByTrack && !this._loopBaseSamplesByTrack.has(this.currentFileKey)) {
						const baseLen = this.samplesGenerated || this.totalSampleCount || 0;
						if (baseLen > 0) this._loopBaseSamplesByTrack.set(this.currentFileKey, baseLen);
					}
					if (entry && entry.filepath && !this._loopRestarting) {
						this._loopRestarting = true;
						setTimeout(async () => {
							await this.playFileFromFS(false, entry.filepath, this.games.indexOf(this.activeGame) + 1, this.currentFileKey);
							this._loopRestarting = false;
						}, 0);
					}
					return;
				}
				this.stop();
				setTimeout(() => {
					if (this.loopMode === 1 && !this.currentTrackSupportsLoop) {
						this.loopMode = 0;
						this._applyLoopMode();
						this.changeTrack("next");
						return;
					}
					if (this.loopMode === 2) this._changeTrackInGame('next');
					else if (this.isRandomEnabled) this.playRandom();
					else this.changeTrack("next");
				}, 100);
			}
			return;
		}

		// Generate and send a few buffers
		for (let i = 0; i < 2; i++) {
			const buf = this.generateBuffer();
			this.workletNode.port.postMessage({
				type: 'buffer',
				left: buf.left,
				right: buf.right
			}, [buf.left.buffer, buf.right.buffer]);
		}
	}

	_withLoadLock(fn) {
		this._loadLock = this._loadLock.then(fn, fn);
		return this._loadLock;
	}

	play() {
		if (this.buttonTogglePlayback) {
			this.buttonTogglePlayback.innerHTML = "||";
		}
		if (window.Android) window.Android.updatePlaybackState(true);
		this.samplesGenerated = 0;
		this.isPlaybackPaused = false;

		// Reset tracking if not resuming
		if (!this.isVGMPlaying) {
			this.startSample = 0;
			this.visualSamplePosition = 0;
			this.emulatorFinished = false;
		} else {
			// Resuming: set start sample to where we left off
			this.startSample = this.visualSamplePosition;
		}

		if (this.context) {
			this.playbackStartTime = this.context.currentTime;
		}

		if (!this.isVGMPlaying) {
			this.PlayVGM();
			this.isVGMPlaying = true;
		}
		this._startPsfPrefill();
		if (this.isMobile) {
			this._resetMobileIdleTimer();
		}

		// Reconnect audio graph (stop() disconnects it)
		try {
			this.workletNode.connect(this.bassBoost);
			this.bassBoost.connect(this.compressor);
			this.compressor.connect(this.masterGain);

			this.workletNode.connect(this.reverb);
			this.reverb.connect(this.reverbGain);
			this.reverbGain.connect(this.masterGain);

			this.masterGain.connect(this.splitter);
			this.splitter.connect(this.analyserLeft, 0);
			this.splitter.connect(this.analyserRight, 1);
			this.masterGain.connect(this.destination);

			// Reset fade state carefully with a short fade-in to avoid clicks
			const now = this.context.currentTime;
			this.isFadingOut = false;
			this.masterGain.gain.cancelScheduledValues(now);
			this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
			this.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.02);
		} catch { }

		// Resume audio context if suspended (autoplay policy)
		if (this.context.state === 'suspended') {
			this.context.resume();
		}

		// Tell the worklet to start outputting
		this.workletNode.port.postMessage({ type: 'start' });

		if (!this.generatingAudio) {
			// Pump initial buffers
			this._pumpBuffers();
			this.generatingAudio = true;
		}

		// Start spectrum analyser animation
		if (!this.useAsLibrary) {
			this._startSpectrumAnimation();
		}
	}

	pause() {
		this.isPlaybackPaused = true;
		if (window.Android) window.Android.updatePlaybackState(false);
		if (this.buttonTogglePlayback) {
			this.buttonTogglePlayback.innerHTML = "&#9654;";
		}
		if (this.isMobile) {
			this._setMobileView('ui');
		}

		// Update visual position one last time to save state
		if (this.context) {
			const elapsed = this.context.currentTime - this.playbackStartTime;
			this.visualSamplePosition = this.startSample + (elapsed * this.sampleRate);
		}

		// Tell worklet to stop outputting (keeps buffers)
		this.workletNode.port.postMessage({ type: 'pause' });

		if (this.context && this.context.state === 'running') {
			this.context.suspend();
		}

		if (!this.useAsLibrary) {
			this._stopSpectrumAnimation();
		}
		this._stopPsfPrefill();
	}

	stop() {
		if (this.buttonTogglePlayback) {
			this.buttonTogglePlayback.innerHTML = "&#9654;";
		}
		if (window.Android) window.Android.updatePlaybackState(false);
		if (this.isMobile) {
			this._setMobileView('ui');
		}

		if (this.workletNode) {
			this.workletNode.port.postMessage({ type: 'stop' });
		}
		this._stopPsfPrefill();

		// Don't close AudioContext — just disconnect and reset state
		// This avoids expensive re-initialization of worklet module
		try {
			if (this.workletNode) {
				this.workletNode.disconnect();
				this.analyserLeft.disconnect();
				this.analyserRight.disconnect();
				this.splitter.disconnect();
				// Ideally disconnect masterGain too, but it's fine.
			}
		} catch { }

		this.generatingAudio = false;

		this.StopVGM();
		if (this.CloseVGMFile) {
			this.CloseVGMFile();
		}
		this.isVGMPlaying = false;
		this.isVGMLoaded = false;
		this.isKSSActive = false;
		this.kssDeviceBaseMask = 0;
		this.kssDeviceDetectedMask = 0;
		this._kssDeviceScanDefs = null;
		this._kssDeviceScanPeaks = null;
		this._kssDeviceScanFrames = 0;
		this._kssDeviceScanDone = false;
		this._updateStandaloneRightPanel();

		this.isPlaybackPaused = true;
		this.visualSamplePosition = 0;
		this.startSample = 0;
		this.emulatorFinished = false;

		this.isFadingOut = false;
		if (this.masterGain) {
			try {
				// Avoid immediate jump to 1.0 which causes clicks
				const now = this.context.currentTime;
				this.masterGain.gain.cancelScheduledValues(now);
				this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
				this.masterGain.gain.linearRampToValueAtTime(0, now + 0.01);
				// We don't reset to 1.0 here; play() will handle the fade-in.
			} catch (e) { }
		}

		this._stopSpectrumAnimation();
		this._clearSpectrum();
		this._resetProgressBar();
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
			console.error("[VGM] Failed to open file:", fileName);
		}
		this.isVGMLoaded = ok;
		this.isKSSActive = ok && this._isKssFile(fileName);
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
		this._updateMemoryDisplay();
		return ok;
	}

	// ---- Spectrum Analyser ----

	_startSpectrumAnimation() {
		if (this._spectrumAnimId) return;
		const draw = () => {
			this._spectrumAnimId = requestAnimationFrame(draw);
			this._drawSpectrum();
			this._updateProgressBar();
		};
		draw();
	}

	_stopSpectrumAnimation() {
		if (this._spectrumAnimId) {
			cancelAnimationFrame(this._spectrumAnimId);
			this._spectrumAnimId = null;
		}
	}

	_clearSpectrum() {
		if (!this.spectrumCtx) return;
		const ctx = this.spectrumCtx;
		const w = this.spectrumCanvas.width;
		const h = this.spectrumCanvas.height;
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, w, h);
	}

	_drawSpectrum() {
		if (!this.analyserLeft || !this.analyserRight || !this.spectrumCtx) return;
		if (this.kssAnalyzerActive) {
			this._drawKssAnalyzer();
		}

		const ctx = this.spectrumCtx;
		const canvas = this.spectrumCanvas;
		const w = canvas.width;
		const h = canvas.height;

		this.analyserLeft.getByteFrequencyData(this.analyserDataLeft);
		this.analyserRight.getByteFrequencyData(this.analyserDataRight);

		// Optimized background: single fill
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, w, h);

		// Cached grid and divider (simple lines are fast)
		ctx.lineWidth = 1;

		// Horizontal grid lines
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
		ctx.beginPath();
		for (let y = 0; y < h; y += 8) {
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
		}
		ctx.stroke();

		// Vertical divider
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
		ctx.beginPath();
		ctx.moveTo(w / 2, 0);
		ctx.lineTo(w / 2, h);
		ctx.stroke();

		const binCount = this.analyserLeft.frequencyBinCount; // 128
		const barCount = 16; // bars per channel
		const binsPerBar = Math.floor(binCount / barCount);
		const totalWidthPerChannel = w / 2;
		const barWidth = Math.floor(totalWidthPerChannel / barCount) - 1;
		const gap = 1;

		// Draw Channels (left-to-right for both channels)
		const drawChannel = (data, xOffset) => {
			for (let i = 0; i < barCount; i++) {
				let sum = 0;
				const startBin = i * binsPerBar;
				for (let j = 0; j < binsPerBar; j++) {
					sum += data[startBin + j];
				}
				const avg = sum / binsPerBar;
				const barHeight = (avg / 255) * h;

				const x = xOffset + i * (barWidth + gap);
				const y = h - barHeight;

				const gradient = ctx.createLinearGradient(x, h, x, y);
				gradient.addColorStop(0, '#004400');
				gradient.addColorStop(0.5, '#00cc00');
				gradient.addColorStop(1, '#00ff66');
				ctx.fillStyle = gradient;
				ctx.fillRect(x, y, barWidth, barHeight);

				if (barHeight > 2) {
					ctx.fillStyle = '#aaffaa';
					ctx.fillRect(x, y, barWidth, 2);
				}
			}
		};

		drawChannel(this.analyserDataLeft, 0);
		drawChannel(this.analyserDataRight, w / 2);

		// Scanline overlay effect - optimized: fewer rectangles
		ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
		for (let y = 0; y < h; y += 4) {
			ctx.fillRect(0, y, w, 2);
		}
	}
}
// ---- Progress bar & seek ----
VGMPlay_js.prototype._updateProgressBar = function () {
	if (!this.progressFill || !this.totalSampleCount) return;

	this._checkTrackEnd();

	const currentSample = this.visualSamplePosition;
	const progress = Math.min(currentSample / this.totalSampleCount, 1);
	this.progressFill.style.width = (progress * 100) + '%';

	if (this.vgmplayTime) {
		const elapsedSec = Math.floor(currentSample / this.sampleRate);
		const totalSec = Math.floor(this.totalSampleCount / this.sampleRate);
		this.vgmplayTime.innerText = this._formatTime(elapsedSec) + '/' + this._formatTime(totalSec);
	}
};

VGMPlay_js.prototype._checkTrackEnd = function () {
	if (!this.isVGMPlaying || !this.totalSampleCount) return;

	let currentSample;
	if (this.isPlaybackPaused) {
		currentSample = this.visualSamplePosition;
	} else if (this.context) {
		const elapsed = this.context.currentTime - this.playbackStartTime;
		currentSample = this.startSample + (elapsed * this.sampleRate);
	} else {
		currentSample = 0;
	}

	// Clamp to legitimate range
	if (currentSample < 0) currentSample = 0;
	if (currentSample > this.totalSampleCount) currentSample = this.totalSampleCount;

	this.visualSamplePosition = currentSample;

	// If loop mode is track and the track supports looping, keep playing
	if (this.loopMode === 1 && this.currentTrackSupportsLoop) {
		// We can optionally reset visual progress or just let it pin to 100%
		return;
	}

	// Fade out logic
	const FADE_DURATION = 2.0; // seconds
	const fadeStartSample = this.totalSampleCount - (FADE_DURATION * this.sampleRate);

	if (!this.isPlaybackPaused && !this.isFadingOut && currentSample >= fadeStartSample && this.totalSampleCount > (FADE_DURATION * this.sampleRate)) {
		this.isFadingOut = true;
		const now = this.context.currentTime;
		const remaining = (this.totalSampleCount - currentSample) / this.sampleRate;
		const duration = remaining > 0 ? remaining : 0.1;

		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setValueAtTime(1.0, now);
		this.masterGain.gain.linearRampToValueAtTime(0, now + duration);
	}

	// Check for end of track
	if (!this.isPlaybackPaused && currentSample >= this.totalSampleCount) {
		if (this.loopMode === 1 && this.currentTrackSupportsLoop) {
			const list = this.activeGame && this.activeGame.playableList ? this.activeGame.playableList : null;
			const entry = list && list[this.currentFileKey];
			if (entry && entry.filepath && !this._loopRestarting) {
				this._loopRestarting = true;
				setTimeout(async () => {
					await this.playFileFromFS(false, entry.filepath, this.games.indexOf(this.activeGame) + 1, this.currentFileKey);
					this._loopRestarting = false;
				}, 0);
			}
			return;
		}
		this.stop();
		// Small delay to let the user "see" the end
		setTimeout(() => {
			if (this.loopMode === 1 && !this.currentTrackSupportsLoop) {
				this.loopMode = 0;
				this._applyLoopMode();
				this.changeTrack("next");
				return;
			}
			if (this.loopMode === 2) this._changeTrackInGame('next');
			else if (this.isRandomEnabled) this.playRandom();
			else this.changeTrack("next");
		}, 100);
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
	var rect = this.progressContainer.getBoundingClientRect();
	var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
	var targetSample = Math.floor(ratio * this.totalSampleCount);

	const entry = this.activeGame && this.activeGame.playableList ? this.activeGame.playableList[this.currentFileKey] : null;
	const path = (entry && entry.filepath ? entry.filepath : this.currentFileKey || "").toLowerCase();
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

VGMPlay_js.prototype._trackSupportsLoop = function () {
	const isKss = () => {
		if (!this.activeGame || !this.activeGame.playableList || this.currentFileKey == null) return false;
		const path = this.activeGame.playableList[this.currentFileKey] && this.activeGame.playableList[this.currentFileKey].filepath;
		if (!path) return false;
		const clean = path.toLowerCase().split('|track=')[0];
		return clean.endsWith('.kss') || clean.endsWith('.kssx') || clean.endsWith('.kscc') ||
			clean.endsWith('.mgs') || clean.endsWith('.bgm') || clean.endsWith('.opx') ||
			clean.endsWith('.mpk') || clean.endsWith('.mbm');
	};
	const isPsfUsf = () => {
		if (!this.activeGame || !this.activeGame.playableList || this.currentFileKey == null) return false;
		const path = this.activeGame.playableList[this.currentFileKey] && this.activeGame.playableList[this.currentFileKey].filepath;
		if (!path) return false;
		const clean = path.toLowerCase().split('|track=')[0];
		return clean.endsWith('.psf') || clean.endsWith('.minipsf') || clean.endsWith('.usf') || clean.endsWith('.miniusf') || clean.endsWith('.mus') || clean.endsWith('.lmp');
	};
	if (this.GetLoopPoint) {
		try {
			if (this.GetLoopPoint() > 0) return true;
		} catch (e) { }
	}
	// KSS and PSF/USF don't always expose loop points; allow software looping
	return isKss() || isPsfUsf();
};

VGMPlay_js.prototype._applyLoopMode = function () {
	if (this.loopMode === 1) {
		this._loopCount = 0;
		if (this.SetLoopCount) this.SetLoopCount(0);
		if (this.progressContainer) this.progressContainer.style.display = 'none';
	} else {
		this._loopCount = 1;
		if (this.SetLoopCount) this.SetLoopCount(1);
		if (this.progressContainer) this.progressContainer.style.display = '';
	}
	this._setLoopButtonState();
};

VGMPlay_js.prototype.toggleLoopMode = function () {
	this.loopMode = (this.loopMode + 1) % 3;
	this._applyLoopMode();

	if (this.loopMode === 1) {
		this.currentTrackSupportsLoop = this._trackSupportsLoop();
	}
};

VGMPlay_js.prototype._changeTrackInGame = async function (action) {
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

VGMPlay_js.prototype._generateReverbImpulse = function () {
	const length = this.sampleRate * 2.5;
	const impulse = this.context.createBuffer(2, length, this.sampleRate);
	const left = impulse.getChannelData(0);
	const right = impulse.getChannelData(1);

	for (let i = 0; i < length; i++) {
		const decay = Math.pow(1 - i / length, 4.0);
		left[i] = (Math.random() * 2 - 1) * decay;
		right[i] = (Math.random() * 2 - 1) * decay;
	}
	this.reverb.buffer = impulse;
};

VGMPlay_js.prototype._setupTooltips = function () {
	const buttons = this.playerWindow.querySelectorAll('button');
	const tracks = this.vgmplayContainer.querySelectorAll('.vgmplayTrack');
	const targets = [...buttons, ...tracks];
	const idDescriptions = {
		'buttonTogglePlayback': 'Play/Pause (Space)',
		'btnBass': 'Bass Boost (B)',
		'btnReverb': 'Reverb (V)',
		'btnRandom': 'Shuffle game/all (R)',
		'btnLoop': 'Loop track/game (L)',
		'btnLibrary': 'Toggle Float/Library (F)',
		'btnSearch': 'Search (S)'
	};
	const descriptions = {
		'|&lt;': 'Previous Track (P)',
		'|<': 'Previous Track (P)',
		'&#9654;': 'Play/Pause (Space)',
		'▶': 'Play/Pause (Space)',
		'\u25B6': 'Play/Pause (Space)',
		'||': 'Play/Pause',
		'&gt;|': 'Next Track (N)',
		'>|': 'Next Track (N)',
		'&#9632;': 'Stop',
		'■': 'Stop',
		'\u25A0': 'Stop',
		'B': 'Bass Boost (B)',
		'V': 'Reverb (V)',
		'R': 'Shuffle game/all (R)',
		'L': 'Loop track/game (L)',
		'Z': 'Toggle Float/Library (F)',
		'🔍': 'Search (S)',
		'&#128269;': 'Search (S)'
	};

	let tooltipTimeout;

	targets.forEach(target => {
		const text = target.innerHTML.trim();
		const desc = idDescriptions[target.id] || descriptions[text] || target.innerText;
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

if (typeof window !== 'undefined' && !window.VGMPLAY_SKIP_AUTO_INIT && !window.vgmPlayInstance && (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id)) {
	const scriptEl = document.currentScript;
	const data = scriptEl ? scriptEl.dataset : {};
	const options = {};
	if (data && typeof data.standalone !== 'undefined') {
		options.standalone = data.standalone;
	}
	var vgmplay_js = new VGMPlay_js(options);
	window.vgmPlayInstance = vgmplay_js;
}
