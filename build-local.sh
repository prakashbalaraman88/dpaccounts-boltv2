#!/bin/bash
# Ledge — local Android APK build for Linux (Replit)
# Usage: bash build-local.sh
# Idempotent: re-running skips already-completed steps.
set -e

WORKSPACE="/home/runner/workspace"
TOOLS_DIR="$WORKSPACE/tools"
JDK_DIR="$TOOLS_DIR/jdk-17"
ANDROID_SDK_DIR="$TOOLS_DIR/android-sdk"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Ledge — Local Android Build (Linux)    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: JDK 17 ────────────────────────────────────────────────────────
if [ ! -f "$JDK_DIR/bin/java" ]; then
  echo "▶ [1/5] Downloading JDK 17 (~200 MB)..."
  mkdir -p "$JDK_DIR"
  curl -L --progress-bar \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_linux_hotspot_17.0.11_9.tar.gz" \
    -o /tmp/jdk17.tar.gz
  tar -xzf /tmp/jdk17.tar.gz -C "$JDK_DIR" --strip-components=1
  rm -f /tmp/jdk17.tar.gz
  echo "   ✓ JDK 17 installed."
else
  echo "▶ [1/5] JDK 17 already present — skipping."
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

# ── Step 2: Android SDK command-line tools ─────────────────────────────────
if [ ! -f "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "▶ [2/5] Downloading Android SDK command-line tools..."
  mkdir -p "$ANDROID_SDK_DIR/cmdline-tools/latest"
  curl -L --progress-bar \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" \
    -o /tmp/cmdtools.zip
  mkdir -p /tmp/cmdtools-extract
  unzip -q /tmp/cmdtools.zip -d /tmp/cmdtools-extract/
  mv /tmp/cmdtools-extract/cmdline-tools/* "$ANDROID_SDK_DIR/cmdline-tools/latest/"
  rm -rf /tmp/cmdtools.zip /tmp/cmdtools-extract
  echo "   ✓ Android cmdline-tools installed."
else
  echo "▶ [2/5] Android cmdline-tools already present — skipping."
fi

export ANDROID_HOME="$ANDROID_SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# ── Step 3: SDK components (platform, build-tools) ─────────────────────────
if [ ! -d "$ANDROID_SDK_DIR/platforms/android-35" ]; then
  echo "▶ [3/5] Installing Android SDK components (~500 MB)..."
  yes | sdkmanager --licenses > /dev/null 2>&1 || true
  sdkmanager \
    "platform-tools" \
    "platforms;android-35" \
    "build-tools;35.0.0"
  echo "   ✓ Android SDK components installed."
else
  echo "▶ [3/5] Android SDK components already present — skipping."
fi

# ── Step 4: expo prebuild ──────────────────────────────────────────────────
cd "$WORKSPACE"
echo "▶ [4/5] Running expo prebuild (generates android/ folder)..."
npx expo prebuild --platform android --clean

# Tell Gradle where the SDK lives
echo "sdk.dir=$ANDROID_SDK_DIR" > android/local.properties
echo "   ✓ android/local.properties written."

# Patch org.gradle.jvmargs in gradle.properties to add -XX:-UsePerfData
# (UsePerfData mmap causes SIGBUS in sandboxed Linux environments)
GRADLE_PROPS="android/gradle.properties"
if grep -q "^org.gradle.jvmargs" "$GRADLE_PROPS" 2>/dev/null; then
  sed -i 's/^org.gradle.jvmargs=.*/& -XX:-UsePerfData/' "$GRADLE_PROPS"
else
  echo 'org.gradle.jvmargs=-Xmx2g -XX:-UsePerfData' >> "$GRADLE_PROPS"
fi
echo "   ✓ -XX:-UsePerfData added to gradle.properties."

# Belt-and-suspenders: JAVA_TOOL_OPTIONS is read by every JVM unconditionally
export JAVA_TOOL_OPTIONS="-XX:-UsePerfData"

# ── Step 5: Build the APK ──────────────────────────────────────────────────
echo "▶ [5/5] Building APK with Gradle (5–15 min first run)..."
cd android
chmod +x gradlew

./gradlew assembleDebug \
  --no-daemon \
  --console=plain \
  2>&1 | tee "$WORKSPACE/build-release-log.txt"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            BUILD COMPLETE! ✓             ║"
echo "╚══════════════════════════════════════════╝"

APK_PATH=$(find "$WORKSPACE/android" -name "*.apk" -not -path "*/intermediates/*" | head -1)
if [ -n "$APK_PATH" ]; then
  cp "$APK_PATH" "$WORKSPACE/ledge.apk"
  echo ""
  echo "APK saved to: $WORKSPACE/ledge.apk"
  echo "Size: $(du -sh "$WORKSPACE/ledge.apk" | cut -f1)"
  echo ""
  echo "Install on your phone:"
  echo "  • Download ledge.apk from the Replit Files panel"
  echo "  • Transfer to phone and open to install (enable 'Install unknown apps' first)"
fi
