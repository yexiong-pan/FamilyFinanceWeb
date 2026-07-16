import { describe, expect, it } from "vitest";
import type { FinanceTransaction } from "@family-finance/shared";
import {
  buildCategoryDrilldown,
  buildMemberCashflowTotals,
  buildSpendingView,
  filterTransactionsByConfirmation,
  sumCashflowTransactions
} from "./spending";

const transactions: FinanceTransaction[] = [
  { id: "1", date: "2026-07-01", kind: "expense", categoryName: "餐饮", memberName: "家庭共同", amount: "25.50" },
  { id: "2", date: "2026-07-02", kind: "income", categoryName: "退款", memberName: "家庭共同", amount: "10.00" },
  { id: "3", date: "2026-07-03", kind: "transfer", categoryName: "转账", memberName: "家庭共同", amount: "1000.00" },
  { id: "4", date: "2026-07-04", kind: "expense", categoryName: "交通", memberName: "家庭共同", amount: "14.50" }
];

describe("buildSpendingView", () => {
  it("keeps income and transfers out of the simplified spending experience", () => {
    const view = buildSpendingView(transactions, [
      { name: "餐饮", note: "买菜、外卖、餐馆、饮品" },
      { name: "交通", note: "公交、打车、加油" }
    ]);

    expect(view.transactions.map((item) => item.id)).toEqual(["1", "4"]);
    expect(view.total).toBe("40.00");
    expect(view.categoryRows).toEqual([
      { categoryName: "餐饮", note: "买菜、外卖、餐馆、饮品", amount: "25.50", percent: 63.8 },
      { categoryName: "交通", note: "公交、打车、加油", amount: "14.50", percent: 36.3 }
    ]);
  });
});

describe("filterTransactionsByConfirmation", () => {
  const confirmationTransactions: FinanceTransaction[] = [
    {
      id: "pending-import",
      date: "2026-07-05",
      kind: "expense",
      categoryName: "餐饮",
      memberName: "家庭共同",
      amount: "20.00",
      source: "wechat"
    },
    {
      id: "confirmed-import",
      date: "2026-07-06",
      kind: "expense",
      categoryName: "交通",
      memberName: "家庭共同",
      amount: "30.00",
      source: "alipay",
      confirmedAt: "2026-07-06T12:00:00.000Z"
    },
    {
      id: "manual",
      date: "2026-07-07",
      kind: "expense",
      categoryName: "日用",
      memberName: "家庭共同",
      amount: "40.00",
      source: "manual"
    }
  ];

  it("shows all transactions when the status is empty", () => {
    expect(filterTransactionsByConfirmation(confirmationTransactions).map((item) => item.id)).toEqual([
      "pending-import",
      "confirmed-import",
      "manual"
    ]);
  });

  it("separates pending imports from confirmed and manual transactions", () => {
    expect(filterTransactionsByConfirmation(confirmationTransactions, "pending").map((item) => item.id)).toEqual([
      "pending-import"
    ]);
    expect(filterTransactionsByConfirmation(confirmationTransactions, "confirmed").map((item) => item.id)).toEqual([
      "confirmed-import",
      "manual"
    ]);
  });
});

it("builds expense and income category drilldowns into filtered details", () => {
  expect(buildCategoryDrilldown("expense", "餐饮")).toEqual({ view: "details", category: "餐饮" });
  expect(buildCategoryDrilldown("income", "工资薪酬")).toEqual({ view: "details", category: "工资薪酬" });
});

it("shows every configured member's amount beside the cashflow total", () => {
  expect(buildMemberCashflowTotals(transactions, ["雄哥", "瑶雯", "家庭共同"], "expense")).toEqual([
    { memberName: "雄哥", amount: "0.00" },
    { memberName: "瑶雯", amount: "0.00" },
    { memberName: "家庭共同", amount: "40.00" }
  ]);
});

it("totals only the transactions remaining after detail filters", () => {
  expect(sumCashflowTransactions([transactions[0]!, transactions[3]!])).toBe("40.00");
  expect(sumCashflowTransactions([])).toBe("0.00");
});
