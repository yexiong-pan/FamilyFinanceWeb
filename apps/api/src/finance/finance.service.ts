import { Inject, Injectable } from "@nestjs/common";
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  DashboardSummary,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
import { calculateDashboardSummary } from "@family-finance/shared";
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
import {
  FINANCE_REPOSITORY,
  type FinanceRepository
} from "./finance.repository";

@Injectable()
export class FinanceService {
  constructor(@Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepository) {}

  async getDashboardSummary(month: string): Promise<DashboardSummary> {
    await this.repository.ensureBaseData();
    const [accounts, transactions, budgets, holdings, liabilities] = await Promise.all([
      this.repository.listAccounts(),
      this.repository.listTransactions({ month }),
      this.repository.listBudgets(month),
      this.repository.listHoldings(),
      this.repository.listLiabilities()
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

  async listAccounts(): Promise<Account[]> {
    return this.repository.listAccounts();
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

  async snapshotAllAccounts(): Promise<{ date: string; count: number }> {
    return this.repository.snapshotAllAccounts();
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

  async createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.repository.createTransaction(input);
  }

  async updateTransaction(id: string, input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.repository.updateTransaction(id, input);
  }

  async deleteTransaction(id: string): Promise<void> {
    return this.repository.deleteTransaction(id);
  }

  async importTransactions(input: ImportTransactionsInput): Promise<{ imported: number }> {
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

  async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.repository.createHolding(input);
  }

  async updateHolding(id: string, input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.repository.updateHolding(id, input);
  }

  async deleteHolding(id: string): Promise<void> {
    return this.repository.deleteHolding(id);
  }

  async listLiabilities(): Promise<Liability[]> {
    return this.repository.listLiabilities();
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
}
