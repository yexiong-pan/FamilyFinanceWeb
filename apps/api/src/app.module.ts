import { Module } from "@nestjs/common";
import { CalendarModule } from "./calendar/calendar.module";
import { AuthModule } from "./auth/auth.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [AuthModule, FinanceModule, HealthModule, CalendarModule]
})
export class AppModule {}
