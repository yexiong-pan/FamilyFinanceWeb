import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import type {
  Account,
  AccountSnapshotRecord,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";
import { FinanceService } from "./finance.service";
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

  @Get("accounts")
  listAccounts(): Promise<Account[]> {
    return this.financeService.listAccounts();
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
  snapshotAllAccounts(): Promise<{ date: string; count: number }> {
    return this.financeService.snapshotAllAccounts();
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

  @Post("transactions")
  createTransaction(@Body() input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.financeService.createTransaction(input);
  }

  @Post("transactions/import")
  importTransactions(@Body() input: ImportTransactionsInput): Promise<{ imported: number }> {
    return this.financeService.importTransactions(input);
  }

  @Patch("transactions/:id")
  updateTransaction(
    @Param("id") id: string,
    @Body() input: CreateTransactionInput
  ): Promise<FinanceTransaction> {
    return this.financeService.updateTransaction(id, input);
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
  listHoldings(): Promise<InvestmentHolding[]> {
    return this.financeService.listHoldings();
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

  @Get("liabilities")
  listLiabilities(): Promise<Liability[]> {
    return this.financeService.listLiabilities();
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
}
