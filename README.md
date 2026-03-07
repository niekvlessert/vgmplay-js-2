# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as player or Chrome/Firefox Extension. A separate minimal library glue is provided.

This is a newer version, once based on vgmplay-js. 

Objectives:

General:
- libvgm
- Playback through Audioworklet

For the player:

- Minimize the amount of HTML code required to use it.
- Nice full screen experience on phone and desktop

For the extension:

- Plugin into any website and play back the media that is available there.

For the library:

- Make it easy to design your own webbased games and play VGM files in that (via `vgmplay-js-glue-library.js`).

Works on current Brave and Chrome now (feb 2026). Compilation works with Emscripten 5.0.1

Lately a lot of additions using vibe coding.

The compiled binaries are included. However if you want to build yourself use this. Prepare_for_usage.sh is required to make the extension feature work.

Buildin: make sure you have cmake and Emscripten installed.
```
cd /var/www/html/
git clone --recursive https://github.com/niekvlessert/vgmplay-js-2.git
cd vgmplay-js-2
./prepare_for_usage.sh
mkdir build
cd build
emcmake cmake ..
make
```

Then put it on your webserver or run a server with Python 3 or something. On localhost non-SSL javascript usage is working fine (at least during my tests).

By default a player is shown and the html file will be scanned for .zip files. If available they're unpacked into the Emscripten filesystem, then a player will be displayed.

Loading vgmrips.net zip files is as easy as putting them on the webserver and offer them to download, then include the glue and the player will be pick them up:

```html
<html>
<body>
Download this amazing MSX music: <a href="https://192.168.1.18/01.zip">Xak</a><br/>
Download this amazing MSX music: <a href="https://192.168.1.18/02.zip">SD Snatcher</a>
<script src="vgmplay-js-glue.js"></script>
</body>
</html>
```

A Chrome Extension is also included. It can be loaded using chrome://extensions, enable developer, and 'load unpacked'. A Firefox version as well: visit about:debugging, click 'This Firefox', press 'Load temporary add-on', browse to the dir and load the manifest.json. When on a site containing vgm zip files the player can be injected in the current page by pressing the button (if added to the available buttons using the puzzle piece...), the player window will appear (almost) unharmed by the styling of the site and playback can commence!

## Minimal Library Build

A minimal build option is provided that only supports core `libvgm` formats (VGM/VGZ). This results in a significantly smaller binary (approx. 900KB WASM) compared to the full build which includes PSF, USF, GME, etc.

### Building Separately
To build ONLY the minimal library:
```bash
mkdir build_minimal
cd build_minimal
emcmake cmake .. -DBUILD_LIBVGM_ONLY=ON
make
```

### Export for Game Development
Use the provided export script to build the minimal library and bundle only the necessary files for your project:
```bash
./build_and_export_lib.sh <destination_directory>
```
This will copy `vgmplay-js.js`, `vgmplay-js.wasm`, and the glue library files to the target folder.

## Library Usage (Minimal Engine Glue)

Use the separate minimal library glue that talks directly to the engine (no UI):

```html
<script src="vgmplay-js-glue-library.js"></script>
```

This library only supports:
- Direct `.vgm`/`.vgz`
- `.zip` containing `.vgm`/`.vgz`

### API Reference
Once initialized, you can access the instance via `window.vgmPlayInstance`.

#### Play a Track
`vgmPlayInstance.playTrack(url, trackIndex, loopCount)`
- `url`: String. URL to a `.zip` or a direct `.vgm`/`.vgz` file.
- `trackIndex`: Integer (Default: 0). Track number to play (0-indexed, within the zip’s playable files).
- `loopCount`: Integer (Default: 0). Number of times to loop. `0` means loop forever.

Example:
```javascript
// Play first track of a ZIP forever
vgmPlayInstance.playTrack('music/game.zip', 0, 0);

// Play a direct VGM file
vgmPlayInstance.playTrack('music/track.vgm', 0, 0);
```

---

## macOS Desktop App

A native macOS wrapper using `WKWebView` is provided in the `desktop-app` directory. It features:
- **Custom `vgmplay://` Scheme**: Seamlessly loads local music files.
- **Native File/Folder Support**: Use the File menu to open individual songs or entire directories.
- **Persistence**: Remembers your last used music folder and auto-loads it on startup.
- **Standalone WASM**: Uses the same production-ready WASM engine as the extension.

### Building the Desktop App
Requires CMake and a Recent version of Xcode.
```bash
cd desktop-app
mkdir build && cd build
cmake ..
make
open VGMPlay.app
```

---
Underneath an older screenshot, but you'd better try the latest version on the right, it's hosted on github as well.

![Screenshot](http://vlessert.nl/vgmplay-js.png)
