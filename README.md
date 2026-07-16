# Family Finance Web

家庭财务管理 Web 版，TypeScript monorepo：

| 包 | 说明 | 技术栈 |
| --- | --- | --- |
| `apps/api` | 后端 API | NestJS + Prisma + PostgreSQL |
| `apps/web` | 前端 | React + Vite + Ant Design |
| `packages/shared` | 前后端共享类型与领域逻辑 | TypeScript |

## 环境划分

| 环境 | Web | API | PostgreSQL |
| --- | --- | --- | --- |
| 本地开发 | Vite `http://localhost:5173` | NestJS `http://localhost:4000/api` | Docker `localhost:5433` |
| NAS 生产 | Nginx `http://NAS_IP:5173` | 仅容器内部 `api:4000` | 仅容器内部 `postgres:5432` |

本地开发和 NAS 生产使用不同的 Compose 文件与数据库，互不影响：

- `docker-compose.dev.yml`：只启动本地开发数据库。
- `docker-compose.yml`：构建并启动 NAS 生产环境的 Web、API 和数据库。

## 1. 本地开发

### 1.1 前置条件

- Node.js 24+
- Docker Desktop

### 1.2 安装依赖和配置

```bash
npm install
cp .env.example apps/api/.env
```

`apps/api/.env` 默认连接本地开发数据库：

```env
DATABASE_URL="postgresql://family_finance:family_finance@localhost:5433/family_finance?schema=public"
API_PORT=4000
```

前端本地开发默认请求 `http://localhost:4000/api`，无需额外环境变量。

### 1.3 启动

```bash
npm run dev:db
npm run prisma:push -w @family-finance/api
npm run dev
```

常用命令：

```bash
npm run dev:db:down  # 停止本地数据库，保留数据卷
npm run dev:api      # 只启动 API
npm run dev:web      # 只启动 Web
npm run test
npm run typecheck
npm run build
```

## 2. NAS 生产部署

### 2.1 运行结构

生产环境只开放 Web 端口。Nginx 提供静态页面，并将浏览器的 `/api` 请求转发到内部 API 容器：

```text
浏览器 -> NAS:5173 -> Nginx Web -> API -> PostgreSQL
```

### 2.2 准备群晖目录

建议创建：

```text
/volume1/docker/family-finance/
├── app/       # 本项目源码
└── postgres/  # 生产数据库持久化目录
```

将项目上传到 `app` 目录，然后在项目根目录创建 `.env`：

```bash
cp .env.nas.example .env
```

修改 `.env`：

```env
POSTGRES_PASSWORD=请替换为足够长的随机字母数字密码
POSTGRES_DATA_PATH=/volume1/docker/family-finance/postgres
WEB_PORT=5173
```

数据库密码会用于 PostgreSQL URL，请只使用大小写字母和数字。

### 2.3 使用 Container Manager 部署

1. 在群晖套件中心安装 `Container Manager`。
2. 打开 `Container Manager -> 项目 -> 新增`。
3. 项目名称填写 `family-finance`。
4. 项目路径选择 `/volume1/docker/family-finance/app`。
5. 使用项目根目录的 `docker-compose.yml`。
6. 选择构建并启动项目。
7. 等待 `postgres`、`api`、`web` 三个服务正常运行。

访问地址：

```text
http://群晖局域网IP:5173
```

系统当前没有登录鉴权。仅允许家庭局域网访问 `WEB_PORT`，不要在路由器上开放该端口到公网。

### 2.4 使用命令行部署

在安装了 Docker Compose 的主机上也可以执行：

```bash
npm run nas:config
npm run nas:up
docker compose -p family-finance-nas ps
docker compose -p family-finance-nas logs -f api
```

停止生产容器：

```bash
npm run nas:down
```

PostgreSQL 数据保存在 `POSTGRES_DATA_PATH`，停止、重建或升级容器不会清空该目录。本阶段不配置自动备份。

### 2.5 更新版本

1. 替换 NAS `app` 目录中的项目文件，保留 `.env`。
2. 在 Container Manager 的项目详情中重新构建并启动。
3. 确认三个服务均正常，再打开页面检查。

API 容器启动时会运行 `prisma db push`，自动将生产数据库结构同步到当前版本。

## 3. 目录结构

```text
FamilyFinanceWeb/
├── apps/
│   ├── api/
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   └── Dockerfile
│   └── web/
│       ├── nginx.conf
│       ├── src/
│       └── Dockerfile
├── packages/shared/
├── docker-compose.dev.yml
├── docker-compose.yml
├── .env.example
├── .env.nas.example
└── package.json
```
