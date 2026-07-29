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
});

function mockPrisma(value: object): PrismaService {
  return value as PrismaService;
}

function decimal(value: string) {
  return { toString: () => value };
}
