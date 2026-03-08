#!/bin/bash

# prepare_for_usage.sh
# This script prepares the VGM player for development and testing:
# 1. Synchronizes identical files from the main project tree to the 
#    extension (Chrome) and ff_extension (Firefox) directories.

PROJECT_ROOT=$(pwd)

echo "--- Preparing VGM Player ---"

# 1. Copy files to extension and ff_extension
echo "Synchronizing artifacts to extension directories..."

FILES_TO_COPY=(
    "vgmplay-js.js"
    "vgmplay-js.wasm"
    "vgmplay-js-glue.js"
    "minizip-asm.min.js"
    "vgmplay-audio-processor.js"
    "7zz.umd.js"
    "7zz.wasm"
    "unrar.min.js"
    "audiomotion-analyzer.js"
)

# Optional files
if [ -f "vgmplay-js.data" ]; then
    FILES_TO_COPY+=("vgmplay-js.data")
fi

# Copy core files
for file in "${FILES_TO_COPY[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "extension/"
        cp "$file" "ff_extension/"
        echo "Copied $file"
    else
        echo "Warning: $file not found, skipping."
    fi
done

# Copy CSS
if [ -f "css/style.css" ]; then
    mkdir -p extension/css ff_extension/css
    cp "css/style.css" "extension/css/"
    cp "css/style.css" "ff_extension/css/"
    echo "Copied css/style.css"
else
    echo "Warning: css/style.css not found, skipping."
fi

echo "--- Preparation Complete ---"
