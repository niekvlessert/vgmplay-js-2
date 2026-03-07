/*
 * vgmplay_minimal_glue.cpp
 *
 * Minimal Glue layer between Emscripten/JS and libvgm.
 * Supports only core libvgm (VGM/VGZ) formats.
 */

#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <zlib.h>

#include "../modules/libvgm/emu/EmuStructs.h"
#include "../modules/libvgm/emu/Resampler.h"
#include "../modules/libvgm/player/playerbase.hpp"
#include "../modules/libvgm/player/vgmplayer.hpp"
#include "../modules/libvgm/utils/DataLoader.h"
#include "../modules/libvgm/utils/FileLoader.h"
#include "miniaudio.h"

/* ---- globals ---- */
static VGMPlayer *player = nullptr;
static DATA_LOADER *loader = nullptr;
static char *titleBuf = nullptr;
static char *chipBuf = nullptr;
static UINT32 gSampleRate = 44100;

static bool isMA = false;
static ma_decoder gMaDecoder;
static bool gMaInitialized = false;

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
  if (player) {
    player->Stop();
    player->UnloadFile();
    delete player;
    player = nullptr;
  }
  if (gMaInitialized) {
    ma_decoder_uninit(&gMaDecoder);
    gMaInitialized = false;
  }
  isMA = false;
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

extern "C" {

void SetSampleRate(unsigned int rate) {
  gSampleRate = rate;
  if (player)
    player->SetSampleRate(rate);
}

void SetLoopCount(unsigned int loops) {
  // Not implemented for minimal build
}

void Seek(unsigned int sec, unsigned int ms) {
  if (!player)
    return;
  player->Seek(sec, ms);
}

int OpenVGMFile(const char *path) {
  cleanup();

  /* 1. load file data via FileLoader */
  loader = FileLoader_Init(path);
  if (!loader) {
    return 0;
  }
  if (DataLoader_Load(loader)) {
    return 0;
  }

  std::string basePath;
  parseTrackSuffix(path, basePath);
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);

  if (lowerPath.size() > 4 &&
      (lowerPath.substr(lowerPath.size() - 4) == ".wav" ||
       lowerPath.substr(lowerPath.size() - 4) == ".mp3" ||
       lowerPath.substr(lowerPath.size() - 4) == ".ogg" ||
       lowerPath.substr(lowerPath.size() - 5) == ".flac")) {
    ma_decoder_config config =
        ma_decoder_config_init(ma_format_f32, 2, gSampleRate);
    ma_result result =
        ma_decoder_init_file(basePath.c_str(), &config, &gMaDecoder);
    if (result != MA_SUCCESS) {
      printf("miniaudio: Failed to load %s (Error: %d)\n", basePath.c_str(),
             result);
      return 0;
    }
    isMA = true;
    gMaInitialized = true;
    return 1;
  }

  /* 2. create player & set sample rate BEFORE LoadFile */
  player = new VGMPlayer();

  player->SetSampleRate(gSampleRate);
  player->SetFileReqCallback(RequestFileCallback, NULL);

  /* 3. set player-specific options */
  VGM_PLAY_OPTIONS opts;
  memset(&opts, 0, sizeof(opts));
  opts.playbackHz = 0;
  player->SetPlayerOptions(opts);

  /* 4. load */
  if (player->LoadFile(loader)) {
    return 0;
  }

  /* 5. set sample rate again and start */
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
  if (!player)
    return 1;
  return (player->GetState() & PLAYSTATE_END) ? 1 : 0;
}

int GetTrackLength(void) {
  if (isMA && gMaInitialized) {
    ma_uint64 lengthFrames;
    if (ma_decoder_get_length_in_pcm_frames(&gMaDecoder, &lengthFrames) ==
        MA_SUCCESS) {
      return (int)lengthFrames;
    }
    return 180000;
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
  // Minimal build doesn't support complex tag retrieval for other formats
  return "";
}

const char *ShowTitle(void) {
  if (!player)
    return "";

  const char *const *t = player->GetTags();
  if (!t)
    return "";

  std::string s;
  while (*t) {
    s += *t;
    s += "|||";
    ++t;
  }

  if (titleBuf)
    free(titleBuf);
  titleBuf = strdup(s.c_str());
  return titleBuf;
}

const char *GetChipInfoString(void) {
  if (!player)
    return "";

  std::vector<PLR_DEV_INFO> devs;
  player->GetSongDeviceInfo(devs);

  std::string s;
  for (size_t i = 0; i < devs.size(); i++) {
    if (i)
      s += ", ";
    const char *name = (devs[i].devDecl && devs[i].devDecl->name)
                           ? devs[i].devDecl->name(devs[i].devCfg)
                           : "Unknown";
    s += name ? name : "Unknown";
  }

  if (chipBuf)
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
  player->GetSongDeviceInfo(devs);
  for (size_t i = 0; i < devs.size(); i++) {
    if (devs[i].id == (UINT32)id) {
      const char *name = (devs[i].devDecl && devs[i].devDecl->name)
                             ? devs[i].devDecl->name(devs[i].devCfg)
                             : "Unknown";
      if (chipBuf)
        free(chipBuf);
      chipBuf = strdup(name ? name : "Unknown");
      return chipBuf;
    }
  }
  return "";
}

int GetDeviceVolume(int id) {
  if (!player)
    return 0x100;
  std::vector<PLR_DEV_INFO> devs;
  player->GetSongDeviceInfo(devs);
  for (size_t i = 0; i < devs.size(); i++) {
    if (devs[i].id == (UINT32)id)
      return devs[i].volume;
  }
  return 0x100;
}

int GetDeviceCount() {
  if (!player)
    return 0;
  std::vector<PLR_DEV_INFO> devs;
  player->GetSongDeviceInfo(devs);
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

const char *GetVGMTag(int tagIndex) { return ""; }

void FillBuffer2(float *left, float *right, int n) {
  if (n <= 0)
    return;

  if (isMA) {
    if (!gMaInitialized) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    std::vector<float> tmp(n * 2);
    ma_uint64 framesRead;
    ma_result result = ma_decoder_read_pcm_frames(&gMaDecoder, tmp.data(),
                                                  (ma_uint64)n, &framesRead);

    for (ma_uint64 i = 0; i < framesRead; i++) {
      left[i] = tmp[i * 2];
      right[i] = tmp[i * 2 + 1];
    }
    for (ma_uint64 i = framesRead; i < (ma_uint64)n; i++) {
      left[i] = 0;
      right[i] = 0;
    }
    return;
  }

  if (!player) {
    if (n > 0) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
    }
    return;
  }

  std::vector<WAVE_32BS> samples(n);
  player->Render(n, samples.data());

  for (int i = 0; i < n; i++) {
    left[i] = (float)(samples[i].L / 2147483648.0);
    right[i] = (float)(samples[i].R / 2147483648.0);
  }
}

void FillBuffer(float *buf, int n) {
  if (n <= 0 || !player) {
    if (n > 0)
      memset(buf, 0, n * 2 * sizeof(float));
    return;
  }
  std::vector<WAVE_32BS> samples(n);
  player->Render(n, samples.data());

  for (int i = 0; i < n; i++) {
    buf[i * 2] = (float)(samples[i].L / 2147483648.0);
    buf[i * 2 + 1] = (float)(samples[i].R / 2147483648.0);
  }
}

int IsVGMPlaying(void) {
  if (!player)
    return 0;
  return (player->GetState() & PLAYSTATE_PLAY) ? 1 : 0;
}

} // extern "C"

int main(int, char **) { return 0; }
