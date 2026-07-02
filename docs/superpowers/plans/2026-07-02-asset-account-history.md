# 资产账户历史记录查看 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「资产历史」页面，含总资产趋势、单账户历史、快照记录三个 Tab，支持查看与删除快照。

**Architecture:** 后端新增聚合查询 `GET /accounts/snapshots` 与删除 `DELETE /accounts/snapshots/:id` 两个端点（仓储/服务/控制器三层 + vitest 测试）。前端在 `App.tsx` 新增 `AssetHistoryPage` 及三个 Tab 子组件，复用现有 `Line`/`Table`/`Select` 等组件与 `PageProps` 模式。shared 包新增完整版 `AccountSnapshotRecord` 类型，消除前后端重复定义。

**Tech Stack:** NestJS + Prisma + PostgreSQL（后端）、React 19 + Vite + Ant Design 6 + @ant-design/charts 2（前端）、Vitest（测试）、TypeScript monorepo。

---

## File Structure

**后端**
- `packages/shared/src/index.ts` — 新增完整版 `AccountSnapshotRecord` 类型
- `apps/api/src/finance/finance.types.ts` — 删除未使用的旧 `AccountSnapshotRecord`
- `apps/api/src/finance/finance.repository.ts` — 接口新增 `listAllSnapshots`、`deleteSnapshot`
- `apps/api/src/finance/prisma-finance.repository.ts` — 实现两个方法
- `apps/api/src/finance/prisma-finance.repository.test.ts` — 新增测试
- `apps/api/src/finance/finance.service.ts` — 透传两个方法
- `apps/api/src/finance/finance.service.test.ts` — 更新 mock 仓储
- `apps/api/src/finance/finance.controller.ts` — 新增两个端点
- `apps/api/src/finance/finance.controller.test.ts` — 新增端点测试 + 更新 mock 仓储

**前端**
- `apps/web/src/api/client.ts` — 重命名 `AccountSnapshotRecord`→`AccountSnapshotPoint`，新增 `listAllSnapshots`、`deleteSnapshot`
- `apps/web/src/App.tsx` — 新增菜单项、`AssetHistoryPage` 与三个 Tab 子组件、`renderChange` 辅助函数、补图标与 hook 导入

---

## Task 1: shared 类型与后端旧类型清理

**Files:**
- Modify: `packages/shared/src/index.ts`（在 `AssetTrendPoint` 之后新增）
- Modify: `apps/api/src/finance/finance.types.ts:36-39`（删除）

- [ ] **Step 1: 在 shared 包新增完整版 `AccountSnapshotRecord`**

在 `packages/shared/src/index.ts` 的 `AssetTrendPoint` 接口（约 85-88 行）之后插入：

```ts
export interface AssetTrendPoint {
  date: string;
  totalAssets: MoneyAmount;
}

export interface AccountSnapshotRecord {
  id: string;
  accountId: string;
  accountName: string;
  ownerName: string;
  date: string;
  value: MoneyAmount;
}
```

- [ ] **Step 2: 删除后端 finance.types.ts 中未使用的旧 `AccountSnapshotRecord`**

`grep` 已确认 `apps/api/src/finance/finance.types.ts:36` 的 `AccountSnapshotRecord`（`{ date; value }`）未被任何文件 import。删除整段：

```ts
// 删除这 4 行（finance.types.ts 第 36-39 行）
export interface AccountSnapshotRecord {
  date: string;
  value: MoneyAmount;
}
```

删除后该位置上下文为：

```ts
export type UpdateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;

export type CreateTransactionInput = Omit<FinanceTransaction, "id">;
```

- [ ] **Step 3: 构建并 typecheck 后端与 shared**

Run: `npm run build -w @family-finance/shared && npm run typecheck -w @family-finance/api`
Expected: 两条命令均成功（shared 类型变更不会破坏后端，因旧类型未被引用）

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/finance/finance.types.ts
git commit -m "refactor: add full AccountSnapshotRecord to shared, drop unused duplicate"
```

---

## Task 2: 后端仓储层 — listAllSnapshots + deleteSnapshot（TDD）

**Files:**
- Modify: `apps/api/src/finance/finance.repository.ts`（接口）
- Modify: `apps/api/src/finance/prisma-finance.repository.ts`（实现）
- Test: `apps/api/src/finance/prisma-finance.repository.test.ts`
- Modify: `apps/api/src/finance/finance.controller.test.ts`（mock 仓储补 stub）
- Modify: `apps/api/src/finance/finance.service.test.ts`（mock 仓储补 stub）

- [ ] **Step 1: 在仓储接口新增两个方法签名**

在 `apps/api/src/finance/finance.repository.ts` 顶部 `import type { ... } from "@family-finance/shared"` 块中加入 `AccountSnapshotRecord`（按字母序，紧跟 `Account` 之后）：

```ts
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
```

在接口中 `listAccountSnapshots` 行（约 43 行）之后、`deleteAccount` 之前，新增两行：

```ts
  listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]>;
  listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]>;
  deleteSnapshot(id: string): Promise<void>;
  deleteAccount(id: string): Promise<void>;
```

- [ ] **Step 2: 给 controller 测试的 mock 仓储补 stub**

在 `apps/api/src/finance/finance.controller.test.ts` 的 `createEmptyRepository()` 中，`listAccountSnapshots` 之后补两个 stub：

```ts
    async listAccountSnapshots(_accountId) {
      return [];
    },
    async listAllSnapshots() {
      return [];
    },
    async deleteSnapshot() {
      return undefined;
    },
    async deleteAccount() {
      return undefined;
    },
```

- [ ] **Step 3: 给 service 测试的 mock 仓储补 stub**

在 `apps/api/src/finance/finance.service.test.ts` 的 `createRepository()` 中，`listAccountSnapshots`（约 212 行）之后补两个 stub：

```ts
    async listAccountSnapshots(_accountId: string) {
      return [];
    },
    async listAllSnapshots() {
      return [];
    },
    async deleteSnapshot() {
      return undefined;
    },
```

- [ ] **Step 4: 写失败测试（prisma 仓储）**

在 `apps/api/src/finance/prisma-finance.repository.test.ts` 末尾追加一个新 `describe` 块：

```ts
describe("PrismaFinanceRepository snapshot queries", () => {
  it("lists all snapshots with account names and applies date filter", async () => {
    const findMany = vi.fn(async () => [
      { id: "s1", accountId: "a1", date: new Date("2026-07-01T00:00:00.000Z"), value: "100.00" },
      { id: "s2", accountId: "a2", date: new Date("2026-07-02T00:00:00.000Z"), value: "200.00" }
    ]);
    const accountFindMany = vi.fn(async () => [
      { id: "a1", name: "支付宝", ownerName: "雄哥" },
      { id: "a2", name: "微信", ownerName: "瑶雯" }
    ]);
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany, upsert: vi.fn(), delete: vi.fn() },
      account: { findMany: accountFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const result = await repository.listAllSnapshots({ from: "2026-07-01", to: "2026-07-02" });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        familyId: "default-family",
        date: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lte: new Date("2026-07-02T00:00:00.000Z")
        }
      },
      orderBy: { date: "asc" }
    });
    expect(result).toEqual([
      { id: "s1", accountId: "a1", accountName: "支付宝", ownerName: "雄哥", date: "2026-07-01", value: "100.00" },
      { id: "s2", accountId: "a2", accountName: "微信", ownerName: "瑶雯", date: "2026-07-02", value: "200.00" }
    ]);
  });

  it("skips snapshots whose account has been deleted", async () => {
    const findMany = vi.fn(async () => [
      { id: "s1", accountId: "a1", date: new Date("2026-07-01T00:00:00.000Z"), value: "100.00" },
      { id: "s2", accountId: "a-gone", date: new Date("2026-07-02T00:00:00.000Z"), value: "200.00" }
    ]);
    const accountFindMany = vi.fn(async () => [{ id: "a1", name: "支付宝", ownerName: "雄哥" }]);
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany, upsert: vi.fn(), delete: vi.fn() },
      account: { findMany: accountFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const result = await repository.listAllSnapshots();
    expect(result).toEqual([
      { id: "s1", accountId: "a1", accountName: "支付宝", ownerName: "雄哥", date: "2026-07-01", value: "100.00" }
    ]);
  });

  it("deletes a snapshot by id", async () => {
    const deleteFn = vi.fn(async () => ({}));
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany: vi.fn(), upsert: vi.fn(), delete: deleteFn }
    } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.deleteSnapshot("s1");
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `npm run test -w @family-finance/api -- prisma-finance.repository`
Expected: FAIL — `listAllSnapshots is not a function` / `deleteSnapshot is not a function`（方法尚未实现）

- [ ] **Step 6: 在 prisma 仓储实现两个方法**

在 `apps/api/src/finance/prisma-finance.repository.ts` 顶部 shared import 块加入 `AccountSnapshotRecord`：

```ts
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
```

在 `listAccountSnapshots` 方法（约 388-395 行）之后，新增两个方法：

```ts
  async listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]> {
    await this.ensureBaseData();
    const snapshots = await this.prisma.accountSnapshot.findMany({
      where: { accountId, familyId: DEFAULT_FAMILY_ID },
      orderBy: { date: "asc" }
    });
    return snapshots.map((s) => ({ date: formatDate(s.date), value: decimalToMoney(s.value) }));
  }

  async listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]> {
    await this.ensureBaseData();
    const where: Prisma.AccountSnapshotWhereInput = { familyId: DEFAULT_FAMILY_ID };
    if (filter?.accountId) where.accountId = filter.accountId;
    if (filter?.from || filter?.to) {
      where.date = {};
      if (filter?.from) where.date.gte = parseDate(filter.from);
      if (filter?.to) where.date.lte = parseDate(filter.to);
    }
    const [snapshots, accounts] = await Promise.all([
      this.prisma.accountSnapshot.findMany({ where, orderBy: { date: "asc" } }),
      this.prisma.account.findMany({ where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null } })
    ]);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return snapshots
      .map((s): AccountSnapshotRecord | null => {
        const account = accountById.get(s.accountId);
        if (!account) return null;
        return {
          id: s.id,
          accountId: s.accountId,
          accountName: account.name,
          ownerName: account.ownerName,
          date: formatDate(s.date),
          value: decimalToMoney(s.value)
        };
      })
      .filter((r): r is AccountSnapshotRecord => r !== null);
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.accountSnapshot.delete({ where: { id } });
  }
```

> 注：`Prisma`、`parseDate`、`formatDate`、`decimalToMoney`、`DEFAULT_FAMILY_ID` 均已在本文件存在（`parseDate` 在 738 行，`formatDate` 在 742 行）。

- [ ] **Step 7: 运行测试，确认通过**

Run: `npm run test -w @family-finance/api -- prisma-finance.repository`
Expected: PASS（3 个新用例全部通过）

- [ ] **Step 8: typecheck 后端**

Run: `npm run typecheck -w @family-finance/api`
Expected: 无错误

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/finance/finance.repository.ts apps/api/src/finance/prisma-finance.repository.ts apps/api/src/finance/prisma-finance.repository.test.ts apps/api/src/finance/finance.controller.test.ts apps/api/src/finance/finance.service.test.ts
git commit -m "feat(api): add listAllSnapshots and deleteSnapshot to finance repository"
```

---

## Task 3: 后端服务层（TDD）

**Files:**
- Modify: `apps/api/src/finance/finance.service.ts`
- Test: `apps/api/src/finance/finance.service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/finance/finance.service.test.ts` 中，找到 "updates account amount through the normal edit flow" 的 `it` 块之后，插入新测试：

```ts
  it("lists all snapshots and deletes one through the service", async () => {
    const service = new FinanceService(createRepository());
    const all = await service.listAllSnapshots({ accountId: "a1" });
    expect(all).toEqual([]);
    await expect(service.deleteSnapshot("s1")).resolves.toBeUndefined();
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm run test -w @family-finance/api -- finance.service`
Expected: FAIL — `service.listAllSnapshots is not a function`

- [ ] **Step 3: 在 service 新增两个方法**

在 `apps/api/src/finance/finance.service.ts` 顶部 shared import 块加入 `AccountSnapshotRecord`：

```ts
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
```

在 `listAccountSnapshots` 方法（约 111-113 行）之后新增：

```ts
  async listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]> {
    return this.repository.listAccountSnapshots(accountId);
  }

  async listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]> {
    return this.repository.listAllSnapshots(filter);
  }

  async deleteSnapshot(id: string): Promise<void> {
    return this.repository.deleteSnapshot(id);
  }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm run test -w @family-finance/api -- finance.service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/finance/finance.service.ts apps/api/src/finance/finance.service.test.ts
git commit -m "feat(api): expose listAllSnapshots and deleteSnapshot via finance service"
```

---

## Task 4: 后端控制器端点（TDD）

**Files:**
- Modify: `apps/api/src/finance/finance.controller.ts`
- Test: `apps/api/src/finance/finance.controller.test.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/finance/finance.controller.test.ts` 的 `describe("FinanceController", ...)` 内，现有那个 `it` 块之后新增：

```ts
  it("routes aggregate snapshot query and delete through the controller", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        FinanceService,
        { provide: FINANCE_REPOSITORY, useValue: createEmptyRepository() }
      ]
    }).compile();
    const controller = moduleRef.get(FinanceController);

    await expect(controller.listAllSnapshots("a1", "2026-07-01", "2026-07-02")).resolves.toEqual([]);
    await expect(controller.deleteSnapshot("s1")).resolves.toBeUndefined();
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm run test -w @family-finance/api -- finance.controller`
Expected: FAIL — `controller.listAllSnapshots is not a function`

- [ ] **Step 3: 在 controller 新增两个端点**

在 `apps/api/src/finance/finance.controller.ts` 顶部 shared import 块加入 `AccountSnapshotRecord`：

```ts
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";
```

在 `listAccountSnapshots` 端点（约 105-108 行）之后新增两个端点：

```ts
  @Get("accounts/:id/snapshots")
  listAccountSnapshots(@Param("id") id: string): Promise<{ date: string; value: string }[]> {
    return this.financeService.listAccountSnapshots(id);
  }

  @Get("accounts/snapshots")
  listAllSnapshots(
    @Query("accountId") accountId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ): Promise<AccountSnapshotRecord[]> {
    return this.financeService.listAllSnapshots({ accountId, from, to });
  }

  @Delete("accounts/snapshots/:id")
  deleteSnapshot(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteSnapshot(id);
  }
```

> 路由说明：`GET accounts/snapshots`（2 段）与 `GET accounts/:id/snapshots`（3 段）路径长度不同，不冲突；`DELETE accounts/snapshots/:id`（3 段）与既有 `DELETE accounts/:id`（2 段）也不冲突。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm run test -w @family-finance/api -- finance.controller`
Expected: PASS

- [ ] **Step 5: 运行全部后端测试 + typecheck**

Run: `npm run test -w @family-finance/api && npm run typecheck -w @family-finance/api`
Expected: 全部 PASS，无类型错误

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/finance/finance.controller.ts apps/api/src/finance/finance.controller.test.ts
git commit -m "feat(api): add GET /accounts/snapshots and DELETE /accounts/snapshots/:id"
```

---

## Task 5: 前端 API client

**Files:**
- Modify: `apps/web/src/api/client.ts`

> 前端无单元测试基础设施（spec 已确认），本任务以 typecheck 作为质量门。

- [ ] **Step 1: 重命名类型并新增两个 API 函数**

在 `apps/web/src/api/client.ts` 顶部 shared import 块加入 `AccountSnapshotRecord`：

```ts
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionItem,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";
```

将原 `AccountSnapshotRecord` 接口与 `listAccountSnapshots`（120-127 行）替换为：

```ts
export interface AccountSnapshotPoint {
  date: string;
  value: string;
}

export async function listAccountSnapshots(accountId: string): Promise<AccountSnapshotPoint[]> {
  return getJson(`/accounts/${accountId}/snapshots`);
}

export async function listAllSnapshots(
  filter?: { accountId?: string; from?: string; to?: string }
): Promise<AccountSnapshotRecord[]> {
  const params = new URLSearchParams();
  if (filter?.accountId) params.set("accountId", filter.accountId);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  const query = params.toString();
  return getJson(`/accounts/snapshots${query ? `?${query}` : ""}`);
}

export async function deleteSnapshot(id: string): Promise<void> {
  return del(`/accounts/snapshots/${id}`);
}
```

- [ ] **Step 2: typecheck 前端**

Run: `npm run typecheck -w @family-finance/web`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/client.ts
git commit -m "feat(web): add listAllSnapshots and deleteSnapshot to api client"
```

---

## Task 6: 前端菜单与 AssetHistoryPage 骨架

**Files:**
- Modify: `apps/web/src/App.tsx`（导入、`PageKey`、菜单、`pageTitle`、页面渲染）

- [ ] **Step 1: 补充导入**

在 `apps/web/src/App.tsx` 第 11 行 `BarChartOutlined` 之后插入 `HistoryOutlined`（保持字母序，位于 `HeartOutlined` 之前）：

```ts
  BarChartOutlined,
  CreditCardOutlined,
  CrownOutlined,
  DatabaseOutlined,
  FundProjectionScreenOutlined,
  GiftOutlined,
  HeartOutlined,
  HistoryOutlined,
  HomeOutlined,
```

在 `@ant-design/charts` 导入行（67 行）下方的 antd 导入块中加入 `Tabs`（字母序位于 `Table` 与 `Tag` 之间）。

在 react 导入行（69 行）加入 `useMemo`：

```ts
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
```

在 shared 导入行（34 行）加入 `type AccountSnapshotRecord`：

```ts
import { formatMoney, type AccountSnapshotRecord } from "@family-finance/shared";
```

在 `./api/client` 导入块（70-99 行）的 type 列表加入 `type AccountSnapshotPoint`，并在函数名列表加入 `deleteSnapshot`、`listAccountSnapshots`、`listAllSnapshots`（按字母序插入）。

- [ ] **Step 2: 扩展 `PageKey`**

将 `PageKey`（106-113 行）改为：

```ts
type PageKey =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "assetHistory"
  | "liabilities"
  | "budgets"
  | "investments"
  | "settings";
```

- [ ] **Step 3: 菜单新增「资产历史」项**

在菜单 `items` 数组（217-225 行）的 `accounts` 项之后、`liabilities` 项之前插入：

```ts
              { key: "accounts", icon: <BankOutlined />, label: "资产账户" },
              { key: "assetHistory", icon: <HistoryOutlined />, label: "资产历史" },
              { key: "liabilities", icon: <CreditCardOutlined />, label: "负债" },
```

- [ ] **Step 4: 页面渲染分支**

在页面渲染区（256-262 行）的 `accounts` 行之后插入：

```ts
              {activePage === "accounts" ? <AccountsPage {...commonProps} /> : null}
              {activePage === "assetHistory" ? <AssetHistoryPage {...commonProps} /> : null}
              {activePage === "liabilities" ? <LiabilitiesPage {...commonProps} /> : null}
```

- [ ] **Step 5: `pageTitle` 增加映射**

在 `pageTitle`（1913-1923 行）的对象中加入 `assetHistory: "资产历史"`：

```ts
  return {
    dashboard: "仪表盘",
    transactions: "收支流水",
    accounts: "资产账户",
    assetHistory: "资产历史",
    liabilities: "负债",
    budgets: "预算",
    investments: "投资持仓",
    settings: "设置"
  }[activePage];
```

- [ ] **Step 6: 新增 `AssetHistoryPage` 骨架组件**

在 `App.tsx` 中 `SettingsPage` 函数之前（约 1563 行）插入空骨架：

```tsx
function AssetHistoryPage(props: PageProps) {
  return (
    <Tabs
      defaultActiveKey="total"
      items={[
        { key: "total", label: "总资产趋势", children: <TotalAssetTrendTab data={props.data} /> },
        { key: "single", label: "单账户历史", children: <SingleAccountHistoryTab data={props.data} /> },
        {
          key: "records",
          label: "快照记录",
          children: <SnapshotRecordsTab data={props.data} submit={props.submit} />
        }
      ]}
    />
  );
}

function TotalAssetTrendTab({ data }: { data: AppData }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="待实现" />;
}

function SingleAccountHistoryTab({ data }: { data: AppData }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="待实现" />;
}

function SnapshotRecordsTab({ data, submit }: { data: AppData; submit: PageProps["submit"] }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="待实现" />;
}
```

- [ ] **Step 7: typecheck + 启动预览验证菜单**

Run: `npm run typecheck -w @family-finance/web`
Expected: 无错误

启动预览（`preview_start` web 与 api），打开应用，点击侧边「资产历史」，确认进入三 Tab 空骨架页面。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): add asset history page skeleton with three tabs"
```

---

## Task 7: Tab2 单账户历史

**Files:**
- Modify: `apps/web/src/App.tsx`（`SingleAccountHistoryTab` + `renderChange` 辅助函数）

- [ ] **Step 1: 新增 `renderChange` 辅助函数**

在 `App.tsx` 中 `renderAccountType` 附近（或 `AssetHistoryPage` 之前）新增：

```tsx
function renderChange(change: number | null): ReactNode {
  if (change === null) return <Tag>初始</Tag>;
  if (change === 0) return <Tag color="default">¥0.00</Tag>;
  const color = change > 0 ? "red" : "green";
  const sign = change > 0 ? "+" : "";
  return <Tag color={color}>{sign}{formatMoney(change.toFixed(2))}</Tag>;
}
```

> 配色沿用项目「红涨绿跌」约定（与投资收益率 Tag 一致：正→red，负→green）。

- [ ] **Step 2: 实现 `SingleAccountHistoryTab`**

将骨架替换为：

```tsx
function SingleAccountHistoryTab({ data }: { data: AppData }) {
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [points, setPoints] = useState<AccountSnapshotPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setPoints([]);
      return;
    }
    setLoading(true);
    listAccountSnapshots(accountId)
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  const chartData = points.map((p) => ({ date: p.date, value: Number(p.value) }));
  const rows = points.map((p, i) => {
    const prev = i > 0 ? Number(points[i - 1]!.value) : null;
    const change = prev === null ? null : Number(p.value) - prev;
    return { key: p.date, date: p.date, value: p.value, change };
  });

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Select
        showSearch
        placeholder="选择账户"
        style={{ minWidth: 240 }}
        options={data.accounts.map((a) => ({ label: a.name, value: a.id }))}
        onChange={(value) => setAccountId(value)}
      />
      {accountId ? (
        <>
          <Card className="chart-card">
            {chartData.length >= 2 ? (
              <Line
                data={chartData}
                xField="date"
                yField="value"
                height={300}
                point={{ size: 3 }}
                color="#1677ff"
                axis={{ y: { labelFormatter: (v: string) => formatMoney(v) } }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无该账户快照" />
            )}
          </Card>
          <Card title="明细" className="list-card">
            <Table
              size="middle"
              pagination={false}
              loading={loading}
              dataSource={rows}
              columns={[
                { title: "日期", dataIndex: "date", width: 150 },
                { title: "金额", dataIndex: "value", width: 140, align: "right", render: (v: string) => formatMoney(v) },
                { title: "较上次变化", dataIndex: "change", width: 140, align: "right", render: (c: number | null) => renderChange(c) }
              ]}
            />
          </Card>
        </>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一个账户" />
      )}
    </Space>
  );
}
```

- [ ] **Step 3: typecheck + 预览验证**

Run: `npm run typecheck -w @family-finance/web`
Expected: 无错误

预览验证：进入「资产历史」→「单账户历史」Tab，选择一个有快照的账户，确认折线图与明细表出现，"较上次变化"列首条显示「初始」，其余显示带颜色的 Tag。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): implement single-account history tab"
```

---

## Task 8: Tab3 快照记录

**Files:**
- Modify: `apps/web/src/App.tsx`（`SnapshotRecordsTab`）

- [ ] **Step 1: 实现 `SnapshotRecordsTab`**

将骨架替换为：

```tsx
function SnapshotRecordsTab({ data, submit }: { data: AppData; submit: PageProps["submit"] }) {
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [records, setRecords] = useState<AccountSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listAllSnapshots({
      accountId,
      from: range?.[0]?.format("YYYY-MM-DD"),
      to: range?.[1]?.format("YYYY-MM-DD")
    })
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [accountId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const byAccount = new Map<string, AccountSnapshotRecord[]>();
    for (const r of records) {
      const list = byAccount.get(r.accountId) ?? [];
      list.push(r);
      byAccount.set(r.accountId, list);
    }
    const withChange: (AccountSnapshotRecord & { change: number | null })[] = [];
    for (const list of byAccount.values()) {
      list.sort((a, b) => a.date.localeCompare(b.date));
      list.forEach((r, i) => {
        const prev = i > 0 ? Number(list[i - 1]!.value) : null;
        withChange.push({ ...r, change: prev === null ? null : Number(r.value) - prev });
      });
    }
    return withChange.sort((a, b) => b.date.localeCompare(a.date));
  }, [records]);

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Space size={8} wrap>
        <Select
          allowClear
          placeholder="全部账户"
          style={{ minWidth: 180 }}
          options={data.accounts.map((a) => ({ label: a.name, value: a.id }))}
          value={accountId}
          onChange={(v) => setAccountId(v)}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
        />
      </Space>
      <Card className="list-card">
        <Table
          size="middle"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "日期", dataIndex: "date", width: 150 },
            { title: "账户", dataIndex: "accountName", width: 160 },
            { title: "归属", dataIndex: "ownerName", width: 100, render: (v: string) => renderOwnerTag(v, data.members) },
            { title: "金额", dataIndex: "value", width: 140, align: "right", render: (v: string) => formatMoney(v) },
            { title: "较上次变化", dataIndex: "change", width: 140, align: "right", render: (c: number | null) => renderChange(c) },
            {
              title: "操作",
              key: "actions",
              width: 100,
              render: (_, record) => (
                <Popconfirm
                  title="确认删除该快照？"
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() =>
                    submit(() => deleteSnapshot(record.id), { success: "快照已删除", onSuccess: load })
                  }
                >
                  <Button type="link" size="small" danger>删除</Button>
                </Popconfirm>
              )
            }
          ]}
        />
      </Card>
    </Space>
  );
}
```

- [ ] **Step 2: typecheck + 预览验证**

Run: `npm run typecheck -w @family-finance/web`
Expected: 无错误

预览验证：进入「快照记录」Tab，确认表格列出全部快照；切换账户筛选与日期范围，列表更新；点击删除并确认，列表刷新。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): implement snapshot records tab with filter and delete"
```

---

## Task 9: Tab1 总资产趋势（点击展开当日明细）

**Files:**
- Modify: `apps/web/src/App.tsx`（`TotalAssetTrendTab`）

- [ ] **Step 1: 实现 `TotalAssetTrendTab`**

将骨架替换为：

```tsx
function TotalAssetTrendTab({ data }: { data: AppData }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayRecords, setDayRecords] = useState<AccountSnapshotRecord[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const chartData = data.assetTrend.map((p) => ({ date: p.date, value: Number.parseFloat(p.totalAssets) }));

  useEffect(() => {
    if (!selectedDate) {
      setDayRecords([]);
      return;
    }
    setDayLoading(true);
    listAllSnapshots({ from: selectedDate, to: selectedDate })
      .then(setDayRecords)
      .catch(() => setDayRecords([]))
      .finally(() => setDayLoading(false));
  }, [selectedDate]);

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Card title="总资产变化" className="chart-card">
        {chartData.length >= 2 ? (
          <Line
            data={chartData}
            xField="date"
            yField="value"
            height={320}
            point={{ size: 3 }}
            color="#1677ff"
            slider={{}}
            axis={{ y: { labelFormatter: (v: string) => `${Number(v) / 1000}k` } }}
            onEvent={(event: { type?: string; data?: { data?: { date?: string } } }) => {
              if (event?.type === "element:click" && event.data?.data?.date) {
                const d = event.data.data.date;
                setSelectedDate((prev) => (prev === d ? null : d));
              }
            }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资产快照数据" />
        )}
      </Card>
      {selectedDate ? (
        <Card title={`${selectedDate} 快照明细`} className="list-card" loading={dayLoading}>
          {dayRecords.length ? (
            <Table
              size="middle"
              pagination={false}
              dataSource={dayRecords}
              columns={[
                { title: "账户", dataIndex: "accountName", width: 180 },
                { title: "归属", dataIndex: "ownerName", width: 100, render: (v: string) => renderOwnerTag(v, data.members) },
                { title: "金额", dataIndex: "value", width: 140, align: "right", render: (v: string) => formatMoney(v) }
              ]}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当日无快照" />
          )}
        </Card>
      ) : null}
    </Space>
  );
}
```

> 说明：`onEvent` 来自 @ant-design/charts v2；点击数据点时 `event.type === "element:click"`，`event.data.data.date` 为该点日期。`slider={{}}` 启用内置缩略轴做区间缩放。

- [ ] **Step 2: typecheck + 预览验证**

Run: `npm run typecheck -w @family-finance/web`
Expected: 无错误

预览验证：进入「总资产趋势」Tab，确认折线图与缩略轴显示；点击某个数据点，下方展开「YYYY-MM-DD 快照明细」面板列出当日有快照的账户；再次点击同一点收起。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): implement total asset trend tab with click-to-expand day detail"
```

---

## Task 10: 端到端验证

- [ ] **Step 1: 全量 typecheck + 测试**

Run: `npm run typecheck && npm run test`
Expected: 全部通过

- [ ] **Step 2: 预览端到端走查**

启动 web 与 api 预览服务，依次验证：
1. 侧边菜单出现「资产历史」，位于「资产账户」与「负债」之间
2. 「总资产趋势」Tab：折线图 + 缩略轴缩放；点击数据点展开当日快照明细；再点收起
3. 「单账户历史」Tab：选择账户后出现折线图 + 明细表，"较上次变化"首条为「初始」，其余为红/绿 Tag
4. 「快照记录」Tab：表格列出全部快照；账户筛选与日期范围生效；删除单条后列表刷新
5. 既有功能未受影响：仪表盘趋势、资产账户「保存快照」、资产账户归属筛选

- [ ] **Step 3: 若预览发现问题，修复后补充提交；否则无新提交**

如发现问题（如 `onEvent` 事件形状不符），读取 `@ant-design/charts` 实际事件对象调整 `TotalAssetTrendTab`，重新 typecheck + 预览验证后提交：

```bash
git add apps/web/src/App.tsx
git commit -m "fix(web): adjust chart click event handling for asset trend"
```

---

## Self-Review

**Spec coverage：**
- 三 Tab 独立页面 → Task 6（骨架）+ Task 7/8/9（各 Tab）
- 后端聚合端点 `GET /accounts/snapshots` → Task 2/3/4
- 后端删除端点 `DELETE /accounts/snapshots/:id` → Task 2/3/4
- shared 完整版 `AccountSnapshotRecord` → Task 1
- client.ts 重命名 + 两个新函数 → Task 5
- Tab1 简化方案（当日有快照账户）→ Task 9
- Tab2 折线图 + 明细表 + 较上次变化 → Task 7
- Tab3 筛选 + 表格 + 删除 + 较上次变化 → Task 8
- 后端测试 → Task 2/3/4
- 错误处理（Empty 空状态、catch 回退）→ Task 7/8/9
- 验收标准 6 条 → Task 10 端到端走查覆盖

**Placeholder scan：** 无 TBD/TODO；Task 6 骨架的 "待实现" 是临时占位，在 Task 7/8/9 被实际实现替换，非遗留占位。

**Type consistency：** `AccountSnapshotRecord`（shared，完整版，含 id/accountName/ownerName）在 Task 1 定义，Task 2/3/4/5/8/9 一致使用；`AccountSnapshotPoint`（client，{date,value}）在 Task 5 定义，Task 6/7 一致使用；`listAllSnapshots(filter?)` 签名在后端三层与前端 client 一致；`deleteSnapshot(id)` 同理；`renderChange` 在 Task 7 定义、Task 8 复用。

**Scope：** 单一实现计划，后端 + 前端共 10 个任务，每个任务可独立提交、可独立验证。
