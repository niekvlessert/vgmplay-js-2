cmake_minimum_required(VERSION 3.12)
project(vgmplay-js-2)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "This project requires the Emscripten toolchain")
else()
  # Emscripten specific options
  add_compile_options("-s" "USE_ZLIB=1")
  add_link_options("-s" "USE_ZLIB=1")
  
  # Tell CMake to search our root directory for FindZLIB.cmake script first
  set(CMAKE_MODULE_PATH ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_MODULE_PATH})
endif()

# Automatically apply patches
message(STATUS "Automatically applying library patches...")
execute_process(
    COMMAND /bin/bash ${CMAKE_CURRENT_SOURCE_DIR}/apply_patches.sh
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    RESULT_VARIABLE PATCH_RESULT
)
if(NOT PATCH_RESULT EQUAL 0)
    message(FATAL_ERROR "Failed to apply library patches")
endif()

set(BUILD_PLAYER OFF CACHE BOOL "build player application" FORCE)
set(BUILD_VGM2WAV OFF CACHE BOOL "build sample vgm2wav application" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "build test programs" FORCE)
set(USE_SANITIZERS OFF CACHE BOOL "use sanitizers" FORCE)
if(EMSCRIPTEN)
  set(Iconv_IS_BUILT_IN TRUE CACHE BOOL "Emscripten provides iconv in libc" FORCE)
  set(Iconv_LIBRARY c CACHE STRING "Emscripten libc provides iconv" FORCE)
  set(UTIL_CHARCNV_ICONV ON CACHE BOOL "Use Emscripten iconv for libvgm charset conversion" FORCE)
endif()
add_subdirectory(modules/libvgm)
set(MOONSOUND_USE_SYSTEM_LIBVGM ON CACHE BOOL "Use external libvgm for libmoonsound" FORCE)
set(MOONSOUND_BUILD_CLI OFF CACHE BOOL "Disable libmoonsound CLI" FORCE)
add_subdirectory(modules/libmoonsound)
add_subdirectory(modules/sexypsf)
set(SSFPLAY_BUILD_CLI OFF CACHE BOOL "Disable ssfplay command-line tools" FORCE)
set(SSFPLAY_BUILD_PLAYER OFF CACHE BOOL "Disable ssfplay playback tool" FORCE)
set(SSFPLAY_BUILD_LIBVGM_AB_PLAYER OFF CACHE BOOL "Disable ssfplay libvgm comparison tools" FORCE)
set(SSFPLAY_BUILD_WASM OFF CACHE BOOL "Disable standalone ssfplay wasm wrapper" FORCE)
add_subdirectory(modules/ssfplay_tools)
set(GME_BUILD_SHARED OFF CACHE BOOL "Build shared library" FORCE)
set(GME_BUILD_STATIC ON CACHE BOOL "Build static library" FORCE)
add_subdirectory(modules/game-music-emu)
add_subdirectory(modules/libkss)
add_subdirectory(modules/lazyusf)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build example programs" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "Build test programs" FORCE)
set(BUILD_TOOLS OFF CACHE BOOL "Build tools" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static libraries for wasm" FORCE)
add_subdirectory(modules/libMusDoom)

# Hoot archive replay core. Its own GUI/CLI frontends are intentionally not
# part of this Wasm build.
include(cmake/HootLibrary.cmake)

# Monkey's Audio (APE)
set(ENABLE_ASSEMBLY OFF CACHE BOOL "Disable assembly for Emscripten" FORCE)
add_subdirectory(modules/monkeys-audio)

# Munt MT-32 Emulation
set(libmt32emu_SHARED OFF CACHE BOOL "Build shared libmt32emu" FORCE)
set(libmt32emu_CPP_INTERFACE OFF CACHE BOOL "Disable C++ interface" FORCE)
set(libmt32emu_C_INTERFACE ON CACHE BOOL "Enable C interface" FORCE)
add_subdirectory(modules/munt/mt32emu)

# libsmf (used as sequencer for Munt) - REMOVED DUE TO GLIB2 DEPENDENCY
# add_subdirectory(modules/munt/mt32emu_smf2wav/libsmf)

# libADLMIDI
set(libADLMIDI_STATIC ON CACHE BOOL "Build static libADLMIDI" FORCE)
set(libADLMIDI_SHARED OFF CACHE BOOL "Build shared libADLMIDI" FORCE)
set(WITH_ADLMIDI2 OFF CACHE BOOL "Disable ADLMIDI2" FORCE)
set(USE_DOSBOX_EMULATOR ON CACHE BOOL "Use DOSBox OPL emulator" FORCE)
set(USE_NUKED_EMULATOR OFF CACHE BOOL "Disable Nuked OPL emulator" FORCE)
set(USE_OPAL_EMULATOR OFF CACHE BOOL "Disable Opal OPL emulator" FORCE)
set(USE_JAVA_EMULATOR OFF CACHE BOOL "Disable Java OPL emulator" FORCE)
set(USE_ESFMU_EMULATOR OFF CACHE BOOL "Disable ESFM emulator" FORCE)
set(USE_MAME_EMULATOR OFF CACHE BOOL "Disable MAME OPL emulator" FORCE)
set(USE_YMFM_EMULATOR OFF CACHE BOOL "Disable YMFM emulator" FORCE)
add_subdirectory(modules/adlmidi)

set(USE_FFMPEG ON CACHE BOOL "Use FFmpeg for support of many codecs" FORCE)
set(USE_MPEG ON CACHE BOOL "Use libmpg123 for support of MPEG" FORCE)
set(USE_VORBIS ON CACHE BOOL "Use libvorbis for support of Vorbis" FORCE)
set(USE_ATRAC9 ON CACHE BOOL "Use LibAtrac9 for support of ATRAC9" FORCE)
set(USE_CELT ON CACHE BOOL "Use libcelt for support of FSB CELT" FORCE)
set(USE_G719 ON CACHE BOOL "Use libg719_decode for support ITU-T G.719" FORCE)
set(USE_G7221 ON CACHE BOOL "Use G7221 for support of ITU-T" FORCE)
set(USE_SPEEX ON CACHE BOOL "Use libspeex for support of SPEEX" FORCE)

# The wasm build cannot reliably link optional native deps on CI runners.
# Disable these unless you explicitly opt-in with local builds/tooling.
if(EMSCRIPTEN)
  set(USE_FFMPEG OFF CACHE BOOL "Use FFmpeg for support of many codecs" FORCE)
  set(USE_MPEG OFF CACHE BOOL "Use libmpg123 for support of MPEG" FORCE)
  # Keep ATRAC9 enabled for wasm builds when requested.
  set(USE_ATRAC9 ON CACHE BOOL "Use LibAtrac9 for support of ATRAC9" FORCE)
  set(USE_CELT OFF CACHE BOOL "Use libcelt for support of FSB CELT" FORCE)
  set(USE_G719 OFF CACHE BOOL "Use libg719_decode for support ITU-T G.719" FORCE)
  set(USE_SPEEX OFF CACHE BOOL "Use libspeex for support of SPEEX" FORCE)
endif()
set(BUILD_CLI OFF CACHE BOOL "Build vgmstream CLI" FORCE)
add_subdirectory(modules/vgmstream)

# Fail fast if ATRAC9 was requested but the dependency didn't materialize.
if(USE_ATRAC9 AND NOT TARGET atrac9)
  message(FATAL_ERROR "USE_ATRAC9 is ON but LibAtrac9 target was not created. Set ATRAC9_PATH to a valid LibAtrac9 checkout or disable USE_ATRAC9.")
endif()

# Highly Theoretical is used only for Dreamcast DSF playback. Keep SSF disabled
# here so Saturn playback stays on ssfplay_tools.
add_library(highly_theoretical STATIC
  modules/highly_theoretical/Core/arm.c
  modules/highly_theoretical/Core/dcsound.c
  modules/highly_theoretical/Core/sega.c
  modules/highly_theoretical/Core/yam.c
)
target_include_directories(highly_theoretical PRIVATE
  modules/highly_theoretical/Core
)
target_compile_definitions(highly_theoretical PRIVATE
  EMU_COMPILE
  EMU_LITTLE_ENDIAN
  HAVE_STDINT_H
  DISABLE_SSF
)

# libsidplayfp does not ship a CMake build. Build the small SIDLITE-backed
# engine directly for wasm SID playback.
set(LIB_MAJOR 3)
set(LIB_MINOR 0)
set(LIB_LEVEL 2)
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/modules/libsidplayfp/src/sidplayfp/sidversion.h.in
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/sidplayfp/sidversion.h
  @ONLY
)
set(HAVE_BUILTIN_EXPECT 1)
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/modules/libsidplayfp/src/builders/sidlite-builder/sidlite/sl_defs.h.in
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/builders/sidlite-builder/sidlite/sl_defs.h
  @ONLY
)
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/cmake/libsidplayfp-generated/psiddrv.bin
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/psiddrv.bin
  COPYONLY
)
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/cmake/libsidplayfp-generated/sidtune/sidplayer1.bin
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/sidtune/sidplayer1.bin
  COPYONLY
)
configure_file(
  ${CMAKE_CURRENT_SOURCE_DIR}/cmake/libsidplayfp-generated/sidtune/sidplayer2.bin
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/sidtune/sidplayer2.bin
  COPYONLY
)
add_library(sidplayfp STATIC
  modules/libsidplayfp/src/EventScheduler.cpp
  modules/libsidplayfp/src/player.cpp
  modules/libsidplayfp/src/psiddrv.cpp
  modules/libsidplayfp/src/reloc65.cpp
  modules/libsidplayfp/src/sidemu.cpp
  modules/libsidplayfp/src/simpleMixer.cpp
  modules/libsidplayfp/src/c64/c64.cpp
  modules/libsidplayfp/src/c64/mmu.cpp
  modules/libsidplayfp/src/c64/CIA/SerialPort.cpp
  modules/libsidplayfp/src/c64/CIA/interrupt.cpp
  modules/libsidplayfp/src/c64/CIA/mos652x.cpp
  modules/libsidplayfp/src/c64/CIA/timer.cpp
  modules/libsidplayfp/src/c64/CIA/tod.cpp
  modules/libsidplayfp/src/c64/CPU/mos6510.cpp
  modules/libsidplayfp/src/c64/CPU/mos6510debug.cpp
  modules/libsidplayfp/src/c64/VIC_II/mos656x.cpp
  modules/libsidplayfp/src/sidplayfp/SidConfig.cpp
  modules/libsidplayfp/src/sidplayfp/SidInfo.cpp
  modules/libsidplayfp/src/sidplayfp/SidTune.cpp
  modules/libsidplayfp/src/sidplayfp/SidTuneInfo.cpp
  modules/libsidplayfp/src/sidplayfp/sidbuilder.cpp
  modules/libsidplayfp/src/sidplayfp/sidplayfp.cpp
  modules/libsidplayfp/src/sidtune/MUS.cpp
  modules/libsidplayfp/src/sidtune/PSID.cpp
  modules/libsidplayfp/src/sidtune/SidTuneBase.cpp
  modules/libsidplayfp/src/sidtune/SidTuneTools.cpp
  modules/libsidplayfp/src/sidtune/p00.cpp
  modules/libsidplayfp/src/sidtune/prg.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite-builder.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite-emu.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite/ADSR.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite/Filter.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite/SID.cpp
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite/WavGen.cpp
)
target_include_directories(sidplayfp PRIVATE
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/sidtune
  ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated/builders/sidlite-builder/sidlite
  modules/libsidplayfp/src
  modules/libsidplayfp/src/builders/sidlite-builder
  modules/libsidplayfp/src/builders/sidlite-builder/sidlite
)
target_compile_features(sidplayfp PRIVATE cxx_std_11)
target_compile_definitions(sidplayfp PRIVATE
  PACKAGE="libsidplayfp"
  PACKAGE_NAME="libsidplayfp"
  PACKAGE_VERSION="3.0.2"
  PACKAGE_URL="https://github.com/libsidplayfp/libsidplayfp"
  VERSION="3.0.2"
  HAVE_CXX11=1
)

# Build libopenmpt with its own Makefile (Emscripten)
set(OPENMPT_DIR ${CMAKE_CURRENT_SOURCE_DIR}/modules/openmpt)
set(OPENMPT_LIB ${OPENMPT_DIR}/bin/libopenmpt.a)
add_custom_command(
    OUTPUT ${OPENMPT_LIB}
    COMMAND make -C ${OPENMPT_DIR} CONFIG=emscripten STATIC_LIB=1 SHARED_LIB=0 EXAMPLES=0 OPENMPT123=0 IN_OPENMPT=0 XMP_OPENMPT=0
    WORKING_DIRECTORY ${OPENMPT_DIR}
    COMMENT "Building libopenmpt (emscripten)"
)
add_custom_target(openmpt_build DEPENDS ${OPENMPT_LIB})
add_library(openmpt STATIC IMPORTED)
set_target_properties(openmpt PROPERTIES IMPORTED_LOCATION ${OPENMPT_LIB})
add_dependencies(openmpt openmpt_build)

# Main Executable
add_executable(vgmplay-js
    src/vgmplay_glue.cpp
    src/miniaudio_impl.cpp
)

# Link against libvgm components and others
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -msimd128 -msse -msse2")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -msse -msse2")

target_link_libraries(vgmplay-js vgm-player vgm-emu vgm-utils sexypsf lazyusf ssfplay::ssfplay)
target_link_libraries(vgmplay-js gme::gme)
target_link_libraries(vgmplay-js kss)
target_link_libraries(vgmplay-js musdoom)
target_link_libraries(vgmplay-js libvgmstream)
target_link_libraries(vgmplay-js moonsound)

# vgmstream dependencies
if(EMSCRIPTEN)
  foreach(lib atrac9 celt0061 celt0110 mpg123 g719_decode speex)
    if(TARGET ${lib})
      target_link_libraries(vgmplay-js ${lib})
    endif()
  endforeach()
  # Vorbis/Ogg targets can be exported as plain or namespaced targets depending on build.
  if(TARGET vorbisfile)
    target_link_libraries(vgmplay-js vorbisfile)
  endif()
  if(TARGET Vorbis::vorbisfile)
    target_link_libraries(vgmplay-js Vorbis::vorbisfile)
  endif()
  if(TARGET vorbis)
    target_link_libraries(vgmplay-js vorbis)
  endif()
  if(TARGET Vorbis::vorbis)
    target_link_libraries(vgmplay-js Vorbis::vorbis)
  endif()
  if(TARGET ogg)
    target_link_libraries(vgmplay-js ogg)
  endif()
  if(TARGET Ogg::ogg)
    target_link_libraries(vgmplay-js Ogg::ogg)
  endif()
  # Fallback to static libs produced by vgmstream's FetchContent builds.
  set(VGMSTREAM_OGG_LIB "${CMAKE_BINARY_DIR}/modules/vgmstream/dependencies/ogg/libogg.a")
  set(VGMSTREAM_VORBIS_LIB "${CMAKE_BINARY_DIR}/modules/vgmstream/dependencies/vorbis/lib/libvorbis.a")
  set(VGMSTREAM_VORBISFILE_LIB "${CMAKE_BINARY_DIR}/modules/vgmstream/dependencies/vorbis/lib/libvorbisfile.a")
  if(EXISTS "${VGMSTREAM_VORBISFILE_LIB}")
    target_link_libraries(vgmplay-js "${VGMSTREAM_VORBISFILE_LIB}")
  endif()
  if(EXISTS "${VGMSTREAM_VORBIS_LIB}")
    target_link_libraries(vgmplay-js "${VGMSTREAM_VORBIS_LIB}")
  endif()
  if(EXISTS "${VGMSTREAM_OGG_LIB}")
    target_link_libraries(vgmplay-js "${VGMSTREAM_OGG_LIB}")
  endif()
  if(TARGET avformat AND TARGET avcodec AND TARGET swresample AND TARGET avutil)
    target_link_libraries(vgmplay-js avformat avcodec swresample avutil)
  endif()
  target_link_libraries(vgmplay-js z m)
else()
  target_link_libraries(vgmplay-js atrac9 celt0061 celt0110 mpg123 vorbisfile vorbis g719_decode speex ogg)
  # FFmpeg and system dependencies for vgmstream
  target_link_libraries(vgmplay-js avformat avcodec swresample avutil z m)
endif()

# Ensure vgmstream external dependencies are built before linking
if(TARGET ATRAC9_MAKE)
  add_dependencies(vgmplay-js ATRAC9_MAKE)
endif()
if(TARGET CELT_0061_MAKE)
  add_dependencies(vgmplay-js CELT_0061_MAKE)
endif()
if(TARGET CELT_0110_MAKE)
  add_dependencies(vgmplay-js CELT_0110_MAKE)
endif()
if(TARGET MPEG_MAKE)
  add_dependencies(vgmplay-js MPEG_MAKE)
endif()
if(TARGET FFMPEG_MAKE)
  add_dependencies(vgmplay-js FFMPEG_MAKE)
endif()
if(TARGET SPEEX_MAKE)
  add_dependencies(vgmplay-js SPEEX_MAKE)
endif()

target_link_libraries(vgmplay-js openmpt)
target_link_libraries(vgmplay-js ADLMIDI_static)
target_link_libraries(vgmplay-js mt32emu)
target_link_libraries(vgmplay-js libmac)
target_link_libraries(vgmplay-js sidplayfp)
target_link_libraries(vgmplay-js highly_theoretical)
target_link_libraries(vgmplay-js vgmplay_hoot)
add_dependencies(vgmplay-js openmpt_build)
add_dependencies(vgmplay-js vgmplay_hoot_catalog)

target_link_options(vgmplay-js PRIVATE "SHELL:-Wl,--allow-multiple-definition")
target_compile_options(vgmplay-js PRIVATE $<$<COMPILE_LANGUAGE:CXX>:-fexceptions>)
target_link_options(vgmplay-js PRIVATE "SHELL:-sDISABLE_EXCEPTION_CATCHING=0")
target_compile_definitions(vgmplay-js PRIVATE BUILD_CROSS_PLATFORM)

# Include directories
target_include_directories(vgmplay-js PRIVATE 
    modules/libvgm/player
    modules/libvgm/utils
    modules/libvgm/emu
    modules/miniaudio
)
target_include_directories(vgmplay-js PRIVATE
    modules/sexypsf
    modules/ssfplay_tools/include
    modules/game-music-emu/gme
    modules/libkss/src
    modules/libkss/src/kss
    modules/libkss/modules
    modules/lazyusf
    modules/lazyusf/rsp
    modules/lazyusf/rsp_hle
    modules/libMusDoom/src
    modules/libmoonsound/src
    modules/vgmstream/src
    modules/adlmidi/include
    modules/monkeys-audio/src/Shared
    modules/monkeys-audio/src/MACLib
    ${CMAKE_CURRENT_BINARY_DIR}/modules/monkeys-audio
    modules/openmpt/libopenmpt
    modules/openmpt/common
    modules/openmpt/src
    modules/openmpt
    modules/munt/mt32emu/src
    modules/adlmidi/src
    modules/libsidplayfp/src
    modules/libsidplayfp/src/builders/sidlite-builder
    modules/libsidplayfp/src/builders/sidlite-builder/sidlite
    ${CMAKE_CURRENT_BINARY_DIR}/modules/libsidplayfp/generated
    modules/highly_theoretical/Core
)

# Exported functions
set(VGMPLAY_EXPORTS 
    "'_OpenVGMFile'"
    "'_CloseVGMFile'"
    "'_PlayVGM'"
    "'_StopVGM'"
    "'_SetSampleRate'"
    "'_Seek'"
    "'_SetLoopCount'"
    "'_VGMEnded'"
    "'_GetTrackLength'"
    "'_GetTrackLengthDirect'"
    "'_GetVGMTagDirect'"
    "'_GetLoopPoint'"
    "'_FillBuffer2'"
    "'_FillBufferKSSPerCh'"
    "'_ShowTitle'"
    "'_GetChipInfoString'"
    "'_GetDeviceCount'"
    "'_GetDeviceName'"
    "'_GetDeviceVolume'"
    "'_SetDeviceVolume'"
    "'_main'"
    "'_malloc'"
    "'_free'"
    "'_GetUsedMemory'"
    "'_GetFreeMemory'"
    "'_GetHeapTopUsedMemory'"
    "'_GetTotalMemory'"
)

list(APPEND VGMPLAY_EXPORTS
    "'_GetGMETrackCountDirect'"
    "'_GetGMETrackNameDirect'"
    "'_GetSIDTrackCountDirect'"
    "'_GetSIDTrackNameDirect'"
    "'_GetKSSTrackCountDirect'"
    "'_GetKSSTrackMinDirect'"
    "'_GetKSSTrackMaxDirect'"
    "'_GetKSSTrackNameDirect'"
    "'_GetKSSPerChSize'"
    "'_GetKSSDeviceMask'"
    "'_SetKSSChannelMask'"
    "'_SetMidiEngine'"
    "'_LoadGENMIDI'"
    "'_MUSPlaying'"
    "'_PrefillPSF'"
    "'_CheckMuntRoms'"
    "'_SetDebugMode'"
    "'_IsVGMStream'"
    "'_GetVgmstreamLoop'"
    "'_SetVgmstreamLoop'"
    "'_HasVgmstreamNativeLoop'"
    "'_SetMoonsoundMwkPath'"
    "'_GetLastLoadErrorCode'"
    "'_MoonsoundSupportsLoop'"
    "'_IsHootArchiveName'"
    "'_GetHootTrackCountDirect'"
    "'_GetHootTrackNameDirect'"
    "'_GetHootGameTitleDirect'"
)
string(REPLACE ";" "," EXPORT_STR "${VGMPLAY_EXPORTS}")

# Emscripten Linker Flags
set(LINK_FLAGS "\
    -lidbfs.js \
    -s USE_ZLIB=1 \
    -s FORCE_FILESYSTEM=1 \
    -s INITIAL_MEMORY=268435456 \
    -s MAXIMUM_MEMORY=1073741824 \
    -s RESERVED_FUNCTION_POINTERS=100 \
    -O2 \
    -s EXPORTED_RUNTIME_METHODS=\"['cwrap','ccall','FS','HEAPU8','HEAP16']\" \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS=\"[${EXPORT_STR}]\" \
    --preload-file ${HOOT_CATALOG_SQLITE}@/hoot/hoot.sqlite \
")

set(PRELOAD_DIR "${PROJECT_SOURCE_DIR}/files")
if (EXISTS "${PRELOAD_DIR}")
  file(GLOB_RECURSE PRELOAD_FILES "${PRELOAD_DIR}/*")
  if (PRELOAD_FILES)
    set(LINK_FLAGS "${LINK_FLAGS} --preload-file ${PRELOAD_DIR}@/")
    set(PRELOAD_ENABLED TRUE)
  endif()
endif()

set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${LINK_FLAGS}")

# Post-build copy
if (PRELOAD_ENABLED)
  add_custom_command(TARGET vgmplay-js POST_BUILD
	COMMAND ${CMAKE_COMMAND} -DINPUT=$<TARGET_FILE:vgmplay-js> -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/PatchEmscriptenGlue.cmake
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.data ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.data
    COMMENT "Copying build artifacts to project root"
  )
else()
  add_custom_command(TARGET vgmplay-js POST_BUILD
	COMMAND ${CMAKE_COMMAND} -DINPUT=$<TARGET_FILE:vgmplay-js> -P ${CMAKE_CURRENT_SOURCE_DIR}/cmake/PatchEmscriptenGlue.cmake
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
    COMMENT "Copying build artifacts to project root"
  )
endif()
