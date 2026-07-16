import { describe, expect, it } from "vitest";
import type { ImportTransactionItem } from "@family-finance/shared";
import { applySavedCategoryMappings } from "./import-mapping";

it("maps by source and kind and sends unknown categories to review", () => {
  const items: ImportTransactionItem[] = [
    { date: "2026-06-01", kind: "expense", categoryName: "生活日用", amount: "10.00" },
    { date: "2026-06-02", kind: "income", categoryName: "投资理财", amount: "20.00" },
    { date: "2026-06-03", kind: "expense", categoryName: "新分类", amount: "30.00" },
    { date: "2026-06-04", kind: "transfer", categoryName: "转账", amount: "40.00" }
  ];
  const mappings = [
    { source: "alipay" as const, kind: "expense" as const, sourceCategory: "生活日用", targetCategoryName: "日用消耗" },
    { source: "alipay" as const, kind: "income" as const, sourceCategory: "投资理财", targetCategoryName: "投资收益" }
  ];

  const result = applySavedCategoryMappings(items, "alipay", mappings);

  expect(result.items.map((item) => item.categoryName)).toEqual([
    "日用消耗",
    "投资收益",
    "待分类支出",
    "转账"
  ]);
  expect(result.unmappedCategories).toEqual(["新分类"]);
});
