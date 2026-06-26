import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { FinanceController } from "./finance.controller";
import { FINANCE_REPOSITORY } from "./finance.repository";
import { FinanceService } from "./finance.service";
import { PrismaFinanceRepository } from "./prisma-finance.repository";

@Module({
  controllers: [FinanceController],
  providers: [
    PrismaService,
    PrismaFinanceRepository,
    {
      provide: FINANCE_REPOSITORY,
      useExisting: PrismaFinanceRepository
    },
    FinanceService
  ],
  exports: [FinanceService]
})
export class FinanceModule {}
