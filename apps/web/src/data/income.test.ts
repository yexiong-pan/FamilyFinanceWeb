import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@family-finance/shared";
import { buildIncomeView } from "./income";

it("builds income totals and category notes without including expenses", () => {
  const transactions: FinanceTransaction[] = [
    { id: "1", date: "2026-07-01", kind: "income", categoryName: "工资薪酬", memberName: "雄哥", amount: "100.00" },
    { id: "2", date: "2026-07-02", kind: "expense", categoryName: "餐饮", memberName: "雄哥", amount: "20.00" }
  ];

  expect(buildIncomeView(transactions, [{ name: "工资薪酬", note: "工资、奖金、劳务报酬" }])).toEqual({
    transactions: [transactions[0]],
    total: "100.00",
    categoryRows: [
      { categoryName: "工资薪酬", note: "工资、奖金、劳务报酬", amount: "100.00", percent: 100 }
    ]
  });
});
