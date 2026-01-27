import { useState, useEffect } from 'react'
import { useVGMPlayer } from './hooks/useVGMPlayer'
import { Player } from './components/Player'
import './App.css'

function App() {
  const [screen, setScreen] = useState('loading') // loading, start, select, player
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [loadingGame, setLoadingGame] = useState(false)
  const [error, setError] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)

  const player = useVGMPlayer()

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Load manifest
  useEffect(() => {
    fetch('/music/manifest.json')
      .then(res => res.json())
      .then(data => {
        setGames(data.games)
        setTimeout(() => setScreen('select'), 500)
      })
      .catch(err => {
        console.error('Failed to load manifest:', err)
        setError('Failed to load music library')
        setScreen('select')
      })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (screen !== 'player') return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          player.togglePlayback()
          break
        case 'KeyN':
          player.nextTrack()
          break
        case 'KeyP':
          player.prevTrack()
          break
        case 'KeyS':
          player.stop()
          break
        case 'Escape':
          player.stop()
          setScreen('select')
          setSelectedGame(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen, player])

  const handleStart = () => {
    setScreen('select')
  }

  const handleGameSelect = async (game) => {
    setSelectedGame(game)
    setLoadingGame(true)

    // Use static files from public folder
    const tracks = await player.loadZip(`/music/${game.zipFile}`)
    setLoadingGame(false)
    setScreen('player')

    // Auto play first track with loaded tracks
    if (tracks && tracks.length > 0) {
      setTimeout(() => player.play(0, tracks), 100)
    }
  }

  const handleBack = () => {
    player.stop()
    setScreen('select')
    setSelectedGame(null)
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <img
          src="https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2F9-player.vercel.app&label=VISITORS&labelColor=%231a1a2e&countColor=%2300e5ff"
          alt="visitor count"
          className="visitor-counter"
        />
        <div className="title-row">
          <h1 className="title">NINE-PLAYER</h1>
          {installPrompt && (
            <button className="install-button" onClick={handleInstall}>
              INSTALL
            </button>
          )}
        </div>
        <p className="subtitle">Honux's Video Game Music Archive <span className="version">v{__APP_VERSION__}</span></p>
      </header>

      <main className="main-content">
        {screen === 'loading' && (
          <div className="loading">
            <p className="loading-text">LOADING...</p>
            <div className="loading-bar">
              <div className="loading-progress"></div>
            </div>
          </div>
        )}

        {screen === 'start' && (
          <div className="start-section">
            <div style={{ marginBottom: '60px' }}>
              <p className="section-title">PRESS START</p>
              <div className="section-divider"></div>
            </div>
            <button className="start-button" onClick={handleStart}>
              <span className="blink">START</span>
            </button>
            <p style={{
              marginTop: '40px',
              fontSize: '8px',
              color: 'var(--text-secondary)',
              lineHeight: '2'
            }}>
              SPACE: PLAY/PAUSE | N: NEXT | P: PREV | ESC: BACK
            </p>
            {!player.isReady && (
              <p style={{
                marginTop: '20px',
                fontSize: '8px',
                color: 'var(--accent-yellow)',
              }}>
                INITIALIZING AUDIO ENGINE...
              </p>
            )}
            {error && (
              <p style={{
                marginTop: '20px',
                fontSize: '8px',
                color: 'var(--accent-magenta)',
              }}>
                {error}
              </p>
            )}
          </div>
        )}

        {screen === 'select' && (
          <>
            <p className="section-title">SELECT YOUR MUSIC</p>
            <div className="section-divider"></div>

            {!player.isReady ? (
              <div className="loading">
                <p className="loading-text">LOADING ENGINE...</p>
                <div className="loading-bar">
                  <div className="loading-progress"></div>
                </div>
              </div>
            ) : games.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <p className="empty-text">NO MUSIC FOUND<br />ADD ZIP FILES TO DIST FOLDER</p>
              </div>
            ) : (
              <div className="game-grid">
                {games.map((game) => (
                  <div
                    key={game.id}
                    className="game-card"
                    onClick={() => handleGameSelect(game)}
                  >
                    <div className="game-image">
                      {game.coverImage ? (
                        <img
                          src={`/music/${game.coverImage}`}
                          alt={game.title}
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.parentElement.innerHTML = '<span class="game-placeholder">🎮</span>'
                          }}
                        />
                      ) : (
                        <span className="game-placeholder">🎮</span>
                      )}
                    </div>
                    <div className="game-info">
                      <h3 className="game-title">
                        {game.title}
                        {game.titleJp && game.titleJp !== game.title && (
                          <><br /><small style={{ opacity: 0.7 }}>{game.titleJp}</small></>
                        )}
                      </h3>
                      <span className="game-system">{game.system}</span>
                      <p className="game-tracks">{game.trackCount} TRACKS</p>
                      {game.author && (
                        <p className="game-author">{game.author}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {screen === 'player' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button
                className="back-button"
                onClick={handleBack}
              >
                ← BACK
              </button>
              <span className="current-game-title">
                {selectedGame?.title}
              </span>
            </div>

            {loadingGame ? (
              <div className="loading">
                <p className="loading-text">LOADING TRACKS...</p>
                <div className="loading-bar">
                  <div className="loading-progress"></div>
                </div>
              </div>
            ) : (
              <Player
                isPlaying={player.isPlaying}
                trackInfo={player.trackInfo}
                trackList={player.trackList}
                currentTrackIndex={player.currentTrackIndex}
                coverImage={selectedGame?.coverImage}
                gameAuthor={selectedGame?.author}
                gameSystem={selectedGame?.system}
                onTogglePlayback={player.togglePlayback}
                onNext={player.nextTrack}
                onPrev={player.prevTrack}
                onStop={player.stop}
                onSelectTrack={player.play}
                frequencyData={player.frequencyData}
              />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p className="footer-text">
          POWERED BY{' '}
          <a
            href="https://github.com/vgmrips/vgmplay"
            className="footer-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            VGMPLAY
          </a>
          {' '}| BUILT WITH EMSCRIPTEN + REACT
        </p>
      </footer>
    </div>
  )
}

export default App
