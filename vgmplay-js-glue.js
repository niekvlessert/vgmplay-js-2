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
		this.games = [];
		this.activeGame = "";
		this.amountOfGamesLoaded = 0;
		this.zipQueue = [];
		this.isProcessingQueue = false;
		this.sampleRate = "";
		this.trackLengthHumanReadeable = false;
		this.largeDownloadLimitBytes = 7.5 * 1024 * 1024;
		this.standalone = this._normalizeBool(options.standalone);
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
		this.autoDownloadLimit = 10;
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
		this.baseURL = options.baseURL || 'https://niekvlessert.github.io/vgmplay-js-2/';
		if (!options.baseURL) {
			try {
				const currentScript = document.currentScript;
				if (currentScript && currentScript.src) {
					this.baseURL = currentScript.src.substring(0, currentScript.src.lastIndexOf('/') + 1);
				}
			} catch (e) { }
		}

		// Define Emscripten Module object before loading vgmplay-js.js
		if (typeof window !== 'undefined') {
			window.Module = window.Module || {};
			if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
			if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
			const base = this.baseURL;
			window.Module.print = () => { };
			window.Module.printErr = () => { };
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
			this.vgmplayContainer.className = this.standalone ? "vgmplayContainer vgmplayStandalone" : "vgmplayContainer";
			if (this.standalone && this.isMobile) {
				this.vgmplayContainer.classList.add('vgmplayMobile');
			}

			if (this.standalone) {
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

	_resetMobileIdleTimer() {
		if (!this.isMobile) return;
		if (this._mobileIdleTimer) clearTimeout(this._mobileIdleTimer);
		if (!this.isVGMPlaying || this.isPlaybackPaused) return;
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
		window.addEventListener('keydown', function (e) {
			if (e.keyCode == 32) e.preventDefault();
		});

		Mousetrap.bind('space', (e) => {
			this.togglePlayback();
		});
		Mousetrap.bind('n', (e) => {
			this.changeTrack('next');
		});
		Mousetrap.bind('p', (e) => {
			this.changeTrack('previous');
		});
		Mousetrap.bind('s', (e) => {
			stop();
		});
		Mousetrap.bind('z', (e) => {
			this.toggleDisplayZipFileListWindow();
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
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib')) {
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
				<button id="btnLibrary" onclick="vgmplay_js.toggleDisplayZipFileListWindow()">Z</button>
				<span id="vgmplayTime" class="vgmplayTime">0:00/0:00</span>
			</div>
		`;
		this.buttonTogglePlayback = document.getElementById('buttonTogglePlayback');
		this.vgmplayTime = document.getElementById('vgmplayTime');
		this.btnBass = document.getElementById('btnBass');
		this.btnReverb = document.getElementById('btnReverb');
		this.btnRandom = document.getElementById('btnRandom');
		this.btnLibrary = document.getElementById('btnLibrary');

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
		this.uploader.innerHTML = "Drop VGM .zip files here";
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

	async handleFiles(files) {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const lower = file.name.toLowerCase();
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib')) {
				const arrayBuffer = await file.arrayBuffer();
				const byteArray = new Uint8Array(arrayBuffer);
				this.zipQueue.push({ type: 'file', data: byteArray, name: file.name });
			}
		}
		this._processQueue();
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
		if (this.titleWindow) {
			const titleStr = this.ShowTitle();
			if (!titleStr) return;
			this.VGMTag = titleStr.split("|||");
			this.tagType = 0;
			this.titleWindow.innerHTML = "";
			for (this.i = 0; this.i < this.VGMTag.length; this.i++) {
				switch (this.i) {
					case 1:
						if (this.VGMTag[1] || this.VGMTag[3]) this.titleWindow.innerHTML += "Title: ";
						if (this.VGMTag[1]) this.titleWindow.innerHTML += this.VGMTag[1];
						//if (this.VGMTag[1] && this.VGMTag[3]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[3]) this.titleWindow.innerHTML += " (" + this.VGMTag[3] + ")";
						if (this.VGMTag[1] || this.VGMTag[3]) this.titleWindow.innerHTML += "<br/>";
						//this.titleWindow.innerHTML += "Length: " + this.trackLengthHumanReadeable + "<br/>";
						break;
					case 5:
						if (this.VGMTag[5] || this.VGMTag[7]) this.titleWindow.innerHTML += "Game: ";
						if (this.VGMTag[5]) this.titleWindow.innerHTML += this.VGMTag[5];
						//if (this.VGMTag[5] && this.VGMTag[7]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[7]) this.titleWindow.innerHTML += " (" + this.VGMTag[7] + ")";
						if (this.VGMTag[17]) this.titleWindow.innerHTML += ", " + this.VGMTag[17];
						if (this.VGMTag[5] || this.VGMTag[7]) this.titleWindow.innerHTML += "<br/>";
						break;
					case 8:
						if (this.VGMTag[9] || this.VGMTag[11]) this.titleWindow.innerHTML += "System: ";
						if (this.VGMTag[9]) this.titleWindow.innerHTML += this.VGMTag[9];
						else //if (this.VGMTag[9] && this.VGMTag[11]) this.titleWindow.innerHTML += ", ";
							if (this.VGMTag[11]) this.titleWindow.innerHTML += this.VGMTag[11];
						if (this.VGMTag[9] || this.VGMTag[11]) this.titleWindow.innerHTML += "<br/>";
						break;
					case 13:
						if (this.VGMTag[13] || this.VGMTag[15]) this.titleWindow.innerHTML += "Author: ";
						if (this.VGMTag[13]) this.titleWindow.innerHTML += this.VGMTag[13];
						//if (this.VGMTag[13] && this.VGMTag[15]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[15]) this.titleWindow.innerHTML += " (" + this.VGMTag[15] + ")";
						if (this.VGMTag[13] || this.VGMTag[13]) this.titleWindow.innerHTML += "<br/>";
						break;
					case 19:
						if (this.VGMTag[19]) {
							this.titleWindow.innerHTML += "VGM Creator: ";
							this.titleWindow.innerHTML += this.VGMTag[19];
							this.titleWindow.innerHTML += "<br/>";
						}
						break;
					case 20:
						if (this.VGMTag[21] && this.VGMTag[21].length > 1) {
							this.titleWindow.innerHTML += "Comments: ";
							this.titleWindow.innerHTML += this.VGMTag[21];
							this.titleWindow.innerHTML += "<br/>";
						}
						break;
				}

			}

			// For PSF files, add System: Playstation as last info line
			if (this.currentFileKey !== "" && this.activeGame && this.activeGame.files && this.activeGame.files[this.currentFileKey]) {
				const path = this.activeGame.files[this.currentFileKey].filepath || "";
				const lower = path.toLowerCase();
				if (lower.endsWith('.psf') || lower.endsWith('.minipsf')) {
					this.titleWindow.innerHTML += "System: Playstation<br/>";
				}
			}

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
				this.titleWindow.appendChild(chipStrip);
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
		if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib')) {
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
		const size = await this._getRemoteFileSize(url);
		if (!size || size <= this.largeDownloadLimitBytes) return;
		this._addSkippedDownload(url, size);
	}

	loadVGMFromURL(url) {
		return new Promise(function (resolve, reject) {
			try {
				FS.unlink("url.vgm");
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
						var arrayBuffer = xhr.response;
						var byteArray = new Uint8Array(arrayBuffer);
						FS.createDataFile("/", "url.vgm", byteArray, true, true);
						resolve(xhr.response);
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
			return;
		}

		if (this.loader) this.loader.style.display = 'block';

		this.isProcessingQueue = true;
		const job = this.zipQueue.shift();

		const next = () => {
			this.isProcessingQueue = false;
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
								} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf')) {
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
				} else if (lower.endsWith('.psf') || lower.endsWith('.minipsf')) {
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

	processZipBuffer(byteArray, sourceName = '') {
		return new Promise((resolve) => {
			var m3uFile;
			var txtFile;
			var pngFile;
			this.mz = new Minizip(byteArray);
			var fileList = this.mz.list();
			this.amountOfGamesLoaded++;
			const gamePath = "/game_" + this.amountOfGamesLoaded;

			this._makedirs(gamePath);

			for (var key in fileList) {
				var fileArray = this.mz.extract(fileList[key].filepath);
				var fileName = fileList[key].filepath;
				var fullPath = gamePath + "/" + fileName;

				// If fileName contains slashes (escaped or not), we need to ensure parents exist
				const lastSlash = fullPath.lastIndexOf('/');
				if (lastSlash > gamePath.length) {
					this._makedirs(fullPath.substring(0, lastSlash));
				}

				fileList[key].filepath = fullPath; // Store full path
				try {
					const name = fullPath.substring(fullPath.lastIndexOf('/') + 1);
					const parent = fullPath.substring(0, fullPath.lastIndexOf('/'));
					FS.createDataFile(parent, name, fileArray, true, true);
				} catch (e) {
					console.error("Error creating file in FS:", e);
				}
				if (fileName.includes("m3u")) m3uFile = FS.readFile(fullPath, { encoding: "utf8" });
				if (fileName.includes("txt")) txtFile = FS.readFile(fullPath, { encoding: "utf8" });
				if (fileName.includes("png")) pngFile = new Blob([FS.readFile(fullPath)], { type: "image/png" });
			}
			var game = { files: fileList, m3u: m3uFile, txt: txtFile, png: pngFile, path: gamePath };
			this.games.push(game);
			const hasPlayable = fileList.some((f) => this.isPlayable(f.filepath));
			if (!hasPlayable) {
				this._addNoPlayableNotice(sourceName || 'Archive');
			}
			this.checkEverythingReady().then(() => {
				this.showVGMFromZip(game);
				resolve();
			});
		});
	}

	processSingleBuffer(byteArray, sourceName = '') {
		return new Promise((resolve) => {
			this.amountOfGamesLoaded++;
			const gamePath = "/game_" + this.amountOfGamesLoaded;
			this._makedirs(gamePath);
			const fileName = sourceName || "track";
			const fsPath = gamePath + "/" + fileName;
			FS.createDataFile(gamePath, fileName, byteArray, true, true);
			const fileList = [{ filepath: fsPath }];
			var game = { files: fileList, path: gamePath };
			this.games.push(game);
			const hasPlayable = fileList.some((f) => this.isPlayable(f.filepath));
			if (!hasPlayable) {
				this._addNoPlayableNotice(sourceName || 'File');
			}
			this.checkEverythingReady().then(() => {
				this.showVGMFromZip(game);
				resolve();
			});
		});
	}

	async process7zBuffer(byteArray, sourceName = '') {
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

		const fileList = [];
		const gamePath = "/game_" + (++this.amountOfGamesLoaded);
		this._makedirs(gamePath);

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
					const data = sz.FS.readFile(fullSZPath);
					const fsPath = gamePath + "/" + fullRelPath;
					const lastSlash = fsPath.lastIndexOf('/');
					if (lastSlash > gamePath.length) {
						this._makedirs(fsPath.substring(0, lastSlash));
					}
					const name = fsPath.substring(fsPath.lastIndexOf('/') + 1);
					const parent = fsPath.substring(0, fsPath.lastIndexOf('/'));
					FS.createDataFile(parent, name, data, true, true);
					fileList.push({ filepath: fsPath });
				}
			}
		};

		recurseFS("/out");

		var game = { files: fileList, path: gamePath };
		this.games.push(game);
		const hasPlayable = fileList.some((f) => this.isPlayable(f.filepath));
		if (!hasPlayable) {
			this._addNoPlayableNotice(sourceName || 'Archive');
		}
		await this.checkEverythingReady();
		this.showVGMFromZip(game);
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
			if (this._isArchiveUrl(lower) || lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib')) {
				this._queueURL(url, false, true);
			} else if (this.isPlayable(lower)) {
				// Handle direct links as single files
				this._queueURL(url, false, true);
			}
		});
	}

	showVGMFromZip(game) {
		const files = game.files;
		const gameIndex = this.games.indexOf(game) + 1;

		if (this.zipFileListWindow) {
			const fragment = document.createDocumentFragment();
			const gameWrap = document.createElement('div');
			gameWrap.className = 'vgmplayGame';
			gameWrap.dataset.expanded = 'false';
			gameWrap.classList.add('vgmplayGameCollapsed');

			if (game.png) {
				const url = URL.createObjectURL(game.png);
				const img = new Image();
				img.src = url;
				img.style.width = '256px';
				img.style.height = '212px';
				img.className = 'vgmplayGameToggle';
				gameWrap.appendChild(img);
				gameWrap.appendChild(document.createElement("br"));
			} else {
				// No logo, add spacer and game name placeholder
				if (this.games.length > 1 && gameIndex > 1) {
					const spacer = document.createElement("div");
					spacer.className = "game-spacer";
					gameWrap.appendChild(spacer);
				}

				const placeholder = document.createElement("div");
				placeholder.className = "game-name-placeholder";

				// Try to get game name from first track if possible
				let psfGame = "";
				for (const f of files) {
					const l = f.filepath.toLowerCase();
					if (this.isPlayable(l)) {
						psfGame = this.GetVGMTagDirect(f.filepath, 2); // Game tag
						if (psfGame) break;
					}
				}

				if (!psfGame && files.length > 0) {
					// Fallback to path name
					const path = files[0].filepath;
					const parts = path.split('/');
					if (parts.length > 2) {
						psfGame = parts[1].replace('game_', 'Game ');
					}
				}

				placeholder.textContent = psfGame || "Game " + gameIndex;
				placeholder.classList.add('vgmplayGameToggle');
				gameWrap.appendChild(placeholder);
			}

			const trackContainer = document.createElement('div');
			trackContainer.className = 'vgmplayGameTracks';
			gameWrap.appendChild(trackContainer);

			gameWrap.addEventListener('click', (e) => {
				const tgt = e.target;
				if (!(tgt && tgt.classList && tgt.classList.contains('vgmplayGameToggle'))) return;
				const expanded = gameWrap.dataset.expanded === 'true';
				gameWrap.dataset.expanded = expanded ? 'false' : 'true';
				gameWrap.classList.toggle('vgmplayGameExpanded', !expanded);
				gameWrap.classList.toggle('vgmplayGameCollapsed', expanded);
			});

			for (let key = 0; key < files.length; key++) {
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
									a.onclick = () => this.playFileFromFS(a, trackPath, gameIndex, key);

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
								}
								continue;
							}
						}

						const trackLength = this.GetTrackLengthDirect(fullPath);
						const totalSampleCount = trackLength * currentSampleRate / 44100;

						if (totalSampleCount > 0) {
							const trackLengthSeconds = Math.round(totalSampleCount / currentSampleRate);
							const trackLengthHumanReadeable = new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5);

							const a = document.createElement("a");
							a.className = "vgmplayTrack";
							a.onclick = () => this.playFileFromFS(a, fullPath, gameIndex, key);
							files[key].linkElement = a; // Store reference for highlighting

							const nameSpan = document.createElement("span");
							nameSpan.className = "track-name";
							nameSpan.textContent = fileName;
							a.appendChild(nameSpan);

							const lengthSpan = document.createElement("span");
							lengthSpan.className = "track-length";
							lengthSpan.textContent = trackLengthHumanReadeable;
							a.appendChild(lengthSpan);

							trackContainer.appendChild(a);
						}
					} catch (e) {
						console.error("[UI] Error getting track length for:", fullPath, e);
					}
				}
			}
			fragment.appendChild(gameWrap);
			this.zipFileListWindow.appendChild(fragment);
		}
	}

	_updateHighlight() {
		// Remove highlight from all elements
		const tracks = this.vgmplayContainer.querySelectorAll('.vgmplayTrack');
		tracks.forEach(track => {
			track.classList.remove('activeTrack');
		});

		// Apply highlight to the active one
		if (this.activeGame && this.activeGame.files[this.currentFileKey]) {
			const activeLink = this.activeGame.files[this.currentFileKey].linkElement;
			if (activeLink) {
				activeLink.classList.add('activeTrack');
			}
		}
	}

	async playFileFromFS(href_object, file, game, key) {
		return this._withLoadLock(async () => {
			if (game) this.activeGame = this.games[game - 1];
			if (!this.isPlaybackPaused || this.isVGMPlaying) this.stop();
			await this.checkEverythingReady();

			if (!this.isPlayable(file)) {
				return;
			}

			this._isLoadingFile = true;
			try {
				this.load(file);
				this.currentFileKey = key;
				this.play();
				this.totalSampleCount = this.GetTrackLength() * this.sampleRate / 44100;
				this.trackLengthSeconds = Math.round(this.totalSampleCount / this.sampleRate);
				this.trackLengthHumanReadeable = new Date((this.trackLengthSeconds) * 1000).toISOString().substr(14, 5);
				this.getVGMTag();

				let gameName = (this.VGMTag && this.VGMTag.length >= 8) ? (this.VGMTag[5] || this.VGMTag[7] || "Unknown Game") : "Unknown Game";
				let trackName = file.substring(file.lastIndexOf('/') + 1);
				if (window.Android) window.Android.updateMetadata(gameName + " - " + unescape(trackName), this.trackLengthSeconds * 1000);

				//console.log("ChipInfoString: " + this.GetChipInfoString());
				this._updateHighlight();
			} finally {
				this._isLoadingFile = false;
			}
		});
	}

	isPlayable(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.vgm') || p.endsWith('.vgz') ||
			p.endsWith('.psf') || p.endsWith('.minipsf') ||
			p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.kss') || p.endsWith('.sap') || p.endsWith('.ay');
	}

	_isGmeFile(path) {
		const p = path.toLowerCase().split('|track=')[0];
		return p.endsWith('.spc') || p.endsWith('.nsf') || p.endsWith('.nsfe') ||
			p.endsWith('.gbs') || p.endsWith('.gym') || p.endsWith('.hes') ||
			p.endsWith('.kss') || p.endsWith('.sap') || p.endsWith('.ay');
	}

	_isArchiveUrl(lower) {
		return lower.endsWith('.zip') || lower.endsWith('.7z');
	}

	async changeTrack(action) {
		if (this.games.length === 0) return;

		if (this.isRandomEnabled && action === "next") {
			this.playRandom();
			return;
		}

		let gameIndex = this.activeGame ? this.games.indexOf(this.activeGame) : -1;

		if (gameIndex === -1) {
			gameIndex = 0;
			this.activeGame = this.games[gameIndex];
			this.currentFileKey = (action === "next") ? 0 : this.activeGame.files.length - 1;
		} else {
			if (action === "next") {
				if (this.currentFileKey + 1 >= this.activeGame.files.length) {
					// Move to first track of next game
					gameIndex = (gameIndex + 1) % this.games.length;
					this.activeGame = this.games[gameIndex];
					this.currentFileKey = 0;
				} else {
					this.currentFileKey++;
				}
			} else { // previous
				if (this.currentFileKey <= 0) {
					// Move to last track of previous game
					gameIndex = (gameIndex - 1 + this.games.length) % this.games.length;
					this.activeGame = this.games[gameIndex];
					this.currentFileKey = this.activeGame.files.length - 1;
				} else {
					this.currentFileKey--;
				}
			}
		}

		// Skip non-playable files
		let attempts = 0;
		while (!this.isPlayable(this.activeGame.files[this.currentFileKey].filepath) && attempts < this.activeGame.files.length) {
			if (action === "next") {
				this.currentFileKey = (this.currentFileKey + 1) % this.activeGame.files.length;
			} else {
				this.currentFileKey = (this.currentFileKey - 1 + this.activeGame.files.length) % this.activeGame.files.length;
			}
			attempts++;
		}

		await this.playFileFromFS(false, this.activeGame.files[this.currentFileKey].filepath, gameIndex + 1, this.currentFileKey);
	}

	async togglePlayback() {
		if (await this.checkEverythingReady()) {
			if (!this.isVGMLoaded && !this.currentFileKey) {
				await this.changeTrack('next');
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
			this.CloseVGMFile = Module.cwrap('CloseVGMFile');
			this.PlayVGM = Module.cwrap('PlayVGM');
			this.StopVGM = Module.cwrap('StopVGM');
			this.VGMEnded = Module.cwrap('VGMEnded');
			this.GetTrackLength = Module.cwrap('GetTrackLength');
			this.GetTrackLengthDirect = Module.cwrap('GetTrackLengthDirect', 'number', ['string']);
			this.GetGMETrackCountDirect = Module.cwrap('GetGMETrackCountDirect', 'number', ['string']);
			this.GetGMETrackNameDirect = Module.cwrap('GetGMETrackNameDirect', 'string', ['string', 'number']);
			this._GetVGMTagDirectNative = Module.cwrap('GetVGMTagDirect', 'string', ['string', 'number']);
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

			this.dataPtrs = [];
			this.dataPtrs[0] = Module._malloc(16384 * 2);
			this.dataPtrs[1] = Module._malloc(16384 * 2);

			this.results = [];

			this.SetSampleRate(this.sampleRate);

			this.functionsWrapped = true;
		}


		return true;
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
			this._audioMotionLoading = import('https://cdn.jsdelivr.net/npm/audiomotion-analyzer@4/+esm')
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
			mode === 'oct6' || mode === 'radialApple' || mode === 'linePrism';

		this.standaloneAnalyzerEl.style.display = isSpectrum ? 'block' : 'none';

		if (isSpectrum) {
			this.analyzerPreset = mode;
			this._ensureAudioMotion().then(() => {
				this._initStandaloneAnalyzer(true);
			});
		} else if (this._audiomotion && typeof this._audiomotion.destroy === 'function') {
			try { this._audiomotion.destroy(); } catch (e) { }
			this._audiomotion = null;
		}
	}

	generateBuffer() {
		const N = 4096; // Smaller batch size to reduce main-thread blocking
		// Always create fresh views from Module.HEAPU8.buffer in case it was reallocated (detached)
		this.FillBuffer(this.dataPtrs[0], this.dataPtrs[1], N);

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

		// Check if VGM ended
		if (this.VGMEnded()) {
			this.emulatorFinished = true;
			return;
		}

		// Generate and send a few buffers
		for (let i = 0; i < 4; i++) {
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
		if (this.isMobile) {
			this._resetMobileIdleTimer();
		}
		document.getElementById("buttonTogglePlayback").innerHTML = "||";
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
		this._startSpectrumAnimation();
	}

	pause() {
		this.isPlaybackPaused = true;
		if (window.Android) window.Android.updatePlaybackState(false);
		this.buttonTogglePlayback.innerHTML = "&#9654;"
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

		this._stopSpectrumAnimation();
	}

	stop() {
		this.buttonTogglePlayback.innerHTML = "&#9654;";
		if (window.Android) window.Android.updatePlaybackState(false);
		if (this.isMobile) {
			this._setMobileView('ui');
		}

		if (this.workletNode) {
			this.workletNode.port.postMessage({ type: 'stop' });
		}

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
		if (this.isVGMLoaded && this.StopVGM) {
			this.StopVGM();
		}
		if (this.CloseVGMFile) {
			this.CloseVGMFile();
		}
		this.OpenVGMFile(fileName);
		this.isVGMLoaded = true;
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

		// Draw Channels
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
		this.stop();
		// Small delay to let the user "see" the end
		setTimeout(() => {
			if (this.isRandomEnabled) this.playRandom();
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
	if (!game || !game.files || game.files.length === 0) return;
	const fileIndex = Math.floor(Math.random() * game.files.length);
	this.playFileFromFS(false, game.files[fileIndex].filepath, gameIndex + 1, fileIndex);
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
	const descriptions = {
		'|&lt;': 'Previous Track',
		'|<': 'Previous Track',
		'&#9654;': 'Play/Pause',
		'▶': 'Play/Pause',
		'\u25B6': 'Play/Pause',
		'||': 'Play/Pause',
		'&gt;|': 'Next Track',
		'>|': 'Next Track',
		'&#9632;': 'Stop',
		'■': 'Stop',
		'\u25A0': 'Stop',
		'B': 'Bass Boost',
		'V': 'Reverb',
		'R': 'Shuffle game/all',
		'Z': 'Toggle Float/Library'
	};

	let tooltipTimeout;

	targets.forEach(target => {
		const text = target.innerHTML.trim();
		const desc = descriptions[text] || target.innerText;
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

if (typeof window !== 'undefined' && !window.vgmPlayInstance && (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id)) {
	const scriptEl = document.currentScript;
	const data = scriptEl ? scriptEl.dataset : {};
	const options = {};
	if (data && typeof data.standalone !== 'undefined') {
		options.standalone = data.standalone;
	}
	var vgmplay_js = new VGMPlay_js(options);
	window.vgmPlayInstance = vgmplay_js;
}
