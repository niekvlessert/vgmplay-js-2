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

	// ---- UI (mobile) ----
	// Moved to vgmplay-ui.js (ES module POC)

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

	// ---- UI (window positions) ----
	// Moved to vgmplay-ui.js (ES module POC)

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

	// ---- UI (player + drop zone) ----
	// Moved to vgmplay-ui.js (ES module POC)

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

	// ---- UI (game list rendering) ----
	// Moved to vgmplay-library.js (ES module POC)

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

	// ---- Archive Worker ----
	// Moved to vgmplay-archives.js (ES module POC)

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

	// ---- UI (skipped downloads window) ----
	// Moved to vgmplay-ui.js (ES module POC)

	// ---- UI (skipped downloads rendering) ----
	// Moved to vgmplay-ui.js (ES module POC)

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

	// ---- UI (search helpers) ----
	// Moved to vgmplay-ui.js (ES module POC)

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

	// ---- Archive Processing (ZIP) ----
	// Moved to vgmplay-archives.js (ES module POC)

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

	// ---- Archive Processing (7z) ----
	// Moved to vgmplay-archives.js (ES module POC)

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

	// ---- UI (game list rendering) ----
	// Moved to vgmplay-library.js (ES module POC)

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


	// ---- KSS Analyzer / Overlay ----
	// Moved to vgmplay-kss.js (ES module POC)

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
	// Moved to vgmplay-spectrum.js (ES module POC)
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

// ---- UI (tooltips) ----
// Moved to vgmplay-ui.js (ES module POC)

if (typeof window !== 'undefined' && !window.VGMPLAY_SKIP_AUTO_INIT && !window.vgmPlayInstance && (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id)) {
	const scriptEl = document.currentScript;
	const data = scriptEl ? scriptEl.dataset : {};
	const options = {};
	if (data && typeof data.standalone !== 'undefined') {
		options.standalone = data.standalone;
	}
	(async () => {
		const installers = [];
		const loadModule = async (path, fnName, label) => {
			try {
				const mod = await import(path);
				const fn = mod && mod[fnName];
				if (typeof fn === 'function') {
					installers.push(fn);
				} else {
					console.warn(`[VGMPlay] ${label} module missing installer`);
				}
			} catch (e) {
				console.error(`[VGMPlay] ${label} module failed to load`, e);
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
		await loadModule('./vgmplay-library.js', 'installLibrary', 'library');
		await loadModule('./vgmplay-kss.js', 'installKss', 'kss');
		await loadModule('./vgmplay-archives.js', 'installArchives', 'archives');

		installers.forEach((fn) => fn(VGMPlay_js));
		var vgmplay_js = new VGMPlay_js(options);
		window.vgmPlayInstance = vgmplay_js;
	})();
}
