console.log('[Offscreen] Script loaded');

let archiveWorker = null;
let jobs = new Map();
let jobId = 1;

function getArchiveWorker() {
if (archiveWorker) return archiveWorker;
try {
const workerUrl = chrome.runtime.getURL('archive-worker.js');
console.log('[Offscreen] Creating worker from:', workerUrl);
archiveWorker = new Worker(workerUrl);
archiveWorker.onmessage = (e) => {
const msg = e.data || {};
console.log('[Offscreen] Worker message:', msg.type, 'id:', msg.id);
const job = jobs.get(msg.id);
if (!job) return;
if (msg.type === 'meta') {
job.hasKss = !!msg.hasKss;
job.entries = msg.entries || [];
} else if (msg.type === 'file') {
const arr = (msg.data instanceof Uint8Array) ? msg.data : new Uint8Array(msg.data);
job.fileDataByPath.set(msg.path, arr);
} else if (msg.type === 'error') {
jobs.delete(msg.id);
console.error('[Offscreen] Worker error:', msg.message);
chrome.runtime.sendMessage({ type: 'archive-extract-result', id: job.msgId, error: msg.message || 'Worker error' });
} else if (msg.type === 'done') {
jobs.delete(msg.id);
console.log('[Offscreen] Worker done, files:', job.fileDataByPath.size);
const allFiles = Array.from(job.fileDataByPath.entries());
const maxBatchSize = 32 * 1024 * 1024; // 32MB max per batch (safe margin under 64MB limit)
const batches = [];
let currentBatch = [];
let currentSize = 0;

for (const [path, data] of allFiles) {
const b64Size = Math.ceil(data.length * 4 / 3) + path.length + 100; // base64 overhead + path + JSON overhead
if (currentSize + b64Size > maxBatchSize && currentBatch.length > 0) {
batches.push(currentBatch);
currentBatch = [];
currentSize = 0;
}
currentBatch.push([path, data]);
currentSize += b64Size;
}
if (currentBatch.length > 0) {
batches.push(currentBatch);
}

console.log('[Offscreen] Sending', allFiles.length, 'files in', batches.length, 'batches');
for (let i = 0; i < batches.length; i++) {
const batch = batches[i];
const files = [];
for (const [path, data] of batch) {
let binary = '';
const chunkSize = 0x8000;
for (let j = 0; j < data.length; j += chunkSize) {
const sub = data.subarray(j, j + chunkSize);
binary += String.fromCharCode.apply(null, sub);
}
files.push({ path, b64: btoa(binary) });
}
const isLast = i === batches.length - 1;
chrome.runtime.sendMessage({
type: 'archive-extract-result',
id: job.msgId,
entries: isLast ? job.entries : [],
files,
hasKss: isLast ? job.hasKss : false,
done: isLast
});
}
}
};
archiveWorker.onerror = (e) => {
console.error('[Offscreen] Worker error:', e);
};
console.log('[Offscreen] Worker created successfully');
return archiveWorker;
} catch (e) {
console.error('[Offscreen] Failed to create worker:', e);
return null;
}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
console.log('[Offscreen] Message received:', message.type);
if (message.type !== 'extract-archive') {
console.log('[Offscreen] Not extract-archive, returning false');
return false;
}

const { kind, url, id } = message;
console.log('[Offscreen] Received extract request:', kind, 'id:', id, 'url:', url);

if (!url) {
console.error('[Offscreen] No URL provided');
chrome.runtime.sendMessage({ type: 'archive-extract-result', id, error: 'No URL provided' });
return false;
}

(async () => {
try {
console.log('[Offscreen] Fetching:', url);
const response = await fetch(url);
if (!response.ok) {
throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
}
const arrayBuffer = await response.arrayBuffer();
console.log('[Offscreen] Downloaded, size:', arrayBuffer.byteLength);

const worker = getArchiveWorker();
if (!worker) {
console.error('[Offscreen] Worker unavailable');
chrome.runtime.sendMessage({ type: 'archive-extract-result', id, error: 'Worker unavailable' });
return;
}

const wid = jobId++;
jobs.set(wid, {
msgId: id,
hasKss: false,
entries: [],
fileDataByPath: new Map()
});
console.log('[Offscreen] Posting to worker, wid:', wid, 'kind:', kind);
worker.postMessage({ type: 'extract', id: wid, kind, buffer: arrayBuffer }, [arrayBuffer]);
console.log('[Offscreen] Posted to worker');
} catch (e) {
console.error('[Offscreen] Download/extract error:', e);
chrome.runtime.sendMessage({ type: 'archive-extract-result', id, error: e.message || String(e) });
}
})();

return false;
});
