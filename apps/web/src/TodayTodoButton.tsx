import {
  CalendarOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  MedicineBoxOutlined,
  RightOutlined,
  ScheduleOutlined
} from "@ant-design/icons";
import type { CalendarDaySummary } from "@family-finance/shared";
import { Button, Empty, Popover, Spin, Typography } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCalendarData } from "./api/client";
import {
  buildTodayTodos,
  todayTodoCount,
  type TodayTodoKind
} from "./data/today-todos";

const { Text } = Typography;

export function TodayTodoButton({
  refreshKey,
  onOpenCalendar
}: {
  refreshKey: number;
  onOpenCalendar(): void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<CalendarDaySummary>();
  const today = dayjs().format("YYYY-MM-DD");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCalendarData("month", today.slice(0, 7));
      setDay(data.days.find((candidate) => candidate.date === today));
    } catch {
      setDay(undefined);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const todos = useMemo(() => buildTodayTodos(day), [day]);
  const count = todayTodoCount(todos);
  const content = (
    <div className="today-todo-popover">
      <div className="today-todo-heading">
        <div>
          <strong>今日待办</strong>
          <div>
            <Text type="secondary">
              {dayjs(today).format("M月D日")} 周{"日一二三四五六"[dayjs(today).day()]}
            </Text>
          </div>
        </div>
        <span className={`today-todo-summary-count ${count ? "has-items" : ""}`}>{count} 项</span>
      </div>
      <Spin spinning={loading} size="small">
        {todos.length ? (
          <div className="today-todo-list">
            {todos.map((todo) => (
              <div className="today-todo-item" key={todo.id}>
                <span className={`today-todo-item-icon is-${todo.kind}`} aria-hidden="true">
                  {todayTodoIcon(todo.kind)}
                </span>
                <div className="today-todo-item-copy">
                  <strong>{todo.title}</strong>
                  <Text type="secondary">{todo.detail}</Text>
                </div>
                {todo.count > 1 ? <span className="today-todo-item-count">×{todo.count}</span> : null}
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="today-todo-loading-space" />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="今日无待办" />
        )}
      </Spin>
      <Button
        type="text"
        block
        className="today-todo-calendar-link"
        onClick={() => {
          setOpen(false);
          onOpenCalendar();
        }}
      >
        查看今日日历 <RightOutlined />
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void load();
      }}
    >
      <Button
        className={`today-todo-trigger ${count ? "has-items" : "is-empty"}`}
        icon={<CheckCircleOutlined />}
        aria-label={`今日待办，${count}项`}
      >
        <span className="today-todo-label">今日待办</span>
        <span className="today-todo-count">{count}</span>
      </Button>
    </Popover>
  );
}

function todayTodoIcon(kind: TodayTodoKind): ReactNode {
  if (kind === "liability") return <CreditCardOutlined />;
  if (kind === "medication") return <MedicineBoxOutlined />;
  if (kind === "followup") return <ScheduleOutlined />;
  return <CalendarOutlined />;
}
