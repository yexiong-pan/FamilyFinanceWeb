import {
  CalendarOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined
} from "@ant-design/icons";
import type {
  Account,
  FinancialSafetyData,
  RecurringCashflow
} from "@family-finance/shared";
import { formatMoney } from "@family-finance/shared";
import {
  Alert,
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
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import type { Category, RecurringCashflowInput } from "./api/client";
import {
  createRecurringCashflow,
  deleteRecurringCashflow,
  updateFinancialSafetySettings,
  updateRecurringCashflow
} from "./api/client";
import {
  ExpenseNatureHelp,
  expenseNatureOptions,
  renderExpenseNature
} from "./expenseNature";

const { Text, Title } = Typography;

const confidenceMeta = {
  reliable: { label: "数据可靠", color: "green" },
  estimate: { label: "估算", color: "orange" },
  insufficient: { label: "数据不足", color: "red" }
} as const;

type Submit = <T>(
  run: () => Promise<T>,
  options: { success: string; onSuccess?: (result: T) => void }
) => Promise<void>;

interface FinancialSafetyPageProps {
  data: FinancialSafetyData;
  accounts: Account[];
  categories: Category[];
  members: string[];
  submit: Submit;
}

export function FinancialSafetyPage({
  data,
  accounts,
  categories,
  members,
  submit
}: FinancialSafetyPageProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cashflowOpen, setCashflowOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringCashflow | null>(null);
  const [settingsForm] = Form.useForm();
  const [cashflowForm] = Form.useForm();
  const cashflowKind = Form.useWatch<"income" | "expense">("kind", cashflowForm) ?? "expense";
  const selectedCategoryId = Form.useWatch<string | undefined>("categoryId", cashflowForm);
  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
  const { summary } = data;
  const confidence = confidenceMeta[summary.confidence];

  useEffect(() => {
    if (!settingsOpen) return;
    settingsForm.setFieldsValue({
      emergencyReserve: Number(data.settings.emergencyReserve),
      plannedMonthlySavings: Number(data.settings.plannedMonthlySavings),
      liquidAccountIds: data.settings.liquidAccountIds
    });
  }, [data.settings, settingsForm, settingsOpen]);

  useEffect(() => {
    if (!cashflowOpen) return;
    cashflowForm.setFieldsValue(
      editing
        ? {
            ...editing,
            amount: Number(editing.amount),
            startMonth: editing.startMonth ? dayjs(`${editing.startMonth}-01`) : undefined,
            endMonth: editing.endMonth ? dayjs(`${editing.endMonth}-01`) : undefined
          }
        : {
            name: undefined,
            kind: "expense",
            amount: undefined,
            dayOfMonth: 1,
            memberName: undefined,
            accountId: undefined,
            categoryId: undefined,
            expenseNature: "fixed",
            startMonth: undefined,
            endMonth: undefined,
            isActive: true
          }
    );
  }, [cashflowForm, cashflowOpen, editing]);

  const recurringColumns: ColumnsType<RecurringCashflow> = [
    {
      title: "项目",
      dataIndex: "name",
      width: 170,
      render: (value: string, record) => (
        <Space size={6}>
          <Text strong>{value}</Text>
          {!record.isActive ? <Tag>已停用</Tag> : null}
        </Space>
      )
    },
    {
      title: "类型",
      dataIndex: "kind",
      width: 90,
      render: (value: RecurringCashflow["kind"]) => (
        <Tag color={value === "income" ? "green" : "red"}>{value === "income" ? "收入" : "支出"}</Tag>
      )
    },
    {
      title: "金额",
      dataIndex: "amount",
      width: 130,
      align: "right",
      render: (value: string) => formatMoney(value)
    },
    {
      title: "发生日",
      dataIndex: "dayOfMonth",
      width: 100,
      render: (value: number) => `每月${value}日`
    },
    {
      title: "归属 / 分类",
      key: "owner",
      width: 190,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.memberName ? <Tag>{record.memberName}</Tag> : null}
          {record.categoryName ? <Tag color="blue">{record.categoryName}</Tag> : null}
          {record.expenseNature ? renderExpenseNature(record.expenseNature) : null}
          {!record.memberName && !record.categoryName && !record.expenseNature ? "—" : null}
        </Space>
      )
    },
    {
      title: "有效期",
      key: "range",
      width: 150,
      render: (_, record) => `${record.startMonth ?? "不限"} 至 ${record.endMonth ?? "不限"}`
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space size={2}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              setCashflowOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个周期项目？"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => submit(
              () => deleteRecurringCashflow(record.id),
              { success: "周期项目已删除" }
            )}
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space orientation="vertical" size={16} className="page-stack financial-safety-page">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className={Number(summary.shortfall) > 0 ? "safety-metric-card is-danger" : "safety-metric-card is-safe"}>
            <Statistic
              title="未来30天安全可支配"
              value={formatMoney(summary.safeToSpend)}
            />
            <Text type="secondary">
              {Number(summary.shortfall) > 0
                ? `资金缺口 ${formatMoney(summary.shortfall)}`
                : "已扣除必要支出、还款、储蓄和应急金"}
            </Text>
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card className="safety-metric-card">
            <Statistic title="可用流动资金" value={formatMoney(summary.liquidAmount)} />
            <Text type="secondary">资金用途为“日常可用”的账户</Text>
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card className="safety-metric-card">
            <Statistic
              title="应急金覆盖"
              value={summary.emergencyCoverageMonths === undefined ? "待计算" : `${summary.emergencyCoverageMonths} 个月`}
            />
            <Text type="secondary">按近3个月必要支出估算</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="safety-metric-card">
            <Statistic title="未来30天刚性流出" value={formatMoney(addMoney(summary.requiredExpenses, summary.debtPayments))} />
            <Text type="secondary">必要支出与负债还款</Text>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><SafetyCertificateOutlined />资金安全计算</Space>}
        extra={
          <Space wrap>
            <Tag color={confidence.color}>{confidence.label}</Tag>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>设置</Button>
          </Space>
        }
      >
        {summary.confidenceIssues.length ? (
          <Alert
            type="warning"
            showIcon
            title="当前结果仍是估算"
            description={summary.confidenceIssues.join("；")}
            className="safety-confidence-alert"
          />
        ) : null}
        <div className="safety-equation" aria-label="安全可支配金额计算过程">
          <SafetyEquationItem label="流动资金" value={summary.liquidAmount} sign="" />
          <SafetyEquationItem label="预计收入" value={summary.expectedIncome} sign="+" />
          <SafetyEquationItem label="必要支出" value={summary.requiredExpenses} sign="-" />
          <SafetyEquationItem label="负债还款" value={summary.debtPayments} sign="-" />
          <SafetyEquationItem label="计划储蓄" value={summary.plannedSavings} sign="-" />
          <SafetyEquationItem label="应急金底线" value={summary.emergencyReserve} sign="=" />
          <SafetyEquationItem
            label={Number(summary.shortfall) > 0 ? "资金缺口" : "安全可支配"}
            value={Number(summary.shortfall) > 0 ? summary.shortfall : summary.safeToSpend}
            sign=""
            strong
          />
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="未来30天资金安排" extra={<Text type="secondary">截至 {summary.asOfDate}</Text>}>
            {summary.upcomingObligations.length ? (
              <div className="safety-obligation-list">
                {summary.upcomingObligations.map((item) => (
                  <div className="safety-obligation-item" key={item.id}>
                    <div>
                      <Text strong>{item.name}</Text>
                      <div><Text type="secondary">{dayjs(item.date).format("M月D日")}{item.memberName ? ` · ${item.memberName}` : ""}</Text></div>
                    </div>
                    <Tag color={item.kind === "income" ? "green" : item.kind === "debt" ? "volcano" : "red"}>
                      {item.kind === "income" ? "+" : "-"}{formatMoney(item.amount)}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="配置周期收支后显示未来资金安排" />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card
            title="周期性收支"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setCashflowOpen(true);
                }}
              >
                新增项目
              </Button>
            }
          >
            {isMobile ? (
              data.recurringCashflows.length ? (
                <div className="mobile-record-list">
                  {data.recurringCashflows.map((item) => (
                    <div className="mobile-record-card" key={item.id}>
                      <Flex justify="space-between" align="center" gap={8}>
                        <Text strong>{item.name}</Text>
                        <Tag color={item.kind === "income" ? "green" : "red"}>{formatMoney(item.amount)}</Tag>
                      </Flex>
                      <Flex gap={6} wrap>
                        <Tag icon={<CalendarOutlined />}>每月{item.dayOfMonth}日</Tag>
                        {item.memberName ? <Tag>{item.memberName}</Tag> : null}
                        {item.expenseNature ? renderExpenseNature(item.expenseNature) : null}
                        {!item.isActive ? <Tag>已停用</Tag> : null}
                      </Flex>
                      <Flex justify="end">
                        <Button type="link" size="small" onClick={() => {
                          setEditing(item);
                          setCashflowOpen(true);
                        }}>编辑</Button>
                        <Popconfirm
                          title="确认删除这个周期项目？"
                          onConfirm={() => submit(
                            () => deleteRecurringCashflow(item.id),
                            { success: "周期项目已删除" }
                          )}
                        >
                          <Button type="link" size="small" danger>删除</Button>
                        </Popconfirm>
                      </Flex>
                    </div>
                  ))}
                </div>
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无周期性收支" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={data.recurringCashflows}
                columns={recurringColumns}
                scroll={{ x: 950 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Drawer
        title="资金安全设置"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        size={420}
        destroyOnHidden
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={(values) => submit(
            () => updateFinancialSafetySettings({
              emergencyReserve: String(values.emergencyReserve ?? 0),
              plannedMonthlySavings: String(values.plannedMonthlySavings ?? 0),
              liquidAccountIds: values.liquidAccountIds ?? []
            }),
            { success: "资金安全设置已保存", onSuccess: () => setSettingsOpen(false) }
          )}
        >
          <Form.Item name="emergencyReserve" label="应急金底线" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item name="plannedMonthlySavings" label="每月计划储蓄" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item
            name="liquidAccountIds"
            label="手工计入流动资金的账户"
            extra="可选。不选择时，自动使用资金用途为“日常可用”的账户"
          >
            <Select
              mode="multiple"
              placeholder="选择未来30天可以直接动用的账户"
              options={accounts.map((item) => ({
                label: `${item.name}（${formatMoney(item.currentValue)}）`,
                value: item.id
              }))}
            />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            title="计算口径"
            description="安全可支配金额会保留应急金底线，并预先扣除未来30天的必要支出、负债还款和计划储蓄。"
          />
          <Button type="primary" htmlType="submit" block className="drawer-submit-button">保存</Button>
        </Form>
      </Drawer>

      <Drawer
        title={editing ? "编辑周期项目" : "新增周期项目"}
        open={cashflowOpen}
        onClose={() => setCashflowOpen(false)}
        size={460}
        destroyOnHidden
      >
        <Form
          form={cashflowForm}
          layout="vertical"
          onFinish={(values) => {
            const payload: RecurringCashflowInput = {
              name: values.name,
              kind: values.kind,
              amount: String(values.amount),
              dayOfMonth: values.dayOfMonth,
              memberName: values.memberName,
              accountId: values.accountId,
              categoryId: values.categoryId,
              expenseNature: values.kind === "expense" ? values.expenseNature : undefined,
              startMonth: values.startMonth?.format("YYYY-MM"),
              endMonth: values.endMonth?.format("YYYY-MM"),
              isActive: values.isActive
            };
            return submit(
              () => editing
                ? updateRecurringCashflow(editing.id, payload)
                : createRecurringCashflow(payload),
              {
                success: editing ? "周期项目已更新" : "周期项目已新增",
                onSuccess: () => setCashflowOpen(false)
              }
            );
          }}
        >
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="如：工资、房租、保险" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="kind" label="收支类型" rules={[{ required: true }]}>
                <Select
                  options={[{ label: "支出", value: "expense" }, { label: "收入", value: "income" }]}
                  onChange={(value) => {
                    cashflowForm.setFieldsValue({
                      categoryId: undefined,
                      expenseNature: value === "expense" ? "fixed" : undefined
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dayOfMonth" label="每月发生日" rules={[{ required: true }]}>
                <InputNumber min={1} max={31} precision={0} className="full-width" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="amount" label="预计金额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} className="full-width" />
          </Form.Item>
          <Form.Item name="memberName" label="归属成员">
            <Select allowClear options={members.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="accountId" label="关联账户">
            <Select allowClear options={accounts.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item name="categoryId" label="关联分类">
            <Select
              allowClear
              onChange={(value) => {
                const category = categories.find((item) => item.id === value);
                if (cashflowKind === "expense" && category?.expenseNature) {
                  cashflowForm.setFieldValue("expenseNature", category.expenseNature);
                }
              }}
              options={categories
                .filter((item) => item.kind === cashflowKind)
                .map((item) => ({ label: item.name, value: item.id }))}
            />
          </Form.Item>
          {cashflowKind === "expense" ? (
            <Form.Item
              name="expenseNature"
              label={<Space size={4}>支出性质<ExpenseNatureHelp /></Space>}
              rules={[{ required: true }]}
              extra={selectedCategory?.expenseNature ? "由关联分类自动带出" : undefined}
            >
              <Select
                options={expenseNatureOptions}
                disabled={Boolean(selectedCategory?.expenseNature)}
              />
            </Form.Item>
          ) : null}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startMonth" label="开始月份">
                <DatePicker inputReadOnly picker="month" className="full-width" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endMonth" label="结束月份">
                <DatePicker inputReadOnly picker="month" className="full-width" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isActive" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>保存</Button>
        </Form>
      </Drawer>
    </Space>
  );
}

function SafetyEquationItem({
  label,
  value,
  sign,
  strong = false
}: {
  label: string;
  value: string;
  sign: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "safety-equation-item is-result" : "safety-equation-item"}>
      <span className="safety-equation-sign">{sign}</span>
      <Text type={strong ? undefined : "secondary"}>{label}</Text>
      <Text strong={strong}>{formatMoney(value)}</Text>
    </div>
  );
}

function addMoney(left: string, right: string): string {
  return (Number(left) + Number(right)).toFixed(2);
}
