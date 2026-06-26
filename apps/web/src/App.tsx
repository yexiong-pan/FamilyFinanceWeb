import {
  BankOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  DollarOutlined,
  FundProjectionScreenOutlined,
  HomeOutlined,
  PieChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  WalletOutlined
} from "@ant-design/icons";
import type {
  Account,
  Budget,
  DashboardSummary,
  FinanceTransaction,
  InvestmentHolding
} from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";
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
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Column, Line, Pie } from "@ant-design/charts";
import dayjs, { type Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AppData,
  type Category,
  createAccount,
  createBudget,
  createInvestment,
  createTransaction,
  loadAppData
} from "./api/client";
import { buildDashboardViewModel } from "./data/view-model";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type PageKey = "dashboard" | "transactions" | "accounts" | "budgets" | "investments" | "settings";

const emptySummary: DashboardSummary = {
  totalAssets: "0.00",
  monthlyExpense: "0.00",
  monthlyIncome: "0.00",
  monthlyBalance: "0.00",
  investmentMarketValue: "0.00",
  investmentCost: "0.00",
  investmentProfit: "0.00",
  investmentProfitRate: 0,
  categoryBreakdown: [],
  budgetUsages: []
};

const emptyData: AppData = {
  summary: emptySummary,
  members: [],
  categories: [],
  accounts: [],
  transactions: [],
  budgets: [],
  investments: []
};

export default function App() {
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

  const commonProps = {
    data,
    monthKey,
    reload,
    notify: (content: string) => message.success(content)
  };

  return (
    <AntApp>
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
              { key: "budgets", icon: <BarChartOutlined />, label: "预算" },
              { key: "investments", icon: <FundProjectionScreenOutlined />, label: "投资持仓" },
              { key: "settings", icon: <SettingOutlined />, label: "设置" }
            ]}
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <div>
              <Title level={screens.md ? 3 : 4} className="page-title">
                {pageTitle(activePage)}
              </Title>
              <Text type="secondary">所有成员都是管理员，第一版不做权限分层。</Text>
            </div>
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
              {activePage === "budgets" ? <BudgetsPage {...commonProps} /> : null}
              {activePage === "investments" ? <InvestmentsPage {...commonProps} /> : null}
              {activePage === "settings" ? <SettingsPage data={data} /> : null}
            </Spin>
          </Content>
        </Layout>
      </Layout>
    </AntApp>
  );
}

function DashboardPage({ data }: { data: AppData }) {
  const model = buildDashboardViewModel(data.summary);
  const trendData = [
    { month: "1月", value: 18200 },
    { month: "2月", value: 20800 },
    { month: "3月", value: 17600 },
    { month: "4月", value: 24600 },
    { month: "5月", value: 22100 },
    { month: "6月", value: Number.parseFloat(data.summary.monthlyBalance) }
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        {model.metrics.map((metric) => (
          <Col xs={24} sm={12} lg={8} key={metric.title}>
            <Card className="metric-card">
              <Statistic title={metric.title} value={metric.value} />
              {metric.trend ? <Text type="secondary">{metric.trend}</Text> : null}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card title="收支结余趋势" className="chart-card">
            <Line
              data={trendData}
              xField="month"
              yField="value"
              height={260}
              point={{ size: 4 }}
              color="#1677ff"
              axis={{ y: { labelFormatter: (value: string) => `${Number(value) / 1000}k` } }}
            />
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
          <Card title="资产账户" className="list-card">
            <Table<Account>
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={data.accounts}
              columns={[
                { title: "账户", dataIndex: "name" },
                { title: "类型", dataIndex: "type", render: renderAccountType },
                { title: "归属", dataIndex: "ownerName" },
                {
                  title: "当前金额",
                  dataIndex: "currentValue",
                  align: "right",
                  render: (value: string) => formatMoney(value)
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
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const filtered = props.data.transactions.filter((transaction) => {
    const kindMatched = kind === "all" || transaction.kind === kind;
    const keywordMatched = `${transaction.categoryName}${transaction.memberName}${transaction.note ?? ""}`.includes(
      keyword
    );
    return kindMatched && keywordMatched;
  });

  const columns: ColumnsType<FinanceTransaction> = [
    { title: "日期", dataIndex: "date", width: 120 },
    { title: "类型", dataIndex: "kind", width: 96, render: renderTransactionKind },
    { title: "分类", dataIndex: "categoryName" },
    { title: "成员", dataIndex: "memberName" },
    {
      title: "金额",
      dataIndex: "amount",
      align: "right",
      render: (value: string, record) => (
        <Text type={record.kind === "expense" ? "danger" : "success"}>{formatMoney(value)}</Text>
      )
    },
    { title: "备注", dataIndex: "note" }
  ];

  return (
    <Card
      title="收支流水"
      extra={<Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新增流水</Button>}
    >
      <Space direction="vertical" size={16} className="page-stack">
        <Flex gap={12} wrap="wrap" justify="space-between">
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
          <Input.Search placeholder="搜索分类、成员、备注" allowClear onSearch={setKeyword} onChange={(event) => setKeyword(event.target.value)} />
        </Flex>
        <Table rowKey="id" dataSource={filtered} columns={columns} scroll={{ x: 760 }} />
      </Space>
      <Drawer title="新增流水" open={open} onClose={() => setOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ date: dayjs(), kind: "expense", memberName: "家庭共同" }}
          onFinish={async (values) => {
            await createTransaction({
              date: values.date.format("YYYY-MM-DD"),
              kind: values.kind,
              categoryName: values.categoryName,
              accountId: values.accountId,
              memberName: values.memberName,
              amount: String(values.amount),
              note: values.note
            });
            props.notify("流水已新增");
            setOpen(false);
            await props.reload();
          }}
        >
          <TransactionFormFields data={props.data} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
    </Card>
  );
}

function AccountsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  return (
    <Card
      title="资产账户"
      extra={<Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新增账户</Button>}
    >
      <Table<Account>
        rowKey="id"
        dataSource={props.data.accounts}
        scroll={{ x: 760 }}
        columns={[
          { title: "账户", dataIndex: "name" },
          { title: "类型", dataIndex: "type", render: renderAccountType },
          { title: "归属", dataIndex: "ownerName" },
          { title: "备注", dataIndex: "note" },
          { title: "当前金额", dataIndex: "currentValue", align: "right", render: (value: string) => formatMoney(value) }
        ]}
      />
      <Drawer title="新增账户" open={open} onClose={() => setOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: "bankCard", ownerName: "家庭共同" }}
          onFinish={async (values) => {
            await createAccount({
              name: values.name,
              type: values.type,
              ownerName: values.ownerName,
              currentValue: String(values.currentValue),
              note: values.note
            });
            props.notify("账户已新增");
            setOpen(false);
            await props.reload();
          }}
        >
          <AccountFormFields onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
    </Card>
  );
}

function BudgetsPage(props: PageProps) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const usageByCategory = new Map(props.data.summary.budgetUsages.map((usage) => [usage.categoryName, usage]));
  return (
    <Card
      title={`${props.monthKey} 预算`}
      extra={<Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新增预算</Button>}
    >
      <Table<Budget>
        rowKey="id"
        dataSource={props.data.budgets}
        columns={[
          { title: "月份", dataIndex: "month", width: 110 },
          { title: "分类", dataIndex: "categoryName" },
          { title: "预算", dataIndex: "limitAmount", align: "right", render: (value: string) => formatMoney(value) },
          {
            title: "使用进度",
            render: (_, record) => {
              const usage = usageByCategory.get(record.categoryName);
              const percent = usage ? Math.min(100, Math.round(usage.usageRate * 100)) : 0;
              return <Progress percent={percent} size="small" status={usage?.status === "over" ? "exception" : "active"} />;
            }
          }
        ]}
      />
      <Drawer title="新增预算" open={open} onClose={() => setOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ month: props.monthKey }}
          onFinish={async (values) => {
            await createBudget({
              month: values.month,
              categoryName: values.categoryName,
              limitAmount: String(values.limitAmount)
            });
            props.notify("预算已新增");
            setOpen(false);
            await props.reload();
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
  const [form] = Form.useForm();
  return (
    <Card
      title="投资持仓"
      extra={<Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>新增持仓</Button>}
    >
      <Table<InvestmentHolding>
        rowKey="id"
        dataSource={props.data.investments}
        scroll={{ x: 900 }}
        columns={[
          { title: "名称", dataIndex: "name" },
          { title: "代码", dataIndex: "code", width: 110 },
          { title: "类型", dataIndex: "type", width: 100, render: renderHoldingType },
          { title: "市值", dataIndex: "marketValue", align: "right", render: (value: string) => formatMoney(value) },
          { title: "成本", dataIndex: "cost", align: "right", render: (value: string) => formatMoney(value) },
          { title: "数量", dataIndex: "quantity", align: "right" },
          { title: "备注", dataIndex: "note" }
        ]}
      />
      <Drawer title="新增持仓" open={open} onClose={() => setOpen(false)} width={420} destroyOnClose>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: "fund", accountId: props.data.accounts.find((item) => item.type === "fund")?.id }}
          onFinish={async (values) => {
            await createInvestment({
              name: values.name,
              code: values.code,
              type: values.type,
              accountId: values.accountId,
              marketValue: String(values.marketValue),
              cost: String(values.cost),
              quantity: String(values.quantity),
              note: values.note
            });
            props.notify("持仓已新增");
            setOpen(false);
            await props.reload();
          }}
        >
          <InvestmentFormFields accounts={props.data.accounts} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
    </Card>
  );
}

function SettingsPage({ data }: { data: AppData }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="家庭成员">
          <Space wrap>
            {data.members.map((member) => (
              <Tag icon={<HomeOutlined />} color="blue" key={member}>
                {member} · Owner
              </Tag>
            ))}
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="分类">
          <Space wrap>
            {data.categories.map((category) => (
              <Tag color={category.kind === "expense" ? "red" : "green"} key={category.id}>
                {category.name}
              </Tag>
            ))}
          </Space>
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
    </Row>
  );
}

interface PageProps {
  data: AppData;
  monthKey: string;
  reload: () => Promise<void>;
  notify: (content: string) => void;
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
      <Form.Item name="accountId" label="账户" rules={[{ required: true }]}>
        <Select options={data.accounts.map((account) => ({ label: account.name, value: account.id }))} />
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

function AccountFormFields({ onSubmit }: { onSubmit: () => void }) {
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
        <Select options={["丈夫", "妻子", "家庭共同"].map((value) => ({ label: value, value }))} />
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
      <Form.Item name="marketValue" label="市值" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="cost" label="成本" rules={[{ required: true }]}>
        <InputNumber min={0} precision={2} className="full-width" />
      </Form.Item>
      <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
        <InputNumber min={0} precision={4} className="full-width" />
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

function pageTitle(activePage: PageKey): string {
  return {
    dashboard: "仪表盘",
    transactions: "收支流水",
    accounts: "资产账户",
    budgets: "预算",
    investments: "投资持仓",
    settings: "设置"
  }[activePage];
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

function renderAccountType(type: Account["type"]) {
  const map: Record<Account["type"], string> = {
    bankCard: "银行卡",
    cash: "现金",
    alipay: "支付宝",
    wechat: "微信",
    fund: "基金",
    stock: "股票",
    other: "其他"
  };
  return <Tag icon={<DollarOutlined />}>{map[type]}</Tag>;
}

function renderHoldingType(type: InvestmentHolding["type"]) {
  const map = {
    fund: "基金",
    stock: "股票",
    etf: "ETF"
  };
  return <Tag color="purple">{map[type]}</Tag>;
}
