# Family Finance MCP

`apps/mcp` 是家庭财务系统的本地 stdio MCP 服务器。它通过现有的、已登录保护的 API 访问数据，不直连 PostgreSQL，也不会把 API 暴露给公网。

## 能力与安全边界

- 专用工具：月度概览、收支流水、资产/投资/负债、年度报告、健康概览、家庭日历和新增收支。
- `family_finance_api` 为其他既有 API 提供高级入口，因此健康、日程、月度复盘和资金安全等功能也能使用。
- `FAMILY_FINANCE_MCP_ALLOW_WRITE` 默认为 `false`。此时所有 POST、PATCH 和 DELETE 都会被拒绝；开启后才可修改数据。
- MCP 使用已有 Web 登录会话的 `family_finance_session` Cookie；不处理登录、邀请或其他 `auth` 路径。

## 构建

先启动本项目 API，并构建 MCP：

```bash
npm run dev:api
npm run build -w @family-finance/mcp
```

将示例复制为本地配置文件，再填写会话令牌：

```bash
cp apps/mcp/.env.example apps/mcp/.env.local
```

`apps/mcp/.env.local` 已被 Git 忽略。将实际值只填写在此文件，不要提交会话令牌。

## 在 Codex 中接入

在浏览器开发者工具的 Storage/Cookies 中，复制已登录家庭财务站点的 `family_finance_session` 值，然后填入 `apps/mcp/.env.local`。配置内容示例：

```env
FAMILY_FINANCE_MCP_API_URL=https://app.oreohome.com/api
FAMILY_FINANCE_MCP_SESSION_TOKEN=复制的 family_finance_session 值
FAMILY_FINANCE_MCP_ALLOW_WRITE=false
```

保存 `.env.local` 后，在 Codex Desktop 的 MCP 设置中添加一次该服务；之后即可通过齿轮修改或删除它，并用 `/mcp` 确认已连接。

在 Codex Desktop 的 **Settings → MCP servers → Add server** 中选择 **STDIO**：

- Command: `node`
- Arguments: `/Users/panyexiong/理财/FamilyFinanceWeb/apps/mcp/dist/index.js`
- Environment:
  - `FAMILY_FINANCE_MCP_API_URL=http://localhost:4000/api`
  - `FAMILY_FINANCE_MCP_SESSION_TOKEN=你的会话令牌`
  - `FAMILY_FINANCE_MCP_ALLOW_WRITE=false`

首次使用建议保持只读；需要由 Codex 记账或编辑数据时，再将 `apps/mcp/.env.local` 内的 `FAMILY_FINANCE_MCP_ALLOW_WRITE` 改为 `true` 并重启。

建议在 Codex 中为非只读工具保留写入确认。

也可以用 Codex CLI 添加：

```bash
codex mcp add family-finance \
  --env FAMILY_FINANCE_MCP_API_URL=http://localhost:4000/api \
  --env FAMILY_FINANCE_MCP_SESSION_TOKEN=你的会话令牌 \
  --env FAMILY_FINANCE_MCP_ALLOW_WRITE=false \
  -- node /Users/panyexiong/理财/FamilyFinanceWeb/apps/mcp/dist/index.js
```

如果 API 位于 NAS，请将 `FAMILY_FINANCE_MCP_API_URL` 指向局域网或 HTTPS 反向代理能够访问的 `/api` 地址。会话令牌仅应存放在你的本机 Codex 配置中。
