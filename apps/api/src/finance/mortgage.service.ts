import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  buildFullMortgageInstallments,
  buildMortgageInstallments,
  isValidBusinessDate,
  monthlyOccurrenceDatesBetween,
  mortgageRateAt,
  previewMortgageRateAdjustment,
  type MortgageCashflow,
  type MortgageMonthlyRepayment,
  type MortgagePlanningData,
  type MortgageLoanPart,
  type MortgageProvidentFundParticipant,
  type MortgageRecord,
  type ProvidentFundAccount
} from "@family-finance/shared";
import { PrismaService } from "../prisma.service";
import { PrismaFinanceRepository } from "./prisma-finance.repository";
import type { ConfirmMortgageMonthlyRepaymentInput, CreateMortgageInput, MortgageProvidentFundParticipantInput, PreviewRateAdjustmentInput, ProvidentFundAccountInput, ProvidentFundContributionRateInput } from "./mortgage.types";

const FAMILY_ID = "default-family";
const MONTHLY_OFFSET_FORECAST_MONTHS = 60;
const mortgageLoanPartInclude = {
  rateVersions: { orderBy: { effectiveDate: "desc" as const } },
  actualRepayments: { orderBy: { sequence: "asc" as const } }
};
const mortgageInclude = {
  liability: true,
  loanParts: { include: mortgageLoanPartInclude },
  providentFundParticipants: {
    include: { account: { include: { member: true } } },
    orderBy: { priority: "asc" as const }
  }
};

@Injectable()
export class MortgageService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PrismaFinanceRepository) private readonly financeRepository: PrismaFinanceRepository
  ) {}

  async listMortgages(): Promise<MortgageRecord[]> {
    await this.financeRepository.ensureBaseData();
    await this.ensureProvidentFundParticipants();
    const mortgages = await this.prisma.mortgage.findMany({
      where: { familyId: FAMILY_ID, deletedAt: null },
      include: mortgageInclude,
      orderBy: { createdAt: "asc" }
    });
    return mortgages.map(mapMortgage);
  }

  async overview(month: string) {
    assertMonth(month);
    const mortgages = await this.listMortgages();
    const parts = mortgages.flatMap((mortgage) => mortgage.loanParts);
    const confirmed = await this.prisma.mortgageLoanPartRepayment.findMany({
      where: { monthlyRepayment: { month, mortgage: { familyId: FAMILY_ID, deletedAt: null } } },
      select: { loanPartId: true }
    });
    const confirmedPartIds = new Set(confirmed.map((item) => item.loanPartId));
    const schedules = mortgages.flatMap((mortgage) => mortgage.loanParts.map((part) => {
      const dueDate = dueDateForMonth(month, mortgage.repaymentDay);
      return { part, schedule: buildMortgageInstallments({
        outstandingPrincipal: part.outstandingPrincipal,
        annualRate: mortgageRateAt(part.rateVersions, dueDate),
        repaymentMethod: part.repaymentMethod,
        remainingPeriods: part.remainingPeriods,
        firstRepaymentDate: dueDate
      }) };
    }));
    const due = schedules.flatMap(({ part, schedule }) => schedule
      .filter((item) => item.dueDate.startsWith(month) && !confirmedPartIds.has(part.id))
      .map((item) => ({ mortgagePartId: part.id, mortgagePartName: part.name, ...item, sequence: part.totalPeriods - part.remainingPeriods + item.sequence })));
    const sum = (values: string[]) => values.reduce((total, value) => total + Number(value), 0).toFixed(2);
    const outstanding = sum(parts.map((part) => part.outstandingPrincipal));
    const remainingInterest = mortgages.reduce((mortgageTotal, mortgage) => mortgageTotal + mortgage.loanParts.reduce((partTotal, part) => {
      const firstMonth = confirmedPartIds.has(part.id) ? addMonth(month, 1) : month;
      const installments = buildFullMortgageInstallments({
        initialPrincipal: part.outstandingPrincipal,
        repaymentMethod: part.repaymentMethod,
        totalPeriods: part.remainingPeriods,
        firstRepaymentDate: dueDateForMonth(firstMonth, mortgage.repaymentDay),
        rateVersions: part.rateVersions
      });
      return partTotal + installments.reduce((interest, installment) => interest + Number(installment.interest), 0);
    }, 0), 0);
    return {
      mortgages,
      month,
      outstanding,
      remainingInterest: toMoney(remainingInterest),
      remainingTotal: toMoney(Number(outstanding) + remainingInterest),
      commercialOutstanding: sum(parts.filter((part) => part.kind === "commercial").map((part) => part.outstandingPrincipal)),
      providentFundOutstanding: sum(parts.filter((part) => part.kind === "providentFund").map((part) => part.outstandingPrincipal)),
      due,
      dueAmount: sum(due.map((item) => item.amount))
    };
  }

  async monthlyRepayments(month: string): Promise<MortgageMonthlyRepayment[]> {
    assertMonth(month);
    await this.financeRepository.ensureBaseData();
    const [mortgages, accounts, confirmed] = await Promise.all([
      this.listMortgages(),
      this.listProvidentFundAccounts(),
      this.prisma.mortgageMonthlyRepayment.findMany({
        where: { mortgage: { familyId: FAMILY_ID, deletedAt: null }, month },
        include: {
          mortgage: true,
          loanPartRepayments: { include: { loanPart: true }, orderBy: { sequence: "asc" } },
          providentFundTransactions: { include: { account: { include: { member: true } } } }
        }
      })
    ]);
    const confirmedByMortgage = new Map(confirmed.map((item) => [item.mortgageId, item]));
    const projectedBalances = new Map(accounts.filter((account) => account.isActive).map((account) => [account.id, {
      account,
      basicCents: moneyToCents(account.basicBalance),
      supplementaryCents: moneyToCents(account.supplementaryBalance),
      balanceUpdatedOn: account.balanceUpdatedOn
    }]));
    const planned = mortgages.flatMap((mortgage) => {
      if (confirmedByMortgage.has(mortgage.id)) return [];
      const dueDate = dueDateForMonth(month, mortgage.repaymentDay);
      const parts = mortgage.loanParts.flatMap((part) => {
        if (part.remainingPeriods <= 0) return [];
        const installment = buildMortgageInstallments({
          outstandingPrincipal: part.outstandingPrincipal,
          annualRate: mortgageRateAt(part.rateVersions, dueDate),
          repaymentMethod: part.repaymentMethod,
          remainingPeriods: part.remainingPeriods,
          firstRepaymentDate: dueDate
        })[0];
        return installment ? [{
          loanPartId: part.id,
          loanPartName: part.name,
          sequence: part.totalPeriods - part.remainingPeriods + 1,
          principal: installment.principal,
          interest: installment.interest,
          amount: installment.amount
        }] : [];
      });
      return parts.length ? [{ mortgage, dueDate, parts }] : [];
    }).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.mortgage.id.localeCompare(right.mortgage.id));
    const unsaved = planned.map(({ mortgage, dueDate, parts }) => {
      const totalCents = parts.reduce((total, part) => total + moneyToCents(part.amount), 0);
      const offsetPreview = allocateProjectedOffset(projectedBalances, mortgage.providentFundParticipants, dueDate, totalCents);
      return {
        mortgageId: mortgage.id,
        mortgageName: mortgage.name,
        month,
        dueDate,
        status: dueDate > shanghaiToday() ? "scheduled" as const : "pending" as const,
        totalAmount: centsToMoney(totalCents),
        providentFundOffset: centsToMoney(offsetPreview.providentFundOffsetCents),
        selfFundAmount: centsToMoney(offsetPreview.selfFundAmountCents),
        parts,
        providentFundTransactions: offsetPreview.transactions
      };
    });
    return [...confirmed.map(mapMonthlyRepayment), ...unsaved]
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.mortgageId.localeCompare(right.mortgageId));
  }

  async monthlyCashflows(month: string): Promise<MortgageCashflow[]> {
    const [mortgages, repayments] = await Promise.all([this.listMortgages(), this.monthlyRepayments(month)]);
    const liabilityIdByMortgage = new Map(mortgages.map((mortgage) => [mortgage.id, mortgage.liabilityId]));
    return repayments.flatMap((repayment) => {
      const liabilityId = liabilityIdByMortgage.get(repayment.mortgageId);
      return liabilityId ? [{
        liabilityId,
        mortgageId: repayment.mortgageId,
        mortgageName: repayment.mortgageName,
        dueDate: repayment.dueDate,
        status: repayment.status,
        totalAmount: repayment.totalAmount,
        providentFundOffset: repayment.providentFundOffset,
        selfFundAmount: repayment.selfFundAmount
      }] : [];
    });
  }

  async mortgageCashflowObligations(startDate: string, endDate: string): Promise<MortgageCashflow[]> {
    if (!isValidBusinessDate(startDate) || !isValidBusinessDate(endDate) || startDate > endDate) {
      throw new BadRequestException("房贷现金流日期范围不正确");
    }
    const startMonth = startDate.slice(0, 7);
    const [mortgages, plan, firstMonthCashflows] = await Promise.all([
      this.listMortgages(),
      this.planning(startMonth),
      this.monthlyCashflows(startMonth)
    ]);
    const mortgageById = new Map(mortgages.map((mortgage) => [mortgage.id, mortgage]));
    const projected = plan.monthlyOffset.flatMap((forecast) => forecast.repaymentEvents.flatMap((event) => {
      const mortgage = mortgageById.get(event.mortgageId);
      return mortgage ? [{
        liabilityId: mortgage.liabilityId,
        mortgageId: mortgage.id,
        mortgageName: mortgage.name,
        dueDate: event.dueDate,
        status: event.dueDate > shanghaiToday() ? "scheduled" as const : "pending" as const,
        totalAmount: event.amount,
        providentFundOffset: event.providentFundOffset,
        selfFundAmount: event.selfFundAmount
      }] : [];
    }));
    const confirmed = firstMonthCashflows.filter((cashflow) => cashflow.status === "confirmed");
    const confirmedKeys = new Set(confirmed.map((cashflow) => `${cashflow.mortgageId}:${cashflow.dueDate}`));
    return [...projected.filter((cashflow) => !confirmedKeys.has(`${cashflow.mortgageId}:${cashflow.dueDate}`)), ...confirmed]
      .filter((cashflow) => cashflow.dueDate >= startDate && cashflow.dueDate <= endDate)
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.mortgageId.localeCompare(right.mortgageId));
  }

  async confirmMonthlyRepayment(mortgageId: string, input: ConfirmMortgageMonthlyRepaymentInput): Promise<MortgageMonthlyRepayment> {
    assertMonth(input.month);
    if (!Array.isArray(input.parts) || !input.parts.length) throw new BadRequestException("请填写各贷款分段的实际本金和利息");
    if (!Array.isArray(input.providentFundTransactions)) throw new BadRequestException("请确认公积金实际缴存和月冲明细");
    await this.financeRepository.ensureBaseData();
    await this.ensureProvidentFundParticipants();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`mortgage-confirm:${FAMILY_ID}`}))`);
      const existing = await tx.mortgageMonthlyRepayment.findUnique({
        where: { mortgageId_month: { mortgageId, month: input.month } },
        include: { mortgage: true, loanPartRepayments: { include: { loanPart: true }, orderBy: { sequence: "asc" } }, providentFundTransactions: { include: { account: { include: { member: true } } } } }
      });
      if (existing) return mapMonthlyRepayment(existing);
      const mortgage = await tx.mortgage.findFirst({ where: { id: mortgageId, familyId: FAMILY_ID, deletedAt: null }, include: mortgageInclude });
      if (!mortgage) throw new NotFoundException("房贷不存在");
      const activeParts = mortgage.loanParts.filter((part) => part.remainingPeriods > 0 && Number(part.outstandingPrincipal) > 0);
      const actualByPart = new Map(input.parts.map((part) => [part.loanPartId, part]));
      if (actualByPart.size !== input.parts.length || actualByPart.size !== activeParts.length || activeParts.some((part) => !actualByPart.has(part.id))) throw new BadRequestException("需同时确认本期全部贷款分段，且不能包含重复项");
      const scheduledDueDate = dueDateForMonth(input.month, mortgage.repaymentDay);
      const dueDate = input.dueDate ?? scheduledDueDate;
      if (!dueDate.startsWith(`${input.month}-`)) throw new BadRequestException("还款日期必须属于所选月份");
      date(dueDate, "还款日期");
      if (dueDate > shanghaiToday()) throw new BadRequestException("还款日尚未到达，暂不能确认实际还款");
      const latestConfirmed = await tx.mortgageMonthlyRepayment.findFirst({ where: { mortgageId }, orderBy: { dueDate: "desc" } });
      if (latestConfirmed && day(latestConfirmed.dueDate) >= dueDate) throw new BadRequestException("只能按还款日期正序确认，不能补录到已确认月份之前");
      const laterSharedFundConfirmation = await tx.mortgageMonthlyRepayment.findFirst({
        where: { dueDate: { gt: date(dueDate, "还款日期") }, mortgage: { familyId: FAMILY_ID, deletedAt: null } },
        select: { dueDate: true, mortgage: { select: { name: true } } },
        orderBy: { dueDate: "asc" }
      });
      if (laterSharedFundConfirmation) throw new BadRequestException(`已有更晚的 ${day(laterSharedFundConfirmation.dueDate)} ${laterSharedFundConfirmation.mortgage.name} 还款记录；共享公积金账户必须按日期正序确认`);
      const partRepayments = activeParts.map((part) => {
        const latestPartRepayment = part.actualRepayments.at(-1);
        if (latestPartRepayment && day(latestPartRepayment.dueDate) >= dueDate) throw new BadRequestException(`${part.name} 只能按期数正序确认`);
        const expected = buildMortgageInstallments({ outstandingPrincipal: money(part.outstandingPrincipal), annualRate: mortgageRateAt(mapPart(part).rateVersions, scheduledDueDate), repaymentMethod: part.repaymentMethod, remainingPeriods: part.remainingPeriods, firstRepaymentDate: scheduledDueDate })[0];
        if (!expected) throw new BadRequestException(`${part.name} 已无待还期数`);
        const actual = actualByPart.get(part.id)!;
        const principalCents = moneyInputToCents(actual.principal, `${part.name}本金`);
        const interestCents = moneyInputToCents(actual.interest, `${part.name}利息`);
        if (principalCents <= 0) throw new BadRequestException(`${part.name}实际归还本金必须大于 0`);
        if (principalCents > decimalToCents(part.outstandingPrincipal)) throw new BadRequestException(`${part.name}本金不能大于剩余本金`);
        return { part, principalCents, interestCents, amountCents: principalCents + interestCents, sequence: part.totalPeriods - part.remainingPeriods + 1 };
      });
      const participants = mortgage.providentFundParticipants.filter((participant) => participant.isActive && participant.account.isActive);
      const participantIds = participants.map((participant) => participant.accountId).sort();
      if (participantIds.length) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ProvidentFundAccount" WHERE "id" IN (${Prisma.join(participantIds)}) ORDER BY "id" FOR UPDATE`);
      const actualFundByAccount = new Map(input.providentFundTransactions.map((item) => [item.accountId, item]));
      if (actualFundByAccount.size !== input.providentFundTransactions.length || actualFundByAccount.size !== participants.length || participants.some((participant) => !actualFundByAccount.has(participant.accountId))) {
        throw new BadRequestException("公积金实还明细必须与本房贷的启用参还人一致，且不能重复");
      }
      let totalOffsetCents = 0;
      const accountUpdates = participants.map((participant) => {
        const actual = actualFundByAccount.get(participant.accountId)!;
        const basicContributionCents = moneyInputToCents(actual.basicContribution, `${participant.account.member.name}基本缴存`);
        const supplementaryContributionCents = moneyInputToCents(actual.supplementaryContribution, `${participant.account.member.name}补充缴存`);
        const basicOffsetCents = moneyInputToCents(actual.basicOffset, `${participant.account.member.name}基本月冲`);
        const supplementaryOffsetCents = moneyInputToCents(actual.supplementaryOffset, `${participant.account.member.name}补充月冲`);
        const basicAvailableCents = decimalToCents(participant.account.basicBalance) + basicContributionCents;
        const supplementaryAvailableCents = decimalToCents(participant.account.supplementaryBalance) + supplementaryContributionCents;
        if (basicOffsetCents > Math.max(0, basicAvailableCents - 1) || supplementaryOffsetCents > Math.max(0, supplementaryAvailableCents - 1)) throw new BadRequestException(`${participant.account.member.name}月冲金额超过可用余额`);
        totalOffsetCents += basicOffsetCents + supplementaryOffsetCents;
        return {
          account: participant.account,
          basicContributionCents,
          supplementaryContributionCents,
          basicOffsetCents,
          supplementaryOffsetCents,
          basicBalanceCents: basicAvailableCents - basicOffsetCents,
          supplementaryBalanceCents: supplementaryAvailableCents - supplementaryOffsetCents
        };
      });
      const totalCents = partRepayments.reduce((total, item) => total + item.amountCents, 0);
      if (totalOffsetCents > totalCents) throw new BadRequestException("公积金月冲总额不能大于实际还款总额");
      const selfFundCents = totalCents - totalOffsetCents;
      let bankAccount: { id: string } | null = null;
      if (selfFundCents > 0) {
        if (!input.bankAccountId) throw new BadRequestException("存在银行卡补款时必须选择实际扣款账户");
        bankAccount = await tx.account.findFirst({ where: { id: input.bankAccountId, familyId: FAMILY_ID, deletedAt: null }, select: { id: true } });
        if (!bankAccount) throw new BadRequestException("银行卡扣款账户不存在");
      }
      const monthlyRepayment = await tx.mortgageMonthlyRepayment.create({ data: { mortgageId, month: input.month, dueDate: date(dueDate, "还款日期"), totalAmount: centsToMoney(totalCents), providentFundOffset: centsToMoney(totalOffsetCents), selfFundAmount: centsToMoney(selfFundCents), note: optionalText(input.note) } });
      await Promise.all(partRepayments.map(({ part, principalCents, interestCents, sequence }) => tx.mortgageLoanPartRepayment.create({ data: { loanPartId: part.id, monthlyRepaymentId: monthlyRepayment.id, sequence, dueDate: date(dueDate, "还款日期"), principal: centsToMoney(principalCents), interest: centsToMoney(interestCents), source: "manual", note: optionalText(input.note) } })));
      await Promise.all(partRepayments.map(({ part, principalCents }) => tx.mortgageLoanPart.update({ where: { id: part.id }, data: { outstandingPrincipal: centsToMoney(Math.max(0, decimalToCents(part.outstandingPrincipal) - principalCents)), remainingPeriods: Math.max(0, part.remainingPeriods - 1) } })));
      await Promise.all(accountUpdates.flatMap(({ account, basicBalanceCents, supplementaryBalanceCents, basicContributionCents, supplementaryContributionCents, basicOffsetCents, supplementaryOffsetCents }) => [
        tx.providentFundAccount.update({ where: { id: account.id }, data: { basicBalance: centsToMoney(basicBalanceCents), supplementaryBalance: centsToMoney(supplementaryBalanceCents), balanceUpdatedOn: date(dueDate, "还款日期") } }),
        tx.providentFundAccountTransaction.create({ data: { accountId: account.id, mortgageMonthlyRepaymentId: monthlyRepayment.id, month: input.month, date: date(dueDate, "还款日期"), type: "monthlyContribution", basicAmount: centsToMoney(basicContributionCents), supplementaryAmount: centsToMoney(supplementaryContributionCents), note: "实际缴存（含余额更新日后至还款日）" } }),
        tx.providentFundAccountTransaction.create({ data: { accountId: account.id, mortgageMonthlyRepaymentId: monthlyRepayment.id, month: input.month, date: date(dueDate, "还款日期"), type: "monthlyOffset", basicAmount: centsToMoney(basicOffsetCents), supplementaryAmount: centsToMoney(supplementaryOffsetCents), note: "上海月冲实际扣款" } })
      ]));
      const outstandingCents = partRepayments.reduce((total, { part, principalCents }) => total + Math.max(0, decimalToCents(part.outstandingPrincipal) - principalCents), 0);
      const remainingPeriods = Math.max(0, ...partRepayments.map(({ part }) => part.remainingPeriods - 1));
      const status = outstandingCents <= 0 ? "paidOff" : "active";
      await tx.liability.update({ where: { id: mortgage.liabilityId }, data: { currentBalance: centsToMoney(outstandingCents), remainingPeriods, status } });
      await tx.liabilitySnapshot.upsert({
        where: { liabilityId_month: { liabilityId: mortgage.liabilityId, month: input.month } },
        create: { familyId: FAMILY_ID, liabilityId: mortgage.liabilityId, month: input.month, currentBalance: centsToMoney(outstandingCents), monthlyPayment: centsToMoney(totalCents), paymentDay: mortgage.repaymentDay, repaymentSchedule: "monthly", remainingPeriods, status, confirmedAt: new Date() },
        update: { currentBalance: centsToMoney(outstandingCents), monthlyPayment: centsToMoney(totalCents), paymentDay: mortgage.repaymentDay, repaymentSchedule: "monthly", remainingPeriods, status, confirmedAt: new Date() }
      });
      const principalTotalCents = partRepayments.reduce((total, item) => total + item.principalCents, 0);
      await tx.liabilityRepayment.create({ data: { familyId: FAMILY_ID, liabilityId: mortgage.liabilityId, date: date(dueDate, "还款日期"), amount: centsToMoney(principalTotalCents), note: optionalText(input.note) ?? `房贷 ${input.month} 实际归还本金`, appliedToLive: true } });
      if (bankAccount) await tx.financeTransaction.create({ data: { familyId: FAMILY_ID, accountId: bankAccount.id, date: date(dueDate, "还款日期"), kind: "transfer", categoryName: "房贷还款", memberName: mortgage.liability.ownerName, amount: centsToMoney(selfFundCents), note: optionalText(input.note) ?? `${mortgage.name} ${input.month} 银行卡补款`, source: "manual", sourceRecordKey: `mortgage:${monthlyRepayment.id}:bank`, confirmedAt: new Date() } });
      return {
        id: monthlyRepayment.id, mortgageId, mortgageName: mortgage.name, month: input.month, dueDate, status: "confirmed",
        totalAmount: centsToMoney(totalCents), providentFundOffset: centsToMoney(totalOffsetCents), selfFundAmount: centsToMoney(selfFundCents), note: monthlyRepayment.note ?? undefined, confirmedAt: monthlyRepayment.confirmedAt.toISOString(),
        parts: partRepayments.map(({ part, principalCents, interestCents, amountCents, sequence }) => ({ loanPartId: part.id, loanPartName: part.name, sequence, principal: centsToMoney(principalCents), interest: centsToMoney(interestCents), amount: centsToMoney(amountCents) })),
        providentFundTransactions: accountUpdates.map(({ account, basicContributionCents, supplementaryContributionCents, basicOffsetCents, supplementaryOffsetCents }) => ({ accountId: account.id, memberName: account.member.name, basicContribution: centsToMoney(basicContributionCents), supplementaryContribution: centsToMoney(supplementaryContributionCents), basicOffset: centsToMoney(basicOffsetCents), supplementaryOffset: centsToMoney(supplementaryOffsetCents) }))
      };
    });
  }

  async planning(startMonth: string): Promise<MortgagePlanningData> {
    assertMonth(startMonth);
    const [mortgages, accounts] = await Promise.all([this.listMortgages(), this.listProvidentFundAccounts()]);
    const confirmedForStartMonth = await this.prisma.mortgageMonthlyRepayment.findMany({
      where: { month: startMonth, mortgage: { familyId: FAMILY_ID, deletedAt: null } },
      select: { mortgageId: true }
    });
    const confirmedMortgageIds = new Set(confirmedForStartMonth.map((item) => item.mortgageId));
    const activeAccounts = accounts.filter((account) => account.isActive);
    const balances = new Map(activeAccounts.map((account) => [account.id, {
      account,
      basicCents: moneyToCents(account.basicBalance),
      supplementaryCents: moneyToCents(account.supplementaryBalance),
      balanceUpdatedOn: account.balanceUpdatedOn
    }]));
    const mortgageSchedules = mortgages.map((mortgage) => {
      const firstMonth = confirmedMortgageIds.has(mortgage.id) ? addMonth(startMonth, 1) : startMonth;
      const firstDueDate = dueDateForMonth(firstMonth, mortgage.repaymentDay);
      const partSchedules = mortgage.loanParts.map((part) => ({
        part,
        installments: buildFullMortgageInstallments({
          initialPrincipal: part.outstandingPrincipal,
          repaymentMethod: part.repaymentMethod,
          totalPeriods: part.remainingPeriods,
          firstRepaymentDate: firstDueDate,
          rateVersions: part.rateVersions
        })
      }));
      return { mortgage, firstMonth, partSchedules };
    });
    const forecastHorizonMonths = Math.max(MONTHLY_OFFSET_FORECAST_MONTHS, 0, ...mortgageSchedules.flatMap(({ firstMonth, partSchedules }) => partSchedules.map(({ part }) => part.remainingPeriods + monthDifference(startMonth, firstMonth))));
    const fullMonthlyOffset = Array.from({ length: forecastHorizonMonths }, (_, offset) => {
      const month = addMonth(startMonth, offset);
      const events = mortgageSchedules.flatMap(({ mortgage, firstMonth, partSchedules }) => {
        const scheduleIndex = monthDifference(firstMonth, month);
        if (scheduleIndex < 0) return [];
        const amountCents = partSchedules.reduce((total, { installments }) => total + moneyToCents(installments[scheduleIndex]?.amount ?? "0.00"), 0);
        return amountCents > 0 ? [{ mortgage, dueDate: dueDateForMonth(month, mortgage.repaymentDay), amountCents }] : [];
      }).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.mortgage.id.localeCompare(right.mortgage.id));
      const allocations = events.map((event) => ({
        event,
        allocation: allocateProjectedOffset(balances, event.mortgage.providentFundParticipants, event.dueDate, event.amountCents)
      }));
      const dueAmountCents = allocations.reduce((total, { event }) => total + event.amountCents, 0);
      const providentFundOffsetCents = allocations.reduce((total, { allocation }) => total + allocation.providentFundOffsetCents, 0);
      const selfFundAmountCents = allocations.reduce((total, { allocation }) => total + allocation.selfFundAmountCents, 0);
      return {
        month,
        repaymentEvents: allocations.map(({ event, allocation }) => ({
          mortgageId: event.mortgage.id,
          dueDate: event.dueDate,
          amount: centsToMoney(event.amountCents),
          providentFundOffset: centsToMoney(allocation.providentFundOffsetCents),
          selfFundAmount: centsToMoney(allocation.selfFundAmountCents)
        })),
        dueAmount: centsToMoney(dueAmountCents),
        providentFundOffset: centsToMoney(providentFundOffsetCents),
        selfFundAmount: centsToMoney(selfFundAmountCents),
        participantBalances: [...balances.values()].map((balance) => ({ memberName: balance.account.memberName, basicBalance: centsToMoney(balance.basicCents), supplementaryBalance: centsToMoney(balance.supplementaryCents) }))
      };
    });
    const monthlyOffset = fullMonthlyOffset.slice(0, MONTHLY_OFFSET_FORECAST_MONTHS);
    const firstSelfFundMonth = fullMonthlyOffset.find((item) => Number(item.dueAmount) > 0 && Number(item.selfFundAmount) > 0)?.month;
    const finalPaymentMonth = [...fullMonthlyOffset].reverse().find((item) => Number(item.dueAmount) > 0)?.month ?? startMonth;
    const rateReminders = mortgages.flatMap((mortgage) => mortgage.loanParts.flatMap((part) => !part.repricingDate ? [] : [{
      mortgageName: mortgage.name,
      loanPartName: part.name,
      repricingDate: part.repricingDate,
      daysUntil: Math.round((date(part.repricingDate, "重定价日期").getTime() - date(`${startMonth}-01`, "预测月份").getTime()) / 86_400_000)
    }]));
    const baseline = remainingSummary(mortgages);
    const annualOffsetAmount = activeAccounts.reduce((total, account) => total + Math.max(0, Number(account.basicBalance) - 0.01) + Math.max(0, Number(account.supplementaryBalance) - 0.01), 0);
    const annualSummary = summaryAfterPrepayment(mortgages, annualOffsetAmount, "providentFund");
    const commercialSummary = summaryAfterPrepayment(mortgages, annualOffsetAmount, "commercial");
    return {
      monthlyOffset,
      monthlyOffsetCoverage: firstSelfFundMonth
        ? { fullOffsetThrough: addMonth(firstSelfFundMonth, -1), firstSelfFundMonth, endsBecause: "insufficient" }
        : { fullOffsetThrough: finalPaymentMonth, endsBecause: "loanPaidOff" },
      rateReminders,
      strategies: [
        { name: "维持月冲", oneOffAmount: "0.00", estimatedMonthlyPayment: toMoney(baseline.monthlyPayment), remainingInterest: toMoney(baseline.interest), interestSaved: "0.00", note: "按已登记的当前及未来生效利率预测" },
        { name: "公积金年冲", oneOffAmount: toMoney(annualOffsetAmount), estimatedMonthlyPayment: toMoney(annualSummary.monthlyPayment), remainingInterest: toMoney(annualSummary.interest), interestSaved: toMoney(baseline.interest - annualSummary.interest), note: "可用公积金余额优先冲还公积金贷款；年冲批次以实际办理结果为准" },
        { name: "等额现金提前还商业贷", oneOffAmount: toMoney(annualOffsetAmount), estimatedMonthlyPayment: toMoney(commercialSummary.monthlyPayment), remainingInterest: toMoney(commercialSummary.interest), interestSaved: toMoney(baseline.interest - commercialSummary.interest), note: "以与年冲相同金额模拟现金提前还商业贷" }
      ]
    };
  }

  async createMortgage(input: CreateMortgageInput): Promise<MortgageRecord> {
    await this.financeRepository.ensureBaseData();
    validateMortgage(input);
    const mortgage = await this.prisma.$transaction(async (tx) => {
      const initialBalance = input.parts.reduce((total, part) => total + numberMoney(part.initialPrincipal, "初始本金"), 0);
      const outstanding = input.parts.reduce((total, part) => total + numberMoney(part.outstandingPrincipal ?? part.initialPrincipal, "剩余本金"), 0);
      const firstPayments = input.parts.map((part) => buildMortgageInstallments({
        outstandingPrincipal: part.outstandingPrincipal ?? part.initialPrincipal,
        annualRate: part.annualRate,
        repaymentMethod: part.repaymentMethod,
        remainingPeriods: part.remainingPeriods ?? part.totalPeriods,
        firstRepaymentDate: part.firstRepaymentDate
      })[0]?.amount ?? "0.00");
      const liability = await tx.liability.create({
        data: {
          familyId: FAMILY_ID,
          name: input.name.trim(),
          type: "mortgage",
          ownerName: input.ownerName.trim(),
          initialBalance,
          currentBalance: outstanding,
          monthlyPayment: firstPayments.reduce((total, value) => total + Number(value), 0),
          paymentDay: input.repaymentDay,
          repaymentSchedule: "monthly",
          remainingPeriods: Math.max(...input.parts.map((part) => part.remainingPeriods ?? part.totalPeriods)),
          lender: optionalText(input.lender),
          note: optionalText(input.note)
        }
      });
      const fundAccounts = (await tx.providentFundAccount.findMany({ where: { familyId: FAMILY_ID, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, member: { select: { name: true } } } }))
        .sort((left, right) => Number(right.member.name === input.ownerName.trim()) - Number(left.member.name === input.ownerName.trim()));
      return tx.mortgage.create({
        data: {
          familyId: FAMILY_ID,
          liabilityId: liability.id,
          name: input.name.trim(),
          lender: optionalText(input.lender),
          repaymentDay: input.repaymentDay,
          note: optionalText(input.note),
          loanParts: {
            create: input.parts.map((part) => ({
              kind: part.kind,
              name: part.name.trim(),
              initialPrincipal: numberMoney(part.initialPrincipal, "初始本金"),
              outstandingPrincipal: numberMoney(part.outstandingPrincipal ?? part.initialPrincipal, "剩余本金"),
              rateType: part.rateType,
              occupancyType: part.occupancyType,
              lprSpread: part.lprSpread === undefined ? undefined : numberMoney(part.lprSpread, "LPR 加点"),
              repricingCycleMonths: part.repricingCycleMonths,
              repricingDate: optionalDate(part.repricingDate),
              repaymentMethod: part.repaymentMethod,
              firstRepaymentDate: date(part.firstRepaymentDate, "首期还款日"),
              totalPeriods: part.totalPeriods,
              remainingPeriods: part.remainingPeriods ?? part.totalPeriods,
              rateVersions: { create: { annualRate: numberMoney(part.annualRate, "年利率"), effectiveDate: date(part.firstRepaymentDate, "利率生效日"), source: "contract" } }
            }))
          },
          providentFundParticipants: {
            create: fundAccounts.map((account, priority) => ({ accountId: account.id, priority, role: participantRoleForPriority(priority) }))
          }
        },
        include: mortgageInclude
      });
    });
    return mapMortgage(mortgage);
  }

  async listProvidentFundAccounts(): Promise<ProvidentFundAccount[]> {
    await this.financeRepository.ensureBaseData();
    const accounts = await this.prisma.providentFundAccount.findMany({
      where: { familyId: FAMILY_ID }, include: providentFundInclude, orderBy: { createdAt: "asc" }
    });
    return accounts.map(mapProvidentFundAccount);
  }

  async saveProvidentFundAccount(input: ProvidentFundAccountInput): Promise<ProvidentFundAccount> {
    await this.financeRepository.ensureBaseData();
    const member = await this.prisma.familyMember.findFirst({ where: { id: input.memberId, familyId: FAMILY_ID } });
    if (!member) throw new BadRequestException("公积金成员不存在");
    const account = await this.prisma.providentFundAccount.upsert({
      where: { familyId_memberId: { familyId: FAMILY_ID, memberId: input.memberId } },
      create: providentFundData(input, member.id),
      update: providentFundData(input, member.id),
      include: providentFundInclude
    });
    await this.ensureProvidentFundParticipants();
    await this.saveContributionRate(account.id, {
      effectiveMonth: day(account.balanceUpdatedOn).slice(0, 7),
      basicMonthlyContribution: money(account.basicMonthlyContribution ?? { toString: () => "0" }),
      supplementaryMonthlyContribution: money(account.supplementaryMonthlyContribution ?? { toString: () => "0" }),
      source: "manualCorrection",
      note: "由账户维护同步"
    }, true);
    return this.getProvidentFundAccount(account.id);
  }

  async saveContributionRate(accountId: string, input: ProvidentFundContributionRateInput, onlyWhenMissing = false): Promise<ProvidentFundAccount> {
    await this.financeRepository.ensureBaseData();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.effectiveMonth)) throw new BadRequestException("生效月份格式应为 YYYY-MM");
    const basic = numberMoney(input.basicMonthlyContribution, "基本月缴存额");
    const supplementary = numberMoney(input.supplementaryMonthlyContribution, "补充月缴存额");
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.providentFundAccount.findFirst({ where: { id: accountId, familyId: FAMILY_ID } });
      if (!account) throw new NotFoundException("公积金账户不存在");
      const existing = await tx.providentFundContributionRate.findUnique({ where: { accountId_effectiveMonth: { accountId, effectiveMonth: input.effectiveMonth } } });
      if (!onlyWhenMissing || !existing) await tx.providentFundContributionRate.upsert({
        where: { accountId_effectiveMonth: { accountId, effectiveMonth: input.effectiveMonth } },
        create: { accountId, effectiveMonth: input.effectiveMonth, basicMonthlyContribution: basic, supplementaryMonthlyContribution: supplementary, source: input.source ?? "annualAdjustment", note: optionalText(input.note) },
        update: { basicMonthlyContribution: basic, supplementaryMonthlyContribution: supplementary, source: input.source ?? "annualAdjustment", note: optionalText(input.note) }
      });
      const latest = await tx.providentFundContributionRate.findFirst({ where: { accountId }, orderBy: { effectiveMonth: "desc" } });
      await tx.providentFundAccount.update({ where: { id: accountId }, data: { basicMonthlyContribution: latest?.basicMonthlyContribution, supplementaryMonthlyContribution: latest?.supplementaryMonthlyContribution } });
    });
    return this.getProvidentFundAccount(accountId);
  }

  async previewRateAdjustment(id: string, input: PreviewRateAdjustmentInput) {
    const adjustedRate = rateInput(input.annualRate, "年利率");
    date(input.effectiveDate, "利率生效日");
    const part = await this.prisma.mortgageLoanPart.findFirst({
      where: { id: input.loanPartId, mortgage: { id, familyId: FAMILY_ID, deletedAt: null } },
      include: mortgageLoanPartInclude
    });
    if (!part) throw new NotFoundException("贷款分段不存在");
    const mapped = mapPart(part);
    const currentAnnualRate = mortgageRateAt(mapped.rateVersions, input.effectiveDate);
    const preview = previewMortgageRateAdjustment({
      outstandingPrincipal: mapped.outstandingPrincipal,
      currentAnnualRate,
      adjustedAnnualRate: adjustedRate,
      repaymentMethod: mapped.repaymentMethod,
      remainingPeriods: mapped.remainingPeriods
    });
    return { loanPartId: mapped.id, oldAnnualRate: currentAnnualRate, newAnnualRate: Number(adjustedRate).toFixed(4), effectiveDate: input.effectiveDate, ...preview };
  }

  async applyRateAdjustment(id: string, input: PreviewRateAdjustmentInput): Promise<MortgageRecord> {
    await this.previewRateAdjustment(id, input);
    await this.prisma.$transaction(async (tx) => {
      await tx.mortgageLoanRateVersion.upsert({
        where: { loanPartId_effectiveDate: { loanPartId: input.loanPartId, effectiveDate: date(input.effectiveDate, "利率生效日") } },
        create: rateVersionData(input),
        update: rateVersionData(input)
      });
      const mortgage = await tx.mortgage.findFirst({ where: { id, familyId: FAMILY_ID, deletedAt: null }, include: mortgageInclude });
      if (!mortgage) throw new NotFoundException("房贷不存在");
      const mapped = mapMortgage(mortgage);
      const paymentMonth = shanghaiToday().slice(0, 7);
      const paymentDate = dueDateForMonth(paymentMonth, mortgage.repaymentDay);
      const monthlyPayment = mapped.loanParts.reduce((total, part) => total + Number(buildMortgageInstallments({
        outstandingPrincipal: part.outstandingPrincipal, annualRate: mortgageRateAt(part.rateVersions, paymentDate),
        repaymentMethod: part.repaymentMethod, remainingPeriods: part.remainingPeriods, firstRepaymentDate: paymentDate
      })[0]?.amount ?? "0"), 0);
      await tx.liability.update({ where: { id: mortgage.liabilityId }, data: { monthlyPayment } });
    });
    return this.getMortgage(id);
  }

  async saveProvidentFundParticipants(id: string, input: MortgageProvidentFundParticipantInput): Promise<MortgageRecord> {
    if (!Array.isArray(input.participants) || !input.participants.length || !input.participants.some((item) => item.isActive ?? true)) throw new BadRequestException("至少启用一位参还人");
    const accountIds = new Set(input.participants.map((item) => item.accountId));
    const priorities = new Set(input.participants.map((item) => item.priority));
    if (accountIds.size !== input.participants.length || priorities.size !== input.participants.length) throw new BadRequestException("参还人或扣款顺序不能重复");
    if (input.participants.some((item) => !Number.isInteger(item.priority) || item.priority < 0 || !["borrower", "spouse", "parentChild"].includes(item.role))) throw new BadRequestException("参还人设置格式不正确");
    await this.prisma.$transaction(async (tx) => {
      const mortgage = await tx.mortgage.findFirst({ where: { id, familyId: FAMILY_ID, deletedAt: null }, select: { id: true } });
      if (!mortgage) throw new NotFoundException("房贷不存在");
      const allAccounts = await tx.providentFundAccount.findMany({ where: { familyId: FAMILY_ID }, select: { id: true } });
      if (allAccounts.length !== accountIds.size || allAccounts.some((account) => !accountIds.has(account.id))) throw new BadRequestException("必须为全部公积金账户明确设置是否参与月冲");
      await tx.mortgageProvidentFundParticipant.deleteMany({ where: { mortgageId: id } });
      await tx.mortgageProvidentFundParticipant.createMany({ data: input.participants.map((item) => ({ mortgageId: id, accountId: item.accountId, role: item.role, priority: item.priority, isActive: item.isActive ?? true })) });
    });
    return this.getMortgage(id);
  }

  private async ensureProvidentFundParticipants(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`mortgage-participants:${FAMILY_ID}`}))`);
      const [mortgages, accounts, existing] = await Promise.all([
        tx.mortgage.findMany({ where: { familyId: FAMILY_ID, deletedAt: null }, select: { id: true, liability: { select: { ownerName: true } } } }),
        tx.providentFundAccount.findMany({ where: { familyId: FAMILY_ID }, orderBy: { createdAt: "asc" }, select: { id: true, member: { select: { name: true } } } }),
        tx.mortgageProvidentFundParticipant.findMany({ where: { mortgage: { familyId: FAMILY_ID, deletedAt: null } }, select: { mortgageId: true, accountId: true, priority: true } })
      ]);
      const existingKeys = new Set(existing.map((item) => `${item.mortgageId}:${item.accountId}`));
      const missing = mortgages.flatMap((mortgage) => {
        let priority = Math.max(-1, ...existing.filter((item) => item.mortgageId === mortgage.id).map((item) => item.priority)) + 1;
        return [...accounts]
          .sort((left, right) => Number(right.member.name === mortgage.liability.ownerName) - Number(left.member.name === mortgage.liability.ownerName))
          .flatMap((account) => {
            if (existingKeys.has(`${mortgage.id}:${account.id}`)) return [];
            const item = { mortgageId: mortgage.id, accountId: account.id, priority, role: participantRoleForPriority(priority) };
            priority += 1;
            return [item];
          });
      });
      if (missing.length) await tx.mortgageProvidentFundParticipant.createMany({ data: missing, skipDuplicates: true });
    });
  }

  private async getMortgage(id: string): Promise<MortgageRecord> {
    const mortgage = await this.prisma.mortgage.findFirst({
      where: { id, familyId: FAMILY_ID, deletedAt: null }, include: mortgageInclude
    });
    if (!mortgage) throw new NotFoundException("房贷不存在");
    return mapMortgage(mortgage);
  }

  private async getProvidentFundAccount(id: string): Promise<ProvidentFundAccount> {
    const account = await this.prisma.providentFundAccount.findFirst({ where: { id, familyId: FAMILY_ID }, include: providentFundInclude });
    if (!account) throw new NotFoundException("公积金账户不存在");
    return mapProvidentFundAccount(account);
  }
}

function validateMortgage(input: CreateMortgageInput): void {
  if (!input.name?.trim() || !input.ownerName?.trim()) throw new BadRequestException("请填写房贷名称和归属成员");
  if (!Number.isInteger(input.repaymentDay) || input.repaymentDay < 1 || input.repaymentDay > 31) throw new BadRequestException("还款日应为 1 至 31");
  if (!Array.isArray(input.parts) || input.parts.length < 1 || input.parts.length > 3) throw new BadRequestException("房贷应包含 1 至 3 个贷款分段");
  for (const part of input.parts) {
    const remainingPeriods = part.remainingPeriods ?? part.totalPeriods;
    if (!part.name?.trim() || !Number.isInteger(part.totalPeriods) || !Number.isInteger(remainingPeriods) || part.totalPeriods < 1 || part.totalPeriods > 600 || remainingPeriods < 1 || remainingPeriods > part.totalPeriods) throw new BadRequestException("贷款期数必须为 1 至 600 的整数，且剩余期数不能超过总期数");
    if (!["commercial", "providentFund"].includes(part.kind) || !["fixed", "lprFloating", "providentFundPolicy"].includes(part.rateType) || !["equalPrincipalAndInterest", "equalPrincipal"].includes(part.repaymentMethod)) throw new BadRequestException("贷款分段类型不正确");
    const initialPrincipal = positiveMoney(part.initialPrincipal, "初始本金");
    const outstandingPrincipal = positiveMoney(part.outstandingPrincipal ?? part.initialPrincipal, "剩余本金");
    if (outstandingPrincipal > initialPrincipal) throw new BadRequestException("剩余本金不能大于初始本金");
    rateInput(part.annualRate, "年利率");
    date(part.firstRepaymentDate, "首期还款日");
  }
}

function providentFundData(input: ProvidentFundAccountInput, memberId: string) {
  const monthlyContributionDay = input.monthlyContributionDay ?? 11;
  if (!Number.isInteger(monthlyContributionDay) || monthlyContributionDay < 1 || monthlyContributionDay > 31) throw new BadRequestException("每月缴存日应为 1 至 31");
  return {
    familyId: FAMILY_ID, memberId, basicBalance: numberMoney(input.basicBalance, "基本公积金余额"), supplementaryBalance: numberMoney(input.supplementaryBalance, "补充公积金余额"),
    basicMonthlyContribution: input.basicMonthlyContribution == null ? null : numberMoney(input.basicMonthlyContribution, "基本月缴存额"),
    supplementaryMonthlyContribution: input.supplementaryMonthlyContribution == null ? null : numberMoney(input.supplementaryMonthlyContribution, "补充月缴存额"),
    monthlyContributionDay,
    balanceUpdatedOn: date(input.balanceUpdatedOn, "余额更新日期"), isActive: input.isActive ?? true, note: optionalText(input.note)
  };
}

function mapMortgage(row: Prisma.MortgageGetPayload<{ include: typeof mortgageInclude }>): MortgageRecord {
  return {
    id: row.id,
    liabilityId: row.liabilityId,
    name: row.name,
    lender: row.lender ?? undefined,
    repaymentDay: row.repaymentDay,
    note: row.note ?? undefined,
    loanParts: row.loanParts.map(mapPart),
    providentFundParticipants: row.providentFundParticipants.map((participant) => ({ accountId: participant.accountId, memberName: participant.account.member.name, role: participant.role, priority: participant.priority, isActive: participant.isActive }))
  };
}

function mapPart(row: Prisma.MortgageLoanPartGetPayload<{ include: typeof mortgageLoanPartInclude }>): MortgageLoanPart {
  return { id: row.id, kind: row.kind, name: row.name, initialPrincipal: money(row.initialPrincipal), outstandingPrincipal: money(row.outstandingPrincipal), rateType: row.rateType, occupancyType: row.occupancyType === "first" || row.occupancyType === "second" ? row.occupancyType : undefined, lprSpread: row.lprSpread == null ? undefined : money(row.lprSpread), repricingCycleMonths: row.repricingCycleMonths ?? undefined, repricingDate: row.repricingDate ? day(row.repricingDate) : undefined, repaymentMethod: row.repaymentMethod, firstRepaymentDate: day(row.firstRepaymentDate), totalPeriods: row.totalPeriods, remainingPeriods: row.remainingPeriods, rateVersions: row.rateVersions.map((rate) => ({ id: rate.id, annualRate: money(rate.annualRate), effectiveDate: day(rate.effectiveDate), source: rate.source, lprValue: rate.lprValue == null ? undefined : money(rate.lprValue), lprPublishedMonth: rate.lprPublishedMonth ?? undefined, policyVersion: rate.policyVersion ?? undefined, evidenceNote: rate.evidenceNote ?? undefined })), actualRepayments: row.actualRepayments.map((repayment) => ({ id: repayment.id, sequence: repayment.sequence, dueDate: day(repayment.dueDate), principal: money(repayment.principal), interest: money(repayment.interest), source: repayment.source, note: repayment.note ?? undefined })) };
}

function mapMonthlyRepayment(row: {
  id: string;
  mortgageId: string;
  month: string;
  dueDate: Date;
  totalAmount: { toString(): string };
  providentFundOffset: { toString(): string };
  selfFundAmount: { toString(): string };
  note: string | null;
  confirmedAt: Date;
  mortgage: { name: string };
  loanPartRepayments: Array<{ loanPartId: string; sequence: number; principal: { toString(): string }; interest: { toString(): string }; loanPart: { name: string } }>;
  providentFundTransactions: Array<{ type: "monthlyContribution" | "monthlyOffset"; basicAmount: { toString(): string }; supplementaryAmount: { toString(): string }; account: { id: string; member: { name: string } } }>;
}): MortgageMonthlyRepayment {
  const transactions = new Map<string, { accountId: string; memberName: string; basicContribution: number; supplementaryContribution: number; basicOffset: number; supplementaryOffset: number }>();
  for (const transaction of row.providentFundTransactions) {
    const previous = transactions.get(transaction.account.id) ?? { accountId: transaction.account.id, memberName: transaction.account.member.name, basicContribution: 0, supplementaryContribution: 0, basicOffset: 0, supplementaryOffset: 0 };
    if (transaction.type === "monthlyContribution") {
      previous.basicContribution += Number(transaction.basicAmount);
      previous.supplementaryContribution += Number(transaction.supplementaryAmount);
    } else {
      previous.basicOffset += Number(transaction.basicAmount);
      previous.supplementaryOffset += Number(transaction.supplementaryAmount);
    }
    transactions.set(transaction.account.id, previous);
  }
  return {
    id: row.id, mortgageId: row.mortgageId, mortgageName: row.mortgage.name, month: row.month, dueDate: day(row.dueDate), status: "confirmed",
    totalAmount: money(row.totalAmount), providentFundOffset: money(row.providentFundOffset), selfFundAmount: money(row.selfFundAmount), note: row.note ?? undefined, confirmedAt: row.confirmedAt.toISOString(),
    parts: row.loanPartRepayments.map((item) => ({ loanPartId: item.loanPartId, loanPartName: item.loanPart.name, sequence: item.sequence, principal: money(item.principal), interest: money(item.interest), amount: toMoney(Number(item.principal) + Number(item.interest)) })),
    providentFundTransactions: [...transactions.values()].map((item) => ({ ...item, basicContribution: toMoney(item.basicContribution), supplementaryContribution: toMoney(item.supplementaryContribution), basicOffset: toMoney(item.basicOffset), supplementaryOffset: toMoney(item.supplementaryOffset) }))
  };
}

const providentFundInclude = { member: true, contributionRates: { orderBy: { effectiveMonth: "desc" as const } } };

function mapProvidentFundAccount(row: Prisma.ProvidentFundAccountGetPayload<{ include: typeof providentFundInclude }>): ProvidentFundAccount {
  return {
    id: row.id, memberId: row.memberId, memberName: row.member.name,
    basicBalance: money(row.basicBalance), supplementaryBalance: money(row.supplementaryBalance),
    basicMonthlyContribution: row.basicMonthlyContribution == null ? undefined : money(row.basicMonthlyContribution),
    supplementaryMonthlyContribution: row.supplementaryMonthlyContribution == null ? undefined : money(row.supplementaryMonthlyContribution),
    monthlyContributionDay: row.monthlyContributionDay,
    balanceUpdatedOn: day(row.balanceUpdatedOn), isActive: row.isActive, note: row.note ?? undefined,
    contributionRates: row.contributionRates.map((rate) => ({ id: rate.id, effectiveMonth: rate.effectiveMonth, basicMonthlyContribution: money(rate.basicMonthlyContribution), supplementaryMonthlyContribution: money(rate.supplementaryMonthlyContribution), source: rate.source, note: rate.note ?? undefined }))
  };
}

function contributionForMonth(account: ProvidentFundAccount, month: string) {
  return account.contributionRates.find((rate) => rate.effectiveMonth <= month)
    ?? { basicMonthlyContribution: account.basicMonthlyContribution ?? "0.00", supplementaryMonthlyContribution: account.supplementaryMonthlyContribution ?? "0.00" };
}

type ProjectedFundBalance = {
  account: ProvidentFundAccount;
  basicCents: number;
  supplementaryCents: number;
  balanceUpdatedOn: string;
};

function allocateProjectedOffset(
  balances: Map<string, ProjectedFundBalance>,
  participants: MortgageProvidentFundParticipant[],
  dueDate: string,
  totalAmountCents: number
) {
  let remainingCents = totalAmountCents;
  const transactions = participants
    .filter((participant) => participant.isActive)
    .sort((left, right) => left.priority - right.priority)
    .flatMap((participant) => {
      const balance = balances.get(participant.accountId);
      if (!balance) return [];
      const contributions = contributionsBetween(balance.account, balance.balanceUpdatedOn, dueDate);
      balance.basicCents += contributions.basicCents;
      balance.supplementaryCents += contributions.supplementaryCents;
      balance.balanceUpdatedOn = dueDate;
      const basicOffsetCents = Math.min(remainingCents, Math.max(0, balance.basicCents - 1));
      balance.basicCents -= basicOffsetCents;
      remainingCents -= basicOffsetCents;
      const supplementaryOffsetCents = Math.min(remainingCents, Math.max(0, balance.supplementaryCents - 1));
      balance.supplementaryCents -= supplementaryOffsetCents;
      remainingCents -= supplementaryOffsetCents;
      return [{
        accountId: balance.account.id,
        memberName: balance.account.memberName,
        basicContribution: centsToMoney(contributions.basicCents),
        supplementaryContribution: centsToMoney(contributions.supplementaryCents),
        basicOffset: centsToMoney(basicOffsetCents),
        supplementaryOffset: centsToMoney(supplementaryOffsetCents)
      }];
    });
  return { providentFundOffsetCents: totalAmountCents - remainingCents, selfFundAmountCents: remainingCents, transactions };
}

function contributionsBetween(account: ProvidentFundAccount, balanceUpdatedOn: string, dueDate: string): { basicCents: number; supplementaryCents: number } {
  let basicCents = 0;
  let supplementaryCents = 0;
  for (const contributionDate of monthlyOccurrenceDatesBetween(balanceUpdatedOn, dueDate, account.monthlyContributionDay)) {
    const contribution = contributionForMonth(account, contributionDate.slice(0, 7));
    basicCents += moneyToCents(contribution.basicMonthlyContribution);
    supplementaryCents += moneyToCents(contribution.supplementaryMonthlyContribution);
  }
  return { basicCents, supplementaryCents };
}
function remainingSummary(mortgages: MortgageRecord[]): { interest: number; monthlyPayment: number } {
  const today = shanghaiToday();
  return mortgages.flatMap((mortgage) => mortgage.loanParts.map((part) => ({ mortgage, part }))).reduce((total, { mortgage, part }) => {
    const currentMonth = today.slice(0, 7);
    const thisMonthDue = dueDateForMonth(currentMonth, mortgage.repaymentDay);
    const firstRepaymentDate = thisMonthDue >= today ? thisMonthDue : dueDateForMonth(addMonth(currentMonth, 1), mortgage.repaymentDay);
    const installments = buildFullMortgageInstallments({ initialPrincipal: part.outstandingPrincipal, repaymentMethod: part.repaymentMethod, totalPeriods: part.remainingPeriods, firstRepaymentDate, rateVersions: part.rateVersions });
    return { interest: total.interest + installments.reduce((interest, installment) => interest + Number(installment.interest), 0), monthlyPayment: total.monthlyPayment + Number(installments[0]?.amount ?? "0") };
  }, { interest: 0, monthlyPayment: 0 });
}
function summaryAfterPrepayment(mortgages: MortgageRecord[], amount: number, preferredKind: MortgageLoanPart["kind"]): { interest: number; monthlyPayment: number } {
  let available = amount;
  const today = shanghaiToday();
  const parts = mortgages.flatMap((mortgage) => mortgage.loanParts.map((part) => ({ mortgage, part }))).sort((left, right) => Number(right.part.kind === preferredKind) - Number(left.part.kind === preferredKind));
  return parts.reduce((total, { mortgage, part }) => {
    const prepaid = Math.min(available, Number(part.outstandingPrincipal));
    available -= prepaid;
    const currentMonth = today.slice(0, 7);
    const thisMonthDue = dueDateForMonth(currentMonth, mortgage.repaymentDay);
    const firstRepaymentDate = thisMonthDue >= today ? thisMonthDue : dueDateForMonth(addMonth(currentMonth, 1), mortgage.repaymentDay);
    const installments = buildFullMortgageInstallments({ initialPrincipal: toMoney(Number(part.outstandingPrincipal) - prepaid), repaymentMethod: part.repaymentMethod, totalPeriods: part.remainingPeriods, firstRepaymentDate, rateVersions: part.rateVersions });
    return { interest: total.interest + installments.reduce((interest, installment) => interest + Number(installment.interest), 0), monthlyPayment: total.monthlyPayment + Number(installments[0]?.amount ?? "0") };
  }, { interest: 0, monthlyPayment: 0 });
}
function addMonth(month: string, offset: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, value! - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
function monthDifference(start: string, end: string): number {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear! - startYear!) * 12 + endMonth! - startMonth!;
}
function dueDateForMonth(month: string, repaymentDay: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  return `${month}-${String(Math.min(repaymentDay, lastDay)).padStart(2, "0")}`;
}
function shanghaiToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function toMoney(value: number): string { return Math.max(0, value).toFixed(2); }
function money(value: { toString(): string }): string { return Number(value.toString()).toFixed(2); }
function moneyToCents(value: string): number { return Math.round(Number(value) * 100); }
function decimalToCents(value: { toString(): string }): number { return moneyToCents(value.toString()); }
function centsToMoney(value: number): string { return (value / 100).toFixed(2); }
function moneyInputToCents(value: string, label: string): number { if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(String(value).trim())) throw new BadRequestException(`${label}格式不正确，最多保留两位小数`); return moneyToCents(value); }
function numberMoney(value: string, label: string): number { return moneyInputToCents(value, label) / 100; }
function positiveMoney(value: string, label: string): number { const result = numberMoney(value, label); if (result <= 0) throw new BadRequestException(`${label}必须大于 0`); return result; }
function rateInput(value: string, label: string): string { if (!/^(0|[1-9]\d*)(\.\d{1,4})?$/.test(String(value).trim())) throw new BadRequestException(`${label}格式不正确，最多保留四位小数`); const result = Number(value); if (result < 0 || result > 100) throw new BadRequestException(`${label}应在 0% 至 100% 之间`); return result.toFixed(4); }
function date(value: string, label: string): Date { if (!isValidBusinessDate(value)) throw new BadRequestException(`${label}格式不正确`); return new Date(`${value}T00:00:00.000Z`); }
function optionalDate(value: string | undefined): Date | undefined { return value ? date(value, "日期") : undefined; }
function optionalText(value: string | undefined): string | undefined { const result = value?.trim(); return result || undefined; }
function day(value: Date): string { return value.toISOString().slice(0, 10); }
function assertMonth(value: string): void { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new BadRequestException("月份格式应为 YYYY-MM"); }
function participantRoleForPriority(priority: number): "borrower" | "spouse" | "parentChild" { return priority === 0 ? "borrower" : priority === 1 ? "spouse" : "parentChild"; }
function rateVersionData(input: PreviewRateAdjustmentInput) {
  return {
    loanPartId: input.loanPartId,
    annualRate: rateInput(input.annualRate, "年利率"),
    effectiveDate: date(input.effectiveDate, "利率生效日"),
    source: input.source,
    lprValue: input.lprValue === undefined ? undefined : rateInput(input.lprValue, "LPR"),
    lprPublishedMonth: optionalText(input.lprPublishedMonth),
    policyVersion: optionalText(input.policyVersion),
    evidenceNote: optionalText(input.evidenceNote)
  };
}
