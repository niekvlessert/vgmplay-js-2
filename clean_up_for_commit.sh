#!/bin/bash

# clean_up_for_commit.sh
# This script cleans the workspace before committing:
# 1. Reverses all library patches if applied.
# 2. Removes staged web/runtime assets from extension and ff_extension folders.

PROJECT_ROOT=$(pwd)
PATCHES_DIR="$PROJECT_ROOT/patches"
MODULES_DIR="$PROJECT_ROOT/modules"

reverse_patch() {
    local module_name=$1
    local patch_name=$2
    local target_dir="$MODULES_DIR/$module_name"
    local patch_file="$PATCHES_DIR/$patch_name"

    if [ -d "$target_dir" ]; then
        echo "Cleaning $module_name..."
        # Remove generated CMakeLists.txt specifically
        rm -f "$target_dir/CMakeLists.txt"
        # Revert any modified files, reset index, and remove untracked files
        git -C "$target_dir" reset --hard HEAD
        git -C "$target_dir" checkout .
        git -C "$target_dir" clean -fd
        # Clean sub-sub-modules if any
        git -C "$target_dir" submodule foreach --recursive git reset --hard HEAD
        git -C "$target_dir" submodule foreach --recursive git clean -fd
        echo "$module_name cleaned successfully."
    else
        echo "Warning: Module directory not found at $target_dir"
    fi
}

echo "--- Cleaning Workspace for Commit ---"

# 1. Reverse all patches
reverse_patch "sexypsf" "sexypsf.patch"
reverse_patch "libkss" "libkss.patch"
reverse_patch "lazyusf" "lazyusf.patch"
reverse_patch "monkeys-audio" "monkeys-audio.patch"
reverse_patch "vgmstream" "vgmstream.patch"

# 2. Remove artifacts from extensions
echo "Removing artifacts from extension folders..."
"$PROJECT_ROOT/scripts/sync_web_assets.sh" remove "$PROJECT_ROOT/extension" "$PROJECT_ROOT/ff_extension"

echo "--- Cleanup Complete ---"
echo "Your workspace is now clean for committing."
