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
