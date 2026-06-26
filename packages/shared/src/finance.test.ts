import { describe, expect, it } from "vitest";
import {
  calculateBudgetUsages,
  calculateDashboardSummary,
  formatMoney,
  type Account,
  type Budget,
  type FinanceTransaction,
  type InvestmentHolding
} from "./index";

const accounts: Account[] = [
  {
    id: "acc-bank",
    name: "招商银行卡",
    type: "bankCard",
    ownerName: "家庭共同",
    currentValue: "128000",
    note: "日常资金"
  },
  {
    id: "acc-fund",
    name: "支付宝基金",
    type: "fund",
    ownerName: "家庭共同",
    currentValue: "86000",
    note: "长期投资"
  }
];

const transactions: FinanceTransaction[] = [
  {
    id: "tx-expense-1",
    date: "2026-06-02",
    kind: "expense",
    categoryName: "餐饮",
    accountId: "acc-bank",
    memberName: "妻子",
    amount: "860.50",
    note: "家庭聚餐"
  },
  {
    id: "tx-expense-2",
    date: "2026-06-08",
    kind: "expense",
    categoryName: "育儿",
    accountId: "acc-bank",
    memberName: "丈夫",
    amount: "1399.50",
    note: "课程材料"
  },
  {
    id: "tx-income",
    date: "2026-06-10",
    kind: "income",
    categoryName: "工资",
    accountId: "acc-bank",
    memberName: "家庭共同",
    amount: "28000",
    note: "本月工资"
  },
  {
    id: "tx-old",
    date: "2026-05-20",
    kind: "expense",
    categoryName: "交通",
    accountId: "acc-bank",
    memberName: "丈夫",
    amount: "500",
    note: "上月通勤"
  }
];

const budgets: Budget[] = [
  {
    id: "budget-food",
    month: "2026-06",
    categoryName: "餐饮",
    limitAmount: "1500"
  },
  {
    id: "budget-child",
    month: "2026-06",
    categoryName: "育儿",
    limitAmount: "2000"
  }
];

const holdings: InvestmentHolding[] = [
  {
    id: "holding-1",
    name: "沪深300ETF",
    code: "510300",
    type: "etf",
    accountId: "acc-fund",
    marketValue: "43000",
    cost: "40000",
    quantity: "10000",
    note: "核心指数"
  },
  {
    id: "holding-2",
    name: "稳健混合基金",
    code: "000001",
    type: "fund",
    accountId: "acc-fund",
    marketValue: "23000",
    cost: "25000",
    quantity: "18000",
    note: "主动基金"
  }
];

describe("family finance calculations", () => {
  it("calculates dashboard summary for a selected month without mixing older records", () => {
    const summary = calculateDashboardSummary({
      month: "2026-06",
      accounts,
      transactions,
      budgets,
      holdings
    });

    expect(summary.totalAssets).toBe("214000.00");
    expect(summary.monthlyExpense).toBe("2260.00");
    expect(summary.monthlyIncome).toBe("28000.00");
    expect(summary.monthlyBalance).toBe("25740.00");
    expect(summary.investmentMarketValue).toBe("66000.00");
    expect(summary.investmentCost).toBe("65000.00");
    expect(summary.investmentProfit).toBe("1000.00");
    expect(summary.investmentProfitRate).toBe(0.0154);
    expect(summary.categoryBreakdown).toEqual([
      { categoryName: "育儿", amount: "1399.50" },
      { categoryName: "餐饮", amount: "860.50" }
    ]);
  });

  it("calculates budget usage by category for the selected month", () => {
    expect(calculateBudgetUsages("2026-06", budgets, transactions)).toEqual([
      {
        id: "budget-food",
        month: "2026-06",
        categoryName: "餐饮",
        limitAmount: "1500.00",
        spentAmount: "860.50",
        usageRate: 0.5737,
        status: "normal"
      },
      {
        id: "budget-child",
        month: "2026-06",
        categoryName: "育儿",
        limitAmount: "2000.00",
        spentAmount: "1399.50",
        usageRate: 0.6998,
        status: "normal"
      }
    ]);
  });

  it("formats money consistently for UI display", () => {
    expect(formatMoney("12345.6")).toBe("¥12,345.60");
    expect(formatMoney("-80")).toBe("-¥80.00");
  });
});
