import type {
  GlucoseContext,
  HealthFollowupStatus
} from "./health.js";

export type CalendarView = "month" | "year";
export type CalendarEventType = "schedule" | "anniversary";
export type CalendarSystem = "solar" | "lunar";
export type CalendarRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export interface CalendarEventParticipant {
  memberId: string;
  memberName: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  calendarSystem: CalendarSystem;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  recurrenceEndDate?: string;
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth: boolean;
  originalYear?: number;
  showCountdown: boolean;
  reminderDays: number[];
  location?: string;
  note?: string;
  status: CalendarEventStatus;
  participants: CalendarEventParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title: string;
  type: CalendarEventType;
  calendarSystem: CalendarSystem;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  recurrenceEndDate?: string;
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
  originalYear?: number;
  showCountdown?: boolean;
  reminderDays?: number[];
  location?: string;
  note?: string;
  status?: CalendarEventStatus;
  memberIds: string[];
}

export interface CalendarEventOccurrence {
  eventId: string;
  date: string;
  title: string;
  type: CalendarEventType;
  calendarSystem: CalendarSystem;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  showCountdown: boolean;
  countdownDays?: number;
  anniversaryYears?: number;
  lunarLabel?: string;
  location?: string;
  status: CalendarEventStatus;
  participants: CalendarEventParticipant[];
}

export interface CalendarLunarInfo {
  date: string;
  year: number;
  month: number;
  day: number;
  leapMonth: boolean;
  shortLabel: string;
  fullLabel: string;
  festival?: string;
  solarTerm?: string;
}

export interface CalendarGlucoseReading {
  id: string;
  memberId: string;
  memberName: string;
  measuredAt: string;
  value: string;
  context: GlucoseContext;
  abnormal: boolean;
}

export interface CalendarFollowupItem {
  id: string;
  memberId: string;
  memberName: string;
  scheduledAt: string;
  type: string;
  status: HealthFollowupStatus;
  hospital?: string;
  department?: string;
}

export interface CalendarMedicationSummary {
  scheduled: number;
  taken: number;
  missed: number;
  paused: number;
  pending: number;
  completionRate?: number;
}

export type CalendarDayEntryType =
  | "income"
  | "expense"
  | "glucose"
  | "exercise"
  | "medication"
  | "weight"
  | "followup"
  | "schedule"
  | "anniversary";

export interface CalendarDayEntry {
  id: string;
  type: CalendarDayEntryType;
  memberId?: string;
  memberName: string;
  amount?: string;
  value?: string;
  context?: GlucoseContext;
  minutes?: number;
  medication?: CalendarMedicationSummary;
  label?: string;
  detail?: string;
  abnormal?: boolean;
  event?: CalendarEventOccurrence;
}

export interface CalendarPeriodSummary {
  income: string;
  expense: string;
  balance: string;
  incomeCount: number;
  expenseCount: number;
  glucoseMeasurements: number;
  glucoseAbnormalCount: number;
  exerciseMinutes: number;
  medication: CalendarMedicationSummary;
  followupCount: number;
  scheduledFollowupCount: number;
  scheduleCount: number;
  anniversaryCount: number;
}

export interface CalendarDaySummary extends CalendarPeriodSummary {
  date: string;
  entries: CalendarDayEntry[];
  glucoseReadings: CalendarGlucoseReading[];
  followups: CalendarFollowupItem[];
}

export interface CalendarMonthSummary extends CalendarPeriodSummary {
  month: string;
  expenseChangeRate?: number;
  followups: CalendarFollowupItem[];
}

export interface CalendarMemberExerciseSummary {
  memberId: string;
  memberName: string;
  minutes: number;
  activities: Array<{
    type: string;
    minutes: number;
  }>;
}

export interface CalendarMemberWeightSummary {
  memberId: string;
  memberName: string;
  measuredAt?: string;
  weightKg?: string;
}

export interface CalendarData {
  view: CalendarView;
  period: string;
  memberId?: string;
  summary: CalendarPeriodSummary;
  exerciseByMember: CalendarMemberExerciseSummary[];
  latestWeightByMember: CalendarMemberWeightSummary[];
  upcomingEvents: CalendarEventOccurrence[];
  days: CalendarDaySummary[];
  months: CalendarMonthSummary[];
}
