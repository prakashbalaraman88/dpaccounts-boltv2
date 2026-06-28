@echo off
for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%\android"
set "ANDROID_HOME=%PROJECT_ROOT%\tools\android-sdk"
set "JAVA_HOME=%PROJECT_ROOT%\tools\jdk-17"
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%
"%CD%\gradlew.bat" assembleRelease --no-daemon --console=plain > "%PROJECT_ROOT%\build-release-log.txt" 2>&1
echo BUILD_EXIT_CODE=%ERRORLEVEL%
