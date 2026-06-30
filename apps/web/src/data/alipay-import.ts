import type { ImportTransactionItem, TransactionKind } from "@family-finance/shared";

const KIND_MAP: Record<string, TransactionKind> = {
  支出: "expense",
  收入: "income",
  不计收支: "transfer"
};

export interface ParsedBill {
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
    return { items: [], total: 0, skipped: 0 };
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

  return { items, total: items.length + skipped, skipped };
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

function normalizeAmount(raw: string): string | null {
  const cleaned = raw.replace(/[，,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value.toFixed(2);
}
