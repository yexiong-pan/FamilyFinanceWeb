import { BankOutlined, CalendarOutlined, FundOutlined, PlusOutlined, ReloadOutlined, WalletOutlined } from "@ant-design/icons";
import type { Account, FamilyMemberInfo, MortgageLoanPart, MortgageMonthlyRepayment, MortgagePlanningData, MortgageRecord, ProvidentFundAccount } from "@family-finance/shared";
import { buildFullMortgageInstallments, buildMortgageInstallments, formatMoney, mortgageRateAt } from "@family-finance/shared";
import { Alert, Button, Card, Col, DatePicker, Drawer, Empty, Flex, Form, Input, InputNumber, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyMortgageRateAdjustment,
  confirmMortgageMonthlyRepayment,
  createMortgage,
  getMortgageMonthlyRepayments,
  getMortgagePlanning,
  getMortgageOverview,
  getProvidentFundAccounts,
  previewMortgageRateAdjustment,
  saveProvidentFundAccount,
  saveProvidentFundContributionRate,
  saveMortgageProvidentFundParticipants,
  type MortgageOverview,
  type MortgageRateAdjustmentInput,
  type MortgageRateAdjustmentPreview
} from "./api/client";
import type { MortgageTabKey } from "./navigation";

const { Text } = Typography;

interface MortgagePageProps {
  monthKey: string;
  members: FamilyMemberInfo[];
  accounts: Account[];
  tab: MortgageTabKey;
  onTabChange: (tab: MortgageTabKey) => void;
}

export function MortgagePage({ monthKey, members, accounts, tab, onTabChange }: MortgagePageProps) {
  const [overview, setOverview] = useState<MortgageOverview | null>(null);
  const [planning, setPlanning] = useState<MortgagePlanningData | null>(null);
  const [fundAccounts, setFundAccounts] = useState<ProvidentFundAccount[]>([]);
  const [monthlyRepayments, setMonthlyRepayments] = useState<MortgageMonthlyRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [newMortgageOpen, setNewMortgageOpen] = useState(false);
  const [newFundOpen, setNewFundOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [contributionAccount, setContributionAccount] = useState<ProvidentFundAccount | null>(null);
  const [contributionDayAccount, setContributionDayAccount] = useState<ProvidentFundAccount | null>(null);
  const [repaymentToConfirm, setRepaymentToConfirm] = useState<MortgageMonthlyRepayment | null>(null);
  const [participantMortgage, setParticipantMortgage] = useState<MortgageRecord | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextOverview, nextFundAccounts, nextPlanning, nextMonthlyRepayments] = await Promise.all([
        getMortgageOverview(monthKey),
        getProvidentFundAccounts(),
        getMortgagePlanning(monthKey),
        getMortgageMonthlyRepayments(monthKey)
      ]);
      setOverview(nextOverview);
      setFundAccounts(nextFundAccounts);
      setPlanning(nextPlanning);
      setMonthlyRepayments(nextMonthlyRepayments);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "房贷数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => { void reload(); }, 60 * 60 * 1_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  const mortgages = overview?.mortgages ?? [];
  const content = tab === "overview"
    ? <OverviewTab overview={overview} accounts={fundAccounts} planning={planning} monthlyRepayments={monthlyRepayments} loading={loading} onAdd={() => setNewMortgageOpen(true)} onRate={() => setRateOpen(true)} onConfirm={setRepaymentToConfirm} />
    : tab === "plan"
      ? <PlanTab mortgages={mortgages} loading={loading} />
      : tab === "rates"
        ? <RatesTab mortgages={mortgages} loading={loading} onRate={() => setRateOpen(true)} />
        : <ProvidentTab accounts={fundAccounts} mortgages={mortgages} loading={loading} onAdd={() => setNewFundOpen(true)} onAdjust={setContributionAccount} onChangeContributionDay={setContributionDayAccount} onParticipants={setParticipantMortgage} />;

  return (
    <Space orientation="vertical" size={20} className="page-stack mortgage-page">
      {error ? <Alert type="error" showIcon title="加载失败" description={error} action={<Button size="small" onClick={() => void reload()}>重试</Button>} /> : null}
      <Flex justify="space-between" align="center" gap={12} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>房贷公积金</Typography.Title>
          <Text type="secondary">上海公积金冲还贷规则 · 应还计划、利率调整与账户余额</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void reload()}>刷新</Button>
      </Flex>
      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(key as MortgageTabKey)}
        items={[
          { key: "overview", label: "概览", children: content },
          { key: "plan", label: "还款计划", children: content },
          { key: "rates", label: "利率调整", children: content },
          { key: "provident", label: "公积金账户", children: content }
        ]}
      />
      <MortgageDrawer open={newMortgageOpen} members={members} onClose={() => setNewMortgageOpen(false)} onSaved={() => { setNewMortgageOpen(false); void reload(); }} />
      <ProvidentFundDrawer open={newFundOpen} members={members} onClose={() => setNewFundOpen(false)} onSaved={() => { setNewFundOpen(false); void reload(); }} />
      <ContributionRateDrawer account={contributionAccount} onClose={() => setContributionAccount(null)} onSaved={() => { setContributionAccount(null); void reload(); }} />
      <ContributionDayDrawer account={contributionDayAccount} onClose={() => setContributionDayAccount(null)} onSaved={() => { setContributionDayAccount(null); void reload(); }} />
      <RateAdjustmentDrawer open={rateOpen} mortgages={mortgages} onClose={() => setRateOpen(false)} onSaved={() => { setRateOpen(false); void reload(); }} />
      <MonthlyRepaymentDrawer repayment={repaymentToConfirm} bankAccounts={accounts} onClose={() => setRepaymentToConfirm(null)} onSaved={() => { setRepaymentToConfirm(null); void reload(); }} />
      <ParticipantDrawer mortgage={participantMortgage} accounts={fundAccounts} onClose={() => setParticipantMortgage(null)} onSaved={() => { setParticipantMortgage(null); void reload(); }} />
    </Space>
  );
}

function OverviewTab({ overview, accounts, planning, monthlyRepayments, loading, onAdd, onRate, onConfirm }: { overview: MortgageOverview | null; accounts: ProvidentFundAccount[]; planning: MortgagePlanningData | null; monthlyRepayments: MortgageMonthlyRepayment[]; loading: boolean; onAdd: () => void; onRate: () => void; onConfirm: (repayment: MortgageMonthlyRepayment) => void }) {
  if (!loading && !overview?.mortgages.length) return <Empty description="还没有房贷，新增后可查看组合贷、公积金和利率调整" ><Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增房贷</Button></Empty>;
  return (
    <Space orientation="vertical" size={20} className="page-stack mortgage-overview">
      <MortgageRunwayHero overview={overview} planning={planning} onRate={onRate} />
      <Row gutter={[16, 16]}>
        <MortgageMetric icon={<BankOutlined />} title="剩余本金" value={overview?.outstanding ?? "0.00"} />
        <MortgageMetric icon={<FundOutlined />} title="预计剩余利息" value={overview?.remainingInterest ?? "0.00"} />
        <MortgageMetric icon={<WalletOutlined />} title="预计剩余本息" value={overview?.remainingTotal ?? "0.00"} />
        <MortgageMetric icon={<CalendarOutlined />} title="本月应还" value={overview?.dueAmount ?? "0.00"} emphasis />
      </Row>
      <MonthlyRepaymentStatus repayments={monthlyRepayments} loading={loading} onConfirm={onConfirm} />
      <Card className="mortgage-surface-card" title="本月还款" extra={<Button onClick={onAdd}>新增房贷</Button>} loading={loading}>
        {overview?.due.length ? <Table rowKey={(item) => `${item.mortgagePartId}-${item.sequence}`} pagination={false} size="small" dataSource={overview.due} columns={[
          { title: "贷款分段", dataIndex: "mortgagePartName" }, { title: "应还日", dataIndex: "dueDate" },
          { title: "本金", dataIndex: "principal", align: "right", render: formatMoney }, { title: "利息", dataIndex: "interest", align: "right", render: formatMoney },
          { title: "应还", dataIndex: "amount", align: "right", render: (value) => <Text strong>{formatMoney(value)}</Text> },
          { title: "利率", dataIndex: "annualRate", align: "right", render: (value) => `${value}%` }
        ]} /> : <Text type="secondary">本月没有计划还款。</Text>}
      </Card>
      <Card className="mortgage-surface-card" title="贷款构成" extra={<Button onClick={onRate}>调整利率</Button>} loading={loading}>
        <LoanPartsTable mortgages={overview?.mortgages ?? []} compact />
      </Card>
      <MonthlyOffsetForecast accounts={accounts} mortgages={overview?.mortgages ?? []} planning={planning} loading={loading} />
      <StrategyComparison planning={planning} loading={loading} />
      {planning?.rateReminders.map((reminder) => <Alert className="mortgage-repricing-alert" key={`${reminder.loanPartName}-${reminder.repricingDate}`} type={reminder.daysUntil <= 90 ? "warning" : "info"} showIcon title={`${reminder.loanPartName} 将于 ${reminder.repricingDate} 重定价`} description={`${reminder.daysUntil > 0 ? `约 ${reminder.daysUntil} 天后` : "已到期"}，请在银行确认执行利率后登记利率调整。`} />)}
      <Alert type="info" showIcon title="上海规则" description="月冲按借款人、配偶、父母子女顺序扣款；同一参还人先扣基本公积金、后扣补充公积金，并各保留 0.01 元。实际扣款以公积金中心和贷款银行账单为准。" />
    </Space>
  );
}

function MortgageRunwayHero({ overview, planning, onRate }: { overview: MortgageOverview | null; planning: MortgagePlanningData | null; onRate: () => void }) {
  const coverage = planning?.monthlyOffsetCoverage;
  const startMonth = planning?.monthlyOffset[0]?.month;
  const runwayMonths = coverage && startMonth ? monthDistance(startMonth, coverage.fullOffsetThrough) + 1 : 0;
  const selfFundAmount = planning?.monthlyOffset[0]?.selfFundAmount ?? "0.00";
  const runwayState = Number(selfFundAmount) > 0 ? "is-danger" : runwayMonths > 12 ? "is-safe" : "is-warning";
  const remainingDuration = runwayMonths > 0 ? `剩余${Math.floor(runwayMonths / 12)}年${runwayMonths % 12}月` : "本期需补款";
  return <section className={`mortgage-runway-hero ${runwayState}`}>
    <div className="mortgage-runway-content">
      <Text className="mortgage-runway-eyebrow">本月月冲续航</Text>
      <div className="mortgage-runway-number">
        <span className="mortgage-runway-count">
          <span className="mortgage-runway-value">{runwayMonths}</span>
          <span className="mortgage-runway-unit">个月</span>
        </span>
        <Text className="mortgage-runway-duration">{remainingDuration}</Text>
      </div>
      <div className="mortgage-runway-summary">预计可全额月冲至 {coverage?.fullOffsetThrough ?? "—"}</div>
      <div className="mortgage-runway-details">
        <span>本月应还 <strong>{formatMoney(overview?.dueAmount ?? "0.00")}</strong></span>
        <span>银行卡补款 <strong>{formatMoney(selfFundAmount)}</strong></span>
      </div>
    </div>
    <div className="mortgage-runway-aside">
      <Button className="mortgage-runway-action" onClick={onRate}>管理利率</Button>
    </div>
  </section>;
}

function MonthlyRepaymentStatus({ repayments, loading, onConfirm }: { repayments: MortgageMonthlyRepayment[]; loading: boolean; onConfirm: (repayment: MortgageMonthlyRepayment) => void }) {
  const hasEstimate = repayments.some((item) => item.status !== "confirmed");
  return <Card className="mortgage-surface-card" title="本期还款" loading={loading} extra={<Text type="secondary">预计值在确认后以账单为准</Text>}>
    {repayments.length ? <Table rowKey={(item) => item.id ?? `${item.mortgageId}-${item.month}`} pagination={false} size="small" dataSource={repayments} expandable={{
      rowExpandable: (item) => item.providentFundTransactions.length > 0,
      expandedRowRender: (item) => <Space orientation="vertical" size={4}>{item.providentFundTransactions.map((transaction) => <div key={transaction.accountId}><Text strong>{transaction.memberName}</Text><Text type="secondary">　{item.status === "confirmed" ? "缴存" : "预计缴存"}：基本 {formatMoney(transaction.basicContribution)} / 补充 {formatMoney(transaction.supplementaryContribution)}；{item.status === "confirmed" ? "月冲" : "预计月冲"}：基本 {formatMoney(transaction.basicOffset)} / 补充 {formatMoney(transaction.supplementaryOffset)}</Text></div>)}</Space>
    }} columns={[
      { title: "房贷", dataIndex: "mortgageName" },
      { title: "还款日", dataIndex: "dueDate" },
      { title: "应还", dataIndex: "totalAmount", align: "right", render: formatMoney },
      { title: hasEstimate ? "预计公积金月冲" : "公积金月冲", dataIndex: "providentFundOffset", align: "right", render: formatMoney },
      { title: hasEstimate ? "预计银行卡补款" : "银行卡补款", dataIndex: "selfFundAmount", align: "right", render: formatMoney },
      { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "confirmed" ? "green" : value === "pending" ? "gold" : "blue"}>{value === "confirmed" ? "已确认" : value === "pending" ? "待确认" : "待还款"}</Tag> },
      { title: "操作", render: (_value, item: MortgageMonthlyRepayment) => item.status === "pending" ? <Button type="primary" size="small" onClick={() => onConfirm(item)}>确认实际还款</Button> : item.status === "scheduled" ? <Text type="secondary">{item.dueDate.slice(5)} 后可确认</Text> : <Text type="secondary">{item.confirmedAt?.slice(0, 10)}</Text> }
    ]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本月没有还款计划" />}
  </Card>;
}

function MortgageMetric({ icon, title, value, emphasis = false }: { icon: ReactNode; title: string; value: string; emphasis?: boolean }) {
  return <Col xs={12} lg={6}><Card className={`mortgage-metric-card${emphasis ? " is-emphasis" : ""}`}><div className="mortgage-metric-icon">{icon}</div><Statistic title={title} value={formatMoney(value)} /></Card></Col>;
}

function MonthlyOffsetForecast({ accounts, mortgages, planning, loading }: { accounts: ProvidentFundAccount[]; mortgages: MortgageRecord[]; planning: MortgagePlanningData | null; loading: boolean }) {
  const coverage = planning?.monthlyOffsetCoverage;
  const coverageText = coverage?.endsBecause === "loanPaidOff"
    ? `预计可全额月冲至贷款结清（${coverage.fullOffsetThrough}）`
    : `预计可全额月冲至 ${coverage?.fullOffsetThrough}，${coverage?.firstSelfFundMonth} 起需银行卡补款`;
  return <Card title="未来 60 个月月冲预测" loading={loading} extra={<Text type="secondary">余额按每月缴存额滚动</Text>}>
    {coverage ? <Alert type={coverage.endsBecause === "loanPaidOff" ? "success" : "warning"} showIcon title={coverageText} style={{ marginBottom: 16 }} /> : null}
    <MonthlyOffsetCalculator accounts={accounts} mortgages={mortgages} planning={planning} />
    {planning?.monthlyOffset.length ? <Table rowKey="month" pagination={{ pageSize: 12, showSizeChanger: false, showQuickJumper: true, showTotal: (total) => `共 ${total} 个月` }} size="small" scroll={{ x: 900 }} dataSource={planning.monthlyOffset} columns={[
      { title: "月份", dataIndex: "month" }, { title: "当月应还", dataIndex: "dueAmount", align: "right", render: formatMoney },
      { title: "预计月冲", dataIndex: "providentFundOffset", align: "right", render: formatMoney }, { title: "银行卡补款", dataIndex: "selfFundAmount", align: "right", render: (value) => <Text strong>{formatMoney(value)}</Text> },
      { title: "冲后公积金余额", dataIndex: "participantBalances", render: (balances) => <Space size={4} wrap>{balances.map((balance: { memberName: string; basicBalance: string; supplementaryBalance: string }) => <Tag key={balance.memberName}>{balance.memberName}：{formatMoney((Number(balance.basicBalance) + Number(balance.supplementaryBalance)).toFixed(2))}</Tag>)}</Space> }
    ]} /> : <Empty description="维护公积金账户后可生成月冲预测" />}
  </Card>;
}

function MonthlyOffsetCalculator({ accounts, mortgages, planning }: { accounts: ProvidentFundAccount[]; mortgages: MortgageRecord[]; planning: MortgagePlanningData | null }) {
  const [monthlyContributionOverride, setMonthlyContributionOverride] = useState<number>();
  const activeAccounts = accounts.filter((account) => account.isActive);
  const availableBalance = activeAccounts.reduce((total, account) => total + Math.max(0, Number(account.basicBalance) - 0.01) + Math.max(0, Number(account.supplementaryBalance) - 0.01), 0);
  const defaultContribution = activeAccounts.reduce((total, account) => total + Number(account.basicMonthlyContribution ?? "0") + Number(account.supplementaryMonthlyContribution ?? "0"), 0);
  const monthlyContribution = monthlyContributionOverride ?? defaultContribution;
  const monthlyPayment = Number(planning?.monthlyOffset[0]?.dueAmount ?? "0");
  const coverageMonths = useMemo(() => estimateOffsetCoverage(accounts, mortgages, planning, monthlyContributionOverride), [accounts, mortgages, planning, monthlyContributionOverride]);
  const startMonth = planning?.monthlyOffset[0]?.month;
  const coverageEnd = coverageMonths == null || !startMonth || coverageMonths === 0 ? undefined : addMonthsToMonth(startMonth, coverageMonths - 1);
  const result = monthlyPayment <= 0
    ? "暂无当月应还数据"
    : coverageMonths == null
      ? "按缴存日和当前还款计划，可持续月冲至贷款结清"
      : coverageMonths === 0 ? "当前可用余额不足以完成一期全额月冲" : `预计可全额月冲约 ${coverageMonths} 个月，至 ${coverageEnd}`;
  return <Card type="inner" size="small" title="月冲续航计算器" style={{ marginBottom: 16 }}>
    <Flex gap={16} align="center" wrap>
      <div><Text type="secondary">可用公积金余额</Text><br /><Text strong>{formatMoney(availableBalance.toFixed(2))}</Text></div>
      <div><Text type="secondary">当前组合贷月供</Text><br /><Text strong>{formatMoney(monthlyPayment.toFixed(2))}</Text></div>
      <div><Text type="secondary">每月公积金缴存总额</Text><br /><Space size={6}><InputNumber min={0} precision={2} value={monthlyContribution} onChange={(value) => setMonthlyContributionOverride(value == null ? 0 : Number(value))} /><Text type="secondary">元/月</Text></Space></div>
      <Tag color={coverageMonths == null ? "green" : "blue"}>{result}</Tag>
    </Flex>
  </Card>;
}

function addMonthsToMonth(month: string, offset: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, value! - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function estimateOffsetCoverage(
  accounts: ProvidentFundAccount[],
  mortgages: MortgageRecord[],
  planning: MortgagePlanningData | null,
  contributionOverride?: number
): number | null | undefined {
  const startMonth = planning?.monthlyOffset[0]?.month;
  if (!startMonth) return undefined;
  if (contributionOverride == null) {
    const coverage = planning?.monthlyOffsetCoverage;
    return coverage?.endsBecause === "loanPaidOff" ? null : Math.max(0, monthDistance(startMonth, coverage?.fullOffsetThrough ?? startMonth) + 1);
  }
  const activeAccounts = accounts.filter((account) => account.isActive);
  const defaultTotal = activeAccounts.reduce((sum, account) => sum + Number(account.basicMonthlyContribution ?? 0) + Number(account.supplementaryMonthlyContribution ?? 0), 0);
  const states = new Map(activeAccounts.map((account) => [account.id, {
    account,
    balance: Math.max(0, Number(account.basicBalance) - 0.01) + Math.max(0, Number(account.supplementaryBalance) - 0.01),
    updatedOn: account.balanceUpdatedOn,
    contribution: defaultTotal > 0
      ? contributionOverride * (Number(account.basicMonthlyContribution ?? 0) + Number(account.supplementaryMonthlyContribution ?? 0)) / defaultTotal
      : contributionOverride / Math.max(1, activeAccounts.length)
  }]));
  const events = mortgages.flatMap((mortgage) => {
    const firstKnown = planning.monthlyOffset.flatMap((row) => row.repaymentEvents).find((event) => event.mortgageId === mortgage.id);
    const firstMonth = firstKnown?.dueDate.slice(0, 7) ?? startMonth;
    const firstDate = `${firstMonth}-${String(Math.min(mortgage.repaymentDay, daysInMonth(firstMonth))).padStart(2, "0")}`;
    const partPlans = mortgage.loanParts.map((part) => buildFullMortgageInstallments({
      initialPrincipal: part.outstandingPrincipal,
      repaymentMethod: part.repaymentMethod,
      totalPeriods: part.remainingPeriods,
      firstRepaymentDate: firstDate,
      rateVersions: part.rateVersions
    }));
    return Array.from({ length: Math.max(0, ...partPlans.map((plan) => plan.length)) }, (_, index) => ({
      mortgage,
      dueDate: addMonthsToDate(firstDate, index),
      amount: partPlans.reduce((sum, plan) => sum + Number(plan[index]?.amount ?? 0), 0)
    }));
  }).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.mortgage.id.localeCompare(right.mortgage.id));
  for (const event of events) {
    let remaining = event.amount;
    for (const participant of [...event.mortgage.providentFundParticipants].filter((item) => item.isActive).sort((left, right) => left.priority - right.priority)) {
      const state = states.get(participant.accountId);
      if (!state) continue;
      for (let month = state.updatedOn.slice(0, 7); month <= event.dueDate.slice(0, 7); month = addMonthsToMonth(month, 1)) {
        const contributionDate = `${month}-${String(Math.min(state.account.monthlyContributionDay, daysInMonth(month))).padStart(2, "0")}`;
        if (contributionDate > state.updatedOn && contributionDate <= event.dueDate) state.balance += state.contribution;
      }
      state.updatedOn = event.dueDate;
      const offset = Math.min(remaining, state.balance);
      state.balance -= offset;
      remaining -= offset;
      if (remaining <= 0.005) break;
    }
    if (remaining > 0.005) return Math.max(0, monthDistance(startMonth, event.dueDate.slice(0, 7)));
  }
  return null;
}

function addMonthsToDate(value: string, offset: number): string {
  const targetMonth = addMonthsToMonth(value.slice(0, 7), offset);
  return `${targetMonth}-${String(Math.min(Number(value.slice(8, 10)), daysInMonth(targetMonth))).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, value!, 0)).getUTCDate();
}

function StrategyComparison({ planning, loading }: { planning: MortgagePlanningData | null; loading: boolean }) {
  return <Card title="年冲与提前还款方案" loading={loading}>
    {planning?.strategies.length ? <Table rowKey="name" pagination={false} size="small" scroll={{ x: 940 }} dataSource={planning.strategies} columns={[
      { title: "方案", dataIndex: "name" }, { title: "一次性金额", dataIndex: "oneOffAmount", align: "right", render: formatMoney },
      { title: "调整后月供", dataIndex: "estimatedMonthlyPayment", align: "right", render: formatMoney }, { title: "预计剩余利息", dataIndex: "remainingInterest", align: "right", render: formatMoney }, { title: "预计节省利息", dataIndex: "interestSaved", align: "right", render: (value) => <Text strong>{formatMoney(value)}</Text> },
      { title: "说明", dataIndex: "note" }
    ]} /> : <Empty description="维护公积金账户后可测算方案" />}
  </Card>;
}

function PlanTab({ mortgages, loading }: { mortgages: MortgageRecord[]; loading: boolean }) {
  const rows = useMemo(() => mortgages.flatMap((mortgage) => mortgage.loanParts.flatMap((part) => buildFullMortgageInstallments({
    initialPrincipal: part.initialPrincipal, repaymentMethod: part.repaymentMethod, totalPeriods: part.totalPeriods,
    firstRepaymentDate: part.firstRepaymentDate, rateVersions: part.rateVersions, actualRepayments: part.actualRepayments,
    forecastOutstandingPrincipal: part.outstandingPrincipal
  }).map((installment) => ({ key: `${part.id}-${installment.sequence}`, mortgage: mortgage.name, part: part.name, ...installment }))))
    .sort((left, right) => left.sequence - right.sequence || left.dueDate.localeCompare(right.dueDate) || left.part.localeCompare(right.part)), [mortgages]);
  return <Card title="完整还款计划" loading={loading} extra={<Text type="secondary">实际账单优先，未补录期数为计划值</Text>}>{rows.length ? <Table rowKey="key" size="small" scroll={{ x: 960 }} dataSource={rows} columns={[
    { title: "房贷", dataIndex: "mortgage" }, { title: "分段", dataIndex: "part" }, { title: "期数", dataIndex: "sequence" }, { title: "应还日", dataIndex: "dueDate" },
    { title: "本金", dataIndex: "principal", align: "right", render: formatMoney }, { title: "利息", dataIndex: "interest", align: "right", render: formatMoney }, { title: "应还", dataIndex: "amount", align: "right", render: formatMoney }, { title: "年利率", dataIndex: "annualRate", align: "right", render: (value) => `${value}%` },
    { title: "数据来源", dataIndex: "status", render: (value) => <Tag color={value === "paid" ? "green" : "default"}>{value === "paid" ? "实际已还" : "计划"}</Tag> }
  ]} /> : <Empty description="新增房贷后自动生成完整还款计划" />}</Card>;
}

function RatesTab({ mortgages, loading, onRate }: { mortgages: MortgageRecord[]; loading: boolean; onRate: () => void }) {
  return <Card title="利率历史" loading={loading} extra={<Button type="primary" onClick={onRate}>登记利率调整</Button>}><LoanPartsTable mortgages={mortgages} showRates /></Card>;
}

function ProvidentTab({ accounts, mortgages, loading, onAdd, onAdjust, onChangeContributionDay, onParticipants }: { accounts: ProvidentFundAccount[]; mortgages: MortgageRecord[]; loading: boolean; onAdd: () => void; onAdjust: (account: ProvidentFundAccount) => void; onChangeContributionDay: (account: ProvidentFundAccount) => void; onParticipants: (mortgage: MortgageRecord) => void }) {
  return <Space orientation="vertical" size={16} className="full-width"><Card title="月冲参还设置" loading={loading}>
    {mortgages.length ? <Table rowKey="id" pagination={false} dataSource={mortgages} columns={[
      { title: "房贷", dataIndex: "name" },
      { title: "参还人及扣款顺序", key: "participants", render: (_value, mortgage: MortgageRecord) => <Space size={4} wrap>{mortgage.providentFundParticipants.filter((item) => item.isActive).sort((left, right) => left.priority - right.priority).map((item) => <Tag key={item.accountId}>{item.priority + 1}. {item.memberName} · {participantRoleLabel(item.role)}</Tag>)}</Space> },
      { title: "操作", key: "action", render: (_value, mortgage: MortgageRecord) => <Button type="link" onClick={() => onParticipants(mortgage)}>设置参还顺序</Button> }
    ]} /> : <Empty description="新增房贷后可设置参还人" />}
  </Card><Card title="上海公积金账户" loading={loading} extra={<Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>维护账户</Button>}>
    {accounts.length ? <Table rowKey="id" dataSource={accounts} pagination={false} columns={[
      { title: "成员", dataIndex: "memberName" }, { title: "总余额", key: "totalBalance", align: "right", render: (_value, account: ProvidentFundAccount) => <Text strong>{formatMoney((Number(account.basicBalance) + Number(account.supplementaryBalance)).toFixed(2))}</Text> }, { title: "基本公积金", dataIndex: "basicBalance", align: "right", render: formatMoney }, { title: "补充公积金", dataIndex: "supplementaryBalance", align: "right", render: formatMoney },
      { title: "基本月缴存", dataIndex: "basicMonthlyContribution", align: "right", render: (value) => value == null ? "—" : formatMoney(value) }, { title: "补充月缴存", dataIndex: "supplementaryMonthlyContribution", align: "right", render: (value) => value == null ? "—" : formatMoney(value) },
      { title: "缴存日", dataIndex: "monthlyContributionDay", render: (value) => `每月 ${value} 日` }, { title: "更新日期", dataIndex: "balanceUpdatedOn" },
      { title: "缴存额历史", key: "rates", render: (_value, account) => <Space size={4} wrap>{account.contributionRates.slice(0, 2).map((rate) => <Tag key={rate.id}>{rate.effectiveMonth} · {formatMoney((Number(rate.basicMonthlyContribution) + Number(rate.supplementaryMonthlyContribution)).toFixed(2))}</Tag>)}</Space> },
      { title: "状态", dataIndex: "isActive", render: (value) => <Tag color={value ? "green" : "default"}>{value ? "启用" : "停用"}</Tag> },
      { title: "操作", key: "actions", render: (_value, account) => <Space size={0}><Button type="link" size="small" onClick={() => onChangeContributionDay(account)}>修改缴存日</Button><Button type="link" size="small" onClick={() => onAdjust(account)}>年度调整</Button></Space> }
    ]} /> : <Empty description="维护成员公积金余额后，可用于月冲和年冲预测" />}
  </Card></Space>;
}

function ParticipantDrawer({ mortgage, accounts, onClose, onSaved }: { mortgage: MortgageRecord | null; accounts: ProvidentFundAccount[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!mortgage) return;
    const existing = new Map(mortgage.providentFundParticipants.map((item) => [item.accountId, item]));
    form.setFieldsValue({ participants: accounts.map((account, priority) => ({ accountId: account.id, memberName: account.memberName, role: existing.get(account.id)?.role ?? (priority === 0 ? "borrower" : priority === 1 ? "spouse" : "parentChild"), priority: existing.get(account.id)?.priority ?? priority, isActive: existing.get(account.id)?.isActive ?? account.isActive })) });
  }, [accounts, form, mortgage]);
  return <Drawer title={mortgage ? `参还人设置 · ${mortgage.name}` : "参还人设置"} open={mortgage != null} onClose={onClose} size={520} destroyOnHidden>
    {mortgage ? <Form form={form} layout="vertical" onFinish={async (values) => {
      setSaving(true);
      try {
        await saveMortgageProvidentFundParticipants(mortgage.id, values.participants.map((item: { accountId: string; role: "borrower" | "spouse" | "parentChild"; priority: number; isActive: boolean }) => ({ accountId: item.accountId, role: item.role, priority: Number(item.priority), isActive: item.isActive })));
        onSaved();
      } finally { setSaving(false); }
    }}>
      <Alert type="info" showIcon title="按顺序逐户扣款" description="上海月冲按这里的优先级扣款；每个账户仍按基本公积金、补充公积金的顺序扣除。" style={{ marginBottom: 16 }} />
      <Form.List name="participants">{(fields) => <Space orientation="vertical" className="full-width">{fields.map((field) => <Card key={field.key} size="small" title={<Form.Item name={[field.name, "memberName"]} noStyle><Input readOnly variant="borderless" /></Form.Item>}>
        <Form.Item name={[field.name, "accountId"]} hidden><Input /></Form.Item>
        <Row gutter={12}><Col span={10}><Form.Item name={[field.name, "role"]} label="关系" rules={[{ required: true }]}><Select options={[{ value: "borrower", label: "借款人" }, { value: "spouse", label: "配偶" }, { value: "parentChild", label: "父母/子女" }]} /></Form.Item></Col><Col span={8}><Form.Item name={[field.name, "priority"]} label="扣款顺序" rules={[{ required: true }]}><InputNumber min={0} precision={0} className="full-width" /></Form.Item></Col><Col span={6}><Form.Item name={[field.name, "isActive"]} label="参与月冲" valuePropName="checked"><Switch /></Form.Item></Col></Row>
      </Card>)}</Space>}</Form.List>
      <Button type="primary" htmlType="submit" loading={saving} block>保存参还设置</Button>
    </Form> : null}
  </Drawer>;
}

function LoanPartsTable({ mortgages, compact = false, showRates = false }: { mortgages: MortgageRecord[]; compact?: boolean; showRates?: boolean }) {
  const rows = mortgages.flatMap((mortgage) => mortgage.loanParts.map((part) => ({ key: part.id, mortgage: mortgage.name, ...part })));
  return rows.length ? <Table rowKey="key" pagination={false} size="small" scroll={{ x: 900 }} dataSource={rows} columns={[
    { title: "房贷", dataIndex: "mortgage" }, { title: "分段", dataIndex: "name" }, { title: "类型", dataIndex: "kind", render: (value) => <Tag color={value === "commercial" ? "blue" : "green"}>{value === "commercial" ? "商业贷" : "公积金贷"}</Tag> },
    { title: "余额", dataIndex: "outstandingPrincipal", align: "right", render: formatMoney }, { title: "当前利率", key: "rate", align: "right", render: (_, part: MortgageLoanPart) => `${latestRate(part)}%` },
    ...(compact ? [] : [{ title: "还款方式", dataIndex: "repaymentMethod", render: (value: string) => value === "equalPrincipal" ? "等额本金" : "等额本息" }]),
    { title: "剩余期数", dataIndex: "remainingPeriods", align: "right", render: (value) => `${value} 期` },
    ...(showRates ? [{ title: "利率历史", key: "history", render: (_value: unknown, part: MortgageLoanPart) => <Space size={4} wrap>{part.rateVersions.map((rate) => <Tag key={rate.id}>{rate.effectiveDate} · {rate.annualRate}%</Tag>)}</Space> }] : [])
  ]} /> : <Empty description="暂无贷款分段" />;
}

function MonthlyRepaymentDrawer({ repayment, bankAccounts, onClose, onSaved }: { repayment: MortgageMonthlyRepayment | null; bankAccounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!repayment) return;
    form.setFieldsValue({
      dueDate: dayjs(repayment.dueDate),
      note: repayment.note,
      parts: repayment.parts.map((part) => ({ ...part, principal: Number(part.principal), interest: Number(part.interest) })),
      providentFundTransactions: repayment.providentFundTransactions.map((item) => ({ ...item, basicContribution: Number(item.basicContribution), supplementaryContribution: Number(item.supplementaryContribution), basicOffset: Number(item.basicOffset), supplementaryOffset: Number(item.supplementaryOffset) }))
    });
  }, [form, repayment]);
  return <Drawer title={repayment ? `确认实际还款 · ${repayment.month}` : "确认实际还款"} open={repayment != null} onClose={onClose} size={480} destroyOnHidden>
    {repayment ? <>
      <Alert type="info" showIcon title="确认后入账" description="将写入实际本金和利息、当月公积金缴存及月冲扣款，并同步更新贷款和公积金余额。" style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical" onFinish={async (values) => {
        setSaving(true);
        try {
          await confirmMortgageMonthlyRepayment(repayment.mortgageId, {
            month: repayment.month,
            dueDate: (values.dueDate as Dayjs).format("YYYY-MM-DD"),
            bankAccountId: values.bankAccountId,
            note: values.note,
            parts: values.parts.map((part: { loanPartId: string; principal: number; interest: number }) => ({ loanPartId: part.loanPartId, principal: String(part.principal), interest: String(part.interest) })),
            providentFundTransactions: values.providentFundTransactions.map((item: { accountId: string; basicContribution: number; supplementaryContribution: number; basicOffset: number; supplementaryOffset: number }) => ({ accountId: item.accountId, basicContribution: String(item.basicContribution), supplementaryContribution: String(item.supplementaryContribution), basicOffset: String(item.basicOffset), supplementaryOffset: String(item.supplementaryOffset) }))
          });
          onSaved();
        } finally { setSaving(false); }
      }}>
        <Form.Item name="dueDate" label="实际还款日" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item>
        <Form.List name="parts">{(fields) => <Space orientation="vertical" className="full-width">{fields.map((field) => <Card size="small" key={field.key} title={<Form.Item name={[field.name, "loanPartName"]} noStyle><Input readOnly variant="borderless" /></Form.Item>}>
          <Form.Item name={[field.name, "loanPartId"]} hidden><Input /></Form.Item>
          <Row gutter={12}><Col span={12}><Form.Item name={[field.name, "principal"]} label="实际本金" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name={[field.name, "interest"]} label="实际利息" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row>
        </Card>)}</Space>}</Form.List>
        <Form.List name="providentFundTransactions">{(fields) => <Space orientation="vertical" className="full-width">{fields.map((field) => <Card size="small" key={field.key} title={<Form.Item name={[field.name, "memberName"]} noStyle><Input readOnly variant="borderless" /></Form.Item>}>
          <Form.Item name={[field.name, "accountId"]} hidden><Input /></Form.Item>
          <Row gutter={12}><Col span={12}><Form.Item name={[field.name, "basicContribution"]} label="实际基本缴存" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name={[field.name, "supplementaryContribution"]} label="实际补充缴存" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row>
          <Row gutter={12}><Col span={12}><Form.Item name={[field.name, "basicOffset"]} label="实际基本月冲" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name={[field.name, "supplementaryOffset"]} label="实际补充月冲" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row>
        </Card>)}</Space>}</Form.List>
        <Form.Item name="bankAccountId" label="银行卡扣款账户" extra="实际月冲不足时必选；全额月冲可不选。"><Select allowClear showSearch optionFilterProp="label" options={bankAccounts.map((account) => ({ value: account.id, label: `${account.name} · ${account.ownerName}` }))} /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={2} placeholder="如：已按银行账单核对" /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={saving}>确认并更新实际余额</Button>
      </Form>
    </> : null}
  </Drawer>;
}

function MortgageDrawer({ open, members, onClose, onSaved }: { open: boolean; members: FamilyMemberInfo[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) form.resetFields(); }, [form, open]);
  return <Drawer title="新增房贷" open={open} onClose={onClose} size={620} destroyOnHidden>
    <Form form={form} layout="vertical" initialValues={{ repaymentDay: 20, parts: [defaultPart()] }} onFinish={async (values) => {
      setSaving(true); try {
        await createMortgage({ ...values, repaymentDay: Number(values.repaymentDay), parts: values.parts.map((part: Record<string, unknown>) => ({ ...part, initialPrincipal: String(part.initialPrincipal), outstandingPrincipal: String(part.outstandingPrincipal ?? part.initialPrincipal), annualRate: String(part.annualRate), totalPeriods: Number(part.totalPeriods), remainingPeriods: Number(part.remainingPeriods ?? part.totalPeriods), firstRepaymentDate: (part.firstRepaymentDate as Dayjs).format("YYYY-MM-DD"), repricingDate: part.repricingDate ? (part.repricingDate as Dayjs).format("YYYY-MM-DD") : undefined })) }); onSaved();
      } finally { setSaving(false); }
    }}>
      <Row gutter={12}><Col span={12}><Form.Item name="name" label="房贷名称" rules={[{ required: true }]}><Input placeholder="如：浦东住房贷款" /></Form.Item></Col><Col span={12}><Form.Item name="ownerName" label="归属成员" rules={[{ required: true }]}><Select options={members.map((member) => ({ value: member.name, label: member.name }))} /></Form.Item></Col></Row>
      <Row gutter={12}><Col span={12}><Form.Item name="lender" label="贷款银行"><Input /></Form.Item></Col><Col span={12}><Form.Item name="repaymentDay" label="每月还款日" rules={[{ required: true }]}><InputNumber min={1} max={31} className="full-width" /></Form.Item></Col></Row>
      <Form.List name="parts">{(fields, { add, remove }) => <Space orientation="vertical" className="full-width">{fields.map((field) => <Card key={field.key} size="small" title={`贷款分段 ${field.name + 1}`} extra={fields.length > 1 ? <Button type="link" danger onClick={() => remove(field.name)}>删除</Button> : undefined}>
        <Row gutter={12}><Col span={12}><Form.Item name={[field.name, "kind"]} label="类型"><Select options={[{ value: "commercial", label: "商业贷" }, { value: "providentFund", label: "公积金贷" }]} /></Form.Item></Col><Col span={12}><Form.Item name={[field.name, "name"]} label="分段名称" rules={[{ required: true }]}><Input /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name={[field.name, "initialPrincipal"]} label="初始本金" rules={[{ required: true }]}><InputNumber min={0.01} precision={2} className="full-width" /></Form.Item></Col><Col span={8}><Form.Item name={[field.name, "outstandingPrincipal"]} label="当前本金" rules={[{ required: true }]}><InputNumber min={0.01} precision={2} className="full-width" /></Form.Item></Col><Col span={8}><Form.Item name={[field.name, "annualRate"]} label="年利率 %" rules={[{ required: true }]}><InputNumber min={0} precision={4} className="full-width" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={12}><Form.Item name={[field.name, "repaymentMethod"]} label="还款方式"><Select options={[{ value: "equalPrincipalAndInterest", label: "等额本息" }, { value: "equalPrincipal", label: "等额本金" }]} /></Form.Item></Col><Col span={12}><Form.Item name={[field.name, "rateType"]} label="利率类型"><Select options={[{ value: "fixed", label: "固定利率" }, { value: "lprFloating", label: "LPR 浮动" }, { value: "providentFundPolicy", label: "上海公积金政策" }]} /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name={[field.name, "firstRepaymentDate"]} label="首期还款日" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item></Col><Col span={8}><Form.Item name={[field.name, "totalPeriods"]} label="总期数" rules={[{ required: true }]}><InputNumber min={1} max={600} precision={0} className="full-width" /></Form.Item></Col><Col span={8}><Form.Item name={[field.name, "remainingPeriods"]} label="剩余期数" rules={[{ required: true }]}><InputNumber min={1} max={600} precision={0} className="full-width" /></Form.Item></Col></Row>
      </Card>)}<Button onClick={() => add(defaultPart())} disabled={fields.length >= 3}>增加贷款分段</Button></Space>}</Form.List>
      <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item><Button type="primary" htmlType="submit" loading={saving} block>保存房贷并生成计划</Button>
    </Form>
  </Drawer>;
}

function ProvidentFundDrawer({ open, members, onClose, onSaved }: { open: boolean; members: FamilyMemberInfo[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) form.resetFields(); }, [form, open]);
  return <Drawer title="维护上海公积金账户" open={open} onClose={onClose} size={420} destroyOnHidden><Form form={form} layout="vertical" initialValues={{ balanceUpdatedOn: dayjs(), isActive: true, basicBalance: 0, supplementaryBalance: 0, monthlyContributionDay: 11 }} onFinish={async (values) => { setSaving(true); try { await saveProvidentFundAccount({ ...values, monthlyContributionDay: Number(values.monthlyContributionDay), basicBalance: String(values.basicBalance), supplementaryBalance: String(values.supplementaryBalance), basicMonthlyContribution: values.basicMonthlyContribution == null ? undefined : String(values.basicMonthlyContribution), supplementaryMonthlyContribution: values.supplementaryMonthlyContribution == null ? undefined : String(values.supplementaryMonthlyContribution), balanceUpdatedOn: (values.balanceUpdatedOn as Dayjs).format("YYYY-MM-DD") }); onSaved(); } finally { setSaving(false); } }}>
    <Form.Item name="memberId" label="成员" rules={[{ required: true }]}><Select options={members.map((member) => ({ value: member.id, label: member.name }))} /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="basicBalance" label="基本公积金余额" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name="supplementaryBalance" label="补充公积金余额" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row><Row gutter={12}><Col span={12}><Form.Item name="basicMonthlyContribution" label="基本月缴存"><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name="supplementaryMonthlyContribution" label="补充月缴存"><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row><Form.Item name="monthlyContributionDay" label="每月缴存日" rules={[{ required: true }]} extra="仅在缴存日早于或等于还款日时，计入当期月冲。"><InputNumber min={1} max={31} precision={0} className="full-width" addonAfter="日" /></Form.Item><Form.Item name="balanceUpdatedOn" label="余额更新日" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item><Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item><Button type="primary" htmlType="submit" loading={saving} block>保存账户</Button>
  </Form></Drawer>;
}

function ContributionDayDrawer({ account, onClose, onSaved }: { account: ProvidentFundAccount | null; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (account) form.setFieldsValue({ monthlyContributionDay: account.monthlyContributionDay }); }, [account, form]);
  return <Drawer title={account ? `修改缴存日 · ${account.memberName}` : "修改缴存日"} open={account != null} onClose={onClose} size={380} destroyOnHidden>
    {account ? <Form form={form} layout="vertical" onFinish={async (values) => {
      setSaving(true);
      try {
        await saveProvidentFundAccount({
          memberId: account.memberId,
          basicBalance: account.basicBalance,
          supplementaryBalance: account.supplementaryBalance,
          basicMonthlyContribution: account.basicMonthlyContribution,
          supplementaryMonthlyContribution: account.supplementaryMonthlyContribution,
          monthlyContributionDay: Number(values.monthlyContributionDay),
          balanceUpdatedOn: account.balanceUpdatedOn,
          isActive: account.isActive,
          note: account.note
        });
        onSaved();
      } finally { setSaving(false); }
    }}>
      <Alert type="info" showIcon title="影响月冲预测" description="缴存日早于或等于还款日时，本月缴存额才会计入该期月冲；已确认的历史流水不会改变。" style={{ marginBottom: 16 }} />
      <Form.Item name="monthlyContributionDay" label="每月缴存日" rules={[{ required: true }]}><InputNumber min={1} max={31} precision={0} className="full-width" addonAfter="日" /></Form.Item>
      <Button type="primary" htmlType="submit" block loading={saving}>保存缴存日</Button>
    </Form> : null}
  </Drawer>;
}

function ContributionRateDrawer({ account, onClose, onSaved }: { account: ProvidentFundAccount | null; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!account) return;
    form.setFieldsValue({ effectiveMonth: dayjs().month() >= 6 ? dayjs().startOf("month") : dayjs().subtract(1, "year").month(6).startOf("month"), basicMonthlyContribution: Number(account.basicMonthlyContribution ?? 0), supplementaryMonthlyContribution: Number(account.supplementaryMonthlyContribution ?? 0), source: "annualAdjustment", note: "年度基数调整" });
  }, [account, form]);
  return <Drawer title={account ? `年度调整 · ${account.memberName}` : "年度调整"} open={account != null} onClose={onClose} size={420} destroyOnHidden><Alert type="info" showIcon title="保留历史，不覆盖旧金额" description="新缴存额会从所选月份生效；此前的月冲预测继续使用旧版本。上海年度原则上为当年 7 月至次年 6 月。" style={{ marginBottom: 16 }} />{account ? <Form form={form} layout="vertical" onFinish={async (values) => { setSaving(true); try { await saveProvidentFundContributionRate(account.id, { effectiveMonth: (values.effectiveMonth as Dayjs).format("YYYY-MM"), basicMonthlyContribution: String(values.basicMonthlyContribution ?? 0), supplementaryMonthlyContribution: String(values.supplementaryMonthlyContribution ?? 0), source: values.source, note: values.note }); onSaved(); } finally { setSaving(false); } }}><Form.Item name="effectiveMonth" label="生效月份" rules={[{ required: true }]}><DatePicker picker="month" className="full-width" /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="basicMonthlyContribution" label="基本月缴存额" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name="supplementaryMonthlyContribution" label="补充月缴存额" rules={[{ required: true }]}><InputNumber min={0} precision={2} className="full-width" /></Form.Item></Col></Row><Form.Item name="source" label="调整原因"><Select options={[{ value: "annualAdjustment", label: "年度基数调整" }, { value: "employmentChange", label: "调薪 / 换工作" }, { value: "manualCorrection", label: "历史修正" }]} /></Form.Item><Form.Item name="note" label="说明"><Input.TextArea rows={2} /></Form.Item><Button type="primary" htmlType="submit" loading={saving} block>保存缴存额版本</Button></Form> : null}</Drawer>;
}

function RateAdjustmentDrawer({ open, mortgages, onClose, onSaved }: { open: boolean; mortgages: MortgageRecord[]; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm(); const [saving, setSaving] = useState(false); const [preview, setPreview] = useState<{ result: MortgageRateAdjustmentPreview; payload: { mortgageId: string; data: MortgageRateAdjustmentInput } }>();
  useEffect(() => { if (open) { form.resetFields(); setPreview(undefined); } }, [form, open]);
  const parts = useMemo(() => mortgages.flatMap((mortgage) => mortgage.loanParts.map((part) => ({ mortgage, part }))), [mortgages]);
  const input = (): { mortgageId: string; data: MortgageRateAdjustmentInput } | undefined => { const values = form.getFieldsValue(); const selection = parts.find((item) => item.part.id === values.loanPartId); if (!selection || !values.annualRate || !values.effectiveDate) return undefined; return { mortgageId: selection.mortgage.id, data: { loanPartId: values.loanPartId, annualRate: String(values.annualRate), effectiveDate: (values.effectiveDate as Dayjs).format("YYYY-MM-DD"), source: values.source, lprValue: values.lprValue == null ? undefined : String(values.lprValue), policyVersion: values.policyVersion, evidenceNote: values.evidenceNote } }; };
  const calculate = async () => { const payload = input(); if (!payload) { await form.validateFields(); return; } setSaving(true); try { setPreview({ result: await previewMortgageRateAdjustment(payload.mortgageId, payload.data), payload }); } finally { setSaving(false); } };
  const apply = async () => { if (!preview) return; setSaving(true); try { await applyMortgageRateAdjustment(preview.payload.mortgageId, preview.payload.data); onSaved(); } finally { setSaving(false); } };
  const result = preview?.result;
  return <Drawer title="登记利率调整" open={open} onClose={onClose} size={460} destroyOnHidden><Form form={form} layout="vertical" initialValues={{ source: "bankNotice", effectiveDate: dayjs() }} onValuesChange={() => setPreview(undefined)}><Form.Item name="loanPartId" label="贷款分段" rules={[{ required: true }]}><Select options={parts.map(({ mortgage, part }) => ({ value: part.id, label: `${mortgage.name} · ${part.name}（当前 ${latestRate(part)}%）` }))} /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="annualRate" label="调整后年利率 %" rules={[{ required: true }]}><InputNumber min={0} precision={4} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item name="effectiveDate" label="生效日" rules={[{ required: true }]}><DatePicker className="full-width" /></Form.Item></Col></Row><Form.Item name="source" label="调整来源"><Select options={[{ value: "lprRepricing", label: "LPR 重定价" }, { value: "shanghaiProvidentFundPolicy", label: "上海公积金政策" }, { value: "bankNotice", label: "银行通知" }, { value: "manualCorrection", label: "人工校正" }]} /></Form.Item><Form.Item name="lprValue" label="5 年期 LPR（可选）"><InputNumber min={0} precision={4} className="full-width" /></Form.Item><Form.Item name="policyVersion" label="政策/通知编号（可选）"><Input /></Form.Item><Form.Item name="evidenceNote" label="说明（可选）"><Input.TextArea rows={2} /></Form.Item></Form>{result ? <Card size="small" title="调整预览" style={{ marginBottom: 12 }}><div>月供：{formatMoney(result.currentMonthlyPayment)} → <Text strong>{formatMoney(result.adjustedMonthlyPayment)}</Text></div><div>剩余利息：{formatMoney(result.currentRemainingInterest)} → {formatMoney(result.adjustedRemainingInterest)}</div><div>每月差额：{formatMoney(result.differencePerMonth)}</div></Card> : null}<Space className="full-width"><Button onClick={() => void calculate()} loading={saving}>计算预览</Button><Button type="primary" disabled={!preview} loading={saving} onClick={() => void apply()}>确认应用</Button></Space></Drawer>;
}

function monthDistance(start: string, end: string): number {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear! - startYear!) * 12 + endMonth! - startMonth!;
}
function latestRate(part: MortgageLoanPart): string { return mortgageRateAt(part.rateVersions, dayjs().format("YYYY-MM-DD")); }
function participantRoleLabel(role: "borrower" | "spouse" | "parentChild"): string { return role === "borrower" ? "借款人" : role === "spouse" ? "配偶" : "父母/子女"; }
function defaultPart() { return { kind: "commercial", name: "商业贷款", initialPrincipal: undefined, outstandingPrincipal: undefined, annualRate: undefined, rateType: "lprFloating", repaymentMethod: "equalPrincipalAndInterest", firstRepaymentDate: dayjs(), totalPeriods: 360, remainingPeriods: 360 }; }
