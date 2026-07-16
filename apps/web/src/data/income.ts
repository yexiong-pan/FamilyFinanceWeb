import type { FinanceTransaction } from "@family-finance/shared";
import { buildCashflowView } from "./spending";

export function buildIncomeView(
  transactions: FinanceTransaction[],
  categories: Array<{ name: string; note?: string }> = []
) {
  return buildCashflowView(transactions, "income", categories);
}
