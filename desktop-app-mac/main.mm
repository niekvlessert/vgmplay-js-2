#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

static NSString *VGMStateDirectory(void) {
  return [NSHomeDirectory() stringByAppendingPathComponent:@".vgmplay_js"];
}

static NSString *VGMLogPath(void) {
  return [VGMStateDirectory() stringByAppendingPathComponent:@"log.txt"];
}

static void VGMResetLogFile(void) {
  NSString *dir = VGMStateDirectory();
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  [@"" writeToFile:VGMLogPath() atomically:YES encoding:NSUTF8StringEncoding error:nil];
}

static void VGMLog(NSString *format, ...) NS_FORMAT_FUNCTION(1, 2);

static void VGMLog(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSString *message = [[NSString alloc] initWithFormat:format arguments:args];
  va_end(args);

  NSLog(@"%@", message);

  NSString *line = [NSString stringWithFormat:@"%@ %@\n", [NSDate date], message ?: @""];
  NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) return;

  NSString *path = VGMLogPath();
  NSFileManager *fm = [NSFileManager defaultManager];
  if (![fm fileExistsAtPath:path]) {
    [fm createFileAtPath:path contents:nil attributes:nil];
  }
  NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
  if (!handle) return;
  [handle seekToEndOfFile];
  [handle writeData:data];
  [handle closeFile];
}

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
- (void)addMusicFolder:(NSString *)dirPath;
- (void)loadVisibleLibraries;
- (NSString *)nativeConfigPath;
- (NSString *)nativeArchiveMetaPath;
- (NSString *)nativeTrackMetaPath;
- (NSDictionary *)loadNativeConfig;
- (NSDictionary *)loadNativeArchiveMeta;
- (NSDictionary *)loadNativeTrackMeta;
- (NSDictionary *)nativeLibrarySettings;
- (NSArray *)loadNativeHomeRoms;
- (void)saveNativeConfig:(NSDictionary *)config;
- (void)saveNativeArchiveMeta:(NSDictionary *)metadata;
- (void)saveNativeArchiveMetaJson:(NSString *)json;
- (void)saveNativeArchiveMetaBase64Json:(NSString *)base64Json;
- (void)saveNativeTrackMeta:(NSDictionary *)metadata;
- (void)saveNativeArchiveImage:(NSDictionary *)payload;
- (void)handleNativeLibraryCommand:(NSDictionary *)payload;
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
    NSDictionary *nativeTrackMeta = [self loadNativeTrackMeta];
    NSDictionary *nativeLibrarySettings = [self nativeLibrarySettings];
    NSArray *nativeHomeRoms = [self loadNativeHomeRoms];
    NSData *nativeConfigData = [NSJSONSerialization dataWithJSONObject:nativeConfig options:0 error:nil];
    NSData *nativeArchiveMetaData = [NSJSONSerialization dataWithJSONObject:nativeArchiveMeta options:0 error:nil];
    NSData *nativeTrackMetaData = [NSJSONSerialization dataWithJSONObject:nativeTrackMeta options:0 error:nil];
    NSData *nativeLibrarySettingsData = [NSJSONSerialization dataWithJSONObject:nativeLibrarySettings options:0 error:nil];
    NSData *nativeHomeRomsData = [NSJSONSerialization dataWithJSONObject:nativeHomeRoms options:0 error:nil];
    NSString *nativeConfigJson = nativeConfigData ? [[NSString alloc] initWithData:nativeConfigData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeArchiveMetaJson = nativeArchiveMetaData ? [[NSString alloc] initWithData:nativeArchiveMetaData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeTrackMetaJson = nativeTrackMetaData ? [[NSString alloc] initWithData:nativeTrackMetaData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeLibrarySettingsJson = nativeLibrarySettingsData ? [[NSString alloc] initWithData:nativeLibrarySettingsData encoding:NSUTF8StringEncoding] : @"{}";
    NSString *nativeHomeRomsJson = nativeHomeRomsData ? [[NSString alloc] initWithData:nativeHomeRomsData encoding:NSUTF8StringEncoding] : @"[]";
    NSString *nativeConfigScript = [NSString stringWithFormat:
      @"window.VGMPLAY_NATIVE_CONFIG = %@; window.VGMPLAY_NATIVE_ARCHIVE_META = %@; window.VGMPLAY_NATIVE_TRACK_META = %@; window.VGMPLAY_NATIVE_LIBRARY_SETTINGS = %@; window.VGMPLAY_NATIVE_HOME_ROMS = %@;",
      nativeConfigJson ?: @"{}",
      nativeArchiveMetaJson ?: @"{}",
      nativeTrackMetaJson ?: @"{}",
      nativeLibrarySettingsJson ?: @"{}",
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
    [config.userContentController addScriptMessageHandler:self name:@"nativeSaveArchiveImage"];
    [config.userContentController addScriptMessageHandler:self name:@"nativeSaveTrackMeta"];
    [config.userContentController addScriptMessageHandler:self name:@"nativeLibraryCommand"];
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
    NSLog(@"Migrating last used folder: %@", lastPath);
    [self addMusicFolder:lastPath];
  } else {
    NSLog(@"No last folder path found in user defaults");
  }
  [self loadVisibleLibraries];
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
  NSAlert *alert = [[NSAlert alloc] init];
  alert.messageText = message.length ? message : @"Confirm";
  [alert addButtonWithTitle:@"OK"];
  [alert addButtonWithTitle:@"Cancel"];
  completionHandler([alert runModal] == NSAlertFirstButtonReturn);
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
    VGMLog(@"JS Console [%@]: %@", level, msg);
  } else if ([message.name isEqualToString:@"nativeSaveConfig"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self saveNativeConfig:(NSDictionary *)message.body];
    }
  } else if ([message.name isEqualToString:@"nativeSaveArchiveMeta"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      NSDictionary *body = (NSDictionary *)message.body;
      if ([body[@"encoding"] isEqualToString:@"base64-json"] && [body[@"data"] isKindOfClass:[NSString class]]) {
        [self saveNativeArchiveMetaBase64Json:(NSString *)body[@"data"]];
      } else {
        [self saveNativeArchiveMeta:body];
      }
    } else if ([message.body isKindOfClass:[NSString class]]) {
      [self saveNativeArchiveMetaJson:(NSString *)message.body];
    } else {
      VGMLog(@"nativeSaveArchiveMeta ignored unexpected body type: %@", NSStringFromClass([message.body class]));
    }
  } else if ([message.name isEqualToString:@"nativeSaveArchiveImage"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self saveNativeArchiveImage:(NSDictionary *)message.body];
    } else {
      VGMLog(@"nativeSaveArchiveImage ignored unexpected body type: %@", NSStringFromClass([message.body class]));
    }
  } else if ([message.name isEqualToString:@"nativeSaveTrackMeta"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self saveNativeTrackMeta:(NSDictionary *)message.body];
    }
  } else if ([message.name isEqualToString:@"nativeLibraryCommand"]) {
    if ([message.body isKindOfClass:[NSDictionary class]]) {
      [self handleNativeLibraryCommand:(NSDictionary *)message.body];
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
  return [VGMStateDirectory() stringByAppendingPathComponent:@"config.json"];
}

- (NSString *)nativeArchiveMetaPath {
  return [VGMStateDirectory() stringByAppendingPathComponent:@"archive-meta.json"];
}

- (NSString *)nativeTrackMetaPath {
  return [VGMStateDirectory() stringByAppendingPathComponent:@"track-meta.json"];
}

- (NSDictionary *)loadNativeConfig {
  NSString *path = [self nativeConfigPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  NSDictionary *defaults = @{
    @"showUnsupported" : @NO,
    @"showFilenames" : @NO,
    @"imageOverview" : @YES,
    @"volume" : @80,
    @"libraryWidth" : @440,
    @"sortByTypeFirst" : @NO,
    @"sortArchiveContents" : @NO,
    @"mixNativeLibraries" : @NO,
    @"noBadgeColors" : @NO,
    @"lightTheme" : @NO
  };
  if (!data) return defaults;
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![json isKindOfClass:[NSDictionary class]]) return defaults;
  NSMutableDictionary *config = [NSMutableDictionary dictionaryWithDictionary:defaults];
  [config addEntriesFromDictionary:(NSDictionary *)json];
  return config;
}

- (NSDictionary *)loadNativeArchiveMeta {
  NSString *path = [self nativeArchiveMetaPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  if (!data) return @{ @"version" : @1, @"packsBySha" : @{}, @"quick" : @{} };
  NSError *error = nil;
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
  if (![json isKindOfClass:[NSDictionary class]]) {
    NSString *raw = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (raw) {
      NSError *regexError = nil;
      NSRegularExpression *surrogateEscapeRegex =
          [NSRegularExpression regularExpressionWithPattern:@"\\\\u[dD][89a-fA-F][0-9a-fA-F]{2}"
                                                    options:0
                                                      error:&regexError];
      if (surrogateEscapeRegex && !regexError) {
        NSString *repaired = [surrogateEscapeRegex stringByReplacingMatchesInString:raw
                                                                            options:0
                                                                              range:NSMakeRange(0, raw.length)
                                                                       withTemplate:@"\\\\ufffd"];
        NSData *repairedData = [repaired dataUsingEncoding:NSUTF8StringEncoding];
        if (repairedData) {
          NSError *repairParseError = nil;
          id repairedJson = [NSJSONSerialization JSONObjectWithData:repairedData options:0 error:&repairParseError];
          if ([repairedJson isKindOfClass:[NSDictionary class]]) {
            [repairedData writeToFile:path atomically:YES];
            VGMLog(@"repaired native archive metadata surrogate escapes in %@ (%lu bytes)", path, (unsigned long)repairedData.length);
            return (NSDictionary *)repairedJson;
          }
        }
      }
    }
    VGMLog(@"failed to load native archive metadata from %@: %@", path, error);
    return @{ @"version" : @1, @"packsBySha" : @{}, @"quick" : @{} };
  }
  VGMLog(@"loaded native archive metadata from %@ (%lu bytes)", path, (unsigned long)data.length);
  return (NSDictionary *)json;
}

- (NSDictionary *)loadNativeTrackMeta {
  NSString *path = [self nativeTrackMetaPath];
  NSData *data = [NSData dataWithContentsOfFile:path];
  if (!data) return @{ @"version" : @2, @"tracks" : @{} };
  id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![json isKindOfClass:[NSDictionary class]]) return @{ @"version" : @2, @"tracks" : @{} };
  return (NSDictionary *)json;
}

- (NSArray *)libraryDirectories {
  NSArray *dirs = [[NSUserDefaults standardUserDefaults] arrayForKey:@"LibraryDirectories"];
  return [dirs isKindOfClass:[NSArray class]] ? dirs : @[];
}

- (void)saveLibraryDirectories:(NSArray *)dirs {
  [[NSUserDefaults standardUserDefaults] setObject:dirs ?: @[] forKey:@"LibraryDirectories"];
  [[NSUserDefaults standardUserDefaults] synchronize];
}

- (NSString *)displayNameForPath:(NSString *)path fallback:(NSString *)fallback {
  NSString *name = path.lastPathComponent;
  return name.length ? name : fallback;
}

- (BOOL)pathHasMusic:(NSString *)path {
  NSFileManager *fm = [NSFileManager defaultManager];
  BOOL isDir = NO;
  if (![fm fileExistsAtPath:path isDirectory:&isDir] || !isDir) return NO;
  NSSet *musicExtensions = [NSSet setWithArray:@[
    @"zip", @"7z", @"rar", @"rsn", @"vgmz", @"vgmdz", @"vgmpack", @"vigamup",
    @"vgm", @"vgz", @"spc", @"nsf", @"nsfe", @"gbs", @"hes", @"sap", @"ay",
    @"kss", @"kssx", @"kscc", @"psf", @"minipsf", @"ssf", @"minissf", @"dsf",
    @"minidsf", @"usf", @"miniusf", @"mus", @"lmp", @"mid", @"midi", @"rmi",
    @"s3m", @"it", @"mod", @"xm", @"mptm", @"mp3", @"ogg", @"flac", @"wav",
    @"ape", @"m4a", @"aac", @"opus"
  ]];
  NSDirectoryEnumerator<NSURL *> *enumerator =
      [fm enumeratorAtURL:[NSURL fileURLWithPath:path]
includingPropertiesForKeys:@[NSURLIsRegularFileKey]
                  options:0
             errorHandler:nil];
  for (NSURL *fileURL in enumerator) {
    NSNumber *isRegular = nil;
    [fileURL getResourceValue:&isRegular forKey:NSURLIsRegularFileKey error:nil];
    if (isRegular && !isRegular.boolValue) continue;
    if ([musicExtensions containsObject:fileURL.pathExtension.lowercaseString]) return YES;
  }
  return NO;
}

- (NSString *)uniquePrefixForName:(NSString *)name counts:(NSMutableDictionary *)counts {
  NSString *base = name.length ? name : @"Music";
  NSNumber *raw = counts[base];
  NSInteger count = raw ? raw.integerValue + 1 : 1;
  counts[base] = @(count);
  return count <= 1 ? base : [NSString stringWithFormat:@"%@ (%ld)", base, (long)count];
}

- (NSDictionary *)nativeLibrarySettings {
  NSArray *dirs = [self libraryDirectories];
  NSMutableArray *outDirs = [NSMutableArray array];
  NSMutableDictionary *counts = [NSMutableDictionary dictionary];
  BOOL hasPersonalMusic = NO;
  NSFileManager *fm = [NSFileManager defaultManager];
  for (NSDictionary *dir in dirs) {
    if (![dir isKindOfClass:[NSDictionary class]]) continue;
    NSString *path = [dir[@"path"] isKindOfClass:[NSString class]] ? dir[@"path"] : @"";
    NSString *name = [self displayNameForPath:path fallback:@"Music"];
    NSString *prefix = [self uniquePrefixForName:name counts:counts];
    BOOL isDir = NO;
    BOOL readable = [fm fileExistsAtPath:path isDirectory:&isDir] && isDir && [fm isReadableFileAtPath:path];
    BOOL hasMusic = readable && [self pathHasMusic:path];
    if (hasMusic) hasPersonalMusic = YES;
    [outDirs addObject:@{
      @"uri" : path ?: @"",
      @"name" : name ?: @"Music",
      @"prefix" : prefix ?: name ?: @"Music",
      @"enabled" : @(![dir[@"enabled"] respondsToSelector:@selector(boolValue)] || [dir[@"enabled"] boolValue]),
      @"readable" : @(readable),
      @"musicCount" : @(hasMusic ? 1 : 0)
    }];
  }
  BOOL includedDeleted = [[NSUserDefaults standardUserDefaults] boolForKey:@"IncludedMusicDeleted"];
  id showIncludedRaw = [[NSUserDefaults standardUserDefaults] objectForKey:@"ShowIncludedMusic"];
  BOOL showIncluded = showIncludedRaw ? [showIncludedRaw boolValue] : YES;
  NSString *distPath = [[[NSBundle mainBundle] executablePath] stringByDeletingLastPathComponent];
  distPath = [distPath stringByAppendingPathComponent:@"dist"];
  BOOL distIsDir = NO;
  BOOL includedAvailable = [fm fileExistsAtPath:distPath isDirectory:&distIsDir] && distIsDir;
  return @{
    @"includedAvailable" : @(includedAvailable),
    @"includedVisible" : @(showIncluded),
    @"includedDeleted" : @(includedDeleted),
    @"includedControlsEnabled" : @(hasPersonalMusic),
    @"hasPersonalMusic" : @(hasPersonalMusic),
    @"dirs" : outDirs
  };
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
  NSMutableDictionary *safeConfig = [NSMutableDictionary dictionary];
  
  safeConfig[@"showUnsupported"] = @([config[@"showUnsupported"] respondsToSelector:@selector(boolValue)] ? [config[@"showUnsupported"] boolValue] : NO);
  safeConfig[@"showFilenames"] = @([config[@"showFilenames"] respondsToSelector:@selector(boolValue)] ? [config[@"showFilenames"] boolValue] : NO);
  safeConfig[@"imageOverview"] = @([config[@"imageOverview"] respondsToSelector:@selector(boolValue)] ? [config[@"imageOverview"] boolValue] : YES);
  safeConfig[@"volume"] = @([config[@"volume"] respondsToSelector:@selector(doubleValue)] ? MIN(100, MAX(0, [config[@"volume"] doubleValue])) : 80);
  safeConfig[@"libraryWidth"] = @([config[@"libraryWidth"] respondsToSelector:@selector(doubleValue)] ? MIN(800, MAX(440, [config[@"libraryWidth"] doubleValue])) : 440);
  safeConfig[@"sortByTypeFirst"] = @([config[@"sortByTypeFirst"] respondsToSelector:@selector(boolValue)] ? [config[@"sortByTypeFirst"] boolValue] : NO);
  safeConfig[@"sortArchiveContents"] = @([config[@"sortArchiveContents"] respondsToSelector:@selector(boolValue)] ? [config[@"sortArchiveContents"] boolValue] : NO);
  safeConfig[@"mixNativeLibraries"] = @([config[@"mixNativeLibraries"] respondsToSelector:@selector(boolValue)] ? [config[@"mixNativeLibraries"] boolValue] : NO);
  safeConfig[@"noBadgeColors"] = @([config[@"noBadgeColors"] respondsToSelector:@selector(boolValue)] ? [config[@"noBadgeColors"] boolValue] : NO);
  safeConfig[@"lightTheme"] = @([config[@"lightTheme"] respondsToSelector:@selector(boolValue)] ? [config[@"lightTheme"] boolValue] : NO);
  
  NSData *data = [NSJSONSerialization dataWithJSONObject:safeConfig options:NSJSONWritingPrettyPrinted error:nil];
  if (data) [data writeToFile:path atomically:YES];
}

- (void)saveNativeArchiveMeta:(NSDictionary *)metadata {
  NSString *path = [self nativeArchiveMetaPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  if (![NSJSONSerialization isValidJSONObject:metadata]) {
    VGMLog(@"native archive metadata is not valid JSON object");
    return;
  }
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:metadata options:NSJSONWritingPrettyPrinted error:&error];
  if (!data) {
    VGMLog(@"failed to serialize native archive metadata: %@", error);
    return;
  }
  if (![data writeToFile:path atomically:YES]) {
    VGMLog(@"failed to write native archive metadata to %@", path);
    return;
  }
  VGMLog(@"saved native archive metadata to %@ (%lu bytes)", path, (unsigned long)data.length);
}

- (void)saveNativeArchiveMetaJson:(NSString *)json {
  NSString *path = [self nativeArchiveMetaPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) {
    VGMLog(@"native archive metadata JSON could not be encoded");
    return;
  }
  if (![data writeToFile:path atomically:YES]) {
    VGMLog(@"failed to write native archive metadata JSON to %@", path);
    return;
  }
  VGMLog(@"saved native archive metadata JSON to %@ (%lu bytes)", path, (unsigned long)data.length);
}

- (void)saveNativeArchiveMetaBase64Json:(NSString *)base64Json {
  NSString *path = [self nativeArchiveMetaPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];

  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Json options:0];
  if (!data) {
    VGMLog(@"native archive metadata base64 JSON could not be decoded");
    return;
  }
  if (![data writeToFile:path atomically:YES]) {
    VGMLog(@"failed to write native archive metadata base64 JSON to %@", path);
    return;
  }
  VGMLog(@"saved native archive metadata base64 JSON to %@ (%lu bytes)", path, (unsigned long)data.length);
}

- (void)saveNativeTrackMeta:(NSDictionary *)metadata {
  NSString *path = [self nativeTrackMetaPath];
  NSString *dir = [path stringByDeletingLastPathComponent];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  if (![NSJSONSerialization isValidJSONObject:metadata]) return;
  NSData *data = [NSJSONSerialization dataWithJSONObject:metadata options:NSJSONWritingPrettyPrinted error:nil];
  if (data) [data writeToFile:path atomically:YES];
}

- (void)pruneMetadataForKeyPrefix:(NSString *)prefix {
  if (prefix.length == 0) return;
  NSMutableDictionary *archiveMeta = [[self loadNativeArchiveMeta] mutableCopy];
  NSMutableDictionary *quick = [archiveMeta[@"quick"] isKindOfClass:[NSDictionary class]] ? [archiveMeta[@"quick"] mutableCopy] : [NSMutableDictionary dictionary];
  NSMutableDictionary *packs = [archiveMeta[@"packsBySha"] isKindOfClass:[NSDictionary class]] ? [archiveMeta[@"packsBySha"] mutableCopy] : [NSMutableDictionary dictionary];
  for (NSString *key in [quick.allKeys copy]) {
    if ([key hasPrefix:prefix]) [quick removeObjectForKey:key];
  }
  NSSet *referenced = [NSSet setWithArray:quick.allValues];
  for (NSString *sha in [packs.allKeys copy]) {
    if (![referenced containsObject:sha]) [packs removeObjectForKey:sha];
  }
  archiveMeta[@"quick"] = quick;
  archiveMeta[@"packsBySha"] = packs;
  [self saveNativeArchiveMeta:archiveMeta];

  NSMutableDictionary *trackMeta = [[self loadNativeTrackMeta] mutableCopy];
  NSMutableDictionary *tracks = [trackMeta[@"tracks"] isKindOfClass:[NSDictionary class]] ? [trackMeta[@"tracks"] mutableCopy] : [NSMutableDictionary dictionary];
  for (NSString *key in [tracks.allKeys copy]) {
    if ([key hasPrefix:prefix]) [tracks removeObjectForKey:key];
  }
  trackMeta[@"tracks"] = tracks;
  [self saveNativeTrackMeta:trackMeta];
}

- (void)pruneMetadataForLibraryPrefix:(NSString *)prefix {
  [self pruneMetadataForKeyPrefix:[NSString stringWithFormat:@"native://libraries|%@", prefix ?: @""]];
  [self pruneMetadataForKeyPrefix:[NSString stringWithFormat:@"Music Libraries|%@", prefix ?: @""]];
}

- (void)saveNativeArchiveImage:(NSDictionary *)payload {
  NSString *path = [payload[@"path"] isKindOfClass:[NSString class]] ? payload[@"path"] : nil;
  NSString *base64 = [payload[@"data"] isKindOfClass:[NSString class]] ? payload[@"data"] : nil;
  if (path.length == 0 || base64.length == 0) {
    VGMLog(@"native archive image save missing path or data");
    return;
  }

  NSString *dir = [path stringByDeletingLastPathComponent];
  if (![[dir lastPathComponent] isEqualToString:@".vgmplay_js_images"]) {
    VGMLog(@"native archive image save rejected unexpected directory: %@", path);
    return;
  }

  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:0];
  if (!data) {
    VGMLog(@"native archive image could not be decoded: %@", path);
    return;
  }

  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  if (![data writeToFile:path atomically:YES]) {
    VGMLog(@"failed to write native archive image to %@", path);
    return;
  }
  VGMLog(@"saved native archive image to %@ (%lu bytes)", path, (unsigned long)data.length);
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
      [self addMusicFolder:dirPath];
    }];
  });
}

- (void)addMusicFolder:(NSString *)dirPath {
  if (dirPath.length == 0) return;
  NSFileManager *fm = [NSFileManager defaultManager];
  BOOL isDir = NO;
  if (![fm fileExistsAtPath:dirPath isDirectory:&isDir] || !isDir) return;

  NSMutableArray *dirs = [[self libraryDirectories] mutableCopy];
  BOOL exists = NO;
  for (NSDictionary *dir in dirs) {
    if (![dir isKindOfClass:[NSDictionary class]]) continue;
    NSString *path = [dir[@"path"] isKindOfClass:[NSString class]] ? dir[@"path"] : @"";
    if ([path isEqualToString:dirPath]) {
      exists = YES;
      break;
    }
  }
  if (!exists) {
    [dirs addObject:@{ @"path" : dirPath, @"enabled" : @YES }];
    [self saveLibraryDirectories:dirs];
  }
  [[NSUserDefaults standardUserDefaults] setObject:dirPath forKey:@"LastFolderPath"];
  [[NSUserDefaults standardUserDefaults] synchronize];
  [self loadVisibleLibraries];
}

- (void)appendMusicFolder:(NSString *)dirPath prefix:(NSString *)prefix items:(NSMutableArray *)items {
  NSURL *dirURL = [NSURL fileURLWithPath:dirPath];
  NSFileManager *fm = [NSFileManager defaultManager];

  NSSet *archiveExtensions = [NSSet setWithArray:@[
    @"zip", @"7z", @"rar", @"rsn", @"vgmz", @"vgmdz", @"vgmpack", @"vigamup"
  ]];
  NSSet *imageExtensions = [NSSet setWithArray:@[
    @"png", @"jpg", @"jpeg", @"webp", @"gif", @"bmp"
  ]];
  NSSet *supportExtensions = [NSSet setWithArray:@[
    @"mwk", @"psflib", @"ssflib", @"usflib", @"m3u", @"txt", @"trackinfo", @"gameinfo"
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
    if (prefix.length > 0) {
      relativePath = relativePath.length ? [prefix stringByAppendingPathComponent:relativePath] : prefix;
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
}

- (void)loadVisibleLibraries {
  NSMutableArray *items = [NSMutableArray array];
  NSDictionary *settings = [self nativeLibrarySettings];
  NSFileManager *fm = [NSFileManager defaultManager];

  BOOL showIncluded = ![settings[@"includedDeleted"] boolValue] && [settings[@"includedVisible"] boolValue] && [settings[@"includedAvailable"] boolValue];
  if (showIncluded) {
    NSString *distPath = [[[NSBundle mainBundle] executablePath] stringByDeletingLastPathComponent];
    distPath = [distPath stringByAppendingPathComponent:@"dist"];
    BOOL isDir = NO;
    if ([fm fileExistsAtPath:distPath isDirectory:&isDir] && isDir) {
      [self appendMusicFolder:distPath prefix:@"Included Music" items:items];
    }
  }

  NSArray *dirs = [settings[@"dirs"] isKindOfClass:[NSArray class]] ? settings[@"dirs"] : @[];
  for (NSDictionary *dir in dirs) {
    if (![dir isKindOfClass:[NSDictionary class]]) continue;
    if (![dir[@"enabled"] boolValue] || ![dir[@"readable"] boolValue]) continue;
    NSString *path = [dir[@"uri"] isKindOfClass:[NSString class]] ? dir[@"uri"] : @"";
    NSString *prefix = [dir[@"prefix"] isKindOfClass:[NSString class]] ? dir[@"prefix"] : [self displayNameForPath:path fallback:@"Music"];
    [self appendMusicFolder:path prefix:prefix items:items];
  }

  [items sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    return [a[@"relativePath"] localizedCaseInsensitiveCompare:b[@"relativePath"]];
  }];

  NSError *jsonError = nil;
  NSDictionary *payload = @{
    @"items" : items,
    @"options" : @{
      @"rootName" : @"Music Libraries",
      @"rootUrl" : @"native://libraries",
      @"librarySettings" : settings
    }
  };
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload
                                                     options:0
                                                       error:&jsonError];
  if (!jsonData) {
    NSLog(@"loadVisibleLibraries: Failed to encode JSON: %@", jsonError.localizedDescription);
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

- (void)handleNativeLibraryCommand:(NSDictionary *)payload {
  NSString *command = [payload[@"command"] isKindOfClass:[NSString class]] ? payload[@"command"] : @"";
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];

  if ([command isEqualToString:@"setIncludedVisible"]) {
    [defaults setBool:[payload[@"visible"] respondsToSelector:@selector(boolValue)] ? [payload[@"visible"] boolValue] : YES
               forKey:@"ShowIncludedMusic"];
    [defaults synchronize];
    [self loadVisibleLibraries];
    return;
  }

  if ([command isEqualToString:@"deleteIncludedMusic"]) {
    [defaults setBool:YES forKey:@"IncludedMusicDeleted"];
    [defaults setBool:NO forKey:@"ShowIncludedMusic"];
    [defaults synchronize];
    [self pruneMetadataForLibraryPrefix:@"Included Music/"];
    [self pruneMetadataForKeyPrefix:@"Bundled Music|"];
    [self loadVisibleLibraries];
    return;
  }

  NSString *uri = [payload[@"uri"] isKindOfClass:[NSString class]] ? payload[@"uri"] : @"";
  if (uri.length == 0) return;

  NSMutableArray *dirs = [[self libraryDirectories] mutableCopy];
  NSInteger index = NSNotFound;
  NSString *oldName = nil;
  for (NSUInteger i = 0; i < dirs.count; i++) {
    NSDictionary *dir = [dirs[i] isKindOfClass:[NSDictionary class]] ? dirs[i] : nil;
    NSString *path = [dir[@"path"] isKindOfClass:[NSString class]] ? dir[@"path"] : @"";
    if ([path isEqualToString:uri]) {
      index = (NSInteger)i;
      oldName = [self displayNameForPath:path fallback:@"Music"];
      break;
    }
  }
  if (index == NSNotFound) return;

  if ([command isEqualToString:@"setFolderVisible"]) {
    NSMutableDictionary *dir = [dirs[index] mutableCopy];
    dir[@"enabled"] = @([payload[@"visible"] respondsToSelector:@selector(boolValue)] ? [payload[@"visible"] boolValue] : YES);
    dirs[index] = dir;
    [self saveLibraryDirectories:dirs];
    [self loadVisibleLibraries];
    return;
  }

  if ([command isEqualToString:@"deleteFolder"]) {
    NSString *prefix = [payload[@"prefix"] isKindOfClass:[NSString class]] ? payload[@"prefix"] : oldName;
    [dirs removeObjectAtIndex:(NSUInteger)index];
    [self saveLibraryDirectories:dirs];
    if (prefix.length > 0) [self pruneMetadataForLibraryPrefix:[prefix stringByAppendingString:@"/"]];
    if (oldName.length > 0) [self pruneMetadataForKeyPrefix:[NSString stringWithFormat:@"%@|", oldName]];
    [self loadVisibleLibraries];
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
    VGMResetLogFile();
    VGMLog(@"=== VGMPlay Mac App Starting ===");
    VGMLog(@"Executable path: %s", argv[0]);
    
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
