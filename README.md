# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as library for libvgm, player, Chrome/Firefox Extension and standalone MacOS App.

This is a newer version, once based on vgmplay-js. 

Objectives:

General:
- libvgm only at first, but others came...
- Webbased
- Playback through Audioworklet

For the player:

- Minimize the amount of HTML code required to use it.
- Nice full screen experience on phone and desktop

For the extension:

- Plugin into any website and play back the media that is available there.

For the library:

- Make it easy to design your own webbased games and play VGM files in that. But I seperated in later.

Works on current Brave and Chrome now (feb 2026). Compilation works with Emscripten 5.0.1

Lately a lot of additions using vibe coding.

The compiled binaries are build by github actions. However if you want to build yourself:

Prepare_for_usage.sh is required to make the extension feature work, run that after building

## Building

Make sure you have cmake and Emscripten installed.
```
cd /var/www/html/
git clone --recursive https://github.com/niekvlessert/vgmplay-js-2.git
cd vgmplay-js-2
mkdir build
cd build
emcmake cmake ..
make
cd ..
./prepare_for_usage.sh
```

Then put it on your webserver or run a server with Python 3 or something. On localhost non-SSL javascript usage is working fine (at least during my tests). It has some great music included.

By default a player is shown and the html file will be scanned for .zip files. If available they're unpacked into the Emscripten filesystem, then a player will be displayed.

Loading files is as easy as putting them on the webserver and offer them in the index.html, then include the glue and the player will be pick them up, see below:

```html
<html>
<body>
Download this amazing MSX music: <a href="https://192.168.1.18/01.zip">Xak</a><br/>
Download this amazing MSX music: <a href="https://192.168.1.18/02.zip">SD Snatcher</a>
<script src="vgmplay-js-glue.js"></script>
</body>
</html>
```

But you can also drag and drop them at the bottom of the player.

It has many shortcuts, look at the tooltips from the buttons (mousepointer on button and wait a few seconds).

## Supported Libraries & Formats

The full build of `vgmplay-js` includes the following libraries and supports their respective formats. Many thanks for the creators for their hard work it took to get those libraries this far!

| Library | Supported Formats |
| :--- | :--- |
| **libvgm** | `.vgm`, `.vgz` (Core Support) |
| **game-music-emu** | `.spc` (SNES), `.nsf`/`.nsfe` (NES), `.gbs` (GameBoy), `.gym` (Genesis), `.hes` (PC Engine), `.sap` (Atari XL), `.ay` (Spectrum/Amstrad) |
| **libkss** | `.kss`, `.kssx`, `.kscc`, `.mgs`, `.bgm`, `.opx`, `.mpk`, `.mbm` (MSX & KSS variants) |
| **sexypsf** | `.psf`, `.minipsf` (PlayStation) |
| **lazyusf** | `.usf`, `.miniusf` (Nintendo 64) |
| **miniaudio** | `.mp3`, `.flac`, `.ogg`, `.wav` (Modern Audio Formats) |
| **libmusdoom** | `.mus`, `.lmp` (Doom) |
| **Archives** | `.zip`, `.7z`, `.rar`, `.vigamup` (via 7zz, unrar, minizip) |

Full vgmstream format list: see `FORMATS.md`.

## Extension from Chrome & Firefox

A Chrome Extension is also available. Don't forget to run prepare_for_usage.sh. It can be loaded using chrome://extensions, enable developer, and 'load unpacked'. A Firefox version as well: visit about:debugging, click 'This Firefox', press 'Load temporary add-on', browse to the dir and load the manifest.json. When on a site containing vgm zip files the player can be injected in the current page by pressing the button (if added to the available buttons using the puzzle piece...), the player window will appear (almost) unharmed by the styling of the site and playback can commence!

## Vigamup format for KSS files

The KSS format has some support for inserting titles of track titles in KSS files, but most don't have them and which to play from the track to get the actual music and not nothing or some SFX is not supported afaik. That's why I came up with my own little format; with a kss file can be 2 files. The should have the same name, but the extensions should be .gameinfo and .trackinfo.

The contents of the gameinfo file make sense, the data will be displayed in the track information window for every track played.

```
title:Quarth
vendor:Konami
year:1990
composers:Gorgeous Tommy, Norio Hanzawa, Shigehiro Takenouchi
chips:PSG,SCC
```

Two examples of trackinfo entries under here. The syntax is: `<kss id to play>,<title>,<length>,<loop position>,<loop supported>`. The last 2 are for calculating the time to play when 2 times looping is desired, so after that time the fade out can be initiated and the next track can be started. For the second one this will mean 47+((47-5)*2) seconds.

```
5,Opening,11,0,y
19,BGM d-b(SCC Original),47,5,y
```

## Minimal Library Build

The minimal library build has been split out into its own repository at https://github.com/niekvlessert/libvgm-js/

---

## macOS Desktop App

A native macOS wrapper using `WKWebView` is provided in the `desktop-app-mac` directory. It features:
- **Custom `vgmplay://` Scheme**: Seamlessly loads local music files.
- **Native File/Folder Support**: Use the File menu to open individual songs or entire directories.
- **Persistence**: Remembers your last used music folder and auto-loads it on startup.
- **Standalone WASM**: Uses the same production-ready WASM engine as the extension.

### Building the Desktop App
Requires CMake and a Recent version of Xcode.
```bash
cd desktop-app-mac
mkdir build && cd build
cmake ..
make
open VGMPlay.app
```
