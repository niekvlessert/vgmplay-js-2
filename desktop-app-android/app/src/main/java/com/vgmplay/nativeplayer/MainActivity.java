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
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
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

import java.io.ByteArrayOutputStream;
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
    private static final String ACTION_MEDIA_PLAY = "com.vgmplay.nativeplayer.MEDIA_PLAY";
    private static final String ACTION_MEDIA_PAUSE = "com.vgmplay.nativeplayer.MEDIA_PAUSE";
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
    private static final String LAST_TRACK_FILE = "last-track.json";
    private static final long AUTO_PLAY_EXPIRY_MS = 8000;
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
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private AudioDeviceCallback audioDeviceCallback;
    private long lastAudioPrimerAt;
    private long lastPlaybackRouteRefreshAt;
    private boolean pendingAudioRouteRefresh;
    private boolean initialLibraryLoaded;
    private boolean pageReady;
    private String pendingPlayNativePath = "";
    private String pendingPlayTitle = "";
    private String pendingPlayArchivePath = "";
    private String pendingPlayArchiveTrackPathSuffix = "";
    private long pendingPlayPositionMs;
    private long pendingPlayCreatedAt;
    private String pendingMediaAction = "";
    private boolean pendingSeekAbsolute;
    private long pendingSeekPositionMs = -1;
    private long pendingSeekDeltaMs;
    private boolean mediaNotificationAllowed;
    private String mediaTitle = "VGMPlay-JS";
    private String mediaSource = "";
    private boolean mediaPlaying;
    private boolean mediaPaused;
    private long mediaDurationMs;
    private long mediaPositionMs;
    private int mediaLoopMode;
    private int mediaRandomMode;
    private String mediaLoopLabel = "Loop: Off";
    private String mediaRandomLabel = "Random: Off";
    private String mediaErrorMessage = "";
    private String lastMediaMetadataKey = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureFullscreenWindow();

        WebView.setWebContentsDebuggingEnabled(true);

        prefs = getSharedPreferences("vgmplay-native", MODE_PRIVATE);
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        initMediaSession();
        registerAudioDeviceRefreshCallback();
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
                flushPendingMediaAction();
                flushPendingAudioRouteRefresh();
                flushPendingSeek();
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
        if (mediaPlaying) refreshAudioRoute();
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
        if (audioManager != null && audioDeviceCallback != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
            audioDeviceCallback = null;
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
        mediaSession.setPlaybackToLocal(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build());
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendWebMediaAction("play");
            }

            @Override
            public void onPause() {
                sendWebMediaAction("pause");
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

            @Override
            public void onSeekTo(long pos) {
                sendWebSeekTo(pos);
            }

            @Override
            public void onRewind() {
                sendWebSeekRelative(-10000);
            }

            @Override
            public void onFastForward() {
                sendWebSeekRelative(10000);
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP.equals(action)) {
                    sendWebMediaAction("loop");
                } else if (AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM.equals(action)) {
                    sendWebMediaAction("random");
                }
            }
        });
        mediaSession.setActive(true);
        updatePlaybackState();
    }

    private void handleMediaIntent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        switch (intent.getAction()) {
            case AndroidMediaContract.ACTION_MEDIA_PLAY:
                requestPlaybackAudioFocus();
                sendWebMediaAction("play");
                break;
            case AndroidMediaContract.ACTION_MEDIA_PAUSE:
                sendWebMediaAction("pause");
                break;
            case AndroidMediaContract.ACTION_MEDIA_PLAY_PAUSE:
                requestPlaybackAudioFocus();
                sendWebMediaAction("playPause");
                break;
            case AndroidMediaContract.ACTION_MEDIA_PREVIOUS:
                sendWebMediaAction("previous");
                break;
            case AndroidMediaContract.ACTION_MEDIA_NEXT:
                sendWebMediaAction("next");
                break;
            case AndroidMediaContract.ACTION_MEDIA_SEEK_TO:
                sendWebSeekTo(intent.getLongExtra(AndroidMediaContract.EXTRA_SEEK_POSITION_MS, 0));
                break;
            case AndroidMediaContract.ACTION_MEDIA_SEEK_RELATIVE:
                sendWebSeekRelative(intent.getLongExtra(AndroidMediaContract.EXTRA_SEEK_DELTA_MS, 0));
                break;
            case AndroidMediaContract.ACTION_MEDIA_REWIND_10:
                sendWebSeekRelative(-10000);
                break;
            case AndroidMediaContract.ACTION_MEDIA_FORWARD_10:
                sendWebSeekRelative(10000);
                break;
            case AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP:
                sendWebMediaAction("loop");
                break;
            case AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM:
                sendWebMediaAction("random");
                break;
            case AndroidMediaContract.ACTION_MEDIA_STOP:
                sendWebMediaAction("stop");
                abandonPlaybackAudioFocus();
                break;
            case AndroidMediaContract.ACTION_REFRESH_AUDIO_ROUTE:
                refreshAudioRoute();
                break;
            case AndroidMediaContract.ACTION_PLAY_MEDIA_ID:
                requestPlaybackAudioFocus();
                pendingPlayNativePath = intent.getStringExtra(AndroidMediaContract.EXTRA_NATIVE_PATH);
                pendingPlayTitle = intent.getStringExtra(AndroidMediaContract.EXTRA_TITLE);
                pendingPlayArchivePath = intent.getStringExtra(AndroidMediaContract.EXTRA_ARCHIVE_PATH);
                pendingPlayArchiveTrackPathSuffix = intent.getStringExtra(AndroidMediaContract.EXTRA_ARCHIVE_TRACK_PATH_SUFFIX);
                pendingPlayPositionMs = Math.max(0, intent.getLongExtra(AndroidMediaContract.EXTRA_POSITION_MS, 0));
                pendingPlayCreatedAt = System.currentTimeMillis();
                if (pendingPlayNativePath == null) pendingPlayNativePath = "";
                if (pendingPlayTitle == null) pendingPlayTitle = "";
                if (pendingPlayArchivePath == null) pendingPlayArchivePath = "";
                if (pendingPlayArchiveTrackPathSuffix == null) pendingPlayArchiveTrackPathSuffix = "";
                flushPendingAutoPlay();
                break;
            default:
                break;
        }
    }

    private void sendWebMediaAction(String action) {
        if (webView == null || !pageReady) {
            pendingMediaAction = action == null ? "" : action;
            return;
        }
        if ("play".equals(action) || "playPause".equals(action)) {
            requestPlaybackAudioFocus();
            primeAndroidAudioOutput(true);
        }
        hideSystemBars();
        String jsAction = JSONObject.quote(action);
        webView.post(() -> webView.evaluateJavascript(
            "(function(action){"
                + "var attempts=0;"
                + "function run(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(!app){if(++attempts<100)setTimeout(run,100);return;}"
                + "if(action==='playPause')app.togglePlay();"
                + "else if(action==='play')app.playCurrentOrSelected();"
                + "else if(action==='pause')app.pauseCurrent();"
                + "else if(action==='ensureAudio')app.ensureAndroidAudioOutput();"
                + "else if(action==='previous')app.prevTrack();"
                + "else if(action==='next')app.nextTrack();"
                + "else if(action==='loop')app.toggleLoop();"
                + "else if(action==='random')app.toggleRandom();"
                + "else if(action==='stop')app.stop();"
                + "}"
                + "run();"
            + "})(" + jsAction + ");",
            null
        ));
    }

    private void flushPendingMediaAction() {
        if (pendingMediaAction == null || pendingMediaAction.isEmpty()) return;
        String action = pendingMediaAction;
        pendingMediaAction = "";
        sendWebMediaAction(action);
    }

    private void sendWebSeekTo(long positionMs) {
        long safePosition = Math.max(0, positionMs);
        if (webView == null || !pageReady) {
            pendingSeekAbsolute = true;
            pendingSeekPositionMs = safePosition;
            pendingSeekDeltaMs = 0;
            return;
        }
        hideSystemBars();
        webView.post(() -> webView.evaluateJavascript(
            "(function(positionMs){"
                + "var attempts=0;"
                + "function seek(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(app&&app.seekTo){app.seekTo(Math.max(0,positionMs)/1000);return;}"
                + "if(++attempts<50)setTimeout(seek,100);"
                + "}"
                + "seek();"
            + "})(" + safePosition + ");",
            null
        ));
    }

    private void sendWebSeekRelative(long deltaMs) {
        if (webView == null || !pageReady) {
            pendingSeekAbsolute = false;
            pendingSeekPositionMs = -1;
            pendingSeekDeltaMs += deltaMs;
            return;
        }
        hideSystemBars();
        webView.post(() -> webView.evaluateJavascript(
            "(function(deltaMs){"
                + "var attempts=0;"
                + "function seek(){"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(app&&app.seekTo){"
                + "var current=app.currentPlaybackSeconds?app.currentPlaybackSeconds():0;"
                + "app.seekTo(current+(Number(deltaMs)||0)/1000);"
                + "return;"
                + "}"
                + "if(++attempts<50)setTimeout(seek,100);"
                + "}"
                + "seek();"
            + "})(" + deltaMs + ");",
            null
        ));
    }

    private void flushPendingSeek() {
        if (webView == null || !pageReady) return;
        if (pendingSeekPositionMs >= 0 && pendingSeekAbsolute) {
            long position = pendingSeekPositionMs;
            pendingSeekPositionMs = -1;
            sendWebSeekTo(position);
            return;
        }
        if (pendingSeekDeltaMs != 0) {
            long delta = pendingSeekDeltaMs;
            pendingSeekDeltaMs = 0;
            sendWebSeekRelative(delta);
        }
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
        long expiresAt = pendingPlayCreatedAt + AUTO_PLAY_EXPIRY_MS;
        if (pendingPlayCreatedAt <= 0 || System.currentTimeMillis() > expiresAt) {
            clearPendingAutoPlay();
            return;
        }
        requestPlaybackAudioFocus();
        String nativePath = JSONObject.quote(pendingPlayNativePath);
        String title = JSONObject.quote(pendingPlayTitle == null ? "" : pendingPlayTitle);
        String archivePath = JSONObject.quote(pendingPlayArchivePath == null ? "" : pendingPlayArchivePath);
        String archiveTrackPathSuffix = JSONObject.quote(pendingPlayArchiveTrackPathSuffix == null ? "" : pendingPlayArchiveTrackPathSuffix);
        long positionMs = Math.max(0, pendingPlayPositionMs);
        clearPendingAutoPlay();
        webView.post(() -> webView.evaluateJavascript(
            "(function(nativePath,title,positionMs,archivePath,archiveTrackPathSuffix,expiresAt){"
                + "var attempts=0;"
                + "function play(){"
                + "if(Date.now()>expiresAt)return;"
                + "var app=window.__vgmNativeLibraryApp;"
                + "if(app&&app.playNativeCatalogItem){"
                + "Promise.resolve(app.playNativeCatalogItem(nativePath,title,{positionMs:positionMs,archivePath:archivePath,archiveTrackPathSuffix:archiveTrackPathSuffix})).then(function(ok){"
                + "if(ok){if(app.ensureAndroidAudioOutput)setTimeout(function(){app.ensureAndroidAudioOutput();},150);return;}"
                + "if(++attempts<100&&Date.now()<=expiresAt)setTimeout(play,100);"
                + "}).catch(function(){if(++attempts<100&&Date.now()<=expiresAt)setTimeout(play,100);});"
                + "return;"
                + "}"
                + "if(++attempts<100&&Date.now()<=expiresAt)setTimeout(play,100);"
                + "}"
                + "play();"
            + "})(" + nativePath + "," + title + "," + positionMs + "," + archivePath + "," + archiveTrackPathSuffix + "," + expiresAt + ");",
            null
        ));
        schedulePlaybackRouteRefresh();
    }

    private void clearPendingAutoPlay() {
        pendingPlayNativePath = "";
        pendingPlayTitle = "";
        pendingPlayArchivePath = "";
        pendingPlayArchiveTrackPathSuffix = "";
        pendingPlayPositionMs = 0;
        pendingPlayCreatedAt = 0;
    }

    private void flushPendingAudioRouteRefresh() {
        if (!pendingAudioRouteRefresh || webView == null || !pageReady) return;
        pendingAudioRouteRefresh = false;
        refreshAudioRoute();
    }

    private void refreshAudioRoute() {
        if (webView == null || !pageReady) {
            pendingAudioRouteRefresh = true;
            return;
        }
        Log.i(TAG, "Refreshing Android audio route");
        requestPlaybackAudioFocus();
        primeAndroidAudioOutput(true);
        sendWebMediaAction("ensureAudio");
    }

    private void schedulePlaybackRouteRefresh() {
        long now = System.currentTimeMillis();
        if (now - lastPlaybackRouteRefreshAt < 2500) return;
        lastPlaybackRouteRefreshAt = now;
        if (webView == null || !pageReady) {
            pendingAudioRouteRefresh = true;
            return;
        }
        webView.postDelayed(this::refreshAudioRoute, 250);
        webView.postDelayed(this::refreshAudioRoute, 1500);
    }

    private void registerAudioDeviceRefreshCallback() {
        if (audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        audioDeviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                Log.i(TAG, "Audio devices added: " + (addedDevices == null ? 0 : addedDevices.length));
                if (mediaPlaying) runOnUiThread(() -> refreshAudioRoute());
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                Log.i(TAG, "Audio devices removed: " + (removedDevices == null ? 0 : removedDevices.length));
                if (mediaPlaying) runOnUiThread(() -> refreshAudioRoute());
            }
        };
        audioManager.registerAudioDeviceCallback(audioDeviceCallback, null);
    }

    private void updateNativeMediaState(JSONObject payload) {
        boolean wasPlaying = mediaPlaying;
        boolean nextPlaying = payload.optBoolean("playing", false);
        boolean nextPaused = payload.optBoolean("paused", false);
        boolean explicitStop = payload.optBoolean("stopped", false);
        if (!nextPlaying && !nextPaused && !explicitStop && (mediaPlaying || mediaPaused)) {
            return;
        }
        mediaTitle = payload.optString("title", mediaTitle == null || mediaTitle.isEmpty() ? "VGMPlay-JS" : mediaTitle);
        mediaSource = payload.optString("source", mediaSource == null ? "" : mediaSource);
        String nativePath = payload.optString("nativePath", "");
        String artUri = payload.optString("artUri", "");
        String archivePath = payload.optString("archivePath", "");
        String archiveTrackPathSuffix = payload.optString("archiveTrackPathSuffix", "");
        String errorMessage = payload.optString("errorMessage", "");
        mediaPlaying = nextPlaying;
        mediaPaused = nextPaused;
        mediaDurationMs = Math.max(0, payload.optLong("durationMs", 0));
        mediaPositionMs = Math.max(0, payload.optLong("positionMs", 0));
        mediaLoopMode = Math.max(0, payload.optInt("loopMode", 0));
        mediaRandomMode = Math.max(0, payload.optInt("randomMode", 0));
        mediaLoopLabel = payload.optString("loopLabel", mediaLoopMode == 1 ? "Loop ON: Track" : (mediaLoopMode == 2 ? "Loop ON: All" : "Loop: Off"));
        mediaRandomLabel = payload.optString("randomLabel", mediaRandomMode == 2 ? "Random ON: All" : (mediaRandomMode == 1 ? "Random ON: Game" : "Random: Off"));
        mediaErrorMessage = errorMessage == null ? "" : errorMessage;
        prefs.edit()
            .putString("mediaTitle", mediaTitle == null ? "VGMPlay-JS" : mediaTitle)
            .putString("mediaSource", mediaSource == null ? "" : mediaSource)
            .putString("mediaNativePath", nativePath)
            .putString("mediaArtUri", artUri)
            .putString("mediaArchivePath", archivePath)
            .putString("mediaArchiveTrackPathSuffix", archiveTrackPathSuffix)
            .putLong("mediaDurationMs", mediaDurationMs)
            .putLong("mediaPositionMs", mediaPositionMs)
            .putInt("mediaLoopMode", mediaLoopMode)
            .putInt("mediaRandomMode", mediaRandomMode)
            .putString("mediaLoopLabel", mediaLoopLabel)
            .putString("mediaRandomLabel", mediaRandomLabel)
            .putString("mediaErrorMessage", mediaErrorMessage)
            .putBoolean("mediaPlaying", mediaPlaying)
            .putBoolean("mediaPaused", mediaPaused)
            .apply();
        updatePlaybackState();
        updateMediaMetadata(mediaDurationMs);
        updateMediaNotification();
        broadcastMediaState(mediaDurationMs);
        if (mediaPlaying && !wasPlaying) schedulePlaybackRouteRefresh();
        if (explicitStop || (!mediaPlaying && !mediaPaused)) abandonPlaybackAudioFocus();
    }

    private boolean requestPlaybackAudioFocus() {
        if (audioManager == null) return false;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (audioFocusRequest == null) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener(this::handleAudioFocusChange)
                    .build();
            }
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                this::handleAudioFocusChange,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) primeAndroidAudioOutput(false);
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonPlaybackAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(this::handleAudioFocusChange);
        }
    }

    private void handleAudioFocusChange(int focusChange) {
        if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
            sendWebMediaAction("pause");
        }
    }

    private void primeAndroidAudioOutput(boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - lastAudioPrimerAt < 1500) return;
        lastAudioPrimerAt = now;
        new Thread(() -> {
            AudioTrack track = null;
            try {
                int sampleRate = 44100;
                int channels = AudioFormat.CHANNEL_OUT_STEREO;
                int encoding = AudioFormat.ENCODING_PCM_16BIT;
                int bytes = Math.max(4096, AudioTrack.getMinBufferSize(sampleRate, channels, encoding));
                byte[] silence = new byte[bytes];
                track = new AudioTrack(AudioManager.STREAM_MUSIC, sampleRate, channels, encoding, bytes, AudioTrack.MODE_STREAM);
                track.play();
                Log.i(TAG, "Primed Android AudioTrack output");
                track.write(silence, 0, silence.length);
                Thread.sleep(80);
            } catch (Throwable err) {
                Log.w(TAG, "Audio output primer failed", err);
            } finally {
                if (track != null) {
                    try { track.stop(); } catch (Throwable ignored) {}
                    try { track.release(); } catch (Throwable ignored) {}
                }
            }
        }, "VGMPlayAudioPrimer").start();
    }

    private void updatePlaybackState() {
        if (mediaSession == null) return;
        boolean hasError = mediaErrorMessage != null && !mediaErrorMessage.isEmpty();
        boolean seekable = !hasError && mediaDurationMs > 0 && mediaLoopMode != 1;
        long actions = PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_STOP;
        if (seekable) {
            actions |= PlaybackState.ACTION_SEEK_TO
                | PlaybackState.ACTION_REWIND
                | PlaybackState.ACTION_FAST_FORWARD;
        }
        int state;
        if (hasError) state = PlaybackState.STATE_ERROR;
        else if (mediaPlaying) state = PlaybackState.STATE_PLAYING;
        else if (mediaPaused) state = PlaybackState.STATE_PAUSED;
        else state = PlaybackState.STATE_STOPPED;
        PlaybackState.Builder builder = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, seekable ? Math.max(0, mediaPositionMs) : PlaybackState.PLAYBACK_POSITION_UNKNOWN, mediaPlaying ? 1f : 0f)
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP,
                mediaLoopLabel == null || mediaLoopLabel.isEmpty() ? "Loop" : mediaLoopLabel,
                mediaLoopMode != 0,
                loopActionIcon(mediaLoopMode)
            ))
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM,
                mediaRandomLabel == null || mediaRandomLabel.isEmpty() ? "Random" : mediaRandomLabel,
                mediaRandomMode != 0,
                randomActionIcon(mediaRandomMode)
            ));
        if (hasError) builder.setErrorMessage(mediaErrorMessage);
        mediaSession.setPlaybackState(builder.build());
    }

    private PlaybackState.CustomAction customAction(String action, String label, boolean active, int icon) {
        Bundle extras = new Bundle();
        extras.putBoolean("active", active);
        extras.putInt("state", active ? 1 : 0);
        return new PlaybackState.CustomAction.Builder(
            action,
            label,
            icon
        ).setExtras(extras).build();
    }

    private int loopActionIcon(int mode) {
        if (mode == 1) return R.drawable.ic_auto_loop_one;
        if (mode == 2) return R.drawable.ic_auto_loop_all;
        return R.drawable.ic_auto_loop_off;
    }

    private int randomActionIcon(int mode) {
        return mode == 0 ? R.drawable.ic_auto_random_off : R.drawable.ic_auto_random_on;
    }

    private void updateMediaMetadata(long durationMs) {
        if (mediaSession == null) return;
        String key = String.valueOf(mediaTitle) + "|" + String.valueOf(mediaSource) + "|" + durationMs;
        if (key.equals(lastMediaMetadataKey)) return;
        lastMediaMetadataKey = key;
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
        intent.putExtra(AndroidMediaContract.EXTRA_NATIVE_PATH, prefs.getString("mediaNativePath", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ART_URI, prefs.getString("mediaArtUri", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_PATH, prefs.getString("mediaArchivePath", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_TRACK_PATH_SUFFIX, prefs.getString("mediaArchiveTrackPathSuffix", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_PLAYING, mediaPlaying);
        intent.putExtra(AndroidMediaContract.EXTRA_PAUSED, mediaPaused);
        intent.putExtra(AndroidMediaContract.EXTRA_DURATION_MS, durationMs);
        intent.putExtra(AndroidMediaContract.EXTRA_POSITION_MS, prefs.getLong("mediaPositionMs", 0));
        intent.putExtra(AndroidMediaContract.EXTRA_LOOP_MODE, mediaLoopMode);
        intent.putExtra(AndroidMediaContract.EXTRA_RANDOM_MODE, mediaRandomMode);
        intent.putExtra(AndroidMediaContract.EXTRA_LOOP_LABEL, mediaLoopLabel);
        intent.putExtra(AndroidMediaContract.EXTRA_RANDOM_LABEL, mediaRandomLabel);
        intent.putExtra(AndroidMediaContract.EXTRA_ERROR_MESSAGE, mediaErrorMessage);
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

    private JSONObject buildInfo() {
        JSONObject info = new JSONObject();
        try {
            info.put("platform", "Android");
            info.put("versionName", BuildConfig.VERSION_NAME);
            info.put("versionCode", BuildConfig.VERSION_CODE);
            info.put("buildTime", BuildConfig.BUILD_STAMP);
        } catch (JSONException err) {
            Log.w(TAG, "Could not build app info", err);
        }
        return info;
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
            || ext.equals("spc") || ext.equals("gym") || ext.equals("sid") || ext.equals("psid")
            || ext.equals("rsid") || ext.equals("kss") || ext.equals("hes")
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
        String imagePath = decodeVgmplayImagePath(uri);
        File file = new File(getFilesDir(), "archive-images/" + sanitizeImageKey(imagePath));
        if (!file.isFile()) return null;
        try {
            return new WebResourceResponse(mimeForName(file.getName()), "UTF-8", new FileInputStream(file));
        } catch (IOException err) {
            Log.w(TAG, "Failed to serve native image", err);
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

    private File lastTrackFile() {
        return new File(getFilesDir(), LAST_TRACK_FILE);
    }

    private JSONObject readLastTrackState() {
        File file = lastTrackFile();
        if (!file.isFile()) return new JSONObject();
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return new JSONObject(output.toString("UTF-8"));
        } catch (IOException | JSONException err) {
            Log.w(TAG, "Ignoring invalid last track JSON", err);
            return new JSONObject();
        }
    }

    private void writeLastTrackState(JSONObject payload) {
        try (FileOutputStream output = new FileOutputStream(lastTrackFile())) {
            output.write(payload.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (IOException err) {
            Log.w(TAG, "Could not save last track JSON", err);
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
                state.put("firstRun", !prefs.contains("config"));
                state.put("archiveMeta", parseObjectPref("archiveMeta"));
                state.put("trackMeta", parseObjectPref("trackMeta"));
                state.put("lastTrack", readLastTrackState());
                state.put("librarySettings", buildLibrarySettings(loadLibraryDirs()));
                state.put("buildInfo", buildInfo());
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
                } else if ("nativeSaveLastTrack".equals(name)) {
                    writeLastTrackState(payload);
                } else if ("nativeSaveArchiveImage".equals(name)) {
                    saveArchiveImage(payload);
                } else if ("nativeLibraryCommand".equals(name)) {
                    handleLibraryCommand(payload);
                } else if ("nativeMediaState".equals(name)) {
                    updateNativeMediaState(payload);
                } else if ("nativeForceAudioFocus".equals(name)) {
                    runOnUiThread(() -> {
                        hideSystemBars();
                        refreshAudioRoute();
                    });
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
