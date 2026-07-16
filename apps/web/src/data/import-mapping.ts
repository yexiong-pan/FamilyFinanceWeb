import type { ImportTransactionItem, TransactionSource } from "@family-finance/shared";

interface SavedCategoryMapping {
  source: Exclude<TransactionSource, "manual">;
  kind: "expense" | "income";
  sourceCategory: string;
  targetCategoryName: string;
}

export function applySavedCategoryMappings(
  items: ImportTransactionItem[],
  source: Exclude<TransactionSource, "manual">,
  mappings: SavedCategoryMapping[]
): { items: ImportTransactionItem[]; unmappedCategories: string[] } {
  const targetByKey = new Map(
    mappings
      .filter((mapping) => mapping.source === source)
      .map((mapping) => [`${mapping.kind}:${mapping.sourceCategory}`, mapping.targetCategoryName])
  );
  const unmapped = new Set<string>();

  return {
    items: items.map((item) => {
      if (item.kind !== "expense" && item.kind !== "income") return item;
      const sourceCategory = item.categoryName;
      const target = targetByKey.get(`${item.kind}:${sourceCategory}`);
      if (!target) unmapped.add(sourceCategory);
      return {
        ...item,
        sourceCategory,
        categoryName: target ?? (item.kind === "expense" ? "待分类支出" : "待分类收入")
      };
    }),
    unmappedCategories: [...unmapped]
  };
}
