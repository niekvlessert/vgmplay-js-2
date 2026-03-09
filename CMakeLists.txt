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

# Libvgm Only Build Option
option(BUILD_LIBVGM_ONLY "Build only libvgm components (VGM/VGZ support only)" OFF)

if(BUILD_LIBVGM_ONLY)
    add_definitions(-DVGMPLAY_LIBVGM_ONLY)
    add_subdirectory(modules/libvgm)
    set(MINIMAL_LIBS vgm-player vgm-emu vgm-utils)
else()
    add_subdirectory(modules/libvgm)
    add_subdirectory(modules/sexypsf)
    set(GME_BUILD_SHARED OFF CACHE BOOL "Build shared library" FORCE)
    set(GME_BUILD_STATIC ON CACHE BOOL "Build static library" FORCE)
    add_subdirectory(modules/game-music-emu)
    set(USE_FFMPEG OFF CACHE BOOL "Use FFmpeg for support of many codecs" FORCE)
    set(USE_MPEG OFF CACHE BOOL "Use libmpg123 for support of MPEG" FORCE)
    set(USE_VORBIS OFF CACHE BOOL "Use libvorbis for support of Vorbis" FORCE)
    set(USE_ATRAC9 OFF CACHE BOOL "Use LibAtrac9 for support of ATRAC9" FORCE)
    set(USE_CELT OFF CACHE BOOL "Use libcelt for support of FSB CELT" FORCE)
    set(USE_G719 OFF CACHE BOOL "Use libg719_decode for support ITU-T G.719" FORCE)
    set(USE_G7221 OFF CACHE BOOL "Use G7221 for support of ITU-T" FORCE)
    set(USE_SPEEX OFF CACHE BOOL "Use libspeex for support of SPEEX" FORCE)
    add_subdirectory(modules/vgmstream)
endif()

# Main Executable
if(BUILD_LIBVGM_ONLY)
    add_executable(vgmplay-js src/vgmplay_minimal_glue.cpp src/miniaudio_impl.cpp)
else()
    add_executable(vgmplay-js src/vgmplay_glue.cpp src/miniaudio_impl.cpp)
endif()

# Link against libvgm components and others
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -msimd128 -msse -msse2")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -msimd128 -msse -msse2")

if(BUILD_LIBVGM_ONLY)
    target_link_libraries(vgmplay-js ${MINIMAL_LIBS})
else()
    target_link_libraries(vgmplay-js vgm-player vgm-emu vgm-utils sexypsf lazyusf)
    target_link_libraries(vgmplay-js gme::gme)
    target_link_libraries(vgmplay-js kss)
    target_link_libraries(vgmplay-js musdoom)
    target_link_libraries(vgmplay-js libvgmstream)
endif()

target_link_options(vgmplay-js PRIVATE "SHELL:-Wl,--allow-multiple-definition")

# Include directories
target_include_directories(vgmplay-js PRIVATE 
    modules/libvgm/player
    modules/libvgm/utils
    modules/libvgm/emu
    modules/miniaudio
)
if(NOT BUILD_LIBVGM_ONLY)
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
    )
endif()

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
    "'_GetTotalMemory'"
)

if(NOT BUILD_LIBVGM_ONLY)
    list(APPEND VGMPLAY_EXPORTS
        "'_GetGMETrackCountDirect'"
        "'_GetGMETrackNameDirect'"
        "'_GetKSSTrackCountDirect'"
        "'_GetKSSTrackMinDirect'"
        "'_GetKSSTrackMaxDirect'"
        "'_GetKSSTrackNameDirect'"
        "'_LoadGENMIDI'"
        "'_MUSPlaying'"
    )
endif()
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

if(BUILD_LIBVGM_ONLY)
    set(LINK_FLAGS "${LINK_FLAGS} -s MODULARIZE=1 -s EXPORT_NAME=\"VGMPlay\"")
else()
    set(LINK_FLAGS "${LINK_FLAGS} --preload-file ${PROJECT_SOURCE_DIR}/files@/")
endif()

set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${LINK_FLAGS}")

# Post-build copy
if(BUILD_LIBVGM_ONLY)
    add_custom_command(TARGET vgmplay-js POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
      COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
      COMMENT "Copying minimal build artifacts to project root"
    )
else()
    add_custom_command(TARGET vgmplay-js POST_BUILD
      COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
      COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
      COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.data ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.data
      COMMENT "Copying build artifacts to project root"
    )
endif()
