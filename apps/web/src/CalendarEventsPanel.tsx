import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  GiftOutlined,
  PlusOutlined
} from "@ant-design/icons";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventStatus,
  CalendarEventType,
  CalendarRecurrence,
  CalendarSystem,
  FamilyMemberInfo
} from "@family-finance/shared";
import {
  buildCalendarEventOccurrences,
  calendarLunarInfo
} from "@family-finance/shared";
import {
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
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  TimePicker,
  Typography
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent
} from "./api/client";

const { Text, Title } = Typography;

const eventTypeLabels: Record<CalendarEventType, string> = {
  schedule: "日程",
  anniversary: "纪念日"
};
const eventStatusLabels: Record<CalendarEventStatus, string> = {
  scheduled: "待进行",
  completed: "已完成",
  cancelled: "已取消"
};
const recurrenceLabels: Record<CalendarRecurrence, string> = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年"
};

interface CalendarEventFormValues {
  title: string;
  type: CalendarEventType;
  calendarSystem: CalendarSystem;
  startDate: dayjs.Dayjs;
  endDate?: dayjs.Dayjs;
  startTime?: dayjs.Dayjs;
  endTime?: dayjs.Dayjs;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  recurrenceEndDate?: dayjs.Dayjs;
  originalYear?: number;
  showCountdown: boolean;
  reminderDays: number[];
  location?: string;
  note?: string;
  status: CalendarEventStatus;
  memberIds: string[];
}

export function CalendarEventsPanel({
  members,
  memberId,
  monthKey,
  mobile,
  onChanged
}: {
  members: FamilyMemberInfo[];
  memberId: string;
  monthKey: string;
  mobile: boolean;
  onChanged(): void;
}) {
  const { message } = AntApp.useApp();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<CalendarEventType>();
  const [status, setStatus] = useState<CalendarEventStatus>("scheduled");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getCalendarEvents(memberId, type, status)
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((reason: unknown) => {
        if (active) message.error(reason instanceof Error ? reason.message : "日程加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, message, status, type, version]);

  const sortedEvents = useMemo(() => {
    const today = dayjs().format("YYYY-MM-DD");
    const rangeEnd = dayjs().add(18, "month").format("YYYY-MM-DD");
    return events
      .map((event) => ({
        event,
        occurrence: buildCalendarEventOccurrences(event, today, rangeEnd, today)[0]
      }))
      .sort((left, right) => (
        (left.occurrence?.date ?? left.event.startDate)
          .localeCompare(right.occurrence?.date ?? right.event.startDate)
        || left.event.title.localeCompare(right.event.title, "zh-CN")
      ));
  }, [events]);

  const refresh = () => {
    setVersion((value) => value + 1);
    onChanged();
  };
  const openCreate = () => {
    setEditingEvent(undefined);
    setDrawerOpen(true);
  };
  const remove = async (event: CalendarEvent) => {
    try {
      await deleteCalendarEvent(event.id);
      message.success("日程已删除");
      refresh();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "删除失败");
    }
  };
  const complete = async (event: CalendarEvent) => {
    try {
      await updateCalendarEvent(event.id, eventToInput(event, { status: "completed" }));
      message.success("日程已完成");
      refresh();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "更新失败");
    }
  };

  return (
    <>
      <Card
        className="calendar-event-manager"
        title="日程与纪念日"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增</Button>}
      >
        <Flex gap={8} wrap className="calendar-event-filters">
          <Select
            allowClear
            placeholder="全部类型"
            value={type}
            onChange={setType}
            options={Object.entries(eventTypeLabels).map(([value, label]) => ({ value, label }))}
          />
          <Select
            allowClear
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
            options={Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label }))}
          />
        </Flex>
        <Spin spinning={loading}>
          {sortedEvents.length ? (
            <div className="calendar-event-list">
              {sortedEvents.map(({ event, occurrence }) => {
            const displayDate = occurrence?.date ?? event.startDate;
            const countdown = occurrence?.countdownDays;
            return (
              <article
                key={event.id}
                className="calendar-event-list-item"
              >
                <div className="calendar-event-list-icon" aria-hidden>
                  {event.type === "anniversary" ? <GiftOutlined /> : <CalendarOutlined />}
                </div>
                <div className="calendar-event-list-content">
                  <Flex gap={6} align="center" wrap>
                    <Title level={5}>{event.title}</Title>
                    <Tag color={event.type === "anniversary" ? "magenta" : "blue"}>
                      {eventTypeLabels[event.type]}
                    </Tag>
                    {event.calendarSystem === "lunar" ? <Tag>农历</Tag> : null}
                    {event.status !== "scheduled" ? <Tag>{eventStatusLabels[event.status]}</Tag> : null}
                  </Flex>
                  <Space orientation="vertical" size={4}>
                    <Flex gap={8} wrap>
                      <Text>
                        {dayjs(displayDate).format("YYYY年M月D日")}
                        {!event.allDay && event.startTime ? ` ${event.startTime}` : ""}
                      </Text>
                      <Text type="secondary">{recurrenceLabels[event.recurrence]}</Text>
                      {countdown !== undefined && countdown >= 0 ? (
                        <Tag color={countdown === 0 ? "red" : "orange"}>
                          {countdown === 0 ? "就是今天" : `还有${countdown}天`}
                        </Tag>
                      ) : null}
                    </Flex>
                    {event.calendarSystem === "lunar" ? (
                      <Text type="secondary">
                        {`${event.lunarLeapMonth ? "闰" : ""}${event.lunarMonth}月${event.lunarDay}日`}
                      </Text>
                    ) : null}
                    <Text type="secondary">
                      {event.participants.map((item) => item.memberName).join("、") || "未指定参与成员"}
                      {event.location ? ` · ${event.location}` : ""}
                    </Text>
                  </Space>
                </div>
                <Flex className="calendar-event-list-actions" gap={4} wrap>
                  {event.type === "schedule" && event.status === "scheduled" ? (
                    <Button
                      type="text"
                      icon={<CheckCircleOutlined />}
                      onClick={() => void complete(event)}
                    >
                      完成
                    </Button>
                  ) : null}
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingEvent(event);
                      setDrawerOpen(true);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除这条记录？"
                    onConfirm={() => void remove(event)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Flex>
              </article>
            );
              })}
            </div>
          ) : loading ? null : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日程或纪念日" />
          )}
        </Spin>
      </Card>
      <CalendarEventDrawer
        open={drawerOpen}
        event={editingEvent}
        defaultDate={`${monthKey}-01`}
        members={members}
        mobile={mobile}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          refresh();
        }}
      />
    </>
  );
}

export function CalendarEventDrawer({
  open,
  event,
  defaultDate,
  defaultType = "schedule",
  members,
  mobile,
  onClose,
  onSaved
}: {
  open: boolean;
  event?: CalendarEvent;
  defaultDate: string;
  defaultType?: CalendarEventType;
  members: FamilyMemberInfo[];
  mobile: boolean;
  onClose(): void;
  onSaved(): void;
}) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<CalendarEventFormValues>();
  const [saving, setSaving] = useState(false);
  const type = Form.useWatch("type", form) ?? defaultType;
  const calendarSystem = Form.useWatch("calendarSystem", form) ?? "solar";
  const allDay = Form.useWatch("allDay", form) ?? true;
  const startDate = Form.useWatch("startDate", form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(event ? eventToForm(event) : {
      title: "",
      type: defaultType,
      calendarSystem: "solar",
      startDate: dayjs(defaultDate),
      allDay: true,
      recurrence: defaultType === "anniversary" ? "yearly" : "none",
      showCountdown: defaultType === "anniversary",
      reminderDays: [7, 1],
      status: "scheduled",
      memberIds: []
    });
  }, [defaultDate, defaultType, event, form, open]);

  const submit = async (values: CalendarEventFormValues) => {
    try {
      setSaving(true);
      const input = formToInput(values);
      if (event) {
        await updateCalendarEvent(event.id, input);
      } else {
        await createCalendarEvent(input);
      }
      message.success(event ? "日程已更新" : "日程已创建");
      onSaved();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const lunarPreview = startDate && calendarSystem === "lunar"
    ? calendarLunarInfo(startDate.format("YYYY-MM-DD")).fullLabel
    : undefined;

  return (
    <Drawer
      open={open}
      size={mobile ? "100%" : 560}
      title={event ? "编辑日程" : `新增${eventTypeLabels[defaultType]}`}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => void submit(values)}
        onValuesChange={(changed) => {
          if (changed.type === "anniversary" || changed.calendarSystem === "lunar") {
            form.setFieldsValue({ recurrence: "yearly", allDay: true, showCountdown: true });
          }
        }}
      >
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Segmented
            block
            options={[
              { label: "日程", value: "schedule", icon: <CalendarOutlined /> },
              { label: "纪念日", value: "anniversary", icon: <GiftOutlined /> }
            ]}
          />
        </Form.Item>
        <Form.Item name="title" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
          <Input placeholder={type === "anniversary" ? "例如：结婚纪念日" : "例如：家庭聚餐"} />
        </Form.Item>
        <Form.Item name="calendarSystem" label="历法" rules={[{ required: true }]}>
          <Segmented block options={[
            { label: "公历", value: "solar" },
            { label: "农历", value: "lunar" }
          ]} />
        </Form.Item>
        <Form.Item
          name="startDate"
          label={calendarSystem === "lunar" ? "首次对应的公历日期" : "开始日期"}
          rules={[{ required: true, message: "请选择日期" }]}
          extra={lunarPreview}
        >
          <DatePicker inputReadOnly className="health-full-width" />
        </Form.Item>
        {type === "anniversary" ? (
          <Form.Item name="originalYear" label="起始年份">
            <InputNumber min={1900} max={2200} className="health-full-width" placeholder="用于计算第几年，可留空" />
          </Form.Item>
        ) : null}
        {type === "schedule" && calendarSystem === "solar" ? (
          <>
            <Form.Item name="allDay" valuePropName="checked">
              <Checkbox>全天日程</Checkbox>
            </Form.Item>
            {!allDay ? (
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item name="startTime" label="开始时间" rules={[{ required: true, message: "请选择开始时间" }]}>
                    <TimePicker inputReadOnly format="HH:mm" minuteStep={5} className="health-full-width" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endTime" label="结束时间">
                    <TimePicker inputReadOnly format="HH:mm" minuteStep={5} className="health-full-width" />
                  </Form.Item>
                </Col>
              </Row>
            ) : null}
            <Form.Item name="endDate" label="结束日期">
              <DatePicker inputReadOnly className="health-full-width" />
            </Form.Item>
          </>
        ) : null}
        <Row gutter={10}>
          <Col xs={24} md={12}>
            <Form.Item name="recurrence" label="重复" rules={[{ required: true }]}>
              <Select
                disabled={type === "anniversary" || calendarSystem === "lunar"}
                options={Object.entries(recurrenceLabels).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="recurrenceEndDate" label="重复结束日期">
              <DatePicker inputReadOnly className="health-full-width" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="memberIds" label="参与成员">
          <Select
            mode="multiple"
            allowClear
            options={members.map((member) => ({ label: member.name, value: member.id }))}
            placeholder="可选择一个或多个成员"
          />
        </Form.Item>
        <Form.Item name="showCountdown" valuePropName="checked">
          <Checkbox>显示倒计时</Checkbox>
        </Form.Item>
        <Form.Item name="reminderDays" label="提前提醒">
          <Select
            mode="multiple"
            allowClear
            options={[30, 14, 7, 3, 1, 0].map((value) => ({
              value,
              label: value === 0 ? "当天" : `提前${value}天`
            }))}
          />
        </Form.Item>
        <Form.Item name="location" label="地点"><Input /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
        {event ? (
          <Form.Item name="status" label="状态">
            <Select options={Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
        ) : null}
        <Button type="primary" htmlType="submit" loading={saving} icon={<ClockCircleOutlined />}>
          保存
        </Button>
      </Form>
    </Drawer>
  );
}

function formToInput(values: CalendarEventFormValues): CalendarEventInput {
  const startDate = values.startDate.format("YYYY-MM-DD");
  const lunar = values.calendarSystem === "lunar" ? calendarLunarInfo(startDate) : undefined;
  const recurringAnniversary = values.type === "anniversary" || values.calendarSystem === "lunar";
  return {
    title: values.title.trim(),
    type: values.type,
    calendarSystem: values.calendarSystem,
    startDate,
    ...(values.endDate ? { endDate: values.endDate.format("YYYY-MM-DD") } : {}),
    ...(!values.allDay && values.startTime ? { startTime: values.startTime.format("HH:mm") } : {}),
    ...(!values.allDay && values.endTime ? { endTime: values.endTime.format("HH:mm") } : {}),
    allDay: recurringAnniversary ? true : values.allDay,
    recurrence: recurringAnniversary ? "yearly" : values.recurrence,
    ...(values.recurrenceEndDate
      ? { recurrenceEndDate: values.recurrenceEndDate.format("YYYY-MM-DD") }
      : {}),
    ...(lunar ? {
      lunarMonth: lunar.month,
      lunarDay: lunar.day,
      lunarLeapMonth: lunar.leapMonth
    } : {}),
    ...(values.originalYear ? { originalYear: values.originalYear } : {}),
    showCountdown: values.showCountdown,
    reminderDays: values.reminderDays ?? [],
    location: values.location,
    note: values.note,
    status: values.status ?? "scheduled",
    memberIds: values.memberIds ?? []
  };
}

function eventToForm(event: CalendarEvent): CalendarEventFormValues {
  return {
    title: event.title,
    type: event.type,
    calendarSystem: event.calendarSystem,
    startDate: dayjs(event.startDate),
    ...(event.endDate ? { endDate: dayjs(event.endDate) } : {}),
    ...(event.startTime ? { startTime: dayjs(`2000-01-01T${event.startTime}:00`) } : {}),
    ...(event.endTime ? { endTime: dayjs(`2000-01-01T${event.endTime}:00`) } : {}),
    allDay: event.allDay,
    recurrence: event.recurrence,
    ...(event.recurrenceEndDate ? { recurrenceEndDate: dayjs(event.recurrenceEndDate) } : {}),
    ...(event.originalYear ? { originalYear: event.originalYear } : {}),
    showCountdown: event.showCountdown,
    reminderDays: event.reminderDays,
    location: event.location,
    note: event.note,
    status: event.status,
    memberIds: event.participants.map((item) => item.memberId)
  };
}

function eventToInput(
  event: CalendarEvent,
  overrides: Partial<CalendarEventInput> = {}
): CalendarEventInput {
  return {
    title: event.title,
    type: event.type,
    calendarSystem: event.calendarSystem,
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
    recurrence: event.recurrence,
    recurrenceEndDate: event.recurrenceEndDate,
    lunarMonth: event.lunarMonth,
    lunarDay: event.lunarDay,
    lunarLeapMonth: event.lunarLeapMonth,
    originalYear: event.originalYear,
    showCountdown: event.showCountdown,
    reminderDays: event.reminderDays,
    location: event.location,
    note: event.note,
    status: event.status,
    memberIds: event.participants.map((item) => item.memberId),
    ...overrides
  };
}
