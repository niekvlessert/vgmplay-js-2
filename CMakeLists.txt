cmake_minimum_required(VERSION 3.12)
project(vgmplay-js-2)

# Verify Emscripten
if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "This project requires the Emscripten toolchain")
endif()

# Configure libvgm options
set(BUILD_TESTS OFF CACHE BOOL "Build tests" FORCE)
set(BUILD_PLAYER OFF CACHE BOOL "Build player app" FORCE)
set(BUILD_VGM2WAV OFF CACHE BOOL "Build vgm2wav" FORCE)
set(BUILD_LIBAUDIO OFF CACHE BOOL "Build audio lib" FORCE) # We handle audio output in JS
# We need library output to be static
set(LIBRARY_TYPE "STATIC" CACHE STRING "Library type" FORCE)

add_subdirectory(modules/libvgm)

# Main Executable
add_executable(vgmplay-js src/vgmplay_glue.cpp)

# Link against libvgm components
# Note: vgm-player depends on vgm-emu and vgm-utils
target_link_libraries(vgmplay-js vgm-player vgm-emu vgm-utils)

# Include directories (glue code needs headers)
target_include_directories(vgmplay-js PRIVATE 
    modules/libvgm/player
    modules/libvgm/utils
    modules/libvgm/emu
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
)
string(REPLACE ";" "," EXPORT_STR "${VGMPLAY_EXPORTS}")

# Emscripten Linker Flags
# Removed SINGLE_FILE=1 to prevent corruption
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} \
    -s USE_ZLIB=1 \
    -s FORCE_FILESYSTEM=1 \
    -s TOTAL_MEMORY=134217728 \
    -s RESERVED_FUNCTION_POINTERS=100 \
    -O3 \
    --preload-file ${PROJECT_SOURCE_DIR}/files@/ \
    -s EXPORTED_RUNTIME_METHODS=\"['cwrap','ccall','FS','HEAPU8','HEAP16']\" \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS=\"[${EXPORT_STR}]\" \
")

# Post-build copy
add_custom_command(TARGET vgmplay-js POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
  COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
  COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.data ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.data
  COMMENT "Copying build artifacts to project root"
)
