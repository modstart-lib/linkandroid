#!/bin/bash

# prepare
# brew install --cask inkscape

echo "Convert icon"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT=$(realpath "${DIR}/..")
echo "PROJECT_ROOT: ${PROJECT_ROOT}"

path_svg="${PROJECT_ROOT}/public/logo.svg"
path_white_svg="${PROJECT_ROOT}/public/logo-white.svg"
path_build="${PROJECT_ROOT}/electron/resources/build"
path_extra="${PROJECT_ROOT}/electron/resources/extra"
path_source_png="${path_build}/logo_1024x1024.png"

cp -a "${path_svg}" "${PROJECT_ROOT}/src/assets/image/logo.svg"
cp -a "${path_white_svg}" "${PROJECT_ROOT}/src/assets/image/logo-white.svg"

inkscape "${path_svg}" --export-type=png --export-filename="${path_source_png}" -w 1024 -h 1024

size=(16 32 44 48 64 128 150 256 512)
for i in "${size[@]}"; do
    path_png="${path_build}/logo@${i}x$i.png"
    echo "Generate: logo@${i}x$i.png"
    inkscape --export-type="png" --export-filename="${path_png}" -w $i -h $i "${path_source_png}"
done

path_ico="${path_build}/logo.ico"
echo "Generate: logo.ico"
magick "${path_source_png}" -define icon:auto-resize=256,48,32,16 "${path_ico}"

echo "Generate: logo.png"
rm -rf "${path_build}/logo.png"
cp -a "${path_build}/logo@256x256.png" "${path_build}/logo.png"

echo "Generate: logo.icns"
path_iconset="${path_build}/icon.iconset"
rm -rf "${path_iconset}"
mkdir -p "${path_iconset}"
cp -a "${path_build}/logo@256x256.png" "${path_iconset}/icon_256x256.png"
cp -a "${path_build}/logo@32x32.png" "${path_iconset}/icon_32x32.png"
cp -a "${path_build}/logo@16x16.png" "${path_iconset}/icon_16x16.png"
iconutil -c icns "${path_iconset}" -o "${path_build}/logo.icns"

echo "Generate: appx/StoreLogo.png"
cp -a "${path_build}/logo@256x256.png" "${path_build}/appx/StoreLogo.png"
echo "Generate: appx/Square44x44Logo.png"
cp -a "${path_build}/logo@44x44.png" "${path_build}/appx/Square44x44Logo.png"
echo "Generate: appx/Square150x150Logo.png"
cp -a "${path_build}/logo@150x150.png" "${path_build}/appx/Square150x150Logo.png"
echo "Generate: appx/Wide310x150Logo.png"
magick "${path_build}/logo@150x150.png" -resize 310x150 -background none -gravity center -extent 310x150 "${path_build}/appx/Wide310x150Logo.png"

echo "Generate: common/tray/icon.png"
mkdir -p "${path_extra}/common/tray"
cp -a "${path_build}/logo@256x256.png" "${path_extra}/common/tray/icon.png"
echo "Generate: common/tray/icon.ico"
cp -a "${path_build}/logo.ico" "${path_extra}/common/tray/icon.ico"

echo "Generate: osx/tray/iconTemplate.png"
mkdir -p "${path_extra}/osx/tray"
magick "${path_build}/logo-gray.png" -resize 16x16 -background none -gravity center "${path_extra}/osx/tray/iconTemplate.png"
echo "Generate: osx/tray/iconTemplate@2x.png"
magick "${path_build}/logo-gray.png" -resize 32x32 -background none -gravity center "${path_extra}/osx/tray/iconTemplate@2x.png"
echo "Generate: osx/tray/iconTemplate@4x.png"
magick "${path_build}/logo-gray.png" -resize 64x64 -background none -gravity center "${path_extra}/osx/tray/iconTemplate@4x.png"

rm -rf "${path_iconset}"
rm -rf ${path_build}/logo@*
