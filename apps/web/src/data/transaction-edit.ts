import type { FinanceTransaction } from "@family-finance/shared";

export function buildCategoryChangeInput(
  transaction: FinanceTransaction,
  categoryName: string
): Omit<FinanceTransaction, "id"> {
  const { id: _id, ...input } = transaction;
  return { ...input, categoryName };
}
