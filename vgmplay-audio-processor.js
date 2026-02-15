/**
 * AudioWorklet processor for VGMPlay-js
 * Receives pre-generated audio buffers from the main thread via postMessage
 * and outputs them in the process() callback.
 */
class VGMPlayProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer: array of {left: Float32Array, right: Float32Array}
    this.queue = [];
    this.currentChunk = null;
    this.currentOffset = 0;
    this.playing = false;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'buffer') {
        this.queue.push({ left: msg.left, right: msg.right });
      } else if (msg.type === 'start') {
        this.playing = true;
      } else if (msg.type === 'pause') {
        this.playing = false;
      } else if (msg.type === 'stop') {
        this.playing = false;
        this.queue = [];
        this.currentChunk = null;
        this.currentOffset = 0;
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outLeft = output[0];
    const outRight = output[1];
    const frameCount = outLeft.length; // typically 128

    if (!this.playing) {
      // Output silence
      outLeft.fill(0);
      outRight.fill(0);
      return true;
    }

    let written = 0;

    while (written < frameCount) {
      // Get a chunk if we don't have one
      if (!this.currentChunk) {
        if (this.queue.length === 0) {
          // Underrun — fill remainder with silence
          outLeft.fill(0, written);
          outRight.fill(0, written);
          break;
        }
        this.currentChunk = this.queue.shift();
        this.currentOffset = 0;
      }

      const chunkLeft = this.currentChunk.left;
      const chunkRight = this.currentChunk.right;
      const available = chunkLeft.length - this.currentOffset;
      const needed = frameCount - written;
      const toCopy = Math.min(available, needed);

      for (let i = 0; i < toCopy; i++) {
        outLeft[written + i] = chunkLeft[this.currentOffset + i];
        outRight[written + i] = chunkRight[this.currentOffset + i];
      }

      written += toCopy;
      this.currentOffset += toCopy;

      if (this.currentOffset >= chunkLeft.length) {
        this.currentChunk = null;
        this.currentOffset = 0;
      }
    }

    // Request more data when queue is getting low
    if (this.queue.length < 3) {
      this.port.postMessage({ type: 'need-data' });
    }

    return true;
  }
}

registerProcessor('vgmplay-processor', VGMPlayProcessor);
