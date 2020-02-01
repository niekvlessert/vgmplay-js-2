'use strict';

class VGMPlay_js {

	constructor() {
		this.isPlaybackPaused = true;
		this.isWebAudioInitialized = false;
		this.functionsWrapped = false;
		this.isVGMLoaded = false;
		this.generatingAudio = false;
		this.isVGMPlaying = false;
		this.zipURLLoaded = [];
		this.useAsLibrary = false;
		this.displayTitleWindow = true;
		this.displayPlayer = true;
		this.displayZipFileList = true;
		this.showZipFileListWindow = true;
		this.games = [];
		this.activeGame = "";
		this.sampleRate = "";
		this.trackLengthHumanReadeable = false;

		this.pos1 = 0;
		this.pos2 = 0;
		this.pos3 = 0;
		this.pos4 = 0;

		var script = document.createElement("script");
		script.src = "https://niekvlessert.github.io/vgmplay-js-2/vgmplay-js.js"
		var script3 = document.createElement("script");
		script3.src = "https://niekvlessert.github.io/vgmplay-js-2/minizip-asm.min.js";

		document.head.appendChild(script);
		document.head.appendChild(script3);

		const classContext = this;

		//const getSrcOrigin = () => new URL(document.currentScript.src).origin;
		//console.log(getSrcOrigin());

/*
Need to handle these divs as well... but first they need to be implemented...
<div id="vgmplayLoopcountSetter"></div>
<div id="vgmplayProgressBar"></div>
<div id="vgmplayUploader"></div>
*/

		if (typeof vgmplaySettings !== 'undefined') {
			console.log("vgmplaySettings defined");
			if (typeof vgmplaySettings.useAsLibrary !== 'undefined') {
				if (vgmplaySettings.useAsLibrary) {
					console.log("vgmplaySettings.useAsLibrary defined");
					this.useAsLibrary = true;
				}
			}
		}
		if (!this.useAsLibrary) {
			var script2 = document.createElement("script");
			script2.src = "https://cdnjs.cloudflare.com/ajax/libs/mousetrap/1.4.6/mousetrap.min.js";
			document.head.appendChild(script2)

			var link = document.createElement('link');
			link.rel = 'stylesheet';
			link.type = 'text/css';
			link.href = 'https://niekvlessert.github.io/vgmplay-js-2/css/style.css';
			document.head.appendChild(link);

			this.vgmplayContainer = document.createElement('div');
			this.vgmplayContainer.id = "vgmplayContainer";
			document.body.insertBefore(this.vgmplayContainer, document.body.firstChild);
			this.vgmplayContainer.className="vgmplayContainer";

			if (typeof vgmplaySettings !== 'undefined') {
				if (typeof vgmplaySettings.displayZipFileList !== 'undefined') {
					if (!vgmplaySettings.displayZipFileList) {
						this.displayZipFileList = false;
					}
				}
				if (typeof vgmplaySettings.displayPlayer !== 'undefined') {
					if (!vgmplaySettings.displayPlayer) {
						this.displayPlayer = false;
					}
				}
				if (typeof vgmplaySettings.displayTitleWindow !== 'undefined') {
					if (!vgmplaySettings.displayTitleWindow) {
						this.displayTitleWindow = false;
					}
				}
			}
			if (this.displayTitleWindow) {
				this.titleWindow = document.createElement('div');
				this.titleWindow.id = "vgmplayTitleWindow";
				this.vgmplayContainer.appendChild(this.titleWindow);
				this.titleWindow.className ="vgmplayTitleWindow";
				this.titleWindow.addEventListener("mousedown", () => {   
					window.addEventListener('mousemove', this.elementDrag);
				});

				window.addEventListener('mouseup', () => {
				      window.removeEventListener('mousemove', this.elementDrag);
			 	});
			}
			if (this.displayPlayer) {
				this.playerWindow = document.createElement('div');
				this.playerWindow.id = "vgmplayPlayer";
                                this.vgmplayContainer.appendChild(this.playerWindow);
				this.showPlayer();
			}
			if (this.displayZipFileList) {
				this.zipFileListWindow = document.createElement('div');
				this.zipFileListWindow.id = "vgmplayZipFileList";
				//this.zipFileListWindow.innerHTML="<div style=\"position:absolute; right:20;\"><a style=\"color:white\" href='javascript:vgmplay_js.closeZipFileListWindow()'>X</a></div>"
				this.vgmplayContainer.appendChild(this.zipFileListWindow);
				this.showZipFileListWindow = true;
				this.zipFileListWindow.className ="vgmplayZipFileListWindow";
			}
		}

		this.currentFileKey = "";


	}

	setKeyBindings() {
		window.addEventListener('keydown', function(e) {
				if(e.keyCode == 32) e.preventDefault();
				});

		Mousetrap.bind('space', (e) => {
				this.togglePlayback();
			});
		Mousetrap.bind('n', (e) => {
				this.changeTrack('next');
			});
		Mousetrap.bind('p', (e) => {
				this.changeTrack('previous');
			});
		Mousetrap.bind('s', (e) => {
				stop();
			});
	}

	loadWhenReady() {
		this.elms = document.getElementsByTagName("a"),
		this.len = this.elms.length;
		for(var ii = 0; ii < this.len; ii++) {
			//console.log(this.elms[ii].href);
			if (this.elms[ii].href.match(/.zip/g)) this.loadZIPWithVGMFromURL(this.elms[ii].href);
		}
		this.setKeyBindings();
	}

	elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		this.pos1 = this.pos3 - e.clientX;
		this.pos2 = this.pos4 - e.clientY;
		this.pos3 = e.clientX;
		this.pos4 = e.clientY;
		this.vgmplayContainer.style.top = (this.vgmplayContainer.offsetTop - this.pos2) + "px";
		this.vgmplayContainer.style.left = (this.vgmplayContainer.offsetLeft - this.pos1) + "px";
	}

	showPlayer() {
		this.playerWindow.className ="vgmplayPlayerWindow";
		this.playerWindow.innerHTML = "<button onclick=\"vgmplay_js.changeTrack('previous')\">|&lt;</button> <button id=\"buttonTogglePlayback\" onclick=\"vgmplay_js.togglePlayback()\">&#9654;</button> <button onclick=\"vgmplay_js.changeTrack('next')\">&gt;|</button> <button onclick=\"vgmplay_js.stop()\">&#9632;</button> <a style=\"color:white\" href='javascript:vgmplay_js.toggleDisplayZipFileListWindow()'>Z</a>";
		this.buttonTogglePlayback = document.getElementById('buttonTogglePlayback');
	}

	toggleDisplayZipFileListWindow() {
		if (this.showZipFileListWindow) {
			this.vgmplayContainer.removeChild(this.zipFileListWindow);
			this.showZipFileListWindow = false;
		} else {
			this.vgmplayContainer.appendChild(this.zipFileListWindow);
			this.showZipFileListWindow = true;
		}
	}

	getVGMTag() {
		if (this.titleWindow) {
			this.VGMTag = this.ShowTitle().split("|||");
			this.tagType = 0;
			this.titleWindow.innerHTML="";
			for(this.i=0; this.i<this.VGMTag.length; this.i++) {
				switch(this.i) {
					case 0:
						if (this.VGMTag[0] || this.VGMTag[1]) this.titleWindow.innerHTML+="Title: ";
						if (this.VGMTag[0]) this.titleWindow.innerHTML+=this.VGMTag[0];
						if (this.VGMTag[0] && this.VGMTag[1]) this.titleWindow.innerHTML+=", ";
						if (this.VGMTag[1]) this.titleWindow.innerHTML+=this.VGMTag[1];
						if (this.VGMTag[0] || this.VGMTag[1]) this.titleWindow.innerHTML+="<br/>";
						this.titleWindow.innerHTML+="Length: " + this.trackLengthHumanReadeable+"<br/>";
						this.i++;
						break;
					case 2:
						if (this.VGMTag[2] || this.VGMTag[3]) this.titleWindow.innerHTML+="Game: ";
						if (this.VGMTag[2]) this.titleWindow.innerHTML+=this.VGMTag[2];
						if (this.VGMTag[2] && this.VGMTag[3]) this.titleWindow.innerHTML+=", ";
						if (this.VGMTag[3]) this.titleWindow.innerHTML+=this.VGMTag[3];
						if (this.VGMTag[2] || this.VGMTag[3]) this.titleWindow.innerHTML+="<br/>";
						this.i++;
						break;
					case 4:
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML+="System: ";
						if (this.VGMTag[4]) this.titleWindow.innerHTML+=this.VGMTag[4];
						if (this.VGMTag[4] && this.VGMTag[5]) this.titleWindow.innerHTML+=", ";
						if (this.VGMTag[5]) this.titleWindow.innerHTML+=this.VGMTag[5];
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML+="<br/>";
						this.i++;
						break;
					case 6:
						if (this.VGMTag[6] || this.VGMTag[7]) this.titleWindow.innerHTML+="Author: ";
						if (this.VGMTag[6]) this.titleWindow.innerHTML+=this.VGMTag[6];
						if (this.VGMTag[6] && this.VGMTag[7]) this.titleWindow.innerHTML+=", ";
						if (this.VGMTag[7]) this.titleWindow.innerHTML+=this.VGMTag[7];
						if (this.VGMTag[4] || this.VGMTag[5]) this.titleWindow.innerHTML+="<br/>";
						this.i++;
						break;
					case 8:
						if (this.VGMTag[8]) { 
							this.titleWindow.innerHTML+="Creator: ";
							this.titleWindow.innerHTML+=this.VGMTag[8];
							this.titleWindow.innerHTML+="<br/>";
						}
						break;
					case 9:
						if (this.VGMTag[9].length>1) { 
							this.titleWindow.innerHTML+="Notes: ";
							this.titleWindow.innerHTML+=this.VGMTag[9];
							this.titleWindow.innerHTML+="<br/>";
						}
						break;
				}
						
			}
		}
		/*this.contents = FS.readFile(this.pngFile);
		this.blob = new Blob([this.contents], { type: "image/png" });
		this.url = URL.createObjectURL(this.blob);
		this.img = new Image();
		this.img.src = this.url;
		document.body.appendChild(this.img);
		*/
	}

	loadVGMFromURL(url) {
		return new Promise (function (resolve, reject) {
				//Otherwise try to play it with vgmplay.. how?
				try {
				FS.unlink("url.vgm");
				}catch(err) {}

				var xhr = new XMLHttpRequest();
				xhr.responseType = "arraybuffer";

				const classContext = this;
				xhr.onreadystatechange = function() {
				if (xhr.readyState == XMLHttpRequest.DONE) {
				var arrayBuffer = xhr.response;
				var byteArray = new Uint8Array(arrayBuffer);
				FS.createDataFile("/", "url.vgm", byteArray, true, true);
				resolve(xhr.response);
				}
				}
				xhr.open('GET', url, true);
				xhr.send(null);
		});
	}

	loadZIPWithVGMFromURL(url) {
		var xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";
		if (this.zipURLLoaded.includes(url)) {
			return;
		}
		this.zipURLLoaded.push(url);

		const classContext = this;
		xhr.onreadystatechange = function() {
			if (xhr.readyState == XMLHttpRequest.DONE) {
				var m3uFile;
				var txtFile;
				var pngFile;
				var arrayBuffer = xhr.response;
				var byteArray = new Uint8Array(arrayBuffer);
				classContext.mz = new Minizip(byteArray);
				var fileList = classContext.mz.list();
				classContext.amountOfGamesLoaded++;
				for (var key in fileList) {
					var fileArray = classContext.mz.extract(fileList[key].filepath);
					var path = escape(fileList[key].filepath);
					fileList[key].filepath=path;
					FS.createDataFile("/", path, fileArray, true, true);
					if (path.includes("m3u")) m3uFile = FS.readFile(path, { encoding: "utf8" } );
					if (path.includes("txt")) txtFile = FS.readFile(path, { encoding: "utf8" } );
					if (path.includes("png")) pngFile = new Blob ([FS.readFile(path)], { type: "image/png" });
				}
				var game = {files: fileList, m3u: m3uFile, txt: txtFile, png: pngFile};
				classContext.games.push(game);
				classContext.checkEverythingReady().then(classContext.showVGMFromZip(game));
			}
		}
		xhr.open('GET', url, true);
		xhr.send(null);
	}

	showVGMFromZip(game) {
		this.fileList = game.files;
		if (this.zipFileListWindow) {
			if (game.png) {
				this.url = URL.createObjectURL(game.png);
				this.img = new Image();
				this.img.src = this.url;
				this.img.style.width = '256px';
				this.img.style.height = '212px';
				this.zipFileListWindow.appendChild(this.img);
				this.zipFileListWindow.innerHTML+="<br/>";
			}
			for (var key = 0; key < this.fileList.length; key++) {
				this.fileName = this.fileList[key].filepath;
				if (this.fileName.includes("vgm") || this.fileName.includes("vgz")) {
					this.OpenVGMFile(this.fileName);
					this.PlayVGM();
					this.totalSampleCount = this.GetTrackLength()*this.sampleRate/44100;
					this.trackLengthSeconds = Math.round(this.totalSampleCount/this.sampleRate);
					this.trackLengthHumanReadeable = new Date((this.trackLengthSeconds) * 1000).toISOString().substr(14, 5);
					this.zipFileListWindow.innerHTML+="<a onclick=\"vgmplay_js.playFileFromFS(this, '"+this.fileName+"', "+this.games.length+", "+key+")\">"+unescape(this.fileName)+"<span style=\"float:right;\">" + this.trackLengthHumanReadeable + "</a><br/>"; 
					this.StopVGM();
					this.CloseVGMFile();
				} else { this.fileList.splice(key,1); key--; }
			//this.zipFileListWindow.innerHTML+="<hr/>";
			}
		}
	}

	playFileFromFS(href_object, file, game, key) {
			if (game) this.activeGame = this.games[game-1];
			if (!this.isPlaybackPaused || this.isVGMPlaying) this.stop();
			this.checkEverythingReady();
			this.load(file);
			this.currentFileKey=key;
			this.play();
			this.totalSampleCount = this.GetTrackLength()*this.sampleRate/44100;
			this.trackLengthSeconds = Math.round(this.totalSampleCount/this.sampleRate);
			this.trackLengthHumanReadeable = new Date((this.trackLengthSeconds) * 1000).toISOString().substr(14, 5);
			//console.log(this.trackLengthHumanReadeable);
			this.getVGMTag();
			//if (this.zipFileListWindow && href_object) {
				//if (href_object.innerHTML.indexOf(" - ") === -1) href_object.innerHTML+=" - "+this.trackLengthHumanReadeable;
			//}
	}

	changeTrack(action) {
                if (typeof this.activeGame.files === 'undefined') {
			if (action === "next") {
				this.activeGame = this.games[0];
				this.currentFileKey=0;
			} else {
				this.activeGame = this.games[this.games.length-1];
				this.currentFileKey = this.activeGame.files.length-1;
			}
			this.playFileFromFS(false, this.activeGame.files[this.currentFileKey].filepath, false, this.currentFileKey);	
		} else {
			if (action === "next") {
				if (this.currentFileKey+1 === this.activeGame.files.length) this.currentFileKey = 0; else this.currentFileKey++;
				this.stop();
				this.playFileFromFS(false, this.activeGame.files[this.currentFileKey].filepath, false, this.currentFileKey);	
			}
			if (action === "previous") {
				if (this.currentFileKey === 0) this.currentFileKey = this.activeGame.files.length-1; else this.currentFileKey--; 
				this.stop();
				this.playFileFromFS(false, this.activeGame.files[this.currentFileKey].filepath, false, this.currentFileKey);	
			}
		}
	}

	togglePlayback() {
		if (this.checkEverythingReady()) {
			if (!this.isVGMLoaded && !this.currentFileKey) {
				this.changeTrack('next');
			} else {
				if (this.isPlaybackPaused) {
					this.play();
					this.getVGMTag();
				}
				else this.pause();
			}
		}
	}

	async checkEverythingReady() {
		if (!this.isWebAudioInitialized) {
			window.AudioContext = window.AudioContext||window.webkitAudioContext;
			this.context = new AudioContext();
			this.destination = this.destination || this.context.destination;
			this.sampleRate = this.context.sampleRate;
			this.node = this.context.createScriptProcessor(16384, 2, 2);
			this.isWebAudioInitialized = true;
		}
		if (!this.functionsWrapped) {
			this.VGMPlay_Init = Module.cwrap('VGMPlay_Init');
			this.VGMPlay_Init2 = Module.cwrap('VGMPlay_Init2');
			this.FillBuffer = Module.cwrap('FillBuffer2','number',['number','number']);
			this.OpenVGMFile = Module.cwrap('OpenVGMFile','number',['string']);
			this.CloseVGMFile = Module.cwrap('CloseVGMFile');
			this.PlayVGM = Module.cwrap('PlayVGM');
			this.StopVGM = Module.cwrap('StopVGM');
			this.VGMEnded = Module.cwrap('VGMEnded');
			this.GetTrackLength = Module.cwrap('GetTrackLength');
			this.GetLoopPoint = Module.cwrap('GetLoopPoint');
			this.SeekVGM = Module.cwrap('SeekVGM','number',['number','number']);
			this.SetSampleRate = Module.cwrap('SetSampleRate','number',['number']);
			this.SetLoopCount = Module.cwrap('SetLoopCount','number',['number']);
			this.SamplePlayback2VGM = Module.cwrap('SamplePlayback2VGM','number',['number']);
			this.ShowTitle = Module.cwrap('ShowTitle','string');

			this.dataPtrs = [];
			this.dataPtrs[0] = Module._malloc(16384*2);
			this.dataPtrs[1] = Module._malloc(16384*2);

			this.dataHeaps = [];
			this.dataHeaps[0] = new Int16Array(Module.HEAPU8.buffer, this.dataPtrs[0], 16384);
			this.dataHeaps[1] = new Int16Array(Module.HEAPU8.buffer, this.dataPtrs[1], 16384);

			this.buffers = [];
			this.buffers[0] = [];
			this.buffers[1] = [];

			this.results = [];

			this.VGMPlay_Init();
			this.SetSampleRate(this.sampleRate);
			//if (this.loopCount) this.SetLoopCount(this.loopCount); else this.loopCount = 2;
			this.VGMPlay_Init2();

			this.functionsWrapped = true;
		}


		return true;
	}
	
	generateBuffer() {
		this.FillBuffer(this.dataHeaps[0].byteOffset, this.dataHeaps[1].byteOffset);
								
		this.results[0] = new Int16Array(this.dataHeaps[0].buffer, this.dataHeaps[0].byteOffset, 16384);
		this.results[1] = new Int16Array(this.dataHeaps[1].buffer, this.dataHeaps[1].byteOffset, 16384);

		for (var i = 0; i < 16384; i++) {
			this.buffers[0][i] = this.results[0][i] / 32768;
			this.buffers[1][i] = this.results[1][i] / 32768;
		}
	}

	play() {
                document.getElementById("buttonTogglePlayback").innerHTML="||"; //fixen................
		this.isPlaybackPaused = false;

		if (!this.isVGMPlaying) {
			this.PlayVGM();
			this.isVGMPlaying = true;
		}

		this.node.connect(this.context.destination);
		const classContext = this;

		if (!this.generatingAudio) {
			// generate buffer in advance to avoid hickups
			this.generateBuffer();

			this.node.onaudioprocess = function (e) {
				this.output0 = e.outputBuffer.getChannelData(0);
				this.output1 = e.outputBuffer.getChannelData(1);
				if (classContext.VGMEnded()) {
					classContext.stop();
					setTimeout(function(){ classContext.changeTrack("next");},1000);
				}
				for (var i = 0; i < 16384; i++) {
					this.output0[i] = classContext.buffers[0][i];
					this.output1[i] = classContext.buffers[1][i];
				}
				classContext.generateBuffer();
			};
			this.generatingAudio = true;
		}
	}

	pause() {
		this.isPlaybackPaused = true;
		this.buttonTogglePlayback.innerHTML="&#9654;"
		this.node.disconnect(this.context.destination);
	}

	stop() {
                this.buttonTogglePlayback.innerHTML="&#9654;";

		try {
			this.node.disconnect(this.context.destination);
			this.context.close();
		} catch {}

		this.isWebAudioInitialized = false;
		this.generatingAudio = false;

		this.StopVGM();
		this.isVGMPlaying = false;
		this.isVGMLoaded = false;

		this.isPlaybackPaused = true;
	}
		
	load (fileName) {
		if (this.isVGMLoaded) {
			this.StopVGMPlayback();
			this.CloseVGMFile();
		}
		this.OpenVGMFile(fileName);
		this.isVGMLoaded = true;
	}
}
var vgmplay_js=new VGMPlay_js();
