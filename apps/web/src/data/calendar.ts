import type {
  CalendarDayEntry,
  CalendarDayEntryType,
  CalendarMedicationSummary
} from "@family-finance/shared";

export type CalendarSignalTone = "positive" | "danger" | "warning" | "info" | "neutral";

export interface CalendarDaySignal {
  type: CalendarDayEntryType;
  value: string;
  label: string;
  tone: CalendarSignalTone;
  warning: boolean;
}

export type MobileCalendarDensity = "compact" | "detail";

const SIGNAL_PRIORITY: CalendarDayEntryType[] = [
  "anniversary",
  "schedule",
  "followup",
  "liability",
  "expense",
  "income",
  "glucose",
  "medication",
  "exercise",
  "weight"
];

export function buildCalendarDaySignals(
  entries: CalendarDayEntry[],
  date: string,
  today: string
): CalendarDaySignal[] {
  const entriesByType = new Map<CalendarDayEntryType, CalendarDayEntry[]>();
  for (const entry of entries) {
    const items = entriesByType.get(entry.type) ?? [];
    items.push(entry);
    entriesByType.set(entry.type, items);
  }

  return SIGNAL_PRIORITY.flatMap((type) => {
    const items = entriesByType.get(type);
    if (!items?.length) return [];
    return [signalForType(type, items, date, today)];
  }).sort((left, right) => Number(right.warning) - Number(left.warning));
}

export function resolvePinchCalendarDensity(
  startDistance: number,
  currentDistance: number,
  currentDensity: MobileCalendarDensity,
  threshold = 28
): MobileCalendarDensity {
  const distanceChange = currentDistance - startDistance;
  if (distanceChange >= threshold) return "detail";
  if (distanceChange <= -threshold) return "compact";
  return currentDensity;
}

function signalForType(
  type: CalendarDayEntryType,
  entries: CalendarDayEntry[],
  date: string,
  today: string
): CalendarDaySignal {
  if (type === "schedule" || type === "anniversary") {
    const first = entries[0]?.event;
    const countdown = first?.countdownDays;
    const value = entries.length > 1
      ? `${entries.length}项`
      : countdown === 0
        ? "今天"
        : countdown !== undefined && countdown > 0
          ? `${countdown}天`
          : "1项";
    return {
      type,
      value,
      label: `${type === "anniversary" ? "纪念日" : "日程"} ${first?.title ?? value}`,
      tone: type === "anniversary" ? "warning" : "info",
      warning: false
    };
  }

  if (type === "income" || type === "expense") {
    const amount = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    const value = compactSignalMoney(amount);
    return {
      type,
      value,
      label: `${type === "income" ? "收入" : "支出"} ${value}`,
      tone: type === "income" ? "positive" : "danger",
      warning: false
    };
  }

  if (type === "liability") {
    const amount = entries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
    const value = compactSignalMoney(amount);
    return {
      type,
      value,
      label: `待还 ${value}`,
      tone: "warning",
      warning: date < today
    };
  }

  if (type === "glucose") {
    const abnormal = entries.some((entry) => entry.abnormal);
    const value = entries.length === 1
      ? trimNumber(entries[0]?.value)
      : `${entries.length}次`;
    return {
      type,
      value,
      label: `血糖 ${value}${abnormal ? "，存在异常" : ""}`,
      tone: abnormal ? "danger" : "info",
      warning: abnormal
    };
  }

  if (type === "exercise") {
    const minutes = entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
    const value = entries.length === 1 ? `${minutes}分` : `${entries.length}项`;
    return {
      type,
      value,
      label: `运动 ${value}`,
      tone: "info",
      warning: false
    };
  }

  if (type === "weight") {
    const value = entries.length === 1
      ? trimNumber(entries[0]?.value)
      : `${entries.length}次`;
    return {
      type,
      value,
      label: `体重 ${value}${entries.length === 1 ? "公斤" : ""}`,
      tone: "warning",
      warning: false
    };
  }

  if (type === "followup") {
    const value = `${entries.length}项`;
    return {
      type,
      value,
      label: `复诊 ${value}`,
      tone: "warning",
      warning: date <= today
    };
  }

  const medication = entries.reduce<CalendarMedicationSummary>(
    (summary, entry) => ({
      scheduled: summary.scheduled + (entry.medication?.scheduled ?? 0),
      taken: summary.taken + (entry.medication?.taken ?? 0),
      missed: summary.missed + (entry.medication?.missed ?? 0),
      paused: summary.paused + (entry.medication?.paused ?? 0),
      pending: summary.pending + (entry.medication?.pending ?? 0)
    }),
    { scheduled: 0, taken: 0, missed: 0, paused: 0, pending: 0 }
  );
  const value = `${medication.taken}/${medication.scheduled}`;
  const completed = medication.scheduled > 0
    && medication.missed === 0
    && medication.pending === 0
    && medication.taken + medication.paused >= medication.scheduled;
  const overdue = medication.missed > 0
    || (date < today && medication.pending > 0);

  return {
    type,
    value,
    label: `用药 ${value}${medication.missed ? `，漏服${medication.missed}次` : ""}`,
    tone: overdue ? "danger" : completed ? "positive" : "warning",
    warning: overdue
  };
}

function compactSignalMoney(amount: number): string {
  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (absolute >= 10000) {
    return `${sign}¥${(absolute / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  }
  if (absolute >= 1000) {
    return `${sign}¥${(absolute / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${sign}¥${Math.round(absolute)}`;
}

function trimNumber(value?: string): string {
  if (value === undefined) return "--";
  return String(Number(value));
}
