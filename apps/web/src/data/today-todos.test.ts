import type { CalendarDaySummary } from "@family-finance/shared";
import { describe, expect, it } from "vitest";
import { buildTodayTodos, todayTodoCount } from "./today-todos";

describe("today todos", () => {
  it("keeps only actionable entries and counts pending medication doses", () => {
    const todos = buildTodayTodos(day({
      entries: [
        {
          id: "schedule-1",
          type: "schedule",
          memberName: "雄哥",
          event: {
            eventId: "event-1",
            date: "2026-08-19",
            title: "家庭会议",
            type: "schedule",
            calendarSystem: "solar",
            startTime: "20:00",
            allDay: false,
            showCountdown: false,
            reminderDays: [],
            status: "scheduled",
            participants: []
          }
        },
        {
          id: "medication-1",
          type: "medication",
          memberName: "妈妈",
          medication: { scheduled: 3, taken: 1, missed: 0, paused: 0, pending: 2 }
        },
        { id: "expense-1", type: "expense", memberName: "雄哥", amount: "25.00" }
      ]
    }));

    expect(todos.map((todo) => todo.kind)).toEqual(["schedule", "medication"]);
    expect(todayTodoCount(todos)).toBe(3);
  });

  it("excludes completed schedules and completed followups", () => {
    const todos = buildTodayTodos(day({
      entries: [{
        id: "schedule-1",
        type: "schedule",
        memberName: "雄哥",
        event: {
          eventId: "event-1",
          date: "2026-08-19",
          title: "已完成日程",
          type: "schedule",
          calendarSystem: "solar",
          allDay: true,
          showCountdown: false,
          reminderDays: [],
          status: "completed",
          participants: []
        }
      }],
      followups: [{
        id: "followup-1",
        memberId: "member-1",
        memberName: "雄哥",
        scheduledAt: "2026-08-19T09:00:00.000Z",
        type: "复查",
        status: "completed"
      }]
    }));

    expect(todos).toEqual([]);
  });
});

function day(overrides: Partial<CalendarDaySummary>): CalendarDaySummary {
  return {
    date: "2026-08-19",
    income: "0.00",
    expense: "0.00",
    balance: "0.00",
    incomeCount: 0,
    expenseCount: 0,
    glucoseMeasurements: 0,
    glucoseAbnormalCount: 0,
    exerciseMinutes: 0,
    medication: { scheduled: 0, taken: 0, missed: 0, paused: 0, pending: 0 },
    followupCount: 0,
    scheduledFollowupCount: 0,
    scheduleCount: 0,
    anniversaryCount: 0,
    entries: [],
    glucoseReadings: [],
    followups: [],
    ...overrides
  };
}
