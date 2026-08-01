import type { CalendarDayEntry } from "@family-finance/shared";
import { describe, expect, it } from "vitest";
import {
  buildCalendarDaySignals,
  resolvePinchCalendarDensity
} from "./calendar";

describe("buildCalendarDaySignals", () => {
  it("aggregates finance and exercise entries into compact signals", () => {
    const entries: CalendarDayEntry[] = [
      { id: "expense-1", type: "expense", memberName: "雄哥", amount: "120.50" },
      { id: "expense-2", type: "expense", memberName: "瑶雯", amount: "80.00" },
      { id: "exercise-1", type: "exercise", memberName: "雄哥", minutes: 60 },
      { id: "exercise-2", type: "exercise", memberName: "瑶雯", minutes: 60 }
    ];

    expect(buildCalendarDaySignals(entries, "2026-07-26", "2026-07-30")).toEqual([
      expect.objectContaining({ type: "expense", value: "¥201" }),
      expect.objectContaining({ type: "exercise", value: "2项" })
    ]);
  });

  it("shows medication taken versus scheduled and highlights overdue doses", () => {
    const entries: CalendarDayEntry[] = [{
      id: "medication-1",
      type: "medication",
      memberName: "雄哥",
      medication: {
        scheduled: 3,
        taken: 1,
        missed: 0,
        paused: 0,
        pending: 2
      }
    }];

    expect(buildCalendarDaySignals(entries, "2026-07-22", "2026-07-30")).toEqual([
      expect.objectContaining({
        type: "medication",
        value: "1/3",
        tone: "danger",
        warning: true
      })
    ]);
  });

  it("shows the measurement value for a single weight record", () => {
    const entries: CalendarDayEntry[] = [{
      id: "weight-1",
      type: "weight",
      memberName: "雄哥",
      value: "89.30"
    }];

    expect(buildCalendarDaySignals(entries, "2026-07-29", "2026-07-30")).toEqual([
      expect.objectContaining({ type: "weight", value: "89.3" })
    ]);
  });

  it("aggregates pending repayments into a warning signal", () => {
    const entries: CalendarDayEntry[] = [{
      id: "liability-1",
      type: "liability",
      memberName: "雄哥",
      amount: "1200.00",
      label: "信用卡分期"
    }];

    expect(buildCalendarDaySignals(entries, "2026-07-15", "2026-07-30")).toEqual([
      expect.objectContaining({ type: "liability", value: "¥1.2k", tone: "warning" })
    ]);
  });
});

describe("resolvePinchCalendarDensity", () => {
  it("switches between compact and detail after the pinch threshold", () => {
    expect(resolvePinchCalendarDensity(100, 140, "compact")).toBe("detail");
    expect(resolvePinchCalendarDensity(140, 100, "detail")).toBe("compact");
  });

  it("keeps the current density for small finger movement", () => {
    expect(resolvePinchCalendarDensity(100, 115, "compact")).toBe("compact");
    expect(resolvePinchCalendarDensity(100, 85, "detail")).toBe("detail");
  });
});
