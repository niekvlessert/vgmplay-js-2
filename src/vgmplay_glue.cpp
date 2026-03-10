/*
 * vgmplay_glue.cpp
 *
 * Glue layer between Emscripten/JS and libvgm.
 * Replaces legacy src/main.c.
 */

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <zlib.h>

#include "../modules/libkss/src/kss/kss.h"
#include "../modules/libkss/src/kssplay.h"
#include "../modules/libvgm/emu/EmuStructs.h"
#include "../modules/libvgm/emu/Resampler.h"
#include "../modules/libvgm/player/playerbase.hpp"
#include "../modules/libvgm/player/vgmplayer.hpp"
#include "../modules/libvgm/utils/DataLoader.h"
#include "../modules/libvgm/utils/FileLoader.h"

extern "C" {
#ifdef INLINE
#undef INLINE
#endif
#include "../modules/sexypsf/driver.h"
void psxShutdown(void);
}
#include "../modules/game-music-emu/gme/gme.h"
#include "../modules/lazyusf/usf.h"
#include "../modules/libMusDoom/src/libmusdoom.h"
#include "miniaudio.h"
#include <map>
#include <algorithm>
#include <ctime>
#include <sys/stat.h>
#include <cctype>

extern "C" {
#include "../modules/vgmstream/src/libvgmstream.h"
#include "../modules/vgmstream/src/libvgmstream_streamfile.h"
}

/* ---- globals ---- */
static VGMPlayer *player = nullptr;
static DATA_LOADER *loader = nullptr;
static char *titleBuf = nullptr;
static char *chipBuf = nullptr;
static UINT32 gSampleRate = 44100;

/* ---- SexyPSF globals ---- */
static bool isPSF = false;
static std::string currentPsfPath;
static PSFINFO *psfInfo = nullptr;
static std::vector<float> psfBufferL;
static std::vector<float> psfBufferR;
static size_t psfReadPos = 0;
extern UINT32 sampcount;
static bool isGME = false;
static Music_Emu *gmeEmu = nullptr;
static gme_info_t *gmeInfo = nullptr;
static int gmeLengthMs = 0;
static std::vector<short> gmeBuffer;
static int gmeTrackIndex = 0;
static bool isKSS = false;
static KSS *gKss = nullptr;
static KSSPLAY *gKssPlay = nullptr;
static int gKssTrackIndex = 0;
static uint64_t gKssSamplePos = 0;
static bool isUSF = false;
static usf_state_t *usfState = nullptr;
static PSFINFO *usfInfo = nullptr;
static std::vector<int16_t> usfBuffer;
static int32_t usfSampleRate = 44100;

static bool isMUS = false;
static musdoom_emulator_t *musEmu = nullptr;
static std::vector<uint8_t> genmidiData;
static std::vector<uint8_t> musData;

static bool isMA = false;
static ma_decoder gMaDecoder;
static bool gMaInitialized = false;
static std::string currentMAPath;
static std::string currentArchiveName;

// VGMStream integration
static bool isVGMStream = false;
static libvgmstream_t* vgmstreamContext = nullptr;
static ma_data_converter vgmstreamConverter;
static bool vgmstreamConverterInitialized = false;
static std::vector<int16_t> vgmstreamInputBuffer;
static std::vector<float> vgmstreamOutputBuffer;
static int vgmstreamChannels = 0;
static int vgmstreamSampleRate = 0;
static std::string currentVGMStreamPath;

// Helper: parse archive filenames like "Game (date)(-)(Company)[Platform].ext"
static void parseArchiveFilename(const std::string& filename, std::string& outTitle, std::string& outPlatform, std::string& outCompany, std::string& outDate) {
    outTitle.clear(); outPlatform.clear(); outCompany.clear(); outDate.clear();
    
    std::string name = filename;
    // Remove extension
    size_t dot = name.rfind('.');
    if (dot != std::string::npos) name = name.substr(0, dot);
    
    // Find first '('
    size_t p1 = name.find('(');
    if (p1 == std::string::npos) {
        outTitle = name;
        return;
    }
    
    // Title: everything before first '(' (trimmed)
    outTitle = name.substr(0, p1);
    size_t start = outTitle.find_first_not_of(" \t");
    size_t end = outTitle.find_last_not_of(" \t");
    if (start != std::string::npos && end != std::string::npos) outTitle = outTitle.substr(start, end-start+1);
    
    // Find closing ')' for first '('
    size_t p2 = name.find(')', p1);
    if (p2 != std::string::npos) {
        outDate = name.substr(p1+1, p2-p1-1);
        start = outDate.find_first_not_of(" \t");
        end = outDate.find_last_not_of(" \t");
        if (start != std::string::npos && end != std::string::npos) outDate = outDate.substr(start, end-start+1);
    }
    
    // Find last '[' for platform
    size_t b1 = name.rfind('[');
    if (b1 != std::string::npos && b1 > p2) {
        size_t b2 = name.find(']', b1);
        if (b2 != std::string::npos) {
            outPlatform = name.substr(b1+1, b2-b1-1);
            start = outPlatform.find_first_not_of(" \t");
            end = outPlatform.find_last_not_of(" \t");
            if (start != std::string::npos && end != std::string::npos) outPlatform = outPlatform.substr(start, end-start+1);
        }
    }
    
    // Find '(' before '[' but after first ')' for company
    if (p2 != std::string::npos && b1 != std::string::npos && b1 > p2) {
        size_t p3 = name.rfind('(', b1);
        if (p3 != std::string::npos && p3 > p2) {
            size_t p4 = name.find(')', p3);
            if (p4 != std::string::npos && p4 < b1) {
                outCompany = name.substr(p3+1, p4-p3-1);
                start = outCompany.find_first_not_of(" \t");
                end = outCompany.find_last_not_of(" \t");
                if (start != std::string::npos && end != std::string::npos) outCompany = outCompany.substr(start, end-start+1);
                if (outCompany == "-") outCompany.clear();
            }
        }
    }
}

#ifdef MA_HAS_FLAC

static void flac_meta_callback(void* pUserData, ma_dr_flac_metadata* pMetadata) {
    if (pMetadata->type != MA_DR_FLAC_METADATA_BLOCK_TYPE_VORBIS_COMMENT) {
        return;
    }
    std::map<std::string, std::string>* tags = (std::map<std::string, std::string>*)pUserData;
    ma_dr_flac_vorbis_comment_iterator iter;
    ma_dr_flac_init_vorbis_comment_iterator(&iter, pMetadata->data.vorbis_comment.commentCount, pMetadata->data.vorbis_comment.pComments);
    const char* comment;
    while ((comment = ma_dr_flac_next_vorbis_comment(&iter, nullptr)) != nullptr) {
        std::string s(comment);
        size_t eq = s.find('=');
        if (eq != std::string::npos) {
            std::string key = s.substr(0, eq);
            std::string value = s.substr(eq + 1);
            // Convert key to uppercase for case-insensitive matching
            std::transform(key.begin(), key.end(), key.begin(), [](unsigned char c) { return std::toupper(c); });
            (*tags)[key] = value;
        }
    }
}

static bool readFlacMetadata(const char* path, std::map<std::string, std::string>& tags) {
    tags.clear();
    ma_dr_flac* pFlac = ma_dr_flac_open_file_with_metadata(path, flac_meta_callback, &tags, nullptr);
    if (pFlac == nullptr) {
        return false;
    }
    ma_dr_flac_free(pFlac, nullptr);
    return true;
}

#endif // MA_HAS_FLAC

static const char *kssSystemName(int mode) {
  switch (mode) {
  case 0:
    return "MSX";
  case 1:
    return "Sega Master System";
  case 2:
    return "Sega Game Gear";
  default:
    return "MSX";
  }
}

static const char *kssTrackTitle(KSS *kss, int trackNum) {
  if (!kss || !kss->info || kss->info_num == 0)
    return "";
  for (uint16_t i = 0; i < kss->info_num; i++) {
    if (kss->info[i].song != trackNum)
      continue;
    if (kss->info[i].title[0]) {
      return kss->info[i].title;
    }
  }
  return "";
}

extern "C" {
int stop_sexy_execute = 0; // Declare stop_sexy_execute here

#ifdef __EMSCRIPTEN__
#include <emscripten/heap.h>
EMSCRIPTEN_KEEPALIVE
uint32_t GetUsedMemory() {
    return (uint32_t)(*emscripten_get_sbrk_ptr());
}

EMSCRIPTEN_KEEPALIVE
uint32_t GetFreeMemory() {
    return (uint32_t)(emscripten_get_heap_size() - *emscripten_get_sbrk_ptr());
}

EMSCRIPTEN_KEEPALIVE
uint32_t GetTotalMemory() {
    return (uint32_t)emscripten_get_heap_size();
}
#endif

EMSCRIPTEN_KEEPALIVE
void LoadGENMIDI(const uint8_t *data, size_t size) {
  genmidiData.assign(data, data + size);
  if (isMUS && musEmu) {
    musdoom_load_genmidi(musEmu, genmidiData.data(), genmidiData.size());
  }
}

EMSCRIPTEN_KEEPALIVE
int MUSPlaying() { return isMUS ? 1 : 0; }

EMSCRIPTEN_KEEPALIVE
void SetCurrentArchiveName(const char* name) {
    currentArchiveName = name ? name : "";
}

EMSCRIPTEN_KEEPALIVE
void PrefillPSF(int minFrames, int maxExec) {
  if (!isPSF)
    return;
  if (minFrames < 0)
    minFrames = 0;
  if (maxExec <= 0)
    maxExec = 1;
  while ((int)(psfBufferL.size() - psfReadPos) < minFrames && maxExec-- > 0) {
    stop_sexy_execute = 0;
    sexy_execute();
    if ((int)(psfBufferL.size() - psfReadPos) < minFrames && psfInfo &&
        sampcount >= psfInfo->length * 44.1) {
      break;
    }
  }
}

/* ---- SexyPSF callbacks ---- */
void SPUirq(void) {} // Dummy SPU IRQ for SexyPSF
}

/* ---- USF helper ---- */
static int usf_load_psf(const char *path, void *state, int level) {
  if (level > 10)
    return -1;
  FILE *f = fopen(path, "rb");
  if (!f)
    return -1;
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  fseek(f, 0, SEEK_SET);
  std::vector<uint8_t> data(size);
  fread(data.data(), 1, size, f);
  fclose(f);

  if (data.size() < 16 || memcmp(data.data(), "PSF\x21", 4) != 0)
    return -1;

  uint32_t reservedSize = *(uint32_t *)(data.data() + 4);
  uint32_t exeSize = *(uint32_t *)(data.data() + 8);

  auto process_payload = [&](const uint8_t *payload, uint32_t pSize) {
    if (pSize == 0)
      return true;

    // Try to see if it's raw SR64/SS64
    bool isRaw = false;
    if (pSize >= 8) {
      uint32_t sig1 = *(uint32_t *)payload;
      uint32_t sig2 = *(uint32_t *)(payload + 4);
      if (sig1 == 0x34365253 || sig1 == 0x34365353 || sig2 == 0x34365253 ||
          sig2 == 0x34365353) {
        isRaw = true;
      }
    }

    if (isRaw) {
      // printf("USF: Loading raw section from %s (%u bytes)\n", path, pSize);
      return usf_upload_section(state, payload, pSize) >= 0;
    } else {
      // Try decompressing. Most sections are small.
      // Start with 16MB and grow if needed (Z_BUF_ERROR).
      uLongf uncompressedSize = 1024 * 1024 * 16;
      std::vector<uint8_t> uncompressedData(uncompressedSize);
      int ret = uncompress(uncompressedData.data(), &uncompressedSize, payload,
                           pSize);

      if (ret == Z_BUF_ERROR) {
        // Try 64MB for large sections
        uncompressedSize = 1024 * 1024 * 64;
        uncompressedData.resize(uncompressedSize);
        ret = uncompress(uncompressedData.data(), &uncompressedSize, payload,
                         pSize);
      }

      if (ret == Z_OK) {
        return usf_upload_section(state, uncompressedData.data(),
                                  uncompressedSize) >= 0;
      }
    }
    return false;
  };

  // Tag parsing for _lib - MUST BE DONE BEFORE process_payload
  // so that the current file can patch the library data.
  const uint8_t *tagStart = data.data() + 16 + reservedSize + exeSize;
  if (data.size() > (size_t)(tagStart - data.data() + 5) &&
      memcmp(tagStart, "[TAG]", 5) == 0) {
    std::string tags((const char *)tagStart + 5,
                     data.size() - (tagStart - data.data()) - 5);
    size_t pos = 0;
    while ((pos = tags.find("_lib", pos)) != std::string::npos) {
      size_t eq = tags.find('=', pos);
      if (eq != std::string::npos) {
        size_t eol = tags.find_first_of("\r\n", eq);
        std::string libName = tags.substr(eq + 1, eol - eq - 1);
        // Trim
        libName.erase(0, libName.find_first_not_of(" "));
        libName.erase(libName.find_last_not_of(" ") + 1);

        if (!libName.empty()) {
          char libPath[1024];
          const char *slash = strrchr(path, '/');
          if (!slash)
            slash = strrchr(path, '\\');
          if (slash) {
            int len = slash - path + 1;
            strncpy(libPath, path, len);
            libPath[len] = '\0';
            strcat(libPath, libName.c_str());
          } else {
            strcpy(libPath, libName.c_str());
          }
          usf_load_psf(libPath, state, level + 1);
        }
        if (eol == std::string::npos)
          break;
        pos = eol;
      } else
        pos += 4;
    }
  }

  if (!process_payload(data.data() + 16, reservedSize)) {
    // Not a big deal if reserved fails, maybe it's in exe
  }
  if (!process_payload(data.data() + 16 + reservedSize, exeSize)) {
    // If both fail, then it's an error
  }

  return 0;
}

extern "C" {
void sexyd_update(unsigned char *p, long l) {
  short *pcm = (short *)p;
  int samples = l / 4; // 16-bit stereo = 4 bytes per sample
  for (int i = 0; i < samples; i++) {
    psfBufferL.push_back(pcm[i * 2] / 32768.0f);
    psfBufferR.push_back(pcm[i * 2 + 1] / 32768.0f);
  }
  if (psfBufferL.size() > psfReadPos &&
      (psfBufferL.size() - psfReadPos) >= 4096)
    stop_sexy_execute = 1;
}
}

static DATA_LOADER *RequestFileCallback(void *userParam, PlayerBase *player,
                                        const char *fileName) {
  DATA_LOADER *dLoad = FileLoader_Init(fileName);
  UINT8 retVal = DataLoader_Load(dLoad);
  if (!retVal)
    return dLoad;
  DataLoader_Deinit(dLoad);
  return NULL;
}

static void cleanup() {
  if (isKSS) {
    if (gKssPlay) {
      KSSPLAY_delete(gKssPlay);
      gKssPlay = nullptr;
    }
    if (gKss) {
      KSS_delete(gKss);
      gKss = nullptr;
    }
    isKSS = false;
    gKssTrackIndex = 0;
    gKssSamplePos = 0;
  }
  if (isGME) {
    if (gmeInfo) {
      gme_free_info(gmeInfo);
      gmeInfo = nullptr;
    }
    if (gmeEmu) {
      gme_delete(gmeEmu);
      gmeEmu = nullptr;
    }
    isGME = false;
    gmeLengthMs = 0;
    gmeTrackIndex = 0;
  }
  if (isPSF) {
    if (psfInfo) {
      sexy_freepsfinfo(psfInfo);
      psfInfo = nullptr;
    }
    sexy_stop();
    psxShutdown(); // Free memory allocated by psxInit()
    isPSF = false;
    currentPsfPath.clear();
    psfBufferL.clear();
    psfBufferR.clear();
    psfReadPos = 0;
  }
  if (isUSF) {
    if (usfInfo) {
      sexy_freepsfinfo(usfInfo);
      usfInfo = nullptr;
    }
    if (usfState) {
      usf_shutdown(usfState);
      free(usfState);
      usfState = nullptr;
    }
    isUSF = false;
    usfBuffer.clear();
  }
  if (isMUS) {
    if (musEmu) {
      musdoom_stop(musEmu);
      musdoom_unload(musEmu);
      musdoom_destroy(musEmu);
      musEmu = nullptr;
    }
    isMUS = false;
    musData.clear();
  }
  if (isMA) {
    if (gMaInitialized) {
      ma_decoder_uninit(&gMaDecoder);
      gMaInitialized = false;
    }
    isMA = false;
    currentMAPath.clear();
    currentArchiveName.clear();
  }
  if (isVGMStream) {
    if (vgmstreamContext) {
      libvgmstream_free(vgmstreamContext);
      vgmstreamContext = nullptr;
    }
    if (vgmstreamConverterInitialized) {
      ma_data_converter_uninit(&vgmstreamConverter, NULL);
      vgmstreamConverterInitialized = false;
    }
    vgmstreamInputBuffer.clear();
    vgmstreamOutputBuffer.clear();
    currentVGMStreamPath.clear();
    isVGMStream = false;
    vgmstreamChannels = 0;
    vgmstreamSampleRate = 0;
  }
  if (player) {
    player->Stop();
    player->UnloadFile();
    delete player;
    player = nullptr;
  }
  if (loader) {
    DataLoader_Deinit(loader);
    loader = nullptr;
  }
  if (titleBuf) {
    free(titleBuf);
    titleBuf = nullptr;
  }
  if (chipBuf) {
    free(chipBuf);
    chipBuf = nullptr;
  }
}

static int parseTrackSuffix(const char *path, std::string &basePath) {
  if (!path) {
    basePath.clear();
    return 0;
  }
  std::string s(path);
  const std::string key = "|track=";
  size_t pos = s.rfind(key);
  if (pos == std::string::npos) {
    basePath = s;
    return 0;
  }
  basePath = s.substr(0, pos);
  int track = 0;
  try {
    track = std::stoi(s.substr(pos + key.size()));
  } catch (...) {
    track = 0;
  }
  if (track < 0)
    track = 0;
  return track;
}

static bool isKssFormatPath(const std::string &lowerPath) {
  return (lowerPath.find(".kss") != std::string::npos ||
          lowerPath.find(".kssx") != std::string::npos ||
          lowerPath.find(".kscc") != std::string::npos ||
          lowerPath.find(".mgs") != std::string::npos ||
          lowerPath.find(".bgm") != std::string::npos ||
          lowerPath.find(".opx") != std::string::npos ||
          lowerPath.find(".mpk") != std::string::npos ||
          lowerPath.find(".mbm") != std::string::npos);
}

static const char *gmeTagByIndex(const gme_info_t *info, int tagIndex) {
  if (!info)
    return "";
  switch (tagIndex) {
  case 0:
    return info->song ? info->song : "";
  case 2:
    return info->game ? info->game : "";
  case 4:
    return info->system ? info->system : "";
  case 6:
    return info->author ? info->author : "";
  case 8:
    return info->copyright ? info->copyright : "";
  case 9:
    return info->dumper ? info->dumper : "";
  case 10:
    return info->comment ? info->comment : "";
  default:
    return "";
  }
}

extern "C" {

/* store rate globally; apply to player if one exists */
void SetSampleRate(unsigned int rate) {
  gSampleRate = rate;
  if (player)
    player->SetSampleRate(rate);
}

void SetLoopCount(unsigned int loops) {
  /* libvgm VGMPlayer doesn't expose a simple loop-count setter;
     the higher-level PlayerA does, but we use VGMPlayer directly.
     Ignoring for now – libvgm defaults to looping. */
}

void Seek(unsigned int sec, unsigned int ms) {
  UINT64 totalMs = (UINT64)sec * 1000 + (UINT64)ms;
  UINT32 sample = (UINT32)((totalMs * gSampleRate) / 1000);

  if (isKSS && gKssPlay) {
    KSSPLAY_reset(gKssPlay, gKssTrackIndex, 0);
    const UINT32 CHUNK = 4096;
    UINT32 remaining = sample;
    while (remaining > 0) {
      UINT32 toCalc = (remaining > CHUNK) ? CHUNK : remaining;
      KSSPLAY_calc_silent(gKssPlay, toCalc);
      remaining -= toCalc;
    }
    gKssSamplePos = sample;
    return;
  }
  if (isGME && gmeEmu) {
    gme_seek(gmeEmu, (int)totalMs);
    return;
  }
  if (isMA && gMaInitialized) {
    ma_decoder_seek_to_pcm_frame(&gMaDecoder, (ma_uint64)sample);
    return;
  }
  if (isMUS && musEmu) {
    musdoom_seek_ms(musEmu, (uint32_t)totalMs);
    return;
  }
  if (isPSF) {
    psfBufferL.clear();
    psfBufferR.clear();
    psfReadPos = 0;
    if (!sexy_seek((u32)totalMs)) {
      // Backward seek requires reloading the file
      if (!currentPsfPath.empty()) {
        sexy_stop();
        psxShutdown();
        psfInfo = sexy_load(const_cast<char *>(currentPsfPath.c_str()));
        sampcount = 0;
        if (psfInfo && psfInfo->length == 0) {
          psfInfo->length = 180000;
        }
        sexy_seek((u32)totalMs);
      }
    }
    return;
  }
  if (isVGMStream) {
    if (vgmstreamContext) {
      libvgmstream_seek(vgmstreamContext, sample);
      vgmstreamInputBuffer.clear();
      vgmstreamOutputBuffer.clear();
      if (vgmstreamConverterInitialized) {
        ma_data_converter_reset(&vgmstreamConverter);
      }
    }
    return;
  }
  // USF does not expose a seek function in lazyusf.

  if (!player)
    return;
  // libvgm expects unit=PLAYPOS_SAMPLE (0x02) and a sample count
  player->Seek(0x02, sample);
}

int OpenVGMFile(const char *path) {
  cleanup();

  /* Detect PSF by extension */
  std::string basePath;
  int trackIndex = parseTrackSuffix(path, basePath);
  std::string sPath = basePath;
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (sPath.size() > 4 && (sPath.substr(sPath.size() - 4) == ".psf" ||
                           sPath.substr(sPath.size() - 4) == ".PSF" ||
                           sPath.substr(sPath.size() - 8) == ".minipsf" ||
                           sPath.substr(sPath.size() - 8) == ".MINIPSF")) {
    psfInfo = sexy_load((char *)path);
    if (!psfInfo) {
      return 0;
    }
    isPSF = true;
    currentPsfPath = path;
    sampcount = 0;
    psfBufferL.clear();
    psfBufferR.clear();
    psfReadPos = 0;
    psfBufferL.reserve(16384);
    psfBufferR.reserve(16384);
    if (psfInfo->length == 0) {
      psfInfo->length = 180000;
    }
    return 1;
  }

  if (sPath.size() > 4 && (sPath.substr(sPath.size() - 4) == ".usf" ||
                           sPath.substr(sPath.size() - 4) == ".USF" ||
                           sPath.substr(sPath.size() - 8) == ".miniusf" ||
                           sPath.substr(sPath.size() - 8) == ".MINIUSF")) {
    usfState = (usf_state_t *)malloc(usf_get_state_size());
    if (!usfState)
      return 0;
    usf_clear(usfState);
    usf_set_hle_audio(usfState, 1);

    if (usf_load_psf(path, usfState, 0) < 0) {
      printf("USF: Failed to load %s\n", path);
      free(usfState);
      usfState = nullptr;
      return 0;
    }
    // printf("USF: Loaded %s successfully\n", path);

    usfInfo = sexy_getpsfinfo((char *)path);
    if (usfInfo && usfInfo->length == 0) {
      usfInfo->length = 180000;
    }

    isUSF = true;
    sampcount = 0;
    usfBuffer.clear();
    return 1;
  }

  if (isKssFormatPath(lowerPath)) {
    DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
    if (!kssLoader) {
      return 0;
    }
    if (DataLoader_Load(kssLoader)) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    const UINT8 *fileData = DataLoader_GetData(kssLoader);
    UINT32 fileSize = DataLoader_GetSize(kssLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    const char *filename = strrchr(basePath.c_str(), '/');
    filename = filename ? filename + 1 : basePath.c_str();

    gKss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
    if (!gKss) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    gKssPlay = KSSPLAY_new(gSampleRate, 2, 16);
    if (!gKssPlay) {
      KSS_delete(gKss);
      gKss = nullptr;
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    KSSPLAY_set_data(gKssPlay, gKss);
    // Enable higher-quality rendering for libkss devices
    KSSPLAY_set_device_quality(gKssPlay, KSS_DEVICE_PSG, 1);
    KSSPLAY_set_device_quality(gKssPlay, KSS_DEVICE_SCC, 1);
    KSSPLAY_set_device_quality(gKssPlay, KSS_DEVICE_OPLL, 1);
    KSSPLAY_set_device_quality(gKssPlay, KSS_DEVICE_OPL, 1);

    int trkMin = gKss->trk_min;
    int trkMax = gKss->trk_max;
    if (trkMax < trkMin) {
      trkMin = 0;
      trkMax = 0;
    }
    int trackNum = trkMin + trackIndex;
    if (trackNum < trkMin)
      trackNum = trkMin;
    if (trackNum > trkMax)
      trackNum = trkMax;
    gKssTrackIndex = trackNum;
    KSSPLAY_reset(gKssPlay, gKssTrackIndex, 0);
    gKssSamplePos = 0;
    isKSS = true;
    DataLoader_Deinit(kssLoader);
    return 1;
  }

  if (lowerPath.size() > 4 && (lowerPath.find(".spc") != std::string::npos ||
                               lowerPath.find(".nsf") != std::string::npos ||
                               lowerPath.find(".nsfe") != std::string::npos ||
                               lowerPath.find(".gbs") != std::string::npos ||
                               lowerPath.find(".gym") != std::string::npos ||
                               lowerPath.find(".hes") != std::string::npos ||
                               lowerPath.find(".sap") != std::string::npos ||
                               lowerPath.find(".ay") != std::string::npos)) {
    gme_err_t err = gme_open_file(basePath.c_str(), &gmeEmu, (int)gSampleRate);
    if (err) {
      gmeEmu = nullptr;
      return 0;
    }
    isGME = true;
    gmeTrackIndex = trackIndex;
    gme_ignore_silence(gmeEmu, 1);
    gme_start_track(gmeEmu, gmeTrackIndex);
    if (gmeInfo) {
      gme_free_info(gmeInfo);
      gmeInfo = nullptr;
    }
    if (!gme_track_info(gmeEmu, &gmeInfo, gmeTrackIndex) && gmeInfo) {
      if (gmeInfo->play_length > 0)
        gmeLengthMs = gmeInfo->play_length;
      else if (gmeInfo->length > 0)
        gmeLengthMs = gmeInfo->length;
      else
        gmeLengthMs = 180000;
    } else {
      gmeLengthMs = 180000;
    }
    return 1;
  }

  if (lowerPath.size() > 4 && (lowerPath.find(".mp3") != std::string::npos ||
                               lowerPath.find(".flac") != std::string::npos ||
                               lowerPath.find(".ogg") != std::string::npos ||
                               lowerPath.find(".wav") != std::string::npos)) {
    FILE *f = fopen(path, "rb");
    if (!f) {
      return 0;
    }
    fclose(f);

    ma_decoder_config config =
        ma_decoder_config_init(ma_format_f32, 2, gSampleRate);
    ma_result res = ma_decoder_init_file(path, &config, &gMaDecoder);
    if (res != MA_SUCCESS) {
      return 0;
    }
    isMA = true;
    gMaInitialized = true;
    currentMAPath = basePath;
    return 1;
  }

  /* 1. load file data via FileLoader */
  if (lowerPath.size() > 4 &&
      (lowerPath.substr(lowerPath.size() - 4) == ".mus" ||
       lowerPath.substr(lowerPath.size() - 4) == ".lmp")) {
    FILE *f = fopen(path, "rb");
    if (f) {
      cleanup();
      fseek(f, 0, SEEK_END);
      long size = ftell(f);
      fseek(f, 0, SEEK_SET);
      musData.resize(size);
      fread(musData.data(), 1, size, f);
      fclose(f);

      // Verify MUS header
      if (musData.size() >= 4 && memcmp(musData.data(), "MUS\x1a", 4) == 0) {
        isMUS = true;
        musdoom_config_t config;
        musdoom_config_init(&config);
        config.sample_rate = gSampleRate;
        config.opl_type = MUSDOOM_OPL3;

        musEmu = musdoom_create(&config);
        if (musEmu) {
          if (!genmidiData.empty()) {
            musdoom_load_genmidi(musEmu, genmidiData.data(),
                                 genmidiData.size());
          }
          if (musdoom_load(musEmu, musData.data(), musData.size()) ==
              MUSDOOM_OK) {
            musdoom_start(musEmu, 1);
            return 1;
          }
          musdoom_destroy(musEmu);
          musEmu = nullptr;
        }
        isMUS = false;
        musData.clear();
      }
    }
  }

  // Try vgmstream as a fallback for many game audio formats
  {
    libvgmstream_t* vs = libvgmstream_init();
    if (vs) {
      libvgmstream_config_t cfg = {};
      cfg.ignore_loop = true;
      cfg.force_sfmt = LIBVGMSTREAM_SFMT_PCM16;
      libvgmstream_setup(vs, &cfg);

      libstreamfile_t* sf = libstreamfile_open_from_stdio(basePath.c_str());
      if (sf) {
        int result = libvgmstream_open_stream(vs, sf, 0);
        libstreamfile_close(sf);
        if (result >= 0) {
          // Success - set up converter and buffers
          isVGMStream = true;
          vgmstreamContext = vs;
          vgmstreamChannels = vs->format->channels;
          vgmstreamSampleRate = vs->format->sample_rate;
          currentVGMStreamPath = basePath;

          // Initialize data converter: s16 -> f32, with channel conversion and resampling
          ma_data_converter_config convConfig = ma_data_converter_config_init(
              ma_format_s16, ma_format_f32,
              vgmstreamChannels, 2,
              vgmstreamSampleRate, gSampleRate);
          ma_result res = ma_data_converter_init(&convConfig, NULL, &vgmstreamConverter);
          if (res != MA_SUCCESS) {
            // Failed to init converter, clean up and fail
            libvgmstream_free(vs);
            isVGMStream = false;
            vgmstreamContext = nullptr;
            return 0;
          }
          vgmstreamConverterInitialized = true;
          // Clear buffers
          vgmstreamInputBuffer.clear();
          vgmstreamOutputBuffer.clear();

          return 1;
        }
      }
      libvgmstream_free(vs);
    }
  }

  loader = FileLoader_Init(path);
  if (!loader) {
    return 0;
  }
  if (DataLoader_Load(loader)) {
    return 0;
  }

  /* 2. create player & set sample rate BEFORE LoadFile (like PlayerA does) */
  player = new VGMPlayer();

  player->SetSampleRate(gSampleRate);
  player->SetFileReqCallback(RequestFileCallback, NULL);

  /* 3. set player-specific options (playbackHz = 0 means "no speed
   * correction")
   */
  VGM_PLAY_OPTIONS opts;
  memset(&opts, 0, sizeof(opts));
  opts.playbackHz = 0;
  player->SetPlayerOptions(opts);

  /* 4. load */
  if (player->LoadFile(loader)) {
    return 0;
  }

  /* 5. set sample rate again and start (matches PlayerA::Start pattern) */
  player->SetSampleRate(gSampleRate);
  player->Start();
  return 1;
}

void CloseVGMFile(void) { cleanup(); }

void PlayVGM(void) {
  if (player) {
    player->SetSampleRate(gSampleRate);
    player->Start();
  }
}
void StopVGM(void) {
  if (player) {
    player->Stop();
  }
}

int VGMEnded(void) {
  if (isKSS) {
    return gKssPlay ? (KSSPLAY_get_stop_flag(gKssPlay) ? 1 : 0) : 1;
  }
  if (isGME) {
    return gmeEmu ? (gme_track_ended(gmeEmu) ? 1 : 0) : 1;
  }
  if (isPSF) {
    return (psfInfo && sampcount >= psfInfo->length * 44.1) ? 1 : 0;
  }
  if (isUSF) {
    return (usfInfo && sampcount >= usfInfo->length * 44.1) ? 1 : 0;
  }
  if (isMA) {
    if (!gMaInitialized)
      return 1;
    ma_uint64 cursor;
    ma_uint64 length;
    ma_decoder_get_cursor_in_pcm_frames(&gMaDecoder, &cursor);
    ma_decoder_get_length_in_pcm_frames(&gMaDecoder, &length);
    return (cursor >= length) ? 1 : 0;
  }
  if (isMUS) {
    return musEmu ? (musdoom_is_playing(musEmu) ? 0 : 1) : 1;
  }
  if (isVGMStream) {
    if (!vgmstreamContext) return 1;
    return vgmstreamContext->decoder->done ? 1 : 0;
  }
  if (!player)
    return 1;
  return (player->GetState() & PLAYSTATE_END) ? 1 : 0;
}

int GetTrackLength(void) {
  if (isKSS) {
    if (gKss && gKss->info && gKss->info_num > 0) {
      for (uint16_t i = 0; i < gKss->info_num; i++) {
        if (gKss->info[i].song == gKssTrackIndex &&
            gKss->info[i].time_in_ms > 0) {
          return (int)((uint64_t)gKss->info[i].time_in_ms * 44.1);
        }
      }
    }
    return 0;
  }
  if (isGME) {
    return gmeLengthMs > 0 ? (int)(gmeLengthMs * 44.1) : 0;
  }
  if (isPSF) {
    return psfInfo ? (int)(psfInfo->length * 44.1) : 0;
  }
  if (isMUS) {
    return musEmu ? (int)(musdoom_get_length_ms(musEmu) * 44.1) : 0;
  }
  if (isUSF) {
    return usfInfo ? (int)(usfInfo->length * 44.1) : 0;
  }
  if (isMA) {
    if (!gMaInitialized)
      return 0;
    ma_uint64 length;
    ma_decoder_get_length_in_pcm_frames(&gMaDecoder, &length);
    return (int)length;
  }
  if (isVGMStream) {
    if (vgmstreamContext) {
      return (int)vgmstreamContext->format->play_samples;
    }
    return 0;
  }
  if (!player)
    return 0;
  return (int)player->Tick2Sample(player->GetTotalTicks());
}

int GetLoopPoint(void) {
  if (!player)
    return 0;
  return (int)player->Tick2Sample(player->GetLoopTicks());
}

int GetTrackLengthDirect(const char *path) {
  std::string basePath;
  int trackIndex = parseTrackSuffix(path, basePath);
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);

  if (lowerPath.find(".psf") != std::string::npos ||
      lowerPath.find(".minipsf") != std::string::npos ||
      lowerPath.find(".usf") != std::string::npos ||
      lowerPath.find(".miniusf") != std::string::npos) {
    PSFINFO *info = sexy_getpsfinfo((char *)path);
    if (!info)
      return 0;
    int len = (int)(info->length * 44.1);
    sexy_freepsfinfo(info);
    return len;
  }

  if (lowerPath.find(".spc") != std::string::npos ||
      lowerPath.find(".nsf") != std::string::npos ||
      lowerPath.find(".nsfe") != std::string::npos ||
      lowerPath.find(".gbs") != std::string::npos ||
      lowerPath.find(".gym") != std::string::npos ||
      lowerPath.find(".hes") != std::string::npos ||
      lowerPath.find(".sap") != std::string::npos ||
      lowerPath.find(".ay") != std::string::npos) {
    Music_Emu *emu = nullptr;
    gme_err_t err = gme_open_file(basePath.c_str(), &emu, (int)gSampleRate);
    if (err || !emu)
      return 0;
    gme_info_t *info = nullptr;
    if (gme_track_info(emu, &info, trackIndex) != 0 || !info) {
      gme_delete(emu);
      return 0;
    }
    int len = 0;
    if (info->play_length > 0)
      len = info->play_length;
    else if (info->length > 0)
      len = info->length;
    else
      len = 180000;
    int samples = (int)(len * 44.1);
    gme_free_info(info);
    gme_delete(emu);
    return samples;
  }

  // Try vgmstream for various game audio formats
  {
    libvgmstream_t* vs = libvgmstream_init();
    if (vs) {
      libvgmstream_config_t cfg = {};
      cfg.ignore_loop = true;
      cfg.force_sfmt = LIBVGMSTREAM_SFMT_PCM16;
      libvgmstream_setup(vs, &cfg);
      libstreamfile_t* sf = libstreamfile_open_from_stdio(path);
      if (sf) {
        int result = libvgmstream_open_stream(vs, sf, 0);
        libstreamfile_close(sf);
        if (result >= 0) {
          int length = (int)vs->format->play_samples;
          libvgmstream_free(vs);
          return length;
        }
      }
      libvgmstream_free(vs);
    }
  }

  if (lowerPath.find(".mus") != std::string::npos ||
      lowerPath.find(".lmp") != std::string::npos) {
    FILE *f = fopen(path, "rb");
    if (!f)
      return 0;
    fseek(f, 0, SEEK_END);
    size_t size = ftell(f);
    fseek(f, 0, SEEK_SET);
    std::vector<uint8_t> data(size);
    fread(data.data(), 1, size, f);
    fclose(f);

    musdoom_config_t config;
    musdoom_config_init(&config);
    musdoom_emulator_t *emu = musdoom_create(&config);
    if (!emu)
      return 0;
    int samples = 0;
    if (musdoom_load(emu, data.data(), data.size()) == MUSDOOM_OK) {
      samples = (int)(musdoom_get_length_ms(emu) * 44.1);
    }
    musdoom_destroy(emu);
    return samples;
  }

  if (lowerPath.find(".mp3") != std::string::npos ||
      lowerPath.find(".flac") != std::string::npos ||
      lowerPath.find(".ogg") != std::string::npos ||
      lowerPath.find(".wav") != std::string::npos) {
    ma_decoder tempDecoder;
    ma_decoder_config config =
        ma_decoder_config_init(ma_format_f32, 2, gSampleRate);
    if (ma_decoder_init_file(path, &config, &tempDecoder) == MA_SUCCESS) {
      ma_uint64 length;
      ma_decoder_get_length_in_pcm_frames(&tempDecoder, &length);
      ma_decoder_uninit(&tempDecoder);
      return (int)length;
    }
    return 0;
  }

  if (isKssFormatPath(lowerPath)) {
    DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
    if (!kssLoader)
      return 0;
    if (DataLoader_Load(kssLoader)) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    const UINT8 *fileData = DataLoader_GetData(kssLoader);
    UINT32 fileSize = DataLoader_GetSize(kssLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    const char *filename = strrchr(basePath.c_str(), '/');
    filename = filename ? filename + 1 : basePath.c_str();
    KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
    if (!kss) {
      DataLoader_Deinit(kssLoader);
      return 0;
    }
    int trkMin = kss->trk_min;
    int trkMax = kss->trk_max;
    int trackNum = trkMin + trackIndex;
    if (trackNum < trkMin)
      trackNum = trkMin;
    if (trackNum > trkMax)
      trackNum = trkMax;
    int lengthMs = 0;
    if (kss->info && kss->info_num > 0) {
      for (uint16_t i = 0; i < kss->info_num; i++) {
        if (kss->info[i].song == trackNum && kss->info[i].time_in_ms > 0) {
          lengthMs = kss->info[i].time_in_ms;
          break;
        }
      }
    }
    KSS_delete(kss);
    DataLoader_Deinit(kssLoader);
    return lengthMs > 0 ? (int)((uint64_t)lengthMs * 44.1) : 0;
  }

  DATA_LOADER *locLoader = FileLoader_Init(path);
  if (!locLoader)
    return 0;
  if (DataLoader_Load(locLoader)) {
    DataLoader_Deinit(locLoader);
    return 0;
  }

  VGMPlayer *locPlayer = new VGMPlayer();
  locPlayer->SetSampleRate(gSampleRate);
  if (locPlayer->LoadFile(locLoader)) {
    delete locPlayer;
    DataLoader_Deinit(locLoader);
    return 0;
  }

  int length = (int)locPlayer->Tick2Sample(locPlayer->GetTotalTicks());

  locPlayer->UnloadFile();
  delete locPlayer;
  DataLoader_Deinit(locLoader);
  return length;
}

const char *GetVGMTagDirect(const char *path, int tagIndex) {
  std::string basePath;
  int trackIndex = parseTrackSuffix(path, basePath);
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);

  if (lowerPath.find(".psflib") != std::string::npos)
    return "";

  if (lowerPath.find(".psf") != std::string::npos ||
      lowerPath.find(".minipsf") != std::string::npos ||
      lowerPath.find(".usf") != std::string::npos ||
      lowerPath.find(".miniusf") != std::string::npos) {
    PSFINFO *info = sexy_getpsfinfo((char *)path);
    if (!info)
      return "";

    const char *keys[] = {"title",  "", "game", "",      "platform", "",
                          "artist", "", "year", "psfby", "comment"};
    if (tagIndex < 0 || tagIndex >= 11) {
      sexy_freepsfinfo(info);
      return "";
    }

    const char *targetKey = keys[tagIndex];
    if (!targetKey || !*targetKey) {
      sexy_freepsfinfo(info);
      return "";
    }

    PSFTAG *t = info->tags;
    while (t) {
      if (strcasecmp(t->key, targetKey) == 0) {
        static char tagResult[256];
        strncpy(tagResult, t->value, 255);
        tagResult[255] = '\0';
        sexy_freepsfinfo(info);
        return tagResult;
      }
      t = t->next;
    }
    sexy_freepsfinfo(info);
    return "";
  }

  if (isKssFormatPath(lowerPath)) {
    DATA_LOADER *kssLoader = FileLoader_Init(path);
    if (!kssLoader)
      return "";
    if (DataLoader_Load(kssLoader)) {
      DataLoader_Deinit(kssLoader);
      return "";
    }
    const UINT8 *fileData = DataLoader_GetData(kssLoader);
    UINT32 fileSize = DataLoader_GetSize(kssLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(kssLoader);
      return "";
    }
    const char *filename = strrchr(basePath.c_str(), '/');
    filename = filename ? filename + 1 : basePath.c_str();
    KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
    if (!kss) {
      DataLoader_Deinit(kssLoader);
      return "";
    }
    const char *title = KSS_get_title(kss);
    int trkMin = kss->trk_min;
    int trkMax = kss->trk_max;
    int trackNum = trkMin + trackIndex;
    if (trackNum < trkMin)
      trackNum = trkMin;
    if (trackNum > trkMax)
      trackNum = trkMax;
    const char *trackTitle = kssTrackTitle(kss, trackNum);
    static char tagResult[256];
    tagResult[0] = '\0';
    if (tagIndex == 0) {
      const char *useTitle = (trackTitle && trackTitle[0]) ? trackTitle : title;
      strncpy(tagResult, useTitle ? useTitle : "", 255);
      tagResult[255] = '\0';
    } else if (tagIndex == 2) {
      strncpy(tagResult, title ? title : "", 255);
      tagResult[255] = '\0';
    } else if (tagIndex == 4) {
      strncpy(tagResult, kssSystemName(kss->mode), 255);
      tagResult[255] = '\0';
    }
    KSS_delete(kss);
    DataLoader_Deinit(kssLoader);
    return tagResult;
  }

  if (lowerPath.find(".spc") != std::string::npos ||
      lowerPath.find(".nsf") != std::string::npos ||
      lowerPath.find(".nsfe") != std::string::npos ||
      lowerPath.find(".gbs") != std::string::npos ||
      lowerPath.find(".gym") != std::string::npos ||
      lowerPath.find(".hes") != std::string::npos ||
      lowerPath.find(".sap") != std::string::npos ||
      lowerPath.find(".ay") != std::string::npos) {
    Music_Emu *emu = nullptr;
    gme_err_t err = gme_open_file(basePath.c_str(), &emu, (int)gSampleRate);
    if (err || !emu)
      return "";
    gme_info_t *info = nullptr;
    if (gme_track_info(emu, &info, trackIndex) != 0 || !info) {
      if (emu)
        gme_delete(emu);
      return "";
    }
    static char tagResult[256];
    const char *val = gmeTagByIndex(info, tagIndex);
    strncpy(tagResult, val ? val : "", 255);
    tagResult[255] = '\0';
    gme_free_info(info);
    gme_delete(emu);
    return tagResult;
  }

  if (lowerPath.find(".mus") != std::string::npos ||
      lowerPath.find(".lmp") != std::string::npos) {
    if (tagIndex == 2) {
      // Return filename as game name for MUS
      static char tagResult[256];
      const char *filename = strrchr(basePath.c_str(), '/');
      filename = filename ? filename + 1 : basePath.c_str();
      strncpy(tagResult, filename, 255);
      tagResult[255] = '\0';
      return tagResult;
    }
    return "";
  }

  // For non-PSF, we'd need to load the file and use VGMPlayer::GetTags.
  // This is heavier but possible. For now, focus on PSF.
  return "";
}

void FillBuffer2(float *left, float *right, int n) {
  if (n <= 0)
    return;

  if (isMUS) {
    if (musEmu && musdoom_is_playing(musEmu)) {
      std::vector<int16_t> musBuf(n * 2);
      musdoom_generate_samples(musEmu, musBuf.data(), n);
      for (int i = 0; i < n; i++) {
        left[i] = (float)musBuf[i * 2] / 32768.0f;
        right[i] = (float)musBuf[i * 2 + 1] / 32768.0f;
      }
    } else {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
    }
    return;
  }

  if (isKSS) {
    if (!gKssPlay) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    std::vector<INT16> tmp(n * 2);
    KSSPLAY_calc(gKssPlay, tmp.data(), n);
    gKssSamplePos += (uint64_t)n;
    for (int i = 0; i < n; i++) {
      left[i] = (float)(tmp[i * 2] / 32768.0f);
      right[i] = (float)(tmp[i * 2 + 1] / 32768.0f);
    }
    return;
  }

  if (isGME) {
    if (!gmeEmu) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    gmeBuffer.resize(n * 2);
    gme_err_t err = gme_play(gmeEmu, n * 2, gmeBuffer.data());
    if (err) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    for (int i = 0; i < n; i++) {
      left[i] = (float)(gmeBuffer[i * 2] / 32768.0f);
      right[i] = (float)(gmeBuffer[i * 2 + 1] / 32768.0f);
    }
    return;
  }

  if (isPSF) {
    // Try a small budget here; bulk prefill is handled separately.
    PrefillPSF(n, 2);
    int available = (int)(psfBufferL.size() - psfReadPos);
    int toCopy = (available < n) ? available : n;
    for (int i = 0; i < toCopy; i++) {
      left[i] = psfBufferL[psfReadPos + i];
      right[i] = psfBufferR[psfReadPos + i];
    }
    // Zero out remaining if any
    for (int i = toCopy; i < n; i++) {
      left[i] = 0;
      right[i] = 0;
    }
    if (toCopy > 0) {
      psfReadPos += (size_t)toCopy;
      // Compact occasionally to avoid unbounded growth.
      if (psfReadPos >= 16384 && psfReadPos * 2 >= psfBufferL.size()) {
        psfBufferL.erase(psfBufferL.begin(),
                         psfBufferL.begin() + (long)psfReadPos);
        psfBufferR.erase(psfBufferR.begin(),
                         psfBufferR.begin() + (long)psfReadPos);
        psfReadPos = 0;
      }
    }
    return;
  }

  if (isMA) {
    if (!gMaInitialized) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    std::vector<float> temp(n * 2);
    ma_uint64 framesRead;
    ma_decoder_read_pcm_frames(&gMaDecoder, temp.data(), n, &framesRead);
    for (ma_uint64 i = 0; i < (int)framesRead; i++) {
      left[i] = temp[i * 2];
      right[i] = temp[i * 2 + 1];
    }
    for (int i = (int)framesRead; i < n; i++) {
      left[i] = 0;
      right[i] = 0;
    }
    return;
  }

  if (isUSF) {
    if (!usfState) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }

    // Fill buffer if needed
    while (usfBuffer.size() < (size_t)n * 2) {
      int16_t render_buf[2048 * 2];
      const char *err = usf_render(usfState, render_buf, 2048, &usfSampleRate);
      if (err) {
        printf("USF Error: %s\n", err);
        break;
      }
      usfBuffer.insert(usfBuffer.end(), render_buf, render_buf + 2048 * 2);
    }

    for (int i = 0; i < n; i++) {
      left[i] = (float)(usfBuffer[i * 2] / 32768.0f);
      right[i] = (float)(usfBuffer[i * 2 + 1] / 32768.0f);
    }

    if (usfBuffer.size() >= (size_t)n * 2) {
      usfBuffer.erase(usfBuffer.begin(), usfBuffer.begin() + n * 2);
    } else {
      usfBuffer.clear();
    }

    sampcount += (UINT32)n;
    return;
  }

  if (isVGMStream) {
    if (!vgmstreamContext || !vgmstreamConverterInitialized) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }

    int framesNeeded = n;
    // Loop until we have enough output or stream ends
    while ((int)vgmstreamOutputBuffer.size() < framesNeeded * 2 && !vgmstreamContext->decoder->done) {
      // Decode more data from vgmstream if needed
      if (vgmstreamInputBuffer.empty()) {
        const int decodeFrames = 4096;
        std::vector<int16_t> tempBuffer(decodeFrames * vgmstreamChannels);
        int rendered = libvgmstream_fill(vgmstreamContext, tempBuffer.data(), decodeFrames);
        if (rendered <= 0) {
          break; // no more data or error
        }
        int samplesRendered = rendered * vgmstreamChannels;
        vgmstreamInputBuffer.insert(vgmstreamInputBuffer.end(), tempBuffer.begin(), tempBuffer.begin() + samplesRendered);
      }

      if (!vgmstreamInputBuffer.empty()) {
        ma_uint64 inputFrames = vgmstreamInputBuffer.size() / vgmstreamChannels;
        // Estimate output capacity: worst case upsampling + channel conversion
        size_t outCapacity = (size_t)(inputFrames * (double)gSampleRate / vgmstreamSampleRate) + 256;
        if (outCapacity < 1) outCapacity = 1;
        std::vector<float> outBuffer(outCapacity * 2);
        ma_uint64 inCount = inputFrames;
        ma_uint64 outCount = outCapacity;
        ma_result res = ma_data_converter_process_pcm_frames(&vgmstreamConverter,
            vgmstreamInputBuffer.data(), &inCount,
            outBuffer.data(), &outCount);
        if (res != MA_SUCCESS) {
          break;
        }
        // Remove consumed input samples
        size_t consumedSamples = (size_t)inCount * vgmstreamChannels;
        vgmstreamInputBuffer.erase(vgmstreamInputBuffer.begin(), vgmstreamInputBuffer.begin() + consumedSamples);
        // Append output
        vgmstreamOutputBuffer.insert(vgmstreamOutputBuffer.end(), outBuffer.begin(), outBuffer.begin() + outCount * 2);
      }
    }

    // Copy from vgmstreamOutputBuffer to left/right
    int framesToCopy = framesNeeded;
    int availableFrames = vgmstreamOutputBuffer.size() / 2;
    if (availableFrames < framesToCopy) {
      framesToCopy = availableFrames;
    }
    for (int i = 0; i < framesToCopy; i++) {
      left[i] = vgmstreamOutputBuffer[i * 2];
      right[i] = vgmstreamOutputBuffer[i * 2 + 1];
    }
    // Zero remaining
    for (int i = framesToCopy; i < framesNeeded; i++) {
      left[i] = 0;
      right[i] = 0;
    }
    // Remove copied frames
    vgmstreamOutputBuffer.erase(vgmstreamOutputBuffer.begin(), vgmstreamOutputBuffer.begin() + framesToCopy * 2);

    return;
  }

  /* Use a temporary buffer for Rendering (static to avoid stack issues) */
  enum { MAX_N = 16384 };
  static WAVE_32BS buf[MAX_N];
  int count = (n > MAX_N) ? MAX_N : n;

  if (!player) {
    memset(left, 0, n * sizeof(float));
    memset(right, 0, n * sizeof(float));
    return;
  }

  /* zero buffer before rendering! libvgm resamplers accumulate with += */
  memset(buf, 0, count * sizeof(WAVE_32BS));
  player->Render(count, buf);

  /* convert 24-bit internal (WAVE_32BS.L/R) -> Float32 output (-1.0 to 1.0)
   */
  for (int i = 0; i < count; i++) {
    left[i] = (float)(buf[i].L / 8388608.0);
    right[i] = (float)(buf[i].R / 8388608.0);
  }
}

/* render 16384 stereo samples, split into left/right int16 arrays */
// void FillBuffer3(short *left, short *right) {
// enum { N = 16384 };
// static WAVE_32BS buf[N]; /* static – too large for stack */

/*if (!player) {
  memset(left, 0, N * 2);
  memset(right, 0, N * 2);
  return;
}*/
/* zero buffer before rendering! libvgm resamplers accumulate with += */
// memset(buf, 0, sizeof(buf));

// UINT32 got = player->Render(N, buf);

/* silence remainder */
/*for (UINT32 i = got; i < N; i++) {
  buf[i].L = 0;
  buf[i].R = 0;
}*/

// convert 24-bit internal → 16-bit output (>> 8) with clamp */
/*for (int i = 0; i < N; i++) {
  INT32 l = buf[i].L >> 8;
  INT32 r = buf[i].R >> 8;
  if (l > 32767)
    l = 32767;
  if (l < -32768)
    l = -32768;
  if (r > 32767)
    r = 32767;
  if (r < -32768)
    r = -32768;
  left[i] = (short)l;
  right[i] = (short)r;
}
}*/

/* format: "TrkE|||TrkJ|||GmE|||GmJ|||SysE|||SysJ|||AutE|||AutJ|||Cre|||Notes"
 */
char *ShowTitle(void) {
  if (isPSF || isUSF) {
    PSFINFO *info = isPSF ? psfInfo : usfInfo;
    if (!info)
      return nullptr;

    // Map PSF tags to the positions expected by getVGMTag() in JS
    // We need 22 elements (11 key-value pairs)
    // 0:Title(K), 1:Title(V), 2:GuestTitle(K), 3:GuestTitle(V),
    // 4:Game(K), 5:Game(V), 6:GuestGame(K), 7:GuestGame(V),
    // 8:System(K), 9:System(V), 10:GuestSystem(K), 11:GuestSystem(V),
    // 12:Author(K), 13:Author(V), 14:GuestAuthor(K), 15:GuestAuthor(V),
    // 16:Date(K), 17:Date(V), 18:Creator(K), 19:Creator(V),
    // 20:Notes(K), 21:Notes(V)

    const char *keys[] = {"title",  "", "game", "",      "platform", "",
                          "artist", "", "year", "psfby", "comment"};
    std::string s;
    auto getTag = [&](const char *k) -> const char * {
      if (!k || !*k)
        return "";
      PSFTAG *t = info->tags;
      while (t) {
        if (strcasecmp(t->key, k) == 0)
          return t->value;
        t = t->next;
      }
      return "";
    };

    for (int i = 0; i < 11; i++) {
      s += "Key";
      s += "|||"; // Key (not really used by JS except to skip)
      s += getTag(keys[i]);
      s += "|||"; // Value
    }

    free(titleBuf);
    titleBuf = strdup(s.c_str());
    return titleBuf;
  }
  if (isKSS) {
    if (!gKss)
      return nullptr;
    const char *title = KSS_get_title(gKss);
    const char *trackTitle = kssTrackTitle(gKss, gKssTrackIndex);
    std::string s;
    for (int i = 0; i < 11; i++) {
      s += "Key";
      s += "|||";
      if (i == 0) {
        const char *useTitle =
            (trackTitle && trackTitle[0]) ? trackTitle : title;
        s += (useTitle ? useTitle : "");
      } else if (i == 2) {
        s += (title ? title : "");
      } else if (i == 4) {
        s += kssSystemName(gKss->mode);
      } else
        s += "";
      s += "|||";
    }

    free(titleBuf);
    titleBuf = strdup(s.c_str());
    return titleBuf;
  }
  if (isGME) {
    if (!gmeEmu)
      return nullptr;
    if (gmeInfo) {
      gme_free_info(gmeInfo);
      gmeInfo = nullptr;
    }
    if (gme_track_info(gmeEmu, &gmeInfo, gmeTrackIndex) != 0 || !gmeInfo)
      return nullptr;

    std::string s;
    for (int i = 0; i < 11; i++) {
      s += "Key";
      s += "|||";
      s += gmeTagByIndex(gmeInfo, i);
      s += "|||";
    }

    free(titleBuf);
    titleBuf = strdup(s.c_str());
    return titleBuf;
  }
  if (isVGMStream) {
    if (!vgmstreamContext) return nullptr;
    
    // Try to get title from vgmstream
    char vgmTitle[256] = {0};
    libvgmstream_title_t titleCfg = {};
    titleCfg.force_title = true;
    titleCfg.remove_extension = true;
    titleCfg.filename = currentVGMStreamPath.c_str();
    if (libvgmstream_get_title(vgmstreamContext, &titleCfg, vgmTitle, sizeof(vgmTitle)) <= 0) {
        vgmTitle[0] = '\0';
    }
    
    // Parse filename for additional metadata if title is empty
    std::string parsedTitle, parsedPlatform, parsedCompany, parsedDate;
    if (vgmTitle[0] == '\0') {
        parseArchiveFilename(currentVGMStreamPath, parsedTitle, parsedPlatform, parsedCompany, parsedDate);
    }
    
    std::string s;
    for (int i = 0; i < 11; i++) {
        s += "Key";
        s += "|||";
        const char* val = "";
        switch (i) {
            case 0: // title
                val = vgmTitle[0] ? vgmTitle : parsedTitle.c_str();
                break;
            case 2: // game
                val = "";
                break;
            case 4: // platform
                val = parsedPlatform.c_str();
                break;
            case 6: // artist
                val = parsedCompany.c_str();
                break;
            case 8: // year
                val = parsedDate.c_str();
                break;
            default:
                val = "";
        }
        s += val;
        s += "|||";
    }
    
    free(titleBuf);
    titleBuf = strdup(s.c_str());
    return titleBuf;
  }
  if (isMA) {
    // Parse track filename for title (use basename only)
    std::string trackPath = currentMAPath;
    size_t lastSlash = trackPath.find_last_of('/');
    if (lastSlash != std::string::npos) {
        trackPath = trackPath.substr(lastSlash + 1);
    }
    std::string trackTitle, trackPlatform, trackCompany, trackDate;
    parseArchiveFilename(trackPath, trackTitle, trackPlatform, trackCompany, trackDate);
    
    // Parse archive filename for additional metadata if available
    std::string archiveTitle, archivePlatform, archiveCompany, archiveDate;
    if (!currentArchiveName.empty()) {
        parseArchiveFilename(currentArchiveName, archiveTitle, archivePlatform, archiveCompany, archiveDate);
    }
    
    // Initialize values with filename parsing
    std::string valTitle = trackTitle;
    std::string valGame = archiveTitle;
    std::string valPlatform = !archivePlatform.empty() ? archivePlatform : trackPlatform;
    std::string valArtist = !archiveCompany.empty() ? archiveCompany : trackCompany;
    std::string valYear = !archiveDate.empty() ? archiveDate : trackDate;
    std::string valCreator = "";
    std::string valNotes = "";
    
    // Try to read FLAC metadata if the file is a FLAC file
    std::map<std::string, std::string> flacTags;
    bool hasFlacTags = false;
#ifdef MA_HAS_FLAC
    std::string lowerPath = currentMAPath;
    std::transform(lowerPath.begin(), lowerPath.end(), lowerPath.begin(), [](unsigned char c) { return std::tolower(c); });
    if (lowerPath.size() > 5 && lowerPath.compare(lowerPath.size() - 5, 5, ".flac") == 0) {
        hasFlacTags = readFlacMetadata(currentMAPath.c_str(), flacTags);
    }
#endif
    
    if (hasFlacTags) {
        auto it = flacTags.find("TITLE");
        if (it != flacTags.end()) valTitle = it->second;
        it = flacTags.find("ALBUM");
        if (it != flacTags.end()) valGame = it->second;
        it = flacTags.find("GENRE");
        if (it != flacTags.end()) valPlatform = it->second;
        it = flacTags.find("ARTIST");
        if (it != flacTags.end()) valArtist = it->second;
        it = flacTags.find("DATE");
        if (it != flacTags.end()) valYear = it->second;
        else {
            it = flacTags.find("YEAR");
            if (it != flacTags.end()) valYear = it->second;
        }
        it = flacTags.find("PUBLISHER");
        if (it != flacTags.end()) valCreator = it->second;
        it = flacTags.find("ORGANIZATION");
        if (it != flacTags.end() && valCreator.empty()) valCreator = it->second;
        it = flacTags.find("COMMENT");
        if (it != flacTags.end()) valNotes = it->second;
        it = flacTags.find("DESCRIPTION");
        if (it != flacTags.end() && valNotes.empty()) valNotes = it->second;
    }
    
    // If year is still empty, try to use file modification timestamp as fallback
    if (valYear.empty()) {
        struct stat st;
        if (stat(currentMAPath.c_str(), &st) == 0) {
            std::tm* tm = gmtime(&st.st_mtime); // Use UTC to avoid timezone issues
            if (tm) {
                char yearStr[5];
                snprintf(yearStr, sizeof(yearStr), "%d", tm->tm_year + 1900);
                valYear = yearStr;
            }
        }
    }
    
    // Build the VGMTag string
    std::string s;
    for (int i = 0; i < 11; i++) {
      s += "Key";
      s += "|||";
      const char* val = "";
      switch (i) {
        case 0:  val = valTitle.c_str(); break;
        case 2:  val = valGame.c_str(); break;
        case 4:  val = valPlatform.c_str(); break;
        case 6:  val = valArtist.c_str(); break;
        case 8:  val = valYear.c_str(); break;
        case 9:  val = valCreator.c_str(); break;
        case 10: val = valNotes.c_str(); break;
        default: val = "";
      }
      s += val;
      s += "|||";
    }
    
    free(titleBuf);
    titleBuf = strdup(s.c_str());
    return titleBuf;
  }
  if (!player)
    return nullptr;
  const char *const *t = player->GetTags();
  if (!t)
    return nullptr;

  std::string s;
  while (*t) {
    s += *t;
    s += "|||";
    ++t;
  }

  free(titleBuf);
  titleBuf = strdup(s.c_str());
  return titleBuf;
}

const char *GetChipInfoString(void) {
  if (!player)
    return "";

  std::vector<PLR_DEV_INFO> devs;
  if (player->GetSongDeviceInfo(devs) > 0x01) {
    return "";
  }

  std::string s;
  for (size_t i = 0; i < devs.size(); i++) {
    if (i)
      s += ", ";
    const char *name = (devs[i].devDecl && devs[i].devDecl->name)
                           ? devs[i].devDecl->name(devs[i].devCfg)
                           : "Unknown";
    s += name ? name : "Unknown";
  }

  free(chipBuf);
  chipBuf = strdup(s.c_str());
  return chipBuf;
}

void SetDeviceVolume(int id, int vol) {
  if (player)
    player->SetDeviceVolume(id, vol);
}

const char *GetDeviceName(int id) {
  if (!player)
    return "";
  std::vector<PLR_DEV_INFO> devs;
  if (player->GetSongDeviceInfo(devs) <= 0x01) {
    for (size_t i = 0; i < devs.size(); i++) {
      if (devs[i].id == (UINT32)id) {
        const char *name = (devs[i].devDecl && devs[i].devDecl->name)
                               ? devs[i].devDecl->name(devs[i].devCfg)
                               : "Unknown";
        free(chipBuf);
        chipBuf = strdup(name ? name : "Unknown");
        return chipBuf;
      }
    }
  }
  return "";
}

int GetDeviceVolume(int id) {
  if (!player)
    return 0x100;
  std::vector<PLR_DEV_INFO> devs;
  if (player->GetSongDeviceInfo(devs) <= 0x01) {
    for (size_t i = 0; i < devs.size(); i++) {
      if (devs[i].id == (UINT32)id)
        return devs[i].volume;
    }
  }
  return 0x100;
}

int GetDeviceCount() {
  if (!player)
    return 0;
  std::vector<PLR_DEV_INFO> devs;
  if (player->GetSongDeviceInfo(devs) <= 0x01) {
    std::vector<UINT32> ids;
    for (auto &d : devs) {
      bool found = false;
      for (auto existing : ids) {
        if (existing == d.id) {
          found = true;
          break;
        }
      }
      if (!found)
        ids.push_back(d.id);
    }
    return (int)ids.size();
  }
  return 0;
}

int GetGMETrackCountDirect(const char *path) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return 0;
  Music_Emu *emu = nullptr;
  gme_err_t err = gme_open_file(basePath.c_str(), &emu, (int)gSampleRate);
  if (err || !emu)
    return 0;
  int count = gme_track_count(emu);
  gme_delete(emu);
  return count;
}

int GetKSSTrackCountDirect(const char *path) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return 0;
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (!isKssFormatPath(lowerPath))
    return 0;
  DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
  if (!kssLoader)
    return 0;
  if (DataLoader_Load(kssLoader)) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const UINT8 *fileData = DataLoader_GetData(kssLoader);
  UINT32 fileSize = DataLoader_GetSize(kssLoader);
  if (!fileData || fileSize == 0) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const char *filename = strrchr(basePath.c_str(), '/');
  filename = filename ? filename + 1 : basePath.c_str();
  KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
  if (!kss) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  int count = kss->trk_max - kss->trk_min + 1;
  if (count < 1)
    count = 1;
  KSS_delete(kss);
  DataLoader_Deinit(kssLoader);
  return count;
}

int GetKSSTrackMinDirect(const char *path) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return 0;
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (!isKssFormatPath(lowerPath))
    return 0;
  DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
  if (!kssLoader)
    return 0;
  if (DataLoader_Load(kssLoader)) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const UINT8 *fileData = DataLoader_GetData(kssLoader);
  UINT32 fileSize = DataLoader_GetSize(kssLoader);
  if (!fileData || fileSize == 0) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const char *filename = strrchr(basePath.c_str(), '/');
  filename = filename ? filename + 1 : basePath.c_str();
  KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
  if (!kss) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  int trkMin = kss->trk_min;
  KSS_delete(kss);
  DataLoader_Deinit(kssLoader);
  return trkMin;
}

int GetKSSTrackMaxDirect(const char *path) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return 0;
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (!isKssFormatPath(lowerPath))
    return 0;
  DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
  if (!kssLoader)
    return 0;
  if (DataLoader_Load(kssLoader)) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const UINT8 *fileData = DataLoader_GetData(kssLoader);
  UINT32 fileSize = DataLoader_GetSize(kssLoader);
  if (!fileData || fileSize == 0) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  const char *filename = strrchr(basePath.c_str(), '/');
  filename = filename ? filename + 1 : basePath.c_str();
  KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
  if (!kss) {
    DataLoader_Deinit(kssLoader);
    return 0;
  }
  int trkMax = kss->trk_max;
  KSS_delete(kss);
  DataLoader_Deinit(kssLoader);
  return trkMax;
}

const char *GetKSSTrackNameDirect(const char *path, int trackIndex) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return "";
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (!isKssFormatPath(lowerPath))
    return "";
  DATA_LOADER *kssLoader = FileLoader_Init(basePath.c_str());
  if (!kssLoader)
    return "";
  if (DataLoader_Load(kssLoader)) {
    DataLoader_Deinit(kssLoader);
    return "";
  }
  const UINT8 *fileData = DataLoader_GetData(kssLoader);
  UINT32 fileSize = DataLoader_GetSize(kssLoader);
  if (!fileData || fileSize == 0) {
    DataLoader_Deinit(kssLoader);
    return "";
  }
  const char *filename = strrchr(basePath.c_str(), '/');
  filename = filename ? filename + 1 : basePath.c_str();
  KSS *kss = KSS_bin2kss(const_cast<UINT8 *>(fileData), fileSize, filename);
  if (!kss) {
    DataLoader_Deinit(kssLoader);
    return "";
  }
  int trkMin = kss->trk_min;
  int trkMax = kss->trk_max;
  int trackNum = trkMin + trackIndex;
  if (trackNum < trkMin)
    trackNum = trkMin;
  if (trackNum > trkMax)
    trackNum = trkMax;
  static char nameBuf[256];
  nameBuf[0] = '\0';
  const char *trackTitle = kssTrackTitle(kss, trackNum);
  if (trackTitle && trackTitle[0]) {
    strncpy(nameBuf, trackTitle, 255);
    nameBuf[255] = '\0';
  }
  KSS_delete(kss);
  DataLoader_Deinit(kssLoader);
  return nameBuf;
}

const char *GetGMETrackNameDirect(const char *path, int trackIndex) {
  std::string basePath;
  parseTrackSuffix(path, basePath);
  if (basePath.empty())
    return "";
  Music_Emu *emu = nullptr;
  gme_err_t err = gme_open_file(basePath.c_str(), &emu, (int)gSampleRate);
  if (err || !emu)
    return "";
  gme_info_t *info = nullptr;
  if (gme_track_info(emu, &info, trackIndex) != 0 || !info) {
    if (emu)
      gme_delete(emu);
    return "";
  }
  static char nameBuf[256];
  const char *name = info->song ? info->song : "";
  strncpy(nameBuf, name, 255);
  nameBuf[255] = '\0';
  gme_free_info(info);
  gme_delete(emu);
  return nameBuf;
}

} /* extern "C" */

#ifdef __EMSCRIPTEN__
int main(int, char **) {
  // Initialization moved to JS to avoid CSP issues with EM_ASM
  return 0;
}
#endif
