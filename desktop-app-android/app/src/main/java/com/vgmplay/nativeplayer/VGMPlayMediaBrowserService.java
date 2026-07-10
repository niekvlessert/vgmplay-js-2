package com.vgmplay.nativeplayer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.media.MediaBrowserService;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class VGMPlayMediaBrowserService extends MediaBrowserService {
    private static final String TAG = "VGMPlayAutoService";
    private static final String MEDIA_CHANNEL_ID = "vgmplay_auto_playback";
    private static final int MEDIA_NOTIFICATION_ID = 5002;

    private MediaSession mediaSession;
    private SharedPreferences prefs;
    private NotificationManager notificationManager;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private AndroidPlaybackEngineHost playbackEngine;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable startupTimeoutRunnable;
    private Runnable silentPlaceholderRunnable;
    private long playbackRequestToken;
    private String catalogSignature = "";
    private final Map<String, List<AndroidLibraryCatalog.Entry>> childrenCache = new HashMap<>();
    private final Map<String, AndroidLibraryCatalog.Entry> byId = new HashMap<>();
    private final Map<String, Bitmap> bitmapCache = new HashMap<>();
    private String currentTitle = "VGMPlay-JS";
    private String currentSource = "";
    private String currentNativePath = "";
    private String currentArtUri = "";
    private String currentArchivePath = "";
    private String currentArchiveTrackPathSuffix = "";
    private String currentMediaId = "";
    private boolean currentPlaying;
    private boolean currentPaused;
    private boolean currentBuffering;
    private boolean currentPreparing;
    private String currentPrepareText = "";
    private long prepareStartedAtMs;
    private boolean silentPlaceholderPlaying;
    private long silentPlaceholderStartedAtMs;
    private long silentPlaceholderToken;
    private volatile boolean silentAudioRunning;
    private AudioTrack silentAudioTrack;
    private Thread silentAudioThread;
    private String preparedArchiveIdentity = "";
    private long currentDurationMs;
    private long currentPositionMs;
    private int currentLoopMode;
    private int currentRandomMode;
    private String currentLoopLabel = "Loop: Off";
    private String currentRandomLabel = "Random: Off";
    private String currentErrorMessage = "";
    private String currentParentId = "";
    private long currentQueueItemId = -1;
    private String lastMetadataKey = "";
    private Bitmap fallbackArt;

    private final BroadcastReceiver mediaStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !AndroidMediaContract.ACTION_MEDIA_STATE.equals(intent.getAction())) return;
            applyMediaState(intent, false);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(AndroidLibraryCatalog.PREFS_NAME, Context.MODE_PRIVATE);
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        createNotificationChannel();
        fallbackArt = BitmapFactory.decodeResource(getResources(), R.drawable.vgmp_logo);
        loadCurrentState();
        playbackEngine = new AndroidPlaybackEngineHost(this, prefs, new AndroidPlaybackEngineHost.Callback() {
            @Override
            public void onMediaState(JSONObject payload) {
                applyMediaState(payload, true);
            }

            @Override
            public void onPrepareState(JSONObject payload) {
                applyPrepareState(payload);
            }

            @Override
            public void onLog(String level, String message) {
                if ("error".equals(level)) Log.e(TAG, message == null ? "" : message);
                else if ("warn".equals(level)) Log.w(TAG, message == null ? "" : message);
                else Log.i(TAG, message == null ? "" : message);
            }

            @Override
            public void onRequestAudioRouteRefresh() {
                requestPlaybackAudioFocus();
                if (playbackEngine != null) playbackEngine.refreshAudioRoute();
            }
        });
        mediaSession = new MediaSession(this, "VGMPlay-JS Auto");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                playCurrentResolved();
            }

            @Override
            public void onPause() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PAUSE);
            }

            @Override
            public void onSkipToPrevious() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PREVIOUS);
            }

            @Override
            public void onSkipToNext() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_NEXT);
            }

            @Override
            public void onStop() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_STOP);
            }

            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                playMediaId(mediaId);
            }

            @Override
            public void onSeekTo(long pos) {
                startSeekTo(pos);
            }

            @Override
            public void onRewind() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_REWIND_10);
            }

            @Override
            public void onFastForward() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_FORWARD_10);
            }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP.equals(action)
                    || AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM.equals(action)) {
                    startPlayerAction(action);
                }
            }
        });
        Intent activityIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            30,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag()
        );
        mediaSession.setSessionActivity(pendingIntent);
        mediaSession.setActive(true);
        setSessionToken(mediaSession.getSessionToken());
        IntentFilter mediaStateFilter = new IntentFilter(AndroidMediaContract.ACTION_MEDIA_STATE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaStateReceiver, mediaStateFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mediaStateReceiver, mediaStateFilter);
        }
        updateSessionState();
        if (currentPlaying) startPlayerAction(AndroidMediaContract.ACTION_REFRESH_AUDIO_ROUTE);
    }

    @Override
    public void onDestroy() {
        unregisterReceiver(mediaStateReceiver);
        stopSilentPlaceholder();
        if (playbackEngine != null) {
            playbackEngine.destroy();
            playbackEngine = null;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        abandonPlaybackAudioFocus();
        super.onDestroy();
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        if (!isValidBrowserClient(clientPackageName, clientUid)) return null;
        return new BrowserRoot(AndroidLibraryCatalog.ROOT_ID, null);
    }

    private boolean isValidBrowserClient(String clientPackageName, int clientUid) {
        if (clientPackageName == null || clientPackageName.isEmpty()) return false;
        String[] packages = getPackageManager().getPackagesForUid(clientUid);
        if (packages == null || packages.length == 0) return false;
        for (String packageName : packages) {
            if (clientPackageName.equals(packageName)) return true;
        }
        Log.w(TAG, "Rejecting MediaBrowser client with mismatched uid/package: " + clientPackageName);
        return false;
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        List<AndroidLibraryCatalog.Entry> children = childrenFor(parentId);
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        for (AndroidLibraryCatalog.Entry entry : children) {
            items.add(toMediaItem(entry));
        }
        result.sendResult(items);
    }

    private MediaBrowser.MediaItem toMediaItem(AndroidLibraryCatalog.Entry entry) {
        MediaDescription.Builder description = new MediaDescription.Builder()
            .setMediaId(entry.id)
            .setTitle(entry.title)
            .setSubtitle(entry.subtitle);
        if (entry.browsable) {
            Bitmap art = bitmapForEntry(entry);
            if (art != null) description.setIconBitmap(art);
        }
        int flags = 0;
        if (entry.browsable) flags |= MediaBrowser.MediaItem.FLAG_BROWSABLE;
        if (entry.playable) flags |= MediaBrowser.MediaItem.FLAG_PLAYABLE;
        if (flags == 0) flags = MediaBrowser.MediaItem.FLAG_BROWSABLE;
        return new MediaBrowser.MediaItem(description.build(), flags);
    }

    private AndroidLibraryCatalog.Entry firstPlayableChild(String parentId) {
        for (AndroidLibraryCatalog.Entry child : childrenFor(parentId)) {
            if (child.playable) return child;
        }
        for (AndroidLibraryCatalog.Entry child : childrenFor(parentId)) {
            AndroidLibraryCatalog.Entry nested = firstPlayableChild(child.id);
            if (nested != null) return nested;
        }
        return null;
    }

    private void playMediaId(String mediaId) {
        ensureCatalogFresh();
        AndroidLibraryCatalog.Entry entry = entryFor(mediaId);
        if (entry == null) return;
        if (!entry.playable && entry.browsable) {
            AndroidLibraryCatalog.Entry first = firstPlayableChild(entry.id);
            if (first != null) {
                playMediaId(first.id);
            }
            return;
        }
        if (!entry.playable) return;
        playCatalogEntry(entry, 0);
    }

    private void playCatalogEntry(AndroidLibraryCatalog.Entry entry, long positionMs) {
        if (entry == null || !entry.playable) return;
        currentTitle = entry.title;
        currentSource = entry.subtitle;
        currentNativePath = entry.nativePath;
        currentArtUri = entry.artUri;
        currentArchivePath = entry.archivePath;
        currentArchiveTrackPathSuffix = entry.archiveTrackPathSuffix;
        currentMediaId = entry.id;
        currentParentId = entry.parentId == null ? "" : entry.parentId;
        currentPositionMs = Math.max(0, positionMs);
        currentDurationMs = 0;
        syncCurrentQueue();
        saveCurrentState();
        playNativePath(entry.nativePath, entry.title, entry.archivePath, entry.archiveTrackPathSuffix, currentPositionMs);
    }

    private AndroidLibraryCatalog.Entry entryFor(String mediaId) {
        AndroidLibraryCatalog.Entry entry = byId.get(mediaId);
        if (entry != null || mediaId == null) return entry;
        int trackMarker = mediaId.lastIndexOf(":track:");
        int gameMarker = mediaId.lastIndexOf(":game:");
        if (trackMarker > 0) {
            childrenFor(mediaId.substring(0, trackMarker));
        } else if (gameMarker > 0) {
            childrenFor(mediaId.substring(0, gameMarker));
        } else {
            childrenFor(AndroidLibraryCatalog.ROOT_ID);
        }
        return byId.get(mediaId);
    }

    private List<AndroidLibraryCatalog.Entry> childrenFor(String parentId) {
        ensureCatalogFresh();
        String id = parentId == null ? AndroidLibraryCatalog.ROOT_ID : parentId;
        List<AndroidLibraryCatalog.Entry> children = childrenCache.get(id);
        if (children == null) {
            children = AndroidLibraryCatalog.childrenOf(this, id);
            childrenCache.put(id, children);
            for (AndroidLibraryCatalog.Entry entry : children) {
                byId.put(entry.id, entry);
            }
        }
        return children;
    }

    private void ensureCatalogFresh() {
        String nextSignature = AndroidLibraryCatalog.signature(this);
        if (!nextSignature.equals(catalogSignature)) {
            catalogSignature = nextSignature;
            childrenCache.clear();
            byId.clear();
            bitmapCache.clear();
        }
    }

    private void playNativePath(String nativePath, String title, long positionMs) {
        playNativePath(nativePath, title, "", "", positionMs);
    }

    private void playNativePath(String nativePath, String title, String archivePath, String archiveTrackPathSuffix, long positionMs) {
        long token = beginPlaybackPrepare(nativePath, title, archivePath, archiveTrackPathSuffix, positionMs, prepareTextFor(nativePath, archivePath));
        ensureForeground();
        if (playbackEngine != null) {
            playbackEngine.playNativePath(nativePath, title, archivePath, archiveTrackPathSuffix, positionMs, token);
        }
    }

    private void startPlayerAction(String action) {
        if (AndroidMediaContract.ACTION_MEDIA_PLAY.equals(action)) {
            playCurrentResolved();
        } else if (AndroidMediaContract.ACTION_MEDIA_PLAY_PAUSE.equals(action)) {
            boolean activePlayback = currentPlaying || silentPlaceholderPlaying;
            if (currentPaused || currentBuffering || !activePlayback) {
                playCurrentResolved();
            } else if (playbackEngine != null) {
                stopSilentPlaceholder();
                playbackEngine.sendAction("pause");
                updateSessionState();
            }
        } else if (AndroidMediaContract.ACTION_MEDIA_PAUSE.equals(action)) {
            stopSilentPlaceholder();
            if (playbackEngine != null) playbackEngine.sendAction("pause");
            updateSessionState();
        } else if (AndroidMediaContract.ACTION_MEDIA_PREVIOUS.equals(action)) {
            if (playbackEngine != null) playbackEngine.sendAction("previous");
        } else if (AndroidMediaContract.ACTION_MEDIA_NEXT.equals(action)) {
            if (playbackEngine != null) playbackEngine.sendAction("next");
        } else if (AndroidMediaContract.ACTION_MEDIA_STOP.equals(action)) {
            stopSilentPlaceholder();
            clearPlaybackStartup();
            preparedArchiveIdentity = "";
            if (playbackEngine != null) playbackEngine.sendAction("stop");
            abandonPlaybackAudioFocus();
            stopForeground(false);
        } else if (AndroidMediaContract.ACTION_REFRESH_AUDIO_ROUTE.equals(action)) {
            requestPlaybackAudioFocus();
            if (playbackEngine != null) playbackEngine.refreshAudioRoute();
        } else if (AndroidMediaContract.ACTION_MEDIA_REWIND_10.equals(action)) {
            if (playbackEngine != null) playbackEngine.seekRelative(-10000);
        } else if (AndroidMediaContract.ACTION_MEDIA_FORWARD_10.equals(action)) {
            if (playbackEngine != null) playbackEngine.seekRelative(10000);
        } else if (AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP.equals(action)) {
            if (playbackEngine != null) playbackEngine.sendAction("loop");
        } else if (AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM.equals(action)) {
            if (playbackEngine != null) playbackEngine.sendAction("random");
        }
    }

    private void playCurrentResolved() {
        if (currentNativePath == null || currentNativePath.isEmpty()) {
            currentErrorMessage = "No track selected";
            currentPaused = false;
            currentPlaying = false;
            updateSessionState();
            return;
        }
        AndroidLibraryCatalog.Entry entry = resolveCurrentEntryForPlayback();
        if (entry != null) {
            Log.i(TAG, "Resolved remembered Auto track via catalog: " + entry.title + " [" + entry.id + "]");
            playCatalogEntry(entry, currentPositionMs);
            return;
        }
        Log.w(TAG, "Could not resolve remembered Auto track in catalog; using raw native path: " + currentNativePath);
        playNativePath(currentNativePath, currentTitle, currentArchivePath, currentArchiveTrackPathSuffix, currentPositionMs);
    }

    private AndroidLibraryCatalog.Entry resolveCurrentEntryForPlayback() {
        ensureCatalogFresh();
        AndroidLibraryCatalog.Entry entry = findCurrentEntry();
        if (entry != null) return entry;

        if (currentParentId != null && !currentParentId.isEmpty()) {
            for (AndroidLibraryCatalog.Entry candidate : childrenFor(currentParentId)) {
                if (entryMatchesCurrent(candidate)) return candidate;
            }
        }

        java.util.ArrayDeque<String> pending = new java.util.ArrayDeque<>();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        pending.add(AndroidLibraryCatalog.ROOT_ID);
        int visited = 0;
        while (!pending.isEmpty() && visited < 160) {
            String parentId = pending.removeFirst();
            if (!seen.add(parentId)) continue;
            visited++;
            for (AndroidLibraryCatalog.Entry candidate : childrenFor(parentId)) {
                if (entryMatchesCurrent(candidate)) return candidate;
                if (candidate.browsable) pending.add(candidate.id);
            }
        }
        return null;
    }

    private void startSeekTo(long positionMs) {
        if (playbackEngine != null) playbackEngine.seekTo(Math.max(0, positionMs));
    }

    private long beginPlaybackPrepare(String nativePath, String title, String archivePath, String archiveTrackPathSuffix, long positionMs, String prepareText) {
        stopSilentPlaceholder();
        clearPlaybackStartup();
        playbackRequestToken++;
        currentPreparing = true;
        currentPrepareText = prepareText == null || prepareText.isEmpty() ? "Preparing..." : prepareText;
        currentBuffering = false;
        currentPlaying = false;
        currentPaused = true;
        currentErrorMessage = "";
        prepareStartedAtMs = System.currentTimeMillis();
        if (title != null && !title.isEmpty()) currentTitle = title;
        if (nativePath != null) currentNativePath = nativePath;
        currentArchivePath = archivePath == null ? "" : archivePath;
        currentArchiveTrackPathSuffix = archiveTrackPathSuffix == null ? "" : archiveTrackPathSuffix;
        currentPositionMs = Math.max(0, positionMs);
        currentDurationMs = 0;
        syncCurrentQueue();
        updateSessionState();
        long token = playbackRequestToken;
        startupTimeoutRunnable = () -> {
            if (playbackRequestToken != token || (!currentPreparing && !currentBuffering)) return;
            currentPreparing = false;
            currentBuffering = false;
            currentPaused = currentNativePath != null && !currentNativePath.isEmpty();
            currentPrepareText = "Ready - press Play";
            saveCurrentState();
            updateSessionState();
        };
        mainHandler.postDelayed(startupTimeoutRunnable, 60000);
        return token;
    }

    private void clearPlaybackStartup() {
        currentPreparing = false;
        currentBuffering = false;
        currentPrepareText = "";
        cancelSilentPlaceholderSchedule();
        if (startupTimeoutRunnable != null) {
            mainHandler.removeCallbacks(startupTimeoutRunnable);
            startupTimeoutRunnable = null;
        }
    }

    private void updateSessionState() {
        if (mediaSession == null) return;
        boolean hasError = currentErrorMessage != null && !currentErrorMessage.isEmpty();
        boolean placeholderActive = silentPlaceholderPlaying;
        boolean activePlayback = currentPlaying || placeholderActive;
        boolean seekable = !hasError && !placeholderActive && currentDurationMs > 0 && currentLoopMode != 1;
        int state;
        if (hasError) state = PlaybackState.STATE_ERROR;
        else if (activePlayback) state = PlaybackState.STATE_PLAYING;
        else if (currentBuffering) state = PlaybackState.STATE_BUFFERING;
        else if (currentPaused || currentPreparing) state = PlaybackState.STATE_PAUSED;
        else state = PlaybackState.STATE_STOPPED;
        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_STOP
            | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID;
        if (seekable) {
            actions |= PlaybackState.ACTION_SEEK_TO
                | PlaybackState.ACTION_REWIND
                | PlaybackState.ACTION_FAST_FORWARD;
        }
        long playbackPosition = seekable ? Math.max(0, currentPositionMs) : PlaybackState.PLAYBACK_POSITION_UNKNOWN;
        PlaybackState.Builder builder = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, playbackPosition, activePlayback ? 1f : 0f)
            .setActiveQueueItemId(currentQueueItemId)
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP,
                currentLoopLabel == null || currentLoopLabel.isEmpty() ? "Loop" : currentLoopLabel,
                currentLoopMode != 0,
                loopActionIcon(currentLoopMode)
            ))
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM,
                currentRandomLabel == null || currentRandomLabel.isEmpty() ? "Random" : currentRandomLabel,
                currentRandomMode != 0,
                randomActionIcon(currentRandomMode)
            ));
        if (hasError) builder.setErrorMessage(currentErrorMessage);
        mediaSession.setPlaybackState(builder.build());
        updateForegroundNotification();
        String displaySource = displaySource();
        String metadataKey = String.valueOf(currentTitle) + "|" + String.valueOf(displaySource) + "|" + String.valueOf(currentArtUri) + "|" + currentDurationMs;
        if (metadataKey.equals(lastMetadataKey)) return;
        lastMetadataKey = metadataKey;
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, currentMediaId == null ? "" : currentMediaId)
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, displaySource)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "VGMPlay-JS");
        if (currentDurationMs > 0) metadata.putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs);
        Bitmap art = bitmapForUri(currentArtUri);
        if (art == null) art = fallbackArt;
        if (art != null) {
            metadata.putBitmap(MediaMetadata.METADATA_KEY_ART, art);
            metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        }
        mediaSession.setMetadata(metadata.build());
    }

    private void applyMediaState(Intent intent, boolean rebroadcast) {
        long token = intent.getLongExtra("requestToken", 0);
        if (token > 0 && token != playbackRequestToken) {
            Log.i(TAG, "Ignoring stale media state for token " + token + ", current " + playbackRequestToken);
            return;
        }
        boolean nextPlaying = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PLAYING, false);
        boolean nextPaused = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PAUSED, false);
        String nextNativePath = intent.getStringExtra(AndroidMediaContract.EXTRA_NATIVE_PATH);
        String nextError = intent.getStringExtra(AndroidMediaContract.EXTRA_ERROR_MESSAGE);
        boolean stoppedDuringPrepare = (currentPreparing || currentBuffering || silentPlaceholderPlaying)
            && !nextPlaying
            && !nextPaused
            && (nextError == null || nextError.isEmpty());
        if (stoppedDuringPrepare) return;
        if (nextPlaying || nextPaused || (nextError != null && !nextError.isEmpty())) {
            stopSilentPlaceholder();
            clearPlaybackStartup();
        }
        currentTitle = intent.getStringExtra(AndroidMediaContract.EXTRA_TITLE);
        if (currentTitle == null || currentTitle.isEmpty()) currentTitle = "VGMPlay-JS";
        currentSource = intent.getStringExtra(AndroidMediaContract.EXTRA_SOURCE);
        if (currentSource == null) currentSource = "";
        currentNativePath = intent.getStringExtra(AndroidMediaContract.EXTRA_NATIVE_PATH);
        if (currentNativePath == null) currentNativePath = "";
        currentArtUri = intent.getStringExtra(AndroidMediaContract.EXTRA_ART_URI);
        if (currentArtUri == null) currentArtUri = "";
        currentArchivePath = intent.getStringExtra(AndroidMediaContract.EXTRA_ARCHIVE_PATH);
        if (currentArchivePath == null) currentArchivePath = "";
        currentArchiveTrackPathSuffix = intent.getStringExtra(AndroidMediaContract.EXTRA_ARCHIVE_TRACK_PATH_SUFFIX);
        if (currentArchiveTrackPathSuffix == null) currentArchiveTrackPathSuffix = "";
        currentPlaying = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PLAYING, false);
        currentPaused = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PAUSED, false);
        currentDurationMs = intent.getLongExtra(AndroidMediaContract.EXTRA_DURATION_MS, 0);
        currentPositionMs = intent.getLongExtra(AndroidMediaContract.EXTRA_POSITION_MS, 0);
        currentLoopMode = intent.getIntExtra(AndroidMediaContract.EXTRA_LOOP_MODE, 0);
        currentRandomMode = intent.getIntExtra(AndroidMediaContract.EXTRA_RANDOM_MODE, 0);
        currentLoopLabel = intent.getStringExtra(AndroidMediaContract.EXTRA_LOOP_LABEL);
        if (currentLoopLabel == null || currentLoopLabel.isEmpty()) currentLoopLabel = currentLoopMode == 1 ? "Loop ON: Track" : (currentLoopMode == 2 ? "Loop ON: All" : "Loop: Off");
        currentRandomLabel = intent.getStringExtra(AndroidMediaContract.EXTRA_RANDOM_LABEL);
        if (currentRandomLabel == null || currentRandomLabel.isEmpty()) currentRandomLabel = currentRandomMode == 2 ? "Random ON: All" : (currentRandomMode == 1 ? "Random ON: Game" : "Random: Off");
        currentErrorMessage = intent.getStringExtra(AndroidMediaContract.EXTRA_ERROR_MESSAGE);
        if (currentErrorMessage == null) currentErrorMessage = "";
        if (currentPlaying) preparedArchiveIdentity = archiveIdentity(currentNativePath, currentArchivePath);
        syncCurrentQueue();
        saveCurrentState();
        updateSessionState();
        if (rebroadcast) sendBroadcast(intent);
    }

    private void applyMediaState(JSONObject payload, boolean rebroadcast) {
        Intent intent = new Intent(AndroidMediaContract.ACTION_MEDIA_STATE);
        intent.setPackage(getPackageName());
        intent.putExtra(AndroidMediaContract.EXTRA_TITLE, payload.optString("title", "VGMPlay-JS"));
        intent.putExtra(AndroidMediaContract.EXTRA_SOURCE, payload.optString("source", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_NATIVE_PATH, payload.optString("nativePath", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ART_URI, payload.optString("artUri", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_PATH, payload.optString("archivePath", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_TRACK_PATH_SUFFIX, payload.optString("archiveTrackPathSuffix", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_PLAYING, payload.optBoolean("playing", false));
        intent.putExtra(AndroidMediaContract.EXTRA_PAUSED, payload.optBoolean("paused", false));
        intent.putExtra(AndroidMediaContract.EXTRA_DURATION_MS, payload.optLong("durationMs", 0));
        intent.putExtra(AndroidMediaContract.EXTRA_POSITION_MS, payload.optLong("positionMs", 0));
        intent.putExtra(AndroidMediaContract.EXTRA_LOOP_MODE, payload.optInt("loopMode", 0));
        intent.putExtra(AndroidMediaContract.EXTRA_RANDOM_MODE, payload.optInt("randomMode", 0));
        intent.putExtra(AndroidMediaContract.EXTRA_LOOP_LABEL, payload.optString("loopLabel", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_RANDOM_LABEL, payload.optString("randomLabel", ""));
        intent.putExtra(AndroidMediaContract.EXTRA_ERROR_MESSAGE, payload.optString("errorMessage", ""));
        intent.putExtra("requestToken", payload.optLong("requestToken", 0));
        applyMediaState(intent, rebroadcast);
    }

    private void applyPrepareState(JSONObject payload) {
        long token = payload.optLong("requestToken", 0);
        if (token > 0 && token != playbackRequestToken) {
            Log.i(TAG, "Ignoring stale prepare state for token " + token + ", current " + playbackRequestToken);
            return;
        }
        String stage = payload.optString("stage", "");
        String message = payload.optString("message", "");
        if (message.isEmpty()) message = stageToMessage(stage);
        if ("startingAudio".equals(stage)) {
            stopSilentPlaceholder();
            requestPlaybackAudioFocus();
            currentPreparing = false;
            currentBuffering = true;
            currentPrepareText = message.isEmpty() ? "Starting playback..." : message;
        } else if ("ready".equals(stage)) {
            stopSilentPlaceholder();
            currentPreparing = false;
            currentBuffering = false;
            currentPaused = true;
            currentPrepareText = message.isEmpty() ? "Ready - press Play" : message;
            preparedArchiveIdentity = archiveIdentity(currentNativePath, currentArchivePath);
        } else if ("failed".equals(stage)) {
            stopSilentPlaceholder();
            currentPreparing = false;
            currentBuffering = false;
            currentPaused = currentNativePath != null && !currentNativePath.isEmpty();
            currentErrorMessage = message.isEmpty() ? "Playback preparation failed" : message;
            preparedArchiveIdentity = "";
        } else if ("preparingArchive".equals(stage)) {
            if (silentPlaceholderPlaying) return;
            currentPreparing = true;
            currentBuffering = false;
            currentPaused = false;
            currentPrepareText = extractionProgressText();
            scheduleSilentPlaceholder(token);
        } else {
            cancelSilentPlaceholderSchedule();
            currentPreparing = true;
            currentBuffering = false;
            currentPaused = true;
            currentPrepareText = message.isEmpty() ? "Preparing..." : message;
        }
        updateSessionState();
    }

    private void scheduleSilentPlaceholder(long token) {
        long effectiveToken = token > 0 ? token : playbackRequestToken;
        if (silentPlaceholderPlaying && silentPlaceholderToken == effectiveToken) return;
        if (silentPlaceholderRunnable != null && silentPlaceholderToken == effectiveToken) return;
        cancelSilentPlaceholderSchedule();
        silentPlaceholderToken = effectiveToken;
        silentPlaceholderRunnable = () -> {
            silentPlaceholderRunnable = null;
            if (playbackRequestToken != effectiveToken || !currentPreparing || currentBuffering || currentPlaying) return;
            startSilentPlaceholder(effectiveToken);
        };
        mainHandler.postDelayed(silentPlaceholderRunnable, 1000);
    }

    private void cancelSilentPlaceholderSchedule() {
        if (silentPlaceholderRunnable != null) {
            mainHandler.removeCallbacks(silentPlaceholderRunnable);
            silentPlaceholderRunnable = null;
        }
    }

    private void startSilentPlaceholder(long token) {
        if (silentPlaceholderPlaying || playbackRequestToken != token || !currentPreparing || currentPlaying || currentBuffering) return;
        requestPlaybackAudioFocus();
        int sampleRate = 8000;
        int minBufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int bufferSize = Math.max(minBufferSize > 0 ? minBufferSize : 0, sampleRate / 4);
        try {
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build())
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
            silentAudioTrack = track;
            silentAudioRunning = true;
            silentPlaceholderPlaying = true;
            silentPlaceholderStartedAtMs = System.currentTimeMillis();
            silentPlaceholderToken = token;
            currentPaused = false;
            currentBuffering = false;
            currentPrepareText = extractionProgressText();
            track.play();
            byte[] silence = new byte[bufferSize];
            silentAudioThread = new Thread(() -> {
                while (silentAudioRunning) {
                    AudioTrack activeTrack = silentAudioTrack;
                    if (activeTrack == null) break;
                    try {
                        activeTrack.write(silence, 0, silence.length);
                    } catch (RuntimeException ex) {
                        Log.w(TAG, "Silent extraction placeholder write failed", ex);
                        break;
                    }
                }
            }, "VGMPlaySilentExtraction");
            silentAudioThread.setDaemon(true);
            silentAudioThread.start();
            Log.i(TAG, "Started silent extraction placeholder for token " + token);
        } catch (RuntimeException ex) {
            Log.w(TAG, "Could not start silent extraction placeholder", ex);
            silentPlaceholderPlaying = false;
            silentAudioRunning = false;
            silentAudioTrack = null;
            silentAudioThread = null;
        }
        updateSessionState();
    }

    private void stopSilentPlaceholder() {
        cancelSilentPlaceholderSchedule();
        silentPlaceholderPlaying = false;
        silentPlaceholderStartedAtMs = 0;
        silentPlaceholderToken = 0;
        silentAudioRunning = false;
        Thread thread = silentAudioThread;
        silentAudioThread = null;
        if (thread != null) thread.interrupt();
        AudioTrack track = silentAudioTrack;
        silentAudioTrack = null;
        if (track != null) {
            try {
                track.pause();
            } catch (RuntimeException ignored) {
            }
            try {
                track.flush();
            } catch (RuntimeException ignored) {
            }
            try {
                track.release();
            } catch (RuntimeException ignored) {
            }
        }
    }

    private String extractionProgressText() {
        return "Extraction in progress...";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) return;
        NotificationChannel channel = new NotificationChannel(
            MEDIA_CHANNEL_ID,
            "VGMPlay Android Auto",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Playback service for Android Auto");
        notificationManager.createNotificationChannel(channel);
    }

    private void ensureForeground() {
        startForeground(MEDIA_NOTIFICATION_ID, buildForegroundNotification());
    }

    private void updateForegroundNotification() {
        if (notificationManager == null) return;
        Notification notification = buildForegroundNotification();
        if (currentPlaying || currentPaused || currentBuffering || currentPreparing || silentPlaceholderPlaying) notificationManager.notify(MEDIA_NOTIFICATION_ID, notification);
        else notificationManager.cancel(MEDIA_NOTIFICATION_ID);
    }

    private Notification buildForegroundNotification() {
        Intent activityIntent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag();
        PendingIntent contentIntent = PendingIntent.getActivity(this, 31, activityIntent, flags);
        PendingIntent previous = servicePendingIntent(AndroidMediaContract.ACTION_MEDIA_PREVIOUS, 41);
        boolean activePlayback = currentPlaying || silentPlaceholderPlaying;
        PendingIntent playPause = servicePendingIntent(activePlayback ? AndroidMediaContract.ACTION_MEDIA_PAUSE : AndroidMediaContract.ACTION_MEDIA_PLAY, 42);
        PendingIntent next = servicePendingIntent(AndroidMediaContract.ACTION_MEDIA_NEXT, 43);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, MEDIA_CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(R.drawable.ic_stat_vgmplay)
            .setContentTitle(currentTitle == null || currentTitle.isEmpty() ? "VGMPlay-JS" : currentTitle)
            .setContentText(displaySource())
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(activePlayback || currentBuffering || currentPreparing)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", previous)
            .addAction(activePlayback ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, activePlayback ? "Pause" : "Play", playPause)
            .addAction(android.R.drawable.ic_media_next, "Next", next)
            .setStyle(new Notification.MediaStyle().setMediaSession(mediaSession == null ? null : mediaSession.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    private String displaySource() {
        if (silentPlaceholderPlaying) {
            return currentPrepareText == null || currentPrepareText.isEmpty() ? extractionProgressText() : currentPrepareText;
        }
        if (currentPreparing || currentBuffering) {
            return currentPrepareText == null || currentPrepareText.isEmpty() ? "Preparing..." : currentPrepareText;
        }
        return currentSource == null ? "" : currentSource;
    }

    private String prepareTextFor(String nativePath, String archivePath) {
        String next = archiveIdentity(nativePath, archivePath);
        if (!next.isEmpty() && next.equals(preparedArchiveIdentity)) return "Preparing audio...";
        return (archivePath != null && !archivePath.isEmpty()) ? "Preparing archive..." : "Preparing...";
    }

    private String archiveIdentity(String nativePath, String archivePath) {
        String base = nativePath == null ? "" : nativePath;
        if (base.isEmpty()) return "";
        return base;
    }

    private String stageToMessage(String stage) {
        if ("resolvingTrack".equals(stage)) return "Resolving track...";
        if ("preparingArchive".equals(stage)) return "Preparing archive...";
        if ("preparingAudio".equals(stage)) return "Preparing audio...";
        if ("startingAudio".equals(stage)) return "Starting playback...";
        if ("ready".equals(stage)) return "Ready - press Play";
        return "Preparing...";
    }

    private PendingIntent servicePendingIntent(String action, int requestCode) {
        Intent intent = new Intent(this, VGMPlayMediaBrowserService.class);
        intent.setAction(action);
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | immutableFlag());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) startPlayerAction(intent.getAction());
        return START_STICKY;
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
                    .build();
            }
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
        Log.i(TAG, "Audio focus request result: " + result);
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonPlaybackAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) audioManager.abandonAudioFocusRequest(audioFocusRequest);
        else audioManager.abandonAudioFocus(null);
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

    private void syncCurrentQueue() {
        currentQueueItemId = -1;
        if (mediaSession == null || currentNativePath == null || currentNativePath.isEmpty()) return;
        AndroidLibraryCatalog.Entry current = findCurrentEntry();
        if (current == null || current.parentId == null || current.parentId.isEmpty()) {
            currentMediaId = "";
            mediaSession.setQueue(new ArrayList<>());
            return;
        }
        currentMediaId = current.id;
        if (!current.parentId.equals(currentParentId)) {
            if (currentParentId != null && !currentParentId.isEmpty()) {
                try { notifyChildrenChanged(currentParentId); } catch (IllegalStateException ignored) {}
            }
            currentParentId = current.parentId;
            try { notifyChildrenChanged(currentParentId); } catch (IllegalStateException ignored) {}
        }
        List<MediaSession.QueueItem> queue = new ArrayList<>();
        long activeQueueId = -1;
        List<AndroidLibraryCatalog.Entry> siblings = childrenFor(current.parentId);
        for (int i = 0; i < siblings.size(); i++) {
            AndroidLibraryCatalog.Entry sibling = siblings.get(i);
            if (!sibling.playable) continue;
            MediaDescription description = new MediaDescription.Builder()
                .setMediaId(sibling.id)
                .setTitle(sibling.title)
                .setSubtitle(sibling.subtitle)
                .build();
            long queueId = i + 1;
            if (sibling.id.equals(current.id)) activeQueueId = queueId;
            queue.add(new MediaSession.QueueItem(description, queueId));
        }
        if (!queue.isEmpty()) {
            mediaSession.setQueue(queue);
            mediaSession.setQueueTitle(currentSource == null || currentSource.isEmpty() ? "Current game" : currentSource);
            currentQueueItemId = activeQueueId;
        }
    }

    private AndroidLibraryCatalog.Entry findCurrentEntry() {
        ensureCatalogFresh();
        for (AndroidLibraryCatalog.Entry entry : byId.values()) {
            if (entryMatchesCurrent(entry)) return entry;
        }
        return null;
    }

    private boolean entryMatchesCurrent(AndroidLibraryCatalog.Entry entry) {
        if (entry == null || !entry.playable) return false;
        if (!currentNativePath.equals(entry.nativePath)) return false;
        if (currentArchivePath != null && !currentArchivePath.isEmpty()) {
            return currentArchivePath.equals(entry.archivePath)
                && (currentArchiveTrackPathSuffix == null || currentArchiveTrackPathSuffix.isEmpty() || currentArchiveTrackPathSuffix.equals(entry.archiveTrackPathSuffix));
        }
        return currentArchiveTrackPathSuffix == null || currentArchiveTrackPathSuffix.isEmpty() || currentArchiveTrackPathSuffix.equals(entry.archiveTrackPathSuffix);
    }

    private Bitmap bitmapForEntry(AndroidLibraryCatalog.Entry entry) {
        Bitmap art = bitmapForUri(entry == null ? "" : entry.artUri);
        return art == null ? fallbackArt : art;
    }

    private Bitmap bitmapForUri(String artUri) {
        if (artUri == null || artUri.isEmpty()) return null;
        Uri uri = Uri.parse(artUri);
        if (!"vgmplay".equals(uri.getScheme())) return null;
        String imagePath = decodeVgmplayImagePath(uri);
        Bitmap cached = bitmapCache.get(imagePath);
        if (cached != null) return cached;
        File file = new File(getFilesDir(), "archive-images/" + sanitizeImageKey(imagePath));
        if (!file.isFile()) return null;
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (bitmap != null) bitmapCache.put(imagePath, bitmap);
        return bitmap;
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

    private String sanitizeImageKey(String value) {
        String key = value == null ? "image" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return key.length() > 180 ? key.substring(key.length() - 180) : key;
    }

    private void loadCurrentState() {
        if (prefs == null) return;
        currentTitle = prefs.getString("mediaTitle", currentTitle);
        currentSource = prefs.getString("mediaSource", currentSource);
        currentNativePath = prefs.getString("mediaNativePath", "");
        currentArtUri = prefs.getString("mediaArtUri", "");
        currentArchivePath = prefs.getString("mediaArchivePath", "");
        currentArchiveTrackPathSuffix = prefs.getString("mediaArchiveTrackPathSuffix", "");
        currentDurationMs = prefs.getLong("mediaDurationMs", 0);
        currentPositionMs = prefs.getLong("mediaPositionMs", 0);
        currentLoopMode = prefs.getInt("mediaLoopMode", 0);
        currentRandomMode = prefs.getInt("mediaRandomMode", 0);
        currentLoopLabel = prefs.getString("mediaLoopLabel", "Loop: Off");
        currentRandomLabel = prefs.getString("mediaRandomLabel", "Random: Off");
        currentErrorMessage = prefs.getString("mediaErrorMessage", "");
        currentParentId = prefs.getString("mediaParentId", "");
        currentPlaying = false;
        currentPaused = currentNativePath != null && !currentNativePath.isEmpty();
    }

    private void saveCurrentState() {
        if (prefs == null) return;
        prefs.edit()
            .putString("mediaTitle", currentTitle == null ? "VGMPlay-JS" : currentTitle)
            .putString("mediaSource", currentSource == null ? "" : currentSource)
            .putString("mediaNativePath", currentNativePath == null ? "" : currentNativePath)
            .putString("mediaArtUri", currentArtUri == null ? "" : currentArtUri)
            .putString("mediaArchivePath", currentArchivePath == null ? "" : currentArchivePath)
            .putString("mediaArchiveTrackPathSuffix", currentArchiveTrackPathSuffix == null ? "" : currentArchiveTrackPathSuffix)
            .putLong("mediaDurationMs", Math.max(0, currentDurationMs))
            .putLong("mediaPositionMs", Math.max(0, currentPositionMs))
            .putInt("mediaLoopMode", currentLoopMode)
            .putInt("mediaRandomMode", currentRandomMode)
            .putString("mediaLoopLabel", currentLoopLabel == null ? "Loop: Off" : currentLoopLabel)
            .putString("mediaRandomLabel", currentRandomLabel == null ? "Random: Off" : currentRandomLabel)
            .putString("mediaErrorMessage", currentErrorMessage == null ? "" : currentErrorMessage)
            .putString("mediaParentId", currentParentId == null ? "" : currentParentId)
            .putBoolean("mediaPlaying", currentPlaying)
            .putBoolean("mediaPaused", currentPaused)
            .apply();
    }

    private static int immutableFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    }
}
