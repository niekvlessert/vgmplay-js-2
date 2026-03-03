# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as player and library

This is a newer version, based on vgmplay-js. Objectives:

- Make it work on current Emscripten version and browser versions.
- Minimize the amount of HTML code required to use it.
- Make it usuable as a library as well as a player.
- Playback through Audioworklet 

Works on current Brave and Chrome now (feb 2026). Compilation works with Emscripten 5.0.1

Lately a lot of additions using vibe coding.

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

By default a player is shown and the html file will be scanned for .zip files. If available they're unpacked into the Emscripten filesystem, then a player will be displayer. You can also build your own player and use it as a library, you can use variables before including the glue file to choose the behaviour. Documentation for that will be created later. 

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

## Library Usage

`vgmplay-js-2` can be used as a standalone engine without the default player UI.

### Initialization
To use it as a library, set `isLibrary: true` in a global `vgmplayConfig` object before including the glue script:

```html
<script>
  window.vgmplayConfig = {
    isLibrary: true,
    autoStart: false,
    vgmplayContainerId: 'my-custom-container' // Optional
  };
</script>
<script src="vgmplay-js-glue.js"></script>
```

### API Reference
Once initialized, you can access the player instance via `window.vgmPlayInstance`.

#### Play a Track
`vgmPlayInstance.playTrack(url, trackIndex, loopCount)`
- `url`: String. URL to a `.zip`, `.7z`, or a direct music file (`.vgm`, `.nsf`, `.spc`, `.psf`, etc.).
- `trackIndex`: Integer (Default: 0). The track number to play (0-indexed).
- `loopCount`: Integer (Default: 0). Number of times to loop. `0` means loop forever.

Example:
```javascript
// Play first track of a ZIP forever
vgmPlayInstance.playTrack('music/game.zip', 0, 0);

// Play track 3 of an NSF file
vgmPlayInstance.playTrack('music/game.nsf', 2, 0);
```

#### Controls
- `vgmPlayInstance.pauseTrack()`: Pauses playback.
- `vgmPlayInstance.play()`: Resumes playback.
- `vgmPlayInstance.stop()`: Stops playback and unloads the file.
- `vgmPlayInstance.togglePlayback()`: Toggles between play/pause.

---
Underneath an older screenshot, but you'd better try the latest version on the right, it's hosted on github as well.

![Screenshot](http://vlessert.nl/vgmplay-js.png)
