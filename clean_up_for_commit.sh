#!/bin/bash

# clean_up_for_commit.sh
# This script cleans the workspace before committing:
# 1. Reverses the libvgm patch if it is applied.
# 2. Removes build artifacts from extension and ff_extension folders.

PROJECT_ROOT=$(pwd)
PATCH_FILE="$PROJECT_ROOT/patches/libvgm_per_chip_volume.patch"
LIBVGM_DIR="$PROJECT_ROOT/modules/libvgm"

echo "--- Cleaning Workspace for Commit ---"

# 1. Reverse the patch if applied
if [ -f "$PATCH_FILE" ]; then
    echo "Checking if patch is applied to $LIBVGM_DIR..."
    git -C "$LIBVGM_DIR" apply --reverse --check "$PATCH_FILE" &>/dev/null
    if [ $? -eq 0 ]; then
        echo "Reversing patch..."
        git -C "$LIBVGM_DIR" apply --reverse "$PATCH_FILE"
        echo "Patch reversed successfully."
    else
        echo "Patch is not applied. Skipping reversal."
    fi
else
    echo "Error: Patch file not found at $PATCH_FILE"
fi

# 2. Remove artifacts from extensions
echo "Removing artifacts from extension folders..."

FILES_TO_REMOVE=(
    "vgmplay-js.js"
    "vgmplay-js.wasm"
    "vgmplay-js.data"
    "vgmplay-js-glue.js"
)

for file in "${FILES_TO_REMOVE[@]}"; do
    rm -f "extension/$file"
    rm -f "ff_extension/$file"
    echo "Removed $file (if present)"
done

# Remove CSS
rm -f "extension/css/style.css"
rm -f "ff_extension/css/style.css"
echo "Removed css/style.css"

echo "--- Cleanup Complete ---"
echo "Your workspace is now clean for committing."
