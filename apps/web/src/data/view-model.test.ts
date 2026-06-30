import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@family-finance/shared";
import { buildDashboardViewModel } from "./view-model";

const summary: DashboardSummary = {
  totalAssets: "490000.00",
  totalLiabilities: "120000.00",
  netAssets: "370000.00",
  monthlyExpense: "13960.00",
  monthlyIncome: "42000.00",
  monthlyBalance: "28040.00",
  monthlyDebtPayment: "8000.00",
  investmentMarketValue: "350000.00",
  investmentCost: "330000.00",
  investmentProfit: "20000.00",
  investmentProfitRate: 0.0606,
  categoryBreakdown: [
    { categoryName: "房贷", amount: "8500.00" },
    { categoryName: "育儿", amount: "2400.00" }
  ],
  liabilityBreakdown: [{ type: "mortgage", amount: "120000.00" }],
  memberBreakdown: [{ memberName: "家庭共同", income: "42000.00", expense: "13960.00" }],
  budgetUsages: [
    {
      id: "budget-1",
      month: "2026-06",
      categoryName: "房贷",
      limitAmount: "8500.00",
      spentAmount: "8500.00",
      usageRate: 1,
      status: "over"
    }
  ]
};

describe("buildDashboardViewModel", () => {
  it("formats metric cards and chart rows for Ant Design dashboard components", () => {
    const model = buildDashboardViewModel(summary);

    expect(model.metrics.map((item) => item.title)).toEqual([
      "当前总资产",
      "净资产",
      "本月应还",
      "本月收入",
      "本月支出",
      "本月结余",
      "投资收益"
    ]);
    expect(model.metrics[0]?.value).toBe("¥490,000.00");
    expect(model.metrics[1]?.value).toBe("¥370,000.00");
    expect(model.metrics[6]?.trend).toBe("收益率 6.06%");
    expect(model.metrics.map((item) => item.tone)).toEqual([
      "asset",
      "asset",
      "expense",
      "income",
      "expense",
      "income",
      "income"
    ]);
    expect(model.categoryChart).toEqual([
      { type: "房贷", value: 8500 },
      { type: "育儿", value: 2400 }
    ]);
    expect(model.budgetHighlights[0]?.percent).toBe(100);
  });
});
