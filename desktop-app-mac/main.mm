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
  else if ([path hasSuffix:@".jpg"] || [path hasSuffix:@".jpeg"])
    mime = @"image/jpeg";
  else if ([path hasSuffix:@".webp"])
    mime = @"image/webp";
  else if ([path hasSuffix:@".gif"])
    mime = @"image/gif";
  else if ([path hasSuffix:@".bmp"])
    mime = @"image/bmp";
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
- (NSString *)nativeConfigPath;
- (NSString *)nativeArchiveMetaPath;
- (NSDictionary *)loadNativeConfig;
- (NSDictionary *)loadNativeArchiveMeta;
- (NSArray *)loadNativeHomeRoms;
- (void)saveNativeConfig:(NSDictionary *)config;
- (void)saveNativeArchiveMeta:(NSDictionary *)metadata;
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

    NSDictionary *nativeConfig = [self loadNativeConfig];
    NSDictionary *nativeArchiveMeta = [self loadNativeArchiveMeta];
    NSArray *nativeHomeRoms = [self loadNativeHomeRoms];
    NSData *nativeConfigData = [NSJSONSerialization dataWithJSONObject:nativeConfig options:0 error:nil];
    NSData *nativeArchiveMetaData = [NSJSONSerialization dataWithJSONObject:nativeArchiveMeta options:0 error:nil];
    NSData *nativeHomeRomsData = [NSJSONSerialization dataWithJSONObject:nativeHomeRoms options:0 error:nil];
    NSString *nativeConfigJson = nativeConfigData ? [[NSString alloc] initWithData:nativeConfigData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeArchiveMetaJson = nativeArchiveMetaData ? [[NSString alloc] initWithData:nativeArchiveMetaData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeHomeRomsJson = nativeHomeRomsData ? [[NSString alloc] initWithData:nativeHomeRomsData encoding:NSUTF8StringEncoding] : @"[]";
    NSString *nativeConfigScript = [NSString stringWithFormat:
      @"window.VGMPLAY_NATIVE_CONFIG = %@; window.VGMPLAY_NATIVE_ARCHIVE_META = %@; window.VGMPLAY_NATIVE_HOME_ROMS = %@;",
      nativeConfigJson ?: @"{}",
      nativeArchiveMetaJson ?: @"{}",
      nativeHomeRomsJson ?: @"[]"];
    WKUserScript *nativeConfigUserScript = [[WKUserScript alloc] initWithSource:nativeConfigScript
                                                                  injectionTime:WKUserScriptInjectionTimeAtDocumentStart
                                                               forMainFrameOnly:YES];
    [config.userContentController addUserScript:nativeConfigUserScript];

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
    [config.userContentController addScriptMessageHandler:self name:@"nativeSaveConfig"];
    [config.userContentController addScriptMessageHandler:self name:@"nativeSaveArchiveMeta"];
    [config.userContentController addScriptMessageHandler:self name:@"nativeOpenFile"];
    NSLog(@"Console logging bridge injected");

    [window.contentView addSubview:self.webView];
    NSLog(@"WebView frame: %@", NSStringFromRect(self.webView.frame));
    NSLog(@"Window frame: %@", NSStringFromRect(window.frame));
    NSLog(@"WebView added to window");

    NSURL *url = [NSURL URLWithString:@"vgmplay:///native-index.html"];
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
  } else if ([message.name isEqualToString:@"nativeSaveConfig"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self saveNativeConfig:(NSDictionary *)message.body];
    }
  } else if ([message.name isEqualToString:@"nativeSaveArchiveMeta"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self saveNativeArchiveMeta:(NSDictionary *)message.body];
    }
  } else if ([message.name isEqualToString:@"nativeOpenFile"]) {
    NSString *path = nil;
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      id rawPath = ((NSDictionary *)message.body)[@"path"];
      if ([rawPath isKindOfClass:[NSString class]]) path = (NSString *)rawPath;
    } else if ([message.body isKindOfClass:[NSString class]]) {
      path = (NSString *)message.body;
    }
    if (path.length > 0) {
      [[NSWorkspace sharedWorkspace] openURL:[NSURL fileURLWithPath:path]];
    }
  }
}

- (NSString *)nativeConfigPath {
  NSString *home = NSHomeDirectory();
  return [[home stringByAppendingPathComponent:@".vgmplay_js"] stringByAppendingPathComponent:@"config.json"];
}

- (NSString *)nativeArchiveMetaPath {
  NSString *home = NSHomeDirectory();
  return [[home stringByAppendingPathComponent:@".vgmplay_js"] stringByAppendingPathComponent:@"archive-meta.json"];
}

- (NSDictionary *)loadNativeConfig {
  NSString *path = [self nativeConfigPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  NSDictionary *defaults = @{ @"showUnsupported" : @NO, @"showFilenames" : @NO, @"imageOverview" : @YES, @"volume" : @80 };
  if (!data) return defaults;
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![json isKindOfClass:[NSDictionary class]]) return defaults;
  NSMutableDictionary *config = [defaults mutableCopy];
  [config addEntriesFromDictionary:(NSDictionary *)json];
  return config;
}

- (NSDictionary *)loadNativeArchiveMeta {
  NSString *path = [self nativeArchiveMetaPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  if (!data) return @{ @"version" : @1, @"packsBySha" : @{}, @"quick" : @{} };
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![json isKindOfClass:[NSDictionary class]]) return @{ @"version" : @1, @"packsBySha" : @{}, @"quick" : @{} };
  return (NSDictionary *)json;
}

- (NSArray *)loadNativeHomeRoms {
  NSString *romDir = [NSHomeDirectory() stringByAppendingPathComponent:@"vgmplay-js"];
  NSArray<NSString *> *names = @[ @"yrw801.rom", @"waves.dat", @"MT32_CONTROL.ROM", @"MT32_PCM.ROM" ];
  NSMutableArray *roms = [NSMutableArray array];
  NSFileManager *fm = [NSFileManager defaultManager];
  for (NSString *name in names) {
    NSString *path = [romDir stringByAppendingPathComponent:name];
    BOOL isDir = NO;
    if (![fm fileExistsAtPath:path isDirectory:&isDir] || isDir) continue;
    NSString *encodedPath = [path stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLPathAllowedCharacterSet]];
    NSString *url = [NSString stringWithFormat:@"vgmplay://%@", encodedPath];
    [roms addObject:@{ @"name" : name, @"url" : url }];
  }
  return roms;
}

- (void)saveNativeConfig:(NSDictionary *)config {
  NSString *path = [self nativeConfigPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  NSMutableDictionary *safeConfig = [@{ @"showUnsupported" : @NO, @"showFilenames" : @NO, @"imageOverview" : @YES, @"volume" : @80 } mutableCopy];
  if ([config[@"showUnsupported"] respondsToSelector:@selector(boolValue)]) {
    safeConfig[@"showUnsupported"] = @([config[@"showUnsupported"] boolValue]);
  }
  if ([config[@"showFilenames"] respondsToSelector:@selector(boolValue)]) {
    safeConfig[@"showFilenames"] = @([config[@"showFilenames"] boolValue]);
  }
  if ([config[@"imageOverview"] respondsToSelector:@selector(boolValue)]) {
    safeConfig[@"imageOverview"] = @([config[@"imageOverview"] boolValue]);
  }
  if ([config[@"volume"] respondsToSelector:@selector(doubleValue)]) {
    double volume = [config[@"volume"] doubleValue];
    if (volume < 0) volume = 0;
    if (volume > 100) volume = 100;
    safeConfig[@"volume"] = @(volume);
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:safeConfig options:NSJSONWritingPrettyPrinted error:nil];
  if (data) [data writeToFile:path atomically:YES];
}

- (void)saveNativeArchiveMeta:(NSDictionary *)metadata {
  NSString *path = [self nativeArchiveMetaPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  if (![NSJSONSerialization isValidJSONObject:metadata]) return;
  NSData *data = [NSJSONSerialization dataWithJSONObject:metadata options:NSJSONWritingPrettyPrinted error:nil];
  if (data) [data writeToFile:path atomically:YES];
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

  NSSet *archiveExtensions = [NSSet setWithArray:@[
    @"zip", @"7z", @"rar", @"rsn", @"vgmz", @"vgmdz", @"vgmpack", @"vigamup"
  ]];
  NSSet *imageExtensions = [NSSet setWithArray:@[
    @"png", @"jpg", @"jpeg", @"webp", @"gif", @"bmp"
  ]];
  NSSet *supportExtensions = [NSSet setWithArray:@[
    @"mwk", @"psflib", @"usflib", @"m3u", @"txt", @"trackinfo", @"gameinfo"
  ]];
  NSSet *playableExtensions = [NSSet setWithArray:@[
    @"vgm", @"vgz", @"spc", @"nsf", @"nsfe", @"gbs", @"hes", @"sap",
    @"ay", @"kss", @"kssx", @"kscc", @"psf", @"minipsf", @"ssf",
    @"minissf", @"dsf", @"minidsf", @"usf", @"miniusf", @"mus", @"lmp",
    @"mid", @"midi", @"rmi", @"s3m", @"it", @"mod", @"xm", @"mptm",
    @"stm", @"mtm", @"669", @"amf", @"dmf", @"far", @"imf", @"med",
    @"okt", @"ptm", @"ult", @"umx", @"mwm", @"mgs", @"mbm", @"mp3",
    @"ogg", @"flac", @"wav", @"ape", @"m4a", @"aac", @"opus", @"wma",
    @"aif", @"aiff", @"aifc", @"bfstm", @"bcstm", @"brstm", @"adx",
    @"hca", @"dsp", @"idsp", @"vag", @"vgs", @"fsb", @"wem", @"xma",
    @"xma2", @"at3", @"at9", @"aa3", @"ac3", @"ast", @"bnsf", @"caf",
    @"dts", @"genh", @"hps", @"mca", @"msf", @"npsf", @"nus3bank",
    @"pcm", @"rsd", @"rwav", @"strm", @"swav", @"txth", @"txtp",
    @"vab", @"vas", @"xwb", @"xwm", @"ymf", @"zsm"
  ]];

  NSMutableArray *items = [NSMutableArray array];
  NSDirectoryEnumerator<NSURL *> *enumerator =
      [fm enumeratorAtURL:dirURL
  includingPropertiesForKeys:@[NSURLFileSizeKey, NSURLContentModificationDateKey, NSURLIsRegularFileKey]
                     options:0
                errorHandler:nil];

  for (NSURL *fileURL in enumerator) {
    NSNumber *isRegular = nil;
    [fileURL getResourceValue:&isRegular forKey:NSURLIsRegularFileKey error:nil];
    if (isRegular && !isRegular.boolValue) continue;
    NSString *ext = fileURL.pathExtension.lowercaseString;
    NSString *kind = nil;
    if ([archiveExtensions containsObject:ext])
      kind = @"archive";
    else if ([playableExtensions containsObject:ext])
      kind = @"playable";
    else if ([imageExtensions containsObject:ext])
      kind = @"image";
    else if ([supportExtensions containsObject:ext])
      kind = @"unsupported";
    else
      kind = @"unsupported";

    NSString *filePath = fileURL.path;
    NSString *relativePath = filePath;
    if ([relativePath hasPrefix:dirPath]) {
      relativePath = [relativePath substringFromIndex:dirPath.length];
      if ([relativePath hasPrefix:@"/"]) relativePath = [relativePath substringFromIndex:1];
    }
    NSNumber *size = nil;
    NSDate *mtime = nil;
    [fileURL getResourceValue:&size forKey:NSURLFileSizeKey error:nil];
    [fileURL getResourceValue:&mtime forKey:NSURLContentModificationDateKey error:nil];
    NSString *escapedPath =
        [filePath stringByAddingPercentEncodingWithAllowedCharacters:
                      [NSCharacterSet URLPathAllowedCharacterSet]];
    NSMutableDictionary *item = [@{
      @"url" : [NSString stringWithFormat:@"vgmplay://%@", escapedPath],
      @"name" : fileURL.lastPathComponent ?: relativePath,
      @"relativePath" : relativePath,
      @"nativePath" : filePath,
      @"kind" : kind,
      @"sizeBytes" : size ?: @0
    } mutableCopy];
    if (mtime) item[@"mtime"] = @((long long)mtime.timeIntervalSince1970);
    [items addObject:item];
  }

  [items sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    return [a[@"relativePath"] localizedCaseInsensitiveCompare:b[@"relativePath"]];
  }];

  if (items.count > 0) {
    [[NSUserDefaults standardUserDefaults] setObject:dirPath
                                              forKey:@"LastFolderPath"];
    [[NSUserDefaults standardUserDefaults] synchronize];

    NSError *jsonError = nil;
    NSDictionary *payload = @{
      @"items" : items,
      @"options" : @{
        @"rootName" : dirPath.lastPathComponent ?: @"Music Library",
        @"rootUrl" : dirPath
      }
    };
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload
                                                       options:0
                                                         error:&jsonError];
    if (!jsonData) {
      NSLog(@"loadMusicFromFolder: Failed to encode JSON: %@", jsonError.localizedDescription);
      return;
    }
    NSString *json = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    NSString *js = [NSString stringWithFormat:
        @"(function(payload){"
         "var attempts=0;"
         "function load(){"
         "if(window.vgmPlayInstance&&window.vgmPlayInstance.loadNativeLibraryIndex){"
         "window.vgmPlayInstance.loadNativeLibraryIndex(payload.items,payload.options||{});return;}"
         "if(++attempts<200)setTimeout(load,50);"
         "else console.error('[VGM Native] Timed out waiting for native library API');"
         "}"
         "load();"
         "})(%@);",
        json];
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
