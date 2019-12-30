# vgmplay-js-2
VGMRips VGMPlay transpiled to Javascript, can be used as player and library

This is a new version, based on vgmplay-js. Objectives:

- Make it work on current Emscripten version and browser versions.
- Minimize the amount of HTML code required to use it.
- Make it usuable as a library as well as a player.
- Offer playback through both Scriptprocessor and Audioworklet.

Audioworklet support is not ready yet, as well as the progressbar.

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

You can define which parts of the integrated player are being used by adding divs to the HTML. When building your own player you can use variables and functions from the glue.js file. Documentation for that will be created later. 

Loading vgmrips.net zip files is as easy as putting them on the webserver and feeding them to the player. Look at the example.

```html
<html>
<head>
  <script src="vgmplay-js-glue2.js"></script>
</head>

<body>

<div id="vgmplayStatusWindow"></div>
<div id="vgmplayPlayer"></div>
<div id="vgmplayTitleWindow"></div>
<div id="vgmplayLoopcountSetter"></div>
<div id="vgmplayProgressBar"></div>
<div id="vgmplayUploader"></div>
<div id="vgmplayZipFileList"></div>

<script>
  window.onload=vgmplay_js=new VGMPlay_js();
  var url1="https://"+window.location.hostname+"/01.zip";
</script>

<br/><a onclick="vgmplay_js.loadZIPWithVGMFromURL(url1)">Insert zip file into Webbased VGM player</a><br/>

</body>
</html>
```
