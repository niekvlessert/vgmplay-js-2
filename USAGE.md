# VGMPlay-JS Library Usage Guide

This guide describes how to integrate the minimal VGMPlay-JS library into your web-based games.

## Files Included
- `vgmplay-js.js` & `vgmplay-js.wasm`: The core Emscripten-compiled player engine.
- `vgmplay-js-glue-library.js`: The main JavaScript interface.
- `vgmplay-audio-processor.js`: The Audio Worklet responsible for high-performance audio rendering.
- `minizip-asm.min.js`: Support for loading files from ZIP archives.

## Quick Start

1. **Include the Glue Library**:
   ```html
   <script src="vgmplay-js-glue-library.js"></script>
   ```

2. **Wait for Interaction**:
   Web browsers require a user interaction (like a click) before audio can start.
   ```javascript
   document.getElementById('start-button').onclick = async () => {
       // Minimal usage
       await vgmPlayInstance.playTrack('music/theme.vgz');
   };
   ```

3. **Advanced Usage (Play from ZIP)**:
   ```javascript
   // Play the second track (index 1) in a ZIP, looping infinitely (0)
   await vgmPlayInstance.playTrack('music/soundtrack.zip', 1, 0);
   ```

## API Reference

The instance is globally available as `window.vgmPlayInstance`.

### `vgmPlayInstance.playTrack(url, trackIndex, loopCount)`
High-level method to load and play a track.
- `url`: URL to a `.vgm`, `.vgz`, or `.zip` file.
- `trackIndex`: (Optional, default 0) Index of the file within a ZIP archive.
- `loopCount`: (Optional, default 0) Number of times to loop. 0 = infinite.

### `vgmPlayInstance.pause()`
Pauses audio playback.

### `vgmPlayInstance.play()`
Resumes audio playback.

### `vgmPlayInstance.stop()`
Stops playback and releases resources.

### `vgmPlayInstance.setSampleRate(rate)`
Changes the output sample rate (default is the browser's native rate).
