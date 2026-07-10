package com.vgmplay.nativeplayer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.documentfile.provider.DocumentFile;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

final class AndroidPlaybackEngineHost {
    interface Callback {
        void onMediaState(JSONObject payload);
        void onPrepareState(JSONObject payload);
        void onLog(String level, String message);
        void onRequestAudioRouteRefresh();
    }

    private static final String TAG = "VGMEngineHost";
    private static final String ASSET_BASE = "https://vgmplay.local/assets/";
    private static final String COMBINED_ROOT_NAME = "Music Libraries";
    private static final String COMBINED_ROOT_PATH = "android://libraries";
    private static final String INCLUDED_LABEL = "Included Music";
    private static final String LAST_TRACK_FILE = "last-track.json";

    private final Context context;
    private final SharedPreferences prefs;
    private final Callback callback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Uri> fileHandles = new HashMap<>();
    private final AtomicInteger nextFileId = new AtomicInteger(1);

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private boolean pageReady;
    private boolean libraryLoaded;

    AndroidPlaybackEngineHost(Context context, SharedPreferences prefs, Callback callback) {
        this.context = context;
        this.prefs = prefs;
        this.callback = callback;
    }

    void playNativePath(String nativePath, String title, String archivePath, String archiveTrackPathSuffix, long positionMs, long requestToken) {
        ensureReady(() -> {
            JSONObject payload = buildLibraryPayload();
            loadNativeLibraryPayload(payload);
            String script = "(function(nativePath,title,positionMs,archivePath,archiveTrackPathSuffix,requestToken){"
                + "var attempts=0;"
                + "function play(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(app&&app.playNativeCatalogItem){"
                + "Promise.resolve(app.playNativeCatalogItem(nativePath,title,{positionMs:positionMs,archivePath:archivePath,archiveTrackPathSuffix:archiveTrackPathSuffix,forceFullIndex:true,autoPlayback:true,requestToken:requestToken})).then(function(ok){"
                + "if(ok){if(app.ensureAndroidAudioOutput)setTimeout(function(){app.ensureAndroidAudioOutput();},150);return;}"
                + "if(++attempts<120)setTimeout(play,100);"
                + "}).catch(function(err){console.error('[VGM Service] Auto play failed',err&&err.message?err.message:String(err));if(++attempts<120)setTimeout(play,100);});"
                + "return;"
                + "}"
                + "if(++attempts<120)setTimeout(play,100);"
                + "}"
                + "play();"
                + "})(" + JSONObject.quote(nativePath == null ? "" : nativePath)
                + "," + JSONObject.quote(title == null ? "" : title)
                + "," + Math.max(0, positionMs)
                + "," + JSONObject.quote(archivePath == null ? "" : archivePath)
                + "," + JSONObject.quote(archiveTrackPathSuffix == null ? "" : archiveTrackPathSuffix)
                + "," + Math.max(0, requestToken)
                + ");";
            evaluate(script);
        });
    }

    void sendAction(String action) {
        ensureReady(() -> {
            String script = "(function(action){"
                + "var attempts=0;"
                + "function run(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(!app){if(++attempts<80)setTimeout(run,100);return;}"
                + "if(action==='playPause')app.togglePlay();"
                + "else if(action==='play')app.playCurrentOrSelected();"
                + "else if(action==='pause')app.pauseCurrent();"
                + "else if(action==='previous'&&app.prevTrack)app.prevTrack();"
                + "else if(action==='next'&&app.nextTrack)app.nextTrack();"
                + "else if(action==='ensureAudio')app.ensureAndroidAudioOutput();"
                + "else if(action==='loop')app.toggleLoop();"
                + "else if(action==='random')app.toggleRandom();"
                + "else if(action==='stop')app.stop();"
                + "}"
                + "run();"
                + "})(" + JSONObject.quote(action == null ? "" : action) + ");";
            evaluate(script);
        });
    }

    void seekTo(long positionMs) {
        ensureReady(() -> evaluate("(function(positionMs){var app=window.__vgmNativeLibraryApp;if(app&&app.seekTo)app.seekTo(Math.max(0,positionMs)/1000);})(" + Math.max(0, positionMs) + ");"));
    }

    void seekRelative(long deltaMs) {
        ensureReady(() -> evaluate("(function(deltaMs){var app=window.__vgmNativeLibraryApp;if(app&&app.seekTo){var current=app.currentPlaybackSeconds?app.currentPlaybackSeconds():0;app.seekTo(current+(Number(deltaMs)||0)/1000);}})(" + deltaMs + ");"));
    }

    void refreshAudioRoute() {
        sendAction("ensureAudio");
    }

    void destroy() {
        mainHandler.post(() -> {
            if (webView != null) {
                webView.destroy();
                webView = null;
            }
            pageReady = false;
            libraryLoaded = false;
        });
    }

    private void ensureReady(Runnable afterReady) {
        mainHandler.post(() -> {
            if (webView == null) initWebView();
            if (pageReady) {
                afterReady.run();
            } else {
                mainHandler.postDelayed(() -> ensureReady(afterReady), 100);
            }
        });
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void initWebView() {
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("vgmplay.local")
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(context))
            .addPathHandler("/file/", new SafFileHandler())
            .build();
        webView = new WebView(context);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                if (consoleMessage == null) return false;
                log(String.valueOf(consoleMessage.messageLevel()).toLowerCase(Locale.ROOT),
                    consoleMessage.message() + " @ " + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse image = handleNativeImageRequest(request.getUrl());
                if (image != null) return image;
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                if (!libraryLoaded) {
                    libraryLoaded = true;
                    loadNativeLibraryPayload(buildLibraryPayload());
                }
                log("info", "Service playback WebView ready");
            }
        });
        webView.loadUrl(ASSET_BASE + "native-index.html?v=" + System.currentTimeMillis());
    }

    private void evaluate(String script) {
        if (webView == null) return;
        webView.evaluateJavascript(script, null);
    }

    private JSONObject buildLibraryPayload() {
        fileHandles.clear();
        nextFileId.set(1);
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        JSONObject settings = buildLibrarySettings(loadLibraryDirs());
        boolean showIncluded = settings.optBoolean("includedVisible", true) && !settings.optBoolean("includedDeleted", false);
        if (showIncluded) {
            try {
                scanAssetDirectory("dist", INCLUDED_LABEL + "/", items);
            } catch (IOException err) {
                log("error", "Could not scan bundled dist assets: " + err.getMessage());
            }
        }
        JSONArray dirs = loadLibraryDirs();
        for (int i = 0; i < dirs.length(); i++) {
            JSONObject dir = dirs.optJSONObject(i);
            if (dir == null || !dir.optBoolean("enabled", true)) continue;
            Uri uri = Uri.parse(dir.optString("uri", ""));
            DocumentFile root = DocumentFile.fromTreeUri(context, uri);
            if (root == null || !root.isDirectory() || !root.canRead()) continue;
            String label = safeLibraryName(dir.optString("prefix", ""), safeLibraryName(dir.optString("name", root.getName()), "Android Music"));
            scanDocumentFile(root, label + "/", items);
        }
        try {
            JSONObject options = new JSONObject();
            options.put("rootName", COMBINED_ROOT_NAME);
            options.put("rootPath", COMBINED_ROOT_PATH);
            options.put("librarySettings", settings);
            payload.put("items", items);
            payload.put("options", options);
        } catch (JSONException err) {
            log("error", "Failed to build library payload: " + err.getMessage());
        }
        return payload;
    }

    private void loadNativeLibraryPayload(JSONObject payload) {
        String script = "(function(payload){"
            + "var attempts=0;"
            + "function deliver(){"
            + "window.VGMPLAY_ANDROID_LIBRARY_SETTINGS=(payload.options&&payload.options.librarySettings)||null;"
            + "if(window.__vgmNativeLibraryApp&&window.__vgmNativeLibraryApp.updateAndroidLibrarySettings)window.__vgmNativeLibraryApp.updateAndroidLibrarySettings(window.VGMPLAY_ANDROID_LIBRARY_SETTINGS);"
            + "if(window.loadNativeLibraryIndex){window.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
            + "if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
            + "window.__pendingNativeLibraryPayload=payload;"
            + "if(++attempts<80)setTimeout(deliver,100);"
            + "}"
            + "deliver();"
            + "})(" + payload + ");";
        evaluate(script);
    }

    private JSONArray loadLibraryDirs() {
        String raw = prefs.getString(AndroidLibraryCatalog.PREF_LIBRARY_DIRS, "[]");
        try {
            return new JSONArray(raw == null || raw.isEmpty() ? "[]" : raw);
        } catch (JSONException err) {
            return new JSONArray();
        }
    }

    private JSONObject buildLibrarySettings(JSONArray dirs) {
        JSONObject settings = new JSONObject();
        JSONArray outDirs = new JSONArray();
        boolean hasPersonalMusic = false;
        try {
            for (int i = 0; i < dirs.length(); i++) {
                JSONObject dir = dirs.optJSONObject(i);
                if (dir == null) continue;
                Uri uri = Uri.parse(dir.optString("uri", ""));
                DocumentFile root = DocumentFile.fromTreeUri(context, uri);
                boolean readable = root != null && root.isDirectory() && root.canRead();
                String name = safeLibraryName(dir.optString("name", readable ? root.getName() : ""), "Android Music");
                int musicCount = readable ? countMusicFiles(root) : 0;
                if (musicCount > 0) hasPersonalMusic = true;
                JSONObject out = new JSONObject();
                out.put("uri", dir.optString("uri", ""));
                out.put("name", name);
                out.put("prefix", safeLibraryName(dir.optString("prefix", ""), name));
                out.put("enabled", dir.optBoolean("enabled", true));
                out.put("readable", readable);
                out.put("musicCount", musicCount);
                outDirs.put(out);
            }
            settings.put("includedAvailable", bundledDistAvailable());
            settings.put("includedVisible", prefs.getBoolean(AndroidLibraryCatalog.PREF_SHOW_INCLUDED_MUSIC, true));
            settings.put("includedDeleted", prefs.getBoolean(AndroidLibraryCatalog.PREF_INCLUDED_MUSIC_DELETED, false));
            settings.put("includedControlsEnabled", hasPersonalMusic);
            settings.put("hasPersonalMusic", hasPersonalMusic);
            settings.put("dirs", outDirs);
        } catch (JSONException err) {
            log("warn", "Could not build library settings: " + err.getMessage());
        }
        return settings;
    }

    private boolean bundledDistAvailable() {
        try {
            String[] names = context.getAssets().list("dist");
            return names != null && names.length > 0;
        } catch (IOException err) {
            return false;
        }
    }

    private int countMusicFiles(DocumentFile node) {
        if (node == null) return 0;
        if (node.isFile()) {
            String kind = classifyFile(node.getName() == null ? "" : node.getName());
            return ("archive".equals(kind) || "playable".equals(kind)) ? 1 : 0;
        }
        if (!node.isDirectory()) return 0;
        int count = 0;
        for (DocumentFile child : node.listFiles()) {
            count += countMusicFiles(child);
            if (count > 0) return count;
        }
        return count;
    }

    private void scanAssetDirectory(String assetDir, String relativePrefix, JSONArray items) throws IOException {
        AssetManager assets = context.getAssets();
        String[] names = assets.list(assetDir);
        if (names == null) return;
        for (String name : names) {
            if (name == null || name.isEmpty() || name.startsWith(".")) continue;
            String assetPath = assetDir + "/" + name;
            String relativePath = relativePrefix + name;
            String[] children = assets.list(assetPath);
            if (children != null && children.length > 0) scanAssetDirectory(assetPath, relativePath + "/", items);
            else addAssetLibraryItem(assetPath, relativePath, name, items);
        }
    }

    private void addAssetLibraryItem(String assetPath, String relativePath, String name, JSONArray items) {
        JSONObject item = new JSONObject();
        try {
            item.put("url", ASSET_BASE + Uri.encode(assetPath, "/"));
            item.put("name", name);
            item.put("relativePath", relativePath);
            item.put("nativePath", "apk/assets/" + assetPath);
            item.put("kind", classifyFile(name));
            item.put("sizeBytes", assetSize(assetPath));
            item.put("mtime", 0);
            items.put(item);
        } catch (JSONException err) {
            log("warn", "Skipping bundled asset with invalid metadata: " + assetPath);
        }
    }

    private long assetSize(String assetPath) {
        try (AssetFileDescriptor descriptor = context.getAssets().openFd(assetPath)) {
            return Math.max(0, descriptor.getLength());
        } catch (IOException err) {
            return 0;
        }
    }

    private void scanDocumentFile(DocumentFile node, String relativePrefix, JSONArray items) {
        if (node == null) return;
        if (node.isDirectory()) {
            for (DocumentFile child : node.listFiles()) {
                String childPrefix = relativePrefix;
                if (child != null && child.isDirectory()) {
                    String childName = child.getName();
                    if (childName != null && !childName.isEmpty()) childPrefix = relativePrefix + childName + "/";
                }
                scanDocumentFile(child, childPrefix, items);
            }
            return;
        }
        if (!node.isFile()) return;
        String name = node.getName();
        if (name == null || name.startsWith(".")) return;
        String id = "f" + nextFileId.getAndIncrement();
        fileHandles.put(id, node.getUri());
        JSONObject item = new JSONObject();
        try {
            item.put("url", "https://vgmplay.local/file/" + id + "/" + Uri.encode(name));
            item.put("name", name);
            item.put("relativePath", relativePrefix + name);
            item.put("nativePath", "android/" + relativePrefix + name);
            item.put("kind", classifyFile(name));
            item.put("sizeBytes", Math.max(0, node.length()));
            item.put("mtime", Math.max(0, node.lastModified()));
            items.put(item);
        } catch (JSONException err) {
            log("warn", "Skipping file with invalid metadata: " + name);
        }
    }

    private String classifyFile(String name) {
        String ext = extensionOf(name);
        if (isArchive(ext)) return "archive";
        if (isImage(ext)) return "image";
        if (isPlayable(ext)) return "playable";
        return "unsupported";
    }

    private boolean isArchive(String ext) {
        return ext.equals("zip") || ext.equals("7z") || ext.equals("rar") || ext.equals("tar")
            || ext.equals("gz") || ext.equals("tgz") || ext.equals("bz2") || ext.equals("xz")
            || ext.equals("lha") || ext.equals("lzh") || ext.equals("rsn") || ext.equals("vgmz")
            || ext.equals("vgmdz") || ext.equals("vgmpack") || ext.equals("vigamup");
    }

    private boolean isImage(String ext) {
        return ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg") || ext.equals("webp") || ext.equals("gif");
    }

    private boolean isPlayable(String ext) {
        return ext.equals("vgm") || ext.equals("vgz") || ext.equals("nsf") || ext.equals("nsfe")
            || ext.equals("spc") || ext.equals("gym") || ext.equals("sid") || ext.equals("psid")
            || ext.equals("rsid") || ext.equals("kss") || ext.equals("hes")
            || ext.equals("ssf") || ext.equals("minissf") || ext.equals("psf") || ext.equals("psf2")
            || ext.equals("usf") || ext.equals("miniusf") || ext.equals("gsf") || ext.equals("minigsf")
            || ext.equals("2sf") || ext.equals("mini2sf") || ext.equals("dsf") || ext.equals("minidsf")
            || ext.equals("qsf") || ext.equals("miniqsf") || ext.equals("xm") || ext.equals("mod")
            || ext.equals("s3m") || ext.equals("it") || ext.equals("mptm") || ext.equals("lmp")
            || ext.equals("sap") || ext.equals("ay") || ext.equals("gbs") || ext.equals("flac")
            || ext.equals("ape") || ext.equals("mid") || ext.equals("midi") || ext.equals("mwm")
            || ext.equals("mgs");
    }

    private String extensionOf(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String safeLibraryName(String value, String fallback) {
        String name = value == null ? "" : value.trim();
        return name.isEmpty() ? fallback : name;
    }

    private JSONObject parseObjectPref(String key) {
        String value = prefs.getString(key, "{}");
        try {
            return new JSONObject(value == null || value.isEmpty() ? "{}" : value);
        } catch (JSONException err) {
            return new JSONObject();
        }
    }

    private JSONObject buildInfo() {
        JSONObject info = new JSONObject();
        try {
            info.put("platform", "Android");
            info.put("versionName", BuildConfig.VERSION_NAME);
            info.put("versionCode", BuildConfig.VERSION_CODE);
            info.put("buildTime", BuildConfig.BUILD_STAMP);
        } catch (JSONException ignored) {}
        return info;
    }

    private JSONObject readLastTrackState() {
        File file = new File(context.getFilesDir(), LAST_TRACK_FILE);
        if (!file.isFile()) return new JSONObject();
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read);
            return new JSONObject(output.toString("UTF-8"));
        } catch (IOException | JSONException err) {
            return new JSONObject();
        }
    }

    private void writeLastTrackState(JSONObject payload) {
        try (FileOutputStream output = new FileOutputStream(new File(context.getFilesDir(), LAST_TRACK_FILE))) {
            output.write(payload.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (IOException err) {
            log("warn", "Could not save last track JSON: " + err.getMessage());
        }
    }

    private WebResourceResponse handleNativeImageRequest(Uri uri) {
        if (!"vgmplay".equals(uri == null ? "" : uri.getScheme())) return null;
        String imagePath = decodeVgmplayImagePath(uri);
        File file = new File(context.getFilesDir(), "archive-images/" + sanitizeImageKey(imagePath));
        if (!file.isFile()) return null;
        try {
            return new WebResourceResponse(mimeForName(file.getName()), "UTF-8", new FileInputStream(file));
        } catch (IOException err) {
            return null;
        }
    }

    private String decodeVgmplayImagePath(Uri uri) {
        String imagePath = uri == null ? "" : uri.getSchemeSpecificPart();
        if (imagePath == null) imagePath = "";
        if (imagePath.startsWith("//")) imagePath = imagePath.substring(2);
        int query = imagePath.indexOf('?');
        if (query >= 0) imagePath = imagePath.substring(0, query);
        int fragment = imagePath.indexOf('#');
        if (fragment >= 0) imagePath = imagePath.substring(0, fragment);
        return Uri.decode(imagePath);
    }

    private File imageFileForPath(String imagePath) {
        File dir = new File(context.getFilesDir(), "archive-images");
        if (!dir.exists() && !dir.mkdirs()) log("warn", "Could not create archive image directory: " + dir);
        return new File(dir, sanitizeImageKey(imagePath));
    }

    private String sanitizeImageKey(String value) {
        String key = value == null ? "image" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return key.length() > 180 ? key.substring(key.length() - 180) : key;
    }

    private String mimeForName(String name) {
        String ext = extensionOf(name);
        if (ext.equals("wasm")) return "application/wasm";
        if (ext.equals("js")) return "application/javascript";
        if (ext.equals("css")) return "text/css";
        if (ext.equals("html")) return "text/html";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "application/octet-stream" : mime;
    }

    private void log(String level, String message) {
        if (callback != null) callback.onLog(level, message == null ? "" : message);
        if ("error".equals(level)) Log.e(TAG, message == null ? "" : message);
        else if ("warn".equals(level)) Log.w(TAG, message == null ? "" : message);
        else Log.i(TAG, message == null ? "" : message);
    }

    private final class SafFileHandler implements WebViewAssetLoader.PathHandler {
        @Override
        public WebResourceResponse handle(String path) {
            String normalized = path.startsWith("/") ? path.substring(1) : path;
            if (normalized.startsWith("file/")) normalized = normalized.substring("file/".length());
            int slash = normalized.indexOf('/');
            String id = slash >= 0 ? normalized.substring(0, slash) : normalized;
            Uri uri = fileHandles.get(id);
            if (uri == null) return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("Unknown file".getBytes()));
            try {
                InputStream stream = context.getContentResolver().openInputStream(uri);
                String name = slash >= 0 ? Uri.decode(normalized.substring(slash + 1)) : id;
                return new WebResourceResponse(mimeForName(name), null, stream);
            } catch (IOException err) {
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("Could not read file".getBytes()));
            }
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public String getInitialState() {
            JSONObject state = new JSONObject();
            try {
                state.put("config", parseObjectPref("config"));
                state.put("firstRun", !prefs.contains("config"));
                state.put("archiveMeta", parseObjectPref("archiveMeta"));
                state.put("trackMeta", parseObjectPref("trackMeta"));
                state.put("lastTrack", readLastTrackState());
                state.put("librarySettings", buildLibrarySettings(loadLibraryDirs()));
                state.put("buildInfo", buildInfo());
                state.put("homeRoms", new JSONArray());
            } catch (JSONException err) {
                log("warn", "Failed to build initial bridge state: " + err.getMessage());
            }
            return state.toString();
        }

        @JavascriptInterface
        public void postMessage(String name, String json) {
            try {
                JSONObject payload = new JSONObject(json == null || json.isEmpty() ? "{}" : json);
                if ("nativeSaveConfig".equals(name)) {
                    prefs.edit().putString("config", payload.toString()).apply();
                } else if ("nativeSaveArchiveMeta".equals(name)) {
                    prefs.edit().putString("archiveMeta", decodeArchiveMetaPayload(payload)).apply();
                } else if ("nativeSaveTrackMeta".equals(name)) {
                    prefs.edit().putString("trackMeta", payload.toString()).apply();
                } else if ("nativeSaveLastTrack".equals(name)) {
                    writeLastTrackState(payload);
                } else if ("nativeSaveArchiveImage".equals(name)) {
                    saveArchiveImage(payload);
                } else if ("nativeMediaState".equals(name)) {
                    if (callback != null) callback.onMediaState(payload);
                } else if ("nativeMediaPrepareState".equals(name)) {
                    if (callback != null) callback.onPrepareState(payload);
                } else if ("nativeForceAudioFocus".equals(name)) {
                    if (callback != null) callback.onRequestAudioRouteRefresh();
                } else if ("nativeOpenFolder".equals(name)) {
                    log("info", "Open folder requested from service WebView; ignored");
                }
            } catch (JSONException err) {
                log("warn", "Invalid bridge payload for " + name + ": " + err.getMessage());
            }
        }

        @JavascriptInterface
        public void log(String level, String message) {
            AndroidPlaybackEngineHost.this.log(level, message);
        }

        private void saveArchiveImage(JSONObject payload) {
            String imagePath = payload.optString("path", "");
            String data = payload.optString("data", "");
            if (imagePath.isEmpty() || data.isEmpty()) return;
            int comma = data.indexOf(',');
            String base64 = comma >= 0 ? data.substring(comma + 1) : data;
            try (FileOutputStream output = new FileOutputStream(imageFileForPath(imagePath))) {
                output.write(Base64.decode(base64, Base64.DEFAULT));
            } catch (IOException | IllegalArgumentException err) {
                log("warn", "Could not save archive image: " + err.getMessage());
            }
        }

        private String decodeArchiveMetaPayload(JSONObject payload) {
            if (!"base64-json".equals(payload.optString("encoding"))) return payload.toString();
            String data = payload.optString("data", "");
            if (data.isEmpty()) return "{}";
            try {
                return new String(Base64.decode(data, Base64.DEFAULT), java.nio.charset.StandardCharsets.UTF_8);
            } catch (IllegalArgumentException err) {
                return "{}";
            }
        }
    }
}
