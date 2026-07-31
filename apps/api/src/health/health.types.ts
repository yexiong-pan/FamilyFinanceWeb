import type {
  BodyMeasurementContext,
  ExerciseIntensity,
  ExerciseRelation,
  GlucoseContext,
  GlucoseSource,
  GlucoseTargets,
  HealthFollowupStatus,
  MealType,
  MedicationAdministrationRoute,
  MedicationDoseStatus,
  MedicationFrequency,
  MedicationPlanStatus,
  MedicationScheduleSlot,
  StrengthExerciseGoal,
  StrengthMovementMetric
} from "@family-finance/shared";

export interface HealthProfileInput {
  weightTrackingEnabled?: boolean;
  exerciseTrackingEnabled?: boolean;
  glucoseTrackingEnabled?: boolean;
  hba1cTrackingEnabled?: boolean;
  medicationTrackingEnabled?: boolean;
  targetWeightKg?: string;
  targetDate?: string;
  weeklyExerciseMinutesGoal?: number;
  weeklyStrengthSessionsGoal?: number;
  strengthExerciseGoals?: StrengthExerciseGoal[];
  dailyStepsGoal?: number;
  glucoseIntervalDays?: number;
  glucoseLowThreshold?: string;
  glucoseTargets?: GlucoseTargets;
  hba1cTargetMax?: string;
}

export interface BodyMeasurementInput {
  measuredAt: string;
  weightKg: string;
  waistCm?: string;
  context?: BodyMeasurementContext;
  note?: string;
}

export interface ExerciseLogInput {
  date: string;
  type: string;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  isStrengthTraining?: boolean;
  steps?: number;
  estimatedCalories?: number;
  movements?: StrengthExerciseMovementInput[];
  note?: string;
}

export interface StrengthExerciseMovementInput {
  name: string;
  metric: StrengthMovementMetric;
  sets: number[];
  variant?: string;
  addedWeightKg?: string;
  assistanceWeightKg?: string;
  note?: string;
}

export interface BloodGlucoseInput {
  measuredAt: string;
  glucoseMmol: string;
  context: GlucoseContext;
  meal?: MealType;
  exerciseRelation?: ExerciseRelation;
  medicationTaken?: boolean;
  symptoms?: string;
  note?: string;
  source?: GlucoseSource;
}

export interface Hba1cInput {
  measuredAt: string;
  valuePercent: string;
  facility?: string;
  doctorAdvice?: string;
  nextReviewDate?: string;
}

export interface WeeklyHealthReviewInput {
  weekStart: string;
  good?: string;
  obstacle?: string;
  nextAction?: string;
}

export interface MedicationPlanInput {
  name: string;
  specification?: string;
  administrationRoute: MedicationAdministrationRoute;
  frequency: MedicationFrequency;
  weekdays?: number[];
  intervalDays?: number;
  doseUnit: string;
  stockUnit: string;
  doseQuantity: string;
  inventoryPerDose: string;
  scheduleSlots: MedicationScheduleSlot[];
  startDate: string;
  endDate?: string;
  purpose?: string;
  instructions?: string;
  status?: MedicationPlanStatus;
  initialStock?: string;
  lowStockDays?: number;
}

export interface MedicationDoseInput {
  scheduledDate: string;
  slotId: string;
  status: MedicationDoseStatus;
  takenAt?: string;
  actualDoseQuantity?: string;
  injectionSite?: string;
  note?: string;
}

export interface MedicationInventoryInput {
  mode: "restock" | "set";
  quantity: string;
  occurredAt: string;
  note?: string;
}

export interface HealthFollowupInput {
  scheduledAt: string;
  hospital?: string;
  department?: string;
  doctor?: string;
  type: string;
  tests?: string[];
  reminderDays?: number;
  status?: HealthFollowupStatus;
  resultSummary?: string;
  doctorAdvice?: string;
}
