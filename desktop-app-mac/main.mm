#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

#pragma mark - Local Scheme Handler

@interface LocalFileHandler : NSObject <WKURLSchemeHandler>
@property(strong) NSString *baseDir;
@end

@implementation LocalFileHandler

- (void)webView:(WKWebView *)webView
    startURLSchemeTask:(id<WKURLSchemeTask>)task {
  NSURL *url = task.request.URL;
  NSLog(@"LocalFileHandler: Request received for URL: %@", url.absoluteString);
  
  NSString *urlPath = url.path;
  NSString *relPath = urlPath;
  if ([relPath hasPrefix:@"/"])
    relPath = [relPath substringFromIndex:1];

  NSLog(@"LocalFileHandler: Requested path: %@", relPath);

  // Try absolute path first (for user-selected files),
  // then fall back to baseDir-relative (for app assets)
  NSString *path = nil;
  NSFileManager *fm = [NSFileManager defaultManager];
  BOOL absIsDir = NO;
  BOOL relIsDir = NO;
  if (urlPath.length > 0 &&
      [fm fileExistsAtPath:urlPath isDirectory:&absIsDir]) {
    path = urlPath;
    NSLog(@"LocalFileHandler: Using absolute path: %@", path);
  } else {
    path = [self.baseDir stringByAppendingPathComponent:relPath];
    path = [path stringByResolvingSymlinksInPath];
    NSLog(@"LocalFileHandler: Resolved to baseDir path: %@", path);
    [fm fileExistsAtPath:path isDirectory:&relIsDir];
  }

  BOOL isDir = absIsDir || relIsDir;
  NSData *data = nil;
  if (isDir) {
    NSLog(@"LocalFileHandler: Path is a directory");
    NSArray<NSString *> *entries = [fm contentsOfDirectoryAtPath:path error:nil];
    if (!entries) entries = @[];
    NSMutableString *html = [NSMutableString string];
    [html appendString:@"<html><body>"];
    for (NSString *entry in entries) {
      if ([entry isEqualToString:@"."] || [entry isEqualToString:@".."]) continue;
      NSString *escaped = [entry stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLPathAllowedCharacterSet]];
      [html appendFormat:@"<a href=\"%@\">%@</a><br/>", escaped, entry];
    }
    [html appendString:@"</body></html>"];
    data = [html dataUsingEncoding:NSUTF8StringEncoding];
    NSLog(@"LocalFileHandler: Directory listing generated, %lu entries", (unsigned long)entries.count);
  } else {
    NSLog(@"LocalFileHandler: Loading file: %@", path);
    data = [NSData dataWithContentsOfFile:path];
    if (data) {
      NSLog(@"LocalFileHandler: File loaded, size: %lu bytes", (unsigned long)data.length);
    } else {
      NSLog(@"LocalFileHandler: ERROR - Failed to load file: %@", path);
    }
  }
  if (!data) {
    NSLog(@"LocalFileHandler: ERROR - File not found or cannot be read: %@", path);
    NSError *err = [NSError errorWithDomain:NSURLErrorDomain
                                       code:NSURLErrorFileDoesNotExist
                                   userInfo:nil];
    [task didFailWithError:err];
    return;
  }

  // Determine MIME type
  NSString *mime = @"application/octet-stream";
  if (isDir)
    mime = @"text/html";
  else if ([path hasSuffix:@".html"])
    mime = @"text/html";
  else if ([path hasSuffix:@".js"])
    mime = @"application/javascript";
  else if ([path hasSuffix:@".css"])
    mime = @"text/css";
  else if ([path hasSuffix:@".wasm"])
    mime = @"application/wasm";
  else if ([path hasSuffix:@".json"])
    mime = @"application/json";
  else if ([path hasSuffix:@".png"])
    mime = @"image/png";
  else if ([path hasSuffix:@".svg"])
    mime = @"image/svg+xml";

  NSLog(@"LocalFileHandler: Serving with MIME type: %@", mime);

  NSDictionary *headers = @{
    @"Content-Type" : mime,
    @"Content-Length" :
        [NSString stringWithFormat:@"%lu", (unsigned long)data.length],
    @"Access-Control-Allow-Origin" : @"*"
  };

  NSHTTPURLResponse *response =
      [[NSHTTPURLResponse alloc] initWithURL:url
                                  statusCode:200
                                 HTTPVersion:@"HTTP/1.1"
                                headerFields:headers];

  [task didReceiveResponse:response];
  [task didReceiveData:data];
  [task didFinish];
  NSLog(@"LocalFileHandler: Response sent successfully");
}

- (void)webView:(WKWebView *)webView
    stopURLSchemeTask:(id<WKURLSchemeTask>)task {
}

@end

#pragma mark - Window Controller

@interface AppWindowController
    : NSWindowController <WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate>
@property(strong) WKWebView *webView;
@property(strong) LocalFileHandler *handler;
- (void)loadMusicFromFolder:(NSString *)dirPath;
@end

@implementation AppWindowController

- (instancetype)init {
  NSLog(@"AppWindowController init called");
  NSRect frame = NSMakeRect(0, 0, 1200, 800);
  NSLog(@"Creating window with frame: %.0fx%.0f", frame.size.width, frame.size.height);
  
  NSWindow *window = [[NSWindow alloc]
      initWithContentRect:frame
                styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                          NSWindowStyleMaskMiniaturizable |
                          NSWindowStyleMaskResizable
                  backing:NSBackingStoreBuffered
                    defer:NO];

  self = [super initWithWindow:window];
  if (self) {
    NSLog(@"Window controller initialized successfully");
    window.delegate = self;
    [window setTitle:@"VGMPlay"];
    [window center];
    window.appearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
    window.titlebarAppearsTransparent = YES;
    window.backgroundColor = [NSColor colorWithRed:0.165
                                             green:0.165
                                              blue:0.165
                                             alpha:1.0];
    NSLog(@"Window configured");

    // Determine base directory
    NSString *execPath = [[NSBundle mainBundle] executablePath];
    NSString *execDir = [execPath stringByDeletingLastPathComponent];
    NSLog(@"Executable path: %@", execPath);
    NSLog(@"Executable directory: %@", execDir);

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    [config.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];
    [config setValue:@YES forKey:@"allowUniversalAccessFromFileURLs"];

    self.handler = [LocalFileHandler new];
    self.handler.baseDir = execDir;
    [config setURLSchemeHandler:self.handler forURLScheme:@"vgmplay"];
    NSLog(@"URL scheme handler registered for 'vgmplay'");

    // Enable Web Inspector (Safari → Develop → VGMPlay)
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
    NSLog(@"Web Inspector enabled");

    self.webView = [[WKWebView alloc] initWithFrame:window.contentView.bounds
                                      configuration:config];
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.navigationDelegate = self;
    self.webView.UIDelegate = self;

    if ([self.webView respondsToSelector:@selector(setInspectable:)]) {
      [self.webView setValue:@YES forKey:@"inspectable"];
      NSLog(@"WebView made inspectable");
    }

    // Inject console logging bridge
    NSString *consoleScript = @"(function() { "
      "var originalLog = console.log; "
      "var originalError = console.error; "
      "var originalWarn = console.warn; "
      "console.log = function() { originalLog.apply(console, arguments); window.webkit.messageHandlers.consoleLog.postMessage({level:'log', message: Array.from(arguments).join(' ')}); }; "
      "console.error = function() { originalError.apply(console, arguments); window.webkit.messageHandlers.consoleLog.postMessage({level:'error', message: Array.from(arguments).join(' ')}); }; "
      "console.warn = function() { originalWarn.apply(console, arguments); window.webkit.messageHandlers.consoleLog.postMessage({level:'warn', message: Array.from(arguments).join(' ')}); }; "
      "})();";
    
    WKUserScript *userScript = [[WKUserScript alloc] initWithSource:consoleScript
                                                      injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                                    forMainFrameOnly:YES];
    [config.userContentController addUserScript:userScript];
    [config.userContentController addScriptMessageHandler:self name:@"consoleLog"];
    NSLog(@"Console logging bridge injected");

    [window.contentView addSubview:self.webView];
    NSLog(@"WebView frame: %@", NSStringFromRect(self.webView.frame));
    NSLog(@"Window frame: %@", NSStringFromRect(window.frame));
    NSLog(@"WebView added to window");

    NSURL *url = [NSURL URLWithString:@"vgmplay:///index.html"];
    NSLog(@"Loading URL: %@", url.absoluteString);
    [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
    NSLog(@"Load request sent to WebView");
  } else {
    NSLog(@"ERROR: Failed to initialize window controller");
  }
  return self;
}

- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                    decisionHandler:
                        (void (^)(WKNavigationActionPolicy))decisionHandler {
  NSLog(@"WebView: Navigation action - URL: %@", navigationAction.request.URL.absoluteString);
  decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView
    didFinishNavigation:(WKNavigation *)navigation {
  NSLog(@"WebView: Navigation finished");
  NSString *lastPath =
      [[NSUserDefaults standardUserDefaults] stringForKey:@"LastFolderPath"];
  if (lastPath) {
    NSLog(@"Auto-loading last used folder: %@", lastPath);
    [self loadMusicFromFolder:lastPath];
  } else {
    NSLog(@"No last folder path found in user defaults");
  }
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  NSLog(@"WebView: Navigation failed - Error: %@", error.localizedDescription);
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  NSLog(@"WebView: Provisional navigation failed - Error: %@", error.localizedDescription);
}

#pragma mark WKUIDelegate - JavaScript Console Logging

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
  NSLog(@"JS Alert: %@", message);
  completionHandler();
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
  NSLog(@"JS Confirm: %@", message);
  completionHandler(YES);
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSString * _Nullable result))completionHandler {
  NSLog(@"JS Prompt: %@ (default: %@)", prompt, defaultText);
  completionHandler(defaultText);
}

#pragma mark WKScriptMessageHandler

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
  if ([message.name isEqualToString:@"consoleLog"]) {
    NSDictionary *body = message.body;
    NSString *level = body[@"level"] ?: @"unknown";
    NSString *msg = body[@"message"] ?: @"";
    NSLog(@"JS Console [%@]: %@", level, msg);
  }
}

#pragma mark Menu Actions

- (void)openFolder:(id)sender {
  NSLog(@"File -> Open Folder clicked! Displaying panel...");
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseDirectories = YES;
    panel.canChooseFiles = NO;
    panel.allowsMultipleSelection = NO;
    panel.message = @"Select a folder containing music files";

    [NSApp activateIgnoringOtherApps:YES];
    [panel setLevel:NSStatusWindowLevel]; // Try to bring it way up

    [panel beginWithCompletionHandler:^(NSModalResponse result) {
      if (result != NSModalResponseOK) {
        NSLog(@"Open Folder canceled by user. Code: %ld", (long)result);
        return;
      }

      NSString *dirPath = panel.URL.path;
      [self loadMusicFromFolder:dirPath];
    }];
  });
}

- (void)loadMusicFromFolder:(NSString *)dirPath {
  NSURL *dirURL = [NSURL fileURLWithPath:dirPath];
  NSFileManager *fm = [NSFileManager defaultManager];

  NSSet *extensions = [NSSet setWithArray:@[
    @"zip",     @"7z",  @"rar",     @"vgm", @"vgz", @"spc",  @"nsf",
    @"nsfe",    @"gbs", @"hes",     @"sap", @"ay",  @"kss",  @"psf",
    @"minipsf", @"usf", @"miniusf", @"mp3", @"ogg", @"flac", @"wav",
    @"s3m",     @"it",  @"mod",     @"xm"
  ]];

  NSMutableArray *files = [NSMutableArray array];
  NSDirectoryEnumerator<NSURL *> *enumerator =
      [fm enumeratorAtURL:dirURL
  includingPropertiesForKeys:nil
                     options:0
                errorHandler:nil];

  for (NSURL *fileURL in enumerator) {
    NSString *ext = fileURL.pathExtension.lowercaseString;
    if ([extensions containsObject:ext]) {
      [files addObject:fileURL.path];
    }
  }

  if (files.count == 0) {
    NSString *distPath = [dirPath stringByAppendingPathComponent:@"dist"];
    BOOL isDir = NO;
    if ([fm fileExistsAtPath:distPath isDirectory:&isDir] && isDir) {
      NSURL *distURL = [NSURL fileURLWithPath:distPath];
      NSDirectoryEnumerator<NSURL *> *distEnum =
          [fm enumeratorAtURL:distURL
  includingPropertiesForKeys:nil
                     options:0
                errorHandler:nil];
      for (NSURL *fileURL in distEnum) {
        NSString *ext = fileURL.pathExtension.lowercaseString;
        if ([extensions containsObject:ext]) {
          [files addObject:fileURL.path];
        }
      }
    }
  }

  [files sortUsingSelector:@selector(localizedCaseInsensitiveCompare:)];

  NSMutableArray *jsArray = [NSMutableArray array];
  for (NSString *filePath in files) {
    NSString *escapedPath =
        [filePath stringByAddingPercentEncodingWithAllowedCharacters:
                      [NSCharacterSet URLPathAllowedCharacterSet]];
    [jsArray
        addObject:[NSString stringWithFormat:@"'vgmplay://%@'", escapedPath]];
  }

  if (jsArray.count > 0) {
    [[NSUserDefaults standardUserDefaults] setObject:dirPath
                                              forKey:@"LastFolderPath"];
    [[NSUserDefaults standardUserDefaults] synchronize];

    NSString *js = [NSString
        stringWithFormat:@"var files = [%@]; files.forEach(f => "
                         @"window.vgmPlayInstance.loadZIPWithVGMFromURL(f));",
                         [jsArray componentsJoinedByString:@","]];
    [self.webView evaluateJavaScript:js completionHandler:nil];
  }
}

@end

#pragma mark - App Delegate

@interface AppDelegate : NSObject <NSApplicationDelegate, NSMenuItemValidation>
@end

@implementation AppDelegate

- (BOOL)validateMenuItem:(NSMenuItem *)menuItem {
  return YES;
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:
    (NSApplication *)sender {
  return YES;
}

@end

#pragma mark - Main

static AppDelegate *sharedDelegate;
static AppWindowController *sharedWindowController;

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    NSLog(@"=== VGMPlay Mac App Starting ===");
    NSLog(@"Executable path: %s", argv[0]);
    
    NSApplication *app = [NSApplication sharedApplication];
    [app setActivationPolicy:NSApplicationActivationPolicyRegular];

    // Retain delegate globally so ARC doesn't erase it
    sharedDelegate = [AppDelegate new];
    app.delegate = sharedDelegate;
    NSLog(@"AppDelegate initialized");

    // Set icon programmatically as a fallback for the Dock
    NSImage *icon = [NSImage imageNamed:@"VGMPlay"];
    if (icon) {
      [app setApplicationIconImage:icon];
      NSLog(@"Icon set successfully");
    } else {
      NSLog(@"WARNING: Icon not found");
    }

    // Retain window controller globally so ARC doesn't erase it
    NSLog(@"Creating window controller...");
    sharedWindowController = [AppWindowController new];
    NSLog(@"Window controller created");

    // Important: Load Menu
    NSMenu *menuBar = [NSMenu new];

    NSMenuItem *appMenuItem = [NSMenuItem new];
    [menuBar addItem:appMenuItem];

    NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"App"];
    [appMenu addItemWithTitle:@"Quit"
                       action:@selector(terminate:)
                keyEquivalent:@"q"];
    appMenuItem.submenu = appMenu;

    NSMenuItem *fileMenuItem = [NSMenuItem new];
    [menuBar addItem:fileMenuItem];

    // Ensure menu targets point *directly* to the persistent objects
    NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"File"];
    [fileMenu addItemWithTitle:@"Open Folder\u2026"
                        action:@selector(openFolder:)
                 keyEquivalent:@"O"]
        .target = sharedWindowController;
    fileMenuItem.submenu = fileMenu;

    app.mainMenu = menuBar;
    NSLog(@"Menu bar configured");

    [app finishLaunching];
    NSLog(@"App finished launching");

    // Show window *after* everything is linked and AppKit is launched
    NSLog(@"Showing window...");
    [sharedWindowController showWindow:sharedWindowController];
    [NSApp activateIgnoringOtherApps:YES];
    NSLog(@"Window should be visible now");

    NSLog(@"=== Entering app run loop ===");
    [app run];
    NSLog(@"=== App run loop exited ===");
  }
  NSLog(@"=== VGMPlay Mac App Exiting ===");
  return 0;
}
