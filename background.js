chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'ISOLATED',
        func: togglePlayer,
        args: [chrome.runtime.getURL('')]
    }).then((results) => {
        const injected = results && results[0] && results[0].result && results[0].result.injected;
        if (!injected) {
            // ensure debug bridge exists even when toggling
            return chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: installDebugBridge
            });
        }
        return chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            files: [
                'vgmplay-js.js',
                'minizip-asm.min.js',
                '7zz.umd.js',
                'vgmplay-js-glue.js'
            ]
        }).then(() => {
            return chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: installDebugBridge
            });
        });
    }).catch(() => { });
});

function installDebugBridge() {
    if (window.__VGM_DEBUG_SNAPSHOT__) return;
    window.__VGM_DEBUG_SNAPSHOT__ = () => new Promise((resolve) => {
        const id = Date.now() + Math.random();
        const handler = (e) => {
            if (e.source !== window) return;
            const data = e.data || {};
            if (data.type !== 'VGM_DEBUG_SNAPSHOT_RESPONSE' || data.id !== id) return;
            window.removeEventListener('message', handler);
            resolve(data.payload);
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'VGM_DEBUG_SNAPSHOT_REQUEST', id }, '*');
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ error: 'timeout' });
        }, 2000);
    });
}

function togglePlayer(extensionUrl) {
    console.log('[VGM Extension] togglePlayer called, extensionUrl:', extensionUrl);
    if (window.vgmPlayerInjected) {
        const container = document.getElementById('vgmplay-extension-root');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
        return { injected: false };
    }

    window.vgmPlayerInjected = true;

    // Create a root element for our Shadow DOM
    const root = document.createElement('div');
    root.id = 'vgmplay-extension-root';
    // Use all:initial and minimal footprint to avoid shifting page layout
    root.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 10px !important;
        left: 10px !important;
        z-index: 2147483647 !important;
        width: 350px !important;
        height: calc(100vh - 20px) !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: visible !important;
        display: block !important;
        pointer-events: auto !important;
    `;
    document.documentElement.appendChild(root);

    const shadow = root.attachShadow({ mode: 'open' });

    // Initialize Module in the isolated world before loading core scripts
    window.__VGM_RUNTIME_READY__ = false;
    window.Module = window.Module || {};
    if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
    if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;
    const base = extensionUrl;
    window.Module.print = (text) => { console.log(text); };
    window.Module.printErr = (text) => { console.error(text); };
    window.Module.locateFile = function (path, prefix) {
        if (path.endsWith(".data") || path.endsWith(".wasm")) return base + path;
        return prefix + path;
    };
    window.Module.onRuntimeInitialized = function () {
        window.__VGM_RUNTIME_READY__ = true;
        if (window.vgmplay_js && window.vgmplay_js.loadWhenReady) {
            window.vgmplay_js.loadWhenReady();
        }
    };

    // Add styles - inject directly into Shadow DOM for proper scoping
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = extensionUrl + 'css/style.css';
    shadow.appendChild(styleLink);

    // Add extension-specific overrides
    const style = document.createElement('style');
    style.textContent = `
        .vgmplayContainer {
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            width: 350px !important;
            bottom: 10px !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: visible !important;
        }
        .vgmplayTitleWindow {
            display: flex !important;
            flex-shrink: 0 !important;
        }
        .vgmplayPlayerWindow {
            display: block !important;
            flex-shrink: 0 !important;
        }
        .vgmplayStandaloneGameGrid {
            display: grid !important;
            flex: 1 !important;
            overflow-y: auto !important;
        }
        #vgmplayTracksContainer {
            display: flex !important;
            flex: 1 !important;
            overflow-y: auto !important;
        }
    `;
    shadow.appendChild(style);

    // Container for the player
    const container = document.createElement('div');
    container.id = 'vgmplay-container';
    // Set container styles to ensure visibility and interactivity
    container.style.cssText = `
        all: initial !important;
        display: block !important;
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        min-height: 200px !important;
        pointer-events: auto !important;
        overflow: visible !important;
        z-index: 1 !important;
    `;
    shadow.appendChild(container);

    // Set options for the auto-init BEFORE loading the glue script
    window.VGMPLAY_EXTENSION_OPTIONS = {
        container: container,
        shadowRoot: shadow,
        baseURL: extensionUrl,
        extensionContentScript: true
    };
    console.log('[VGM] VGMPLAY_EXTENSION_OPTIONS set for content script mode');
    return { injected: true };
}
