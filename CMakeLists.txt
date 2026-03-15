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
add_subdirectory(modules/libvgm)
add_subdirectory(modules/sexypsf)
set(GME_BUILD_SHARED OFF CACHE BOOL "Build shared library" FORCE)
set(GME_BUILD_STATIC ON CACHE BOOL "Build static library" FORCE)
add_subdirectory(modules/game-music-emu)
add_subdirectory(modules/libkss)
add_subdirectory(modules/lazyusf)
set(BUILD_EXAMPLES OFF CACHE BOOL "Build example programs" FORCE)
set(BUILD_TESTS OFF CACHE BOOL "Build test programs" FORCE)
set(BUILD_TOOLS OFF CACHE BOOL "Build tools" FORCE)
add_subdirectory(modules/libMusDoom)

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
set(BUILD_CLI OFF CACHE BOOL "Build vgmstream CLI" FORCE)
add_subdirectory(modules/vgmstream)

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

target_link_libraries(vgmplay-js vgm-player vgm-emu vgm-utils sexypsf lazyusf)
target_link_libraries(vgmplay-js gme::gme)
target_link_libraries(vgmplay-js kss)
target_link_libraries(vgmplay-js musdoom)
target_link_libraries(vgmplay-js libvgmstream)

# vgmstream dependencies
target_link_libraries(vgmplay-js atrac9 celt0061 celt0110 mpg123 vorbisfile vorbis g719_decode speex ogg)

# FFmpeg and system dependencies for vgmstream
target_link_libraries(vgmplay-js avformat avcodec swresample avutil z m)

target_link_libraries(vgmplay-js openmpt)
target_link_libraries(vgmplay-js ADLMIDI_static)
target_link_libraries(vgmplay-js mt32emu)
target_link_libraries(vgmplay-js libmac)
add_dependencies(vgmplay-js openmpt_build)

target_link_options(vgmplay-js PRIVATE "SHELL:-Wl,--allow-multiple-definition")
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
    modules/game-music-emu/gme
    modules/libkss/src
    modules/libkss/src/kss
    modules/libkss/modules
    modules/lazyusf
    modules/lazyusf/rsp
    modules/lazyusf/rsp_hle
    modules/libMusDoom/src
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
)
string(REPLACE ";" "," EXPORT_STR "${VGMPLAY_EXPORTS}")

# Emscripten Linker Flags
set(LINK_FLAGS "\
    -s USE_ZLIB=1 \
    -s FORCE_FILESYSTEM=1 \
    -s INITIAL_MEMORY=268435456 \
    -s MAXIMUM_MEMORY=2147483648 \
    -s RESERVED_FUNCTION_POINTERS=100 \
    -O2 \
    -s EXPORTED_RUNTIME_METHODS=\"['cwrap','ccall','FS','HEAPU8','HEAP16']\" \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS=\"[${EXPORT_STR}]\" \
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
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.data ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.data
    COMMENT "Copying build artifacts to project root"
  )
else()
  add_custom_command(TARGET vgmplay-js POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
    COMMENT "Copying build artifacts to project root"
  )
endif()
