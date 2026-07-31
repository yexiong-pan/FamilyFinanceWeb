import { describe, expect, it, vi } from "vitest";
import { FinancialPlanningService } from "./financial-planning.service";

describe("FinancialPlanningService recurring cashflows", () => {
  it("counts only imported income and expenses that still need confirmation", async () => {
    const transactions = [
      transaction("income", "wechat", undefined),
      transaction("expense", "alipay", undefined),
      transaction("transfer", "wechat", undefined),
      transaction("income", "manual", undefined),
      transaction("expense", "wechat", "2026-07-02T09:00:00.000Z")
    ];
    const service = new FinancialPlanningService({
      family: { upsert: vi.fn() },
      financialSafetySettings: { upsert: vi.fn() },
      monthlyReview: { upsert: vi.fn(async () => ({ actions: [] })) },
      account: { count: vi.fn(async () => 0) },
      liability: { count: vi.fn(async () => 0) }
    } as never, {
      getMonthlyReview: vi.fn(async () => ({
        month: "2026-07",
        income: false,
        spending: false,
        assets: false,
        liabilities: false,
        investments: false,
        review: false
      })),
      getDashboardSummary: vi.fn(async () => ({
        monthlyIncome: "0.00",
        monthlyExpense: "0.00",
        monthlyBalance: "0.00"
      })),
      listTransactions: vi.fn(async () => transactions),
      listLiabilitiesForMonth: vi.fn(async () => [])
    } as never);

    const detail = await service.getMonthlyReviewDetail("2026-07");

    expect(detail.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "pending-income-transactions", detail: "1 笔收入待确认" }),
      expect.objectContaining({ key: "pending-expense-transactions", detail: "1 笔支出待确认" })
    ]));
    expect(detail.checks.find((item) => item.key === "pending-transactions")).toBeUndefined();
  });

  it("uses the selected month's liabilities and ignores flexible repayment arrangements", async () => {
    const listLiabilitiesForMonth = vi.fn(async () => [
      { status: "active", repaymentSchedule: "monthly", monthlyPayment: "0.00", paymentDay: 8 },
      { status: "active", repaymentSchedule: "flexible" },
      { status: "active", repaymentSchedule: "monthly", monthlyPayment: "1200.00", paymentDay: 15 }
    ]);
    const service = new FinancialPlanningService({
      family: { upsert: vi.fn() },
      financialSafetySettings: { upsert: vi.fn() },
      monthlyReview: { upsert: vi.fn(async () => ({ actions: [] })) },
      account: { count: vi.fn(async () => 0) }
    } as never, {
      getMonthlyReview: vi.fn(async () => ({
        month: "2026-06", income: false, spending: false, assets: false, liabilities: false, investments: false, review: false
      })),
      getDashboardSummary: vi.fn(async () => ({ monthlyIncome: "0.00", monthlyExpense: "0.00", monthlyBalance: "0.00" })),
      listTransactions: vi.fn(async () => []),
      listLiabilitiesForMonth
    } as never);

    const detail = await service.getMonthlyReviewDetail("2026-06");

    expect(listLiabilitiesForMonth).toHaveBeenCalledWith("2026-06");
    expect(detail.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "complete-liabilities", detail: "1 笔负债缺少月供或还款日" })
    ]));
  });

  it("derives expense nature from the linked category", async () => {
    const recurringCreate = vi.fn(async ({ data }) => ({
      id: "recurring-1",
      ...data,
      amount: { toString: () => data.amount },
      category: { name: "餐饮" }
    }));
    const service = new FinancialPlanningService({
      family: { upsert: vi.fn() },
      financialSafetySettings: { upsert: vi.fn() },
      category: {
        findFirst: vi.fn(async () => ({ kind: "expense", expenseNature: "necessary" }))
      },
      recurringCashflow: { create: recurringCreate }
    } as never, {} as never);

    const result = await service.createRecurringCashflow({
      name: "每月买菜",
      kind: "expense",
      amount: "1200",
      dayOfMonth: 5,
      categoryId: "category-food",
      expenseNature: "flexible"
    });

    expect(recurringCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: "category-food",
        expenseNature: "necessary"
      }),
      include: { category: { select: { name: true } } }
    });
    expect(result).toMatchObject({
      categoryName: "餐饮",
      expenseNature: "necessary"
    });
  });

  it("rejects a category from the other cashflow kind", async () => {
    const service = new FinancialPlanningService({
      family: { upsert: vi.fn() },
      financialSafetySettings: { upsert: vi.fn() },
      category: {
        findFirst: vi.fn(async () => ({ kind: "income", expenseNature: null }))
      }
    } as never, {} as never);

    await expect(service.createRecurringCashflow({
      name: "错误分类",
      kind: "expense",
      amount: "100",
      dayOfMonth: 1,
      categoryId: "category-salary"
    })).rejects.toThrow("关联分类与收支类型不一致");
  });
});

function transaction(
  kind: "income" | "expense" | "transfer",
  source: "manual" | "wechat" | "alipay",
  confirmedAt?: string
) {
  return {
    id: `${kind}-${source}`,
    date: "2026-07-01",
    kind,
    categoryName: kind === "income" ? "工资薪酬" : "其他",
    memberName: "雄哥",
    amount: "100.00",
    source,
    confirmedAt
  };
}
