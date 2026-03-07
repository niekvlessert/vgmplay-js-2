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
  NSString *urlPath = url.path;
  NSString *relPath = urlPath;
  if ([relPath hasPrefix:@"/"])
    relPath = [relPath substringFromIndex:1];

  // Try absolute path first (for user-selected files),
  // then fall back to baseDir-relative (for app assets)
  NSString *path = nil;
  if (urlPath.length > 0 &&
      [[NSFileManager defaultManager] fileExistsAtPath:urlPath]) {
    path = urlPath;
  } else {
    path = [self.baseDir stringByAppendingPathComponent:relPath];
    path = [path stringByResolvingSymlinksInPath];
  }

  NSData *data = [NSData dataWithContentsOfFile:path];
  if (!data) {
    NSError *err = [NSError errorWithDomain:NSURLErrorDomain
                                       code:NSURLErrorFileDoesNotExist
                                   userInfo:nil];
    [task didFailWithError:err];
    return;
  }

  // Determine MIME type
  NSString *mime = @"application/octet-stream";
  if ([path hasSuffix:@".html"])
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
}

- (void)webView:(WKWebView *)webView
    stopURLSchemeTask:(id<WKURLSchemeTask>)task {
}

@end

#pragma mark - Window Controller

@interface AppWindowController
    : NSWindowController <WKNavigationDelegate, NSWindowDelegate>
@property(strong) WKWebView *webView;
@property(strong) LocalFileHandler *handler;
- (void)loadMusicFromFolder:(NSString *)dirPath;
@end

@implementation AppWindowController

- (instancetype)init {
  NSRect frame = NSMakeRect(0, 0, 1200, 800);
  NSWindow *window = [[NSWindow alloc]
      initWithContentRect:frame
                styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
                          NSWindowStyleMaskMiniaturizable |
                          NSWindowStyleMaskResizable
                  backing:NSBackingStoreBuffered
                    defer:NO];

  self = [super initWithWindow:window];
  if (self) {
    window.delegate = self;
    [window setTitle:@"VGMPlay"];
    [window center];
    window.appearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
    window.titlebarAppearsTransparent = YES;
    window.backgroundColor = [NSColor colorWithRed:0.165
                                             green:0.165
                                              blue:0.165
                                             alpha:1.0];

    // Determine base directory
    NSString *execPath = [[NSBundle mainBundle] executablePath];
    NSString *execDir = [execPath stringByDeletingLastPathComponent];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    [config.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];
    [config setValue:@YES forKey:@"allowUniversalAccessFromFileURLs"];

    self.handler = [LocalFileHandler new];
    self.handler.baseDir = execDir;
    [config setURLSchemeHandler:self.handler forURLScheme:@"vgmplay"];

    // Enable Web Inspector (Safari → Develop → VGMPlay)
    [config.preferences setValue:@YES forKey:@"developerExtrasEnabled"];

    self.webView = [[WKWebView alloc] initWithFrame:window.contentView.bounds
                                      configuration:config];
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.navigationDelegate = self;

    if ([self.webView respondsToSelector:@selector(setInspectable:)]) {
      [self.webView setValue:@YES forKey:@"inspectable"];
    }

    [window.contentView addSubview:self.webView];

    NSURL *url = [NSURL URLWithString:@"vgmplay:///index.html"];
    [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
  }
  return self;
}

- (void)webView:(WKWebView *)webView
    decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction
                    decisionHandler:
                        (void (^)(WKNavigationActionPolicy))decisionHandler {
  decisionHandler(WKNavigationActionPolicyAllow);
}

- (void)webView:(WKWebView *)webView
    didFinishNavigation:(WKNavigation *)navigation {
  NSString *lastPath =
      [[NSUserDefaults standardUserDefaults] stringForKey:@"LastFolderPath"];
  if (lastPath) {
    NSLog(@"Auto-loading last used folder: %@", lastPath);
    [self loadMusicFromFolder:lastPath];
  }
}

#pragma mark Menu Actions

- (void)openFile:(id)sender {
  NSLog(@"File -> Open File clicked! Displaying panel...");
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseDirectories = NO;
    panel.canChooseFiles = YES;
    panel.allowsMultipleSelection = YES;
    panel.message = @"Select music files";

    [NSApp activateIgnoringOtherApps:YES];
    [panel setLevel:NSStatusWindowLevel]; // Try to bring it way up

    [panel beginWithCompletionHandler:^(NSModalResponse result) {
      if (result != NSModalResponseOK) {
        NSLog(@"Open File canceled by user. Code: %ld", (long)result);
        return;
      }

      NSMutableArray *jsArray = [NSMutableArray array];
      for (NSURL *fileURL in panel.URLs) {
        NSString *escapedPath =
            [fileURL.path stringByAddingPercentEncodingWithAllowedCharacters:
                              [NSCharacterSet URLPathAllowedCharacterSet]];
        [jsArray addObject:[NSString stringWithFormat:@"'vgmplay://%@'",
                                                      escapedPath]];
      }

      if (jsArray.count > 0) {
        NSString *js =
            [NSString stringWithFormat:
                          @"var files = [%@]; files.forEach(f => "
                          @"window.vgmPlayInstance.loadZIPWithVGMFromURL(f));",
                          [jsArray componentsJoinedByString:@","]];
        [self.webView evaluateJavaScript:js completionHandler:nil];
      }
    }];
  });
}

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

  NSArray<NSURL *> *contents = [fm contentsOfDirectoryAtURL:dirURL
                                 includingPropertiesForKeys:nil
                                                    options:0
                                                      error:nil];
  if (!contents)
    return;

  NSSet *extensions = [NSSet setWithArray:@[
    @"zip",     @"7z",  @"rar",     @"vgm", @"vgz", @"spc",  @"nsf",
    @"nsfe",    @"gbs", @"hes",     @"sap", @"ay",  @"kss",  @"psf",
    @"minipsf", @"usf", @"miniusf", @"mp3", @"ogg", @"flac", @"wav"
  ]];

  NSMutableArray *files = [NSMutableArray array];
  for (NSURL *fileURL in contents) {
    NSString *ext = fileURL.pathExtension.lowercaseString;
    if ([extensions containsObject:ext]) {
      [files addObject:fileURL.path];
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
    NSApplication *app = [NSApplication sharedApplication];
    [app setActivationPolicy:NSApplicationActivationPolicyRegular];

    // Retain delegate globally so ARC doesn't erase it
    sharedDelegate = [AppDelegate new];
    app.delegate = sharedDelegate;

    // Set icon programmatically as a fallback for the Dock
    NSImage *icon = [NSImage imageNamed:@"VGMPlay"];
    if (icon) {
      [app setApplicationIconImage:icon];
    }

    // Retain window controller globally so ARC doesn't erase it
    sharedWindowController = [AppWindowController new];

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
    [fileMenu addItemWithTitle:@"Open File\u2026"
                        action:@selector(openFile:)
                 keyEquivalent:@"o"]
        .target = sharedWindowController;
    [fileMenu addItemWithTitle:@"Open Folder\u2026"
                        action:@selector(openFolder:)
                 keyEquivalent:@"O"]
        .target = sharedWindowController;
    fileMenuItem.submenu = fileMenu;

    app.mainMenu = menuBar;

    [app finishLaunching];

    // Show window *after* everything is linked and AppKit is launched
    [sharedWindowController showWindow:sharedWindowController];
    [NSApp activateIgnoringOtherApps:YES];

    [app run];
  }
  return 0;
}
