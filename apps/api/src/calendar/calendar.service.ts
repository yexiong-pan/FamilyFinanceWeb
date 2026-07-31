import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CalendarData,
  CalendarDayEntry,
  CalendarDaySummary,
  CalendarEvent,
  CalendarEventInput,
  CalendarEventOccurrence,
  CalendarEventStatus,
  CalendarEventType,
  CalendarFollowupItem,
  CalendarGlucoseStatus,
  CalendarGlucoseReading,
  CalendarMedicationSummary,
  CalendarMonthSummary,
  CalendarPeriodSummary,
  CalendarView,
  GlucoseContext,
  GlucoseTargets,
  MedicationScheduleSlot
} from "@family-finance/shared";
import {
  buildCalendarEventOccurrences,
  isMedicationScheduledOnDate
} from "@family-finance/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

const DEFAULT_FAMILY_ID = "default-family";
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;
const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHANGHAI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

interface MutableMedicationSummary {
  scheduled: number;
  dueScheduled: number;
  taken: number;
  missed: number;
  paused: number;
}

interface MutablePeriodSummary {
  incomeCents: number;
  expenseCents: number;
  incomeCount: number;
  expenseCount: number;
  glucoseMeasurements: number;
  glucoseAbnormalCount: number;
  exerciseMinutes: number;
  medication: MutableMedicationSummary;
  followupCount: number;
  scheduledFollowupCount: number;
  scheduleCount: number;
  anniversaryCount: number;
  glucoseReadings: CalendarGlucoseReading[];
  followups: CalendarFollowupItem[];
}

type CalendarEventRow = Prisma.CalendarEventGetPayload<{
  include: {
    participants: {
      include: {
        member: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
  };
}>;

interface HealthProfileThresholds {
  glucoseLowThreshold: { toString(): string };
  glucoseTargets: unknown;
}

@Injectable()
export class CalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEvents(
    requestedMemberId?: string,
    type?: CalendarEventType,
    status?: CalendarEventStatus
  ): Promise<CalendarEvent[]> {
    if (type && type !== "schedule" && type !== "anniversary") {
      throw new BadRequestException("日程类型无效");
    }
    if (status && status !== "scheduled" && status !== "completed" && status !== "cancelled") {
      throw new BadRequestException("日程状态无效");
    }
    if (requestedMemberId && requestedMemberId !== "all") {
      await this.requireMembers([requestedMemberId]);
    }
    const rows = await this.prisma.calendarEvent.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(requestedMemberId && requestedMemberId !== "all"
          ? { participants: { some: { memberId: requestedMemberId } } }
          : {})
      },
      include: calendarEventInclude,
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }]
    });
    return rows.map(mapCalendarEvent);
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const normalized = await this.normalizeEventInput(input);
    const row = await this.prisma.calendarEvent.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        ...normalized.data,
        participants: {
          create: normalized.memberIds.map((memberId) => ({ memberId }))
        }
      },
      include: calendarEventInclude
    });
    return mapCalendarEvent(row);
  }

  async updateEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
    await this.requireEvent(id);
    const normalized = await this.normalizeEventInput(input);
    const row = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...normalized.data,
        participants: {
          deleteMany: {},
          create: normalized.memberIds.map((memberId) => ({ memberId }))
        }
      },
      include: calendarEventInclude
    });
    return mapCalendarEvent(row);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.requireEvent(id);
    await this.prisma.calendarEvent.delete({ where: { id } });
  }

  async getCalendar(view: CalendarView, period: string, requestedMemberId?: string): Promise<CalendarData> {
    validatePeriod(view, period);
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: DEFAULT_FAMILY_ID },
      select: { id: true, name: true }
    });
    const selectedMember = requestedMemberId && requestedMemberId !== "all"
      ? members.find((member) => member.id === requestedMemberId)
      : undefined;
    if (requestedMemberId && requestedMemberId !== "all" && !selectedMember) {
      throw new NotFoundException("家庭成员不存在");
    }

    const memberIds = selectedMember ? [selectedMember.id] : members.map((member) => member.id);
    const memberNameById = new Map(members.map((member) => [member.id, member.name]));
    const memberIdByName = new Map(members.map((member) => [member.name, member.id]));
    const range = periodRange(view, period);
    const financeStart = view === "year"
      ? new Date(`${Number(period) - 1}-12-01T00:00:00.000+08:00`)
      : range.start;
    const today = dateOnlyUtc(dateKey(new Date()));
    const reminderRangeEnd = addUtcDays(today, 30);

    const [
      transactions,
      profiles,
      bodyRows,
      glucoseRows,
      latestGlucoseRows,
      exerciseRows,
      medicationPlans,
      medicationDoseRows,
      followupRows,
      upcomingFollowupRow,
      calendarEventRows,
      upcomingCalendarEventRows
    ] = await Promise.all([
      this.prisma.financeTransaction.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          deletedAt: null,
          kind: { in: ["income", "expense"] },
          date: { gte: financeStart, lt: range.end },
          ...(selectedMember ? { memberName: selectedMember.name } : {})
        },
        select: { date: true, kind: true, amount: true, memberName: true }
      }),
      this.prisma.memberHealthProfile.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, memberId: { in: memberIds } },
        select: { memberId: true, glucoseLowThreshold: true, glucoseTargets: true }
      }),
      this.prisma.bodyMeasurement.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          measuredAt: { gte: range.start, lt: range.end }
        },
        orderBy: { measuredAt: "desc" },
        select: { memberId: true, measuredAt: true, weightKg: true }
      }),
      this.prisma.bloodGlucoseRecord.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          measuredAt: { gte: range.start, lt: range.end }
        },
        orderBy: { measuredAt: "asc" }
      }),
      this.prisma.bloodGlucoseRecord.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds }
        },
        orderBy: { measuredAt: "desc" },
        select: {
          memberId: true,
          measuredAt: true,
          glucoseMmol: true,
          context: true
        }
      }),
      this.prisma.exerciseLog.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          date: { gte: range.start, lt: range.end }
        },
        include: { movements: { orderBy: { sortOrder: "asc" } } }
      }),
      this.prisma.medicationPlan.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          startDate: { lt: range.end },
          OR: [{ endDate: null }, { endDate: { gte: range.start } }]
        },
        select: {
          id: true,
          memberId: true,
          scheduleSlots: true,
          startDate: true,
          endDate: true,
          frequency: true,
          weekdays: true,
          intervalDays: true,
          status: true
        }
      }),
      this.prisma.medicationDoseRecord.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          scheduledDate: { gte: range.start, lt: range.end }
        },
        select: { memberId: true, scheduledDate: true, status: true }
      }),
      this.prisma.healthFollowup.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          scheduledAt: { gte: range.start, lt: range.end }
        },
        orderBy: { scheduledAt: "asc" }
      }),
      this.prisma.healthFollowup.findFirst({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          memberId: { in: memberIds },
          status: "scheduled",
          scheduledAt: { gte: today }
        },
        orderBy: { scheduledAt: "asc" }
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          status: { not: "cancelled" },
          startDate: { lt: range.end },
          OR: [
            { recurrenceEndDate: null },
            { recurrenceEndDate: { gte: range.start } }
          ],
          ...(selectedMember
            ? { participants: { some: { memberId: selectedMember.id } } }
            : {})
        },
        include: calendarEventInclude
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          status: "scheduled",
          startDate: { lte: reminderRangeEnd },
          OR: [
            { recurrenceEndDate: null },
            { recurrenceEndDate: { gte: today } }
          ],
          ...(selectedMember
            ? { participants: { some: { memberId: selectedMember.id } } }
            : {})
        },
        include: calendarEventInclude
      })
    ]);

    const dayBuckets = new Map<string, MutablePeriodSummary>();
    const monthBuckets = new Map<string, MutablePeriodSummary>();
    const entriesByDate = new Map<string, CalendarDayEntry[]>();
    const financeEntries = new Map<string, {
      date: string;
      memberName: string;
      kind: "income" | "expense";
      cents: number;
    }>();
    const exerciseEntries = new Map<string, {
      date: string;
      memberId: string;
      exerciseType: string;
      minutes: number;
      movements: Map<string, { name: string; metric: "reps" | "seconds"; total: number }>;
    }>();
    const medicationEntries = new Map<string, {
      date: string;
      memberId: string;
      summary: MutableMedicationSummary;
    }>();
    const addEntry = (date: string, entry: CalendarDayEntry) => {
      if (view !== "month") return;
      const entries = entriesByDate.get(date) ?? [];
      entries.push(entry);
      entriesByDate.set(date, entries);
    };
    if (view === "year") {
      for (let month = 1; month <= 12; month += 1) {
        monthBuckets.set(`${period}-${String(month).padStart(2, "0")}`, emptyMutableSummary());
      }
    }
    const bucketFor = (date: Date) => {
      const key = view === "month" ? dateKey(date) : monthKey(date);
      const buckets = view === "month" ? dayBuckets : monthBuckets;
      const existing = buckets.get(key);
      if (existing) return existing;
      const created = emptyMutableSummary();
      buckets.set(key, created);
      return created;
    };

    const previousMonthExpenseCents = new Map<string, number>();
    for (const row of transactions) {
      if (row.kind !== "income" && row.kind !== "expense") continue;
      const rowMonth = monthKey(row.date);
      if (row.date < range.start) {
        if (row.kind === "expense") {
          previousMonthExpenseCents.set(
            rowMonth,
            (previousMonthExpenseCents.get(rowMonth) ?? 0) + amountToCents(row.amount)
          );
        }
        continue;
      }
      const bucket = bucketFor(row.date);
      const cents = amountToCents(row.amount);
      if (row.kind === "income") {
        bucket.incomeCents += cents;
        bucket.incomeCount += 1;
      } else {
        bucket.expenseCents += cents;
        bucket.expenseCount += 1;
      }
      if (view === "month") {
        const date = dateKey(row.date);
        const key = `${date}|${row.memberName}|${row.kind}`;
        const entry = financeEntries.get(key) ?? {
          date,
          memberName: row.memberName,
          kind: row.kind,
          cents: 0
        };
        entry.cents += cents;
        financeEntries.set(key, entry);
      }
    }

    const profileByMember = new Map(
      profiles.map((profile) => [profile.memberId, profile as HealthProfileThresholds])
    );
    for (const row of glucoseRows) {
      const bucket = bucketFor(row.measuredAt);
      const abnormal = glucoseIsAbnormal(
        Number(row.glucoseMmol.toString()),
        row.context,
        profileByMember.get(row.memberId)
      );
      bucket.glucoseMeasurements += 1;
      if (abnormal) bucket.glucoseAbnormalCount += 1;
      bucket.glucoseReadings.push({
        id: row.id,
        memberId: row.memberId,
        memberName: memberNameById.get(row.memberId) ?? "未知成员",
        measuredAt: row.measuredAt.toISOString(),
        value: Number(row.glucoseMmol.toString()).toFixed(2),
        context: row.context,
        abnormal
      });
      addEntry(dateKey(row.measuredAt), {
        id: `glucose-${row.id}`,
        type: "glucose",
        memberId: row.memberId,
        memberName: memberNameById.get(row.memberId) ?? "未知成员",
        value: Number(row.glucoseMmol.toString()).toFixed(2),
        context: row.context,
        abnormal
      });
    }

    for (const row of bodyRows) {
      bucketFor(row.measuredAt);
      addEntry(dateKey(row.measuredAt), {
        id: `weight-${row.memberId}-${row.measuredAt.toISOString()}`,
        type: "weight",
        memberId: row.memberId,
        memberName: memberNameById.get(row.memberId) ?? "未知成员",
        value: Number(row.weightKg.toString()).toFixed(2)
      });
    }

    for (const row of exerciseRows) {
      bucketFor(row.date).exerciseMinutes += row.durationMinutes;
      if (view === "month") {
        const date = dateKey(row.date);
        const key = `${date}|${row.memberId}|${row.type}`;
        const entry = exerciseEntries.get(key) ?? {
          date,
          memberId: row.memberId,
          exerciseType: row.type,
          minutes: 0,
          movements: new Map()
        };
        entry.minutes += row.durationMinutes;
        for (const movement of row.movements ?? []) {
          const movementKey = `${movement.name.toLocaleLowerCase("zh-CN")}|${movement.metric}`;
          const current = entry.movements.get(movementKey) ?? {
            name: movement.name,
            metric: movement.metric,
            total: 0
          };
          current.total += movement.sets.reduce((sum, value) => sum + value, 0);
          entry.movements.set(movementKey, current);
        }
        exerciseEntries.set(key, entry);
      }
    }

    for (const plan of medicationPlans) {
      if (plan.status !== "active") continue;
      const planStart = maxDate(range.start, utcDayStart(plan.startDate));
      const planEndExclusive = minDate(
        range.end,
        plan.endDate ? addUtcDays(utcDayStart(plan.endDate), 1) : range.end
      );
      const slots = medicationSlots(plan.scheduleSlots);
      const scheduleRule = {
        startDate: dateKey(plan.startDate),
        ...(plan.endDate ? { endDate: dateKey(plan.endDate) } : {}),
        frequency: plan.frequency,
        weekdays: plan.weekdays,
        ...(plan.intervalDays ? { intervalDays: plan.intervalDays } : {})
      };
      for (let date = planStart; date < planEndExclusive; date = addUtcDays(date, 1)) {
        if (!isMedicationScheduledOnDate(scheduleRule, dateKey(date))) continue;
        const bucket = bucketFor(date);
        bucket.medication.scheduled += slots.length;
        if (date <= today) bucket.medication.dueScheduled += slots.length;
        if (view === "month") {
          const dateValue = dateKey(date);
          const key = `${dateValue}|${plan.memberId}`;
          const entry = medicationEntries.get(key) ?? {
            date: dateValue,
            memberId: plan.memberId,
            summary: emptyMutableMedication()
          };
          entry.summary.scheduled += slots.length;
          if (date <= today) entry.summary.dueScheduled += slots.length;
          medicationEntries.set(key, entry);
        }
      }
    }

    for (const row of medicationDoseRows) {
      const bucket = bucketFor(row.scheduledDate);
      bucket.medication[row.status] += 1;
      const recorded = bucket.medication.taken + bucket.medication.missed + bucket.medication.paused;
      bucket.medication.scheduled = Math.max(bucket.medication.scheduled, recorded);
      if (row.scheduledDate <= today) {
        bucket.medication.dueScheduled = Math.max(bucket.medication.dueScheduled, recorded);
      }
      if (view === "month") {
        const date = dateKey(row.scheduledDate);
        const key = `${date}|${row.memberId}`;
        const entry = medicationEntries.get(key) ?? {
          date,
          memberId: row.memberId,
          summary: emptyMutableMedication()
        };
        entry.summary[row.status] += 1;
        const memberRecorded = entry.summary.taken + entry.summary.missed + entry.summary.paused;
        entry.summary.scheduled = Math.max(entry.summary.scheduled, memberRecorded);
        if (row.scheduledDate <= today) {
          entry.summary.dueScheduled = Math.max(entry.summary.dueScheduled, memberRecorded);
        }
        medicationEntries.set(key, entry);
      }
    }

    for (const row of followupRows) {
      const bucket = bucketFor(row.scheduledAt);
      if (row.status !== "cancelled") bucket.followupCount += 1;
      if (row.status === "scheduled") bucket.scheduledFollowupCount += 1;
      bucket.followups.push({
        id: row.id,
        memberId: row.memberId,
        memberName: memberNameById.get(row.memberId) ?? "未知成员",
        scheduledAt: row.scheduledAt.toISOString(),
        type: row.type,
        status: row.status,
        ...(row.hospital ? { hospital: row.hospital } : {}),
        ...(row.department ? { department: row.department } : {})
      });
      addEntry(dateKey(row.scheduledAt), {
        id: `followup-${row.id}`,
        type: "followup",
        memberId: row.memberId,
        memberName: memberNameById.get(row.memberId) ?? "未知成员",
        label: row.type
      });
    }

    const eventOccurrences = calendarEventRows.flatMap((row) => buildCalendarEventOccurrences(
      mapCalendarEvent(row),
      dateKey(range.start),
      dateKey(addUtcDays(range.end, -1)),
      dateKey(new Date())
    ));
    const upcomingEvents = upcomingCalendarEventRows
      .flatMap((row) => buildCalendarEventOccurrences(
        mapCalendarEvent(row),
        dateKey(today),
        dateKey(reminderRangeEnd),
        dateKey(today)
      ))
      .filter((occurrence) => (
        occurrence.countdownDays !== undefined
        && occurrence.countdownDays >= 0
        && occurrence.reminderDays.some((days) => occurrence.countdownDays! <= days)
      ))
      .sort((left, right) => (
        left.date.localeCompare(right.date)
        || (left.startTime ?? "").localeCompare(right.startTime ?? "")
      ))
      .slice(0, 4);
    for (const occurrence of eventOccurrences) {
      const bucket = bucketFor(dateOnlyUtc(occurrence.date));
      if (occurrence.type === "schedule") {
        bucket.scheduleCount += 1;
      } else {
        bucket.anniversaryCount += 1;
      }
      addEntry(occurrence.date, {
        id: `event-${occurrence.eventId}-${occurrence.date}`,
        type: occurrence.type,
        memberName: occurrence.participants.map((item) => item.memberName).join("、") || "未指定成员",
        label: occurrence.title,
        event: occurrence
      });
    }

    for (const entry of financeEntries.values()) {
      addEntry(entry.date, {
        id: `${entry.kind}-${entry.date}-${entry.memberName}`,
        type: entry.kind,
        ...(memberIdByName.get(entry.memberName) ? { memberId: memberIdByName.get(entry.memberName) } : {}),
        memberName: entry.memberName,
        amount: centsToMoney(entry.cents)
      });
    }
    for (const entry of exerciseEntries.values()) {
      addEntry(entry.date, {
        id: `exercise-${entry.date}-${entry.memberId}-${entry.exerciseType}`,
        type: "exercise",
        memberId: entry.memberId,
        memberName: memberNameById.get(entry.memberId) ?? "未知成员",
        label: entry.exerciseType,
        minutes: entry.minutes,
        ...(entry.movements.size ? {
          detail: [...entry.movements.values()]
            .map((movement) => (
              `${movement.name}${movement.total}${movement.metric === "seconds" ? "秒" : "次"}`
            ))
            .join(" · ")
        } : {})
      });
    }
    for (const entry of medicationEntries.values()) {
      addEntry(entry.date, {
        id: `medication-${entry.date}-${entry.memberId}`,
        type: "medication",
        memberId: entry.memberId,
        memberName: memberNameById.get(entry.memberId) ?? "未知成员",
        medication: finishMedication(entry.summary)
      });
    }

    const days: CalendarDaySummary[] = view === "month"
      ? [...dayBuckets.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, bucket]) => ({
          date,
          ...finishSummary(bucket),
          entries: sortDayEntries(entriesByDate.get(date) ?? []),
          glucoseReadings: bucket.glucoseReadings,
          followups: bucket.followups
        }))
      : [];
    const months: CalendarMonthSummary[] = view === "year"
      ? [...monthBuckets.entries()].map(([month, bucket]) => {
        const previousMonth = shiftMonthKey(month, -1);
        const previousExpense = monthBuckets.get(previousMonth)?.expenseCents
          ?? previousMonthExpenseCents.get(previousMonth)
          ?? 0;
        return {
          month,
          ...finishSummary(bucket),
          followups: bucket.followups,
          ...(expenseChangeRate(bucket.expenseCents, previousExpense) === undefined
            ? {}
            : { expenseChangeRate: expenseChangeRate(bucket.expenseCents, previousExpense) })
        };
      })
      : [];
    const periodSummary = finishSummary(
      view === "month"
        ? combineSummaries(dayBuckets.values())
        : combineSummaries(monthBuckets.values())
    );
    const exerciseMinutesByMember = new Map<string, number>();
    const exerciseActivitiesByMember = new Map<string, Map<string, number>>();
    for (const row of exerciseRows) {
      exerciseMinutesByMember.set(
        row.memberId,
        (exerciseMinutesByMember.get(row.memberId) ?? 0) + row.durationMinutes
      );
      const activities = exerciseActivitiesByMember.get(row.memberId) ?? new Map<string, number>();
      activities.set(row.type, (activities.get(row.type) ?? 0) + row.durationMinutes);
      exerciseActivitiesByMember.set(row.memberId, activities);
    }
    const latestWeightByMemberId = new Map<string, typeof bodyRows[number]>();
    for (const row of bodyRows) {
      if (!latestWeightByMemberId.has(row.memberId)) {
        latestWeightByMemberId.set(row.memberId, row);
      }
    }
    const latestGlucoseByMemberId = new Map<string, typeof latestGlucoseRows[number]>();
    for (const row of latestGlucoseRows) {
      if (!latestGlucoseByMemberId.has(row.memberId)) {
        latestGlucoseByMemberId.set(row.memberId, row);
      }
    }

    return {
      view,
      period,
      ...(selectedMember ? { memberId: selectedMember.id } : {}),
      summary: periodSummary,
      exerciseByMember: memberIds.map((memberId) => ({
        memberId,
        memberName: memberNameById.get(memberId) ?? "未知成员",
        minutes: exerciseMinutesByMember.get(memberId) ?? 0,
        activities: [...(exerciseActivitiesByMember.get(memberId) ?? new Map<string, number>()).entries()]
          .map(([type, minutes]) => ({ type, minutes }))
          .sort((left, right) => right.minutes - left.minutes || left.type.localeCompare(right.type, "zh-CN"))
      })),
      latestWeightByMember: memberIds.map((memberId) => {
        const measurement = latestWeightByMemberId.get(memberId);
        return {
          memberId,
          memberName: memberNameById.get(memberId) ?? "未知成员",
          ...(measurement ? {
            measuredAt: measurement.measuredAt.toISOString(),
            weightKg: Number(measurement.weightKg.toString()).toFixed(2)
          } : {})
        };
      }),
      latestGlucoseByMember: memberIds.map((memberId) => {
        const reading = latestGlucoseByMemberId.get(memberId);
        if (!reading) {
          return {
            memberId,
            memberName: memberNameById.get(memberId) ?? "未知成员"
          };
        }
        const profile = profileByMember.get(memberId);
        const range = glucoseTargetRange(reading.context, profile);
        return {
          memberId,
          memberName: memberNameById.get(memberId) ?? "未知成员",
          measuredAt: reading.measuredAt.toISOString(),
          value: Number(reading.glucoseMmol.toString()).toFixed(2),
          context: reading.context,
          status: glucoseStatus(Number(reading.glucoseMmol.toString()), reading.context, profile),
          ...(range?.min !== undefined ? { targetMin: String(range.min) } : {}),
          ...(range?.max !== undefined ? { targetMax: String(range.max) } : {})
        };
      }),
      ...(upcomingFollowupRow ? {
        upcomingFollowup: calendarFollowupItem(upcomingFollowupRow, memberNameById)
      } : {}),
      upcomingEvents,
      days,
      months
    };
  }

  private async normalizeEventInput(input: CalendarEventInput) {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException("请输入日程名称");
    if (input.type !== "schedule" && input.type !== "anniversary") {
      throw new BadRequestException("日程类型无效");
    }
    if (input.calendarSystem !== "solar" && input.calendarSystem !== "lunar") {
      throw new BadRequestException("历法无效");
    }
    if (!isDateKey(input.startDate)) throw new BadRequestException("开始日期无效");
    if (input.endDate && !isDateKey(input.endDate)) throw new BadRequestException("结束日期无效");
    if (input.endDate && input.endDate < input.startDate) {
      throw new BadRequestException("结束日期不能早于开始日期");
    }
    if (input.recurrenceEndDate && !isDateKey(input.recurrenceEndDate)) {
      throw new BadRequestException("重复结束日期无效");
    }
    if (input.recurrenceEndDate && input.recurrenceEndDate < input.startDate) {
      throw new BadRequestException("重复结束日期不能早于开始日期");
    }
    if (!["none", "daily", "weekly", "monthly", "yearly"].includes(input.recurrence)) {
      throw new BadRequestException("重复规则无效");
    }
    if (
      input.status
      && !["scheduled", "completed", "cancelled"].includes(input.status)
    ) {
      throw new BadRequestException("日程状态无效");
    }
    if (input.calendarSystem === "lunar") {
      if (
        !Number.isInteger(input.lunarMonth)
        || input.lunarMonth! < 1
        || input.lunarMonth! > 12
        || !Number.isInteger(input.lunarDay)
        || input.lunarDay! < 1
        || input.lunarDay! > 30
      ) {
        throw new BadRequestException("农历日期无效");
      }
      if (input.recurrence !== "yearly") {
        throw new BadRequestException("农历日程目前仅支持每年重复");
      }
    }
    if (!input.allDay && !input.startTime) {
      throw new BadRequestException("请输入开始时间");
    }
    if (!input.allDay && input.startTime && !isTime(input.startTime)) {
      throw new BadRequestException("开始时间无效");
    }
    if (!input.allDay && input.endTime && !isTime(input.endTime)) {
      throw new BadRequestException("结束时间无效");
    }
    const memberIds = [...new Set(input.memberIds ?? [])];
    await this.requireMembers(memberIds);
    return {
      memberIds,
      data: {
        title,
        type: input.type,
        calendarSystem: input.calendarSystem,
        startDate: dateOnlyUtc(input.startDate),
        ...(input.endDate ? { endDate: dateOnlyUtc(input.endDate) } : { endDate: null }),
        ...(!input.allDay && input.startTime ? { startTime: input.startTime } : { startTime: null }),
        ...(!input.allDay && input.endTime ? { endTime: input.endTime } : { endTime: null }),
        allDay: input.allDay,
        recurrence: input.recurrence,
        ...(input.recurrenceEndDate
          ? { recurrenceEndDate: dateOnlyUtc(input.recurrenceEndDate) }
          : { recurrenceEndDate: null }),
        ...(input.calendarSystem === "lunar"
          ? {
              lunarMonth: input.lunarMonth,
              lunarDay: input.lunarDay,
              lunarLeapMonth: input.lunarLeapMonth ?? false
            }
          : { lunarMonth: null, lunarDay: null, lunarLeapMonth: false }),
        originalYear: input.originalYear ?? null,
        showCountdown: input.showCountdown ?? false,
        reminderDays: [...new Set(input.reminderDays ?? [])]
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 365)
          .sort((left, right) => right - left),
        location: input.location?.trim() || null,
        note: input.note?.trim() || null,
        status: input.status ?? "scheduled"
      }
    };
  }

  private async requireMembers(memberIds: string[]): Promise<void> {
    if (!memberIds.length) return;
    const count = await this.prisma.familyMember.count({
      where: { familyId: DEFAULT_FAMILY_ID, id: { in: memberIds } }
    });
    if (count !== memberIds.length) throw new NotFoundException("家庭成员不存在");
  }

  private async requireEvent(id: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, familyId: DEFAULT_FAMILY_ID },
      select: { id: true }
    });
    if (!event) throw new NotFoundException("日程不存在");
  }
}

const calendarEventInclude = {
  participants: {
    include: {
      member: {
        select: {
          id: true,
          name: true
        }
      }
    }
  }
} satisfies Prisma.CalendarEventInclude;

function mapCalendarEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    calendarSystem: row.calendarSystem,
    startDate: dateKey(row.startDate),
    ...(row.endDate ? { endDate: dateKey(row.endDate) } : {}),
    ...(row.startTime ? { startTime: row.startTime } : {}),
    ...(row.endTime ? { endTime: row.endTime } : {}),
    allDay: row.allDay,
    recurrence: row.recurrence,
    ...(row.recurrenceEndDate ? { recurrenceEndDate: dateKey(row.recurrenceEndDate) } : {}),
    ...(row.lunarMonth ? { lunarMonth: row.lunarMonth } : {}),
    ...(row.lunarDay ? { lunarDay: row.lunarDay } : {}),
    lunarLeapMonth: row.lunarLeapMonth,
    ...(row.originalYear ? { originalYear: row.originalYear } : {}),
    showCountdown: row.showCountdown,
    reminderDays: row.reminderDays,
    ...(row.location ? { location: row.location } : {}),
    ...(row.note ? { note: row.note } : {}),
    status: row.status,
    participants: row.participants.map(({ member }) => ({
      memberId: member.id,
      memberName: member.name
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function calendarFollowupItem(
  row: {
    id: string;
    memberId: string;
    scheduledAt: Date;
    type: string;
    status: CalendarFollowupItem["status"];
    hospital: string | null;
    department: string | null;
  },
  memberNameById: Map<string, string>
): CalendarFollowupItem {
  return {
    id: row.id,
    memberId: row.memberId,
    memberName: memberNameById.get(row.memberId) ?? "未知成员",
    scheduledAt: row.scheduledAt.toISOString(),
    type: row.type,
    status: row.status,
    ...(row.hospital ? { hospital: row.hospital } : {}),
    ...(row.department ? { department: row.department } : {})
  };
}

function emptyMutableSummary(): MutablePeriodSummary {
  return {
    incomeCents: 0,
    expenseCents: 0,
    incomeCount: 0,
    expenseCount: 0,
    glucoseMeasurements: 0,
    glucoseAbnormalCount: 0,
    exerciseMinutes: 0,
    medication: emptyMutableMedication(),
    followupCount: 0,
    scheduledFollowupCount: 0,
    scheduleCount: 0,
    anniversaryCount: 0,
    glucoseReadings: [],
    followups: []
  };
}

function emptyMutableMedication(): MutableMedicationSummary {
  return {
    scheduled: 0,
    dueScheduled: 0,
    taken: 0,
    missed: 0,
    paused: 0
  };
}

function sortDayEntries(entries: CalendarDayEntry[]): CalendarDayEntry[] {
  const priority: Record<CalendarDayEntry["type"], number> = {
    anniversary: 0,
    schedule: 1,
    followup: 2,
    expense: 3,
    income: 4,
    glucose: 5,
    medication: 6,
    exercise: 7,
    weight: 8
  };
  return [...entries].sort((left, right) => {
    const leftWarning = left.abnormal || left.medication?.missed ? 0 : 1;
    const rightWarning = right.abnormal || right.medication?.missed ? 0 : 1;
    return leftWarning - rightWarning
      || priority[left.type] - priority[right.type]
      || left.memberName.localeCompare(right.memberName, "zh-CN");
  });
}

function combineSummaries(summaries: Iterable<MutablePeriodSummary>): MutablePeriodSummary {
  const combined = emptyMutableSummary();
  for (const summary of summaries) {
    combined.incomeCents += summary.incomeCents;
    combined.expenseCents += summary.expenseCents;
    combined.incomeCount += summary.incomeCount;
    combined.expenseCount += summary.expenseCount;
    combined.glucoseMeasurements += summary.glucoseMeasurements;
    combined.glucoseAbnormalCount += summary.glucoseAbnormalCount;
    combined.exerciseMinutes += summary.exerciseMinutes;
    combined.medication.scheduled += summary.medication.scheduled;
    combined.medication.dueScheduled += summary.medication.dueScheduled;
    combined.medication.taken += summary.medication.taken;
    combined.medication.missed += summary.medication.missed;
    combined.medication.paused += summary.medication.paused;
    combined.followupCount += summary.followupCount;
    combined.scheduledFollowupCount += summary.scheduledFollowupCount;
    combined.scheduleCount += summary.scheduleCount;
    combined.anniversaryCount += summary.anniversaryCount;
    combined.glucoseReadings.push(...summary.glucoseReadings);
    combined.followups.push(...summary.followups);
  }
  return combined;
}

function finishSummary(summary: MutablePeriodSummary): CalendarPeriodSummary {
  return {
    income: centsToMoney(summary.incomeCents),
    expense: centsToMoney(summary.expenseCents),
    balance: centsToMoney(summary.incomeCents - summary.expenseCents),
    incomeCount: summary.incomeCount,
    expenseCount: summary.expenseCount,
    glucoseMeasurements: summary.glucoseMeasurements,
    glucoseAbnormalCount: summary.glucoseAbnormalCount,
    exerciseMinutes: summary.exerciseMinutes,
    medication: finishMedication(summary.medication),
    followupCount: summary.followupCount,
    scheduledFollowupCount: summary.scheduledFollowupCount,
    scheduleCount: summary.scheduleCount,
    anniversaryCount: summary.anniversaryCount
  };
}

function isDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateOnlyUtc(value);
  return dateKey(date) === value;
}

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function finishMedication(summary: MutableMedicationSummary): CalendarMedicationSummary {
  const recorded = summary.taken + summary.missed + summary.paused;
  const scheduled = Math.max(summary.scheduled, recorded);
  const due = Math.max(summary.dueScheduled, recorded);
  const denominator = Math.max(0, due - summary.paused);
  return {
    scheduled,
    taken: summary.taken,
    missed: summary.missed,
    paused: summary.paused,
    pending: Math.max(0, scheduled - recorded),
    ...(denominator > 0 ? { completionRate: Math.round(summary.taken / denominator * 100) } : {})
  };
}

function glucoseIsAbnormal(
  value: number,
  context: GlucoseContext,
  profile?: HealthProfileThresholds
): boolean {
  const status = glucoseStatus(value, context, profile);
  return status === "low" || status === "high";
}

function glucoseStatus(
  value: number,
  context: GlucoseContext,
  profile?: HealthProfileThresholds
): CalendarGlucoseStatus {
  const lowThreshold = profile ? Number(profile.glucoseLowThreshold.toString()) : 3.9;
  if (value < lowThreshold) return "low";
  const range = glucoseTargetRange(context, profile);
  if (!range || (range.min === undefined && range.max === undefined)) return "unconfigured";
  if (range.min !== undefined && value < range.min) return "low";
  if (range.max !== undefined && value > range.max) return "high";
  return "inRange";
}

function glucoseTargetRange(context: GlucoseContext, profile?: HealthProfileThresholds) {
  const targets = parseGlucoseTargets(profile?.glucoseTargets);
  if (context === "fasting") return targets.fasting;
  if (context === "beforeMeal") return targets.beforeMeal;
  if (context === "afterMeal2h") return targets.afterMeal2h;
  return undefined;
}

function parseGlucoseTargets(value: unknown): GlucoseTargets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GlucoseTargets;
}

function medicationSlots(value: Prisma.JsonValue): MedicationScheduleSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const slot = item as { id?: unknown; label?: unknown; time?: unknown };
    if (typeof slot.id !== "string" || typeof slot.label !== "string") return [];
    return [{
      id: slot.id,
      label: slot.label,
      ...(typeof slot.time === "string" ? { time: slot.time } : {})
    }];
  });
}

function validatePeriod(view: CalendarView, period: string): void {
  if (view !== "month" && view !== "year") {
    throw new BadRequestException("日历视角无效");
  }
  if (view === "month" ? !MONTH_PATTERN.test(period) : !YEAR_PATTERN.test(period)) {
    throw new BadRequestException(view === "month" ? "月份格式无效" : "年份格式无效");
  }
}

function periodRange(view: CalendarView, period: string): { start: Date; end: Date } {
  if (view === "month") {
    const start = new Date(`${period}-01T00:00:00.000+08:00`);
    return { start, end: new Date(`${shiftMonthKey(period, 1)}-01T00:00:00.000+08:00`) };
  }
  const start = new Date(`${period}-01-01T00:00:00.000+08:00`);
  return { start, end: new Date(`${Number(period) + 1}-01-01T00:00:00.000+08:00`) };
}

function expenseChangeRate(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round((current - previous) / previous * 1000) / 10;
}

function amountToCents(value: { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}

function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dateKey(date: Date): string {
  const parts = SHANGHAI_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date): string {
  return dateKey(date).slice(0, 7);
}

function shiftMonthKey(month: string, offset: number): string {
  return monthKey(shiftUtcMonth(new Date(`${month}-01T00:00:00.000Z`), offset));
}

function shiftUtcMonth(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function dateOnlyUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.valueOf() + days * 24 * 60 * 60 * 1000);
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right;
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right;
}
