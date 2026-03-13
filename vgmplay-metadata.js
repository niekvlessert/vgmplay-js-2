export function installMetadata(VGMPlay_js) {
	VGMPlay_js.prototype.getVGMTag = function () {
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
	};

	VGMPlay_js.prototype._setChipVolume = function (id, vol) {
		if (this.SetDeviceVolume) {
			this.SetDeviceVolume(id, parseInt(vol));
		}
	};

	VGMPlay_js.prototype._setInfoLoading = function (isLoading) {
		if (!this.titleWindow) return;
		if (isLoading) {
			this.titleWindow.classList.add('vgmplayInfoLoading');
		} else {
			this.titleWindow.classList.remove('vgmplayInfoLoading');
		}
	};

	VGMPlay_js.prototype._setMemoryStatsVisible = function (isVisible) {
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
	};

	VGMPlay_js.prototype.GetVGMTagDirect = function (path, tagIndex) {
		if (this.functionsWrapped && this._GetVGMTagDirectNative) {
			return this._GetVGMTagDirectNative(path, tagIndex) || "";
		}
		return "";
	};

	VGMPlay_js.prototype._normalizeGameTitle = function (name) {
		if (!name) return name;
		let s = String(name);
		// Drop extension
		const dot = s.lastIndexOf('.');
		if (dot > 0) s = s.substring(0, dot);
		// Use everything before the first '(' or '[' if present
		const p = s.indexOf('(');
		const b = s.indexOf('[');
		let cut = -1;
		if (p >= 0 && b >= 0) cut = Math.min(p, b);
		else if (p >= 0) cut = p;
		else if (b >= 0) cut = b;
		if (cut >= 0) s = s.substring(0, cut);
		return s.trim();
	};

	VGMPlay_js.prototype._deriveVgmGameName = function (files, fallbackName) {
		let name = fallbackName || "Archive";
		if (this._normalizeGameTitle) name = this._normalizeGameTitle(name) || name;
		if (!files || !this.GetVGMTagDirect) return name;
		for (const f of files) {
			if (!f || !f.filepath) continue;
			const lower = f.filepath.toLowerCase();
			if (!this.isPlayable(lower)) continue;
			const gameTag = this.GetVGMTagDirect(f.filepath, 2);
			if (gameTag && gameTag.trim()) {
				name = gameTag.trim();
				if (this._normalizeGameTitle) {
					const normalized = this._normalizeGameTitle(name);
					if (normalized) name = normalized;
				}
				break;
			}
			// Fallback to title tag if game tag is missing (common in some PSF/USF sets)
			const titleTag = this.GetVGMTagDirect(f.filepath, 0);
			if (titleTag && titleTag.trim()) {
				name = titleTag.trim();
				if (this._normalizeGameTitle) {
					const normalized = this._normalizeGameTitle(name);
					if (normalized) name = normalized;
				}
				break;
			}
		}
		return name;
	};
}
