#!/bin/bash
# 星语 AI 一键构建脚本：构建前端 + 生成 Android APK
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_BIN="$(readlink -f "$(command -v java)")"
  export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
fi

# 从 build.gradle 读取版本号
VERSION_NAME="$(grep -oP "versionName \"\K[^\"]+" web/android/app/build.gradle || echo '1.6.0')"
OUT_APK="$ROOT/dist/星语AI-v${VERSION_NAME}.apk"

echo "[1/3] 安装前端依赖..."
(cd web && npm install --ignore-scripts --no-audit --no-fund)

echo "[2/3] 构建前端..."
(cd web && npm run build)

echo "[3/3] 构建 Android APK..."
(cd web && npx cap sync android)
(cd web/android && ./gradlew assembleRelease --no-daemon)

mkdir -p "$ROOT/dist"
cp "$ROOT/web/android/app/build/outputs/apk/release/app-release.apk" "$OUT_APK"
echo ""
echo "构建完成，安装包位于: $OUT_APK"
