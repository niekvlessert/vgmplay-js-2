import { useState, useEffect, useRef, useCallback } from 'react'

export function useVGMPlayer() {
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [trackList, setTrackList] = useState([])
  const [trackInfo, setTrackInfo] = useState(null)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [frequencyData, setFrequencyData] = useState(new Array(16).fill(0))

  const contextRef = useRef(null)
  const nodeRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)
  const functionsRef = useRef(null)
  const dataPtrsRef = useRef([])
  const dataHeapsRef = useRef([])
  const buffersRef = useRef([[], []])
  const isGeneratingRef = useRef(false)
  const sampleRateRef = useRef(44100)

  // Load scripts
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    Promise.all([
      loadScript('https://niekvlessert.github.io/vgmplay-js-2/vgmplay-js.js'),
      loadScript('https://niekvlessert.github.io/vgmplay-js-2/minizip-asm.min.js')
    ]).then(() => {
      // Wait for Module to be ready
      const checkModule = setInterval(() => {
        if (window.Module && window.Module.cwrap && window.Minizip) {
          clearInterval(checkModule)
          initPlayer()
        }
      }, 100)
    })
  }, [])

  const initPlayer = useCallback(() => {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext
      contextRef.current = new AudioContext()
      sampleRateRef.current = contextRef.current.sampleRate
      nodeRef.current = contextRef.current.createScriptProcessor(16384, 2, 2)

      const Module = window.Module
      functionsRef.current = {
        VGMPlay_Init: Module.cwrap('VGMPlay_Init'),
        VGMPlay_Init2: Module.cwrap('VGMPlay_Init2'),
        FillBuffer: Module.cwrap('FillBuffer2', 'number', ['number', 'number']),
        OpenVGMFile: Module.cwrap('OpenVGMFile', 'number', ['string']),
        CloseVGMFile: Module.cwrap('CloseVGMFile'),
        PlayVGM: Module.cwrap('PlayVGM'),
        StopVGM: Module.cwrap('StopVGM'),
        VGMEnded: Module.cwrap('VGMEnded'),
        GetTrackLength: Module.cwrap('GetTrackLength'),
        SetSampleRate: Module.cwrap('SetSampleRate', 'number', ['number']),
        SetLoopCount: Module.cwrap('SetLoopCount', 'number', ['number']),
        ShowTitle: Module.cwrap('ShowTitle', 'string')
      }

      dataPtrsRef.current[0] = Module._malloc(16384 * 2)
      dataPtrsRef.current[1] = Module._malloc(16384 * 2)
      dataHeapsRef.current[0] = new Int16Array(Module.HEAPU8.buffer, dataPtrsRef.current[0], 16384)
      dataHeapsRef.current[1] = new Int16Array(Module.HEAPU8.buffer, dataPtrsRef.current[1], 16384)

      functionsRef.current.VGMPlay_Init()
      functionsRef.current.SetSampleRate(sampleRateRef.current)
      functionsRef.current.VGMPlay_Init2()

      setIsReady(true)
    } catch (e) {
      console.error('Failed to init player:', e)
    }
  }, [])

  const loadZip = useCallback(async (url) => {
    if (!isReady) return

    // Clear previous state
    setTrackList([])
    setCurrentTrackIndex(0)
    setCurrentTrack(null)
    setTrackInfo(null)

    // Clean up previous files from FS
    try {
      const files = window.FS.readdir('/')
      for (const file of files) {
        if (file.endsWith('.vgm') || file.endsWith('.vgz')) {
          try {
            window.FS.unlink('/' + file)
          } catch (e) {}
        }
      }
    } catch (e) {}

    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const byteArray = new Uint8Array(arrayBuffer)

      const mz = new window.Minizip(byteArray)
      const fileList = mz.list()
      const tracks = []

      for (const file of fileList) {
        const originalPath = file.filepath
        const lowerPath = originalPath.toLowerCase()

        if (lowerPath.endsWith('.vgm') || lowerPath.endsWith('.vgz')) {
          const fileArray = mz.extract(originalPath)
          // Sanitize filename - replace spaces and special chars
          const safePath = originalPath.replace(/[^a-zA-Z0-9._-]/g, '_')

          try {
            window.FS.unlink(safePath)
          } catch (e) {}
          window.FS.createDataFile('/', safePath, fileArray, true, true)

          // Get track info
          functionsRef.current.OpenVGMFile(safePath)
          functionsRef.current.PlayVGM()
          const length = functionsRef.current.GetTrackLength() * sampleRateRef.current / 44100
          const lengthSeconds = Math.round(length / sampleRateRef.current)
          const title = functionsRef.current.ShowTitle()
          functionsRef.current.StopVGM()
          functionsRef.current.CloseVGMFile()

          // Parse title: trackNameEn|||trackNameJp|||gameNameEn|||...
          const titleParts = title.split('|||')
          const trackName = titleParts[0] || titleParts[1] || originalPath.replace(/\.(vgm|vgz)$/i, '').replace(/^\d+\s*/, '')

          tracks.push({
            path: safePath,
            name: trackName,
            length: lengthSeconds,
            lengthFormatted: new Date(lengthSeconds * 1000).toISOString().substr(14, 5),
            title
          })
        }
      }

      setTrackList(tracks)
      if (tracks.length > 0) {
        setCurrentTrackIndex(0)
      }
      return tracks
    } catch (e) {
      console.error('Failed to load zip:', e)
      return []
    }
  }, [isReady])

  const generateBuffer = useCallback(() => {
    if (!functionsRef.current) return

    functionsRef.current.FillBuffer(dataHeapsRef.current[0].byteOffset, dataHeapsRef.current[1].byteOffset)

    const results = [
      new Int16Array(dataHeapsRef.current[0].buffer, dataHeapsRef.current[0].byteOffset, 16384),
      new Int16Array(dataHeapsRef.current[1].buffer, dataHeapsRef.current[1].byteOffset, 16384)
    ]

    for (let i = 0; i < 16384; i++) {
      buffersRef.current[0][i] = results[0][i] / 32768
      buffersRef.current[1][i] = results[1][i] / 32768
    }
  }, [])

  const play = useCallback((trackIndex, tracks = null) => {
    const list = tracks || trackList
    if (!isReady || list.length === 0) return

    const idx = trackIndex !== undefined ? trackIndex : currentTrackIndex
    const track = list[idx]
    if (!track) return

    // Stop current playback completely
    if (isPlaying || isGeneratingRef.current) {
      if (functionsRef.current) {
        functionsRef.current.StopVGM()
        functionsRef.current.CloseVGMFile()
      }
      isGeneratingRef.current = false
    }

    // Close old audio context and create new one to avoid leftover audio
    if (contextRef.current) {
      try {
        contextRef.current.close()
      } catch (e) {}
    }

    // Create fresh audio context and node
    contextRef.current = new AudioContext()
    nodeRef.current = contextRef.current.createScriptProcessor(16384, 2, 2)

    // Clear buffers
    buffersRef.current[0] = new Array(16384).fill(0)
    buffersRef.current[1] = new Array(16384).fill(0)

    // Resume audio context if suspended (browser autoplay policy)
    if (contextRef.current.state === 'suspended') {
      contextRef.current.resume()
    }

    functionsRef.current.OpenVGMFile(track.path)
    functionsRef.current.PlayVGM()

    // Parse title info from stored track.title
    const titleParts = (track.title || '').split('|||')
    setTrackInfo({
      title: titleParts[0] || titleParts[1] || track.name,
      game: titleParts[2] || titleParts[3] || '',
      system: titleParts[4] || titleParts[5] || '',
      author: titleParts[6] || titleParts[7] || '',
      length: track.lengthFormatted
    })

    setCurrentTrack(track)
    setCurrentTrackIndex(idx)

    // Generate initial buffer
    generateBuffer()

    nodeRef.current.onaudioprocess = (e) => {
      const output0 = e.outputBuffer.getChannelData(0)
      const output1 = e.outputBuffer.getChannelData(1)

      if (functionsRef.current.VGMEnded()) {
        // Auto next track
        setTimeout(() => nextTrack(), 500)
        return
      }

      for (let i = 0; i < 16384; i++) {
        output0[i] = buffersRef.current[0][i]
        output1[i] = buffersRef.current[1][i]
      }
      generateBuffer()
    }

    nodeRef.current.connect(contextRef.current.destination)
    isGeneratingRef.current = true
    setIsPlaying(true)
  }, [isReady, trackList, currentTrackIndex, generateBuffer])

  const pause = useCallback(() => {
    if (nodeRef.current && contextRef.current) {
      nodeRef.current.disconnect(contextRef.current.destination)
    }
    setIsPlaying(false)
  }, [])

  const stop = useCallback(() => {
    if (nodeRef.current && contextRef.current) {
      try {
        nodeRef.current.disconnect(contextRef.current.destination)
      } catch (e) {}
    }
    if (functionsRef.current) {
      functionsRef.current.StopVGM()
      functionsRef.current.CloseVGMFile()
    }
    isGeneratingRef.current = false
    setIsPlaying(false)
    setCurrentTrack(null)
    setTrackInfo(null)
  }, [])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause()
    } else if (currentTrack) {
      // Resume
      if (contextRef.current && nodeRef.current) {
        nodeRef.current.connect(contextRef.current.destination)
        setIsPlaying(true)
      }
    } else {
      play(0)
    }
  }, [isPlaying, currentTrack, pause, play])

  const nextTrack = useCallback(() => {
    const nextIdx = (currentTrackIndex + 1) % trackList.length
    stop()
    setTimeout(() => play(nextIdx), 100)
  }, [currentTrackIndex, trackList.length, stop, play])

  const prevTrack = useCallback(() => {
    const prevIdx = currentTrackIndex === 0 ? trackList.length - 1 : currentTrackIndex - 1
    stop()
    setTimeout(() => play(prevIdx), 100)
  }, [currentTrackIndex, trackList.length, stop, play])

  return {
    isReady,
    isPlaying,
    currentTrack,
    currentTrackIndex,
    trackList,
    trackInfo,
    loadZip,
    play,
    pause,
    stop,
    togglePlayback,
    nextTrack,
    prevTrack
  }
}
