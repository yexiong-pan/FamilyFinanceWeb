# NAS 发布运行手册

此文档是家庭生活管理系统发布到群晖 NAS 的唯一操作手册，供人工和后续 Agent 使用。

## 运行边界

| 项目 | 固定值 |
| --- | --- |
| 本地工作区 | `/Users/panyexiong/理财/FamilyFinanceWeb` |
| 发布分支 | `main` |
| NAS SSH 别名 | `family-finance-nas` |
| NAS 应用目录 | `/volume1/docker/family-finance/app` |
| Compose 项目名 | `family-finance-nas` |
| NAS Docker 命令 | `/var/packages/ContainerManager/target/usr/bin/docker` |
| PostgreSQL 数据目录 | `/volume1/docker/family-finance/postgres` |
| NAS 局域网 Web 地址 | `http://192.168.71.84:5173` |
| 公网地址 | `https://app.oreohome.com`，经 Cloudflare Tunnel 访问 |

生产数据库只存在 NAS。**绝不执行** `docker compose down -v`，也不要删除 PostgreSQL 数据目录。

NAS 为 `linux/amd64`，且不能稳定访问 Docker Hub。因此必须在 Mac 构建镜像、离线传输；NAS 不构建、不拉取镜像。

## 常规代码发布

适用：前端、后端、样式、业务逻辑，以及新增表、可空字段、带默认值字段等兼容性表结构修改。

### 1. 本地检查并提交

```bash
cd /Users/panyexiong/理财/FamilyFinanceWeb
git switch main
git status --short
npm ci
npm test
npm run typecheck
npm run build
git push origin main
VERSION=$(git rev-parse --short HEAD)
echo "$VERSION"
```

仅在工作区没有未确认改动、测试通过且 `main` 已推送后发布。`VERSION` 必须是本次已提交代码的短提交号。

### 2. 构建 amd64 镜像

```bash
docker buildx build --platform linux/amd64 --load --progress=plain \
  -f apps/api/Dockerfile \
  -t family-finance-nas-api:${VERSION} \
  -t family-finance-nas-api:latest .

docker buildx build --platform linux/amd64 --load --progress=plain \
  -f apps/web/Dockerfile \
  --build-arg VITE_API_BASE_URL=/api \
  -t family-finance-nas-web:${VERSION} \
  -t family-finance-nas-web:latest .

docker image inspect --platform linux/amd64 family-finance-nas-api:latest \
  --format '{{.Os}}/{{.Architecture}}'
docker image inspect --platform linux/amd64 family-finance-nas-web:latest \
  --format '{{.Os}}/{{.Architecture}}'
```

两条检查命令都必须输出 `linux/amd64`。

### 3. 导出并校验离线包

```bash
docker image save --platform linux/amd64 \
  family-finance-nas-api:${VERSION} family-finance-nas-api:latest \
  family-finance-nas-web:${VERSION} family-finance-nas-web:latest \
  | gzip -1 > /tmp/family-finance-${VERSION}-amd64.tar.gz

shasum -a 256 /tmp/family-finance-${VERSION}-amd64.tar.gz
```

无需重复打包 PostgreSQL 基础镜像。

### 4. 传输发布包和 NAS 脚本

群晖 SSH 不支持当前 SCP/SFTP 子系统时，必须使用 `-O`：

```bash
scp -O /tmp/family-finance-${VERSION}-amd64.tar.gz \
  family-finance-nas:~/

scp -O scripts/nas/deploy-offline-release-on-nas.sh \
  scripts/nas/cleanup-offline-release-on-nas.sh \
  family-finance-nas:~/
```

每次发布均覆盖传输这两个脚本，确保 NAS 使用仓库中的最新发布逻辑。

### 5. 在 NAS 发布

```bash
ssh -t family-finance-nas \
  "sudo -v && VERSION=${VERSION} sh \$HOME/deploy-offline-release-on-nas.sh"
```

发布脚本会依次完成：

1. 将离线包移到 `/volume1/docker/family-finance/` 并加载镜像。
2. 以 `--no-build --pull never --force-recreate` 重建 `api` 和 `web`。
3. 等待 API 输出 `Family Finance API listening`。
4. 输出容器状态和最近日志。

API 启动命令会自动执行 `prisma db push`。如果日志没有出现 API 启动成功信息，发布脚本会失败，必须先检查日志，不能继续执行数据修正。

### 6. 发布验证

```bash
ssh family-finance-nas \
  'sudo /var/packages/ContainerManager/target/usr/bin/docker compose \
  -p family-finance-nas -f /volume1/docker/family-finance/app/docker-compose.yml ps'

curl -fsSI --max-time 20 https://app.oreohome.com
```

人工验证登录、月报、收支、财务盘点、日历和健康记录。确认无误前不得清理旧镜像。

### 7. 清理发布包和旧应用镜像

```bash
ssh -t family-finance-nas \
  "sudo -v && VERSION=${VERSION} sh \$HOME/cleanup-offline-release-on-nas.sh"
```

脚本只会在 `latest` 确认指向本次 `VERSION` 时执行；它删除 NAS 上已传输的压缩包和更早的 `family-finance-nas-api/web` 标签，保留当前版本、`latest` 以及基础镜像。

本地镜像按需清理即可，保留基础镜像 `node:24-alpine`、`nginx:alpine`、`postgres:16-alpine`：

```bash
docker image ls 'family-finance-nas-*'
docker image rm family-finance-nas-api:旧版本 family-finance-nas-web:旧版本
```

## 数据库变更与数据修正

### 自动处理的兼容变更

下列变更可随常规发布自动应用：新增表、新增可空字段、新增有默认值字段。发布前必须在本地执行：

```bash
npm run prisma:push -w @family-finance/api
npm test
npm run typecheck
npm run build
```

### 必须显式处理的变更

以下操作不能直接依赖 `prisma db push`：删除或重命名表/字段、字段类型转换、已有字段改为必填、可能与历史数据冲突的唯一约束变更。

应先实现兼容版本和可重复运行的数据迁移，再在后续版本删除旧结构。生产表结构变更前必须创建临时快照：

```bash
ssh -t family-finance-nas \
  "sudo -v && /var/packages/ContainerManager/target/usr/bin/docker compose \
  -p family-finance-nas -f /volume1/docker/family-finance/app/docker-compose.yml \
  exec -T postgres pg_dump -U family_finance -d family_finance \
  --format=custom --no-owner --no-acl > \$HOME/family-finance-before-${VERSION}.dump"
```

### 发布时执行一次性 SQL

SQL 必须在 `scripts/nas/` 中、可审查、可重复执行。不要把 SQL 内嵌在 SSH 命令中。

```bash
SQL_FILE=scripts/nas/your-migration.sql
scp -O "$SQL_FILE" family-finance-nas:~/your-migration.sql

ssh -t family-finance-nas \
  "sudo -v && VERSION=${VERSION} DATA_SQL_FILE=\$HOME/your-migration.sql \
  sh \$HOME/deploy-offline-release-on-nas.sh"
```

发布脚本只会在 API 成功启动后执行该 SQL；没有 `DATA_SQL_FILE` 时不会执行任何数据修正。

## Compose 或生产配置变更

常规镜像发布不会同步 NAS 的 `docker-compose.yml` 和 `.env`。

修改 `docker-compose.yml` 时，先检查配置，再单独传输替换：

```bash
npm run nas:config
scp -O docker-compose.yml family-finance-nas:~/docker-compose.yml.new

ssh -t family-finance-nas \
  "sudo -v && sudo mv \$HOME/docker-compose.yml.new \
  /volume1/docker/family-finance/app/docker-compose.yml"
```

**禁止传输或覆盖 NAS 的 `.env`**。其中包含生产数据库密码和持久化目录。

配置替换后再执行常规代码发布第 5 步。

## 回滚

仅代码问题且数据库仍兼容时，重新使用 NAS 上保留的上一版本标签：

```bash
OLD_VERSION=上一版本提交号
ssh -t family-finance-nas \
  "sudo -v && DOCKER=/var/packages/ContainerManager/target/usr/bin/docker \
  && \$DOCKER tag family-finance-nas-api:${OLD_VERSION} family-finance-nas-api:latest \
  && \$DOCKER tag family-finance-nas-web:${OLD_VERSION} family-finance-nas-web:latest \
  && cd /volume1/docker/family-finance/app \
  && \$DOCKER compose -p family-finance-nas -f docker-compose.yml \
  up -d --no-build --pull never --force-recreate api web"
```

若涉及破坏性数据库变更，停止发布，先恢复发布前快照，再回滚 API/Web。未验证可恢复的数据库变更不允许直接上线。

## 一次性外网入口配置

Cloudflare Tunnel 已配置为：

```text
https://app.oreohome.com
  -> Cloudflare Tunnel oreohome
  -> http://127.0.0.1:5173（NAS）
```

常规发布不需要改动 Cloudflare、光猫、路由器或端口转发。外网失败时先检查：Cloudflare Tunnel 是否 `Healthy`、NAS 的 `api/web` 容器是否运行、以及 `curl -fsSI https://app.oreohome.com` 是否返回 `200`。

Tunnel Token 只保存在 NAS 的 Cloudflare Tunnel 套件中，严禁写入仓库、`.env`、截图或聊天消息。

## 登录防护

API 会将登录失败和邀请码注册失败的限流状态保存到 PostgreSQL：同一账号 15 分钟内最多 5 次失败，同一来源 IP 15 分钟内最多 20 次登录失败；邀请码注册同时按邀请码和来源 IP 限流。状态会在 24 小时后自动清理，因此重启 API 不会解除临时锁定。来源 IP 与账号仅以 `AUTH_SECURITY_HASH_SECRET` 为密钥的 HMAC-SHA-256 写入认证安全事件，成功登录的新来源 IP 也会被记录。

首次部署或更新本配置前，在 NAS 的 `.env` 增加独立随机密钥（不要复用数据库密码）：

```bash
openssl rand -base64 48
```

将输出作为 `AUTH_SECURITY_HASH_SECRET` 的值。生产环境未设置此变量时 API 会拒绝启动，避免意外以弱哈希方式记录认证数据。

Cloudflare Tunnel 的 `CF-Connecting-IP` 会被用于识别公网来源。请保持 Tunnel 为唯一公网入口；若需要抵挡大规模扫描，再在 Cloudflare 控制台为 `/api/auth/login` 和 `/api/auth/invitations/accept` 配置 Rate Limiting 规则。

## 禁止事项

- 不在 NAS 执行 `docker compose up --build`、`docker pull` 或 `npm install`。
- 不删除 `/volume1/docker/family-finance/postgres`。
- 不执行 `docker compose down -v`。
- 不覆盖 NAS `.env`。
- 不将数据库端口 `5432`、API 端口 `4000`、Web 端口 `5173`、DSM 或 SSH 端口暴露到公网。
- 不在未验证前清理上一版本镜像或临时数据库快照。
