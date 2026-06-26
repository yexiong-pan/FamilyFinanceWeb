import type {
  Account,
  Budget,
  FinanceTransaction,
  InvestmentHolding
} from "@family-finance/shared";
import type {
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateTransactionInput
} from "./finance.types";

export const FINANCE_REPOSITORY = Symbol.for("family-finance.repository");

export interface FinanceRepository {
  ensureBaseData(): Promise<void>;
  listMembers(): Promise<string[]>;
  listCategories(): Promise<Category[]>;
  listAccounts(): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;
  listTransactions(filter?: { month?: string }): Promise<FinanceTransaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction>;
  listBudgets(month?: string): Promise<Budget[]>;
  createBudget(input: CreateBudgetInput): Promise<Budget>;
  listHoldings(): Promise<InvestmentHolding[]>;
  createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding>;
}
