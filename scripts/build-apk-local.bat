@echo off
cd /d "D:\Claude Projects\Project_1_Accounts\InteriorBooks\android"
set ANDROID_HOME=D:\Claude Projects\Project_1_Accounts\InteriorBooks\tools\android-sdk
set JAVA_HOME=D:\Claude Projects\Project_1_Accounts\InteriorBooks\tools\jdk-17
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%PATH%
gradlew assembleDebug --no-daemon --console=plain > "D:\Claude Projects\Project_1_Accounts\InteriorBooks\build-log.txt" 2>&1
echo BUILD_EXIT_CODE=%ERRORLEVEL%
