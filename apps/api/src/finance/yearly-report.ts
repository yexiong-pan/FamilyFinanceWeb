import type {
  FinanceTransaction,
  MoneyAmount,
  MonthlyReviewStatus,
  YearlyReportData
} from "@family-finance/shared";

export interface YearlySnapshotInput {
  month: string;
  review?: MonthlyReviewStatus;
  totalAssets?: MoneyAmount;
  totalLiabilities?: MoneyAmount;
  netAssets?: MoneyAmount;
  investmentMarketValue?: MoneyAmount;
  investmentProfit?: MoneyAmount;
}

export function buildYearlyReport(input: {
  year: string;
  transactions: FinanceTransaction[];
  previousYearTransactions: FinanceTransaction[];
  members: string[];
  snapshots: YearlySnapshotInput[];
}): YearlyReportData {
  const months = Array.from({ length: 12 }, (_, index) => `${input.year}-${String(index + 1).padStart(2, "0")}`);
  const snapshotsByMonth = new Map(input.snapshots.map((snapshot) => [snapshot.month, snapshot]));
  const totalIncome = sumTransactions(input.transactions, "income");
  const totalExpense = sumTransactions(input.transactions, "expense");
  const balance = subtractMoney(totalIncome, totalExpense);
  const expenseCents = toCents(totalExpense);
  const incomeCents = toCents(totalIncome);

  const monthRows = months.map((month) => {
    const monthTransactions = input.transactions.filter((transaction) => transaction.date.startsWith(month));
    const income = sumTransactions(monthTransactions, "income");
    const expense = sumTransactions(monthTransactions, "expense");
    const snapshot = snapshotsByMonth.get(month);
    return {
      month,
      income,
      expense,
      balance: subtractMoney(income, expense),
      review: snapshot?.review ?? emptyReview(month),
      ...(snapshot?.totalAssets === undefined ? {} : { totalAssets: snapshot.totalAssets }),
      ...(snapshot?.totalLiabilities === undefined ? {} : { totalLiabilities: snapshot.totalLiabilities }),
      ...(snapshot?.netAssets === undefined ? {} : { netAssets: snapshot.netAssets }),
      ...(snapshot?.investmentMarketValue === undefined ? {} : { investmentMarketValue: snapshot.investmentMarketValue }),
      ...(snapshot?.investmentProfit === undefined ? {} : { investmentProfit: snapshot.investmentProfit })
    };
  });

  const expenseByCategory = aggregateBy(
    input.transactions.filter((transaction) => transaction.kind === "expense"),
    (transaction) => transaction.categoryName
  );
  const previousExpenseByCategory = aggregateBy(
    input.previousYearTransactions.filter((transaction) => transaction.kind === "expense"),
    (transaction) => transaction.categoryName
  );
  const categories = [...expenseByCategory.entries()]
    .map(([categoryName, cents]) => {
      const previousCents = previousExpenseByCategory.get(categoryName);
      return {
        categoryName,
        amount: fromCents(cents),
        percent: expenseCents === 0 ? 0 : round((cents / expenseCents) * 100),
        ...(previousCents === undefined ? {} : {
          previousYearAmount: fromCents(previousCents),
          ...(previousCents === 0 ? {} : { changeRate: round(((cents - previousCents) / previousCents) * 100) })
        })
      };
    })
    .sort((left, right) => toCents(right.amount) - toCents(left.amount));

  const memberNames = [...input.members];
  for (const transaction of input.transactions) {
    if (!memberNames.includes(transaction.memberName)) memberNames.push(transaction.memberName);
  }
  const members = memberNames.map((memberName) => {
    const memberTransactions = input.transactions.filter((transaction) => transaction.memberName === memberName);
    const income = sumTransactions(memberTransactions, "income");
    const expense = sumTransactions(memberTransactions, "expense");
    return {
      memberName,
      income,
      expense,
      balance: subtractMoney(income, expense),
      expensePercent: expenseCents === 0 ? 0 : round((toCents(expense) / expenseCents) * 100)
    };
  });

  const validNetSnapshots = input.snapshots
    .filter((snapshot) => snapshot.netAssets !== undefined)
    .sort((left, right) => left.month.localeCompare(right.month));
  const yearSnapshots = validNetSnapshots.filter((snapshot) => snapshot.month.startsWith(input.year));
  const yearEnd = yearSnapshots.at(-1);
  const baseline = snapshotsByMonth.get(`${Number(input.year) - 1}-12`)?.netAssets ?? yearSnapshots[0]?.netAssets;
  const highestExpense = [...monthRows].sort((left, right) => toCents(right.expense) - toCents(left.expense))[0];
  const bestSavings = [...monthRows].sort((left, right) => toCents(right.balance) - toCents(left.balance))[0];

  return {
    year: input.year,
    summary: {
      totalIncome,
      totalExpense,
      balance,
      savingsRate: incomeCents === 0 ? 0 : round((toCents(balance) / incomeCents) * 100),
      ...(yearEnd?.netAssets === undefined ? {} : {
        yearEndNetAssets: yearEnd.netAssets,
        yearEndSnapshotMonth: yearEnd.month,
        ...(baseline === undefined ? {} : { netAssetsChange: subtractMoney(yearEnd.netAssets, baseline) })
      }),
      ...(yearEnd?.investmentMarketValue === undefined ? {} : { yearEndInvestmentMarketValue: yearEnd.investmentMarketValue }),
      ...(yearEnd?.investmentProfit === undefined ? {} : { yearEndInvestmentProfit: yearEnd.investmentProfit })
    },
    months: monthRows,
    categories,
    members,
    highlights: {
      ...(highestExpense && toCents(highestExpense.expense) > 0 ? { highestExpenseMonth: highestExpense.month } : {}),
      ...(categories[0] ? { topCategory: categories[0].categoryName } : {}),
      ...(bestSavings && toCents(bestSavings.balance) !== 0 ? { bestSavingsMonth: bestSavings.month } : {})
    }
  };
}

function emptyReview(month: string): MonthlyReviewStatus {
  return { month, spending: false, assets: false, liabilities: false, investments: false };
}

function sumTransactions(transactions: FinanceTransaction[], kind: "income" | "expense"): MoneyAmount {
  return fromCents(
    transactions
      .filter((transaction) => transaction.kind === kind)
      .reduce((sum, transaction) => sum + toCents(transaction.amount), 0)
  );
}

function aggregateBy(transactions: FinanceTransaction[], key: (transaction: FinanceTransaction) => string): Map<string, number> {
  const result = new Map<string, number>();
  for (const transaction of transactions) {
    const name = key(transaction);
    result.set(name, (result.get(name) ?? 0) + toCents(transaction.amount));
  }
  return result;
}

function subtractMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return fromCents(toCents(left) - toCents(right));
}

function toCents(value: MoneyAmount): number {
  return Math.round(Number(value) * 100);
}

function fromCents(value: number): MoneyAmount {
  return (value / 100).toFixed(2);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
