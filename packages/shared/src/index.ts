export type MoneyAmount = string;

export type AccountType = "bankCard" | "cash" | "alipay" | "wechat" | "fund" | "stock" | "other";
export type TransactionKind = "expense" | "income" | "transfer" | "adjustment";
export type InvestmentHoldingType = "fund" | "stock" | "etf";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  ownerName: string;
  currentValue: MoneyAmount;
  note?: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  kind: TransactionKind;
  categoryName: string;
  accountId: string;
  memberName: string;
  amount: MoneyAmount;
  note?: string;
}

export interface Budget {
  id: string;
  month: string;
  categoryName: string;
  limitAmount: MoneyAmount;
}

export interface InvestmentHolding {
  id: string;
  name: string;
  code: string;
  type: InvestmentHoldingType;
  accountId: string;
  marketValue: MoneyAmount;
  cost: MoneyAmount;
  quantity: MoneyAmount;
  note?: string;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  amount: MoneyAmount;
}

export interface BudgetUsage {
  id: string;
  month: string;
  categoryName: string;
  limitAmount: MoneyAmount;
  spentAmount: MoneyAmount;
  usageRate: number;
  status: "normal" | "warning" | "over";
}

export interface DashboardSummary {
  totalAssets: MoneyAmount;
  monthlyExpense: MoneyAmount;
  monthlyIncome: MoneyAmount;
  monthlyBalance: MoneyAmount;
  investmentMarketValue: MoneyAmount;
  investmentCost: MoneyAmount;
  investmentProfit: MoneyAmount;
  investmentProfitRate: number;
  categoryBreakdown: CategoryBreakdownItem[];
  budgetUsages: BudgetUsage[];
}

export interface DashboardSummaryInput {
  month: string;
  accounts: Account[];
  transactions: FinanceTransaction[];
  budgets: Budget[];
  holdings: InvestmentHolding[];
}

export function calculateDashboardSummary(input: DashboardSummaryInput): DashboardSummary {
  const monthlyTransactions = input.transactions.filter((transaction) =>
    isDateInMonth(transaction.date, input.month)
  );
  const monthlyExpense = sumMoney(
    monthlyTransactions
      .filter((transaction) => transaction.kind === "expense")
      .map((transaction) => transaction.amount)
  );
  const monthlyIncome = sumMoney(
    monthlyTransactions
      .filter((transaction) => transaction.kind === "income")
      .map((transaction) => transaction.amount)
  );
  const investmentMarketValue = sumMoney(input.holdings.map((holding) => holding.marketValue));
  const investmentCost = sumMoney(input.holdings.map((holding) => holding.cost));
  const investmentProfitCents = toCents(investmentMarketValue) - toCents(investmentCost);
  const investmentCostCents = toCents(investmentCost);

  return {
    totalAssets: sumMoney(input.accounts.map((account) => account.currentValue)),
    monthlyExpense,
    monthlyIncome,
    monthlyBalance: fromCents(toCents(monthlyIncome) - toCents(monthlyExpense)),
    investmentMarketValue,
    investmentCost,
    investmentProfit: fromCents(investmentProfitCents),
    investmentProfitRate:
      investmentCostCents === 0 ? 0 : roundTo(investmentProfitCents / investmentCostCents, 4),
    categoryBreakdown: calculateCategoryBreakdown(input.month, input.transactions),
    budgetUsages: calculateBudgetUsages(input.month, input.budgets, input.transactions)
  };
}

export function calculateBudgetUsages(
  month: string,
  budgets: Budget[],
  transactions: FinanceTransaction[]
): BudgetUsage[] {
  const expenseByCategory = transactions
    .filter((transaction) => transaction.kind === "expense" && isDateInMonth(transaction.date, month))
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.categoryName] = (totals[transaction.categoryName] ?? 0) + toCents(transaction.amount);
      return totals;
    }, {});

  return budgets
    .filter((budget) => budget.month === month)
    .map((budget) => {
      const spentCents = expenseByCategory[budget.categoryName] ?? 0;
      const limitCents = toCents(budget.limitAmount);
      const usageRate = limitCents === 0 ? 0 : roundTo(spentCents / limitCents, 4);

      return {
        id: budget.id,
        month: budget.month,
        categoryName: budget.categoryName,
        limitAmount: normalizeMoney(budget.limitAmount),
        spentAmount: fromCents(spentCents),
        usageRate,
        status: budgetStatus(usageRate)
      };
    });
}

export function formatMoney(value: MoneyAmount): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(toCents(value) / 100);
}

export function normalizeMoney(value: MoneyAmount): MoneyAmount {
  return fromCents(toCents(value));
}

function calculateCategoryBreakdown(
  month: string,
  transactions: FinanceTransaction[]
): CategoryBreakdownItem[] {
  const totals = transactions
    .filter((transaction) => transaction.kind === "expense" && isDateInMonth(transaction.date, month))
    .reduce<Record<string, number>>((breakdown, transaction) => {
      breakdown[transaction.categoryName] =
        (breakdown[transaction.categoryName] ?? 0) + toCents(transaction.amount);
      return breakdown;
    }, {});

  return Object.entries(totals)
    .map(([categoryName, cents]) => ({ categoryName, amount: fromCents(cents) }))
    .sort((left, right) => {
      const amountDiff = toCents(right.amount) - toCents(left.amount);
      return amountDiff === 0 ? left.categoryName.localeCompare(right.categoryName, "zh-CN") : amountDiff;
    });
}

function sumMoney(values: MoneyAmount[]): MoneyAmount {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}

function isDateInMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month;
}

function budgetStatus(usageRate: number): BudgetUsage["status"] {
  if (usageRate >= 1) {
    return "over";
  }
  if (usageRate >= 0.8) {
    return "warning";
  }
  return "normal";
}

function toCents(value: MoneyAmount): number {
  const trimmed = value.trim();
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [rawInteger = "0", rawFraction = ""] = unsigned.split(".");
  const integerPart = rawInteger.replace(/\D/g, "") || "0";
  const fractionPart = `${rawFraction.replace(/\D/g, "")}00`.slice(0, 2);

  return sign * (Number.parseInt(integerPart, 10) * 100 + Number.parseInt(fractionPart, 10));
}

function fromCents(cents: number): MoneyAmount {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100);
  const fractionPart = String(absolute % 100).padStart(2, "0");
  return `${sign}${integerPart}.${fractionPart}`;
}

function roundTo(value: number, digits: number): number {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
