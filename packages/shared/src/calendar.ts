import type {
  GlucoseContext,
  HealthFollowupStatus
} from "./health.js";

export type CalendarView = "month" | "year";

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
  | "followup";

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
  abnormal?: boolean;
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
  days: CalendarDaySummary[];
  months: CalendarMonthSummary[];
}
