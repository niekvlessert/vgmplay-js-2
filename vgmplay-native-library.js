(function () {
  'use strict';

  const PAGE_SIZE = 10;
  const ARCHIVE_META_VERSION = 1;
  const ARCHIVE_EXTS = new Set(['zip', '7z', 'rar', 'rsn', 'vgmz', 'vgmdz', 'vgmpack', 'vigamup']);
  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);
  const DEFAULT_CONFIG = { showUnsupported: false, showFilenames: false, imageOverview: true, volume: 80 };
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
    MIDI: { content: 'MIDI sequence', backend: 'MIDI synthesizer' },
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
      this.infoMode = 'help';
      this.homeRomsLoaded = false;
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
      this.settingsBtn = this.root.querySelector('[data-role="settings"]');
      this.settingsPopover = this.root.querySelector('[data-role="settings-popover"]');
      this.showUnsupportedEl = this.root.querySelector('[data-role="show-unsupported"]');
      this.showFilenamesEl = this.root.querySelector('[data-role="show-filenames"]');
      this.imageOverviewEl = this.root.querySelector('[data-role="image-overview"]');
      this.config = { ...DEFAULT_CONFIG, ...(window.VGMPLAY_NATIVE_CONFIG || {}) };
      this.showUnsupportedEl.checked = !!this.config.showUnsupported;
      this.showFilenamesEl.checked = !!this.config.showFilenames;
      this.imageOverviewEl.checked = this.config.imageOverview !== false;
      this.searchEl.addEventListener('input', () => this.setSearch(this.searchEl.value));
      this.treeEl.addEventListener('mouseleave', () => {
        clearTimeout(this.hoverTimer);
        setTimeout(() => this.restorePlayingInfo(), 80);
      });
      this.settingsBtn.addEventListener('click', () => {
        this.settingsPopover.hidden = !this.settingsPopover.hidden;
      });
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
          this.togglePlay();
          return;
        }
        if (e.key === 'ArrowLeft') { this.prevTrack(); return; }
        if (e.key === 'ArrowRight') { this.nextTrack(); return; }
      });
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
          const rank = { folder: 0, archive: 1, pack: 1, archiveTrack: 2, trackPart: 2, track: 3, unsupported: 4 };
          return (rank[a.type] - rank[b.type]) || a.name.localeCompare(b.name);
        });
      }
      for (const entry of entries) {
        if (isArchiveEntry(entry)) this.applyCachedArchivePreview(entry);
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
      let list = this.children.get(parentId) || [];
      if (!this.config.showUnsupported) {
        list = list.filter((entry) => entry.type !== 'unsupported');
      }
      if (this.matchedIds) list = list.filter((entry) => this.matchedIds.has(entry.id));
      const total = list.length;
      const offset = this.pageOffsets[parentId] || 0;
      const shouldPaginate = parentId !== 'root' && total > PAGE_SIZE;
      const page = shouldPaginate ? list.slice(offset, offset + PAGE_SIZE) : list;
      for (const entry of page) this.renderRow(entry, depth, container);
      if (shouldPaginate) this.renderPager(parentId, depth, total, offset, container);
    }

    renderRow(entry, depth, container) {
      const row = document.createElement('div');
      row.className = `native-row ${entry.type}${entry.id === this.selectedId ? ' selected' : ''}${entry.warnings && entry.warnings.length ? ' warn' : ''}`;
      const showFilenames = !!this.config.showFilenames;
      let displayName = entry.name;
      if (!showFilenames && entry.metadata) {
        const m = entry.metadata;
        if (isArchiveEntry(entry)) {
          if (m.gameTitle || m.title) displayName = m.gameTitle || m.title;
        } else if (entry.type === 'track' || entry.type === 'archiveTrack') {
          const game = m.game || '';
          const trackTitle = m.trackTitle || '';
          if (trackTitle) displayName = trackTitle;
          else if (game && game !== displayName) displayName = game;
        } else if (entry.type === 'trackPart' && entry.metadata && entry.metadata.trackTitle) {
          displayName = entry.metadata.trackTitle;
        }
      }
      const duration = entry.metadata && entry.metadata.duration ? entry.metadata.duration : '';
      row.innerHTML = `
        <span class="native-indent" style="width:${depth * 16}px"></span>
        <span class="native-expander">${this.hasChildren(entry) ? (entry.expanded ? '&#9662;' : '&#9656;') : ''}</span>
        <span class="native-name">${escapeHtml(displayName)}</span>
        ${entry.innerFormat ? `<span class="native-badge ${BADGE_CLASS[entry.innerFormat] || ''}">${escapeHtml(entry.innerFormat)}</span>` : ''}
        ${entry.format ? `<span class="native-badge ${BADGE_CLASS[entry.format] || ''}">${escapeHtml(entry.format)}</span>` : ''}
        ${duration ? `<span class="native-duration">${escapeHtml(duration)}</span>` : ''}
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
      return (this.children.get(entry.id) || []).length > 0;
    }

    hover(entry) {
      clearTimeout(this.hoverTimer);
      this._lastHoveredEntry = entry;
      this.hoverTimer = setTimeout(() => {
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
      this.selectedId = entry.id;
      this.showInfo(entry);
      if (entry.playable && this.hasChildren(entry)) {
        entry.expanded = !entry.expanded;
        if (entry.expanded && !(entry.id in this.pageOffsets)) this.pageOffsets[entry.id] = 0;
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
      let cur = entry && entry.parentId ? this.byId.get(entry.parentId) : null;
      while (cur) {
        cur.expanded = true;
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
        await this.inspectArchive(entry, { expand: true });
        const first = (this.children.get(entry.id) || []).find((child) => child.playable);
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
      this.selectedId = entry.id;
      this.playingEntry = entry;
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
      try {
        const path = await this.ensureEntryInFs(entry);
        const playPath = entry.trackPath || path;
        await this.player.checkEverythingReady();
        await this.preloadNativeHomeRoms();
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
        const notice = this.latestPlaybackNotice(noticeStart);
        if (notice) throw new Error(notice);
        this._nativeEndedKey = '';
        this.applyVolume();
        setTimeout(() => this.applyVolume(), 80);
        entry.metadata = { ...(entry.metadata || {}), loop: this.loopStatusLabel() };
        this.showInfo(entry);
        this.statusEl.textContent = 'Playing';
        this.playBtn.textContent = 'II';
        this.playBtn.classList.add('active');
        this.startFakeProgress();
      } catch (e) {
        console.error('[VGM Native] Failed to play local entry', e);
        const message = e && e.message ? e.message : 'Playback failed';
        this.statusEl.textContent = 'Failed';
        entry.metadata = { ...(entry.metadata || {}), status: message };
        entry.warnings = Array.from(new Set([...(entry.warnings || []), message]));
        this.showInfo(entry);
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
        if (/yrw801\.rom|waves\.dat|MT32_/i.test(msg)) return msg;
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
        if (tracks.length) {
          metadata.trackCount = tracks.length;
          entry.expanded = !!options.expand;
          this.replaceChildren(entry.id, tracks);
        } else {
          metadata.trackCount = metadata.trackCount || '';
        }
        entry.metadata = metadata;
        entry.inspected = true;
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
        const originalBytes = await this.fetchBytes(entry.item.url);
        const sha = await this.sha256Hex(originalBytes);
        const cached = this.archiveMetaCache.packsBySha[sha];
        if (cached && !options.force) {
          this.applyArchiveMetadata(entry, cached, { expand: !!options.expand, verified: true });
          this.rememberArchiveQuickKey(entry, sha);
          this.saveArchiveMetaCache();
          this.statusEl.textContent = 'Archive ready';
          return;
        }

        entry.metadata = { ...(entry.metadata || {}), status: 'Indexing archive in background...', sha256: sha };
        this.statusEl.textContent = 'Indexing archive';
        this.showInfo(entry);
        const result = await this.extractArchive(entry, originalBytes);
        entry.archiveFiles = result.fileDataByPath;
        const metadata = await this.buildArchiveMetadata(entry, result, sha);
        this.archiveMetaCache.packsBySha[sha] = metadata;
        this.rememberArchiveQuickKey(entry, sha);
        this.saveArchiveMetaCache();
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

    async extractArchive(entry, bytes) {
      await this.player.checkEverythingReady();
      if (!this.player._extractArchiveWithWorker) throw new Error('Archive worker unavailable');
      const ext = extOf(entry.path || entry.name);
      const kind = ext === 'rar' ? 'rar' : (ext === '7z' ? '7z' : 'zip');
      return this.player._extractArchiveWithWorker(new Uint8Array(bytes), kind, entry.name || entry.path || 'archive');
    }

    async buildArchiveMetadata(entry, result, sha) {
      const entries = result.entries || [];
      const fileDataByPath = result.fileDataByPath || new Map();
      const tracks = [];
      const support = [];
      let cover = null;
      const archiveTitle = baseName(entry.path).replace(/\.[^.]+$/, '');
      const archiveBase = archiveTitle.toLowerCase();
      const root = `/native-archives/${sha}`;
      await this.player.checkEverythingReady();

      const imageCandidates = [];
      for (const archiveEntry of entries) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : '';
        const lower = rel.toLowerCase();
        const data = fileDataByPath.get(rel);
        if (!rel || !data) continue;
        if (this.isImagePath(lower)) imageCandidates.push({ rel, lower, data });
        if (lower.endsWith('.txt') || lower.endsWith('.trackinfo') || lower.includes('gameinfo') || lower.endsWith('.m3u')) {
          support.push({ path: rel, sizeBytes: data.length });
        }
      }
      cover = await this.pickArchiveCover(imageCandidates, archiveBase);

      let index = 0;
      for (const archiveEntry of entries) {
        const rel = archiveEntry && archiveEntry.filepath ? archiveEntry.filepath : '';
        const data = fileDataByPath.get(rel);
        if (!rel || !data || !this.isPlayablePath(rel)) continue;
        const fsPath = `${root}/${rel}`.replace(/[\\]+/g, '/');
        this.writeBytesToFs(fsPath, data);
        const trackMeta = this.metadataForPath(fsPath, rel);
        const containerTracks = this.inspectMultiTrack({ format: formatOf({ name: rel }) }, fsPath);
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
        title: this.bestArchiveTitle(archiveTitle, tracks),
        archiveName: entry.name,
        innerFormat: this.commonTrackFormat(tracks),
        sizeBytes: entry.item.sizeBytes || 0,
        mtime: entry.item.mtime || 0,
        trackCount: tracks.length,
        coverDataUrl: cover ? cover.dataUrl : '',
        coverPath: cover ? cover.path : '',
        support,
        tracks
      };
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
      return metadata;
    }

    applyArchiveMetadata(entry, archiveMeta, options = {}) {
      entry.archiveSha = archiveMeta.sha256;
      entry.archiveInspected = true;
      entry.archiveVerified = !!options.verified;
      entry.metadata = {
        ...(entry.metadata || {}),
        title: archiveMeta.title || (entry.metadata && entry.metadata.title) || entry.name,
        gameTitle: archiveMeta.title || '',
        status: options.verified ? 'Archive indexed' : 'Archive preview from cache',
        sha256: archiveMeta.sha256,
        trackCount: archiveMeta.trackCount || (archiveMeta.tracks ? archiveMeta.tracks.length : 0),
        coverDataUrl: archiveMeta.coverDataUrl || (entry.metadata && entry.metadata.coverDataUrl) || '',
        coverUrl: (entry.metadata && entry.metadata.coverUrl) || '',
        content: (entry.metadata && entry.metadata.content) || 'Archive container',
        backend: 'Archive reader'
      };
      entry.innerFormat = archiveMeta.innerFormat || '';
      const children = (archiveMeta.tracks || []).map((track, index) => this.archiveTrackFromMeta(entry, track, index));
      this.replaceChildren(entry.id, children);
      if (options.expand) entry.expanded = true;
      this.renderTree();
    }

    archiveTrackFromMeta(parent, track, index) {
      const format = track.format || formatOf({ name: track.path });
      return {
        id: `${parent.id}:archive:${index}`,
        parentId: parent.id,
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
          coverDataUrl: parent.metadata && parent.metadata.coverDataUrl || '',
          coverUrl: parent.metadata && parent.metadata.coverUrl || ''
        },
        warnings: parent.warnings || []
      };
    }

    bestArchiveTitle(fallback, tracks) {
      const counts = new Map();
      for (const track of tracks || []) {
        const m = track.metadata || {};
        const value = (m.game || '').trim();
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

    inspectMultiTrack(entry, path) {
      const info = FORMAT_INFO[entry.format] || {};
      if (!info.multiTrack) return [];
      let count = 0;
      let getName = null;
      try {
        if ((entry.format === 'KSS' || entry.format === 'KSSX' || entry.format === 'KSCC') && this.player.GetKSSTrackCountDirect) {
          count = Number(this.player.GetKSSTrackCountDirect(path)) || 0;
          getName = this.player.GetKSSTrackNameDirect ? (i) => this.player.GetKSSTrackNameDirect(path, i) : null;
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
      for (const child of oldChildren) {
        this.byId.delete(child.id);
        const index = this.entries.findIndex((entry) => entry.id === child.id);
        if (index >= 0) this.entries.splice(index, 1);
      }
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
      return path;
    }

    async ensureArchiveTrackInFs(entry) {
      const parent = this.byId.get(entry.archiveParentId);
      if (!parent) throw new Error('Archive parent missing');
      if (!parent.archiveFiles) {
        await this.inspectArchive(parent, { expand: false, force: true });
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

    archiveQuickKey(entry) {
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
        if (!this.player || !this.player.isVGMPlaying) return;
        if (this.player.isPlaybackPaused) return;
        this.updateProgress();
      }, 250);
    }

    updateProgress() {
      const p = this.player;
      const total = p && p.trackLengthSeconds ? p.trackLengthSeconds : 0;
      let current = 0;
      if (p && p.context && !p.isPlaybackPaused && p.playbackStartTime) {
        const elapsed = p.context.currentTime - p.playbackStartTime;
        current = p.startSample && p.sampleRate ? (p.startSample / p.sampleRate) + elapsed : elapsed;
      } else if (p && p.visualSamplePosition && p.sampleRate) {
        current = p.visualSamplePosition / p.sampleRate;
      } else {
        current = this.fakeProgress;
      }
      if (current > total && total > 0) current = total;
      this.timeTotalEl.textContent = total ? this.formatTime(total) : '0:00';
      this.timeCurrentEl.textContent = this.formatTime(current);
      this.progressEl.style.width = total ? Math.min(100, (current / total) * 100) + '%' : '0';
      if (p && p.trackLengthSeconds && current >= total && !p.isPlaybackPaused) {
        const endKey = this.playingEntry ? this.playingEntry.id : 'current';
        if (p.loopMode === 2 && this._nativeEndedKey !== endKey) {
          this._nativeEndedKey = endKey;
          this.nextTrack();
        } else if (p.loopMode !== 1 && this._nativeEndedKey !== endKey) {
          this._nativeEndedKey = endKey;
          this.stop();
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
        if (p.isVGMPlaying) this.statusEl.textContent = 'Paused';
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

    prevTrack() {
      this.player && this.player.changeTrack && this.player.changeTrack('previous');
    }

    nextTrack() {
      this.player && this.player.changeTrack && this.player.changeTrack('next');
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
    const app = new NativeLibraryApp(player);
    window.nativeLibraryApp = app;
    player.loadNativeLibraryIndex = (items, options) => app.loadIndex(items, options);
    window.loadNativeLibraryIndex = (items, options) => app.loadIndex(items, options);
  }

  installWhenReady();
})();
