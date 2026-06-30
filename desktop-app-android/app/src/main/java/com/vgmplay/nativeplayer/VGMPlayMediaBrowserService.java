package com.vgmplay.nativeplayer;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaDescription;
import android.media.MediaMetadata;
import android.media.browse.MediaBrowser;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.service.media.MediaBrowserService;

import java.util.ArrayList;
import java.util.List;

public class VGMPlayMediaBrowserService extends MediaBrowserService {
    private MediaSession mediaSession;
    private AndroidLibraryCatalog.Snapshot snapshot;
    private String currentTitle = "VGMPlay-JS";
    private String currentSource = "";
    private boolean currentPlaying;
    private boolean currentPaused;

    private final BroadcastReceiver mediaStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !AndroidMediaContract.ACTION_MEDIA_STATE.equals(intent.getAction())) return;
            currentTitle = intent.getStringExtra(AndroidMediaContract.EXTRA_TITLE);
            if (currentTitle == null || currentTitle.isEmpty()) currentTitle = "VGMPlay-JS";
            currentSource = intent.getStringExtra(AndroidMediaContract.EXTRA_SOURCE);
            if (currentSource == null) currentSource = "";
            currentPlaying = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PLAYING, false);
            currentPaused = intent.getBooleanExtra(AndroidMediaContract.EXTRA_PAUSED, false);
            long durationMs = intent.getLongExtra(AndroidMediaContract.EXTRA_DURATION_MS, 0);
            updateSessionState(durationMs);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        mediaSession = new MediaSession(this, "VGMPlay-JS Auto");
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PLAY_PAUSE);
            }

            @Override
            public void onPause() {
                startPlayerAction(AndroidMediaContract.ACTION_MEDIA_PLAY_PAUSE);
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
        updateSessionState(0);
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
        return new BrowserRoot(AndroidLibraryCatalog.ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(String parentId, Result<List<MediaBrowser.MediaItem>> result) {
        snapshot = AndroidLibraryCatalog.build(this);
        List<MediaBrowser.MediaItem> items = new ArrayList<>();
        for (AndroidLibraryCatalog.Entry entry : snapshot.childrenOf(parentId)) {
            items.add(toMediaItem(entry));
        }
        result.sendResult(items);
    }

    private MediaBrowser.MediaItem toMediaItem(AndroidLibraryCatalog.Entry entry) {
        MediaDescription.Builder description = new MediaDescription.Builder()
            .setMediaId(entry.id)
            .setTitle(entry.title)
            .setSubtitle(entry.subtitle);
        int flags = entry.browsable
            ? MediaBrowser.MediaItem.FLAG_BROWSABLE
            : MediaBrowser.MediaItem.FLAG_PLAYABLE;
        return new MediaBrowser.MediaItem(description.build(), flags);
    }

    private void playMediaId(String mediaId) {
        if (snapshot == null) snapshot = AndroidLibraryCatalog.build(this);
        AndroidLibraryCatalog.Entry entry = snapshot.byId.get(mediaId);
        if (entry == null || !entry.playable) return;
        currentTitle = entry.title;
        currentSource = entry.subtitle;
        currentPlaying = true;
        currentPaused = false;
        updateSessionState(0);

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(AndroidMediaContract.ACTION_PLAY_MEDIA_ID);
        intent.putExtra(AndroidMediaContract.EXTRA_MEDIA_ID, entry.id);
        intent.putExtra(AndroidMediaContract.EXTRA_NATIVE_PATH, entry.nativePath);
        intent.putExtra(AndroidMediaContract.EXTRA_TITLE, entry.title);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void startPlayerAction(String action) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(action);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void updateSessionState(long durationMs) {
        if (mediaSession == null) return;
        int state;
        if (currentPlaying) state = PlaybackState.STATE_PLAYING;
        else if (currentPaused) state = PlaybackState.STATE_PAUSED;
        else state = PlaybackState.STATE_STOPPED;
        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_STOP
            | PlaybackState.ACTION_PLAY_FROM_MEDIA_ID;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, PlaybackState.PLAYBACK_POSITION_UNKNOWN, currentPlaying ? 1f : 0f)
            .build());
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentSource)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "VGMPlay-JS");
        if (durationMs > 0) metadata.putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        mediaSession.setMetadata(metadata.build());
    }

    private static int immutableFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    }
}
