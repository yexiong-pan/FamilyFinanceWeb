import { createHash } from "node:crypto";
import { normalizeMoney } from "@family-finance/shared";
import type {
  ImportTransactionItem,
  MoneyAmount,
  TransactionKind,
  TransactionSource
} from "@family-finance/shared";

type LegacyComparable = {
  date: string | Date;
  kind: TransactionKind;
  amount: MoneyAmount | { toString(): string };
  note?: string | null;
  sourceCategory?: string | null;
  categoryName?: string | null;
};

export function buildImportRecordKey(
  source: Exclude<TransactionSource, "manual">,
  item: ImportTransactionItem
): string {
  const sourceRecordId = normalizeText(item.sourceRecordId);
  if (sourceRecordId) {
    return `${source}:id:${sourceRecordId}`;
  }

  const payload = [
    source,
    normalizeTimestamp(item.occurredAt ?? item.date),
    item.kind,
    normalizeMoney(item.amount),
    normalizeText(item.sourceCategory ?? item.categoryName),
    normalizeText(item.note),
    normalizeText(item.sourceAccount)
  ];
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `${source}:sha256:${digest}`;
}

export function buildLegacyImportKey(item: LegacyComparable): string {
  const date = item.date instanceof Date
    ? item.date.toISOString().slice(0, 10)
    : item.date.slice(0, 10);
  return JSON.stringify([
    date,
    item.kind,
    normalizeMoney(item.amount.toString()),
    normalizeText(item.sourceCategory ?? item.categoryName),
    normalizeText(item.note)
  ]);
}

function normalizeTimestamp(value: string): string {
  return value.trim().replace(" ", "T");
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}
