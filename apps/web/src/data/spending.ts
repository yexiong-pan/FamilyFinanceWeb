import type { ExpenseNature, FinanceTransaction, MoneyAmount } from "@family-finance/shared";

export interface ExpenseNatureRow {
  nature: ExpenseNature;
  amount: MoneyAmount;
  percent: number;
}

export interface SpendingView {
  transactions: FinanceTransaction[];
  total: MoneyAmount;
  categoryRows: Array<{ categoryName: string; note?: string; amount: MoneyAmount; percent: number }>;
  natureRows: ExpenseNatureRow[];
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
  categories: Array<{ name: string; note?: string; expenseNature?: ExpenseNature }> = []
): SpendingView {
  return buildCashflowView(transactions, "expense", categories);
}

export function buildCashflowView(
  transactions: FinanceTransaction[],
  kind: "expense" | "income",
  categories: Array<{ name: string; note?: string; expenseNature?: ExpenseNature }> = []
): SpendingView {
  const matching = transactions.filter((transaction) => transaction.kind === kind);
  const totalCents = matching.reduce((sum, transaction) => sum + toCents(transaction.amount), 0);
  const total = fromCents(totalCents);
  const amountByCategory = new Map<string, number>();
  const noteByCategory = new Map(categories.map((category) => [category.name, category.note]));
  const natureByCategory = new Map(
    categories.map((category) => [category.name, category.expenseNature ?? "flexible"] as const)
  );
  const amountByNature = new Map<ExpenseNature, number>();

  for (const transaction of matching) {
    amountByCategory.set(
      transaction.categoryName,
      (amountByCategory.get(transaction.categoryName) ?? 0) + toCents(transaction.amount)
    );
    if (kind === "expense") {
      const nature = natureByCategory.get(transaction.categoryName) ?? "flexible";
      amountByNature.set(nature, (amountByNature.get(nature) ?? 0) + toCents(transaction.amount));
    }
  }

  const categoryRows = [...amountByCategory.entries()]
    .map(([categoryName, cents]) => ({
      categoryName,
      note: noteByCategory.get(categoryName),
      amount: fromCents(cents),
      percent: totalCents === 0 ? 0 : Math.round((cents / totalCents) * 1000) / 10
    }))
    .sort((left, right) => toCents(right.amount) - toCents(left.amount));

  const natureRows = kind === "expense"
    ? (["fixed", "necessary", "flexible", "goal"] as const).map((nature) => {
        const cents = amountByNature.get(nature) ?? 0;
        return {
          nature,
          amount: fromCents(cents),
          percent: totalCents === 0 ? 0 : Math.round((cents / totalCents) * 1000) / 10
        };
      })
    : [];

  return { transactions: matching, total, categoryRows, natureRows };
}

function toCents(value: MoneyAmount): number {
  return Math.round(Number(value) * 100);
}

function fromCents(value: number): MoneyAmount {
  return (value / 100).toFixed(2);
}
