#include <dirent.h>
#include <gtk/gtk.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <webkit2/webkit2.h>

WebKitWebView *web_view;

// Supported extensions
const char *extensions[] = {".zip", ".7z",  ".rar", ".vgm", ".vgz",
                            ".spc", ".nsf", ".psf", ".usf", NULL};

static int has_supported_extension(const char *filename) {
  const char *dot = strrchr(filename, '.');
  if (!dot)
    return 0;
  for (int i = 0; extensions[i] != NULL; i++) {
    if (strcasecmp(dot, extensions[i]) == 0)
      return 1;
  }
  return 0;
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

    DIR *dir = opendir(folder_path);
    if (dir) {
      struct dirent *ent;
      GString *js_files = g_string_new("[");
      int count = 0;

      while ((ent = readdir(dir)) != NULL) {
        if (ent->d_type == DT_REG && has_supported_extension(ent->d_name)) {
          if (count > 0)
            g_string_append(js_files, ",");
          g_string_append_printf(js_files, "'file://%s/%s'", folder_path,
                                 ent->d_name);
          count++;
        }
      }
      g_string_append(js_files, "]");

      char *js =
          g_strdup_printf("var files = %s; files.forEach(f => "
                          "window.vgmPlayInstance.loadZIPWithVGMFromURL(f));",
                          js_files->str);
      webkit_web_view_run_javascript(web_view, js, NULL, NULL, NULL);

      g_free(js);
      g_string_free(js_files, TRUE);
      closedir(dir);
    }
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
    char *index_path = g_build_filename(app_dir, "index.html", NULL);
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
