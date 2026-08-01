#!/bin/sh

set -eu

: "${VERSION:?请设置 VERSION，例如 VERSION=0a020d9}"

DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
RELEASE_DIR=/volume1/docker/family-finance

api_latest=$(sudo "$DOCKER" image inspect family-finance-nas-api:latest --format '{{.Id}}')
api_release=$(sudo "$DOCKER" image inspect "family-finance-nas-api:${VERSION}" --format '{{.Id}}')
web_latest=$(sudo "$DOCKER" image inspect family-finance-nas-web:latest --format '{{.Id}}')
web_release=$(sudo "$DOCKER" image inspect "family-finance-nas-web:${VERSION}" --format '{{.Id}}')

if [ "$api_latest" != "$api_release" ] || [ "$web_latest" != "$web_release" ]; then
  echo "latest 不是 ${VERSION}，已停止清理以保留发布包。" >&2
  exit 1
fi

sudo rm -f "$HOME"/family-finance-*-amd64.tar.gz
sudo rm -f "$RELEASE_DIR"/family-finance-*-amd64.tar.gz

sudo "$DOCKER" image ls --format '{{.Repository}}:{{.Tag}}' | while IFS= read -r image; do
  case "$image" in
    family-finance-nas-api:*|family-finance-nas-web:*)
      if [ "$image" != "family-finance-nas-api:latest" ] \
        && [ "$image" != "family-finance-nas-web:latest" ] \
        && [ "$image" != "family-finance-nas-api:${VERSION}" ] \
        && [ "$image" != "family-finance-nas-web:${VERSION}" ]; then
        sudo "$DOCKER" image rm "$image" || true
      fi
      ;;
  esac
done

sudo "$DOCKER" image prune -f
sudo "$DOCKER" system df
