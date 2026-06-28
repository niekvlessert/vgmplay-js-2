(function () {
  'use strict';

  const PAGE_SIZE = 10;
  const ARCHIVE_META_VERSION = 4;
  const TRACK_META_VERSION = 2;
  const ARCHIVE_EXTS = new Set(['zip', '7z', 'rar', 'rsn', 'vgmz', 'vgmdz', 'vgmpack', 'vigamup']);
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);
  const DEFAULT_CONFIG = { showUnsupported: false, showFilenames: false, imageOverview: true, volume: 80, libraryWidth: 440, sortByTypeFirst: false, noBadgeColors: false, lightTheme: false };
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
    MWM: 'badge-mbm',
    LMP: 'badge-pack',
    TXTP: 'badge-zip',
    MP4: 'badge-nintendo',
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
    SSF: { content: 'Saturn sequenced music', backend: 'ssfplay' },
    MINISSF: { content: 'Saturn sequenced music', backend: 'ssfplay' },
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
    MWM: { content: 'MSX Moonsound module', backend: 'MoonSound' },
    LMP: { content: 'Doom music', backend: 'MusDoom' },
    TXTP: { content: 'Text playlist', backend: 'Playlist' },
    MP4: { content: 'MPEG-4 audio', backend: 'Native decoder' },
    VIGAMUP: { content: 'VGM pack archive', backend: 'Archive reader' },
    ZIP: { content: 'Archive container', backend: 'Archive reader' },
    RSN: { content: 'SPC archive container', backend: 'Archive reader' },
    VGMPACK: { content: 'Sample pack archive', backend: 'Archive reader' }
  };
  const TRACKER_FORMATS = new Set(['MOD', 'S3M', 'XM', 'IT', 'MPTM', 'STM', 'MTM', '669', 'AMF', 'DMF', 'FAR', 'IMF', 'MED', 'OKT', 'PTM', 'ULT', 'UMX']);

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
    const normalized = String(path || '').replace(/[\\]+/g, '/').replace(/\/+$/g, '');
    const index = normalized.lastIndexOf('/');
    if (index < 0) return '';
    if (index === 0) return normalized.startsWith('/') ? '/' : '';
    return normalized.substring(0, index);
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
      this.maxResidentArchives = 2;
      this.residentArchiveIds = [];
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
            <label><input type="checkbox" data-role="sort-by-type" /> Sort by type first</label>
            <label><input type="checkbox" data-role="no-badge-colors" /> Disable type colors</label>
            <label><input type="checkbox" data-role="light-theme" /> Light theme</label>
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
      this.root.addEventListener('contextmenu', (e) => e.preventDefault());
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
      this.sortByTypeEl = this.root.querySelector('[data-role="sort-by-type"]');
      this.noBadgeColorsEl = this.root.querySelector('[data-role="no-badge-colors"]');
      this.lightThemeEl = this.root.querySelector('[data-role="light-theme"]');
      this.config = { ...DEFAULT_CONFIG, ...(window.VGMPLAY_NATIVE_CONFIG || {}) };
      this.showUnsupportedEl.checked = !!this.config.showUnsupported;
      this.showFilenamesEl.checked = !!this.config.showFilenames;
      this.imageOverviewEl.checked = this.config.imageOverview !== false;
      this.sortByTypeEl.checked = !!this.config.sortByTypeFirst;
      this.noBadgeColorsEl.checked = !!this.config.noBadgeColors;
      this.lightThemeEl.checked = !!this.config.lightTheme;
      if (this.config.noBadgeColors) {
        document.body.classList.add('no-badge-colors');
      }
      if (this.config.lightTheme) {
        document.body.classList.add('light-theme');
      }
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
        this.scanArchivesBtn.addEventListener('click', () => {
          if (this._scanningArchives) {
            this.cancelScanAllArchives();
          } else {
            this.scanAllArchives();
          }
        });
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
      this.sortByTypeEl.addEventListener('change', () => {
        this.config.sortByTypeFirst = !!this.sortByTypeEl.checked;
        this.saveConfig();
        this.renderTree();
      });
      this.noBadgeColorsEl.addEventListener('change', () => {
        this.config.noBadgeColors = !!this.noBadgeColorsEl.checked;
        this.saveConfig();
        document.body.classList.toggle('no-badge-colors', this.config.noBadgeColors);
      });
      this.lightThemeEl.addEventListener('change', () => {
        this.config.lightTheme = !!this.lightThemeEl.checked;
        this.saveConfig();
        document.body.classList.toggle('light-theme', this.config.lightTheme);
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
      this.clearResidentArchiveCache();
      this.buildEntries(Array.isArray(items) ? items : []);
      this.pruneArchiveMetaCache();
      this.renderTree();
      if (this.config.imageOverview !== false) this.showImageOverview();
      else this.showHelp();
    }

    pruneArchiveMetaCache() {
      const cache = this.archiveMetaCache;
      if (!cache || !cache.quick || !cache.packsBySha) return;
      const root = this.rootUrl || this.rootName || '';
      const currentKeys = new Set();
      for (const entry of this.entries) {
        if (isArchiveEntry(entry)) currentKeys.add(this.archiveQuickKey(entry));
      }
      let changed = false;
      for (const key of Object.keys(cache.quick)) {
        if (root && key.startsWith(root + '|') && !currentKeys.has(key)) {
          delete cache.quick[key];
          changed = true;
        }
      }
      const referenced = new Set(Object.values(cache.quick).filter(Boolean));
      for (const sha of Object.keys(cache.packsBySha)) {
        if (!referenced.has(sha)) {
          delete cache.packsBySha[sha];
          changed = true;
        }
      }
      if (changed) this.saveArchiveMetaCache({ immediate: true });
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
      this.recomputeAggregateDurations();
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
        list = list.filter((entry) => entry.type !== 'unsupported' && !this.isUnsupportedOnlyArchive(entry));
      }
      if (this.matchedIds) list = list.filter((entry) => this.matchedIds.has(entry.id));

      list = Array.from(list);
      const rank = { folder: 0, archive: 1, pack: 1, archiveGame: 2, archiveTrack: 3, trackPart: 3, track: 4, unsupported: 5 };
      const sortByTypeFirst = !!this.config.sortByTypeFirst;
      list.sort((a, b) => {
        if (sortByTypeFirst) {
          const formatA = a.innerFormat || a.innerFormats?.[0] || a.format || '';
          const formatB = b.innerFormat || b.innerFormats?.[0] || b.format || '';
          if (formatA !== formatB) {
            return formatA.localeCompare(formatB, undefined, { numeric: true, sensitivity: 'base' });
          }
        }
        const nameA = this.displayNameFor(a);
        const nameB = this.displayNameFor(b);
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' }) || (rank[a.type] - rank[b.type]);
      });
      return list;
    }

    isUnsupportedOnlyArchive(entry) {
      if (!isArchiveEntry(entry) || !entry.archiveInspected) return false;
      const metadata = entry.metadata || {};
      const playableTrackCount = Number(metadata.trackCount) || 0;
      const unsupportedCount = Number(metadata.unsupportedCount) || 0;
      return playableTrackCount <= 0 && unsupportedCount > 0;
    }

    renderRow(entry, depth, container) {
      const row = document.createElement('div');
      const isMultiTrack = entry.format && FORMAT_INFO[entry.format] && FORMAT_INFO[entry.format].multiTrack;
      const displayType = isMultiTrack ? 'archive' : entry.type;
      const isInspecting = this.isAncestorInspecting(entry);
      const isRowLoading = this.isEntryLoading(entry);
      row.className = `native-row ${displayType}${entry.id === this.selectedId ? ' selected' : ''}${entry.warnings && entry.warnings.length ? ' warn' : ''}${isInspecting ? ' disabled-inspecting' : ''}`;
      const displayName = this.displayNameFor(entry);
      const duration = this.durationForRow(entry);
      row.innerHTML = `
        <span class="native-indent" style="width:${depth * 16}px"></span>
        <span class="native-expander">${this.hasChildren(entry) ? (entry.expanded ? '&#9662;' : '&#9656;') : ''}</span>
        <span class="native-name">${escapeHtml(displayName)}</span>
        <span class="native-row-spinner-slot">${isRowLoading ? '<span class="native-row-spinner" title="Working"></span>' : ''}</span>
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

    isEntryLoading(entry) {
      if (!entry) return false;
      if (entry.archiveInspecting || entry.inspecting) return true;
      if (entry.type !== 'folder') return false;
      return this.hasLoadingDescendant(entry.id);
    }

    hasLoadingDescendant(parentId, seen = new Set()) {
      if (!parentId || seen.has(parentId)) return false;
      seen.add(parentId);
      const children = this.children.get(parentId) || [];
      for (const child of children) {
        if (!child || child.hidden) continue;
        if (child.archiveInspecting || child.inspecting) return true;
        if (this.hasLoadingDescendant(child.id, seen)) return true;
      }
      return false;
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

    durationForRow(entry) {
      if (!entry || !entry.metadata) return '';
      const isMultiTrack = entry.format && FORMAT_INFO[entry.format] && FORMAT_INFO[entry.format].multiTrack;
      if ((entry.pendingExpandable || isMultiTrack) && !this.hasChildren(entry)) return '';
      return entry.metadata.duration || '';
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

    showSkippedArchivesPopup(skippedList) {
      if (!skippedList || !skippedList.length) return;
      
      const formatSize = (bytes) => {
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(1) + ' MB';
      };
      
      const itemsHtml = skippedList.map((item, idx) => 
        `<div class="skipped-archive-item">${idx + 1}. ${escapeHtml(item.name)} <span class="skipped-archive-size">(${formatSize(item.size)})</span></div>`
      ).join('');
      
      const popupHtml = `
        <div class="native-popup-overlay">
          <div class="native-popup">
            <div class="native-popup-title">Large Archives Skipped</div>
            <div class="native-popup-message">The following archives are too large for automatic scanning. Click them manually to index when ready.</div>
            <div class="native-popup-list">${itemsHtml}</div>
            <button class="native-popup-ok" data-role="popup-ok">OK</button>
          </div>
        </div>
      `;
      
      const overlay = document.createElement('div');
      overlay.innerHTML = popupHtml;
      const popup = overlay.firstElementChild;
      document.body.appendChild(popup);
      
      popup.querySelector('[data-role="popup-ok"]').addEventListener('click', () => {
        popup.remove();
      });
      popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
      });
    }

    showQuickScanPopup(workerCount) {
      const existing = document.querySelector('.native-popup-overlay[data-popup="quick-scan"]');
      if (existing) existing.remove();
      const popupHtml = `
        <div class="native-popup-overlay" data-popup="quick-scan">
          <div class="native-popup">
            <div class="native-popup-title">Quick Archive Scan Running</div>
            <div class="native-popup-message">Playback has been stopped. VGMPlay is scanning archives with ${workerCount} workers, so the app may feel slower until scanning is complete.</div>
            <button class="native-popup-ok" data-role="popup-ok">OK</button>
          </div>
        </div>`;
      const overlay = document.createElement('div');
      overlay.innerHTML = popupHtml;
      const popup = overlay.firstElementChild;
      document.body.appendChild(popup);
      popup.querySelector('[data-role="popup-ok"]').addEventListener('click', () => {
        popup.remove();
      });
    }

    quickScanWorkerCount(totalArchives) {
      const cores = Number(navigator.hardwareConcurrency) || 4;
      return Math.max(1, Math.min(totalArchives, Math.max(2, Math.min(4, cores - 1))));
    }
    
    showImageOverview() {
      this.infoMode = 'overview';
      const entries = this.entries.filter((entry) => {
        if (!entry || entry.id === 'root' || entry.type === 'folder') return false;
        if (entry.type === 'archiveTrack' || entry.type === 'trackPart') return false;
        if (entry.parentId !== 'root' && entry.type !== 'archiveGame') return false;
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
        if (entry.playable) {
          const archiveParent = entry.archiveParentId ? this.byId.get(entry.archiveParentId) : null;
          if (!archiveParent || !archiveParent.archiveInspecting) {
            return entry;
          }
        }
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
      
      if (this._scanningArchives) {
        this.statusEl.textContent = 'Cannot play during scan';
        return;
      }
      
      if (!this.player || !this.player.StopVGM || !this.player.playFileFromFS) {
        this.statusEl.textContent = 'Player not ready - try again';
        return;
      }
      
      if (entry.archiveParentId) {
        const parent = this.byId.get(entry.archiveParentId);
        if (parent && parent.archiveInspecting) {
          this.statusEl.textContent = 'Waiting for extraction...';
          this.selectedId = entry.id;
          this.renderTree();
          while (parent && parent.archiveInspecting && this._playSequence !== 0) {
            await this.yieldToUI();
          }
          if (this._playSequence === 0) return;
          this.statusEl.textContent = 'Loading';
        }
      }
      
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
          if (this.player && this.player.isVGMPlaying && this.player.stop) {
            this.player.stop();
          }
        }
        const path = await this.ensureEntryInFs(entry);
        if (this._playSequence !== seq) return;
        const gameFiles = entry.archiveGameFiles || await this.ensureLocalPlaybackSupportFiles(entry, path);
        if (this._playSequence !== seq) return;
        const playPath = entry.trackPath || path;
        await this.player.checkEverythingReady();
        if (this._playSequence !== seq) return;
        await this.preloadNativeHomeRoms();
        if (this._playSequence !== seq) return;
        this.player._nativeLibraryApp = this;
        const noticeStart = Array.isArray(this.player.noPlayableNotices) ? this.player.noPlayableNotices.length : 0;
        const game = {
          files: gameFiles,
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
          throw new Error(this.playbackFailureHint() || 'Playback did not start');
        }
        this._lastPlaybackResourceError = '';
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
        this._lastPlaybackResourceError = 'opl4';
        return 'YMF278B (OPL4) playback requires the ROM file yrw801.rom.\n\nPut yrw801.rom in the root of the current directory or in your home folder, then restart or reopen the folder.';
      }
      if (/waves\.dat|MoonSound/i.test(text)) {
        this._lastPlaybackResourceError = 'waves';
        return 'MoonSound playback requires the file waves.dat.\n\nPut waves.dat in the root of the current directory or in your home folder, then restart or reopen the folder.';
      }
      return text;
    }

    playbackFailureHint() {
      const p = this.player;
      if (!p) return '';
      try {
        if (p.GetLastLoadErrorCode) {
          const code = p.GetLastLoadErrorCode();
          if (code === 1) return this.nativePlaybackErrorMessage('yrw801.rom missing');
          if (code === 2) return this.nativePlaybackErrorMessage('waves.dat missing');
        }
      } catch (e) {}
      try {
        if (this._lastPlaybackResourceError === 'opl4' && p._hasOpl4RomLoaded && !p._hasOpl4RomLoaded()) {
          return this.nativePlaybackErrorMessage('yrw801.rom missing');
        }
        if (this._lastPlaybackResourceError === 'waves' && p._hasWavesDatLoaded && !p._hasWavesDatLoaded()) {
          return this.nativePlaybackErrorMessage('waves.dat missing');
        }
      } catch (e) {}
      try {
        if (p._trackUsesOpl4 && p._trackUsesOpl4() && p._hasOpl4RomLoaded && !p._hasOpl4RomLoaded()) {
          return this.nativePlaybackErrorMessage('yrw801.rom missing');
        }
      } catch (e) {}
      return '';
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
          this._lastPlaybackResourceError = /waves\.dat|MoonSound/i.test(msg) ? 'waves' : 'opl4';
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
      this.renderTree();
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
        if (this.shouldUseGameTag(entry.format, game, title)) metadata.game = game;
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
        this.recomputeAggregateDurations();
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

      let archiveSha = '';
      const keepArchiveFiles = !!options.keepArchiveFiles;
      entry.archiveInspecting = true;
      this.statusEl.classList.add('native-status-loading');
      entry.metadata = { ...(entry.metadata || {}), status: 'Hashing archive...' };
      this.statusEl.textContent = 'Hashing archive';
      this.showInfo(entry);
      this.renderTree();
      try {
        if (this._scanCancelled) return;
        await this.cushionCurrentPlayback(20);
        if (this._scanCancelled) return;
        const originalBytes = await this.fetchBytes(entry.item.url);
        if (this._scanCancelled) return;
        archiveSha = await this.sha256Hex(originalBytes);
        const cached = this.archiveMetaCache.packsBySha[archiveSha];
        if (cached && !options.force && (!options.fullIndex || !cached.lightIndex)) {
          this.applyArchiveMetadata(entry, cached, { expand: !!options.expand, verified: true });
          this.rememberArchiveQuickKey(entry, archiveSha);
          this.saveArchiveMetaCache();
          this.statusEl.textContent = 'Archive ready';
          return;
        }

        entry.metadata = { ...(entry.metadata || {}), status: 'Indexing archive in background...', sha256: archiveSha };
        this.statusEl.textContent = 'Indexing archive';
        this.showInfo(entry);
        const entrySize = entry.item?.sizeBytes || 0;
        const isVeryLarge = entrySize > 100 * 1024 * 1024;
        let lightIndex = (this.shouldUseLightArchiveIndex() || isVeryLarge) && !options.force && !options.fullIndex && formatOf(entry) !== 'VIGAMUP';
        if (this._scanCancelled) return;
        let result = await this.extractArchive(entry, originalBytes, { metadataOnly: lightIndex });
        if (this._scanCancelled) return;
        if (result.metadataOnly && this.isVigamupArchiveShape(entry, result.entries || [])) {
          lightIndex = false;
          result = await this.extractArchive(entry, originalBytes, { metadataOnly: false });
        }
        entry.archiveFiles = result.metadataOnly ? null : result.fileDataByPath;
        const metadata = await this.buildArchiveMetadata(entry, result, archiveSha, { lightIndex });
        this.archiveMetaCache.packsBySha[archiveSha] = metadata;
        this.rememberArchiveQuickKey(entry, archiveSha);
        this.saveArchiveMetaCache();
        this.applyArchiveMetadata(entry, metadata, { expand: !!options.expand, verified: true });
        this.statusEl.textContent = 'Archive ready';
      } catch (e) {
        console.error('[VGM Native] Failed to inspect archive', e);
        entry.metadata = { ...(entry.metadata || {}), status: 'Archive metadata unavailable' };
        this.statusEl.textContent = 'Archive failed';
      } finally {
        if (!keepArchiveFiles) this.releaseArchiveInspectionMemory(entry, archiveSha);
        entry.archiveInspecting = false;
        this.statusEl.classList.remove('native-status-loading');
        this.showInfo(entry);
        this.renderTree();
      }
    }

    async scanAllArchives(options = {}) {
      if (this._scanningArchives && !options.force) return;
      const archives = this.entries.filter((entry) => isArchiveEntry(entry) && !entry.hidden);
      if (!archives.length) {
        this.statusEl.textContent = 'No archives';
        return;
      }
      
      const forceResume = options.force;
      const workerCount = options.workerCount || this.quickScanWorkerCount(archives.length);
      
      this._scanningArchives = true;
      this._scanCancelled = false;
      
      const hadPlayback = this.player && this.player.isVGMPlaying;
      if (hadPlayback) {
        this.stop();
      }
      this.showQuickScanPopup(workerCount);
      
      if (this.scanArchivesBtn) {
        this.scanArchivesBtn.disabled = false;
        this.scanArchivesBtn.textContent = 'Cancel';
      }
      
      let scanned = 0;
      let skipped = 0;
      let nextIndex = 0;
      let completed = 0;
      const skippedLargeArchives = [];
      
      const updateStatus = (current, total, msg) => {
        this.statusEl.textContent = msg || `Scanning ${current}/${total}`;
      };
      
      try {
        const scanWorker = async (workerIndex) => {
          while (!this._scanCancelled) {
            const i = nextIndex++;
            if (i >= archives.length) break;
            const entry = archives[i];
            const entrySize = entry.item?.sizeBytes || 0;
            const isLargeArchive = entrySize > 200 * 1024 * 1024;
            if (isLargeArchive) {
              skippedLargeArchives.push({ name: entry.name, size: entrySize });
              skipped++;
              completed++;
              updateStatus(completed, archives.length, `Skipping large archive: ${entry.name}`);
              await this.yieldToUI();
              continue;
            }

            const hasCacheEntry = this.archiveMetaCache.packsBySha && this.archiveMetaCache.packsBySha[entry.archiveSha || entry.metadata?.sha256];
            if ((entry.archiveInspected && entry.archiveVerified && !entry.archiveLightIndex) || (hasCacheEntry && !forceResume)) {
              skipped++;
              completed++;
              updateStatus(completed, archives.length);
              continue;
            }

            entry.metadata = { ...(entry.metadata || {}), status: `Quick scanning archive ${i + 1} of ${archives.length}` };
            updateStatus(completed + 1, archives.length, `Quick scanning ${completed + 1}/${archives.length} (${workerCount} workers)`);
            if (!this.selectedId || this.selectedId === entry.id) {
              this.selectedId = entry.id;
              this.showInfo(entry);
            }
            this.renderTree();

            try {
              const isVeryLarge = entrySize > 100 * 1024 * 1024;
              await this.inspectArchive(entry, { expand: false, force: false, fullIndex: !isVeryLarge });
              scanned++;
            } catch (e) {
              console.warn('[VGM Native] Scan all archives skipped failed archive', entry && entry.name, e);
            } finally {
              completed++;
              await this.yieldToUI();
              await this.freeArchiveFilesMemory();
              updateStatus(completed, archives.length, `Quick scanning ${completed}/${archives.length} (${workerCount} workers)`);
            }
          }
        };

        await Promise.all(Array.from({ length: workerCount }, (_, index) => scanWorker(index)));
        
        if (this._scanCancelled) {
          this.statusEl.textContent = `Scan cancelled - scanned ${scanned}, skipped ${skipped}`;
        } else {
          this.statusEl.textContent = scanned ? `Scanned ${scanned}` : `Archives ready`;
          if (skipped && scanned) this.statusEl.textContent = `Scanned ${scanned}, skipped ${skipped}`;
        }
        if (skippedLargeArchives.length > 0) {
          this.showSkippedArchivesPopup(skippedLargeArchives);
        }
      } finally {
        this.flushArchiveMetaCache();
        this._scanningArchives = false;
        this._scanCancelled = false;
        if (this.scanArchivesBtn) {
          this.scanArchivesBtn.disabled = false;
          this.scanArchivesBtn.textContent = 'Scan Archives';
        }
        this.renderTree();
      }
    }
    
    cancelScanAllArchives() {
      if (this._scanningArchives) {
        this._scanCancelled = true;
        this.statusEl.textContent = 'Cancelling scan...';
      }
    }
    
    async freeArchiveFilesMemory() {
      for (const entry of this.entries) {
        entry.archiveFiles = null;
        entry.archiveFsFiles = null;
      }
      this.purgeNativeArchiveFs();
    }

    releaseArchiveInspectionMemory(entry, sha) {
      if (entry) {
        entry.archiveFiles = null;
        entry.archiveFsFiles = null;
        this.forgetResidentArchive(entry);
      }
      if (sha) this.purgeNativeArchiveFsRoot(sha);
    }

    purgeNativeArchiveFsRoot(sha) {
      if (!sha || !this.player || !this.player._rmRecursive) return;
      const root = `/native-archives/${sha}`;
      try {
        if (FS.analyzePath(root).exists) this.player._rmRecursive(root);
      } catch (e) {
        if (this.player.debugMode) console.warn('[VGM Native] Failed to purge archive MEMFS root', root, e);
      }
    }

    purgeNativeArchiveFs() {
      if (!this.player || !this.player._rmRecursive) return;
      try {
        if (FS.analyzePath('/native-archives').exists) this.player._rmRecursive('/native-archives');
      } catch (e) {
        if (this.player.debugMode) console.warn('[VGM Native] Failed to purge native archive MEMFS', e);
      }
    }

    clearResidentArchiveCache() {
      for (const entry of this.entries || []) {
        if (entry) {
          entry.archiveFiles = null;
          entry.archiveFsFiles = null;
        }
      }
      this.residentArchiveIds = [];
      this.purgeNativeArchiveFs();
    }

    forgetResidentArchive(entry) {
      if (!entry || !this.residentArchiveIds) return;
      this.residentArchiveIds = this.residentArchiveIds.filter((id) => id !== entry.id);
    }

    rememberResidentArchive(entry) {
      if (!entry || !entry.id) return;
      if (!Array.isArray(this.residentArchiveIds)) this.residentArchiveIds = [];
      this.residentArchiveIds = this.residentArchiveIds.filter((id) => id !== entry.id);
      this.residentArchiveIds.push(entry.id);
      this.evictResidentArchives(entry.id);
    }

    evictResidentArchives(activeId = '') {
      const limit = Math.max(1, Number(this.maxResidentArchives) || 2);
      while (this.residentArchiveIds.length > limit) {
        let evictId = this.residentArchiveIds[0];
        const protectedIds = new Set([activeId, this.currentPlayingArchiveId()].filter(Boolean));
        if (protectedIds.has(evictId) && this.residentArchiveIds.length > 1) {
          this.residentArchiveIds.push(this.residentArchiveIds.shift());
          evictId = this.residentArchiveIds[0];
        }
        if (protectedIds.has(evictId)) break;
        this.residentArchiveIds.shift();
        const entry = this.byId.get(evictId);
        if (!entry) continue;
        const sha = entry.archiveSha || (entry.metadata && entry.metadata.sha256);
        entry.archiveFiles = null;
        entry.archiveFsFiles = null;
        this.clearArchiveChildFsState(entry);
        if (sha) this.purgeNativeArchiveFsRoot(sha);
      }
    }

    currentPlayingArchiveId() {
      if (!this.playingEntry || !this.player || !this.player.isVGMPlaying) return '';
      return this.playingEntry.archiveParentId || '';
    }

    clearArchiveChildFsState(parent) {
      if (!parent) return;
      const stack = [...(this.children.get(parent.id) || [])];
      while (stack.length) {
        const child = stack.pop();
        if (!child) continue;
        child.fsPath = '';
        child.trackPath = '';
        child.archiveGameFiles = null;
        const nested = this.children.get(child.id) || [];
        for (const nestedChild of nested) stack.push(nestedChild);
      }
    }

    archiveFsRoot(entry) {
      const sha = entry && (entry.archiveSha || (entry.metadata && entry.metadata.sha256));
      return sha ? `/native-archives/${sha}` : '';
    }

    archiveFsPath(entry, relPath) {
      const root = this.archiveFsRoot(entry);
      return root ? `${root}/${relPath}`.replace(/[\\]+/g, '/') : '';
    }

    isArchiveResident(entry, relPath = '') {
      const root = this.archiveFsRoot(entry);
      if (!root) return false;
      const probe = relPath ? this.archiveFsPath(entry, relPath) : root;
      try {
        return FS.analyzePath(probe).exists;
      } catch (e) {
        return false;
      }
    }

    async writeFullArchiveToFs(entry) {
      if (!entry || !entry.archiveFiles) return false;
      const root = this.archiveFsRoot(entry);
      if (!root) return false;
      this.purgeNativeArchiveFsRoot(entry.archiveSha || (entry.metadata && entry.metadata.sha256));
      entry.archiveFsFiles = [];
      let count = 0;
      for (const [relPath, bytes] of entry.archiveFiles.entries()) {
        if (!relPath || !bytes) continue;
        const fullPath = this.archiveFsPath(entry, relPath);
        this.writeBytesToFs(fullPath, bytes);
        entry.archiveFsFiles.push({ filepath: fullPath });
        count++;
        if (count % 25 === 0) await this.yieldToUI();
      }
      entry.archiveFiles = null;
      this.rememberResidentArchive(entry);
      return count > 0;
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
      const coverUrl = this.persistArchiveCover(entry, sha, cover, 'cover');

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
        coverUrl,
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
        const coverUrl = image ? this.persistArchiveCover(entry, sha, { dataUrl: coverDataUrl, path: image.rel }, `game-${stem}`) : '';
        if (!packCover && coverDataUrl) packCover = { dataUrl: coverDataUrl, url: coverUrl, path: image.rel };
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
              coverDataUrl,
              coverUrl
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
          coverUrl,
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
        coverUrl: packCover ? packCover.url : '',
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
      if (this.shouldUseGameTag(format, game, title)) metadata.game = game;
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

    isTrackerFormat(format) {
      return TRACKER_FORMATS.has(String(format || '').toUpperCase());
    }

    shouldUseGameTag(format, game, title = '') {
      if (!game) return false;
      const normalizedFormat = String(format || '').toUpperCase();
      const normalizedGame = String(game || '').trim().toUpperCase();
      const normalizedTitle = String(title || '').trim().toUpperCase();
      if (normalizedFormat === 'MBM' || normalizedFormat === 'LMP' || this.isTrackerFormat(normalizedFormat)) return false;
      if (normalizedGame === normalizedFormat || normalizedGame === normalizedTitle) return false;
      return true;
    }

    isFormatLabel(value) {
      const label = String(value || '').trim().toUpperCase();
      return !!label && !!FORMAT_INFO[label];
    }

    cleanTrackMetadata(metadata, context = {}) {
      if (!metadata || typeof metadata !== 'object') return {};
      const format = context.format || metadata.format || '';
      const name = context.name || '';
      const clean = { ...metadata };
      const title = clean.trackTitle || clean.title || name;
      if (!this.shouldUseGameTag(format, clean.game, title)) delete clean.game;
      if (format) clean.format = format;
      return clean;
    }

    archiveTitleFromMeta(archiveMeta, fallback) {
      const archiveNameTitle = archiveMeta && archiveMeta.archiveName ? baseName(archiveMeta.archiveName).replace(/\.[^.]+$/, '') : '';
      let fallbackTitle = fallback || archiveNameTitle;
      if (this.isFormatLabel(fallbackTitle)) fallbackTitle = archiveNameTitle || fallbackTitle;
      const title = archiveMeta && archiveMeta.title ? String(archiveMeta.title).trim() : '';
      if (!title || this.isFormatLabel(title)) return fallbackTitle;
      return title;
    }

    externalizeArchiveMetaCovers(entry, archiveMeta) {
      if (!entry || !archiveMeta || !archiveMeta.sha256) return;
      if (archiveMeta.coverDataUrl && !archiveMeta.coverUrl) {
        archiveMeta.coverUrl = this.persistArchiveCover(entry, archiveMeta.sha256, {
          dataUrl: archiveMeta.coverDataUrl,
          path: archiveMeta.coverPath || 'cover'
        }, 'cover');
      }
      if (Array.isArray(archiveMeta.games)) {
        archiveMeta.games.forEach((game, index) => {
          if (!game || !game.coverDataUrl || game.coverUrl) return;
          game.coverUrl = this.persistArchiveCover(entry, archiveMeta.sha256, {
            dataUrl: game.coverDataUrl,
            path: game.coverPath || game.path || `game-${index}`
          }, `game-${index}`);
          if (Array.isArray(game.tracks)) {
            game.tracks.forEach((track) => {
              if (track && track.metadata && track.metadata.coverDataUrl && !track.metadata.coverUrl) {
                track.metadata.coverUrl = game.coverUrl;
              }
            });
          }
        });
      }
      if (Array.isArray(archiveMeta.tracks)) {
        archiveMeta.tracks.forEach((track, index) => {
          if (!track || !track.metadata || !track.metadata.coverDataUrl || track.metadata.coverUrl) return;
          track.metadata.coverUrl = this.persistArchiveCover(entry, archiveMeta.sha256, {
            dataUrl: track.metadata.coverDataUrl,
            path: track.path || `track-${index}`
          }, `track-${index}`);
        });
      }
    }

    applyArchiveMetadata(entry, archiveMeta, options = {}) {
      this.externalizeArchiveMetaCovers(entry, archiveMeta);
      entry.archiveSha = archiveMeta.sha256;
      entry.archiveInspected = true;
      entry.archiveVerified = !!options.verified;
      entry.archiveLightIndex = !!archiveMeta.lightIndex;
      const playableTrackCount = archiveMeta.trackCount || (archiveMeta.tracks ? archiveMeta.tracks.length : 0);
      const unsupportedCount = archiveMeta.unsupported ? archiveMeta.unsupported.length : 0;
      const archiveTitle = this.archiveTitleFromMeta(archiveMeta, (entry.metadata && entry.metadata.title) || entry.name);
      entry.hidden = playableTrackCount <= 0 && unsupportedCount <= 0;
      entry.metadata = {
        ...(entry.metadata || {}),
        title: archiveTitle,
        gameTitle: archiveTitle,
        status: options.verified ? 'Archive indexed' : 'Archive preview from cache',
        sha256: archiveMeta.sha256,
        trackCount: playableTrackCount,
        unsupportedCount,
        coverDataUrl: archiveMeta.coverDataUrl || (entry.metadata && entry.metadata.coverDataUrl) || '',
        coverUrl: archiveMeta.coverUrl || (entry.metadata && entry.metadata.coverUrl) || '',
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
          const sourceTracks = this.tracksForArchiveGame(game);
          const tracks = sourceTracks.map((track, trackIndex) => this.archiveTrackFromMeta(entry, track, `${gameIndex}:${trackIndex}`, parentId));
          this.replaceChildren(parentId, tracks);
        });
      }
      if (options.expand) entry.expanded = true;
      this.recomputeAggregateDurations();
      this.renderTree();
    }

    recomputeAggregateDurations(parentId = 'root') {
      const children = this.children.get(parentId) || [];
      let total = 0;
      for (const child of children) {
        const childTotal = this.recomputeAggregateDurations(child.id);
        const direct = Number(child.metadata && child.metadata.lengthSec) || 0;
        total += childTotal || direct;
      }
      const entry = this.byId.get(parentId);
      if (entry && total > 0 && (this.hasChildren(entry) || entry.type === 'folder' || isArchiveEntry(entry) || entry.type === 'archiveGame')) {
        entry.metadata = { ...(entry.metadata || {}), lengthSec: total, duration: this.formatTime(total) };
      }
      return total;
    }

    tracksForArchiveGame(game) {
      if (Array.isArray(game.tracks) && game.tracks.length) return game.tracks;
      if (!game || !game.syntheticTracks || !this.isKssFormat(game.format)) return [];
      const count = Math.max(0, Math.min(1024, Number(game.trackCount) || 0));
      return Array.from({ length: count }, (_, index) => {
        const title = `Track ${index + 1}`;
        return {
          path: game.path,
          trackPathSuffix: `|track=${index}`,
          name: title,
          format: game.format || 'KSS',
          metadata: {
            title,
            trackTitle: title,
            game: game.name || '',
            status: 'Playable',
            trackNumber: index + 1
          }
        };
      });
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
          coverUrl: game.coverUrl || '',
          content: 'VIGAMUP game',
          backend: 'Archive reader',
          format: game.format || ''
        },
        warnings: parent.warnings || []
      };
    }

    archiveTrackFromMeta(parent, track, index, parentId = parent.id) {
      const format = track.format || formatOf({ name: track.path });
      const name = track.name || baseName(track.path);
      const metadata = this.cleanTrackMetadata(track.metadata, { format, name, path: track.path });
      return {
        id: `${parent.id}:archive:${index}`,
        parentId,
        type: 'archiveTrack',
        name,
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
          ...metadata,
          title: name || metadata.title || baseName(track.path),
          status: 'Playable',
          container: `${parent.name} / ${dirname(track.path)}`,
          coverDataUrl: metadata.coverDataUrl || (parent.metadata && parent.metadata.coverDataUrl) || '',
          coverUrl: metadata.coverUrl || (parent.metadata && parent.metadata.coverUrl) || ''
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
        const format = track.format || formatOf({ name: track.path });
        const value = (m.game || '').trim();
        const trackTitle = (m.trackTitle || m.title || track.name || '').trim();
        if (!this.shouldUseGameTag(format, value, trackTitle)) continue;
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
      if (entry.type === 'archiveTrack' || entry.archiveParentId) {
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

    isPsfFamilyPath(path) {
      const lower = String(path || '').toLowerCase().split('|track=')[0];
      return lower.endsWith('.psf') || lower.endsWith('.minipsf') ||
        lower.endsWith('.ssf') || lower.endsWith('.minissf') ||
        lower.endsWith('.usf') || lower.endsWith('.miniusf');
    }

    isPsfSupportPath(path) {
      const lower = String(path || '').toLowerCase();
      return lower.endsWith('.psflib') || lower.endsWith('.ssflib') || lower.endsWith('.usflib');
    }

    async ensureLocalPlaybackSupportFiles(entry, primaryPath) {
      const files = [{ filepath: primaryPath }];
      if (!this.isPsfFamilyPath(entry.path)) return files;
      const dir = dirname(entry.path).replace(/[\\]+/g, '/');
      let count = 0;
      for (const candidate of this.entries || []) {
        if (!candidate || candidate === entry || !candidate.item || !candidate.item.url) continue;
        if (!this.isPsfSupportPath(candidate.path)) continue;
        const candidateDir = dirname(candidate.path).replace(/[\\]+/g, '/');
        if (candidateDir !== dir) continue;
        const supportPath = await this.ensureEntryInFs(candidate);
        files.push({ filepath: supportPath });
        count++;
        if (count % 10 === 0) await this.yieldToUI();
      }
      return files;
    }

    async ensureArchiveTrackInFs(entry) {
      const parent = this.byId.get(entry.archiveParentId);
      if (!parent) throw new Error('Archive parent missing');
      if (!this.isArchiveResident(parent, entry.archivePath)) {
        await this.inspectArchive(parent, { expand: false, force: true, fullIndex: true, keepArchiveFiles: true });
        await this.writeFullArchiveToFs(parent);
      }
      const fsPath = this.archiveFsPath(parent, entry.archivePath);
      if (!fsPath || !this.isArchiveResident(parent, entry.archivePath)) throw new Error('Archive track bytes missing');
      this.statusEl.textContent = 'Preparing track';
      entry.fsPath = fsPath;
      if (entry.archiveTrackPathSuffix) entry.trackPath = fsPath + entry.archiveTrackPathSuffix;
      entry.archiveGameFiles = parent.archiveFsFiles && parent.archiveFsFiles.length ? parent.archiveFsFiles : [{ filepath: fsPath }];
      this.rememberResidentArchive(parent);
      return fsPath;
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

    persistArchiveCover(entry, sha, cover, role = 'cover') {
      if (!cover || !cover.dataUrl || !entry || !entry.item || !entry.item.nativePath || !sha) return '';
      const match = String(cover.dataUrl).match(/^data:([^;,]+)?;base64,(.*)$/);
      if (!match) return '';
      const nativePath = entry.item.nativePath;
      const archiveDir = dirname(nativePath);
      if (!archiveDir || archiveDir === 'root') return '';
      const ext = this.imageExtensionForPath(cover.path, match[1]);
      const archiveStem = baseName(nativePath).replace(/\.[^.]+$/, '');
      const safeStem = this.safeImageFilePart(archiveStem) || 'archive';
      const safeRole = this.safeImageFilePart(role) || 'cover';
      const filename = `${safeStem}-${sha.substring(0, 16)}-${safeRole}.${ext}`;
      const imagePath = `${archiveDir}/.vgmplay_js_images/${filename}`.replace(/[\\]+/g, '/');
      const imageUrl = this.nativeFileUrl(imagePath);
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveArchiveImage) {
        window.webkit.messageHandlers.nativeSaveArchiveImage.postMessage({
          path: imagePath,
          data: match[2],
          mime: match[1] || '',
          archivePath: nativePath,
          sourcePath: cover.path || ''
        });
      }
      return imageUrl;
    }

    imageExtensionForPath(path, mime = '') {
      const ext = extOf(path || '').toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
      if (mime === 'image/png') return 'png';
      if (mime === 'image/webp') return 'webp';
      if (mime === 'image/gif') return 'gif';
      if (mime === 'image/bmp') return 'bmp';
      return 'jpg';
    }

    safeImageFilePart(value) {
      return String(value || '').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').substring(0, 80);
    }

    nativeFileUrl(path) {
      const encoded = String(path || '').split('/').map((part, index) => index === 0 ? part : encodeURIComponent(part)).join('/');
      return `vgmplay://${encoded}`;
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
      if (raw && raw.version === ARCHIVE_META_VERSION && raw.packsBySha && raw.quick) return this.normalizeArchiveMetaCache(raw);
      try {
        const local = JSON.parse(localStorage.getItem('vgmplayNativeArchiveMeta') || 'null');
        if (local && local.version === ARCHIVE_META_VERSION && local.packsBySha && local.quick) return this.normalizeArchiveMetaCache(local);
      } catch (e) {}
      return fallback;
    }

    normalizeArchiveMetaCache(cache) {
      const normalized = {
        version: ARCHIVE_META_VERSION,
        packsBySha: {},
        quick: cache.quick || {}
      };
      for (const [sha, pack] of Object.entries(cache.packsBySha || {})) {
        normalized.packsBySha[sha] = this.archivePackForStorage(pack);
      }
      return normalized;
    }

    archivePackForStorage(pack) {
      if (!pack || typeof pack !== 'object') return pack;
      const compactMetadata = (metadata, context = {}) => {
        if (!metadata || typeof metadata !== 'object') return {};
        const compact = this.cleanTrackMetadata(metadata, context);
        delete compact.coverDataUrl;
        if (!compact.coverUrl) delete compact.coverUrl;
        if (compact.status === 'Playable') delete compact.status;
        if (compact.format === context.format) delete compact.format;
        if (compact.game === context.game) delete compact.game;
        if (compact.container === context.path || compact.container === dirname(context.path || '')) delete compact.container;
        if (compact.title === context.name) delete compact.title;
        if (compact.trackTitle === context.name) delete compact.trackTitle;
        if (!compact.duration && !compact.lengthSec) delete compact.duration;
        for (const key of Object.keys(compact)) {
          if (compact[key] === '' || compact[key] == null) delete compact[key];
        }
        return compact;
      };
      const stripTrack = (track, context = {}) => {
        if (!track || typeof track !== 'object') return track;
        const trackContext = {
          ...context,
          name: track.name || context.name || '',
          path: track.path || context.path || '',
          format: track.format || context.format || formatOf({ name: track.path || context.path || '' })
        };
        const stored = {
          path: track.path,
          name: track.name,
          format: trackContext.format,
          trackPathSuffix: track.trackPathSuffix
        };
        const metadata = compactMetadata(track.metadata, trackContext);
        if (Object.keys(metadata).length) stored.metadata = metadata;
        for (const key of Object.keys(stored)) {
          if (stored[key] === '' || stored[key] == null) delete stored[key];
        }
        return stored;
      };
      const stripGame = (game) => {
        if (!game || typeof game !== 'object') return game;
        const tracks = Array.isArray(game.tracks) ? game.tracks : [];
        const generatedKssTracks = this.isKssFormat(game.format) && tracks.length > 0 && tracks.every((track, index) => {
          const expected = `Track ${index + 1}`;
          return track && track.name === expected && (!track.metadata || track.metadata.title === expected || track.metadata.trackTitle === expected);
        });
        return {
          name: game.name,
          path: game.path,
          format: game.format,
          coverUrl: game.coverUrl || '',
          gameInfo: game.gameInfo || undefined,
          trackCount: game.trackCount || tracks.length,
          coverDataUrl: '',
          syntheticTracks: generatedKssTracks ? true : undefined,
          tracks: generatedKssTracks ? [] : tracks.map((track) => stripTrack(track, {
            game: game.name || '',
            path: game.path || '',
            format: game.format || ''
          }))
        };
      };
      const hasGames = Array.isArray(pack.games) && pack.games.length > 0;
      const storedTracks = hasGames ? [] : (Array.isArray(pack.tracks) ? pack.tracks.map(stripTrack) : []);
      const storedGames = Array.isArray(pack.games) ? pack.games.map(stripGame) : [];
      const fallbackTitle = pack.archiveName ? baseName(pack.archiveName).replace(/\.[^.]+$/, '') : pack.title;
      return {
        ...pack,
        title: this.isFormatLabel(pack.title) ? fallbackTitle : pack.title,
        coverDataUrl: '',
        tracks: storedTracks,
        games: storedGames,
        unsupported: Array.isArray(pack.unsupported) ? pack.unsupported : [],
        support: Array.isArray(pack.support) ? pack.support : []
      };
    }

    serializableArchiveMetaCache() {
      const cache = this.archiveMetaCache || { version: ARCHIVE_META_VERSION, packsBySha: {}, quick: {} };
      cache.version = ARCHIVE_META_VERSION;
      if (!cache.packsBySha) cache.packsBySha = {};
      if (!cache.quick) cache.quick = {};
      const packsBySha = {};
      for (const [sha, pack] of Object.entries(cache.packsBySha)) {
        packsBySha[sha] = this.archivePackForStorage(pack);
      }
      return {
        version: cache.version,
        packsBySha,
        quick: cache.quick
      };
    }

    sanitizeJsonString(value) {
      let out = '';
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
          const next = value.charCodeAt(i + 1);
          if (next >= 0xdc00 && next <= 0xdfff) {
            out += value[i] + value[i + 1];
            i++;
          } else {
            out += '\ufffd';
          }
          continue;
        }
        if (code >= 0xdc00 && code <= 0xdfff) {
          out += '\ufffd';
          continue;
        }
        out += (code < 0x20 || code === 0x7f) ? ' ' : value[i];
      }
      return out;
    }

    sanitizeJsonValue(value) {
      if (typeof value === 'string') return this.sanitizeJsonString(value);
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map((item) => this.sanitizeJsonValue(item));
      const clean = {};
      for (const [key, item] of Object.entries(value)) {
        clean[this.sanitizeJsonString(key)] = this.sanitizeJsonValue(item);
      }
      return clean;
    }

    archiveMetaJsonToBase64(json) {
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    }

    saveArchiveMetaCache(options = {}) {
      if (this._scanningArchives && !options.immediate) {
        this._archiveMetaSavePending = true;
        return;
      }
      this.flushArchiveMetaCache();
    }

    flushArchiveMetaCache() {
      try {
        this._archiveMetaSavePending = false;
        const serializable = this.sanitizeJsonValue(this.serializableArchiveMetaCache());
        const json = JSON.stringify(serializable);
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSaveArchiveMeta) {
          window.webkit.messageHandlers.nativeSaveArchiveMeta.postMessage({
            encoding: 'base64-json',
            data: this.archiveMetaJsonToBase64(json)
          });
        } else {
          try { localStorage.setItem('vgmplayNativeArchiveMeta', json); } catch (e) { console.error('[VGM Native] localStorage save failed', e); }
        }
      } catch (e) {
        console.error('[VGM Native] saveArchiveMetaCache failed', e);
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
    if (window.__pendingNativeLibraryPayload) {
      const payload = window.__pendingNativeLibraryPayload;
      window.__pendingNativeLibraryPayload = null;
      try {
        app.loadIndex(payload.items || [], payload.options || {});
      } catch (e) {
        console.error('[VGM Native] failed to load pending native library payload', e);
      }
    }
  }

  installWhenReady();
})();
