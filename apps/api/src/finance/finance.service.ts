import { BadRequestException, Inject, Injectable } from "@nestjs/common";
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
  InvestmentRedemptionInput,
  Liability,
  LiabilityRepaymentRecord,
  MonthlyReviewStatus,
  MonthlySnapshotData,
  MoneyAmount,
  YearlyReportData
} from "@family-finance/shared";
import { calculateDashboardSummary, normalizeMoney } from "@family-finance/shared";
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
import { MortgageService } from "./mortgage.service";
import { buildYearlyReport } from "./yearly-report";

const EMPTY_MORTGAGE_CASHFLOWS = {
  mortgageCashflowObligations: async () => []
} satisfies Pick<MortgageService, "mortgageCashflowObligations">;

@Injectable()
export class FinanceService {
  constructor(
    @Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepository,
    @Inject(MortgageService) private readonly mortgageService: Pick<MortgageService, "mortgageCashflowObligations"> = EMPTY_MORTGAGE_CASHFLOWS
  ) {}

  async getDashboardSummary(month: string): Promise<DashboardSummary> {
    await this.repository.ensureBaseData();
    const monthEnd = `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;
    const [accounts, transactions, budgets, holdings, liabilities, mortgageCashflows] = await Promise.all([
      this.repository.listAccountsForMonth(month),
      this.repository.listTransactions({ month }),
      this.repository.listBudgets(month),
      this.repository.listHoldingsForMonth(month),
      this.repository.listLiabilitiesForMonth(month),
      this.mortgageService.mortgageCashflowObligations(`${month}-01`, monthEnd)
    ]);
    const summary = calculateDashboardSummary({
      month,
      accounts,
      transactions,
      budgets,
      holdings,
      liabilities
    });
    const managedLiabilityIds = new Set(mortgageCashflows.map((cashflow) => cashflow.liabilityId));
    const otherDebtCents = liabilities
      .filter((liability) => liability.status === "active" && !managedLiabilityIds.has(liability.id))
      .reduce((total, liability) => total + Math.round(Number(liability.monthlyPayment ?? "0") * 100), 0);
    const mortgageDueCents = mortgageCashflows.reduce((total, cashflow) => total + Math.round(Number(cashflow.totalAmount) * 100), 0);
    const mortgageOffsetCents = mortgageCashflows.reduce((total, cashflow) => total + Math.round(Number(cashflow.providentFundOffset) * 100), 0);
    const mortgageCashCents = mortgageCashflows.reduce((total, cashflow) => total + Math.round(Number(cashflow.selfFundAmount) * 100), 0);
    return {
      ...summary,
      monthlyDebtPayment: normalizeMoney(((otherDebtCents + mortgageDueCents) / 100).toFixed(2)),
      monthlyDebtCashPayment: normalizeMoney(((otherDebtCents + mortgageCashCents) / 100).toFixed(2)),
      monthlyProvidentFundOffset: normalizeMoney((mortgageOffsetCents / 100).toFixed(2)),
      mortgageCashflows
    };
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

  async updateAccount(id: string, input: UpdateAccountInput, month?: string): Promise<Account> {
    return this.repository.updateAccount(id, input, month);
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

  async updateHolding(id: string, input: CreateInvestmentHoldingInput, month?: string): Promise<InvestmentHolding> {
    return this.repository.updateHolding(id, input, month);
  }

  async deleteHolding(id: string): Promise<void> {
    return this.repository.deleteHolding(id);
  }

  async snapshotAllInvestments(
    month: string,
    redemptions: InvestmentRedemptionInput[] = []
  ): Promise<{ month: string; count: number }> {
    validateInvestmentRedemptions(redemptions);
    return this.repository.snapshotAllInvestments(month, redemptions);
  }

  async listLiabilities(): Promise<Liability[]> {
    return this.repository.listLiabilities();
  }

  async listLiabilitiesForMonth(month: string): Promise<Liability[]> {
    return this.repository.listLiabilitiesForMonth(month);
  }

  async createLiability(input: CreateLiabilityInput): Promise<Liability> {
    validateLiabilityInput(input);
    return this.repository.createLiability(input);
  }

  async updateLiability(id: string, input: CreateLiabilityInput, month?: string): Promise<Liability> {
    validateLiabilityInput(input);
    return this.repository.updateLiability(id, input, month);
  }

  async repayLiability(id: string, input: RepayLiabilityInput, month?: string): Promise<Liability> {
    const repaymentDate = new Date(`${input.date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
      || Number.isNaN(repaymentDate.getTime())
      || repaymentDate.toISOString().slice(0, 10) !== input.date
    ) {
      throw new BadRequestException("还款日期格式必须为 YYYY-MM-DD");
    }
    if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) {
      throw new BadRequestException("还款金额必须大于 0");
    }
    if (month && input.date.slice(0, 7) !== month) {
      throw new BadRequestException("还款日期必须属于当前选择月份");
    }
    return this.repository.repayLiability(id, input, month);
  }

  async listLiabilityRepayments(liabilityId: string): Promise<LiabilityRepaymentRecord[]> {
    return this.repository.listLiabilityRepayments(liabilityId);
  }

  async deleteLiabilityRepayment(id: string): Promise<void> {
    return this.repository.deleteLiabilityRepayment(id);
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

function validateLiabilityInput(input: CreateLiabilityInput): void {
  if (input.repaymentSchedule !== "monthly") return;
  if (!Number.isFinite(Number(input.monthlyPayment)) || Number(input.monthlyPayment) <= 0) {
    throw new BadRequestException("固定月还负债必须填写大于 0 的月供");
  }
  const paymentDay = input.paymentDay;
  if (paymentDay === undefined || !Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    throw new BadRequestException("固定月还负债必须填写 1 至 31 日的还款日");
  }
}

function validateInvestmentRedemptions(redemptions: InvestmentRedemptionInput[]): void {
  const holdingIds = new Set<string>();
  for (const redemption of redemptions) {
    if (holdingIds.has(redemption.holdingId)) {
      throw new BadRequestException("同一持仓每月只能提交一组赎回汇总");
    }
    holdingIds.add(redemption.holdingId);
    const amount = Number(redemption.redemptionAmount);
    const contribution = Number(redemption.contributionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("赎回到账金额必须大于 0");
    }
    if (!Number.isFinite(contribution) || contribution < 0) {
      throw new BadRequestException("发生赎回时，本月申购总额必须大于或等于 0");
    }
  }
}
