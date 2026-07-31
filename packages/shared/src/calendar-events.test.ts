import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "./calendar.js";
import {
  buildCalendarEventOccurrences,
  calendarLunarInfo
} from "./calendar-events.js";

describe("calendar event occurrences", () => {
  it("keeps solar yearly events on the last available day", () => {
    expect(buildCalendarEventOccurrences(
      event({ startDate: "2024-02-29", recurrence: "yearly" }),
      "2026-01-01",
      "2026-12-31",
      "2026-01-01"
    )[0]?.date).toBe("2026-02-28");
  });

  it("converts lunar annual events into the selected solar year", () => {
    const occurrences = buildCalendarEventOccurrences(
      event({
        calendarSystem: "lunar",
        startDate: "2020-10-01",
        recurrence: "yearly",
        lunarMonth: 8,
        lunarDay: 15
      }),
      "2026-01-01",
      "2026-12-31",
      "2026-01-01"
    );
    expect(occurrences).toEqual([
      expect.objectContaining({ date: "2026-09-25", lunarLabel: "农历八月十五" })
    ]);
  });

  it("returns a compact lunar label for each solar date", () => {
    expect(calendarLunarInfo("2026-09-25")).toMatchObject({
      month: 8,
      day: 15,
      shortLabel: "中秋节"
    });
  });
});

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "event-1",
    title: "纪念日",
    type: "anniversary",
    calendarSystem: "solar",
    startDate: "2026-01-01",
    allDay: true,
    recurrence: "none",
    lunarLeapMonth: false,
    showCountdown: true,
    reminderDays: [7, 1],
    status: "scheduled",
    participants: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
