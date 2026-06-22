#include "WebView2.h"
#include <algorithm>
#include <cwctype>
#include <cstdint>
#include <shlobj.h>
#include <stdlib.h>
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
void ScanFolder(const std::wstring &root, const std::wstring &dir,
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
      L".mwk", L".psflib", L".usflib", L".m3u", L".txt", L".trackinfo", L".gameinfo"};
  static const std::vector<std::wstring> playable = {
      L".vgm", L".vgz", L".spc", L".nsf", L".nsfe", L".gbs", L".hes", L".sap",
      L".ay", L".kss", L".kssx", L".kscc", L".psf", L".minipsf", L".ssf",
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

void ScanFolder(const std::wstring &root, const std::wstring &dir,
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
      ScanFolder(root, fullPath, itemsJson, first);
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

void OpenFolderDialog() {
  BROWSEINFOW bi = {0};
  bi.lpszTitle = L"Select Music Folder";
  bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
  LPITEMIDLIST pidl = SHBrowseForFolderW(&bi);

  if (pidl != 0) {
    wchar_t path[MAX_PATH];
    if (SHGetPathFromIDListW(pidl, path)) {
      std::wstring root(path);
      std::wstring itemsJson = L"[";
      bool first = true;
      ScanFolder(root, root, itemsJson, first);
      itemsJson += L"]";
      std::wstring rootName = root.substr(root.find_last_of(L"\\/") + 1);
      std::wstring js = L"(function(payload){var attempts=0;function load(){"
                        L"if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){"
                        L"window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
                        L"if(++attempts<200)setTimeout(load,50);"
                        L"else console.error('[VGM Native] Timed out waiting for native library API');}"
                        L"load();})({\"items\":" + itemsJson +
                        L",\"options\":{\"rootName\":\"" + JsonEscape(rootName) +
                        L"\",\"rootUrl\":\"" + JsonEscape(root) + L"\"}});";
      webviewWindow->ExecuteScript(js.c_str(), nullptr);
    }
    CoTaskMemFree(pidl);
  }
}
