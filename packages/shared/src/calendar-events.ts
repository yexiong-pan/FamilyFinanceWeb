import { Lunar, Solar } from "lunar-typescript";
import type {
  CalendarEvent,
  CalendarEventOccurrence,
  CalendarLunarInfo
} from "./calendar.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function calendarLunarInfo(date: string): CalendarLunarInfo {
  const { year, month, day } = parseDateKey(date);
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const lunarMonth = lunar.getMonth();
  const solarTerm = lunar.getJieQi() || undefined;
  const festival = lunar.getFestivals()[0]
    ?? lunar.getOtherFestivals()[0]
    ?? undefined;
  const monthLabel = `${lunarMonth < 0 ? "闰" : ""}${lunar.getMonthInChinese()}月`;
  const dayLabel = lunar.getDayInChinese();
  return {
    date,
    year: lunar.getYear(),
    month: Math.abs(lunarMonth),
    day: lunar.getDay(),
    leapMonth: lunarMonth < 0,
    shortLabel: solarTerm ?? festival ?? (lunar.getDay() === 1 ? monthLabel : dayLabel),
    fullLabel: `农历${monthLabel}${dayLabel}`,
    ...(festival ? { festival } : {}),
    ...(solarTerm ? { solarTerm } : {})
  };
}

export function buildCalendarEventOccurrences(
  event: CalendarEvent,
  rangeStart: string,
  rangeEnd: string,
  today: string
): CalendarEventOccurrence[] {
  parseDateKey(rangeStart);
  parseDateKey(rangeEnd);
  const dates = occurrenceDates(event, rangeStart, rangeEnd);
  return dates.map((date) => {
    const occurrenceYear = Number(date.slice(0, 4));
    const countdownDays = event.showCountdown ? daysBetween(today, date) : undefined;
    const anniversaryYears = event.type === "anniversary" && event.originalYear
      ? Math.max(0, occurrenceYear - event.originalYear)
      : undefined;
    return {
      eventId: event.id,
      date,
      title: event.title,
      type: event.type,
      calendarSystem: event.calendarSystem,
      ...(event.startTime ? { startTime: event.startTime } : {}),
      ...(event.endTime ? { endTime: event.endTime } : {}),
      allDay: event.allDay,
      showCountdown: event.showCountdown,
      ...(countdownDays === undefined ? {} : { countdownDays }),
      ...(anniversaryYears === undefined ? {} : { anniversaryYears }),
      ...(event.calendarSystem === "lunar" ? { lunarLabel: calendarLunarInfo(date).fullLabel } : {}),
      ...(event.location ? { location: event.location } : {}),
      status: event.status,
      participants: event.participants
    };
  });
}

function occurrenceDates(event: CalendarEvent, rangeStart: string, rangeEnd: string): string[] {
  if (event.status === "cancelled") return [];
  const effectiveEnd = event.recurrenceEndDate && event.recurrenceEndDate < rangeEnd
    ? event.recurrenceEndDate
    : rangeEnd;
  if (effectiveEnd < rangeStart) return [];

  if (event.calendarSystem === "lunar") {
    return lunarOccurrenceDates(event, rangeStart, effectiveEnd);
  }

  if (event.recurrence === "none") {
    return event.startDate >= rangeStart && event.startDate <= effectiveEnd
      ? [event.startDate]
      : [];
  }

  const dates: string[] = [];
  let cursor = event.startDate;
  if (event.recurrence === "daily" || event.recurrence === "weekly") {
    const step = event.recurrence === "daily" ? 1 : 7;
    if (cursor < rangeStart) {
      const elapsed = daysBetween(cursor, rangeStart);
      cursor = addDays(cursor, Math.floor(elapsed / step) * step);
      while (cursor < rangeStart) cursor = addDays(cursor, step);
    }
    while (cursor <= effectiveEnd) {
      dates.push(cursor);
      cursor = addDays(cursor, step);
    }
    return dates;
  }

  const start = parseDateKey(event.startDate);
  const firstRange = parseDateKey(rangeStart);
  const lastRange = parseDateKey(effectiveEnd);
  if (event.recurrence === "monthly") {
    let year = firstRange.year;
    let month = firstRange.month;
    while (year < lastRange.year || (year === lastRange.year && month <= lastRange.month)) {
      const candidate = dateWithClampedDay(year, month, start.day);
      if (candidate >= event.startDate && candidate >= rangeStart && candidate <= effectiveEnd) {
        dates.push(candidate);
      }
      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }
    return dates;
  }

  for (let year = firstRange.year; year <= lastRange.year; year += 1) {
    const candidate = dateWithClampedDay(year, start.month, start.day);
    if (candidate >= event.startDate && candidate >= rangeStart && candidate <= effectiveEnd) {
      dates.push(candidate);
    }
  }
  return dates;
}

function lunarOccurrenceDates(
  event: CalendarEvent,
  rangeStart: string,
  rangeEnd: string
): string[] {
  if (!event.lunarMonth || !event.lunarDay) return [];
  const firstYear = Number(rangeStart.slice(0, 4)) - 1;
  const lastYear = Number(rangeEnd.slice(0, 4)) + 1;
  const dates: string[] = [];
  for (let lunarYear = firstYear; lunarYear <= lastYear; lunarYear += 1) {
    const date = lunarToSolarDate(
      lunarYear,
      event.lunarMonth,
      event.lunarDay,
      event.lunarLeapMonth
    );
    if (date && date >= event.startDate && date >= rangeStart && date <= rangeEnd) {
      dates.push(date);
    }
  }
  return [...new Set(dates)].sort();
}

function lunarToSolarDate(
  year: number,
  month: number,
  day: number,
  leapMonth: boolean
): string | undefined {
  const lunarMonth = leapMonth ? -month : month;
  for (let candidateDay = day; candidateDay >= Math.max(1, day - 1); candidateDay -= 1) {
    try {
      const solar = Lunar.fromYmd(year, lunarMonth, candidateDay).getSolar();
      return formatDateKey(solar.getYear(), solar.getMonth(), solar.getDay());
    } catch {
      if (leapMonth) return undefined;
    }
  }
  return undefined;
}

function dateWithClampedDay(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatDateKey(year, month, Math.min(day, lastDay));
}

function addDays(date: string, amount: number): string {
  const { year, month, day } = parseDateKey(date);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return formatDateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function daysBetween(from: string, to: string): number {
  const left = parseDateKey(from);
  const right = parseDateKey(to);
  const leftTime = Date.UTC(left.year, left.month - 1, left.day);
  const rightTime = Date.UTC(right.year, right.month - 1, right.day);
  return Math.round((rightTime - leftTime) / 86_400_000);
}

function parseDateKey(date: string): { year: number; month: number; day: number } {
  if (!DATE_PATTERN.test(date)) throw new Error(`Invalid date: ${date}`);
  const parts = date.split("-");
  const year = Number(parts[0]!);
  const month = Number(parts[1]!);
  const day = Number(parts[2]!);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year
    || value.getUTCMonth() + 1 !== month
    || value.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${date}`);
  }
  return { year, month, day };
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
