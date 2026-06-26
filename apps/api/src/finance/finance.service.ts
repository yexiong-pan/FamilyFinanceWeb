import { Inject, Injectable } from "@nestjs/common";
import type {
  Account,
  Budget,
  DashboardSummary,
  FinanceTransaction,
  InvestmentHolding
} from "@family-finance/shared";
import { calculateDashboardSummary } from "@family-finance/shared";
import type {
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateTransactionInput
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
    const [accounts, transactions, budgets, holdings] = await Promise.all([
      this.repository.listAccounts(),
      this.repository.listTransactions({ month }),
      this.repository.listBudgets(month),
      this.repository.listHoldings()
    ]);
    return calculateDashboardSummary({
      month,
      accounts,
      transactions,
      budgets,
      holdings
    });
  }

  async listMembers(): Promise<string[]> {
    return this.repository.listMembers();
  }

  async listCategories(): Promise<Category[]> {
    return this.repository.listCategories();
  }

  async listAccounts(): Promise<Account[]> {
    return this.repository.listAccounts();
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    return this.repository.createAccount(input);
  }

  async listTransactions(filter: { month?: string } = {}): Promise<FinanceTransaction[]> {
    return this.repository.listTransactions(filter);
  }

  async createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.repository.createTransaction(input);
  }

  async listBudgets(month?: string): Promise<Budget[]> {
    return this.repository.listBudgets(month);
  }

  async createBudget(input: CreateBudgetInput): Promise<Budget> {
    return this.repository.createBudget(input);
  }

  async listHoldings(): Promise<InvestmentHolding[]> {
    return this.repository.listHoldings();
  }

  async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.repository.createHolding(input);
  }
}
