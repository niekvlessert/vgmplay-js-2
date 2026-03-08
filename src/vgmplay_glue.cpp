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
#include "../modules/sexypsf/driver.h"
void psxShutdown(void);
}
#include "../modules/game-music-emu/gme/gme.h"
#include "../modules/lazyusf/usf.h"
#include "miniaudio.h"

/* ---- globals ---- */
static VGMPlayer *player = nullptr;
static DATA_LOADER *loader = nullptr;
static char *titleBuf = nullptr;
static char *chipBuf = nullptr;
static UINT32 gSampleRate = 44100;

/* ---- SexyPSF globals ---- */
static bool isPSF = false;
static PSFINFO *psfInfo = nullptr;
static std::vector<float> psfBufferL;
static std::vector<float> psfBufferR;
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

static bool isMA = false;
static ma_decoder gMaDecoder;
static bool gMaInitialized = false;

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
    if (kss->info[i].title && kss->info[i].title[0]) {
      return kss->info[i].title;
    }
  }
  return "";
}

extern "C" {
int stop_sexy_execute = 0; // Declare stop_sexy_execute here

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
  if (psfBufferL.size() >= 4096)
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
    psfBufferL.clear();
    psfBufferR.clear();
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
  if (isMA) {
    if (gMaInitialized) {
      ma_decoder_uninit(&gMaDecoder);
      gMaInitialized = false;
    }
    isMA = false;
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
  if (isKSS && gKssPlay) {
    UINT64 totalMs = (UINT64)sec * 1000 + (UINT64)ms;
    UINT32 sample = (UINT32)((totalMs * gSampleRate) / 1000);
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
  if (!player)
    return;
  player->Seek(sec, ms);
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
    sampcount = 0;
    psfBufferL.clear();
    psfBufferR.clear();
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
    printf("DEBUG: Opening audio file: %s (sampleRate: %d)\n", path,
           (int)gSampleRate);
    FILE *f = fopen(path, "rb");
    if (!f) {
      printf("DEBUG: Error: Could not fopen file: %s\n", path);
      return 0;
    }
    fclose(f);

    ma_decoder_config config =
        ma_decoder_config_init(ma_format_f32, 2, gSampleRate);
    ma_result res = ma_decoder_init_file(path, &config, &gMaDecoder);
    if (res != MA_SUCCESS) {
      printf("DEBUG: Error: ma_decoder_init_file failed with result: %d\n",
             (int)res);
      return 0;
    }
    printf("DEBUG: Successfully initialized miniaudio decoder for: %s\n", path);
    isMA = true;
    gMaInitialized = true;
    return 1;
  }

  /* 1. load file data via FileLoader */
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

  // For non-PSF, we'd need to load the file and use VGMPlayer::GetTags.
  // This is heavier but possible. For now, focus on PSF.
  return "";
}

void FillBuffer2(float *left, float *right, int n) {
  if (n <= 0)
    return;

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
    int max_exec = 10000; // Increased limit for slower WASM execution
    while ((int)psfBufferL.size() < n && max_exec-- > 0) {
      stop_sexy_execute = 0;
      sexy_execute();
      // If SexyPSF didn't add any samples, it might be the end or an error.
      // Break to avoid infinite loop.
      if (psfBufferL.size() < n && psfInfo &&
          sampcount >= psfInfo->length * 44.1) {
        break;
      }
    }
    if (max_exec <= 0) {
    }
    int available = (int)psfBufferL.size();
    int toCopy = (available < n) ? available : n;
    for (int i = 0; i < toCopy; i++) {
      left[i] = psfBufferL[i];
      right[i] = psfBufferR[i];
    }
    // Zero out remaining if any
    for (int i = toCopy; i < n; i++) {
      left[i] = 0;
      right[i] = 0;
    }
    if (toCopy > 0) {
      psfBufferL.erase(psfBufferL.begin(), psfBufferL.begin() + toCopy);
      psfBufferR.erase(psfBufferR.begin(), psfBufferR.begin() + toCopy);
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
