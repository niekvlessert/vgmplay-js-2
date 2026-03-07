chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: togglePlayer,
        args: [chrome.runtime.getURL('')]
    });
});

function togglePlayer(extensionUrl) {
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

    // Add styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = extensionUrl + 'css/style.css';
    shadow.appendChild(styleLink);

    // Container for the player
    const container = document.createElement('div');
    container.id = 'vgmplay-container';
    shadow.appendChild(container);

    // Load the glue script
    const script = document.createElement('script');
    script.src = extensionUrl + 'vgmplay-js-glue.js';
    script.onload = () => {
        if (!window.vgmPlayInstance) {
            window.vgmPlayInstance = new VGMPlay_js({
                container: container,
                shadowRoot: shadow,
                baseURL: extensionUrl
            });
        }
    };
    document.head.appendChild(script);
}
