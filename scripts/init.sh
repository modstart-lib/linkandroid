#!/usr/bin/env bash

set -euo pipefail

git clone https://github.com/modstart-lib/share-binary

mkdir -p electron/resources/extra/osx-arm64
cp -a share-binary/osx-arm64/scrcpy electron/resources/extra/osx-arm64/scrcpy
cp -a share-binary/osx-arm64/ffmpeg electron/resources/extra/osx-arm64/ffmpeg
cp -a share-binary/osx-arm64/ffprobe electron/resources/extra/osx-arm64/ffprobe

mkdir -p electron/resources/extra/osx-x86
cp -a share-binary/osx-x86/scrcpy electron/resources/extra/osx-x86/scrcpy
#cp -a share-binary/osx-x86/ffmpeg electron/resources/extra/osx-x86/ffmpeg
#cp -a share-binary/osx-x86/ffprobe electron/resources/extra/osx-x86/ffprobe

mkdir -p electron/resources/extra/linux-arm64
#cp -a share-binary/linux-arm64/scrcpy electron/resources/extra/linux-arm64/scrcpy
cp -a share-binary/linux-arm64/ffmpeg electron/resources/extra/linux-arm64/ffmpeg
cp -a share-binary/linux-arm64/ffprobe electron/resources/extra/linux-arm64/ffprobe

mkdir -p electron/resources/extra/linux-x86
cp -a share-binary/linux-x86/scrcpy electron/resources/extra/linux-x86/scrcpy
cp -a share-binary/linux-x86/ffmpeg electron/resources/extra/linux-x86/ffmpeg
cp -a share-binary/linux-x86/ffprobe electron/resources/extra/linux-x86/ffprobe

mkdir -p electron/resources/extra/win-x86
cp -a share-binary/win-x86/scrcpy electron/resources/extra/win-x86/scrcpy
cp -a share-binary/win-x86/ffmpeg.exe electron/resources/extra/win-x86/ffmpeg.exe
cp -a share-binary/win-x86/ffprobe.exe electron/resources/extra/win-x86/ffprobe

ls -R electron/resources/extra
