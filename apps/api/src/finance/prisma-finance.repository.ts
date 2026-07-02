import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, Account as DbAccount, Budget as DbBudget, Category as DbCategory, FamilyMember, FinanceTransaction as DbTransaction, InvestmentHolding as DbHolding, Liability as DbLiability } from "@prisma/client";
import { normalizeMoney } from "@family-finance/shared";
import type {
  Account,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MoneyAmount
} from "@family-finance/shared";
import { PrismaService } from "../prisma.service";
import type {
  Category,
  CategoryInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateLiabilityInput,
  CreateTransactionInput,
  ImportTransactionsInput,
  MemberInput,
  RepayLiabilityInput
} from "./finance.types";
import type { FinanceRepository } from "./finance.repository";

const DEFAULT_FAMILY_ID = "default-family";
const DEFAULT_FAMILY_NAME = "我的家庭";

const defaultMembers = [
  { id: "member-husband", name: "丈夫" },
  { id: "member-wife", name: "妻子" },
  { id: "member-family", name: "家庭共同" }
] as const;

const defaultCategories = [
  { id: "category-mortgage", name: "房贷", kind: "expense" },
  { id: "category-food", name: "餐饮", kind: "expense" },
  { id: "category-transport", name: "交通", kind: "expense" },
  { id: "category-child", name: "育儿", kind: "expense" },
  { id: "category-shopping", name: "购物", kind: "expense" },
  { id: "category-salary", name: "工资", kind: "income" },
  { id: "category-investment", name: "投资收益", kind: "income" }
] as const;

@Injectable()
export class PrismaFinanceRepository implements FinanceRepository {
  private baseDataReady?: Promise<void>;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ensureBaseData(): Promise<void> {
    this.baseDataReady ??= this.createBaseData();
    await this.baseDataReady;
  }

  async listMembers(): Promise<string[]> {
    await this.ensureBaseData();
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: DEFAULT_FAMILY_ID },
      orderBy: { createdAt: "asc" }
    });
    return sortByDefaultMemberOrder(members).map((member) => member.name);
  }

  async listFamilyMembers(): Promise<FamilyMemberInfo[]> {
    await this.ensureBaseData();
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: DEFAULT_FAMILY_ID },
      orderBy: { createdAt: "asc" }
    });
    return sortByDefaultMemberOrder(members).map(mapMember);
  }

  async createMember(input: MemberInput): Promise<FamilyMemberInfo> {
    await this.ensureBaseData();
    const member = await this.prisma.familyMember.create({
      data: { familyId: DEFAULT_FAMILY_ID, name: input.name, icon: input.icon ?? null, role: "OWNER" }
    });
    return mapMember(member);
  }

  async updateMember(id: string, input: MemberInput): Promise<FamilyMemberInfo> {
    await this.ensureBaseData();
    const member = await this.prisma.familyMember.update({
      where: { id },
      data: { name: input.name, icon: input.icon ?? null }
    });
    return mapMember(member);
  }

  async deleteMember(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.familyMember.delete({ where: { id } });
  }

  async listCategories(): Promise<Category[]> {
    await this.ensureBaseData();
    const categories = await this.prisma.category.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, isActive: true },
      orderBy: { createdAt: "asc" }
    });
    return sortByDefaultCategoryOrder(categories).map(mapCategory);
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    await this.ensureBaseData();
    // Reactivate instead of failing if a same-name category was deactivated before.
    const category = await this.prisma.category.upsert({
      where: {
        familyId_name_kind: { familyId: DEFAULT_FAMILY_ID, name: input.name, kind: input.kind }
      },
      create: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.name,
        kind: input.kind,
        isDefault: false,
        isActive: true
      },
      update: { isActive: true }
    });
    return mapCategory(category);
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    await this.ensureBaseData();
    const category = await this.prisma.category.update({
      where: { id },
      data: { name: input.name, kind: input.kind }
    });
    return mapCategory(category);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  async listAccounts(): Promise<Account[]> {
    await this.ensureBaseData();
    const accounts = await this.prisma.account.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    return accounts.map(mapAccount);
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    await this.ensureBaseData();
    const account = await this.prisma.account.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        currentValue: normalizeMoney(input.currentValue),
        note: input.note
      }
    });
    await this.snapshotAccount(account.id, decimalToMoney(account.currentValue));
    return mapAccount(account);
  }

  async listAssetTrend(): Promise<AssetTrendPoint[]> {
    await this.ensureBaseData();
    const [snapshots, accounts] = await Promise.all([
      this.prisma.accountSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID },
        orderBy: { date: "asc" }
      }),
      this.prisma.account.findMany({ where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null } })
    ]);
    const liveIds = new Set(accounts.map((account) => account.id));
    const dates = [...new Set(snapshots.map((snapshot) => formatDate(snapshot.date)))];
    const latestCentsByAccount = new Map<string, number>();
    const points: AssetTrendPoint[] = [];
    let cursor = 0;
    for (const date of dates) {
      while (cursor < snapshots.length && formatDate(snapshots[cursor]!.date) === date) {
        const snapshot = snapshots[cursor]!;
        latestCentsByAccount.set(snapshot.accountId, moneyToCents(decimalToMoney(snapshot.value)));
        cursor += 1;
      }
      let totalCents = 0;
      for (const [accountId, cents] of latestCentsByAccount) {
        if (liveIds.has(accountId)) {
          totalCents += cents;
        }
      }
      points.push({ date, totalAssets: centsToMoney(totalCents) });
    }
    // Always anchor the series to today's live total so the chart matches the
    // dashboard metric, even for accounts created before snapshotting existed.
    const today = formatDate(startOfTodayUtc());
    const currentCents = accounts.reduce(
      (sum, account) => sum + moneyToCents(decimalToMoney(account.currentValue)),
      0
    );
    const todayPoint = points.find((point) => point.date === today);
    if (todayPoint) {
      todayPoint.totalAssets = centsToMoney(currentCents);
    } else {
      points.push({ date: today, totalAssets: centsToMoney(currentCents) });
    }
    return points;
  }

  private async snapshotAccount(accountId: string, value: MoneyAmount): Promise<void> {
    const date = startOfTodayUtc();
    await this.prisma.accountSnapshot.upsert({
      where: { accountId_date: { accountId, date } },
      create: { familyId: DEFAULT_FAMILY_ID, accountId, date, value: normalizeMoney(value) },
      update: { value: normalizeMoney(value) }
    });
  }

  async listTransactions(filter: { month?: string } = {}): Promise<FinanceTransaction[]> {
    await this.ensureBaseData();
    const dateWhere = filter.month ? monthDateWhere(filter.month) : {};
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        ...dateWhere
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    });
    return transactions.map(mapTransaction);
  }

  // Transactions are an independent ledger: by product decision they do NOT
  // adjust account balances (account values are maintained manually).
  async createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
    await this.ensureBaseData();
    if (input.accountId) {
      await this.prisma.account.findFirstOrThrow({
        where: { id: input.accountId, familyId: DEFAULT_FAMILY_ID, deletedAt: null }
      });
    }
    const category = await this.prisma.category.findFirst({
      where: { familyId: DEFAULT_FAMILY_ID, name: input.categoryName, kind: input.kind }
    });
    const transaction = await this.prisma.financeTransaction.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        accountId: input.accountId ?? null,
        categoryId: category?.id,
        date: parseDate(input.date),
        kind: input.kind,
        categoryName: input.categoryName,
        memberName: input.memberName,
        amount: normalizeMoney(input.amount),
        note: input.note
      }
    });
    return mapTransaction(transaction);
  }

  async listBudgets(month?: string): Promise<Budget[]> {
    await this.ensureBaseData();
    const budgets = await this.prisma.budget.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        ...(month ? { month } : {})
      },
      orderBy: { createdAt: "asc" }
    });
    return budgets.map(mapBudget);
  }

  async createBudget(input: CreateBudgetInput): Promise<Budget> {
    await this.ensureBaseData();
    const category = await this.prisma.category.findFirst({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.categoryName,
        kind: "expense"
      }
    });
    const budget = await this.prisma.budget.upsert({
      where: {
        familyId_month_categoryName: {
          familyId: DEFAULT_FAMILY_ID,
          month: input.month,
          categoryName: input.categoryName
        }
      },
      create: {
        familyId: DEFAULT_FAMILY_ID,
        categoryId: category?.id,
        month: input.month,
        categoryName: input.categoryName,
        limitAmount: normalizeMoney(input.limitAmount)
      },
      update: {
        categoryId: category?.id,
        limitAmount: normalizeMoney(input.limitAmount)
      }
    });
    return mapBudget(budget);
  }

  async listHoldings(): Promise<InvestmentHolding[]> {
    await this.ensureBaseData();
    const holdings = await this.prisma.investmentHolding.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    return holdings.map(mapHolding);
  }

  async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    await this.ensureBaseData();
    const holding = await this.prisma.investmentHolding.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        accountId: input.accountId,
        name: input.name,
        code: input.code,
        type: input.type,
        marketValue: normalizeMoney(input.marketValue),
        profit: normalizeMoney(input.profit),
        note: input.note
      }
    });
    return mapHolding(holding);
  }

  async listLiabilities(): Promise<Liability[]> {
    await this.ensureBaseData();
    const liabilities = await this.prisma.liability.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    return liabilities.map(mapLiability);
  }

  async createLiability(input: CreateLiabilityInput): Promise<Liability> {
    await this.ensureBaseData();
    const liability = await this.prisma.liability.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        currentBalance: normalizeMoney(input.currentBalance),
        monthlyPayment:
          input.monthlyPayment === undefined ? null : normalizeMoney(input.monthlyPayment),
        paymentDay: input.paymentDay ?? null,
        remainingPeriods: input.remainingPeriods ?? null,
        lender: input.lender,
        status: input.status ?? "active",
        note: input.note
      }
    });
    return mapLiability(liability);
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
    await this.ensureBaseData();
    const account = await this.prisma.account.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        currentValue: normalizeMoney(input.currentValue),
        note: input.note ?? null
      }
    });
    return mapAccount(account);
  }

  async snapshotAllAccounts(): Promise<{ date: string; count: number }> {
    await this.ensureBaseData();
    const accounts = await this.prisma.account.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null }
    });
    for (const account of accounts) {
      await this.snapshotAccount(account.id, decimalToMoney(account.currentValue));
    }
    return { date: formatDate(startOfTodayUtc()), count: accounts.length };
  }

  async listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]> {
    await this.ensureBaseData();
    const snapshots = await this.prisma.accountSnapshot.findMany({
      where: { accountId, familyId: DEFAULT_FAMILY_ID },
      orderBy: { date: "asc" }
    });
    return snapshots.map((s) => ({ date: formatDate(s.date), value: decimalToMoney(s.value) }));
  }

  async deleteAccount(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Note: by product decision, editing/deleting a transaction does NOT re-adjust
  // the account balance (only createTransaction moves balances).
  async updateTransaction(id: string, input: CreateTransactionInput): Promise<FinanceTransaction> {
    await this.ensureBaseData();
    const category = await this.prisma.category.findFirst({
      where: { familyId: DEFAULT_FAMILY_ID, name: input.categoryName, kind: input.kind }
    });
    const transaction = await this.prisma.financeTransaction.update({
      where: { id },
      data: {
        accountId: input.accountId ?? null,
        categoryId: category?.id ?? null,
        date: parseDate(input.date),
        kind: input.kind,
        categoryName: input.categoryName,
        memberName: input.memberName,
        amount: normalizeMoney(input.amount),
        note: input.note ?? null
      }
    });
    return mapTransaction(transaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.financeTransaction.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Bulk import (e.g. an Alipay bill). Missing expense/income categories are
  // created on the fly so the imported categories become reusable.
  async importTransactions(input: ImportTransactionsInput): Promise<{ imported: number }> {
    await this.ensureBaseData();
    const imported = await this.prisma.$transaction(async (tx) => {
      if (input.accountId) {
        await tx.account.findFirstOrThrow({
          where: { id: input.accountId, familyId: DEFAULT_FAMILY_ID, deletedAt: null }
        });
      }
      let count = 0;
      for (const item of input.items) {
        let categoryId: string | undefined;
        if (item.kind === "expense" || item.kind === "income") {
          const category = await tx.category.upsert({
            where: {
              familyId_name_kind: {
                familyId: DEFAULT_FAMILY_ID,
                name: item.categoryName,
                kind: item.kind
              }
            },
            create: {
              familyId: DEFAULT_FAMILY_ID,
              name: item.categoryName,
              kind: item.kind,
              isDefault: false,
              isActive: true
            },
            update: { isActive: true }
          });
          categoryId = category.id;
        }
        await tx.financeTransaction.create({
          data: {
            familyId: DEFAULT_FAMILY_ID,
            accountId: input.accountId ?? null,
            categoryId,
            date: parseDate(item.date),
            kind: item.kind,
            categoryName: item.categoryName,
            memberName: input.memberName,
            amount: normalizeMoney(item.amount),
            note: item.note
          }
        });
        count += 1;
      }
      return count;
    });
    return { imported };
  }

  async updateBudget(id: string, input: CreateBudgetInput): Promise<Budget> {
    await this.ensureBaseData();
    const category = await this.prisma.category.findFirst({
      where: { familyId: DEFAULT_FAMILY_ID, name: input.categoryName, kind: "expense" }
    });
    const budget = await this.prisma.budget.update({
      where: { id },
      data: {
        categoryId: category?.id ?? null,
        month: input.month,
        categoryName: input.categoryName,
        limitAmount: normalizeMoney(input.limitAmount)
      }
    });
    return mapBudget(budget);
  }

  async deleteBudget(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.budget.delete({ where: { id } });
  }

  async updateHolding(id: string, input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    await this.ensureBaseData();
    const holding = await this.prisma.investmentHolding.update({
      where: { id },
      data: {
        accountId: input.accountId,
        name: input.name,
        code: input.code,
        type: input.type,
        marketValue: normalizeMoney(input.marketValue),
        profit: normalizeMoney(input.profit),
        note: input.note ?? null
      }
    });
    return mapHolding(holding);
  }

  async deleteHolding(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.investmentHolding.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateLiability(id: string, input: CreateLiabilityInput): Promise<Liability> {
    await this.ensureBaseData();
    const liability = await this.prisma.liability.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        currentBalance: normalizeMoney(input.currentBalance),
        monthlyPayment:
          input.monthlyPayment === undefined ? null : normalizeMoney(input.monthlyPayment),
        paymentDay: input.paymentDay ?? null,
        remainingPeriods: input.remainingPeriods ?? null,
        lender: input.lender ?? null,
        status: input.status ?? "active",
        note: input.note ?? null
      }
    });
    return mapLiability(liability);
  }

  // A repayment reduces the outstanding balance (clamped at 0) and, when set,
  // decrements the remaining periods. Reaching zero balance/periods settles it.
  async repayLiability(id: string, input: RepayLiabilityInput): Promise<Liability> {
    await this.ensureBaseData();
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.liability.findFirstOrThrow({
        where: { id, familyId: DEFAULT_FAMILY_ID, deletedAt: null }
      });
      const balanceCents = Math.max(
        0,
        moneyToCents(decimalToMoney(current.currentBalance)) - moneyToCents(normalizeMoney(input.amount))
      );
      const remaining =
        current.remainingPeriods === null ? null : Math.max(0, current.remainingPeriods - 1);
      const settled = balanceCents === 0 || remaining === 0;
      return tx.liability.update({
        where: { id },
        data: {
          currentBalance: centsToMoney(balanceCents),
          remainingPeriods: remaining,
          status: settled ? "paidOff" : current.status
        }
      });
    });
    return mapLiability(updated);
  }

  async deleteLiability(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.liability.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async createBaseData(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.family.upsert({
        where: { id: DEFAULT_FAMILY_ID },
        update: { name: DEFAULT_FAMILY_NAME },
        create: { id: DEFAULT_FAMILY_ID, name: DEFAULT_FAMILY_NAME }
      });

      // Only seed defaults into an empty family. Once a family has members /
      // categories, the user owns them — adds, renames and deletes must persist
      // across restarts and never be resurrected by re-seeding.
      const memberCount = await tx.familyMember.count({ where: { familyId: DEFAULT_FAMILY_ID } });
      if (memberCount === 0) {
        await tx.familyMember.createMany({
          data: defaultMembers.map((member) => ({
            id: member.id,
            familyId: DEFAULT_FAMILY_ID,
            name: member.name,
            role: "OWNER"
          }))
        });
      }

      const categoryCount = await tx.category.count({ where: { familyId: DEFAULT_FAMILY_ID } });
      if (categoryCount === 0) {
        await tx.category.createMany({
          data: defaultCategories.map((category) => ({
            id: category.id,
            familyId: DEFAULT_FAMILY_ID,
            name: category.name,
            kind: category.kind,
            isDefault: true,
            isActive: true
          }))
        });
      }
    });
  }
}

function mapAccount(account: DbAccount): Account {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    ownerName: account.ownerName,
    currentValue: decimalToMoney(account.currentValue),
    note: account.note ?? undefined,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

function mapTransaction(transaction: DbTransaction): FinanceTransaction {
  return {
    id: transaction.id,
    date: formatDate(transaction.date),
    kind: transaction.kind,
    categoryName: transaction.categoryName,
    accountId: transaction.accountId ?? undefined,
    memberName: transaction.memberName,
    amount: decimalToMoney(transaction.amount),
    note: transaction.note ?? undefined
  };
}

function mapBudget(budget: DbBudget): Budget {
  return {
    id: budget.id,
    month: budget.month,
    categoryName: budget.categoryName,
    limitAmount: decimalToMoney(budget.limitAmount)
  };
}

function mapHolding(holding: DbHolding): InvestmentHolding {
  return {
    id: holding.id,
    name: holding.name,
    code: holding.code,
    type: holding.type,
    accountId: holding.accountId,
    marketValue: decimalToMoney(holding.marketValue),
    profit: decimalToMoney(holding.profit),
    note: holding.note ?? undefined
  };
}

function mapLiability(liability: DbLiability): Liability {
  return {
    id: liability.id,
    name: liability.name,
    type: liability.type,
    ownerName: liability.ownerName,
    currentBalance: decimalToMoney(liability.currentBalance),
    monthlyPayment:
      liability.monthlyPayment === null ? undefined : decimalToMoney(liability.monthlyPayment),
    paymentDay: liability.paymentDay ?? undefined,
    remainingPeriods: liability.remainingPeriods ?? undefined,
    lender: liability.lender ?? undefined,
    status: liability.status,
    note: liability.note ?? undefined
  };
}

function mapCategory(category: DbCategory): Category {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    isDefault: category.isDefault,
    isActive: category.isActive
  };
}

function mapMember(member: FamilyMember): FamilyMemberInfo {
  return { id: member.id, name: member.name, icon: member.icon ?? undefined };
}

function sortByDefaultMemberOrder(members: FamilyMember[]): FamilyMember[] {
  const rank = new Map<string, number>(defaultMembers.map((member, index) => [member.name, index]));
  return [...members].sort((left, right) => (rank.get(left.name) ?? 99) - (rank.get(right.name) ?? 99));
}

function sortByDefaultCategoryOrder(categories: DbCategory[]): DbCategory[] {
  const rank = new Map<string, number>(defaultCategories.map((category, index) => [category.name, index]));
  return [...categories].sort((left, right) => (rank.get(left.name) ?? 99) - (rank.get(right.name) ?? 99));
}

function decimalToMoney(value: Prisma.Decimal): MoneyAmount {
  return normalizeMoney(value.toString());
}

function moneyToCents(value: MoneyAmount): number {
  const trimmed = value.trim();
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const [integerPart = "0", fractionPart = ""] = trimmed.replace(/^[+-]/, "").split(".");
  return sign * (Number.parseInt(integerPart, 10) * 100 + Number.parseInt(`${fractionPart}00`.slice(0, 2), 10));
}

function centsToMoney(cents: number): MoneyAmount {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function monthDateWhere(month: string): { date: { gte: Date; lt: Date } } {
  const [yearPart = "1970", monthPart = "1"] = month.split("-");
  const year = Number.parseInt(yearPart, 10);
  const monthIndex = Number.parseInt(monthPart, 10) - 1;
  return {
    date: {
      gte: new Date(Date.UTC(year, monthIndex, 1)),
      lt: new Date(Date.UTC(year, monthIndex + 1, 1))
    }
  };
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}
