import { Inject, Injectable } from "@nestjs/common";
import type {
  Account,
  AccountSnapshotRecord,
  AccountTypeOption,
  AssetTrendPoint,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionsResult,
  InvestmentHolding,
  Liability,
  MonthlyReviewStatus,
  MonthlySnapshotData,
  MoneyAmount,
  YearlyReportData
} from "@family-finance/shared";
import { calculateDashboardSummary } from "@family-finance/shared";
import type {
  AccountTypeInput,
  Category,
  CategoryMapping,
  CategoryMappingInput,
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
import {
  FINANCE_REPOSITORY,
  type FinanceRepository
} from "./finance.repository";
import { buildYearlyReport } from "./yearly-report";

@Injectable()
export class FinanceService {
  constructor(@Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepository) {}

  async getDashboardSummary(month: string): Promise<DashboardSummary> {
    await this.repository.ensureBaseData();
    const [accounts, transactions, budgets, holdings, liabilities] = await Promise.all([
      this.repository.listAccountsForMonth(month),
      this.repository.listTransactions({ month }),
      this.repository.listBudgets(month),
      this.repository.listHoldingsForMonth(month),
      this.repository.listLiabilitiesForMonth(month)
    ]);
    return calculateDashboardSummary({
      month,
      accounts,
      transactions,
      budgets,
      holdings,
      liabilities
    });
  }

  async listMembers(): Promise<string[]> {
    return this.repository.listMembers();
  }

  async listFamilyMembers(): Promise<FamilyMemberInfo[]> {
    return this.repository.listFamilyMembers();
  }

  async createMember(input: MemberInput): Promise<FamilyMemberInfo> {
    return this.repository.createMember(input);
  }

  async updateMember(id: string, input: MemberInput): Promise<FamilyMemberInfo> {
    return this.repository.updateMember(id, input);
  }

  async deleteMember(id: string): Promise<void> {
    return this.repository.deleteMember(id);
  }

  async listAccountTypes(): Promise<AccountTypeOption[]> {
    return this.repository.listAccountTypes();
  }

  async createAccountType(input: AccountTypeInput): Promise<AccountTypeOption> {
    return this.repository.createAccountType(input);
  }

  async updateAccountType(id: string, input: AccountTypeInput): Promise<AccountTypeOption> {
    return this.repository.updateAccountType(id, input);
  }

  async deleteAccountType(id: string): Promise<void> {
    return this.repository.deleteAccountType(id);
  }

  async listCategories(): Promise<Category[]> {
    return this.repository.listCategories();
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    return this.repository.createCategory(input);
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    return this.repository.updateCategory(id, input);
  }

  async deleteCategory(id: string): Promise<void> {
    return this.repository.deleteCategory(id);
  }

  async listCategoryMappings(): Promise<CategoryMapping[]> {
    return this.repository.listCategoryMappings();
  }

  async createCategoryMapping(input: CategoryMappingInput): Promise<CategoryMapping> {
    return this.repository.createCategoryMapping(input);
  }

  async updateCategoryMapping(id: string, input: CategoryMappingInput): Promise<CategoryMapping> {
    return this.repository.updateCategoryMapping(id, input);
  }

  async deleteCategoryMapping(id: string): Promise<void> {
    return this.repository.deleteCategoryMapping(id);
  }

  async listAccounts(): Promise<Account[]> {
    return this.repository.listAccounts();
  }

  async listAccountsForMonth(month: string): Promise<Account[]> {
    return this.repository.listAccountsForMonth(month);
  }

  async getAssetTrend(): Promise<AssetTrendPoint[]> {
    return this.repository.listAssetTrend();
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    return this.repository.createAccount(input);
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
    return this.repository.updateAccount(id, input);
  }

  async snapshotAllAccounts(month?: string): Promise<{ date: string; count: number }> {
    return this.repository.snapshotAllAccounts(month);
  }

  async listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]> {
    return this.repository.listAccountSnapshots(accountId);
  }

  async listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]> {
    return this.repository.listAllSnapshots(filter);
  }

  async deleteSnapshot(id: string): Promise<void> {
    return this.repository.deleteSnapshot(id);
  }

  async deleteAccount(id: string): Promise<void> {
    return this.repository.deleteAccount(id);
  }

  async listTransactions(filter: { month?: string } = {}): Promise<FinanceTransaction[]> {
    return this.repository.listTransactions(filter);
  }

  async listTransactionsPage(filter: import("@family-finance/shared").TransactionPageFilter) {
    return this.repository.listTransactionsPage(filter);
  }

  async createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.repository.createTransaction(input);
  }

  async updateTransaction(id: string, input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.repository.updateTransaction(id, input);
  }

  async confirmTransaction(id: string): Promise<FinanceTransaction> {
    return this.repository.confirmTransaction(id);
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.repository.deleteTransaction(id);
  }

  async importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsResult> {
    return this.repository.importTransactions(input);
  }

  async listBudgets(month?: string): Promise<Budget[]> {
    return this.repository.listBudgets(month);
  }

  async createBudget(input: CreateBudgetInput): Promise<Budget> {
    return this.repository.createBudget(input);
  }

  async updateBudget(id: string, input: CreateBudgetInput): Promise<Budget> {
    return this.repository.updateBudget(id, input);
  }

  async deleteBudget(id: string): Promise<void> {
    return this.repository.deleteBudget(id);
  }

  async listHoldings(): Promise<InvestmentHolding[]> {
    return this.repository.listHoldings();
  }

  async listHoldingsForMonth(month: string): Promise<InvestmentHolding[]> {
    return this.repository.listHoldingsForMonth(month);
  }

  async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.repository.createHolding(input);
  }

  async updateHolding(id: string, input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.repository.updateHolding(id, input);
  }

  async deleteHolding(id: string): Promise<void> {
    return this.repository.deleteHolding(id);
  }

  async snapshotAllInvestments(month: string): Promise<{ month: string; count: number }> {
    return this.repository.snapshotAllInvestments(month);
  }

  async listLiabilities(): Promise<Liability[]> {
    return this.repository.listLiabilities();
  }

  async listLiabilitiesForMonth(month: string): Promise<Liability[]> {
    return this.repository.listLiabilitiesForMonth(month);
  }

  async createLiability(input: CreateLiabilityInput): Promise<Liability> {
    return this.repository.createLiability(input);
  }

  async updateLiability(id: string, input: CreateLiabilityInput): Promise<Liability> {
    return this.repository.updateLiability(id, input);
  }

  async repayLiability(id: string, input: RepayLiabilityInput): Promise<Liability> {
    return this.repository.repayLiability(id, input);
  }

  async deleteLiability(id: string): Promise<void> {
    return this.repository.deleteLiability(id);
  }


  async snapshotAllLiabilities(month: string): Promise<{ month: string; count: number }> {
    return this.repository.snapshotAllLiabilities(month);
  }

  async getMonthlyReview(month: string): Promise<MonthlyReviewStatus> {
    return this.repository.getMonthlyReview(month);
  }

  async getMonthlySnapshot(month: string): Promise<MonthlySnapshotData> {
    return this.repository.getMonthlySnapshot(month);
  }

  async getYearlyReport(year: string): Promise<YearlyReportData> {
    const [transactions, previousYearTransactions, members, snapshots] = await Promise.all([
      this.repository.listTransactionsForYear(year),
      this.repository.listTransactionsForYear(String(Number(year) - 1)),
      this.repository.listMembers(),
      this.repository.listAnnualSnapshotSummaries(year)
    ]);
    return buildYearlyReport({ year, transactions, previousYearTransactions, members, snapshots });
  }

  async confirmMonthlySpending(month: string): Promise<MonthlyReviewStatus> {
    return this.repository.confirmMonthlySpending(month);
  }
}
