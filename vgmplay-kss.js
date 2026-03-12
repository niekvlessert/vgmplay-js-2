export function installKss(VGMPlay_js) {
	VGMPlay_js.prototype._buildKssChannelDefs = function (mask) {
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
	};

	VGMPlay_js.prototype._resetKssDeviceScan = function () {
		this.kssDeviceBaseMask = this.GetKSSDeviceMask ? this.GetKSSDeviceMask() : 0;
		this.kssDeviceDetectedMask = 0;
		this._kssDeviceScanFrames = 0;
		this._kssDeviceScanDone = false;
		const scanMask = this.kssDeviceBaseMask || (1 | 2 | 4 | 8 | 16);
		this._kssDeviceScanDefs = this._buildKssChannelDefs(scanMask);
		this._kssDeviceScanPeaks = {
			psg: 0,
			scc: 0,
			opll: 0,
			opl: 0,
			sng: 0,
			dac: 0
		};
	};

	VGMPlay_js.prototype._scanKssDevicesIfNeeded = function (perCh, stride, sampleCount) {
		if (this._kssDeviceScanDone || !perCh || !this._kssDeviceScanDefs) {
			if (!perCh && !this._kssDebugLogged) {
				this._kssDebugLogged = true;
				// No per-channel data available for device scan (older build).
			}
			return;
		}
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
		if (!mask && !this._kssDebugLogged) {
			this._kssDebugLogged = true;
			// Device scan found no active chips (silently ignore).
		}
		this._initKssChannelAnalyzer(true);
		this._initKssOverlay(true);
		this._initKssMiniOverlay(true);
	};

	VGMPlay_js.prototype._initKssChannelAnalyzer = function (forceRebuild = false) {
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
	};

	VGMPlay_js.prototype._initKssOverlay = function (forceRebuild = false) {
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
	};

	VGMPlay_js.prototype._positionKssMiniOverlay = function () {
		if (!this.kssMiniOverlayEl || !this.spectrumCanvas || !this.playerWindow) return;
		const top = this.spectrumCanvas.offsetTop + 2;
		const left = this.spectrumCanvas.offsetLeft + 40;
		this.kssMiniOverlayEl.style.top = `${top}px`;
		this.kssMiniOverlayEl.style.left = `${left}px`;
	};

	VGMPlay_js.prototype._initKssMiniOverlay = function (forceRebuild = false) {
		if (this.standalone) return;
		if (!this.playerWindow || !this.spectrumCanvas) return;
		if (!this.isKSSActive || !this.GetKSSDeviceMask) {
			if (this.kssMiniOverlayEl) this.kssMiniOverlayEl.style.display = 'none';
			return;
		}

		const baseMask = this.kssDeviceBaseMask || (this.GetKSSDeviceMask ? this.GetKSSDeviceMask() : 0);
		const mask = this.kssDeviceDetectedMask ? this.kssDeviceDetectedMask : baseMask;
		const defs = this._buildKssChannelDefs(mask);
		const needsRebuild = forceRebuild ||
			!this.kssMiniOverlayEl ||
			!this.kssMiniOverlayEl.isConnected ||
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

			if (!this.kssMiniOverlayEl) {
				this.kssMiniOverlayEl = document.createElement('div');
				this.kssMiniOverlayEl.className = 'vgmplayKssOverlay vgmplayKssOverlayMini';
				this.kssMiniOverlayEl.style.position = 'absolute';
				this.kssMiniOverlayEl.style.zIndex = '6';
				this.kssMiniOverlayEl.style.pointerEvents = 'auto';
				this.kssMiniOverlayEl.style.maxWidth = '220px';
				this.kssMiniOverlayEl.style.maxHeight = '90px';
				this.kssMiniOverlayEl.style.overflow = 'auto';
			}
			if (!this.kssMiniOverlayEl.isConnected) {
				this.playerWindow.style.position = this.playerWindow.style.position || 'relative';
				this.playerWindow.appendChild(this.kssMiniOverlayEl);
			}

			this.kssMiniOverlayEl.innerHTML = '';
			this.kssMiniOverlayRows = [];

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

				this.kssMiniOverlayEl.appendChild(row);
				this.kssMiniOverlayRows.push({ muteBtn, soloBtn });
			});
		}

		this.kssMiniOverlayEl.style.display = 'block';
		this._positionKssMiniOverlay();
		if (!this._kssMiniOverlayResizeBound && typeof window !== 'undefined') {
			this._kssMiniOverlayResizeBound = true;
			window.addEventListener('resize', () => this._positionKssMiniOverlay());
		}
		this._updateKssChannelButtons();
	};

	VGMPlay_js.prototype._toggleKssChannelMute = function (idx) {
		const state = this.kssChannelStates[idx];
		if (!state) return;
		state.mute = !state.mute;
		if (state.mute) state.solo = false;
		this._applyKssChannelMasks();
		this._updateKssChannelButtons();
	};

	VGMPlay_js.prototype._toggleKssChannelSolo = function (idx) {
		const state = this.kssChannelStates[idx];
		if (!state) return;
		state.solo = !state.solo;
		if (state.solo) state.mute = false;
		this._applyKssChannelMasks();
		this._updateKssChannelButtons();
	};

	VGMPlay_js.prototype._updateKssChannelButtons = function () {
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
		updateRows(this.kssMiniOverlayRows);
	};

	VGMPlay_js.prototype._applyKssChannelMasks = function () {
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
	};

	VGMPlay_js.prototype._ensureKssFftTables = function (size, bins) {
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
	};

	VGMPlay_js.prototype._drawKssAnalyzer = function () {
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
	};
}
