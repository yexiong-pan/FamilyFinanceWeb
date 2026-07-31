import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SettingOutlined
} from "@ant-design/icons";
import type {
  BloodGlucoseRecord,
  BodyMeasurement,
  ExerciseLog,
  FamilyMemberInfo,
  Hba1cRecord,
  HealthData,
  HealthFollowup,
  MedicationPlan,
  MemberHealthProfile,
  StrengthExerciseGoal
} from "@family-finance/shared";
import {
  Alert,
  App,
  AutoComplete,
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
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tabs,
  Tag,
  TimePicker,
  Typography
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  type BloodGlucoseInput,
  type BodyMeasurementInput,
  type ExerciseLogInput,
  type Hba1cInput,
  type HealthFollowupInput,
  type MedicationInventoryInput,
  type MedicationPlanInput,
  createHealthFollowup,
  createMedicationPlan,
  createBloodGlucose,
  createBodyMeasurement,
  createExerciseLog,
  createHba1c,
  deleteBloodGlucose,
  deleteBodyMeasurement,
  deleteExerciseLog,
  deleteHba1c,
  deleteHealthFollowup,
  getHealthData,
  healthExportUrl,
  saveWeeklyHealthReview,
  saveMedicationDose,
  updateBloodGlucose,
  updateBodyMeasurement,
  updateExerciseLog,
  updateHba1c,
  updateHealthProfile,
  updateHealthFollowup,
  updateMedicationInventory,
  updateMedicationPlan
} from "./api/client";
import {
  bodyMeasurementContextLabels,
  buildBodySummary,
  buildExerciseSummary,
  buildStrengthTrend,
  buildGlucoseSummary,
  buildMedicationTasks,
  exerciseIntensityLabels,
  followupStatusLabels,
  glucoseContextLabels,
  glucoseStatus,
  isMedicationLowStock,
  medicationDaysRemaining,
  medicationDoseStatusLabels,
  nextScheduledFollowup,
  strengthSessionText,
  toMinuteIso
} from "./data/health";
import { Column, Line } from "./LazyCharts";
import type { HealthTabKey } from "./navigation";

const { Text, Title } = Typography;
const MEMBER_STORAGE_KEY = "family-finance.health-member";
const DEFAULT_STRENGTH_MOVEMENTS = [
  "俯卧撑",
  "引体向上",
  "深蹲",
  "平板支撑",
  "卷腹",
  "弓步蹲",
  "双杠臂屈伸"
];
const MINUTE_DATE_TIME_PICKER_PROPS = {
  format: "YYYY-MM-DD HH:mm",
  inputReadOnly: true,
  showTime: {
    format: "HH:mm",
    showSecond: false
  }
} as const;

interface HealthPageProps {
  monthKey: string;
  members: FamilyMemberInfo[];
  tab: HealthTabKey;
  onTabChange: (tab: HealthTabKey) => void;
}

type Editor =
  | "body"
  | "exercise"
  | "glucose"
  | "hba1c"
  | "medication"
  | "inventory"
  | "followup"
  | "settings"
  | null;

export function HealthPage({ monthKey, members, tab, onTabChange }: HealthPageProps) {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [memberId, setMemberId] = useState(() => {
    const saved = window.localStorage.getItem(MEMBER_STORAGE_KEY);
    return saved && members.some((member) => member.id === saved) ? saved : members[0]?.id ?? "";
  });
  const [data, setData] = useState<HealthData>();
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [editingRecord, setEditingRecord] = useState<
    BodyMeasurement | ExerciseLog | BloodGlucoseRecord | Hba1cRecord | MedicationPlan | HealthFollowup
  >();

  useEffect(() => {
    if (members.some((member) => member.id === memberId)) return;
    setMemberId(members[0]?.id ?? "");
  }, [memberId, members]);

  const reload = useCallback(async () => {
    if (!memberId) {
      setData(undefined);
      return;
    }
    setLoading(true);
    try {
      setData(await getHealthData(memberId, monthKey));
    } catch (caught) {
      message.error(errorMessage(caught, "健康数据加载失败"));
    } finally {
      setLoading(false);
    }
  }, [memberId, message, monthKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (tab === "glucose" && data && !hasGlucoseFeature(data.profile)) {
      onTabChange("overview");
    }
    if (tab === "medication" && data && !data.profile.medicationTrackingEnabled) {
      onTabChange("overview");
    }
  }, [data, onTabChange, tab]);

  const selectMember = (nextMemberId: string) => {
    setMemberId(nextMemberId);
    window.localStorage.setItem(MEMBER_STORAGE_KEY, nextMemberId);
  };

  const openEditor = (
    nextEditor: Exclude<Editor, null>,
    record?: BodyMeasurement | ExerciseLog | BloodGlucoseRecord | Hba1cRecord | MedicationPlan | HealthFollowup
  ) => {
    setEditingRecord(record);
    setEditor(nextEditor);
  };

  const runMutation = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      message.success(success);
      setEditor(null);
      setEditingRecord(undefined);
      await reload();
    } catch (caught) {
      message.error(errorMessage(caught, "保存失败，请重试"));
    }
  };

  if (!members.length) {
    return <Empty description="请先在设置中添加家庭成员" />;
  }

  const profile = data?.profile;
  const tabItems = [
    { key: "overview", label: "健康概览" },
    ...(profile && hasGlucoseFeature(profile) ? [{
      key: "glucose",
      label: profile.glucoseTrackingEnabled ? "血糖" : "HbA1c"
    }] : []),
    ...(profile?.medicationTrackingEnabled ? [{ key: "medication", label: "用药与复诊" }] : []),
    { key: "body", label: "身体与运动" }
  ];

  return (
    <Space orientation="vertical" size={16} className="page-stack health-page">
      <Flex justify="space-between" align="center" wrap="wrap" gap={10}>
        <Space wrap>
          <Select
            aria-label="健康数据所属成员"
            value={memberId}
            onChange={selectMember}
            options={members.map((member) => ({ label: member.name, value: member.id }))}
            className="health-member-select"
          />
          <Text type="secondary">当前显示该成员的健康记录</Text>
        </Space>
        <Space wrap size={8}>
          {profile?.weightTrackingEnabled ? (
            <Button icon={<PlusOutlined />} onClick={() => openEditor("body")}>体重</Button>
          ) : null}
          {profile?.exerciseTrackingEnabled ? (
            <Button icon={<PlusOutlined />} onClick={() => openEditor("exercise")}>运动</Button>
          ) : null}
          {profile?.glucoseTrackingEnabled ? (
            <Button type="primary" icon={<ExperimentOutlined />} onClick={() => openEditor("glucose")}>血糖</Button>
          ) : null}
          <Button icon={<SettingOutlined />} onClick={() => openEditor("settings")}>健康设置</Button>
        </Space>
      </Flex>

      <Tabs
        activeKey={tab}
        onChange={(key) => onTabChange(key as HealthTabKey)}
        items={tabItems}
      />

      <Spin spinning={loading}>
        {data && tab === "overview" ? (
          <HealthOverview
            data={data}
            monthKey={monthKey}
            onOpen={openEditor}
            onReload={reload}
          />
        ) : null}
        {data && tab === "glucose" ? (
          <GlucosePanel
            data={data}
            memberId={memberId}
            onOpen={openEditor}
            onDelete={(kind, id) => void runMutation(
              () => kind === "glucose" ? deleteBloodGlucose(id) : deleteHba1c(id),
              "记录已删除"
            )}
          />
        ) : null}
        {data && tab === "body" ? (
          <BodyExercisePanel
            data={data}
            monthKey={monthKey}
            mobile={!screens.md}
            onOpen={openEditor}
            onDelete={(kind, id) => void runMutation(
              () => kind === "body" ? deleteBodyMeasurement(id) : deleteExerciseLog(id),
              "记录已删除"
            )}
          />
        ) : null}
        {data && tab === "medication" ? (
          <MedicationPanel
            data={data}
            monthKey={monthKey}
            onOpen={openEditor}
            onMutate={runMutation}
          />
        ) : null}
      </Spin>

      {data ? (
        <>
          <HealthSettingsDrawer
            open={editor === "settings"}
            profile={data.profile}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => updateHealthProfile(memberId, values),
              "健康设置已保存"
            )}
          />
          <BodyEditor
            open={editor === "body"}
            record={editingRecord && "weightKg" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "weightKg" in editingRecord
                ? updateBodyMeasurement(editingRecord.id, values)
                : createBodyMeasurement(memberId, values),
              "身体记录已保存"
            )}
          />
          <ExerciseEditor
            open={editor === "exercise"}
            record={editingRecord && "durationMinutes" in editingRecord ? editingRecord : undefined}
            profile={data.profile}
            recentLogs={data.exerciseLogs}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "durationMinutes" in editingRecord
                ? updateExerciseLog(editingRecord.id, values)
                : createExerciseLog(memberId, values),
              "运动记录已保存"
            )}
          />
          <GlucoseEditor
            open={editor === "glucose"}
            record={editingRecord && "glucoseMmol" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "glucoseMmol" in editingRecord
                ? updateBloodGlucose(editingRecord.id, values)
                : createBloodGlucose(memberId, values),
              "血糖记录已保存"
            )}
          />
          <Hba1cEditor
            open={editor === "hba1c"}
            record={editingRecord && "valuePercent" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "valuePercent" in editingRecord
                ? updateHba1c(editingRecord.id, values)
                : createHba1c(memberId, values),
              "HbA1c记录已保存"
            )}
          />
          <MedicationEditor
            open={editor === "medication"}
            record={editingRecord && "scheduleSlots" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "scheduleSlots" in editingRecord
                ? updateMedicationPlan(editingRecord.id, values)
                : createMedicationPlan(memberId, values),
              "用药计划已保存"
            )}
          />
          <InventoryEditor
            open={editor === "inventory"}
            plan={editingRecord && "scheduleSlots" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(id, values) => void runMutation(
              () => updateMedicationInventory(id, values),
              "药量库存已更新"
            )}
          />
          <FollowupEditor
            open={editor === "followup"}
            record={editingRecord && "scheduledAt" in editingRecord && "tests" in editingRecord ? editingRecord : undefined}
            onClose={() => setEditor(null)}
            onSave={(values) => void runMutation(
              () => editingRecord && "scheduledAt" in editingRecord && "tests" in editingRecord
                ? updateHealthFollowup(editingRecord.id, values)
                : createHealthFollowup(memberId, values),
              "复诊安排已保存"
            )}
          />
        </>
      ) : null}
    </Space>
  );
}

function HealthOverview({
  data,
  monthKey,
  onOpen,
  onReload
}: {
  data: HealthData;
  monthKey: string;
  onOpen: (editor: Exclude<Editor, null>) => void;
  onReload: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const body = buildBodySummary(data.bodyMeasurements, data.profile);
  const exercise = buildExerciseSummary(
    data.exerciseLogs,
    data.profile,
    monthKey === dayjs().format("YYYY-MM") ? dayjs().format("YYYY-MM-DD") : dayjs(`${monthKey}-01`).endOf("month").format("YYYY-MM-DD")
  );
  const glucose = buildGlucoseSummary(data.glucoseRecords, data.profile);
  const latestHba1c = data.hba1cRecords.at(-1);
  const referenceDate = healthReferenceDate(monthKey);
  const medicationTasks = buildMedicationTasks(
    data.medicationPlans,
    data.medicationDoseRecords,
    referenceDate
  );
  const takenMedicationCount = medicationTasks.filter((task) => task.record?.status === "taken").length;
  const lowStockCount = data.medicationPlans.filter((plan) => (
    plan.status === "active" && isMedicationLowStock(plan)
  )).length;
  const nextFollowup = nextScheduledFollowup(data.followups, referenceDate);
  const [form] = Form.useForm<ReviewFormValues>();

  useEffect(() => {
    form.setFieldsValue({
      good: data.weeklyReview?.good,
      obstacle: data.weeklyReview?.obstacle,
      nextAction: data.weeklyReview?.nextAction
    });
  }, [data.weeklyReview, form]);

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      {data.profile.glucoseTrackingEnabled && glucose.latest && glucose.status === "low" ? (
        <Alert
          type="error"
          showIcon
          title={`最近血糖 ${glucose.latest.glucoseMmol} mmol/L，低于个人警戒值`}
          description="如出现低血糖症状或情况持续，请按医生既定方案处理并及时寻求医疗帮助。"
        />
      ) : null}
      {data.profile.glucoseTrackingEnabled && glucose.repeatedOutOfRange ? (
        <Alert
          type="warning"
          showIcon
          title="最近两次同场景血糖均不在个人目标范围"
          description="建议复核测量条件，并在复诊时向医生展示记录。"
        />
      ) : null}
      <Row gutter={[12, 12]}>
        {data.profile.weightTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic title="当前体重" value={body.latest ? Number(body.latest.weightKg) : "—"} suffix={body.latest ? "kg" : ""} />
              <Text type="secondary">{body.change30Days === undefined ? "30天趋势待积累" : `30天 ${signed(body.change30Days)} kg`}</Text>
            </Card>
          </Col>
        ) : null}
        {data.profile.exerciseTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic title="本周运动" value={exercise.minutes} suffix="分钟" />
              <Progress percent={exercise.minutesPercent} showInfo={false} />
            </Card>
          </Col>
        ) : null}
        {data.profile.glucoseTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic title="最近血糖" value={glucose.latest ? Number(glucose.latest.glucoseMmol) : "—"} suffix={glucose.latest ? "mmol/L" : ""} />
              <Text type="secondary">
                {glucose.latest ? `${glucoseContextLabels[glucose.latest.context]} · ${dayjs(glucose.latest.measuredAt).format("M月D日")}` : "尚未记录"}
              </Text>
            </Card>
          </Col>
        ) : null}
        {data.profile.hba1cTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic title="最近 HbA1c" value={latestHba1c ? Number(latestHba1c.valuePercent) : "—"} suffix={latestHba1c ? "%" : ""} />
              <Text type="secondary">{latestHba1c?.nextReviewDate ? `下次复查 ${latestHba1c.nextReviewDate}` : "按医嘱安排复查"}</Text>
            </Card>
          </Col>
        ) : null}
        {data.profile.medicationTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic title="今日用药" value={`${takenMedicationCount}/${medicationTasks.length}`} />
              <Text type={lowStockCount ? "danger" : "secondary"}>
                {lowStockCount ? `${lowStockCount} 种药量需要补充` : "药量暂无预警"}
              </Text>
            </Card>
          </Col>
        ) : null}
        {data.profile.medicationTrackingEnabled ? (
          <Col xs={12} lg={6}>
            <Card className="health-metric-card metric-card">
              <Statistic
                title="下次复诊"
                value={nextFollowup ? dayjs(nextFollowup.scheduledAt).format("M月D日") : "—"}
              />
              <Text type="secondary">{nextFollowup ? nextFollowup.type : "尚未安排"}</Text>
            </Card>
          </Col>
        ) : null}
      </Row>

      {!data.profile.weightTrackingEnabled
        && !data.profile.exerciseTrackingEnabled
        && !hasGlucoseFeature(data.profile)
        && !data.profile.medicationTrackingEnabled ? (
          <Empty description="该成员尚未启用健康记录项目" />
        ) : null}

      <Card title="本周复盘" extra={<Text type="secondary">只保留结论和下一步</Text>}>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values: ReviewFormValues) => {
            try {
              await saveWeeklyHealthReview(data.profile.memberId, {
                weekStart: startOfCurrentWeek(monthKey),
                ...values
              });
              message.success("本周复盘已保存");
              await onReload();
            } catch (caught) {
              message.error(errorMessage(caught, "复盘保存失败"));
            }
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={8}><Form.Item name="good" label="做得好的"><Input placeholder="例如：完成两次力量训练" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="obstacle" label="主要阻碍"><Input placeholder="例如：晚饭后久坐" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nextAction" label="下周一个行动"><Input placeholder="例如：周三晚快走30分钟" /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit">保存复盘</Button>
        </Form>
      </Card>
    </Space>
  );
}

function GlucosePanel({
  data,
  memberId,
  onOpen,
  onDelete
}: {
  data: HealthData;
  memberId: string;
  onOpen: (editor: Exclude<Editor, null>, record?: BloodGlucoseRecord | Hba1cRecord) => void;
  onDelete: (kind: "glucose" | "hba1c", id: string) => void;
}) {
  const summary = buildGlucoseSummary(data.glucoseRecords, data.profile);
  const latestHba1c = data.hba1cRecords.at(-1);
  const exportTo = dayjs().format("YYYY-MM-DD");
  const exportFrom = dayjs().subtract(29, "day").format("YYYY-MM-DD");

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <Alert
        type="info"
        showIcon
        title="血糖目标范围以本人医生建议为准"
        description="本页用于记录和复盘，不用于诊断，也不建议据此自行调整药物或胰岛素剂量。"
      />
      {data.profile.glucoseTrackingEnabled ? <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card className="health-metric-card metric-card">
            <Statistic title="最近一次" value={summary.latest ? Number(summary.latest.glucoseMmol) : "—"} suffix={summary.latest ? "mmol/L" : ""} />
            <Text type="secondary">
              {summary.latest ? `${glucoseContextLabels[summary.latest.context]} · ${dayjs(summary.latest.measuredAt).format("YYYY-MM-DD HH:mm")}` : "尚未记录"}
            </Text>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card className="health-metric-card metric-card">
            <Statistic title="同场景较上次" value={summary.difference === undefined ? "—" : signed(summary.difference)} />
            <Text type="secondary">只比较相同测量场景</Text>
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card className="health-metric-card metric-card">
            <Statistic title="建议下次测量" value={summary.dueDate ?? "—"} />
            <Text type="secondary">当前间隔 {data.profile.glucoseIntervalDays} 天</Text>
          </Card>
        </Col>
      </Row> : null}

      {data.profile.glucoseTrackingEnabled ? <Card
        title="最近血糖趋势"
        extra={
          <Space wrap>
            <Button icon={<DownloadOutlined />} href={healthExportUrl(memberId, exportFrom, exportTo)}>导出近30天</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen("glucose")}>记录血糖</Button>
          </Space>
        }
      >
        {data.glucoseRecords.length ? (
          <Line
            data={data.glucoseRecords.slice(-12).map((record) => ({
              date: dayjs(record.measuredAt).format("MM-DD"),
              value: Number(record.glucoseMmol),
              context: glucoseContextLabels[record.context]
            }))}
            xField="date"
            yField="value"
            colorField="context"
            height={280}
            point={{ size: 5 }}
            legend={{ color: { position: "top" } }}
            axis={{ y: { title: "mmol/L" } }}
          />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="记录后显示趋势" />}
      </Card> : null}

      {data.profile.glucoseTrackingEnabled ? <Card title="血糖记录">
        <HealthRecordList
          empty="暂无血糖记录"
          items={[...data.glucoseRecords].reverse().map((record) => ({
            id: record.id,
            title: `${record.glucoseMmol} mmol/L`,
            tags: [
              <Tag key="context" color="blue">{glucoseContextLabels[record.context]}</Tag>,
              <StatusTag key="status" status={glucoseStatus(record, data.profile)} />
            ],
            description: `${dayjs(record.measuredAt).format("YYYY-MM-DD HH:mm")}${record.note ? ` · ${record.note}` : ""}`,
            onEdit: () => onOpen("glucose", record),
            onDelete: () => onDelete("glucose", record.id)
          }))}
        />
      </Card> : null}

      {data.profile.hba1cTrackingEnabled ? (
        <Card
          title="HbA1c"
          extra={<Button icon={<PlusOutlined />} onClick={() => onOpen("hba1c")}>记录检查</Button>}
        >
          {latestHba1c ? (
            <Flex justify="space-between" align="center" wrap="wrap" gap={12} className="health-hba1c-summary">
              <Statistic title="最近结果" value={Number(latestHba1c.valuePercent)} suffix="%" />
              <Text>{latestHba1c.nextReviewDate ? `下次复查：${latestHba1c.nextReviewDate}` : "下次复查：按医嘱"}</Text>
            </Flex>
          ) : null}
          <HealthRecordList
            empty="暂无 HbA1c 记录"
            items={[...data.hba1cRecords].reverse().map((record) => ({
              id: record.id,
              title: `${record.valuePercent}%`,
              tags: record.facility ? [<Tag key="facility">{record.facility}</Tag>] : [],
              description: `${dayjs(record.measuredAt).format("YYYY-MM-DD")}${record.doctorAdvice ? ` · ${record.doctorAdvice}` : ""}`,
              onEdit: () => onOpen("hba1c", record),
              onDelete: () => onDelete("hba1c", record.id)
            }))}
          />
        </Card>
      ) : null}
    </Space>
  );
}

function BodyExercisePanel({
  data,
  monthKey,
  mobile,
  onOpen,
  onDelete
}: {
  data: HealthData;
  monthKey: string;
  mobile: boolean;
  onOpen: (editor: Exclude<Editor, null>, record?: BodyMeasurement | ExerciseLog) => void;
  onDelete: (kind: "body" | "exercise", id: string) => void;
}) {
  const body = buildBodySummary(data.bodyMeasurements, data.profile);
  const exercise = buildExerciseSummary(
    data.exerciseLogs,
    data.profile,
    monthKey === dayjs().format("YYYY-MM") ? dayjs().format("YYYY-MM-DD") : dayjs(`${monthKey}-01`).endOf("month").format("YYYY-MM-DD")
  );
  const strengthTrend = buildStrengthTrend(data.exerciseLogs);
  const repTrend = strengthTrend.filter((item) => item.metric === "reps");
  const secondsTrend = strengthTrend.filter((item) => item.metric === "seconds");

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      {data.profile.weightTrackingEnabled ? (
        <Card
          title="身体趋势"
          extra={<Button icon={<PlusOutlined />} onClick={() => onOpen("body")}>记录身体数据</Button>}
        >
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><Statistic title="当前体重" value={body.latest ? Number(body.latest.weightKg) : "—"} suffix={body.latest ? "kg" : ""} /></Col>
            <Col xs={12} md={6}><Statistic title="7日均重" value={body.average7Days?.toFixed(1) ?? "—"} suffix={body.average7Days ? "kg" : ""} /></Col>
            <Col xs={12} md={6}><Statistic title="7日变化" value={body.change7Days === undefined ? "—" : signed(body.change7Days)} suffix={body.change7Days === undefined ? "" : "kg"} /></Col>
            <Col xs={12} md={6}><Statistic title="距目标" value={body.targetRemaining === undefined ? "—" : body.targetRemaining.toFixed(1)} suffix={body.targetRemaining === undefined ? "" : "kg"} /></Col>
          </Row>
          {data.bodyMeasurements.length ? (
            <Line
              data={data.bodyMeasurements.slice(-30).map((record) => ({
                date: dayjs(record.measuredAt).format("MM-DD"),
                value: Number(record.weightKg)
              }))}
              xField="date"
              yField="value"
              height={mobile ? 230 : 280}
              point={{ size: 4 }}
              axis={{ y: { title: "kg" } }}
            />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="记录后显示体重趋势" />}
          <HealthRecordList
            empty="暂无身体记录"
            items={[...data.bodyMeasurements].reverse().slice(0, 12).map((record) => ({
              id: record.id,
              title: `${record.weightKg} kg`,
              tags: [
                <Tag key="context" color={record.context === "morningFasting" ? "green" : "default"}>
                  {bodyMeasurementContextLabels[record.context]}
                </Tag>,
                ...(record.waistCm
                  ? [<Tag key="waist" color="purple">腰围 {record.waistCm} cm</Tag>]
                  : [])
              ],
              description: `${dayjs(record.measuredAt).format("YYYY-MM-DD HH:mm")}${record.note ? ` · ${record.note}` : ""}`,
              onEdit: () => onOpen("body", record),
              onDelete: () => onDelete("body", record.id)
            }))}
          />
        </Card>
      ) : null}

      {data.profile.exerciseTrackingEnabled ? (
        <Card
          title="本周运动"
          extra={<Button icon={<PlusOutlined />} onClick={() => onOpen("exercise")}>记录运动</Button>}
        >
          <Row gutter={[12, 12]} className="health-goal-row">
            <Col xs={24} md={8}>
              <Text strong>运动时长 {exercise.minutes} / {data.profile.weeklyExerciseMinutesGoal} 分钟</Text>
              <Progress percent={exercise.minutesPercent} />
            </Col>
            <Col xs={24} md={8}>
              <Text strong>力量训练 {exercise.strengthSessions} / {data.profile.weeklyStrengthSessionsGoal} 次</Text>
              <Progress percent={exercise.strengthPercent} strokeColor="#722ed1" />
            </Col>
            <Col xs={24} md={8}>
              <Statistic title="有记录日平均步数" value={exercise.averageSteps ?? "—"} suffix={exercise.averageSteps ? "步" : ""} />
            </Col>
          </Row>
          {exercise.strengthMovements.length ? (
            <div className="strength-summary-list">
              {exercise.strengthMovements.map((movement) => {
                const unit = movement.metric === "seconds" ? "秒" : "次";
                const weeklyGoal = movement.goal?.weeklyGoal;
                return (
                  <div className="strength-summary-item" key={`${movement.name}-${movement.metric}`}>
                    <Flex justify="space-between" align="center" gap={8} wrap>
                      <Text strong>{movement.name}</Text>
                      <Text type="secondary">
                        本周 {movement.total}{unit} · 最大单组 {movement.maxSet}{unit} · {movement.sessions}次训练
                      </Text>
                    </Flex>
                    {weeklyGoal ? (
                      <Progress
                        percent={goalPercent(movement.total, weeklyGoal)}
                        format={() => `${movement.total}/${weeklyGoal}${unit}`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {data.exerciseLogs.length ? (
            <Column
              data={data.exerciseLogs.map((record) => ({
                date: dayjs(record.date).format("MM-DD"),
                minutes: record.durationMinutes,
                type: record.type
              }))}
              xField="date"
              yField="minutes"
              colorField="type"
              height={mobile ? 230 : 280}
              axis={{ y: { title: "分钟" } }}
            />
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="记录后显示运动时长" />}
          {repTrend.length ? (
            <div className="strength-trend">
              <Text strong>力量动作趋势（次数）</Text>
              <Line
                data={repTrend}
                xField="date"
                yField="total"
                colorField="name"
                height={mobile ? 220 : 260}
                point={{ size: 4 }}
                axis={{ y: { title: "次" } }}
              />
            </div>
          ) : null}
          {secondsTrend.length ? (
            <div className="strength-trend">
              <Text strong>计时动作趋势（秒）</Text>
              <Line
                data={secondsTrend}
                xField="date"
                yField="total"
                colorField="name"
                height={mobile ? 220 : 260}
                point={{ size: 4 }}
                axis={{ y: { title: "秒" } }}
              />
            </div>
          ) : null}
          <HealthRecordList
            empty="暂无运动记录"
            items={[...data.exerciseLogs].reverse().map((record) => ({
              id: record.id,
              title: `${record.type} · ${record.durationMinutes} 分钟`,
              tags: [
                <Tag key="intensity" color="cyan">{exerciseIntensityLabels[record.intensity]}</Tag>,
                ...(record.isStrengthTraining ? [<Tag key="strength" color="purple">力量训练</Tag>] : []),
                ...(record.estimatedCalories === undefined ? [] : [<Tag key="calories">估算 {record.estimatedCalories} kcal</Tag>])
              ],
              description: [
                dayjs(record.date).format("YYYY-MM-DD"),
                record.movements.length ? strengthSessionText(record) : undefined,
                record.steps === undefined ? undefined : `${record.steps} 步`,
                record.note
              ].filter(Boolean).join(" · "),
              onEdit: () => onOpen("exercise", record),
              onDelete: () => onDelete("exercise", record.id)
            }))}
          />
        </Card>
      ) : null}
    </Space>
  );
}

function MedicationPanel({
  data,
  monthKey,
  onOpen,
  onMutate
}: {
  data: HealthData;
  monthKey: string;
  onOpen: (
    editor: Exclude<Editor, null>,
    record?: MedicationPlan | HealthFollowup
  ) => void;
  onMutate: (operation: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [selectedDate, setSelectedDate] = useState(() => healthReferenceDate(monthKey));
  useEffect(() => {
    setSelectedDate(healthReferenceDate(monthKey));
  }, [monthKey]);
  const tasks = buildMedicationTasks(data.medicationPlans, data.medicationDoseRecords, selectedDate);
  const confirmed = tasks.filter((task) => task.record?.status !== undefined).length;
  const taken = tasks.filter((task) => task.record?.status === "taken").length;
  const activePlans = data.medicationPlans.filter((plan) => plan.status === "active");
  const lowStockPlans = activePlans.filter(isMedicationLowStock);
  const nextFollowup = nextScheduledFollowup(data.followups, selectedDate);

  return (
    <Space orientation="vertical" size={16} className="page-stack medication-page">
      <Alert
        type="info"
        showIcon
        title="本页记录医生已经确定的用药方案"
        description="漏服后是否补服、暂停或调整剂量，应按药品说明或咨询医生、药师，系统不会自动给出建议。"
      />
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card className="health-metric-card metric-card">
            <Statistic title="当日已服" value={`${taken}/${tasks.length}`} />
            <Text type="secondary">已确认 {confirmed} 次</Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="health-metric-card metric-card">
            <Statistic title="使用中药品" value={activePlans.length} suffix="种" />
            <Text type={lowStockPlans.length ? "danger" : "secondary"}>
              {lowStockPlans.length ? `${lowStockPlans.length} 种库存预警` : "库存暂无预警"}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="health-metric-card metric-card">
            <Statistic
              title="下次复诊"
              value={nextFollowup ? dayjs(nextFollowup.scheduledAt).format("YYYY-MM-DD HH:mm") : "—"}
            />
            <Text type="secondary">
              {nextFollowup
                ? [nextFollowup.hospital, nextFollowup.department, nextFollowup.type].filter(Boolean).join(" · ")
                : "尚未安排"}
            </Text>
          </Card>
        </Col>
      </Row>

      <Card
        title="每日用药"
        extra={
          <DatePicker
            inputReadOnly
            value={dayjs(selectedDate)}
            onChange={(value) => setSelectedDate((value ?? dayjs()).format("YYYY-MM-DD"))}
            disabledDate={(value) => value.format("YYYY-MM") !== monthKey}
            allowClear={false}
          />
        }
      >
        {tasks.length ? (
          <List
            className="medication-task-list"
            dataSource={tasks}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button
                    key="taken"
                    type={task.record?.status === "taken" ? "primary" : "default"}
                    onClick={() => void onMutate(
                      () => saveMedicationDose(task.plan.id, {
                        scheduledDate: selectedDate,
                        slotId: task.slot.id,
                        status: "taken",
                        takenAt: toMinuteIso(dayjs())
                      }),
                      "已记录用药"
                    )}
                  >
                    已服
                  </Button>,
                  <Button
                    key="missed"
                    danger={task.record?.status === "missed"}
                    onClick={() => void onMutate(
                      () => saveMedicationDose(task.plan.id, {
                        scheduledDate: selectedDate,
                        slotId: task.slot.id,
                        status: "missed"
                      }),
                      "已记录漏服"
                    )}
                  >
                    漏服
                  </Button>,
                  <Button
                    key="paused"
                    type={task.record?.status === "paused" ? "primary" : "default"}
                    onClick={() => void onMutate(
                      () => saveMedicationDose(task.plan.id, {
                        scheduledDate: selectedDate,
                        slotId: task.slot.id,
                        status: "paused"
                      }),
                      "已记录医嘱暂停"
                    )}
                  >
                    医嘱暂停
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<MedicineBoxOutlined className="medication-task-icon" />}
                  title={
                    <Space wrap>
                      <Text strong>{task.plan.name}</Text>
                      {task.plan.specification ? <Tag>{task.plan.specification}</Tag> : null}
                      <Tag color="blue">{task.slot.time ? `${task.slot.time} ` : ""}{task.slot.label}</Tag>
                    </Space>
                  }
                  description={`每次 ${trimDecimal(task.plan.doseQuantity)} ${task.plan.stockUnit}${task.record ? ` · ${medicationDoseStatusLabels[task.record.status]}` : " · 待确认"}`}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当日没有生效的用药计划" />
        )}
      </Card>

      <Card
        title="用药计划与库存"
        extra={
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              href={healthExportUrl(
                data.profile.memberId,
                dayjs(selectedDate).subtract(29, "day").format("YYYY-MM-DD"),
                selectedDate
              )}
            >
              导出近30天
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpen("medication")}>新增用药</Button>
          </Space>
        }
      >
        {data.medicationPlans.length ? (
          <List
            className="medication-plan-list"
            dataSource={data.medicationPlans}
            renderItem={(plan) => {
              const days = medicationDaysRemaining(plan);
              const lowStock = plan.status === "active" && isMedicationLowStock(plan);
              return (
                <List.Item
                  actions={[
                    <Button key="inventory" type="link" onClick={() => onOpen("inventory", plan)}>补药/盘点</Button>,
                    <Button key="edit" type="link" onClick={() => onOpen("medication", plan)}>编辑</Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Text strong>{plan.name}</Text>
                        {plan.specification ? <Tag>{plan.specification}</Tag> : null}
                        <MedicationPlanStatusTag status={plan.status} />
                        {lowStock ? <Tag color="red">药量预警</Tag> : null}
                      </Space>
                    }
                    description={
                      <Space orientation="vertical" size={2}>
                        <Text>
                          剩余 {trimDecimal(plan.currentStock)} {plan.stockUnit}
                          {days === undefined ? "" : ` · 预计 ${days} 天`}
                        </Text>
                        <Text type="secondary">
                          每次 {trimDecimal(plan.doseQuantity)} {plan.stockUnit} · {plan.scheduleSlots.map((slot) => slot.label).join("、")}
                        </Text>
                        {plan.instructions ? <Text type="secondary">医嘱：{plan.instructions}</Text> : null}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未建立用药计划" />}
      </Card>

      {data.medicationInventoryEvents.length ? (
        <Card title="库存变更记录">
          <List
            size="small"
            dataSource={[...data.medicationInventoryEvents].reverse().slice(0, 20)}
            renderItem={(event) => {
              const plan = data.medicationPlans.find((item) => item.id === event.medicationId);
              return (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Text strong>{plan?.name ?? "历史用药"}</Text>
                        <Tag>{inventoryEventLabel(event.type)}</Tag>
                        <Text type={Number(event.quantityDelta) < 0 ? "secondary" : "success"}>
                          {Number(event.quantityDelta) > 0 ? "+" : ""}{trimDecimal(event.quantityDelta)} {plan?.stockUnit ?? ""}
                        </Text>
                      </Space>
                    }
                    description={`${dayjs(event.occurredAt).format("YYYY-MM-DD HH:mm")}${event.note ? ` · ${event.note}` : ""}`}
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      ) : null}

      <Card
        title="复诊安排"
        extra={<Button icon={<PlusOutlined />} onClick={() => onOpen("followup")}>新增复诊</Button>}
      >
        <HealthRecordList
          empty="暂无复诊安排"
          items={data.followups.map((followup) => ({
            id: followup.id,
            title: `${dayjs(followup.scheduledAt).format("YYYY-MM-DD HH:mm")} · ${followup.type}`,
            tags: [
              <FollowupStatusTag key="status" status={followup.status} />,
              ...(followup.department ? [<Tag key="department">{followup.department}</Tag>] : [])
            ],
            description: [
              followup.hospital,
              followup.doctor,
              followup.tests.length ? `检查：${followup.tests.join("、")}` : undefined,
              followup.resultSummary
            ].filter(Boolean).join(" · "),
            onEdit: () => onOpen("followup", followup),
            onDelete: () => void onMutate(() => deleteHealthFollowup(followup.id), "复诊安排已删除")
          }))}
        />
      </Card>
    </Space>
  );
}

function HealthRecordList({
  items,
  empty
}: {
  items: Array<{
    id: string;
    title: string;
    tags: ReactNode[];
    description: string;
    onEdit: () => void;
    onDelete: () => void;
  }>;
  empty: string;
}) {
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  return (
    <List
      className="health-record-list"
      dataSource={items}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button key="edit" type="link" icon={<EditOutlined />} onClick={item.onEdit}>编辑</Button>,
            <Popconfirm key="delete" title="确认删除这条记录？" onConfirm={item.onDelete}>
              <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          ]}
        >
          <List.Item.Meta
            title={<Space wrap size={6}><Text strong>{item.title}</Text>{item.tags}</Space>}
            description={item.description}
          />
        </List.Item>
      )}
    />
  );
}

function HealthSettingsDrawer({
  open,
  profile,
  onClose,
  onSave
}: {
  open: boolean;
  profile: MemberHealthProfile;
  onClose: () => void;
  onSave: (input: Partial<Omit<MemberHealthProfile, "memberId">>) => void;
}) {
  const [form] = Form.useForm<HealthSettingsValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      ...profile,
      targetWeightKg: numberOrUndefined(profile.targetWeightKg),
      targetDate: profile.targetDate ? dayjs(profile.targetDate) : undefined,
      glucoseLowThreshold: Number(profile.glucoseLowThreshold),
      fastingMin: profile.glucoseTargets.fasting?.min,
      fastingMax: profile.glucoseTargets.fasting?.max,
      beforeMealMin: profile.glucoseTargets.beforeMeal?.min,
      beforeMealMax: profile.glucoseTargets.beforeMeal?.max,
      afterMeal2hMin: profile.glucoseTargets.afterMeal2h?.min,
      afterMeal2hMax: profile.glucoseTargets.afterMeal2h?.max,
      strengthExerciseGoals: profile.strengthExerciseGoals,
      hba1cTargetMax: numberOrUndefined(profile.hba1cTargetMax)
    });
  }, [form, open, profile]);

  return (
    <Drawer title="成员健康设置" size={620} open={open} onClose={onClose}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => onSave({
          weightTrackingEnabled: values.weightTrackingEnabled,
          exerciseTrackingEnabled: values.exerciseTrackingEnabled,
          glucoseTrackingEnabled: values.glucoseTrackingEnabled,
          hba1cTrackingEnabled: values.hba1cTrackingEnabled,
          medicationTrackingEnabled: values.medicationTrackingEnabled,
          targetWeightKg: stringOrEmpty(values.targetWeightKg),
          targetDate: values.targetDate?.format("YYYY-MM-DD") ?? "",
          weeklyExerciseMinutesGoal: values.weeklyExerciseMinutesGoal,
          weeklyStrengthSessionsGoal: values.weeklyStrengthSessionsGoal,
          strengthExerciseGoals: (values.strengthExerciseGoals ?? [])
            .filter((goal) => goal.name?.trim())
            .map((goal) => ({
              id: goal.id || crypto.randomUUID(),
              name: goal.name.trim(),
              metric: goal.metric,
              ...(goal.weeklyGoal ? { weeklyGoal: goal.weeklyGoal } : {}),
              ...(goal.singleSessionGoal ? { singleSessionGoal: goal.singleSessionGoal } : {}),
              ...(goal.maxSetGoal ? { maxSetGoal: goal.maxSetGoal } : {})
            })),
          dailyStepsGoal: values.dailyStepsGoal,
          glucoseIntervalDays: values.glucoseIntervalDays,
          glucoseLowThreshold: String(values.glucoseLowThreshold),
          glucoseTargets: {
            fasting: range(values.fastingMin, values.fastingMax),
            beforeMeal: range(values.beforeMealMin, values.beforeMealMax),
            afterMeal2h: range(values.afterMeal2hMin, values.afterMeal2hMax)
          },
          hba1cTargetMax: stringOrEmpty(values.hba1cTargetMax)
        })}
      >
        <Title level={5}>记录项目</Title>
        <Row gutter={12}>
          <Col xs={12}><Form.Item name="weightTrackingEnabled" label="体重与腰围" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12}><Form.Item name="exerciseTrackingEnabled" label="运动" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12}><Form.Item name="glucoseTrackingEnabled" label="血糖" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12}><Form.Item name="hba1cTrackingEnabled" label="HbA1c" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={12}><Form.Item name="medicationTrackingEnabled" label="用药与复诊" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
        <Title level={5}>身体与运动目标</Title>
        <Row gutter={12}>
          <Col xs={12}><NumberField name="targetWeightKg" label="目标体重 (kg)" min={20} max={400} /></Col>
          <Col xs={12}><Form.Item name="targetDate" label="目标日期"><DatePicker inputReadOnly className="health-full-width" /></Form.Item></Col>
          <Col xs={12}><NumberField name="weeklyExerciseMinutesGoal" label="每周运动 (分钟)" min={0} max={10080} /></Col>
          <Col xs={12}><NumberField name="weeklyStrengthSessionsGoal" label="每周力量训练 (次)" min={0} max={14} /></Col>
          <Col xs={12}><NumberField name="dailyStepsGoal" label="每日步数" min={0} max={100000} /></Col>
        </Row>
        <Title level={5}>力量动作目标</Title>
        <Text type="secondary">动作名称也会作为记录力量训练时的快捷选项。</Text>
        <Form.List name="strengthExerciseGoals">
          {(fields, { add, remove }) => (
            <Space orientation="vertical" size={10} className="strength-goal-editor">
              {fields.map((field) => (
                <div className="strength-goal-row" key={field.key}>
                  <Form.Item name={[field.name, "id"]} hidden><Input /></Form.Item>
                  <div className="strength-goal-heading">
                    <Form.Item
                      name={[field.name, "name"]}
                      label="动作"
                      rules={[{ required: true, message: "请输入动作名称" }]}
                    >
                      <AutoComplete
                        options={DEFAULT_STRENGTH_MOVEMENTS.map((value) => ({ value }))}
                        placeholder="俯卧撑、引体向上..."
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      aria-label="删除动作目标"
                      onClick={() => remove(field.name)}
                    />
                  </div>
                  <Row gutter={10}>
                    <Col xs={24} sm={8}>
                      <Form.Item name={[field.name, "metric"]} label="计量" rules={[{ required: true }]}>
                        <Segmented block options={[
                          { label: "次数", value: "reps" },
                          { label: "秒", value: "seconds" }
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col xs={8}>
                      <NumberField name={[field.name, "weeklyGoal"]} label="每周累计" min={1} max={100000} />
                    </Col>
                    <Col xs={8}>
                      <NumberField name={[field.name, "singleSessionGoal"]} label="单次目标" min={1} max={100000} />
                    </Col>
                    <Col xs={8}>
                      <NumberField name={[field.name, "maxSetGoal"]} label="最大单组" min={1} max={100000} />
                    </Col>
                  </Row>
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({ metric: "reps" })}
              >
                添加动作目标
              </Button>
            </Space>
          )}
        </Form.List>
        <Title level={5}>血糖与复查</Title>
        <Alert type="info" showIcon title="以下范围应按本人医生建议填写" className="health-settings-alert" />
        <Row gutter={12}>
          <Col xs={12}><NumberField name="glucoseIntervalDays" label="测量间隔 (天)" min={1} max={365} /></Col>
          <Col xs={12}><NumberField name="glucoseLowThreshold" label="低血糖警戒值" min={1} max={10} step={0.1} /></Col>
          <Col xs={12}><NumberField name="fastingMin" label="空腹下限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="fastingMax" label="空腹上限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="beforeMealMin" label="餐前下限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="beforeMealMax" label="餐前上限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="afterMeal2hMin" label="餐后2小时下限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="afterMeal2hMax" label="餐后2小时上限" min={1} max={30} step={0.1} /></Col>
          <Col xs={12}><NumberField name="hba1cTargetMax" label="HbA1c目标上限 (%)" min={2} max={25} step={0.1} /></Col>
        </Row>
        <Button type="primary" htmlType="submit">保存设置</Button>
      </Form>
    </Drawer>
  );
}

function BodyEditor({ open, record, onClose, onSave }: EditorProps<BodyMeasurement, BodyMeasurementInput>) {
  const [form] = Form.useForm<BodyFormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      measuredAt: record ? dayjs(record.measuredAt).startOf("minute") : dayjs().startOf("minute"),
      weightKg: numberOrUndefined(record?.weightKg),
      waistCm: numberOrUndefined(record?.waistCm),
      context: record?.context ?? "morningFasting",
      note: record?.note
    });
  }, [form, open, record]);
  return (
    <EditorDrawer title={record ? "编辑身体记录" : "记录身体数据"} open={open} onClose={onClose}>
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        measuredAt: toMinuteIso(values.measuredAt),
        weightKg: String(values.weightKg),
        ...(values.waistCm === undefined ? {} : { waistCm: String(values.waistCm) }),
        context: values.context,
        note: values.note
      })}>
        <Form.Item name="measuredAt" label="测量时间" rules={[{ required: true }]}>
          <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
        </Form.Item>
        <NumberField name="weightKg" label="体重 (kg)" min={20} max={400} step={0.1} required />
        <NumberField name="waistCm" label="腰围 (cm)" min={30} max={300} step={0.1} />
        <Form.Item name="context" label="测量状态" rules={[{ required: true }]}>
          <Segmented
            block
            options={Object.entries(bodyMeasurementContextLabels).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </EditorDrawer>
  );
}

function ExerciseEditor({
  open,
  record,
  profile,
  recentLogs,
  onClose,
  onSave
}: EditorProps<ExerciseLog, ExerciseLogInput> & {
  profile: MemberHealthProfile;
  recentLogs: ExerciseLog[];
}) {
  const [form] = Form.useForm<ExerciseFormValues>();
  const isStrengthTraining = Form.useWatch("isStrengthTraining", form);
  const movements = Form.useWatch("movements", form);
  const movementOptions = [...new Set([
    ...DEFAULT_STRENGTH_MOVEMENTS,
    ...profile.strengthExerciseGoals.map((goal) => goal.name)
  ])].map((value) => ({ value }));
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      date: record ? dayjs(record.date) : dayjs(),
      type: record?.type,
      durationMinutes: record?.durationMinutes,
      intensity: record?.intensity ?? "moderate",
      isStrengthTraining: record?.isStrengthTraining ?? false,
      steps: record?.steps,
      estimatedCalories: record?.estimatedCalories,
      movements: record?.movements.map((movement) => ({
        name: movement.name,
        metric: movement.metric,
        sets: movement.sets.map((value) => ({ value })),
        variant: movement.variant,
        addedWeightKg: numberOrUndefined(movement.addedWeightKg),
        assistanceWeightKg: numberOrUndefined(movement.assistanceWeightKg),
        note: movement.note
      })),
      note: record?.note
    });
  }, [form, open, record]);
  const copyPreviousStrength = () => {
    const previous = [...recentLogs]
      .reverse()
      .find((log) => log.id !== record?.id && log.movements.length > 0);
    if (!previous) return;
    form.setFieldsValue({
      type: previous.type,
      durationMinutes: previous.durationMinutes,
      intensity: previous.intensity,
      isStrengthTraining: true,
      movements: previous.movements.map((movement) => ({
        name: movement.name,
        metric: movement.metric,
        sets: movement.sets.map((value) => ({ value })),
        variant: movement.variant,
        addedWeightKg: numberOrUndefined(movement.addedWeightKg),
        assistanceWeightKg: numberOrUndefined(movement.assistanceWeightKg),
        note: movement.note
      }))
    });
  };
  const previousStrengthAvailable = recentLogs.some((log) => (
    log.id !== record?.id && log.movements.length > 0
  ));
  return (
    <EditorDrawer title={record ? "编辑运动记录" : "记录运动"} size={680} open={open} onClose={onClose}>
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        date: values.date.toISOString(),
        type: values.type,
        durationMinutes: values.durationMinutes,
        intensity: values.intensity,
        isStrengthTraining: values.isStrengthTraining,
        steps: values.steps,
        estimatedCalories: values.estimatedCalories,
        movements: values.isStrengthTraining
          ? (values.movements ?? []).map((movement) => ({
            name: movement.name,
            metric: movement.metric,
            sets: movement.sets.map((set) => set.value),
            variant: movement.variant,
            addedWeightKg: stringOrEmpty(movement.addedWeightKg),
            assistanceWeightKg: stringOrEmpty(movement.assistanceWeightKg),
            note: movement.note
          }))
          : [],
        note: values.note
      })}>
        <Form.Item name="date" label="日期" rules={[{ required: true }]}><DatePicker inputReadOnly className="health-full-width" /></Form.Item>
        <Form.Item name="type" label="运动类型" rules={[{ required: true, message: "请输入运动类型" }]}><Input placeholder="快走、跑步、游泳、力量训练..." /></Form.Item>
        <NumberField name="durationMinutes" label="时长 (分钟)" min={1} max={1440} required />
        <Form.Item name="intensity" label="强度" rules={[{ required: true }]}>
          <Segmented block options={[
            { label: "低", value: "low" },
            { label: "中", value: "moderate" },
            { label: "高", value: "high" }
          ]} />
        </Form.Item>
        <Form.Item name="isStrengthTraining" valuePropName="checked"><Checkbox>计为力量训练</Checkbox></Form.Item>
        {isStrengthTraining ? (
          <div className="strength-movement-section">
            <Flex justify="space-between" align="center" gap={8}>
              <div>
                <Text strong>动作与分组</Text>
                <div><Text type="secondary">每组只填完成次数，平板支撑等动作可切换为秒。</Text></div>
              </div>
              {previousStrengthAvailable ? (
                <Button onClick={copyPreviousStrength}>带入上次训练</Button>
              ) : null}
            </Flex>
            <Form.List name="movements">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" size={12} className="strength-movement-list">
                  {fields.map((field, movementIndex) => {
                    const movement = movements?.[movementIndex];
                    const movementTotal = movement?.sets?.reduce(
                      (total, set) => total + (Number(set?.value) || 0),
                      0
                    ) ?? 0;
                    const movementUnit = movement?.metric === "seconds" ? "秒" : "次";
                    return (
                      <div className="strength-movement-editor" key={field.key}>
                        <div className="strength-movement-heading">
                          <Text strong>动作 {movementIndex + 1}</Text>
                          <Space size={8}>
                            <Tag color="blue">合计 {movementTotal}{movementUnit}</Tag>
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              aria-label="删除动作"
                              onClick={() => remove(field.name)}
                            />
                          </Space>
                        </div>
                        <Row gutter={10}>
                          <Col xs={24} sm={14}>
                            <Form.Item
                              name={[field.name, "name"]}
                              label="动作"
                              rules={[{ required: true, message: "请输入动作名称" }]}
                            >
                              <AutoComplete options={movementOptions} placeholder="俯卧撑、引体向上..." />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={10}>
                            <Form.Item name={[field.name, "metric"]} label="计量" rules={[{ required: true }]}>
                              <Segmented block options={[
                                { label: "次数", value: "reps" },
                                { label: "秒", value: "seconds" }
                              ]} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.List name={[field.name, "sets"]}>
                          {(setFields, { add: addSet, remove: removeSet }) => (
                            <div className="strength-set-list">
                              {setFields.map((setField, setIndex) => (
                                <div className="strength-set-item" key={setField.key}>
                                  <Form.Item
                                    name={[setField.name, "value"]}
                                    label={`第${setIndex + 1}组`}
                                    rules={[{ required: true, message: "请输入完成数" }]}
                                  >
                                    <InputNumber min={1} max={10000} precision={0} />
                                  </Form.Item>
                                  {setFields.length > 1 ? (
                                    <Button
                                      type="text"
                                      danger
                                      icon={<MinusCircleOutlined />}
                                      aria-label={`删除第${setIndex + 1}组`}
                                      onClick={() => removeSet(setField.name)}
                                    />
                                  ) : null}
                                </div>
                              ))}
                              <Button type="dashed" icon={<PlusOutlined />} onClick={() => addSet({ value: 1 })}>
                                增加一组
                              </Button>
                            </div>
                          )}
                        </Form.List>
                        <Row gutter={10}>
                          <Col xs={24} sm={8}><Form.Item name={[field.name, "variant"]} label="动作变式"><Input placeholder="宽距、跪姿..." /></Form.Item></Col>
                          <Col xs={12} sm={8}><NumberField name={[field.name, "addedWeightKg"]} label="负重 (kg)" min={0} max={500} step={0.5} /></Col>
                          <Col xs={12} sm={8}><NumberField name={[field.name, "assistanceWeightKg"]} label="助力 (kg)" min={0} max={500} step={0.5} /></Col>
                        </Row>
                        <Form.Item name={[field.name, "note"]} label="动作备注"><Input /></Form.Item>
                      </div>
                    );
                  })}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => add({ metric: "reps", sets: [{ value: 10 }] })}
                  >
                    添加动作
                  </Button>
                </Space>
              )}
            </Form.List>
          </div>
        ) : null}
        <NumberField name="steps" label="步数（可选）" min={0} max={200000} />
        <NumberField name="estimatedCalories" label="估算消耗 (kcal，可选)" min={0} max={10000} />
        <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </EditorDrawer>
  );
}

function GlucoseEditor({ open, record, onClose, onSave }: EditorProps<BloodGlucoseRecord, BloodGlucoseInput>) {
  const [form] = Form.useForm<GlucoseFormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      measuredAt: record ? dayjs(record.measuredAt).startOf("minute") : dayjs().startOf("minute"),
      glucoseMmol: numberOrUndefined(record?.glucoseMmol),
      context: record?.context ?? "fasting",
      meal: record?.meal,
      exerciseRelation: record?.exerciseRelation,
      medicationTaken: record?.medicationTaken,
      symptoms: record?.symptoms,
      note: record?.note
    });
  }, [form, open, record]);
  return (
    <EditorDrawer title={record ? "编辑血糖记录" : "记录血糖"} open={open} onClose={onClose}>
      <Alert type="info" showIcon title="如数值明显异常或伴随不适，请按医生既定方案处理" className="health-editor-alert" />
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        measuredAt: toMinuteIso(values.measuredAt),
        glucoseMmol: String(values.glucoseMmol),
        context: values.context,
        meal: values.meal,
        exerciseRelation: values.exerciseRelation,
        medicationTaken: values.medicationTaken,
        symptoms: values.symptoms,
        note: values.note,
        source: "manual"
      })}>
        <Form.Item name="measuredAt" label="测量时间" rules={[{ required: true }]}>
          <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
        </Form.Item>
        <NumberField name="glucoseMmol" label="血糖 (mmol/L)" min={0.5} max={60} step={0.1} required />
        <Form.Item name="context" label="测量场景" rules={[{ required: true }]}>
          <Select options={Object.entries(glucoseContextLabels).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Form.Item name="meal" label="餐次（可选）"><Select allowClear options={[
          { value: "breakfast", label: "早餐" },
          { value: "lunch", label: "午餐" },
          { value: "dinner", label: "晚餐" },
          { value: "snack", label: "加餐" }
        ]} /></Form.Item>
        <Form.Item name="exerciseRelation" label="与运动关系（可选）"><Select allowClear options={[
          { value: "before", label: "运动前" },
          { value: "after", label: "运动后" }
        ]} /></Form.Item>
        <Form.Item name="medicationTaken" label="是否按既定方案用药"><Select allowClear options={[
          { value: true, label: "是" },
          { value: false, label: "否" }
        ]} /></Form.Item>
        <Form.Item name="symptoms" label="症状"><Input placeholder="无症状可留空" /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </EditorDrawer>
  );
}

function Hba1cEditor({ open, record, onClose, onSave }: EditorProps<Hba1cRecord, Hba1cInput>) {
  const [form] = Form.useForm<Hba1cFormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      measuredAt: record ? dayjs(record.measuredAt) : dayjs(),
      valuePercent: numberOrUndefined(record?.valuePercent),
      facility: record?.facility,
      doctorAdvice: record?.doctorAdvice,
      nextReviewDate: record?.nextReviewDate ? dayjs(record.nextReviewDate) : undefined
    });
  }, [form, open, record]);
  return (
    <EditorDrawer title={record ? "编辑 HbA1c 记录" : "记录 HbA1c"} open={open} onClose={onClose}>
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        measuredAt: values.measuredAt.toISOString(),
        valuePercent: String(values.valuePercent),
        facility: values.facility,
        doctorAdvice: values.doctorAdvice,
        nextReviewDate: values.nextReviewDate?.format("YYYY-MM-DD")
      })}>
        <Form.Item name="measuredAt" label="检查日期" rules={[{ required: true }]}><DatePicker inputReadOnly className="health-full-width" /></Form.Item>
        <NumberField name="valuePercent" label="HbA1c (%)" min={2} max={25} step={0.1} required />
        <Form.Item name="facility" label="检查机构"><Input /></Form.Item>
        <Form.Item name="doctorAdvice" label="医生建议"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="nextReviewDate" label="下次复查日期"><DatePicker inputReadOnly className="health-full-width" /></Form.Item>
        <Button type="primary" htmlType="submit">保存</Button>
      </Form>
    </EditorDrawer>
  );
}

function MedicationEditor({
  open,
  record,
  onClose,
  onSave
}: EditorProps<MedicationPlan, MedicationPlanInput>) {
  const [form] = Form.useForm<MedicationFormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      name: record?.name,
      specification: record?.specification,
      stockUnit: record?.stockUnit ?? "片",
      doseQuantity: numberOrUndefined(record?.doseQuantity) ?? 1,
      scheduleSlots: record?.scheduleSlots.length
        ? record.scheduleSlots.map((slot) => ({
          ...slot,
          time: slot.time ? dayjs(`2000-01-01T${slot.time}:00`) : undefined
        }))
        : [{ id: "morning", label: "早餐后", time: dayjs("2000-01-01T08:00:00") }],
      startDate: record ? dayjs(record.startDate) : dayjs(),
      endDate: record?.endDate ? dayjs(record.endDate) : undefined,
      purpose: record?.purpose,
      instructions: record?.instructions,
      status: record?.status ?? "active",
      currentStock: record ? undefined : 0,
      lowStockDays: record?.lowStockDays ?? 7
    });
  }, [form, open, record]);

  return (
    <EditorDrawer title={record ? "编辑用药计划" : "新增用药计划"} open={open} onClose={onClose}>
      <Alert
        type="info"
        showIcon
        title="请按医生或药师明确给出的方案填写"
        className="health-editor-alert"
      />
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        name: values.name,
        specification: values.specification,
        stockUnit: values.stockUnit,
        doseQuantity: String(values.doseQuantity),
        scheduleSlots: values.scheduleSlots.map((slot, index) => ({
          id: slot.id || `slot-${index + 1}`,
          label: slot.label,
          ...(slot.time ? { time: slot.time.format("HH:mm") } : {})
        })),
        startDate: values.startDate.format("YYYY-MM-DD"),
        endDate: values.endDate?.format("YYYY-MM-DD"),
        purpose: values.purpose,
        instructions: values.instructions,
        status: values.status,
        ...(record ? {} : { initialStock: String(values.currentStock ?? 0) }),
        lowStockDays: values.lowStockDays
      })}>
        <Form.Item name="name" label="药品名称" rules={[{ required: true, message: "请输入药品名称" }]}>
          <Input placeholder="例如：二甲双胍" />
        </Form.Item>
        <Form.Item name="specification" label="规格"><Input placeholder="例如：0.5g/片" /></Form.Item>
        <Row gutter={12}>
          <Col xs={12}><NumberField name="doseQuantity" label="每次用量" min={0.01} max={100000} step={0.5} required /></Col>
          <Col xs={12}>
            <Form.Item name="stockUnit" label="库存单位" rules={[{ required: true, message: "请输入库存单位" }]}>
              <Input placeholder="片、粒、支、毫升" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="每日用药时间" required>
          <Form.List name="scheduleSlots">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" className="health-full-width">
                {fields.map((field) => (
                  <Flex key={field.key} gap={8} align="start">
                    <Form.Item name={[field.name, "id"]} hidden><Input /></Form.Item>
                    <Form.Item
                      name={[field.name, "label"]}
                      rules={[{ required: true, message: "请输入用药时间说明" }]}
                      className="medication-slot-label"
                    >
                      <Input placeholder="早餐后" />
                    </Form.Item>
                    <Form.Item name={[field.name, "time"]} className="medication-slot-time">
                      <TimePicker
                        inputReadOnly
                        format="HH:mm"
                        minuteStep={5}
                        placeholder="选择时间"
                        className="health-full-width"
                      />
                    </Form.Item>
                    <Button
                      icon={<DeleteOutlined />}
                      aria-label="删除用药时间"
                      disabled={fields.length === 1}
                      onClick={() => remove(field.name)}
                    />
                  </Flex>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add({
                  id: `slot-${Date.now()}-${fields.length + 1}`,
                  label: "",
                  time: dayjs("2000-01-01T08:00:00")
                })}>
                  添加用药时间
                </Button>
              </Space>
            )}
          </Form.List>
        </Form.Item>
        <Row gutter={12}>
          <Col xs={12}><Form.Item name="startDate" label="开始日期" rules={[{ required: true }]}><DatePicker inputReadOnly className="health-full-width" /></Form.Item></Col>
          <Col xs={12}><Form.Item name="endDate" label="结束日期"><DatePicker inputReadOnly className="health-full-width" /></Form.Item></Col>
        </Row>
        {!record ? <NumberField name="currentStock" label="当前剩余药量" min={0} max={10000000} step={0.5} /> : null}
        <NumberField name="lowStockDays" label="剩余多少天时提醒" min={0} max={365} />
        <Form.Item name="status" label="状态" rules={[{ required: true }]}>
          <Segmented block options={[
            { value: "active", label: "使用中" },
            { value: "paused", label: "医嘱暂停" },
            { value: "stopped", label: "已停用" }
          ]} />
        </Form.Item>
        <Form.Item name="purpose" label="用途"><Input placeholder="例如：控制餐后血糖" /></Form.Item>
        <Form.Item name="instructions" label="医生医嘱"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">保存计划</Button>
      </Form>
    </EditorDrawer>
  );
}

function InventoryEditor({
  open,
  plan,
  onClose,
  onSave
}: {
  open: boolean;
  plan?: MedicationPlan;
  onClose: () => void;
  onSave: (id: string, input: MedicationInventoryInput) => void;
}) {
  const [form] = Form.useForm<InventoryFormValues>();
  useEffect(() => {
    if (!open || !plan) return;
    form.resetFields();
    form.setFieldsValue({
      mode: "restock",
      quantity: undefined,
      occurredAt: dayjs().startOf("minute")
    });
  }, [form, open, plan]);
  return (
    <EditorDrawer title={`${plan?.name ?? ""} · 补药/盘点`} open={open} onClose={onClose}>
      {plan ? (
        <>
          <Alert
            type="info"
            showIcon
            title={`当前记录：${trimDecimal(plan.currentStock)} ${plan.stockUnit}`}
            className="health-editor-alert"
          />
          <Form form={form} layout="vertical" onFinish={(values) => onSave(plan.id, {
            mode: values.mode,
            quantity: String(values.quantity),
            occurredAt: toMinuteIso(values.occurredAt),
            note: values.note
          })}>
            <Form.Item name="mode" label="操作" rules={[{ required: true }]}>
              <Segmented block options={[
                { label: "补充药量", value: "restock" },
                { label: "盘点至", value: "set" }
              ]} />
            </Form.Item>
            <NumberField name="quantity" label={`数量 (${plan.stockUnit})`} min={0} max={10000000} step={0.5} required />
            <Form.Item name="occurredAt" label="时间" rules={[{ required: true }]}>
              <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
            </Form.Item>
            <Form.Item name="note" label="备注"><Input placeholder="例如：医院取药" /></Form.Item>
            <Button type="primary" htmlType="submit">更新库存</Button>
          </Form>
        </>
      ) : null}
    </EditorDrawer>
  );
}

function FollowupEditor({
  open,
  record,
  onClose,
  onSave
}: EditorProps<HealthFollowup, HealthFollowupInput>) {
  const [form] = Form.useForm<FollowupFormValues>();
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      scheduledAt: record
        ? dayjs(record.scheduledAt).startOf("minute")
        : dayjs().add(1, "month").startOf("minute"),
      hospital: record?.hospital,
      department: record?.department,
      doctor: record?.doctor,
      type: record?.type ?? "糖尿病复诊",
      tests: record?.tests.join("、"),
      reminderDays: record?.reminderDays ?? 7,
      status: record?.status ?? "scheduled",
      resultSummary: record?.resultSummary,
      doctorAdvice: record?.doctorAdvice
    });
  }, [form, open, record]);
  return (
    <EditorDrawer title={record ? "编辑复诊安排" : "新增复诊安排"} open={open} onClose={onClose}>
      <Form form={form} layout="vertical" onFinish={(values) => onSave({
        scheduledAt: toMinuteIso(values.scheduledAt),
        hospital: values.hospital,
        department: values.department,
        doctor: values.doctor,
        type: values.type,
        tests: splitList(values.tests),
        reminderDays: values.reminderDays,
        status: values.status,
        resultSummary: values.resultSummary,
        doctorAdvice: values.doctorAdvice
      })}>
        <Form.Item name="scheduledAt" label="复诊时间" rules={[{ required: true }]}>
          <DatePicker {...MINUTE_DATE_TIME_PICKER_PROPS} className="health-full-width" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: "请输入复诊类型" }]}><Input /></Form.Item>
        <Form.Item name="hospital" label="医院"><Input /></Form.Item>
        <Row gutter={12}>
          <Col xs={12}><Form.Item name="department" label="科室"><Input /></Form.Item></Col>
          <Col xs={12}><Form.Item name="doctor" label="医生"><Input /></Form.Item></Col>
        </Row>
        <Form.Item name="tests" label="检查项目"><Input placeholder="空腹血糖、HbA1c，用顿号或逗号分隔" /></Form.Item>
        <NumberField name="reminderDays" label="提前提醒 (天)" min={0} max={365} />
        <Form.Item name="status" label="状态" rules={[{ required: true }]}>
          <Segmented block options={[
            { label: "待进行", value: "scheduled" },
            { label: "已完成", value: "completed" },
            { label: "已取消", value: "cancelled" }
          ]} />
        </Form.Item>
        <Form.Item name="resultSummary" label="复诊结果"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="doctorAdvice" label="医生建议"><Input.TextArea rows={3} /></Form.Item>
        <Button type="primary" htmlType="submit">保存复诊</Button>
      </Form>
    </EditorDrawer>
  );
}

function EditorDrawer({
  title,
  size = 480,
  open,
  onClose,
  children
}: {
  title: string;
  size?: number;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return <Drawer title={title} size={size} open={open} onClose={onClose}>{children}</Drawer>;
}

function NumberField({
  name,
  label,
  min,
  max,
  step = 1,
  required = false
}: {
  name: string | Array<string | number>;
  label: string;
  min: number;
  max: number;
  step?: number;
  required?: boolean;
}) {
  return (
    <Form.Item name={name} label={label} rules={required ? [{ required: true, message: `请输入${label}` }] : undefined}>
      <InputNumber className="health-full-width" min={min} max={max} step={step} />
    </Form.Item>
  );
}

function StatusTag({ status }: { status: ReturnType<typeof glucoseStatus> }) {
  if (status === "low") return <Tag color="red">偏低</Tag>;
  if (status === "high") return <Tag color="orange">偏高</Tag>;
  if (status === "inRange") return <Tag color="green">目标内</Tag>;
  return <Tag>未设范围</Tag>;
}

function MedicationPlanStatusTag({ status }: { status: MedicationPlan["status"] }) {
  if (status === "active") return <Tag color="green">使用中</Tag>;
  if (status === "paused") return <Tag color="orange">医嘱暂停</Tag>;
  return <Tag>已停用</Tag>;
}

function inventoryEventLabel(type: HealthData["medicationInventoryEvents"][number]["type"]): string {
  return {
    initial: "初始库存",
    restock: "补药",
    adjustment: "盘点调整",
    consumption: "服药扣减"
  }[type];
}

function FollowupStatusTag({ status }: { status: HealthFollowup["status"] }) {
  const color = status === "scheduled" ? "blue" : status === "completed" ? "green" : "default";
  return <Tag color={color}>{followupStatusLabels[status]}</Tag>;
}

function hasGlucoseFeature(profile: MemberHealthProfile): boolean {
  return profile.glucoseTrackingEnabled || profile.hba1cTrackingEnabled;
}

function startOfCurrentWeek(monthKey: string): string {
  const reference = monthKey === dayjs().format("YYYY-MM")
    ? dayjs()
    : dayjs(`${monthKey}-01`).endOf("month");
  const monday = reference.day() === 0
    ? reference.subtract(6, "day")
    : reference.subtract(reference.day() - 1, "day");
  return monday.format("YYYY-MM-DD");
}

function healthReferenceDate(monthKey: string): string {
  return monthKey === dayjs().format("YYYY-MM")
    ? dayjs().format("YYYY-MM-DD")
    : dayjs(`${monthKey}-01`).endOf("month").format("YYYY-MM-DD");
}

function signed(value: number): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function goalPercent(value: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
}

function numberOrUndefined(value?: string): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function stringOrEmpty(value?: number): string {
  return value === undefined || value === null ? "" : String(value);
}

function range(min?: number, max?: number) {
  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max })
  };
}

function trimDecimal(value: string): string {
  return String(Number(value));
}

function splitList(value?: string): string[] {
  return value?.split(/[、,，;；]/).map((item) => item.trim()).filter(Boolean) ?? [];
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

interface EditorProps<TRecord, TInput> {
  open: boolean;
  record?: TRecord;
  onClose: () => void;
  onSave: (input: TInput) => void;
}

interface ReviewFormValues {
  good?: string;
  obstacle?: string;
  nextAction?: string;
}

interface HealthSettingsValues {
  weightTrackingEnabled: boolean;
  exerciseTrackingEnabled: boolean;
  glucoseTrackingEnabled: boolean;
  hba1cTrackingEnabled: boolean;
  medicationTrackingEnabled: boolean;
  targetWeightKg?: number;
  targetDate?: Dayjs;
  weeklyExerciseMinutesGoal: number;
  weeklyStrengthSessionsGoal: number;
  strengthExerciseGoals?: StrengthGoalFormValue[];
  dailyStepsGoal: number;
  glucoseIntervalDays: number;
  glucoseLowThreshold: number;
  fastingMin?: number;
  fastingMax?: number;
  beforeMealMin?: number;
  beforeMealMax?: number;
  afterMeal2hMin?: number;
  afterMeal2hMax?: number;
  hba1cTargetMax?: number;
}

interface StrengthGoalFormValue extends Omit<StrengthExerciseGoal, "id"> {
  id?: string;
}

interface BodyFormValues {
  measuredAt: Dayjs;
  weightKg: number;
  waistCm?: number;
  context: BodyMeasurement["context"];
  note?: string;
}

interface ExerciseFormValues {
  date: Dayjs;
  type: string;
  durationMinutes: number;
  intensity: ExerciseLog["intensity"];
  isStrengthTraining: boolean;
  steps?: number;
  estimatedCalories?: number;
  movements?: StrengthMovementFormValue[];
  note?: string;
}

interface StrengthMovementFormValue {
  name: string;
  metric: ExerciseLog["movements"][number]["metric"];
  sets: Array<{ value: number }>;
  variant?: string;
  addedWeightKg?: number;
  assistanceWeightKg?: number;
  note?: string;
}

interface GlucoseFormValues {
  measuredAt: Dayjs;
  glucoseMmol: number;
  context: BloodGlucoseRecord["context"];
  meal?: BloodGlucoseRecord["meal"];
  exerciseRelation?: BloodGlucoseRecord["exerciseRelation"];
  medicationTaken?: boolean;
  symptoms?: string;
  note?: string;
}

interface Hba1cFormValues {
  measuredAt: Dayjs;
  valuePercent: number;
  facility?: string;
  doctorAdvice?: string;
  nextReviewDate?: Dayjs;
}

interface MedicationFormValues {
  name: string;
  specification?: string;
  stockUnit: string;
  doseQuantity: number;
  scheduleSlots: Array<{ id?: string; label: string; time?: Dayjs }>;
  startDate: Dayjs;
  endDate?: Dayjs;
  purpose?: string;
  instructions?: string;
  status: MedicationPlan["status"];
  currentStock?: number;
  lowStockDays: number;
}

interface InventoryFormValues {
  mode: "restock" | "set";
  quantity: number;
  occurredAt: Dayjs;
  note?: string;
}

interface FollowupFormValues {
  scheduledAt: Dayjs;
  hospital?: string;
  department?: string;
  doctor?: string;
  type: string;
  tests?: string;
  reminderDays: number;
  status: HealthFollowup["status"];
  resultSummary?: string;
  doctorAdvice?: string;
}
