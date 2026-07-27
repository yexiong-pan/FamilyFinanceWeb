import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import type {
  FinancialSafetyData,
  FinancialSafetySettings,
  MonthlyReviewAction,
  MonthlyReviewDetail,
  MonthlyReviewStatus,
  RecurringCashflow
} from "@family-finance/shared";
import { FinancialPlanningService } from "./financial-planning.service";
import type {
  FinancialSafetySettingsInput,
  MonthlyReviewActionInput,
  MonthlyReviewContentInput,
  RecurringCashflowInput
} from "./financial-planning.types";

@Controller()
export class FinancialPlanningController {
  constructor(
    @Inject(FinancialPlanningService)
    private readonly financialPlanningService: FinancialPlanningService
  ) {}

  @Get("financial-safety")
  getFinancialSafety(@Query("month") month: string): Promise<FinancialSafetyData> {
    return this.financialPlanningService.getFinancialSafety(month);
  }

  @Patch("financial-safety/settings")
  updateFinancialSafetySettings(
    @Body() input: FinancialSafetySettingsInput
  ): Promise<FinancialSafetySettings> {
    return this.financialPlanningService.updateFinancialSafetySettings(input);
  }

  @Post("recurring-cashflows")
  createRecurringCashflow(@Body() input: RecurringCashflowInput): Promise<RecurringCashflow> {
    return this.financialPlanningService.createRecurringCashflow(input);
  }

  @Patch("recurring-cashflows/:id")
  updateRecurringCashflow(
    @Param("id") id: string,
    @Body() input: RecurringCashflowInput
  ): Promise<RecurringCashflow> {
    return this.financialPlanningService.updateRecurringCashflow(id, input);
  }

  @Delete("recurring-cashflows/:id")
  deleteRecurringCashflow(@Param("id") id: string): Promise<void> {
    return this.financialPlanningService.deleteRecurringCashflow(id);
  }

  @Get("monthly-review/detail")
  getMonthlyReviewDetail(@Query("month") month: string): Promise<MonthlyReviewDetail> {
    return this.financialPlanningService.getMonthlyReviewDetail(month);
  }

  @Post("monthly-review/income")
  confirmMonthlyIncome(@Body() input: { month: string }): Promise<MonthlyReviewStatus> {
    return this.financialPlanningService.confirmMonthlyIncome(input.month);
  }

  @Patch("monthly-review/content")
  updateMonthlyReviewContent(
    @Body() input: MonthlyReviewContentInput & { month: string }
  ): Promise<MonthlyReviewDetail> {
    const { month, ...content } = input;
    return this.financialPlanningService.updateMonthlyReviewContent(month, content);
  }

  @Post("monthly-review/complete")
  completeMonthlyReview(@Body() input: { month: string }): Promise<MonthlyReviewDetail> {
    return this.financialPlanningService.completeMonthlyReview(input.month);
  }

  @Post("monthly-review/reopen")
  reopenMonthlyReview(@Body() input: { month: string }): Promise<MonthlyReviewDetail> {
    return this.financialPlanningService.reopenMonthlyReview(input.month);
  }

  @Post("monthly-review/actions")
  createMonthlyReviewAction(
    @Body() input: MonthlyReviewActionInput & { month: string }
  ): Promise<MonthlyReviewAction> {
    const { month, ...action } = input;
    return this.financialPlanningService.createMonthlyReviewAction(month, action);
  }

  @Patch("monthly-review/actions/:id")
  updateMonthlyReviewAction(
    @Param("id") id: string,
    @Body() input: MonthlyReviewActionInput
  ): Promise<MonthlyReviewAction> {
    return this.financialPlanningService.updateMonthlyReviewAction(id, input);
  }

  @Delete("monthly-review/actions/:id")
  deleteMonthlyReviewAction(@Param("id") id: string): Promise<void> {
    return this.financialPlanningService.deleteMonthlyReviewAction(id);
  }
}
