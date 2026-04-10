#!/bin/bash
set -e

echo "=== DeskSkill TeamBoard 部署 ==="

# 拉取最新代码
echo "[1/4] 拉取代码..."
git pull origin main

# 安装前端依赖 + 构建
echo "[2/4] 构建前端..."
npm ci
npm run build

# 安装服务端依赖
echo "[3/4] 安装服务端依赖..."
cd server && npm ci --omit=dev && cd ..

# 检查 .env 是否存在
if [ ! -f server/.env ]; then
  echo "⚠ server/.env 不存在，请先配置："
  echo "  cp server/.env.example server/.env"
  echo "  然后编辑填入真实值"
  exit 1
fi

# 创建日志目录
mkdir -p logs

# 启动 / 重启 PM2
echo "[4/4] 启动服务..."
if pm2 describe deskskill > /dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs
  echo "✓ 服务已重启"
else
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "✓ 服务已启动（首次）"
  echo "  运行 'pm2 startup' 设置开机自启"
fi

echo ""
echo "=== 部署完成 ==="
echo "  查看日志: pm2 logs deskskill"
echo "  查看状态: pm2 status"
