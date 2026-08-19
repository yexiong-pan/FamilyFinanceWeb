import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  FinancialSafetyData,
  FinancialSafetySettings,
  FinanceTransaction,
  MonthlyReviewAction,
  MonthlyReviewChange,
  MonthlyReviewDetail,
  MonthlyReviewStatus,
  MortgageCashflow,
  RecurringCashflow,
  SafetyConfidence,
  SafetyObligation
} from "@family-finance/shared";
import {
  calculateEmergencyCoverageMonths,
  calculateSafeToSpend,
  normalizeMoney
} from "@family-finance/shared";
import type {
  FinancialSafetySettingsInput,
  MonthlyReviewActionInput,
  MonthlyReviewContentInput,
  RecurringCashflowInput
} from "./financial-planning.types";
import { FinanceService } from "./finance.service";
import { PrismaService } from "../prisma.service";
import { MortgageService } from "./mortgage.service";

const DEFAULT_FAMILY_ID = "default-family";
const DEFAULT_FAMILY_NAME = "我的家庭";
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const EMPTY_MORTGAGE_CASHFLOWS = {
  mortgageCashflowObligations: async () => []
} satisfies Pick<MortgageService, "mortgageCashflowObligations">;

@Injectable()
export class FinancialPlanningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceService) private readonly financeService: FinanceService,
    @Inject(MortgageService) private readonly mortgageService: Pick<MortgageService, "mortgageCashflowObligations"> = EMPTY_MORTGAGE_CASHFLOWS
  ) {}

  async getFinancialSafety(month: string): Promise<FinancialSafetyData> {
    assertMonth(month);
    await this.ensurePlanningData();
    const referenceDate = safetyReferenceDate(month);
    const horizonEnd = addUtcDays(referenceDate, 30);
    const [settings, recurringRows, accounts, liabilities, essentialTransactions, mortgageCashflows] = await Promise.all([
      this.prisma.financialSafetySettings.findUniqueOrThrow({ where: { familyId: DEFAULT_FAMILY_ID } }),
      this.prisma.recurringCashflow.findMany({
        where: { familyId: DEFAULT_FAMILY_ID },
        include: { category: { select: { name: true } } },
        orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }, { createdAt: "asc" }]
      }),
      this.financeService.listAccountsForMonth(month),
      this.financeService.listLiabilitiesForMonth(month),
      this.listEssentialTransactions(month),
      this.mortgageService.mortgageCashflowObligations(formatDate(referenceDate), formatDate(horizonEnd))
    ]);

    const recurringCashflows = recurringRows.map(mapRecurringCashflow);
    const managedMortgageLiabilityIds = new Set(mortgageCashflows.map((cashflow) => cashflow.liabilityId));
    const upcomingObligations = [
      ...buildRecurringObligations(recurringCashflows, referenceDate, horizonEnd),
      ...buildLiabilityObligations(liabilities.filter((liability) => !managedMortgageLiabilityIds.has(liability.id)), referenceDate, horizonEnd),
      ...buildMortgageCashflowObligations(mortgageCashflows)
    ].sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name));
    const expectedIncome = sumMoney(
      upcomingObligations.filter((item) => item.kind === "income").map((item) => item.amount)
    );
    const requiredExpenses = sumMoney(
      upcomingObligations.filter((item) => item.kind === "expense").map((item) => item.amount)
    );
    const debtPayments = sumMoney(
      upcomingObligations.filter((item) => item.kind === "debt").map((item) => item.amount)
    );
    const mortgageProvidentFundOffset = sumMoney(mortgageCashflows.map((item) => item.providentFundOffset));
    const selectedLiquidAccountIds = new Set(settings.liquidAccountIds);
    const liquidAccounts = settings.liquidAccountIds.length > 0
      ? accounts.filter((account) => selectedLiquidAccountIds.has(account.id))
      : accounts.filter((account) => account.purpose === "daily");
    const liquidAmount = sumMoney(liquidAccounts.map((account) => account.currentValue));
    const emergencyReserve = money(settings.emergencyReserve);
    const plannedSavings = money(settings.plannedMonthlySavings);
    const safeResult = calculateSafeToSpend({
      liquidAmount,
      expectedIncome,
      requiredExpenses,
      debtPayments,
      plannedSavings,
      emergencyReserve
    });
    const confidenceIssues = buildConfidenceIssues({
      month,
      liquidAccounts,
      liquidAccountsExplicitlySelected: settings.liquidAccountIds.length > 0,
      recurringCount: recurringCashflows.filter((item) => item.isActive).length,
      liabilities
    });
    const confidence: SafetyConfidence = liquidAccounts.length === 0
      ? "insufficient"
      : confidenceIssues.length === 0
        ? "reliable"
        : "estimate";
    const averageEssentialExpense = averageMonthlyExpense(essentialTransactions, 3);
    const emergencyCoverageMonths = calculateEmergencyCoverageMonths(
      emergencyReserve,
      averageEssentialExpense
    );

    return {
      settings: {
        emergencyReserve,
        plannedMonthlySavings: plannedSavings,
        liquidAccountIds: settings.liquidAccountIds
      },
      recurringCashflows,
      summary: {
        month,
        asOfDate: formatDate(referenceDate),
        liquidAmount,
        expectedIncome,
        requiredExpenses,
        debtPayments,
        mortgageProvidentFundOffset,
        plannedSavings,
        emergencyReserve,
        ...safeResult,
        ...(emergencyCoverageMonths === undefined ? {} : { emergencyCoverageMonths }),
        confidence,
        confidenceIssues,
        upcomingObligations
      }
    };
  }

  async updateFinancialSafetySettings(
    input: FinancialSafetySettingsInput
  ): Promise<FinancialSafetySettings> {
    await this.ensurePlanningData();
    const liquidAccountIds = [...new Set(input.liquidAccountIds ?? [])];
    const accountCount = await this.prisma.account.count({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        id: { in: liquidAccountIds }
      }
    });
    if (accountCount !== liquidAccountIds.length) {
      throw new BadRequestException("流动资金账户包含无效账户");
    }
    const settings = await this.prisma.financialSafetySettings.update({
      where: { familyId: DEFAULT_FAMILY_ID },
      data: {
        emergencyReserve: normalizeMoney(input.emergencyReserve),
        plannedMonthlySavings: normalizeMoney(input.plannedMonthlySavings),
        liquidAccountIds
      }
    });
    return {
      emergencyReserve: money(settings.emergencyReserve),
      plannedMonthlySavings: money(settings.plannedMonthlySavings),
      liquidAccountIds: settings.liquidAccountIds
    };
  }

  async createRecurringCashflow(input: RecurringCashflowInput): Promise<RecurringCashflow> {
    await this.ensurePlanningData();
    validateRecurringCashflow(input);
    const data = await this.resolveRecurringCashflowData(input);
    const row = await this.prisma.recurringCashflow.create({
      data,
      include: { category: { select: { name: true } } }
    });
    return mapRecurringCashflow(row);
  }

  async updateRecurringCashflow(
    id: string,
    input: RecurringCashflowInput
  ): Promise<RecurringCashflow> {
    await this.ensurePlanningData();
    validateRecurringCashflow(input);
    const data = await this.resolveRecurringCashflowData(input);
    await this.prisma.recurringCashflow.findFirstOrThrow({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
    const row = await this.prisma.recurringCashflow.update({
      where: { id },
      data,
      include: { category: { select: { name: true } } }
    });
    return mapRecurringCashflow(row);
  }

  async deleteRecurringCashflow(id: string): Promise<void> {
    await this.prisma.recurringCashflow.deleteMany({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
  }

  async getMonthlyReviewDetail(month: string): Promise<MonthlyReviewDetail> {
    assertMonth(month);
    await this.ensurePlanningData();
    const previous = shiftMonth(month, -1);
    const [review, status, currentSummary, previousSummary, currentTransactions, previousTransactions, staleAccounts, liabilities] =
      await Promise.all([
        this.ensureMonthlyReview(month),
        this.financeService.getMonthlyReview(month),
        this.financeService.getDashboardSummary(month),
        this.financeService.getDashboardSummary(previous),
        this.financeService.listTransactions({ month }),
        this.financeService.listTransactions({ month: previous }),
        this.prisma.account.count({
          where: {
            familyId: DEFAULT_FAMILY_ID,
            deletedAt: null,
            updatedAt: { lt: addUtcDays(new Date(), -30) }
          }
        }),
        this.financeService.listLiabilitiesForMonth(month)
      ]);
    const pendingImportedTransactions = (kind: "income" | "expense") => currentTransactions.filter(
      (item) => item.kind === kind && item.source && item.source !== "manual" && !item.confirmedAt
    ).length;
    const pendingIncomeTransactions = pendingImportedTransactions("income");
    const pendingExpenseTransactions = pendingImportedTransactions("expense");
    const unclassifiedTransactions = currentTransactions.filter(
      (item) => item.categoryName === "待分类支出" || item.categoryName === "待分类收入"
    ).length;
    const incompleteLiabilities = liabilities.filter(isIncompleteMonthlyLiability).length;
    const checks = [
      { key: "income", label: "收入已确认", complete: status.income, severity: "required" as const },
      { key: "spending", label: "支出已确认", complete: status.spending, severity: "required" as const },
      { key: "assets", label: "资产已保存快照", complete: status.assets, severity: "required" as const },
      { key: "liabilities", label: "负债已保存快照", complete: status.liabilities, severity: "required" as const },
      { key: "investments", label: "投资已保存快照", complete: status.investments, severity: "required" as const },
      {
        key: "pending-income-transactions",
        label: "没有待确认收入流水",
        complete: pendingIncomeTransactions === 0,
        detail: pendingIncomeTransactions ? `${pendingIncomeTransactions} 笔收入待确认` : undefined,
        severity: "warning" as const
      },
      {
        key: "pending-expense-transactions",
        label: "没有待确认支出流水",
        complete: pendingExpenseTransactions === 0,
        detail: pendingExpenseTransactions ? `${pendingExpenseTransactions} 笔支出待确认` : undefined,
        severity: "warning" as const
      },
      {
        key: "uncategorized-transactions",
        label: "没有待分类流水",
        complete: unclassifiedTransactions === 0,
        detail: unclassifiedTransactions ? `${unclassifiedTransactions} 笔流水待分类` : undefined,
        severity: "warning" as const
      },
      {
        key: "fresh-accounts",
        label: "资产余额近期已更新",
        complete: staleAccounts === 0,
        detail: staleAccounts ? `${staleAccounts} 个账户超过30天未更新` : undefined,
        severity: "warning" as const
      },
      {
        key: "complete-liabilities",
        label: "负债还款信息完整",
        complete: incompleteLiabilities === 0,
        detail: incompleteLiabilities ? `${incompleteLiabilities} 笔负债缺少月供或还款日` : undefined,
        severity: "warning" as const
      }
    ];
    const requiredComplete = status.income
      && status.spending
      && status.assets
      && status.liabilities
      && status.investments;

    return {
      month,
      state: review.reviewCompletedAt ? "completed" : requiredComplete ? "ready" : "draft",
      status,
      content: {
        ...(review.summary ? { summary: review.summary } : {}),
        ...(review.good ? { good: review.good } : {}),
        ...(review.improve ? { improve: review.improve } : {}),
        ...(review.nextFocus ? { nextFocus: review.nextFocus } : {})
      },
      checks,
      changes: buildMonthlyChanges(
        currentSummary,
        previousSummary,
        currentTransactions,
        previousTransactions
      ),
      actions: review.actions.map(mapMonthlyReviewAction)
    };
  }

  async confirmMonthlyIncome(month: string): Promise<MonthlyReviewStatus> {
    assertMonth(month);
    await this.ensureMonthlyReview(month);
    await this.prisma.monthlyReview.update({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      data: { incomeConfirmedAt: new Date() }
    });
    return this.financeService.getMonthlyReview(month);
  }

  async updateMonthlyReviewContent(
    month: string,
    input: MonthlyReviewContentInput
  ): Promise<MonthlyReviewDetail> {
    assertMonth(month);
    await this.ensureMonthlyReview(month);
    await this.prisma.monthlyReview.update({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      data: {
        summary: cleanText(input.summary),
        good: cleanText(input.good),
        improve: cleanText(input.improve),
        nextFocus: cleanText(input.nextFocus)
      }
    });
    return this.getMonthlyReviewDetail(month);
  }

  async completeMonthlyReview(month: string): Promise<MonthlyReviewDetail> {
    const detail = await this.getMonthlyReviewDetail(month);
    const requiredIncomplete = detail.checks.filter(
      (item) => item.severity === "required" && !item.complete
    );
    if (requiredIncomplete.length > 0) {
      throw new BadRequestException(`请先完成：${requiredIncomplete.map((item) => item.label).join("、")}`);
    }
    if (!detail.content.summary?.trim()) {
      throw new BadRequestException("请先填写本月财务总结");
    }
    await this.prisma.monthlyReview.update({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      data: { reviewCompletedAt: new Date() }
    });
    return this.getMonthlyReviewDetail(month);
  }

  async reopenMonthlyReview(month: string): Promise<MonthlyReviewDetail> {
    await this.ensureMonthlyReview(month);
    await this.prisma.monthlyReview.update({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      data: { reviewCompletedAt: null }
    });
    return this.getMonthlyReviewDetail(month);
  }

  async createMonthlyReviewAction(
    month: string,
    input: MonthlyReviewActionInput
  ): Promise<MonthlyReviewAction> {
    const review = await this.ensureMonthlyReview(month);
    validateAction(input);
    const action = await this.prisma.monthlyReviewAction.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        monthlyReviewId: review.id,
        month,
        ...monthlyReviewActionData(input)
      }
    });
    return mapMonthlyReviewAction(action);
  }

  async updateMonthlyReviewAction(
    id: string,
    input: MonthlyReviewActionInput
  ): Promise<MonthlyReviewAction> {
    validateAction(input);
    await this.prisma.monthlyReviewAction.findFirstOrThrow({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
    const action = await this.prisma.monthlyReviewAction.update({
      where: { id },
      data: monthlyReviewActionData(input)
    });
    return mapMonthlyReviewAction(action);
  }

  async deleteMonthlyReviewAction(id: string): Promise<void> {
    await this.prisma.monthlyReviewAction.deleteMany({
      where: { id, familyId: DEFAULT_FAMILY_ID }
    });
  }

  private async ensurePlanningData() {
    await this.prisma.family.upsert({
      where: { id: DEFAULT_FAMILY_ID },
      update: {},
      create: { id: DEFAULT_FAMILY_ID, name: DEFAULT_FAMILY_NAME }
    });
    return this.prisma.financialSafetySettings.upsert({
      where: { familyId: DEFAULT_FAMILY_ID },
      update: {},
      create: { familyId: DEFAULT_FAMILY_ID }
    });
  }

  private async resolveRecurringCashflowData(input: RecurringCashflowInput) {
    const category = input.categoryId
      ? await this.prisma.category.findFirst({
          where: {
            id: input.categoryId,
            familyId: DEFAULT_FAMILY_ID,
            isActive: true
          },
          select: { kind: true, expenseNature: true }
        })
      : null;
    if (input.categoryId && !category) {
      throw new BadRequestException("关联分类不存在或已停用");
    }
    if (category && category.kind !== input.kind) {
      throw new BadRequestException("关联分类与收支类型不一致");
    }
    const expenseNature = input.kind === "expense"
      ? category?.expenseNature ?? input.expenseNature
      : undefined;
    if (input.kind === "expense" && !expenseNature) {
      throw new BadRequestException("支出周期项目必须设置支出性质");
    }
    return recurringCashflowData(input, expenseNature);
  }

  private async ensureMonthlyReview(month: string) {
    assertMonth(month);
    await this.ensurePlanningData();
    return this.prisma.monthlyReview.upsert({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      update: {},
      create: { familyId: DEFAULT_FAMILY_ID, month },
      include: { actions: { orderBy: { createdAt: "asc" } } }
    });
  }

  private async listEssentialTransactions(month: string) {
    const start = monthStart(shiftMonth(month, -3));
    const end = monthStart(month);
    return this.prisma.financeTransaction.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        kind: "expense",
        date: { gte: start, lt: end },
        category: { expenseNature: { in: ["fixed", "necessary"] } }
      },
      select: { amount: true }
    });
  }
}

function recurringCashflowData(
  input: RecurringCashflowInput,
  expenseNature?: RecurringCashflowInput["expenseNature"]
) {
  return {
    familyId: DEFAULT_FAMILY_ID,
    name: input.name.trim(),
    kind: input.kind,
    amount: normalizeMoney(input.amount),
    dayOfMonth: input.dayOfMonth,
    memberName: cleanText(input.memberName),
    accountId: input.accountId || null,
    categoryId: input.categoryId || null,
    expenseNature: input.kind === "expense" ? expenseNature ?? null : null,
    startMonth: cleanText(input.startMonth),
    endMonth: cleanText(input.endMonth),
    isActive: input.isActive ?? true
  };
}

function monthlyReviewActionData(input: MonthlyReviewActionInput) {
  return {
    title: input.title.trim(),
    ownerName: cleanText(input.ownerName),
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    targetAmount: input.targetAmount ? normalizeMoney(input.targetAmount) : null,
    status: input.status ?? "pending"
  };
}

function mapRecurringCashflow(row: {
  id: string;
  name: string;
  kind: string;
  amount: { toString(): string };
  dayOfMonth: number;
  memberName: string | null;
  accountId: string | null;
  categoryId: string | null;
  expenseNature: "fixed" | "necessary" | "flexible" | "goal" | null;
  startMonth: string | null;
  endMonth: string | null;
  isActive: boolean;
  category?: { name: string } | null;
}): RecurringCashflow {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as "income" | "expense",
    amount: money(row.amount),
    dayOfMonth: row.dayOfMonth,
    ...(row.memberName ? { memberName: row.memberName } : {}),
    ...(row.accountId ? { accountId: row.accountId } : {}),
    ...(row.categoryId ? { categoryId: row.categoryId } : {}),
    ...(row.category?.name ? { categoryName: row.category.name } : {}),
    ...(row.expenseNature ? { expenseNature: row.expenseNature } : {}),
    ...(row.startMonth ? { startMonth: row.startMonth } : {}),
    ...(row.endMonth ? { endMonth: row.endMonth } : {}),
    isActive: row.isActive
  };
}

function mapMonthlyReviewAction(row: {
  id: string;
  month: string;
  title: string;
  ownerName: string | null;
  dueDate: Date | null;
  targetAmount: { toString(): string } | null;
  status: "pending" | "completed" | "cancelled";
}): MonthlyReviewAction {
  return {
    id: row.id,
    month: row.month,
    title: row.title,
    ...(row.ownerName ? { ownerName: row.ownerName } : {}),
    ...(row.dueDate ? { dueDate: formatDate(row.dueDate) } : {}),
    ...(row.targetAmount ? { targetAmount: money(row.targetAmount) } : {}),
    status: row.status
  };
}

function buildRecurringObligations(
  items: RecurringCashflow[],
  start: Date,
  end: Date
): SafetyObligation[] {
  const result: SafetyObligation[] = [];
  for (const item of items) {
    if (!item.isActive) continue;
    for (const date of monthlyOccurrences(item.dayOfMonth, start, end)) {
      const month = formatDate(date).slice(0, 7);
      if (item.startMonth && month < item.startMonth) continue;
      if (item.endMonth && month > item.endMonth) continue;
      result.push({
        id: `recurring:${item.id}:${formatDate(date)}`,
        name: item.name,
        date: formatDate(date),
        kind: item.kind,
        amount: item.amount,
        ...(item.memberName ? { memberName: item.memberName } : {})
      });
    }
  }
  return result;
}

function buildLiabilityObligations(
  liabilities: Array<{
    id: string;
    name: string;
    ownerName: string;
    monthlyPayment?: string;
    paymentDay?: number;
    repaymentSchedule?: string;
    status: string;
  }>,
  start: Date,
  end: Date
): SafetyObligation[] {
  return liabilities.flatMap((item) => {
    if (item.repaymentSchedule === "flexible" || isIncompleteMonthlyLiability(item)) return [];
    if (!item.monthlyPayment || !item.paymentDay) return [];
    return monthlyOccurrences(item.paymentDay, start, end).map((date) => ({
      id: `liability:${item.id}:${formatDate(date)}`,
      name: item.name,
      date: formatDate(date),
      kind: "debt" as const,
      amount: item.monthlyPayment!,
      memberName: item.ownerName
    }));
  });
}

function buildMortgageCashflowObligations(cashflows: MortgageCashflow[]): SafetyObligation[] {
  return cashflows.map((cashflow) => {
    const offset = Number(cashflow.providentFundOffset);
    const suffix = offset > 0
      ? `（公积金月冲 ${cashflow.providentFundOffset}）`
      : "（银行卡全额支付）";
    return {
      id: `mortgage:${cashflow.mortgageId}:${cashflow.dueDate}`,
      name: `${cashflow.mortgageName}${suffix}`,
      date: cashflow.dueDate,
      kind: "debt" as const,
      amount: cashflow.selfFundAmount
    };
  });
}

function buildMonthlyChanges(
  current: {
    monthlyIncome: string;
    monthlyExpense: string;
    monthlyBalance: string;
  },
  previous: {
    monthlyIncome: string;
    monthlyExpense: string;
    monthlyBalance: string;
  },
  currentTransactions: FinanceTransaction[],
  previousTransactions: FinanceTransaction[]
): MonthlyReviewChange[] {
  const changes = [
    changeRow("income", "收入", current.monthlyIncome, previous.monthlyIncome, "income"),
    changeRow("expense", "支出", current.monthlyExpense, previous.monthlyExpense, "expense"),
    changeRow("balance", "结余", current.monthlyBalance, previous.monthlyBalance, "balance")
  ];
  const currentCategories = aggregateExpenseCategories(currentTransactions);
  const previousCategories = aggregateExpenseCategories(previousTransactions);
  const categoryNames = new Set([...currentCategories.keys(), ...previousCategories.keys()]);
  const categoryChanges = [...categoryNames].map((categoryName) => {
    const currentAmount = currentCategories.get(categoryName) ?? "0.00";
    const previousAmount = previousCategories.get(categoryName) ?? "0.00";
    return changeRow(
      `category:${categoryName}`,
      `${categoryName}支出`,
      currentAmount,
      previousAmount,
      "expense"
    );
  });
  categoryChanges.sort((left, right) => Math.abs(Number(right.changeAmount)) - Math.abs(Number(left.changeAmount)));
  return [...changes, ...categoryChanges.slice(0, 3)];
}

function changeRow(
  key: string,
  label: string,
  currentAmount: string,
  previousAmount: string,
  kind: "income" | "expense" | "balance"
): MonthlyReviewChange {
  const change = Number(currentAmount) - Number(previousAmount);
  const previousValue = Number(previousAmount);
  const positive = kind === "expense" ? change < 0 : change > 0;
  return {
    key,
    label,
    currentAmount: normalizeMoney(currentAmount),
    previousAmount: normalizeMoney(previousAmount),
    changeAmount: normalizeSignedMoney(change),
    ...(previousValue === 0 ? {} : { changeRate: Math.round((change / previousValue) * 1000) / 10 }),
    tone: change === 0 ? "neutral" : positive ? "positive" : "negative"
  };
}

function aggregateExpenseCategories(transactions: FinanceTransaction[]): Map<string, string> {
  const cents = new Map<string, number>();
  for (const item of transactions) {
    if (item.kind !== "expense") continue;
    cents.set(item.categoryName, (cents.get(item.categoryName) ?? 0) + Math.round(Number(item.amount) * 100));
  }
  return new Map([...cents].map(([name, amount]) => [name, (amount / 100).toFixed(2)]));
}

function buildConfidenceIssues(input: {
  month: string;
  liquidAccounts: Array<{ updatedAt?: string }>;
  liquidAccountsExplicitlySelected: boolean;
  recurringCount: number;
  liabilities: Array<{ status: string; repaymentSchedule: string; monthlyPayment?: string; paymentDay?: number }>;
}): string[] {
  const issues: string[] = [];
  if (input.liquidAccounts.length === 0) issues.push("尚未配置可用的流动资金账户");
  if (input.liquidAccounts.length > 0 && !input.liquidAccountsExplicitlySelected) {
    issues.push("流动资金账户未手动指定，当前按资金用途自动识别");
  }
  const stale = input.liquidAccounts.filter((item) => {
    if (!item.updatedAt) return true;
    return Date.now() - new Date(item.updatedAt).valueOf() > 30 * 24 * 60 * 60 * 1000;
  }).length;
  if (stale > 0 && input.month === formatDate(new Date()).slice(0, 7)) {
    issues.push(`${stale} 个流动资金账户超过30天未更新`);
  }
  if (input.recurringCount === 0) issues.push("尚未配置周期性收入和支出");
  const incompleteLiabilities = input.liabilities.filter(isIncompleteMonthlyLiability).length;
  if (incompleteLiabilities > 0) {
    issues.push(`${incompleteLiabilities} 笔负债缺少月供或还款日`);
  }
  return issues;
}

function isIncompleteMonthlyLiability(item: {
  status: string;
  repaymentSchedule?: string;
  monthlyPayment?: string;
  paymentDay?: number;
}): boolean {
  return item.status === "active"
    && (item.repaymentSchedule ?? "monthly") === "monthly"
    && (Number(item.monthlyPayment ?? 0) <= 0 || !item.paymentDay);
}

function validateRecurringCashflow(input: RecurringCashflowInput) {
  if (!input.name?.trim()) throw new BadRequestException("周期项目名称不能为空");
  if (input.kind !== "income" && input.kind !== "expense") {
    throw new BadRequestException("周期项目仅支持收入或支出");
  }
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0) {
    throw new BadRequestException("周期项目金额无效");
  }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    throw new BadRequestException("每月日期必须在1至31日之间");
  }
  if (input.startMonth && !MONTH_PATTERN.test(input.startMonth)) throw new BadRequestException("开始月份格式无效");
  if (input.endMonth && !MONTH_PATTERN.test(input.endMonth)) throw new BadRequestException("结束月份格式无效");
  if (input.startMonth && input.endMonth && input.startMonth > input.endMonth) {
    throw new BadRequestException("结束月份不能早于开始月份");
  }
}

function validateAction(input: MonthlyReviewActionInput) {
  if (!input.title?.trim()) throw new BadRequestException("行动内容不能为空");
  if (input.targetAmount && (!Number.isFinite(Number(input.targetAmount)) || Number(input.targetAmount) < 0)) {
    throw new BadRequestException("目标金额无效");
  }
}

function safetyReferenceDate(month: string): Date {
  const currentMonth = formatDate(new Date()).slice(0, 7);
  if (month === currentMonth) return startOfUtcDay(new Date());
  if (month < currentMonth) return addUtcDays(monthStart(shiftMonth(month, 1)), -1);
  return monthStart(month);
}

function monthlyOccurrences(dayOfMonth: number, start: Date, end: Date): Date[] {
  const result: Date[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const date = new Date(Date.UTC(year, month, Math.min(dayOfMonth, lastDay)));
    if (date >= start && date <= end) result.push(date);
    cursor = new Date(Date.UTC(year, month + 1, 1));
  }
  return result;
}

function averageMonthlyExpense(
  transactions: Array<{ amount: { toString(): string } }>,
  monthCount: number
): string {
  const cents = transactions.reduce((sum, item) => sum + Math.round(Number(item.amount.toString()) * 100), 0);
  return ((cents / Math.max(1, monthCount)) / 100).toFixed(2);
}

function sumMoney(values: string[]): string {
  return (values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) / 100).toFixed(2);
}

function normalizeSignedMoney(value: number): string {
  const normalized = (Math.round(value * 100) / 100).toFixed(2);
  return normalized === "-0.00" ? "0.00" : normalized;
}

function money(value: { toString(): string } | string): string {
  return normalizeMoney(value.toString());
}

function cleanText(value: string | null | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function assertMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) throw new BadRequestException("月份格式必须为 YYYY-MM");
}

function monthStart(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber! - 1, 1));
}

function shiftMonth(month: string, offset: number): string {
  const date = monthStart(month);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.valueOf() + days * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
