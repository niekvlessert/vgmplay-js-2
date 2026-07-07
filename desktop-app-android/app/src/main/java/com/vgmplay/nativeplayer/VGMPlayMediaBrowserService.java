package com.vgmplay.nativeplayer;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.service.media.MediaBrowserService;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class VGMPlayMediaBrowserService extends MediaBrowserService {
    private MediaSession mediaSession;
    private SharedPreferences prefs;
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
    private boolean currentPlaying;
    private boolean currentPaused;
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
            syncCurrentQueue();
            saveCurrentState();
            updateSessionState();
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = getSharedPreferences(AndroidLibraryCatalog.PREFS_NAME, Context.MODE_PRIVATE);
        fallbackArt = BitmapFactory.decodeResource(getResources(), R.drawable.vgmp_logo);
        loadCurrentState();
        mediaSession = new MediaSession(this, "VGMPlay-JS Auto");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                if (currentPlaying || currentPaused) {
                    startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PLAY);
                } else if (currentNativePath != null && !currentNativePath.isEmpty()) {
                    playNativePath(currentNativePath, currentTitle, currentArchivePath, currentArchiveTrackPathSuffix, currentPositionMs);
                } else {
                    startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PLAY);
                }
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
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public BrowserRoot onGetRoot(String clientPackageName, int clientUid, Bundle rootHints) {
        if (currentPlaying) startPlayerAction(AndroidMediaContract.ACTION_REFRESH_AUDIO_ROUTE);
        return new BrowserRoot(AndroidLibraryCatalog.ROOT_ID, null);
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
        currentTitle = entry.title;
        currentSource = entry.subtitle;
        currentNativePath = entry.nativePath;
        currentArtUri = entry.artUri;
        currentArchivePath = entry.archivePath;
        currentArchiveTrackPathSuffix = entry.archiveTrackPathSuffix;
        currentParentId = entry.parentId == null ? "" : entry.parentId;
        currentPositionMs = 0;
        currentDurationMs = 0;
        currentErrorMessage = "";
        currentPlaying = false;
        currentPaused = false;
        saveCurrentState();
        updateSessionState();
        playNativePath(entry.nativePath, entry.title, entry.archivePath, entry.archiveTrackPathSuffix, 0);
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
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(AndroidMediaContract.ACTION_PLAY_MEDIA_ID);
        intent.putExtra(AndroidMediaContract.EXTRA_NATIVE_PATH, nativePath);
        intent.putExtra(AndroidMediaContract.EXTRA_TITLE, title == null ? "" : title);
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_PATH, archivePath == null ? "" : archivePath);
        intent.putExtra(AndroidMediaContract.EXTRA_ARCHIVE_TRACK_PATH_SUFFIX, archiveTrackPathSuffix == null ? "" : archiveTrackPathSuffix);
        intent.putExtra(AndroidMediaContract.EXTRA_POSITION_MS, Math.max(0, positionMs));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void startPlayerAction(String action) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(action);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void startSeekTo(long positionMs) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(AndroidMediaContract.ACTION_MEDIA_SEEK_TO);
        intent.putExtra(AndroidMediaContract.EXTRA_SEEK_POSITION_MS, Math.max(0, positionMs));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void updateSessionState() {
        if (mediaSession == null) return;
        boolean hasError = currentErrorMessage != null && !currentErrorMessage.isEmpty();
        boolean seekable = !hasError && currentDurationMs > 0 && currentLoopMode != 1;
        int state;
        if (hasError) state = PlaybackState.STATE_ERROR;
        else if (currentPlaying) state = PlaybackState.STATE_PLAYING;
        else if (currentPaused) state = PlaybackState.STATE_PAUSED;
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
        PlaybackState.Builder builder = new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, seekable ? Math.max(0, currentPositionMs) : PlaybackState.PLAYBACK_POSITION_UNKNOWN, currentPlaying ? 1f : 0f)
            .setActiveQueueItemId(currentQueueItemId)
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_LOOP,
                currentLoopLabel == null || currentLoopLabel.isEmpty() ? "Loop" : currentLoopLabel,
                currentLoopMode != 0,
                android.R.drawable.ic_menu_revert
            ))
            .addCustomAction(customAction(
                AndroidMediaContract.ACTION_MEDIA_TOGGLE_RANDOM,
                currentRandomLabel == null || currentRandomLabel.isEmpty() ? "Random" : currentRandomLabel,
                currentRandomMode != 0,
                android.R.drawable.ic_menu_rotate
            ));
        if (hasError) builder.setErrorMessage(currentErrorMessage);
        mediaSession.setPlaybackState(builder.build());
        String metadataKey = String.valueOf(currentTitle) + "|" + String.valueOf(currentSource) + "|" + String.valueOf(currentArtUri) + "|" + currentDurationMs;
        if (metadataKey.equals(lastMetadataKey)) return;
        lastMetadataKey = metadataKey;
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentSource)
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

    private void syncCurrentQueue() {
        if (mediaSession == null || currentNativePath == null || currentNativePath.isEmpty()) return;
        AndroidLibraryCatalog.Entry current = findCurrentEntry();
        if (current == null || current.parentId == null || current.parentId.isEmpty()) return;
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
        currentPlaying = prefs.getBoolean("mediaPlaying", false);
        currentPaused = prefs.getBoolean("mediaPaused", false);
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
