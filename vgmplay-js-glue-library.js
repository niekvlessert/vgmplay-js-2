'use strict';

(function () {
	const scriptEl = document.currentScript;
	const baseURL = scriptEl && scriptEl.src
		? scriptEl.src.substring(0, scriptEl.src.lastIndexOf('/') + 1)
		: '';

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = src;
			s.onload = resolve;
			s.onerror = reject;
			document.head.appendChild(s);
		});
	}

	class VGMPlayLibrary {
		constructor() {
			this.functionsWrapped = false;
			this.isVGMLoaded = false;
			this.isVGMPlaying = false;
			this.isPlaybackPaused = true;
			this.generatingAudio = false;
			this.sampleRate = 44100;
			this.dataPtrs = [];
			this.zipCache = new Map();
			this.amountOfGamesLoaded = 0;
			this.games = [];
			this._initPromise = null;
			this._loadLock = Promise.resolve();
		}

		_withLoadLock(fn) {
			this._loadLock = this._loadLock.then(fn, fn);
			return this._loadLock;
		}

		async init() {
			if (!this._initPromise) {
				this._initPromise = this._doInit();
			}
			return this._initPromise;
		}

		async _doInit() {
			window.Module = window.Module || {};
			if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
			if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
			window.Module.print = () => { };
			window.Module.printErr = () => { };
			const base = baseURL;
			window.Module.locateFile = function (path, prefix) {
				if (path.endsWith('.data')) return base + path;
				return prefix + path;
			};

			await loadScript(baseURL + 'vgmplay-js.js');
			await loadScript(baseURL + 'minizip-asm.min.js');

			await new Promise(resolve => {
				const check = () => {
					if (typeof Module !== 'undefined' && Module.calledRun && typeof FS !== 'undefined') resolve();
					else setTimeout(check, 50);
				};
				check();
			});

			this._wrapFunctions();
			await this._initAudio();
		}

		_wrapFunctions() {
			if (this.functionsWrapped) return;
			this.FillBuffer = Module.cwrap('FillBuffer2', 'void', ['number', 'number', 'number']);
			this.OpenVGMFile = Module.cwrap('OpenVGMFile', 'number', ['string']);
			this.CloseVGMFile = Module.cwrap('CloseVGMFile');
			this.PlayVGM = Module.cwrap('PlayVGM');
			this.StopVGM = Module.cwrap('StopVGM');
			this.VGMEnded = Module.cwrap('VGMEnded');
			this.SetSampleRate = Module.cwrap('SetSampleRate', 'number', ['number']);
			this.SetLoopCount = Module.cwrap('SetLoopCount', 'number', ['number']);
			this.SeekVGM = Module.cwrap('Seek', 'number', ['number', 'number']);

			this.dataPtrs[0] = Module._malloc(16384 * 2);
			this.dataPtrs[1] = Module._malloc(16384 * 2);

			this.functionsWrapped = true;
		}

		async _initAudio() {
			this.context = new (window.AudioContext || window.webkitAudioContext)();
			this.sampleRate = this.context.sampleRate || 44100;
			this.SetSampleRate(this.sampleRate);

			await this.context.audioWorklet.addModule(baseURL + 'vgmplay-audio-processor.js');
			this.workletNode = new AudioWorkletNode(this.context, 'vgmplay-processor', {
				numberOfOutputs: 1,
				outputChannelCount: [2]
			});
			this.masterGain = this.context.createGain();
			this.workletNode.connect(this.masterGain);
			this.masterGain.connect(this.context.destination);

			this.workletNode.port.onmessage = (e) => {
				if (e.data && e.data.type === 'need-data') {
					this._pumpBuffers();
				}
			};
		}

		generateBuffer() {
			const N = 4096;
			this.FillBuffer(this.dataPtrs[0], this.dataPtrs[1], N);
			const leftHeap = new Float32Array(Module.HEAPU8.buffer, this.dataPtrs[0], N);
			const rightHeap = new Float32Array(Module.HEAPU8.buffer, this.dataPtrs[1], N);
			return {
				left: new Float32Array(leftHeap),
				right: new Float32Array(rightHeap)
			};
		}

		_pumpBuffers() {
			if (!this.isVGMPlaying || this.isPlaybackPaused) return;
			if (this.VGMEnded && this.VGMEnded()) return;
			for (let i = 0; i < 4; i++) {
				const buf = this.generateBuffer();
				this.workletNode.port.postMessage({
					type: 'buffer',
					left: buf.left,
					right: buf.right
				}, [buf.left.buffer, buf.right.buffer]);
			}
		}

		_loadFileToFS(path, data) {
			const name = path.substring(path.lastIndexOf('/') + 1);
			const parent = path.substring(0, path.lastIndexOf('/')) || '/';
			try { if (!FS.analyzePath(parent).exists) FS.mkdir(parent); } catch { }
			try { FS.unlink(path); } catch { }
			FS.createDataFile(parent, name, data, true, true);
		}

		async loadVGMFromURL(url) {
			const parts = url.split('/');
			const filename = parts[parts.length - 1].split('?')[0].split('#')[0] || 'remote.vgm';
			const destPath = '/' + filename;
			const resp = await fetch(url);
			if (!resp.ok) return null;
			const buf = new Uint8Array(await resp.arrayBuffer());
			this._loadFileToFS(destPath, buf);
			return destPath;
		}

		async loadZip(url) {
			if (this.zipCache.has(url)) return this.zipCache.get(url);
			const resp = await fetch(url);
			if (!resp.ok) return null;
			const buf = new Uint8Array(await resp.arrayBuffer());
			const mz = new Minizip(buf);
			const list = mz.list();
			const entries = Array.isArray(list)
				? list
				: (list && (list.files || list.filelist || list.entries))
					? (list.files || list.filelist || list.entries)
					: Object.values(list || {});

			this.amountOfGamesLoaded++;
			const gamePath = '/game_' + this.amountOfGamesLoaded;
			try { if (!FS.analyzePath(gamePath).exists) FS.mkdir(gamePath); } catch { }

			const files = [];
			for (const entry of entries) {
				if (!entry || !entry.filepath) continue;
				const rel = entry.filepath;
				const lower = rel.toLowerCase();
				if (!lower.endsWith('.vgm') && !lower.endsWith('.vgz')) continue;
				const data = mz.extract(rel);
				const fsPath = gamePath + '/' + rel;
				const lastSlash = fsPath.lastIndexOf('/');
				if (lastSlash > gamePath.length) {
					const dir = fsPath.substring(0, lastSlash);
					try { if (!FS.analyzePath(dir).exists) FS.mkdir(dir); } catch { }
				}
				this._loadFileToFS(fsPath, data);
				files.push({ filepath: fsPath });
			}

			const game = { files };
			this.games.push(game);
			this.zipCache.set(url, game);
			return game;
		}

		load(fileName) {
			if (this.isVGMLoaded && this.StopVGM) this.StopVGM();
			if (this.CloseVGMFile) this.CloseVGMFile();
			const res = this.OpenVGMFile(fileName);
			this.isVGMLoaded = !!res;
			return this.isVGMLoaded;
		}

		play() {
			this.isPlaybackPaused = false;
			if (!this.isVGMPlaying) {
				this.PlayVGM();
				this.isVGMPlaying = true;
			}
			if (this.context.state === 'suspended') {
				this.context.resume();
			}
			this.workletNode.port.postMessage({ type: 'start' });
			if (!this.generatingAudio) {
				this._pumpBuffers();
				this.generatingAudio = true;
			}
		}

		pause() {
			this.isPlaybackPaused = true;
			this.workletNode.port.postMessage({ type: 'pause' });
			if (this.context && this.context.state === 'running') {
				this.context.suspend();
			}
		}

		stop() {
			this.workletNode.port.postMessage({ type: 'stop' });
			if (this.StopVGM) this.StopVGM();
			if (this.CloseVGMFile) this.CloseVGMFile();
			this.isVGMPlaying = false;
			this.isVGMLoaded = false;
			this.isPlaybackPaused = true;
			this.generatingAudio = false;
		}

		async playTrack(url, trackIndex = 0, loopCount = 0) {
			await this.init();
			if (this.isVGMLoaded || this.isVGMPlaying) {
				this.stop(); // clear queued audio for instant switch
			}
			const isZip = /\.zip$/i.test(url.split('?')[0].split('#')[0]);
			if (isZip) return this.playZipTrack(url, trackIndex, loopCount);
			const fsPath = await this.loadVGMFromURL(url);
			if (!fsPath) return;
			if (this.SetLoopCount) this.SetLoopCount(loopCount);
			const ok = this.load(fsPath);
			if (!ok) return;
			this.play();
		}

		async playZipTrack(zipUrl, trackIndex = 0, loopCount = 0) {
			await this.init();
			if (this.isVGMLoaded || this.isVGMPlaying) {
				this.stop(); // clear queued audio for instant switch
			}
			const game = await this.loadZip(zipUrl);
			if (!game || !game.files || !game.files.length) return;
			const file = game.files[trackIndex] || game.files[0];
			if (this.SetLoopCount) this.SetLoopCount(loopCount);
			const ok = this.load(file.filepath);
			if (!ok) return;
			this.play();
		}
	}

	const instance = new VGMPlayLibrary();
	window.vgmPlayInstance = instance;
})();
