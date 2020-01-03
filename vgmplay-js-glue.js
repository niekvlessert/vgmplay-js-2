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

		var script = document.createElement("script");
		script.src = "build/vgmplay-js.js"
		var script2 = document.createElement("script");
		script2.src = "https://cdnjs.cloudflare.com/ajax/libs/mousetrap/1.4.6/mousetrap.min.js";
		var script3 = document.createElement("script");
		script3.src = "minizip-asm.min.js";

		var link = document.createElement('link'); 
		link.rel = 'stylesheet';  
		link.type = 'text/css'; 
		link.href = 'css/style.css';  

		document.head.appendChild(script);
		document.head.appendChild(script2);
		document.head.appendChild(script3);
		document.head.appendChild(link);

		this.debugWindow = document.getElementById("vgmplayStatusWindow");
		if (this.debugWindow) this.showDebugWindow();

		this.playerWindow = document.getElementById("vgmplayPlayer");
		if (this.playerWindow) this.showPlayer();
		
		this.titleWindow = document.getElementById("vgmplayTitleWindow");
		if (this.titleWindow) this.titleWindow.className ="titleWindow";

		this.zipFileListWindow = document.getElementById("vgmplayZipFileList");
		if (this.zipFileListWindow) this.zipFileListWindow.className ="zipFileListWindow";

		this.currentFileKey = "";
	}

	showDebugWindow() {
		this.debugWindow.innerHTML="<center><h2>Debug Window</h2></center>";
		this.debugWindow.className ="debugWindow";
		this.debugWindow.innerHTML+="- Can't initialize WebAudio, please generate some user initiated event..<br/>";
	}

	showPlayer() {
		this.showDebug("vgmplayPlayer div exists, show player...");
		this.playerWindow.className ="playerWindow";
		this.playerWindow.innerHTML = "<button onclick=\"vgmplay_js.changeTrack('previous')\">|&lt;</button> <button id=\"buttonTogglePlayback\" onclick=\"vgmplay_js.togglePlayback()\">&#9654;</button> <button onclick=\"vgmplay_js.changeTrack('next')\">&gt;|</button> <button onclick=\"vgmplay_js.stop()\">&#9632;</button> ";
		this.buttonTogglePlayback = document.getElementById('buttonTogglePlayback');
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
				//https://github.com/rf00/minizip-asm.js
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
		this.m3uFile = "";
		this.txtFile = "";
		this.pngFile = "";
		var xhr = new XMLHttpRequest();
		xhr.responseType = "arraybuffer";
		if (this.zipURLLoaded.includes(url)) {
			this.showDebug("Zip File already loaded...");
			return;
		}
		this.zipURLLoaded.push(url);

		const classContext = this;
		xhr.onreadystatechange = function() {
			if (xhr.readyState == XMLHttpRequest.DONE) {
				var arrayBuffer = xhr.response;
				var byteArray = new Uint8Array(arrayBuffer);
				classContext.mz = new Minizip(byteArray);
				var fileList = classContext.mz.list();
				for (var key in fileList) {
					var fileArray = classContext.mz.extract(fileList[key].filepath);
					var path = escape(fileList[key].filepath);
					fileList[key].filepath=path;
					if (path.includes("m3u")) classContext.m3uFile = path;
					if (path.includes("txt")) classContext.txtFile = path;
					if (path.includes("png")) classContext.pngFile = path;
					FS.createDataFile("/", path, fileArray, true, true);
				}
				classContext.showVGMFromZip(fileList);
			}
		}
		xhr.open('GET', url, true);
		xhr.send(null);
	}

	showVGMFromZip(fileList) {
		this.fileList = fileList;
		if (this.zipFileListWindow) {
			if (this.pngFile) {
				this.contents = FS.readFile(this.pngFile);
				this.blob = new Blob([this.contents], { type: "image/png" });
				this.url = URL.createObjectURL(this.blob);
				this.img = new Image();
				this.img.src = this.url;
				this.zipFileListWindow.appendChild(this.img);
				this.zipFileListWindow.innerHTML+="<br/>";
			}
			for (var key = 0; key < fileList.length; key++) {
				this.fileName = fileList[key].filepath;
				if (this.fileName.includes("vgm") || this.fileName.includes("vgz")) this.zipFileListWindow.innerHTML+="<a onclick=\"vgmplay_js.playFileFromFS('"+this.fileName+"', "+key+")\">"+unescape(this.fileName)+"</a><br/>"; else { this.fileList.splice(key,1); key--; }
			}
			this.zipFileListWindow.innerHTML+="<hr/>";
		}
	}
	
	playFileFromFS(file, key) {
			if (!this.isPlaybackPaused || this.isVGMPlaying) this.stop();
			this.checkEverythingReady();
			this.load(file);
			this.currentFileKey=key;
			this.play();
			this.getVGMTag();
	}

	changeTrack(action) {
		if (action === "next") {
			if (this.currentFileKey+1 === this.fileList.length) this.currentFileKey = 0; else this.currentFileKey++;
			this.stop();
			this.playFileFromFS(this.fileList[this.currentFileKey].filepath, this.currentFileKey);	
		}
		if (action === "previous") {
			if (this.currentFileKey === 0) this.currentFileKey = this.fileList.length-1; else this.currentFileKey--; 
			this.stop();
			this.playFileFromFS(this.fileList[this.currentFileKey].filepath, this.currentFileKey);	
		}
	}

	togglePlayback() {
		if (this.checkEverythingReady()) {
			if (!this.isVGMLoaded && !this.currentFileKey) {
				this.showDebug("No VGM file selected...");
				return;
			}
			if (this.isPlaybackPaused) {
				this.play();
				this.getVGMTag();
			}
			else this.pause();
		}
	}

	async checkEverythingReady() {
		if (typeof moduleInitialized == 'undefined') {
			this.playerWindow.innerHTML = "Module not initialized... wait...";
			setTimeout(this.showPlayer,1000);
			return false;
		}
                this.showDebug("togglePlayback(), moduleInitialized: " + moduleInitialized + ", isVGMLoaded: " + this.isVGMLoaded + ", isPlaybackPaused: " + this.isPlaybackPaused);
		this.showDebug("isWebAudioInitialized: " + this.isWebAudioInitialized);
		this.showDebug("functionsWrapped: " + this.functionsWrapped);
		if (!this.isWebAudioInitialized) {
			this.showDebug("Initializing WebAudio");
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
			//if (this.sampleRate) this.SetSampleRate(this.sampleRate);
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
		this.showDebug("play()");
                document.getElementById("buttonTogglePlayback").innerHTML="||"; //fixen................
		this.isPlaybackPaused = false;

		if (!this.isVGMPlaying) {
			this.showDebug("PlayVGM() in library");
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
		this.showDebug("pause()");
		this.isPlaybackPaused = true;
		this.buttonTogglePlayback.innerHTML="&#9654;"
		this.node.disconnect(this.context.destination);
	}

	stop() {
		this.showDebug("stop()");
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
		this.OpenVGMFile(fileName);
		this.isVGMLoaded = true;
	}

	showDebug(text) {
                if (this.debugWindow) this.debugWindow.innerHTML+= "- " + text + "<br/>";
		this.debugWindow.scrollTop = this.debugWindow.scrollHeight;

	}
	
}
var vgmplay_js=new VGMPlay_js();
