cmake_minimum_required(VERSION 3.10)
project(VGMPlayLin)

# Find dependencies
find_package(PkgConfig REQUIRED)
pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
pkg_check_modules(WEBKIT webkit2gtk-4.1)
if(NOT WEBKIT_FOUND)
    pkg_check_modules(WEBKIT REQUIRED webkit2gtk-4.0)
endif()

add_executable(VGMPlay main.c)

target_include_directories(VGMPlay PRIVATE ${GTK3_INCLUDE_DIRS} ${WEBKIT_INCLUDE_DIRS})
target_link_libraries(VGMPlay ${GTK3_LIBRARIES} ${WEBKIT_LIBRARIES})
target_compile_options(VGMPlay PRIVATE ${GTK3_CFLAGS_OTHER} ${WEBKIT_CFLAGS_OTHER})

set(ROOT_DIR "${CMAKE_SOURCE_DIR}/..")
include("${ROOT_DIR}/cmake/WebAssets.cmake")
stage_web_assets(VGMPlay "${ROOT_DIR}")
stage_web_assets(VGMPlay "${ROOT_DIR}" "web-desktop-assets.txt")
