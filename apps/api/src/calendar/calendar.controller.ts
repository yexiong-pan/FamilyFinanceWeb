import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import type {
  CalendarData,
  CalendarEvent,
  CalendarEventInput,
  CalendarEventStatus,
  CalendarEventType,
  CalendarView
} from "@family-finance/shared";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(@Inject(CalendarService) private readonly calendarService: CalendarService) {}

  @Get("events")
  listEvents(
    @Query("memberId") memberId?: string,
    @Query("type") type?: CalendarEventType,
    @Query("status") status?: CalendarEventStatus
  ): Promise<CalendarEvent[]> {
    return this.calendarService.listEvents(memberId, type, status);
  }

  @Post("events")
  createEvent(@Body() input: CalendarEventInput): Promise<CalendarEvent> {
    return this.calendarService.createEvent(input);
  }

  @Patch("events/:id")
  updateEvent(
    @Param("id") id: string,
    @Body() input: CalendarEventInput
  ): Promise<CalendarEvent> {
    return this.calendarService.updateEvent(id, input);
  }

  @Delete("events/:id")
  deleteEvent(@Param("id") id: string): Promise<void> {
    return this.calendarService.deleteEvent(id);
  }

  @Get()
  getCalendar(
    @Query("view") view: CalendarView,
    @Query("period") period: string,
    @Query("memberId") memberId?: string
  ): Promise<CalendarData> {
    return this.calendarService.getCalendar(view, period, memberId);
  }
}
