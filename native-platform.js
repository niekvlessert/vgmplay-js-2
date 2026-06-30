(function () {
  const bridge = window.AndroidBridge;
  if (!bridge) return;

  function parseJson(value, fallback) {
    try {
      if (!value) return fallback;
      return JSON.parse(value);
    } catch (err) {
      console.warn("Android bridge JSON parse failed", err);
      return fallback;
    }
  }

  const initialState = parseJson(bridge.getInitialState && bridge.getInitialState(), {});
  window.VGMPLAY_NATIVE_CONFIG = initialState.config || {};
  window.VGMPLAY_NATIVE_ARCHIVE_META = initialState.archiveMeta || {};
  window.VGMPLAY_NATIVE_TRACK_META = initialState.trackMeta || {};
  window.VGMPLAY_NATIVE_HOME_ROMS = initialState.homeRoms || [];
  window.VGMPLAY_NATIVE_LIBRARY_SETTINGS = initialState.librarySettings || null;
  window.VGMPLAY_ANDROID_LIBRARY_SETTINGS = window.VGMPLAY_NATIVE_LIBRARY_SETTINGS;

  window.webkit = window.webkit || {};
  window.webkit.messageHandlers = window.webkit.messageHandlers || {};

  function installHandler(name) {
    window.webkit.messageHandlers[name] = {
      postMessage(payload) {
        try {
          bridge.postMessage(name, JSON.stringify(payload == null ? {} : payload));
        } catch (err) {
          console.warn("Android bridge message failed", name, err);
        }
      }
    };
  }

  [
    "nativeSaveConfig",
    "nativeSaveArchiveMeta",
    "nativeSaveArchiveImage",
    "nativeSaveTrackMeta",
    "nativeLibraryCommand",
    "nativeOpenFile"
  ].forEach(installHandler);

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  ["log", "warn", "error"].forEach((level) => {
    console[level] = function (...args) {
      originalConsole[level](...args);
      try {
        bridge.log(level, args.map((arg) => {
          if (typeof arg === "string") return arg;
          try {
            return JSON.stringify(arg);
          } catch (_) {
            return String(arg);
          }
        }).join(" "));
      } catch (_) {
        /* Console forwarding is best-effort only. */
      }
    };
  });
})();
