cmake_minimum_required(VERSION 3.10)
project(vgmplay-js-2)

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

file(GLOB MAIN_SOURCES VGMPlay/src/*.c)

if(EMSCRIPTEN)
  add_executable(vgmplay-js src/main.c ${MAIN_SOURCES})
  target_link_libraries(vgmplay-js vgmplay)
  set(VGMPLAY_EXPORTS "'_VGMPlay_Init','_VGMPlay_Init2','_PlayVGM','_FillBuffer2','_OpenVGMFile','_CloseVGMFile','_FillBuffer','_SetSampleRate','_SetLoopCount','_StopVGM','_VGMEnded','_GetTrackLength','_GetLoopPoint','_SeekVGM','_ShowTitle','_SamplePlayback2VGM','_main','_malloc','_free'")
  set(CMAKE_EXE_LINKER_FLAGS "-s USE_ZLIB=1 -s FORCE_FILESYSTEM=1 -s TOTAL_MEMORY=134217728 -s RESERVED_FUNCTION_POINTERS=100 -O3 --preload-file ${PROJECT_SOURCE_DIR}/files@/ -s EXPORTED_RUNTIME_METHODS=\"['cwrap','ccall','FS','HEAPU8','HEAP16']\" -s WASM=1 -s EXPORTED_FUNCTIONS=\"[${VGMPLAY_EXPORTS}]\"")
  # Post-build copy to project root
  add_custom_command(TARGET vgmplay-js POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:vgmplay-js> ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.js
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.wasm ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.wasm
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_BINARY_DIR}/vgmplay-js.data ${CMAKE_CURRENT_SOURCE_DIR}/vgmplay-js.data
    COMMENT "Copying build artifacts to project root"
  )
endif()
