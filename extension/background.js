chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: togglePlayer,
        args: [chrome.runtime.getURL('')]
    });
});

function togglePlayer(extensionUrl) {
    console.log('[VGM Extension] togglePlayer called, extensionUrl:', extensionUrl);
    if (window.vgmPlayerInjected) {
        const container = document.getElementById('vgmplay-extension-root');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
        return;
    }

    window.vgmPlayerInjected = true;

    // Create a root element for our Shadow DOM
    const root = document.createElement('div');
    root.id = 'vgmplay-extension-root';
    // Use all:initial and minimal footprint to avoid shifting page layout
    root.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        left: 0 !important;
        z-index: 2147483647 !important;
        width: 100vw !important;
        height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        overflow: visible !important;
        display: block !important;
        pointer-events: none !important;
    `;
    document.documentElement.appendChild(root);

    const shadow = root.attachShadow({ mode: 'open' });

    // Initialize Module directly in the Main World
    window.Module = window.Module || {};
    if (!window.Module.dataFileDownloads) window.Module.dataFileDownloads = {};
    if (!window.Module.expectedDataFileDownloads) window.Module.expectedDataFileDownloads = 0;

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
        position: fixed !important;
        top: 10px !important;
        left: 10px !important;
        bottom: 10px !important;
        width: 350px !important;
        height: auto !important;
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
        baseURL: extensionUrl
    };
    console.log('[VGM] VGMPLAY_EXTENSION_OPTIONS set, loading glue script');
    // Load the glue script
    const script = document.createElement('script');
    script.src = extensionUrl + 'vgmplay-js-glue.js';
    script.onload = () => {
        console.log('[VGM] Glue script loaded successfully');
    };
    script.onerror = (e) => {
        console.error('[VGM] Failed to load glue script:', e);
    };
    document.head.appendChild(script);
}
