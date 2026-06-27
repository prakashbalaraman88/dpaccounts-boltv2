const { withMainActivity } = require('@expo/config-plugins');

/**
 * Config plugin that patches MainActivity to call LedgeShareHandlerModule
 * in onCreate() and onNewIntent(). This mirrors WhatsApp's share intent
 * handling: the native module copies content:// URIs to cache BEFORE the
 * JS layer ever sees them, eliminating the URI expiry race condition.
 */
function withLedgeShareHandler(config) {
  return withMainActivity(config, (config) => {
    const { modResults } = config;
    const { contents } = modResults;

    // 1. Add import for LedgeShareHandlerModule
    const importLine = 'import com.ledge.sharehandler.LedgeShareHandlerModule';
    if (!contents.includes(importLine)) {
      const lines = contents.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, importLine);
        modResults.contents = lines.join('\n');
      }
    }

    // 2. Add onCreate hook after super.onCreate(...)
    const onCreateHook = '\n    // LedgeShareHandler: copy shared content to cache on cold start\n    LedgeShareHandlerModule.handleIntent(intent, contentResolver, cacheDir)';

    if (!modResults.contents.includes('LedgeShareHandlerModule.handleIntent')) {
      // Handle both super.onCreate(null) and super.onCreate(savedInstanceState)
      modResults.contents = modResults.contents.replace(
        /(super\.onCreate\([^)]*\))(\s*\n)/,
        `$1$2${onCreateHook}`
      );
    }

    // 3. Add onNewIntent override
    const onNewIntentMethod = `
  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    // LedgeShareHandler: copy shared content to cache on warm start
    LedgeShareHandlerModule.handleIntent(intent, contentResolver, cacheDir)
  }
`;

    if (!modResults.contents.includes('override fun onNewIntent')) {
      if (!modResults.contents.includes('import android.content.Intent')) {
        const lines = modResults.contents.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ')) {
            lastImportIndex = i;
          }
        }
        if (lastImportIndex >= 0) {
          lines.splice(lastImportIndex + 1, 0, 'import android.content.Intent');
          modResults.contents = lines.join('\n');
        }
      }

      modResults.contents = modResults.contents.replace(
        /\n\}\s*$/,
        `${onNewIntentMethod}}\n`
      );
    }

    return config;
  });
}

module.exports = withLedgeShareHandler;
