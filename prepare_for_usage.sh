#!/bin/bash

# prepare_for_usage.sh
# This script synchronizes shared web/runtime assets into the browser extension
# directories for development and testing.

PROJECT_ROOT=$(pwd)

echo "--- Preparing VGM Player ---"

echo "Synchronizing artifacts to extension directories..."
"$PROJECT_ROOT/scripts/sync_web_assets.sh" copy "$PROJECT_ROOT/extension" "$PROJECT_ROOT/ff_extension"

echo "--- Preparation Complete ---"
