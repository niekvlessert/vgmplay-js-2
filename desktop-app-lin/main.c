#include <dirent.h>
#include <gtk/gtk.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <webkit2/webkit2.h>

WebKitWebView *web_view;

static const char *archive_extensions[] = {".zip", ".7z", ".rar", ".rsn", ".vgmz", ".vgmdz", ".vgmpack", ".vigamup", NULL};
static const char *image_extensions[] = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", NULL};
static const char *support_extensions[] = {".mwk", ".psflib", ".usflib", ".m3u", ".txt", ".trackinfo", ".gameinfo", NULL};
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

static void scan_folder(const char *root, const char *dir, GString *items,
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
      scan_folder(root, full_path, items, count);
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
    g_free(full_path);
  }
  closedir(handle);
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

    GString *items = g_string_new("[");
    int count = 0;
    scan_folder(folder_path, folder_path, items, &count);
    g_string_append(items, "]");
    char *root_name = g_path_get_basename(folder_path);
    char *root_name_json = g_strescape(root_name ? root_name : "Music Library", NULL);
    char *root_url_json = g_strescape(folder_path, NULL);
    char *js = g_strdup_printf(
        "(function(payload){var attempts=0;function load(){"
        "if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){"
        "window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
        "if(++attempts<200)setTimeout(load,50);"
        "else console.error('[VGM Native] Timed out waiting for native library API');}"
        "load();})({\"items\":%s,\"options\":{\"rootName\":\"%s\",\"rootUrl\":\"%s\"}});",
        items->str, root_name_json, root_url_json);
    webkit_web_view_run_javascript(web_view, js, NULL, NULL, NULL);
    g_free(js);
    g_free(root_name_json);
    g_free(root_url_json);
    g_free(root_name);
    g_string_free(items, TRUE);
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

  web_view = WEBKIT_WEB_VIEW(webkit_web_view_new_with_settings(settings));
  gtk_box_pack_start(GTK_BOX(vbox), GTK_WIDGET(web_view), TRUE, TRUE, 0);

  // Load local index.html
  char app_dir[PATH_MAX];
  if (get_executable_dir(app_dir, sizeof(app_dir))) {
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
