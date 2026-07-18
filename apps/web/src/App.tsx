import {
  BankOutlined,
  BarChartOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  CrownOutlined,
  DatabaseOutlined,
  FundProjectionScreenOutlined,
  GiftOutlined,
  HeartOutlined,
  HistoryOutlined,
  HomeOutlined,
  LeftOutlined,
  ManOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PieChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SettingOutlined,
  SkinOutlined,
  SmileOutlined,
  StarOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  WomanOutlined
} from "@ant-design/icons";
import type {
  Account,
  AccountTypeOption,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MonthlySnapshotData,
  TransactionPage,
  YearlyReportData
} from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Checkbox,
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
  Pagination,
  Popconfirm,
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
import { Column, Line, Pie } from "./LazyCharts";
import dayjs, { type Dayjs } from "dayjs";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  type AppData,
  type Category,
  type CategoryMapping,
  confirmTransaction,
  createAccount,
  createAccountType,
  createCategory,
  createCategoryMapping,
  createInvestment,
  createLiability,
  createMember,
  createTransaction,
  confirmMonthlySpending,
  deleteAccount,
  deleteAccountType,
  deleteCategory,
  deleteCategoryMapping,
  deleteInvestment,
  deleteLiability,
  deleteMember,
  deleteTransaction,
  getMonthlySnapshot,
  getTransactionPage,
  getYearlyReport,
  importTransactions,
  loadAppData,
  repayLiability,
  updateAccount,
  updateAccountType,
  snapshotAllAccounts,
  snapshotAllInvestments,
  snapshotAllLiabilities,
  updateCategory,
  updateCategoryMapping,
  updateInvestment,
  updateLiability,
  updateMember,
  updateTransaction
} from "./api/client";
import { buildMonthlyReportViewModel } from "./data/view-model";
import {
  buildAnnualCashflowTrend,
  buildAssetAllocation,
  buildLiabilityProgress,
  buildNetWorthTrend
} from "./data/financial-charts";
import {
  buildCategoryDrilldown,
  buildSpendingView,
  filterTransactionsByConfirmation,
  sumCashflowTransactions
} from "./data/spending";
import {
  type CashflowFilters,
  parseCashflowFilters,
  writeCashflowFilters
} from "./data/cashflow-route";
import { buildIncomeView } from "./data/income";
import {
  buildInvestmentAmountsFromProfit,
  investmentCostValue,
  investmentReturnRateValue
} from "./data/investment";
import { buildCategoryChangeInput } from "./data/transaction-edit";
import { type ParsedBill, parseAlipayBill, parseWechatWorkbook, summarizeBill } from "./data/alipay-import";
import { applySavedCategoryMappings } from "./data/import-mapping";
import { buildMobileTransactionCard } from "./data/mobile";
import { buildTransactionPageQuery, countActiveCashflowFilters } from "./data/cashflow-page";
import { buildLiabilityCoverage, financialMetricValue, snapshotComparisonRows, yearlySnapshotLabel } from "./data/financial-status";
import { buildAssetInsights, buildInvestmentInsights, buildLiabilityRisk } from "./data/financial-insights";
import {
  type AppRoute,
  type CashflowTabKey,
  type CheckupTabKey,
  type PageKey,
  type ReportTabKey,
  cashflowFiltersForTransition,
  defaultRouteForPage,
  pageMenuItems,
  routeForMonthlyReview,
  routeFromPath,
  shiftMonthKey,
  urlForRoute
} from "./navigation";
import { accountTypeOptionsFromSettings, getAccountTypeMeta } from "./accountTypes";
import { RatioProgress } from "./RatioProgress";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const MOBILE_TRANSACTION_PAGE_SIZE = 20;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "family-finance.sidebar-collapsed";

function periodFromLocation(route: AppRoute): Dayjs {
  const params = new URLSearchParams(window.location.search);
  if (route.page === "report" && route.tab === "yearly") {
    const year = params.get("year");
    return year && /^\d{4}$/.test(year) ? dayjs(`${year}-01-01`) : dayjs().startOf("year");
  }
  const month = params.get("month");
  return month && /^\d{4}-\d{2}$/.test(month) ? dayjs(`${month}-01`) : dayjs().startOf("month");
}

const pageIcons: Record<PageKey, ReactNode> = {
  report: <PieChartOutlined />,
  spending: <DatabaseOutlined />,
  income: <BarChartOutlined />,
  checkup: <BankOutlined />,
  settings: <SettingOutlined />
};

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
  accountTypes: [],
  categories: [],
  categoryMappings: [],
  accounts: [],
  transactions: [],
  investments: [],
  liabilities: [],
  monthlyReview: {
    month: dayjs().format("YYYY-MM"),
    spending: false,
    assets: false,
    liabilities: false,
    investments: false
  }
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
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => routeFromPath(window.location.pathname));
  const [month, setMonth] = useState<Dayjs>(() => periodFromLocation(routeFromPath(window.location.pathname)));
  const [cashflowFilters, setCashflowFilters] = useState<CashflowFilters>(() => {
    const route = routeFromPath(window.location.pathname);
    return route.page === "spending" || route.page === "income"
      ? parseCashflowFilters(new URLSearchParams(window.location.search))
      : {};
  });
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siderCollapsed, setSiderCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
  );

  useEffect(() => {
    const handlePopState = () => {
      const route = routeFromPath(window.location.pathname);
      const routeMonth = periodFromLocation(route);
      const routeFilters = route.page === "spending" || route.page === "income"
        ? parseCashflowFilters(new URLSearchParams(window.location.search))
        : {};
      setActiveRoute(route);
      setMonth(routeMonth);
      setCashflowFilters(routeFilters);
      const canonicalUrl = urlForRoute(route, routeMonth.format("YYYY-MM"), routeFilters);
      if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) {
        window.history.replaceState(null, "", canonicalUrl);
      }
    };
    handlePopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const monthKey = month.format("YYYY-MM");
  const isYearlyReport = activeRoute.page === "report" && activeRoute.tab === "yearly";
  const includeTransactions = (
    activeRoute.page === "report" && activeRoute.tab === "monthly"
  ) || ((activeRoute.page === "spending" || activeRoute.page === "income") && activeRoute.tab === "summary");
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadAppData(monthKey, { includeTransactions }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [includeTransactions, monthKey]);

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

  const activePage = activeRoute.page;
  const navigateToRoute = useCallback((route: AppRoute, suppliedFilters?: CashflowFilters) => {
    const nextFilters = cashflowFiltersForTransition(
      activeRoute,
      route,
      cashflowFilters,
      suppliedFilters
    );
    setActiveRoute(route);
    setCashflowFilters(nextFilters);
    const nextUrl = urlForRoute(route, month.format("YYYY-MM"), nextFilters);
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }, [activeRoute, cashflowFilters, month]);

  const replaceCashflowFilters = useCallback((filters: CashflowFilters) => {
    const normalized = parseCashflowFilters(writeCashflowFilters(new URLSearchParams(), filters));
    setCashflowFilters(normalized);
    const nextUrl = urlForRoute(activeRoute, month.format("YYYY-MM"), normalized);
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [activeRoute, month]);

  const navigateToPage = useCallback((page: PageKey) => {
    navigateToRoute(defaultRouteForPage(page));
  }, [navigateToRoute]);

  const navigateToMonthReport = useCallback((monthKey: string) => {
    const route: AppRoute = { page: "report", tab: "monthly" };
    setMonth(dayjs(`${monthKey}-01`));
    setActiveRoute(route);
    setCashflowFilters({});
    window.history.pushState(null, "", urlForRoute(route, monthKey));
  }, []);

  const changeMonthBy = useCallback((offset: -1 | 1) => {
    const nextMonthKey = shiftMonthKey(monthKey, offset);
    setMonth(dayjs(`${nextMonthKey}-01`));
    window.history.pushState(null, "", urlForRoute(activeRoute, nextMonthKey, cashflowFilters));
  }, [activeRoute, cashflowFilters, monthKey]);

  return (
    <Layout className="app-shell">
      <Sider
        width={220}
        collapsedWidth={72}
        collapsible
        collapsed={siderCollapsed}
        onCollapse={(collapsed) => {
          setSiderCollapsed(collapsed);
          window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
        }}
        trigger={
          <span
            className="sider-trigger-content"
            aria-label={siderCollapsed ? "展开侧边栏" : "收起侧边栏"}
            title={siderCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            <span className="sider-trigger-label">{siderCollapsed ? "展开" : "收起"}</span>
          </span>
        }
        className="app-sider"
      >
          <div className="brand-block">
            <div className="brand-mark">
              <img className="brand-mark-image" src="/oreo-icon.png" alt="奥利奥" />
            </div>
            <div className="brand-copy">
              <Text strong>家庭财务</Text>
              <div className="brand-subtitle">Owner 工作台</div>
            </div>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activePage]}
            onSelect={({ key }) => navigateToPage(key as PageKey)}
            items={pageMenuItems.map((item) => ({
              key: item.key,
              icon: pageIcons[item.key],
              label: item.label
            }))}
          />
        </Sider>
        <Layout>
          <Header className="app-header">
            <Title level={screens.md ? 4 : 5} className="page-title">
              {pageTitle(activePage)}
            </Title>
            <Space wrap>
              <div className="month-navigation">
                {!isYearlyReport ? (
                  <Button
                    className="month-nav-button"
                    icon={<LeftOutlined />}
                    aria-label="上月"
                    title="上月"
                    onClick={() => changeMonthBy(-1)}
                  />
                ) : null}
                <DatePicker
                  picker={isYearlyReport ? "year" : "month"}
                  format={isYearlyReport ? "YYYY年" : "YYYY年M月"}
                  value={month}
                  allowClear={false}
                  onChange={(value) => {
                    const nextMonth = value ?? dayjs();
                    setMonth(nextMonth);
                    window.history.pushState(
                      null,
                      "",
                      urlForRoute(activeRoute, nextMonth.format("YYYY-MM"), cashflowFilters)
                    );
                  }}
                />
                {!isYearlyReport ? (
                  <Button
                    className="month-nav-button"
                    icon={<RightOutlined />}
                    aria-label="下月"
                    title="下月"
                    onClick={() => changeMonthBy(1)}
                  />
                ) : null}
              </div>
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
                title="API 连接失败"
                description={`${error}。请确认后端服务和数据库正在运行。`}
                className="content-alert"
              />
            ) : null}
            <Spin spinning={loading}>
              {activeRoute.page === "report" ? (
                <ReportPage
                  data={data}
                  month={month}
                  tab={activeRoute.tab}
                  navigateToRoute={navigateToRoute}
                  onOpenMonth={navigateToMonthReport}
                  onTabChange={(tab) => navigateToRoute({ page: "report", tab })}
                />
              ) : null}
              {activeRoute.page === "spending" ? (
                <TransactionsPage
                  {...commonProps}
                  view={activeRoute.tab}
                  filters={cashflowFilters}
                  onFiltersChange={replaceCashflowFilters}
                  onViewChange={(tab, filters) => navigateToRoute({ page: "spending", tab }, filters)}
                />
              ) : null}
              {activeRoute.page === "income" ? (
                <IncomePage
                  {...commonProps}
                  view={activeRoute.tab}
                  filters={cashflowFilters}
                  onFiltersChange={replaceCashflowFilters}
                  onViewChange={(tab, filters) => navigateToRoute({ page: "income", tab }, filters)}
                />
              ) : null}
              {activeRoute.page === "checkup" ? (
                <CheckupPage
                  {...commonProps}
                  tab={activeRoute.tab}
                  onTabChange={(tab) => navigateToRoute({ page: "checkup", tab })}
                />
              ) : null}
              {activePage === "settings" ? <SettingsPage {...commonProps} /> : null}
            </Spin>
          </Content>
          <nav className="mobile-nav" aria-label="主导航">
            {pageMenuItems.map((item) => (
              <Button
                key={item.key}
                type={activePage === item.key ? "primary" : "text"}
                icon={pageIcons[item.key]}
                onClick={() => navigateToPage(item.key)}
              >
                {item.key === "checkup" ? "盘点" : item.label}
              </Button>
            ))}
          </nav>
        </Layout>
      </Layout>
  );
}

function ReportPage({
  data,
  month,
  tab,
  navigateToRoute,
  onOpenMonth,
  onTabChange
}: {
  data: AppData;
  month: Dayjs;
  tab: ReportTabKey;
  navigateToRoute: (route: AppRoute) => void;
  onOpenMonth: (month: string) => void;
  onTabChange: (tab: ReportTabKey) => void;
}) {
  return (
    <Tabs
      className="report-tabs"
      activeKey={tab}
      onChange={(key) => onTabChange(key as ReportTabKey)}
      items={[
        {
          key: "monthly",
          label: "月报",
          children: <MonthlyReportPage data={data} month={month} navigateToRoute={navigateToRoute} />
        },
        {
          key: "yearly",
          label: "年报",
          children: <YearlyReportPage year={month.format("YYYY")} onOpenMonth={onOpenMonth} />
        }
      ]}
    />
  );
}

function MonthlyReportPage({
  data,
  month,
  navigateToRoute
}: {
  data: AppData;
  month: Dayjs;
  navigateToRoute: (route: AppRoute) => void;
}) {
  const model = buildMonthlyReportViewModel(data.summary);
  const incomeView = buildIncomeView(
    data.transactions,
    data.categories.filter((item) => item.kind === "income")
  );
  const incomeCount = data.transactions.filter((item) => item.kind === "income").length;
  const expenseCount = data.transactions.filter((item) => item.kind === "expense").length;

  const completionItems = [
    { key: "spending", label: "支出账单", complete: data.monthlyReview.spending, route: routeForMonthlyReview("spending") },
    {
      key: "accounts",
      label: "资产余额",
      complete: data.monthlyReview.assets,
      route: routeForMonthlyReview("assets")
    },
    {
      key: "liabilities",
      label: "负债情况",
      complete: data.monthlyReview.liabilities,
      route: routeForMonthlyReview("liabilities")
    },
    {
      key: "investments",
      label: "投资持仓",
      complete: data.monthlyReview.investments,
      route: routeForMonthlyReview("investments")
    }
  ];
  const completedCount = completionItems.filter((item) => item.complete).length;
  const nextIncomplete = completionItems.find((item) => !item.complete);

  return (
    <Space orientation="vertical" size={18} className="page-stack monthly-report-page">
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Title level={2} className="report-heading">
            {month.format("YYYY年M月")}家庭月报
          </Title>
          <Text type="secondary">用一页了解本月收支和家庭财务状态</Text>
        </div>
        <Button
          type="primary"
          size="large"
          disabled={!nextIncomplete}
          onClick={() => nextIncomplete && navigateToRoute(nextIncomplete.route)}
        >
          {nextIncomplete ? `去更新${nextIncomplete.label}` : "本月盘点已完成"}
        </Button>
      </Flex>

      <Row gutter={[14, 14]} className="monthly-cashflow-row">
        {model.cashflowMetrics.map((metric) => (
          <Col xs={12} md={8} key={metric.title}>
            <Card className={`monthly-cashflow-card metric-card--${metric.tone}`}>
              <Statistic title={metric.title} value={metric.value} />
              <Text type="secondary" className="monthly-cashflow-meta">
                {metric.title === "本月收入"
                  ? `共 ${incomeCount} 笔收入`
                  : metric.title === "本月支出"
                    ? `共 ${expenseCount} 笔支出`
                    : "本月收入 - 本月支出"}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} className="monthly-supporting-row">
        {model.supportingMetrics.map((metric) => {
          const reviewed = metric.title === "家庭净资产"
            ? data.monthlyReview.assets && data.monthlyReview.liabilities
            : metric.title === "总负债"
              ? data.monthlyReview.liabilities
              : data.monthlyReview.investments;
          const rawValue = metric.title === "家庭净资产"
            ? data.summary.netAssets
            : metric.title === "总负债"
              ? data.summary.totalLiabilities
              : data.summary.investmentProfit;
          return (
          <Col xs={8} md={8} key={metric.title}>
            <Card className={`report-supporting-metric metric-card--${metric.tone}`}>
              <Statistic title={metric.title} value={financialMetricValue(rawValue, reviewed)} />
              {reviewed && metric.trend ? <Text type="secondary">{metric.trend}</Text> : <Text type="secondary">保存本月快照后显示</Text>}
            </Card>
          </Col>
          );
        })}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="支出分类占比" className="report-section-card">
            {model.categoryChart.length ? (
              <Pie
                data={model.categoryChart}
                angleField="value"
                colorField="type"
                height={300}
                innerRadius={0.64}
                label={{ text: "type", position: "outside" }}
                legend={{ color: { position: "right" } }}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本月尚未导入支出账单" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card
            title="本月盘点"
            className="report-section-card checkup-status-card"
            extra={<Text type="secondary">{completedCount} / 4 已完成</Text>}
          >
            <div className="checkup-list">
              {completionItems.map((item) => (
                <button key={item.key} type="button" className="checkup-list-item" onClick={() => navigateToRoute(item.route)}>
                  <span className={item.complete ? "checkup-icon is-complete" : "checkup-icon"}>
                    {item.complete ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                  </span>
                  <span className="checkup-list-label">{item.label}</span>
                  <span className={item.complete ? "checkup-state is-complete" : "checkup-state"}>
                    {item.complete ? "已确认" : "待更新"}
                  </span>
                  <RightOutlined aria-hidden="true" />
                </button>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="家庭成员收支" className="report-section-card">
        {model.memberCashflow.length ? (
          <div className="monthly-member-grid">
            {model.memberCashflow.map((item) => (
              <div className="monthly-member-item" key={item.memberName}>
                <Flex justify="space-between" align="center" gap={8}>
                  {renderOwnerTag(item.memberName, data.members)}
                  <Tag color="blue">结余 {item.balance}</Tag>
                </Flex>
                <Flex gap={8} wrap>
                  <Tag color="green">收入 {item.income}</Tag>
                  <Tag color="red">支出 {item.expense}</Tag>
                </Flex>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员收支数据" />
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="主要支出" className="report-section-card">
            {model.topCategories.length ? (
              <div className="top-spending-list">
                {model.topCategories.map((item) => (
                  <div className="top-spending-row" key={item.name}>
                    <Text strong>{item.name}</Text>
                    <RatioProgress percent={item.percent} />
                    <Text strong>{item.amount}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无支出分类" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="收入来源" className="report-section-card">
            {incomeView.categoryRows.length ? (
              <div className="top-spending-list">
                {incomeView.categoryRows.slice(0, 5).map((item) => (
                  <div className="top-spending-row" key={item.categoryName}>
                    <Text strong>{item.categoryName}</Text>
                    <RatioProgress percent={item.percent} />
                    <Text strong>{formatMoney(item.amount)}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本月暂无收入" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function YearlyReportPage({ year, onOpenMonth }: { year: string; onOpenMonth: (month: string) => void }) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [report, setReport] = useState<YearlyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getYearlyReport(year)
      .then((nextReport) => {
        if (active) setReport(nextReport);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "年报加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);

  if (loading) {
    return <Flex justify="center" className="annual-report-loading"><Spin /></Flex>;
  }
  if (error) {
    return <Alert type="error" showIcon title="年报加载失败" description={error} />;
  }
  if (!report) return null;

  const cashflowTrend = buildAnnualCashflowTrend(report.months);
  const financeTrend = buildNetWorthTrend(report.months);
  const hasFinanceTrend = financeTrend.some((item) => item.amount !== null);
  const completedMonths = report.months.filter((item) => (
    item.review.spending && item.review.assets && item.review.liabilities && item.review.investments
  )).length;
  const yearEndMonth = report.summary.yearEndSnapshotMonth;
  const yearEndRow = report.months.find((item) => item.month === yearEndMonth);
  const yearEndComplete = Boolean(
    yearEndRow
    && yearEndRow.review.spending
    && yearEndRow.review.assets
    && yearEndRow.review.liabilities
    && yearEndRow.review.investments
  );
  const snapshotSuffix = yearEndMonth && !yearEndMonth.endsWith("-12") ? `截至${Number(yearEndMonth.slice(5, 7))}月` : "年末";
  const summaryMetrics = [
    { title: "全年收入", value: report.summary.totalIncome, tone: "income" },
    { title: "全年支出", value: report.summary.totalExpense, tone: "expense" },
    { title: "全年结余", value: report.summary.balance, tone: "asset" },
    { title: "结余率", value: `${report.summary.savingsRate}%`, tone: "asset" },
    { title: yearlySnapshotLabel(yearEndMonth, yearEndComplete), value: report.summary.yearEndNetAssets, tone: "asset" },
    { title: "净资产变化", value: report.summary.netAssetsChange, tone: "asset" },
    { title: `${snapshotSuffix}投资市值`, value: report.summary.yearEndInvestmentMarketValue, tone: "income" },
    { title: `${snapshotSuffix}累计收益`, value: report.summary.yearEndInvestmentProfit, tone: "income" }
  ];
  const categoryColumns: ColumnsType<YearlyReportData["categories"][number]> = [
    { title: "支出分类", dataIndex: "categoryName", width: 140, render: renderCategoryTag },
    { title: "金额", dataIndex: "amount", width: 130, align: "right", render: (value: string) => formatMoney(value) },
    { title: "占比", dataIndex: "percent", width: 200, render: (value: number) => <RatioProgress percent={value} /> },
    {
      title: "同比",
      dataIndex: "changeRate",
      width: 100,
      render: (value?: number) => value === undefined ? "—" : <Tag color={value > 0 ? "red" : "green"}>{value > 0 ? "+" : ""}{value}%</Tag>
    }
  ];
  const memberColumns: ColumnsType<YearlyReportData["members"][number]> = [
    { title: "家庭成员", dataIndex: "memberName", width: 120, render: (value: string) => renderOwnerTag(value, []) },
    { title: "收入", dataIndex: "income", align: "right", render: (value: string) => <Tag color="green">{formatMoney(value)}</Tag> },
    { title: "支出", dataIndex: "expense", align: "right", render: (value: string) => <Tag color="red">{formatMoney(value)}</Tag> },
    { title: "结余", dataIndex: "balance", align: "right", render: (value: string) => formatMoney(value) },
    { title: "支出占比", dataIndex: "expensePercent", align: "right", render: (value: number) => `${value}%` }
  ];

  return (
    <Space orientation="vertical" size={18} className="page-stack annual-report-page">
      <Flex justify="space-between" align="end" wrap="wrap" gap={12}>
        <div>
          <Title level={2} className="report-heading">{year}年家庭年报</Title>
          <Text type="secondary">汇总全年收支，并以已保存的月度快照展示家庭财务变化</Text>
        </div>
        <Tag color={completedMonths === 12 ? "green" : "orange"}>完整盘点 {completedMonths} / 12 月</Tag>
      </Flex>

      <Row gutter={[14, 14]}>
        {summaryMetrics.map((metric) => (
          <Col xs={12} md={8} xl={4} key={metric.title}>
            <Card className={`annual-summary-card metric-card metric-card--${metric.tone}`}>
              <Statistic
                title={metric.title}
                value={metric.value === undefined ? "—" : metric.title === "结余率" ? metric.value : formatMoney(metric.value)}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="净资产趋势" className="report-section-card" extra={<Text type="secondary">数据来自月度快照</Text>}>
        {hasFinanceTrend ? (
          <Line
            data={financeTrend}
            xField="month"
            yField="amount"
            colorField="type"
            height={isMobile ? 260 : 340}
            point={{ size: 4 }}
            legend={{ color: { position: "top" } }}
            scale={{
              color: {
                domain: ["总资产", "总负债", "净资产"],
                range: ["#52c41a", "#ff4d4f", "#1677ff"]
              }
            }}
            axis={{ y: { labelFormatter: (value: number) => Number(value).toLocaleString("zh-CN") } }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="保存月度快照后显示净资产趋势" />
        )}
      </Card>

      <Card title="月度收支与结余趋势" className="report-section-card">
        <CashflowComboChart data={cashflowTrend} compact={isMobile} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="年度支出分类" className="report-section-card">
            <Table
              rowKey="categoryName"
              size="small"
              pagination={false}
              dataSource={report.categories}
              columns={categoryColumns}
              scroll={{ x: 520 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="家庭成员收支" className="report-section-card">
            <Table
              rowKey="memberName"
              size="small"
              pagination={false}
              dataSource={report.members}
              columns={memberColumns}
              scroll={{ x: 560 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="年度观察" className="report-section-card">
        <Flex gap={8} wrap>
          {report.highlights.highestExpenseMonth ? (
            <Tag color="red">支出最高：{dayjs(`${report.highlights.highestExpenseMonth}-01`).format("M月")}</Tag>
          ) : null}
          {report.highlights.bestSavingsMonth ? (
            <Tag color="green">结余最高：{dayjs(`${report.highlights.bestSavingsMonth}-01`).format("M月")}</Tag>
          ) : null}
          {report.highlights.topCategory ? <Tag color="blue">第一支出分类：{report.highlights.topCategory}</Tag> : null}
          {!report.highlights.highestExpenseMonth && !report.highlights.bestSavingsMonth && !report.highlights.topCategory ? (
            <Text type="secondary">本年度暂无可分析的收支数据</Text>
          ) : null}
        </Flex>
      </Card>

      <Card
        title="月度盘点完整度"
        className="report-section-card"
        extra={<Text type="secondary">点击月份查看对应月报</Text>}
      >
        <div className="annual-month-grid">
          {report.months.map((item) => {
            const statuses = [
              { label: "支出", complete: item.review.spending },
              { label: "资产", complete: item.review.assets },
              { label: "负债", complete: item.review.liabilities },
              { label: "投资", complete: item.review.investments }
            ];
            return (
              <button type="button" className="annual-month-item" key={item.month} onClick={() => onOpenMonth(item.month)}>
                <Text strong>{dayjs(`${item.month}-01`).format("M月")}</Text>
                <Flex gap={4} wrap>
                  {statuses.map((status) => (
                    <Tag key={status.label} color={status.complete ? "green" : "default"}>{status.label}</Tag>
                  ))}
                </Flex>
              </button>
            );
          })}
        </div>
      </Card>
    </Space>
  );
}

type AnnualCashflowTrend = ReturnType<typeof buildAnnualCashflowTrend>;

function CashflowComboChart({ data, compact }: { data: AnnualCashflowTrend; compact: boolean }) {
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const width = compact ? 720 : 1000;
  const height = compact ? 400 : 340;
  const padding = { top: 22, right: 24, bottom: 38, left: compact ? 58 : 76 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const amounts = [...data.columns, ...data.balance].map((item) => item.amount);
  const maxAmount = niceChartBound(Math.max(0, ...amounts));
  const minAmount = -niceChartBound(Math.abs(Math.min(0, ...amounts)));
  const range = Math.max(1, maxAmount - minAmount);
  const xForPosition = (position: number) => padding.left + ((position - 0.5) / 12) * plotWidth;
  const yForAmount = (amount: number) => padding.top + ((maxAmount - amount) / range) * plotHeight;
  const zeroY = yForAmount(0);
  const pointsByMonth = data.balance.map((balance) => {
    const monthNumber = balance.position;
    return {
      monthNumber,
      month: balance.month,
      income: data.columns.find((item) => item.month === balance.month && item.type === "收入")?.amount ?? 0,
      expense: data.columns.find((item) => item.month === balance.month && item.type === "支出")?.amount ?? 0,
      balance: balance.amount
    };
  });
  const balancePath = pointsByMonth
    .map((item, index) => `${index === 0 ? "M" : "L"} ${xForPosition(item.monthNumber)} ${yForAmount(item.balance)}`)
    .join(" ");
  const activePoint = activeMonth === null ? null : pointsByMonth[activeMonth - 1];
  const tickCount = 5;

  return (
    <div className="cashflow-combo-chart">
      <Flex gap={14} wrap className="cashflow-chart-legend">
        <ChartLegend color="#52c41a" label="收入" />
        <ChartLegend color="#ff4d4f" label="支出" />
        <ChartLegend color="#1677ff" label="结余" line />
      </Flex>
      <div className="cashflow-chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="每月收入、支出和结余趋势图">
          {Array.from({ length: tickCount + 1 }, (_, index) => {
            const amount = minAmount + ((maxAmount - minAmount) * index) / tickCount;
            const y = yForAmount(amount);
            return (
              <g key={amount}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="cashflow-grid-line" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="cashflow-axis-label">
                  {Math.round(amount).toLocaleString("zh-CN")}
                </text>
              </g>
            );
          })}
          <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} className="cashflow-zero-line" />
          {data.columns.map((item) => {
            const x = xForPosition(item.position);
            const y = yForAmount(item.amount);
            return (
              <rect
                key={`${item.month}-${item.type}`}
                x={x - 13}
                y={Math.min(y, zeroY)}
                width={26}
                height={Math.max(0, Math.abs(zeroY - y))}
                rx={2}
                fill={item.type === "收入" ? "#52c41a" : "#ff4d4f"}
              />
            );
          })}
          <path d={balancePath} fill="none" stroke="#1677ff" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {pointsByMonth.map((item) => (
            <circle
              key={item.month}
              cx={xForPosition(item.monthNumber)}
              cy={yForAmount(item.balance)}
              r={4}
              fill="#1677ff"
              stroke="#ffffff"
              strokeWidth={2}
            />
          ))}
          {pointsByMonth.map((item) => {
            const x = xForPosition(item.monthNumber);
            return (
              <g key={`hit-${item.month}`}>
                <rect
                  x={x - plotWidth / 24}
                  y={padding.top}
                  width={plotWidth / 12}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${item.month}，收入${formatMoney(String(item.income))}，支出${formatMoney(String(item.expense))}，结余${formatMoney(String(item.balance))}`}
                  onMouseEnter={() => setActiveMonth(item.monthNumber)}
                  onMouseLeave={() => setActiveMonth(null)}
                  onClick={() => setActiveMonth(item.monthNumber)}
                  onFocus={() => setActiveMonth(item.monthNumber)}
                  onBlur={() => setActiveMonth(null)}
                />
                <text x={x} y={height - 10} textAnchor="middle" className="cashflow-axis-label">{item.month}</text>
              </g>
            );
          })}
        </svg>
        {activePoint ? (
          <div
            className="cashflow-chart-tooltip"
            style={{ left: `${Math.min(90, Math.max(10, (activePoint.monthNumber / 12) * 100))}%` }}
          >
            <Text strong>{activePoint.month}</Text>
            <ChartTooltipRow color="#52c41a" label="收入" value={activePoint.income} />
            <ChartTooltipRow color="#ff4d4f" label="支出" value={activePoint.expense} />
            <ChartTooltipRow color="#1677ff" label="结余" value={activePoint.balance} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChartLegend({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="cashflow-legend-item">
      <span className={line ? "cashflow-legend-line" : "cashflow-legend-square"} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ChartTooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <Flex justify="space-between" gap={16}>
      <span className="cashflow-tooltip-label"><i style={{ backgroundColor: color }} />{label}</span>
      <Text>{formatMoney(String(value))}</Text>
    </Flex>
  );
}

function niceChartBound(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function CheckupPage(props: PageProps & { tab: CheckupTabKey; onTabChange: (tab: CheckupTabKey) => void }) {
  return (
    <Space orientation="vertical" size={16} className="page-stack checkup-page">
      <div>
        <Title level={2} className="report-heading">{dayjs(props.monthKey).format("YYYY年M月")}财务盘点</Title>
        <Text type="secondary">集中更新资产、负债和投资，本月数据会同步到家庭月报。</Text>
      </div>
      <Tabs
        className="checkup-tabs"
        activeKey={props.tab}
        onChange={(key) => props.onTabChange(key as CheckupTabKey)}
        items={[
          { key: "assets", label: "资产", children: <AccountsPage {...props} /> },
          { key: "liabilities", label: "负债", children: <LiabilitiesPage {...props} /> },
          { key: "investments", label: "投资", children: <InvestmentsPage {...props} /> },
          { key: "history", label: "历史快照", children: <MonthlySnapshotPage {...props} /> }
        ]}
      />
    </Space>
  );
}

function TransactionsPage(props: PageProps & CashflowRouteProps) {
  return <CashflowPage {...props} kind="expense" />;
}

function IncomePage(props: PageProps & CashflowRouteProps) {
  return <CashflowPage {...props} kind="income" />;
}

interface CashflowRouteProps {
  view: CashflowTabKey;
  filters: CashflowFilters;
  onFiltersChange: (filters: CashflowFilters) => void;
  onViewChange: (view: CashflowTabKey, filters?: CashflowFilters) => void;
}

function CashflowPage(props: PageProps & CashflowRouteProps & { kind: "expense" | "income" }) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const isExpense = props.kind === "expense";
  const category = props.filters.category;
  const member = props.filters.member;
  const confirmationStatus = props.filters.status;
  const amountMin = props.filters.min;
  const amountMax = props.filters.max;
  const pageSize = isMobile ? MOBILE_TRANSACTION_PAGE_SIZE : 50;
  const [detailPageNumber, setDetailPageNumber] = useState(1);
  const [detailPage, setDetailPage] = useState<TransactionPage>({ items: [], total: 0, totalAmount: "0.00" });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTransaction | null>(null);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const updateFilters = (updates: Partial<CashflowFilters>) => {
    props.onFiltersChange({ ...props.filters, ...updates });
  };
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
            kind: props.kind,
            categoryName: undefined,
            accountId: undefined,
            memberName: undefined,
            amount: undefined,
            note: undefined
          }
    );
  }, [open, editing, form, props.kind]);
  const cashflow = useMemo(
    () => isExpense
      ? buildSpendingView(props.data.transactions, props.data.categories.filter((item) => item.kind === "expense"))
      : buildIncomeView(props.data.transactions, props.data.categories.filter((item) => item.kind === "income")),
    [isExpense, props.data.categories, props.data.transactions]
  );
  const categoryOptions = useMemo(
    () => props.data.categories
      .filter((item) => item.kind === props.kind)
      .map((item) => ({ label: item.name, value: item.name })),
    [props.data.categories, props.kind]
  );
  const locallyFiltered = useMemo(
    () => filterTransactionsByConfirmation(cashflow.transactions, confirmationStatus).filter((transaction) => {
      if (category && transaction.categoryName !== category) return false;
      if (member && transaction.memberName !== member) return false;
      const amount = Number(transaction.amount);
      if (amountMin !== undefined && amount < amountMin) return false;
      if (amountMax !== undefined && amount > amountMax) return false;
      return true;
    }),
    [amountMax, amountMin, cashflow.transactions, category, confirmationStatus, member]
  );
  const memberTotals = useMemo(
    () => props.data.summary.memberBreakdown.map((item) => ({
      memberName: item.memberName,
      amount: props.kind === "expense" ? item.expense : item.income
    })),
    [props.data.summary.memberBreakdown, props.kind]
  );
  const detailRecords = props.view === "details" ? detailPage.items : locallyFiltered;
  const detailTotal = props.view === "details" ? detailPage.total : locallyFiltered.length;
  const detailTotalAmount = props.view === "details"
    ? detailPage.totalAmount
    : sumCashflowTransactions(locallyFiltered);
  const activeFilterCount = countActiveCashflowFilters(props.filters);
  const headerTotal = props.kind === "expense" ? props.data.summary.monthlyExpense : props.data.summary.monthlyIncome;

  useEffect(() => {
    setDetailPageNumber(1);
    setSelectedTransactionIds([]);
  }, [amountMax, amountMin, category, confirmationStatus, member, props.monthKey, props.kind]);

  useEffect(() => {
    if (props.view !== "details") return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    const query = buildTransactionPageQuery({
      month: props.monthKey,
      kind: props.kind,
      page: detailPageNumber,
      pageSize,
      filters: props.filters
    });
    void getTransactionPage(query)
      .then((result) => {
        if (!cancelled) setDetailPage(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setDetailError(reason instanceof Error ? reason.message : "明细加载失败");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [detailPageNumber, pageSize, props.data, props.filters, props.kind, props.monthKey, props.view]);

  const renderSummaryCategory = (categoryName: string) => {
    return (
      <button
        type="button"
        className="category-drilldown"
        aria-label={`查看${isExpense ? "支出" : "收入"}分类${categoryName}明细`}
        onClick={() => {
          const drilldown = buildCategoryDrilldown(props.kind, categoryName);
          if (!drilldown) return;
          props.onViewChange(drilldown.view, { ...props.filters, category: drilldown.category });
          setDetailPageNumber(1);
        }}
      >
        {renderCategoryTag(categoryName)}
      </button>
    );
  };

  const renderCategorySelect = (record: FinanceTransaction) => (
    <Select
      aria-label={`修改${record.date}分类`}
      className="inline-category-select"
      size="small"
      value={record.categoryName}
      options={categoryOptions}
      labelRender={({ label }) => renderCategoryTag(String(label))}
      loading={updatingCategoryId === record.id}
      disabled={updatingCategoryId === record.id}
      onChange={(nextCategory) => {
        if (nextCategory === record.categoryName) return;
        setUpdatingCategoryId(record.id);
        void props
          .submit(
            () => updateTransaction(record.id, buildCategoryChangeInput(record, nextCategory)),
            { success: "分类已更新" }
          )
          .finally(() => setUpdatingCategoryId(null));
      }}
    />
  );

  const renderTransactionActions = (record: FinanceTransaction) => (
    <Space size={4} wrap>
      {record.source && record.source !== "manual" && !record.confirmedAt ? (
        <Button
          type="link"
          size="small"
          onClick={() => props.submit(() => confirmTransaction(record.id), { success: "流水已确认" })}
        >
          确认
        </Button>
      ) : null}
      <RowActions
        onEdit={() => {
          setEditing(record);
          setOpen(true);
        }}
        onDelete={() => props.submit(() => deleteTransaction(record.id), { success: "流水已删除" })}
      />
    </Space>
  );

  const selectedRecords = detailRecords.filter((record) => selectedTransactionIds.includes(record.id));
  const runBulkUpdate = (
    run: (record: FinanceTransaction) => Promise<unknown>,
    success: string
  ) => props.submit(
    () => Promise.all(selectedRecords.map(run)),
    { success, onSuccess: () => setSelectedTransactionIds([]) }
  );

  const columns: ColumnsType<FinanceTransaction> = [
    {
      title: "日期",
      dataIndex: "date",
      width: 120,
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: "descend"
    },
    {
      title: "分类",
      dataIndex: "categoryName",
      width: 160,
      render: (_value: string, record) => renderCategorySelect(record)
    },
    {
      title: "归属",
      dataIndex: "memberName",
      width: 110,
      render: (value: string) => renderOwnerTag(value, props.data.members)
    },
    {
      title: "金额",
      dataIndex: "amount",
      width: 120,
      align: "right",
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (value: string, record) => (
        <Tag color={record.kind === "expense" ? "red" : "green"}>{formatMoney(value)}</Tag>
      )
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 100,
      render: renderTransactionSource
    },
    {
      title: "状态",
      key: "confirmation",
      width: 90,
      render: (_, record) => (
        record.source && record.source !== "manual" && !record.confirmedAt
          ? <Tag color="orange">待确认</Tag>
          : <Tag color="green">已确认</Tag>
      )
    },
    {
      title: "备注",
      dataIndex: "note",
      width: 220,
      ellipsis: { showTitle: false },
      render: (value?: string) => <span title={value}>{value || "—"}</span>
    },
    {
      title: "操作",
      key: "actions",
      width: 190,
      fixed: "right",
      render: (_, record) => renderTransactionActions(record)
    }
  ];

  return (
    <Card
      className="cashflow-card"
      title={
        <Space size={[8, 4]} wrap>
          <span>{isExpense ? "本月支出" : "本月收入"}</span>
          <Tag color={isExpense ? "red" : "green"}>{formatMoney(headerTotal)}</Tag>
          {!isMobile ? memberTotals.map((item) => (
            <Tag key={item.memberName} color={getMemberColor(item.memberName, props.data.members)}>
              {item.memberName} {formatMoney(item.amount)}
            </Tag>
          )) : null}
        </Space>
      }
      extra={
        <Space>
          {isExpense ? (
            <Button
              icon={<CheckCircleOutlined />}
              aria-label={props.data.monthlyReview.spending ? "本月支出已确认" : "确认本月支出"}
              title={props.data.monthlyReview.spending ? "本月支出已确认" : "确认本月支出"}
              onClick={() => props.submit(() => confirmMonthlySpending(props.monthKey), { success: "本月支出已确认" })}
            >
              {isMobile ? null : props.data.monthlyReview.spending ? "已确认" : "确认本月支出"}
            </Button>
          ) : null}
          {isExpense ? (
            <Button icon={<UploadOutlined />} aria-label="导入账单" title="导入账单" onClick={() => setImportOpen(true)}>
              {isMobile ? null : "导入账单"}
            </Button>
          ) : null}
          <Button
            icon={<PlusOutlined />}
            type="primary"
            aria-label={`新增${isExpense ? "支出" : "收入"}`}
            title={`新增${isExpense ? "支出" : "收入"}`}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {isMobile ? null : `新增${isExpense ? "支出" : "收入"}`}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} className="page-stack">
        {isMobile ? (
          <div className="mobile-member-totals">
            {memberTotals.map((item) => (
              <Tag key={item.memberName} color={getMemberColor(item.memberName, props.data.members)}>
                {item.memberName} {formatMoney(item.amount)}
              </Tag>
            ))}
          </div>
        ) : null}
        <Flex gap={12} wrap="wrap" align="center" className="cashflow-view-switcher">
          <Segmented
            value={props.view}
            onChange={(value) => props.onViewChange(value as CashflowTabKey)}
            options={[
              { label: "分类汇总", value: "summary" },
              { label: isExpense ? "消费明细" : "收入明细", value: "details" }
            ]}
          />
          {props.view === "details" && isMobile ? (
            <Button onClick={() => setFiltersExpanded((value) => !value)}>
              筛选{activeFilterCount ? `（${activeFilterCount}）` : ""}
            </Button>
          ) : null}
        </Flex>
        {props.view === "details" && (!isMobile || filtersExpanded) ? (
          <Flex gap={12} wrap="wrap" align="center" className="cashflow-filters">
            <>
              <Select
                allowClear
                placeholder="全部分类"
                style={{ minWidth: 140 }}
                value={category}
                onChange={(value) => updateFilters({ category: value })}
                options={categoryOptions}
              />
              <Select
                allowClear
                placeholder="全部成员"
                style={{ minWidth: 120 }}
                value={member}
                onChange={(value) => updateFilters({ member: value })}
                options={props.data.members.map((item) => ({ label: item, value: item }))}
              />
              <Select
                allowClear
                placeholder="全部状态"
                style={{ minWidth: 120 }}
                value={confirmationStatus}
                onChange={(value) => updateFilters({ status: value })}
                options={[
                  { label: "待确认", value: "pending" },
                  { label: "已确认", value: "confirmed" }
                ]}
              />
              <Space size={4} align="center">
                <InputNumber
                  placeholder="最低金额"
                  min={0}
                  style={{ width: 120 }}
                  value={amountMin ?? null}
                  onChange={(value) => updateFilters({ min: value ?? undefined })}
                />
                <span>—</span>
                <InputNumber
                  placeholder="最高金额"
                  min={0}
                  style={{ width: 120 }}
                  value={amountMax ?? null}
                  onChange={(value) => updateFilters({ max: value ?? undefined })}
                />
              </Space>
              {activeFilterCount ? (
                <Button onClick={() => props.onFiltersChange({})}>清空筛选</Button>
              ) : null}
            </>
          </Flex>
        ) : null}
        {props.view === "details" ? (
          <Flex className="cashflow-filter-summary" justify="space-between" align="center" gap={8} wrap="wrap">
            <Text type="secondary">当前筛选 {detailTotal} 笔</Text>
            <Tag color={isExpense ? "red" : "green"}>
              {isExpense ? "总支出" : "总收入"} {formatMoney(detailTotalAmount)}
            </Tag>
          </Flex>
        ) : null}
        {props.view === "details" && detailError ? (
          <Alert type="error" showIcon title="账单明细加载失败" description={detailError} />
        ) : null}
        {props.view === "details" && selectedRecords.length ? (
          <Flex className="cashflow-bulk-actions" gap={8} wrap="wrap" align="center">
            <Text strong>已选 {selectedRecords.length} 笔</Text>
            <Button onClick={() => runBulkUpdate((record) => confirmTransaction(record.id), "所选流水已确认")}>批量确认</Button>
            <Select
              placeholder="批量修改分类"
              options={categoryOptions}
              style={{ minWidth: 150 }}
              onChange={(nextCategory) => runBulkUpdate(
                (record) => updateTransaction(record.id, buildCategoryChangeInput(record, nextCategory)),
                "所选分类已更新"
              )}
            />
            <Select
              placeholder="批量修改成员"
              options={props.data.members.map((item) => ({ label: item, value: item }))}
              style={{ minWidth: 140 }}
              onChange={(nextMember) => runBulkUpdate(
                (record) => updateTransaction(record.id, { ...record, memberName: nextMember }),
                "所选成员已更新"
              )}
            />
            <Button type="text" onClick={() => setSelectedTransactionIds([])}>取消选择</Button>
          </Flex>
        ) : null}
        {props.view === "summary" ? (
          isMobile ? (
            <MobileRecordList empty={cashflow.categoryRows.length === 0}>
              {cashflow.categoryRows.map((row) => (
                <div className="mobile-record-card" key={row.categoryName}>
                  <Flex justify="space-between" align="center" gap={8}>
                    {renderSummaryCategory(row.categoryName)}
                    <Tag color={isExpense ? "red" : "green"}>{formatMoney(row.amount)}</Tag>
                  </Flex>
                  <Text type="secondary" className="mobile-record-note">{row.note || "—"}</Text>
                  <RatioProgress percent={row.percent} />
                </div>
              ))}
            </MobileRecordList>
          ) : (
            <Table
              rowKey="categoryName"
              pagination={false}
              dataSource={cashflow.categoryRows}
              columns={[
                {
                  title: isExpense ? "支出分类" : "收入分类",
                  dataIndex: "categoryName",
                  width: 160,
                  render: (value: string) => renderSummaryCategory(value)
                },
                {
                  title: "备注",
                  dataIndex: "note",
                  render: (value?: string) => (
                    <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{value || "—"}</span>
                  )
                },
                {
                  title: "占比",
                  dataIndex: "percent",
                  width: 240,
                  render: (value: number) => <RatioProgress percent={value} />
                },
                {
                  title: "金额",
                  dataIndex: "amount",
                  width: 160,
                  align: "right" as const,
                  render: (value: string) => <Tag color={isExpense ? "red" : "green"}>{formatMoney(value)}</Tag>
                }
              ]}
            />
          )
        ) : (
          isMobile ? (
            <Space orientation="vertical" size={12} className="page-stack">
              <MobileRecordList empty={detailTotal === 0}>
                {detailRecords.map((transaction) => {
                  const card = buildMobileTransactionCard(transaction);
                  return (
                    <div className="mobile-record-card" key={transaction.id}>
                      <Flex justify="space-between" align="center" gap={8}>
                        <Space size={8}>
                          <Checkbox
                            aria-label={`选择${card.date}${card.note ?? "流水"}`}
                            checked={selectedTransactionIds.includes(transaction.id)}
                            onChange={(event) => setSelectedTransactionIds((current) => (
                              event.target.checked
                                ? [...current, transaction.id]
                                : current.filter((id) => id !== transaction.id)
                            ))}
                          />
                          <Text type="secondary">{card.date}</Text>
                        </Space>
                        <Tag color={isExpense ? "red" : "green"}>{formatMoney(card.amount)}</Tag>
                      </Flex>
                      {renderCategorySelect(transaction)}
                      <Flex gap={6} wrap>
                        {renderOwnerTag(card.memberName, props.data.members)}
                        {renderTransactionSource(transaction.source)}
                        {card.pending ? <Tag color="orange">待确认</Tag> : <Tag color="green">已确认</Tag>}
                      </Flex>
                      {card.note ? <Text className="mobile-record-note">{card.note}</Text> : null}
                      <div className="mobile-record-actions">{renderTransactionActions(transaction)}</div>
                    </div>
                  );
                })}
              </MobileRecordList>
              {detailTotal > pageSize ? (
                <Pagination
                  className="mobile-transaction-pagination"
                  simple
                  size="small"
                  current={detailPageNumber}
                  pageSize={pageSize}
                  total={detailTotal}
                  showSizeChanger={false}
                  onChange={setDetailPageNumber}
                />
              ) : null}
            </Space>
          ) : (
            <Table
              rowKey="id"
              tableLayout="fixed"
              loading={detailLoading}
              dataSource={detailRecords}
              columns={columns}
              scroll={{ x: 1110 }}
              rowSelection={{
                selectedRowKeys: selectedTransactionIds,
                preserveSelectedRowKeys: false,
                onChange: (keys) => setSelectedTransactionIds(keys.map(String))
              }}
              pagination={{
                current: detailPageNumber,
                pageSize,
                total: detailTotal,
                showSizeChanger: false,
                onChange: setDetailPageNumber
              }}
            />
          )
        )}
      </Space>
      <Drawer
        title={editing ? `编辑${isExpense ? "支出" : "收入"}` : `新增${isExpense ? "支出" : "收入"}`}
        open={open}
        onClose={() => setOpen(false)}
        size={420}
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
              : { date: dayjs(), kind: props.kind, memberName: undefined }
          }
          onFinish={(values) => {
            const payload = {
              date: values.date.format("YYYY-MM-DD"),
              kind: props.kind,
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
          <TransactionFormFields data={props.data} kind={props.kind} onSubmit={() => form.submit()} />
        </Form>
      </Drawer>
      {isExpense ? (
        <ImportDrawer
          data={props.data}
          submit={props.submit}
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
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
  useEffect(() => {
    if (open) {
      setParsed(null);
      setFileName(null);
      form.resetFields();
    }
  }, [open, form]);

  const handleFile = (file: File) => {
    void file.arrayBuffer().then(async (buffer) => {
      let bill: ParsedBill;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        bill = await parseWechatWorkbook(buffer);
      } else {
        let text = new TextDecoder("gb18030").decode(buffer);
        if (!text.includes("记录时间")) {
          text = new TextDecoder("utf-8").decode(buffer);
        }
        bill = parseAlipayBill(text);
      }
      setParsed(bill);
      setFileName(file.name);
    });
    return false;
  };

  const summary = parsed ? summarizeBill(parsed.items) : null;
  const mapped = parsed
    ? applySavedCategoryMappings(parsed.items, parsed.source, data.categoryMappings)
    : null;

  return (
    <Drawer title="导入账单" open={open} onClose={onClose} size={460} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="memberName" label="成员" rules={[{ required: true }]}>
          <Select
            placeholder="请选择账单归属成员"
            options={data.members.map((member) => ({ label: member, value: member }))}
          />
        </Form.Item>
        <Form.Item label="账单文件（.csv / .xlsx）">
          <Upload accept=".csv,.xlsx,.xls" beforeUpload={handleFile} maxCount={1} showUploadList={false}>
            <Button icon={<UploadOutlined />}>选择支付宝 CSV 或微信 xlsx</Button>
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
          title={`共解析 ${parsed.items.length} 条记录`}
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
          支持支付宝 CSV 和微信支付 xlsx。支付宝 GBK 编码会自动识别；“不计收支”和微信中性交易记为转账。
        </Text>
      )}

      {mapped?.unmappedCategories.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${mapped.unmappedCategories.length} 个账单分类尚未配置映射`}
          description={`将暂存到待分类：${mapped.unmappedCategories.join("、")}`}
        />
      ) : null}

      <Button
        type="primary"
        block
        disabled={!parsed || parsed.items.length === 0}
        style={{ marginTop: 12 }}
        onClick={() => {
          void form
            .validateFields()
            .then((values) =>
              submit(
                () =>
                  importTransactions({
                    memberName: values.memberName,
                    source: parsed?.source ?? "alipay",
                    items: mapped?.items ?? []
                  }),
                {
                  success: `已导入 ${parsed?.items.length ?? 0} 条记录`,
                  onSuccess: () => {
                    setParsed(null);
                    setFileName(null);
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
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
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
  const assetAllocation = useMemo(() => buildAssetAllocation(filteredAccounts), [filteredAccounts]);
  const assetInsights = useMemo(() => buildAssetInsights(filteredAccounts), [filteredAccounts]);
  const editingManagedByHoldings = Boolean(
    editing && props.data.investments.some((holding) => holding.accountId === editing.id)
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
        : { name: undefined, type: "银行卡", ownerName: undefined, currentValue: undefined, note: undefined }
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
              props.submit(() => snapshotAllAccounts(props.monthKey), { success: "本月资产已确认" })
            }
          >
            {props.data.monthlyReview.assets ? "已确认" : "确认本月资产"}
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
      <Row gutter={[12, 12]} className="asset-insight-row">
        <Col xs={12} md={8}>
          <Card size="small" className="compact-insight-card">
            <Statistic title="可随时使用（估算）" value={formatMoney(assetInsights.liquidAmount.toFixed(2))} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card size="small" className="compact-insight-card">
            <Statistic title="流动资产占比" value={`${assetInsights.liquidPercent}%`} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="compact-insight-card">
            <Statistic
              title="余额最近更新"
              value={assetInsights.latestUpdatedAt ? dayjs(assetInsights.latestUpdatedAt).format("M月D日 HH:mm") : "暂无记录"}
            />
          </Card>
        </Col>
      </Row>
      <section className="asset-allocation-section">
        <Flex justify="space-between" align="center" gap={8} wrap>
          <Title level={4}>资产配置</Title>
          <Text type="secondary">按账户类型统计，不重复叠加关联投资持仓</Text>
        </Flex>
        {assetAllocation.length ? (
          <Pie
            data={assetAllocation}
            angleField="value"
            colorField="type"
            height={isMobile ? 220 : 230}
            innerRadius={0.62}
            label={{ text: "type", position: "outside" }}
            legend={{ color: { position: isMobile ? "bottom" : "right" } }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="录入资产账户后显示配置结构" />
        )}
      </section>
      {isMobile ? (
        <MobileRecordList empty={filteredAccounts.length === 0}>
          {filteredAccounts.map((account) => (
            <div className="mobile-record-card" key={account.id}>
              <Flex justify="space-between" align="center" gap={8}>
                <Text strong>{account.name}</Text>
                <Tag color="green">{formatMoney(account.currentValue)}</Tag>
              </Flex>
              <Flex gap={6} wrap>
                {renderAccountType(account.type)}
                {renderOwnerTag(account.ownerName, props.data.members)}
              </Flex>
              {account.note ? <Text className="mobile-record-note">{account.note}</Text> : null}
              <div className="mobile-record-actions">
                <RowActions
                  onEdit={() => { setEditing(account); setOpen(true); }}
                  onDelete={() => props.submit(() => deleteAccount(account.id), { success: "账户已删除" })}
                />
              </div>
            </div>
          ))}
        </MobileRecordList>
      ) : (
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
      )}
      <Drawer
        title={editing ? "编辑账户" : "新增账户"}
        open={open}
        onClose={() => setOpen(false)}
        size={420}
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
              : { type: "银行卡", ownerName: undefined }
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
          <AccountFormFields
            accountTypes={props.data.accountTypes}
            members={props.data.members}
            currentValueManaged={editingManagedByHoldings}
            onSubmit={() => form.submit()}
          />
        </Form>
      </Drawer>
    </Card>
  );
}

type LiabilityProgressItem = ReturnType<typeof buildLiabilityProgress>[number];

function LiabilityBulletChart({ items }: { items: LiabilityProgressItem[] }) {
  return (
    <div className="liability-bullet-chart" role="list" aria-label="还款进度">
      {items.map((item) => {
        const percent = item.percent ?? 0;
        return (
          <div key={item.id} className="liability-bullet-row" role="listitem">
            <Flex justify="space-between" align="center" gap={8} wrap>
              <Text strong>{item.name}</Text>
              <Text strong className="liability-bullet-percent">已还 {percent}%</Text>
            </Flex>
            <div
              className="liability-bullet-track"
              role="progressbar"
              aria-label={`${item.name}已还${percent}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span className="liability-bullet-range is-low" />
              <span className="liability-bullet-range is-middle" />
              <span className="liability-bullet-range is-high" />
              <span className="liability-bullet-measure" style={{ width: `${percent}%` }} />
              <span className="liability-bullet-target" />
            </div>
            <Flex justify="space-between" gap={8} wrap>
              <Text type="secondary">
                已还 {formatMoney(String(item.repaidAmount ?? 0))} / 初始 {formatMoney(String(item.initialBalance ?? 0))}
              </Text>
              <Text type="secondary">剩余 {formatMoney(String(item.currentBalance))}</Text>
            </Flex>
          </div>
        );
      })}
    </div>
  );
}

function LiabilitiesPage(props: PageProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Liability | null>(null);
  const [repaying, setRepaying] = useState<Liability | null>(null);
  const [form] = Form.useForm();
  const [repayForm] = Form.useForm();
  const { summary } = props.data;
  const liabilityProgress = useMemo(
    () => buildLiabilityProgress(props.data.liabilities),
    [props.data.liabilities]
  );
  const trackableLiabilityProgress = liabilityProgress.filter((item) => !item.estimated);
  const pendingLiabilityProgress = liabilityProgress.filter((item) => item.estimated);
  const liabilityCoverage = buildLiabilityCoverage(props.data.liabilities);
  const liabilityRisk = buildLiabilityRisk(props.data.liabilities, summary.monthlyIncome);
  const totalInitialLiability = trackableLiabilityProgress.reduce(
    (sum, item) => sum + (item.initialBalance ?? 0),
    0
  );
  const totalRepaidLiability = trackableLiabilityProgress.reduce(
    (sum, item) => sum + (item.repaidAmount ?? 0),
    0
  );
  const totalRepaymentPercent = totalInitialLiability === 0
    ? 0
    : Math.round((totalRepaidLiability / totalInitialLiability) * 1000) / 10;
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? {
            name: editing.name,
            type: editing.type,
            ownerName: editing.ownerName,
            initialBalance: Number(editing.initialBalance ?? editing.currentBalance),
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
            ownerName: undefined,
            initialBalance: undefined,
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
    <Space orientation="vertical" size={16} className="page-stack">
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}>
          <Card className="metric-card">
            <Statistic title="总负债" value={formatMoney(summary.totalLiabilities)} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="metric-card">
            <Statistic title="月供合计" value={formatMoney(summary.monthlyDebtPayment)} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="metric-card">
            <Statistic title="净资产" value={formatMoney(summary.netAssets)} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="metric-card">
            <Statistic
              title="月供收入比"
              value={Number(summary.monthlyIncome) > 0 ? `${liabilityRisk.debtServiceRate}%` : "无收入数据"}
            />
          </Card>
        </Col>
      </Row>
      <Card
        title="还款进度"
        className="report-section-card"
        extra={trackableLiabilityProgress.length ? (
          <Space size={6} wrap>
            <Tag color="green">可计算负债已还 {totalRepaymentPercent}%</Tag>
            <Tag>覆盖 {liabilityCoverage.tracked}/{liabilityCoverage.total} 笔</Tag>
          </Space>
        ) : null}
      >
        {trackableLiabilityProgress.length ? (
          <LiabilityBulletChart items={trackableLiabilityProgress} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={liabilityProgress.length ? "补充初始负债金额后显示还款进度" : "新增负债后显示还款进度"}
          />
        )}
        {liabilityRisk.payoffMonths !== null ? (
          <Text type="secondary" className="liability-payoff-note">
            按当前已填写月供粗略估算，相关负债约需 {liabilityRisk.payoffMonths} 个月还清，未计利息和提前还款变化。
          </Text>
        ) : null}
        {pendingLiabilityProgress.length ? (
          <Alert
            className="liability-progress-pending"
            type="warning"
            showIcon
            title={`${pendingLiabilityProgress.length} 笔负债待补充初始金额`}
            description={`${pendingLiabilityProgress.map((item) => item.name).join("、")}，补充后才会纳入还款进度和整体比例。`}
          />
        ) : null}
      </Card>
      <Card
        title="负债明细"
        extra={
          <Space>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => props.submit(() => snapshotAllLiabilities(props.monthKey), { success: "本月负债已确认" })}
            >
              {props.data.monthlyReview.liabilities ? "已确认" : "确认本月负债"}
            </Button>
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
          </Space>
        }
      >
        {isMobile ? (
          <MobileRecordList empty={props.data.liabilities.length === 0}>
            {props.data.liabilities.map((liability) => (
              <div className="mobile-record-card" key={liability.id}>
                <Flex justify="space-between" align="center" gap={8}>
                  <Text strong>{liability.name}</Text>
                  <Tag color="red">{formatMoney(liability.currentBalance)}</Tag>
                </Flex>
                <Flex gap={6} wrap>
                  {renderLiabilityType(liability.type)}
                  {renderOwnerTag(liability.ownerName, props.data.members)}
                  {renderLiabilityStatus(liability.status)}
                </Flex>
                <div className="mobile-record-grid">
                  <MobileField label="债权机构" value={liability.lender || "—"} />
                  <MobileField label="初始金额" value={liability.initialBalance ? formatMoney(liability.initialBalance) : "待补充"} />
                  <MobileField label="月供" value={liability.monthlyPayment ? formatMoney(liability.monthlyPayment) : "—"} />
                  <MobileField label="还款日" value={liability.paymentDay ? `每月${liability.paymentDay}号` : "—"} />
                  <MobileField label="剩余期数" value={liability.remainingPeriods == null ? "—" : `${liability.remainingPeriods}期`} />
                </div>
                {liability.note ? <Text className="mobile-record-note">{liability.note}</Text> : null}
                <div className="mobile-record-actions">
                  <Space size={4} wrap>
                    {liability.status === "active" ? (
                      <Button type="link" size="small" onClick={() => setRepaying(liability)}>还款</Button>
                    ) : null}
                    <RowActions
                      onEdit={() => { setEditing(liability); setOpen(true); }}
                      onDelete={() => props.submit(() => deleteLiability(liability.id), { success: "负债已删除" })}
                    />
                  </Space>
                </div>
              </div>
            ))}
          </MobileRecordList>
        ) : (
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
              title: "初始金额",
              dataIndex: "initialBalance",
              width: 130,
              align: "right",
              render: (value?: string) => (value ? formatMoney(value) : "待补充")
            },
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
        )}
      </Card>
      <Drawer
        title={editing ? "编辑负债" : "新增负债"}
        open={open}
        onClose={() => setOpen(false)}
        size={420}
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
                  initialBalance: Number(editing.initialBalance ?? editing.currentBalance),
                  currentBalance: Number(editing.currentBalance),
                  monthlyPayment: editing.monthlyPayment == null ? undefined : Number(editing.monthlyPayment),
                  paymentDay: editing.paymentDay,
                  remainingPeriods: editing.remainingPeriods,
                  lender: editing.lender,
                  status: editing.status,
                  note: editing.note
                }
              : { type: "mortgage", ownerName: undefined, status: "active" }
          }
          onFinish={(values) => {
            const payload = {
              name: values.name,
              type: values.type,
              ownerName: values.ownerName,
              initialBalance: String(values.initialBalance),
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
        size={380}
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

function InvestmentsPage(props: PageProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentHolding | null>(null);
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
            accountId: props.data.accounts.find(isFundAccount)?.id,
            marketValue: undefined,
            profit: undefined,
            note: undefined
          }
    );
  }, [open, editing, form, props.data.accounts]);
  const accountById = new Map(props.data.accounts.map((account) => [account.id, account]));
  const totalMarket = props.data.investments.reduce((sum, h) => sum + Number(h.marketValue), 0);
  const totalCost = props.data.investments.reduce(
    (sum, holding) => sum + investmentCostValue(holding),
    0
  );
  const totalProfit = totalMarket - totalCost;
  const totalRate = totalCost !== 0 ? totalProfit / totalCost : 0;
  const investmentInsights = buildInvestmentInsights(props.data.investments);
  const latestInvestmentUpdate = props.data.investments
    .map((item) => item.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return (
    <Space orientation="vertical" size={16} className="page-stack">
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
          <Card className="metric-card">
            <Statistic title="总收益率" value={`${(totalRate * 100).toFixed(2)}%`} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card title="投资类型配置" className="compact-chart-card">
            {investmentInsights.allocation.length ? (
              <Pie
                data={investmentInsights.allocation}
                angleField="value"
                colorField="type"
                height={210}
                innerRadius={0.65}
                label={{ text: "type", position: "outside" }}
                legend={{ color: { position: isMobile ? "bottom" : "right" } }}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无投资配置" />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="持仓风险提示" className="compact-chart-card">
            <Space orientation="vertical" size={12} className="page-stack">
              <Flex justify="space-between"><Text>单一持仓最高占比</Text><Tag color={investmentInsights.topHoldingPercent > 40 ? "orange" : "green"}>{investmentInsights.topHoldingPercent}%</Tag></Flex>
              <Flex justify="space-between"><Text>持仓数量</Text><Text strong>{props.data.investments.length} 个</Text></Flex>
              <Flex justify="space-between"><Text>关联投资账户</Text><Text strong>{new Set(props.data.investments.map((item) => item.accountId)).size} 个</Text></Flex>
              <Flex justify="space-between"><Text>估值最近更新</Text><Text strong>{latestInvestmentUpdate ? dayjs(latestInvestmentUpdate).format("M月D日 HH:mm") : "暂无记录"}</Text></Flex>
              {investmentInsights.topHoldingPercent > 40 ? <Alert type="warning" showIcon title="单一持仓占比较高，请关注集中度风险" /> : null}
            </Space>
          </Card>
        </Col>
      </Row>
      <Card
        title="投资持仓"
        extra={
          <Space>
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => props.submit(() => snapshotAllInvestments(props.monthKey), { success: "本月投资已确认" })}
            >
              {props.data.monthlyReview.investments ? "已确认" : "确认本月投资"}
            </Button>
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
          </Space>
        }
      >
        {isMobile ? (
          <MobileRecordList empty={props.data.investments.length === 0}>
            {props.data.investments.map((holding) => {
              const invested = investmentCostValue(holding);
              const rate = investmentReturnRateValue(holding);
              const account = accountById.get(holding.accountId);
              return (
                <div className="mobile-record-card" key={holding.id}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <div>
                      <Text strong>{holding.name}</Text>
                      {holding.code ? <Text type="secondary" className="mobile-record-subtitle">{holding.code}</Text> : null}
                    </div>
                    <Tag color="blue">{formatMoney(holding.marketValue)}</Tag>
                  </Flex>
                  <Flex gap={6} wrap>
                    {renderHoldingType(holding.type)}
                    {account ? renderOwnerTag(account.ownerName, props.data.members) : null}
                    <Tag color={rate >= 0 ? "red" : "green"}>{`${(rate * 100).toFixed(2)}%`}</Tag>
                  </Flex>
                  <div className="mobile-record-grid">
                    <MobileField label="投入成本" value={formatMoney(invested.toFixed(2))} />
                    <MobileField label="持有收益" value={formatMoney(holding.profit)} />
                    <MobileField label="所属账户" value={account?.name ?? "—"} />
                  </div>
                  {holding.note ? <Text className="mobile-record-note">{holding.note}</Text> : null}
                  <div className="mobile-record-actions">
                    <RowActions
                      onEdit={() => { setEditing(holding); setOpen(true); }}
                      onDelete={() => props.submit(() => deleteInvestment(holding.id), { success: "持仓已删除" })}
                    />
                  </div>
                </div>
              );
            })}
          </MobileRecordList>
        ) : (
        <Table<InvestmentHolding>
          rowKey="id"
          tableLayout="fixed"
          dataSource={props.data.investments}
          scroll={{ x: 1220 }}
          columns={[
            { title: "名称", dataIndex: "name", width: 160 },
            { title: "代码", dataIndex: "code", width: 100 },
            { title: "类型", dataIndex: "type", width: 100, render: renderHoldingType },
            {
              title: "投入成本",
              dataIndex: "investedAmount",
              width: 120,
              align: "right",
              sorter: (left, right) => investmentCostValue(left) - investmentCostValue(right),
              render: (value: string | undefined, record) =>
                formatMoney(value ?? investmentCostValue(record).toFixed(2))
            },
            {
              title: "当前金额",
              dataIndex: "marketValue",
              width: 120,
              align: "right",
              sorter: (left, right) => Number(left.marketValue) - Number(right.marketValue),
              render: (value: string) => formatMoney(value)
            },
            {
              title: "持有收益",
              dataIndex: "profit",
              width: 120,
              align: "right",
              sorter: (left, right) => Number(left.profit) - Number(right.profit),
              render: (value: string) => (
                <Text type={Number(value) >= 0 ? "danger" : "success"}>{formatMoney(value)}</Text>
              )
            },
            {
              title: "收益率",
              key: "rate",
              width: 100,
              align: "right",
              sorter: (left, right) => investmentReturnRateValue(left) - investmentReturnRateValue(right),
              render: (_, record) => {
                const rate = investmentReturnRateValue(record);
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
        )}
      </Card>
      <Drawer
        title={editing ? "编辑持仓" : "新增持仓"}
        open={open}
        onClose={() => setOpen(false)}
        size={420}
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
              : { type: "fund", accountId: props.data.accounts.find(isFundAccount)?.id }
          }
          onFinish={(values) => {
            const amounts = buildInvestmentAmountsFromProfit(values.marketValue, values.profit);
            const payload = {
              name: values.name,
              code: values.code?.trim() ?? "",
              type: values.type,
              accountId: values.accountId,
              marketValue: amounts.marketValue,
              investedAmount: amounts.investedAmount,
              profit: amounts.profit,
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
    </Space>
  );
}

function MonthlySnapshotPage(props: PageProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [snapshot, setSnapshot] = useState<MonthlySnapshotData | null>(null);
  const [compareMonth, setCompareMonth] = useState(() => shiftMonthKey(props.monthKey, -1));
  const [compareSnapshot, setCompareSnapshot] = useState<MonthlySnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getMonthlySnapshot(props.monthKey), getMonthlySnapshot(compareMonth)])
      .then(([result, comparison]) => {
        if (!cancelled) {
          setSnapshot(result);
          setCompareSnapshot(comparison);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setSnapshot(null);
          setError(caught instanceof Error ? caught.message : "快照加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compareMonth, props.monthKey]);

  useEffect(() => {
    setCompareMonth(shiftMonthKey(props.monthKey, -1));
  }, [props.monthKey]);

  if (error) return <Alert type="error" showIcon title="历史快照加载失败" description={error} />;

  return (
    <Spin spinning={loading}>
      {snapshot ? (
        <Space orientation="vertical" size={16} className="page-stack monthly-snapshot-page">
          <Flex gap={8} wrap className="snapshot-statuses">
            <SnapshotStatus label="支出" complete={snapshot.review.spending} spending />
            <SnapshotStatus label="资产" complete={snapshot.review.assets} />
            <SnapshotStatus label="负债" complete={snapshot.review.liabilities} />
            <SnapshotStatus label="投资" complete={snapshot.review.investments} />
          </Flex>

          <Card
            title="月度对比"
            extra={
              <DatePicker
                picker="month"
                allowClear={false}
                value={dayjs(`${compareMonth}-01`)}
                onChange={(value) => value && setCompareMonth(value.format("YYYY-MM"))}
              />
            }
          >
            {compareSnapshot && (compareSnapshot.review.assets || compareSnapshot.review.liabilities || compareSnapshot.review.investments) ? (
              <Table
                rowKey="label"
                pagination={false}
                size="small"
                scroll={{ x: 560 }}
                dataSource={snapshotComparisonRows(snapshot.summary, compareSnapshot.summary)}
                columns={[
                  { title: "指标", dataIndex: "label" },
                  { title: props.monthKey, dataIndex: "current", align: "right", render: (value: string) => formatMoney(value) },
                  { title: compareMonth, dataIndex: "compared", align: "right", render: (value: string) => formatMoney(value) },
                  { title: "变化", dataIndex: "change", align: "right", render: (value: string) => renderChange(Number(value)) }
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${compareMonth} 尚未保存资产、负债或投资快照`} />
            )}
          </Card>

          <Row gutter={[12, 12]}>
            {[
              { title: "资产总额", value: snapshot.summary.totalAssets },
              { title: "负债总额", value: snapshot.summary.totalLiabilities },
              { title: "净资产", value: snapshot.summary.netAssets },
              { title: "投资市值", value: snapshot.summary.investmentMarketValue },
              { title: "较上月净资产", value: snapshot.summary.netAssetsChange }
            ].map((item) => (
              <Col xs={12} md={8} xl={item.title === "较上月净资产" ? 6 : 4} key={item.title}>
                <Card className="snapshot-metric-card">
                  <Statistic title={item.title} value={item.value === undefined ? "—" : formatMoney(item.value)} />
                </Card>
              </Col>
            ))}
          </Row>

          <Card title={<SnapshotSectionTitle label="资产快照" complete={snapshot.review.assets} />}>
            {snapshot.assets.length === 0 ? (
              <SnapshotEmpty complete={snapshot.review.assets} noun="资产" />
            ) : isMobile ? (
              <MobileRecordList empty={false}>
                {snapshot.assets.map((item) => (
                  <div className="mobile-record-card" key={item.accountId}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Text strong>{item.accountName}</Text>
                      <Tag color="blue">{formatMoney(item.value)}</Tag>
                    </Flex>
                    <Flex gap={6} wrap>{renderAccountType(item.accountType)}{renderOwnerTag(item.ownerName, props.data.members)}</Flex>
                    <MobileField label="较上月变化" value={renderChange(item.change == null ? null : Number(item.change))} />
                  </div>
                ))}
              </MobileRecordList>
            ) : (
              <Table
                rowKey="accountId"
                pagination={false}
                dataSource={snapshot.assets}
                columns={[
                  { title: "账户", dataIndex: "accountName" },
                  { title: "类型", dataIndex: "accountType", width: 120, render: renderAccountType },
                  { title: "归属", dataIndex: "ownerName", width: 110, render: (value: string) => renderOwnerTag(value, props.data.members) },
                  { title: "月末金额", dataIndex: "value", width: 150, align: "right", render: (value: string) => formatMoney(value) },
                  { title: "较上月变化", dataIndex: "change", width: 150, align: "right", render: (value?: string) => renderChange(value == null ? null : Number(value)) }
                ]}
              />
            )}
          </Card>

          <Card title={<SnapshotSectionTitle label="负债快照" complete={snapshot.review.liabilities} />}>
            {snapshot.liabilities.length === 0 ? (
              <SnapshotEmpty complete={snapshot.review.liabilities} noun="负债" />
            ) : isMobile ? (
              <MobileRecordList empty={false}>
                {snapshot.liabilities.map((item) => (
                  <div className="mobile-record-card" key={item.liabilityId}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Text strong>{item.liabilityName}</Text>
                      <Tag color="red">{formatMoney(item.currentBalance)}</Tag>
                    </Flex>
                    <Flex gap={6} wrap>{renderOwnerTag(item.ownerName, props.data.members)}</Flex>
                    <div className="mobile-record-grid">
                      <MobileField label="月供" value={item.monthlyPayment ? formatMoney(item.monthlyPayment) : "—"} />
                      <MobileField label="剩余期数" value={item.remainingPeriods == null ? "—" : `${item.remainingPeriods}期`} />
                      <MobileField label="较上月变化" value={renderChange(item.change == null ? null : Number(item.change))} />
                    </div>
                  </div>
                ))}
              </MobileRecordList>
            ) : (
              <Table
                rowKey="liabilityId"
                pagination={false}
                dataSource={snapshot.liabilities}
                columns={[
                  { title: "负债", dataIndex: "liabilityName" },
                  { title: "归属", dataIndex: "ownerName", width: 110, render: (value: string) => renderOwnerTag(value, props.data.members) },
                  { title: "余额", dataIndex: "currentBalance", width: 140, align: "right", render: (value: string) => formatMoney(value) },
                  { title: "月供", dataIndex: "monthlyPayment", width: 140, align: "right", render: (value?: string) => value ? formatMoney(value) : "—" },
                  { title: "剩余期数", dataIndex: "remainingPeriods", width: 110, render: (value?: number) => value == null ? "—" : `${value}期` },
                  { title: "较上月变化", dataIndex: "change", width: 150, align: "right", render: (value?: string) => renderChange(value == null ? null : Number(value)) }
                ]}
              />
            )}
          </Card>

          <Card title={<SnapshotSectionTitle label="投资快照" complete={snapshot.review.investments} />}>
            {snapshot.investments.length === 0 ? (
              <SnapshotEmpty complete={snapshot.review.investments} noun="投资" />
            ) : isMobile ? (
              <MobileRecordList empty={false}>
                {snapshot.investments.map((item) => (
                  <div className="mobile-record-card" key={item.holdingId}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <div><Text strong>{item.holdingName}</Text><Text type="secondary" className="mobile-record-subtitle">{item.code}</Text></div>
                      <Tag color="blue">{formatMoney(item.marketValue)}</Tag>
                    </Flex>
                    <div className="mobile-record-grid">
                      <MobileField label="投入成本" value={formatMoney(item.investedAmount)} />
                      <MobileField label="持有收益" value={formatMoney(item.profit)} />
                      <MobileField label="收益率" value={`${item.returnRate.toFixed(2)}%`} />
                      <MobileField label="较上月变化" value={renderChange(item.change == null ? null : Number(item.change))} />
                    </div>
                  </div>
                ))}
              </MobileRecordList>
            ) : (
              <Table
                rowKey="holdingId"
                pagination={false}
                dataSource={snapshot.investments}
                scroll={{ x: 900 }}
                columns={[
                  { title: "持仓", dataIndex: "holdingName" },
                  { title: "代码", dataIndex: "code", width: 100 },
                  { title: "账户", dataIndex: "accountName", width: 140 },
                  {
                    title: "投入成本",
                    dataIndex: "investedAmount",
                    width: 140,
                    align: "right",
                    sorter: (left, right) => Number(left.investedAmount) - Number(right.investedAmount),
                    render: (value: string) => formatMoney(value)
                  },
                  {
                    title: "当前金额",
                    dataIndex: "marketValue",
                    width: 140,
                    align: "right",
                    sorter: (left, right) => Number(left.marketValue) - Number(right.marketValue),
                    render: (value: string) => formatMoney(value)
                  },
                  {
                    title: "持有收益",
                    dataIndex: "profit",
                    width: 130,
                    align: "right",
                    sorter: (left, right) => Number(left.profit) - Number(right.profit),
                    render: (value: string) => formatMoney(value)
                  },
                  {
                    title: "收益率",
                    dataIndex: "returnRate",
                    width: 100,
                    sorter: (left, right) => left.returnRate - right.returnRate,
                    render: (value: number) => `${value.toFixed(2)}%`
                  },
                  { title: "较上月变化", dataIndex: "change", width: 150, align: "right", render: (value?: string) => renderChange(value == null ? null : Number(value)) }
                ]}
              />
            )}
          </Card>
        </Space>
      ) : null}
    </Spin>
  );
}

function SnapshotStatus({ label, complete, spending = false }: { label: string; complete: boolean; spending?: boolean }) {
  return (
    <Tag color={complete ? "green" : "default"}>
      {label}：{complete ? (spending ? "已确认" : "已保存快照") : (spending ? "未确认" : "未保存")}
    </Tag>
  );
}

function SnapshotSectionTitle({ label, complete }: { label: string; complete: boolean }) {
  return <Space size={8}><span>{label}</span><Tag color={complete ? "green" : "default"}>{complete ? "已保存" : "未保存"}</Tag></Space>;
}

function SnapshotEmpty({ complete, noun }: { complete: boolean; noun: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={complete ? `该月没有${noun}记录` : `该月未保存${noun}快照`} />;
}

function SettingsPage(props: PageProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [categoryKind, setCategoryKind] = useState<"expense" | "income">("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form] = Form.useForm();
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEditing, setMemberEditing] = useState<FamilyMemberInfo | null>(null);
  const [memberForm] = Form.useForm();
  const [accountTypeOpen, setAccountTypeOpen] = useState(false);
  const [accountTypeEditing, setAccountTypeEditing] = useState<AccountTypeOption | null>(null);
  const [accountTypeForm] = Form.useForm();
  const [mappingSource, setMappingSource] = useState<"alipay" | "wechat">("alipay");
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingEditing, setMappingEditing] = useState<CategoryMapping | null>(null);
  const [mappingForm] = Form.useForm();
  const [categorySearch, setCategorySearch] = useState("");
  const [mappingSearch, setMappingSearch] = useState("");
  const [settingsSection, setSettingsSection] = useState<"basic" | "mappings">("basic");
  const mappingKind = Form.useWatch<"expense" | "income">("kind", mappingForm) ?? "expense";
  const visibleCategories = props.data.categories.filter((category) => (
    category.kind === categoryKind
    && (!categorySearch || `${category.name} ${category.note ?? ""}`.toLowerCase().includes(categorySearch.toLowerCase()))
  ));
  const visibleMappings = props.data.categoryMappings.filter((mapping) => (
    mapping.source === mappingSource
    && (!mappingSearch || `${mapping.sourceCategory} ${mapping.targetCategoryName}`.toLowerCase().includes(mappingSearch.toLowerCase()))
  ));
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(
      editing
        ? { name: editing.name, kind: editing.kind, note: editing.note }
        : { name: undefined, kind: categoryKind, note: undefined }
    );
  }, [open, editing, form, categoryKind]);
  useEffect(() => {
    if (!memberOpen) return;
    memberForm.setFieldsValue({
      name: memberEditing ? memberEditing.name : undefined,
      icon: memberEditing?.icon ?? "user"
    });
  }, [memberOpen, memberEditing, memberForm]);
  useEffect(() => {
    if (!accountTypeOpen) return;
    accountTypeForm.setFieldsValue({
      name: accountTypeEditing ? accountTypeEditing.name : undefined
    });
  }, [accountTypeOpen, accountTypeEditing, accountTypeForm]);
  useEffect(() => {
    if (!mappingOpen) return;
    mappingForm.setFieldsValue(
      mappingEditing
        ? {
            source: mappingEditing.source,
            kind: mappingEditing.kind,
            sourceCategory: mappingEditing.sourceCategory,
            targetCategoryId: mappingEditing.targetCategoryId
          }
        : { source: mappingSource, kind: "expense", sourceCategory: undefined, targetCategoryId: undefined }
    );
  }, [mappingOpen, mappingEditing, mappingForm, mappingSource]);
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Tabs
          activeKey={settingsSection}
          onChange={(key) => setSettingsSection(key as "basic" | "mappings")}
          items={[
            { key: "basic", label: "成员、账户类型与分类" },
            { key: "mappings", label: "账单分类映射" }
          ]}
        />
      </Col>
      {settingsSection === "basic" ? (
      <>
      <Col xs={24} lg={10}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
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
            {isMobile ? (
              <MobileRecordList empty={props.data.familyMembers.length === 0}>
                {props.data.familyMembers.map((member) => (
                  <div className="mobile-record-card" key={member.id}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Space size={6}>{renderMemberIcon(member.icon)}<Text strong>{member.name}</Text></Space>
                      <RowActions
                        onEdit={() => { setMemberEditing(member); setMemberOpen(true); }}
                        onDelete={() => props.submit(() => deleteMember(member.id), { success: "成员已删除" })}
                      />
                    </Flex>
                  </div>
                ))}
              </MobileRecordList>
            ) : (
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
            )}
          </Card>
          <Card
            title="资产账户类型"
            extra={
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => {
                  setAccountTypeEditing(null);
                  setAccountTypeOpen(true);
                }}
              >
                新增类型
              </Button>
            }
          >
            {isMobile ? (
              <MobileRecordList empty={props.data.accountTypes.length === 0}>
                {props.data.accountTypes.map((accountType) => (
                  <div className="mobile-record-card" key={accountType.id}>
                    <Flex justify="space-between" align="center" gap={8}>
                      <Space size={6}>
                        <Text strong>{accountType.name}</Text>
                        {accountType.isDefault ? <Tag>默认</Tag> : null}
                      </Space>
                      <RowActions
                        onEdit={() => { setAccountTypeEditing(accountType); setAccountTypeOpen(true); }}
                        onDelete={() => props.submit(() => deleteAccountType(accountType.id), { success: "账户类型已删除" })}
                      />
                    </Flex>
                  </div>
                ))}
              </MobileRecordList>
            ) : (
            <Table<AccountTypeOption>
              rowKey="id"
              size="middle"
              pagination={false}
              scroll={{ x: 300 }}
              dataSource={props.data.accountTypes}
              columns={[
                {
                  title: "名称",
                  dataIndex: "name",
                  width: 160,
                  render: (value: string, record) => (
                    <Space size={6}>
                      <span>{value}</span>
                      {record.isDefault ? <Tag color="default">默认</Tag> : null}
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
                        setAccountTypeEditing(record);
                        setAccountTypeOpen(true);
                      }}
                      onDelete={() => props.submit(() => deleteAccountType(record.id), { success: "账户类型已删除" })}
                    />
                  )
                }
              ]}
            />
            )}
          </Card>
        </Space>
      </Col>
      <Col xs={24} lg={14}>
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
          <Segmented
            block
            style={{ marginBottom: 12 }}
            value={categoryKind}
            onChange={(value) => setCategoryKind(value as "expense" | "income")}
            options={[
              { label: "支出分类", value: "expense" },
              { label: "收入分类", value: "income" }
            ]}
          />
          <Input
            allowClear
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            placeholder="搜索分类名称或备注"
            style={{ marginBottom: 12 }}
          />
          {isMobile ? (
            <MobileRecordList empty={visibleCategories.length === 0}>
              {visibleCategories.map((category) => (
                <div className="mobile-record-card" key={category.id}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <Space size={6}>{renderCategoryTag(category.name)}{category.isDefault ? <Tag>默认</Tag> : null}</Space>
                    <RowActions
                      onEdit={() => { setEditing(category); setOpen(true); }}
                      onDelete={() => props.submit(() => deleteCategory(category.id), { success: "分类已停用" })}
                      deleteLabel="停用"
                    />
                  </Flex>
                  <Text type="secondary" className="mobile-record-note">{category.note || "—"}</Text>
                </div>
              ))}
            </MobileRecordList>
          ) : (
          <Table<Category>
            rowKey="id" tableLayout="fixed"
            size="middle"
            pagination={false}
            scroll={{ x: 520 }}
            dataSource={visibleCategories}
            columns={[
              {
                title: "名称",
                dataIndex: "name",
                width: 120,
                render: (value: string, record) => (
                  <Space size={6}>
                    <span>{value}</span>
                    {record.isDefault ? <Tag color="default">默认</Tag> : null}
                  </Space>
                )
              },
              {
                title: "备注",
                dataIndex: "note",
                width: 290,
                render: (value?: string) => (
                  <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{value || "—"}</span>
                )
              },
              {
                title: "操作",
                key: "actions",
                width: 110,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => {
                      setEditing(record);
                      setOpen(true);
                    }}
                    onDelete={() => props.submit(() => deleteCategory(record.id), { success: "分类已停用" })}
                    deleteLabel="停用"
                  />
                )
              }
            ]}
          />
          )}
        </Card>
      </Col>
      </>
      ) : null}
      {settingsSection === "mappings" ? (
      <Col xs={24}>
        <Card
          title="账单分类映射"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setMappingEditing(null);
                setMappingOpen(true);
              }}
            >
              新增映射
            </Button>
          }
        >
          <Flex gap={12} wrap="wrap" style={{ marginBottom: 12 }}>
            <Segmented
              value={mappingSource}
              onChange={(value) => setMappingSource(value as "alipay" | "wechat")}
              options={[
                { label: "支付宝", value: "alipay" },
                { label: "微信", value: "wechat" }
              ]}
            />
            <Input
              allowClear
              value={mappingSearch}
              onChange={(event) => setMappingSearch(event.target.value)}
              placeholder="搜索账单分类或系统分类"
              style={{ maxWidth: 320 }}
            />
          </Flex>
          {isMobile ? (
            <MobileRecordList empty={visibleMappings.length === 0}>
              {visibleMappings.map((mapping) => (
                <div className="mobile-record-card" key={mapping.id}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <Space size={6} wrap>
                      <Tag color={mapping.kind === "expense" ? "red" : "green"}>{mapping.kind === "expense" ? "支出" : "收入"}</Tag>
                      <Text strong>{mapping.sourceCategory}</Text>
                    </Space>
                    <RowActions
                      onEdit={() => { setMappingEditing(mapping); setMappingOpen(true); }}
                      onDelete={() => props.submit(() => deleteCategoryMapping(mapping.id), { success: "映射已删除" })}
                    />
                  </Flex>
                  <Flex align="center" gap={8}><Text type="secondary">映射至</Text>{renderCategoryTag(mapping.targetCategoryName)}</Flex>
                </div>
              ))}
            </MobileRecordList>
          ) : (
          <Table<CategoryMapping>
            rowKey="id"
            pagination={false}
            dataSource={visibleMappings}
            columns={[
              {
                title: "收支类型",
                dataIndex: "kind",
                width: 120,
                render: (value: CategoryMapping["kind"]) => (
                  <Tag color={value === "expense" ? "red" : "green"}>{value === "expense" ? "支出" : "收入"}</Tag>
                )
              },
              { title: "账单原分类", dataIndex: "sourceCategory" },
              {
                title: "系统分类",
                dataIndex: "targetCategoryName",
                render: (value: string) => renderCategoryTag(value)
              },
              {
                title: "操作",
                key: "actions",
                width: 120,
                render: (_, record) => (
                  <RowActions
                    onEdit={() => {
                      setMappingEditing(record);
                      setMappingOpen(true);
                    }}
                    onDelete={() => props.submit(() => deleteCategoryMapping(record.id), { success: "映射已删除" })}
                  />
                )
              }
            ]}
          />
          )}
        </Card>
      </Col>
      ) : null}
      <Drawer
        title={editing ? "编辑分类" : "新增分类"}
        open={open}
        onClose={() => setOpen(false)}
        size={420}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ kind: "expense" }}
          onFinish={(values) => {
            const payload = { name: values.name, kind: editing?.kind ?? categoryKind, note: values.note };
            return props.submit(
              () => (editing ? updateCategory(editing.id, payload) : createCategory(payload)),
              { success: editing ? "分类已更新" : "分类已新增", onSuccess: () => setOpen(false) }
            );
          }}
        >
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}>
            <Input placeholder="如：餐饮、工资" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 5 }}
              placeholder={`说明该分类包含哪些${categoryKind === "expense" ? "支出" : "收入"}，方便月度复盘`}
            />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => form.submit()} block>
            保存
          </Button>
        </Form>
      </Drawer>
      <Drawer
        title={mappingEditing ? "编辑分类映射" : "新增分类映射"}
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        size={420}
        destroyOnHidden
      >
        <Form
          form={mappingForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              source: values.source as "alipay" | "wechat",
              kind: values.kind as "expense" | "income",
              sourceCategory: values.sourceCategory,
              targetCategoryId: values.targetCategoryId
            };
            return props.submit(
              () => mappingEditing
                ? updateCategoryMapping(mappingEditing.id, payload)
                : createCategoryMapping(payload),
              { success: mappingEditing ? "映射已更新" : "映射已新增", onSuccess: () => setMappingOpen(false) }
            );
          }}
        >
          <Form.Item name="source" label="账单来源" rules={[{ required: true }]}>
            <Select options={[{ label: "支付宝", value: "alipay" }, { label: "微信", value: "wechat" }]} />
          </Form.Item>
          <Form.Item name="kind" label="收支类型" rules={[{ required: true }]}>
            <Select options={[{ label: "支出", value: "expense" }, { label: "收入", value: "income" }]} />
          </Form.Item>
          <Form.Item name="sourceCategory" label="账单原分类" rules={[{ required: true }]}>
            <Input placeholder="如：生活日用、商户消费" />
          </Form.Item>
          <Form.Item name="targetCategoryId" label="系统分类" rules={[{ required: true }]}>
            <Select
              showSearch
              options={props.data.categories
                .filter((category) => category.kind === mappingKind)
                .map((category) => ({ label: category.name, value: category.id }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => mappingForm.submit()} block>
            保存
          </Button>
        </Form>
      </Drawer>
      <Drawer
        title={memberEditing ? "编辑成员" : "新增成员"}
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        size={420}
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
      <Drawer
        title={accountTypeEditing ? "编辑账户类型" : "新增账户类型"}
        open={accountTypeOpen}
        onClose={() => setAccountTypeOpen(false)}
        size={420}
        destroyOnHidden
      >
        <Form
          form={accountTypeForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = { name: values.name };
            return props.submit(
              () =>
                accountTypeEditing
                  ? updateAccountType(accountTypeEditing.id, payload)
                  : createAccountType(payload),
              {
                success: accountTypeEditing ? "账户类型已更新" : "账户类型已新增",
                onSuccess: () => setAccountTypeOpen(false)
              }
            );
          }}
        >
          <Form.Item name="name" label="类型名称" rules={[{ required: true }]}>
            <Input placeholder="如：券商理财" />
          </Form.Item>
          <Button type="primary" htmlType="button" onClick={() => accountTypeForm.submit()} block>
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

function MobileRecordList({ empty, children }: { empty: boolean; children: ReactNode }) {
  return empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> : <div className="mobile-record-list">{children}</div>;
}

function MobileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mobile-record-field">
      <Text type="secondary">{label}</Text>
      <Text>{value}</Text>
    </div>
  );
}

function TransactionFormFields({
  data,
  kind,
  onSubmit
}: {
  data: AppData;
  kind: "expense" | "income";
  onSubmit: () => void;
}) {
  return (
    <>
      <Form.Item name="date" label="日期" rules={[{ required: true }]}>
        <DatePicker className="full-width" />
      </Form.Item>
      <Form.Item name="categoryName" label="分类" rules={[{ required: true }]}>
        <Select options={data.categories.filter((category) => category.kind === kind).map(toSelectOption)} />
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

function AccountFormFields({
  accountTypes,
  members,
  currentValueManaged,
  onSubmit
}: {
  accountTypes: AccountTypeOption[];
  members: string[];
  currentValueManaged: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <Form.Item name="name" label="账户名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="type" label="账户类型" rules={[{ required: true }]}>
        <Select
          showSearch
          placeholder="请选择账户类型"
          options={accountTypeOptionsFromSettings(accountTypes)}
        />
      </Form.Item>
      <Form.Item name="ownerName" label="归属" rules={[{ required: true }]}>
        <Select options={members.map((member) => ({ label: member, value: member }))} />
      </Form.Item>
      <Form.Item
        name="currentValue"
        label={currentValueManaged ? "当前金额（由投资持仓自动汇总）" : "当前金额"}
        rules={[{ required: true }]}
      >
        <InputNumber min={0} precision={2} className="full-width" disabled={currentValueManaged} />
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
      <Form.Item
        name="initialBalance"
        label="初始负债金额"
        dependencies={["currentBalance"]}
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator: (_, value) => (
              value == null || Number(value) >= Number(getFieldValue("currentBalance") ?? 0)
                ? Promise.resolve()
                : Promise.reject(new Error("初始负债金额不能小于当前余额"))
            )
          })
        ]}
      >
        <InputNumber min={0} precision={2} className="full-width" />
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
      <Form.Item name="code" label="代码（可选）">
        <Input placeholder="基金或股票代码" />
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
      <Form.Item
        name="profit"
        label="持有收益"
        dependencies={["marketValue"]}
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator: (_, value) => (
              value == null || Number(value) <= Number(getFieldValue("marketValue"))
                ? Promise.resolve()
                : Promise.reject(new Error("持有收益不能大于当前金额"))
            )
          })
        ]}
      >
        <InputNumber precision={2} className="full-width" placeholder="亏损请输入负数" />
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

function RowActions({
  onEdit,
  onDelete,
  deleteLabel = "删除"
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  return (
    <Space size={4}>
      <Button type="link" size="small" onClick={onEdit}>
        编辑
      </Button>
      <Popconfirm
        title={`确认${deleteLabel}？`}
        description={`${deleteLabel}后将从列表中移除。`}
        okText={deleteLabel}
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onConfirm={onDelete}
      >
        <Button type="link" size="small" danger>
          {deleteLabel}
        </Button>
      </Popconfirm>
    </Space>
  );
}

function pageTitle(activePage: PageKey): string {
  return {
    report: "报表",
    spending: "支出",
    income: "收入",
    checkup: "财务盘点",
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

function isFundAccount(account: Account): boolean {
  return account.type === "基金" || account.type === "fund";
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
  const { label, color } = getAccountTypeMeta(type);
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

function renderCategoryTag(categoryName: string) {
  const colors = ["blue", "cyan", "geekblue", "green", "gold", "magenta", "orange", "purple", "volcano"];
  const index = [...categoryName].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0) % colors.length;
  return <Tag color={colors[index]}>{categoryName}</Tag>;
}

function renderTransactionSource(source?: FinanceTransaction["source"]) {
  const meta = {
    manual: { label: "手工录入", color: "default" },
    alipay: { label: "支付宝", color: "blue" },
    wechat: { label: "微信", color: "green" }
  } as const;
  const item = source ? meta[source] : undefined;
  return item ? <Tag color={item.color}>{item.label}</Tag> : <Tag>未标记</Tag>;
}

function renderHoldingType(type: InvestmentHolding["type"]) {
  const map = {
    fund: "基金",
    stock: "股票",
    etf: "ETF"
  };
  return <Tag color="purple">{map[type]}</Tag>;
}
