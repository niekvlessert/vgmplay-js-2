package com.vgmplay.nativeplayer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;

import androidx.annotation.Nullable;
import androidx.documentfile.provider.DocumentFile;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends Activity {
    private static final String TAG = "VGMPlayAndroid";
    private static final int REQUEST_OPEN_TREE = 10;
    private static final String ASSET_BASE = "https://vgmplay.local/assets/";
    private static final String START_PAGE = ASSET_BASE + "native-index.html";
    private static final String PREF_LIBRARY_TREE_URI = "libraryTreeUri";

    private final Map<String, Uri> fileHandles = new HashMap<>();
    private final AtomicInteger nextFileId = new AtomicInteger(1);

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private SharedPreferences prefs;
    private boolean initialLibraryLoaded;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView.setWebContentsDebuggingEnabled(true);

        prefs = getSharedPreferences("vgmplay-native", MODE_PRIVATE);
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("vgmplay.local")
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/file/", new SafFileHandler())
            .build();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(26, 27, 38));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(10), dp(6), dp(10), dp(6));
        toolbar.setBackgroundColor(Color.rgb(31, 33, 48));

        Button openFolder = new Button(this);
        openFolder.setText("Open Folder");
        openFolder.setAllCaps(false);
        openFolder.setOnClickListener(view -> openMusicFolder());
        toolbar.addView(openFolder, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                if (consoleMessage == null) return false;
                String message = "JS Console [" + consoleMessage.messageLevel() + "]: "
                    + consoleMessage.message() + " @ "
                    + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber();
                switch (consoleMessage.messageLevel()) {
                    case ERROR:
                        Log.e(TAG, message);
                        break;
                    case WARNING:
                        Log.w(TAG, message);
                        break;
                    default:
                        Log.i(TAG, message);
                        break;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse imageResponse = handleNativeImageRequest(request.getUrl());
                if (imageResponse != null) return imageResponse;
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                loadInitialLibrary();
            }
        });

        webView.clearCache(true);

        root.addView(toolbar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        root.addView(webView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1
        ));
        setContentView(root);

        webView.loadUrl(START_PAGE + "?v=" + System.currentTimeMillis());
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void openMusicFolder() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_OPEN_TREE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_OPEN_TREE || resultCode != RESULT_OK || data == null || data.getData() == null) {
            return;
        }

        Uri treeUri = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContentResolver().takePersistableUriPermission(treeUri, flags & Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException err) {
            Log.w(TAG, "Could not persist folder permission", err);
        }
        prefs.edit().putString(PREF_LIBRARY_TREE_URI, treeUri.toString()).apply();
        loadMusicTree(treeUri);
    }

    private void loadInitialLibrary() {
        if (initialLibraryLoaded) return;
        initialLibraryLoaded = true;

        String savedTree = prefs.getString(PREF_LIBRARY_TREE_URI, "");
        if (savedTree != null && !savedTree.isEmpty()) {
            try {
                Uri treeUri = Uri.parse(savedTree);
                DocumentFile root = DocumentFile.fromTreeUri(this, treeUri);
                if (root != null && root.isDirectory() && root.canRead()) {
                    loadMusicTree(treeUri);
                    return;
                }
            } catch (RuntimeException err) {
                Log.w(TAG, "Saved Android music folder is no longer readable", err);
            }
            prefs.edit().remove(PREF_LIBRARY_TREE_URI).apply();
        }

        loadBundledDistLibrary();
    }

    private void loadBundledDistLibrary() {
        JSONArray items = new JSONArray();
        try {
            scanAssetDirectory("dist", "", items);
        } catch (IOException err) {
            Log.e(TAG, "Could not scan bundled dist assets", err);
            return;
        }

        JSONObject payload = new JSONObject();
        try {
            JSONObject options = new JSONObject();
            options.put("rootName", "Bundled Music");
            options.put("rootPath", "apk://assets/dist");
            payload.put("items", items);
            payload.put("options", options);
        } catch (JSONException err) {
            Log.e(TAG, "Failed to build bundled library payload", err);
            return;
        }

        loadNativeLibraryPayload(payload);
    }

    private void scanAssetDirectory(String assetDir, String relativePrefix, JSONArray items) throws IOException {
        AssetManager assets = getAssets();
        String[] names = assets.list(assetDir);
        if (names == null) return;
        for (String name : names) {
            if (name == null || name.isEmpty() || name.startsWith(".")) continue;
            String assetPath = assetDir + "/" + name;
            String relativePath = relativePrefix + name;
            String[] children = assets.list(assetPath);
            if (children != null && children.length > 0) {
                scanAssetDirectory(assetPath, relativePath + "/", items);
            } else {
                addAssetLibraryItem(assetPath, relativePath, name, items);
            }
        }
    }

    private void addAssetLibraryItem(String assetPath, String relativePath, String name, JSONArray items) {
        JSONObject item = new JSONObject();
        try {
            item.put("url", ASSET_BASE + Uri.encode(assetPath, "/"));
            item.put("name", name);
            item.put("relativePath", relativePath);
            item.put("nativePath", "apk/assets/" + assetPath);
            item.put("kind", classifyFile(name));
            item.put("sizeBytes", assetSize(assetPath));
            item.put("mtime", 0);
            items.put(item);
        } catch (JSONException err) {
            Log.w(TAG, "Skipping bundled asset with invalid metadata: " + assetPath, err);
        }
    }

    private long assetSize(String assetPath) {
        try (AssetFileDescriptor descriptor = getAssets().openFd(assetPath)) {
            return Math.max(0, descriptor.getLength());
        } catch (IOException err) {
            return 0;
        }
    }

    private void loadMusicTree(Uri treeUri) {
        DocumentFile root = DocumentFile.fromTreeUri(this, treeUri);
        if (root == null || !root.isDirectory()) return;

        fileHandles.clear();
        nextFileId.set(1);

        JSONArray items = new JSONArray();
        scanDocumentFile(root, "", items);

        JSONObject payload = new JSONObject();
        try {
            JSONObject options = new JSONObject();
            options.put("rootName", root.getName() == null ? "Android Music" : root.getName());
            options.put("rootPath", "android://" + DocumentsContract.getTreeDocumentId(treeUri));
            payload.put("items", items);
            payload.put("options", options);
        } catch (JSONException err) {
            Log.e(TAG, "Failed to build library payload", err);
            return;
        }

        loadNativeLibraryPayload(payload);
    }

    private void loadNativeLibraryPayload(JSONObject payload) {
        String script = "(function(payload){"
            + "var attempts=0;"
            + "function deliver(){"
            + "if(window.loadNativeLibraryIndex){window.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
            + "if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
            + "window.__pendingNativeLibraryPayload=payload;"
            + "if(++attempts<80)setTimeout(deliver,100);"
            + "}"
            + "deliver();"
            + "})(" + payload + ");";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void scanDocumentFile(DocumentFile node, String relativePrefix, JSONArray items) {
        if (node == null) return;
        if (node.isDirectory()) {
            String name = node.getName();
            String nextPrefix = relativePrefix;
            if (name != null && !relativePrefix.isEmpty()) {
                nextPrefix = relativePrefix + name + "/";
            } else if (name != null && node.getParentFile() != null) {
                nextPrefix = name + "/";
            }
            for (DocumentFile child : node.listFiles()) {
                scanDocumentFile(child, nextPrefix, items);
            }
            return;
        }

        if (!node.isFile()) return;
        String name = node.getName();
        if (name == null || name.startsWith(".")) return;

        String id = "f" + nextFileId.getAndIncrement();
        fileHandles.put(id, node.getUri());

        String relativePath = relativePrefix + name;
        JSONObject item = new JSONObject();
        try {
            item.put("url", "https://vgmplay.local/file/" + id + "/" + Uri.encode(name));
            item.put("name", name);
            item.put("relativePath", relativePath);
            item.put("nativePath", "android/" + relativePath);
            item.put("kind", classifyFile(name));
            item.put("sizeBytes", Math.max(0, node.length()));
            item.put("mtime", Math.max(0, node.lastModified()));
            items.put(item);
        } catch (JSONException err) {
            Log.w(TAG, "Skipping file with invalid metadata: " + name, err);
        }
    }

    private String classifyFile(String name) {
        String ext = extensionOf(name);
        if (isArchive(ext)) return "archive";
        if (isImage(ext)) return "image";
        if (isPlayable(ext)) return "playable";
        return "unsupported";
    }

    private boolean isArchive(String ext) {
        return ext.equals("zip") || ext.equals("7z") || ext.equals("rar") || ext.equals("tar")
            || ext.equals("gz") || ext.equals("tgz") || ext.equals("bz2") || ext.equals("xz")
            || ext.equals("lha") || ext.equals("lzh");
    }

    private boolean isImage(String ext) {
        return ext.equals("png") || ext.equals("jpg") || ext.equals("jpeg") || ext.equals("webp") || ext.equals("gif");
    }

    private boolean isPlayable(String ext) {
        return ext.equals("vgm") || ext.equals("vgz") || ext.equals("nsf") || ext.equals("nsfe")
            || ext.equals("spc") || ext.equals("gym") || ext.equals("kss") || ext.equals("hes")
            || ext.equals("ssf") || ext.equals("minissf") || ext.equals("psf") || ext.equals("psf2")
            || ext.equals("usf") || ext.equals("miniusf") || ext.equals("gsf") || ext.equals("minigsf")
            || ext.equals("2sf") || ext.equals("mini2sf") || ext.equals("dsf") || ext.equals("minidsf")
            || ext.equals("qsf") || ext.equals("miniqsf") || ext.equals("xm") || ext.equals("mod")
            || ext.equals("s3m") || ext.equals("it") || ext.equals("mptm") || ext.equals("lmp")
            || ext.equals("sap") || ext.equals("ay") || ext.equals("gbs");
    }

    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private WebResourceResponse handleNativeImageRequest(Uri uri) {
        if (!"vgmplay".equals(uri.getScheme())) return null;
        String imagePath = uri.getHost() == null ? uri.getSchemeSpecificPart() : Uri.decode(uri.getHost());
        if (imagePath != null && imagePath.startsWith("//")) imagePath = imagePath.substring(2);
        File file = new File(getFilesDir(), "archive-images/" + sanitizeImageKey(imagePath));
        if (!file.isFile()) return null;
        try {
            return new WebResourceResponse(mimeForName(file.getName()), "UTF-8", new FileInputStream(file));
        } catch (IOException err) {
            Log.w(TAG, "Failed to serve native image", err);
            return null;
        }
    }

    private File imageFileForPath(String imagePath) {
        File dir = new File(getFilesDir(), "archive-images");
        if (!dir.exists() && !dir.mkdirs()) {
            Log.w(TAG, "Could not create archive image directory: " + dir);
        }
        return new File(dir, sanitizeImageKey(imagePath));
    }

    private String sanitizeImageKey(String value) {
        String key = value == null ? "image" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return key.length() > 180 ? key.substring(key.length() - 180) : key;
    }

    private String mimeForName(String name) {
        String ext = extensionOf(name);
        if (ext.equals("wasm")) return "application/wasm";
        if (ext.equals("js")) return "application/javascript";
        if (ext.equals("css")) return "text/css";
        if (ext.equals("html")) return "text/html";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "application/octet-stream" : mime;
    }

    private JSONObject parseObjectPref(String key) {
        String value = prefs.getString(key, "{}");
        try {
            return new JSONObject(value == null || value.isEmpty() ? "{}" : value);
        } catch (JSONException err) {
            Log.w(TAG, "Ignoring invalid saved JSON for " + key, err);
            return new JSONObject();
        }
    }

    private final class SafFileHandler implements WebViewAssetLoader.PathHandler {
        @Override
        public WebResourceResponse handle(String path) {
            String normalized = path.startsWith("/") ? path.substring(1) : path;
            if (normalized.startsWith("file/")) normalized = normalized.substring("file/".length());
            int slash = normalized.indexOf('/');
            String id = slash >= 0 ? normalized.substring(0, slash) : normalized;
            Uri uri = fileHandles.get(id);
            if (uri == null) {
                return new WebResourceResponse("text/plain", "UTF-8",
                    new ByteArrayInputStream("Unknown file".getBytes()));
            }
            try {
                InputStream stream = getContentResolver().openInputStream(uri);
                String name = slash >= 0 ? Uri.decode(normalized.substring(slash + 1)) : id;
                return new WebResourceResponse(mimeForName(name), null, stream);
            } catch (IOException err) {
                Log.e(TAG, "Failed to serve SAF file", err);
                return new WebResourceResponse("text/plain", "UTF-8",
                    new ByteArrayInputStream("Could not read file".getBytes()));
            }
        }
    }

    private final class Bridge {
        @JavascriptInterface
        public String getInitialState() {
            JSONObject state = new JSONObject();
            try {
                state.put("config", parseObjectPref("config"));
                state.put("archiveMeta", parseObjectPref("archiveMeta"));
                state.put("trackMeta", parseObjectPref("trackMeta"));
                state.put("homeRoms", new JSONArray());
            } catch (JSONException err) {
                Log.w(TAG, "Failed to build initial bridge state", err);
            }
            return state.toString();
        }

        @JavascriptInterface
        public void postMessage(String name, String json) {
            try {
                JSONObject payload = new JSONObject(json == null || json.isEmpty() ? "{}" : json);
                if ("nativeSaveConfig".equals(name)) {
                    prefs.edit().putString("config", payload.toString()).apply();
                } else if ("nativeSaveArchiveMeta".equals(name)) {
                    prefs.edit().putString("archiveMeta", decodeArchiveMetaPayload(payload)).apply();
                } else if ("nativeSaveTrackMeta".equals(name)) {
                    prefs.edit().putString("trackMeta", payload.toString()).apply();
                } else if ("nativeSaveArchiveImage".equals(name)) {
                    saveArchiveImage(payload);
                } else if ("nativeOpenFile".equals(name)) {
                    Log.i(TAG, "nativeOpenFile is not used on Android");
                }
            } catch (JSONException err) {
                Log.w(TAG, "Invalid bridge payload for " + name, err);
            }
        }

        @JavascriptInterface
        public void log(String level, String message) {
            if ("error".equals(level)) {
                Log.e(TAG, message == null ? "" : message);
            } else if ("warn".equals(level)) {
                Log.w(TAG, message == null ? "" : message);
            } else {
                Log.i(TAG, message == null ? "" : message);
            }
        }

        private void saveArchiveImage(JSONObject payload) {
            String imagePath = payload.optString("path", "");
            String data = payload.optString("data", "");
            if (imagePath.isEmpty() || data.isEmpty()) return;
            int comma = data.indexOf(',');
            String base64 = comma >= 0 ? data.substring(comma + 1) : data;
            try (FileOutputStream output = new FileOutputStream(imageFileForPath(imagePath))) {
                output.write(Base64.decode(base64, Base64.DEFAULT));
            } catch (IOException | IllegalArgumentException err) {
                Log.w(TAG, "Could not save archive image", err);
            }
        }

        private String decodeArchiveMetaPayload(JSONObject payload) {
            if (!"base64-json".equals(payload.optString("encoding"))) return payload.toString();
            String data = payload.optString("data", "");
            if (data.isEmpty()) return "{}";
            try {
                return new String(Base64.decode(data, Base64.DEFAULT), java.nio.charset.StandardCharsets.UTF_8);
            } catch (IllegalArgumentException err) {
                Log.w(TAG, "Could not decode archive metadata payload", err);
                return "{}";
            }
        }
    }
}
