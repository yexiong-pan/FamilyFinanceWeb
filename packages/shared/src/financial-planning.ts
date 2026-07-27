type MoneyAmount = string;

export type ExpenseNature = "fixed" | "necessary" | "flexible" | "goal";
export type RecurringCashflowKind = "income" | "expense";
export type MonthlyActionStatus = "pending" | "completed" | "cancelled";
export type SafetyConfidence = "reliable" | "estimate" | "insufficient";
export type MonthlyReviewState = "draft" | "ready" | "completed";

export interface RecurringCashflow {
  id: string;
  name: string;
  kind: RecurringCashflowKind;
  amount: MoneyAmount;
  dayOfMonth: number;
  memberName?: string;
  accountId?: string;
  categoryId?: string;
  categoryName?: string;
  expenseNature?: ExpenseNature;
  startMonth?: string;
  endMonth?: string;
  isActive: boolean;
}

export interface FinancialSafetySettings {
  emergencyReserve: MoneyAmount;
  plannedMonthlySavings: MoneyAmount;
  liquidAccountIds: string[];
}

export interface SafetyObligation {
  id: string;
  name: string;
  date: string;
  kind: "income" | "expense" | "debt" | "saving";
  amount: MoneyAmount;
  memberName?: string;
}

export interface FinancialSafetySummary {
  month: string;
  asOfDate: string;
  liquidAmount: MoneyAmount;
  expectedIncome: MoneyAmount;
  requiredExpenses: MoneyAmount;
  debtPayments: MoneyAmount;
  plannedSavings: MoneyAmount;
  emergencyReserve: MoneyAmount;
  safeToSpend: MoneyAmount;
  shortfall: MoneyAmount;
  emergencyCoverageMonths?: number;
  confidence: SafetyConfidence;
  confidenceIssues: string[];
  upcomingObligations: SafetyObligation[];
}

export interface FinancialSafetyData {
  settings: FinancialSafetySettings;
  recurringCashflows: RecurringCashflow[];
  summary: FinancialSafetySummary;
}

export interface MonthlyReviewAction {
  id: string;
  month: string;
  title: string;
  ownerName?: string;
  dueDate?: string;
  targetAmount?: MoneyAmount;
  status: MonthlyActionStatus;
}

export interface MonthlyReviewCheck {
  key: string;
  label: string;
  complete: boolean;
  detail?: string;
  severity: "required" | "warning";
}

export interface MonthlyReviewChange {
  key: string;
  label: string;
  currentAmount: MoneyAmount;
  previousAmount: MoneyAmount;
  changeAmount: MoneyAmount;
  changeRate?: number;
  tone: "positive" | "negative" | "neutral";
}

export interface MonthlyReviewContent {
  summary?: string;
  good?: string;
  improve?: string;
  nextFocus?: string;
}

export interface MonthlyReviewDetail {
  month: string;
  state: MonthlyReviewState;
  status: {
    income: boolean;
    spending: boolean;
    assets: boolean;
    liabilities: boolean;
    investments: boolean;
    review: boolean;
  };
  content: MonthlyReviewContent;
  checks: MonthlyReviewCheck[];
  changes: MonthlyReviewChange[];
  actions: MonthlyReviewAction[];
}

export interface SafetyCalculationInput {
  liquidAmount: MoneyAmount;
  expectedIncome: MoneyAmount;
  requiredExpenses: MoneyAmount;
  debtPayments: MoneyAmount;
  plannedSavings: MoneyAmount;
  emergencyReserve: MoneyAmount;
}

export function calculateSafeToSpend(input: SafetyCalculationInput): {
  safeToSpend: MoneyAmount;
  shortfall: MoneyAmount;
} {
  const remainingCents =
    toCents(input.liquidAmount)
    + toCents(input.expectedIncome)
    - toCents(input.requiredExpenses)
    - toCents(input.debtPayments)
    - toCents(input.plannedSavings)
    - toCents(input.emergencyReserve);

  return {
    safeToSpend: fromCents(Math.max(0, remainingCents)),
    shortfall: fromCents(Math.max(0, -remainingCents))
  };
}

export function calculateEmergencyCoverageMonths(
  emergencyReserve: MoneyAmount,
  averageMonthlyEssentialExpense: MoneyAmount
): number | undefined {
  const monthlyCents = toCents(averageMonthlyEssentialExpense);
  if (monthlyCents <= 0) return undefined;
  return Math.round((toCents(emergencyReserve) / monthlyCents) * 10) / 10;
}

function toCents(value: MoneyAmount): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function fromCents(value: number): MoneyAmount {
  return (value / 100).toFixed(2);
}
