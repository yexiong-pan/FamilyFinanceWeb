# NAS 离线发布流程

本文适用于当前部署方式：在 Mac 上开发和构建 `linux/amd64` 镜像，通过局域网传到群晖 NAS，NAS 不访问 Docker Hub，也不在 NAS 上构建镜像。

生产数据位于 `/volume1/docker/family-finance/postgres`。更新容器不会删除数据；不要执行 `docker compose down -v`，也不要删除该目录。

## 1. 发布前检查

在 Mac 上进入项目目录：

```bash
cd /Users/panyexiong/理财/FamilyFinanceWeb
git switch main
git status --short
npm ci
npm test
npm run typecheck
npm run build
```

确认代码已经提交并推送：

```bash
git push origin main
git rev-parse --short HEAD
```

记住最后一条命令输出的提交号，以下用 `VERSION` 表示：

```bash
VERSION=$(git rev-parse --short HEAD)
```

## 2. 构建 NAS 镜像

API 镜像：

```bash
docker buildx build --platform linux/amd64 --load --progress=plain \
  -f apps/api/Dockerfile \
  -t family-finance-nas-api:${VERSION} \
  -t family-finance-nas-api:latest .
```

Web 镜像：

```bash
docker buildx build --platform linux/amd64 --load --progress=plain \
  -f apps/web/Dockerfile \
  --build-arg VITE_API_BASE_URL=/api \
  -t family-finance-nas-web:${VERSION} \
  -t family-finance-nas-web:latest .
```

核对架构，两条命令都必须输出 `linux/amd64`：

```bash
docker image inspect --platform linux/amd64 family-finance-nas-api:latest \
  --format '{{.Os}}/{{.Architecture}}'
docker image inspect --platform linux/amd64 family-finance-nas-web:latest \
  --format '{{.Os}}/{{.Architecture}}'
```

导出应用镜像。日常更新不需要重复传输 PostgreSQL 镜像：

```bash
docker image save --platform linux/amd64 \
  family-finance-nas-api:${VERSION} family-finance-nas-api:latest \
  family-finance-nas-web:${VERSION} family-finance-nas-web:latest \
  | gzip -1 > /tmp/family-finance-${VERSION}-amd64.tar.gz

shasum -a 256 /tmp/family-finance-${VERSION}-amd64.tar.gz
```

## 3. 传输到 NAS

群晖不支持当前 SCP/SFTP 子系统时，需要保留 `-O`：

```bash
scp -O /tmp/family-finance-${VERSION}-amd64.tar.gz \
  panyexiong@192.168.71.84:~/
```

如果本次修改了 `docker-compose.yml`，同时传输新配置，但不要覆盖 NAS 上的 `.env`：

```bash
scp -O docker-compose.yml \
  panyexiong@192.168.71.84:~/docker-compose.yml.new
```

## 4. 普通代码发布

登录 NAS，并设置与 Mac 一致的提交号：

```bash
ssh panyexiong@192.168.71.84
VERSION=这里填写提交号
```

加载镜像：

```bash
sudo mv ~/family-finance-${VERSION}-amd64.tar.gz \
  /volume1/docker/family-finance/

sudo gzip -dc /volume1/docker/family-finance/family-finance-${VERSION}-amd64.tar.gz \
  | sudo docker load
```

如果传输了新的 Compose 文件，先替换它：

```bash
sudo mv ~/docker-compose.yml.new \
  /volume1/docker/family-finance/app/docker-compose.yml
```

使用已加载镜像重新创建 API 和 Web，不构建、不拉取：

```bash
cd /volume1/docker/family-finance/app
sudo docker compose -p family-finance-nas -f docker-compose.yml \
  up -d --no-build --pull never --force-recreate api web
```

检查状态和日志：

```bash
sudo docker compose -p family-finance-nas -f docker-compose.yml ps
sudo docker compose -p family-finance-nas -f docker-compose.yml \
  logs --tail=100 api web postgres
```

最后访问 `http://192.168.71.84:5173`，检查首页、收支明细、财务盘点和设置页。

## 5. 数据库表结构变更

API 容器启动时会先运行 `prisma db push`，然后启动 NestJS。新增表、新增可空字段、新增带默认值的字段等非破坏性变更，可以沿用普通发布流程。

发布前必须先在本地数据库验证结构和功能：

```bash
npm run prisma:push -w @family-finance/api
npm test
npm run typecheck
npm run build
```

涉及以下变更时，不要直接发布：

- 删除表或字段。
- 重命名表或字段。
- 修改字段类型。
- 将已有字段改为必填且没有默认值。
- 修改唯一约束，可能与已有数据冲突。

这类变更需要拆成兼容版本，先新增结构并迁移旧数据，确认完成后再在后续版本删除旧结构。

虽然系统不配置自动备份，但每次修改生产表结构前，应创建一次临时发布快照：

```bash
cd /volume1/docker/family-finance/app
VERSION=这里填写提交号

sudo docker compose -p family-finance-nas -f docker-compose.yml \
  exec -T postgres pg_dump \
  -U family_finance -d family_finance \
  --format=custom --no-owner --no-acl \
  > ~/family-finance-before-${VERSION}.dump

sudo docker compose -p family-finance-nas -f docker-compose.yml \
  exec -T postgres pg_restore --list \
  < ~/family-finance-before-${VERSION}.dump
```

快照校验成功后，再加载新镜像并执行第 4 节的启动命令。重点检查 API 日志中 `prisma db push` 是否成功。

## 6. 回滚

仅代码变更时，将上一个版本标签重新指向 `latest`：

```bash
OLD_VERSION=这里填写上一个提交号
sudo docker tag family-finance-nas-api:${OLD_VERSION} family-finance-nas-api:latest
sudo docker tag family-finance-nas-web:${OLD_VERSION} family-finance-nas-web:latest

cd /volume1/docker/family-finance/app
sudo docker compose -p family-finance-nas -f docker-compose.yml \
  up -d --no-build --pull never --force-recreate api web
```

如果新版本已经破坏性修改数据库，需要停止 API 并恢复发布前快照：

```bash
cd /volume1/docker/family-finance/app
sudo docker compose -p family-finance-nas -f docker-compose.yml stop api
sudo docker compose -p family-finance-nas -f docker-compose.yml \
  exec -T postgres dropdb --if-exists --force \
  -U family_finance family_finance
sudo docker compose -p family-finance-nas -f docker-compose.yml \
  exec -T postgres createdb -U family_finance family_finance
sudo cat ~/family-finance-before-${VERSION}.dump | \
  sudo docker compose -p family-finance-nas -f docker-compose.yml \
  exec -T postgres pg_restore --exit-on-error --no-owner --no-acl \
  -U family_finance -d family_finance
```

恢复旧版 API/Web 镜像后，再检查容器状态和页面数据。发布确认无误后，可以手动删除临时快照和已传输的压缩包。
