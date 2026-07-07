package com.vgmplay.nativeplayer;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.net.Uri;

import androidx.documentfile.provider.DocumentFile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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

    static final class Entry {
        final String id;
        final String parentId;
        final String title;
        final String subtitle;
        final String nativePath;
        final String artUri;
        final String archivePath;
        final String archiveTrackPathSuffix;
        final boolean browsable;
        final boolean playable;

        Entry(String id, String parentId, String title, String subtitle, String nativePath, boolean browsable, boolean playable) {
            this(id, parentId, title, subtitle, nativePath, "", browsable, playable);
        }

        Entry(String id, String parentId, String title, String subtitle, String nativePath, String artUri, boolean browsable, boolean playable) {
            this(id, parentId, title, subtitle, nativePath, artUri, "", "", browsable, playable);
        }

        Entry(String id, String parentId, String title, String subtitle, String nativePath, String artUri, String archivePath, String archiveTrackPathSuffix, boolean browsable, boolean playable) {
            this.id = id;
            this.parentId = parentId;
            this.title = title;
            this.subtitle = subtitle;
            this.nativePath = nativePath;
            this.artUri = artUri;
            this.archivePath = archivePath == null ? "" : archivePath;
            this.archiveTrackPathSuffix = archiveTrackPathSuffix == null ? "" : archiveTrackPathSuffix;
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

    static String signature(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String libraryDirs = prefs.getString(PREF_LIBRARY_DIRS, "[]");
        String archiveMeta = prefs.getString("archiveMeta", "{}");
        return (prefs.getBoolean(PREF_SHOW_INCLUDED_MUSIC, true) ? "1" : "0")
            + "|"
            + (prefs.getBoolean(PREF_INCLUDED_MUSIC_DELETED, false) ? "1" : "0")
            + "|"
            + safeName(libraryDirs, "[]").hashCode()
            + "|"
            + safeName(archiveMeta, "{}").hashCode();
    }

    static List<Entry> childrenOf(Context context, String parentId) {
        String id = parentId == null ? ROOT_ID : parentId;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        ArchiveMetaIndex archiveMeta = ArchiveMetaIndex.load(prefs);
        if (ROOT_ID.equals(id)) return rootChildren(context, prefs);
        if (id.startsWith("folder:asset:")) return assetFolderChildren(context.getAssets(), archiveMeta, id);
        if (id.startsWith("folder:doc:")) return documentFolderChildren(context, archiveMeta, id);
        if (id.startsWith("play:asset:") || id.startsWith("play:doc:")) return playableChildren(context, archiveMeta, id);
        return new ArrayList<>();
    }

    private static List<Entry> rootChildren(Context context, SharedPreferences prefs) {
        List<Entry> out = new ArrayList<>();
        boolean showIncluded = prefs.getBoolean(PREF_SHOW_INCLUDED_MUSIC, true)
            && !prefs.getBoolean(PREF_INCLUDED_MUSIC_DELETED, false);
        if (showIncluded) {
            out.add(new Entry(assetFolderId("dist", INCLUDED_LABEL + "/"), ROOT_ID, INCLUDED_LABEL, "Bundled music", "", true, false));
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
            out.add(new Entry(documentFolderId(uri.toString(), "", label + "/", label + "/"), ROOT_ID, label, "Selected folder", "", true, false));
        }
        return out;
    }

    private static List<Entry> assetFolderChildren(AssetManager assets, ArchiveMetaIndex archiveMeta, String folderId) {
        List<Entry> out = new ArrayList<>();
        String[] payload = payload(folderId);
        String assetDir = part(payload, 0);
        String relativePrefix = part(payload, 1);
        try {
            String[] names = assets.list(assetDir);
            if (names == null) return out;
            for (String name : names) {
                if (name == null || name.isEmpty() || name.startsWith(".")) continue;
                String assetPath = assetDir + "/" + name;
                String relativePath = relativePrefix + name;
                String[] children = assets.list(assetPath);
                if (children != null && children.length > 0) {
                    out.add(new Entry(assetFolderId(assetPath, relativePath + "/"), folderId, name, "", "", true, false));
                } else if (isPlayableOrArchive(name)) {
                    out.add(assetFileEntry(assets, archiveMeta, folderId, assetPath, relativePath));
                }
            }
        } catch (IOException ignored) {
            return new ArrayList<>();
        }
        return out;
    }

    private static List<Entry> documentFolderChildren(Context context, ArchiveMetaIndex archiveMeta, String folderId) {
        List<Entry> out = new ArrayList<>();
        String[] payload = payload(folderId);
        String treeUri = part(payload, 0);
        String path = part(payload, 1);
        String relativePrefix = part(payload, 2);
        String nativePrefix = part(payload, 3);
        DocumentFile folder = documentAt(context, treeUri, path);
        if (folder == null || !folder.isDirectory()) return out;
        for (DocumentFile child : folder.listFiles()) {
            if (child == null) continue;
            String childName = safeName(child.getName(), "");
            if (childName.isEmpty() || childName.startsWith(".")) continue;
            String childPath = appendPath(path, childName);
            if (child.isDirectory()) {
                out.add(new Entry(documentFolderId(treeUri, childPath, relativePrefix + childName + "/", nativePrefix + childName + "/"), folderId, childName, "", "", true, false));
            } else if (isPlayableOrArchive(childName)) {
                out.add(documentFileEntry(context, archiveMeta, folderId, treeUri, childPath, relativePrefix + childName, "android/" + nativePrefix + childName, child));
            }
        }
        return out;
    }

    private static List<Entry> playableChildren(Context context, ArchiveMetaIndex archiveMeta, String id) {
        PlayableRef ref = playableRef(context, id);
        if (ref == null) return new ArrayList<>();
        if (ref.gameIndex >= 0) return archiveGameChildren(archiveMeta, ref);

        ArchiveMetaIndex.Preview preview = archiveMeta.previewFor("android://libraries", ref.relativePath, ref.size, ref.mtime, ref.format);
        if (preview.hasBrowseChildren()) {
            Snapshot snapshot = new Snapshot();
            preview.addBrowseChildren(snapshot, ref.baseId, ref.nativePath);
            return snapshot.childrenOf(ref.baseId);
        }

        if ("NSF".equals(ref.format)) {
            int count = ref.assetPath.isEmpty()
                ? nsfTrackCount(context, ref.document, "nsf")
                : nsfTrackCount(context.getAssets(), ref.assetPath, "nsf");
            Snapshot snapshot = new Snapshot();
            addSyntheticTracks(snapshot, ref.baseId, ref.nativePath, ref.format, Math.max(1, count));
            return snapshot.childrenOf(ref.baseId);
        }
        return new ArrayList<>();
    }

    private static List<Entry> archiveGameChildren(ArchiveMetaIndex archiveMeta, PlayableRef ref) {
        ArchiveMetaIndex.Preview preview = archiveMeta.previewFor("android://libraries", ref.relativePath, ref.size, ref.mtime, ref.format);
        if (!preview.hasBrowseChildren()) return new ArrayList<>();
        Snapshot snapshot = new Snapshot();
        preview.addBrowseChildren(snapshot, ref.baseId, ref.nativePath);
        return snapshot.childrenOf(ref.baseId + ":game:" + ref.gameIndex);
    }

    private static Entry assetFileEntry(AssetManager assets, ArchiveMetaIndex archiveMeta, String parentId, String assetPath, String relativePath) {
        String name = baseName(assetPath);
        String ext = extensionOf(name);
        String fallbackFormat = ext.toUpperCase(Locale.ROOT);
        long size = assetSize(assets, assetPath);
        ArchiveMetaIndex.Preview preview = archiveMeta.previewFor("android://libraries", relativePath, size, 0, fallbackFormat);
        boolean archive = isArchive(ext);
        boolean browsable = preview.hasBrowseChildren() || archive || "nsf".equals(ext);
        boolean playable = !browsable;
        return new Entry(
            assetPlayableId(assetPath, relativePath),
            parentId,
            preview.titleOr(stripExt(name)),
            preview.subtitleOr(fallbackFormat),
            "apk/assets/" + assetPath,
            preview.artUri,
            browsable,
            playable
        );
    }

    private static Entry documentFileEntry(Context context, ArchiveMetaIndex archiveMeta, String parentId, String treeUri, String path, String relativePath, String nativePath, DocumentFile node) {
        String name = safeName(node == null ? "" : node.getName(), baseName(path));
        String ext = extensionOf(name);
        String fallbackFormat = ext.toUpperCase(Locale.ROOT);
        long size = node == null ? 0 : Math.max(0, node.length());
        long mtime = node == null ? 0 : Math.max(0, node.lastModified());
        ArchiveMetaIndex.Preview preview = archiveMeta.previewFor("android://libraries", relativePath, size, mtime, fallbackFormat);
        boolean archive = isArchive(ext);
        boolean browsable = preview.hasBrowseChildren() || archive || "nsf".equals(ext);
        boolean playable = !browsable;
        return new Entry(
            documentPlayableId(treeUri, path, relativePath, nativePath),
            parentId,
            preview.titleOr(stripExt(name)),
            preview.subtitleOr(fallbackFormat),
            nativePath,
            preview.artUri,
            browsable,
            playable
        );
    }

    private static PlayableRef playableRef(Context context, String id) {
        int gameMarker = id.indexOf(":game:");
        String baseId = gameMarker >= 0 ? id.substring(0, gameMarker) : id;
        int gameIndex = -1;
        if (gameMarker >= 0) {
            try {
                String gamePart = id.substring(gameMarker + 6);
                int next = gamePart.indexOf(':');
                gameIndex = Integer.parseInt(next >= 0 ? gamePart.substring(0, next) : gamePart);
            } catch (RuntimeException ignored) {
                gameIndex = -1;
            }
        }
        String[] payload = payload(baseId);
        if (baseId.startsWith("play:asset:")) {
            String assetPath = part(payload, 0);
            String relativePath = part(payload, 1);
            String name = baseName(assetPath);
            String format = extensionOf(name).toUpperCase(Locale.ROOT);
            return new PlayableRef(baseId, gameIndex, assetPath, "", null, relativePath, "apk/assets/" + assetPath, assetSize(context.getAssets(), assetPath), 0, format);
        }
        if (baseId.startsWith("play:doc:")) {
            String treeUri = part(payload, 0);
            String path = part(payload, 1);
            String relativePath = part(payload, 2);
            String nativePath = part(payload, 3);
            DocumentFile doc = documentAt(context, treeUri, path);
            String name = safeName(doc == null ? "" : doc.getName(), baseName(path));
            String format = extensionOf(name).toUpperCase(Locale.ROOT);
            return new PlayableRef(baseId, gameIndex, "", treeUri, doc, relativePath, nativePath, doc == null ? 0 : Math.max(0, doc.length()), doc == null ? 0 : Math.max(0, doc.lastModified()), format);
        }
        return null;
    }

    private static DocumentFile documentAt(Context context, String treeUri, String path) {
        DocumentFile current = DocumentFile.fromTreeUri(context, Uri.parse(treeUri));
        if (current == null) return null;
        if (path == null || path.isEmpty()) return current;
        for (String part : path.split("/", -1)) {
            if (part.isEmpty()) continue;
            current = current.findFile(part);
            if (current == null) return null;
        }
        return current;
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

    private static String assetFolderId(String assetDir, String relativePrefix) {
        return "folder:asset:" + encodePayload(assetDir, relativePrefix);
    }

    private static String documentFolderId(String treeUri, String path, String relativePrefix, String nativePrefix) {
        return "folder:doc:" + encodePayload(treeUri, path, relativePrefix, nativePrefix);
    }

    private static String assetPlayableId(String assetPath, String relativePath) {
        return "play:asset:" + encodePayload(assetPath, relativePath);
    }

    private static String documentPlayableId(String treeUri, String path, String relativePath, String nativePath) {
        return "play:doc:" + encodePayload(treeUri, path, relativePath, nativePath);
    }

    private static String encodePayload(String... parts) {
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (out.length() > 0) out.append('\n');
            out.append(part == null ? "" : part);
        }
        return Uri.encode(out.toString());
    }

    private static String[] payload(String id) {
        int marker = id.indexOf(':');
        marker = marker < 0 ? -1 : id.indexOf(':', marker + 1);
        if (marker < 0 || marker >= id.length() - 1) return new String[0];
        return Uri.decode(id.substring(marker + 1)).split("\n", -1);
    }

    private static String part(String[] parts, int index) {
        return parts != null && index >= 0 && index < parts.length ? safeName(parts[index], "") : "";
    }

    private static String appendPath(String parent, String child) {
        if (parent == null || parent.isEmpty()) return child == null ? "" : child;
        return parent + "/" + safeName(child, "");
    }

    private static String baseName(String path) {
        if (path == null || path.isEmpty()) return "";
        int slash = path.lastIndexOf('/');
        return slash >= 0 ? path.substring(slash + 1) : path;
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
            || ext.equals("spc") || ext.equals("gym") || ext.equals("sid") || ext.equals("psid")
            || ext.equals("rsid") || ext.equals("kss") || ext.equals("hes")
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

    private static long assetSize(AssetManager assets, String assetPath) {
        try (AssetFileDescriptor descriptor = assets.openFd(assetPath)) {
            return Math.max(0, descriptor.getLength());
        } catch (IOException err) {
            return 0;
        }
    }

    private static int nsfTrackCount(AssetManager assets, String assetPath, String ext) {
        if (!"nsf".equals(ext)) return 0;
        try (InputStream in = assets.open(assetPath)) {
            return nsfTrackCount(in);
        } catch (IOException err) {
            return 0;
        }
    }

    private static int nsfTrackCount(Context context, DocumentFile node, String ext) {
        if (!"nsf".equals(ext) || context == null || node == null) return 0;
        try (InputStream in = context.getContentResolver().openInputStream(node.getUri())) {
            return nsfTrackCount(in);
        } catch (IOException | RuntimeException err) {
            return 0;
        }
    }

    private static int nsfTrackCount(InputStream in) throws IOException {
        if (in == null) return 0;
        byte[] header = new byte[8];
        int offset = 0;
        while (offset < header.length) {
            int read = in.read(header, offset, header.length - offset);
            if (read < 0) break;
            offset += read;
        }
        if (offset < 8) return 0;
        if (header[0] != 'N' || header[1] != 'E' || header[2] != 'S' || header[3] != 'M' || header[4] != 0x1A) return 0;
        return header[6] & 0xFF;
    }

    private static void addSyntheticTracks(Snapshot snapshot, String parentId, String nativePath, String format, int count) {
        int safeCount = Math.max(1, count);
        for (int i = 0; i < safeCount; i++) {
            snapshot.add(new Entry(
                parentId + ":track:" + i,
                parentId,
                "Track " + (i + 1),
                format,
                nativePath,
                "",
                "",
                "|track=" + i,
                false,
                true
            ));
        }
    }

    private static final class PlayableRef {
        final String baseId;
        final int gameIndex;
        final String assetPath;
        final String treeUri;
        final DocumentFile document;
        final String relativePath;
        final String nativePath;
        final long size;
        final long mtime;
        final String format;

        PlayableRef(String baseId, int gameIndex, String assetPath, String treeUri, DocumentFile document, String relativePath, String nativePath, long size, long mtime, String format) {
            this.baseId = baseId;
            this.gameIndex = gameIndex;
            this.assetPath = assetPath == null ? "" : assetPath;
            this.treeUri = treeUri == null ? "" : treeUri;
            this.document = document;
            this.relativePath = relativePath == null ? "" : relativePath;
            this.nativePath = nativePath == null ? "" : nativePath;
            this.size = Math.max(0, size);
            this.mtime = Math.max(0, mtime);
            this.format = format == null ? "" : format;
        }
    }

    private static final class ArchiveMetaIndex {
        private final JSONObject quick;
        private final JSONObject packsBySha;

        private ArchiveMetaIndex(JSONObject quick, JSONObject packsBySha) {
            this.quick = quick == null ? new JSONObject() : quick;
            this.packsBySha = packsBySha == null ? new JSONObject() : packsBySha;
        }

        static ArchiveMetaIndex load(SharedPreferences prefs) {
            String raw = prefs.getString("archiveMeta", "{}");
            try {
                JSONObject root = new JSONObject(raw == null || raw.isEmpty() ? "{}" : raw);
                return new ArchiveMetaIndex(root.optJSONObject("quick"), root.optJSONObject("packsBySha"));
            } catch (JSONException err) {
                return new ArchiveMetaIndex(new JSONObject(), new JSONObject());
            }
        }

        Preview previewFor(String rootUrl, String relativePath, long sizeBytes, long mtime, String containerFormat) {
            String key = safeName(rootUrl, "") + "|" + safeName(relativePath, "") + "|" + Math.max(0, sizeBytes) + "|" + Math.max(0, mtime);
            String sha = quick.optString(key, "");
            JSONObject pack = sha.isEmpty() ? null : packsBySha.optJSONObject(sha);
            if (pack == null) return Preview.EMPTY;
            return Preview.fromPack(pack, containerFormat);
        }

        static final class Preview {
            static final Preview EMPTY = new Preview("", "", "", null);
            final String title;
            final String subtitle;
            final String artUri;
            final JSONObject pack;

            Preview(String title, String subtitle, String artUri, JSONObject pack) {
                this.title = title == null ? "" : title;
                this.subtitle = subtitle == null ? "" : subtitle;
                this.artUri = artUri == null ? "" : artUri;
                this.pack = pack;
            }

            String titleOr(String fallback) {
                return title.isEmpty() ? fallback : title;
            }

            String subtitleOr(String fallback) {
                return subtitle.isEmpty() ? fallback : subtitle;
            }

            boolean hasBrowseChildren() {
                if (pack == null) return false;
                JSONArray games = pack.optJSONArray("games");
                JSONArray tracks = pack.optJSONArray("tracks");
                return (games != null && games.length() > 0) || (tracks != null && tracks.length() > 0);
            }

            void addBrowseChildren(Snapshot snapshot, String parentId, String nativePath) {
                if (pack == null) return;
                JSONArray games = pack.optJSONArray("games");
                if (games != null && games.length() > 0) {
                    for (int i = 0; i < games.length(); i++) {
                        JSONObject game = games.optJSONObject(i);
                        if (game == null) continue;
                        JSONArray tracks = tracksForGame(game);
                        String gameId = parentId + ":game:" + i;
                        String gameTitle = cleanTitle(game.optString("name", ""));
                        if (gameTitle.isEmpty()) gameTitle = "Game " + (i + 1);
                        String gameFormat = game.optString("format", "");
                        String gameArt = firstNonEmpty(game.optString("coverUrl", ""), artUri);
                        snapshot.add(new Entry(gameId, parentId, gameTitle, gameFormat, nativePath, gameArt, true, false));
                        addTracks(snapshot, gameId, nativePath, gameArt, tracks, game.optString("path", ""));
                    }
                    return;
                }
                addTracks(snapshot, parentId, nativePath, artUri, pack.optJSONArray("tracks"), "");
            }

            private static JSONArray tracksForGame(JSONObject game) {
                JSONArray tracks = game.optJSONArray("tracks");
                if (tracks != null && tracks.length() > 0) return tracks;
                JSONArray out = new JSONArray();
                int count = Math.max(0, game.optInt("trackCount", 0));
                String path = game.optString("path", "");
                String format = game.optString("format", "");
                for (int i = 0; i < count; i++) {
                    JSONObject track = new JSONObject();
                    try {
                        track.put("name", "Track " + (i + 1));
                        track.put("path", path);
                        track.put("format", format);
                        track.put("trackPathSuffix", "|track=" + i);
                    } catch (JSONException ignored) {}
                    out.put(track);
                }
                return out;
            }

            private static void addTracks(Snapshot snapshot, String parentId, String nativePath, String inheritedArt, JSONArray tracks, String fallbackPath) {
                if (tracks == null) return;
                for (int i = 0; i < tracks.length(); i++) {
                    JSONObject track = tracks.optJSONObject(i);
                    if (track == null) continue;
                    JSONObject metadata = track.optJSONObject("metadata");
                    String archivePath = track.optString("path", fallbackPath);
                    String suffix = track.optString("trackPathSuffix", "");
                    String title = track.optString("name", "");
                    if (title.isEmpty() && metadata != null) title = metadata.optString("trackTitle", metadata.optString("title", ""));
                    if (title.isEmpty()) title = archivePath.isEmpty() ? "Track " + (i + 1) : stripExt(archivePath.substring(archivePath.lastIndexOf('/') + 1));
                    String format = track.optString("format", "");
                    if (format.isEmpty() && metadata != null) format = metadata.optString("format", "");
                    String trackArt = metadata == null ? "" : metadata.optString("coverUrl", "");
                    if (trackArt.isEmpty()) trackArt = inheritedArt;
                    snapshot.add(new Entry(
                        parentId + ":track:" + i,
                        parentId,
                        title,
                        format,
                        nativePath,
                        trackArt,
                        archivePath,
                        suffix,
                        false,
                        true
                    ));
                }
            }

            static Preview fromPack(JSONObject pack, String containerFormat) {
                LinkedHashSet<String> formats = new LinkedHashSet<>();
                addFormat(formats, containerFormat);
                JSONArray games = pack.optJSONArray("games");
                collectFormats(formats, games);
                collectFormats(formats, pack.optJSONArray("tracks"));
                String title = bestTitle(pack, games);
                String art = firstNonEmpty(pack.optString("coverUrl", ""), firstGameArt(games));
                return new Preview(title, joinFormats(formats), art, pack);
            }

            private static String bestTitle(JSONObject pack, JSONArray games) {
                String title = cleanTitle(pack.optString("title", ""));
                if (!title.isEmpty()) return title;
                if (games != null && games.length() == 1) {
                    JSONObject game = games.optJSONObject(0);
                    if (game != null) {
                        title = cleanTitle(game.optString("name", ""));
                        if (!title.isEmpty()) return title;
                    }
                }
                return "";
            }

            private static String cleanTitle(String value) {
                String title = value == null ? "" : value.trim();
                if (title.isEmpty()) return "";
                String upper = title.toUpperCase(Locale.ROOT);
                if (upper.equals("ZIP") || upper.equals("7Z") || upper.equals("RAR") || upper.equals("TAR") || upper.equals("GZ")) return "";
                return title;
            }

            private static void collectFormats(LinkedHashSet<String> formats, JSONArray array) {
                if (array == null) return;
                for (int i = 0; i < array.length(); i++) {
                    JSONObject item = array.optJSONObject(i);
                    if (item == null) continue;
                    addFormat(formats, item.optString("format", ""));
                    collectFormats(formats, item.optJSONArray("tracks"));
                }
            }

            private static String firstGameArt(JSONArray games) {
                if (games == null) return "";
                for (int i = 0; i < games.length(); i++) {
                    JSONObject game = games.optJSONObject(i);
                    if (game == null) continue;
                    String cover = game.optString("coverUrl", "");
                    if (!cover.isEmpty()) return cover;
                }
                return "";
            }

            private static void addFormat(LinkedHashSet<String> formats, String format) {
                String clean = format == null ? "" : format.trim().toUpperCase(Locale.ROOT);
                if (!clean.isEmpty()) formats.add(clean);
            }

            private static String joinFormats(LinkedHashSet<String> formats) {
                StringBuilder out = new StringBuilder();
                for (String format : formats) {
                    if (out.length() > 0) out.append(", ");
                    out.append(format);
                }
                return out.toString();
            }

            private static String firstNonEmpty(String first, String second) {
                return first != null && !first.isEmpty() ? first : (second == null ? "" : second);
            }
        }
    }

    private AndroidLibraryCatalog() {
    }
}
