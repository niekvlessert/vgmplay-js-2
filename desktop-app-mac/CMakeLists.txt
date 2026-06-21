cmake_minimum_required(VERSION 3.12)
project(VGMPlay LANGUAGES C CXX OBJCXX)

set(CMAKE_CXX_STANDARD 14)

# ---- Build type defaults to Release ----
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

# ---- App executable ----
set(APP_ICON "${CMAKE_SOURCE_DIR}/VGMPlay.icns")
add_executable(VGMPlay MACOSX_BUNDLE main.mm ${APP_ICON})
set_target_properties(VGMPlay PROPERTIES
    MACOSX_BUNDLE_GUI_IDENTIFIER "com.vgmplay-js.desktop"
    MACOSX_BUNDLE_BUNDLE_NAME "VGMPlay"
    MACOSX_BUNDLE_BUNDLE_VERSION "1.0.0"
    MACOSX_BUNDLE_SHORT_VERSION_STRING "1.0"
    MACOSX_BUNDLE_ICON_FILE "VGMPlay.icns"
)

# Set the icon file as a bundle resource
set_source_files_properties(${APP_ICON} PROPERTIES MACOSX_PACKAGE_LOCATION Resources)

# ---- Frameworks ----
find_library(COCOA_LIB Cocoa)
find_library(WEBKIT_LIB WebKit)
target_link_libraries(VGMPlay PRIVATE ${COCOA_LIB} ${WEBKIT_LIB})

# ---- Size optimization ----
target_compile_options(VGMPlay PRIVATE -Os)

# ---- Extension assets to symlink into bundle ----
set(ROOT_DIR "${CMAKE_SOURCE_DIR}/..")
include("${ROOT_DIR}/cmake/WebAssets.cmake")

stage_web_assets(VGMPlay "${ROOT_DIR}")
stage_web_assets(VGMPlay "${ROOT_DIR}" "web-desktop-assets.txt")
