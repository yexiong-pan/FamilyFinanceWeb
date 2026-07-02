import type {
  Account,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionItem,
  InvestmentHolding,
  Liability,
  MoneyAmount,
  TransactionKind
} from "@family-finance/shared";

export type { FamilyMemberInfo };

export interface MemberInput {
  name: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TransactionKind;
  isDefault: boolean;
  isActive: boolean;
}

export interface CategoryInput {
  name: string;
  kind: TransactionKind;
}

export type CreateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;
export type UpdateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;

export interface AccountSnapshotRecord {
  date: string;
  value: MoneyAmount;
}
export type CreateTransactionInput = Omit<FinanceTransaction, "id">;
export type CreateBudgetInput = Omit<Budget, "id">;
export type CreateInvestmentHoldingInput = Omit<InvestmentHolding, "id">;
export type CreateLiabilityInput = Omit<Liability, "id" | "status"> & { status?: Liability["status"] };
export interface RepayLiabilityInput {
  amount: MoneyAmount;
}

export interface ImportTransactionsInput {
  accountId?: string;
  memberName: string;
  items: ImportTransactionItem[];
}
