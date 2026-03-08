#!/bin/bash

# Configuration
APP_NAME="VGMPlay"
DMG_NAME="VGMPlay-macOS.dmg"
BUILD_DIR="build_standalone"
DMG_STAGING="dmg_staging"

echo "--- Starting Standalone DMG Build Workflow ---"

# 1. Clean build environment
echo "Creating clean build directory: $BUILD_DIR..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# 2. Native Build (macOS App)
echo "Running CMake and Make..."
cd "$BUILD_DIR"
cmake .. -DCMAKE_BUILD_TYPE=Release
if ! make; then
    echo "Error: Native build failed."
    exit 1
fi

APP_PATH="VGMPlay.app"
if [ ! -d "$APP_PATH" ]; then
    echo "Error: $APP_PATH not found in build directory."
    exit 1
fi

# 3. De-symlink Assets for Standalone Mode
echo "Processing assets to ensure 100% standalone offline capability..."
MACOS_PATH="$APP_PATH/Contents/MacOS"

# Find all symlinks in the MacOS directory and replace them with hard copies
find "$MACOS_PATH" -type l | while read -r link; do
    target=$(readlink "$link")
    echo "Replacing symlink: $(basename "$link") -> copying source: $target"
    rm "$link"
    cp -R "$target" "$link"
done

# 4. Verify critical assets
if [ ! -f "$MACOS_PATH/index.html" ]; then
    echo "Warning: index.html not found in $MACOS_PATH"
fi
if [ ! -f "$MACOS_PATH/vgmplay-js-glue.js" ]; then
    echo "Warning: vgmplay-js-glue.js not found in $MACOS_PATH"
fi

# 5. Create DMG
echo "Packaging into DMG: $DMG_NAME..."
cd ..
rm -rf "$DMG_STAGING"
mkdir -p "$DMG_STAGING"

# Copy the standalone app to staging
cp -R "$BUILD_DIR/$APP_PATH" "$DMG_STAGING/"

# Add Applications symlink for standard macOS installation experience
ln -s /Applications "$DMG_STAGING/Applications"

# Create the DMG
rm -f "$DMG_NAME"
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGING" -ov -format UDZO "$DMG_NAME"

# Cleanup
echo "Cleaning up temporary staging files..."
rm -rf "$DMG_STAGING"

echo "--- Success! DMG created: $DMG_NAME ---"
echo "You can now distribute this DMG for offline standalone use."
