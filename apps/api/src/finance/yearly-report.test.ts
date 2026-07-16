import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@family-finance/shared";
import { buildYearlyReport } from "./yearly-report";

const transactions: FinanceTransaction[] = [
  { id: "1", date: "2026-01-05", kind: "income", categoryName: "工资薪酬", memberName: "雄哥", amount: "10000.00" },
  { id: "2", date: "2026-01-08", kind: "expense", categoryName: "餐饮", memberName: "雄哥", amount: "1000.00" },
  { id: "3", date: "2026-02-08", kind: "expense", categoryName: "居住", memberName: "瑶雯", amount: "3000.00" }
];

describe("buildYearlyReport", () => {
  it("aggregates annual cashflow, members, categories and exact snapshot months", () => {
    const report = buildYearlyReport({
      year: "2026",
      transactions,
      previousYearTransactions: [
        { id: "p1", date: "2025-01-01", kind: "expense", categoryName: "餐饮", memberName: "雄哥", amount: "800.00" }
      ],
      members: ["雄哥", "瑶雯", "家庭共同"],
      snapshots: [
        { month: "2025-12", totalAssets: "80000.00", totalLiabilities: "20000.00", netAssets: "60000.00" },
        {
          month: "2026-01",
          review: { month: "2026-01", spending: true, assets: true, liabilities: true, investments: true },
          totalAssets: "85000.00",
          totalLiabilities: "19000.00",
          netAssets: "66000.00",
          investmentMarketValue: "12000.00",
          investmentProfit: "2000.00"
        }
      ]
    });

    expect(report.summary).toMatchObject({
      totalIncome: "10000.00",
      totalExpense: "4000.00",
      balance: "6000.00",
      savingsRate: 60,
      yearEndNetAssets: "66000.00",
      netAssetsChange: "6000.00",
      yearEndSnapshotMonth: "2026-01"
    });
    expect(report.months[0]).toMatchObject({ month: "2026-01", income: "10000.00", expense: "1000.00", balance: "9000.00" });
    expect(report.months[1]).toMatchObject({ month: "2026-02", income: "0.00", expense: "3000.00" });
    expect(report.months[1]).not.toHaveProperty("netAssets");
    expect(report.categories[0]).toMatchObject({ categoryName: "居住", amount: "3000.00", percent: 75 });
    expect(report.categories[1]).toMatchObject({ categoryName: "餐饮", previousYearAmount: "800.00", changeRate: 25 });
    expect(report.members).toEqual([
      { memberName: "雄哥", income: "10000.00", expense: "1000.00", balance: "9000.00", expensePercent: 25 },
      { memberName: "瑶雯", income: "0.00", expense: "3000.00", balance: "-3000.00", expensePercent: 75 },
      { memberName: "家庭共同", income: "0.00", expense: "0.00", balance: "0.00", expensePercent: 0 }
    ]);
    expect(report.highlights).toMatchObject({ highestExpenseMonth: "2026-02", topCategory: "居住" });
  });
});
