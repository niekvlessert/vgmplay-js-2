export function installLayout(VGMPlay_js) {
VGMPlay_js.prototype._bindScrollProxy = function (el) {
if (!el) return;
el.addEventListener('wheel', (e) => {
if (!this.tracksContainer || !this.zipFileListWindow) return;
// For standalone: only proxy in floating mode (libraryState === 1)
// For extension: proxy in all modes when the list is scrollable
if (this.standalone && this.libraryState !== 1) return;
const list = this.zipFileListWindow;
const isScrollable = list.scrollHeight > list.clientHeight;
if (isScrollable) {
// Check if we're at the top or bottom of the scroll
const atTop = list.scrollTop <= 0;
const atBottom = list.scrollTop >= list.scrollHeight - list.clientHeight - 1;
const scrollingUp = e.deltaY < 0;
const scrollingDown = e.deltaY > 0;

// Only prevent default if we're not at the edge in the direction we're scrolling
if (!((atTop && scrollingUp) || (atBottom && scrollingDown))) {
e.preventDefault();
e.stopPropagation();
// Manually scroll the element
list.scrollTop += e.deltaY;
}
}
}, { passive: false, capture: true });
};

	VGMPlay_js.prototype.dragStart = function (e) {
		// Don't drag if clicking interactive elements
		if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'A' || e.target.classList.contains('vgmplayProgressBar') || e.target.classList.contains('vgmplayProgressFill') || e.target.classList.contains('vgmplayChipVolume')) {
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
	};

	VGMPlay_js.prototype.elementDrag = function (e) {
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
			const nextTop = (this.vgmplayContainer.offsetTop - this.pos2) + "px";
			const nextLeft = (this.vgmplayContainer.offsetLeft - this.pos1) + "px";
			if (this.isExtension && !this.standalone && this.vgmplayContainer.style && this.vgmplayContainer.style.setProperty) {
				this.vgmplayContainer.style.setProperty('top', nextTop, 'important');
				this.vgmplayContainer.style.setProperty('left', nextLeft, 'important');
			} else {
				this.vgmplayContainer.style.top = nextTop;
				this.vgmplayContainer.style.left = nextLeft;
			}
			if (this.isExtension && !this.standalone && this.skippedWindowVisible && this._positionSkippedWindow) {
				this._positionSkippedWindow();
			}
			if (this.isExtension && !this.standalone && this.overviewMode && this._positionOverviewOverlay) {
				this._positionOverviewOverlay();
			}
		}

		if (this.libraryState === 1 && !this.standalone) {
			this.trackListTransformX += this.pos1;
			this.trackListTransformY += this.pos2;
			if (this.tracksContainer) this.tracksContainer.style.transform = `translate(${this.trackListTransformX}px, ${this.trackListTransformY}px)`;
		}
	};

	VGMPlay_js.prototype.stopDrag = function () {
		window.removeEventListener('mousemove', this.elementDrag);
		window.removeEventListener('mouseup', this.stopDrag);
		this.dragTargetWindow = null;
	};

	VGMPlay_js.prototype._dragStartWindow = function (e) {
		if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'A') {
			return;
		}
		e.preventDefault();
		this.windowDragTarget = e.currentTarget;
		this.windowPos3 = e.clientX;
		this.windowPos4 = e.clientY;
		window.addEventListener('mousemove', this._elementDragWindow);
		window.addEventListener('mouseup', this._stopDragWindow);
	};

	VGMPlay_js.prototype._elementDragWindow = function (e) {
		if (!this.windowDragTarget) return;
		e.preventDefault();
		this.windowPos1 = this.windowPos3 - e.clientX;
		this.windowPos2 = this.windowPos4 - e.clientY;
		this.windowPos3 = e.clientX;
		this.windowPos4 = e.clientY;
		const target = this.windowDragTarget;
		target.style.top = (target.offsetTop - this.windowPos2) + "px";
		target.style.left = (target.offsetLeft - this.windowPos1) + "px";
	};

	VGMPlay_js.prototype._stopDragWindow = function () {
		window.removeEventListener('mousemove', this._elementDragWindow);
		window.removeEventListener('mouseup', this._stopDragWindow);
		this.windowDragTarget = null;
	};

	VGMPlay_js.prototype.toggleDisplayZipFileListWindow = function () {
		const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
		if (isMobile) return;

		const maxStates = 3;
		this.libraryState = (this.libraryState + 1) % maxStates;

	if (this.vgmplayContainer) {
		if (this.libraryState === 2) {
			this.vgmplayContainer.classList.add('vgmplayExtensionGrid');
			this._log && this._log('UI', 'Added vgmplayExtensionGrid class. Container classes:', this.vgmplayContainer.className);
		} else {
			this.vgmplayContainer.classList.remove('vgmplayExtensionGrid');
			this._log && this._log('UI', 'Removed vgmplayExtensionGrid class. Container classes:', this.vgmplayContainer.className);
		}
	}
	this._log && this._log('UI', 'Library state changed to:', this.libraryState, '(0=Attached, 1=Floating, 2=Grid)');

	if (this.libraryState === 0) {
			// Attached (non-grid mode for extension)
			if (this.tracksContainer) this.tracksContainer.style.display = 'block';
			this.showZipFileListWindow = true;
			this.trackListTransformX = 0;
			this.trackListTransformY = 0;
			if (this.tracksContainer) this.tracksContainer.style.transform = `translate(0px, 0px)`;
			this._resetWindowPositions();
			if (this.btnLibrary) {
				this.btnLibrary.classList.remove('active');
				this.btnLibrary.classList.remove('blue-active');
				this.btnLibrary.classList.remove('red-active');
			}
			if (this._setOverviewMode) this._setOverviewMode(false);
			// For extension in non-grid mode: set column layout styles via JS for Shadow DOM compatibility
			if (!this.standalone && this.vgmplayContainer) {
				// Use setProperty with 'important' priority to override any CSS
				this.vgmplayContainer.style.setProperty('flex-direction', 'column', 'important');
				this.vgmplayContainer.style.setProperty('width', '350px', 'important');
				this.vgmplayContainer.style.setProperty('max-height', 'calc(100vh - 20px)', 'important');
				this.vgmplayContainer.style.setProperty('height', 'auto', 'important');
				this.vgmplayContainer.style.setProperty('padding', '6px', 'important');
				this.vgmplayContainer.style.setProperty('gap', '6px', 'important');
				// Also reset the root element to non-grid dimensions
				const root = document.getElementById('vgmplay-extension-root');
				if (root) {
					root.style.setProperty('top', '10px', 'important');
					root.style.setProperty('left', '10px', 'important');
					root.style.setProperty('width', '350px', 'important');
					root.style.setProperty('height', 'calc(100vh - 20px)', 'important');
				}
				// Move title and player windows to container (they will be at top)
				if (this.titleWindow && this.titleWindow.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.titleWindow);
				}
				if (this.playerWindow && this.playerWindow.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.playerWindow);
				}
				// Move tracksContainer to container (it will be below player)
				if (this.tracksContainer && this.tracksContainer.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.tracksContainer);
				}
			}
		} else if (this.libraryState === 1) {
			// Floating (non-grid mode for extension)
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
				this.btnLibrary.classList.remove('red-active');
			}
			if (this._setOverviewMode) this._setOverviewMode(false);
			// For extension in non-grid mode: set column layout styles via JS for Shadow DOM compatibility
			if (!this.standalone && this.vgmplayContainer) {
				// Use setProperty with 'important' priority to override any CSS
				this.vgmplayContainer.style.setProperty('flex-direction', 'column', 'important');
				this.vgmplayContainer.style.setProperty('width', '350px', 'important');
				this.vgmplayContainer.style.setProperty('max-height', 'calc(100vh - 20px)', 'important');
				this.vgmplayContainer.style.setProperty('height', 'auto', 'important');
				this.vgmplayContainer.style.setProperty('padding', '6px', 'important');
				this.vgmplayContainer.style.setProperty('gap', '6px', 'important');
				// Also reset the root element to non-grid dimensions
				const root = document.getElementById('vgmplay-extension-root');
				if (root) {
					root.style.setProperty('top', '10px', 'important');
					root.style.setProperty('left', '10px', 'important');
					root.style.setProperty('width', '350px', 'important');
					root.style.setProperty('height', 'calc(100vh - 20px)', 'important');
				}
				// Move title and player windows to container (they will be at top)
				if (this.titleWindow && this.titleWindow.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.titleWindow);
				}
				if (this.playerWindow && this.playerWindow.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.playerWindow);
				}
				// Move tracksContainer to container (it will be below player)
				if (this.tracksContainer && this.tracksContainer.parentNode !== this.vgmplayContainer) {
					this.vgmplayContainer.appendChild(this.tracksContainer);
				}
			}
		} else if (this.libraryState === 2) {
			// Overview grid mode (Blue)
			if (this.tracksContainer) this.tracksContainer.style.display = 'block';
			this.showZipFileListWindow = true;
			if (this.btnLibrary) {
this.btnLibrary.classList.remove('active');
this.btnLibrary.classList.add('blue-active');
this.btnLibrary.classList.remove('red-active');
}
// Set grid mode styles directly via JavaScript for Shadow DOM compatibility
if (this.vgmplayContainer && !this.standalone) {
// Use setProperty with 'important' priority to override any CSS
this.vgmplayContainer.style.setProperty('flex-direction', 'row', 'important');
this.vgmplayContainer.style.setProperty('width', '100vw', 'important');
this.vgmplayContainer.style.setProperty('max-width', 'none', 'important');
this.vgmplayContainer.style.setProperty('height', '100vh', 'important');
this.vgmplayContainer.style.setProperty('max-height', 'none', 'important');
this.vgmplayContainer.style.setProperty('padding', '0', 'important');
this.vgmplayContainer.style.setProperty('gap', '0', 'important');
// Also resize the root element to allow full-screen grid
const root = document.getElementById('vgmplay-extension-root');
if (root) {
root.style.setProperty('top', '0', 'important');
root.style.setProperty('left', '0', 'important');
root.style.setProperty('width', '100vw', 'important');
root.style.setProperty('max-width', 'none', 'important');
root.style.setProperty('height', '100vh', 'important');
}
// Set tracksContainer styles for scrollable tracklist
if (this.tracksContainer) {
this.tracksContainer.style.setProperty('flex', '1', 'important');
this.tracksContainer.style.setProperty('display', 'flex', 'important');
this.tracksContainer.style.setProperty('flex-direction', 'column', 'important');
this.tracksContainer.style.setProperty('min-height', '0', 'important');
this.tracksContainer.style.setProperty('max-height', 'calc(100vh - 180px)', 'important');
this.tracksContainer.style.setProperty('overflow', 'hidden', 'important');
}
// Set zipFileListWindow styles for scrolling
if (this.zipFileListWindow) {
this.zipFileListWindow.style.setProperty('flex', '1', 'important');
this.zipFileListWindow.style.setProperty('min-height', '0', 'important');
this.zipFileListWindow.style.setProperty('max-height', '100%', 'important');
this.zipFileListWindow.style.setProperty('overflow-y', 'auto', 'important');
this.zipFileListWindow.style.setProperty('overflow-x', 'hidden', 'important');
}
}
		  if (this._setOverviewMode) this._setOverviewMode(true);
		  // Don't hide the zip file list window - keep it visible like standalone player
		  if (this.zipFileListWindow) {
		    this.zipFileListWindow.style.display = 'block';
		  }
		  // For extension in grid mode: move elements to panel structure (player at top of left panel, tracks below)
		  if (!this.standalone && this.standaloneLeft && this.standaloneGroup) {
		// Move title and player windows to standaloneGroup FIRST (they will be at top)
		if (this.titleWindow && this.titleWindow.parentNode !== this.standaloneGroup) {
		this.standaloneGroup.appendChild(this.titleWindow);
		}
		if (this.playerWindow && this.playerWindow.parentNode !== this.standaloneGroup) {
		this.standaloneGroup.appendChild(this.playerWindow);
		}
		// Move standaloneGroup to standaloneLeft FIRST (it will be at top)
		if (this.standaloneGroup.parentNode !== this.standaloneLeft) {
		this.standaloneLeft.appendChild(this.standaloneGroup);
		}
		// Move tracksContainer to standaloneLeft LAST (it will be below standaloneGroup)
if (this.tracksContainer && this.tracksContainer.parentNode !== this.standaloneLeft) {
this.standaloneLeft.appendChild(this.tracksContainer);
}
}
}
// Reposition KSS mini overlay when switching modes
if (this._positionKssMiniOverlay) {
this._positionKssMiniOverlay();
}
// Reposition skipped window (additional information) when switching modes
if (this.skippedWindowVisible && this._positionSkippedWindow) {
this._positionSkippedWindow();
}
}
};
