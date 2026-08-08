#!/bin/bash
# 星语 AI 桌面版启动脚本
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. 安装依赖（首次）
if [ ! -d "$ROOT/web/node_modules" ]; then
  echo "[1/3] 安装前端依赖..."
  (cd web && npm install --no-audit --no-fund)
fi
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "[1/3] 安装服务端依赖..."
  (cd server && npm install --no-audit --no-fund)
fi

# 2. 构建前端
echo "[2/3] 构建前端..."
(cd web && npm run build)

# 3. 启动服务并打开浏览器
echo "[3/3] 启动服务并打开浏览器..."
URL="http://localhost:3001"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
fi
echo "服务已启动：$URL （按 Ctrl+C 停止）"
(cd server && npm start)
