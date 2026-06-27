@echo off
set ANDROID_HOME=%~dp0..\tools\android-sdk
set JAVA_HOME=%~dp0..\tools\jdk-17
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%
cd "%~dp0..\android"
echo ANDROID_HOME=%ANDROID_HOME%
echo JAVA_HOME=%JAVA_HOME%
gradlew assembleDebug --no-daemon --console=plain
