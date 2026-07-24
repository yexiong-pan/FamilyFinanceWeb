// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  applyCategoryMap,
  parseAlipayBill,
  parseWechatWorkbook,
  parseWechatSheetRows,
  summarizeBill
} from "./alipay-import";
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
    expect(parseAlipayBill(sample).source).toBe("alipay");
    expect(skipped).toBe(1);
    expect(items).toEqual([
      {
        date: "2026-06-26",
        occurredAt: "2026-06-26T13:55:13",
        kind: "expense",
        categoryName: "餐饮",
        amount: "11.00",
        note: "臻选好货",
        sourceAccount: "招商银行"
      },
      {
        date: "2026-06-26",
        occurredAt: "2026-06-26T05:49:22",
        kind: "income",
        categoryName: "投资理财",
        amount: "0.35",
        note: "余额宝-攒着-收益发放",
        sourceAccount: "余额宝"
      },
      {
        date: "2026-06-25",
        occurredAt: "2026-06-25T09:56:49",
        kind: "transfer",
        categoryName: "投资理财",
        amount: "2000.00",
        note: "余-转入到招商卡",
        sourceAccount: "招商银行|余"
      },
      {
        date: "2026-06-25",
        occurredAt: "2026-06-25T18:39:41",
        kind: "expense",
        categoryName: "餐饮",
        amount: "26.00",
        note: "黄记煌,备注里,带逗号的",
        sourceAccount: "招商银行"
      }
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
    expect(parseAlipayBill("just,some,random\ndata,here,now")).toEqual({
      source: "alipay",
      items: [],
      total: 0,
      skipped: 0
    });
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

describe("parseWechatSheetRows", () => {
  it("parses WeChat Pay xlsx rows and maps neutral rows to transfer", () => {
    const rows = [
      ["微信支付账单明细"],
      ["----------------------微信支付账单明细列表--------------------"],
      ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)", "支付方式", "当前状态", "交易单号", "商户单号", "备注"],
      [new Date("2026-06-27T13:05:26+08:00"), "商户消费", "美团", "美团订单", "支出", 38.83, "银行卡", "支付成功", "1", "2", "已优惠¥0.17"],
      ["2026-06-21 23:24:52", "群收款", "新西兰原住民", "/", "收入", "96.17", "/", "已存入零钱", "3", "/", "/"],
      ["2026-06-29 10:57:55", "零钱充值", "上海农商银行(3440)", "/", "/", 100, "银行卡", "充值完成", "4", "/", "/"],
      ["bad row"]
    ];

    const { items, total, skipped } = parseWechatSheetRows(rows);

    expect(total).toBe(4);
    expect(parseWechatSheetRows(rows).source).toBe("wechat");
    expect(skipped).toBe(1);
    expect(items).toEqual([
      {
        date: "2026-06-27",
        occurredAt: "2026-06-27T05:05:26",
        kind: "expense",
        categoryName: "商户消费",
        amount: "38.83",
        note: "美团 · 美团订单 · 银行卡 · 支付成功 · 已优惠¥0.17",
        sourceRecordId: "1",
        sourceAccount: "银行卡"
      },
      {
        date: "2026-06-21",
        occurredAt: "2026-06-21T23:24:52",
        kind: "income",
        categoryName: "群收款",
        amount: "96.17",
        note: "新西兰原住民 · 已存入零钱",
        sourceRecordId: "3"
      },
      {
        date: "2026-06-29",
        occurredAt: "2026-06-29T10:57:55",
        kind: "transfer",
        categoryName: "零钱充值",
        amount: "100.00",
        note: "上海农商银行(3440) · 银行卡 · 充值完成",
        sourceRecordId: "4",
        sourceAccount: "银行卡"
      }
    ]);
  });

  it("keeps the Excel calendar date for evening transactions", () => {
    const rows = [
      ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)"],
      [new Date("2026-06-10T22:58:42.000Z"), "零钱提现", "招商银行", "/", "/", 100]
    ];

    expect(parseWechatSheetRows(rows).items[0]?.date).toBe("2026-06-10");
  });
});

describe("parseWechatWorkbook", () => {
  it("extracts WeChat Pay rows from an xlsx ArrayBuffer", async () => {
    expect((await parseWechatWorkbook(base64ToArrayBuffer(wechatWorkbookFixture))).items).toEqual([
      {
        date: "2026-06-27",
        occurredAt: "2026-06-27T13:05:26",
        kind: "expense",
        categoryName: "商户消费",
        amount: "38.83",
        note: "美团 · 美团订单 · 银行卡 · 支付成功",
        sourceRecordId: "1",
        sourceAccount: "银行卡"
      }
    ]);
  });
});

const wechatWorkbookFixture =
  "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";

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
