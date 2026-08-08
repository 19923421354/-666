#!/bin/bash
# 星语 AI 一键构建脚本：构建前端 + 生成 Android APK
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export JAVA_HOME="${JAVA_HOME:-$(readlink -f /usr/bin/java | sed 's#/bin/java##')}"

echo "[1/3] 安装前端依赖..."
(cd web && npm install --no-audit --no-fund)

echo "[2/3] 构建前端..."
(cd web && npm run build)

echo "[3/3] 构建 Android APK..."
(cd web && npx cap sync android)
(cd web/android && ./gradlew assembleRelease --no-daemon)

mkdir -p "$ROOT/dist"
cp "$ROOT/web/android/app/build/outputs/apk/release/app-release.apk" "$ROOT/dist/星语AI-v1.2.0.apk"
echo ""
echo "构建完成，安装包位于: $ROOT/dist/星语AI-v1.2.0.apk"
