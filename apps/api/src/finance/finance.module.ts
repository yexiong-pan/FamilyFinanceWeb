import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FinanceController } from "./finance.controller";
import { FINANCE_REPOSITORY } from "./finance.repository";
import { FinanceService } from "./finance.service";
import { PrismaFinanceRepository } from "./prisma-finance.repository";
import { FinancialPlanningController } from "./financial-planning.controller";
import { FinancialPlanningService } from "./financial-planning.service";
import { MortgageController } from "./mortgage.controller";
import { MortgageService } from "./mortgage.service";

@Module({
  controllers: [FinanceController, FinancialPlanningController, MortgageController],
  providers: [
    PrismaService,
    PrismaFinanceRepository,
    {
      provide: FINANCE_REPOSITORY,
      useExisting: PrismaFinanceRepository
    },
    FinanceService,
    FinancialPlanningService,
    MortgageService
  ],
  exports: [FinanceService]
})
export class FinanceModule {}
