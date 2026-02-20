// Poll for links every few seconds or on scroll? 
// For now, just run once on idle and provide a way to re-scan.

function harvestVGM() {
    const links = Array.from(document.querySelectorAll('a'));
    const vgmLinks = links
        .map(link => link.href)
        .filter(href => {
            const lower = href.toLowerCase();
            return lower.endsWith('.zip') || lower.endsWith('.vgm') || lower.endsWith('.vgz');
        });

    // Unique list
    const uniqueLinks = [...new Set(vgmLinks)];

    if (uniqueLinks.length > 0) {
        console.log(`[VGM Harvester] Found ${uniqueLinks.length} tracks.`);
        // Send to the player if it exists
        if (window.vgmPlayInstance) {
            window.vgmPlayInstance.addHarvestedTracks(uniqueLinks);
        }
    }
}

// Watch for the player to be ready
const observer = new MutationObserver((mutations) => {
    if (window.vgmPlayInstance) {
        harvestVGM();
        observer.disconnect();
    }
});

observer.observe(document.documentElement, { childList: true, subtree: true });

// Also run once just in case
harvestVGM();
