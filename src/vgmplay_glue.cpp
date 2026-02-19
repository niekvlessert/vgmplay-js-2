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

/* ---- globals ---- */
static VGMPlayer *player = nullptr;
static DATA_LOADER *loader = nullptr;
static char *titleBuf = nullptr;
static char *chipBuf = nullptr;
static UINT32 gSampleRate = 44100;

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

  /* 1. load file data via FileLoader */
  loader = FileLoader_Init(path);
  if (!loader) {
    printf("glue: FileLoader_Init failed for '%s'\n", path);
    return 0;
  }
  if (DataLoader_Load(loader)) {
    printf("glue: DataLoader_Load failed for '%s'\n", path);
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
    printf("glue: LoadFile failed for '%s'\n", path);
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
  if (!player)
    return 1;
  return (player->GetState() & PLAYSTATE_END) ? 1 : 0;
}

int GetTrackLength(void) {
  if (!player)
    return 0;
  return (int)player->Tick2Sample(player->GetTotalTicks());
}

int GetLoopPoint(void) {
  if (!player)
    return 0;
  return (int)player->Tick2Sample(player->GetLoopTicks());
}

void FillBuffer2(short *left, short *right) {
  enum { N = 16384 };
  static WAVE_32BS buf[N];

  memset(buf, 0, sizeof(buf));
  player->Render(N, buf);

  for (int i = 0; i < N; i++) {
    left[i] = (short)(buf[i].L >> 8);
    right[i] = (short)(buf[i].R >> 8);
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
  if (!player)
    return nullptr;
  const char *const *t = player->GetTags();
  /*while (*t) {
    fprintf(stderr, "%s: %s\n", t[0], t[1]);
    t += 2;
  }
  */
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
  // printf("%s\n", titleBuf);
  return titleBuf;
}

const char *GetChipInfoString(void) {
  if (!player)
    return "";

  std::vector<PLR_DEV_INFO> devs;
  if (player->GetSongDeviceInfo(devs)) {
    // printf("glue: GetSongDeviceInfo failed\n");
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

} /* extern "C" */

int main(int, char **) {
  EM_ASM({
    if (typeof vgmplay_js != = 'undefined' && vgmplay_js.loadWhenReady)
      vgmplay_js.loadWhenReady();
  });
  return 0;
}
