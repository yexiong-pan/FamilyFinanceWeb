import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type {
  BloodGlucoseRecord,
  BodyMeasurement,
  ExerciseLog,
  Hba1cRecord,
  HealthFollowup,
  HealthData,
  MedicationDoseRecord,
  MedicationPlan,
  MemberHealthProfile,
  WeeklyHealthReview
} from "@family-finance/shared";
import { HealthService } from "./health.service";
import type {
  BloodGlucoseInput,
  BodyMeasurementInput,
  ExerciseLogInput,
  Hba1cInput,
  HealthFollowupInput,
  HealthProfileInput,
  MedicationDoseInput,
  MedicationInventoryInput,
  MedicationPlanInput,
  WeeklyHealthReviewInput
} from "./health.types";

interface CsvResponse {
  setHeader(name: string, value: string): void;
  send(body: string): void;
}

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealthData(
    @Query("memberId") memberId: string,
    @Query("month") month: string
  ): Promise<HealthData> {
    return this.healthService.getHealthData(memberId, month);
  }

  @Patch("profiles/:memberId")
  updateProfile(
    @Param("memberId") memberId: string,
    @Body() input: HealthProfileInput
  ): Promise<MemberHealthProfile> {
    return this.healthService.updateProfile(memberId, input);
  }

  @Post("members/:memberId/body-measurements")
  createBodyMeasurement(
    @Param("memberId") memberId: string,
    @Body() input: BodyMeasurementInput
  ): Promise<BodyMeasurement> {
    return this.healthService.createBodyMeasurement(memberId, input);
  }

  @Patch("body-measurements/:id")
  updateBodyMeasurement(@Param("id") id: string, @Body() input: BodyMeasurementInput) {
    return this.healthService.updateBodyMeasurement(id, input);
  }

  @Delete("body-measurements/:id")
  deleteBodyMeasurement(@Param("id") id: string): Promise<void> {
    return this.healthService.deleteBodyMeasurement(id);
  }

  @Post("members/:memberId/exercise-logs")
  createExerciseLog(
    @Param("memberId") memberId: string,
    @Body() input: ExerciseLogInput
  ): Promise<ExerciseLog> {
    return this.healthService.createExerciseLog(memberId, input);
  }

  @Patch("exercise-logs/:id")
  updateExerciseLog(@Param("id") id: string, @Body() input: ExerciseLogInput) {
    return this.healthService.updateExerciseLog(id, input);
  }

  @Delete("exercise-logs/:id")
  deleteExerciseLog(@Param("id") id: string): Promise<void> {
    return this.healthService.deleteExerciseLog(id);
  }

  @Post("members/:memberId/glucose-records")
  createBloodGlucose(
    @Param("memberId") memberId: string,
    @Body() input: BloodGlucoseInput
  ): Promise<BloodGlucoseRecord> {
    return this.healthService.createBloodGlucose(memberId, input);
  }

  @Patch("glucose-records/:id")
  updateBloodGlucose(@Param("id") id: string, @Body() input: BloodGlucoseInput) {
    return this.healthService.updateBloodGlucose(id, input);
  }

  @Delete("glucose-records/:id")
  deleteBloodGlucose(@Param("id") id: string): Promise<void> {
    return this.healthService.deleteBloodGlucose(id);
  }

  @Post("members/:memberId/hba1c-records")
  createHba1c(
    @Param("memberId") memberId: string,
    @Body() input: Hba1cInput
  ): Promise<Hba1cRecord> {
    return this.healthService.createHba1c(memberId, input);
  }

  @Patch("hba1c-records/:id")
  updateHba1c(@Param("id") id: string, @Body() input: Hba1cInput) {
    return this.healthService.updateHba1c(id, input);
  }

  @Delete("hba1c-records/:id")
  deleteHba1c(@Param("id") id: string): Promise<void> {
    return this.healthService.deleteHba1c(id);
  }

  @Post("members/:memberId/medications")
  createMedicationPlan(
    @Param("memberId") memberId: string,
    @Body() input: MedicationPlanInput
  ): Promise<MedicationPlan> {
    return this.healthService.createMedicationPlan(memberId, input);
  }

  @Patch("medications/:id")
  updateMedicationPlan(
    @Param("id") id: string,
    @Body() input: MedicationPlanInput
  ): Promise<MedicationPlan> {
    return this.healthService.updateMedicationPlan(id, input);
  }

  @Post("medications/:id/doses")
  saveMedicationDose(
    @Param("id") id: string,
    @Body() input: MedicationDoseInput
  ): Promise<MedicationDoseRecord> {
    return this.healthService.saveMedicationDose(id, input);
  }

  @Post("medications/:id/inventory")
  updateMedicationInventory(
    @Param("id") id: string,
    @Body() input: MedicationInventoryInput
  ): Promise<MedicationPlan> {
    return this.healthService.updateMedicationInventory(id, input);
  }

  @Post("members/:memberId/followups")
  createHealthFollowup(
    @Param("memberId") memberId: string,
    @Body() input: HealthFollowupInput
  ): Promise<HealthFollowup> {
    return this.healthService.createHealthFollowup(memberId, input);
  }

  @Patch("followups/:id")
  updateHealthFollowup(
    @Param("id") id: string,
    @Body() input: HealthFollowupInput
  ): Promise<HealthFollowup> {
    return this.healthService.updateHealthFollowup(id, input);
  }

  @Delete("followups/:id")
  deleteHealthFollowup(@Param("id") id: string): Promise<void> {
    return this.healthService.deleteHealthFollowup(id);
  }

  @Post("members/:memberId/weekly-review")
  saveWeeklyReview(
    @Param("memberId") memberId: string,
    @Body() input: WeeklyHealthReviewInput
  ): Promise<WeeklyHealthReview> {
    return this.healthService.saveWeeklyReview(memberId, input);
  }

  @Get("export")
  async exportCsv(
    @Query("memberId") memberId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Res() response: CsvResponse
  ): Promise<void> {
    const csv = await this.healthService.exportCsv(memberId, from, to);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="health-${memberId}-${from}-${to}.csv"`
    );
    response.send(csv);
  }
}
