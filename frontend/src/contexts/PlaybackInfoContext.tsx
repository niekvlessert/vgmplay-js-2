import React, { createContext, useContext, useMemo, useState } from "react";

export interface TrackInfo {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  coverUri?: string;
}

type PlaybackInfoContextValue = {
  track?: TrackInfo;
  setTrack: (t?: TrackInfo) => void;
} ;

const PlaybackInfoContext = createContext<PlaybackInfoContextValue | undefined>(undefined);

export const PlaybackInfoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [track, setTrackInternal] = useState<TrackInfo | undefined>(undefined);
  const setTrack = (t?: TrackInfo) => {
    // simple setter; could be extended to push to a global event bus if needed
    setTrackInternal(t);
  };
  const value = useMemo(() => ({ track, setTrack }), [track]);
  return (
    <PlaybackInfoContext.Provider value={value}>
      {children}
    </PlaybackInfoContext.Provider>
  );
};

export const usePlaybackInfo = () => {
  const ctx = useContext(PlaybackInfoContext);
  if (!ctx) {
    // Safe fallback when used outside provider
    return { track: undefined, setTrack: () => {} };
  }
  return ctx;
};
