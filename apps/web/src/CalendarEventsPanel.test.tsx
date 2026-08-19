// @vitest-environment jsdom

import { App as AntApp } from "antd";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarEventsPanel } from "./CalendarEventsPanel";
import { getCalendarEvents } from "./api/client";

vi.mock("./api/client", () => ({
  createCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  getCalendarEvents: vi.fn().mockResolvedValue([]),
  updateCalendarEvent: vi.fn()
}));

describe("CalendarEventsPanel", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("loads only scheduled events by default", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AntApp>
          <CalendarEventsPanel
            members={[]}
            memberId="all"
            monthKey="2026-08"
            mobile={false}
            onChanged={vi.fn()}
          />
        </AntApp>
      );
    });

    expect(getCalendarEvents).toHaveBeenCalledWith("all", undefined, "scheduled");

    await act(async () => root.unmount());
  });
});
