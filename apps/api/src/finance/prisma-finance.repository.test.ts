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
        type: "bankCard",
        ownerName: "家庭共同",
        currentValue: "1500.00",
        note: "更新余额"
      }
    });
    expect(account.currentValue).toBe("1500.00");
    expect(accountSnapshotUpsert).not.toHaveBeenCalled();
  });
});

describe("PrismaFinanceRepository snapshot queries", () => {
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
