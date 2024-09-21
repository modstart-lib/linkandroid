#!/bin/bash

# prepare
# brew install --cask inkscape

# get current script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

path_build="${DIR}/../electron/resources/build"
path_source_png="${path_build}/logo_1024x1024.png"

size=(16 32 44 48 64 128 150 256 512)
for i in "${size[@]}"; do
    path_png="${path_build}/logo@${i}x$i.png"
    echo "Generated: logo@${i}x$i.png"
    inkscape --export-type="png" --export-filename="${path_png}" -w $i -h $i "${path_source_png}"
done

path_ico="${path_build}/logo.ico"
echo "Generated: logo.ico"
magick "${path_source_png}" -define icon:auto-resize=256,48,32,16 "${path_ico}"

echo "Generated: logo.png"
rm -rf "${path_build}/logo.png"
cp -a "${path_build}/logo@256x256.png" "${path_build}/logo.png"

echo "Generated: logo.icns"
path_iconset="${path_build}/icon.iconset"
rm -rf "${path_iconset}"
mkdir -p "${path_iconset}"
cp -a "${path_build}/logo@256x256.png" "${path_iconset}/icon_256x256.png"
cp -a "${path_build}/logo@32x32.png" "${path_iconset}/icon_32x32.png"
cp -a "${path_build}/logo@16x16.png" "${path_iconset}/icon_16x16.png"
iconutil -c icns "${path_iconset}" -o "${path_build}/logo.icns"

echo "Generated: appx/StoreLogo.png"
cp -a "${path_build}/logo@256x256.png" "${path_build}/appx/StoreLogo.png"
echo "Generated: appx/Square44x44Logo.png"
cp -a "${path_build}/logo@44x44.png" "${path_build}/appx/Square44x44Logo.png"
echo "Generated: appx/Square150x150Logo.png"
cp -a "${path_build}/logo@150x150.png" "${path_build}/appx/Square150x150Logo.png"
echo "Generated: appx/Wide310x150Logo.png"
magick "${path_build}/logo@150x150.png" -resize 310x150 -background none -gravity center -extent 310x150 "${path_build}/appx/Wide310x150Logo.png"

rm -rf "${path_iconset}"
rm -rf ${path_build}/logo@*
