import { describe, expect, it } from "vitest";
import { buildAssetInsights, buildInvestmentInsights, buildLiabilityRisk } from "./financial-insights";

describe("financial checkup insights", () => {
  it("estimates liquid assets and reports the latest balance update", () => {
    expect(buildAssetInsights([
      { type: "银行卡", currentValue: "8000.00", updatedAt: "2026-07-17T08:00:00.000Z" },
      { type: "基金", currentValue: "2000.00", updatedAt: "2026-07-16T08:00:00.000Z" }
    ])).toEqual({ liquidAmount: 8000, liquidPercent: 80, latestUpdatedAt: "2026-07-17T08:00:00.000Z" });
  });

  it("calculates investment allocation and concentration", () => {
    const result = buildInvestmentInsights([
      { type: "fund", marketValue: "700.00" },
      { type: "stock", marketValue: "200.00" },
      { type: "fund", marketValue: "100.00" }
    ]);
    expect(result.allocation).toEqual([
      { type: "基金", value: 800, percent: 80 },
      { type: "股票", value: 200, percent: 20 }
    ]);
    expect(result.topHoldingPercent).toBe(70);
  });

  it("calculates debt service pressure and estimated payoff months", () => {
    expect(buildLiabilityRisk([
      { name: "贷款", currentBalance: "12000.00", monthlyPayment: "1000.00" }
    ], "10000.00")).toEqual({
      monthlyPayment: 1000,
      debtServiceRate: 10,
      trackable: 1,
      payoffMonths: 12
    });
  });
});
