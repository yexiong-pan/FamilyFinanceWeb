import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import type { Account, Budget, FinanceTransaction, InvestmentHolding } from "@family-finance/shared";
import { FinanceService } from "./finance.service";
import type {
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateTransactionInput
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

  @Get("categories")
  listCategories(): Promise<Category[]> {
    return this.financeService.listCategories();
  }

  @Get("accounts")
  listAccounts(): Promise<Account[]> {
    return this.financeService.listAccounts();
  }

  @Post("accounts")
  createAccount(@Body() input: CreateAccountInput): Promise<Account> {
    return this.financeService.createAccount(input);
  }

  @Get("transactions")
  listTransactions(@Query("month") month?: string): Promise<FinanceTransaction[]> {
    return this.financeService.listTransactions({ month });
  }

  @Post("transactions")
  createTransaction(@Body() input: CreateTransactionInput): Promise<FinanceTransaction> {
    return this.financeService.createTransaction(input);
  }

  @Get("budgets")
  listBudgets(@Query("month") month?: string): Promise<Budget[]> {
    return this.financeService.listBudgets(month);
  }

  @Post("budgets")
  createBudget(@Body() input: CreateBudgetInput): Promise<Budget> {
    return this.financeService.createBudget(input);
  }

  @Get("investments")
  listHoldings(): Promise<InvestmentHolding[]> {
    return this.financeService.listHoldings();
  }

  @Post("investments")
  createHolding(@Body() input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    return this.financeService.createHolding(input);
  }
}
