package com.vgmplay.nativeplayer;

final class AndroidMediaContract {
    static final String ACTION_MEDIA_PLAY_PAUSE = "com.vgmplay.nativeplayer.MEDIA_PLAY_PAUSE";
    static final String ACTION_MEDIA_PLAY = "com.vgmplay.nativeplayer.MEDIA_PLAY";
    static final String ACTION_MEDIA_PAUSE = "com.vgmplay.nativeplayer.MEDIA_PAUSE";
    static final String ACTION_MEDIA_PREVIOUS = "com.vgmplay.nativeplayer.MEDIA_PREVIOUS";
    static final String ACTION_MEDIA_NEXT = "com.vgmplay.nativeplayer.MEDIA_NEXT";
    static final String ACTION_MEDIA_STOP = "com.vgmplay.nativeplayer.MEDIA_STOP";
    static final String ACTION_MEDIA_SEEK_TO = "com.vgmplay.nativeplayer.MEDIA_SEEK_TO";
    static final String ACTION_MEDIA_SEEK_RELATIVE = "com.vgmplay.nativeplayer.MEDIA_SEEK_RELATIVE";
    static final String ACTION_MEDIA_REWIND_10 = "com.vgmplay.nativeplayer.MEDIA_REWIND_10";
    static final String ACTION_MEDIA_FORWARD_10 = "com.vgmplay.nativeplayer.MEDIA_FORWARD_10";
    static final String ACTION_MEDIA_TOGGLE_LOOP = "com.vgmplay.nativeplayer.MEDIA_TOGGLE_LOOP";
    static final String ACTION_MEDIA_TOGGLE_RANDOM = "com.vgmplay.nativeplayer.MEDIA_TOGGLE_RANDOM";
    static final String ACTION_REFRESH_AUDIO_ROUTE = "com.vgmplay.nativeplayer.REFRESH_AUDIO_ROUTE";
    static final String ACTION_PLAY_MEDIA_ID = "com.vgmplay.nativeplayer.PLAY_MEDIA_ID";
    static final String ACTION_MEDIA_STATE = "com.vgmplay.nativeplayer.MEDIA_STATE";

    static final String EXTRA_MEDIA_ID = "mediaId";
    static final String EXTRA_NATIVE_PATH = "nativePath";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_SOURCE = "source";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_PAUSED = "paused";
    static final String EXTRA_DURATION_MS = "durationMs";
    static final String EXTRA_POSITION_MS = "positionMs";
    static final String EXTRA_SEEK_POSITION_MS = "seekPositionMs";
    static final String EXTRA_SEEK_DELTA_MS = "seekDeltaMs";
    static final String EXTRA_ART_URI = "artUri";
    static final String EXTRA_ARCHIVE_PATH = "archivePath";
    static final String EXTRA_ARCHIVE_TRACK_PATH_SUFFIX = "archiveTrackPathSuffix";
    static final String EXTRA_LOOP_MODE = "loopMode";
    static final String EXTRA_RANDOM_MODE = "randomMode";
    static final String EXTRA_LOOP_LABEL = "loopLabel";
    static final String EXTRA_RANDOM_LABEL = "randomLabel";
    static final String EXTRA_ERROR_MESSAGE = "errorMessage";

    private AndroidMediaContract() {
    }
}
