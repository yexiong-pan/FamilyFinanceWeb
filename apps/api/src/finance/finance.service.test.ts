import { describe, expect, it } from "vitest";
import type {
  Account,
  Budget,
  FinanceTransaction,
  InvestmentHolding
} from "@family-finance/shared";
import { FinanceService } from "./finance.service";
import {
  FINANCE_REPOSITORY,
  type FinanceRepository
} from "./finance.repository";
import type {
  Category,
  CreateAccountInput,
  CreateBudgetInput,
  CreateInvestmentHoldingInput,
  CreateTransactionInput
} from "./finance.types";

describe("FinanceService", () => {
  it("returns an empty real ledger instead of seeded demo finance data", async () => {
    const service = new FinanceService(createRepository());

    const summary = await service.getDashboardSummary("2026-06");

    expect(FINANCE_REPOSITORY).toBe(Symbol.for("family-finance.repository"));
    expect(summary.totalAssets).toBe("0.00");
    expect(summary.monthlyIncome).toBe("0.00");
    expect(summary.monthlyExpense).toBe("0.00");
    expect(summary.monthlyBalance).toBe("0.00");
    expect(summary.categoryBreakdown).toEqual([]);
    expect(summary.budgetUsages).toEqual([]);
  });

  it("persists user-created accounts and transactions through the repository", async () => {
    const repository = createRepository();
    const service = new FinanceService(repository);

    const account = await service.createAccount({
      name: "真实招商银行卡",
      type: "bankCard",
      ownerName: "家庭共同",
      currentValue: "1000",
      note: "用户自己录入"
    });
    const transaction = await service.createTransaction({
      date: "2026-06-18",
      kind: "expense",
      categoryName: "餐饮",
      accountId: account.id,
      memberName: "家庭共同",
      amount: "120.00",
      note: "真实支出"
    });

    expect(transaction.id).toMatch(/^transaction-/);
    expect(await service.listTransactions({ month: "2026-06" })).toContainEqual(transaction);
    expect((await service.listAccounts())[0]?.currentValue).toBe("880.00");
    expect(await service.getDashboardSummary("2026-06")).toMatchObject({
      totalAssets: "880.00",
      monthlyExpense: "120.00",
      monthlyIncome: "0.00",
      monthlyBalance: "-120.00"
    });
  });

  it("keeps only default configuration, not fake finance records", async () => {
    const service = new FinanceService(createRepository());

    expect(await service.listMembers()).toEqual(["丈夫", "妻子", "家庭共同"]);
    expect((await service.listCategories()).map((category) => category.name)).toEqual([
      "房贷",
      "餐饮",
      "交通",
      "育儿",
      "购物",
      "工资",
      "投资收益"
    ]);
    expect(await service.listAccounts()).toEqual([]);
    expect(await service.listBudgets("2026-06")).toEqual([]);
    expect(await service.listHoldings()).toEqual([]);
  });
});

function createRepository(): FinanceRepository {
  const members = ["丈夫", "妻子", "家庭共同"];
  const categories: Category[] = [
    { id: "category-mortgage", name: "房贷", kind: "expense", isDefault: true, isActive: true },
    { id: "category-food", name: "餐饮", kind: "expense", isDefault: true, isActive: true },
    { id: "category-transport", name: "交通", kind: "expense", isDefault: true, isActive: true },
    { id: "category-child", name: "育儿", kind: "expense", isDefault: true, isActive: true },
    { id: "category-shopping", name: "购物", kind: "expense", isDefault: true, isActive: true },
    { id: "category-salary", name: "工资", kind: "income", isDefault: true, isActive: true },
    { id: "category-investment", name: "投资收益", kind: "income", isDefault: true, isActive: true }
  ];
  const accounts: Account[] = [];
  const transactions: FinanceTransaction[] = [];
  const budgets: Budget[] = [];
  const holdings: InvestmentHolding[] = [];

  return {
    async ensureBaseData() {
      return undefined;
    },
    async listMembers() {
      return members;
    },
    async listCategories() {
      return categories;
    },
    async listAccounts() {
      return accounts;
    },
    async createAccount(input: CreateAccountInput) {
      const account = { id: `account-${accounts.length + 1}`, ...input, currentValue: normalizeMoney(input.currentValue) };
      accounts.push(account);
      return account;
    },
    async listTransactions(filter = {}) {
      return filter.month ? transactions.filter((item) => item.date.slice(0, 7) === filter.month) : transactions;
    },
    async createTransaction(input: CreateTransactionInput) {
      const transaction = { id: `transaction-${transactions.length + 1}`, ...input, amount: normalizeMoney(input.amount) };
      transactions.push(transaction);
      const account = accounts.find((item) => item.id === transaction.accountId);
      if (account && transaction.kind === "expense") {
        account.currentValue = subtractMoney(account.currentValue, transaction.amount);
      }
      if (account && transaction.kind === "income") {
        account.currentValue = addMoney(account.currentValue, transaction.amount);
      }
      if (account && transaction.kind === "adjustment") {
        account.currentValue = transaction.amount;
      }
      return transaction;
    },
    async listBudgets(month?: string) {
      return month ? budgets.filter((item) => item.month === month) : budgets;
    },
    async createBudget(input: CreateBudgetInput) {
      const budget = { id: `budget-${budgets.length + 1}`, ...input, limitAmount: normalizeMoney(input.limitAmount) };
      budgets.push(budget);
      return budget;
    },
    async listHoldings() {
      return holdings;
    },
    async createHolding(input: CreateInvestmentHoldingInput) {
      const holding = {
        id: `holding-${holdings.length + 1}`,
        ...input,
        marketValue: normalizeMoney(input.marketValue),
        cost: normalizeMoney(input.cost)
      };
      holdings.push(holding);
      return holding;
    }
  };
}

function addMoney(left: string, right: string): string {
  return fromCents(toCents(left) + toCents(right));
}

function subtractMoney(left: string, right: string): string {
  return fromCents(toCents(left) - toCents(right));
}

function normalizeMoney(value: string): string {
  return fromCents(toCents(value));
}

function toCents(value: string): number {
  const [integer = "0", fraction = ""] = value.replace(/,/g, "").split(".");
  return Number.parseInt(integer, 10) * 100 + Number.parseInt(`${fraction}00`.slice(0, 2), 10);
}

function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}
