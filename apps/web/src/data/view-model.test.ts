import { describe, expect, it } from "vitest";
import type { DashboardSummary } from "@family-finance/shared";
import { buildMonthlyReportViewModel } from "./view-model";

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

describe("buildMonthlyReportViewModel", () => {
  it("shows monthly income, expense, balance, and member cashflow", () => {
    const model = buildMonthlyReportViewModel(summary);

    expect(model.cashflowMetrics).toEqual([
      { title: "本月收入", value: "¥42,000.00", tone: "income" },
      { title: "本月支出", value: "¥13,960.00", tone: "expense" },
      { title: "本月结余", value: "¥28,040.00", tone: "income" }
    ]);
    expect(model.supportingMetrics.map((item) => item.title)).toEqual([
      "家庭净资产",
      "总负债",
      "投资收益"
    ]);
    expect(model.supportingMetrics[0]?.value).toBe("¥370,000.00");
    expect(model.supportingMetrics[2]?.trend).toBe("收益率 6.06%");
    expect(model.categoryChart).toEqual([
      { type: "房贷", value: 8500 },
      { type: "育儿", value: 2400 }
    ]);
    expect(model.topCategories).toEqual([
      { name: "房贷", amount: "¥8,500.00", percent: 60.9 },
      { name: "育儿", amount: "¥2,400.00", percent: 17.2 }
    ]);
    expect(model.memberCashflow).toEqual([
      {
        memberName: "家庭共同",
        income: "¥42,000.00",
        expense: "¥13,960.00",
        balance: "¥28,040.00"
      }
    ]);
  });
});
