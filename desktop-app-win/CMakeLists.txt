cmake_minimum_required(VERSION 3.10)
project(VGMPlayWin)

set(CMAKE_CXX_STANDARD 17)

# Find WebView2
# Note: User will need to install Microsoft.Web.WebView2 via NuGet or have the SDK in the path
# This assumes the SDK is available in the include and lib paths
include_directories(${WEBVIEW2_INCLUDE_DIR})
link_directories(${WEBVIEW2_LIB_DIR})

add_executable(VGMPlay WIN32 main.cpp)

target_link_libraries(VGMPlay
    shlwapi.lib
    user32.lib
    shell32.lib
    ole32.lib
)

# Optional: Add a custom command to copy the WebView2 loader DLL to the output directory
# if(WebView2_LOADER_DLL)
#    add_custom_command(TARGET VGMPlay POST_BUILD
#        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${WebView2_LOADER_DLL}" $<TARGET_FILE_DIR:VGMPlay>)
# endif()
