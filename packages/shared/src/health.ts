export type HealthMoneyValue = string;
export type ExerciseIntensity = "low" | "moderate" | "high";
export type StrengthMovementMetric = "reps" | "seconds";
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
export type MedicationAdministrationRoute = "oral" | "injection" | "topical" | "other";
export type MedicationFrequency = "daily" | "weekly" | "interval";
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
  strengthExerciseGoals: StrengthExerciseGoal[];
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

export interface StrengthExerciseGoal {
  id: string;
  name: string;
  metric: StrengthMovementMetric;
  weeklyGoal?: number;
  singleSessionGoal?: number;
  maxSetGoal?: number;
}

export interface StrengthExerciseMovement {
  id: string;
  name: string;
  metric: StrengthMovementMetric;
  sets: number[];
  total: number;
  variant?: string;
  addedWeightKg?: HealthMoneyValue;
  assistanceWeightKg?: HealthMoneyValue;
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
  movements: StrengthExerciseMovement[];
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
  administrationRoute: MedicationAdministrationRoute;
  frequency: MedicationFrequency;
  weekdays: number[];
  intervalDays?: number;
  doseUnit: string;
  stockUnit: string;
  doseQuantity: HealthMoneyValue;
  inventoryPerDose: HealthMoneyValue;
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
  actualDoseQuantity?: HealthMoneyValue;
  injectionSite?: string;
  takenAt?: string;
  note?: string;
}

export interface MedicationScheduleRule {
  startDate: string;
  endDate?: string;
  frequency: MedicationFrequency;
  weekdays: number[];
  intervalDays?: number;
}

export function isMedicationScheduledOnDate(
  plan: MedicationScheduleRule,
  date: string
): boolean {
  if (date < plan.startDate || (plan.endDate && date > plan.endDate)) return false;
  if (plan.frequency === "daily") return true;
  const dateValue = new Date(`${date}T00:00:00Z`);
  if (plan.frequency === "weekly") {
    const weekday = dateValue.getUTCDay() || 7;
    return plan.weekdays.includes(weekday);
  }
  const startValue = new Date(`${plan.startDate}T00:00:00Z`);
  const daysSinceStart = Math.floor((dateValue.getTime() - startValue.getTime()) / 86_400_000);
  return daysSinceStart >= 0 && daysSinceStart % (plan.intervalDays ?? 1) === 0;
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
