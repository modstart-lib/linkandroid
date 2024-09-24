#!/bin/bash

echo "Build third-party"

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT=$(realpath "${DIR}/..")
echo "PROJECT_ROOT: ${PROJECT_ROOT}"

THIRD_PARTY_ROOT="${PROJECT_ROOT}/third-party"
THIRD_PARTY_PUBLIC_ROOT="${PROJECT_ROOT}/public/third-party"
echo "THIRD_PARTY_ROOT: ${THIRD_PARTY_ROOT}"

echo "Build image beautifier"
cd "${THIRD_PARTY_ROOT}/image-beautifier"
npm run build
rm -rfv "${THIRD_PARTY_PUBLIC_ROOT}/image-beautifier"
mv "${THIRD_PARTY_ROOT}/image-beautifier/dist" "${THIRD_PARTY_PUBLIC_ROOT}/image-beautifier"
