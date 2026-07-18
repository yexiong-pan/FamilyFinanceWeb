import { describe, expect, it } from "vitest";
import {
  buildLiabilityCoverage,
  financialMetricValue,
  snapshotComparisonRows,
  yearlySnapshotLabel
} from "./financial-status";

describe("financial status presentation", () => {
  it("shows unreviewed monthly amounts as missing instead of zero", () => {
    expect(financialMetricValue("0.00", false)).toBe("未盘点");
    expect(financialMetricValue("0.00", true)).toBe("¥0.00");
  });

  it("describes the latest yearly snapshot as an as-of value", () => {
    expect(yearlySnapshotLabel("2026-07", false)).toBe("截至7月净资产（盘点未完整）");
    expect(yearlySnapshotLabel("2026-12", true)).toBe("年末净资产");
  });

  it("reports repayment coverage separately from repayment progress", () => {
    expect(buildLiabilityCoverage([
      { initialBalance: "200000.00", currentBalance: "23241.54" },
      { currentBalance: "33470.03" },
      { currentBalance: "15181.62" },
      { currentBalance: "583.33" }
    ])).toEqual({ tracked: 1, total: 4, coveragePercent: 25, repaymentPercent: 88.4 });
  });

  it("builds comparable snapshot deltas", () => {
    expect(snapshotComparisonRows(
      { totalAssets: "120.00", totalLiabilities: "40.00", netAssets: "80.00", investmentMarketValue: "50.00" },
      { totalAssets: "100.00", totalLiabilities: "30.00", netAssets: "70.00", investmentMarketValue: "45.00" }
    )).toEqual([
      { label: "总资产", current: "120.00", compared: "100.00", change: "20.00" },
      { label: "总负债", current: "40.00", compared: "30.00", change: "10.00" },
      { label: "净资产", current: "80.00", compared: "70.00", change: "10.00" },
      { label: "投资市值", current: "50.00", compared: "45.00", change: "5.00" }
    ]);
  });
});
