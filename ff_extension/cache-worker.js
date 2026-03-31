'use strict';

self.onmessage = function(e) {
  const msg = e.data || {};
  
  if (msg.type === 'encodeFiles') {
    const results = [];
    for (const item of (msg.files || [])) {
      try {
        const arr = item.data;
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < arr.length; i += chunkSize) {
          const sub = arr.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, sub);
        }
        results.push({
          path: item.path,
          b64: btoa(binary)
        });
      } catch (err) {
        results.push({
          path: item.path,
          error: err.message
        });
      }
    }
    self.postMessage({ type: 'encodeResult', id: msg.id, results });
    return;
  }
  
  if (msg.type === 'encodeCovers') {
    const results = [];
    for (const item of (msg.covers || [])) {
      try {
        const arr = item.data;
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < arr.length; i += chunkSize) {
          const sub = arr.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, sub);
        }
        results.push({
          path: item.path,
          b64: btoa(binary)
        });
      } catch (err) {
        results.push({
          path: item.path,
          error: err.message
        });
      }
    }
    self.postMessage({ type: 'encodeResult', id: msg.id, results });
    return;
  }
};
