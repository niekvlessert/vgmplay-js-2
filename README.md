# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as player and library

This is a newer version, based on vgmplay-js. Objectives:

- Make it work on current Emscripten version and browser versions.
- Minimize the amount of HTML code required to use it.
- Make it usuable as a library as well as a player.
- Playback through Audioworklet 

Works on current Brave and Chrome now (feb 2026). Compilation works at least with Emcc 1.39.3.

Lately a lot of additions using vibe coding.

Building, for testing it's adviced to check the files out in a directory of the webserver:
```
cd /var/www/html/
git clone --recursive https://github.com/niekvlessert/vgmplay-js-2.git
cd vgmplay-js
cp ~/yrw801.rom files #for ymf278B support
mkdir build
cd build
emcmake cmake ..
make
```

Then visit:

```https://<your webserver ip>/vgmplay-js-2/```

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

A Chrome Extension is also included. It can be loaded using chrome://extensions and 'load unpacked'. When on a site containing vgm zip files it can be injected in the current page by pressing the button (if added to the available buttons using the puzzle piece...), the player window will appear (mostly) unharmed by the styling of the site and playback can commence!

Underneath an older screenshot, but you'd better try the latest version on the right, it's hosted on github as well.

![Screenshot](http://vlessert.nl/vgmplay-js.png)
