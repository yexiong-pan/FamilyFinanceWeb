#!/bin/sh

set -eu

: "${VERSION:?请设置 VERSION，例如 VERSION=0a020d9}"

DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
APP_DIR=/volume1/docker/family-finance/app
ARCHIVE="$HOME/family-finance-${VERSION}-amd64.tar.gz"

test -f "$ARCHIVE"
if [ -n "${DATA_SQL_FILE:-}" ]; then
  test -f "$DATA_SQL_FILE"
fi

sudo mv "$ARCHIVE" /volume1/docker/family-finance/
sudo gzip -dc "/volume1/docker/family-finance/family-finance-${VERSION}-amd64.tar.gz" | sudo "$DOCKER" load

cd "$APP_DIR"
sudo "$DOCKER" compose -p family-finance-nas -f docker-compose.yml \
  up -d --no-build --pull never --force-recreate api web

attempt=0
while ! sudo "$DOCKER" compose -p family-finance-nas -f docker-compose.yml logs api | grep -q "Family Finance API listening"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "API 未在 60 秒内启动，请检查日志后再执行数据修正脚本。" >&2
    exit 1
  fi
  sleep 2
done

if [ -n "${DATA_SQL_FILE:-}" ]; then
  sudo "$DOCKER" compose -p family-finance-nas -f docker-compose.yml \
    exec -T postgres psql -v ON_ERROR_STOP=1 \
    -U family_finance -d family_finance \
    < "$DATA_SQL_FILE"
fi

sudo "$DOCKER" compose -p family-finance-nas -f docker-compose.yml ps
sudo "$DOCKER" compose -p family-finance-nas -f docker-compose.yml \
  logs --tail=100 api web postgres
