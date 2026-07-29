export type HealthMoneyValue = string;
export type ExerciseIntensity = "low" | "moderate" | "high";
export type BodyMeasurementContext = "morningFasting" | "other";
export type GlucoseContext =
  | "fasting"
  | "beforeMeal"
  | "afterMeal1h"
  | "afterMeal2h"
  | "bedtime"
  | "random";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ExerciseRelation = "before" | "after";
export type GlucoseSource = "manual" | "meter" | "cgm";
export type MedicationPlanStatus = "active" | "paused" | "stopped";
export type MedicationDoseStatus = "taken" | "missed" | "paused";
export type MedicationInventoryEventType = "initial" | "restock" | "adjustment" | "consumption";
export type HealthFollowupStatus = "scheduled" | "completed" | "cancelled";

export interface GlucoseTargetRange {
  min?: number;
  max?: number;
}

export interface GlucoseTargets {
  fasting?: GlucoseTargetRange;
  beforeMeal?: GlucoseTargetRange;
  afterMeal2h?: GlucoseTargetRange;
}

export interface MemberHealthProfile {
  memberId: string;
  weightTrackingEnabled: boolean;
  exerciseTrackingEnabled: boolean;
  glucoseTrackingEnabled: boolean;
  hba1cTrackingEnabled: boolean;
  medicationTrackingEnabled: boolean;
  targetWeightKg?: HealthMoneyValue;
  targetDate?: string;
  weeklyExerciseMinutesGoal: number;
  weeklyStrengthSessionsGoal: number;
  dailyStepsGoal: number;
  glucoseIntervalDays: number;
  glucoseLowThreshold: HealthMoneyValue;
  glucoseTargets: GlucoseTargets;
  hba1cTargetMax?: HealthMoneyValue;
}

export interface BodyMeasurement {
  id: string;
  memberId: string;
  measuredAt: string;
  weightKg: HealthMoneyValue;
  waistCm?: HealthMoneyValue;
  context: BodyMeasurementContext;
  note?: string;
}

export interface ExerciseLog {
  id: string;
  memberId: string;
  date: string;
  type: string;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  isStrengthTraining: boolean;
  steps?: number;
  estimatedCalories?: number;
  note?: string;
}

export interface BloodGlucoseRecord {
  id: string;
  memberId: string;
  measuredAt: string;
  glucoseMmol: HealthMoneyValue;
  context: GlucoseContext;
  meal?: MealType;
  exerciseRelation?: ExerciseRelation;
  medicationTaken?: boolean;
  symptoms?: string;
  note?: string;
  source: GlucoseSource;
}

export interface Hba1cRecord {
  id: string;
  memberId: string;
  measuredAt: string;
  valuePercent: HealthMoneyValue;
  facility?: string;
  doctorAdvice?: string;
  nextReviewDate?: string;
}

export interface WeeklyHealthReview {
  id: string;
  memberId: string;
  weekStart: string;
  good?: string;
  obstacle?: string;
  nextAction?: string;
}

export interface MedicationScheduleSlot {
  id: string;
  label: string;
  time?: string;
}

export interface MedicationPlan {
  id: string;
  memberId: string;
  name: string;
  specification?: string;
  stockUnit: string;
  doseQuantity: HealthMoneyValue;
  scheduleSlots: MedicationScheduleSlot[];
  startDate: string;
  endDate?: string;
  purpose?: string;
  instructions?: string;
  status: MedicationPlanStatus;
  currentStock: HealthMoneyValue;
  lowStockDays: number;
}

export interface MedicationDoseRecord {
  id: string;
  memberId: string;
  medicationId: string;
  scheduledDate: string;
  slotId: string;
  scheduledLabel: string;
  status: MedicationDoseStatus;
  quantityUsed: HealthMoneyValue;
  takenAt?: string;
  note?: string;
}

export interface MedicationInventoryEvent {
  id: string;
  medicationId: string;
  doseRecordId?: string;
  type: MedicationInventoryEventType;
  quantityDelta: HealthMoneyValue;
  occurredAt: string;
  note?: string;
}

export interface HealthFollowup {
  id: string;
  memberId: string;
  scheduledAt: string;
  hospital?: string;
  department?: string;
  doctor?: string;
  type: string;
  tests: string[];
  reminderDays: number;
  status: HealthFollowupStatus;
  resultSummary?: string;
  doctorAdvice?: string;
}

export interface HealthData {
  month: string;
  profile: MemberHealthProfile;
  bodyMeasurements: BodyMeasurement[];
  exerciseLogs: ExerciseLog[];
  glucoseRecords: BloodGlucoseRecord[];
  hba1cRecords: Hba1cRecord[];
  medicationPlans: MedicationPlan[];
  medicationDoseRecords: MedicationDoseRecord[];
  medicationInventoryEvents: MedicationInventoryEvent[];
  followups: HealthFollowup[];
  weeklyReview?: WeeklyHealthReview;
}
