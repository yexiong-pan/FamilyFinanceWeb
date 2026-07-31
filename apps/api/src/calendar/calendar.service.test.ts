import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma.service";
import { CalendarService } from "./calendar.service";

describe("CalendarService", () => {
  it("combines finance, glucose, medication and follow-up data by day", async () => {
    const service = new CalendarService(mockPrisma({
      familyMember: {
        findMany: vi.fn(async () => [{ id: "member-1", name: "雄哥" }])
      },
      financeTransaction: {
        findMany: vi.fn(async () => [
          transaction("2026-07-03", "income", "1000"),
          transaction("2026-07-03", "expense", "120.5")
        ])
      },
      memberHealthProfile: {
        findMany: vi.fn(async () => [{
          memberId: "member-1",
          glucoseLowThreshold: decimal("3.9"),
          glucoseTargets: { fasting: { min: 4.4, max: 7 } }
        }])
      },
      bodyMeasurement: {
        findMany: vi.fn(async () => [{
          memberId: "member-1",
          measuredAt: new Date("2026-07-20T08:00:00.000Z"),
          weightKg: decimal("76.5")
        }])
      },
      bloodGlucoseRecord: {
        findMany: vi.fn(async () => [{
          id: "glucose-1",
          memberId: "member-1",
          measuredAt: new Date("2026-06-30T22:30:00.000Z"),
          glucoseMmol: decimal("8.2"),
          context: "fasting"
        }])
      },
      exerciseLog: {
        findMany: vi.fn(async () => [{
          memberId: "member-1",
          date: date("2026-07-03"),
          type: "力量训练",
          durationMinutes: 30,
          movements: [{
            name: "俯卧撑",
            metric: "reps",
            sets: [12, 10, 8]
          }]
        }])
      },
      medicationPlan: {
        findMany: vi.fn(async () => [{
          id: "medication-1",
          memberId: "member-1",
          scheduleSlots: [{ id: "morning", label: "早餐后" }],
          startDate: date("2026-07-01"),
          endDate: date("2026-07-02"),
          frequency: "daily",
          weekdays: [],
          intervalDays: null,
          status: "active"
        }])
      },
      medicationDoseRecord: {
        findMany: vi.fn(async () => [{
          memberId: "member-1",
          scheduledDate: date("2026-07-01"),
          status: "taken"
        }])
      },
      healthFollowup: {
        findMany: vi.fn(async () => [{
          id: "followup-1",
          memberId: "member-1",
          scheduledAt: date("2026-07-03"),
          type: "糖尿病复诊",
          status: "scheduled",
          hospital: "社区医院",
          department: "内分泌科"
        }]),
        findFirst: vi.fn(async () => ({
          id: "followup-next",
          memberId: "member-1",
          scheduledAt: date("2026-08-08"),
          type: "糖尿病复诊",
          status: "scheduled",
          hospital: "社区医院",
          department: "内分泌科"
        }))
      },
      calendarEvent: {
        findMany: vi.fn(async () => [{
          id: "event-1",
          familyId: "default-family",
          title: "家庭聚餐",
          type: "schedule",
          calendarSystem: "solar",
          startDate: date("2026-07-03"),
          endDate: null,
          startTime: "18:30",
          endTime: null,
          allDay: false,
          recurrence: "none",
          recurrenceEndDate: null,
          lunarMonth: null,
          lunarDay: null,
          lunarLeapMonth: false,
          originalYear: null,
          showCountdown: true,
          reminderDays: [1],
          location: "家里",
          note: null,
          status: "scheduled",
          participants: [{
            member: { id: "member-1", name: "雄哥" }
          }],
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
          updatedAt: new Date("2026-07-01T00:00:00.000Z")
        }])
      }
    }));

    const result = await service.getCalendar("month", "2026-07", "member-1");
    const financeDay = result.days.find((day) => day.date === "2026-07-03");
    const glucoseDay = result.days.find((day) => day.date === "2026-07-01");
    const weightDay = result.days.find((day) => day.date === "2026-07-20");

    expect(result.summary).toMatchObject({
      income: "1000.00",
      expense: "120.50",
      balance: "879.50",
      glucoseMeasurements: 1,
      glucoseAbnormalCount: 1,
      exerciseMinutes: 30,
      followupCount: 1,
      scheduledFollowupCount: 1,
      scheduleCount: 1,
      anniversaryCount: 0,
      medication: {
        scheduled: 2,
        taken: 1,
        pending: 1,
        completionRate: 50
      }
    });
    expect(result.exerciseByMember).toEqual([{
      memberId: "member-1",
      memberName: "雄哥",
      minutes: 30,
      activities: [{ type: "力量训练", minutes: 30 }]
    }]);
    expect(result.latestWeightByMember).toEqual([{
      memberId: "member-1",
      memberName: "雄哥",
      measuredAt: "2026-07-20T08:00:00.000Z",
      weightKg: "76.50"
    }]);
    expect(result.latestGlucoseByMember).toEqual([{
      memberId: "member-1",
      memberName: "雄哥",
      measuredAt: "2026-06-30T22:30:00.000Z",
      value: "8.20",
      context: "fasting",
      status: "high",
      targetMin: "4.4",
      targetMax: "7"
    }]);
    expect(financeDay?.income).toBe("1000.00");
    expect(financeDay?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "income",
        memberName: "雄哥",
        amount: "1000.00"
      }),
      expect.objectContaining({
        type: "expense",
        memberName: "雄哥",
        amount: "120.50"
      }),
      expect.objectContaining({
        type: "exercise",
        memberName: "雄哥",
        label: "力量训练",
        minutes: 30,
        detail: "俯卧撑30次"
      }),
      expect.objectContaining({
        type: "followup",
        memberName: "雄哥",
        label: "糖尿病复诊"
      }),
      expect.objectContaining({
        type: "schedule",
        memberName: "雄哥",
        label: "家庭聚餐",
        event: expect.objectContaining({
          startTime: "18:30",
          location: "家里"
        })
      })
    ]));
    expect(glucoseDay?.glucoseReadings[0]).toMatchObject({
      memberName: "雄哥",
      value: "8.20",
      abnormal: true
    });
    expect(glucoseDay?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "glucose",
        memberName: "雄哥",
        value: "8.20",
        abnormal: true
      }),
      expect.objectContaining({
        type: "medication",
        memberName: "雄哥",
        medication: expect.objectContaining({
          scheduled: 1,
          taken: 1
        })
      })
    ]));
    expect(weightDay?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "weight",
        memberName: "雄哥",
        value: "76.50"
      })
    ]));
    expect(financeDay?.followups[0]?.department).toBe("内分泌科");
    expect(result.upcomingFollowup).toMatchObject({
      id: "followup-next",
      memberName: "雄哥",
      scheduledAt: "2026-08-08T00:00:00.000Z"
    });
  });

  it("calculates each month's expense change from the preceding month", async () => {
    const service = new CalendarService(mockPrisma({
      familyMember: {
        findMany: vi.fn(async () => [{ id: "member-1", name: "雄哥" }])
      },
      financeTransaction: {
        findMany: vi.fn(async () => [
          transaction("2025-12-10", "expense", "100"),
          transaction("2026-01-10", "expense", "200"),
          transaction("2026-02-10", "expense", "100")
        ])
      },
      memberHealthProfile: { findMany: vi.fn(async () => []) },
      bodyMeasurement: { findMany: vi.fn(async () => []) },
      bloodGlucoseRecord: { findMany: vi.fn(async () => []) },
      exerciseLog: { findMany: vi.fn(async () => []) },
      medicationPlan: { findMany: vi.fn(async () => []) },
      medicationDoseRecord: { findMany: vi.fn(async () => []) },
      healthFollowup: {
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => undefined)
      }
    }));

    const result = await service.getCalendar("year", "2026", "all");

    expect(result.months).toHaveLength(12);
    expect(result.months[0]?.expenseChangeRate).toBe(100);
    expect(result.months[1]?.expenseChangeRate).toBe(-50);
    expect(result.summary.expense).toBe("300.00");
  });

  it("rejects a period that does not match the selected view", async () => {
    const service = new CalendarService(mockPrisma({}));
    await expect(service.getCalendar("month", "2026", "all")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

function mockPrisma(value: object): PrismaService {
  return {
    calendarEvent: {
      findMany: vi.fn(async () => [])
    },
    ...value
  } as unknown as PrismaService;
}

function transaction(day: string, kind: "income" | "expense", amount: string) {
  return {
    date: date(day),
    kind,
    amount: decimal(amount),
    memberName: "雄哥"
  };
}

function date(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function decimal(value: string) {
  return { toString: () => value };
}
