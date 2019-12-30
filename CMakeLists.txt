cmake_minimum_required(VERSION 3.4)

add_definitions(-DDISABLE_HW_SUPPORT)

include_directories("src" "modules/vgmplay/VGMPlay")

file(GLOB_RECURSE SOURCES "modules/vgmplay/VGMPlay/*.c")

list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/chips/opl.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/chips/scsplfo.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/Stream.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/pt_ioctl.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/vgm2wav.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/vgm2pcm.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/VGMPlay_AddFmts.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/dbus.c")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/dbus.h")
list(REMOVE_ITEM SOURCES "${PROJECT_SOURCE_DIR}/modules/vgmplay/VGMPlay/mmkeys_Win.c")

add_library(vgmplay STATIC ${SOURCES})
target_link_libraries(vgmplay m)

set(CMAKE_C_FLAGS "-O3 -Wno-unused-value -Wno-shift-negative-value -Wno-parentheses-equality -Wno-absolute-value -Wno-all")

file(GLOB SOURCES VGMPlay/src/*.c)

if(EMSCRIPTEN)
  add_executable(vgmplay-js src/main.c)
  target_link_libraries(vgmplay-js vgmplay)
  set(VGMPLAY_EXPORTS "'_VGMPlay_Init','_VGMPlay_Init2','_PlayVGM','_FillBuffer2','_OpenVGMFile','_CloseVGMFile','_FillBuffer','_SetSampleRate','_SetLoopCount','_StopVGM','_VGMEnded','_GetTrackLength','_GetLoopPoint','_SeekVGM','_ShowTitle','_SamplePlayback2VGM','_main'")
  set(CMAKE_EXE_LINKER_FLAGS "-s USE_ZLIB=1 -s FORCE_FILESYSTEM=1 -s TOTAL_MEMORY=134217728 -s RESERVED_FUNCTION_POINTERS=100 --memory-init-file 0 -s SINGLE_FILE=1 -O3 --preload-file ${PROJECT_SOURCE_DIR}/files@/ -s EXTRA_EXPORTED_RUNTIME_METHODS=\"['cwrap','ccall','FS']\" -s WASM=1 -s EXPORTED_FUNCTIONS=\"[${VGMPLAY_EXPORTS}]\"")
endif()
