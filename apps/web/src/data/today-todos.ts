import { formatMoney, type CalendarDaySummary } from "@family-finance/shared";
import dayjs from "dayjs";

export type TodayTodoKind = "schedule" | "liability" | "medication" | "followup";

export interface TodayTodoItem {
  id: string;
  kind: TodayTodoKind;
  title: string;
  detail: string;
  count: number;
  sortKey: string;
}

export function buildTodayTodos(day?: CalendarDaySummary): TodayTodoItem[] {
  if (!day) return [];

  const todos: TodayTodoItem[] = [];
  for (const entry of day.entries) {
    if (entry.type === "schedule" && entry.event?.status === "scheduled") {
      const time = entry.event.startTime;
      todos.push({
        id: entry.id,
        kind: "schedule",
        title: entry.event.title,
        detail: [time, entry.memberName].filter(Boolean).join(" · "),
        count: 1,
        sortKey: `1-${time ?? "99:99"}-${entry.event.title}`
      });
      continue;
    }

    if (entry.type === "liability") {
      todos.push({
        id: entry.id,
        kind: "liability",
        title: `${entry.label ?? "还款"}到期`,
        detail: [entry.memberName, entry.amount ? formatMoney(entry.amount) : undefined]
          .filter(Boolean)
          .join(" · "),
        count: 1,
        sortKey: `2-${entry.label ?? "还款"}`
      });
      continue;
    }

    if (entry.type === "medication" && entry.medication?.pending) {
      todos.push({
        id: entry.id,
        kind: "medication",
        title: `${entry.memberName}待服药`,
        detail: `${entry.medication.pending} 次尚未记录`,
        count: entry.medication.pending,
        sortKey: `3-${entry.memberName}`
      });
    }
  }

  for (const followup of day.followups) {
    if (followup.status !== "scheduled") continue;
    todos.push({
      id: `followup-${followup.id}`,
      kind: "followup",
      title: `复诊 · ${followup.type}`,
      detail: [dayjs(followup.scheduledAt).format("HH:mm"), followup.memberName, followup.hospital, followup.department]
        .filter(Boolean)
        .join(" · "),
      count: 1,
      sortKey: `0-${followup.scheduledAt}-${followup.type}`
    });
  }

  return todos.sort((left, right) => left.sortKey.localeCompare(right.sortKey, "zh-CN"));
}

export function todayTodoCount(todos: TodayTodoItem[]): number {
  return todos.reduce((total, todo) => total + todo.count, 0);
}
