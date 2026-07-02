# Family Finance Web

家庭财务管理 Web 版，TypeScript monorepo：

| 包 | 说明 | 技术栈 |
| --- | --- | --- |
| `apps/api` | 后端 API | NestJS + Prisma + PostgreSQL |
| `apps/web` | 前端 | React + Vite + Ant Design |
| `packages/shared` | 前后端共享的类型与领域逻辑 | TypeScript |

## 端口约定

| 服务 | 本地开发 | 容器（docker compose） |
| --- | --- | --- |
| Web 前端 | `5173`（Vite dev） | `5173 → 4173`（vite preview） |
| API 后端 | `4000` | `4000` |
| PostgreSQL | — | `5433 → 5432`（宿主机用 `5433` 连接） |

---

## 1. 本地开发（推荐）

本地直接运行前后端 Node 服务，数据库用容器里的 PostgreSQL。

### 1.1 前置条件

- Node.js 24+（与镜像保持一致）
- Docker（仅用于跑数据库）

### 1.2 只启动数据库容器

```bash
docker compose up -d postgres
```

数据库会监听宿主机的 **5433** 端口（数据持久化在 `family-finance-postgres` 这个 volume 里）。

### 1.3 安装依赖

在仓库根目录执行（npm workspaces 会安装所有子包）：

```bash
npm install
```

### 1.4 配置后端环境变量

后端通过 Prisma 读取 `DATABASE_URL`。npm 脚本以 `apps/api` 为工作目录运行，所以 `.env` 要放在 **`apps/api/.env`**：

```bash
cp .env.example apps/api/.env
```

`apps/api/.env` 内容（连接容器里的库，注意端口是宿主机映射的 `5433`）：

```env
DATABASE_URL="postgresql://family_finance:family_finance@localhost:5433/family_finance?schema=public"
API_PORT=4000
```

> 前端本地开发无需配置环境变量：默认请求 `http://localhost:4000/api`。
> 如需指向其它地址，给 `apps/web` 设置 `VITE_API_BASE_URL`。

### 1.5 初始化数据库表

首次启动、或改了 `apps/api/prisma/schema.prisma` 后执行：

```bash
npm run db:generate   # 生成 Prisma Client
npm run db:migrate    # 创建/更新表（prisma migrate dev）
```

> 想快速同步 schema 而不生成 migration 历史，可用：
> `npm run prisma:push -w @family-finance/api`（等价于 `prisma db push`）。
> 后端首次响应请求时会自动写入基础数据（家庭、成员、默认分类）。

### 1.6 启动前后端

一条命令同时起前后端：

```bash
npm run dev
```

或分别启动：

```bash
npm run dev:api   # 后端 http://localhost:4000/api
npm run dev:web   # 前端 http://localhost:5173
```

打开 http://localhost:5173 即可。

---

## 2. 常用脚本

在仓库根目录运行：

```bash
npm run build       # 构建全部 workspace
npm run test        # 运行全部测试
npm run typecheck   # 类型检查
npm run db:generate # 生成 Prisma Client
npm run db:migrate  # 数据库迁移
```

---

## 3. 打包与运行镜像（docker compose）

`docker-compose.yml` 定义了三个服务：`postgres`、`api`、`web`。

### 3.1 构建镜像

```bash
docker compose build
```

- `api` 镜像：构建时执行 `prisma generate` 与 `tsc`，容器启动时先 `prisma db push` 同步表结构，再启动服务。
- `web` 镜像：构建时执行 `vite build`，构建参数 `VITE_API_BASE_URL` 默认 `http://localhost:4000/api`。

### 3.2 启动整套（含数据库）

```bash
docker compose up -d --build
```

启动后访问：

- 前端：http://localhost:5173
- 后端：http://localhost:4000/api

容器内 API 通过 `postgres:5432`（compose 内部网络）连库，无需 `.env` —— `DATABASE_URL` 已在 compose 中注入。

### 3.3 查看日志 / 停止

```bash
docker compose logs -f api      # 查看后端日志
docker compose ps               # 查看服务状态
docker compose stop             # 停止容器（保留数据）
docker compose down             # 停止并删除容器（保留数据 volume）
docker compose down -v          # 连同数据库数据一起删除
```

---

## 4. 目录结构

```
FamilyFinanceWeb/
├── apps/
│   ├── api/                 # NestJS 后端
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   └── Dockerfile
│   └── web/                 # React 前端
│       ├── src/
│       └── Dockerfile
├── packages/
│   └── shared/              # 共享类型与领域逻辑
├── docker-compose.yml
├── .env.example
└── package.json             # workspaces 根
```
