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
				const baseHref = document.baseURI || window.location.href;
				this.baseURL = baseHref.substring(0, baseHref.lastIndexOf('/') + 1);
			}
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
			window.Module.onRuntimeInitialized = function () {
				if (window.vgmplay_js && window.vgmplay_js.loadWhenReady) {
					window.vgmplay_js.loadWhenReady();
				}
			};
		}

		// Load core scripts
		var script = document.createElement("script");
		script.src = this.baseURL + "vgmplay-js.js" + cacheSuffix;
		var script3 = document.createElement("script");
		script3.src = this.baseURL + "minizip-asm.min.js" + cacheSuffix;
		var script4 = document.createElement("script");
		script4.src = this.baseURL + "7zz.umd.js" + cacheSuffix;

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
			link.href = this.baseURL + 'css/style.css' + cacheSuffix;

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
		return lower.endsWith('.zip') || lower.endsWith('.7z') || lower.endsWith('.rar') || lower.endsWith('.vigamup');
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
		await loadModule('./vgmplay-metadata.js', 'installMetadata', 'metadata');
		await loadModule('./vgmplay-layout.js', 'installLayout', 'layout');
		await loadModule('./vgmplay-library.js', 'installLibrary', 'library');
		await loadModule('./vgmplay-kss.js', 'installKss', 'kss');
		await loadModule('./vgmplay-archives.js', 'installArchives', 'archives');
		await loadModule('./vgmplay-audio.js', 'installAudio', 'audio');
		await loadModule('./vgmplay-queue.js', 'installQueue', 'queue');

		installers.forEach((fn) => fn(VGMPlay_js));
		var vgmplay_js = new VGMPlay_js(options);
		window.vgmPlayInstance = vgmplay_js;
	})();
}
