import { describe, expect, it } from "vitest";
import { buildImportRecordKey, buildLegacyImportKey } from "./import-deduplication";

const baseItem = {
  date: "2026-06-27",
  occurredAt: "2026-06-27T13:05:26",
  kind: "expense" as const,
  categoryName: "餐饮",
  sourceCategory: "商户消费",
  amount: "38.83",
  note: "美团 · 美团订单",
  sourceAccount: "银行卡"
};

describe("import deduplication keys", () => {
  it("uses the platform transaction id when one is available", () => {
    expect(buildImportRecordKey("wechat", {
      ...baseItem,
      sourceRecordId: " 420000123456 "
    })).toBe("wechat:id:420000123456");
  });

  it("builds a stable fallback key and distinguishes transactions at different times", () => {
    const first = buildImportRecordKey("alipay", baseItem);
    const repeated = buildImportRecordKey("alipay", { ...baseItem });
    const later = buildImportRecordKey("alipay", {
      ...baseItem,
      occurredAt: "2026-06-27T13:06:26"
    });

    expect(first).toBe(repeated);
    expect(first).toMatch(/^alipay:sha256:[a-f0-9]{64}$/);
    expect(later).not.toBe(first);
  });

  it("keeps a date-level compatibility key for transactions imported before fingerprints existed", () => {
    expect(buildLegacyImportKey(baseItem)).toBe(
      buildLegacyImportKey({
        date: new Date("2026-06-27T00:00:00.000Z"),
        kind: "expense",
        amount: "38.83",
        sourceCategory: "商户消费",
        note: "美团 · 美团订单"
      })
    );
  });
});
