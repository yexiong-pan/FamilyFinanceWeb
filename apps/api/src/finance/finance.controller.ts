import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import type {
  Account,
  AccountSnapshotRecord,
  AccountTypeOption,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  ImportTransactionsResult,
  InvestmentHolding,
  Liability,
  MonthlyReviewStatus,
  MonthlySnapshotData,
  YearlyReportData
} from "@family-finance/shared";
import { FinanceService } from "./finance.service";
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

@Controller()
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly financeService: FinanceService) {}

  @Get("dashboard/summary")
  getDashboardSummary(@Query("month") month = "2026-06") {
    return this.financeService.getDashboardSummary(month);
  }

  @Get("members")
  listMembers(): Promise<string[]> {
    return this.financeService.listMembers();
  }

  @Get("family-members")
  listFamilyMembers(): Promise<FamilyMemberInfo[]> {
    return this.financeService.listFamilyMembers();
  }

  @Post("family-members")
  createMember(@Body() input: MemberInput): Promise<FamilyMemberInfo> {
    return this.financeService.createMember(input);
  }

  @Patch("family-members/:id")
  updateMember(@Param("id") id: string, @Body() input: MemberInput): Promise<FamilyMemberInfo> {
    return this.financeService.updateMember(id, input);
  }

  @Delete("family-members/:id")
  deleteMember(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteMember(id);
  }

  @Get("account-types")
  listAccountTypes(): Promise<AccountTypeOption[]> {
    return this.financeService.listAccountTypes();
  }

  @Post("account-types")
  createAccountType(@Body() input: AccountTypeInput): Promise<AccountTypeOption> {
    return this.financeService.createAccountType(input);
  }

  @Patch("account-types/:id")
  updateAccountType(@Param("id") id: string, @Body() input: AccountTypeInput): Promise<AccountTypeOption> {
    return this.financeService.updateAccountType(id, input);
  }

  @Delete("account-types/:id")
  deleteAccountType(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteAccountType(id);
  }

  @Get("categories")
  listCategories(): Promise<Category[]> {
    return this.financeService.listCategories();
  }

  @Post("categories")
  createCategory(@Body() input: CategoryInput): Promise<Category> {
    return this.financeService.createCategory(input);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() input: CategoryInput): Promise<Category> {
    return this.financeService.updateCategory(id, input);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteCategory(id);
  }

  @Get("category-mappings")
  listCategoryMappings(): Promise<CategoryMapping[]> {
    return this.financeService.listCategoryMappings();
  }

  @Post("category-mappings")
  createCategoryMapping(@Body() input: CategoryMappingInput): Promise<CategoryMapping> {
    return this.financeService.createCategoryMapping(input);
  }

  @Patch("category-mappings/:id")
  updateCategoryMapping(@Param("id") id: string, @Body() input: CategoryMappingInput): Promise<CategoryMapping> {
    return this.financeService.updateCategoryMapping(id, input);
  }

  @Delete("category-mappings/:id")
  deleteCategoryMapping(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteCategoryMapping(id);
  }

  @Get("accounts")
  listAccounts(@Query("month") month?: string): Promise<Account[]> {
    return month ? this.financeService.listAccountsForMonth(month) : this.financeService.listAccounts();
  }

  @Get("dashboard/asset-trend")
  getAssetTrend(): Promise<AssetTrendPoint[]> {
    return this.financeService.getAssetTrend();
  }

  @Post("accounts")
  createAccount(@Body() input: CreateAccountInput): Promise<Account> {
    return this.financeService.createAccount(input);
  }

  @Patch("accounts/:id")
  updateAccount(@Param("id") id: string, @Body() input: UpdateAccountInput): Promise<Account> {
    return this.financeService.updateAccount(id, input);
  }

  @Post("accounts/snapshots")
  snapshotAllAccounts(@Body() input: { month?: string }): Promise<{ date: string; count: number }> {
    return this.financeService.snapshotAllAccounts(input.month);
  }

  @Get("accounts/:id/snapshots")
  listAccountSnapshots(@Param("id") id: string): Promise<{ date: string; value: string }[]> {
    return this.financeService.listAccountSnapshots(id);
  }

  @Get("accounts/snapshots")
  listAllSnapshots(
    @Query("accountId") accountId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ): Promise<AccountSnapshotRecord[]> {
    return this.financeService.listAllSnapshots({ accountId, from, to });
  }

  @Delete("accounts/snapshots/:id")
  deleteSnapshot(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteSnapshot(id);
  }

  @Delete("accounts/:id")
  deleteAccount(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteAccount(id);
  }

  @Get("transactions")
  listTransactions(@Query("month") month?: string): Promise<FinanceTransaction[]> {
    return this.financeService.listTransactions({ month });
  }

  @Get("transactions/page")
  listTransactionsPage(
    @Query("month") month: string,
    @Query("kind") kind: "expense" | "income",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("category") category?: string,
    @Query("member") member?: string,
    @Query("status") status?: "pending" | "confirmed",
    @Query("min") min?: string,
    @Query("max") max?: string
  ) {
    return this.financeService.listTransactionsPage({
      month,
      kind,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
      category,
      member,
      status,
      ...(min === undefined ? {} : { min: Number(min) }),
      ...(max === undefined ? {} : { max: Number(max) })
    });
  }

  @Post("transactions")
  createTransaction(@Body() input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.financeService.createTransaction(input);
  }

  @Post("transactions/import")
  importTransactions(@Body() input: ImportTransactionsInput): Promise<ImportTransactionsResult> {
    return this.financeService.importTransactions(input);
  }

  @Patch("transactions/:id")
  updateTransaction(
    @Param("id") id: string,
    @Body() input: CreateTransactionInput
  ): Promise<FinanceTransaction> {
    return this.financeService.updateTransaction(id, input);
  }

  @Post("transactions/:id/confirm")
  confirmTransaction(@Param("id") id: string): Promise<FinanceTransaction> {
    return this.financeService.confirmTransaction(id);
  }

  @Delete("transactions/:id")
  deleteTransaction(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteTransaction(id);
  }

  @Get("budgets")
  listBudgets(@Query("month") month?: string): Promise<Budget[]> {
    return this.financeService.listBudgets(month);
  }

  @Post("budgets")
  createBudget(@Body() input: CreateBudgetInput): Promise<Budget> {
    return this.financeService.createBudget(input);
  }

  @Patch("budgets/:id")
  updateBudget(@Param("id") id: string, @Body() input: CreateBudgetInput): Promise<Budget> {
    return this.financeService.updateBudget(id, input);
  }

  @Delete("budgets/:id")
  deleteBudget(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteBudget(id);
  }

  @Get("investments")
  listHoldings(@Query("month") month?: string): Promise<InvestmentHolding[]> {
    return month ? this.financeService.listHoldingsForMonth(month) : this.financeService.listHoldings();
  }

  @Post("investments")
  createHolding(@Body() input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.financeService.createHolding(input);
  }

  @Patch("investments/:id")
  updateHolding(
    @Param("id") id: string,
    @Body() input: CreateInvestmentHoldingInput
  ): Promise<InvestmentHolding> {
    return this.financeService.updateHolding(id, input);
  }

  @Delete("investments/:id")
  deleteHolding(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteHolding(id);
  }

  @Post("investments/snapshots")
  snapshotAllInvestments(@Body() input: { month: string }) {
    return this.financeService.snapshotAllInvestments(input.month);
  }

  @Get("liabilities")
  listLiabilities(@Query("month") month?: string): Promise<Liability[]> {
    return month ? this.financeService.listLiabilitiesForMonth(month) : this.financeService.listLiabilities();
  }

  @Post("liabilities")
  createLiability(@Body() input: CreateLiabilityInput): Promise<Liability> {
    return this.financeService.createLiability(input);
  }

  @Patch("liabilities/:id")
  updateLiability(@Param("id") id: string, @Body() input: CreateLiabilityInput): Promise<Liability> {
    return this.financeService.updateLiability(id, input);
  }

  @Post("liabilities/:id/repay")
  repayLiability(@Param("id") id: string, @Body() input: RepayLiabilityInput): Promise<Liability> {
    return this.financeService.repayLiability(id, input);
  }

  @Delete("liabilities/:id")
  deleteLiability(@Param("id") id: string): Promise<void> {
    return this.financeService.deleteLiability(id);
  }


  @Post("liabilities/snapshots")
  snapshotAllLiabilities(@Body() input: { month: string }) {
    return this.financeService.snapshotAllLiabilities(input.month);
  }

  @Get("monthly-review")
  getMonthlyReview(@Query("month") month: string): Promise<MonthlyReviewStatus> {
    return this.financeService.getMonthlyReview(month);
  }

  @Get("monthly-snapshots")
  getMonthlySnapshot(@Query("month") month: string): Promise<MonthlySnapshotData> {
    return this.financeService.getMonthlySnapshot(month);
  }

  @Get("reports/yearly")
  getYearlyReport(@Query("year") year: string): Promise<YearlyReportData> {
    return this.financeService.getYearlyReport(year);
  }

  @Post("monthly-review/spending")
  confirmMonthlySpending(@Body() input: { month: string }): Promise<MonthlyReviewStatus> {
    return this.financeService.confirmMonthlySpending(input.month);
  }
}
