@echo off
set JAVA_HOME=%~dp0..\tools\jdk-17
set PATH=%JAVA_HOME%\bin;C:\Program Files\nodejs;%PATH%
cd "%~dp0..\android"
gradlew assembleDebug --no-daemon --console=plain
