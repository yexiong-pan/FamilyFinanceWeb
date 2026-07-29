import {
  CalendarOutlined,
  ExperimentOutlined,
  FilterOutlined,
  FireOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  RightOutlined,
  ScheduleOutlined,
  UserOutlined,
  WalletOutlined
} from "@ant-design/icons";
import type {
  CalendarData,
  CalendarDayEntry,
  CalendarDayEntryType,
  CalendarDaySummary,
  CalendarMonthSummary,
  FamilyMemberInfo,
  HealthData,
  MedicationDoseStatus
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
  List,
  Popover,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createBloodGlucose,
  createBodyMeasurement,
  createExerciseLog,
  getCalendarData,
  getHealthData,
  saveMedicationDose
} from "./api/client";
import {
  bodyMeasurementContextLabels,
  buildMedicationTasks,
  followupStatusLabels,
  glucoseContextLabels,
  medicationDoseStatusLabels,
  toMinuteIso
} from "./data/health";
import type { CalendarTabKey, HealthTabKey } from "./navigation";

const { Text, Title } = Typography;
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MINUTE_DATE_TIME_PICKER_PROPS = {
  format: "YYYY-MM-DD HH:mm",
  showTime: {
    format: "HH:mm",
    showSecond: false
  }
} as const;
const CALENDAR_CONTENT_STORAGE_KEY = "family-finance.calendar-visible-content";
const CALENDAR_CONTENT_OPTIONS: Array<{ label: string; value: CalendarDayEntryType }> = [
  { label: "收入", value: "income" },
  { label: "支出", value: "expense" },
  { label: "运动", value: "exercise" },
  { label: "血糖", value: "glucose" },
  { label: "用药", value: "medication" },
  { label: "复诊", value: "followup" }
];
const ALL_CALENDAR_CONTENT = CALENDAR_CONTENT_OPTIONS.map((option) => option.value);
type QuickHealthKind = "medication" | "body" | "glucose" | "exercise";

interface CalendarPageProps {
  monthKey: string;
  tab: CalendarTabKey;
  memberId: string;
  members: FamilyMemberInfo[];
  onTabChange(tab: CalendarTabKey): void;
  onMemberChange(memberId: string): void;
  onOpenMonth(month: string): void;
  onOpenCashflow(kind: "income" | "expense", month: string, memberName?: string): void;
  onOpenHealth(tab: HealthTabKey, memberId?: string, month?: string): void;
}

export function CalendarPage({
  monthKey,
  tab,
  memberId,
  members,
  onTabChange,
  onMemberChange,
  onOpenMonth,
  onOpenCashflow,
  onOpenHealth
}: CalendarPageProps) {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const [data, setData] = useState<CalendarData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [pendingSelectedDate, setPendingSelectedDate] = useState<string>();
  const [visibleEntryTypes, setVisibleEntryTypes] = useState<CalendarDayEntryType[]>(
    readVisibleCalendarContent
  );
  const [quickHealthKind, setQuickHealthKind] = useState<QuickHealthKind>();
  const [refreshKey, setRefreshKey] = useState(0);
  const period = tab === "year" ? monthKey.slice(0, 4) : monthKey;
  const selectedMember = members.find((member) => member.id === memberId);

  useEffect(() => {
    if (memberId !== "all" && members.length && !members.some((member) => member.id === memberId)) {
      onMemberChange("all");
    }
  }, [memberId, members, onMemberChange]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    setSelectedDate(undefined);
    void getCalendarData(tab, period, memberId)
      .then((nextData) => {
        if (active) setData(nextData);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "日历数据加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, period, refreshKey, tab]);

  const dayByDate = useMemo(
    () => new Map(data?.days.map((day) => [day.date, day]) ?? []),
    [data?.days]
  );
  const selectedDay = selectedDate ? dayByDate.get(selectedDate) : undefined;
  const openCalendarDate = (date: string) => {
    if (tab === "month" && monthKey === date.slice(0, 7)) {
      setPendingSelectedDate(undefined);
      setSelectedDate(date);
      return;
    }
    setPendingSelectedDate(date);
    onOpenMonth(date.slice(0, 7));
  };
  const openToday = () => openCalendarDate(dayjs().format("YYYY-MM-DD"));
  const changeVisibleEntryTypes = (types: CalendarDayEntryType[]) => {
    setVisibleEntryTypes(types);
    window.localStorage.setItem(CALENDAR_CONTENT_STORAGE_KEY, JSON.stringify(types));
  };

  useEffect(() => {
    if (
      !pendingSelectedDate
      || tab !== "month"
      || period !== pendingSelectedDate.slice(0, 7)
      || data?.period !== period
    ) return;
    setSelectedDate(pendingSelectedDate);
    setPendingSelectedDate(undefined);
  }, [data, pendingSelectedDate, period, tab]);

  return (
    <Space orientation="vertical" size={16} className="page-stack calendar-page">
      <Flex justify="space-between" align="center" wrap="wrap" gap={10} className="calendar-toolbar">
        <Flex gap={8} align="center" className="calendar-view-actions">
          <Segmented
            value={tab}
            onChange={(value) => onTabChange(value as CalendarTabKey)}
            options={[
              { label: "月视角", value: "month", icon: <CalendarOutlined /> },
              { label: "年视角", value: "year", icon: <WalletOutlined /> }
            ]}
          />
          <Button icon={<CalendarOutlined />} onClick={openToday}>今天</Button>
        </Flex>
        <Flex gap={8} align="center" className="calendar-filter-actions">
          {tab === "month" ? (
            <CalendarContentFilter value={visibleEntryTypes} onChange={changeVisibleEntryTypes} />
          ) : null}
          <Select
            aria-label="日历家庭成员"
            value={memberId}
            onChange={onMemberChange}
            className="calendar-member-select"
            options={[
              { label: "全部家庭成员", value: "all" },
              ...members.map((member) => ({ label: member.name, value: member.id }))
            ]}
          />
        </Flex>
      </Flex>

      {error ? <Alert type="error" showIcon title="日历加载失败" description={error} /> : null}
      <Spin spinning={loading}>
        {data && tab === "month" ? (
          <MonthCalendar
            data={data}
            monthKey={monthKey}
            selectedDate={selectedDate}
            visibleEntryTypes={visibleEntryTypes}
            onSelectDate={openCalendarDate}
          />
        ) : null}
        {data && tab === "year" ? (
          <YearCalendar
            data={data}
            memberName={selectedMember?.name}
            onOpenMonth={onOpenMonth}
            onOpenCashflow={onOpenCashflow}
            onOpenHealth={(healthTab, nextMonth) => onOpenHealth(healthTab, selectedMember?.id, nextMonth)}
          />
        ) : null}
      </Spin>

      <DayDetailDrawer
        open={Boolean(selectedDate)}
        date={selectedDate}
        day={selectedDay}
        memberName={selectedMember?.name}
        mobile={!screens.md}
        members={members}
        selectedMemberId={selectedMember?.id}
        onClose={() => setSelectedDate(undefined)}
        onOpenCashflow={onOpenCashflow}
        onOpenHealth={(healthTab) => onOpenHealth(healthTab, selectedMember?.id, monthKey)}
        onQuickRecord={setQuickHealthKind}
      />
      <QuickHealthDrawer
        open={Boolean(quickHealthKind)}
        kind={quickHealthKind}
        date={selectedDate}
        members={members}
        defaultMemberId={selectedMember?.id}
        mobile={!screens.md}
        onClose={() => setQuickHealthKind(undefined)}
        onSaved={() => {
          message.success("健康记录已保存");
          setRefreshKey((value) => value + 1);
        }}
      />
    </Space>
  );
}

function MonthCalendar({
  data,
  monthKey,
  selectedDate,
  visibleEntryTypes,
  onSelectDate
}: {
  data: CalendarData;
  monthKey: string;
  selectedDate?: string;
  visibleEntryTypes: CalendarDayEntryType[];
  onSelectDate(date: string): void;
}) {
  const cells = buildMonthCells(monthKey);
  const visibleTypes = new Set(visibleEntryTypes);
  return (
    <>
      <MonthCalendarSummary data={data} />
      <Card className="calendar-grid-card">
        <div className="calendar-grid-scroll">
          <div className="calendar-grid-inner">
            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="calendar-month-grid">
              {cells.map((date) => {
                const dateKey = date.format("YYYY-MM-DD");
                const outsideMonth = date.format("YYYY-MM") !== monthKey;
                const day = data.days.find((item) => item.date === dateKey);
                const entries = (day?.entries ?? []).filter((entry) => visibleTypes.has(entry.type));
                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={[
                      "calendar-day",
                      outsideMonth ? "is-outside-month" : "",
                      entries.length ? "has-content" : "",
                      dateKey === dayjs().format("YYYY-MM-DD") ? "is-today" : "",
                      dateKey === selectedDate ? "is-selected" : ""
                    ].filter(Boolean).join(" ")}
                    onClick={() => onSelectDate(dateKey)}
                    aria-label={`${date.format("M月D日")}详情`}
                  >
                    <div className="calendar-day-heading">
                      <span>{outsideMonth ? date.format("M月D日") : date.date()}</span>
                    </div>
                    <div className="calendar-day-content">
                      {entries.slice(0, 6).map((entry) => <CalendarEntryRow key={entry.id} entry={entry} />)}
                      {entries.length > 6 ? <span className="calendar-more-entry">还有 {entries.length - 6} 项</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

function CalendarContentFilter({
  value,
  onChange
}: {
  value: CalendarDayEntryType[];
  onChange(value: CalendarDayEntryType[]): void;
}) {
  const allSelected = value.length === ALL_CALENDAR_CONTENT.length;
  return (
    <Popover
      placement="bottomRight"
      trigger="click"
      title="日历显示内容"
      content={(
        <div className="calendar-content-filter-panel">
          <Checkbox
            checked={allSelected}
            indeterminate={value.length > 0 && !allSelected}
            onChange={(event) => onChange(event.target.checked ? ALL_CALENDAR_CONTENT : [])}
          >
            全部
          </Checkbox>
          <Checkbox.Group
            value={value}
            options={CALENDAR_CONTENT_OPTIONS}
            onChange={(nextValue) => onChange(nextValue as CalendarDayEntryType[])}
            className="calendar-content-options"
          />
        </div>
      )}
    >
      <Button icon={<FilterOutlined />} className="calendar-content-filter-button">
        显示内容 {value.length}/{ALL_CALENDAR_CONTENT.length}
      </Button>
    </Popover>
  );
}

function CalendarEntryRow({ entry }: { entry: CalendarDayEntry }) {
  const icon = entry.type === "glucose"
    ? <ExperimentOutlined />
    : entry.type === "exercise"
      ? <FireOutlined />
      : entry.type === "medication"
        ? <MedicineBoxOutlined />
        : entry.type === "followup"
          ? <ScheduleOutlined />
          : <WalletOutlined />;
  return (
    <span className={[
      "calendar-entry-row",
      `is-${entry.type}`,
      entry.abnormal || entry.medication?.missed ? "has-warning" : ""
    ].filter(Boolean).join(" ")}>
      <span className="calendar-entry-icon">{icon}</span>
      <span className="calendar-entry-member">{entry.memberName}</span>
      <span className="calendar-entry-text">{calendarEntryText(entry)}</span>
    </span>
  );
}

function YearCalendar({
  data,
  memberName,
  onOpenMonth,
  onOpenCashflow,
  onOpenHealth
}: {
  data: CalendarData;
  memberName?: string;
  onOpenMonth(month: string): void;
  onOpenCashflow(kind: "income" | "expense", month: string, memberName?: string): void;
  onOpenHealth(tab: HealthTabKey, month: string): void;
}) {
  return (
    <>
      <CalendarSummaryCards summary={data.summary} />
      <div className="calendar-year-grid">
        {data.months.map((month) => {
          const isFuture = dayjs(`${month.month}-01`).isAfter(dayjs(), "month");
          const hasWarning = Number(month.balance) < 0
            || month.glucoseAbnormalCount > 0
            || month.medication.missed > 0;
          return (
            <Card
              key={month.month}
              className={[
                "calendar-year-card",
                month.month === dayjs().format("YYYY-MM") ? "is-current" : "",
                isFuture ? "is-future" : "",
                hasWarning ? "has-warning" : ""
              ].filter(Boolean).join(" ")}
              title={`${Number(month.month.slice(5))}月`}
              extra={<Button type="text" icon={<RightOutlined />} onClick={() => onOpenMonth(month.month)} aria-label={`打开${month.month}`} />}
            >
              <button
                type="button"
                className="calendar-year-finance"
                onClick={() => onOpenMonth(month.month)}
              >
                <span><Text type="secondary">收入</Text><strong className="is-income">{compactMoney(month.income)}</strong></span>
                <span><Text type="secondary">支出</Text><strong className="is-expense">{compactMoney(month.expense)}</strong></span>
                <span><Text type="secondary">结余</Text><strong>{compactMoney(month.balance)}</strong></span>
                <span>
                  <Text type="secondary">支出环比</Text>
                  <strong>{formatChangeRate(month.expenseChangeRate)}</strong>
                </span>
              </button>
              <div className="calendar-year-signals">
                <MetricLink
                  icon={<ExperimentOutlined />}
                  label={`血糖 ${month.glucoseMeasurements}次${month.glucoseAbnormalCount ? ` · 异常${month.glucoseAbnormalCount}次` : ""}`}
                  warning={month.glucoseAbnormalCount > 0}
                  onClick={() => onOpenHealth("glucose", month.month)}
                />
                <MetricLink
                  icon={<MedicineBoxOutlined />}
                  label={medicationLabel(month)}
                  warning={month.medication.missed > 0}
                  onClick={() => onOpenHealth("medication", month.month)}
                />
                <MetricLink
                  icon={<FireOutlined />}
                  label={`运动 ${month.exerciseMinutes}分钟`}
                  onClick={() => onOpenHealth("body", month.month)}
                />
                <MetricLink
                  icon={<ScheduleOutlined />}
                  label={month.followupCount ? `复诊 ${month.followupCount}项` : "无复诊安排"}
                  warning={month.scheduledFollowupCount > 0}
                  onClick={() => onOpenHealth("medication", month.month)}
                />
              </div>
              <Flex gap={6} wrap className="calendar-year-actions">
                <Button size="small" onClick={() => onOpenCashflow("income", month.month, memberName)}>收入明细</Button>
                <Button size="small" onClick={() => onOpenCashflow("expense", month.month, memberName)}>支出明细</Button>
              </Flex>
            </Card>
          );
        })}
      </div>
      <Text type="secondary" className="calendar-year-note">
        年日历用于快速比较月份；完整趋势、分类和资产变化请在年报中查看。
      </Text>
    </>
  );
}

function CalendarSummaryCards({
  summary
}: {
  summary: CalendarData["summary"];
}) {
  const averageExpense = Number(summary.expense) / 12;
  const items = [
    { title: "全年收入", value: formatMoney(summary.income), tone: "income" },
    { title: "全年支出", value: formatMoney(summary.expense), tone: "expense" },
    { title: "全年结余", value: formatMoney(summary.balance), tone: "asset" },
    {
      title: "月均支出",
      value: formatMoney(String(averageExpense)),
      tone: "neutral"
    }
  ];
  return (
    <Row gutter={[12, 12]} className="calendar-summary-row">
      {items.map((item) => (
        <Col xs={12} md={6} key={item.title}>
          <Card className={`calendar-summary-card metric-card--${item.tone}`}>
            <Statistic title={item.title} value={item.value} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function MonthCalendarSummary({ data }: { data: CalendarData }) {
  const reminders = [
    { label: "血糖异常", value: data.summary.glucoseAbnormalCount },
    { label: "漏服", value: data.summary.medication.missed },
    { label: "待复诊", value: data.summary.scheduledFollowupCount }
  ];
  const reminderTotal = reminders.reduce((sum, item) => sum + item.value, 0);
  return (
    <Row gutter={[12, 12]} className="calendar-summary-row calendar-month-summary-row">
      <Col xs={12} xl={6}>
        <Card className="calendar-summary-card metric-card--asset" title="本月收支">
          <div className="calendar-summary-list">
            <SummaryLine label="收入" value={formatMoney(data.summary.income)} tone="income" />
            <SummaryLine label="支出" value={formatMoney(data.summary.expense)} tone="expense" />
            <SummaryLine label="结余" value={formatMoney(data.summary.balance)} tone="asset" />
          </div>
        </Card>
      </Col>
      <Col xs={12} xl={6}>
        <Card className="calendar-summary-card metric-card--neutral" title="运动情况">
          <div className="calendar-summary-list">
            {data.exerciseByMember.map((item) => (
              <SummaryLine
                key={item.memberId}
                label={item.memberName}
                value={item.activities.length
                  ? item.activities.map((activity) => `${activity.type} ${activity.minutes}分`).join(" · ")
                  : "暂无运动"}
              />
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={12} xl={6}>
        <Card className="calendar-summary-card metric-card--income" title="体重情况">
          <div className="calendar-summary-list">
            {data.latestWeightByMember.map((item) => (
              <SummaryLine
                key={item.memberId}
                label={item.memberName}
                value={item.weightKg ? `${Number(item.weightKg)} kg` : "暂无"}
                note={item.measuredAt ? dayjs(item.measuredAt).format("M月D日") : undefined}
              />
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={12} xl={6}>
        <Card className="calendar-summary-card metric-card--warning" title="健康提醒">
          <div className="calendar-reminder-total">
            <strong>{reminderTotal}</strong><span>项</span>
          </div>
          <div className="calendar-reminder-breakdown">
            {reminders.map((item) => <span key={item.label}>{item.label} {item.value}</span>)}
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function SummaryLine({
  label,
  value,
  tone,
  note
}: {
  label: string;
  value: string;
  tone?: "income" | "expense" | "asset";
  note?: string;
}) {
  return (
    <div className="calendar-summary-line">
      <span>{label}</span>
      <strong className={tone ? `is-${tone}` : undefined} title={value}>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function DayDetailDrawer({
  open,
  date,
  day,
  memberName,
  mobile,
  members,
  selectedMemberId,
  onClose,
  onOpenCashflow,
  onOpenHealth,
  onQuickRecord
}: {
  open: boolean;
  date?: string;
  day?: CalendarDaySummary;
  memberName?: string;
  mobile: boolean;
  members: FamilyMemberInfo[];
  selectedMemberId?: string;
  onClose(): void;
  onOpenCashflow(kind: "income" | "expense", month: string, memberName?: string): void;
  onOpenHealth(tab: HealthTabKey): void;
  onQuickRecord(kind: QuickHealthKind): void;
}) {
  const month = date?.slice(0, 7) ?? "";
  return (
    <Drawer
      open={open}
      size={mobile ? "100%" : 480}
      title={date ? `${dayjs(date).format("M月D日")} 周${"日一二三四五六"[dayjs(date).day()]}` : "当天详情"}
      onClose={onClose}
    >
      <Space orientation="vertical" size={16} className="calendar-day-detail">
        <DetailSection title="快速记录" icon={<PlusOutlined />}>
          <div className="calendar-quick-actions">
            <Button icon={<MedicineBoxOutlined />} onClick={() => onQuickRecord("medication")}>用药</Button>
            <Button icon={<UserOutlined />} onClick={() => onQuickRecord("body")}>体重</Button>
            <Button icon={<ExperimentOutlined />} onClick={() => onQuickRecord("glucose")}>血糖</Button>
            <Button icon={<FireOutlined />} onClick={() => onQuickRecord("exercise")}>运动</Button>
          </div>
          <Text type="secondary">
            {selectedMemberId
              ? `记录归属：${members.find((member) => member.id === selectedMemberId)?.name ?? "当前成员"}`
              : "当前查看全部成员，保存时请选择记录归属"}
          </Text>
        </DetailSection>

        {!day || !dayHasContent(day) ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当天暂无记录或安排" />
        ) : (
          <>
          <DetailSection
            title="财务"
            icon={<WalletOutlined />}
            action={(
              <Space size={6}>
                <Button size="small" onClick={() => onOpenCashflow("income", month, memberName)}>收入</Button>
                <Button size="small" onClick={() => onOpenCashflow("expense", month, memberName)}>支出</Button>
              </Space>
            )}
          >
            <Flex gap={8} wrap>
              <Tag color="green">收入 {formatMoney(day.income)} · {day.incomeCount}笔</Tag>
              <Tag color="red">支出 {formatMoney(day.expense)} · {day.expenseCount}笔</Tag>
              <Tag color={Number(day.balance) >= 0 ? "blue" : "orange"}>结余 {formatMoney(day.balance)}</Tag>
            </Flex>
          </DetailSection>

          <DetailSection
            title="血糖"
            icon={<ExperimentOutlined />}
            action={<Button type="link" size="small" onClick={() => onOpenHealth("glucose")}>查看健康记录</Button>}
          >
            {day.glucoseReadings.length ? day.glucoseReadings.map((reading) => (
              <Flex key={reading.id} justify="space-between" align="center" gap={8}>
                <Space size={6}>
                  <Tag color={reading.abnormal ? "red" : "green"}>{reading.value} mmol/L</Tag>
                  <Text>{glucoseContextLabels[reading.context]}</Text>
                </Space>
                <Text type="secondary">{reading.memberName} · {dayjs(reading.measuredAt).format("HH:mm")}</Text>
              </Flex>
            )) : <Text type="secondary">无血糖记录</Text>}
          </DetailSection>

          <DetailSection
            title="用药与运动"
            icon={<MedicineBoxOutlined />}
            action={<Button type="link" size="small" onClick={() => onOpenHealth("medication")}>查看用药</Button>}
          >
            <Flex gap={8} wrap>
              {day.medication.scheduled ? (
                <>
                  <Tag color="green">已服 {day.medication.taken}</Tag>
                  <Tag color={day.medication.missed ? "red" : "default"}>漏服 {day.medication.missed}</Tag>
                  <Tag>待服 {day.medication.pending}</Tag>
                  {day.medication.paused ? <Tag color="blue">遵医嘱暂停 {day.medication.paused}</Tag> : null}
                </>
              ) : <Tag>无用药计划</Tag>}
              <Tag icon={<FireOutlined />}>运动 {day.exerciseMinutes}分钟</Tag>
            </Flex>
          </DetailSection>

          <DetailSection
            title="复诊安排"
            icon={<ScheduleOutlined />}
            action={<Button type="link" size="small" onClick={() => onOpenHealth("medication")}>查看复诊</Button>}
          >
            {day.followups.length ? day.followups.map((followup) => (
              <Flex key={followup.id} justify="space-between" align="flex-start" gap={8}>
                <div>
                  <Text strong>{followup.type}</Text>
                  <div><Text type="secondary">{[followup.hospital, followup.department].filter(Boolean).join(" · ") || "未填写地点"}</Text></div>
                </div>
                <Space size={6}>
                  <Tag color={followup.status === "scheduled" ? "orange" : followup.status === "completed" ? "green" : "default"}>
                    {followupStatusLabels[followup.status]}
                  </Tag>
                  <Text type="secondary">{followup.memberName}</Text>
                </Space>
              </Flex>
            )) : <Text type="secondary">无复诊安排</Text>}
          </DetailSection>
          </>
        )}
      </Space>
    </Drawer>
  );
}

interface QuickHealthFormValues {
  memberId: string;
  measuredAt?: dayjs.Dayjs;
  weightKg?: number;
  waistCm?: number;
  bodyContext?: "morningFasting" | "other";
  exerciseDate?: dayjs.Dayjs;
  exerciseType?: string;
  durationMinutes?: number;
  intensity?: "low" | "moderate" | "high";
  isStrengthTraining?: boolean;
  steps?: number;
  estimatedCalories?: number;
  glucoseMmol?: number;
  glucoseContext?: "fasting" | "beforeMeal" | "afterMeal1h" | "afterMeal2h" | "bedtime" | "random";
  medicationTaken?: boolean;
  symptoms?: string;
  note?: string;
}

function QuickHealthDrawer({
  open,
  kind,
  date,
  members,
  defaultMemberId,
  mobile,
  onClose,
  onSaved
}: {
  open: boolean;
  kind?: QuickHealthKind;
  date?: string;
  members: FamilyMemberInfo[];
  defaultMemberId?: string;
  mobile: boolean;
  onClose(): void;
  onSaved(): void;
}) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<QuickHealthFormValues>();
  const watchedMemberId = Form.useWatch("memberId", form);
  const [healthData, setHealthData] = useState<HealthData>();
  const [loading, setLoading] = useState(false);
  const [savingDoseKey, setSavingDoseKey] = useState<string>();
  const selectedDate = date ?? dayjs().format("YYYY-MM-DD");
  const selectedMemberId = watchedMemberId ?? defaultMemberId ?? members[0]?.id;
  const title = {
    medication: "记录用药",
    body: "记录体重",
    glucose: "记录血糖",
    exercise: "记录运动"
  }[kind ?? "body"];

  useEffect(() => {
    if (!open) return;
    const memberId = defaultMemberId ?? members[0]?.id;
    const selectedMoment = dayjs(selectedDate)
      .hour(dayjs().hour())
      .minute(dayjs().minute())
      .second(0);
    form.resetFields();
    form.setFieldsValue({
      memberId,
      measuredAt: selectedMoment,
      bodyContext: "morningFasting",
      exerciseDate: dayjs(selectedDate),
      intensity: "moderate",
      isStrengthTraining: false
    });
  }, [defaultMemberId, form, members, open, selectedDate]);

  useEffect(() => {
    if (!open || !selectedMemberId) {
      setHealthData(undefined);
      return;
    }
    let active = true;
    setHealthData(undefined);
    setLoading(true);
    void getHealthData(selectedMemberId, selectedDate.slice(0, 7))
      .then((nextData) => {
        if (active) setHealthData(nextData);
      })
      .catch((reason: unknown) => {
        if (active) message.error(reason instanceof Error ? reason.message : "健康数据加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [message, open, selectedDate, selectedMemberId]);

  const featureEnabled = kind === "body"
    ? healthData?.profile.weightTrackingEnabled
    : kind === "exercise"
      ? healthData?.profile.exerciseTrackingEnabled
      : kind === "glucose"
        ? healthData?.profile.glucoseTrackingEnabled
        : healthData?.profile.medicationTrackingEnabled;

  const submit = async (values: QuickHealthFormValues) => {
    if (!kind || !values.memberId) return;
    try {
      if (kind === "body") {
        await createBodyMeasurement(values.memberId, {
          measuredAt: toMinuteIso(values.measuredAt!),
          weightKg: String(values.weightKg),
          ...(values.waistCm === undefined ? {} : { waistCm: String(values.waistCm) }),
          context: values.bodyContext ?? "morningFasting",
          note: values.note
        });
      } else if (kind === "exercise") {
        await createExerciseLog(values.memberId, {
          date: values.exerciseDate!.format("YYYY-MM-DD"),
          type: values.exerciseType!.trim(),
          durationMinutes: values.durationMinutes!,
          intensity: values.intensity!,
          isStrengthTraining: values.isStrengthTraining ?? false,
          ...(values.steps === undefined ? {} : { steps: values.steps }),
          ...(values.estimatedCalories === undefined ? {} : { estimatedCalories: values.estimatedCalories }),
          note: values.note
        });
      } else if (kind === "glucose") {
        await createBloodGlucose(values.memberId, {
          measuredAt: toMinuteIso(values.measuredAt!),
          glucoseMmol: String(values.glucoseMmol),
          context: values.glucoseContext!,
          medicationTaken: values.medicationTaken,
          symptoms: values.symptoms,
          note: values.note,
          source: "manual"
        });
      }
      onSaved();
      onClose();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "健康记录保存失败");
    }
  };

  const medicationTasks = healthData
    ? buildMedicationTasks(healthData.medicationPlans, healthData.medicationDoseRecords, selectedDate)
    : [];

  const saveDose = async (
    medicationId: string,
    slotId: string,
    key: string,
    status: MedicationDoseStatus
  ) => {
    try {
      setSavingDoseKey(key);
      await saveMedicationDose(medicationId, {
        scheduledDate: selectedDate,
        slotId,
        status,
        ...(status === "taken"
          ? {
              takenAt: toMinuteIso(
                dayjs(selectedDate).hour(dayjs().hour()).minute(dayjs().minute())
              )
            }
          : {})
      });
      if (selectedMemberId) {
        setHealthData(await getHealthData(selectedMemberId, selectedDate.slice(0, 7)));
      }
      onSaved();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "用药记录保存失败");
    } finally {
      setSavingDoseKey(undefined);
    }
  };

  return (
    <Drawer
      open={open}
      size={mobile ? "100%" : 480}
      title={`${title} · ${dayjs(selectedDate).format("M月D日")}`}
      onClose={onClose}
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
          <Form.Item name="memberId" label="家庭成员" rules={[{ required: true, message: "请选择家庭成员" }]}>
            <Select options={members.map((member) => ({ label: member.name, value: member.id }))} />
          </Form.Item>

          {healthData && !featureEnabled ? (
            <Alert
              type="warning"
              showIcon
              title={`该成员尚未开启${title.replace("记录", "")}记录`}
              description="请先在健康页面的成员设置中开启对应记录项目。"
            />
          ) : null}

          {featureEnabled && kind === "body" ? (
            <>
              <Form.Item name="measuredAt" label="测量时间" rules={[{ required: true }]}>
                <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
              </Form.Item>
              <Form.Item name="weightKg" label="体重 (kg)" rules={[{ required: true, message: "请输入体重" }]}>
                <InputNumber min={20} max={400} step={0.1} className="health-full-width" />
              </Form.Item>
              <Form.Item name="waistCm" label="腰围 (cm)">
                <InputNumber min={30} max={300} step={0.1} className="health-full-width" />
              </Form.Item>
              <Form.Item name="bodyContext" label="测量状态" rules={[{ required: true }]}>
                <Segmented
                  block
                  options={Object.entries(bodyMeasurementContextLabels).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
              <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
              <Button type="primary" htmlType="submit">保存体重</Button>
            </>
          ) : null}

          {featureEnabled && kind === "exercise" ? (
            <>
              <Form.Item name="exerciseDate" label="运动日期" rules={[{ required: true }]}>
                <DatePicker className="health-full-width" />
              </Form.Item>
              <Form.Item name="exerciseType" label="运动类型" rules={[{ required: true, message: "请输入运动类型" }]}>
                <Input placeholder="快走、跑步、游泳、力量训练..." />
              </Form.Item>
              <Form.Item name="durationMinutes" label="时长（分钟）" rules={[{ required: true, message: "请输入运动时长" }]}>
                <InputNumber min={1} max={1440} className="health-full-width" />
              </Form.Item>
              <Form.Item name="intensity" label="强度" rules={[{ required: true }]}>
                <Select options={[
                  { label: "低强度", value: "low" },
                  { label: "中等强度", value: "moderate" },
                  { label: "高强度", value: "high" }
                ]} />
              </Form.Item>
              <Form.Item name="isStrengthTraining" valuePropName="checked">
                <Checkbox>计为力量训练</Checkbox>
              </Form.Item>
              <Row gutter={10}>
                <Col span={12}><Form.Item name="steps" label="步数"><InputNumber min={0} className="health-full-width" /></Form.Item></Col>
                <Col span={12}><Form.Item name="estimatedCalories" label="估算热量"><InputNumber min={0} className="health-full-width" /></Form.Item></Col>
              </Row>
              <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
              <Button type="primary" htmlType="submit">保存运动</Button>
            </>
          ) : null}

          {featureEnabled && kind === "glucose" ? (
            <>
              <Alert type="info" showIcon title="血糖目标范围以医生建议为准" className="calendar-quick-alert" />
              <Form.Item name="measuredAt" label="测量时间" rules={[{ required: true }]}>
                <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
              </Form.Item>
              <Form.Item name="glucoseMmol" label="血糖 (mmol/L)" rules={[{ required: true, message: "请输入血糖值" }]}>
                <InputNumber min={0.5} max={60} step={0.1} className="health-full-width" />
              </Form.Item>
              <Form.Item name="glucoseContext" label="测量场景" rules={[{ required: true, message: "请选择测量场景" }]}>
                <Select options={Object.entries(glucoseContextLabels).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item name="medicationTaken" label="是否按既定方案用药">
                <Select allowClear options={[
                  { label: "是", value: true },
                  { label: "否", value: false }
                ]} />
              </Form.Item>
              <Form.Item name="symptoms" label="症状"><Input placeholder="无症状可留空" /></Form.Item>
              <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
              <Button type="primary" htmlType="submit">保存血糖</Button>
            </>
          ) : null}
        </Form>

        {featureEnabled && kind === "medication" ? (
          <Space orientation="vertical" size={12} className="calendar-medication-recorder">
            <Alert
              type="info"
              showIcon
              title="仅记录医生既定方案的执行情况"
              description="这里不提供剂量调整或漏服后的补服建议。"
            />
            {medicationTasks.length ? (
              <List
                dataSource={medicationTasks}
                renderItem={(task) => (
                  <List.Item>
                    <Space orientation="vertical" size={8} className="calendar-medication-task">
                      <Flex justify="space-between" align="center" gap={8} wrap>
                        <Text strong>{task.plan.name} · {task.slot.label}</Text>
                        {task.record ? <Tag>{medicationDoseStatusLabels[task.record.status]}</Tag> : <Tag>待记录</Tag>}
                      </Flex>
                      <Flex gap={6} wrap>
                        {(["taken", "missed", "paused"] as MedicationDoseStatus[]).map((status) => (
                          <Button
                            key={status}
                            size="small"
                            type={task.record?.status === status ? "primary" : "default"}
                            loading={savingDoseKey === `${task.key}-${status}`}
                            onClick={() => void saveDose(
                              task.plan.id,
                              task.slot.id,
                              `${task.key}-${status}`,
                              status
                            )}
                          >
                            {medicationDoseStatusLabels[status]}
                          </Button>
                        ))}
                      </Flex>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当天没有生效中的用药计划" />}
          </Space>
        ) : null}
      </Spin>
    </Drawer>
  );
}

function DetailSection({
  title,
  icon,
  action,
  children
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="calendar-detail-section">
      <Flex justify="space-between" align="center" gap={8}>
        <Space size={8}>{icon}<Title level={5}>{title}</Title></Space>
        {action}
      </Flex>
      <div className="calendar-detail-content">{children}</div>
    </section>
  );
}

function MetricLink({
  icon,
  label,
  warning,
  onClick
}: {
  icon: ReactNode;
  label: string;
  warning?: boolean;
  onClick(): void;
}) {
  return (
    <button type="button" className={warning ? "calendar-signal has-warning" : "calendar-signal"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function buildMonthCells(monthKey: string): dayjs.Dayjs[] {
  const first = dayjs(`${monthKey}-01`);
  const leading = (first.day() + 6) % 7;
  const cellCount = Math.ceil((leading + first.daysInMonth()) / 7) * 7;
  const start = first.subtract(leading, "day");
  return Array.from({ length: cellCount }, (_, index) => start.add(index, "day"));
}

function readVisibleCalendarContent(): CalendarDayEntryType[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CALENDAR_CONTENT_STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return ALL_CALENDAR_CONTENT;
    return ALL_CALENDAR_CONTENT.filter((type) => stored.includes(type));
  } catch {
    return ALL_CALENDAR_CONTENT;
  }
}

function dayHasContent(day: CalendarDaySummary): boolean {
  return day.incomeCount > 0
    || day.expenseCount > 0
    || day.glucoseMeasurements > 0
    || day.exerciseMinutes > 0
    || day.medication.scheduled > 0
    || day.followupCount > 0;
}

function compactMoney(value: string): string {
  const amount = Number(value);
  const absolute = Math.abs(amount);
  if (absolute >= 10000) {
    return `${amount < 0 ? "-" : ""}¥${(absolute / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  }
  return `${amount < 0 ? "-" : ""}¥${Math.round(absolute).toLocaleString("zh-CN")}`;
}

function calendarEntryText(entry: CalendarDayEntry): string {
  if (entry.type === "income") return `收入 ${compactMoney(entry.amount ?? "0")}`;
  if (entry.type === "expense") return `支出 ${compactMoney(entry.amount ?? "0")}`;
  if (entry.type === "glucose") {
    const context = entry.context ? glucoseContextLabels[entry.context] : "血糖";
    return `${context} ${entry.value ?? "--"}`;
  }
  if (entry.type === "exercise") return `${entry.label ?? "运动"} ${entry.minutes ?? 0}分钟`;
  if (entry.type === "followup") return entry.label ?? "复诊";

  const medication = entry.medication;
  if (!medication) return "用药";
  if (medication.missed > 0) return `用药 漏服${medication.missed}次`;
  if (medication.scheduled > 0) return `用药 ${medication.taken}/${medication.scheduled}`;
  return "用药";
}

function formatChangeRate(value?: number): string {
  if (value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function medicationLabel(month: CalendarMonthSummary): string {
  if (!month.medication.scheduled) return "无用药计划";
  if (month.medication.completionRate === undefined) return `用药计划 ${month.medication.scheduled}次`;
  return `用药完成 ${month.medication.completionRate}%${month.medication.missed ? ` · 漏服${month.medication.missed}次` : ""}`;
}
