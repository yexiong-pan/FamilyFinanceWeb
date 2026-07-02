# 资产账户历史记录查看 — 前端设计

- 日期：2026-07-02
- 分支：add-family-finance-web
- 状态：已确认设计，待实现

## 背景与动机

账户金额重构后，`AccountSnapshot` 只在用户手动点击「保存快照」时写入。当前状态：

- 能存快照（资产账户页「保存快照」按钮 → `POST /accounts/snapshots`）
- 仪表盘有全局总资产趋势折线图（复用 `assetTrend`）
- `listAccountSnapshots(accountId)` API 已存在于前端 client，但**没有任何 UI 调用它**（重构时随 `AccountValuePopover` 一并移除，成了死代码）
- 没有任何地方能查看单账户历史或全部快照记录

本设计填补「查看历史」的空缺，提供一个统一的「资产历史」页面，覆盖三个维度。

## 目标

1. 新增「资产历史」独立页面，侧边菜单入口位于「资产账户」与「负债」之间
2. 三个 Tab：
   - **总资产趋势**：复用现有 `assetTrend`，增加区间缩放与点击某日查看当日快照明细
   - **单账户历史**：选择账户，看该账户金额随时间变化的折线图 + 明细表
   - **快照记录**：全部快照记录的可筛选表格，支持删除单条
3. 后端新增聚合查询与删除两个端点

## 非目标

- 不做快照的编辑（快照是只读历史，只能删除）
- 不做"当日所有账户有效值"的精确还原（采用简化方案，见 Tab1）
- 不做前端单元测试（web 端目前无测试基础设施，沿用现状）

## 信息架构与入口

- 侧边菜单新增项：「资产历史」，key 为 `assetHistory`，插入位置在 `accounts` 与 `liabilities` 之间
- 新增页面组件 `AssetHistoryPage`，遵循现有 `PageProps` 模式（接收 `data: AppData` 与 `submit`）
- 页面内用 antd `Tabs` 组织三个 Tab，每个 Tab 一个独立子组件

## 后端 API 改动

保留现有 `GET /accounts/:id/snapshots`（Tab2 复用）。新增两个端点：

### 1. 聚合查询 `GET /accounts/snapshots`

- 查询参数（均可选）：`accountId`、`from`（YYYY-MM-DD）、`to`（YYYY-MM-DD）
- 返回带账户信息的记录，避免前端二次 join
- 仓储方法：`listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]>`
- 实现要点：`prisma.accountSnapshot.findMany` 带 `where`（familyId + 可选 accountId + date 区间），按 `date asc` 排序；join `account` 取 `name`、`ownerName`

返回类型（shared 包定义）：

```ts
export interface AccountSnapshotRecord {
  id: string;
  accountId: string;
  accountName: string;
  ownerName: string;
  date: string;
  value: MoneyAmount;
}
```

### 2. 删除单条 `DELETE /accounts/snapshots/:id`

- 仓储方法：`deleteSnapshot(id: string): Promise<void>`
- 实现要点：`prisma.accountSnapshot.delete({ where: { id } })`
- 前端删除后刷新当前 Tab3 列表

### 仓储接口变更

`FinanceRepository`（[finance.repository.ts](apps/api/src/finance/finance.repository.ts)）新增两个方法签名；`PrismaFinanceRepository` 实现它们。现有 `listAccountSnapshots(accountId)` 保留不动。

## 前端组件结构与数据流

```
AssetHistoryPage            // 容器, 管 activeTab 状态
├── TotalAssetTrendTab      // 数据: data.assetTrend (零额外请求)
├── SingleAccountHistoryTab // 数据: listAccountSnapshots(id) 懒加载
└── SnapshotRecordsTab      // 数据: listAllSnapshots(filter) 懒加载
```

### API client 新增（[client.ts](apps/web/src/api/client.ts)）

```ts
export async function listAllSnapshots(
  filter?: { accountId?: string; from?: string; to?: string }
): Promise<AccountSnapshotRecord[]>;

export async function deleteSnapshot(id: string): Promise<void>;
```

扩展 `AccountSnapshotRecord` 类型为上述带 `id`/`accountName`/`ownerName` 的结构。现有 `listAccountSnapshots` 返回类型也同步扩展（后端 `listAccountSnapshots` 实现需补 `id`/`accountName`/`ownerName` 字段，或前端 Tab2 仅取 `date`/`value`——采用后者，Tab2 不依赖新字段，最小改动）。

> **类型处理（消除歧义）**：
> - shared 包新增 `AccountSnapshotRecord`（完整版，含 `id`/`accountName`/`ownerName`），聚合端点 `listAllSnapshots` 返回 `AccountSnapshotRecord[]`
> - client.ts 现有的本地 `AccountSnapshotRecord` 接口（`{ date, value }`）重命名为 `AccountSnapshotPoint`，`listAccountSnapshots` 返回 `AccountSnapshotPoint[]`。Tab2 只用 `date`/`value`，不依赖完整类型
> - 两个端点返回类型独立，不强行统一；后端 `listAccountSnapshots` 返回结构不变

### 加载策略

- **Tab1**：直接用 `data.assetTrend`，无额外请求；点击数据点时懒加载当日明细
- **Tab2**：`Select` 选中账户后触发 `listAccountSnapshots(id)`；切换账户重新加载
- **Tab3**：进入 Tab 时首次加载；筛选条件变化重新加载；删除成功后刷新

## 各 Tab 交互细节

### Tab1 总资产趋势

- 图表：`@ant-design/charts` 的 `Line`，`xField="date"`、`yField` 取 `Number(totalAssets)`
- 区间缩放：启用 `Line` 的 `slider` 配置（内置缩略轴拖选）
- 点击数据点：通过 chart 的 `onEvent` 捕获点击，懒加载 `listAllSnapshots({ from: date, to: date })`，在图表下方展开「当日快照明细」面板（账户名 / 归属 / 金额）；再次点击同一日或切换区间时收起
- **简化方案（已确认）**：只展示当日实际保存了快照的账户。不还原"未保存快照但沿用上次值"的账户。当日无任何快照时显示「当日无快照」

### Tab2 单账户历史

- 顶部 `Select` 选账户，`options` 来自 `data.accounts`（label 显示账户名）
- 选中后调用 `listAccountSnapshots(id)`，数据按 `date asc`
- 上方折线图：`Line`，`xField="date"`、`yField` 取 `Number(value)`
- 下方明细表：日期 / 金额 / 较上次变化（变化 = 当前 value − 同序列上一条 value，首条显示「初始」，正用红色 Tag、负用绿色 Tag，与项目盈亏配色一致）
- 关于"标注保存快照的时点"：重构后只有手动「保存快照」写 `AccountSnapshot`，故单账户历史的每个点本身就是一次手动快照，无需额外标注

### Tab3 快照记录

- 筛选栏：账户 `Select`（allowClear，可选全部）+ 日期范围 `DatePicker.RangePicker`
- 表格列：日期 / 账户 / 归属 / 金额 / 较上次变化 / 操作
- "较上次变化"：前端按 `accountId` 分组、组内按 `date asc` 排序后，用当前 `value` 减上一条 `value` 计算；首条显示「初始」
- 操作列：删除按钮 + `Popconfirm` 确认 → `deleteSnapshot(id)` → 成功后刷新列表
- 默认按日期倒序展示（最新在前），与资产账户页金额倒序风格一致

## 错误处理

- 加载失败：antd `message.error` 提示，Tab 体显示 `Empty`（无数据态）
- 删除失败：`message.error`，列表不变
- 无数据：各 Tab 显示 `Empty`，文案分别为「暂无资产快照」「暂无该账户快照」「暂无快照记录」

## 测试

- **后端**：在 `finance.controller.test.ts`、`finance.service.test.ts`、`prisma-finance.repository.test.ts` 补充用例，覆盖 `listAllSnapshots`（含筛选）、`deleteSnapshot`，沿用现有 vitest + mock 仓储模式
- **前端**：不新增（web 端无测试基础设施）

## 验收标准

1. 侧边菜单出现「资产历史」，点击进入三 Tab 页面
2. Tab1 显示总资产趋势折线图，可拖动缩略轴缩放区间，点击数据点弹出当日快照账户明细
3. Tab2 选择某账户后，显示该账户折线图 + 明细表，变化列计算正确
4. Tab3 显示全部快照记录，按账户/日期范围筛选生效，删除单条后列表刷新
5. 后端新端点测试通过
6. 既有功能（仪表盘趋势、保存快照、资产账户筛选）不受影响

## 涉及文件

**后端**
- [apps/api/src/finance/finance.controller.ts](apps/api/src/finance/finance.controller.ts) — 新增 2 个端点
- [apps/api/src/finance/finance.service.ts](apps/api/src/finance/finance.service.ts) — 新增 2 个方法
- [apps/api/src/finance/finance.repository.ts](apps/api/src/finance/finance.repository.ts) — 接口新增 2 个方法签名
- [apps/api/src/finance/prisma-finance.repository.ts](apps/api/src/finance/prisma-finance.repository.ts) — 实现 2 个方法
- 对应 `.test.ts` 文件补充用例

**shared**
- [packages/shared/src/index.ts](packages/shared/src/index.ts) — 新增 `AccountSnapshotRecord` 类型

**前端**
- [apps/web/src/api/client.ts](apps/web/src/api/client.ts) — 新增 `listAllSnapshots`、`deleteSnapshot`
- [apps/web/src/App.tsx](apps/web/src/App.tsx) — 新增菜单项、`AssetHistoryPage` 及三个子 Tab 组件
