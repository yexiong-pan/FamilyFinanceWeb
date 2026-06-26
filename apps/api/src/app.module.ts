import { Module } from "@nestjs/common";
import { FinanceModule } from "./finance/finance.module";

@Module({
  imports: [FinanceModule]
})
export class AppModule {}
