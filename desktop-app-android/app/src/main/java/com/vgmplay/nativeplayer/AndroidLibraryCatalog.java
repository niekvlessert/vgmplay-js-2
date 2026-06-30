package com.vgmplay.nativeplayer;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.net.Uri;

import androidx.documentfile.provider.DocumentFile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class AndroidLibraryCatalog {
    static final String ROOT_ID = "root";
    static final String PREFS_NAME = "vgmplay-native";
    static final String PREF_LIBRARY_DIRS = "libraryDirs";
    static final String PREF_SHOW_INCLUDED_MUSIC = "showIncludedMusic";
    static final String PREF_INCLUDED_MUSIC_DELETED = "includedMusicDeleted";
    static final String INCLUDED_LABEL = "Included Music";
    static final String ASSET_BASE = "https://vgmplay.local/assets/";

    static final class Entry {
        final String id;
        final String parentId;
        final String title;
        final String subtitle;
        final String nativePath;
        final boolean browsable;
        final boolean playable;

        Entry(String id, String parentId, String title, String subtitle, String nativePath, boolean browsable, boolean playable) {
            this.id = id;
            this.parentId = parentId;
            this.title = title;
            this.subtitle = subtitle;
            this.nativePath = nativePath;
            this.browsable = browsable;
            this.playable = playable;
        }
    }

    static final class Snapshot {
        final Map<String, Entry> byId = new HashMap<>();
        final Map<String, List<Entry>> byParent = new LinkedHashMap<>();

        void add(Entry entry) {
            byId.put(entry.id, entry);
            if (entry.parentId != null) {
                List<Entry> children = byParent.get(entry.parentId);
                if (children == null) {
                    children = new ArrayList<>();
                    byParent.put(entry.parentId, children);
                }
                children.add(entry);
            }
        }

        List<Entry> childrenOf(String parentId) {
            List<Entry> children = byParent.get(parentId == null ? ROOT_ID : parentId);
            return children == null ? new ArrayList<>() : children;
        }
    }

    static Snapshot build(Context context) {
        Snapshot snapshot = new Snapshot();
        snapshot.byId.put(ROOT_ID, new Entry(ROOT_ID, null, "VGMPlay-JS", "", "", true, false));

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean showIncluded = prefs.getBoolean(PREF_SHOW_INCLUDED_MUSIC, true)
            && !prefs.getBoolean(PREF_INCLUDED_MUSIC_DELETED, false);
        if (showIncluded) {
            Entry included = new Entry(folderId("asset", "dist"), ROOT_ID, INCLUDED_LABEL, "Bundled music", "", true, false);
            snapshot.add(included);
            try {
                scanAssetDirectory(context.getAssets(), snapshot, "dist", included.id, INCLUDED_LABEL + "/");
            } catch (IOException ignored) {
                // Android Auto should still show personal libraries if bundled assets cannot be listed.
            }
        }

        JSONArray dirs = loadLibraryDirs(prefs);
        Map<String, Integer> labelCounts = new HashMap<>();
        for (int i = 0; i < dirs.length(); i++) {
            JSONObject dir = dirs.optJSONObject(i);
            if (dir == null || !dir.optBoolean("enabled", true)) continue;
            Uri uri = Uri.parse(dir.optString("uri", ""));
            DocumentFile root = DocumentFile.fromTreeUri(context, uri);
            if (root == null || !root.isDirectory() || !root.canRead()) continue;
            String name = safeName(dir.optString("name", root.getName()), "Android Music");
            String label = uniqueLabel(name, labelCounts);
            Entry folder = new Entry(folderId("doc", uri.toString()), ROOT_ID, label, "Selected folder", "", true, false);
            snapshot.add(folder);
            scanDocumentFile(snapshot, root, folder.id, label + "/", label + "/");
        }

        return snapshot;
    }

    private static void scanAssetDirectory(AssetManager assets, Snapshot snapshot, String assetDir, String parentId, String relativePrefix) throws IOException {
        String[] names = assets.list(assetDir);
        if (names == null) return;
        for (String name : names) {
            if (name == null || name.isEmpty() || name.startsWith(".")) continue;
            String assetPath = assetDir + "/" + name;
            String relativePath = relativePrefix + name;
            String[] children = assets.list(assetPath);
            if (children != null && children.length > 0) {
                String id = folderId("asset", assetPath);
                snapshot.add(new Entry(id, parentId, name, "", "", true, false));
                scanAssetDirectory(assets, snapshot, assetPath, id, relativePath + "/");
            } else if (isPlayableOrArchive(name)) {
                String nativePath = "apk/assets/" + assetPath;
                String subtitle = extensionOf(name).toUpperCase(Locale.ROOT);
                snapshot.add(new Entry(playableId("asset", assetPath), parentId, stripExt(name), subtitle, nativePath, false, true));
            }
        }
    }

    private static void scanDocumentFile(Snapshot snapshot, DocumentFile node, String parentId, String relativePrefix, String nativePrefix) {
        if (node == null) return;
        if (node.isDirectory()) {
            for (DocumentFile child : node.listFiles()) {
                if (child == null) continue;
                if (child.isDirectory()) {
                    String childName = safeName(child.getName(), "Folder");
                    String childId = folderId("doc", child.getUri().toString());
                    snapshot.add(new Entry(childId, parentId, childName, "", "", true, false));
                    scanDocumentFile(snapshot, child, childId, relativePrefix + childName + "/", nativePrefix + childName + "/");
                } else {
                    scanDocumentFile(snapshot, child, parentId, relativePrefix, nativePrefix);
                }
            }
            return;
        }

        String name = node.getName();
        if (name == null || name.startsWith(".") || !isPlayableOrArchive(name)) return;
        String nativePath = "android/" + nativePrefix + name;
        String subtitle = extensionOf(name).toUpperCase(Locale.ROOT);
        snapshot.add(new Entry(playableId("doc", node.getUri().toString()), parentId, stripExt(name), subtitle, nativePath, false, true));
    }

    private static JSONArray loadLibraryDirs(SharedPreferences prefs) {
        String raw = prefs.getString(PREF_LIBRARY_DIRS, "[]");
        try {
            return new JSONArray(raw == null || raw.isEmpty() ? "[]" : raw);
        } catch (JSONException err) {
            return new JSONArray();
        }
    }

    private static String uniqueLabel(String baseName, Map<String, Integer> counts) {
        String base = safeName(baseName, "Android Music");
        int count = counts.containsKey(base) ? counts.get(base) + 1 : 1;
        counts.put(base, count);
        return count <= 1 ? base : base + " (" + count + ")";
    }

    private static String safeName(String value, String fallback) {
        String name = value == null ? "" : value.trim();
        return name.isEmpty() ? fallback : name;
    }

    private static String folderId(String source, String path) {
        return "folder:" + source + ":" + Uri.encode(path == null ? "" : path);
    }

    private static String playableId(String source, String path) {
        return "play:" + source + ":" + Uri.encode(path == null ? "" : path);
    }

    private static boolean isPlayableOrArchive(String name) {
        String ext = extensionOf(name);
        return isArchive(ext) || isPlayable(ext);
    }

    private static boolean isArchive(String ext) {
        return ext.equals("zip") || ext.equals("7z") || ext.equals("rar") || ext.equals("tar")
            || ext.equals("gz") || ext.equals("tgz") || ext.equals("bz2") || ext.equals("xz")
            || ext.equals("lha") || ext.equals("lzh") || ext.equals("rsn") || ext.equals("vgmz")
            || ext.equals("vgmdz") || ext.equals("vgmpack") || ext.equals("vigamup");
    }

    private static boolean isPlayable(String ext) {
        return ext.equals("vgm") || ext.equals("vgz") || ext.equals("nsf") || ext.equals("nsfe")
            || ext.equals("spc") || ext.equals("gym") || ext.equals("kss") || ext.equals("hes")
            || ext.equals("ssf") || ext.equals("minissf") || ext.equals("psf") || ext.equals("psf2")
            || ext.equals("usf") || ext.equals("miniusf") || ext.equals("gsf") || ext.equals("minigsf")
            || ext.equals("2sf") || ext.equals("mini2sf") || ext.equals("dsf") || ext.equals("minidsf")
            || ext.equals("qsf") || ext.equals("miniqsf") || ext.equals("xm") || ext.equals("mod")
            || ext.equals("s3m") || ext.equals("it") || ext.equals("mptm") || ext.equals("lmp")
            || ext.equals("sap") || ext.equals("ay") || ext.equals("gbs") || ext.equals("flac")
            || ext.equals("ape") || ext.equals("mid") || ext.equals("midi") || ext.equals("mwm")
            || ext.equals("mgs");
    }

    private static String extensionOf(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String stripExt(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : safeName(name, "Track");
    }

    private AndroidLibraryCatalog() {
    }
}
