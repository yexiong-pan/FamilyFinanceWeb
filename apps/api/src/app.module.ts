import { Module } from "@nestjs/common";
import { CalendarModule } from "./calendar/calendar.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [FinanceModule, HealthModule, CalendarModule]
})
export class AppModule {}
