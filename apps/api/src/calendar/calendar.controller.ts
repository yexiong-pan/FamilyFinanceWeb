import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { CalendarData, CalendarView } from "@family-finance/shared";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendarService: CalendarService) {}

  @Get()
  getCalendar(
    @Query("view") view: CalendarView,
    @Query("period") period: string,
    @Query("memberId") memberId?: string
  ): Promise<CalendarData> {
    return this.calendarService.getCalendar(view, period, memberId);
  }
}
