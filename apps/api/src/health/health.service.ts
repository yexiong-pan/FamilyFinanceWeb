import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BloodGlucoseRecord,
  BodyMeasurementContext,
  BodyMeasurement,
  ExerciseLog,
  GlucoseTargets,
  Hba1cRecord,
  HealthFollowup,
  HealthData,
  MedicationDoseRecord,
  MedicationInventoryEvent,
  MedicationPlan,
  MedicationScheduleSlot,
  MemberHealthProfile,
  StrengthExerciseGoal,
  StrengthExerciseMovement,
  WeeklyHealthReview
} from "@family-finance/shared";
import { isMedicationScheduledOnDate } from "@family-finance/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
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

const DEFAULT_FAMILY_ID = "default-family";
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getHealthData(memberId: string, month: string): Promise<HealthData> {
    assertMonth(month);
    await this.assertMember(memberId);
    const profile = await this.ensureProfile(memberId);
    const monthEnd = monthStart(shiftMonth(month, 1));
    const monthStartDate = monthStart(month);
    const weekStart = startOfWeek(referenceDateForMonth(month));
    const [
      bodyRows,
      exerciseRows,
      glucoseRows,
      hba1cRows,
      medicationRows,
      medicationDoseRows,
      medicationInventoryRows,
      followupRows,
      weeklyReview
    ] = await Promise.all([
      this.prisma.bodyMeasurement.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { lt: monthEnd } },
        orderBy: { measuredAt: "desc" },
        take: 90
      }),
      this.prisma.exerciseLog.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          date: { gte: monthStartDate, lt: monthEnd }
        },
        include: { movements: { orderBy: { sortOrder: "asc" } } },
        orderBy: { date: "asc" }
      }),
      this.prisma.bloodGlucoseRecord.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { lt: monthEnd } },
        orderBy: { measuredAt: "desc" },
        take: 12
      }),
      this.prisma.hba1cRecord.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { lt: monthEnd } },
        orderBy: { measuredAt: "desc" },
        take: 12
      }),
      this.prisma.medicationPlan.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          startDate: { lt: monthEnd },
          OR: [{ endDate: null }, { endDate: { gte: monthStartDate } }]
        },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.medicationDoseRecord.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          scheduledDate: { gte: monthStartDate, lt: monthEnd }
        },
        orderBy: [{ scheduledDate: "asc" }, { scheduledLabel: "asc" }]
      }),
      this.prisma.medicationInventoryEvent.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          medication: { memberId },
          occurredAt: { lt: monthEnd }
        },
        orderBy: { occurredAt: "desc" },
        take: 30
      }),
      this.prisma.healthFollowup.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          scheduledAt: { gte: addDays(monthStartDate, -90) }
        },
        orderBy: { scheduledAt: "asc" },
        take: 50
      }),
      this.prisma.weeklyHealthReview.findUnique({
        where: { memberId_weekStart: { memberId, weekStart } }
      })
    ]);

    return {
      month,
      profile: mapProfile(profile),
      bodyMeasurements: bodyRows.reverse().map(mapBodyMeasurement),
      exerciseLogs: exerciseRows.map(mapExerciseLog),
      glucoseRecords: glucoseRows.reverse().map(mapBloodGlucose),
      hba1cRecords: hba1cRows.reverse().map(mapHba1c),
      medicationPlans: medicationRows.map(mapMedicationPlan),
      medicationDoseRecords: medicationDoseRows.map(mapMedicationDose),
      medicationInventoryEvents: medicationInventoryRows.reverse().map(mapMedicationInventory),
      followups: followupRows.map(mapHealthFollowup),
      ...(weeklyReview ? { weeklyReview: mapWeeklyReview(weeklyReview) } : {})
    };
  }

  async updateProfile(memberId: string, input: HealthProfileInput): Promise<MemberHealthProfile> {
    await this.assertMember(memberId);
    validateProfile(input);
    const profile = await this.prisma.memberHealthProfile.upsert({
      where: { memberId },
      create: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...profileData(input)
      },
      update: profileData(input)
    });
    return mapProfile(profile);
  }

  async createBodyMeasurement(
    memberId: string,
    input: BodyMeasurementInput
  ): Promise<BodyMeasurement> {
    await this.assertMember(memberId);
    validateBodyMeasurement(input);
    return mapBodyMeasurement(await this.prisma.bodyMeasurement.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...bodyMeasurementData(input)
      }
    }));
  }

  async updateBodyMeasurement(id: string, input: BodyMeasurementInput): Promise<BodyMeasurement> {
    validateBodyMeasurement(input);
    await this.assertRecord("bodyMeasurement", id);
    return mapBodyMeasurement(await this.prisma.bodyMeasurement.update({
      where: { id },
      data: bodyMeasurementData(input)
    }));
  }

  async deleteBodyMeasurement(id: string): Promise<void> {
    await this.deleteRecord("bodyMeasurement", id);
  }

  async createExerciseLog(memberId: string, input: ExerciseLogInput): Promise<ExerciseLog> {
    await this.assertMember(memberId);
    validateExerciseLog(input);
    return mapExerciseLog(await this.prisma.exerciseLog.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...exerciseLogData(input),
        movements: { create: strengthMovementCreateData(input) }
      },
      include: { movements: { orderBy: { sortOrder: "asc" } } }
    }));
  }

  async updateExerciseLog(id: string, input: ExerciseLogInput): Promise<ExerciseLog> {
    validateExerciseLog(input);
    await this.assertRecord("exerciseLog", id);
    return mapExerciseLog(await this.prisma.exerciseLog.update({
      where: { id },
      data: {
        ...exerciseLogData(input),
        movements: {
          deleteMany: {},
          create: strengthMovementCreateData(input)
        }
      },
      include: { movements: { orderBy: { sortOrder: "asc" } } }
    }));
  }

  async deleteExerciseLog(id: string): Promise<void> {
    await this.deleteRecord("exerciseLog", id);
  }

  async createBloodGlucose(
    memberId: string,
    input: BloodGlucoseInput
  ): Promise<BloodGlucoseRecord> {
    await this.assertMember(memberId);
    validateBloodGlucose(input);
    return mapBloodGlucose(await this.prisma.bloodGlucoseRecord.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...bloodGlucoseData(input)
      }
    }));
  }

  async updateBloodGlucose(id: string, input: BloodGlucoseInput): Promise<BloodGlucoseRecord> {
    validateBloodGlucose(input);
    await this.assertRecord("bloodGlucoseRecord", id);
    return mapBloodGlucose(await this.prisma.bloodGlucoseRecord.update({
      where: { id },
      data: bloodGlucoseData(input)
    }));
  }

  async deleteBloodGlucose(id: string): Promise<void> {
    await this.deleteRecord("bloodGlucoseRecord", id);
  }

  async createHba1c(memberId: string, input: Hba1cInput): Promise<Hba1cRecord> {
    await this.assertMember(memberId);
    validateHba1c(input);
    return mapHba1c(await this.prisma.hba1cRecord.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...hba1cData(input)
      }
    }));
  }

  async updateHba1c(id: string, input: Hba1cInput): Promise<Hba1cRecord> {
    validateHba1c(input);
    await this.assertRecord("hba1cRecord", id);
    return mapHba1c(await this.prisma.hba1cRecord.update({
      where: { id },
      data: hba1cData(input)
    }));
  }

  async deleteHba1c(id: string): Promise<void> {
    await this.deleteRecord("hba1cRecord", id);
  }

  async createMedicationPlan(memberId: string, input: MedicationPlanInput): Promise<MedicationPlan> {
    await this.assertMember(memberId);
    validateMedicationPlan(input);
    const initialStock = decimal(input.initialStock ?? "0", "初始库存");
    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.medicationPlan.create({
        data: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          ...medicationPlanData(input),
          currentStock: initialStock
        }
      });
      if (Number(initialStock) !== 0) {
        await tx.medicationInventoryEvent.create({
          data: {
            familyId: DEFAULT_FAMILY_ID,
            medicationId: created.id,
            type: "initial",
            quantityDelta: initialStock,
            occurredAt: new Date(),
            note: "建立用药计划时录入"
          }
        });
      }
      return created;
    });
    return mapMedicationPlan(plan);
  }

  async updateMedicationPlan(id: string, input: MedicationPlanInput): Promise<MedicationPlan> {
    validateMedicationPlan(input);
    await this.assertMedication(id);
    return mapMedicationPlan(await this.prisma.medicationPlan.update({
      where: { id },
      data: medicationPlanData(input)
    }));
  }

  async saveMedicationDose(id: string, input: MedicationDoseInput): Promise<MedicationDoseRecord> {
    const plan = await this.getMedication(id);
    validateMedicationDose(input, parseMedicationSlots(plan.scheduleSlots));
    const scheduledDate = parseDate(input.scheduledDate, "计划日期");
    if (!isMedicationScheduledOnDate({
      startDate: formatDate(plan.startDate),
      ...(plan.endDate ? { endDate: formatDate(plan.endDate) } : {}),
      frequency: plan.frequency,
      weekdays: plan.weekdays,
      ...(plan.intervalDays ? { intervalDays: plan.intervalDays } : {})
    }, formatDate(scheduledDate))) {
      throw new BadRequestException("该日期不在用药计划中");
    }
    const slot = parseMedicationSlots(plan.scheduleSlots).find((item) => item.id === input.slotId)!;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.medicationDoseRecord.findUnique({
        where: {
          medicationId_scheduledDate_slotId: {
            medicationId: id,
            scheduledDate,
            slotId: input.slotId
          }
        }
      });
      const wasTaken = existing?.status === "taken";
      const isTaken = input.status === "taken";
      const inventoryUsed = money(plan.inventoryPerDose ?? plan.doseQuantity);
      const record = await tx.medicationDoseRecord.upsert({
        where: {
          medicationId_scheduledDate_slotId: {
            medicationId: id,
            scheduledDate,
            slotId: input.slotId
          }
        },
        create: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: plan.memberId,
          medicationId: id,
          scheduledDate,
          slotId: input.slotId,
          scheduledLabel: slot.label,
          status: input.status,
          quantityUsed: inventoryUsed,
          actualDoseQuantity: isTaken
            ? decimal(input.actualDoseQuantity ?? plan.doseQuantity.toString(), "实际剂量")
            : null,
          injectionSite: isTaken ? cleanText(input.injectionSite) : null,
          takenAt: isTaken ? parseOptionalDateTime(input.takenAt) ?? new Date() : null,
          note: cleanText(input.note)
        },
        update: {
          scheduledLabel: slot.label,
          status: input.status,
          quantityUsed: inventoryUsed,
          actualDoseQuantity: isTaken
            ? decimal(input.actualDoseQuantity ?? plan.doseQuantity.toString(), "实际剂量")
            : null,
          injectionSite: isTaken ? cleanText(input.injectionSite) : null,
          takenAt: isTaken ? parseOptionalDateTime(input.takenAt) ?? existing?.takenAt ?? new Date() : null,
          note: cleanText(input.note)
        }
      });

      if (!wasTaken && isTaken) {
        await tx.medicationPlan.update({
          where: { id },
          data: { currentStock: { decrement: inventoryUsed } }
        });
        await tx.medicationInventoryEvent.create({
          data: {
            familyId: DEFAULT_FAMILY_ID,
            medicationId: id,
            doseRecordId: record.id,
            type: "consumption",
            quantityDelta: (-Number(inventoryUsed)).toFixed(2),
            occurredAt: record.takenAt ?? new Date(),
            note: `${formatDate(scheduledDate)} ${slot.label}`
          }
        });
      } else if (wasTaken && !isTaken) {
        await tx.medicationPlan.update({
          where: { id },
          data: { currentStock: { increment: inventoryUsed } }
        });
        await tx.medicationInventoryEvent.deleteMany({ where: { doseRecordId: record.id } });
      }
      return mapMedicationDose(record);
    });
  }

  async updateMedicationInventory(
    id: string,
    input: MedicationInventoryInput
  ): Promise<MedicationPlan> {
    const plan = await this.getMedication(id);
    validateMedicationInventory(input);
    const requested = Number(input.quantity);
    const delta = input.mode === "restock"
      ? requested
      : requested - Number(plan.currentStock.toString());
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.medicationPlan.update({
        where: { id },
        data: { currentStock: { increment: delta.toFixed(2) } }
      });
      if (delta !== 0) {
        await tx.medicationInventoryEvent.create({
          data: {
            familyId: DEFAULT_FAMILY_ID,
            medicationId: id,
            type: input.mode === "restock" ? "restock" : "adjustment",
            quantityDelta: delta.toFixed(2),
            occurredAt: parseDateTime(input.occurredAt, "库存变更时间"),
            note: cleanText(input.note)
          }
        });
      }
      return next;
    });
    return mapMedicationPlan(updated);
  }

  async createHealthFollowup(memberId: string, input: HealthFollowupInput): Promise<HealthFollowup> {
    await this.assertMember(memberId);
    validateHealthFollowup(input);
    return mapHealthFollowup(await this.prisma.healthFollowup.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        ...healthFollowupData(input)
      }
    }));
  }

  async updateHealthFollowup(id: string, input: HealthFollowupInput): Promise<HealthFollowup> {
    validateHealthFollowup(input);
    const existing = await this.prisma.healthFollowup.findFirst({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
    if (!existing) throw new NotFoundException("复诊记录不存在");
    return mapHealthFollowup(await this.prisma.healthFollowup.update({
      where: { id },
      data: healthFollowupData(input)
    }));
  }

  async deleteHealthFollowup(id: string): Promise<void> {
    const result = await this.prisma.healthFollowup.deleteMany({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
    if (!result.count) throw new NotFoundException("复诊记录不存在");
  }

  async saveWeeklyReview(
    memberId: string,
    input: WeeklyHealthReviewInput
  ): Promise<WeeklyHealthReview> {
    await this.assertMember(memberId);
    const weekStart = parseDate(input.weekStart, "周开始日期");
    const review = await this.prisma.weeklyHealthReview.upsert({
      where: { memberId_weekStart: { memberId, weekStart } },
      create: {
        familyId: DEFAULT_FAMILY_ID,
        memberId,
        weekStart,
        good: cleanText(input.good),
        obstacle: cleanText(input.obstacle),
        nextAction: cleanText(input.nextAction)
      },
      update: {
        good: cleanText(input.good),
        obstacle: cleanText(input.obstacle),
        nextAction: cleanText(input.nextAction)
      }
    });
    return mapWeeklyReview(review);
  }

  async exportCsv(memberId: string, from: string, to: string): Promise<string> {
    await this.assertMember(memberId);
    const start = parseDate(from, "开始日期");
    const end = addDays(parseDate(to, "结束日期"), 1);
    if (start >= end) throw new BadRequestException("结束日期不能早于开始日期");
    const [bodyRows, exerciseRows, glucoseRows, hba1cRows, medicationRows, medicationDoseRows, followupRows] = await Promise.all([
      this.prisma.bodyMeasurement.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { gte: start, lt: end } },
        orderBy: { measuredAt: "asc" }
      }),
      this.prisma.exerciseLog.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, date: { gte: start, lt: end } },
        include: { movements: { orderBy: { sortOrder: "asc" } } },
        orderBy: { date: "asc" }
      }),
      this.prisma.bloodGlucoseRecord.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { gte: start, lt: end } },
        orderBy: { measuredAt: "asc" }
      }),
      this.prisma.hba1cRecord.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, measuredAt: { gte: start, lt: end } },
        orderBy: { measuredAt: "asc" }
      }),
      this.prisma.medicationPlan.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          startDate: { lt: end },
          OR: [{ endDate: null }, { endDate: { gte: start } }]
        },
        orderBy: { startDate: "asc" }
      }),
      this.prisma.medicationDoseRecord.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId,
          scheduledDate: { gte: start, lt: end }
        },
        include: {
          medication: {
            select: {
              name: true,
              administrationRoute: true,
              doseQuantity: true,
              doseUnit: true,
              stockUnit: true
            }
          }
        },
        orderBy: { scheduledDate: "asc" }
      }),
      this.prisma.healthFollowup.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId, scheduledAt: { gte: start, lt: end } },
        orderBy: { scheduledAt: "asc" }
      })
    ]);
    const dataRows = [
      ...bodyRows.map((row) => [
        "身体", row.measuredAt.toISOString(), `体重 ${money(row.weightKg)}kg${row.waistCm ? `；腰围 ${money(row.waistCm)}cm` : ""}`,
        row.context === "morningFasting" ? "晨起空腹" : "其他时间", "", "", "", row.note ?? ""
      ]),
      ...exerciseRows.map((row) => [
        "运动", row.date.toISOString(), "", exerciseTypeWithMovements(row), String(row.durationMinutes), row.steps?.toString() ?? "",
        "", row.note ?? ""
      ]),
      ...glucoseRows.map((row) => [
        "血糖", row.measuredAt.toISOString(), `${money(row.glucoseMmol)} mmol/L`, row.context, "", "",
        row.symptoms ?? "", row.note ?? ""
      ]),
      ...hba1cRows.map((row) => [
        "HbA1c", row.measuredAt.toISOString(), `${money(row.valuePercent)}%`, row.facility ?? "", "", "",
        row.doctorAdvice ?? "", ""
      ]),
      ...medicationRows.map((row) => [
        "用药计划", row.startDate.toISOString(), `${row.name}${row.specification ? ` ${row.specification}` : ""}`,
        `${medicationRouteLabel(row.administrationRoute)} / ${medicationFrequencyLabel(row)}`, "", "",
        row.instructions ?? "", `剩余 ${money(row.currentStock)} ${row.stockUnit}`
      ]),
      ...medicationDoseRows.map((row) => [
        "用药执行", row.scheduledDate.toISOString(),
        `${row.medication.name} ${money(row.actualDoseQuantity ?? row.medication.doseQuantity)} ${row.medication.doseUnit ?? row.medication.stockUnit}`,
        [
          medicationRouteLabel(row.medication.administrationRoute),
          row.scheduledLabel,
          row.status,
          row.injectionSite
        ].filter(Boolean).join(" / "), "", "", "", row.note ?? ""
      ]),
      ...followupRows.map((row) => [
        "复诊", row.scheduledAt.toISOString(), row.type,
        [row.hospital, row.department, row.doctor].filter(Boolean).join(" / "), "", "",
        row.doctorAdvice ?? "", parseStringArray(row.tests).join("、")
      ])
    ].sort((left, right) => left[1]!.localeCompare(right[1]!));
    const rows = [
      ["记录类型", "时间", "主要数值", "场景或类型", "运动时长", "步数", "症状或医嘱", "备注"],
      ...dataRows
    ];
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  }

  private async ensureProfile(memberId: string) {
    return this.prisma.memberHealthProfile.upsert({
      where: { memberId },
      create: { familyId: DEFAULT_FAMILY_ID, memberId },
      update: {}
    });
  }

  private async assertMember(memberId: string): Promise<void> {
    const member = await this.prisma.familyMember.findFirst({
      where: { id: memberId, familyId: DEFAULT_FAMILY_ID }
    });
    if (!member) throw new NotFoundException("家庭成员不存在");
  }

  private async getMedication(id: string) {
    const plan = await this.prisma.medicationPlan.findFirst({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
    if (!plan) throw new NotFoundException("用药计划不存在");
    return plan;
  }

  private async assertMedication(id: string): Promise<void> {
    await this.getMedication(id);
  }

  private async assertRecord(
    model: "bodyMeasurement" | "exerciseLog" | "bloodGlucoseRecord" | "hba1cRecord",
    id: string
  ): Promise<void> {
    const where = { id, familyId: DEFAULT_FAMILY_ID };
    const record = model === "bodyMeasurement"
      ? await this.prisma.bodyMeasurement.findFirst({ where })
      : model === "exerciseLog"
        ? await this.prisma.exerciseLog.findFirst({ where })
        : model === "bloodGlucoseRecord"
          ? await this.prisma.bloodGlucoseRecord.findFirst({ where })
          : await this.prisma.hba1cRecord.findFirst({ where });
    if (!record) throw new NotFoundException("健康记录不存在");
  }

  private async deleteRecord(
    model: "bodyMeasurement" | "exerciseLog" | "bloodGlucoseRecord" | "hba1cRecord",
    id: string
  ): Promise<void> {
    const where = { id, familyId: DEFAULT_FAMILY_ID };
    const result = model === "bodyMeasurement"
      ? await this.prisma.bodyMeasurement.deleteMany({ where })
      : model === "exerciseLog"
        ? await this.prisma.exerciseLog.deleteMany({ where })
        : model === "bloodGlucoseRecord"
          ? await this.prisma.bloodGlucoseRecord.deleteMany({ where })
          : await this.prisma.hba1cRecord.deleteMany({ where });
    if (result.count === 0) throw new NotFoundException("健康记录不存在");
  }
}

function profileData(input: HealthProfileInput) {
  return {
    ...(input.weightTrackingEnabled === undefined ? {} : { weightTrackingEnabled: input.weightTrackingEnabled }),
    ...(input.exerciseTrackingEnabled === undefined ? {} : { exerciseTrackingEnabled: input.exerciseTrackingEnabled }),
    ...(input.glucoseTrackingEnabled === undefined ? {} : { glucoseTrackingEnabled: input.glucoseTrackingEnabled }),
    ...(input.hba1cTrackingEnabled === undefined ? {} : { hba1cTrackingEnabled: input.hba1cTrackingEnabled }),
    ...(input.medicationTrackingEnabled === undefined ? {} : { medicationTrackingEnabled: input.medicationTrackingEnabled }),
    ...("targetWeightKg" in input ? { targetWeightKg: optionalDecimal(input.targetWeightKg) } : {}),
    ...("targetDate" in input ? { targetDate: optionalDate(input.targetDate, "目标日期") } : {}),
    ...(input.weeklyExerciseMinutesGoal === undefined ? {} : { weeklyExerciseMinutesGoal: input.weeklyExerciseMinutesGoal }),
    ...(input.weeklyStrengthSessionsGoal === undefined ? {} : { weeklyStrengthSessionsGoal: input.weeklyStrengthSessionsGoal }),
    ...(input.strengthExerciseGoals === undefined ? {} : {
      strengthExerciseGoals: input.strengthExerciseGoals as unknown as Prisma.InputJsonValue
    }),
    ...(input.dailyStepsGoal === undefined ? {} : { dailyStepsGoal: input.dailyStepsGoal }),
    ...(input.glucoseIntervalDays === undefined ? {} : { glucoseIntervalDays: input.glucoseIntervalDays }),
    ...(input.glucoseLowThreshold === undefined ? {} : { glucoseLowThreshold: decimal(input.glucoseLowThreshold, "低血糖警戒值") }),
    ...(input.glucoseTargets === undefined ? {} : {
      glucoseTargets: input.glucoseTargets as Prisma.InputJsonValue
    }),
    ...("hba1cTargetMax" in input ? { hba1cTargetMax: optionalDecimal(input.hba1cTargetMax) } : {})
  };
}

function bodyMeasurementData(input: BodyMeasurementInput) {
  return {
    measuredAt: parseDateTime(input.measuredAt, "测量时间"),
    weightKg: decimal(input.weightKg, "体重"),
    waistCm: optionalDecimal(input.waistCm),
    context: input.context ?? "other",
    note: cleanText(input.note)
  };
}

function exerciseLogData(input: ExerciseLogInput) {
  return {
    date: parseDateTime(input.date, "运动日期"),
    type: input.type.trim(),
    durationMinutes: input.durationMinutes,
    intensity: input.intensity,
    isStrengthTraining: Boolean(input.isStrengthTraining || input.movements?.length),
    steps: input.steps ?? null,
    estimatedCalories: input.estimatedCalories ?? null,
    note: cleanText(input.note)
  };
}

function strengthMovementCreateData(input: ExerciseLogInput) {
  return (input.movements ?? []).map((movement, index) => ({
    name: movement.name.trim(),
    metric: movement.metric,
    sets: movement.sets,
    variant: cleanText(movement.variant),
    addedWeightKg: optionalDecimal(movement.addedWeightKg),
    assistanceWeightKg: optionalDecimal(movement.assistanceWeightKg),
    note: cleanText(movement.note),
    sortOrder: index
  }));
}

function bloodGlucoseData(input: BloodGlucoseInput) {
  return {
    measuredAt: parseDateTime(input.measuredAt, "测量时间"),
    glucoseMmol: decimal(input.glucoseMmol, "血糖"),
    context: input.context,
    meal: input.meal ?? null,
    exerciseRelation: input.exerciseRelation ?? null,
    medicationTaken: input.medicationTaken ?? null,
    symptoms: cleanText(input.symptoms),
    note: cleanText(input.note),
    source: input.source ?? "manual"
  };
}

function hba1cData(input: Hba1cInput) {
  return {
    measuredAt: parseDateTime(input.measuredAt, "检查日期"),
    valuePercent: decimal(input.valuePercent, "HbA1c"),
    facility: cleanText(input.facility),
    doctorAdvice: cleanText(input.doctorAdvice),
    nextReviewDate: optionalDate(input.nextReviewDate, "下次复查日期")
  };
}

function medicationPlanData(input: MedicationPlanInput) {
  return {
    name: input.name.trim(),
    specification: cleanText(input.specification),
    administrationRoute: input.administrationRoute,
    frequency: input.frequency,
    weekdays: input.frequency === "weekly" ? [...new Set(input.weekdays ?? [])].sort() : [],
    intervalDays: input.frequency === "interval" ? input.intervalDays : null,
    doseUnit: input.doseUnit.trim(),
    stockUnit: input.stockUnit.trim(),
    doseQuantity: decimal(input.doseQuantity, "单次用量"),
    inventoryPerDose: decimal(input.inventoryPerDose, "每次库存消耗"),
    scheduleSlots: input.scheduleSlots as unknown as Prisma.InputJsonValue,
    startDate: parseDate(input.startDate, "开始日期"),
    endDate: optionalDate(input.endDate, "结束日期"),
    purpose: cleanText(input.purpose),
    instructions: cleanText(input.instructions),
    status: input.status ?? "active",
    lowStockDays: input.lowStockDays ?? 7
  };
}

function healthFollowupData(input: HealthFollowupInput) {
  return {
    scheduledAt: parseDateTime(input.scheduledAt, "复诊时间"),
    hospital: cleanText(input.hospital),
    department: cleanText(input.department),
    doctor: cleanText(input.doctor),
    type: input.type.trim(),
    tests: (input.tests ?? []).map((item) => item.trim()).filter(Boolean),
    reminderDays: input.reminderDays ?? 7,
    status: input.status ?? "scheduled",
    resultSummary: cleanText(input.resultSummary),
    doctorAdvice: cleanText(input.doctorAdvice)
  };
}

function validateProfile(input: HealthProfileInput) {
  validateOptionalNumber(input.targetWeightKg, 20, 400, "目标体重");
  validateInteger(input.weeklyExerciseMinutesGoal, 0, 10080, "每周运动目标");
  validateInteger(input.weeklyStrengthSessionsGoal, 0, 14, "力量训练目标");
  validateStrengthGoals(input.strengthExerciseGoals);
  validateInteger(input.dailyStepsGoal, 0, 100000, "每日步数目标");
  validateInteger(input.glucoseIntervalDays, 1, 365, "血糖测量间隔");
  validateOptionalNumber(input.glucoseLowThreshold, 1, 10, "低血糖警戒值");
  validateOptionalNumber(input.hba1cTargetMax, 2, 25, "HbA1c目标");
  if (input.glucoseTargets) {
    for (const [context, range] of Object.entries(input.glucoseTargets)) {
      if (!range) continue;
      validateOptionalNumber(range.min, 1, 30, `${context}目标下限`);
      validateOptionalNumber(range.max, 1, 30, `${context}目标上限`);
      if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
        throw new BadRequestException("血糖目标下限不能高于上限");
      }
    }
  }
}

function validateBodyMeasurement(input: BodyMeasurementInput) {
  validateRequiredNumber(input.weightKg, 20, 400, "体重");
  validateOptionalNumber(input.waistCm, 30, 300, "腰围");
  if (input.context && !["morningFasting", "other"].includes(input.context)) {
    throw new BadRequestException("体重测量状态无效");
  }
  parseDateTime(input.measuredAt, "测量时间");
}

function validateExerciseLog(input: ExerciseLogInput) {
  if (!input.type?.trim()) throw new BadRequestException("运动类型不能为空");
  validateInteger(input.durationMinutes, 1, 1440, "运动时长");
  validateInteger(input.steps, 0, 200000, "步数");
  validateInteger(input.estimatedCalories, 0, 10000, "估算热量");
  if (!["low", "moderate", "high"].includes(input.intensity)) {
    throw new BadRequestException("运动强度无效");
  }
  validateStrengthMovements(input);
  parseDateTime(input.date, "运动日期");
}

function validateStrengthMovements(input: ExerciseLogInput): void {
  const movements = input.movements ?? [];
  if (movements.length > 20) throw new BadRequestException("单次训练最多记录20个动作");
  for (const movement of movements) {
    if (!movement.name?.trim()) throw new BadRequestException("力量动作名称不能为空");
    if (movement.name.trim().length > 50) throw new BadRequestException("力量动作名称不能超过50个字");
    if (!["reps", "seconds"].includes(movement.metric)) {
      throw new BadRequestException("力量动作计量方式无效");
    }
    if (!movement.sets?.length) throw new BadRequestException(`${movement.name}至少需要记录一组`);
    if (movement.sets.length > 30) throw new BadRequestException(`${movement.name}最多记录30组`);
    movement.sets.forEach((value) => validateInteger(value, 1, 10000, `${movement.name}每组数值`));
    validateOptionalNumber(movement.addedWeightKg, 0, 500, `${movement.name}负重`);
    validateOptionalNumber(movement.assistanceWeightKg, 0, 500, `${movement.name}助力`);
  }
}

function validateStrengthGoals(goals?: StrengthExerciseGoal[]): void {
  if (!goals) return;
  if (goals.length > 30) throw new BadRequestException("力量动作目标最多设置30项");
  const names = new Set<string>();
  for (const goal of goals) {
    if (!goal.name?.trim()) throw new BadRequestException("力量动作目标名称不能为空");
    const normalizedName = goal.name.trim().toLocaleLowerCase("zh-CN");
    if (names.has(normalizedName)) throw new BadRequestException(`力量动作目标重复：${goal.name}`);
    names.add(normalizedName);
    if (!["reps", "seconds"].includes(goal.metric)) {
      throw new BadRequestException("力量动作目标计量方式无效");
    }
    validateInteger(goal.weeklyGoal, 1, 100000, `${goal.name}周目标`);
    validateInteger(goal.singleSessionGoal, 1, 100000, `${goal.name}单次目标`);
    validateInteger(goal.maxSetGoal, 1, 100000, `${goal.name}单组目标`);
  }
}

function validateBloodGlucose(input: BloodGlucoseInput) {
  validateRequiredNumber(input.glucoseMmol, 0.5, 60, "血糖");
  if (!["fasting", "beforeMeal", "afterMeal1h", "afterMeal2h", "bedtime", "random"].includes(input.context)) {
    throw new BadRequestException("测量场景无效");
  }
  parseDateTime(input.measuredAt, "测量时间");
}

function validateHba1c(input: Hba1cInput) {
  validateRequiredNumber(input.valuePercent, 2, 25, "HbA1c");
  parseDateTime(input.measuredAt, "检查日期");
}

function validateMedicationPlan(input: MedicationPlanInput) {
  if (!input.name?.trim()) throw new BadRequestException("药品名称不能为空");
  if (!["oral", "injection", "topical", "other"].includes(input.administrationRoute)) {
    throw new BadRequestException("给药方式无效");
  }
  if (!["daily", "weekly", "interval"].includes(input.frequency)) {
    throw new BadRequestException("用药频率无效");
  }
  if (input.frequency === "weekly") {
    const weekdays = [...new Set(input.weekdays ?? [])];
    if (!weekdays.length || weekdays.some((value) => !Number.isInteger(value) || value < 1 || value > 7)) {
      throw new BadRequestException("请选择每周用药日期");
    }
  }
  if (input.frequency === "interval") {
    validateInteger(input.intervalDays, 1, 365, "间隔天数");
  }
  if (!input.doseUnit?.trim()) throw new BadRequestException("剂量单位不能为空");
  if (!input.stockUnit?.trim()) throw new BadRequestException("库存单位不能为空");
  validateRequiredNumber(input.doseQuantity, 0.01, 100000, "单次用量");
  validateRequiredNumber(input.inventoryPerDose, 0.01, 100000, "每次库存消耗");
  validateOptionalNumber(input.initialStock, 0, 10000000, "初始库存");
  validateInteger(input.lowStockDays, 0, 365, "库存提醒天数");
  if (!input.scheduleSlots?.length) throw new BadRequestException("至少需要一个用药时间");
  const ids = new Set<string>();
  for (const slot of input.scheduleSlots) {
    if (!slot.id?.trim() || !slot.label?.trim()) throw new BadRequestException("用药时间不能为空");
    if (ids.has(slot.id)) throw new BadRequestException("用药时间不能重复");
    ids.add(slot.id);
    if (slot.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time)) {
      throw new BadRequestException("用药时间格式无效");
    }
  }
  const startDate = parseDate(input.startDate, "开始日期");
  const endDate = optionalDate(input.endDate, "结束日期");
  if (endDate && endDate < startDate) throw new BadRequestException("结束日期不能早于开始日期");
}

function validateMedicationDose(input: MedicationDoseInput, slots: MedicationScheduleSlot[]) {
  parseDate(input.scheduledDate, "计划日期");
  if (!slots.some((slot) => slot.id === input.slotId)) throw new BadRequestException("用药时间不存在");
  if (!["taken", "missed", "paused"].includes(input.status)) {
    throw new BadRequestException("用药状态无效");
  }
  if (input.takenAt) parseDateTime(input.takenAt, "实际用药时间");
  validateOptionalNumber(input.actualDoseQuantity, 0.01, 100000, "实际剂量");
}

function validateMedicationInventory(input: MedicationInventoryInput) {
  if (!["restock", "set"].includes(input.mode)) throw new BadRequestException("库存操作无效");
  validateRequiredNumber(input.quantity, 0, 10000000, "库存数量");
  if (input.mode === "restock" && Number(input.quantity) <= 0) {
    throw new BadRequestException("补药数量必须大于0");
  }
  parseDateTime(input.occurredAt, "库存变更时间");
}

function validateHealthFollowup(input: HealthFollowupInput) {
  parseDateTime(input.scheduledAt, "复诊时间");
  if (!input.type?.trim()) throw new BadRequestException("复诊类型不能为空");
  validateInteger(input.reminderDays, 0, 365, "提醒天数");
  if (input.status && !["scheduled", "completed", "cancelled"].includes(input.status)) {
    throw new BadRequestException("复诊状态无效");
  }
}

function mapProfile(row: {
  memberId: string;
  weightTrackingEnabled: boolean;
  exerciseTrackingEnabled: boolean;
  glucoseTrackingEnabled: boolean;
  hba1cTrackingEnabled: boolean;
  medicationTrackingEnabled: boolean;
  targetWeightKg: { toString(): string } | null;
  targetDate: Date | null;
  weeklyExerciseMinutesGoal: number;
  weeklyStrengthSessionsGoal: number;
  strengthExerciseGoals: unknown;
  dailyStepsGoal: number;
  glucoseIntervalDays: number;
  glucoseLowThreshold: { toString(): string };
  glucoseTargets: unknown;
  hba1cTargetMax: { toString(): string } | null;
}): MemberHealthProfile {
  return {
    memberId: row.memberId,
    weightTrackingEnabled: row.weightTrackingEnabled,
    exerciseTrackingEnabled: row.exerciseTrackingEnabled,
    glucoseTrackingEnabled: row.glucoseTrackingEnabled,
    hba1cTrackingEnabled: row.hba1cTrackingEnabled,
    medicationTrackingEnabled: row.medicationTrackingEnabled,
    ...(row.targetWeightKg ? { targetWeightKg: money(row.targetWeightKg) } : {}),
    ...(row.targetDate ? { targetDate: formatDate(row.targetDate) } : {}),
    weeklyExerciseMinutesGoal: row.weeklyExerciseMinutesGoal,
    weeklyStrengthSessionsGoal: row.weeklyStrengthSessionsGoal,
    strengthExerciseGoals: parseStrengthGoals(row.strengthExerciseGoals),
    dailyStepsGoal: row.dailyStepsGoal,
    glucoseIntervalDays: row.glucoseIntervalDays,
    glucoseLowThreshold: money(row.glucoseLowThreshold),
    glucoseTargets: parseGlucoseTargets(row.glucoseTargets),
    ...(row.hba1cTargetMax ? { hba1cTargetMax: money(row.hba1cTargetMax) } : {})
  };
}

function mapBodyMeasurement(row: {
  id: string;
  memberId: string;
  measuredAt: Date;
  weightKg: { toString(): string };
  waistCm: { toString(): string } | null;
  context: BodyMeasurementContext;
  note: string | null;
}): BodyMeasurement {
  return {
    id: row.id,
    memberId: row.memberId,
    measuredAt: row.measuredAt.toISOString(),
    weightKg: money(row.weightKg),
    ...(row.waistCm ? { waistCm: money(row.waistCm) } : {}),
    context: row.context,
    ...(row.note ? { note: row.note } : {})
  };
}

function mapExerciseLog(row: {
  id: string;
  memberId: string;
  date: Date;
  type: string;
  durationMinutes: number;
  intensity: "low" | "moderate" | "high";
  isStrengthTraining: boolean;
  steps: number | null;
  estimatedCalories: number | null;
  note: string | null;
  movements?: Array<{
    id: string;
    name: string;
    metric: "reps" | "seconds";
    sets: number[];
    variant: string | null;
    addedWeightKg: { toString(): string } | null;
    assistanceWeightKg: { toString(): string } | null;
    note: string | null;
  }>;
}): ExerciseLog {
  return {
    id: row.id,
    memberId: row.memberId,
    date: row.date.toISOString(),
    type: row.type,
    durationMinutes: row.durationMinutes,
    intensity: row.intensity,
    isStrengthTraining: row.isStrengthTraining,
    ...(row.steps === null ? {} : { steps: row.steps }),
    ...(row.estimatedCalories === null ? {} : { estimatedCalories: row.estimatedCalories }),
    movements: (row.movements ?? []).map(mapStrengthMovement),
    ...(row.note ? { note: row.note } : {})
  };
}

function mapStrengthMovement(row: {
  id: string;
  name: string;
  metric: "reps" | "seconds";
  sets: number[];
  variant: string | null;
  addedWeightKg: { toString(): string } | null;
  assistanceWeightKg: { toString(): string } | null;
  note: string | null;
}): StrengthExerciseMovement {
  return {
    id: row.id,
    name: row.name,
    metric: row.metric,
    sets: row.sets,
    total: row.sets.reduce((total, value) => total + value, 0),
    ...(row.variant ? { variant: row.variant } : {}),
    ...(row.addedWeightKg ? { addedWeightKg: money(row.addedWeightKg) } : {}),
    ...(row.assistanceWeightKg ? { assistanceWeightKg: money(row.assistanceWeightKg) } : {}),
    ...(row.note ? { note: row.note } : {})
  };
}

function mapBloodGlucose(row: {
  id: string;
  memberId: string;
  measuredAt: Date;
  glucoseMmol: { toString(): string };
  context: BloodGlucoseRecord["context"];
  meal: BloodGlucoseRecord["meal"] | null;
  exerciseRelation: BloodGlucoseRecord["exerciseRelation"] | null;
  medicationTaken: boolean | null;
  symptoms: string | null;
  note: string | null;
  source: BloodGlucoseRecord["source"];
}): BloodGlucoseRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    measuredAt: row.measuredAt.toISOString(),
    glucoseMmol: money(row.glucoseMmol),
    context: row.context,
    ...(row.meal ? { meal: row.meal } : {}),
    ...(row.exerciseRelation ? { exerciseRelation: row.exerciseRelation } : {}),
    ...(row.medicationTaken === null ? {} : { medicationTaken: row.medicationTaken }),
    ...(row.symptoms ? { symptoms: row.symptoms } : {}),
    ...(row.note ? { note: row.note } : {}),
    source: row.source
  };
}

function mapHba1c(row: {
  id: string;
  memberId: string;
  measuredAt: Date;
  valuePercent: { toString(): string };
  facility: string | null;
  doctorAdvice: string | null;
  nextReviewDate: Date | null;
}): Hba1cRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    measuredAt: row.measuredAt.toISOString(),
    valuePercent: money(row.valuePercent),
    ...(row.facility ? { facility: row.facility } : {}),
    ...(row.doctorAdvice ? { doctorAdvice: row.doctorAdvice } : {}),
    ...(row.nextReviewDate ? { nextReviewDate: formatDate(row.nextReviewDate) } : {})
  };
}

function mapWeeklyReview(row: {
  id: string;
  memberId: string;
  weekStart: Date;
  good: string | null;
  obstacle: string | null;
  nextAction: string | null;
}): WeeklyHealthReview {
  return {
    id: row.id,
    memberId: row.memberId,
    weekStart: formatDate(row.weekStart),
    ...(row.good ? { good: row.good } : {}),
    ...(row.obstacle ? { obstacle: row.obstacle } : {}),
    ...(row.nextAction ? { nextAction: row.nextAction } : {})
  };
}

function mapMedicationPlan(row: {
  id: string;
  memberId: string;
  name: string;
  specification: string | null;
  administrationRoute: MedicationPlan["administrationRoute"];
  frequency: MedicationPlan["frequency"];
  weekdays: number[];
  intervalDays: number | null;
  doseUnit: string | null;
  stockUnit: string;
  doseQuantity: { toString(): string };
  inventoryPerDose: { toString(): string } | null;
  scheduleSlots: unknown;
  startDate: Date;
  endDate: Date | null;
  purpose: string | null;
  instructions: string | null;
  status: MedicationPlan["status"];
  currentStock: { toString(): string };
  lowStockDays: number;
}): MedicationPlan {
  return {
    id: row.id,
    memberId: row.memberId,
    name: row.name,
    ...(row.specification ? { specification: row.specification } : {}),
    administrationRoute: row.administrationRoute,
    frequency: row.frequency,
    weekdays: row.weekdays,
    ...(row.intervalDays ? { intervalDays: row.intervalDays } : {}),
    doseUnit: row.doseUnit ?? row.stockUnit,
    stockUnit: row.stockUnit,
    doseQuantity: money(row.doseQuantity),
    inventoryPerDose: money(row.inventoryPerDose ?? row.doseQuantity),
    scheduleSlots: parseMedicationSlots(row.scheduleSlots),
    startDate: formatDate(row.startDate),
    ...(row.endDate ? { endDate: formatDate(row.endDate) } : {}),
    ...(row.purpose ? { purpose: row.purpose } : {}),
    ...(row.instructions ? { instructions: row.instructions } : {}),
    status: row.status,
    currentStock: money(row.currentStock),
    lowStockDays: row.lowStockDays
  };
}

function mapMedicationDose(row: {
  id: string;
  memberId: string;
  medicationId: string;
  scheduledDate: Date;
  slotId: string;
  scheduledLabel: string;
  status: MedicationDoseRecord["status"];
  quantityUsed: { toString(): string };
  actualDoseQuantity: { toString(): string } | null;
  injectionSite: string | null;
  takenAt: Date | null;
  note: string | null;
}): MedicationDoseRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    medicationId: row.medicationId,
    scheduledDate: formatDate(row.scheduledDate),
    slotId: row.slotId,
    scheduledLabel: row.scheduledLabel,
    status: row.status,
    quantityUsed: money(row.quantityUsed),
    ...(row.actualDoseQuantity ? { actualDoseQuantity: money(row.actualDoseQuantity) } : {}),
    ...(row.injectionSite ? { injectionSite: row.injectionSite } : {}),
    ...(row.takenAt ? { takenAt: row.takenAt.toISOString() } : {}),
    ...(row.note ? { note: row.note } : {})
  };
}

function mapMedicationInventory(row: {
  id: string;
  medicationId: string;
  doseRecordId: string | null;
  type: MedicationInventoryEvent["type"];
  quantityDelta: { toString(): string };
  occurredAt: Date;
  note: string | null;
}): MedicationInventoryEvent {
  return {
    id: row.id,
    medicationId: row.medicationId,
    ...(row.doseRecordId ? { doseRecordId: row.doseRecordId } : {}),
    type: row.type,
    quantityDelta: money(row.quantityDelta),
    occurredAt: row.occurredAt.toISOString(),
    ...(row.note ? { note: row.note } : {})
  };
}

function mapHealthFollowup(row: {
  id: string;
  memberId: string;
  scheduledAt: Date;
  hospital: string | null;
  department: string | null;
  doctor: string | null;
  type: string;
  tests: unknown;
  reminderDays: number;
  status: HealthFollowup["status"];
  resultSummary: string | null;
  doctorAdvice: string | null;
}): HealthFollowup {
  return {
    id: row.id,
    memberId: row.memberId,
    scheduledAt: row.scheduledAt.toISOString(),
    ...(row.hospital ? { hospital: row.hospital } : {}),
    ...(row.department ? { department: row.department } : {}),
    ...(row.doctor ? { doctor: row.doctor } : {}),
    type: row.type,
    tests: parseStringArray(row.tests),
    reminderDays: row.reminderDays,
    status: row.status,
    ...(row.resultSummary ? { resultSummary: row.resultSummary } : {}),
    ...(row.doctorAdvice ? { doctorAdvice: row.doctorAdvice } : {})
  };
}

function parseMedicationSlots(value: unknown): MedicationScheduleSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.label !== "string") return [];
    return [{
      id: candidate.id,
      label: candidate.label,
      ...(typeof candidate.time === "string" ? { time: candidate.time } : {})
    }];
  });
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseGlucoseTargets(value: unknown): GlucoseTargets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GlucoseTargets;
}

function parseStrengthGoals(value: unknown): StrengthExerciseGoal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string"
      || typeof candidate.name !== "string"
      || (candidate.metric !== "reps" && candidate.metric !== "seconds")
    ) {
      return [];
    }
    return [{
      id: candidate.id,
      name: candidate.name,
      metric: candidate.metric,
      ...(typeof candidate.weeklyGoal === "number" ? { weeklyGoal: candidate.weeklyGoal } : {}),
      ...(typeof candidate.singleSessionGoal === "number" ? { singleSessionGoal: candidate.singleSessionGoal } : {}),
      ...(typeof candidate.maxSetGoal === "number" ? { maxSetGoal: candidate.maxSetGoal } : {})
    }];
  });
}

function exerciseTypeWithMovements(row: {
  type: string;
  movements?: Array<{ name: string; metric: "reps" | "seconds"; sets: number[] }>;
}): string {
  if (!row.movements?.length) return row.type;
  const details = row.movements.map((movement) => {
    const total = movement.sets.reduce((sum, value) => sum + value, 0);
    return `${movement.name} ${total}${movement.metric === "seconds" ? "秒" : "次"}`;
  });
  return `${row.type}（${details.join("；")}）`;
}

function medicationRouteLabel(route: MedicationPlan["administrationRoute"]): string {
  return {
    oral: "口服",
    injection: "注射",
    topical: "外用",
    other: "其他"
  }[route];
}

function medicationFrequencyLabel(row: {
  frequency: MedicationPlan["frequency"];
  weekdays: number[];
  intervalDays: number | null;
  scheduleSlots: unknown;
}): string {
  const times = parseMedicationSlots(row.scheduleSlots)
    .map((slot) => `${slot.time ? `${slot.time} ` : ""}${slot.label}`)
    .join("、");
  if (row.frequency === "weekly") {
    const weekdays = row.weekdays.map((value) => `周${"一二三四五六日"[value - 1]}`).join("、");
    return `每周${weekdays}${times ? ` / ${times}` : ""}`;
  }
  if (row.frequency === "interval") {
    return `每隔${row.intervalDays ?? 1}天${times ? ` / ${times}` : ""}`;
  }
  return `每天${times ? ` / ${times}` : ""}`;
}

function validateRequiredNumber(value: string | number | undefined, min: number, max: number, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new BadRequestException(`${label}必须在 ${min} 至 ${max} 之间`);
  }
}

function validateOptionalNumber(value: string | number | undefined, min: number, max: number, label: string) {
  if (value === undefined || value === "") return;
  validateRequiredNumber(value, min, max, label);
}

function validateInteger(value: number | undefined, min: number, max: number, label: string) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`${label}必须是 ${min} 至 ${max} 之间的整数`);
  }
}

function decimal(value: string, label: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException(`${label}格式无效`);
  return number.toFixed(2);
}

function optionalDecimal(value?: string): string | null {
  if (value === undefined || value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException("数值格式无效");
  return number.toFixed(2);
}

function parseDate(value: string, label: string): Date {
  if (!DATE_PATTERN.test(value)) throw new BadRequestException(`${label}格式无效`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new BadRequestException(`${label}格式无效`);
  return date;
}

function parseDateTime(value: string, label: string): Date {
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw new BadRequestException(`${label}格式无效`);
  return date;
}

function parseOptionalDateTime(value?: string): Date | null {
  return value ? parseDateTime(value, "时间") : null;
}

function optionalDate(value: string | undefined, label: string): Date | null {
  if (!value) return null;
  return parseDate(value, label);
}

function cleanText(value?: string): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000+08:00`);
}

function assertMonth(month: string): void {
  if (!MONTH_PATTERN.test(month)) throw new BadRequestException("月份格式无效");
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber < 1 || monthNumber > 12) throw new BadRequestException("月份格式无效");
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function referenceDateForMonth(month: string): Date {
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (month === currentMonth) return new Date();
  return month < currentMonth ? addDays(monthStart(shiftMonth(month, 1)), -1) : monthStart(month);
}

function startOfWeek(date: Date): Date {
  const [year, month, dayOfMonth] = formatDate(date).split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, dayOfMonth));
  const day = result.getUTCDay() || 7;
  result.setUTCDate(result.getUTCDate() - day + 1);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.valueOf() + days * 24 * 60 * 60 * 1000);
}

function formatDate(date: Date): string {
  const parts = SHANGHAI_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function money(value: { toString(): string }): string {
  return Number(value.toString()).toFixed(2);
}

function csvCell(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
