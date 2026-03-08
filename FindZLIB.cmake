# Dummy FindZLIB.cmake to bypass standard find_package(ZLIB) in Emscripten
# Emscripten handles zlib internally via `-s USE_ZLIB=1` compiler flags.

if(NOT TARGET ZLIB::ZLIB)
    add_library(ZLIB::ZLIB INTERFACE IMPORTED)
    set_target_properties(ZLIB::ZLIB PROPERTIES INTERFACE_INCLUDE_DIRECTORIES "${CMAKE_CURRENT_BINARY_DIR}")
endif()

set(ZLIB_FOUND TRUE)
set(ZLIB_INCLUDE_DIRS "${CMAKE_CURRENT_BINARY_DIR}")
set(ZLIB_LIBRARIES ZLIB::ZLIB)
set(ZLIB_INCLUDE_DIR "${CMAKE_CURRENT_BINARY_DIR}")
set(ZLIB_LIBRARY ZLIB::ZLIB)

# Mark as found for standard args
include(FindPackageHandleStandardArgs)
FIND_PACKAGE_HANDLE_STANDARD_ARGS(ZLIB DEFAULT_MSG ZLIB_FOUND)
