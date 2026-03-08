#include "WebView2.h"
#include <algorithm>
#include <shlobj.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include <wil/com.h>
#include <windows.h>
#include <wrl.h>

using namespace Microsoft::WRL;

// Global variables
HWND hWnd;
wil::com_ptr<ICoreWebView2Controller> webviewController;
wil::com_ptr<ICoreWebView2> webviewWindow;

// Helper to get executable directory
std::wstring GetExecutableDir() {
  wchar_t buffer[MAX_PATH];
  GetModuleFileNameW(NULL, buffer, MAX_PATH);
  std::wstring path(buffer);
  return path.substr(0, path.find_last_of(L"\\/"));
}

// Forward declarations
LRESULT CALLBACK WndProc(HWND, UINT, WPARAM, LPARAM);
void OpenFolderDialog();

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

                      // Set up virtual host for local files (mimicking Mac's
                      // vgmplay://)
                      std::wstring exeDir = GetExecutableDir();
                      webviewWindow->SetVirtualHostNameToFolderMapping(
                          L"vgmplay.local", exeDir.c_str(),
                          COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);

                      // Navigation
                      webviewWindow->Navigate(
                          L"https://vgmplay.local/index.html");

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

void OpenFolderDialog() {
  BROWSEINFOW bi = {0};
  bi.lpszTitle = L"Select Music Folder";
  bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE;
  LPITEMIDLIST pidl = SHBrowseForFolderW(&bi);

  if (pidl != 0) {
    wchar_t path[MAX_PATH];
    if (SHGetPathFromIDListW(pidl, path)) {
      // Find files with music extensions
      std::wstring searchPath = std::wstring(path) + L"\\*.*";
      WIN32_FIND_DATAW findData;
      HANDLE hFind = FindFirstFileW(searchPath.c_str(), &findData);

      std::vector<std::wstring> extensions = {L".zip", L".7z",  L".rar",
                                              L".vgm", L".vgz", L".spc",
                                              L".nsf", L".psf", L".usf"};
      std::wstring jsFilesList = L"[";

      if (hFind != INVALID_HANDLE_VALUE) {
        do {
          if (!(findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) {
            std::wstring filename(findData.cFileName);
            size_t dotPos = filename.find_last_of(L".");
            if (dotPos != std::wstring::npos) {
              std::wstring ext = filename.substr(dotPos);
              // Simple lower case conversion
              std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);

              if (std::find(extensions.begin(), extensions.end(), ext) !=
                  extensions.end()) {
                std::wstring fullPath = std::wstring(path) + L"\\" + filename;
                // Escape backslashes for JS
                std::wstring escapedPath;
                for (wchar_t c : fullPath) {
                  if (c == L'\\')
                    escapedPath += L"\\\\";
                  else
                    escapedPath += c;
                }
                if (jsFilesList.length() > 1)
                  jsFilesList += L",";
                jsFilesList += L"'file:///" + escapedPath + L"'";
              }
            }
          }
        } while (FindNextFileW(hFind, &findData));
        FindClose(hFind);
      }
      jsFilesList += L"]";

      std::wstring js = L"var files = " + jsFilesList +
                        L"; files.forEach(f => "
                        L"window.vgmPlayInstance.loadZIPWithVGMFromURL(f));";
      webviewWindow->ExecuteScript(js.c_str(), nullptr);
    }
    CoTaskMemFree(pidl);
  }
}
