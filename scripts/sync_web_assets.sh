#!/bin/bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 [--manifest MANIFEST] copy|remove TARGET_DIR [TARGET_DIR ...]" >&2
    exit 2
fi

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$PROJECT_ROOT/web-assets.txt"

if [ "${1:-}" = "--manifest" ]; then
    if [ "$#" -lt 4 ]; then
        echo "Usage: $0 [--manifest MANIFEST] copy|remove TARGET_DIR [TARGET_DIR ...]" >&2
        exit 2
    fi
    MANIFEST="$PROJECT_ROOT/$2"
    shift 2
fi

ACTION="$1"
shift

if [ ! -f "$MANIFEST" ]; then
    echo "Missing asset manifest: $MANIFEST" >&2
    exit 1
fi

sync_copy() {
    local asset="$1"
    local target_dir="$2"
    local source="$PROJECT_ROOT/$asset"
    local target="$target_dir/$asset"

    if [ ! -e "$source" ]; then
        echo "Warning: $asset not found, skipping."
        return
    fi

    mkdir -p "$(dirname "$target")"
    if [[ "$asset" == */ ]]; then
        rm -rf "$target"
        mkdir -p "$target"
        cp -a "$source"/. "$target"/
    else
        cp "$source" "$target"
    fi
    echo "Copied $asset -> $target_dir"
}

sync_remove() {
    local asset="$1"
    local target_dir="$2"
    rm -rf "$target_dir/$asset"
    echo "Removed $asset from $target_dir (if present)"
}

case "$ACTION" in
    copy|remove)
        ;;
    *)
        echo "Unknown action: $ACTION" >&2
        exit 2
        ;;
esac

while IFS= read -r asset || [ -n "$asset" ]; do
    asset="${asset%%#*}"
    asset="${asset#"${asset%%[![:space:]]*}"}"
    asset="${asset%"${asset##*[![:space:]]}"}"
    [ -n "$asset" ] || continue

    for target_dir in "$@"; do
        mkdir -p "$target_dir"
        "sync_$ACTION" "$asset" "$target_dir"
    done
done < "$MANIFEST"
