import { describe, expect, it } from "vitest";
import type {
  Account,
  Budget,
  FinanceTransaction,
  InvestmentHolding,
  Liability
} from "@family-finance/shared";
import { FinanceService } from "./finance.service";
import {
  FINANCE_REPOSITORY,
  type FinanceRepository
} from "./finance.repository";
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
  MemberInput
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
    // Transactions do not adjust account balances; the account stays as entered.
    expect((await service.listAccounts())[0]?.currentValue).toBe("1000.00");
    expect(await service.getDashboardSummary("2026-06")).toMatchObject({
      totalAssets: "1000.00",
      monthlyExpense: "120.00",
      monthlyIncome: "0.00",
      monthlyBalance: "-120.00"
    });
  });

  it("updates account amount through the normal edit flow", async () => {
    const service = new FinanceService(createRepository());
    const account = await service.createAccount({
      name: "招商银行卡",
      type: "bankCard",
      ownerName: "家庭共同",
      currentValue: "1000",
      note: "初始录入"
    });

    const updated = await service.updateAccount(account.id, {
      name: "招商银行卡",
      type: "bankCard",
      ownerName: "家庭共同",
      currentValue: "1500",
      note: "编辑余额"
    });

    expect(updated.currentValue).toBe("1500.00");
    expect((await service.listAccounts())[0]?.currentValue).toBe("1500.00");
  });

  it("lists all snapshots and deletes one through the service", async () => {
    const service = new FinanceService(createRepository());
    const all = await service.listAllSnapshots({ accountId: "a1" });
    expect(all).toEqual([]);
    await expect(service.deleteSnapshot("s1")).resolves.toBeUndefined();
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
  const familyMembers: { id: string; name: string; icon?: string }[] = [
    { id: "member-husband", name: "丈夫" },
    { id: "member-wife", name: "妻子" },
    { id: "member-family", name: "家庭共同" }
  ];
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
  const liabilities: Liability[] = [];

  return {
    async ensureBaseData() {
      return undefined;
    },
    async listMembers() {
      return familyMembers.map((member) => member.name);
    },
    async listFamilyMembers() {
      return familyMembers;
    },
    async createMember(input: MemberInput) {
      const member = { id: `member-${familyMembers.length + 1}`, name: input.name, icon: input.icon };
      familyMembers.push(member);
      return member;
    },
    async updateMember(id: string, input: MemberInput) {
      const member = familyMembers.find((item) => item.id === id);
      if (!member) throw new Error("not found");
      member.name = input.name;
      member.icon = input.icon;
      return member;
    },
    async deleteMember(id: string) {
      const index = familyMembers.findIndex((item) => item.id === id);
      if (index >= 0) familyMembers.splice(index, 1);
    },
    async listCategories() {
      return categories.filter((item) => item.isActive);
    },
    async createCategory(input: CategoryInput) {
      const existing = categories.find((item) => item.name === input.name && item.kind === input.kind);
      if (existing) {
        existing.isActive = true;
        return existing;
      }
      const category: Category = {
        id: `category-${categories.length + 1}`,
        name: input.name,
        kind: input.kind,
        isDefault: false,
        isActive: true
      };
      categories.push(category);
      return category;
    },
    async updateCategory(id: string, input: CategoryInput) {
      const category = categories.find((item) => item.id === id);
      if (!category) throw new Error("not found");
      category.name = input.name;
      category.kind = input.kind;
      return category;
    },
    async deleteCategory(id: string) {
      const category = categories.find((item) => item.id === id);
      if (category) category.isActive = false;
    },
    async listAccounts() {
      return accounts;
    },
    async createAccount(input: CreateAccountInput) {
      const account = { id: `account-${accounts.length + 1}`, ...input, currentValue: normalizeMoney(input.currentValue) };
      accounts.push(account);
      return account;
    },
    async updateAccount(id: string, input: UpdateAccountInput) {
      const index = accounts.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Account not found");
      const existing = accounts[index]!;
      const updated = { ...existing, ...input, currentValue: normalizeMoney(input.currentValue) };
      accounts[index] = updated;
      return updated;
    },
    async snapshotAllAccounts() {
      return { date: "2026-07-01", count: accounts.length };
    },
    async listAccountSnapshots(_accountId: string) {
      return [];
    },
    async listAllSnapshots() {
      return [];
    },
    async deleteSnapshot() {
      return undefined;
    },
    async deleteAccount(id: string) {
      const index = accounts.findIndex((item) => item.id === id);
      if (index >= 0) accounts.splice(index, 1);
    },
    async listAssetTrend() {
      return [];
    },
    async listTransactions(filter = {}) {
      return filter.month ? transactions.filter((item) => item.date.slice(0, 7) === filter.month) : transactions;
    },
    // Transactions are an independent ledger and do not touch account balances.
    async createTransaction(input: CreateTransactionInput) {
      const transaction = { id: `transaction-${transactions.length + 1}`, ...input, amount: normalizeMoney(input.amount) };
      transactions.push(transaction);
      return transaction;
    },
    async updateTransaction(id: string, input: CreateTransactionInput) {
      const transaction = { id, ...input, amount: normalizeMoney(input.amount) };
      const index = transactions.findIndex((item) => item.id === id);
      if (index >= 0) transactions[index] = transaction;
      return transaction;
    },
    async deleteTransaction(id: string) {
      const index = transactions.findIndex((item) => item.id === id);
      if (index >= 0) transactions.splice(index, 1);
    },
    async importTransactions(input: ImportTransactionsInput) {
      for (const item of input.items) {
        transactions.push({
          id: `transaction-${transactions.length + 1}`,
          date: item.date,
          kind: item.kind,
          categoryName: item.categoryName,
          accountId: input.accountId,
          memberName: input.memberName,
          amount: normalizeMoney(item.amount),
          note: item.note
        });
      }
      return { imported: input.items.length };
    },
    async listBudgets(month?: string) {
      return month ? budgets.filter((item) => item.month === month) : budgets;
    },
    async createBudget(input: CreateBudgetInput) {
      const budget = { id: `budget-${budgets.length + 1}`, ...input, limitAmount: normalizeMoney(input.limitAmount) };
      budgets.push(budget);
      return budget;
    },
    async updateBudget(id: string, input: CreateBudgetInput) {
      const budget = { id, ...input, limitAmount: normalizeMoney(input.limitAmount) };
      const index = budgets.findIndex((item) => item.id === id);
      if (index >= 0) budgets[index] = budget;
      return budget;
    },
    async deleteBudget(id: string) {
      const index = budgets.findIndex((item) => item.id === id);
      if (index >= 0) budgets.splice(index, 1);
    },
    async listHoldings() {
      return holdings;
    },
    async createHolding(input: CreateInvestmentHoldingInput) {
      const holding = {
        id: `holding-${holdings.length + 1}`,
        ...input,
        marketValue: normalizeMoney(input.marketValue),
        profit: normalizeMoney(input.profit)
      };
      holdings.push(holding);
      return holding;
    },
    async updateHolding(id: string, input: CreateInvestmentHoldingInput) {
      const holding = {
        id,
        ...input,
        marketValue: normalizeMoney(input.marketValue),
        profit: normalizeMoney(input.profit)
      };
      const index = holdings.findIndex((item) => item.id === id);
      if (index >= 0) holdings[index] = holding;
      return holding;
    },
    async deleteHolding(id: string) {
      const index = holdings.findIndex((item) => item.id === id);
      if (index >= 0) holdings.splice(index, 1);
    },
    async listLiabilities() {
      return liabilities;
    },
    async createLiability(input: CreateLiabilityInput) {
      const liability: Liability = {
        id: `liability-${liabilities.length + 1}`,
        ...input,
        currentBalance: normalizeMoney(input.currentBalance),
        monthlyPayment:
          input.monthlyPayment === undefined ? undefined : normalizeMoney(input.monthlyPayment),
        status: input.status ?? "active"
      };
      liabilities.push(liability);
      return liability;
    },
    async updateLiability(id: string, input: CreateLiabilityInput) {
      const liability: Liability = {
        id,
        ...input,
        currentBalance: normalizeMoney(input.currentBalance),
        monthlyPayment:
          input.monthlyPayment === undefined ? undefined : normalizeMoney(input.monthlyPayment),
        status: input.status ?? "active"
      };
      const index = liabilities.findIndex((item) => item.id === id);
      if (index >= 0) liabilities[index] = liability;
      return liability;
    },
    async repayLiability(id: string, input: { amount: string }) {
      const liability = liabilities.find((item) => item.id === id);
      if (!liability) throw new Error("not found");
      const balance = Math.max(0, toCents(liability.currentBalance) - toCents(input.amount));
      const remaining =
        liability.remainingPeriods === undefined ? undefined : Math.max(0, liability.remainingPeriods - 1);
      liability.currentBalance = fromCents(balance);
      liability.remainingPeriods = remaining;
      if (balance === 0 || remaining === 0) liability.status = "paidOff";
      return liability;
    },
    async deleteLiability(id: string) {
      const index = liabilities.findIndex((item) => item.id === id);
      if (index >= 0) liabilities.splice(index, 1);
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
