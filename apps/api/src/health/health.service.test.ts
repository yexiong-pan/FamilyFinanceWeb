import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { HealthService } from "./health.service";
import type { PrismaService } from "../prisma.service";

describe("HealthService", () => {
  it("keeps unspecified profile targets unchanged during a partial update", async () => {
    const upsert = vi.fn(async ({ update }: { update: object }) => ({
      memberId: "member-1",
      weightTrackingEnabled: true,
      exerciseTrackingEnabled: true,
      glucoseTrackingEnabled: true,
      hba1cTrackingEnabled: false,
      medicationTrackingEnabled: true,
      targetWeightKg: null,
      targetDate: null,
      weeklyExerciseMinutesGoal: 150,
      weeklyStrengthSessionsGoal: 2,
      dailyStepsGoal: 8000,
      glucoseIntervalDays: 7,
      glucoseLowThreshold: decimal("3.9"),
      glucoseTargets: null,
      hba1cTargetMax: null,
      update
    }));
    const service = new HealthService(mockPrisma({
      familyMember: { findFirst: vi.fn(async () => ({ id: "member-1" })) },
      memberHealthProfile: { upsert }
    }));

    await service.updateProfile("member-1", { glucoseTrackingEnabled: true });

    expect(upsert.mock.calls[0]?.[0].update).toEqual({ glucoseTrackingEnabled: true });
  });

  it("rejects a glucose target whose lower bound exceeds its upper bound", async () => {
    const service = new HealthService(mockPrisma({
      familyMember: { findFirst: vi.fn(async () => ({ id: "member-1" })) }
    }));

    await expect(service.updateProfile("member-1", {
      glucoseTargets: { fasting: { min: 8, max: 6 } }
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores and returns the body measurement context", async () => {
    const create = vi.fn(async ({ data }: { data: { context: string } }) => ({
      id: "body-1",
      memberId: "member-1",
      measuredAt: new Date("2026-07-29T00:15:00.000Z"),
      weightKg: decimal("76.5"),
      waistCm: null,
      context: data.context,
      note: null
    }));
    const service = new HealthService(mockPrisma({
      familyMember: { findFirst: vi.fn(async () => ({ id: "member-1" })) },
      bodyMeasurement: { create }
    }));

    const result = await service.createBodyMeasurement("member-1", {
      measuredAt: "2026-07-29T00:15:00.000Z",
      weightKg: "76.5",
      context: "morningFasting"
    });

    expect(create.mock.calls[0]?.[0].data.context).toBe("morningFasting");
    expect(result.context).toBe("morningFasting");
  });

  it("stores strength movements and returns calculated totals", async () => {
    const create = vi.fn(async ({ data }: {
      data: {
        movements: {
          create: Array<{
            name: string;
            metric: "reps" | "seconds";
            sets: number[];
            sortOrder: number;
          }>;
        };
      };
    }) => ({
      id: "exercise-1",
      memberId: "member-1",
      date: new Date("2026-07-29T08:00:00.000Z"),
      type: "力量训练",
      durationMinutes: 20,
      intensity: "moderate" as const,
      isStrengthTraining: true,
      steps: null,
      estimatedCalories: null,
      note: null,
      movements: data.movements.create.map((movement, index) => ({
        id: `movement-${index}`,
        ...movement,
        variant: null,
        addedWeightKg: null,
        assistanceWeightKg: null,
        note: null
      }))
    }));
    const service = new HealthService(mockPrisma({
      familyMember: { findFirst: vi.fn(async () => ({ id: "member-1" })) },
      exerciseLog: { create }
    }));

    const result = await service.createExerciseLog("member-1", {
      date: "2026-07-29T08:00:00.000Z",
      type: "力量训练",
      durationMinutes: 20,
      intensity: "moderate",
      movements: [{
        name: "俯卧撑",
        metric: "reps",
        sets: [12, 10, 8]
      }]
    });

    expect(create.mock.calls[0]?.[0].data.movements.create[0]).toMatchObject({
      name: "俯卧撑",
      sets: [12, 10, 8],
      sortOrder: 0
    });
    expect(result.isStrengthTraining).toBe(true);
    expect(result.movements[0]).toMatchObject({
      name: "俯卧撑",
      total: 30
    });
  });

  it("exports one header and one correctly shaped exercise row", async () => {
    const service = new HealthService(mockPrisma({
      familyMember: { findFirst: vi.fn(async () => ({ id: "member-1" })) },
      bodyMeasurement: { findMany: vi.fn(async () => []) },
      exerciseLog: {
        findMany: vi.fn(async () => [{
          date: new Date("2026-07-01T00:00:00.000Z"),
          type: "快走",
          durationMinutes: 30,
          steps: 4000,
          note: "饭后"
        }])
      },
      bloodGlucoseRecord: { findMany: vi.fn(async () => []) },
      hba1cRecord: { findMany: vi.fn(async () => []) },
      medicationPlan: { findMany: vi.fn(async () => []) },
      medicationDoseRecord: { findMany: vi.fn(async () => []) },
      healthFollowup: { findMany: vi.fn(async () => []) }
    }));

    const csv = await service.exportCsv("member-1", "2026-07-01", "2026-07-01");
    const lines = csv.replace("\uFEFF", "").split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("记录类型");
    expect(lines[1]).toContain("\"运动\",\"2026-07-01T00:00:00.000Z\"");
    expect(lines[1]?.split(",")).toHaveLength(8);
  });

  it("rejects a taken dose when the transaction cannot reserve inventory", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const service = new HealthService(mockMedicationPrisma(updateMany));

    await expect(service.saveMedicationDose("medication-1", {
      scheduledDate: "2026-08-04",
      slotId: "morning",
      status: "taken"
    })).rejects.toThrow("药物库存不足");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ currentStock: { gte: "1.00" } })
    }));
  });

  it("does not change inventory for a missed dose", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const service = new HealthService(mockMedicationPrisma(updateMany));

    await expect(service.saveMedicationDose("medication-1", {
      scheduledDate: "2026-08-04",
      slotId: "morning",
      status: "missed"
    })).resolves.toMatchObject({ status: "missed" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

function mockPrisma(value: object): PrismaService {
  return value as PrismaService;
}

function decimal(value: string) {
  return { toString: () => value };
}

function mockMedicationPrisma(updateMany: ReturnType<typeof vi.fn>): PrismaService {
  const plan = {
    id: "medication-1",
    familyId: "default-family",
    memberId: "member-1",
    frequency: "daily",
    weekdays: [],
    intervalDays: null,
    doseQuantity: decimal("1.00"),
    inventoryPerDose: decimal("1.00"),
    scheduleSlots: [{ id: "morning", label: "早餐后" }],
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate: null
  };
  const upsert = vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
    id: "dose-1",
    ...create
  }));
  return mockPrisma({
    medicationPlan: { findFirst: vi.fn(async () => plan) },
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      medicationDoseRecord: { findUnique: vi.fn(async () => null), upsert },
      medicationPlan: { updateMany },
      medicationInventoryEvent: { create: vi.fn(), deleteMany: vi.fn() }
    })
  });
}
