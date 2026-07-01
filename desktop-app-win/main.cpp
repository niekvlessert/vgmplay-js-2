#include "WebView2.h"
#include <algorithm>
#include <cstdio>
#include <cwctype>
#include <cstdint>
#include <fstream>
#include <io.h>
#include <shlobj.h>
#include <stdlib.h>
#include <sstream>
#include <string>
#include <vector>
#include <windows.h>
#include <wrl.h>

using namespace Microsoft::WRL;

// Global variables
HWND hWnd;
ComPtr<ICoreWebView2Controller> webviewController;
ComPtr<ICoreWebView2> webviewWindow;

// Helper to get executable directory
std::wstring GetExecutableDir() {
  wchar_t buffer[MAX_PATH];
  GetModuleFileNameW(NULL, buffer, MAX_PATH);
  std::wstring path(buffer);
  return path.substr(0, path.find_last_of(L"\\/"));
}

std::wstring PathToFileUrl(const std::wstring &path) {
  std::wstring url = L"file:///";
  for (wchar_t c : path) {
    url += (c == L'\\') ? L'/' : c;
  }
  return url;
}

// Forward declarations
LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
void OpenFolderDialog();
std::wstring JsonEscape(const std::wstring &value);
std::wstring FileUrlFromPath(const std::wstring &path);
std::wstring KindForExtension(const std::wstring &ext);
std::wstring NativeLibrarySettingsJson();
std::wstring LibraryConfigPath();
void AddMusicFolder(const std::wstring &path);
void LoadVisibleLibraries();
void HandleNativeLibraryCommand(const std::wstring &messageJson);
void ScanFolder(const std::wstring &root, const std::wstring &dir,
                const std::wstring &prefix,
                std::wstring &itemsJson, bool &first);

int CALLBACK WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                     LPSTR lpCmdLine, int nCmdShow) {
  // Window class
  WNDCLASSEXW wcex = {};
  wcex.cbSize = sizeof(WNDCLASSEX);
  wcex.style = CS_HREDRAW | CS_VREDRAW;
  wcex.lpfnWndProc = WndProc;
  wcex.hInstance = hInstance;
  wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
  wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  wcex.lpszClassName = L"VGMPlayWindowClass";
  RegisterClassExW(&wcex);

  // Create window
  hWnd = CreateWindowW(L"VGMPlayWindowClass", L"VGMPlay", WS_OVERLAPPEDWINDOW,
                       CW_USEDEFAULT, CW_USEDEFAULT, 1200, 800, NULL, NULL,
                       hInstance, NULL);

  if (!hWnd)
    return FALSE;

  ShowWindow(hWnd, nCmdShow);
  UpdateWindow(hWnd);

  // Initialize WebView2
  CreateCoreWebView2EnvironmentWithOptions(
      nullptr, nullptr, nullptr,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
          [=](HRESULT result, ICoreWebView2Environment *env) -> HRESULT {
            env->CreateCoreWebView2Controller(
                hWnd,
                Callback<
                    ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [=](HRESULT result,
                        ICoreWebView2Controller *controller) -> HRESULT {
                      if (controller != nullptr) {
                        webviewController = controller;
                        webviewController->get_CoreWebView2(&webviewWindow);
                      }

                      // Resize WebView to fit the window
                      RECT bounds;
                      GetClientRect(hWnd, &bounds);
                      webviewController->put_Bounds(bounds);

                      std::wstring exeDir = GetExecutableDir();
                      bool nativeFirstRun = (_waccess(LibraryConfigPath().c_str(), 0) != 0);
                      std::wstring startupScript =
                          L"window.VGMPLAY_NATIVE_FIRST_RUN=" +
                          std::wstring(nativeFirstRun ? L"true" : L"false") +
                          L";window.VGMPLAY_NATIVE_LIBRARY_SETTINGS=" +
                          NativeLibrarySettingsJson() + L";";
                      webviewWindow->AddScriptToExecuteOnDocumentCreated(
                          startupScript.c_str(), nullptr);
                      EventRegistrationToken messageToken;
                      webviewWindow->add_WebMessageReceived(
                          Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 ICoreWebView2WebMessageReceivedEventArgs *args) -> HRESULT {
                                LPWSTR raw = nullptr;
                                if (SUCCEEDED(args->get_WebMessageAsJson(&raw)) && raw) {
                                  HandleNativeLibraryCommand(raw);
                                  CoTaskMemFree(raw);
                                }
                                return S_OK;
                              }).Get(),
                          &messageToken);
                      EventRegistrationToken navigationToken;
                      webviewWindow->add_NavigationCompleted(
                          Callback<ICoreWebView2NavigationCompletedEventHandler>(
                              [](ICoreWebView2 *sender,
                                 ICoreWebView2NavigationCompletedEventArgs *args) -> HRESULT {
                                LoadVisibleLibraries();
                                return S_OK;
                              }).Get(),
                          &navigationToken);
                      ComPtr<ICoreWebView2_3> webview3;
                      if (SUCCEEDED(webviewWindow.As(&webview3)) && webview3) {
                        webview3->SetVirtualHostNameToFolderMapping(
                            L"vgmplay.local", exeDir.c_str(),
                            COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
                        webviewWindow->Navigate(
                            L"https://vgmplay.local/native-index.html");
                      } else {
                        std::wstring indexUrl =
                            PathToFileUrl(exeDir + L"\\native-index.html");
                        webviewWindow->Navigate(indexUrl.c_str());
                      }

                      return S_OK;
                    })
                    .Get());
            return S_OK;
          })
          .Get());

  // Message loop
  MSG msg;
  while (GetMessage(&msg, NULL, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  return (int)msg.wParam;
}

LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam,
                         LPARAM lParam) {
  switch (message) {
  case WM_SIZE:
    if (webviewController != nullptr) {
      RECT bounds;
      GetClientRect(hWnd, &bounds);
      webviewController->put_Bounds(bounds);
    }
    break;
  case WM_COMMAND:
    if (LOWORD(wParam) == 101) { // Open Folder
      OpenFolderDialog();
    }
    break;
  case WM_DESTROY:
    PostQuitMessage(0);
    break;
  default:
    return DefWindowProc(hWnd, message, wParam, lParam);
  }
  return 0;
}

std::wstring JsonEscape(const std::wstring &value) {
  std::wstring out;
  out.reserve(value.size() + 8);
  for (wchar_t c : value) {
    switch (c) {
    case L'\\': out += L"\\\\"; break;
    case L'"': out += L"\\\""; break;
    case L'\n': out += L"\\n"; break;
    case L'\r': out += L"\\r"; break;
    case L'\t': out += L"\\t"; break;
    default: out += c; break;
    }
  }
  return out;
}

std::wstring FileUrlFromPath(const std::wstring &path) {
  std::wstring url = L"file:///";
  for (wchar_t c : path) url += (c == L'\\') ? L'/' : c;
  return url;
}

std::wstring KindForExtension(const std::wstring &ext) {
  static const std::vector<std::wstring> archives = {
      L".zip", L".7z", L".rar", L".rsn", L".vgmz", L".vgmdz", L".vgmpack", L".vigamup"};
  static const std::vector<std::wstring> images = {
      L".png", L".jpg", L".jpeg", L".webp", L".gif", L".bmp"};
  static const std::vector<std::wstring> support = {
      L".mwk", L".psflib", L".ssflib", L".usflib", L".m3u", L".txt", L".trackinfo", L".gameinfo"};
  static const std::vector<std::wstring> playable = {
      L".vgm", L".vgz", L".spc", L".nsf", L".nsfe", L".gbs", L".hes", L".sap",
      L".ay", L".sid", L".psid", L".rsid", L".kss", L".kssx", L".kscc", L".psf", L".minipsf", L".ssf",
      L".minissf", L".dsf", L".minidsf", L".usf", L".miniusf", L".mus", L".lmp",
      L".mid", L".midi", L".rmi", L".s3m", L".it", L".mod", L".xm", L".mptm",
      L".stm", L".mtm", L".669", L".amf", L".dmf", L".far", L".imf", L".med",
      L".okt", L".ptm", L".ult", L".umx", L".mwm", L".mgs", L".mbm", L".mp3",
      L".ogg", L".flac", L".wav", L".ape", L".m4a", L".aac", L".opus", L".wma",
      L".aif", L".aiff", L".aifc", L".bfstm", L".bcstm", L".brstm", L".adx",
      L".hca", L".dsp", L".idsp", L".vag", L".vgs", L".fsb", L".wem", L".xma",
      L".xma2", L".at3", L".at9", L".aa3", L".ac3", L".ast", L".bnsf", L".caf",
      L".dts", L".genh", L".hps", L".mca", L".msf", L".npsf", L".nus3bank",
      L".pcm", L".rsd", L".rwav", L".strm", L".swav", L".txth", L".txtp",
      L".vab", L".vas", L".xwb", L".xwm", L".ymf", L".zsm"};
  if (std::find(archives.begin(), archives.end(), ext) != archives.end()) return L"archive";
  if (std::find(images.begin(), images.end(), ext) != images.end()) return L"image";
  if (std::find(support.begin(), support.end(), ext) != support.end()) return L"unsupported";
  if (std::find(playable.begin(), playable.end(), ext) != playable.end()) return L"playable";
  return L"unsupported";
}

struct LibraryDir {
  std::wstring path;
  bool enabled = true;
};

struct LibraryConfig {
  bool showIncluded = true;
  bool includedDeleted = false;
  std::vector<LibraryDir> dirs;
};

bool DirectoryExists(const std::wstring &path) {
  DWORD attrs = GetFileAttributesW(path.c_str());
  return attrs != INVALID_FILE_ATTRIBUTES && (attrs & FILE_ATTRIBUTE_DIRECTORY);
}

std::wstring StateDir() {
  wchar_t appData[MAX_PATH];
  if (SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, SHGFP_TYPE_CURRENT, appData) != S_OK) {
    return GetExecutableDir();
  }
  std::wstring dir = std::wstring(appData) + L"\\VGMPlay-JS";
  CreateDirectoryW(dir.c_str(), NULL);
  return dir;
}

std::wstring LibraryConfigPath() {
  return StateDir() + L"\\library.ini";
}

LibraryConfig LoadLibraryConfig() {
  LibraryConfig config;
  FILE *file = _wfopen(LibraryConfigPath().c_str(), L"rb");
  if (!file) return config;
  fseek(file, 0, SEEK_END);
  long bytes = ftell(file);
  fseek(file, 0, SEEK_SET);
  if (bytes <= 0) {
    fclose(file);
    return config;
  }
  std::wstring data;
  data.resize(bytes / sizeof(wchar_t));
  fread(&data[0], sizeof(wchar_t), data.size(), file);
  fclose(file);
  std::wistringstream stream(data);
  std::wstring line;
  while (std::getline(stream, line)) {
    if (!line.empty() && line.back() == L'\r') line.pop_back();
    if (line == L"showIncluded=0") config.showIncluded = false;
    else if (line == L"showIncluded=1") config.showIncluded = true;
    else if (line == L"includedDeleted=1") config.includedDeleted = true;
    else if (line.rfind(L"dir\t", 0) == 0) {
      size_t secondTab = line.find(L'\t', 4);
      if (secondTab != std::wstring::npos) {
        LibraryDir dir;
        dir.enabled = line.substr(4, secondTab - 4) != L"0";
        dir.path = line.substr(secondTab + 1);
        if (!dir.path.empty()) config.dirs.push_back(dir);
      }
    }
  }
  return config;
}

void SaveLibraryConfig(const LibraryConfig &config) {
  std::wstring data;
  data += config.showIncluded ? L"showIncluded=1\n" : L"showIncluded=0\n";
  data += config.includedDeleted ? L"includedDeleted=1\n" : L"includedDeleted=0\n";
  for (const auto &dir : config.dirs) {
    data += L"dir\t";
    data += dir.enabled ? L"1\t" : L"0\t";
    data += dir.path;
    data += L"\n";
  }
  FILE *file = _wfopen(LibraryConfigPath().c_str(), L"wb");
  if (!file) return;
  fwrite(data.data(), sizeof(wchar_t), data.size(), file);
  fclose(file);
}

std::wstring BaseName(const std::wstring &path) {
  size_t pos = path.find_last_of(L"\\/");
  return pos == std::wstring::npos ? path : path.substr(pos + 1);
}

std::wstring UniquePrefixForName(const std::wstring &name, std::vector<std::wstring> &seen) {
  std::wstring base = name.empty() ? L"Music" : name;
  int count = 1;
  for (const auto &value : seen) {
    if (value == base || value.rfind(base + L" (", 0) == 0) count++;
  }
  seen.push_back(count <= 1 ? base : base + L" (" + std::to_wstring(count) + L")");
  return seen.back();
}

bool PathHasMusic(const std::wstring &dir) {
  std::wstring searchPath = dir + L"\\*.*";
  WIN32_FIND_DATAW findData;
  HANDLE hFind = FindFirstFileW(searchPath.c_str(), &findData);
  if (hFind == INVALID_HANDLE_VALUE) return false;
  bool found = false;
  do {
    std::wstring name(findData.cFileName);
    if (name == L"." || name == L"..") continue;
    std::wstring fullPath = dir + L"\\" + name;
    if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
      found = PathHasMusic(fullPath);
    } else {
      size_t dotPos = name.find_last_of(L".");
      std::wstring ext = dotPos == std::wstring::npos ? L"" : name.substr(dotPos);
      std::transform(ext.begin(), ext.end(), ext.begin(), towlower);
      std::wstring kind = KindForExtension(ext);
      found = kind == L"archive" || kind == L"playable";
    }
  } while (!found && FindNextFileW(hFind, &findData));
  FindClose(hFind);
  return found;
}

std::wstring NativeLibrarySettingsJson() {
  LibraryConfig config = LoadLibraryConfig();
  std::wstring dirsJson = L"[";
  std::vector<std::wstring> prefixes;
  bool hasPersonalMusic = false;
  for (size_t i = 0; i < config.dirs.size(); i++) {
    const auto &dir = config.dirs[i];
    std::wstring name = BaseName(dir.path);
    std::wstring prefix = UniquePrefixForName(name, prefixes);
    bool readable = DirectoryExists(dir.path);
    bool hasMusic = readable && PathHasMusic(dir.path);
    if (hasMusic) hasPersonalMusic = true;
    if (i > 0) dirsJson += L",";
    dirsJson += L"{\"uri\":\"" + JsonEscape(dir.path) +
                L"\",\"name\":\"" + JsonEscape(name.empty() ? L"Music" : name) +
                L"\",\"prefix\":\"" + JsonEscape(prefix) +
                L"\",\"enabled\":" + std::wstring(dir.enabled ? L"true" : L"false") +
                L",\"readable\":" + std::wstring(readable ? L"true" : L"false") +
                L",\"musicCount\":" + std::to_wstring(hasMusic ? 1 : 0) + L"}";
  }
  dirsJson += L"]";
  bool includedAvailable = DirectoryExists(GetExecutableDir() + L"\\dist");
  return L"{\"includedAvailable\":" + std::wstring(includedAvailable ? L"true" : L"false") +
         L",\"includedVisible\":" + std::wstring(config.showIncluded ? L"true" : L"false") +
         L",\"includedDeleted\":" + std::wstring(config.includedDeleted ? L"true" : L"false") +
         L",\"includedControlsEnabled\":" + std::wstring((hasPersonalMusic && includedAvailable && !config.includedDeleted) ? L"true" : L"false") +
         L",\"hasPersonalMusic\":" + std::wstring(hasPersonalMusic ? L"true" : L"false") +
         L",\"dirs\":" + dirsJson + L"}";
}

void AddMusicFolder(const std::wstring &path) {
  if (path.empty() || !DirectoryExists(path)) return;
  LibraryConfig config = LoadLibraryConfig();
  for (const auto &dir : config.dirs) {
    if (dir.path == path) return;
  }
  LibraryDir dir;
  dir.path = path;
  dir.enabled = true;
  config.dirs.push_back(dir);
  SaveLibraryConfig(config);
}

std::wstring JsonStringValue(const std::wstring &json, const std::wstring &key) {
  std::wstring needle = L"\"" + key + L"\":\"";
  size_t start = json.find(needle);
  if (start == std::wstring::npos) return L"";
  start += needle.size();
  std::wstring out;
  for (size_t i = start; i < json.size(); i++) {
    wchar_t c = json[i];
    if (c == L'"' && (i == start || json[i - 1] != L'\\')) break;
    if (c == L'\\' && i + 1 < json.size()) c = json[++i];
    out += c;
  }
  return out;
}

bool JsonBoolValue(const std::wstring &json, const std::wstring &key, bool fallback) {
  std::wstring needle = L"\"" + key + L"\":";
  size_t start = json.find(needle);
  if (start == std::wstring::npos) return fallback;
  start += needle.size();
  while (start < json.size() && json[start] == L' ') start++;
  if (json.rfind(L"true", start) == start) return true;
  if (json.rfind(L"false", start) == start) return false;
  return fallback;
}

void HandleNativeLibraryCommand(const std::wstring &messageJson) {
  std::wstring command = JsonStringValue(messageJson, L"command");
  if (command.empty()) return;
  LibraryConfig config = LoadLibraryConfig();
  if (command == L"setIncludedVisible") {
    config.showIncluded = JsonBoolValue(messageJson, L"visible", true);
  } else if (command == L"deleteIncludedMusic") {
    config.includedDeleted = true;
    config.showIncluded = false;
  } else if (command == L"setFolderVisible") {
    std::wstring uri = JsonStringValue(messageJson, L"uri");
    for (auto &dir : config.dirs) {
      if (dir.path == uri) dir.enabled = JsonBoolValue(messageJson, L"visible", true);
    }
  } else if (command == L"deleteFolder") {
    std::wstring uri = JsonStringValue(messageJson, L"uri");
    config.dirs.erase(std::remove_if(config.dirs.begin(), config.dirs.end(),
                                     [&](const LibraryDir &dir) { return dir.path == uri; }),
                      config.dirs.end());
  }
  SaveLibraryConfig(config);
  LoadVisibleLibraries();
}

void ScanFolder(const std::wstring &root, const std::wstring &dir,
                const std::wstring &prefix,
                std::wstring &itemsJson, bool &first) {
  std::wstring searchPath = dir + L"\\*.*";
  WIN32_FIND_DATAW findData;
  HANDLE hFind = FindFirstFileW(searchPath.c_str(), &findData);
  if (hFind == INVALID_HANDLE_VALUE) return;
  do {
    std::wstring name(findData.cFileName);
    if (name == L"." || name == L"..") continue;
    std::wstring fullPath = dir + L"\\" + name;
    if (findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
      ScanFolder(root, fullPath, prefix, itemsJson, first);
      continue;
    }
    size_t dotPos = name.find_last_of(L".");
    std::wstring ext = dotPos == std::wstring::npos ? L"" : name.substr(dotPos);
    std::transform(ext.begin(), ext.end(), ext.begin(), towlower);
    std::wstring kind = KindForExtension(ext);
    std::wstring rel = fullPath;
    if (rel.rfind(root, 0) == 0) {
      rel = rel.substr(root.size());
      if (!rel.empty() && (rel[0] == L'\\' || rel[0] == L'/')) rel = rel.substr(1);
    }
    if (!prefix.empty()) rel = rel.empty() ? prefix : prefix + L"\\" + rel;
    uint64_t size = ((uint64_t)findData.nFileSizeHigh << 32) | findData.nFileSizeLow;
    if (!first) itemsJson += L",";
    first = false;
    itemsJson += L"{\"url\":\"" + JsonEscape(FileUrlFromPath(fullPath)) +
                 L"\",\"name\":\"" + JsonEscape(name) +
                 L"\",\"relativePath\":\"" + JsonEscape(rel) +
                 L"\",\"nativePath\":\"" + JsonEscape(fullPath) +
                 L"\",\"kind\":\"" + kind +
                 L"\",\"sizeBytes\":" + std::to_wstring(size) + L"}";
  } while (FindNextFileW(hFind, &findData));
  FindClose(hFind);
}

void LoadVisibleLibraries() {
  if (!webviewWindow) return;
  LibraryConfig config = LoadLibraryConfig();
  std::wstring itemsJson = L"[";
  bool first = true;
  if (!config.includedDeleted && config.showIncluded) {
    std::wstring dist = GetExecutableDir() + L"\\dist";
    if (DirectoryExists(dist)) ScanFolder(dist, dist, L"Included Music", itemsJson, first);
  }
  std::vector<std::wstring> prefixes;
  for (const auto &dir : config.dirs) {
    if (!dir.enabled || !DirectoryExists(dir.path)) continue;
    std::wstring prefix = UniquePrefixForName(BaseName(dir.path), prefixes);
    ScanFolder(dir.path, dir.path, prefix, itemsJson, first);
  }
  itemsJson += L"]";
  std::wstring js = L"(function(payload){var attempts=0;function load(){"
                    L"if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){"
                    L"window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
                    L"if(++attempts<200)setTimeout(load,50);"
                    L"else console.error('[VGM Native] Timed out waiting for native library API');}"
                    L"load();})({\"items\":" + itemsJson +
                    L",\"options\":{\"rootName\":\"Music Libraries\",\"rootUrl\":\"native://libraries\",\"librarySettings\":" +
                    NativeLibrarySettingsJson() + L"}});";
  webviewWindow->ExecuteScript(js.c_str(), nullptr);
}

void OpenFolderDialog() {
  BROWSEINFOW bi = {0};
  bi.lpszTitle = L"Select Music Folder";
  bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
  LPITEMIDLIST pidl = SHBrowseForFolderW(&bi);

  if (pidl != 0) {
    wchar_t path[MAX_PATH];
    if (SHGetPathFromIDListW(pidl, path)) {
      AddMusicFolder(path);
      LoadVisibleLibraries();
    }
    CoTaskMemFree(pidl);
  }
}
