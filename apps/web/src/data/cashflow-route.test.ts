import { describe, expect, it } from "vitest";
import {
  parseCashflowFilters,
  updateCashflowFilterParams,
  writeCashflowFilters
} from "./cashflow-route";

describe("cashflow filter route params", () => {
  it("parses every supported filter from the route", () => {
    const params = new URLSearchParams(
      "month=2026-07&category=%E9%A4%90%E9%A5%AE&member=%E9%9B%84%E5%93%A5&status=confirmed&min=10.5&max=500"
    );

    expect(parseCashflowFilters(params)).toEqual({
      category: "餐饮",
      member: "雄哥",
      status: "confirmed",
      min: 10.5,
      max: 500
    });
  });

  it("ignores empty and invalid filter values", () => {
    const params = new URLSearchParams(
      "category=&member=%20%20&status=unknown&min=-1&max=not-a-number"
    );

    expect(parseCashflowFilters(params)).toEqual({});
  });

  it("writes filters while preserving the selected month", () => {
    const params = writeCashflowFilters(new URLSearchParams("month=2026-07"), {
      category: "餐饮",
      member: "雄哥",
      status: "pending",
      min: 0,
      max: 88.8
    });

    expect(params.toString()).toBe(
      "month=2026-07&category=%E9%A4%90%E9%A5%AE&member=%E9%9B%84%E5%93%A5&status=pending&min=0&max=88.8"
    );
  });

  it("removes cleared filters without changing the other filters", () => {
    const params = new URLSearchParams(
      "month=2026-07&category=%E9%A4%90%E9%A5%AE&member=%E9%9B%84%E5%93%A5&status=confirmed"
    );

    const updated = updateCashflowFilterParams(params, { category: undefined });

    expect(updated.toString()).toBe(
      "month=2026-07&member=%E9%9B%84%E5%93%A5&status=confirmed"
    );
    expect(parseCashflowFilters(updated)).toEqual({ member: "雄哥", status: "confirmed" });
  });

  it("canonicalizes invalid existing values when one filter changes", () => {
    const params = new URLSearchParams("month=2026-07&status=invalid&min=-2");

    const updated = updateCashflowFilterParams(params, { member: "瑶雯" });

    expect(updated.toString()).toBe("month=2026-07&member=%E7%91%B6%E9%9B%AF");
  });
});
