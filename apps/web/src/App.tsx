import {
  BankOutlined,
  BarChartOutlined,
  CameraOutlined,
  CreditCardOutlined,
  CrownOutlined,
  DatabaseOutlined,
  FundProjectionScreenOutlined,
  GiftOutlined,
  HeartOutlined,
  HistoryOutlined,
  HomeOutlined,
  ManOutlined,
  PieChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  SkinOutlined,
  SmileOutlined,
  StarOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  WalletOutlined,
  WomanOutlined
} from "@ant-design/icons";
import type {
  Account,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";
import { formatMoney, type AccountSnapshotRecord } from "@family-finance/shared";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  InputNumber,
  Layout,
  Menu,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload
} from "antd";
import type { ColumnsType } from "antd/es/table";
import Modal from "antd/es/modal";
import { Column, Line, Pie } from "@ant-design/charts";
import dayjs, { type Dayjs } from "dayjs";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AccountSnapshotPoint,
  type AppData,
  type AssetTrendPoint,
  type Category,
  createAccount,
  createBudget,
  createCategory,
  createInvestment,
  createLiability,
  createMember,
  createTransaction,
  deleteAccount,
  deleteBudget,
  deleteCategory,
  deleteInvestment,
  deleteLiability,
  deleteMember,
  deleteSnapshot,
  deleteTransaction,
  importTransactions,
  listAccountSnapshots,
  listAllSnapshots,
  loadAppData,
  repayLiability,
  updateAccount,
  snapshotAllAccounts,
  updateBudget,
  updateCategory,
  updateInvestment,
  updateLiability,
  updateMember,
  updateTransaction
} from "./api/client";
import { buildDashboardViewModel } from "./data/view-model";
import { type ParsedBill, applyCategoryMap, parseAlipayBill, summarizeBill } from "./data/alipay-import";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type PageKey =
  | "dashboard"
  | "transactions"
  | "accounts"
  | "assetHistory"
  | "liabilities"
  | "budgets"
  | "investments"
  | "settings";

const emptySummary: DashboardSummary = {
  totalAssets: "0.00",
  totalLiabilities: "0.00",
  netAssets: "0.00",
  monthlyExpense: "0.00",
  monthlyIncome: "0.00",
  monthlyBalance: "0.00",
  monthlyDebtPayment: "0.00",
  investmentMarketValue: "0.00",
  investmentCost: "0.00",
  investmentProfit: "0.00",
  investmentProfitRate: 0,
  categoryBreakdown: [],
  liabilityBreakdown: [],
  memberBreakdown: [],
  budgetUsages: []
};

const emptyData: AppData = {
  summary: emptySummary,
  members: [],
  familyMembers: [],
  categories: [],
  accounts: [],
  transactions: [],
  budgets: [],
  investments: [],
  liabilities: [],
  assetTrend: []
};

export default function App() {
  return (
    <AntApp>
      <AppShell />
    </AntApp>
  );
}

function AppShell() {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const [activePage, setActivePage] = useState<PageKey>("dashboard");
  const [month, setMonth] = useState<Dayjs>(dayjs("2026-06-01"));
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthKey = month.format("YYYY-MM");
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadAppData(monthKey));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const submit = useCallback(
    async (run: () => Promise<unknown>, options: { success: string; onSuccess?: () => void }) => {
      try {
        await run();
        message.success(options.success);
        options.onSuccess?.();
        await reload();
      } catch (caught) {
        message.error(caught instanceof Error ? caught.message : "保存失败，请重试");
      }
    },
    [message, reload]
  );

  const commonProps = {
    data,
    monthKey,
    reload,
    submit
  };

  return (
    <Layout className="app-shell">
      <Sider width={240} breakpoint="lg" collapsedWidth={0} className="app-sider">
          <div className="brand-block">
            <div className="brand-mark">
              <WalletOutlined />
            </div>
            <div>
              <Text strong>家庭财务</Text>
              <div className="brand-subtitle">Owner 工作台</div>
            </div>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activePage]}
            onSelect={({ key }) => setActivePage(key as PageKey)}
            items={[
              { key: "dashboard", icon: <PieChartOutlined />, label: "仪表盘" },
              { key: "transactions", icon: <DatabaseOutlined />, label: "收支流水" },
              { key: "accounts", icon: <BankOutlined />, label: "资产账户" },
              { key: "assetHistory", icon: <HistoryOutlined />, label: "资产历史" },
              { key: "liabilities", icon: <CreditCardOutlined />, label: "负债" },
              { key: "budgets", icon: <BarChartOutlined />, label: "预算" },
              { key: "investments", icon: <FundProjectionScreenOutlined />, label: "投资持仓" },
              { key: "settings", icon: <SettingOutlined />, label: "设置" }
            ]}
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <Title level={screens.md ? 4 : 5} className="page-title">
              {pageTitle(activePage)}
            </Title>
            <Space wrap>
              <DatePicker
                picker="month"
                value={month}
                allowClear={false}
                onChange={(value) => setMonth(value ?? dayjs())}
              />
              <Button icon={<ReloadOutlined />} onClick={() => void reload()}>
                刷新
              </Button>
            </Space>
          </Header>
          <Content className="app-content">
            {error ? (
              <Alert
                type="error"
                showIcon
                message="API 连接失败"
                description={`${error}。请确认后端服务正在 http://localhost:4000/api 运行。`}
                className="content-alert"
              />
            ) : null}
            <Spin spinning={loading}>
              {activePage === "dashboard" ? <DashboardPage data={data} /> : null}
              {activePage === "transactions" ? <TransactionsPage {...commonProps} /> : null}
              {activePage === "accounts" ? <AccountsPage {...commonProps} /> : null}
              {activePage === "assetHistory" ? <AssetHistoryPage {...commonProps} /> : null}
              {activePage === "liabilities" ? <LiabilitiesPage {...commonProps} /> : null}
              {activePage === "budgets" ? <BudgetsPage {...commonProps} /> : null}
              {activePage === "investments" ? <InvestmentsPage {...commonProps} /> : null}
              {activePage === "settings" ? <SettingsPage {...commonProps} /> : null}
            </Spin>
          </Content>
        </Layout>
      </Layout>
  );
}

function DashboardPage({ data }: { data: AppData }) {
  const model = buildDashboardViewModel(data.summary);
  const assetTrendData = data.assetTrend.map((point) => ({
    date: point.date,
    value: Number.parseFloat(point.totalAssets)
  }));
  const memberIconByName = new Map(data.familyMembers.map((member) => [member.name, member.icon]));
  const incomeByMember = data.summary.memberBreakdown
    .filter((member) => Number(member.income) > 0)
    .map((member) => ({ name: member.memberName, amount: member.income }));
  const expenseByMember = data.summary.memberBreakdown
    .filter((member) => Number(member.expense) > 0)
    .map((member) => ({ name: member.memberName, amount: member.expense }));

  const [accountOwnerFilter, setAccountOwnerFilter] = useState<string | undefined>(undefined);
  const filteredAccounts = accountOwnerFilter
    ? data.accounts.filter((a) => a.ownerName === accountOwnerFilter)
    : data.accounts;

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        {model.metrics.map((metric) => (
          <Col xs={24} sm={12} lg={8} key={metric.title}>
            <Card className={`metric-card metric-card--${metric.tone}`}>
              {metric.title === "本月收入" || metric.title === "本月支出" ? (
                <div className="metric-with-members">
                  <Statistic title={metric.title} value={metric.value} />
                  <MemberSubcards
                    rows={metric.title === "本月收入" ? incomeByMember : expenseByMember}
                    iconByName={memberIconByName}
                    side
                  />
                </div>
              ) : (
                <>
                  <Statistic title={metric.title} value={metric.value} />
                  {metric.trend ? <Text type="secondary">{metric.trend}</Text> : null}
                </>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card title="总资产变化" className="chart-card">
            {assetTrendData.length ? (
              <Line
                data={assetTrendData}
                xField="date"
                yField="value"
                height={260}
                point={{ size: 4 }}
                color="#1677ff"
                axis={{ y: { labelFormatter: (value: string) => `${Number(value) / 1000}k` } }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资产快照数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="分类支出占比" className="chart-card">
            {model.categoryChart.length ? (
              <Pie
                data={model.categoryChart}
                angleField="value"
                colorField="type"
                height={260}
                innerRadius={0.62}
                label={{ text: "type", position: "outside" }}
                legend={{ color: { position: "bottom" } }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无支出数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="预算使用" className="list-card">
            <Space direction="vertical" size={14} className="page-stack">
              {model.budgetHighlights.map((budget) => (
                <div key={budget.id}>
                  <Flex justify="space-between" align="center">
                    <Text>{budget.categoryName}</Text>
                    <Tag color={budget.status === "over" ? "red" : budget.status === "warning" ? "gold" : "green"}>
                      {budget.percent}%
                    </Tag>
                  </Flex>
                  <Progress
                    percent={budget.percent}
                    status={budget.status === "over" ? "exception" : "active"}
                    showInfo={false}
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title="资产账户"
            className="list-card"
            extra={
              <Select
                allowClear
                placeholder="全部归属"
                style={{ minWidth: 130 }}
                value={accountOwnerFilter}
                onChange={(value) => setAccountOwnerFilter(value)}
                options={data.members.map((item) => ({ label: item, value: item }))}
              />
            }
          >
            <Table<Account>
              rowKey="id" tableLayout="fixed"
              size="middle"
              pagination={false}
              scroll={{ x: 520 }}
              dataSource={filteredAccounts}
              columns={[
                { title: "账户", dataIndex: "name", width: 180 },
                { title: "类型", dataIndex: "type", width: 120, render: renderAccountType },
                { title: "归属", dataIndex: "ownerName", width: 100, render: (value: string) => renderOwnerTag(value, data.members) },
                {
                  title: "当前金额",
                  dataIndex: "currentValue",
                  width: 130,
                  align: "right",
                  render: (value: string) => <Tag color="green">{formatMoney(value)}</Tag>
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function TransactionsPage(props: PageProps) {
  const [kind, setKind] = useState<"all" | FinanceTransaction["kind"]>("all");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [member, setMember] = useState<string | undefined>(undefined);
  const [amountMin, setAmountMin] = useState<number | null>(null);
  const [amountMax, setAmountMax] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [form] = Form.useForm();
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? {
            date: dayjs(editing.date),
            kind: editing.kind,
            categoryName: editing.categoryName,
            accountId: editing.accountId,
            memberName: editing.memberName,
            amount: Number(editing.amount),
            note: editing.note
          }
        : {
            date: dayjs(),
            kind: "expense",
            categoryName: undefined,
            accountId: undefined,
            memberName: "家庭共同",
            amount: undefined,
            note: undefined
          }
    );
  }, [open, editing, form]);
  const filtered = props.data.transactions.filter((transaction) => {
    if (kind !== "all" && transaction.kind !== kind) return false;
    if (category && transaction.categoryName !== category) return false;
    if (member && transaction.memberName !== member) return false;
    const amount = Number(transaction.amount);
    if (amountMin != null && amount < amountMin) return false;
    if (amountMax != null && amount > amountMax) return false;
    return true;
  });

  const columns: ColumnsType<FinanceTransaction> = [
    {
      title: "日期",
      dataIndex: "date",
      width: 120,
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: "descend"
    },
    { title: "类型", dataIndex: "kind", width: 96, render: renderTransactionKind },
    { title: "分类", dataIndex: "categoryName", width: 120 },
    { title: "成员", dataIndex: "memberName", width: 100 },
    {
      title: "金额",
      dataIndex: "amount",
      width: 120,
      align: "right",
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (value: string, record) => (
        <Text type={record.kind === "expense" ? "danger" : "success"}>{formatMoney(value)}</Text>
      )
    },
    { title: "备注", dataIndex: "note", width: 240 },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <RowActions
          onEdit={() => {
            setEditing(record);
            setOpen(true);
          }}
          onDelete={() => props.submit(() => deleteTransaction(record.id), { success: "流水已删除" })}
        />
      )
    }
  ];

  return (
    <Card
      title="收支流水"
      extra={
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            导入账单
          </Button>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            新增流水
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} className="page-stack">
        <Flex gap={12} wrap="wrap" align="center">
          <Segmented
            value={kind}
            onChange={(value) => setKind(value as typeof kind)}
            options={[
              { label: "全部", value: "all" },
              { label: "支出", value: "expense" },
              { label: "收入", value: "income" },
              { label: "转账", value: "transfer" },
              { label: "调整", value: "adjustment" }
            ]}
          />
          <Select
            allowClear
            placeholder="全部分类"
            style={{ minWidth: 140 }}
            value={category}
            onChange={(value) => setCategory(value)}
            options={props.data.categories.map((item) => ({ label: item.name, value: item.name }))}
          />
          <Select
            allowClear
            placeholder="全部成员"
            style={{ minWidth: 120 }}
            value={member}
            onChange={(value) => setMember(value)}
            options={props.data.members.map((item) => ({ label: item, value: item }))}
          />
          <Space size={4} align="center">
            <InputNumber
              placeholder="最低金额"
              min={0}
              style={{ width: 120 }}
              value={amountMin}
              onChange={(value) => setAmountMin(value ?? null)}
            />
            <span>—</span>
            <InputNumber
              placeholder="最高金额"
              min={0}
              style={{ width: 120 }}
              value={amountMax}
              onChange={(value) => setAmountMax(value ?? null)}
            />
          </Space>
        </Flex>
        <Table rowKey="id" tableLayout="fixed" dataSource={filtered} columns={columns} scroll={{ x: 916 }} />
      </Space>
      <Drawer
        title={editing ? "编辑流水" : "新增流水"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  date: dayjs(editing.date),
                  kind: editing.kind,
                  categoryName: editing.categoryName,
                  accountId: editing.accountId,
                  memberName: editing.memberName,
                  amount: Number(editing.amount),
                  note: editing.note
                }
              : { date: dayjs(), kind: "expense", memberName: "家庭共同" }
          }
          onFinish={(values) => {
            const payload = {
              date: values.date.format("YYYY-MM-DD"),
              kind: values.kind,
              categoryName: values.categoryName,
              accountId: values.accountId,
              memberName: values.memberName,
              amount: String(values.amount),
              note: values.note
            };
            return props.submit(
              () => (editing ? updateTransaction(editing.id, payload) : createTransaction(payload)),
              { success: editing ? "流水已更新" : "流水已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <TransactionFormFields data={props.data} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
      <ImportDrawer
        data={props.data}
        submit={props.submit}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </Card>
  );
}

function ImportDrawer({
  data,
  submit,
  open,
  onClose
}: {
  data: AppData;
  submit: PageProps["submit"];
  open: boolean;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const [parsed, setParsed] = useState<ParsedBill | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setParsed(null);
      setFileName(null);
      setCategoryMap({});
      form.resetFields();
    }
  }, [open, form]);

  const handleFile = (file: File) => {
    void file.arrayBuffer().then((buffer) => {
      let text = new TextDecoder("gb18030").decode(buffer);
      if (!text.includes("记录时间")) {
        text = new TextDecoder("utf-8").decode(buffer);
      }
      const bill = parseAlipayBill(text);
      setParsed(bill);
      setFileName(file.name);
      // Pre-fill only categories that already exist in 设置; the rest must be
      // chosen by the user (the target can only be an existing category).
      const appNames = new Set(data.categories.map((category) => category.name));
      const initial: Record<string, string> = {};
      for (const item of bill.items) {
        if (!(item.categoryName in initial) && appNames.has(item.categoryName)) {
          initial[item.categoryName] = item.categoryName;
        }
      }
      setCategoryMap(initial);
    });
    return false;
  };

  const summary = parsed ? summarizeBill(parsed.items) : null;
  const sourceCategories = parsed ? [...new Set(parsed.items.map((item) => item.categoryName))] : [];
  // Targets are limited to the categories configured in 设置.
  const targetOptions = [...new Set(data.categories.map((category) => category.name))].map((name) => ({
    label: name,
    value: name
  }));
  const allMapped = sourceCategories.every((source) => categoryMap[source]);

  return (
    <Drawer title="导入支付宝账单" open={open} onClose={onClose} width={460} destroyOnHidden>
      <Form form={form} layout="vertical" initialValues={{ memberName: "家庭共同" }}>
        <Form.Item name="memberName" label="成员" rules={[{ required: true }]}>
          <Select options={data.members.map((member) => ({ label: member, value: member }))} />
        </Form.Item>
        <Form.Item label="账单文件（.csv）">
          <Upload accept=".csv" beforeUpload={handleFile} maxCount={1} showUploadList={false}>
            <Button icon={<UploadOutlined />}>选择支付宝导出的 CSV</Button>
          </Upload>
          {fileName ? (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">{fileName}</Text>
            </div>
          ) : null}
        </Form.Item>
      </Form>

      {parsed ? (
        <Alert
          type={parsed.items.length ? "info" : "warning"}
          showIcon
          style={{ marginBottom: 12 }}
          message={`共解析 ${parsed.items.length} 条记录`}
          description={
            summary
              ? `支出 ${summary.expense} · 收入 ${summary.income} · 不计收支 ${summary.transfer}${
                  parsed.skipped ? ` · 跳过 ${parsed.skipped}` : ""
                }`
              : undefined
          }
        />
      ) : (
        <Text type="secondary">
          支付宝账单为 GBK 编码，会自动识别。“不计收支”记为转账，不影响收入/支出统计。
        </Text>
      )}

      {parsed && parsed.items.length ? (
        <div style={{ marginBottom: 12 }}>
          <Text strong>分类映射</Text>
          <Text type="secondary" style={{ display: "block", margin: "2px 0 8px", fontSize: 12 }}>
            每个支付宝分类都要映射到「设置」里已有的分类（多个可映射到同一个）。缺少的分类请先到设置里添加。
          </Text>
          <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
            {sourceCategories.map((source) => (
              <Flex key={source} align="center" gap={8} style={{ marginBottom: 8 }}>
                <Tag style={{ width: 96, margin: 0, textAlign: "center" }}>{source}</Tag>
                <span style={{ color: "#888" }}>→</span>
                <Select
                  size="small"
                  showSearch
                  style={{ flex: 1 }}
                  placeholder="选择分类"
                  status={categoryMap[source] ? undefined : "error"}
                  value={categoryMap[source]}
                  onChange={(value) => setCategoryMap((prev) => ({ ...prev, [source]: value }))}
                  options={targetOptions}
                />
              </Flex>
            ))}
          </div>
          {!allMapped ? (
            <Text type="danger" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
              还有分类未映射，全部映射后才能导入。
            </Text>
          ) : null}
        </div>
      ) : null}

      <Button
        type="primary"
        block
        disabled={!parsed || parsed.items.length === 0 || !allMapped}
        style={{ marginTop: 12 }}
        onClick={() => {
          void form
            .validateFields()
            .then((values) =>
              submit(
                () =>
                  importTransactions({
                    memberName: values.memberName,
                    items: applyCategoryMap(parsed?.items ?? [], categoryMap)
                  }),
                {
                  success: `已导入 ${parsed?.items.length ?? 0} 条记录`,
                  onSuccess: () => {
                    setParsed(null);
                    setFileName(null);
                    setCategoryMap({});
                    onClose();
                  }
                }
              )
            )
            .catch(() => undefined);
        }}
      >
        确认导入
      </Button>
    </Drawer>
  );
}

function AccountsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const filteredAccounts = ownerFilter
    ? props.data.accounts.filter((a) => a.ownerName === ownerFilter)
    : props.data.accounts;

  const filteredTotalValue = filteredAccounts.reduce(
    (sum, a) => sum + Number(a.currentValue),
    0
  );
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            type: editing.type,
            ownerName: editing.ownerName,
            currentValue: Number(editing.currentValue),
            note: editing.note
          }
        : { name: undefined, type: "bankCard", ownerName: "家庭共同", currentValue: undefined, note: undefined }
    );
  }, [open, editing, form]);
  return (
    <Card
      title={
        <Space size={8}>
          <span>资产账户</span>
          <Tag color="blue">{formatMoney(String(filteredTotalValue))}</Tag>
        </Space>
      }
      extra={
        <Space size={8}>
          <Select
            allowClear
            placeholder="全部归属"
            style={{ minWidth: 130 }}
            value={ownerFilter}
            onChange={(value) => setOwnerFilter(value)}
            options={props.data.members.map((item) => ({ label: item, value: item }))}
          />
          <Button
            icon={<CameraOutlined />}
            onClick={() =>
              props.submit(() => snapshotAllAccounts(), { success: "资产快照已保存" })
            }
          >
            保存快照
          </Button>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            新增账户
          </Button>
        </Space>
      }
    >
      <Table<Account>
        rowKey="id" tableLayout="fixed"
        dataSource={filteredAccounts}
        scroll={{ x: 1150 }}
        columns={[
          { title: "账户", dataIndex: "name", width: 180 },
          { title: "类型", dataIndex: "type", width: 120, render: renderAccountType },
          { title: "归属", dataIndex: "ownerName", width: 100, render: (value: string) => renderOwnerTag(value, props.data.members) },
          { title: "当前金额", dataIndex: "currentValue", width: 140, align: "right", sorter: (a, b) => Number(a.currentValue) - Number(b.currentValue), defaultSortOrder: "descend", render: (value: string) => <Tag color="green">{formatMoney(value)}</Tag> },
          { title: "创建时间", dataIndex: "createdAt", width: 150, render: formatDateTime },
          { title: "更新时间", dataIndex: "updatedAt", width: 150, render: formatDateTime },
          { title: "备注", dataIndex: "note", width: 160 },
          {
            title: "操作",
            key: "actions",
            width: 150,
            render: (_, record) => (
              <Space size={4}>
                <Button type="link" size="small" onClick={() => { setEditing(record); setOpen(true); }}>编辑</Button>
                <Popconfirm
                  title="确认删除？"
                  description="删除后将从列表中移除。"
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => props.submit(() => deleteAccount(record.id), { success: "账户已删除" })}
                >
                  <Button type="link" size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
      <Drawer
        title={editing ? "编辑账户" : "新增账户"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  ownerName: editing.ownerName,
                  note: editing.note
                }
              : { type: "bankCard", ownerName: "家庭共同" }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              type: values.type,
              ownerName: values.ownerName,
              currentValue: String(values.currentValue ?? 0),
              note: values.note
            };
            if (editing) {
              return props.submit(
                () => updateAccount(editing.id, payload),
                { success: "账户已更新", onSuccess: () => setOpen(false) }
              );
            }
            return props.submit(
              () => createAccount(payload),
              { success: "账户已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <AccountFormFields members={props.data.members} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
    </Card>
  );
}

function LiabilitiesPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Liability | null>(null);
  const [repaying, setRepaying] = useState<Liability | null>(null);
  const [form] = Form.useForm();
  const [repayForm] = Form.useForm();
  const { summary } = props.data;
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            type: editing.type,
            ownerName: editing.ownerName,
            currentBalance: Number(editing.currentBalance),
            monthlyPayment: editing.monthlyPayment == null ? undefined : Number(editing.monthlyPayment),
            paymentDay: editing.paymentDay,
            remainingPeriods: editing.remainingPeriods,
            lender: editing.lender,
            status: editing.status,
            note: editing.note
          }
        : {
            name: undefined,
            type: "mortgage",
            ownerName: "家庭共同",
            currentBalance: undefined,
            monthlyPayment: undefined,
            paymentDay: undefined,
            remainingPeriods: undefined,
            lender: undefined,
            status: "active",
            note: undefined
          }
    );
  }, [open, editing, form]);
  useEffect(() => {
    if (!repaying) return;
    repayForm.setFieldsValue({
      amount: Number(repaying.monthlyPayment ?? repaying.currentBalance)
    });
  }, [repaying, repayForm]);
  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="总负债" value={formatMoney(summary.totalLiabilities)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="月供合计" value={formatMoney(summary.monthlyDebtPayment)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="净资产" value={formatMoney(summary.netAssets)} />
          </Card>
        </Col>
      </Row>
      <Card
        title="负债明细"
        extra={
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            新增负债
          </Button>
        }
      >
        <Table<Liability>
          rowKey="id" tableLayout="fixed"
          dataSource={props.data.liabilities}
          scroll={{ x: 1360 }}
          columns={[
            { title: "名称", dataIndex: "name", width: 160 },
            { title: "类型", dataIndex: "type", width: 110, render: renderLiabilityType },
            { title: "归属", dataIndex: "ownerName", width: 100, render: (value: string) => renderOwnerTag(value, props.data.members) },
            { title: "债权机构", dataIndex: "lender", width: 130 },
            {
              title: "月供",
              dataIndex: "monthlyPayment",
              width: 120,
              align: "right",
              render: (value?: string) => (value ? formatMoney(value) : "—")
            },
            {
              title: "还款日",
              dataIndex: "paymentDay",
              width: 90,
              align: "center",
              render: (value?: number) => (value ? `每月${value}号` : "—")
            },
            {
              title: "剩余期数",
              dataIndex: "remainingPeriods",
              width: 90,
              align: "center",
              render: (value?: number) => (value == null ? "—" : `${value} 期`)
            },
            {
              title: "当前余额",
              dataIndex: "currentBalance",
              width: 130,
              align: "right",
              render: (value: string) => formatMoney(value)
            },
            { title: "状态", dataIndex: "status", width: 90, render: renderLiabilityStatus },
            { title: "备注", dataIndex: "note", width: 160 },
            {
              title: "操作",
              key: "actions",
              width: 180,
              render: (_, record) => (
                <Space size={4}>
                  {record.status === "active" ? (
                    <Button type="link" size="small" onClick={() => setRepaying(record)}>
                      还款
                    </Button>
                  ) : null}
                  <RowActions
                    onEdit={() => {
                      setEditing(record);
                      setOpen(true);
                    }}
                    onDelete={() => props.submit(() => deleteLiability(record.id), { success: "负债已删除" })}
                  />
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Drawer
        title={editing ? "编辑负债" : "新增负债"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  type: editing.type,
                  ownerName: editing.ownerName,
                  currentBalance: Number(editing.currentBalance),
                  monthlyPayment: editing.monthlyPayment == null ? undefined : Number(editing.monthlyPayment),
                  paymentDay: editing.paymentDay,
                  remainingPeriods: editing.remainingPeriods,
                  lender: editing.lender,
                  status: editing.status,
                  note: editing.note
                }
              : { type: "mortgage", ownerName: "家庭共同", status: "active" }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              type: values.type,
              ownerName: values.ownerName,
              currentBalance: String(values.currentBalance),
              monthlyPayment:
                values.monthlyPayment == null ? undefined : String(values.monthlyPayment),
              paymentDay: values.paymentDay ?? undefined,
              remainingPeriods: values.remainingPeriods ?? undefined,
              lender: values.lender,
              status: values.status,
              note: values.note
            };
            return props.submit(
              () => (editing ? updateLiability(editing.id, payload) : createLiability(payload)),
              { success: editing ? "负债已更新" : "负债已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <LiabilityFormFields members={props.data.members} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
      <Drawer
        title="登记还款"
        open={repaying != null}
        onClose={() => setRepaying(null)}
        width={380}
        destroyOnHidden
      >
        {repaying ? (
          <Form
            form={repayForm}
            layout="vertical"
            initialValues={{ amount: Number(repaying.monthlyPayment ?? repaying.currentBalance) }}
            onFinish={(values) =>
              props.submit(
                () => repayLiability(repaying.id, { amount: String(values.amount) }),
                { success: "已登记还款", onSuccess: () => setRepaying(null) }
              )
            }
          >
            <div className="page-stack" style={{ marginBottom: 12 }}>
              <Text type="secondary">
                {repaying.name} · 当前余额 {formatMoney(repaying.currentBalance)}
                {repaying.remainingPeriods != null ? ` · 剩余 ${repaying.remainingPeriods} 期` : ""}
              </Text>
            </div>
            <Form.Item name="amount" label="本次还款金额" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} className="full-width" />
            </Form.Item>
            <Text type="secondary">确认后将从余额中扣除，剩余期数自动减一，扣清后标记为已结清。</Text>
            <Button type="primary" htmlType="button" onClick={() => repayForm.submit()} block style={{ marginTop: 12 }}>
              确认还款
            </Button>
          </Form>
        ) : null}
      </Drawer>
    </Space>
  );
}

function BudgetsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form] = Form.useForm();
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? { month: editing.month, categoryName: editing.categoryName, limitAmount: Number(editing.limitAmount) }
        : { month: props.monthKey, categoryName: undefined, limitAmount: undefined }
    );
  }, [open, editing, form, props.monthKey]);
  const usageByCategory = new Map(props.data.summary.budgetUsages.map((usage) => [usage.categoryName, usage]));
  return (
    <Card
      title={`${props.monthKey} 预算`}
      extra={
        <Button
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          新增预算
        </Button>
      }
    >
      <Table<Budget>
        rowKey="id" tableLayout="fixed"
        scroll={{ x: 720 }}
        dataSource={props.data.budgets}
        columns={[
          { title: "月份", dataIndex: "month", width: 110 },
          { title: "分类", dataIndex: "categoryName", width: 140 },
          { title: "预算", dataIndex: "limitAmount", width: 130, align: "right", render: (value: string) => formatMoney(value) },
          {
            title: "使用进度",
            width: 220,
            render: (_, record) => {
              const usage = usageByCategory.get(record.categoryName);
              const percent = usage ? Math.min(100, Math.round(usage.usageRate * 100)) : 0;
              return <Progress percent={percent} size="small" status={usage?.status === "over" ? "exception" : "active"} />;
            }
          },
          {
            title: "操作",
            key: "actions",
            width: 120,
            render: (_, record) => (
              <RowActions
                onEdit={() => {
                  setEditing(record);
                  setOpen(true);
                }}
                onDelete={() => props.submit(() => deleteBudget(record.id), { success: "预算已删除" })}
              />
            )
          }
        ]}
      />
      <Drawer
        title={editing ? "编辑预算" : "新增预算"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? { month: editing.month, categoryName: editing.categoryName, limitAmount: Number(editing.limitAmount) }
              : { month: props.monthKey }
          }
          onFinish={(values) => {
            const payload = {
              month: values.month,
              categoryName: values.categoryName,
              limitAmount: String(values.limitAmount)
            };
            return props.submit(
              () => (editing ? updateBudget(editing.id, payload) : createBudget(payload)),
              { success: editing ? "预算已更新" : "预算已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <Form.Item name="month" label="月份" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryName" label="分类" rules={[{ required: true }]}>
            <Select options={props.data.categories.filter((item) => item.kind === "expense").map(toSelectOption)} />
          </Form.Item>
          <Form.Item name="limitAmount" label="预算金额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => form.submit()} block>
            保存
          </Button>
        </Form>
      </Drawer>
    </Card>
  );
}

function InvestmentsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentHolding | null>(null);
  const [showProfitChart, setShowProfitChart] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            code: editing.code,
            type: editing.type,
            accountId: editing.accountId,
            marketValue: Number(editing.marketValue),
            profit: Number(editing.profit),
            note: editing.note
          }
        : {
            name: undefined,
            code: undefined,
            type: "fund",
            accountId: props.data.accounts.find((item) => item.type === "fund")?.id,
            marketValue: undefined,
            profit: undefined,
            note: undefined
          }
    );
  }, [open, editing, form, props.data.accounts]);
  const accountById = new Map(props.data.accounts.map((account) => [account.id, account]));
  const totalMarket = props.data.investments.reduce((sum, h) => sum + Number(h.marketValue), 0);
  const totalProfit = props.data.investments.reduce((sum, h) => sum + Number(h.profit), 0);
  const totalCost = totalMarket - totalProfit;
  const totalRate = totalCost !== 0 ? totalProfit / totalCost : 0;
  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="metric-card">
            <Statistic title="总金额" value={formatMoney(totalMarket.toFixed(2))} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className={`metric-card metric-card--${totalProfit >= 0 ? "asset" : "expense"}`}>
            <Statistic title="总收益" value={formatMoney(totalProfit.toFixed(2))} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="metric-card" style={{ cursor: "pointer" }} onClick={() => setShowProfitChart(true)}>
            <Statistic title="总收益率" value={`${(totalRate * 100).toFixed(2)}%`} />
          </Card>
        </Col>
      </Row>
      <Card
        title="投资持仓"
        extra={
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            新增持仓
          </Button>
        }
      >
        <Table<InvestmentHolding>
          rowKey="id"
          tableLayout="fixed"
          dataSource={props.data.investments}
          scroll={{ x: 1220 }}
          columns={[
            { title: "名称", dataIndex: "name", width: 160 },
            { title: "代码", dataIndex: "code", width: 100 },
            { title: "类型", dataIndex: "type", width: 100, render: renderHoldingType },
            { title: "当前金额", dataIndex: "marketValue", width: 120, align: "right", render: (value: string) => formatMoney(value) },
            {
              title: "当前收益",
              dataIndex: "profit",
              width: 120,
              align: "right",
              render: (value: string) => (
                <Text type={Number(value) >= 0 ? "danger" : "success"}>{formatMoney(value)}</Text>
              )
            },
            {
              title: "收益率",
              key: "rate",
              width: 100,
              align: "right",
              render: (_, record) => {
                const cost = Number(record.marketValue) - Number(record.profit);
                const rate = cost !== 0 ? Number(record.profit) / cost : 0;
                const color = rate >= 0 ? "red" : "green";
                return (
                  <Tag color={color}>{`${(rate * 100).toFixed(2)}%`}</Tag>
                );
              }
            },
            {
              title: "所属账户",
              dataIndex: "accountId",
              width: 140,
              render: (accountId: string) => accountById.get(accountId)?.name ?? "—"
            },
            {
              title: "成员",
              key: "owner",
              width: 100,
              render: (_, record) => accountById.get(record.accountId)?.ownerName ?? "—"
            },
            { title: "备注", dataIndex: "note", width: 160 },
            {
              title: "操作",
              key: "actions",
              width: 120,
              render: (_, record) => (
                <RowActions
                  onEdit={() => {
                    setEditing(record);
                    setOpen(true);
                  }}
                  onDelete={() => props.submit(() => deleteInvestment(record.id), { success: "持仓已删除" })}
                />
              )
            }
          ]}
        />
      </Card>
      <Drawer
        title={editing ? "编辑持仓" : "新增持仓"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  code: editing.code,
                  type: editing.type,
                  accountId: editing.accountId,
                  marketValue: Number(editing.marketValue),
                  profit: Number(editing.profit),
                  note: editing.note
                }
              : { type: "fund", accountId: props.data.accounts.find((item) => item.type === "fund")?.id }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              code: values.code,
              type: values.type,
              accountId: values.accountId,
              marketValue: String(values.marketValue),
              profit: String(values.profit),
              note: values.note
            };
            return props.submit(
              () => (editing ? updateInvestment(editing.id, payload) : createInvestment(payload)),
              { success: editing ? "持仓已更新" : "持仓已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <InvestmentFormFields accounts={props.data.accounts} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
      <Modal
        title="总收益走势"
        open={showProfitChart}
        onCancel={() => setShowProfitChart(false)}
        footer={null}
        width={600}
        destroyOnHidden
      >
        {showProfitChart && <ProfitTrendChart data={props.data.assetTrend} />}
      </Modal>
    </Space>
  );
}

function ProfitTrendChart({ data }: { data: AssetTrendPoint[] }) {
  if (data.length < 2) {
    return <Text type="secondary">数据不足，暂无收益走势图</Text>;
  }
  const chartData = data.map((p) => Number(p.totalAssets));
  return (
    <div>
      <Line data={data} xField="date" yField="totalAssets" height={300} smooth color={data.length > 0 && Number(data[data.length - 1]!.totalAssets) >= Number(data[0]!.totalAssets) ? "#cf1322" : "#3f8600"} point={{ size: 3 }} axis={{ y: { labelFormatter: (value: string) => formatMoney(value) } }} />
    </div>
  );
}

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
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [points, setPoints] = useState<AccountSnapshotPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listAccountSnapshots(accountId)
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .catch((e) => {
        console.error("listAccountSnapshots failed", e);
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

function SnapshotRecordsTab({ data, submit }: { data: AppData; submit: PageProps["submit"] }) {
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [records, setRecords] = useState<AccountSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    listAllSnapshots({
      accountId,
      from: range?.[0]?.format("YYYY-MM-DD"),
      to: range?.[1]?.format("YYYY-MM-DD")
    })
      .then((r) => {
        if (requestId === requestIdRef.current) setRecords(r);
      })
      .catch((e) => {
        console.error("listAllSnapshots failed", e);
        if (requestId === requestIdRef.current) setRecords([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
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
          rowKey="id"
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

function SettingsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditing, setMemberEditing] = useState<FamilyMemberInfo | null>(null);
  const [memberForm] = Form.useForm();
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing ? { name: editing.name, kind: editing.kind } : { name: undefined, kind: "expense" }
    );
  }, [open, editing, form]);
  useEffect(() => {
    if (!memberOpen) return;
    memberForm.setFieldsValue({
      name: memberEditing ? memberEditing.name : undefined,
      icon: memberEditing?.icon ?? "user"
    });
  }, [memberOpen, memberEditing, memberForm]);
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={8}>
        <Card
          title="家庭成员"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setMemberEditing(null);
                setMemberOpen(true);
              }}
            >
              新增成员
            </Button>
          }
        >
          <Table<FamilyMemberInfo>
            rowKey="id"
            size="middle"
            pagination={false}
            scroll={{ x: 280 }}
            dataSource={props.data.familyMembers}
            columns={[
              {
                title: "成员",
                dataIndex: "name",
                width: 160,
                render: (value: string, record) => (
                  <Space size={6}>
                    {renderMemberIcon(record.icon)}
                    <span>{value}</span>
                  </Space>
                )
              },
              {
                title: "操作",
                key: "actions",
                width: 120,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => {
                      setMemberEditing(record);
                      setMemberOpen(true);
                    }}
                    onDelete={() => props.submit(() => deleteMember(record.id), { success: "成员已删除" })}
                  />
                )
              }
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} lg={16}>
        <Card
          title="分类"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新增分类
            </Button>
          }
        >
          <Table<Category>
            rowKey="id" tableLayout="fixed"
            size="middle"
            pagination={false}
            scroll={{ x: 416 }}
            dataSource={props.data.categories}
            columns={[
              {
                title: "名称",
                dataIndex: "name",
                width: 200,
                render: (value: string, record) => (
                  <Space size={6}>
                    <span>{value}</span>
                    {record.isDefault ? <Tag color="default">默认</Tag> : null}
                  </Space>
                )
              },
              { title: "类型", dataIndex: "kind", width: 96, render: renderTransactionKind },
              {
                title: "操作",
                key: "actions",
                width: 120,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => {
                      setEditing(record);
                      setOpen(true);
                    }}
                    onDelete={() => props.submit(() => deleteCategory(record.id), { success: "分类已删除" })}
                  />
                )
              }
            ]}
          />
        </Card>
      </Col>
      <Col span={24}>
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_DEFAULT}
            description="导入导出、备份恢复和多设备同步将在后续版本接入"
          />
        </Card>
      </Col>
      <Drawer
        title={editing ? "编辑分类" : "新增分类"}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ kind: "expense" }}
          onFinish={(values) => {
            const payload = { name: values.name, kind: values.kind };
            return props.submit(
              () => (editing ? updateCategory(editing.id, payload) : createCategory(payload)),
              { success: editing ? "分类已更新" : "分类已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input placeholder="如：餐饮、工资" />
          </Form.Item>
          <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "支出", value: "expense" },
                { label: "收入", value: "income" },
                { label: "转账", value: "transfer" },
                { label: "调整", value: "adjustment" }
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => form.submit()} block>
            保存
          </Button>
        </Form>
      </Drawer>
      <Drawer
        title={memberEditing ? "编辑成员" : "新增成员"}
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        width={420}
        destroyOnHidden
      >
        <Form
          form={memberForm}
          layout="vertical"
          initialValues={{ icon: "user" }}
          onFinish={(values) => {
            const payload = { name: values.name, icon: values.icon };
            return props.submit(
              () => (memberEditing ? updateMember(memberEditing.id, payload) : createMember(payload)),
              { success: memberEditing ? "成员已更新" : "成员已新增", onSuccess: () => setMemberOpen(false) }
            );
          }}
        >
          <Form.Item name="name" label="成员名称" rules={[{ required: true }]}>
            <Input placeholder="如：雄哥、瑶雯" />
          </Form.Item>
          <Form.Item name="icon" label="图标" rules={[{ required: true }]}>
            <Select options={memberIconOptions} />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => memberForm.submit()} block>
            保存
          </Button>
        </Form>
      </Drawer>
    </Row>
  );
}

interface PageProps {
  data: AppData;
  monthKey: string;
  reload: () => Promise<void>;
  submit: (
    run: () => Promise<unknown>,
    options: { success: string; onSuccess?: () => void }
  ) => Promise<void>;
}

function TransactionFormFields({ data, onSubmit }: { data: AppData; onSubmit: () => void }) {
  return (
    <>
      <Form.Item name="date" label="日期" rules={[{ required: true }]}>
        <DatePicker className="full-width" />
      </Form.Item>
      <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "支出", value: "expense" },
            { label: "收入", value: "income" },
            { label: "转账", value: "transfer" },
            { label: "调整", value: "adjustment" }
          ]}
        />
      </Form.Item>
      <Form.Item name="categoryName" label="分类" rules={[{ required: true }]}>
        <Select options={data.categories.map(toSelectOption)} />
      </Form.Item>
      <Form.Item name="accountId" label="账户（可选）">
        <Select
          allowClear
          placeholder="不关联账户"
          options={data.accounts.map((account) => ({ label: account.name, value: account.id }))}
        />
      </Form.Item>
      <Form.Item name="memberName" label="成员" rules={[{ required: true }]}>
        <Select options={data.members.map((member) => ({ label: member, value: member }))} />
      </Form.Item>
      <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="note" label="备注">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="button" onClick={onSubmit} block>
        保存
      </Button>
    </>
  );
}

function AccountFormFields({ members, onSubmit }: { members: string[]; onSubmit: () => void }) {
  return (
    <>
      <Form.Item name="name" label="账户名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="type" label="账户类型" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "银行卡", value: "bankCard" },
            { label: "现金", value: "cash" },
            { label: "支付宝", value: "alipay" },
            { label: "微信", value: "wechat" },
            { label: "基金", value: "fund" },
            { label: "股票", value: "stock" },
            { label: "其他", value: "other" }
          ]}
        />
      </Form.Item>
      <Form.Item name="ownerName" label="归属" rules={[{ required: true }]}>
        <Select options={members.map((member) => ({ label: member, value: member }))} />
      </Form.Item>
      <Form.Item name="currentValue" label="当前金额" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="note" label="备注">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="button" onClick={onSubmit} block>
        保存
      </Button>
    </>
  );
}

function LiabilityFormFields({ members, onSubmit }: { members: string[]; onSubmit: () => void }) {
  return (
    <>
      <Form.Item name="name" label="负债名称" rules={[{ required: true }]}>
        <Input placeholder="如：招行首套房贷" />
      </Form.Item>
      <Form.Item name="type" label="类型" rules={[{ required: true }]}>
        <Select options={liabilityTypeOptions} />
      </Form.Item>
      <Form.Item name="ownerName" label="归属" rules={[{ required: true }]}>
        <Select options={members.map((member) => ({ label: member, value: member }))} />
      </Form.Item>
      <Form.Item name="currentBalance" label="当前余额" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="monthlyPayment" label="月供（可选）">
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="paymentDay" label="还款日（每月几号，可选）">
        <InputNumber min={1} max={31} precision={0} className="full-width" />
      </Form.Item>
      <Form.Item name="remainingPeriods" label="剩余期数（可选）">
        <InputNumber min={0} precision={0} className="full-width" />
      </Form.Item>
      <Form.Item name="lender" label="债权机构（可选）">
        <Input placeholder="如：招商银行" />
      </Form.Item>
      <Form.Item name="status" label="状态" rules={[{ required: true }]}>
        <Select options={liabilityStatusOptions} />
      </Form.Item>
      <Form.Item name="note" label="备注">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="button" onClick={onSubmit} block>
        保存
      </Button>
    </>
  );
}

function InvestmentFormFields({ accounts, onSubmit }: { accounts: Account[]; onSubmit: () => void }) {
  return (
    <>
      <Form.Item name="name" label="名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="code" label="代码" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="type" label="类型" rules={[{ required: true }]}>
        <Select
          options={[
            { label: "基金", value: "fund" },
            { label: "股票", value: "stock" },
            { label: "ETF", value: "etf" }
          ]}
        />
      </Form.Item>
      <Form.Item name="accountId" label="所属账户" rules={[{ required: true }]}>
        <Select options={accounts.map((account) => ({ label: account.name, value: account.id }))} />
      </Form.Item>
      <Form.Item name="marketValue" label="当前金额" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="profit" label="当前收益（可为负）" rules={[{ required: true }]}>
        <InputNumber precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="note" label="备注">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Button type="primary" htmlType="button" onClick={onSubmit} block>
        保存
      </Button>
    </>
  );
}

function formatDateTime(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "—";
}

const memberIcons: { key: string; label: string; node: ReactNode }[] = [
  { key: "user", label: "用户", node: <UserOutlined /> },
  { key: "man", label: "男士", node: <ManOutlined /> },
  { key: "woman", label: "女士", node: <WomanOutlined /> },
  { key: "home", label: "家", node: <HomeOutlined /> },
  { key: "team", label: "家庭", node: <TeamOutlined /> },
  { key: "smile", label: "笑脸", node: <SmileOutlined /> },
  { key: "heart", label: "爱心", node: <HeartOutlined /> },
  { key: "crown", label: "皇冠", node: <CrownOutlined /> },
  { key: "star", label: "星星", node: <StarOutlined /> },
  { key: "gift", label: "礼物", node: <GiftOutlined /> },
  { key: "skin", label: "衣服", node: <SkinOutlined /> }
];

const memberIconOptions = memberIcons.map((item) => ({
  value: item.key,
  label: (
    <Space size={8}>
      {item.node}
      <span>{item.label}</span>
    </Space>
  )
}));

function renderMemberIcon(icon?: string): ReactNode {
  return memberIcons.find((item) => item.key === icon)?.node ?? <UserOutlined />;
}

function MemberSubcards({
  rows,
  iconByName,
  side
}: {
  rows: { name: string; amount: string }[];
  iconByName: Map<string, string | undefined>;
  side?: boolean;
}) {
  if (!rows.length) {
    return <Text type="secondary">本月暂无</Text>;
  }
  return (
    <div className={side ? "member-subcards member-subcards--side" : "member-subcards"}>
      {rows.map((row) => (
        <div className="member-subcard" key={row.name}>
          <span className="member-subcard-name">
            {renderMemberIcon(iconByName.get(row.name))}
            <span>{row.name}</span>
          </span>
          <span className="member-subcard-value">{formatMoney(row.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Space size={4}>
      <Button type="link" size="small" onClick={onEdit}>
        编辑
      </Button>
      <Popconfirm
        title="确认删除？"
        description="删除后将从列表中移除。"
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onConfirm={onDelete}
      >
        <Button type="link" size="small" danger>
          删除
        </Button>
      </Popconfirm>
    </Space>
  );
}

function pageTitle(activePage: PageKey): string {
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
}

const liabilityTypeLabels: Record<Liability["type"], string> = {
  mortgage: "房贷",
  carLoan: "车贷",
  consumerInstallment: "消费分期",
  creditCard: "信用卡",
  privateLoan: "私人借款",
  other: "其他"
};

const liabilityStatusLabels: Record<Liability["status"], string> = {
  active: "进行中",
  paidOff: "已结清",
  closed: "已关闭"
};

const liabilityTypeOptions = (Object.keys(liabilityTypeLabels) as Liability["type"][]).map((value) => ({
  label: liabilityTypeLabels[value],
  value
}));

const liabilityStatusOptions = (Object.keys(liabilityStatusLabels) as Liability["status"][]).map(
  (value) => ({ label: liabilityStatusLabels[value], value })
);

function renderLiabilityType(type: Liability["type"]) {
  return <Tag color="volcano">{liabilityTypeLabels[type]}</Tag>;
}

function renderLiabilityStatus(status: Liability["status"]) {
  const color = status === "active" ? "blue" : status === "paidOff" ? "green" : "default";
  return <Tag color={color}>{liabilityStatusLabels[status]}</Tag>;
}

function toSelectOption(category: Category) {
  return { label: category.name, value: category.name };
}

function renderTransactionKind(kind: FinanceTransaction["kind"]) {
  const map = {
    expense: ["支出", "red"],
    income: ["收入", "green"],
    transfer: ["转账", "blue"],
    adjustment: ["调整", "gold"]
  } as const;
  const [label, color] = map[kind];
  return <Tag color={color}>{label}</Tag>;
}

function renderChange(change: number | null): ReactNode {
  if (change === null) return <Tag>初始</Tag>;
  if (change === 0) return <Tag color="default">¥0.00</Tag>;
  const color = change > 0 ? "red" : "green";
  const sign = change > 0 ? "+" : "";
  return <Tag color={color}>{sign}{formatMoney(change.toFixed(2))}</Tag>;
}

function renderAccountType(type: Account["type"]) {
  const map: Record<Account["type"], { label: string; color: string }> = {
    bankCard: { label: "银行卡", color: "blue" },
    cash: { label: "现金", color: "green" },
    alipay: { label: "支付宝", color: "cyan" },
    wechat: { label: "微信", color: "geekblue" },
    fund: { label: "基金", color: "orange" },
    stock: { label: "股票", color: "volcano" },
    other: { label: "其他", color: "default" }
  };
  const { label, color } = map[type];
  return <Tag color={color}>{label}</Tag>;
}

const memberColors = ["magenta", "purple", "cyan", "orange", "green", "blue", "gold", "lime", "geekblue", "volcano"];
function getMemberColor(name: string, members: string[]): string {
  const index = members.indexOf(name);
  return index >= 0 ? memberColors[index % memberColors.length]! : "default";
}

function renderOwnerTag(ownerName: string, members: string[]) {
  return <Tag color={getMemberColor(ownerName, members)}>{ownerName}</Tag>;
}

function renderHoldingType(type: InvestmentHolding["type"]) {
  const map = {
    fund: "基金",
    stock: "股票",
    etf: "ETF"
  };
  return <Tag color="purple">{map[type]}</Tag>;
}
