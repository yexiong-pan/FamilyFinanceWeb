import { describe, expect, it } from "vitest";
import { buildCategoryChangeInput } from "./transaction-edit";

describe("buildCategoryChangeInput", () => {
  it("changes only the category while preserving the transaction details", () => {
    expect(
      buildCategoryChangeInput(
        {
          id: "transaction-1",
          date: "2026-06-18",
          kind: "expense",
          categoryName: "待分类支出",
          accountId: "account-1",
          memberName: "家庭共同",
          amount: "88.00",
          note: "午餐"
        },
        "餐饮"
      )
    ).toEqual({
      date: "2026-06-18",
      kind: "expense",
      categoryName: "餐饮",
      accountId: "account-1",
      memberName: "家庭共同",
      amount: "88.00",
      note: "午餐"
    });
  });
});
