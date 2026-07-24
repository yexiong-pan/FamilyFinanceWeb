export type MoneyAmount = string;

export type AccountType = string;
export type TransactionKind = "expense" | "income" | "transfer" | "adjustment";
export type TransactionSource = "manual" | "alipay" | "wechat";
export type InvestmentHoldingType = "fund" | "stock" | "etf";
export type LiabilityType =
  | "mortgage"
  | "carLoan"
  | "consumerInstallment"
  | "creditCard"
  | "privateLoan"
  | "other";
export type LiabilityStatus = "active" | "paidOff" | "closed";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  ownerName: string;
  currentValue: MoneyAmount;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  kind: TransactionKind;
  categoryName: string;
  accountId?: string;
  memberName: string;
  amount: MoneyAmount;
  note?: string;
  source?: TransactionSource;
  sourceCategory?: string;
  confirmedAt?: string;
}

export interface TransactionPageFilter {
  month: string;
  kind: "expense" | "income";
  page: number;
  pageSize: number;
  category?: string;
  member?: string;
  status?: "pending" | "confirmed";
  min?: number;
  max?: number;
}

export interface TransactionPage {
  items: FinanceTransaction[];
  total: number;
  totalAmount: MoneyAmount;
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
  investedAmount?: MoneyAmount;
  profit: MoneyAmount;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MonthlyReviewStatus {
  month: string;
  spending: boolean;
  assets: boolean;
  liabilities: boolean;
  investments: boolean;
}

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  ownerName: string;
  initialBalance?: MoneyAmount;
  currentBalance: MoneyAmount;
  monthlyPayment?: MoneyAmount;
  paymentDay?: number;
  remainingPeriods?: number;
  lender?: string;
  status: LiabilityStatus;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  amount: MoneyAmount;
}

export interface MemberBreakdownItem {
  memberName: string;
  income: MoneyAmount;
  expense: MoneyAmount;
}

export interface LiabilityBreakdownItem {
  type: LiabilityType;
  amount: MoneyAmount;
}

export interface AssetTrendPoint {
  date: string;
  totalAssets: MoneyAmount;
}

export interface AccountSnapshotRecord {
  id: string;
  accountId: string;
  accountName: string;
  ownerName: string;
  date: string;
  value: MoneyAmount;
}

export interface MonthlyAssetSnapshotItem {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  ownerName: string;
  value: MoneyAmount;
  change?: MoneyAmount;
}

export interface MonthlyLiabilitySnapshotItem {
  liabilityId: string;
  liabilityName: string;
  ownerName: string;
  currentBalance: MoneyAmount;
  monthlyPayment?: MoneyAmount;
  remainingPeriods?: number;
  change?: MoneyAmount;
}

export interface MonthlyInvestmentSnapshotItem {
  holdingId: string;
  holdingName: string;
  code: string;
  accountName: string;
  investedAmount: MoneyAmount;
  marketValue: MoneyAmount;
  profit: MoneyAmount;
  returnRate: number;
  change?: MoneyAmount;
}

export interface MonthlySnapshotData {
  month: string;
  review: MonthlyReviewStatus;
  summary: {
    totalAssets: MoneyAmount;
    totalLiabilities: MoneyAmount;
    netAssets: MoneyAmount;
    investmentMarketValue: MoneyAmount;
    investmentProfit: MoneyAmount;
    netAssetsChange?: MoneyAmount;
  };
  assets: MonthlyAssetSnapshotItem[];
  liabilities: MonthlyLiabilitySnapshotItem[];
  investments: MonthlyInvestmentSnapshotItem[];
}

export interface YearlyReportMonth {
  month: string;
  income: MoneyAmount;
  expense: MoneyAmount;
  balance: MoneyAmount;
  review: MonthlyReviewStatus;
  totalAssets?: MoneyAmount;
  totalLiabilities?: MoneyAmount;
  netAssets?: MoneyAmount;
  investmentMarketValue?: MoneyAmount;
  investmentProfit?: MoneyAmount;
}

export interface YearlyReportData {
  year: string;
  summary: {
    totalIncome: MoneyAmount;
    totalExpense: MoneyAmount;
    balance: MoneyAmount;
    savingsRate: number;
    yearEndNetAssets?: MoneyAmount;
    netAssetsChange?: MoneyAmount;
    yearEndSnapshotMonth?: string;
    yearEndInvestmentMarketValue?: MoneyAmount;
    yearEndInvestmentProfit?: MoneyAmount;
  };
  months: YearlyReportMonth[];
  categories: Array<{
    categoryName: string;
    amount: MoneyAmount;
    percent: number;
    previousYearAmount?: MoneyAmount;
    changeRate?: number;
  }>;
  members: Array<{
    memberName: string;
    income: MoneyAmount;
    expense: MoneyAmount;
    balance: MoneyAmount;
    expensePercent: number;
  }>;
  highlights: {
    highestExpenseMonth?: string;
    topCategory?: string;
    bestSavingsMonth?: string;
  };
}

export interface ImportTransactionItem {
  date: string;
  occurredAt?: string;
  kind: TransactionKind;
  categoryName: string;
  amount: MoneyAmount;
  note?: string;
  sourceCategory?: string;
  sourceRecordId?: string;
  sourceAccount?: string;
}

export interface ImportTransactionsResult {
  imported: number;
  duplicates: number;
}

export interface FamilyMemberInfo {
  id: string;
  name: string;
  icon?: string;
}

export interface AccountTypeOption {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
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
  totalLiabilities: MoneyAmount;
  netAssets: MoneyAmount;
  monthlyExpense: MoneyAmount;
  monthlyIncome: MoneyAmount;
  monthlyBalance: MoneyAmount;
  monthlyDebtPayment: MoneyAmount;
  investmentMarketValue: MoneyAmount;
  investmentCost: MoneyAmount;
  investmentProfit: MoneyAmount;
  investmentProfitRate: number;
  categoryBreakdown: CategoryBreakdownItem[];
  liabilityBreakdown: LiabilityBreakdownItem[];
  memberBreakdown: MemberBreakdownItem[];
  budgetUsages: BudgetUsage[];
}

export interface DashboardSummaryInput {
  month: string;
  accounts: Account[];
  transactions: FinanceTransaction[];
  budgets: Budget[];
  holdings: InvestmentHolding[];
  liabilities?: Liability[];
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
  const investmentCostCents = input.holdings.reduce(
    (total, holding) =>
      total +
      toCents(
        holding.investedAmount ??
          fromCents(toCents(holding.marketValue) - toCents(holding.profit))
      ),
    0
  );
  const investmentProfitCents = toCents(investmentMarketValue) - investmentCostCents;
  const investmentProfit = fromCents(investmentProfitCents);
  const investmentCost = fromCents(investmentCostCents);

  const activeLiabilities = (input.liabilities ?? []).filter(
    (liability) => liability.status === "active"
  );
  const totalAssets = sumMoney(input.accounts.map((account) => account.currentValue));
  const totalLiabilities = sumMoney(activeLiabilities.map((liability) => liability.currentBalance));
  const monthlyDebtPayment = sumMoney(
    activeLiabilities.map((liability) => liability.monthlyPayment ?? "0")
  );

  return {
    totalAssets,
    totalLiabilities,
    netAssets: fromCents(toCents(totalAssets) - toCents(totalLiabilities)),
    monthlyExpense,
    monthlyIncome,
    monthlyBalance: fromCents(toCents(monthlyIncome) - toCents(monthlyExpense)),
    monthlyDebtPayment,
    investmentMarketValue,
    investmentCost,
    investmentProfit,
    investmentProfitRate:
      investmentCostCents === 0 ? 0 : roundTo(investmentProfitCents / investmentCostCents, 4),
    categoryBreakdown: calculateCategoryBreakdown(input.month, input.transactions),
    liabilityBreakdown: calculateLiabilityBreakdown(activeLiabilities),
    memberBreakdown: calculateMemberBreakdown(input.month, input.transactions),
    budgetUsages: calculateBudgetUsages(input.month, input.budgets, input.transactions)
  };
}

export function calculateMemberBreakdown(
  month: string,
  transactions: FinanceTransaction[]
): MemberBreakdownItem[] {
  const totals = new Map<string, { income: number; expense: number }>();
  for (const transaction of transactions) {
    if (!isDateInMonth(transaction.date, month)) {
      continue;
    }
    if (transaction.kind !== "income" && transaction.kind !== "expense") {
      continue;
    }
    const entry = totals.get(transaction.memberName) ?? { income: 0, expense: 0 };
    entry[transaction.kind] += toCents(transaction.amount);
    totals.set(transaction.memberName, entry);
  }

  return [...totals.entries()]
    .map(([memberName, value]) => ({
      memberName,
      income: fromCents(value.income),
      expense: fromCents(value.expense)
    }))
    .sort((left, right) => {
      const diff =
        toCents(right.income) + toCents(right.expense) - (toCents(left.income) + toCents(left.expense));
      return diff === 0 ? left.memberName.localeCompare(right.memberName, "zh-CN") : diff;
    });
}

export function calculateLiabilityBreakdown(liabilities: Liability[]): LiabilityBreakdownItem[] {
  const totals = liabilities.reduce<Record<string, number>>((breakdown, liability) => {
    breakdown[liability.type] = (breakdown[liability.type] ?? 0) + toCents(liability.currentBalance);
    return breakdown;
  }, {});

  return Object.entries(totals)
    .map(([type, cents]) => ({ type: type as LiabilityType, amount: fromCents(cents) }))
    .sort((left, right) => toCents(right.amount) - toCents(left.amount));
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
