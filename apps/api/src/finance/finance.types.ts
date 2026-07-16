import type {
  Account,
  AccountTypeOption,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionItem,
  InvestmentHolding,
  Liability,
  MoneyAmount,
  TransactionKind
} from "@family-finance/shared";
import type { TransactionSource } from "@family-finance/shared";

export type { AccountTypeOption, FamilyMemberInfo };

export interface MemberInput {
  name: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TransactionKind;
  note?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface CategoryInput {
  name: string;
  kind: TransactionKind;
  note?: string;
}

export interface CategoryMapping {
  id: string;
  source: Exclude<TransactionSource, "manual">;
  kind: "expense" | "income";
  sourceCategory: string;
  targetCategoryId: string;
  targetCategoryName: string;
}

export interface CategoryMappingInput {
  source: Exclude<TransactionSource, "manual">;
  kind: "expense" | "income";
  sourceCategory: string;
  targetCategoryId: string;
}

export interface AccountTypeInput {
  name: string;
}

export type CreateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;
export type UpdateAccountInput = Omit<Account, "id" | "createdAt" | "updatedAt">;

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
  source: Exclude<TransactionSource, "manual">;
  items: ImportTransactionItem[];
}
