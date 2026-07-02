import type {
  Account,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
import type {
  Category,
  CategoryInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateLiabilityInput,
  CreateTransactionInput,
  ImportTransactionsInput,
  MemberInput,
  RepayLiabilityInput
} from "./finance.types";

export const FINANCE_REPOSITORY = Symbol.for("family-finance.repository");

export interface FinanceRepository {
  ensureBaseData(): Promise<void>;
  listMembers(): Promise<string[]>;
  listFamilyMembers(): Promise<FamilyMemberInfo[]>;
  createMember(input: MemberInput): Promise<FamilyMemberInfo>;
  updateMember(id: string, input: MemberInput): Promise<FamilyMemberInfo>;
  deleteMember(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: CategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  listAccounts(): Promise<Account[]>;
  listAssetTrend(): Promise<AssetTrendPoint[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;
  updateAccount(id: string, input: UpdateAccountInput): Promise<Account>;
  snapshotAllAccounts(): Promise<{ date: string; count: number }>;
  listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]>;
  deleteAccount(id: string): Promise<void>;
  listTransactions(filter?: { month?: string }): Promise<FinanceTransaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction>;
  updateTransaction(id: string, input: CreateTransactionInput): Promise<FinanceTransaction>;
  deleteTransaction(id: string): Promise<void>;
  importTransactions(input: ImportTransactionsInput): Promise<{ imported: number }>;
  listBudgets(month?: string): Promise<Budget[]>;
  createBudget(input: CreateBudgetInput): Promise<Budget>;
  updateBudget(id: string, input: CreateBudgetInput): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
  listHoldings(): Promise<InvestmentHolding[]>;
  createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding>;
  updateHolding(id: string, input: CreateInvestmentHoldingInput): Promise<InvestmentHolding>;
  deleteHolding(id: string): Promise<void>;
  listLiabilities(): Promise<Liability[]>;
  createLiability(input: CreateLiabilityInput): Promise<Liability>;
  updateLiability(id: string, input: CreateLiabilityInput): Promise<Liability>;
  repayLiability(id: string, input: RepayLiabilityInput): Promise<Liability>;
  deleteLiability(id: string): Promise<void>;
}
