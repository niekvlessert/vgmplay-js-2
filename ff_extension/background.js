const api = (typeof browser !== 'undefined') ? browser : chrome;

api.action.onClicked.addListener((tab) => {
    console.log("[VGM] Action clicked, injecting to tab:", tab.id);
    api.scripting.executeScript({
        target: { tabId: tab.id },
        func: togglePlayer
    }).then(() => {
        console.log("[VGM] Script injected successfully");
    }).catch(err => {
        console.error("[VGM] Injection failed:", err);
    });
});

function togglePlayer() {
    console.log("[VGM] togglePlayer executed in tab context");
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

    // Add styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    const api = (typeof browser !== 'undefined') ? browser : chrome;
    styleLink.href = api.runtime.getURL('css/style.css');
    shadow.appendChild(styleLink);

    // Container for the player
    const container = document.createElement('div');
    container.id = 'vgmplay-container';
    shadow.appendChild(container);

    // Load the glue script
    const script = document.createElement('script');
    script.src = api.runtime.getURL('vgmplay-js-glue.js');
    script.onload = () => {
        console.log("[VGM] Glue script loaded");
        // We need to trigger initialization in the Main World because VGMPlay_js is defined there.
        // This runs in the Isolated World, so we inject another script tag.
        const initScript = document.createElement('script');
        initScript.textContent = `
            if (!window.vgmPlayInstance) {
                const root = document.getElementById('vgmplay-extension-root');
                const container = root.shadowRoot.getElementById('vgmplay-container');
                window.vgmPlayInstance = new VGMPlay_js({
                    container: container,
                    shadowRoot: root.shadowRoot,
                    baseURL: '${api.runtime.getURL('')}'
                });
            }
        `;
        document.head.appendChild(initScript);
    };
    document.head.appendChild(script);
}
