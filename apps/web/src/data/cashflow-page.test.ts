import { describe, expect, it } from "vitest";
import { buildTransactionPageQuery, countActiveCashflowFilters } from "./cashflow-page";

describe("cashflow detail paging", () => {
  it("serializes route filters into the server paging request", () => {
    expect(buildTransactionPageQuery({
      month: "2026-06",
      kind: "expense",
      page: 2,
      pageSize: 20,
      filters: { category: "餐饮", member: "雄哥", status: "pending", min: 10, max: 500 }
    })).toBe("month=2026-06&kind=expense&page=2&pageSize=20&category=%E9%A4%90%E9%A5%AE&member=%E9%9B%84%E5%93%A5&status=pending&min=10&max=500");
  });

  it("counts only filters that constrain results", () => {
    expect(countActiveCashflowFilters({ category: "餐饮", status: "confirmed" })).toBe(2);
    expect(countActiveCashflowFilters({})).toBe(0);
  });
});
