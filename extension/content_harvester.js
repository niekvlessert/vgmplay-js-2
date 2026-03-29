// Poll for links every few seconds or on scroll?
// For now, just run once on idle and provide a way to re-scan.

// Helper to check if URL is playable - matches isPlayable() in vgmplay-js-glue.js
function isPlayableExtension(href) {
  const lower = href.toLowerCase().split('?')[0].split('#')[0];
  // Archives
  if (lower.endsWith('.zip') || lower.endsWith('.7z') || lower.endsWith('.rar')) return true;
  // VGM formats
  if (lower.endsWith('.vgm') || lower.endsWith('.vgz') || lower.endsWith('.gym')) return true;
  // PSF/USF formats
  if (lower.endsWith('.psf') || lower.endsWith('.minipsf') || lower.endsWith('.psflib') ||
      lower.endsWith('.usf') || lower.endsWith('.miniusf') || lower.endsWith('.usflib')) return true;
  // Console chip formats
  if (lower.endsWith('.spc') || lower.endsWith('.nsf') || lower.endsWith('.nsfe') ||
      lower.endsWith('.gbs') || lower.endsWith('.hes') || lower.endsWith('.kss') ||
      lower.endsWith('.kssx') || lower.endsWith('.kscc') || lower.endsWith('.ay') ||
      lower.endsWith('.sap')) return true;
  // Tracker formats
  if (lower.endsWith('.mod') || lower.endsWith('.s3m') || lower.endsWith('.xm') ||
      lower.endsWith('.it') || lower.endsWith('.itp') || lower.endsWith('.mptm') ||
      lower.endsWith('.stm') || lower.endsWith('.mtm') || lower.endsWith('.669') ||
      lower.endsWith('.amf') || lower.endsWith('.dmf') || lower.endsWith('.far') ||
      lower.endsWith('.imf') || lower.endsWith('.med') || lower.endsWith('.okt') ||
      lower.endsWith('.ptm') || lower.endsWith('.ult') || lower.endsWith('.umx')) return true;
  // Audio formats
  if (lower.endsWith('.mp3') || lower.endsWith('.flac') || lower.endsWith('.ogg') ||
      lower.endsWith('.wav') || lower.endsWith('.ape') || lower.endsWith('.aac') ||
      lower.endsWith('.m4a') || lower.endsWith('.wma')) return true;
  // MIDI formats
  if (lower.endsWith('.mid') || lower.endsWith('.midi') || lower.endsWith('.rmi')) return true;
  // DOOM MUS
  if (lower.endsWith('.mus') || lower.endsWith('.lmp')) return true;
  // Nintendo DS/Wii formats
  if (lower.endsWith('.brstm') || lower.endsWith('.bfstm') || lower.endsWith('.bcstm') ||
      lower.endsWith('.bcwav') || lower.endsWith('.dsp') || lower.endsWith('.idsp') ||
      lower.endsWith('.hca') || lower.endsWith('.adx') || lower.endsWith('.vag')) return true;
  // Sony formats
  if (lower.endsWith('.at3') || lower.endsWith('.at9') || lower.endsWith('.atrac') ||
      lower.endsWith('.aa3') || lower.endsWith('.oma')) return true;
  // Other game formats
  if (lower.endsWith('.mgs') || lower.endsWith('.bgm') || lower.endsWith('.opx') ||
      lower.endsWith('.mpk') || lower.endsWith('.mbm') || lower.endsWith('.fsb') ||
      lower.endsWith('.vgm') || lower.endsWith('.vgz')) return true;
  return false;
}

function harvestVGM() {
  const links = Array.from(document.querySelectorAll('a'));
  const vgmLinks = links
    .map(link => link.href)
    .filter(isPlayableExtension);

  // Unique list
  const uniqueLinks = [...new Set(vgmLinks)];

if (uniqueLinks.length > 0) {
if (window.__VGM_DEBUG__) {
  console.log(`[VGM Harvester] Found ${uniqueLinks.length} tracks.`);
  console.log('[VGM MISC] Harvested links:', uniqueLinks);
}
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
