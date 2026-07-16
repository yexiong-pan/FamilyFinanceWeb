import type { FinanceTransaction, MoneyAmount } from "@family-finance/shared";

export interface SpendingView {
  transactions: FinanceTransaction[];
  total: MoneyAmount;
  categoryRows: Array<{ categoryName: string; note?: string; amount: MoneyAmount; percent: number }>;
}

export type TransactionConfirmationFilter = "pending" | "confirmed";

export function buildCategoryDrilldown(kind: "expense" | "income", category: string) {
  return { view: "details" as const, category };
}

export function buildMemberCashflowTotals(
  transactions: FinanceTransaction[],
  configuredMembers: string[],
  kind: "expense" | "income"
): Array<{ memberName: string; amount: MoneyAmount }> {
  const matching = transactions.filter((transaction) => transaction.kind === kind);
  const members = [...configuredMembers];
  for (const transaction of matching) {
    if (!members.includes(transaction.memberName)) members.push(transaction.memberName);
  }

  return members.map((memberName) => ({
    memberName,
    amount: fromCents(
      matching
        .filter((transaction) => transaction.memberName === memberName)
        .reduce((sum, transaction) => sum + toCents(transaction.amount), 0)
    )
  }));
}

export function sumCashflowTransactions(transactions: FinanceTransaction[]): MoneyAmount {
  return fromCents(transactions.reduce((sum, transaction) => sum + toCents(transaction.amount), 0));
}

export function filterTransactionsByConfirmation(
  transactions: FinanceTransaction[],
  status?: TransactionConfirmationFilter
): FinanceTransaction[] {
  if (!status) return transactions;

  return transactions.filter((transaction) => {
    const isPending = Boolean(transaction.source && transaction.source !== "manual" && !transaction.confirmedAt);
    return status === "pending" ? isPending : !isPending;
  });
}

export function buildSpendingView(
  transactions: FinanceTransaction[],
  categories: Array<{ name: string; note?: string }> = []
): SpendingView {
  return buildCashflowView(transactions, "expense", categories);
}

export function buildCashflowView(
  transactions: FinanceTransaction[],
  kind: "expense" | "income",
  categories: Array<{ name: string; note?: string }> = []
): SpendingView {
  const matching = transactions.filter((transaction) => transaction.kind === kind);
  const totalCents = matching.reduce((sum, transaction) => sum + toCents(transaction.amount), 0);
  const total = fromCents(totalCents);
  const amountByCategory = new Map<string, number>();
  const noteByCategory = new Map(categories.map((category) => [category.name, category.note]));

  for (const transaction of matching) {
    amountByCategory.set(
      transaction.categoryName,
      (amountByCategory.get(transaction.categoryName) ?? 0) + toCents(transaction.amount)
    );
  }

  const categoryRows = [...amountByCategory.entries()]
    .map(([categoryName, cents]) => ({
      categoryName,
      note: noteByCategory.get(categoryName),
      amount: fromCents(cents),
      percent: totalCents === 0 ? 0 : Math.round((cents / totalCents) * 1000) / 10
    }))
    .sort((left, right) => toCents(right.amount) - toCents(left.amount));

  return { transactions: matching, total, categoryRows };
}

function toCents(value: MoneyAmount): number {
  return Math.round(Number(value) * 100);
}

function fromCents(value: number): MoneyAmount {
  return (value / 100).toFixed(2);
}
