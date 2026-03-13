export function installMidi(VGMPlay_js) {
	VGMPlay_js.prototype._getMidiEngineOptions = function () {
		return [
			{ id: 'adlmidi', label: 'ADLMIDI (OPL3)' },
			{ id: 'munt', label: 'Munt (MT-32)' }
		];
	};

	VGMPlay_js.prototype._getPreferredMidiEngine = function (info) {
		if (info && info.standardHints && info.standardHints.some(h => h.includes('MT-32'))) {
			return 'munt';
		}
		return 'adlmidi';
	};

	VGMPlay_js.prototype._isMidiFile = function (path) {
		const p = String(path || '').toLowerCase().split('|track=')[0];
		return p.endsWith('.mid') || p.endsWith('.midi') || p.endsWith('.rmi');
	};

	VGMPlay_js.prototype._readMidiInfoFromFS = function (path) {
		if (typeof FS === 'undefined' || !path) return null;
		let data;
		try {
			data = FS.readFile(path);
		} catch (e) {
			return null;
		}
		if (!data || data.length < 4) return null;

		const readStr = (off, len) => {
			if (off + len > data.length) return '';
			let s = '';
			for (let i = 0; i < len; i++) {
				s += String.fromCharCode(data[off + i]);
			}
			return s;
		};
		const readU16BE = (off) => {
			if (off + 2 > data.length) return 0;
			return (data[off] << 8) | data[off + 1];
		};
		const readU32BE = (off) => {
			if (off + 4 > data.length) return 0;
			return (data[off] << 24) | (data[off + 1] << 16) | (data[off + 2] << 8) | data[off + 3];
		};
		const readU32LE = (off) => {
			if (off + 4 > data.length) return 0;
			return (data[off]) | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24);
		};
		const findPattern = (pattern) => {
			const plen = pattern.length;
			if (!plen || data.length < plen) return false;
			for (let i = 0; i <= data.length - plen; i++) {
				let ok = true;
				for (let j = 0; j < plen; j++) {
					if (data[i + j] !== pattern[j]) {
						ok = false;
						break;
					}
				}
				if (ok) return true;
			}
			return false;
		};
		const detectStandards = () => {
			const hints = [];
			// GM System On / GM2 System On
			if (findPattern([0xF0, 0x7E, 0x7F, 0x09, 0x01, 0xF7])) {
				hints.push('General MIDI (GM) reset');
			}
			if (findPattern([0xF0, 0x7E, 0x7F, 0x09, 0x02, 0xF7])) {
				hints.push('General MIDI 2 (GM2) reset');
			}
			// Roland GS reset
			if (findPattern([0xF0, 0x41, 0x10, 0x42, 0x12, 0x40, 0x00, 0x7F, 0x00, 0x41, 0xF7])) {
				hints.push('Roland GS reset');
			}
			// Yamaha XG reset
			if (findPattern([0xF0, 0x43, 0x10, 0x4C, 0x00, 0x00, 0x7E, 0x00, 0xF7])) {
				hints.push('Yamaha XG reset');
			}
			// Roland MT-32 reset
			if (findPattern([0xF0, 0x41, 0x10, 0x16, 0x12, 0x7F, 0x00, 0x00, 0x01, 0xF7])) {
				hints.push('Roland MT-32 reset');
			}
			return hints;
		};

		const parseMThd = (off) => {
			if (readStr(off, 4) !== 'MThd') return null;
			const headerLen = readU32BE(off + 4);
			const format = readU16BE(off + 8);
			const tracks = readU16BE(off + 10);
			const division = readU16BE(off + 12);
			const isSmpte = (division & 0x8000) !== 0;
			const info = {
				typeLabel: 'Standard MIDI File (SMF, MThd)',
				headerLen,
				format,
				tracks,
				division,
				isSmpte,
				standardHints: detectStandards()
			};
			if (isSmpte) {
				const fps = 256 - (division >> 8);
				const ticksPerFrame = division & 0xff;
				info.smpte = { fps, ticksPerFrame };
			} else {
				info.ppqn = division;
			}
			return info;
		};

		const sig = readStr(0, 4);
		if (sig === 'MThd') {
			return parseMThd(0);
		}
		if (sig === 'RIFF' && readStr(8, 4) === 'RMID') {
			// RIFF RMID container
			let offset = 12;
			while (offset + 8 <= data.length) {
				const chunkId = readStr(offset, 4);
				const chunkSize = readU32LE(offset + 4);
				const chunkData = offset + 8;
				if (chunkId === 'data') {
					const mthd = parseMThd(chunkData);
					if (mthd) {
						mthd.typeLabel = 'RIFF RMID';
						if (!mthd.standardHints) {
							mthd.standardHints = detectStandards();
						}
						return mthd;
					}
					return { typeLabel: 'RIFF RMID', containerOnly: true, standardHints: detectStandards() };
				}
				offset = chunkData + chunkSize + (chunkSize % 2);
			}
			return { typeLabel: 'RIFF RMID', containerOnly: true, standardHints: detectStandards() };
		}
		if (sig === 'FORM') {
			const formType = readStr(8, 4);
			if (formType === 'XDIR' || formType === 'XMID') {
				return { typeLabel: `XMI (${formType})`, standardHints: detectStandards() };
			}
			return { typeLabel: `IFF FORM (${formType || 'unknown'})`, standardHints: detectStandards() };
		}
		if (sig === 'MUS\x1a') {
			return { typeLabel: 'Doom MUS', standardHints: detectStandards() };
		}

		return { typeLabel: 'Unknown/Non-standard MIDI', standardHints: detectStandards() };
	};

	VGMPlay_js.prototype._getMidiTypeLabel = function (path) {
		const info = this._readMidiInfoFromFS(path);
		return info && info.typeLabel ? info.typeLabel : 'MIDI';
	};

	VGMPlay_js.prototype._showMidiInfo = function (path, displayName = '') {
		if (!this.titleWindow) return;
		const info = this._readMidiInfoFromFS(path);
		if (!info) return;

		const titleTarget = this.titleContent || this.titleWindow;
		const name = displayName || (path ? path.split('/').pop() : 'MIDI');
		const lines = [];
		lines.push(`Title: ${name}`);
		lines.push(`File Type: ${info.typeLabel}`);
		if (Array.isArray(info.standardHints)) {
			if (info.standardHints.length > 0) {
				lines.push(`Standard Hint: ${info.standardHints.join(', ')}`);
				lines.push('Note: Standard hints are heuristic (SysEx reset messages).');
			} else {
				lines.push('Standard Hint: Not detected (GM/GS/XG not encoded in header).');
			}
		}
		if (typeof info.format === 'number') {
			const formatLabel = info.format === 0 ? '0 (single-track)' : info.format === 1 ? '1 (multi-track)' : info.format === 2 ? '2 (multi-song)' : String(info.format);
			lines.push(`Format: ${formatLabel}`);
		}
		if (typeof info.tracks === 'number') {
			lines.push(`Tracks: ${info.tracks}`);
		}
		if (info.isSmpte && info.smpte) {
			lines.push(`Division: SMPTE ${info.smpte.fps} fps, ${info.smpte.ticksPerFrame} ticks/frame`);
		} else if (typeof info.ppqn === 'number') {
			lines.push(`Division: ${info.ppqn} PPQN`);
		}
		lines.push('Note: Playback uses the selected MIDI engine.');

		titleTarget.innerHTML = lines.join('<br/>') + '<br/>';

		const engineOptions = this._getMidiEngineOptions();
		if (engineOptions && engineOptions.length) {
			const selectWrap = document.createElement('div');
			selectWrap.className = 'vgmplayMidiEngine';
			const label = document.createElement('label');
			label.className = 'vgmplayMidiEngineLabel';
			label.textContent = 'MIDI Engine:';
			const select = document.createElement('select');
			select.className = 'vgmplayMidiEngineSelect';
			const preferred = this._getPreferredMidiEngine(info);
			const current = this.midiEngineChoice || preferred || engineOptions[0].id;
			engineOptions.forEach((opt) => {
				const option = document.createElement('option');
				option.value = opt.id;
				option.textContent = opt.label;
				if (opt.id === current) {
					option.selected = true;
				}
				select.appendChild(option);
			});
			select.addEventListener('change', (e) => {
				const nextEngine = e.target.value;
				if (nextEngine === 'munt' && Module._CheckMuntRoms && !Module._CheckMuntRoms()) {
					if (this._showMuntRomError) {
						this._showMuntRomError();
					}
					// Revert select
					select.value = this.midiEngineChoice || preferred;
					return;
				}
				this.midiEngineChoice = nextEngine;
				if (this.SetMidiEngine) {
					try { this.SetMidiEngine(this.midiEngineChoice); } catch (err) { }
				}
			});
			this.midiEngineChoice = current;
			if (this.SetMidiEngine) {
				try { this.SetMidiEngine(this.midiEngineChoice); } catch (err) { }
			}
			selectWrap.appendChild(label);
			selectWrap.appendChild(select);
			titleTarget.appendChild(selectWrap);
		}
	};
}
