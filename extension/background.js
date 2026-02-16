chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: togglePlayer
    });
});

function togglePlayer() {
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
    root.style.position = 'fixed';
    root.style.bottom = '20px';
    root.style.right = '20px';
    root.style.zIndex = '2147483647'; // Max z-index
    document.body.appendChild(root);

    const shadow = root.attachShadow({ mode: 'open' });

    // Add styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('css/style.css');
    shadow.appendChild(styleLink);

    // Container for the player
    const container = document.createElement('div');
    container.id = 'vgmplay-container';
    shadow.appendChild(container);

    // Load the glue script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('vgmplay-js-glue.js');
    script.onload = () => {
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
                    baseURL: '${chrome.runtime.getURL('')}'
                });
            }
        `;
        document.head.appendChild(initScript);
    };
    document.head.appendChild(script);
}
