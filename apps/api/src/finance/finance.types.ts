import type {
  Account,
  Budget,
  FinanceTransaction,
  InvestmentHolding,
  TransactionKind
} from "@family-finance/shared";

export interface Category {
  id: string;
  name: string;
  kind: TransactionKind;
  isDefault: boolean;
  isActive: boolean;
}

export type CreateAccountInput = Omit<Account, "id">;
export type CreateTransactionInput = Omit<FinanceTransaction, "id">;
export type CreateBudgetInput = Omit<Budget, "id">;
export type CreateInvestmentHoldingInput = Omit<InvestmentHolding, "id">;
