import { describe, expect, it, vi } from "vitest";
import { FinancialPlanningService } from "./financial-planning.service";

describe("FinancialPlanningService recurring cashflows", () => {
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
