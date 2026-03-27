#!/bin/bash

# apply_patches.sh
# Applies all library patches located in the patches/ directory to their respective submodules.

PROJECT_ROOT=$(pwd)
PATCHES_DIR="$PROJECT_ROOT/patches"
MODULES_DIR="$PROJECT_ROOT/modules"

apply_patch() {
    local module_name=$1
    local patch_name=$2
    local extra_flags=$3
    local target_dir="$MODULES_DIR/$module_name"
    local patch_file="$PATCHES_DIR/$patch_name"

    if [ -f "$patch_file" ]; then
        echo "Checking if patch $patch_name is already applied to $module_name..."
        # Check if patch can be reversed (already applied)
        git -C "$target_dir" apply $extra_flags --reverse --check "$patch_file" &>/dev/null
        if [ $? -eq 0 ]; then
            echo "Patch $patch_name is already applied. Skipping."
        else
            echo "Applying patch $patch_name to $module_name..."
            git -C "$target_dir" apply $extra_flags --check "$patch_file"
            if [ $? -eq 0 ]; then
                git -C "$target_dir" apply $extra_flags "$patch_file"
                echo "Patch $patch_name applied successfully."
            else
                echo "Error: Patch verification failed for $patch_name. Conflicts might exist."
                return 1
            fi
        fi
    else
        echo "Warning: Patch file not found at $patch_file"
    fi
    return 0
}

echo "--- Applying Library Patches ---"

apply_patch "libvgm" "libvgm.patch"
apply_patch "sexypsf" "sexypsf.patch"
apply_patch "libkss" "libkss.patch" "--ignore-whitespace"
apply_patch "lazyusf" "lazyusf.patch"
apply_patch "monkeys-audio" "monkeys-audio.patch"
apply_patch "vgmstream" "vgmstream-emscripten.patch"

echo "--- Patching Complete ---"
