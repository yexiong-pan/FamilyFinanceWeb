import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import type { MortgageMonthlyRepayment, MortgageRecord, ProvidentFundAccount } from "@family-finance/shared";
import { MortgageService } from "./mortgage.service";
import type { ConfirmMortgageMonthlyRepaymentInput, CreateMortgageInput, MortgageProvidentFundParticipantInput, PreviewRateAdjustmentInput, ProvidentFundAccountInput, ProvidentFundContributionRateInput } from "./mortgage.types";

@Controller("mortgages")
export class MortgageController {
  constructor(@Inject(MortgageService) private readonly mortgageService: MortgageService) {}

  @Get()
  list(): Promise<MortgageRecord[]> { return this.mortgageService.listMortgages(); }

  @Get("overview")
  overview(@Query("month") month: string) { return this.mortgageService.overview(month); }

  @Get("planning")
  planning(@Query("month") month: string) { return this.mortgageService.planning(month); }

  @Get("monthly-repayments")
  monthlyRepayments(@Query("month") month: string): Promise<MortgageMonthlyRepayment[]> { return this.mortgageService.monthlyRepayments(month); }

  @Post()
  create(@Body() input: CreateMortgageInput): Promise<MortgageRecord> { return this.mortgageService.createMortgage(input); }

  @Post(":id/monthly-repayments/confirm")
  confirmMonthlyRepayment(@Param("id") id: string, @Body() input: ConfirmMortgageMonthlyRepaymentInput): Promise<MortgageMonthlyRepayment> {
    return this.mortgageService.confirmMonthlyRepayment(id, input);
  }

  @Get("provident-fund-accounts")
  listProvidentFundAccounts(): Promise<ProvidentFundAccount[]> { return this.mortgageService.listProvidentFundAccounts(); }

  @Post("provident-fund-accounts")
  saveProvidentFundAccount(@Body() input: ProvidentFundAccountInput): Promise<ProvidentFundAccount> { return this.mortgageService.saveProvidentFundAccount(input); }

  @Post("provident-fund-accounts/:id/contribution-rates")
  saveContributionRate(@Param("id") id: string, @Body() input: ProvidentFundContributionRateInput): Promise<ProvidentFundAccount> {
    return this.mortgageService.saveContributionRate(id, input);
  }

  @Post(":id/rate-adjustments/preview")
  previewRateAdjustment(@Param("id") id: string, @Body() input: PreviewRateAdjustmentInput) { return this.mortgageService.previewRateAdjustment(id, input); }

  @Post(":id/rate-adjustments/apply")
  applyRateAdjustment(@Param("id") id: string, @Body() input: PreviewRateAdjustmentInput): Promise<MortgageRecord> { return this.mortgageService.applyRateAdjustment(id, input); }

  @Post(":id/provident-fund-participants")
  saveProvidentFundParticipants(@Param("id") id: string, @Body() input: MortgageProvidentFundParticipantInput): Promise<MortgageRecord> {
    return this.mortgageService.saveProvidentFundParticipants(id, input);
  }
}
