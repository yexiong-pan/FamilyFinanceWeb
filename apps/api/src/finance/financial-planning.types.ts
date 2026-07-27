import type {
  ExpenseNature,
  MonthlyActionStatus,
  MonthlyReviewContent,
  RecurringCashflowKind
} from "@family-finance/shared";

export interface RecurringCashflowInput {
  name: string;
  kind: RecurringCashflowKind;
  amount: string;
  dayOfMonth: number;
  memberName?: string;
  accountId?: string;
  categoryId?: string;
  expenseNature?: ExpenseNature;
  startMonth?: string;
  endMonth?: string;
  isActive?: boolean;
}

export interface FinancialSafetySettingsInput {
  emergencyReserve: string;
  plannedMonthlySavings: string;
  liquidAccountIds?: string[];
}

export interface MonthlyReviewContentInput extends MonthlyReviewContent {}

export interface MonthlyReviewActionInput {
  title: string;
  ownerName?: string;
  dueDate?: string;
  targetAmount?: string;
  status?: MonthlyActionStatus;
}
