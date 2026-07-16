import type { ImportTransactionItem, TransactionKind, TransactionSource } from "@family-finance/shared";

const KIND_MAP: Record<string, TransactionKind> = {
  支出: "expense",
  收入: "income",
  不计收支: "transfer",
  "/": "transfer"
};

export interface ParsedBill {
  source: Exclude<TransactionSource, "manual">;
  items: ImportTransactionItem[];
  total: number;
  skipped: number;
}

// Parses a (already decoded) Alipay / cashbook CSV export.
// Columns: 记录时间,分类,收支类型,金额,备注,账户,来源,标签
export function parseAlipayBill(text: string): ParsedBill {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.replace(/^﻿/, "").trim().startsWith("记录时间"));
  if (headerIndex === -1) {
    return { source: "alipay", items: [], total: 0, skipped: 0 };
  }

  const items: ImportTransactionItem[] = [];
  let skipped = 0;

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) {
      continue;
    }
    // Trailing columns are 账户,来源,标签,(empty); 备注 may itself contain commas.
    const parts = line.split(",");
    if (parts.length < 8) {
      skipped += 1;
      continue;
    }
    const time = (parts[0] ?? "").trim();
    const categoryName = (parts[1] ?? "").trim() || "其他";
    const kind = KIND_MAP[(parts[2] ?? "").trim()];
    const amount = normalizeAmount(parts[3] ?? "");
    const note = parts.slice(4, parts.length - 4).join(",").trim();
    const date = time.slice(0, 10);

    if (!kind || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount === null) {
      skipped += 1;
      continue;
    }
    items.push({ date, kind, categoryName, amount, note: note || undefined });
  }

  return { source: "alipay", items, total: items.length + skipped, skipped };
}

type SheetCell = string | number | boolean | Date | null | undefined;

const WECHAT_HEADERS = ["交易时间", "交易类型", "交易对方", "商品", "收/支", "金额(元)"];

// Parses rows extracted from a WeChat Pay xlsx bill.
export function parseWechatSheetRows(rows: SheetCell[][]): ParsedBill {
  const headerIndex = rows.findIndex((row) => WECHAT_HEADERS.every((header, index) => cellText(row[index]) === header));
  if (headerIndex === -1) {
    return { source: "wechat", items: [], total: 0, skipped: 0 };
  }

  const items: ImportTransactionItem[] = [];
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => cellText(cell))) {
      continue;
    }

    const date = normalizeDate(row[0]);
    const categoryName = cellText(row[1]) || "其他";
    const kind = KIND_MAP[cellText(row[4])];
    const amount = normalizeAmount(row[5]);
    const note = buildWechatNote(row);

    if (!kind || !date || amount === null) {
      skipped += 1;
      continue;
    }
    items.push({ date, kind, categoryName, amount, note: note || undefined });
  }

  return { source: "wechat", items, total: items.length + skipped, skipped };
}

export async function parseWechatWorkbook(buffer: ArrayBuffer): Promise<ParsedBill> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const [sheet] = await readXlsxFile(buffer);
  const rows = (sheet?.data ?? []).filter((row) => row.some((cell) => cell !== null)) as SheetCell[][];
  return parseWechatSheetRows(rows);
}

// Remaps each item's category name through the user-defined mapping
// (source category -> target category); unmapped categories keep their name.
export function applyCategoryMap(
  items: ImportTransactionItem[],
  map: Record<string, string>
): ImportTransactionItem[] {
  return items.map((item) => ({
    ...item,
    categoryName: map[item.categoryName] ?? item.categoryName
  }));
}

export function summarizeBill(items: ImportTransactionItem[]): Record<TransactionKind, number> {
  return items.reduce(
    (totals, item) => {
      totals[item.kind] += 1;
      return totals;
    },
    { expense: 0, income: 0, transfer: 0, adjustment: 0 } as Record<TransactionKind, number>
  );
}

function normalizeAmount(raw: SheetCell): string | null {
  const cleaned = cellText(raw).replace(/[¥￥，,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value.toFixed(2);
}

function normalizeDate(raw: SheetCell): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) {
    const year = raw.getFullYear();
    const month = String(raw.getMonth() + 1).padStart(2, "0");
    const day = String(raw.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = cellText(raw);
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  if (!year || !month || !day) {
    return null;
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function buildWechatNote(row: SheetCell[]): string {
  const parts = [row[2], row[3], row[6], row[7], row[10]].map(cellText).filter((value) => value && value !== "/");
  return [...new Set(parts)].join(" · ");
}

function cellText(value: SheetCell): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return normalizeDate(value) ?? "";
  }
  return String(value).replace(/^﻿/, "").trim();
}
