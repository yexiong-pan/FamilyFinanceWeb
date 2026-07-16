import { describe, expect, it, vi } from "vitest";
import { PrismaFinanceRepository } from "./prisma-finance.repository";

describe("PrismaFinanceRepository account edits", () => {
  it("updates current value through the normal account edit path without snapshotting", async () => {
    const accountSnapshotUpsert = vi.fn();
    const accountUpdate = vi.fn(async ({ data }) => ({
      id: "account-1",
      familyId: "default-family",
      name: data.name,
      type: data.type,
      ownerName: data.ownerName,
      currentValue: data.currentValue,
      note: data.note,
      deletedAt: null,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    }));
    const repository = new PrismaFinanceRepository({
      account: { update: accountUpdate },
      accountSnapshot: { upsert: accountSnapshotUpsert }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const account = await repository.updateAccount("account-1", {
      name: "招商银行卡",
      type: "bankCard",
      ownerName: "家庭共同",
      currentValue: "1500",
      note: "更新余额"
    });

    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        name: "招商银行卡",
        type: "银行卡",
        ownerName: "家庭共同",
        currentValue: "1500.00",
        note: "更新余额"
      }
    });
    expect(account.currentValue).toBe("1500.00");
    expect(accountSnapshotUpsert).not.toHaveBeenCalled();
  });
});

describe("PrismaFinanceRepository category edits", () => {
  it("renames linked transactions and budgets with the category", async () => {
    const categoryUpdate = vi.fn(async ({ data }) => ({
      id: "category-food",
      familyId: "default-family",
      name: data.name,
      kind: data.kind,
      note: data.note,
      isDefault: true,
      isActive: true,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z")
    }));
    const transactionUpdateMany = vi.fn(async () => ({ count: 3 }));
    const budgetUpdateMany = vi.fn(async () => ({ count: 1 }));
    const client = {
      category: { update: categoryUpdate },
      financeTransaction: { updateMany: transactionUpdateMany },
      budget: { updateMany: budgetUpdateMany }
    };
    const runTransaction = vi.fn(async (run: (tx: typeof client) => Promise<unknown>) => run(client));
    const repository = new PrismaFinanceRepository({ ...client, $transaction: runTransaction } as never);
    repository.ensureBaseData = async () => undefined;

    const category = await repository.updateCategory("category-food", {
      name: "日常餐饮",
      kind: "expense",
      note: "买菜、外卖、餐馆、饮品"
    } as never);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(transactionUpdateMany).toHaveBeenCalledWith({
      where: { familyId: "default-family", categoryId: "category-food" },
      data: { categoryName: "日常餐饮" }
    });
    expect(budgetUpdateMany).toHaveBeenCalledWith({
      where: { familyId: "default-family", categoryId: "category-food" },
      data: { categoryName: "日常餐饮" }
    });
    expect(categoryUpdate).toHaveBeenCalledWith({
      where: { id: "category-food" },
      data: {
        name: "日常餐饮",
        kind: "expense",
        note: "买菜、外卖、餐馆、饮品"
      }
    });
    expect(category.name).toBe("日常餐饮");
    expect(category.note).toBe("买菜、外卖、餐馆、饮品");
  });

  it("uses the linked category's current name when legacy transaction text is stale", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "transaction-1",
        familyId: "default-family",
        accountId: null,
        categoryId: "category-unclassified",
        date: new Date("2026-06-18T00:00:00.000Z"),
        kind: "expense",
        categoryName: "待分类指出",
        memberName: "家庭共同",
        amount: "88.00",
        note: null,
        deletedAt: null,
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
        updatedAt: new Date("2026-06-18T00:00:00.000Z"),
        category: { name: "待分类支出" }
      }
    ]);
    const repository = new PrismaFinanceRepository({
      financeTransaction: { findMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const transactions = await repository.listTransactions({ month: "2026-06" });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: { category: { select: { name: true } } }
    }));
    expect(transactions[0]?.categoryName).toBe("待分类支出");
  });
});

describe("PrismaFinanceRepository investment account balances", () => {
  const holdingRecord = (overrides: Record<string, unknown> = {}) => ({
    id: "holding-1",
    familyId: "default-family",
    accountId: "account-fund",
    name: "支付宝基金",
    code: "000001",
    type: "fund",
    marketValue: "350.00",
    investedAmount: "300.00",
    profit: "50.00",
    note: null,
    deletedAt: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides
  });

  it("syncs the linked asset account after creating a holding", async () => {
    const accountUpdate = vi.fn(async () => ({}));
    const client = {
      investmentHolding: {
        create: vi.fn(async () => holdingRecord()),
        aggregate: vi.fn(async () => ({ _sum: { marketValue: "350.00" } }))
      },
      account: { update: accountUpdate }
    };
    const repository = new PrismaFinanceRepository({
      ...client,
      $transaction: vi.fn(async (run: (tx: typeof client) => Promise<unknown>) => run(client))
    } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.createHolding({
      accountId: "account-fund",
      name: "支付宝基金",
      code: "000001",
      type: "fund",
      marketValue: "350.00",
      investedAmount: "300.00",
      profit: "50.00"
    });

    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: "account-fund" },
      data: { currentValue: "350.00" }
    });
  });

  it("syncs both accounts when a holding moves to another account", async () => {
    const accountUpdate = vi.fn(async () => ({}));
    const client = {
      investmentHolding: {
        findUniqueOrThrow: vi.fn(async () => ({ accountId: "account-old" })),
        update: vi.fn(async () => holdingRecord({ accountId: "account-new" })),
        aggregate: vi.fn(async ({ where }: { where: { accountId: string } }) => ({
          _sum: { marketValue: where.accountId === "account-old" ? null : "350.00" }
        }))
      },
      account: { update: accountUpdate }
    };
    const repository = new PrismaFinanceRepository({
      ...client,
      $transaction: vi.fn(async (run: (tx: typeof client) => Promise<unknown>) => run(client))
    } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.updateHolding("holding-1", {
      accountId: "account-new",
      name: "支付宝基金",
      code: "000001",
      type: "fund",
      marketValue: "350.00",
      investedAmount: "300.00",
      profit: "50.00"
    });

    expect(accountUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "account-old" },
      data: { currentValue: "0.00" }
    });
    expect(accountUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "account-new" },
      data: { currentValue: "350.00" }
    });
  });

  it("syncs the linked account after deleting a holding", async () => {
    const accountUpdate = vi.fn(async () => ({}));
    const client = {
      investmentHolding: {
        findUniqueOrThrow: vi.fn(async () => ({ accountId: "account-fund" })),
        update: vi.fn(async () => holdingRecord({ deletedAt: new Date() })),
        aggregate: vi.fn(async () => ({ _sum: { marketValue: "120.00" } }))
      },
      account: { update: accountUpdate }
    };
    const repository = new PrismaFinanceRepository({
      ...client,
      $transaction: vi.fn(async (run: (tx: typeof client) => Promise<unknown>) => run(client))
    } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.deleteHolding("holding-1");

    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: "account-fund" },
      data: { currentValue: "120.00" }
    });
  });
});

describe("PrismaFinanceRepository transaction confirmation", () => {
  it("marks an imported transaction confirmed when it is edited", async () => {
    const update = vi.fn(async ({ data }) => ({
      id: "transaction-1",
      familyId: "default-family",
      accountId: null,
      categoryId: "category-food",
      date: data.date,
      kind: data.kind,
      categoryName: data.categoryName,
      memberName: data.memberName,
      amount: data.amount,
      note: data.note,
      source: "wechat",
      sourceCategory: "商户消费",
      confirmedAt: data.confirmedAt,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const repository = new PrismaFinanceRepository({
      category: { findFirst: vi.fn(async () => ({ id: "category-food" })) },
      financeTransaction: { update }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const result = await repository.updateTransaction("transaction-1", {
      date: "2026-06-01",
      kind: "expense",
      categoryName: "餐饮",
      memberName: "雄哥",
      amount: "20.00"
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "transaction-1" },
      data: expect.objectContaining({ confirmedAt: expect.any(Date) })
    }));
    expect(result.confirmedAt).toBeDefined();
    expect(result.source).toBe("wechat");
  });

  it("confirms a transaction without changing its other fields", async () => {
    const update = vi.fn(async ({ data }) => ({
      id: "transaction-1",
      familyId: "default-family",
      accountId: null,
      categoryId: "category-food",
      date: new Date("2026-06-01T00:00:00.000Z"),
      kind: "expense",
      categoryName: "餐饮",
      memberName: "雄哥",
      amount: "20.00",
      note: null,
      source: "alipay",
      sourceCategory: "餐饮",
      confirmedAt: data.confirmedAt,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const repository = new PrismaFinanceRepository({ financeTransaction: { update } } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.confirmTransaction("transaction-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "transaction-1" },
      data: { confirmedAt: expect.any(Date) }
    });
  });
});

describe("PrismaFinanceRepository snapshot queries", () => {
  it("uses live account values for the current month instead of an older snapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T03:00:00.000Z"));
    const accountFindMany = vi.fn(async () => [{
      id: "account-fund",
      familyId: "default-family",
      name: "支付宝基金",
      type: "基金",
      ownerName: "雄哥",
      currentValue: "18834.86",
      note: null,
      deletedAt: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-16T02:00:00.000Z")
    }]);
    const snapshotFindMany = vi.fn(async () => [{
      accountId: "account-fund",
      value: "19036.60"
    }]);
    const repository = new PrismaFinanceRepository({
      account: { findMany: accountFindMany },
      accountSnapshot: { findMany: snapshotFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    try {
      await expect(repository.listAccountsForMonth("2026-07")).resolves.toEqual([
        expect.objectContaining({ name: "支付宝基金", currentValue: "18834.86" })
      ]);
      expect(snapshotFindMany).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns exact monthly snapshots with previous-month changes and no live-data fallback", async () => {
    const accountFindMany = vi.fn()
      .mockResolvedValueOnce([
        {
          accountId: "a1",
          value: "1000.00",
          account: { name: "招商银行卡", type: "银行卡", ownerName: "雄哥" }
        }
      ])
      .mockResolvedValueOnce([
        {
          accountId: "a1",
          value: "800.00",
          account: { name: "招商银行卡", type: "银行卡", ownerName: "雄哥" }
        }
      ]);
    const liabilityFindMany = vi.fn()
      .mockResolvedValueOnce([
        {
          liabilityId: "l1",
          currentBalance: "300.00",
          monthlyPayment: "50.00",
          remainingPeriods: 6,
          liability: { name: "车贷", ownerName: "雄哥" }
        }
      ])
      .mockResolvedValueOnce([
        {
          liabilityId: "l1",
          currentBalance: "350.00",
          liability: { name: "车贷", ownerName: "雄哥" }
        }
      ]);
    const investmentFindMany = vi.fn()
      .mockResolvedValueOnce([
        {
          holdingId: "h1",
          investedAmount: "400.00",
          marketValue: "500.00",
          holding: { name: "指数基金", code: "000001", account: { name: "基金账户" } }
        }
      ])
      .mockResolvedValueOnce([
        {
          holdingId: "h1",
          investedAmount: "400.00",
          marketValue: "450.00",
          holding: { name: "指数基金", code: "000001", account: { name: "基金账户" } }
        }
      ]);
    const repository = new PrismaFinanceRepository({
      monthlyReview: {
        findUnique: vi.fn(async () => ({
          spendingConfirmedAt: new Date(),
          assetsConfirmedAt: new Date(),
          liabilitiesConfirmedAt: new Date(),
          investmentsConfirmedAt: new Date()
        }))
      },
      accountSnapshot: { findMany: accountFindMany },
      liabilitySnapshot: { findMany: liabilityFindMany },
      investmentSnapshot: { findMany: investmentFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    await expect((repository as any).getMonthlySnapshot("2026-07")).resolves.toEqual({
      month: "2026-07",
      review: { month: "2026-07", spending: true, assets: true, liabilities: true, investments: true },
      summary: {
        totalAssets: "1000.00",
        totalLiabilities: "300.00",
        netAssets: "700.00",
        investmentMarketValue: "500.00",
        investmentProfit: "100.00",
        netAssetsChange: "250.00"
      },
      assets: [
        {
          accountId: "a1",
          accountName: "招商银行卡",
          accountType: "银行卡",
          ownerName: "雄哥",
          value: "1000.00",
          change: "200.00"
        }
      ],
      liabilities: [
        {
          liabilityId: "l1",
          liabilityName: "车贷",
          ownerName: "雄哥",
          currentBalance: "300.00",
          monthlyPayment: "50.00",
          remainingPeriods: 6,
          change: "-50.00"
        }
      ],
      investments: [
        {
          holdingId: "h1",
          holdingName: "指数基金",
          code: "000001",
          accountName: "基金账户",
          investedAmount: "400.00",
          marketValue: "500.00",
          profit: "100.00",
          returnRate: 25,
          change: "50.00"
        }
      ]
    });
  });

  it("lists all snapshots with account names and applies date filter", async () => {
    const findMany = vi.fn(async () => [
      { id: "s1", accountId: "a1", date: new Date("2026-07-01T00:00:00.000Z"), value: "100.00" },
      { id: "s2", accountId: "a2", date: new Date("2026-07-02T00:00:00.000Z"), value: "200.00" }
    ]);
    const accountFindMany = vi.fn(async () => [
      { id: "a1", name: "支付宝", ownerName: "雄哥" },
      { id: "a2", name: "微信", ownerName: "瑶雯" }
    ]);
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany, upsert: vi.fn(), delete: vi.fn() },
      account: { findMany: accountFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const result = await repository.listAllSnapshots({ from: "2026-07-01", to: "2026-07-02" });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        familyId: "default-family",
        date: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lte: new Date("2026-07-02T00:00:00.000Z")
        }
      },
      orderBy: { date: "asc" }
    });
    expect(result).toEqual([
      { id: "s1", accountId: "a1", accountName: "支付宝", ownerName: "雄哥", date: "2026-07-01", value: "100.00" },
      { id: "s2", accountId: "a2", accountName: "微信", ownerName: "瑶雯", date: "2026-07-02", value: "200.00" }
    ]);
  });

  it("skips snapshots whose account has been deleted", async () => {
    const findMany = vi.fn(async () => [
      { id: "s1", accountId: "a1", date: new Date("2026-07-01T00:00:00.000Z"), value: "100.00" },
      { id: "s2", accountId: "a-gone", date: new Date("2026-07-02T00:00:00.000Z"), value: "200.00" }
    ]);
    const accountFindMany = vi.fn(async () => [{ id: "a1", name: "支付宝", ownerName: "雄哥" }]);
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany, upsert: vi.fn(), delete: vi.fn() },
      account: { findMany: accountFindMany }
    } as never);
    repository.ensureBaseData = async () => undefined;

    const result = await repository.listAllSnapshots();
    expect(result).toEqual([
      { id: "s1", accountId: "a1", accountName: "支付宝", ownerName: "雄哥", date: "2026-07-01", value: "100.00" }
    ]);
  });

  it("deletes a snapshot by id", async () => {
    const deleteFn = vi.fn(async () => ({}));
    const repository = new PrismaFinanceRepository({
      accountSnapshot: { findMany: vi.fn(), upsert: vi.fn(), delete: deleteFn }
    } as never);
    repository.ensureBaseData = async () => undefined;

    await repository.deleteSnapshot("s1");
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
