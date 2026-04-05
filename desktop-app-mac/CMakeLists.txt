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
set(ASSET_FILES
    vgmplay-js-glue.js
    vgmplay-js.js
    vgmplay-audio.js
    vgmplay-archives.js
    vgmplay-kss.js
    vgmplay-library.js
    vgmplay-spectrum.js
    vgmplay-ui.js
    vgmplay-js.wasm
    vgmplay-audio-processor.js
    minizip-asm.min.js
    7zz.umd.js
    7zz.wasm
    unrar.min.js
    audiomotion-analyzer.js
    vgmplay-cache.js
    vgmplay-harvester.js
    vgmplay-layout.js
    vgmplay-metadata.js
    vgmplay-midi.js
    vgmplay-queue.js
    vgmplay-standalone-ui.js
    archive-worker.js
    background.js
)

# Copy index.html and symlink extension assets next to the binary
add_custom_command(TARGET VGMPlay POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_SOURCE_DIR}/index.html
        $<TARGET_FILE_DIR:VGMPlay>/index.html
    COMMENT "Copying index.html"
)

foreach(asset ${ASSET_FILES})
    add_custom_command(TARGET VGMPlay POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E create_symlink
            ${ROOT_DIR}/${asset}
            $<TARGET_FILE_DIR:VGMPlay>/${asset}
        COMMENT "Symlinking ${asset}"
    )
endforeach()

# CSS directory
add_custom_command(TARGET VGMPlay POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E create_symlink
        ${ROOT_DIR}/css
        $<TARGET_FILE_DIR:VGMPlay>/css
    COMMENT "Symlinking css/"
)

# Dist assets (music packs)
add_custom_command(TARGET VGMPlay POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E create_symlink
        ${ROOT_DIR}/dist
        $<TARGET_FILE_DIR:VGMPlay>/dist
    COMMENT "Symlinking dist/"
)
