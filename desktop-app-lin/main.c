#include <dirent.h>
#include <gtk/gtk.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <webkit2/webkit2.h>

WebKitWebView *web_view;
static char app_dir[PATH_MAX] = {0};

static const char *archive_extensions[] = {".zip", ".7z", ".rar", ".rsn", ".vgmz", ".vgmdz", ".vgmpack", ".vigamup", NULL};
static const char *image_extensions[] = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", NULL};
static const char *support_extensions[] = {".mwk", ".psflib", ".ssflib", ".usflib", ".m3u", ".txt", ".trackinfo", ".gameinfo", NULL};
static const char *playable_extensions[] = {
    ".vgm", ".vgz", ".spc", ".nsf", ".nsfe", ".gbs", ".hes", ".sap",
    ".ay", ".kss", ".kssx", ".kscc", ".psf", ".minipsf", ".ssf",
    ".minissf", ".dsf", ".minidsf", ".usf", ".miniusf", ".mus", ".lmp",
    ".mid", ".midi", ".rmi", ".s3m", ".it", ".mod", ".xm", ".mptm",
    ".stm", ".mtm", ".669", ".amf", ".dmf", ".far", ".imf", ".med",
    ".okt", ".ptm", ".ult", ".umx", ".mwm", ".mgs", ".mbm", ".mp3",
    ".ogg", ".flac", ".wav", ".ape", ".m4a", ".aac", ".opus", ".wma",
    ".aif", ".aiff", ".aifc", ".bfstm", ".bcstm", ".brstm", ".adx",
    ".hca", ".dsp", ".idsp", ".vag", ".vgs", ".fsb", ".wem", ".xma",
    ".xma2", ".at3", ".at9", ".aa3", ".ac3", ".ast", ".bnsf", ".caf",
    ".dts", ".genh", ".hps", ".mca", ".msf", ".npsf", ".nus3bank",
    ".pcm", ".rsd", ".rwav", ".strm", ".swav", ".txth", ".txtp",
    ".vab", ".vas", ".xwb", ".xwm", ".ymf", ".zsm", NULL};

static int ext_in_list(const char *dot, const char **list) {
  if (!dot)
    return 0;
  for (int i = 0; list[i] != NULL; i++) {
    if (strcasecmp(dot, list[i]) == 0)
      return 1;
  }
  return 0;
}

static const char *kind_for_file(const char *filename) {
  const char *dot = strrchr(filename, '.');
  if (!dot)
    return "unsupported";
  if (ext_in_list(dot, archive_extensions)) return "archive";
  if (ext_in_list(dot, image_extensions)) return "image";
  if (ext_in_list(dot, support_extensions)) return "unsupported";
  if (ext_in_list(dot, playable_extensions)) return "playable";
  return "unsupported";
}

static void append_json_string(GString *out, const char *value) {
  char *escaped = g_strescape(value ? value : "", NULL);
  g_string_append_c(out, '"');
  g_string_append(out, escaped);
  g_string_append_c(out, '"');
  g_free(escaped);
}

static char *state_dir(void) {
  const char *home = g_get_home_dir();
  char *dir = g_build_filename(home ? home : ".", ".vgmplay_js", NULL);
  g_mkdir_with_parents(dir, 0700);
  return dir;
}

static char *library_config_path(void) {
  char *dir = state_dir();
  char *path = g_build_filename(dir, "library.ini", NULL);
  g_free(dir);
  return path;
}

static gboolean native_first_run(void) {
  char *path = library_config_path();
  gboolean first_run = !g_file_test(path, G_FILE_TEST_EXISTS);
  g_free(path);
  return first_run;
}

static GKeyFile *load_library_config(void) {
  GKeyFile *key = g_key_file_new();
  char *path = library_config_path();
  g_key_file_load_from_file(key, path, G_KEY_FILE_NONE, NULL);
  g_free(path);
  return key;
}

static void save_library_config(GKeyFile *key) {
  gsize len = 0;
  char *data = g_key_file_to_data(key, &len, NULL);
  char *path = library_config_path();
  if (data) g_file_set_contents(path, data, (gssize)len, NULL);
  g_free(path);
  g_free(data);
}

static gboolean path_has_music(const char *path) {
  DIR *handle = opendir(path);
  if (!handle) return FALSE;
  gboolean found = FALSE;
  struct dirent *ent;
  while (!found && (ent = readdir(handle)) != NULL) {
    if (strcmp(ent->d_name, ".") == 0 || strcmp(ent->d_name, "..") == 0) continue;
    char *full_path = g_build_filename(path, ent->d_name, NULL);
    struct stat st;
    if (stat(full_path, &st) == 0) {
      if (S_ISDIR(st.st_mode)) {
        found = path_has_music(full_path);
      } else if (S_ISREG(st.st_mode)) {
        const char *kind = kind_for_file(ent->d_name);
        found = kind && (strcmp(kind, "archive") == 0 || strcmp(kind, "playable") == 0);
      }
    }
    g_free(full_path);
  }
  closedir(handle);
  return found;
}

static char **library_dirs(GKeyFile *key, gsize *len_out) {
  char **dirs = g_key_file_get_string_list(key, "Library", "dirs", len_out, NULL);
  if (!dirs) {
    if (len_out) *len_out = 0;
    return g_new0(char *, 1);
  }
  return dirs;
}

static gboolean library_dir_enabled(GKeyFile *key, const char *path) {
  char *escaped = g_uri_escape_string(path ? path : "", NULL, TRUE);
  char *entry = g_strdup_printf("enabled.%s", escaped ? escaped : "");
  gboolean enabled = !g_key_file_has_key(key, "Library", entry, NULL) ||
                     g_key_file_get_boolean(key, "Library", entry, NULL);
  g_free(entry);
  g_free(escaped);
  return enabled;
}

static void set_library_dir_enabled(GKeyFile *key, const char *path, gboolean enabled) {
  char *escaped = g_uri_escape_string(path ? path : "", NULL, TRUE);
  char *entry = g_strdup_printf("enabled.%s", escaped ? escaped : "");
  g_key_file_set_boolean(key, "Library", entry, enabled);
  g_free(entry);
  g_free(escaped);
}

static char *unique_prefix_for_name(const char *name, GHashTable *counts) {
  const char *base = (name && *name) ? name : "Music";
  gpointer raw = g_hash_table_lookup(counts, base);
  int count = raw ? GPOINTER_TO_INT(raw) + 1 : 1;
  g_hash_table_replace(counts, g_strdup(base), GINT_TO_POINTER(count));
  return count <= 1 ? g_strdup(base) : g_strdup_printf("%s (%d)", base, count);
}

static char *native_library_settings_json(void) {
  GKeyFile *key = load_library_config();
  gsize len = 0;
  char **dirs = library_dirs(key, &len);
  GHashTable *counts = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  GString *dir_json = g_string_new("[");
  gboolean has_personal_music = FALSE;
  for (gsize i = 0; i < len; i++) {
    char *name = g_path_get_basename(dirs[i]);
    char *prefix = unique_prefix_for_name(name, counts);
    gboolean readable = g_file_test(dirs[i], G_FILE_TEST_IS_DIR);
    gboolean has_music = readable && path_has_music(dirs[i]);
    gboolean enabled = library_dir_enabled(key, dirs[i]);
    if (has_music) has_personal_music = TRUE;
    if (i > 0) g_string_append_c(dir_json, ',');
    g_string_append(dir_json, "{\"uri\":");
    append_json_string(dir_json, dirs[i]);
    g_string_append(dir_json, ",\"name\":");
    append_json_string(dir_json, name);
    g_string_append(dir_json, ",\"prefix\":");
    append_json_string(dir_json, prefix);
    g_string_append_printf(dir_json, ",\"enabled\":%s,\"readable\":%s,\"musicCount\":%d}",
                           enabled ? "true" : "false",
                           readable ? "true" : "false",
                           has_music ? 1 : 0);
    g_free(prefix);
    g_free(name);
  }
  g_string_append_c(dir_json, ']');

  char *dist_path = g_build_filename(app_dir, "dist", NULL);
  gboolean included_available = g_file_test(dist_path, G_FILE_TEST_IS_DIR);
  gboolean included_deleted = g_key_file_get_boolean(key, "Library", "includedDeleted", NULL);
  gboolean included_visible = !g_key_file_has_key(key, "Library", "showIncluded", NULL) ||
                              g_key_file_get_boolean(key, "Library", "showIncluded", NULL);
  GString *out = g_string_new("");
  g_string_append_printf(out,
      "{\"includedAvailable\":%s,\"includedVisible\":%s,\"includedDeleted\":%s,"
      "\"includedControlsEnabled\":%s,\"hasPersonalMusic\":%s,\"dirs\":%s}",
      included_available ? "true" : "false",
      included_visible ? "true" : "false",
      included_deleted ? "true" : "false",
      (has_personal_music && included_available && !included_deleted) ? "true" : "false",
      has_personal_music ? "true" : "false",
      dir_json->str);
  char *json = g_string_free(out, FALSE);
  g_string_free(dir_json, TRUE);
  g_free(dist_path);
  g_hash_table_destroy(counts);
  g_strfreev(dirs);
  g_key_file_unref(key);
  return json;
}

static void scan_folder(const char *root, const char *dir, const char *prefix, GString *items,
                        int *count) {
  DIR *handle = opendir(dir);
  if (!handle)
    return;
  struct dirent *ent;
  while ((ent = readdir(handle)) != NULL) {
    if (strcmp(ent->d_name, ".") == 0 || strcmp(ent->d_name, "..") == 0)
      continue;
    char *full_path = g_build_filename(dir, ent->d_name, NULL);
    struct stat st;
    if (stat(full_path, &st) != 0) {
      g_free(full_path);
      continue;
    }
    if (S_ISDIR(st.st_mode)) {
      scan_folder(root, full_path, prefix, items, count);
      g_free(full_path);
      continue;
    }
    if (!S_ISREG(st.st_mode)) {
      g_free(full_path);
      continue;
    }
    const char *kind = kind_for_file(ent->d_name);
    if (!kind) {
      g_free(full_path);
      continue;
    }
    const char *rel = full_path;
    if (g_str_has_prefix(full_path, root)) {
      rel = full_path + strlen(root);
      if (*rel == '/')
        rel++;
    }
    char *prefixed_rel = NULL;
    if (prefix && *prefix) {
      prefixed_rel = *rel ? g_build_filename(prefix, rel, NULL) : g_strdup(prefix);
      rel = prefixed_rel;
    }
    char *url = g_filename_to_uri(full_path, NULL, NULL);
    if (*count > 0)
      g_string_append_c(items, ',');
    g_string_append(items, "{\"url\":");
    append_json_string(items, url ? url : full_path);
    g_string_append(items, ",\"name\":");
    append_json_string(items, ent->d_name);
    g_string_append(items, ",\"relativePath\":");
    append_json_string(items, rel);
    g_string_append(items, ",\"nativePath\":");
    append_json_string(items, full_path);
    g_string_append_printf(items, ",\"kind\":\"%s\",\"sizeBytes\":%lld}", kind, (long long)st.st_size);
    (*count)++;
    g_free(url);
    g_free(prefixed_rel);
    g_free(full_path);
  }
  closedir(handle);
}

static void add_music_folder(const char *folder_path) {
  if (!folder_path || !*folder_path || !g_file_test(folder_path, G_FILE_TEST_IS_DIR))
    return;
  GKeyFile *key = load_library_config();
  gsize len = 0;
  char **dirs = library_dirs(key, &len);
  gboolean exists = FALSE;
  for (gsize i = 0; i < len; i++) {
    if (g_strcmp0(dirs[i], folder_path) == 0) {
      exists = TRUE;
      break;
    }
  }
  if (!exists) {
    char **next = g_new0(char *, len + 2);
    for (gsize i = 0; i < len; i++) next[i] = g_strdup(dirs[i]);
    next[len] = g_strdup(folder_path);
    g_key_file_set_string_list(key, "Library", "dirs", (const gchar * const *)next, len + 1);
    set_library_dir_enabled(key, folder_path, TRUE);
    g_strfreev(next);
    save_library_config(key);
  }
  g_strfreev(dirs);
  g_key_file_unref(key);
}

static void load_visible_libraries(void) {
  GKeyFile *key = load_library_config();
  GString *items = g_string_new("[");
  int count = 0;
  gboolean included_deleted = g_key_file_get_boolean(key, "Library", "includedDeleted", NULL);
  gboolean included_visible = !g_key_file_has_key(key, "Library", "showIncluded", NULL) ||
                              g_key_file_get_boolean(key, "Library", "showIncluded", NULL);
  char *dist_path = g_build_filename(app_dir, "dist", NULL);
  if (!included_deleted && included_visible && g_file_test(dist_path, G_FILE_TEST_IS_DIR)) {
    scan_folder(dist_path, dist_path, "Included Music", items, &count);
  }

  gsize len = 0;
  char **dirs = library_dirs(key, &len);
  GHashTable *counts = g_hash_table_new_full(g_str_hash, g_str_equal, g_free, NULL);
  for (gsize i = 0; i < len; i++) {
    if (!library_dir_enabled(key, dirs[i]) || !g_file_test(dirs[i], G_FILE_TEST_IS_DIR))
      continue;
    char *name = g_path_get_basename(dirs[i]);
    char *prefix = unique_prefix_for_name(name, counts);
    scan_folder(dirs[i], dirs[i], prefix, items, &count);
    g_free(prefix);
    g_free(name);
  }
  g_string_append(items, "]");

  char *settings_json = native_library_settings_json();
  char *js = g_strdup_printf(
      "(function(payload){var attempts=0;function load(){"
      "if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){"
      "window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
      "if(++attempts<200)setTimeout(load,50);"
      "else console.error('[VGM Native] Timed out waiting for native library API');}"
      "load();})({\"items\":%s,\"options\":{\"rootName\":\"Music Libraries\",\"rootUrl\":\"native://libraries\",\"librarySettings\":%s}});",
      items->str, settings_json);
  webkit_web_view_run_javascript(web_view, js, NULL, NULL, NULL);
  g_free(js);
  g_free(settings_json);
  g_hash_table_destroy(counts);
  g_strfreev(dirs);
  g_free(dist_path);
  g_string_free(items, TRUE);
  g_key_file_unref(key);
}

static char *json_string_value(const char *json, const char *key_name) {
  char *needle = g_strdup_printf("\"%s\":\"", key_name);
  char *start = strstr(json, needle);
  g_free(needle);
  if (!start) return NULL;
  start = strchr(start, ':');
  if (!start) return NULL;
  start++;
  while (*start && (*start == ' ' || *start == '"')) start++;
  GString *out = g_string_new("");
  for (char *p = start; *p; p++) {
    if (*p == '"' && (p == start || p[-1] != '\\')) break;
    if (*p == '\\' && p[1]) p++;
    g_string_append_c(out, *p);
  }
  return g_string_free(out, FALSE);
}

static gboolean json_bool_value(const char *json, const char *key_name, gboolean fallback) {
  char *needle = g_strdup_printf("\"%s\":", key_name);
  char *start = strstr(json, needle);
  g_free(needle);
  if (!start) return fallback;
  start = strchr(start, ':');
  if (!start) return fallback;
  start++;
  while (*start == ' ') start++;
  if (g_str_has_prefix(start, "true")) return TRUE;
  if (g_str_has_prefix(start, "false")) return FALSE;
  return fallback;
}

static void native_library_command_received(WebKitUserContentManager *manager,
                                            WebKitJavascriptResult *message,
                                            gpointer user_data) {
  (void)manager;
  (void)user_data;
  JSCValue *value = webkit_javascript_result_get_js_value(message);
  char *json = jsc_value_to_json(value, 0);
  if (!json) return;
  char *command = json_string_value(json, "command");
  if (!command) {
    g_free(json);
    return;
  }
  GKeyFile *key = load_library_config();
  if (strcmp(command, "setIncludedVisible") == 0) {
    g_key_file_set_boolean(key, "Library", "showIncluded", json_bool_value(json, "visible", TRUE));
    save_library_config(key);
  } else if (strcmp(command, "deleteIncludedMusic") == 0) {
    g_key_file_set_boolean(key, "Library", "includedDeleted", TRUE);
    g_key_file_set_boolean(key, "Library", "showIncluded", FALSE);
    save_library_config(key);
  } else if (strcmp(command, "setFolderVisible") == 0) {
    char *uri = json_string_value(json, "uri");
    if (uri) {
      set_library_dir_enabled(key, uri, json_bool_value(json, "visible", TRUE));
      save_library_config(key);
      g_free(uri);
    }
  } else if (strcmp(command, "deleteFolder") == 0) {
    char *uri = json_string_value(json, "uri");
    if (uri) {
      gsize len = 0;
      char **dirs = library_dirs(key, &len);
      GPtrArray *next = g_ptr_array_new_with_free_func(g_free);
      for (gsize i = 0; i < len; i++) {
        if (g_strcmp0(dirs[i], uri) != 0) g_ptr_array_add(next, g_strdup(dirs[i]));
      }
      g_key_file_set_string_list(key, "Library", "dirs", (const gchar * const *)next->pdata, next->len);
      save_library_config(key);
      g_ptr_array_free(next, TRUE);
      g_strfreev(dirs);
      g_free(uri);
    }
  }
  g_key_file_unref(key);
  g_free(command);
  g_free(json);
  load_visible_libraries();
}

static void load_changed_callback(WebKitWebView *view, WebKitLoadEvent event, gpointer data) {
  (void)view;
  (void)data;
  if (event == WEBKIT_LOAD_FINISHED) load_visible_libraries();
}

static void open_folder_callback(GtkMenuItem *menuitem, gpointer user_data) {
  GtkWidget *dialog;
  GtkWindow *parent_window = GTK_WINDOW(user_data);

  dialog = gtk_file_chooser_dialog_new("Select Music Folder", parent_window,
                                       GTK_FILE_CHOOSER_ACTION_SELECT_FOLDER,
                                       "_Cancel", GTK_RESPONSE_CANCEL, "_Open",
                                       GTK_RESPONSE_ACCEPT, NULL);

  if (gtk_dialog_run(GTK_DIALOG(dialog)) == GTK_RESPONSE_ACCEPT) {
    char *folder_path = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dialog));
    add_music_folder(folder_path);
    load_visible_libraries();
    g_free(folder_path);
  }
  gtk_widget_destroy(dialog);
}

static void destroy_window_callback(GtkWidget *widget, gpointer data) {
  gtk_main_quit();
}

static int get_executable_dir(char *buffer, size_t buffer_size) {
  ssize_t len = readlink("/proc/self/exe", buffer, buffer_size - 1);
  if (len <= 0 || (size_t)len >= buffer_size)
    return 0;

  buffer[len] = '\0';
  char *slash = strrchr(buffer, '/');
  if (!slash)
    return 0;

  *slash = '\0';
  return 1;
}

int main(int argc, char *argv[]) {
  gtk_init(&argc, &argv);

  // Create window
  GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
  gtk_window_set_default_size(GTK_WINDOW(window), 1200, 800);
  gtk_window_set_title(GTK_WINDOW(window), "VGMPlay");
  g_signal_connect(window, "destroy", G_CALLBACK(destroy_window_callback),
                   NULL);

  // Layout
  GtkWidget *vbox = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);
  gtk_container_add(GTK_CONTAINER(window), vbox);

  // Menu Bar
  GtkWidget *menubar = gtk_menu_bar_new();
  GtkWidget *file_menu_item = gtk_menu_item_new_with_label("File");
  GtkWidget *file_menu = gtk_menu_new();
  GtkWidget *open_folder_item = gtk_menu_item_new_with_label("Open Folder...");
  GtkWidget *quit_item = gtk_menu_item_new_with_label("Quit");

  gtk_menu_shell_append(GTK_MENU_SHELL(file_menu), open_folder_item);
  gtk_menu_shell_append(GTK_MENU_SHELL(file_menu), quit_item);
  gtk_menu_item_set_submenu(GTK_MENU_ITEM(file_menu_item), file_menu);
  gtk_menu_shell_append(GTK_MENU_SHELL(menubar), file_menu_item);
  gtk_box_pack_start(GTK_BOX(vbox), menubar, FALSE, FALSE, 0);

  g_signal_connect(open_folder_item, "activate",
                   G_CALLBACK(open_folder_callback), window);
  g_signal_connect(quit_item, "activate", G_CALLBACK(destroy_window_callback),
                   NULL);

  // WebKit WebView
  WebKitSettings *settings = webkit_settings_new();
  webkit_settings_set_enable_write_console_messages_to_stdout(settings, TRUE);
  webkit_settings_set_allow_universal_access_from_file_urls(settings, TRUE);
  webkit_settings_set_allow_file_access_from_file_urls(settings, TRUE);

  if (!get_executable_dir(app_dir, sizeof(app_dir))) app_dir[0] = '\0';
  WebKitUserContentManager *content_manager = webkit_user_content_manager_new();
  webkit_user_content_manager_register_script_message_handler(content_manager, "nativeLibraryCommand");
  g_signal_connect(content_manager, "script-message-received::nativeLibraryCommand",
                   G_CALLBACK(native_library_command_received), NULL);
  char *settings_json = native_library_settings_json();
  char *startup_js = g_strdup_printf("window.VGMPLAY_NATIVE_FIRST_RUN=%s;window.VGMPLAY_NATIVE_LIBRARY_SETTINGS=%s;",
      native_first_run() ? "true" : "false",
      settings_json);
  WebKitUserScript *startup_script = webkit_user_script_new(startup_js,
      WEBKIT_USER_CONTENT_INJECT_TOP_FRAME,
      WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START,
      NULL,
      NULL);
  webkit_user_content_manager_add_script(content_manager, startup_script);
  webkit_user_script_unref(startup_script);
  g_free(startup_js);
  g_free(settings_json);

  web_view = WEBKIT_WEB_VIEW(webkit_web_view_new_with_user_content_manager(content_manager));
  webkit_web_view_set_settings(web_view, settings);
  g_signal_connect(web_view, "load-changed", G_CALLBACK(load_changed_callback), NULL);
  gtk_box_pack_start(GTK_BOX(vbox), GTK_WIDGET(web_view), TRUE, TRUE, 0);

  // Load local index.html
  if (app_dir[0]) {
    char *index_path = g_build_filename(app_dir, "native-index.html", NULL);
    char *url = g_filename_to_uri(index_path, NULL, NULL);
    if (url)
      webkit_web_view_load_uri(web_view, url);
    g_free(url);
    g_free(index_path);
  }

  gtk_widget_show_all(window);
  gtk_main();

  return 0;
}
