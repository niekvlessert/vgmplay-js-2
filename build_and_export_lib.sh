#!/bin/bash

# build_and_export_lib.sh
# Usage: ./build_and_export_lib.sh <destination_directory>

if [ -z "$1" ]; then
    echo "Usage: $0 <destination_directory>"
    exit 1
fi

DEST_DIR="$1"
mkdir -p "$DEST_DIR"

echo "--- Building Minimal libvgm ---"

# Create build directory
mkdir -p build_minimal
cd build_minimal

# Configure and build
emcmake cmake .. -DBUILD_LIBVGM_ONLY=ON
emmake make -j$(sysctl -n hw.ncpu)

if [ $? -ne 0 ]; then
    echo "Error: Build failed."
    exit 1
fi

cd ..

echo "--- Copying artifacts to $DEST_DIR ---"

cp build_minimal/vgmplay-js.js "$DEST_DIR/"
cp build_minimal/vgmplay-js.wasm "$DEST_DIR/"
cp vgmplay-js-glue-library.js "$DEST_DIR/"
cp vgmplay-audio-processor.js "$DEST_DIR/"
cp minizip-asm.min.js "$DEST_DIR/"
cp USAGE.md "$DEST_DIR/"

echo "--- Export Complete ---"
echo "To use in your game, include vgmplay-js-glue-library.js and call vgmPlayInstance.playTrack(url)"
