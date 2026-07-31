import { describe, expect, it } from "vitest";
import type {
  BloodGlucoseRecord,
  BodyMeasurement,
  HealthFollowup,
  MedicationPlan,
  MemberHealthProfile
} from "@family-finance/shared";
import {
  buildBodySummary,
  buildExerciseSummary,
  buildGlucoseSummary,
  buildMedicationTasks,
  glucoseStatus,
  medicationDaysRemaining,
  nextScheduledFollowup,
  toMinuteIso
} from "./health";
import dayjs from "dayjs";

const profile: MemberHealthProfile = {
  memberId: "member-1",
  weightTrackingEnabled: true,
  exerciseTrackingEnabled: true,
  glucoseTrackingEnabled: true,
  hba1cTrackingEnabled: true,
  medicationTrackingEnabled: true,
  targetWeightKg: "70.00",
  weeklyExerciseMinutesGoal: 150,
  weeklyStrengthSessionsGoal: 2,
  strengthExerciseGoals: [{
    id: "push-up",
    name: "俯卧撑",
    metric: "reps",
    weeklyGoal: 60,
    maxSetGoal: 20
  }],
  dailyStepsGoal: 8000,
  glucoseIntervalDays: 7,
  glucoseLowThreshold: "3.90",
  glucoseTargets: {
    fasting: { min: 4.4, max: 7 },
    afterMeal2h: { max: 10 }
  },
  hba1cTargetMax: "7.00"
};

describe("health summaries", () => {
  it("normalizes manually entered timestamps to minute precision", () => {
    expect(toMinuteIso(dayjs("2026-07-29T08:15:47.321Z"))).toBe("2026-07-29T08:15:00.000Z");
  });

  it("compares body changes with records at least 7 and 30 days earlier", () => {
    const records: BodyMeasurement[] = [
      body("2026-06-01", "80"),
      body("2026-06-24", "78"),
      body("2026-07-01", "77")
    ];
    const summary = buildBodySummary(records, profile);
    expect(summary.change7Days).toBe(-1);
    expect(summary.change30Days).toBe(-3);
    expect(summary.targetRemaining).toBe(7);
  });

  it("compares glucose only with the previous record in the same context", () => {
    const records: BloodGlucoseRecord[] = [
      glucose("2026-07-01", "8.00", "fasting"),
      glucose("2026-07-08", "6.00", "afterMeal2h"),
      glucose("2026-07-15", "7.50", "fasting")
    ];
    const summary = buildGlucoseSummary(records, profile);
    expect(summary.previousSameContext?.glucoseMmol).toBe("8.00");
    expect(summary.difference).toBe(-0.5);
    expect(summary.dueDate).toBe("2026-07-22");
  });

  it("prioritizes the low-glucose threshold before context targets", () => {
    expect(glucoseStatus(glucose("2026-07-01", "3.50", "random"), profile)).toBe("low");
    expect(glucoseStatus(glucose("2026-07-01", "6.00", "fasting"), profile)).toBe("inRange");
    expect(glucoseStatus(glucose("2026-07-01", "8.00", "fasting"), profile)).toBe("high");
  });

  it("summarizes strength sets and matches movement goals", () => {
    const summary = buildExerciseSummary([{
      id: "exercise-1",
      memberId: "member-1",
      date: "2026-07-29T08:00:00.000Z",
      type: "力量训练",
      durationMinutes: 20,
      intensity: "moderate",
      isStrengthTraining: true,
      movements: [{
        id: "movement-1",
        name: "俯卧撑",
        metric: "reps",
        sets: [12, 10, 8],
        total: 30
      }]
    }], profile, "2026-07-29");

    expect(summary.strengthMovements[0]).toMatchObject({
      name: "俯卧撑",
      total: 30,
      maxSet: 12,
      sessions: 1,
      goal: { weeklyGoal: 60 }
    });
  });

  it("builds each scheduled medication dose and estimates remaining days", () => {
    const plan: MedicationPlan = {
      id: "med-1",
      memberId: "member-1",
      name: "测试药",
      administrationRoute: "oral",
      frequency: "daily",
      weekdays: [],
      doseUnit: "片",
      stockUnit: "片",
      doseQuantity: "1.00",
      inventoryPerDose: "1.00",
      scheduleSlots: [
        { id: "morning", label: "早餐后", time: "08:00" },
        { id: "evening", label: "晚餐后", time: "19:00" }
      ],
      startDate: "2026-07-01",
      status: "active",
      currentStock: "14.00",
      lowStockDays: 7
    };
    expect(buildMedicationTasks([plan], [], "2026-07-10")).toHaveLength(2);
    expect(medicationDaysRemaining(plan)).toBe(7);

    const weeklyPlan: MedicationPlan = {
      ...plan,
      id: "weekly-injection",
      administrationRoute: "injection",
      frequency: "weekly",
      weekdays: [5],
      doseUnit: "mg",
      stockUnit: "支",
      doseQuantity: "0.50",
      inventoryPerDose: "1.00",
      scheduleSlots: [{ id: "weekly", label: "晚间注射", time: "20:00" }],
      currentStock: "4.00"
    };
    expect(buildMedicationTasks([weeklyPlan], [], "2026-07-10")).toHaveLength(1);
    expect(buildMedicationTasks([weeklyPlan], [], "2026-07-11")).toHaveLength(0);
    expect(medicationDaysRemaining(weeklyPlan)).toBe(28);
  });

  it("prioritizes a scheduled follow-up in the selected month", () => {
    const followups = [
      followup("2026-08-10T09:00:00.000Z"),
      followup("2026-07-15T09:00:00.000Z")
    ];

    expect(
      nextScheduledFollowup(followups, "2026-07-31", "2026-07")?.scheduledAt
    ).toBe("2026-07-15T09:00:00.000Z");
  });

  it("falls back to the next future follow-up when the selected month has none", () => {
    const followups = [
      followup("2026-06-15T09:00:00.000Z"),
      followup("2026-08-10T09:00:00.000Z")
    ];

    expect(
      nextScheduledFollowup(followups, "2026-07-31", "2026-07")?.scheduledAt
    ).toBe("2026-08-10T09:00:00.000Z");
  });
});

function body(date: string, weightKg: string): BodyMeasurement {
  return {
    id: date,
    memberId: "member-1",
    measuredAt: `${date}T08:00:00.000Z`,
    weightKg,
    context: "other"
  };
}

function glucose(
  date: string,
  glucoseMmol: string,
  context: BloodGlucoseRecord["context"]
): BloodGlucoseRecord {
  return {
    id: `${date}-${context}`,
    memberId: "member-1",
    measuredAt: `${date}T08:00:00.000Z`,
    glucoseMmol,
    context,
    source: "manual"
  };
}

function followup(scheduledAt: string): HealthFollowup {
  return {
    id: scheduledAt,
    memberId: "member-1",
    scheduledAt,
    type: "常规复诊",
    tests: [],
    reminderDays: 3,
    status: "scheduled"
  };
}
