"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var libarchive = (function () {
    var _a;
    var _scriptName = typeof document != 'undefined' ? (_a = document.currentScript) === null || _a === void 0 ? void 0 : _a.src : undefined;
    if (typeof __filename != 'undefined')
        _scriptName = _scriptName || __filename;
    return (function () {
        return __awaiter(this, arguments, void 0, function (moduleArg) {
            function locateFile(path) { if (Module["locateFile"]) {
                return Module["locateFile"](path, scriptDirectory);
            } return scriptDirectory + path; }
            function assert(condition, text) { if (!condition) {
                abort(text);
            } }
            function updateMemoryViews() { var b = wasmMemory.buffer; Module["HEAP8"] = HEAP8 = new Int8Array(b); Module["HEAP16"] = HEAP16 = new Int16Array(b); Module["HEAPU8"] = HEAPU8 = new Uint8Array(b); Module["HEAPU16"] = HEAPU16 = new Uint16Array(b); Module["HEAP32"] = HEAP32 = new Int32Array(b); Module["HEAPU32"] = HEAPU32 = new Uint32Array(b); Module["HEAPF32"] = HEAPF32 = new Float32Array(b); Module["HEAPF64"] = HEAPF64 = new Float64Array(b); }
            function preRun() { if (Module["preRun"]) {
                if (typeof Module["preRun"] == "function")
                    Module["preRun"] = [Module["preRun"]];
                while (Module["preRun"].length) {
                    addOnPreRun(Module["preRun"].shift());
                }
            } callRuntimeCallbacks(onPreRuns); }
            function initRuntime() { runtimeInitialized = true; if (!Module["noFSInit"] && !FS.initialized)
                FS.init(); TTY.init(); PIPEFS.root = FS.mount(PIPEFS, {}, null); wasmExports["x"](); FS.ignorePermissions = false; }
            function postRun() { if (Module["postRun"]) {
                if (typeof Module["postRun"] == "function")
                    Module["postRun"] = [Module["postRun"]];
                while (Module["postRun"].length) {
                    addOnPostRun(Module["postRun"].shift());
                }
            } callRuntimeCallbacks(onPostRuns); }
            function getUniqueRunDependency(id) { return id; }
            function addRunDependency(id) { var _a; runDependencies++; (_a = Module["monitorRunDependencies"]) === null || _a === void 0 ? void 0 : _a.call(Module, runDependencies); }
            function removeRunDependency(id) { var _a; runDependencies--; (_a = Module["monitorRunDependencies"]) === null || _a === void 0 ? void 0 : _a.call(Module, runDependencies); if (runDependencies == 0) {
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback();
                }
            } }
            function abort(what) { var _a; (_a = Module["onAbort"]) === null || _a === void 0 ? void 0 : _a.call(Module, what); what = "Aborted(" + what + ")"; err(what); ABORT = true; what += ". Build with -sASSERTIONS for more info."; var e = new WebAssembly.RuntimeError(what); readyPromiseReject(e); throw e; }
            function findWasmBinary() { return locateFile("libarchive.wasm"); }
            function getBinarySync(file) { if (file == wasmBinaryFile && wasmBinary) {
                return new Uint8Array(wasmBinary);
            } if (readBinary) {
                return readBinary(file);
            } throw "both async and sync fetching of the wasm failed"; }
            function getWasmBinary(binaryFile) {
                return __awaiter(this, void 0, void 0, function () { var response, _a; return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!!wasmBinary) return [3 /*break*/, 4];
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, readAsync(binaryFile)];
                        case 2:
                            response = _b.sent();
                            return [2 /*return*/, new Uint8Array(response)];
                        case 3:
                            _a = _b.sent();
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/, getBinarySync(binaryFile)];
                    }
                }); });
            }
            function instantiateArrayBuffer(binaryFile, imports) {
                return __awaiter(this, void 0, void 0, function () { var binary, instance, reason_1; return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 3, , 4]);
                            return [4 /*yield*/, getWasmBinary(binaryFile)];
                        case 1:
                            binary = _a.sent();
                            return [4 /*yield*/, WebAssembly.instantiate(binary, imports)];
                        case 2:
                            instance = _a.sent();
                            return [2 /*return*/, instance];
                        case 3:
                            reason_1 = _a.sent();
                            err("failed to asynchronously prepare wasm: ".concat(reason_1));
                            abort(reason_1);
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                }); });
            }
            function instantiateAsync(binary, binaryFile, imports) {
                return __awaiter(this, void 0, void 0, function () { var response, instantiationResult, reason_2; return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(!binary && typeof WebAssembly.instantiateStreaming == "function" && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE)) return [3 /*break*/, 4];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            response = fetch(binaryFile, { credentials: "same-origin" });
                            return [4 /*yield*/, WebAssembly.instantiateStreaming(response, imports)];
                        case 2:
                            instantiationResult = _a.sent();
                            return [2 /*return*/, instantiationResult];
                        case 3:
                            reason_2 = _a.sent();
                            err("wasm streaming compile failed: ".concat(reason_2));
                            err("falling back to ArrayBuffer instantiation");
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/, instantiateArrayBuffer(binaryFile, imports)];
                    }
                }); });
            }
            function getWasmImports() { return { a: wasmImports }; }
            function createWasm() {
                return __awaiter(this, void 0, void 0, function () { function receiveInstance(instance, module) { wasmExports = instance.exports; wasmMemory = wasmExports["w"]; updateMemoryViews(); removeRunDependency("wasm-instantiate"); return wasmExports; } function receiveInstantiationResult(result) { return receiveInstance(result["instance"]); } var info, result, exports, e_1; return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            addRunDependency("wasm-instantiate");
                            info = getWasmImports();
                            if (Module["instantiateWasm"]) {
                                return [2 /*return*/, new Promise(function (resolve, reject) { Module["instantiateWasm"](info, function (mod, inst) { receiveInstance(mod, inst); resolve(mod.exports); }); })];
                            }
                            wasmBinaryFile !== null && wasmBinaryFile !== void 0 ? wasmBinaryFile : (wasmBinaryFile = findWasmBinary());
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, instantiateAsync(wasmBinary, wasmBinaryFile, info)];
                        case 2:
                            result = _a.sent();
                            exports = receiveInstantiationResult(result);
                            return [2 /*return*/, exports];
                        case 3:
                            e_1 = _a.sent();
                            readyPromiseReject(e_1);
                            return [2 /*return*/, Promise.reject(e_1)];
                        case 4: return [2 /*return*/];
                    }
                }); });
            }
            function ___syscall_dup(fd) { try {
                var old = SYSCALLS.getStreamFromFD(fd);
                return FS.dupStream(old).fd;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_fcntl64(fd, cmd, varargs) { SYSCALLS.varargs = varargs; try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                switch (cmd) {
                    case 0: {
                        var arg = syscallGetVarargI();
                        if (arg < 0) {
                            return -28;
                        }
                        while (FS.streams[arg]) {
                            arg++;
                        }
                        var newStream;
                        newStream = FS.dupStream(stream, arg);
                        return newStream.fd;
                    }
                    case 1:
                    case 2: return 0;
                    case 3: return stream.flags;
                    case 4: {
                        var arg = syscallGetVarargI();
                        stream.flags |= arg;
                        return 0;
                    }
                    case 12: {
                        var arg = syscallGetVarargP();
                        var offset = 0;
                        HEAP16[arg + offset >> 1] = 2;
                        return 0;
                    }
                    case 13:
                    case 14: return 0;
                }
                return -28;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_fstat64(fd, buf) { try {
                return SYSCALLS.writeStat(buf, FS.fstat(fd));
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_lstat64(path, buf) { try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.writeStat(buf, FS.lstat(path));
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_newfstatat(dirfd, path, buf, flags) { try {
                path = SYSCALLS.getStr(path);
                var nofollow = flags & 256;
                var allowEmpty = flags & 4096;
                flags = flags & ~6400;
                path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
                return SYSCALLS.writeStat(buf, nofollow ? FS.lstat(path) : FS.stat(path));
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_openat(dirfd, path, flags, varargs) { SYSCALLS.varargs = varargs; try {
                path = SYSCALLS.getStr(path);
                path = SYSCALLS.calculateAt(dirfd, path);
                var mode = varargs ? syscallGetVarargI() : 0;
                return FS.open(path, flags, mode).fd;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_pipe(fdPtr) { try {
                if (fdPtr == 0) {
                    throw new FS.ErrnoError(21);
                }
                var res = PIPEFS.createPipe();
                HEAP32[fdPtr >> 2] = res.readable_fd;
                HEAP32[fdPtr + 4 >> 2] = res.writable_fd;
                return 0;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_poll(fds, nfds, timeout) { try {
                var nonzero = 0;
                for (var i = 0; i < nfds; i++) {
                    var pollfd = fds + 8 * i;
                    var fd = HEAP32[pollfd >> 2];
                    var events = HEAP16[pollfd + 4 >> 1];
                    var mask = 32;
                    var stream = FS.getStream(fd);
                    if (stream) {
                        mask = SYSCALLS.DEFAULT_POLLMASK;
                        if (stream.stream_ops.poll) {
                            mask = stream.stream_ops.poll(stream, -1);
                        }
                    }
                    mask &= events | 8 | 16;
                    if (mask)
                        nonzero++;
                    HEAP16[pollfd + 6 >> 1] = mask;
                }
                return nonzero;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function ___syscall_stat64(path, buf) { try {
                path = SYSCALLS.getStr(path);
                return SYSCALLS.writeStat(buf, FS.stat(path));
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return -e.errno;
            } }
            function __localtime_js(time_low, time_high, tmPtr) { var time = convertI32PairToI53Checked(time_low, time_high); var date = new Date(time * 1e3); HEAP32[tmPtr >> 2] = date.getSeconds(); HEAP32[tmPtr + 4 >> 2] = date.getMinutes(); HEAP32[tmPtr + 8 >> 2] = date.getHours(); HEAP32[tmPtr + 12 >> 2] = date.getDate(); HEAP32[tmPtr + 16 >> 2] = date.getMonth(); HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900; HEAP32[tmPtr + 24 >> 2] = date.getDay(); var yday = ydayFromDate(date) | 0; HEAP32[tmPtr + 28 >> 2] = yday; HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60); var start = new Date(date.getFullYear(), 0, 1); var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset(); var winterOffset = start.getTimezoneOffset(); var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0; HEAP32[tmPtr + 32 >> 2] = dst; }
            function _fd_close(fd) { try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.close(stream);
                return 0;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            } }
            function _fd_read(fd, iov, iovcnt, pnum) { try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doReadv(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            } }
            function _fd_seek(fd, offset_low, offset_high, whence, newOffset) { var offset = convertI32PairToI53Checked(offset_low, offset_high); try {
                if (isNaN(offset))
                    return 61;
                var stream = SYSCALLS.getStreamFromFD(fd);
                FS.llseek(stream, offset, whence);
                tempI64 = [stream.position >>> 0, (tempDouble = stream.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[newOffset >> 2] = tempI64[0], HEAP32[newOffset + 4 >> 2] = tempI64[1];
                if (stream.getdents && offset === 0 && whence === 0)
                    stream.getdents = null;
                return 0;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            } }
            function _fd_write(fd, iov, iovcnt, pnum) { try {
                var stream = SYSCALLS.getStreamFromFD(fd);
                var num = doWritev(stream, iov, iovcnt);
                HEAPU32[pnum >> 2] = num;
                return 0;
            }
            catch (e) {
                if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                    throw e;
                return e.errno;
            } }
            function run() { if (runDependencies > 0) {
                dependenciesFulfilled = run;
                return;
            } preRun(); if (runDependencies > 0) {
                dependenciesFulfilled = run;
                return;
            } function doRun() { var _a; Module["calledRun"] = true; if (ABORT)
                return; initRuntime(); readyPromiseResolve(Module); (_a = Module["onRuntimeInitialized"]) === null || _a === void 0 ? void 0 : _a.call(Module); postRun(); } if (Module["setStatus"]) {
                Module["setStatus"]("Running...");
                setTimeout(function () { setTimeout(function () { return Module["setStatus"](""); }, 1); doRun(); }, 1);
            }
            else {
                doRun();
            } }
            var moduleRtn, Module, readyPromiseResolve, readyPromiseReject, readyPromise, ENVIRONMENT_IS_WEB, ENVIRONMENT_IS_WORKER, ENVIRONMENT_IS_NODE, moduleOverrides, arguments_, thisProgram, quit_, scriptDirectory, readAsync, readBinary, fs, nodePath, out, err, wasmBinary, wasmMemory, ABORT, EXITSTATUS, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64, runtimeInitialized, isFileURI, runDependencies, dependenciesFulfilled, wasmBinaryFile, tempDouble, tempI64, ExitStatus, callRuntimeCallbacks, onPostRuns, addOnPostRun, onPreRuns, addOnPreRun, noExitRuntime, stackRestore, stackSave, PATH, initRandomFill, randomFill, PATH_FS, UTF8Decoder, UTF8ArrayToString, FS_stdin_getChar_buffer, lengthBytesUTF8, stringToUTF8Array, intArrayFromString, FS_stdin_getChar, TTY, alignMemory, mmapAlloc, MEMFS, asyncLoad, FS_createDataFile, preloadPlugins, FS_handledByPreloadPlugin, FS_createPreloadedFile, FS_modeStringToFlags, FS_getMode, FS, UTF8ToString, SYSCALLS, syscallGetVarargI, syscallGetVarargP, PIPEFS, __abort_js, isLeapYear, MONTH_DAYS_LEAP_CUMULATIVE, MONTH_DAYS_REGULAR_CUMULATIVE, ydayFromDate, convertI32PairToI53Checked, setTempRet0, __mktime_js, __timegm_js, stringToUTF8, __tzset_js, getHeapMax, growMemory, _emscripten_resize_heap, ENV, getExecutableName, getEnvStrings, stringToAscii, _environ_get, _environ_sizes_get, runtimeKeepaliveCounter, keepRuntimeAlive, _proc_exit, exitJS, _exit, doReadv, doWritev, getCFunc, writeArrayToMemory, stackAlloc, stringToUTF8OnStack, ccall, cwrap, wasmImports, wasmExports, ___wasm_call_ctors, _archive_read_new_memory, _archive_read_new, _archive_read_support_filter_all, _archive_read_support_format_all, _archive_read_add_passphrase, _archive_read_open_memory, _archive_read_next_entry, _archive_entry_atime, _archive_entry_birthtime, _archive_entry_ctime, _archive_entry_filetype, _archive_entry_hardlink_utf8, _archive_entry_mtime, _archive_entry_pathname_utf8, _archive_entry_size, _archive_entry_symlink_utf8, _archive_entry_is_encrypted, _free, _malloc, _archive_read_has_encrypted_entries, _archive_read_data, _archive_read_data_skip, _archive_version_number, _archive_version_string, _archive_error_string, _archive_version_details, _archive_read_free, __emscripten_tempret_set, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current;
            var _this = this;
            if (moduleArg === void 0) { moduleArg = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        Module = moduleArg;
                        readyPromise = new Promise(function (resolve, reject) { readyPromiseResolve = resolve; readyPromiseReject = reject; });
                        ENVIRONMENT_IS_WEB = typeof window == "object";
                        ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
                        ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";
                        if (ENVIRONMENT_IS_NODE) { }
                        moduleOverrides = __assign({}, Module);
                        arguments_ = [];
                        thisProgram = "./this.program";
                        quit_ = function (status, toThrow) { throw toThrow; };
                        scriptDirectory = "";
                        if (ENVIRONMENT_IS_NODE) {
                            fs = require("fs");
                            nodePath = require("path");
                            scriptDirectory = __dirname + "/";
                            readBinary = function (filename) { filename = isFileURI(filename) ? new URL(filename) : filename; var ret = fs.readFileSync(filename); return ret; };
                            readAsync = function (filename_1) {
                                var args_1 = [];
                                for (var _i = 1; _i < arguments.length; _i++) {
                                    args_1[_i - 1] = arguments[_i];
                                }
                                return __awaiter(_this, __spreadArray([filename_1], args_1, true), void 0, function (filename, binary) {
                                    var ret;
                                    if (binary === void 0) { binary = true; }
                                    return __generator(this, function (_a) {
                                        filename = isFileURI(filename) ? new URL(filename) : filename;
                                        ret = fs.readFileSync(filename, binary ? undefined : "utf8");
                                        return [2 /*return*/, ret];
                                    });
                                });
                            };
                            if (!Module["thisProgram"] && process.argv.length > 1) {
                                thisProgram = process.argv[1].replace(/\\/g, "/");
                            }
                            arguments_ = process.argv.slice(2);
                            quit_ = function (status, toThrow) { process.exitCode = status; throw toThrow; };
                        }
                        else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
                            if (ENVIRONMENT_IS_WORKER) {
                                scriptDirectory = self.location.href;
                            }
                            else if (typeof document != "undefined" && document.currentScript) {
                                scriptDirectory = document.currentScript.src;
                            }
                            if (_scriptName) {
                                scriptDirectory = _scriptName;
                            }
                            if (scriptDirectory.startsWith("blob:")) {
                                scriptDirectory = "";
                            }
                            else {
                                scriptDirectory = scriptDirectory.slice(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
                            }
                            {
                                if (ENVIRONMENT_IS_WORKER) {
                                    readBinary = function (url) { var xhr = new XMLHttpRequest; xhr.open("GET", url, false); xhr.responseType = "arraybuffer"; xhr.send(null); return new Uint8Array(xhr.response); };
                                }
                                readAsync = function (url) { return __awaiter(_this, void 0, void 0, function () { var response; return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (isFileURI(url)) {
                                                return [2 /*return*/, new Promise(function (resolve, reject) { var xhr = new XMLHttpRequest; xhr.open("GET", url, true); xhr.responseType = "arraybuffer"; xhr.onload = function () { if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                                                        resolve(xhr.response);
                                                        return;
                                                    } reject(xhr.status); }; xhr.onerror = reject; xhr.send(null); })];
                                            }
                                            return [4 /*yield*/, fetch(url, { credentials: "same-origin" })];
                                        case 1:
                                            response = _a.sent();
                                            if (response.ok) {
                                                return [2 /*return*/, response.arrayBuffer()];
                                            }
                                            throw new Error(response.status + " : " + response.url);
                                    }
                                }); }); };
                            }
                        }
                        else { }
                        out = Module["print"] || console.log.bind(console);
                        err = Module["printErr"] || console.error.bind(console);
                        Object.assign(Module, moduleOverrides);
                        moduleOverrides = null;
                        if (Module["arguments"])
                            arguments_ = Module["arguments"];
                        if (Module["thisProgram"])
                            thisProgram = Module["thisProgram"];
                        wasmBinary = Module["wasmBinary"];
                        ABORT = false;
                        runtimeInitialized = false;
                        isFileURI = function (filename) { return filename.startsWith("file://"); };
                        runDependencies = 0;
                        dependenciesFulfilled = null;
                        ExitStatus = /** @class */ (function () {
                            function ExitStatus(status) {
                                this.name = "ExitStatus";
                                this.message = "Program terminated with exit(".concat(status, ")");
                                this.status = status;
                            }
                            return ExitStatus;
                        }());
                        callRuntimeCallbacks = function (callbacks) { while (callbacks.length > 0) {
                            callbacks.shift()(Module);
                        } };
                        onPostRuns = [];
                        addOnPostRun = function (cb) { return onPostRuns.unshift(cb); };
                        onPreRuns = [];
                        addOnPreRun = function (cb) { return onPreRuns.unshift(cb); };
                        noExitRuntime = Module["noExitRuntime"] || true;
                        stackRestore = function (val) { return __emscripten_stack_restore(val); };
                        stackSave = function () { return _emscripten_stack_get_current(); };
                        PATH = { isAbs: function (path) { return path.charAt(0) === "/"; }, splitPath: function (filename) { var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/; return splitPathRe.exec(filename).slice(1); }, normalizeArray: function (parts, allowAboveRoot) { var up = 0; for (var i = parts.length - 1; i >= 0; i--) {
                                var last = parts[i];
                                if (last === ".") {
                                    parts.splice(i, 1);
                                }
                                else if (last === "..") {
                                    parts.splice(i, 1);
                                    up++;
                                }
                                else if (up) {
                                    parts.splice(i, 1);
                                    up--;
                                }
                            } if (allowAboveRoot) {
                                for (; up; up--) {
                                    parts.unshift("..");
                                }
                            } return parts; }, normalize: function (path) { var isAbsolute = PATH.isAbs(path), trailingSlash = path.slice(-1) === "/"; path = PATH.normalizeArray(path.split("/").filter(function (p) { return !!p; }), !isAbsolute).join("/"); if (!path && !isAbsolute) {
                                path = ".";
                            } if (path && trailingSlash) {
                                path += "/";
                            } return (isAbsolute ? "/" : "") + path; }, dirname: function (path) { var result = PATH.splitPath(path), root = result[0], dir = result[1]; if (!root && !dir) {
                                return ".";
                            } if (dir) {
                                dir = dir.slice(0, -1);
                            } return root + dir; }, basename: function (path) { return path && path.match(/([^\/]+|\/)\/*$/)[1]; }, join: function () {
                                var paths = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    paths[_i] = arguments[_i];
                                }
                                return PATH.normalize(paths.join("/"));
                            }, join2: function (l, r) { return PATH.normalize(l + "/" + r); } };
                        initRandomFill = function () { if (ENVIRONMENT_IS_NODE) {
                            var nodeCrypto = require("crypto");
                            return function (view) { return nodeCrypto.randomFillSync(view); };
                        } return function (view) { return crypto.getRandomValues(view); }; };
                        randomFill = function (view) { (randomFill = initRandomFill())(view); };
                        PATH_FS = { resolve: function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                var resolvedPath = "", resolvedAbsolute = false;
                                for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                                    var path = i >= 0 ? args[i] : FS.cwd();
                                    if (typeof path != "string") {
                                        throw new TypeError("Arguments to path.resolve must be strings");
                                    }
                                    else if (!path) {
                                        return "";
                                    }
                                    resolvedPath = path + "/" + resolvedPath;
                                    resolvedAbsolute = PATH.isAbs(path);
                                }
                                resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) { return !!p; }), !resolvedAbsolute).join("/");
                                return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
                            }, relative: function (from, to) { from = PATH_FS.resolve(from).slice(1); to = PATH_FS.resolve(to).slice(1); function trim(arr) { var start = 0; for (; start < arr.length; start++) {
                                if (arr[start] !== "")
                                    break;
                            } var end = arr.length - 1; for (; end >= 0; end--) {
                                if (arr[end] !== "")
                                    break;
                            } if (start > end)
                                return []; return arr.slice(start, end - start + 1); } var fromParts = trim(from.split("/")); var toParts = trim(to.split("/")); var length = Math.min(fromParts.length, toParts.length); var samePartsLength = length; for (var i = 0; i < length; i++) {
                                if (fromParts[i] !== toParts[i]) {
                                    samePartsLength = i;
                                    break;
                                }
                            } var outputParts = []; for (var i = samePartsLength; i < fromParts.length; i++) {
                                outputParts.push("..");
                            } outputParts = outputParts.concat(toParts.slice(samePartsLength)); return outputParts.join("/"); } };
                        UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;
                        UTF8ArrayToString = function (heapOrArray, idx, maxBytesToRead) {
                            if (idx === void 0) { idx = 0; }
                            if (maxBytesToRead === void 0) { maxBytesToRead = NaN; }
                            var endIdx = idx + maxBytesToRead;
                            var endPtr = idx;
                            while (heapOrArray[endPtr] && !(endPtr >= endIdx))
                                ++endPtr;
                            if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
                                return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
                            }
                            var str = "";
                            while (idx < endPtr) {
                                var u0 = heapOrArray[idx++];
                                if (!(u0 & 128)) {
                                    str += String.fromCharCode(u0);
                                    continue;
                                }
                                var u1 = heapOrArray[idx++] & 63;
                                if ((u0 & 224) == 192) {
                                    str += String.fromCharCode((u0 & 31) << 6 | u1);
                                    continue;
                                }
                                var u2 = heapOrArray[idx++] & 63;
                                if ((u0 & 240) == 224) {
                                    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
                                }
                                else {
                                    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
                                }
                                if (u0 < 65536) {
                                    str += String.fromCharCode(u0);
                                }
                                else {
                                    var ch = u0 - 65536;
                                    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
                                }
                            }
                            return str;
                        };
                        FS_stdin_getChar_buffer = [];
                        lengthBytesUTF8 = function (str) { var len = 0; for (var i = 0; i < str.length; ++i) {
                            var c = str.charCodeAt(i);
                            if (c <= 127) {
                                len++;
                            }
                            else if (c <= 2047) {
                                len += 2;
                            }
                            else if (c >= 55296 && c <= 57343) {
                                len += 4;
                                ++i;
                            }
                            else {
                                len += 3;
                            }
                        } return len; };
                        stringToUTF8Array = function (str, heap, outIdx, maxBytesToWrite) { if (!(maxBytesToWrite > 0))
                            return 0; var startIdx = outIdx; var endIdx = outIdx + maxBytesToWrite - 1; for (var i = 0; i < str.length; ++i) {
                            var u = str.charCodeAt(i);
                            if (u >= 55296 && u <= 57343) {
                                var u1 = str.charCodeAt(++i);
                                u = 65536 + ((u & 1023) << 10) | u1 & 1023;
                            }
                            if (u <= 127) {
                                if (outIdx >= endIdx)
                                    break;
                                heap[outIdx++] = u;
                            }
                            else if (u <= 2047) {
                                if (outIdx + 1 >= endIdx)
                                    break;
                                heap[outIdx++] = 192 | u >> 6;
                                heap[outIdx++] = 128 | u & 63;
                            }
                            else if (u <= 65535) {
                                if (outIdx + 2 >= endIdx)
                                    break;
                                heap[outIdx++] = 224 | u >> 12;
                                heap[outIdx++] = 128 | u >> 6 & 63;
                                heap[outIdx++] = 128 | u & 63;
                            }
                            else {
                                if (outIdx + 3 >= endIdx)
                                    break;
                                heap[outIdx++] = 240 | u >> 18;
                                heap[outIdx++] = 128 | u >> 12 & 63;
                                heap[outIdx++] = 128 | u >> 6 & 63;
                                heap[outIdx++] = 128 | u & 63;
                            }
                        } heap[outIdx] = 0; return outIdx - startIdx; };
                        intArrayFromString = function (stringy, dontAddNull, length) { var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1; var u8array = new Array(len); var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length); if (dontAddNull)
                            u8array.length = numBytesWritten; return u8array; };
                        FS_stdin_getChar = function () { if (!FS_stdin_getChar_buffer.length) {
                            var result = null;
                            if (ENVIRONMENT_IS_NODE) {
                                var BUFSIZE = 256;
                                var buf = Buffer.alloc(BUFSIZE);
                                var bytesRead = 0;
                                var fd = process.stdin.fd;
                                try {
                                    bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
                                }
                                catch (e) {
                                    if (e.toString().includes("EOF"))
                                        bytesRead = 0;
                                    else
                                        throw e;
                                }
                                if (bytesRead > 0) {
                                    result = buf.slice(0, bytesRead).toString("utf-8");
                                }
                            }
                            else if (typeof window != "undefined" && typeof window.prompt == "function") {
                                result = window.prompt("Input: ");
                                if (result !== null) {
                                    result += "\n";
                                }
                            }
                            else { }
                            if (!result) {
                                return null;
                            }
                            FS_stdin_getChar_buffer = intArrayFromString(result, true);
                        } return FS_stdin_getChar_buffer.shift(); };
                        TTY = { ttys: [], init: function () { }, shutdown: function () { }, register: function (dev, ops) { TTY.ttys[dev] = { input: [], output: [], ops: ops }; FS.registerDevice(dev, TTY.stream_ops); }, stream_ops: { open: function (stream) { var tty = TTY.ttys[stream.node.rdev]; if (!tty) {
                                    throw new FS.ErrnoError(43);
                                } stream.tty = tty; stream.seekable = false; }, close: function (stream) { stream.tty.ops.fsync(stream.tty); }, fsync: function (stream) { stream.tty.ops.fsync(stream.tty); }, read: function (stream, buffer, offset, length, pos) { if (!stream.tty || !stream.tty.ops.get_char) {
                                    throw new FS.ErrnoError(60);
                                } var bytesRead = 0; for (var i = 0; i < length; i++) {
                                    var result;
                                    try {
                                        result = stream.tty.ops.get_char(stream.tty);
                                    }
                                    catch (e) {
                                        throw new FS.ErrnoError(29);
                                    }
                                    if (result === undefined && bytesRead === 0) {
                                        throw new FS.ErrnoError(6);
                                    }
                                    if (result === null || result === undefined)
                                        break;
                                    bytesRead++;
                                    buffer[offset + i] = result;
                                } if (bytesRead) {
                                    stream.node.atime = Date.now();
                                } return bytesRead; }, write: function (stream, buffer, offset, length, pos) { if (!stream.tty || !stream.tty.ops.put_char) {
                                    throw new FS.ErrnoError(60);
                                } try {
                                    for (var i = 0; i < length; i++) {
                                        stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
                                    }
                                }
                                catch (e) {
                                    throw new FS.ErrnoError(29);
                                } if (length) {
                                    stream.node.mtime = stream.node.ctime = Date.now();
                                } return i; } }, default_tty_ops: { get_char: function (tty) { return FS_stdin_getChar(); }, put_char: function (tty, val) { if (val === null || val === 10) {
                                    out(UTF8ArrayToString(tty.output));
                                    tty.output = [];
                                }
                                else {
                                    if (val != 0)
                                        tty.output.push(val);
                                } }, fsync: function (tty) { var _a; if (((_a = tty.output) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                                    out(UTF8ArrayToString(tty.output));
                                    tty.output = [];
                                } }, ioctl_tcgets: function (tty) { return { c_iflag: 25856, c_oflag: 5, c_cflag: 191, c_lflag: 35387, c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; }, ioctl_tcsets: function (tty, optional_actions, data) { return 0; }, ioctl_tiocgwinsz: function (tty) { return [24, 80]; } }, default_tty1_ops: { put_char: function (tty, val) { if (val === null || val === 10) {
                                    err(UTF8ArrayToString(tty.output));
                                    tty.output = [];
                                }
                                else {
                                    if (val != 0)
                                        tty.output.push(val);
                                } }, fsync: function (tty) { var _a; if (((_a = tty.output) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                                    err(UTF8ArrayToString(tty.output));
                                    tty.output = [];
                                } } } };
                        alignMemory = function (size, alignment) { return Math.ceil(size / alignment) * alignment; };
                        mmapAlloc = function (size) { abort(); };
                        MEMFS = { ops_table: null, mount: function (mount) { return MEMFS.createNode(null, "/", 16895, 0); }, createNode: function (parent, name, mode, dev) { if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                                throw new FS.ErrnoError(63);
                            } MEMFS.ops_table || (MEMFS.ops_table = { dir: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, lookup: MEMFS.node_ops.lookup, mknod: MEMFS.node_ops.mknod, rename: MEMFS.node_ops.rename, unlink: MEMFS.node_ops.unlink, rmdir: MEMFS.node_ops.rmdir, readdir: MEMFS.node_ops.readdir, symlink: MEMFS.node_ops.symlink }, stream: { llseek: MEMFS.stream_ops.llseek } }, file: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: { llseek: MEMFS.stream_ops.llseek, read: MEMFS.stream_ops.read, write: MEMFS.stream_ops.write, mmap: MEMFS.stream_ops.mmap, msync: MEMFS.stream_ops.msync } }, link: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr, readlink: MEMFS.node_ops.readlink }, stream: {} }, chrdev: { node: { getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr }, stream: FS.chrdev_stream_ops } }); var node = FS.createNode(parent, name, mode, dev); if (FS.isDir(node.mode)) {
                                node.node_ops = MEMFS.ops_table.dir.node;
                                node.stream_ops = MEMFS.ops_table.dir.stream;
                                node.contents = {};
                            }
                            else if (FS.isFile(node.mode)) {
                                node.node_ops = MEMFS.ops_table.file.node;
                                node.stream_ops = MEMFS.ops_table.file.stream;
                                node.usedBytes = 0;
                                node.contents = null;
                            }
                            else if (FS.isLink(node.mode)) {
                                node.node_ops = MEMFS.ops_table.link.node;
                                node.stream_ops = MEMFS.ops_table.link.stream;
                            }
                            else if (FS.isChrdev(node.mode)) {
                                node.node_ops = MEMFS.ops_table.chrdev.node;
                                node.stream_ops = MEMFS.ops_table.chrdev.stream;
                            } node.atime = node.mtime = node.ctime = Date.now(); if (parent) {
                                parent.contents[name] = node;
                                parent.atime = parent.mtime = parent.ctime = node.atime;
                            } return node; }, getFileDataAsTypedArray: function (node) { if (!node.contents)
                                return new Uint8Array(0); if (node.contents.subarray)
                                return node.contents.subarray(0, node.usedBytes); return new Uint8Array(node.contents); }, expandFileStorage: function (node, newCapacity) { var prevCapacity = node.contents ? node.contents.length : 0; if (prevCapacity >= newCapacity)
                                return; var CAPACITY_DOUBLING_MAX = 1024 * 1024; newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) >>> 0); if (prevCapacity != 0)
                                newCapacity = Math.max(newCapacity, 256); var oldContents = node.contents; node.contents = new Uint8Array(newCapacity); if (node.usedBytes > 0)
                                node.contents.set(oldContents.subarray(0, node.usedBytes), 0); }, resizeFileStorage: function (node, newSize) { if (node.usedBytes == newSize)
                                return; if (newSize == 0) {
                                node.contents = null;
                                node.usedBytes = 0;
                            }
                            else {
                                var oldContents = node.contents;
                                node.contents = new Uint8Array(newSize);
                                if (oldContents) {
                                    node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
                                }
                                node.usedBytes = newSize;
                            } }, node_ops: { getattr: function (node) { var attr = {}; attr.dev = FS.isChrdev(node.mode) ? node.id : 1; attr.ino = node.id; attr.mode = node.mode; attr.nlink = 1; attr.uid = 0; attr.gid = 0; attr.rdev = node.rdev; if (FS.isDir(node.mode)) {
                                    attr.size = 4096;
                                }
                                else if (FS.isFile(node.mode)) {
                                    attr.size = node.usedBytes;
                                }
                                else if (FS.isLink(node.mode)) {
                                    attr.size = node.link.length;
                                }
                                else {
                                    attr.size = 0;
                                } attr.atime = new Date(node.atime); attr.mtime = new Date(node.mtime); attr.ctime = new Date(node.ctime); attr.blksize = 4096; attr.blocks = Math.ceil(attr.size / attr.blksize); return attr; }, setattr: function (node, attr) { for (var _i = 0, _a = ["mode", "atime", "mtime", "ctime"]; _i < _a.length; _i++) {
                                    var key = _a[_i];
                                    if (attr[key] != null) {
                                        node[key] = attr[key];
                                    }
                                } if (attr.size !== undefined) {
                                    MEMFS.resizeFileStorage(node, attr.size);
                                } }, lookup: function (parent, name) { throw MEMFS.doesNotExistError; }, mknod: function (parent, name, mode, dev) { return MEMFS.createNode(parent, name, mode, dev); }, rename: function (old_node, new_dir, new_name) { var new_node; try {
                                    new_node = FS.lookupNode(new_dir, new_name);
                                }
                                catch (e) { } if (new_node) {
                                    if (FS.isDir(old_node.mode)) {
                                        for (var i in new_node.contents) {
                                            throw new FS.ErrnoError(55);
                                        }
                                    }
                                    FS.hashRemoveNode(new_node);
                                } delete old_node.parent.contents[old_node.name]; new_dir.contents[new_name] = old_node; old_node.name = new_name; new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now(); }, unlink: function (parent, name) { delete parent.contents[name]; parent.ctime = parent.mtime = Date.now(); }, rmdir: function (parent, name) { var node = FS.lookupNode(parent, name); for (var i in node.contents) {
                                    throw new FS.ErrnoError(55);
                                } delete parent.contents[name]; parent.ctime = parent.mtime = Date.now(); }, readdir: function (node) { return __spreadArray([".", ".."], Object.keys(node.contents), true); }, symlink: function (parent, newname, oldpath) { var node = MEMFS.createNode(parent, newname, 511 | 40960, 0); node.link = oldpath; return node; }, readlink: function (node) { if (!FS.isLink(node.mode)) {
                                    throw new FS.ErrnoError(28);
                                } return node.link; } }, stream_ops: { read: function (stream, buffer, offset, length, position) { var contents = stream.node.contents; if (position >= stream.node.usedBytes)
                                    return 0; var size = Math.min(stream.node.usedBytes - position, length); if (size > 8 && contents.subarray) {
                                    buffer.set(contents.subarray(position, position + size), offset);
                                }
                                else {
                                    for (var i = 0; i < size; i++)
                                        buffer[offset + i] = contents[position + i];
                                } return size; }, write: function (stream, buffer, offset, length, position, canOwn) { if (buffer.buffer === HEAP8.buffer) {
                                    canOwn = false;
                                } if (!length)
                                    return 0; var node = stream.node; node.mtime = node.ctime = Date.now(); if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                                    if (canOwn) {
                                        node.contents = buffer.subarray(offset, offset + length);
                                        node.usedBytes = length;
                                        return length;
                                    }
                                    else if (node.usedBytes === 0 && position === 0) {
                                        node.contents = buffer.slice(offset, offset + length);
                                        node.usedBytes = length;
                                        return length;
                                    }
                                    else if (position + length <= node.usedBytes) {
                                        node.contents.set(buffer.subarray(offset, offset + length), position);
                                        return length;
                                    }
                                } MEMFS.expandFileStorage(node, position + length); if (node.contents.subarray && buffer.subarray) {
                                    node.contents.set(buffer.subarray(offset, offset + length), position);
                                }
                                else {
                                    for (var i = 0; i < length; i++) {
                                        node.contents[position + i] = buffer[offset + i];
                                    }
                                } node.usedBytes = Math.max(node.usedBytes, position + length); return length; }, llseek: function (stream, offset, whence) { var position = offset; if (whence === 1) {
                                    position += stream.position;
                                }
                                else if (whence === 2) {
                                    if (FS.isFile(stream.node.mode)) {
                                        position += stream.node.usedBytes;
                                    }
                                } if (position < 0) {
                                    throw new FS.ErrnoError(28);
                                } return position; }, mmap: function (stream, length, position, prot, flags) { if (!FS.isFile(stream.node.mode)) {
                                    throw new FS.ErrnoError(43);
                                } var ptr; var allocated; var contents = stream.node.contents; if (!(flags & 2) && contents && contents.buffer === HEAP8.buffer) {
                                    allocated = false;
                                    ptr = contents.byteOffset;
                                }
                                else {
                                    allocated = true;
                                    ptr = mmapAlloc(length);
                                    if (!ptr) {
                                        throw new FS.ErrnoError(48);
                                    }
                                    if (contents) {
                                        if (position > 0 || position + length < contents.length) {
                                            if (contents.subarray) {
                                                contents = contents.subarray(position, position + length);
                                            }
                                            else {
                                                contents = Array.prototype.slice.call(contents, position, position + length);
                                            }
                                        }
                                        HEAP8.set(contents, ptr);
                                    }
                                } return { ptr: ptr, allocated: allocated }; }, msync: function (stream, buffer, offset, length, mmapFlags) { MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false); return 0; } } };
                        asyncLoad = function (url) { return __awaiter(_this, void 0, void 0, function () { var arrayBuffer; return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, readAsync(url)];
                                case 1:
                                    arrayBuffer = _a.sent();
                                    return [2 /*return*/, new Uint8Array(arrayBuffer)];
                            }
                        }); }); };
                        FS_createDataFile = function (parent, name, fileData, canRead, canWrite, canOwn) { FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn); };
                        preloadPlugins = Module["preloadPlugins"] || [];
                        FS_handledByPreloadPlugin = function (byteArray, fullname, finish, onerror) { if (typeof Browser != "undefined")
                            Browser.init(); var handled = false; preloadPlugins.forEach(function (plugin) { if (handled)
                            return; if (plugin["canHandle"](fullname)) {
                            plugin["handle"](byteArray, fullname, finish, onerror);
                            handled = true;
                        } }); return handled; };
                        FS_createPreloadedFile = function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) { var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent; var dep = getUniqueRunDependency("cp ".concat(fullname)); function processData(byteArray) { function finish(byteArray) { preFinish === null || preFinish === void 0 ? void 0 : preFinish(); if (!dontCreateFile) {
                            FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
                        } onload === null || onload === void 0 ? void 0 : onload(); removeRunDependency(dep); } if (FS_handledByPreloadPlugin(byteArray, fullname, finish, function () { onerror === null || onerror === void 0 ? void 0 : onerror(); removeRunDependency(dep); })) {
                            return;
                        } finish(byteArray); } addRunDependency(dep); if (typeof url == "string") {
                            asyncLoad(url).then(processData, onerror);
                        }
                        else {
                            processData(url);
                        } };
                        FS_modeStringToFlags = function (str) { var flagModes = { r: 0, "r+": 2, w: 512 | 64 | 1, "w+": 512 | 64 | 2, a: 1024 | 64 | 1, "a+": 1024 | 64 | 2 }; var flags = flagModes[str]; if (typeof flags == "undefined") {
                            throw new Error("Unknown file open mode: ".concat(str));
                        } return flags; };
                        FS_getMode = function (canRead, canWrite) { var mode = 0; if (canRead)
                            mode |= 292 | 73; if (canWrite)
                            mode |= 146; return mode; };
                        FS = { root: null, mounts: [], devices: {}, streams: [], nextInode: 1, nameTable: null, currentPath: "/", initialized: false, ignorePermissions: true, filesystems: null, syncFSRequests: 0, readFiles: {}, ErrnoError: /** @class */ (function () {
                                function class_1(errno) {
                                    this.name = "ErrnoError";
                                    this.errno = errno;
                                }
                                return class_1;
                            }()), FSStream: /** @class */ (function () {
                                function class_2() {
                                    this.shared = {};
                                }
                                Object.defineProperty(class_2.prototype, "object", {
                                    get: function () { return this.node; },
                                    set: function (val) { this.node = val; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_2.prototype, "isRead", {
                                    get: function () { return (this.flags & 2097155) !== 1; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_2.prototype, "isWrite", {
                                    get: function () { return (this.flags & 2097155) !== 0; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_2.prototype, "isAppend", {
                                    get: function () { return this.flags & 1024; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_2.prototype, "flags", {
                                    get: function () { return this.shared.flags; },
                                    set: function (val) { this.shared.flags = val; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_2.prototype, "position", {
                                    get: function () { return this.shared.position; },
                                    set: function (val) { this.shared.position = val; },
                                    enumerable: false,
                                    configurable: true
                                });
                                return class_2;
                            }()), FSNode: /** @class */ (function () {
                                function class_3(parent, name, mode, rdev) {
                                    this.node_ops = {};
                                    this.stream_ops = {};
                                    this.readMode = 292 | 73;
                                    this.writeMode = 146;
                                    this.mounted = null;
                                    if (!parent) {
                                        parent = this;
                                    }
                                    this.parent = parent;
                                    this.mount = parent.mount;
                                    this.id = FS.nextInode++;
                                    this.name = name;
                                    this.mode = mode;
                                    this.rdev = rdev;
                                    this.atime = this.mtime = this.ctime = Date.now();
                                }
                                Object.defineProperty(class_3.prototype, "read", {
                                    get: function () { return (this.mode & this.readMode) === this.readMode; },
                                    set: function (val) { val ? this.mode |= this.readMode : this.mode &= ~this.readMode; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_3.prototype, "write", {
                                    get: function () { return (this.mode & this.writeMode) === this.writeMode; },
                                    set: function (val) { val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_3.prototype, "isFolder", {
                                    get: function () { return FS.isDir(this.mode); },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(class_3.prototype, "isDevice", {
                                    get: function () { return FS.isChrdev(this.mode); },
                                    enumerable: false,
                                    configurable: true
                                });
                                return class_3;
                            }()), lookupPath: function (path, opts) {
                                var _a;
                                if (opts === void 0) { opts = {}; }
                                if (!path) {
                                    throw new FS.ErrnoError(44);
                                }
                                (_a = opts.follow_mount) !== null && _a !== void 0 ? _a : (opts.follow_mount = true);
                                if (!PATH.isAbs(path)) {
                                    path = FS.cwd() + "/" + path;
                                }
                                linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
                                    var parts = path.split("/").filter(function (p) { return !!p; });
                                    var current = FS.root;
                                    var current_path = "/";
                                    for (var i = 0; i < parts.length; i++) {
                                        var islast = i === parts.length - 1;
                                        if (islast && opts.parent) {
                                            break;
                                        }
                                        if (parts[i] === ".") {
                                            continue;
                                        }
                                        if (parts[i] === "..") {
                                            current_path = PATH.dirname(current_path);
                                            current = current.parent;
                                            continue;
                                        }
                                        current_path = PATH.join2(current_path, parts[i]);
                                        try {
                                            current = FS.lookupNode(current, parts[i]);
                                        }
                                        catch (e) {
                                            if ((e === null || e === void 0 ? void 0 : e.errno) === 44 && islast && opts.noent_okay) {
                                                return { path: current_path };
                                            }
                                            throw e;
                                        }
                                        if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
                                            current = current.mounted.root;
                                        }
                                        if (FS.isLink(current.mode) && (!islast || opts.follow)) {
                                            if (!current.node_ops.readlink) {
                                                throw new FS.ErrnoError(52);
                                            }
                                            var link = current.node_ops.readlink(current);
                                            if (!PATH.isAbs(link)) {
                                                link = PATH.dirname(current_path) + "/" + link;
                                            }
                                            path = link + "/" + parts.slice(i + 1).join("/");
                                            continue linkloop;
                                        }
                                    }
                                    return { path: current_path, node: current };
                                }
                                throw new FS.ErrnoError(32);
                            }, getPath: function (node) { var path; while (true) {
                                if (FS.isRoot(node)) {
                                    var mount = node.mount.mountpoint;
                                    if (!path)
                                        return mount;
                                    return mount[mount.length - 1] !== "/" ? "".concat(mount, "/").concat(path) : mount + path;
                                }
                                path = path ? "".concat(node.name, "/").concat(path) : node.name;
                                node = node.parent;
                            } }, hashName: function (parentid, name) { var hash = 0; for (var i = 0; i < name.length; i++) {
                                hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
                            } return (parentid + hash >>> 0) % FS.nameTable.length; }, hashAddNode: function (node) { var hash = FS.hashName(node.parent.id, node.name); node.name_next = FS.nameTable[hash]; FS.nameTable[hash] = node; }, hashRemoveNode: function (node) { var hash = FS.hashName(node.parent.id, node.name); if (FS.nameTable[hash] === node) {
                                FS.nameTable[hash] = node.name_next;
                            }
                            else {
                                var current = FS.nameTable[hash];
                                while (current) {
                                    if (current.name_next === node) {
                                        current.name_next = node.name_next;
                                        break;
                                    }
                                    current = current.name_next;
                                }
                            } }, lookupNode: function (parent, name) { var errCode = FS.mayLookup(parent); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } var hash = FS.hashName(parent.id, name); for (var node = FS.nameTable[hash]; node; node = node.name_next) {
                                var nodeName = node.name;
                                if (node.parent.id === parent.id && nodeName === name) {
                                    return node;
                                }
                            } return FS.lookup(parent, name); }, createNode: function (parent, name, mode, rdev) { var node = new FS.FSNode(parent, name, mode, rdev); FS.hashAddNode(node); return node; }, destroyNode: function (node) { FS.hashRemoveNode(node); }, isRoot: function (node) { return node === node.parent; }, isMountpoint: function (node) { return !!node.mounted; }, isFile: function (mode) { return (mode & 61440) === 32768; }, isDir: function (mode) { return (mode & 61440) === 16384; }, isLink: function (mode) { return (mode & 61440) === 40960; }, isChrdev: function (mode) { return (mode & 61440) === 8192; }, isBlkdev: function (mode) { return (mode & 61440) === 24576; }, isFIFO: function (mode) { return (mode & 61440) === 4096; }, isSocket: function (mode) { return (mode & 49152) === 49152; }, flagsToPermissionString: function (flag) { var perms = ["r", "w", "rw"][flag & 3]; if (flag & 512) {
                                perms += "w";
                            } return perms; }, nodePermissions: function (node, perms) { if (FS.ignorePermissions) {
                                return 0;
                            } if (perms.includes("r") && !(node.mode & 292)) {
                                return 2;
                            }
                            else if (perms.includes("w") && !(node.mode & 146)) {
                                return 2;
                            }
                            else if (perms.includes("x") && !(node.mode & 73)) {
                                return 2;
                            } return 0; }, mayLookup: function (dir) { if (!FS.isDir(dir.mode))
                                return 54; var errCode = FS.nodePermissions(dir, "x"); if (errCode)
                                return errCode; if (!dir.node_ops.lookup)
                                return 2; return 0; }, mayCreate: function (dir, name) { if (!FS.isDir(dir.mode)) {
                                return 54;
                            } try {
                                var node = FS.lookupNode(dir, name);
                                return 20;
                            }
                            catch (e) { } return FS.nodePermissions(dir, "wx"); }, mayDelete: function (dir, name, isdir) { var node; try {
                                node = FS.lookupNode(dir, name);
                            }
                            catch (e) {
                                return e.errno;
                            } var errCode = FS.nodePermissions(dir, "wx"); if (errCode) {
                                return errCode;
                            } if (isdir) {
                                if (!FS.isDir(node.mode)) {
                                    return 54;
                                }
                                if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                                    return 10;
                                }
                            }
                            else {
                                if (FS.isDir(node.mode)) {
                                    return 31;
                                }
                            } return 0; }, mayOpen: function (node, flags) { if (!node) {
                                return 44;
                            } if (FS.isLink(node.mode)) {
                                return 32;
                            }
                            else if (FS.isDir(node.mode)) {
                                if (FS.flagsToPermissionString(flags) !== "r" || flags & (512 | 64)) {
                                    return 31;
                                }
                            } return FS.nodePermissions(node, FS.flagsToPermissionString(flags)); }, checkOpExists: function (op, err) { if (!op) {
                                throw new FS.ErrnoError(err);
                            } return op; }, MAX_OPEN_FDS: 4096, nextfd: function () { for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
                                if (!FS.streams[fd]) {
                                    return fd;
                                }
                            } throw new FS.ErrnoError(33); }, getStreamChecked: function (fd) { var stream = FS.getStream(fd); if (!stream) {
                                throw new FS.ErrnoError(8);
                            } return stream; }, getStream: function (fd) { return FS.streams[fd]; }, createStream: function (stream, fd) {
                                if (fd === void 0) { fd = -1; }
                                stream = Object.assign(new FS.FSStream, stream);
                                if (fd == -1) {
                                    fd = FS.nextfd();
                                }
                                stream.fd = fd;
                                FS.streams[fd] = stream;
                                return stream;
                            }, closeStream: function (fd) { FS.streams[fd] = null; }, dupStream: function (origStream, fd) {
                                var _a, _b;
                                if (fd === void 0) { fd = -1; }
                                var stream = FS.createStream(origStream, fd);
                                (_b = (_a = stream.stream_ops) === null || _a === void 0 ? void 0 : _a.dup) === null || _b === void 0 ? void 0 : _b.call(_a, stream);
                                return stream;
                            }, doSetAttr: function (stream, node, attr) { var setattr = stream === null || stream === void 0 ? void 0 : stream.stream_ops.setattr; var arg = setattr ? stream : node; setattr !== null && setattr !== void 0 ? setattr : (setattr = node.node_ops.setattr); FS.checkOpExists(setattr, 63); setattr(arg, attr); }, chrdev_stream_ops: { open: function (stream) { var _a, _b; var device = FS.getDevice(stream.node.rdev); stream.stream_ops = device.stream_ops; (_b = (_a = stream.stream_ops).open) === null || _b === void 0 ? void 0 : _b.call(_a, stream); }, llseek: function () { throw new FS.ErrnoError(70); } }, major: function (dev) { return dev >> 8; }, minor: function (dev) { return dev & 255; }, makedev: function (ma, mi) { return ma << 8 | mi; }, registerDevice: function (dev, ops) { FS.devices[dev] = { stream_ops: ops }; }, getDevice: function (dev) { return FS.devices[dev]; }, getMounts: function (mount) { var mounts = []; var check = [mount]; while (check.length) {
                                var m = check.pop();
                                mounts.push(m);
                                check.push.apply(check, m.mounts);
                            } return mounts; }, syncfs: function (populate, callback) { if (typeof populate == "function") {
                                callback = populate;
                                populate = false;
                            } FS.syncFSRequests++; if (FS.syncFSRequests > 1) {
                                err("warning: ".concat(FS.syncFSRequests, " FS.syncfs operations in flight at once, probably just doing extra work"));
                            } var mounts = FS.getMounts(FS.root.mount); var completed = 0; function doCallback(errCode) { FS.syncFSRequests--; return callback(errCode); } function done(errCode) { if (errCode) {
                                if (!done.errored) {
                                    done.errored = true;
                                    return doCallback(errCode);
                                }
                                return;
                            } if (++completed >= mounts.length) {
                                doCallback(null);
                            } } mounts.forEach(function (mount) { if (!mount.type.syncfs) {
                                return done(null);
                            } mount.type.syncfs(mount, populate, done); }); }, mount: function (type, opts, mountpoint) { var root = mountpoint === "/"; var pseudo = !mountpoint; var node; if (root && FS.root) {
                                throw new FS.ErrnoError(10);
                            }
                            else if (!root && !pseudo) {
                                var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
                                mountpoint = lookup.path;
                                node = lookup.node;
                                if (FS.isMountpoint(node)) {
                                    throw new FS.ErrnoError(10);
                                }
                                if (!FS.isDir(node.mode)) {
                                    throw new FS.ErrnoError(54);
                                }
                            } var mount = { type: type, opts: opts, mountpoint: mountpoint, mounts: [] }; var mountRoot = type.mount(mount); mountRoot.mount = mount; mount.root = mountRoot; if (root) {
                                FS.root = mountRoot;
                            }
                            else if (node) {
                                node.mounted = mount;
                                if (node.mount) {
                                    node.mount.mounts.push(mount);
                                }
                            } return mountRoot; }, unmount: function (mountpoint) { var lookup = FS.lookupPath(mountpoint, { follow_mount: false }); if (!FS.isMountpoint(lookup.node)) {
                                throw new FS.ErrnoError(28);
                            } var node = lookup.node; var mount = node.mounted; var mounts = FS.getMounts(mount); Object.keys(FS.nameTable).forEach(function (hash) { var current = FS.nameTable[hash]; while (current) {
                                var next = current.name_next;
                                if (mounts.includes(current.mount)) {
                                    FS.destroyNode(current);
                                }
                                current = next;
                            } }); node.mounted = null; var idx = node.mount.mounts.indexOf(mount); node.mount.mounts.splice(idx, 1); }, lookup: function (parent, name) { return parent.node_ops.lookup(parent, name); }, mknod: function (path, mode, dev) { var lookup = FS.lookupPath(path, { parent: true }); var parent = lookup.node; var name = PATH.basename(path); if (!name) {
                                throw new FS.ErrnoError(28);
                            } if (name === "." || name === "..") {
                                throw new FS.ErrnoError(20);
                            } var errCode = FS.mayCreate(parent, name); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } if (!parent.node_ops.mknod) {
                                throw new FS.ErrnoError(63);
                            } return parent.node_ops.mknod(parent, name, mode, dev); }, statfs: function (path) { return FS.statfsNode(FS.lookupPath(path, { follow: true }).node); }, statfsStream: function (stream) { return FS.statfsNode(stream.node); }, statfsNode: function (node) { var rtn = { bsize: 4096, frsize: 4096, blocks: 1e6, bfree: 5e5, bavail: 5e5, files: FS.nextInode, ffree: FS.nextInode - 1, fsid: 42, flags: 2, namelen: 255 }; if (node.node_ops.statfs) {
                                Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
                            } return rtn; }, create: function (path, mode) {
                                if (mode === void 0) { mode = 438; }
                                mode &= 4095;
                                mode |= 32768;
                                return FS.mknod(path, mode, 0);
                            }, mkdir: function (path, mode) {
                                if (mode === void 0) { mode = 511; }
                                mode &= 511 | 512;
                                mode |= 16384;
                                return FS.mknod(path, mode, 0);
                            }, mkdirTree: function (path, mode) { var dirs = path.split("/"); var d = ""; for (var _i = 0, dirs_1 = dirs; _i < dirs_1.length; _i++) {
                                var dir = dirs_1[_i];
                                if (!dir)
                                    continue;
                                d += "/" + dir;
                                try {
                                    FS.mkdir(d, mode);
                                }
                                catch (e) {
                                    if (e.errno != 20)
                                        throw e;
                                }
                            } }, mkdev: function (path, mode, dev) { if (typeof dev == "undefined") {
                                dev = mode;
                                mode = 438;
                            } mode |= 8192; return FS.mknod(path, mode, dev); }, symlink: function (oldpath, newpath) { if (!PATH_FS.resolve(oldpath)) {
                                throw new FS.ErrnoError(44);
                            } var lookup = FS.lookupPath(newpath, { parent: true }); var parent = lookup.node; if (!parent) {
                                throw new FS.ErrnoError(44);
                            } var newname = PATH.basename(newpath); var errCode = FS.mayCreate(parent, newname); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } if (!parent.node_ops.symlink) {
                                throw new FS.ErrnoError(63);
                            } return parent.node_ops.symlink(parent, newname, oldpath); }, rename: function (old_path, new_path) { var old_dirname = PATH.dirname(old_path); var new_dirname = PATH.dirname(new_path); var old_name = PATH.basename(old_path); var new_name = PATH.basename(new_path); var lookup, old_dir, new_dir; lookup = FS.lookupPath(old_path, { parent: true }); old_dir = lookup.node; lookup = FS.lookupPath(new_path, { parent: true }); new_dir = lookup.node; if (!old_dir || !new_dir)
                                throw new FS.ErrnoError(44); if (old_dir.mount !== new_dir.mount) {
                                throw new FS.ErrnoError(75);
                            } var old_node = FS.lookupNode(old_dir, old_name); var relative = PATH_FS.relative(old_path, new_dirname); if (relative.charAt(0) !== ".") {
                                throw new FS.ErrnoError(28);
                            } relative = PATH_FS.relative(new_path, old_dirname); if (relative.charAt(0) !== ".") {
                                throw new FS.ErrnoError(55);
                            } var new_node; try {
                                new_node = FS.lookupNode(new_dir, new_name);
                            }
                            catch (e) { } if (old_node === new_node) {
                                return;
                            } var isdir = FS.isDir(old_node.mode); var errCode = FS.mayDelete(old_dir, old_name, isdir); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } errCode = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } if (!old_dir.node_ops.rename) {
                                throw new FS.ErrnoError(63);
                            } if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
                                throw new FS.ErrnoError(10);
                            } if (new_dir !== old_dir) {
                                errCode = FS.nodePermissions(old_dir, "w");
                                if (errCode) {
                                    throw new FS.ErrnoError(errCode);
                                }
                            } FS.hashRemoveNode(old_node); try {
                                old_dir.node_ops.rename(old_node, new_dir, new_name);
                                old_node.parent = new_dir;
                            }
                            catch (e) {
                                throw e;
                            }
                            finally {
                                FS.hashAddNode(old_node);
                            } }, rmdir: function (path) { var lookup = FS.lookupPath(path, { parent: true }); var parent = lookup.node; var name = PATH.basename(path); var node = FS.lookupNode(parent, name); var errCode = FS.mayDelete(parent, name, true); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } if (!parent.node_ops.rmdir) {
                                throw new FS.ErrnoError(63);
                            } if (FS.isMountpoint(node)) {
                                throw new FS.ErrnoError(10);
                            } parent.node_ops.rmdir(parent, name); FS.destroyNode(node); }, readdir: function (path) { var lookup = FS.lookupPath(path, { follow: true }); var node = lookup.node; var readdir = FS.checkOpExists(node.node_ops.readdir, 54); return readdir(node); }, unlink: function (path) { var lookup = FS.lookupPath(path, { parent: true }); var parent = lookup.node; if (!parent) {
                                throw new FS.ErrnoError(44);
                            } var name = PATH.basename(path); var node = FS.lookupNode(parent, name); var errCode = FS.mayDelete(parent, name, false); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } if (!parent.node_ops.unlink) {
                                throw new FS.ErrnoError(63);
                            } if (FS.isMountpoint(node)) {
                                throw new FS.ErrnoError(10);
                            } parent.node_ops.unlink(parent, name); FS.destroyNode(node); }, readlink: function (path) { var lookup = FS.lookupPath(path); var link = lookup.node; if (!link) {
                                throw new FS.ErrnoError(44);
                            } if (!link.node_ops.readlink) {
                                throw new FS.ErrnoError(28);
                            } return link.node_ops.readlink(link); }, stat: function (path, dontFollow) { var lookup = FS.lookupPath(path, { follow: !dontFollow }); var node = lookup.node; var getattr = FS.checkOpExists(node.node_ops.getattr, 63); return getattr(node); }, fstat: function (fd) { var stream = FS.getStreamChecked(fd); var node = stream.node; var getattr = stream.stream_ops.getattr; var arg = getattr ? stream : node; getattr !== null && getattr !== void 0 ? getattr : (getattr = node.node_ops.getattr); FS.checkOpExists(getattr, 63); return getattr(arg); }, lstat: function (path) { return FS.stat(path, true); }, doChmod: function (stream, node, mode, dontFollow) { FS.doSetAttr(stream, node, { mode: mode & 4095 | node.mode & ~4095, ctime: Date.now(), dontFollow: dontFollow }); }, chmod: function (path, mode, dontFollow) { var node; if (typeof path == "string") {
                                var lookup = FS.lookupPath(path, { follow: !dontFollow });
                                node = lookup.node;
                            }
                            else {
                                node = path;
                            } FS.doChmod(null, node, mode, dontFollow); }, lchmod: function (path, mode) { FS.chmod(path, mode, true); }, fchmod: function (fd, mode) { var stream = FS.getStreamChecked(fd); FS.doChmod(stream, stream.node, mode, false); }, doChown: function (stream, node, dontFollow) { FS.doSetAttr(stream, node, { timestamp: Date.now(), dontFollow: dontFollow }); }, chown: function (path, uid, gid, dontFollow) { var node; if (typeof path == "string") {
                                var lookup = FS.lookupPath(path, { follow: !dontFollow });
                                node = lookup.node;
                            }
                            else {
                                node = path;
                            } FS.doChown(null, node, dontFollow); }, lchown: function (path, uid, gid) { FS.chown(path, uid, gid, true); }, fchown: function (fd, uid, gid) { var stream = FS.getStreamChecked(fd); FS.doChown(stream, stream.node, false); }, doTruncate: function (stream, node, len) { if (FS.isDir(node.mode)) {
                                throw new FS.ErrnoError(31);
                            } if (!FS.isFile(node.mode)) {
                                throw new FS.ErrnoError(28);
                            } var errCode = FS.nodePermissions(node, "w"); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } FS.doSetAttr(stream, node, { size: len, timestamp: Date.now() }); }, truncate: function (path, len) { if (len < 0) {
                                throw new FS.ErrnoError(28);
                            } var node; if (typeof path == "string") {
                                var lookup = FS.lookupPath(path, { follow: true });
                                node = lookup.node;
                            }
                            else {
                                node = path;
                            } FS.doTruncate(null, node, len); }, ftruncate: function (fd, len) { var stream = FS.getStreamChecked(fd); if (len < 0 || (stream.flags & 2097155) === 0) {
                                throw new FS.ErrnoError(28);
                            } FS.doTruncate(stream, stream.node, len); }, utime: function (path, atime, mtime) { var lookup = FS.lookupPath(path, { follow: true }); var node = lookup.node; var setattr = FS.checkOpExists(node.node_ops.setattr, 63); setattr(node, { atime: atime, mtime: mtime }); }, open: function (path, flags, mode) {
                                if (mode === void 0) { mode = 438; }
                                if (path === "") {
                                    throw new FS.ErrnoError(44);
                                }
                                flags = typeof flags == "string" ? FS_modeStringToFlags(flags) : flags;
                                if (flags & 64) {
                                    mode = mode & 4095 | 32768;
                                }
                                else {
                                    mode = 0;
                                }
                                var node;
                                var isDirPath;
                                if (typeof path == "object") {
                                    node = path;
                                }
                                else {
                                    isDirPath = path.endsWith("/");
                                    var lookup = FS.lookupPath(path, { follow: !(flags & 131072), noent_okay: true });
                                    node = lookup.node;
                                    path = lookup.path;
                                }
                                var created = false;
                                if (flags & 64) {
                                    if (node) {
                                        if (flags & 128) {
                                            throw new FS.ErrnoError(20);
                                        }
                                    }
                                    else if (isDirPath) {
                                        throw new FS.ErrnoError(31);
                                    }
                                    else {
                                        node = FS.mknod(path, mode | 511, 0);
                                        created = true;
                                    }
                                }
                                if (!node) {
                                    throw new FS.ErrnoError(44);
                                }
                                if (FS.isChrdev(node.mode)) {
                                    flags &= ~512;
                                }
                                if (flags & 65536 && !FS.isDir(node.mode)) {
                                    throw new FS.ErrnoError(54);
                                }
                                if (!created) {
                                    var errCode = FS.mayOpen(node, flags);
                                    if (errCode) {
                                        throw new FS.ErrnoError(errCode);
                                    }
                                }
                                if (flags & 512 && !created) {
                                    FS.truncate(node, 0);
                                }
                                flags &= ~(128 | 512 | 131072);
                                var stream = FS.createStream({ node: node, path: FS.getPath(node), flags: flags, seekable: true, position: 0, stream_ops: node.stream_ops, ungotten: [], error: false });
                                if (stream.stream_ops.open) {
                                    stream.stream_ops.open(stream);
                                }
                                if (created) {
                                    FS.chmod(node, mode & 511);
                                }
                                if (Module["logReadFiles"] && !(flags & 1)) {
                                    if (!(path in FS.readFiles)) {
                                        FS.readFiles[path] = 1;
                                    }
                                }
                                return stream;
                            }, close: function (stream) { if (FS.isClosed(stream)) {
                                throw new FS.ErrnoError(8);
                            } if (stream.getdents)
                                stream.getdents = null; try {
                                if (stream.stream_ops.close) {
                                    stream.stream_ops.close(stream);
                                }
                            }
                            catch (e) {
                                throw e;
                            }
                            finally {
                                FS.closeStream(stream.fd);
                            } stream.fd = null; }, isClosed: function (stream) { return stream.fd === null; }, llseek: function (stream, offset, whence) { if (FS.isClosed(stream)) {
                                throw new FS.ErrnoError(8);
                            } if (!stream.seekable || !stream.stream_ops.llseek) {
                                throw new FS.ErrnoError(70);
                            } if (whence != 0 && whence != 1 && whence != 2) {
                                throw new FS.ErrnoError(28);
                            } stream.position = stream.stream_ops.llseek(stream, offset, whence); stream.ungotten = []; return stream.position; }, read: function (stream, buffer, offset, length, position) { if (length < 0 || position < 0) {
                                throw new FS.ErrnoError(28);
                            } if (FS.isClosed(stream)) {
                                throw new FS.ErrnoError(8);
                            } if ((stream.flags & 2097155) === 1) {
                                throw new FS.ErrnoError(8);
                            } if (FS.isDir(stream.node.mode)) {
                                throw new FS.ErrnoError(31);
                            } if (!stream.stream_ops.read) {
                                throw new FS.ErrnoError(28);
                            } var seeking = typeof position != "undefined"; if (!seeking) {
                                position = stream.position;
                            }
                            else if (!stream.seekable) {
                                throw new FS.ErrnoError(70);
                            } var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position); if (!seeking)
                                stream.position += bytesRead; return bytesRead; }, write: function (stream, buffer, offset, length, position, canOwn) { if (length < 0 || position < 0) {
                                throw new FS.ErrnoError(28);
                            } if (FS.isClosed(stream)) {
                                throw new FS.ErrnoError(8);
                            } if ((stream.flags & 2097155) === 0) {
                                throw new FS.ErrnoError(8);
                            } if (FS.isDir(stream.node.mode)) {
                                throw new FS.ErrnoError(31);
                            } if (!stream.stream_ops.write) {
                                throw new FS.ErrnoError(28);
                            } if (stream.seekable && stream.flags & 1024) {
                                FS.llseek(stream, 0, 2);
                            } var seeking = typeof position != "undefined"; if (!seeking) {
                                position = stream.position;
                            }
                            else if (!stream.seekable) {
                                throw new FS.ErrnoError(70);
                            } var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn); if (!seeking)
                                stream.position += bytesWritten; return bytesWritten; }, mmap: function (stream, length, position, prot, flags) { if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
                                throw new FS.ErrnoError(2);
                            } if ((stream.flags & 2097155) === 1) {
                                throw new FS.ErrnoError(2);
                            } if (!stream.stream_ops.mmap) {
                                throw new FS.ErrnoError(43);
                            } if (!length) {
                                throw new FS.ErrnoError(28);
                            } return stream.stream_ops.mmap(stream, length, position, prot, flags); }, msync: function (stream, buffer, offset, length, mmapFlags) { if (!stream.stream_ops.msync) {
                                return 0;
                            } return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags); }, ioctl: function (stream, cmd, arg) { if (!stream.stream_ops.ioctl) {
                                throw new FS.ErrnoError(59);
                            } return stream.stream_ops.ioctl(stream, cmd, arg); }, readFile: function (path, opts) {
                                if (opts === void 0) { opts = {}; }
                                opts.flags = opts.flags || 0;
                                opts.encoding = opts.encoding || "binary";
                                if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                                    throw new Error("Invalid encoding type \"".concat(opts.encoding, "\""));
                                }
                                var ret;
                                var stream = FS.open(path, opts.flags);
                                var stat = FS.stat(path);
                                var length = stat.size;
                                var buf = new Uint8Array(length);
                                FS.read(stream, buf, 0, length, 0);
                                if (opts.encoding === "utf8") {
                                    ret = UTF8ArrayToString(buf);
                                }
                                else if (opts.encoding === "binary") {
                                    ret = buf;
                                }
                                FS.close(stream);
                                return ret;
                            }, writeFile: function (path, data, opts) {
                                if (opts === void 0) { opts = {}; }
                                opts.flags = opts.flags || 577;
                                var stream = FS.open(path, opts.flags, opts.mode);
                                if (typeof data == "string") {
                                    var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                                    var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
                                    FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
                                }
                                else if (ArrayBuffer.isView(data)) {
                                    FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
                                }
                                else {
                                    throw new Error("Unsupported data type");
                                }
                                FS.close(stream);
                            }, cwd: function () { return FS.currentPath; }, chdir: function (path) { var lookup = FS.lookupPath(path, { follow: true }); if (lookup.node === null) {
                                throw new FS.ErrnoError(44);
                            } if (!FS.isDir(lookup.node.mode)) {
                                throw new FS.ErrnoError(54);
                            } var errCode = FS.nodePermissions(lookup.node, "x"); if (errCode) {
                                throw new FS.ErrnoError(errCode);
                            } FS.currentPath = lookup.path; }, createDefaultDirectories: function () { FS.mkdir("/tmp"); FS.mkdir("/home"); FS.mkdir("/home/web_user"); }, createDefaultDevices: function () { FS.mkdir("/dev"); FS.registerDevice(FS.makedev(1, 3), { read: function () { return 0; }, write: function (stream, buffer, offset, length, pos) { return length; }, llseek: function () { return 0; } }); FS.mkdev("/dev/null", FS.makedev(1, 3)); TTY.register(FS.makedev(5, 0), TTY.default_tty_ops); TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops); FS.mkdev("/dev/tty", FS.makedev(5, 0)); FS.mkdev("/dev/tty1", FS.makedev(6, 0)); var randomBuffer = new Uint8Array(1024), randomLeft = 0; var randomByte = function () { if (randomLeft === 0) {
                                randomFill(randomBuffer);
                                randomLeft = randomBuffer.byteLength;
                            } return randomBuffer[--randomLeft]; }; FS.createDevice("/dev", "random", randomByte); FS.createDevice("/dev", "urandom", randomByte); FS.mkdir("/dev/shm"); FS.mkdir("/dev/shm/tmp"); }, createSpecialDirectories: function () { FS.mkdir("/proc"); var proc_self = FS.mkdir("/proc/self"); FS.mkdir("/proc/self/fd"); FS.mount({ mount: function () { var node = FS.createNode(proc_self, "fd", 16895, 73); node.stream_ops = { llseek: MEMFS.stream_ops.llseek }; node.node_ops = { lookup: function (parent, name) { var fd = +name; var stream = FS.getStreamChecked(fd); var ret = { parent: null, mount: { mountpoint: "fake" }, node_ops: { readlink: function () { return stream.path; } }, id: fd + 1 }; ret.parent = ret; return ret; }, readdir: function () { return Array.from(FS.streams.entries()).filter(function (_a) {
                                        var k = _a[0], v = _a[1];
                                        return v;
                                    }).map(function (_a) {
                                        var k = _a[0], v = _a[1];
                                        return k.toString();
                                    }); } }; return node; } }, {}, "/proc/self/fd"); }, createStandardStreams: function (input, output, error) { if (input) {
                                FS.createDevice("/dev", "stdin", input);
                            }
                            else {
                                FS.symlink("/dev/tty", "/dev/stdin");
                            } if (output) {
                                FS.createDevice("/dev", "stdout", null, output);
                            }
                            else {
                                FS.symlink("/dev/tty", "/dev/stdout");
                            } if (error) {
                                FS.createDevice("/dev", "stderr", null, error);
                            }
                            else {
                                FS.symlink("/dev/tty1", "/dev/stderr");
                            } var stdin = FS.open("/dev/stdin", 0); var stdout = FS.open("/dev/stdout", 1); var stderr = FS.open("/dev/stderr", 1); }, staticInit: function () { FS.nameTable = new Array(4096); FS.mount(MEMFS, {}, "/"); FS.createDefaultDirectories(); FS.createDefaultDevices(); FS.createSpecialDirectories(); FS.filesystems = { MEMFS: MEMFS }; }, init: function (input, output, error) { FS.initialized = true; input !== null && input !== void 0 ? input : (input = Module["stdin"]); output !== null && output !== void 0 ? output : (output = Module["stdout"]); error !== null && error !== void 0 ? error : (error = Module["stderr"]); FS.createStandardStreams(input, output, error); }, quit: function () { FS.initialized = false; for (var _i = 0, _a = FS.streams; _i < _a.length; _i++) {
                                var stream = _a[_i];
                                if (stream) {
                                    FS.close(stream);
                                }
                            } }, findObject: function (path, dontResolveLastLink) { var ret = FS.analyzePath(path, dontResolveLastLink); if (!ret.exists) {
                                return null;
                            } return ret.object; }, analyzePath: function (path, dontResolveLastLink) { try {
                                var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
                                path = lookup.path;
                            }
                            catch (e) { } var ret = { isRoot: false, exists: false, error: 0, name: null, path: null, object: null, parentExists: false, parentPath: null, parentObject: null }; try {
                                var lookup = FS.lookupPath(path, { parent: true });
                                ret.parentExists = true;
                                ret.parentPath = lookup.path;
                                ret.parentObject = lookup.node;
                                ret.name = PATH.basename(path);
                                lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
                                ret.exists = true;
                                ret.path = lookup.path;
                                ret.object = lookup.node;
                                ret.name = lookup.node.name;
                                ret.isRoot = lookup.path === "/";
                            }
                            catch (e) {
                                ret.error = e.errno;
                            } return ret; }, createPath: function (parent, path, canRead, canWrite) { parent = typeof parent == "string" ? parent : FS.getPath(parent); var parts = path.split("/").reverse(); while (parts.length) {
                                var part = parts.pop();
                                if (!part)
                                    continue;
                                var current = PATH.join2(parent, part);
                                try {
                                    FS.mkdir(current);
                                }
                                catch (e) {
                                    if (e.errno != 20)
                                        throw e;
                                }
                                parent = current;
                            } return current; }, createFile: function (parent, name, properties, canRead, canWrite) { var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name); var mode = FS_getMode(canRead, canWrite); return FS.create(path, mode); }, createDataFile: function (parent, name, data, canRead, canWrite, canOwn) { var path = name; if (parent) {
                                parent = typeof parent == "string" ? parent : FS.getPath(parent);
                                path = name ? PATH.join2(parent, name) : parent;
                            } var mode = FS_getMode(canRead, canWrite); var node = FS.create(path, mode); if (data) {
                                if (typeof data == "string") {
                                    var arr = new Array(data.length);
                                    for (var i = 0, len = data.length; i < len; ++i)
                                        arr[i] = data.charCodeAt(i);
                                    data = arr;
                                }
                                FS.chmod(node, mode | 146);
                                var stream = FS.open(node, 577);
                                FS.write(stream, data, 0, data.length, 0, canOwn);
                                FS.close(stream);
                                FS.chmod(node, mode);
                            } }, createDevice: function (parent, name, input, output) { var _a; var _b; var path = PATH.join2(typeof parent == "string" ? parent : FS.getPath(parent), name); var mode = FS_getMode(!!input, !!output); (_a = (_b = FS.createDevice).major) !== null && _a !== void 0 ? _a : (_b.major = 64); var dev = FS.makedev(FS.createDevice.major++, 0); FS.registerDevice(dev, { open: function (stream) { stream.seekable = false; }, close: function (stream) { var _a; if ((_a = output === null || output === void 0 ? void 0 : output.buffer) === null || _a === void 0 ? void 0 : _a.length) {
                                    output(10);
                                } }, read: function (stream, buffer, offset, length, pos) { var bytesRead = 0; for (var i = 0; i < length; i++) {
                                    var result;
                                    try {
                                        result = input();
                                    }
                                    catch (e) {
                                        throw new FS.ErrnoError(29);
                                    }
                                    if (result === undefined && bytesRead === 0) {
                                        throw new FS.ErrnoError(6);
                                    }
                                    if (result === null || result === undefined)
                                        break;
                                    bytesRead++;
                                    buffer[offset + i] = result;
                                } if (bytesRead) {
                                    stream.node.atime = Date.now();
                                } return bytesRead; }, write: function (stream, buffer, offset, length, pos) { for (var i = 0; i < length; i++) {
                                    try {
                                        output(buffer[offset + i]);
                                    }
                                    catch (e) {
                                        throw new FS.ErrnoError(29);
                                    }
                                } if (length) {
                                    stream.node.mtime = stream.node.ctime = Date.now();
                                } return i; } }); return FS.mkdev(path, mode, dev); }, forceLoadFile: function (obj) { if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
                                return true; if (typeof XMLHttpRequest != "undefined") {
                                throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
                            }
                            else {
                                try {
                                    obj.contents = readBinary(obj.url);
                                    obj.usedBytes = obj.contents.length;
                                }
                                catch (e) {
                                    throw new FS.ErrnoError(29);
                                }
                            } }, createLazyFile: function (parent, name, url, canRead, canWrite) { var LazyUint8Array = /** @class */ (function () {
                                function LazyUint8Array() {
                                    this.lengthKnown = false;
                                    this.chunks = [];
                                }
                                LazyUint8Array.prototype.get = function (idx) { if (idx > this.length - 1 || idx < 0) {
                                    return undefined;
                                } var chunkOffset = idx % this.chunkSize; var chunkNum = idx / this.chunkSize | 0; return this.getter(chunkNum)[chunkOffset]; };
                                LazyUint8Array.prototype.setDataGetter = function (getter) { this.getter = getter; };
                                LazyUint8Array.prototype.cacheLength = function () { var xhr = new XMLHttpRequest; xhr.open("HEAD", url, false); xhr.send(null); if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                                    throw new Error("Couldn't load " + url + ". Status: " + xhr.status); var datalength = Number(xhr.getResponseHeader("Content-length")); var header; var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes"; var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip"; var chunkSize = 1024 * 1024; if (!hasByteServing)
                                    chunkSize = datalength; var doXHR = function (from, to) { if (from > to)
                                    throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!"); if (to > datalength - 1)
                                    throw new Error("only " + datalength + " bytes available! programmer error!"); var xhr = new XMLHttpRequest; xhr.open("GET", url, false); if (datalength !== chunkSize)
                                    xhr.setRequestHeader("Range", "bytes=" + from + "-" + to); xhr.responseType = "arraybuffer"; if (xhr.overrideMimeType) {
                                    xhr.overrideMimeType("text/plain; charset=x-user-defined");
                                } xhr.send(null); if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                                    throw new Error("Couldn't load " + url + ". Status: " + xhr.status); if (xhr.response !== undefined) {
                                    return new Uint8Array(xhr.response || []);
                                } return intArrayFromString(xhr.responseText || "", true); }; var lazyArray = this; lazyArray.setDataGetter(function (chunkNum) { var start = chunkNum * chunkSize; var end = (chunkNum + 1) * chunkSize - 1; end = Math.min(end, datalength - 1); if (typeof lazyArray.chunks[chunkNum] == "undefined") {
                                    lazyArray.chunks[chunkNum] = doXHR(start, end);
                                } if (typeof lazyArray.chunks[chunkNum] == "undefined")
                                    throw new Error("doXHR failed!"); return lazyArray.chunks[chunkNum]; }); if (usesGzip || !datalength) {
                                    chunkSize = datalength = 1;
                                    datalength = this.getter(0).length;
                                    chunkSize = datalength;
                                    out("LazyFiles on gzip forces download of the whole file when length is accessed");
                                } this._length = datalength; this._chunkSize = chunkSize; this.lengthKnown = true; };
                                Object.defineProperty(LazyUint8Array.prototype, "length", {
                                    get: function () { if (!this.lengthKnown) {
                                        this.cacheLength();
                                    } return this._length; },
                                    enumerable: false,
                                    configurable: true
                                });
                                Object.defineProperty(LazyUint8Array.prototype, "chunkSize", {
                                    get: function () { if (!this.lengthKnown) {
                                        this.cacheLength();
                                    } return this._chunkSize; },
                                    enumerable: false,
                                    configurable: true
                                });
                                return LazyUint8Array;
                            }()); if (typeof XMLHttpRequest != "undefined") {
                                if (!ENVIRONMENT_IS_WORKER)
                                    throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                                var lazyArray = new LazyUint8Array;
                                var properties = { isDevice: false, contents: lazyArray };
                            }
                            else {
                                var properties = { isDevice: false, url: url };
                            } var node = FS.createFile(parent, name, properties, canRead, canWrite); if (properties.contents) {
                                node.contents = properties.contents;
                            }
                            else if (properties.url) {
                                node.contents = null;
                                node.url = properties.url;
                            } Object.defineProperties(node, { usedBytes: { get: function () { return this.contents.length; } } }); var stream_ops = {}; var keys = Object.keys(node.stream_ops); keys.forEach(function (key) { var fn = node.stream_ops[key]; stream_ops[key] = function () {
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i] = arguments[_i];
                                }
                                FS.forceLoadFile(node);
                                return fn.apply(void 0, args);
                            }; }); function writeChunks(stream, buffer, offset, length, position) { var contents = stream.node.contents; if (position >= contents.length)
                                return 0; var size = Math.min(contents.length - position, length); if (contents.slice) {
                                for (var i = 0; i < size; i++) {
                                    buffer[offset + i] = contents[position + i];
                                }
                            }
                            else {
                                for (var i = 0; i < size; i++) {
                                    buffer[offset + i] = contents.get(position + i);
                                }
                            } return size; } stream_ops.read = function (stream, buffer, offset, length, position) { FS.forceLoadFile(node); return writeChunks(stream, buffer, offset, length, position); }; stream_ops.mmap = function (stream, length, position, prot, flags) { FS.forceLoadFile(node); var ptr = mmapAlloc(length); if (!ptr) {
                                throw new FS.ErrnoError(48);
                            } writeChunks(stream, HEAP8, ptr, length, position); return { ptr: ptr, allocated: true }; }; node.stream_ops = stream_ops; return node; } };
                        UTF8ToString = function (ptr, maxBytesToRead) { return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""; };
                        SYSCALLS = { DEFAULT_POLLMASK: 5, calculateAt: function (dirfd, path, allowEmpty) { if (PATH.isAbs(path)) {
                                return path;
                            } var dir; if (dirfd === -100) {
                                dir = FS.cwd();
                            }
                            else {
                                var dirstream = SYSCALLS.getStreamFromFD(dirfd);
                                dir = dirstream.path;
                            } if (path.length == 0) {
                                if (!allowEmpty) {
                                    throw new FS.ErrnoError(44);
                                }
                                return dir;
                            } return dir + "/" + path; }, writeStat: function (buf, stat) { HEAP32[buf >> 2] = stat.dev; HEAP32[buf + 4 >> 2] = stat.mode; HEAPU32[buf + 8 >> 2] = stat.nlink; HEAP32[buf + 12 >> 2] = stat.uid; HEAP32[buf + 16 >> 2] = stat.gid; HEAP32[buf + 20 >> 2] = stat.rdev; tempI64 = [stat.size >>> 0, (tempDouble = stat.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 24 >> 2] = tempI64[0], HEAP32[buf + 28 >> 2] = tempI64[1]; HEAP32[buf + 32 >> 2] = 4096; HEAP32[buf + 36 >> 2] = stat.blocks; var atime = stat.atime.getTime(); var mtime = stat.mtime.getTime(); var ctime = stat.ctime.getTime(); tempI64 = [Math.floor(atime / 1e3) >>> 0, (tempDouble = Math.floor(atime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 40 >> 2] = tempI64[0], HEAP32[buf + 44 >> 2] = tempI64[1]; HEAPU32[buf + 48 >> 2] = atime % 1e3 * 1e3 * 1e3; tempI64 = [Math.floor(mtime / 1e3) >>> 0, (tempDouble = Math.floor(mtime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 56 >> 2] = tempI64[0], HEAP32[buf + 60 >> 2] = tempI64[1]; HEAPU32[buf + 64 >> 2] = mtime % 1e3 * 1e3 * 1e3; tempI64 = [Math.floor(ctime / 1e3) >>> 0, (tempDouble = Math.floor(ctime / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 72 >> 2] = tempI64[0], HEAP32[buf + 76 >> 2] = tempI64[1]; HEAPU32[buf + 80 >> 2] = ctime % 1e3 * 1e3 * 1e3; tempI64 = [stat.ino >>> 0, (tempDouble = stat.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[buf + 88 >> 2] = tempI64[0], HEAP32[buf + 92 >> 2] = tempI64[1]; return 0; }, writeStatFs: function (buf, stats) { HEAP32[buf + 4 >> 2] = stats.bsize; HEAP32[buf + 40 >> 2] = stats.bsize; HEAP32[buf + 8 >> 2] = stats.blocks; HEAP32[buf + 12 >> 2] = stats.bfree; HEAP32[buf + 16 >> 2] = stats.bavail; HEAP32[buf + 20 >> 2] = stats.files; HEAP32[buf + 24 >> 2] = stats.ffree; HEAP32[buf + 28 >> 2] = stats.fsid; HEAP32[buf + 44 >> 2] = stats.flags; HEAP32[buf + 36 >> 2] = stats.namelen; }, doMsync: function (addr, stream, len, flags, offset) { if (!FS.isFile(stream.node.mode)) {
                                throw new FS.ErrnoError(43);
                            } if (flags & 2) {
                                return 0;
                            } var buffer = HEAPU8.slice(addr, addr + len); FS.msync(stream, buffer, offset, len, flags); }, getStreamFromFD: function (fd) { var stream = FS.getStreamChecked(fd); return stream; }, varargs: undefined, getStr: function (ptr) { var ret = UTF8ToString(ptr); return ret; } };
                        syscallGetVarargI = function () { var ret = HEAP32[+SYSCALLS.varargs >> 2]; SYSCALLS.varargs += 4; return ret; };
                        syscallGetVarargP = syscallGetVarargI;
                        PIPEFS = { BUCKET_BUFFER_SIZE: 8192, mount: function (mount) { return FS.createNode(null, "/", 16384 | 511, 0); }, createPipe: function () { var pipe = { buckets: [], refcnt: 2, timestamp: new Date }; pipe.buckets.push({ buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: 0, roffset: 0 }); var rName = PIPEFS.nextname(); var wName = PIPEFS.nextname(); var rNode = FS.createNode(PIPEFS.root, rName, 4096, 0); var wNode = FS.createNode(PIPEFS.root, wName, 4096, 0); rNode.pipe = pipe; wNode.pipe = pipe; var readableStream = FS.createStream({ path: rName, node: rNode, flags: 0, seekable: false, stream_ops: PIPEFS.stream_ops }); rNode.stream = readableStream; var writableStream = FS.createStream({ path: wName, node: wNode, flags: 1, seekable: false, stream_ops: PIPEFS.stream_ops }); wNode.stream = writableStream; return { readable_fd: readableStream.fd, writable_fd: writableStream.fd }; }, stream_ops: { getattr: function (stream) { var node = stream.node; var timestamp = node.pipe.timestamp; return { dev: 14, ino: node.id, mode: 4480, nlink: 1, uid: 0, gid: 0, rdev: 0, size: 0, atime: timestamp, mtime: timestamp, ctime: timestamp, blksize: 4096, blocks: 0 }; }, poll: function (stream) { var pipe = stream.node.pipe; if ((stream.flags & 2097155) === 1) {
                                    return 256 | 4;
                                } for (var _i = 0, _a = pipe.buckets; _i < _a.length; _i++) {
                                    var bucket = _a[_i];
                                    if (bucket.offset - bucket.roffset > 0) {
                                        return 64 | 1;
                                    }
                                } return 0; }, dup: function (stream) { stream.node.pipe.refcnt++; }, ioctl: function (stream, request, varargs) { return 28; }, fsync: function (stream) { return 28; }, read: function (stream, buffer, offset, length, position) { var pipe = stream.node.pipe; var currentLength = 0; for (var _i = 0, _a = pipe.buckets; _i < _a.length; _i++) {
                                    var bucket = _a[_i];
                                    currentLength += bucket.offset - bucket.roffset;
                                } var data = buffer.subarray(offset, offset + length); if (length <= 0) {
                                    return 0;
                                } if (currentLength == 0) {
                                    throw new FS.ErrnoError(6);
                                } var toRead = Math.min(currentLength, length); var totalRead = toRead; var toRemove = 0; for (var _b = 0, _c = pipe.buckets; _b < _c.length; _b++) {
                                    var bucket = _c[_b];
                                    var bucketSize = bucket.offset - bucket.roffset;
                                    if (toRead <= bucketSize) {
                                        var tmpSlice = bucket.buffer.subarray(bucket.roffset, bucket.offset);
                                        if (toRead < bucketSize) {
                                            tmpSlice = tmpSlice.subarray(0, toRead);
                                            bucket.roffset += toRead;
                                        }
                                        else {
                                            toRemove++;
                                        }
                                        data.set(tmpSlice);
                                        break;
                                    }
                                    else {
                                        var tmpSlice = bucket.buffer.subarray(bucket.roffset, bucket.offset);
                                        data.set(tmpSlice);
                                        data = data.subarray(tmpSlice.byteLength);
                                        toRead -= tmpSlice.byteLength;
                                        toRemove++;
                                    }
                                } if (toRemove && toRemove == pipe.buckets.length) {
                                    toRemove--;
                                    pipe.buckets[toRemove].offset = 0;
                                    pipe.buckets[toRemove].roffset = 0;
                                } pipe.buckets.splice(0, toRemove); return totalRead; }, write: function (stream, buffer, offset, length, position) { var pipe = stream.node.pipe; var data = buffer.subarray(offset, offset + length); var dataLen = data.byteLength; if (dataLen <= 0) {
                                    return 0;
                                } var currBucket = null; if (pipe.buckets.length == 0) {
                                    currBucket = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: 0, roffset: 0 };
                                    pipe.buckets.push(currBucket);
                                }
                                else {
                                    currBucket = pipe.buckets[pipe.buckets.length - 1];
                                } assert(currBucket.offset <= PIPEFS.BUCKET_BUFFER_SIZE); var freeBytesInCurrBuffer = PIPEFS.BUCKET_BUFFER_SIZE - currBucket.offset; if (freeBytesInCurrBuffer >= dataLen) {
                                    currBucket.buffer.set(data, currBucket.offset);
                                    currBucket.offset += dataLen;
                                    return dataLen;
                                }
                                else if (freeBytesInCurrBuffer > 0) {
                                    currBucket.buffer.set(data.subarray(0, freeBytesInCurrBuffer), currBucket.offset);
                                    currBucket.offset += freeBytesInCurrBuffer;
                                    data = data.subarray(freeBytesInCurrBuffer, data.byteLength);
                                } var numBuckets = data.byteLength / PIPEFS.BUCKET_BUFFER_SIZE | 0; var remElements = data.byteLength % PIPEFS.BUCKET_BUFFER_SIZE; for (var i = 0; i < numBuckets; i++) {
                                    var newBucket = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: PIPEFS.BUCKET_BUFFER_SIZE, roffset: 0 };
                                    pipe.buckets.push(newBucket);
                                    newBucket.buffer.set(data.subarray(0, PIPEFS.BUCKET_BUFFER_SIZE));
                                    data = data.subarray(PIPEFS.BUCKET_BUFFER_SIZE, data.byteLength);
                                } if (remElements > 0) {
                                    var newBucket = { buffer: new Uint8Array(PIPEFS.BUCKET_BUFFER_SIZE), offset: data.byteLength, roffset: 0 };
                                    pipe.buckets.push(newBucket);
                                    newBucket.buffer.set(data);
                                } return dataLen; }, close: function (stream) { var pipe = stream.node.pipe; pipe.refcnt--; if (pipe.refcnt === 0) {
                                    pipe.buckets = null;
                                } } }, nextname: function () { if (!PIPEFS.nextname.current) {
                                PIPEFS.nextname.current = 0;
                            } return "pipe[" + PIPEFS.nextname.current++ + "]"; } };
                        __abort_js = function () { return abort(""); };
                        isLeapYear = function (year) { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); };
                        MONTH_DAYS_LEAP_CUMULATIVE = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
                        MONTH_DAYS_REGULAR_CUMULATIVE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
                        ydayFromDate = function (date) { var leap = isLeapYear(date.getFullYear()); var monthDaysCumulative = leap ? MONTH_DAYS_LEAP_CUMULATIVE : MONTH_DAYS_REGULAR_CUMULATIVE; var yday = monthDaysCumulative[date.getMonth()] + date.getDate() - 1; return yday; };
                        convertI32PairToI53Checked = function (lo, hi) { return hi + 2097152 >>> 0 < 4194305 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN; };
                        setTempRet0 = function (val) { return __emscripten_tempret_set(val); };
                        __mktime_js = function (tmPtr) { var ret = (function () { var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0); var dst = HEAP32[tmPtr + 32 >> 2]; var guessedOffset = date.getTimezoneOffset(); var start = new Date(date.getFullYear(), 0, 1); var summerOffset = new Date(date.getFullYear(), 6, 1).getTimezoneOffset(); var winterOffset = start.getTimezoneOffset(); var dstOffset = Math.min(winterOffset, summerOffset); if (dst < 0) {
                            HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset);
                        }
                        else if (dst > 0 != (dstOffset == guessedOffset)) {
                            var nonDstOffset = Math.max(winterOffset, summerOffset);
                            var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
                            date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4);
                        } HEAP32[tmPtr + 24 >> 2] = date.getDay(); var yday = ydayFromDate(date) | 0; HEAP32[tmPtr + 28 >> 2] = yday; HEAP32[tmPtr >> 2] = date.getSeconds(); HEAP32[tmPtr + 4 >> 2] = date.getMinutes(); HEAP32[tmPtr + 8 >> 2] = date.getHours(); HEAP32[tmPtr + 12 >> 2] = date.getDate(); HEAP32[tmPtr + 16 >> 2] = date.getMonth(); HEAP32[tmPtr + 20 >> 2] = date.getYear(); var timeMs = date.getTime(); if (isNaN(timeMs)) {
                            return -1;
                        } return timeMs / 1e3; })(); return setTempRet0((tempDouble = ret, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)), ret >>> 0; };
                        __timegm_js = function (tmPtr) { var ret = (function () { var time = Date.UTC(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0); var date = new Date(time); HEAP32[tmPtr + 24 >> 2] = date.getUTCDay(); var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0); var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0; HEAP32[tmPtr + 28 >> 2] = yday; return date.getTime() / 1e3; })(); return setTempRet0((tempDouble = ret, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? +Math.floor(tempDouble / 4294967296) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)), ret >>> 0; };
                        stringToUTF8 = function (str, outPtr, maxBytesToWrite) { return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite); };
                        __tzset_js = function (timezone, daylight, std_name, dst_name) { var currentYear = (new Date).getFullYear(); var winter = new Date(currentYear, 0, 1); var summer = new Date(currentYear, 6, 1); var winterOffset = winter.getTimezoneOffset(); var summerOffset = summer.getTimezoneOffset(); var stdTimezoneOffset = Math.max(winterOffset, summerOffset); HEAPU32[timezone >> 2] = stdTimezoneOffset * 60; HEAP32[daylight >> 2] = Number(winterOffset != summerOffset); var extractZone = function (timezoneOffset) { var sign = timezoneOffset >= 0 ? "-" : "+"; var absOffset = Math.abs(timezoneOffset); var hours = String(Math.floor(absOffset / 60)).padStart(2, "0"); var minutes = String(absOffset % 60).padStart(2, "0"); return "UTC".concat(sign).concat(hours).concat(minutes); }; var winterName = extractZone(winterOffset); var summerName = extractZone(summerOffset); if (summerOffset < winterOffset) {
                            stringToUTF8(winterName, std_name, 17);
                            stringToUTF8(summerName, dst_name, 17);
                        }
                        else {
                            stringToUTF8(winterName, dst_name, 17);
                            stringToUTF8(summerName, std_name, 17);
                        } };
                        getHeapMax = function () { return 2147483648; };
                        growMemory = function (size) { var b = wasmMemory.buffer; var pages = (size - b.byteLength + 65535) / 65536 | 0; try {
                            wasmMemory.grow(pages);
                            updateMemoryViews();
                            return 1;
                        }
                        catch (e) { } };
                        _emscripten_resize_heap = function (requestedSize) { var oldSize = HEAPU8.length; requestedSize >>>= 0; var maxHeapSize = getHeapMax(); if (requestedSize > maxHeapSize) {
                            return false;
                        } for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                            var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
                            overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
                            var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
                            var replacement = growMemory(newSize);
                            if (replacement) {
                                return true;
                            }
                        } return false; };
                        ENV = {};
                        getExecutableName = function () { return thisProgram || "./this.program"; };
                        getEnvStrings = function () { if (!getEnvStrings.strings) {
                            var lang = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
                            var env = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: lang, _: getExecutableName() };
                            for (var x in ENV) {
                                if (ENV[x] === undefined)
                                    delete env[x];
                                else
                                    env[x] = ENV[x];
                            }
                            var strings = [];
                            for (var x in env) {
                                strings.push("".concat(x, "=").concat(env[x]));
                            }
                            getEnvStrings.strings = strings;
                        } return getEnvStrings.strings; };
                        stringToAscii = function (str, buffer) { for (var i = 0; i < str.length; ++i) {
                            HEAP8[buffer++] = str.charCodeAt(i);
                        } HEAP8[buffer] = 0; };
                        _environ_get = function (__environ, environ_buf) { var bufSize = 0; getEnvStrings().forEach(function (string, i) { var ptr = environ_buf + bufSize; HEAPU32[__environ + i * 4 >> 2] = ptr; stringToAscii(string, ptr); bufSize += string.length + 1; }); return 0; };
                        _environ_sizes_get = function (penviron_count, penviron_buf_size) { var strings = getEnvStrings(); HEAPU32[penviron_count >> 2] = strings.length; var bufSize = 0; strings.forEach(function (string) { return bufSize += string.length + 1; }); HEAPU32[penviron_buf_size >> 2] = bufSize; return 0; };
                        runtimeKeepaliveCounter = 0;
                        keepRuntimeAlive = function () { return noExitRuntime || runtimeKeepaliveCounter > 0; };
                        _proc_exit = function (code) { var _a; EXITSTATUS = code; if (!keepRuntimeAlive()) {
                            (_a = Module["onExit"]) === null || _a === void 0 ? void 0 : _a.call(Module, code);
                            ABORT = true;
                        } quit_(code, new ExitStatus(code)); };
                        exitJS = function (status, implicit) { EXITSTATUS = status; _proc_exit(status); };
                        _exit = exitJS;
                        doReadv = function (stream, iov, iovcnt, offset) { var ret = 0; for (var i = 0; i < iovcnt; i++) {
                            var ptr = HEAPU32[iov >> 2];
                            var len = HEAPU32[iov + 4 >> 2];
                            iov += 8;
                            var curr = FS.read(stream, HEAP8, ptr, len, offset);
                            if (curr < 0)
                                return -1;
                            ret += curr;
                            if (curr < len)
                                break;
                            if (typeof offset != "undefined") {
                                offset += curr;
                            }
                        } return ret; };
                        doWritev = function (stream, iov, iovcnt, offset) { var ret = 0; for (var i = 0; i < iovcnt; i++) {
                            var ptr = HEAPU32[iov >> 2];
                            var len = HEAPU32[iov + 4 >> 2];
                            iov += 8;
                            var curr = FS.write(stream, HEAP8, ptr, len, offset);
                            if (curr < 0)
                                return -1;
                            ret += curr;
                            if (curr < len) {
                                break;
                            }
                            if (typeof offset != "undefined") {
                                offset += curr;
                            }
                        } return ret; };
                        getCFunc = function (ident) { var func = Module["_" + ident]; return func; };
                        writeArrayToMemory = function (array, buffer) { HEAP8.set(array, buffer); };
                        stackAlloc = function (sz) { return __emscripten_stack_alloc(sz); };
                        stringToUTF8OnStack = function (str) { var size = lengthBytesUTF8(str) + 1; var ret = stackAlloc(size); stringToUTF8(str, ret, size); return ret; };
                        ccall = function (ident, returnType, argTypes, args, opts) { var toC = { string: function (str) { var ret = 0; if (str !== null && str !== undefined && str !== 0) {
                                ret = stringToUTF8OnStack(str);
                            } return ret; }, array: function (arr) { var ret = stackAlloc(arr.length); writeArrayToMemory(arr, ret); return ret; } }; function convertReturnValue(ret) { if (returnType === "string") {
                            return UTF8ToString(ret);
                        } if (returnType === "boolean")
                            return Boolean(ret); return ret; } var func = getCFunc(ident); var cArgs = []; var stack = 0; if (args) {
                            for (var i = 0; i < args.length; i++) {
                                var converter = toC[argTypes[i]];
                                if (converter) {
                                    if (stack === 0)
                                        stack = stackSave();
                                    cArgs[i] = converter(args[i]);
                                }
                                else {
                                    cArgs[i] = args[i];
                                }
                            }
                        } var ret = func.apply(void 0, cArgs); function onDone(ret) { if (stack !== 0)
                            stackRestore(stack); return convertReturnValue(ret); } ret = onDone(ret); return ret; };
                        cwrap = function (ident, returnType, argTypes, opts) { var numericArgs = !argTypes || argTypes.every(function (type) { return type === "number" || type === "boolean"; }); var numericRet = returnType !== "string"; if (numericRet && numericArgs && !opts) {
                            return getCFunc(ident);
                        } return function () {
                            var args = [];
                            for (var _i = 0; _i < arguments.length; _i++) {
                                args[_i] = arguments[_i];
                            }
                            return ccall(ident, returnType, argTypes, args, opts);
                        }; };
                        FS.createPreloadedFile = FS_createPreloadedFile;
                        FS.staticInit();
                        MEMFS.doesNotExistError = new FS.ErrnoError(44);
                        MEMFS.doesNotExistError.stack = "<generic error, no stack>";
                        wasmImports = { h: ___syscall_dup, a: ___syscall_fcntl64, v: ___syscall_fstat64, s: ___syscall_lstat64, t: ___syscall_newfstatat, e: ___syscall_openat, q: ___syscall_pipe, p: ___syscall_poll, u: ___syscall_stat64, i: __abort_js, k: __localtime_js, l: __mktime_js, m: __timegm_js, r: __tzset_js, o: _emscripten_resize_heap, f: _environ_get, g: _environ_sizes_get, d: _exit, c: _fd_close, j: _fd_read, n: _fd_seek, b: _fd_write };
                        return [4 /*yield*/, createWasm()];
                    case 1:
                        wasmExports = _a.sent();
                        ___wasm_call_ctors = wasmExports["x"];
                        _archive_read_new_memory = Module["_archive_read_new_memory"] = wasmExports["y"];
                        _archive_read_new = Module["_archive_read_new"] = wasmExports["z"];
                        _archive_read_support_filter_all = Module["_archive_read_support_filter_all"] = wasmExports["A"];
                        _archive_read_support_format_all = Module["_archive_read_support_format_all"] = wasmExports["B"];
                        _archive_read_add_passphrase = Module["_archive_read_add_passphrase"] = wasmExports["C"];
                        _archive_read_open_memory = Module["_archive_read_open_memory"] = wasmExports["D"];
                        _archive_read_next_entry = Module["_archive_read_next_entry"] = wasmExports["E"];
                        _archive_entry_atime = Module["_archive_entry_atime"] = wasmExports["G"];
                        _archive_entry_birthtime = Module["_archive_entry_birthtime"] = wasmExports["H"];
                        _archive_entry_ctime = Module["_archive_entry_ctime"] = wasmExports["I"];
                        _archive_entry_filetype = Module["_archive_entry_filetype"] = wasmExports["J"];
                        _archive_entry_hardlink_utf8 = Module["_archive_entry_hardlink_utf8"] = wasmExports["K"];
                        _archive_entry_mtime = Module["_archive_entry_mtime"] = wasmExports["L"];
                        _archive_entry_pathname_utf8 = Module["_archive_entry_pathname_utf8"] = wasmExports["M"];
                        _archive_entry_size = Module["_archive_entry_size"] = wasmExports["N"];
                        _archive_entry_symlink_utf8 = Module["_archive_entry_symlink_utf8"] = wasmExports["O"];
                        _archive_entry_is_encrypted = Module["_archive_entry_is_encrypted"] = wasmExports["P"];
                        _free = Module["_free"] = wasmExports["Q"];
                        _malloc = Module["_malloc"] = wasmExports["R"];
                        _archive_read_has_encrypted_entries = Module["_archive_read_has_encrypted_entries"] = wasmExports["S"];
                        _archive_read_data = Module["_archive_read_data"] = wasmExports["T"];
                        _archive_read_data_skip = Module["_archive_read_data_skip"] = wasmExports["U"];
                        _archive_version_number = Module["_archive_version_number"] = wasmExports["V"];
                        _archive_version_string = Module["_archive_version_string"] = wasmExports["W"];
                        _archive_error_string = Module["_archive_error_string"] = wasmExports["X"];
                        _archive_version_details = Module["_archive_version_details"] = wasmExports["Y"];
                        _archive_read_free = Module["_archive_read_free"] = wasmExports["Z"];
                        __emscripten_tempret_set = wasmExports["_"];
                        __emscripten_stack_restore = wasmExports["$"];
                        __emscripten_stack_alloc = wasmExports["aa"];
                        _emscripten_stack_get_current = wasmExports["ba"];
                        Module["cwrap"] = cwrap;
                        if (Module["preInit"]) {
                            if (typeof Module["preInit"] == "function")
                                Module["preInit"] = [Module["preInit"]];
                            while (Module["preInit"].length > 0) {
                                Module["preInit"].pop()();
                            }
                        }
                        run();
                        moduleRtn = readyPromise;
                        return [2 /*return*/, moduleRtn];
                }
            });
        });
    });
})();
if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = libarchive;
    // This default export looks redundant, but it allows TS to import this
    // commonjs style module.
    module.exports.default = libarchive;
}
else if (typeof define === 'function' && define['amd'])
    define([], function () { return libarchive; });
