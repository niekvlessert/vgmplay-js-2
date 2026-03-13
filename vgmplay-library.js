export function installLibrary(VGMPlay_js) {
	VGMPlay_js.prototype._renderZipGamesNow = function () {
		if (!this.zipFileListWindow) return;
		this.zipFileListWindow.innerHTML = "";
		for (const game of this.games) {
			game.uiElement = null;
			this.showVGMFromZip(game);
		}
	};

	VGMPlay_js.prototype._scheduleZipRender = function () {
		this.pendingZipRender = true;
		if (!this.isProcessingQueue) {
			this.pendingZipRender = false;
			this._renderZipGamesNow();
		}
	};

	VGMPlay_js.prototype.showVGMFromZip = function (game) {
		// Ensure game name is set from archive name if available
		if (!game.name && game.archiveName) {
			game.name = game.archiveName;
		}
		const files = game.files || [];
		const hasPlayable = files.some((f) => f && f.filepath && this.isPlayable(String(f.filepath).toLowerCase()));
		if (!hasPlayable) {
			if (game.uiElement && game.uiElement.parentNode) {
				game.uiElement.parentNode.removeChild(game.uiElement);
			}
			game.uiElement = null;
			return;
		}
		const suppressHeader = false;
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
					const placeholder = document.createElement("div");
					placeholder.className = "game-name-placeholder";

					// Try to get game name from first track if possible
					let psfGame = tagGameName || "";
					if (psfGame && (psfGame.toLowerCase().endsWith('.usf') || psfGame.toLowerCase().endsWith('.miniusf'))) {
						psfGame = ""; // Filter out bad data if it's just the filename
					}
					gameDisplayName = game.name || game.archiveName || psfGame || "Game " + gameIndex;
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
	};
}
