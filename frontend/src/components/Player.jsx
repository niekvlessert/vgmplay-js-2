import { useEffect, useRef, useState } from 'react'
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
  onSelectTrack,
  frequencyData,
  remaining
}) {
  const canvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const [isImageExpanded, setIsImageExpanded] = useState(false)
  const [expandedImageSize, setExpandedImageSize] = useState({ width: 0, height: 0 })

  // Calculate image size to fit screen while maintaining aspect ratio
  const handleImageLoad = (e) => {
    const img = e.target
    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    const maxWidth = window.innerWidth * 0.9
    const maxHeight = window.innerHeight * 0.9
    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
    setExpandedImageSize({
      width: naturalWidth * scale,
      height: naturalHeight * scale
    })
  }

  // format remaining time helper for display in UI
  const formatTime = (sec) => {
    if (sec == null || Number.isNaN(sec)) return '0:00'
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }
  const remainingText = remaining != null ? `Remaining ${formatTime(remaining)}` : null

  // Draw frequency spectrum on canvas when frequencyData updates
  useEffect(() => {
    if (!frequencyData) return

    const drawSpectrum = (canvas) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const bars = frequencyData.length
      const barW = w / bars
      for (let i = 0; i < bars; i++) {
        const v = frequencyData[i] ?? 0
        const barH = (v / 255) * (h - 4)
        const x = i * barW
        const y = h - barH
        ctx.fillStyle = '#00e5ff'
        ctx.fillRect(x + 2, y, barW - 4, barH)
      }
    }

    drawSpectrum(canvasRef.current)
    drawSpectrum(overlayCanvasRef.current)
  }, [frequencyData])

  return (
    <div className="player-container">
      {/* Expanded Image Overlay */}
      {isImageExpanded && coverImage && (
        <div className="image-overlay" onClick={() => setIsImageExpanded(false)}>
          <div className="overlay-content">
            {trackInfo && (
              <div className="overlay-track-info">
                <div className="overlay-title">{trackInfo.title}</div>
                {trackInfo.game && <div className="overlay-game">{trackInfo.game}</div>}
                {trackInfo.system && <div className="overlay-system">{trackInfo.system}</div>}
                <div className="overlay-length">{trackInfo.length}</div>
                {remainingText && <div className="overlay-remaining">{remainingText}</div>}
              </div>
            )}
            <div className="expanded-image-wrapper" style={expandedImageSize.width ? {
              width: expandedImageSize.width,
              height: expandedImageSize.height
            } : {}}>
              <img
                src={`/dist/${coverImage}`}
                alt="Cover Expanded"
                onLoad={handleImageLoad}
              />
            </div>
            <div className="overlay-visualizer">
              <canvas ref={overlayCanvasRef} width={512} height={80} />
            </div>
          </div>
        </div>
      )}
      {/* Now Playing */}
      <div className="now-playing">
        <div className="now-playing-label">NOW PLAYING</div>
        <div className="now-playing-content">
          {coverImage && (
            <div className="cover-image" onClick={() => setIsImageExpanded(true)}>
              <img src={`/dist/${coverImage}`} alt="Cover" />
            </div>
          )}
          {trackInfo ? (
            <div className="track-info">
              <div className="track-title">{trackInfo.title}</div>
              {trackInfo.game && <div className="track-game">{trackInfo.game}</div>}
              {trackInfo.system && <div className="track-system">{trackInfo.system}</div>}
              <div className="track-length">{trackInfo.length}</div>
              {remainingText && <div className="track-remaining" style={{marginTop:4}}>{remainingText}</div>}
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

      {/* Visualizer (Canvas-based frequency spectrum) */}
      <div className="visualizer">
        <canvas ref={canvasRef} width={320} height={110} style={{ width: '100%', height: '100%' }} />
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
