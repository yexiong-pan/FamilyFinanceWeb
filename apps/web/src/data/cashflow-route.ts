import type { ExpenseNature } from "@family-finance/shared";

export type CashflowConfirmationStatus = "pending" | "confirmed";
export type CashflowSortField = "date" | "amount";
export type CashflowSortOrder = "asc" | "desc";

export interface CashflowFilters {
  category?: string;
  member?: string;
  status?: CashflowConfirmationStatus;
  expenseNature?: ExpenseNature;
  min?: number;
  max?: number;
  sortBy?: CashflowSortField;
  sortOrder?: CashflowSortOrder;
}

const filterKeys = ["category", "member", "status", "expenseNature", "min", "max", "sortBy", "sortOrder"] as const;

function parseText(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function parseAmount(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function parseCashflowFilters(params: URLSearchParams): CashflowFilters {
  const category = parseText(params.get("category"));
  const member = parseText(params.get("member"));
  const rawStatus = params.get("status");
  const status = rawStatus === "pending" || rawStatus === "confirmed" ? rawStatus : undefined;
  const rawExpenseNature = params.get("expenseNature");
  const expenseNature = (
    rawExpenseNature === "fixed"
    || rawExpenseNature === "necessary"
    || rawExpenseNature === "flexible"
    || rawExpenseNature === "goal"
  ) ? rawExpenseNature : undefined;
  const min = parseAmount(params.get("min"));
  const max = parseAmount(params.get("max"));
  const rawSortBy = params.get("sortBy");
  const sortBy = rawSortBy === "date" || rawSortBy === "amount" ? rawSortBy : undefined;
  const rawSortOrder = params.get("sortOrder");
  const sortOrder = rawSortOrder === "asc" || rawSortOrder === "desc" ? rawSortOrder : undefined;

  return {
    ...(category ? { category } : {}),
    ...(member ? { member } : {}),
    ...(status ? { status } : {}),
    ...(expenseNature ? { expenseNature } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {})
  };
}

export function writeCashflowFilters(
  params: URLSearchParams,
  filters: CashflowFilters
): URLSearchParams {
  const next = new URLSearchParams(params);
  filterKeys.forEach((key) => next.delete(key));

  if (filters.category?.trim()) next.set("category", filters.category.trim());
  if (filters.member?.trim()) next.set("member", filters.member.trim());
  if (filters.status === "pending" || filters.status === "confirmed") next.set("status", filters.status);
  if (filters.expenseNature) next.set("expenseNature", filters.expenseNature);
  if (filters.min !== undefined && Number.isFinite(filters.min) && filters.min >= 0) next.set("min", String(filters.min));
  if (filters.max !== undefined && Number.isFinite(filters.max) && filters.max >= 0) next.set("max", String(filters.max));
  if (filters.sortBy && filters.sortOrder) {
    next.set("sortBy", filters.sortBy);
    next.set("sortOrder", filters.sortOrder);
  }

  return next;
}

export function updateCashflowFilterParams(
  params: URLSearchParams,
  updates: Partial<CashflowFilters>
): URLSearchParams {
  return writeCashflowFilters(params, { ...parseCashflowFilters(params), ...updates });
}
