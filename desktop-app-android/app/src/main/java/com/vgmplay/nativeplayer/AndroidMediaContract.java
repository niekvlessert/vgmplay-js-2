package com.vgmplay.nativeplayer;

final class AndroidMediaContract {
    static final String ACTION_MEDIA_PLAY_PAUSE = "com.vgmplay.nativeplayer.MEDIA_PLAY_PAUSE";
    static final String ACTION_MEDIA_PREVIOUS = "com.vgmplay.nativeplayer.MEDIA_PREVIOUS";
    static final String ACTION_MEDIA_NEXT = "com.vgmplay.nativeplayer.MEDIA_NEXT";
    static final String ACTION_MEDIA_STOP = "com.vgmplay.nativeplayer.MEDIA_STOP";
    static final String ACTION_PLAY_MEDIA_ID = "com.vgmplay.nativeplayer.PLAY_MEDIA_ID";
    static final String ACTION_MEDIA_STATE = "com.vgmplay.nativeplayer.MEDIA_STATE";

    static final String EXTRA_MEDIA_ID = "mediaId";
    static final String EXTRA_NATIVE_PATH = "nativePath";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_SOURCE = "source";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_PAUSED = "paused";
    static final String EXTRA_DURATION_MS = "durationMs";

    private AndroidMediaContract() {
    }
}
