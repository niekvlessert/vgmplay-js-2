#!/bin/bash

# prepare_for_usage.sh
# This script prepares the VGM player for development and testing:
# 1. Applies the per-chip volume control patch to the libvgm submodule.
# 2. Synchronizes identical files from the main project tree to the 
#    extension (Chrome) and ff_extension (Firefox) directories.

PROJECT_ROOT=$(pwd)
PATCH_FILE="$PROJECT_ROOT/patches/libvgm_per_chip_volume.patch"
LIBVGM_DIR="$PROJECT_ROOT/modules/libvgm"

echo "--- Preparing VGM Player ---"

# 1. Apply the patch to libvgm
if [ -f "$PATCH_FILE" ]; then
    echo "Checking if patch is already applied to $LIBVGM_DIR..."
    git -C "$LIBVGM_DIR" apply --reverse --check "$PATCH_FILE" &>/dev/null
    if [ $? -eq 0 ]; then
        echo "Patch is already applied. Skipping."
    else
        echo "Applying patch..."
        git -C "$LIBVGM_DIR" apply --check "$PATCH_FILE"
        if [ $? -eq 0 ]; then
            git -C "$LIBVGM_DIR" apply "$PATCH_FILE"
            echo "Patch applied successfully."
        else
            echo "Error: Patch verification failed. Conflicts might exist."
        fi
    fi
else
    echo "Error: Patch file not found at $PATCH_FILE"
fi

# 2. Copy files to extension and ff_extension
echo "Synchronizing artifacts to extension directories..."

FILES_TO_COPY=(
    "vgmplay-js.js"
    "vgmplay-js.wasm"
    "vgmplay-js-glue.js"
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
