/*
 * vgmplay_glue.cpp
 *
 * Glue layer between Emscripten/JS and libvgm.
 * Replaces legacy src/main.c.
 */

#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>

#include "../modules/libvgm/emu/EmuStructs.h"
#include "../modules/libvgm/emu/Resampler.h"
#include "../modules/libvgm/player/playerbase.hpp"
#include "../modules/libvgm/player/vgmplayer.hpp"
#include "../modules/libvgm/utils/DataLoader.h"
#include "../modules/libvgm/utils/FileLoader.h"

extern "C" {
#include "../modules/sexypsf/driver.h"
}

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

extern "C" {
int stop_sexy_execute = 0; // Declare stop_sexy_execute here

/* ---- SexyPSF callbacks ---- */
void SPUirq(void) {} // Dummy SPU IRQ for SexyPSF
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
  if (isPSF) {
    if (psfInfo) {
      sexy_freepsfinfo(psfInfo);
      psfInfo = nullptr;
    }
    sexy_stop();
    isPSF = false;
    psfBufferL.clear();
    psfBufferR.clear();
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
  if (!player)
    return;
  player->Seek(sec, ms);
}

int OpenVGMFile(const char *path) {
  cleanup();

  /* Detect PSF by extension */
  std::string sPath(path);
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

  /* 3. set player-specific options (playbackHz = 0 means "no speed correction")
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
  if (isPSF) {
    return (psfInfo && sampcount >= psfInfo->length * 44.1) ? 1 : 0;
  }
  if (!player)
    return 1;
  return (player->GetState() & PLAYSTATE_END) ? 1 : 0;
}

int GetTrackLength(void) {
  if (isPSF) {
    return psfInfo ? (int)(psfInfo->length * 44.1) : 0;
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
  std::string lowerPath = path;
  for (auto &c : lowerPath)
    c = tolower(c);
  if (lowerPath.find(".psflib") != std::string::npos)
    return 0;
  if (lowerPath.find(".psf") != std::string::npos ||
      lowerPath.find(".minipsf") != std::string::npos) {
    PSFINFO *info = sexy_getpsfinfo((char *)path);
    if (!info) {
      return 0;
    }
    int length =
        (int)((info->length / 1000.0) * 44100); // ms to samples at 44.1kHz
    sexy_freepsfinfo(info);
    return length;
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

void FillBuffer2(float *left, float *right, int n) {
  if (n <= 0)
    return;

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

  /* convert 24-bit internal (WAVE_32BS.L/R) -> Float32 output (-1.0 to 1.0) */
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
  if (isPSF) {
    if (!psfInfo)
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
      PSFTAG *t = psfInfo->tags;
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

} /* extern "C" */

int main(int, char **) {
  // Initialization moved to JS to avoid CSP issues with EM_ASM
  return 0;
}
