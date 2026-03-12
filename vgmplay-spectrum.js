export function installSpectrum(VGMPlay_js) {
	VGMPlay_js.prototype._startSpectrumAnimation = function () {
		if (this._spectrumAnimId) return;
		const draw = () => {
			this._spectrumAnimId = requestAnimationFrame(draw);
			this._drawSpectrum();
			this._updateProgressBar();
		};
		draw();
	};

	VGMPlay_js.prototype._stopSpectrumAnimation = function () {
		if (this._spectrumAnimId) {
			cancelAnimationFrame(this._spectrumAnimId);
			this._spectrumAnimId = null;
		}
	};

	VGMPlay_js.prototype._clearSpectrum = function () {
		if (!this.spectrumCtx) return;
		const ctx = this.spectrumCtx;
		const w = this.spectrumCanvas.width;
		const h = this.spectrumCanvas.height;
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, w, h);
	};

	VGMPlay_js.prototype._drawSpectrum = function () {
		if (!this.analyserLeft || !this.analyserRight || !this.spectrumCtx) return;
		if (this.kssAnalyzerActive) {
			this._drawKssAnalyzer();
		}

		const ctx = this.spectrumCtx;
		const canvas = this.spectrumCanvas;
		const w = canvas.width;
		const h = canvas.height;

		this.analyserLeft.getByteFrequencyData(this.analyserDataLeft);
		this.analyserRight.getByteFrequencyData(this.analyserDataRight);

		// Optimized background: single fill
		ctx.fillStyle = '#000000';
		ctx.fillRect(0, 0, w, h);

		// Cached grid and divider (simple lines are fast)
		ctx.lineWidth = 1;

		// Horizontal grid lines
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
		ctx.beginPath();
		for (let y = 0; y < h; y += 8) {
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
		}
		ctx.stroke();

		// Vertical divider
		ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
		ctx.beginPath();
		ctx.moveTo(w / 2, 0);
		ctx.lineTo(w / 2, h);
		ctx.stroke();

		const binCount = this.analyserLeft.frequencyBinCount; // 128
		const barCount = 16; // bars per channel
		const binsPerBar = Math.floor(binCount / barCount);
		const totalWidthPerChannel = w / 2;
		const barWidth = Math.floor(totalWidthPerChannel / barCount) - 1;
		const gap = 1;

		// Draw Channels (left-to-right for both channels)
		const drawChannel = (data, xOffset) => {
			for (let i = 0; i < barCount; i++) {
				let sum = 0;
				const startBin = i * binsPerBar;
				for (let j = 0; j < binsPerBar; j++) {
					sum += data[startBin + j];
				}
				const avg = sum / binsPerBar;
				const barHeight = (avg / 255) * h;

				const x = xOffset + i * (barWidth + gap);
				const y = h - barHeight;

				const gradient = ctx.createLinearGradient(x, h, x, y);
				gradient.addColorStop(0, '#004400');
				gradient.addColorStop(0.5, '#00cc00');
				gradient.addColorStop(1, '#00ff66');
				ctx.fillStyle = gradient;
				ctx.fillRect(x, y, barWidth, barHeight);

				if (barHeight > 2) {
					ctx.fillStyle = '#aaffaa';
					ctx.fillRect(x, y, barWidth, 2);
				}
			}
		};

		drawChannel(this.analyserDataLeft, 0);
		drawChannel(this.analyserDataRight, w / 2);

		// Scanline overlay effect - optimized: fewer rectangles
		ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
		for (let y = 0; y < h; y += 4) {
			ctx.fillRect(0, y, w, 2);
		}
	};
}
