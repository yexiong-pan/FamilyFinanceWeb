import { describe, expect, it } from "vitest";
import type { Account, Liability, YearlyReportMonth } from "@family-finance/shared";
import {
  buildAnnualCashflowTrend,
  buildAssetAllocation,
  buildLiabilityProgress,
  buildNetWorthTrend
} from "./financial-charts";

describe("financial chart data", () => {
  it("groups asset accounts by type without adding investment holdings again", () => {
    const accounts: Account[] = [
      account("bank-1", "银行卡", "1200"),
      account("bank-2", "银行卡", "300"),
      account("fund-1", "基金账户", "800")
    ];

    expect(buildAssetAllocation(accounts)).toEqual([
      { type: "银行卡", value: 1500, percent: 65.22 },
      { type: "基金账户", value: 800, percent: 34.78 }
    ]);
  });

  it("keeps the allocation chart readable by grouping types after the largest five", () => {
    const accounts = [6, 5, 4, 3, 2, 1].map((value, index) => (
      account(`account-${index}`, `类型${index + 1}`, String(value))
    ));

    expect(buildAssetAllocation(accounts).map((item) => item.type)).toEqual([
      "类型1",
      "类型2",
      "类型3",
      "类型4",
      "类型5",
      "其他"
    ]);
    expect(buildAssetAllocation(accounts).at(-1)).toEqual({ type: "其他", value: 1, percent: 4.76 });
  });

  it("calculates repayment progress from initial and current balances", () => {
    const liabilities: Liability[] = [
      liability("mortgage", "房贷", "100000", "75000"),
      liability("settled", "消费贷", "1000", "0", "paidOff")
    ];

    expect(buildLiabilityProgress(liabilities)).toEqual([
      {
        id: "mortgage",
        name: "房贷",
        initialBalance: 100000,
        currentBalance: 75000,
        repaidAmount: 25000,
        percent: 25,
        estimated: false
      },
      {
        id: "settled",
        name: "消费贷",
        initialBalance: 1000,
        currentBalance: 0,
        repaidAmount: 1000,
        percent: 100,
        estimated: false
      }
    ]);
  });

  it("does not fabricate repayment progress when the initial balance is missing", () => {
    const missingInitialBalance = {
      ...liability("installment", "手机分期", "500", "500"),
      initialBalance: undefined
    };

    expect(buildLiabilityProgress([missingInitialBalance])).toEqual([
      {
        id: "installment",
        name: "手机分期",
        initialBalance: null,
        currentBalance: 500,
        repaidAmount: null,
        percent: null,
        estimated: true
      }
    ]);
  });

  it("keeps missing snapshot months as gaps in the net worth trend", () => {
    const months = [
      reportMonth("2026-01", { totalAssets: "100", totalLiabilities: "30", netAssets: "70" }),
      reportMonth("2026-02"),
      reportMonth("2026-03", { totalAssets: "120", totalLiabilities: "20", netAssets: "100" })
    ];

    expect(buildNetWorthTrend(months)).toEqual([
      { month: "1月", type: "总资产", amount: 100 },
      { month: "1月", type: "总负债", amount: 30 },
      { month: "1月", type: "净资产", amount: 70 },
      { month: "2月", type: "总资产", amount: null },
      { month: "2月", type: "总负债", amount: null },
      { month: "2月", type: "净资产", amount: null },
      { month: "3月", type: "总资产", amount: 120 },
      { month: "3月", type: "总负债", amount: 20 },
      { month: "3月", type: "净资产", amount: 100 }
    ]);
  });

  it("builds income and expense columns with a monthly balance line", () => {
    const months = [
      reportMonth("2026-01", { income: "100", expense: "70", balance: "30" })
    ];

    expect(buildAnnualCashflowTrend(months)).toEqual({
      columns: [
        { month: "1月", position: 0.82, type: "收入", amount: 100 },
        { month: "1月", position: 1.18, type: "支出", amount: 70 }
      ],
      balance: [{ month: "1月", position: 1, type: "结余", amount: 30 }]
    });
  });
});

function account(id: string, type: string, currentValue: string): Account {
  return { id, name: id, type, ownerName: "雄哥", currentValue };
}

function liability(
  id: string,
  name: string,
  initialBalance: string,
  currentBalance: string,
  status: Liability["status"] = "active"
): Liability {
  return {
    id,
    name,
    type: "mortgage",
    ownerName: "雄哥",
    initialBalance,
    currentBalance,
    status
  } as Liability;
}

function reportMonth(
  month: string,
  values: Partial<YearlyReportMonth> = {}
): YearlyReportMonth {
  return {
    month,
    income: "0",
    expense: "0",
    balance: "0",
    review: { month, spending: false, assets: false, liabilities: false, investments: false },
    ...values
  };
}
