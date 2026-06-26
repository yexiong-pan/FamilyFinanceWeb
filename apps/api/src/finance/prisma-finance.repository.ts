import { Injectable } from "@nestjs/common";
import type { Prisma, Account as DbAccount, Budget as DbBudget, Category as DbCategory, FamilyMember, FinanceTransaction as DbTransaction, InvestmentHolding as DbHolding } from "@prisma/client";
import { normalizeMoney } from "@family-finance/shared";
import type {
  Account,
  Budget,
  FinanceTransaction,
  InvestmentHolding,
  MoneyAmount
} from "@family-finance/shared";
import { PrismaService } from "../prisma.service";
import type {
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateTransactionInput
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

  constructor(private readonly prisma: PrismaService) {}

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

  async listCategories(): Promise<Category[]> {
    await this.ensureBaseData();
    const categories = await this.prisma.category.findMany({
      where: { familyId: DEFAULT_FAMILY_ID, isActive: true },
      orderBy: { createdAt: "asc" }
    });
    return sortByDefaultCategoryOrder(categories).map(mapCategory);
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
    return mapAccount(account);
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

  async createTransaction(input: CreateTransactionInput): Promise<FinanceTransaction> {
    await this.ensureBaseData();
    const normalizedAmount = normalizeMoney(input.amount);
    const created = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirstOrThrow({
        where: { id: input.accountId, familyId: DEFAULT_FAMILY_ID, deletedAt: null }
      });
      const category = await tx.category.findFirst({
        where: {
          familyId: DEFAULT_FAMILY_ID,
          name: input.categoryName,
          kind: input.kind
        }
      });
      const transaction = await tx.financeTransaction.create({
        data: {
          familyId: DEFAULT_FAMILY_ID,
          accountId: input.accountId,
          categoryId: category?.id,
          date: parseDate(input.date),
          kind: input.kind,
          categoryName: input.categoryName,
          memberName: input.memberName,
          amount: normalizedAmount,
          note: input.note
        }
      });
      const nextValue = nextAccountValue(decimalToMoney(account.currentValue), input.kind, normalizedAmount);
      if (nextValue !== decimalToMoney(account.currentValue)) {
        await tx.account.update({
          where: { id: input.accountId },
          data: { currentValue: nextValue }
        });
      }
      return transaction;
    });
    return mapTransaction(created);
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
        cost: normalizeMoney(input.cost),
        quantity: input.quantity,
        note: input.note
      }
    });
    return mapHolding(holding);
  }

  private async createBaseData(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.family.upsert({
        where: { id: DEFAULT_FAMILY_ID },
        update: { name: DEFAULT_FAMILY_NAME },
        create: { id: DEFAULT_FAMILY_ID, name: DEFAULT_FAMILY_NAME }
      });

      for (const member of defaultMembers) {
        await tx.familyMember.upsert({
          where: {
            familyId_name: {
              familyId: DEFAULT_FAMILY_ID,
              name: member.name
            }
          },
          update: { role: "OWNER" },
          create: {
            id: member.id,
            familyId: DEFAULT_FAMILY_ID,
            name: member.name,
            role: "OWNER"
          }
        });
      }

      for (const category of defaultCategories) {
        await tx.category.upsert({
          where: {
            familyId_name_kind: {
              familyId: DEFAULT_FAMILY_ID,
              name: category.name,
              kind: category.kind
            }
          },
          update: {
            isDefault: true,
            isActive: true
          },
          create: {
            id: category.id,
            familyId: DEFAULT_FAMILY_ID,
            name: category.name,
            kind: category.kind,
            isDefault: true,
            isActive: true
          }
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
    note: account.note ?? undefined
  };
}

function mapTransaction(transaction: DbTransaction): FinanceTransaction {
  return {
    id: transaction.id,
    date: formatDate(transaction.date),
    kind: transaction.kind,
    categoryName: transaction.categoryName,
    accountId: transaction.accountId,
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
    cost: decimalToMoney(holding.cost),
    quantity: holding.quantity.toString(),
    note: holding.note ?? undefined
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

function nextAccountValue(currentValue: MoneyAmount, kind: string, amount: MoneyAmount): MoneyAmount {
  if (kind === "income") {
    return addMoney(currentValue, amount);
  }
  if (kind === "expense") {
    return subtractMoney(currentValue, amount);
  }
  if (kind === "adjustment") {
    return normalizeMoney(amount);
  }
  return normalizeMoney(currentValue);
}

function addMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return fromCents(toCents(left) + toCents(right));
}

function subtractMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return fromCents(toCents(left) - toCents(right));
}

function toCents(value: MoneyAmount): number {
  const trimmed = value.trim();
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [rawInteger = "0", rawFraction = ""] = unsigned.split(".");
  const integerPart = rawInteger.replace(/\D/g, "") || "0";
  const fractionPart = `${rawFraction.replace(/\D/g, "")}00`.slice(0, 2);
  return sign * (Number.parseInt(integerPart, 10) * 100 + Number.parseInt(fractionPart, 10));
}

function fromCents(cents: number): MoneyAmount {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
