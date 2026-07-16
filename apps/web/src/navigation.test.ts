import { describe, expect, it } from "vitest";
import {
  pageFromPath,
  pathForPage,
  pathForRoute,
  pageMenuItems,
  routeForMonthlyReview,
  routeFromPath,
  shiftMonthKey
} from "./navigation";

describe("page navigation paths", () => {
  it("exposes the simplified product pages including income", () => {
    expect(pageForPathPairs()).toEqual([
      ["report", "/report/monthly"],
      ["spending", "/spending/summary"],
      ["income", "/income/summary"],
      ["checkup", "/checkup/assets"],
      ["settings", "/settings"]
    ]);
  });

  it("resolves current routes and legacy routes into the simplified pages", () => {
    expect(pageFromPath("/")).toBe("report");
    expect(pageFromPath("/report")).toBe("report");
    expect(pageFromPath("/dashboard")).toBe("report");
    expect(pageFromPath("/spending")).toBe("spending");
    expect(pageFromPath("/income")).toBe("income");
    expect(pageFromPath("/transactions")).toBe("spending");
    expect(pageFromPath("/checkup")).toBe("checkup");
    expect(pageFromPath("/accounts")).toBe("checkup");
    expect(pageFromPath("/asset-history")).toBe("checkup");
    expect(pageFromPath("/liabilities")).toBe("checkup");
    expect(pageFromPath("/investments")).toBe("checkup");
    expect(pageFromPath("/budgets")).toBe("report");
    expect(pageFromPath("/settings")).toBe("settings");
  });

  it("gives every cashflow and checkup tab a canonical route", () => {
    expect(pathForRoute({ page: "report", tab: "monthly" })).toBe("/report/monthly");
    expect(pathForRoute({ page: "report", tab: "yearly" })).toBe("/report/yearly");
    expect(pathForRoute({ page: "spending", tab: "summary" })).toBe("/spending/summary");
    expect(pathForRoute({ page: "spending", tab: "details" })).toBe("/spending/details");
    expect(pathForRoute({ page: "income", tab: "summary" })).toBe("/income/summary");
    expect(pathForRoute({ page: "income", tab: "details" })).toBe("/income/details");
    expect(pathForRoute({ page: "checkup", tab: "assets" })).toBe("/checkup/assets");
    expect(pathForRoute({ page: "checkup", tab: "liabilities" })).toBe("/checkup/liabilities");
    expect(pathForRoute({ page: "checkup", tab: "investments" })).toBe("/checkup/investments");
    expect(pathForRoute({ page: "checkup", tab: "history" })).toBe("/checkup/history");

    expect(routeFromPath("/spending")).toEqual({ page: "spending", tab: "summary" });
    expect(routeFromPath("/report/yearly")).toEqual({ page: "report", tab: "yearly" });
    expect(routeFromPath("/income/details")).toEqual({ page: "income", tab: "details" });
    expect(routeFromPath("/checkup/history")).toEqual({ page: "checkup", tab: "history" });
    expect(routeFromPath("/accounts")).toEqual({ page: "checkup", tab: "assets" });
  });

  it("falls back to the monthly report for unknown paths", () => {
    expect(pageFromPath("/unknown")).toBe("report");
    expect(pageFromPath("/accounts/extra")).toBe("report");
  });

  it("routes each monthly review item to its matching detail page", () => {
    expect(routeForMonthlyReview("spending")).toEqual({ page: "spending", tab: "details" });
    expect(routeForMonthlyReview("assets")).toEqual({ page: "checkup", tab: "assets" });
    expect(routeForMonthlyReview("liabilities")).toEqual({ page: "checkup", tab: "liabilities" });
    expect(routeForMonthlyReview("investments")).toEqual({ page: "checkup", tab: "investments" });
  });

  it("moves to adjacent months across year boundaries", () => {
    expect(shiftMonthKey("2026-07", -1)).toBe("2026-06");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });
});

function pageForPathPairs() {
  return pageMenuItems.map((item) => [item.key, pathForPage(item.key)]);
}
