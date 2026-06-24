export function installAudio(VGMPlay_js) {
	VGMPlay_js.prototype._doInit = async function () {
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
    if (this.debugMode) console.error('AudioWorklet failed to load:', err);
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
			this.SetMidiEngine = Module.cwrap('SetMidiEngine', 'void', ['string']);
			this.PrefillPSF = Module.cwrap('PrefillPSF', 'void', ['number', 'number']);
			this.FillBufferKSSPerCh = Module.cwrap('FillBufferKSSPerCh', 'void', ['number', 'number', 'number', 'number']);
			this.GetKSSPerChSize = Module.cwrap('GetKSSPerChSize', 'number');
			this.GetKSSDeviceMask = Module.cwrap('GetKSSDeviceMask', 'number');
			this.SetKSSChannelMask = Module.cwrap('SetKSSChannelMask', 'void', ['number', 'number']);
			this.IsVGMStream = Module.cwrap('IsVGMStream', 'number');
			this.GetVgmstreamLoop = Module.cwrap('GetVgmstreamLoop', 'number');
			this.SetVgmstreamLoop = Module.cwrap('SetVgmstreamLoop', 'void', ['number']);
			this.HasVgmstreamNativeLoop = Module.cwrap('HasVgmstreamNativeLoop', 'number');
			this.SetMoonsoundMwkPath = Module.cwrap('SetMoonsoundMwkPath', 'void', ['string']);
			this.GetLastLoadErrorCode = Module.cwrap('GetLastLoadErrorCode', 'number');
			this.MoonsoundSupportsLoop = Module.cwrap('MoonsoundSupportsLoop', 'number');

			this.dataPtrs = [];
			this.dataPtrs[0] = Module._malloc(16384 * 2);
			this.dataPtrs[1] = Module._malloc(16384 * 2);

			this.results = [];

    this.SetSampleRate(this.sampleRate);

    this.functionsWrapped = true;
  }

if (this.isKSSActive) {
    this._ensureKssBindings();
  }

// Don't await cache init - let it run in background, but keep a promise for coordination.
if (this._initCache && !this._cacheReady) {
  if (!this._cacheInitPromise) {
    this._log && this._log('AUDIO', 'Starting cache init in background');
    this._cacheInitPromise = this._initCache().then(() => {
      this._log && this._log('AUDIO', 'Cache init complete');
    }).catch(e => {
      this._logError && this._logError('AUDIO', 'Cache init error:', e);
    });
  }
} else {
  this._log && this._log('AUDIO', 'Skipping cache init, _initCache:', !!this._initCache, '_cacheReady:', this._cacheReady);
}

  return true;
};

	VGMPlay_js.prototype._ensureKssBindings = function () {
		if (!Module) return;
		const canCwrap = !!Module.cwrap;
		if (!this.FillBufferKSSPerCh) {
			if (canCwrap) {
				this.FillBufferKSSPerCh = Module.cwrap('FillBufferKSSPerCh', 'void', ['number', 'number', 'number', 'number']);
			} else if (Module._FillBufferKSSPerCh) {
				this.FillBufferKSSPerCh = Module._FillBufferKSSPerCh;
			}
		}
		if (!this.GetKSSPerChSize) {
			if (canCwrap) {
				this.GetKSSPerChSize = Module.cwrap('GetKSSPerChSize', 'number');
			} else if (Module._GetKSSPerChSize) {
				this.GetKSSPerChSize = Module._GetKSSPerChSize;
			}
		}
		if (!this.GetKSSDeviceMask) {
			if (canCwrap) {
				this.GetKSSDeviceMask = Module.cwrap('GetKSSDeviceMask', 'number');
			} else if (Module._GetKSSDeviceMask) {
				this.GetKSSDeviceMask = Module._GetKSSDeviceMask;
			}
		}
		if (!this.SetKSSChannelMask) {
			if (canCwrap) {
				this.SetKSSChannelMask = Module.cwrap('SetKSSChannelMask', 'void', ['number', 'number']);
			this.IsVGMStream = Module.cwrap('IsVGMStream', 'number');
			this.GetVgmstreamLoop = Module.cwrap('GetVgmstreamLoop', 'number');
			this.SetVgmstreamLoop = Module.cwrap('SetVgmstreamLoop', 'void', ['number']);
			this.HasVgmstreamNativeLoop = Module.cwrap('HasVgmstreamNativeLoop', 'number');
			} else if (Module._SetKSSChannelMask) {
				this.SetKSSChannelMask = Module._SetKSSChannelMask;
			}
		}
	};

	VGMPlay_js.prototype._startPsfPrefill = function () {
		if (this._psfPrefillTimer) return;
		this._psfPrefillTimer = setInterval(() => {
			if (!this.isVGMPlaying || this.isPlaybackPaused) return;
			if (this.PrefillPSF) {
				this.PrefillPSF(16384, 4);
			}
		}, 15);
	};

	VGMPlay_js.prototype._stopPsfPrefill = function () {
		if (this._psfPrefillTimer) {
			clearInterval(this._psfPrefillTimer);
			this._psfPrefillTimer = null;
		}
	};

	VGMPlay_js.prototype.generateBuffer = function () {
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
			if (this.isKSSActive && !this._kssDebugLogged) {
				this._kssDebugLogged = true;
				// Keep silent here; lack of per-channel KSS support is expected on older builds.
			}
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
	};

	VGMPlay_js.prototype._pumpBuffers = function () {
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
					// For vgmstream: seek to 0 for gapless loop (avoids stop/reopen)
					if (this.IsVGMStream && this.IsVGMStream()) {
						this.SeekVGM(0, 0);
						this.samplesGenerated = 0;
						this.visualSamplePosition = 0;
						this.startSample = 0;
						this.emulatorFinished = false;
						this.isFadingOut = false;
						if (this.context) {
							this.playbackStartTime = this.context.currentTime;
						}
						return;
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
				if (this.nativeMode && this._nativeLibraryApp && this.loopMode !== 1) {
					this._nativeLibraryApp.nextTrack();
					return;
				}
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
	};

	VGMPlay_js.prototype._withLoadLock = function (fn) {
		this._loadLock = this._loadLock.then(fn, fn);
		return this._loadLock;
	};

	VGMPlay_js.prototype.play = function () {
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
	};

	VGMPlay_js.prototype.pause = function () {
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
	};

	VGMPlay_js.prototype.stop = function () {
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
		if (this._initKssMiniOverlay) {
			this._initKssMiniOverlay(true);
		}
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
			if (this.nativeMode && this._nativeLibraryApp && this.loopMode !== 1) {
				this._nativeLibraryApp.nextTrack();
				return;
			}
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

	VGMPlay_js.prototype._trackSupportsLoop = function () {
		const result = (() => {
			const isKss = () => {
				if (!this.activeGame || !this.activeGame.playableList || this.currentFileKey == null) return false;
				const path = this.activeGame.playableList[this.currentFileKey] && this.activeGame.playableList[this.currentFileKey].filepath;
				if (!path) return false;
				const clean = path.toLowerCase().split('|track=')[0];
				return clean.endsWith('.kss') || clean.endsWith('.mgs') || clean.endsWith('.bgm') || clean.endsWith('.opx') ||
					clean.endsWith('.mpk') || clean.endsWith('.mbm');
			};
			const isPsfUsf = () => {
				if (!this.activeGame || !this.activeGame.playableList || this.currentFileKey == null) return false;
				const path = this.activeGame.playableList[this.currentFileKey] && this.activeGame.playableList[this.currentFileKey].filepath;
				if (!path) return false;
				const clean = path.toLowerCase().split('|track=')[0];
				return clean.endsWith('.psf') || clean.endsWith('.minipsf') || clean.endsWith('.usf') || clean.endsWith('.miniusf') || clean.endsWith('.mus') || clean.endsWith('.lmp');
			};
			const isMwm = () => {
				if (!this.activeGame || !this.activeGame.playableList || this.currentFileKey == null) return false;
				const path = this.activeGame.playableList[this.currentFileKey] && this.activeGame.playableList[this.currentFileKey].filepath;
				if (!path) return false;
				const clean = path.toLowerCase().split('|track=')[0];
				return clean.endsWith('.mwm');
			};
			if (this.GetLoopPoint) {
				try {
					if (this.GetLoopPoint() > 0) return true;
				} catch (e) { }
			}
			if (this.IsVGMStream && this.IsVGMStream()) {
				// Only support looping if the file has native loop metadata
				if (this.HasVgmstreamNativeLoop && this.HasVgmstreamNativeLoop()) return true;
				return false;
			}
			// KSS and PSF/USF don't always expose loop points; allow software looping
			if (isMwm()) {
				try {
					return this.MoonsoundSupportsLoop ? !!this.MoonsoundSupportsLoop() : false;
				} catch (e) { return false; }
			}
			return isKss() || isPsfUsf();
		})();

	if (this.debugMode) {
		this._log && this._log('AUDIO', `_trackSupportsLoop: ${result ? 'YES' : 'NO'}`);
	}
		return result;
	};

	VGMPlay_js.prototype._applyLoopMode = function () {
		if (this.loopMode === 1) {
			this._loopCount = 0;
			if (this.SetLoopCount) this.SetLoopCount(0);
			if (this.SetVgmstreamLoop) this.SetVgmstreamLoop(1); // 1 = enabled (play_forever=true)
			if (this.progressContainer) this.progressContainer.style.display = 'none';

			// Cancel any in-progress fade-out so audio keeps playing
			this.isFadingOut = false;
			this.emulatorFinished = false;
			if (this.masterGain && this.context) {
				const now = this.context.currentTime;
				this.masterGain.gain.cancelScheduledValues(now);
				this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
				this.masterGain.gain.linearRampToValueAtTime(1.0, now + 0.02);
			}
		} else {
			this._loopCount = 1;
			if (this.SetLoopCount) this.SetLoopCount(1);
			if (this.SetVgmstreamLoop) this.SetVgmstreamLoop(0); // 0 = disabled; C side will fade then signal done
			if (this.progressContainer) this.progressContainer.style.display = '';
			// Reset these so the end-detection path (VGMEnded) works cleanly
			this.isFadingOut = false;
			this.emulatorFinished = false;
		}
		this._setLoopButtonState();
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
}
