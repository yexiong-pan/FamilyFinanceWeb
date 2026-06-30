# 资产账户调整功能设计

## 现状分析

- **数据模型**: `Account` 已有 `currentValue` 字段
- **快照机制**: `AccountSnapshot` 模型已存在（`accountId` + `date` + `value`），每天每个账户一条记录，已在 `createAccount` 和 `updateAccount` 时自动写入快照
- **资产趋势**: `listAssetTrend()` 已在用 snapshots 计算总资产变化曲线
- **产品决策**: 收支流水不自动影响账户余额，账户余额靠手动维护（`prisma-finance.repository.ts:233-234`）

## 功能设计

### 编辑 vs 调整 对比

|      | 编辑              | 调整           |
|------|-------------------|----------------|
| 改什么 | 名称、类型、归属、备注 | **只能改金额**  |
| 入口   | 操作列「编辑」    | 操作列「调整」  |
| 记快照 | 否               | 是             |

### API 设计

- `POST /api/accounts/:id/adjust` — 调整金额
  - 请求体: `{ value: "新金额" }`
  - 行为: 更新 `Account.currentValue` + 写入 `AccountSnapshot`
- `GET /api/accounts/:id/snapshots` — 查询账户历史快照
  - 返回: `{ date: string, value: string }[]`
  - 用途: 后续展示账户资金变化折线图

### 前端交互

- 编辑 Drawer：**去掉金额字段**，金额只能通过调整修改
- 操作列：新增「调整」按钮（调整 | 编辑 | 删除）
- 调整 Modal：显示账户名称、当前金额（只读）、调整后金额（输入），保存调用 `adjustAccount`
