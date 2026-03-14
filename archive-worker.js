'use strict';

let _loaded = false;
let _baseURL = '';

function _ensureLoaded(baseURL) {
	if (_loaded) return;
	_baseURL = baseURL || _baseURL || '';
	importScripts(_baseURL + 'minizip-asm.min.js');
	importScripts(_baseURL + '7zz.umd.js');
	importScripts(_baseURL + 'unrar.min.js');
	_loaded = true;
}

function _collectZipEntries(fileList) {
	const entries = Array.isArray(fileList)
		? fileList
		: (fileList && (fileList.files || fileList.filelist || fileList.entries))
			? (fileList.files || fileList.filelist || fileList.entries)
			: Object.values(fileList || {});
	const paths = [];
	let hasKss = false;
	for (const entry of entries) {
		if (!entry || !entry.filepath) continue;
		const filepath = String(entry.filepath);
		if (filepath.endsWith('/')) continue;
		const lower = filepath.toLowerCase();
		paths.push(filepath);
		if (!hasKss && _isKssFile(lower)) {
			hasKss = true;
		}
	}
	return { paths, hasKss };
}

function _isKssFile(path) {
	const p = String(path).toLowerCase().split('|track=')[0];
	return p.endsWith('.kss') || p.endsWith('.kssx') || p.endsWith('.kscc') ||
		p.endsWith('.mgs') || p.endsWith('.bgm') || p.endsWith('.opx') ||
		p.endsWith('.mpk') || p.endsWith('.mbm');
}

function _recurse7zFS(sz, path, relativePath, outList) {
	const entries = sz.FS.readdir(path);
	for (const entry of entries) {
		if (entry === '.' || entry === '..') continue;
		const fullSZPath = path + '/' + entry;
		const fullRelPath = relativePath ? relativePath + '/' + entry : entry;
		const stat = sz.FS.stat(fullSZPath);
		if (sz.FS.isDir(stat.mode)) {
			_recurse7zFS(sz, fullSZPath, fullRelPath, outList);
		} else {
			outList.push(fullRelPath);
		}
	}
}

async function _handleZip(id, buffer, debugMode) {
	const mz = new Minizip(new Uint8Array(buffer));
	const fileList = mz.list();
	const { paths, hasKss } = _collectZipEntries(fileList);
	self.postMessage({ type: 'meta', id, entries: paths, hasKss });
	if (debugMode) console.log(`[Worker] Zip extraction starting for job ${id}: ${paths.length} entries`);
	for (let i = 0; i < paths.length; i++) {
		const relPath = paths[i];
		if (debugMode && i % 50 === 0) console.log(`[Worker] Job ${id}: extracted ${i}/${paths.length} files...`);
		const data = mz.extract(relPath);
		self.postMessage({ type: 'file', id, path: relPath, data }, [data.buffer]);
	}
	if (debugMode) console.log(`[Worker] Job ${id}: Zip extraction complete`);
	self.postMessage({ type: 'done', id });
}

async function _handle7z(id, buffer, debugMode) {
	const sz = await SevenZip({
		locateFile: (path) => _baseURL + path,
		print: () => { },
		printErr: () => { }
	});

	const archiveName = 'archive.7z';
	sz.FS.writeFile(archiveName, new Uint8Array(buffer));
	sz.callMain(['x', archiveName, '-o/out']);

	const paths = [];
	_recurse7zFS(sz, '/out', '', paths);
	let hasKss = false;
	for (const relPath of paths) {
		const lower = relPath.toLowerCase();
		if (_isKssFile(lower)) {
			hasKss = true;
			break;
		}
	}
	self.postMessage({ type: 'meta', id, entries: paths, hasKss });

	if (debugMode) console.log(`[Worker] 7z extraction starting for job ${id}: ${paths.length} entries`);
	for (let i = 0; i < paths.length; i++) {
		const relPath = paths[i];
		if (debugMode && i % 10 === 0) console.log(`[Worker] Job ${id}: reading ${i}/${paths.length} files...`);
		const data = sz.FS.readFile('/out/' + relPath);
		self.postMessage({ type: 'file', id, path: relPath, data }, [data.buffer]);
	}
	if (debugMode) console.log(`[Worker] Job ${id}: 7z extraction complete`);
	self.postMessage({ type: 'done', id });
}

async function _handleRar(id, buffer) {
	if (typeof Unrar === 'undefined') {
		throw new Error('Unrar library not available');
	}
	const rar = new Unrar(new Uint8Array(buffer));
	const entries = rar.getEntries ? rar.getEntries() : [];
	const paths = [];
	let hasKss = false;

	for (const entry of entries) {
		if (!entry || entry.isDirectory && entry.isDirectory()) continue;
		const name = entry.name || '';
		if (!name) continue;
		paths.push(name);
		if (!hasKss && _isKssFile(name.toLowerCase())) {
			hasKss = true;
		}
	}
	self.postMessage({ type: 'meta', id, entries: paths, hasKss });

	for (const relPath of paths) {
		const data = rar.decompress(relPath);
		if (data && data.buffer) {
			self.postMessage({ type: 'file', id, path: relPath, data }, [data.buffer]);
		}
	}
	if (rar.close) rar.close();
	self.postMessage({ type: 'done', id });
}

self.onmessage = async (e) => {
	const msg = e.data || {};
	if (msg.type !== 'extract') return;
	try {
		_ensureLoaded(msg.baseURL || '');
		if (msg.kind === 'zip') {
			await _handleZip(msg.id, msg.buffer, msg.debugMode);
		} else if (msg.kind === '7z') {
			await _handle7z(msg.id, msg.buffer, msg.debugMode);
		} else if (msg.kind === 'rar') {
			await _handleRar(msg.id, msg.buffer, msg.debugMode);
		} else {
			throw new Error('Unknown archive kind: ' + msg.kind);
		}
	} catch (err) {
		self.postMessage({ type: 'error', id: msg.id, message: err && err.message ? err.message : String(err) });
	}
};
