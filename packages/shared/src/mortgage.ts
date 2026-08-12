import type { MoneyAmount } from "./index.js";

export type MortgageLoanPartKind = "commercial" | "providentFund";
export type MortgageRateType = "fixed" | "lprFloating" | "providentFundPolicy";
export type MortgageRepaymentMethod = "equalPrincipalAndInterest" | "equalPrincipal";
export type MortgageRateSource = "contract" | "lprRepricing" | "shanghaiProvidentFundPolicy" | "bankNotice" | "manualCorrection";
export type MortgageProvidentFundRole = "borrower" | "spouse" | "parentChild";

export interface MortgageRateVersion {
  id: string;
  annualRate: MoneyAmount;
  effectiveDate: string;
  source: MortgageRateSource;
  lprValue?: MoneyAmount;
  lprPublishedMonth?: string;
  policyVersion?: string;
  evidenceNote?: string;
}

export interface MortgageLoanPart {
  id: string;
  kind: MortgageLoanPartKind;
  name: string;
  initialPrincipal: MoneyAmount;
  outstandingPrincipal: MoneyAmount;
  rateType: MortgageRateType;
  occupancyType?: "first" | "second";
  lprSpread?: MoneyAmount;
  repricingCycleMonths?: number;
  repricingDate?: string;
  repaymentMethod: MortgageRepaymentMethod;
  firstRepaymentDate: string;
  totalPeriods: number;
  remainingPeriods: number;
  rateVersions: MortgageRateVersion[];
  actualRepayments: MortgageActualRepayment[];
}

export interface MortgageActualRepayment {
  id: string;
  sequence: number;
  dueDate: string;
  principal: MoneyAmount;
  interest: MoneyAmount;
  source: "bankStatement" | "manual";
  note?: string;
}

export interface MortgageRecord {
  id: string;
  liabilityId: string;
  name: string;
  lender?: string;
  repaymentDay: number;
  note?: string;
  loanParts: MortgageLoanPart[];
  providentFundParticipants: MortgageProvidentFundParticipant[];
}

export interface MortgageProvidentFundParticipant {
  accountId: string;
  memberName: string;
  role: MortgageProvidentFundRole;
  priority: number;
  isActive: boolean;
}

export interface ProvidentFundAccount {
  id: string;
  memberId: string;
  memberName: string;
  basicBalance: MoneyAmount;
  supplementaryBalance: MoneyAmount;
  basicMonthlyContribution?: MoneyAmount;
  supplementaryMonthlyContribution?: MoneyAmount;
  monthlyContributionDay: number;
  balanceUpdatedOn: string;
  isActive: boolean;
  note?: string;
  contributionRates: ProvidentFundContributionRate[];
}

export type ProvidentFundContributionSource = "annualAdjustment" | "employmentChange" | "manualCorrection";

export interface ProvidentFundContributionRate {
  id: string;
  effectiveMonth: string;
  basicMonthlyContribution: MoneyAmount;
  supplementaryMonthlyContribution: MoneyAmount;
  source: ProvidentFundContributionSource;
  note?: string;
}

export interface MortgageInstallment {
  sequence: number;
  dueDate: string;
  principal: MoneyAmount;
  interest: MoneyAmount;
  amount: MoneyAmount;
  annualRate: MoneyAmount;
}

export interface MortgagePlanInstallment extends MortgageInstallment {
  status: "paid" | "planned";
  source?: MortgageActualRepayment["source"];
}

export interface MortgageMonthlyOffsetForecast {
  month: string;
  repaymentEvents: Array<{ mortgageId: string; dueDate: string; amount: MoneyAmount }>;
  dueAmount: MoneyAmount;
  providentFundOffset: MoneyAmount;
  selfFundAmount: MoneyAmount;
  participantBalances: Array<{ memberName: string; basicBalance: MoneyAmount; supplementaryBalance: MoneyAmount }>;
}

export interface MortgageRepaymentPart {
  loanPartId: string;
  loanPartName: string;
  sequence: number;
  principal: MoneyAmount;
  interest: MoneyAmount;
  amount: MoneyAmount;
}

export interface ProvidentFundMonthlyTransaction {
  accountId: string;
  memberName: string;
  basicContribution: MoneyAmount;
  supplementaryContribution: MoneyAmount;
  basicOffset: MoneyAmount;
  supplementaryOffset: MoneyAmount;
}

export interface MortgageMonthlyRepayment {
  id?: string;
  mortgageId: string;
  mortgageName: string;
  month: string;
  dueDate: string;
  status: "scheduled" | "pending" | "confirmed";
  totalAmount: MoneyAmount;
  providentFundOffset: MoneyAmount;
  selfFundAmount: MoneyAmount;
  parts: MortgageRepaymentPart[];
  providentFundTransactions: ProvidentFundMonthlyTransaction[];
  note?: string;
  confirmedAt?: string;
}

export interface MortgageRateReminder {
  mortgageName: string;
  loanPartName: string;
  repricingDate: string;
  daysUntil: number;
}

export interface MortgageStrategyComparison {
  name: string;
  oneOffAmount: MoneyAmount;
  estimatedMonthlyPayment: MoneyAmount;
  remainingInterest: MoneyAmount;
  interestSaved: MoneyAmount;
  note: string;
}

export interface MortgagePlanningData {
  monthlyOffset: MortgageMonthlyOffsetForecast[];
  monthlyOffsetCoverage: {
    fullOffsetThrough: string;
    firstSelfFundMonth?: string;
    endsBecause: "insufficient" | "loanPaidOff";
  };
  rateReminders: MortgageRateReminder[];
  strategies: MortgageStrategyComparison[];
}

export interface MortgageRateAdjustmentPreview {
  currentMonthlyPayment: MoneyAmount;
  adjustedMonthlyPayment: MoneyAmount;
  currentRemainingInterest: MoneyAmount;
  adjustedRemainingInterest: MoneyAmount;
  differencePerMonth: MoneyAmount;
}

export interface ConfirmMortgageMonthlyRepaymentInput {
  month: string;
  dueDate?: string;
  bankAccountId?: string;
  parts: Array<{ loanPartId: string; principal: string; interest: string }>;
  providentFundTransactions: Array<{
    accountId: string;
    basicContribution: string;
    supplementaryContribution: string;
    basicOffset: string;
    supplementaryOffset: string;
  }>;
  note?: string;
}

export function buildMortgageInstallments(input: {
  outstandingPrincipal: MoneyAmount;
  annualRate: MoneyAmount;
  repaymentMethod: MortgageRepaymentMethod;
  remainingPeriods: number;
  firstRepaymentDate: string;
}): MortgageInstallment[] {
  const principalCents = moneyToCents(input.outstandingPrincipal);
  const periods = Math.max(0, Math.trunc(input.remainingPeriods));
  if (!principalCents || !periods) return [];
  const monthlyRate = Number(input.annualRate) / 100 / 12;
  const basePrincipal = input.repaymentMethod === "equalPrincipal" ? Math.floor(principalCents / periods) : 0;
  const fixedPayment = input.repaymentMethod === "equalPrincipalAndInterest"
    ? equalPayment(principalCents, monthlyRate, periods)
    : 0;
  let outstanding = principalCents;

  return Array.from({ length: periods }, (_, index) => {
    const interest = Math.round(outstanding * monthlyRate);
    const principal = index === periods - 1
      ? outstanding
      : input.repaymentMethod === "equalPrincipal"
        ? basePrincipal
        : Math.min(outstanding, Math.max(0, fixedPayment - interest));
    outstanding -= principal;
    return {
      sequence: index + 1,
      dueDate: addMonthsClamped(input.firstRepaymentDate, index),
      principal: centsToMoney(principal),
      interest: centsToMoney(interest),
      amount: centsToMoney(principal + interest),
      annualRate: normalizedMoney(input.annualRate)
    };
  });
}

export function buildFullMortgageInstallments(input: {
  initialPrincipal: MoneyAmount;
  repaymentMethod: MortgageRepaymentMethod;
  totalPeriods: number;
  firstRepaymentDate: string;
  rateVersions: Pick<MortgageRateVersion, "annualRate" | "effectiveDate">[];
  actualRepayments?: MortgageActualRepayment[];
  forecastOutstandingPrincipal?: MoneyAmount;
}): MortgagePlanInstallment[] {
  const totalPeriods = Math.max(0, Math.trunc(input.totalPeriods));
  const rateVersions = [...input.rateVersions].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  const actualBySequence = new Map((input.actualRepayments ?? []).map((repayment) => [repayment.sequence, repayment]));
  const latestActualSequence = Math.max(0, ...actualBySequence.keys());
  const forecastOutstanding = input.forecastOutstandingPrincipal == null ? undefined : moneyToCents(input.forecastOutstandingPrincipal);
  let outstanding = moneyToCents(input.initialPrincipal);
  let fixedPayment = 0;
  let previousRate = "";

  return Array.from({ length: totalPeriods }, (_, index) => {
    const sequence = index + 1;
    const dueDate = addMonthsClamped(input.firstRepaymentDate, index);
    const annualRate = mortgageRateAt(rateVersions, dueDate);
    const actual = actualBySequence.get(sequence);
    if (actual) {
      const principal = moneyToCents(actual.principal);
      const interest = moneyToCents(actual.interest);
      outstanding = Math.max(0, outstanding - principal);
      fixedPayment = 0;
      previousRate = annualRate;
      return { sequence, dueDate, principal: centsToMoney(principal), interest: centsToMoney(interest), amount: centsToMoney(principal + interest), annualRate, status: "paid", source: actual.source };
    }

    if (forecastOutstanding !== undefined && sequence === latestActualSequence + 1) {
      outstanding = forecastOutstanding;
      fixedPayment = 0;
    }

    const monthlyRate = Number(annualRate) / 100 / 12;
    if (!fixedPayment || previousRate !== annualRate) {
      fixedPayment = input.repaymentMethod === "equalPrincipalAndInterest"
        ? equalPayment(outstanding, monthlyRate, totalPeriods - index)
        : 0;
      previousRate = annualRate;
    }
    const interest = Math.round(outstanding * monthlyRate);
    const principal = index === totalPeriods - 1
      ? outstanding
      : input.repaymentMethod === "equalPrincipal"
        ? Math.min(outstanding, Math.floor(outstanding / Math.max(1, totalPeriods - index)))
        : Math.min(outstanding, Math.max(0, fixedPayment - interest));
    outstanding -= principal;
    return { sequence, dueDate, principal: centsToMoney(principal), interest: centsToMoney(interest), amount: centsToMoney(principal + interest), annualRate, status: "planned" };
  });
}

export function previewMortgageRateAdjustment(input: {
  outstandingPrincipal: MoneyAmount;
  currentAnnualRate: MoneyAmount;
  adjustedAnnualRate: MoneyAmount;
  repaymentMethod: MortgageRepaymentMethod;
  remainingPeriods: number;
}): MortgageRateAdjustmentPreview {
  const current = buildMortgageInstallments({
    outstandingPrincipal: input.outstandingPrincipal,
    annualRate: input.currentAnnualRate,
    repaymentMethod: input.repaymentMethod,
    remainingPeriods: input.remainingPeriods,
    firstRepaymentDate: "2000-01-01"
  });
  const adjusted = buildMortgageInstallments({
    outstandingPrincipal: input.outstandingPrincipal,
    annualRate: input.adjustedAnnualRate,
    repaymentMethod: input.repaymentMethod,
    remainingPeriods: input.remainingPeriods,
    firstRepaymentDate: "2000-01-01"
  });
  const sum = (items: MortgageInstallment[]) => items.reduce((total, item) => total + moneyToCents(item.interest), 0);
  const currentMonthly = current[0]?.amount ?? "0.00";
  const adjustedMonthly = adjusted[0]?.amount ?? "0.00";
  return {
    currentMonthlyPayment: currentMonthly,
    adjustedMonthlyPayment: adjustedMonthly,
    currentRemainingInterest: centsToMoney(sum(current)),
    adjustedRemainingInterest: centsToMoney(sum(adjusted)),
    differencePerMonth: centsToMoney(moneyToCents(adjustedMonthly) - moneyToCents(currentMonthly))
  };
}

function equalPayment(principalCents: number, monthlyRate: number, periods: number): number {
  if (!monthlyRate) return Math.round(principalCents / periods);
  return Math.round(principalCents * monthlyRate * (1 + monthlyRate) ** periods / ((1 + monthlyRate) ** periods - 1));
}

function moneyToCents(value: MoneyAmount): number {
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number): MoneyAmount {
  return (value / 100).toFixed(2);
}

function normalizedMoney(value: MoneyAmount): MoneyAmount {
  return centsToMoney(moneyToCents(value));
}

export function mortgageRateAt(rateVersions: Pick<MortgageRateVersion, "annualRate" | "effectiveDate">[], dueDate: string): MoneyAmount {
  const matching = [...rateVersions]
    .filter((rate) => rate.effectiveDate <= dueDate)
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
    .at(-1);
  return normalizedMoney(matching?.annualRate ?? "0.0000");
}

export function isValidBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day || month > 12) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsClamped(date: string, months: number): string {
  if (!isValidBusinessDate(date)) throw new RangeError("日期格式应为 YYYY-MM-DD");
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const targetFirst = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  const value = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), Math.min(day, lastDay)));
  return value.toISOString().slice(0, 10);
}

export function monthlyOccurrenceDatesBetween(startExclusive: string, endInclusive: string, dayOfMonth: number): string[] {
  if (!isValidBusinessDate(startExclusive) || !isValidBusinessDate(endInclusive)) throw new RangeError("日期格式应为 YYYY-MM-DD");
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) throw new RangeError("每月日期应为 1 至 31");
  if (startExclusive >= endInclusive) return [];
  const startMonth = startExclusive.slice(0, 7);
  const endMonth = endInclusive.slice(0, 7);
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  const months = (endYear! - startYear!) * 12 + endMonthNumber! - startMonthNumber!;
  return Array.from({ length: months + 1 }, (_, offset) => {
    const monthStart = addMonthsClamped(`${startMonth}-01`, offset).slice(0, 7);
    const [year, month] = monthStart.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    return `${monthStart}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`;
  }).filter((date) => date > startExclusive && date <= endInclusive);
}
