/*
 * vgmplay_glue.cpp
 *
 * Glue layer between Emscripten/JS and libvgm.
 * Replaces legacy src/main.c.
 */

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <malloc.h>
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <zlib.h>

#include "../modules/libkss/src/kss/kss.h"
#include "../modules/libkss/src/kssplay.h"
#include "../modules/libkss/src/vm/vm.h"
#include "../modules/libvgm/emu/EmuStructs.h"
#include "../modules/libvgm/emu/Resampler.h"
#include "../modules/libvgm/player/playerbase.hpp"
#include "../modules/libvgm/player/vgmplayer.hpp"
#define MT32EMU_API_TYPE 1
#include "c_interface/c_interface.h"
#define BW_MidiSequencer AdlMidiSequencer
#include "../modules/adlmidi/src/midi_sequencer.hpp"
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
#include "../modules/openmpt/libopenmpt/libopenmpt.h"
#include "../modules/adlmidi/include/adlmidi.h"
#ifndef BUILD_CROSS_PLATFORM
#define BUILD_CROSS_PLATFORM
#endif
#include "../modules/monkeys-audio/src/Shared/All.h"
#include "../modules/monkeys-audio/src/Shared/CharacterHelper.h"
#include "../modules/monkeys-audio/src/MACLib/MACLib.h"
#include "miniaudio.h"
#include <map>
#include <algorithm>
#include <ctime>
#include <sys/stat.h>
#include <cctype>

extern "C" {
#include "../modules/vgmstream/src/libvgmstream.h"
#include "../modules/vgmstream/src/libvgmstream_streamfile.h"
#include "../modules/vgmstream/src/base/api_internal.h"
#include "../modules/vgmstream/src/vgmstream.h"
#include "../modules/vgmstream/src/base/plugins.h"
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
static openmpt_module *gOpenMpt = nullptr;
static bool isOpenMPT = false;
static bool openmptEnded = false;
static double openmptDurationSec = 0.0;
static std::string currentOpenMptPath;
static bool debugMode = false;
static bool vgmstreamLoopEnabled = false;

static bool isMUS = false;
static musdoom_emulator_t *musEmu = nullptr;
static std::vector<uint8_t> genmidiData;
static std::vector<uint8_t> musData;

static bool isAPE = false;
static IAPEDecompress *apeDecompress = nullptr;
static int apeSampleRate = 0;
static int apeChannels = 0;
static int apeBitsPerSample = 0;
static int apeBytesPerSample = 0;
static int apeTotalBlocks = 0;
static bool apeEnded = false;
static ma_data_converter apeConverter;
static bool apeConverterInitialized = false;
static std::vector<int16_t> apeInputBuffer;
static std::vector<float> apeOutputBuffer;

static bool isADLMIDI = false;
static ADL_MIDIPlayer* adlPlayer = nullptr;
static std::string currentMidiEngine = "adlmidi";

bool isMunt = false;
bool mt32Enabled = false;
mt32emu_context mt32Ctx = nullptr;
BW_MidiSequencer* mt32Smf = nullptr;
BW_MidiRtInterface mt32RtInterface;
std::string muntControlRomPath = "/MT32_CONTROL.ROM";
std::string muntPcmRomPath = "/MT32_PCM.ROM";
static std::string muntGroupId;

void mt32RtNoteOn(void* userData, uint8_t channel, uint8_t note, uint8_t velocity) {
    mt32emu_play_msg((mt32emu_context)userData, 0x90 | channel | ((uint32_t)note << 8) | ((uint32_t)velocity << 16));
}
void mt32RtNoteOff(void* userData, uint8_t channel, uint8_t note) {
    mt32emu_play_msg((mt32emu_context)userData, 0x80 | channel | ((uint32_t)note << 8));
}
void mt32RtNoteOffVel(void* userData, uint8_t channel, uint8_t note, uint8_t velocity) {
    mt32emu_play_msg((mt32emu_context)userData, 0x80 | channel | ((uint32_t)note << 8) | ((uint32_t)velocity << 16));
}
void mt32RtNoteAfterTouch(void* userData, uint8_t channel, uint8_t note, uint8_t pressure) {
    mt32emu_play_msg((mt32emu_context)userData, 0xA0 | channel | ((uint32_t)note << 8) | ((uint32_t)pressure << 16));
}
void mt32RtChannelAfterTouch(void* userData, uint8_t channel, uint8_t pressure) {
    mt32emu_play_msg((mt32emu_context)userData, 0xD0 | channel | ((uint32_t)pressure << 8));
}
void mt32RtControllerChange(void* userData, uint8_t channel, uint8_t controller, uint8_t value) {
    mt32emu_play_msg((mt32emu_context)userData, 0xB0 | channel | ((uint32_t)controller << 8) | ((uint32_t)value << 16));
}
void mt32RtPatchChange(void* userData, uint8_t channel, uint8_t patch) {
    mt32emu_play_msg((mt32emu_context)userData, 0xC0 | channel | ((uint32_t)patch << 8));
}
void mt32RtPitchBend(void* userData, uint8_t channel, uint8_t msb, uint8_t lsb) {
    mt32emu_play_msg((mt32emu_context)userData, 0xE0 | channel | ((uint32_t)lsb << 8) | ((uint32_t)msb << 16));
}
void mt32RtSysEx(void* userData, const uint8_t* data, size_t size) {
    if (!data || size == 0) {
        return;
    }
    // mt32emu_play_sysex expects a well-formed SysEx (starts with 0xF0 and ends with 0xF7).
    // SMF SysEx events often omit the trailing 0xF7 in the payload; normalize to avoid garbage.
    if (data[0] == 0xF0) {
        if (data[size - 1] == 0xF7) {
            mt32emu_play_sysex((mt32emu_context)userData, data, (mt32emu_bit32u)size);
            return;
        }
        std::vector<uint8_t> tmp;
        tmp.reserve(size + 1);
        tmp.insert(tmp.end(), data, data + size);
        tmp.push_back(0xF7);
        mt32emu_play_sysex((mt32emu_context)userData, tmp.data(), (mt32emu_bit32u)tmp.size());
        return;
    }
    // For escape/continuation SysEx (0xF7) or other non-standard payloads, wrap.
    std::vector<uint8_t> tmp;
    tmp.reserve(size + 2);
    tmp.push_back(0xF0);
    tmp.insert(tmp.end(), data, data + size);
    if (tmp.back() != 0xF7) {
        tmp.push_back(0xF7);
    }
    mt32emu_play_sysex((mt32emu_context)userData, tmp.data(), (mt32emu_bit32u)tmp.size());
}

extern "C" bool CheckMuntRoms() {
    FILE* f1 = fopen(muntControlRomPath.c_str(), "rb");
    bool controlOk = (f1 != nullptr);
    if (f1) fclose(f1);
    FILE* f2 = fopen(muntPcmRomPath.c_str(), "rb");
    bool pcmOk = (f2 != nullptr);
    if (f2) fclose(f2);
    return controlOk && pcmOk;
}

void DeinitMunt() {
  if (mt32Ctx) {
    mt32emu_free_context(mt32Ctx);
    mt32Ctx = nullptr;
  }
  if (mt32Smf) {
    delete mt32Smf;
    mt32Smf = nullptr;
  }
  isMunt = false;
  mt32Enabled = false;
  muntGroupId.clear();
}

bool InitializeMunt() {
  DeinitMunt();
  if (!CheckMuntRoms()) {
      printf("InitializeMunt: ROMs missing\n");
      return false;
  }

  mt32emu_report_handler_i report_handler;
  report_handler.v0 = nullptr;
  mt32Ctx = mt32emu_create_context(report_handler, nullptr);
  if (!mt32Ctx) {
      printf("InitializeMunt: mt32emu_create_context failed\n");
      return false;
  }

  auto loadRom = [](const std::string& path, mt32emu_context ctx, bool isControl) -> bool {
    FILE *f = fopen(path.c_str(), "rb");
    if (!f) { printf("loadRom: cannot open '%s'\n", path.c_str()); return false; }
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    unsigned char* data = (unsigned char*)malloc(size);
    fread(data, 1, size, f);
    fclose(f);
    
    mt32emu_return_code rc;
    rc = mt32emu_add_rom_data(ctx, (const mt32emu_bit8u*)data, (size_t)size, nullptr);
    free(data);
    printf("loadRom: '%s' -> rc=%d (ROM_NOT_IDENTIFIED=%d)\n", path.c_str(), rc, MT32EMU_RC_ROM_NOT_IDENTIFIED);
    // Success codes are RC_ADDED_CONTROL_ROM(1), RC_ADDED_PCM_ROM(2), RC_ADDED_PARTIAL_*
    // Failure is RC_ROM_NOT_IDENTIFIED(-1)
    return rc != MT32EMU_RC_ROM_NOT_IDENTIFIED;
  };

  if (!loadRom(muntControlRomPath, mt32Ctx, true)) {
      DeinitMunt();
      return false;
  }
  if (!loadRom(muntPcmRomPath, mt32Ctx, false)) {
      DeinitMunt();
      return false;
  }

  mt32emu_set_stereo_output_samplerate(mt32Ctx, (double)gSampleRate);
  mt32emu_set_samplerate_conversion_quality(mt32Ctx, MT32EMU_SRCQ_BEST);

  if (mt32emu_open_synth(mt32Ctx) != MT32EMU_RC_OK) {
      printf("InitializeMunt: mt32emu_open_synth failed\n");
      DeinitMunt();
      return false;
  }

  // Setup sequencer interface
  memset(&mt32RtInterface, 0, sizeof(BW_MidiRtInterface));
  mt32RtInterface.rtUserData = mt32Ctx;
  mt32RtInterface.rt_noteOn = mt32RtNoteOn;
  mt32RtInterface.rt_noteOff = mt32RtNoteOff;
  mt32RtInterface.rt_noteOffVel = mt32RtNoteOffVel;
  mt32RtInterface.rt_noteAfterTouch = mt32RtNoteAfterTouch;
  mt32RtInterface.rt_channelAfterTouch = mt32RtChannelAfterTouch;
  mt32RtInterface.rt_controllerChange = mt32RtControllerChange;
  mt32RtInterface.rt_patchChange = mt32RtPatchChange;
  mt32RtInterface.rt_pitchBend = mt32RtPitchBend;
  mt32RtInterface.rt_systemExclusive = mt32RtSysEx;

  mt32Smf = new BW_MidiSequencer();
  mt32Smf->setInterface(&mt32RtInterface);

  isMunt = true;
  mt32Enabled = true;
  printf("InitializeMunt: Success!\n");
  return true;
}

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
static bool vgmstreamHasNativeLoop = false;
static bool vgmstreamInputBufferDirty = false;
static std::string currentVGMStreamPath;

// Helper: parse archive filenames like "Game (date)(Team)(Company)[Platform].ext"
static void parseArchiveFilename(const std::string& filename, std::string& outTitle, std::string& outPlatform, std::string& outCompany, std::string& outDate) {
    outTitle.clear(); outPlatform.clear(); outCompany.clear(); outDate.clear();
    
    std::string name = filename;
    // Remove extension
    size_t dot = name.rfind('.');
    if (dot != std::string::npos) name = name.substr(0, dot);
    
    // Find first '(' or '['
    size_t p1 = name.find('(');
    size_t b0 = name.find('[');
    if (p1 == std::string::npos && b0 == std::string::npos) {
        outTitle = name;
        return;
    }

    // Title: everything before first '(' or '[' (trimmed)
    size_t titleEnd = std::string::npos;
    if (p1 != std::string::npos && b0 != std::string::npos) titleEnd = std::min(p1, b0);
    else if (p1 != std::string::npos) titleEnd = p1;
    else titleEnd = b0;
    outTitle = name.substr(0, titleEnd);
    size_t start = outTitle.find_first_not_of(" \t");
    size_t end = outTitle.find_last_not_of(" \t");
    if (start != std::string::npos && end != std::string::npos) outTitle = outTitle.substr(start, end-start+1);

    // Platform: last [...]
    size_t b1 = name.rfind('[');
    if (b1 != std::string::npos) {
        size_t b2 = name.find(']', b1);
        if (b2 != std::string::npos) {
            outPlatform = name.substr(b1 + 1, b2 - b1 - 1);
            start = outPlatform.find_first_not_of(" \t");
            end = outPlatform.find_last_not_of(" \t");
            if (start != std::string::npos && end != std::string::npos) outPlatform = outPlatform.substr(start, end - start + 1);
        }
    }

    // Collect all (...) groups after title and before platform
    std::vector<std::string> groups;
    size_t searchPos = titleEnd;
    size_t limit = (b1 != std::string::npos) ? b1 : name.size();
    while (searchPos < limit) {
        size_t o = name.find('(', searchPos);
        if (o == std::string::npos || o >= limit) break;
        size_t c = name.find(')', o + 1);
        if (c == std::string::npos || c > limit) break;
        std::string g = name.substr(o + 1, c - o - 1);
        start = g.find_first_not_of(" \t");
        end = g.find_last_not_of(" \t");
        if (start != std::string::npos && end != std::string::npos) g = g.substr(start, end - start + 1);
        if (!g.empty()) groups.push_back(g);
        searchPos = c + 1;
    }

    // First group is date, remaining are team/company (ignore "-" entries)
    if (!groups.empty()) {
        outDate = groups[0];
        for (size_t i = 1; i < groups.size(); i++) {
            if (groups[i] == "-") continue;
            if (!outCompany.empty()) outCompany += " / ";
            outCompany += groups[i];
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
    struct mallinfo mi = mallinfo();
    return (uint32_t)mi.uordblks;
}

EMSCRIPTEN_KEEPALIVE
uint32_t GetFreeMemory() {
    struct mallinfo mi = mallinfo();
    return (uint32_t)mi.fordblks;
}

EMSCRIPTEN_KEEPALIVE
uint32_t GetHeapTopUsedMemory() {
    return (uint32_t)(*emscripten_get_sbrk_ptr());
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

static void cleanup(bool keepVGMPlayer) {
  if (isADLMIDI) {
    if (adlPlayer) {
      adl_close(adlPlayer);
      adlPlayer = nullptr;
    }
    isADLMIDI = false;
  }
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
  if (isOpenMPT) {
    if (gOpenMpt) {
      openmpt_module_destroy(gOpenMpt);
      gOpenMpt = nullptr;
    }
    isOpenMPT = false;
    openmptEnded = false;
    openmptDurationSec = 0.0;
    currentOpenMptPath.clear();
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
  if (isAPE) {
    if (apeDecompress) {
      delete apeDecompress;
      apeDecompress = nullptr;
    }
    if (apeConverterInitialized) {
      ma_data_converter_uninit(&apeConverter, NULL);
      apeConverterInitialized = false;
    }
    apeInputBuffer.clear();
    apeOutputBuffer.clear();
    apeSampleRate = 0;
    apeChannels = 0;
    apeBitsPerSample = 0;
    apeBytesPerSample = 0;
    apeTotalBlocks = 0;
    apeEnded = false;
    isAPE = false;
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
    vgmstreamHasNativeLoop = false;
    vgmstreamInputBufferDirty = false;
  }
  if (player) {
    player->Stop();
    player->UnloadFile();
    if (!keepVGMPlayer) {
      delete player;
      player = nullptr;
    }
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

static std::string getMuntGroupIdFromPath(const std::string &path) {
  // Use parent directory as a best-effort "game" grouping for MIDI files.
  size_t slash = path.find_last_of('/');
  if (slash == std::string::npos)
    return "";
  return path.substr(0, slash);
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

static bool isOpenMptFormatPath(const std::string &lowerPath) {
  return (lowerPath.find(".mod") != std::string::npos ||
          lowerPath.find(".s3m") != std::string::npos ||
          lowerPath.find(".xm") != std::string::npos ||
          lowerPath.find(".it") != std::string::npos ||
          lowerPath.find(".itp") != std::string::npos ||
          lowerPath.find(".mptm") != std::string::npos ||
          lowerPath.find(".stm") != std::string::npos ||
          lowerPath.find(".mtm") != std::string::npos ||
          lowerPath.find(".669") != std::string::npos ||
          lowerPath.find(".amf") != std::string::npos ||
          lowerPath.find(".dmf") != std::string::npos ||
          lowerPath.find(".far") != std::string::npos ||
          lowerPath.find(".imf") != std::string::npos ||
          lowerPath.find(".med") != std::string::npos ||
          lowerPath.find(".okt") != std::string::npos ||
          lowerPath.find(".ptm") != std::string::npos ||
          lowerPath.find(".ult") != std::string::npos ||
          lowerPath.find(".umx") != std::string::npos);
}

static std::string openmptGetMetadata(openmpt_module *mod, const char *key) {
  if (!mod || !key)
    return "";
  const char *val = openmpt_module_get_metadata(mod, key);
  if (!val)
    return "";
  std::string out = val;
  openmpt_free_string(val);
  return out;
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

void SetMidiEngine(const char* engine) {
  if (!engine) {
    currentMidiEngine.clear();
    DeinitMunt();
    return;
  }
  std::string newEngine = engine;
  printf("SetMidiEngine: engine choice stored: '%s'\n", newEngine.c_str());
  // If switching away from munt, deinit immediately
  if (newEngine != "munt") {
    DeinitMunt();
  }
  currentMidiEngine = newEngine;
}

void SetLoopCount(unsigned int loops) {
  /* libvgm VGMPlayer doesn't expose a simple loop-count setter;
     the higher-level PlayerA does, but we use VGMPlayer directly.
     Ignoring for now – libvgm defaults to looping. */
}


void Seek(unsigned int sec, unsigned int ms) {
  UINT64 totalMs = (UINT64)sec * 1000 + (UINT64)ms;
  UINT32 sample = (UINT32)((totalMs * gSampleRate) / 1000);

  if (isOpenMPT && gOpenMpt) {
    openmpt_module_set_position_seconds(gOpenMpt, (double)totalMs / 1000.0);
    openmptEnded = false;
    return;
  }
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
  if (isADLMIDI) {
    if (adlPlayer) {
      adl_positionSeek(adlPlayer, (double)totalMs / 1000.0);
    }
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
      vgmstreamInputBufferDirty = true;
    }
    return;
  }
  if (isAPE && apeDecompress) {
    if (apeSampleRate > 0) {
      int64_t targetBlock = (int64_t)sample * (int64_t)apeSampleRate / (int64_t)gSampleRate;
      if (targetBlock < 0) targetBlock = 0;
      if (apeTotalBlocks > 0 && targetBlock > apeTotalBlocks) targetBlock = apeTotalBlocks;
      apeDecompress->Seek((int)targetBlock);
      apeInputBuffer.clear();
      apeOutputBuffer.clear();
      if (apeConverterInitialized) {
        ma_data_converter_reset(&apeConverter);
      }
      apeEnded = false;
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
  /* Detect PSF by extension */
  std::string basePath;
  int trackIndex = parseTrackSuffix(path, basePath);
  std::string sPath = basePath;
  std::string lowerPath = basePath;
  for (auto &c : lowerPath)
    c = tolower(c);

  const bool isVgmPath =
      (lowerPath.size() > 4 &&
       (lowerPath.substr(lowerPath.size() - 4) == ".vgm" ||
        lowerPath.substr(lowerPath.size() - 4) == ".vgz"));
  cleanup(isVgmPath);
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

  if (lowerPath.size() > 4 && (lowerPath.find(".ape") != std::string::npos)) {
    int apeError = 0;
    str_utf16 *path16 = GetUTF16FromANSI((const str_ansi *)basePath.c_str());
    apeDecompress = CreateIAPEDecompress(path16, &apeError);
    delete[] path16;
    if (!apeDecompress || apeError != 0) {
      if (apeDecompress) {
        delete apeDecompress;
        apeDecompress = nullptr;
      }
      return 0;
    }
    apeSampleRate = (int)apeDecompress->GetInfo(APE_INFO_SAMPLE_RATE);
    apeChannels = (int)apeDecompress->GetInfo(APE_INFO_CHANNELS);
    apeBitsPerSample = (int)apeDecompress->GetInfo(APE_INFO_BITS_PER_SAMPLE);
    apeBytesPerSample = (int)apeDecompress->GetInfo(APE_INFO_BYTES_PER_SAMPLE);
    apeTotalBlocks = (int)apeDecompress->GetInfo(APE_INFO_TOTAL_BLOCKS);
    apeEnded = false;

    if (apeChannels <= 0 || apeSampleRate <= 0) {
      delete apeDecompress;
      apeDecompress = nullptr;
      return 0;
    }

    ma_data_converter_config convConfig = ma_data_converter_config_init(
        ma_format_s16, ma_format_f32,
        apeChannels, 2,
        apeSampleRate, gSampleRate);
    ma_result res = ma_data_converter_init(&convConfig, NULL, &apeConverter);
    if (res != MA_SUCCESS) {
      delete apeDecompress;
      apeDecompress = nullptr;
      return 0;
    }
    apeConverterInitialized = true;
    apeInputBuffer.clear();
    apeOutputBuffer.clear();
    isAPE = true;
    return 1;
  }

  if (isOpenMptFormatPath(lowerPath)) {
    DATA_LOADER *mptLoader = FileLoader_Init(basePath.c_str());
    if (!mptLoader) {
      return 0;
    }
    if (DataLoader_Load(mptLoader)) {
      DataLoader_Deinit(mptLoader);
      return 0;
    }
    const UINT8 *fileData = DataLoader_GetData(mptLoader);
    UINT32 fileSize = DataLoader_GetSize(mptLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(mptLoader);
      return 0;
    }
    int modErr = 0;
    const char *modErrStr = nullptr;
    openmpt_module *mod = openmpt_module_create_from_memory2(
        fileData, fileSize,
        nullptr, nullptr,
        nullptr, nullptr,
        &modErr, &modErrStr, nullptr);
    DataLoader_Deinit(mptLoader);
    if (!mod) {
      return 0;
    }
    openmpt_module_set_repeat_count(mod, 0);
    gOpenMpt = mod;
    isOpenMPT = true;
    openmptEnded = false;
    openmptDurationSec = openmpt_module_get_duration_seconds(mod);
    currentOpenMptPath = basePath;
    return 1;
  }

  if (lowerPath.size() > 4 &&
      (lowerPath.substr(lowerPath.size() - 4) == ".mid" ||
       lowerPath.substr(lowerPath.size() - 5) == ".midi" ||
       lowerPath.substr(lowerPath.size() - 4) == ".rmi")) {

    const char* midiEngineToUse = currentMidiEngine.empty() ? "adlmidi" : currentMidiEngine.c_str();
    printf("OpenVGMFile: MIDI engine: '%s', isMunt=%d, mt32Smf=%p\n", midiEngineToUse, isMunt, (void*)mt32Smf);
    if (strcmp(midiEngineToUse, "munt") == 0) {
        const std::string newGroupId = getMuntGroupIdFromPath(basePath);
        if (!muntGroupId.empty() && muntGroupId != newGroupId) {
            printf("OpenVGMFile: Munt group changed, resetting MT-32 state\n");
            DeinitMunt();
        }
        // Lazily initialize Munt if not already done
        if (!isMunt || !mt32Smf) {
            printf("OpenVGMFile: Munt not yet initialized, calling InitializeMunt\n");
            // Debug ROM file existence
            FILE* f1 = fopen(muntControlRomPath.c_str(), "rb");
            printf("OpenVGMFile: control ROM '%s' %s\n", muntControlRomPath.c_str(), f1 ? "found" : "NOT FOUND");
            if (f1) fclose(f1);
            FILE* f2 = fopen(muntPcmRomPath.c_str(), "rb");
            printf("OpenVGMFile: pcm ROM '%s' %s\n", muntPcmRomPath.c_str(), f2 ? "found" : "NOT FOUND");
            if (f2) fclose(f2);
            if (!InitializeMunt()) {
                printf("OpenVGMFile: Munt initialization failed, falling back to ADLMIDI\n");
                goto use_adlmidi;
            }
        }
        if (mt32Smf->loadMIDI(basePath.c_str())) {
            gSampleRate = 44100;
            printf("OpenVGMFile: Munt loaded MIDI successfully\n");
            muntGroupId = newGroupId;
            isADLMIDI = false;
            return 1;
        }
        printf("OpenVGMFile: Munt failed to load MIDI, falling back to ADLMIDI\n");
    }

    use_adlmidi:
    if (currentMidiEngine.empty() || currentMidiEngine == "adlmidi" || strcmp(midiEngineToUse, "munt") != 0 || (strcmp(midiEngineToUse, "munt") == 0 && !isMunt)) {
      adlPlayer = adl_init((long)gSampleRate);
      if (!adlPlayer) {
        return 0;
      }
      adl_setNumChips(adlPlayer, 2);
      adl_setBank(adlPlayer, 14);
      adl_setSoftPanEnabled(adlPlayer, 1);
      if (adl_openFile(adlPlayer, basePath.c_str()) != 0) {
        adl_close(adlPlayer);
        adlPlayer = nullptr;
        return 0;
      }
      isADLMIDI = true;
      return 1;
    }
  }

  /* 1. load file data via FileLoader */
  if (lowerPath.size() > 4 &&
      (lowerPath.substr(lowerPath.size() - 4) == ".mus" ||
       lowerPath.substr(lowerPath.size() - 4) == ".lmp")) {
    FILE *f = fopen(path, "rb");
    if (f) {
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
    if (debugMode) printf("VGMStream: Attempting to open %s\n", basePath.c_str());
    libvgmstream_t* vs = libvgmstream_init();
    if (vs) {
      // Always open with play_forever=true so vgmstream never fades/terminates
      // on its own. JS (_checkTrackEnd) is solely responsible for fade and
      // track advancement for vgmstream tracks.
      libvgmstream_config_t cfg = {};
      if (debugMode) printf("VGMStream: Opening (always play_forever=true)\n");
      cfg.ignore_loop = false;         // honour native loop points if present
      cfg.allow_play_forever = true;
      cfg.play_forever = true;         // never terminate inside libvgmstream
      cfg.force_loop = true;           // always allocate loop structures
      cfg.force_sfmt = LIBVGMSTREAM_SFMT_PCM16;
      libvgmstream_setup(vs, &cfg);

      // Emscripten filesystem check: try adding leading slash if missing
      std::string effectivePath = basePath;
      if (!effectivePath.empty() && effectivePath[0] != '/') {
        effectivePath = "/" + effectivePath;
      }

      libstreamfile_t* sf = libstreamfile_open_from_stdio(effectivePath.c_str());
      if (!sf && effectivePath != basePath) {
         // Fallback to original path if leading slash didn't help (though usually it's the other way)
         sf = libstreamfile_open_from_stdio(basePath.c_str());
      }

      if (sf) {
        if (debugMode) printf("VGMStream: Successfully opened STREAMFILE for %s\n", effectivePath.c_str());
        int result = libvgmstream_open_stream(vs, sf, 0);
        // libvgmstream_open_stream takes ownership of sf if successful (>=0)
        // or we free vs which frees its internal sf if init was partial.
        // If it failed (<0), we close sf here and free vs.
        if (result >= 0) {
          if (debugMode) {
              printf("VGMStream: Opened %s, channels=%d, rate=%d, play_samples=%lld\n", 
                     effectivePath.c_str(), vs->format->channels, vs->format->sample_rate, (long long)vs->format->play_samples);
              printf("VGMStream: Loop: %s, Start: %lld, End: %lld, Total Samples: %lld\n",
                     vs->format->loop_flag ? "YES" : "NO",
                     (long long)vs->format->loop_start,
                     (long long)vs->format->loop_end,
                     (long long)vs->format->stream_samples);
          }
                    // Success - set up converter and buffers
          isVGMStream = true;
          vgmstreamContext = vs;
          vgmstreamChannels = vs->format->channels;
          vgmstreamSampleRate = vs->format->sample_rate;
          currentVGMStreamPath = effectivePath;

          // Check for native loop metadata (anything that isn't the fallback full-track loop)
          VGMSTREAM* v = ((libvgmstream_priv_t*)vs->priv)->vgmstream;
          // Note: at this point, v->loop_start_sample might be 0 for some formats
          // because api_apply_config / setup_vgmstream hasn't been called to parse 
          // all modifiers fully yet. We just do a basic check.
          if (v && v->loop_end_sample > 0 && 
              (v->loop_start_sample > 0 || v->loop_end_sample < v->num_samples)) {
              vgmstreamHasNativeLoop = true;
          } else {
              vgmstreamHasNativeLoop = false;
          }
          if (debugMode) printf("VGMStream: Native Loop detected: %s (Points: %d-%d, Total: %d)\n", 
                                vgmstreamHasNativeLoop ? "YES" : "NO", 
                                v ? v->loop_start_sample : 0, 
                                v ? v->loop_end_sample : 0,
                                v ? v->num_samples : 0);

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
        } else {
          if (debugMode) printf("VGMStream: libvgmstream_open_stream failed with %d for %s\n", result, effectivePath.c_str());
          libstreamfile_close(sf);
        }
      } else {
         if (debugMode) printf("VGMStream: libstreamfile_open_from_stdio failed for %s\n", effectivePath.c_str());
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

void CloseVGMFile(void) { cleanup(false); }

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
  if (isMunt && mt32Smf) {
    return mt32Smf->positionAtEnd() ? 1 : 0;
  }
  if (isADLMIDI) {
    if (!adlPlayer) return 1;
    const int ended = adl_atEnd(adlPlayer);
    return ended > 0 ? 1 : 0;
  }
  if (isOpenMPT) {
    if (!gOpenMpt) return 1;
    if (openmptEnded) return 1;
    if (openmptDurationSec > 0.0) {
      double pos = openmpt_module_get_position_seconds(gOpenMpt);
      if (pos >= (openmptDurationSec - 0.001)) return 1;
    }
    return 0;
  }
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
  if (isAPE) {
    if (!apeDecompress) return 1;
    const int currentBlock = (int)apeDecompress->GetInfo(APE_DECOMPRESS_CURRENT_BLOCK);
    const int totalBlocks = apeTotalBlocks > 0 ? apeTotalBlocks : (int)apeDecompress->GetInfo(APE_DECOMPRESS_TOTAL_BLOCKS);
    return (apeEnded || (totalBlocks > 0 && currentBlock >= totalBlocks)) ? 1 : 0;
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
  if (isMunt && mt32Smf) {
    // Duration from sequencer in seconds
    double dur = mt32Smf->timeLength();
    if (dur <= 0.0) return 0;
    return (int)(dur * 44100.0);
  }
  if (isADLMIDI) {
    if (!adlPlayer) return 0;
    double dur = adl_totalTimeLength(adlPlayer);
    if (dur <= 0.0) return 0;
    return (int)(dur * 44100.0);
  }
  if (isOpenMPT) {
    if (!gOpenMpt) return 0;
    double dur = openmptDurationSec > 0.0 ? openmptDurationSec : openmpt_module_get_duration_seconds(gOpenMpt);
    if (dur <= 0.0) return 0;
    return (int)(dur * 44100.0);
  }
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
  if (isAPE) {
    if (!apeDecompress || apeSampleRate <= 0) return 0;
    const int lengthMs = (int)apeDecompress->GetInfo(APE_INFO_LENGTH_MS);
    if (lengthMs > 0) {
      return (int)((double)lengthMs * (double)gSampleRate / 1000.0);
    }
    const int totalBlocks = apeTotalBlocks > 0 ? apeTotalBlocks : (int)apeDecompress->GetInfo(APE_INFO_TOTAL_BLOCKS);
    return totalBlocks > 0 ? (int)((double)totalBlocks * (double)gSampleRate / (double)apeSampleRate) : 0;
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
      // stream_samples is the natural one-shot length (no loops, no fade).
      // Normalize to the 44100-Hz domain that JS expects:
      //   JS will do: baseSampleCount = GetTrackLength() * jsRate / 44100
      // so returning stream_samples * 44100 / nativeRate gives the correct
      // number of output samples after the ma_data_converter resampling.
      int64_t s = vgmstreamContext->format->stream_samples;
      if (s > 0 && vgmstreamSampleRate > 0) {
          return (int)((double)s * 44100.0 / (double)vgmstreamSampleRate);
      }
      // Fallback: if stream_samples is missing use play_samples.
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

  if (lowerPath.size() > 4 &&
      (lowerPath.substr(lowerPath.size() - 4) == ".mid" ||
       lowerPath.substr(lowerPath.size() - 5) == ".midi" ||
       lowerPath.substr(lowerPath.size() - 4) == ".rmi")) {
    ADL_MIDIPlayer* temp = adl_init((long)gSampleRate);
    if (!temp) return 0;
    adl_setNumChips(temp, 2);
    adl_setBank(temp, 14);
    adl_setSoftPanEnabled(temp, 1);
    if (adl_openFile(temp, basePath.c_str()) != 0) {
      adl_close(temp);
      return 0;
    }
    double dur = adl_totalTimeLength(temp);
    adl_close(temp);
    if (dur <= 0.0) return 0;
    return (int)(dur * 44100.0);
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

  if (isOpenMptFormatPath(lowerPath)) {
    DATA_LOADER *mptLoader = FileLoader_Init(basePath.c_str());
    if (!mptLoader)
      return 0;
    if (DataLoader_Load(mptLoader)) {
      DataLoader_Deinit(mptLoader);
      return 0;
    }
    const UINT8 *fileData = DataLoader_GetData(mptLoader);
    UINT32 fileSize = DataLoader_GetSize(mptLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(mptLoader);
      return 0;
    }
    int modErr = 0;
    const char *modErrStr = nullptr;
    openmpt_module *mod = openmpt_module_create_from_memory2(
        fileData, fileSize,
        nullptr, nullptr,
        nullptr, nullptr,
        &modErr, &modErrStr, nullptr);
    DataLoader_Deinit(mptLoader);
    if (!mod)
      return 0;
    double dur = openmpt_module_get_duration_seconds(mod);
    openmpt_module_destroy(mod);
    if (dur <= 0.0)
      return 0;
    return (int)(dur * 44100.0);
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

  if (lowerPath.find(".ape") != std::string::npos) {
    int apeError = 0;
    str_utf16 *path16 = GetUTF16FromANSI((const str_ansi *)basePath.c_str());
    IAPEDecompress *temp = CreateIAPEDecompress(path16, &apeError);
    delete[] path16;
    if (!temp || apeError != 0)
      return 0;
    const int lengthMs = (int)temp->GetInfo(APE_INFO_LENGTH_MS);
    const int sampleRate = (int)temp->GetInfo(APE_INFO_SAMPLE_RATE);
    const int totalBlocks = (int)temp->GetInfo(APE_INFO_TOTAL_BLOCKS);
    delete temp;
    if (lengthMs > 0) {
      return (int)((double)lengthMs * (double)gSampleRate / 1000.0);
    }
    if (sampleRate > 0 && totalBlocks > 0) {
      return (int)((double)totalBlocks * (double)gSampleRate / (double)sampleRate);
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

  if (isOpenMptFormatPath(lowerPath)) {
    DATA_LOADER *mptLoader = FileLoader_Init(basePath.c_str());
    if (!mptLoader)
      return "";
    if (DataLoader_Load(mptLoader)) {
      DataLoader_Deinit(mptLoader);
      return "";
    }
    const UINT8 *fileData = DataLoader_GetData(mptLoader);
    UINT32 fileSize = DataLoader_GetSize(mptLoader);
    if (!fileData || fileSize == 0) {
      DataLoader_Deinit(mptLoader);
      return "";
    }
    int modErr = 0;
    const char *modErrStr = nullptr;
    openmpt_module *mod = openmpt_module_create_from_memory2(
        fileData, fileSize,
        nullptr, nullptr,
        nullptr, nullptr,
        &modErr, &modErrStr, nullptr);
    DataLoader_Deinit(mptLoader);
    if (!mod)
      return "";

    std::string title = openmptGetMetadata(mod, "title");
    std::string artist = openmptGetMetadata(mod, "artist");
    std::string tracker = openmptGetMetadata(mod, "tracker");
    std::string type = openmptGetMetadata(mod, "type");
    std::string message = openmptGetMetadata(mod, "message");
    openmpt_module_destroy(mod);

    static char tagResult[256];
    const char *val = "";
    switch (tagIndex) {
      case 0: val = title.c_str(); break;
      case 2: val = type.c_str(); break;
      case 4: val = tracker.c_str(); break;
      case 6: val = artist.c_str(); break;
      case 9: val = "OpenMPT"; break;
      case 10: val = message.c_str(); break;
      default: val = ""; break;
    }
    strncpy(tagResult, val, 255);
    tagResult[255] = '\0';
    return tagResult;
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

  if (lowerPath.find(".vgm") != std::string::npos ||
      lowerPath.find(".vgz") != std::string::npos) {
    DATA_LOADER *locLoader = FileLoader_Init(path);
    if (!locLoader)
      return "";
    if (DataLoader_Load(locLoader)) {
      DataLoader_Deinit(locLoader);
      return "";
    }

    VGMPlayer *locPlayer = new VGMPlayer();
    locPlayer->SetSampleRate(gSampleRate);
    if (locPlayer->LoadFile(locLoader)) {
      delete locPlayer;
      DataLoader_Deinit(locLoader);
      return "";
    }

    const char *keys[] = {"TITLE", "TITLE-JPN", "GAME", "GAME-JPN", "SYSTEM",
                          "SYSTEM-JPN", "ARTIST", "ARTIST-JPN", "DATE",
                          "ENCODED_BY", "COMMENT"};
    if (tagIndex < 0 || tagIndex >= 11) {
      locPlayer->UnloadFile();
      delete locPlayer;
      DataLoader_Deinit(locLoader);
      return "";
    }

    const char *targetKey = keys[tagIndex];
    const char *const *tags = locPlayer->GetTags();
    const char *val = "";
    if (tags && targetKey && *targetKey) {
      for (const char *const *t = tags; *t; t += 2) {
        const char *key = t[0];
        const char *value = t[1];
        if (!key)
          break;
        if (strcasecmp(key, targetKey) == 0) {
          val = value ? value : "";
          break;
        }
      }
    }

    static char tagResult[256];
    strncpy(tagResult, val ? val : "", 255);
    tagResult[255] = '\0';
    locPlayer->UnloadFile();
    delete locPlayer;
    DataLoader_Deinit(locLoader);
    return tagResult;
  }

  // For other formats, we'd need to load the file and use player->GetTags.
  // This is heavier but possible. For now, keep it opt-in.
  return "";
}

int GetKSSPerChSize(void) { return (int)sizeof(KSSPLAY_PER_CH_OUT); }

int GetKSSDeviceMask(void) {
  if (!isKSS || !gKssPlay || !gKssPlay->vm)
    return 0;
  int mask = 0;
  if (gKssPlay->vm->psg)
    mask |= 1;
  if (gKssPlay->vm->scc)
    mask |= 2;
  if (gKssPlay->vm->opll)
    mask |= 4;
  if (gKssPlay->vm->opl)
    mask |= 8;
  if (gKssPlay->vm->sng)
    mask |= 16;
  if (gKss && gKss->DA8_enable)
    mask |= 32;
  return mask;
}

void SetKSSChannelMask(int device, int mask) {
  if (!isKSS || !gKssPlay)
    return;
  KSSPLAY_set_channel_mask(gKssPlay, (KSS_DEVICE)device, (uint32_t)mask);
}

void FillBufferKSSPerCh(float *left, float *right, KSSPLAY_PER_CH_OUT *per_ch, int n) {
  if (n <= 0)
    return;
  if (!isKSS || !gKssPlay) {
    memset(left, 0, n * sizeof(float));
    memset(right, 0, n * sizeof(float));
    if (per_ch)
      memset(per_ch, 0, sizeof(KSSPLAY_PER_CH_OUT) * n);
    return;
  }
  std::vector<INT16> tmp(n * 2);
  if (per_ch) {
    KSSPLAY_calc_with_per_ch(gKssPlay, tmp.data(), per_ch, n);
  } else {
    KSSPLAY_calc(gKssPlay, tmp.data(), n);
  }
  gKssSamplePos += (uint64_t)n;
  for (int i = 0; i < n; i++) {
    left[i] = (float)(tmp[i * 2] / 32768.0f);
    right[i] = (float)(tmp[i * 2 + 1] / 32768.0f);
  }
}

void FillBuffer2(float *left, float *right, int n) {
  if (n <= 0)
    return;

  if (isMunt && mt32Enabled && mt32Smf && mt32Ctx) {
    // Advance MIDI sequencer by n samples, rendering events to mt32 context
    static int mt32DebugCount = 0;
    if (mt32DebugCount++ < 5) {
      printf("FillBuffer2: Munt rendering %d samples\n", n);
    }
    mt32Smf->Tick((double)n / (double)gSampleRate, 1.0 / (double)gSampleRate);
    std::vector<int16_t> renderBuf(n * 2);
    mt32emu_render_bit16s(mt32Ctx, renderBuf.data(), (mt32emu_bit32u)n);
    for (int i = 0; i < n; i++) {
      left[i] = (float)renderBuf[i * 2] / 32768.0f;
      right[i] = (float)renderBuf[i * 2 + 1] / 32768.0f;
    }
    return;
  }

  if (isADLMIDI) {
    if (!adlPlayer) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    std::vector<int16_t> buf(n * 2);
    int samples = adl_play(adlPlayer, n * 2, buf.data());
    static int adlLogCounter = 0;
    if (adlLogCounter < 5) {
      adlLogCounter++;
      double pos = adl_positionTell(adlPlayer);
      int atEnd = adl_atEnd(adlPlayer);
      const char* err = adl_errorInfo(adlPlayer);
      printf("ADLMIDI: samples=%d pos=%.3f end=%d err=%s\n", samples, pos, atEnd, err ? err : "");
    }
    if (samples <= 0) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    int frames = samples / 2;
    for (int i = 0; i < n; i++) {
      if (i < frames) {
        left[i] = (float)buf[i * 2] / 32768.0f;
        right[i] = (float)buf[i * 2 + 1] / 32768.0f;
      } else {
        left[i] = 0.0f;
        right[i] = 0.0f;
      }
    }
    return;
  }

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

  if (isOpenMPT) {
    if (!gOpenMpt) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }
    std::size_t frames = openmpt_module_read_float_stereo(
        gOpenMpt, (int)gSampleRate, (std::size_t)n, left, right);
    if (frames < (std::size_t)n) {
      for (int i = (int)frames; i < n; i++) {
        left[i] = 0.0f;
        right[i] = 0.0f;
      }
      openmptEnded = true;
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

  if (isAPE) {
    if (!apeDecompress || !apeConverterInitialized) {
      memset(left, 0, n * sizeof(float));
      memset(right, 0, n * sizeof(float));
      return;
    }

    const int decodeBlocks = 4096;
    while ((int)apeOutputBuffer.size() < n * 2 && !apeEnded) {
      if (apeInputBuffer.empty()) {
        const int bytesPerBlock = apeChannels * (apeBytesPerSample > 0 ? apeBytesPerSample : 2);
        std::vector<uint8_t> rawBuffer(decodeBlocks * bytesPerBlock);
        int blocksRetrieved = 0;
        int err = apeDecompress->GetData((char *)rawBuffer.data(), decodeBlocks, &blocksRetrieved);
        if (err != 0 || blocksRetrieved <= 0) {
          apeEnded = true;
          break;
        }

        const int totalSamples = blocksRetrieved * apeChannels;
        apeInputBuffer.reserve(apeInputBuffer.size() + totalSamples);

        if (apeBitsPerSample == 8) {
          for (int i = 0; i < totalSamples; i++) {
            int16_t v = (int16_t)(((int)rawBuffer[i] - 128) << 8);
            apeInputBuffer.push_back(v);
          }
        } else if (apeBitsPerSample == 16) {
          const uint8_t *p = rawBuffer.data();
          for (int i = 0; i < totalSamples; i++) {
            int16_t v = (int16_t)(p[i * 2] | (p[i * 2 + 1] << 8));
            apeInputBuffer.push_back(v);
          }
        } else if (apeBitsPerSample == 24) {
          const uint8_t *p = rawBuffer.data();
          for (int i = 0; i < totalSamples; i++) {
            int32_t v = (int32_t)(p[i * 3] | (p[i * 3 + 1] << 8) | (p[i * 3 + 2] << 16));
            if (v & 0x800000) v |= ~0xFFFFFF;
            apeInputBuffer.push_back((int16_t)(v >> 8));
          }
        } else if (apeBitsPerSample == 32) {
          const uint8_t *p = rawBuffer.data();
          for (int i = 0; i < totalSamples; i++) {
            int32_t v = (int32_t)(p[i * 4] | (p[i * 4 + 1] << 8) | (p[i * 4 + 2] << 16) | (p[i * 4 + 3] << 24));
            apeInputBuffer.push_back((int16_t)(v >> 16));
          }
        } else {
          const uint8_t *p = rawBuffer.data();
          for (int i = 0; i < totalSamples; i++) {
            int16_t v = (int16_t)(p[i * 2] | (p[i * 2 + 1] << 8));
            apeInputBuffer.push_back(v);
          }
        }
      }

      if (!apeInputBuffer.empty()) {
        ma_uint64 inputFrames = apeInputBuffer.size() / (apeChannels > 0 ? apeChannels : 1);
        size_t outCapacity = (size_t)(inputFrames * (double)gSampleRate / (double)apeSampleRate) + 256;
        if (outCapacity < 1) outCapacity = 1;
        std::vector<float> outBuffer(outCapacity * 2);
        ma_uint64 inCount = inputFrames;
        ma_uint64 outCount = outCapacity;
        ma_result res = ma_data_converter_process_pcm_frames(&apeConverter,
            apeInputBuffer.data(), &inCount,
            outBuffer.data(), &outCount);
        if (res != MA_SUCCESS) {
          apeEnded = true;
          break;
        }
        size_t consumedSamples = (size_t)inCount * (apeChannels > 0 ? apeChannels : 1);
        if (consumedSamples > 0 && consumedSamples <= apeInputBuffer.size()) {
          apeInputBuffer.erase(apeInputBuffer.begin(), apeInputBuffer.begin() + consumedSamples);
        } else {
          apeInputBuffer.clear();
        }
        if (outCount > 0) {
          apeOutputBuffer.insert(apeOutputBuffer.end(), outBuffer.begin(), outBuffer.begin() + outCount * 2);
        }
      }
    }

    int availableFrames = (int)apeOutputBuffer.size() / 2;
    int framesToCopy = (availableFrames < n) ? availableFrames : n;
    for (int i = 0; i < framesToCopy; i++) {
      left[i] = apeOutputBuffer[i * 2];
      right[i] = apeOutputBuffer[i * 2 + 1];
    }
    for (int i = framesToCopy; i < n; i++) {
      left[i] = 0.0f;
      right[i] = 0.0f;
    }
    if (framesToCopy > 0) {
      apeOutputBuffer.erase(apeOutputBuffer.begin(), apeOutputBuffer.begin() + framesToCopy * 2);
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
        int res = libvgmstream_fill(vgmstreamContext, tempBuffer.data(), decodeFrames);
        int rendered = vgmstreamContext->decoder->buf_samples;
        if (res < 0 || (rendered <= 0 && vgmstreamContext->decoder->done)) {
          if (debugMode) printf("FillBuffer2: vgmstream rendered 0 samples, done=%d\n", vgmstreamContext->decoder->done);
          break; // no more data or error
        }
        if (rendered <= 0) {
          if (debugMode) printf("FillBuffer2: WARNING - rendered 0 samples but NOT DONE. LoopEnabled=%d\n", vgmstreamLoopEnabled);
        }
        static int vgmstreamLogCount = 0;
        if (debugMode) {
            printf("FillBuffer2: vgmstream rendered %d samples, res=%d, done=%d\n", 
                   rendered, res, vgmstreamContext->decoder->done);
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
  if (isOpenMPT) {
    if (!gOpenMpt)
      return nullptr;
    std::string title = openmptGetMetadata(gOpenMpt, "title");
    std::string artist = openmptGetMetadata(gOpenMpt, "artist");
    std::string tracker = openmptGetMetadata(gOpenMpt, "tracker");
    std::string type = openmptGetMetadata(gOpenMpt, "type");
    std::string message = openmptGetMetadata(gOpenMpt, "message");

    if (title.empty()) {
      std::string base = currentOpenMptPath;
      size_t lastSlash = base.find_last_of('/');
      if (lastSlash != std::string::npos) {
        base = base.substr(lastSlash + 1);
      }
      title = base;
    }

    std::string s;
    for (int i = 0; i < 11; i++) {
      s += "Key";
      s += "|||";
      const char *val = "";
      switch (i) {
        case 0: val = title.c_str(); break;
        case 2: val = type.c_str(); break;
        case 4: val = tracker.c_str(); break;
        case 6: val = artist.c_str(); break;
        case 9: val = "OpenMPT"; break;
        case 10: val = message.c_str(); break;
        default: val = ""; break;
      }
      s += val;
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

EMSCRIPTEN_KEEPALIVE
void SetDebugMode(int enabled) {
    debugMode = (enabled != 0);
}

EMSCRIPTEN_KEEPALIVE
int IsVGMStream() {
    return isVGMStream ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int GetVgmstreamLoop() {
    if (!isVGMStream || !vgmstreamContext || !vgmstreamContext->format) return 0;
    return vgmstreamContext->format->loop_flag ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int HasVgmstreamNativeLoop() {
    return vgmstreamHasNativeLoop ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void SetVgmstreamLoop(int enabled) {
    // Just record the preference. The stream is always opened with play_forever=true
    // so we never touch libvgmstream internals mid-playback (that was the crash).
    // JS (_checkTrackEnd) uses this flag implicitly via _trackSupportsLoop /
    // loopMode; all fade/end decisions are made in JS.
    vgmstreamLoopEnabled = (enabled != 0);
    if (debugMode) printf("VGMStream: Loop flag set to %s (no stream reconfigure)\n",
                           vgmstreamLoopEnabled ? "ON" : "OFF");
}

} /* extern "C" */

#ifdef __EMSCRIPTEN__
int main(int, char **) {
  // Initialization moved to JS to avoid CSP issues with EM_ASM
  return 0;
}
#endif
