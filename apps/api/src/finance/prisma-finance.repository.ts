import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, Account as DbAccount, AccountTypeOption as DbAccountTypeOption, Budget as DbBudget, Category as DbCategory, CategoryMapping as DbCategoryMapping, FamilyMember, FinanceTransaction as DbTransaction, InvestmentHolding as DbHolding, Liability as DbLiability } from "@prisma/client";
import { normalizeMoney } from "@family-finance/shared";
import type {
  Account,
  AccountSnapshotRecord,
  AccountTypeOption,
  AssetTrendPoint,
  Budget,
  FamilyMemberInfo,
  FinanceTransaction,
  InvestmentHolding,
  Liability,
  MonthlyReviewStatus,
  MonthlySnapshotData,
  MoneyAmount
} from "@family-finance/shared";
import { PrismaService } from "../prisma.service";
import type {
  AccountTypeInput,
  Category,
  CategoryMapping,
  CategoryMappingInput,
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
import { expenseCategoryDefinitions, incomeCategoryDefinitions } from "./category-rules";
import { defaultCategoryMappings } from "./default-category-mappings";
import type { YearlySnapshotInput } from "./yearly-report";

const DEFAULT_FAMILY_ID = "default-family";
const DEFAULT_FAMILY_NAME = "我的家庭";

const defaultMembers = [
  { id: "member-husband", name: "丈夫" },
  { id: "member-wife", name: "妻子" }
] as const;

const defaultAccountTypes = [
  { id: "account-type-bank-card", name: "银行卡" },
  { id: "account-type-cash", name: "现金" },
  { id: "account-type-alipay", name: "支付宝" },
  { id: "account-type-wechat", name: "微信" },
  { id: "account-type-fund", name: "基金" },
  { id: "account-type-stock", name: "股票" },
  { id: "account-type-other", name: "其他" }
] as const;

const defaultCategories = [
  ...expenseCategoryDefinitions.map((category, index) => ({
    id: `category-expense-${index + 1}`,
    ...category,
    kind: "expense" as const
  })),
  ...incomeCategoryDefinitions.map((category, index) => ({
    id: `category-income-${index + 1}`,
    ...category,
    kind: "income" as const
  }))
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

  async listAccountTypes(): Promise<AccountTypeOption[]> {
    await this.ensureBaseData();
    const [accountTypes, accounts] = await Promise.all([
      this.prisma.accountTypeOption.findMany({
        where: { familyId: DEFAULT_FAMILY_ID },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.account.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
        select: { type: true }
      })
    ]);
    const known = new Set(accountTypes.map((type) => type.name));
    const missingAccountTypes = [...new Set(accounts.map((account) => account.type))]
      .filter((name) => name && !known.has(name))
      .map((name) => ({
        id: `account-type-derived-${name}`,
        name,
        isDefault: false,
        isActive: true
      }));
    return sortByDefaultAccountTypeOrder([
      ...accountTypes.filter((type) => type.isActive).map(mapAccountType),
      ...missingAccountTypes
    ]);
  }

  async createAccountType(input: AccountTypeInput): Promise<AccountTypeOption> {
    await this.ensureBaseData();
    const name = normalizeAccountTypeName(input.name);
    const accountType = await this.prisma.accountTypeOption.upsert({
      where: { familyId_name: { familyId: DEFAULT_FAMILY_ID, name } },
      create: { familyId: DEFAULT_FAMILY_ID, name, isDefault: false, isActive: true },
      update: { isActive: true }
    });
    return mapAccountType(accountType);
  }

  async updateAccountType(id: string, input: AccountTypeInput): Promise<AccountTypeOption> {
    await this.ensureBaseData();
    const accountType = await this.prisma.accountTypeOption.update({
      where: { id },
      data: { name: normalizeAccountTypeName(input.name) }
    });
    return mapAccountType(accountType);
  }

  async deleteAccountType(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.accountTypeOption.update({ where: { id }, data: { isActive: false } });
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
        note: input.note,
        isDefault: false,
        isActive: true
      },
      update: { isActive: true, note: input.note }
    });
    return mapCategory(category);
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    await this.ensureBaseData();
    const category = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: { name: input.name, kind: input.kind, note: input.note ?? null }
      });
      await Promise.all([
        tx.financeTransaction.updateMany({
          where: { familyId: DEFAULT_FAMILY_ID, categoryId: id },
          data: { categoryName: input.name }
        }),
        tx.budget.updateMany({
          where: { familyId: DEFAULT_FAMILY_ID, categoryId: id },
          data: { categoryName: input.name }
        })
      ]);
      return updated;
    });
    return mapCategory(category);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  async listCategoryMappings(): Promise<CategoryMapping[]> {
    await this.ensureBaseData();
    const mappings = await this.prisma.categoryMapping.findMany({
      where: { familyId: DEFAULT_FAMILY_ID },
      include: { targetCategory: { select: { name: true } } },
      orderBy: [{ source: "asc" }, { kind: "asc" }, { sourceCategory: "asc" }]
    });
    return mappings.map(mapCategoryMapping);
  }

  async createCategoryMapping(input: CategoryMappingInput): Promise<CategoryMapping> {
    await this.ensureBaseData();
    const mapping = await this.prisma.categoryMapping.upsert({
      where: {
        familyId_source_kind_sourceCategory: {
          familyId: DEFAULT_FAMILY_ID,
          source: input.source,
          kind: input.kind,
          sourceCategory: input.sourceCategory
        }
      },
      create: { familyId: DEFAULT_FAMILY_ID, ...input },
      update: { targetCategoryId: input.targetCategoryId },
      include: { targetCategory: { select: { name: true } } }
    });
    return mapCategoryMapping(mapping);
  }

  async updateCategoryMapping(id: string, input: CategoryMappingInput): Promise<CategoryMapping> {
    await this.ensureBaseData();
    const mapping = await this.prisma.categoryMapping.update({
      where: { id },
      data: input,
      include: { targetCategory: { select: { name: true } } }
    });
    return mapCategoryMapping(mapping);
  }

  async deleteCategoryMapping(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.categoryMapping.delete({ where: { id } });
  }

  async listAccounts(): Promise<Account[]> {
    await this.ensureBaseData();
    const accounts = await this.prisma.account.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });
    return accounts.map(mapAccount);
  }

  async listAccountsForMonth(month: string): Promise<Account[]> {
    await this.ensureBaseData();
    if (isCurrentMonth(month)) return this.listAccounts();
    const monthEnd = nextMonthStart(month);
    const [accounts, snapshots] = await Promise.all([
      this.prisma.account.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null, createdAt: { lt: monthEnd } },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.accountSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, date: { lt: monthEnd } },
        orderBy: { date: "asc" }
      })
    ]);
    const latestByAccount = new Map(snapshots.map((snapshot) => [snapshot.accountId, snapshot]));
    return accounts.map((account) => {
      const snapshot = latestByAccount.get(account.id);
      return { ...mapAccount(account), currentValue: snapshot ? decimalToMoney(snapshot.value) : decimalToMoney(account.currentValue) };
    });
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    await this.ensureBaseData();
    const account = await this.prisma.account.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.name,
        type: normalizeLegacyAccountType(input.type),
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

  private async snapshotAccount(accountId: string, value: MoneyAmount, date = startOfTodayUtc()): Promise<void> {
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
      include: { category: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    });
    return transactions.map(mapTransaction);
  }

  async listTransactionsForYear(year: string): Promise<FinanceTransaction[]> {
    await this.ensureBaseData();
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        date: { gte: start, lt: end }
      },
      include: { category: { select: { name: true } } },
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
        note: input.note,
        source: "manual",
        confirmedAt: new Date()
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

  async listHoldingsForMonth(month: string): Promise<InvestmentHolding[]> {
    await this.ensureBaseData();
    if (isCurrentMonth(month)) return this.listHoldings();
    const [holdings, snapshots] = await Promise.all([
      this.prisma.investmentHolding.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null, createdAt: { lt: nextMonthStart(month) } },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.investmentSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month }
      })
    ]);
    const snapshotByHolding = new Map(snapshots.map((snapshot) => [snapshot.holdingId, snapshot]));
    return holdings.map((holding) => {
      const snapshot = snapshotByHolding.get(holding.id);
      if (!snapshot) return mapHolding(holding);
      const marketValue = decimalToMoney(snapshot.marketValue);
      const investedAmount = decimalToMoney(snapshot.investedAmount);
      return {
        ...mapHolding(holding),
        marketValue,
        investedAmount,
        profit: centsToMoney(moneyToCents(marketValue) - moneyToCents(investedAmount))
      };
    });
  }

  async createHolding(input: CreateInvestmentHoldingInput): Promise<InvestmentHolding> {
    await this.ensureBaseData();
    const holding = await this.prisma.$transaction(async (tx) => {
      const created = await tx.investmentHolding.create({
        data: {
          familyId: DEFAULT_FAMILY_ID,
          accountId: input.accountId,
          name: input.name,
          code: input.code?.trim() ?? "",
          type: input.type,
          marketValue: normalizeMoney(input.marketValue),
          investedAmount: normalizeMoney(input.investedAmount ?? investmentCost(input)),
          profit: normalizeMoney(input.profit),
          note: input.note
        }
      });
      await syncInvestmentAccountValue(tx, input.accountId);
      return created;
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

  async listLiabilitiesForMonth(month: string): Promise<Liability[]> {
    await this.ensureBaseData();
    if (isCurrentMonth(month)) return this.listLiabilities();
    const [liabilities, snapshots] = await Promise.all([
      this.prisma.liability.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null, createdAt: { lt: nextMonthStart(month) } },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.liabilitySnapshot.findMany({ where: { familyId: DEFAULT_FAMILY_ID, month } })
    ]);
    const snapshotByLiability = new Map(snapshots.map((snapshot) => [snapshot.liabilityId, snapshot]));
    return liabilities.map((liability) => {
      const snapshot = snapshotByLiability.get(liability.id);
      if (!snapshot) return mapLiability(liability);
      return {
        ...mapLiability(liability),
        currentBalance: decimalToMoney(snapshot.currentBalance),
        monthlyPayment: snapshot.monthlyPayment === null ? undefined : decimalToMoney(snapshot.monthlyPayment),
        remainingPeriods: snapshot.remainingPeriods ?? undefined
      };
    });
  }

  async createLiability(input: CreateLiabilityInput): Promise<Liability> {
    await this.ensureBaseData();
    const liability = await this.prisma.liability.create({
      data: {
        familyId: DEFAULT_FAMILY_ID,
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        initialBalance: normalizeMoney(input.initialBalance ?? input.currentBalance),
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
        type: normalizeLegacyAccountType(input.type),
        ownerName: input.ownerName,
        currentValue: normalizeMoney(input.currentValue),
        note: input.note ?? null
      }
    });
    return mapAccount(account);
  }

  async snapshotAllAccounts(month?: string): Promise<{ date: string; count: number }> {
    await this.ensureBaseData();
    const accounts = await this.prisma.account.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        ...(month ? { createdAt: { lt: nextMonthStart(month) } } : {})
      }
    });
    const date = month ? monthSnapshotDate(month) : startOfTodayUtc();
    await Promise.all(
      accounts.map((account) => this.snapshotAccount(account.id, decimalToMoney(account.currentValue), date))
    );
    if (month) {
      await this.prisma.monthlyReview.upsert({
        where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
        create: { familyId: DEFAULT_FAMILY_ID, month, assetsConfirmedAt: new Date() },
        update: { assetsConfirmedAt: new Date() }
      });
    }
    return { date: formatDate(date), count: accounts.length };
  }

  async listAccountSnapshots(accountId: string): Promise<{ date: string; value: MoneyAmount }[]> {
    await this.ensureBaseData();
    const snapshots = await this.prisma.accountSnapshot.findMany({
      where: { accountId, familyId: DEFAULT_FAMILY_ID },
      orderBy: { date: "asc" }
    });
    return snapshots.map((s) => ({ date: formatDate(s.date), value: decimalToMoney(s.value) }));
  }

  async listAllSnapshots(filter?: { accountId?: string; from?: string; to?: string }): Promise<AccountSnapshotRecord[]> {
    await this.ensureBaseData();
    const where: Prisma.AccountSnapshotWhereInput = { familyId: DEFAULT_FAMILY_ID };
    if (filter?.accountId) where.accountId = filter.accountId;
    if (filter?.from || filter?.to) {
      where.date = {};
      if (filter?.from) where.date.gte = parseDate(filter.from);
      if (filter?.to) where.date.lte = parseDate(filter.to);
    }
    const [snapshots, accounts] = await Promise.all([
      this.prisma.accountSnapshot.findMany({ where, orderBy: { date: "asc" } }),
      this.prisma.account.findMany({ where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null } })
    ]);
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return snapshots
      .map((s): AccountSnapshotRecord | null => {
        const account = accountById.get(s.accountId);
        if (!account) return null;
        return {
          id: s.id,
          accountId: s.accountId,
          accountName: account.name,
          ownerName: account.ownerName,
          date: formatDate(s.date),
          value: decimalToMoney(s.value)
        };
      })
      .filter((r): r is AccountSnapshotRecord => r !== null);
  }

  async deleteSnapshot(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.accountSnapshot.delete({ where: { id } });
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
        note: input.note ?? null,
        confirmedAt: new Date()
      }
    });
    return mapTransaction(transaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.financeTransaction.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async confirmTransaction(id: string): Promise<FinanceTransaction> {
    await this.ensureBaseData();
    const transaction = await this.prisma.financeTransaction.update({
      where: { id },
      data: { confirmedAt: new Date() }
    });
    return mapTransaction(transaction);
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
        let categoryName = item.categoryName;
        if (item.kind === "expense" || item.kind === "income") {
          const category = await tx.category.findFirst({
            where: {
              familyId: DEFAULT_FAMILY_ID,
              name: item.categoryName,
              kind: item.kind,
              isActive: true
            }
          });
          const fallback = category ?? await tx.category.findFirstOrThrow({
            where: {
              familyId: DEFAULT_FAMILY_ID,
              name: item.kind === "expense" ? "待分类支出" : "待分类收入",
              kind: item.kind,
              isActive: true
            }
          });
          categoryId = fallback.id;
          categoryName = fallback.name;
        }
        await tx.financeTransaction.create({
          data: {
            familyId: DEFAULT_FAMILY_ID,
            accountId: input.accountId ?? null,
            categoryId,
            date: parseDate(item.date),
            kind: item.kind,
            categoryName,
            memberName: input.memberName,
            amount: normalizeMoney(item.amount),
            note: item.note,
            source: input.source,
            sourceCategory: item.sourceCategory ?? item.categoryName,
            confirmedAt: null
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
    const holding = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.investmentHolding.findUniqueOrThrow({
        where: { id },
        select: { accountId: true }
      });
      const updated = await tx.investmentHolding.update({
        where: { id },
        data: {
          accountId: input.accountId,
          name: input.name,
          code: input.code?.trim() ?? "",
          type: input.type,
          marketValue: normalizeMoney(input.marketValue),
          investedAmount: normalizeMoney(input.investedAmount ?? investmentCost(input)),
          profit: normalizeMoney(input.profit),
          note: input.note ?? null
        }
      });
      await syncInvestmentAccountValue(tx, previous.accountId);
      if (input.accountId !== previous.accountId) {
        await syncInvestmentAccountValue(tx, input.accountId);
      }
      return updated;
    });
    return mapHolding(holding);
  }

  async deleteHolding(id: string): Promise<void> {
    await this.ensureBaseData();
    await this.prisma.$transaction(async (tx) => {
      const holding = await tx.investmentHolding.findUniqueOrThrow({
        where: { id },
        select: { accountId: true }
      });
      await tx.investmentHolding.update({ where: { id }, data: { deletedAt: new Date() } });
      await syncInvestmentAccountValue(tx, holding.accountId);
    });
  }

  async snapshotAllInvestments(month: string): Promise<{ month: string; count: number }> {
    await this.ensureBaseData();
    const holdings = await this.prisma.investmentHolding.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        createdAt: { lt: nextMonthStart(month) }
      }
    });
    await this.prisma.$transaction(async (tx) => {
      for (const holding of holdings) {
        const investedAmount = holding.investedAmount ?? holding.marketValue.minus(holding.profit);
        await tx.investmentSnapshot.upsert({
          where: { holdingId_month: { holdingId: holding.id, month } },
          create: {
            familyId: DEFAULT_FAMILY_ID,
            holdingId: holding.id,
            month,
            investedAmount,
            marketValue: holding.marketValue
          },
          update: { investedAmount, marketValue: holding.marketValue, confirmedAt: new Date() }
        });
      }
      await tx.monthlyReview.upsert({
        where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
        create: { familyId: DEFAULT_FAMILY_ID, month, investmentsConfirmedAt: new Date() },
        update: { investmentsConfirmedAt: new Date() }
      });
    });
    return { month, count: holdings.length };
  }

  async updateLiability(id: string, input: CreateLiabilityInput): Promise<Liability> {
    await this.ensureBaseData();
    const liability = await this.prisma.liability.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        ownerName: input.ownerName,
        ...(input.initialBalance === undefined ? {} : { initialBalance: normalizeMoney(input.initialBalance) }),
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


  async snapshotAllLiabilities(month: string): Promise<{ month: string; count: number }> {
    await this.ensureBaseData();
    const liabilities = await this.prisma.liability.findMany({
      where: {
        familyId: DEFAULT_FAMILY_ID,
        deletedAt: null,
        createdAt: { lt: nextMonthStart(month) }
      }
    });
    await this.prisma.$transaction(async (tx) => {
      for (const liability of liabilities) {
        await tx.liabilitySnapshot.upsert({
          where: { liabilityId_month: { liabilityId: liability.id, month } },
          create: {
            familyId: DEFAULT_FAMILY_ID,
            liabilityId: liability.id,
            month,
            currentBalance: liability.currentBalance,
            monthlyPayment: liability.monthlyPayment,
            remainingPeriods: liability.remainingPeriods
          },
          update: {
            currentBalance: liability.currentBalance,
            monthlyPayment: liability.monthlyPayment,
            remainingPeriods: liability.remainingPeriods,
            confirmedAt: new Date()
          }
        });
      }
      await tx.monthlyReview.upsert({
        where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
        create: { familyId: DEFAULT_FAMILY_ID, month, liabilitiesConfirmedAt: new Date() },
        update: { liabilitiesConfirmedAt: new Date() }
      });
    });
    return { month, count: liabilities.length };
  }

  async getMonthlyReview(month: string): Promise<MonthlyReviewStatus> {
    await this.ensureBaseData();
    const review = await this.prisma.monthlyReview.findUnique({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } }
    });
    return {
      month,
      spending: Boolean(review?.spendingConfirmedAt),
      assets: Boolean(review?.assetsConfirmedAt),
      liabilities: Boolean(review?.liabilitiesConfirmedAt),
      investments: Boolean(review?.investmentsConfirmedAt)
    };
  }

  async getMonthlySnapshot(month: string): Promise<MonthlySnapshotData> {
    await this.ensureBaseData();
    const previous = previousMonth(month);
    const currentDate = monthSnapshotDate(month);
    const previousDate = monthSnapshotDate(previous);
    const [
      assets,
      previousAssets,
      liabilities,
      previousLiabilities,
      investments,
      previousInvestments,
      review
    ] = await Promise.all([
      this.prisma.accountSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, date: currentDate },
        include: { account: { select: { name: true, type: true, ownerName: true } } }
      }),
      this.prisma.accountSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, date: previousDate },
        include: { account: { select: { name: true, type: true, ownerName: true } } }
      }),
      this.prisma.liabilitySnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month },
        include: { liability: { select: { name: true, ownerName: true } } }
      }),
      this.prisma.liabilitySnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month: previous },
        include: { liability: { select: { name: true, ownerName: true } } }
      }),
      this.prisma.investmentSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month },
        include: {
          holding: {
            select: { name: true, code: true, account: { select: { name: true } } }
          }
        }
      }),
      this.prisma.investmentSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month: previous },
        include: {
          holding: {
            select: { name: true, code: true, account: { select: { name: true } } }
          }
        }
      }),
      this.prisma.monthlyReview.findUnique({
        where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } }
      })
    ]);

    const previousAssetById = new Map(previousAssets.map((item) => [item.accountId, decimalToMoney(item.value)]));
    const previousLiabilityById = new Map(
      previousLiabilities.map((item) => [item.liabilityId, decimalToMoney(item.currentBalance)])
    );
    const previousInvestmentById = new Map(
      previousInvestments.map((item) => [item.holdingId, decimalToMoney(item.marketValue)])
    );

    const assetItems = assets.map((item) => {
      const value = decimalToMoney(item.value);
      const previousValue = previousAssetById.get(item.accountId);
      return {
        accountId: item.accountId,
        accountName: item.account.name,
        accountType: item.account.type,
        ownerName: item.account.ownerName,
        value,
        ...(previousValue === undefined ? {} : { change: subtractMoney(value, previousValue) })
      };
    });
    const liabilityItems = liabilities.map((item) => {
      const currentBalance = decimalToMoney(item.currentBalance);
      const previousValue = previousLiabilityById.get(item.liabilityId);
      return {
        liabilityId: item.liabilityId,
        liabilityName: item.liability.name,
        ownerName: item.liability.ownerName,
        currentBalance,
        ...(item.monthlyPayment === null ? {} : { monthlyPayment: decimalToMoney(item.monthlyPayment) }),
        ...(item.remainingPeriods === null ? {} : { remainingPeriods: item.remainingPeriods }),
        ...(previousValue === undefined ? {} : { change: subtractMoney(currentBalance, previousValue) })
      };
    });
    const investmentItems = investments.map((item) => {
      const investedAmount = decimalToMoney(item.investedAmount);
      const marketValue = decimalToMoney(item.marketValue);
      const profit = subtractMoney(marketValue, investedAmount);
      const investedCents = moneyToCents(investedAmount);
      const previousValue = previousInvestmentById.get(item.holdingId);
      return {
        holdingId: item.holdingId,
        holdingName: item.holding.name,
        code: item.holding.code,
        accountName: item.holding.account.name,
        investedAmount,
        marketValue,
        profit,
        returnRate: investedCents === 0 ? 0 : Math.round((moneyToCents(profit) / investedCents) * 10000) / 100,
        ...(previousValue === undefined ? {} : { change: subtractMoney(marketValue, previousValue) })
      };
    });

    const totalAssets = sumMoney(assetItems.map((item) => item.value));
    const totalLiabilities = sumMoney(liabilityItems.map((item) => item.currentBalance));
    const investmentMarketValue = sumMoney(investmentItems.map((item) => item.marketValue));
    const investmentInvested = sumMoney(investmentItems.map((item) => item.investedAmount));
    const netAssets = subtractMoney(totalAssets, totalLiabilities);
    const previousNetAssets = subtractMoney(
      sumMoney(previousAssets.map((item) => decimalToMoney(item.value))),
      sumMoney(previousLiabilities.map((item) => decimalToMoney(item.currentBalance)))
    );
    const hasPrevious = previousAssets.length > 0 || previousLiabilities.length > 0 || previousInvestments.length > 0;

    return {
      month,
      review: {
        month,
        spending: Boolean(review?.spendingConfirmedAt),
        assets: Boolean(review?.assetsConfirmedAt),
        liabilities: Boolean(review?.liabilitiesConfirmedAt),
        investments: Boolean(review?.investmentsConfirmedAt)
      },
      summary: {
        totalAssets,
        totalLiabilities,
        netAssets,
        investmentMarketValue,
        investmentProfit: subtractMoney(investmentMarketValue, investmentInvested),
        ...(hasPrevious ? { netAssetsChange: subtractMoney(netAssets, previousNetAssets) } : {})
      },
      assets: assetItems,
      liabilities: liabilityItems,
      investments: investmentItems
    };
  }

  async listAnnualSnapshotSummaries(year: string): Promise<YearlySnapshotInput[]> {
    await this.ensureBaseData();
    const previousDecember = `${Number(year) - 1}-12`;
    const lastMonth = `${year}-12`;
    const firstDate = monthSnapshotDate(previousDecember);
    const lastDate = monthSnapshotDate(lastMonth);
    const [assetSnapshots, liabilitySnapshots, investmentSnapshots, reviews] = await Promise.all([
      this.prisma.accountSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, date: { gte: firstDate, lte: lastDate } }
      }),
      this.prisma.liabilitySnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month: { gte: previousDecember, lte: lastMonth } }
      }),
      this.prisma.investmentSnapshot.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month: { gte: previousDecember, lte: lastMonth } }
      }),
      this.prisma.monthlyReview.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, month: { gte: previousDecember, lte: lastMonth } }
      })
    ]);
    const reviewsByMonth = new Map(reviews.map((review) => [review.month, review]));
    const months = [previousDecember, ...Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)];

    return months.map((month) => {
      const review = reviewsByMonth.get(month);
      const monthAssets = assetSnapshots.filter((snapshot) => formatDate(snapshot.date) === formatDate(monthSnapshotDate(month)));
      const monthLiabilities = liabilitySnapshots.filter((snapshot) => snapshot.month === month);
      const monthInvestments = investmentSnapshots.filter((snapshot) => snapshot.month === month);
      const assetsAvailable = Boolean(review?.assetsConfirmedAt) || (month === previousDecember && monthAssets.length > 0);
      const liabilitiesAvailable = Boolean(review?.liabilitiesConfirmedAt) || (month === previousDecember && monthLiabilities.length > 0);
      const investmentsAvailable = Boolean(review?.investmentsConfirmedAt) || (month === previousDecember && monthInvestments.length > 0);
      const totalAssets = sumMoney(monthAssets.map((snapshot) => decimalToMoney(snapshot.value)));
      const totalLiabilities = sumMoney(monthLiabilities.map((snapshot) => decimalToMoney(snapshot.currentBalance)));
      const investmentMarketValue = sumMoney(monthInvestments.map((snapshot) => decimalToMoney(snapshot.marketValue)));
      const investmentInvested = sumMoney(monthInvestments.map((snapshot) => decimalToMoney(snapshot.investedAmount)));

      return {
        month,
        ...(month === previousDecember ? {} : {
          review: {
            month,
            spending: Boolean(review?.spendingConfirmedAt),
            assets: Boolean(review?.assetsConfirmedAt),
            liabilities: Boolean(review?.liabilitiesConfirmedAt),
            investments: Boolean(review?.investmentsConfirmedAt)
          }
        }),
        ...(assetsAvailable ? { totalAssets } : {}),
        ...(liabilitiesAvailable ? { totalLiabilities } : {}),
        ...(assetsAvailable && liabilitiesAvailable ? { netAssets: subtractMoney(totalAssets, totalLiabilities) } : {}),
        ...(investmentsAvailable ? {
          investmentMarketValue,
          investmentProfit: subtractMoney(investmentMarketValue, investmentInvested)
        } : {})
      };
    });
  }

  async confirmMonthlySpending(month: string): Promise<MonthlyReviewStatus> {
    await this.ensureBaseData();
    await this.prisma.monthlyReview.upsert({
      where: { familyId_month: { familyId: DEFAULT_FAMILY_ID, month } },
      create: { familyId: DEFAULT_FAMILY_ID, month, spendingConfirmedAt: new Date() },
      update: { spendingConfirmedAt: new Date() }
    });
    return this.getMonthlyReview(month);
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

      const accountTypeCount = await tx.accountTypeOption.count({ where: { familyId: DEFAULT_FAMILY_ID } });
      if (accountTypeCount === 0) {
        await tx.accountTypeOption.createMany({
          data: defaultAccountTypes.map((accountType) => ({
            id: accountType.id,
            familyId: DEFAULT_FAMILY_ID,
            name: accountType.name,
            isDefault: true,
            isActive: true
          }))
        });
      }
      const accounts = await tx.account.findMany({
        where: { familyId: DEFAULT_FAMILY_ID, deletedAt: null },
        select: { type: true }
      });
      for (const type of [...new Set(accounts.map((account) => normalizeLegacyAccountType(account.type)))]) {
        await tx.accountTypeOption.upsert({
          where: { familyId_name: { familyId: DEFAULT_FAMILY_ID, name: type } },
          create: { familyId: DEFAULT_FAMILY_ID, name: type, isDefault: false, isActive: true },
          update: {}
        });
      }

      const investmentAccountIds = await tx.investmentHolding.findMany({
        where: { familyId: DEFAULT_FAMILY_ID },
        distinct: ["accountId"],
        select: { accountId: true }
      });
      for (const { accountId } of investmentAccountIds) {
        await syncInvestmentAccountValue(tx, accountId);
      }

      const categoryCount = await tx.category.count({ where: { familyId: DEFAULT_FAMILY_ID } });
      if (categoryCount === 0) {
        await tx.category.createMany({
          data: defaultCategories.map((category) => ({
            id: category.id,
            familyId: DEFAULT_FAMILY_ID,
            name: category.name,
            kind: category.kind,
            note: category.note,
            isDefault: true,
            isActive: true
          }))
        });
      }

      const mappingCount = await tx.categoryMapping.count({ where: { familyId: DEFAULT_FAMILY_ID } });
      if (mappingCount === 0) {
        const categories = await tx.category.findMany({
          where: { familyId: DEFAULT_FAMILY_ID, isActive: true },
          select: { id: true, name: true, kind: true }
        });
        const targetByKey = new Map(categories.map((category) => [`${category.kind}:${category.name}`, category.id]));
        await tx.categoryMapping.createMany({
          data: defaultCategoryMappings.flatMap((mapping) => {
            const targetCategoryId = targetByKey.get(`${mapping.kind}:${mapping.targetCategoryName}`);
            return targetCategoryId
              ? [{
                  familyId: DEFAULT_FAMILY_ID,
                  source: mapping.source,
                  kind: mapping.kind,
                  sourceCategory: mapping.sourceCategory,
                  targetCategoryId
                }]
              : [];
          })
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

function mapTransaction(
  transaction: DbTransaction & { category?: { name: string } | null }
): FinanceTransaction {
  return {
    id: transaction.id,
    date: formatDate(transaction.date),
    kind: transaction.kind,
    categoryName: transaction.category?.name ?? transaction.categoryName,
    accountId: transaction.accountId ?? undefined,
    memberName: transaction.memberName,
    amount: decimalToMoney(transaction.amount),
    note: transaction.note ?? undefined,
    source: transaction.source ?? undefined,
    sourceCategory: transaction.sourceCategory ?? undefined,
    confirmedAt: transaction.confirmedAt?.toISOString()
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
  const marketValue = decimalToMoney(holding.marketValue);
  const investedAmount = holding.investedAmount === null
    ? centsToMoney(moneyToCents(marketValue) - moneyToCents(decimalToMoney(holding.profit)))
    : decimalToMoney(holding.investedAmount);
  return {
    id: holding.id,
    name: holding.name,
    code: holding.code,
    type: holding.type,
    accountId: holding.accountId,
    marketValue,
    investedAmount,
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
    initialBalance:
      liability.initialBalance === null ? undefined : decimalToMoney(liability.initialBalance),
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
    note: category.note ?? undefined,
    isDefault: category.isDefault,
    isActive: category.isActive
  };
}

function mapCategoryMapping(
  mapping: DbCategoryMapping & { targetCategory: { name: string } }
): CategoryMapping {
  return {
    id: mapping.id,
    source: mapping.source as CategoryMapping["source"],
    kind: mapping.kind as CategoryMapping["kind"],
    sourceCategory: mapping.sourceCategory,
    targetCategoryId: mapping.targetCategoryId,
    targetCategoryName: mapping.targetCategory.name
  };
}

function mapAccountType(accountType: DbAccountTypeOption): AccountTypeOption {
  return {
    id: accountType.id,
    name: accountType.name,
    isDefault: accountType.isDefault,
    isActive: accountType.isActive
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

function sortByDefaultAccountTypeOrder<T extends { name: string }>(accountTypes: T[]): T[] {
  const rank = new Map<string, number>(defaultAccountTypes.map((accountType, index) => [accountType.name, index]));
  return [...accountTypes].sort((left, right) => {
    const rankDiff = (rank.get(left.name) ?? 99) - (rank.get(right.name) ?? 99);
    return rankDiff === 0 ? left.name.localeCompare(right.name, "zh-CN") : rankDiff;
  });
}

function normalizeAccountTypeName(name: string): string {
  return normalizeLegacyAccountType(name.trim());
}

function normalizeLegacyAccountType(type: string): string {
  return {
    bankCard: "银行卡",
    cash: "现金",
    alipay: "支付宝",
    wechat: "微信",
    fund: "基金",
    stock: "股票",
    other: "其他"
  }[type] ?? type;
}

async function syncInvestmentAccountValue(tx: Prisma.TransactionClient, accountId: string): Promise<void> {
  const aggregate = await tx.investmentHolding.aggregate({
    where: { familyId: DEFAULT_FAMILY_ID, accountId, deletedAt: null },
    _sum: { marketValue: true }
  });
  await tx.account.update({
    where: { id: accountId },
    data: { currentValue: normalizeMoney(aggregate._sum.marketValue?.toString() ?? "0") }
  });
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

function sumMoney(values: MoneyAmount[]): MoneyAmount {
  return centsToMoney(values.reduce((sum, value) => sum + moneyToCents(value), 0));
}

function subtractMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return centsToMoney(moneyToCents(left) - moneyToCents(right));
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

function nextMonthStart(month: string): Date {
  return monthDateWhere(month).date.lt;
}

function isCurrentMonth(month: string, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const monthNumber = parts.find((part) => part.type === "month")?.value;
  return month === `${year}-${monthNumber}`;
}

function monthSnapshotDate(month: string): Date {
  const next = nextMonthStart(month);
  return new Date(next.getTime() - 24 * 60 * 60 * 1000);
}

function previousMonth(month: string): string {
  const { gte } = monthDateWhere(month).date;
  const date = new Date(Date.UTC(gte.getUTCFullYear(), gte.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function investmentCost(input: CreateInvestmentHoldingInput): MoneyAmount {
  return centsToMoney(moneyToCents(input.marketValue) - moneyToCents(input.profit));
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
