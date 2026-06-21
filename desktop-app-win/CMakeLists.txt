cmake_minimum_required(VERSION 3.10)
project(VGMPlayWin)

set(CMAKE_CXX_STANDARD 17)

if(NOT WEBVIEW2_SDK_DIR AND DEFINED ENV{WEBVIEW2_SDK_DIR})
    set(WEBVIEW2_SDK_DIR "$ENV{WEBVIEW2_SDK_DIR}")
endif()

if(NOT WEBVIEW2_SDK_DIR)
    message(FATAL_ERROR "WEBVIEW2_SDK_DIR must point to the Microsoft.Web.WebView2 NuGet package directory")
endif()

set(WEBVIEW2_INCLUDE_DIR "${WEBVIEW2_SDK_DIR}/build/native/include")
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(WEBVIEW2_ARCH "x64")
else()
    set(WEBVIEW2_ARCH "x86")
endif()
set(WEBVIEW2_LIB_DIR "${WEBVIEW2_SDK_DIR}/build/native/${WEBVIEW2_ARCH}")
set(WEBVIEW2_LOADER_LIB "${WEBVIEW2_LIB_DIR}/WebView2LoaderStatic.lib")

if(NOT EXISTS "${WEBVIEW2_INCLUDE_DIR}/WebView2.h")
    message(FATAL_ERROR "WebView2.h not found at ${WEBVIEW2_INCLUDE_DIR}")
endif()
if(NOT EXISTS "${WEBVIEW2_LOADER_LIB}")
    message(FATAL_ERROR "WebView2 loader library not found at ${WEBVIEW2_LOADER_LIB}")
endif()

add_executable(VGMPlay WIN32 main.cpp)

target_include_directories(VGMPlay PRIVATE "${WEBVIEW2_INCLUDE_DIR}")
target_link_libraries(VGMPlay
    "${WEBVIEW2_LOADER_LIB}"
    shlwapi.lib
    user32.lib
    shell32.lib
    ole32.lib
)

set(ROOT_DIR "${CMAKE_SOURCE_DIR}/..")
include("${ROOT_DIR}/cmake/WebAssets.cmake")
stage_web_assets(VGMPlay "${ROOT_DIR}")
stage_web_assets(VGMPlay "${ROOT_DIR}" "web-desktop-assets.txt")
