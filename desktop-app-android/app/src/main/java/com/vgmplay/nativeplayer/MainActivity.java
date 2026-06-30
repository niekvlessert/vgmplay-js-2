package com.vgmplay.nativeplayer;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.documentfile.provider.DocumentFile;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends Activity {
    private static final String TAG = "VGMPlayAndroid";
    private static final int REQUEST_OPEN_TREE = 10;
    private static final int REQUEST_POST_NOTIFICATIONS = 20;
    private static final int MEDIA_NOTIFICATION_ID = 1001;
    private static final String MEDIA_CHANNEL_ID = "vgmplay_media";
    private static final String ACTION_MEDIA_PLAY_PAUSE = "com.vgmplay.nativeplayer.MEDIA_PLAY_PAUSE";
    private static final String ACTION_MEDIA_PREVIOUS = "com.vgmplay.nativeplayer.MEDIA_PREVIOUS";
    private static final String ACTION_MEDIA_NEXT = "com.vgmplay.nativeplayer.MEDIA_NEXT";
    private static final String ACTION_MEDIA_STOP = "com.vgmplay.nativeplayer.MEDIA_STOP";
    private static final String ASSET_BASE = "https://vgmplay.local/assets/";
    private static final String START_PAGE = ASSET_BASE + "native-index.html";
    private static final String PREF_LIBRARY_TREE_URI = "libraryTreeUri";
    private static final String PREF_LIBRARY_DIRS = "libraryDirs";
    private static final String PREF_SHOW_INCLUDED_MUSIC = "showIncludedMusic";
    private static final String PREF_INCLUDED_MUSIC_DELETED = "includedMusicDeleted";
    private static final String COMBINED_ROOT_NAME = "Music Libraries";
    private static final String COMBINED_ROOT_PATH = "android://libraries";
    private static final String INCLUDED_LABEL = "Included Music";
    private static final String FOLDER_PICKER_HELP =
        "Android blocks selecting storage root, Download, Android/data, and Android/obb. "
            + "Choose or create a music subfolder instead.";

    private final Map<String, Uri> fileHandles = new HashMap<>();
    private final AtomicInteger nextFileId = new AtomicInteger(1);

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private SharedPreferences prefs;
    private MediaSession mediaSession;
    private NotificationManager notificationManager;
    private boolean initialLibraryLoaded;
    private boolean pageReady;
    private String pendingPlayNativePath = "";
    private String pendingPlayTitle = "";
    private boolean mediaNotificationAllowed;
    private String mediaTitle = "VGMPlay-JS";
    private String mediaSource = "";
    private boolean mediaPlaying;
    private boolean mediaPaused;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureFullscreenWindow();

        WebView.setWebContentsDebuggingEnabled(true);

        prefs = getSharedPreferences("vgmplay-native", MODE_PRIVATE);
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        initMediaSession();
        requestNotificationPermissionIfNeeded();
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("vgmplay.local")
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/file/", new SafFileHandler())
            .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(26, 27, 38));
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
                String message = "JS Console [" + consoleMessage.messageLevel() + "]: "
                    + consoleMessage.message() + " @ "
                    + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber();
                switch (consoleMessage.messageLevel()) {
                    case ERROR:
                        Log.e(TAG, message);
                        break;
                    case WARNING:
                        Log.w(TAG, message);
                        break;
                    default:
                        Log.i(TAG, message);
                        break;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse imageResponse = handleNativeImageRequest(request.getUrl());
                if (imageResponse != null) return imageResponse;
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pageReady = true;
                loadInitialLibrary();
                flushPendingAutoPlay();
            }
        });

        webView.clearCache(true);
        setContentView(webView);
        applySystemBarInsets(webView);
        hideSystemBars();

        webView.loadUrl(START_PAGE + "?v=" + System.currentTimeMillis());
        handleMediaIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMediaIntent(intent);
    }

    @Override
    protected void onDestroy() {
        if (notificationManager != null) {
            notificationManager.cancel(MEDIA_NOTIFICATION_ID);
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            mediaNotificationAllowed = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            updateMediaNotification();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void configureFullscreenWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(26, 27, 38));
        window.setNavigationBarColor(Color.rgb(26, 27, 38));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        }
    }

    private void hideSystemBars() {
        Window window = getWindow();
        View decor = window.getDecorView();
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    private void applySystemBarInsets(View root) {
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top = 0;
            int bottom = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Insets bars = insets.getInsets(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                boolean barsVisible = insets.isVisible(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                if (barsVisible) {
                    top = bars.top;
                    bottom = bars.bottom;
                }
            } else {
                int visibility = getWindow().getDecorView().getSystemUiVisibility();
                boolean statusVisible = (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0;
                boolean navVisible = (visibility & View.SYSTEM_UI_FLAG_HIDE_NAVIGATION) == 0;
                if (statusVisible) top = insets.getSystemWindowInsetTop();
                if (navVisible) bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(0, top, 0, bottom);
            return insets;
        });
        root.requestApplyInsets();
    }

    private void requestNotificationPermissionIfNeeded() {
        mediaNotificationAllowed = Build.VERSION.SDK_INT < 33
            || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        if (!mediaNotificationAllowed && Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_POST_NOTIFICATIONS);
        }
    }

    private void initMediaSession() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            NotificationChannel channel = new NotificationChannel(
                MEDIA_CHANNEL_ID,
                "VGMPlay playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Playback controls for VGMPlay-JS");
            notificationManager.createNotificationChannel(channel);
        }
        mediaSession = new MediaSession(this, "VGMPlay-JS");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendWebMediaAction("playPause");
            }

            @Override
            public void onPause() {
                sendWebMediaAction("playPause");
            }

            @Override
            public void onSkipToPrevious() {
                sendWebMediaAction("previous");
            }

            @Override
            public void onSkipToNext() {
                sendWebMediaAction("next");
            }

            @Override
            public void onStop() {
                sendWebMediaAction("stop");
            }
        });
        mediaSession.setActive(true);
        updatePlaybackState();
    }

    private void handleMediaIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        switch (intent.getAction()) {
            case AndroidMediaContract.ACTION_MEDIA_PLAY_PAUSE:
                sendWebMediaAction("playPause");
                break;
            case AndroidMediaContract.ACTION_MEDIA_PREVIOUS:
                sendWebMediaAction("previous");
                break;
            case AndroidMediaContract.ACTION_MEDIA_NEXT:
                sendWebMediaAction("next");
                break;
            case AndroidMediaContract.ACTION_MEDIA_STOP:
                sendWebMediaAction("stop");
                break;
            case AndroidMediaContract.ACTION_PLAY_MEDIA_ID:
                pendingPlayNativePath = intent.getStringExtra(AndroidMediaContract.EXTRA_NATIVE_PATH);
                pendingPlayTitle = intent.getStringExtra(AndroidMediaContract.EXTRA_TITLE);
                if (pendingPlayNativePath == null) pendingPlayNativePath = "";
                if (pendingPlayTitle == null) pendingPlayTitle = "";
                flushPendingAutoPlay();
                break;
            default:
                break;
        }
    }

    private void sendWebMediaAction(String action) {
        if (webView == null) return;
        hideSystemBars();
        String jsAction = JSONObject.quote(action);
        webView.post(() -> webView.evaluateJavascript(
            "(function(action){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(!app)return;"
                + "if(action==='playPause')app.togglePlay();"
                + "else if(action==='previous')app.prevTrack();"
                + "else if(action==='next')app.nextTrack();"
                + "else if(action==='stop')app.stop();"
            + "})(" + jsAction + ");",
            null
        ));
    }

    private PendingIntent mediaPendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(action);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, requestCode, intent, flags);
    }

    private void flushPendingAutoPlay() {
        if (webView == null || !pageReady || pendingPlayNativePath == null || pendingPlayNativePath.isEmpty()) return;
        String nativePath = JSONObject.quote(pendingPlayNativePath);
        String title = JSONObject.quote(pendingPlayTitle == null ? "" : pendingPlayTitle);
        pendingPlayNativePath = "";
        pendingPlayTitle = "";
        webView.post(() -> webView.evaluateJavascript(
            "(function(nativePath,title){"
                + "var attempts=0;"
                + "function play(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(app&&app.playNativeCatalogItem){app.playNativeCatalogItem(nativePath,title);return;}"
                + "if(++attempts<100)setTimeout(play,100);"
                + "}"
                + "play();"
            + "})(" + nativePath + "," + title + ");",
            null
        ));
    }

    private void updateNativeMediaState(JSONObject payload) {
        boolean nextPlaying = payload.optBoolean("playing", false);
        boolean nextPaused = payload.optBoolean("paused", false);
        boolean explicitStop = payload.optBoolean("stopped", false);
        if (!nextPlaying && !nextPaused && !explicitStop && (mediaPlaying || mediaPaused)) {
            return;
        }
        mediaTitle = payload.optString("title", mediaTitle == null || mediaTitle.isEmpty() ? "VGMPlay-JS" : mediaTitle);
        mediaSource = payload.optString("source", mediaSource == null ? "" : mediaSource);
        mediaPlaying = nextPlaying;
        mediaPaused = nextPaused;
        long durationMs = payload.optLong("durationMs", 0);
        updatePlaybackState();
        updateMediaMetadata(durationMs);
        updateMediaNotification();
        broadcastMediaState(durationMs);
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;
        long actions = PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_STOP;
        int state;
        if (mediaPlaying) state = PlaybackState.STATE_PLAYING;
        else if (mediaPaused) state = PlaybackState.STATE_PAUSED;
        else state = PlaybackState.STATE_STOPPED;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, mediaPlaying ? 1f : 0f)
            .build());
    }

    private void updateMediaMetadata(long durationMs) {
        if (mediaSession == null) return;
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, mediaTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, mediaSource)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "VGMPlay-JS");
        if (durationMs > 0) builder.putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        mediaSession.setMetadata(builder.build());
    }

    private void broadcastMediaState(long durationMs) {
        Intent intent = new Intent(AndroidMediaContract.ACTION_MEDIA_STATE);
        intent.setPackage(getPackageName());
        intent.putExtra(AndroidMediaContract.EXTRA_TITLE, mediaTitle);
        intent.putExtra(AndroidMediaContract.EXTRA_SOURCE, mediaSource);
        intent.putExtra(AndroidMediaContract.EXTRA_PLAYING, mediaPlaying);
        intent.putExtra(AndroidMediaContract.EXTRA_PAUSED, mediaPaused);
        intent.putExtra(AndroidMediaContract.EXTRA_DURATION_MS, durationMs);
        sendBroadcast(intent);
    }

    private void updateMediaNotification() {
        if (notificationManager == null || mediaSession == null) return;
        if (!mediaPlaying && !mediaPaused) {
            notificationManager.cancel(MEDIA_NOTIFICATION_ID);
            return;
        }
        if (!mediaNotificationAllowed) return;

        Notification.Action previous = new Notification.Action.Builder(
            android.R.drawable.ic_media_previous,
            "Previous",
            mediaPendingIntent(ACTION_MEDIA_PREVIOUS, 1)
        ).build();
        Notification.Action playPause = new Notification.Action.Builder(
            mediaPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            mediaPlaying ? "Pause" : "Play",
            mediaPendingIntent(ACTION_MEDIA_PLAY_PAUSE, 2)
        ).build();
        Notification.Action next = new Notification.Action.Builder(
            android.R.drawable.ic_media_next,
            "Next",
            mediaPendingIntent(ACTION_MEDIA_NEXT, 3)
        ).build();
        Notification.Action stop = new Notification.Action.Builder(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop",
            mediaPendingIntent(ACTION_MEDIA_STOP, 4)
        ).build();

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, MEDIA_CHANNEL_ID)
            : new Notification.Builder(this);
        Notification notification = builder
            .setSmallIcon(R.drawable.ic_stat_vgmplay)
            .setContentTitle(mediaTitle)
            .setContentText(mediaSource)
            .setSubText("VGMPlay-JS")
            .setContentIntent(mediaPendingIntent(Intent.ACTION_MAIN, 5))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(mediaPlaying)
            .setShowWhen(false)
            .addAction(previous)
            .addAction(playPause)
            .addAction(next)
            .addAction(stop)
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .build();
        notificationManager.notify(MEDIA_NOTIFICATION_ID, notification);
    }

    private void openMusicFolder() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_OPEN_TREE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_OPEN_TREE || resultCode != RESULT_OK || data == null || data.getData() == null) {
            if (requestCode == REQUEST_OPEN_TREE) {
                Toast.makeText(this, FOLDER_PICKER_HELP, Toast.LENGTH_LONG).show();
            }
            return;
        }

        Uri treeUri = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContentResolver().takePersistableUriPermission(treeUri, flags & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException err) {
            Log.w(TAG, "Could not persist folder permission", err);
        }
        addLibraryFolder(treeUri);
        loadVisibleLibraries();
    }

    private void loadInitialLibrary() {
        if (initialLibraryLoaded) return;
        initialLibraryLoaded = true;
        migrateLegacyLibraryFolder();
        loadVisibleLibraries();
    }

    private void migrateLegacyLibraryFolder() {
        String savedTree = prefs.getString(PREF_LIBRARY_TREE_URI, "");
        if (savedTree != null && !savedTree.isEmpty()) {
            JSONArray dirs = loadLibraryDirs();
            if (findLibraryDir(dirs, savedTree) < 0) {
                Uri treeUri = Uri.parse(savedTree);
                DocumentFile root = DocumentFile.fromTreeUri(this, treeUri);
                if (root != null && root.isDirectory()) {
                    JSONObject dir = new JSONObject();
                    try {
                        dir.put("uri", savedTree);
                        dir.put("name", safeLibraryName(root.getName(), "Android Music"));
                        dir.put("enabled", true);
                        dirs.put(dir);
                        saveLibraryDirs(dirs);
                    } catch (JSONException err) {
                        Log.w(TAG, "Could not migrate saved music folder", err);
                    }
                }
            }
            prefs.edit().remove(PREF_LIBRARY_TREE_URI).apply();
        }
    }

    private void addLibraryFolder(Uri treeUri) {
        String uriText = treeUri.toString();
        JSONArray dirs = loadLibraryDirs();
        int existing = findLibraryDir(dirs, uriText);
        DocumentFile root = DocumentFile.fromTreeUri(this, treeUri);
        String name = safeLibraryName(root == null ? "" : root.getName(), "Android Music");
        try {
            if (existing >= 0) {
                JSONObject dir = dirs.getJSONObject(existing);
                dir.put("name", name);
                dir.put("enabled", true);
            } else {
                JSONObject dir = new JSONObject();
                dir.put("uri", uriText);
                dir.put("name", name);
                dir.put("enabled", true);
                dirs.put(dir);
            }
            saveLibraryDirs(dirs);
        } catch (JSONException err) {
            Log.w(TAG, "Could not save selected music folder", err);
        }
    }

    private void loadVisibleLibraries() {
        fileHandles.clear();
        nextFileId.set(1);

        JSONArray dirs = loadLibraryDirs();
        JSONObject payload = new JSONObject();
        JSONArray items = new JSONArray();
        JSONObject settings = buildLibrarySettings(dirs);
        boolean showIncluded = settings.optBoolean("includedVisible", true)
            && !settings.optBoolean("includedDeleted", false);

        if (showIncluded) {
            try {
                scanAssetDirectory("dist", INCLUDED_LABEL + "/", items);
            } catch (IOException err) {
                Log.e(TAG, "Could not scan bundled dist assets", err);
            }
        }

        for (int i = 0; i < dirs.length(); i++) {
            try {
                JSONObject dir = dirs.getJSONObject(i);
                if (!dir.optBoolean("enabled", true)) continue;
                Uri uri = Uri.parse(dir.optString("uri", ""));
                DocumentFile root = DocumentFile.fromTreeUri(this, uri);
                if (root == null || !root.isDirectory() || !root.canRead()) continue;
                String label = safeLibraryName(dir.optString("prefix", ""), safeLibraryName(dir.optString("name", root.getName()), "Android Music"));
                scanDocumentFile(root, label + "/", items);
            } catch (RuntimeException | JSONException err) {
                Log.w(TAG, "Could not scan stored music folder", err);
            }
        }

        try {
            JSONObject options = new JSONObject();
            options.put("rootName", COMBINED_ROOT_NAME);
            options.put("rootPath", COMBINED_ROOT_PATH);
            options.put("librarySettings", settings);
            payload.put("items", items);
            payload.put("options", options);
        } catch (JSONException err) {
            Log.e(TAG, "Failed to build library payload", err);
            return;
        }

        loadNativeLibraryPayload(payload);
    }

    private void scanAssetDirectory(String assetDir, String relativePrefix, JSONArray items) throws IOException {
        AssetManager assets = getAssets();
        String[] names = assets.list(assetDir);
        if (names == null) return;
        for (String name : names) {
            if (name == null || name.isEmpty() || name.startsWith(".")) continue;
            String assetPath = assetDir + "/" + name;
            String relativePath = relativePrefix + name;
            String[] children = assets.list(assetPath);
            if (children != null && children.length > 0) {
                scanAssetDirectory(assetPath, relativePath + "/", items);
            } else {
                addAssetLibraryItem(assetPath, relativePath, name, items);
            }
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
            Log.w(TAG, "Skipping bundled asset with invalid metadata: " + assetPath, err);
        }
    }

    private long assetSize(String assetPath) {
        try (AssetFileDescriptor descriptor = getAssets().openFd(assetPath)) {
            return Math.max(0, descriptor.getLength());
        } catch (IOException err) {
            return 0;
        }
    }

    private JSONArray loadLibraryDirs() {
        String raw = prefs.getString(PREF_LIBRARY_DIRS, "[]");
        try {
            return new JSONArray(raw == null || raw.isEmpty() ? "[]" : raw);
        } catch (JSONException err) {
            Log.w(TAG, "Ignoring invalid library folder list", err);
            return new JSONArray();
        }
    }

    private void saveLibraryDirs(JSONArray dirs) {
        prefs.edit().putString(PREF_LIBRARY_DIRS, dirs == null ? "[]" : dirs.toString()).apply();
    }

    private int findLibraryDir(JSONArray dirs, String uriText) {
        if (dirs == null || uriText == null) return -1;
        for (int i = 0; i < dirs.length(); i++) {
            JSONObject dir = dirs.optJSONObject(i);
            if (dir != null && uriText.equals(dir.optString("uri", ""))) return i;
        }
        return -1;
    }

    private String safeLibraryName(String value, String fallback) {
        String name = value == null ? "" : value.trim();
        return name.isEmpty() ? fallback : name;
    }

    private String uniqueLibraryLabel(String baseName, Map<String, Integer> counts) {
        String base = safeLibraryName(baseName, "Android Music");
        int count = counts.containsKey(base) ? counts.get(base) + 1 : 1;
        counts.put(base, count);
        return count <= 1 ? base : base + " (" + count + ")";
    }

    private JSONObject buildLibrarySettings(JSONArray dirs) {
        JSONObject settings = new JSONObject();
        JSONArray outDirs = new JSONArray();
        boolean hasPersonalMusic = false;
        Map<String, Integer> labelCounts = new HashMap<>();
        try {
            for (int i = 0; i < dirs.length(); i++) {
                JSONObject dir = dirs.getJSONObject(i);
                String uriText = dir.optString("uri", "");
                Uri uri = Uri.parse(uriText);
                DocumentFile root = DocumentFile.fromTreeUri(this, uri);
                boolean readable = root != null && root.isDirectory() && root.canRead();
                String name = safeLibraryName(dir.optString("name", readable ? root.getName() : ""), "Android Music");
                String prefix = uniqueLibraryLabel(name, labelCounts);
                int musicCount = readable ? countMusicFiles(root) : 0;
                if (musicCount > 0) hasPersonalMusic = true;
                JSONObject out = new JSONObject();
                out.put("uri", uriText);
                out.put("name", name);
                out.put("prefix", prefix);
                out.put("enabled", dir.optBoolean("enabled", true));
                out.put("readable", readable);
                out.put("musicCount", musicCount);
                outDirs.put(out);
                dir.put("name", name);
                dir.put("prefix", prefix);
            }
            saveLibraryDirs(dirs);
            settings.put("includedAvailable", bundledDistAvailable());
            settings.put("includedVisible", prefs.getBoolean(PREF_SHOW_INCLUDED_MUSIC, true));
            settings.put("includedDeleted", prefs.getBoolean(PREF_INCLUDED_MUSIC_DELETED, false));
            settings.put("includedControlsEnabled", hasPersonalMusic);
            settings.put("hasPersonalMusic", hasPersonalMusic);
            settings.put("dirs", outDirs);
        } catch (JSONException err) {
            Log.w(TAG, "Could not build library settings", err);
        }
        return settings;
    }

    private boolean bundledDistAvailable() {
        try {
            String[] names = getAssets().list("dist");
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

    private void handleLibraryCommand(JSONObject payload) {
        String command = payload.optString("command", "");
        if ("setIncludedVisible".equals(command)) {
            prefs.edit().putBoolean(PREF_SHOW_INCLUDED_MUSIC, payload.optBoolean("visible", true)).apply();
            loadVisibleLibraries();
        } else if ("deleteIncludedMusic".equals(command)) {
            prefs.edit()
                .putBoolean(PREF_INCLUDED_MUSIC_DELETED, true)
                .putBoolean(PREF_SHOW_INCLUDED_MUSIC, false)
                .apply();
            pruneMetadataForPrefix(INCLUDED_LABEL + "/");
            pruneMetadataForKeyPrefix("Bundled Music|");
            pruneMetadataForKeyPrefix("apk://assets/dist|");
            loadVisibleLibraries();
        } else if ("setFolderVisible".equals(command)) {
            updateLibraryFolder(payload.optString("uri", ""), "", payload.optBoolean("visible", true), false);
            loadVisibleLibraries();
        } else if ("deleteFolder".equals(command)) {
            updateLibraryFolder(payload.optString("uri", ""), payload.optString("prefix", ""), false, true);
            loadVisibleLibraries();
        }
    }

    private void updateLibraryFolder(String uriText, String prefix, boolean visible, boolean remove) {
        JSONArray dirs = loadLibraryDirs();
        JSONArray next = new JSONArray();
        for (int i = 0; i < dirs.length(); i++) {
            JSONObject dir = dirs.optJSONObject(i);
            if (dir == null) continue;
            if (uriText.equals(dir.optString("uri", ""))) {
                if (remove) {
                    String deletePrefix = safeLibraryName(prefix, dir.optString("prefix", ""));
                    pruneMetadataForPrefix(safeLibraryName(deletePrefix, safeLibraryName(dir.optString("name", ""), "Android Music")) + "/");
                    pruneMetadataForKeyPrefix(safeLibraryName(dir.optString("name", ""), "Android Music") + "|");
                    continue;
                }
                try {
                    dir.put("enabled", visible);
                } catch (JSONException err) {
                    Log.w(TAG, "Could not update library folder visibility", err);
                }
            }
            next.put(dir);
        }
        saveLibraryDirs(next);
    }

    private void pruneMetadataForPrefix(String prefix) {
        pruneMetadataForKeyPrefix(COMBINED_ROOT_PATH + "|" + prefix);
        pruneMetadataForKeyPrefix(COMBINED_ROOT_NAME + "|" + prefix);
    }

    private void pruneMetadataForKeyPrefix(String keyPrefix) {
        pruneArchiveMetaForPrefix(keyPrefix);
        pruneTrackMetaForPrefix(keyPrefix);
    }

    private void pruneArchiveMetaForPrefix(String keyPrefix) {
        JSONObject archiveMeta = parseObjectPref("archiveMeta");
        JSONObject quick = archiveMeta.optJSONObject("quick");
        JSONObject packs = archiveMeta.optJSONObject("packsBySha");
        if (quick == null || packs == null) return;
        JSONArray names = quick.names();
        if (names == null) return;
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i, "");
            if (key.startsWith(keyPrefix)) quick.remove(key);
        }
        JSONArray packNames = packs.names();
        if (packNames != null) {
            for (int i = 0; i < packNames.length(); i++) {
                String sha = packNames.optString(i, "");
                if (!quickReferencesSha(quick, sha)) packs.remove(sha);
            }
        }
        prefs.edit().putString("archiveMeta", archiveMeta.toString()).apply();
    }

    private boolean quickReferencesSha(JSONObject quick, String sha) {
        JSONArray names = quick.names();
        if (names == null) return false;
        for (int i = 0; i < names.length(); i++) {
            if (sha.equals(quick.optString(names.optString(i, ""), ""))) return true;
        }
        return false;
    }

    private void pruneTrackMetaForPrefix(String keyPrefix) {
        JSONObject trackMeta = parseObjectPref("trackMeta");
        JSONObject tracks = trackMeta.optJSONObject("tracks");
        if (tracks == null) return;
        JSONArray names = tracks.names();
        if (names == null) return;
        for (int i = 0; i < names.length(); i++) {
            String key = names.optString(i, "");
            if (key.startsWith(keyPrefix)) tracks.remove(key);
        }
        prefs.edit().putString("trackMeta", trackMeta.toString()).apply();
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
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void scanDocumentFile(DocumentFile node, String relativePrefix, JSONArray items) {
        if (node == null) return;
        if (node.isDirectory()) {
            for (DocumentFile child : node.listFiles()) {
                String childPrefix = relativePrefix;
                if (child != null && child.isDirectory()) {
                    String childName = child.getName();
                    if (childName != null && !childName.isEmpty()) {
                        childPrefix = relativePrefix + childName + "/";
                    }
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

        String relativePath = relativePrefix + name;
        JSONObject item = new JSONObject();
        try {
            item.put("url", "https://vgmplay.local/file/" + id + "/" + Uri.encode(name));
            item.put("name", name);
            item.put("relativePath", relativePath);
            item.put("nativePath", "android/" + relativePath);
            item.put("kind", classifyFile(name));
            item.put("sizeBytes", Math.max(0, node.length()));
            item.put("mtime", Math.max(0, node.lastModified()));
            items.put(item);
        } catch (JSONException err) {
            Log.w(TAG, "Skipping file with invalid metadata: " + name, err);
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
            || ext.equals("lha") || ext.equals("lzh");
    }

    private boolean isImage(String ext) {
        return ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg") || ext.equals("webp") || ext.equals("gif");
    }

    private boolean isPlayable(String ext) {
        return ext.equals("vgm") || ext.equals("vgz") || ext.equals("nsf") || ext.equals("nsfe")
            || ext.equals("spc") || ext.equals("gym") || ext.equals("kss") || ext.equals("hes")
            || ext.equals("ssf") || ext.equals("minissf") || ext.equals("psf") || ext.equals("psf2")
            || ext.equals("usf") || ext.equals("miniusf") || ext.equals("gsf") || ext.equals("minigsf")
            || ext.equals("2sf") || ext.equals("mini2sf") || ext.equals("dsf") || ext.equals("minidsf")
            || ext.equals("qsf") || ext.equals("miniqsf") || ext.equals("xm") || ext.equals("mod")
            || ext.equals("s3m") || ext.equals("it") || ext.equals("mptm") || ext.equals("lmp")
            || ext.equals("sap") || ext.equals("ay") || ext.equals("gbs");
    }

    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private WebResourceResponse handleNativeImageRequest(Uri uri) {
        if (!"vgmplay".equals(uri.getScheme())) return null;
        String imagePath = uri.getHost() == null ? uri.getSchemeSpecificPart() : Uri.decode(uri.getHost());
        if (imagePath != null && imagePath.startsWith("//")) imagePath = imagePath.substring(2);
        File file = new File(getFilesDir(), "archive-images/" + sanitizeImageKey(imagePath));
        if (!file.isFile()) return null;
        try {
            return new WebResourceResponse(mimeForName(file.getName()), "UTF-8", new FileInputStream(file));
        } catch (IOException err) {
            Log.w(TAG, "Failed to serve native image", err);
            return null;
        }
    }

    private File imageFileForPath(String imagePath) {
        File dir = new File(getFilesDir(), "archive-images");
        if (!dir.exists() && !dir.mkdirs()) {
            Log.w(TAG, "Could not create archive image directory: " + dir);
        }
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

    private JSONObject parseObjectPref(String key) {
        String value = prefs.getString(key, "{}");
        try {
            return new JSONObject(value == null || value.isEmpty() ? "{}" : value);
        } catch (JSONException err) {
            Log.w(TAG, "Ignoring invalid saved JSON for " + key, err);
            return new JSONObject();
        }
    }

    private final class SafFileHandler implements WebViewAssetLoader.PathHandler {
        @Override
        public WebResourceResponse handle(String path) {
            String normalized = path.startsWith("/") ? path.substring(1) : path;
            if (normalized.startsWith("file/")) normalized = normalized.substring("file/".length());
            int slash = normalized.indexOf('/');
            String id = slash >= 0 ? normalized.substring(0, slash) : normalized;
            Uri uri = fileHandles.get(id);
            if (uri == null) {
                return new WebResourceResponse("text/plain", "UTF-8",
                    new ByteArrayInputStream("Unknown file".getBytes()));
            }
            try {
                InputStream stream = getContentResolver().openInputStream(uri);
                String name = slash >= 0 ? Uri.decode(normalized.substring(slash + 1)) : id;
                return new WebResourceResponse(mimeForName(name), null, stream);
            } catch (IOException err) {
                Log.e(TAG, "Failed to serve SAF file", err);
                return new WebResourceResponse("text/plain", "UTF-8",
                    new ByteArrayInputStream("Could not read file".getBytes()));
            }
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public String getInitialState() {
            JSONObject state = new JSONObject();
            try {
                state.put("config", parseObjectPref("config"));
                state.put("archiveMeta", parseObjectPref("archiveMeta"));
                state.put("trackMeta", parseObjectPref("trackMeta"));
                state.put("librarySettings", buildLibrarySettings(loadLibraryDirs()));
                state.put("homeRoms", new JSONArray());
            } catch (JSONException err) {
                Log.w(TAG, "Failed to build initial bridge state", err);
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
                } else if ("nativeSaveArchiveImage".equals(name)) {
                    saveArchiveImage(payload);
                } else if ("nativeLibraryCommand".equals(name)) {
                    handleLibraryCommand(payload);
                } else if ("nativeMediaState".equals(name)) {
                    updateNativeMediaState(payload);
                } else if ("nativeOpenFolder".equals(name)) {
                    runOnUiThread(() -> {
                        hideSystemBars();
                        openMusicFolder();
                    });
                } else if ("nativeOpenFile".equals(name)) {
                    Log.i(TAG, "nativeOpenFile is not used on Android");
                }
            } catch (JSONException err) {
                Log.w(TAG, "Invalid bridge payload for " + name, err);
            }
        }

        @JavascriptInterface
        public void log(String level, String message) {
            if ("error".equals(level)) {
                Log.e(TAG, message == null ? "" : message);
            } else if ("warn".equals(level)) {
                Log.w(TAG, message == null ? "" : message);
            } else {
                Log.i(TAG, message == null ? "" : message);
            }
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
                Log.w(TAG, "Could not save archive image", err);
            }
        }

        private String decodeArchiveMetaPayload(JSONObject payload) {
            if (!"base64-json".equals(payload.optString("encoding"))) return payload.toString();
            String data = payload.optString("data", "");
            if (data.isEmpty()) return "{}";
            try {
                return new String(Base64.decode(data, Base64.DEFAULT), java.nio.charset.StandardCharsets.UTF_8);
            } catch (IllegalArgumentException err) {
                Log.w(TAG, "Could not decode archive metadata payload", err);
                return "{}";
            }
        }
    }
}
