import './Player.css'

export function Player({
  isPlaying,
  trackInfo,
  trackList,
  currentTrackIndex,
  coverImage,
  onTogglePlayback,
  onNext,
  onPrev,
  onStop,
  onSelectTrack
}) {
  return (
    <div className="player-container">
      {/* Now Playing */}
      <div className="now-playing">
        <div className="now-playing-label">NOW PLAYING</div>
        <div className="now-playing-content">
          {coverImage && (
            <div className="cover-image">
              <img src={`/dist/${coverImage}`} alt="Cover" />
            </div>
          )}
          {trackInfo ? (
            <div className="track-info">
              <div className="track-title">{trackInfo.title}</div>
              {trackInfo.game && <div className="track-game">{trackInfo.game}</div>}
              {trackInfo.system && <div className="track-system">{trackInfo.system}</div>}
              <div className="track-length">{trackInfo.length}</div>
            </div>
          ) : (
            <div className="track-info">
              <div className="track-title empty">SELECT A TRACK</div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button className="control-btn" onClick={onPrev} title="Previous (P)">
          ⏮
        </button>
        <button className="control-btn play-btn" onClick={onTogglePlayback} title="Play/Pause (Space)">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="control-btn" onClick={onNext} title="Next (N)">
          ⏭
        </button>
        <button className="control-btn stop-btn" onClick={onStop} title="Stop (S)">
          ⏹
        </button>
      </div>

      {/* Visualizer */}
      <div className="visualizer">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className={`visualizer-bar ${isPlaying ? 'active' : ''}`}
            style={{
              animationDelay: `${i * 0.05}s`,
              height: isPlaying ? undefined : '4px'
            }}
          />
        ))}
      </div>

      {/* Track List */}
      <div className="track-list">
        <div className="track-list-header">TRACK LIST</div>
        <div className="track-list-scroll">
          {trackList.map((track, index) => (
            <div
              key={track.path}
              className={`track-item ${index === currentTrackIndex ? 'active' : ''}`}
              onClick={() => onSelectTrack(index)}
            >
              <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="track-name">{track.name}</span>
              <span className="track-duration">{track.lengthFormatted}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
