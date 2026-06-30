import { describe, expect, it } from "vitest";
import { applyCategoryMap, parseAlipayBill, summarizeBill } from "./alipay-import";
import type { ImportTransactionItem } from "@family-finance/shared";

const sample = [
  "导出提示：",
  "1.账单说明……",
  "记录时间,分类,收支类型,金额,备注,账户,来源,标签,",
  "2026-06-26 13:55:13,餐饮,支出,11.00,臻选好货,招商银行,账单同步,,",
  "2026-06-26 05:49:22,投资理财,收入,0.35,余额宝-攒着-收益发放,余额宝,账单同步,,",
  "2026-06-25 09:56:49,投资理财,不计收支,2，000.00,余-转入到招商卡,招商银行|余,账单同步,,",
  "2026-06-25 18:39:41,餐饮,支出,26.00,黄记煌,备注里,带逗号的,招商银行,账单同步,,",
  "",
  "坏行没有足够的列"
].join("\n");

describe("parseAlipayBill", () => {
  it("parses rows, maps kinds, normalizes amounts and keeps notes with commas", () => {
    const { items, total, skipped } = parseAlipayBill(sample);

    expect(total).toBe(5);
    expect(skipped).toBe(1);
    expect(items).toEqual([
      { date: "2026-06-26", kind: "expense", categoryName: "餐饮", amount: "11.00", note: "臻选好货" },
      { date: "2026-06-26", kind: "income", categoryName: "投资理财", amount: "0.35", note: "余额宝-攒着-收益发放" },
      { date: "2026-06-25", kind: "transfer", categoryName: "投资理财", amount: "2000.00", note: "余-转入到招商卡" },
      { date: "2026-06-25", kind: "expense", categoryName: "餐饮", amount: "26.00", note: "黄记煌,备注里,带逗号的" }
    ]);
  });

  it("summarizes counts by kind", () => {
    const { items } = parseAlipayBill(sample);
    const summary = summarizeBill(items);
    expect(summary.expense).toBe(2);
    expect(summary.income).toBe(1);
    expect(summary.transfer).toBe(1);
  });

  it("returns empty result when no header row is present", () => {
    expect(parseAlipayBill("just,some,random\ndata,here,now")).toEqual({ items: [], total: 0, skipped: 0 });
  });

  it("remaps category names through the mapping and keeps unmapped ones", () => {
    const items: ImportTransactionItem[] = [
      { date: "2026-06-01", kind: "expense", categoryName: "生活日用", amount: "10.00" },
      { date: "2026-06-02", kind: "expense", categoryName: "爱车", amount: "20.00" },
      { date: "2026-06-03", kind: "expense", categoryName: "餐饮", amount: "30.00" }
    ];
    const mapped = applyCategoryMap(items, { 生活日用: "购物", 爱车: "购物" });
    expect(mapped.map((item) => item.categoryName)).toEqual(["购物", "购物", "餐饮"]);
    // other fields are preserved
    expect(mapped[0]).toMatchObject({ date: "2026-06-01", kind: "expense", amount: "10.00" });
  });
});
