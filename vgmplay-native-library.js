(function () {
  'use strict';

  const PAGE_SIZE = 10;
  const ARCHIVE_META_VERSION = 4;
  const TRACK_META_VERSION = 2;
  const ARCHIVE_EXTS = new Set(['zip', '7z', 'rar', 'rsn', 'vgmz', 'vgmdz', 'vgmpack', 'vigamup']);
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);
  const DEFAULT_CONFIG = { showUnsupported: false, showFilenames: false, imageOverview: true, volume: 80, libraryWidth: 440 };
  const LIBRARY_MIN_WIDTH = 440;
  const BADGE_CLASS = {
    SPC: 'badge-spc',
    VGM: 'badge-vgm',
    VGZ: 'badge-vgz',
    SSF: 'badge-ssf',
    MINISSF: 'badge-ssf',
    DSF: 'badge-ssf',
    MINIDSF: 'badge-ssf',
    USF: 'badge-ssf',
    MINIUSF: 'badge-ssf',
    PSF: 'badge-psf',
    MINIPSF: 'badge-psf',
    NSF: 'badge-nsf',
    NSFE: 'badge-nsf',
    GBS: 'badge-gbs',
    HES: 'badge-hes',
    KSS: 'badge-kss',
    KSSX: 'badge-kss',
    KSCC: 'badge-kss',
    MIDI: 'badge-midi',
    MID: 'badge-midi',
    MOD: 'badge-mod',
    S3M: 'badge-s3m',
    XM: 'badge-xm',
    IT: 'badge-it',
    MPTM: 'badge-mptm',
    STM: 'badge-mod',
    MTM: 'badge-mod',
    '669': 'badge-mod',
    AMF: 'badge-mod',
    DMF: 'badge-mod',
    FAR: 'badge-mod',
    IMF: 'badge-mod',
    MED: 'badge-mod',
    OKT: 'badge-mod',
    PTM: 'badge-mod',
    ULT: 'badge-mod',
    UMX: 'badge-mod',
    AT9: 'badge-at9',
    AT3: 'badge-at9',
    ADX: 'badge-adx',
    HCA: 'badge-hca',
    WEM: 'badge-wem',
    BFSTM: 'badge-nintendo',
    BRSTM: 'badge-nintendo',
    BCSTM: 'badge-nintendo',
    RSN: 'badge-rsn',
    ZIP: 'badge-zip',
    '7Z': 'badge-zip',
    RAR: 'badge-zip',
    VGMPACK: 'badge-pack',
    VGMZ: 'badge-vgz',
    VGMDZ: 'badge-vgz',
    FLAC: 'badge-flac',
    APE: 'badge-ape',
    MBM: 'badge-mbm',
    MGS: 'badge-kss',
    VIGAMUP: 'badge-pack'
  };
  const FORMAT_INFO = {
    SPC: { content: 'SNES SPC dump', backend: 'SPC700' },
    NSF: { content: 'NES music container', backend: 'Game Music Emu', multiTrack: true },
    NSFE: { content: 'NES music container', backend: 'Game Music Emu', multiTrack: true },
    GBS: { content: 'Game Boy music container', backend: 'Game Music Emu', multiTrack: true },
    HES: { content: 'PC Engine music container', backend: 'Game Music Emu', multiTrack: true },
    KSS: { content: 'MSX/SMS music container', backend: 'KSS', multiTrack: true },
    KSSX: { content: 'MSX/SMS music container', backend: 'KSS', multiTrack: true },
    KSCC: { content: 'MSX/SMS music container', backend: 'KSS', multiTrack: true },
    VGM: { content: 'VGM command stream', backend: 'libvgm' },
    VGZ: { content: 'Compressed VGM command stream', backend: 'libvgm' },
    PSF: { content: 'PlayStation sequenced music', backend: 'Highly Experimental' },
    SSF: { content: 'Saturn sequenced music', backend: 'LazyUSF/SSF' },
    MINISSF: { content: 'Saturn sequenced music', backend: 'LazyUSF/SSF' },
    MIDI: { content: 'MIDI sequence', backend: 'MIDI synthesizer' },
    MBM: { content: 'MSX MoonBlaster module', backend: 'KSS' },
    MGS: { content: 'MSX music sequence', backend: 'KSS' },
    FLAC: { content: 'FLAC audio stream', backend: 'Native decoder' },
    APE: { content: 'Monkey audio stream', backend: 'Monkey audio decoder' },
    MOD: { content: 'Tracker module', backend: 'OpenMPT' },
    S3M: { content: 'Tracker module', backend: 'OpenMPT' },
    XM: { content: 'Tracker module', backend: 'OpenMPT' },
    IT: { content: 'Tracker module', backend: 'OpenMPT' },
    MPTM: { content: 'Tracker module', backend: 'OpenMPT' },
    STM: { content: 'Tracker module', backend: 'OpenMPT' },
    MTM: { content: 'Tracker module', backend: 'OpenMPT' },
    '669': { content: 'Tracker module', backend: 'OpenMPT' },
    AMF: { content: 'Tracker module', backend: 'OpenMPT' },
    DMF: { content: 'Tracker module', backend: 'OpenMPT' },
    FAR: { content: 'Tracker module', backend: 'OpenMPT' },
    IMF: { content: 'Tracker module', backend: 'OpenMPT' },
    MED: { content: 'Tracker module', backend: 'OpenMPT' },
    OKT: { content: 'Tracker module', backend: 'OpenMPT' },
    PTM: { content: 'Tracker module', backend: 'OpenMPT' },
    ULT: { content: 'Tracker module', backend: 'OpenMPT' },
    UMX: { content: 'Tracker module', backend: 'OpenMPT' },
    AT9: { content: 'Vita ATRAC9 stream', backend: 'vgmstream' },
    AT3: { content: 'ATRAC3 stream', backend: 'vgmstream' },
    ADX: { content: 'CRI ADX stream', backend: 'vgmstream' },
    HCA: { content: 'CRI HCA stream', backend: 'vgmstream' },
    WEM: { content: 'Wwise stream', backend: 'vgmstream' },
    BFSTM: { content: 'Nintendo streamed audio', backend: 'vgmstream' },
    BRSTM: { content: 'Nintendo streamed audio', backend: 'vgmstream' },
    BCSTM: { content: 'Nintendo streamed audio', backend: 'vgmstream' },
    VIGAMUP: { content: 'VGM pack archive', backend: 'Archive reader' },
    ZIP: { content: 'Archive container', backend: 'Archive reader' },
    RSN: { content: 'SPC archive container', backend: 'Archive reader' },
    VGMPACK: { content: 'Sample pack archive', backend: 'Archive reader' }
  };

  function extOf(name) {
    const clean = String(name || '').split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    return dot >= 0 ? clean.substring(dot + 1).toLowerCase() : '';
  }

  function baseName(name) {
    return String(name || '').split(/[\\/]/).pop() || name || '';
  }

  function formatOf(item) {
    const ext = extOf(item.relativePath || item.name || item.url);
    if (ext === 'mid' || ext === 'midi' || ext === 'rmi') return 'MIDI';
    if (ext === 'vgmpack') return 'VGMPACK';
    if (ext === 'vigamup') return 'VIGAMUP';
    return ext ? ext.toUpperCase() : '';
  }

  function isArchive(item) {
    return item.kind === 'archive' || ARCHIVE_EXTS.has(extOf(item.relativePath || item.name || item.url));
  }

  function isArchiveEntry(entry) {
    return entry && (entry.type === 'archive' || entry.type === 'pack');
  }

  function isUnsupported(item) {
    return item.kind === 'unsupported';
  }

  function isImage(item) {
    return item.kind === 'image' || IMAGE_EXTS.has(extOf(item.relativePath || item.name || item.url));
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function dirname(path) {
    const parts = String(path || '').split(/[\\/]/).filter(Boolean);
    parts.pop();
    return parts.join('/');
  }

  function parentPath(path) {
    const dir = dirname(path);
    return dir || 'root';
  }

  function makeId(path) {
    return 'entry:' + String(path || 'root').replace(/[^a-zA-Z0-9_-]+/g, ':');
  }

  class NativeLibraryApp {
    constructor(player) {
      this.player = player;
      this.entries = [];
      this.byId = new Map();
      this.children = new Map();
      this.pageOffsets = {};
      this.selectedId = null;
      this.hoverTimer = null;
      this.searchQuery = '';
      this.matchedIds = null;
      this.playingEntry = null;
      this.progressTimer = null;
      this.fakeProgress = 0;
      this.rootName = 'Music Library';
      this.rootUrl = '';
      this.config = { ...DEFAULT_CONFIG, ...(window.VGMPLAY_NATIVE_CONFIG || {}) };
      this.archiveMetaCache = this.loadArchiveMetaCache();
      this.trackMetaCache = this.loadTrackMetaCache();
      this.infoMode = 'help';
      this.homeRomsLoaded = false;
      this._loadingTrack = false;
      this._playSequence = 0;
      this.mount();
    }

    mount() {
      document.body.classList.add('vgmplayNativeMode');
      this.root = document.createElement('div');
      this.root.className = 'native-app';
      this.root.innerHTML = `
        <div class="native-topbar">
          <div class="native-brand">VGMPlay-JS</div>
          <div class="native-path" data-role="path">No folder selected</div>
          <div class="native-spacer"></div>
          <button class="native-topbar-btn" data-role="scan-archives" title="Scan all archives">Scan Archives</button>
          <button class="native-settings-btn" data-role="settings" title="Settings">Settings</button>
          <div class="native-settings-popover" data-role="settings-popover" hidden>
            <label><input type="checkbox" data-role="show-unsupported" /> Show unsupported files</label>
            <label><input type="checkbox" data-role="show-filenames" /> Show real filenames</label>
            <label><input type="checkbox" data-role="image-overview" /> Show image overview</label>
          </div>
          <input class="native-search" data-role="search" placeholder="Filter tracks, formats, chips..." />
        </div>
        <div class="native-main">
          <div class="native-library">
            <div class="native-panel-title">Library</div>
            <div class="native-tree" data-role="tree"></div>
          </div>
          <div class="native-resizer" data-role="library-resizer" title="Resize library"></div>
          <div class="native-info" data-role="info"></div>
        </div>
        <div class="native-player">
          <button data-role="prev" title="Previous">|<</button>
          <button data-role="play" title="Play/Pause">▶</button>
          <button data-role="stop" title="Stop">■</button>
          <button data-role="next" title="Next">>|</button>
          <span class="native-player-sep"></span>
          <button data-role="bass" title="Bass Boost (B)">B</button>
          <button data-role="reverb" title="Reverb (V)">V</button>
          <button data-role="random" title="Random (R)">R</button>
          <button data-role="loop" title="Loop (L)">L</button>
          <div class="native-now">
            <div class="native-now-title" data-role="now-title">No track selected</div>
            <div class="native-now-source" data-role="now-source"></div>
          </div>
          <span class="native-time" data-role="time-current">0:00</span>
          <div class="native-progress"><div class="native-progress-fill" data-role="progress"></div></div>
          <span class="native-time" data-role="time-total">0:00</span>
          <input class="native-volume" data-role="volume" type="range" min="0" max="100" value="80" />
          <span class="native-time" data-role="status">Idle</span>
        </div>`;
      document.body.appendChild(this.root);
      this.treeEl = this.root.querySelector('[data-role="tree"]');
      this.infoEl = this.root.querySelector('[data-role="info"]');
      this.libraryEl = this.root.querySelector('.native-library');
      this.libraryResizerEl = this.root.querySelector('[data-role="library-resizer"]');
      this.pathEl = this.root.querySelector('[data-role="path"]');
      this.searchEl = this.root.querySelector('[data-role="search"]');
      this.nowTitleEl = this.root.querySelector('[data-role="now-title"]');
      this.nowSourceEl = this.root.querySelector('[data-role="now-source"]');
      this.statusEl = this.root.querySelector('[data-role="status"]');
      this.playBtn = this.root.querySelector('[data-role="play"]');
      this.stopBtn = this.root.querySelector('[data-role="stop"]');
      this.timeCurrentEl = this.root.querySelector('[data-role="time-current"]');
      this.timeTotalEl = this.root.querySelector('[data-role="time-total"]');
      this.progressEl = this.root.querySelector('[data-role="progress"]');
      this.progressTrackEl = this.root.querySelector('.native-progress');
      this.volumeEl = this.root.querySelector('[data-role="volume"]');
      this.prevBtn = this.root.querySelector('[data-role="prev"]');
      this.nextBtn = this.root.querySelector('[data-role="next"]');
      this.bassBtn = this.root.querySelector('[data-role="bass"]');
      this.reverbBtn = this.root.querySelector('[data-role="reverb"]');
      this.randomBtn = this.root.querySelector('[data-role="random"]');
      this.loopBtn = this.root.querySelector('[data-role="loop"]');
      this.scanArchivesBtn = this.root.querySelector('[data-role="scan-archives"]');
      this.settingsBtn = this.root.querySelector('[data-role="settings"]');
      this.settingsPopover = this.root.querySelector('[data-role="settings-popover"]');
      this.showUnsupportedEl = this.root.querySelector('[data-role="show-unsupported"]');
      this.showFilenamesEl = this.root.querySelector('[data-role="show-filenames"]');
      this.imageOverviewEl = this.root.querySelector('[data-role="image-overview"]');
      this.config = { ...DEFAULT_CONFIG, ...(window.VGMPLAY_NATIVE_CONFIG || {}) };
      this.showUnsupportedEl.checked = !!this.config.showUnsupported;
      this.showFilenamesEl.checked = !!this.config.showFilenames;
      this.imageOverviewEl.checked = this.config.imageOverview !== false;
      this.applyLibraryWidth(this.config.libraryWidth);
      this.setupLibraryResizer();
      this.searchEl.addEventListener('input', () => this.setSearch(this.searchEl.value));
      this.treeEl.addEventListener('mouseleave', () => {
        clearTimeout(this.hoverTimer);
        setTimeout(() => this.restorePlayingInfo(), 80);
      });
      this.settingsBtn.addEventListener('click', () => {
        this.settingsPopover.hidden = !this.settingsPopover.hidden;
      });
      if (this.scanArchivesBtn) {
        this.scanArchivesBtn.addEventListener('click', () => this.scanAllArchives());
      }
      this.showUnsupportedEl.addEventListener('change', () => {
        this.config.showUnsupported = !!this.showUnsupportedEl.checked;
        this.saveConfig();
        this.renderTree();
      });
      this.showFilenamesEl.addEventListener('change', () => {
        this.config.showFilenames = !!this.showFilenamesEl.checked;
        this.saveConfig();
        this.renderTree();
      });
      this.imageOverviewEl.addEventListener('change', () => {
        this.config.imageOverview = !!this.imageOverviewEl.checked;
        this.saveConfig();
        if (this.config.imageOverview) this.showImageOverview();
        else this.restorePlayingInfo();
      });
      this.playBtn.addEventListener('click', () => this.togglePlay());
      this.stopBtn.addEventListener('click', () => this.stop());
      if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prevTrack());
      if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextTrack());
      if (this.bassBtn) this.bassBtn.addEventListener('click', () => this.toggleBass());
      if (this.reverbBtn) this.reverbBtn.addEventListener('click', () => this.toggleReverb());
      if (this.randomBtn) this.randomBtn.addEventListener('click', () => this.toggleRandom());
      if (this.loopBtn) this.loopBtn.addEventListener('click', () => this.toggleLoop());
      if (this.volumeEl) {
        this.volumeEl.value = this.config.volume != null ? this.config.volume : 80;
        this.volumeEl.addEventListener('input', () => {
          const vol = Number(this.volumeEl.value) || 0;
          this.config.volume = vol;
          this.applyVolume();
          this.saveConfig();
        });
        this.applyVolume();
      }
      if (this.progressTrackEl) {
        this.progressTrackEl.addEventListener('click', (e) => {
          if (this.player && this.player.loopMode === 1) return;
          if (!this.player || !this.player.trackLengthSeconds) return;
          const rect = this.progressTrackEl.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const targetSec = ratio * this.player.trackLengthSeconds;
          this.seekTo(targetSec);
        });
      }
      document.addEventListener('keydown', (e) => {
        const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (this.settingsPopover && !this.settingsPopover.hidden) {
            this.settingsPopover.hidden = true;
            return;
          }
          if (this.config.imageOverview !== false && this.infoMode !== 'overview') {
            this.showImageOverview();
          } else {
            this.collapseAll();
            this.selectedId = null;
            this.renderTree();
            this.treeEl.scrollTop = 0;
            if (this.config.imageOverview !== false) this.showImageOverview();
            else this.showHelp();
          }
          return;
        }
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.togglePlay();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.prevTrack();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.nextTrack();
          return;
        }
      }, true);
      this._syncPlayStateInterval = setInterval(() => this.syncPlayState(), 500);
      if (this.config.imageOverview !== false) this.showImageOverview();
      else this.showHelp();
    }

    loadIndex(items, options = {}) {
      this.rootName = options.rootName || 'Music Library';
      this.rootUrl = options.rootUrl || '';
      this.pathEl.textContent = this.rootUrl || this.rootName;
      this.pageOffsets = {};
      this.selectedId = null;
      this.buildEntries(Array.isArray(items) ? items : []);
      this.renderTree();
      if (this.config.imageOverview !== false) this.showImageOverview();
      else this.showHelp();
    }

    buildEntries(items) {
      const entries = [{
        id: 'root',
        parentId: null,
        type: 'folder',
        name: this.rootName,
        expanded: true,
        metadata: { status: 'Indexed', items: items.length }
      }];
      const folderIds = new Map([['', 'root']]);
      const sidecarImages = new Map();

      for (const item of items) {
        if (!item || !item.url || !isImage(item)) continue;
        const rel = item.relativePath || item.name || baseName(item.url);
        const key = this.sidecarKey(rel);
        if (!sidecarImages.has(key)) sidecarImages.set(key, item);
      }

      const ensureFolder = (folderPath) => {
        const clean = String(folderPath || '').replace(/^[\\/]+|[\\/]+$/g, '');
        if (!clean) return 'root';
        if (folderIds.has(clean)) return folderIds.get(clean);
        const parts = clean.split(/[\\/]+/);
        const name = parts[parts.length - 1];
        const parent = ensureFolder(parts.slice(0, -1).join('/'));
        const id = makeId('folder:' + clean);
        folderIds.set(clean, id);
        entries.push({
          id,
          parentId: parent,
          type: 'folder',
          name,
          expanded: false,
          metadata: { status: 'Indexed' },
          path: clean
        });
        return id;
      };

      for (const item of items) {
        if (!item || !item.url || (isImage(item) && !isUnsupported(item))) continue;
        const rel = item.relativePath || item.name || baseName(item.url);
        const format = formatOf(item);
        const archive = isArchive(item);
        const unsupported = isUnsupported(item);
        const type = unsupported ? 'unsupported' : (archive ? (format === 'VGMPACK' ? 'pack' : 'archive') : 'track');
        const parent = ensureFolder(parentPath(rel) === 'root' ? '' : parentPath(rel));
        const sizeBytes = item.sizeBytes || 0;
        const sidecar = archive ? this.findSidecarImage(sidecarImages, rel) : null;
        const metadata = {
          title: baseName(rel).replace(/\.[^.]+$/, ''),
          format,
          status: unsupported ? 'Unsupported, opens with default app' : (archive ? 'Indexed, not extracted' : 'Playable'),
          content: (FORMAT_INFO[format] && FORMAT_INFO[format].content) || (unsupported ? 'Unsupported file' : 'Playable audio file'),
          backend: (FORMAT_INFO[format] && FORMAT_INFO[format].backend) || '',
          coverUrl: (item.coverUrl || (sidecar && sidecar.url) || ''),
          compressedSize: archive && sizeBytes ? this.formatSize(sizeBytes) : '',
          container: archive ? '' : dirname(rel),
          estimatedMemory: sizeBytes ? this.formatSize(sizeBytes) : ''
        };
        entries.push({
          id: makeId(rel),
          parentId: parent,
          type,
          name: item.name || baseName(rel),
          format: unsupported ? '' : format,
          playable: !archive && !unsupported,
          inspectable: !unsupported,
          pendingExpandable: !archive && !unsupported && !!(FORMAT_INFO[format] && FORMAT_INFO[format].multiTrack),
          expanded: false,
          metadata,
          warnings: this.warningsFor(item, format),
          item,
          path: rel
        });
      }

      this.entries = entries;
      this.byId = new Map(entries.map((entry) => [entry.id, entry]));
      this.children = new Map();
      for (const entry of entries) {
        if (!entry.parentId) continue;
        if (!this.children.has(entry.parentId)) this.children.set(entry.parentId, []);
        this.children.get(entry.parentId).push(entry);
      }
      for (const list of this.children.values()) {
        list.sort((a, b) => {
          const rank = { folder: 0, archive: 1, pack: 1, archiveGame: 2, archiveTrack: 3, trackPart: 3, track: 4, unsupported: 5 };
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || (rank[a.type] - rank[b.type]);
        });
      }
      for (const entry of Array.from(entries)) {
        if (isArchiveEntry(entry)) this.applyCachedArchivePreview(entry);
        else if (entry.playable) this.applyCachedTrackPreview(entry);
      }
    }

    warningsFor(item, format) {
      const warnings = [];
      const size = item.sizeBytes || 0;
      if ((format === 'VGM' || format === 'VGZ') && size > 1024 * 1024) {
        warnings.push('Large VGM may exceed original target memory.');
      }
      if (isArchive(item) && size > 1024 * 1024 * 1024) {
        warnings.push('Large archive over 1 GB. Extraction should be confirmed.');
      }
      return warnings;
    }

    setSearch(query) {
      this.searchQuery = String(query || '').toLowerCase().trim();
      if (!this.searchQuery) {
        this.matchedIds = null;
      } else {
        this.matchedIds = new Set();
        for (const entry of this.entries) {
          if (this.matches(entry, this.searchQuery)) {
            let cur = entry;
            while (cur) {
              this.matchedIds.add(cur.id);
              cur = cur.parentId ? this.byId.get(cur.parentId) : null;
            }
          }
        }
      }
      this.renderTree();
    }

    matches(entry, query) {
      const m = entry.metadata || {};
      const hay = [entry.name, entry.format, entry.type, m.title, m.format, m.status, m.content, m.backend, m.container, m.game, m.chip, m.estimatedMemory, ...(entry.warnings || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(query);
    }

    renderTree() {
      this.treeEl.innerHTML = '';
      this.renderChildren('root', 0, this.treeEl);
      if (!this.treeEl.children.length) {
        const empty = document.createElement('div');
        empty.className = 'native-help';
        empty.textContent = this.entries.length ? 'No matching entries.' : 'Choose File > Open Folder to load a local library.';
        this.treeEl.appendChild(empty);
      }
    }

    renderChildren(parentId, depth, container) {
      const list = this.visibleChildren(parentId);
      const total = list.length;
      const offset = this.pageOffsets[parentId] || 0;
      const shouldPaginate = parentId !== 'root' && total > PAGE_SIZE;
      const page = shouldPaginate ? list.slice(offset, offset + PAGE_SIZE) : list;
      for (const entry of page) this.renderRow(entry, depth, container);
      if (shouldPaginate) this.renderPager(parentId, depth, total, offset, container);
    }

    visibleChildren(parentId) {
      let list = this.children.get(parentId) || [];
      list = list.filter((entry) => !entry.hidden);
      if (!this.config.showUnsupported) {
        list = list.filter((entry) => entry.type !== 'unsupported');
      }
      if (this.matchedIds) list = list.filter((entry) => this.matchedIds.has(entry.id));

      list = Array.from(list);
      const rank = { folder: 0, archive: 1, pack: 1, archiveGame: 2, archiveTrack: 3, trackPart: 3, track: 4, unsupported: 5 };
      list.sort((a, b) => {
        const nameA = this.displayNameFor(a);
        const nameB = this.displayNameFor(b);
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' }) || (rank[a.type] - rank[b.type]);
      });
      return list;
    }

    renderRow(entry, depth, container) {
      const row = document.createElement('div');
      const isMultiTrack = entry.format && FORMAT_INFO[entry.format] && FORMAT_INFO[entry.format].multiTrack;
      const displayType = isMultiTrack ? 'archive' : entry.type;
      const isInspecting = this.isAncestorInspecting(entry);
      row.className = `native-row ${displayType}${entry.id === this.selectedId ? ' selected' : ''}${entry.warnings && entry.warnings.length ? ' warn' : ''}${isInspecting ? ' disabled-inspecting' : ''}`;
      const displayName = this.displayNameFor(entry);
      const duration = entry.metadata && entry.metadata.duration ? entry.metadata.duration : '';
      row.innerHTML = `
        <span class="native-indent" style="width:${depth * 16}px"></span>
        <span class="native-expander">${this.hasChildren(entry) ? (entry.expanded ? '&#9662;' : '&#9656;') : ''}</span>
        <span class="native-name">${escapeHtml(displayName)}</span>
        ${duration ? `<span class="native-duration">${escapeHtml(duration)}</span>` : ''}
        ${this.renderFormatBadges(entry)}
        ${entry.warnings && entry.warnings.length ? '<span class="native-warning-mark">!</span>' : ''}`;
      row.dataset.entryId = entry.id;
      row.addEventListener('mouseenter', () => this.hover(entry));
      row.addEventListener('mouseleave', () => clearTimeout(this.hoverTimer));
      row.addEventListener('click', () => this.select(entry));
      row.addEventListener('dblclick', () => this.open(entry));
      container.appendChild(row);
      if (entry.expanded) this.renderChildren(entry.id, depth + 1, container);
    }

    renderPager(parentId, depth, total, offset, container) {
      const row = document.createElement('div');
      row.className = 'native-pager';
      const start = offset + 1;
      const end = Math.min(offset + PAGE_SIZE, total);
      row.innerHTML = `<span class="native-indent" style="width:${depth * 16}px"></span><span>${start}-${end} of ${total}</span>`;
      const prev = document.createElement('button');
      prev.textContent = '< Prev';
      prev.disabled = offset <= 0;
      prev.addEventListener('click', () => { this.pageOffsets[parentId] = Math.max(0, offset - PAGE_SIZE); this.renderTree(); });
      row.appendChild(prev);
      const next = document.createElement('button');
      next.textContent = 'Next >';
      next.disabled = offset + PAGE_SIZE >= total;
      next.addEventListener('click', () => { this.pageOffsets[parentId] = offset + PAGE_SIZE; this.renderTree(); });
      row.appendChild(next);
      container.appendChild(row);
    }

    hasChildren(entry) {
      return (this.children.get(entry.id) || []).length > 0 || !!entry.pendingExpandable;
    }

    renderFormatBadges(entry) {
      const values = [];
      if (entry.innerFormats && entry.innerFormats.length) {
        for (const format of entry.innerFormats) values.push(format);
      } else if (entry.innerFormat) {
        values.push(entry.innerFormat);
      }
      if (entry.format) values.push(entry.format);
      const unique = [];
      for (const value of values) {
        if (value && !unique.includes(value)) unique.push(value);
      }
      return unique.slice(0, 4).map((format) => `<span class="native-badge ${BADGE_CLASS[format] || ''}">${escapeHtml(format)}</span>`).join('');
    }

    hover(entry) {
      clearTimeout(this.hoverTimer);
      this._lastHoveredEntry = entry;
      this.hoverTimer = setTimeout(() => {
        if (this.infoMode === 'overview') return;
        this.showInfo(entry);
        if (isArchiveEntry(entry)) {
          return;
        } else if (entry.inspectable && (entry.item.sizeBytes || 0) < 100 * 1024 * 1024) {
          this.inspectEntry(entry, { expand: false });
        }
      }, 140);
    }

    restorePlayingInfo() {
      this._lastHoveredEntry = null;
      if (this.playingEntry) this.showInfo(this.playingEntry);
      else if (this.config.imageOverview !== false) this.showImageOverview();
      else this.showHelp();
    }

    select(entry) {
      if (this.isAncestorInspecting(entry)) return;
      this.selectedId = entry.id;
      this.showInfo(entry);
      if (entry.playable && this.hasChildren(entry)) {
        const children = this.children.get(entry.id) || [];
        if (entry.pendingExpandable && !children.length) {
          this.inspectEntry(entry, { expand: true });
        } else {
          entry.expanded = !entry.expanded;
          if (entry.expanded && !(entry.id in this.pageOffsets)) this.pageOffsets[entry.id] = 0;
        }
      } else if (isArchiveEntry(entry)) {
        this.inspectArchive(entry, { expand: !this.hasChildren(entry) });
      } else if (entry.inspectable) {
        this.inspectEntry(entry, { expand: true });
      }
      if (!entry.playable && this.hasChildren(entry)) {
        entry.expanded = !entry.expanded;
        if (entry.expanded && !(entry.id in this.pageOffsets)) this.pageOffsets[entry.id] = 0;
      }
      this.renderTree();
    }

    open(entry) {
      if (this.isAncestorInspecting(entry)) return;
      if (entry.playable) {
        this.playEntry(entry);
        return;
      }
      if (entry.type === 'unsupported') {
        this.openExternal(entry);
        return;
      }
      if (isArchiveEntry(entry)) {
        this.inspectArchive(entry, { expand: true });
        return;
      }
      if (this.hasChildren(entry)) {
        entry.expanded = !entry.expanded;
        if (entry.expanded && !(entry.id in this.pageOffsets)) this.pageOffsets[entry.id] = 0;
        this.renderTree();
      }
    }

    showHelp() {
      this.infoMode = 'help';
      this.infoEl.innerHTML = '<div class="native-help"><strong>Welcome to VGMPlay-JS</strong><br>Open a local folder, hover entries to inspect metadata, double-click playable tracks to load and play, and use search to filter by path or format.<br><br>Keyboard: Space = play/pause, Arrow keys = prev/next, Escape = back.</div>';
    }

    showImageOverview() {
      this.infoMode = 'overview';
      const entries = this.entries.filter((entry) => {
        if (!entry || entry.id === 'root' || entry.type === 'folder') return false;
        if (entry.parentId !== 'root') return false;
        if (entry.type === 'archiveTrack' || entry.type === 'trackPart') return false;
        const m = entry.metadata || {};
        return !!(m.coverDataUrl || m.coverUrl);
      });
      if (!entries.length) {
        this.infoEl.innerHTML = '<div class="native-help"><strong>No pack images indexed yet</strong><br>Images from sidecar files and cached archive metadata will appear here.</div>';
        return;
      }
      this.infoEl.innerHTML = `
        <div class="native-overview">
          <div class="native-section-title">Indexed Images</div>
          <div class="native-overview-grid">
            ${entries.map((entry) => {
              const m = entry.metadata || {};
              const src = m.coverDataUrl || m.coverUrl || '';
              const title = m.gameTitle || m.game || m.title || entry.name;
              const subtitle = entry.innerFormat ? `${entry.innerFormat} / ${entry.format || ''}` : (entry.format || entry.type);
              return `<button class="native-cover-tile" data-entry-id="${escapeHtml(entry.id)}"><img src="${escapeHtml(src)}" alt=""><div class="native-cover-title">${escapeHtml(title)}</div><div class="native-cover-subtitle">${escapeHtml(subtitle)}</div></button>`;
            }).join('')}
          </div>
        </div>`;
      this.infoEl.querySelectorAll('.native-cover-tile').forEach((tile) => {
        tile.addEventListener('click', () => {
          const entry = this.byId.get(tile.dataset.entryId);
          if (entry) this.openFromOverview(entry);
        });
      });
    }

    showInfo(entry) {
      this.infoMode = 'detail';
      const m = entry.metadata || {};
      const statusClass = (entry.warnings && entry.warnings.length) ? 'warning' : (m.status && m.status.indexOf('Playable') >= 0 ? 'playable' : '');
      const title = m.trackTitle || m.title || entry.name;
      const coverSrc = m.coverDataUrl || m.coverUrl || '';
      this.infoEl.innerHTML = `
        ${coverSrc ? `<div class="native-cover-wrap"><img class="native-cover" src="${escapeHtml(coverSrc)}" alt=""></div>` : ''}
        <div class="native-section">
          <div class="native-section-title">Header</div>
          <div class="native-title">${escapeHtml(title)} ${entry.format ? `<span class="native-badge ${BADGE_CLASS[entry.format] || ''}">${escapeHtml(entry.format)}</span>` : ''}</div>
          <div class="native-status ${statusClass}">${escapeHtml(m.status || '')}</div>
        </div>
        <div class="native-section">
          <div class="native-section-title">Source</div>
          ${this.infoRow('Type', entry.type)}
          ${entry.format ? this.infoRow('Format', entry.format) : ''}
          ${this.infoRow('Content', m.content || '')}
          ${this.infoRow('Backend', m.backend || '')}
          ${this.infoRow('Tracks', m.trackCount ? String(m.trackCount) : '')}
          ${this.infoRow('SHA-256', m.sha256 ? String(m.sha256).substring(0, 16) + '...' : '')}
          ${m.compressedSize ? this.infoRow('Compressed size', m.compressedSize) : ''}
          ${m.container ? this.infoRow('Container', m.container) : ''}
          <div class="native-info-path">${escapeHtml(this.pathFor(entry))}</div>
        </div>
        <div class="native-section">
          <div class="native-section-title">Audio Metadata</div>
          ${this.infoRow('Format', m.format || entry.format || '')}
          ${this.infoRow('Game', m.game || '')}
          ${this.infoRow('Title', m.trackTitle || '')}
          ${this.infoRow('System', m.system || '')}
          ${this.infoRow('Author', m.author || '')}
          ${this.infoRow('Date', m.date || '')}
          ${this.infoRow('VGM Creator', m.creator || '')}
          ${this.infoRow('Chip / engine', m.chip || '')}
          ${this.infoRow('Duration', m.duration || '')}
          ${this.infoRow('Loop', m.loop || '')}
          ${this.infoRow('Estimated memory', m.estimatedMemory || '')}
        </div>
        ${m.comments ? `<div class="native-section"><div class="native-section-title">Comments</div><div class="native-comments">${escapeHtml(m.comments)}</div></div>` : ''}
        ${this.renderWarnings(entry)}`;
    }

    infoRow(key, value) {
      if (!value) return '';
      return `<div class="native-info-row"><span class="native-info-key">${escapeHtml(key)}</span><span class="native-info-value">${escapeHtml(value)}</span></div>`;
    }

    renderWarnings(entry) {
      if (!entry.warnings || !entry.warnings.length) return '';
      return `<div class="native-section"><div class="native-section-title">Warnings</div>${entry.warnings.map((w) => `<div class="native-alert"><span>!</span><span>${escapeHtml(w)}</span></div>`).join('')}</div>`;
    }

    pathFor(entry) {
      const names = [];
      let cur = entry;
      while (cur) {
        names.unshift(cur.name);
        cur = cur.parentId ? this.byId.get(cur.parentId) : null;
      }
      return names.join(' / ');
    }

    expandAncestors(entry) {
      let child = entry;
      let cur = entry && entry.parentId ? this.byId.get(entry.parentId) : null;
      while (cur) {
        cur.expanded = true;
        if (cur.id !== 'root') {
          const list = this.visibleChildren(cur.id);
          const childIndex = list.findIndex((e) => e.id === child.id);
          if (childIndex >= 0) {
            const offset = Math.floor(childIndex / PAGE_SIZE) * PAGE_SIZE;
            this.pageOffsets[cur.id] = offset;
          }
        }
        child = cur;
        cur = cur.parentId ? this.byId.get(cur.parentId) : null;
      }
    }

    collapseAll() {
      for (const entry of this.entries) {
        if (entry.id !== 'root') entry.expanded = false;
      }
      this.pageOffsets = {};
    }

    scrollEntryIntoView(entry) {
      if (!entry) return;
      requestAnimationFrame(() => {
        const selector = `[data-entry-id="${CSS.escape(entry.id)}"]`;
        const node = this.treeEl.querySelector(selector);
        if (node) node.scrollIntoView({ block: 'center' });
      });
    }

    async openFromOverview(entry) {
      this.selectedId = entry.id;
      this.expandAncestors(entry);
      if (isArchiveEntry(entry)) {
        this.resetPageOffsetsForSubtree(entry.id);
        await this.inspectArchive(entry, { expand: true });
        const first = this.firstPlayableInSubtree(entry.id);
        if (first) {
          this.resetPageOffsetsForSubtree(entry.id);
          this.expandAncestors(first);
        }
        this.renderTree();
        this.scrollEntryIntoView(first || entry);
        if (first) this.playEntry(first);
        else this.showInfo(entry);
        return;
      }
      if (this.hasChildren(entry)) entry.expanded = true;
      this.renderTree();
      this.scrollEntryIntoView(entry);
      if (entry.playable) this.playEntry(entry);
      else this.showInfo(entry);
    }

    resetPageOffsetsForSubtree(parentId) {
      delete this.pageOffsets[parentId];
      const children = this.children.get(parentId) || [];
      for (const child of children) {
        delete this.pageOffsets[child.id];
        if (this.hasChildren(child)) this.resetPageOffsetsForSubtree(child.id);
      }
    }

    firstPlayableInSubtree(parentId) {
      for (const entry of this.visibleChildren(parentId)) {
        if (entry.playable) return entry;
        if (this.hasChildren(entry)) {
          const nested = this.firstPlayableInSubtree(entry.id);
          if (nested) return nested;
        }
      }
      return null;
    }

    sidecarKey(path) {
      const dir = dirname(path);
      const name = baseName(path).replace(/\.[^.]+$/, '').toLowerCase();
      return (dir ? dir + '/' : '') + name;
    }

    sidecarKeysForArchive(path) {
      const dir = dirname(path);
      const prefix = dir ? dir + '/' : '';
      const keys = [];
      let name = baseName(path).toLowerCase();
      while (name.includes('.')) {
        name = name.replace(/\.[^.]+$/, '');
        keys.push(prefix + name);
        const tail = extOf(name);
        if (!ARCHIVE_EXTS.has(tail)) break;
      }
      return keys;
    }

    findSidecarImage(sidecarImages, archivePath) {
      for (const key of this.sidecarKeysForArchive(archivePath)) {
        if (sidecarImages.has(key)) return sidecarImages.get(key);
      }
      return null;
    }

    async playEntry(entry) {
      if (!entry || !entry.item || !entry.item.url) return;
      if (this.isAncestorInspecting(entry)) return;
      this._manualStopRequested = false;
      this.selectedId = entry.id;
      this.playingEntry = entry;
      this.expandAncestors(entry);
      this.statusEl.textContent = 'Loading';
      const m = entry.metadata || {};
      const showGameNames = !this.config.showFilenames;
      let nowTitle = entry.name;
      if (showGameNames) {
        if (m.trackTitle) nowTitle = m.trackTitle;
        else if (m.game) nowTitle = m.game;
      }
      this.nowTitleEl.textContent = nowTitle;
      this.nowSourceEl.textContent = this.pathFor(entry);
      this.renderTree();

      this._playSequence = (this._playSequence || 0) + 1;
      const seq = this._playSequence;
      this._loadingTrack = true;

      try {
        if (entry.type === 'archiveTrack') {
          await this.cushionCurrentPlayback();
          if (this._playSequence !== seq) return;
        }
        const path = await this.ensureEntryInFs(entry);
        if (this._playSequence !== seq) return;
        const playPath = entry.trackPath || path;
        await this.player.checkEverythingReady();
        if (this._playSequence !== seq) return;
        await this.preloadNativeHomeRoms();
        if (this._playSequence !== seq) return;
        this.player._nativeLibraryApp = this;
        const noticeStart = Array.isArray(this.player.noPlayableNotices) ? this.player.noPlayableNotices.length : 0;
        const game = {
          files: entry.archiveGameFiles || [{ filepath: path }],
          path: dirname(path),
          name: dirname(entry.path) || this.rootName,
          nativeCoverUrl: entry.metadata && (entry.metadata.coverDataUrl || entry.metadata.coverUrl || ''),
          playableList: [{ filepath: playPath, title: entry.name, lengthSec: entry.metadata && entry.metadata.lengthSec }]
        };
        this.player.games = [game];
        this.player.activeGame = game;
        await this.player.playFileFromFS(false, playPath, 1, 0);
        if (this._playSequence !== seq) return;
        const notice = this.latestPlaybackNotice(noticeStart);
        if (notice) throw new Error(notice);
        if (!this.player.isVGMPlaying) {
          throw new Error(this.latestPlaybackNotice(noticeStart) || 'Playback did not start');
        }
        this._nativeEndedKey = '';
        this.applyVolume();
        setTimeout(() => {
          if (this._playSequence === seq) this.applyVolume();
        }, 80);
        entry.metadata = { ...(entry.metadata || {}), loop: this.loopStatusLabel() };
        this.showInfo(entry);
        this.statusEl.textContent = 'Playing';
        this.playBtn.textContent = 'II';
        this.playBtn.classList.add('active');
        this.startFakeProgress();
      } catch (e) {
        if (this._playSequence !== seq) return;
        console.error('[VGM Native] Failed to play local entry', e);
        this._manualStopRequested = true;
        if (this.player && this.player.stop) this.player.stop();
        const message = this.nativePlaybackErrorMessage(e && e.message ? e.message : 'Playback failed');
        this.statusEl.textContent = 'Failed';
        this.playBtn.textContent = '▶';
        this.playBtn.classList.remove('active');
        entry.metadata = { ...(entry.metadata || {}), status: message };
        entry.warnings = Array.from(new Set([...(entry.warnings || []), message]));
        this.showInfo(entry);
      } finally {
        if (this._playSequence === seq) {
          this._loadingTrack = false;
        }
      }
    }

    nativePlaybackErrorMessage(message) {
      const text = String(message || '');
      if (/yrw801\.rom|YMF278B|OPL4/i.test(text)) {
        return 'YMF278B (OPL4) playback requires the ROM file yrw801.rom.\n\nPut yrw801.rom in the root of the current directory or in your home folder, then restart or reopen the folder.';
      }
      if (/waves\.dat|MoonSound/i.test(text)) {
        return 'MoonSound playback requires the file waves.dat.\n\nPut waves.dat in the root of the current directory or in your home folder, then restart or reopen the folder.';
      }
      return text;
    }

    async cushionCurrentPlayback(buffers = 12) {
      const p = this.player;
      if (!p || !p.workletNode || !p.generateBuffer || !p.isVGMPlaying || p.isPlaybackPaused || p._isLoadingFile) return;
      try {
        if (p._checkTrackEnd) p._checkTrackEnd();
        if (p.VGMEnded && p.VGMEnded()) return;
      } catch (e) {
        return;
      }
      for (let i = 0; i < buffers; i++) {
        try {
          if (!p.isVGMPlaying || p.isPlaybackPaused || (p.VGMEnded && p.VGMEnded())) break;
          const buf = p.generateBuffer();
          p.workletNode.port.postMessage({
            type: 'buffer',
            left: buf.left,
            right: buf.right
          }, [buf.left.buffer, buf.right.buffer]);
        } catch (e) {
          break;
        }
        if (i % 4 === 3) await this.yieldToUI();
      }
    }

    async preloadNativeHomeRoms() {
      if (this.homeRomsLoaded) return;
      this.homeRomsLoaded = true;
      const roms = Array.isArray(window.VGMPLAY_NATIVE_HOME_ROMS) ? window.VGMPLAY_NATIVE_HOME_ROMS : [];
      if (!roms.length || !this.player || !this.player.saveRomFile) return;
      await this.player.checkEverythingReady();
      for (const rom of roms) {
        try {
          const bytes = await this.fetchBytes(rom.url);
          const romType = this.player._getRomType ? this.player._getRomType(rom.name) : null;
          if (romType) this.player.saveRomFile(bytes, rom.name, romType);
        } catch (e) {
          console.warn('[VGM Native] Failed to preload ROM', rom && rom.name, e);
        }
      }
    }

    latestPlaybackNotice(startIndex = 0) {
      const notices = this.player && this.player.noPlayableNotices;
      if (!Array.isArray(notices) || !notices.length) return '';
      const fresh = notices.slice(Math.max(0, startIndex));
      for (let i = fresh.length - 1; i >= 0; i--) {
        const msg = String(fresh[i] || '');
        if (/yrw801\.rom|waves\.dat|MT32_/i.test(msg)) {
          const normalized = this.nativePlaybackErrorMessage(msg);
          const originalIndex = Math.max(0, startIndex) + i;
          if (normalized !== msg) notices[originalIndex] = normalized;
          return normalized;
        }
      }
      return '';
    }

    async inspectEntry(entry, options = {}) {
      if (!entry || !entry.inspectable || entry.inspecting || entry.type === 'trackPart') return;
      if (entry.inspected && !options.force) {
        if (options.expand && this.hasChildren(entry)) {
          entry.expanded = true;
          this.renderTree();
        }
        this.showInfo(entry);
        return;
      }
      entry.inspecting = true;
      entry.metadata = { ...(entry.metadata || {}), status: 'Inspecting...' };
      this.showInfo(entry);
      try {
        const path = await this.ensureEntryInFs(entry);
        await this.player.checkEverythingReady();
        const metadata = { ...(entry.metadata || {}), status: 'Playable' };
        const title = this.readTag(path, 0);
        const game = this.readTag(path, 2);
        const system = this.readTag(path, 4);
        const author = this.readTag(path, 6);
        const date = this.readTag(path, 8);
        const creator = this.readTag(path, 9);
        const comments = this.readTag(path, 10);
        const length = this.readLength(path);
        if (title) metadata.trackTitle = title;
        if (game) metadata.game = game;
        if (system) metadata.system = system;
        if (author) metadata.author = author;
        if (date) metadata.date = date;
        if (creator) metadata.creator = creator;
        if (comments) metadata.comments = comments;
        if (length) {
          metadata.lengthSec = length;
          metadata.duration = this.formatTime(length);
        }
        metadata.chip = metadata.chip || this.chipLabel(entry.format);

        const tracks = this.inspectMultiTrack(entry, path);
        entry.pendingExpandable = false;
        if (tracks.length) {
          metadata.trackCount = tracks.length;
          entry.expanded = !!options.expand;
          this.replaceChildren(entry.id, tracks);
        } else {
          metadata.trackCount = metadata.trackCount || '';
        }
        entry.metadata = metadata;
        entry.inspected = true;
        this.saveTrackMetadata(entry);
      } catch (e) {
        console.error('[VGM Native] Failed to inspect local entry', e);
        entry.metadata = { ...(entry.metadata || {}), status: 'Metadata unavailable' };
      } finally {
        entry.inspecting = false;
        this.showInfo(entry);
        this.renderTree();
      }
    }

    async inspectArchive(entry, options = {}) {
      if (!isArchiveEntry(entry) || entry.archiveInspecting) return;
      if (entry.archiveVerified && entry.archiveInspected && !options.force) {
        if (options.expand) entry.expanded = true;
        this.renderTree();
        this.showInfo(entry);
        return;
      }

      entry.archiveInspecting = true;
      entry.metadata = { ...(entry.metadata || {}), status: 'Hashing archive...' };
      this.statusEl.textContent = 'Hashing archive';
      this.showInfo(entry);
      try {
        await this.cushionCurrentPlayback(20);
        const originalBytes = await this.fetchBytes(entry.item.url);
        const sha = await this.sha256Hex(originalBytes);
        const cached = this.archiveMetaCache.packsBySha[sha];
        if (cached && !options.force && (!options.fullIndex || !cached.lightIndex)) {
          this.applyArchiveMetadata(entry, cached, { expand: !!options.expand, verified: true });
          this.rememberArchiveQuickKey(entry, sha);
          this.saveArchiveMetaCache();
          this.statusEl.textContent = 'Archive ready';
          return;
        }

        entry.metadata = { ...(entry.metadata || {}), status: 'Indexing archive in background...', sha256: sha };
        this.statusEl.textContent = 'Indexing archive';
        this.showInfo(entry);
        let lightIndex = this.shouldUseLightArchiveIndex() && !options.force && !options.fullIndex && formatOf(entry) !== 'VIGAMUP';
        let result = await this.extractArchive(entry, originalBytes, { metadataOnly: lightIndex });
        if (result.metadataOnly && this.isVigamupArchiveShape(entry, result.entries || [])) {
          lightIndex = false;
          result = await this.extractArchive(entry, originalBytes, { metadataOnly: false });
        }
        entry.archiveFiles = result.metadataOnly ? null : result.fileDataByPath;
        const metadata = await this.buildArchiveMetadata(entry, result, sha, { lightIndex });
        if (!metadata.lightIndex) {
          this.archiveMetaCache.packsBySha[sha] = metadata;
          this.rememberArchiveQuickKey(entry, sha);
          this.saveArchiveMetaCache();
        }
        this.applyArchiveMetadata(entry, metadata, { expand: !!options.expand, verified: true });
        this.statusEl.textContent = 'Archive ready';
      } catch (e) {
        console.error('[VGM Native] Failed to inspect archive', e);
        entry.metadata = { ...(entry.metadata || {}), status: 'Archive metadata unavailable' };
        this.statusEl.textContent = 'Archive failed';
      } finally {
        entry.archiveInspecting = false;
        this.showInfo(entry);
        this.renderTree();
      }
    }

    async scanAllArchives() {
      if (this._scanningArchives) return;
      const archives = this.entries.filter((entry) => isArchiveEntry(entry) && !entry.hidden);
      if (!archives.length) {
        this.statusEl.textContent = 'No archives';
        return;
      }
      this._scanningArchives = true;
      if (this.scanArchivesBtn) {
        this.scanArchivesBtn.disabled = true;
        this.scanArchivesBtn.textContent = 'Scanning...';
      }
      let scanned = 0;
      let skipped = 0;
      try {
        for (let i = 0; i < archives.length; i++) {
          const entry = archives[i];
          if (entry.archiveVerified && entry.archiveInspected && !entry.archiveLightIndex) {
            skipped++;
            continue;
          }
          this.selectedId = entry.id;
          entry.metadata = { ...(entry.metadata || {}), status: `Scanning archive ${i + 1} of ${archives.length}` };
          this.statusEl.textContent = `Scanning ${i + 1}/${archives.length}`;
          this.showInfo(entry);
          this.renderTree();
          try {
            await this.inspectArchive(entry, { expand: false, fullIndex: true });
            scanned++;
          } catch (e) {
            console.warn('[VGM Native] Scan all archives skipped failed archive', entry && entry.name, e);
          }
          await this.yieldToUI();
        }
        this.statusEl.textContent = scanned ? `Scanned ${scanned}` : `Archives ready`;
        if (skipped && scanned) this.statusEl.textContent = `Scanned ${scanned}, skipped ${skipped}`;
      } finally {
        this._scanningArchives = false;
        if (this.scanArchivesBtn) {
          this.scanArchivesBtn.disabled = false;
          this.scanArchivesBtn.textContent = 'Scan Archives';
        }
        this.renderTree();
      }
    }

    async extractArchive(entry, bytes, options = {}) {
      await this.player.checkEverythingReady();
      if (!this.player._extractArchiveWithWorker) throw new Error('Archive worker unavailable');
      const ext = extOf(entry.path || entry.name);
      const kind = ext === 'rar' ? 'rar' : (ext === '7z' ? '7z' : 'zip');
      return this.player._extractArchiveWithWorker(new Uint8Array(bytes), kind, entry.name || entry.path || 'archive', options);
    }

    async buildArchiveMetadata(entry, result, sha, options = {}) {
      const entries = result.entries || [];
      const fileDataByPath = result.fileDataByPath || new Map();
      const metadataOnly = !!result.metadataOnly;
      const tracks = [];
      const games = [];
      const unsupported = [];
      const support = [];
      let cover = null;
      const archiveTitle = baseName(entry.path).replace(/\.[^.]+$/, '');
      const archiveBase = archiveTitle.toLowerCase();
      const root = `/native-archives/${sha}`;
      await this.player.checkEverythingReady();
      const lightIndex = !!options.lightIndex || metadataOnly;

      const imageCandidates = [];
      const addUnsupported = (rel, data) => {
        if (!rel || this.isPlayablePath(rel) || this.isImagePath(rel) || this.isArchiveSupportPath(rel)) return;
        unsupported.push({
          path: rel,
          name: baseName(rel),
          format: formatOf({ name: rel }),
          metadata: {
            title: baseName(rel),
            status: 'Unsupported inside archive',
            content: 'Unsupported file',
            container: dirname(rel),
            estimatedMemory: data && data.length ? this.formatSize(data.length) : ''
          }
        });
      };
      for (const archiveEntry of entries) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : '';
        const lower = rel.toLowerCase();
        const data = fileDataByPath.get(rel);
        if (!rel) continue;
        if (this.isImagePath(lower) && data) imageCandidates.push({ rel, lower, data });
        if (lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo') || lower.endsWith('.m3u')) {
          support.push({ path: rel, sizeBytes: data ? data.length : 0 });
        }
        if (data || metadataOnly) addUnsupported(rel, data);
      }
      cover = await this.pickArchiveCover(imageCandidates, archiveBase);

      if (!metadataOnly) {
        const vigamupMeta = await this.buildVigamupMetadata(entry, entries, fileDataByPath, root, archiveTitle, archiveBase, sha);
        if (vigamupMeta) return { ...vigamupMeta, unsupported };
      }

      let index = 0;
      for (const archiveEntry of entries) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : '';
        const data = fileDataByPath.get(rel);
        if (!rel || (!data && !lightIndex)) continue;
        if (!this.isPlayablePath(rel)) {
          continue;
        }
        if (lightIndex) {
          const format = formatOf({ name: rel });
          const info = FORMAT_INFO[format] || {};
          const name = baseName(rel);
          if (this.isKssFormat(format)) {
            const gameTitle = name.replace(/\.[^.]+$/, '');
            const kssTracks = this.kssArchiveTracks(rel, format, gameTitle, {
              status: 'Playable',
              format,
              content: info.content || 'MSX/SMS music container',
              backend: info.backend || 'KSS',
              chip: info.backend || format || '',
              container: rel
            });
            games.push({
              name: gameTitle,
              path: rel,
              format,
              trackCount: kssTracks.length,
              tracks: kssTracks
            });
            tracks.push(...kssTracks);
            index += kssTracks.length;
            if (index % 100 === 0) await this.yieldToUI();
            continue;
          }
          tracks.push({
            path: rel,
            name,
            format,
            metadata: {
              title: name.replace(/\.[^.]+$/, ''),
              status: 'Playable',
              format,
              content: info.content || 'Playable audio file',
              backend: info.backend || '',
              chip: info.backend || format || '',
              container: dirname(rel)
            }
          });
          index++;
          if (index % 100 === 0) await this.yieldToUI();
          continue;
        }
        const fsPath = `${root}/${rel}`.replace(/[\\]+/g, '/');
        this.writeBytesToFs(fsPath, data);
        const trackMeta = this.metadataForPath(fsPath, rel);
        const format = formatOf({ name: rel });
        if (this.isKssFormat(format)) {
          const gameTitle = trackMeta.game || trackMeta.trackTitle || trackMeta.title || baseName(rel).replace(/\.[^.]+$/, '');
          const kssTracks = this.kssArchiveTracks(rel, format, gameTitle, {
            ...trackMeta,
            container: rel
          }, fsPath);
          games.push({
            name: gameTitle,
            path: rel,
            format,
            trackCount: kssTracks.length,
            tracks: kssTracks
          });
          tracks.push(...kssTracks);
          index += kssTracks.length;
          if (index % 25 === 0) await this.yieldToUI();
          continue;
        }
        const containerTracks = this.inspectMultiTrack({ format: formatOf({ name: rel }), type: 'archiveTrackSource' }, fsPath);
        if (containerTracks.length) {
          for (const part of containerTracks) {
            tracks.push({
              path: rel,
              trackPathSuffix: part.trackPath.substring(fsPath.length),
              name: part.name,
              format: formatOf({ name: rel }),
              metadata: { ...trackMeta, ...part.metadata, container: rel }
            });
          }
        } else {
          tracks.push({
            path: rel,
            name: trackMeta.trackTitle || baseName(rel),
            format: formatOf({ name: rel }),
            metadata: trackMeta
          });
        }
        index++;
        if (index % 25 === 0) await this.yieldToUI();
      }

      return {
        version: ARCHIVE_META_VERSION,
        sha256: sha,
        title: games.length ? archiveTitle : this.bestArchiveTitle(archiveTitle, tracks),
        archiveName: entry.name,
        innerFormat: this.commonTrackFormat(tracks),
        sizeBytes: entry.item.sizeBytes || 0,
        mtime: entry.item.mtime || 0,
        trackCount: tracks.length,
        coverDataUrl: cover ? cover.dataUrl : '',
        coverPath: cover ? cover.path : '',
        innerFormats: this.topTrackFormats(tracks, 4),
        lightIndex,
        support,
        tracks,
        games,
        unsupported
      };
    }

    kssArchiveTracks(rel, format, gameTitle, baseMetadata = {}, fsPath = '') {
      const tracks = [];
      for (let i = 0; i < 255; i++) {
        let title = `Track ${i + 1}`;
        if (fsPath && this.player.GetKSSTrackNameDirect) {
          try { title = this.player.GetKSSTrackNameDirect(fsPath, i) || title; } catch (e) {}
        }
        tracks.push({
          path: rel,
          trackPathSuffix: `|track=${i}`,
          name: title,
          format,
          metadata: {
            ...baseMetadata,
            title,
            trackTitle: title,
            game: gameTitle,
            status: 'Playable',
            container: rel,
            trackNumber: i + 1
          }
        });
      }
      return tracks;
    }

    shouldUseLightArchiveIndex() {
      const p = this.player;
      return !!(p && p.isVGMPlaying && !p.isPlaybackPaused);
    }

    async buildVigamupMetadata(entry, entries, fileDataByPath, root, archiveTitle, archiveBase, sha) {
      const entryFormat = formatOf(entry);
      const kssFiles = [];
      const infoByStem = new Map();
      const tracksByStem = new Map();
      const imagesByStem = new Map();
      for (const archiveEntry of entries) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : '';
        const data = fileDataByPath.get(rel);
        if (!rel || !data) continue;
        const lower = rel.toLowerCase();
        const stem = baseName(rel).replace(/\.[^.]+$/, '').toLowerCase();
        if (lower.endsWith('.kss') || lower.endsWith('.kssx') || lower.endsWith('.kscc')) kssFiles.push(rel);
        else if (lower.endsWith('.gameinfo')) infoByStem.set(stem, this.decodeText(data));
        else if (lower.endsWith('.trackinfo')) tracksByStem.set(stem, this.decodeText(data));
        else if (this.isImagePath(lower)) imagesByStem.set(stem, { rel, data });
      }
      if (!kssFiles.length) return null;
      const flatVigamupShape = kssFiles.length > 1 && (infoByStem.size || tracksByStem.size || imagesByStem.size);
      if (entryFormat !== 'VIGAMUP' && !flatVigamupShape) return null;

      const games = [];
      const allTracks = [];
      let packCover = null;
      for (const rel of kssFiles.sort((a, b) => a.localeCompare(b))) {
        const data = fileDataByPath.get(rel);
        const stem = baseName(rel).replace(/\.[^.]+$/, '').toLowerCase();
        const fsPath = `${root}/${rel}`.replace(/[\\]+/g, '/');
        this.writeBytesToFs(fsPath, data);
        const gameInfo = this.parseGameInfo(infoByStem.get(stem) || '');
        const gameTitle = gameInfo.full_title || gameInfo.title || baseName(rel).replace(/\.[^.]+$/, '');
        const image = imagesByStem.get(stem);
        const coverDataUrl = image ? this.bytesToDataUrl(image.data, this.mimeForImagePath(image.rel)) : '';
        if (!packCover && coverDataUrl) packCover = { dataUrl: coverDataUrl, path: image.rel };
        const trackInfo = this.parseKssTrackInfo(tracksByStem.get(stem) || '');
        const count = Number(this.player.GetKSSTrackCountDirect ? this.player.GetKSSTrackCountDirect(fsPath) : 0) || 0;
        const trkMin = Number(this.player.GetKSSTrackMinDirect ? this.player.GetKSSTrackMinDirect(fsPath) : 0) || 0;
        const tracks = [];
        const sourceEntries = trackInfo.length ? trackInfo : Array.from({ length: Math.max(1, count) }, (_, i) => ({ index: i, title: '' }));
        for (const item of sourceEntries) {
          let trackIndex = item.index;
          if (trackIndex == null && item.num != null) trackIndex = item.num - trkMin;
          if (trackIndex == null || trackIndex < 0) continue;
          if (count && trackIndex >= count) continue;
          const trackPath = `${fsPath}|track=${trackIndex}`;
          const title = item.title || (this.player.GetKSSTrackNameDirect ? this.player.GetKSSTrackNameDirect(fsPath, trackIndex) : '') || `Track ${trackIndex + 1}`;
          const length = item.lengthSec || this.readLength(trackPath);
          const track = {
            path: rel,
            trackPathSuffix: `|track=${trackIndex}`,
            name: title,
            format: 'KSS',
            metadata: {
              title,
              trackTitle: title,
              game: gameTitle,
              system: 'MSX',
              status: 'Playable',
              content: 'MSX/SMS music container',
              backend: 'KSS',
              chip: 'KSS',
              container: rel,
              duration: length ? this.formatTime(length) : '',
              lengthSec: length || 0,
              coverDataUrl
            }
          };
          tracks.push(track);
          allTracks.push(track);
        }
        games.push({
          name: gameTitle,
          path: rel,
          format: 'KSS',
          coverDataUrl,
          gameInfo,
          trackCount: tracks.length,
          tracks
        });
      }

      return {
        version: ARCHIVE_META_VERSION,
        sha256: sha,
        title: archiveTitle,
        archiveName: entry.name,
        innerFormat: '',
        innerFormats: this.topTrackFormats(allTracks, 4),
        sizeBytes: entry.item.sizeBytes || 0,
        mtime: entry.item.mtime || 0,
        trackCount: allTracks.length,
        coverDataUrl: packCover ? packCover.dataUrl : '',
        coverPath: packCover ? packCover.path : '',
        support: [],
        tracks: allTracks,
        games
      };
    }

    decodeText(bytes) {
      try {
        return new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return s;
      }
    }

    parseGameInfo(text) {
      const fields = {};
      String(text || '').split(/\r?\n/).forEach((line) => {
        const idx = line.indexOf(':');
        if (idx <= 0) return;
        fields[line.substring(0, idx).trim().toLowerCase()] = line.substring(idx + 1).trim();
      });
      return fields;
    }

    parseKssTrackInfo(text) {
      if (!text) return [];
      try {
        const meta = this.player && this.player._parseKssTxt ? this.player._parseKssTxt(text) : null;
        if (meta && meta.entries) return meta.entries;
      } catch (e) {}
      return [];
    }

    metadataForPath(fsPath, relPath) {
      const format = formatOf({ name: relPath });
      const info = FORMAT_INFO[format] || {};
      const metadata = {
        title: baseName(relPath).replace(/\.[^.]+$/, ''),
        format,
        status: 'Playable',
        content: info.content || 'Playable audio file',
        backend: info.backend || '',
        container: dirname(relPath),
        chip: info.backend || format || ''
      };
      const title = this.readTag(fsPath, 0);
      const game = this.readTag(fsPath, 2);
      const system = this.readTag(fsPath, 4);
      const author = this.readTag(fsPath, 6);
      const date = this.readTag(fsPath, 8);
      const creator = this.readTag(fsPath, 9);
      const comments = this.readTag(fsPath, 10);
      const length = this.readLength(fsPath);
      if (title) metadata.trackTitle = title;
      if (game && format !== 'MBM') metadata.game = game;
      if (system) metadata.system = system;
      if (author) metadata.author = author;
      if (date) metadata.date = date;
      if (creator) metadata.creator = creator;
      if (comments) metadata.comments = comments;
      if (length) {
        metadata.lengthSec = length;
        metadata.duration = this.formatTime(length);
      }
      return metadata;
    }

    applyArchiveMetadata(entry, archiveMeta, options = {}) {
      entry.archiveSha = archiveMeta.sha256;
      entry.archiveInspected = true;
      entry.archiveVerified = !!options.verified;
      entry.archiveLightIndex = !!archiveMeta.lightIndex;
      const playableTrackCount = archiveMeta.trackCount || (archiveMeta.tracks ? archiveMeta.tracks.length : 0);
      entry.hidden = playableTrackCount <= 0;
      entry.metadata = {
        ...(entry.metadata || {}),
        title: archiveMeta.title || (entry.metadata && entry.metadata.title) || entry.name,
        gameTitle: archiveMeta.title || '',
        status: options.verified ? 'Archive indexed' : 'Archive preview from cache',
        sha256: archiveMeta.sha256,
        trackCount: playableTrackCount,
        coverDataUrl: archiveMeta.coverDataUrl || (entry.metadata && entry.metadata.coverDataUrl) || '',
        coverUrl: (entry.metadata && entry.metadata.coverUrl) || '',
        content: (entry.metadata && entry.metadata.content) || 'Archive container',
        backend: 'Archive reader'
      };
      if (entry.hidden) {
        entry.expanded = false;
        this.replaceChildren(entry.id, []);
        if (this.selectedId === entry.id) this.selectedId = null;
        if (this.playingEntry && this.playingEntry.id === entry.id) this.playingEntry = null;
        if (this.config.imageOverview !== false) this.showImageOverview();
        else this.showHelp();
        this.renderTree();
        return;
      }
      entry.innerFormat = archiveMeta.innerFormat || '';
      entry.innerFormats = archiveMeta.innerFormats || (entry.innerFormat ? [entry.innerFormat] : []);
      let children = [];
      if (archiveMeta.games && archiveMeta.games.length) {
        children = archiveMeta.games.map((game, index) => this.archiveGameFromMeta(entry, game, index));
      } else {
        children = (archiveMeta.tracks || []).map((track, index) => this.archiveTrackFromMeta(entry, track, index));
      }
      children = children.concat((archiveMeta.unsupported || []).map((item, index) => this.archiveUnsupportedFromMeta(entry, item, index)));
      this.replaceChildren(entry.id, children);
      if (archiveMeta.games && archiveMeta.games.length) {
        archiveMeta.games.forEach((game, gameIndex) => {
          const parentId = `${entry.id}:game:${gameIndex}`;
          const tracks = (game.tracks || []).map((track, trackIndex) => this.archiveTrackFromMeta(entry, track, `${gameIndex}:${trackIndex}`, parentId));
          this.replaceChildren(parentId, tracks);
        });
      }
      if (options.expand) entry.expanded = true;
      this.renderTree();
    }

    archiveGameFromMeta(parent, game, index) {
      return {
        id: `${parent.id}:game:${index}`,
        parentId: parent.id,
        type: 'archiveGame',
        name: game.name || `Game ${index + 1}`,
        format: game.format || '',
        playable: false,
        inspectable: false,
        expanded: false,
        item: parent.item,
        path: parent.path,
        archiveParentId: parent.id,
        metadata: {
          title: game.name || `Game ${index + 1}`,
          gameTitle: game.name || '',
          status: 'Game indexed',
          trackCount: game.trackCount || (game.tracks ? game.tracks.length : 0),
          coverDataUrl: game.coverDataUrl || '',
          coverUrl: '',
          content: 'VIGAMUP game',
          backend: 'Archive reader',
          format: game.format || ''
        },
        warnings: parent.warnings || []
      };
    }

    archiveTrackFromMeta(parent, track, index, parentId = parent.id) {
      const format = track.format || formatOf({ name: track.path });
      return {
        id: `${parent.id}:archive:${index}`,
        parentId,
        type: 'archiveTrack',
        name: track.name || baseName(track.path),
        format,
        playable: true,
        inspectable: false,
        expanded: false,
        item: parent.item,
        path: parent.path,
        archiveParentId: parent.id,
        archivePath: track.path,
        archiveTrackPathSuffix: track.trackPathSuffix || '',
        metadata: {
          ...(track.metadata || {}),
          title: track.name || (track.metadata && track.metadata.title) || baseName(track.path),
          status: 'Playable',
          container: `${parent.name} / ${dirname(track.path)}`,
          coverDataUrl: (track.metadata && track.metadata.coverDataUrl) || (parent.metadata && parent.metadata.coverDataUrl) || '',
          coverUrl: (track.metadata && track.metadata.coverUrl) || (parent.metadata && parent.metadata.coverUrl) || ''
        },
        warnings: parent.warnings || []
      };
    }

    archiveUnsupportedFromMeta(parent, item, index) {
      const format = item.format || formatOf({ name: item.path });
      return {
        id: `${parent.id}:unsupported:${index}`,
        parentId: parent.id,
        type: 'unsupported',
        name: item.name || baseName(item.path),
        format: '',
        playable: false,
        inspectable: false,
        expanded: false,
        item: parent.item,
        path: item.path,
        metadata: {
          ...(item.metadata || {}),
          format,
          container: `${parent.name} / ${dirname(item.path)}`
        },
        warnings: []
      };
    }

    bestArchiveTitle(fallback, tracks) {
      const counts = new Map();
      for (const track of tracks || []) {
        const m = track.metadata || {};
        const value = (m.game || '').trim();
        const trackTitle = (m.trackTitle || m.title || track.name || '').trim();
        if (value && trackTitle && value === trackTitle) continue;
        if (!value || value.length < 2) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
      }
      let best = '';
      let bestCount = 0;
      for (const [name, count] of counts.entries()) {
        if (count > bestCount) {
          best = name;
          bestCount = count;
        }
      }
      return best || fallback;
    }

    commonTrackFormat(tracks) {
      const counts = new Map();
      for (const track of tracks || []) {
        if (!track.format) continue;
        counts.set(track.format, (counts.get(track.format) || 0) + 1);
      }
      if (!counts.size) return '';
      let best = '';
      let bestCount = 0;
      for (const [format, count] of counts.entries()) {
        if (count > bestCount) {
          best = format;
          bestCount = count;
        }
      }
      return bestCount === (tracks || []).length ? best : '';
    }

    topTrackFormats(tracks, limit = 4) {
      const counts = new Map();
      const order = [];
      for (const track of tracks || []) {
        if (!track.format) continue;
        if (!counts.has(track.format)) order.push(track.format);
        counts.set(track.format, (counts.get(track.format) || 0) + 1);
      }
      return order
        .sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b))
        .slice(0, limit);
    }

    inspectMultiTrack(entry, path) {
      const info = FORMAT_INFO[entry.format] || {};
      if (!info.multiTrack) return [];
      let count = 0;
      let getName = null;
      try {
        if (this.isKssFormat(entry.format) && this.player.GetKSSTrackCountDirect) {
          count = Number(this.player.GetKSSTrackCountDirect(path)) || 0;
          getName = this.player.GetKSSTrackNameDirect ? (i) => this.player.GetKSSTrackNameDirect(path, i) : null;
          if (entry.type === 'track' || entry.type === 'archiveTrackSource') {
            count = 255;
          } else if (count > 64) {
            let hasNamedTrack = false;
            const probeCount = Math.min(count, 16);
            for (let i = 0; i < probeCount; i++) {
              try {
                if (getName && getName(i)) {
                  hasNamedTrack = true;
                  break;
                }
              } catch (e) {}
            }
            if (!hasNamedTrack) return [];
          }
        } else if (this.player.GetGMETrackCountDirect) {
          count = Number(this.player.GetGMETrackCountDirect(path)) || 0;
          getName = this.player.GetGMETrackNameDirect ? (i) => this.player.GetGMETrackNameDirect(path, i) : null;
        }
      } catch (e) {
        count = 0;
      }
      if (count <= 1) return [];
      const tracks = [];
      for (let i = 0; i < count; i++) {
        let name = '';
        try { name = getName ? getName(i) : ''; } catch (e) { name = ''; }
        tracks.push(this.makeTrackPart(entry, i, path, name || `Track ${i + 1}`));
      }
      return tracks;
    }

    makeTrackPart(parent, index, path, name) {
      const trackPath = `${path}|track=${index}`;
      const length = this.readLength(trackPath);
      return {
        id: `${parent.id}:track:${index}`,
        parentId: parent.id,
        type: 'trackPart',
        name,
        format: parent.format,
        playable: true,
        inspectable: false,
        expanded: false,
        item: parent.item,
        path: parent.path,
        fsPath: path,
        trackPath,
        pendingTrackIndex: index,
        metadata: {
          ...(parent.metadata || {}),
          title: name,
          trackTitle: name,
          status: 'Playable',
          container: parent.name,
          duration: length ? this.formatTime(length) : '',
          lengthSec: length || 0,
          trackNumber: index + 1
        },
        warnings: parent.warnings || []
      };
    }

    replaceChildren(parentId, children) {
      const oldChildren = this.children.get(parentId) || [];
      const removeChild = (child) => {
        const nested = this.children.get(child.id) || [];
        for (const nestedChild of nested) removeChild(nestedChild);
        this.children.delete(child.id);
        this.byId.delete(child.id);
        const index = this.entries.findIndex((entry) => entry.id === child.id);
        if (index >= 0) this.entries.splice(index, 1);
      };
      for (const child of oldChildren) removeChild(child);
      this.children.set(parentId, children);
      for (const child of children) {
        this.entries.push(child);
        this.byId.set(child.id, child);
      }
    }

    async ensureEntryInFs(entry) {
      if (entry.type === 'archiveTrack') {
        return this.ensureArchiveTrackInFs(entry);
      }
      if (entry.trackPath) {
        const base = entry.trackPath.split('|track=')[0];
        try { if (!this.player._fileExists || this.player._fileExists(base)) return base; } catch (e) { return base; }
      }
      if (entry.fsPath) {
        try { if (!this.player._fileExists || this.player._fileExists(entry.fsPath)) return entry.fsPath; } catch (e) { return entry.fsPath; }
      }
      const path = '/native/' + entry.path.replace(/^[\\/]+/, '').replace(/[\\]+/g, '/');
      const bytes = await this.fetchBytes(entry.item.url);
      if (!bytes || !bytes.length) throw new Error('Empty file');
      await this.player.checkEverythingReady();
      this.ensureDir(path);
      try { if (this.player._fileExists && this.player._fileExists(path)) FS.unlink(path); } catch (e) {}
      FS.writeFile(path, bytes);
      entry.fsPath = path;
      if (entry.pendingTrackIndex != null) {
        entry.trackPath = `${path}|track=${entry.pendingTrackIndex}`;
      }
      return path;
    }

    async ensureArchiveTrackInFs(entry) {
      const parent = this.byId.get(entry.archiveParentId);
      if (!parent) throw new Error('Archive parent missing');
      if (!parent.archiveFiles) {
        await this.inspectArchive(parent, { expand: false, force: true, fullIndex: true });
      }
      const data = parent.archiveFiles && parent.archiveFiles.get(entry.archivePath);
      if (!data) throw new Error('Archive track bytes missing');
      const sha = parent.archiveSha || (parent.metadata && parent.metadata.sha256) || 'unverified';
      const fsPath = `/native-archives/${sha}/${entry.archivePath}`.replace(/[\\]+/g, '/');
      const root = `/native-archives/${sha}`;
      this.statusEl.textContent = 'Preparing track';
      const playbackPaths = this.archivePlaybackPaths(entry, parent);
      parent.archiveFsFiles = [];
      let count = 0;
      for (const relPath of playbackPaths) {
        const bytes = parent.archiveFiles.get(relPath);
        if (!relPath || !bytes) continue;
        const fullPath = `${root}/${relPath}`.replace(/[\\]+/g, '/');
        this.writeBytesToFs(fullPath, bytes);
        parent.archiveFsFiles.push({ filepath: fullPath });
        count++;
        if (count % 25 === 0) await this.yieldToUI();
      }
      entry.fsPath = fsPath;
      if (entry.archiveTrackPathSuffix) entry.trackPath = fsPath + entry.archiveTrackPathSuffix;
      entry.archiveGameFiles = parent.archiveFsFiles && parent.archiveFsFiles.length ? parent.archiveFsFiles : [{ filepath: fsPath }];
      return fsPath;
    }

    archivePlaybackPaths(entry, parent) {
      const paths = new Set([entry.archivePath]);
      const selected = String(entry.archivePath || '').toLowerCase();
      for (const relPath of parent.archiveFiles.keys()) {
        const lower = String(relPath || '').toLowerCase();
        if (lower.endsWith('.psflib') || lower.endsWith('.usflib')) paths.add(relPath);
        if ((selected.endsWith('.mus') || selected.endsWith('.lmp')) && lower.endsWith('genmidi.lmp')) paths.add(relPath);
      }
      return Array.from(paths);
    }

    readTag(path, index) {
      try {
        if (!this.player.GetVGMTagDirect) return '';
        return this.player.GetVGMTagDirect(path, index) || '';
      } catch (e) {
        return '';
      }
    }

    readLength(path) {
      try {
        if (!this.player.GetTrackLengthDirect) return 0;
        const samplesAt44100 = Number(this.player.GetTrackLengthDirect(path)) || 0;
        return samplesAt44100 > 0 ? Math.round(samplesAt44100 / 44100) : 0;
      } catch (e) {
        return 0;
      }
    }

    chipLabel(format) {
      const info = FORMAT_INFO[format] || {};
      return info.backend || format || '';
    }

    loopStatusLabel() {
      try {
        if (this.player && this.player._trackSupportsLoop) {
          return this.player._trackSupportsLoop() ? 'yes' : 'no';
        }
      } catch (e) {}
      return 'unknown';
    }

    isPlayablePath(path) {
      const lower = String(path || '').toLowerCase();
      try {
        if (this.player && this.player.isPlayable && this.player.isPlayable(lower)) return true;
      } catch (e) {}
      const ext = extOf(lower);
      return !!FORMAT_INFO[formatOf({ name: lower })] && !ARCHIVE_EXTS.has(ext) && !IMAGE_EXTS.has(ext);
    }

    isImagePath(path) {
      return IMAGE_EXTS.has(extOf(path));
    }

    isArchiveSupportPath(path) {
      const lower = String(path || '').toLowerCase();
      return lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo') || lower.endsWith('.m3u');
    }

    isKssFormat(format) {
      return format === 'KSS' || format === 'KSSX' || format === 'KSCC';
    }

    isVigamupArchiveShape(entry, entries) {
      if (formatOf(entry) === 'VIGAMUP') return true;
      let kssCount = 0;
      let hasInfo = false;
      for (const archiveEntry of entries || []) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : String(archiveEntry || '');
        const lower = rel.toLowerCase();
        if (lower.endsWith('.kss') || lower.endsWith('.kssx') || lower.endsWith('.kscc')) kssCount++;
        if (lower.endsWith('.gameinfo') || lower.endsWith('.trackinfo')) hasInfo = true;
      }
      return kssCount > 1 && hasInfo;
    }

    writeBytesToFs(path, bytes) {
      this.ensureDir(path);
      try { if (this.player._fileExists && this.player._fileExists(path)) FS.unlink(path); } catch (e) {}
      FS.writeFile(path, bytes);
    }

    async sha256Hex(bytes) {
      if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.subtle.digest) {
        throw new Error('SHA-256 is unavailable in this WebView');
      }
      const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const digest = await crypto.subtle.digest('SHA-256', copy);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    async pickArchiveCover(candidates, archiveBase) {
      if (!candidates.length) return null;
      const scored = candidates.map((candidate) => {
        const name = baseName(candidate.rel).replace(/\.[^.]+$/, '').toLowerCase();
        let score = 0;
        if (name === archiveBase) score += 100;
        if (name === 'cover' || name === 'folder' || name === 'front') score += 80;
        if (candidate.lower.includes('cover') || candidate.lower.includes('folder') || candidate.lower.includes('front')) score += 40;
        if (candidate.lower.endsWith('.png')) score += 10;
        return { ...candidate, score };
      }).sort((a, b) => b.score - a.score);
      const best = scored[0];
      return {
        path: best.rel,
        dataUrl: this.bytesToDataUrl(best.data, this.mimeForImagePath(best.rel))
      };
    }

    bytesToDataUrl(bytes, mime) {
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return `data:${mime || 'application/octet-stream'};base64,${btoa(binary)}`;
    }

    mimeForImagePath(path) {
      const ext = extOf(path);
      if (ext === 'png') return 'image/png';
      if (ext === 'webp') return 'image/webp';
      return 'image/jpeg';
    }

    loadArchiveMetaCache() {
      const fallback = { version: ARCHIVE_META_VERSION, packsBySha: {}, quick: {} };
      const raw = window.VGMPLAY_NATIVE_ARCHIVE_META;
      if (raw && raw.version === ARCHIVE_META_VERSION && raw.packsBySha && raw.quick) return raw;
      try {
        const local = JSON.parse(localStorage.getItem('vgmplayNativeArchiveMeta') || 'null');
        if (local && local.version === ARCHIVE_META_VERSION && local.packsBySha && local.quick) return local;
      } catch (e) {}
      return fallback;
    }

    saveArchiveMetaCache() {
      const cache = this.archiveMetaCache || { version: ARCHIVE_META_VERSION, packsBySha: {}, quick: {} };
      cache.version = ARCHIVE_META_VERSION;
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveArchiveMeta) {
        window.webkit.messageHandlers.nativeSaveArchiveMeta.postMessage(cache);
      } else {
        try { localStorage.setItem('vgmplayNativeArchiveMeta', JSON.stringify(cache)); } catch (e) {}
      }
    }

    loadTrackMetaCache() {
      const fallback = { version: TRACK_META_VERSION, tracks: {} };
      const raw = window.VGMPLAY_NATIVE_TRACK_META;
      if (raw && raw.version === TRACK_META_VERSION && raw.tracks) return raw;
      try {
        const local = JSON.parse(localStorage.getItem('vgmplayNativeTrackMeta') || 'null');
        if (local && local.version === TRACK_META_VERSION && local.tracks) return local;
      } catch (e) {}
      return fallback;
    }

    saveTrackMetaCache() {
      const cache = this.trackMetaCache || { version: TRACK_META_VERSION, tracks: {} };
      cache.version = TRACK_META_VERSION;
      if (!cache.tracks) cache.tracks = {};
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveTrackMeta) {
        window.webkit.messageHandlers.nativeSaveTrackMeta.postMessage(cache);
      } else {
        try { localStorage.setItem('vgmplayNativeTrackMeta', JSON.stringify(cache)); } catch (e) {}
      }
    }

    archiveQuickKey(entry) {
      const item = entry.item || {};
      return [this.rootUrl || this.rootName || '', entry.path || entry.name || '', item.sizeBytes || 0, item.mtime || 0].join('|');
    }

    trackQuickKey(entry) {
      const item = entry.item || {};
      return [this.rootUrl || this.rootName || '', entry.path || entry.name || '', item.sizeBytes || 0, item.mtime || 0].join('|');
    }

    rememberArchiveQuickKey(entry, sha) {
      if (!this.archiveMetaCache.quick) this.archiveMetaCache.quick = {};
      this.archiveMetaCache.quick[this.archiveQuickKey(entry)] = sha;
    }

    applyCachedArchivePreview(entry) {
      const sha = this.archiveMetaCache.quick && this.archiveMetaCache.quick[this.archiveQuickKey(entry)];
      const cached = sha && this.archiveMetaCache.packsBySha && this.archiveMetaCache.packsBySha[sha];
      if (!cached) return;
      this.applyArchiveMetadata(entry, cached, { expand: false, verified: false });
    }

    applyCachedTrackPreview(entry) {
      const cache = this.trackMetaCache && this.trackMetaCache.tracks;
      const cached = cache && cache[this.trackQuickKey(entry)];
      if (!cached) return;
      entry.metadata = {
        ...(entry.metadata || {}),
        ...(cached.metadata || {}),
        status: 'Playable'
      };
      entry.inspected = true;
      const tracks = Array.isArray(cached.tracks) ? cached.tracks : [];
      entry.pendingExpandable = false;
      if (tracks.length) {
        entry.metadata.trackCount = tracks.length;
        this.replaceChildren(entry.id, tracks.map((track, index) => this.cachedTrackPartFromMeta(entry, track, index)));
      }
    }

    cachedTrackPartFromMeta(parent, track, index) {
      const metadata = track && track.metadata ? track.metadata : {};
      const trackIndex = track && track.trackIndex != null ? track.trackIndex : index;
      const name = (track && track.name) || metadata.trackTitle || `Track ${trackIndex + 1}`;
      return {
        id: `${parent.id}:track:${trackIndex}`,
        parentId: parent.id,
        type: 'trackPart',
        name,
        format: parent.format,
        playable: true,
        inspectable: false,
        expanded: false,
        item: parent.item,
        path: parent.path,
        pendingTrackIndex: trackIndex,
        metadata: {
          ...(parent.metadata || {}),
          ...metadata,
          title: name,
          trackTitle: metadata.trackTitle || name,
          status: 'Playable',
          container: parent.name,
          trackNumber: trackIndex + 1
        },
        warnings: parent.warnings || []
      };
    }

    saveTrackMetadata(entry) {
      if (!entry || !entry.playable || entry.type === 'trackPart') return;
      if (!this.trackMetaCache) this.trackMetaCache = { version: TRACK_META_VERSION, tracks: {} };
      if (!this.trackMetaCache.tracks) this.trackMetaCache.tracks = {};
      const children = (this.children.get(entry.id) || []).filter((child) => child.type === 'trackPart');
      this.trackMetaCache.tracks[this.trackQuickKey(entry)] = {
        metadata: {
          ...(entry.metadata || {}),
          status: 'Playable'
        },
        tracks: children.map((child, index) => {
          const trackIndex = child.pendingTrackIndex != null
            ? child.pendingTrackIndex
            : ((child.metadata && child.metadata.trackNumber) ? child.metadata.trackNumber - 1 : index);
          return {
            name: child.name,
            trackIndex,
            metadata: {
              ...(child.metadata || {}),
              status: 'Playable'
            }
          };
        })
      };
      this.saveTrackMetaCache();
    }

    yieldToUI() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    openExternal(entry) {
      const path = entry.item && (entry.item.nativePath || entry.item.path || entry.item.url);
      if (!path) return;
      this.statusEl.textContent = 'Opening';
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeOpenFile) {
        window.webkit.messageHandlers.nativeOpenFile.postMessage({ path });
      } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ type: 'nativeOpenFile', path });
      } else {
        window.open(entry.item.url, '_blank');
      }
    }

    saveConfig() {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveConfig) {
        window.webkit.messageHandlers.nativeSaveConfig.postMessage(this.config);
      } else if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ type: 'nativeSaveConfig', config: this.config });
      } else {
        try { localStorage.setItem('vgmplayNativeConfig', JSON.stringify(this.config)); } catch (e) {}
      }
    }

    clampLibraryWidth(width) {
      const max = Math.max(LIBRARY_MIN_WIDTH, Math.floor(window.innerWidth * 0.5));
      const value = Number(width) || LIBRARY_MIN_WIDTH;
      return Math.max(LIBRARY_MIN_WIDTH, Math.min(max, value));
    }

    applyLibraryWidth(width) {
      const clamped = this.clampLibraryWidth(width);
      if (this.libraryEl) {
        this.libraryEl.style.width = `${clamped}px`;
        this.libraryEl.style.flexBasis = `${clamped}px`;
      }
      this.config.libraryWidth = clamped;
      return clamped;
    }

    setupLibraryResizer() {
      if (!this.libraryResizerEl || !this.libraryEl || this._libraryResizerReady) return;
      this._libraryResizerReady = true;
      let dragging = false;
      const finish = () => {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('native-resizing-library');
        this.saveConfig();
      };
      this.libraryResizerEl.addEventListener('pointerdown', (e) => {
        dragging = true;
        this.libraryResizerEl.setPointerCapture && this.libraryResizerEl.setPointerCapture(e.pointerId);
        document.body.classList.add('native-resizing-library');
        e.preventDefault();
      });
      this.libraryResizerEl.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const rect = this.root.getBoundingClientRect();
        this.applyLibraryWidth(e.clientX - rect.left);
      });
      this.libraryResizerEl.addEventListener('pointerup', finish);
      this.libraryResizerEl.addEventListener('pointercancel', finish);
      window.addEventListener('resize', () => {
        const before = this.config.libraryWidth;
        const after = this.applyLibraryWidth(before);
        if (after !== before) this.saveConfig();
      });
    }

    async fetchBytes(url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));
      return new Uint8Array(await response.arrayBuffer());
    }

    ensureDir(path) {
      const parts = path.split('/').filter(Boolean);
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur += '/' + parts[i];
        try {
          if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
        } catch (e) {}
      }
    }

    togglePlay() {
      if (!this.playingEntry) return;
      if (this.player.isPlaybackPaused) {
        this._manualStopRequested = false;
        this.player.play();
        this.statusEl.textContent = 'Playing';
        this.playBtn.textContent = 'II';
        this.playBtn.classList.add('active');
      } else {
        this.player.pause();
        this.statusEl.textContent = 'Paused';
        this.playBtn.textContent = '▶';
        this.playBtn.classList.remove('active');
      }
    }

    stop() {
      this._manualStopRequested = true;
      if (this.player && this.player.stop) this.player.stop();
      this.statusEl.textContent = 'Stopped';
      this.playBtn.textContent = '▶';
      this.playBtn.classList.remove('active');
      this.fakeProgress = 0;
      this.updateProgress();
    }

    startFakeProgress() {
      clearInterval(this.progressTimer);
      this.fakeProgress = 0;
      this.timeTotalEl.textContent = '0:00';
      this.progressTimer = setInterval(() => {
        if (!this.player) return;
        if (!this.player.isVGMPlaying) {
          this.handleStoppedPlayback();
          return;
        }
        if (this.player.isPlaybackPaused) return;
        this.updateProgress();
      }, 250);
    }

    handleStoppedPlayback() {
      const p = this.player;
      if (!p || !this.playingEntry || this._manualStopRequested || this._nativeAdvancingAfterStop || this._loadingTrack) return;
      if (p.loopMode === 1) return;
      const endKey = this.playingEntry.id;
      if (this._nativeEndedKey === endKey) return;
      this._nativeEndedKey = endKey;
      this._nativeAdvancingAfterStop = true;
      setTimeout(() => {
        this._nativeAdvancingAfterStop = false;
        this.nextTrack();
      }, 0);
    }

    updateProgress() {
      const p = this.player;
      const total = p && p.trackLengthSeconds ? p.trackLengthSeconds : 0;
      let current = 0;
      const isTrackLooping = !!(p && p.loopMode === 1);
      if (!isTrackLooping && p && p.visualSamplePosition && p.sampleRate) {
        current = p.visualSamplePosition / p.sampleRate;
      } else if (p && p.context && !p.isPlaybackPaused && p.playbackStartTime) {
        const elapsed = p.context.currentTime - p.playbackStartTime;
        current = p.startSample && p.sampleRate ? (p.startSample / p.sampleRate) + elapsed : elapsed;
      } else if (p && p.visualSamplePosition && p.sampleRate) {
        current = p.visualSamplePosition / p.sampleRate;
      } else {
        current = this.fakeProgress;
      }
      if (!isTrackLooping && current > total && total > 0) current = total;
      this.timeTotalEl.textContent = total ? this.formatTime(total) : '0:00';
      this.timeCurrentEl.textContent = this.formatTime(current);
      this.progressEl.style.width = (!isTrackLooping && total) ? Math.min(100, (current / total) * 100) + '%' : '0';
      if (p && p.trackLengthSeconds && !isTrackLooping && current >= total && !p.isPlaybackPaused) {
        if (this._loadingTrack) return;
        const endKey = this.playingEntry ? this.playingEntry.id : 'current';
        if (p.loopMode === 2 && this._nativeEndedKey !== endKey) {
          this._nativeEndedKey = endKey;
          this.nextTrack();
        } else if (p.loopMode !== 1 && this._nativeEndedKey !== endKey) {
          this._nativeEndedKey = endKey;
          this.nextTrack();
        }
      } else {
        this._nativeEndedKey = '';
        this.fakeProgress = current;
      }
      if (this.progressTrackEl) {
        this.progressTrackEl.classList.toggle('disabled', !!(p && p.loopMode === 1));
      }
    }

    syncPlayState() {
      const p = this.player;
      if (!p) return;
      if (p.isPlaybackPaused) {
        this.playBtn.textContent = '▶';
        this.playBtn.classList.remove('active');
        this.statusEl.textContent = p.isVGMPlaying ? 'Paused' : 'Stopped';
      } else if (p.isVGMPlaying) {
        this.playBtn.textContent = 'II';
        this.playBtn.classList.add('active');
        this.statusEl.textContent = 'Playing';
      }
      if (this.bassBtn) this.bassBtn.classList.toggle('active', !!p.bassBoostEnabled);
      if (this.reverbBtn) this.reverbBtn.classList.toggle('active', !!p.reverbEnabled);
      if (this.randomBtn) this.randomBtn.classList.toggle('active', !!p.isRandomEnabled);
      if (this.loopBtn) this.loopBtn.classList.toggle('active', p.loopMode === 1);
      if (this.progressTrackEl) this.progressTrackEl.classList.toggle('disabled', p.loopMode === 1);
    }

    applyVolume() {
      const value = this.volumeEl ? Number(this.volumeEl.value) : (this.config.volume || 80);
      if (this.player && this.player.masterGain && this.player.masterGain.gain) {
        this.player.masterGain.gain.value = Math.max(0, Math.min(1, value / 100));
      }
    }

    isAncestorInspecting(entry) {
      let cur = entry && entry.parentId ? this.byId.get(entry.parentId) : null;
      while (cur) {
        if (cur.archiveInspecting) return true;
        cur = cur.parentId ? this.byId.get(cur.parentId) : null;
      }
      return false;
    }

    displayNameFor(entry) {
      if (!entry) return '';
      const showFilenames = !!this.config.showFilenames;
      let displayName = entry.name || '';
      if (!showFilenames && entry.metadata) {
        const m = entry.metadata;
        if (isArchiveEntry(entry)) {
          if (m.gameTitle || m.title) displayName = m.gameTitle || m.title;
        } else if (entry.type === 'track' || entry.type === 'archiveTrack') {
          const trackTitle = m.trackTitle || '';
          if (trackTitle) displayName = trackTitle;
        } else if (entry.type === 'trackPart' && entry.metadata && entry.metadata.trackTitle) {
          displayName = entry.metadata.trackTitle;
        }
      }
      return displayName;
    }

    flattenPlayableTree(parentId = 'root') {
      const list = this.visibleChildren(parentId);
      let result = [];
      for (const entry of list) {
        if (entry.playable) {
          result.push(entry);
        }
        if (this.hasChildren(entry)) {
          result = result.concat(this.flattenPlayableTree(entry.id));
        }
      }
      return result;
    }

    playableEntries() {
      return this.flattenPlayableTree('root');
    }

    playAdjacentEntry(direction) {
      const list = this.playableEntries();
      if (!list.length) return;
      const currentIndex = this.playingEntry ? list.findIndex((entry) => entry.id === this.playingEntry.id) : -1;
      let nextIndex;
      if (currentIndex < 0) {
        nextIndex = direction >= 0 ? 0 : list.length - 1;
      } else {
        nextIndex = (currentIndex + direction + list.length) % list.length;
      }
      const next = list[nextIndex];
      if (!next) return;
      this.selectedId = next.id;
      this.expandAncestors(next);
      this.renderTree();
      this.scrollEntryIntoView(next);
      this.playEntry(next);
    }

    prevTrack() {
      this.playAdjacentEntry(-1);
    }

    nextTrack() {
      this.playAdjacentEntry(1);
    }

    toggleBass() {
      if (this.player && this.player.toggleBassBoost) {
        this.player.toggleBassBoost();
        this.syncPlayState();
      }
    }

    toggleReverb() {
      if (this.player && this.player.toggleReverb) {
        this.player.toggleReverb();
        this.syncPlayState();
      }
    }

    toggleRandom() {
      if (this.player && this.player.toggleRandomScope) {
        this.player.toggleRandomScope();
        this.syncPlayState();
      }
    }

    toggleLoop() {
      if (this.player && this.player.toggleLoopMode) {
        this.player.toggleLoopMode();
        this.syncPlayState();
      }
    }

    seekTo(seconds) {
      const p = this.player;
      if (!p || !p.SeekVGM || !p.sampleRate || !p.trackLengthSeconds) return;
      if (p.loopMode === 1 || (p.IsVGMStream && p.IsVGMStream && p.IsVGMStream())) return;
      try {
        const targetSeconds = Math.max(0, Math.min(Number(seconds) || 0, p.trackLengthSeconds || 0));
        const seekSecond = Math.floor(targetSeconds);
        const seekMS = Math.round((targetSeconds - seekSecond) * 1000);
        p.SeekVGM(seekSecond, seekMS);
        p.samplesGenerated = targetSeconds * p.sampleRate;
        p.visualSamplePosition = targetSeconds * p.sampleRate;
        p.startSample = p.visualSamplePosition;
        p.playbackStartTime = p.context ? p.context.currentTime : 0;
        p.emulatorFinished = false;
        p.isFadingOut = false;
        if (p.masterGain && p.context) {
          const now = p.context.currentTime;
          p.masterGain.gain.cancelScheduledValues(now);
          p.masterGain.gain.setValueAtTime(1.0, now);
        }
      } catch (e) {}
    }

    formatTime(seconds) {
      const sec = Math.max(0, Math.floor(seconds || 0));
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    formatSize(bytes) {
      const mb = bytes / (1024 * 1024);
      return (Math.round(mb * 10) / 10) + ' MB';
    }
  }

  function installWhenReady() {
    const player = window.vgmPlayInstance;
    if (!player) {
      setTimeout(installWhenReady, 50);
      return;
    }
    if (window.nativeLibraryApp) return;
    player.nativeMode = true;
    const app = new NativeLibraryApp(player);
    window.nativeLibraryApp = app;
    player._nativeLibraryApp = app;
    player.loadNativeLibraryIndex = (items, options) => app.loadIndex(items, options);
    window.loadNativeLibraryIndex = (items, options) => app.loadIndex(items, options);
  }

  installWhenReady();
})();
