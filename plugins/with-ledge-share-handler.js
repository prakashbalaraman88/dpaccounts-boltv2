/**
 * Expo config plugin for LedgeShareHandler.
 *
 * The native module (LedgeShareHandlerModule.kt) registers its own
 * OnCreate / OnNewIntent lifecycle hooks through expo-modules-core,
 * so it intercepts Android share intents without any modifications
 * to MainActivity. This plugin file exists so that the app.json
 * reference resolves cleanly during `expo prebuild` / EAS Build.
 */
const { createRunOncePlugin } = require('@expo/config-plugins');

function withLedgeShareHandler(config) {
  return config;
}

module.exports = createRunOncePlugin(
  withLedgeShareHandler,
  'with-ledge-share-handler',
  '1.0.0'
);
