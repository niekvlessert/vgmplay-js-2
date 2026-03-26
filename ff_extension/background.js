chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: togglePlayer,
        args: [chrome.runtime.getURL('')]
    });
});

function togglePlayer(extensionUrl) {
  // Guard for service worker context where window doesn't exist
  if (typeof window === 'undefined') return;
  if (window.__VGM_DEBUG__) console.log('[VGM Extension] togglePlayer called, extensionUrl:', extensionUrl);
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
        bottom: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        width: 0 !important;
        height: 0 !important;
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
            top: 20px !important;
            left: 20px !important;
            width: 350px !important;
            height: 80vh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
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
        bottom: 0 !important;
        right: 0 !important;
        width: 320px !important;
        height: auto !important;
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
  if (window.__VGM_DEBUG__) console.log('[VGM] VGMPLAY_EXTENSION_OPTIONS set, loading glue script');
  // Load the glue script
  const script = document.createElement('script');
  script.src = extensionUrl + 'vgmplay-js-glue.js';
  script.onload = () => {
    if (window.__VGM_DEBUG__) console.log('[VGM] Glue script loaded successfully');
  };
  script.onerror = (e) => {
    if (window.__VGM_DEBUG__) console.error('[VGM] Failed to load glue script:', e);
  };
    document.head.appendChild(script);
}
