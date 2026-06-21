#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOOLS_DIR="$PROJECT_DIR/tools"
JDK_DIR="$TOOLS_DIR/jdk-17"
APK_OUTPUT_DIR="$PROJECT_DIR/android/app/build/outputs/apk"

mkdir -p "$TOOLS_DIR"

# Download and extract JDK 17 if not already present
if [[ ! -d "$JDK_DIR/bin" ]]; then
  echo "Downloading Eclipse Temurin JDK 17..."
  rm -rf "$JDK_DIR"
  mkdir -p "$JDK_DIR"
  curl -L --retry 3 --max-time 300 \
    -o "$TOOLS_DIR/jdk17.zip" \
    "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
  echo "Extracting JDK..."
  unzip -q "$TOOLS_DIR/jdk17.zip" -d "$JDK_DIR"
  rm -f "$TOOLS_DIR/jdk17.zip"

  # Adoptium zip extracts into a nested folder like jdk-17.0.19+10; move contents up
  NESTED_DIR="$(find "$JDK_DIR" -maxdepth 1 -type d -name 'jdk-*' | head -n 1)"
  if [[ -n "$NESTED_DIR" && -d "$NESTED_DIR/bin" ]]; then
    mv "$NESTED_DIR"/* "$NESTED_DIR"/.* "$JDK_DIR"/ 2>/dev/null || true
    rmdir "$NESTED_DIR" || true
  fi
fi

export JAVA_HOME="$JDK_DIR"
export PATH="$JAVA_HOME/bin:$PATH"

echo "JAVA_HOME=$JAVA_HOME"
java -version

cd "$PROJECT_DIR"

# Apply node_modules patch in case this is a fresh environment
if command -v npx &>/dev/null; then
  npx patch-package || true
fi

cd "$PROJECT_DIR/android"

echo "Building release APK..."
./gradlew assembleRelease --no-daemon --console=plain

APK_PATH="$(find "$APK_OUTPUT_DIR/release" -name '*.apk' -type f | head -n 1)"
echo "APK built: $APK_PATH"
