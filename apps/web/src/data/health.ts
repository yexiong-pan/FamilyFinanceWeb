import type {
  BloodGlucoseRecord,
  BodyMeasurementContext,
  BodyMeasurement,
  ExerciseLog,
  HealthFollowup,
  GlucoseContext,
  MedicationDoseRecord,
  MedicationPlan,
  MedicationScheduleSlot,
  MemberHealthProfile
} from "@family-finance/shared";
import dayjs, { type Dayjs } from "dayjs";

export function toMinuteIso(value: Dayjs): string {
  return value.second(0).millisecond(0).toISOString();
}

export const glucoseContextLabels: Record<GlucoseContext, string> = {
  fasting: "空腹",
  beforeMeal: "餐前",
  afterMeal1h: "餐后1小时",
  afterMeal2h: "餐后2小时",
  bedtime: "睡前",
  random: "随机"
};

export const bodyMeasurementContextLabels: Record<BodyMeasurementContext, string> = {
  morningFasting: "晨起空腹",
  other: "其他时间"
};

export const exerciseIntensityLabels = {
  low: "低强度",
  moderate: "中等强度",
  high: "高强度"
} as const;

export const medicationDoseStatusLabels = {
  taken: "已服",
  missed: "漏服",
  paused: "遵医嘱暂停"
} as const;

export const followupStatusLabels = {
  scheduled: "待进行",
  completed: "已完成",
  cancelled: "已取消"
} as const;

export function buildBodySummary(records: BodyMeasurement[], profile: MemberHealthProfile) {
  const latest = records.at(-1);
  if (!latest) {
    return { latest: undefined, average7Days: undefined, change7Days: undefined, change30Days: undefined };
  }
  const latestDate = dayjs(latest.measuredAt);
  const recent7 = records.filter((record) => (
    latestDate.diff(dayjs(record.measuredAt), "day", true) <= 7
  ));
  return {
    latest,
    average7Days: average(recent7.map((record) => Number(record.weightKg))),
    change7Days: changeFrom(records, latest, 7),
    change30Days: changeFrom(records, latest, 30),
    targetRemaining: profile.targetWeightKg === undefined
      ? undefined
      : Number(latest.weightKg) - Number(profile.targetWeightKg)
  };
}

export function buildExerciseSummary(logs: ExerciseLog[], profile: MemberHealthProfile, referenceDate: string) {
  const reference = dayjs(referenceDate);
  const weekStart = reference.startOf("week").add(1, "day");
  const normalizedWeekStart = reference.day() === 0 ? weekStart.subtract(7, "day") : weekStart;
  const weekLogs = logs.filter((log) => {
    const date = dayjs(log.date);
    return !date.isBefore(normalizedWeekStart, "day") && !date.isAfter(reference, "day");
  });
  const stepLogs = weekLogs.filter((log) => log.steps !== undefined);
  const minutes = sum(weekLogs.map((log) => log.durationMinutes));
  const strengthSessions = weekLogs.filter((log) => log.isStrengthTraining).length;
  return {
    minutes,
    strengthSessions,
    averageSteps: stepLogs.length ? Math.round(sum(stepLogs.map((log) => log.steps ?? 0)) / stepLogs.length) : undefined,
    minutesPercent: ratio(minutes, profile.weeklyExerciseMinutesGoal),
    strengthPercent: ratio(strengthSessions, profile.weeklyStrengthSessionsGoal)
  };
}

export type GlucoseStatus = "low" | "inRange" | "high" | "unconfigured";

export function glucoseStatus(
  record: BloodGlucoseRecord,
  profile: MemberHealthProfile
): GlucoseStatus {
  const value = Number(record.glucoseMmol);
  if (value < Number(profile.glucoseLowThreshold)) return "low";
  const range = record.context === "fasting"
    ? profile.glucoseTargets.fasting
    : record.context === "beforeMeal"
      ? profile.glucoseTargets.beforeMeal
      : record.context === "afterMeal2h"
        ? profile.glucoseTargets.afterMeal2h
        : undefined;
  if (!range || (range.min === undefined && range.max === undefined)) return "unconfigured";
  if (range.min !== undefined && value < range.min) return "low";
  if (range.max !== undefined && value > range.max) return "high";
  return "inRange";
}

export function buildGlucoseSummary(
  records: BloodGlucoseRecord[],
  profile: MemberHealthProfile
) {
  const latest = records.at(-1);
  if (!latest) return { latest: undefined, previousSameContext: undefined, difference: undefined };
  const sameContext = records.filter((record) => record.context === latest.context);
  const previousSameContext = sameContext.at(-2);
  const statuses = sameContext.slice(-3).map((record) => glucoseStatus(record, profile));
  return {
    latest,
    previousSameContext,
    difference: previousSameContext
      ? Number(latest.glucoseMmol) - Number(previousSameContext.glucoseMmol)
      : undefined,
    status: glucoseStatus(latest, profile),
    dueDate: dayjs(latest.measuredAt).add(profile.glucoseIntervalDays, "day").format("YYYY-MM-DD"),
    repeatedOutOfRange: statuses.length >= 2
      && statuses.slice(-2).every((status) => status === "low" || status === "high")
  };
}

export interface MedicationTask {
  key: string;
  plan: MedicationPlan;
  slot: MedicationScheduleSlot;
  record?: MedicationDoseRecord;
}

export function buildMedicationTasks(
  plans: MedicationPlan[],
  records: MedicationDoseRecord[],
  date: string
): MedicationTask[] {
  return plans
    .filter((plan) => (
      plan.status === "active"
      && plan.startDate <= date
      && (!plan.endDate || plan.endDate >= date)
    ))
    .flatMap((plan) => plan.scheduleSlots.map((slot) => ({
      key: `${plan.id}-${date}-${slot.id}`,
      plan,
      slot,
      record: records.find((record) => (
        record.medicationId === plan.id
        && record.scheduledDate === date
        && record.slotId === slot.id
      ))
    })))
    .sort((left, right) => (left.slot.time ?? left.slot.label).localeCompare(right.slot.time ?? right.slot.label));
}

export function medicationDaysRemaining(plan: MedicationPlan): number | undefined {
  const dailyUse = Number(plan.doseQuantity) * plan.scheduleSlots.length;
  if (dailyUse <= 0) return undefined;
  return Math.max(0, Math.floor(Number(plan.currentStock) / dailyUse));
}

export function isMedicationLowStock(plan: MedicationPlan): boolean {
  const days = medicationDaysRemaining(plan);
  return days !== undefined && days <= plan.lowStockDays;
}

export function nextScheduledFollowup(followups: HealthFollowup[], referenceDate: string) {
  return followups.find((followup) => (
    followup.status === "scheduled" && dayjs(followup.scheduledAt).isAfter(dayjs(referenceDate).startOf("day"))
  ));
}

function changeFrom(records: BodyMeasurement[], latest: BodyMeasurement, days: number): number | undefined {
  const threshold = dayjs(latest.measuredAt).subtract(days, "day");
  const baseline = [...records].reverse().find((record) => !dayjs(record.measuredAt).isAfter(threshold));
  return baseline ? Number(latest.weightKg) - Number(baseline.weightKg) : undefined;
}

function average(values: number[]): number | undefined {
  return values.length ? sum(values) / values.length : undefined;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(value: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
}
