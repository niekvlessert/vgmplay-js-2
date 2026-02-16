'use strict';

class VGMPlay_js {

	constructor(options = {}) {
		window.vgmplay_js = this; // Ensure global access for UI handlers
		window.vgmPlayInstance = this;
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
		this.games = [];
		this.activeGame = "";
		this.amountOfGamesLoaded = 0;
		this.zipQueue = [];
		this.isProcessingQueue = false;
		this.sampleRate = "";
		this.trackLengthHumanReadeable = false;

		this.pos1 = 0;
		this.pos2 = 0;
		this.pos3 = 0;
		this.pos4 = 0;

		// Playback tracking
		this.playbackStartTime = 0;
		this.startSample = 0;
		this.visualSamplePosition = 0;
		this.emulatorFinished = false;

		// Bind dragging methods
		this.elementDrag = this.elementDrag.bind(this);
		this.stopDrag = this.stopDrag.bind(this);

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
			const base = this.baseURL;
			window.Module.locateFile = function (path, prefix) {
				if (path.endsWith(".data")) return base + path;
				return prefix + path;
			};
		}

		// Load core scripts
		var script = document.createElement("script");
		script.src = this.baseURL + "vgmplay-js.js";
		var script3 = document.createElement("script");
		script3.src = this.baseURL + "minizip-asm.min.js";

		document.head.appendChild(script);
		document.head.appendChild(script3);

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
			this.vgmplayContainer.className = "vgmplayContainer";

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
				this.vgmplayContainer.appendChild(this.titleWindow);
				this.titleWindow.className = "vgmplayTitleWindow";
				this.titleWindow.addEventListener("mousedown", (e) => {
					e.preventDefault();
					this.pos3 = e.clientX;
					this.pos4 = e.clientY;
					window.addEventListener('mousemove', this.elementDrag);
					window.addEventListener('mouseup', this.stopDrag);
				});
			}
			if (this.displayPlayer) {
				this.playerWindow = document.createElement('div');
				this.playerWindow.id = "vgmplayPlayer";
				this.vgmplayContainer.appendChild(this.playerWindow);
				this.showPlayer();
			}
			if (this.displayZipFileList) {
				this.zipFileListWindow = document.createElement('div');
				this.zipFileListWindow.id = "vgmplayZipFileList";
				this.vgmplayContainer.appendChild(this.zipFileListWindow);
				this.showZipFileListWindow = true;
				this.zipFileListWindow.className = "vgmplayZipFileListWindow";

				this.loader = document.createElement('div');
				this.loader.className = 'vgmplayLoader';
				this.loader.innerHTML = 'Loading track data';
				this.zipFileListWindow.appendChild(this.loader);
			}
			this.setupDropZone();
		}

		this.currentFileKey = "";


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
	}

	loadWhenReady() {
		this.elms = document.getElementsByTagName("a"),
			this.len = this.elms.length;
		for (var ii = 0; ii < this.len; ii++) {
			if (this.elms[ii].href.match(/.zip/g)) this.loadZIPWithVGMFromURL(this.elms[ii].href);
		}
		this.setKeyBindings();
	}

	elementDrag(e) {
		e.preventDefault();
		this.pos1 = this.pos3 - e.clientX;
		this.pos2 = this.pos4 - e.clientY;
		this.pos3 = e.clientX;
		this.pos4 = e.clientY;
		this.vgmplayContainer.style.top = (this.vgmplayContainer.offsetTop - this.pos2) + "px";
		this.vgmplayContainer.style.left = (this.vgmplayContainer.offsetLeft - this.pos1) + "px";
	}

	stopDrag() {
		window.removeEventListener('mousemove', this.elementDrag);
		window.removeEventListener('mouseup', this.stopDrag);
	}

	showPlayer() {
		this.playerWindow.className = "vgmplayPlayerWindow";
		this.playerWindow.innerHTML = `
			<button onclick="vgmplay_js.changeTrack('previous')">|&lt;</button>
			<button id="buttonTogglePlayback" onclick="vgmplay_js.togglePlayback()">&#9654;</button>
			<button onclick="vgmplay_js.changeTrack('next')">&gt;|</button>
			<button onclick="vgmplay_js.stop()">&#9632;</button>
			<button id="btnBass" onclick="vgmplay_js.toggleBassBoost()">B</button>
			<button id="btnReverb" onclick="vgmplay_js.toggleReverb()">V</button>
			<button id="btnRandom" onclick="vgmplay_js.toggleRandom()">R</button>
			<button id="btnLibrary" onclick="vgmplay_js.toggleDisplayZipFileListWindow()">Z</button>
			<span id="vgmplayTime" style="color:white; font-family:monospace; margin-left:5px;">0:00/0:00</span>
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
		this.vgmplayContainer.appendChild(this.uploader);

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
			if (file.name.toLowerCase().endsWith('.zip')) {
				const arrayBuffer = await file.arrayBuffer();
				const byteArray = new Uint8Array(arrayBuffer);
				this.zipQueue.push({ type: 'file', data: byteArray });
			}
		}
		this._processQueue();
	}

	toggleDisplayZipFileListWindow() {
		if (this.showZipFileListWindow) {
			this.vgmplayContainer.removeChild(this.zipFileListWindow);
			this.showZipFileListWindow = false;
		} else {
			this.vgmplayContainer.appendChild(this.zipFileListWindow);
			this.showZipFileListWindow = true;
		}
	}

	getVGMTag() {
		if (this.titleWindow) {
			this.VGMTag = this.ShowTitle().split("|||");
			this.tagType = 0;
			this.titleWindow.innerHTML = "";
			for (this.i = 0; this.i < this.VGMTag.length; this.i++) {
				switch (this.i) {
					case 0:
						if (this.VGMTag[0] || this.VGMTag[1]) this.titleWindow.innerHTML += "Title: ";
						if (this.VGMTag[0]) this.titleWindow.innerHTML += this.VGMTag[0];
						if (this.VGMTag[0] && this.VGMTag[1]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[1]) this.titleWindow.innerHTML += this.VGMTag[1];
						if (this.VGMTag[0] || this.VGMTag[1]) this.titleWindow.innerHTML += "<br/>";
						this.titleWindow.innerHTML += "Length: " + this.trackLengthHumanReadeable + "<br/>";
						this.i++;
						break;
					case 2:
						if (this.VGMTag[2] || this.VGMTag[3]) this.titleWindow.innerHTML += "Game: ";
						if (this.VGMTag[2]) this.titleWindow.innerHTML += this.VGMTag[2];
						if (this.VGMTag[2] && this.VGMTag[3]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[3]) this.titleWindow.innerHTML += this.VGMTag[3];
						if (this.VGMTag[2] || this.VGMTag[3]) this.titleWindow.innerHTML += "<br/>";
						this.i++;
						break;
					case 4:
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML += "System: ";
						if (this.VGMTag[4]) this.titleWindow.innerHTML += this.VGMTag[4];
						if (this.VGMTag[4] && this.VGMTag[5]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[5]) this.titleWindow.innerHTML += this.VGMTag[5];
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML += "<br/>";
						this.i++;
						break;
					case 6:
						if (this.VGMTag[6] || this.VGMTag[7]) this.titleWindow.innerHTML += "Author: ";
						if (this.VGMTag[6]) this.titleWindow.innerHTML += this.VGMTag[6];
						if (this.VGMTag[6] && this.VGMTag[7]) this.titleWindow.innerHTML += ", ";
						if (this.VGMTag[7]) this.titleWindow.innerHTML += this.VGMTag[7];
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML += "<br/>";
						this.i++;
						break;
					case 8:
						if (this.VGMTag[8]) {
							this.titleWindow.innerHTML += "Creator: ";
							this.titleWindow.innerHTML += this.VGMTag[8];
							this.titleWindow.innerHTML += "<br/>";
						}
						break;
					case 9:
						if (this.VGMTag[9].length > 1) {
							this.titleWindow.innerHTML += "Notes: ";
							this.titleWindow.innerHTML += this.VGMTag[9];
							this.titleWindow.innerHTML += "<br/>";
						}
						break;
				}

			}
		}
	}

	loadVGMFromURL(url) {
		return new Promise(function (resolve, reject) {
			try {
				FS.unlink("url.vgm");
			} catch (err) { }

			var xhr = new XMLHttpRequest();
			xhr.responseType = "arraybuffer";

			const classContext = this;
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
	}

	loadZIPWithVGMFromURL(url) {
		if (this.zipURLLoaded.includes(url)) {
			return;
		}
		this.zipURLLoaded.push(url);
		this.zipQueue.push({ type: 'url', data: url });
		this._processQueue();
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
				var xhr = new XMLHttpRequest();
				xhr.responseType = "arraybuffer";
				xhr.onreadystatechange = function () {
					if (xhr.readyState == XMLHttpRequest.DONE) {
						if (xhr.status === 200) {
							var arrayBuffer = xhr.response;
							var byteArray = new Uint8Array(arrayBuffer);
							classContext.processZipBuffer(byteArray).then(next);
						} else {
							console.error("Failed to load zip from URL:", job.data);
							next();
						}
					}
				}
				xhr.open('GET', job.data, true);
				xhr.send(null);
			} else if (job.type === 'file') {
				classContext.processZipBuffer(job.data).then(next);
			}
		});
	}

	_makedirs(path) {
		const parts = path.split('/').filter(p => p.length > 0);
		let current = '';
		for (const part of parts) {
			current += '/' + part;
			try {
				if (!FS.analyzePath(current).exists) {
					FS.mkdir(current);
				}
			} catch (e) {
				// Fallback if analyzePath fails or mkdir refuses
			}
		}
	}

	processZipBuffer(byteArray) {
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
				var fileName = escape(fileList[key].filepath);
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
			this.checkEverythingReady().then(() => {
				this.showVGMFromZip(game);
				resolve();
			});
		});
	}

	addHarvestedTracks(urls) {
		urls.forEach(url => {
			if (url.toLowerCase().endsWith('.zip')) {
				this.loadZIPWithVGMFromURL(url);
			}
		});
	}

	showVGMFromZip(game) {
		const files = game.files;
		const gameIndex = this.games.indexOf(game) + 1;

		if (this.zipFileListWindow) {
			const fragment = document.createDocumentFragment();

			if (game.png) {
				const url = URL.createObjectURL(game.png);
				const img = new Image();
				img.src = url;
				img.style.width = '256px';
				img.style.height = '212px';
				fragment.appendChild(img);
				fragment.appendChild(document.createElement("br"));
			}

			for (let key = 0; key < files.length; key++) {
				const fullPath = files[key].filepath;
				const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1);
				if (fileName.includes("vgm") || fileName.includes("vgz")) {
					this.OpenVGMFile(fullPath);
					this.PlayVGM();
					const totalSampleCount = this.GetTrackLength() * this.sampleRate / 44100;
					const trackLengthSeconds = Math.round(totalSampleCount / this.sampleRate);
					const trackLengthHumanReadeable = new Date((trackLengthSeconds) * 1000).toISOString().substr(14, 5);
					this.StopVGM();
					this.CloseVGMFile();

					const a = document.createElement("a");
					a.className = "vgmplayTrack";
					a.onclick = () => this.playFileFromFS(a, fullPath, gameIndex, key);
					files[key].linkElement = a; // Store reference for highlighting

					const nameSpan = document.createElement("span");
					nameSpan.textContent = unescape(fileName);
					a.appendChild(nameSpan);

					const timeSpan = document.createElement("span");
					timeSpan.style.float = "right";
					timeSpan.textContent = trackLengthHumanReadeable;
					a.appendChild(timeSpan);

					fragment.appendChild(a);
				} else {
					files.splice(key, 1);
					key--;
				}
			}
			this.zipFileListWindow.appendChild(fragment);
		}
		this._updateHighlight();
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
		if (game) this.activeGame = this.games[game - 1];
		if (!this.isPlaybackPaused || this.isVGMPlaying) this.stop();
		await this.checkEverythingReady();
		this.load(file);
		this.currentFileKey = key;
		this.play();
		this.totalSampleCount = this.GetTrackLength() * this.sampleRate / 44100;
		this.trackLengthSeconds = Math.round(this.totalSampleCount / this.sampleRate);
		this.trackLengthHumanReadeable = new Date((this.trackLengthSeconds) * 1000).toISOString().substr(14, 5);
		this.getVGMTag();
		this._updateHighlight();
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
		}
		if (!this.functionsWrapped) {
			this.VGMPlay_Init = Module.cwrap('VGMPlay_Init');
			this.VGMPlay_Init2 = Module.cwrap('VGMPlay_Init2');
			this.FillBuffer = Module.cwrap('FillBuffer2', 'number', ['number', 'number']);
			this.OpenVGMFile = Module.cwrap('OpenVGMFile', 'number', ['string']);
			this.CloseVGMFile = Module.cwrap('CloseVGMFile');
			this.PlayVGM = Module.cwrap('PlayVGM');
			this.StopVGM = Module.cwrap('StopVGM');
			this.VGMEnded = Module.cwrap('VGMEnded');
			this.GetTrackLength = Module.cwrap('GetTrackLength');
			this.GetLoopPoint = Module.cwrap('GetLoopPoint');
			this.SeekVGM = Module.cwrap('SeekVGM', 'number', ['number', 'number']);
			this.SetSampleRate = Module.cwrap('SetSampleRate', 'number', ['number']);
			this.SetLoopCount = Module.cwrap('SetLoopCount', 'number', ['number']);
			this.SamplePlayback2VGM = Module.cwrap('SamplePlayback2VGM', 'number', ['number']);
			this.ShowTitle = Module.cwrap('ShowTitle', 'string');

			this.dataPtrs = [];
			this.dataPtrs[0] = Module._malloc(16384 * 2);
			this.dataPtrs[1] = Module._malloc(16384 * 2);

			this.dataHeaps = [];
			this.dataHeaps[0] = new Int16Array(Module.HEAPU8.buffer, this.dataPtrs[0], 16384);
			this.dataHeaps[1] = new Int16Array(Module.HEAPU8.buffer, this.dataPtrs[1], 16384);

			this.buffers = [];
			this.buffers[0] = [];
			this.buffers[1] = [];

			this.results = [];

			this.VGMPlay_Init();
			this.SetSampleRate(this.sampleRate);
			this.VGMPlay_Init2();

			this.functionsWrapped = true;
		}


		return true;
	}

	generateBuffer() {
		this.FillBuffer(this.dataHeaps[0].byteOffset, this.dataHeaps[1].byteOffset);

		this.results[0] = new Int16Array(this.dataHeaps[0].buffer, this.dataHeaps[0].byteOffset, 16384);
		this.results[1] = new Int16Array(this.dataHeaps[1].buffer, this.dataHeaps[1].byteOffset, 16384);

		var left = new Float32Array(16384);
		var right = new Float32Array(16384);
		for (var i = 0; i < 16384; i++) {
			left[i] = this.results[0][i] / 32768;
			right[i] = this.results[1][i] / 32768;
		}
		this.samplesGenerated += 16384;
		return { left, right };
	}

	_pumpBuffers() {
		if (!this.isVGMPlaying || this.isPlaybackPaused) return;

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

	play() {
		document.getElementById("buttonTogglePlayback").innerHTML = "||";
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

			// Reset fade state carefully
			this.isFadingOut = false;
			this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
			this.masterGain.gain.setValueAtTime(1.0, this.context.currentTime);
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
		this.buttonTogglePlayback.innerHTML = "&#9654;"

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
		this.isVGMPlaying = false;
		this.isVGMLoaded = false;

		this.isPlaybackPaused = true;
		this.visualSamplePosition = 0;
		this.startSample = 0;
		this.emulatorFinished = false;

		this.isFadingOut = false;
		if (this.masterGain) {
			try {
				this.masterGain.gain.cancelScheduledValues(0);
				this.masterGain.gain.value = 1.0;
			} catch (e) { }
		}

		this._stopSpectrumAnimation();
		this._clearSpectrum();
		this._resetProgressBar();
	}

	load(fileName) {
		if (this.isVGMLoaded) {
			this.StopVGMPlayback();
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

		// Black background
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, w, h);

		// Draw horizontal grid lines (old-school look)
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
		ctx.lineWidth = 1;
		for (let y = 0; y < h; y += 8) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}

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

		// Draw Left Channel
		for (let i = 0; i < barCount; i++) {
			let sum = 0;
			for (let j = 0; j < binsPerBar; j++) {
				sum += this.analyserDataLeft[i * binsPerBar + j];
			}
			const avg = sum / binsPerBar;
			const barHeight = (avg / 255) * h;
			const x = i * (barWidth + gap);
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

		// Draw Right Channel
		for (let i = 0; i < barCount; i++) {
			let sum = 0;
			for (let j = 0; j < binsPerBar; j++) {
				sum += this.analyserDataRight[i * binsPerBar + j];
			}
			const avg = sum / binsPerBar;
			const barHeight = (avg / 255) * h;
			const x = (w / 2) + i * (barWidth + gap);
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

		// Scanline overlay effect
		ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
		for (let y = 0; y < h; y += 2) {
			ctx.fillRect(0, y, w, 1);
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
		this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
		this.masterGain.gain.setValueAtTime(1.0, this.context.currentTime);
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

VGMPlay_js.prototype.toggleRandom = function () {
	this.isRandomEnabled = !this.isRandomEnabled;
	if (this.btnRandom) {
		this.btnRandom.classList.toggle('active', this.isRandomEnabled);
	}
};

VGMPlay_js.prototype.playRandom = function () {
	if (this.games.length === 0) return;
	const gameIndex = Math.floor(Math.random() * this.games.length);
	const game = this.games[gameIndex];
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
		'R': 'Shuffle',
		'Z': 'Toggle Library'
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
	var vgmplay_js = new VGMPlay_js();
	window.vgmPlayInstance = vgmplay_js;
}
