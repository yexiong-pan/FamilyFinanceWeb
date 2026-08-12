# 房贷公积金模块需求规格

**日期：** 2026-08-12
**状态：** 待开发
**范围：** 家庭财务 Web；首版（MVP）及后续迭代

## 1. 背景与目标

现有“财务盘点 > 负债”支持房贷作为普通负债，能够维护余额、月供、还款日和还款记录。但一笔真实房贷通常包含商业贷和公积金贷，且会涉及夫妻双方公积金账户、月冲/年冲、实际银行卡扣款、提前还款及利率调整；这些信息放在通用负债表中会难以理解和维护。

新增独立导航模块“房贷公积金”。模块负责房贷与公积金的专属计划、执行和决策；它不复制资产、负债和流水数据：贷款余额仍计入家庭负债，实际银行卡扣款仍是交易流水，公积金账户余额仍计入家庭资产与资金安全。

### 目标

- 清楚展示本期应还、已还、还款来源、下次还款日和剩余贷款。
- 原生支持商业贷、公积金贷及组合贷。
- 记录并预测公积金账户可用于冲还贷的金额。
- 基于真实贷款规则生成还款计划，并在实际扣款后完成对账。
- 对提前还款给出可解释的模拟结果，同时提示流动性影响。

### 非目标（首版不做）

- 连接银行、公积金中心或征信系统，自动获取余额、利率、账单或扣款结果。
- 自动替用户执行还款、提取公积金或发起贷款变更。
- 提供个性化理财建议或替代银行的提前还款审批规则。
- 精确覆盖所有银行的罚息、计息日、提前还款次数与最低金额规则；首版以用户填写的规则和模拟假设为准。

## 2. 信息架构与入口

一级导航新增：

```text
报表｜支出｜收入｜财务盘点｜房贷公积金｜日历｜健康｜设置
```

模块包含四个页签：

| 页签 | 解决的问题 | 首版范围 |
| --- | --- | --- |
| 概览 | 本月要还多少、由谁出、余额还有多少 | 必做 |
| 还款计划 | 每期应还与实际还款是否一致 | 必做 |
| 提前还款 | 多还一笔钱后的月供、期限、利息变化 | 必做 |
| 公积金账户 | 公积金余额、冲还贷与余额变动 | 必做 |

“财务盘点 > 负债”保留所有负债。在其中将房贷条目显示为“由房贷公积金模块管理”，提供跳转入口；普通负债继续在原页维护。

## 3. 核心概念与业务规则

### 3.1 房贷、贷款分段与还款期

- **房贷（Mortgage）**：一笔融资方案；可由 1 至 3 个贷款分段组成。
- **贷款分段（MortgageLoanPart）**：商业贷或公积金贷，每段独立拥有本金、年利率、期限、还款方式和剩余本金。
- **还款期（MortgageInstallment）**：某月某笔房贷的计划账单；汇总全部贷款分段的本金、利息和应还金额。
- **还款资金分摊（MortgagePaymentAllocation）**：实际还款期的资金来源明细，如“张三公积金月冲 2,000 元 + 招商银行卡 5,300 元”。

组合贷须拆成至少一个 `commercial` 分段和一个 `providentFund` 分段。页面可按房贷汇总，但计算、提前还款和余额必须按分段进行。

### 3.2 上海公积金账户与冲还贷

首版仅支持上海市公积金中心的“提取住房公积金归还个人住房贷款”规则，并在页面标示规则版本和生效日期。系统计算只用于家庭账务预测与核对，不替代公积金中心或贷款银行的最终核算。

- 公积金账户归属于家庭成员，分别记录**基本公积金**和**补充公积金**余额、月缴存额及最近更新日；余额属于资产，不是收入。
- 支持上海的两种冲还贷方式：
  - **月冲（逐月还款法）**：每月提取一次可用余额，金额不高于当月应还贷款本息。
  - **年冲（一次性还款法）**：每年按系统确定的 4 月或 9 月批次提取一次可用余额，金额不高于当月剩余贷款本息；系统不可自定义年冲日期。
- 只有已正常还款至少一期且未结清的本市公积金贷款或合作银行商业性购房贷款才可启用；组合贷的两段必须用于同一套住房。
- 参还人角色仅允许“借款人、借款人配偶、借款人父母/子女”；扣款顺序固定为借款人 → 配偶 → 父母/子女。同一参还人固定先扣基本公积金、余额不足时再扣补充公积金；两个账户各保留 0.01 元。
- 提取金额优先归还公积金贷，再归还商业贷。即使启用冲还贷，借款人仍须确保银行还款账户资金充足；最后一期默认不计划冲还，除非用户依据银行结果手动确认。
- 方式变更仅在原方式执行满一年后允许；终止提取还贷后一年内不允许再次启用。系统据此校验并展示提醒，但以用户在官方渠道的实际办理结果为准。
- 公积金提取、补缴和余额校正作为账户流水记录，会影响账户余额，但不得创建普通收入交易。

规则依据：上海市公积金管理中心《[上海市提取住房公积金归还个人住房贷款实施细则（沪公积金〔2023〕40号）](https://www.shzfgjj.cn/html/newxxgk/zcwj/gjjgwh/albpl/dk/215419.html)》。规则可能调整；上线时在设置页展示“规则最后核验日期”，并将该规则版本写入冲还贷设置记录。

### 3.3 应还与实还分离

计划与实际必须分离：系统先按贷款参数生成“应还”，再登记“实还”。一笔实际还款可以有多个资金来源，也可以关联一笔或多笔导入交易。

每期状态：

| 状态 | 定义 |
| --- | --- |
| `upcoming` | 尚未到还款日，未登记实还 |
| `due` | 已到还款日，未足额登记 |
| `partial` | 已登记金额小于应还 |
| `paid` | 已登记金额达到应还，待/已核对余额 |
| `exception` | 实还、日期、剩余本金或拆分与计划存在需人工确认的差异 |

实际还款确认后：

1. 减少对应贷款分段的剩余本金；
2. 写入现有 `LiabilityRepayment` 历史记录和该月负债快照；
3. 若有银行卡支付，关联或创建一笔现有 `FinanceTransaction` 支出；
4. 若有公积金冲抵，写入公积金账户事件并扣减账户余额；
5. 更新该期的匹配与确认状态。

上述步骤需在同一数据库事务中完成；撤销确认时应可逆转所有上述写入。

### 3.4 利率调整与提前还款

- 每个贷款分段维护**利率历史**，而非仅保存当前年利率。历史记录须包括年利率、生效日、来源（贷款合同、LPR 重定价、上海公积金政策、银行通知、人工校正）、凭证备注和录入时间；历史已确认期不得因后续调整而改写。
- 商业贷支持固定利率与 LPR 浮动利率：
  - 固定利率仅允许通过“银行合同变更”登记新利率，并从指定生效期重算未确认计划。
  - LPR 浮动利率保存 `5 年期 LPR + 加点值`、合同约定重定价周期、重定价日和取值月份；在重定价日按最近一个月的 5 年期以上 LPR 形成新利率。LPR 和加点值均可按银行通知人工录入，首版不自动抓取。
  - 系统展示“下次重定价日、当前 LPR、当前加点、预计新利率、与当前月供差额”；用户确认前只生成预览，不改变计划。
- 公积金贷使用上海政策利率表：按首套/第二套及贷款期限（5 年及以下、5 年以上）匹配利率；新政策可设置“新发放贷款生效日”和“存量未到期贷款生效日”。预置沪公积金〔2025〕17 号：2025-05-08 后发放贷款按新利率执行，已发放未到期贷款自 2026-01-01 起执行。后续规则变动通过新增政策版本处理，禁止直接覆盖旧版本。
- 每次利率调整必须生成“调整预览”：展示旧/新利率、受影响起始期、调整前后月供、剩余总利息和结清日期；只有用户确认“已收到银行/中心通知”后，才从首个未确认期重算计划。
- 计划重算采用当前剩余本金和实际剩余期数。等额本息的默认行为是**期限不变、重算月供**；若银行实际采用不同规则，允许选择“以银行新计划为准”并导入/手工录入受影响期金额，同时保留差异原因。
- 提前还款模拟必须要求选择：目标分段、金额、生效日期、方案（减少月供 / 缩短期限）；模拟使用所选日期已生效的利率版本。
- 模拟结果基于当前剩余本金、当前利率、还款方式和剩余期数；页面明确标注“估算，不含银行违约金和日息差异”。
- 提前还款确认不应直接改写计划，须先创建一笔实际还款并展示确认摘要。

规则依据：[中国人民银行公告〔2024〕第11号](https://www.pbc.gov.cn/chubanwu/114566/114579/5358353/5540955/2024122310475773688.pdf)允许浮动利率个人住房贷款与银行协商重定价周期，并在重定价日采用最近一个月 LPR；[上海公积金〔2025〕17号](https://www.shzfgjj.cn/html/newxxgk/zcwj/gjjgwh/albpl/dk/227927.html)规定本市公积金贷款利率调整及存量贷款的执行日期。

## 4. 页面规格

### 4.1 概览

顶部指标卡：

- 本月总应还 / 已登记实还 / 待补金额。
- 下个还款日及距今天数。
- 剩余贷款：总计、商业贷、公积金贷。
- 公积金可用余额：按成员拆分；若启用月冲，显示在现有缴存假设下的预计覆盖月数。

主体内容：

- “本期还款”卡片：每笔房贷的应还、月冲、银行卡待扣、状态和“登记还款”按钮。
- “贷款构成”卡片：按房贷、贷款分段显示余额、当前利率、利率生效日、下次重定价日、剩余期数、月供和已还比例；可打开利率历史。
- “提醒”卡片：未来 30 天还款、月冲余额不足、未匹配账单、LPR 重定价临近、待确认的公积金政策利率调整。
- “利率调整”抽屉：按分段展示调整预览及银行/中心通知信息，支持确认应用、撤销尚未产生实还的调整和“以银行新计划为准”的手工覆盖。
- “资金安全影响”卡片：复用现有资金安全计算，展示未来 30 天房贷银行卡现金支出；公积金冲抵不计入可用现金流出。

空状态应引导“新增房贷”并解释组合贷需拆分为商贷和公积金贷。

### 4.2 还款计划

支持按房贷、年份、状态筛选。表格字段：期数、应还日、商业贷本金/利息、公积金贷本金/利息、总应还、公积金冲抵、银行卡实扣、差异、状态、操作。

操作：

- 登记还款：输入或从候选交易中选择实际扣款；系统默认预填本期计划。
- 拆分来源：支持添加“银行卡支付”“公积金月冲”“公积金年冲”“其他”多行分摊；总额必须等于实还总额。
- 匹配导入账单：根据日期（±5 天）、金额、账户、备注关键词候选匹配；仅推荐，不自动确认。
- 余额校验：可填写银行 App 中的实际剩余本金；与计划差异超过 1 元时标为异常并允许“以银行余额为准”校正后续计划。
- 撤销已确认还款：只能按最近至最早顺序撤销，避免破坏后续余额和计划。

### 4.3 提前还款

输入区域：房贷、目标分段（可多选）、金额、拟还日期、减少月供/缩短期限、公积金或现金来源。

输出区域：

- 提前还款前后：总利息、总月供、预计结清日期、各分段余额。
- 节省利息与缩短期数。
- 现金流影响：使用现金后可用流动资金、应急金覆盖月数、未来 30 天安全可支配金额。
- 公积金来源时：冲抵后账户余额与预计月冲覆盖月数。
- 风险提示：余额不足、金额超过本金、未选择目标分段、预计银行规则可能不一致。

模拟不会保存。点击“按此方案登记提前还款”进入还款登记抽屉，二次确认后才变更数据。

### 4.4 公积金账户

**公积金账户区**：成员、基本公积金余额、补充公积金余额、各自月缴存额、更新日期、启用状态；支持新增、编辑和余额事件列表。账户界面固定显示“上海”，不提供城市选择。

**冲还贷设置区**：选择房贷、月冲/年冲方式、参还人和法定角色、年冲批次；扣款优先级和基本/补充公积金顺序由上海规则自动确定，不允许用户编辑。首版每笔房贷仅允许一条启用的设置；创建时展示资格与限制条件的勾选确认。

## 5. 数据模型

继续保留现有 `Liability(type=mortgage)` 作为净资产、月度快照和通用负债报表的兼容锚点。新增如下实体；金额均使用 `Decimal(18,2)`，日期采用无时区的业务日期语义。

```text
Mortgage
  id, familyId, liabilityId (unique), name, lender,
  repaymentDay, status(active|paidOff|closed), note?, createdAt, updatedAt

MortgageLoanPart
  id, mortgageId, kind(commercial|providentFund), name, initialPrincipal,
  outstandingPrincipal, rateType(fixed|lprFloating|providentFundPolicy),
  occupancyType?(first|second), lprTerm='5Y', lprSpread?,
  repricingCycleMonths?, repricingDate?, currentRateVersionId,
  repaymentMethod(equalPrincipalAndInterest|equalPrincipal),
  firstRepaymentDate, totalPeriods, remainingPeriods, createdAt, updatedAt

MortgageLoanRateVersion
  id, loanPartId, annualRate, effectiveDate,
  source(contract|lprRepricing|shanghaiProvidentFundPolicy|bankNotice|manualCorrection),
  lprValue?, lprPublishedMonth?, policyVersion?, evidenceNote?, createdAt

MortgageRateAdjustment
  id, mortgageId, loanPartId, rateVersionId, status(draft|applied|reverted),
  affectedFromSequence, oldAnnualRate, newAnnualRate, oldMonthlyPayment?, newMonthlyPayment?,
  oldRemainingInterest?, newRemainingInterest?, confirmedAt?, createdAt, updatedAt

ProvidentFundAccount
  id, familyId, memberId, city='Shanghai', basicBalance, supplementaryBalance,
  basicMonthlyContribution?, supplementaryMonthlyContribution?, balanceUpdatedOn,
  isActive, note?, createdAt, updatedAt

ProvidentFundContributionRate
  id, accountId, effectiveMonth, basicMonthlyContribution,
  supplementaryMonthlyContribution, source(annualAdjustment|employmentChange|manualCorrection),
  note?, createdAt, updatedAt,
  unique(accountId, effectiveMonth)

ProvidentFundBalanceEvent
  id, accountId, fundType(basic|supplementary), date,
  type(initial|contribution|withdrawal|repaymentOffset|adjustment), amount,
  balanceAfter?, note?, mortgagePaymentAllocationId?, createdAt

MortgageRepaymentSetting
  id, mortgageId (unique), city='Shanghai', mode(none|monthlyOffset|annualOffset),
  annualBatch?(april|september), activatedOn, lastModeChangedOn?, terminatedOn?,
  isActive, createdAt, updatedAt

MortgageRepaymentParticipant
  id, settingId, providentFundAccountId, role(borrower|spouse|parentOrChild), sequence,
  isConfirmed, createdAt, updatedAt

MortgageInstallment
  id, mortgageId, sequence, dueDate, status,
  plannedPrincipal, plannedInterest, plannedAmount,
  actualPrincipal?, actualInterest?, actualAmount?, confirmedAt?, note?,
  unique(mortgageId, sequence)

MortgageInstallmentPart
  id, installmentId, loanPartId, plannedPrincipal, plannedInterest,
  actualPrincipal?, actualInterest?

MortgagePaymentAllocation
  id, installmentId, source(bankAccount|providentFundMonthly|providentFundAnnual|other),
  amount, date, accountId?, providentFundAccountId?, transactionId?, note?
```

设计约束：

- `Mortgage.liabilityId` 一对一关联既有 `Liability`；每次确认或校正计划后，同步该负债的 `currentBalance`、`monthlyPayment`、`paymentDay` 和 `remainingPeriods`。
- `FinanceTransaction` 建议新增可空的 `mortgagePaymentAllocationId`，使导入账单的支付侧可追溯地关联到分摊；一个分摊至多关联一笔交易。
- 所有新增表均增加 `familyId` 直接索引或可通过父级严格限定家庭范围；所有读取和写入均须验证家庭归属。
- 不要仅存储生成后的整张计划：应保留计算参数和每期结果，利率/余额校正后从影响期开始重新生成，历史已确认期不可重算。
- 公积金月缴存额使用版本表维护，不能覆盖历史值。上海年度调整记录以每年 `YYYY-07` 生效；预测时按目标月份选取不晚于该月的最新版本。6 月 30 日结息、月冲扣款和其他提取仅作为余额事件，不改变缴存额版本。

## 6. 接口草案

接口放在新的 `MortgageModule` 下，路径前缀为 `/api/mortgages`；权限沿用当前登录家庭。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/mortgages/overview?month=YYYY-MM` | 概览指标、提醒与本期摘要 |
| `GET` | `/mortgages` | 房贷列表及贷款分段 |
| `POST` | `/mortgages` | 创建房贷、关联通用负债并生成计划 |
| `PATCH` | `/mortgages/:id` | 更新基础资料；参数变动时返回受影响计划预览 |
| `GET` | `/mortgages/:id/installments?year=YYYY` | 分页或按年获取计划 |
| `POST` | `/mortgages/:id/installments/:sequence/confirm` | 登记并确认当期实还与资金分摊 |
| `POST` | `/mortgages/:id/installments/:sequence/revert` | 撤销最近一期确认 |
| `POST` | `/mortgages/:id/reconcile-principal` | 以银行剩余本金校准未来计划 |
| `POST` | `/mortgages/:id/rate-adjustments/preview` | 基于 LPR、政策或银行通知生成未持久化调整预览 |
| `POST` | `/mortgages/:id/rate-adjustments/:id/apply` | 确认利率版本并从首个未确认期重算计划 |
| `POST` | `/mortgages/:id/rate-adjustments/:id/revert` | 撤销未产生实还的已应用利率调整 |
| `POST` | `/mortgages/:id/prepayment-simulations` | 计算但不持久化提前还款方案 |
| `GET/POST/PATCH` | `/provident-fund-accounts` | 上海公积金账户管理 |
| `POST` | `/provident-fund-accounts/:id/events` | 提取、补缴、校正或冲抵记录 |

所有写入接口返回更新后的房贷概览摘要，便于前端一次刷新相关指标。参数校验应复用现有金额、日期、成员和账户校验方式。

## 7. 计算规则

### 7.1 还款计划

- 等额本息：按月利率 `annualRate / 12`、剩余本金和剩余期数计算固定月供；每期利息按剩余本金乘月利率，本金为月供减利息，末期进行分级舍入校正。
- 等额本金：每期本金为初始本金除以总期数；利息按当期剩余本金乘月利率，因此月供逐期递减。
- 金额以分为最小单位计算和存储；最后一期以清零为准，避免累计舍入留下负数或尾差。
- 组合贷的房贷总额为各有效分段之和；本期总应还为各分段计划之和。
- 每期计划使用其应还日对应的有效利率版本；利率调整仅重算首个未确认期及以后。调整前已确认期的利率、本金、利息和实还金额不可变更。
- 若同一还款期包含不同利率生效区间，系统默认以贷款银行提供的新还款计划为准；未导入银行计划前，显示“需核对”，不得将估算差异自动记为逾期或实还差额。

### 7.2 公积金覆盖预测

在当前基本/补充余额和各自月缴存额不变的假设下，逐月按上海提取顺序计算：

```text
每个参还人可用余额 = max(0, 基本余额 - 0.01) + max(0, 补充余额 - 0.01)
月冲金额 = min(当月应还贷款本息, 按法定顺序累加的参还人可用余额)
先抵公积金贷，再抵商业贷；每位参还人先扣基本余额、后扣补充余额
期末基本/补充余额 = max(0.01, 期初余额 + 对应月缴存额 - 对应冲抵额)
```

年冲仅在设置的 4 月或 9 月批次计算，金额不超过该月剩余贷款本息。系统应标记为“预计批次”，具体受理、余额截止与扣款日期以中心当月公布计划为准。当余额不足以覆盖计划冲抵时，提醒本月及后续月份的缺口；该预测只用于提醒，不生成正式交易。

### 7.3 财务联动

- 月供收入比：使用“未来或当月银行卡实际现金支出 ÷ 家庭月收入”；公积金冲抵单列展示，避免混淆可支配现金。
- 总负债：取所有关联 `Liability` 的当前余额；不重复将贷款分段加入总负债。
- 日历：将到期还款日和已确认还款显示为系统事件；日历仅做展示，不作为唯一数据源。

## 8. 迁移与兼容策略

1. 新增“房贷公积金”导航和后端模块，但不改变现有负债 API 行为。
2. 提供“从现有负债创建房贷”向导：仅列出 `type=mortgage` 的活跃负债，预填名称、银行、余额、月供、还款日和期数。
3. 向导要求补齐每个贷款分段的本金、利率、还款方式、首期还款日和总期数；不能由总余额直接推断历史计划。
4. 迁移成功后，将原负债标记为“由房贷模块管理”，原页只读展示核心指标与跳转链接；历史还款记录保留。
5. 暂不迁移的房贷继续按原通用负债使用。迁移必须可撤销，且撤销前需不存在已确认的房贷模块还款期。

## 9. MVP 交付拆分

### 第一阶段：数据与计算（后端优先）

- 新 Prisma 模型、迁移、家庭归属校验和审计日志。
- 创建 / 编辑房贷和贷款分段；从通用房贷负债迁移。
- 等额本息、等额本金、组合贷计划生成和单元测试。
- 商贷 LPR 重定价、公积金政策利率版本、利率调整预览与历史计划冻结。
- 公积金账户、余额事件和月冲计划计算。
- 概览、计划、还款确认、余额校准、提前还款模拟接口。

### 第二阶段：页面与联动

- 新导航、概览、还款计划、提前还款、公积金账户四页签。
- 通用负债页跳转及只读标识。
- 现有交易导入结果中提供候选匹配；还款确认写入交易与负债快照。
- 日历和资金安全的只读联动展示。

### 第三阶段：质量与上线

- 计划计算、提前还款、组合贷、公积金月冲/年冲、撤销确认、历史快照的单元与服务测试。
- 至少覆盖一条端到端流程：创建组合贷 → 设置月冲 → 确认一期还款 → 导入账单匹配 → 模拟并登记提前还款。
- 手机端验证：概览与本期还款可完整操作；长计划表可按年筛选或卡片显示。
- 更新 NAS 离线发布说明，明确 Prisma 数据迁移和备份顺序。

## 10. 验收标准

1. 用户可建立一笔仅商贷、仅公积金贷或“商贷 + 公积金贷”的房贷，且总额、月供、余额在概览中正确汇总。
2. 等额本息、等额本金计划的总本金与初始本金相等；最后一期剩余本金为 `0.00`，不存在尾差。
3. 用户可以为同一期还款拆分公积金冲抵与银行卡支付；分摊不等于实还总额时不能确认。
4. 确认还款后，贷款分段余额、关联通用负债余额、还款记录、负债快照、公积金余额和关联交易同步正确；撤销最近一期后恢复。
5. 组合贷的提前还款模拟可按指定分段计算，并分别展示“减少月供”和“缩短期限”的差异与假设提示。
6. LPR 重定价和上海公积金政策调整均可生成预览、保留利率版本，并且只重算未确认期；已确认期不受影响。
7. 上海月冲、年冲按参还人法定顺序、基本/补充账户顺序、各保留 0.01 元以及“公积金贷优先”规则计算；年冲仅允许 4 月或 9 月批次。
8. 公积金月冲预测能在余额将不足时给出月份和缺口，且不会将公积金抵扣误算为普通收入。
9. 房贷数据始终只可被同一家庭读取或修改；关联的成员、账户、交易和负债均进行家庭归属验证。
10. 在没有房贷资料的家庭中，模块展示明确的空状态，不影响现有报表、财务盘点、日历和资金安全页面。

## 11. 明确不纳入本模块的范围

- 不记录房产资料、购入价、估值、产权人、产权比例、共同借款人或实际付款比例。
- 首版不支持上海以外城市的公积金账户、冲还贷规则或自动计算。
