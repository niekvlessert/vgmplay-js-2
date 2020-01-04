# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as player and library

This is a new version, based on vgmplay-js. Objectives:

- Make it work on current Emscripten version and browser versions.
- Minimize the amount of HTML code required to use it.
- Make it usuable as a library as well as a player.
- Offer playback through both Scriptprocessor and Audioworklet.

Audioworklet support is not ready yet, as well as some player features.

Works on Chrome 79, Firefox 71, compilation works at least with Emcc 1.39.3.

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

This will generate something like this:

![Screenshot](http://vlessert.nl/vgmplay-js.png)
